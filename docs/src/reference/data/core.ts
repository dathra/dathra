import type { ReferenceDocument } from "../types";

const coreSsrReference: ReferenceDocument = {
  path: "/reference/core/ssr",
  title: "Core SSR API Reference",
  packageName: "@dathra/core",
  exportPath: "@dathra/core/ssr",
  importPath: "@dathra/core/ssr",
  level: "recommended",
  audience: "Application authors building SSR entries and adapter authors integrating Dathra SSR.",
  description: "Convenience SSR entry and rendering APIs for Dathra applications.",
  declarationFile: "packages/core/dist/ssr/index.d.mts",
  exports: [
    { label: "Functions", items: ["defineSsrEntry", "render"] },
    { label: "Types", items: ["SsrEntryContext", "SsrEntryHandler", "SsrEntryResult"] },
  ],
  apis: [
    {
      name: "defineSsrEntry()",
      kind: "function",
      description: "Define a typed SSR request handler consumed by Dathra SSR adapters.",
      signature: `type SsrEntryContext = {
  request: Request;
  requestId: string;
  url: string;
};

type SsrEntryResult =
  | string
  | Response
  | { html: string; statusCode?: number; headers?: HeadersInit };

type SsrEntryHandler = (context: SsrEntryContext) => SsrEntryResult | Promise<SsrEntryResult>;

declare function defineSsrEntry<const Handler extends SsrEntryHandler>(handler: Handler): Handler;`,
      parameters: [
        {
          name: "handler",
          type: "Handler extends SsrEntryHandler",
          description: "Request handler for SSR rendering.",
        },
      ],
      returns: "The same handler, preserving its concrete type.",
    },
    {
      name: "render()",
      kind: "function",
      description: "Render a Dathra component to Declarative Shadow DOM HTML for SSR.",
      signature:
        "declare function render(...args: Parameters<typeof renderDSD>): ReturnType<typeof renderDSD>;",
      parameters: [
        {
          name: "...args",
          type: "Parameters<typeof renderDSD>",
          description: "Forwarded to @dathra/components/ssr renderDSD().",
        },
      ],
      returns: "The return value of renderDSD().",
    },
  ],
};

const coreHydrationReference: ReferenceDocument = {
  path: "/reference/core/hydration",
  title: "Core Hydration API Reference",
  packageName: "@dathra/core",
  exportPath: "@dathra/core/hydration",
  importPath: "@dathra/core/hydration",
  level: "recommended",
  audience: "Application authors hydrating Dathra SSR output and island roots.",
  description: "Convenience hydration API for hydrating Dathra islands under a root node.",
  declarationFile: "packages/core/dist/hydration/index.d.mts",
  exports: [
    { label: "Functions", items: ["hydrate"] },
    { label: "Types", items: ["HydrationRoot"] },
  ],
  apis: [
    {
      name: "hydrate()",
      kind: "function",
      description: "Hydrate Dathra islands under the provided root. Defaults to document.",
      signature: `type HydrationRoot = Parameters<typeof hydrateIslands>[0];

declare function hydrate(root?: HydrationRoot): ReturnType<typeof hydrateIslands>;`,
      parameters: [
        {
          name: "root",
          type: "HydrationRoot",
          description: "Root node to scan for Dathra islands. Defaults to document.",
        },
      ],
      returns: "The return value of @dathra/runtime/hydration hydrateIslands().",
      example: `import { hydrate } from "@dathra/core/hydration";

void import("./AppRoot").then(() => {
  queueMicrotask(() => hydrate(document));
});`,
    },
  ],
};

export { coreHydrationReference, coreSsrReference };
