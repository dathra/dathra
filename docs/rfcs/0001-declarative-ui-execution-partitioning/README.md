# RFC 0001: Declarative UI execution partitioning

Status: Experimental / provisional design

Implementation status: Incomplete; the PR #80 implementation was reverted

Source revision: `0df91caacedd36d64007c67d867d0cf6e328806a`

This RFC preserves the design explored by PR #80 so that the work can be resumed without repeating the original investigation.
It is not the current production specification, does not describe APIs that are necessarily available on `main`, and does not authorize implementation work.

Repository and package specifications remain authoritative:

- repo-wide boundaries and principles: [`SPEC/SPEC.typ`](../../../SPEC/SPEC.typ)
- package details and ADRs: `packages/**/SPEC.typ`
- executable behavior: `packages/**/implementation.test.ts`

When this RFC conflicts with those sources, the current specifications and executable tests take precedence, and the implementation must conform to them.
Any part adopted into production must first be transferred to the responsible package specification and tests.

## How to read the preserved decisions

The decision files retain the technical rationale and implementation decomposition recorded on the reverted PR #80 branch.
Some source bodies therefore contain historical revision names, slice boundaries, reviewer roles, ownership tables, branch operations, or write sets.
Those passages are provenance, not current instructions, progress, authorization, or evidence that the referenced files and APIs exist.

Each decision file starts with a caution banner so that a direct link cannot be mistaken for a current package specification.
Within a preserved body, a later statement that explicitly supersedes an earlier statement is the effective historical proposal.
If the latest effective statement is unclear or conflicts with the acceptance and restart documents, treat it as unresolved rather than combining multiple schema generations.

## Design documents

| ID | Responsibility | Document |
| --- | --- | --- |
| `D00` | Goal, guarantees, and terminology | [`decisions/00-overview.md`](decisions/00-overview.md) |
| `D10` | ObservationContract, constraints, canonical traces, and refinement | [`decisions/10-observation-language.md`](decisions/10-observation-language.md) |
| `D11` | ObservationContract composition and RealizationWitness | [`decisions/11-observation-composition.md`](decisions/11-observation-composition.md) |
| `D12` | ObservationContract post-audit contract | [`decisions/12-observation-audit.md`](decisions/12-observation-audit.md) |
| `D20` | Server-first legality, client artifacts, identity, and resource boundaries | [`decisions/20-server-client-legality.md`](decisions/20-server-client-legality.md) |
| `D30` | ModuleCoordinator, ExecutionGraph, roots, and edges | [`decisions/30-compiler-execution-model.md`](decisions/30-compiler-execution-model.md) |
| `D40` | Components, DOM, functions, module extraction, and capture | [`decisions/40-components-and-javascript.md`](decisions/40-components-and-javascript.md) |
| `D50` | Materialization planning, mechanisms, state, and identity | [`decisions/50-materialization-planning.md`](decisions/50-materialization-planning.md) |
| `D51` | Request graph-table payload and wire graph | [`decisions/51-graph-table-payload.md`](decisions/51-graph-table-payload.md) |
| `D52` | Definitions, artifacts, and registry manifests | [`decisions/52-registry-and-manifest.md`](decisions/52-registry-and-manifest.md) |
| `D53` | Projection manifest, loader, and BootAuthority | [`decisions/53-projection-and-boot.md`](decisions/53-projection-and-boot.md) |
| `D60` | Server rendering, RenderOperation, delivery, and streaming | [`decisions/60-server-render-and-delivery.md`](decisions/60-server-render-and-delivery.md) |
| `D70` | ClientScopeGraph, activation, DSD, and DOM reconciliation | [`decisions/70-client-scope-and-activation.md`](decisions/70-client-scope-and-activation.md) |
| `D80` | Author-facing activation, DOM ownership, and lifecycle | [`decisions/80-author-facing-api.md`](decisions/80-author-facing-api.md) |
| `D81` | Contract foundation for facts, registries, policy, and authority | [`decisions/81-contract-foundation.md`](decisions/81-contract-foundation.md) |
| `D82` | Source and compiled execution contracts | [`decisions/82-source-and-compiled-contract.md`](decisions/82-source-and-compiled-contract.md) |
| `D83` | Codecs, references, and subscriptions | [`decisions/83-codec-reference-and-subscription.md`](decisions/83-codec-reference-and-subscription.md) |
| `D84` | Remote operation protocol | [`decisions/84-remote-operation.md`](decisions/84-remote-operation.md) |
| `D85` | Contract compilation, registry qualification, and environment catalog | [`decisions/85-registry-qualification.md`](decisions/85-registry-qualification.md) |
| `D86` | Source execution contract, closed-data boundaries, and measurement | [`decisions/86-source-execution-contract.md`](decisions/86-source-execution-contract.md) |
| `D90` | Manual activation and APIs proposed for removal | [`decisions/90-manual-activation-and-removal.md`](decisions/90-manual-activation-and-removal.md) |
| `D91` | Expected DocCodeBlock partition | [`decisions/91-doc-code-block.md`](decisions/91-doc-code-block.md) |
| `D92` | Diagnostics, implementation direction, and verification | [`decisions/92-diagnostics-and-implementation.md`](decisions/92-diagnostics-and-implementation.md) |
| `D99` | Rejected alternatives | [`decisions/99-rejected-ideas.md`](decisions/99-rejected-ideas.md) |

## Restart documents

- [`implementation/goal.md`](implementation/goal.md): intended outcome, scope, and non-goals; not an active agent instruction
- [`implementation/acceptance.md`](implementation/acceptance.md): evidence required before the design can become production behavior
- [`restart-inventory.md`](restart-inventory.md): provenance, extracted foundations, deferred work, and restart conditions

## Maintenance rules

- Treat every decision in this RFC as provisional until adopted by the responsible `SPEC.typ` and tests.
- Do not infer current API availability or implementation status from this RFC.
- Do not add new branches, scheduler state, agent authorization, mutable progress, or executable workflow instructions here.
- Preserve rejected alternatives because they explain why the proposed architecture has its current shape.
- Record semantic changes as explicit successor decisions instead of silently rewriting the historical rationale.
