import { readFileSync } from "node:fs";

import {
  canHaveModifiers,
  createSourceFile,
  getModifiers,
  isExportAssignment,
  isExportDeclaration,
  isNamedExports,
  isStringLiteral,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
  type Statement,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import { sharedRootArtifactPath } from "../../test/publicationArtifacts";
import {
  registryId,
  type RegistrySourceEntry,
} from "../executionRegistry/implementation";
import {
  // @ts-expect-error AS01 owns shared-root publication.
  type ExecutionContractSource as _RootExecutionContractSourceMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type ExecutionContractSourceInput as _RootExecutionContractSourceInputMustNotExist,
  type RegistrySourceEntry as RootRegistrySourceEntry,
} from "../index";
import * as executionContractApi from "./implementation";
import {
  factId,
  type ExecutionContractRegistrySources,
  type ExecutionContractSource,
  type ExecutionContractSourceInput,
  type ExportExecutionContract,
  type FactId,
  type SemanticFact,
  type SemanticRelation,
} from "./implementation";
import * as sourceModelApi from "./sourceModel";

type ExpectedExecutionContractSourceInput = {
  readonly schema: "dathra.execution/1";
  readonly id: string;
  readonly version: string;
  readonly facts: readonly SemanticFact[];
  readonly relations: readonly SemanticRelation[];
  readonly exports: Readonly<Record<string, ExportExecutionContract>>;
  readonly registries: ExecutionContractRegistrySources;
  readonly hostAssumptionFactIds: readonly FactId[];
};

type ExpectedExecutionContractSourceKey =
  | "schema"
  | "id"
  | "version"
  | "facts"
  | "relations"
  | "exports"
  | "registries"
  | "hostAssumptionFactIds";

type ExecutionContractApi = typeof executionContractApi;
type _DefineExecutionContractMustNotExist =
  // @ts-expect-error SC02A12 owns the source creator.
  ExecutionContractApi["defineExecutionContract"];
type _ParseExecutionContractSourceMustNotExist =
  // @ts-expect-error SC02A12 owns the source parser.
  ExecutionContractApi["parseExecutionContractSource"];
type _DigestExecutionContractSourceMustNotExist =
  // @ts-expect-error SC02A13 owns the source digest.
  ExecutionContractApi["digestExecutionContractSource"];

const SOURCE_KEYS = [
  "schema",
  "id",
  "version",
  "facts",
  "relations",
  "exports",
  "registries",
  "hostAssumptionFactIds",
] as const satisfies readonly ExpectedExecutionContractSourceKey[];

const EMPTY_REGISTRIES = {
  codecs: [],
  resolvers: [],
  remoteOperations: [],
  remoteDeliveryAdapters: [],
  subscriptionSources: [],
  brands: [],
  valueDomains: [],
  policies: [],
  hostProfiles: [],
  failureSchemas: [],
} as const satisfies ExecutionContractRegistrySources;

const PRESENT_EFFECT_FACT_ID = factId("effect:present");
const DANGLING_READ_FACT_ID = factId("read:missing");
const DANGLING_EXPORT_FACT_ID = factId("export:missing");
const DANGLING_HOST_FACT_ID = factId("host:missing");

const PRESENT_EFFECT_FACT = {
  schema: "dathra.fact/1",
  id: PRESENT_EFFECT_FACT_ID,
  subject: { kind: "module-evaluation" },
  kind: "effect",
  retainsCallbacks: false,
  reentrant: false,
  schedulesWork: false,
  allocatesResource: false,
} as const satisfies SemanticFact;

const DANGLING_READ_RELATION = {
  schema: "dathra.relation/1",
  kind: "reads",
  from: { factId: PRESENT_EFFECT_FACT_ID, factKind: "effect" },
  to: { factId: DANGLING_READ_FACT_ID, factKind: "read" },
} as const satisfies SemanticRelation;

const UNTRUSTED_CLOSURE_INCONSISTENT_SOURCE = {
  schema: "dathra.execution/1",
  id: "",
  version: "not-a-version",
  facts: [PRESENT_EFFECT_FACT, PRESENT_EFFECT_FACT],
  relations: [DANGLING_READ_RELATION],
  exports: {
    run: {
      factIds: [DANGLING_EXPORT_FACT_ID, DANGLING_EXPORT_FACT_ID],
      callable: "none",
      receiverBrandId: null,
      valueDomainId: registryId("value-domain", "domain:missing"),
      transfer: { kind: "none" },
    },
  },
  registries: EMPTY_REGISTRIES,
  hostAssumptionFactIds: [DANGLING_HOST_FACT_ID, DANGLING_HOST_FACT_ID],
} as const satisfies ExecutionContractSourceInput;

const EMPTY_SOURCE = {
  schema: "dathra.execution/1",
  id: "empty-source",
  version: "0",
  facts: [],
  relations: [],
  exports: {},
  registries: EMPTY_REGISTRIES,
  hostAssumptionFactIds: [],
} as const satisfies ExecutionContractSourceInput;

const FUTURE_RUNTIME_API_NAMES = [
  "defineExecutionContract",
  "parseExecutionContractSource",
  "validateExecutionContractSource",
  "freezeExecutionContractSource",
  "digestExecutionContractSource",
] as const;

function readTypeScriptModule(relativePath: string) {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sourceFile = createSourceFile(
    relativePath,
    source,
    ScriptTarget.ES2024,
    true,
    ScriptKind.TS,
  );

  return { source, sourceFile };
}

function hasExportModifier(statement: Statement): boolean {
  return (
    canHaveModifiers(statement) &&
    (getModifiers(statement)?.some(
      (modifier) => modifier.kind === SyntaxKind.ExportKeyword,
    ) ??
      false)
  );
}

function readNamedExportSurface(relativePath: string) {
  const { sourceFile } = readTypeScriptModule(relativePath);

  return sourceFile.statements.flatMap((statement) => {
    if (!isExportDeclaration(statement)) return [];
    if (
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      throw new TypeError(`Expected named exports in ${relativePath}`);
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (moduleSpecifier !== undefined && !isStringLiteral(moduleSpecifier)) {
      throw new TypeError(
        `Expected a string module specifier in ${relativePath}`,
      );
    }

    return [
      {
        moduleSpecifier: moduleSpecifier?.text ?? null,
        typeOnly: statement.isTypeOnly,
        names: statement.exportClause.elements.map(
          (element) => element.name.text,
        ),
      },
    ];
  });
}

function emitTypeScriptModule(relativePath: string): string {
  const { source } = readTypeScriptModule(relativePath);

  return transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2024,
      verbatimModuleSyntax: true,
    },
    fileName: relativePath,
  }).outputText;
}

