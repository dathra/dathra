import assert from "node:assert/strict";
import { execFileSync, spawn } from "node:child_process";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { createServer } from "node:net";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// Supplement only: never import the original collector or rewrite production artifacts.
const [rootArg, outputArg] = process.argv.slice(2);
assert(
  rootArg && outputArg,
  "Usage: node profile.mjs CHECKOUT NEW_OUTPUT.json",
);
const root = path.resolve(rootArg);
const output = path.resolve(outputArg);
assert(!existsSync(output), "Refusing to overwrite an existing result");
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const local = (name) => new URL(name, import.meta.url);
const original = JSON.parse(readFileSync(local("cohort-a.json"), "utf8"));
const run = (bin, args) =>
  execFileSync(bin, args, { cwd: root, encoding: "utf8" });
assert.equal(run("git", ["rev-parse", "HEAD"]).trim(), original.source);
assert.equal(
  run("git", ["diff", "HEAD", "--", ".", ":(exclude)SPEC/proposals/245/252"]),
  "",
);
assert(
  run("git", ["ls-files", "--others", "--exclude-standard"])
    .trim()
    .split("\n")
    .filter(Boolean)
    .every((s) => s.startsWith("SPEC/proposals/245/252/")),
);
assert.equal(
  hash(readFileSync(path.join(root, "pnpm-lock.yaml"))),
  original.lockfileSha256,
);
const artifacts = original.artifacts.filter((a) =>
  a.path.startsWith("playgrounds/e2e/"),
);
for (const artifact of artifacts) {
  const bytes = readFileSync(path.join(root, artifact.path));
  assert.equal(bytes.length, artifact.bytes);
  assert.equal(
    hash(bytes),
    artifact.sha256,
    "Build the pinned production artifacts first",
  );
}
const require = createRequire(path.join(root, "playgrounds/e2e/package.json"));
const { chromium } = require("playwright");
const result = {
  schema: 1,
  source: original.source,
  root,
  startedAt: new Date().toISOString(),
  collectorSha256: hash(readFileSync(fileURLToPath(import.meta.url))),
  originalEvidence: Object.fromEntries(
    ["collect.mjs", "verify.mjs", "cohort-a.json", "cohort-b.json"].map(
      (name) => [name, hash(readFileSync(local(name)))],
    ),
  ),
  lockfileSha256: original.lockfileSha256,
  artifacts,
  environment: {
    node: process.version,
    pnpm: run("pnpm", ["--version"]).trim(),
    playwright: require("playwright/package.json").version,
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    cpu: os.cpus()[0]?.model,
    logicalCpus: os.cpus().length,
    viewport: { width: 1600, height: 1000 },
    deviceScaleFactor: 1,
    headless: true,
    cache:
      "new context per sample; CDP cache disabled; service workers blocked",
    throttling:
      "none; localhost; no host-load isolation; no navigation samples discarded",
  },
  procedure: {
    cpu: "Profiler at 1000us and Performance threadTicks enabled before goto(load). Stop after polling consumed snapshot and exact initial text; no click inside interval. Includes automation polling and profiler overhead. ScriptDuration is renderer script thread time, not bundle self-time. Profile sample counts are leaf stack observations, not CPU durations; no timeDeltas-to-CPU conversion or proportional allocation of thread time.",
    memory:
      "Separate contexts without profiler/coverage/prototype hooks/element handles. Activate, install WeakRefs to host/button and an unrooted sentinel, two GC requests, heap+DOM counters; five synthetic clicks; two GC requests; remove fixture or keep as sham control; rAF then two GC requests; repeat after 100ms. Each GC separated by a timer task. Only primitives returned by Runtime.evaluate(returnByValue); no detached click or strong reference escapes evaluation.",
    coverage:
      "Separate context, precise callCount+detailed coverage before navigation; same initial poll, capture/reset initial counts; five synthetic clicks, capture/reset update counts. Never mixed into CPU or memory runs. Bounded source-range observations on exact bundle hashes, not architectural conformance.",
  },
  cpu: [],
  memory: [],
  coverage: null,
};
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const fixtureExpression =
  'document.querySelector("e2e-ssr-app")?.shadowRoot?.querySelector("e2e-store-snapshot-roundtrip-fixture")';
