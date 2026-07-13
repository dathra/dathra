import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const playgroundRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: playgroundRoot,
  test: {
    environment: "node",
    hookTimeout: 60000,
    include: ["src/Counter.test.ts"],
    testTimeout: 30000,
  },
});
