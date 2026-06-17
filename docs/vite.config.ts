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

export default defineConfig({
  root: projectRoot,
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