const inspectExpression = `(() => {
  const fixture = ${fixtureExpression};
  const shadow = fixture?.shadowRoot;
  return { count: shadow?.querySelector('[data-testid="snapshot-count"]')?.textContent,
    theme: shadow?.querySelector('[data-testid="snapshot-theme"]')?.textContent,
    consumed: !!fixture && !fixture.getRootNode().querySelector('script[data-dh-store]') };
})()`;
const clickExpression = `(() => {
  const shadow = (${fixtureExpression}).shadowRoot;
  shadow.querySelector('[data-testid="snapshot-increment"]').click();
  return shadow.querySelector('[data-testid="snapshot-count"]').textContent;
})()`;
async function evaluate(cdp, expression) {
  const response = await cdp.send("Runtime.evaluate", {
    expression,
    returnByValue: true,
    awaitPromise: true,
  });
  assert(!response.exceptionDetails, JSON.stringify(response.exceptionDetails));
  assert(!response.result.objectId, "No remote object handles may escape");
  return response.result.value;
}
async function initial(cdp) {
  for (let i = 0; i < 500; i++) {
    const state = await evaluate(cdp, inspectExpression);
    if (
      state.consumed &&
      state.count === "Count: 7" &&
      state.theme === "Theme: snapshot-midnight"
    )
      return state;
    await delay(20);
  }
  throw new Error("Initial activation observation deadline exceeded");
}
async function clicks(cdp) {
  const counts = [];
  for (let i = 0; i < 5; i++) {
    counts.push(await evaluate(cdp, clickExpression));
    await evaluate(
      cdp,
      "new Promise(resolve => requestAnimationFrame(() => resolve(true)))",
    );
  }
  assert.deepEqual(
    counts,
    [8, 9, 10, 11, 12].map((n) => `Count: ${n}`),
  );
  return counts;
}
async function heap(cdp) {
  for (let i = 0; i < 2; i++) {
    await evaluate(
      cdp,
      "new Promise(resolve => setTimeout(() => resolve(true), 0))",
    );
    await cdp.send("HeapProfiler.collectGarbage");
  }
  return {
    heap: await cdp.send("Runtime.getHeapUsage"),
    dom: await cdp.send("Memory.getDOMCounters"),
    weak: await evaluate(
      cdp,
      "Object.fromEntries(Object.entries(window.__task252Weak).map(([key, ref]) => [key, ref.deref() !== undefined]))",
    ),
  };
}
const metricNames = [
  "ScriptDuration",
  "V8CompileDuration",
  "TaskDuration",
  "ThreadTime",
  "DevToolsCommandDuration",
];
async function metrics(cdp) {
  const { metrics: values } = await cdp.send("Performance.getMetrics");
  const selected = Object.fromEntries(
    metricNames.map((name) => [
      name,
      values.find((m) => m.name === name)?.value,
    ]),
  );
  assert(Object.values(selected).every(Number.isFinite));
  return selected;
}
function attribution(profile, origin) {
  const ids = new Map(profile.nodes.map((node) => [node.id, node]));
  const counts = {};
  for (const id of profile.samples) {
    const frame = ids.get(id).callFrame;
    const bundle = artifacts.find(
      (a) =>
        frame.url ===
        `${origin}${a.path.replace("playgrounds/e2e/dist/client", "")}`,
    );
    const category = bundle
      ? bundle.path
      : ["(idle)", "(program)", "(garbage collector)"].includes(
            frame.functionName,
          )
        ? frame.functionName
        : "unattributed-or-instrumentation";
    counts[category] = (counts[category] ?? 0) + 1;
  }
  return counts;
}
// The narrowest containing function identifies a marker, not an entire execution model.
function selectCoverage(entries) {
  const markers = {
    fixtureSetup: '"snapshot-midnight"',
    fixtureHydrate: "-snapshot-client",
    fixtureRender: "textContent=`Theme: ",
    runtimeSetup: '"[dathra] Error in component setup:"',
    runtimePreserve: "Unsupported hydration for <",
    runtimeFallback: "Falling back to setup rerender for <",
  };
  return Object.fromEntries(
    Object.entries(markers).map(([name, marker]) => {
      const found = [];
      for (const entry of entries) {
        const artifact = artifacts.find((a) =>
          entry.url.endsWith(a.path.replace("playgrounds/e2e/dist/client", "")),
        );
        if (!artifact) continue;
        const source = readFileSync(path.join(root, artifact.path), "utf8");
        let offset = source.indexOf(marker);
        while (offset !== -1) {
          const fn = entry.functions
            .filter(
              (f) =>
                f.ranges[0].startOffset <= offset &&
                f.ranges[0].endOffset > offset,
            )
            .sort(
              (a, b) =>
                a.ranges[0].endOffset -
                a.ranges[0].startOffset -
                (b.ranges[0].endOffset - b.ranges[0].startOffset),
            )[0];
          if (fn)
            found.push({
              path: artifact.path,
              markerOffset: offset,
              functionName: fn.functionName,
              ranges: fn.ranges,
              source: source.slice(
                fn.ranges[0].startOffset,
                fn.ranges[0].endOffset,
              ),
            });
          offset = source.indexOf(marker, offset + marker.length);
        }
      }
      return [name, { marker, matches: found }];
    }),
  );
}
let child;
let browser;
function recordCleanupError(error) {
  result.status = "failed";
  (result.cleanupErrors ??= []).push({
    name: error.name,
    message: error.message,
  });
  process.exitCode = 1;
  console.error(error);
}
try {
  const probe = createServer();
  await new Promise((resolve) => probe.listen(0, "127.0.0.1", resolve));
  const port = probe.address().port;
  await new Promise((resolve) => probe.close(resolve));
  child = spawn("pnpm", ["--filter", "@playground/e2e", "preview"], {
    cwd: root,
    env: { ...process.env, PORT: String(port) },
    detached: true,
    stdio: "ignore",
  });
  let spawnError;
  child.on("error", (error) => {
    spawnError = error;
  });
  const origin = `http://127.0.0.1:${port}`;
  result.preview = {
    origin,
    command: `PORT=${port} pnpm --filter @playground/e2e preview`,
  };
  let ready = false;
  for (let i = 0; i < 120; i++) {
    if (spawnError) throw spawnError;
    assert.equal(child.exitCode, null);
    try {
      const response = await fetch(origin, {
        signal: AbortSignal.timeout(1000),
      });
      await response.body?.cancel();
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Retry only while the owned server starts. */
    }
    await delay(250);
  }
  assert(ready, "Preview startup deadline exceeded");
  browser = await chromium.launch({ headless: true });
  result.environment.browser = browser.version();
  result.environment.executable = chromium.executablePath();
  async function sample(kind, action) {
    const context = await browser.newContext({
      viewport: result.environment.viewport,
      deviceScaleFactor: 1,
      serviceWorkers: "block",
    });
    try {
      const page = await context.newPage();
      const errors = [];
      const scriptResponses = [];
      page.on("pageerror", (error) => errors.push(error.message));
      page.on("response", (response) => {
        if (response.request().resourceType() === "script")
          scriptResponses.push(response);
      });
      const cdp = await context.newCDPSession(page);
      await cdp.send("Network.enable");
      await cdp.send("Network.setCacheDisabled", { cacheDisabled: true });
      const navigate = async () => {
        const response = await page.goto(`${origin}/store-snapshot-roundtrip`, {
          waitUntil: "load",
          timeout: 10000,
        });
        assert.equal(response.status(), 200);
        assert.equal(
          hash(await response.body()),
          original.normal[0].html.sha256,
        );
        return initial(cdp);
      };
      const data = await action(cdp, navigate);
      assert.deepEqual(errors, []);
      const servedScripts = [];
      for (const response of scriptResponses) {
        const artifact = artifacts.find(
          (a) =>
            response.url() ===
            `${origin}${a.path.replace("playgrounds/e2e/dist/client", "")}`,
        );
        assert(artifact, "Unexpected script response");
        assert.equal(response.status(), 200);
        assert.equal(hash(await response.body()), artifact.sha256);
        servedScripts.push(artifact.path);
      }
      assert.deepEqual(
        servedScripts.toSorted(),
        artifacts
          .filter((a) => a.path.includes("/client/assets/"))
          .map((a) => a.path)
          .toSorted(),
      );
      return { kind, ...data, servedScripts, errors };
    } finally {
      await context.close();
    }
  }
  for (let i = 0; i < 5; i++) {
    result.cpu.push(
      await sample("initial-cpu", async (cdp, navigate) => {
        await cdp.send("Performance.enable", { timeDomain: "threadTicks" });
        await cdp.send("Profiler.enable");
        await cdp.send("Profiler.setSamplingInterval", { interval: 1000 });
        const before = await metrics(cdp);
        await cdp.send("Profiler.start");
        const state = await navigate();
        const { profile } = await cdp.send("Profiler.stop");
        const after = await metrics(cdp);
        const threadMs = Object.fromEntries(
          metricNames.map((name) => [
            name,
            (after[name] - before[name]) * 1000,
          ]),
        );
        assert(Object.values(threadMs).every((v) => v >= 0));
        return {
          index: i + 1,
          initial: state,
          before,
          after,
          threadMs,
          leafSamples: attribution(profile, origin),
          profile,
          postProfileClicks: await clicks(cdp),
        };
      }),
    );
    // Alternate control order; controls are not zero-client-root routes.
    for (const mode of i % 2 ? ["keep", "remove"] : ["remove", "keep"]) {
      result.memory.push(
        await sample(mode, async (cdp, navigate) => {
          const state = await navigate();
          await evaluate(
            cdp,
            `(() => {
          const host = ${fixtureExpression};
          window.__task252Weak = { host: new WeakRef(host), button: new WeakRef(host.shadowRoot.querySelector('[data-testid="snapshot-increment"]')), sentinel: new WeakRef({}) };
          return true;
        })()`,
          );
          const active = await heap(cdp);
          const counts = await clicks(cdp);
          const updated = await heap(cdp);
          await evaluate(
            cdp,
            `(() => { const host = ${fixtureExpression}; ${mode === "remove" ? "host.remove();" : "void host.isConnected;"} return true; })()`,
          );
          await evaluate(
            cdp,
            "new Promise(resolve => requestAnimationFrame(() => resolve(true)))",
          );
          const after = await heap(cdp);
          await delay(100);
          const settled = await heap(cdp);
          return {
            index: i + 1,
            initial: state,
            active,
            counts,
            updated,
            after,
            settled,
          };
        }),
      );
    }
  }
  result.coverage = await sample("precise-coverage", async (cdp, navigate) => {
    await cdp.send("Profiler.enable");
    const start = await cdp.send("Profiler.startPreciseCoverage", {
      callCount: true,
      detailed: true,
      allowTriggeredUpdates: false,
    });
    const state = await navigate();
    const initialCoverage = await cdp.send("Profiler.takePreciseCoverage");
    const counts = await clicks(cdp);
    const updateCoverage = await cdp.send("Profiler.takePreciseCoverage");
    await cdp.send("Profiler.stopPreciseCoverage");
    const keep = (entry) =>
      artifacts.some(
        (a) =>
          entry.url ===
          `${origin}${a.path.replace("playgrounds/e2e/dist/client", "")}`,
      );
    return {
      start,
      initial: state,
      counts,
      initialTimestamp: initialCoverage.timestamp,
      updateTimestamp: updateCoverage.timestamp,
      initialRaw: initialCoverage.result.filter(keep),
      updateRaw: updateCoverage.result.filter(keep),
      selectedInitial: selectCoverage(initialCoverage.result.filter(keep)),
      selectedUpdate: selectCoverage(updateCoverage.result.filter(keep)),
    };
  });
  result.status = "complete";
} catch (error) {
  result.status = "failed";
  result.failure = { name: error.name, message: error.message };
  throw error;
} finally {
  try {
    await browser?.close();
  } catch (error) {
    recordCleanupError(error);
  } finally {
    if (child?.pid) {
      try {
        process.kill(-child.pid, "SIGTERM");
      } catch (error) {
        if (error.code !== "ESRCH") recordCleanupError(error);
      }
      for (
        let i = 0;
        i < 50 && child.exitCode === null && child.signalCode === null;
        i++
      )
        await delay(100);
      if (child.exitCode === null && child.signalCode === null) {
        try {
          process.kill(-child.pid, "SIGKILL");
        } catch (error) {
          if (error.code !== "ESRCH") recordCleanupError(error);
        }
      }
    }
    result.finishedAt = new Date().toISOString();
    // Raw CDP payloads stay reproducible without a large heap dump.
    writeFileSync(output, `${JSON.stringify(result, null, 2)}\n`, {
      flag: "wx",
      mode: 0o600,
    });
    console.log(
      JSON.stringify(
        {
          output,
          status: result.status,
          cpu: result.cpu.map((s) => s.threadMs),
          memory: result.memory.map((s) => ({
            index: s.index,
            kind: s.kind,
            active: s.active.heap.usedSize,
            settled: s.settled.heap.usedSize,
            weak: s.settled.weak,
          })),
        },
        null,
        2,
      ),
    );
  }
}
