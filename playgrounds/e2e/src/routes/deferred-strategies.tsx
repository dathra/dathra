import { defineComponent } from "@dathra/components";
import { onCleanup } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const DeferredStrategyIsland = defineComponent(
  "e2e-deferred-strategy-island",
  ({ props }) => {
    return (
      <article>
        <p class="meta-chip">{props.strategyLabel.value}</p>
        <h3>{props.title.value}</h3>
        <p data-testid={props.statusTestId.value}>waiting</p>
      </article>
    );
  },
  {
    styles: [pageStyles],
    hydrate: ({ host }) => {
      const shadowRoot = host.shadowRoot;
      if (shadowRoot === null) {
        return;
      }

      const statusNode = shadowRoot.querySelector("[data-testid]");
      if (!(statusNode instanceof HTMLElement)) {
        return;
      }

      const strategy = host.getAttribute("data-dh-island") ?? "unknown";
      statusNode.textContent = `ready:${strategy}`;
      onCleanup(() => {
        statusNode.textContent = `disposed:${strategy}`;
      });
    },
    props: {
      title: { type: String, default: "Deferred strategy" },
      strategyLabel: { type: String, default: "client:load" },
      statusTestId: { type: String, default: "deferred-status" },
    },
  },
);

function DeferredStrategiesRoute() {
  return (
    <main>
      <DeferredStrategyIsland
        client:idle
        title="Idle fixture"
        strategyLabel="client:idle"
        statusTestId="idle-status"
      />
      <div style="height: 48px" aria-hidden="true"></div>
      <DeferredStrategyIsland
        client:media="(max-width: 800px)"
        title="Media fixture"
        strategyLabel="client:media"
        statusTestId="media-status"
      />
      <div style="height: 80vh" aria-hidden="true"></div>
      <DeferredStrategyIsland
        client:visible
        title="Visible fixture"
        strategyLabel="client:visible"
        statusTestId="visible-status"
      />
    </main>
  );
}

export { DeferredStrategiesRoute };
