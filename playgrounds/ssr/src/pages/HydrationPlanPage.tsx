import { css, defineComponent } from "@dathra/components";
import { onCleanup, signal } from "@dathra/core";

const pageStyles = css`
  :host {
    display: block;
  }

  section {
    margin-bottom: 32px;
  }

  section h2 {
    margin-bottom: 12px;
    color: #1a3a2a;
  }

  section > p {
    margin-bottom: 16px;
    color: #3a4a42;
    line-height: 1.6;
  }

  code {
    background: rgba(33, 71, 60, 0.08);
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 0.9em;
  }

  .demo-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
    gap: 20px;
  }
`;

const cardStyles = css`
  article {
    display: grid;
    gap: 12px;
    padding: 20px;
    border-radius: 16px;
    border: 1px solid rgba(33, 71, 60, 0.12);
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.96),
      rgba(239, 246, 241, 0.88)
    );
    box-shadow: 0 8px 24px rgba(23, 49, 39, 0.06);
  }

  article h3 {
    margin: 0;
    color: #1a3a2a;
  }

  article p {
    margin: 0;
    color: #3a4a42;
    line-height: 1.5;
  }

  .badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 0.75rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    width: fit-content;
  }

  .badge-path-a {
    background: rgba(16, 185, 129, 0.12);
    color: #065f46;
  }

  .badge-path-b {
    background: rgba(245, 158, 11, 0.12);
    color: #92400e;
  }

  .badge-guard {
    background: rgba(239, 68, 68, 0.12);
    color: #991b1b;
  }

  .counter-row {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .counter-value {
    font-size: 1.5rem;
    font-weight: 700;
    color: #0f5b3a;
    min-width: 2ch;
  }

  button {
    justify-self: start;
  }

  .status-text {
    font-size: 0.85rem;
    color: #6b7c74;
  }
`;

const codeBlockStyles = css`
  pre {
    margin: 0;
    padding: 16px;
    border-radius: 12px;
    background: #1e293b;
    color: #e2e8f0;
    font-size: 0.82rem;
    line-height: 1.6;
    overflow-x: auto;
  }

  pre code {
    background: none;
    padding: 0;
    color: inherit;
  }

  .keyword {
    color: #c084fc;
  }
  .string {
    color: #86efac;
  }
  .comment {
    color: #64748b;
  }
  .function {
    color: #67e8f9;
  }
`;

/**
 * Demonstrates planFactory generation (Path A).
 * This component has a static render body that the transformer
 * can analyze and generate an in-place hydration plan for.
 */
const PathACounter = defineComponent(
  "path-a-counter",
  ({ props }) => {
    const count = signal(0);
    const hydrated = signal(false);

    return (
      <article>
        <p class="badge badge-path-a">Path A — planFactory</p>
        <h3>{props.title.value}</h3>
        <p>{props.description.value}</p>
        <p class="status-text">
          Hydrated: <strong>{hydrated.value ? "Yes (in-place)" : "No"}</strong>
        </p>
        <div class="counter-row">
          <button
            type="button"
            onClick={() => {
              count.set(count.value + 1);
              hydrated.set(true);
            }}
          >
            Increment
          </button>
          <span class="counter-value">{count.value}</span>
        </div>
      </article>
    );
  },
  {
    styles: [cardStyles],
    props: {
      title: { type: String, default: "Static counter" },
      description: {
        type: String,
        default: "Generates planFactory — preserves SSR DOM.",
      },
    },
  },
);

/**
 * Demonstrates colocated directive support (Path A with colocated handlers).
 * The transformer generates a planFactory that includes the colocated click handler.
 */
