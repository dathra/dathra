# Validate And Hand Off

## Capture Progress And Evidence

Prepare progress, evidence, blockers, and scope changes for the controller to record in the owning Task Issue.
Keep the Issue body stable unless the scope itself changes through the repository workflow.
Do not create a second task ledger in the repository.

## Validate Before Publishing

For a Task, verify all of the following:

- the collector output has no unresolved `incomplete` group that hides Task scope or acceptance evidence
- every collected `issueRequirements.*` candidate, including `parentIssue`, has exactly one provenance-preserving coverage row
- every required Task field has an explicit disposition: `Parent issue`, `Outcome`, `Preconditions`, `Work`, `Verification`, `Acceptance criteria`, and `Non-goals`
- the `Parent issue` disposition agrees with the native parent relationship, or the mismatch is returned to the controller
- `Outcome` and `Work` map to the intended result
- `Preconditions`, `Verification`, every mandatory `Acceptance criteria` candidate, `Dependencies`, and `Non-goals` map to evidence or an explicit absence
- no new design decision remains hidden in the Task; return any such decision to the controller
- no unresolved blocker, scope change, or missing required-field evidence is hidden at handoff
- the relevant focused tests, typecheck, lint, formatting, and repository checks pass
- tracked and untracked files have no whitespace errors

When review changes are applied, rerun the checks applicable to the Task and return the new evidence to the controller.

## Hand Off Through Controller

- Give the controller the intended Task files, validation commands, results, evidence paths, and remaining risks.
- Let the controller commit only intended Task files.
- Let the controller push the work branch and open the PR.
- Link the owning Issue in the PR body according to repository policy.
- Re-read the PR and Issue after review changes.
- Do not merge until the user explicitly requests merge.
