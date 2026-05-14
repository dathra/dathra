import { defineComponent } from "@dathra/components";
import {
  HydrationMismatchError,
  hydrateWithPlan,
} from "@dathra/runtime/hydration";

import { pageStyles } from "../routeStyles";

const MismatchFallbackFixture = defineComponent(
  "e2e-mismatch-fallback-fixture",
  () => {
    return (
      <article>
        <p class="meta-chip">mismatch fallback</p>
        <p data-testid="mismatch-status">ssr</p>
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

      try {
        hydrateWithPlan(shadowRoot, {
          namespace: "html",
          bindings: [
            {
              kind: "text",
              markerId: 999,
              expression: () => "broken",
            },
          ],
          nestedBoundaries: [],
        });
      } catch (error) {
        if (!(error instanceof HydrationMismatchError)) {
          throw error;
        }
      }

      shadowRoot.innerHTML =
        '<article><p data-testid="mismatch-status">recovered</p><button data-testid="mismatch-retry" type="button">Fallback click</button><p data-testid="mismatch-count">0</p></article>';

      const button = shadowRoot.querySelector<HTMLButtonElement>(
        '[data-testid="mismatch-retry"]',
      );
      const countNode = shadowRoot.querySelector<HTMLElement>(
        '[data-testid="mismatch-count"]',
      );

      if (button === null || countNode === null) {
        return;
      }

      let count = 0;
      const onClick = () => {
        count += 1;
        countNode.textContent = String(count);
      };

      button.addEventListener("click", onClick);
      return () => {
        button.removeEventListener("click", onClick);
      };
    },
  },
);

function MismatchFallbackRoute() {
  return (
    <main>
      <MismatchFallbackFixture />
    </main>
  );
}

export { MismatchFallbackRoute };
