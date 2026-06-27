/**
 * Public type definitions for the reactivity package.
 * @module
 */

// Re-export internal types that are public API
export type { Owner, RootDispose } from "../internal/state";

/** Function or value for updating a signal */
type SignalUpdate<T> = [T] extends [(...args: never[]) => unknown]
  ? T
  : T | ((prev: T) => T);

/** Cleanup function returned by effect() */
type EffectCleanup = () => void;

/** Mutable reactive signal */
interface Signal<T> {
  /** Read the signal value with tracking (read-only; use set() to write) */
  readonly value: T;
  /** Set the signal value (accepts value or updater function) */
  set(update: SignalUpdate<T>): void;
  /** Read the value without tracking */
  peek(): T;
  /** Type marker for signal */
  readonly __type__: "signal";
}

/** Cached derived value */
interface Computed<T> {
  /** Read the computed value with tracking */
  readonly value: T;
  /** Read the value without tracking */
  peek(): T;
  /** Type marker for computed */
  readonly __type__: "computed";
}

export type { Computed, EffectCleanup, Signal, SignalUpdate };
