import { describe, expect, it, vi } from "vitest";

import {
  snapshotRenderDefinitionCreatorDescriptors,
  snapshotRenderDefinitionParserDescriptors,
  type RenderDefinitionDescriptorFieldSnapshot,
  type RenderDefinitionDescriptorOccurrence,
  type RenderDefinitionDescriptorRecordKind,
  type RenderDefinitionDescriptorSnapshot,
} from "./descriptorSnapshot";
import { RenderDefinitionError } from "./error";

type Path = readonly string[];

const CREATOR_KEYS = [
  "observationContractId",
  "responseContributionSetId",
  "orderedBodyPlanId",
  "exposureContractId",
] as const;
const CREATOR_VALUES = {
  observationContractId: "observation-id",
  responseContributionSetId: "response-id",
  orderedBodyPlanId: "body-id",
  exposureContractId: "exposure-id",
} as const;

const PARSER_RECORDS = [
  { path: [], field: "id" },
  { path: ["preimage"], field: "schema" },
  { path: ["preimage", "observationContract"], field: "schema" },
  { path: ["preimage", "responseContributions"], field: "schema" },
  { path: ["preimage", "orderedBodyPlan"], field: "schema" },
  { path: ["preimage", "exposure"], field: "schema" },
] as const;

function creatorValue(): Record<string, unknown> {
  return { ...CREATOR_VALUES };
}

function parserValue(): Record<string, unknown> {
  return {
    id: "definition-id",
    preimage: {
      schema: "dathra.render-definition/1",
      observationContract: {
        schema: "dathra.render-definition-observation-reference/1",
        role: "observation-contract",
        claimedId: "observation-id",
      },
      responseContributions: {
        schema: "dathra.render-definition-response-reference/1",
        role: "response-contribution-set",
        claimedId: "response-id",
      },
      orderedBodyPlan: {
        schema: "dathra.render-definition-body-reference/1",
        role: "ordered-body-plan",
        claimedId: "body-id",
      },
      exposure: {
        schema: "dathra.render-definition-exposure-reference/1",
        role: "exposure-contract",
        claimedId: "exposure-id",
      },
    },
  };
}

function requireObject(value: unknown): object {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Expected an object fixture");
  }
  return value;
}

function ownDataValue(value: object, key: string): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`Expected data property ${key}`);
  }
  const result: unknown = descriptor.value;
  return result;
}

function recordAt(root: object, path: Path): object {
  let current = root;
  for (const segment of path) {
    current = requireObject(ownDataValue(current, segment));
  }
  return current;
}

function setAt(root: object, path: Path, value: unknown): void {
  const owner = recordAt(root, path.slice(0, -1));
  const key = path.at(-1);
  if (key === undefined) {
    throw new TypeError("Cannot replace root fixture");
  }
  Reflect.defineProperty(owner, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function deleteAt(root: object, path: Path): void {
  const owner = recordAt(root, path.slice(0, -1));
  const key = path.at(-1);
  if (key === undefined || !Reflect.deleteProperty(owner, key)) {
    throw new TypeError("Could not delete fixture field");
  }
}

function defineExtra(
  root: object,
  recordPath: Path,
  key: PropertyKey,
  value: unknown,
): void {
  Reflect.defineProperty(recordAt(root, recordPath), key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function nullPrototypeTree(value: object): object {
  const result: unknown = Object.create(null);
  const target = requireObject(result);
  for (const key of Reflect.ownKeys(value)) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined || !("value" in descriptor)) {
      throw new TypeError("Expected data-only fixture");
    }
    const child: unknown = descriptor.value;
    Reflect.defineProperty(target, key, {
      ...descriptor,
      value:
        typeof child === "object" && child !== null
          ? nullPrototypeTree(child)
          : child,
    });
  }
  return target;
}

function caughtError(run: () => unknown): RenderDefinitionError {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof RenderDefinitionError) {
      return error;
    }
    throw error;
  }
  throw new TypeError("Expected RenderDefinitionError");
}

function expectFailure(
  run: () => unknown,
  code: RenderDefinitionError["code"],
  path: Path,
): RenderDefinitionError {
  const error = caughtError(run);
  expect(error.code).toBe(code);
  expect(error.path).toEqual(path);
  return error;
}

interface ReflectionProbe<Value> {
  readonly result: Value;
  readonly ownKeys: ReadonlyMap<object, number>;
  readonly descriptors: ReadonlyMap<object, ReadonlyMap<PropertyKey, number>>;
}

