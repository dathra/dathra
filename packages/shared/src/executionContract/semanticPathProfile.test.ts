import { describe, expect, it, vi } from "vitest";

import { createBudgetLedger, type ExecutionContractBudget } from "./budget";
import { createClosedDataPlan } from "./closedDataWalker";
import { ExecutionContractError } from "./implementation";
import { createSemanticPathProfile } from "./semanticPathProfile";
import * as semanticPathProfileApi from "./semanticPathProfile";

function createPlan(value: unknown, budget?: ExecutionContractBudget) {
  return createClosedDataPlan(
    value,
    createBudgetLedger(budget),
    createSemanticPathProfile(),
  );
}

function expectBudgetFailure(
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
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    if (!error.message.includes("maximumSemanticPathSegments")) {
      throw new Error("Expected the semantic path segment counter failure");
    }
    return error;
  }
  throw new Error("Expected an ExecutionContractError");
}

describe("semantic path segment profile", () => {
  it("exports only the internal profile factory", () => {
    expect(Object.keys(semanticPathProfileApi)).toEqual([
      "createSemanticPathProfile",
    ]);
    expect(createSemanticPathProfile()).not.toBe(createSemanticPathProfile());
    expect(Object.isFrozen(createSemanticPathProfile())).toBe(true);
  });

  it("charges empty and repeated semantic path segments", () => {
    const repeatedSegment = { kind: "property", key: "next" };
    const source = {
      facts: [
        { subject: { kind: "parameter", path: [] } },
        {
          subject: {
            kind: "return",
            path: [repeatedSegment, repeatedSegment, repeatedSegment],
          },
        },
      ],
    };

    expect(() =>
      createPlan(source, { maximumSemanticPathSegments: 3 }),
    ).not.toThrow();
    expectBudgetFailure(
      () => createPlan(source, { maximumSemanticPathSegments: 2 }),
      ["facts", 1, "subject", "path"],
    );
  });

  it("charges every fact subject path occurrence before semantic validation", () => {
    const source = {
      facts: [
        { subject: { kind: "parameter", path: [] } },
        {
          subject: {
            kind: "return",
            path: [{ kind: "property", key: "value" }],
          },
        },
        {
          subject: {
            kind: "callback-invocation",
            path: [{ kind: "element" }, { kind: "tuple-index", index: 0 }],
          },
        },
        {
          subject: {
            kind: "module-evaluation",
            path: [{ kind: "property", key: "invalid" }],
          },
        },
        {
          subject: {
            kind: "not-a-subject",
            path: [
              { kind: "property", key: "first" },
              { kind: "property", key: "second" },
            ],
          },
        },
        {
          subject: {
            path: [
              { kind: "property", key: "missing-discriminator" },
              { kind: "element" },
              { kind: "tuple-index", index: -1 },
            ],
          },
        },
      ],
    };

    expect(() =>
      createPlan(source, { maximumSemanticPathSegments: 9 }),
    ).not.toThrow();
    expectBudgetFailure(
      () => createPlan(source, { maximumSemanticPathSegments: 8 }),
      ["facts", 5, "subject", "path"],
    );
  });

  it("fails at the target path before child descriptor completion", () => {
    const descriptor = vi.fn(Reflect.getOwnPropertyDescriptor);
    const path = new Proxy([{ kind: "property", key: "value" }], {
      getOwnPropertyDescriptor: descriptor,
    });
    const source = {
      facts: [{ subject: { kind: "parameter", path } }],
    };

    expectBudgetFailure(
      () => createPlan(source, { maximumSemanticPathSegments: 0 }),
      ["facts", 0, "subject", "path"],
    );
    expect(descriptor).toHaveBeenCalledTimes(1);
    expect(descriptor).toHaveBeenCalledWith(path, "length");
  });

  it("recharges each alias occurrence without retaining the path array", () => {
    const ownKeys = vi.fn(Reflect.ownKeys);
    const sharedPath = new Proxy(
      [
        { kind: "property", key: "first" },
        { kind: "property", key: "second" },
      ],
      { ownKeys },
    );
    const source = {
      facts: [
        { subject: { kind: "parameter", path: sharedPath } },
        { subject: { kind: "return", path: sharedPath } },
      ],
    };

    expect(() =>
      createPlan(source, { maximumSemanticPathSegments: 4 }),
    ).not.toThrow();
    expectBudgetFailure(
      () => createPlan(source, { maximumSemanticPathSegments: 3 }),
      ["facts", 1, "subject", "path"],
    );
    expect(ownKeys).toHaveBeenCalledTimes(2);
  });

  it("does not charge path arrays outside a fact subject", () => {
    const source = {
      path: [{ kind: "property", key: "root" }],
      facts: [
        {
          path: [{ kind: "property", key: "fact" }],
          subject: {
            kind: "parameter",
            valuePath: [{ kind: "property", key: "not-path" }],
          },
        },
      ],
      nested: { subject: { path: [{ kind: "element" }] } },
    };

    expect(() =>
      createPlan(source, { maximumSemanticPathSegments: 0 }),
    ).not.toThrow();
  });

  it("does not treat a non-record root as an execution source", () => {
    const input = [
      {
        facts: [
          {
            subject: {
              path: [{ kind: "property", key: "not-a-source-path" }],
            },
          },
        ],
      },
    ];

    expect(() =>
      createPlan(input, { maximumSemanticPathSegments: 0 }),
    ).not.toThrow();
  });

  it("does not depend on mutable Map prototype methods", () => {
    const source = {
      facts: [
        {
          subject: {
            kind: "parameter",
            path: [{ kind: "property", key: "value" }],
          },
        },
      ],
    };
    const ledger = createBudgetLedger({ maximumSemanticPathSegments: 1 });
    const profile = createSemanticPathProfile();
    const get = vi.spyOn(Map.prototype, "get").mockImplementation(() => {
      throw new Error("Map.prototype.get must not be called");
    });
    const set = vi.spyOn(Map.prototype, "set").mockImplementation(() => {
      throw new Error("Map.prototype.set must not be called");
    });

    try {
      createClosedDataPlan(source, ledger, profile);
    } finally {
      get.mockRestore();
      set.mockRestore();
    }

    expect(get).not.toHaveBeenCalled();
    expect(set).not.toHaveBeenCalled();
  });

  it("defines role state without invoking inherited array setters", () => {
    const source = { facts: [{ subject: { path: [] } }] };
    let setterCalls = 0;
    Reflect.defineProperty(Array.prototype, "0", {
      configurable: true,
      set() {
        setterCalls += 1;
      },
    });

    try {
      createPlan(source, { maximumSemanticPathSegments: 0 });
    } finally {
      Reflect.deleteProperty(Array.prototype, "0");
    }

    expect(setterCalls).toBe(0);
  });

  it("fails explicitly when operation role state cannot be defined", () => {
    const intrinsicDefineProperty = Reflect.defineProperty;
    const defineProperty = vi
      .spyOn(Reflect, "defineProperty")
      .mockImplementation((target, property, descriptor) => {
        if (Array.isArray(target) && descriptor.value === "source-root") {
          return false;
        }
        return intrinsicDefineProperty(target, property, descriptor);
      });

    try {
      expect(() => createPlan({ facts: [] })).toThrowError(
        new TypeError("[dathra] Could not define SemanticPath role"),
      );
    } finally {
      defineProperty.mockRestore();
    }
  });

  it("creates isolated profiles and leaves caller data unchanged", () => {
    const source = {
      facts: [
        {
          subject: {
            kind: "callback-invocation",
            path: [{ kind: "property", key: "callback" }],
          },
        },
      ],
    };
    const before = structuredClone(source);
    const firstProfile = createSemanticPathProfile();
    const secondProfile = createSemanticPathProfile();

    expect(firstProfile).not.toBe(secondProfile);
    expectBudgetFailure(
      () =>
        createClosedDataPlan(
          source,
          createBudgetLedger({ maximumSemanticPathSegments: 0 }),
          firstProfile,
        ),
      ["facts", 0, "subject", "path"],
    );
    expect(() =>
      createClosedDataPlan(
        source,
        createBudgetLedger({ maximumSemanticPathSegments: 1 }),
        secondProfile,
      ),
    ).not.toThrow();
    expect(source).toEqual(before);
    expect(Object.isFrozen(source)).toBe(false);
    expect(Object.isFrozen(source.facts[0].subject.path)).toBe(false);
  });
});
