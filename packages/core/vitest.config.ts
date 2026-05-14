import { resolve } from "node:path";

import { defineConfig } from "vitest/config";

export default defineConfig({
  define: {
    __DEV__: true,
  },
  esbuild: {
    // Transform JSX using the Dathra jsx-runtime (same source as production)
    jsx: "automatic",
    jsxImportSource: "@dathra/core",
  },
  resolve: {
    alias: {
      "@/": resolve(__dirname, "src") + "/",
      "@": resolve(__dirname, "src"),
      // Map auto-imported JSX runtime paths to local src so no build step is needed
      "@dathra/core/jsx-runtime": resolve(
        __dirname,
        "src/jsx-runtime/index.ts",
      ),
      "@dathra/core/jsx-dev-runtime": resolve(
        __dirname,
        "src/jsx-runtime/index.ts",
      ),
      "@dathra/components/internal": resolve(
        __dirname,
        "../components/src/internal.ts",
      ),
    },
  },
  test: {
    environment: "happy-dom",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    clearMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "json", "html"],
      include: ["src/**/*.ts", "src/**/*.tsx"],
      exclude: ["src/**/*.d.ts", "src/**/*.test.ts", "src/**/*.test.tsx"],
    },
  },
});
