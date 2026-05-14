import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import { pageStyles } from "../routeStyles";

const FocusReplayFixture = defineComponent(
  "e2e-focus-replay-fixture",
  ({ client }) => {
    const focusCount = signal(0);

    return (
      <article>
        <p class="meta-chip">interaction:onFocus</p>
        <p>
          Strategy:{" "}
          <strong data-testid="focus-strategy">
            {client.strategy ?? "none"}
          </strong>
        </p>
        <input
          data-testid="focus-trigger"
          type="text"
          placeholder="Focus me"
          // @ts-expect-error interaction directives are transformer-only today
          interaction:onFocus={() => {
            focusCount.set(focusCount.value + 1);
          }}
        />
        <p>
          Focus count:{" "}
          <strong data-testid="focus-count">{focusCount.value}</strong>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

const PointerReplayFixture = defineComponent(
  "e2e-pointer-replay-fixture",
  ({ client }) => {
    const pointerCount = signal(0);
    const lastPointerType = signal("none");

    return (
      <article>
        <p class="meta-chip">interaction:onPointerDown</p>
        <p>
          Strategy:{" "}
          <strong data-testid="pointer-strategy">
            {client.strategy ?? "none"}
          </strong>
        </p>
        <button
          data-testid="pointer-trigger"
          type="button"
          // @ts-expect-error interaction directives are transformer-only today
          interaction:onPointerDown={(event: PointerEvent) => {
            pointerCount.set(pointerCount.value + 1);
            lastPointerType.set(event.pointerType || "unknown");
          }}
        >
          Pointer down to hydrate
        </button>
        <p>
          Pointer count:{" "}
          <strong data-testid="pointer-count">{pointerCount.value}</strong>
        </p>
        <p>
          Last pointer:{" "}
          <strong data-testid="pointer-type">{lastPointerType.value}</strong>
        </p>
      </article>
    );
  },
  {
    styles: [pageStyles],
  },
);

function EventReplayRoute() {
  return (
    <main>
      <FocusReplayFixture />
      <PointerReplayFixture />
    </main>
  );
}

export { EventReplayRoute };
