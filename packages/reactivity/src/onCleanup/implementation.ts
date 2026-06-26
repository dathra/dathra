/**
 * onCleanup implementation - register cleanup function in current scope.
 * Supports both createRoot scopes and effect scopes.
 * @module
 */
import { getCurrentEffectCleanups, getCurrentOwner } from "../internal/state";

/**
 * Register a cleanup function to be called when the current scope is disposed.
 * When called inside an `effect`, the cleanup runs before the effect re-executes
 * or when the effect is stopped. When called inside a `createRoot`, the cleanup
 * runs when the root is disposed.
 *
 * Effect cleanups take priority over root cleanups. This matters for an effect
 * created inside a root: `onCleanup` should belong to the effect execution so it
 * can run before re-execution, not only when the root is disposed. Calls outside
 * both scopes are treated as no-ops.
 *
 * @param {() => void} fn Cleanup function to register.
 */
function onCleanup(fn: () => void): void {
  const effectCleanups = getCurrentEffectCleanups();
  if (effectCleanups !== undefined) {
    effectCleanups.push(fn);
    return;
  }
  const owner = getCurrentOwner();
  if (owner !== undefined) {
    owner.cleanups.push(fn);
  }
}

export { onCleanup };
