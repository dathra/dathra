/**
 * Main Hydration logic.
 *
 * Per SPEC.typ (Behavior Spec: Hydration):
 * - Reuses SSR-generated DOM
 * - Connects events and reactivity simultaneously
 * - Uses WeakMap for idempotency (prevents double hydration)
 * - Dev mode throws on mismatch, prod mode warns and falls back to CSR
 */

import {
  createRoot,
  templateEffect,
  type RootDispose,
} from "@dathra/reactivity";
import {
  CLIENT_EVENT_METADATA_ATTRIBUTE,
  CLIENT_STRATEGY_METADATA_ATTRIBUTE,
  CLIENT_TARGET_METADATA_ATTRIBUTE,
  DEFAULT_INTERACTION_EVENT_TYPE,
  ISLAND_METADATA_ATTRIBUTE,
  ISLAND_VALUE_METADATA_ATTRIBUTE,
  type ISLAND_STRATEGIES,
  isIslandStrategyName,
} from "@dathra/shared";
import {
  type AtomStore,
  type AtomStoreSnapshot,
  type PrimitiveAtom,
  withStore,
} from "@dathra/store";

import { setAttr } from "@/dom/attr/implementation";
import { insert } from "@/dom/insertion/implementation";
import { spread, type SpreadProps } from "@/dom/spread/implementation";
import { setText } from "@/dom/text/implementation";
import { event } from "@/events/implementation";
import {
  parseStateScript,
  parseStoreScript,
} from "@/hydration/deserialize/implementation";
import {
  createWalker,
  findMarker,
  getTextNodeAfterMarker,
  HydrationMarkerType,
  type MarkerInfo,
  parseMarker,
} from "@/hydration/walker/implementation";

/**
 * WeakMap to track hydrated ShadowRoots (idempotency).
 */
const hydratedRoots = new WeakMap<ShadowRoot, boolean>();
const scheduledIslandCleanups = new WeakMap<HTMLElement, () => void>();
type ClientActionFactory = (
  payload: Record<string, unknown>,
  host: HTMLElement,
) => EventListener;
const clientActionRegistry = new Map<string, ClientActionFactory>();

const HYDRATE_ISLANDS_HOOK = Symbol("dathra.hydrateIslandsHook");
const HYDRATE_ISLANDS_STATUS = Symbol("dathra.hydrateIslandsStatus");

type IslandsStrategyName = (typeof ISLAND_STRATEGIES)[number];
type HydrateIslandsStatus = "idle" | "hydrated";
interface IslandHydrationTrigger {
  readonly strategy: string;
  readonly eventType?: string;
  readonly replayTargetId?: string | null;
  readonly replayEvent?: ReplayEventSnapshot;
}

interface ReplayEventSnapshot {
  readonly kind: "event" | "mouse" | "keyboard" | "focus" | "input" | "pointer";
  readonly init:
    | EventInit
    | MouseEventInit
    | KeyboardEventInit
    | FocusEventInit
    | InputEventInit
    | PointerEventInit;
}

function registerClientAction(id: string, factory: ClientActionFactory): void {
  clientActionRegistry.set(id, factory);
}

function getClientAction(id: string): ClientActionFactory | undefined {
  return clientActionRegistry.get(id);
}

function clearClientActions(): void {
  clientActionRegistry.clear();
}
type HydrateIslandHook = (trigger?: IslandHydrationTrigger) => boolean;

interface IslandHost extends HTMLElement {
  [HYDRATE_ISLANDS_HOOK]?: HydrateIslandHook;
  [HYDRATE_ISLANDS_STATUS]?: HydrateIslandsStatus;
}

interface IdleCallbackDeadline {
  readonly didTimeout: boolean;
  timeRemaining(): number;
}

type RequestIdleCallback = (
  callback: (deadline: IdleCallbackDeadline) => void,
) => number;
type CancelIdleCallback = (handle: number) => void;

/**
 * Hydration context for tracking state during hydration.
 */
