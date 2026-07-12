# renderContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Defines the render-definition contract and slice boundaries
2. [implementation.test.ts](./implementation.test.ts) - Defines the correctness criteria

These files are authoritative and must remain aligned with the implementation.

## Current Scope

RC01-DI1 owns only the nominal ID, role-specific reference claim types,
render-definition record types, creator input type, immutable domain error, and
package-local facade.

Do not add validation, hard limits, identity operations, record freezing,
referent closure, accepted definitions, envelopes, publication, or authority in
this slice.
