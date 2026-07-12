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

Do not add caller-record inputs, reflection, canonicalization, content digests,
brand issuance, public creator or parser APIs, returned `RenderDefinition`,
facade or root exports, or publication in DI2B.
