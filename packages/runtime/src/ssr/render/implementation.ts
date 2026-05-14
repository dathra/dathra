/**
 * SSR rendering - converts structured arrays to HTML strings.
 *
 * Per SPEC.typ:
 * - Generates HTML with SSR markers for Hydration
 * - Uses Declarative Shadow DOM for Web Components
 * - Inserts state script for Signal initialization
 */

import {
  type AtomStore,
  type AtomStoreSnapshot,
  type PrimitiveAtom,
  withStore,
} from "@dathra/store";
import { getCurrentStore } from "@dathra/store/internal";

import {
  MarkerType,
  createBlockEndMarker,
  createInsertEndMarker,
  createMarker,
  createStateScript,
  createStoreScript,
} from "@/ssr/markers/implementation";
import {
  serializeState,
  type SerializableValue,
  type StateObject,
} from "@/ssr/serialize/implementation";
import { type Tree, type TreeNode } from "@/types/tree";

const VOID_ELEMENTS = new Set([
  "area",
  "base",
  "br",
  "col",
  "embed",
  "hr",
  "img",
  "input",
  "link",
  "meta",
  "param",
  "source",
  "track",
  "wbr",
]);

const BOOLEAN_ATTRS = new Set([
  "disabled",
  "checked",
  "readonly",
  "required",
  "autofocus",
  "autoplay",
  "controls",
  "defer",
  "hidden",
  "loop",
  "multiple",
  "muted",
  "novalidate",
  "open",
  "reversed",
  "selected",
  "async",
  "contenteditable",
  "default",
  "draggable",
  "formnovalidate",
  "inert",
  "ismap",
  "itemscope",
  "nomodule",
  "playsinline",
  "spellcheck",
  "translate",
]);

/**
 * Render context for tracking dynamic parts.
 */
interface RenderContext {
  /** Current marker ID counter */
  markerId: number;
  /** State object for serialization */
  state: StateObject;
  /** Dynamic values to render */
  dynamicValues: Map<number, unknown>;
  /** Component renderer for Declarative Shadow DOM */
  componentRenderer?: ComponentRenderer;
  /** Request-scoped store for SSR */
  store?: AtomStore;
  /** Optional snapshot schema for store transfer */
  storeSnapshotSchema?: AtomStoreSnapshot<
    Record<string, PrimitiveAtom<unknown>>
  >;
}

type SerializableStoreSnapshot = Record<string, SerializableValue>;

function stringifyRenderableValue(value: unknown): string {
  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return String(value);
  }

  if (typeof value === "symbol") {
    return value.description ?? "";
  }

  if (typeof value === "function") {
    return value.toString();
  }

  if (JSON.stringify(value) === "{}") {
    return String(value);
  }

  return JSON.stringify(value);
}

/**
 * Renders DSD content for a custom element.
 * Returns DSD HTML string (excluding outer tag), or null if not registered.
 */
type ComponentRenderer = (
  tagName: string,
  attrs: Record<string, unknown>,
  options?: { store?: AtomStore },
) => string | null;

/**
 * Global default component renderer.
 * Set this before SSR rendering to enable DSD output for Web Components.
 */
let globalComponentRenderer: ComponentRenderer | undefined;

/**
 * Render options.
 */
interface RenderOptions {
  /** Initial state for Signals */
  state?: StateObject;
  /** Dynamic values keyed by marker ID */
  dynamicValues?: Map<number, unknown>;
  /** Whether to include state script */
  includeState?: boolean;
  /** Component renderer for Declarative Shadow DOM output */
  componentRenderer?: ComponentRenderer;
  /** Request-scoped store available during SSR rendering */
  store?: AtomStore;
  /** Optional snapshot schema for store transfer */
  storeSnapshotSchema?: AtomStoreSnapshot<
    Record<string, PrimitiveAtom<unknown>>
  >;
}

/**
 * Create a new render context.
 */