function increment<Key>(counts: Map<Key, number>, key: Key): void {
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

function probeReflection<Value>(run: () => Value): ReflectionProbe<Value> {
  const ownKeyCounts = new Map<object, number>();
  const descriptorCounts = new Map<object, Map<PropertyKey, number>>();
  const originalOwnKeys = Reflect.ownKeys;
  const originalDescriptor = Reflect.getOwnPropertyDescriptor;
  const ownKeysSpy = vi
    .spyOn(Reflect, "ownKeys")
    .mockImplementation((target: object) => {
      increment(ownKeyCounts, target);
      return originalOwnKeys(target);
    });
  const descriptorSpy = vi
    .spyOn(Reflect, "getOwnPropertyDescriptor")
    .mockImplementation((target: object, key: PropertyKey) => {
      let targetCounts = descriptorCounts.get(target);
      if (targetCounts === undefined) {
        targetCounts = new Map();
        descriptorCounts.set(target, targetCounts);
      }
      increment(targetCounts, key);
      return originalDescriptor(target, key);
    });

  try {
    return {
      result: run(),
      ownKeys: ownKeyCounts,
      descriptors: descriptorCounts,
    };
  } finally {
    descriptorSpy.mockRestore();
    ownKeysSpy.mockRestore();
  }
}

function descriptorCount(
  probe: ReflectionProbe<unknown>,
  target: object,
): number {
  let total = 0;
  for (const count of probe.descriptors.get(target)?.values() ?? []) {
    total += count;
  }
  return total;
}

function occurrence(
  snapshot: RenderDefinitionDescriptorSnapshot,
  kind: RenderDefinitionDescriptorRecordKind,
  path: Path,
): RenderDefinitionDescriptorOccurrence {
  const result = snapshot.occurrences.find(
    (candidate) =>
      candidate.kind === kind &&
      candidate.path.length === path.length &&
      candidate.path.every((segment, index) => segment === path[index]),
  );
  if (result === undefined) {
    throw new TypeError(`Missing ${kind} occurrence`);
  }
  return result;
}

function field(
  target: RenderDefinitionDescriptorOccurrence,
  key: string,
): RenderDefinitionDescriptorFieldSnapshot {
  const result = target.fields.find((candidate) => candidate.key === key);
  if (result === undefined) {
    throw new TypeError(`Missing field snapshot ${key}`);
  }
  return result;
}

describe("render definition descriptor occurrence snapshots", () => {
  it("returns creator and parser occurrences in schema preorder", () => {
    const creator = snapshotRenderDefinitionCreatorDescriptors(creatorValue());
    expect(creator).toEqual({
      occurrences: [
        {
          kind: "creator-input",
          path: [],
          ownKeys: CREATOR_KEYS,
          fields: CREATOR_KEYS.map((key) => ({
            key,
            state: "string",
            value: CREATOR_VALUES[key],
          })),
        },
      ],
    });

    const parser = snapshotRenderDefinitionParserDescriptors(parserValue());
    expect(
      parser.occurrences.map(({ kind, path }) => ({ kind, path })),
    ).toEqual([
      { kind: "wrapper", path: [] },
      { kind: "preimage", path: ["preimage"] },
      {
        kind: "observation-claim",
        path: ["preimage", "observationContract"],
      },
      {
        kind: "response-claim",
        path: ["preimage", "responseContributions"],
      },
      { kind: "body-claim", path: ["preimage", "orderedBodyPlan"] },
      { kind: "exposure-claim", path: ["preimage", "exposure"] },
    ]);
    expect(field(parser.occurrences[0], "id")).toEqual({
      key: "id",
      state: "string",
      value: "definition-id",
    });
    expect(field(parser.occurrences[0], "preimage")).toEqual({
      key: "preimage",
      state: "object",
    });
  });

  it("accepts null-prototype records throughout both traversal shapes", () => {
    expect(
      snapshotRenderDefinitionCreatorDescriptors(
        nullPrototypeTree(creatorValue()),
      ),
    ).toEqual(snapshotRenderDefinitionCreatorDescriptors(creatorValue()));
    expect(
      snapshotRenderDefinitionParserDescriptors(
        nullPrototypeTree(parserValue()),
      ),
    ).toEqual(snapshotRenderDefinitionParserDescriptors(parserValue()));
  });

  it("returns a deeply immutable surface without descriptors or caller objects", () => {
    const source = parserValue();
    const sourcePreimage = recordAt(source, ["preimage"]);
    const snapshot = snapshotRenderDefinitionParserDescriptors(source);

    expect(Reflect.ownKeys(snapshot)).toEqual(["occurrences"]);
    expect(snapshot.occurrences.map((item) => Reflect.ownKeys(item))).toEqual(
      Array.from({ length: 6 }, () => ["kind", "path", "ownKeys", "fields"]),
    );
    expect(snapshot.occurrences.some((item) => item instanceof Map)).toBe(
      false,
    );
    expect(snapshot.occurrences.some((item) => item === sourcePreimage)).toBe(
      false,
    );
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.occurrences)).toBe(true);
    expect(
      snapshot.occurrences.flatMap((item) => [
        Object.isFrozen(item),
        Object.isFrozen(item.path),
        Object.isFrozen(item.ownKeys),
        Object.isFrozen(item.fields),
        ...item.fields.map(Object.isFrozen),
      ]),
    ).not.toContain(false);

    setAt(source, ["id"], "changed");
    setAt(source, ["preimage", "schema"], "changed");
    expect(field(snapshot.occurrences[0], "id")).toMatchObject({
      state: "string",
      value: "definition-id",
    });
    expect(field(snapshot.occurrences[1], "schema")).toMatchObject({
      state: "string",
      value: "dathra.render-definition/1",
    });
  });

  it("leaves scalar budgets and semantic classification to DI2B", () => {
    const creator = creatorValue();
    const extraTrap = vi.fn(() => {
      throw new TypeError("Extra value must not be inspected");
    });
    deleteAt(creator, ["observationContractId"]);
    setAt(creator, ["responseContributionSetId"], "x".repeat(300));
    setAt(creator, ["orderedBodyPlanId"], { malformed: true });
    defineExtra(
      creator,
      [],
      "extra",
      new Proxy(
        {},
        {
          get: extraTrap,
          getOwnPropertyDescriptor: extraTrap,
          getPrototypeOf: extraTrap,
          ownKeys: extraTrap,
        },
      ),
    );

    const snapshot = snapshotRenderDefinitionCreatorDescriptors(creator);
    const root = snapshot.occurrences[0];
    expect(field(root, "observationContractId")).toEqual({
      key: "observationContractId",
      state: "missing",
    });
    expect(field(root, "responseContributionSetId")).toEqual({
      key: "responseContributionSetId",
      state: "string",
      value: "x".repeat(300),
    });
    expect(field(root, "orderedBodyPlanId")).toEqual({
      key: "orderedBodyPlanId",
      state: "object",
    });
    expect(root.ownKeys).toContain("extra");
    expect(extraTrap).not.toHaveBeenCalled();

    const parser = parserValue();
    setAt(parser, ["id"], "not-a-digest");
    setAt(parser, ["preimage", "schema"], "wrong-schema");
    setAt(parser, ["preimage", "observationContract", "role"], 1);
    expect(() =>
      snapshotRenderDefinitionParserDescriptors(parser),
    ).not.toThrow();

    const missingChild = parserValue();
    deleteAt(missingChild, ["preimage"]);
    expect(
      snapshotRenderDefinitionParserDescriptors(missingChild).occurrences,
    ).toHaveLength(1);
  });

  it.each([
    ["string", "not-a-preimage", "string"],
    ["null", null, "non-string"],
    ["number", 1, "non-string"],
  ] as const)(
    "retains a %s nested field for DI2B without creating a child occurrence",
    (_name, nestedValue, state) => {
      const value = parserValue();
      setAt(value, ["preimage"], nestedValue);

      const snapshot = snapshotRenderDefinitionParserDescriptors(value);

      expect(snapshot.occurrences).toHaveLength(1);
      expect(field(snapshot.occurrences[0], "preimage")).toMatchObject({
        key: "preimage",
        state,
      });
    },
  );

  it("does not access WebCrypto", () => {
    let cryptoReads = 0;
    vi.stubGlobal(
      "crypto",
      new Proxy(
        {},
        {
          get() {
            cryptoReads += 1;
            throw new TypeError("DI2A must not read WebCrypto");
          },
        },
      ),
    );
    try {
      snapshotRenderDefinitionCreatorDescriptors(creatorValue());
      snapshotRenderDefinitionParserDescriptors(parserValue());
    } finally {
      vi.unstubAllGlobals();
    }
    expect(cryptoReads).toBe(0);
  });
});

