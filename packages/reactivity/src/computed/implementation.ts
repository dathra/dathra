/**
 * Computed implementation - cached derived reactive value.
 * @module
 */
import { ReactiveFlags } from "alien-signals/system";

import { createComputedNode, withNoTracking } from "../internal/helpers";
import type { ComputedNode } from "../internal/nodes";
import {
  checkDirty,
  enterRun,
  exitRun,
  getActiveSub,
  link,
  setActiveSub,
  shallowPropagate,
  type Link,
  unsetActiveSub,
  updateComputed,
} from "../internal/system";
import type { Computed } from "../types";

/**
 * Read a computed node, recomputing only when necessary.
 *
 * The first read evaluates the getter and records dependencies. Later reads
 * return the cached value unless the node is dirty or pending. When recomputed,
 * downstream subscribers are only propagated when the computed value actually
 * changed according to `Object.is`.
 *
 * @template T
 * @param {ComputedNode<T>} node Internal computed node.
 * @returns {T} Cached or newly computed value.
 */
function computedOper<T>(node: ComputedNode<T>): T {
  const flags = node.flags;
  let shouldUpdate = (flags & ReactiveFlags.Dirty) !== 0;
  if (!shouldUpdate && (flags & ReactiveFlags.Pending) !== 0) {
    shouldUpdate = checkDirty(node.deps as Link, node);
    if (!shouldUpdate) {
      node.flags = flags & ~ReactiveFlags.Pending;
    }
  }

  if (shouldUpdate) {
    if (updateComputed(node)) {
      const subs = node.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  } else if (flags === 0) {
    node.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(node);
    let succeeded = false;
    try {
      enterRun();
      node.value = node.getter(node.value) as T;
      succeeded = true;
    } finally {
      exitRun();
      unsetActiveSub(prevSub);
      node.flags &= ~ReactiveFlags.RecursedCheck;
      if (!succeeded) {
        node.flags |= ReactiveFlags.Dirty;
      }
    }
  }
  const sub = getActiveSub();
  if (sub !== undefined) {
    link(node, sub, 0);
  }
  return node.value as T;
}

/**
 * Create the public Computed API around an internal computed node.
 *
 * `.value` performs a tracked read so outer effects or computed values depend
 * on this computed node. `.peek()` reads the same cached value without linking
 * the current active subscriber.
 *
 * @template T
 * @param {ComputedNode<T>} node Internal computed node to expose.
 * @returns {Computed<T>} Public computed object.
 */
function createComputedApi<T>(node: ComputedNode<T>): Computed<T> {
  const readTracked = () => computedOper(node);
  const readUntracked = () => withNoTracking(() => computedOper(node));
  return {
    get value() {
      return readTracked();
    },
    peek() {
      return readUntracked();
    },
    __type__: "computed",
  };
}

/**
 * Create a cached derived value that recomputes when tracked dependencies change.
 *
 * The getter is lazy and receives the previous computed value after the first
 * successful evaluation. If the getter throws, the node remains dirty so the
 * next read retries without corrupting existing dependencies.
 *
 * @template T
 * @param {(previousValue?: T) => T} getter Function that produces the derived value.
 * @returns {Computed<T>} Lazily evaluated computed value.
 */
function computed<T>(getter: (previousValue?: T) => T): Computed<T> {
  return createComputedApi(createComputedNode(getter));
}

export { computed };
