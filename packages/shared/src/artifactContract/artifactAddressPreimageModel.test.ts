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
  isUnionTypeNode,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
  type Statement,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import { type Sha256Digest } from "../canonicalIdentity/implementation";
import * as artifactAddressPreimageModelApi from "./artifactAddressPreimageModel";
import { type ArtifactAddressPreimage } from "./artifactAddressPreimageModel";
import { type ArtifactDependencyBinding } from "./dependencyBindingModel";
import { type ArtifactEntryBinding } from "./entryBindingModel";
import { type ArtifactExportBinding } from "./exportBindingModel";
import { type ArtifactFinalizationTemplate } from "./finalizationTemplateModel";

type ExpectedArtifactKind = "javascript" | "wasm" | "data";

type ExpectedArtifactAddressPreimage = {
  readonly schema: "dathra.artifact-address/1";
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly artifactBaseUrl: string;
  readonly bundlerProfileDigest: Sha256Digest;
  readonly kind: ExpectedArtifactKind;
  readonly finalizationTemplate: ArtifactFinalizationTemplate;
  readonly entryBindings: readonly ArtifactEntryBinding[];
  readonly memberSemanticIds: readonly string[];
  readonly dependencyBindings: readonly ArtifactDependencyBinding[];
  readonly exportTable: readonly ArtifactExportBinding[];
};

type ExpectedArtifactAddressPreimageKey = keyof ExpectedArtifactAddressPreimage;

type DeferredValidationState = Omit<
  ExpectedArtifactAddressPreimage,
  | "kind"
  | "finalizationTemplate"
  | "entryBindings"
  | "memberSemanticIds"
  | "dependencyBindings"
  | "exportTable"
> & {
  readonly kind: "data";
  readonly finalizationTemplate: ArtifactFinalizationTemplate & {
    readonly wasmBinding: "external-module";
  };
  readonly entryBindings: readonly [
    ArtifactEntryBinding & {
      readonly role: "runtime-entry";
      readonly entrySemanticId: "missing-member";
      readonly invocationOrdinal: 1;
    },
    ArtifactEntryBinding & {
      readonly role: "runtime-entry";
      readonly entrySemanticId: "missing-member";
      readonly invocationOrdinal: 1;
    },
  ];
  readonly memberSemanticIds: readonly ["z", "z", "a"];
  readonly dependencyBindings: readonly [
    ArtifactDependencyBinding & {
      readonly slot: "missing-slot";
      readonly targetExportName: "missing-export";
    },
  ];
  readonly exportTable: readonly [
    ArtifactExportBinding & {
      readonly memberSemanticId: "missing-member";
      readonly exportRole: "wasm-binding";
    },
  ];
};

type EmptyCollectionsState = Omit<
  ExpectedArtifactAddressPreimage,
  "entryBindings" | "memberSemanticIds" | "dependencyBindings" | "exportTable"
