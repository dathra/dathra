# Make The Decision

## Contents

- [Classify The Decision](#classify-the-decision)
- [Build Coverage And Ownership Map](#build-coverage-and-ownership-map)
- [Generate Options](#generate-options)
- [Compare Options](#compare-options)
- [Model State And Lifetime Decisions](#model-state-and-lifetime-decisions)
- [Use Available Design Skills Selectively](#use-available-design-skills-selectively)
- [Stress Test Options](#stress-test-options)
- [Grill Only High-Impact Choices](#grill-only-high-impact-choices)
- [Converge](#converge)
- [Separate Decision And Review Status](#separate-decision-and-review-status)

## Classify The Decision

Put every proposed statement in one of these categories:

- observable behavior
- execution ownership
- module interface and seam
- identity and association
- lifetime and cleanup
- failure and diagnostic behavior
- resource and artifact constraint
- non-goal or deferred capability

Separate the current supported profile from future profiles.
Do not reject a capability merely because the first profile does not implement it.

## Build Coverage And Ownership Map

For a Proposal decision, before drafting the Proposal, build the following map in working context:

```text
requirements.* field | candidate text | candidate.source | classification | Proposal section | status | evidence or owning Issue/deferred owner/blocking status
```

- Create exactly one row for every collected candidate in `requirements.decisionToMake`, `contextAndEvidence`, `optionsConsidered`, `decisionCriteria`, `acceptanceCriteria`, `dependencies`, and `nonGoals`. Do not collapse multiple candidates into one row.
- Preserve each candidate's `candidate.source` unchanged, including its source kind, Issue number, heading path, and line, so the map remains auditable.
- Treat a missing or empty required field as incomplete input; do not manufacture a row or claim coverage for it. Treat every `acceptanceCriteria` candidate as mandatory by default. Change that mandate only through an explicit scope change recorded in the owning Issue.
- Classify each item as observable behavior, execution ownership, module interface and seam, identity and association, lifetime and cleanup, failure and diagnostic behavior, resource and artifact constraint, or non-goal/deferred capability.
- Give every item one coverage disposition: `Satisfied`, `Deferred`, `Non-goal`, or `Rejected`. `Satisfied` describes Issue coverage in this ephemeral map; it is not ADR `Status.Accepted` or GitHub `Proposal Progress: Accepted`.
- Give every `Deferred` item an owning Issue and a blocking status. Prepare that owner and status for the controller to record in the owning Issue as canonical; let the Proposal or ADR mirror the mapping only. Do not leave a deferred item ownerless or merely implied by another paragraph.
- Do not use `Deferred` to remove a requirement listed in the owning Issue's `Decision to make` or `Acceptance criteria`. Resolve it in the current Proposal or return a scope-clarification request to the controller.
- Before returning to the controller, verify that no collected candidate is absent from the map and that every map row points to a concrete Proposal section or an explicit owning Issue owner. Keep the map in working context; do not persist it as a competing record. The controller must persist each deferred owner's relationship and blocking status in the owning Issue.

## Generate Options

For Proposal Issues only, generate options from the owning Issue's requirements, constraints, non-goals, and existing evidence. Do not let the first plausible design become the default without comparison.

- Create two or three materially different options when more than one option remains viable.
- Make options differ in behavior, ownership, identity, lifetime, failure handling, resource use, or another Issue-relevant dimension; do not present cosmetic implementation variants as separate designs.
- If the Issue's constraints leave only one viable option, record the constraints and the alternatives they rule out instead of manufacturing a strawman.
- Ensure every option addresses every current `Decision to make` item. Do not use an option's omissions to hide an unresolved requirement.
- If a requirement or constraint changes, return to `Build Coverage And Ownership Map`, update its candidate rows and provenance, and regenerate the options before comparing them.

## Compare Options

For Proposal Issues only, apply the owning Issue's `Decision criteria` and every mandatory `Acceptance criteria` item consistently to every viable option. Do not introduce a private evaluation criterion that changes the decision boundary without recording it in the Issue or asking for clarification.

Use this comparison in working context:

```text
Option | required behavior | ownership | identity | lifetime | failure | resources | reversibility | evidence | risks | unresolved question
```

- Mark whether each option satisfies every mandatory acceptance criterion and invariant.
- Separate contract mismatch from implementation cost, operational risk, and reversibility.
- Reject an option that fails a mandatory acceptance criterion or violates an invariant unless the owning Issue's scope is changed explicitly.
- Record which evidence supports each comparison. Do not treat an unsupported preference as a rationale.
- Preserve the final comparison, criterion results, and evidence provenance in the final Proposal or owning Issue summary; working context alone is not auditable evidence.

## Model State And Lifetime Decisions

When the Proposal contains interaction, async, activation, or disposal behavior, define one canonical state model and reuse its terms verbatim in ADRs, `behavior_spec` blocks, and evidence:

- entry condition and owner for every state
- permitted events and exact exit transitions
- terminality and retry/reuse policy
- listener, timer, state, source, and other owned resources
- behavior of late callbacks and events after disposal
- concurrent admission requests and the single-commit rule for one activation identity; duplicate requests must not create duplicate owners, listeners, or timers

Use the same actor set in every related section. If a decision checks a root, host, or control, the corresponding error cases, state transitions, and evidence must cover all three or explicitly state why one is outside the contract.

## Use Available Design Skills Selectively

For Proposal decisions, use model-invoked skills when their question is present:

- `domain-modeling`: define overloaded terms, ownership nouns, identity scope, and lifecycle vocabulary.
- `codebase-design`: place behavior behind a deep module interface and choose a seam without exposing internal graphs.
- `research`: verify external standards, dependency behavior, or protocol facts that affect the decision.
- `prototype`: test a state machine, lifetime rule, or alternative interface when prose cannot distinguish the options.
- `code-review`: independently inspect the Proposal diff before publication when the decision is cross-cutting or high risk.

Apply the user-invoked `grill-with-docs` terminology and bounded-interview discipline inline.
Do not recursively invoke user-invoked skills such as `grill-with-docs`, `to-spec`, or `to-tickets`.
Apply their relevant discipline inline, or let the user invoke them separately.
Use `tdd` only after an accepted decision is transferred into an implementation scope.

## Stress Test Options

For Proposal Issues only, test every viable option against scenarios derived from the Issue's acceptance criteria and the option comparison. Include only scenarios that can change the choice, and cover the following when they are in scope:

- normal success and the required observable result
- malformed, missing, or unavailable inputs
- concurrent admission, duplicate requests, retry, and partial failure
- disposal, late callbacks, stale state, and resource cleanup
- server, client, runtime, and artifact boundaries

Use this evidence matrix in working context:

```text
Scenario | option | expected behavior | observed or reasoned result | contradiction | evidence
```

Use `research` for external facts and `prototype` for state, lifetime, or interface behavior that prose cannot distinguish. A prototype or external fact supplies evidence for the comparison; it does not change the owning Issue's scope. Before convergence, copy the final scenario results and evidence references into the final Proposal or owning Issue summary; do not leave stress-test evidence only in working context.

## Grill Only High-Impact Choices

For Proposal decisions, maintain a decision ledger in working context with this shape:

```text
Decision | status | chosen option | rationale | invariant | deferred owner | blocking status
```

Ask one question at a time.
Offer two or three concrete options and state the consequence of each option.

Ask only when the answer changes one of these:

- a caller-visible behavior
- ownership or execution environment
- an interface or seam
- identity association
- lifetime or cleanup
- failure outcome
- resource or artifact guarantee

Do not ask the user to choose concrete serialization, attribute names, numeric thresholds, or implementation algorithms when an explicit later Issue owns them.
Prepare those as deferred decisions with an owner and blocking status for the controller; let the Proposal or ADR mirror them only.
Do not classify a requirement in the current owning Issue as a low-impact detail or later-Issue decision. A current Issue requirement must be resolved here or trigger an explicit Issue scope change.

Prefer a safe, reversible default for low-impact details and state the assumption explicitly.

Stop grilling when every current decision has one of `Accepted`, `Deferred`, `Non-goal`, or `Rejected`, and no unanswered question can change the current Proposal's interface, ownership, lifetime, failure, or acceptance criteria.

## Converge

Choose an option only after comparison, relevant state modeling, stress testing, and high-impact questions are complete.

- For a Proposal, record the selected option and the reason it satisfies the Issue's decision and acceptance criteria.
- For a Proposal, record every rejected option and the decisive cost, contradiction, missing guarantee, or evidence that ruled it out.
- For a Proposal, record accepted trade-offs, risks, mitigations, and remaining deferrals with their canonical owner and blocking status.
- For a Proposal, publish the final option comparison and stress-test evidence in the Proposal, then return the owning Issue summary evidence to the controller with enough provenance to audit each conclusion.
- For a Proposal, return to `Build Coverage And Ownership Map`, then `Generate Options` and `Compare Options`, when a grill answer changes a requirement or constraint.
- For a Proposal, return to `Compare Options` when a grill answer changes evidence only.
- For a Proposal, stop and ask for an Issue scope change when no option satisfies a mandatory requirement. Do not converge by silently weakening the requirement or turning it into a non-goal.

The convergence gate is satisfied only when every Issue `Decision to make` item has a selected behavior, every mandatory acceptance criterion maps to that behavior, every high-impact question is resolved or explicitly owned by a later Issue, and the decision ledger records the selected and rejected options.

## Separate Decision And Review Status

For a Proposal, keep document decision status separate from GitHub review status:

- Proposal ADR `Status.Accepted` means the Proposal has selected that design option within its decision record.
- GitHub `Proposal Progress: Proposed` means the Proposal is complete enough for review, not that the repository has finalized the decision.
- GitHub `Proposal Progress: Accepted` means review is complete, the decision is final, and the Proposal may be closed after its PR and Issue state are verified.
- Do not use an unresolved or ownerless `open_questions` item to hide a missing current decision. Mark it `Deferred` with an owner and blocking status in the owning Issue, or resolve it before using `Status.Accepted`.
