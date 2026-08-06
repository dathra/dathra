# Capture The Decision

## Record The Decision

For a Proposal, for each accepted decision, capture:

- the decision statement
- the problem it prevents
- the selected option
- rejected alternatives and their costs
- invariants for later Proposals
- the owning Issue, owner, and blocking status for deferred work

For a Proposal, for each `open_questions` entry, prepare its deferred owner and blocking status for the controller to record in the owning Issue. The Proposal or ADR may mirror that mapping in the decision ledger or an adjacent ADR consequence, but it must not replace the Issue record. The rendered `open_questions` list alone is not sufficient evidence that a question is intentionally deferred.

For a Proposal, copy the final option comparison and stress-test evidence into the final Proposal or owning Issue summary with its source provenance. Do not leave either evidence set only in working context.

For a Proposal, use `#design_proposal`, `#adr`, `#behavior_spec`, and the existing `SPEC/functions.typ` conventions.

Never change the meaning of a `Status.Accepted` ADR in place. Add a later ADR that explicitly supersedes the earlier decision, then update downstream behavior contracts to refer to the new decision.

## Prepare Proposal And Issue Evidence

- Keep the Proposal focused on design semantics, not production implementation.
- Keep the Issue's required form sections and acceptance boundary stable.
- Prepare the Issue progress, evidence, blocker, and handoff update for the controller.
- Link later Issues for artifact emission, runtime activation, reactive revisions, adapters, or implementation work.
- For a Proposal, keep concrete encodings and package APIs outside the current Proposal only when they are outside the owning Issue's decision boundary or an explicit later Issue owns them. If the owning Issue lists them under `Decision to make` or `Acceptance criteria`, resolve them in the current Proposal or stop for scope clarification.
- Do not create or modify Issue relationships, branches, commits, or pull requests from this skill.

For execution-partitioning Proposals, preserve the separation among:

- stable server snapshot and client activation
- client-reactive execution
- server-owned delivery or subscription
- artifact emission and browser runtime
