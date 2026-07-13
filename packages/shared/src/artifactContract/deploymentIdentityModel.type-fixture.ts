import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type {
  // @ts-expect-error The accepted model has no deployment digest alias.
  DeploymentIdentityDigest as _DeploymentIdentityDigestMustNotExist,
  // @ts-expect-error The accepted model has no deployment ID brand.
  DeploymentIdentityId as _DeploymentIdentityIdMustNotExist,
  DeploymentIdentityPreimage,
  // @ts-expect-error The accepted model has no source alias.
  DeploymentIdentityPreimageSource as _DeploymentIdentityPreimageSourceMustNotExist,
} from "./deploymentIdentityModel";

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

type ExpectedDeploymentIdentityPreimage = {
  readonly schema: "dathra.deployment-identity/1";
  readonly applicationNamespaceDigest: Sha256Digest;
  readonly releaseIdentity: string;
  readonly targetEnvironmentId: string;
  readonly canonicalPublicOrigin: string;
  readonly contractNamespaceGraphDigest: Sha256Digest;
  readonly hostProfileSetDigest: Sha256Digest;
};

type ReplaceField<
  Key extends keyof ExpectedDeploymentIdentityPreimage,
  Value,
> = Omit<ExpectedDeploymentIdentityPreimage, Key> & {
  readonly [Property in Key]: Value;
};

type MissingTargetEnvironmentId = Omit<
  ExpectedDeploymentIdentityPreimage,
  "targetEnvironmentId"
>;
type ExtraArtifactBaseUrl = ExpectedDeploymentIdentityPreimage & {
  readonly artifactBaseUrl: string;
};
type OptionalCanonicalPublicOrigin = Omit<
  ExpectedDeploymentIdentityPreimage,
  "canonicalPublicOrigin"
> & {
  readonly canonicalPublicOrigin?: string;
};
type MutableDeploymentIdentityPreimage = {
  -readonly [Key in keyof ExpectedDeploymentIdentityPreimage]: ExpectedDeploymentIdentityPreimage[Key];
};
type WrongSchema = ReplaceField<"schema", "dathra.deployment-identity/2">;
type WidenedApplicationNamespaceDigest = ReplaceField<
  "applicationNamespaceDigest",
  string
>;
type WidenedReleaseIdentity = ReplaceField<"releaseIdentity", string | null>;

type DeploymentIdentityPreimageHasExactShape = ExpectTrue<
  Equal<
    Copy<DeploymentIdentityPreimage>,
    Copy<ExpectedDeploymentIdentityPreimage>
  >
>;
type DeploymentIdentityPreimageHasExactKeys = ExpectTrue<
  Equal<
    keyof DeploymentIdentityPreimage,
    keyof ExpectedDeploymentIdentityPreimage
  >
>;
type DeploymentIdentityPreimageHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<DeploymentIdentityPreimage>, never>
>;
type DeploymentIdentityPreimageHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<DeploymentIdentityPreimage>,
    keyof ExpectedDeploymentIdentityPreimage
  >
>;
type SchemaTypeIsExact = ExpectTrue<
  Equal<DeploymentIdentityPreimage["schema"], "dathra.deployment-identity/1">
>;
type ApplicationNamespaceDigestTypeIsExact = ExpectTrue<
  Equal<DeploymentIdentityPreimage["applicationNamespaceDigest"], Sha256Digest>
>;
type ReleaseIdentityTypeIsExact = ExpectTrue<
  Equal<DeploymentIdentityPreimage["releaseIdentity"], string>
>;
type TargetEnvironmentIdTypeIsExact = ExpectTrue<
  Equal<DeploymentIdentityPreimage["targetEnvironmentId"], string>
>;
type CanonicalPublicOriginTypeIsExact = ExpectTrue<
  Equal<DeploymentIdentityPreimage["canonicalPublicOrigin"], string>
>;
type ContractNamespaceGraphDigestTypeIsExact = ExpectTrue<
  Equal<
    DeploymentIdentityPreimage["contractNamespaceGraphDigest"],
    Sha256Digest
  >
>;
type HostProfileSetDigestTypeIsExact = ExpectTrue<
  Equal<DeploymentIdentityPreimage["hostProfileSetDigest"], Sha256Digest>
