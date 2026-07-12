import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type { ArtifactDependencyBinding } from "./dependencyBindingModel";
import type { ArtifactEntryBinding } from "./entryBindingModel";
import type { ArtifactExportBinding } from "./exportBindingModel";
import type { ArtifactFinalizationTemplate } from "./finalizationTemplateModel";
import type {
  ArtifactAddressPreimage,
  // @ts-expect-error The accepted model has no source alias.
  ArtifactAddressPreimageSource as _ArtifactAddressPreimageSourceMustNotExist,
  // @ts-expect-error The accepted model uses a direct inline kind union.
  ArtifactKind as _ArtifactKindMustNotExist,
} from "./artifactAddressPreimageModel";

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
type IsNever<Value> = [Value] extends [never] ? true : false;
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

type ExpectedArtifactAddressPreimage = {
  readonly schema: "dathra.artifact-address/1";
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly artifactBaseUrl: string;
  readonly bundlerProfileDigest: Sha256Digest;
  readonly kind: "javascript" | "wasm" | "data";
  readonly finalizationTemplate: ArtifactFinalizationTemplate;
  readonly entryBindings: readonly ArtifactEntryBinding[];
  readonly memberSemanticIds: readonly string[];
  readonly dependencyBindings: readonly ArtifactDependencyBinding[];
  readonly exportTable: readonly ArtifactExportBinding[];
};

type ReplaceField<
  Key extends keyof ExpectedArtifactAddressPreimage,
  Value,
> = Omit<ExpectedArtifactAddressPreimage, Key> & {
  readonly [Property in Key]: Value;
};

type MissingExportTable = Omit<ExpectedArtifactAddressPreimage, "exportTable">;
type ExtraIntegrity = ExpectedArtifactAddressPreimage & {
  readonly integrity: string;
};
type OptionalArtifactBaseUrl = Omit<
  ExpectedArtifactAddressPreimage,
  "artifactBaseUrl"
> & {
  readonly artifactBaseUrl?: string;
};
type MutableArtifactAddressPreimage = {
  -readonly [Key in keyof ExpectedArtifactAddressPreimage]: ExpectedArtifactAddressPreimage[Key];
};
type WrongSchema = ReplaceField<"schema", "dathra.artifact-address/2">;
type WidenedDeploymentIdentityDigest = ReplaceField<
  "deploymentIdentityDigest",
  string
>;
type WidenedKind = ReplaceField<
  "kind",
  ExpectedArtifactAddressPreimage["kind"] | "css"
>;
type MutableEntryBindings = ReplaceField<
  "entryBindings",
  ArtifactEntryBinding[]
>;

type DeferredValidationState = Omit<
  ExpectedArtifactAddressPreimage,
  | "kind"
  | "finalizationTemplate"
  | "entryBindings"
  | "memberSemanticIds"
  | "dependencyBindings"
  | "exportTable"
> & {
  readonly kind: "data";
  readonly finalizationTemplate: ArtifactFinalizationTemplate & {
    readonly wasmBinding: "external-module";
  };
  readonly entryBindings: readonly [
    ArtifactEntryBinding & {
      readonly role: "runtime-entry";
      readonly entrySemanticId: "missing-member";
      readonly invocationOrdinal: 1;
    },
    ArtifactEntryBinding & {
      readonly role: "runtime-entry";
      readonly entrySemanticId: "missing-member";
      readonly invocationOrdinal: 1;
    },
  ];
  readonly memberSemanticIds: readonly ["z", "z", "a"];
  readonly dependencyBindings: readonly [
    ArtifactDependencyBinding & {
      readonly slot: "missing-slot";
      readonly targetExportName: "missing-export";
    },
  ];
  readonly exportTable: readonly [
    ArtifactExportBinding & {
      readonly memberSemanticId: "missing-member";
      readonly exportRole: "wasm-binding";
    },
  ];
};

