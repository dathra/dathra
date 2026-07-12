import { describe, expect, expectTypeOf, it } from "vitest";

import {
  // @ts-expect-error AS01 owns shared-root publication.
  type ExportExecutionContract as _RootExportExecutionContractMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type FactEndpoint as _RootFactEndpointMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticPathSegment as _RootSemanticPathSegmentMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticRelation as _RootSemanticRelationMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticRelationKind as _RootSemanticRelationKindMustNotExist,
  // @ts-expect-error AS01 owns shared-root publication.
  type SemanticSubject as _RootSemanticSubjectMustNotExist,
} from "../index";
import { fail } from "./identity";
import * as executionContractApi from "./implementation";
import {
  // @ts-expect-error Trust acceptance is owned by a later verifier.
  type AcceptedExecutionAnalysis as _AcceptedAnalysisMustNotExist,
  // @ts-expect-error Compiled contracts are owned by SC02B.
  type CompiledExecutionContract as _CompiledContractMustNotExist,
  ExecutionContractError,
  // @ts-expect-error Budgeted parsing belongs to a later review unit.
  type ExecutionContractBudget as _BudgetMustNotExist,
  // @ts-expect-error Validation path internals are not part of the facade.
  type ExecutionContractPathSegment as _PathSegmentMustNotExist,
  type FactEndpoint,
  // @ts-expect-error Registry source aggregation belongs to a later review unit.
  type ExecutionContractRegistrySources as _RegistrySourcesMustNotExist,
  type ExportExecutionContract,
  type SemanticFact,
  type SemanticFactKind,
  type SemanticPathSegment,
  type SemanticRelation,
  type SemanticRelationKind,
  type SemanticSubject,
  // @ts-expect-error The aggregate source contract belongs to a later review unit.
  type ExecutionContractSource as _SourceMustNotExist,
  // @ts-expect-error The source envelope belongs to a later review unit.
  type ExecutionContractSourceInput as _SourceInputMustNotExist,
  type TransferBinding,
  // @ts-expect-error SC01 owns registry entries; this facade does not re-export them.
  type RegistrySourceEntry as _RegistrySourceEntryMustNotExist,
  // @ts-expect-error Qualified identity is owned by SC02B and SC03.
  type QualifiedFactId as _QualifiedFactIdMustNotExist,
  factId,
  type ExecutionContractErrorCode,
  type FactId,
} from "./implementation";

type ExecutionContractApi = typeof executionContractApi;
type SemanticPathSegmentKind = SemanticPathSegment["kind"];
type SemanticSubjectKind = SemanticSubject["kind"];

type _DigestExecutionContractSourceMustNotExist =
  // @ts-expect-error Digest operations belong to a later SC02A review unit.
  ExecutionContractApi["digestExecutionContractSource"];

type _DefineExecutionContractMustNotExist =
  // @ts-expect-error Source construction belongs to a later SC02A review unit.
  ExecutionContractApi["defineExecutionContract"];

type _ParseExecutionContractSourceMustNotExist =
  // @ts-expect-error Source-level parsing belongs to SC02A12.
  ExecutionContractApi["parseExecutionContractSource"];

type _ValidateExecutionContractSourceMustNotExist =
  // @ts-expect-error Source validation remains internal to SC02A12.
  ExecutionContractApi["validateExecutionContractSource"];

const ERROR_CODES = {
  "invalid-closed-record": true,
  "invalid-field": true,
  "invalid-fact-id": true,
  "invalid-registry-id": true,
  "noncanonical-order": true,
  "duplicate-record": true,
  "dangling-reference": true,
  "kind-mismatch": true,
  "version-mismatch": true,
  "semantic-mismatch": true,
  "budget-exceeded": true,
  "crypto-unavailable": true,
} as const satisfies Record<ExecutionContractErrorCode, true>;

const PATH_SEGMENT_KINDS = [
  "property",
  "tuple-index",
  "element",
] as const satisfies readonly SemanticPathSegmentKind[];

