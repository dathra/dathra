import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";
const root = new URL("../../../", import.meta.url);
// Existing pnpm installation used by the repository's tsx executable.
const require = createRequire(
  new URL("node_modules/.pnpm/tsx@4.20.6/node_modules/tsx/package.json", root),
);
const { build, version } = require("esbuild");
const result = await build({
  entryPoints: [fileURLToPath(new URL("packages/reactivity/src/index.ts", root))],
  outfile: fileURLToPath(new URL("./engine-copy.mjs", import.meta.url)),
  bundle: true,
  platform: "node",
  format: "esm",
  sourcemap: true,
  metafile: true,
});
console.log(
  JSON.stringify({ esbuild: version, inputs: Object.keys(result.metafile.inputs) }, null, 2),
);
