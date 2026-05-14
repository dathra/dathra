# @dathra/runtime

Low-level DOM runtime for Dathra. Handles CSR (client-side rendering), SSR (server-side rendering), and hydration through separate entry points.

## Install

```bash
npm install @dathra/runtime
```

## Entry Points

| Import                      | Description                                                       |
| --------------------------- | ----------------------------------------------------------------- |
| `@dathra/runtime`           | CSR — DOM generation, navigation, updates, events, reconciliation |
| `@dathra/runtime/ssr`       | SSR — Render structured arrays to HTML strings                    |
| `@dathra/runtime/hydration` | Hydration — Attach reactivity to SSR-rendered DOM                 |

## CSR API

```ts
import {
  fromTree,
  firstChild,
  nextSibling,
  setText,
  setAttr,
  setProp,
  spread,
  append,
  insert,
  event,
  reconcile,
} from "@dathra/runtime";
import { templateEffect, createRoot, onCleanup } from "@dathra/reactivity";
```

### `fromTree(tree, ns)`

Create a DOM factory from a structured array (Tree). Returns `() => DocumentFragment`.

```ts
const factory = fromTree([["div", { class: "app" }, "Hello"]], 0);
const fragment = factory(); // DocumentFragment with <div class="app">Hello</div>
```

### `firstChild(node, skipText?)` / `nextSibling(node, skipText?)`

Navigate the DOM tree. Used by compiled output to locate dynamic nodes.

```ts
const div = firstChild(fragment);
const text = firstChild(div, true); // skip to first non-text child
const next = nextSibling(text);
```

### `setText(node, value)`

Set a text node's content.

```ts
templateEffect(() => setText(textNode, count.value));
```

### `setAttr(el, key, value)` / `setProp(el, key, value)`

Set an HTML attribute or DOM property.

```ts
setAttr(el, "class", "active");
setProp(el, "checked", true);
```

### `spread(el, props)`

Spread an object of props onto an element, diffing against previous values.

```ts
spread(el, { class: "btn", onClick: handler });
```

### `append(parent, child)` / `insert(parent, child, anchor)`

DOM insertion primitives.

```ts
append(container, fragment);
insert(container, newNode, referenceNode);
```

### `event(type, el, handler)`

Attach a DOM event listener.

```ts
event("click", button, () => count.update((n) => n + 1));
```

### `reconcile(parent, items, keyFn, createFn, updateFn?)`

Keyed list reconciliation for efficient list rendering.

```ts
templateEffect(() => {
  reconcile(
    listEl,
    items.value,
    (item) => item.id,
    (item) => {
      const el = document.createElement("li");
      el.textContent = item.name;
      return el;
    },
  );
});
```

## SSR API

```ts
import {
  renderToString,
  renderTree,
  serializeState,
  createMarker,
  MarkerType,
} from "@dathra/runtime/ssr";
```

### `renderToString(tree, state, dynamicValues)`

Render a structured array tree to an HTML string with SSR markers.

### `renderTree(tree, options)`

Lower-level tree rendering with custom options.

### `serializeState(state)`

Serialize component state for transfer to the client using [devalue](https://github.com/Rich-Harris/devalue).

### `createMarker(type, id?)`

Create SSR marker comments for hydration boundaries.

## Hydration API

```ts
import {
  hydrate,
  hydrateRoot,
  createHydrationContext,
  isHydrated,
} from "@dathra/runtime/hydration";
```

### `hydrate(shadowRoot, setup)`

Hydrate a Shadow DOM root, attaching reactivity to existing SSR-rendered DOM.

### `hydrateRoot(root)`

Hydrate a regular DOM root.

### `createHydrationContext()`

Create a hydration context for walker-based marker resolution.

### `isHydrated(root)`

Check if a root has already been hydrated (idempotency guard).

## Bundle Size

- CSR core: ~1.8 KB gzip
- SSR / Hydration: loaded separately, tree-shakable

## License

[MPL-2.0](./LICENSE.md)
