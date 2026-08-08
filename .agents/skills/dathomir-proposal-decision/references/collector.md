# Collect Decision Inputs

From the repository root, collect the owning Issue and its related records into an ephemeral JSON bundle before interpreting the requirements:

```bash
node .agents/scripts/collect_issue_inputs.mts \
  <issue-number> \
  --output /tmp/opencode/proposal-<issue-number>-inputs-<run-id>.json
```

Use a unique `<run-id>` for every collection attempt. Ensure the output parent directory already exists; the collector writer does not create it. The output path must not already exist. The script creates it with mode `0600` and refuses to replace an existing file or follow an existing symlink. The `--output` option is required because the JSON contains Issue and comment source text; do not stream this bundle to standard output.

The shared script reads the Issue body, comments, native parent and child Issues, dependencies, cross-referenced Issues and Pull Requests, and the issue-numbered Proposal file. It searches all `SPEC/proposals/**/{issue}.typ` paths; a missing file is an intentional absent Proposal state, while multiple matches make the Proposal source incomplete and ambiguous. For this skill, use the Proposal fields mapped to `requirements.decisionToMake`, `contextAndEvidence`, `optionsConsidered`, `decisionCriteria`, `acceptanceCriteria`, `dependencies`, and `nonGoals`, with source locations. The output also records the native `Proposal Progress` value as `issue.proposalProgress`.

The JSON reports source completeness in five groups: `issue`, `comments`, `nativeRelationships`, `references`, and `proposal`. Each group has a `status` of `collected`, `absent`, or `incomplete`, plus `missingSources`. An absent Proposal file is an expected `absent` state. A failed optional API request, missing relationship summary, malformed relationship record, or relationship count mismatch produces `incomplete` instead of an empty result that could be mistaken for no relationship. A failure to collect the owning Issue remains a command failure and does not produce a partial JSON result.

Treat a missing or empty required Proposal field as incomplete input for its corresponding `requirements.*` key, even if no separate warning identifies the empty section. Do not interpret missing requirements as an intentional absence. Treat every collected `requirements.acceptanceCriteria` candidate as mandatory by default; only an explicit scope change recorded in the owning Issue can alter that boundary. The optional `Dependencies` field may be absent.

Valid zero-valued relationship summaries are treated as collected empty relationships; endpoint count comparison applies when a non-empty endpoint is queried.

The formal impact graph contains only direct native `parent`, `children`, `blockedBy`, and `blocking` relationships. `relatedIssues` and `relatedPullRequests` remain as Proposal decision context from timeline and text references; they are not impact-graph edges, and the collector does not traverse them recursively. Collection is best effort across separate GitHub API calls; `collectedAt` records the collection time, not a transactional GitHub snapshot. Transient GitHub CLI failures receive bounded retries before the affected source group is marked `incomplete`.

The shared collector supports the field labels declared by the current Issue forms. For Proposal decisions, use the `requirements.*` candidates. A missing or unsupported Issue type makes `completeness.issue` incomplete because the applicable required-field contract is unknown. Keep native parent and dependency relationships separate from the optional textual `Dependencies` field.
