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

function setActiveSub(sub: BaseNode | undefined) {
  const previous = activeSub;
  activeSub = sub;
  return previous;
}

function unsetActiveSub(previous: BaseNode | undefined) {
  activeSub = previous;
}

function getActiveSub(): BaseNode | undefined {
  return activeSub;
}

function getCycle(): number {
  return cycle;
}

function incrementCycle(): void {
  ++cycle;
}

function enterRun(): void {
  ++runDepth;
}

function exitRun(): void {
  --runDepth;
}

function isRunning(): boolean {
  return runDepth > 0;
}

function startBatch(): void {
  ++batchDepth;
}

function flush(): void {
  while (notifyIndex < queuedEffectsLength) {
    const watcher = queuedEffects[notifyIndex] as WatcherNode;
    queuedEffects[notifyIndex++] = undefined;
    runWatcher(watcher, (watcher.flags &= ~QUEUED_FLAG));
  }
  notifyIndex = 0;
  queuedEffectsLength = 0;
}

function endBatch(): void {
  batchDepth -= 1;
  if (batchDepth === 0) {
    flush();
  }
}

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

function notifyWatcher(node: WatcherNode): void {
  scheduleWatcher(node);
}

function purgeDeps(sub: BaseNode): void {
  const depsTail = sub.depsTail;
  let toRemove = depsTail !== undefined ? depsTail.nextDep : sub.deps;
  while (toRemove !== undefined) {
    toRemove = unlink(toRemove, sub);
  }
}

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
    }
  }
}

function updateSignal<T>(signal: SignalNode<T>, value: T): boolean {
  signal.flags = ReactiveFlags.Mutable;
  const prev = signal.previousValue;
  signal.previousValue = value;
  return !Object.is(prev, value);
}

function effectCleanup(node: WatcherNode): void {
  scopeCleanup(node);
  node.flags = ReactiveFlags.None;
}

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
