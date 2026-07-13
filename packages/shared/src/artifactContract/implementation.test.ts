import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

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

import { type Sha256Digest } from "../canonicalIdentity/implementation";
import * as artifactContractApi from "./implementation";
import {
  ArtifactContractError,
  type ArtifactAddressPreimage,
  type ArtifactContractErrorCode,
  type ArtifactDependencyBinding,
  type ArtifactEntryBinding,
  type ArtifactExportBinding,
  type ArtifactFinalizationTemplate,
  type DeploymentIdentityPreimage,
} from "./implementation";

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

type ExpectedDeploymentIdentityPreimage = {
  readonly schema: "dathra.deployment-identity/1";
  readonly applicationNamespaceDigest: Sha256Digest;
  readonly releaseIdentity: string;
  readonly targetEnvironmentId: string;
  readonly canonicalPublicOrigin: string;
  readonly contractNamespaceGraphDigest: Sha256Digest;
  readonly hostProfileSetDigest: Sha256Digest;
};

type ExpectedArtifactAddressPreimage = {
  readonly schema: "dathra.artifact-address/1";
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly artifactBaseUrl: string;
  readonly bundlerProfileDigest: Sha256Digest;
  readonly kind: "javascript" | "wasm" | "data";
  readonly finalizationTemplate: ArtifactFinalizationTemplate;
  readonly entryBindings: readonly ArtifactEntryBinding[];
  readonly memberSemanticIds: readonly string[];
  readonly dependencyBindings: readonly ArtifactDependencyBinding[];
  readonly exportTable: readonly ArtifactExportBinding[];
};

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

