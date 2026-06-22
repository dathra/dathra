import type { ReferenceDocument } from "../types";

const runtimeReference: ReferenceDocument = {
  path: "/reference/runtime",
  title: "Runtime API Reference",
  packageName: "@dathra/runtime",
  exportPath: "@dathra/runtime",
  importPath: "@dathra/runtime",
  preferredImport: "@dathra/core/runtime for app-level convenience imports",
  level: "extension",
  audience: "Compiler output authors, runtime integrators, and Dathra contributors.",
  description: "Low-level DOM, JSX runtime, reconciliation, event, and island metadata primitives.",
  declarationFile: "packages/runtime/dist/index.d.mts",
  exports: [
    {
      label: "DOM functions",
      items: [
        "append",
        "event",
        "firstChild",
        "fromMarkup",
        "fromTree",
        "insert",
        "nextSibling",
        "reconcile",
        "setAttr",
        "setProp",
        "setText",
        "spread",
      ],
    },
    {
      label: "Island metadata",
      items: [
        "CLIENT_ACTIONS_METADATA_ATTRIBUTE",
        "CLIENT_STRATEGY_METADATA_ATTRIBUTE",
        "CLIENT_TARGET_METADATA_ATTRIBUTE",
        "COLOCATED_CLIENT_STRATEGIES",
        "DEFAULT_INTERACTION_EVENT_TYPE",
        "ISLAND_METADATA_ATTRIBUTE",
        "ISLAND_STRATEGIES",
        "ISLAND_VALUE_METADATA_ATTRIBUTE",
        "isColocatedClientStrategyName",
        "isIslandStrategyName",
      ],
    },
    {
      label: "Types",
      items: [
        "Attrs",
        "ColocatedClientStrategyName",
        "FC",
        "FCWithChildren",
        "IslandStrategyName",
        "Namespace",
        "Placeholder",
        "PlaceholderType",
        "SpreadProps",
        "TextContent",
        "Tree",
        "TreeNode",
        "dathraElement",
        "dathraJSX",
        "dathraNode",
        "dathraSpreadChildren",
      ],
    },
  ],
  apis: [
    {
      name: "fromTree() / fromMarkup()",
      kind: "function",
      description: "Create DOM fragment factories from compiler tree IR or trusted markup.",
      signature: `interface CompiledTemplateDescriptor {
  readonly kind: "compiled";
  readonly markup: string;
  readonly namespace: Namespace;
}

declare function fromTree(
  structure: readonly Tree[] | CompiledTemplateDescriptor,
  flags?: Namespace,
): () => DocumentFragment;

declare function fromMarkup(markup: string, flags?: Namespace): () => DocumentFragment;`,
      notes: ["fromMarkup parses with innerHTML. Pass only trusted or sanitized markup."],
    },
    {
      name: "DOM navigation and updates",
      kind: "function",
      description: "Primitive operations used by generated DOM update code.",
      signature: `declare function firstChild(node: Node, isText?: boolean): Node;
declare function nextSibling(node: Node): Node;
declare function setText(node: Text, value: unknown): void;
declare function setAttr(element: Element, name: string, value: unknown): void;
declare function setProp(element: Element, name: string, value: unknown): void;
declare function append(parent: Node, child: Node): void;
declare function insert(parent: Node | null | undefined, child: unknown, anchor: Node | null): void;`,
    },
    {
      name: "spread()",
      kind: "function",
      description: "Apply a set of props to a DOM element.",
      signature: `type SpreadProps = Record<string, unknown>;

declare function spread(element: Element, props: SpreadProps): void;`,
    },
    {
      name: "reconcile()",
      kind: "function",
      description: "Reconcile a list of items with DOM nodes using keyed or unkeyed mode.",
      signature: `declare function reconcile<T>(
  parent: Node,
  items: T[],
  keyFn: ((item: T) => unknown) | undefined,
  createFn: (item: T, index: number) => Node,
  updateFn?: (node: Node, item: T, index: number) => void,
): void;`,
    },
    {
      name: "event()",
      kind: "function",
      description:
        "Add an event listener that is removed when the current createRoot scope is disposed.",
      signature:
        "declare function event(type: string, element: Element, handler: EventListener): void;",
    },
    {
      name: "Island metadata constants",
      kind: "constant",
      description: "Constants and guards for Dathra island strategy metadata.",
      signature: `declare const ISLAND_STRATEGIES: readonly ["load", "idle", "visible", "media", "interaction"];
declare const COLOCATED_CLIENT_STRATEGIES: readonly ["client:load", "client:idle", "client:visible", "client:media", "client:interaction"];
type IslandStrategyName = (typeof ISLAND_STRATEGIES)[number];
type ColocatedClientStrategyName = (typeof COLOCATED_CLIENT_STRATEGIES)[number];

declare function isIslandStrategyName(value: string): value is IslandStrategyName;
declare function isColocatedClientStrategyName(value: string): value is ColocatedClientStrategyName;`,
    },
  ],
};

