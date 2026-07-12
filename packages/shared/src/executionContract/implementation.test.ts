import { describe, expect, expectTypeOf, it } from "vitest";

import { fail } from "./identity";
import * as executionContractApi from "./implementation";
import {
  // @ts-expect-error Trust acceptance is owned by a later verifier.
  type AcceptedExecutionContract as _AcceptedContractMustNotExist,
  // @ts-expect-error Compiled contracts are owned by SC02B.
  type CompiledExecutionContract as _CompiledContractMustNotExist,
  ExecutionContractError,
  // @ts-expect-error Validation path internals are not part of the facade.
  type ExecutionContractPathSegment as _PathSegmentMustNotExist,
  // @ts-expect-error Qualified identity is owned by SC02B and SC03.
  type QualifiedFactId as _QualifiedFactIdMustNotExist,
  factId,
  type ExecutionContractErrorCode,
  type FactId,
} from "./implementation";

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

  it("exposes only the identity boundary from the current facade", () => {
    expect(Object.keys(executionContractApi).sort()).toEqual([
      "ExecutionContractError",
      "factId",
    ]);
    expect("QualifiedFactId" in executionContractApi).toBe(false);
    expect("AcceptedExecutionContract" in executionContractApi).toBe(false);
    expect("fail" in executionContractApi).toBe(false);
  });
});

// @ts-expect-error A raw string has not crossed the FactId validation boundary.
const rawFactId: FactId = "raw";
void rawFactId;
