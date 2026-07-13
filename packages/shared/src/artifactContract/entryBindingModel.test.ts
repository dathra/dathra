import { readFileSync } from "node:fs";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, expectTypeOf, it } from "vitest";

import * as entryBindingModelApi from "./entryBindingModel";
import {
  type ArtifactEntryBinding,
  type ArtifactEntryRole,
} from "./entryBindingModel";

type ExpectedArtifactEntryRole =
  | "runtime-entry"
  | "integration-entry"
  | "definition-entry";

type ExpectedArtifactEntryBinding = {
  readonly role: ExpectedArtifactEntryRole;
  readonly entrySemanticId: string;
  readonly exportedName: string;
  readonly invocationOrdinal: number;
};

type ExpectedArtifactEntryBindingKey =
  | "role"
  | "entrySemanticId"
  | "exportedName"
  | "invocationOrdinal";

function emitTypeScriptModule(relativePath: string): string {
  const source = readFileSync(new URL(relativePath, import.meta.url), "utf8");

  return transpileModule(source, {
    compilerOptions: {
      module: ModuleKind.ESNext,
      target: ScriptTarget.ES2024,
      verbatimModuleSyntax: true,
    },
    fileName: relativePath,
  }).outputText;
}

describe("artifact entry binding model", () => {
  it("fixes the exact three-literal entry role union in both directions", () => {
    expectTypeOf<ArtifactEntryRole>().toEqualTypeOf<ExpectedArtifactEntryRole>();
    expectTypeOf<ExpectedArtifactEntryRole>().toEqualTypeOf<ArtifactEntryRole>();
  });

  it("fixes the exact four binding keys and property types", () => {
    expectTypeOf<
      keyof ArtifactEntryBinding
    >().toEqualTypeOf<ExpectedArtifactEntryBindingKey>();
    expectTypeOf<ExpectedArtifactEntryBindingKey>().toEqualTypeOf<
      keyof ArtifactEntryBinding
    >();
    expectTypeOf<
      ArtifactEntryBinding["role"]
    >().toEqualTypeOf<ArtifactEntryRole>();
    expectTypeOf<
      ArtifactEntryBinding["entrySemanticId"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ArtifactEntryBinding["exportedName"]
    >().toEqualTypeOf<string>();
    expectTypeOf<
      ArtifactEntryBinding["invocationOrdinal"]
    >().toEqualTypeOf<number>();
    expectTypeOf<ArtifactEntryBinding>().toEqualTypeOf<ExpectedArtifactEntryBinding>();
    expectTypeOf<ExpectedArtifactEntryBinding>().toEqualTypeOf<ArtifactEntryBinding>();
  });

  it("adds no runtime value or runtime import edge", () => {
    expect(Object.keys(entryBindingModelApi)).toEqual([]);
    expect(emitTypeScriptModule("./entryBindingModel.ts").trim()).toBe(
      "export {};",
    );
    expect(
      emitTypeScriptModule("./entryBindingModel.type-fixture.ts").trim(),
    ).toBe("export {};");
  });
});
