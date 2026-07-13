import type { Sha256Digest } from "../canonicalIdentity/implementation";

/** Persistent identity input for one deployment. */
interface DeploymentIdentityPreimage {
  readonly schema: "dathra.deployment-identity/1";
  readonly applicationNamespaceDigest: Sha256Digest;
  readonly releaseIdentity: string;
  readonly targetEnvironmentId: string;
  readonly canonicalPublicOrigin: string;
  readonly contractNamespaceGraphDigest: Sha256Digest;
  readonly hostProfileSetDigest: Sha256Digest;
}

export type { DeploymentIdentityPreimage };