const PathAColocatedCard = defineComponent(
  "path-a-colocated-card",
  () => {
    const count = signal(0);

    return (
      <article>
        <p class="badge badge-path-a">Path A — colocated</p>
        <h3>Colocated click handler</h3>
        <p>
          The <code>load:onClick</code> directive stays next to the button
          markup. The transformer generates a planFactory that wires this
          handler during in-place hydration.
        </p>
        <div class="counter-row">
          <button
            type="button"
            load:onClick={() => {
              count.set(count.value + 1);
            }}
          >
            Click after load
          </button>
          <span class="counter-value">{count.value}</span>
        </div>
      </article>
    );
  },
  {
    styles: [cardStyles],
  },
);

/**
 * Demonstrates a component that triggers the unsupported + colocated guard.
 * This component uses runtime branching (if statement), which prevents
 * planFactory generation. Combined with a colocated directive, this would
 * throw a compile-time error.
 *
 * NOTE: This component is NOT rendered — it's shown as a code example only.
 * If we tried to render it, the transform would fail.
 */
function UnsupportedColocatedExample() {
  return (
    <article>
      <p class="badge badge-guard">Compile guard</p>
      <h3>Unsupported + colocated → transform error</h3>
      <p>
        This pattern throws at compile time. The transformer detects that the
        component cannot generate a planFactory (due to runtime branching) and
        also contains a colocated directive — which would silently lose SSR
        state on the fallback rerender.
      </p>
      <pre>
        <code>
          {`const Comp = defineComponent("x-comp", () => {
  const count = signal(0);
  // runtime branching prevents planFactory
  if (someCondition) {
    return <div>Branch A</div>;
  }
  return (
    <div>
      <span>{count.value}</span>
      {/* colocated directive on unsupported → ERROR */}
      <button load:onClick={() => count.set(count.value + 1)}>
        Click
      </button>
    </div>
  );
});`}
        </code>
      </pre>
      <p class="status-text">
        Error:{" "}
        <code>
          Colocated client directives cannot be used in a component whose setup
          is unsupported for hydration plan generation
        </code>
      </p>
    </article>
  );
}

/**
 * Demonstrates the nested islands pattern that works with planFactory.
 * The outer component generates a plan, and the inner component is tracked
 * as a nested boundary.
 */
const NestedIslandsDemo = defineComponent(
  "nested-islands-demo",
  ({ props }) => {
    const outerCount = signal(0);

    return (
      <article>
        <p class="badge badge-path-a">Path A — nested boundaries</p>
        <h3>Nested islands with planFactory</h3>
        <p>{props.description.value}</p>
        <div class="counter-row">
          <button
            type="button"
            onClick={() => {
              outerCount.set(outerCount.value + 1);
            }}
          >
            Outer: {outerCount.value}
          </button>
        </div>
        <InnerIsland client:load />
      </article>
    );
  },
  {
    styles: [cardStyles],
    props: {
      description: {
        type: String,
        default:
          "Outer generates planFactory; inner is tracked as nested boundary.",
      },
    },
  },
);

const InnerIsland = defineComponent(
  "nested-inner-island",
  () => {
    const innerCount = signal(0);

    return (
      <div style="padding: 12px; border-radius: 8px; background: rgba(255,255,255,0.6);">
        <p style="margin: 0 0 8px; font-size: 0.85rem; color: #6b7c74;">
          Inner island (client:load)
        </p>
        <div class="counter-row">
          <button
            type="button"
            onClick={() => {
              innerCount.set(innerCount.value + 1);
            }}
          >
            Inner: {innerCount.value}
          </button>
        </div>
      </div>
    );
  },
  {
    styles: [cardStyles],
  },
);

/**
 * Demonstrates dispatch plan with if/else branching.
 * The transformer generates separate planFactories for each branch.
 */
