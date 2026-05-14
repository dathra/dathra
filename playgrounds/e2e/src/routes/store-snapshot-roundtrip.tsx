import { defineComponent } from "@dathra/components";
import { signal } from "@dathra/core";

import {
  fixtureStoreSnapshotSchema,
  countAtom,
  createFixtureStore,
  themeAtom,
} from "../store";
import { pageStyles } from "../routeStyles";

function decodeSerializedSnapshot(
  serialized: string,
): Record<string, unknown> | null {
  const parsed = JSON.parse(serialized) as unknown;
  if (!Array.isArray(parsed) || parsed.length === 0) {
    return null;
  }

  const indexTable = parsed[0];
  if (typeof indexTable !== "object" || indexTable === null) {
    return null;
  }

  const snapshot: Record<string, unknown> = {};
  for (const [key, index] of Object.entries(indexTable)) {
    if (typeof index !== "number") {
      continue;
    }
    snapshot[key] = parsed[index];
  }

  return snapshot;
}

const StoreSnapshotRoundtripFixture = defineComponent(
  "e2e-store-snapshot-roundtrip-fixture",
  () => {
    const initialTheme = signal("snapshot-midnight");
    const initialCount = signal(7);

    return (
      <article>
        <p class="meta-chip">store snapshot roundtrip</p>
        <p data-testid="snapshot-theme">Theme: {initialTheme.value}</p>
        <p data-testid="snapshot-count">Count: {initialCount.value}</p>
        <button data-testid="snapshot-increment" type="button">
          Increment snapshot count
        </button>
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

      const store = createFixtureStore({
        appId: `${host.tagName.toLowerCase()}-snapshot-client`,
        count: 0,
        theme: "client-default",
      });

      const ownerRoot = host.getRootNode();
      if (ownerRoot instanceof ShadowRoot) {
        const script = ownerRoot.querySelector(
          'script[type="application/json"][data-dh-store]',
        );
        if (script?.textContent) {
          const decodedSnapshot = decodeSerializedSnapshot(script.textContent);
          if (decodedSnapshot !== null) {
            fixtureStoreSnapshotSchema.hydrate(store, decodedSnapshot as never);
          }
          script.remove();
        }
      }

      const themeNode = shadowRoot.querySelector<HTMLElement>(
        '[data-testid="snapshot-theme"]',
      );
      const countNode = shadowRoot.querySelector<HTMLElement>(
        '[data-testid="snapshot-count"]',
      );
      const button = shadowRoot.querySelector<HTMLButtonElement>(
        '[data-testid="snapshot-increment"]',
      );

      if (themeNode === null || countNode === null || button === null) {
        return;
      }

      const render = () => {
        themeNode.textContent = `Theme: ${String(store.ref(themeAtom).value)}`;
        countNode.textContent = `Count: ${String(store.ref(countAtom).value)}`;
      };

      const onClick = () => {
        store.set(countAtom, store.ref(countAtom).value + 1);
        render();
      };

      render();
      button.addEventListener("click", onClick);
      return () => {
        button.removeEventListener("click", onClick);
      };
    },
  },
);

function StoreSnapshotRoundtripRoute() {
  return (
    <main>
      <StoreSnapshotRoundtripFixture />
    </main>
  );
}

export { StoreSnapshotRoundtripRoute };
