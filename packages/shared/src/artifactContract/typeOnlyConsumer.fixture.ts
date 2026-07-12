import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type {
  // @ts-expect-error Root publication belongs to AS01.
  ArtifactAddressId as _RootArtifactAddressIdMustNotExist,
  // @ts-expect-error Root publication belongs to AS01.
  ArtifactFinalizationTemplate as _RootFinalizationTemplateMustNotExist,
} from "../index";
import type {
  ArtifactAddressId,
  ArtifactFinalizationTemplate,
  // @ts-expect-error Entry binding belongs to the later AR01-EB revision.
  ArtifactEntryBinding as _ArtifactEntryBindingMustNotExist,
  // @ts-expect-error Entry roles belong to the later AR01-EB revision.
  ArtifactEntryRole as _ArtifactEntryRoleMustNotExist,
  // @ts-expect-error Dependency binding belongs to the later AR01-DB revision.
  ArtifactDependencyBinding as _ArtifactDependencyBindingMustNotExist,
  // @ts-expect-error Export binding belongs to the later AR01-XB revision.
  ArtifactExportBinding as _ArtifactExportBindingMustNotExist,
  // @ts-expect-error Artifact kinds belong to the aggregate AR01-P revision.
  ArtifactKind as _ArtifactKindMustNotExist,
  // @ts-expect-error The artifact address preimage belongs to a later AR01 unit.
  ArtifactAddressPreimage as _ArtifactAddressPreimageMustNotExist,
  // @ts-expect-error The source aggregate belongs to the later AR01-P revision.
  ArtifactAddressPreimageSource as _ArtifactAddressPreimageSourceMustNotExist,
  // @ts-expect-error Artifact closure belongs to a later graph contract.
  ArtifactClosure as _ArtifactClosureMustNotExist,
  // @ts-expect-error Exact-byte integrity belongs to a later integrity contract.
  ArtifactIntegrityEntry as _ArtifactIntegrityEntryMustNotExist,
  // @ts-expect-error Artifact URL derivation belongs to a later URL contract.
  ArtifactUrl as _ArtifactUrlMustNotExist,
  // @ts-expect-error Runtime casts cannot establish artifact address provenance.
  castArtifactAddressId as _CastArtifactAddressIdMustNotExist,
  // @ts-expect-error Brand creation belongs to a verified identity operation.
  createArtifactAddressId as _CreateArtifactAddressIdMustNotExist,
  // @ts-expect-error A lexical guard cannot establish artifact address provenance.
  isArtifactAddressId as _IsArtifactAddressIdMustNotExist,
  // @ts-expect-error A lexical parser cannot establish artifact address provenance.
  parseArtifactAddressId as _ParseArtifactAddressIdMustNotExist,
  // @ts-expect-error Validation belongs to a later canonical snapshot contract.
  validateArtifactAddressPreimage as _ValidateArtifactAddressPreimageMustNotExist,
} from "./implementation";

declare const otherNominalDigestBrand: unique symbol;

type OtherNominalDigest = Sha256Digest & {
  readonly [otherNominalDigestBrand]: true;
};

type IsNever<Value> = [Value] extends [never] ? true : false;
type Copy<Value> = { [Key in keyof Value]: Value[Key] };
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
type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type AssignableTo<Target, Source extends Target> = Source;
type OptionalKeys<Value> = {
  [Key in keyof Value]-?: Record<never, never> extends Pick<Value, Key>
    ? Key
    : never;
}[keyof Value];
type ReadonlyKeys<Value> = {
  [Key in keyof Value]-?: Equal<
    Pick<Value, Key>,
    Readonly<Pick<Value, Key>>
  > extends true
    ? Key
    : never;
}[keyof Value];

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

type MissingFieldFinalizationTemplate = Omit<
  ExpectedArtifactFinalizationTemplate,
  "dataBinding"
>;
type ExtraFieldFinalizationTemplate = ExpectedArtifactFinalizationTemplate & {
  readonly integrity: "none";
};
type OptionalFieldFinalizationTemplate = Omit<
  ExpectedArtifactFinalizationTemplate,
  "dataBinding"
> & {
  readonly dataBinding?: ExpectedArtifactFinalizationTemplate["dataBinding"];
};
type MutableFieldFinalizationTemplate = {
  -readonly [Key in keyof ExpectedArtifactFinalizationTemplate]: ExpectedArtifactFinalizationTemplate[Key];
};
type WidenedFieldFinalizationTemplate = Omit<
  ExpectedArtifactFinalizationTemplate,
  "schema"
> & {
  readonly schema: string;
};

