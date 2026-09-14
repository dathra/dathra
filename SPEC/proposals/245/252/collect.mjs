import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync, readdirSync, writeFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { stripVTControlCharacters } from "node:util";

// Measurement-only executable. No application imports, source rewrites, or GitHub writes.
const [rootArg, outputArg] = process.argv.slice(2);
assert(
  rootArg && outputArg,
  "Usage: node collect.mjs CHECKOUT NEW_OUTPUT.json",
);
const root = path.resolve(rootArg);
const output = path.resolve(outputArg);
assert(!existsSync(output), "Refusing to overwrite an existing cohort");
const sha = "c1a30ed86fd2bd79e1c742362f552e9f62ff9f98";
const run = (bin, args) =>
  execFileSync(bin, args, {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 16 * 1024 * 1024,
  });
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
assert.equal(run("git", ["rev-parse", "HEAD"]).trim(), sha);
assert.equal(
  run("git", ["diff", "HEAD", "--", ".", ":(exclude)SPEC/proposals/245/252"]),
  "",
);
const untracked = run("git", ["ls-files", "--others", "--exclude-standard"])
  .trim()
  .split("\n")
  .filter(Boolean);
assert(
  untracked.every((name) => name.startsWith("SPEC/proposals/245/252/")),
  "Unrelated untracked source",
);
const require = createRequire(path.join(root, "playgrounds/e2e/package.json"));
const result = {
  schema: 1,
  startedAt: new Date().toISOString(),
  root,
  source: sha,
  collectorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  lockfileSha256: hash(readFileSync(path.join(root, "pnpm-lock.yaml"))),
  environment: {
    node: process.version,
    pnpm: run("pnpm", ["--version"]).trim(),
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    headless: true,
    cache:
      "new context per sample; CDP cache disabled; service workers blocked",
    throttling:
      "none; localhost HTTP; sequential cohorts; no host-load isolation",
  },
  procedure: {
    readiness:
      "Microtask after target click listener registration: initial count 7/theme verified, HTMLElement.click() yields 8; timestamp after observed update. Includes probe overhead, not exact activation completion.",
    repeat:
      "First readiness click is warm-up; four further HTMLElement.click() calls, each followed by rAF. Five total: 7 to 12. All samples retained; summary excludes only first click per navigation.",
    hooks:
      "addInitScript before app JS; native addEventListener and Element.remove delegate unchanged. ShadowRoot.querySelector injection is one-shot, exact selector and e2e-ssr-app owner only. Restore all three prototypes before remaining clicks and verify identities; close context in finally.",
    failure:
      "missing returns null without removing actual script; shape changes text to []; malformed changes text to not-json. Wait for injection plus target listener or hydrate diagnostic; then 100ms settling, snapshot, click, detach, microtask+rAF, late click.",
    disposal:
      "After five clicks save button/count references, remove fixture, await microtask and rAF, click detached button. Collector intentionally retains these nodes, so this is not a heap leak measurement.",
    observation:
      "goto load; readiness deadline 10s; browser API timing uses performance.now ms; next-rAF elapsed is not paint latency or INP. No navigation discarded.",
  },
  limitations: {
    cpu: "Not collected: no module self-time profiler. Resource duration and synchronous click wall time are not CPU self-time.",
    memory:
      "Not collected: retained-node probe roots objects; heap totals would include automation/hooks and cannot attribute retained stores. No zero or inferred heap value.",
    architecture:
      "No setup/render/fallback execution instrumentation; observed DOM identity does not prove no reconstruction.",
  },
  verification: [],
  artifacts: [],
  normal: [],
  failures: [],
};

