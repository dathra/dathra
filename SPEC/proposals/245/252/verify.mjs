import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

// Validate saved observations, not conformance to an unapproved product contract.
const local = (name) => new URL(name, import.meta.url);
const cohorts = ["cohort-a.json", "cohort-b.json"].map((name) =>
  JSON.parse(readFileSync(local(name), "utf8")),
);
// Reverse only the relocation edits to verify the original measured collector.
const historicalCollector = readFileSync(local("collect.mjs"), "utf8")
  .replace("Usage: node collect.mjs", "Usage: node 252-collect.mjs")
  .replace(
    '  run("git", ["diff", "HEAD", "--", ".", ":(exclude)SPEC/proposals/245/252"]),',
    `  run("git", [
    "diff",
    "HEAD",
    "--",
    ".",
    ":(exclude)SPEC/proposals/245-server-authoritative-execution",
  ]),`,
  )
  .replace(
    '  untracked.every((name) => name.startsWith("SPEC/proposals/245/252/")),',
    `  untracked.every((name) =>
    name.startsWith("SPEC/proposals/245-server-authoritative-execution/"),
  ),`,
  );
const digest = createHash("sha256").update(historicalCollector).digest("hex");
const statistics = (values) => {
  assert(values.every(Number.isFinite));
  const ordered = values.toSorted((a, b) => a - b);
  const quantile = (fraction) => {
    const position = fraction * (ordered.length - 1);
    const low = Math.floor(position);
    const high = Math.ceil(position);
    return ordered[low] + (ordered[high] - ordered[low]) * (position - low);
  };
  return {
    n: values.length,
    min: ordered[0],
    q1: quantile(0.25),
    median: quantile(0.5),
    q3: quantile(0.75),
    max: ordered.at(-1),
  };
};
assert.deepEqual(statistics([4, 1, 2, 3]), {
  n: 4,
  min: 1,
  q1: 1.75,
  median: 2.5,
  q3: 3.25,
  max: 4,
});
function verifyUninstrumented(sample) {
  assert.equal(sample.initial.count, "Count: 7");
  assert.equal(sample.initial.theme, "Theme: snapshot-midnight");
  assert.deepEqual(
    sample.counts,
    [8, 9, 10, 11, 12].map((n) => `Count: ${n}`),
  );
  assert.equal(sample.disposal.connected, false);
  assert.equal(sample.disposal.before, "Count: 12");
  assert.equal(sample.disposal.afterRemoval, "Count: 12");
  assert.equal(sample.disposal.afterLateClick, "Count: 13");
}
for (const cohort of cohorts) {
  assert.equal(cohort.status, "complete");
  assert.equal(cohort.source, "c1a30ed86fd2bd79e1c742362f552e9f62ff9f98");
  assert.equal(cohort.collectorSha256, digest);
  assert.equal(cohort.normal.length, 5);
  assert.equal(cohort.artifacts.length, 8);
  assert.equal(cohort.verification.length, 4);
  assert(cohort.verification.every((step) => step.exitCode === 0));
  for (const sample of cohort.normal) {
    assert.equal(sample.html.bytes, 2573);
    assert.equal(
      sample.html.sha256,
      "0268538f09fbb83ce734a997a2c2907eb43fa5adfb39e0236b8fb349fe8ce9f8",
    );
    assert.equal(
      sample.html.snapshot,
      '[{"count":1,"theme":2},7,"snapshot-midnight"]',
    );
    assert.equal(sample.probe.initial.count, "Count: 7");
    assert.equal(sample.probe.initial.theme, "Theme: snapshot-midnight");
    assert.equal(sample.probe.restored, true);
    assert.equal(sample.active.appHosts, 1);
    assert.equal(sample.active.fixtureHosts, 1);
    assert.equal(sample.active.scripts, 0);
    assert(
      Object.values(sample.active.identityFromSnapshotRead).every(
        (value) => value === true,
      ),
    );
    assert(sample.probe.ready >= sample.probe.listenerRegistered);
    assert(sample.probe.listenerRegistered >= sample.probe.snapshotRemoved);
    assert(sample.probe.snapshotRemoved >= sample.navigation.responseEnd);
    assert.deepEqual(
      sample.clicks.map((click) => click.after),
      [8, 9, 10, 11, 12].map((n) => `Count: ${n}`),
    );
    assert.equal(sample.disposal.connected, false);
    assert.equal(sample.disposal.afterRemoval, "Count: 12");
    assert.equal(sample.disposal.afterLateClick, "Count: 13");
    assert(
      sample.clicks.every(
        (click) =>
          click.synchronousMs >= 0 && click.nextFrameMs >= click.synchronousMs,
      ),
    );
    assert.equal(sample.navigation.encodedBodySize, sample.html.bytes);
    assert.equal(sample.navigation.transferSize, 2873);
    const scripts = sample.resources.filter((resource) =>
      resource.path.endsWith(".js"),
    );
    assert.equal(scripts.length, 2);
    for (const resource of scripts) {
      const artifact = cohort.artifacts.find(
        (entry) => entry.path === `playgrounds/e2e/dist/client${resource.path}`,
      );
      assert.equal(resource.decodedBodySize, artifact.bytes);
      assert.equal(resource.encodedBodySize, artifact.bytes);
      assert.equal(resource.transferSize, artifact.bytes + 300);
    }
    assert(
      !sample.requests.some((request) =>
        ["fetch", "xhr"].includes(request.type),
      ),
    );
    assert(sample.errors.every((error) => error.url?.endsWith("/favicon.ico")));
  }
  assert.deepEqual(cohort.distributionsMs, {
    load: statistics(
      cohort.normal.map((sample) => sample.navigation.loadEventEnd),
    ),
    responseEndToObservedReady: statistics(
      cohort.normal.map(
        (sample) => sample.probe.ready - sample.navigation.responseEnd,
      ),
    ),
    responseEndToSnapshotRemovalProxy: statistics(
      cohort.normal.map(
        (sample) =>
          sample.probe.snapshotRemoved - sample.navigation.responseEnd,
      ),
    ),
    postWarmupSynchronousClick: statistics(
      cohort.normal.flatMap((sample) =>
        sample.clicks.slice(1).map((click) => click.synchronousMs),
      ),
    ),
    postWarmupNextFrame: statistics(
      cohort.normal.flatMap((sample) =>
        sample.clicks.slice(1).map((click) => click.nextFrameMs),
      ),
    ),
  });
  assert.deepEqual(
    cohort.failures.map((failure) => failure.mode),
    ["missing", "shape", "malformed"],
  );
  for (const failure of cohort.failures) {
    assert.deepEqual(failure.probe, { injected: 1, restored: true });
    const malformed = failure.mode === "malformed";
    assert.equal(failure.active.count, malformed ? "Count:7" : "Count: 0");
    assert.equal(
      failure.active.theme,
      malformed ? "Theme:snapshot-midnight" : "Theme: client-default",
    );
    assert.equal(failure.active.scripts, failure.mode === "shape" ? 0 : 1);
    assert.equal(failure.click.after, malformed ? "Count:7" : "Count: 1");
    assert.equal(
      failure.disposal.afterLateClick,
      malformed ? "Count:7" : "Count: 2",
    );
    assert.equal(
      failure.errors.some((error) =>
        error.text.includes("Error in component hydrate"),
      ),
      malformed,
    );
  }
  verifyUninstrumented(cohort.uninstrumented);
  // Contradictory controls must fail even when all five click counts agree.
  for (const [section, field, value] of [
    ["initial", "count", "Count: 0"],
    ["initial", "theme", "Theme: client-default"],
    ["disposal", "connected", true],
    ["disposal", "before", "Count: 7"],
    ["disposal", "afterRemoval", "Count: 7"],
    ["disposal", "afterLateClick", "Count: 12"],
  ]) {
    const contradictory = structuredClone(cohort.uninstrumented);
    contradictory[section][field] = value;
    assert.throws(() => verifyUninstrumented(contradictory), {
      code: "ERR_ASSERTION",
    });
  }
  assert.equal(cohort.home.observation.moduleScripts, 1);
  assert.equal(
    cohort.home.resources.filter((resource) => resource.path.endsWith(".js"))
      .length,
    2,
  );
  assert.equal(cohort.docs.hosts, 5);
  assert.equal(cohort.docs.highlighted, 5);
  assert.equal(cohort.docs.buttons, 5);
  assert.deepEqual(cohort.docs.labels, Array(5).fill("Copy"));
  assert.equal(cohort.docs.after1900ms, "Copy");
}
assert.deepEqual(cohorts[0].artifacts, cohorts[1].artifacts);
assert.deepEqual(cohorts[0].environment, cohorts[1].environment);
assert.equal(cohorts[0].lockfileSha256, cohorts[1].lockfileSha256);
assert.notEqual(cohorts[0].root, cohorts[1].root);
for (const key of ["home", "docs", "uninstrumented"])
  assert.deepEqual(cohorts[0][key].html, cohorts[1][key].html);
