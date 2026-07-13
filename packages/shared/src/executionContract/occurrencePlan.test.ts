import { readFileSync } from "node:fs";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";

import { sharedRootArtifactPath } from "../../test/publicationArtifacts";
import {
  createOccurrencePlanBuilder,
  type ClosedDataOccurrence,
} from "./occurrencePlan";
import * as occurrencePlanApi from "./occurrencePlan";
import * as executionContractApi from "./implementation";

function expectTypeError(operation: () => unknown): void {
  expect(operation).toThrow(TypeError);
}

describe("parent-linked closed data occurrence plan", () => {
  it("preserves exact classified preorder nodes with parent-derived depths", () => {
    const builder = createOccurrencePlanBuilder();
    const root = builder.appendRoot({ kind: "record" });
    const title = builder.appendChild(0, "title", {
      kind: "string",
      value: "ok",
    });
    const flags = builder.appendChild(0, "flags", { kind: "array" });
    const enabled = builder.appendChild(2, 0, {
      kind: "boolean",
      value: true,
    });
    const empty = builder.appendChild(2, 1, { kind: "null", value: null });
    const count = builder.appendChild(2, 2, { kind: "number", value: 3 });
    const plan = builder.finish();

    expect(plan.nodes).toEqual([
      {
        occurrenceId: 0,
        parentOccurrenceId: null,
        segment: null,
        depth: 1,
        kind: "record",
      },
      {
        occurrenceId: 1,
        parentOccurrenceId: 0,
        segment: "title",
        depth: 2,
        kind: "string",
        value: "ok",
      },
      {
        occurrenceId: 2,
        parentOccurrenceId: 0,
        segment: "flags",
        depth: 2,
        kind: "array",
      },
      {
        occurrenceId: 3,
        parentOccurrenceId: 2,
        segment: 0,
        depth: 3,
        kind: "boolean",
        value: true,
      },
      {
        occurrenceId: 4,
        parentOccurrenceId: 2,
        segment: 1,
        depth: 3,
        kind: "null",
        value: null,
      },
      {
        occurrenceId: 5,
        parentOccurrenceId: 2,
        segment: 2,
        depth: 3,
        kind: "number",
        value: 3,
      },
    ]);
    expect([root, title, flags, enabled, empty, count]).toMatchObject([
      { occurrenceId: 0, parentOccurrenceId: null, segment: null, depth: 1 },
      { occurrenceId: 1, parentOccurrenceId: 0, segment: "title", depth: 2 },
      { occurrenceId: 2, parentOccurrenceId: 0, segment: "flags", depth: 2 },
      { occurrenceId: 3, parentOccurrenceId: 2, segment: 0, depth: 3 },
      { occurrenceId: 4, parentOccurrenceId: 2, segment: 1, depth: 3 },
      { occurrenceId: 5, parentOccurrenceId: 2, segment: 2, depth: 3 },
    ]);
  });

  it("materializes root, current, and direct-child paths only from parent links", () => {
    const builder = createOccurrencePlanBuilder();
    const rootPath = builder.rootPath();
    const root = builder.appendRoot({ kind: "record" });
    const branch = builder.appendChild(root.occurrenceId, "branch", {
      kind: "record",
    });
    const items = builder.appendChild(branch.occurrenceId, "items", {
      kind: "array",
    });
    const item = builder.appendChild(items.occurrenceId, 0, {
      kind: "string",
      value: "value",
    });
    const directChildPath = builder.childPath(branch.occurrenceId, "leaf");
    const occurrenceChildPath = item.childPath("property");

    expect(Array.isArray(rootPath)).toBe(true);
    expect(rootPath).toEqual([]);
    expect(root.path).toEqual([]);
    expect(branch.path).toEqual(["branch"]);
    expect(items.path).toEqual(["branch", "items"]);
    expect(item.path).toEqual(["branch", "items", 0]);
    expect(directChildPath).toEqual(["branch", "leaf"]);
    expect(occurrenceChildPath).toEqual(["branch", "items", 0, "property"]);

    for (const path of [
      rootPath,
      root.path,
      branch.path,
      items.path,
      item.path,
      directChildPath,
      occurrenceChildPath,
    ]) {
      expect(Object.isFrozen(path)).toBe(true);
      expect(Reflect.set(path, 0, "changed")).toBe(false);
      expect(Reflect.defineProperty(path, 0, { value: "changed" })).toBe(false);
      expect(Reflect.deleteProperty(path, "length")).toBe(false);
      expect(Reflect.setPrototypeOf(path, null)).toBe(false);
      expect(Reflect.preventExtensions(path)).toBe(true);
    }
  });

  it("does not materialize a deferred path before it is observed", () => {
    const builder = createOccurrencePlanBuilder();
    const root = builder.appendRoot({ kind: "record" });
    const branch = builder.appendChild(root.occurrenceId, "branch", {
      kind: "record",
    });
    const currentPath = branch.path;
    const childPath = branch.childPath("leaf");
    const defineProperty = vi.spyOn(Reflect, "defineProperty");
    let materializedLength = -1;
    let definitionsBeforeObservation = -1;
    let definitionsAfterObservation = -1;

    try {
      const retainedPath = branch.path;
      definitionsBeforeObservation = defineProperty.mock.calls.length;
      materializedLength = childPath.length;
      definitionsAfterObservation = defineProperty.mock.calls.length;
      void retainedPath;
    } finally {
      defineProperty.mockRestore();
    }

    expect(currentPath).toBe(branch.path);
    expect(definitionsBeforeObservation).toBe(0);
    expect(materializedLength).toBe(2);
    expect(definitionsAfterObservation).toBeGreaterThan(0);
  });

  it("freezes occurrences and finished output without retaining caller data", () => {
    const caller = { secret: true };
    const classifiedValue = { kind: "record" as const, caller };
    const classifiedNumber = { kind: "number" as const, value: 1, caller };
    const builder = createOccurrencePlanBuilder();
    const occurrence = builder.appendRoot(classifiedValue);
    const child = builder.appendChild(
      occurrence.occurrenceId,
      "value",
      classifiedNumber,
    );
    const plan = builder.finish();

    expect(Object.isFrozen(occurrence)).toBe(true);
    expect(Object.isFrozen(child)).toBe(true);
    expect(Reflect.set(occurrence, "depth", 2)).toBe(false);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(plan.nodes)).toBe(true);
    expect(plan.nodes.every(Object.isFrozen)).toBe(true);
    expect(plan.nodes.every((node) => !("path" in node))).toBe(true);
    expect(plan.nodes.every((node) => !("caller" in node))).toBe(true);
    expect(plan.nodes.every((node) => !("object" in node))).toBe(true);
    expect(plan.nodes.every((node) => !("descriptor" in node))).toBe(true);
    expect(plan.nodes).toEqual([
      {
        occurrenceId: 0,
        parentOccurrenceId: null,
        segment: null,
        depth: 1,
        kind: "record",
      },
      {
        occurrenceId: 1,
        parentOccurrenceId: 0,
        segment: "value",
        depth: 2,
        kind: "number",
        value: 1,
      },
    ]);
  });

  it("materializes a 12,000-level parent chain without recursion", () => {
    const depth = 12_000;
    const builder = createOccurrencePlanBuilder();
    let occurrence = builder.appendRoot({ kind: "record" });

    for (let index = 1; index < depth; index += 1) {
      occurrence = builder.appendChild(occurrence.occurrenceId, "next", {
        kind: "record",
      });
    }

    const path = occurrence.path;
    expect(path).toHaveLength(depth - 1);
    expect(path[0]).toBe("next");
    expect(path[path.length - 1]).toBe("next");
    expect(Object.isFrozen(path)).toBe(true);
    expect(builder.finish().nodes).toHaveLength(depth);
  });

  it("rejects invalid lifecycle and parent operations with rollback", () => {
    const builder = createOccurrencePlanBuilder();

    expectTypeError(() => builder.childPath(0, "child"));
    expectTypeError(() => builder.appendChild(0, "child", { kind: "record" }));
    expectTypeError(() => builder.finish());

    const root = builder.appendRoot({ kind: "record" });
    expect(root.occurrenceId).toBe(0);
    expectTypeError(() => builder.appendRoot({ kind: "array" }));
    expectTypeError(() =>
      builder.appendChild(9, "unknown", { kind: "record" }),
    );
    expectTypeError(() => builder.childPath(Number.NaN, "unknown"));

    const child = builder.appendChild(root.occurrenceId, "child", {
      kind: "record",
    });
    expect(child.occurrenceId).toBe(1);
    expect(child.depth).toBe(2);

    const plan = builder.finish();
    expect(plan.nodes).toHaveLength(2);
    expectTypeError(() => builder.finish());
    expectTypeError(() => builder.appendRoot({ kind: "record" }));
    expectTypeError(() =>
      builder.appendChild(root.occurrenceId, "later", { kind: "record" }),
    );
    expect(child.path).toEqual(["child"]);
  });

  it("isolates node and lifecycle state between fresh builders", () => {
    const first = createOccurrencePlanBuilder();
    const second = createOccurrencePlanBuilder();
    first.appendRoot({ kind: "record" });
    const firstPlan = first.finish();
    const secondRoot = second.appendRoot({ kind: "array" });
    const secondPlan = second.finish();

    expect(first).not.toBe(second);
    expect(firstPlan).not.toBe(secondPlan);
    expect(firstPlan.nodes).not.toBe(secondPlan.nodes);
    expect(secondRoot.occurrenceId).toBe(0);
    expect(secondPlan.nodes).toEqual([
      {
        occurrenceId: 0,
        parentOccurrenceId: null,
        segment: null,
        depth: 1,
        kind: "array",
      },
    ]);
  });

  it("does not use mutable Array prototype traversal for path reconstruction", () => {
    const iteratorDescriptor = Reflect.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    if (iteratorDescriptor === undefined) {
      throw new Error("Expected Array.prototype[Symbol.iterator]");
    }
    let pathLength = -1;
    let finalSegment: string | number | undefined;

    try {
      Reflect.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        value() {
          throw new Error("Mutable array iterator was used");
        },
        writable: true,
      });
      const builder = createOccurrencePlanBuilder();
      const root = builder.appendRoot({ kind: "record" });
      const branch = builder.appendChild(root.occurrenceId, "branch", {
        kind: "record",
      });
      const leaf = builder.appendChild(branch.occurrenceId, "leaf", {
        kind: "null",
        value: null,
      });
      pathLength = leaf.path.length;
      finalSegment = leaf.path[pathLength - 1];
      builder.finish();
    } finally {
      Reflect.defineProperty(
        Array.prototype,
        Symbol.iterator,
        iteratorDescriptor,
      );
    }

    expect(pathLength).toBe(2);
    expect(finalSegment).toBe("leaf");
  });
});

