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
import { describe, expect, it } from "vitest";

import * as artifactContractApi from "./implementation";

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

describe("artifact address nominal domain", () => {
  it("exposes no runtime values from the package-local facade", () => {
    expect(Object.keys(artifactContractApi)).toEqual([]);
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
        exportedName: "ArtifactAddressId",
        localName: "ArtifactAddressId",
      },
    ]);
  });

  it("emits the facade and model only as module markers", () => {
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./model.ts").trim()).toBe("export {};");
  });

  it("emits the type-only consumer without a runtime import edge", () => {
    const output = emitTypeScriptModule("./typeOnlyConsumer.fixture.ts");

    expect(output.trim()).toBe("export {};");
    expect(output).not.toContain("./implementation");
    expect(output).not.toMatch(/\bimport\b/u);
  });
});
