/**
 * Signal implementation - mutable reactive value.
 * @module
 */
import { ReactiveFlags } from "alien-signals/system";

import { createSignalNode, withNoTracking } from "../internal/helpers";
import type { BaseNode, SignalNode } from "../internal/nodes";
import {
  flush,
  getActiveSub,
  getBatchDepth,
  isRunning,
  link,
  propagate,
  shallowPropagate,
  updateSignal,
} from "../internal/system";
import type { Signal } from "../types";

/**
 * Read from or write to a signal node.
 *
 * With a value argument this performs a write, marks the node dirty when the
 * value changed, propagates to subscribers, and flushes immediately unless a
 * batch is active. Without a value argument this performs a tracked read,
 * updates the node's previous value when needed, and links the signal to the
 * current active subscriber.
 *
 * @template T
 * @param {SignalNode<T>} node Internal signal node.
 * @param {[] | [T]} value Optional single value used for writes.
 * @returns {T | void} Current value for reads, otherwise void.
 */
function signalOper<T>(node: SignalNode<T>, ...value: [] | [T]): T | void {
  if (value.length > 0) {
    const oldValue = node.value;
    const nextValue = value[0] as T;
    node.value = nextValue;
    if (!Object.is(oldValue, node.value)) {
      node.flags = ReactiveFlags.Mutable | ReactiveFlags.Dirty;
      const subs = node.subs;
      if (subs !== undefined) {
        propagate(subs, isRunning());
        if (getBatchDepth() === 0) {
          flush();
        }
      }
    }
  } else {
    const current = node.value;
    if ((node.flags & ReactiveFlags.Dirty) !== 0) {
      if (updateSignal(node, current)) {
        const subs = node.subs;
        if (subs !== undefined) {
          shallowPropagate(subs);
        }
      }
    }
    let sub = getActiveSub();
    while (sub !== undefined) {
      if (
        (sub.flags & (ReactiveFlags.Mutable | ReactiveFlags.Watching)) !==
        0
      ) {
        link(node, sub, 0);
        break;
      }
      sub = sub.subs?.sub as BaseNode | undefined;
    }
    return current;
  }
}

/**
 * Create the public Signal API around an internal signal node.
 *
 * `.value` performs a tracked read, `.peek()` performs the same read with
 * tracking disabled, and `.set()` normalizes direct values and updater
 * callbacks into a write operation.
 *
 * @template T
 * @param {SignalNode<T>} node Internal signal node to expose.
 * @returns {Signal<T>} Public signal object.
 */
function createSignalApi<T>(node: SignalNode<T>): Signal<T> {
  const readTracked = () => signalOper(node) as T;
  const readUntracked = () => withNoTracking(() => signalOper(node) as T);
  const write = (value: T) => {
    signalOper(node, value);
  };
  return {
    get value() {
      return readTracked();
    },
    set(update) {
      const nextValue =
        typeof update === "function"
          ? (update as (prev: T) => T)(readUntracked())
          : update;
      write(nextValue);
    },
    peek() {
      return readUntracked();
    },
    __type__: "signal",
  };
}

/**
 * Create a mutable signal that tracks reads and notifies dependents on updates.
 *
 * Signals are the mutable source nodes of the reactive graph. Reading `.value`
 * links the signal to the currently running effect or computed node. Calling
 * `.set()` updates the value and propagates only when `Object.is` reports a
 * real change.
 *
 * @template T
 * @param {T} initialValue Initial value stored in the signal.
 * @returns {Signal<T>} Reactive signal instance.
 */
function signal<T>(initialValue: T): Signal<T>;
function signal<T = undefined>(initialValue?: T): Signal<T> {
  return createSignalApi(createSignalNode(initialValue as T));
}

export { signal };