for (const args of [
  ["install", "--frozen-lockfile", "--offline"],
  ["--filter", "@playground/e2e", "test"],
  ["--filter", "@dathra/docs", "build"],
  ["--filter", "@dathra/docs", "test"],
]) {
  const started = Date.now();
  const log = stripVTControlCharacters(run("pnpm", args));
  result.verification.push({
    command: `pnpm ${args.join(" ")}`,
    exitCode: 0,
    elapsedMs: Date.now() - started,
    testSummary: log
      .split("\n")
      .filter((line) => /Test Files|Tests\s+\d/.test(line))
      .map((line) => line.trim()),
  });
}
const { chromium } = require("playwright");
result.environment.playwright = require("playwright/package.json").version;
for (const base of ["playgrounds/e2e/dist", "docs/dist"]) {
  for (const name of readdirSync(path.join(root, base), {
    recursive: true,
  }).sort()) {
    if (!/\.(js|mjs|html|css)$/.test(name)) continue;
    const relative = `${base}/${name}`;
    const bytes = readFileSync(path.join(root, relative));
    result.artifacts.push({
      path: relative,
      bytes: bytes.length,
      sha256: hash(bytes),
    });
  }
}

const servers = [];
let browser;
async function startPreview(packageName) {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  const child = spawn("pnpm", ["--filter", packageName, "preview"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: "ignore",
  });
  servers.push(child);
  let spawnError;
  child.on("error", (error) => {
    spawnError = error;
  });
  const url = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 120; attempt++) {
    if (spawnError) throw spawnError;
    assert.equal(child.exitCode, null, "Preview exited before ready");
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(1000) });
      await response.body?.cancel();
      if (response.ok)
        return {
          url,
          command: `PORT=${port} pnpm --filter ${packageName} preview`,
        };
    } catch {
      /* Bounded readiness retry for this owned preview process. */
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error("Preview readiness deadline exceeded");
}

function installProbe(mode) {
  const selector = 'script[type="application/json"][data-dh-store]';
  const nativeQuery = ShadowRoot.prototype.querySelector;
  const nativeRemove = Element.prototype.remove;
  const nativeAdd = EventTarget.prototype.addEventListener;
  const state = {
    mode,
    injected: 0,
    listenerRegistered: null,
    snapshotRemoved: null,
    ready: null,
    first: null,
  };
  window.__task252 = state;
  state.restore = () => {
    ShadowRoot.prototype.querySelector = nativeQuery;
    Element.prototype.remove = nativeRemove;
    EventTarget.prototype.addEventListener = nativeAdd;
    return (
      ShadowRoot.prototype.querySelector === nativeQuery &&
      Element.prototype.remove === nativeRemove &&
      EventTarget.prototype.addEventListener === nativeAdd
    );
  };
  ShadowRoot.prototype.querySelector = function (query) {
    const node = nativeQuery.call(this, query);
    if (query !== selector || this.host.localName !== "e2e-ssr-app")
      return node;
    const fixture = nativeQuery.call(
      this,
      "e2e-store-snapshot-roundtrip-fixture",
    );
    state.before = {
      fixture,
      shadow: fixture?.shadowRoot,
      count: fixture?.shadowRoot?.querySelector(
        '[data-testid="snapshot-count"]',
      ),
      button: fixture?.shadowRoot?.querySelector(
        '[data-testid="snapshot-increment"]',
      ),
    };
    if (mode === "normal" || state.injected) return node;
    state.injected++;
    if (mode === "missing") return null;
    if (node) node.textContent = mode === "shape" ? "[]" : "not-json";
    return node;
  };
  Element.prototype.remove = function () {
    const target = this.matches(selector);
    const value = nativeRemove.call(this);
    if (target) state.snapshotRemoved = performance.now();
    return value;
  };
  EventTarget.prototype.addEventListener = function (...args) {
    const value = nativeAdd.apply(this, args);
    if (
      args[0] !== "click" ||
      !(this instanceof HTMLButtonElement) ||
      this.dataset.testid !== "snapshot-increment" ||
      state.listenerRegistered !== null
    )
      return value;
    state.listenerRegistered = performance.now();
    if (mode !== "normal") return value;
    const button = this;
    queueMicrotask(() => {
      const shadow = button.getRootNode();
      const count = shadow.querySelector('[data-testid="snapshot-count"]');
      state.initial = {
        count: count.textContent,
        theme: shadow.querySelector('[data-testid="snapshot-theme"]')
          .textContent,
      };
      const start = performance.now();
      button.click();
      const end = performance.now();
      state.first = {
        before: state.initial.count,
        after: count.textContent,
        synchronousMs: end - start,
        nextFrameMs: null,
      };
      if (
        state.initial.count === "Count: 7" &&
        state.initial.theme === "Theme: snapshot-midnight" &&
        count.textContent === "Count: 8"
      )
        state.ready = performance.now();
      requestAnimationFrame(() => {
        state.first.nextFrameMs = performance.now() - start;
      });
    });
    return value;
  };
}

