# Implementation target

Status: Historical target; implementation incomplete

This document preserves the intended product outcome from PR #80.
It is not an active goal, does not authorize code changes, commits, pushes, or destructive migration, and does not override repository or package specifications.

## Intended outcome

Derive server and client execution placement from one declarative UI definition while producing server-first output and the minimum client runtime required for interaction.

The target architecture should eventually provide all of the following:

- the compiler derives placement from roots, dependencies, effects, ownership, and environment constraints
- server-only computation, packages, and resources remain outside client artifact closure
- server-rendered HTML and Declarative Shadow DOM are activated without replaying the component body
- client behavior contains only the listeners, bindings, effects, state, and cleanup required by a client root
- unsupported placement or transfer fails with a concrete dependency path instead of silently falling back to whole-component replay or rerendering
- routes without a client root emit neither a client bootstrap nor a request payload

## Scope retained by this RFC

- ModuleCoordinator and immutable module snapshots
- ExecutionGraph and root-specific reachability
- ObservationContract and its unresolved proof boundary
- cross-environment materialization planning
- artifact and render contracts
- ClientScopeGraph, activation, DSD, reconciliation, and lifecycle ownership
- author-facing activation and DOM ownership directives
- diagnostic and artifact inspection requirements

## Non-goals of this preserved document

- describing current `main` behavior
- preserving the PR #80 scheduler, review protocol, or agent workflow
- authorizing the removal of current hydration APIs
- declaring the original implementation complete
- resuming DocCodeBlock migration
- treating source-branch test results as evidence for the current repository

## Specification ownership

Adoption must follow the repository's existing ownership model:

1. repo-wide boundaries are recorded in `SPEC/SPEC.typ`
2. package details and ADRs are recorded in `packages/**/SPEC.typ`
3. behavior is made executable in the corresponding `implementation.test.ts`
4. implementation follows those specifications and tests
5. this RFC remains rationale and historical design context

Accepted ADRs must not be edited to change their meaning.
If an existing accepted decision conflicts with a future adoption, add a successor ADR that explicitly supersedes it.

## Evidence required for eventual completion

The architecture is complete only after a practical vertical workflow proves, at minimum, that:

- source analysis produces the relevant execution and module graphs
- server and client artifacts are generated from those graphs
- a real interactive component keeps server-only work out of the delivered client closure
- existing SSR DOM is activated without component-body replay
- bounded transfer, authority, cleanup, failure, and lifetime rules work across the environment boundary
- unit, integration, browser, artifact, and package-boundary checks pass on the then-current default branch

Interfaces, type-only foundations, isolated validators, and source-branch unit tests are useful foundations but are not proof of this full outcome.
