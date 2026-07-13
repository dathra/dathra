import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import { createServer } from "node:net";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

import { chromium, type Browser } from "playwright";
import { afterAll, beforeAll, expect, it } from "vitest";

const packageRoot = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const serverEntry = resolve(packageRoot, ".output/server/index.mjs");

let baseUrl = "";
let browser: Browser | undefined;
let serverOutput = "";
let serverProcess: ChildProcessWithoutNullStreams | undefined;

function findAvailablePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const probe = createServer();

    probe.once("error", reject);
    probe.listen(0, "127.0.0.1", () => {
      const address = probe.address();

      if (address === null || typeof address === "string") {
        probe.close();
        reject(new Error("Unable to allocate a port for the Nitro server"));
        return;
      }

      probe.close((error) => {
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

    const timeouts: { exit?: NodeJS.Timeout } = {};
    const handleExit = () => {
      if (timeouts.exit !== undefined) {
        clearTimeout(timeouts.exit);
      }
      resolveExit(true);
    };

    timeouts.exit = setTimeout(() => {
      childProcess.off("exit", handleExit);
      resolveExit(false);
    }, timeoutMs);
    timeouts.exit.unref();
    childProcess.once("exit", handleExit);
  });
}

async function stopServer(): Promise<void> {
  const childProcess = serverProcess;
  serverProcess = undefined;

  if (
    childProcess === undefined ||
    childProcess.exitCode !== null ||
    childProcess.signalCode !== null
  ) {
    return;
  }

  childProcess.kill("SIGTERM");
  if (await waitForProcessExit(childProcess, 5000)) {
    return;
  }

  childProcess.kill("SIGKILL");
  if (!(await waitForProcessExit(childProcess, 5000))) {
    throw new Error(`Nitro server did not exit after SIGKILL\n${serverOutput}`);
  }
}

async function waitForServer(): Promise<void> {
  const deadline = Date.now() + 30000;
  let lastError: unknown;

  while (Date.now() < deadline) {
    if (
      serverProcess !== undefined &&
      (serverProcess.exitCode !== null || serverProcess.signalCode !== null)
    ) {
      throw new Error(`Nitro server exited before readiness\n${serverOutput}`);
    }

    try {
      const response = await fetch(baseUrl, {
        signal: AbortSignal.timeout(1000),
      });
      await response.text();
      return;
    } catch (error) {
      lastError = error;
      await new Promise((resolveDelay) => setTimeout(resolveDelay, 100));
    }
  }

  throw new Error(`Timed out waiting for the Nitro server: ${String(lastError)}\n${serverOutput}`);
}

beforeAll(async () => {
  const port = await findAvailablePort();
  baseUrl = `http://127.0.0.1:${port}/`;
  serverProcess = spawn(process.execPath, [serverEntry], {
    cwd: packageRoot,
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

  try {
    await waitForServer();
    browser = await chromium.launch({ headless: true });
  } catch (error) {
    await stopServer();
    throw error;
  }
});

afterAll(async () => {
  const results = await Promise.allSettled([browser?.close() ?? Promise.resolve(), stopServer()]);
  browser = undefined;
  const errors = results.flatMap((result) => (result.status === "rejected" ? [result.reason] : []));

  if (errors.length > 0) {
    throw new AggregateError(errors, "Failed to close Nuxt test resources");
  }
});

it("serves DSD and activates the counter in Chromium", async () => {
  if (browser === undefined) {
    throw new Error("Chromium was not initialized");
  }

  const response = await fetch(baseUrl, {
    signal: AbortSignal.timeout(5000),
  });
  const html = await response.text();

  expect(response.status).toBe(200);
  expect(html).toMatch(/<my-counter\b[^>]*>\s*<template shadowrootmode="open">/);
  expect(html).toContain("Counter Component");

  const page = await browser.newPage();
  const pageErrors: string[] = [];
  page.on("pageerror", (error) => {
    pageErrors.push(error.stack ?? error.message);
  });

  try {
    const navigation = await page.goto(baseUrl, {
      waitUntil: "networkidle",
    });
    expect(navigation?.status()).toBe(200);

    const counter = page.locator("my-counter");
    const count = counter.locator("span");
    await expect.poll(() => counter.evaluate((element) => element.shadowRoot !== null)).toBe(true);
    await expect.poll(async () => (await count.textContent())?.trim()).toBe("5");

    await counter.getByRole("button", { name: "+", exact: true }).click();
    await expect.poll(async () => (await count.textContent())?.trim()).toBe("6");
    expect(pageErrors).toEqual([]);
  } finally {
    await page.close();
  }
});