interface HydrationContext {
  /** Parsed state from SSR */
  state: Record<string, unknown>;
  /** TreeWalker for marker traversal */
  walker: TreeWalker;
  /** Collected markers */
  markers: MarkerInfo[];
  /** O(1) lookup table for markers by id */
  markerLookup: Map<number, MarkerInfo>;
  /** Current marker index */
  markerIndex: number;
  /** Event handlers to connect */
  eventHandlers: Map<Element, Map<string, EventListener>>;
  /** Optional request/root-scoped store */
  store?: AtomStore;
}

interface HydrationOptions {
  store?: AtomStore;
  storeSnapshotSchema?: AtomStoreSnapshot<
    Record<string, PrimitiveAtom<unknown>>
  >;
}

interface TextBinding {
  readonly kind: "text";
  readonly markerId: number;
  readonly expression: () => unknown;
}

interface AttrBinding {
  readonly kind: "attr";
  readonly path: readonly number[];
  readonly key: string;
  readonly expression: () => unknown;
}

interface EventBinding {
  readonly kind: "event";
  readonly path: readonly number[];
  readonly eventType: string;
  readonly expression: EventListener;
}

interface InsertBinding {
  readonly kind: "insert";
  readonly markerId: number;
  readonly path: readonly number[];
  readonly expression: () => unknown;
  readonly isComponent: boolean;
}

interface SpreadBinding {
  readonly kind: "spread";
  readonly path: readonly number[];
  readonly expression: () => SpreadProps;
}

interface NestedBoundaryRef {
  readonly path: readonly number[];
  readonly tagName: string;
  readonly islandStrategy: string | null;
}

type HydrationBinding =
  | TextBinding
  | AttrBinding
  | EventBinding
  | InsertBinding
  | SpreadBinding;

interface GenericHydrationPlan {
  readonly namespace: "html" | "svg" | "math";
  readonly bindings: readonly HydrationBinding[];
  readonly nestedBoundaries: readonly NestedBoundaryRef[];
}

function stringifyEventField(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (value === null || value === undefined) {
    return "";
  }

  if (typeof value === "symbol") {
    return value.description ?? "";
  }

  if (typeof value === "function") {
    return value.toString();
  }

  if (JSON.stringify(value) === "{}") {
    return "[object Object]";
  }

  return JSON.stringify(value);
}

/**
 * Hydration mismatch error.
 */
class HydrationMismatchError extends Error {
  /** The marker ID associated with the mismatch, if available. */
  markerId: number | null;
  /** The marker type associated with the mismatch, if available. */
  markerType: string | null;
  /** Description of expected DOM state. */
  expected: string | null;
  /** Description of actual DOM state. */
  actual: string | null;

  constructor(
    message: string,
    details?: {
      markerId?: number;
      markerType?: string;
      expected?: string;
      actual?: string;
    },
  ) {
    const detailLines: string[] = [];
    if (details?.markerId !== undefined) {
      detailLines.push(`  Marker ID: ${details.markerId}`);
    }
    if (details?.markerType !== undefined) {
      detailLines.push(`  Marker type: ${details.markerType}`);
    }
    if (details?.expected !== undefined) {
      detailLines.push(`  Expected: ${details.expected}`);
    }
    if (details?.actual !== undefined) {
      detailLines.push(`  Actual: ${details.actual}`);
    }
    const detailStr =
      detailLines.length > 0 ? `\n${detailLines.join("\n")}` : "";
    super(`[dathra] Hydration mismatch: ${message}${detailStr}`);
    this.name = "HydrationMismatchError";
    this.markerId = details?.markerId ?? null;
    this.markerType = details?.markerType ?? null;
    this.expected = details?.expected ?? null;
    this.actual = details?.actual ?? null;
  }
}

/**
 * Check if a ShadowRoot has already been hydrated.
 */
function isHydrated(root: ShadowRoot): boolean {
  return hydratedRoots.has(root);
}

/**
 * Mark a ShadowRoot as hydrated.
 */
function markHydrated(root: ShadowRoot): void {
  hydratedRoots.set(root, true);
}

/**
 * Handle hydration mismatch.
 * Dev mode: throw error
 * Prod mode: warn and return false (caller should fallback to CSR)
 */