const SUBJECT_KINDS = [
  "module-evaluation",
  "export-value",
  "receiver",
  "parameter",
  "return",
  "callback-invocation",
  "allocated-resource",
] as const satisfies readonly SemanticSubjectKind[];

const REPEATED_PATH = [
  { kind: "property", key: "next" },
  { kind: "property", key: "next" },
  { kind: "tuple-index", index: 0 },
  { kind: "element" },
] as const satisfies readonly SemanticPathSegment[];

const SUBJECTS = [
  { kind: "module-evaluation" },
  { kind: "export-value", exportName: "run" },
  { kind: "receiver", exportName: "run" },
  {
    kind: "parameter",
    exportName: "run",
    index: 0,
    path: REPEATED_PATH,
  },
  {
    kind: "return",
    exportName: "run",
    path: [{ kind: "element" }, { kind: "property", key: "value" }],
  },
  {
    kind: "callback-invocation",
    exportName: "run",
    parameterIndex: 0,
    path: [],
  },
  { kind: "allocated-resource", exportName: "run", allocationSiteId: "site" },
] as const satisfies readonly SemanticSubject[];

const NEXT_CALLBACK_SUBJECT = {
  kind: "callback-invocation",
  exportName: "subscribe",
  parameterIndex: 0,
  path: [{ kind: "property", key: "next" }],
} as const satisfies SemanticSubject;

const ERROR_CALLBACK_SUBJECT = {
  kind: "callback-invocation",
  exportName: "subscribe",
  parameterIndex: 0,
  path: [{ kind: "property", key: "error" }],
} as const satisfies SemanticSubject;

const TUPLE_CALLBACK_SUBJECTS = [
  {
    kind: "callback-invocation",
    exportName: "subscribeTuple",
    parameterIndex: 0,
    path: [{ kind: "tuple-index", index: 0 }],
  },
  {
    kind: "callback-invocation",
    exportName: "subscribeTuple",
    parameterIndex: 0,
    path: [{ kind: "tuple-index", index: 1 }],
  },
] as const satisfies readonly SemanticSubject[];

const ELEMENT_CALLBACK_SUBJECT = {
  kind: "callback-invocation",
  exportName: "subscribeEach",
  parameterIndex: 0,
  path: [{ kind: "element" }],
} as const satisfies SemanticSubject;

function expectExecutionContractError(
  operation: () => unknown,
  code: ExecutionContractErrorCode,
  path: readonly (string | number)[] = [],
): ExecutionContractError {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof ExecutionContractError)) throw error;
    if (error.code !== code) {
      throw new Error(`Expected error code ${code}, received ${error.code}`);
    }
    if (
      error.path.length !== path.length ||
      error.path.some((segment, index) => segment !== path[index])
    ) {
      throw new Error(
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }
  throw new Error("Expected an ExecutionContractError");
}

