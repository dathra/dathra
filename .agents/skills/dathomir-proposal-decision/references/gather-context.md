# Gather Context

Read [collector.md](collector.md) before collecting the owning Proposal Issue. Read this file before resolving collection warnings or opening targeted sources.

## Resolve Collection Warnings

Inspect every `warnings` entry and every `completeness` group before using the result. Treat a missing or empty required field as incomplete input for the relevant `requirements.*` key. Treat every Acceptance criteria item as mandatory by default; alter that boundary only through an explicit scope change recorded in the owning Issue. Resolve failed collection or ambiguous source records instead of silently filling gaps from memory. Retry transient collection failures using the collector's bounded retry behavior, then rerun collection after changing an Issue relationship or canonical record. Do not continue while an `incomplete` group can hide a current requirement or impact relationship.

Treat this JSON as disposable working context, not a canonical record. The script collects facts and evidence only; the agent remains responsible for classification, coverage disposition, and design decisions. Do not commit the bundle or use the script to write to GitHub.

## Return Collection Blocker Or Scope Clarification

For a permanent collection outage or ambiguity that remains unresolvable after transient failures are retried, prepare the warning, affected source, attempted collection, and supporting evidence for the controller. Stop the workflow, or request that the controller record explicit scope clarification in the owning Issue when the ambiguity changes the decision boundary. Do not fill the missing context from memory or proceed as if the source were collected.

## Read Targeted Sources

Read these sources before proposing an option:

- repository and relevant package `AGENTS.md` files
- the collected input bundle, including the owning Issue, relationships, comments, and warnings
- the current Proposal file, if one exists
- `SPEC/SPEC.typ` and `SPEC/functions.typ` for Typst conventions
- relevant package `SPEC.typ` and `implementation.test.ts` when the decision will be adopted by implementation
- current implementation only as evidence to compare against the specification

Inspect recent commits and the worktree.
Preserve unrelated user changes.