function handleMismatch(
  message: string,
  details?: {
    markerId?: number;
    markerType?: string;
    expected?: string;
    actual?: string;
  },
): boolean {
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    throw new HydrationMismatchError(message, details);
  }
  console.warn(`[dathra] Hydration mismatch: ${message}. Falling back to CSR.`);
  return false;
}

/**
 * Create a hydration context.
 */
function createHydrationContext(
  root: ShadowRoot,
  options: HydrationOptions = {},
  markers: MarkerInfo[] = collectMarkers(root),
): HydrationContext {
  const state = parseStateScript(root) ?? {};
  const walker = createWalker(root);

  return {
    state,
    walker,
    markers,
    markerLookup: createMarkerLookup(markers),
    markerIndex: 0,
    eventHandlers: new Map(),
    store: options.store,
  };
}

function collectMarkers(root: Node): MarkerInfo[] {
  const walker = createWalker(root);
  const markers: MarkerInfo[] = [];

  let marker = findMarker(walker);
  while (marker !== null) {
    markers.push(marker);
    marker = findMarker(walker);
  }

  return markers;
}

function createMarkerLookup(
  markers: readonly MarkerInfo[],
): Map<number, MarkerInfo> {
  const markerLookup = new Map<number, MarkerInfo>();

  for (const marker of markers) {
    if (marker.type === HydrationMarkerType.BlockEnd) {
      continue;
    }

    if (!markerLookup.has(marker.id)) {
      markerLookup.set(marker.id, marker);
    }
  }

  return markerLookup;
}

function pathEquals(
  path: readonly number[],
  target: readonly number[],
): boolean {
  if (path.length !== target.length) {
    return false;
  }

  for (let i = 0; i < path.length; i += 1) {
    if (path[i] !== target[i]) {
      return false;
    }
  }

  return true;
}

function collectMarkersOutsideNestedBoundaries(
  root: ShadowRoot,
  nestedBoundaries: readonly NestedBoundaryRef[],
): MarkerInfo[] {
  if (nestedBoundaries.length === 0) {
    return collectMarkers(root);
  }

  const markers: MarkerInfo[] = [];

  function visit(node: Node, path: readonly number[]): void {
    if (node.nodeType === Node.COMMENT_NODE) {
      const marker = parseMarker(node as Comment);
      if (marker !== null) {
        markers.push(marker);
      }
      return;
    }

    for (const boundary of nestedBoundaries) {
      if (pathEquals(path, boundary.path)) {
        return;
      }
    }

    let child = node.firstChild;
    let index = 0;
    while (child !== null) {
      visit(child, [...path, index]);
      child = child.nextSibling;
      index += 1;
    }
  }

  visit(root, []);
  return markers;
}

/**
 * Get next marker from context.
 */
function nextMarker(ctx: HydrationContext): MarkerInfo | null {
  if (ctx.markerIndex >= ctx.markers.length) {
    return null;
  }
  return ctx.markers[ctx.markerIndex++];
}

/**
 * Hydrate text markers.
 * Connects templateEffect to update text content reactively.
 */
function hydrateTextMarker(marker: MarkerInfo, getValue: () => unknown): void {
  const textNode = getTextNodeAfterMarker(marker.node);
  if (textNode === null) {
    const nextSibling = marker.node.nextSibling;
    handleMismatch(`Text node not found after marker ${marker.id}`, {
      markerId: marker.id,
      markerType: marker.type,
      expected: "Text node after comment marker",
      actual:
        nextSibling !== null
          ? `${nextSibling.nodeName} (nodeType: ${nextSibling.nodeType})`
          : "no sibling node",
    });
    return;
  }

  // Connect reactive update
  templateEffect(() => {
    setText(textNode, getValue());
  });
}

function findMarkerById(
  ctx: HydrationContext,
  markerId: number,
): MarkerInfo | null {
  return ctx.markerLookup.get(markerId) ?? null;
}