function createContext(options: RenderOptions = {}): RenderContext {
  return {
    markerId: 0,
    state: options.state ?? {},
    dynamicValues: options.dynamicValues ?? new Map<number, unknown>(),
    componentRenderer: options.componentRenderer ?? globalComponentRenderer,
    store: options.store,
    storeSnapshotSchema: options.storeSnapshotSchema,
  };
}

function assertStoreSnapshotOptions(options: RenderOptions): void {
  if (
    options.storeSnapshotSchema !== undefined &&
    options.store === undefined
  ) {
    throw new Error("[dathra] storeSnapshotSchema requires a store");
  }
}

/**
 * Escape HTML special characters.
 */
function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * Escape attribute value.
 */
function escapeAttr(str: string): string {
  return str.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Convert a camelCase CSS property name to kebab-case.
 * Handles vendor prefixes like "webkitTransform" → "-webkit-transform".
 */
function camelToKebab(str: string): string {
  return str.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
}

/**
 * Serialize a style object to a CSS string.
 * Converts `{ padding: "20px", borderRadius: "8px" }`
 * to `"padding: 20px; border-radius: 8px"`.
 */
function serializeStyleObject(obj: Record<string, unknown>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(obj)) {
    if (value == null || value === "") continue;
    const cssKey = camelToKebab(key);
    parts.push(`${cssKey}: ${stringifyRenderableValue(value)}`);
  }
  return parts.join("; ");
}

/**
 * Render attributes to string.
 */
function renderAttrs(attrs: Record<string, unknown>): string {
  const parts: string[] = [];

  for (const [key, value] of Object.entries(attrs)) {
    // Skip event handlers (they start with "on")
    if (key.startsWith("on") && key.length > 2) continue;

    if (BOOLEAN_ATTRS.has(key.toLowerCase())) {
      if (value === true) {
        parts.push(key);
      }
    } else if (key === "style" && typeof value === "object" && value !== null) {
      // Serialize style object to CSS string
      const css = serializeStyleObject(value as Record<string, unknown>);
      if (css !== "") {
        parts.push(`style="${escapeAttr(css)}"`);
      }
    } else if (value != null && value !== false) {
      parts.push(`${key}="${escapeAttr(stringifyRenderableValue(value))}"`);
    }
  }

  return parts.length > 0 ? " " + parts.join(" ") : "";
}

function renderDynamicText(value: unknown): string {
  return value == null ? "" : escapeHtml(stringifyRenderableValue(value));
}

function renderDynamicInsert(value: unknown): string {
  return typeof value === "string" ? value : "<!--empty-->";
}

function renderDynamicEach(value: unknown): string {
  return Array.isArray(value) ? value.join("") : "";
}

function renderDynamicAttr(name: string, value: unknown): string {
  return renderAttrs({ [name]: value });
}

function renderDynamicSpread(
  props: Record<string, unknown> | null | undefined,
): string {
  return props == null ? "" : renderAttrs(props);
}

/**
 * Check if a tree node is a placeholder.
 */
function isPlaceholder(
  node: Tree,
): node is ["{text}" | "{insert}" | "{each}", null] {
  return (
    Array.isArray(node) &&
    node.length === 2 &&
    typeof node[0] === "string" &&
    node[0].startsWith("{") &&
    node[1] === null
  );
}

/**
 * Check if a tree node is an element.
 */
function isElement(node: Tree): node is TreeNode {
  return (
    Array.isArray(node) &&
    node.length >= 2 &&
    typeof node[0] === "string" &&
    !node[0].startsWith("{")
  );
}

/**
 * Render a single tree node to HTML string.
 */
