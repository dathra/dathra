import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { classifyCiChanges, formatCiOutputs } from "./classify-ci-changes.mjs";

const noChecks = {
  fmt: false,
  lint: false,
  typecheck: false,
  test: false,
  e2e: false,
};
const allChecks = {
  fmt: true,
  lint: true,
  typecheck: true,
  test: true,
  e2e: true,
};
const classifierPath = fileURLToPath(new URL("./classify-ci-changes.mjs", import.meta.url));

test("empty changes do not run verification jobs", () => {
  assert.deepEqual(classifyCiChanges([]), noChecks);
});

test("documentation and repository metadata do not run verification jobs", () => {
  const paths = [
    "README.md",
    "docs/getting-started.md",
    ".agents/skills/example/SKILL.md",
    ".github/ISSUE_TEMPLATE/task.yaml",
    ".github/agents/Architect.md",
    ".opencode/plugins/format-lint.ts",
    ".workspace/package.json",
    "SPEC/SPEC.typ",
  ];

  assert.deepEqual(classifyCiChanges(paths), noChecks);
});

test("unknown paths conservatively run all verification jobs", () => {
  assert.deepEqual(classifyCiChanges(["new-root-build-config.ts"]), allChecks);
  assert.deepEqual(classifyCiChanges([".github/actions/new-ci-action/action.yaml"]), allChecks);
});

test("package changes run all verification jobs", () => {
  assert.deepEqual(classifyCiChanges(["packages/shared/src/example/implementation.ts"]), allChecks);
});

test("shared configuration and dependency files run all verification jobs", async (context) => {
  const paths = [
    ".npmrc",
    "mise.toml",
    "package.json",
    "pnpm-lock.yaml",
    "pnpm-workspace.yaml",
    "config/oxlint/package.json",
  ];

  for (const path of paths) {
    await context.test(path, () => {
      assert.deepEqual(classifyCiChanges([path]), allChecks);
    });
  }
});

test("CI infrastructure changes run all verification jobs", async (context) => {
  const paths = [
    ".github/actions/setup-pnpm/action.yaml",
    ".github/scripts/classify-ci-changes.mjs",
    ".github/workflows/ci.yaml",
    ".github/workflows/ci-typecheck.yaml",
  ];

  for (const path of paths) {
    await context.test(path, () => {
      assert.deepEqual(classifyCiChanges([path]), allChecks);
    });
  }
});

test("e2e playground changes run format and e2e jobs", () => {
  assert.deepEqual(classifyCiChanges(["playgrounds/e2e/tests/example.test.ts"]), {
    ...noChecks,
    fmt: true,
    e2e: true,
  });
});

test("other playground changes only run the format job", () => {
  assert.deepEqual(classifyCiChanges(["playgrounds/vanilla/src/main.ts"]), {
    ...noChecks,
    fmt: true,
  });
});

test("the docs workspace manifest runs the format job", () => {
  assert.deepEqual(classifyCiChanges(["docs/package.json"]), {
    ...noChecks,
    fmt: true,
  });
});

test("gitignore changes only run the format job", () => {
  assert.deepEqual(classifyCiChanges([".gitignore"]), {
    ...noChecks,
    fmt: true,
  });
});

test("multiple paths combine their verification requirements", () => {
  const paths = ["README.md", ".gitignore", "playgrounds/e2e/playwright.config.ts"];

  assert.deepEqual(classifyCiChanges(paths), {
    ...noChecks,
    fmt: true,
    e2e: true,
  });
});

test("GitHub Actions outputs have stable names and ordering", () => {
  assert.equal(
    formatCiOutputs({ ...noChecks, fmt: true, test: true }),
    "fmt=true\nlint=false\ntypecheck=false\ntest=true\ne2e=false",
  );
});

test("CLI reads NUL-delimited paths and writes GitHub Actions outputs", () => {
  const result = spawnSync(process.execPath, [classifierPath], {
    input: "README.md\0playgrounds/e2e/tests/example.test.ts\0",
    encoding: "utf8",
  });

  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stderr, "");
  assert.equal(result.stdout, "fmt=true\nlint=false\ntypecheck=false\ntest=false\ne2e=true\n");
});
