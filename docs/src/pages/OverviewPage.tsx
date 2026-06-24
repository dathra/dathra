function OverviewPage() {
  return (
    <section>
      <h1>Dathra</h1>
      <p>
        Dathra is a web framework built around <strong>Web Components</strong>,{" "}
        <strong>Signals</strong>, and server-rendered Declarative Shadow DOM. It is designed for
        apps that want framework-level ergonomics without giving up the platform primitives that
        browsers already understand.
      </p>
      <p>
        These docs are also a Dathra app: the shell is a custom element rendered on the server with{" "}
        <code>@dathra/core/ssr</code>, hydrated on the client with{" "}
        <code>@dathra/core/hydration</code>, and styled inside Shadow DOM.
      </p>

      <div class="callout-card">
        <h2>Start Here</h2>
        <p>
          Choose the rendering path first. CSR is the fastest way to try Dathra in a browser-only
          app. SSR adds server-rendered Declarative Shadow DOM, request state, and hydration.
        </p>
        <div class="action-row">
          <a class="action-link" href="/getting-started-csr">
            Build a CSR app
          </a>
          <a class="action-link" href="/getting-started-ssr">
            Build an SSR app
          </a>
        </div>
      </div>

      <div class="feature-grid">
        <article class="feature-card">
          <h3>Reactive by default</h3>
          <p>
            Fine-grained reactivity with <code>signal()</code>, <code>computed()</code>, and{" "}
            <code>effect()</code>. No virtual DOM.
          </p>
        </article>
        <article class="feature-card">
          <h3>Web Components</h3>
          <p>
            Define custom elements with Shadow DOM, reactive props, and Declarative Shadow DOM
            output for SSR.
          </p>
        </article>
        <article class="feature-card">
          <h3>SSR + Hydration</h3>
          <p>
            Server-side render with islands architecture, progressive hydration, and interaction
            replay.
          </p>
        </article>
        <article class="feature-card">
          <h3>Atomic Store</h3>
          <p>
            Recoil/Jotai-inspired atom-based state management with store boundaries and
            AsyncLocalStorage support.
          </p>
        </article>
        <article class="feature-card">
          <h3>JSX Compiler</h3>
          <p>
            Custom JSX/TSX transformer (oxc-parser + esrap) with CSR and SSR code generation modes.
          </p>
        </article>
        <article class="feature-card">
          <h3>Build Plugins</h3>
          <p>Vite, Webpack, Rollup, and esbuild plugins via unplugin.</p>
        </article>
      </div>

      <h2>When to Use Dathra</h2>
      <ul>
        <li>
          You want components that ship as standard custom elements instead of framework-private
          component instances.
        </li>
        <li>You want fine-grained updates through signals rather than virtual DOM re-rendering.</li>
        <li>
          You need SSR output that preserves Shadow DOM boundaries through Declarative Shadow DOM.
        </li>
        <li>
          You want islands-style hydration for interactive parts of an otherwise server-rendered
          page.
        </li>
      </ul>

      <h2>Recommended Reading Order</h2>
      <ol>
        <li>
          Read <a href="/getting-started">Getting Started</a> to choose between CSR and SSR.
        </li>
        <li>
          Learn <a href="/reactivity">Reactivity</a> before writing component state.
        </li>
        <li>
          Read <a href="/components">Components</a> to define custom elements and props.
        </li>
        <li>
          Use the <a href="/reference/reactivity">API Reference</a> when you need exact signatures.
        </li>
      </ol>

      <h2>Architecture</h2>
      <p>Dathra is organized as a monorepo with eight packages:</p>
      <ul>
        <li>
          <strong>@dathra/reactivity</strong> — Core signals, computed, effects, batching, root
          lifecycle
        </li>
        <li>
          <strong>@dathra/components</strong> — <code>defineComponent()</code>, CSS helpers,
          registry, SSR rendering for Web Components
        </li>
        <li>
          <strong>@dathra/runtime</strong> — DOM manipulation, SSR rendering primitives, hydration
          engine, reconciliation
        </li>
        <li>
          <strong>@dathra/store</strong> — Atomic state management with
          <code>atom()</code>, <code>createAtomStore()</code>, <code>withStore()</code>
        </li>
        <li>
          <strong>@dathra/transformer</strong> — JSX/TSX compiler (CSR + SSR modes)
        </li>
        <li>
          <strong>@dathra/plugin</strong> — Build tool plugins (Vite, Webpack, Rollup, esbuild)
        </li>
        <li>
          <strong>@dathra/shared</strong> — Shared utilities (typed entries/fromEntries, string case
          conversion, islands contract)
        </li>
        <li>
          <strong>@dathra/core</strong> — Aggregator package re-exporting all public APIs
        </li>
      </ul>
    </section>
  );
}

export { OverviewPage };
