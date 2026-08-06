# Start Work

The `manage-github-issue-work` controller must admit the owning Issue before this skill starts.

- Confirm that the owning Issue type is `Task`.
- Confirm the Issue number, repository, parent, dependencies, and acceptance boundary.
- Confirm the task branch, base branch, and starting revision recorded by the controller.
- Preserve unrelated worktree changes.
- Do not create a Proposal merely because the Task is difficult.
- Return a design-decision escalation to the controller when the Task contains a new design decision.

If the Issue type, scope, or acceptance boundary is ambiguous, return the ambiguity to the controller and stop before implementation.
