/**
 * templateEffect implementation - effect that is tracked by owner scope.
 * @module
 */
import { effect } from "../effect/implementation";
import { getCurrentOwner } from "../internal/state";

/**
 * Register a template effect that re-runs when tracked dependencies change.
 *
 * This is a lifecycle-aware wrapper around `effect`. It creates a normal effect
 * and, when a current root owner exists, stores the returned stop function in
 * `owner.effects` so `createRoot().dispose()` can stop it automatically. Outside
 * a root it still runs as an effect, but there is no owner to auto-dispose it.
 *
 * Unlike `effect`, this is designed for template updates and is automatically
 * tracked by the current owner scope (createRoot).
 * @param {() => void} fn Effect function to execute and track.
 */
function templateEffect(fn: () => void): void {
  const cleanup = effect(fn);
  const owner = getCurrentOwner();
  if (owner !== undefined) {
    owner.effects.push(cleanup);
  }
}

export { templateEffect };
