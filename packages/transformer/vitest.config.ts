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
    include: ["src/**/*.test.ts"],
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
