import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const NestedBoundaryInner = defineComponent(
  "e2e-nested-boundary-inner",
  () => {
    const count = signal(0);

    return (
      <article>
        <p class="meta-chip">client:load</p>
        <h3>Nested child island</h3>
        <button
          type="button"
          data-testid="nested-inner-button"
          onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Increment nested child
        </button>
        <p>
          Nested child count:{" "}
          <strong data-testid="nested-inner-count">{count.value}</strong>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

const NestedBoundaryOuter = defineComponent(
  "e2e-nested-boundary-outer",
  () => {
    const outerCount = signal(0);

    return (
      <article>
        <p class="meta-chip">planFactory + nested boundary</p>
        <h2>Nested boundary fixture</h2>
        <button
          type="button"
          data-testid="nested-outer-button"
          onClick={() => {
            outerCount.set(outerCount.value + 1);
          }}
        >
          Increment outer
        </button>
        <p>
          Outer count:{" "}
          <strong data-testid="nested-outer-count">{outerCount.value}</strong>
        </p>
        <NestedBoundaryInner client:load />
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function NestedBoundaryRoute() {
  return (
    <main>
      <NestedBoundaryOuter />
    </main>
  );
}

export { NestedBoundaryRoute };
