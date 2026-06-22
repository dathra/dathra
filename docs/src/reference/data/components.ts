import type { ReferenceDocument } from "../types";

const componentsReference: ReferenceDocument = {
  path: "/reference/components",
  title: "Components API Reference",
  packageName: "@dathra/components",
  exportPath: "@dathra/components",
  importPath: "@dathra/components",
  preferredImport: "@dathra/core",
  level: "recommended",
  audience:
    "Application authors defining Web Components and contributors working on component rendering.",
  description:
    "High-level Web Components API for custom elements, scoped styles, props, stores, registration, and SSR metadata.",
  declarationFile: "packages/components/dist/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: [
        "adoptGlobalStyles",
        "bindStoreToHost",
        "clearGlobalStyles",
        "clearRegistry",
        "css",
        "defineComponent",
        "getComponent",
        "getCssText",
        "hasComponent",
        "registerComponent",
      ],
    },
    {
      label: "Types",
      items: [
        "ComponentClass",
        "ComponentConstructor",
        "ComponentContext",
        "ComponentElement",
        "ComponentMetadata",
        "ComponentOptions",
        "ComponentRegistration",
        "DathraStyleSheet",
        "DefinedComponent",
        "FunctionComponent",
        "HydrateSetupFunction",
        "InferPropType",
        "InferProps",
        "JSXComponent",
        "JSXComponentProps",
        "JSXPropValue",
        "JSXReactiveValue",
        "PropDefinition",
        "PropType",
        "PropsSchema",
      ],
    },
  ],
  apis: [
    {
      name: "defineComponent()",
      kind: "function",
      description: "Define and register a Dathra-backed custom element.",
      signature: `declare function defineComponent<const S extends PropsSchema = EmptyPropsSchema>(
  tagName: string,
  component: FunctionComponent<S>,
  options?: ComponentOptions<S>,
): DefinedComponent<S>;

interface DefinedComponent<S extends PropsSchema = EmptyPropsSchema> extends ComponentMetadata<S> {
  (props: JSXComponentProps<S> | null): Node;
  readonly webComponent: ComponentConstructor<S>;
  readonly jsx: JSXComponent<S>;
}`,
      parameters: [
        {
          name: "tagName",
          type: "string",
          description: "Custom element tag name. It must contain a hyphen.",
        },
        {
          name: "component",
          type: "FunctionComponent<S>",
          description: "Function that renders the component tree.",
        },
        {
          name: "options",
          type: "ComponentOptions<S>",
          description: "Optional props, styles, hydration metadata, and hooks.",
        },
      ],
      returns: "A DefinedComponent<S> callable JSX helper with .webComponent and .jsx helpers.",
      example: `import { css, defineComponent } from "@dathra/core";

const Counter = defineComponent(
  "my-counter",
  ({ props }) => <button>{props.count.value}</button>,
  {
    props: { count: { type: Number, default: 0 } },
    styles: [css\`:host { display: block; }\`],
  },
);`,
    },
    {
      name: "css()",
      kind: "function",
      description: "Create a stylesheet for use with defineComponent styles.",
      signature:
        "declare function css(strings: TemplateStringsArray, ...values: unknown[]): CSSStyleSheet;",
      parameters: [
        { name: "strings", type: "TemplateStringsArray", description: "Template string parts." },
        {
          name: "...values",
          type: "unknown[]",
          description: "Interpolated values converted into the CSS text.",
        },
      ],
      returns:
        "A CSSStyleSheet. In SSR environments it carries __cssText for Declarative Shadow DOM output.",
    },
    {
      name: "Style helpers",
      kind: "function",
      description: "Manage and inspect global style sheets used by Dathra component rendering.",
      signature: `interface DathraStyleSheet extends CSSStyleSheet {
  __cssText: string;
}

declare function getCssText(sheet: CSSStyleSheet | string): string | undefined;
declare function adoptGlobalStyles(...styles: readonly (CSSStyleSheet | string)[]): void;
declare function clearGlobalStyles(): void;`,
    },
    {
      name: "Component registry",
      kind: "function",
      description:
        "Register, query, and clear component metadata used by SSR and nested component rendering.",
      signature: `interface ComponentRegistration {
  readonly tagName: string;
  readonly setup: SetupFunction;
  readonly cssTexts: readonly string[];
  readonly propsSchema?: PropsSchema;
  readonly hydrationMetadata?: ComponentHydrationMetadata;
}

declare function registerComponent(
  tagName: string,
  setup: SetupFunction,
  cssTexts: readonly string[],
  propsSchema?: PropsSchema,
  hydrationMetadata?: ComponentHydrationMetadata,
): void;
declare function getComponent(tagName: string): ComponentRegistration | undefined;
declare function hasComponent(tagName: string): boolean;
declare function clearRegistry(): void;`,
    },
    {
      name: "bindStoreToHost()",
      kind: "function",
      description: "Bind a store boundary to a component host for component subtree access.",
      signature: "declare function bindStoreToHost(host: HTMLElement, store: AtomStore): void;",
      notes: [
        "This is exported from @dathra/components root, but most application code should use withStore() instead.",
      ],
    },
  ],
};