function snapshot() {
  const app = document.querySelector("e2e-ssr-app");
  const fixture = app?.shadowRoot?.querySelector(
    "e2e-store-snapshot-roundtrip-fixture",
  );
  const shadow = fixture?.shadowRoot;
  const count = shadow?.querySelector('[data-testid="snapshot-count"]');
  const button = shadow?.querySelector('[data-testid="snapshot-increment"]');
  const before = window.__task252?.before;
  return {
    appHosts: document.querySelectorAll("e2e-ssr-app").length,
    fixtureHosts: app?.shadowRoot?.querySelectorAll(
      "e2e-store-snapshot-roundtrip-fixture",
    ).length,
    count: count?.textContent,
    theme: shadow?.querySelector('[data-testid="snapshot-theme"]')?.textContent,
    scripts: app?.shadowRoot?.querySelectorAll("script[data-dh-store]").length,
    identityFromSnapshotRead: before
      ? {
          fixture: before.fixture === fixture,
          shadow: before.shadow === shadow,
          count: before.count === count,
          button: before.button === button,
        }
      : null,
  };
}

async function clickSample(button) {
  const count = button
    .getRootNode()
    .querySelector('[data-testid="snapshot-count"]');
  const before = count.textContent;
  const start = performance.now();
  button.click();
  const end = performance.now();
  const after = count.textContent;
  await new Promise(requestAnimationFrame);
  return {
    before,
    after,
    synchronousMs: end - start,
    nextFrameMs: performance.now() - start,
  };
}

async function disposal(button) {
  const shadow = button.getRootNode();
  const count = shadow.querySelector('[data-testid="snapshot-count"]');
  const before = count.textContent;
  shadow.host.remove();
  await Promise.resolve();
  await new Promise(requestAnimationFrame);
  const afterRemoval = count.textContent;
  button.click();
  return {
    before,
    afterRemoval,
    afterLateClick: count.textContent,
    connected: button.isConnected,
  };
}

async function pageRun(url, mode, action) {
  const context = await browser.newContext({
    viewport: result.environment.viewport,
    deviceScaleFactor: 1,
    serviceWorkers: "block",
  });
  try {
    const page = await context.newPage();
    page.setDefaultTimeout(10000);
    const errors = [];
    const requests = [];
    page.on("console", (message) => {
      if (message.type() === "error")
        errors.push({
          kind: "console",
          text: message.text(),
          url: message.location().url,
        });
    });
    page.on("pageerror", (error) =>
      errors.push({ kind: "pageerror", text: error.message }),
    );
    page.on("request", (request) =>
      requests.push({
        path: new URL(request.url()).pathname,
        type: request.resourceType(),
        method: request.method(),
      }),
    );
    const cdp = await context.newCDPSession(page);
    await cdp.send("Network.enable");
    await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
    if (mode) await page.addInitScript(installProbe, mode);
    const response = await page.goto(url, { waitUntil: "load" });
    assert.equal(response.status(), 200);
    const html = await response.body();
    const data = await action(page, errors);
    const timing = await page.evaluate(() => {
      const fields = (entry) =>
        Object.fromEntries(
          [
            "responseEnd",
            "duration",
            "encodedBodySize",
            "decodedBodySize",
            "transferSize",
            "nextHopProtocol",
          ].map((key) => [key, entry[key]]),
        );
      const nav = performance.getEntriesByType("navigation")[0];
      return {
        navigation: {
          ...fields(nav),
          domContentLoadedEventEnd: nav.domContentLoadedEventEnd,
          loadEventEnd: nav.loadEventEnd,
        },
        resources: performance.getEntriesByType("resource").map((entry) => ({
          path: new URL(entry.name).pathname,
          initiatorType: entry.initiatorType,
          ...fields(entry),
        })),
      };
    });
    return {
      url,
      html: {
        bytes: html.length,
        sha256: hash(html),
        scriptTags: [...html.toString().matchAll(/<script\b[^>]*>/g)].map(
          (match) => match[0],
        ),
        snapshot:
          html
            .toString()
            .match(
              /<script type="application\/json" data-dh-store>(.*?)<\/script>/,
            )?.[1] ?? null,
      },
      ...data,
      ...timing,
      requests,
      errors,
    };
  } finally {
    await context.close();
  }
}

