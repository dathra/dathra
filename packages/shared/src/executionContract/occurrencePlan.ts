import type { ValidationPath } from "./identity";

/** Identifies one record property or array item in a closed-data path. */
type ClosedDataPathSegment = string | number;

/** Classifies one occurrence without retaining its caller-owned value. */
type ClosedDataPlanNodeValue =
  | { readonly kind: "null"; readonly value: null }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "record" }
  | { readonly kind: "array" };

/** Identifies one path occurrence without retaining its complete path. */
interface ClosedDataOccurrence {
  readonly occurrenceId: number;
  readonly parentOccurrenceId: number | null;
  readonly segment: ClosedDataPathSegment | null;
  readonly depth: number;
  readonly path: ValidationPath;

  /** Returns a deferred path for a direct child slot. */
  childPath(segment: ClosedDataPathSegment): ValidationPath;
}

interface ClosedDataPlanNodeLocation {
  readonly occurrenceId: number;
  readonly parentOccurrenceId: number | null;
  readonly segment: ClosedDataPathSegment | null;
  readonly depth: number;
}

/** Stores one classified occurrence and its parent-linked location. */
type ClosedDataPlanNode = ClosedDataPlanNodeLocation & ClosedDataPlanNodeValue;

/** A preorder occurrence sequence for later closed-data processing. */
interface ClosedDataPlan {
  readonly nodes: readonly ClosedDataPlanNode[];
}

/** Builds one operation-local parent-linked occurrence plan. */
interface OccurrencePlanBuilder {
  rootPath(): ValidationPath;
  childPath(
    parentOccurrenceId: number,
    segment: ClosedDataPathSegment,
  ): ValidationPath;
  appendRoot(value: ClosedDataPlanNodeValue): ClosedDataOccurrence;
  appendChild(
    parentOccurrenceId: number,
    segment: ClosedDataPathSegment,
    value: ClosedDataPlanNodeValue,
  ): ClosedDataOccurrence;
  finish(): ClosedDataPlan;
}

function defineArrayElement<Value>(
  target: Value[],
  index: number,
  value: Value,
): void {
  const defined = Reflect.defineProperty(target, index, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define occurrence plan state");
  }
}

function appendArrayElement<Value>(target: Value[], value: Value): void {
  defineArrayElement(target, target.length, value);
}

function requirePlanNode(
  nodes: readonly ClosedDataPlanNode[],
  occurrenceId: number,
): ClosedDataPlanNode {
  if (
    !Number.isSafeInteger(occurrenceId) ||
    occurrenceId < 0 ||
    occurrenceId >= nodes.length
  ) {
    throw new TypeError("[dathra] Unknown parent occurrence ID");
  }
  return nodes[occurrenceId];
}

function materializePath(
  nodes: readonly ClosedDataPlanNode[],
  parentOccurrenceId: number | null,
  segment: ClosedDataPathSegment | null,
): ClosedDataPathSegment[] {
  if (parentOccurrenceId === null) return [];
  if (segment === null) {
    throw new TypeError("[dathra] Child occurrence path requires a segment");
  }

  const parent = requirePlanNode(nodes, parentOccurrenceId);
  const path: ClosedDataPathSegment[] = [];
  path.length = parent.depth;
  defineArrayElement(path, parent.depth - 1, segment);

  let cursor = parent;
  while (cursor.parentOccurrenceId !== null) {
    if (cursor.segment === null) {
      throw new TypeError("[dathra] Occurrence plan link requires a segment");
    }
    defineArrayElement(path, cursor.depth - 2, cursor.segment);
    cursor = requirePlanNode(nodes, cursor.parentOccurrenceId);
  }
  return path;
}

function createDeferredPath(
  materialize: () => readonly ClosedDataPathSegment[],
): ValidationPath {
  const target: ClosedDataPathSegment[] = [];
  let initialized = false;

  function initialize(): void {
    if (initialized) return;
    const path = materialize();
    for (let index = 0; index < path.length; index += 1) {
      defineArrayElement(target, index, path[index]);
    }
    Object.freeze(target);
    initialized = true;
  }

  return new Proxy(target, {
    defineProperty(pathTarget, property, descriptor) {
      initialize();
      return Reflect.defineProperty(pathTarget, property, descriptor);
    },
    deleteProperty(pathTarget, property) {
      initialize();
      return Reflect.deleteProperty(pathTarget, property);
    },
    get(pathTarget, property, receiver): unknown {
      initialize();
      return Reflect.get(pathTarget, property, receiver);
    },
    getOwnPropertyDescriptor(pathTarget, property) {
      initialize();
      return Reflect.getOwnPropertyDescriptor(pathTarget, property);
    },
    has(pathTarget, property) {
      initialize();
      return Reflect.has(pathTarget, property);
    },
    isExtensible(pathTarget) {
      initialize();
      return Reflect.isExtensible(pathTarget);
    },
    ownKeys(pathTarget) {
      initialize();
      return Reflect.ownKeys(pathTarget);
    },
    preventExtensions(pathTarget) {
      initialize();
      return Reflect.preventExtensions(pathTarget);
    },
    set(pathTarget, property, value, receiver) {
      initialize();
      return Reflect.set(pathTarget, property, value, receiver);
    },
    setPrototypeOf(pathTarget, prototype) {
      initialize();
      return Reflect.setPrototypeOf(pathTarget, prototype);
    },
  });
}

