export {
  // Namespace enum
  Namespace,
  // DOM insertion
  append,
  // Events
  event,
  // DOM navigation
  firstChild,
  // DOM generation
  fromTree,
  insert,
  nextSibling,
  // List reconciliation
  reconcile,
  // DOM attributes and properties
  setAttr,
  setProp,
  // DOM text
  setText,
  // DOM spread
  spread,
} from "@dathra/runtime";

export { createRoot, onCleanup, templateEffect } from "@dathra/reactivity";

export type {
  // Tree types
  Attrs,
  FC,
  FCWithChildren,
  Placeholder,
  PlaceholderType,
  SpreadProps,
  TextContent,
  Tree,
  TreeNode,
  // Component types
  dathraElement,
  dathraJSX,
  dathraNode,
  dathraSpreadChildren,
} from "@dathra/runtime";

export type { Owner, RootDispose } from "@dathra/reactivity";

export {
  MarkerType,
  createMarker,
  renderDynamicAttr,
  renderDynamicEach,
  renderDynamicInsert,
  renderDynamicSpread,
  renderDynamicText,
  renderToString,
  renderTree,
  serializeState,
} from "@dathra/runtime/ssr";

export type {
  RenderContext,
  RenderOptions,
  SerializableValue,
  StateObject,
} from "@dathra/runtime/ssr";

export {
  HydrationMismatchError,
  registerClientAction,
  createHydrationContext,
  createWalker,
  deserializeState,
  findMarker,
  hydrate,
  hydrateIslands,
  hydrateRoot,
  isHydrated,
  parseStateScript,
} from "@dathra/runtime/hydration";

export type { HydrationContext, MarkerInfo } from "@dathra/runtime/hydration";
