import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";

import { createBudgetLedger, type ExecutionContractBudget } from "./budget";
import {
  createClosedDataPlan,
  type ClosedDataProfile,
} from "./closedDataWalker";
import * as closedDataWalkerApi from "./closedDataWalker";
import type {
  ClosedContainerHeader,
  ClosedContainerView,
} from "./closedDescriptor";
import { ExecutionContractError } from "./implementation";
import type { ClosedDataOccurrence } from "./occurrencePlan";
import * as executionContractApi from "./implementation";

const EXACT_BUDGET = {
  maximumInputDepth: 3,
  maximumInputDataNodes: 6,
  maximumInputProperties: 5,
  maximumInputArrayLength: 3,
  maximumInputStringCodeUnits: 21,
} as const satisfies ExecutionContractBudget;

function expectExecutionContractError(
  operation: () => unknown,
  code: ExecutionContractError["code"],
  path: readonly (string | number)[],
): ExecutionContractError {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof ExecutionContractError)) throw error;
    if (error.code !== code) {
      throw new Error(`Expected error code ${code}, received ${error.code}`);
    }
    if (
      error.path.length !== path.length ||
      error.path.some((segment, index) => segment !== path[index])
    ) {
      throw new Error(
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }
  throw new Error("Expected an ExecutionContractError");
}

function createPlan(
  value: unknown,
  budget?: ExecutionContractBudget,
  profile?: ClosedDataProfile,
) {
  return createClosedDataPlan(value, createBudgetLedger(budget), profile);
}

