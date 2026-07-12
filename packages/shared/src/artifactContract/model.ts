import type { Sha256Digest } from "../canonicalIdentity/implementation";

declare const artifactAddressIdBrand: unique symbol;

/** A canonical SHA-256 digest in the artifact-address identity domain. */
type ArtifactAddressId = Sha256Digest & {
  readonly [artifactAddressIdBrand]: true;
};

export type { ArtifactAddressId };
