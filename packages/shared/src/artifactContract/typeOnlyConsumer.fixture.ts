import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type {
  // @ts-expect-error Root publication belongs to AS01.
  ArtifactAddressId as _RootArtifactAddressIdMustNotExist,
} from "../index";
import type {
  ArtifactAddressId,
  // @ts-expect-error The artifact address preimage belongs to a later AR01 unit.
  ArtifactAddressPreimage as _ArtifactAddressPreimageMustNotExist,
  // @ts-expect-error Brand creation belongs to a verified identity operation.
  createArtifactAddressId as _CreateArtifactAddressIdMustNotExist,
  // @ts-expect-error A lexical guard cannot establish artifact address provenance.
  isArtifactAddressId as _IsArtifactAddressIdMustNotExist,
  // @ts-expect-error A lexical parser cannot establish artifact address provenance.
  parseArtifactAddressId as _ParseArtifactAddressIdMustNotExist,
} from "./implementation";

declare const otherNominalDigestBrand: unique symbol;

type OtherNominalDigest = Sha256Digest & {
  readonly [otherNominalDigestBrand]: true;
};

type IsNever<Value> = [Value] extends [never] ? true : false;
type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type AssignableTo<Target, Source extends Target> = Source;

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

export type { ArtifactAddressIdTypeFixture };
