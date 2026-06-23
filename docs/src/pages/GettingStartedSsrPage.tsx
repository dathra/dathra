import { DocCodeBlock } from "../components/DocCodeBlock";

function GettingStartedSsrPage() {
  return (
    <section>
      <h1>Getting Started: SSR</h1>
      <p>
        SSR mode renders your root custom element on the server as Declarative Shadow DOM. The
        client entry then imports the same component modules and hydrates the existing DOM instead
        of replacing the whole document.
      </p>

      <h2>Installation</h2>
      <DocCodeBlock language="bash">
        pnpm add @dathra/core @dathra/components @dathra/runtime @dathra/plugin
      </DocCodeBlock>

      <h2>1. vite.config.ts</h2>
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

      <h2>2. tsconfig.json</h2>
      <DocCodeBlock language="json">{`{
  "compilerOptions": {
    "jsx": "preserve",
    "jsxImportSource": "@dathra/core"
  }
}`}</DocCodeBlock>

      <h2>3. src/Counter.tsx</h2>
      <DocCodeBlock language="tsx">{`import { defineComponent, css } from "@dathra/components";
import { signal, computed } from "@dathra/core";

const Counter = defineComponent(
  "my-counter",
  ({ props }) => {
    const count = signal(props.initial.value);
    const doubled = computed(() => count.value * 2);

    return (
      <div>
        <p>Count: {count.value}</p>
        <p>Doubled: {doubled.value}</p>
        <button onClick={() => count.set(count.value + 1)}>+1</button>
      </div>
    );
  },
  {
    props: {
      initial: { type: Number, default: 0 },
    },
    styles: [css\`
      :host { display: block; padding: 16px; }
      button { border-radius: 8px; }
    \`],
  },
);

export { Counter };`}</DocCodeBlock>

      <h2>4. src/AppRoot.tsx</h2>
      <DocCodeBlock language="tsx">{`import { defineComponent } from "@dathra/components";

import "./Counter";

const AppRoot = defineComponent(
  "app-root",
  () => {
    return (
      <main>
        <h1>Dathra SSR App</h1>
        <my-counter initial="5"></my-counter>
      </main>
    );
  },
);

export { AppRoot };`}</DocCodeBlock>

      <h2>5. index.html</h2>
      <DocCodeBlock language="html">{`<div id="app"><!--ssr-outlet--></div>
<script type="module" src="/src/entry-client.ts"></script>`}</DocCodeBlock>

      <h2>6. src/entry-server.tsx</h2>
      <DocCodeBlock language="tsx">{`import { defineSsrEntry, render } from "@dathra/core/ssr";
import { AppRoot } from "./AppRoot";

const handler = defineSsrEntry(async () => {
  return {
    html: render(AppRoot),
  };
});

export default handler;`}</DocCodeBlock>

      <h2>7. src/entry-client.ts</h2>
      <DocCodeBlock language="ts">{`import { hydrate } from "@dathra/core/hydration";

void import("./AppRoot").then(() => {
  queueMicrotask(() => {
    hydrate(document);
  });
});`}</DocCodeBlock>

      <p>
        In this flow, the server emits <code>{"<app-root>"}</code> with Declarative Shadow DOM. The
        browser upgrades and hydrates the app root, and nested components like{" "}
        <code>{"<my-counter>"}</code> come along as part of the same tree.
      </p>

      <h2>Passing Request State</h2>
      <p>
        Pass route, locale, or other request-derived values as component attrs. This docs app uses
        the same pattern for <code>routePath</code>:
      </p>
      <DocCodeBlock language="tsx">{`const handler = defineSsrEntry(async ({ request }) => {
  const routePath = new URL(request.url).pathname;

  return {
    html: render(AppRoot, { routePath }),
  };
});`}</DocCodeBlock>

      <h2>Common Mistakes</h2>
      <ul>
        <li>
          Register the same component modules on both the server and the client. The server needs
          them to render DSD; the client needs them to upgrade and hydrate custom elements.
        </li>
        <li>
          Call <code>hydrate(document)</code> after client imports have resolved.
        </li>
        <li>
          Keep request-specific state in the SSR entry or a per-request store; do not rely on module
          globals for request data.
        </li>
      </ul>
    </section>
  );
}

export { GettingStartedSsrPage };
