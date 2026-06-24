import { DocCodeBlock } from "../components/DocCodeBlock/index";

function SsrPage() {
  return (
    <section>
      <h1>SSR & Hydration</h1>
      <p>
        Dathra SSR renders registered Web Components to Declarative Shadow DOM and hydrates them
        after the browser has parsed that DSD into real shadow roots. The server and client both use
        the same component definitions.
      </p>
      <p>
        For exact SSR and hydration signatures, see the{" "}
        <a href="/reference/core/ssr">Core SSR API Reference</a> and{" "}
        <a href="/reference/core/hydration">Core Hydration API Reference</a>.
      </p>

      <h2>Server Entry</h2>
      <p>
        The server entry is a typed request handler. It receives request context, chooses the route
        state, and returns the HTML for a root component:
      </p>
      <DocCodeBlock language="tsx">{`import { defineSsrEntry, render } from "@dathra/core/ssr";
import { AppRoot } from "./AppRoot";

const handler = defineSsrEntry(async ({ request }) => {
  const routePath = new URL(request.url).pathname;

  return {
    html: render(AppRoot, { routePath }),
    statusCode: routePath === "/missing" ? 404 : 200,
  };
});

export default handler;`}</DocCodeBlock>

      <h2>Root Component</h2>
      <p>
        The root component receives server-provided props as signals. On the server, returning JSX
        produces HTML inside the DSD template. On the client, the same definition upgrades the
        custom element.
      </p>
      <DocCodeBlock language="tsx">{`import { defineComponent } from "@dathra/components";

const AppRoot = defineComponent(
  "app-root",
  ({ props }) => {
    return <main>Route: {props.routePath.value}</main>;
  },
  {
    props: {
      routePath: { type: String, default: "/" },
    },
  },
);

export { AppRoot };`}</DocCodeBlock>

      <h2>Client Hydration</h2>
      <DocCodeBlock language="ts">{`import { hydrate } from "@dathra/core/hydration";

void import("./AppRoot").then(() => {
  queueMicrotask(() => {
    hydrate(document);
  });
});`}</DocCodeBlock>

      <h2>Hydration Hooks</h2>
      <p>
        If the default upgrade behavior is not enough, pass a <code>hydrate</code> option to{" "}
        <code>defineComponent()</code>. It receives the existing host, props, and store so you can
        replace or attach to the server-rendered shadow content.
      </p>
      <DocCodeBlock language="tsx">{`const AppRoot = defineComponent(
  "app-root",
  ({ props }) => <main>{props.routePath.value}</main>,
  {
    hydrate: ({ host, props }) => {
      const shadowRoot = host.shadowRoot;
      if (shadowRoot === null) return;

      shadowRoot.innerHTML = "";
      shadowRoot.append(<main>{props.routePath.value}</main>);
    },
    props: {
      routePath: { type: String, default: "/" },
    },
  },
);`}</DocCodeBlock>

      <h2>Islands Architecture</h2>
      <p>
        Components can be marked with <code>client:*</code> directives for selective hydration.
        Directives are written as JSX props on Dathra components:
      </p>
      <DocCodeBlock language="tsx">{`<hero-banner />
<cart-summary client:visible />
<search-box client:interaction="input" />
<desktop-nav client:media="(min-width: 768px)" />`}</DocCodeBlock>
      <ul>
        <li>
          <code>client:visible</code> — hydrate when visible (IntersectionObserver)
        </li>
        <li>
          <code>client:idle</code> — hydrate when the browser is idle
        </li>
        <li>
          <code>client:interaction</code> — hydrate on user interaction
        </li>
        <li>
          <code>client:media="(min-width: 768px)"</code> — hydrate when media matches
        </li>
        <li>
          <code>client:load</code> — hydrate immediately on load
        </li>
      </ul>

      <h2>Interaction Replay</h2>
      <p>
        When using <code>client:interaction</code>, user interactions before hydration are captured
        and replayed after the component hydrates. Supported events include <code>onClick</code>,{" "}
        <code>onKeydown</code>, and <code>onPointerdown</code>.
      </p>

      <h2>Hydration Plan</h2>
      <p>
        The hydration system uses <code>planFactory</code> to generate a hydration plan from the
        server-rendered DOM. The plan describes which nodes to hydrate, what strategies to use, and
        how to handle nested islands.
      </p>
      <p>
        Most applications should use <code>hydrate(document)</code> from{" "}
        <code>@dathra/core/hydration</code>. Lower-level hydration APIs are for runtime integrations
        and advanced testing.
      </p>
    </section>
  );
}

export { SsrPage };
