function GettingStartedPage() {
  return (
    <section>
      <h1>Getting Started</h1>
      <p>
        Dathra apps are built around custom elements created with <code>defineComponent()</code>.
        Start with CSR if you only need a browser-rendered app, or use SSR when you want the server
        to emit Declarative Shadow DOM before hydration.
      </p>

      <h2>Choose a Rendering Path</h2>
      <div class="comparison-grid">
        <article class="comparison-card">
          <h3>Use CSR when</h3>
          <ul>
            <li>You are prototyping or building an internal browser-only app.</li>
            <li>The initial HTML does not need server-rendered component content.</li>
            <li>
              You want the smallest setup: one HTML file, one client entry, and component modules.
            </li>
          </ul>
        </article>

        <article class="comparison-card">
          <h3>Use SSR when</h3>
          <ul>
            <li>You need usable HTML before JavaScript finishes loading.</li>
            <li>You want Declarative Shadow DOM output for custom elements.</li>
            <li>You have request-derived state such as route, locale, or user-visible flags.</li>
          </ul>
        </article>
      </div>

      <div class="feature-grid">
        <article class="feature-card">
          <h3>CSR Quick Start</h3>
          <p>
            Register a custom element in JavaScript and place the tag directly in HTML. This is the
            simplest way to ship a client-only app.
          </p>
          <p>
            <a href="/getting-started-csr">Open CSR guide</a>
          </p>
        </article>

        <article class="feature-card">
          <h3>SSR Quick Start</h3>
          <p>
            Render Declarative Shadow DOM on the server and hydrate the same custom element on the
            client.
          </p>
          <p>
            <a href="/getting-started-ssr">Open SSR guide</a>
          </p>
        </article>
      </div>

      <h2>Before You Start</h2>
      <ul>
        <li>
          Use <code>jsx: "preserve"</code> and <code>jsxImportSource: "@dathra/core"</code> so the
          Dathra transformer receives JSX.
        </li>
        <li>
          Keep component registration explicit by importing each custom element module before its
          tag appears in the DOM.
        </li>
        <li>
          Write Dathra JSX with platform attribute names such as <code>class</code> and event props
          such as <code>onClick</code>.
        </li>
      </ul>

      <h2>What Stays the Same</h2>
      <ul>
        <li>
          Components are defined with <code>defineComponent()</code>
        </li>
        <li>
          Props are exposed as reactive signals via <code>props.foo.value</code>
        </li>
        <li>
          Styles live in Shadow DOM via <code>styles</code> / <code>css</code>
        </li>
        <li>The same custom element can be used in both CSR and SSR flows</li>
      </ul>

      <h2>Project Shape</h2>
      <p>
        The docs app in this repository follows the SSR shape: a root custom element, a server entry
        that renders that element, and a client entry that registers components before calling{" "}
        <code>hydrate(document)</code>.
      </p>
      <ul>
        <li>
          <code>src/DocsAppRoot.tsx</code> defines the root Web Component
        </li>
        <li>
          <code>src/entry-server.tsx</code> renders the root component to DSD
        </li>
        <li>
          <code>src/entry-client.ts</code> binds client state and hydrates
        </li>
        <li>
          <code>vite.config.ts</code> installs the Dathra Vite plugin in SSR mode
        </li>
      </ul>

      <h2>Next Steps</h2>
      <p>
        After the first app runs, use the concept docs to understand the primitives behind the quick
        starts:
      </p>
      <ul>
        <li>
          <a href="/reactivity">Reactivity</a> explains signals, computed values, effects, and root
          cleanup.
        </li>
        <li>
          <a href="/runtime">Runtime</a> explains DOM insertion, text, attrs, events, SSR, and
          hydration primitives.
        </li>
        <li>
          <a href="/plugin">Build Plugin</a> explains how Vite and other build tools run the Dathra
          transformer.
        </li>
      </ul>
    </section>
  );
}

export { GettingStartedPage };
