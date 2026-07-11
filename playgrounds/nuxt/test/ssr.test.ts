import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

const PACKAGE_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SERVER_ENTRY = resolve(PACKAGE_ROOT, ".output/server/index.mjs");
const SERVER_START_TIMEOUT_MS = 30000;
const SERVER_STOP_TIMEOUT_MS = 5000;
const READINESS_REQUEST_TIMEOUT_MS = 1000;
const TEST_REQUEST_TIMEOUT_MS = 5000;

let baseUrl = "";
let browser: Browser | undefined;
let serverOutput = "";
let serverProcess: ChildProcessWithoutNullStreams | undefined;

function findAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const portProbe = createServer();

    portProbe.once("error", reject);
    portProbe.listen(0, "127.0.0.1", () => {
      const address = portProbe.address();

      if (address === null || typeof address === "string") {
        portProbe.close();
        reject(new Error("Unable to allocate a TCP port for the Nitro server."));
        return;
      }

      portProbe.close((error) => {
        if (error) {
          reject(error);
          return;
        }

        resolvePort(address.port);
      });
    });
  });
}

function waitForProcessExit(
  childProcess: ChildProcessWithoutNullStreams,
  timeoutMs: number,
): Promise<boolean> {
  return new Promise((resolveExit) => {
    if (childProcess.exitCode !== null || childProcess.signalCode !== null) {
      resolveExit(true);
      return;
    }

    const timeout = setTimeout(() => {
      childProcess.off("exit", handleExit);
      resolveExit(false);
    }, timeoutMs);
    timeout.unref();

    const handleExit = () => {
      clearTimeout(timeout);
      resolveExit(true);
    };

    childProcess.once("exit", handleExit);
  });
}

async function stopServer(): Promise<void> {
  if (
    serverProcess === undefined ||
    serverProcess.exitCode !== null ||
    serverProcess.signalCode !== null
  ) {
    return;
  }

  serverProcess.kill("SIGTERM");
  const stopped = await waitForProcessExit(serverProcess, SERVER_STOP_TIMEOUT_MS);

  if (stopped) {
    return;
  }

  serverProcess.kill("SIGKILL");
  const forceStopped = await waitForProcessExit(serverProcess, SERVER_STOP_TIMEOUT_MS);
  if (!forceStopped) {
    throw new Error(`Nitro server did not exit after SIGKILL.\n${serverOutput}`);
  }
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + SERVER_START_TIMEOUT_MS;
  let lastError: unknown = null;

  while (Date.now() < deadline) {
    if (
      serverProcess !== undefined &&
      (serverProcess.exitCode !== null || serverProcess.signalCode !== null)
    ) {
      throw new Error(`Nitro server exited before accepting requests.\n${serverOutput}`);
    }

    try {
      const requestTimeout = Math.max(
        1,
        Math.min(READINESS_REQUEST_TIMEOUT_MS, deadline - Date.now()),
      );
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(requestTimeout),
      });
      await response.text();
      return;
    } catch (error) {
      lastError = error;
      const retryDelay = Math.min(100, Math.max(0, deadline - Date.now()));
      if (retryDelay > 0) {
        await new Promise((resolveDelay) => setTimeout(resolveDelay, retryDelay));
      }
    }
  }

  throw new Error(
    `Timed out waiting for the Nitro server. Last error: ${String(lastError)}\n${serverOutput}`,
  );
}

beforeAll(async () => {
  const port = await findAvailablePort();
  baseUrl = `http://127.0.0.1:${port}/`;
  serverProcess = spawn(process.execPath, [SERVER_ENTRY], {
    cwd: PACKAGE_ROOT,
    env: {
      ...process.env,
      HOST: "127.0.0.1",
      NITRO_HOST: "127.0.0.1",
      NITRO_PORT: String(port),
      PORT: String(port),
    },
  });

  serverProcess.stdout.setEncoding("utf8");
  serverProcess.stderr.setEncoding("utf8");
  serverProcess.stdout.on("data", (chunk: string) => {
    serverOutput += chunk;
  });
  serverProcess.stderr.on("data", (chunk: string) => {
    serverOutput += chunk;
  });
  serverProcess.on("error", (error) => {
    serverOutput += `${error.stack ?? error.message}\n`;
  });

  try {
    await waitForServer();
  } catch (error) {
    try {
      await stopServer();
    } catch (cleanupError) {
      throw new AggregateError([error, cleanupError], "Nitro server startup and cleanup failed");
    }
    throw error;
  }
});

afterAll(async () => {
  const cleanupResults = await Promise.allSettled([
    browser?.close() ?? Promise.resolve(),
    stopServer(),
  ]);
  browser = undefined;
  const cleanupErrors = cleanupResults.flatMap((result) =>
    result.status === "rejected" ? [result.reason] : [],
  );

  if (cleanupErrors.length > 0) {
    throw new AggregateError(cleanupErrors, "Failed to close Nuxt test resources");
  }
});

describe("Nuxt production SSR", () => {
  it("serves DSD and activates the counter in Chromium", async () => {
    const response = await fetch(baseUrl, {
      signal: AbortSignal.timeout(TEST_REQUEST_TIMEOUT_MS),
    });
    const html = await response.text();
    const failureContext = `Response body:\n${html}\nNitro output:\n${serverOutput}`;

    expect(response.status, failureContext).toBe(200);
    expect(html).toMatch(/<my-counter\b[^>]*>\s*<template shadowrootmode="open">/);
    expect(html).toContain("Counter Component");

    browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    const browserOutput: Array<string> = [];

    page.on("console", (message) => {
      browserOutput.push(`[console:${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => {
      browserOutput.push(`[pageerror] ${error.stack ?? error.message}`);
    });
    page.on("requestfailed", (request) => {
      browserOutput.push(
        `[requestfailed] ${request.url()} ${request.failure()?.errorText ?? "unknown error"}`,
      );
    });
    page.on("response", (pageResponse) => {
      if (pageResponse.request().resourceType() === "script") {
        browserOutput.push(`[script:${pageResponse.status()}] ${pageResponse.url()}`);
      }
    });

    try {
      const navigationResponse = await page.goto(baseUrl, {
        waitUntil: "domcontentloaded",
      });
      expect(navigationResponse?.status()).toBe(200);

      const counter = page.locator("my-counter");
      const count = counter.locator("span");
      const increment = counter.locator("button").filter({ hasText: "+" });

      const counterWasDefined = await page
        .waitForFunction(() => customElements.get("my-counter") !== undefined, undefined, {
          timeout: 10000,
        })
        .then(
          () => true,
          () => false,
        );
      const pageState = await page.evaluate(() => ({
        customElementsAvailable: typeof customElements !== "undefined",
        readyState: document.readyState,
        scripts: Array.from(document.scripts, (script) => script.src),
      }));
      expect(
        counterWasDefined,
        `Page state:\n${JSON.stringify(pageState)}\nBrowser output:\n${browserOutput.join("\n")}`,
      ).toBe(true);
      await expect
        .poll(() => counter.evaluate((element) => element.shadowRoot !== null))
        .toBe(true);
      await expect.poll(async () => (await count.textContent())?.trim()).toBe("5");
      await increment.click();
      await expect
        .poll(async () => (await count.textContent())?.trim(), {
          message: `Browser output:\n${browserOutput.join("\n")}`,
        })
        .toBe("6");
    } finally {
      await page.close();
    }
  });
});
