import { readFileSync } from "node:fs";

import {
  canHaveModifiers,
  createSourceFile,
  getModifiers,
  getJSDocCommentsAndTags,
  isClassDeclaration,
  isExportDeclaration,
  isIdentifier,
  isInterfaceDeclaration,
  isNamedExports,
  isStringLiteral,
  isTypeAliasDeclaration,
  isVariableStatement,
  ModuleKind,
  ScriptKind,
  ScriptTarget,
  SyntaxKind,
  transpileModule,
  type Statement,
} from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import type { Sha256Digest } from "../canonicalIdentity/implementation";
import * as renderContractApi from "./implementation";
import {
  RenderDefinitionError,
  type RenderBodyReferenceClaim,
  type RenderDefinition,
  type RenderDefinitionErrorCode,
  type RenderDefinitionId,
  type RenderDefinitionInput,
  type RenderDefinitionPreimage,
  type RenderExposureReferenceClaim,
  type RenderObservationReferenceClaim,
  type RenderResponseReferenceClaim,
} from "./implementation";

type ExpectedObservationClaim = {
  readonly schema: "dathra.render-definition-observation-reference/1";
  readonly role: "observation-contract";
  readonly claimedId: Sha256Digest;
};

type ExpectedResponseClaim = {
  readonly schema: "dathra.render-definition-response-reference/1";
  readonly role: "response-contribution-set";
  readonly claimedId: Sha256Digest;
};

type ExpectedBodyClaim = {
  readonly schema: "dathra.render-definition-body-reference/1";
  readonly role: "ordered-body-plan";
  readonly claimedId: Sha256Digest;
};

type ExpectedExposureClaim = {
  readonly schema: "dathra.render-definition-exposure-reference/1";
  readonly role: "exposure-contract";
  readonly claimedId: Sha256Digest;
};

type ExpectedPreimage = {
  readonly schema: "dathra.render-definition/1";
  readonly observationContract: RenderObservationReferenceClaim;
  readonly responseContributions: RenderResponseReferenceClaim;
  readonly orderedBodyPlan: RenderBodyReferenceClaim;
  readonly exposure: RenderExposureReferenceClaim;
};

type ExpectedDefinition = {
  readonly id: RenderDefinitionId;
  readonly preimage: RenderDefinitionPreimage;
};

type ExpectedInput = {
  readonly observationContractId: Sha256Digest;
  readonly responseContributionSetId: Sha256Digest;
  readonly orderedBodyPlanId: Sha256Digest;
  readonly exposureContractId: Sha256Digest;
};

type ExpectedErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-reference"
  | "digest-mismatch"
  | "budget-exceeded"
  | "crypto-unavailable";

const ERROR_CODES = {
  "invalid-closed-record": true,
  "invalid-field": true,
  "invalid-reference": true,
  "digest-mismatch": true,
  "budget-exceeded": true,
  "crypto-unavailable": true,
} as const satisfies Record<RenderDefinitionErrorCode, true>;

interface NamedExportSurface {
  readonly moduleSpecifier: string | null;
  readonly typeOnly: boolean;
  readonly names: readonly string[];
}

function readTypeScriptModule(relativePath: string): {
  readonly source: string;
  readonly sourceFile: ReturnType<typeof createSourceFile>;
} {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");
  return {
    source,
    sourceFile: createSourceFile(
      relativePath,
      source,
      ScriptTarget.ES2024,
      true,
      ScriptKind.TS,
    ),
  };
}

