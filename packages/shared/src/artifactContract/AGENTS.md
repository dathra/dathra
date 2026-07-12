# artifactContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the artifact address, finalization template, entry binding, dependency binding, export binding, and deployment identity preimage type contracts
2. [implementation.test.ts](./implementation.test.ts) - Contains the required exact type, facade, and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory currently owns only the package-local, type-only `ArtifactAddressId` nominal subtype, `ArtifactFinalizationTemplate` closed product, `ArtifactEntryRole` union, `ArtifactEntryBinding` closed product, `ArtifactDependencyBinding` closed product, `ArtifactExportBinding` closed product, `DeploymentIdentityPreimage` closed product, and `ArtifactAddressPreimage` closed product. It does not own deployment identity aliases or brands, deployment snapshotting, validation, normalization, digest operations, artifact dependency kind, artifact kind, or export role aliases, a standalone export table, name syntax or existence checks, member-role validation, canonical ordering or duplicate constraints, address issuance, URL, integrity, trust, provenance, closure, parser, creator, guard, cast, root publication, runtime behavior, client inclusion, or SC01 migration.

`implementation.ts` is the package-local facade. Keep the private address brand in `model.ts`, the finalization template in `finalizationTemplateModel.ts`, the entry role and binding in `entryBindingModel.ts`, the dependency binding in `dependencyBindingModel.ts`, the export binding in `exportBindingModel.ts`, the deployment identity preimage in `deploymentIdentityModel.ts`, and the artifact address preimage in `artifactAddressPreimageModel.ts`. Export all eight only as types. AS01 owns publication from the shared package root.
