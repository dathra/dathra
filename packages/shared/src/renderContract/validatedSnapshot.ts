import {
  isSha256Digest,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import type {
  RenderDefinitionDescriptorFieldSnapshot,
  RenderDefinitionDescriptorOccurrence,
  RenderDefinitionDescriptorRecordKind,
  RenderDefinitionDescriptorSnapshot,
} from "./descriptorSnapshot";
import { RenderDefinitionError, type RenderDefinitionErrorCode } from "./error";
import type { RenderDefinitionPreimage } from "./model";

type SnapshotPath = readonly string[];

/** A validated parser snapshot that has not received a definition ID brand. */
interface UnbrandedRenderDefinitionSnapshot {
  readonly id: Sha256Digest;
  readonly preimage: RenderDefinitionPreimage;
}

interface LiteralFieldRule {
  readonly key: string;
  readonly value: string;
}

interface DigestFieldRule {
  readonly key: string;
  readonly errorCode: "invalid-field" | "invalid-reference";
}

interface ScalarValidationRule {
  readonly nestedKeys: readonly string[];
  readonly stringKeys: readonly string[];
  readonly literalFields: readonly LiteralFieldRule[];
  readonly digestFields: readonly DigestFieldRule[];
}

const PREIMAGE_SCHEMA = "dathra.render-definition/1";
const OBSERVATION_SCHEMA = "dathra.render-definition-observation-reference/1";
const RESPONSE_SCHEMA = "dathra.render-definition-response-reference/1";
const BODY_SCHEMA = "dathra.render-definition-body-reference/1";
const EXPOSURE_SCHEMA = "dathra.render-definition-exposure-reference/1";
const MAXIMUM_INPUT_STRING_CODE_UNITS = 256;

const VALIDATION_RULES = {
  "creator-input": {
    nestedKeys: [],
    stringKeys: [
      "observationContractId",
      "responseContributionSetId",
      "orderedBodyPlanId",
      "exposureContractId",
    ],
    literalFields: [],
    digestFields: [
      { key: "observationContractId", errorCode: "invalid-reference" },
      { key: "responseContributionSetId", errorCode: "invalid-reference" },
      { key: "orderedBodyPlanId", errorCode: "invalid-reference" },
      { key: "exposureContractId", errorCode: "invalid-reference" },
    ],
  },
  wrapper: {
    nestedKeys: ["preimage"],
    stringKeys: ["id"],
    literalFields: [],
    digestFields: [{ key: "id", errorCode: "invalid-field" }],
  },
  preimage: {
    nestedKeys: [
      "observationContract",
      "responseContributions",
      "orderedBodyPlan",
      "exposure",
    ],
    stringKeys: ["schema"],
    literalFields: [{ key: "schema", value: PREIMAGE_SCHEMA }],
    digestFields: [],
  },
  "observation-claim": {
    nestedKeys: [],
    stringKeys: ["schema", "role", "claimedId"],
    literalFields: [
      { key: "schema", value: OBSERVATION_SCHEMA },
      { key: "role", value: "observation-contract" },
    ],
    digestFields: [{ key: "claimedId", errorCode: "invalid-reference" }],
  },
  "response-claim": {
    nestedKeys: [],
    stringKeys: ["schema", "role", "claimedId"],
    literalFields: [
      { key: "schema", value: RESPONSE_SCHEMA },
      { key: "role", value: "response-contribution-set" },
    ],
    digestFields: [{ key: "claimedId", errorCode: "invalid-reference" }],
  },
  "body-claim": {
    nestedKeys: [],
    stringKeys: ["schema", "role", "claimedId"],
    literalFields: [
      { key: "schema", value: BODY_SCHEMA },
      { key: "role", value: "ordered-body-plan" },
    ],
    digestFields: [{ key: "claimedId", errorCode: "invalid-reference" }],
  },
  "exposure-claim": {
    nestedKeys: [],
    stringKeys: ["schema", "role", "claimedId"],
    literalFields: [
      { key: "schema", value: EXPOSURE_SCHEMA },
      { key: "role", value: "exposure-contract" },
    ],
    digestFields: [{ key: "claimedId", errorCode: "invalid-reference" }],
  },
} satisfies Record<RenderDefinitionDescriptorRecordKind, ScalarValidationRule>;

function fail(
  code: RenderDefinitionErrorCode,
  path: SnapshotPath,
  detail: string,
): never {
  throw new RenderDefinitionError(code, path, `[dathra] ${detail}`);
}

function fieldOf(
  occurrence: RenderDefinitionDescriptorOccurrence,
  key: string,
): RenderDefinitionDescriptorFieldSnapshot {
  const field = occurrence.fields.find((candidate) => candidate.key === key);
  if (field === undefined) {
    throw new TypeError(`DI2A snapshot omitted expected field state ${key}`);
  }
  return field;
}

function validateNestedRecordStates(
  snapshot: RenderDefinitionDescriptorSnapshot,
): void {
  for (const occurrence of snapshot.occurrences) {
    for (const key of VALIDATION_RULES[occurrence.kind].nestedKeys) {
      const field = fieldOf(occurrence, key);
      if (field.state !== "missing" && field.state !== "object") {
        fail(
          "invalid-closed-record",
          [...occurrence.path, key],
          "Expected a nested record",
        );
      }
    }
  }
}

function validateStringBudgets(
  snapshot: RenderDefinitionDescriptorSnapshot,
): void {
  for (const occurrence of snapshot.occurrences) {
    for (const key of VALIDATION_RULES[occurrence.kind].stringKeys) {
      const field = fieldOf(occurrence, key);
      if (
        field.state === "string" &&
        field.value.length > MAXIMUM_INPUT_STRING_CODE_UNITS
      ) {
        fail(
          "budget-exceeded",
          [...occurrence.path, key],
          `Input string exceeds ${MAXIMUM_INPUT_STRING_CODE_UNITS} code units`,
        );
      }
    }
  }
}

function validateMissingFields(
  snapshot: RenderDefinitionDescriptorSnapshot,
): void {
  for (const occurrence of snapshot.occurrences) {
    for (const field of occurrence.fields) {
      if (field.state === "missing") {
        fail(
          "invalid-field",
          [...occurrence.path, field.key],
          "Required field is missing",
        );
      }
    }
  }
}

function compareRawUtf16(left: string, right: string): number {
  if (left < right) {
    return -1;
  }
  if (left > right) {
    return 1;
  }
  return 0;
}

function validateExtraFields(
  snapshot: RenderDefinitionDescriptorSnapshot,
): void {
  for (const occurrence of snapshot.occurrences) {
    const expectedKeys = occurrence.fields.map((field) => field.key);
    const extraKeys = occurrence.ownKeys
      .filter((key) => !expectedKeys.includes(key))
      .sort(compareRawUtf16);
    if (extraKeys.length > 0) {
      fail(
        "invalid-field",
        [...occurrence.path, extraKeys[0]],
        "Record contains an extra field",
      );
    }
  }
}

function validateLiteralFields(
  snapshot: RenderDefinitionDescriptorSnapshot,
): void {
  for (const occurrence of snapshot.occurrences) {
    for (const rule of VALIDATION_RULES[occurrence.kind].literalFields) {
      const field = fieldOf(occurrence, rule.key);
      if (field.state !== "string" || field.value !== rule.value) {
        fail(
          "invalid-field",
          [...occurrence.path, rule.key],
          "Field does not match its required literal",
        );
      }
    }
  }
}

function validateDigestFields(
  snapshot: RenderDefinitionDescriptorSnapshot,
): void {
  for (const occurrence of snapshot.occurrences) {
    for (const rule of VALIDATION_RULES[occurrence.kind].digestFields) {
      const field = fieldOf(occurrence, rule.key);
      if (field.state !== "string" || !isSha256Digest(field.value)) {
        fail(
          rule.errorCode,
          [...occurrence.path, rule.key],
          "Field is not a canonical SHA-256 digest",
        );
      }
    }
  }
}

function validateSnapshot(snapshot: RenderDefinitionDescriptorSnapshot): void {
  validateNestedRecordStates(snapshot);
  validateStringBudgets(snapshot);
  validateMissingFields(snapshot);
  validateExtraFields(snapshot);
  validateLiteralFields(snapshot);
  validateDigestFields(snapshot);
}

function occurrenceOf(
  snapshot: RenderDefinitionDescriptorSnapshot,
  kind: RenderDefinitionDescriptorRecordKind,
): RenderDefinitionDescriptorOccurrence {
  const occurrence = snapshot.occurrences.find(
    (candidate) => candidate.kind === kind,
  );
  if (occurrence === undefined) {
    throw new TypeError(`DI2A snapshot omitted ${kind} occurrence`);
  }
  return occurrence;
}

function validatedDigest(
  occurrence: RenderDefinitionDescriptorOccurrence,
  key: string,
): Sha256Digest {
  const field = fieldOf(occurrence, key);
  if (field.state !== "string" || !isSha256Digest(field.value)) {
    throw new TypeError(`Expected validated digest field ${key}`);
  }
  return field.value;
}

function createFreshPreimage(
  observationContractId: Sha256Digest,
  responseContributionSetId: Sha256Digest,
  orderedBodyPlanId: Sha256Digest,
  exposureContractId: Sha256Digest,
): RenderDefinitionPreimage {
  const observationContract = Object.freeze({
    schema: OBSERVATION_SCHEMA,
    role: "observation-contract" as const,
    claimedId: observationContractId,
  });
  const responseContributions = Object.freeze({
    schema: RESPONSE_SCHEMA,
    role: "response-contribution-set" as const,
    claimedId: responseContributionSetId,
  });
  const orderedBodyPlan = Object.freeze({
    schema: BODY_SCHEMA,
    role: "ordered-body-plan" as const,
    claimedId: orderedBodyPlanId,
  });
  const exposure = Object.freeze({
    schema: EXPOSURE_SCHEMA,
    role: "exposure-contract" as const,
    claimedId: exposureContractId,
  });
  return Object.freeze({
    schema: PREIMAGE_SCHEMA,
    observationContract,
    responseContributions,
    orderedBodyPlan,
    exposure,
  });
}

/** Validates a creator descriptor snapshot and constructs a fresh preimage. */
function validateRenderDefinitionCreatorSnapshot(
  snapshot: RenderDefinitionDescriptorSnapshot,
): RenderDefinitionPreimage {
  validateSnapshot(snapshot);
  const input = occurrenceOf(snapshot, "creator-input");
  const observationContractId = validatedDigest(input, "observationContractId");
  const responseContributionSetId = validatedDigest(
    input,
    "responseContributionSetId",
  );
  const orderedBodyPlanId = validatedDigest(input, "orderedBodyPlanId");
  const exposureContractId = validatedDigest(input, "exposureContractId");
  return createFreshPreimage(
    observationContractId,
    responseContributionSetId,
    orderedBodyPlanId,
    exposureContractId,
  );
}

/** Validates a parser descriptor snapshot and constructs an unbranded record. */
function validateRenderDefinitionParserSnapshot(
  snapshot: RenderDefinitionDescriptorSnapshot,
): UnbrandedRenderDefinitionSnapshot {
  validateSnapshot(snapshot);
  const wrapper = occurrenceOf(snapshot, "wrapper");
  const observation = occurrenceOf(snapshot, "observation-claim");
  const response = occurrenceOf(snapshot, "response-claim");
  const body = occurrenceOf(snapshot, "body-claim");
  const exposure = occurrenceOf(snapshot, "exposure-claim");
  const id = validatedDigest(wrapper, "id");
  const observationContractId = validatedDigest(observation, "claimedId");
  const responseContributionSetId = validatedDigest(response, "claimedId");
  const orderedBodyPlanId = validatedDigest(body, "claimedId");
  const exposureContractId = validatedDigest(exposure, "claimedId");
  return Object.freeze({
    id,
    preimage: createFreshPreimage(
      observationContractId,
      responseContributionSetId,
      orderedBodyPlanId,
      exposureContractId,
    ),
  });
}

export {
  validateRenderDefinitionCreatorSnapshot,
  validateRenderDefinitionParserSnapshot,
};
export type { UnbrandedRenderDefinitionSnapshot };