> & {
  readonly entryBindings: readonly [];
  readonly memberSemanticIds: readonly [];
  readonly dependencyBindings: readonly [];
  readonly exportTable: readonly [];
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

describe("artifact address preimage model", () => {
  it("fixes the exact ten required readonly fields and property types", () => {
    expectTypeOf<
      keyof ArtifactAddressPreimage
    >().toEqualTypeOf<ExpectedArtifactAddressPreimageKey>();
    expectTypeOf<ExpectedArtifactAddressPreimageKey>().toEqualTypeOf<
      keyof ArtifactAddressPreimage
    >();
    expectTypeOf<ArtifactAddressPreimage>().toEqualTypeOf<ExpectedArtifactAddressPreimage>();
    expectTypeOf<ExpectedArtifactAddressPreimage>().toEqualTypeOf<ArtifactAddressPreimage>();
  });

  it("keeps semantic validation states structurally representable", () => {
    expectTypeOf<DeferredValidationState>().toMatchTypeOf<ArtifactAddressPreimage>();
    expectTypeOf<EmptyCollectionsState>().toMatchTypeOf<ArtifactAddressPreimage>();
  });

  it("declares one interface in canonical order with a direct kind union", () => {
    const { sourceFile } = readTypeScriptModule(
      "./artifactAddressPreimageModel.ts",
    );
    const interfaces = sourceFile.statements.filter(isInterfaceDeclaration);
    const typeAliases = sourceFile.statements.filter(isTypeAliasDeclaration);
    const declaration = interfaces.at(0);

    expect(interfaces.map((candidate) => candidate.name.text)).toEqual([
      "ArtifactAddressPreimage",
    ]);
    expect(typeAliases).toEqual([]);
    if (declaration === undefined) {
      throw new TypeError("Expected the artifact address preimage interface");
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
        name: "deploymentIdentityDigest",
      },
      { isOptional: false, isReadonly: true, name: "artifactBaseUrl" },
      {
        isOptional: false,
        isReadonly: true,
        name: "bundlerProfileDigest",
      },
      { isOptional: false, isReadonly: true, name: "kind" },
      {
        isOptional: false,
        isReadonly: true,
        name: "finalizationTemplate",
      },
      { isOptional: false, isReadonly: true, name: "entryBindings" },
      { isOptional: false, isReadonly: true, name: "memberSemanticIds" },
      { isOptional: false, isReadonly: true, name: "dependencyBindings" },
      { isOptional: false, isReadonly: true, name: "exportTable" },
    ]);

    const schema = members[0]?.type;
    expect(
      schema !== undefined &&
        isLiteralTypeNode(schema) &&
        isStringLiteral(schema.literal)
        ? schema.literal.text
        : null,
    ).toBe("dathra.artifact-address/1");

    const kind = members[4]?.type;
    if (kind === undefined || !isUnionTypeNode(kind)) {
      throw new TypeError("Expected a direct inline kind union");
    }
    expect(
      kind.types.map((type) => {
        if (!isLiteralTypeNode(type) || !isStringLiteral(type.literal)) {
          throw new TypeError("Expected string literal kind members");
        }
        return type.literal.text;
      }),
    ).toEqual(["javascript", "wasm", "data"]);

    expect(members.map(({ type }) => type?.getText(sourceFile))).toEqual([
      '"dathra.artifact-address/1"',
      "Sha256Digest",
      "string",
      "Sha256Digest",
      '"javascript" | "wasm" | "data"',
      "ArtifactFinalizationTemplate",
      "readonly ArtifactEntryBinding[]",
      "readonly string[]",
      "readonly ArtifactDependencyBinding[]",
      "readonly ArtifactExportBinding[]",
    ]);
  });

  it("uses only type imports and exports only the preimage type", () => {
    const { sourceFile } = readTypeScriptModule(
      "./artifactAddressPreimageModel.ts",
    );
    const imports = sourceFile.statements.filter(isImportDeclaration);
    const exportStatements = sourceFile.statements.filter(
      (statement) =>
        isExportDeclaration(statement) ||
        isExportAssignment(statement) ||
        hasExportModifier(statement),
    );

    expect(
      imports.map((statement) => {
        if (
          statement.importClause === undefined ||
          !statement.importClause.isTypeOnly ||
          statement.importClause.namedBindings === undefined ||
          !isNamedImports(statement.importClause.namedBindings) ||
          !isStringLiteral(statement.moduleSpecifier)
        ) {
          throw new TypeError("Expected named type-only imports");
        }

        return {
          moduleSpecifier: statement.moduleSpecifier.text,
          names: statement.importClause.namedBindings.elements.map(
            (element) => element.name.text,
          ),
        };
      }),
    ).toEqual([
      {
        moduleSpecifier: "../canonicalIdentity/implementation",
        names: ["Sha256Digest"],
      },
      {
        moduleSpecifier: "./dependencyBindingModel",
        names: ["ArtifactDependencyBinding"],
      },
      {
        moduleSpecifier: "./entryBindingModel",
        names: ["ArtifactEntryBinding"],
      },
      {
        moduleSpecifier: "./exportBindingModel",
        names: ["ArtifactExportBinding"],
      },
      {
        moduleSpecifier: "./finalizationTemplateModel",
        names: ["ArtifactFinalizationTemplate"],
      },
    ]);

    expect(exportStatements).toHaveLength(1);
    const exportStatement = exportStatements.at(0);
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
    ).toEqual(["ArtifactAddressPreimage"]);
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(artifactAddressPreimageModelApi)).toEqual([]);
    expect(
      emitTypeScriptModule("./artifactAddressPreimageModel.ts").trim(),
    ).toBe("export {};");
    expect(
      emitTypeScriptModule(
        "./artifactAddressPreimageModel.type-fixture.ts",
      ).trim(),
    ).toBe("export {};");
  });
});
