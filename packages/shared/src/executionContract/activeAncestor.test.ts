import { readFileSync } from "node:fs";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it } from "vitest";

import {
  createActiveAncestorTracker,
  type ActiveAncestorTracker,
} from "./activeAncestor";
import * as activeAncestorApi from "./activeAncestor";
import { ExecutionContractError } from "./implementation";

function expectCycleError(
  operation: () => unknown,
  path: readonly (string | number)[],
): ExecutionContractError {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof ExecutionContractError)) throw error;
    if (error.code !== "invalid-closed-record") {
      throw new Error(`Expected invalid-closed-record, received ${error.code}`);
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

function expectInvalidLeave(
  tracker: ActiveAncestorTracker,
  value: object,
): void {
  expect(() => tracker.leave(value)).toThrow(TypeError);
}

describe("operation-local active ancestor tracking", () => {
  it("rejects a direct cycle at the current occurrence path and rolls back", () => {
    const tracker = createActiveAncestorTracker();
    const value = {};
    const cyclePath: (string | number)[] = ["root", "self"];
    tracker.enter(value, ["root"]);

    const error = expectCycleError(
      () => tracker.enter(value, cyclePath),
      cyclePath,
    );
    cyclePath[0] = "changed";

    expect(error.path).toEqual(["root", "self"]);
    expect(Object.isFrozen(error.path)).toBe(true);
    tracker.leave(value);
    tracker.enter(value, ["alias"]);
    tracker.leave(value);
  });

  it("rejects an indirect cycle without changing the active top", () => {
    const tracker = createActiveAncestorTracker();
    const root = {};
    const child = {};
    const leaf = {};
    tracker.enter(root, ["root"]);
    tracker.enter(child, ["root", "child"]);
    tracker.enter(leaf, ["root", "child", "leaf"]);

    expectCycleError(
      () => tracker.enter(root, ["root", "child", "leaf", "back"]),
      ["root", "child", "leaf", "back"],
    );
    expectInvalidLeave(tracker, root);
    expectCycleError(
      () => tracker.enter(root, ["root", "still-active"]),
      ["root", "still-active"],
    );

    tracker.leave(leaf);
    tracker.leave(child);
    tracker.leave(root);
  });

  it("enforces strict LIFO leave without corrupting state", () => {
    const tracker = createActiveAncestorTracker();
    const root = {};
    const child = {};
    const unknown = {};
    tracker.enter(root, []);
    tracker.enter(child, ["child"]);

    expectInvalidLeave(tracker, root);
    expectCycleError(
      () => tracker.enter(root, ["root-active"]),
      ["root-active"],
    );
    expectInvalidLeave(tracker, unknown);
    expectCycleError(
      () => tracker.enter(child, ["child-active"]),
      ["child-active"],
    );
    tracker.leave(child);
    expectInvalidLeave(tracker, child);
    expectCycleError(
      () => tracker.enter(root, ["root-active"]),
      ["root-active"],
    );
    tracker.leave(root);
    expectInvalidLeave(tracker, root);

    tracker.enter(root, ["reused"]);
    tracker.leave(root);
  });

  it("accepts a shared alias after leave", () => {
    const tracker = createActiveAncestorTracker();
    const root = {};
    const shared = {};
    expect(() => {
      tracker.enter(root, []);
      tracker.enter(shared, ["left"]);
      tracker.leave(shared);
      tracker.enter(shared, ["right"]);
      tracker.leave(shared);
      tracker.leave(root);
    }).not.toThrow();
  });

  it("isolates active identities between fresh operations", () => {
    const value = {};
    const first = createActiveAncestorTracker();
    const second = createActiveAncestorTracker();
    expect(() => {
      first.enter(value, ["first"]);
      second.enter(value, ["second"]);
      second.leave(value);
      first.leave(value);
    }).not.toThrow();
  });

  it("enters and leaves 12,000 levels iteratively", () => {
    const depth = 12_000;
    const values = Array.from({ length: depth }, () => ({}));
    const tracker = createActiveAncestorTracker();

    expect(() => {
      for (let index = 0; index < depth; index += 1) {
        tracker.enter(values[index], []);
      }
      for (let index = depth - 1; index >= 0; index -= 1) {
        tracker.leave(values[index]);
      }
      tracker.enter(values[0], ["after"]);
      tracker.leave(values[0]);
    }).not.toThrow();
  });

  it("does not inspect or revisit a successful occurrence path", () => {
    let pathReads = 0;
    const revocablePath = Proxy.revocable<(string | number)[]>([], {
      get() {
        pathReads += 1;
        throw new Error("success path was inspected");
      },
      ownKeys() {
        pathReads += 1;
        throw new Error("success path was enumerated");
      },
    });
    const tracker = createActiveAncestorTracker();
    const value = {};

    tracker.enter(value, revocablePath.proxy);
    revocablePath.revoke();
    tracker.leave(value);

    expect(pathReads).toBe(0);
  });

  it("does not traverse mutable Array prototype state on success", () => {
    const iteratorDescriptor = Reflect.getOwnPropertyDescriptor(
      Array.prototype,
      Symbol.iterator,
    );
    if (iteratorDescriptor === undefined) {
      throw new Error("Expected Array.prototype[Symbol.iterator]");
    }
    const tracker = createActiveAncestorTracker();
    const root = {};
    const child = {};
    const path: readonly (string | number)[] = [];

    expect(() => {
      try {
        Reflect.defineProperty(Array.prototype, Symbol.iterator, {
          configurable: true,
          value() {
            throw new Error("mutable array iterator was used");
          },
          writable: true,
        });
        tracker.enter(root, path);
        tracker.enter(child, path);
        tracker.leave(child);
        tracker.leave(root);
      } finally {
        Reflect.defineProperty(
          Array.prototype,
          Symbol.iterator,
          iteratorDescriptor,
        );
      }
    }).not.toThrow();
  });
});

describe("active ancestor internal boundary", () => {
  it("keeps the exact type fixture free of runtime code", () => {
    const source = readFileSync(
      new URL("./activeAncestor.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: "activeAncestor.type-fixture.ts",
    }).outputText;

    expect(output.trim()).toBe("export {};");
  });

  it("publishes only the factory from the internal runtime module", () => {
    expect(Object.keys(activeAncestorApi)).toEqual([
      "createActiveAncestorTracker",
    ]);
  });
});
