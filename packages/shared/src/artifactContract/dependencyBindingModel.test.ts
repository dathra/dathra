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

import * as dependencyBindingModelApi from "./dependencyBindingModel";
import { type ArtifactDependencyBinding } from "./dependencyBindingModel";
import { type ArtifactAddressId } from "./model";

type ExpectedArtifactDependencyKind =
  | "static-import"
  | "dynamic-import"
  | "wasm-import"
  | "data-reference";

type ExpectedArtifactDependencyBinding = {
  readonly slot: string;
  readonly kind: ExpectedArtifactDependencyKind;
  readonly targetArtifactAddressId: ArtifactAddressId;
  readonly targetExportName: string | null;
};

type ExpectedArtifactDependencyBindingKey =
  | "slot"
  | "kind"
  | "targetArtifactAddressId"
  | "targetExportName";

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

describe("artifact dependency binding model", () => {
  it("fixes the exact four binding keys and property types", () => {
    expectTypeOf<
      keyof ArtifactDependencyBinding
    >().toEqualTypeOf<ExpectedArtifactDependencyBindingKey>();
    expectTypeOf<ExpectedArtifactDependencyBindingKey>().toEqualTypeOf<
      keyof ArtifactDependencyBinding
    >();
    expectTypeOf<ArtifactDependencyBinding["slot"]>().toEqualTypeOf<string>();
    expectTypeOf<
      ArtifactDependencyBinding["kind"]
    >().toEqualTypeOf<ExpectedArtifactDependencyKind>();
    expectTypeOf<
      ArtifactDependencyBinding["targetArtifactAddressId"]
    >().toEqualTypeOf<ArtifactAddressId>();
    expectTypeOf<ArtifactDependencyBinding["targetExportName"]>().toEqualTypeOf<
      string | null
    >();
    expectTypeOf<ArtifactDependencyBinding>().toEqualTypeOf<ExpectedArtifactDependencyBinding>();
    expectTypeOf<ExpectedArtifactDependencyBinding>().toEqualTypeOf<ArtifactDependencyBinding>();
  });

  it("exports exactly the dependency binding type from the model", () => {
    const { sourceFile } = readTypeScriptModule("./dependencyBindingModel.ts");
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
    ).toEqual(["ArtifactDependencyBinding"]);
  });

  it("declares the binding as one interface with an inline kind union", () => {
    const { sourceFile } = readTypeScriptModule("./dependencyBindingModel.ts");
    const interfaces = sourceFile.statements.filter(isInterfaceDeclaration);
    const typeAliases = sourceFile.statements.filter(isTypeAliasDeclaration);
    const declaration = interfaces[0];

    expect(interfaces.map((candidate) => candidate.name.text)).toEqual([
      "ArtifactDependencyBinding",
    ]);
    expect(typeAliases.map((alias) => alias.name.text)).toEqual([]);
    if (declaration === undefined) {
      throw new TypeError("Expected the dependency binding interface");
    }

    const members = declaration.members.map((member) => {
      if (!isPropertySignature(member) || !isIdentifier(member.name)) {
        throw new TypeError("Expected identifier property signatures");
      }
      return { name: member.name.text, type: member.type };
    });

    expect(members.map(({ name }) => name)).toEqual([
      "slot",
      "kind",
      "targetArtifactAddressId",
      "targetExportName",
    ]);

    const kind = members.find(({ name }) => name === "kind")?.type;
    if (kind === undefined || !isUnionTypeNode(kind)) {
      throw new TypeError("Expected an inline kind union");
    }

    expect(
      kind.types.map((type) => {
        if (!isLiteralTypeNode(type) || !isStringLiteral(type.literal)) {
          throw new TypeError("Expected string literal kind members");
        }
        return type.literal.text;
      }),
    ).toEqual([
      "static-import",
      "dynamic-import",
      "wasm-import",
      "data-reference",
    ]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(dependencyBindingModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./dependencyBindingModel.ts").trim()).toBe(
      "export {};",
    );
    expect(
      emitTypeScriptModule("./dependencyBindingModel.type-fixture.ts").trim(),
    ).toBe("export {};");
  });
});
