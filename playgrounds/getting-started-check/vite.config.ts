import { dathraVitePlugin } from "@dathra/plugin";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { defineConfig } from "vite";

const projectRoot = path.dirname(fileURLToPath(import.meta.url));
const buildTarget = process.env.BUILD_TARGET;

const workspacePackages = [
  "@dathra/core",
  "@dathra/components",
  "@dathra/runtime",
  "@dathra/store",
  "@dathra/reactivity",
  "@dathra/shared",
];

const isSSR = buildTarget !== "client";

export default defineConfig({
  root: projectRoot,
  plugins: [
    dathraVitePlugin(
      isSSR
        ? { mode: "ssr", ssr: { entry: "/src/entry-server.tsx" } }
        : {},
    ),
  ],
  optimizeDeps: {
    exclude: workspacePackages,
  },
  ...(isSSR ? { ssr: { noExternal: workspacePackages } } : {}),
  ...(buildTarget
    ? {
        build: {
          rollupOptions: {
            input: {
              main: buildTarget === "client" ? "./index.csr.html" : "./index.html",
            },
          },
        },
      }
    : {}),
});
