import { defineConfig } from "@dathra/config/tsdown";

export default defineConfig({
  entry: ["src/index.ts"],
  dts: {
    oxc: false,
  },
  outDir: "dist",
  clean: true,
  format: ["cjs", "esm"],
  sourcemap: true,
  minify: true,
});
