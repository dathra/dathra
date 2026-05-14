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

function storeNodeInternalSwap() {
  const withStoreDir = path.resolve(
    projectRoot,
    "../../packages/store/src/withStore",
  );
  const storeSrcDir = path.resolve(projectRoot, "../../packages/store/src");

  return {
    name: "playground-e2e-store-node-internal-swap",
    enforce: "pre" as const,
    resolveId(source: string, importer?: string, options?: { ssr?: boolean }) {
      if (!options?.ssr || importer === undefined) {
        return;
      }

      const importerPath = importer.split("?")[0] ?? importer;
      const importerDir = path.dirname(importerPath);

      if (source === "./internal" && importerDir === withStoreDir) {
        return path.join(withStoreDir, "internal.node.ts");
      }

      if (source === "./withStore/internal" && importerDir === storeSrcDir) {
        return path.join(withStoreDir, "internal.node.ts");
      }
    },
  };
}

export default defineConfig({
  root: projectRoot,
  plugins: [storeNodeInternalSwap(), dathraVitePlugin()],
  optimizeDeps: {
    exclude: workspacePackages,
  },
  ssr: {
    noExternal: workspacePackages,
  },
  esbuild: {
    jsx: "preserve",
  },
  build: {
    rollupOptions: {
      input: {
        main: "./index.html",
      },
    },
  },
});