function resolveNodeAtPath(
  root: ShadowRoot,
  path: readonly number[],
): Node | null {
  let current: Node = root;

  for (let depth = 0; depth < path.length; depth += 1) {
    const index = path[depth];

    let child = current.firstChild;
    for (let i = 0; i < index; i += 1) {
      if (child === null) {
        return null;
      }
      child = child.nextSibling;
    }

    if (child === null) {
      return null;
    }

    current = child;
  }

  return current;
}

function pathMatchesOrDescends(
  path: readonly number[],
  prefix: readonly number[],
): boolean {
  if (prefix.length > path.length) {
    return false;
  }

  for (let i = 0; i < prefix.length; i += 1) {
    if (path[i] !== prefix[i]) {
      return false;
    }
  }

  return true;
}

function isPathBlockedByNestedBoundary(
  path: readonly number[],
  nestedBoundaries: readonly NestedBoundaryRef[],
): boolean {
  for (const boundary of nestedBoundaries) {
    if (pathMatchesOrDescends(path, boundary.path)) {
      return true;
    }
  }

  return false;
}

function isIslandHost(value: Element): value is IslandHost {
  return value instanceof HTMLElement;
}

function getIslandStrategy(host: Element): IslandsStrategyName | null {
  const strategy = host.getAttribute(ISLAND_METADATA_ATTRIBUTE);
  return isIslandStrategyName(strategy) ? strategy : null;
}

function getInteractionEventType(host: Element): string {
  return (
    host.getAttribute(ISLAND_VALUE_METADATA_ATTRIBUTE) ??
    DEFAULT_INTERACTION_EVENT_TYPE
  );
}

function getMediaQuery(host: Element): string | null {
  return host.getAttribute(ISLAND_VALUE_METADATA_ATTRIBUTE);
}

function getReplayTargetIdFromEvent(event: Event): string | null {
  const path =
    typeof event.composedPath === "function" ? event.composedPath() : [];

  for (const item of path) {
    if (!(item instanceof HTMLElement)) {
      continue;
    }

    const targetId = item.getAttribute(CLIENT_TARGET_METADATA_ATTRIBUTE);
    if (targetId !== null) {
      return targetId;
    }
  }

  return null;
}

