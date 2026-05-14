# @dathra/transformer

JSX transformer that converts JSX into Dathra runtime calls using structured arrays. Supports both CSR and SSR output modes.

## Install

```bash
npm install @dathra/transformer
```

> **Note:** This package is typically used indirectly via `@dathra/plugin`. Direct usage is for custom build tool integrations.

## Usage

```ts
import { transform } from "@dathra/transformer";

const result = transform(code, {
  mode: "csr", // "csr" | "ssr"
  sourceMap: true,
  filename: "App.tsx",
});

console.log(result.code);
console.log(result.map);
```

## Transform Example

**Input (JSX):**

```jsx
<button class="btn" onClick={handler}>
  Count: {count.value}
</button>
```

**Output (CSR):**

```js
import {
  fromTree,
  firstChild,
  nextSibling,
  setText,
  event,
  templateEffect,
} from "@dathra/runtime";

const _t1 = fromTree(
  [["button", { class: "btn" }, "Count: ", ["{text}", null]]],
  0,
);
const _el = _t1();
const _button = firstChild(_el);
const _text = nextSibling(firstChild(_button, true));
event("click", _button, handler);
templateEffect(() => setText(_text, count.value));
```

**Output (SSR):**

```js
import { renderToString } from "@dathra/runtime";

renderToString(
  [["button", { class: "btn" }, "Count:", ["{text}", null]]],
  {},
  new Map([[1, count.value]]),
);
```

## Options

| Option          | Type             | Default             | Description                             |
| --------------- | ---------------- | ------------------- | --------------------------------------- |
| `mode`          | `"csr" \| "ssr"` | `"csr"`             | Rendering mode                          |
| `sourceMap`     | `boolean`        | `false`             | Generate source map                     |
| `filename`      | `string`         | —                   | File name for source maps               |
| `runtimeModule` | `string`         | `"@dathra/runtime"` | Module to import runtime functions from |

## License

[MPL-2.0](./LICENSE.md)
