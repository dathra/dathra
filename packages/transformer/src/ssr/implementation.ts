/**
 * SSR code generation utilities for the transformer.
 *
 * Per SPEC.typ:
 * - Generates code that renders to HTML strings with markers
 * - Uses renderToString from @dathra/runtime
 * - Serializes Signal initial values
 *
 * Note: The main SSR transformation is handled in transform.ts
 * This file contains utility functions for SSR-specific operations.
 *
 * Uses the shared ESTree node builders from @/transform/ast.
 */

import {
  nArr,
  nCall,
  nId,
  nLit,
  nNew,
  nObj,
  nProp,
  type ESTNode,
} from "@/transform/ast/implementation";

// ---------------------------------------------------------------------------
// SSR utilities
// ---------------------------------------------------------------------------

/**
 * Runtime imports specific to SSR.
 */
const SSR_IMPORTS = [
  "renderToString",
  "renderTree",
  "serializeState",
  "createMarker",
  "MarkerType",
] as const;

type SSRImport = (typeof SSR_IMPORTS)[number];

/**
 * Check if an import is an SSR-specific import.
 */
function isSSRImport(name: string): name is SSRImport {
  return SSR_IMPORTS.includes(name as SSRImport);
}

/**
 * Generate SSR render code for a tree.
 *
 * Produces: renderToString([tree], state, new Map([[1, v1], [2, v2], ...]))
 */
function generateSSRRender(
  tree: ESTNode,
  dynamicValues: ESTNode[],
  stateExpr: ESTNode | null,
): ESTNode {
  // Build indexed map entries: [[1, val1], [2, val2], ...]
  const mapEntries = dynamicValues.map((value, index) =>
    nArr([nLit(index + 1), value]),
  );

  const dynamicValuesMap = nNew(nId("Map"), [nArr(mapEntries)]);

  // renderToString([tree], state, dynamicValuesMap)
  return nCall(nId("renderToString"), [
    nArr([tree]),
    stateExpr ?? nObj([]),
    dynamicValuesMap,
  ]);
}

/**
 * Generate state object expression from Signals.
 */
function generateStateObject(signals: Map<string, ESTNode>): ESTNode {
  if (signals.size === 0) {
    return nObj([]);
  }

  const properties = Array.from(signals.entries()).map(([name, expr]) =>
    nProp(nId(name), expr),
  );

  return nObj(properties);
}

export { generateSSRRender, generateStateObject, isSSRImport, SSR_IMPORTS };
export type { SSRImport };