function createPlanNode(
  location: ClosedDataPlanNodeLocation,
  value: ClosedDataPlanNodeValue,
): ClosedDataPlanNode {
  switch (value.kind) {
    case "null":
      return Object.freeze({ ...location, kind: "null", value: value.value });
    case "boolean":
      return Object.freeze({
        ...location,
        kind: "boolean",
        value: value.value,
      });
    case "number":
      return Object.freeze({
        ...location,
        kind: "number",
        value: value.value,
      });
    case "string":
      return Object.freeze({
        ...location,
        kind: "string",
        value: value.value,
      });
    case "record":
      return Object.freeze({ ...location, kind: "record" });
    case "array":
      return Object.freeze({ ...location, kind: "array" });
  }
}

function createOccurrence(
  nodes: readonly ClosedDataPlanNode[],
  node: ClosedDataPlanNode,
  path: ValidationPath,
): ClosedDataOccurrence {
  return Object.freeze({
    occurrenceId: node.occurrenceId,
    parentOccurrenceId: node.parentOccurrenceId,
    segment: node.segment,
    depth: node.depth,
    path,
    childPath(segment: ClosedDataPathSegment): ValidationPath {
      return createDeferredPath(() =>
        materializePath(nodes, node.occurrenceId, segment),
      );
    },
  });
}

class OperationOccurrencePlanBuilder implements OccurrencePlanBuilder {
  readonly #nodes: ClosedDataPlanNode[] = [];
  #finished = false;

  rootPath(): ValidationPath {
    return createDeferredPath(() => materializePath(this.#nodes, null, null));
  }

  childPath(
    parentOccurrenceId: number,
    segment: ClosedDataPathSegment,
  ): ValidationPath {
    requirePlanNode(this.#nodes, parentOccurrenceId);
    return createDeferredPath(() =>
      materializePath(this.#nodes, parentOccurrenceId, segment),
    );
  }

  appendRoot(value: ClosedDataPlanNodeValue): ClosedDataOccurrence {
    this.#requireAppendable();
    if (this.#nodes.length !== 0) {
      throw new TypeError("[dathra] Occurrence plan already has a root");
    }

    const node = createPlanNode(
      {
        occurrenceId: 0,
        parentOccurrenceId: null,
        segment: null,
        depth: 1,
      },
      value,
    );
    const occurrence = createOccurrence(this.#nodes, node, this.rootPath());
    appendArrayElement(this.#nodes, node);
    return occurrence;
  }

  appendChild(
    parentOccurrenceId: number,
    segment: ClosedDataPathSegment,
    value: ClosedDataPlanNodeValue,
  ): ClosedDataOccurrence {
    this.#requireAppendable();
    const parent = requirePlanNode(this.#nodes, parentOccurrenceId);
    const node = createPlanNode(
      {
        occurrenceId: this.#nodes.length,
        parentOccurrenceId,
        segment,
        depth: parent.depth + 1,
      },
      value,
    );
    const occurrence = createOccurrence(
      this.#nodes,
      node,
      this.childPath(parentOccurrenceId, segment),
    );
    appendArrayElement(this.#nodes, node);
    return occurrence;
  }

  finish(): ClosedDataPlan {
    if (this.#finished) {
      throw new TypeError("[dathra] Occurrence plan is already finished");
    }
    if (this.#nodes.length === 0) {
      throw new TypeError("[dathra] Cannot finish an empty occurrence plan");
    }

    const plan = Object.freeze({ nodes: Object.freeze(this.#nodes) });
    this.#finished = true;
    return plan;
  }

  #requireAppendable(): void {
    if (this.#finished) {
      throw new TypeError(
        "[dathra] Cannot append to a finished occurrence plan",
      );
    }
  }
}

/** Creates a fresh occurrence plan builder for one closed-data operation. */
function createOccurrencePlanBuilder(): OccurrencePlanBuilder {
  return new OperationOccurrencePlanBuilder();
}

export { createOccurrencePlanBuilder };
export type {
  ClosedDataOccurrence,
  ClosedDataPathSegment,
  ClosedDataPlan,
  ClosedDataPlanNode,
  ClosedDataPlanNodeValue,
  OccurrencePlanBuilder,
};
