import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      "@": resolve(__dirname, "src"),
    },
  },
  test: {
    environment: "node",
    projects: [
      {
        extends: true,
        test: {
          name: "execution-graph",
          include: ["src/executionGraph/implementation.test.ts"],
          sequence: { groupOrder: 0 },
        },
      },
      {
        extends: true,
        test: {
          name: "transformer-rest",
          include: ["src/**/*.test.ts"],
          exclude: ["src/executionGraph/implementation.test.ts"],
          sequence: { groupOrder: 1 },
        },
      },
    ],
    clearMocks: true,
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: [
        "**/dist/**",
        "**/*.d.ts",
        "vitest.config.ts",
        "tsdown.config.ts",
      ],
      // all: true, // ← 未 import ファイルまで把握したくなったら有効化
      // thresholds を設定したい場合は後で追加
    },
  },
});
