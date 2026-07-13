import { readFileSync } from "node:fs";

import {
  canHaveModifiers,
  createSourceFile,
  getModifiers,
  isExportAssignment,
  isExportDeclaration,
  isIdentifier,
  isImportDeclaration,
  isInterfaceDeclaration,
  isLiteralTypeNode,
  isNamedExports,
  isNamedImports,
  isPropertySignature,
  isStringLiteral,
  isTypeAliasDeclaration,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
  type Statement,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import { type Sha256Digest } from "../canonicalIdentity/implementation";
import * as deploymentIdentityModelApi from "./deploymentIdentityModel";
import { type DeploymentIdentityPreimage } from "./deploymentIdentityModel";

type ExpectedDeploymentIdentityPreimage = {
  readonly schema: "dathra.deployment-identity/1";
  readonly applicationNamespaceDigest: Sha256Digest;
  readonly releaseIdentity: string;
  readonly targetEnvironmentId: string;
  readonly canonicalPublicOrigin: string;
  readonly contractNamespaceGraphDigest: Sha256Digest;
  readonly hostProfileSetDigest: Sha256Digest;
};

type ExpectedDeploymentIdentityPreimageKey =
  | "schema"
  | "applicationNamespaceDigest"
  | "releaseIdentity"
  | "targetEnvironmentId"
  | "canonicalPublicOrigin"
  | "contractNamespaceGraphDigest"
  | "hostProfileSetDigest";

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

describe("deployment identity preimage model", () => {
  it("fixes the exact seven required readonly fields and property types", () => {
    expectTypeOf<
      keyof DeploymentIdentityPreimage
    >().toEqualTypeOf<ExpectedDeploymentIdentityPreimageKey>();
    expectTypeOf<ExpectedDeploymentIdentityPreimageKey>().toEqualTypeOf<
      keyof DeploymentIdentityPreimage
    >();
    expectTypeOf<
      DeploymentIdentityPreimage["schema"]
    >().toEqualTypeOf<"dathra.deployment-identity/1">();
    expectTypeOf<
      DeploymentIdentityPreimage["applicationNamespaceDigest"]
    >().toEqualTypeOf<Sha256Digest>();
    expectTypeOf<
      DeploymentIdentityPreimage["releaseIdentity"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      DeploymentIdentityPreimage["targetEnvironmentId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      DeploymentIdentityPreimage["canonicalPublicOrigin"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      DeploymentIdentityPreimage["contractNamespaceGraphDigest"]
    >().toEqualTypeOf<Sha256Digest>();
    expectTypeOf<
      DeploymentIdentityPreimage["hostProfileSetDigest"]
    >().toEqualTypeOf<Sha256Digest>();
    expectTypeOf<DeploymentIdentityPreimage>().toEqualTypeOf<ExpectedDeploymentIdentityPreimage>();
    expectTypeOf<ExpectedDeploymentIdentityPreimage>().toEqualTypeOf<DeploymentIdentityPreimage>();
  });

  it("declares one interface with seven ordered readonly required properties", () => {
    const { sourceFile } = readTypeScriptModule("./deploymentIdentityModel.ts");
    const interfaces = sourceFile.statements.filter(isInterfaceDeclaration);
    const typeAliases = sourceFile.statements.filter(isTypeAliasDeclaration);
    const declaration = interfaces[0];

    expect(interfaces.map((candidate) => candidate.name.text)).toEqual([
      "DeploymentIdentityPreimage",
    ]);
    expect(typeAliases).toEqual([]);
    if (declaration === undefined) {
      throw new TypeError("Expected the deployment identity interface");
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
      { isOptional: false, isReadonly: true, name: "schema" },
      {
        isOptional: false,
        isReadonly: true,
        name: "applicationNamespaceDigest",
      },
      { isOptional: false, isReadonly: true, name: "releaseIdentity" },
      { isOptional: false, isReadonly: true, name: "targetEnvironmentId" },
      { isOptional: false, isReadonly: true, name: "canonicalPublicOrigin" },
      {
        isOptional: false,
        isReadonly: true,
        name: "contractNamespaceGraphDigest",
      },
      { isOptional: false, isReadonly: true, name: "hostProfileSetDigest" },
    ]);

    const schema = members[0]?.type;
    expect(
      schema !== undefined &&
        isLiteralTypeNode(schema) &&
        isStringLiteral(schema.literal)
        ? schema.literal.text
        : null,
    ).toBe("dathra.deployment-identity/1");
    expect(members[1]?.type?.getText(sourceFile)).toBe("Sha256Digest");
    expect(members[2]?.type?.kind).toBe(SyntaxKind.StringKeyword);
    expect(members[3]?.type?.kind).toBe(SyntaxKind.StringKeyword);
    expect(members[4]?.type?.kind).toBe(SyntaxKind.StringKeyword);
    expect(members[5]?.type?.getText(sourceFile)).toBe("Sha256Digest");
    expect(members[6]?.type?.getText(sourceFile)).toBe("Sha256Digest");
  });

  it("uses one type-only digest import and exports only the preimage type", () => {
    const { sourceFile } = readTypeScriptModule("./deploymentIdentityModel.ts");
    const imports = sourceFile.statements.filter(isImportDeclaration);
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );
    const importStatement = imports[0];
    const exportStatement = exportStatements[0];

    expect(imports).toHaveLength(1);
    if (
      importStatement === undefined ||
      importStatement.importClause === undefined ||
      !importStatement.importClause.isTypeOnly ||
      importStatement.importClause.namedBindings === undefined ||
      !isNamedImports(importStatement.importClause.namedBindings) ||
      !isStringLiteral(importStatement.moduleSpecifier)
    ) {
      throw new TypeError("Expected one named type-only import declaration");
    }
    expect(importStatement.moduleSpecifier.text).toBe(
      "../canonicalIdentity/implementation",
    );
    expect(
      importStatement.importClause.namedBindings.elements.map(
        (element) => element.name.text,
      ),
    ).toEqual(["Sha256Digest"]);

    expect(exportStatements).toHaveLength(1);
    if (
      exportStatement === undefined ||
      !isExportDeclaration(exportStatement) ||
      exportStatement.exportClause === undefined ||
      !isNamedExports(exportStatement.exportClause)
    ) {
      throw new TypeError("Expected one named type-only export declaration");
    }
    expect(exportStatement.isTypeOnly).toBe(true);
    expect(exportStatement.moduleSpecifier).toBeUndefined();
    expect(
      exportStatement.exportClause.elements.map((element) => element.name.text),
    ).toEqual(["DeploymentIdentityPreimage"]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(deploymentIdentityModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./deploymentIdentityModel.ts").trim()).toBe(
      "export {};",
    );
    expect(
      emitTypeScriptModule("./deploymentIdentityModel.type-fixture.ts").trim(),
    ).toBe("export {};");
  });
});
