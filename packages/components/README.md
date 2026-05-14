# @dathra/components

Web Components high-level API for Dathra framework.

## Features

- **`defineComponent`**: High-level API for defining Web Components with automatic Shadow DOM setup, reactive props with type coercion, and lifecycle management
- **`css`**: Tagged template literal for creating CSSStyleSheets to use with adoptedStyleSheets

## Installation

```bash
pnpm add @dathra/components @dathra/reactivity
```

Note: Usually you'll install `@dathra/core` which includes this package.

## Usage

```typescript
import { defineComponent, css } from '@dathra/components';
import { signal } from '@dathra/reactivity';

const styles = css`
  button {
    padding: 8px 16px;
    cursor: pointer;
  }
`;

const Counter = defineComponent('my-counter', ({ props }) => {
  const count = signal(props.initial.value);

  return (
    <button onClick={() => count.update(v => v + 1)}>
      Count: {count.value}
    </button>
  );
}, {
  styles: [styles],
  props: { initial: { type: Number, default: 0 } },
});

const app = <Counter initial={1} />;
```

```html
<my-counter></my-counter>
```

## API

### `defineComponent(tagName, setup, options?)`

Define and register a custom element, and get back a JSX-ready component definition.

- **tagName**: Custom element name (must contain a hyphen)
- **setup**: Function that creates the component's DOM content
- **options**: Optional configuration
  - `styles`: Array of CSSStyleSheet or string styles
  - `props`: PropsSchema object defining observed attributes with type coercion
  - `hydrate`: Hydration setup function for SSR
- **returns**: Callable definition with `webComponent` and `jsx` helpers

### `css`

Create a CSSStyleSheet from a template literal.

```typescript
const styles = css`
  :host {
    display: block;
  }
  .card {
    border: 1px solid #ccc;
    padding: 16px;
  }
`;
```

## SSR with Declarative Shadow DOM

To enable SSR with Declarative Shadow DOM, simply import the auto-setup module:

```typescript
// entry-server.tsx
import "@dathra/components/ssr"; // Auto-enables DSD rendering
import { App } from "./App";

export function render(): string {
  return App() as unknown as string;
}
```

The `@dathra/components/ssr` import automatically configures the SSR renderer to generate `<template shadowrootmode="open">` for all registered Web Components. No additional setup required!

## License

MPL-2.0
