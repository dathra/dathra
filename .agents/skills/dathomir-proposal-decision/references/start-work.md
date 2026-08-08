# Controller Preconditions

The `manage-github-issue-work` controller must complete Issue admission and branch preparation before this skill starts.

- Confirm that the controller identified the owning Issue as a `Proposal`.
- Confirm that the controller recorded the repository, Issue number, branch, base, and starting revision.
- Read the relevant repository and package `AGENTS.md` files.
- Preserve unrelated worktree changes.
- Do not create another Issue, switch branches, push, or open a PR from this skill.

If the Issue type or decision boundary is ambiguous, return the ambiguity to the controller instead of making a new Issue or silently changing scope.
