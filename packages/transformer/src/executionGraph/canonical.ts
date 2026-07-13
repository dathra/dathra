import {
  CanonicalIdentityError,
  canonicalizeJson,
  digestCanonicalJson,
  isSha256Digest,
  parseObservationContract,
  type ObservationContract,
  type Sha256Digest,
} from "@dathra/shared";

import {
  parseModuleGraphSnapshot,
  type CanonicalModuleUrl,
  type ModuleContentDigest,
  type ModuleDefinitionId,
  type ModuleGraphSnapshot,
  type ModuleResolutionDomainId,
  type ModuleSemanticProfileId,
  type RuntimeModuleBindingId,
} from "../moduleGraph/implementation";
import {
  BudgetLedger,
  resolveBudget,
  type ExecutionGraphBudget,
} from "./budget";
import {
  EDGE_KINDS,
  EPOCH_KINDS,
  ExecutionGraphError,
  OCCURRENCE_SLOTS,
  OPERATION_KINDS,
  ROOT_ADMISSIONS,
  ROOT_KINDS,
  ROOT_PHASES,
  SEMANTIC_ROLES,
  deepFreeze,
  fail,
  isDataRecord,
  type DataRecord,
  type ExecutionAnalysisProfile,
  type ExecutionAnalysisProfileId,
  type ExecutionAnalysisProfileInput,
  type ExecutionAnalysisProfilePreimage,
  type ExecutionEdge,
  type ExecutionEdgeId,
  type ExecutionEdgeInput,
  type ExecutionEdgePreimage,
  type ExecutionGenerationDomain,
  type ExecutionGenerationDomainId,
  type ExecutionGenerationDomainInput,
  type ExecutionGenerationDomainPreimage,
  type ExecutionGraphDependencies,
  type ExecutionIdentityRecord,
  type ExecutionLocationRequirement,
  type ExecutionLocationRequirementId,
  type ExecutionLocationRequirementInput,
  type ExecutionLocationRequirementPreimage,
  type ExecutionRootDefinition,
  type ExecutionRootDefinitionId,
  type ExecutionRootDefinitionInput,
  type ExecutionRootDefinitionPreimage,
  type ExecutionRootObligation,
  type ExecutionRootObligationInput,
  type ExecutionRootObligationPreimage,
  type ExecutionTemplateNode,
  type ExecutionTemplateNodeId,
  type ExecutionTemplateNodeInput,
  type ExecutionTemplateNodePreimage,
  type GeneratedTemplateInputBinding,
  type QualifiedExecutionBinding,
  type QualifiedExecutionNode,
  type QualifiedExecutionNodeId,
  type QualifiedExecutionNodeInput,
  type QualifiedExecutionNodePreimage,
  type ReactiveSupportTemplate,
  type ReactiveSupportTemplateInput,
  type ReactiveSupportTemplatePreimage,
  type RegistrationSupportTemplate,
  type RegistrationSupportTemplateInput,
  type RegistrationSupportTemplatePreimage,
  type StaticExecutionOccurrenceTemplate,
  type StaticExecutionOccurrenceTemplateId,
  type StaticExecutionOccurrenceTemplateInput,
  type StaticExecutionOccurrenceTemplatePreimage,
  type ValidationPath,
} from "./model";

interface PreflightState {
  readonly seen: WeakSet<object>;
}

function canonicalScalarByteLength(
  value: null | boolean | number | string,
): number {
  if (value === null) return 4;
  if (typeof value === "boolean") return value ? 4 : 5;
  if (typeof value === "string") {
    let bytes = 2;
    for (let index = 0; index < value.length; index += 1) {
      const codeUnit = value.charCodeAt(index);
      if (codeUnit === 0x22 || codeUnit === 0x5c) {
        bytes += 2;
      } else if (codeUnit <= 0x1f) {
        bytes +=
          codeUnit === 0x08 ||
          codeUnit === 0x09 ||
          codeUnit === 0x0a ||
          codeUnit === 0x0c ||
          codeUnit === 0x0d
            ? 2
            : 6;
      } else if (codeUnit <= 0x7f) {
        bytes += 1;
      } else if (codeUnit <= 0x7ff) {
        bytes += 2;
      } else if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
        const next = value.charCodeAt(index + 1);
        if (next >= 0xdc00 && next <= 0xdfff) {
          bytes += 4;
          index += 1;
        } else {
          bytes += 6;
        }
      } else if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
        bytes += 6;
      } else {
        bytes += 3;
      }
    }
    return bytes;
  }
  const text = JSON.stringify(value);
  if (typeof text !== "string") {
    fail("invalid-closed-record", [], "Value is not canonical JSON");
  }
  return text.length;
}

function chargeCanonicalBytes(
  value: unknown,
  path: ValidationPath,
  ledger: BudgetLedger,
): void {
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number" ||
    typeof value === "string"
  ) {
    ledger.charge(
      "maximumCanonicalBytes",
      canonicalScalarByteLength(value),
      path,
      "Canonical byte budget exceeded",
    );
    return;
  }
  if (typeof value !== "object") {
    fail("invalid-closed-record", path, "Expected JSON data");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const entries = Array.isArray(value)
    ? Array.from(
        { length: value.length },
        (_, index) => [String(index), descriptors[String(index)]] as const,
      )
    : Object.entries(descriptors);
  ledger.charge(
    "maximumCanonicalBytes",
    2 + Math.max(0, entries.length - 1),
    path,
    "Canonical byte budget exceeded",
  );
  for (const [key, descriptor] of entries) {
    if (!Object.hasOwn(descriptors, key) || !("value" in descriptor)) {
      fail("invalid-closed-record", [...path, key], "Missing data property");
    }
    if (!Array.isArray(value)) {
      ledger.charge(
        "maximumCanonicalBytes",
        canonicalScalarByteLength(key) + 1,
        [...path, key],
        "Canonical byte budget exceeded",
      );
    }
    chargeCanonicalBytes(descriptor.value, [...path, key], ledger);
  }
}

