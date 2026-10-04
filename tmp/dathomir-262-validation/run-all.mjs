import { spawnSync } from "node:child_process";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { writeFileSync } from "node:fs";

// Run from the repository root after the documented dependency prerequisites.
const root = process.cwd();
const directory = "tmp/dathomir-262-validation";
const require = createRequire(import.meta.url);
const vitest = join(
  dirname(
    require.resolve("vitest/package.json", {
      paths: [join(root, "packages/reactivity")],
    }),
  ),
  "vitest.mjs",
);
const commands = [
  [
    "types-build",
    process.execPath,
    [vitest, "run", "--config", join(root, directory, "types-build/vitest.config.mjs")],
  ],
  ["state-lifetime", process.execPath, [`${directory}/state-lifetime/run.mjs`]],
  ["dom-input", process.execPath, [`${directory}/dom-input/run.mjs`]],
  ["delivery-races", process.execPath, [`${directory}/delivery-races/run.mjs`]],
  ["native-controls", process.execPath, [`${directory}/native-controls/run.mjs`]],
  ["native-history", process.execPath, [`${directory}/native-history/run.mjs`]],
  ["docs-build", process.execPath, [`${directory}/docs-copy/build.mjs`]],
  ["docs-copy", process.execPath, [`${directory}/docs-copy/run.mjs`]],
];
const results = [];
for (const [name, executable, args] of commands) {
  const started = new Date().toISOString();
  const result = spawnSync(executable, args, { cwd: root, encoding: "utf8" });
  const output = `${result.stdout ?? ""}${result.stderr ?? ""}`;
  writeFileSync(new URL(`./${name}-aggregate.log`, import.meta.url), output);
  results.push({
    name,
    started,
    completed: new Date().toISOString(),
    executable,
    args,
    exitCode: result.status,
    error: result.error?.message ?? null,
  });
  process.stdout.write(`${name}: ${result.status === 0 ? "PASS" : "FAIL"}\n`);
  if (result.status !== 0) process.exitCode = 1;
}
writeFileSync(
  new URL("./aggregate-results.json", import.meta.url),
  JSON.stringify(
    {
      node: process.version,
      scope: "Independent proof kernels and observations; not a joint production integration test.",
      results,
    },
    null,
    2,
  ) + "\n",
);
