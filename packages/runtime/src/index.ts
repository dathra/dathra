// DOM generation
export { fromMarkup, fromTree } from "./dom/fromTree/implementation";

// DOM navigation
export { firstChild, nextSibling } from "./dom/navigation/implementation";

// DOM text
export { setText } from "./dom/text/implementation";

// DOM attributes and properties
export { setAttr, setProp } from "./dom/attr/implementation";

// DOM spread
export { spread } from "./dom/spread/implementation";
export type { SpreadProps } from "./dom/spread/implementation";

// DOM insertion
export { append, insert } from "./dom/insertion/implementation";

// List reconciliation
export { reconcile } from "./reconcile/implementation";

// Events
export { event } from "./events/implementation";

// JSX types
export type {
  JSX as RuntimeJSX,
  dathraElement,
  dathraJSX,
  dathraNode,
  dathraSpreadChildren,
} from "./types/JSX";

// Component types
export type { FC, FCWithChildren } from "./types/FC";

// Islands metadata contract
export {
  CLIENT_ACTIONS_METADATA_ATTRIBUTE,
  CLIENT_STRATEGY_METADATA_ATTRIBUTE,
  CLIENT_TARGET_METADATA_ATTRIBUTE,
  COLOCATED_CLIENT_STRATEGIES,
  DEFAULT_INTERACTION_EVENT_TYPE,
  ISLAND_METADATA_ATTRIBUTE,
  ISLAND_STRATEGIES,
  ISLAND_VALUE_METADATA_ATTRIBUTE,
  isColocatedClientStrategyName,
  isIslandStrategyName,
} from "@dathra/shared";
export type {
  ColocatedClientStrategyName,
  IslandStrategyName,
} from "@dathra/shared";

export {
  getClientAction,
  registerClientAction,
} from "./hydration/hydrate/implementation";

export {
  renderDynamicAttr,
  renderDynamicEach,
  renderDynamicInsert,
  renderDynamicSpread,
  renderDynamicText,
} from "./ssr/render/implementation";

// Tree types
export { Namespace } from "./types/tree";
export type {
  Attrs,
  Placeholder,
  PlaceholderType,
  TextContent,
  Tree,
  TreeNode,
} from "./types/tree";