function preflightClosedValue(
  value: unknown,
  path: ValidationPath,
  depth: number,
  ledger: BudgetLedger,
  state: PreflightState,
): void {
  ledger.assertWithin(
    "maximumInputDepth",
    depth,
    path,
    "Input depth budget exceeded",
  );
  if (typeof value === "string") {
    ledger.charge(
      "maximumInputStringCodeUnits",
      value.length,
      path,
      "Input string budget exceeded",
    );
    ledger.charge(
      "maximumCanonicalBytes",
      canonicalScalarByteLength(value),
      path,
      "Canonical byte budget exceeded",
    );
    return;
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    ledger.charge(
      "maximumCanonicalBytes",
      canonicalScalarByteLength(value),
      path,
      "Canonical byte budget exceeded",
    );
    return;
  }
  if (typeof value !== "object") {
    fail("invalid-closed-record", path, "Expected JSON data");
  }
  if (state.seen.has(value)) {
    fail("invalid-closed-record", path, "Cyclic input is not supported");
  }
  state.seen.add(value);
  ledger.charge(
    "maximumInputDataNodes",
    1,
    path,
    "Input data-node budget exceeded",
  );

  const prototype = Reflect.getPrototypeOf(value);
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const symbols = Object.getOwnPropertySymbols(value);
  if (symbols.length > 0) {
    fail("invalid-closed-record", path, "Symbol properties are not supported");
  }
  if (Array.isArray(value)) {
    if (prototype !== Array.prototype) {
      fail("invalid-closed-record", path, "Expected a plain array");
    }
    ledger.assertWithin(
      "maximumInputArrayLength",
      value.length,
      path,
      "Input array budget exceeded",
    );
    ledger.charge(
      "maximumCanonicalBytes",
      2 + Math.max(0, value.length - 1),
      path,
      "Canonical byte budget exceeded",
    );
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        fail(
          "invalid-closed-record",
          [...path, index],
          "Array entries must be enumerable data properties",
        );
      }
      ledger.charge(
        "maximumInputProperties",
        1,
        [...path, index],
        "Input property budget exceeded",
      );
      preflightClosedValue(
        descriptor.value,
        [...path, index],
        depth + 1,
        ledger,
        state,
      );
    }
    if (
      Object.keys(descriptors).some(
        (key) => key !== "length" && !/^\d+$/.test(key),
      )
    ) {
      fail("invalid-closed-record", path, "Array has named properties");
    }
  } else {
    if (prototype !== Object.prototype && prototype !== null) {
      fail("invalid-closed-record", path, "Expected a plain record");
    }
    const entries = Object.entries(descriptors);
    ledger.charge(
      "maximumCanonicalBytes",
      2 + Math.max(0, entries.length - 1),
      path,
      "Canonical byte budget exceeded",
    );
    for (const [key, descriptor] of entries) {
      if (!("value" in descriptor) || descriptor.enumerable !== true) {
        fail(
          "invalid-closed-record",
          [...path, key],
          "Record fields must be enumerable data properties",
        );
      }
      ledger.charge(
        "maximumInputProperties",
        1,
        [...path, key],
        "Input property budget exceeded",
      );
      ledger.charge(
        "maximumInputStringCodeUnits",
        key.length,
        [...path, key],
        "Input string budget exceeded",
      );
      ledger.charge(
        "maximumCanonicalBytes",
        canonicalScalarByteLength(key) + 1,
        [...path, key],
        "Canonical byte budget exceeded",
      );
      preflightClosedValue(
        descriptor.value,
        [...path, key],
        depth + 1,
        ledger,
        state,
      );
    }
  }
  state.seen.delete(value);
}

function snapshotClosed(
  value: unknown,
  path: ValidationPath,
  ledger: BudgetLedger,
): unknown {
  preflightClosedValue(value, path, 0, ledger, { seen: new WeakSet() });
  try {
    const text = canonicalizeJson(value).text;
    const snapshot: unknown = JSON.parse(text);
    deepFreeze(snapshot);
    return snapshot;
  } catch (error) {
    if (error instanceof ExecutionGraphError) throw error;
    if (error instanceof CanonicalIdentityError) {
      fail("invalid-closed-record", [...path, ...error.path], error.message);
    }
    throw error;
  }
}

function expectRecord(
  value: unknown,
  path: ValidationPath,
  fields: readonly string[],
): DataRecord {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  const expected = new Set(fields);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      fail("invalid-field", [...path, key], "Unexpected field");
    }
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      fail("invalid-field", [...path, field], "Missing field");
    }
  }
  return value;
}

function expectArray(value: unknown, path: ValidationPath): readonly unknown[] {
  if (!Array.isArray(value)) fail("invalid-field", path, "Expected an array");
  return value;
}

function expectString(value: unknown, path: ValidationPath): string {
  if (typeof value !== "string")
    fail("invalid-field", path, "Expected a string");
  return value;
}

function expectNonEmptyString(value: unknown, path: ValidationPath): string {
  const result = expectString(value, path);
  if (result.length === 0) {
    fail("invalid-field", path, "Expected a non-empty string");
  }
  return result;
}

function expectBoolean(value: unknown, path: ValidationPath): boolean {
  if (typeof value !== "boolean") {
    fail("invalid-field", path, "Expected a boolean");
  }
  return value;
}

function expectDigest(value: unknown, path: ValidationPath): Sha256Digest {
  if (!isSha256Digest(value)) {
    fail("invalid-field", path, "Expected a canonical SHA-256 digest");
  }
  return value;
}

function expectOrdinal(value: unknown, path: ValidationPath): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("invalid-field", path, "Expected a non-negative safe integer");
  }
  return value;
}

function expectLiteral<const Value extends string>(
  value: unknown,
  expected: Value,
  path: ValidationPath,
): Value {
  if (value !== expected) {
    fail("invalid-field", path, `Expected ${expected}`);
  }
  return expected;
}

function expectOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: ValidationPath,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    fail("invalid-field", path, `Expected one of ${values.join(", ")}`);
  }
  return value;
}

function expectNullableDigest(
  value: unknown,
  path: ValidationPath,
): Sha256Digest | null {
  return value === null ? null : expectDigest(value, path);
}

function parseCanonicalUrl(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): CanonicalModuleUrl {
  const input = expectString(value, path);
  let canonical: string;
  try {
    canonicalizeJson(input);
    canonical = new URL(input).href;
  } catch {
    fail("invalid-field", path, "Expected an absolute canonical URL");
  }
  if (!normalize && canonical !== input) {
    fail("invalid-field", path, "URL is not canonical");
  }
  return canonical as CanonicalModuleUrl;
}

function parseStringSet(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): readonly string[] {
  const input = expectArray(value, path);
  ledger.charge(
    "maximumValidationSteps",
    input.length,
    path,
    "Validation-step budget exceeded",
  );
  const values = input.map((item, index) =>
    expectNonEmptyString(item, [...path, index]),
  );
  return canonicalSet(values, path, normalize, ledger);
}

