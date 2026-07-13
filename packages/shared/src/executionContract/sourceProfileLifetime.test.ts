import { runInNewContext } from "node:vm";
import { setFlagsFromString } from "node:v8";

import { afterEach, describe, expect, it, vi } from "vitest";

import { createBudgetLedger } from "./budget";
import type { ClosedDataProfile } from "./closedDataWalker";
import type {
  ClosedContainerHeader,
  ClosedContainerView,
} from "./closedDescriptor";
import { ExecutionContractError } from "./implementation";
import { createOccurrencePlanBuilder } from "./occurrencePlan";

const CHILD_MODULES = [
  "./sourceCollectionProfile",
  "./sourceReferenceProfile",
  "./semanticPathProfile",
] as const;

interface HookInvocation {
  readonly failure: unknown;
  readonly profile: ClosedDataProfile;
  readonly references: readonly WeakRef<object>[];
}

function invokeAndRetainProfile(profile: ClosedDataProfile): HookInvocation {
  const occurrence = createOccurrencePlanBuilder().appendRoot({
    kind: "record",
  });
  const header = Object.freeze({
    kind: "record",
    ownKeys: Object.freeze(["value"]),
  }) satisfies ClosedContainerHeader;
  const callerValue = Object.freeze({ value: true });
  const entry = Object.freeze(["value", callerValue] as const);
  const view = Object.freeze({
    kind: "record",
    entries: Object.freeze([entry]),
  }) satisfies ClosedContainerView;
  const ledger = createBudgetLedger();
  const references = [
    new WeakRef(occurrence),
    new WeakRef(header),
    new WeakRef(view),
    new WeakRef(callerValue),
    new WeakRef(ledger),
  ];

  profile.beforeDescriptors(occurrence, header, ledger);
  let failure: unknown;
  try {
    profile.beforeChildren(occurrence, view, ledger);
  } catch (error) {
    failure = error;
  }
  return { failure, profile, references };
}

function isGarbageCollectorExposed(): boolean {
  return runInNewContext("typeof gc") === "function";
}

function createGarbageCollector(): () => void {
  setFlagsFromString("--expose_gc");
  try {
    const collector: unknown = runInNewContext("gc");
    if (typeof collector !== "function") {
      throw new TypeError("Expected an exposed garbage collector");
    }
    return () => {
      Reflect.apply(collector, undefined, []);
    };
  } finally {
    setFlagsFromString("--no-expose_gc");
  }
}

async function runGarbageCollection(
  collector: () => void,
  remainingCycles: number,
): Promise<void> {
  if (remainingCycles === 0) return;
  await new Promise<void>((resolve) => setImmediate(resolve));
  collector();
  await runGarbageCollection(collector, remainingCycles - 1);
}

function createNoopProfile(): ClosedDataProfile {
  return {
    beforeChildren() {},
    beforeDescriptors() {},
  };
}

async function importFailingSourceProfile(failure: ExecutionContractError) {
  vi.resetModules();
  vi.doMock("./sourceCollectionProfile", () => ({
    createSourceCollectionProfile: createNoopProfile,
  }));
  vi.doMock("./sourceReferenceProfile", () => ({
    createSourceReferenceProfile: createNoopProfile,
  }));
  vi.doMock("./semanticPathProfile", () => ({
    createSemanticPathProfile: () => ({
      beforeChildren() {
        throw failure;
      },
      beforeDescriptors() {},
    }),
  }));
  const module = await import("./sourceProfile");
  return module;
}

function createRetainingProfile(): {
  readonly profile: ClosedDataProfile;
  readonly release: () => void;
} {
  let retained: object[] = [];
  const profile: ClosedDataProfile = {
    beforeChildren(occurrence, view, ledger) {
      retained[retained.length] = occurrence;
      retained[retained.length] = view;
      retained[retained.length] = ledger;
    },
    beforeDescriptors(occurrence, header, ledger) {
      retained[retained.length] = occurrence;
      retained[retained.length] = header;
      retained[retained.length] = ledger;
    },
  };
  return {
    profile: Object.freeze(profile),
    release() {
      retained = [];
    },
  };
}

afterEach(() => {
  setFlagsFromString("--no-expose_gc");
  for (const moduleName of CHILD_MODULES) vi.doUnmock(moduleName);
  vi.resetModules();
});

describe("execution-source profile post-call lifetime", () => {
  it("releases hook arguments while success and failure profiles stay live", async () => {
    expect(isGarbageCollectorExposed()).toBe(false);
    const collector = createGarbageCollector();
    expect(isGarbageCollectorExposed()).toBe(false);

    vi.resetModules();
    const successModule = await import("./sourceProfile");
    const success = invokeAndRetainProfile(successModule.createSourceProfile());
    const failure = new ExecutionContractError(
      "budget-exceeded",
      ["facts"],
      "child failure",
    );
    const failureModule = await importFailingSourceProfile(failure);
    const failed = invokeAndRetainProfile(failureModule.createSourceProfile());
    const retaining = createRetainingProfile();
    const negativeControl = invokeAndRetainProfile(retaining.profile);

    expect(success.failure).toBeUndefined();
    expect(failed.failure).toBe(failure);
    expect(negativeControl.failure).toBeUndefined();

    await runGarbageCollection(collector, 8);

    expect(
      success.references.every((reference) => reference.deref() === undefined),
    ).toBe(true);
    expect(
      failed.references.every((reference) => reference.deref() === undefined),
    ).toBe(true);
    expect(
      negativeControl.references.some(
        (reference) => reference.deref() !== undefined,
      ),
    ).toBe(true);
    expect(Object.isFrozen(success.profile)).toBe(true);
    expect(Object.isFrozen(failed.profile)).toBe(true);
    expect(negativeControl.profile).toBe(retaining.profile);
    expect(isGarbageCollectorExposed()).toBe(false);

    retaining.release();
  });
});
