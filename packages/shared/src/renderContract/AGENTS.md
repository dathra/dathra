# renderContract - AI Agent Instructions

## Before Implementation

**MUST READ:**

1. [SPEC.typ](./SPEC.typ) - Defines the render-definition contract and slice boundaries
2. [implementation.test.ts](./implementation.test.ts) - Defines the correctness criteria
3. [descriptorSnapshot.test.ts](./descriptorSnapshot.test.ts) - Defines the DI2A descriptor criteria
4. [validatedSnapshot.test.ts](./validatedSnapshot.test.ts) - Defines the DI2B scalar criteria

These files are authoritative and must remain aligned with the implementation.

## Current Scope

RC01-DI1 owns the nominal ID, role-specific reference claim types,
render-definition record types, creator input type, immutable domain error, and
package-local facade.

RC01-DI2A owns the fixed record-key budgets and the package-internal descriptor
occurrence snapshot consumed by DI2B. It validates current-realm plain records
and descriptor structure without reading accessors or extra values.

RC01-DI2B owns expected-string budgets, missing and extra classification,
literals, lexical digests, and fresh immutable scalar construction from the
DI2A surface only.

RC01-DI3A owns the package-local `createRenderDefinition` facade value. It
synchronously composes DI2A and DI2B, computes exactly one canonical digest,
maps canonical identity failures into the domain error, and issues the private
ID brand only after digest success. It reuses the DI2B-frozen preimage and
freezes only a fresh returned root.

RC01-DI3B owns the package-local `parseRenderDefinition` facade value. It
synchronously composes the parser sides of DI2A and DI2B, hashes the exact
validated preimage once, compares the wrapper ID, and issues the private ID
brand and returned root only after equality succeeds. It reuses the DI2B-frozen
preimage without returning the unbranded wrapper root.

Do not add referent closure, accepted evidence, generation, envelope,
publication, authority, shared-root exports, hard-limit options, generic ID
helpers, or automatic browser/runtime placement in DI3B. DI2A and DI2B remain
package-internal and are not facade exports.
