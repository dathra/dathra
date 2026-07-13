import type {
  ArtifactDependencyBinding,
  // @ts-expect-error The accepted model has no dependency kind alias.
  ArtifactDependencyKind as _ArtifactDependencyKindMustNotExist,
} from "./dependencyBindingModel";
import type { ArtifactAddressId } from "./model";

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

type ExpectedArtifactDependencyKind =
  | "static-import"
  | "dynamic-import"
  | "wasm-import"
  | "data-reference";

type ExpectedArtifactDependencyBinding = {
  readonly slot: string;
  readonly kind: ExpectedArtifactDependencyKind;
  readonly targetArtifactAddressId: ArtifactAddressId;
  readonly targetExportName: string | null;
};

type MissingFieldArtifactDependencyBinding = Omit<
  ExpectedArtifactDependencyBinding,
  "targetExportName"
>;
type ExtraFieldArtifactDependencyBinding = ExpectedArtifactDependencyBinding & {
  readonly integrity: string;
};
type OptionalFieldArtifactDependencyBinding = Omit<
  ExpectedArtifactDependencyBinding,
  "targetExportName"
> & {
  readonly targetExportName?: string | null;
};
type MutableFieldArtifactDependencyBinding = {
  -readonly [Key in keyof ExpectedArtifactDependencyBinding]: ExpectedArtifactDependencyBinding[Key];
};
type WidenedSlotArtifactDependencyBinding = Omit<
  ExpectedArtifactDependencyBinding,
  "slot"
> & {
  readonly slot: string | null;
};
type WidenedKindArtifactDependencyBinding = Omit<
  ExpectedArtifactDependencyBinding,
  "kind"
> & {
  readonly kind: ExpectedArtifactDependencyKind | "worker-import";
};
type WidenedTargetAddressArtifactDependencyBinding = Omit<
  ExpectedArtifactDependencyBinding,
  "targetArtifactAddressId"
> & {
  readonly targetArtifactAddressId: string;
};
type NonNullableTargetExportArtifactDependencyBinding = Omit<
  ExpectedArtifactDependencyBinding,
  "targetExportName"
> & {
  readonly targetExportName: string;
};

type ArtifactDependencyBindingHasExactShape = ExpectTrue<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<ExpectedArtifactDependencyBinding>
  >
>;
type ArtifactDependencyBindingHasExactKeys = ExpectTrue<
  Equal<
    keyof ArtifactDependencyBinding,
    keyof ExpectedArtifactDependencyBinding
  >
>;
type ArtifactDependencyBindingHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ArtifactDependencyBinding>, never>
>;
type ArtifactDependencyBindingHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ArtifactDependencyBinding>,
    keyof ExpectedArtifactDependencyBinding
  >
>;
type ArtifactDependencyBindingKindIsExact = ExpectTrue<
  Equal<ArtifactDependencyBinding["kind"], ExpectedArtifactDependencyKind>
>;

type MissingFieldArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<MissingFieldArtifactDependencyBinding>
  >
>;
type MissingFieldFixtureOmitsTargetExportName = ExpectTrue<
  Equal<
    keyof MissingFieldArtifactDependencyBinding,
    Exclude<keyof ExpectedArtifactDependencyBinding, "targetExportName">
  >
>;
type ExtraFieldArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<ExtraFieldArtifactDependencyBinding>
  >
>;
type ExtraFieldFixtureAddsIntegrity = ExpectTrue<
  "integrity" extends keyof ExtraFieldArtifactDependencyBinding ? true : false
>;
type OptionalFieldArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<OptionalFieldArtifactDependencyBinding>
  >
>;
type OptionalFieldFixtureMarksTargetExportNameOptional = ExpectTrue<
  Equal<
    OptionalKeys<OptionalFieldArtifactDependencyBinding>,
    "targetExportName"
  >
>;
type MutableFieldArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<MutableFieldArtifactDependencyBinding>
  >
>;
type MutableFieldFixtureHasNoReadonlyKeys = ExpectTrue<
  Equal<ReadonlyKeys<MutableFieldArtifactDependencyBinding>, never>
>;
type WidenedSlotArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<WidenedSlotArtifactDependencyBinding>
  >
>;
type WidenedSlotFixtureIncludesNull = ExpectTrue<
  null extends WidenedSlotArtifactDependencyBinding["slot"] ? true : false
>;
type WidenedKindArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<WidenedKindArtifactDependencyBinding>
  >
>;
type WidenedKindFixtureIncludesUnsupportedLiteral = ExpectTrue<
  "worker-import" extends WidenedKindArtifactDependencyBinding["kind"]
    ? true
    : false
>;
type WidenedTargetAddressArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<WidenedTargetAddressArtifactDependencyBinding>
  >
>;
type WidenedTargetAddressFixtureAcceptsPlainString = ExpectTrue<
  string extends WidenedTargetAddressArtifactDependencyBinding["targetArtifactAddressId"]
    ? true
    : false
>;
type NonNullableTargetExportArtifactDependencyBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactDependencyBinding>,
    Copy<NonNullableTargetExportArtifactDependencyBinding>
  >
>;
type NonNullableTargetExportFixtureExcludesNull = ExpectFalse<
  null extends NonNullableTargetExportArtifactDependencyBinding["targetExportName"]
    ? true
    : false
>;

type ArtifactDependencyBindingTypeFixture = readonly [
  ArtifactDependencyBindingHasExactShape,
  ArtifactDependencyBindingHasExactKeys,
  ArtifactDependencyBindingHasNoOptionalKeys,
  ArtifactDependencyBindingHasOnlyReadonlyKeys,
  ArtifactDependencyBindingKindIsExact,
  MissingFieldArtifactDependencyBindingIsRejected,
  MissingFieldFixtureOmitsTargetExportName,
  ExtraFieldArtifactDependencyBindingIsRejected,
  ExtraFieldFixtureAddsIntegrity,
  OptionalFieldArtifactDependencyBindingIsRejected,
  OptionalFieldFixtureMarksTargetExportNameOptional,
  MutableFieldArtifactDependencyBindingIsRejected,
  MutableFieldFixtureHasNoReadonlyKeys,
  WidenedSlotArtifactDependencyBindingIsRejected,
  WidenedSlotFixtureIncludesNull,
  WidenedKindArtifactDependencyBindingIsRejected,
  WidenedKindFixtureIncludesUnsupportedLiteral,
  WidenedTargetAddressArtifactDependencyBindingIsRejected,
  WidenedTargetAddressFixtureAcceptsPlainString,
  NonNullableTargetExportArtifactDependencyBindingIsRejected,
  NonNullableTargetExportFixtureExcludesNull,
];

export type { ArtifactDependencyBindingTypeFixture };
