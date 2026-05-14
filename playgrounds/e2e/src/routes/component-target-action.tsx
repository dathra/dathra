import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const componentTargetActionCount = signal(0);

function incrementComponentTargetActionCount() {
  componentTargetActionCount.set(componentTargetActionCount.value + 1);
}

const ComponentTargetButton = defineComponent(
  "e2e-component-target-button",
  () => {
    return (
      <button type="button" data-testid="component-target-trigger">
        Click inside child shadow root
      </button>
    );
  },
  {
    styles: [pageStyles],
  },
);

const ComponentTargetActionFixture = defineComponent(
  "e2e-component-target-action-fixture",
  ({ client }) => {
    return (
      <article>
        <p class="meta-chip">component target interaction:onClick</p>
        <h2>Component target action fixture</h2>
        <p>
          Active strategy in setup:{" "}
          <strong data-testid="component-target-strategy">
            {client.strategy ?? "none"}
          </strong>
        </p>
        {/* TypeScript does not model component-target directives yet, but the transformer does. */}
        <ComponentTargetButton
          // @ts-expect-error component-target interaction directives are transformer-only today
          interaction:onClick={() => incrementComponentTargetActionCount()}
        />
        <p>
          Component target count:{" "}
          <strong data-testid="component-target-count">
            {componentTargetActionCount.value}
          </strong>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function ComponentTargetActionRoute() {
  return (
    <main>
      <ComponentTargetActionFixture />
    </main>
  );
}

export { ComponentTargetActionRoute };
