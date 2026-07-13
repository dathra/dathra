import { readFileSync } from "node:fs";

import {
  createSourceFile,
  isExportDeclaration,
  isNamedExports,
  isStringLiteral,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  transpileModule,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import * as materializationContractApi from "./implementation";
import { type MaterializationMechanismKind } from "./implementation";
import {
  // @ts-expect-error Root publication belongs to the later integration slice.
  type MaterializationMechanismKind as _RootMechanismKindMustNotExist,
} from "../index";

type ExpectedMaterializationMechanismKind =
  | "inline"
  | "snapshot"
  | "target-native"
  | "codec"
  | "reference"
  | "subscription"
  | "remote";

const MATERIALIZATION_MECHANISM_KINDS = {
  inline: true,
  snapshot: true,
  "target-native": true,
  codec: true,
  reference: true,
  subscription: true,
  remote: true,
} as const satisfies Record<MaterializationMechanismKind, true>;

function emitTypeScriptModule(relativePath: string): string {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");

  return transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2024,
      verbatimModuleSyntax: true,
    },
    fileName: relativePath,
  }).outputText;
}

describe("materialization mechanism taxonomy", () => {
  it("fixes the seven mechanism literals as one exact closed union", () => {
    expectTypeOf<MaterializationMechanismKind>().toEqualTypeOf<ExpectedMaterializationMechanismKind>();
    expectTypeOf<ExpectedMaterializationMechanismKind>().toEqualTypeOf<MaterializationMechanismKind>();

    expect(Object.keys(MATERIALIZATION_MECHANISM_KINDS)).toEqual([
      "inline",
      "snapshot",
      "target-native",
      "codec",
      "reference",
      "subscription",
      "remote",
    ]);
  });

  it("has no runtime values at the package-local facade", () => {
    expect(Object.keys(materializationContractApi)).toEqual([]);
  });

  it("exports exactly one package-local type from the facade", () => {
    const relativePath = "./implementation.ts";
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const sourceFile = createSourceFile(
      relativePath,
      source,
      ScriptTarget.ES2024,
      true,
      ScriptKind.TS,
    );

    expect(sourceFile.statements).toHaveLength(1);
    const statement = sourceFile.statements.at(0);
    if (statement === undefined || !isExportDeclaration(statement)) {
      throw new TypeError("Expected one export declaration");
    }
    if (
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      throw new TypeError("Expected one named export clause");
    }
    if (
      statement.moduleSpecifier === undefined ||
      !isStringLiteral(statement.moduleSpecifier)
    ) {
      throw new TypeError("Expected one string module specifier");
    }

    expect(statement.isTypeOnly).toBe(true);
    expect(statement.moduleSpecifier.text).toBe("./model");
    expect(
      statement.exportClause.elements.map((element) => ({
        exportedName: element.name.text,
        localName: element.propertyName?.text ?? element.name.text,
      })),
    ).toEqual([
      {
        exportedName: "MaterializationMechanismKind",
        localName: "MaterializationMechanismKind",
      },
    ]);
  });

  it("emits the facade and model without runtime work", () => {
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./model.ts").trim()).toBe("export {};");
  });

  it("emits an explicit type-only consumer without a runtime import edge", () => {
    const output = emitTypeScriptModule("./typeOnlyConsumer.fixture.ts");

    expect(output.trim()).toBe("export {};");
    expect(output).not.toContain("./implementation");
    expect(output).not.toMatch(/\bimport\b/u);
  });
});

// @ts-expect-error Execution placement is not a materialization mechanism.
const serverOnlyKind: MaterializationMechanismKind = "server-only";
void serverOnlyKind;

// @ts-expect-error A request-specific carrier is not a mechanism.
const graphTableKind: MaterializationMechanismKind = "graph-table";
void graphTableKind;

// @ts-expect-error This unit does not define the no-transfer outcome.
const noTransferKind: MaterializationMechanismKind = "no-transfer";
void noTransferKind;

// @ts-expect-error Unknown mechanism labels are rejected by the closed union.
const unknownKind: MaterializationMechanismKind = "unknown";
void unknownKind;
