import type {
  ColocatedClientStrategyName,
  IslandStrategyName,
} from "@dathra/shared";

/**
 * Transform options for the Dathra transformer.
 */
interface TransformOptions {
  /**
   * Transformation mode.
   * - 'csr': Client-side rendering (default)
   * - 'ssr': Server-side rendering
   */
  mode?: "csr" | "ssr";

  /**
   * Whether to generate source maps.
   */
  sourceMap?: boolean;

  /**
   * The file name for source map generation.
   */
  filename?: string;

  /**
   * The module to import runtime functions from.
   * Default: '@dathra/runtime'
   */
  runtimeModule?: string;
}

/**
 * Result of a transformation.
 */
interface TransformResult {
  /**
   * The transformed code.
   */
  code: string;

  /**
   * Source map (if requested).
   */
  map?: string;
}

interface IslandsMetadataContract {
  hostMetadataAttribute: "data-dh-island";
  hostValueMetadataAttribute: "data-dh-island-value";
  clientTargetMetadataAttribute: "data-dh-client-target";
  clientStrategyMetadataAttribute: "data-dh-client-strategy";
  clientEventMetadataAttribute: "data-dh-client-event";
  defaultInteractionEventType: "click";
  hostStrategies: readonly IslandStrategyName[];
  colocatedStrategies: readonly ColocatedClientStrategyName[];
}

interface NestedBoundaryRef {
  path: readonly number[];
  tagName: string;
  islandStrategy: IslandStrategyName | null;
}

interface SupportedComponentHydrationMetadata {
  kind: "generic-plan";
  planFactory: unknown;
}

interface UnsupportedComponentHydrationMetadata {
  kind: "generic-plan";
  unsupportedReason: string;
}

type ComponentHydrationMetadata =
  | SupportedComponentHydrationMetadata
  | UnsupportedComponentHydrationMetadata;

export type {
  ComponentHydrationMetadata,
  IslandsMetadataContract,
  NestedBoundaryRef,
  SupportedComponentHydrationMetadata,
  TransformOptions,
  TransformResult,
  UnsupportedComponentHydrationMetadata,
};
