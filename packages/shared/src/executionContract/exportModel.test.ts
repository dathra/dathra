import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

import type { RegistryId } from "../executionRegistry/implementation";
import {
  // @ts-expect-error AS01 owns shared-root publication.
  type ExportExecutionContract as _RootExportExecutionContractMustNotExist,
} from "../index";
import * as executionContractApi from "./implementation";
import {
  // @ts-expect-error Trust acceptance is owned by a later verifier.
  type AcceptedExecutionAnalysis as _AcceptedAnalysisMustNotExist,
  // @ts-expect-error Compiled contracts are owned by SC02B.
  type CompiledExecutionContract as _CompiledContractMustNotExist,
  // @ts-expect-error Helper aliases are not package-local facade API.
  type ExportCallable as _ExportCallableMustNotExist,
  type ExportExecutionContract,
  // @ts-expect-error Registry aggregation belongs to SC02A6.
  type ExecutionContractRegistrySources as _RegistrySourcesMustNotExist,
  // @ts-expect-error The source envelope belongs to SC02A7.
  type ExecutionContractSource as _SourceMustNotExist,
  type FactId,
  // @ts-expect-error Qualified identity is owned by SC02B and SC03.
  type QualifiedFactId as _QualifiedFactIdMustNotExist,
  type TransferBinding,
} from "./implementation";
import * as exportModelApi from "./exportModel";

type ExecutionContractApi = typeof executionContractApi;

type _DefineExecutionContractMustNotExist =
  // @ts-expect-error Source construction belongs to SC02A12.
  ExecutionContractApi["defineExecutionContract"];

type _DigestExecutionContractSourceMustNotExist =
  // @ts-expect-error Canonical digest belongs to SC02A13.
  ExecutionContractApi["digestExecutionContractSource"];

type _ParseExecutionContractSourceMustNotExist =
  // @ts-expect-error Source-level parsing belongs to SC02A12.
  ExecutionContractApi["parseExecutionContractSource"];

type _ValidateExecutionContractSourceMustNotExist =
  // @ts-expect-error Source validation remains internal to SC02A12.
  ExecutionContractApi["validateExecutionContractSource"];

type ExpectedExportCallable =
  | "none"
  | "call"
  | "construct"
  | "call-and-construct";

type ExpectedExportExecutionContract = {
  readonly factIds: readonly FactId[];
  readonly callable: ExpectedExportCallable;
  readonly receiverBrandId: RegistryId<"brand"> | null;
  readonly valueDomainId: RegistryId<"value-domain">;
  readonly transfer: TransferBinding;
};

type ExpectedExportExecutionContractKey =
  | "factIds"
  | "callable"
  | "receiverBrandId"
  | "valueDomainId"
  | "transfer";

const CALLABLE_FORMS = [
  "none",
  "call",
  "construct",
  "call-and-construct",
] as const satisfies readonly ExpectedExportCallable[];

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

describe("source-local export execution summary", () => {
  it("fixes the exact callable union in both directions", () => {
    expectTypeOf<
      ExportExecutionContract["callable"]
    >().toEqualTypeOf<ExpectedExportCallable>();
    expectTypeOf<ExpectedExportCallable>().toEqualTypeOf<
      ExportExecutionContract["callable"]
    >();
    expectTypeOf<
      (typeof CALLABLE_FORMS)[number]
    >().toEqualTypeOf<ExpectedExportCallable>();

    expect(CALLABLE_FORMS).toEqual([
      "none",
      "call",
      "construct",
      "call-and-construct",
    ]);
  });

  it("fixes all five required readonly fields and property types", () => {
    expectTypeOf<
      keyof ExportExecutionContract
    >().toEqualTypeOf<ExpectedExportExecutionContractKey>();
    expectTypeOf<ExpectedExportExecutionContractKey>().toEqualTypeOf<
      keyof ExportExecutionContract
    >();
    expectTypeOf<ExportExecutionContract["factIds"]>().toEqualTypeOf<
      readonly FactId[]
    >();
    expectTypeOf<
      ExportExecutionContract["receiverBrandId"]
    >().toEqualTypeOf<RegistryId<"brand"> | null>();
    expectTypeOf<ExportExecutionContract["valueDomainId"]>().toEqualTypeOf<
      RegistryId<"value-domain">
    >();
    expectTypeOf<
      ExportExecutionContract["transfer"]
    >().toEqualTypeOf<TransferBinding>();
    expectTypeOf<ExportExecutionContract>().toEqualTypeOf<ExpectedExportExecutionContract>();
    expectTypeOf<ExpectedExportExecutionContract>().toEqualTypeOf<ExportExecutionContract>();
  });

  it("keeps brand and value-domain registry identifiers separated", () => {
    expectTypeOf<
      ExportExecutionContract["receiverBrandId"]
    >().not.toEqualTypeOf<RegistryId<"value-domain"> | null>();
    expectTypeOf<ExportExecutionContract["valueDomainId"]>().not.toEqualTypeOf<
      RegistryId<"brand">
    >();
  });
});

