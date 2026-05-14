import type { AtomStore } from "../createAtomStore/implementation";
import {
  getCurrentStore as readCurrentStore,
  runWithStoreContext,
} from "./internal";

/**
 * Returns the currently active AtomStore set by the nearest enclosing
 * `withStore` boundary, or `undefined` if called outside any boundary.
 */
function getCurrentStore(): AtomStore | undefined {
  return readCurrentStore();
}

/**
 * Evaluates `render` within an explicit store boundary.
 *
 * All Dathra APIs that access the current store (component rendering,
 * atom reads, SSR) will resolve `store` as the active store for the
 * duration of the `render` callback.
 *
 * Nested `withStore` calls shadow the outer store; when the inner
 * callback returns, the outer store is restored.
 *
 * @example
 * ```ts
 * // Root boundary
 * mount(root, withStore(store, () => <App />));
 *
 * // Nested boundary with forked store
 * withStore(childStore, () => <Subtree />);
 * ```
 */
function withStore<T>(store: AtomStore, render: () => T): T {
  return runWithStoreContext(store, render);
}

export { getCurrentStore, withStore };
