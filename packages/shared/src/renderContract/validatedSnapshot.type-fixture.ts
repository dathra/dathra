import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type {
  // @ts-expect-error DI2B internals are not published by the shared root.
  validateRenderDefinitionCreatorSnapshot as _RootCreatorMustNotExist,
  // @ts-expect-error DI2B internals are not published by the shared root.
  validateRenderDefinitionParserSnapshot as _RootParserMustNotExist,
  // @ts-expect-error DI2B internals are not published by the shared root.
  UnbrandedRenderDefinitionSnapshot as _RootSnapshotMustNotExist,
} from "../index";
import type { RenderDefinitionDescriptorSnapshot } from "./descriptorSnapshot";
import type {
  // @ts-expect-error DI2B internals are not part of the package-local facade.
  validateRenderDefinitionCreatorSnapshot as _FacadeCreatorMustNotExist,
  // @ts-expect-error DI2B internals are not part of the package-local facade.
  validateRenderDefinitionParserSnapshot as _FacadeParserMustNotExist,
  // @ts-expect-error DI2B internals are not part of the package-local facade.
  UnbrandedRenderDefinitionSnapshot as _FacadeSnapshotMustNotExist,
  RenderDefinitionPreimage,
} from "./implementation";
import type {
  validateRenderDefinitionCreatorSnapshot,
  validateRenderDefinitionParserSnapshot,
  UnbrandedRenderDefinitionSnapshot,
} from "./validatedSnapshot";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? true
    : false;
type ExpectTrue<Value extends true> = Value;

type UnbrandedSnapshotIsExact = ExpectTrue<
  Equal<
    UnbrandedRenderDefinitionSnapshot,
    { readonly id: Sha256Digest; readonly preimage: RenderDefinitionPreimage }
  >
>;
type CreatorSignatureIsExact = ExpectTrue<
  Equal<
    typeof validateRenderDefinitionCreatorSnapshot,
    (snapshot: RenderDefinitionDescriptorSnapshot) => RenderDefinitionPreimage
  >
>;
type ParserSignatureIsExact = ExpectTrue<
  Equal<
    typeof validateRenderDefinitionParserSnapshot,
    (
      snapshot: RenderDefinitionDescriptorSnapshot,
    ) => UnbrandedRenderDefinitionSnapshot
  >
>;

/** Compile-time evidence for the DI2B internal API and publication boundary. */
type ValidatedSnapshotTypeFixture = readonly [
  UnbrandedSnapshotIsExact,
  CreatorSignatureIsExact,
  ParserSignatureIsExact,
];

export type { ValidatedSnapshotTypeFixture };
