---
name: dathomir-proposal-decision
description: Guide design decisions in the Dathomir repository from an issue-backed Proposal through bounded grilling, domain and module decisions, SPEC/proposal updates, validation, and PR handoff. Use when deciding or refining a Dathomir Proposal, defining server/client or module responsibilities, resolving identity/lifetime/failure contracts, superseding an Accepted ADR, or preparing a design decision for implementation.
---

# Dathomir Proposal Decision

This skill is repository-specific.
Use it to turn an ambiguous Dathomir design request into a bounded Proposal that can be reviewed, implemented later, and traced to GitHub Issues and the repository's SPEC conventions.

Do not use it for a one-shot explanation, routine implementation with an already accepted contract, or generic code review.

## Source Of Truth

Follow this record hierarchy:

- GitHub Issue: scope, hierarchy, dependencies, progress, acceptance boundary, and completion state.
- `SPEC/proposals/103-declarative-ui-execution-partitioning/{issue}.typ`: design rationale, accepted ADRs, behavior contracts, and deferred questions for the Proposal.
- Package `SPEC.typ` and `implementation.test.ts`: adopted behavior before production implementation.
- `implementation.ts`: implementation of the adopted specification, never the source of the design decision.

Do not create a competing `CONTEXT.md`, local task ledger, or generic RFC file for this workflow.
Use the Issue and Proposal path above.

Before any repository or GitHub write, load `manage-github-issue-work`, read the relevant `AGENTS.md`, and admit or reuse the owning Issue.

## Workflow

### 1. Admit The Decision

- Identify the concrete Proposal Issue from the request, current branch, current PR, or parent Issue.
- Search open and closed Issues before creating a duplicate.
- Create the smallest `Proposal` or `Task` Issue when no owner exists.
- Record the branch, base branch, and starting revision in an Issue comment before editing.
- Create a branch from the correct base.
- Do not edit the default branch directly.

If the request is only explanatory and changes no repository or GitHub state, skip Issue admission and do not create an Issue.

### 2. Gather The Decision Context

Read these sources before proposing an option:

- repository and relevant package `AGENTS.md` files
- the owning Issue and its parent, dependencies, and related Issues
- the current Proposal file, if one exists
- `SPEC/SPEC.typ` and `SPEC/functions.typ` for Typst conventions
- relevant package `SPEC.typ` and `implementation.test.ts` when the decision will be adopted by implementation
- current implementation only as evidence to compare against the specification

Inspect recent commits and the worktree.
Preserve unrelated user changes.

### 3. Classify The Decision

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

### 4. Use Available Design Skills Selectively

Use model-invoked skills when their question is present:

- `domain-modeling`: define overloaded terms, ownership nouns, identity scope, and lifecycle vocabulary.
- `codebase-design`: place behavior behind a deep module interface and choose a seam without exposing internal graphs.
- `research`: verify external standards, dependency behavior, or protocol facts that affect the decision.
- `prototype`: test a state machine, lifetime rule, or alternative interface when prose cannot distinguish the options.
- `code-review`: independently inspect the Proposal diff before publication when the decision is cross-cutting or high risk.

Apply the user-invoked `grill-with-docs` terminology and bounded-interview discipline inline.
Do not recursively invoke user-invoked skills such as `grill-with-docs`, `to-spec`, or `to-tickets`.
Apply their relevant discipline inline, or let the user invoke them separately.
Use `tdd` only after an accepted decision is transferred into an implementation scope.

### 5. Grill Only High-Impact Choices

Maintain a decision ledger in working context with this shape:

```text
Decision | status | chosen option | rationale | invariant | deferred owner
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

Do not ask the user to choose concrete serialization, attribute names, numeric thresholds, or implementation algorithms when a later Issue owns them.
Record those as deferred decisions with an owner.

Prefer a safe, reversible default for low-impact details and state the assumption explicitly.

Stop grilling when every current decision has one of `Accepted`, `Deferred`, `Non-goal`, or `Rejected`, and no unanswered question can change the current Proposal's interface, ownership, lifetime, failure, or acceptance criteria.

### 6. Record The Decision

For each accepted decision, capture:

- the decision statement
- the problem it prevents
- the selected option
- rejected alternatives and their costs
- invariants for later Proposals
- the Issue that owns deferred work

Use `#design_proposal`, `#adr`, `#behavior_spec`, and the existing `SPEC/functions.typ` conventions.

Never change the meaning of a `Status.Accepted` ADR in place.
Add a later ADR that explicitly supersedes the earlier decision, then update downstream behavior contracts to refer to the new decision.

### 7. Update The Proposal And Issue

- Keep the Proposal focused on design semantics, not production implementation.
- Keep the Issue's required form sections and acceptance boundary stable.
- Use Issue comments for branch, progress, evidence, blockers, PR, and merge updates.
- Link later Issues for artifact emission, runtime activation, reactive revisions, adapters, or implementation work.
- Keep concrete encodings and package APIs deferred until their owner has an accepted contract.

For execution-partitioning Proposals, preserve the separation among:

- stable server snapshot and client activation
- client-reactive execution
- server-owned delivery or subscription
- artifact emission and browser runtime

### 8. Validate Before Publishing

For a Proposal-only change, run the relevant Typst compile and `git diff --check`.

```bash
mise exec typst -- typst compile --root "/home/kcatt/dev/dathomir" \
  "SPEC/proposals/103-declarative-ui-execution-partitioning/{issue}.typ" \
  "/tmp/opencode/{issue}.pdf"
git diff --check
```

When package specifications, tests, or implementation change, follow the full SPEC-first workflow and run focused tests, integration tests, typecheck, and lint as applicable.

Before publication, verify that the Proposal, Issue, and diff describe the same scope and that no unresolved term or stale ADR wording remains.

### 9. Publish And Hand Off

- Commit only the intended Proposal and documentation files.
- Push the task branch and open a PR against the declared base.
- Link the leaf Issue with `Closes #N` only when merge should close it.
- Assign the PR to `takuma-ru` when the repository workflow requires it.
- Run `code-review` or request the repository's configured review automation for cross-cutting decisions.
- Address terminology and scope comments before merge.
- Do not merge until the user explicitly requests merge.
- After merge, verify PR state, merge commit, Issue state, remote branch, and worktree.

## Failure Modes To Prevent

- Endless grilling over details owned by a later Issue.
- Treating a reactive input as server-only merely because the first profile is static.
- Inferring execution responsibility by scanning arbitrary DOM structure.
- Adding a content identity when the client cannot independently verify it.
- Hiding an unsupported handoff behind click-time network fallback or legacy behavior.
- Rewriting an Accepted ADR instead of superseding it.
- Updating implementation before its SPEC and executable tests.
- Creating a second canonical record outside the Issue and Proposal.
- Declaring completion while checks, review comments, or merge evidence are missing.

## Completion Checklist

- [ ] Owning Issue and Issue type are correct.
- [ ] Branch, base, and starting revision are recorded.
- [ ] Terms, ownership, identity, lifetime, failure, and deferrals are explicit.
- [ ] Grilling stopped under the stated criteria.
- [ ] Accepted ADRs were superseded rather than silently rewritten.
- [ ] Proposal and Issue scope agree.
- [ ] Typst compile and `git diff --check` pass.
- [ ] Review comments are addressed.
- [ ] PR and Issue links are recorded.
- [ ] Merge and final repository state are verified.
