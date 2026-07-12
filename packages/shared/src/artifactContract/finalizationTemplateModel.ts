/** The closed set of artifact finalization decisions used as identity input. */
interface ArtifactFinalizationTemplate {
  readonly schema: "dathra.artifact-finalization/1";
  readonly textEncoding: "utf-8";
  readonly moduleFormat: "esm";
  readonly wrapper:
    | "none"
    | "runtime-registration"
    | "integration-registration";
  readonly dependencyReference:
    | "canonical-relative-url"
    | "canonical-absolute-url";
  readonly exportEmission: "sorted-named-exports";
  readonly entryInvocation: "none" | "sorted-registration-calls";
  readonly sourceSeparator: "lf-semicolon";
  readonly wasmBinding: "external-module" | "none";
  readonly dataBinding: "external-fetch" | "none";
}

export type { ArtifactFinalizationTemplate };
