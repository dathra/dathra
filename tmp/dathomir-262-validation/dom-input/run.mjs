import { createRequire } from "node:module";
import { dirname, join, resolve } from "node:path";
import { spawnSync } from "node:child_process";
import { writeFileSync, readFileSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
const root = process.cwd();
const require = createRequire(import.meta.url);
const vitestPackage = require.resolve("vitest/package.json", {
  paths: [join(root, "packages/reactivity")],
});
const vitestRequire = createRequire(vitestPackage);
const viteRequire = createRequire(vitestRequire.resolve("vite/package.json"));
const { build, version } = viteRequire("esbuild");
const directory = "tmp/dathomir-262-validation/dom-input";
mkdirSync(join(directory, ".cache"), { recursive: true });
const built = await build({
  entryPoints: [join(directory, "browser.mjs")],
  outfile: join(directory, "browser.bundle.js"),
  bundle: true,
  format: "iife",
  platform: "browser",
  metafile: true,
  define: { __DEV__: "true" },
});
const inputs = Object.keys(built.metafile.inputs).map((path) => ({
  path,
  sha256: createHash("sha256").update(readFileSync(path)).digest("hex"),
}));
writeFileSync(
  join(directory, "build-provenance.json"),
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      esbuild: version,
      node: process.version,
      inputs,
      command: `node ${directory}/run.mjs`,
    },
    null,
    2,
  ) + "\n",
);
const vitestRoot = dirname(vitestPackage);
const result = spawnSync(
  process.execPath,
  [join(vitestRoot, "vitest.mjs"), "run", "--config", join(directory, "vitest.config.mjs")],
  {
    encoding: "utf8",
    env: { ...process.env, TMPDIR: resolve(directory, ".cache") },
  },
);
const log = `${result.stdout ?? ""}${result.stderr ?? ""}`;
writeFileSync(join(directory, "latest-run.log"), log);
process.stdout.write(log);
process.exitCode = result.status ?? 1;
