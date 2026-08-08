# Validate And Return

## Validate Before Publishing

Locate the unique Proposal path returned by the collector or by searching `SPEC/proposals/**/{issue}.typ`, then run the relevant Typst compile and whitespace checks.
Do not hard-code a topic directory.
If no Proposal file exists, verify and record the intentional `absent` state instead of compiling a guessed path.
`git diff --check` does not inspect untracked files, so stage the intended file before checking it.
If staging is not yet appropriate, use the explicit no-index form to inspect the output; its exit status is `1` whenever the files differ and must not be treated as a whitespace verdict.

```bash
mise exec typst -- typst compile --root "." \
  "<unique Proposal path returned by the collector>" \
  "/tmp/opencode/{issue}.pdf"
git diff --check
# For a new untracked Proposal before staging:
git diff --no-index --check /dev/null "path/to/{issue}.typ"
```

When package specifications, tests, or implementation change, follow the full SPEC-first workflow and run focused tests, integration tests, typecheck, and lint as applicable.

When changing any part of this skill, load `skill-creator` and enumerate and validate the entire skill directory, including tracked and untracked `SKILL.md`, references, assets, and `agents/openai.yaml`, plus the shared collector script and test.
Do not validate only the Git diff.
Run applicable syntax, formatting, test, reference-link, and whitespace checks over that full file set, then run the skill-creator `scripts/quick_validate.py` against the directory.
If `agents/openai.yaml` is present, parse and compare its interface metadata with the current skill, and regenerate it with `generate_openai_yaml.py` only when stale.

```bash
node --test \
  .agents/scripts/collect_issue_inputs.test.mts
```

Before returning the work to the controller, verify all of the following:

- the coverage and ownership map has exactly one provenance-preserving row for every collected `requirements.*` candidate
- every state, error, retry rule, and owned resource appears consistently in the canonical state model, behavior contracts, and evidence matrix
- every `open_questions` item has a deferred owner and blocking status recorded canonically in the owning Issue; any Proposal or ADR copy is only a mirror
- the Proposal, Issue, and diff describe the same scope and no unresolved term or stale ADR wording remains

## Return To Controller

- Return the Proposal path, generated artifacts, validation commands, results, and remaining risks to `manage-github-issue-work`.
- Do not create or update Issue relationships from this skill.
- Do not commit, push, open, or merge a PR from this skill.
- Let the controller manage branch synchronization, review threads, PR state, Issue Development links, and merge verification.
