import { DocCodeBlock } from "../components/DocCodeBlock";

function RuntimePage() {
  return (
    <section>
      <h1>DOM Runtime & SSR</h1>
      <p>
        <code>@dathra/runtime</code> provides low-level DOM manipulation primitives, SSR rendering
        functions, and a hydration engine.
      </p>
      <p>
        Runtime APIs are mainly for compiler output, integrations, and Dathra contributors. For
        exact signatures, see the <a href="/reference/runtime">Runtime API Reference</a>.
      </p>

      <h2>DOM Primitives</h2>
      <DocCodeBlock language="ts">{`import {
  setAttr,   // set DOM attributes
  setProp,   // set DOM properties
  setText,   // set text content
  insert,    // insert a node
  append,    // append a node
  spread,    // spread props onto an element
  firstChild,
  nextSibling,
} from "@dathra/runtime";`}</DocCodeBlock>

      <h2>Tree IR</h2>
      <p>Build DOM from a structured intermediate representation:</p>
      <DocCodeBlock language="ts">{`import { fromTree, fromMarkup } from "@dathra/runtime";

const el = fromTree({
  tag: "div",
  props: { class: "container" },
  children: [{ tag: "p", children: ["Hello"] }],
});
// Returns a thunk that produces the DOM element

const fromHtml = fromMarkup("<p>Hello</p>");`}</DocCodeBlock>

      <h2>Events</h2>
      <DocCodeBlock language="ts">{`import { event } from "@dathra/runtime";

// Event handling utilities used internally by the runtime`}</DocCodeBlock>

      <h2>Reconciliation</h2>
      <p>Keyed list reconciliation:</p>
      <DocCodeBlock language="ts">{`import { reconcile } from "@dathra/runtime";

const list = reconcile(
  parentElement,
  items,       // current items array
  renderItem,  // (item) => HTMLElement
  getKey,      // (item) => string | number
);`}</DocCodeBlock>

      <h2>SSR Primitives</h2>
      <DocCodeBlock language="ts">{`import {
  renderDynamicText,
  renderDynamicAttr,
  renderDynamicSpread,
  renderDynamicInsert,
  renderDynamicEach,
} from "@dathra/runtime/ssr";

// Used by the transformer for SSR code generation`}</DocCodeBlock>

      <h2>Hydration</h2>
      <DocCodeBlock language="ts">{`import {
  hydrateWithPlan,
  getClientAction,
  registerClientAction,
} from "@dathra/runtime/hydration";

// Deserialize SSR state
import { deserializeState } from "@dathra/runtime/hydration";`}</DocCodeBlock>
    </section>
  );
}

export { RuntimePage };