describe("source semantic subject model", () => {
  it("fixes every path and subject variant as an exact closed union", () => {
    expect(REPEATED_PATH.map((segment) => segment.kind)).toEqual([
      "property",
      "property",
      "tuple-index",
      "element",
    ]);
    expect(SUBJECTS.map((subject) => subject.kind)).toEqual(SUBJECT_KINDS);

    expectTypeOf<
      SemanticPathSegment["kind"]
    >().toEqualTypeOf<SemanticPathSegmentKind>();
    expectTypeOf<
      (typeof PATH_SEGMENT_KINDS)[number]
    >().toEqualTypeOf<SemanticPathSegmentKind>();
    expectTypeOf<
      SemanticSubject["kind"]
    >().toEqualTypeOf<SemanticSubjectKind>();
    expectTypeOf<
      (typeof SUBJECT_KINDS)[number]
    >().toEqualTypeOf<SemanticSubjectKind>();

    expectTypeOf<
      Extract<SemanticPathSegment, { readonly kind: "property" }>
    >().toEqualTypeOf<{ readonly kind: "property"; readonly key: string }>();
    expectTypeOf<
      Extract<SemanticPathSegment, { readonly kind: "tuple-index" }>
    >().toEqualTypeOf<{
      readonly kind: "tuple-index";
      readonly index: number;
    }>();
    expectTypeOf<
      Extract<SemanticPathSegment, { readonly kind: "element" }>
    >().toEqualTypeOf<{ readonly kind: "element" }>();

    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "module-evaluation" }>
    >().toEqualTypeOf<{ readonly kind: "module-evaluation" }>();
    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "export-value" }>
    >().toEqualTypeOf<{
      readonly kind: "export-value";
      readonly exportName: string;
    }>();
    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "receiver" }>
    >().toEqualTypeOf<{
      readonly kind: "receiver";
      readonly exportName: string;
    }>();
    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "parameter" }>
    >().toEqualTypeOf<{
      readonly kind: "parameter";
      readonly exportName: string;
      readonly index: number;
      readonly path: readonly SemanticPathSegment[];
    }>();
    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "return" }>
    >().toEqualTypeOf<{
      readonly kind: "return";
      readonly exportName: string;
      readonly path: readonly SemanticPathSegment[];
    }>();
    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "callback-invocation" }>
    >().toEqualTypeOf<{
      readonly kind: "callback-invocation";
      readonly exportName: string;
      readonly parameterIndex: number;
      readonly path: readonly SemanticPathSegment[];
    }>();
    expectTypeOf<
      Extract<SemanticSubject, { readonly kind: "allocated-resource" }>
    >().toEqualTypeOf<{
      readonly kind: "allocated-resource";
      readonly exportName: string;
      readonly allocationSiteId: string;
    }>();
  });

  it("distinguishes static callback slots without inventing runtime occurrences", () => {
    const directCallback = SUBJECTS[5];
    const orderedPath = [
      { kind: "property", key: "options" },
      { kind: "tuple-index", index: 0 },
    ] as const satisfies readonly SemanticPathSegment[];
    const reversedPath = [...orderedPath].reverse();

    expect(directCallback.path).toEqual([]);
    expect(NEXT_CALLBACK_SUBJECT).not.toEqual(ERROR_CALLBACK_SUBJECT);
    expect(TUPLE_CALLBACK_SUBJECTS[0]).not.toEqual(TUPLE_CALLBACK_SUBJECTS[1]);
    expect(orderedPath).not.toEqual(reversedPath);
    expect(REPEATED_PATH.slice(0, 2)).toEqual([
      { kind: "property", key: "next" },
      { kind: "property", key: "next" },
    ]);
    expect(ELEMENT_CALLBACK_SUBJECT.path).toEqual([{ kind: "element" }]);
  });
});

describe("factId", () => {
  it("preserves valid Unicode code units without normalization", () => {
    const composed = "é";
    const decomposed = "e\u0301";
    const emoji = "😀";
    const digestShaped = "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU";

    expect(factId(composed)).toBe(composed);
    expect(factId(decomposed)).toBe(decomposed);
    expect(factId(composed)).not.toBe(factId(decomposed));
    expect(factId(emoji)).toBe(emoji);
    expect(factId(digestShaped)).toBe(digestShaped);
    expectTypeOf(factId("local")).toEqualTypeOf<FactId>();
  });

  it.each(["", "\ud800", "\udc00", "a\ud800b", "a\udc00b"])(
    "rejects invalid source-local identifier %#",
    (value) => {
      const error = expectExecutionContractError(
        () => factId(value),
        "invalid-fact-id",
      );

      expect(error.message).toContain("at $");
    },
  );

  it.each([undefined, null, 0, true, {}])(
    "rejects a non-string runtime value %#",
    (value) => {
      expectExecutionContractError(
        () => Reflect.apply(factId, undefined, [value]),
        "invalid-fact-id",
      );
    },
  );
});

