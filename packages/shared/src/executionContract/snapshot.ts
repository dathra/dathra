import type { ClosedDataPlan } from "./occurrencePlan";

/** Represents a mutable closed-data clone detached from caller-owned values. */
type ClosedDataClone =
  | null
  | boolean
  | number
  | string
  | { [key: string]: ClosedDataClone }
  | ClosedDataClone[];

function defineOwnDataProperty(
  target: object,
  key: PropertyKey,
  value: ClosedDataClone,
): void {
  const defined = Reflect.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define closed data clone property");
  }
}

function createRecordClone(): { [key: string]: ClosedDataClone } {
  const record: unknown = Object.create(null);
  return record as { [key: string]: ClosedDataClone };
}

function clonePlanNode(node: ClosedDataPlan["nodes"][number]): ClosedDataClone {
  switch (node.kind) {
    case "null":
    case "boolean":
    case "number":
    case "string":
      return node.value;
    case "record":
      return createRecordClone();
    case "array":
      return [];
  }
}

/** Materializes a fresh alias-expanded tree from a completed occurrence plan. */
function cloneClosedDataPlan(plan: ClosedDataPlan): ClosedDataClone {
  const nodes = plan.nodes;
  const materializedNodes: ClosedDataClone[] = [];
  let root: ClosedDataClone = null;
  let hasRoot = false;

  for (let index = 0; index < nodes.length; index += 1) {
    const node = nodes[index];
    const clone = clonePlanNode(node);

    if (node.parentOccurrenceId === null) {
      if (hasRoot) {
        throw new TypeError("[dathra] Closed data plan has multiple roots");
      }
      root = clone;
      hasRoot = true;
    } else {
      if (
        node.segment === null ||
        !Object.hasOwn(materializedNodes, node.parentOccurrenceId)
      ) {
        throw new TypeError("[dathra] Closed data plan has an invalid parent");
      }
      const parent = materializedNodes[node.parentOccurrenceId];
      if (parent === null || typeof parent !== "object") {
        throw new TypeError(
          "[dathra] Closed data plan parent is not a container",
        );
      }
      defineOwnDataProperty(parent, node.segment, clone);
    }

    defineOwnDataProperty(materializedNodes, node.occurrenceId, clone);
  }

  if (!hasRoot) {
    throw new TypeError("[dathra] Closed data plan has no root");
  }
  return root;
}

export { cloneClosedDataPlan };
export type { ClosedDataClone };