function parseDigestSet<Id extends Sha256Digest>(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): readonly Id[] {
  const input = expectArray(value, path);
  ledger.charge(
    "maximumValidationSteps",
    input.length,
    path,
    "Validation-step budget exceeded",
  );
  const values = input.map(
    (item, index) => expectDigest(item, [...path, index]) as Id,
  );
  return canonicalSet(values, path, normalize, ledger);
}

function parseEnumSet<const Values extends readonly string[]>(
  value: unknown,
  allowed: Values,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): readonly Values[number][] {
  const input = expectArray(value, path);
  ledger.charge(
    "maximumValidationSteps",
    input.length,
    path,
    "Validation-step budget exceeded",
  );
  const values = input.map((item, index) =>
    expectOneOf(item, allowed, [...path, index]),
  );
  return canonicalSet(values, path, normalize, ledger);
}

function canonicalSet<Value extends string>(
  values: readonly Value[],
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): readonly Value[] {
  ledger.charge(
    "maximumValidationSteps",
    values.length,
    path,
    "Validation-step budget exceeded",
  );
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    if (seen.has(values[index])) {
      fail("duplicate-record", [...path, index], "Duplicate set member");
    }
    seen.add(values[index]);
  }
  const sorted = [...values].sort((left, right) => {
    ledger.charge(
      "maximumValidationSteps",
      1,
      path,
      "Validation-step budget exceeded",
    );
    return left < right ? -1 : left > right ? 1 : 0;
  });
  if (!normalize && sorted.some((item, index) => item !== values[index])) {
    fail("noncanonical-order", path, "Set is not code-unit sorted");
  }
  return Object.freeze(sorted);
}

async function createIdentityRecord<Id, Preimage>(
  preimage: Preimage,
  ledger: BudgetLedger,
): Promise<ExecutionIdentityRecord<Id, Preimage>> {
  chargeCanonicalBytes(preimage, ["preimage"], ledger);
  const id = (await digestCanonicalJson(preimage)) as Id;
  const result = { id, preimage };
  deepFreeze(result);
  return result;
}

async function parseIdentityRecord<Id, Preimage>(
  value: unknown,
  path: ValidationPath,
  parsePreimage: (value: unknown, path: ValidationPath) => Preimage,
  ledger: BudgetLedger,
): Promise<ExecutionIdentityRecord<Id, Preimage>> {
  ledger.charge(
    "maximumValidationSteps",
    1,
    path,
    "Validation-step budget exceeded",
  );
  const record = expectRecord(value, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  const preimage = parsePreimage(record.preimage, [...path, "preimage"]);
  chargeCanonicalBytes(preimage, [...path, "preimage"], ledger);
  if (id !== (await digestCanonicalJson(preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Record ID does not match preimage",
    );
  }
  const result = { id: id as Id, preimage };
  deepFreeze(result);
  return result;
}

function parseAnalysisProfilePreimage(
  value: unknown,
  path: ValidationPath,
): ExecutionAnalysisProfilePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "analyzerImplementationDigest",
    "analyzerVersion",
    "normalizedSyntaxSchemaId",
    "operationTaxonomySchemaId",
    "analysisConfigurationDigest",
  ]);
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.execution-analysis-profile/1",
      [...path, "schema"],
    ),
    analyzerImplementationDigest: expectDigest(
      record.analyzerImplementationDigest,
      [...path, "analyzerImplementationDigest"],
    ),
    analyzerVersion: expectNonEmptyString(record.analyzerVersion, [
      ...path,
      "analyzerVersion",
    ]),
    normalizedSyntaxSchemaId: expectNonEmptyString(
      record.normalizedSyntaxSchemaId,
      [...path, "normalizedSyntaxSchemaId"],
    ),
    operationTaxonomySchemaId: expectNonEmptyString(
      record.operationTaxonomySchemaId,
      [...path, "operationTaxonomySchemaId"],
    ),
    analysisConfigurationDigest: expectDigest(
      record.analysisConfigurationDigest,
      [...path, "analysisConfigurationDigest"],
    ),
  };
}

function parseRootDefinitionPreimage(
  value: unknown,
  path: ValidationPath,
): ExecutionRootDefinitionPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "rootKeyDigest",
    "admission",
    "kind",
    "phase",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.execution-root-definition/1", [
      ...path,
      "schema",
    ]),
    rootKeyDigest: expectDigest(record.rootKeyDigest, [
      ...path,
      "rootKeyDigest",
    ]),
    admission: expectOneOf(record.admission, ROOT_ADMISSIONS, [
      ...path,
      "admission",
    ]),
    kind: expectOneOf(record.kind, ROOT_KINDS, [...path, "kind"]),
    phase: expectOneOf(record.phase, ROOT_PHASES, [...path, "phase"]),
  };
}

function parseLocationRequirementPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): ExecutionLocationRequirementPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "hostInstanceDomainId",
    "agentClusterDomainId",
    "agentDomainId",
    "realmDomainId",
    "globalDomainId",
    "principalDomainId",
    "targetEnvironmentIds",
    "resolutionDomainIds",
  ]);
  const targetEnvironmentIds = parseStringSet(
    record.targetEnvironmentIds,
    [...path, "targetEnvironmentIds"],
    normalize,
    ledger,
  );
  if (targetEnvironmentIds.length === 0) {
    fail(
      "invalid-field",
      [...path, "targetEnvironmentIds"],
      "At least one target environment is required",
    );
  }
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.execution-location-requirement/1",
      [...path, "schema"],
    ),
    hostInstanceDomainId: expectDigest(record.hostInstanceDomainId, [
      ...path,
      "hostInstanceDomainId",
    ]),
    agentClusterDomainId: expectDigest(record.agentClusterDomainId, [
      ...path,
      "agentClusterDomainId",
    ]),
    agentDomainId: expectDigest(record.agentDomainId, [
      ...path,
      "agentDomainId",
    ]),
    realmDomainId: expectDigest(record.realmDomainId, [
      ...path,
      "realmDomainId",
    ]),
    globalDomainId: expectDigest(record.globalDomainId, [
      ...path,
      "globalDomainId",
    ]),
    principalDomainId: expectDigest(record.principalDomainId, [
      ...path,
      "principalDomainId",
    ]),
    targetEnvironmentIds,
    resolutionDomainIds: parseDigestSet<ModuleResolutionDomainId>(
      record.resolutionDomainIds,
      [...path, "resolutionDomainIds"],
      normalize,
      ledger,
    ),
  };
}

function parseOccurrenceTemplatePreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): StaticExecutionOccurrenceTemplatePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "identitySlots",
    "epochKinds",
  ]);
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.static-execution-occurrence/1",
      [...path, "schema"],
    ),
    identitySlots: parseEnumSet(
      record.identitySlots,
      OCCURRENCE_SLOTS,
      [...path, "identitySlots"],
      normalize,
      ledger,
    ),
    epochKinds: parseEnumSet(
      record.epochKinds,
      EPOCH_KINDS,
      [...path, "epochKinds"],
      normalize,
      ledger,
    ),
  };
}

function parseGeneratedTemplateInputs(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): readonly GeneratedTemplateInputBinding[] {
  const input = expectArray(value, path);
  ledger.charge(
    "maximumValidationSteps",
    input.length,
    path,
    "Validation-step budget exceeded",
  );
  const values = input.map((item, index) => {
    const itemPath = [...path, index];
    const record = expectRecord(item, itemPath, ["slot", "templateNodeId"]);
    return {
      slot: expectNonEmptyString(record.slot, [...itemPath, "slot"]),
      templateNodeId: expectDigest(record.templateNodeId, [
        ...itemPath,
        "templateNodeId",
      ]) as ExecutionTemplateNodeId,
    };
  });
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    if (seen.has(values[index].slot)) {
      fail(
        "duplicate-record",
        [...path, index, "slot"],
        "Duplicate input slot",
      );
    }
    seen.add(values[index].slot);
  }
  const sorted = [...values].sort((left, right) => {
    ledger.charge(
      "maximumValidationSteps",
      1,
      path,
      "Validation-step budget exceeded",
    );
    return left.slot < right.slot ? -1 : left.slot > right.slot ? 1 : 0;
  });
  if (
    !normalize &&
    sorted.some((item, index) => item.slot !== values[index].slot)
  ) {
    fail("noncanonical-order", path, "Generated inputs are not slot-sorted");
  }
  deepFreeze(sorted);
  return sorted;
}

function parseTemplateNodePreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): ExecutionTemplateNodePreimage {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  if (value.kind === "source") {
    const record = expectRecord(value, path, [
      "schema",
      "kind",
      "moduleDefinitionId",
      "canonicalSourceUrl",
      "transformedContentDigest",
      "semanticProfileId",
      "analysisProfileId",
      "normalizedSyntaxDigest",
      "operationKind",
      "preorderOrdinal",
    ]);
    return {
      schema: expectLiteral(record.schema, "dathra.execution-template-node/1", [
        ...path,
        "schema",
      ]),
      kind: "source",
      moduleDefinitionId: expectDigest(record.moduleDefinitionId, [
        ...path,
        "moduleDefinitionId",
      ]) as ModuleDefinitionId,
      canonicalSourceUrl: parseCanonicalUrl(
        record.canonicalSourceUrl,
        [...path, "canonicalSourceUrl"],
        normalize,
      ),
      transformedContentDigest: expectDigest(record.transformedContentDigest, [
        ...path,
        "transformedContentDigest",
      ]) as ModuleContentDigest,
      semanticProfileId: expectDigest(record.semanticProfileId, [
        ...path,
        "semanticProfileId",
      ]) as ModuleSemanticProfileId,
      analysisProfileId: expectDigest(record.analysisProfileId, [
        ...path,
        "analysisProfileId",
      ]) as ExecutionAnalysisProfileId,
      normalizedSyntaxDigest: expectDigest(record.normalizedSyntaxDigest, [
        ...path,
        "normalizedSyntaxDigest",
      ]),
      operationKind: expectOneOf(record.operationKind, OPERATION_KINDS, [
        ...path,
        "operationKind",
      ]),
      preorderOrdinal: expectOrdinal(record.preorderOrdinal, [
        ...path,
        "preorderOrdinal",
      ]),
    };
  }
  const record = expectRecord(value, path, [
    "schema",
    "kind",
    "generatorSchemaId",
    "generatorProfileDigest",
    "inputs",
    "rootDefinitionId",
    "observationContractId",
    "operationKind",
    "ordinal",
  ]);
  expectLiteral(record.kind, "generated", [...path, "kind"]);
  const rootDefinitionId = expectNullableDigest(record.rootDefinitionId, [
    ...path,
    "rootDefinitionId",
  ]) as ExecutionRootDefinitionId | null;
  const observationContractId = expectNullableDigest(
    record.observationContractId,
    [...path, "observationContractId"],
  );
  if ((rootDefinitionId === null) !== (observationContractId === null)) {
    fail(
      "invalid-field",
      path,
      "Generated root and contract must both be null or both be present",
    );
  }
  return {
    schema: expectLiteral(record.schema, "dathra.execution-template-node/1", [
      ...path,
      "schema",
    ]),
    kind: "generated",
    generatorSchemaId: expectNonEmptyString(record.generatorSchemaId, [
      ...path,
      "generatorSchemaId",
    ]),
    generatorProfileDigest: expectDigest(record.generatorProfileDigest, [
      ...path,
      "generatorProfileDigest",
    ]),
    inputs: parseGeneratedTemplateInputs(
      record.inputs,
      [...path, "inputs"],
      normalize,
      ledger,
    ),
    rootDefinitionId,
    observationContractId,
    operationKind: expectOneOf(record.operationKind, OPERATION_KINDS, [
      ...path,
      "operationKind",
    ]),
    ordinal: expectOrdinal(record.ordinal, [...path, "ordinal"]),
  };
}

function parseGenerationDomainPreimage(
  value: unknown,
  path: ValidationPath,
): ExecutionGenerationDomainPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "locationRequirementId",
    "targetEnvironmentId",
    "resolutionDomainId",
    "generatorProfileDigest",
  ]);
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.execution-generation-domain/1",
      [...path, "schema"],
    ),
    locationRequirementId: expectDigest(record.locationRequirementId, [
      ...path,
      "locationRequirementId",
    ]) as ExecutionLocationRequirementId,
    targetEnvironmentId: expectNonEmptyString(record.targetEnvironmentId, [
      ...path,
      "targetEnvironmentId",
    ]),
    resolutionDomainId: expectNullableDigest(record.resolutionDomainId, [
      ...path,
      "resolutionDomainId",
    ]) as ModuleResolutionDomainId | null,
    generatorProfileDigest: expectDigest(record.generatorProfileDigest, [
      ...path,
      "generatorProfileDigest",
    ]),
  };
}

