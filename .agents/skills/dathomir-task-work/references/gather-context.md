# Gather Task Context

## Resolve Collection Warnings

Inspect every `warnings` entry and every `completeness` group before implementing the Task.
Do not treat a missing required field as an intentional absence.
Retry transient collector failures using its bounded retry behavior.
Rerun collection after changing a canonical Issue record or relationship.
Do not continue while an `incomplete` group can hide a current requirement, acceptance criterion, or impact relationship.

## Return Blocker Or Scope Clarification

For a permanent collection outage or ambiguity that remains unresolved after retries, prepare the warning, affected source, attempted collection, and evidence for the controller.
Stop the workflow when the missing context changes the acceptance boundary.
Do not fill the gap from memory.

## Read Task Sources

Read these sources before implementation:

- repository and relevant package `AGENTS.md` files
- the collected Task input bundle, including the owning Issue, relationships, comments, and warnings
- the owning Task Issue and its acceptance criteria
- relevant package `SPEC.typ` and `implementation.test.ts` when package behavior changes
- current implementation only as evidence against the adopted specification
- the verification sources named by the Task

Do not require a Proposal file, Proposal option comparison, or Typst Proposal compilation unless a separate Proposal Issue owns a design decision.