const runtimeSsrReference: ReferenceDocument = {
  path: "/reference/runtime/ssr",
  title: "Runtime SSR API Reference",
  packageName: "@dathra/runtime",
  exportPath: "@dathra/runtime/ssr",
  importPath: "@dathra/runtime/ssr",
  preferredImport: "@dathra/core/ssr for application SSR entries",
  level: "extension",
  audience: "SSR renderer authors, transformer output authors, and Dathra contributors.",
  description: "Low-level SSR rendering, marker, and state serialization APIs.",
  declarationFile: "packages/runtime/dist/ssr/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: [
        "createMarker",
        "createStoreScript",
        "renderDynamicAttr",
        "renderDynamicEach",
        "renderDynamicInsert",
        "renderDynamicSpread",
        "renderDynamicText",
        "renderToString",
        "renderTree",
        "serializeState",
        "setComponentRenderer",
      ],
    },
    {
      label: "Constants and types",
      items: [
        "ComponentRenderer",
        "MarkerType",
        "RenderContext",
        "RenderOptions",
        "SerializableValue",
        "StateObject",
      ],
    },
  ],
  apis: [
    {
      name: "Marker helpers",
      kind: "function",
      description: "Create hydration marker strings and store snapshot script tags for SSR output.",
      signature: `declare enum MarkerType {
  Text = "t",
  Insert = "i",
  Block = "b",
}

declare function createMarker(type: MarkerType, id: number | string): string;
declare function createStoreScript(serializedSnapshot: string): string;`,
    },
    {
      name: "renderToString() / renderTree()",
      kind: "function",
      description: "Render runtime tree IR to HTML strings.",
      signature: `declare function renderTree(tree: Tree, context: RenderContext): string;
declare function renderToString(tree: readonly Tree[], options?: RenderOptions): string;`,
    },
    {
      name: "Dynamic SSR render helpers",
      kind: "function",
      description:
        "Render compiler-emitted dynamic text, attributes, spreads, inserts, and each blocks.",
      signature: `declare function renderDynamicText(value: unknown, id: number | string, context: RenderContext): string;
declare function renderDynamicAttr(name: string, value: unknown, id: number | string, context: RenderContext): string;
declare function renderDynamicSpread(value: Record<string, unknown>, id: number | string, context: RenderContext): string;
declare function renderDynamicInsert(value: unknown, id: number | string, context: RenderContext): string;
declare function renderDynamicEach<T>(items: Iterable<T>, renderItem: (item: T, index: number) => unknown, id: number | string, context: RenderContext): string;`,
    },
    {
      name: "serializeState() and component renderer",
      kind: "function",
      description: "Serialize SSR state and plug custom-element rendering into runtime SSR.",
      signature: `type SerializableValue = string | number | boolean | null | SerializableValue[] | { [key: string]: SerializableValue };
type StateObject = Record<string, SerializableValue>;
type ComponentRenderer = (tagName: string, attrs: Record<string, unknown>) => string | null;

declare function serializeState(state: StateObject): string;
declare function setComponentRenderer(renderer: ComponentRenderer | undefined): void;`,
    },
  ],
};

