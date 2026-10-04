import { createRequire } from "node:module";
import { fileURLToPath, pathToFileURL } from "node:url";
import { resolve } from "node:path";
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
const repo = fileURLToPath(new URL("../../../", import.meta.url));
const docs = resolve(repo, "docs");
const require = createRequire(resolve(docs, "package.json"));
const { build } = await import(pathToFileURL(require.resolve("vite")).href);
const output = fileURLToPath(new URL("./build/", import.meta.url));
process.chdir(docs);
await build({
  configFile: resolve(docs, "vite.config.ts"),
  build: { outDir: resolve(output, "client"), emptyOutDir: true },
});
await build({
  configFile: resolve(docs, "vite.config.ts"),
  ssr: { noExternal: ["shiki"] },
  build: { outDir: resolve(output, "server"), ssr: "src/entry-server.tsx", emptyOutDir: true },
});
const inputs = [
  "docs/src/components/DocCodeBlock/DocCodeBlock.tsx",
  "docs/vite.config.ts",
  "pnpm-lock.yaml",
  "packages/plugin/dist/index.mjs",
  "packages/components/dist/index.mjs",
  "packages/reactivity/dist/index.mjs",
];
writeFileSync(
  new URL("./build-provenance.json", import.meta.url),
  JSON.stringify(
    {
      timestamp: new Date().toISOString(),
      node: process.version,
      inputs: Object.fromEntries(
        inputs.map((path) => [
          path,
          createHash("sha256")
            .update(readFileSync(resolve(repo, path)))
            .digest("hex"),
        ]),
      ),
      limitation:
        "This script rebuilds Docs and consumes hashed workspace artifacts. Run the documented build:deps prerequisite separately to rebuild those artifacts from this checkout.",
    },
    null,
    2,
  ) + "\n",
);