>;

type MissingTargetEnvironmentIdIsRejected = ExpectFalse<
  Equal<Copy<DeploymentIdentityPreimage>, Copy<MissingTargetEnvironmentId>>
>;
type MissingTargetEnvironmentIdWitness = ExpectFalse<
  "targetEnvironmentId" extends keyof MissingTargetEnvironmentId ? true : false
>;
type ExtraArtifactBaseUrlIsRejected = ExpectFalse<
  Equal<Copy<DeploymentIdentityPreimage>, Copy<ExtraArtifactBaseUrl>>
>;
type ExtraArtifactBaseUrlWitness = ExpectTrue<
  "artifactBaseUrl" extends keyof ExtraArtifactBaseUrl ? true : false
>;
type OptionalCanonicalPublicOriginIsRejected = ExpectFalse<
  Equal<Copy<DeploymentIdentityPreimage>, Copy<OptionalCanonicalPublicOrigin>>
>;
type OptionalCanonicalPublicOriginWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalCanonicalPublicOrigin>, "canonicalPublicOrigin">
>;
type MutableDeploymentIdentityPreimageIsRejected = ExpectFalse<
  Equal<
    Copy<DeploymentIdentityPreimage>,
    Copy<MutableDeploymentIdentityPreimage>
  >
>;
type MutableDeploymentIdentityPreimageWitness = ExpectTrue<
  Equal<ReadonlyKeys<MutableDeploymentIdentityPreimage>, never>
>;
type WrongSchemaIsRejected = ExpectFalse<
  Equal<Copy<DeploymentIdentityPreimage>, Copy<WrongSchema>>
>;
type WrongSchemaWitness = ExpectTrue<
  Equal<WrongSchema["schema"], "dathra.deployment-identity/2">
>;
type WidenedApplicationNamespaceDigestIsRejected = ExpectFalse<
  Equal<
    Copy<DeploymentIdentityPreimage>,
    Copy<WidenedApplicationNamespaceDigest>
  >
>;
type WidenedApplicationNamespaceDigestWitness = ExpectTrue<
  string extends WidenedApplicationNamespaceDigest["applicationNamespaceDigest"]
    ? true
    : false
>;
type PlainStringIsNotSha256Digest = ExpectFalse<
  string extends Sha256Digest ? true : false
>;
type WidenedReleaseIdentityIsRejected = ExpectFalse<
  Equal<Copy<DeploymentIdentityPreimage>, Copy<WidenedReleaseIdentity>>
>;
type WidenedReleaseIdentityWitness = ExpectTrue<
  null extends WidenedReleaseIdentity["releaseIdentity"] ? true : false
>;

type DeploymentIdentityPreimageTypeFixture = readonly [
  DeploymentIdentityPreimageHasExactShape,
  DeploymentIdentityPreimageHasExactKeys,
  DeploymentIdentityPreimageHasNoOptionalKeys,
  DeploymentIdentityPreimageHasOnlyReadonlyKeys,
  SchemaTypeIsExact,
  ApplicationNamespaceDigestTypeIsExact,
  ReleaseIdentityTypeIsExact,
  TargetEnvironmentIdTypeIsExact,
  CanonicalPublicOriginTypeIsExact,
  ContractNamespaceGraphDigestTypeIsExact,
  HostProfileSetDigestTypeIsExact,
  MissingTargetEnvironmentIdIsRejected,
  MissingTargetEnvironmentIdWitness,
  ExtraArtifactBaseUrlIsRejected,
  ExtraArtifactBaseUrlWitness,
  OptionalCanonicalPublicOriginIsRejected,
  OptionalCanonicalPublicOriginWitness,
  MutableDeploymentIdentityPreimageIsRejected,
  MutableDeploymentIdentityPreimageWitness,
  WrongSchemaIsRejected,
  WrongSchemaWitness,
  WidenedApplicationNamespaceDigestIsRejected,
  WidenedApplicationNamespaceDigestWitness,
  PlainStringIsNotSha256Digest,
  WidenedReleaseIdentityIsRejected,
  WidenedReleaseIdentityWitness,
];

export type { DeploymentIdentityPreimageTypeFixture };