const runtimeHydrationReference: ReferenceDocument = {
  path: "/reference/runtime/hydration",
  title: "Runtime Hydration API Reference",
  packageName: "@dathra/runtime",
  exportPath: "@dathra/runtime/hydration",
  importPath: "@dathra/runtime/hydration",
  preferredImport: "@dathra/core/hydration for application hydration",
  level: "extension",
  audience: "Hydration strategy authors, island integrations, and Dathra contributors.",
  description:
    "Low-level hydration, island scheduling, marker walking, and state deserialization APIs.",
  declarationFile: "packages/runtime/dist/hydration/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: [
        "cancelScheduledIslandHydration",
        "clearClientActions",
        "createHydrationContext",
        "createWalker",
        "deserializeState",
        "findMarker",
        "findMarkers",
        "getClientAction",
        "hydrate",
        "hydrateIslands",
        "hydrateRoot",
        "hydrateTextMarker",
        "hydrateWithPlan",
        "isHydrated",
        "parseStateScript",
        "parseStoreScript",
        "registerClientAction",
      ],
    },
    {
      label: "Constants and classes",
      items: ["HYDRATE_ISLANDS_HOOK", "HYDRATE_ISLANDS_STATUS", "HydrationMismatchError"],
    },
    {
      label: "Types",
      items: [
        "AttrBinding",
        "EventBinding",
        "GenericHydrationPlan",
        "HydrateIslandHook",
        "HydrateIslandsStatus",
        "HydrationBinding",
        "HydrationContext",
        "InsertBinding",
        "IslandHost",
        "IslandHydrationTrigger",
        "MarkerInfo",
        "NestedBoundaryRef",
        "SpreadBinding",
        "TextBinding",
      ],
    },
  ],
  apis: [
    {
      name: "State parsing",
      kind: "function",
      description: "Deserialize state payloads emitted by SSR.",
      signature: `declare function deserializeState(serialized: string): StateObject;
declare function parseStateScript(container: Element | ShadowRoot): StateObject | null;
declare function parseStoreScript(container: Element | ShadowRoot): StateObject | null;`,
    },
    {
      name: "Hydration entry points",
      kind: "function",
      description: "Hydrate roots, generic plans, and island hosts.",
      signature: `declare function hydrate(root: Document | Element | ShadowRoot): void;
declare function hydrateRoot(root: Document | Element | ShadowRoot): void;
declare function hydrateIslands(root: Document | Element | ShadowRoot): void;
declare function hydrateWithPlan(context: HydrationContext, plan: GenericHydrationPlan): void;
declare function hydrateTextMarker(context: HydrationContext, binding: TextBinding): void;`,
    },
    {
      name: "Client action registry",
      kind: "function",
      description:
        "Register and resolve client-side actions referenced by hydrated event bindings.",
      signature: `declare function registerClientAction(id: string, action: EventListener): void;
declare function getClientAction(id: string): EventListener | undefined;
declare function clearClientActions(): void;`,
    },
    {
      name: "Walker and marker helpers",
      kind: "function",
      description: "Create marker walkers and search hydration markers in SSR DOM.",
      signature: `declare function createWalker(root: Node): TreeWalker;
declare function findMarker(root: Node, marker: string): MarkerInfo | null;
declare function findMarkers(root: Node, prefix: string): MarkerInfo[];`,
    },
    {
      name: "Island status and scheduling",
      kind: "constant",
      description: "Observe and cancel scheduled island hydration.",
      signature: `declare const HYDRATE_ISLANDS_HOOK: unique symbol;
declare const HYDRATE_ISLANDS_STATUS: unique symbol;

declare function isHydrated(host: IslandHost): boolean;
declare function cancelScheduledIslandHydration(host: IslandHost): void;`,
    },
  ],
};

export { runtimeHydrationReference, runtimeReference, runtimeSsrReference };