function parseQualifiedBinding(
  value: unknown,
  path: ValidationPath,
): QualifiedExecutionBinding {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  if (value.kind === "module") {
    const record = expectRecord(value, path, ["kind", "runtimeBindingId"]);
    return {
      kind: "module",
      runtimeBindingId: expectDigest(record.runtimeBindingId, [
        ...path,
        "runtimeBindingId",
      ]) as RuntimeModuleBindingId,
    };
  }
  const record = expectRecord(value, path, ["kind", "generationDomainId"]);
  expectLiteral(record.kind, "generated", [...path, "kind"]);
  return {
    kind: "generated",
    generationDomainId: expectDigest(record.generationDomainId, [
      ...path,
      "generationDomainId",
    ]) as ExecutionGenerationDomainId,
  };
}

function parseQualifiedNodePreimage(
  value: unknown,
  path: ValidationPath,
): QualifiedExecutionNodePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "templateNodeId",
    "locationRequirementId",
    "occurrenceTemplateId",
    "semanticRole",
    "binding",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.qualified-execution-node/1", [
      ...path,
      "schema",
    ]),
    templateNodeId: expectDigest(record.templateNodeId, [
      ...path,
      "templateNodeId",
    ]) as ExecutionTemplateNodeId,
    locationRequirementId: expectDigest(record.locationRequirementId, [
      ...path,
      "locationRequirementId",
    ]) as ExecutionLocationRequirementId,
    occurrenceTemplateId: expectDigest(record.occurrenceTemplateId, [
      ...path,
      "occurrenceTemplateId",
    ]) as StaticExecutionOccurrenceTemplateId,
    semanticRole: expectOneOf(record.semanticRole, SEMANTIC_ROLES, [
      ...path,
      "semanticRole",
    ]),
    binding: parseQualifiedBinding(record.binding, [...path, "binding"]),
  };
}

function parseEdgePreimage(
  value: unknown,
  path: ValidationPath,
): ExecutionEdgePreimage {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  const kind = expectOneOf(value.kind, EDGE_KINDS, [...path, "kind"]);
  const record = expectRecord(value, path, [
    "schema",
    "kind",
    "sourceNodeId",
    "targetNodeId",
    ...(kind === "identity" ? ["identitySlot"] : []),
  ]);
  const base = {
    schema: expectLiteral(record.schema, "dathra.execution-edge/1", [
      ...path,
      "schema",
    ]),
    sourceNodeId: expectDigest(record.sourceNodeId, [
      ...path,
      "sourceNodeId",
    ]) as QualifiedExecutionNodeId,
    targetNodeId: expectDigest(record.targetNodeId, [
      ...path,
      "targetNodeId",
    ]) as QualifiedExecutionNodeId,
  };
  if (kind === "identity") {
    return {
      ...base,
      kind,
      identitySlot: expectOneOf(record.identitySlot, OCCURRENCE_SLOTS, [
        ...path,
        "identitySlot",
      ]),
    };
  }
  return { ...base, kind };
}

function parseRegistrationSupportPreimage(
  value: unknown,
  path: ValidationPath,
): RegistrationSupportTemplatePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "registrationNodeId",
    "registrationEdgeId",
    "callbackNodeId",
    "contingentRootDefinitionId",
    "triggerConstraintId",
    "once",
    "abortable",
    "protocol",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.registration-support/1", [
      ...path,
      "schema",
    ]),
    registrationNodeId: expectDigest(record.registrationNodeId, [
      ...path,
      "registrationNodeId",
    ]) as QualifiedExecutionNodeId,
    registrationEdgeId: expectDigest(record.registrationEdgeId, [
      ...path,
      "registrationEdgeId",
    ]) as ExecutionEdgeId,
    callbackNodeId: expectDigest(record.callbackNodeId, [
      ...path,
      "callbackNodeId",
    ]) as QualifiedExecutionNodeId,
    contingentRootDefinitionId: expectDigest(
      record.contingentRootDefinitionId,
      [...path, "contingentRootDefinitionId"],
    ) as ExecutionRootDefinitionId,
    triggerConstraintId: expectDigest(record.triggerConstraintId, [
      ...path,
      "triggerConstraintId",
    ]),
    once: expectBoolean(record.once, [...path, "once"]),
    abortable: expectBoolean(record.abortable, [...path, "abortable"]),
    protocol: expectLiteral(record.protocol, "dathra.registration-state/1", [
      ...path,
      "protocol",
    ]),
  };
}

function parseIdSequence<Id extends Sha256Digest>(
  value: unknown,
  path: ValidationPath,
): readonly Id[] {
  const values = expectArray(value, path).map(
    (item, index) => expectDigest(item, [...path, index]) as Id,
  );
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    if (seen.has(values[index])) {
      fail("duplicate-record", [...path, index], "Duplicate sequence identity");
    }
    seen.add(values[index]);
  }
  return Object.freeze([...values]);
}

function parseReactiveSupportPreimage(
  value: unknown,
  path: ValidationPath,
): ReactiveSupportTemplatePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "collectorNodeId",
    "readNodeId",
    "dependencyNodeId",
    "bindingNodeId",
    "dataEdgeId",
    "subscriptionEdgeId",
    "invalidationEdgeIds",
    "contingentRootDefinitionId",
    "triggerConstraintId",
  ]);
  const invalidationEdgeIds = parseIdSequence<ExecutionEdgeId>(
    record.invalidationEdgeIds,
    [...path, "invalidationEdgeIds"],
  );
  if (invalidationEdgeIds.length === 0) {
    fail(
      "invalid-field",
      [...path, "invalidationEdgeIds"],
      "Reactive support requires a non-empty invalidation path",
    );
  }
  return {
    schema: expectLiteral(record.schema, "dathra.reactive-support/1", [
      ...path,
      "schema",
    ]),
    collectorNodeId: expectDigest(record.collectorNodeId, [
      ...path,
      "collectorNodeId",
    ]) as QualifiedExecutionNodeId,
    readNodeId: expectDigest(record.readNodeId, [
      ...path,
      "readNodeId",
    ]) as QualifiedExecutionNodeId,
    dependencyNodeId: expectDigest(record.dependencyNodeId, [
      ...path,
      "dependencyNodeId",
    ]) as QualifiedExecutionNodeId,
    bindingNodeId: expectDigest(record.bindingNodeId, [
      ...path,
      "bindingNodeId",
    ]) as QualifiedExecutionNodeId,
    dataEdgeId: expectDigest(record.dataEdgeId, [
      ...path,
      "dataEdgeId",
    ]) as ExecutionEdgeId,
    subscriptionEdgeId: expectDigest(record.subscriptionEdgeId, [
      ...path,
      "subscriptionEdgeId",
    ]) as ExecutionEdgeId,
    invalidationEdgeIds,
    contingentRootDefinitionId: expectDigest(
      record.contingentRootDefinitionId,
      [...path, "contingentRootDefinitionId"],
    ) as ExecutionRootDefinitionId,
    triggerConstraintId: expectDigest(record.triggerConstraintId, [
      ...path,
      "triggerConstraintId",
    ]),
  };
}

function parseRootObligationPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): ExecutionRootObligationPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "rootDefinitionId",
    "observationContractId",
    "targetNodeId",
    "entryFactKind",
    "triggerConstraintIds",
    "ownerConstraintIds",
    "terminalConstraintId",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.execution-root-obligation/1", [
      ...path,
      "schema",
    ]),
    rootDefinitionId: expectDigest(record.rootDefinitionId, [
      ...path,
      "rootDefinitionId",
    ]) as ExecutionRootDefinitionId,
    observationContractId: expectDigest(record.observationContractId, [
      ...path,
      "observationContractId",
    ]),
    targetNodeId: expectDigest(record.targetNodeId, [
      ...path,
      "targetNodeId",
    ]) as QualifiedExecutionNodeId,
    entryFactKind: expectOneOf(
      record.entryFactKind,
      ["execute", "materialize"] as const,
      [...path, "entryFactKind"],
    ),
    triggerConstraintIds: parseDigestSet(
      record.triggerConstraintIds,
      [...path, "triggerConstraintIds"],
      normalize,
      ledger,
    ),
    ownerConstraintIds: parseDigestSet(
      record.ownerConstraintIds,
      [...path, "ownerConstraintIds"],
      normalize,
      ledger,
    ),
    terminalConstraintId: expectDigest(record.terminalConstraintId, [
      ...path,
      "terminalConstraintId",
    ]),
  };
}

function schemaInput(
  value: unknown,
  schema: string,
  path: ValidationPath,
  ledger: BudgetLedger,
): DataRecord {
  ledger.charge(
    "maximumValidationSteps",
    1,
    path,
    "Validation-step budget exceeded",
  );
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  if (Object.hasOwn(value, "schema")) {
    fail(
      "invalid-field",
      [...path, "schema"],
      "Unexpected creator input field",
    );
  }
  return { ...value, schema };
}

/** Creates a canonical execution analysis profile. */
async function createExecutionAnalysisProfile(
  input: ExecutionAnalysisProfileInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionAnalysisProfile> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseAnalysisProfilePreimage(
      schemaInput(value, "dathra.execution-analysis-profile/1", [], ledger),
      [],
    ),
    ledger,
  )) as ExecutionAnalysisProfile;
}

/** Creates a primitive canonical execution root definition. */
async function createExecutionRootDefinition(
  input: ExecutionRootDefinitionInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionRootDefinition> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseRootDefinitionPreimage(
      schemaInput(value, "dathra.execution-root-definition/1", [], ledger),
      [],
    ),
    ledger,
  )) as ExecutionRootDefinition;
}

/** Creates canonical symbolic execution location requirements. */
async function createExecutionLocationRequirement(
  input: ExecutionLocationRequirementInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionLocationRequirement> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseLocationRequirementPreimage(
      schemaInput(value, "dathra.execution-location-requirement/1", [], ledger),
      [],
      true,
      ledger,
    ),
    ledger,
  )) as ExecutionLocationRequirement;
}

/** Creates a canonical static occurrence shape. */
async function createStaticExecutionOccurrenceTemplate(
  input: StaticExecutionOccurrenceTemplateInput,
  budget?: ExecutionGraphBudget,
): Promise<StaticExecutionOccurrenceTemplate> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseOccurrenceTemplatePreimage(
      schemaInput(value, "dathra.static-execution-occurrence/1", [], ledger),
      [],
      true,
      ledger,
    ),
    ledger,
  )) as StaticExecutionOccurrenceTemplate;
}

/** Creates a canonical source or compiler-generated template node. */
async function createExecutionTemplateNode(
  input: ExecutionTemplateNodeInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionTemplateNode> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseTemplateNodePreimage(
      schemaInput(value, "dathra.execution-template-node/1", [], ledger),
      [],
      true,
      ledger,
    ),
    ledger,
  )) as ExecutionTemplateNode;
}

/** Creates a canonical generated-operation location binding. */
async function createExecutionGenerationDomain(
  input: ExecutionGenerationDomainInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionGenerationDomain> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseGenerationDomainPreimage(
      schemaInput(value, "dathra.execution-generation-domain/1", [], ledger),
      [],
    ),
    ledger,
  )) as ExecutionGenerationDomain;
}

/** Creates a canonical qualified execution graph vertex. */
async function createQualifiedExecutionNode(
  input: QualifiedExecutionNodeInput,
  budget?: ExecutionGraphBudget,
): Promise<QualifiedExecutionNode> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseQualifiedNodePreimage(
      schemaInput(value, "dathra.qualified-execution-node/1", [], ledger),
      [],
    ),
    ledger,
  )) as QualifiedExecutionNode;
}

/** Creates a canonical typed execution relation. */
async function createExecutionEdge(
  input: ExecutionEdgeInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionEdge> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseEdgePreimage(
      schemaInput(value, "dathra.execution-edge/1", [], ledger),
      [],
    ),
    ledger,
  )) as ExecutionEdge;
}

/** Creates static support evidence for one contingent callback root. */
async function createRegistrationSupportTemplate(
  input: RegistrationSupportTemplateInput,
  budget?: ExecutionGraphBudget,
): Promise<RegistrationSupportTemplate> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseRegistrationSupportPreimage(
      schemaInput(value, "dathra.registration-support/1", [], ledger),
      [],
    ),
    ledger,
  )) as RegistrationSupportTemplate;
}

/** Creates static support evidence for one potential reactive updater root. */
async function createReactiveSupportTemplate(
  input: ReactiveSupportTemplateInput,
  budget?: ExecutionGraphBudget,
): Promise<ReactiveSupportTemplate> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseReactiveSupportPreimage(
      schemaInput(value, "dathra.reactive-support/1", [], ledger),
      [],
    ),
    ledger,
  )) as ReactiveSupportTemplate;
}

