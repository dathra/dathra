---
name: manage-github-issue-work
description: "Keep Dathomir repository work anchored to GitHub Issues as the canonical task record. Use at lifecycle boundaries: before state-changing repository or GitHub work to resolve or create the owning Issue; when resuming work across sessions; when scope, dependencies, blockers, or material progress change; when publishing a pull request; and after merge to verify completion. This skill manages Issue metadata and linkage, not technical planning, implementation, testing strategy, model selection, or subagent orchestration. Do not create an Issue for a one-shot read-only explanation, inspection, or status answer unless the user explicitly asks to track it."
---

# Manage GitHub Issue Work

## Keep one canonical record

Treat the owning GitHub Issue as the canonical record for task scope, hierarchy, dependencies, progress, and completion.

Treat `.github/ISSUE_TEMPLATE/*.yml` as the canonical schema for Issue bodies. Do not maintain a competing local task ledger. Use local documents only as specifications, evidence, or generated artifacts linked from an Issue.

Complete Issue admission before making other repository or GitHub state changes. Creating or repairing the owning Issue is the admission step. If GitHub access is unavailable, report the blocker instead of starting untracked work.

## Admit work

1. Resolve an explicit Issue from the user request, current branch, current pull request, or linked parent.
2. Reuse it without a broad duplicate search when its outcome and acceptance boundary match the requested work.
3. Search open and closed Issues when the owner is unclear or before creating a new Issue.
4. Create the smallest Issue that owns a concrete write task when no matching Issue exists.
5. Ask which outcome to pursue only when the user has not selected a concrete task and no matching Issue exists.
6. After the work branch exists, record its name, base branch, and starting revision in one Issue comment.

Skip Issue admission for a one-shot read-only explanation, inspection, review, or status answer that needs no continuity and changes no state. Create or reuse an Issue when the user explicitly requests tracking.

Do not create a duplicate merely because wording differs. Create a follow-up Issue when the requested outcome or acceptance boundary materially expands beyond the current contract.

## Use the repository Issue types

Use exactly one repository Issue Form for the selected type:

- `initiative.yml`: A broad outcome requiring multiple independently completable Epics.
- `epic.yml`: One coherent outcome composed of Proposals, Features, Tasks, or narrower outcome Epics.
- `proposal.yml`: One design, product, or support decision without production implementation.
- `feature.yml`: One usable capability including its specification, tests, implementation, and integration evidence.
- `task.yml`: One bounded implementation-support, migration, validation, documentation, or maintenance activity.
- `bug.yml`: Unexpected behavior that violates an existing specification or accepted expectation.

Do not add roadmap IDs or ordering prefixes to titles. Use a concise outcome-oriented title.

Read the selected form completely only when creating an Issue, changing its type, or repairing its body. When using an API, reproduce the form semantics:

1. Apply its top-level type, labels, assignees, and title defaults.
2. Populate every required non-markdown field.
3. Render fields in form order with their labels as Markdown headings.
4. Omit empty optional fields.
5. Preserve the requested language; default Dathomir Issue prose to Japanese while keeping technical identifiers exact.

Reject an Issue body that leaves any required field empty.

Use a half-width space after a complete Issue reference when prose follows: write `#103 のPhase 1`, not `#103のPhase 1`.

## Maintain relationships and fields

Configure native GitHub relationships in addition to body references:

- Attach a child to the referenced parent Issue.
- Use `None` only when no coherent roadmap owner exists.
- Do not create an Initiative solely to contain one isolated leaf Issue.
- Add every declared blocked-by dependency natively.
- Keep native child order aligned with execution order when order matters.

Set organization Issue fields when creating or repairing an Issue:

- Proposal: Set `Proposal Progress` to `Not yet` initially.
- Initiative, Epic, Feature, Task, and Bug: Infer `Priority` from product impact and sequencing pressure. Infer `Effort` from the accepted scope rather than the number of files. Use `Medium` only when genuinely unknown.

Move `Proposal Progress` only when evidence supports the transition: `Proposed` when a concrete option is ready, `In Progress` while evaluating it, `Accepted` or `Rejected` when decided, `Interruption` when explicitly paused, and `Superseded` or `Deprecated` when replaced or retired.

## Keep the current contract readable

Treat the Issue body as the current contract and comments as chronological state transitions.

- For a method change that preserves the outcome and acceptance boundary, update the body once and add one comment identifying the superseded method.
- For a materially different outcome or acceptance boundary, create a follow-up Issue.
- For ordinary progress, leave the body unchanged.

Comment only when state materially changes:

- work starts and the branch, base, and revision become known;
- scope, dependencies, blockers, or an accepted decision changes;
- a pull request is published or final evidence becomes available.

Keep comments concise. Do not repeat unchanged status, paste noisy logs, or record every command and checkpoint. When resuming, read the current body, the latest relevant state-transition comments, and the linked pull request instead of replaying the full history.

## Hand off technical execution

Use the Issue outcome, acceptance criteria, dependencies, and non-goals as the authorization boundary.

Perform technical planning, implementation, branching, testing, review, and delegation according to the user's instructions, the repository `AGENTS.md`, and any applicable specialist skills. Do not define or select those methods in this skill.

Return to this skill only when the Issue lifecycle state changes or work is ready to publish or complete.

## Publish and complete work

Before publishing, confirm that the result and available validation evidence satisfy the Issue contract and that no unrelated work is included.

1. Push the task branch and open a Draft PR against the intended base.
2. Assign every PR to `takuma-ru`.
3. Link the completing leaf Issue with `Closes #N`.
4. Link parent or related Issues with `Relates to #N`; do not close an Epic or Initiative from a leaf PR.
5. Add one Issue comment containing the PR URL, commit, and concise validation summary.

Keep implementation Issues open until the completing PR merges. Close a Proposal only after its decision and rationale are recorded and `Proposal Progress` is final. Close an Epic or Initiative only after required children are complete and deferred or not-planned children have an explicit disposition.

Do not declare completion when required evidence is missing, the PR is absent, the remote branch is stale, or the worktree contains unfinished changes.

## Verify canonical state

After a logical batch of ordinary Issue or PR mutations, re-read the resulting GitHub state. Verify critical repository-policy mutations immediately. Do not re-read after every individual field or comment mutation when the batch can be verified safely as a whole.

Before handoff, verify only the state relevant to the task:

- Issue type, required body fields, organization fields, and native relationships;
- current contract, latest material progress, and PR linkage;
- PR base, Draft state when applicable, `takuma-ru` assignment, and completion reference;
- required validation evidence and completion state;
- local worktree, local revision, tracking branch, and remote revision when local work was performed.

Use any GitHub access path that exposes the required semantics. Prefer one access path for a coherent mutation batch and use another only for unsupported data or final cross-checks.
