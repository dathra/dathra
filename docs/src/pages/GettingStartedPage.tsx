function GettingStartedPage() {
  return (
    <section>
      <h1>Getting Started</h1>
      <p>
        Dathra apps are built around custom elements created with <code>defineComponent()</code>.
        Start with CSR if you only need a browser-rendered app, or use SSR when you want the server
        to emit Declarative Shadow DOM before hydration.
      </p>

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
    </section>
  );
}

export { GettingStartedPage };
