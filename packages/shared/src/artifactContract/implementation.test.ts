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

import * as artifactContractApi from "./implementation";
import { type ArtifactFinalizationTemplate } from "./implementation";

type ExpectedArtifactFinalizationTemplate = {
  readonly schema: "dathra.artifact-finalization/1";
  readonly textEncoding: "utf-8";
  readonly moduleFormat: "esm";
  readonly wrapper:
    | "none"
    | "runtime-registration"
    | "integration-registration";
  readonly dependencyReference:
    | "canonical-relative-url"
    | "canonical-absolute-url";
  readonly exportEmission: "sorted-named-exports";
  readonly entryInvocation: "none" | "sorted-registration-calls";
  readonly sourceSeparator: "lf-semicolon";
  readonly wasmBinding: "external-module" | "none";
  readonly dataBinding: "external-fetch" | "none";
};

type ExpectedArtifactFinalizationTemplateKey =
  | "schema"
  | "textEncoding"
  | "moduleFormat"
  | "wrapper"
  | "dependencyReference"
  | "exportEmission"
  | "entryInvocation"
  | "sourceSeparator"
  | "wasmBinding"
  | "dataBinding";

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

describe("artifact contract type domains", () => {
  it("fixes the exact finalization template keys and property types", () => {
    expectTypeOf<
      keyof ArtifactFinalizationTemplate
    >().toEqualTypeOf<ExpectedArtifactFinalizationTemplateKey>();
    expectTypeOf<ExpectedArtifactFinalizationTemplateKey>().toEqualTypeOf<
      keyof ArtifactFinalizationTemplate
    >();
    expectTypeOf<
      ArtifactFinalizationTemplate["schema"]
    >().toEqualTypeOf<"dathra.artifact-finalization/1">();
    expectTypeOf<
      ArtifactFinalizationTemplate["textEncoding"]
    >().toEqualTypeOf<"utf-8">();
    expectTypeOf<
      ArtifactFinalizationTemplate["moduleFormat"]
    >().toEqualTypeOf<"esm">();
    expectTypeOf<ArtifactFinalizationTemplate["wrapper"]>().toEqualTypeOf<
      "none" | "runtime-registration" | "integration-registration"
    >();
    expectTypeOf<
      ArtifactFinalizationTemplate["dependencyReference"]
    >().toEqualTypeOf<"canonical-relative-url" | "canonical-absolute-url">();
    expectTypeOf<
      ArtifactFinalizationTemplate["exportEmission"]
    >().toEqualTypeOf<"sorted-named-exports">();
    expectTypeOf<
      ArtifactFinalizationTemplate["entryInvocation"]
    >().toEqualTypeOf<"none" | "sorted-registration-calls">();
    expectTypeOf<
      ArtifactFinalizationTemplate["sourceSeparator"]
    >().toEqualTypeOf<"lf-semicolon">();
    expectTypeOf<ArtifactFinalizationTemplate["wasmBinding"]>().toEqualTypeOf<
      "external-module" | "none"
    >();
    expectTypeOf<ArtifactFinalizationTemplate["dataBinding"]>().toEqualTypeOf<
      "external-fetch" | "none"
    >();
    expectTypeOf<ArtifactFinalizationTemplate>().toEqualTypeOf<ExpectedArtifactFinalizationTemplate>();
    expectTypeOf<ExpectedArtifactFinalizationTemplate>().toEqualTypeOf<ArtifactFinalizationTemplate>();
  });

  it("exposes no runtime values from the package-local facade", () => {
    expect(Object.keys(artifactContractApi)).toEqual([]);
  });

  it("exports exactly two package-local types from their model modules", () => {
    const relativePath = "./implementation.ts";
    const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
    const sourceFile = createSourceFile(
      relativePath,
      source,
      ScriptTarget.ES2024,
      true,
      ScriptKind.TS,
    );

    expect(
      sourceFile.statements.map((statement) => {
        if (!isExportDeclaration(statement)) {
          throw new TypeError("Expected only export declarations");
        }
        if (
          statement.exportClause === undefined ||
          !isNamedExports(statement.exportClause)
        ) {
          throw new TypeError("Expected only named export clauses");
        }
        if (
          statement.moduleSpecifier === undefined ||
          !isStringLiteral(statement.moduleSpecifier)
        ) {
          throw new TypeError("Expected only string module specifiers");
        }

        return {
          isTypeOnly: statement.isTypeOnly,
          moduleSpecifier: statement.moduleSpecifier.text,
          exports: statement.exportClause.elements.map((element) => ({
            exportedName: element.name.text,
            localName: element.propertyName?.text ?? element.name.text,
          })),
        };
      }),
    ).toEqual([
      {
        isTypeOnly: true,
        moduleSpecifier: "./model",
        exports: [
          {
            exportedName: "ArtifactAddressId",
            localName: "ArtifactAddressId",
          },
        ],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: "./finalizationTemplateModel",
        exports: [
          {
            exportedName: "ArtifactFinalizationTemplate",
            localName: "ArtifactFinalizationTemplate",
          },
        ],
      },
    ]);
  });

  it("emits the facade and both models only as module markers", () => {
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./model.ts").trim()).toBe("export {};");
    expect(emitTypeScriptModule("./finalizationTemplateModel.ts").trim()).toBe(
      "export {};",
    );
  });

  it("emits the type-only consumer without a runtime import edge", () => {
    const output = emitTypeScriptModule("./typeOnlyConsumer.fixture.ts");

    expect(output.trim()).toBe("export {};");
    expect(output).not.toContain("./implementation");
    expect(output).not.toMatch(/\bimport\b/u);
  });
});
