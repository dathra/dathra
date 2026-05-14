import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const componentTargetKeyCount = signal(0);
const componentTargetLastKey = signal("-");

function recordComponentTargetKey(event: Event) {
  const key = event instanceof KeyboardEvent ? event.key : "unknown";
  componentTargetKeyCount.set(componentTargetKeyCount.value + 1);
  componentTargetLastKey.set(key);
}

const ComponentTargetInput = defineComponent(
  "e2e-component-target-input",
  () => {
    return (
      <input
        type="text"
        placeholder="Press Enter in child"
        data-testid="component-target-key-input"
      />
    );
  },
  {
    styles: [pageStyles],
  },
);

const ComponentTargetKeydownFixture = defineComponent(
  "e2e-component-target-keydown-fixture",
  () => {
    return (
      <article>
        <p class="meta-chip">component target interaction:onKeyDown</p>
        <h2>Component target keydown fixture</h2>
        {/* TypeScript does not model component-target directives yet, but the transformer does. */}
        <ComponentTargetInput
          // @ts-expect-error component-target interaction directives are transformer-only today
          interaction:onKeyDown={(event) => recordComponentTargetKey(event)}
        />
        <p>
          Key count:{" "}
          <strong data-testid="component-target-key-count">
            {componentTargetKeyCount.value}
          </strong>
        </p>
        <p>
          Last key:{" "}
          <strong data-testid="component-target-last-key">
            {componentTargetLastKey.value}
          </strong>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function ComponentTargetKeydownRoute() {
  return (
    <main>
      <ComponentTargetKeydownFixture />
    </main>
  );
}

export { ComponentTargetKeydownRoute };
