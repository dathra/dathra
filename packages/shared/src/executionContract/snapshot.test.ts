import { readFileSync } from "node:fs";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";

import { sharedRootArtifactPath } from "../../test/publicationArtifacts";
import { createBudgetLedger } from "./budget";
import { createClosedDataPlan } from "./closedDataWalker";
import * as executionContractApi from "./implementation";
import { createOccurrencePlanBuilder } from "./occurrencePlan";
import { cloneClosedDataPlan, type ClosedDataClone } from "./snapshot";
import * as snapshotApi from "./snapshot";

type ClosedDataRecord = { [key: string]: ClosedDataClone };

function createPlan(value: unknown) {
  return createClosedDataPlan(value, createBudgetLedger());
}

function requireRecord(value: ClosedDataClone): ClosedDataRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("Expected a closed-data record");
  }
  return value;
}

function requireArray(value: ClosedDataClone): ClosedDataClone[] {
  if (!Array.isArray(value)) {
    throw new Error("Expected a closed-data array");
  }
  return value;
}

function expectDataProperty(
  target: object,
  key: PropertyKey,
  value: ClosedDataClone,
): void {
  expect(Reflect.getOwnPropertyDescriptor(target, key)).toEqual({
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

describe("alias-expanding closed data clone", () => {
  it.each([
    null,
    false,
    true,
    0,
    -0,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.NEGATIVE_INFINITY,
    "",
    "text",
    "\ud800",
  ] as const)("preserves the exact scalar value %#", (value) => {
    const clone = cloneClosedDataPlan(createPlan(value));

    expect(Object.is(clone, value)).toBe(true);
  });

  it("normalizes nested records and dense arrays with exact descriptors", () => {
    const clone = requireRecord(
      cloneClosedDataPlan(
        createPlan({
          title: "entry",
          details: { enabled: true },
          items: [null, { count: 2 }],
        }),
      ),
    );
    const details = requireRecord(clone.details);
    const items = requireArray(clone.items);
    const itemRecord = requireRecord(items[1]);

    expect(Object.getPrototypeOf(clone)).toBe(null);
    expect(Object.getPrototypeOf(details)).toBe(null);
    expect(Object.getPrototypeOf(itemRecord)).toBe(null);
    expect(Array.isArray(items)).toBe(true);
    expect(Object.getPrototypeOf(items)).toBe(Array.prototype);
    expect(Reflect.ownKeys(items)).toEqual(["0", "1", "length"]);
    expect(items).toHaveLength(2);

    expectDataProperty(clone, "title", "entry");
    expectDataProperty(clone, "details", details);
    expectDataProperty(clone, "items", items);
    expectDataProperty(details, "enabled", true);
    expectDataProperty(items, 0, null);
    expectDataProperty(items, 1, itemRecord);
    expectDataProperty(itemRecord, "count", 2);
    expect(Reflect.getOwnPropertyDescriptor(items, "length")).toEqual({
      configurable: false,
      enumerable: false,
      value: 2,
      writable: true,
    });
  });

  it("expands record and array aliases and keeps every call fresh", () => {
    const sharedRecord = { nested: { value: 1 } };
    const sharedArray = [sharedRecord];
    const plan = createPlan({
      arrayLeft: sharedArray,
      arrayRight: sharedArray,
      recordLeft: sharedRecord,
      recordRight: sharedRecord,
    });

    const first = requireRecord(cloneClosedDataPlan(plan));
    const second = requireRecord(cloneClosedDataPlan(plan));
    const firstArrayLeft = requireArray(first.arrayLeft);
    const firstArrayRight = requireArray(first.arrayRight);
    const firstRecordLeft = requireRecord(first.recordLeft);
    const firstRecordRight = requireRecord(first.recordRight);
    const secondArrayLeft = requireArray(second.arrayLeft);
    const secondRecordLeft = requireRecord(second.recordLeft);

    expect(first).not.toBe(second);
    expect(firstArrayLeft).not.toBe(firstArrayRight);
    expect(firstRecordLeft).not.toBe(firstRecordRight);
    expect(requireRecord(firstArrayLeft[0])).not.toBe(firstRecordLeft);
    expect(requireRecord(firstArrayRight[0])).not.toBe(firstRecordRight);
    expect(requireRecord(firstRecordLeft.nested)).not.toBe(
      requireRecord(firstRecordRight.nested),
    );
    expect(firstArrayLeft).not.toBe(secondArrayLeft);
    expect(firstRecordLeft).not.toBe(secondRecordLeft);
    expect(requireRecord(firstArrayLeft[0])).not.toBe(
      requireRecord(secondArrayLeft[0]),
    );
    expect(first).toEqual(second);
  });

  it("clones only the completed plan after caller mutation and revocation", () => {
    const calls = {
      descriptor: 0,
      ownKeys: 0,
      prototype: 0,
    };
    const target = { nested: [{ value: "captured" }] };
    const { proxy, revoke } = Proxy.revocable(target, {
      getOwnPropertyDescriptor(current, key) {
        calls.descriptor += 1;
        return Reflect.getOwnPropertyDescriptor(current, key);
      },
      getPrototypeOf(current) {
        calls.prototype += 1;
        return Reflect.getPrototypeOf(current);
      },
      ownKeys(current) {
        calls.ownKeys += 1;
        return Reflect.ownKeys(current);
      },
    });
    const plan = createPlan(proxy);
    const callsAfterPlan = { ...calls };
    target.nested[0].value = "mutated";
    revoke();

    const clone = requireRecord(cloneClosedDataPlan(plan));
    const nested = requireArray(clone.nested);
    const item = requireRecord(nested[0]);

    expect(item.value).toBe("captured");
    expect(calls).toEqual(callsAfterPlan);
  });

  it("does not modify the input plan, node sequence, or nodes", () => {
    const plan = createPlan({ value: [1, "two"] });
    const nodes = plan.nodes;
    const nodeReferences = Array.from(nodes);
    const expectedNodes = [
      {
        depth: 1,
        kind: "record",
        occurrenceId: 0,
        parentOccurrenceId: null,
        segment: null,
      },
      {
        depth: 2,
        kind: "array",
        occurrenceId: 1,
        parentOccurrenceId: 0,
        segment: "value",
      },
      {
        depth: 3,
        kind: "number",
        occurrenceId: 2,
        parentOccurrenceId: 1,
        segment: 0,
        value: 1,
      },
      {
        depth: 3,
        kind: "string",
        occurrenceId: 3,
        parentOccurrenceId: 1,
        segment: 1,
        value: "two",
      },
    ];

    cloneClosedDataPlan(plan);

    expect(plan.nodes).toBe(nodes);
    expect(plan.nodes).toEqual(expectedNodes);
    expect(Object.isFrozen(plan)).toBe(true);
    expect(Object.isFrozen(nodes)).toBe(true);
    for (let index = 0; index < nodes.length; index += 1) {
      expect(nodes[index]).toBe(nodeReferences[index]);
      expect(Object.isFrozen(nodes[index])).toBe(true);
    }
  });

  it("materializes a 12,000-level plan without recursive calls", () => {
    const depth = 12_000;
    const builder = createOccurrencePlanBuilder();
    let occurrence = builder.appendRoot({ kind: "record" });
    for (let index = 1; index < depth; index += 1) {
      occurrence = builder.appendChild(occurrence.occurrenceId, "next", {
        kind: "record",
      });
    }

    let cursor = cloneClosedDataPlan(builder.finish());
    for (let index = 1; index < depth; index += 1) {
      cursor = requireRecord(cursor).next;
    }
    const leaf = requireRecord(cursor);

    expect(Object.getPrototypeOf(leaf)).toBe(null);
    expect(Reflect.ownKeys(leaf)).toEqual([]);
  });

  it("avoids mutable array traversal and inherited setters", () => {
    const recordKey = "__dathraSnapshotChild__";
    const plan = createPlan({ [recordKey]: ["value"] });
    const pushDescriptor = Reflect.getOwnPropertyDescriptor(
      Array.prototype,
      "push",
    );
    const popDescriptor = Reflect.getOwnPropertyDescriptor(
      Array.prototype,
      "pop",
    );
    const iteratorDescriptor = Reflect.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    const arrayIndexDescriptor = Reflect.getOwnPropertyDescriptor(
      Array.prototype,
      "0",
    );
    const objectKeyDescriptor = Reflect.getOwnPropertyDescriptor(
      Object.prototype,
      recordKey,
    );
    if (
      pushDescriptor === undefined ||
      popDescriptor === undefined ||
      iteratorDescriptor === undefined
    ) {
      throw new Error("Expected mutable Array prototype methods");
    }

    let setterCalls = 0;
    let clone: ClosedDataClone;
    const failMutableTraversal = () => {
      throw new Error("Mutable Array prototype traversal was used");
    };

    try {
      Reflect.defineProperty(Array.prototype, "push", {
        configurable: true,
        value: failMutableTraversal,
        writable: true,
      });
      Reflect.defineProperty(Array.prototype, "pop", {
        configurable: true,
        value: failMutableTraversal,
        writable: true,
      });
      Reflect.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        value: failMutableTraversal,
        writable: true,
      });
      Reflect.defineProperty(Array.prototype, "0", {
        configurable: true,
        set() {
          setterCalls += 1;
        },
      });
      Reflect.defineProperty(Object.prototype, recordKey, {
        configurable: true,
        set() {
          setterCalls += 1;
        },
      });

      clone = cloneClosedDataPlan(plan);
    } finally {
      Reflect.defineProperty(Array.prototype, "push", pushDescriptor);
      Reflect.defineProperty(Array.prototype, "pop", popDescriptor);
      Reflect.defineProperty(
        Array.prototype,
        Symbol.iterator,
        iteratorDescriptor,
      );
      if (arrayIndexDescriptor === undefined) {
        Reflect.deleteProperty(Array.prototype, "0");
      } else {
        Reflect.defineProperty(Array.prototype, "0", arrayIndexDescriptor);
      }
      if (objectKeyDescriptor === undefined) {
        Reflect.deleteProperty(Object.prototype, recordKey);
      } else {
        Reflect.defineProperty(
          Object.prototype,
          recordKey,
          objectKeyDescriptor,
        );
      }
    }

    const record = requireRecord(clone);
    const items = requireArray(record[recordKey]);
    expect(setterCalls).toBe(0);
    expect(items).toEqual(["value"]);
  });

  it("leaves raw output mutable and unfrozen", () => {
    const clone = requireRecord(
      cloneClosedDataPlan(createPlan({ nested: { value: 1 }, items: [2] })),
    );
    const nested = requireRecord(clone.nested);
    const items = requireArray(clone.items);

    expect(Object.isFrozen(clone)).toBe(false);
    expect(Object.isFrozen(nested)).toBe(false);
    expect(Object.isFrozen(items)).toBe(false);
    expect(Reflect.set(nested, "value", 3)).toBe(true);
    expect(Reflect.defineProperty(clone, "added", { value: true })).toBe(true);
    expect(Reflect.deleteProperty(items, "0")).toBe(true);
    expect(nested.value).toBe(3);
    expect(clone.added).toBe(true);
    expect(Object.hasOwn(items, 0)).toBe(false);
  });
});

describe("closed data clone internal boundary", () => {
  it("keeps the exact type fixture free of runtime code", () => {
    const source = readFileSync(
      new URL("./snapshot.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: "snapshot.type-fixture.ts",
    }).outputText;

    expect(output.trim()).toBe("export {};");
  });

  it("publishes only the clone function from the internal runtime module", () => {
    expect(Object.keys(snapshotApi)).toEqual(["cloneClosedDataPlan"]);
  });

  it("depends only on the occurrence plan type and owns no later semantics", () => {
    const source = readFileSync(
      new URL("./snapshot.ts", import.meta.url),
      "utf8",
    );
    const imports = source.match(/^import .+$/gmu) ?? [];

    expect(imports).toEqual([
      'import type { ClosedDataPlan } from "./occurrencePlan";',
    ]);
    expect(source).toContain(
      "for (let index = 0; index < nodes.length; index += 1)",
    );
    for (const excludedOwnership of [
      "createClosedDataPlan",
      "ClosedContainer",
      "BudgetLedger",
      "ClosedDataProfile",
      "ExecutionContractSource",
      "parseExecutionContract",
      "Object.freeze",
      "canonical",
      "digest",
      "factId",
      "identity",
      "trust",
      "authority",
      "permission",
    ]) {
      expect(source).not.toContain(excludedOwnership);
    }
  });

  it("keeps the clone out of facades and generated root declarations", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    const facadeSource = readFileSync(
      new URL("./implementation.ts", import.meta.url),
      "utf8",
    );
    const internalNames = ["ClosedDataClone", "cloneClosedDataPlan"];

    expect("cloneClosedDataPlan" in executionContractApi).toBe(false);
    expect(rootSource).not.toContain("./executionContract/snapshot");
    expect(facadeSource).not.toContain("./snapshot");

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
