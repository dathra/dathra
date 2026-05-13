/**
 * Effect implementation - reactive side effect.
 * @module
 */
import { createEffectNode } from "../internal/helpers";
import { setCurrentEffectCleanups } from "../internal/state";
import {
  effectCleanup,
  enterRun,
  exitRun,
  link,
  ReactiveFlags,
  setActiveSub,
  unsetActiveSub,
} from "../internal/system";
import type { EffectCleanup } from "../types";

/**
 * Run and flush all registered effect-scope cleanup functions.
 */
function runEffectCleanups(cleanups: (() => void)[]): void {
  for (const fn of cleanups) {
    fn();
  }
  cleanups.length = 0;
}

/**
 * Register a reactive side-effect that re-runs when tracked dependencies change.
 * Supports `onCleanup` calls within the effect body: registered cleanups run
 * before each re-execution and when the returned stop function is called.
 * @param {() => void} fn Effect function to execute and track.
 * @returns {EffectCleanup} Cleanup function that stops the effect.
 */
function effect(fn: () => void): EffectCleanup {
  const effectCleanups: (() => void)[] = [];

  /**
   * Wrapped fn that manages effect-scope cleanups around each re-execution.
   */
  const wrappedFn = () => {
    runEffectCleanups(effectCleanups);
    const prev = setCurrentEffectCleanups(effectCleanups);
    try {
      fn();
    } finally {
      setCurrentEffectCleanups(prev);
    }
  };

  const effectNode = createEffectNode(wrappedFn);
  const prevSub = setActiveSub(effectNode);
  if (prevSub !== undefined) {
    link(effectNode, prevSub, 0);
  }
  // Run fn directly for the initial execution (no previous cleanups to flush)
  const prev = setCurrentEffectCleanups(effectCleanups);
  effectNode.flags |= ReactiveFlags.RecursedCheck;
  try {
    enterRun();
    fn();
  } finally {
    exitRun();
    effectNode.flags &= ~ReactiveFlags.RecursedCheck;
    setCurrentEffectCleanups(prev);
    unsetActiveSub(prevSub);
  }

  return () => {
    runEffectCleanups(effectCleanups);
    effectCleanup(effectNode);
  };
}

export { effect };