function renderNode(node: Tree, ctx: RenderContext): string {
  // Text content
  if (typeof node === "string") {
    return escapeHtml(node);
  }

  // Placeholder - emit marker and dynamic value
  if (isPlaceholder(node)) {
    const id = ++ctx.markerId;
    const type = node[0];

    if (type === "{text}") {
      const value = ctx.dynamicValues.get(id);
      const textContent =
        value != null ? escapeHtml(stringifyRenderableValue(value)) : "";
      return createMarker(MarkerType.Text, id) + textContent;
    }

    if (type === "{insert}") {
      const value = ctx.dynamicValues.get(id);
      const content =
        value != null && typeof value === "string" ? value : "<!--empty-->";
      return (
        createMarker(MarkerType.Insert, id) + content + createInsertEndMarker()
      );
    }

    const items = ctx.dynamicValues.get(id) as string[] | undefined;
    const content = items !== undefined ? items.join("") : "";
    return (
      createMarker(MarkerType.Block, id) + content + createBlockEndMarker()
    );
  }

  // Element node
  if (isElement(node)) {
    const [tag, attrs, ...children] = node;

    // Check for custom elements with DSD support
    if (tag.includes("-") && ctx.componentRenderer !== undefined) {
      const attrObj = attrs ?? {};
      const activeStore = getCurrentStore() ?? ctx.store;
      const dsdContent = ctx.componentRenderer(tag, attrObj, {
        store: activeStore,
      });
      if (dsdContent !== null) {
        // Render as custom element with Declarative Shadow DOM
        const attrStr = attrs !== null ? renderAttrs(attrs) : "";
        return `<${tag}${attrStr}><template shadowrootmode="open">${dsdContent}</template></${tag}>`;
      }
    }

    // Build opening tag
    const attrStr = attrs !== null ? renderAttrs(attrs) : "";
    let html = `<${tag}${attrStr}`;

    // Void elements
    if (VOID_ELEMENTS.has(tag.toLowerCase())) {
      return html + " />";
    }

    html += ">";

    // Render children
    for (const child of children) {
      html += renderNode(child, ctx);
    }

    // Closing tag
    html += `</${tag}>`;

    return html;
  }

  return "";
}

/**
 * Set the global component renderer for SSR DSD output.
 * Call this before rendering to enable DSD for registered Web Components.
 * @param renderer - Component renderer callback, or undefined to clear.
 */
function setComponentRenderer(renderer: ComponentRenderer | undefined): void {
  globalComponentRenderer = renderer;
}

/**
 * Render a tree to HTML string.
 */
function renderTree(tree: Tree[], options: RenderOptions = {}): string {
  assertStoreSnapshotOptions(options);

  const render = () => {
    const ctx = createContext(options);
    let html = "";

    if (ctx.storeSnapshotSchema !== undefined && ctx.store !== undefined) {
      const snapshot = ctx.storeSnapshotSchema.serialize(
        ctx.store,
      ) as SerializableStoreSnapshot;
      html += createStoreScript(serializeState(snapshot));
    }

    for (const node of tree) {
      html += renderNode(node, ctx);
    }

    if (options.includeState === true && Object.keys(ctx.state).length > 0) {
      html = createStateScript(serializeState(ctx.state)) + html;
    }

    return html;
  };

  return options.store === undefined
    ? render()
    : withStore(options.store, render);
}

/**
 * Render a tree to a complete HTML string with state.
 */
function renderToString(
  tree: Tree[],
  stateOrOptions: StateObject | RenderOptions = {},
  dynamicValues: Map<number, unknown> = new Map(),
  componentRenderer?: ComponentRenderer,
  store?: AtomStore,
): string {
  if (
    "state" in stateOrOptions ||
    "dynamicValues" in stateOrOptions ||
    "includeState" in stateOrOptions ||
    "componentRenderer" in stateOrOptions ||
    "store" in stateOrOptions ||
    "storeSnapshotSchema" in stateOrOptions
  ) {
    const options = stateOrOptions as RenderOptions;
    return renderTree(tree, {
      ...options,
      includeState:
        options.includeState ?? Object.keys(options.state ?? {}).length > 0,
    });
  }

  const state = stateOrOptions as StateObject;
  return renderTree(tree, {
    state,
    dynamicValues,
    includeState: Object.keys(state).length > 0,
    componentRenderer,
    store,
  });
}

export { createContext, renderToString, renderTree, setComponentRenderer };
export {
  renderDynamicAttr,
  renderDynamicEach,
  renderDynamicInsert,
  renderDynamicSpread,
  renderDynamicText,
};
export type { ComponentRenderer, RenderContext, RenderOptions };
