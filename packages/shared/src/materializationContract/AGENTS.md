# materializationContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the materialization mechanism taxonomy
2. [implementation.test.ts](./implementation.test.ts) - Contains the required type and artifact boundaries

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory owns the package-local, type-only materialization mechanism taxonomy. It does not own plan steps, selection, placement, carriers, registry admission, trust, or protocol execution.

`implementation.ts` is the package-local facade. Keep the taxonomy model in a focused internal module and do not expose it from the shared package root before the integration slice.
