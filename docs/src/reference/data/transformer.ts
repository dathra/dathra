import type { ReferenceDocument } from "../types";

const transformerReference: ReferenceDocument = {
  path: "/reference/transformer",
  title: "Transformer API Reference",
  packageName: "@dathra/transformer",
  exportPath: "@dathra/transformer",
  importPath: "@dathra/transformer",
  level: "extension",
  audience: "Build-tool authors, compiler integrations, and Dathra contributors.",
  description:
    "Programmatic JSX transformation and SSR generation utilities used by @dathra/plugin.",
  declarationFile: "packages/transformer/dist/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: ["transform", "generateSSRRender", "generateStateObject", "isSSRImport"],
    },
    { label: "Constants", items: ["SSR_IMPORTS"] },
    { label: "Types", items: ["SSRImport", "TransformOptions", "TransformResult"] },
  ],
  apis: [
    {
      name: "transform()",
      kind: "function",
      description: "Transform source code containing Dathra JSX.",
      signature: `interface TransformOptions {
  mode?: "csr" | "ssr";
  sourceMap?: boolean;
  filename?: string;
  runtimeModule?: string;
}

interface TransformResult {
  code: string;
  map?: string;
}

declare function transform(code: string, options?: TransformOptions): TransformResult;`,
      parameters: [
        { name: "code", type: "string", description: "Source text containing JSX." },
        {
          name: "options",
          type: "TransformOptions",
          description:
            "Transformation mode, sourcemap, filename, and runtime import module options.",
        },
      ],
      returns: "TransformResult containing generated code and optional source map.",
    },
    {
      name: "SSR imports and helpers",
      kind: "function",
      description: "Helpers used by SSR transform output generation.",
      signature: `declare const SSR_IMPORTS: readonly [
  "renderToString",
  "renderTree",
  "serializeState",
  "createMarker",
  "MarkerType",
];

type SSRImport = (typeof SSR_IMPORTS)[number];

declare function isSSRImport(name: string): name is SSRImport;
declare function generateSSRRender(tree: ESTNode, dynamicValues: ESTNode[], stateExpr: ESTNode | null): ESTNode;
declare function generateStateObject(signals: Map<string, ESTNode>): ESTNode;`,
      notes: ["These APIs are for transformer/plugin development, not application code."],
    },
  ],
};

export { transformerReference };
