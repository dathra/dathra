# @dathra/core

A lightweight JavaScript framework powered by fine-grained reactivity and direct DOM manipulation. Built on TC39 Signals (via [alien-signals](https://github.com/stackblitz/alien-signals)).

## Features

- **Fine-grained Reactivity** — SolidJS-style signals with automatic dependency tracking
- **Direct DOM** — No virtual DOM; updates only what changed
- **Tiny** — Runtime < 2KB gzip
- **TC39 Signals** — Aligned with the Signals proposal
- **SSR + Hydration** — Server-side rendering with efficient hydration
- **Web Standards** — Zero Node.js dependencies in runtime

## Install

```bash
npm install @dathra/core @dathra/plugin
```

## Vite Setup

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { dathra } from "@dathra/plugin";

export default defineConfig({
  plugins: [dathra.vite()],
});
```

```json
// tsconfig.json
{
  "compilerOptions": {
    "jsx": "react-jsx",
    "jsxImportSource": "@dathra/core"
  }
}
```

## Quick Start

```tsx
import {
  signal,
  computed,
  effect,
  batch,
  createRoot,
  onCleanup,
} from "@dathra/core";

// Create a signal
const count = signal(0);

// Derived value
const doubled = computed(() => count.value * 2);

// Side effect
const stop = effect(() => {
  console.log(`count = ${count.value}, doubled = ${doubled.value}`);
});

// Update
count.value = 1; // logs: count = 1, doubled = 2
count.set(5); // logs: count = 5, doubled = 10
count.update((n) => n + 1); // logs: count = 6, doubled = 12

// Batch multiple updates
batch(() => {
  count.value = 10;
  count.value = 20; // only triggers once
});

stop(); // cleanup
```

## API Reference

### Reactivity

| Function             | Description                                                                        |
| -------------------- | ---------------------------------------------------------------------------------- |
| `signal(initial)`    | Create a mutable signal. Read/write via `.value`, `.set()`, `.update()`, `.peek()` |
| `computed(fn)`       | Create a derived computation. Read via `.value`, `.peek()`                         |
| `effect(fn)`         | Run a side effect when dependencies change. Returns cleanup function               |
| `batch(fn)`          | Batch multiple signal updates into a single flush                                  |
| `createRoot(fn)`     | Create a cleanup scope. Returns dispose function                                   |
| `onCleanup(fn)`      | Register a cleanup callback in the current owner scope                             |
| `templateEffect(fn)` | Template-optimized effect for runtime use                                          |

### Runtime (DOM)

| Function                                               | Description                                                |
| ------------------------------------------------------ | ---------------------------------------------------------- |
| `fromTree(tree, ns)`                                   | Create DOM from structured array. Returns factory function |
| `firstChild(node)`                                     | Get first child node                                       |
| `nextSibling(node)`                                    | Get next sibling node                                      |
| `setText(node, value)`                                 | Set text content                                           |
| `setAttr(el, key, value)`                              | Set HTML attribute                                         |
| `setProp(el, key, value)`                              | Set DOM property                                           |
| `spread(el, props)`                                    | Spread props onto element                                  |
| `append(parent, child)`                                | Append child to parent                                     |
| `insert(parent, child, anchor)`                        | Insert child before anchor                                 |
| `event(type, el, handler)`                             | Attach event listener                                      |
| `reconcile(parent, items, keyFn, createFn, updateFn?)` | Keyed list reconciliation                                  |

## License

[MPL-2.0](./LICENSE.md)
