import { readFileSync } from "node:fs";

import {
  canHaveModifiers,
  createSourceFile,
  getModifiers,
  isExportAssignment,
  isExportDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isLiteralTypeNode,
  isNamedExports,
  isPropertySignature,
  isStringLiteral,
  isTypeAliasDeclaration,
  isUnionTypeNode,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
  type Statement,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import * as exportBindingModelApi from "./exportBindingModel";
import { type ArtifactExportBinding } from "./exportBindingModel";

type ExpectedArtifactExportRole =
  | "definition"
  | "integration-provider"
  | "runtime-bootstrap"
  | "registry-implementation"
  | "data-handle"
  | "wasm-binding";

type ExpectedArtifactExportBinding = {
  readonly exportName: string;
  readonly memberSemanticId: string;
  readonly exportRole: ExpectedArtifactExportRole;
};

type ExpectedArtifactExportBindingKey =
  | "exportName"
  | "memberSemanticId"
  | "exportRole";

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

describe("artifact export binding model", () => {
  it("fixes the exact three binding keys and property types", () => {
    expectTypeOf<
      keyof ArtifactExportBinding
    >().toEqualTypeOf<ExpectedArtifactExportBindingKey>();
    expectTypeOf<ExpectedArtifactExportBindingKey>().toEqualTypeOf<
      keyof ArtifactExportBinding
    >();
    expectTypeOf<ArtifactExportBinding["exportName"]>().toEqualTypeOf<string>();
    expectTypeOf<
      ArtifactExportBinding["memberSemanticId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ArtifactExportBinding["exportRole"]
    >().toEqualTypeOf<ExpectedArtifactExportRole>();
    expectTypeOf<ArtifactExportBinding>().toEqualTypeOf<ExpectedArtifactExportBinding>();
    expectTypeOf<ExpectedArtifactExportBinding>().toEqualTypeOf<ArtifactExportBinding>();
  });

  it("fixes the exact six-literal export role union in both directions", () => {
    expectTypeOf<
      ArtifactExportBinding["exportRole"]
    >().toEqualTypeOf<ExpectedArtifactExportRole>();
    expectTypeOf<ExpectedArtifactExportRole>().toEqualTypeOf<
      ArtifactExportBinding["exportRole"]
    >();
  });

  it("exports exactly the export binding type from the model", () => {
    const { sourceFile } = readTypeScriptModule("./exportBindingModel.ts");
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );
    const statement = exportStatements[0];

    expect(exportStatements).toHaveLength(1);
    if (
      statement === undefined ||
      !isExportDeclaration(statement) ||
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      throw new TypeError("Expected one named type-only export declaration");
    }

    expect(statement.isTypeOnly).toBe(true);
    expect(statement.moduleSpecifier).toBeUndefined();
    expect(
      statement.exportClause.elements.map((element) => element.name.text),
    ).toEqual(["ArtifactExportBinding"]);
  });

  it("declares one interface with three ordered readonly required properties and an inline role union", () => {
    const { sourceFile } = readTypeScriptModule("./exportBindingModel.ts");
    const interfaces = sourceFile.statements.filter(isInterfaceDeclaration);
    const typeAliases = sourceFile.statements.filter(isTypeAliasDeclaration);
    const declaration = interfaces[0];

    expect(interfaces.map((candidate) => candidate.name.text)).toEqual([
      "ArtifactExportBinding",
    ]);
    expect(typeAliases.map((alias) => alias.name.text)).toEqual([]);
    if (declaration === undefined) {
      throw new TypeError("Expected the export binding interface");
    }

    const members = declaration.members.map((member) => {
      if (!isPropertySignature(member) || !isIdentifier(member.name)) {
        throw new TypeError("Expected identifier property signatures");
      }

      return {
        isOptional: member.questionToken !== undefined,
        isReadonly:
          getModifiers(member)?.some(
            (modifier) => modifier.kind === SyntaxKind.ReadonlyKeyword,
          ) ?? false,
        name: member.name.text,
        type: member.type,
      };
    });

    expect(
      members.map(({ isOptional, isReadonly, name }) => ({
        isOptional,
        isReadonly,
        name,
      })),
    ).toEqual([
      { isOptional: false, isReadonly: true, name: "exportName" },
      { isOptional: false, isReadonly: true, name: "memberSemanticId" },
      { isOptional: false, isReadonly: true, name: "exportRole" },
    ]);
    expect(members[0]?.type?.kind).toBe(SyntaxKind.StringKeyword);
    expect(members[1]?.type?.kind).toBe(SyntaxKind.StringKeyword);

    const exportRole = members[2]?.type;
    if (exportRole === undefined || !isUnionTypeNode(exportRole)) {
      throw new TypeError("Expected an inline export role union");
    }

    expect(
      exportRole.types.map((type) => {
        if (!isLiteralTypeNode(type) || !isStringLiteral(type.literal)) {
          throw new TypeError("Expected string literal export role members");
        }
        return type.literal.text;
      }),
    ).toEqual([
      "definition",
      "integration-provider",
      "runtime-bootstrap",
      "registry-implementation",
      "data-handle",
      "wasm-binding",
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(exportBindingModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./exportBindingModel.ts").trim()).toBe(
      "export {};",
    );
    expect(
      emitTypeScriptModule("./exportBindingModel.type-fixture.ts").trim(),
    ).toBe("export {};");
  });
});