function createReplayEventSnapshot(event: Event): ReplayEventSnapshot {
  const baseInit = {
    bubbles: event.bubbles,
    cancelable: event.cancelable,
    composed: event.composed,
  };
  const eventRecord = event as Event & Record<string, unknown>;

  if (
    (typeof PointerEvent !== "undefined" && event instanceof PointerEvent) ||
    typeof eventRecord.pointerType === "string"
  ) {
    return {
      kind: "pointer",
      init: {
        ...baseInit,
        button: Number(eventRecord.button ?? 0),
        buttons: Number(eventRecord.buttons ?? 0),
        clientX: Number(eventRecord.clientX ?? 0),
        clientY: Number(eventRecord.clientY ?? 0),
        ctrlKey: Boolean(eventRecord.ctrlKey),
        shiftKey: Boolean(eventRecord.shiftKey),
        altKey: Boolean(eventRecord.altKey),
        metaKey: Boolean(eventRecord.metaKey),
        pointerId: Number(eventRecord.pointerId ?? 0),
        pointerType: stringifyEventField(eventRecord.pointerType),
        pressure: Number(eventRecord.pressure ?? 0),
        tangentialPressure: Number(eventRecord.tangentialPressure ?? 0),
        tiltX: Number(eventRecord.tiltX ?? 0),
        tiltY: Number(eventRecord.tiltY ?? 0),
        twist: Number(eventRecord.twist ?? 0),
        width: Number(eventRecord.width ?? 0),
        height: Number(eventRecord.height ?? 0),
        isPrimary: Boolean(eventRecord.isPrimary),
      },
    };
  }

  if (
    (typeof MouseEvent !== "undefined" && event instanceof MouseEvent) ||
    typeof eventRecord.clientX === "number" ||
    typeof eventRecord.button === "number"
  ) {
    return {
      kind: "mouse",
      init: {
        ...baseInit,
        detail: Number(eventRecord.detail ?? 0),
        button: Number(eventRecord.button ?? 0),
        buttons: Number(eventRecord.buttons ?? 0),
        clientX: Number(eventRecord.clientX ?? 0),
        clientY: Number(eventRecord.clientY ?? 0),
        ctrlKey: Boolean(eventRecord.ctrlKey),
        shiftKey: Boolean(eventRecord.shiftKey),
        altKey: Boolean(eventRecord.altKey),
        metaKey: Boolean(eventRecord.metaKey),
        relatedTarget: null,
        screenX: Number(eventRecord.screenX ?? 0),
        screenY: Number(eventRecord.screenY ?? 0),
      },
    };
  }

  if (
    (typeof KeyboardEvent !== "undefined" && event instanceof KeyboardEvent) ||
    typeof eventRecord.key === "string" ||
    typeof eventRecord.code === "string"
  ) {
    return {
      kind: "keyboard",
      init: {
        ...baseInit,
        key: stringifyEventField(eventRecord.key),
        code: stringifyEventField(eventRecord.code),
        location: Number(eventRecord.location ?? 0),
        repeat: Boolean(eventRecord.repeat),
        ctrlKey: Boolean(eventRecord.ctrlKey),
        shiftKey: Boolean(eventRecord.shiftKey),
        altKey: Boolean(eventRecord.altKey),
        metaKey: Boolean(eventRecord.metaKey),
        isComposing: Boolean(eventRecord.isComposing),
      },
    };
  }

  if (
    (typeof FocusEvent !== "undefined" && event instanceof FocusEvent) ||
    event.type === "focus" ||
    event.type === "blur" ||
    event.type === "focusin" ||
    event.type === "focusout"
  ) {
    return {
      kind: "focus",
      init: {
        ...baseInit,
        detail: Number(eventRecord.detail ?? 0),
        relatedTarget: null,
      },
    };
  }

  if (
    (typeof InputEvent !== "undefined" && event instanceof InputEvent) ||
    typeof eventRecord.inputType === "string" ||
    "data" in eventRecord
  ) {
    return {
      kind: "input",
      init: {
        ...baseInit,
        data: typeof eventRecord.data === "string" ? eventRecord.data : null,
        inputType: stringifyEventField(eventRecord.inputType),
        isComposing: Boolean(eventRecord.isComposing),
      },
    };
  }

  return {
    kind: "event",
    init: baseInit,
  };
}

function getColocatedInteractionTargets(
  host: IslandHost,
  eventType: string,
): HTMLElement[] {
  const shadowRoot = host.shadowRoot;
  if (shadowRoot === null) {
    return [];
  }

  return Array.from(
    shadowRoot.querySelectorAll<HTMLElement>(
      `[${CLIENT_TARGET_METADATA_ATTRIBUTE}][${CLIENT_STRATEGY_METADATA_ATTRIBUTE}="interaction"]`,
    ),
  ).filter((target) => {
    return (
      (target.getAttribute(CLIENT_EVENT_METADATA_ATTRIBUTE) ??
        DEFAULT_INTERACTION_EVENT_TYPE) === eventType
    );
  });
}

function collectIslandHosts(
  root: Document | ShadowRoot | Element,
  hosts: IslandHost[] = [],
): IslandHost[] {
  if (
    root instanceof Element &&
    isIslandHost(root) &&
    getIslandStrategy(root) !== null
  ) {
    hosts.push(root);
  }

  if (root instanceof Element && root.shadowRoot !== null) {
    collectIslandHosts(root.shadowRoot, hosts);
  }

  const children =
    root instanceof Document ||
    root instanceof ShadowRoot ||
    root instanceof Element
      ? Array.from(root.children)
      : [];

  for (const child of children) {
    collectIslandHosts(child, hosts);
  }

  return hosts;
}

function runIslandHydrationWithTrigger(
  host: IslandHost,
  trigger?: IslandHydrationTrigger,
): boolean {
  if (host[HYDRATE_ISLANDS_STATUS] === "hydrated") {
    return false;
  }

  const hydrateHook = host[HYDRATE_ISLANDS_HOOK];
  if (typeof hydrateHook !== "function") {
    return false;
  }

  const didHydrate = hydrateHook(trigger);
  if (didHydrate) {
    host[HYDRATE_ISLANDS_STATUS] = "hydrated";
  }

  return didHydrate;
}

