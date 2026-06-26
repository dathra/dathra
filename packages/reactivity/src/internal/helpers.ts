/**
 * Helper functions for reactive node creation and tracking.
 * @module
 */
import { ReactiveFlags } from "alien-signals/system";

import type { ComputedNode, EffectNode, SignalNode } from "./nodes";
import { getActiveSub, setActiveSub, unsetActiveSub } from "./system";

/**
 * Execute a function while dependency tracking is temporarily disabled.
 *
 * `activeSub` is the node that should receive dependency links for reads. By
 * clearing it for the duration of `fn`, reads performed by `peek()` or updater
 * callbacks can observe the current value without subscribing the current
 * effect or computed node.
 *
 * @template T
 * @param {() => T} fn Function to execute without collecting dependencies.
 * @returns {T} Result returned by `fn`.
 */
function withNoTracking<T>(fn: () => T): T {
  if (getActiveSub() === undefined) {
    return fn();
  }
  const prev = setActiveSub(undefined);
  try {
    return fn();
  } finally {
    unsetActiveSub(prev);
  }
}

/**
 * Create a signal node with initial value.
 *
 * Signal nodes are mutable sources. They start without dependencies or
 * subscribers, and `previousValue` mirrors `value` so future writes can use
 * `Object.is` semantics to suppress unchanged updates.
 *
 * @template T
 * @param {T} initialValue Initial stored value.
 * @returns {SignalNode<T>} Internal signal node.
 */
function createSignalNode<T>(initialValue: T): SignalNode<T> {
  return {
    kind: "signal",
    previousValue: initialValue,
    value: initialValue,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: ReactiveFlags.Mutable,
  };
}

/**
 * Create a computed node with getter function.
 *
 * Computed nodes are lazy. They start with no cached value and no dependencies;
 * the getter runs on the first tracked or untracked read and records whichever
 * signals or computed values it reads at that time.
 *
 * @template T
 * @param {(previousValue?: T) => T} getter Function that derives the cached value.
 * @returns {ComputedNode<T>} Internal computed node.
 */
function createComputedNode<T>(
  getter: (previousValue?: T) => T,
): ComputedNode<T> {
  return {
    kind: "computed",
    value: undefined,
    getter: getter as (previousValue?: unknown) => unknown,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: ReactiveFlags.None,
  };
}

/**
 * Create an effect node with effect function.
 *
 * Effect nodes are watchers. Their `fn` is run by the effect API immediately on
 * creation and later by the scheduler when tracked dependencies change.
 *
 * @param {() => void} fn Function to run when the effect is executed.
 * @returns {EffectNode} Internal effect watcher node.
 */
function createEffectNode(fn: () => void): EffectNode {
  return {
    kind: "effect",
    fn,
    subs: undefined,
    subsTail: undefined,
    deps: undefined,
    depsTail: undefined,
    flags: ReactiveFlags.Watching,
  };
}

export {
  createComputedNode,
  createEffectNode,
  createSignalNode,
  withNoTracking,
};