describe("source execution contract envelope", () => {
  it("fixes all eight required readonly fields and exact property types", () => {
    expectTypeOf<
      keyof ExecutionContractSourceInput
    >().toEqualTypeOf<ExpectedExecutionContractSourceKey>();
    expectTypeOf<ExpectedExecutionContractSourceKey>().toEqualTypeOf<
      keyof ExecutionContractSourceInput
    >();
    expectTypeOf<
      ExecutionContractSourceInput["schema"]
    >().toEqualTypeOf<"dathra.execution/1">();
    expectTypeOf<ExecutionContractSourceInput["id"]>().toEqualTypeOf<string>();
    expectTypeOf<
      ExecutionContractSourceInput["version"]
    >().toEqualTypeOf<string>();
    expectTypeOf<ExecutionContractSourceInput["facts"]>().toEqualTypeOf<
      readonly SemanticFact[]
    >();
    expectTypeOf<ExecutionContractSourceInput["relations"]>().toEqualTypeOf<
      readonly SemanticRelation[]
    >();
    expectTypeOf<ExecutionContractSourceInput["exports"]>().toEqualTypeOf<
      Readonly<Record<string, ExportExecutionContract>>
    >();
    expectTypeOf<
      ExecutionContractSourceInput["registries"]
    >().toEqualTypeOf<ExecutionContractRegistrySources>();
    expectTypeOf<
      ExecutionContractSourceInput["hostAssumptionFactIds"]
    >().toEqualTypeOf<readonly FactId[]>();
    expectTypeOf<ExecutionContractSourceInput>().toEqualTypeOf<ExpectedExecutionContractSourceInput>();
    expectTypeOf<ExpectedExecutionContractSourceInput>().toEqualTypeOf<ExecutionContractSourceInput>();
    expectTypeOf<ExecutionContractSource>().toEqualTypeOf<ExecutionContractSourceInput>();
    expectTypeOf<ExecutionContractSourceInput>().toEqualTypeOf<ExecutionContractSource>();
    expectTypeOf<RootRegistrySourceEntry<"codec">>().toEqualTypeOf<
      RegistrySourceEntry<"codec">
    >();

    expect(Object.keys(UNTRUSTED_CLOSURE_INCONSISTENT_SOURCE)).toEqual(
      SOURCE_KEYS,
    );
  });

  it("accepts a non-empty deliberately closure-inconsistent source claim", () => {
    const source = UNTRUSTED_CLOSURE_INCONSISTENT_SOURCE;
    const factIds = new Set(source.facts.map((fact) => fact.id));

    expectTypeOf(source).toMatchTypeOf<ExecutionContractSource>();
    expect(source.id).toBe("");
    expect(source.version).toBe("not-a-version");
    expect(source.facts).toHaveLength(2);
    expect(source.facts[0].id).toBe(source.facts[1].id);
    expect(source.relations).toHaveLength(1);
    expect(factIds.has(source.relations[0].to.factId)).toBe(false);
    expect(factIds.has(source.exports.run.factIds[0])).toBe(false);
    expect(source.exports.run.factIds[0]).toBe(source.exports.run.factIds[1]);
    expect(source.registries.valueDomains).toEqual([]);
    expect(source.hostAssumptionFactIds).toHaveLength(2);
    expect(factIds.has(source.hostAssumptionFactIds[0])).toBe(false);
    expect(source.hostAssumptionFactIds[0]).toBe(
      source.hostAssumptionFactIds[1],
    );
  });

  it("accepts empty structural collections without validating them", () => {
    expectTypeOf(EMPTY_SOURCE).toMatchTypeOf<ExecutionContractSource>();
    expect(EMPTY_SOURCE.facts).toEqual([]);
    expect(EMPTY_SOURCE.relations).toEqual([]);
    expect(EMPTY_SOURCE.exports).toEqual({});
    expect(
      Object.values(EMPTY_SOURCE.registries).every(
        (value) => value.length === 0,
      ),
    ).toBe(true);
    expect(EMPTY_SOURCE.hostAssumptionFactIds).toEqual([]);
  });
});