function scheduleIslandHydration(host: IslandHost): (() => void) | null {
  if (
    scheduledIslandCleanups.has(host) ||
    host[HYDRATE_ISLANDS_STATUS] === "hydrated"
  ) {
    return null;
  }

  const strategy = getIslandStrategy(host);
  if (strategy === null || typeof host[HYDRATE_ISLANDS_HOOK] !== "function") {
    return null;
  }

  let active = true;
  let cleanup = () => {};

  const finish = (trigger?: IslandHydrationTrigger) => {
    if (!active) {
      return;
    }

    active = false;
    cleanup();
    scheduledIslandCleanups.delete(host);
    runIslandHydrationWithTrigger(host, trigger);
  };

  switch (strategy) {
    case "load": {
      if (document.readyState === "complete") {
        finish();
        return null;
      }

      const onLoad = () => {
        finish();
      };
      window.addEventListener("load", onLoad, { once: true });
      cleanup = () => {
        window.removeEventListener("load", onLoad);
      };
      break;
    }

    case "visible": {
      if (typeof IntersectionObserver === "undefined") {
        finish();
        return null;
      }

      const observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.target === host && entry.isIntersecting) {
            finish();
            return;
          }
        }
      });

      observer.observe(host);
      cleanup = () => {
        observer.disconnect();
      };
      break;
    }

    case "idle": {
      const requestIdle = globalThis.requestIdleCallback as
        | RequestIdleCallback
        | undefined;
      const cancelIdle = globalThis.cancelIdleCallback as
        | CancelIdleCallback
        | undefined;

      if (typeof requestIdle === "function") {
        const handle = requestIdle(() => {
          finish();
        });
        cleanup = () => {
          cancelIdle?.(handle);
        };
        break;
      }

      const timeoutHandle = window.setTimeout(() => {
        finish();
      }, 0);
      cleanup = () => {
        window.clearTimeout(timeoutHandle);
      };
      break;
    }

    case "interaction": {
      const eventType = getInteractionEventType(host);
      const onInteraction = (event: Event) => {
        finish({
          strategy,
          eventType,
          replayTargetId: getReplayTargetIdFromEvent(event),
          replayEvent: createReplayEventSnapshot(event),
        });
      };
      const colocatedTargets = getColocatedInteractionTargets(host, eventType);
      if (colocatedTargets.length > 0) {
        for (const target of colocatedTargets) {
          target.addEventListener(eventType, onInteraction, { once: true });
        }
        cleanup = () => {
          for (const target of colocatedTargets) {
            target.removeEventListener(eventType, onInteraction);
          }
        };
        break;
      }

      host.addEventListener(eventType, onInteraction, { once: true });
      cleanup = () => {
        host.removeEventListener(eventType, onInteraction);
      };
      break;
    }

    case "media": {
      const query = getMediaQuery(host);
      if (query === null || typeof window.matchMedia !== "function") {
        finish();
        return null;
      }

      const mediaQueryList = window.matchMedia(query);
      if (mediaQueryList.matches) {
        finish();
        return null;
      }

      const onChange = (event: MediaQueryListEvent | MediaQueryList) => {
        if (event.matches) {
          finish();
        }
      };

      if (typeof mediaQueryList.addEventListener === "function") {
        mediaQueryList.addEventListener("change", onChange);
        cleanup = () => {
          mediaQueryList.removeEventListener("change", onChange);
        };
      } else {
        mediaQueryList.addListener(onChange);
        cleanup = () => {
          mediaQueryList.removeListener(onChange);
        };
      }
      break;
    }
  }

  const dispose = () => {
    if (!active) {
      return;
    }

    active = false;
    cleanup();
    scheduledIslandCleanups.delete(host);
  };

  scheduledIslandCleanups.set(host, dispose);
  return dispose;
}

function cancelScheduledIslandHydration(host: HTMLElement): void {
  scheduledIslandCleanups.get(host)?.();
}