const DispatchIfElseCounter = defineComponent(
  "dispatch-if-else-counter",
  ({ props }) => {
    const count = signal(0);

    if (props.mode.value === "primary") {
      return (
        <article>
          <p class="badge badge-path-a">dispatch — if/else</p>
          <h3>Primary mode</h3>
          <p>
            The transformer generates independent planFactories for both
            branches. Hydration evaluates the condition and applies the matching
            plan in-place.
          </p>
          <div class="counter-row">
            <button
              type="button"
              onClick={() => {
                count.set(count.value + 1);
              }}
            >
              Increment
            </button>
            <span class="counter-value">{count.value}</span>
          </div>
        </article>
      );
    } else {
      return (
        <article>
          <p class="badge badge-path-a">dispatch — if/else</p>
          <h3>Secondary mode</h3>
          <p>
            Same component, different JSX structure. Both branches get their own
            planFactory with unique shapeHash values.
          </p>
          <div class="counter-row">
            <button
              type="button"
              onClick={() => {
                count.set(count.value + 1);
              }}
            >
              Increment
            </button>
            <span class="counter-value">{count.value}</span>
          </div>
        </article>
      );
    }
  },
  {
    styles: [cardStyles],
    props: {
      mode: { type: String, default: "primary" },
    },
  },
);

/**
 * Demonstrates dispatch plan with nested if branching.
 * Three branches flattened into a linear condition list.
 */
const DispatchNestedIfCounter = defineComponent(
  "dispatch-nested-if-counter",
  ({ props }) => {
    const count = signal(0);

    if (props.level.value === "high") {
      return (
        <article>
          <p class="badge badge-path-a">dispatch — nested if (high)</p>
          <h3>High priority</h3>
          <p>
            Nested if conditions are flattened into a linear dispatch list.
            Branch conditions are AND-combined: <code>level === "high"</code>.
          </p>
          <div class="counter-row">
            <button
              type="button"
              onClick={() => {
                count.set(count.value + 1);
              }}
            >
              Increment
            </button>
            <span class="counter-value">{count.value}</span>
          </div>
        </article>
      );
    }
    if (props.level.value === "medium") {
      return (
        <article>
          <p class="badge badge-path-a">dispatch — nested if (medium)</p>
          <h3>Medium priority</h3>
          <p>
            Second branch: <code>level === "medium"</code>. The transformer
            generates three independent planFactories for this component.
          </p>
          <div class="counter-row">
            <button
              type="button"
              onClick={() => {
                count.set(count.value + 1);
              }}
            >
              Increment
            </button>
            <span class="counter-value">{count.value}</span>
          </div>
        </article>
      );
    }
    return (
      <article>
        <p class="badge badge-path-a">dispatch — nested if (low)</p>
        <h3>Low priority</h3>
        <p>
          Default branch (no condition). Falls through when neither high nor
          medium matches.
        </p>
        <div class="counter-row">
          <button
            type="button"
            onClick={() => {
              count.set(count.value + 1);
            }}
          >
            Increment
          </button>
          <span class="counter-value">{count.value}</span>
        </div>
      </article>
    );
  },
  {
    styles: [cardStyles],
    props: {
      level: { type: String, default: "high" },
    },
  },
);

/**
 * Demonstrates dispatch plan with switch statement.
 * Each case becomes a separate branch with === comparison.
 */
