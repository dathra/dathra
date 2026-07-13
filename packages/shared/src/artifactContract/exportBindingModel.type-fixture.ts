import type {
  ArtifactExportBinding,
  // @ts-expect-error The accepted model has no export role alias.
  ArtifactExportRole as _ArtifactExportRoleMustNotExist,
} from "./exportBindingModel";

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

type ExpectedArtifactExportRole =
  | "definition"
  | "integration-provider"
  | "runtime-bootstrap"
  | "registry-implementation"
  | "data-handle"
  | "wasm-binding";

type ExpectedArtifactExportBinding = {
  readonly exportName: string;
  readonly memberSemanticId: string;
  readonly exportRole: ExpectedArtifactExportRole;
};

type MissingMemberSemanticIdArtifactExportBinding = Omit<
  ExpectedArtifactExportBinding,
  "memberSemanticId"
>;
type ExtraIntegrityArtifactExportBinding = ExpectedArtifactExportBinding & {
  readonly integrity: string;
};
type OptionalArtifactExportBinding = Omit<
  ExpectedArtifactExportBinding,
  "exportRole"
> & {
  readonly exportRole?: ExpectedArtifactExportRole;
};
type MutableArtifactExportBinding = {
  -readonly [Key in keyof ExpectedArtifactExportBinding]: ExpectedArtifactExportBinding[Key];
};
type WidenedExportNameArtifactExportBinding = Omit<
  ExpectedArtifactExportBinding,
  "exportName"
> & {
  readonly exportName: string | null;
};
type WidenedMemberSemanticIdArtifactExportBinding = Omit<
  ExpectedArtifactExportBinding,
  "memberSemanticId"
> & {
  readonly memberSemanticId: string | null;
};
type UnsupportedRoleArtifactExportBinding = Omit<
  ExpectedArtifactExportBinding,
  "exportRole"
> & {
  readonly exportRole: ExpectedArtifactExportRole | "client-export";
};

type ArtifactExportBindingHasExactShape = ExpectTrue<
  Equal<Copy<ArtifactExportBinding>, Copy<ExpectedArtifactExportBinding>>
>;
type ArtifactExportBindingHasExactKeys = ExpectTrue<
  Equal<keyof ArtifactExportBinding, keyof ExpectedArtifactExportBinding>
>;
type ArtifactExportBindingHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ArtifactExportBinding>, never>
>;
type ArtifactExportBindingHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ArtifactExportBinding>,
    keyof ExpectedArtifactExportBinding
  >
>;
type ArtifactExportBindingRoleIsExact = ExpectTrue<
  Equal<ArtifactExportBinding["exportRole"], ExpectedArtifactExportRole>
>;

type MissingMemberSemanticIdArtifactExportBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactExportBinding>,
    Copy<MissingMemberSemanticIdArtifactExportBinding>
  >
>;
type MissingMemberSemanticIdFixtureOmitsMemberSemanticId = ExpectTrue<
  Equal<
    keyof MissingMemberSemanticIdArtifactExportBinding,
    Exclude<keyof ExpectedArtifactExportBinding, "memberSemanticId">
  >
>;
type ExtraIntegrityArtifactExportBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactExportBinding>, Copy<ExtraIntegrityArtifactExportBinding>>
>;
type ExtraIntegrityFixtureAddsIntegrity = ExpectTrue<
  "integrity" extends keyof ExtraIntegrityArtifactExportBinding ? true : false
>;
type OptionalArtifactExportBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactExportBinding>, Copy<OptionalArtifactExportBinding>>
>;
type OptionalFixtureMarksExportRoleOptional = ExpectTrue<
  Equal<OptionalKeys<OptionalArtifactExportBinding>, "exportRole">
>;
type MutableArtifactExportBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactExportBinding>, Copy<MutableArtifactExportBinding>>
>;
type MutableFixtureHasNoReadonlyKeys = ExpectTrue<
  Equal<ReadonlyKeys<MutableArtifactExportBinding>, never>
>;
type WidenedExportNameArtifactExportBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactExportBinding>,
    Copy<WidenedExportNameArtifactExportBinding>
  >
>;
type WidenedExportNameFixtureIncludesNull = ExpectTrue<
  null extends WidenedExportNameArtifactExportBinding["exportName"]
    ? true
    : false
>;
type WidenedMemberSemanticIdArtifactExportBindingIsRejected = ExpectFalse<
  Equal<
    Copy<ArtifactExportBinding>,
    Copy<WidenedMemberSemanticIdArtifactExportBinding>
  >
>;
type WidenedMemberSemanticIdFixtureIncludesNull = ExpectTrue<
  null extends WidenedMemberSemanticIdArtifactExportBinding["memberSemanticId"]
    ? true
    : false
>;
type UnsupportedRoleArtifactExportBindingIsRejected = ExpectFalse<
  Equal<Copy<ArtifactExportBinding>, Copy<UnsupportedRoleArtifactExportBinding>>
>;
type UnsupportedRoleFixtureIncludesClientExport = ExpectTrue<
  "client-export" extends UnsupportedRoleArtifactExportBinding["exportRole"]
    ? true
    : false
>;
type UnsupportedRoleFixtureIsOutsideAcceptedRoleUnion = ExpectFalse<
  "client-export" extends ArtifactExportBinding["exportRole"] ? true : false
>;

type ArtifactExportBindingTypeFixture = readonly [
  ArtifactExportBindingHasExactShape,
  ArtifactExportBindingHasExactKeys,
  ArtifactExportBindingHasNoOptionalKeys,
  ArtifactExportBindingHasOnlyReadonlyKeys,
  ArtifactExportBindingRoleIsExact,
  MissingMemberSemanticIdArtifactExportBindingIsRejected,
  MissingMemberSemanticIdFixtureOmitsMemberSemanticId,
  ExtraIntegrityArtifactExportBindingIsRejected,
  ExtraIntegrityFixtureAddsIntegrity,
  OptionalArtifactExportBindingIsRejected,
  OptionalFixtureMarksExportRoleOptional,
  MutableArtifactExportBindingIsRejected,
  MutableFixtureHasNoReadonlyKeys,
  WidenedExportNameArtifactExportBindingIsRejected,
  WidenedExportNameFixtureIncludesNull,
  WidenedMemberSemanticIdArtifactExportBindingIsRejected,
  WidenedMemberSemanticIdFixtureIncludesNull,
  UnsupportedRoleArtifactExportBindingIsRejected,
  UnsupportedRoleFixtureIncludesClientExport,
  UnsupportedRoleFixtureIsOutsideAcceptedRoleUnion,
];

export type { ArtifactExportBindingTypeFixture };
