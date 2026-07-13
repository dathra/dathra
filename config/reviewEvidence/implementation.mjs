#!/usr/bin/env node

import { readFile, rename, unlink, writeFile } from "node:fs/promises";
import { resolve } from "node:path";

import { canonicalJson } from "./canonical.mjs";
import { createEvidence } from "./evidence.mjs";

function fail(message) {
  throw new Error(message);
}

async function readJson(path, label) {
  let parsed;
  try {
    parsed = JSON.parse(await readFile(path, "utf8"));
  } catch (error) {
    fail(`${label} must be readable JSON: ${error.message}`);
  }
  return parsed;
}

async function writeAtomic(path, bytes) {
  const temporaryPath = `${path}.tmp-${process.pid}`;
  try {
    await writeFile(temporaryPath, bytes, { flag: "wx" });
    await rename(temporaryPath, path);
  } finally {
    await unlink(temporaryPath).catch(() => undefined);
  }
}

function parseArguments(args) {
  const normalizedArgs = args[0] === "--" ? args.slice(1) : args;
  const [command, ...rest] = normalizedArgs;
  if (command === undefined || command === "--help" || command === "help") {
    return { command: "help" };
  }
  if (command !== "generate" && command !== "verify") {
    fail(`Unknown command ${JSON.stringify(command)}`);
  }

  const options = new Map();
  for (let index = 0; index < rest.length; index += 2) {
    const name = rest[index];
    const value = rest[index + 1];
    if (value === undefined || !name.startsWith("--")) {
      fail("Options must use --name value pairs");
    }
    if (options.has(name)) fail(`Duplicate option ${name}`);
    options.set(name, value);
  }
  const allowed =
    command === "generate"
      ? new Set(["--input", "--output"])
      : new Set(["--evidence", "--input"]);
  for (const name of options.keys()) {
    if (!allowed.has(name)) fail(`Unknown option ${name}`);
  }
  if (!options.has("--input")) fail("--input is required");
  if (command === "verify" && !options.has("--evidence")) {
    fail("--evidence is required for verify");
  }
  return { command, options };
}

function printUsage() {
  process.stdout.write(
    [
      "Usage:",
      "  review:evidence generate --input <input.json> [--output <evidence.json>]",
      "  review:evidence verify --input <input.json> --evidence <evidence.json>",
      "",
    ].join("\n"),
  );
}

/** Runs the review evidence command without mutating Git refs or the index. */
async function main(args) {
  const parsed = parseArguments(args);
  if (parsed.command === "help") {
    printUsage();
    return;
  }

  const inputPath = resolve(parsed.options.get("--input"));
  const input = await readJson(inputPath, "input");
  const evidence = await createEvidence(input, process.cwd());
  const evidenceBytes = canonicalJson(evidence);

  if (parsed.command === "generate") {
    const output = parsed.options.get("--output");
    if (output !== undefined) await writeAtomic(resolve(output), evidenceBytes);
  } else {
    const evidencePath = resolve(parsed.options.get("--evidence"));
    const expected = await readJson(evidencePath, "evidence");
    if (canonicalJson(expected) !== evidenceBytes) {
      fail("Evidence mismatch: stored evidence is stale or was modified");
    }
  }

  process.stdout.write(evidenceBytes);
}

try {
  await main(process.argv.slice(2));
} catch (error) {
  const message = error instanceof Error ? error.message : String(error);
  process.stderr.write(`review:evidence: ${message}\n`);
  process.exitCode = 1;
}
