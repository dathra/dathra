import { hydrateIslands } from "@dathra/runtime/hydration";

/** Root node accepted by the core hydration convenience API. */
type HydrationRoot = Parameters<typeof hydrateIslands>[0];

/**
 * Hydrate Dathra islands under the provided root.
 */
function hydrate(
  root: HydrationRoot = document,
): ReturnType<typeof hydrateIslands> {
  return hydrateIslands(root);
}

export { hydrate };
export type { HydrationRoot };
