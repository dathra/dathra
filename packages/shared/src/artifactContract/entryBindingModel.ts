/** The closed set of artifact entry responsibilities used as identity input. */
type ArtifactEntryRole =
  | "runtime-entry"
  | "integration-entry"
  | "definition-entry";

/** An artifact entry identity, export, and invocation-order claim. */
interface ArtifactEntryBinding {
  readonly role: ArtifactEntryRole;
  readonly entrySemanticId: string;
  readonly exportedName: string;
  readonly invocationOrdinal: number;
}

export type { ArtifactEntryRole, ArtifactEntryBinding };
