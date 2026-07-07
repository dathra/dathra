---
name: dathomir-sdd-tdd-learning
description: Use for Dathomir repository work that explains or documents how any package under packages/ works through the project's SPEC.typ + implementation.test.ts + implementation.ts structure. Trigger when the user asks to understand package internals, create a per-file learning TODO, explain files one by one, continue to the next file, or add explanatory JSDoc after a learning pass. This is a learning and explanation workflow, not a correctness-check workflow; do not produce package-wide findings.
---

# Dathomir SDD/TDD Learning

## Purpose

Use this skill to help the user understand any Dathomir package with the repository's SDD + TDD discipline:

- `SPEC.typ` defines design intent and accepted decisions.
- `implementation.test.ts` defines expected behavior.
- `implementation.ts` must satisfy both.

The default goal is learning and explanation. Do not search for package-wide findings or judge correctness.

## Preflight

1. Read root `AGENTS.md`.
2. Identify the target package under `packages/`.
3. Run `git status -sb` to avoid confusing the learning session with unrelated local changes.
4. For the current file or feature being explained, read nearby `AGENTS.md`, `SPEC.typ`, and `implementation.test.ts` when they clarify intent.
5. If the requested package or feature is ambiguous, ask which item to process.
6. If creating a new branch, use `gnb -h` and create the branch with `gnb`, not raw `git checkout -b`.

If the user explicitly asks for a SPEC/implementation consistency check, use `.agents/skills/spec-implementation-review/SKILL.md` instead of this skill.

## Primary Workflow

Treat explanation as the default and primary workflow.

Use this when the user says they want to understand, learn, read, explain files one by one, make a TODO, or continue to the next file.

In this workflow:

- Do not emit findings, issue lists, severity lists, or validation summaries.
- Do not run package tests or validation unless the user asks for edits or verification.
- Do not change files unless the user explicitly asks for JSDoc/docs/code changes.
- Build a file-by-file TODO and explain only the current file or next requested file.
- Keep the output educational: responsibility, key state/types, execution flow, connections, mental model.

## Change Mode

Use this when the user asks to fix, implement, update JSDoc, push, or create a PR.

In this mode:

- Apply the SDD/TDD change rules.
- Keep changes scoped.
- Validate, commit, push, or create a PR only when requested.

When changing behavior:

1. Update `SPEC.typ` first.
2. Add or update `implementation.test.ts` next.
3. Update `implementation.ts` last.
4. Keep `SPEC.typ`, `implementation.test.ts`, and `implementation.ts` mutually consistent.

Ignore generated or non-source learning targets unless the user explicitly asks for them:

- `.stryker-tmp/`
- `dist/`
- coverage output
- `__screenshots__/`
- other generated fixtures or snapshots that are not the feature source.

## Package Discovery

Support all package folders under `packages/`, including:

- `components`
- `core`
- `plugin`
- `reactivity`
- `runtime`
- `shared`
- `store`
- `transformer`

Do not hard-code feature names. Discover learning targets from package entry points, `src/**/SPEC.typ`, and `src/**/implementation.ts`.

If edits are requested, use the root package scripts when they exist:

```bash
pnpm p:<package> test
pnpm p:<package> typecheck
pnpm p:<package> lint
pnpm p:<package> fmt:check
```

If a package script is missing, inspect `packages/<package>/package.json` and use the closest available package-local script.

## SDD/TDD Change Rules

For accepted ADRs:

- Do not rewrite the meaning of `Status.Accepted` ADRs.
- If a decision changes, add a new ADR that supersedes or extends the old one.

For documentation-only changes:

- Keep implementation behavior unchanged.
- Add English JSDoc or focused comments only where they explain non-obvious flow.
- Prefer explaining dependency tracking, lifecycle, cleanup, dirty/pending behavior, queueing, and batching over restating syntax.

## Explanation Workflow

When the user wants to understand the implementation:

1. Create or maintain a TODO/checklist of files.
2. Mark only the current file as in progress.
3. Explain one file at a time and stop after that file unless the user asked for more.
4. Derive the explanation order from the package structure:
   - package entry points first, such as `src/index.ts`
   - exported public types next, such as `src/types/**`
   - shared/internal helpers next, such as `src/internal/**`
   - feature directories last, in dependency order when obvious
