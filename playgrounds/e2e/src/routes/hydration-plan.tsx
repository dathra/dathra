import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const HydrationPlanFixture = defineComponent(
  "e2e-hydration-plan-fixture",
  () => {
    const count = signal(0);
    const hydrated = signal(false);

    return (
      <article data-testid="hydration-plan-card">
        <p class="meta-chip">planFactory</p>
        <h2>Hydration plan fixture</h2>
        <p>
          Hydrated:{" "}
          <strong data-testid="hydration-status">
            {hydrated.value ? "yes" : "no"}
          </strong>
        </p>
        <div class="counter-row">
          <button
            type="button"
            data-testid="hydration-increment"
            onClick={() => {
              count.set(count.value + 1);
              hydrated.set(true);
            }}
          >
            Increment
          </button>
          <span class="counter-value" data-testid="hydration-count">
            {count.value}
          </span>
        </div>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function HydrationPlanRoute() {
  return (
    <main>
      <HydrationPlanFixture />
    </main>
  );
}

export { HydrationPlanRoute };
