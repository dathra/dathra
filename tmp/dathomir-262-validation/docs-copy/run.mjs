import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, readdirSync } from "node:fs";
import { createHash } from "node:crypto";
const require = createRequire(import.meta.url);
const root = dirname(
  require.resolve("vitest/package.json", { paths: [join(process.cwd(), "packages/reactivity")] }),
);
const proofRoot = new URL("./", import.meta.url);
const hash = (bytes) => createHash("sha256").update(bytes).digest("hex");
const outputs = {};
function collect(directory, prefix = "") {
  for (const entry of readdirSync(directory, { withFileTypes: true })) {
    const relative = `${prefix}${entry.name}`;
    const path = new URL(entry.name + (entry.isDirectory() ? "/" : ""), directory);
    if (entry.isDirectory()) collect(path, `${relative}/`);
    else outputs[relative] = hash(readFileSync(path));
  }
}
collect(new URL("./build/", proofRoot));
const started = new Date().toISOString();
const provenanceHash = hash(readFileSync(new URL("./build-provenance.json", proofRoot)));
const result = spawnSync(
  process.execPath,
  [
    join(root, "vitest.mjs"),
    "run",
    "--config",
    "tmp/dathomir-262-validation/docs-copy/vitest.config.mjs",
  ],
  { encoding: "utf8" },
);
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(log);
writeFileSync(new URL("./latest-run.log", import.meta.url), log);
writeFileSync(
  new URL("./run-provenance.json", proofRoot),
  JSON.stringify(
    {
      started,
      completed: new Date().toISOString(),
      exitCode: result.status,
      buildProvenanceSha256: provenanceHash,
      outputs,
      observationsSha256: hash(readFileSync(new URL("./observations.json", proofRoot))),
      logSha256: hash(Buffer.from(log)),
    },
    null,
    2,
  ) + "\n",
);
process.exitCode = result.status ?? 1;
