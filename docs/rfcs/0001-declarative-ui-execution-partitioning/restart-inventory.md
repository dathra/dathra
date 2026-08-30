# Restart inventory

Updated: 2026-07-13

This inventory records what survived only in history after PR #79 and PR #80 were reverted.
It is a restart aid, not a statement that the listed implementation exists or passes on current `main`.

## Provenance

| Event | Revision |
| --- | --- |
| PR #80 source | `0df91caacedd36d64007c67d867d0cf6e328806a` |
| PR #80 merge | `213057d0868b69a2406ea1a2d8eec201e0d16fd3` |
| PR #80 code revert | `19a65b2edd19` via PR #93, merge `f66889b54db7` |
| PR #79 document revert | `9c6a5208b8da` via PR #95, merge `8aeff3f425c5` |

The source branch's completed-slice labels and test counts describe that historical tree only.
They do not prove the state of a later default branch or an extracted pull request.

## RFC preservation boundary

This RFC preserves only:

- the design index and `decisions/` documents from `0df91ca`
- a non-operative summary of the intended implementation outcome
- process-independent acceptance obligations
- this restart inventory

It deliberately excludes the standalone mutable progress, active-slice, blocker, scheduler, R7/R8 workflow, review-evidence, branch-authorization, milestone, and byte-identical monolith documents.
Some preserved decision bodies contain contemporaneous implementation decomposition, reviewer-role, or write-set passages intertwined with technical rationale; their caution banners classify those passages as non-operative historical context.
The excluded standalone evidence remains available from the source revision when historical investigation is necessary.

## Foundations eligible for independent extraction

### Canonical Identity

- source commits: `3816c342ce203cbf5ddf5b91c67479c03e72a163`, followed by `e42fec40210aeead036209f209e9038632421f5b`
- source path: `packages/shared/src/canonicalIdentity/`
- responsibility: side-effect-free canonical JSON, SHA-256 identity, and qualified identifiers
- disposition: extract in a dedicated pull request with specification, tests, implementation, and bounded builder
- boundary: keep package-root exports unchanged until a production consumer requires a public API
- evidence required again: focused tests, shared typecheck/lint/format, build or declaration inspection, and current-base CI

### Module Graph

- source commit: `4efc445af301512fb627af6c7d568fee5a06de0f`
- source path: `packages/transformer/src/moduleGraph/`
- responsibility: immutable, content-addressed module snapshot and resolution domain
- disposition: extract in a dedicated pull request with specification, tests, and implementation
- boundary: retain it as an internal foundation and do not change current transformer output
- evidence required again: focused tests, transformer typecheck/lint/format, build artifact inspection, and current-base CI

## Deferred implementation

| Candidate | Current disposition | Reason | Restart condition |
| --- | --- | --- | --- |
| ModuleCoordinator | Deferred | Depends on Canonical Identity and Module Graph, requires a root export in the historical test, and has no bundler/transform adapter or measured incremental-build bound | Define a representative fixture and explicit cold-time, incremental-time, and peak-memory budgets; add a minimal real adapter, keep the API internal, and demonstrate that it meets those budgets |
| ExecutionGraph | Deferred | Internal IR is bounded, but it depends on Module Graph and ObservationContract and has no source producer, accepted-analysis path, or artifact consumer | Connect one source-analysis path to server/client artifacts and rerun deep-fixture resource checks |
| Execution Registry | Deferred | Large public contract with no compiler or runtime consumer; future registry taxonomy can still change | Consume the exact catalog/projection contract from a practical compiler or runtime path without forcing a public root export |
| Execution Contract | Deferred | Depends on Execution Registry; semantic parsing, closure, source assembly, and digest work remain incomplete | Complete the minimum bounded source contract and feed it to a vertical compiler consumer |
| Artifact Contract | Deferred | Mostly type and error foundations, depends on Canonical Identity, and lacks finalization and a producer/consumer path | Generate, finalize, address, and consume one real artifact with integrity inspection |
| Render Contract | Deferred | Snapshot creator/parser exists only as a package-local foundation and no current renderer consumes it | Connect a RenderDefinition to real SSR/DSD output and validate publication and closure |
| Materialization Contract | Deferred | Independent type taxonomy exists, but it has no planner, selection behavior, or usable consumer | Use the taxonomy in an implemented planner that selects and validates a materialization mechanism |
| Observation Contract | Experimental only | The implementation accepts finite bounded trace languages and rejects productive accepting cycles; it does not prove indefinitely repeated events or long-lived subscriptions | Decide the session/window/prefix semantics, bind subscription revision and resynchronization to them, and prove them in a real render workflow |

No deferred item should be completed merely to justify extraction.
Its first production pull request should include the practical consumer and evidence named above.

## ObservationContract open proof obligations

- decide whether productive cycles remain forbidden
- define how unbounded event streams become bounded observations
- connect subscription revision, acknowledgement, resynchronization, and terminal events to the observation language
- bound composition and automata-product cost for practical applications
- prove source/candidate comparison through an actual renderer

Until those obligations are resolved, the historical ObservationContract remains design evidence rather than a production contract.

## Existing extraction history

PRs #81 through #92 were created as independent or stacked extractions during the original effort.
Their merge commits remain in Git history, but a later revert may have inverted content that entered `main` only through PR #80.
Do not infer current file state from commit ancestry alone, and do not recreate application-verification changes without comparing them to the then-current default branch.

This RFC extraction does not include application gates, review-evidence tooling, CI serialization, or transformer stress-test configuration.

## Restart order

1. Revalidate Canonical Identity and Module Graph independently on the current default branch.
2. Choose one practical vertical workflow and define the smallest required consumer chain.
3. Resolve the repeated-event and subscription semantics required by that workflow; do not promote a general ObservationContract algebra until broader evidence proves it.
4. Add or supersede package ADRs and failing tests before production implementation.
5. Connect source analysis to server and client artifacts.
6. Verify unit, integration, browser, artifact-closure, resource, and package-boundary evidence.
7. Promote only the decisions directly supported by that evidence into current specifications.

## Revalidation policy

- Never reuse test counts from `0df91ca` as current success evidence.
- Start from the latest default branch for each independent extraction.
- Rerun focused tests, package type checking, lint, formatting, and relevant builds.
- Inspect public exports and generated artifacts rather than assuming package-local code remains internal.
- Treat unknown or indirect evidence as incomplete.
