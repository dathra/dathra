declare const factIdBrand: unique symbol;

/** A source-contract-local semantic fact identifier. */
type FactId = string & { readonly [factIdBrand]: true };

/** A property or array index in an execution contract failure path. */
type ExecutionContractPathSegment = string | number;

/** An immutable path from the contract root to a value. */
type ValidationPath = readonly ExecutionContractPathSegment[];

/** Stable failure codes emitted by source execution contract operations. */
type ExecutionContractErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-fact-id"
  | "invalid-registry-id"
  | "noncanonical-order"
  | "duplicate-record"
  | "dangling-reference"
  | "kind-mismatch"
  | "version-mismatch"
  | "semantic-mismatch"
  | "budget-exceeded"
  | "crypto-unavailable";

/** Describes why a source execution contract operation failed. */
class ExecutionContractError extends TypeError {
  readonly code: ExecutionContractErrorCode;
  readonly path: readonly ExecutionContractPathSegment[];

  /** Creates an immutable execution contract failure. */
  constructor(
    code: ExecutionContractErrorCode,
    path: ValidationPath,
    message: string,
  ) {
    super(message);
    this.name = "ExecutionContractError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

function formatPath(path: ValidationPath): string {
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : `${result}[${JSON.stringify(segment)}]`,
    "$",
  );
}

/** Throws an immutable execution contract error at a stable path. */
function fail(
  code: ExecutionContractErrorCode,
  path: ValidationPath,
  detail: string,
): never {
  throw new ExecutionContractError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

/** Returns whether a string contains no lone UTF-16 surrogate. */
function isValidUnicode(value: string): boolean {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);
    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) return false;
      index += 1;
      continue;
    }
    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) return false;
  }
  return true;
}

/** Creates a validated source-local fact identifier without normalization. */
function factId(value: string): FactId {
  if (
    typeof value !== "string" ||
    value.length === 0 ||
    !isValidUnicode(value)
  ) {
    fail("invalid-fact-id", [], "Expected a non-empty valid Unicode FactId");
  }
  return value as FactId;
}

export { ExecutionContractError, factId, fail, isValidUnicode };
export type {
  ExecutionContractErrorCode,
  ExecutionContractPathSegment,
  FactId,
  ValidationPath,
};