describe("profile-driven iterative closed data walker", () => {
  const input = { title: "ok", flags: [true, null, 3] };

  it("builds captured record and array children in preorder", () => {
    const plan = createPlan(input, EXACT_BUDGET);

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
    expect(plan.nodes.every((node) => !Object.hasOwn(node, "path"))).toBe(true);
    expect(plan.nodes.every((node) => !Object.hasOwn(node, "object"))).toBe(
      true,
    );
    expect(plan.nodes.every((node) => !Object.hasOwn(node, "view"))).toBe(true);
  });

  it.each([
    ["maximumInputDepth", 2, ["flags", 0]],
    ["maximumInputDataNodes", 5, ["flags", 2]],
    ["maximumInputProperties", 4, ["flags"]],
    ["maximumInputArrayLength", 2, ["flags"]],
    ["maximumInputStringCodeUnits", 20, ["flags"]],
  ] as const)(
    "accepts the exact generic counters and rejects limit+1 for %s",
    (counter, limit, path) => {
      expect(() => createPlan(input, EXACT_BUDGET)).not.toThrow();
      const budget: ExecutionContractBudget = {
        ...EXACT_BUDGET,
        [counter]: limit,
      };
      const error = expectExecutionContractError(
        () => createPlan(input, budget),
        "budget-exceeded",
        path,
      );
      expect(error.message).toContain(counter);
    },
  );

  it("treats root depth as one for every supported scalar kind", () => {
    for (const value of [null, false, 1, "root"] as const) {
      const stringUnits = typeof value === "string" ? value.length : 0;
      expect(() =>
        createPlan(value, {
          maximumInputDepth: 1,
          maximumInputDataNodes: 1,
          maximumInputStringCodeUnits: stringUnits,
        }),
      ).not.toThrow();
    }

    expectExecutionContractError(
      () => createPlan(null, { maximumInputDepth: 0 }),
      "budget-exceeded",
      [],
    );
  });

  it.each([undefined, 1n, Symbol("value"), () => undefined])(
    "rejects unsupported root structural value %#",
    (value) => {
      expectExecutionContractError(
        () => createPlan(value),
        "invalid-closed-record",
        [],
      );
    },
  );

  it("excludes array length only from property count and charges its key units", () => {
    expect(() =>
      createPlan([], {
        maximumInputDepth: 1,
        maximumInputDataNodes: 1,
        maximumInputProperties: 0,
        maximumInputArrayLength: 0,
        maximumInputStringCodeUnits: "length".length,
      }),
    ).not.toThrow();

    expectExecutionContractError(
      () =>
        createPlan([], {
          maximumInputProperties: 0,
          maximumInputStringCodeUnits: "length".length - 1,
        }),
      "budget-exceeded",
      [],
    );
  });

  it("finishes generic charges before descriptors or profile hooks", () => {
    const getter = vi.fn(() => 1);
    const descriptor = vi.fn(Reflect.getOwnPropertyDescriptor);
    const beforeDescriptors = vi.fn();
    const beforeChildren = vi.fn();
    const target = {};
    Reflect.defineProperty(target, "secret", {
      configurable: true,
      enumerable: true,
      get: getter,
    });
    const value = new Proxy(target, { getOwnPropertyDescriptor: descriptor });

    expectExecutionContractError(
      () =>
        createPlan(
          value,
          { maximumInputProperties: 0 },
          {
            beforeChildren,
            beforeDescriptors,
          },
        ),
      "budget-exceeded",
      [],
    );
    expect(beforeDescriptors).not.toHaveBeenCalled();
    expect(beforeChildren).not.toHaveBeenCalled();
    expect(descriptor).not.toHaveBeenCalled();
    expect(getter).not.toHaveBeenCalled();

    expectExecutionContractError(
      () => createPlan(value),
      "invalid-closed-record",
      ["secret"],
    );
    expect(descriptor).toHaveBeenCalledTimes(1);
    expect(getter).not.toHaveBeenCalled();
  });

  it("precharges hidden, symbol, extra, and sparse structure", () => {
    const hidden = {};
    Reflect.defineProperty(hidden, "hidden", {
      configurable: true,
      enumerable: false,
      value: 1,
      writable: true,
    });
    expectExecutionContractError(
      () => createPlan(hidden, { maximumInputProperties: 0 }),
      "budget-exceeded",
      [],
    );
    expectExecutionContractError(
      () => createPlan(hidden),
      "invalid-closed-record",
      ["hidden"],
    );

    const symbol = Symbol("extra");
    const symbolic = { [symbol]: 1 };
    expectExecutionContractError(
      () => createPlan(symbolic, { maximumInputProperties: 0 }),
      "budget-exceeded",
      [],
    );
    expectExecutionContractError(
      () =>
        createPlan(symbolic, {
          maximumInputProperties: 1,
          maximumInputStringCodeUnits: 0,
        }),
      "invalid-closed-record",
      [],
    );

    const extra: unknown[] = [];
    Reflect.defineProperty(extra, "extra", {
      configurable: true,
      enumerable: true,
      value: 1,
      writable: true,
    });
    const extraDescriptor = vi.fn(Reflect.getOwnPropertyDescriptor);
    const extraProxy = new Proxy(extra, {
      getOwnPropertyDescriptor: extraDescriptor,
    });
    expectExecutionContractError(
      () => createPlan(extraProxy, { maximumInputProperties: 0 }),
      "budget-exceeded",
      [],
    );
    expect(extraDescriptor).toHaveBeenCalledTimes(1);
    expect(extraDescriptor).toHaveBeenCalledWith(extra, "length");

    const sparse: unknown[] = [];
    sparse.length = 1;
    const sparseDescriptor = vi.fn(Reflect.getOwnPropertyDescriptor);
    const sparseProxy = new Proxy(sparse, {
      getOwnPropertyDescriptor: sparseDescriptor,
    });
    expectExecutionContractError(
      () => createPlan(sparseProxy, { maximumInputArrayLength: 0 }),
      "budget-exceeded",
      [],
    );
    expect(sparseDescriptor).toHaveBeenCalledTimes(1);
    expect(sparseDescriptor).toHaveBeenCalledWith(sparse, "length");
    expectExecutionContractError(
      () => createPlan(sparse),
      "invalid-closed-record",
      [0],
    );
  });

  it("recharges shared aliases while reusing one captured header and view", () => {
    const reflection = {
      descriptors: 0,
      ownKeys: 0,
      prototypes: 0,
    };
    const shared = new Proxy(
      { key: "v" },
      {
        getOwnPropertyDescriptor(target, key) {
          reflection.descriptors += 1;
          return Reflect.getOwnPropertyDescriptor(target, key);
        },
        getPrototypeOf(target) {
          reflection.prototypes += 1;
          return Reflect.getPrototypeOf(target);
        },
        ownKeys(target) {
          reflection.ownKeys += 1;
          return Reflect.ownKeys(target);
        },
      },
    );
    const events: string[] = [];
    const headers = new Map<string, ClosedContainerHeader>();
    const views = new Map<string, ClosedContainerView>();
    const profile: ClosedDataProfile = {
      beforeDescriptors(occurrence, header) {
        const label = occurrence.segment ?? "root";
        events.push(`descriptors:${label}`);
        headers.set(String(label), header);
      },
      beforeChildren(occurrence, view) {
        const label = occurrence.segment ?? "root";
        events.push(`children:${label}`);
        views.set(String(label), view);
      },
    };

    createPlan(
      { left: shared, right: shared },
      {
        maximumInputDepth: 3,
        maximumInputDataNodes: 5,
        maximumInputProperties: 4,
        maximumInputStringCodeUnits: 17,
      },
      profile,
    );

    expect(reflection).toEqual({ descriptors: 1, ownKeys: 1, prototypes: 1 });
    expect(events).toEqual([
      "descriptors:root",
      "children:root",
      "descriptors:left",
      "children:left",
      "descriptors:right",
      "children:right",
    ]);
    expect(headers.get("left")).toBe(headers.get("right"));
    expect(views.get("left")).toBe(views.get("right"));

    expectExecutionContractError(
      () =>
        createPlan(
          { left: shared, right: shared },
          { maximumInputDataNodes: 4 },
        ),
      "budget-exceeded",
      ["right", "key"],
    );
    expectExecutionContractError(
      () =>
        createPlan(
          { left: shared, right: shared },
          { maximumInputProperties: 3 },
        ),
      "budget-exceeded",
      ["right"],
    );
    expectExecutionContractError(
      () =>
        createPlan(
          { left: shared, right: shared },
          { maximumInputStringCodeUnits: 16 },
        ),
      "budget-exceeded",
      ["right", "key"],
    );

    const sharedArray = ["v"];
    expect(() =>
      createPlan(
        { left: sharedArray, right: sharedArray },
        { maximumInputArrayLength: 2 },
      ),
    ).not.toThrow();
    expectExecutionContractError(
      () =>
        createPlan(
          { left: sharedArray, right: sharedArray },
          { maximumInputArrayLength: 1 },
        ),
      "budget-exceeded",
      ["right"],
    );
  });

  it("passes exact hook context in descriptor, view, cycle, and child order", () => {
    const events: string[] = [];
    const childTarget = {};
    const child = new Proxy(childTarget, {
      ownKeys(target) {
        events.push("child:ownKeys");
        return Reflect.ownKeys(target);
      },
    });
    const rootTarget = { child };
    const root = new Proxy(rootTarget, {
      getOwnPropertyDescriptor(target, key) {
        events.push(`root:descriptor:${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
      ownKeys(target) {
        events.push("root:ownKeys");
        return Reflect.ownKeys(target);
      },
    });
    const ledger = createBudgetLedger();
    const occurrences = new Map<string, ClosedDataOccurrence>();
    const profile: ClosedDataProfile = {
      beforeDescriptors(occurrence, header, receivedLedger) {
        const label = String(occurrence.segment ?? "root");
        events.push(`beforeDescriptors:${label}`);
        expect(receivedLedger).toBe(ledger);
        expect(header.kind).toBe("record");
        expect(occurrence.depth).toBe(label === "root" ? 1 : 2);
        expect(occurrence.parentOccurrenceId).toBe(label === "root" ? null : 0);
        occurrences.set(label, occurrence);
      },
      beforeChildren(occurrence, view, receivedLedger) {
        const label = String(occurrence.segment ?? "root");
        events.push(`beforeChildren:${label}`);
        expect(receivedLedger).toBe(ledger);
        expect(view.kind).toBe("record");
        expect(occurrence).toBe(occurrences.get(label));
      },
    };

    createClosedDataPlan(root, ledger, profile);

    expect(events).toEqual([
      "root:ownKeys",
      "beforeDescriptors:root",
      "root:descriptor:child",
      "beforeChildren:root",
      "child:ownKeys",
      "beforeDescriptors:child",
      "beforeChildren:child",
    ]);

    const profileFailure: ClosedDataProfile = {
      beforeDescriptors() {},
      beforeChildren(occurrence, _view, receivedLedger) {
        receivedLedger.chargeTotal(
          "maximumReferences",
          1,
          occurrence.childPath("reference"),
        );
      },
    };
    const error = expectExecutionContractError(
      () =>
        createClosedDataPlan(
          {},
          createBudgetLedger({ maximumReferences: 0 }),
          profileFailure,
        ),
      "budget-exceeded",
      ["reference"],
    );
    expect(Object.isFrozen(error.path)).toBe(true);
  });

  it("materializes direct, indirect, and descriptor failure paths", () => {
    const direct: { self?: object } = {};
    direct.self = direct;
    const cycleEvents: string[] = [];
    const cycleProfile: ClosedDataProfile = {
      beforeDescriptors(occurrence) {
        cycleEvents.push(`descriptors:${occurrence.segment ?? "root"}`);
      },
      beforeChildren(occurrence) {
        cycleEvents.push(`children:${occurrence.segment ?? "root"}`);
      },
    };
    const directError = expectExecutionContractError(
      () => createPlan(direct, undefined, cycleProfile),
      "invalid-closed-record",
      ["self"],
    );
    expect(cycleEvents).toEqual([
      "descriptors:root",
      "children:root",
      "descriptors:self",
      "children:self",
    ]);
    expect(Object.isFrozen(directError.path)).toBe(true);

    const indirect: { branch?: { back: object } } = {};
    indirect.branch = { back: indirect };
    const indirectError = expectExecutionContractError(
      () => createPlan(indirect),
      "invalid-closed-record",
      ["branch", "back"],
    );
    expect(Object.isFrozen(indirectError.path)).toBe(true);

    const broken = new Proxy(
      { bad: 1 },
      {
        getOwnPropertyDescriptor() {
          throw new Error("descriptor failed");
        },
      },
    );
    const descriptorError = expectExecutionContractError(
      () => createPlan({ nested: broken }),
      "invalid-closed-record",
      ["nested", "bad"],
    );
    expect(Object.isFrozen(descriptorError.path)).toBe(true);

    const sparseItems: unknown[] = [];
    sparseItems.length = 1;
    const sparseError = expectExecutionContractError(
      () => createPlan({ deep: { items: sparseItems } }),
      "invalid-closed-record",
      ["deep", "items", 0],
    );
    expect(Object.isFrozen(sparseError.path)).toBe(true);
  });

  it("stops a 12,000-level fixture iteratively at the depth hard cap", () => {
    const root: { next?: object } = {};
    let cursor = root;
    for (let depth = 1; depth < 12_000; depth += 1) {
      const next: { next?: object } = {};
      cursor.next = next;
      cursor = next;
    }

    const error = expectExecutionContractError(
      () => createPlan(root),
      "budget-exceeded",
      Array.from({ length: 64 }, () => "next"),
    );
    expect(error.message).toContain("maximumInputDepth");
  });

  it("isolates descriptor, ancestor, frame, builder, and default state", () => {
    let ownKeys = 0;
    const value = new Proxy(
      { child: {} },
      {
        ownKeys(target) {
          ownKeys += 1;
          return Reflect.ownKeys(target);
        },
      },
    );

    const first = createPlan(value);
    const second = createPlan(value);
    expect(first).not.toBe(second);
    expect(first.nodes).not.toBe(second.nodes);
    expect(first.nodes[0]?.occurrenceId).toBe(0);
    expect(second.nodes[0]?.occurrenceId).toBe(0);
    expect(ownKeys).toBe(2);

    const cycle: { self?: object } = {};
    cycle.self = cycle;
    expectExecutionContractError(
      () => createPlan(cycle),
      "invalid-closed-record",
      ["self"],
    );
    expectExecutionContractError(
      () => createPlan(cycle),
      "invalid-closed-record",
      ["self"],
    );
  });

  it("does not depend on mutable Array prototype traversal", () => {
    const inputValue = { first: [1, 2], second: { value: 3 } };
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
    if (
      pushDescriptor === undefined ||
      popDescriptor === undefined ||
      iteratorDescriptor === undefined
    ) {
      throw new Error("Expected mutable Array prototype traversal methods");
    }
    let nodeCount = -1;

    try {
      const failMutableTraversal = () => {
        throw new Error("Mutable Array prototype traversal was used");
      };
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
      nodeCount = createPlan(inputValue).nodes.length;
    } finally {
      Reflect.defineProperty(Array.prototype, "push", pushDescriptor);
      Reflect.defineProperty(Array.prototype, "pop", popDescriptor);
      Reflect.defineProperty(
        Array.prototype,
        Symbol.iterator,
        iteratorDescriptor,
      );
    }

    expect(nodeCount).toBe(6);
  });
});

describe("closed data walker internal boundary", () => {
  it("keeps the exact type fixture free of runtime code", () => {
    const source = readFileSync(
      new URL("./closedDataWalker.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: "closedDataWalker.type-fixture.ts",
    }).outputText;

    expect(output.trim()).toBe("export {};");
  });

  it("publishes only the factory from the internal runtime module", () => {
    expect(Object.keys(closedDataWalkerApi)).toEqual(["createClosedDataPlan"]);
  });

  it("depends only on generic walker predecessors", () => {
    const source = readFileSync(
      new URL("./closedDataWalker.ts", import.meta.url),
      "utf8",
    );

    expect(source).toContain('from "./activeAncestor"');
    expect(source).toContain('from "./budget"');
    expect(source).toContain('from "./closedDescriptor"');
    expect(source).toContain('from "./occurrencePlan"');
    for (const excludedOwnership of [
      'from "./sourceModel"',
      'from "./registrySourceModel"',
      "SemanticPath",
      "facts",
      "relations",
      "registry",
      "clone",
      "canonical",
      "digest",
      "authority",
      "permission",
    ]) {
      expect(source).not.toContain(excludedOwnership);
    }
  });

  it("keeps the walker out of facades and generated root declarations", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    const facadeSource = readFileSync(
      new URL("./implementation.ts", import.meta.url),
      "utf8",
    );
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-closed-walker-"),
    );
    const internalNames = ["ClosedDataProfile", "createClosedDataPlan"];

    expect("createClosedDataPlan" in executionContractApi).toBe(false);
    expect(rootSource).not.toContain("./executionContract/closedDataWalker");
    expect(facadeSource).not.toContain("./closedDataWalker");

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsdown", "--out-dir", outputDirectory, "--logLevel", "error"],
        { cwd: packageRoot, stdio: "pipe" },
      );

      for (const declarationFile of ["index.d.mts", "index.d.cts"]) {
        const declaration = readFileSync(
          join(outputDirectory, declarationFile),
          "utf8",
        );
        for (const internalName of internalNames) {
          expect(declaration).not.toContain(internalName);
        }
      }
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});
