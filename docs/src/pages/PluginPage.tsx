import { DocCodeBlock } from "../components/DocCodeBlock";

function PluginPage() {
  return (
    <section>
      <h1>Build Tool Plugin</h1>
      <p>
        <code>@dathra/plugin</code> provides build tool plugins via <code>unplugin</code>. It
        integrates Dathra's JSX transformer into your build pipeline.
      </p>
      <p>
        For exact plugin option signatures, see the{" "}
        <a href="/reference/plugin">Plugin API Reference</a>.
      </p>

      <h2>Vite</h2>
      <p>
        Vite is the primary documented setup. Use CSR mode for browser-only apps and SSR mode when
        the dev server should call a Dathra server entry.
      </p>
      <h3>CSR</h3>
      <DocCodeBlock language="ts">{`import { dathraVitePlugin } from "@dathra/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    dathraVitePlugin({
      mode: "csr",
    }),
  ],
});`}</DocCodeBlock>

      <h3>SSR</h3>
      <DocCodeBlock language="ts">{`import { dathraVitePlugin } from "@dathra/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    dathraVitePlugin({
      mode: "ssr",
      ssr: {
        entry: "/src/entry-server.tsx",
      },
    }),
  ],
});`}</DocCodeBlock>

      <h2>Webpack</h2>
      <p>
        The package also exposes unplugin adapters for other bundlers. Keep the same{" "}
        <code>mode</code> option, but wire SSR server behavior according to that bundler's own
        server integration model.
      </p>
      <DocCodeBlock language="js">{`import { dathraWebpackPlugin } from "@dathra/plugin";

// webpack.config.js
module.exports = {
  plugins: [dathraWebpackPlugin({ mode: "csr" })],
};`}</DocCodeBlock>

      <h2>Rollup</h2>
      <DocCodeBlock language="ts">{`import { dathraRollupPlugin } from "@dathra/plugin";

export default {
  plugins: [dathraRollupPlugin({ mode: "csr" })],
};`}</DocCodeBlock>

      <h2>esbuild</h2>
      <DocCodeBlock language="ts">{`import { dathraEsbuildPlugin } from "@dathra/plugin";

import esbuild from "esbuild";
esbuild.build({
  plugins: [dathraEsbuildPlugin({ mode: "csr" })],
});`}</DocCodeBlock>

      <h2>Options</h2>
      <DocCodeBlock language="ts">{`type PluginOptions = {
  mode?: "csr" | "ssr";          // render mode, defaults to "csr"
  include?: string[];             // defaults to [".tsx", ".jsx"]
  exclude?: string[];             // path substrings to skip
  runtimeModule?: string;         // defaults to "@dathra/core"
  ssr?: false | {
    entry: string;               // SSR entry point for dev server
    outlet?: string;             // HTML placeholder to replace
    renderExport?: string;       // entry export to call
  };
};`}</DocCodeBlock>

      <h2>Universal Plugin</h2>
      <p>
        Use the <code>dathra()</code> factory for a framework-agnostic unplugin instance:
      </p>
      <DocCodeBlock language="ts">{`import { dathra } from "@dathra/plugin";

const plugin = dathra({ mode: "csr" });
// Works with any unplugin-compatible bundler`}</DocCodeBlock>

      <h2>TypeScript Settings</h2>
      <p>
        Dathra's transformer must receive JSX syntax from the build pipeline. Configure TypeScript
        to preserve JSX and point JSX types at <code>@dathra/core</code>:
      </p>
      <DocCodeBlock language="json">{`{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@dathra/core"
  }
}`}</DocCodeBlock>
    </section>
  );
}

export { PluginPage };
