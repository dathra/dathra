import { defineConfig } from "vitest/config";

export default defineConfig({
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
    },
  },
});
