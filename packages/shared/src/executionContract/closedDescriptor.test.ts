import { readFileSync } from "node:fs";
import { runInNewContext } from "node:vm";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import {
  createClosedDescriptorCapture,
  type ClosedContainerHeader,
  type ClosedContainerView,
} from "./closedDescriptor";
import * as closedDescriptorApi from "./closedDescriptor";
import { ExecutionContractError } from "./implementation";
import * as executionContractApi from "./implementation";

afterEach(() => {
  vi.restoreAllMocks();
});

function expectExecutionContractError(
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

function expectArrayHeader(
  header: ClosedContainerHeader,
): asserts header is Extract<
  ClosedContainerHeader,
  { readonly kind: "array" }
> {
  expect(header.kind).toBe("array");
  if (header.kind !== "array") throw new Error("Expected an array header");
}

function expectRecordView(
  view: ClosedContainerView,
): asserts view is Extract<ClosedContainerView, { readonly kind: "record" }> {
  expect(view.kind).toBe("record");
  if (view.kind !== "record") throw new Error("Expected a record view");
}

function expectArrayView(
  view: ClosedContainerView,
): asserts view is Extract<ClosedContainerView, { readonly kind: "array" }> {
  expect(view.kind).toBe("array");
  if (view.kind !== "array") throw new Error("Expected an array view");
}

function dataProperty(value: unknown, enumerable = true): PropertyDescriptor {
  return {
    configurable: true,
    enumerable,
    value,
    writable: true,
  };
}

function requireObject(value: unknown): object {
  if (
    (typeof value !== "object" && typeof value !== "function") ||
    value === null
  ) {
    throw new TypeError("Expected an object test fixture");
  }
  return value;
}

function expectViewError(
  value: object,
  path: readonly (string | number)[],
  errorPath: readonly (string | number)[],
): ExecutionContractError {
  const capture = createClosedDescriptorCapture();
  capture.captureHeader(value, path);
  return expectExecutionContractError(
    () => capture.completeView(value, path),
    errorPath,
  );
}

describe("closed descriptor header capture", () => {
  it("exposes the original frozen ownKeys result without filtering or copying", () => {
    const symbol = Symbol("symbol-key");
    const record = { visible: true };
    Reflect.defineProperty(record, "hidden", dataProperty(false, false));
    Reflect.defineProperty(record, symbol, dataProperty("symbol"));
    const recordKeys = Reflect.ownKeys(record);
    const ownKeysSpy = vi
      .spyOn(Reflect, "ownKeys")
      .mockReturnValueOnce(recordKeys);

    const recordHeader = createClosedDescriptorCapture().captureHeader(record, [
      "record",
    ]);

    expect(recordHeader).toEqual({ kind: "record", ownKeys: recordKeys });
    expect(recordHeader.ownKeys).toBe(recordKeys);
    expect(recordHeader.ownKeys).toEqual(["visible", "hidden", symbol]);
    expect(Object.isFrozen(recordHeader.ownKeys)).toBe(true);
    expect(Object.isFrozen(recordHeader)).toBe(true);
    expect(ownKeysSpy).toHaveBeenCalledTimes(1);

    const array = ["value"];
    Reflect.defineProperty(array, "extra", dataProperty(true));
    Reflect.defineProperty(array, symbol, dataProperty("symbol"));
    const arrayKeys = Reflect.ownKeys(array);
    ownKeysSpy.mockReturnValueOnce(arrayKeys);

    const arrayHeader = createClosedDescriptorCapture().captureHeader(array, [
      "array",
    ]);

    expectArrayHeader(arrayHeader);
    expect(arrayHeader.ownKeys).toBe(arrayKeys);
    expect(arrayHeader.ownKeys).toEqual(["0", "length", "extra", symbol]);
    expect(arrayHeader.length).toBe(1);
    expect(Object.isFrozen(arrayHeader.ownKeys)).toBe(true);
  });

  it("accepts current and null record prototypes and the current array prototype", () => {
    const capture = createClosedDescriptorCapture();
    const nullPrototype = requireObject(Object.create(null));
    Reflect.defineProperty(nullPrototype, "value", dataProperty(1));
    const foreignNullPrototype = requireObject(
      runInNewContext("Object.assign(Object.create(null), { value: 2 })"),
    );

    expect(capture.captureHeader({}, ["ordinary"]).kind).toBe("record");
    expect(capture.captureHeader(nullPrototype, ["null"]).kind).toBe("record");
    expect(
      capture.captureHeader(foreignNullPrototype, ["foreign-null"]).kind,
    ).toBe("record");

    const arrayHeader = capture.captureHeader([], ["array"]);
    expectArrayHeader(arrayHeader);
    expect(arrayHeader.length).toBe(0);
  });

  it.each([null, undefined, true, 1, "record", () => undefined])(
    "rejects a non-container value %# at its occurrence path",
    (value) => {
      expectExecutionContractError(
        () => createClosedDescriptorCapture().captureHeader(value, ["root"]),
        ["root"],
      );
    },
  );

  it("rejects custom and foreign prototypes", () => {
    const customRecord = requireObject(Object.create({ inherited: true }));
    const foreignRecord = requireObject(runInNewContext("({ value: 1 })"));
    const foreignArray = requireObject(runInNewContext("[1]"));
    const customArray = [1];
    Reflect.setPrototypeOf(customArray, null);

    for (const [name, value] of [
      ["custom-record", customRecord],
      ["foreign-record", foreignRecord],
      ["foreign-array", foreignArray],
      ["custom-array", customArray],
    ] as const) {
      expectExecutionContractError(
        () => createClosedDescriptorCapture().captureHeader(value, [name]),
        [name],
      );
    }
  });

  it("normalizes header reflection failures to the container path", () => {
    const prototypeFailure = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("prototype failure");
        },
      },
    );
    const ownKeysFailure = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("ownKeys failure");
        },
      },
    );
    const lengthFailure = new Proxy([], {
      getOwnPropertyDescriptor(_target, key) {
        if (key === "length") throw new Error("length failure");
        return undefined;
      },
    });
    const revoked = Proxy.revocable([], {});
    revoked.revoke();

    for (const [name, value] of [
      ["prototype", prototypeFailure],
      ["keys", ownKeysFailure],
      ["length", lengthFailure],
      ["revoked", revoked.proxy],
    ] as const) {
      expectExecutionContractError(
        () => createClosedDescriptorCapture().captureHeader(value, [name]),
        [name],
      );
    }
  });

  it("pins reentrant incomplete header capture to the first container path", () => {
    const capture = createClosedDescriptorCapture();
    const target = { value: 1 };
    let nestedError: unknown;
    let ownKeyReads = 0;
    const value: object = new Proxy(target, {
      ownKeys(current) {
        ownKeyReads += 1;
        try {
          capture.captureHeader(value, ["forged-path"]);
        } catch (error) {
          nestedError = error;
        }
        return Reflect.ownKeys(current);
      },
    });

    const outerError = expectExecutionContractError(
      () => capture.captureHeader(value, ["outer"]),
      ["outer"],
    );
    expect(nestedError).toBe(outerError);
    expect(ownKeyReads).toBe(1);
    expectExecutionContractError(
      () => capture.captureHeader(value, ["alias"]),
      ["outer"],
    );
    expect(ownKeyReads).toBe(1);
  });

  it("rejects a non-standard intrinsic array length descriptor", () => {
    const array = ["value"];
    const getOwnPropertyDescriptor = Reflect.getOwnPropertyDescriptor;
    const descriptorSpy = vi
      .spyOn(Reflect, "getOwnPropertyDescriptor")
      .mockImplementation((value, key) =>
        value === array && key === "length"
          ? {
              configurable: false,
              enumerable: true,
              value: 1,
              writable: true,
            }
          : getOwnPropertyDescriptor(value, key),
      );

    expectExecutionContractError(
      () => createClosedDescriptorCapture().captureHeader(array, ["array"]),
      ["array"],
    );
    expect(descriptorSpy).toHaveBeenCalledTimes(1);
  });
});

