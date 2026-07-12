import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  canHaveModifiers,
  createSourceFile,
  getModifiers,
  getJSDocCommentsAndTags,
  isClassDeclaration,
  isExportDeclaration,
  isFunctionDeclaration,
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
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  expectTypeOf,
  it,
  vi,
} from "vitest";

import type * as CanonicalIdentityImplementation from "../canonicalIdentity/implementation";

const canonicalIdentityMock = vi.hoisted(() => ({
  digestCanonicalJson: vi.fn(),
}));

vi.mock("../canonicalIdentity/implementation", async (importOriginal) => {
  const actual = await importOriginal<typeof CanonicalIdentityImplementation>();
  canonicalIdentityMock.digestCanonicalJson.mockImplementation(
    actual.digestCanonicalJson,
  );
  return {
    ...actual,
    digestCanonicalJson: canonicalIdentityMock.digestCanonicalJson,
  };
});

import {
  CanonicalIdentityError,
  digestCanonicalJson,
  isSha256Digest,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import * as sharedRootApi from "../index";
import * as renderContractApi from "./implementation";
import {
  RenderDefinitionError,
  createRenderDefinition,
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

beforeEach(() => {
  canonicalIdentityMock.digestCanonicalJson.mockClear();
});

afterEach(() => {
  vi.unstubAllGlobals();
});

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

function digest(body: string): Sha256Digest {
  const value = `sha-256:${body}`;
  if (!isSha256Digest(value)) {
    throw new TypeError("Invalid digest fixture");
  }
  return value;
}

const DIGEST_A = digest("A".repeat(43));
const DIGEST_B = digest(`${"B".repeat(42)}E`);
const DIGEST_C = digest(`${"C".repeat(42)}I`);
const DIGEST_D = digest(`${"D".repeat(42)}M`);
const DEFERRED_ID = digest(`${"E".repeat(42)}Q`);

function creatorInput(): RenderDefinitionInput {
  return {
    observationContractId: DIGEST_A,
    responseContributionSetId: DIGEST_B,
    orderedBodyPlanId: DIGEST_C,
    exposureContractId: DIGEST_D,
  };
}

function expectedPreimage(): RenderDefinitionPreimage {
  return {
    schema: "dathra.render-definition/1",
    observationContract: {
      schema: "dathra.render-definition-observation-reference/1",
      role: "observation-contract",
      claimedId: DIGEST_A,
    },
    responseContributions: {
      schema: "dathra.render-definition-response-reference/1",
      role: "response-contribution-set",
      claimedId: DIGEST_B,
    },
    orderedBodyPlan: {
      schema: "dathra.render-definition-body-reference/1",
      role: "ordered-body-plan",
      claimedId: DIGEST_C,
    },
    exposure: {
      schema: "dathra.render-definition-exposure-reference/1",
      role: "exposure-contract",
      claimedId: DIGEST_D,
    },
  };
}

function deferred<Value>(): {
  readonly promise: Promise<Value>;
  readonly resolve: (value: Value) => void;
} {
  let resolvePromise: ((value: Value) => void) | undefined;
  const promise = new Promise<Value>((resolve) => {
    resolvePromise = resolve;
  });
  if (resolvePromise === undefined) {
    throw new TypeError("Deferred promise did not expose its resolver");
  }
  return { promise, resolve: resolvePromise };
}

async function caughtOperationError(
  operation: Promise<unknown>,
): Promise<RenderDefinitionError> {
  try {
    await operation;
  } catch (error: unknown) {
    if (error instanceof RenderDefinitionError) {
      return error;
    }
    throw error;
  }
  throw new TypeError("Expected RenderDefinitionError");
}

function isDefinitionRoot(value: unknown): boolean {
  return (
    typeof value === "object" &&
    value !== null &&
    Object.hasOwn(value, "id") &&
    Object.hasOwn(value, "preimage")
  );
}

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
    !isFunctionDeclaration(statement) &&
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
  it("exports exactly the cumulative DI3A value and type inventory", () => {
    const { sourceFile } = readTypeScriptModule("./implementation.ts");

    expect(sourceFile.statements.every(isExportDeclaration)).toBe(true);
    expect(readNamedExportSurface("./implementation.ts")).toEqual([
      {
        moduleSpecifier: "./error",
        typeOnly: false,
        names: ["RenderDefinitionError"],
      },
      {
        moduleSpecifier: "./operations",
        typeOnly: false,
        names: ["createRenderDefinition"],
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

  it("contains the error and creator, while the parser remains absent", () => {
    expect(Object.keys(renderContractApi)).toEqual([
      "RenderDefinitionError",
      "createRenderDefinition",
    ]);
    expect(renderContractApi.RenderDefinitionError).toBe(RenderDefinitionError);
    expect(renderContractApi.createRenderDefinition).toBe(
      createRenderDefinition,
    );
    expect("parseRenderDefinition" in renderContractApi).toBe(false);
  });

  it("emits only the two intentional runtime facade dependencies", () => {
    expect(emitTypeScriptModule("./implementation.ts").trim()).toBe(
      [
        'export { RenderDefinitionError } from "./error";',
        'export { createRenderDefinition } from "./operations";',
      ].join("\n"),
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
    const operationNames = readTypeScriptModule("./operations.ts")
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
    expect(operationNames).toEqual(["createRenderDefinition"]);
    expect(readNamedExportSurface("./operations.ts")).toEqual([
      {
        moduleSpecifier: null,
        typeOnly: false,
        names: ["createRenderDefinition"],
      },
    ]);
  });
});

describe("createRenderDefinition", () => {
  it("returns the one canonical digest of the exact returned preimage", async () => {
    const expectedId = await digestCanonicalJson(expectedPreimage());
    canonicalIdentityMock.digestCanonicalJson.mockClear();

    const definition = await createRenderDefinition(creatorInput());

    expect(definition.id).toBe(expectedId);
    expect(canonicalIdentityMock.digestCanonicalJson).toHaveBeenCalledOnce();
    expect(canonicalIdentityMock.digestCanonicalJson).toHaveBeenCalledWith(
      definition.preimage,
    );
  });

  it("finishes structural and scalar failure before starting crypto", async () => {
    let cryptoReads = 0;
    vi.stubGlobal(
      "crypto",
      new Proxy(
        {},
        {
          get() {
            cryptoReads += 1;
            throw new TypeError("Validation must finish before WebCrypto");
          },
        },
      ),
    );

    const structural = creatorInput();
    Object.defineProperty(structural, "observationContractId", {
      enumerable: true,
      get() {
        throw new TypeError("Creator must not invoke accessors");
      },
    });
    await expect(createRenderDefinition(structural)).rejects.toMatchObject({
      code: "invalid-closed-record",
      path: [],
    });

    const scalar = creatorInput();
    Reflect.set(scalar, "observationContractId", "malformed");
    await expect(createRenderDefinition(scalar)).rejects.toMatchObject({
      code: "invalid-reference",
      path: ["observationContractId"],
    });

    expect(canonicalIdentityMock.digestCanonicalJson).not.toHaveBeenCalled();
    expect(cryptoReads).toBe(0);
  });

  it("captures before a deferred digest and ignores later caller mutation", async () => {
    const digestResult = deferred<Sha256Digest>();
    let capturedPreimage: unknown;
    canonicalIdentityMock.digestCanonicalJson.mockImplementationOnce(
      (preimage: unknown) => {
        capturedPreimage = preimage;
        return digestResult.promise;
      },
    );
    const input = creatorInput();
    const freezeSpy = vi.spyOn(Object, "freeze");

    try {
      const definitionPromise = createRenderDefinition(input);
      Reflect.set(input, "observationContractId", DIGEST_D);
      Reflect.set(input, "responseContributionSetId", DIGEST_A);

      expect(canonicalIdentityMock.digestCanonicalJson).toHaveBeenCalledOnce();
      expect(capturedPreimage).toEqual(expectedPreimage());
      expect(
        freezeSpy.mock.calls.some(([value]) => isDefinitionRoot(value)),
      ).toBe(false);
      digestResult.resolve(DEFERRED_ID);

      const definition = await definitionPromise;
      expect(definition.id).toBe(DEFERRED_ID);
      expect(definition.preimage).toBe(capturedPreimage);
      expect(definition.preimage).toEqual(expectedPreimage());
      expect(
        freezeSpy.mock.calls.filter(([value]) => isDefinitionRoot(value)),
      ).toEqual([[definition]]);
    } finally {
      digestResult.resolve(DEFERRED_ID);
      freezeSpy.mockRestore();
    }
  });

  it("maps a missing WebCrypto host without leaking canonical errors", async () => {
    vi.stubGlobal("crypto", undefined);
    const freezeSpy = vi.spyOn(Object, "freeze");

    try {
      const error = await caughtOperationError(
        createRenderDefinition(creatorInput()),
      );

      expect(error).not.toBeInstanceOf(CanonicalIdentityError);
      expect(error.code).toBe("crypto-unavailable");
      expect(error.path).toEqual([]);
      expect(Object.isFrozen(error.path)).toBe(true);
      expect(Object.isFrozen(error)).toBe(true);
      expect(
        freezeSpy.mock.calls.some(([value]) => isDefinitionRoot(value)),
      ).toBe(false);
    } finally {
      freezeSpy.mockRestore();
    }
  });

  it("maps other canonical failures to immutable creator paths", async () => {
    const canonicalError = new CanonicalIdentityError(
      "invalid-unicode",
      ["observationContract", "claimedId"],
      "Invalid generated canonical input",
    );
    canonicalIdentityMock.digestCanonicalJson.mockRejectedValueOnce(
      canonicalError,
    );

    const error = await caughtOperationError(
      createRenderDefinition(creatorInput()),
    );

    expect(error).not.toBe(canonicalError);
    expect(error).not.toBeInstanceOf(CanonicalIdentityError);
    expect(error.code).toBe("invalid-field");
    expect(error.path).toEqual(["observationContract", "claimedId"]);
    expect(error.path).not.toBe(canonicalError.path);
    expect(Object.isFrozen(error.path)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
  });

  it("rethrows failures outside the canonical identity domain", async () => {
    const unexpectedError = new Error("Unexpected digest host failure");
    canonicalIdentityMock.digestCanonicalJson.mockRejectedValueOnce(
      unexpectedError,
    );

    await expect(createRenderDefinition(creatorInput())).rejects.toBe(
      unexpectedError,
    );
  });

  it("freezes only a fresh root after reusing the DI2B preimage", async () => {
    let capturedPreimage: unknown;
    canonicalIdentityMock.digestCanonicalJson.mockImplementationOnce(
      (preimage: unknown) => {
        capturedPreimage = preimage;
        return Promise.resolve(DEFERRED_ID);
      },
    );

    const definition = await createRenderDefinition(creatorInput());

    expect(definition.preimage).toBe(capturedPreimage);
    expect(
      [
        definition,
        definition.preimage,
        definition.preimage.observationContract,
        definition.preimage.responseContributions,
        definition.preimage.orderedBodyPlan,
        definition.preimage.exposure,
      ].map(Object.isFrozen),
    ).not.toContain(false);
    expect(Reflect.set(definition, "id", DIGEST_A)).toBe(false);
    expect(
      Reflect.set(
        definition.preimage.observationContract,
        "claimedId",
        DIGEST_D,
      ),
    ).toBe(false);
  });

  it("shares no record identity across equal calls", async () => {
    const input = creatorInput();
    const first = await createRenderDefinition(input);
    const second = await createRenderDefinition(input);

    expect(first).toEqual(second);
    expect(first).not.toBe(second);
    expect(first.preimage).not.toBe(second.preimage);
    expect(first.preimage.observationContract).not.toBe(
      second.preimage.observationContract,
    );
    expect(first.preimage.responseContributions).not.toBe(
      second.preimage.responseContributions,
    );
    expect(first.preimage.orderedBodyPlan).not.toBe(
      second.preimage.orderedBodyPlan,
    );
    expect(first.preimage.exposure).not.toBe(second.preimage.exposure);
  });
});

describe("render creator publication boundary", () => {
  it("keeps creator and parser out of the shared root source and runtime", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );

    expect(rootSource).not.toContain("createRenderDefinition");
    expect(rootSource).not.toContain("parseRenderDefinition");
    expect("createRenderDefinition" in sharedRootApi).toBe(false);
    expect("parseRenderDefinition" in sharedRootApi).toBe(false);
  });

  it("keeps creator and parser out of root declarations and runtime bundles", () => {
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-render-contract-di3a-root-"),
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

      for (const artifactFile of [
        "index.d.mts",
        "index.d.cts",
        "index.mjs",
        "index.cjs",
      ]) {
        const artifact = readFileSync(
          join(outputDirectory, artifactFile),
          "utf8",
        );
        expect(artifact).not.toContain("createRenderDefinition");
        expect(artifact).not.toContain("parseRenderDefinition");
      }
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });

  it("emits a browser-compatible opt-in facade without activation code", () => {
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-render-contract-di3a-browser-"),
    );

    try {
      execFileSync(
        "pnpm",
        [
          "exec",
          "tsdown",
          "src/renderContract/implementation.ts",
          "--no-config",
          "--format",
          "esm",
          "--platform",
          "browser",
          "--target",
          "es2022",
          "--out-dir",
          outputDirectory,
          "--logLevel",
          "error",
        ],
        {
          cwd: packageRoot,
          stdio: "pipe",
        },
      );

      const browserEmit = readdirSync(outputDirectory)
        .filter((fileName) => /\.(?:js|mjs)$/u.test(fileName))
        .map((fileName) =>
          readFileSync(join(outputDirectory, fileName), "utf8"),
        )
        .join("\n");
      expect(browserEmit).toContain("createRenderDefinition");
      expect(browserEmit).not.toMatch(
        /(?:from\s*["']node:|require\(["']node:)/u,
      );
      expect(browserEmit).not.toContain("Buffer");
      expect(browserEmit).not.toMatch(
        /\b(?:window|document|customElements|addEventListener)\b/u,
      );
      expect(browserEmit).not.toContain("parseRenderDefinition");
      expect(browserEmit).not.toContain("RenderEnvelope");
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });
});
