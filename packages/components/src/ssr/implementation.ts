/**
 * SSR DSD renderer for Web Components.
 *
 * Provides renderDSD/renderDSDContent for cross-framework SSR,
 * and auto-setup of ComponentRenderer for Dathra SSR.
 * @module
 */

import { getGlobalStyleCssTexts } from "@/css/implementation";
import type {
  ComponentContext,
  ComponentMetadata,
  PropDefinition,
  PropsSchema,
} from "@/defineComponent/implementation";
import { getComponent } from "@/registry/implementation";
import { signal } from "@dathra/reactivity";
import {
  createStoreScript,
  type SerializableValue,
  setComponentRenderer,
} from "@dathra/runtime/ssr";
import { serializeState } from "@dathra/runtime/ssr";
import type {
  AtomStore,
  AtomStoreSnapshot,
  PrimitiveAtom,
} from "@dathra/store";
import { withStore } from "@dathra/store";
import { getCurrentStore } from "@dathra/store/internal";

interface SSRStoreOptions {
  store?: AtomStore;
  storeSnapshotSchema?: AtomStoreSnapshot<
    Record<string, PrimitiveAtom<unknown>>
  >;
}

type SerializableStoreSnapshot = Record<string, SerializableValue>;

function assertStoreSnapshotOptions(options: SSRStoreOptions): void {
  if (
    options.storeSnapshotSchema !== undefined &&
    options.store === undefined
  ) {
    throw new Error("[dathra] storeSnapshotSchema requires a store");
  }
}

/**
 * Get the default value for a PropDefinition (mirrors CSR getDefaultValue).
 * @internal
 */
function getDefaultValue(def: PropDefinition): unknown {
  if (def.default !== undefined) return def.default;
  if (def.type === String) return "";
  if (def.type === Number) return 0;
  if (def.type === Boolean) return false;
  return undefined;
}

/**
 * Coerce an attribute value for SSR context (mirrors CSR coercion logic).
 * @internal
 */
function coerceForSSR(def: PropDefinition, attrValue: string | null): unknown {
  if (def.type === Boolean) return attrValue !== null;
  if (def.type === Number) {
    // Per SPEC ADR-006: null → default value (Number(null) = 0 would hide the real default)
    if (attrValue === null) return getDefaultValue(def);
    return Number(attrValue);
  }
  if (def.type === String) {
    // Per SPEC ADR-006: null → default value
    if (attrValue === null) return getDefaultValue(def);
    return attrValue;
  }
  // Custom coercion function - pass null through as per SPEC
  if (typeof def.type === "function") {
    return def.type(attrValue);
  }
  // Fallback for null with no custom function
  if (attrValue === null) {
    return getDefaultValue(def);
  }
  return attrValue;
}

/**
 * Render DSD inner content for a registered component.
 * Returns `<style>` tags + component HTML, or null if not registered.
 * @internal
 */
function renderComponentContent(
  tagName: string,
  attrs: Record<string, unknown>,
  options: SSRStoreOptions = {},
): string | null {
  assertStoreSnapshotOptions(options);

  const resolvedStore = options.store ?? getCurrentStore();

  const registration = getComponent(tagName);
  if (!registration) return null;

  const { propsSchema } = registration;

  // Build ComponentContext from props schema or raw attrs
  const propSignals: Record<string, ReturnType<typeof signal>> = {};
  if (propsSchema) {
    for (const propName of Object.keys(propsSchema)) {
      const def = propsSchema[propName]!;
      const attrName =
        def.attribute === false
          ? null
          : typeof def.attribute === "string"
            ? def.attribute
            : propName;
      const rawValue =
        attrName !== null && attrs[attrName] != null
          ? stringifyAttrValue(attrs[attrName])
          : null;
      propSignals[propName] = signal(coerceForSSR(def, rawValue));
    }
  }
  const ctx = {
    host: {} as HTMLElement,
    props: propSignals,
    client: {
      strategy: null,
      value: null,
      hydrated: false,
    },
    get store() {
      if (resolvedStore === undefined) {
        throw new Error(
          "[dathra] SSR component context does not provide a store yet",
        );
      }
      return resolvedStore;
    },
  } as ComponentContext<PropsSchema>;

  // Call setup function (in SSR mode, returns HTML string)
  const result =
    resolvedStore === undefined
      ? registration.setup(ctx.host, ctx)
      : withStore(resolvedStore, () => registration.setup(ctx.host, ctx));

  // In SSR mode, the setup function returns an HTML string
  const contentHtml = typeof result === "string" ? result : "";

  // Build DSD content: <style> tags + component HTML
  let dsdContent = "";

  if (
    options.storeSnapshotSchema !== undefined &&
    resolvedStore !== undefined
  ) {
    const snapshot = options.storeSnapshotSchema.serialize(
      resolvedStore,
    ) as SerializableStoreSnapshot;
    dsdContent += createStoreScript(serializeState(snapshot));
  }

  const emittedCssTexts = new Set<string>();

  for (const cssText of getGlobalStyleCssTexts()) {
    if (emittedCssTexts.has(cssText)) continue;
    emittedCssTexts.add(cssText);
    dsdContent += `<style>${cssText}</style>`;
  }

  // Add CSS as <style> tags inside DSD
  for (const cssText of registration.cssTexts) {
    if (emittedCssTexts.has(cssText)) continue;
    emittedCssTexts.add(cssText);
    dsdContent += `<style>${cssText}</style>`;
  }

  // Add component content
  dsdContent += contentHtml;

  return dsdContent;
}

