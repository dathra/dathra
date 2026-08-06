# Execute Task Work

## Confirm Task Scope And Acceptance

Create a coverage map with one row for every collected `issueRequirements.*` candidate.
Preserve each candidate's source, including Issue number, heading path, and line.

- Map `Outcome` and `Work` to the intended Task result.
- Map `Parent issue` to an explicit parent disposition, preserve its source, and return any mismatch with the native parent relationship to the controller.
- Map `Preconditions` to the conditions required before implementation.
- Map `Verification` to explicit commands or observable evidence.
- Map every `Acceptance criteria` candidate to explicit evidence.
- Keep `Dependencies` separate from native blocked-by and blocking relationships.
- Keep `Non-goals` outside the implementation boundary.

If no bounded implementation scope remains, return the reason to the controller and request clarification.

## Implement Task Work

Implement only the accepted Task scope.
When package behavior changes, update the relevant `SPEC.typ` and `implementation.test.ts` before `implementation.ts`.
Do not turn an implementation detail into a new design decision inside the Task.

If the work changes caller-visible behavior, execution ownership, an interface seam, identity, lifetime, failure outcome, or resource guarantee, stop and return a design-decision escalation to the controller.

## Verify Task Evidence

Run the commands named by the Task's `Verification` field.
Add focused regression tests for behavior changes.
Check that every mandatory acceptance criterion has a passing command, artifact, or reviewable diff as evidence.
Return failures and unresolved evidence to the controller for recording on the owning Issue instead of declaring the Task complete.