type ArtifactAddressIdIsNotNever = ExpectFalse<IsNever<ArtifactAddressId>>;
type ArtifactAddressIdExtendsSha256Digest = ExpectTrue<
  ArtifactAddressId extends Sha256Digest ? true : false
>;
type Sha256DigestDoesNotExtendArtifactAddressId = ExpectFalse<
  Sha256Digest extends ArtifactAddressId ? true : false
>;

// @ts-expect-error A plain string is not an artifact address identity.
type StringToArtifactAddressId = AssignableTo<ArtifactAddressId, string>;
type Sha256DigestToArtifactAddressId = AssignableTo<
  ArtifactAddressId,
  // @ts-expect-error A generic digest has no artifact address provenance.
  Sha256Digest
>;
type OtherNominalDigestToArtifactAddressId = AssignableTo<
  ArtifactAddressId,
  // @ts-expect-error A distinct nominal digest has no artifact address brand.
  OtherNominalDigest
>;
type ArtifactAddressIdToOtherNominalDigest = AssignableTo<
  OtherNominalDigest,
  // @ts-expect-error An artifact address has no distinct nominal digest brand.
  ArtifactAddressId
>;

type ArtifactAddressIdToSha256Digest = AssignableTo<
  Sha256Digest,
  ArtifactAddressId
>;
type ArtifactAddressIdToString = AssignableTo<string, ArtifactAddressId>;

type ArtifactAddressIdTypeFixture = readonly [
  ArtifactAddressIdIsNotNever,
  ArtifactAddressIdExtendsSha256Digest,
  Sha256DigestDoesNotExtendArtifactAddressId,
  StringToArtifactAddressId,
  Sha256DigestToArtifactAddressId,
  OtherNominalDigestToArtifactAddressId,
  ArtifactAddressIdToOtherNominalDigest,
  ArtifactAddressIdToSha256Digest,
  ArtifactAddressIdToString,
];

type ArtifactFinalizationTemplateHasExactShape = ExpectTrue<
  Equal<
    Copy<ArtifactFinalizationTemplate>,
    Copy<ExpectedArtifactFinalizationTemplate>
  >
>;
type ArtifactFinalizationTemplateHasExactKeys = ExpectTrue<
  Equal<
    keyof ArtifactFinalizationTemplate,
    keyof ExpectedArtifactFinalizationTemplate
  >
>;
type ArtifactFinalizationTemplateHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ArtifactFinalizationTemplate>, never>
>;
type ArtifactFinalizationTemplateHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ArtifactFinalizationTemplate>,
    keyof ExpectedArtifactFinalizationTemplate
  >
>;
type MissingFieldFinalizationTemplateIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactFinalizationTemplate>,
    Copy<MissingFieldFinalizationTemplate>
  >
>;
type ExtraFieldFinalizationTemplateIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactFinalizationTemplate>,
    Copy<ExtraFieldFinalizationTemplate>
  >
>;
type OptionalFieldFinalizationTemplateIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactFinalizationTemplate>,
    Copy<OptionalFieldFinalizationTemplate>
  >
>;
type MutableFieldFinalizationTemplateIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactFinalizationTemplate>,
    Copy<MutableFieldFinalizationTemplate>
  >
>;
type OptionalFieldFinalizationTemplateMarksDataBindingOptional = ExpectTrue<
  Equal<OptionalKeys<OptionalFieldFinalizationTemplate>, "dataBinding">
>;
type MutableFieldFinalizationTemplateHasNoReadonlyKeys = ExpectTrue<
  Equal<ReadonlyKeys<MutableFieldFinalizationTemplate>, never>
>;
type WidenedFieldFinalizationTemplateIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactFinalizationTemplate>,
    Copy<WidenedFieldFinalizationTemplate>
  >
>;

type ArtifactFinalizationTemplateTypeFixture = readonly [
  ArtifactFinalizationTemplateHasExactShape,
  ArtifactFinalizationTemplateHasExactKeys,
  ArtifactFinalizationTemplateHasNoOptionalKeys,
  ArtifactFinalizationTemplateHasOnlyReadonlyKeys,
  MissingFieldFinalizationTemplateIsRejected,
  ExtraFieldFinalizationTemplateIsRejected,
  OptionalFieldFinalizationTemplateIsRejected,
  MutableFieldFinalizationTemplateIsRejected,
  OptionalFieldFinalizationTemplateMarksDataBindingOptional,
  MutableFieldFinalizationTemplateHasNoReadonlyKeys,
  WidenedFieldFinalizationTemplateIsRejected,
];

export type {
  ArtifactAddressIdTypeFixture,
  ArtifactFinalizationTemplateTypeFixture,
};
