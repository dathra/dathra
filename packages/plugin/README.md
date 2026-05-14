# @dathra/plugin

Build tool plugin for Dathra. Transforms JSX/TSX files using `@dathra/transformer`. Built with [unplugin](https://github.com/unjs/unplugin) for multi-bundler support.

## Install

```bash
npm install @dathra/plugin
```

## Vite

```ts
// vite.config.ts
import { defineConfig } from "vite";
import { dathra } from "@dathra/plugin";

export default defineConfig({
  plugins: [dathra.vite()],
});
```

## Webpack

```js
// webpack.config.js
const { dathra } = require("@dathra/plugin");

module.exports = {
  plugins: [dathra.webpack()],
};
```

## Rollup

```js
// rollup.config.js
import { dathra } from "@dathra/plugin";

export default {
  plugins: [dathra.rollup()],
};
```

## esbuild

```js
import { dathra } from "@dathra/plugin";

require("esbuild").build({
  plugins: [dathra.esbuild()],
});
```

## Options

```ts
dathra.vite({
  include: [".tsx", ".jsx"], // file extensions to transform (default)
  exclude: [], // patterns to exclude
  runtimeModule: "@dathra/core", // runtime import module (default)
  mode: "csr", // "csr" | "ssr" — overrides auto-detection
});
```

| Option          | Type             | Default            | Description                  |
| --------------- | ---------------- | ------------------ | ---------------------------- |
| `include`       | `string[]`       | `[".tsx", ".jsx"]` | File extensions to transform |
| `exclude`       | `string[]`       | `[]`               | Patterns to exclude          |
| `runtimeModule` | `string`         | `"@dathra/core"`   | Module for runtime imports   |
| `mode`          | `"csr" \| "ssr"` | auto               | Force rendering mode         |

### SSR Mode Detection

When `mode` is not set, the plugin auto-detects SSR from the Vite environment:

1. `environment.name` (Vite Environment API)
2. `options.ssr` (Vite SSR flag)
3. Falls back to CSR

## License

[MPL-2.0](./LICENSE.md)
