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
import {
  // @ts-expect-error Helper aliases are not package-local facade API.
  type ExportCallable as _ExportCallableMustNotExist,
  type ExportExecutionContract,
  type FactId,
  type TransferBinding,
} from "./implementation";
import * as exportModelApi from "./exportModel";

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
  it("exports exactly one type from the model", () => {
    const { sourceFile } = readTypeScriptModule("./exportModel.ts");
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(exportStatements).toHaveLength(1);
    expect(readNamedExportSurface("./exportModel.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: ["ExportExecutionContract"],
      },
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(exportModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./exportModel.ts").trim()).toBe("export {};");
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
});
