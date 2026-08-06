---
name: manage-github-issue-work
description: Manage all Dathomir repository work through GitHub Issues as the canonical task record, including provider-neutral delegation across subagents and model capability tiers. Use before planning or performing code, specification, documentation, configuration, CI, GitHub, or other repository changes; when resuming work across sessions; when refining Initiative/Epic/Proposal/Feature/Task/Bug hierarchies; when recording progress or blockers; and when completing work through a pull request. Do not create an Issue for a one-shot read-only explanation, inspection, or status answer unless the user explicitly asks to track it.
---

# Manage GitHub Issue Work

## Canonical records

Treat GitHub Issues as the canonical record for task scope, hierarchy, dependencies, progress, and completion.

Treat `.github/ISSUE_TEMPLATE/*.yml` as the canonical schema for Issue bodies.
Do not maintain a separate local task ledger as a competing source of truth.
Use local documents only as specifications, evidence, or generated artifacts linked from an Issue.

For any task that changes repository or GitHub state, identify or create the owning Issue before making the change.
If GitHub access is unavailable, report the blocker instead of starting untracked write work.

Skip Issue admission only for a one-shot read-only explanation, inspection, review, or status answer that needs no continuity and changes no state.
Create or reuse an Issue when the user explicitly requests tracking even for read-only work.

## Admit work before implementation

1. Read the repository `AGENTS.md` files relevant to the requested scope.
2. Resolve an explicit Issue from the user request, current branch, current PR, or linked parent.
3. Search open and closed Issues before creating anything.
4. Reuse an existing Issue when its outcome and acceptance boundary match the request.
5. If the user has not selected a concrete task and no matching Issue exists, ask which outcome to pursue.
6. If the user requested a concrete write task and no Issue exists, create the smallest Issue that owns the result.
7. Record the branch, base branch, and starting revision in an Issue comment when work begins.

Do not create a duplicate Issue merely because the wording differs.
Do not broaden an existing Issue beyond its declared outcome.
Create a follow-up Issue for newly discovered work outside the current acceptance boundary.

## Choose the Issue type

Use exactly one repository Issue Form for the selected type:

- `initiative.yml`: Use for a broad outcome that requires multiple independently completable Epics.
- `epic.yml`: Use for one coherent outcome composed of Proposals, Features, Tasks, or narrower outcome Epics.
- `proposal.yml`: Use for one design, product, or support decision. Keep production implementation out of the Proposal.
- `feature.yml`: Use for a usable behavior or capability with its specification, tests, implementation, and integration evidence.
- `task.yml`: Use for bounded implementation support, migration, validation, documentation, or repository maintenance work.
- `bug.yml`: Use for unexpected behavior that violates an existing specification or accepted expectation.

Do not encode roadmap IDs such as `EP-01` or ordering prefixes in titles.
Use a concise outcome-oriented title.

## Select The Domain Workflow

After admitting the owning Issue, select the domain skill that owns the Issue's execution contract.
Keep Issue admission, hierarchy, dependencies, branch state, PR state, and final GitHub verification in this controller.

- `Proposal`: Use `dathomir-proposal-decision` for requirements coverage, option comparison, stress testing, ADRs, and Proposal validation.
- `Task`: Use `dathomir-task-work` for Task scope, implementation, verification evidence, and Task handoff.
- `Feature` or `Bug`: Use the package or product skill that owns the affected behavior, then return to this controller for Issue and PR state.
- `Initiative` or `Epic`: Use this controller for hierarchy and coordination, and delegate each child to its Issue-type workflow.

Do not put domain-specific Proposal or Task execution rules into this controller.

## Construct the Issue from its form

Read the selected YAML form completely before creating the Issue.

When using the GitHub web UI, submit the matching Issue Form.
When using an API, reproduce the form semantics:

1. Use the top-level `type`, `labels`, `assignees`, and title defaults declared by the form.
2. Gather every required non-markdown body field.
3. Render the fields in form order using the field label as a Markdown heading.
4. Omit empty optional fields.
5. Preserve the requested language; default Dathomir Issue prose to Japanese while keeping technical identifiers exact.
6. Reject an Issue body that leaves a required field empty.

Use a half-width space after a complete Issue reference when prose follows.
Write `#103 のPhase 1`, not `#103のPhase 1`.

## Configure hierarchy, dependencies, and fields

Configure the native GitHub relationship in addition to mentioning it in the body.

- Attach a child with the native sub-issue relationship when `Parent issue` references an Issue.
- Permit `None` only when no coherent roadmap owner exists.
- Do not create an Initiative solely to contain one isolated leaf Issue.
- Add native blocked-by relationships for every declared blocking dependency.
- Keep the native child order aligned with the execution order when order matters.

Set organization Issue fields after creation:

- Proposal: Set `Proposal Progress` to `Not yet` initially.
- Initiative, Epic, Feature, Task, and Bug: Set `Priority` and `Effort`.
- Infer Priority from product impact and sequencing pressure.
- Infer Effort from the accepted scope, not from the number of files.
- Use `Medium` when the value is genuinely unknown and no sequencing decision depends on it.

Move Proposal Progress only when evidence supports the transition:

- `Not yet`: The decision work has not started.
- `Proposed`: A concrete option and rationale are ready for review.
- `In Progress`: Evidence and options are actively being evaluated.
- `Accepted` or `Rejected`: The decision is final.
- `Interruption`: The decision is paused by an explicit blocker.
- `Superseded` or `Deprecated`: A later decision replaced or retired it.

## Delegate by role and capability

