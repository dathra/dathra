import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type {
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderBodyReferenceClaim as _RootBodyClaimMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderDefinition as _RootDefinitionMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderDefinitionError as _RootErrorMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderDefinitionErrorCode as _RootErrorCodeMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderDefinitionId as _RootIdMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderDefinitionInput as _RootInputMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderDefinitionPreimage as _RootPreimageMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderExposureReferenceClaim as _RootExposureClaimMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderObservationReferenceClaim as _RootObservationClaimMustNotExist,
  // @ts-expect-error Render contract publication belongs to AS01.
  RenderResponseReferenceClaim as _RootResponseClaimMustNotExist,
} from "../index";
import type {
  // @ts-expect-error Accepted definition belongs to a later closure unit.
  AcceptedRenderDefinition as _AcceptedDefinitionMustNotExist,
  // @ts-expect-error Brand creation belongs to DI3.
  createRenderDefinition as _CreateDefinitionMustNotExist,
  // @ts-expect-error A lexical guard cannot establish definition identity.
  isRenderDefinitionId as _IdGuardMustNotExist,
  // @ts-expect-error A lexical parser cannot establish definition identity.
  parseRenderDefinitionId as _IdParserMustNotExist,
  // @ts-expect-error Verified record parsing belongs to DI3.
  parseRenderDefinition as _ParseDefinitionMustNotExist,
  // @ts-expect-error A lexical cast cannot establish definition identity.
  renderDefinitionId as _IdCastMustNotExist,
  RenderBodyReferenceClaim,
  RenderDefinitionError,
  RenderDefinitionErrorCode,
  RenderDefinitionId,
  RenderExposureReferenceClaim,
  RenderObservationReferenceClaim,
  RenderResponseReferenceClaim,
} from "./implementation";

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

type IdIsNotNever = ExpectFalse<IsNever<RenderDefinitionId>>;
type IdExtendsDigest = ExpectTrue<
  IsAssignable<RenderDefinitionId, Sha256Digest>
>;
type IdExtendsString = ExpectTrue<IsAssignable<RenderDefinitionId, string>>;
type DigestDoesNotExtendId = ExpectFalse<
  IsAssignable<Sha256Digest, RenderDefinitionId>
>;
type StringDoesNotExtendId = ExpectFalse<
  IsAssignable<string, RenderDefinitionId>
>;

type ClaimsArePairwiseDistinct = readonly [
  ExpectFalse<
    IsAssignable<RenderObservationReferenceClaim, RenderResponseReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderObservationReferenceClaim, RenderBodyReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderObservationReferenceClaim, RenderExposureReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderResponseReferenceClaim, RenderObservationReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderResponseReferenceClaim, RenderBodyReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderResponseReferenceClaim, RenderExposureReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderBodyReferenceClaim, RenderObservationReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderBodyReferenceClaim, RenderResponseReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderBodyReferenceClaim, RenderExposureReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderExposureReferenceClaim, RenderObservationReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderExposureReferenceClaim, RenderResponseReferenceClaim>
  >,
  ExpectFalse<
    IsAssignable<RenderExposureReferenceClaim, RenderBodyReferenceClaim>
  >,
];

type RenderDefinitionErrorFields = Pick<RenderDefinitionError, "code" | "path">;
type ErrorFieldsAreRequired = ExpectTrue<
  Equal<OptionalKeys<RenderDefinitionErrorFields>, never>
>;
type ErrorFieldsAreReadonly = ExpectTrue<
  Equal<ReadonlyKeys<RenderDefinitionErrorFields>, "code" | "path">
>;
type ErrorCodeIsExact = ExpectTrue<
  Equal<RenderDefinitionError["code"], RenderDefinitionErrorCode>
>;
type ErrorPathIsExact = ExpectTrue<
  Equal<RenderDefinitionError["path"], readonly (string | number)[]>
>;

/** Compile-time evidence for the DI1 nominal and role assignment boundaries. */
type RenderContractTypeFixture = readonly [
  IdIsNotNever,
  IdExtendsDigest,
  IdExtendsString,
  DigestDoesNotExtendId,
  StringDoesNotExtendId,
  ClaimsArePairwiseDistinct,
  ErrorFieldsAreRequired,
  ErrorFieldsAreReadonly,
  ErrorCodeIsExact,
  ErrorPathIsExact,
];

export type { RenderContractTypeFixture };
