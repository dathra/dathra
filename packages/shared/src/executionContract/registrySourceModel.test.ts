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
import type { RegistrySourceEntry } from "../executionRegistry/implementation";
import {
  // @ts-expect-error AS01 owns shared-root publication.
  type ExecutionContractRegistrySources as _RootExecutionContractRegistrySourcesMustNotExist,
  type RegistrySourceEntry as RootRegistrySourceEntry,
} from "../index";
import type { ExecutionContractRegistrySources } from "./implementation";
import * as registrySourceModelApi from "./registrySourceModel";

type ExpectedExecutionContractRegistrySources = {
  readonly codecs: readonly RegistrySourceEntry<"codec">[];
  readonly resolvers: readonly RegistrySourceEntry<"resolver">[];
  readonly remoteOperations: readonly RegistrySourceEntry<"remote-operation">[];
  readonly remoteDeliveryAdapters: readonly RegistrySourceEntry<"remote-delivery-adapter">[];
  readonly subscriptionSources: readonly RegistrySourceEntry<"subscription-source">[];
  readonly brands: readonly RegistrySourceEntry<"brand">[];
  readonly valueDomains: readonly RegistrySourceEntry<"value-domain">[];
  readonly policies: readonly RegistrySourceEntry<"policy">[];
  readonly hostProfiles: readonly RegistrySourceEntry<"host-profile">[];
  readonly failureSchemas: readonly RegistrySourceEntry<"failure-schema">[];
};

type ExpectedRegistrySourceCollectionKey =
  | "codecs"
  | "resolvers"
  | "remoteOperations"
  | "remoteDeliveryAdapters"
  | "subscriptionSources"
  | "brands"
  | "valueDomains"
  | "policies"
  | "hostProfiles"
  | "failureSchemas";

const REGISTRY_SOURCE_COLLECTION_KEYS = [
  "codecs",
  "resolvers",
  "remoteOperations",
  "remoteDeliveryAdapters",
  "subscriptionSources",
  "brands",
  "valueDomains",
  "policies",
  "hostProfiles",
  "failureSchemas",
] as const satisfies readonly ExpectedRegistrySourceCollectionKey[];

const EMPTY_REGISTRY_SOURCES = {
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

describe("source-local registry source collections", () => {
  it("fixes the exact required collection keys in both directions", () => {
    expectTypeOf<
      keyof ExecutionContractRegistrySources
    >().toEqualTypeOf<ExpectedRegistrySourceCollectionKey>();
    expectTypeOf<ExpectedRegistrySourceCollectionKey>().toEqualTypeOf<
      keyof ExecutionContractRegistrySources
    >();
    expectTypeOf<ExecutionContractRegistrySources>().toEqualTypeOf<ExpectedExecutionContractRegistrySources>();
    expectTypeOf<ExpectedExecutionContractRegistrySources>().toEqualTypeOf<ExecutionContractRegistrySources>();

    expect(Object.keys(EMPTY_REGISTRY_SOURCES)).toEqual(
      REGISTRY_SOURCE_COLLECTION_KEYS,
    );
  });

  it("maps all ten collections to their exact registry entry kinds", () => {
    expectTypeOf<ExecutionContractRegistrySources["codecs"]>().toEqualTypeOf<
      readonly RegistrySourceEntry<"codec">[]
    >();
    expectTypeOf<ExecutionContractRegistrySources["resolvers"]>().toEqualTypeOf<
      readonly RegistrySourceEntry<"resolver">[]
    >();
    expectTypeOf<
      ExecutionContractRegistrySources["remoteOperations"]
    >().toEqualTypeOf<readonly RegistrySourceEntry<"remote-operation">[]>();
    expectTypeOf<
      ExecutionContractRegistrySources["remoteDeliveryAdapters"]
    >().toEqualTypeOf<
      readonly RegistrySourceEntry<"remote-delivery-adapter">[]
    >();
    expectTypeOf<
      ExecutionContractRegistrySources["subscriptionSources"]
    >().toEqualTypeOf<readonly RegistrySourceEntry<"subscription-source">[]>();
    expectTypeOf<ExecutionContractRegistrySources["brands"]>().toEqualTypeOf<
      readonly RegistrySourceEntry<"brand">[]
    >();
    expectTypeOf<
      ExecutionContractRegistrySources["valueDomains"]
    >().toEqualTypeOf<readonly RegistrySourceEntry<"value-domain">[]>();
    expectTypeOf<ExecutionContractRegistrySources["policies"]>().toEqualTypeOf<
      readonly RegistrySourceEntry<"policy">[]
    >();
    expectTypeOf<
      ExecutionContractRegistrySources["hostProfiles"]
    >().toEqualTypeOf<readonly RegistrySourceEntry<"host-profile">[]>();
    expectTypeOf<
      ExecutionContractRegistrySources["failureSchemas"]
    >().toEqualTypeOf<readonly RegistrySourceEntry<"failure-schema">[]>();
    expectTypeOf<RootRegistrySourceEntry<"codec">>().toEqualTypeOf<
      RegistrySourceEntry<"codec">
    >();
  });
});

describe("registry source model publication boundary", () => {
  it("exports exactly one type from the model", () => {
    const { sourceFile } = readTypeScriptModule("./registrySourceModel.ts");
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(exportStatements).toHaveLength(1);
    expect(readNamedExportSurface("./registrySourceModel.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: ["ExecutionContractRegistrySources"],
      },
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(registrySourceModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./registrySourceModel.ts").trim()).toBe(
      "export {};",
    );
    expect(
      emitTypeScriptModule("./registrySourceModel.type-fixture.ts").trim(),
    ).toBe("export {};");
  });

  it("keeps the type absent from shared-root source and declarations", () => {
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
      expect(declaration).not.toContain("ExecutionContractRegistrySources");
    }
  });
});
