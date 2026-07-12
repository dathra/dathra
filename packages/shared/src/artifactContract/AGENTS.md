# artifactContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the artifact address, finalization template, and entry binding type contracts
2. [implementation.test.ts](./implementation.test.ts) - Contains the required exact type, facade, and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory currently owns only the package-local, type-only `ArtifactAddressId` nominal subtype, `ArtifactFinalizationTemplate` closed product, `ArtifactEntryRole` union, and `ArtifactEntryBinding` closed product. It does not own dependency or export bindings, an artifact address preimage aggregate, validator, identity operation, creator, parser, guard, cast, URL, integrity record, artifact closure, or SC01 migration.

`implementation.ts` is the package-local facade. Keep the private address brand in `model.ts`, the finalization template in `finalizationTemplateModel.ts`, and the entry role and binding in `entryBindingModel.ts`. Export all four only as types. AS01 owns publication from the shared package root.
