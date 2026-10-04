import { fileURLToPath } from "node:url";
import { defineConfig } from "../../../packages/reactivity/node_modules/vitest/dist/config.js";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  cacheDir: fileURLToPath(new URL("./temp/vite", import.meta.url)),
  test: { environment: "node", include: ["*.test.ts"], maxWorkers: 1, fileParallelism: false },
});
