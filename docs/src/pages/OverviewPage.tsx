function OverviewPage() {
  return (
    <section>
      <h1>Dathra</h1>
      <p>
        A modern web framework built on <strong>Web Components</strong> and{" "}
        <strong>Signals</strong> (TC39 Signals via <code>alien-signals</code>).
      </p>

      <div class="feature-grid">
        <article class="feature-card">
          <h3>Reactive by default</h3>
          <p>
            Fine-grained reactivity with <code>signal()</code>,{" "}
            <code>computed()</code>, and <code>effect()</code>. No virtual DOM.
          </p>
        </article>
        <article class="feature-card">
          <h3>Web Components</h3>
          <p>
            Define custom elements with Shadow DOM, reactive props, and
            Declarative Shadow DOM hydration.
          </p>
        </article>
        <article class="feature-card">
          <h3>SSR + Hydration</h3>
          <p>
            Server-side render with islands architecture, progressive
            hydration, and interaction replay.
          </p>
        </article>
        <article class="feature-card">
          <h3>Atomic Store</h3>
          <p>
            Recoil/Jotai-inspired atom-based state management with store
            boundaries and AsyncLocalStorage support.
          </p>
        </article>
        <article class="feature-card">
          <h3>JSX Compiler</h3>
          <p>
            Custom JSX/TSX transformer (oxc-parser + esrap) with CSR and SSR
            code generation modes.
          </p>
        </article>
        <article class="feature-card">
          <h3>Build Plugins</h3>
          <p>
            Vite, Webpack, Rollup, and esbuild plugins via unplugin.
          </p>
        </article>
      </div>

      <h2>Architecture</h2>
      <p>
        Dathra is organized as a monorepo with eight packages:
      </p>
      <ul>
        <li>
          <strong>@dathra/reactivity</strong> — Core signals, computed, effects,
          batching, root lifecycle
        </li>
        <li>
          <strong>@dathra/components</strong> — <code>defineComponent()</code>,
          CSS helpers, registry, SSR rendering for Web Components
        </li>
        <li>
          <strong>@dathra/runtime</strong> — DOM manipulation, SSR rendering
          primitives, hydration engine, reconciliation
        </li>
        <li>
          <strong>@dathra/store</strong> — Atomic state management with
          <code>atom()</code>, <code>createAtomStore()</code>,
          <code>withStore()</code>
        </li>
        <li>
          <strong>@dathra/transformer</strong> — JSX/TSX compiler (CSR + SSR
          modes)
        </li>
        <li>
          <strong>@dathra/plugin</strong> — Build tool plugins (Vite, Webpack,
          Rollup, esbuild)
        </li>
        <li>
          <strong>@dathra/shared</strong> — Shared utilities (typed
          entries/fromEntries, string case conversion, islands contract)
        </li>
        <li>
          <strong>@dathra/core</strong> — Aggregator package re-exporting all
          public APIs
        </li>
      </ul>
    </section>
  );
}

export { OverviewPage };
