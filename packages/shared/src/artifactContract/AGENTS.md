# artifactContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the artifact address, finalization template, entry binding, dependency binding, and export binding type contracts
2. [implementation.test.ts](./implementation.test.ts) - Contains the required exact type, facade, and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory currently owns only the package-local, type-only `ArtifactAddressId` nominal subtype, `ArtifactFinalizationTemplate` closed product, `ArtifactEntryRole` union, `ArtifactEntryBinding` closed product, `ArtifactDependencyBinding` closed product, and `ArtifactExportBinding` closed product. It does not own artifact dependency kind or export role aliases, an export table or aggregate, name syntax or existence checks, member-role validation, canonical ordering or duplicate constraints, an artifact address preimage aggregate, digest or address issuance, URL, integrity, trust, provenance, closure, parser, creator, guard, cast, root publication, runtime behavior, client inclusion, or SC01 migration.

`implementation.ts` is the package-local facade. Keep the private address brand in `model.ts`, the finalization template in `finalizationTemplateModel.ts`, the entry role and binding in `entryBindingModel.ts`, the dependency binding in `dependencyBindingModel.ts`, and the export binding in `exportBindingModel.ts`. Export all six only as types. AS01 owns publication from the shared package root.
