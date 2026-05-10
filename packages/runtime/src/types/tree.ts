/**
 * Structured array format (IR) types.
 * Transformer generates this format, Runtime consumes it.
 */

/**
 * Placeholder types for dynamic content.
 */
type PlaceholderType = "{text}" | "{insert}" | "{each}";

/**
 * Placeholder node representing a dynamic slot.
 * Format: ['{type}', null]
 */
type Placeholder = [PlaceholderType, null];

/**
 * Static text content.
 */
type TextContent = string;

/**
 * Element attributes object or null if no attributes.
 */
type Attrs = Record<string, unknown> | null;

/**
 * Tree node representing an element.
 * Format: [tagName, attrs, ...children]
 */
type TreeNode = [string, Attrs, ...(Tree | TextContent | Placeholder)[]];

/**
 * Tree structure representing DOM content.
 * Can be an element node, text, or placeholder.
 */
type Tree = TreeNode | TextContent | Placeholder;

/**
 * Namespace flags for fromTree.
 * 0 = HTML (default)
 * 1 = SVG
 * 2 = MathML
 */
enum Namespace {
  HTML = 0,
  SVG = 1,
  MathML = 2,
}

export { Namespace };
export type {
  Attrs,
  Placeholder,
  PlaceholderType,
  TextContent,
  Tree,
  TreeNode,
};
