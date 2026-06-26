/**
 * Owner state management for cleanup scopes.
 * @module
 */

/** Owner structure for tracking effects and cleanup functions */
interface Owner {
  effects: (() => void)[];
  cleanups: (() => void)[];
}

/** Dispose function type returned by createRoot */
type RootDispose = () => void;

let currentOwner: Owner | undefined;

/** Current effect-scope cleanup list (used by effect's internal onCleanup support) */
let currentEffectCleanups: (() => void)[] | undefined;

/**
 * Get the owner for the root scope currently being executed.
 *
 * `createRoot` sets this while running its callback so `templateEffect` and
 * root-level `onCleanup` can register work to be disposed with that root.
 *
 * @returns {Owner | undefined} Current root owner, if execution is inside one.
 */
function getCurrentOwner(): Owner | undefined {
  return currentOwner;
}

/**
 * Replace the current root owner and return the previous owner.
 *
 * Returning the previous owner lets nested roots restore the outer owner in a
 * `finally` block after their callback finishes.
 *
 * @param {Owner | undefined} owner Owner to make current.
 * @returns {Owner | undefined} Owner that was current before the replacement.
 */
function setCurrentOwner(owner: Owner | undefined): Owner | undefined {
  const previous = currentOwner;
  currentOwner = owner;
  return previous;
}

/**
 * Get the cleanup list for the effect currently being executed.
 *
 * When this is defined, `onCleanup` should register with the effect rather than
 * the root owner so the cleanup runs before re-execution and on stop.
 *
 * @returns {(() => void)[] | undefined} Current effect cleanup list, if any.
 */
function getCurrentEffectCleanups(): (() => void)[] | undefined {
  return currentEffectCleanups;
}

/**
 * Replace the current effect cleanup list and return the previous list.
 *
 * Effects use this around each execution so nested effects and root-level
 * cleanup calls can restore the caller's cleanup context correctly.
 *
 * @param {(() => void)[] | undefined} cleanups Cleanup list to make current.
 * @returns {(() => void)[] | undefined} Cleanup list that was current before.
 */
function setCurrentEffectCleanups(
  cleanups: (() => void)[] | undefined,
): (() => void)[] | undefined {
  const previous = currentEffectCleanups;
  currentEffectCleanups = cleanups;
  return previous;
}

export {
  getCurrentEffectCleanups,
  getCurrentOwner,
  setCurrentEffectCleanups,
  setCurrentOwner,
};
export type { Owner, RootDispose };
