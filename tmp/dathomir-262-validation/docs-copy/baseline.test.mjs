import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createRequire } from "node:module";
import { createServer } from "node:http";
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve, extname } from "node:path";

const repo = fileURLToPath(new URL("../../../", import.meta.url));
const require = createRequire(resolve(repo, "playgrounds/e2e/package.json"));
const { chromium } = await import(pathToFileURL(require.resolve("playwright")).href);
const output = fileURLToPath(new URL("./build/", import.meta.url));
const render = (await import(pathToFileURL(resolve(output, "server/entry-server.js")).href))
  .default;
const template = readFileSync(resolve(output, "client/index.html"), "utf8");
const records = [];
let browser;
let server;
let baseUrl;

beforeAll(async () => {
  server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url, baseUrl);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, "");
      const path = resolve(output, "client", relative);
      if (relative && path.startsWith(resolve(output, "client") + "/") && existsSync(path)) {
        const mime =
          { ".js": "text/javascript", ".css": "text/css", ".svg": "image/svg+xml" }[
            extname(path)
          ] ?? "application/octet-stream";
        res.writeHead(200, { "content-type": mime });
        res.end(readFileSync(path));
        return;
      }
      const result = await render({
        request: new Request(url),
        requestId: "copy-baseline",
        url: url.href,
      });
      res.writeHead(result.statusCode ?? 200, { "content-type": "text/html" });
      res.end(template.replace("<!--ssr-outlet-->", result.html));
    } catch (error) {
      res.writeHead(500);
      res.end(String(error));
    }
  });
  await new Promise((resolveListen) => server.listen(0, "127.0.0.1", resolveListen));
  baseUrl = `http://127.0.0.1:${server.address().port}`;
  browser = await chromium.launch({ headless: true });
}, 60000);

afterAll(async () => {
  writeFileSync(
    new URL("./observations.json", import.meta.url),
    JSON.stringify(
      { timestamp: new Date().toISOString(), browser: browser?.version(), observations: records },
      null,
      2,
    ) + "\n",
  );
  await browser?.close();
  if (server) await new Promise((resolveClose) => server.close(resolveClose));
});

async function pageWithClipboard(mode, csr = true) {
  const page = await browser.newPage();
  await page.addInitScript((mode) => {
    window.copyCalls = [];
    window.copyTimerClears = 0;
    const timerIds = new Set();
    const set = window.setTimeout.bind(window);
    const clear = window.clearTimeout.bind(window);
    window.setTimeout = (callback, delay, ...args) => {
      const id = set(callback, delay, ...args);
      if (delay === 1800) timerIds.add(id);
      return id;
    };
    window.clearTimeout = (id) => {
      if (timerIds.delete(id)) window.copyTimerClears++;
      clear(id);
    };
    const clipboard =
      mode === "missing"
        ? undefined
        : {
            writeText(text) {
              window.copyCalls.push(text);
              return mode === "reject"
                ? Promise.reject(new Error("permission denied"))
                : Promise.resolve();
            },
          };
    Object.defineProperty(navigator, "clipboard", { configurable: true, value: clipboard });
  }, mode);
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("console", (message) => {
    if (message.type() === "error" || message.type() === "warning") errors.push(message.text());
  });
  await page.goto(baseUrl + "/store", { waitUntil: "networkidle" });
  await page.waitForFunction(() => customElements.get("dathra-code") !== undefined);
  if (csr)
    await page.evaluate(() => {
      const host = document.createElement("dathra-code");
      host.id = "copy-csr-probe";
      host.setAttribute("code", "const count = 7;");
      host.setAttribute("language", "ts");
      document.body.append(host);
    });
  const host = csr ? page.locator("#copy-csr-probe") : page.locator("dathra-code").first();
  const button = host.getByRole("button");
  await button.waitFor();
  return { page, host, button, errors };
}

describe("actual Docs Copy baseline", () => {
  it("records the known SSR activation gap independently from CSR behavior", async () => {
    const { page, button, errors } = await pageWithClipboard("resolve", false);
    try {
      await button.click();
      expect(await button.textContent()).toBe("Copy");
      expect(await page.evaluate(() => window.copyCalls.length)).toBe(0);
      records.push({
        case: "SSR-activation",
        observed: "Copy / no clipboard call",
        productCriterion: "FAIL; known in #252 S-07",
        errors,
      });
    } finally {
      await page.close();
    }
  });
  for (const mode of ["missing", "reject"]) {
    it(`records false success with clipboard ${mode}`, async () => {
      const { page, button, errors } = await pageWithClipboard(mode);
      try {
        await button.click();
        records.push({
          case: `${mode}-after-click`,
          observed: await button.textContent(),
          calls: await page.evaluate(() => window.copyCalls.length),
          host: await button.evaluate((element) => element.outerHTML),
          errors,
        });
        await expect.poll(() => button.textContent()).toBe("Copied!");
        const calls = await page.evaluate(() => window.copyCalls.length);
        expect(calls).toBe(mode === "missing" ? 0 : 1);
        records.push({
          case: mode,
          observed: "Copied!",
          expectedProductBehavior: "failure/recovery feedback",
          productCriterion: "FAIL",
          calls,
          errors,
        });
      } finally {
        await page.close();
      }
    });
  }

  it("clears the old reset timer on repeated click and on host removal", async () => {
    const { page, host, button, errors } = await pageWithClipboard("resolve");
    try {
      await button.click();
      records.push({
        case: "resolve-after-click",
        observed: await button.textContent(),
        calls: await page.evaluate(() => window.copyCalls.length),
        errors,
      });
      await expect.poll(() => button.textContent()).toBe("Copied!");
      await button.click();
      expect(await page.evaluate(() => window.copyTimerClears)).toBe(1);
      await host.evaluate((element) => element.remove());
      await expect.poll(() => page.evaluate(() => window.copyTimerClears)).toBe(2);
      records.push({
        case: "repeat-and-remove",
        observedClears: 2,
        productCriterion: "PASS within instrumentation",
        errors,
      });
    } finally {
      await page.close();
    }
  });
});
