type ReferenceLevel = "recommended" | "extension" | "internal";

type ReferenceParameter = {
  name: string;
  type: string;
  description: string;
};

type ReferenceApi = {
  name: string;
  kind: "function" | "type" | "constant" | "class";
  description: string;
  signature: string;
  parameters?: ReferenceParameter[];
  returns?: string;
  example?: string;
  notes?: string[];
};

type ReferenceExportGroup = {
  label: string;
  items: string[];
};

type ReferenceDocument = {
  path: string;
  title: string;
  packageName: string;
  exportPath: string;
  importPath: string;
  level: ReferenceLevel;
  audience: string;
  description: string;
  preferredImport?: string;
  declarationFile: string;
  exports: ReferenceExportGroup[];
  apis: ReferenceApi[];
};

type ReferenceId =
  | "reactivity"
  | "components"
  | "components-ssr"
  | "components-internal"
  | "runtime"
  | "runtime-ssr"
  | "runtime-hydration"
  | "store"
  | "store-internal"
  | "plugin"
  | "transformer"
  | "core-ssr"
  | "core-hydration";

export type {
  ReferenceApi,
  ReferenceDocument,
  ReferenceExportGroup,
  ReferenceId,
  ReferenceLevel,
  ReferenceParameter,
};
