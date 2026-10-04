import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
export default defineConfig({
  root: fileURLToPath(new URL(".", import.meta.url)),
  test: { include: ["verification.test.ts"], testTimeout: 60000, fileParallelism: false },
});