describe("source envelope publication boundary", () => {
  it("exports exactly two types from the model", () => {
    const { sourceFile } = readTypeScriptModule("./sourceModel.ts");
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(exportStatements).toHaveLength(1);
    expect(readNamedExportSurface("./sourceModel.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: ["ExecutionContractSourceInput", "ExecutionContractSource"],
      },
    ]);
  });

  it("adds no runtime value, runtime import edge, or future operation", () => {
    expect(Object.keys(sourceModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./sourceModel.ts").trim()).toBe("export {};");
    expect(emitTypeScriptModule("./sourceModel.type-fixture.ts").trim()).toBe(
      "export {};",
    );
    expect(
      FUTURE_RUNTIME_API_NAMES.filter((name) => name in executionContractApi),
    ).toEqual([]);
  });

  it("keeps both source types absent from shared-root source and declarations", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    expect(rootSource).toContain("./executionRegistry/implementation");
    expect(rootSource).not.toContain("./executionContract/implementation");

    for (const declarationFile of ["index.d.mts", "index.d.cts"]) {
      const declaration = readFileSync(
        sharedRootArtifactPath(declarationFile),
        "utf8",
      );

      expect(declaration).toContain("interface RegistrySourceEntry<");
      expect(declaration).not.toContain("ExecutionContractSourceInput");
      expect(declaration).not.toContain("ExecutionContractSource");
    }
  });
});
