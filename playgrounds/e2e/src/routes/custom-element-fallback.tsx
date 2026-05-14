import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const CustomElementFallbackFixture = defineComponent(
  "e2e-custom-element-fallback-fixture",
  () => {
    const count = signal(0);

    return (
      <article>
        <p class="meta-chip">custom element fallback</p>
        <h2>Custom element SSR fallback fixture</h2>
        <demo-counter-box
          data-testid="custom-element-host"
          data-count={String(count.value)}
        >
          <span data-testid="custom-element-label">
            Fallback count {count.value}
          </span>
        </demo-counter-box>
        <button
          type="button"
          data-testid="custom-element-increment"
          onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Increment fallback count
        </button>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function CustomElementFallbackRoute() {
  return (
    <main>
      <CustomElementFallbackFixture />
    </main>
  );
}

export { CustomElementFallbackRoute };
