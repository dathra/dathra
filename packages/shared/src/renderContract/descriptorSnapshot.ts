import { RenderDefinitionError, type RenderDefinitionErrorCode } from "./error";

type SnapshotPath = readonly string[];

/** A schema record occurrence recognized by the render-definition traversal. */
type RenderDefinitionDescriptorRecordKind =
  | "creator-input"
  | "wrapper"
  | "preimage"
  | "observation-claim"
  | "response-claim"
  | "body-claim"
  | "exposure-claim";

/** A sanitized expected-field value captured from an own data descriptor. */
type RenderDefinitionDescriptorFieldSnapshot =
  | { readonly key: string; readonly state: "missing" }
  | {
      readonly key: string;
      readonly state: "string";
      readonly value: string;
    }
  | { readonly key: string; readonly state: "non-string" }
  | { readonly key: string; readonly state: "object" };

/** An immutable schema-path view of one captured record occurrence. */
interface RenderDefinitionDescriptorOccurrence {
  readonly kind: RenderDefinitionDescriptorRecordKind;
  readonly path: readonly string[];
  readonly ownKeys: readonly string[];
  readonly fields: readonly RenderDefinitionDescriptorFieldSnapshot[];
}

/** An immutable descriptor projection consumed by later scalar validation. */
interface RenderDefinitionDescriptorSnapshot {
  readonly occurrences: readonly RenderDefinitionDescriptorOccurrence[];
}

interface NestedFieldRule {
  readonly key: string;
  readonly kind: RenderDefinitionDescriptorRecordKind;
}

interface DescriptorRecordRule {
  readonly expectedKeys: readonly string[];
  readonly nestedFields: readonly NestedFieldRule[];
}

interface RawDescriptorSnapshot {
  readonly keys: readonly (string | symbol)[];
  readonly descriptors: ReadonlyMap<string | symbol, PropertyDescriptor>;
}

interface RawDescriptorOccurrence {
  readonly kind: RenderDefinitionDescriptorRecordKind;
  readonly path: SnapshotPath;
  readonly snapshot: RawDescriptorSnapshot;
  readonly ownKeys: readonly string[];
}

const MAXIMUM_OWN_KEYS_PER_RECORD = 16;
const MAXIMUM_PROPERTY_KEY_CODE_UNITS = 128;

const DESCRIPTOR_RULES = {
  "creator-input": {
    expectedKeys: [
      "observationContractId",
      "responseContributionSetId",
      "orderedBodyPlanId",
      "exposureContractId",
    ],
    nestedFields: [],
  },
  wrapper: {
    expectedKeys: ["id", "preimage"],
    nestedFields: [{ key: "preimage", kind: "preimage" }],
  },
  preimage: {
    expectedKeys: [
      "schema",
      "observationContract",
      "responseContributions",
      "orderedBodyPlan",
      "exposure",
    ],
    nestedFields: [
      { key: "observationContract", kind: "observation-claim" },
      { key: "responseContributions", kind: "response-claim" },
      { key: "orderedBodyPlan", kind: "body-claim" },
      { key: "exposure", kind: "exposure-claim" },
    ],
  },
  "observation-claim": {
    expectedKeys: ["schema", "role", "claimedId"],
    nestedFields: [],
  },
  "response-claim": {
    expectedKeys: ["schema", "role", "claimedId"],
    nestedFields: [],
  },
  "body-claim": {
    expectedKeys: ["schema", "role", "claimedId"],
    nestedFields: [],
  },
  "exposure-claim": {
    expectedKeys: ["schema", "role", "claimedId"],
    nestedFields: [],
  },
} satisfies Record<RenderDefinitionDescriptorRecordKind, DescriptorRecordRule>;

function fail(
  code: RenderDefinitionErrorCode,
  path: SnapshotPath,
  detail: string,
): never {
  throw new RenderDefinitionError(code, path, `[dathra] ${detail}`);
}

function requireOrdinaryRecord(value: unknown, path: SnapshotPath): object {
  if (typeof value !== "object" || value === null) {
    fail("invalid-closed-record", path, "Expected an ordinary plain record");
  }

  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(
      "invalid-closed-record",
      path,
      "Expected the current-realm Object prototype or null",
    );
  }
  return value;
}

