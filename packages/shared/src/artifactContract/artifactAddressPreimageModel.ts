import type { Sha256Digest } from "../canonicalIdentity/implementation";
import type { ArtifactDependencyBinding } from "./dependencyBindingModel";
import type { ArtifactEntryBinding } from "./entryBindingModel";
import type { ArtifactExportBinding } from "./exportBindingModel";
import type { ArtifactFinalizationTemplate } from "./finalizationTemplateModel";

/** Persistent identity input for one artifact address. */
interface ArtifactAddressPreimage {
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
}

export type { ArtifactAddressPreimage };
