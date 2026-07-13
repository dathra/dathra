import { readFileSync } from "node:fs";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { afterEach, describe, expect, it, vi } from "vitest";

import { createBudgetLedger, type ExecutionContractBudget } from "./budget";
import {
  createClosedDataPlan,
  type ClosedDataProfile,
} from "./closedDataWalker";
import type {
  ClosedContainerHeader,
  ClosedContainerView,
} from "./closedDescriptor";
import { ExecutionContractError } from "./implementation";
import { createOccurrencePlanBuilder } from "./occurrencePlan";
import { createSourceProfile } from "./sourceProfile";
import * as sourceProfileApi from "./sourceProfile";

const CHILD_MODULES = [
  "./sourceCollectionProfile",
  "./sourceReferenceProfile",
  "./semanticPathProfile",
] as const;

type ChildProfileFactory = () => ClosedDataProfile;

function createPlan(value: unknown, budget?: ExecutionContractBudget) {
  return createClosedDataPlan(
    value,
    createBudgetLedger(budget),
    createSourceProfile(),
  );
}

function createSource() {
  return {
    facts: [
      {
        hostProfileIds: ["host"],
        subject: {
          kind: "parameter",
          path: [{ kind: "property", key: "value" }],
        },
      },
    ],
    relations: [],
    exports: {},
    registries: {
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
    },
    hostAssumptionFactIds: [],
  };
}

function expectBudgetFailure(
  operation: () => unknown,
  counter: keyof ExecutionContractBudget,
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
    if (!error.message.includes(counter)) {
      throw new Error(`Expected ${counter} in the budget diagnostic`);
    }
    return error;
  }
  throw new Error("Expected an ExecutionContractError");
}

