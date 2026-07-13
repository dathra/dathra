# Execution Graph - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the canonical graph, root support, and derivation contracts
2. [implementation.test.ts](./implementation.test.ts) - Contains the required behavior and failure cases

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory owns the immutable static execution graph, cross-record validation, and deterministic nonserialized topology index. Source analysis belongs to `executionAnalysis`, semantic qualification and completeness acceptance belong to the later contract compiler, and concrete occurrences and mutable registration or subscription state belong to runtime packages.

`implementation.ts` is the package-local facade. Keep taxonomy/model definitions, canonical parsing, cross-record validation, budget accounting, and graph derivation in focused internal modules when they can be reviewed independently. Internal modules do not create separate public APIs or replace the canonical SPEC/test/facade set.