/** Creates an exact root, contract, and graph-target binding. */
async function createExecutionRootObligation(
  input: ExecutionRootObligationInput,
  budget?: ExecutionGraphBudget,
): Promise<ExecutionRootObligation> {
  const ledger = new BudgetLedger(resolveBudget(budget));
  const value = snapshotClosed(input, [], ledger);
  return (await createIdentityRecord(
    parseRootObligationPreimage(
      schemaInput(value, "dathra.execution-root-obligation/1", [], ledger),
      [],
      true,
      ledger,
    ),
    ledger,
  )) as ExecutionRootObligation;
}

async function parseRecordArray<Id extends Sha256Digest, Preimage>(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
  parsePreimage: (value: unknown, path: ValidationPath) => Preimage,
): Promise<readonly ExecutionIdentityRecord<Id, Preimage>[]> {
  const input = expectArray(value, path);
  ledger.assertWithin(
    "maximumRecordsPerKind",
    input.length,
    path,
    "Record-count budget exceeded",
  );
  ledger.charge(
    "maximumValidationSteps",
    input.length,
    path,
    "Validation-step budget exceeded",
  );
  const records: ExecutionIdentityRecord<Id, Preimage>[] = [];
  for (let index = 0; index < input.length; index += 1) {
    records.push(
      await parseIdentityRecord(
        input[index],
        [...path, index],
        parsePreimage,
        ledger,
      ),
    );
  }
  const seen = new Set<string>();
  for (let index = 0; index < records.length; index += 1) {
    if (seen.has(records[index].id)) {
      fail("duplicate-record", [...path, index, "id"], "Duplicate record ID");
    }
    seen.add(records[index].id);
  }
  const sorted = [...records].sort((left, right) => {
    ledger.charge(
      "maximumValidationSteps",
      1,
      path,
      "Validation-step budget exceeded",
    );
    return left.id < right.id ? -1 : left.id > right.id ? 1 : 0;
  });
  if (
    !normalize &&
    sorted.some((item, index) => item.id !== records[index].id)
  ) {
    fail("noncanonical-order", path, "Record array is not ID-sorted");
  }
  deepFreeze(sorted);
  return sorted;
}

interface ParsedGraphRecords {
  readonly analysisProfiles: readonly ExecutionAnalysisProfile[];
  readonly rootDefinitions: readonly ExecutionRootDefinition[];
  readonly locationRequirements: readonly ExecutionLocationRequirement[];
  readonly occurrenceTemplates: readonly StaticExecutionOccurrenceTemplate[];
  readonly templateNodes: readonly ExecutionTemplateNode[];
  readonly generationDomains: readonly ExecutionGenerationDomain[];
  readonly qualifiedNodes: readonly QualifiedExecutionNode[];
  readonly edges: readonly ExecutionEdge[];
  readonly registrationSupports: readonly RegistrationSupportTemplate[];
  readonly reactiveSupports: readonly ReactiveSupportTemplate[];
  readonly rootObligations: readonly ExecutionRootObligation[];
}

async function parseGraphRecordFields(
  record: DataRecord,
  path: ValidationPath,
  normalize: boolean,
  ledger: BudgetLedger,
): Promise<ParsedGraphRecords> {
  return {
    analysisProfiles: (await parseRecordArray(
      record.analysisProfiles,
      [...path, "analysisProfiles"],
      normalize,
      ledger,
      parseAnalysisProfilePreimage,
    )) as readonly ExecutionAnalysisProfile[],
    rootDefinitions: (await parseRecordArray(
      record.rootDefinitions,
      [...path, "rootDefinitions"],
      normalize,
      ledger,
      parseRootDefinitionPreimage,
    )) as readonly ExecutionRootDefinition[],
    locationRequirements: (await parseRecordArray(
      record.locationRequirements,
      [...path, "locationRequirements"],
      normalize,
      ledger,
      (value, itemPath) =>
        parseLocationRequirementPreimage(value, itemPath, false, ledger),
    )) as readonly ExecutionLocationRequirement[],
    occurrenceTemplates: (await parseRecordArray(
      record.occurrenceTemplates,
      [...path, "occurrenceTemplates"],
      normalize,
      ledger,
      (value, itemPath) =>
        parseOccurrenceTemplatePreimage(value, itemPath, false, ledger),
    )) as readonly StaticExecutionOccurrenceTemplate[],
    templateNodes: (await parseRecordArray(
      record.templateNodes,
      [...path, "templateNodes"],
      normalize,
      ledger,
      (value, itemPath) =>
        parseTemplateNodePreimage(value, itemPath, false, ledger),
    )) as readonly ExecutionTemplateNode[],
    generationDomains: (await parseRecordArray(
      record.generationDomains,
      [...path, "generationDomains"],
      normalize,
      ledger,
      parseGenerationDomainPreimage,
    )) as readonly ExecutionGenerationDomain[],
    qualifiedNodes: (await parseRecordArray(
      record.qualifiedNodes,
      [...path, "qualifiedNodes"],
      normalize,
      ledger,
      parseQualifiedNodePreimage,
    )) as readonly QualifiedExecutionNode[],
    edges: (await parseRecordArray(
      record.edges,
      [...path, "edges"],
      normalize,
      ledger,
      parseEdgePreimage,
    )) as readonly ExecutionEdge[],
    registrationSupports: (await parseRecordArray(
      record.registrationSupports,
      [...path, "registrationSupports"],
      normalize,
      ledger,
      parseRegistrationSupportPreimage,
    )) as readonly RegistrationSupportTemplate[],
    reactiveSupports: (await parseRecordArray(
      record.reactiveSupports,
      [...path, "reactiveSupports"],
      normalize,
      ledger,
      parseReactiveSupportPreimage,
    )) as readonly ReactiveSupportTemplate[],
    rootObligations: (await parseRecordArray(
      record.rootObligations,
      [...path, "rootObligations"],
      normalize,
      ledger,
      (value, itemPath) =>
        parseRootObligationPreimage(value, itemPath, false, ledger),
    )) as readonly ExecutionRootObligation[],
  };
}

interface ParsedDependencies {
  readonly moduleGraph: ModuleGraphSnapshot;
  readonly contractsById: ReadonlyMap<Sha256Digest, ObservationContract>;
}

