import { spawnSync } from "node:child_process";

import { compareStrings, sha256 } from "./canonical.mjs";

const HASH_PATTERN = /^[0-9a-f]+$/u;

function fail(message) {
  throw new Error(message);
}

function runGit(cwd, args, input) {
  const result = spawnSync("git", args, {
    cwd,
    input,
    maxBuffer: 128 * 1024 * 1024,
  });
  if (result.error !== undefined) throw result.error;
  if (result.status !== 0) {
    const detail = result.stderr.toString("utf8").trim();
    fail(`git ${args[0]} failed${detail.length === 0 ? "" : `: ${detail}`}`);
  }
  return result.stdout;
}

function runGitText(cwd, args, input) {
  return runGit(cwd, args, input).toString("utf8").trim();
}

/** Returns the root path of the Git worktree containing cwd. */
function findRepositoryRoot(cwd) {
  return runGitText(cwd, ["rev-parse", "--show-toplevel"]);
}

/** Resolves a revision expression to an exact commit OID. */
function resolveCommit(cwd, revision, label) {
  const oid = runGitText(cwd, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${revision}^{commit}`,
  ]);
  if (!HASH_PATTERN.test(oid)) fail(`${label} did not resolve to a Git OID`);
  return oid;
}

/** Resolves an exact commit OID to its tree OID. */
function resolveTree(cwd, commitOid) {
  const oid = runGitText(cwd, [
    "rev-parse",
    "--verify",
    "--end-of-options",
    `${commitOid}^{tree}`,
  ]);
  if (!HASH_PATTERN.test(oid)) fail(`Commit ${commitOid} has no tree OID`);
  return oid;
}

/** Stores bytes as an immutable Git blob and returns its OID. */
function hashBlob(cwd, bytes) {
  return runGitText(cwd, ["hash-object", "-w", "--stdin"], bytes);
}

/** Reports whether ancestorOid is an ancestor of descendantOid. */
function isAncestor(cwd, ancestorOid, descendantOid) {
  const result = spawnSync(
    "git",
    ["merge-base", "--is-ancestor", ancestorOid, descendantOid],
    { cwd, stdio: "ignore" },
  );
  if (result.error !== undefined) throw result.error;
  return result.status === 0;
}

/** Verifies that candidateOid is a single-parent child of baseOid. */
function verifyCandidateParent(cwd, baseOid, candidateOid) {
  const fields = runGitText(cwd, [
    "rev-list",
    "--parents",
    "-n",
    "1",
    candidateOid,
  ]).split(/\s+/u);
  if (
    fields.length !== 2 ||
    fields[0] !== candidateOid ||
    fields[1] !== baseOid
  ) {
    fail(`Candidate ${candidateOid} must have ${baseOid} as its only parent`);
  }
}

function parseTreeEntry(output, expectedPath, label) {
  if (output.length === 0) return null;
  const records = output.toString("utf8").split("\0").filter(Boolean);
  if (records.length !== 1)
    fail(`${label} must resolve to exactly one Git path`);

  const match = /^(\d+) ([^ ]+) ([0-9a-f]+)\t([\s\S]+)$/u.exec(records[0]);
  if (match === null || match[4] !== expectedPath) {
    fail(`${label} returned an unexpected Git tree entry`);
  }
  if (match[2] !== "blob") fail(`${label} must resolve to a blob`);
  return { mode: match[1], blobOid: match[3] };
}

/** Reads immutable file metadata from a revision, or null when absent. */
function readRevisionFile(cwd, revisionOid, path, label) {
  const entry = parseTreeEntry(
    runGit(cwd, ["ls-tree", "-z", revisionOid, "--", path]),
    path,
    label,
  );
  if (entry === null) return null;
  const bytes = readBlob(cwd, entry.blobOid);
  return {
    blobOid: entry.blobOid,
    mode: entry.mode,
    sha256: sha256(bytes),
  };
}

/** Reads a Git blob by exact OID. */
function readBlob(cwd, blobOid) {
  return runGit(cwd, ["cat-file", "blob", blobOid]);
}

/** Returns a deterministic no-renames path/status diff. */
function readCandidateDiff(cwd, baseOid, candidateOid) {
  const output = runGit(cwd, [
    "diff",
    "--name-status",
    "--no-renames",
    "-z",
    baseOid,
    candidateOid,
    "--",
  ]).toString("utf8");
  const fields = output.split("\0");
  if (fields.at(-1) === "") fields.pop();
  if (fields.length % 2 !== 0)
    fail("Candidate diff has an invalid name-status record");

  const entries = [];
  for (let index = 0; index < fields.length; index += 2) {
    const status = fields[index];
    if (!/^[AMDT]$/u.test(status)) {
      fail(
        `Candidate diff contains unsupported status ${JSON.stringify(status)}`,
      );
    }
    entries.push({ path: fields[index + 1], status });
  }
  return entries.sort((left, right) => compareStrings(left.path, right.path));
}

export {
  findRepositoryRoot,
  hashBlob,
  isAncestor,
  readBlob,
  readCandidateDiff,
  readRevisionFile,
  resolveCommit,
  resolveTree,
  verifyCandidateParent,
};
