import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const AttrSpreadHydrationFixture = defineComponent(
  "e2e-attr-spread-hydration-fixture",
  () => {
    const armed = signal(false);

    return (
      <article
        data-testid="attr-spread-target"
        class={armed.value ? "mode-armed" : "mode-idle"}
        {...(armed.value
          ? {
              "data-state": "armed",
              title: "armed",
              "aria-busy": "true",
            }
          : {
              "data-state": "idle",
              title: "idle",
              "aria-busy": "false",
            })}
      >
        <p class="meta-chip">dynamic attr + spread</p>
        <h2>Attr and spread hydration fixture</h2>
        <button
          type="button"
          data-testid="attr-spread-toggle"
          onClick={() => {
            armed.set(!armed.value);
          }}
        >
          Toggle attrs
        </button>
        <p>
          Current state:{" "}
          <strong data-testid="attr-spread-state">
            {armed.value ? "armed" : "idle"}
          </strong>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function AttrSpreadHydrationRoute() {
  return (
    <main>
      <AttrSpreadHydrationFixture />
    </main>
  );
}

export { AttrSpreadHydrationRoute };
