import { describe, expect, it, vi } from "vitest";

import { createBudgetLedger } from "./budget";
import { createClosedDataPlan } from "./closedDataWalker";
import { ExecutionContractError } from "./implementation";
import { createSourceReferenceProfile } from "./sourceReferenceProfile";

function expectBudgetExceeded(
  operation: () => unknown,
  path: readonly (string | number)[],
): void {
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
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return;
  }
  throw new Error("Expected an ExecutionContractError");
}

function walkSource(value: unknown, maximumReferences: number): void {
  createClosedDataPlan(
    value,
    createBudgetLedger({ maximumReferences }),
    createSourceReferenceProfile(),
  );
}

function emptyRegistries() {
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

function source(overrides: Record<string, unknown> = {}) {
  return {
    schema: "dathra.execution/1",
    id: "declaration-id",
    version: "1",
    facts: [],
    relations: [],
    exports: {},
    registries: emptyRegistries(),
    hostAssumptionFactIds: [],
    ...overrides,
  };
}

const EXHAUSTIVE_SOURCE = source({
  facts: [
    { kind: "environment", hostProfileIds: ["host-a", "host-b"] },
    {
      kind: "read",
      environmentFactId: "environment",
      exposureFactId: "exposure",
    },
    {
      kind: "write",
      environmentFactId: "environment",
      exposureFactId: "exposure",
    },
    { kind: "invocation", receiverBrandId: null },
    { kind: "identity", brandId: null },
    { kind: "failure", schemaId: "failure-schema" },
    { kind: "transfer", binding: { kind: "codec", codecId: "codec" } },
    {
      kind: "transfer",
      binding: {
        kind: "reference",
        resolverId: "resolver",
        capabilityPolicyId: "capability-policy",
      },
    },
    {
      kind: "transfer",
      binding: { kind: "subscription", sourceId: "subscription" },
    },
    {
      kind: "transfer",
      binding: { kind: "remote", operationId: "operation" },
    },
    {
      kind: "exposure",
      audiencePolicyId: "audience-policy",
      sinkPolicyIds: ["sink-a", "sink-b"],
      releasePolicyId: null,
    },
    { kind: "integrity", endorsementPolicyId: null },
    {
      kind: "trust-boundary",
      capabilityPolicyIds: ["capability-a", "capability-b"],
    },
  ],
  relations: [
    "reads",
    "writes",
    "invokes",
    "returns",
    "owns",
    "orders-before",
    "transfers-as",
    "fails-with",
  ].map((kind) => ({
    kind,
    from: { factId: `${kind}:from`, factKind: "effect" },
    to: { factId: `${kind}:to`, factKind: "read" },
    ordinal: 0,
  })),
  exports: {
    run: {
      factIds: ["export-a", "export-b"],
      receiverBrandId: null,
      valueDomainId: "value-domain",
      transfer: {
        kind: "reference",
        resolverId: "export-resolver",
        capabilityPolicyId: "export-capability-policy",
      },
    },
  },
  hostAssumptionFactIds: ["host-assumption-a", "host-assumption-b"],
});

describe("source reference cardinality profile", () => {
  it("exports only the fresh profile factory", async () => {
    const module = await import("./sourceReferenceProfile");

    expect(Object.keys(module)).toEqual(["createSourceReferenceProfile"]);
    expect(createSourceReferenceProfile()).not.toBe(
      createSourceReferenceProfile(),
    );
  });

  it("charges every source-model reference slot family exactly once", () => {
    walkSource(EXHAUSTIVE_SOURCE, 45);
    expectBudgetExceeded(
      () => walkSource(EXHAUSTIVE_SOURCE, 44),
      ["hostAssumptionFactIds"],
    );
  });

  it.each([
    [
      source({ facts: [{ environmentFactId: "environment" }] }),
      ["facts", 0, "environmentFactId"],
    ],
    [
      source({ relations: [{ from: { factId: "fact" } }] }),
      ["relations", 0, "from", "factId"],
    ],
    [
      source({ exports: { run: { valueDomainId: "domain" } } }),
      ["exports", "run", "valueDomainId"],
    ],
    [
      source({ facts: [{ binding: { codecId: "codec" } }] }),
      ["facts", 0, "binding", "codecId"],
    ],
    [
      source({ exports: { run: { transfer: { resolverId: "resolver" } } } }),
      ["exports", "run", "transfer", "resolverId"],
    ],
  ] as const)(
    "charges each scalar reference location family exactly and rejects limit+1 %#",
    (input, path) => {
      walkSource(input, 1);
      expectBudgetExceeded(() => walkSource(input, 0), path);
    },
  );

  it.each([
    [
      source({ hostAssumptionFactIds: ["first", "second"] }),
      ["hostAssumptionFactIds"],
    ],
    [
      source({
        facts: [{ hostProfileIds: ["first", "second"] }],
      }),
      ["facts", 0, "hostProfileIds"],
    ],
    [
      source({ exports: { run: { factIds: ["first", "second"] } } }),
      ["exports", "run", "factIds"],
    ],
  ] as const)(
    "charges each array reference location family exactly and rejects limit+1 %#",
    (input, path) => {
      walkSource(input, 2);
      expectBudgetExceeded(() => walkSource(input, 1), path);
    },
  );

  it("precharges an array-valued reference collection before child descriptors", () => {
    const descriptors: PropertyKey[] = [];
    const references = new Proxy(["first", "second"], {
      getOwnPropertyDescriptor(target, key) {
        descriptors.push(key);
        return Reflect.getOwnPropertyDescriptor(target, key);
      },
    });
    const input = source({ hostAssumptionFactIds: references });

    expectBudgetExceeded(() => walkSource(input, 1), ["hostAssumptionFactIds"]);
    expect(descriptors).toEqual(["length"]);
  });

  it("charges a present nullable scalar slot but not an absent slot", () => {
    const present = source({
      facts: [{ kind: "invocation", receiverBrandId: null }],
    });
    const missing = source({ facts: [{ kind: "invocation" }] });

    walkSource(present, 1);
    expectBudgetExceeded(
      () => walkSource(present, 0),
      ["facts", 0, "receiverBrandId"],
    );
    walkSource(missing, 0);
  });

  it("charges structurally present potential references before discriminator validation", () => {
    const input = source({
      facts: [
        {
          kind: "unknown-fact-kind",
          environmentFactId: "environment",
        },
      ],
    });

    expectBudgetExceeded(
      () => walkSource(input, 0),
      ["facts", 0, "environmentFactId"],
    );
  });

  it("recharges aliased reference arrays for each structural occurrence", () => {
    const sharedReferences = ["shared"];
    const input = source({
      facts: [{ kind: "environment", hostProfileIds: sharedReferences }],
      hostAssumptionFactIds: sharedReferences,
    });

    expectBudgetExceeded(() => walkSource(input, 1), ["hostAssumptionFactIds"]);
  });

  it("does not charge declarations, versions, locators, fact kinds, or callback indexes", () => {
    const input = source({
      exports: {
        run: { metadata: { factId: "not-an-export-reference" } },
      },
      facts: [
        {
          id: "fact-declaration",
          version: "1",
          kind: "invocation",
          callbackParameterIndexes: [0, 1],
        },
      ],
      relations: [
        {
          kind: "orders-before",
          from: { factKind: "effect" },
          to: { factKind: "read" },
          ordinal: 0,
          metadata: { factId: "not-a-relation-endpoint" },
        },
      ],
      registries: {
        ...emptyRegistries(),
        codecs: [
          {
            id: "codec-declaration",
            version: "1",
            descriptor: { specifier: "./codec", exportName: "codec" },
            implementations: [
              {
                registryKind: "codec",
                environment: "browser",
                role: "codec-encode",
                implementation: {
                  specifier: "./codec",
                  exportName: "encode",
                },
              },
            ],
          },
        ],
      },
    });

    expect(() => walkSource(input, 0)).not.toThrow();
  });

  it("does not depend on mutable Map prototype methods", () => {
    const input = source({ facts: [{ schemaId: "schema" }] });
    const ledger = createBudgetLedger({ maximumReferences: 1 });
    const profile = createSourceReferenceProfile();
    const get = vi.spyOn(Map.prototype, "get").mockImplementation(() => {
      throw new Error("Map.prototype.get must not be called");
    });
    const set = vi.spyOn(Map.prototype, "set").mockImplementation(() => {
      throw new Error("Map.prototype.set must not be called");
    });

    try {
      createClosedDataPlan(input, ledger, profile);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("traverses captured record entries without the mutable array iterator", () => {
    const input = source({ facts: [{ schemaId: "schema" }] });
    const ledger = createBudgetLedger({ maximumReferences: 1 });
    const profile = createSourceReferenceProfile();
    const intrinsicIterator = Array.prototype[Symbol.iterator];
    let iteratorCalls = 0;
    Reflect.defineProperty(Array.prototype, Symbol.iterator, {
      configurable: true,
      value(this: unknown[]) {
        iteratorCalls += 1;
        return intrinsicIterator.call(this);
      },
      writable: true,
    });

    try {
      createClosedDataPlan(input, ledger, profile);
    } finally {
      Reflect.defineProperty(Array.prototype, Symbol.iterator, {
        configurable: true,
        value: intrinsicIterator,
        writable: true,
      });
    }

    expect(iteratorCalls).toBe(0);
  });

  it("defines role state without invoking inherited array setters", () => {
    const input = source({ facts: [{ schemaId: "schema" }] });
    let setterCalls = 0;
    Reflect.defineProperty(Array.prototype, "0", {
      configurable: true,
      set() {
        setterCalls += 1;
      },
    });

    try {
      walkSource(input, 1);
    } finally {
      Reflect.deleteProperty(Array.prototype, "0");
    }

    expect(setterCalls).toBe(0);
  });

  it("fails explicitly when operation role state cannot be defined", () => {
    const input = source();
    const intrinsicDefineProperty = Reflect.defineProperty;
    const defineProperty = vi
      .spyOn(Reflect, "defineProperty")
      .mockImplementation((target, property, descriptor) => {
        if (Array.isArray(target) && descriptor.value === "source")
          return false;
        return intrinsicDefineProperty(target, property, descriptor);
      });

    try {
      expect(() => walkSource(input, 0)).toThrowError(
        new TypeError("[dathra] Could not define source reference role"),
      );
    } finally {
      defineProperty.mockRestore();
    }
  });

  it("keeps profile operations isolated and leaves caller data unchanged", () => {
    const input = source({
      facts: [{ kind: "failure", schemaId: "failure-schema" }],
    });
    const snapshot = structuredClone(input);

    expectBudgetExceeded(() => walkSource(input, 0), ["facts", 0, "schemaId"]);
    walkSource(input, 1);

    expect(input).toEqual(snapshot);
  });
});
