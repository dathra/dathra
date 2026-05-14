# Dathra × Nuxt 4 Playground

This playground demonstrates how to use Dathra Web Components with Nuxt 4 SSR and Declarative Shadow DOM.

## Features

- ✅ Nuxt 4 with full SSR support
- ✅ Dathra Web Components with TypeScript
- ✅ Declarative Shadow DOM rendering
- ✅ Reactive state management with signals
- ✅ JSX support via Dathra transformer

## Setup

```bash
# Install dependencies
pnpm install

# Start dev server
pnpm run dev
```

## Architecture

### Components

- **MyGreeting.tsx**: Simple greeting component with attribute binding
- **MyCounter.tsx**: Interactive counter with reactive state

### SSR Flow

1. Components are defined with `defineComponent()` in `.tsx` files
2. Dathra Vite plugin transforms JSX to `renderToString()` calls in SSR mode
3. Nuxt renders components on the server with Declarative Shadow DOM
4. Client hydrates the components without re-rendering

## Key Files

- `nuxt.config.ts` - Nuxt configuration with Dathra plugin
- `components/*.tsx` - Dathra Web Components
- `pages/index.vue` - Demo page using the components
