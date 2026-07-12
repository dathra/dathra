# artifactContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the artifact address, finalization template, entry binding, and dependency binding type contracts
2. [implementation.test.ts](./implementation.test.ts) - Contains the required exact type, facade, and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory currently owns only the package-local, type-only `ArtifactAddressId` nominal subtype, `ArtifactFinalizationTemplate` closed product, `ArtifactEntryRole` union, `ArtifactEntryBinding` closed product, and `ArtifactDependencyBinding` closed product. It does not own an artifact dependency kind alias, validator, target-existence check, ordering or duplicate constraint, identity issuance or operation, export binding, artifact address preimage aggregate, URL, integrity, trust, aggregate or root publication, parser, creator, guard, cast, runtime behavior, artifact closure, or SC01 migration.

`implementation.ts` is the package-local facade. Keep the private address brand in `model.ts`, the finalization template in `finalizationTemplateModel.ts`, the entry role and binding in `entryBindingModel.ts`, and the dependency binding in `dependencyBindingModel.ts`. Export all five only as types. AS01 owns publication from the shared package root.
