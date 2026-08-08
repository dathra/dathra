import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import {
  chmodSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, test } from "node:test";
import { fileURLToPath } from "node:url";

import {
  CollectionError,
  GhClient,
  collectInputs,
  extractIssueReferences,
  extractTemplateRequirements,
  findProposal,
  flattenPages,
  normalizeIssue,
  parseMarkdownSections,
  timelineRelations,
  writeOutput,
  isRetryableGhFailure,
} from "./collect_issue_inputs.mts";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  assert.ok(isRecord(value));
  return value;
}

function requireRecordArray(value: unknown): Array<Record<string, unknown>> {
  assert.ok(Array.isArray(value) && value.every(isRecord));
  return value;
}

function requireStringArray(value: unknown): string[] {
  assert.ok(Array.isArray(value) && value.every((item) => typeof item === "string"));
  return value;
}

function withTemporaryDirectory(run: (directory: string) => void): void {
  const directory = mkdtempSync(join(tmpdir(), "proposal-inputs-"));
  try {
    run(directory);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
}

describe("Markdown extraction", () => {
  test("extracts supported sections with line evidence", () => {
    const body = `# Proposal

## Decision to make

- 実行ownerを決める。
- lifetimeを決める。
  disposalも含む。

## Acceptance criteria

1. ownerが明示される。

## Non-goals

Production implementation`;

    const requirements = extractTemplateRequirements(parseMarkdownSections(body), 42);

    assert.deepEqual(
      requirements.decisionToMake?.map((item) => item.text),
      ["実行ownerを決める。", "lifetimeを決める。 disposalも含む。"],
    );
    assert.equal(requirements.acceptanceCriteria?.[0]?.source.line, 11);
    assert.equal(requirements.nonGoals?.[0]?.text, "Production implementation");
  });

  test("extracts current Proposal template fields", () => {
    const body = `## Decision to make

- Decide ownership.

## Context and evidence

- Current behavior is documented.

## Options considered

1. Keep the current boundary.
2. Move the boundary.

## Decision criteria

- Minimize unsupported coupling.

## Acceptance criteria

- The selected option is recorded.

## Dependencies

- Blocked by #12.

## Non-goals

- Production implementation.`;

    const requirements = extractTemplateRequirements(parseMarkdownSections(body), 42);

    assert.equal(requirements.decisionToMake?.[0]?.text, "Decide ownership.");
    assert.equal(requirements.contextAndEvidence?.[0]?.text, "Current behavior is documented.");
    assert.equal(requirements.optionsConsidered?.length, 2);
    assert.equal(requirements.decisionCriteria?.[0]?.text, "Minimize unsupported coupling.");
    assert.equal(requirements.dependencies?.[0]?.text, "Blocked by #12.");
  });

  test("rejects heading variants not declared by the template", () => {
    const body = `## decision to make

- This casing is not declared by the Proposal form.

## Context   and evidence

- This spacing is not declared by the Proposal form.`;

    const requirements = extractTemplateRequirements(parseMarkdownSections(body), 42);

    assert.deepEqual(requirements.decisionToMake, []);
    assert.deepEqual(requirements.contextAndEvidence, []);
  });

  test("flattens paginated gh output", () => {
    assert.deepEqual(flattenPages([[1, 2], [3]]), [1, 2, 3]);
    assert.deepEqual(flattenPages([]), []);
    assert.throws(() => flattenPages({}), CollectionError);
    assert.throws(() => flattenPages([{ number: 1 }]), /non-array page/);
  });

  test("classifies retryable GitHub failures", () => {
    assert.equal(isRetryableGhFailure(undefined, "HTTP 503 Service Unavailable"), true);
    assert.equal(isRetryableGhFailure("ETIMEDOUT", "spawn failed"), true);
    assert.equal(isRetryableGhFailure("ENETUNREACH", "network is unreachable"), true);
    assert.equal(isRetryableGhFailure(undefined, "HTTP 404 Not Found"), false);
  });

  test("retries transient GitHub CLI failures with a bounded attempt count", () => {
    withTemporaryDirectory((directory) => {
      const counterPath = join(directory, "attempts");
      const fakeGhPath = join(directory, "gh");
      writeFileSync(
        fakeGhPath,
        `#!/usr/bin/env node
const { readFileSync, writeFileSync } = require("node:fs");
const path = process.env.GH_RETRY_COUNTER;
const count = Number(readFileSync(path, "utf8") || "0") + 1;
writeFileSync(path, String(count));
if (count < 3) {
  process.stderr.write("HTTP 503 Service Unavailable\\n");
  process.exit(1);
}
process.stdout.write(JSON.stringify({ nameWithOwner: "dathra/dathra" }));
`,
        "utf8",
      );
      chmodSync(fakeGhPath, 0o700);
      writeFileSync(counterPath, "0", "utf8");

      const previousPath = process.env.PATH;
      const previousCounter = process.env.GH_RETRY_COUNTER;
      process.env.PATH = `${directory}:${previousPath ?? ""}`;
      process.env.GH_RETRY_COUNTER = counterPath;
      try {
        assert.equal(new GhClient(directory).currentRepository(), "dathra/dathra");
        assert.equal(readFileSync(counterPath, "utf8"), "3");
      } finally {
        process.env.PATH = previousPath;
        if (previousCounter === undefined) {
          delete process.env.GH_RETRY_COUNTER;
        } else {
          process.env.GH_RETRY_COUNTER = previousCounter;
        }
      }
    });
  });
});

describe("Relation extraction", () => {
  test("separates related Issues and Pull Requests", () => {
    const events = [
      {
        id: 101,
        created_at: "2026-08-01T00:00:00Z",
        source: {
          issue: {
            number: 5,
            title: "Issue",
            labels: [],
            repository_url: "https://api.github.com/repos/dathra/dathra",
          },
        },
      },
      {
        source: {
          issue: {
            number: 6,
            title: "PR",
            labels: [],
            repository_url: "https://api.github.com/repos/dathra/dathra",
            pull_request: { url: "https://example.test/6" },
          },
        },
      },
      {
        source: {
          issue: {
            number: 5,
            title: "Issue",
            labels: [],
            repository_url: "https://api.github.com/repos/dathra/dathra",
          },
        },
      },
    ];

    const [issues, pullRequests] = timelineRelations(events, "dathra/dathra");

    assert.deepEqual(
      issues.map((item) => item.number),
      [5],
    );
    assert.deepEqual(requireRecordArray(issues[0]?.referencedFrom), [
      {
        kind: "timeline-cross-reference",
        relationship: "timeline",
        endpoint: "timeline",
        eventId: 101,
        timestamp: "2026-08-01T00:00:00Z",
      },
      {
        kind: "timeline-cross-reference",
        relationship: "timeline",
        endpoint: "timeline",
      },
    ]);
    assert.deepEqual(
      pullRequests.map((item) => item.number),
      [6],
    );
  });

  test("preserves cross-repository identity", () => {
    const events = [
      {
        source: {
          issue: {
            number: 5,
            title: "First",
            labels: [],
            repository_url: "https://api.github.com/repos/one/repo",
          },
        },
      },
      {
        source: {
          issue: {
            number: 5,
            title: "Second",
            labels: [],
            repository_url: "https://api.github.com/repos/two/repo",
          },
        },
      },
    ];

    const [issues] = timelineRelations(events, "dathra/dathra");

    assert.deepEqual(
      new Set(issues.map((item) => item.repository)),
      new Set(["one/repo", "two/repo"]),
    );
  });

  test("rejects timeline records without repository identity", () => {
    for (const repositoryUrl of [undefined, null]) {
      const issue: Record<string, unknown> = {
        number: 5,
        title: "Missing Repository Identity",
        labels: [],
      };
      if (repositoryUrl !== undefined) {
        issue.repository_url = repositoryUrl;
      }

      const [issues, pullRequests, valid] = timelineRelations(
        [{ source: { issue } }],
        "dathra/dathra",
      );

      assert.deepEqual(issues, []);
      assert.deepEqual(pullRequests, []);
      assert.equal(valid, false);
    }
  });

  test("extracts local, qualified, and URL references", () => {
    const references = extractIssueReferences(
      "See #1, other/repo#2, and https://github.com/third/repo/issues/3.",
      { defaultRepository: "dathra/dathra", source: { kind: "issue-body", issue: 42 } },
    );

    assert.deepEqual(
      new Set(references.map((item) => `${String(item.repository)}#${String(item.number)}`)),
      new Set(["dathra/dathra#1", "other/repo#2", "third/repo#3"]),
    );
  });

  test("ignores references in fenced and inline code", () => {
    const references = extractIssueReferences(
      "Use #1, not `#2` or `` `#3` ``.\n\n```text\n#4\n```\n\n    #5",
      { defaultRepository: "dathra/dathra", source: { kind: "issue-body", issue: 42 } },
    );

    assert.deepEqual(
      references.map((item) => [item.repository, item.number]),
      [["dathra/dathra", 1]],
    );
  });

  test("ignores a multiline inline code span", () => {
    const references = extractIssueReferences("Use #1, not ``code\n#2``.", {
      defaultRepository: "dathra/dathra",
      source: { kind: "issue-body", issue: 42 },
    });

    assert.deepEqual(
      references.map((item) => [item.repository, item.number]),
      [["dathra/dathra", 1]],
    );
  });

  test("does not pair backticks across block boundaries", () => {
    const references = extractIssueReferences("Unmatched ` code.\n\n- Keep #1 and `this code`.", {
      defaultRepository: "dathra/dathra",
      source: { kind: "issue-body", issue: 42 },
    });

    assert.deepEqual(
      references.map((item) => [item.repository, item.number]),
      [["dathra/dathra", 1]],
    );
  });
});

describe("Markdown hierarchy", () => {
  test("ignores fenced examples and includes subsections", () => {
    const body = `## Acceptance criteria

\`\`\`markdown
## Non-goals
- Example only
\`\`\`

### Required

- Real criterion`;

    const requirements = extractTemplateRequirements(parseMarkdownSections(body), 42);

    assert.deepEqual(
      requirements.acceptanceCriteria?.map((item) => item.text),
      ["Real criterion"],
    );
    assert.deepEqual(requirements.nonGoals, []);
  });

  test("respects fence length and preserves the full heading path", () => {
    const body = `## Acceptance criteria

\`\`\`\`markdown
\`\`\`text
### Example
- Not a criterion
\`\`\`
\`\`\`\`

### Platform

#### Required

- Real criterion`;

    const acceptance = extractTemplateRequirements(
      parseMarkdownSections(body),
      42,
    ).acceptanceCriteria;

    assert.deepEqual(
      acceptance?.map((item) => item.text),
      ["Real criterion"],
    );
    assert.equal(acceptance?.[0]?.source.heading, "Acceptance criteria > Platform > Required");
  });

  test("does not treat four-space indentation as a fence", () => {
    const body = `## Acceptance criteria

    \`\`\`

- Real criterion`;

    const acceptance = extractTemplateRequirements(
      parseMarkdownSections(body),
      42,
    ).acceptanceCriteria;

    assert.deepEqual(
      acceptance?.map((item) => item.text),
      ["Real criterion"],
    );
  });
});

describe("Proposal discovery", () => {
  test("reads an issue-numbered Proposal", () => {
    withTemporaryDirectory((root) => {
      const proposalDirectory = join(root, "SPEC", "proposals", "topic");
      mkdirSync(proposalDirectory, { recursive: true });
      writeFileSync(join(proposalDirectory, "42.typ"), "proposal", "utf8");
      const warnings: string[] = [];

      const result = findProposal(root, 42, warnings);

      assert.equal(result?.path, "SPEC/proposals/topic/42.typ");
      assert.equal(result?.content, "proposal");
      assert.deepEqual(warnings, []);
    });
  });

  test("warns when a Proposal is missing", () => {
    withTemporaryDirectory((root) => {
      const warnings: string[] = [];

      const result = findProposal(root, 42, warnings);

      assert.equal(result, null);
      assert.equal(warnings.length, 1);
    });
  });

  test("does not select the first Proposal when multiple files match", () => {
    withTemporaryDirectory((root) => {
      const firstDirectory = join(root, "SPEC", "proposals", "first");
      const secondDirectory = join(root, "SPEC", "proposals", "second");
      mkdirSync(firstDirectory, { recursive: true });
      mkdirSync(secondDirectory, { recursive: true });
      writeFileSync(join(firstDirectory, "42.typ"), "first", "utf8");
      writeFileSync(join(secondDirectory, "42.typ"), "second", "utf8");
      const warnings: string[] = [];

      const result = findProposal(root, 42, warnings);

      assert.equal(result, null);
      assert.ok(warnings.some((warning) => warning.includes("Multiple Proposal files")));
    });
  });
});

describe("Input collection", () => {
  test("warns about unsupported variants of optional field headings", () => {
    const issue = {
      number: 42,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      body: `## Decision to make

Decide ownership.

## Context and evidence

Current behavior.

## Options considered

Keep it.

## Decision criteria

Keep ownership explicit.

## Acceptance criteria

Record the owner.

## dependencies

Blocked by #12.

## Non-goals

Production implementation.`,
      labels: [],
      sub_issues_summary: { total: 0 },
      issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
    };
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return issue;
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        if (endpoint === "repos/dathra/dathra/issues/12") {
          return {
            number: 12,
            title: "Dependency",
            labels: [],
            repository_url: "https://api.github.com/repos/dathra/dathra",
          };
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });

      assert.ok(
        requireStringArray(result.warnings).includes(
          'Unsupported Proposal field heading "dependencies"; expected "Dependencies"',
        ),
      );
    });
  });

  test("keeps optional API failures as warnings", () => {
    const issue = {
      number: 42,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      title: "Decide ownership",
      type: { name: "Proposal" },
      body: `## Decision to make

- Choose the execution owner.

## Context and evidence

- The current owner is unclear.

## Options considered

1. Server owns it.
2. Client owns it.

## Decision criteria

- Keep ownership explicit.

## Acceptance criteria

- The owner is explicit.

## Non-goals

- Production implementation.`,
      labels: [],
      parent_issue_url: "https://api.github.com/repos/dathra/dathra/issues/104",
      issue_field_values: [
        {
          issue_field_name: "Proposal Progress",
          single_select_option: { name: "In Progress" },
        },
      ],
      sub_issues_summary: { total: 0 },
      issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
    };
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return issue;
        }
        if (endpoint === "repos/dathra/dathra/issues/42/parent") {
          return {
            number: 104,
            title: "Parent",
            labels: [],
            repository_url: "https://api.github.com/repos/dathra/dathra",
          };
        }
        if (endpoint.endsWith("/comments?per_page=100")) {
          throw new CollectionError("comments unavailable");
        }
        if (endpoint.endsWith("/timeline?per_page=100")) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const requirements = requireRecord(result.requirements);
      const relationships = requireRecord(result.relationships);
      const decisionToMake = requireRecordArray(requirements.decisionToMake);
      const parent = requireRecord(relationships.parent);
      assert.equal(decisionToMake[0]?.text, "Choose the execution owner.");
      assert.equal(requireRecord(result.issue).proposalProgress, "In Progress");
      assert.equal(requireRecordArray(requirements.contextAndEvidence).length, 1);
      assert.equal(requireRecordArray(requirements.optionsConsidered).length, 2);
      assert.equal(requireRecordArray(requirements.decisionCriteria).length, 1);
      assert.equal(requireRecordArray(requirements.acceptanceCriteria).length, 1);
      assert.equal(requireRecordArray(requirements.nonGoals).length, 1);
      assert.deepEqual(requireRecordArray(requirements.dependencies), []);
      assert.deepEqual(result.issueRequirements, {});
      assert.equal(parent.number, 104);
      assert.deepEqual(requireRecordArray(relationships.relatedIssues), []);
      const completeness = requireRecord(result.completeness);
      assert.equal(requireRecord(completeness.issue).status, "collected");
      assert.equal(requireRecord(completeness.comments).status, "incomplete");
      assert.equal(requireRecord(completeness.nativeRelationships).status, "collected");
      assert.equal(requireRecord(completeness.references).status, "incomplete");
      assert.equal(requireRecord(completeness.proposal).status, "absent");
      const warnings = requireStringArray(result.warnings);
      assert.ok(warnings.includes("comments unavailable"));
      assert.ok(warnings.some((warning) => warning.includes("No Proposal file")));
      assert.ok(!warnings.some((warning) => warning.includes("No Dependencies")));
    });
  });

  test("extracts Task requirements without treating them as Proposal fields", () => {
    const issue = {
      number: 233,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      title: "Automate Proposal decision input collection",
      type: { name: "Task" },
      body: `## Parent issue

None

## Outcome

The collector returns a reproducible JSON bundle.

## Preconditions

- The skill exists.

## Work

- Collect the owning Issue and related records.

## Verification

- Run the focused tests.

## Acceptance criteria

- The output is machine-readable.

## Dependencies

None

## Non-goals

- Do not make design decisions in the collector.`,
      labels: [],
      sub_issues_summary: { total: 0 },
      issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
    };
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/233") {
          return issue;
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 233,
        root,
      });
      const issueRequirements = requireRecord(result.issueRequirements);
      const requirements = requireRecord(result.requirements);
      const completeness = requireRecord(requireRecord(result.completeness).issue);

      assert.equal(
        requireRecordArray(issueRequirements.outcome)[0]?.text,
        "The collector returns a reproducible JSON bundle.",
      );
      assert.equal(
        requireRecordArray(issueRequirements.work)[0]?.text,
        "Collect the owning Issue and related records.",
      );
      for (const field of [
        "parentIssue",
        "outcome",
        "preconditions",
        "work",
        "verification",
        "acceptanceCriteria",
        "dependencies",
        "nonGoals",
      ]) {
        assert.equal(requireRecordArray(issueRequirements[field]).length, 1, field);
      }
      assert.equal(requireRecordArray(requirements.decisionToMake).length, 0);
      assert.equal(requireRecordArray(requirements.acceptanceCriteria).length, 0);
      assert.equal(requireRecordArray(requirements.nonGoals).length, 0);
      assert.equal(completeness.issueType, "Task");
      assert.equal(completeness.status, "collected");
      assert.deepEqual(requireStringArray(completeness.missingRequiredFields), []);
      assert.deepEqual(requireStringArray(completeness.duplicateRequiredSections), []);
      assert.ok(
        !requireStringArray(result.warnings).some((warning) =>
          warning.includes("No Decision to make section"),
        ),
      );
    });
  });

  test("marks missing and duplicate required Task sections in completeness", () => {
    const issue = {
      number: 234,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      title: "Incomplete Task",
      type: { name: "Task" },
      body: `## Parent issue

None

## Outcome

- Produce the bounded result.

## Outcome

- Keep the result reviewable.

## Work

- Make the scoped change.

## Verification

- Run the focused checks.

## Acceptance criteria

- The result is verifiable.

## Non-goals

- Do not expand the scope.`,
      labels: [],
      sub_issues_summary: { total: 0 },
      issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
    };
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/234") {
          return issue;
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 234,
        root,
      });
      const completeness = requireRecord(requireRecord(result.completeness).issue);

      assert.equal(completeness.status, "incomplete");
      assert.deepEqual(requireStringArray(completeness.missingRequiredFields), ["Preconditions"]);
      assert.deepEqual(requireStringArray(completeness.duplicateRequiredSections), ["Outcome"]);
      assert.ok(
        requireStringArray(result.warnings).includes(
          "No Preconditions section was recognized in the Issue body",
        ),
      );
    });
  });

  test("marks missing and duplicate required Proposal sections in completeness", () => {
    const issue = {
      number: 42,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      title: "Incomplete Proposal",
      type: { name: "Proposal" },
      body: `## Decision to make

- Choose an owner.

## Decision to make

- Keep the decision explicit.

## Context and evidence

- Current behavior is known.

## Options considered

- Keep the current boundary.

## Decision criteria

- Preserve the ownership boundary.

## Acceptance criteria

- The owner is recorded.`,
      labels: [],
      sub_issues_summary: { total: 0 },
      issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
    };
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return issue;
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const issueCompleteness = requireRecord(requireRecord(result.completeness).issue);
      const missingRequiredFields = requireStringArray(issueCompleteness.missingRequiredFields);
      const duplicateRequiredSections = requireStringArray(
        issueCompleteness.duplicateRequiredSections,
      );
      const missingSources = requireStringArray(issueCompleteness.missingSources);

      assert.equal(issueCompleteness.status, "incomplete");
      assert.deepEqual(missingRequiredFields, ["Non-goals"]);
      assert.deepEqual(duplicateRequiredSections, ["Decision to make"]);
      assert.ok(missingSources.includes("issue-body:required-field:Non-goals"));
      assert.ok(missingSources.includes("issue-body:duplicate-required-section:Decision to make"));
    });
  });

  test("collects native and related records with provenance", () => {
    const issue = {
      number: 42,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      title: "Collect relationships",
      body: "See #12 and #13.",
      labels: [],
      parent_issue_url: "https://api.github.com/repos/dathra/dathra/issues/40",
      sub_issues_summary: { total: 1 },
      issue_dependencies_summary: { total_blocked_by: 1, total_blocking: 1 },
    };
    const relatedIssue = (number: number, title: string): Record<string, unknown> => ({
      number,
      title,
      labels: [],
      repository_url: "https://api.github.com/repos/dathra/dathra",
    });
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return issue;
        }
        if (endpoint === "repos/dathra/dathra/issues/42/parent") {
          return relatedIssue(40, "Parent");
        }
        if (endpoint === "repos/dathra/dathra/issues/42/sub_issues?per_page=100") {
          return [relatedIssue(41, "Child")];
        }
        if (endpoint === "repos/dathra/dathra/issues/42/dependencies/blocked_by?per_page=100") {
          return [relatedIssue(44, "Blocked by")];
        }
        if (endpoint === "repos/dathra/dathra/issues/42/dependencies/blocking?per_page=100") {
          return [relatedIssue(45, "Blocking")];
        }
        if (endpoint.endsWith("/comments?per_page=100")) {
          return [{ id: 700, user: { login: "reviewer" }, body: "Review evidence." }];
        }
        if (endpoint.endsWith("/timeline?per_page=100")) {
          return [
            {
              id: 900,
              created_at: "2026-08-02T00:00:00Z",
              source: { issue: relatedIssue(14, "Timeline Issue") },
            },
            {
              updated_at: "2026-08-03T00:00:00Z",
              source: {
                issue: {
                  ...relatedIssue(15, "Timeline Pull Request"),
                  pull_request: { url: "https://github.com/dathra/dathra/pull/15" },
                },
              },
            },
          ];
        }
        if (endpoint === "repos/dathra/dathra/issues/12") {
          return relatedIssue(12, "Referenced Issue");
        }
        if (endpoint === "repos/dathra/dathra/issues/13") {
          return {
            ...relatedIssue(13, "Referenced Pull Request"),
            pull_request: { url: "https://github.com/dathra/dathra/pull/13" },
          };
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const relationships = requireRecord(result.relationships);
      const comments = requireRecordArray(result.comments);
      const parent = requireRecord(relationships.parent);
      const children = requireRecordArray(relationships.children);
      const blockedBy = requireRecordArray(relationships.blockedBy);
      const blocking = requireRecordArray(relationships.blocking);
      const relatedIssues = requireRecordArray(relationships.relatedIssues);
      const relatedPullRequests = requireRecordArray(relationships.relatedPullRequests);
      const parentSource = requireRecordArray(parent.referencedFrom);
      const childSource = requireRecordArray(children[0]?.referencedFrom);
      const blockedBySource = requireRecordArray(blockedBy[0]?.referencedFrom);
      const blockingSource = requireRecordArray(blocking[0]?.referencedFrom);
      const timelineSource = requireRecordArray(
        relatedIssues.find((item) => item.number === 14)?.referencedFrom,
      );
      const textualSource = requireRecordArray(
        relatedIssues.find((item) => item.number === 12)?.referencedFrom,
      );
      const pullRequestSource = requireRecordArray(
        relatedPullRequests.find((item) => item.number === 15)?.referencedFrom,
      );
      const completeness = requireRecord(result.completeness);

      assert.equal(parent.number, 40);
      assert.deepEqual(comments[0]?.source, {
        kind: "issue-comment",
        issue: 42,
        commentId: 700,
      });
      assert.equal(children[0]?.number, 41);
      assert.equal(blockedBy[0]?.number, 44);
      assert.equal(blocking[0]?.number, 45);
      assert.deepEqual(relatedIssues.map((item) => item.number).sort(), [12, 14]);
      assert.deepEqual(relatedPullRequests.map((item) => item.number).sort(), [13, 15]);
      assert.deepEqual(parentSource[0], {
        kind: "native-relationship",
        relationship: "parent",
        endpoint: "repos/dathra/dathra/issues/42/parent",
      });
      assert.deepEqual(childSource[0], {
        kind: "native-relationship",
        relationship: "children",
        endpoint: "repos/dathra/dathra/issues/42/sub_issues?per_page=100",
      });
      assert.deepEqual(blockedBySource[0], {
        kind: "native-relationship",
        relationship: "blockedBy",
        endpoint: "repos/dathra/dathra/issues/42/dependencies/blocked_by?per_page=100",
      });
      assert.deepEqual(blockingSource[0], {
        kind: "native-relationship",
        relationship: "blocking",
        endpoint: "repos/dathra/dathra/issues/42/dependencies/blocking?per_page=100",
      });
      assert.deepEqual(timelineSource[0], {
        kind: "timeline-cross-reference",
        relationship: "timeline",
        endpoint: "repos/dathra/dathra/issues/42/timeline?per_page=100",
        eventId: 900,
        timestamp: "2026-08-02T00:00:00Z",
      });
      assert.deepEqual(textualSource[0], { kind: "issue-body", issue: 42 });
      assert.deepEqual(pullRequestSource[0], {
        kind: "timeline-cross-reference",
        relationship: "timeline",
        endpoint: "repos/dathra/dathra/issues/42/timeline?per_page=100",
        timestamp: "2026-08-03T00:00:00Z",
      });
      assert.equal(requireRecord(completeness.nativeRelationships).status, "collected");
      assert.equal(requireRecord(completeness.references).status, "collected");
    });
  });

  test("marks malformed comments and related records incomplete without empty records", () => {
    const issue = {
      number: 42,
      repository_url: "https://api.github.com/repos/dathra/dathra",
      title: "Malformed related data",
      body: "See #12.",
      labels: [],
      sub_issues_summary: { total: 0 },
      issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
    };
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return issue;
        }
        if (endpoint.endsWith("/comments?per_page=100")) {
          return [{}];
        }
        if (endpoint.endsWith("/timeline?per_page=100")) {
          return [];
        }
        if (endpoint === "repos/dathra/dathra/issues/12") {
          return {
            number: 12,
            title: "Wrong Repository",
            labels: [],
            repository_url: "https://api.github.com/repos/other/repo",
          };
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const completeness = requireRecord(result.completeness);
      const comments = requireRecordArray(result.comments);
      const relationships = requireRecord(result.relationships);
      const references = requireRecord(completeness.references);

      assert.deepEqual(comments, []);
      assert.deepEqual(requireRecordArray(relationships.relatedIssues), []);
      assert.equal(requireRecord(completeness.comments).status, "incomplete");
      assert.equal(references.status, "incomplete");
      assert.ok(requireStringArray(references.missingSources).includes("comments"));
      assert.ok(requireStringArray(references.missingSources).includes("dathra/dathra#12"));
      assert.ok(
        requireStringArray(result.warnings).includes(
          "comments response contains invalid comment records",
        ),
      );
      assert.ok(
        requireStringArray(result.warnings).includes(
          "Referenced Issue dathra/dathra#12 returned no matching Issue record",
        ),
      );
    });
  });

  test("marks an issue with no supported type incomplete", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            repository_url: "https://api.github.com/repos/dathra/dathra",
            body: "",
            labels: [],
            sub_issues_summary: { total: 0 },
            issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
          };
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const completeness = requireRecord(requireRecord(result.completeness).issue);

      assert.equal(completeness.status, "incomplete");
      assert.deepEqual(requireStringArray(completeness.missingSources), ["issue-type"]);
      assert.ok(
        requireStringArray(result.warnings).includes(
          "Issue response did not include an Issue type",
        ),
      );
    });
  });

  test("marks native relationships incomplete when summaries are missing", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            repository_url: "https://api.github.com/repos/dathra/dathra",
            body: "",
            labels: [],
          };
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const nativeRelationships = requireRecord(
        requireRecord(result.completeness).nativeRelationships,
      );
      assert.equal(nativeRelationships.status, "incomplete");
      assert.deepEqual(requireStringArray(nativeRelationships.missingSources).sort(), [
        "blockedBy",
        "blocking",
        "children",
      ]);
    });
  });

  test("rejects a malformed owning Issue response", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {};
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      assert.throws(
        () =>
          collectInputs(fakeClient, {
            repository: "dathra/dathra",
            issueNumber: 42,
            root,
          }),
        /not a valid Issue record/,
      );
    });
  });

  test("rejects an owning Issue response for a different Issue number", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return { number: 99, title: "Wrong Issue", labels: [] };
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      assert.throws(
        () =>
          collectInputs(fakeClient, {
            repository: "dathra/dathra",
            issueNumber: 42,
            root,
          }),
        /not a valid Issue record/,
      );
    });
  });

  test("rejects an owning Issue response from a different repository", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            title: "Wrong Repository",
            labels: [],
            repository_url: "https://api.github.com/repos/other/repo",
          };
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      assert.throws(
        () =>
          collectInputs(fakeClient, {
            repository: "dathra/dathra",
            issueNumber: 42,
            root,
          }),
        /not a valid Issue record/,
      );
    });
  });

  test("rejects an owning Issue response without repository identity", () => {
    for (const repositoryUrl of [undefined, null]) {
      const issue: Record<string, unknown> = {
        number: 42,
        title: "Missing Repository Identity",
        labels: [],
      };
      if (repositoryUrl !== undefined) {
        issue.repository_url = repositoryUrl;
      }
      const fakeClient = {
        api(endpoint: string): unknown {
          if (endpoint === "repos/dathra/dathra/issues/42") {
            return issue;
          }
          throw new Error(`unexpected endpoint: ${endpoint}`);
        },
      };

      withTemporaryDirectory((root) => {
        assert.throws(
          () =>
            collectInputs(fakeClient, {
              repository: "dathra/dathra",
              issueNumber: 42,
              root,
            }),
          /not a valid Issue record/,
        );
      });
    }
  });

  test("marks native relationships incomplete when counts do not match summaries", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            repository_url: "https://api.github.com/repos/dathra/dathra",
            body: "",
            labels: [],
            sub_issues_summary: { total: 2 },
            issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
          };
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        if (endpoint.endsWith("/sub_issues?per_page=100")) {
          return [
            {
              number: 43,
              title: "Child",
              labels: [],
              repository_url: "https://api.github.com/repos/dathra/dathra",
            },
          ];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const nativeRelationships = requireRecord(
        requireRecord(result.completeness).nativeRelationships,
      );
      assert.equal(nativeRelationships.status, "incomplete");
      assert.deepEqual(requireStringArray(nativeRelationships.missingSources), ["children"]);
      assert.ok(
        requireStringArray(result.warnings).some((warning) =>
          warning.includes("Children count 1 did not match summary total 2"),
        ),
      );
    });
  });

  test("marks malformed native relationship records incomplete", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            repository_url: "https://api.github.com/repos/dathra/dathra",
            body: "",
            labels: [],
            sub_issues_summary: { total: 1 },
            issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
          };
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        if (endpoint.endsWith("/sub_issues?per_page=100")) {
          return [{}];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const nativeRelationships = requireRecord(
        requireRecord(result.completeness).nativeRelationships,
      );
      assert.equal(nativeRelationships.status, "incomplete");
      assert.deepEqual(requireStringArray(nativeRelationships.missingSources), ["children"]);
      assert.ok(
        requireStringArray(result.warnings).includes(
          "children response contains invalid Issue records",
        ),
      );
    });
  });

  test("marks references incomplete when timeline Issue records are malformed", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            repository_url: "https://api.github.com/repos/dathra/dathra",
            body: "",
            labels: [],
            sub_issues_summary: { total: 0 },
            issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
          };
        }
        if (endpoint.endsWith("/comments?per_page=100")) {
          return [];
        }
        if (endpoint.endsWith("/timeline?per_page=100")) {
          return [{ source: { issue: null } }];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const references = requireRecord(requireRecord(result.completeness).references);
      assert.equal(references.status, "incomplete");
      assert.deepEqual(requireStringArray(references.missingSources), ["timeline"]);
      assert.ok(
        requireStringArray(result.warnings).includes(
          "timeline contains invalid source.issue records",
        ),
      );
    });
  });

  test("treats an omitted parent relationship as no parent when summaries are valid", () => {
    const fakeClient = {
      api(endpoint: string): unknown {
        if (endpoint === "repos/dathra/dathra/issues/42") {
          return {
            number: 42,
            repository_url: "https://api.github.com/repos/dathra/dathra",
            body: "",
            labels: [],
            sub_issues_summary: { total: 0 },
            issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
          };
        }
        if (
          endpoint.endsWith("/comments?per_page=100") ||
          endpoint.endsWith("/timeline?per_page=100")
        ) {
          return [];
        }
        throw new Error(`unexpected endpoint: ${endpoint}`);
      },
    };

    withTemporaryDirectory((root) => {
      const result = collectInputs(fakeClient, {
        repository: "dathra/dathra",
        issueNumber: 42,
        root,
      });
      const completeness = requireRecord(result.completeness);
      assert.equal(requireRecord(completeness.nativeRelationships).status, "collected");
      assert.equal(requireRecord(result.relationships).parent, null);
    });
  });

  test("reads Proposal Progress from Issue field values", () => {
    const issue = {
      number: 42,
      type: { name: "Proposal" },
      issue_field_values: [
        {
          issue_field_name: "Proposal Progress",
          single_select_option: { name: "In Progress" },
        },
      ],
    };

    assert.equal(normalizeIssue(issue).proposalProgress, "In Progress");
  });
});