5. For each feature directory, explain `SPEC.typ` and `implementation.test.ts` context before `implementation.ts` when behavior is unclear.
6. For each file, explain in this order:
   - File overview: what the file is responsible for, what role it plays in the package, and what a reader should understand before looking at individual functions.
   - Function-level behavior: do not blindly follow source order. Prefer the order that helps understanding:
     - public or exported APIs first when the file has user-facing entry points.
     - the main execution route next, including major branches such as parse/render, client/server, tree/compiled, or setup/run/cleanup.
     - core internal functions before small helpers when they explain the feature behavior.
     - helpers, type guards, constants, caches, and state after the main path unless they are prerequisites.
     - lifecycle order for scheduler, hydration, cleanup, batching, or stateful files.
     - finish this section with a compact call graph when multiple functions depend on each other.
   - In-file dependency relationships: explain which functions call or prepare data for other functions in the same file, including cache/state flow, helper usage, lifecycle, traversal, scheduling, parsing, rendering, hydration, or cleanup relationships when relevant.
   - External connections: explain how the file connects to neighboring files, package entry points, tests, SPEC decisions, and public APIs.
   - Mental model: end with the compact model users should keep when reading or modifying the file.
7. Finish the learning pass with an end-to-end flow using the package's domain language.

Do not summarize all package findings. A message like "packages/runtime has 14 feature findings" indicates the wrong workflow was chosen.

For `@dathra/reactivity`, prefer this concrete order:

   - `src/index.ts`
   - `src/types/index.ts`
   - `src/internal/nodes.ts`
   - `src/internal/state.ts`
   - `src/internal/system.ts`
   - `src/internal/helpers.ts`
   - `src/signal/implementation.ts`
   - `src/computed/implementation.ts`
   - `src/effect/implementation.ts`
   - `src/onCleanup/implementation.ts`
   - `src/createRoot/implementation.ts`
   - `src/batch/implementation.ts`
   - `src/templateEffect/implementation.ts`

For other packages, do not reuse the reactivity order. Build an order from the package's own entry points, internal helpers, and feature dependencies.

## JSDoc Guidance

If the user asks whether JSDoc is enough to understand the implementation, compare the current comments against the explanation level above.

When adding JSDoc:

- Write all code comments in English.
- Explain why the function exists and what side effects it has.
- Mention tracking context such as `activeSub` and cleanup context such as `currentOwner` or `currentEffectCleanups`.
- Mention error and lifecycle behavior when relevant.
- Keep comments close to the function they explain.
- Avoid comments that only repeat the function name or obvious parameter types.

Good targets generally include:

- package entry functions
- hidden operator functions that combine read/write or parse/emit behavior
- scheduler, traversal, transform, hydration, DOM, SSR, or registry internals
- lifecycle or cleanup functions
- public API factories
- shared helpers whose side effects are not obvious

Good targets in `@dathra/reactivity` specifically include:

- `withNoTracking`
- `setActiveSub`, `flush`, `runWatcher`, `updateComputed`, `updateSignal`, `scopeCleanup`
- `signalOper`, `computedOper`
- `effect`, `runEffectCleanups`
- `onCleanup`
- `createRoot`
- `batch`
- `templateEffect`

## Validation

Run the narrowest relevant package checks after edits. Prefer package-specific root aliases:

```bash
pnpm p:<package> fmt
pnpm p:<package> test
pnpm p:<package> typecheck
pnpm p:<package> lint
pnpm p:<package> fmt:check
```

For example, for `@dathra/reactivity`, use:

```bash
pnpm p:reactivity fmt
pnpm p:reactivity test
pnpm p:reactivity typecheck
pnpm p:reactivity lint
pnpm p:reactivity fmt:check
```

If a package does not define one of those scripts, skip that command and state why.

Do not report completion without saying which checks passed or why a check could not run.

## Commit, Push, PR

When the user asks to push or create a PR:

1. Inspect `git status -sb` and `git diff --stat`.
2. Stage only intended files.
3. Use a concise conventional commit message.
4. Run or confirm relevant validation.
5. Push the branch.
6. Create a Draft PR unless the user requests a non-draft PR.
7. Summarize branch, commits, PR URL, and checks.

If the worktree has unrelated changes, do not stage them silently.
