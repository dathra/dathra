import { defineConfig } from "@dathra/config/tsdown";

export default defineConfig({
  entry: ["src/index.ts", "src/ssr/index.ts", "src/hydration/index.ts"],
  dts: true,
  outDir: "dist",
  clean: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  minify: true,
});
