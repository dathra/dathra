/** Review-only source checks; these do not exercise a production runtime or bundler. */
import assert from "node:assert/strict";
import { readFileSync, existsSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const examples = dirname(fileURLToPath(import.meta.url));
const proposal = readFileSync(resolve(examples, "../262.typ"), "utf8");
const [inputsPath, emittedDirectory] = process.argv.slice(2);
assert(inputsPath && emittedDirectory, "Usage: node verify.mjs <collector.json> <ts-emit-directory>");
const inputs = JSON.parse(readFileSync(inputsPath, "utf8"));
assert.equal(inputs.warnings.length, 0, "Collector warnings must be resolved");
for (const [name, group] of Object.entries(inputs.completeness)) {
  assert.equal(group.status, "collected", `${name} must be collected`);
}

const documented = [];
for (const match of proposal.matchAll(/^[ \t]*```ts\n([\s\S]*?)^[ \t]*```/gm)) {
  const lines = match[1].split("\n");
  const file = lines[0].trim().match(/^\/\/ ([\w.-]+\.ts)$/)?.[1];
  if (!file) continue;
  const indentation = lines[0].match(/^ */)[0].length;
  const source = lines.slice(1).map((line) => line.slice(indentation)).join("\n");
  assert.equal(source.trimEnd(), readFileSync(resolve(examples, file), "utf8").trimEnd(), file);
  documented.push(file);
}
assert.equal(documented.length, 10, "All ten complete documented modules must match");
assert.equal(new Set(documented).size, documented.length);

const coverageSection = proposal.split("== Issue #262 の要件 coverage")[1];
assert(coverageSection, "Coverage section is required");
const rows = [...coverageSection.matchAll(/^  \[([^\]]+):(\d+)\],/gm)]
  .map((row) => `${row[1]}:${row[2]}`);
const candidates = Object.values(inputs.requirements).flat();
for (const candidate of candidates) {
  assert.equal(candidate.source.kind, "issue-body");
  assert.equal(candidate.source.issue, 262);
}
const requiredRows = candidates.map(({ source }) => `${source.heading}:${source.line}`);
assert.equal(candidates.length, 27);
assert.deepEqual(rows.toSorted(), requiredRows.toSorted(), "One row per unchanged source candidate");

const visited = new Set();
function visit(file) {
  if (visited.has(file)) return;
  visited.add(file);
  const source = readFileSync(resolve(emittedDirectory, file), "utf8");
  assert(!/\.server|@dathra\/(?:core\/)?server/.test(source), `${file}: server reference survived emit`);
  assert(!/\bimport\s*\(/.test(source), `${file}: dynamic imports need a separate checker`);
  for (const match of source.matchAll(/\b(?:import|export)[^;]*?\bfrom\s+["']([^"']+)["']/g)) {
    const specifier = match[1];
    if (specifier.startsWith("./")) {
      const child = `${specifier.slice(2)}.js`;
      assert(existsSync(resolve(emittedDirectory, child)), `Missing emitted dependency ${child}`);
      visit(child);
    } else {
      assert.equal(specifier, "@dathra/core/client", `Unexpected client dependency ${specifier}`);
    }
  }
}
for (const file of ["snapshot.client.js", "cart.client.js", "details.client.js"]) visit(file);
assert(visited.has("snapshot.display.js") && visited.has("cart.display.js"));
console.log(JSON.stringify({ completeModules: documented.length, coverage: `${rows.length}/${candidates.length}`, staticClientModules: [...visited].toSorted(), limitations: "Review stubs and ordinary emitted imports only; no production runtime, dynamic graph or bundler proof" }, null, 2));
