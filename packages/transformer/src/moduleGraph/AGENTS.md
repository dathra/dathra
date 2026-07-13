# Immutable Module Graph - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the specification and accepted design decisions
2. [implementation.test.ts](./implementation.test.ts) - Contains the required behavior and failure cases

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory owns only immutable module graph records, canonical identities, and exact snapshot validation. Resolution, source extraction, finite-candidate proof, fixed-point coordination, invalidation, and caching belong to the later ModuleCoordinator slice.
