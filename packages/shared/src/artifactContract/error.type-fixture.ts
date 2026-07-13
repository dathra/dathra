import type {
  // @ts-expect-error AS01 owns artifact contract root publication.
  ArtifactContractError as _RootErrorMustNotExist,
  // @ts-expect-error AS01 owns artifact contract root publication.
  ArtifactContractErrorCode as _RootErrorCodeMustNotExist,
  // @ts-expect-error Internal failure helpers are not root APIs.
  ArtifactContractPath as _RootPathMustNotExist,
  // @ts-expect-error Internal failure helpers are not root APIs.
  fail as _RootFailMustNotExist,
} from "../index";
import type {
  ArtifactContractError,
  ArtifactContractErrorCode,
  // @ts-expect-error Failure construction stays internal to the error module.
  fail as _FacadeFailMustNotExist,
  // @ts-expect-error The accepted contract keeps the path type inline.
  ArtifactContractPath as _FacadePathMustNotExist,
  // @ts-expect-error The accepted contract keeps path segments inline.
  ArtifactContractPathSegment as _FacadePathSegmentMustNotExist,
  // @ts-expect-error Path formatting is not a facade API.
  formatPath as _FacadeFormatterMustNotExist,
  // @ts-expect-error AR01-B owns budgets.
  ArtifactContractBudget as _FacadeBudgetMustNotExist,
  // @ts-expect-error AR01-B owns ledgers.
  ArtifactContractLedger as _FacadeLedgerMustNotExist,
  // @ts-expect-error Snapshot revisions own snapshot APIs.
  ArtifactContractSnapshot as _FacadeSnapshotMustNotExist,
  // @ts-expect-error A later revision owns parsing.
  parseArtifactContract as _FacadeParserMustNotExist,
  // @ts-expect-error A later revision owns validation.
  validateArtifactContract as _FacadeValidatorMustNotExist,
  // @ts-expect-error Operation specifications own failure precedence.
  ArtifactContractFailurePrecedence as _FacadePrecedenceMustNotExist,
  // @ts-expect-error A later resource revision owns canonical metering.
  ArtifactCanonicalMeter as _FacadeMeterMustNotExist,
  // @ts-expect-error A later revision owns digest operations.
  digestArtifactContract as _FacadeDigestMustNotExist,
  // @ts-expect-error A later revision owns artifact URLs.
  artifactUrl as _FacadeUrlMustNotExist,
  // @ts-expect-error A later revision owns artifact closure.
  ArtifactClosure as _FacadeClosureMustNotExist,
} from "./implementation";

type ExpectedArtifactContractErrorCode =
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

type IsNever<Value> = [Value] extends [never] ? true : false;
type IsAssignable<Source, Target> = [Source] extends [Target] ? true : false;
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <
        Value,
      >() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type OptionalKeys<Value> = {
  [Key in keyof Value]-?: object extends Pick<Value, Key> ? Key : never;
}[keyof Value];
type ReadonlyKeys<Value> = {
  [Key in keyof Value]-?: Equal<
    Pick<Value, Key>,
    Readonly<Pick<Value, Key>>
  > extends true
    ? Key
    : never;
}[keyof Value];
type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;

type ErrorCodeIsExact = ExpectTrue<
  Equal<ArtifactContractErrorCode, ExpectedArtifactContractErrorCode>
>;
type ExpectedCodeIsExact = ExpectTrue<
  Equal<ExpectedArtifactContractErrorCode, ArtifactContractErrorCode>
>;
type ErrorCodeIsNotNever = ExpectFalse<IsNever<ArtifactContractErrorCode>>;
type UnsupportedCodesAreRejected = readonly [
  ExpectFalse<IsAssignable<"digest-mismatch", ArtifactContractErrorCode>>,
  ExpectFalse<IsAssignable<"integrity-mismatch", ArtifactContractErrorCode>>,
  ExpectFalse<IsAssignable<"authentication-failed", ArtifactContractErrorCode>>,
  ExpectFalse<IsAssignable<"fallback", ArtifactContractErrorCode>>,
];

type ErrorFields = Pick<ArtifactContractError, "code" | "path">;
type ErrorFieldsAreRequired = ExpectTrue<
  Equal<OptionalKeys<ErrorFields>, never>
>;
type ErrorFieldsAreReadonly = ExpectTrue<
  Equal<ReadonlyKeys<ErrorFields>, "code" | "path">
>;
type ErrorCodeFieldIsExact = ExpectTrue<
  Equal<ArtifactContractError["code"], ArtifactContractErrorCode>
>;
type ErrorPathFieldIsExact = ExpectTrue<
  Equal<ArtifactContractError["path"], readonly (string | number)[]>
>;
type ErrorExtendsTypeError = ExpectTrue<
  IsAssignable<ArtifactContractError, TypeError>
>;
type ErrorConstructorIsExact = ExpectTrue<
  Equal<
    ConstructorParameters<typeof ArtifactContractError>,
    [
      code: ArtifactContractErrorCode,
      path: readonly (string | number)[],
      message: string,
    ]
  >
>;
type ErrorConstructorReturnsExactInstance = ExpectTrue<
  Equal<InstanceType<typeof ArtifactContractError>, ArtifactContractError>
>;

/** Compile-time evidence for the artifact contract error boundary. */
type ArtifactContractErrorTypeFixture = readonly [
  ErrorCodeIsExact,
  ExpectedCodeIsExact,
  ErrorCodeIsNotNever,
  UnsupportedCodesAreRejected,
  ErrorFieldsAreRequired,
  ErrorFieldsAreReadonly,
  ErrorCodeFieldIsExact,
  ErrorPathFieldIsExact,
  ErrorExtendsTypeError,
  ErrorConstructorIsExact,
  ErrorConstructorReturnsExactInstance,
];

export type { ArtifactContractErrorTypeFixture };
