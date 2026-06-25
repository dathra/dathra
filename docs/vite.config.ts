import { dathraVitePlugin } from "@dathra/plugin";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));

const workspacePackages = [
  "@dathra/core",
  "@dathra/components",
  "@dathra/runtime",
  "@dathra/store",
  "@dathra/reactivity",
  "@dathra/shared",
];

const workspaceAliases = [
  ["@dathra/components/internal", "../packages/components/src/internal.ts"],
  ["@dathra/components/ssr", "../packages/components/src/ssr/index.ts"],
  ["@dathra/components", "../packages/components/src/index.ts"],
  ["@dathra/core/hydration", "../packages/core/src/hydration/index.ts"],
  ["@dathra/core/jsx-dev-runtime", "../packages/core/src/jsx-runtime/index.ts"],
  ["@dathra/core/jsx-runtime", "../packages/core/src/jsx-runtime/index.ts"],
  ["@dathra/core/ssr", "../packages/core/src/ssr/index.ts"],
  ["@dathra/core", "../packages/core/src/index.ts"],
  ["@dathra/reactivity", "../packages/reactivity/src/index.ts"],
  ["@dathra/runtime/hydration", "../packages/runtime/src/hydration/index.ts"],
  ["@dathra/runtime/ssr", "../packages/runtime/src/ssr/index.ts"],
  ["@dathra/runtime", "../packages/runtime/src/index.ts"],
  ["@dathra/shared", "../packages/shared/src/index.ts"],
  ["@dathra/store/internal", "../packages/store/src/internal.ts"],
  ["@dathra/store", "../packages/store/src/index.ts"],
].map(([find, target]) => ({
  find: new RegExp(`^${find}$`),
  replacement: path.resolve(projectRoot, target),
}));

export default defineConfig({
  root: projectRoot,
  resolve: {
    alias: workspaceAliases,
  },
  plugins: [
    dathraVitePlugin({
      mode: "ssr",
      ssr: {
        entry: "/src/entry-server.tsx",
      },
    }),
  ],
  optimizeDeps: {
    exclude: workspacePackages,
  },
  ssr: {
    noExternal: workspacePackages,
  },
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
});
