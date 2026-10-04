import { describe, it, expect } from "vitest";
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL(".", import.meta.url));
describe("bounded #262 actual-type and emitted-graph evidence", () => {
  it("P01 uses native Signal declarations, rejects mismatches and emits finite declarations", () => {
    execFileSync(process.execPath, ["run-types.mjs"], { cwd: root, timeout: 45000 });
    const result = JSON.parse(
      readFileSync(new URL("logs/p01-result.json", import.meta.url), "utf8"),
    );
    expect(result.actualSignalOrigins).toContain("packages/reactivity/src/types/index.ts");
    expect(result.strict.pass).toBe(true);
    expect(result.unsuppressedErrors).toBe(result.strict.expectedErrorDirectives);
    expect(result.negative).toHaveLength(5);
    expect(result.declarationEmit).toBe(true);
  });
  it("P02 preserves real counterexamples and validates actual relocated bundles", () => {
    execFileSync(process.execPath, ["run-build.mjs"], { cwd: root, timeout: 45000 });
    const result = JSON.parse(
      readFileSync(new URL("logs/p02-result.json", import.meta.url), "utf8"),
    );
    expect(result.cases.find((c) => c.name === "same-shape.ts").typeScriptAloneAccepts).toBe(true);
    expect(
      result.cases.find((c) => c.name === "naive-source-vs-emitted-import-meta")
        .referencedOutputFileExists,
    ).toBe(false);
    expect(
      result.cases.find((c) => c.name === "actual-relocated-lookup").actualImports,
    ).toHaveLength(3);
    expect(
      result.cases.find((c) => c.name === "dynamic-zero-response")
        .potentialBrowserArtifactsStillExist,
    ).toBe(3);
    expect(
      result.cases.find((c) => c.name === "static-route-build-omission").generatedBrowserFiles,
    ).toBe(0);
  });
  it("P02b resolves preserved modules without framework source rewriting and shares the browser engine", () => {
    execFileSync(process.execPath, ["p02b/run-p02b.mjs"], { cwd: root, timeout: 45000 });
    const result = JSON.parse(
      readFileSync(new URL("p02b/logs/result.json", import.meta.url), "utf8"),
    );
    expect(result.cases).toHaveLength(8);
    expect(result.browserEvidence.ran).toBe(true);
  });
});