function readNamedExportNames(filePath: string): string[] {
  const source = readFileSync(filePath, "utf8");
  const sourceFile = createSourceFile(
    filePath,
    source,
    ScriptTarget.ES2024,
    true,
    ScriptKind.TS,
  );

  return sourceFile.statements.flatMap((statement) => {
    if (
      !isExportDeclaration(statement) ||
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      return [];
    }

    return statement.exportClause.elements.map((element) => element.name.text);
  });
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

  it("provides the exact deployment identity preimage through the facade", () => {
    expectTypeOf<DeploymentIdentityPreimage>().toEqualTypeOf<ExpectedDeploymentIdentityPreimage>();
    expectTypeOf<ExpectedDeploymentIdentityPreimage>().toEqualTypeOf<DeploymentIdentityPreimage>();
  });

  it("provides the exact artifact address preimage through the facade", () => {
    expectTypeOf<ArtifactAddressPreimage>().toEqualTypeOf<ExpectedArtifactAddressPreimage>();
    expectTypeOf<ExpectedArtifactAddressPreimage>().toEqualTypeOf<ArtifactAddressPreimage>();
  });

  it("exposes only the artifact contract error at runtime", () => {
    expect(Object.keys(artifactContractApi)).toEqual(["ArtifactContractError"]);
    expect(artifactContractApi.ArtifactContractError).toBe(
      ArtifactContractError,
    );
    expectTypeOf<ArtifactContractErrorCode>().toEqualTypeOf<
      ArtifactContractError["code"]
    >();
  });

  it("exports exactly one value and nine package-local types", () => {
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
        isTypeOnly: false,
        moduleSpecifier: "./error",
        exports: [
          {
            exportedName: "ArtifactContractError",
            localName: "ArtifactContractError",
          },
        ],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: "./error",
        exports: [
          {
            exportedName: "ArtifactContractErrorCode",
            localName: "ArtifactContractErrorCode",
          },
        ],
      },
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
      {
        isTypeOnly: true,
        moduleSpecifier: "./entryBindingModel",
        exports: [
          {
            exportedName: "ArtifactEntryRole",
            localName: "ArtifactEntryRole",
          },
          {
            exportedName: "ArtifactEntryBinding",
            localName: "ArtifactEntryBinding",
          },
        ],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: "./dependencyBindingModel",
        exports: [
          {
            exportedName: "ArtifactDependencyBinding",
            localName: "ArtifactDependencyBinding",
          },
        ],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: "./exportBindingModel",
        exports: [
          {
            exportedName: "ArtifactExportBinding",
            localName: "ArtifactExportBinding",
          },
        ],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: "./deploymentIdentityModel",
        exports: [
          {
            exportedName: "DeploymentIdentityPreimage",
            localName: "DeploymentIdentityPreimage",
          },
        ],
      },
      {
        isTypeOnly: true,
        moduleSpecifier: "./artifactAddressPreimageModel",
        exports: [
          {
            exportedName: "ArtifactAddressPreimage",
            localName: "ArtifactAddressPreimage",
          },
        ],
      },
    ]);
  });

  it("emits only the error runtime edge from the facade", () => {
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      'export { ArtifactContractError } from "./error";',
    );
    expect(emitTypeScriptModule("./model.ts").trim()).toBe("export {};");
    expect(emitTypeScriptModule("./finalizationTemplateModel.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./entryBindingModel.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./dependencyBindingModel.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./exportBindingModel.ts").trim()).toBe(
      "export {};",
    );
    expect(emitTypeScriptModule("./deploymentIdentityModel.ts").trim()).toBe(
      "export {};",
    );
    expect(
      emitTypeScriptModule("./artifactAddressPreimageModel.ts").trim(),
    ).toBe("export {};");
    expect(
      emitTypeScriptModule("./deploymentIdentityModel.type-fixture.ts").trim(),
    ).toBe("export {};");
    expect(
      emitTypeScriptModule(
        "./artifactAddressPreimageModel.type-fixture.ts",
      ).trim(),
    ).toBe("export {};");
    expect(emitTypeScriptModule("./error.type-fixture.ts").trim()).toBe(
      "export {};",
    );
  });

  it("emits the type-only consumer without a runtime import edge", () => {
    const output = emitTypeScriptModule("./typeOnlyConsumer.fixture.ts");

    expect(output.trim()).toBe("export {};");
    expect(output).not.toContain("./implementation");
    expect(output).not.toMatch(/\bimport\b/u);
  });

  it("keeps artifact contract APIs out of built root declarations", () => {
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-artifact-contract-"),
    );

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
        const exportedNames = readNamedExportNames(
          join(outputDirectory, declarationFile),
        );

        expect(exportedNames).toContain("Sha256Digest");
        expect(exportedNames).not.toContain("ArtifactContractError");
        expect(exportedNames).not.toContain("ArtifactContractErrorCode");
        expect(exportedNames).not.toContain("ArtifactContractPath");
        expect(exportedNames).not.toContain("ArtifactContractPathSegment");
        expect(exportedNames).not.toContain("fail");
        expect(exportedNames).not.toContain("formatPath");
        expect(exportedNames).not.toContain("ArtifactAddressId");
        expect(exportedNames).not.toContain("ArtifactFinalizationTemplate");
        expect(exportedNames).not.toContain("ArtifactEntryRole");
        expect(exportedNames).not.toContain("ArtifactEntryBinding");
        expect(exportedNames).not.toContain("ArtifactDependencyBinding");
        expect(exportedNames).not.toContain("ArtifactDependencyKind");
        expect(exportedNames).not.toContain("ArtifactExportBinding");
        expect(exportedNames).not.toContain("ArtifactExportRole");
        expect(exportedNames).not.toContain("DeploymentIdentityPreimage");
        expect(exportedNames).not.toContain("DeploymentIdentityDigest");
        expect(exportedNames).not.toContain("DeploymentIdentityId");
        expect(exportedNames).not.toContain("ArtifactAddressPreimage");
        expect(exportedNames).not.toContain("ArtifactAddressPreimageSource");
        expect(exportedNames).not.toContain("ArtifactKind");
      }
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});