function hydrateIslands(
  root: Document | ShadowRoot | Element = document,
): () => void {
  const scheduledByCall: Array<() => void> = [];

  for (const host of collectIslandHosts(root)) {
    const cleanup = scheduleIslandHydration(host);
    if (cleanup !== null) {
      scheduledByCall.push(cleanup);
    }
  }

  return () => {
    for (const cleanup of scheduledByCall) {
      cleanup();
    }
  };
}

/**
 * Hydrate a ShadowRoot.
 *
 * Per SPEC.typ (Behavior Spec: Hydration):
 * 1. Check if already hydrated (idempotency via WeakMap)
 * 2. Parse state script and initialize Signals
 * 3. Create cleanup scope with createRoot
 * 4. Traverse markers with TreeWalker
 * 5. Connect effects and events simultaneously
 * 6. Mark as hydrated
 *
 * @param root The ShadowRoot to hydrate
 * @param setup Setup function that returns event and effect bindings
 * @returns Dispose function or null if already hydrated
 */
function hydrateRoot(
  root: ShadowRoot,
  setup: (ctx: HydrationContext) => void,
  options: HydrationOptions = {},
): RootDispose | null {
  return hydrateRootWithContext(
    root,
    setup,
    options,
    (currentRoot, currentOptions) =>
      createHydrationContext(currentRoot, currentOptions),
  );
}

function hydrateRootWithContext(
  root: ShadowRoot,
  setup: (ctx: HydrationContext) => void,
  options: HydrationOptions,
  createContext: (
    root: ShadowRoot,
    options: HydrationOptions,
  ) => HydrationContext,
): RootDispose | null {
  if (
    options.storeSnapshotSchema !== undefined &&
    options.store === undefined
  ) {
    throw new Error("[dathra] storeSnapshotSchema requires a store");
  }

  // Check closed shadow root
  if (root.mode === "closed") {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn("[dathra] Cannot hydrate closed ShadowRoot");
    }
    return null;
  }

  // Idempotency: skip if already hydrated
  if (isHydrated(root)) {
    return null;
  }

  // Create hydration context
  const ctx = createContext(root, options);

  if (
    options.storeSnapshotSchema !== undefined &&
    options.store !== undefined
  ) {
    const snapshot = parseStoreScript(root);
    if (snapshot !== null) {
      options.storeSnapshotSchema.hydrate(options.store, snapshot as never);
    }
  }

  // Create cleanup scope and run setup
  const runSetup = () =>
    createRoot(() => {
      setup(ctx);
    });
  const dispose =
    options.store === undefined
      ? runSetup()
      : withStore(options.store, runSetup);

  // Mark as hydrated
  markHydrated(root);

  return dispose;
}

/**
 * Simple hydrate function for basic cases.
 * Hydrates a container by connecting reactive bindings.
 */
function hydrate(
  root: ShadowRoot,
  bindings: {
    /** Text bindings: marker id -> value getter */
    texts?: Map<number, () => unknown>;
    /** Event bindings: element -> event type -> handler */
    events?: Map<Element, Map<string, EventListener>>;
  },
  options: HydrationOptions = {},
): RootDispose | null {
  return hydrateRoot(
    root,
    (ctx) => {
      // Process text bindings
      if (bindings.texts !== undefined) {
        let marker = nextMarker(ctx);
        while (marker !== null) {
          if (marker.type === HydrationMarkerType.Text) {
            const getValue = bindings.texts.get(marker.id);
            if (getValue !== undefined) {
              hydrateTextMarker(marker, getValue);
            }
          }

          marker = nextMarker(ctx);
        }
      }

      // Process event bindings
      if (bindings.events !== undefined) {
        for (const [element, handlers] of bindings.events) {
          for (const [eventType, handler] of handlers) {
            event(eventType, element, handler);
          }
        }
      }
    },
    options,
  );
}

