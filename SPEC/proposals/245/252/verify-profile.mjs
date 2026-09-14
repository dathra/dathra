import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [rootArg, ...files] = process.argv.slice(2);
assert(
  rootArg && files.length,
  "Usage: node verify-profile.mjs CHECKOUT RESULT.json [RESULT.json ...]",
);
const local = (name) => new URL(name, import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const collector = fileURLToPath(local("profile.mjs"));
const sourceHash = hash(readFileSync(collector));
const stats = (values) => {
  assert(values.length && values.every(Number.isFinite));
  const sorted = values.toSorted((a, b) => a - b);
  const quantile = (p) => {
    const i = (sorted.length - 1) * p;
    return (
      sorted[Math.floor(i)] +
      (sorted[Math.ceil(i)] - sorted[Math.floor(i)]) * (i % 1)
    );
  };
  return {
    n: sorted.length,
    min: sorted[0],
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: sorted.at(-1),
  };
};
assert.deepEqual(stats([4, 1, 3, 2]), {
  n: 4,
  min: 1,
  q1: 1.75,
  median: 2.5,
  q3: 3.25,
  max: 4,
});
const expectedCounts = [8, 9, 10, 11, 12].map((n) => `Count: ${n}`);
const expectedInitial = {
  count: "Count: 7",
  theme: "Theme: snapshot-midnight",
  consumed: true,
};
function verifySelections(entries, selected, sources, origin) {
  const markers = {
    fixtureSetup: '"snapshot-midnight"',
    fixtureHydrate: "-snapshot-client",
    fixtureRender: "textContent=`Theme: ",
    runtimeSetup: '"[dathra] Error in component setup:"',
    runtimePreserve: "Unsupported hydration for <",
    runtimeFallback: "Falling back to setup rerender for <",
  };
  const rebuilt = {};
  for (const [name, marker] of Object.entries(markers)) {
    const matches = [];
    for (const entry of entries) {
      const sourceEntry = [...sources].find(
        ([file]) =>
          entry.url ===
          `${origin}${file.replace("playgrounds/e2e/dist/client", "")}`,
      );
      assert(sourceEntry);
      const [file, source] = sourceEntry;
      // Enumerate source occurrences independently of the saved selection.
      for (
        let offset = source.indexOf(marker);
        offset !== -1;
        offset = source.indexOf(marker, offset + marker.length)
      ) {
        const candidates = entry.functions.filter(
          (fn) =>
            fn.ranges[0].startOffset <= offset &&
            offset < fn.ranges[0].endOffset,
        );
        candidates.sort(
          (a, b) =>
            a.ranges[0].endOffset -
            a.ranges[0].startOffset -
            (b.ranges[0].endOffset - b.ranges[0].startOffset),
        );
        const fn = candidates[0];
        if (!fn) continue;
        matches.push({
          path: file,
          markerOffset: offset,
          functionName: fn.functionName,
          ranges: fn.ranges,
          source: source.slice(
            fn.ranges[0].startOffset,
            fn.ranges[0].endOffset,
          ),
        });
      }
    }
    rebuilt[name] = { marker, matches };
  }
  assert.deepEqual(
    selected,
    rebuilt,
    "Complete coverage selections must match raw coverage and verified sources",
  );
}
const reports = [];
let previous;
for (const file of files) {
  const result = JSON.parse(readFileSync(file, "utf8"));
  assert.equal(result.status, "complete");
  assert.equal(result.source, "c1a30ed86fd2bd79e1c742362f552e9f62ff9f98");
  assert.equal(result.collectorSha256, sourceHash);
  assert.equal(result.artifacts.length, 4);
  assert.deepEqual(
    Object.keys(result.originalEvidence).toSorted(),
    ["collect.mjs", "verify.mjs", "cohort-a.json", "cohort-b.json"].toSorted(),
  );
  assert.equal(
    hash(readFileSync(path.join(rootArg, "pnpm-lock.yaml"))),
    result.lockfileSha256,
  );
  if (previous) {
    assert.deepEqual(result.environment, previous.environment);
    assert.deepEqual(result.artifacts, previous.artifacts);
    assert.deepEqual(result.originalEvidence, previous.originalEvidence);
  }
  previous = result;
  for (const [name, digest] of Object.entries(result.originalEvidence)) {
    // profile.mjs only hashed this verifier as metadata; it never executed it.
    // Preserve the historical record without claiming it hashes today's verifier.
    if (name === "verify.mjs") {
      assert(
        [
          "13926a02038cebc203f950edd2e5807642d5d3efc7611e9f0fbaead52a7d370b",
          hash(readFileSync(local(name))),
        ].includes(digest),
        "Expected the historical verifier metadata or the current verifier on a new collection",
      );
      continue;
    }
    assert.equal(
      hash(readFileSync(local(name))),
      digest,
      `Original evidence changed: ${name}`,
    );
  }
  const sources = new Map();
  for (const artifact of result.artifacts) {
    const bytes = readFileSync(path.join(rootArg, artifact.path));
    assert.equal(hash(bytes), artifact.sha256);
    assert.equal(bytes.length, artifact.bytes);
    sources.set(artifact.path, bytes.toString());
  }
  assert.equal(result.cpu.length, 5);
  for (const sample of [...result.cpu, ...result.memory, result.coverage]) {
    assert.deepEqual(
      sample.servedScripts.toSorted(),
      result.artifacts
        .filter((a) => a.path.includes("/client/assets/"))
        .map((a) => a.path)
        .toSorted(),
    );
    assert.deepEqual(sample.initial, expectedInitial);
    assert.deepEqual(sample.errors, []);
  }
  for (const sample of result.cpu) {
    assert.deepEqual(sample.initial, expectedInitial);
    assert.deepEqual(sample.errors, []);
    assert.deepEqual(sample.postProfileClicks, expectedCounts);
    for (const [metric, ms] of Object.entries(sample.threadMs)) {
      assert.equal(ms, (sample.after[metric] - sample.before[metric]) * 1000);
      assert(Number.isFinite(ms) && ms >= 0);
    }
    const profile = sample.profile;
    assert(profile.endTime > profile.startTime);
    assert.equal(profile.samples.length, profile.timeDeltas.length);
    assert(profile.samples.length > 0);
    const ids = new Map(profile.nodes.map((node) => [node.id, node]));
    assert.equal(ids.size, profile.nodes.length);
    const counts = {};
    for (const id of profile.samples) {
      assert(ids.has(id));
      const frame = ids.get(id).callFrame;
      const bundle = result.artifacts.find(
        (a) =>
          frame.url ===
          `${result.preview.origin}${a.path.replace("playgrounds/e2e/dist/client", "")}`,
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
    assert.deepEqual(sample.leafSamples, counts);
    for (const node of profile.nodes) {
      for (const child of node.children ?? []) assert(ids.has(child));
      if (/^https?:/.test(node.callFrame.url))
        assert(node.callFrame.url.startsWith(`${result.preview.origin}/`));
    }
    // V8 can report a negative delta around a sample reorder; do not invent durations.
    assert(profile.timeDeltas.every(Number.isFinite));
  }
  assert.equal(result.memory.length, 10);
  for (let i = 0; i < 5; i++)
    assert.deepEqual(
      result.memory.slice(i * 2, i * 2 + 2).map((s) => s.kind),
      i % 2 ? ["keep", "remove"] : ["remove", "keep"],
    );
  for (const sample of result.memory) {
    assert.deepEqual(sample.initial, expectedInitial);
    assert.deepEqual(sample.errors, []);
    assert.deepEqual(sample.counts, expectedCounts);
    for (const phase of ["active", "updated", "after", "settled"]) {
      const checkpoint = sample[phase];
      assert(
        Object.values(checkpoint.heap).every(
          (n) => Number.isFinite(n) && n >= 0,
        ),
      );
      assert(checkpoint.heap.totalSize >= checkpoint.heap.usedSize);
      assert(
        Object.values(checkpoint.dom).every(
          (n) => Number.isInteger(n) && n >= 0,
        ),
      );
      assert.equal(checkpoint.weak.sentinel, false, "GC sentinel still alive");
      const retained =
        sample.kind === "keep" || ["active", "updated"].includes(phase);
      assert.equal(checkpoint.weak.host, retained);
      assert.equal(checkpoint.weak.button, retained);
    }
  }
  const coverage = result.coverage;
  assert.deepEqual(coverage.initial, expectedInitial);
  assert.deepEqual(coverage.counts, expectedCounts);
  assert(
    coverage.start.timestamp < coverage.initialTimestamp &&
      coverage.initialTimestamp < coverage.updateTimestamp,
  );
  // Exact baseline ranges, not a general definition of prohibited execution.
  const expectedRanges = {
    fixtureSetup: [
      [30550, 30716, 0],
      [30773, 30994, 0],
    ],
    fixtureHydrate: [[31018, 31812, 1]],
    fixtureRender: [[31590, 31693, 1]],
    runtimeSetup: [[50027, 50289, 0]],
    runtimePreserve: [[50293, 50671, 0]],
    runtimeFallback: [[50675, 50917, 0]],
  };
  for (const [name, expected] of Object.entries(expectedRanges))
    assert.deepEqual(
      coverage.selectedInitial[name].matches.map((m) => [
        m.ranges[0].startOffset,
        m.ranges[0].endOffset,
        m.ranges[0].count,
      ]),
      expected,
    );
  assert.equal(
    coverage.selectedUpdate.fixtureRender.matches[0].ranges[0].count,
    5,
  );
  const coverageReport = {};
  for (const [phase, entries, selected] of [
    ["initial", coverage.initialRaw, coverage.selectedInitial],
    ["update", coverage.updateRaw, coverage.selectedUpdate],
  ]) {
    assert.equal(entries.length, 2);
    assert.deepEqual(
      entries.map((e) => e.url).toSorted(),
      result.artifacts
        .filter((a) => a.path.includes("/client/assets/"))
        .map(
          (a) =>
            `${result.preview.origin}${a.path.replace("playgrounds/e2e/dist/client", "")}`,
        )
        .toSorted(),
    );
    coverageReport[phase] = {};
    for (const entry of entries) {
      const artifact = result.artifacts.find(
        (a) =>
          entry.url ===
          `${result.preview.origin}${a.path.replace("playgrounds/e2e/dist/client", "")}`,
      );
      assert(artifact);
      for (const fn of entry.functions)
        for (const range of fn.ranges) {
          assert(Number.isInteger(range.count) && range.count >= 0);
          assert(
            range.startOffset >= 0 &&
              range.endOffset <= sources.get(artifact.path).length &&
              range.endOffset > range.startOffset,
          );
        }
    }
    verifySelections(entries, selected, sources, result.preview.origin);
    for (const [name, selection] of Object.entries(selected)) {
      coverageReport[phase][name] = selection.matches.map((match) => {
        const range = match.ranges[0];
        return {
          functionName: match.functionName,
          range,
          source:
            match.source.length < 1200
              ? match.source
              : `Larger enclosing function (${match.source.length} UTF-16 units): not a uniquely resolved target`,
        };
      });
    }
  }
  // A newly executed raw fallback cannot hide behind a saved empty selection.
  const injected = structuredClone(coverage.updateRaw);
  const initialMain = coverage.initialRaw.find((entry) =>
    entry.url.includes("/assets/main-"),
  );
  const fallback = structuredClone(
    initialMain.functions.find(
      (fn) =>
        fn.ranges[0].startOffset === 50675 && fn.ranges[0].endOffset === 50917,
    ),
  );
  fallback.ranges[0].count = 1;
  injected
    .find((entry) => entry.url === initialMain.url)
    .functions.push(fallback);
  assert.throws(
    () =>
      verifySelections(
        injected,
        coverage.selectedUpdate,
        sources,
        result.preview.origin,
      ),
    { code: "ERR_ASSERTION" },
  );
  const omitted = structuredClone(coverage.selectedInitial);
  omitted.fixtureSetup.matches.pop();
  assert.throws(
    () =>
      verifySelections(
        coverage.initialRaw,
        omitted,
        sources,
        result.preview.origin,
      ),
    { code: "ERR_ASSERTION" },
  );
  const memoryReport = {};
  for (const mode of ["remove", "keep"]) {
    const samples = result.memory.filter((s) => s.kind === mode);
    memoryReport[mode] = {
      activeUsedBytes: stats(samples.map((s) => s.active.heap.usedSize)),
      updatedUsedBytes: stats(samples.map((s) => s.updated.heap.usedSize)),
      settledUsedBytes: stats(samples.map((s) => s.settled.heap.usedSize)),
      settledMinusUpdatedBytes: stats(
        samples.map((s) => s.settled.heap.usedSize - s.updated.heap.usedSize),
      ),
      dom: samples.map((s) => ({
        active: s.active.dom,
        updated: s.updated.dom,
        settled: s.settled.dom,
      })),
    };
  }
  reports.push({
    file,
    bytes: readFileSync(file).length,
    startedAt: result.startedAt,
    collectorSha256: result.collectorSha256,
    cpuThreadMs: stats(result.cpu.map((s) => s.threadMs.ScriptDuration)),
    leafSamples: result.cpu.map((s) => s.leafSamples),
    memory: memoryReport,
    coverage: coverageReport,
  });
}
for (const file of [collector, fileURLToPath(import.meta.url), ...files]) {
  const check = spawnSync(
    "git",
    ["diff", "--no-index", "--check", "/dev/null", file],
    { encoding: "utf8" },
  );
  assert([0, 1].includes(check.status));
  assert.equal(check.stdout + check.stderr, "", `Whitespace: ${file}`);
}
for (const args of [[], [rootArg, files[0]]]) {
  const guard = spawnSync(process.execPath, [collector, ...args], {
    encoding: "utf8",
  });
  assert.notEqual(guard.status, 0);
  assert.match(guard.stderr, /Usage:|Refusing to overwrite/);
}
console.log(JSON.stringify(reports, null, 2));
console.log(
  "PASS: supplement provenance, CPU accounting, raw coverage ranges, GC controls, behavior, CLI guards. Observation checks only; no product thresholds.",
);
