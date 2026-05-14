import path from "node:path";
import { defineConfig } from "@dathra/config/tsdown";

const srcDir = path.resolve(import.meta.dirname, "src");

const sharedOptions = {
  dts: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  minify: false,
} as const;

export default defineConfig([
  // Browser / default build — uses sync stack (internal.ts)
  {
    ...sharedOptions,
    entry: ["src/index.ts", "src/internal.ts"],
    outDir: "dist",
    clean: true,
    platform: "browser",
    fixedExtension: true,
  },
  // Node.js / Edge build — uses AsyncLocalStorage (internal.node.ts)
  {
    ...sharedOptions,
    entry: {
      "index.node": "src/index.ts",
      "internal.node": "src/internal.ts",
    },
    outDir: "dist",
    clean: false,
    platform: "node",
    inputOptions: {
      resolve: {
        alias: {
          [path.join(srcDir, "withStore", "internal")]: path.join(
            srcDir,
            "withStore",
            "internal.node",
          ),
        },
      },
    },
  },
]);