describe("closed descriptor view completion", () => {
  it("reads record descriptors only after caller precharge and once per identity", () => {
    const events: string[] = [];
    const target = { first: 1, second: 2 };
    const value = new Proxy(target, {
      getPrototypeOf(current) {
        events.push("prototype");
        return Reflect.getPrototypeOf(current);
      },
      ownKeys(current) {
        events.push("ownKeys");
        return Reflect.ownKeys(current);
      },
      getOwnPropertyDescriptor(current, key) {
        events.push(`descriptor:${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(current, key);
      },
    });
    const capture = createClosedDescriptorCapture();

    const header = capture.captureHeader(value, ["first"]);
    expect(events).toEqual(["prototype", "ownKeys"]);
    events.push("caller-precharge");
    const view = capture.completeView(value, ["first"]);

    expectRecordView(view);
    expect(view.entries).toEqual([
      ["first", 1],
      ["second", 2],
    ]);
    expect(events).toEqual([
      "prototype",
      "ownKeys",
      "caller-precharge",
      "descriptor:first",
      "descriptor:second",
    ]);
    expect(capture.captureHeader(value, ["alias"])).toBe(header);
    expect(capture.completeView(value, ["alias"])).toBe(view);
    expect(events).toHaveLength(5);

    const secondOperation = createClosedDescriptorCapture();
    secondOperation.captureHeader(value, ["second-operation"]);
    secondOperation.completeView(value, ["second-operation"]);
    expect(events.slice(5)).toEqual([
      "prototype",
      "ownKeys",
      "descriptor:first",
      "descriptor:second",
    ]);
  });

  it("does not iterate success paths or the captured own-key result", () => {
    const ownKeys = ["value"];
    Reflect.defineProperty(ownKeys, Symbol.iterator, {
      configurable: true,
      value() {
        throw new Error("own keys must use indexed traversal");
      },
    });
    const ownKeysSpy = vi.spyOn(Reflect, "ownKeys").mockReturnValue(ownKeys);
    const path: (string | number)[] = ["record"];
    Reflect.defineProperty(path, Symbol.iterator, {
      configurable: true,
      value() {
        throw new Error("success paths must not be materialized");
      },
    });
    const capture = createClosedDescriptorCapture();
    const value = { value: 1 };

    capture.captureHeader(value, path);
    const view = capture.completeView(value, path);

    expectRecordView(view);
    expect(view.entries).toEqual([["value", 1]]);
    expect(ownKeysSpy).toHaveBeenCalledTimes(1);
  });

  it("defines sanitized output without invoking inherited array setters", () => {
    let setterCalls = 0;
    Reflect.defineProperty(Array.prototype, "0", {
      configurable: true,
      set() {
        setterCalls += 1;
      },
    });

    let recordView: ClosedContainerView;
    let arrayView: ClosedContainerView;
    try {
      const recordCapture = createClosedDescriptorCapture();
      const record = { value: 1 };
      recordCapture.captureHeader(record, ["record"]);
      recordView = recordCapture.completeView(record, ["record"]);

      const arrayCapture = createClosedDescriptorCapture();
      const array = [1];
      arrayCapture.captureHeader(array, ["array"]);
      arrayView = arrayCapture.completeView(array, ["array"]);
    } finally {
      Reflect.deleteProperty(Array.prototype, "0");
    }

    expect(setterCalls).toBe(0);
    expectRecordView(recordView);
    expect(recordView.entries).toEqual([["value", 1]]);
    expectArrayView(arrayView);
    expect(arrayView.items).toEqual([1]);
  });

  it("reads intrinsic length in the header and item descriptors after precharge", () => {
    const events: string[] = [];
    const target = ["first", "second"];
    const value = new Proxy(target, {
      getPrototypeOf(current) {
        events.push("prototype");
        return Reflect.getPrototypeOf(current);
      },
      ownKeys(current) {
        events.push("ownKeys");
        return Reflect.ownKeys(current);
      },
      getOwnPropertyDescriptor(current, key) {
        events.push(`descriptor:${String(key)}`);
        return Reflect.getOwnPropertyDescriptor(current, key);
      },
    });
    const capture = createClosedDescriptorCapture();

    const header = capture.captureHeader(value, ["items"]);
    expectArrayHeader(header);
    expect(header.ownKeys).toEqual(["0", "1", "length"]);
    expect(header.length).toBe(2);
    expect(events).toEqual(["prototype", "ownKeys", "descriptor:length"]);
    events.push("caller-precharge");

    const view = capture.completeView(value, ["items"]);
    expectArrayView(view);
    expect(view.items).toEqual(["first", "second"]);
    expect(events).toEqual([
      "prototype",
      "ownKeys",
      "descriptor:length",
      "caller-precharge",
      "descriptor:0",
      "descriptor:1",
    ]);
    expect(capture.captureHeader(value, ["alias"])).toBe(header);
    expect(capture.completeView(value, ["alias"])).toBe(view);
    expect(events).toHaveLength(6);
  });

  it("returns frozen sanitized record entries without freezing child objects", () => {
    const child = { mutable: true };
    const value = {
      null: null,
      boolean: false,
      nan: Number.NaN,
      infinity: Number.POSITIVE_INFINITY,
      negativeZero: -0,
      string: "\ud800",
      object: child,
    };
    const capture = createClosedDescriptorCapture();
    capture.captureHeader(value, ["value"]);
    const view = capture.completeView(value, ["value"]);

    expectRecordView(view);
    expect(view.entries.map(([key]) => key)).toEqual([
      "null",
      "boolean",
      "nan",
      "infinity",
      "negativeZero",
      "string",
      "object",
    ]);
    expect(Number.isNaN(view.entries[2]?.[1])).toBe(true);
    expect(view.entries[3]?.[1]).toBe(Number.POSITIVE_INFINITY);
    expect(Object.is(view.entries[4]?.[1], -0)).toBe(true);
    expect(view.entries[5]?.[1]).toBe("\ud800");
    expect(view.entries[6]?.[1]).toBe(child);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.entries)).toBe(true);
    expect(view.entries.every((entry) => Object.isFrozen(entry))).toBe(true);
    expect(Object.isFrozen(child)).toBe(false);
  });

  it("returns frozen dense array items", () => {
    const value = [null, false, 1, "value", {}];
    const capture = createClosedDescriptorCapture();
    capture.captureHeader(value, ["items"]);
    const view = capture.completeView(value, ["items"]);

    expectArrayView(view);
    expect(view.items).toEqual(value);
    expect(Object.isFrozen(view)).toBe(true);
    expect(Object.isFrozen(view.items)).toBe(true);
  });

  it.each([
    { label: "undefined", value: undefined },
    { label: "bigint", value: 1n },
    { label: "symbol", value: Symbol("value") },
    { label: "function", value: () => undefined },
  ])("rejects a $label descriptor value at its property path", ({ value }) => {
    const record = {};
    Reflect.defineProperty(record, "bad", dataProperty(value));
    const getter = vi.fn(() => "not read");
    Reflect.defineProperty(record, "unrelated", {
      configurable: true,
      enumerable: true,
      get: getter,
    });
    expectViewError(record, ["record"], ["record", "bad"]);
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects an unsupported array value at its numeric path", () => {
    expectViewError([undefined], ["items"], ["items", 0]);
  });

  it("rejects hidden and accessor properties without invoking getters", () => {
    const hidden = {};
    Reflect.defineProperty(hidden, "value", dataProperty(1, false));
    expectViewError(hidden, ["hidden"], ["hidden", "value"]);

    const getter = vi.fn(() => 1);
    const accessor = {};
    Reflect.defineProperty(accessor, "value", {
      configurable: true,
      enumerable: true,
      get: getter,
    });
    expectViewError(accessor, ["accessor"], ["accessor", "value"]);
    expect(getter).not.toHaveBeenCalled();
  });

  it("rejects symbol keys at the container path after reading their descriptor", () => {
    const symbol = Symbol("key");
    const target = {};
    Reflect.defineProperty(target, symbol, dataProperty(1));
    const descriptorKeys: PropertyKey[] = [];
    const value = new Proxy(target, {
      getOwnPropertyDescriptor(current, key) {
        descriptorKeys.push(key);
        return Reflect.getOwnPropertyDescriptor(current, key);
      },
    });
    expectViewError(value, ["record"], ["record"]);
    expect(descriptorKeys).toEqual([symbol]);
  });

  it("rejects sparse arrays at the first missing numeric path", () => {
    const value: unknown[] = [];
    value.length = 3;
    value[1] = "present";
    expectViewError(value, ["items"], ["items", 0]);
  });

  it("rejects array extras, symbols, hidden indexes, and accessors at accepted paths", () => {
    const extra = [1];
    Reflect.defineProperty(extra, "extra", dataProperty(2));
    expectViewError(extra, ["extra"], ["extra", "extra"]);

    const symbol = Symbol("extra");
    const symbolic = [1];
    Reflect.defineProperty(symbolic, symbol, dataProperty(2));
    expectViewError(symbolic, ["symbol"], ["symbol"]);

    const hidden = [1];
    Reflect.defineProperty(hidden, "0", dataProperty(1, false));
    expectViewError(hidden, ["hidden"], ["hidden", 0]);

    const getter = vi.fn(() => 1);
    const accessor: unknown[] = [];
    Reflect.defineProperty(accessor, "0", {
      configurable: true,
      enumerable: true,
      get: getter,
    });
    expectViewError(accessor, ["accessor"], ["accessor", 0]);
    expect(getter).not.toHaveBeenCalled();
  });

  it("normalizes descriptor exceptions and disappearance to property paths", () => {
    const descriptorFailure = new Proxy(
      { value: 1 },
      {
        getOwnPropertyDescriptor() {
          throw new Error("descriptor failure");
        },
      },
    );
    expectViewError(descriptorFailure, ["failure"], ["failure", "value"]);

    const disappearing = new Proxy(
      {},
      {
        ownKeys() {
          return ["gone"];
        },
        getOwnPropertyDescriptor() {
          return undefined;
        },
      },
    );
    expectViewError(disappearing, ["disappearing"], ["disappearing", "gone"]);
  });

  it("never publishes or retries an incomplete failed view", () => {
    let descriptorReads = 0;
    const value = new Proxy(
      { value: 1 },
      {
        getOwnPropertyDescriptor() {
          descriptorReads += 1;
          throw new Error("descriptor failure");
        },
      },
    );
    const capture = createClosedDescriptorCapture();
    const header = capture.captureHeader(value, ["first"]);
    const firstError = expectExecutionContractError(
      () => capture.completeView(value, ["first"]),
      ["first", "value"],
    );
    const aliasError = expectExecutionContractError(
      () => capture.completeView(value, ["alias"]),
      ["first", "value"],
    );

    expect(aliasError).toBe(firstError);
    expect(descriptorReads).toBe(1);
    expectExecutionContractError(
      () => capture.captureHeader(value, ["alias"]),
      ["first", "value"],
    );
    expect(header.kind).toBe("record");
  });

  it("pins reentrant incomplete completion to the active property path", () => {
    const capture = createClosedDescriptorCapture();
    const target = { value: 1 };
    let nestedError: unknown;
    let descriptorReads = 0;
    const value: object = new Proxy(target, {
      getOwnPropertyDescriptor(current, key) {
        descriptorReads += 1;
        try {
          capture.completeView(value, ["forged-path"]);
        } catch (error) {
          nestedError = error;
        }
        return Reflect.getOwnPropertyDescriptor(current, key);
      },
    });
    capture.captureHeader(value, ["outer"]);

    const outerError = expectExecutionContractError(
      () => capture.completeView(value, ["outer"]),
      ["outer", "value"],
    );
    expect(nestedError).toBe(outerError);
    expect(descriptorReads).toBe(1);
    expectExecutionContractError(
      () => capture.completeView(value, ["alias"]),
      ["outer", "value"],
    );
  });

  it("preserves a reentrant failure rethrown by the descriptor trap", () => {
    const capture = createClosedDescriptorCapture();
    const target = { value: 1 };
    const value: object = new Proxy(target, {
      getOwnPropertyDescriptor() {
        capture.completeView(value, ["forged-path"]);
      },
    });
    capture.captureHeader(value, ["outer"]);

    const error = expectExecutionContractError(
      () => capture.completeView(value, ["outer"]),
      ["outer", "value"],
    );
    expect(error.message).toContain("reentered");
    expect(
      expectExecutionContractError(
        () => capture.completeView(value, ["alias"]),
        ["outer", "value"],
      ),
    ).toBe(error);
  });

  it("requires header capture before internal view completion", () => {
    expect(() =>
      createClosedDescriptorCapture().completeView({}, ["root"]),
    ).toThrow(
      new TypeError(
        "[dathra] Closed descriptor header must be captured before completion",
      ),
    );
  });
});

describe("closed descriptor internal boundary", () => {
  it("keeps the exact type fixture free of runtime code", () => {
    const source = readFileSync(
      new URL("./closedDescriptor.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: "closedDescriptor.type-fixture.ts",
    }).outputText;

    expect(output.trim()).toBe("export {};");
  });

  it("publishes only the factory from the internal runtime module", () => {
    expect(Object.keys(closedDescriptorApi)).toEqual([
      "createClosedDescriptorCapture",
    ]);
    expect("createClosedDescriptorCapture" in executionContractApi).toBe(false);
    expect("ClosedDescriptorCapture" in executionContractApi).toBe(false);
  });
});
