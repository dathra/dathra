import { pathToFileURL } from "node:url";

const CHECK_NAMES = ["fmt", "lint", "typecheck", "test", "e2e"];
const ALL_CHECK_FILES = new Set([
  ".npmrc",
  "mise.toml",
  "package.json",
  "pnpm-lock.yaml",
  "pnpm-workspace.yaml",
]);
const VERIFICATION_NEUTRAL_FILES = new Set([
  ".github/copilot-instructions.md",
  ".github/release-drafter.yml",
  ".github/workflows/release-packages.yaml",
  "dathra.code-workspace",
  "opencode.jsonc",
  "rlse.config.ts",
  "tui.json",
  "typst.toml",
]);
const VERIFICATION_NEUTRAL_PREFIXES = [
  ".agents/",
  ".github/ISSUE_TEMPLATE/",
  ".github/agents/",
  ".github/instructions/",
  ".github/prompts/",
  ".opencode/",
  ".workspace/",
  "SPEC/",
  "docs/",
];
const CI_WORKFLOW_PATTERN = /^\.github\/workflows\/ci(?:-[^/]+)?\.yaml$/;

const createResult = () => ({
  fmt: false,
  lint: false,
  typecheck: false,
  test: false,
  e2e: false,
});

const enableAllChecks = (result) => {
  for (const checkName of CHECK_NAMES) {
    result[checkName] = true;
  }
};

const affectsAllChecks = (path) =>
  ALL_CHECK_FILES.has(path) ||
  path.startsWith("config/") ||
  path.startsWith(".github/actions/setup-pnpm/") ||
  path.startsWith(".github/scripts/") ||
  CI_WORKFLOW_PATTERN.test(path);

const isVerificationNeutral = (path) =>
  VERIFICATION_NEUTRAL_FILES.has(path) ||
  VERIFICATION_NEUTRAL_PREFIXES.some((prefix) => path.startsWith(prefix)) ||
  /^[^/]+\.md$/.test(path);

/**
 * Classifies changed repository paths by the verification jobs they affect.
 *
 * @param {Iterable<string>} paths Changed paths relative to the repository root.
 * @returns {{fmt: boolean, lint: boolean, typecheck: boolean, test: boolean, e2e: boolean}}
 */
const classifyCiChanges = (paths) => {
  const result = createResult();

  for (const path of paths) {
    if (affectsAllChecks(path) || path.startsWith("packages/")) {
      enableAllChecks(result);
      continue;
    }

    if (path === ".gitignore") {
      result.fmt = true;
      continue;
    }

    if (path === "docs/package.json") {
      result.fmt = true;
      continue;
    }

    if (path.startsWith("playgrounds/")) {
      result.fmt = true;

      if (path.startsWith("playgrounds/e2e/")) {
        result.e2e = true;
      }

      continue;
    }

    if (isVerificationNeutral(path)) {
      continue;
    }

    enableAllChecks(result);
  }

  return result;
};

/**
 * Formats a classification as GitHub Actions output entries.
 *
 * @param {{fmt: boolean, lint: boolean, typecheck: boolean, test: boolean, e2e: boolean}} result
 * @returns {string}
 */
const formatCiOutputs = (result) =>
  CHECK_NAMES.map((checkName) => `${checkName}=${result[checkName]}`).join("\n");

const isMainModule =
  process.argv[1] !== undefined && import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMainModule) {
  const chunks = [];

  for await (const chunk of process.stdin) {
    chunks.push(chunk);
  }

  const paths = Buffer.concat(chunks)
    .toString("utf8")
    .split("\0")
    .filter((path) => path.length > 0);
  const outputs = formatCiOutputs(classifyCiChanges(paths));

  process.stdout.write(`${outputs}\n`);
}

export { classifyCiChanges, formatCiOutputs };
