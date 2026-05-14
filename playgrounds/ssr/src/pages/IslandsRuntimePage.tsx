import { css, defineComponent } from "@dathra/components";
import { onCleanup, signal } from "@dathra/core";

const islandCardStyles = css`
  :host {
    display: block;
  }

  article {
    display: grid;
    gap: 12px;
    padding: 20px;
    border: 1px solid rgba(33, 71, 60, 0.14);
    border-radius: 20px;
    background: linear-gradient(
      180deg,
      rgba(255, 255, 255, 0.92),
      rgba(239, 246, 241, 0.82)
    );
    box-shadow: 0 16px 36px rgba(23, 49, 39, 0.08);
  }

  h3,
  p {
    margin: 0;
  }

  .strategy-meta {
    display: inline-flex;
    width: fit-content;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(33, 71, 60, 0.1);
    color: #21473c;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  [data-role="status"] {
    color: #21473c;
    font-weight: 700;
  }

  .is-waiting {
    color: #8c5a18;
  }

  .is-ready {
    color: #0f5b3a;
  }

  .demo-button {
    justify-self: start;
  }

  .demo-count {
    font-weight: 700;
  }
`;

const PlaygroundHydrationIsland = defineComponent(
  "playground-hydration-island",
  ({ props }) => {
    return (
      <article>
        <p class="strategy-meta">{props.strategyLabel.value}</p>
        <h3>{props.title.value}</h3>
        <p>{props.description.value}</p>
        <p data-role="status" class="is-waiting">
          Waiting for hydration.
        </p>
        <button class="demo-button" type="button">
          Demo action
        </button>
        <p>
          Click count after hydration:{" "}
          <span class="demo-count" data-role="count">
            0
          </span>
        </p>
      </article>
    );
  },
  {
    styles: [islandCardStyles],
    hydrate: ({ host }) => {
      const shadowRoot = host.shadowRoot;
      if (shadowRoot === null) {
        return;
      }

      const strategy = host.getAttribute("data-dh-island") ?? "unknown";
      const status = shadowRoot.querySelector('[data-role="status"]');
      const countNode = shadowRoot.querySelector('[data-role="count"]');
      const button = shadowRoot.querySelector("button");

      host.setAttribute("data-hydrated", "true");
      host.setAttribute("data-hydrated-strategy", strategy);

      if (status instanceof HTMLElement) {
        status.textContent = `Hydrated on client via ${strategy}.`;
        status.className = "is-ready";
      }

      if (
        !(button instanceof HTMLButtonElement) ||
        !(countNode instanceof HTMLElement)
      ) {
        return;
      }

      let clickCount = 0;
      const onClick = () => {
        clickCount += 1;
        countNode.textContent = String(clickCount);
      };

      button.addEventListener("click", onClick);
      onCleanup(() => {
        button.removeEventListener("click", onClick);
      });
    },
    props: {
      title: { type: String, default: "Hydration island" },
      description: { type: String, default: "Strategy demo" },
      strategyLabel: { type: String, default: "client:load" },
      islandStrategy: {
        type: String,
        default: "load",
        attribute: "data-dh-island",
      },
      islandValue: {
        type: String,
        default: "",
        attribute: "data-dh-island-value",
      },
    },
  },
);

const colocatedCardStyles = css`
  :host {
    display: block;
  }

  article {
    display: grid;
    gap: 12px;
    padding: 20px;
    border: 1px solid rgba(33, 71, 60, 0.14);
    border-radius: 20px;
    background: linear-gradient(
      180deg,
      rgba(245, 251, 247, 0.96),
      rgba(233, 243, 236, 0.92)
    );
  }

  h3,
  p {
    margin: 0;
  }

  .syntax-chip {
    display: inline-flex;
    width: fit-content;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(18, 89, 58, 0.1);
    color: #12593a;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .count {
    font-weight: 700;
  }
`;