describe("render definition descriptor resource boundary", () => {
  it.each([
    ["non-record", null],
    ["array", []],
    ["typed array", new Uint8Array()],
    ["custom prototype", Object.create({})],
  ])("rejects %s before own-key enumeration", (_name, value: unknown) => {
    const target = typeof value === "object" && value !== null ? value : null;
    const probe = probeReflection(() =>
      caughtError(() => snapshotRenderDefinitionCreatorDescriptors(value)),
    );
    expect(probe.result.code).toBe("invalid-closed-record");
    expect(probe.result.path).toEqual([]);
    expect(target === null ? 0 : (probe.ownKeys.get(target) ?? 0)).toBe(0);
  });

  it("rejects an invalid nested record before enumerating it", () => {
    const value = parserValue();
    const nested: unknown = Object.create({});
    setAt(value, ["preimage", "observationContract"], nested);
    const target = requireObject(nested);
    const probe = probeReflection(() =>
      caughtError(() => snapshotRenderDefinitionParserDescriptors(value)),
    );
    expect(probe.result.code).toBe("invalid-closed-record");
    expect(probe.result.path).toEqual(["preimage", "observationContract"]);
    expect(probe.ownKeys.get(target)).toBeUndefined();
  });

  it("accepts 16 keys and rejects 17 before descriptor lookup", () => {
    const boundary = creatorValue();
    for (let index = 0; index < 12; index += 1) {
      defineExtra(boundary, [], `extra${index}`, index);
    }
    expect(
      snapshotRenderDefinitionCreatorDescriptors(boundary).occurrences[0]
        .ownKeys,
    ).toHaveLength(16);

    const exceeded = creatorValue();
    for (let index = 0; index < 13; index += 1) {
      defineExtra(exceeded, [], `extra${index}`, index);
    }
    const probe = probeReflection(() =>
      caughtError(() => snapshotRenderDefinitionCreatorDescriptors(exceeded)),
    );
    expect(probe.result.code).toBe("budget-exceeded");
    expect(probe.result.path).toEqual([]);
    expect(descriptorCount(probe, exceeded)).toBe(0);
  });

  it("accepts a 128-code-unit key and rejects 129 before descriptors", () => {
    const boundary = creatorValue();
    const boundaryKey = "k".repeat(128);
    defineExtra(boundary, [], boundaryKey, 1);
    expect(
      snapshotRenderDefinitionCreatorDescriptors(boundary).occurrences[0]
        .ownKeys,
    ).toContain(boundaryKey);

    const exceeded = creatorValue();
    defineExtra(exceeded, [], "k".repeat(129), 1);
    const probe = probeReflection(() =>
      caughtError(() => snapshotRenderDefinitionCreatorDescriptors(exceeded)),
    );
    expect(probe.result.code).toBe("budget-exceeded");
    expect(probe.result.path).toEqual([]);
    expect(descriptorCount(probe, exceeded)).toBe(0);
  });

  it("uses key count before key length", () => {
    const value = creatorValue();
    defineExtra(value, [], "x".repeat(129), 1);
    for (let index = 0; index < 12; index += 1) {
      defineExtra(value, [], `z${index}`, index);
    }
    const error = expectFailure(
      () => snapshotRenderDefinitionCreatorDescriptors(value),
      "budget-exceeded",
      [],
    );
    expect(error.message).toContain("own-key");
  });

  it("rejects an own key whose descriptor disappears during capture", () => {
    const value = creatorValue();
    const originalDescriptor = Reflect.getOwnPropertyDescriptor;
    const descriptorSpy = vi
      .spyOn(Reflect, "getOwnPropertyDescriptor")
      .mockImplementation((target: object, key: PropertyKey) => {
        if (target === value && key === "observationContractId") {
          return undefined;
        }
        return originalDescriptor(target, key);
      });

    try {
      expectFailure(
        () => snapshotRenderDefinitionCreatorDescriptors(value),
        "invalid-closed-record",
        [],
      );
    } finally {
      descriptorSpy.mockRestore();
    }
  });

  it("reflects each distinct valid record exactly once", () => {
    const creator = creatorValue();
    const creatorProbe = probeReflection(() =>
      snapshotRenderDefinitionCreatorDescriptors(creator),
    );
    expect(creatorProbe.ownKeys.get(creator)).toBe(1);
    expect(descriptorCount(creatorProbe, creator)).toBe(4);
    expect([
      ...(creatorProbe.descriptors.get(creator)?.values() ?? []),
    ]).toEqual([1, 1, 1, 1]);

    const parser = parserValue();
    const records = PARSER_RECORDS.map(({ path }) => recordAt(parser, path));
    const parserProbe = probeReflection(() =>
      snapshotRenderDefinitionParserDescriptors(parser),
    );
    expect(records.map((record) => parserProbe.ownKeys.get(record))).toEqual(
      Array.from({ length: 6 }, () => 1),
    );
    expect(
      records.map((record) => descriptorCount(parserProbe, record)),
    ).toEqual([2, 5, 3, 3, 3, 3]);
    expect(
      records.map((record) => [
        ...(parserProbe.descriptors.get(record)?.values() ?? []),
      ]),
    ).toEqual([
      [1, 1],
      [1, 1, 1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
      [1, 1, 1],
    ]);
  });

  it("reuses alias reflection while retaining both path occurrences", () => {
    const value = parserValue();
    const alias = recordAt(value, ["preimage", "observationContract"]);
    setAt(value, ["preimage", "responseContributions"], alias);
    const probe = probeReflection(() =>
      snapshotRenderDefinitionParserDescriptors(value),
    );

    expect(probe.ownKeys.get(alias)).toBe(1);
    expect(descriptorCount(probe, alias)).toBe(3);
    expect([...(probe.descriptors.get(alias)?.values() ?? [])]).toEqual([
      1, 1, 1,
    ]);
    expect(
      occurrence(probe.result, "observation-claim", [
        "preimage",
        "observationContract",
      ]).path,
    ).toEqual(["preimage", "observationContract"]);
    expect(
      occurrence(probe.result, "response-claim", [
        "preimage",
        "responseContributions",
      ]).path,
    ).toEqual(["preimage", "responseContributions"]);
  });

  it("stops before descriptors on the failing nested record and later records", () => {
    const value = parserValue();
    const wrapper = recordAt(value, []);
    const preimage = recordAt(value, ["preimage"]);
    const observation = recordAt(value, ["preimage", "observationContract"]);
    const response = recordAt(value, ["preimage", "responseContributions"]);
    for (let index = 0; index < 14; index += 1) {
      defineExtra(observation, [], `extra${index}`, index);
    }
    const probe = probeReflection(() =>
      caughtError(() => snapshotRenderDefinitionParserDescriptors(value)),
    );
    expect(probe.result.code).toBe("budget-exceeded");
    expect(probe.result.path).toEqual(["preimage", "observationContract"]);
    expect(descriptorCount(probe, wrapper)).toBe(2);
    expect(descriptorCount(probe, preimage)).toBe(5);
    expect(descriptorCount(probe, observation)).toBe(0);
    expect(probe.ownKeys.get(response)).toBeUndefined();
  });
});

describe("render definition descriptor structural rejection", () => {
  it.each(PARSER_RECORDS)(
    "rejects an accessor at $path without invoking it",
    ({ path, field: fieldName }) => {
      const value = parserValue();
      const getter = vi.fn(() => "unexpected");
      Reflect.defineProperty(recordAt(value, path), fieldName, {
        configurable: true,
        enumerable: true,
        get: getter,
      });
      expectFailure(
        () => snapshotRenderDefinitionParserDescriptors(value),
        "invalid-closed-record",
        path,
      );
      expect(getter).not.toHaveBeenCalled();
    },
  );

  it.each(PARSER_RECORDS)(
    "rejects a hidden property at $path",
    ({ path, field: fieldName }) => {
      const value = parserValue();
      const current = ownDataValue(recordAt(value, path), fieldName);
      Reflect.defineProperty(recordAt(value, path), fieldName, {
        configurable: true,
        enumerable: false,
        value: current,
        writable: true,
      });
      expectFailure(
        () => snapshotRenderDefinitionParserDescriptors(value),
        "invalid-closed-record",
        path,
      );
    },
  );

  it.each(PARSER_RECORDS)("rejects a symbol property at $path", ({ path }) => {
    const value = parserValue();
    defineExtra(value, path, Symbol("extra"), 1);
    expectFailure(
      () => snapshotRenderDefinitionParserDescriptors(value),
      "invalid-closed-record",
      path,
    );
  });
});
