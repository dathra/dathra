/**
 * Reactive system integration with alien-signals.
 * Provides the core reactive primitives and flags.
 * @module
 */
import {
  createReactiveSystem,
  ReactiveFlags,
  type Link,
} from "alien-signals/system";

import type { BaseNode, ComputedNode, SignalNode, WatcherNode } from "./nodes";

/** Internal flag for queued effects */
const QUEUED_FLAG = 1 << 6;

let cycle = 0;
let runDepth = 0;
let batchDepth = 0;
let notifyIndex = 0;
let queuedEffectsLength = 0;
let activeSub: BaseNode | undefined;

const queuedEffects: (WatcherNode | undefined)[] = [];

/**
 * Set the currently collecting subscriber node.
 *
 * While an effect or computed getter runs, reads link their source node to this
 * active subscriber. The previous subscriber is returned so nested executions
 * can restore the outer tracking context.
 *
 * @param {BaseNode | undefined} sub Node that should collect dependencies.
 * @returns {BaseNode | undefined} Previously active subscriber.
 */
function setActiveSub(sub: BaseNode | undefined) {
  const previous = activeSub;
  activeSub = sub;
  return previous;
}

/**
 * Restore the active subscriber after a nested tracked execution finishes.
 *
 * @param {BaseNode | undefined} previous Subscriber returned by `setActiveSub`.
 */
function unsetActiveSub(previous: BaseNode | undefined) {
  activeSub = previous;
}

/**
 * Get the node that should receive dependency links for tracked reads.
 *
 * @returns {BaseNode | undefined} Current active subscriber, if any.
 */
function getActiveSub(): BaseNode | undefined {
  return activeSub;
}

/**
 * Get the current reactive update cycle counter.
 *
 * The counter is advanced whenever a watcher or computed node is evaluated so
 * alien-signals can distinguish work performed in different cycles.
 *
 * @returns {number} Current cycle number.
 */
function getCycle(): number {
  return cycle;
}

/**
 * Advance the reactive update cycle counter.
 */
function incrementCycle(): void {
  ++cycle;
}

/**
 * Mark the start of an effect or computed execution.
 */
function enterRun(): void {
  ++runDepth;
}

/**
 * Mark the end of an effect or computed execution.
 */
function exitRun(): void {
  --runDepth;
}

/**
 * Check whether an effect or computed node is currently executing.
 *
 * @returns {boolean} True when `runDepth` is greater than zero.
 */
function isRunning(): boolean {
  return runDepth > 0;
}

/**
 * Start a notification batch.
 *
 * Signal writes made while `batchDepth` is positive queue watchers instead of
 * flushing them immediately.
 */
function startBatch(): void {
  ++batchDepth;
}

/**
 * Run all queued watcher effects in insertion order.
 *
 * Each watcher has its queued flag cleared before execution. Watchers added
 * during the flush are picked up by the same loop until the queue is exhausted.
 */
function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const watcher = queuedEffects[notifyIndex] as WatcherNode;
    queuedEffects[notifyIndex++] = undefined;
    runWatcher(watcher, (watcher.flags &= ~QUEUED_FLAG));
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}

/**
 * End a notification batch and flush when the outermost batch completes.
 */
function endBatch(): void {
  batchDepth -= 1;
  if (batchDepth === 0) {
    flush();
  }
}

/**
 * Get the current batch nesting depth.
 *
 * @returns {number} Number of active nested batches.
 */
function getBatchDepth(): number {
  return batchDepth;
}

const { link, unlink, propagate, checkDirty, shallowPropagate } =
  createReactiveSystem({
    update(node: SignalNode<unknown> | ComputedNode<unknown>): boolean {
      return node.kind === "computed"
        ? updateComputed(node)
        : updateSignal(node, node.value);
    },
    notify(node: WatcherNode) {
      notifyWatcher(node);
    },
    unwatched(node: SignalNode<unknown> | ComputedNode<unknown> | WatcherNode) {
      if (node.kind === "computed") {
        let toRemove = node.deps;
        if (toRemove !== undefined) {
          do {
            toRemove = unlink(toRemove, node);
          } while (toRemove !== undefined);
        }
      } else if (node.kind === "effect") {
        effectCleanup(node as WatcherNode);
      } else if (node.kind === "scope") {
        scopeCleanup(node as WatcherNode);
      }
    },
  });

/**
 * Queue a watcher for execution, collapsing duplicate notifications.
 *
 * If the watcher has downstream watcher subscribers, scheduling walks to the
 * deepest watcher so only the final side-effect is queued. `QUEUED_FLAG`
 * prevents the same watcher from entering the queue multiple times.
 *
 * @param {WatcherNode} node Watcher to schedule.
 */
function scheduleWatcher(node: WatcherNode): void {
  const flags = node.flags;
  if ((flags & QUEUED_FLAG) === 0) {
    node.flags = flags | QUEUED_FLAG;
    const subs = node.subs;
    if (subs !== undefined) {
      scheduleWatcher(subs.sub as WatcherNode);
    } else {
      queuedEffects[queuedEffectsLength++] = node;
    }
  }
}

/**
 * Handle a watcher notification from alien-signals.
 *
 * @param {WatcherNode} node Watcher marked dirty or pending.
 */
function notifyWatcher(node: WatcherNode): void {
  scheduleWatcher(node);
}

/**
 * Remove dependencies that were not touched during the latest tracked run.
 *
 * A tracked run moves `depsTail` as dependencies are reused or appended. After
 * the run, links after that tail are stale and must be unlinked so future writes
 * to old dependencies no longer notify this subscriber.
 *
 * @param {BaseNode} sub Subscriber whose stale dependency links are removed.
 */