describe("Private output", () => {
  test("creates a private file without overwriting a file or symlink", () => {
    withTemporaryDirectory((directory) => {
      const path = join(directory, "inputs.json");

      writeOutput(path, "{}");

      assert.equal(readFileSync(path, "utf8"), "{}\n");
      assert.equal(statSync(path).mode & 0o777, 0o600);
      assert.throws(() => writeOutput(path, "replacement"), { code: "EEXIST" });

      const symlink = join(directory, "inputs-link.json");
      symlinkSync(path, symlink);
      assert.throws(() => writeOutput(symlink, "replacement"), { code: "EEXIST" });
      assert.ok(lstatSync(symlink).isSymbolicLink());
      assert.equal(readFileSync(path, "utf8"), "{}\n");
    });
  });
});

describe("Command line", () => {
  test("requires --output for source-bearing JSON", () => {
    const script = fileURLToPath(new URL("./collect_issue_inputs.mts", import.meta.url));
    const result = spawnSync(process.execPath, [script, "42", "--repo", "dathra/dathra"], {
      encoding: "utf8",
    });

    assert.equal(result.status, 1);
    assert.equal(result.stdout, "");
    assert.match(result.stderr, /--output is required/);
  });

  test("collects and writes a successful CLI result", () => {
    withTemporaryDirectory((directory) => {
      const script = fileURLToPath(new URL("./collect_issue_inputs.mts", import.meta.url));
      const ghPath = join(directory, "gh");
      const outputPath = join(directory, "inputs.json");
      const issue = {
        number: 42,
        repository_url: "https://api.github.com/repos/dathra/dathra",
        title: "Decide ownership",
        type: { name: "Proposal" },
        body: `## Decision to make

- Choose the owner.

## Context and evidence

- Current ownership is unclear.

## Options considered

- Keep the current owner.

## Decision criteria

- Keep ownership explicit.

## Acceptance criteria

- Record the selected owner.

## Non-goals

- Production implementation.`,
        labels: [],
        sub_issues_summary: { total: 0 },
        issue_dependencies_summary: { total_blocked_by: 0, total_blocking: 0 },
      };
      const fakeGh = `#!/usr/bin/env node
const args = process.argv.slice(2);
const endpoint = args.at(-1);
const issue = ${JSON.stringify(issue)};
if (args[0] !== "api") {
  process.stderr.write("unexpected gh command\\n");
  process.exit(1);
}
if (endpoint === "repos/dathra/dathra/issues/42") {
  process.stdout.write(JSON.stringify(issue));
} else if (endpoint.endsWith("/comments?per_page=100") || endpoint.endsWith("/timeline?per_page=100")) {
  process.stdout.write(JSON.stringify([[]]));
} else {
  process.stderr.write("unexpected gh endpoint\\n");
  process.exit(1);
}
`;
      writeFileSync(ghPath, fakeGh, "utf8");
      chmodSync(ghPath, 0o700);

      const result = spawnSync(
        process.execPath,
        [script, "42", "--repo", "dathra/dathra", "--root", directory, "--output", outputPath],
        {
          encoding: "utf8",
          env: { ...process.env, PATH: `${directory}:${process.env.PATH ?? ""}` },
        },
      );

      assert.equal(result.status, 0, result.stderr);
      assert.equal(result.stdout, "");
      requireRecord(JSON.parse(readFileSync(outputPath, "utf8")));
      assert.equal(statSync(outputPath).mode & 0o777, 0o600);
    });
  });
});
