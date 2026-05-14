import { spawn, type ChildProcess } from "node:child_process";
import { createServer } from "node:net";
import { fileURLToPath } from "node:url";
import path from "node:path";

import { chromium, type Browser, type Page } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "../../..");

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
  cleanupRegistered: boolean;
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

function runCommand(command: string, args: string[]): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      cwd: repoRoot,
      env: { ...process.env, FORCE_COLOR: "0" },
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";
    child.stderr?.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", reject);
    child.on("exit", (code) => {
      if (code === 0) {
        resolve();
        return;
      }

      reject(
        new Error(
          `[playground/e2e] ${command} ${args.join(" ")} failed with exit code ${code}\n${stderr}`,
        ),
      );
    });
  });
}

async function waitForServer(
  baseUrl: string,
  previewLogs: string,
): Promise<void> {
  let lastError: unknown = null;

  for (let attempt = 0; attempt < 120; attempt += 1) {
    try {
      const response = await fetch(baseUrl);
      if (response.ok) {
        return;
      }
      lastError = new Error(`Unexpected status ${response.status}`);
    } catch (error) {
      lastError = error;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
  }

  throw new Error(
    `[playground/e2e] Preview server did not become ready. Last error: ${String(lastError)}\n${previewLogs}`,
  );
}

async function stopPreviewServer(previewProcess: ChildProcess): Promise<void> {
  if (previewProcess.exitCode !== null) {
    return;
  }

  await new Promise<void>((resolve) => {
    const timeout = setTimeout(() => {
      previewProcess.kill("SIGKILL");
    }, 5000);

    previewProcess.once("exit", () => {
      clearTimeout(timeout);
      resolve();
    });

    previewProcess.kill("SIGTERM");
  });
}

async function startHarness(): Promise<Harness> {
  const previewPort = await getAvailablePort();
  const baseUrl = `http://127.0.0.1:${previewPort}`;
  const previewLogs = { value: "" };

  await runCommand("pnpm", ["--filter", "@playground/e2e", "build"]);

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

  try {
    await waitForServer(baseUrl, previewLogs.value);
  } catch (error) {
    await stopPreviewServer(previewProcess);
    throw error;
  }

  const browser = await chromium.launch({ headless: true });
  return {
    baseUrl,
    browser,
    previewProcess,
    previewPort,
  };
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
      const harness = await state.promise;
      await harness.browser.close();
      await stopPreviewServer(harness.previewProcess);
    } finally {
      globalThis.__dathraPlaygroundE2EHarness = undefined;
    }
  })();

  await state.cleanupPromise;
}

function registerHarnessCleanup(): void {
  const state = globalThis.__dathraPlaygroundE2EHarness;
  if (state === undefined || state.cleanupRegistered) {
    return;
  }

  state.cleanupRegistered = true;
  process.once("beforeExit", () => {
    void disposeHarness();
  });
}

async function acquireHarness(): Promise<void> {
  if (globalThis.__dathraPlaygroundE2EHarness === undefined) {
    globalThis.__dathraPlaygroundE2EHarness = {
      refs: 0,
      promise: startHarness(),
      cleanupRegistered: false,
    };
  }

  registerHarnessCleanup();
  globalThis.__dathraPlaygroundE2EHarness.refs += 1;
  await globalThis.__dathraPlaygroundE2EHarness.promise;
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
