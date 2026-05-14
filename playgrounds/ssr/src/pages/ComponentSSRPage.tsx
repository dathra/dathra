import { signal } from "@dathra/core";
import { render as renderSSR } from "@dathra/core/ssr";

import type { DemoTheme } from "../demoStore";
import { nextTheme } from "../demoStore";
import { SSRStoreCounter } from "../WebComponentSSR";

function ComponentSSRPage() {
  const isServer = typeof document === "undefined";
  const playgroundHeadline = signal("Callable defineComponent return");
  const playgroundCount = signal(7);
  const playgroundAccent = signal<DemoTheme>("mint");
  const ssrMarkup = isServer
    ? renderSSR(SSRStoreCounter, {
        headline: "render(SSRStoreCounter, ...) sample",
        note: "This markup is generated on the server from the same return value used in JSX.",
        count: 12,
        accent: "amber",
      })
    : "";

  return (
    <>
      <section>
        <h2>Custom element under the root boundary</h2>
        <p>
          This counter reads <code>ctx.store</code>, so it follows the active
          root
          <code>withStore()</code> boundary too.
        </p>
        <SSRStoreCounter
          headline={playgroundHeadline}
          note="Rendered by writing the defineComponent return value directly in JSX."
          count={playgroundCount}
          accent={playgroundAccent}
        >
          <p>
            This slotted content proves the callable return can pass children
            into the host element.
          </p>
        </SSRStoreCounter>
        <div class="counter-actions">
          <button onClick={() => playgroundCount.set((value) => value + 5)}>
            Bump mirrored prop
          </button>
          <button
            onClick={() =>
              playgroundAccent.set(nextTheme(playgroundAccent.peek()))
            }
          >
            Cycle accent prop
          </button>
          <button
            onClick={() => {
              playgroundHeadline.set(
                playgroundHeadline.peek() === "Callable defineComponent return"
                  ? "JSX helper updates live"
                  : "Callable defineComponent return",
              );
            }}
          >
            Toggle headline prop
          </button>
        </div>
      </section>

      <section>
        <h2>SSR markup generated from the same value</h2>
        <p>
          The box below is produced by calling{" "}
          <code>render(SSRStoreCounter, ...)</code>
          with the callable object returned by <code>defineComponent()</code>.
        </p>
        {isServer ? (
          <pre class="ssr-markup-code">{ssrMarkup}</pre>
        ) : (
          <p>
            This preview is server-only. Inspect the initial HTML response to
            see the rendered DSD markup.
          </p>
        )}
      </section>
    </>
  );
}

export { ComponentSSRPage };
