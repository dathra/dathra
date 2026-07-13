import assert from "node:assert/strict";
import {
  mkdir,
  mkdtemp,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import test from "node:test";

const IMPLEMENTATION_PATH = fileURLToPath(
  new URL("./implementation.mjs", import.meta.url),
);

function runProcess(command, args, cwd) {
  return spawnSync(command, args, {
    cwd,
    encoding: "utf8",
  });
}

function runGit(cwd, args) {
  const result = runProcess("git", args, cwd);
  assert.equal(result.status, 0, result.stderr);
  return result.stdout.trim();
}

function runCli(cwd, args) {
  return runProcess(process.execPath, [IMPLEMENTATION_PATH, ...args], cwd);
}

async function createRepositoryFixture(t) {
  const directory = await mkdtemp(join(tmpdir(), "review-evidence-"));
  t.after(async () => {
    await rm(directory, { force: true, recursive: true });
  });

  runGit(directory, ["init", "--initial-branch=main"]);
  runGit(directory, ["config", "user.email", "fixture@example.test"]);
  runGit(directory, ["config", "user.name", "Fixture"]);

  await writeFile(
    join(directory, "design.md"),
    [
      "prefix",
      "## REVIEW-DECISION",
      "The candidate must preserve this decision.",
      "## NEXT-DECISION",
      "## SECOND-DECISION",
      "A second independently ordered anchor.",
      "## END-DECISION",
      "suffix",
      "",
    ].join("\n"),
  );
  await writeFile(join(directory, "dependency.txt"), "stable dependency\n");
  await writeFile(
    join(directory, "second-dependency.txt"),
    "second stable dependency\n",
  );
  await writeFile(join(directory, "second-target.txt"), "second before\n");
  await writeFile(join(directory, "target.txt"), "before\n");
  runGit(directory, ["add", "."]);
  runGit(directory, ["commit", "-m", "base"]);
  const base = runGit(directory, ["rev-parse", "HEAD"]);

  await writeFile(join(directory, "second-target.txt"), "second after\n");
  await writeFile(join(directory, "target.txt"), "after\n");
  runGit(directory, ["add", "second-target.txt", "target.txt"]);
  runGit(directory, ["commit", "-m", "candidate"]);
  const candidate = runGit(directory, ["rev-parse", "HEAD"]);
  await writeFile(join(directory, "proposal.md"), "# Fixed proposal\n");

  const input = {
    schemaVersion: 1,
    reviewId: "FIXTURE-R1",
    base,
    candidate,
    proposal: { path: "proposal.md" },
    writeSet: ["target.txt", "second-target.txt"],
    dependencies: [
      {
        id: "stable-dependency",
        revision: base,
        paths: ["dependency.txt"],
      },
      {
        id: "second-dependency",
        revision: base,
        paths: ["second-dependency.txt"],
      },
    ],
    decisionAnchors: [
      {
        id: "review-decision",
        revision: base,
        path: "design.md",
        startLine: "## REVIEW-DECISION",
        endLine: "## NEXT-DECISION",
      },
      {
        id: "second-decision",
        revision: base,
        path: "design.md",
        startLine: "## SECOND-DECISION",
        endLine: "## END-DECISION",
      },
    ],
    gates: [
      {
        id: "focused-test",
        command: ["node", "--test", "fixture.test.mjs"],
        exitCode: 0,
        summary: "passed",
      },
      {
        id: "scoped-lint",
        command: ["oxlint", "fixture.mjs"],
        exitCode: 0,
        summary: "clean",
      },
    ],
  };
  const inputPath = join(directory, "input.json");
  await writeFile(inputPath, `${JSON.stringify(input, null, 2)}\n`);

  return { base, candidate, directory, input, inputPath };
}

test("generates byte-identical evidence and verifies it", async (t) => {
  const fixture = await createRepositoryFixture(t);
  const firstPath = join(fixture.directory, "first.json");
  const secondPath = join(fixture.directory, "second.json");
  const reorderedPath = join(fixture.directory, "reordered.json");

  const first = runCli(fixture.directory, [
    "generate",
    "--input",
    fixture.inputPath,
    "--output",
    firstPath,
  ]);
  assert.equal(first.status, 0, first.stderr);
  const second = runCli(fixture.directory, [
    "generate",
    "--input",
    fixture.inputPath,
    "--output",
    secondPath,
  ]);
  assert.equal(second.status, 0, second.stderr);

  const firstBytes = await readFile(firstPath, "utf8");
  const secondBytes = await readFile(secondPath, "utf8");
  assert.equal(firstBytes, secondBytes);
  assert.equal(first.stdout, firstBytes);

  const reorderedInput = Object.fromEntries(
    Object.entries({
      ...fixture.input,
      decisionAnchors: [...fixture.input.decisionAnchors].reverse(),
      dependencies: [...fixture.input.dependencies]
        .reverse()
        .map((dependency) => ({
          ...dependency,
          paths: [...dependency.paths].reverse(),
        })),
      gates: [...fixture.input.gates].reverse(),
      writeSet: [...fixture.input.writeSet].reverse(),
    }).reverse(),
  );
  const reorderedInputPath = join(fixture.directory, "reordered-input.json");
  await writeFile(
    reorderedInputPath,
    `${JSON.stringify(reorderedInput, null, 2)}\n`,
  );
  const reordered = runCli(fixture.directory, [
    "generate",
    "--input",
    reorderedInputPath,
    "--output",
    reorderedPath,
  ]);
  assert.equal(reordered.status, 0, reordered.stderr);
  assert.equal(await readFile(reorderedPath, "utf8"), firstBytes);

  const evidence = JSON.parse(firstBytes);
  assert.equal(evidence.schemaVersion, 1);
  assert.equal(evidence.manifest.reviewId, "FIXTURE-R1");
  assert.equal(evidence.manifest.base.oid, fixture.base);
  assert.equal(evidence.manifest.candidate.oid, fixture.candidate);
  assert.deepEqual(
    evidence.manifest.writeSet.map(({ path }) => path),
    ["second-target.txt", "target.txt"],
  );
  assert.equal(evidence.manifest.writeSet[0].status, "M");
  assert.match(evidence.manifest.writeSet[0].after.sha256, /^[0-9a-f]{64}$/u);
  assert.deepEqual(
    evidence.manifest.dependencies.map(({ id }) => id),
    ["second-dependency", "stable-dependency"],
  );
  assert.deepEqual(
    evidence.manifest.decisionAnchors.map(({ id }) => id),
    ["review-decision", "second-decision"],
  );
  assert.match(
    evidence.manifest.decisionAnchors[0].excerpt.sha256,
    /^[0-9a-f]{64}$/u,
  );
  assert.equal(evidence.manifest.gates[0].exitCode, 0);
  assert.match(evidence.attestation.manifestSha256, /^[0-9a-f]{64}$/u);
  assert.equal(
    runGit(fixture.directory, [
      "cat-file",
      "blob",
      evidence.manifest.proposal.blobOid,
    ]),
    "# Fixed proposal",
  );
  assert.equal(
    runGit(fixture.directory, [
      "cat-file",
      "blob",
      evidence.manifest.decisionAnchors[0].excerpt.blobOid,
    ]),
    [
      "## REVIEW-DECISION",
      "The candidate must preserve this decision.",
      "## NEXT-DECISION",
    ].join("\n"),
  );

  const verification = runCli(fixture.directory, [
    "verify",
    "--input",
    fixture.inputPath,
    "--evidence",
    firstPath,
  ]);
  assert.equal(verification.status, 0, verification.stderr);
  assert.equal(verification.stdout, firstBytes);
});

test("rejects tampered evidence without rewriting it", async (t) => {
  const fixture = await createRepositoryFixture(t);
  const evidencePath = join(fixture.directory, "evidence.json");
  const generated = runCli(fixture.directory, [
    "generate",
    "--input",
    fixture.inputPath,
    "--output",
    evidencePath,
  ]);
  assert.equal(generated.status, 0, generated.stderr);

  const tampered = JSON.parse(await readFile(evidencePath, "utf8"));
  tampered.manifest.reviewId = "TAMPERED";
  const tamperedBytes = `${JSON.stringify(tampered, null, 2)}\n`;
  await writeFile(evidencePath, tamperedBytes);

  const verification = runCli(fixture.directory, [
    "verify",
    "--input",
    fixture.inputPath,
    "--evidence",
    evidencePath,
  ]);
  assert.notEqual(verification.status, 0);
  assert.match(verification.stderr, /Evidence mismatch/u);
  assert.equal(await readFile(evidencePath, "utf8"), tamperedBytes);
});

test("rejects an incorrect write set and a failed gate", async (t) => {
  const fixture = await createRepositoryFixture(t);

  const wrongWriteSet = {
    ...fixture.input,
    writeSet: ["dependency.txt"],
  };
  const wrongWriteSetPath = join(fixture.directory, "wrong-write-set.json");
  await writeFile(
    wrongWriteSetPath,
    `${JSON.stringify(wrongWriteSet, null, 2)}\n`,
  );
  const writeSetResult = runCli(fixture.directory, [
    "generate",
    "--input",
    wrongWriteSetPath,
  ]);
  assert.notEqual(writeSetResult.status, 0);
  assert.match(writeSetResult.stderr, /Write set mismatch/u);

  const preservedOutputPath = join(fixture.directory, "preserved-output.json");
  await writeFile(preservedOutputPath, "preserve me\n");
  const preservingResult = runCli(fixture.directory, [
    "generate",
    "--input",
    wrongWriteSetPath,
    "--output",
    preservedOutputPath,
  ]);
  assert.notEqual(preservingResult.status, 0);
  assert.equal(await readFile(preservedOutputPath, "utf8"), "preserve me\n");

  const failedGate = {
    ...fixture.input,
    gates: [{ ...fixture.input.gates[0], exitCode: 1 }],
  };
  const failedGatePath = join(fixture.directory, "failed-gate.json");
  await writeFile(failedGatePath, `${JSON.stringify(failedGate, null, 2)}\n`);
  const gateResult = runCli(fixture.directory, [
    "generate",
    "--input",
    failedGatePath,
  ]);
  assert.notEqual(gateResult.status, 0);
  assert.match(gateResult.stderr, /exitCode must be 0/u);

  const unknownField = { ...fixture.input, ignoredEvidence: true };
  const unknownFieldPath = join(fixture.directory, "unknown-field.json");
  await writeFile(
    unknownFieldPath,
    `${JSON.stringify(unknownField, null, 2)}\n`,
  );
  const unknownFieldResult = runCli(fixture.directory, [
    "generate",
    "--input",
    unknownFieldPath,
  ]);
  assert.notEqual(unknownFieldResult.status, 0);
  assert.match(unknownFieldResult.stderr, /unknown keys/u);

  const blockedOutputPath = join(fixture.directory, "blocked-output");
  await mkdir(blockedOutputPath);
  const renameResult = runCli(fixture.directory, [
    "generate",
    "--input",
    fixture.inputPath,
    "--output",
    blockedOutputPath,
  ]);
  assert.notEqual(renameResult.status, 0);
  assert.equal(
    (await readdir(fixture.directory)).some((name) =>
      name.startsWith("blocked-output.tmp-"),
    ),
    false,
  );
});