// These guards must fail before install/build or any output write.
for (const args of [
  [],
  [fileURLToPath(local("../../../../")), fileURLToPath(local("cohort-a.json"))],
]) {
  const run = spawnSync(
    process.execPath,
    [fileURLToPath(local("collect.mjs")), ...args],
    { encoding: "utf8" },
  );
  assert.notEqual(run.status, 0);
  assert.match(run.stderr, /Usage:|Refusing to overwrite/);
}
for (const name of [
  "252.typ",
  "collect.mjs",
  "verify.mjs",
  "cohort-a.json",
  "cohort-b.json",
]) {
  const check = spawnSync(
    "git",
    ["diff", "--no-index", "--check", "/dev/null", fileURLToPath(local(name))],
    { encoding: "utf8" },
  );
  assert([0, 1].includes(check.status));
  assert.equal(check.stdout + check.stderr, "", `Whitespace check: ${name}`);
}
console.log(
  "PASS: two cohorts, 10 normal navigations, 50 clicks, six fault injections, hook restoration, artifacts/HTML/environment, distributions, CLI guards, five-file whitespace check",
);
console.log(
  JSON.stringify(
    Object.fromEntries(
      Object.keys(cohorts[0].distributionsMs).map((key) => [
        key,
        {
          a: cohorts[0].distributionsMs[key],
          b: cohorts[1].distributionsMs[key],
          medianDeltaBMinusA:
            cohorts[1].distributionsMs[key].median -
            cohorts[0].distributionsMs[key].median,
        },
      ]),
    ),
    null,
    2,
  ),
);
console.log(
  JSON.stringify(
    cohorts.map((cohort) => ({
      root: cohort.root,
      responseEnd: statistics(
        cohort.normal.map((sample) => sample.navigation.responseEnd),
      ),
      domContentLoaded: statistics(
        cohort.normal.map(
          (sample) => sample.navigation.domContentLoadedEventEnd,
        ),
      ),
      mainResource: statistics(
        cohort.normal.map(
          (sample) =>
            sample.resources.find((entry) => entry.path.includes("/main-"))
              .duration,
        ),
      ),
      appRootResource: statistics(
        cohort.normal.map(
          (sample) =>
            sample.resources.find((entry) => entry.path.includes("/appRoot-"))
              .duration,
        ),
      ),
    })),
    null,
    2,
  ),
);