describe("ExecutionContractError", () => {
  it("owns an immutable path snapshot and immutable fields", () => {
    const inputPath: (string | number)[] = ["facts", 2, "id"];
    const error = new ExecutionContractError(
      "kind-mismatch",
      inputPath,
      "invalid fact kind",
    );
    inputPath[0] = "changed";

    expect(error).toBeInstanceOf(TypeError);
    expect(error.name).toBe("ExecutionContractError");
    expect(error.code).toBe("kind-mismatch");
    expect(error.path).toEqual(["facts", 2, "id"]);
    expect(Object.isFrozen(error.path)).toBe(true);
    expect(Object.isFrozen(error)).toBe(true);
    expect(Reflect.set(error.path, 0, "changed")).toBe(false);
    expect(Reflect.set(error, "code", "invalid-field")).toBe(false);
  });

  it("keeps the complete stable failure vocabulary in one closed union", () => {
    expect(Object.keys(ERROR_CODES)).toEqual([
      "invalid-closed-record",
      "invalid-field",
      "invalid-fact-id",
      "invalid-registry-id",
      "noncanonical-order",
      "duplicate-record",
      "dangling-reference",
      "kind-mismatch",
      "version-mismatch",
      "semantic-mismatch",
      "budget-exceeded",
      "crypto-unavailable",
    ]);
  });

  it("formats string and numeric path segments from the root", () => {
    const error = expectExecutionContractError(
      () => fail("invalid-field", ["facts", 2, "id"], "Expected a FactId"),
      "invalid-field",
      ["facts", 2, "id"],
    );

    expect(error.message).toBe(
      '[dathra] Expected a FactId at $["facts"][2]["id"]',
    );
  });

  it("keeps the subject, fact, relation, and export models type-only at the package-local facade", () => {
    expectTypeOf<SemanticFact["kind"]>().toEqualTypeOf<SemanticFactKind>();
    expectTypeOf<FactEndpoint<"read">>().toEqualTypeOf<{
      readonly factId: FactId;
      readonly factKind: "read";
    }>();
    expectTypeOf<
      SemanticRelation["kind"]
    >().toEqualTypeOf<SemanticRelationKind>();
    expectTypeOf<TransferBinding["kind"]>().toEqualTypeOf<
      "none" | "snapshot" | "codec" | "reference" | "subscription" | "remote"
    >();
    expectTypeOf<ExportExecutionContract["callable"]>().toEqualTypeOf<
      "none" | "call" | "construct" | "call-and-construct"
    >();
    expectTypeOf<
      ExportExecutionContract["transfer"]
    >().toEqualTypeOf<TransferBinding>();
    expect(Object.keys(executionContractApi).sort()).toEqual([
      "ExecutionContractError",
      "factId",
    ]);
    expect("QualifiedFactId" in executionContractApi).toBe(false);
    expect("CompiledExecutionContract" in executionContractApi).toBe(false);
    expect("AcceptedExecutionAnalysis" in executionContractApi).toBe(false);
    expect("digestExecutionContractSource" in executionContractApi).toBe(false);
    expect("defineExecutionContract" in executionContractApi).toBe(false);
    expect("parseExecutionContractSource" in executionContractApi).toBe(false);
    expect("validateExecutionContractSource" in executionContractApi).toBe(
      false,
    );
    expect("fail" in executionContractApi).toBe(false);
  });
});

// @ts-expect-error A raw string has not crossed the FactId validation boundary.
const rawFactId: FactId = "raw";
void rawFactId;

const invalidParameterSubject: SemanticSubject = {
  kind: "parameter",
  exportName: "run",
  // @ts-expect-error Parameter indexes are numbers.
  index: "0",
  path: [],
};
void invalidParameterSubject;

const subjectWithExtraField: SemanticSubject = {
  kind: "module-evaluation",
  // @ts-expect-error Closed subject variants reject extra fields.
  exportName: "run",
};
void subjectWithExtraField;

// @ts-expect-error A callback location requires its parameter-local path.
const callbackWithoutPath: SemanticSubject = {
  kind: "callback-invocation",
  exportName: "subscribe",
  parameterIndex: 0,
};
void callbackWithoutPath;