function hydrateWithPlan(
  root: ShadowRoot,
  plan: GenericHydrationPlan,
  options: HydrationOptions = {},
): RootDispose | null {
  return hydrateRootWithContext(
    root,
    (ctx) => {
      for (const binding of plan.bindings) {
        switch (binding.kind) {
          case "text": {
            const marker = findMarkerById(ctx, binding.markerId);
            if (marker === null) {
              handleMismatch(`Text marker ${binding.markerId} not found`, {
                markerId: binding.markerId,
                markerType: HydrationMarkerType.Text,
                expected: "existing SSR text marker",
                actual: "missing marker",
              });
              continue;
            }

            hydrateTextMarker(marker, binding.expression);
            continue;
          }

          case "attr": {
            if (
              isPathBlockedByNestedBoundary(binding.path, plan.nestedBoundaries)
            ) {
              continue;
            }

            const node = resolveNodeAtPath(root, binding.path);
            if (!(node instanceof Element)) {
              handleMismatch(
                `Element not found for attr path ${binding.path.join(".")}`,
                {
                  expected: "Element at attr binding path",
                  actual: node === null ? "missing node" : node.nodeName,
                },
              );
              continue;
            }

            templateEffect(() => {
              setAttr(node, binding.key, binding.expression());
            });
            continue;
          }

          case "event": {
            if (
              isPathBlockedByNestedBoundary(binding.path, plan.nestedBoundaries)
            ) {
              continue;
            }

            const node = resolveNodeAtPath(root, binding.path);
            if (!(node instanceof Element)) {
              handleMismatch(
                `Element not found for event path ${binding.path.join(".")}`,
                {
                  expected: "Element at event binding path",
                  actual: node === null ? "missing node" : node.nodeName,
                },
              );
              continue;
            }

            event(binding.eventType, node, binding.expression);
            continue;
          }

          case "insert": {
            if (
              isPathBlockedByNestedBoundary(binding.path, plan.nestedBoundaries)
            ) {
              continue;
            }

            const marker = findMarkerById(ctx, binding.markerId);
            if (marker === null || marker.node.parentNode === null) {
              handleMismatch(`Insert marker ${binding.markerId} not found`, {
                markerId: binding.markerId,
                markerType: HydrationMarkerType.Insert,
                expected: "existing SSR insert marker",
                actual:
                  marker === null ? "missing marker" : "marker without parent",
              });
              continue;
            }

            const applyInsert = () => {
              insert(
                marker.node.parentNode as Node,
                binding.expression(),
                marker.node,
              );
            };

            if (binding.isComponent) {
              applyInsert();
            } else {
              templateEffect(applyInsert);
            }
            continue;
          }

          case "spread": {
            if (
              isPathBlockedByNestedBoundary(binding.path, plan.nestedBoundaries)
            ) {
              continue;
            }

            const node = resolveNodeAtPath(root, binding.path);
            if (!(node instanceof Element)) {
              handleMismatch(
                `Element not found for spread path ${binding.path.join(".")}`,
                {
                  expected: "Element at spread binding path",
                  actual: node === null ? "missing node" : node.nodeName,
                },
              );
              continue;
            }

            let previousProps: SpreadProps | null = null;
            templateEffect(() => {
              previousProps = spread(node, previousProps, binding.expression());
            });
          }
        }
      }
    },
    options,
    (currentRoot, currentOptions) =>
      createHydrationContext(
        currentRoot,
        currentOptions,
        collectMarkersOutsideNestedBoundaries(
          currentRoot,
          plan.nestedBoundaries,
        ),
      ),
  );
}

export {
  cancelScheduledIslandHydration,
  clearClientActions,
  createHydrationContext,
  getClientAction,
  handleMismatch,
  hydrate,
  hydrateIslands,
  hydrateRoot,
  hydrateWithPlan,
  hydrateTextMarker,
  HydrationMismatchError,
  HydrationMarkerType,
  HYDRATE_ISLANDS_HOOK,
  HYDRATE_ISLANDS_STATUS,
  isHydrated,
  markHydrated,
  registerClientAction,
};
export type {
  AttrBinding,
  EventBinding,
  GenericHydrationPlan,
  HydrateIslandHook,
  HydrateIslandsStatus,
  HydrationBinding,
  HydrationContext,
  InsertBinding,
  IslandHydrationTrigger,
  IslandHost,
  NestedBoundaryRef,
  SpreadBinding,
  TextBinding,
};
