import { describe, expect, it, vi } from "vitest";

import { createBudgetLedger, type ExecutionContractBudget } from "./budget";
import { createClosedDataPlan } from "./closedDataWalker";
import { ExecutionContractError } from "./implementation";
import { createSourceCollectionProfile } from "./sourceCollectionProfile";
import * as sourceCollectionProfileApi from "./sourceCollectionProfile";

const REGISTRY_COLLECTION_KEYS = [
  "codecs",
  "resolvers",
  "remoteOperations",
  "remoteDeliveryAdapters",
  "subscriptionSources",
  "brands",
  "valueDomains",
  "policies",
  "hostProfiles",
  "failureSchemas",
] as const;

type RegistryCollectionKey = (typeof REGISTRY_COLLECTION_KEYS)[number];

interface SourceFixture {
  facts: unknown[];
  relations: unknown[];
  exports: Record<string, unknown>;
  registries: Record<RegistryCollectionKey, unknown[]>;
  hostAssumptionFactIds: unknown[];
}

function createRegistries(): Record<RegistryCollectionKey, unknown[]> {
  return {
    codecs: [],
    resolvers: [],
    remoteOperations: [],
    remoteDeliveryAdapters: [],
    subscriptionSources: [],
    brands: [],
    valueDomains: [],
    policies: [],
    hostProfiles: [],
    failureSchemas: [],
  };
}

function createSource(): SourceFixture {
  return {
    facts: [],
    relations: [],
    exports: {},
    registries: createRegistries(),
    hostAssumptionFactIds: [],
  };
}

function createPlan(value: unknown, budget?: ExecutionContractBudget) {
  return createClosedDataPlan(
    value,
    createBudgetLedger(budget),
    createSourceCollectionProfile(),
  );
}