/**
 * Escape an attribute value for safe HTML output.
 */
function escapeAttr(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/"/g, "&quot;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function stringifyAttrValue(value: unknown): string {
  switch (typeof value) {
    case "string":
      return value;
    case "number":
    case "boolean":
    case "bigint":
      return String(value);
    case "object":
      return JSON.stringify(value);
    case "symbol":
      return value.description ?? "";
    default:
      return String(value);
  }
}

/**
 * Render Declarative Shadow DOM content (inner template only).
 *
 * Returns `<template shadowrootmode="open">...</template>` for a registered component.
 * Useful with `dangerouslySetInnerHTML` in React or similar patterns.
 *
 * @param target - The custom element tag name or component class.
 * @param attrs - Attribute values to pass to the component.
 * @returns The DSD template HTML string.
 * @throws If the component is not registered.
 *
 * @example
 * ```tsx
 * // With component class
 * const Counter = defineComponent('my-counter', ...);
 * const dsd = renderDSDContent(Counter, { initial: '10' });
 * <my-counter initial="10" dangerouslySetInnerHTML={{ __html: dsd }} />
 *
 * // With tag name (legacy)
 * const dsd = renderDSDContent('my-counter', { initial: '10' });
 * ```
 */
function renderDSDContent(
  target: string | ComponentMetadata,
  attrs: Record<string, unknown> = {},
  options: SSRStoreOptions = {},
): string {
  const tagName = typeof target === "string" ? target : target.__tagName__;
  const content = renderComponentContent(tagName, attrs, options);
  if (content == null) {
    throw new Error(
      `[dathra] Component "${tagName}" is not registered. Call defineComponent() first.`,
    );
  }
  return `<template shadowrootmode="open">${content}</template>`;
}

/**
 * Render a complete custom element with Declarative Shadow DOM.
 *
 * Returns the full element HTML including the DSD template.
 * Can be directly inserted into any SSR output (React, Vue, etc.).
 *
 * @param target - The custom element tag name or component class.
 * @param attrs - Attribute values to pass to the component.
 * @returns The full custom element HTML with DSD.
 * @throws If the component is not registered.
 *
 * @example
 * ```typescript
 * // With component class (recommended)
 * const Counter = defineComponent('my-counter', ...);
 * const html = renderDSD(Counter, { initial: '10' });
 * // → '<my-counter initial="10"><template shadowrootmode="open">...</template></my-counter>'
 *
 * // With tag name (legacy)
 * const html = renderDSD('my-counter', { initial: '10' });
 * ```
 */
function renderDSD(
  target: string | ComponentMetadata,
  attrs: Record<string, unknown> = {},
  options: SSRStoreOptions = {},
): string {
  const tagName = typeof target === "string" ? target : target.__tagName__;
  const dsdTemplate = renderDSDContent(tagName, attrs, options);

  // Build attribute string
  let attrStr = "";
  for (const [key, value] of Object.entries(attrs)) {
    if (value === null || value === undefined || value === false) {
      continue;
    }

    if (value === true) {
      attrStr += ` ${key}`;
      continue;
    }

    attrStr += ` ${key}="${escapeAttr(stringifyAttrValue(value))}"`;
  }

  return `<${tagName}${attrStr}>${dsdTemplate}</${tagName}>`;
}

/**
 * Create a component renderer callback for Dathra's renderToString.
 *
 * Uses the component registry to resolve custom element tags
 * and render their content with Declarative Shadow DOM.
 *
 * @internal This is primarily for internal use by Dathra's SSR system.
 * Most users should use `renderDSD` or `renderDSDContent` instead.
 *
 * @returns A function that takes (tagName, attrs) and returns DSD HTML or null.
 */
function createComponentRenderer(): (
  tagName: string,
  attrs: Record<string, unknown>,
) => string | null {
  return renderComponentContent;
}

/** Whether the global ComponentRenderer has been initialized. */
let _rendererInitialized = false;

/**
 * Ensure the global ComponentRenderer is set up for Dathra SSR.
 * Called automatically by defineComponent in SSR mode.
 * Safe to call multiple times (idempotent).
 * @internal
 */
function ensureComponentRenderer(): void {
  if (_rendererInitialized) return;
  _rendererInitialized = true;
  setComponentRenderer(renderComponentContent);
}

/**
 * Reset the SSR renderer initialization state.
 * @internal - For testing only.
 */
function _resetRendererState(): void {
  _rendererInitialized = false;
  setComponentRenderer(undefined);
}

export {
  _resetRendererState,
  createComponentRenderer,
  ensureComponentRenderer,
  renderDSD,
  renderDSDContent,
};
