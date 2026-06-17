import { DocCodeBlock } from "../components/DocCodeBlock";

function ComponentsPage() {
  return (
    <section>
      <h1>Web Components API</h1>
      <p>
        Dathra provides <code>defineComponent()</code> to create custom elements
        with encapsulated Shadow DOM, reactive prop signals, Declarative Shadow
        DOM (DSD) for SSR, and island hydration support.
      </p>

      <h2>defineComponent()</h2>
      <p>Define a custom element with reactive props and scoped styles:</p>
      <DocCodeBlock language="tsx">{`import { defineComponent, css } from "@dathra/components";
import { signal } from "@dathra/core";

const MyCounter = defineComponent(
  "my-counter",
  ({ props }) => {
    const count = signal(props.initial.value ?? 0);

    return (
      <div>
        <p>Count: {count.value}</p>
        <button onClick={() => count.set(count.value + 1)}>+</button>
      </div>
    );
  },
  {
    props: {
      initial: { type: Number, default: 0 },
    },
    styles: css\`
      :host { display: block; padding: 16px; }
      button { border-radius: 8px; }
    \`,
  },
);`}</DocCodeBlock>
      <p>
        <code>defineComponent</code> registers the custom element with the
        browser via <code>customElements.define()</code>, creates a Shadow Root,
        applies <code>adoptedStyleSheets</code>, and reflects attributes as
        reactive signals.
      </p>

      <h2>SSR with DSD</h2>
      <p>
        When rendered on the server, Dathra generates Declarative Shadow DOM
        markup — the Shadow Root content is serialized as a{" "}
        <code>&lt;template shadowrootmode="open"&gt;</code> inside the custom
        element. The browser recreates the Shadow DOM from the template without
        any JavaScript.
      </p>
      <DocCodeBlock language="ts">{`import { renderDSD } from "@dathra/components/ssr";

const html = renderDSD(MyCounter, { initial: 5 });
// <my-counter initial="5">
//   <template shadowrootmode="open">
//     <style>:host { display: block; padding: 16px; } ...</style>
//     <div>Count: 5<button>+</button></div>
//   </template>
// </my-counter>`}</DocCodeBlock>

      <h2>Hydration</h2>
      <p>
        When the DSD-rendered element upgrades on the client, the <code>hydrate</code>{" "}
        option lets you replace the server-generated Shadow DOM content with a
        reactive client-side tree:
      </p>
      <DocCodeBlock language="tsx">{`const AppRoot = defineComponent(
  "app-root",
  ({ props }) => {
    // Fresh render for non-DSD / island hydration
    return <main>{props.route.value}</main>;
  },
  {
    props: {
      route: { type: String },
    },
    hydrate: ({ host, props }) => {
      // Replace DSD content with reactive client tree
      const shadow = host.shadowRoot;
      if (shadow === null) return;
      shadow.innerHTML = "";
      shadow.append(<main>{props.route.value}</main>);
    },
    styles: [baseStyles],
  },
);`}</DocCodeBlock>

      <h2>CSS Helpers</h2>
      <DocCodeBlock language="ts">{`import { css, adoptGlobalStyles } from "@dathra/components";

const theme = css\`
  dathra-docs {
    --accent: #1e6b55;
  }
\`;

adoptGlobalStyles(theme);`}</DocCodeBlock>

      <h2>Nested Components & Tree-Shaking</h2>
      <p>
        When a Web Component is used as a JSX tag inside another component's
        template (e.g. <code>&lt;MobileNav /&gt;</code>), the SSR renderer
        detects the hyphenated tag name and generates DSD for the nested
        component automatically. The import must be a value reference in the
        file, not a side-effect-only import, or the bundler may tree-shake the
        component registration.
      </p>

      <h2>Component Registration</h2>
      <p>
        <code>defineComponent</code> internally calls{" "}
        <code>registerComponent()</code> to register the component in the SSR
        registry. You can query or clear the registry directly:
      </p>
      <DocCodeBlock language="ts">{`import { hasComponent, getComponent, clearRegistry } from "@dathra/components";

hasComponent("my-counter"); // true
getComponent("my-counter"); // ComponentRegistration`}</DocCodeBlock>
    </section>
  );
}

export { ComponentsPage };
