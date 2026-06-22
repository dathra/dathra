import type { ReferenceDocument } from "../types";

const pluginReference: ReferenceDocument = {
  path: "/reference/plugin",
  title: "Plugin API Reference",
  packageName: "@dathra/plugin",
  exportPath: "@dathra/plugin",
  importPath: "@dathra/plugin",
  level: "recommended",
  audience:
    "Application authors configuring builds and build-tool integrators extending Dathra compilation.",
  description:
    "Build tool plugin factories for Vite, Rollup, webpack, esbuild, and unplugin-compatible environments.",
  declarationFile: "packages/plugin/dist/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: [
        "dathra",
        "default",
        "dathraEsbuildPlugin",
        "dathraRollupPlugin",
        "dathraVitePlugin",
        "dathraWebpackPlugin",
      ],
    },
    { label: "Types", items: ["PluginOptions"] },
  ],
  apis: [
    {
      name: "PluginOptions",
      kind: "type",
      description: "Shared options for Dathra build tool plugins.",
      signature: `interface PluginCommonOptions {
  include?: string[];
  exclude?: string[];
  runtimeModule?: string;
}

interface PluginSsrOptions {
  entry: string;
  outlet?: string;
  renderExport?: string;
}

type PluginOptions = PluginCommonOptions & (
  | { mode: "ssr"; ssr?: false | PluginSsrOptions }
  | { mode?: "csr"; ssr?: false }
);`,
    },
    {
      name: "dathra / default",
      kind: "constant",
      description: "Universal unplugin instance for Dathra.",
      signature: "declare const dathra: UnpluginInstance<PluginOptions, boolean>;",
      example: `import dathra from "@dathra/plugin";

export default dathra.vite({ mode: "csr" });`,
    },
    {
      name: "dathraVitePlugin()",
      kind: "function",
      description: "Create the Dathra Vite plugin with CSR or SSR transform behavior.",
      signature: "declare const dathraVitePlugin: (options?: PluginOptions) => Plugin;",
      parameters: [
        {
          name: "options",
          type: "PluginOptions",
          description: "Dathra transform and SSR dev-rendering options.",
        },
      ],
      example: `import { dathraVitePlugin } from "@dathra/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [dathraVitePlugin({ mode: "csr" })],
});`,
    },
    {
      name: "Other build-tool factories",
      kind: "function",
      description: "Create Dathra plugins for webpack, Rollup, and esbuild.",
      signature: `declare const dathraWebpackPlugin: (options: PluginOptions) => WebpackPluginInstance;
declare const dathraRollupPlugin: (options: PluginOptions) => RollupPlugin | RollupPlugin[];
declare const dathraEsbuildPlugin: (options: PluginOptions) => EsbuildPlugin;`,
    },
  ],
};

export { pluginReference };
