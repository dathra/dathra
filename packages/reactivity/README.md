# @dathra/reactivity

Fine-grained reactivity system built on [alien-signals](https://github.com/stackblitz/alien-signals). Provides TC39 Signals-style `signal` / `computed` / `effect` primitives.

## Install

```bash
npm install @dathra/reactivity
```

## Usage

```ts
import { signal, computed, effect, batch } from "@dathra/reactivity";

const count = signal(0);
const doubled = computed(() => count.value * 2);

const stop = effect(() => {
  console.log(`count: ${count.value}, doubled: ${doubled.value}`);
});

count.set(5); // logs: count: 5, doubled: 10
count.set(10); // logs: count: 10, doubled: 20

batch(() => {
  count.set(100);
  count.set(200); // single notification
});
// logs: count: 200, doubled: 400

stop();
```

## API

### `signal(initialValue)`

Create a mutable reactive signal.

```ts
const name = signal("world");
console.log(name.value); // "world"
name.set("dathra"); // triggers dependents
name.set((v) => v + "!"); // updater function
name.peek(); // read without tracking
```

### `computed(fn)`

Create a cached derived value that recomputes when dependencies change.

```ts
const count = signal(1);
const doubled = computed(() => count.value * 2);
console.log(doubled.value); // 2
console.log(doubled.peek()); // read without tracking
```

### `effect(fn)`

Run a side effect whenever its dependencies change. Returns a cleanup function.
`onCleanup` called inside the effect body runs before each re-execution and when the effect is stopped.

```ts
const count = signal(0);
const stop = effect(() => {
  const timer = setInterval(() => {}, 1000);
  onCleanup(() => clearInterval(timer)); // runs before re-execution or on stop()
  console.log(count.value);
});
count.set(1); // triggers re-run (previous onCleanup fires first)
stop(); // dispose effect (onCleanup fires)
```

### `batch(fn)`

Batch multiple signal writes into a single notification flush.

```ts
const a = signal(0);
const b = signal(0);
batch(() => {
  a.value = 1;
  b.value = 2;
}); // dependents notified once
```

### `createRoot(fn)`

Create a cleanup/ownership scope. Returns a dispose function.

```ts
const dispose = createRoot(() => {
  const count = signal(0);
  effect(() => console.log(count.value));
  count.value = 1;
});
dispose(); // cleans up all effects in scope
```

### `onCleanup(fn)`

Register a cleanup callback within the current scope. Works inside both `createRoot` and `effect`.

```ts
// Inside createRoot — runs when root is disposed
createRoot(() => {
  const timer = setInterval(() => {}, 1000);
  onCleanup(() => clearInterval(timer));
});

// Inside effect — runs before each re-execution and on stop()
effect(() => {
  const timer = setInterval(() => {}, 1000);
  onCleanup(() => clearInterval(timer));
});
```

### `templateEffect(fn)`

Optimized effect for template bindings. Used internally by the runtime.

```ts
templateEffect(() => {
  setText(node, count.value);
});
```

## License

[MPL-2.0](./LICENSE.md)
