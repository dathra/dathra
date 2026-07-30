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

### 1a. Create The Task Branch

Create the task branch from the fetched remote base before editing any Proposal
or skill file:

- Inspect `git status --short --branch`, the current branch, and recent commits.
- Preserve unrelated worktree changes. Do not stash, reset, or switch away from
  another agent's or the user's uncommitted work; use a separate worktree or ask
  before changing branch context when the worktree is dirty.
- Fetch the declared base from `origin/<base>`, not from a stale local base
  branch.
- Create a new outcome-oriented task branch unless an existing branch has been
  verified to have the same base, scope, and no unrelated commits.
- Use the repository branch helper `gnb` when it is available. Inspect its usage
  with `gnb -h` before creating the branch.

```bash
git fetch origin <base>
git status --short --branch
gnb -h
# Use gnb to create <branch> from origin/<base>.
git rev-parse HEAD
```

If `gnb` is unavailable, record that environment limitation in the owning Issue
comment and use the equivalent explicit command only after confirming that the
worktree is safe to switch:

```bash
git switch --create <branch> origin/<base>
```

Record the new branch, base branch, and starting revision in the owning Issue
comment before the first repository edit. Do not edit the default branch
directly.

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

### 3a. Build Coverage And Ownership Map

Before drafting the Proposal, build the following map in working context:

```text
Issue requirement | classification | Proposal section | status | evidence or deferred owner
```

- Include every Issue `検討対象`, acceptance criterion, and non-goal.
- Classify each item as observable behavior, execution ownership, module interface
  and seam, identity and association, lifetime and cleanup, failure and diagnostic
  behavior, resource and artifact constraint, or non-goal/deferred capability.
- Give every item one coverage disposition: `Satisfied`, `Deferred`, `Non-goal`,
  or `Rejected`. `Satisfied` describes Issue coverage in this ephemeral map; it
  is not ADR `Status.Accepted` or GitHub `Proposal Progress: Accepted`.
- Give every `Deferred` item an owning Issue and state whether it blocks the
  current Proposal. Do not leave a deferred item ownerless or merely implied by
  another paragraph.
- Before publication, verify that no Issue requirement is absent from the map and
  that every map row points to a concrete Proposal section or an explicit Issue
  owner. Keep the map in working context; do not persist it as a competing record.
  Persist each deferred owner's relationship and blocking status in the canonical
  Issue or Proposal; the map and decision ledger must not be the only record.

### 3b. Model State And Lifetime Decisions

When the Proposal contains interaction, async, activation, or disposal behavior,
define one canonical state model and reuse its terms verbatim in ADRs,
`behavior_spec` blocks, and evidence:

- entry condition and owner for every state
- permitted events and exact exit transitions
- terminality and retry/reuse policy
- listener, timer, state, source, and other owned resources
- behavior of late callbacks and events after disposal
- concurrent admission requests and the single-commit rule for one activation
  identity; duplicate requests must not create duplicate owners, listeners, or
  timers

Use the same actor set in every related section. If a decision checks a root,
host, or control, the corresponding error cases, state transitions, and evidence
must cover all three or explicitly state why one is outside the contract.

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

### 5a. Separate Decision And Review Status

Keep document decision status separate from GitHub review status:

- Proposal ADR `Status.Accepted` means the Proposal has selected that design
  option within its decision record.
- GitHub `Proposal Progress: Proposed` means the Proposal is complete enough for
  review, not that the repository has finalized the decision.
- GitHub `Proposal Progress: Accepted` means review is complete, the decision is
  final, and the Proposal may be closed after its PR and Issue state are verified.
- Do not use an unresolved or ownerless `open_questions` item to hide a missing
  current decision. Mark it `Deferred` with an owner, or resolve it before using
  `Status.Accepted`.

### 6. Record The Decision

For each accepted decision, capture:

- the decision statement
- the problem it prevents
- the selected option
- rejected alternatives and their costs
- invariants for later Proposals
- the Issue that owns deferred work

For each `open_questions` entry, capture its deferred owner and whether it blocks
the current Proposal in the canonical Issue or Proposal, then mirror that mapping
in the decision ledger or an adjacent ADR consequence.
The rendered `open_questions` list alone is not sufficient evidence that a
question is intentionally deferred.

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

For a Proposal-only change, run the relevant Typst compile and whitespace checks.
`git diff --check` does not inspect untracked files, so stage the intended file
before checking it. If staging is not yet appropriate, use the explicit
no-index form to inspect the output; its exit status is `1` whenever the files
differ and must not be treated as a whitespace verdict.

