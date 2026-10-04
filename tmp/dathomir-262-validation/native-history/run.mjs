import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync } from "node:fs";
const require = createRequire(import.meta.url);
const root = dirname(
  require.resolve("vitest/package.json", { paths: [join(process.cwd(), "packages/reactivity")] }),
);
const result = spawnSync(
  process.execPath,
  [
    join(root, "vitest.mjs"),
    "run",
    "--config",
    "tmp/dathomir-262-validation/native-history/vitest.config.mjs",
  ],
  { encoding: "utf8" },
);
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
process.stdout.write(log);
writeFileSync(new URL("./latest-run.log", import.meta.url), log);
process.exitCode = result.status ?? 1;
