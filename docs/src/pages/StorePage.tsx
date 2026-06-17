import { DocCodeBlock } from "../components/DocCodeBlock";

function StorePage() {
  return (
    <section>
      <h1>Atomic State Management</h1>
      <p>
        <code>@dathra/store</code> provides a Recoil/Jotai-inspired atomic state
        management system with store boundaries and AsyncLocalStorage support.
      </p>

      <h2>atom()</h2>
      <p>Define atomic state units:</p>
      <DocCodeBlock language="ts">{`import { atom } from "@dathra/store";

const countAtom = atom("count", 0);
const doubledAtom = atom("doubled", (get) => get(countAtom) * 2);`}</DocCodeBlock>

      <h2>createAtomStore()</h2>
      <p>Create a store instance with initial values:</p>
      <DocCodeBlock language="ts">{`import { createAtomStore } from "@dathra/store";

const store = createAtomStore({
  appId: "my-app",
  values: [
    [countAtom, 5],
  ],
});`}</DocCodeBlock>

      <h2>withStore()</h2>
      <p>Propagate a store through the component tree:</p>
      <DocCodeBlock language="ts">{`import { withStore } from "@dathra/store";

const result = withStore(store, () => {
  // Any signal/computed/effect inside here
  // has access to the store context
  return computeSomething();
});`}</DocCodeBlock>

      <h2>defineAtomStoreSnapshot()</h2>
      <p>Define a snapshot schema for serialization:</p>
      <DocCodeBlock language="ts">{`import { defineAtomStoreSnapshot } from "@dathra/store";

const snapshot = defineAtomStoreSnapshot({
  count: countAtom,
  theme: themeAtom,
});`}</DocCodeBlock>

      <h2>Store Boundaries</h2>
      <p>
        Different subtrees can share a store or have isolated store boundaries.
        Useful for SSR where each request gets its own store context.
      </p>
    </section>
  );
}

export { StorePage };