describe("export summary publication boundary", () => {
  it("exports exactly one type from the model and facade", () => {
    const { sourceFile } = readTypeScriptModule("./exportModel.ts");
    const { sourceFile: facadeSourceFile } = readTypeScriptModule(
      "./implementation.ts",
    );
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(exportStatements).toHaveLength(1);
    expect(facadeSourceFile.statements).toHaveLength(6);
    expect(facadeSourceFile.statements.every(isExportDeclaration)).toBe(true);
    expect(readNamedExportSurface("./exportModel.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: ["ExportExecutionContract"],
      },
    ]);
    expect(readNamedExportSurface("./implementation.ts")).toEqual([
      {
        moduleSpecifier: "./identity",
        typeOnly: false,
        names: ["ExecutionContractError", "factId"],
      },
      {
        moduleSpecifier: "./identity",
        typeOnly: true,
        names: ["ExecutionContractErrorCode", "FactId"],
      },
      {
        moduleSpecifier: "./model",
        typeOnly: true,
        names: ["SemanticPathSegment", "SemanticSubject"],
      },
      {
        moduleSpecifier: "./factModel",
        typeOnly: true,
        names: ["SemanticFactKind", "TransferBinding", "SemanticFact"],
      },
      {
        moduleSpecifier: "./relationModel",
        typeOnly: true,
        names: ["SemanticRelationKind", "FactEndpoint", "SemanticRelation"],
      },
      {
        moduleSpecifier: "./exportModel",
        typeOnly: true,
        names: ["ExportExecutionContract"],
      },
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(exportModelApi)).toEqual([]);
    expect(Object.keys(executionContractApi).sort()).toEqual([
      "ExecutionContractError",
      "factId",
    ]);
    expect(emitTypeScriptModule("./exportModel.ts").trim()).toBe("export {};");
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      'export { ExecutionContractError, factId } from "./identity";',
    );
    expect(
      emitTypeScriptModule("./exportModel.typeOnlyConsumer.fixture.ts").trim(),
    ).toBe("export {};");
  });

  it("keeps the type absent from shared-root source and declarations", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-execution-export-contract-"),
    );

    expect(rootSource).not.toContain("./executionContract/implementation");

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsdown", "--out-dir", outputDirectory, "--logLevel", "error"],
        {
          cwd: packageRoot,
          stdio: "pipe",
        },
      );

      for (const declarationFile of ["index.d.mts", "index.d.cts"]) {
        const declaration = readFileSync(
          join(outputDirectory, declarationFile),
          "utf8",
        );

        expect(declaration).toContain("Sha256Digest");
        expect(declaration).not.toContain("ExportExecutionContract");
      }
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("does not add later source operations", () => {
    expect("defineExecutionContract" in executionContractApi).toBe(false);
    expect("digestExecutionContractSource" in executionContractApi).toBe(false);
    expect("parseExecutionContractSource" in executionContractApi).toBe(false);
    expect("validateExecutionContractSource" in executionContractApi).toBe(
      false,
    );
  });
});
