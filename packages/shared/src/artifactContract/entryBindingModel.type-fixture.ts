import type {
  ArtifactEntryBinding,
  ArtifactEntryRole,
} from "./entryBindingModel";

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

type ExpectedArtifactEntryRole =
  | "runtime-entry"
  | "integration-entry"
  | "definition-entry";

type ExpectedArtifactEntryBinding = {
  readonly role: ExpectedArtifactEntryRole;
  readonly entrySemanticId: string;
  readonly exportedName: string;
  readonly invocationOrdinal: number;
};

type MissingFieldArtifactEntryBinding = Omit<
  ExpectedArtifactEntryBinding,
  "exportedName"
>;
type ExtraFieldArtifactEntryBinding = ExpectedArtifactEntryBinding & {
  readonly dependencySlot: string;
};
type OptionalFieldArtifactEntryBinding = Omit<
  ExpectedArtifactEntryBinding,
  "exportedName"
> & {
  readonly exportedName?: string;
};
type MutableFieldArtifactEntryBinding = {
  -readonly [Key in keyof ExpectedArtifactEntryBinding]: ExpectedArtifactEntryBinding[Key];
};
type WidenedFieldArtifactEntryBinding = Omit<
  ExpectedArtifactEntryBinding,
  "entrySemanticId"
> & {
  readonly entrySemanticId: string | null;
};
type InvalidRoleArtifactEntryBinding = Omit<
  ExpectedArtifactEntryBinding,
  "role"
> & {
  readonly role: "worker-entry";
};
type WidenedOrdinalArtifactEntryBinding = Omit<
  ExpectedArtifactEntryBinding,
  "invocationOrdinal"
> & {
  readonly invocationOrdinal: number | null;
};

type ArtifactEntryRoleExtendsExpected = ExpectTrue<
  [ArtifactEntryRole] extends [ExpectedArtifactEntryRole] ? true : false
>;
type ExpectedExtendsArtifactEntryRole = ExpectTrue<
  [ExpectedArtifactEntryRole] extends [ArtifactEntryRole] ? true : false
>;
type ArtifactEntryBindingHasExactShape = ExpectTrue<
  Equal<Copy<ArtifactEntryBinding>, Copy<ExpectedArtifactEntryBinding>>
>;
type ArtifactEntryBindingHasExactKeys = ExpectTrue<
  Equal<keyof ArtifactEntryBinding, keyof ExpectedArtifactEntryBinding>
>;
type ArtifactEntryBindingHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ArtifactEntryBinding>, never>
>;
type ArtifactEntryBindingHasOnlyReadonlyKeys = ExpectTrue<
  Equal<ReadonlyKeys<ArtifactEntryBinding>, keyof ExpectedArtifactEntryBinding>
>;

type MissingFieldArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<MissingFieldArtifactEntryBinding>>
>;
type MissingFieldFixtureOmitsExportedName = ExpectTrue<
  Equal<
    keyof MissingFieldArtifactEntryBinding,
    Exclude<keyof ExpectedArtifactEntryBinding, "exportedName">
  >
>;
type ExtraFieldArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<ExtraFieldArtifactEntryBinding>>
>;
type ExtraFieldFixtureAddsDependencySlot = ExpectTrue<
  "dependencySlot" extends keyof ExtraFieldArtifactEntryBinding ? true : false
>;
type OptionalFieldArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<OptionalFieldArtifactEntryBinding>>
>;
type OptionalFieldFixtureMarksExportedNameOptional = ExpectTrue<
  Equal<OptionalKeys<OptionalFieldArtifactEntryBinding>, "exportedName">
>;
type MutableFieldArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<MutableFieldArtifactEntryBinding>>
>;
type MutableFieldFixtureHasNoReadonlyKeys = ExpectTrue<
  Equal<ReadonlyKeys<MutableFieldArtifactEntryBinding>, never>
>;
type WidenedFieldArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<WidenedFieldArtifactEntryBinding>>
>;
type WidenedFieldFixtureIncludesNull = ExpectTrue<
  null extends WidenedFieldArtifactEntryBinding["entrySemanticId"]
    ? true
    : false
>;
type InvalidRoleArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<InvalidRoleArtifactEntryBinding>>
>;
type InvalidRoleFixtureIsOutsideRoleUnion = ExpectFalse<
  InvalidRoleArtifactEntryBinding["role"] extends ArtifactEntryRole
    ? true
    : false
>;
type WidenedOrdinalArtifactEntryBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactEntryBinding>, Copy<WidenedOrdinalArtifactEntryBinding>>
>;
type WidenedOrdinalFixtureIncludesNull = ExpectTrue<
  null extends WidenedOrdinalArtifactEntryBinding["invocationOrdinal"]
    ? true
    : false
>;

type ArtifactEntryBindingTypeFixture = readonly [
  ArtifactEntryRoleExtendsExpected,
  ExpectedExtendsArtifactEntryRole,
  ArtifactEntryBindingHasExactShape,
  ArtifactEntryBindingHasExactKeys,
  ArtifactEntryBindingHasNoOptionalKeys,
  ArtifactEntryBindingHasOnlyReadonlyKeys,
  MissingFieldArtifactEntryBindingIsRejected,
  MissingFieldFixtureOmitsExportedName,
  ExtraFieldArtifactEntryBindingIsRejected,
  ExtraFieldFixtureAddsDependencySlot,
  OptionalFieldArtifactEntryBindingIsRejected,
  OptionalFieldFixtureMarksExportedNameOptional,
  MutableFieldArtifactEntryBindingIsRejected,
  MutableFieldFixtureHasNoReadonlyKeys,
  WidenedFieldArtifactEntryBindingIsRejected,
  WidenedFieldFixtureIncludesNull,
  InvalidRoleArtifactEntryBindingIsRejected,
  InvalidRoleFixtureIsOutsideRoleUnion,
  WidenedOrdinalArtifactEntryBindingIsRejected,
  WidenedOrdinalFixtureIncludesNull,
];

export type { ArtifactEntryBindingTypeFixture };
