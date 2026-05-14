/**
 * @dathra/reactivity - Fine-grained reactivity system.
 *
 * Provides TC39 Signals-style reactive primitives built on alien-signals.
 * @module
 */

// Public API functions
export { batch } from "./batch/implementation";
export { computed } from "./computed/implementation";
export { createRoot } from "./createRoot/implementation";
export { effect } from "./effect/implementation";
export { onCleanup } from "./onCleanup/implementation";
export { signal } from "./signal/implementation";
export { templateEffect } from "./templateEffect/implementation";

// Public types
export type {
  Computed,
  EffectCleanup,
  Owner,
  RootDispose,
  Signal,
  SignalUpdate,
} from "./types";
