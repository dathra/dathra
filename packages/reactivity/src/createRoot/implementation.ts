/**
 * createRoot implementation - cleanup scope for effects.
 * @module
 */
import {
  getCurrentOwner,
  setCurrentOwner,
  type Owner,
  type RootDispose,
} from "../internal/state";

/**
 * Create a cleanup scope that tracks effects and cleanup functions.
 *
 * The callback runs with a fresh owner as the current owner. `templateEffect`
 * instances created in that callback register their stop functions in
 * `owner.effects`, and `onCleanup` calls outside effect execution register in
 * `owner.cleanups`. Plain `effect` calls are not auto-tracked and must be
 * stopped manually or registered with `onCleanup`.
 *
 * Nested createRoot scopes are automatically disposed when the parent is disposed.
 * @param {(dispose: RootDispose) => void} fn Callback to run within the scope.
 * @returns {RootDispose} Dispose function that cleans up all tracked effects.
 */
function createRoot(fn: (dispose: RootDispose) => void): RootDispose {
  const owner: Owner = {
    effects: [],
    cleanups: [],
  };
  const prevOwner = getCurrentOwner();
  setCurrentOwner(owner);

  let disposed = false;

  const dispose: RootDispose = () => {
    // Idempotent: ignore subsequent calls after the first dispose
    if (disposed) return;
    disposed = true;

    for (const cleanup of owner.effects) {
      try {
        cleanup();
      } catch {
        // Silently continue with other cleanups on error
      }
    }
    for (const cleanup of owner.cleanups) {
      try {
        cleanup();
      } catch {
        // Silently continue with other cleanups on error
      }
    }
    owner.effects.length = 0;
    owner.cleanups.length = 0;
  };

  // Register this scope's dispose with parent owner
  if (prevOwner !== undefined) {
    prevOwner.cleanups.push(dispose);
  }

  try {
    fn(dispose);
  } finally {
    setCurrentOwner(prevOwner);
  }

  return dispose;
}

export { createRoot };
