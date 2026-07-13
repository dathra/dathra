import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");
const SERVER_START_TIMEOUT_MS = 60000;
const SERVER_REQUEST_TIMEOUT_MS = 1000;

type Harness = {
  baseUrl: string;
  browser: Browser;
  previewProcess: ChildProcess;
  previewPort: number;
};

type HarnessState = {
  refs: number;
  promise: Promise<Harness>;
  cleanupPromise?: Promise<void>;
};

type PreviewLogs = {
  value: string;
  processError: Error | null;
};

declare global {
  var __dathraPlaygroundE2EHarness: HarnessState | undefined;
}

function appendPreviewLog(
  buffer: { value: string },
  chunk: string | Buffer,
): void {
  buffer.value += chunk.toString();
}

async function getAvailablePort(): Promise<number> {
  return await new Promise((resolve, reject) => {
    const probe = createServer();
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();
      if (address === null || typeof address === "string") {
        probe.close(() =>
          reject(new Error("[playground/e2e] Failed to resolve preview port")),
        );
        return;
      }

      const { port } = address;
      probe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolve(port);
      });
    });
    probe.on("error", reject);
  });
}

async function waitForServer(
  baseUrl: string,
  previewProcess: ChildProcess,
  previewLogs: PreviewLogs,
): Promise<void> {
  let lastError: unknown = null;
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;

  while (Date.now() < deadline) {
    if (previewLogs.processError !== null) {
      throw new Error(
        `[playground/e2e] Preview server failed to start: ${previewLogs.processError.message}\n${previewLogs.value}`,
      );
    }
    if (
      previewProcess.exitCode !== null ||
      previewProcess.signalCode !== null
    ) {
      throw new Error(
        `[playground/e2e] Preview server exited before becoming ready with code ${String(previewProcess.exitCode)} and signal ${String(previewProcess.signalCode)}.\n${previewLogs.value}`,
      );
    }

    try {
      const requestTimeout = Math.max(
        1,
        Math.min(SERVER_REQUEST_TIMEOUT_MS, deadline - Date.now()),
      );
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(requestTimeout),
      });
      await response.body?.cancel();
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    const retryDelay = Math.min(500, Math.max(0, deadline - Date.now()));
    if (retryDelay > 0) {
      await new Promise((resolve) => setTimeout(resolve, retryDelay));
    }
  }

  throw new Error(
    `[playground/e2e] Preview server did not become ready. Last error: ${String(lastError)}\n${previewLogs.value}`,
  );
}

async function stopPreviewServer(previewProcess: ChildProcess): Promise<void> {
  if (
    previewProcess.exitCode !== null ||
    previewProcess.signalCode !== null ||
    previewProcess.pid === undefined
  ) {
    return;
  }

  await new Promise<void>((resolve, reject) => {
    const timeouts: {
      forceExit?: ReturnType<typeof setTimeout>;
      terminate?: ReturnType<typeof setTimeout>;
    } = {};
    let finish = () => {};

    const cleanup = () => {
      if (timeouts.terminate !== undefined) {
        clearTimeout(timeouts.terminate);
      }
      if (timeouts.forceExit !== undefined) {
        clearTimeout(timeouts.forceExit);
      }
      previewProcess.off("exit", finish);
    };

    finish = () => {
      cleanup();
      resolve();
    };

    const fail = (message: string) => {
      cleanup();
      reject(new Error(message));
    };

    timeouts.terminate = setTimeout(() => {
      if (
        previewProcess.exitCode !== null ||
        previewProcess.signalCode !== null
      ) {
        finish();
        return;
      }

      if (!previewProcess.kill("SIGKILL")) {
        if (
          previewProcess.exitCode !== null ||
          previewProcess.signalCode !== null
        ) {
          finish();
          return;
        }

        fail("[playground/e2e] Failed to send SIGKILL to preview server");
        return;
      }

      timeouts.forceExit = setTimeout(() => {
        cleanup();
        reject(
          new Error(
            "[playground/e2e] Preview server did not exit after SIGKILL",
          ),
        );
      }, 1000);
    }, 5000);

    previewProcess.once("exit", finish);

    if (!previewProcess.kill("SIGTERM")) {
      if (
        previewProcess.exitCode !== null ||
        previewProcess.signalCode !== null
      ) {
        finish();
      } else {
        fail("[playground/e2e] Failed to send SIGTERM to preview server");
      }
    }
  });
}