function expectExecutionContractError(
  operation: () => unknown,
  path: readonly (string | number)[],
): ExecutionContractError {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof ExecutionContractError)) throw error;
    if (error.code !== "budget-exceeded") {
      throw new Error(`Expected budget-exceeded, received ${error.code}`);
    }
    if (
      error.path.length !== path.length ||
      error.path.some((segment, index) => segment !== path[index])
    ) {
      throw new Error(
        `Expected path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }
  throw new Error("Expected an ExecutionContractError");
}

describe("source collection cardinality profile", () => {
  it("exports only the internal source collection profile factory", () => {
    expect(Object.keys(sourceCollectionProfileApi)).toEqual([
      "createSourceCollectionProfile",
    ]);
    expect(createSourceCollectionProfile()).not.toBe(
      createSourceCollectionProfile(),
    );
  });

  it.each([
    ["facts", "maximumFacts"] as const,
    ["relations", "maximumRelations"] as const,
  ])("charges root %s exactly and rejects limit+1", (field, counter) => {
    const exact = createSource();
    exact[field].push(null, null);
    expect(() => createPlan(exact, { [counter]: 2 })).not.toThrow();

    const exceeded = createSource();
    exceeded[field].push(null, null);
    const error = expectExecutionContractError(
      () => createPlan(exceeded, { [counter]: 1 }),
      [field],
    );
    expect(error.message).toContain(counter);
  });

  it("charges root exports record properties exactly and rejects limit+1", () => {
    const exact = createSource();
    exact.exports.first = null;
    exact.exports.second = null;
    expect(() => createPlan(exact, { maximumExports: 2 })).not.toThrow();

    const exceeded = createSource();
    exceeded.exports.first = null;
    exceeded.exports.second = null;
    const error = expectExecutionContractError(
      () => createPlan(exceeded, { maximumExports: 1 }),
      ["exports"],
    );
    expect(error.message).toContain("maximumExports");
  });

  it.each(REGISTRY_COLLECTION_KEYS)(
    "charges the %s registry collection exactly and rejects limit+1",
    (key) => {
      const exact = createSource();
      exact.registries[key].push(null, null);
      expect(() =>
        createPlan(exact, { maximumRegistryEntries: 2 }),
      ).not.toThrow();

      const exceeded = createSource();
      exceeded.registries[key].push(null, null);
      const error = expectExecutionContractError(
        () => createPlan(exceeded, { maximumRegistryEntries: 1 }),
        ["registries", key],
      );
      expect(error.message).toContain("maximumRegistryEntries");
    },
  );

  it("charges all ten registry collections cumulatively", () => {
    const exact = createSource();
    for (const key of REGISTRY_COLLECTION_KEYS) {
      exact.registries[key].push(null);
    }
    expect(() =>
      createPlan(exact, { maximumRegistryEntries: 10 }),
    ).not.toThrow();

    const exceeded = createSource();
    for (const key of REGISTRY_COLLECTION_KEYS) {
      exceeded.registries[key].push(null);
    }
    expectExecutionContractError(
      () => createPlan(exceeded, { maximumRegistryEntries: 9 }),
      ["registries", "failureSchemas"],
    );
  });

  it.each(REGISTRY_COLLECTION_KEYS)(
    "charges implementations for %s entries exactly and rejects limit+1",
    (key) => {
      const exact = createSource();
      exact.registries[key].push(
        { implementations: [null] },
        { implementations: [null] },
      );
      expect(() =>
        createPlan(exact, { maximumRegistryImplementations: 2 }),
      ).not.toThrow();

      const exceeded = createSource();
      exceeded.registries[key].push(
        { implementations: [null] },
        { implementations: [null] },
      );
      const error = expectExecutionContractError(
        () => createPlan(exceeded, { maximumRegistryImplementations: 1 }),
        ["registries", key, 1, "implementations"],
      );
      expect(error.message).toContain("maximumRegistryImplementations");
    },
  );

  it("charges implementations from all registry families cumulatively", () => {
    const exact = createSource();
    for (const key of REGISTRY_COLLECTION_KEYS) {
      exact.registries[key].push({ implementations: [null] });
    }
    expect(() =>
      createPlan(exact, { maximumRegistryImplementations: 10 }),
    ).not.toThrow();

    const exceeded = createSource();
    for (const key of REGISTRY_COLLECTION_KEYS) {
      exceeded.registries[key].push({ implementations: [null] });
    }
    expectExecutionContractError(
      () => createPlan(exceeded, { maximumRegistryImplementations: 9 }),
      ["registries", "failureSchemas", 0, "implementations"],
    );
  });

  it("fails at the target array before completing child descriptors", () => {
    const descriptor = vi.fn(Reflect.getOwnPropertyDescriptor);
    const facts = new Proxy<unknown[]>([null], {
      getOwnPropertyDescriptor: descriptor,
    });
    const source = createSource();
    source.facts = facts;

    expectExecutionContractError(
      () => createPlan(source, { maximumFacts: 0 }),
      ["facts"],
    );
    expect(descriptor).toHaveBeenCalledTimes(1);
    expect(descriptor).toHaveBeenCalledWith(facts, "length");
  });

  it("recharges shared registry collection aliases per occurrence", () => {
    const sharedEntries = [null];
    const source = createSource();
    source.registries.codecs = sharedEntries;
    source.registries.resolvers = sharedEntries;

    expectExecutionContractError(
      () => createPlan(source, { maximumRegistryEntries: 1 }),
      ["registries", "resolvers"],
    );
  });

  it("does not charge non-target collections", () => {
    const source = createSource();
    source.hostAssumptionFactIds.push(null, null);
    source.exports.unrelated = { values: [null, null] };
    Reflect.defineProperty(source.registries, "unknown", {
      configurable: true,
      enumerable: true,
      value: [{ implementations: [null, null] }],
      writable: true,
    });

    expect(() =>
      createPlan(source, {
        maximumFacts: 0,
        maximumRelations: 0,
        maximumExports: 1,
        maximumRegistryEntries: 0,
        maximumRegistryImplementations: 0,
      }),
    ).not.toThrow();
  });

  it("keeps profile and ledger state isolated between operations", () => {
    const source = createSource();
    source.facts.push(null);

    expect(() => createPlan(source, { maximumFacts: 1 })).not.toThrow();
    expect(() => createPlan(source, { maximumFacts: 1 })).not.toThrow();
  });

  it("defines role state without invoking inherited array setters", () => {
    const source = createSource();
    source.facts.push(null);
    let setterCalls = 0;
    Reflect.defineProperty(Array.prototype, "0", {
      configurable: true,
      set() {
        setterCalls += 1;
      },
    });

    try {
      expect(() => createPlan(source, { maximumFacts: 1 })).not.toThrow();
    } finally {
      Reflect.deleteProperty(Array.prototype, "0");
    }

    expect(setterCalls).toBe(0);
  });

  it("fails explicitly when operation role state cannot be defined", () => {
    const source = createSource();
    const intrinsicDefineProperty = Reflect.defineProperty;
    const defineProperty = vi
      .spyOn(Reflect, "defineProperty")
      .mockImplementation((target, property, descriptor) => {
        if (Array.isArray(target) && descriptor.value === "root") return false;
        return intrinsicDefineProperty(target, property, descriptor);
      });

    try {
      expect(() => createPlan(source)).toThrowError(
        new TypeError("[dathra] Could not define source collection role"),
      );
    } finally {
      defineProperty.mockRestore();
    }
  });

  it("leaves caller data unchanged", () => {
    const entry = Object.freeze({ implementations: Object.freeze([null]) });
    const source = createSource();
    source.facts.push(entry);
    Object.freeze(source.facts);
    Object.freeze(source.relations);
    Object.freeze(source.exports);
    for (const key of REGISTRY_COLLECTION_KEYS) {
      Object.freeze(source.registries[key]);
    }
    Object.freeze(source.registries);
    Object.freeze(source.hostAssumptionFactIds);
    Object.freeze(source);
    const snapshot = structuredClone(source);

    expect(() => createPlan(source, { maximumFacts: 1 })).not.toThrow();
    expect(source).toEqual(snapshot);
    expect(source.facts[0]).toBe(entry);
  });
});
