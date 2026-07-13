import type { ArtifactAddressId } from "./model";

/** An artifact dependency slot and target claim used as identity input. */
interface ArtifactDependencyBinding {
  readonly slot: string;
  readonly kind:
    | "static-import"
    | "dynamic-import"
    | "wasm-import"
    | "data-reference";
  readonly targetArtifactAddressId: ArtifactAddressId;
  readonly targetExportName: string | null;
}

export type { ArtifactDependencyBinding };