type EmptyCollectionsState = Omit<
  ExpectedArtifactAddressPreimage,
  "entryBindings" | "memberSemanticIds" | "dependencyBindings" | "exportTable"
> & {
  readonly entryBindings: readonly [];
  readonly memberSemanticIds: readonly [];
  readonly dependencyBindings: readonly [];
  readonly exportTable: readonly [];
};

type ArtifactAddressPreimageHasExactShape = ExpectTrue<
  Equal<Copy<ArtifactAddressPreimage>, Copy<ExpectedArtifactAddressPreimage>>
>;
type ArtifactAddressPreimageHasExactKeys = ExpectTrue<
  Equal<keyof ArtifactAddressPreimage, keyof ExpectedArtifactAddressPreimage>
>;
type ArtifactAddressPreimageHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ArtifactAddressPreimage>, never>
>;
type ArtifactAddressPreimageHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ArtifactAddressPreimage>,
    keyof ExpectedArtifactAddressPreimage
  >
>;
type ArtifactAddressPreimageKindIsExact = ExpectTrue<
  Equal<
    ArtifactAddressPreimage["kind"],
    ExpectedArtifactAddressPreimage["kind"]
  >
>;
type ArtifactAddressPreimageCollectionsAreExact = ExpectTrue<
  Equal<
    Pick<
      ArtifactAddressPreimage,
      | "entryBindings"
      | "memberSemanticIds"
      | "dependencyBindings"
      | "exportTable"
    >,
    Pick<
      ExpectedArtifactAddressPreimage,
      | "entryBindings"
      | "memberSemanticIds"
      | "dependencyBindings"
      | "exportTable"
    >
  >
>;

type MissingExportTableIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<MissingExportTable>>
>;
type ExtraIntegrityIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<ExtraIntegrity>>
>;
type OptionalArtifactBaseUrlIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<OptionalArtifactBaseUrl>>
>;
type MutableArtifactAddressPreimageIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<MutableArtifactAddressPreimage>>
>;
type WrongSchemaIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<WrongSchema>>
>;
type WidenedDeploymentIdentityDigestIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<WidenedDeploymentIdentityDigest>>
>;
type WidenedKindIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<WidenedKind>>
>;
type MutableEntryBindingsIsRejected = ExpectFalse<
  Equal<Copy<ArtifactAddressPreimage>, Copy<MutableEntryBindings>>
>;
type DeferredValidationStateIsRepresentable = ExpectTrue<
  DeferredValidationState extends ArtifactAddressPreimage ? true : false
>;
type DeferredValidationStateIsNotNever = ExpectFalse<
  IsNever<DeferredValidationState>
>;
type EmptyCollectionsStateIsRepresentable = ExpectTrue<
  EmptyCollectionsState extends ArtifactAddressPreimage ? true : false
>;
type EmptyCollectionsStateIsNotNever = ExpectFalse<
  IsNever<EmptyCollectionsState>
>;

type ArtifactAddressPreimageTypeFixture = readonly [
  ArtifactAddressPreimageHasExactShape,
  ArtifactAddressPreimageHasExactKeys,
  ArtifactAddressPreimageHasNoOptionalKeys,
  ArtifactAddressPreimageHasOnlyReadonlyKeys,
  ArtifactAddressPreimageKindIsExact,
  ArtifactAddressPreimageCollectionsAreExact,
  MissingExportTableIsRejected,
  ExtraIntegrityIsRejected,
  OptionalArtifactBaseUrlIsRejected,
  MutableArtifactAddressPreimageIsRejected,
  WrongSchemaIsRejected,
  WidenedDeploymentIdentityDigestIsRejected,
  WidenedKindIsRejected,
  MutableEntryBindingsIsRejected,
  DeferredValidationStateIsRepresentable,
  DeferredValidationStateIsNotNever,
  EmptyCollectionsStateIsRepresentable,
  EmptyCollectionsStateIsNotNever,
];

export type { ArtifactAddressPreimageTypeFixture };
