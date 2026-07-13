import { lstat, readFile } from "node:fs/promises";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { canonicalJson, compareStrings, sha256 } from "./canonical.mjs";
import {
  findRepositoryRoot,
  hashBlob,
  isAncestor,
  readBlob,
  readCandidateDiff,
  readRevisionFile,
  resolveCommit,
  resolveTree,
  verifyCandidateParent,
} from "./repository.mjs";

const SCHEMA_VERSION = 1;

function fail(message) {
  throw new Error(message);
}

function expectObject(value, label) {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be an object`);
  }
  return value;
}

function expectArray(value, label) {
  if (!Array.isArray(value)) fail(`${label} must be an array`);
  return value;
}

function expectString(value, label) {
  if (typeof value !== "string" || value.length === 0) {
    fail(`${label} must be a non-empty string`);
  }
  return value;
}

function expectInteger(value, label) {
  if (!Number.isSafeInteger(value)) fail(`${label} must be a safe integer`);
  return value;
}

function expectExactKeys(value, keys, label) {
  const allowed = new Set(keys);
  const unexpected = Object.keys(value).filter((key) => !allowed.has(key));
  if (unexpected.length !== 0) {
    fail(
      `${label} contains unknown keys: ${unexpected.sort(compareStrings).join(", ")}`,
    );
  }
}

function sortedUnique(values, label) {
  const sorted = [...values].sort(compareStrings);
  for (let index = 1; index < sorted.length; index += 1) {
    if (sorted[index - 1] === sorted[index]) {
      fail(
        `${label} contains duplicate value ${JSON.stringify(sorted[index])}`,
      );
    }
  }
  return sorted;
}

function resolveRepositoryPath(root, value, label) {
  const path = expectString(value, label);
  if (isAbsolute(path) || path.includes("\\") || path.includes("\0")) {
    fail(`${label} must be a normalized repository-relative path`);
  }

  const absolutePath = resolve(root, path);
  const relativePath = relative(root, absolutePath);
  const normalized = relativePath.split(sep).join("/");
  if (
    relativePath.length === 0 ||
    relativePath === ".." ||
    relativePath.startsWith(`..${sep}`) ||
    isAbsolute(relativePath) ||
    normalized !== path
  ) {
    fail(`${label} must stay inside the repository and be normalized`);
  }
  return { absolutePath, path };
}

async function readProposal(root, cwd, proposalValue) {
  const proposal = expectObject(proposalValue, "proposal");
  expectExactKeys(proposal, ["path"], "proposal");
  const resolved = resolveRepositoryPath(root, proposal.path, "proposal.path");
  const fileStat = await lstat(resolved.absolutePath);
  if (!fileStat.isFile()) fail("proposal.path must identify a regular file");
  const bytes = await readFile(resolved.absolutePath);
  return {
    blobOid: hashBlob(cwd, bytes),
    mode: (fileStat.mode & 0o111) === 0 ? "100644" : "100755",
    path: resolved.path,
    sha256: sha256(bytes),
  };
}

function validateWriteSet(root, cwd, baseOid, candidateOid, writeSetValue) {
  const configuredPaths = sortedUnique(
    expectArray(writeSetValue, "writeSet").map(
      (value, index) =>
        resolveRepositoryPath(root, value, `writeSet[${index}]`).path,
    ),
    "writeSet",
  );
  if (configuredPaths.length === 0) fail("writeSet must not be empty");

  const diff = readCandidateDiff(cwd, baseOid, candidateOid);
  const diffPaths = diff.map(({ path }) => path);
  if (canonicalJson(diffPaths) !== canonicalJson(configuredPaths)) {
    fail(
      `Write set mismatch: configured ${JSON.stringify(configuredPaths)}, actual ${JSON.stringify(diffPaths)}`,
    );
  }

  return diff.map(({ path, status }) => {
    const before = readRevisionFile(cwd, baseOid, path, `base path ${path}`);
    const after = readRevisionFile(
      cwd,
      candidateOid,
      path,
      `candidate path ${path}`,
    );
    if (status === "A" && (before !== null || after === null)) {
      fail(`Added path ${path} has inconsistent Git entries`);
    }
    if (status === "D" && (before === null || after !== null)) {
      fail(`Deleted path ${path} has inconsistent Git entries`);
    }
    if (
      (status === "M" || status === "T") &&
      (before === null || after === null)
    ) {
      fail(`Changed path ${path} has inconsistent Git entries`);
    }
    return { after, before, path, status };
  });
}

function validateDependencies(
  root,
  cwd,
  candidateOid,
  writeSetPaths,
  dependenciesValue,
) {
  const dependencies = expectArray(dependenciesValue, "dependencies").map(
    (dependencyValue, dependencyIndex) => {
      const label = `dependencies[${dependencyIndex}]`;
      const dependency = expectObject(dependencyValue, label);
      expectExactKeys(dependency, ["id", "paths", "revision"], label);
      const id = expectString(dependency.id, `${label}.id`);
      const revision = expectString(dependency.revision, `${label}.revision`);
      const revisionOid = resolveCommit(cwd, revision, `${label}.revision`);
      if (!isAncestor(cwd, revisionOid, candidateOid)) {
        fail(`${label}.revision must be an ancestor of the candidate`);
      }

      const paths = sortedUnique(
        expectArray(dependency.paths, `${label}.paths`).map(
          (value, pathIndex) =>
            resolveRepositoryPath(root, value, `${label}.paths[${pathIndex}]`)
              .path,
        ),
        `${label}.paths`,
      );
      if (paths.length === 0) fail(`${label}.paths must not be empty`);

      const files = paths.map((path) => {
        if (writeSetPaths.has(path)) {
          fail(`${label}.paths must not overlap writeSet: ${path}`);
        }
        const source = readRevisionFile(
          cwd,
          revisionOid,
          path,
          `${label} path ${path}`,
        );
        const candidate = readRevisionFile(
          cwd,
          candidateOid,
          path,
          `candidate dependency path ${path}`,
        );
        if (
          source === null ||
          candidate === null ||
          source.mode !== candidate.mode ||
          source.blobOid !== candidate.blobOid
        ) {
          fail(`${label} path ${path} does not match the candidate`);
        }
        return { ...source, path };
      });
      return { files, id, revisionOid };
    },
  );

  return sortedUnique(
    dependencies.map(({ id }) => id),
    "dependencies ids",
  ).map((id) => dependencies.find((dependency) => dependency.id === id));
}

function extractAnchor(bytes, startLine, endLine, label) {
  const text = new TextDecoder("utf-8", { fatal: true }).decode(bytes);
  const lines = text.endsWith("\n")
    ? text.slice(0, -1).split("\n")
    : text.split("\n");
  const startIndexes = lines.flatMap((line, index) =>
    line === startLine ? [index] : [],
  );
  const endIndexes = lines.flatMap((line, index) =>
    line === endLine ? [index] : [],
  );
  if (startIndexes.length !== 1 || endIndexes.length !== 1) {
    fail(`${label} startLine and endLine must each match exactly once`);
  }
  const startIndex = startIndexes[0];
  const endIndex = endIndexes[0];
  if (endIndex < startIndex)
    fail(`${label}.endLine must not precede startLine`);
  return Buffer.from(`${lines.slice(startIndex, endIndex + 1).join("\n")}\n`);
}

function validateDecisionAnchors(root, cwd, candidateOid, anchorsValue) {
  const anchors = expectArray(anchorsValue, "decisionAnchors").map(
    (anchorValue, anchorIndex) => {
      const label = `decisionAnchors[${anchorIndex}]`;
      const anchor = expectObject(anchorValue, label);
      expectExactKeys(
        anchor,
        ["endLine", "id", "path", "revision", "startLine"],
        label,
      );
      const id = expectString(anchor.id, `${label}.id`);
      const revision = expectString(anchor.revision, `${label}.revision`);
      const revisionOid = resolveCommit(cwd, revision, `${label}.revision`);
      if (!isAncestor(cwd, revisionOid, candidateOid)) {
        fail(`${label}.revision must be an ancestor of the candidate`);
      }
      const path = resolveRepositoryPath(
        root,
        anchor.path,
        `${label}.path`,
      ).path;
      const startLine = expectString(anchor.startLine, `${label}.startLine`);
      const endLine = expectString(anchor.endLine, `${label}.endLine`);
      const source = readRevisionFile(
        cwd,
        revisionOid,
        path,
        `${label} source`,
      );
      if (source === null) fail(`${label}.path does not exist at its revision`);
      const excerptBytes = extractAnchor(
        readBlob(cwd, source.blobOid),
        startLine,
        endLine,
        label,
      );
      return {
        endLine,
        excerpt: {
          blobOid: hashBlob(cwd, excerptBytes),
          sha256: sha256(excerptBytes),
        },
        id,
        path,
        revisionOid,
        source,
        startLine,
      };
    },
  );

  return sortedUnique(
    anchors.map(({ id }) => id),
    "decisionAnchors ids",
  ).map((id) => anchors.find((anchor) => anchor.id === id));
}

function validateGates(gatesValue) {
  const gates = expectArray(gatesValue, "gates").map((gateValue, gateIndex) => {
    const label = `gates[${gateIndex}]`;
    const gate = expectObject(gateValue, label);
    expectExactKeys(gate, ["command", "exitCode", "id", "summary"], label);
    const id = expectString(gate.id, `${label}.id`);
    const command = expectArray(gate.command, `${label}.command`).map(
      (value, commandIndex) =>
        expectString(value, `${label}.command[${commandIndex}]`),
    );
    if (command.length === 0) fail(`${label}.command must not be empty`);
    const exitCode = expectInteger(gate.exitCode, `${label}.exitCode`);
    if (exitCode !== 0) fail(`${label}.exitCode must be 0`);
    return {
      command,
      exitCode,
      id,
      summary: expectString(gate.summary, `${label}.summary`),
    };
  });
  if (gates.length === 0) fail("gates must not be empty");

  return sortedUnique(
    gates.map(({ id }) => id),
    "gates ids",
  ).map((id) => gates.find((gate) => gate.id === id));
}

function normalizeInputForHash(source) {
  return {
    ...source,
    decisionAnchors: [...source.decisionAnchors].sort((left, right) =>
      compareStrings(left.id, right.id),
    ),
    dependencies: source.dependencies
      .map((dependency) => ({
        ...dependency,
        paths: [...dependency.paths].sort(compareStrings),
      }))
      .sort((left, right) => compareStrings(left.id, right.id)),
    gates: [...source.gates].sort((left, right) =>
      compareStrings(left.id, right.id),
    ),
    writeSet: [...source.writeSet].sort(compareStrings),
  };
}

/** Creates deterministic review evidence from validated repository inputs. */
async function createEvidence(input, cwd) {
  const source = expectObject(input, "input");
  expectExactKeys(
    source,
    [
      "base",
      "candidate",
      "decisionAnchors",
      "dependencies",
      "gates",
      "proposal",
      "reviewId",
      "schemaVersion",
      "writeSet",
    ],
    "input",
  );
  if (source.schemaVersion !== SCHEMA_VERSION) {
    fail(`schemaVersion must be ${SCHEMA_VERSION}`);
  }
  const root = findRepositoryRoot(cwd);
  const reviewId = expectString(source.reviewId, "reviewId");
  const base = expectString(source.base, "base");
  const candidate = expectString(source.candidate, "candidate");
  const baseOid = resolveCommit(cwd, base, "base");
  const candidateOid = resolveCommit(cwd, candidate, "candidate");
  verifyCandidateParent(cwd, baseOid, candidateOid);

  const writeSet = validateWriteSet(
    root,
    cwd,
    baseOid,
    candidateOid,
    source.writeSet,
  );
  const writeSetPaths = new Set(writeSet.map(({ path }) => path));
  const proposal = await readProposal(root, cwd, source.proposal);
  if (writeSetPaths.has(proposal.path)) {
    fail("proposal.path must not overlap writeSet");
  }

  const manifest = {
    base: { oid: baseOid, treeOid: resolveTree(cwd, baseOid) },
    candidate: {
      oid: candidateOid,
      parentOid: baseOid,
      treeOid: resolveTree(cwd, candidateOid),
    },
    decisionAnchors: validateDecisionAnchors(
      root,
      cwd,
      candidateOid,
      source.decisionAnchors,
    ),
    dependencies: validateDependencies(
      root,
      cwd,
      candidateOid,
      writeSetPaths,
      source.dependencies,
    ),
    gates: validateGates(source.gates),
    proposal,
    reviewId,
    schemaVersion: SCHEMA_VERSION,
    writeSet,
  };

  return {
    attestation: {
      candidateOid,
      candidateTreeOid: manifest.candidate.treeOid,
      inputSha256: sha256(canonicalJson(normalizeInputForHash(source))),
      manifestSha256: sha256(canonicalJson(manifest)),
    },
    manifest,
    schemaVersion: SCHEMA_VERSION,
  };
}

export { createEvidence };
