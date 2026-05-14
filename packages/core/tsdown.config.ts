import { defineConfig } from "@dathra/config/tsdown";

export default defineConfig({
  entry: [
    "src/index.ts",
    "src/hydration/index.ts",
    "src/jsx-runtime/index.ts",
    "src/reactivity/index.ts",
    "src/runtime/index.ts",
    "src/ssr/index.ts",
    "src/store/index.ts",
    "src/shared/index.ts",
  ],
  dts: true,
  outDir: "dist",
  clean: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  minify: false,
});
