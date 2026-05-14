import { getCurrentStore, withStore } from "@dathra/core";

import { countAtom, createDemoStore, nextTheme, themeAtom } from "../demoStore";

function requireCurrentStore() {
  const store = getCurrentStore();
  if (store === undefined) {
    throw new Error("[playground/ssr] missing store boundary");
  }
  return store;
}

function ScopeCard(props: {
  title: string;
  description: string;
  expectation: string;
}) {
  const store = requireCurrentStore();
  const count = store.ref(countAtom);
  const theme = store.ref(themeAtom);

  return (
    <article>
      <h3>{props.title}</h3>
      <p>{props.description}</p>
      <p>Expected: {props.expectation}</p>
      <p>
        Store appId: <strong>{store.appId}</strong>
      </p>
      <p>
        countAtom: <strong>{count.value}</strong>
      </p>
      <p>
        themeAtom: <strong>{theme.value}</strong>
      </p>
      <button onClick={() => count.set((value) => value + 1)}>
        countAtom++
      </button>
      <button onClick={() => theme.set(nextTheme(theme.peek()))}>
        cycle themeAtom
      </button>
    </article>
  );
}

function StoreBoundariesPage() {
  const rootStore = requireCurrentStore();
  const isolatedLeftStore = createDemoStore({
    appId: "playground-ssr-isolated-left",
    count: 10,
    theme: "amber",
  });
  const isolatedRightStore = createDemoStore({
    appId: "playground-ssr-isolated-right",
    count: 40,
    theme: "night",
  });

  return (
    <>
      <section>
        <h2>Root boundary</h2>
        <p>
          The page-level SSR request store is also the active root boundary for
          this demo.
        </p>
        <p>
          Root store appId: <strong>{rootStore.appId}</strong>
        </p>
      </section>

      <section>
        <h2>Shared siblings</h2>
        <p>
          Both siblings use the same store instance, so updates propagate both
          ways.
        </p>
        {withStore(rootStore, () => (
          <ScopeCard
            title="Shared A"
            description="Sibling A uses the root store boundary."
            expectation="Incrementing here updates Shared B as well."
          />
        ))}
        {withStore(rootStore, () => (
          <ScopeCard
            title="Shared B"
            description="Sibling B also uses the root store boundary."
            expectation="Theme and count stay in sync with Shared A."
          />
        ))}
      </section>

      <section>
        <h2>Isolated siblings</h2>
        <p>
          Each sibling gets its own createAtomStore(), so updates stay local.
        </p>
        {withStore(isolatedLeftStore, () => (
          <ScopeCard
            title="Isolated A"
            description="Sibling A uses its own store instance."
            expectation="Incrementing here does not affect Isolated B."
          />
        ))}
        {withStore(isolatedRightStore, () => (
          <ScopeCard
            title="Isolated B"
            description="Sibling B uses a different store instance."
            expectation="Theme and count stay independent from Isolated A."
          />
        ))}
      </section>
    </>
  );
}

export { StoreBoundariesPage };
