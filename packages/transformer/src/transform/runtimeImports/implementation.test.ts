import { describe, expect, it } from "vitest";

import {
  nId,
  nImport,
  nLit,
  type Program,
} from "@/transform/ast/implementation";

import { addRuntimeImports } from "./implementation";

describe("transform/runtimeImports", () => {
  it("does nothing when import set is empty", () => {
    const program: Program = {
      type: "Program",
      body: [{ type: "ExpressionStatement", expression: nLit(1) }],
    };

    addRuntimeImports(program, new Set(), "@dathra/runtime");
    expect(program.body).toHaveLength(1);
  });

  it("inserts runtime import at head when no existing imports", () => {
    const program: Program = {
      type: "Program",
      body: [{ type: "ExpressionStatement", expression: nLit(1) }],
    };

    addRuntimeImports(program, new Set(["fromTree"]), "@dathra/runtime");

    expect(program.body[0]?.type).toBe("ImportDeclaration");
  });

  it("inserts runtime import after existing imports", () => {
    const program: Program = {
      type: "Program",
      body: [
        nImport([], "a"),
        nImport([], "b"),
        { type: "ExpressionStatement", expression: nId("x") },
      ],
    };

    addRuntimeImports(
      program,
      new Set(["fromTree", "setText"]),
      "@dathra/runtime",
    );

    expect(program.body[2]?.type).toBe("ImportDeclaration");
    const decl = program.body[2] as unknown as {
      source: { value: string };
      specifiers: unknown[];
    };
    expect(decl.source.value).toBe("@dathra/runtime");
    expect(decl.specifiers).toHaveLength(2);
  });

  it("includes all specified import names as specifiers", () => {
    const program: Program = {
      type: "Program",
      body: [],
    };

    addRuntimeImports(
      program,
      new Set(["fromTree", "setText", "insert"]),
      "@dathra/runtime",
    );

    const decl = program.body[0] as unknown as {
      specifiers: Array<{
        type: string;
        imported: { name: string };
        local: { name: string };
      }>;
    };
    const names = decl.specifiers.map((s) => s.imported.name);
    expect(names).toContain("fromTree");
    expect(names).toContain("setText");
    expect(names).toContain("insert");
    expect(decl.specifiers).toHaveLength(3);
  });
});
