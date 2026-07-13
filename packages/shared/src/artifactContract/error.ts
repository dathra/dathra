/** Stable failure codes reserved by artifact contract operations. */
type ArtifactContractErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-url"
  | "noncanonical-order"
  | "duplicate-record"
  | "dangling-reference"
  | "kind-mismatch"
  | "semantic-mismatch"
  | "budget-exceeded"
  | "crypto-unavailable";

/** An immutable failure raised by artifact contract operations. */
class ArtifactContractError extends TypeError {
  readonly code: ArtifactContractErrorCode;
  readonly path: readonly (string | number)[];

  /** Creates an error with an immutable snapshot of its input-relative path. */
  constructor(
    code: ArtifactContractErrorCode,
    path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
    this.name = "ArtifactContractError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

function formatPath(path: readonly (string | number)[]): string {
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : `${result}[${JSON.stringify(segment)}]`,
    "$",
  );
}

/** Throws an immutable artifact contract error at an input-relative path. */
function fail(
  code: ArtifactContractErrorCode,
  path: readonly (string | number)[],
  detail: string,
): never {
  throw new ArtifactContractError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

export { ArtifactContractError, fail };
export type { ArtifactContractErrorCode };