```bash
mise exec typst -- typst compile --root "." \
  "SPEC/proposals/103-declarative-ui-execution-partitioning/{issue}.typ" \
  "/tmp/opencode/{issue}.pdf"
git add -- "path/to/{issue}.typ"
git diff --cached --check
# For a new untracked Proposal before staging:
git diff --no-index --check /dev/null "path/to/{issue}.typ"
# After commit, check the complete base-to-head diff:
git diff --check origin/<base>...HEAD
```

When package specifications, tests, or implementation change, follow the full SPEC-first workflow and run focused tests, integration tests, typecheck, and lint as applicable.

When changing this skill, load `skill-creator` and run its bundled
`scripts/quick_validate.py` against the skill directory.

Before publication, verify all of the following:

- the coverage and ownership map has a row for every Issue requirement
- every state, error, retry rule, and owned resource appears consistently in the
  canonical state model, behavior contracts, and evidence matrix
- every `open_questions` item has a deferred owner and blocking status
- the Proposal, Issue, and diff describe the same scope and no unresolved term
  or stale ADR wording remains
- the base branch is current and the remote branch is synchronized

```bash
git fetch origin <base> <branch>
git merge-base --is-ancestor origin/<base> HEAD
git diff --stat origin/<base>...HEAD
git diff --check origin/<base>...HEAD
git status --short --branch
```

If the base branch is not an ancestor of `HEAD`, update the task branch before
opening or updating the PR. Do not report a synchronized handoff while the PR
is behind its base branch. After the first push, compare the local and remote
task head explicitly; `git status` alone is insufficient when the branch has no
upstream or when a remote update was made through GitHub.

```bash
git rev-parse HEAD
git rev-parse origin/<branch>
git diff --stat origin/<branch>...HEAD
```

### 9. Publish And Hand Off

- Commit only the intended Proposal and documentation files.
- Push the task branch and open a PR against the declared base.
- Link the PR in the owning Issue's GitHub Development section. A textual issue
  reference in the PR body is not sufficient; re-read the Issue and verify that
  the PR appears under Development.
- Use `Relates to #N` while a Proposal is review-ready or the PR is Draft. Use
  `Closes #N` only when merge should finalize the Issue and its Progress field.
- Assign the PR to `takuma-ru` when the repository workflow requires it.
- Run `code-review` or request the repository's configured review automation for cross-cutting decisions.
- After review comments arrive, fetch every review thread and conversation comment,
  number or group the requested changes, and clarify the selected scope when the
  user has not already authorized all of them.
- After applying review changes, rerun Typst, whitespace, metadata, and relevant
  repository checks; re-fetch the review threads; resolve only comments whose
  requested behavior is present in the current diff; and record the new commit
  and evidence in the Issue.
- Re-read the PR after review changes and verify its base, head, draft/state,
  mergeability, check conclusions, and remaining conversation comments. Re-read
  the owning Issue after recording the update.
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
- Defining a state or ownership rule in one Proposal section while omitting the
  same actor or transition from its error cases or evidence matrix.
- Updating implementation before its SPEC and executable tests.
- Creating a second canonical record outside the Issue and Proposal.
- Declaring completion while checks, review comments, or merge evidence are missing.

## Completion Checklist

- [ ] Owning Issue and Issue type are correct.
- [ ] Branch, base, and starting revision are recorded.
- [ ] Terms, ownership, identity, lifetime, failure, and deferrals are explicit.
- [ ] Coverage and ownership map accounts for every Issue requirement.
- [ ] Canonical state model covers entry, exit, terminality, retry, and resources.
- [ ] ADR decision status and GitHub review status are explicitly separated.
- [ ] Grilling stopped under the stated criteria.
- [ ] Accepted ADRs were superseded rather than silently rewritten.
- [ ] Proposal and Issue scope agree.
- [ ] Typst compile, tracked and untracked whitespace checks pass.
- [ ] Skill metadata validation passes when the skill changes.
- [ ] Base branch is current and the remote branch is synchronized.
- [ ] Review comments are addressed.
- [ ] Review threads and conversation comments were re-fetched and resolved or
  explicitly deferred against the current diff.
- [ ] PR state, base/head, mergeability, and CI conclusions were re-read after
  review changes.
- [ ] PR and Issue links are recorded.
- [ ] The PR appears in the owning Issue's GitHub Development section.
- [ ] Merge and final repository state are verified.