try {
  result.previews = {
    e2e: await startPreview("@playground/e2e"),
    docs: await startPreview("@dathra/docs"),
  };
  browser = await chromium.launch({ headless: true });
  result.environment.browser = browser.version();
  result.environment.executable = chromium.executablePath();
  const route = `${result.previews.e2e.url}/store-snapshot-roundtrip`;
  for (let index = 0; index < 5; index++) {
    result.normal.push(
      await pageRun(route, "normal", async (page) => {
        await page.waitForFunction(
          () =>
            window.__task252.ready !== null &&
            window.__task252.first.nextFrameMs !== null,
        );
        const probe = await page.evaluate(() => {
          const s = window.__task252;
          return {
            initial: s.initial,
            ready: s.ready,
            listenerRegistered: s.listenerRegistered,
            snapshotRemoved: s.snapshotRemoved,
            first: s.first,
            restored: s.restore(),
          };
        });
        assert.equal(probe.restored, true);
        const active = await page.evaluate(snapshot);
        const button = page.getByTestId("snapshot-increment");
        const clicks = [probe.first];
        for (let click = 0; click < 4; click++)
          clicks.push(await button.evaluate(clickSample));
        assert.deepEqual(
          clicks.map((click) => click.after),
          [8, 9, 10, 11, 12].map((n) => `Count: ${n}`),
        );
        return {
          index: index + 1,
          probe,
          active,
          clicks,
          disposal: await button.evaluate(disposal),
        };
      }),
    );
  }
  for (const mode of ["missing", "shape", "malformed"]) {
    result.failures.push(
      await pageRun(route, mode, async (page, errors) => {
        await page.waitForFunction(() => window.__task252.injected === 1);
        if (mode === "malformed") {
          for (
            let i = 0;
            i < 100 &&
            !errors.some((e) => e.text.includes("Error in component hydrate"));
            i++
          )
            await page.waitForTimeout(100);
          assert(
            errors.some((e) => e.text.includes("Error in component hydrate")),
            "Expected observable hydrate diagnostic",
          );
        } else
          await page.waitForFunction(
            () => window.__task252.listenerRegistered !== null,
          );
        await page.waitForTimeout(100);
        const probe = await page.evaluate(() => ({
          injected: window.__task252.injected,
          restored: window.__task252.restore(),
        }));
        assert.equal(probe.restored, true);
        const active = await page.evaluate(snapshot);
        const button = page.getByTestId("snapshot-increment");
        return {
          mode,
          probe,
          active,
          click: await button.evaluate(clickSample),
          disposal: await button.evaluate(disposal),
        };
      }),
    );
  }
  // An uninstrumented trusted-click check separates functional behavior from probe timing.
  result.uninstrumented = await pageRun(route, null, async (page) => {
    await page.waitForLoadState("networkidle");
    const initial = await page.evaluate(snapshot);
    const counts = [];
    for (let i = 0; i < 5; i++) {
      await page.getByTestId("snapshot-increment").click();
      counts.push(await page.getByTestId("snapshot-count").textContent());
    }
    assert.deepEqual(
      counts,
      [8, 9, 10, 11, 12].map((n) => `Count: ${n}`),
    );
    return {
      initial,
      counts,
      disposal: await page.getByTestId("snapshot-increment").evaluate(disposal),
    };
  });
  result.home = await pageRun(result.previews.e2e.url, null, async (page) => {
    await page.waitForLoadState("networkidle");
    return {
      observation: await page.evaluate(() => ({
        title: document.title,
        appPresent: !!document.querySelector("e2e-ssr-app"),
        moduleScripts: document.querySelectorAll('script[type="module"][src]')
          .length,
      })),
    };
  });
  result.docs = await pageRun(
    `${result.previews.docs.url}/reactivity`,
    null,
    async (page) => {
      await page.waitForLoadState("networkidle");
      const buttons = page.locator("dathra-code button.copy-btn");
      const hosts = await page.locator("dathra-code").count();
      const highlighted = await page.locator("dathra-code pre.shiki").count();
      const count = await buttons.count();
      assert(count > 0, "Docs Copy selector missing");
      const labels = [];
      for (let i = 0; i < 5; i++) {
        await buttons.first().click();
        labels.push((await buttons.first().textContent()).trim());
      }
      await page.waitForTimeout(1900);
      return {
        hosts,
        highlighted,
        buttons: count,
        labels,
        after1900ms: (await buttons.first().textContent()).trim(),
      };
    },
  );
  const stats = (values) => {
    const sorted = [...values].sort((a, b) => a - b);
    const q = (p) => {
      const i = (sorted.length - 1) * p;
      return (
        sorted[Math.floor(i)] +
        (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i % 1)
      );
    };
    return {
      n: values.length,
      min: sorted[0],
      q1: q(0.25),
      median: q(0.5),
      q3: q(0.75),
      max: sorted.at(-1),
    };
  };
  result.distributionsMs = {
    load: stats(result.normal.map((s) => s.navigation.loadEventEnd)),
    responseEndToObservedReady: stats(
      result.normal.map((s) => s.probe.ready - s.navigation.responseEnd),
    ),
    responseEndToSnapshotRemovalProxy: stats(
      result.normal.map(
        (s) => s.probe.snapshotRemoved - s.navigation.responseEnd,
      ),
    ),
    postWarmupSynchronousClick: stats(
      result.normal.flatMap((s) =>
        s.clicks.slice(1).map((c) => c.synchronousMs),
      ),
    ),
    postWarmupNextFrame: stats(
      result.normal.flatMap((s) => s.clicks.slice(1).map((c) => c.nextFrameMs)),
    ),
  };
  result.finishedAt = new Date().toISOString();
  result.status = "complete";
  writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, {
    flag: "wx",
    mode: 0o600,
  });
  console.log(
    JSON.stringify(
      { output, distributionsMs: result.distributionsMs },
      null,
      2,
    ),
  );
} catch (error) {
  if (!existsSync(output)) {
    result.status = "failed";
    result.failure = { name: error.name, message: error.message };
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
  }
  throw error;
} finally {
  try {
    await browser?.close();
  } finally {
    for (const child of servers) {
      if (!child.pid) continue;
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") throw error;
      }
      if (child.exitCode === null && child.signalCode === null) {
        await new Promise((resolve) => {
          const timer = setTimeout(() => {
            try {
              process.kill(-child.pid, "SIGKILL");
            } catch (error) {
              if (error.code !== "ESRCH") console.error(error);
            }
            resolve();
          }, 5000);
          child.once("exit", () => {
            clearTimeout(timer);
            resolve();
          });
        });
      }
    }
  }
}
