import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const vitestRoot = dirname(
  require.resolve("vitest/package.json", { paths: [join(process.cwd(), "packages/reactivity")] }),
);
const result = spawnSync(
  process.execPath,
  [
    join(vitestRoot, "vitest.mjs"),
    "run",
    "--config",
    "tmp/dathomir-262-validation/delivery-races/vitest.config.mjs",
  ],
  { encoding: "utf8" },
);
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(log);
writeFileSync(new URL("./latest-run.log", import.meta.url), log);
writeFileSync(
  new URL("./result.json", import.meta.url),
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      node: process.version,
      exitCode: result.status,
      error: result.error?.message,
      scope: "deterministic model, not production browser/transport",
    },
    null,
    2,
  ) + "\n",
);
process.exitCode = result.status ?? 1;