async function startHarness(): Promise<Harness> {
  const previewPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${previewPort}`;
  const previewLogs: PreviewLogs = { value: "", processError: null };

  const previewProcess = spawn(
    "pnpm",
    ["--filter", "@playground/e2e", "preview"],
    {
      cwd: repoRoot,
      env: { ...process.env, FORCE_COLOR: "0", PORT: String(previewPort) },
      stdio: ["ignore", "pipe", "pipe"],
    },
  );
  previewProcess.stdout?.on("data", (chunk) =>
    appendPreviewLog(previewLogs, chunk),
  );
  previewProcess.stderr?.on("data", (chunk) =>
    appendPreviewLog(previewLogs, chunk),
  );
  previewProcess.on("error", (error) => {
    previewLogs.processError = error;
    appendPreviewLog(previewLogs, `${error.stack ?? error.message}\n`);
  });

  let browser: Browser | undefined;
  try {
    await waitForServer(baseUrl, previewProcess, previewLogs);
    browser = await chromium.launch({ headless: true });

    return {
      baseUrl,
      browser,
      previewProcess,
      previewPort,
    };
  } catch (error) {
    const cleanupResults = await Promise.allSettled([
      browser?.close() ?? Promise.resolve(),
      stopPreviewServer(previewProcess),
    ]);
    const cleanupErrors = cleanupResults.flatMap((result) =>
      result.status === "rejected" ? [result.reason] : [],
    );

    if (cleanupErrors.length > 0) {
      throw new AggregateError(
        [error, ...cleanupErrors],
        "[playground/e2e] Harness startup and cleanup failed",
      );
    }

    throw error;
  }
}

async function disposeHarness(): Promise<void> {
  const state = globalThis.__dathraPlaygroundE2EHarness;
  if (state === undefined) {
    return;
  }

  if (state.cleanupPromise !== undefined) {
    await state.cleanupPromise;
    return;
  }

  state.cleanupPromise = (async () => {
    try {
      let harness: Harness;
      try {
        harness = await state.promise;
      } catch {
        return;
      }

      const cleanupResults = await Promise.allSettled([
        harness.browser.close(),
        stopPreviewServer(harness.previewProcess),
      ]);
      const cleanupErrors = cleanupResults.flatMap((result) =>
        result.status === "rejected" ? [result.reason] : [],
      );

      if (cleanupErrors.length > 0) {
        throw new AggregateError(
          cleanupErrors,
          "[playground/e2e] Failed to dispose harness resources",
        );
      }
    } finally {
      if (globalThis.__dathraPlaygroundE2EHarness === state) {
        globalThis.__dathraPlaygroundE2EHarness = undefined;
      }
    }
  })();

  await state.cleanupPromise;
}

async function acquireHarness(): Promise<void> {
  while (true) {
    if (globalThis.__dathraPlaygroundE2EHarness === undefined) {
      globalThis.__dathraPlaygroundE2EHarness = {
        refs: 0,
        promise: startHarness(),
      };
    }

    const state = globalThis.__dathraPlaygroundE2EHarness;
    if (state.cleanupPromise !== undefined) {
      await state.cleanupPromise;
      continue;
    }

    state.refs += 1;

    try {
      await state.promise;
      return;
    } catch (error) {
      state.refs -= 1;
      if (
        state.refs <= 0 &&
        globalThis.__dathraPlaygroundE2EHarness === state
      ) {
        globalThis.__dathraPlaygroundE2EHarness = undefined;
      }
      throw error;
    }
  }
}

async function releaseHarness(): Promise<void> {
  const state = globalThis.__dathraPlaygroundE2EHarness;
  if (state === undefined) {
    return;
  }

  state.refs -= 1;
  if (state.refs > 0) {
    return;
  }

  state.refs = 0;
  await disposeHarness();
}

async function getHarness(): Promise<Harness> {
  const state = globalThis.__dathraPlaygroundE2EHarness;
  if (state === undefined) {
    throw new Error("[playground/e2e] Harness was not acquired before use");
  }

  return await state.promise;
}

async function openPage(
  routePath: string,
  options?: {
    viewport?: { width: number; height: number };
  },
): Promise<{
  page: Page;
  consoleErrors: string[];
}> {
  const harness = await getHarness();
  const page = await harness.browser.newPage();
  const consoleErrors: string[] = [];

  if (options?.viewport !== undefined) {
    await page.setViewportSize(options.viewport);
  }

  page.on("console", (message) => {
    if (message.type() !== "error") {
      return;
    }

    const text = message.text();
    if (text.includes("favicon.ico")) {
      return;
    }

    consoleErrors.push(text);
  });

  await page.goto(`${harness.baseUrl}${routePath}`, {
    waitUntil: "networkidle",
  });

  return { page, consoleErrors };
}

async function fetchHtml(routePath = "/"): Promise<{
  html: string;
  response: Response;
}> {
  const harness = await getHarness();
  const response = await fetch(`${harness.baseUrl}${routePath}`);
  return {
    html: await response.text(),
    response,
  };
}

export { acquireHarness, fetchHtml, openPage, releaseHarness };