function purgeDeps(sub: BaseNode): void {
  const depsTail = sub.depsTail;
  let toRemove = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (toRemove !== undefined) {
    toRemove = unlink(toRemove, sub);
  }
}

/**
 * Execute a watcher when its dependencies require it.
 *
 * Dirty watchers always run. Pending watchers first ask alien-signals whether
 * any dependency actually changed. During execution the watcher becomes the
 * active subscriber, so reads rebuild its dependency list. If it does not need
 * to run, queued dependency watchers are drained instead.
 *
 * @param {WatcherNode} node Watcher to evaluate.
 * @param {number} flags Flags captured before clearing `QUEUED_FLAG`.
 */
function runWatcher(node: WatcherNode, flags: number): void {
  let shouldRun = (flags & ReactiveFlags.Dirty) !== 0;
  if (!shouldRun && (flags & ReactiveFlags.Pending) !== 0) {
    shouldRun = checkDirty(node.deps as Link, node);
    if (!shouldRun) {
      node.flags = flags & ~ReactiveFlags.Pending;
    }
  }

  if (shouldRun) {
    incrementCycle();
    node.depsTail = undefined;
    node.flags =
      (node.flags & ~(ReactiveFlags.Dirty | ReactiveFlags.Pending)) |
      ReactiveFlags.Watching |
      ReactiveFlags.RecursedCheck;
    const prevSub = setActiveSub(node);
    try {
      enterRun();
      if (node.kind === "effect") {
        node.fn();
      }
    } finally {
      exitRun();
      unsetActiveSub(prevSub);
      node.flags &= ~ReactiveFlags.RecursedCheck;
      purgeDeps(node);
    }
  } else {
    let linkNode = node.deps;
    while (linkNode !== undefined) {
      const dep = linkNode.dep as BaseNode;
      const depFlags = dep.flags;
      if ((depFlags & QUEUED_FLAG) !== 0) {
        runWatcher(dep as WatcherNode, (dep.flags = depFlags & ~QUEUED_FLAG));
      }
      linkNode = linkNode.nextDep;
    }
  }
}

/**
 * Recompute a computed node and report whether its value changed.
 *
 * The getter receives the previous value and runs with the computed node as the
 * active subscriber, allowing dependency links to be rebuilt. On failure, stale
 * dependencies are preserved and the node remains dirty so a later read can
 * retry safely.
 *
 * @template T
 * @param {ComputedNode<T>} computed Computed node to update.
 * @returns {boolean} True when the cached value changed.
 */
function updateComputed<T>(computed: ComputedNode<T>): boolean {
  incrementCycle();
  const oldDepsTail = computed.depsTail;
  computed.depsTail = undefined;
  computed.flags = ReactiveFlags.Mutable | ReactiveFlags.RecursedCheck;
  const prevSub = setActiveSub(computed);
  let succeeded = false;
  try {
    enterRun();
    const oldValue = computed.value;
    const newValue = computed.getter(oldValue) as T;
    computed.value = newValue;
    succeeded = true;
    return !Object.is(oldValue, newValue);
  } finally {
    exitRun();
    unsetActiveSub(prevSub);
    computed.flags &= ~ReactiveFlags.RecursedCheck;
    if (succeeded) {
      purgeDeps(computed);
    } else {
      // Restore depsTail so deps are not purged
      computed.depsTail = oldDepsTail;
      // Mark as dirty so it will retry on next read
      computed.flags |= ReactiveFlags.Dirty;
      const subs = computed.subs;
      if (subs !== undefined) {
        shallowPropagate(subs);
      }
    }
  }
}

/**
 * Synchronize a signal's previous value and report whether it changed.
 *
 * Signal writes update `value` first. This helper updates `previousValue` and
 * uses `Object.is` so unchanged values, including `NaN`, do not propagate.
 *
 * @template T
 * @param {SignalNode<T>} signal Signal node to update.
 * @param {T} value Current signal value.
 * @returns {boolean} True when the previous value differs from `value`.
 */
function updateSignal<T>(signal: SignalNode<T>, value: T): boolean {
  signal.flags = ReactiveFlags.Mutable;
  const prev = signal.previousValue;
  signal.previousValue = value;
  return !Object.is(prev, value);
}

/**
 * Stop a watcher effect and clear its reactive graph state.
 *
 * @param {WatcherNode} node Effect watcher to stop.
 */
function effectCleanup(node: WatcherNode): void {
  scopeCleanup(node);
  node.flags = ReactiveFlags.None;
}

/**
 * Unlink a watcher from its dependencies and owned subscriber chain.
 *
 * This is used for effect cleanup and nested watcher scope cleanup. Removing
 * these links prevents future source writes from notifying the stopped watcher
 * and detaches child watchers created under it.
 *
 * @param {WatcherNode} node Watcher or scope to detach.
 */
function scopeCleanup(node: WatcherNode): void {
  let dep = node.deps;
  while (dep !== undefined) {
    dep = unlink(dep, node);
  }
  const sub = node.subs;
  if (sub !== undefined) {
    unlink(sub);
  }
}

export {
  checkDirty,
  effectCleanup,
  endBatch,
  enterRun,
  exitRun,
  flush,
  getActiveSub,
  getBatchDepth,
  getCycle,
  incrementCycle,
  isRunning,
  link,
  propagate,
  purgeDeps,
  QUEUED_FLAG,
  ReactiveFlags,
  scopeCleanup,
  setActiveSub,
  shallowPropagate,
  startBatch,
  unlink,
  unsetActiveSub,
  updateComputed,
  updateSignal,
};
export type { Link };
