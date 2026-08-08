# Collect Task Inputs

From the repository root, collect the admitted Task Issue and its related records into an ephemeral JSON bundle:

```bash
node .agents/scripts/collect_issue_inputs.mts \
  <issue-number> \
  --output /tmp/opencode/task-<issue-number>-inputs-<run-id>.json
```

Use a unique `<run-id>` for every collection attempt.
The output parent directory must already exist.
The output path must not already exist.
The writer creates the file with mode `0600`, refuses to replace an existing file, and refuses to follow an existing symlink.

The collector reads the owning Issue, comments, native parent and child Issues, dependencies, timeline records, direct references, and any issue-numbered Proposal file.
The Task workflow uses `issueRequirements.*` from the Task form.
The Proposal fields in `requirements.*` are not Task acceptance evidence.

The JSON reports source completeness in five groups: `issue`, `comments`, `nativeRelationships`, `references`, and `proposal`.
Each group has a `status` of `collected`, `absent`, or `incomplete`, plus `missingSources`.
An absent Proposal file is acceptable for a bounded Task.

Treat missing or empty required Task fields as incomplete input.
Treat every collected `issueRequirements.acceptanceCriteria` candidate as mandatory unless the owning Task Issue records an explicit scope change.
Treat the bundle as disposable working context, not as a task ledger.
