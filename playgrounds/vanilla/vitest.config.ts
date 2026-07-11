import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

const playgroundRoot = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig({
  root: playgroundRoot,
  test: {
    environment: "node",
    include: ["src/Counter.test.ts"],
    hookTimeout: 60000,
    testTimeout: 30000,
  },
});
