import { createHash } from "node:crypto";

/** Compares strings by code unit without locale-dependent collation. */
function compareStrings(left, right) {
  if (left < right) return -1;
  if (left > right) return 1;
  return 0;
}

function canonicalize(value) {
  if (Array.isArray(value)) return value.map(canonicalize);
  if (value === null || typeof value !== "object") return value;

  return Object.fromEntries(
    Object.keys(value)
      .sort(compareStrings)
      .map((key) => [key, canonicalize(value[key])]),
  );
}

/** Serializes JSON data with deterministic key ordering and one final newline. */
function canonicalJson(value) {
  return `${JSON.stringify(canonicalize(value), null, 2)}\n`;
}

/** Computes a lowercase SHA-256 digest for strings or bytes. */
function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

export { canonicalJson, compareStrings, sha256 };
