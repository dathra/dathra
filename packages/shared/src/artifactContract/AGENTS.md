# artifactContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the artifact address nominal domain contract
2. [implementation.test.ts](./implementation.test.ts) - Contains the required type and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory owns only the package-local, type-only `ArtifactAddressId` nominal subtype. It does not own an artifact address preimage, validator, creator, parser, guard, URL, integrity record, artifact closure, or SC01 migration.

`implementation.ts` is the package-local facade. Keep the private brand in a focused internal model and do not expose this API from the shared package root before AS01.