const DispatchSwitchCounter = defineComponent(
  "dispatch-switch-counter",
  ({ props }) => {
    const count = signal(0);

    switch (props.variant.value) {
      case "alpha":
        return (
          <article>
            <p class="badge badge-path-a">dispatch — switch (alpha)</p>
            <h3>Alpha variant</h3>
            <p>
              Switch statements are flattened into dispatch branches. Each case
              generates a <code>discriminant === value</code> condition.
            </p>
            <div class="counter-row">
              <button
                type="button"
                onClick={() => {
                  count.set(count.value + 1);
                }}
              >
                Increment
              </button>
              <span class="counter-value">{count.value}</span>
            </div>
          </article>
        );
      case "beta":
        return (
          <article>
            <p class="badge badge-path-a">dispatch — switch (beta)</p>
            <h3>Beta variant</h3>
            <p>
              Different JSX structure, same counter logic. Each variant gets its
              own planFactory with independent bindings.
            </p>
            <div class="counter-row">
              <button
                type="button"
                onClick={() => {
                  count.set(count.value + 1);
                }}
              >
                Increment
              </button>
              <span class="counter-value">{count.value}</span>
            </div>
          </article>
        );
      default:
        return (
          <article>
            <p class="badge badge-path-a">dispatch — switch (default)</p>
            <h3>Default variant</h3>
            <p>
              The default case becomes the fallback branch with no condition
              (always matches if earlier cases don't).
            </p>
            <div class="counter-row">
              <button
                type="button"
                onClick={() => {
                  count.set(count.value + 1);
                }}
              >
                Increment
              </button>
              <span class="counter-value">{count.value}</span>
            </div>
          </article>
        );
    }
  },
  {
    styles: [cardStyles],
    props: {
      variant: { type: String, default: "alpha" },
    },
  },
);

/**
 * Demonstrates dispatch plan with ternary expression.
 * Direct ternary body is also flattened into dispatch branches.
 */
const DispatchTernaryCounter = defineComponent(
  "dispatch-ternary-counter",
  ({ props }) => {
    const count = signal(0);
    const showDetails = props.showDetails.value === "true";

    return showDetails ? (
      <article>
        <p class="badge badge-path-a">dispatch — ternary (details)</p>
        <h3>Detailed view</h3>
        <p>
          Ternary expressions in the return position are also flattened into
          dispatch branches. The condition <code>showDetails</code> determines
          which planFactory applies.
        </p>
        <div class="counter-row">
          <button
            type="button"
            onClick={() => {
              count.set(count.value + 1);
            }}
          >
            Increment
          </button>
          <span class="counter-value">{count.value}</span>
        </div>
      </article>
    ) : (
      <article>
        <p class="badge badge-path-a">dispatch — ternary (compact)</p>
        <h3>Compact view</h3>
        <p>
          Compact variant with fewer elements. Different shapeHash from the
          detailed branch, but same counter logic.
        </p>
        <div class="counter-row">
          <button
            type="button"
            onClick={() => {
              count.set(count.value + 1);
            }}
          >
            Increment
          </button>
          <span class="counter-value">{count.value}</span>
        </div>
      </article>
    );
  },
  {
    styles: [cardStyles],
    props: {
      showDetails: { type: String, default: "true" },
    },
  },
);

function HydrationPlanPage() {
  return (
    <>
      <section>
        <h2>Hydration Plan Generation</h2>
        <p>
          This page demonstrates the hydration paths the transformer generates:
        </p>
        <ul>
          <li>
            <strong>Path A (planFactory)</strong> — Static JSX generates a
            single planFactory. SSR DOM is preserved; setup is not re-executed.
          </li>
          <li>
            <strong>Path A (dispatch)</strong> — Branching patterns (if/else,
            nested if, switch, ternary) generate multiple planFactories. The
            condition is evaluated at hydration time and the matching plan
            applies in-place.
          </li>
          <li>
            <strong>Path B (fallback rerender)</strong> — Patterns the
            transformer cannot analyze (try/catch, loops, imperative DOM) fall
            back to full rerender.
          </li>
        </ul>
        <p>
          The <strong>compile-time guard</strong> throws a transform error when
          an unsupported pattern is combined with colocated client directives
          (e.g., <code>load:onClick</code>), preventing silent SSR state loss.
        </p>
      </section>

      <section>
        <h2>Path A: planFactory (static JSX)</h2>
        <p>
          These components have static render bodies that the transformer can
          fully analyze. The generated <code>planFactory</code> binds to the
          existing SSR DOM without re-executing setup.
        </p>
        <div class="demo-grid">
          <PathACounter
            title="Basic counter"
            description="Static JSX — generates planFactory. Click to verify in-place hydration."
          />
          <PathAColocatedCard />
        </div>
      </section>

      <section>
        <h2>Path A: dispatch (if/else)</h2>
        <p>
          Two-branch if/else generates independent planFactories for each
          branch. The condition is evaluated at hydration time; the matching
          plan applies in-place.
        </p>
        <div class="demo-grid">
          <DispatchIfElseCounter mode="primary" />
          <DispatchIfElseCounter mode="secondary" />
        </div>
      </section>

      <section>
        <h2>Path A: dispatch (nested if)</h2>
        <p>
          Nested if conditions are flattened into a linear dispatch list with
          AND-combined conditions. Three branches: <code>level === "high"</code>
          , <code>level === "medium"</code>, and default.
        </p>
        <div class="demo-grid">
          <DispatchNestedIfCounter level="high" />
          <DispatchNestedIfCounter level="medium" />
          <DispatchNestedIfCounter level="low" />
        </div>
      </section>

      <section>
        <h2>Path A: dispatch (switch)</h2>
        <p>
          Switch statements are flattened into dispatch branches. Each case
          generates a<code>discriminant === value</code> condition; the default
          case becomes the fallback.
        </p>
        <div class="demo-grid">
          <DispatchSwitchCounter variant="alpha" />
          <DispatchSwitchCounter variant="beta" />
          <DispatchSwitchCounter variant="gamma" />
        </div>
      </section>

      <section>
        <h2>Path A: dispatch (ternary)</h2>
        <p>
          Ternary expressions in the return position are also flattened into
          dispatch branches. Direct body ternaries (
          <code>cond ? &lt;A/&gt; : &lt;B/&gt;</code>) are supported too.
        </p>
        <div class="demo-grid">
          <DispatchTernaryCounter showDetails="true" />
          <DispatchTernaryCounter showDetails="false" />
        </div>
      </section>

      <section>
        <h2>Path A: Nested islands</h2>
        <p>
          The outer component generates a planFactory while tracking the inner{" "}
          <code>client:load</code>
          component as a nested boundary. The inner island hydrates
          independently.
        </p>
        <div class="demo-grid">
          <NestedIslandsDemo description="Outer planFactory + inner client:load boundary." />
        </div>
      </section>

      <section>
        <h2>Compile-time guard: unsupported + colocated</h2>
        <p>
          This guard prevents a subtle bug: when a component falls back to Path
          B (full rerender), any colocated directive handlers would be attached
          to the SSR DOM that gets destroyed. The transformer catches this at
          compile time instead of letting it fail silently.
        </p>
        <div class="demo-grid">
          <UnsupportedColocatedExample />
        </div>
      </section>

      <section>
        <h2>What patterns trigger Path B?</h2>
        <p>The transformer marks a component as unsupported when it detects:</p>
        <div class="demo-grid">
          <article>
            <p class="badge badge-path-b">imperative-dom-query</p>
            <h3>Imperative DOM access</h3>
            <p>
              References to <code>document</code>, <code>window</code>,{" "}
              <code>host</code>, or
              <code>shadowRoot</code> in the render body.
            </p>
          </article>
          <article>
            <p class="badge badge-path-b">node-identity-reuse</p>
            <h3>Node identity creation</h3>
            <p>
              Direct calls to <code>document.createElement</code>,{" "}
              <code>new Text()</code>, etc. that reuse node identities across
              renders.
            </p>
          </article>
          <article>
            <p class="badge badge-path-b">opaque-helper-call</p>
            <h3>Opaque helper returns</h3>
            <p>
              Returning the result of a function call that the transformer
              cannot trace through (not in the known transparent thunk wrappers
              list).
            </p>
          </article>
          <article>
            <p class="badge badge-path-b">unsupported-component-body</p>
            <h3>Unsupported body patterns</h3>
            <p>
              <code>try/catch</code>, <code>for</code>/<code>while</code> loops,
              <code>async</code> functions, and generator functions.
            </p>
          </article>
        </div>
      </section>
    </>
  );
}

export { HydrationPlanPage };
