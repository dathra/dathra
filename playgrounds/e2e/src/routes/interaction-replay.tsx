import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const InteractionReplayFixture = defineComponent(
  "e2e-interaction-replay-fixture",
  ({ client }) => {
    const count = signal(0);

    return (
      <article data-testid="interaction-replay-card">
        <p class="meta-chip">interaction:onClick</p>
        <h2>Interaction replay fixture</h2>
        <p data-testid="interaction-strategy">{client.strategy ?? "none"}</p>
        <button
          type="button"
          data-testid="interaction-trigger"
          interaction:onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Replay click
        </button>
        <p>
          Count after hydration:{" "}
          <span class="count" data-testid="interaction-count">
            {count.value}
          </span>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function InteractionReplayRoute() {
  return (
    <main>
      <InteractionReplayFixture />
    </main>
  );
}

export { InteractionReplayRoute };