const componentsSsrReference: ReferenceDocument = {
  path: "/reference/components/ssr",
  title: "Components SSR API Reference",
  packageName: "@dathra/components",
  exportPath: "@dathra/components/ssr",
  importPath: "@dathra/components/ssr",
  preferredImport: "@dathra/core/ssr for application SSR entries",
  level: "extension",
  audience: "SSR adapter authors, cross-framework integrators, and Dathra contributors.",
  description: "Declarative Shadow DOM rendering helpers for registered Dathra components.",
  declarationFile: "packages/components/dist/ssr/index.d.mts",
  exports: [
    { label: "Functions", items: ["createComponentRenderer", "renderDSD", "renderDSDContent"] },
  ],
  apis: [
    {
      name: "renderDSDContent()",
      kind: "function",
      description:
        "Render only the Declarative Shadow DOM template content for a registered component.",
      signature: `interface SSRStoreOptions {
  store?: AtomStore;
  storeSnapshotSchema?: AtomStoreSnapshot<Record<string, PrimitiveAtom<unknown>>>;
}

declare function renderDSDContent(
  target: string | ComponentMetadata,
  attrs?: Record<string, unknown>,
  options?: SSRStoreOptions,
): string;`,
      returns: 'A <template shadowrootmode="open">...</template> HTML string.',
    },
    {
      name: "renderDSD()",
      kind: "function",
      description: "Render a complete custom element with Declarative Shadow DOM.",
      signature: `declare function renderDSD(
  target: string | ComponentMetadata,
  attrs?: Record<string, unknown>,
  options?: SSRStoreOptions,
): string;`,
      returns: "A full custom element HTML string containing the DSD template.",
    },
    {
      name: "createComponentRenderer()",
      kind: "function",
      description: "Create a component renderer callback for Dathra runtime SSR rendering.",
      signature:
        "declare function createComponentRenderer(): (tagName: string, attrs: Record<string, unknown>) => string | null;",
      returns: "A callback that returns DSD HTML for registered custom element tags or null.",
      notes: [
        "Primarily for Dathra SSR integration. Most users should call @dathra/core/ssr render().",
      ],
    },
  ],
};

const componentsInternalReference: ReferenceDocument = {
  path: "/reference/components/internal",
  title: "Components Internal API Reference",
  packageName: "@dathra/components",
  exportPath: "@dathra/components/internal",
  importPath: "@dathra/components/internal",
  level: "internal",
  audience:
    "Dathra contributors and package-level integrations that intentionally consume exported internals.",
  description: "Internal-but-exported component store binding helpers.",
  declarationFile: "packages/components/dist/internal.d.mts",
  exports: [{ label: "Functions", items: ["bindCurrentStoreToSubtree", "bindStoreToHost"] }],
  apis: [
    {
      name: "bindCurrentStoreToSubtree() / bindStoreToHost()",
      kind: "function",
      description:
        "Bind store context to component hosts or subtrees. Exported for Dathra package integration.",
      signature: `export { bindCurrentStoreToSubtree, bindStoreToHost };

declare function bindCurrentStoreToSubtree(root: Node): void;
declare function bindStoreToHost(host: HTMLElement, store: AtomStore): void;`,
      notes: [
        "The package export is public, but the API is marked internal by path. Prefer @dathra/store withStore() in application code.",
      ],
    },
  ],
};

export { componentsInternalReference, componentsReference, componentsSsrReference };
