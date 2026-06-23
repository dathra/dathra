import { DocCodeBlock } from "../components/DocCodeBlock";

function TransformerPage() {
  return (
    <section>
      <h1>JSX Transformer</h1>
      <p>
        <code>@dathra/transformer</code> is a custom JSX/TSX compiler that transforms JSX into
        efficient DOM or SSR render calls. It uses
        <code>oxc-parser</code> for parsing, <code>zimmerframe</code> for AST walking, and{" "}
        <code>esrap</code> for code generation.
      </p>
      <p>
        Transformer APIs are for build-tool integrations and Dathra contributors. For exact
        signatures, see the <a href="/reference/transformer">Transformer API Reference</a>.
      </p>

      <h2>Usage</h2>
      <DocCodeBlock language="ts">{`import { transform } from "@dathra/transformer";

const result = transform({
  code: "const el = <div>Hello</div>;",
  mode: "csr",
});`}</DocCodeBlock>

      <h2>Modes</h2>
      <ul>
        <li>
          <strong>CSR mode</strong> — Generates client-side rendering code using the DOM runtime
        </li>
        <li>
          <strong>SSR mode</strong> — Generates server-side rendering code that produces HTML
          strings with hydration markers
        </li>
      </ul>

      <h2>Features</h2>
      <ul>
        <li>JSX element and component transformation</li>
        <li>Static tree optimization — hoists static trees to module scope</li>
        <li>Runtime import injection</li>
        <li>Collision-safe variable renaming</li>
        <li>
          Client directive (<code>client:*</code>) normalization
        </li>
        <li>Branching flattening for conditional rendering</li>
        <li>Helper inlining for frequently used patterns</li>
      </ul>

      <h2>Architecture</h2>
      <p>The compiler pipeline:</p>
      <ol>
        <li>
          <strong>Parse</strong> — oxc-parser produces an AST
        </li>
        <li>
          <strong>Transform</strong> — Walk the AST and replace JSX with runtime calls
        </li>
        <li>
          <strong>Generate</strong> — esrap produces the final code string
        </li>
        <li>
          <strong>Inject</strong> — Add runtime import statements
        </li>
      </ol>
    </section>
  );
}

export { TransformerPage };
