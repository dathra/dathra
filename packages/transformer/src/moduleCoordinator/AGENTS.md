# ModuleCoordinator - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the specification and accepted design decisions
2. [implementation.test.ts](./implementation.test.ts) - Contains the required behavior, race cases, and failure cases
3. [../moduleGraph/SPEC.typ](../moduleGraph/SPEC.typ) - Defines the immutable graph records produced at the completeness barrier

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory owns bundler-neutral module discovery coordination: observed adapter transactions, deterministic fixed-point closure, stage caching, incremental invalidation, and atomic snapshot publication.

Bundler hooks and artifact generation are outside this directory. They belong to later build-coordinator and artifact slices.
