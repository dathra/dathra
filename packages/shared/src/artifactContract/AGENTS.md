# artifactContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the artifact error, artifact address, finalization template, entry binding, dependency binding, export binding, and deployment identity preimage contracts
2. [implementation.test.ts](./implementation.test.ts) and [error.test.ts](./error.test.ts) - Contain the required exact type, runtime, facade, and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory currently owns the package-local immutable `ArtifactContractError`, its exact `ArtifactContractErrorCode` union, the internal `fail` helper, and the type-only `ArtifactAddressId` nominal subtype, `ArtifactFinalizationTemplate` closed product, `ArtifactEntryRole` union, `ArtifactEntryBinding` closed product, `ArtifactDependencyBinding` closed product, `ArtifactExportBinding` closed product, `DeploymentIdentityPreimage` closed product, and `ArtifactAddressPreimage` closed product. It does not own budgets, ledgers, snapshots, validators, failure precedence, canonical meters, digest operations, deployment identity aliases or brands, artifact dependency kind, artifact kind, or export role aliases, a standalone export table, name syntax or existence checks, member-role validation, canonical ordering or duplicate constraints, address issuance, URL, integrity, trust, provenance, closure, parser, creator, guard, cast, root publication, client inclusion, runtime admission, or SC01 migration.

`implementation.ts` is the package-local facade. Export `ArtifactContractError` as its only runtime value and `ArtifactContractErrorCode` as a type from `error.ts`; keep `fail`, path formatting, and path helper aliases out of the facade. Keep the private address brand in `model.ts`, the finalization template in `finalizationTemplateModel.ts`, the entry role and binding in `entryBindingModel.ts`, the dependency binding in `dependencyBindingModel.ts`, the export binding in `exportBindingModel.ts`, the deployment identity preimage in `deploymentIdentityModel.ts`, and the artifact address preimage in `artifactAddressPreimageModel.ts`. Export those eight only as types. AS01 owns publication from the shared package root and generated root declarations.
