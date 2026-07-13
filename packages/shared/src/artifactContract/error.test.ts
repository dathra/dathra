import { readFileSync } from "node:fs";

import {
  createSourceFile,
  isExportDeclaration,
  isNamedExports,
  isStringLiteral,
  isTypeAliasDeclaration,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  transpileModule,
} from "typescript";
import { describe, expect, it } from "vitest";

import {
  ArtifactContractError,
  fail,
  type ArtifactContractErrorCode,
} from "./error";

const ERROR_CODES = [
  "invalid-closed-record",
  "invalid-field",
  "invalid-url",
  "noncanonical-order",
  "duplicate-record",
  "dangling-reference",
  "kind-mismatch",
  "semantic-mismatch",
  "budget-exceeded",
  "crypto-unavailable",
] as const satisfies readonly ArtifactContractErrorCode[];

type NamedExportSurface = {
  readonly isTypeOnly: boolean;
  readonly moduleSpecifier: string | null;
  readonly names: readonly string[];
};

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

function readNamedExportSurface(relativePath: string): NamedExportSurface[] {
  const { sourceFile } = readTypeScriptModule(relativePath);

  return sourceFile.statements.flatMap((statement) => {
    if (
      !isExportDeclaration(statement) ||
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      return [];
    }

    return [
      {
        isTypeOnly: statement.isTypeOnly,
        moduleSpecifier:
          statement.moduleSpecifier !== undefined &&
          isStringLiteral(statement.moduleSpecifier)
            ? statement.moduleSpecifier.text
            : null,
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

function expectArtifactContractError(
  operation: () => unknown,
): ArtifactContractError {
  try {
    operation();
  } catch (error) {
    if (error instanceof ArtifactContractError) return error;
    throw error;
  }
  throw new Error("Expected an ArtifactContractError");
}

describe("ArtifactContractError", () => {
  it("keeps the exact stable failure vocabulary", () => {
    expect(ERROR_CODES).toEqual([
      "invalid-closed-record",
      "invalid-field",
      "invalid-url",
      "noncanonical-order",
      "duplicate-record",
      "dangling-reference",
      "kind-mismatch",
      "semantic-mismatch",
      "budget-exceeded",
      "crypto-unavailable",
    ]);
  });

  it("owns a frozen path snapshot and immutable observations", () => {
    let sourceCode: ArtifactContractErrorCode = "kind-mismatch";
    const sourcePath: (string | number)[] = ["dependencyBindings", 2, "kind"];
    const error = new ArtifactContractError(
      sourceCode,
      sourcePath,
      "Invalid dependency kind",
    );

    expect(error).toBeInstanceOf(TypeError);
    expect(error).toBeInstanceOf(ArtifactContractError);
    expect(error.name).toBe("ArtifactContractError");
    expect(error.code).toBe("kind-mismatch");
    expect(error.path).toEqual(["dependencyBindings", 2, "kind"]);
    expect(error.path).not.toBe(sourcePath);

    sourceCode = "invalid-field";
    sourcePath[0] = "changed";
    sourcePath.push("later");
    expect(sourceCode).toBe("invalid-field");
    expect(Reflect.set(error.path, 0, "changed")).toBe(false);
    expect(Reflect.set(error, "code", "invalid-field")).toBe(false);
    expect(Reflect.set(error, "path", [])).toBe(false);

    expect(error.code).toBe("kind-mismatch");
    expect(error.path).toEqual(["dependencyBindings", 2, "kind"]);
    expect(Object.isFrozen(error.path)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
  });

  it("forwards every exact code and path through immutable failures", () => {
    for (const code of ERROR_CODES) {
      const sourcePath: (string | number)[] = [
        "dependencyBindings",
        3,
        "targetArtifactAddressId",
      ];
      const detail = `Failure detail for ${code}`;
      const error = expectArtifactContractError(() =>
        fail(code, sourcePath, detail),
      );

      expect(error.code).toBe(code);
      expect(error.path).toEqual([
        "dependencyBindings",
        3,
        "targetArtifactAddressId",
      ]);
      expect(error.path).not.toBe(sourcePath);
      expect(Object.isFrozen(error.path)).toBe(true);
      expect(Object.isFrozen(error)).toBe(true);
      expect(error.message).toContain(detail);
      expect(error.message).toContain("dependencyBindings");
      expect(error.message).toContain("3");
      expect(error.message).toContain("targetArtifactAddressId");

      sourcePath[0] = "changed";
      expect(error.path[0]).toBe("dependencyBindings");
      expect(Reflect.set(error, "code", "invalid-field")).toBe(false);
      expect(error.code).toBe(code);
    }
  });
});

describe("artifact contract error module boundary", () => {
  it("exports only the error, internal fail helper, and error code", () => {
    expect(readNamedExportSurface("./error.ts")).toEqual([
      {
        isTypeOnly: false,
        moduleSpecifier: null,
        names: ["ArtifactContractError", "fail"],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: null,
        names: ["ArtifactContractErrorCode"],
      },
    ]);

    const { sourceFile } = readTypeScriptModule("./error.ts");
    expect(
      sourceFile.statements
        .filter(isTypeAliasDeclaration)
        .map((statement) => statement.name.text),
    ).toEqual(["ArtifactContractErrorCode"]);
  });

  it("emits the internal error module and only the class facade edge", () => {
    const errorOutput = emitTypeScriptModule("./error.ts");

    expect(errorOutput).toContain(
      "class ArtifactContractError extends TypeError",
    );
    expect(errorOutput).toContain("function fail(");
    expect(errorOutput).toContain("export { ArtifactContractError, fail };");
    expect(errorOutput).not.toContain("ArtifactContractErrorCode");
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      'export { ArtifactContractError } from "./error";',
    );
  });

  it("keeps internal helpers and later operations out of the facade", () => {
    const exportedNames = readNamedExportSurface("./implementation.ts").flatMap(
      ({ names }) => names,
    );

    for (const forbiddenName of [
      "fail",
      "ArtifactContractPath",
      "ArtifactContractPathSegment",
      "formatPath",
      "ArtifactContractBudget",
      "ArtifactContractLedger",
      "ArtifactContractSnapshot",
      "parseArtifactContract",
      "validateArtifactContract",
      "ArtifactContractFailurePrecedence",
      "ArtifactCanonicalMeter",
      "digestArtifactContract",
      "artifactUrl",
      "ArtifactClosure",
    ]) {
      expect(exportedNames).not.toContain(forbiddenName);
    }
  });

  it("keeps the error foundation out of the shared root source", () => {
    const { sourceFile } = readTypeScriptModule("../index.ts");
    const moduleSpecifiers = sourceFile.statements.flatMap((statement) => {
      if (
        !isExportDeclaration(statement) ||
        statement.moduleSpecifier === undefined ||
        !isStringLiteral(statement.moduleSpecifier)
      ) {
        return [];
      }
      return [statement.moduleSpecifier.text];
    });

    expect(moduleSpecifiers).not.toContain("./artifactContract/implementation");
    const rootExportedNames = readNamedExportSurface("../index.ts").flatMap(
      ({ names }) => names,
    );
    for (const forbiddenName of [
      "ArtifactContractError",
      "ArtifactContractErrorCode",
      "ArtifactContractPath",
      "ArtifactContractPathSegment",
      "fail",
      "formatPath",
    ]) {
      expect(rootExportedNames).not.toContain(forbiddenName);
    }
  });
});
