import { Namespace, type Tree, type TreeNode } from "@/types/tree";

const SVG_NS = "http://www.w3.org/2000/svg";
const MATHML_NS = "http://www.w3.org/1998/Math/MathML";
const COMPILED_TEXT_MARKER_PREFIX = "dh-csr:text:";

function stringifyAttrValue(value: unknown): string {
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

interface CompiledTemplateDescriptor {
  readonly kind: "compiled";
  readonly markup: string;
  readonly namespace: Namespace;
}

/**
 * Cache for template factories to enable DOM cloning optimization.
 * Two-level cache: structure array → flags → factory.
 * This ensures different namespace flags for the same structure
 * produce independent templates.
 */
const templateCache = new WeakMap<
  readonly Tree[],
  Map<Namespace, () => DocumentFragment>
>();
const compiledTemplateCache = new WeakMap<
  CompiledTemplateDescriptor,
  () => DocumentFragment
>();

function isCompiledTemplateDescriptor(
  value: readonly Tree[] | CompiledTemplateDescriptor,
): value is CompiledTemplateDescriptor {
  return "kind" in value;
}

function parseCompiledMarkup(
  markup: string,
  namespace: Namespace,
): DocumentFragment {
  const template = document.createElement("template");

  if (namespace === Namespace.HTML) {
    template.innerHTML = markup;
    return template.content.cloneNode(true) as DocumentFragment;
  }

  const wrapperTag = namespace === Namespace.SVG ? "svg" : "math";
  template.innerHTML = `<${wrapperTag}>${markup}</${wrapperTag}>`;

  const fragment = document.createDocumentFragment();
  const wrapper = template.content.firstChild;
  let child = wrapper?.firstChild ?? null;
  while (child !== null) {
    const nextSibling = child.nextSibling;
    fragment.appendChild(child);
    child = nextSibling;
  }

  return fragment;
}

function upgradeCompiledTextPlaceholders(fragment: DocumentFragment): void {
  const walker = document.createTreeWalker(fragment, NodeFilter.SHOW_COMMENT);
  const markers: Comment[] = [];

  let current = walker.nextNode();
  while (current !== null) {
    const marker = current as Comment;
    if (marker.data.startsWith(COMPILED_TEXT_MARKER_PREFIX)) {
      markers.push(marker);
    }
    current = walker.nextNode();
  }

  for (const marker of markers) {
    marker.parentNode?.replaceChild(document.createTextNode(""), marker);
  }
}

function buildCompiledFragment(
  descriptor: CompiledTemplateDescriptor,
): DocumentFragment {
  const fragment = parseCompiledMarkup(descriptor.markup, descriptor.namespace);
  upgradeCompiledTextPlaceholders(fragment);
  return fragment;
}

/**
 * Check if a tree node is a placeholder.
 */
function isPlaceholder(node: Tree): node is [string, null] {
  return (
    Array.isArray(node) &&
    node.length === 2 &&
    node[1] === null &&
    typeof node[0] === "string" &&
    node[0].startsWith("{")
  );
}

/**
 * Check if a tree node is an element node.
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
 * Create a DOM element from a tree structure.
 * @param tree The tree structure to convert.
 * @param ns The namespace (0 = HTML, 1 = SVG, 2 = MathML).
 * @returns The created DOM node.
 */
function createNode(tree: Tree, ns: Namespace): Node {
  // Text node
  if (typeof tree === "string") {
    return document.createTextNode(tree);
  }

  // Placeholder - create appropriate marker node
  if (isPlaceholder(tree)) {
    const placeholderType = tree[0];
    // Warn on unsupported placeholder types
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      if (
        placeholderType !== "{text}" &&
        placeholderType !== "{insert}" &&
        placeholderType !== "{each}"
      ) {
        console.warn(
          `[fromTree] Unsupported placeholder type: "${placeholderType}". ` +
            `Supported types are: {text}, {insert}, {each}.`,
        );
      }
    }
    // {insert} uses comment nodes, {text} uses empty text nodes
    if (placeholderType === "{insert}") {
      return document.createComment(placeholderType);
    }
    return document.createTextNode("");
  }

  // Element node
  if (!isElement(tree)) {
    if (typeof __DEV__ !== "undefined" && __DEV__) {
      console.warn(
        `[fromTree] Invalid tree node: expected element, text, or placeholder, got:`,
        tree,
      );
    }
    return document.createTextNode("");
  }

  const [tag, attrs, ...children] = tree;

  // Validate tag and attrs in dev mode
  if (typeof __DEV__ !== "undefined" && __DEV__) {
    if (tag === "") {
      console.warn(
        `[fromTree] Empty tag name detected. Elements must have a non-empty tag name.`,
      );
    }
    if (attrs !== null && typeof attrs !== "object") {
      console.warn(
        `[fromTree] Invalid attrs for <${tag}>: expected object or null, got ${typeof attrs}.`,
      );
    }
  }

  // Determine namespace
  let elementNs = ns;
  if (tag === "svg") {
    elementNs = Namespace.SVG;
  } else if (tag === "math") {
    elementNs = Namespace.MathML;
  }

  // Create element with appropriate namespace
  let element: Element;
  if (elementNs === Namespace.SVG) {
    element = document.createElementNS(SVG_NS, tag);
  } else if (elementNs === Namespace.MathML) {
    element = document.createElementNS(MATHML_NS, tag);
  } else {
    element = document.createElement(tag);
  }

  // Set attributes
  if (attrs !== null) {
    for (const key of Object.keys(attrs)) {
      const value = attrs[key];
      if (value !== undefined && value !== null && value !== false) {
        if (value === true) {
          element.setAttribute(key, "");
        } else if (key === "style" && typeof value === "object") {
          // Serialize style object to cssText
          const styleObj = value as Record<string, unknown>;
          const cssText = Object.entries(styleObj)
            .filter(([, v]) => v != null && v !== "")
            .map(([k, v]) => {
              // Convert camelCase to kebab-case
              const kebab = k.replace(/[A-Z]/g, (m) => `-${m.toLowerCase()}`);
              return `${kebab}: ${stringifyAttrValue(v)}`;
            })
            .join("; ");
          if (cssText !== "") {
            element.setAttribute("style", cssText);
          }
        } else {
          element.setAttribute(key, stringifyAttrValue(value));
        }
      }
    }
  }

  // Append children
  for (const child of children) {
    element.appendChild(createNode(child, elementNs));
  }

  return element;
}

