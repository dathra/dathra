import { DocCodeBlock } from "../components/DocCodeBlock";

function PluginPage() {
  return (
    <section>
      <h1>Build Tool Plugin</h1>
      <p>
        <code>@dathra/plugin</code> provides build tool plugins via{" "}
        <code>unplugin</code>. It integrates Dathra's JSX transformer into
        your build pipeline.
      </p>

      <h2>Vite</h2>
      <DocCodeBlock language="ts">{`import { dathraVitePlugin } from "@dathra/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [
    dathraVitePlugin({
      mode: "csr",        // or "ssr"
      ssr: {
        entry: "/src/entry-server.tsx",
      },
    }),
  ],
});`}</DocCodeBlock>

      <h2>Webpack</h2>
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
  mode: "csr" | "ssr";           // render mode
  ssr?: {
    entry?: string;              // SSR entry point for dev server
  };
  filter?: {                     // file extension filter
    include?: RegExp[];
    exclude?: RegExp[];
  };
};`}</DocCodeBlock>

      <h2>Universal Plugin</h2>
      <p>
        Use the <code>dathra()</code> factory for a framework-agnostic unplugin
        instance:
      </p>
      <DocCodeBlock language="ts">{`import { dathra } from "@dathra/plugin";

const plugin = dathra({ mode: "csr" });
// Works with any unplugin-compatible bundler`}</DocCodeBlock>
    </section>
  );
}

export { PluginPage };