function captureThrown(operation: () => unknown): unknown {
  try {
    operation();
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to throw");
}

function createProbeProfile(name: string, calls: string[]): ClosedDataProfile {
  return {
    beforeChildren() {
      calls.push(`${name}:children`);
    },
    beforeDescriptors() {
      calls.push(`${name}:descriptors`);
    },
  };
}

async function importWithChildProfiles(
  collection: ClosedDataProfile,
  reference: ClosedDataProfile,
  semanticPath: ClosedDataProfile,
) {
  const module = await importWithChildProfileFactories(
    () => collection,
    () => reference,
    () => semanticPath,
  );
  return module;
}

async function importWithChildProfileFactories(
  collection: ChildProfileFactory,
  reference: ChildProfileFactory,
  semanticPath: ChildProfileFactory,
) {
  vi.resetModules();
  vi.doMock("./sourceCollectionProfile", () => ({
    createSourceCollectionProfile: collection,
  }));
  vi.doMock("./sourceReferenceProfile", () => ({
    createSourceReferenceProfile: reference,
  }));
  vi.doMock("./semanticPathProfile", () => ({
    createSemanticPathProfile: semanticPath,
  }));
  const module = await import("./sourceProfile");
  return module;
}

afterEach(() => {
  for (const moduleName of CHILD_MODULES) vi.doUnmock(moduleName);
  vi.resetModules();
});

describe("execution-source profile composition", () => {
  it("exports only a fresh frozen source profile factory", () => {
    expect(Object.keys(sourceProfileApi)).toEqual(["createSourceProfile"]);
    expect(createSourceProfile()).not.toBe(createSourceProfile());
    expect(Object.isFrozen(createSourceProfile())).toBe(true);
  });

  it("creates fresh C, R, and P child state for every composite", async () => {
    const calls: string[] = [];
    const createCollection = vi.fn(() =>
      createProbeProfile(`C${createCollection.mock.calls.length}`, calls),
    );
    const createReference = vi.fn(() =>
      createProbeProfile(`R${createReference.mock.calls.length}`, calls),
    );
    const createSemanticPath = vi.fn(() =>
      createProbeProfile(`P${createSemanticPath.mock.calls.length}`, calls),
    );
    const module = await importWithChildProfileFactories(
      createCollection,
      createReference,
      createSemanticPath,
    );
    const first = module.createSourceProfile();
    const second = module.createSourceProfile();
    const occurrence = createOccurrencePlanBuilder().appendRoot({
      kind: "record",
    });
    const header = Object.freeze({
      kind: "record",
      ownKeys: Object.freeze([]),
    }) satisfies ClosedContainerHeader;
    const ledger = createBudgetLedger();

    first.beforeDescriptors(occurrence, header, ledger);
    second.beforeDescriptors(occurrence, header, ledger);

    expect(createCollection).toHaveBeenCalledTimes(2);
    expect(createReference).toHaveBeenCalledTimes(2);
    expect(createSemanticPath).toHaveBeenCalledTimes(2);
    expect(calls).toEqual([
      "C1:descriptors",
      "R1:descriptors",
      "P1:descriptors",
      "C2:descriptors",
      "R2:descriptors",
      "P2:descriptors",
    ]);
  });

  it("charges each child counter exactly once through one source profile", () => {
    const exactBudget = {
      maximumFacts: 1,
      maximumReferences: 1,
      maximumSemanticPathSegments: 1,
    } as const satisfies ExecutionContractBudget;

    expect(() => createPlan(createSource(), exactBudget)).not.toThrow();
    expectBudgetFailure(
      () => createPlan(createSource(), { ...exactBudget, maximumFacts: 0 }),
      "maximumFacts",
      ["facts"],
    );
    expectBudgetFailure(
      () =>
        createPlan(createSource(), { ...exactBudget, maximumReferences: 0 }),
      "maximumReferences",
      ["facts", 0, "hostProfileIds"],
    );
    expectBudgetFailure(
      () =>
        createPlan(createSource(), {
          ...exactBudget,
          maximumSemanticPathSegments: 0,
        }),
      "maximumSemanticPathSegments",
      ["facts", 0, "subject", "path"],
    );
  });

  it("forwards identical phase arguments exactly once in C, R, P order", async () => {
    const calls: string[] = [];
    const collection = createProbeProfile("C", calls);
    const reference = createProbeProfile("R", calls);
    const semanticPath = createProbeProfile("P", calls);
    const module = await importWithChildProfiles(
      collection,
      reference,
      semanticPath,
    );
    const profile = module.createSourceProfile();
    const occurrence = createOccurrencePlanBuilder().appendRoot({
      kind: "record",
    });
    const header = Object.freeze({
      kind: "record",
      ownKeys: Object.freeze([]),
    }) satisfies ClosedContainerHeader;
    const view = Object.freeze({
      kind: "record",
      entries: Object.freeze([]),
    }) satisfies ClosedContainerView;
    const ledger = createBudgetLedger();
    const chargeTotal = vi.spyOn(ledger, "chargeTotal");
    const observePeak = vi.spyOn(ledger, "observePeak");
    const descriptorArguments: unknown[][] = [];
    const childArguments: unknown[][] = [];

    for (const child of [collection, reference, semanticPath]) {
      child.beforeDescriptors = (childOccurrence, childHeader, childLedger) => {
        descriptorArguments.push([childOccurrence, childHeader, childLedger]);
        calls.push(
          child === collection
            ? "C:descriptors"
            : child === reference
              ? "R:descriptors"
              : "P:descriptors",
        );
      };
      child.beforeChildren = (childOccurrence, childView, childLedger) => {
        childArguments.push([childOccurrence, childView, childLedger]);
        calls.push(
          child === collection
            ? "C:children"
            : child === reference
              ? "R:children"
              : "P:children",
        );
      };
    }

    profile.beforeDescriptors(occurrence, header, ledger);
    profile.beforeChildren(occurrence, view, ledger);

    expect(calls).toEqual([
      "C:descriptors",
      "R:descriptors",
      "P:descriptors",
      "C:children",
      "R:children",
      "P:children",
    ]);
    for (const [
      childOccurrence,
      childHeader,
      childLedger,
    ] of descriptorArguments) {
      expect(childOccurrence).toBe(occurrence);
      expect(childHeader).toBe(header);
      expect(childLedger).toBe(ledger);
    }
    for (const [childOccurrence, childView, childLedger] of childArguments) {
      expect(childOccurrence).toBe(occurrence);
      expect(childView).toBe(view);
      expect(childLedger).toBe(ledger);
    }
    expect(chargeTotal).not.toHaveBeenCalled();
    expect(observePeak).not.toHaveBeenCalled();
  });

  it("short-circuits each phase without translating the first error", async () => {
    const descriptorError = new ExecutionContractError(
      "budget-exceeded",
      ["facts"],
      "descriptor failure",
    );
    const childError = new ExecutionContractError(
      "budget-exceeded",
      ["facts", 0, "schemaId"],
      "child failure",
    );
    const calls: string[] = [];
    const collection = createProbeProfile("C", calls);
    const reference = createProbeProfile("R", calls);
    const semanticPath = createProbeProfile("P", calls);
    collection.beforeDescriptors = () => {
      calls.push("C:descriptors");
      throw descriptorError;
    };
    collection.beforeChildren = () => {
      calls.push("C:children");
    };
    reference.beforeChildren = () => {
      calls.push("R:children");
      throw childError;
    };
    const module = await importWithChildProfiles(
      collection,
      reference,
      semanticPath,
    );
    const profile = module.createSourceProfile();
    const occurrence = createOccurrencePlanBuilder().appendRoot({
      kind: "record",
    });
    const header = Object.freeze({
      kind: "record",
      ownKeys: Object.freeze([]),
    }) satisfies ClosedContainerHeader;
    const view = Object.freeze({
      kind: "record",
      entries: Object.freeze([]),
    }) satisfies ClosedContainerView;
    const ledger = createBudgetLedger();

    expect(
      captureThrown(() =>
        profile.beforeDescriptors(occurrence, header, ledger),
      ),
    ).toBe(descriptorError);
    expect(calls).toEqual(["C:descriptors"]);

    calls.length = 0;
    expect(
      captureThrown(() => profile.beforeChildren(occurrence, view, ledger)),
    ).toBe(childError);
    expect(calls).toEqual(["C:children", "R:children"]);
    expect(descriptorError.path).toEqual(["facts"]);
    expect(childError.path).toEqual(["facts", 0, "schemaId"]);
  });

  it("leaves deeply frozen caller data unchanged on success and failure", () => {
    const source = createSource();
    Object.freeze(source.facts[0].hostProfileIds);
    Object.freeze(source.facts[0].subject.path[0]);
    Object.freeze(source.facts[0].subject.path);
    Object.freeze(source.facts[0].subject);
    Object.freeze(source.facts[0]);
    Object.freeze(source.facts);
    Object.freeze(source.relations);
    Object.freeze(source.exports);
    for (const collection of Object.values(source.registries)) {
      Object.freeze(collection);
    }
    Object.freeze(source.registries);
    Object.freeze(source.hostAssumptionFactIds);
    Object.freeze(source);

    expect(() =>
      createPlan(source, {
        maximumFacts: 1,
        maximumReferences: 1,
        maximumSemanticPathSegments: 1,
      }),
    ).not.toThrow();
    const error = expectBudgetFailure(
      () => createPlan(source, { maximumSemanticPathSegments: 0 }),
      "maximumSemanticPathSegments",
      ["facts", 0, "subject", "path"],
    );

    expect(Object.isFrozen(source)).toBe(true);
    expect(Object.isFrozen(source.facts[0].subject.path)).toBe(true);
    expect(Object.isFrozen(error.path)).toBe(true);
  });

  it("keeps the type fixture runtime-empty and the factory internal", () => {
    const fixture = readFileSync(
      new URL("./sourceProfile.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(fixture, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ESNext,
      },
    }).outputText;
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    const facadeSource = readFileSync(
      new URL("./implementation.ts", import.meta.url),
      "utf8",
    );

    expect(output.trim()).toBe("export {};");
    expect(rootSource).not.toContain("sourceProfile");
    expect(facadeSource).not.toContain("sourceProfile");
  });
});
