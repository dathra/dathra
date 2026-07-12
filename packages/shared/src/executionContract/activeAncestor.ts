import { fail, type ValidationPath } from "./identity";

/** Tracks object identities that are active in one traversal operation. */
interface ActiveAncestorTracker {
  /** Enters an object occurrence or rejects an active-ancestor cycle. */
  enter(value: object, path: ValidationPath): void;

  /** Leaves the exact current object occurrence. */
  leave(value: object): void;
}

interface ActiveAncestorNode {
  readonly value: object;
  readonly parent: ActiveAncestorNode | undefined;
}

class OperationActiveAncestorTracker implements ActiveAncestorTracker {
  readonly #activeIdentities = new WeakSet<object>();
  #top: ActiveAncestorNode | undefined;

  enter(value: object, path: ValidationPath): void {
    if (this.#activeIdentities.has(value)) {
      fail(
        "invalid-closed-record",
        path,
        "Closed data must not contain an active-ancestor cycle",
      );
    }

    const next = { value, parent: this.#top };
    this.#activeIdentities.add(value);
    this.#top = next;
  }

  leave(value: object): void {
    const top = this.#top;
    if (top === undefined || top.value !== value) {
      throw new TypeError(
        "[dathra] Active ancestors must leave in exact reverse order",
      );
    }
    this.#activeIdentities.delete(value);
    this.#top = top.parent;
  }
}

/** Creates a fresh active-ancestor tracker for one traversal operation. */
function createActiveAncestorTracker(): ActiveAncestorTracker {
  return new OperationActiveAncestorTracker();
}

export { createActiveAncestorTracker };
export type { ActiveAncestorTracker };
