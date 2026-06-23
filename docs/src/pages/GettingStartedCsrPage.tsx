import { DocCodeBlock } from "../components/DocCodeBlock";

function GettingStartedCsrPage() {
  return (
    <section>
      <h1>Getting Started: CSR</h1>
      <p>
        CSR mode is the smallest setup. The browser loads a module, the module registers your custom
        elements, and the HTML page places those elements directly in the document.
      </p>

      <h2>Installation</h2>
      <DocCodeBlock language="bash">
        pnpm add @dathra/core @dathra/components @dathra/runtime @dathra/plugin
      </DocCodeBlock>

      <h2>1. vite.config.ts</h2>
      <DocCodeBlock language="ts">{`import { dathraVitePlugin } from "@dathra/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [dathraVitePlugin({ mode: "csr" })],
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
        <h1>Dathra CSR App</h1>
        <my-counter initial="5"></my-counter>
      </main>
    );
  },
);

export { AppRoot };`}</DocCodeBlock>

      <h2>5. index.html</h2>
      <DocCodeBlock language="html">{`<div id="app">
  <app-root></app-root>
</div>`}</DocCodeBlock>

      <h2>6. src/main.ts</h2>
      <DocCodeBlock language="ts">{`import "./AppRoot";

// Importing the module registers <app-root> and its nested components.`}</DocCodeBlock>

      <h2>7. Run the App</h2>
      <DocCodeBlock language="bash">pnpm vite --host 0.0.0.0</DocCodeBlock>

      <p>
        This pattern keeps the app rooted in a single Web Component. Nested custom elements like{" "}
        <code>{"<my-counter>"}</code> are rendered inside <code>{"<app-root>"}</code> just like they
        would be in a larger app.
      </p>

      <h2>Common Mistakes</h2>
      <ul>
        <li>
          Use <code>jsx: "preserve"</code>. The Dathra plugin needs to see the JSX before TypeScript
          lowers it.
        </li>
        <li>
          Import component modules for their registration side effects before using their custom
          element tags in HTML.
        </li>
        <li>
          Use <code>class</code>, not <code>className</code>, in Dathra JSX.
        </li>
      </ul>
    </section>
  );
}

export { GettingStartedCsrPage };
