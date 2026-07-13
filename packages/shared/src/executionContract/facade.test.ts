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

import * as executionContractApi from "./implementation";

function readFacade() {
  const relativePath = "./implementation.ts";
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  const sourceFile = createSourceFile(
    relativePath,
    source,
    ScriptTarget.ES2024,
    true,
    ScriptKind.TS,
  );

  return { relativePath, source, sourceFile };
}

function readNamedExportSurface() {
  const { relativePath, sourceFile } = readFacade();

  return sourceFile.statements.map((statement) => {
    if (!isExportDeclaration(statement)) {
      throw new TypeError(
        `Expected only export declarations in ${relativePath}`,
      );
    }
    if (
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      throw new TypeError(`Expected named exports in ${relativePath}`);
    }

    const moduleSpecifier = statement.moduleSpecifier;
    if (moduleSpecifier === undefined || !isStringLiteral(moduleSpecifier)) {
      throw new TypeError(
        `Expected a string module specifier in ${relativePath}`,
      );
    }

    return {
      moduleSpecifier: moduleSpecifier.text,
      typeOnly: statement.isTypeOnly,
      names: statement.exportClause.elements.map(
        (element) => element.name.text,
      ),
    };
  });
}

describe("execution contract facade", () => {
  it("fixes the complete cumulative facade inventory as export declarations", () => {
    expect(readNamedExportSurface()).toEqual([
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
      {
        moduleSpecifier: "./registrySourceModel",
        typeOnly: true,
        names: ["ExecutionContractRegistrySources"],
      },
      {
        moduleSpecifier: "./sourceModel",
        typeOnly: true,
        names: ["ExecutionContractSourceInput", "ExecutionContractSource"],
      },
      {
        moduleSpecifier: "./budget",
        typeOnly: true,
        names: ["ExecutionContractBudget"],
      },
    ]);
  });

  it("emits and exposes only the two identity runtime values", () => {
    const { relativePath, source } = readFacade();
    const emittedFacade = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: relativePath,
    }).outputText;

    expect(emittedFacade.trim()).toBe(
      'export { ExecutionContractError, factId } from "./identity";',
    );
    expect(Object.keys(executionContractApi).sort()).toEqual([
      "ExecutionContractError",
      "factId",
    ]);
  });
});