function readDataProperty(value: unknown, key: string): unknown {
  if (!isDataRecord(value)) return undefined;
  const descriptor = Object.getOwnPropertyDescriptor(value, key);
  return descriptor !== undefined && "value" in descriptor
    ? descriptor.value
    : undefined;
}

function countModuleGraphRecords(value: unknown): number {
  const preimage = readDataProperty(value, "preimage");
  if (!isDataRecord(preimage)) return 0;
  let count = 0;
  for (const field of [
    "semanticProfiles",
    "resolutionDomains",
    "requestInventories",
    "externalDefinitionContracts",
    "moduleDefinitions",
    "runtimeBindings",
    "loaderEntries",
    "externalRuntimeEvidence",
    "semanticRequests",
    "resolutionEvidence",
    "resolvedRequests",
    "requestSiteEvidence",
    "requestSites",
    "entries",
  ]) {
    const records = readDataProperty(preimage, field);
    if (Array.isArray(records)) {
      count += records.length;
      if (!Number.isSafeInteger(count)) return Number.MAX_SAFE_INTEGER;
    }
  }
  return count;
}

function preflightDependencyCardinality(
  value: unknown,
  ledger: BudgetLedger,
): void {
  const contracts = readDataProperty(value, "observationContracts");
  if (Array.isArray(contracts)) {
    ledger.assertWithin(
      "maximumDependencyContracts",
      contracts.length,
      ["dependencies", "observationContracts"],
      "Dependency contract budget exceeded",
    );
  }
  const moduleGraph = readDataProperty(value, "moduleGraph");
  ledger.assertWithin(
    "maximumDependencyModuleRecords",
    countModuleGraphRecords(moduleGraph),
    ["dependencies", "moduleGraph"],
    "Dependency module-record budget exceeded",
  );
}

async function parseDependencies(
  value: ExecutionGraphDependencies,
  ledger: BudgetLedger,
): Promise<ParsedDependencies> {
  preflightDependencyCardinality(value, ledger);
  const snapshot = snapshotClosed(value, ["dependencies"], ledger);
  const record = expectRecord(
    snapshot,
    ["dependencies"],
    ["moduleGraph", "observationContracts"],
  );
  const contractValues = expectArray(record.observationContracts, [
    "dependencies",
    "observationContracts",
  ]);
  ledger.assertWithin(
    "maximumDependencyContracts",
    contractValues.length,
    ["dependencies", "observationContracts"],
    "Dependency contract budget exceeded",
  );
  ledger.assertWithin(
    "maximumDependencyModuleRecords",
    countModuleGraphRecords(record.moduleGraph),
    ["dependencies", "moduleGraph"],
    "Dependency module-record budget exceeded",
  );

  let moduleGraph: ModuleGraphSnapshot;
  try {
    ledger.charge(
      "maximumValidationSteps",
      1,
      ["dependencies", "moduleGraph"],
      "Validation-step budget exceeded",
    );
    moduleGraph = await parseModuleGraphSnapshot(record.moduleGraph);
  } catch (error) {
    if (error instanceof ExecutionGraphError) throw error;
    fail(
      "dependency-mismatch",
      ["dependencies", "moduleGraph"],
      error instanceof Error
        ? error.message
        : "Invalid module graph dependency",
    );
  }

  const contractsById = new Map<Sha256Digest, ObservationContract>();
  for (let index = 0; index < contractValues.length; index += 1) {
    let contract: ObservationContract;
    try {
      ledger.charge(
        "maximumValidationSteps",
        1,
        ["dependencies", "observationContracts", index],
        "Validation-step budget exceeded",
      );
      contract = await parseObservationContract(contractValues[index]);
    } catch (error) {
      if (error instanceof ExecutionGraphError) throw error;
      fail(
        "dependency-mismatch",
        ["dependencies", "observationContracts", index],
        error instanceof Error ? error.message : "Invalid observation contract",
      );
    }
    if (contractsById.has(contract.id)) {
      fail(
        "duplicate-record",
        ["dependencies", "observationContracts", index, "id"],
        "Duplicate observation contract",
      );
    }
    contractsById.set(contract.id, contract);
  }
  return { moduleGraph, contractsById };
}

const SNAPSHOT_RECORD_FIELDS = [
  "analysisProfiles",
  "rootDefinitions",
  "locationRequirements",
  "occurrenceTemplates",
  "templateNodes",
  "generationDomains",
  "qualifiedNodes",
  "edges",
  "registrationSupports",
  "reactiveSupports",
  "rootObligations",
] as const;

function preflightGraphRecordCardinality(
  value: unknown,
  path: ValidationPath,
  ledger: BudgetLedger,
): void {
  for (const field of SNAPSHOT_RECORD_FIELDS) {
    const records = readDataProperty(value, field);
    if (Array.isArray(records)) {
      ledger.assertWithin(
        "maximumRecordsPerKind",
        records.length,
        [...path, field],
        "Record-count budget exceeded",
      );
    }
  }
}

function preflightGraphSnapshotCardinality(
  value: unknown,
  ledger: BudgetLedger,
): void {
  preflightGraphRecordCardinality(
    readDataProperty(value, "preimage"),
    ["preimage"],
    ledger,
  );
}

function canonicalEqual(
  left: unknown,
  right: unknown,
  ledger: BudgetLedger,
): boolean {
  chargeCanonicalBytes(left, ["canonicalEqual", "left"], ledger);
  chargeCanonicalBytes(right, ["canonicalEqual", "right"], ledger);
  return canonicalizeJson(left).text === canonicalizeJson(right).text;
}

export {
  SNAPSHOT_RECORD_FIELDS,
  canonicalEqual,
  chargeCanonicalBytes,
  createExecutionAnalysisProfile,
  createExecutionEdge,
  createExecutionGenerationDomain,
  createExecutionLocationRequirement,
  createExecutionRootDefinition,
  createExecutionRootObligation,
  createExecutionTemplateNode,
  createIdentityRecord,
  createQualifiedExecutionNode,
  createReactiveSupportTemplate,
  createRegistrationSupportTemplate,
  createStaticExecutionOccurrenceTemplate,
  expectDigest,
  expectLiteral,
  expectRecord,
  parseDependencies,
  parseDigestSet,
  parseGraphRecordFields,
  preflightGraphRecordCardinality,
  preflightGraphSnapshotCardinality,
  snapshotClosed,
};
export type { ParsedDependencies, ParsedGraphRecords };
