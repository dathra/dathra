# Acceptance evidence

Status: Provisional acceptance model; no current implementation is accepted by this document

This document records the evidence needed before any part of RFC 0001 can be described as production behavior.
It deliberately excludes the PR #80 scheduler, reviewer-count policy, branch instructions, and remote-OID workflow.

## Foundation extraction

A foundation may be extracted independently only when all of the following are true:

- its specification, tests, and implementation describe the same bounded responsibility
- it has no unresolved implementation blocker within that responsibility
- it can be validated from the current default branch without implementing a new feature
- it is likely to remain useful if later architecture details change
- it can remain internal until a production consumer fixes the public contract
- its pull request can explain and verify the change without importing adjacent unfinished work

Passing isolated tests on the original feature branch is historical evidence only.
Every extraction must rerun focused tests, package type checking, lint, formatting, and any relevant build or artifact inspection from its actual base branch.

## Vertical compiler evidence

A production compiler path must prove that:

- resolution and module observations commit into one immutable module snapshot
- source roots and dependency edges produce an ExecutionGraph through a deterministic, bounded process
- accepted analysis is tied to the exact graph, module snapshot, contracts, and analysis profile
- server/client placement follows accepted evidence rather than component names or fallback heuristics
- a diagnostic identifies the root and dependency path when no legal placement exists

## Server and client artifact evidence

Artifact inspection must prove that:

- initial UI is produced by a server artifact unless an explicit client-only contract permits otherwise
- server-only dependencies are unreachable from the client artifact closure
- static DOM is absent from the client mutation plan
- a route with no client root emits no client bootstrap and no request payload
- artifact identity, integrity, registry qualification, and environment compatibility are validated before execution

## Activation and DOM evidence

Browser and server integration tests must prove that:

- server-rendered HTML and DSD are reused without component-body replay
- listener, binding, effect, and cleanup installation occurs once for the intended generation
- activation preserves user-editable DOM state, focus, selection, scroll, and external DOM ownership according to explicit merge rules
- stale generations, late async work, duplicate events, and adopted nodes cannot mutate a newer owner generation
- pre-activation failure preserves SSR DOM while preventing future behavior and mutations

## Transfer and lifetime evidence

For every implemented materialization mechanism, tests must cover:

- success, typed failure, cancellation, disposal, retry, and late settlement
- identity and alias behavior across serialization, reconstruction, reference, subscription, and remote operation
- authority, exposure, principal, policy epoch, and environment restrictions
- reservation release, lease release, cleanup ordering, and terminal-state idempotence
- malformed payload, manifest, codec, registry, and marker rejection under explicit budgets

## ObservationContract open obligations

The source implementation validated finite, bounded trace languages, but that evidence does not establish semantics for indefinitely repeated UI events or long-lived subscriptions.
Before ObservationContract can be adopted as a general behavior contract, a successor decision and executable evidence must resolve:

- whether productive cycles remain forbidden
- how unbounded event streams are divided into sessions, windows, epochs, or prefixes
- how subscription revision, acknowledgement, resynchronization, and terminal events map into the observation language
- how composition cost is bounded for practical applications
- how a real renderer consumes source and candidate observations end to end

## Practical demonstration

At least one real component must demonstrate the full path from source analysis to delivered artifacts and browser behavior.
The historical proposal used DocCodeBlock because syntax highlighting should remain server-only while copy interaction, temporary state, timers, and cleanup require client behavior.
That migration is not part of the current extraction work and must not begin until its prerequisite contracts are admitted independently.

## Completion rule

The RFC may be promoted from provisional design only when current package specifications, executable tests, implementation, generated artifacts, and a practical vertical demonstration directly prove every adopted guarantee.
Missing or indirect evidence is incomplete, even when no failing test is known.
