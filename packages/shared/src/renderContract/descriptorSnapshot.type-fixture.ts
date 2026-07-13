import type {
  // @ts-expect-error DI2A internals are not published by the shared root.
  snapshotRenderDefinitionCreatorDescriptors as _RootCreatorMustNotExist,
  // @ts-expect-error DI2A internals are not published by the shared root.
  RenderDefinitionDescriptorSnapshot as _RootSnapshotMustNotExist,
} from "../index";
import type {
  snapshotRenderDefinitionCreatorDescriptors,
  snapshotRenderDefinitionParserDescriptors,
  RenderDefinitionDescriptorFieldSnapshot,
  RenderDefinitionDescriptorOccurrence,
  RenderDefinitionDescriptorRecordKind,
  RenderDefinitionDescriptorSnapshot,
} from "./descriptorSnapshot";
import type {
  // @ts-expect-error DI2A internals are not part of the package-local facade.
  snapshotRenderDefinitionCreatorDescriptors as _FacadeCreatorMustNotExist,
  // @ts-expect-error DI2A internals are not part of the package-local facade.
  RenderDefinitionDescriptorSnapshot as _FacadeSnapshotMustNotExist,
} from "./implementation";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type ExpectTrue<Value extends true> = Value;

type ExpectedRecordKind =
  | "creator-input"
  | "wrapper"
  | "preimage"
  | "observation-claim"
  | "response-claim"
  | "body-claim"
  | "exposure-claim";
type ExpectedFieldSnapshot =
  | { readonly key: string; readonly state: "missing" }
  | {
      readonly key: string;
      readonly state: "string";
      readonly value: string;
    }
  | { readonly key: string; readonly state: "non-string" }
  | { readonly key: string; readonly state: "object" };
type ExpectedOccurrence = {
  readonly kind: ExpectedRecordKind;
  readonly path: readonly string[];
  readonly ownKeys: readonly string[];
  readonly fields: readonly ExpectedFieldSnapshot[];
};
type ExpectedSnapshot = {
  readonly occurrences: readonly ExpectedOccurrence[];
};

type RecordKindIsExact = ExpectTrue<
  Equal<RenderDefinitionDescriptorRecordKind, ExpectedRecordKind>
>;
type FieldSnapshotIsExact = ExpectTrue<
  Equal<RenderDefinitionDescriptorFieldSnapshot, ExpectedFieldSnapshot>
>;
type OccurrenceIsExact = ExpectTrue<
  Equal<RenderDefinitionDescriptorOccurrence, ExpectedOccurrence>
>;
type SnapshotIsExact = ExpectTrue<
  Equal<RenderDefinitionDescriptorSnapshot, ExpectedSnapshot>
>;
type CreatorSignatureIsExact = ExpectTrue<
  Equal<
    typeof snapshotRenderDefinitionCreatorDescriptors,
    (value: unknown) => RenderDefinitionDescriptorSnapshot
  >
>;
type ParserSignatureIsExact = ExpectTrue<
  Equal<
    typeof snapshotRenderDefinitionParserDescriptors,
    (value: unknown) => RenderDefinitionDescriptorSnapshot
  >
>;

/** Compile-time evidence for the DI2A internal surface and publication boundary. */
type DescriptorSnapshotTypeFixture = readonly [
  RecordKindIsExact,
  FieldSnapshotIsExact,
  OccurrenceIsExact,
  SnapshotIsExact,
  CreatorSignatureIsExact,
  ParserSignatureIsExact,
];

export type { DescriptorSnapshotTypeFixture };
