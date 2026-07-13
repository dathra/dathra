/** An artifact export-to-member role claim used as persistent identity input. */
interface ArtifactExportBinding {
  readonly exportName: string;
  readonly memberSemanticId: string;
  readonly exportRole:
    | "definition"
    | "integration-provider"
    | "runtime-bootstrap"
    | "registry-implementation"
    | "data-handle"
    | "wasm-binding";
}

export type { ArtifactExportBinding };