/**
 * Build a document fragment from a tree structure.
 * @param structure The tree structure to convert (array of trees).
 * @param ns The namespace (0 = HTML, 1 = SVG, 2 = MathML).
 * @returns The created DocumentFragment.
 */
function buildFragment(
  structure: readonly Tree[],
  ns: Namespace,
): DocumentFragment {
  const fragment = document.createDocumentFragment();
  for (const tree of structure) {
    fragment.appendChild(createNode(tree, ns));
  }
  return fragment;
}

/**
 * Create a factory function that produces cloned DOM fragments from a tree structure.
 * Uses template caching to enable efficient cloning of repeated structures.
 *
 * @param structure The tree structure to convert.
 * @param flags Namespace flags (0 = HTML, 1 = SVG, 2 = MathML).
 * @returns A factory function that returns a cloned DocumentFragment.
 */
function fromTree(
  structure: readonly Tree[] | CompiledTemplateDescriptor,
  flags: Namespace = Namespace.HTML,
): () => DocumentFragment {
  if (isCompiledTemplateDescriptor(structure)) {
    const cached = compiledTemplateCache.get(structure);
    if (cached !== undefined) {
      return cached;
    }

    const template = buildCompiledFragment(structure);
    const factory = () => template.cloneNode(true) as DocumentFragment;
    compiledTemplateCache.set(structure, factory);
    return factory;
  }

  // Check cache first (two-level: structure → flags)
  let byFlags = templateCache.get(structure);
  if (byFlags !== undefined) {
    const cached = byFlags.get(flags);
    if (cached !== undefined) {
      return cached;
    }
  } else {
    byFlags = new Map();
    templateCache.set(structure, byFlags);
  }

  // Build template once for this structure + flags combination
  const template = buildFragment(structure, flags);

  // Create and cache factory
  const factory = () => template.cloneNode(true) as DocumentFragment;
  byFlags.set(flags, factory);

  return factory;
}

/**
 * Create a DOM fragment factory from pre-rendered markup.
 *
 * @param markup - The markup string. **MUST be trusted or sanitized** — it is parsed via
 *   `innerHTML` and can execute inline scripts, event handlers, or javascript: URLs
 *   once the fragment is inserted into the document/shadow root.
 * @param flags - Namespace flags (default HTML).
 */
function fromMarkup(
  markup: string,
  flags: Namespace = Namespace.HTML,
): () => DocumentFragment {
  const template = buildCompiledFragment({
    kind: "compiled",
    markup,
    namespace: flags,
  });

  return () => template.cloneNode(true) as DocumentFragment;
}

export { fromMarkup, fromTree };
