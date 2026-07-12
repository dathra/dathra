# executionContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Contains the source execution contract and validation contract
2. [implementation.test.ts](./implementation.test.ts) - Contains the required behavior and failure cases

These files are the source of truth for this API. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

## Scope

This directory owns the untrusted source-local execution contract schema, canonical normalization, strict parsing, local closure validation, resource budgets, and source digest. Qualified and compiled contracts belong to the later SC02B slice, while namespace qualification, module-signature validation, evidence admission, and compiler diagnostics belong to SC03.

`implementation.ts` is the package-local facade. Keep subject, fact, relation, budget accounting, canonical parsing, semantic parsing, and source closure concerns in focused internal modules.
