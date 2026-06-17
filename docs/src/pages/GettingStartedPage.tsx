function GettingStartedPage() {
  return (
    <section>
      <h1>Getting Started</h1>
      <p>
        Dathra apps are built around Web Components. Pick the setup that matches
        your rendering model:
      </p>

      <div class="feature-grid">
        <article class="feature-card">
          <h3>CSR Quick Start</h3>
          <p>
            Register a custom element in JavaScript and place the tag directly
            in HTML. This is the simplest way to ship a client-only app.
          </p>
          <p>
            <a href="/getting-started-csr">Open CSR guide</a>
          </p>
        </article>

        <article class="feature-card">
          <h3>SSR Quick Start</h3>
          <p>
            Render Declarative Shadow DOM on the server and hydrate the same
            custom element on the client.
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
        <li>
          The same custom element can be used in both CSR and SSR flows
        </li>
      </ul>
    </section>
  );
}

export { GettingStartedPage };