function readNamedExportSurface(relativePath: string): NamedExportSurface[] {
  const { sourceFile } = readTypeScriptModule(relativePath);

  return sourceFile.statements.flatMap((statement) => {
    if (!isExportDeclaration(statement)) {
      return [];
    }
    if (
      statement.exportClause === undefined ||
      !isNamedExports(statement.exportClause)
    ) {
      throw new TypeError("Expected a named export clause");
    }
    if (
      statement.moduleSpecifier !== undefined &&
      !isStringLiteral(statement.moduleSpecifier)
    ) {
      throw new TypeError("Expected a string module specifier");
    }

    return [
      {
        moduleSpecifier: statement.moduleSpecifier?.text ?? null,
        typeOnly: statement.isTypeOnly,
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

function getDocumentedDeclarationName(statement: Statement): string | null {
  if (
    !isClassDeclaration(statement) &&
    !isInterfaceDeclaration(statement) &&
    !isTypeAliasDeclaration(statement)
  ) {
    return null;
  }

  if (
    statement.name === undefined ||
    getJSDocCommentsAndTags(statement).length === 0
  ) {
    return null;
  }

  return statement.name.text;
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

describe("render definition type model", () => {
  it("defines the four reference claims with exact role-specific shapes", () => {
    expectTypeOf<RenderObservationReferenceClaim>().toEqualTypeOf<ExpectedObservationClaim>();
    expectTypeOf<RenderResponseReferenceClaim>().toEqualTypeOf<ExpectedResponseClaim>();
    expectTypeOf<RenderBodyReferenceClaim>().toEqualTypeOf<ExpectedBodyClaim>();
    expectTypeOf<RenderExposureReferenceClaim>().toEqualTypeOf<ExpectedExposureClaim>();
  });

  it("defines the preimage, wrapper, and creator input with exact shapes", () => {
    expectTypeOf<RenderDefinitionPreimage>().toEqualTypeOf<ExpectedPreimage>();
    expectTypeOf<RenderDefinition>().toEqualTypeOf<ExpectedDefinition>();
    expectTypeOf<RenderDefinitionInput>().toEqualTypeOf<ExpectedInput>();
  });

  it("widens a render definition ID to its digest and string bases", () => {
    expectTypeOf<RenderDefinitionId>().toMatchTypeOf<Sha256Digest>();
    expectTypeOf<RenderDefinitionId>().toMatchTypeOf<string>();
  });

  it("uses a private mandatory unique-symbol brand", () => {
    const { source, sourceFile } = readTypeScriptModule("./model.ts");
    const brandStatement = sourceFile.statements.find(
      (statement) =>
        isVariableStatement(statement) &&
        statement.declarationList.declarations.some(
          (declaration) =>
            isIdentifier(declaration.name) &&
            declaration.name.text === "renderDefinitionIdBrand",
        ),
    );

    if (brandStatement === undefined) {
      throw new TypeError(
        "Expected the render definition ID brand declaration",
      );
    }

    expect(source).toMatch(
      /declare const renderDefinitionIdBrand: unique symbol;/u,
    );
    expect(source).toMatch(/readonly \[renderDefinitionIdBrand\]: true;/u);
    expect(hasExportModifier(brandStatement)).toBe(false);
    expect(readNamedExportSurface("./model.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: true,
        names: [
          "RenderDefinitionId",
          "RenderObservationReferenceClaim",
          "RenderResponseReferenceClaim",
          "RenderBodyReferenceClaim",
          "RenderExposureReferenceClaim",
          "RenderDefinitionPreimage",
          "RenderDefinition",
          "RenderDefinitionInput",
        ],
      },
    ]);
  });
});

describe("RenderDefinitionError", () => {
  it("keeps the exact stable failure vocabulary", () => {
    expectTypeOf<RenderDefinitionErrorCode>().toEqualTypeOf<ExpectedErrorCode>();
    expectTypeOf<ExpectedErrorCode>().toEqualTypeOf<RenderDefinitionErrorCode>();
    expect(Object.keys(ERROR_CODES)).toEqual([
      "invalid-closed-record",
      "invalid-field",
      "invalid-reference",
      "digest-mismatch",
      "budget-exceeded",
      "crypto-unavailable",
    ]);
  });

  it("copies and freezes its path before freezing itself", () => {
    const sourcePath: (string | number)[] = ["preimage", 2, "claimedId"];
    const error = new RenderDefinitionError(
      "invalid-reference",
      sourcePath,
      "Invalid reference",
    );

    expect(error).toBeInstanceOf(TypeError);
    expect(error).toBeInstanceOf(RenderDefinitionError);
    expect(error.name).toBe("RenderDefinitionError");
    expect(error.message).toBe("Invalid reference");
    expect(error.code).toBe("invalid-reference");
    expect(error.path).toEqual(["preimage", 2, "claimedId"]);
    expect(error.path).not.toBe(sourcePath);

    sourcePath[0] = "changed";
    sourcePath.push("later");

    expect(error.path).toEqual(["preimage", 2, "claimedId"]);
    expect(Object.isFrozen(error.path)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
    expect(Reflect.set(error.path, 0, "changed")).toBe(false);
    expect(Reflect.set(error, "code", "invalid-field")).toBe(false);
  });
});

describe("render contract package-local facade", () => {
  it("exports exactly the DI1 value and types in source AST", () => {
    const { sourceFile } = readTypeScriptModule("./implementation.ts");

    expect(sourceFile.statements.every(isExportDeclaration)).toBe(true);
    expect(readNamedExportSurface("./implementation.ts")).toEqual([
      {
        moduleSpecifier: "./error",
        typeOnly: false,
        names: ["RenderDefinitionError"],
      },
      {
        moduleSpecifier: "./error",
        typeOnly: true,
        names: ["RenderDefinitionErrorCode"],
      },
      {
        moduleSpecifier: "./model",
        typeOnly: true,
        names: [
          "RenderDefinitionId",
          "RenderObservationReferenceClaim",
          "RenderResponseReferenceClaim",
          "RenderBodyReferenceClaim",
          "RenderExposureReferenceClaim",
          "RenderDefinitionPreimage",
          "RenderDefinition",
          "RenderDefinitionInput",
        ],
      },
    ]);
  });

  it("contains only RenderDefinitionError at runtime", () => {
    expect(Object.keys(renderContractApi)).toEqual(["RenderDefinitionError"]);
    expect(renderContractApi.RenderDefinitionError).toBe(RenderDefinitionError);
  });

  it("has no runtime dependency beyond the error module", () => {
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      'export { RenderDefinitionError } from "./error";',
    );
    expect(emitTypeScriptModule("./model.ts").trim()).toBe("export {};");
    expect(emitTypeScriptModule("./typeContract.fixture.ts").trim()).toBe(
      "export {};",
    );
  });

  it("documents every package-local exported declaration", () => {
    const modelNames = readTypeScriptModule("./model.ts")
      .sourceFile.statements.map(getDocumentedDeclarationName)
      .filter((name): name is string => name !== null);
    const errorNames = readTypeScriptModule("./error.ts")
      .sourceFile.statements.map(getDocumentedDeclarationName)
      .filter((name): name is string => name !== null);

    expect(modelNames).toEqual([
      "RenderDefinitionId",
      "RenderObservationReferenceClaim",
      "RenderResponseReferenceClaim",
      "RenderBodyReferenceClaim",
      "RenderExposureReferenceClaim",
      "RenderDefinitionPreimage",
      "RenderDefinition",
      "RenderDefinitionInput",
    ]);
    expect(errorNames).toEqual([
      "RenderDefinitionErrorCode",
      "RenderDefinitionError",
    ]);
  });
});
