/**
 * JSX Runtime for Dathra
 *
 * Provides jsx(), jsxs(), and Fragment for JSX transformation.
 * This enables JSX syntax in components.
 */
import { templateEffect } from "@dathra/reactivity";
import { bindCurrentStoreToSubtree } from "@dathra/components/internal";
import {
  event,
  firstChild,
  fromTree,
  nextSibling,
  setText,
  type RuntimeJSX,
  type Tree,
} from "@dathra/runtime";

export { Fragment } from "./Fragment";

declare global {
  namespace JSX {
    interface IntrinsicElements extends RuntimeJSX.IntrinsicElements {
      [K: `${string}-${string}`]: Record<string, unknown>;
    }

    interface Element extends Node {}

    interface ElementAttributesProperty {
      props: Record<string, unknown>;
    }

    interface ElementChildrenAttribute {
      children: unknown;
    }
  }
}

/** Narrowed type for a reactive value with a .value property. */
interface ReactiveValue {
  value: unknown;
}

type JSXChild =
  | Node
  | string
  | number
  | boolean
  | null
  | undefined
  | (() => unknown)
  | ReactiveValue;
type JSXChildren = JSXChild | JSXChild[];
type JSXAttributeValue = JSXChildren | ReactiveValue;

type AdaptIntrinsicPropValue<T> = T extends (...args: never[]) => unknown
  ? T
  : T extends never
    ? never
    : T | ReactiveValue;

type AdaptIntrinsicProps<T> = {
  [K in keyof T]: K extends "children"
    ? T[K] extends never
      ? never
      : JSXChildren
    : AdaptIntrinsicPropValue<T[K]>;
};

type AdaptedIntrinsicElements = {
  [K in keyof RuntimeJSX.IntrinsicElements]: AdaptIntrinsicProps<
    RuntimeJSX.IntrinsicElements[K]
  >;
};

interface JSXProps {
  children?: JSXChildren;
  [key: string]: JSXAttributeValue;
}

/**
 * Check if a value is a reactive accessor (has .value property access).
 */
function isReactiveValue(value: unknown): value is ReactiveValue {
  return (
    typeof value === "object" &&
    value !== null &&
    "value" in value &&
    typeof (value as Record<string, unknown>).value !== "undefined"
  );
}

/**
 * Check if a key is an event handler.
 */
function isEventHandler(key: string): boolean {
  return (
    key.startsWith("on") && key.length > 2 && key[2] === key[2].toUpperCase()
  );
}

/**
 * Get event type from handler key (onClick -> click).
 */
function getEventType(key: string): string {
  return key.slice(2).toLowerCase();
}

/**
 * Create a DOM element from JSX.
 */
function createElement(
  tag: string | ((props: JSXProps) => Node),
  props: JSXProps | null,
): Node {
  // Handle function components
  if (typeof tag === "function") {
    return tag(props ?? {});
  }

  const { children, ...attrs } = props ?? {};

  // Build tree structure
  const tree: Tree[] = [[tag, Object.keys(attrs).length > 0 ? {} : null]];
  const treeNode = tree[0] as [
    string,
    Record<string, unknown> | null,
    ...Tree[],
  ];

  // Separate static attrs from dynamic ones and events
  const staticAttrs: Record<string, unknown> = {};
  const dynamicAttrs: Array<{ key: string; value: ReactiveValue }> = [];
  const events: Array<{ type: string; handler: EventListener }> = [];

  for (const [key, value] of Object.entries(attrs)) {
    if (isEventHandler(key) && typeof value === "function") {
      // Only register as event listener if the value is actually a function
      events.push({ type: getEventType(key), handler: value as EventListener });
    } else if (isReactiveValue(value)) {
      dynamicAttrs.push({ key, value });
    } else {
      staticAttrs[key] = value;
    }
  }

  if (Object.keys(staticAttrs).length > 0) {
    treeNode[1] = staticAttrs;
  }

  // Process children
  const dynamicTexts: Array<{ index: number; getter: () => unknown }> = [];
  const childNodes: Node[] = [];

  function processChild(child: JSXChild, _index: number): void {
    if (child === null || child === undefined || typeof child === "boolean") {
      return;
    }

    if (typeof child === "string" || typeof child === "number") {
      treeNode.push(String(child));
    } else if (child instanceof Node) {
      // For DOM nodes, we'll append them after template creation
      treeNode.push(["{insert}", null]);
      childNodes.push(child);
    } else if (typeof child === "function") {
      // Getter function for reactive text: {() => count.value}
      treeNode.push(["{text}", null]);
      dynamicTexts.push({
        index: treeNode.length - 3,
        getter: child,
      });
    } else if (isReactiveValue(child)) {
      // Direct reactive value (signal/computed)
      treeNode.push(["{text}", null]);
      dynamicTexts.push({
        index: treeNode.length - 3,
        getter: () => child.value,
      });
    }
  }

  if (Array.isArray(children)) {
    children.forEach((child, i) => processChild(child, i));
  } else if (children !== undefined) {
    processChild(children, 0);
  }

  // Create DOM
  const factory = fromTree(tree, 0);
  const fragment = factory();
  bindCurrentStoreToSubtree(fragment);
  const firstEl = firstChild(fragment) as Node | null;
  if (firstEl === null) {
    // A non-void element must always produce at least one child node
    throw new Error(`createElement: no child element found for tag "${tag}"`);
  }
  const element = firstEl as HTMLElement;

  // Bind events
  for (const { type, handler } of events) {
    event(type, element, handler);
  }

  // Bind dynamic attributes
  for (const { key, value } of dynamicAttrs) {
    templateEffect(() => {
      const v = value.value;
      if (key === "class" || key === "className") {
        element.setAttribute("class", String(v));
      } else {
        element.setAttribute(key, String(v));
      }
    });
  }

  // Bind dynamic text nodes
  if (dynamicTexts.length > 0) {
    let textNode = firstChild(element, true) as Node | null;
    let textIndex = 0;

    for (const { index, getter } of dynamicTexts) {
      // Navigate to the correct text node
      while (textIndex < index && textNode !== null) {
        textNode = nextSibling(textNode);
        textIndex++;
      }

      if (textNode !== null && textNode.nodeType === Node.TEXT_NODE) {
        const tn = textNode as Text;
        templateEffect(() => {
          setText(tn, String(getter()));
        });
      }
    }
  }

  // Append child nodes
  for (const childNode of childNodes) {
    element.appendChild(childNode);
  }

  return element;
}

/**
 * JSX factory function for elements with single child.
 */
export function jsx(
  tag: string | ((props: JSXProps) => Node),
  props: JSXProps | null,
): Node {
  return createElement(tag, props);
}

/**
 * JSX factory function for elements with multiple children.
 */
export function jsxs(
  tag: string | ((props: JSXProps) => Node),
  props: JSXProps | null,
): Node {
  return createElement(tag, props);
}

/**
 * Development JSX factory (same as jsx in production).
 */
export const jsxDEV = jsx;

export namespace JSX {
  export interface IntrinsicElements extends AdaptedIntrinsicElements {}
  export interface Element extends globalThis.JSX.Element {}
  export interface ElementAttributesProperty
    extends globalThis.JSX.ElementAttributesProperty {}
  export interface ElementChildrenAttribute
    extends globalThis.JSX.ElementChildrenAttribute {}
}
