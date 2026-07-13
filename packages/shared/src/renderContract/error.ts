/** Stable failure codes reserved by the render-definition contract. */
type RenderDefinitionErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-reference"
  | "digest-mismatch"
  | "budget-exceeded"
  | "crypto-unavailable";

/** An immutable failure raised by render-definition operations. */
class RenderDefinitionError extends TypeError {
  readonly code: RenderDefinitionErrorCode;
  readonly path: readonly (string | number)[];

  /** Creates an error with an immutable snapshot of its value path. */
  constructor(
    code: RenderDefinitionErrorCode,
    path: readonly (string | number)[],
    message: string,
  ) {
    super(message);
    this.name = "RenderDefinitionError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

export { RenderDefinitionError };
export type { RenderDefinitionErrorCode };