function captureRawDescriptorSnapshot(
  value: object,
  path: SnapshotPath,
  cache: WeakMap<object, RawDescriptorSnapshot>,
): RawDescriptorSnapshot {
  const cached = cache.get(value);
  if (cached !== undefined) {
    return cached;
  }

  const keys = Reflect.ownKeys(value);
  if (keys.length > MAXIMUM_OWN_KEYS_PER_RECORD) {
    fail(
      "budget-exceeded",
      path,
      `Record exceeds the ${MAXIMUM_OWN_KEYS_PER_RECORD} own-key limit`,
    );
  }
  for (const key of keys) {
    if (
      typeof key === "string" &&
      key.length > MAXIMUM_PROPERTY_KEY_CODE_UNITS
    ) {
      fail(
        "budget-exceeded",
        path,
        `Property key exceeds ${MAXIMUM_PROPERTY_KEY_CODE_UNITS} code units`,
      );
    }
  }

  const descriptors = new Map<string | symbol, PropertyDescriptor>();
  for (const key of keys) {
    const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
    if (descriptor === undefined) {
      fail(
        "invalid-closed-record",
        path,
        "Own key did not have a stable property descriptor",
      );
    }
    descriptors.set(key, Object.freeze(descriptor));
  }

  const snapshot: RawDescriptorSnapshot = Object.freeze({
    keys: Object.freeze(keys),
    descriptors,
  });
  cache.set(value, snapshot);
  return snapshot;
}

function validateDescriptorStructure(
  snapshot: RawDescriptorSnapshot,
  path: SnapshotPath,
): readonly string[] {
  const ownKeys: string[] = [];
  for (const key of snapshot.keys) {
    const descriptor = snapshot.descriptors.get(key);
    if (
      typeof key === "symbol" ||
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !("value" in descriptor)
    ) {
      fail(
        "invalid-closed-record",
        path,
        "Record properties must be enumerable string-keyed data properties",
      );
    }
    ownKeys.push(key);
  }
  return Object.freeze(ownKeys);
}

function collectRawOccurrences(
  value: unknown,
  rootKind: RenderDefinitionDescriptorRecordKind,
): readonly RawDescriptorOccurrence[] {
  const cache = new WeakMap<object, RawDescriptorSnapshot>();
  const occurrences: RawDescriptorOccurrence[] = [];

  function visit(
    candidate: unknown,
    kind: RenderDefinitionDescriptorRecordKind,
    path: SnapshotPath,
  ): void {
    const record = requireOrdinaryRecord(candidate, path);
    const snapshot = captureRawDescriptorSnapshot(record, path, cache);
    const ownKeys = validateDescriptorStructure(snapshot, path);
    occurrences.push({ kind, path, snapshot, ownKeys });

    for (const nestedField of DESCRIPTOR_RULES[kind].nestedFields) {
      const descriptor = snapshot.descriptors.get(nestedField.key);
      if (descriptor !== undefined && "value" in descriptor) {
        const nestedValue: unknown = descriptor.value;
        if (typeof nestedValue === "object" && nestedValue !== null) {
          visit(nestedValue, nestedField.kind, [...path, nestedField.key]);
        }
      }
    }
  }

  visit(value, rootKind, []);
  return occurrences;
}

function projectField(
  snapshot: RawDescriptorSnapshot,
  key: string,
): RenderDefinitionDescriptorFieldSnapshot {
  const descriptor = snapshot.descriptors.get(key);
  if (descriptor === undefined || !("value" in descriptor)) {
    return Object.freeze({ key, state: "missing" });
  }

  const value: unknown = descriptor.value;
  if (typeof value === "string") {
    return Object.freeze({ key, state: "string", value });
  }
  if (typeof value === "object" && value !== null) {
    return Object.freeze({ key, state: "object" });
  }
  return Object.freeze({ key, state: "non-string" });
}

function projectOccurrence(
  occurrence: RawDescriptorOccurrence,
): RenderDefinitionDescriptorOccurrence {
  const fields = DESCRIPTOR_RULES[occurrence.kind].expectedKeys.map((key) =>
    projectField(occurrence.snapshot, key),
  );
  return Object.freeze({
    kind: occurrence.kind,
    path: Object.freeze([...occurrence.path]),
    ownKeys: occurrence.ownKeys,
    fields: Object.freeze(fields),
  });
}

function projectSnapshot(
  occurrences: readonly RawDescriptorOccurrence[],
): RenderDefinitionDescriptorSnapshot {
  return Object.freeze({
    occurrences: Object.freeze(occurrences.map(projectOccurrence)),
  });
}

/** Captures the creator-input descriptor occurrence without scalar validation. */
function snapshotRenderDefinitionCreatorDescriptors(
  value: unknown,
): RenderDefinitionDescriptorSnapshot {
  return projectSnapshot(collectRawOccurrences(value, "creator-input"));
}

/** Captures parser descriptor occurrences without scalar validation. */
function snapshotRenderDefinitionParserDescriptors(
  value: unknown,
): RenderDefinitionDescriptorSnapshot {
  return projectSnapshot(collectRawOccurrences(value, "wrapper"));
}

export {
  snapshotRenderDefinitionCreatorDescriptors,
  snapshotRenderDefinitionParserDescriptors,
};
export type {
  RenderDefinitionDescriptorFieldSnapshot,
  RenderDefinitionDescriptorOccurrence,
  RenderDefinitionDescriptorRecordKind,
  RenderDefinitionDescriptorSnapshot,
};
