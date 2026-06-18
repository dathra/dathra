import { DocCodeBlock } from "../components/DocCodeBlock";

function ReactivityPage() {
  return (
    <section>
      <h1>Reactivity — Signals</h1>
      <p>
        Dathra's reactivity system is built on <code>alien-signals</code> and follows the TC39
        Signals proposal. It provides fine-grained reactivity without a virtual DOM.
      </p>

      <h2>signal()</h2>
      <p>Creates a reactive value that can be read and written:</p>
      <DocCodeBlock language="ts">{`import { signal } from "@dathra/core";

const count = signal(0);
count.value;      // => 0 (read)
count.set(5);     // => write
count.set(count.value + 1); // increment`}</DocCodeBlock>

      <h2>computed()</h2>
      <p>Derives a reactive value from other signals:</p>
      <DocCodeBlock language="ts">{`import { signal, computed } from "@dathra/core";

const count = signal(3);
const doubled = computed(() => count.value * 2);
doubled.value; // => 6`}</DocCodeBlock>

      <h2>effect()</h2>
      <p>Runs a side effect whenever its dependencies change:</p>
      <DocCodeBlock language="ts">{`import { signal, effect } from "@dathra/core";

const count = signal(0);
effect(() => {
  console.log("count is", count.value);
});
// logs "count is 0"
count.set(1); // logs "count is 1"`}</DocCodeBlock>

      <h2>batch()</h2>
      <p>Batch multiple signal updates to trigger effects once:</p>
      <DocCodeBlock language="ts">{`import { signal, batch, effect } from "@dathra/core";

const a = signal(0);
const b = signal(0);

effect(() => console.log(a.value, b.value));

batch(() => {
  a.set(1);
  b.set(2);
});
// logs "1 2" once, not twice`}</DocCodeBlock>

      <h2>createRoot() / onCleanup()</h2>
      <p>Manage reactive lifecycle and cleanup:</p>
      <DocCodeBlock language="ts">{`import { signal, effect, createRoot, onCleanup } from "@dathra/core";

const dispose = createRoot(() => {
  const count = signal(0);
  effect(() => console.log(count.value));
  onCleanup(() => console.log("cleaned up"));
});

dispose(); // runs cleanup`}</DocCodeBlock>

      <h2>templateEffect()</h2>
      <p>
        An effect optimized for template rendering — used internally by the DOM runtime for
        efficient updates.
      </p>
    </section>
  );
}

export { ReactivityPage };