const componentTargetArtifactCount = signal(0);
const componentTargetKeyCount = signal(0);
const componentTargetLastKey = signal("-");

function incrementComponentTargetArtifactCount(label: string) {
  if (label === "artifact-click") {
    componentTargetArtifactCount.set(componentTargetArtifactCount.value + 1);
  }
}

function recordComponentTargetKey(key: string, label: string) {
  if (label === "artifact-keydown") {
    componentTargetKeyCount.set(componentTargetKeyCount.value + 1);
    componentTargetLastKey.set(key);
  }
}

function recordComponentTargetKeyFromEvent(event: Event, label: string) {
  const key = event instanceof KeyboardEvent ? event.key : "unknown";
  recordComponentTargetKey(key, label);
}

const PlaygroundComponentTargetButton = defineComponent(
  "playground-component-target-button",
  () => {
    return (
      <button class="demo-button" type="button">
        Click inside child shadow root
      </button>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundComponentTargetInput = defineComponent(
  "playground-component-target-input",
  () => {
    return (
      <input
        class="demo-input"
        type="text"
        placeholder="Press Enter in child"
      />
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const nestedIslandsStyles = css`
  :host {
    display: block;
  }

  .outer-shell {
    display: grid;
    gap: 14px;
    padding: 22px;
    border-radius: 24px;
    border: 1px solid rgba(27, 61, 88, 0.14);
    background:
      radial-gradient(
        circle at top right,
        rgba(125, 173, 214, 0.24),
        transparent 38%
      ),
      linear-gradient(
        180deg,
        rgba(247, 250, 252, 0.96),
        rgba(231, 239, 245, 0.92)
      );
    box-shadow: 0 18px 44px rgba(20, 43, 62, 0.1);
  }

  .outer-shell h3,
  .outer-shell p,
  .inner-card h4,
  .inner-card p {
    margin: 0;
  }

  .meta-row {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .meta-chip {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 6px 10px;
    border-radius: 999px;
    background: rgba(22, 79, 122, 0.1);
    color: #164f7a;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.03em;
    text-transform: uppercase;
  }

  .status-grid {
    display: grid;
    gap: 8px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.74);
  }

  .status-grid strong {
    color: #0f3855;
  }

  .inner-card {
    display: grid;
    gap: 10px;
    padding: 16px;
    border-radius: 18px;
    border: 1px solid rgba(19, 102, 75, 0.14);
    background: linear-gradient(
      180deg,
      rgba(244, 251, 247, 0.96),
      rgba(229, 243, 235, 0.92)
    );
  }

  button {
    justify-self: start;
  }
`;

const PlaygroundColocatedLoadCard = defineComponent(
  "playground-colocated-load-card",
  ({ client }) => {
    const count = signal(0);

    return (
      <article>
        <p class="syntax-chip">load:onClick</p>
        <h3>Colocated load click</h3>
        <p>
          The button keeps its click behavior next to the element markup. The
          host waits for the load strategy, rerenders, and then the click
          handler increments the counter.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <button
          class="demo-button"
          type="button"
          load:onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Increment after load
        </button>
        <p>
          Count after hydration: <span class="count">{count.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundColocatedInteractionCard = defineComponent(
  "playground-colocated-interaction-card",
  ({ client }) => {
    const count = signal(0);

    return (
      <article>
        <p class="syntax-chip">interaction:onClick</p>
        <h3>Colocated interaction click</h3>
        <p>
          The first click triggers hydration and is replayed onto the rerendered
          button, so the counter should jump to <strong>1</strong> immediately.
        </p>
        <p>
          This replay starts once the client boot script has wired{" "}
          <code>hydrate()</code>.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <button
          class="demo-button"
          type="button"
          interaction:onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Click to hydrate and increment
        </button>
        <p>
          Count after hydration: <span class="count">{count.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundColocatedInteractionKeydownCard = defineComponent(
  "playground-colocated-interaction-keydown-card",
  ({ client }) => {
    const keyCount = signal(0);
    const lastKey = signal("-");

    return (
      <article>
        <p class="syntax-chip">interaction:onKeyDown</p>
        <h3>Colocated interaction keydown</h3>
        <p>
          The first key press hydrates the host and is replayed onto the
          rerendered input. Press Enter in the field and the counter should
          immediately become <strong>1</strong>.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <input
          class="demo-input"
          type="text"
          placeholder="Press Enter"
          interaction:onKeyDown={(event) => {
            keyCount.set(keyCount.value + 1);
            lastKey.set((event as KeyboardEvent).key || "unknown");
          }}
        />
        <p>
          Replayed key count: <span class="count">{keyCount.value}</span>
        </p>
        <p>
          Last replayed key: <span class="count">{lastKey.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundColocatedInteractionFocusCard = defineComponent(
  "playground-colocated-interaction-focus-card",
  ({ client }) => {
    const focusCount = signal(0);
    const lastFocusState = signal("blurred");

    return (
      <article>
        <p class="syntax-chip">interaction:onFocus</p>
        <h3>Colocated interaction focus</h3>
        <p>
          Focusing the field should hydrate the host and replay the focus event
          onto the rerendered input, incrementing the counter immediately.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <input
          class="demo-input"
          type="text"
          placeholder="Focus me"
          interaction:onFocus={() => {
            focusCount.set(focusCount.value + 1);
            lastFocusState.set("focused");
          }}
        />
        <p>
          Replayed focus count: <span class="count">{focusCount.value}</span>
        </p>
        <p>
          Last focus state: <span class="count">{lastFocusState.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundColocatedInteractionPointerCard = defineComponent(
  "playground-colocated-interaction-pointer-card",
  ({ client }) => {
    const pointerCount = signal(0);
    const lastPointerType = signal("none");

    return (
      <article>
        <p class="syntax-chip">interaction:onPointerDown</p>
        <h3>Colocated interaction pointerdown</h3>
        <p>
          Pointer down on the button should hydrate the host and replay the
          pointer event onto the rerendered button.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <button
          class="demo-button"
          type="button"
          interaction:onPointerDown={(event) => {
            pointerCount.set(pointerCount.value + 1);
            lastPointerType.set(
              (event as PointerEvent).pointerType || "unknown",
            );
          }}
        >
          Pointer down to hydrate
        </button>
        <p>
          Replayed pointer count:{" "}
          <span class="count">{pointerCount.value}</span>
        </p>
        <p>
          Last pointer type: <span class="count">{lastPointerType.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundComponentTargetArtifactCard = defineComponent(
  "playground-component-target-artifact-card",
  ({ client }) => {
    const artifactLabel = "artifact-click";

    return (
      <article>
        <p class="syntax-chip">&lt;Child interaction:onClick /&gt;</p>
        <h3>Component target interaction click</h3>
        <p>
          The handler is compiled into a client action artifact and rebound on
          the child host, so clicking the button inside the child shadow root
          increments the shared count.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <PlaygroundComponentTargetButton
          interaction:onClick={() =>
            incrementComponentTargetArtifactCount(artifactLabel)
          }
        />
        <p>
          Component target count:{" "}
          <span class="count">{componentTargetArtifactCount.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundComponentTargetKeydownCard = defineComponent(
  "playground-component-target-keydown-card",
  ({ client }) => {
    const artifactLabel = "artifact-keydown";

    return (
      <article>
        <p class="syntax-chip">&lt;Child interaction:onKeyDown /&gt;</p>
        <h3>Component target interaction keydown</h3>
        <p>
          The child input dispatches a host-visible keydown event. The inline
          handler captures a local label, which is serialized into the client
          action payload and restored on hydrate.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <PlaygroundComponentTargetInput
          interaction:onKeyDown={(event) =>
            recordComponentTargetKeyFromEvent(event, artifactLabel)
          }
        />
        <p>
          Component target key count:{" "}
          <span class="count">{componentTargetKeyCount.value}</span>
        </p>
        <p>
          Last key: <span class="count">{componentTargetLastKey.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundColocatedIdleCard = defineComponent(
  "playground-colocated-idle-card",
  ({ client }) => {
    const count = signal(0);

    return (
      <article>
        <p class="syntax-chip">idle:onClick</p>
        <h3>Colocated idle click</h3>
        <p>
          The host waits for idle time before rerendering setup. Once idle work
          completes, the colocated click handler starts incrementing the
          counter.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <button
          class="demo-button"
          type="button"
          idle:onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Increment after idle
        </button>
        <p>
          Count after hydration: <span class="count">{count.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundColocatedVisibleCard = defineComponent(
  "playground-colocated-visible-card",
  ({ client }) => {
    const count = signal(0);

    return (
      <article>
        <p class="syntax-chip">visible:onClick</p>
        <h3>Colocated visible click</h3>
        <p>
          This card waits off-screen until it enters the viewport. After the
          host rerenders on visibility, the colocated click handler becomes
          active.
        </p>
        <p>Active strategy in setup: {client.strategy ?? "none"}</p>
        <button
          class="demo-button"
          type="button"
          visible:onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Increment after visible
        </button>
        <p>
          Count after hydration: <span class="count">{count.value}</span>
        </p>
      </article>
    );
  },
  {
    styles: [colocatedCardStyles],
  },
);

const PlaygroundNestedInnerIsland = defineComponent(
  "playground-nested-inner-island",
  ({ client }) => {
    const count = signal(0);

    return (
      <article class="inner-card">
        <div class="meta-row">
          <p class="meta-chip">Inner</p>
          <p class="meta-chip">client:load</p>
        </div>
        <h4>Load-first nested child</h4>
        <p>
          This child should hydrate on the load strategy before the outer
          visible host becomes interactive.
        </p>
        <p>
          Child strategy in setup:{" "}
          <strong data-role="inner-strategy">
            {client.strategy ?? "none"}
          </strong>
        </p>
        <button
          type="button"
          onClick={() => {
            count.set(count.value + 1);
          }}
        >
          Increment nested child
        </button>
        <p>
          Child clicks: <strong data-role="inner-count">{count.value}</strong>
        </p>
      </article>
    );
  },
  {
    styles: [nestedIslandsStyles],
    props: {
      label: { type: String, default: "Nested child ready" },
    },
  },
);

const PlaygroundNestedOuterIsland = defineComponent(
  "playground-nested-outer-island",
  ({ client, props }) => {
    return (
      <section class="outer-shell">
        <div class="meta-row">
          <p class="meta-chip">Outer</p>
          <p class="meta-chip">client:visible</p>
        </div>
        <h3>Visible outer host with load nested child</h3>
        <p>
          The outer host stays inert until it becomes visible. The nested child
          can already be interactive after page load and should survive the
          later outer hydration pass.
        </p>
        <div class="status-grid">
          <p>
            Outer strategy in setup:{" "}
            <strong data-role="outer-strategy">
              {client.strategy ?? "none"}
            </strong>
          </p>
          <p>
            Outer note:{" "}
            <strong data-role="outer-label">{props.label.value}</strong>
          </p>
        </div>
        <PlaygroundNestedInnerIsland client:load label="Nested child ready" />
      </section>
    );
  },
  {
    styles: [nestedIslandsStyles],
    props: {
      label: { type: String, default: "Outer hydrated in place" },
    },
  },
);

function IslandsRuntimePage() {
  return (
    <>
      <section>
        <h2>Colocated strategy demos</h2>
        <p>
          These cards use the new HTML-element syntax directly inside the render
          function. The strategy and event behavior stay in one place instead of
          splitting into manual
          <code>hydrate</code> code.
        </p>
        <div class="route-grid">
          <PlaygroundColocatedLoadCard />
          <PlaygroundColocatedInteractionCard />
          <PlaygroundColocatedInteractionKeydownCard />
          <PlaygroundColocatedInteractionFocusCard />
          <PlaygroundColocatedInteractionPointerCard />
          <PlaygroundComponentTargetArtifactCard />
          <PlaygroundComponentTargetKeydownCard />
          <PlaygroundColocatedIdleCard />
        </div>
      </section>

      <section>
        <h2>Viewport-driven colocated click</h2>
        <p>
          Scroll past the spacer before clicking this card so that{" "}
          <code>visible:onClick</code>
          has a chance to rerender the host setup first.
        </p>
        <div style="height: 60vh" aria-hidden="true" />
        <div class="route-grid">
          <PlaygroundColocatedVisibleCard />
        </div>
      </section>

      <section>
        <h2>Deferred hydration strategies</h2>
        <p>
          This page keeps the server-rendered DSD in place and lets{" "}
          <code>hydrate()</code>
          decide when each custom element should attach client behavior.
        </p>
        <p>
          Each card starts as plain SSR markup. When its strategy fires, the
          host receives
          <code>data-hydrated="true"</code> and the button inside the Shadow DOM
          becomes interactive.
        </p>
      </section>

      <section>
        <h2>Immediate and queued strategies</h2>
        <div class="route-grid">
          <PlaygroundHydrationIsland
            islandStrategy="load"
            title="Load strategy"
            strategyLabel="client:load"
            description="Waits for the browser load event before hydrating the island."
          />
          <PlaygroundHydrationIsland
            islandStrategy="idle"
            title="Idle strategy"
            strategyLabel="client:idle"
            description="Hydrates when requestIdleCallback (or the timeout fallback) gets a turn."
          />
          <PlaygroundHydrationIsland
            islandStrategy="interaction"
            title="Interaction strategy"
            strategyLabel="client:interaction"
            description="Hydrates only after the first click on the host element."
          />
        </div>
      </section>

      <section>
        <h2>Viewport and media driven strategies</h2>
        <p>
          Resize below <code>720px</code> to trigger the media-based island.
          Scroll near the bottom spacer to let the visible island enter the
          viewport.
        </p>
        <div class="route-grid">
          <PlaygroundHydrationIsland
            islandStrategy="media"
            islandValue="(max-width: 720px)"
            title="Media strategy"
            strategyLabel="client:media"
            description="Hydrates once the page matches the configured media query."
          />
        </div>
        <div style="height: 52vh" aria-hidden="true" />
        <div class="route-grid">
          <PlaygroundHydrationIsland
            islandStrategy="visible"
            title="Visible strategy"
            strategyLabel="client:visible"
            description="Hydrates after IntersectionObserver reports that the island is on screen."
          />
        </div>
      </section>

      <section>
        <h2>Nested island vertical slice</h2>
        <p>
          This demo exercises the target flow: <code>Outer client:visible</code>{" "}
          keeps its SSR DSD intact, while the nested{" "}
          <code>Inner client:load</code> hydrates first and keeps working after
          the outer host later hydrates in place.
        </p>
        <p>
          On initial load this outer host should stay off-screen. The nested
          child still hydrates on
          <code>load</code>, so you can verify its button programmatically
          before scrolling this section into view.
        </p>
        <div style="height: 95vh" aria-hidden="true" />
        <div class="route-grid">
          <PlaygroundNestedOuterIsland
            client:visible
            label="Outer hydrated in place"
          />
        </div>
      </section>

      <section>
        <h2>What to verify</h2>
        <p>
          On first paint, every card should render SSR markup first. The
          colocated cards stay in plain SSR mode until their strategy rerenders
          the host setup.
        </p>
        <p>
          The legacy runtime islands expose <code>data-hydrated="true"</code>{" "}
          after their strategy fires. The colocated cards instead reveal their
          active strategy in setup and start responding to their colocated click
          or keydown handlers.
        </p>
      </section>
    </>
  );
}

export { IslandsRuntimePage };