Keep delegation independent of the active agent host, model provider, model family, model slug, reasoning-level name, and configuration path.
Express the workflow with roles and capability tiers, then let the active host map each tier to an available model and reasoning setting.

Use these capability tiers:

- `economy`: Use for deterministic searches, extraction, classification, command execution, and concise evidence collection.
- `balanced`: Use for bounded repository exploration and implementation with a fixed specification and acceptance boundary.
- `advanced`: Use for ambiguous design, complex implementation, security or correctness analysis, and independent final review.

Start with the lowest tier that can satisfy the declared acceptance criteria.
Escalate only when evidence reveals unresolved ambiguity, cross-cutting behavior, elevated correctness or security risk, or a failed independent review.

Use these delegation roles when the host supports subagents:

- `issue-scout` (`economy`, read-only): Search open and closed Issues, inspect type, hierarchy, dependencies, fields, and possible duplicates.
- `repo-explorer` (`economy` or `balanced`, read-only): Read the relevant instructions, specifications, tests, implementation, and dependencies, then return file-backed findings.
- `writer` (`balanced` or `advanced`, write): Implement an accepted scope. Allow only one writer for overlapping files or behavior at a time.
- `verifier` (`economy`, no source edits): Run declared checks and return exact commands, outcomes, and concise failure evidence.
- `reviewer` (`advanced`, read-only): Independently compare the Issue, specification, tests, implementation, and diff for correctness, safety, and missing evidence.

Keep the orchestrating agent responsible for Issue admission, Issue type, scope, acceptance boundaries, final design decisions, integration, staging, commit, push, PR creation, and final GitHub verification.
Treat subagent results as evidence, not as automatic decisions.

Delegate only bounded, independent work when parallel execution or context isolation is worth the additional model and coordination cost.
Prefer read-only delegation.
Do not spawn a subagent for a trivial serial action such as creating a branch, setting one field, committing, pushing, or opening a PR unless permission isolation requires it.
Do not ask multiple agents the same question unless independent hypotheses or reviews are intentional.
Use parallel writers only when their file ownership and behavior ownership are disjoint and the integration order is explicit.
Require each subagent to return a distilled result with source paths, Issue references, commands, or other reproducible evidence instead of raw logs.

Honor an explicit user choice of agent host, provider, model, reasoning effort, latency target, or budget.
When the host supports per-agent model, reasoning, tool, or permission configuration, map the capability tiers in that host's native configuration instead of encoding provider-specific model names in this skill.
When the host cannot select a model per subagent, use its inherited or default model while preserving the role boundary.
When subagents are unavailable, execute the same operational roles sequentially in the main context and continue the workflow, but label a same-context review as self-review rather than independent review.
When independent review is an acceptance requirement, use a separate session, a human reviewer, or another isolated review mechanism; report missing independent evidence instead of substituting self-review.
Do not make task completion depend on one provider's subagent feature or configuration format.
Do not add or change host-specific agent configuration unless the user requests that configuration as part of the task.

## Execute within the Issue boundary

Use the Issue outcome, acceptance criteria, non-goals, and dependencies as the work authorization boundary.

For production code changes, follow the repository SPEC-first workflow:

1. Read the relevant `SPEC.typ` and `implementation.test.ts` completely.
2. Update the specification and tests before implementation when behavior changes.
3. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` consistent in the same PR.
4. Run validation proportional to the change risk.

Create a branch with `gnb` from the correct base branch.
Do not push directly to the default branch.
Use a stacked PR base only when the owning Issue explicitly depends on unmerged work.

Keep the Issue body stable as the current contract.
Use Issue comments for chronological updates, including:

- branch and starting revision;
- accepted implementation plan;
- completed checkpoints;
- test and artifact evidence;
- blockers and native dependency changes;
- commit and PR links.

Do not paste noisy command logs when a concise result and reproduction command are sufficient.

## Publish and complete work

Before publishing:

1. Compare the diff with the Issue scope and non-goals.
2. Run all relevant checks and record the exact commands and outcomes.
3. Verify that no unrelated user changes are staged.
4. Commit intentionally and push the task branch.
5. Open a Draft PR against the correct base branch.
6. Assign every PR to `takuma-ru`.
7. Link the owning leaf Issue in the PR body with `Closes #N` when merge should complete it.
8. Link parent or related Issues with `Relates to #N`; do not close an Epic or Initiative from a leaf PR.
9. Add the PR URL, commit, and validation summary to the Issue.

Leave implementation Issues open until the completing PR merges.
Close a Proposal only after its decision and rationale are recorded and Proposal Progress is final.
Close an Epic or Initiative only after all required children are completed and all deferred or not-planned children have an explicit disposition.

Do not declare completion when acceptance evidence is missing, the PR is absent, the remote branch is stale, or the worktree contains unfinished changes.

## Verify the task record

Before handing off, verify through GitHub rather than relying on local memory:

- the Issue type matches the selected form;
- required body sections are present;
- custom fields are set;
- parent and blocked-by relationships are native and correct;
- there is no duplicate Issue;
- Issue reference spacing is valid;
- progress comments identify the current branch and evidence;
- the Draft PR targets the intended base and is assigned to `takuma-ru`;
- the PR and Issue describe the same scope;
- the local worktree and remote branch are synchronized.

Use any available GitHub access path that supports the required Issue fields, native relationships, PR data, and mutations, including a host integration, `gh`, or the GitHub API.
When multiple paths are available, prefer the path that exposes the required semantics directly and use another path for unsupported operations such as native dependency endpoints, current-branch PR discovery, authentication checks, or Actions logs.
Re-read the resulting GitHub state after every mutation path instead of trusting a local command result.
