import { DocCodeBlock } from "../components/DocCodeBlock";

function SsrPage() {
  return (
    <section>
      <h1>SSR & Hydration</h1>
      <p>
        Dathra provides a complete SSR pipeline with islands architecture,
        Declarative Shadow DOM (DSD), progressive hydration, and interaction
        replay.
      </p>

      <h2>SSR Entry</h2>
      <p>
        The server entry uses <code>defineSsrEntry()</code> to create a
        request handler:
      </p>
      <DocCodeBlock language="ts">{`import { defineSsrEntry, render } from "@dathra/core/ssr";
import { AppRoot } from "./AppRoot";

const handler = defineSsrEntry(async ({ request }) => {
  const html = render(AppRoot, { route: "/home" });
  return { html };
});

export default handler;`}</DocCodeBlock>

      <h2>Client Hydration</h2>
      <DocCodeBlock language="ts">{`import { hydrate } from "@dathra/core/hydration";

// Import and register components
import "./AppRoot";

hydrate(document);`}</DocCodeBlock>

      <h2>Islands Architecture</h2>
      <p>
        Components can be marked with <code>client:*</code> directives for
        selective hydration:
      </p>
      <ul>
        <li><code>client:visible</code> — hydrate when visible (IntersectionObserver)</li>
        <li><code>client:idle</code> — hydrate when the browser is idle</li>
        <li><code>client:interaction</code> — hydrate on user interaction</li>
        <li><code>client:media="(min-width: 768px)"</code> — hydrate when media matches</li>
        <li><code>client:load</code> — hydrate immediately on load</li>
      </ul>

      <h2>Interaction Replay</h2>
      <p>
        When using <code>client:interaction</code>, user interactions before
        hydration are captured and replayed after the component hydrates.
        Supported events include <code>onClick</code>, <code>onKeydown</code>,
        and <code>onPointerdown</code>.
      </p>

      <h2>Hydration Plan</h2>
      <p>
        The hydration system uses <code>planFactory</code> to generate a
        hydration plan from the server-rendered DOM. The plan describes which
        nodes to hydrate, what strategies to use, and how to handle nested
        islands.
      </p>
    </section>
  );
}

export { SsrPage };