describe("occurrence plan internal boundary", () => {
  it("keeps the exact type fixture free of runtime code", () => {
    const source = readFileSync(
      new URL("./occurrencePlan.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: "occurrencePlan.type-fixture.ts",
    }).outputText;

    expect(output.trim()).toBe("export {};");
  });

  it("publishes only the builder factory from the internal runtime module", () => {
    expect(Object.keys(occurrencePlanApi)).toEqual([
      "createOccurrencePlanBuilder",
    ]);
  });

  it("has no walker, descriptor, budget, or profile dependency", () => {
    const source = readFileSync(
      new URL("./occurrencePlan.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain(
      'import type { ValidationPath } from "./identity";',
    );
    expect(source).not.toContain('from "./budget"');
    expect(source).not.toContain('from "./closedDescriptor"');
    expect(source).not.toContain('from "./activeAncestor"');
    expect(source).not.toContain("ClosedDataProfile");
    expect(source).not.toContain("Walker");
  });

  it("keeps all plan names out of facades and generated root declarations", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    const facadeSource = readFileSync(
      new URL("./implementation.ts", import.meta.url),
      "utf8",
    );
    const internalNames = [
      "ClosedDataOccurrence",
      "ClosedDataPathSegment",
      "ClosedDataPlan",
      "ClosedDataPlanNode",
      "ClosedDataPlanNodeValue",
      "OccurrencePlanBuilder",
      "createOccurrencePlanBuilder",
    ];

    expect("createOccurrencePlanBuilder" in executionContractApi).toBe(false);
    expect(rootSource).not.toContain("./executionContract/occurrencePlan");
    expect(facadeSource).not.toContain("./occurrencePlan");

    for (const declarationFile of ["index.d.mts", "index.d.cts"]) {
      const declaration = readFileSync(
        sharedRootArtifactPath(declarationFile),
        "utf8",
      );
      for (const internalName of internalNames) {
        expect(declaration).not.toContain(internalName);
      }
    }
  });
});

const exactOccurrence: ClosedDataOccurrence =
  createOccurrencePlanBuilder().appendRoot({ kind: "record" });
void exactOccurrence;
