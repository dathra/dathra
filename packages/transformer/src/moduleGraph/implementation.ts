import {
  CanonicalIdentityError,
  canonicalizeJson,
  digestCanonicalJson,
  isSha256Digest,
  sha256Digest,
  type Sha256Digest,
} from "@dathra/shared/canonical-identity";

declare const canonicalModuleUrlBrand: unique symbol;
declare const moduleContentDigestBrand: unique symbol;
declare const moduleGraphIdBrand: unique symbol;

/** An absolute URL serialized by the WHATWG URL parser. */
type CanonicalModuleUrl = string & {
  readonly [canonicalModuleUrlBrand]: true;
};

/** A SHA-256 digest of exact module bytes. */
type ModuleContentDigest = Sha256Digest & {
  readonly [moduleContentDigestBrand]: true;
};

/** A content-addressed module graph identity branded by record kind. */
type ModuleGraphId<Kind extends string> = Sha256Digest & {
  readonly [moduleGraphIdBrand]: Kind;
};

type ModuleSemanticProfileId = ModuleGraphId<"semantic-profile">;
type ModuleResolutionDomainId = ModuleGraphId<"resolution-domain">;
type ModuleRequestInventoryId = ModuleGraphId<"request-inventory">;
type ExternalModuleDefinitionContractId =
  ModuleGraphId<"external-definition-contract">;
type ModuleDefinitionId = ModuleGraphId<"module-definition">;
type RuntimeModuleBindingId = ModuleGraphId<"runtime-binding">;
type ModuleLoaderEntryId = ModuleGraphId<"loader-entry">;
type SemanticModuleRequestId = ModuleGraphId<"semantic-request">;
type ModuleResolutionEvidenceId = ModuleGraphId<"resolution-evidence">;
type ResolvedModuleRequestId = ModuleGraphId<"resolved-request">;
type ExternalRuntimeClosureEvidenceId =
  ModuleGraphId<"external-runtime-evidence">;
type ModuleRequestSiteEvidenceId = ModuleGraphId<"request-site-evidence">;
type ModuleRequestSiteId = ModuleGraphId<"request-site">;
type ModuleGraphEntryId = ModuleGraphId<"graph-entry">;
type ModuleGraphSnapshotId = ModuleGraphId<"graph-snapshot">;

/** A property or array index in a module graph failure path. */
type ModuleGraphPathSegment = string | number;

/** Stable failure codes emitted by module graph operations. */
type ModuleGraphErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-url"
  | "noncanonical-order"
  | "duplicate-record"
  | "digest-mismatch"
  | "dangling-reference"
  | "domain-mismatch"
  | "identity-conflict"
  | "request-conflict"
  | "site-mismatch"
  | "external-contract-mismatch"
  | "unreachable-record";

/** Describes why a module graph value is invalid. */
class ModuleGraphError extends TypeError {
  readonly code: ModuleGraphErrorCode;
  readonly path: readonly ModuleGraphPathSegment[];

  /** Creates an immutable module graph failure. */
  constructor(
    code: ModuleGraphErrorCode,
    path: readonly ModuleGraphPathSegment[],
    message: string,
  ) {
    super(message);
    this.name = "ModuleGraphError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

/** A canonical identity record and its versioned preimage. */
interface ModuleIdentityRecord<Id, Preimage> {
  readonly id: Id;
  readonly preimage: Preimage;
}

/** The syntax/evaluation format of transformed module content. */
type ModuleDefinitionKind =
  | "ecmascript-module"
  | "ecmascript-script"
  | "commonjs"
  | "json"
  | "wasm"
  | "css"
  | "text";

/** The parse goal used for transformed module content. */
type ModuleParseGoal =
  | "module"
  | "script"
  | "commonjs"
  | "json"
  | "wasm"
  | "css"
  | "text";

/** The requested module loading phase. */
type ModuleImportPhase = "source" | "evaluation";

/** The host loader namespace owning a module cache entry. */
type ModuleLoaderNamespaceKind = "native" | "commonjs";

/** The source-level kind of a module request site. */
type ModuleRequestSiteKind =
  | "static-import"
  | "dynamic-import"
  | "commonjs-require"
  | "wasm-import"
  | "css-import";

/** A canonical import attribute key/value pair. */
interface ModuleImportAttribute {
  readonly key: string;
  readonly value: string;
}

/** Input accepted for a canonical import attribute. */
interface ModuleImportAttributeInput {
  readonly key: string;
  readonly value: string;
}

/** Active condition membership and resolver-observable order. */
interface ModuleConditionProfile {
  readonly activeSet: readonly string[];
  readonly observableSequence: readonly string[];
}

/** Input accepted for a module condition profile. */
interface ModuleConditionProfileInput {
  readonly activeSet: readonly string[];
  readonly observableSequence: readonly string[];
}

interface ModuleSemanticProfilePreimage {
  readonly schema: "dathra.module-semantic-profile/1";
  readonly definitionKind: ModuleDefinitionKind;
  readonly parseGoal: ModuleParseGoal;
  readonly transformPipelineDigest: Sha256Digest;
  readonly transformMetadataDigest: Sha256Digest;
  readonly loaderSemanticsDigest: Sha256Digest;
  readonly importMetaSemanticsDigest: Sha256Digest;
}

/** Non-byte semantics used to interpret transformed module content. */
type ModuleSemanticProfile = ModuleIdentityRecord<
  ModuleSemanticProfileId,
  ModuleSemanticProfilePreimage
>;

/** Input used to create a module semantic profile. */
type ModuleSemanticProfileInput = Omit<ModuleSemanticProfilePreimage, "schema">;

interface ModuleResolutionDomainPreimage {
  readonly schema: "dathra.module-resolution-domain/1";
  readonly targetEnvironmentId: string;
  readonly nativeModuleMapNamespaceDigest: Sha256Digest;
  readonly commonJsLoaderCacheNamespaceDigest: Sha256Digest;
  readonly resolverProfileDigest: Sha256Digest;
  readonly resolverInputTranscriptDigest: Sha256Digest;
  readonly moduleMapSemanticsDigest: Sha256Digest;
  readonly esmConditions: ModuleConditionProfile;
  readonly commonJsConditions: ModuleConditionProfile;
}

/** One resolver, Realm/module-map, and CommonJS cache namespace. */
type ModuleResolutionDomain = ModuleIdentityRecord<
  ModuleResolutionDomainId,
  ModuleResolutionDomainPreimage
>;

/** Input used to create a module resolution domain. */
interface ModuleResolutionDomainInput extends Omit<
  ModuleResolutionDomainPreimage,
  "schema" | "esmConditions" | "commonJsConditions"
> {
  readonly esmConditions: ModuleConditionProfileInput;
  readonly commonJsConditions: ModuleConditionProfileInput;
}

/** One normalized source request site before target resolution. */
interface ModuleRequestInventorySite {
  readonly kind: ModuleRequestSiteKind;
  readonly phase: ModuleImportPhase | null;
  readonly normalizedSyntaxDigest: Sha256Digest;
}

/** Input accepted for one source request site. */
interface ModuleRequestInventorySiteInput {
  readonly kind: ModuleRequestSiteKind;
  readonly phase: ModuleImportPhase | null;
  readonly normalizedSyntaxDigest: Sha256Digest;
}

interface ModuleRequestInventoryPreimage {
  readonly schema: "dathra.module-request-inventory/1";
  readonly transformedContentDigest: ModuleContentDigest;
  readonly semanticProfileId: ModuleSemanticProfileId;
  readonly extractorProfileDigest: Sha256Digest;
  readonly sites: readonly ModuleRequestInventorySite[];
}

/** Edge-independent source request inventory for transformed content. */
type ModuleRequestInventory = ModuleIdentityRecord<
  ModuleRequestInventoryId,
  ModuleRequestInventoryPreimage
>;

/** Input used to create a source request inventory. */
type ModuleRequestInventoryInput = Omit<
  ModuleRequestInventoryPreimage,
  "schema"
>;

interface ExternalModuleDefinitionContractPreimage {
  readonly schema: "dathra.external-module-definition-contract/1";
  readonly externalDefinitionKind: string;
  readonly definitionSemanticsDigest: Sha256Digest;
  readonly moduleSourceSemanticsDigest: Sha256Digest;
  readonly transitiveDependencyOwnershipDigest: Sha256Digest;
  readonly moduleBytesCorrespondenceDigest: Sha256Digest;
}

/** Domain-independent semantics required for an external definition. */
type ExternalModuleDefinitionContract = ModuleIdentityRecord<
  ExternalModuleDefinitionContractId,
  ExternalModuleDefinitionContractPreimage
>;

/** Input used to create an external definition contract. */
type ExternalModuleDefinitionContractInput = Omit<
  ExternalModuleDefinitionContractPreimage,
  "schema"
>;

interface ContentModuleDefinitionPreimage {
  readonly schema: "dathra.module-definition/1";
  readonly kind: "content";
  readonly canonicalSourceUrl: CanonicalModuleUrl;
  readonly sourceContentDigest: ModuleContentDigest;
  readonly transformedContentDigest: ModuleContentDigest;
  readonly semanticProfileId: ModuleSemanticProfileId;
  readonly requestInventoryId: ModuleRequestInventoryId;
}

interface ExternalModuleDefinitionPreimage {
  readonly schema: "dathra.module-definition/1";
  readonly kind: "external";
  readonly canonicalSourceUrl: CanonicalModuleUrl;
  readonly externalDefinitionContractId: ExternalModuleDefinitionContractId;
}

/** A content-backed or externally owned module definition. */
type ModuleDefinition = ModuleIdentityRecord<
  ModuleDefinitionId,
  ContentModuleDefinitionPreimage | ExternalModuleDefinitionPreimage
>;

/** Input used to create a content-backed module definition. */
interface ContentModuleDefinitionInput extends Omit<
  ContentModuleDefinitionPreimage,
  "schema" | "canonicalSourceUrl"
> {
  readonly sourceUrl: string;
}

/** Input used to create an external module definition. */
interface ExternalModuleDefinitionInput extends Omit<
  ExternalModuleDefinitionPreimage,
  "schema" | "canonicalSourceUrl"
> {
  readonly sourceUrl: string;
}

/** Input used to create a module definition. */
type ModuleDefinitionInput =
  | ContentModuleDefinitionInput
  | ExternalModuleDefinitionInput;

interface RuntimeModuleBindingPreimage {
  readonly schema: "dathra.runtime-module-binding/1";
  readonly resolutionDomainId: ModuleResolutionDomainId;
  readonly moduleDefinitionId: ModuleDefinitionId;
  readonly moduleBaseUrl: CanonicalModuleUrl;
  readonly runtimeModuleIdentityDigest: Sha256Digest;
}

/** Compiler identity for one runtime Module Record and its cached outcomes. */
type RuntimeModuleBinding = ModuleIdentityRecord<
  RuntimeModuleBindingId,
  RuntimeModuleBindingPreimage
>;

/** Input used to create a runtime module binding. */
type RuntimeModuleBindingInput = Omit<
  RuntimeModuleBindingPreimage,
  "schema" | "moduleBaseUrl"
> & { readonly moduleBaseUrl: string };

interface ModuleLoaderEntryPreimage {
  readonly schema: "dathra.module-loader-entry/1";
  readonly resolutionDomainId: ModuleResolutionDomainId;
  readonly namespaceKind: ModuleLoaderNamespaceKind;
  readonly moduleMapUrl: CanonicalModuleUrl;
  readonly moduleMapType: string;
  readonly effectiveAttributes: readonly ModuleImportAttribute[];
  readonly cacheKeyDigest: Sha256Digest;
  readonly runtimeBindingId: RuntimeModuleBindingId;
}

/** One native module-map or CommonJS loader-cache entry. */
type ModuleLoaderEntry = ModuleIdentityRecord<
  ModuleLoaderEntryId,
  ModuleLoaderEntryPreimage
>;

/** Input used to create a loader entry. */
interface ModuleLoaderEntryInput extends Omit<
  ModuleLoaderEntryPreimage,
  "schema" | "moduleMapUrl" | "effectiveAttributes"
> {
  readonly moduleMapUrl: string;
  readonly effectiveAttributes: readonly ModuleImportAttributeInput[];
}

interface NativeSemanticModuleRequestPreimage {
  readonly schema: "dathra.native-module-request/1";
  readonly kind: "native";
  readonly resolutionDomainId: ModuleResolutionDomainId;
  readonly importerRuntimeBindingId: RuntimeModuleBindingId;
  readonly phase: ModuleImportPhase;
  readonly specifier: string;
  readonly sourceAttributes: readonly ModuleImportAttribute[];
}

interface CommonJsSemanticModuleRequestPreimage {
  readonly schema: "dathra.commonjs-module-request/1";
  readonly kind: "commonjs";
  readonly resolutionDomainId: ModuleResolutionDomainId;
  readonly importerRuntimeBindingId: RuntimeModuleBindingId;
  readonly resolutionOriginUrl: CanonicalModuleUrl;
  readonly specifier: string;
}

/** A native ModuleRequest or CommonJS request before target resolution. */
type SemanticModuleRequest = ModuleIdentityRecord<
  SemanticModuleRequestId,
  NativeSemanticModuleRequestPreimage | CommonJsSemanticModuleRequestPreimage
>;

/** Input used to create a native semantic request. */
interface NativeSemanticModuleRequestInput extends Omit<
  NativeSemanticModuleRequestPreimage,
  "schema" | "sourceAttributes"
> {
  readonly sourceAttributes: readonly ModuleImportAttributeInput[];
}

/** Input used to create a CommonJS semantic request. */
interface CommonJsSemanticModuleRequestInput extends Omit<
  CommonJsSemanticModuleRequestPreimage,
  "schema" | "resolutionOriginUrl"
> {
  readonly resolutionOriginUrl: string;
}

/** Input used to create a semantic module request. */
type SemanticModuleRequestInput =
  | NativeSemanticModuleRequestInput
  | CommonJsSemanticModuleRequestInput;

interface NativeModuleResolutionEvidencePreimage {
  readonly schema: "dathra.native-module-resolution-evidence/1";
  readonly kind: "native";
  readonly semanticRequestId: SemanticModuleRequestId;
  readonly targetLoaderEntryId: ModuleLoaderEntryId;
  readonly observedConditionSequence: readonly string[];
  readonly effectiveAttributes: readonly ModuleImportAttribute[];
  readonly redirectEvidenceDigest: Sha256Digest;
  readonly resolverTraceDigest: Sha256Digest;
}

interface CommonJsModuleResolutionEvidencePreimage {
  readonly schema: "dathra.commonjs-module-resolution-evidence/1";
  readonly kind: "commonjs";
  readonly semanticRequestId: SemanticModuleRequestId;
  readonly targetLoaderEntryId: ModuleLoaderEntryId;
  readonly observedConditionSequence: readonly string[];
  readonly redirectEvidenceDigest: Sha256Digest;
  readonly resolverTraceDigest: Sha256Digest;
}

/** Structured resolver evidence for one semantic request. */
type ModuleResolutionEvidence = ModuleIdentityRecord<
  ModuleResolutionEvidenceId,
  | NativeModuleResolutionEvidencePreimage
  | CommonJsModuleResolutionEvidencePreimage
>;

/** Input used to create native resolution evidence. */
interface NativeModuleResolutionEvidenceInput extends Omit<
  NativeModuleResolutionEvidencePreimage,
  "schema" | "effectiveAttributes"
> {
  readonly effectiveAttributes: readonly ModuleImportAttributeInput[];
}

/** Input used to create CommonJS resolution evidence. */
type CommonJsModuleResolutionEvidenceInput = Omit<
  CommonJsModuleResolutionEvidencePreimage,
  "schema"
>;

/** Input used to create module resolution evidence. */
type ModuleResolutionEvidenceInput =
  | NativeModuleResolutionEvidenceInput
  | CommonJsModuleResolutionEvidenceInput;

interface ResolvedModuleRequestPreimage {
  readonly schema: "dathra.resolved-module-request/1";
  readonly kind: "native" | "commonjs";
  readonly semanticRequestId: SemanticModuleRequestId;
  readonly targetLoaderEntryId: ModuleLoaderEntryId;
  readonly resolutionEvidenceId: ModuleResolutionEvidenceId;
}

/** Exact association between a semantic request, target, and evidence. */
type ResolvedModuleRequest = ModuleIdentityRecord<
  ResolvedModuleRequestId,
  ResolvedModuleRequestPreimage
>;

/** Input used to create a resolved module request. */
type ResolvedModuleRequestInput = Omit<ResolvedModuleRequestPreimage, "schema">;

interface ExternalRuntimeClosureEvidencePreimage {
  readonly schema: "dathra.external-runtime-closure-evidence/1";
  readonly externalDefinitionContractId: ExternalModuleDefinitionContractId;
  readonly runtimeBindingId: RuntimeModuleBindingId;
  readonly loaderEntryIds: readonly ModuleLoaderEntryId[];
  readonly runtimeSemanticsDigest: Sha256Digest;
  readonly phaseCoherenceEvidenceDigest: Sha256Digest;
}

/** Concrete runtime evidence for one external module binding. */
type ExternalRuntimeClosureEvidence = ModuleIdentityRecord<
  ExternalRuntimeClosureEvidenceId,
  ExternalRuntimeClosureEvidencePreimage
>;

/** Input used to create external runtime closure evidence. */
type ExternalRuntimeClosureEvidenceInput = Omit<
  ExternalRuntimeClosureEvidencePreimage,
  "schema"
>;

interface ModuleRequestSiteEvidencePreimage {
  readonly schema: "dathra.module-request-site-evidence/1";
  readonly requestInventoryId: ModuleRequestInventoryId;
  readonly inventoryOrdinal: number;
  readonly normalizedSyntaxDigest: Sha256Digest;
  readonly importerRuntimeBindingId: RuntimeModuleBindingId;
  readonly semanticRequestIds: readonly SemanticModuleRequestId[];
  readonly candidateCoverageProofDigest: Sha256Digest;
}

/** Evidence binding one syntax site to its complete semantic request set. */
type ModuleRequestSiteEvidence = ModuleIdentityRecord<
  ModuleRequestSiteEvidenceId,
  ModuleRequestSiteEvidencePreimage
>;

/** Input used to create request-site evidence. */
type ModuleRequestSiteEvidenceInput = Omit<
  ModuleRequestSiteEvidencePreimage,
  "schema"
>;

interface ModuleRequestSitePreimage {
  readonly schema: "dathra.module-request-site/1";
  readonly resolutionDomainId: ModuleResolutionDomainId;
  readonly importerRuntimeBindingId: RuntimeModuleBindingId;
  readonly inventoryOrdinal: number;
  readonly kind: ModuleRequestSiteKind;
  readonly phase: ModuleImportPhase | null;
  readonly siteEvidenceId: ModuleRequestSiteEvidenceId;
  readonly resolvedRequestIds: readonly ResolvedModuleRequestId[];
}

/** One source request site and its finite resolved candidate set. */
type ModuleRequestSite = ModuleIdentityRecord<
  ModuleRequestSiteId,
  ModuleRequestSitePreimage
>;

/** Input used to create a module request site. */
type ModuleRequestSiteInput = Omit<ModuleRequestSitePreimage, "schema">;

interface ModuleGraphEntryPreimage {
  readonly schema: "dathra.module-graph-entry/1";
  readonly resolutionDomainId: ModuleResolutionDomainId;
  readonly entryOrdinal: number;
  readonly entryKind: string;
  readonly entryContextDigest: Sha256Digest;
  readonly loaderEntryId: ModuleLoaderEntryId;
}

/** One ordered module graph entry and its host admission context. */
type ModuleGraphEntry = ModuleIdentityRecord<
  ModuleGraphEntryId,
  ModuleGraphEntryPreimage
>;

/** Input used to create a module graph entry. */
type ModuleGraphEntryInput = Omit<ModuleGraphEntryPreimage, "schema">;

interface ModuleGraphSnapshotPreimage {
  readonly schema: "dathra.module-graph-snapshot/1";
  readonly semanticProfiles: readonly ModuleSemanticProfile[];
  readonly resolutionDomains: readonly ModuleResolutionDomain[];
  readonly requestInventories: readonly ModuleRequestInventory[];
  readonly externalDefinitionContracts: readonly ExternalModuleDefinitionContract[];
  readonly moduleDefinitions: readonly ModuleDefinition[];
  readonly runtimeBindings: readonly RuntimeModuleBinding[];
  readonly loaderEntries: readonly ModuleLoaderEntry[];
  readonly externalRuntimeEvidence: readonly ExternalRuntimeClosureEvidence[];
  readonly semanticRequests: readonly SemanticModuleRequest[];
  readonly resolutionEvidence: readonly ModuleResolutionEvidence[];
  readonly resolvedRequests: readonly ResolvedModuleRequest[];
  readonly requestSiteEvidence: readonly ModuleRequestSiteEvidence[];
  readonly requestSites: readonly ModuleRequestSite[];
  readonly entries: readonly ModuleGraphEntry[];
}

/** A canonical immutable module graph closure. */
type ModuleGraphSnapshot = ModuleIdentityRecord<
  ModuleGraphSnapshotId,
  ModuleGraphSnapshotPreimage
>;

/** Input used to create a canonical module graph snapshot. */
type ModuleGraphSnapshotInput = Omit<ModuleGraphSnapshotPreimage, "schema">;

type ValidationPath = readonly ModuleGraphPathSegment[];
type DataRecord = Record<string, unknown>;

const DEFINITION_PARSE_GOAL = {
  "ecmascript-module": "module",
  "ecmascript-script": "script",
  commonjs: "commonjs",
  json: "json",
  wasm: "wasm",
  css: "css",
  text: "text",
} as const satisfies Record<ModuleDefinitionKind, ModuleParseGoal>;

const RECORD_PARSE_CONCURRENCY = 32;

function formatPath(path: ValidationPath): string {
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : `${result}[${JSON.stringify(segment)}]`,
    "$",
  );
}

function fail(
  code: ModuleGraphErrorCode,
  path: ValidationPath,
  detail: string,
): never {
  throw new ModuleGraphError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null) return;

  const pending: object[] = [value];
  const visited = new WeakSet<object>();
  function enqueue(candidate: unknown): void {
    if (typeof candidate === "object" && candidate !== null) {
      pending.push(candidate);
    }
  }
  while (pending.length > 0) {
    const current = pending.pop();
    if (current === undefined || visited.has(current)) continue;
    visited.add(current);

    if (Array.isArray(current)) {
      for (const item of current) enqueue(item);
    } else {
      for (const key of Object.keys(current)) {
        const descriptor = Object.getOwnPropertyDescriptor(current, key);
        if (descriptor !== undefined && "value" in descriptor) {
          enqueue(descriptor.value);
        }
      }
    }

    Object.freeze(current);
  }
}

function snapshotClosed(value: unknown): unknown {
  try {
    const text = canonicalizeJson(value).text;
    const snapshot: unknown = JSON.parse(text);
    deepFreeze(snapshot);
    return snapshot;
  } catch (error) {
    if (error instanceof CanonicalIdentityError) {
      fail("invalid-closed-record", error.path, error.message);
    }
    throw error;
  }
}

function isDataRecord(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
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
  if (typeof value !== "string") {
    fail("invalid-field", path, "Expected a string");
  }
  return value;
}

function expectNonEmptyString(value: unknown, path: ValidationPath): string {
  const result = expectString(value, path);
  if (result.length === 0) {
    fail("invalid-field", path, "Expected a non-empty string");
  }
  return result;
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

function expectDigest(value: unknown, path: ValidationPath): Sha256Digest {
  if (!isSha256Digest(value)) {
    fail("invalid-field", path, "Expected a canonical SHA-256 digest");
  }
  return value;
}

function expectSafeOrdinal(value: unknown, path: ValidationPath): number {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 0) {
    fail("invalid-field", path, "Expected a non-negative safe integer");
  }
  return value;
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

function canonicalUrl(
  value: unknown,
  path: ValidationPath,
): CanonicalModuleUrl {
  const input = expectString(value, path);
  try {
    canonicalizeJson(input);
    return new URL(input).href as CanonicalModuleUrl;
  } catch (error) {
    if (error instanceof ModuleGraphError) throw error;
    fail("invalid-url", path, "Expected a well-formed absolute module URL");
  }
}

function parseUrl(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): CanonicalModuleUrl {
  const input = expectString(value, path);
  let result: CanonicalModuleUrl;
  try {
    canonicalizeJson(input);
    result = new URL(input).href as CanonicalModuleUrl;
  } catch {
    fail("invalid-url", path, "Expected a well-formed absolute module URL");
  }
  if (!normalize && result !== input) {
    fail("invalid-url", path, "Module URL is not canonical");
  }
  return result;
}

function parseAttributes(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): readonly ModuleImportAttribute[] {
  const attributes = expectArray(value, path).map((item, index) => {
    const itemPath = [...path, index];
    const record = expectRecord(item, itemPath, ["key", "value"]);
    return {
      key: expectString(record.key, [...itemPath, "key"]),
      value: expectString(record.value, [...itemPath, "value"]),
    };
  });
  const seen = new Set<string>();
  for (let index = 0; index < attributes.length; index += 1) {
    const key = attributes[index].key;
    if (seen.has(key)) {
      fail(
        "duplicate-record",
        [...path, index, "key"],
        "Duplicate attribute key",
      );
    }
    seen.add(key);
  }
  const sorted = [...attributes].sort((left, right) =>
    left.key < right.key ? -1 : left.key > right.key ? 1 : 0,
  );
  if (
    !normalize &&
    sorted.some((attribute, index) => attribute.key !== attributes[index].key)
  ) {
    fail("noncanonical-order", path, "Import attributes are not key-sorted");
  }
  deepFreeze(sorted);
  return sorted;
}

function parseStringCollection(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): readonly string[] {
  const values = expectArray(value, path).map((item, index) =>
    expectNonEmptyString(item, [...path, index]),
  );
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    if (seen.has(values[index])) {
      fail("duplicate-record", [...path, index], "Duplicate string value");
    }
    seen.add(values[index]);
  }
  const sorted = [...values].sort();
  if (!normalize && sorted.some((item, index) => item !== values[index])) {
    fail("noncanonical-order", path, "String set is not sorted");
  }
  return Object.freeze(sorted);
}

function parseSequence(
  value: unknown,
  path: ValidationPath,
): readonly string[] {
  const values = expectArray(value, path).map((item, index) =>
    expectNonEmptyString(item, [...path, index]),
  );
  return Object.freeze([...values]);
}

function parseConditionProfile(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ModuleConditionProfile {
  const record = expectRecord(value, path, ["activeSet", "observableSequence"]);
  const activeSet = parseStringCollection(
    record.activeSet,
    [...path, "activeSet"],
    normalize,
  );
  const observableSequence = parseSequence(record.observableSequence, [
    ...path,
    "observableSequence",
  ]);
  const observedMembership = new Set(observableSequence);
  if (
    activeSet.length !== observedMembership.size ||
    activeSet.some((condition) => !observedMembership.has(condition))
  ) {
    fail(
      "invalid-field",
      path,
      "Condition membership and observable sequence must contain the same values",
    );
  }
  const result = { activeSet, observableSequence };
  deepFreeze(result);
  return result;
}

function parseIdSet<Id extends Sha256Digest>(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): readonly Id[] {
  const values = expectArray(value, path).map(
    (item, index) => expectDigest(item, [...path, index]) as Id,
  );
  const seen = new Set<string>();
  for (let index = 0; index < values.length; index += 1) {
    if (seen.has(values[index])) {
      fail("duplicate-record", [...path, index], "Duplicate identity");
    }
    seen.add(values[index]);
  }
  const sorted = [...values].sort();
  if (!normalize && sorted.some((item, index) => item !== values[index])) {
    fail("noncanonical-order", path, "Identity set is not sorted");
  }
  return Object.freeze(sorted);
}

async function createIdentityRecord<Id, Preimage>(
  preimage: Preimage,
): Promise<ModuleIdentityRecord<Id, Preimage>> {
  const id = (await digestCanonicalJson(preimage)) as Id;
  const result = { id, preimage };
  deepFreeze(result);
  return result;
}

async function parseIdentityRecord<Id, Preimage>(
  value: unknown,
  path: ValidationPath,
  parsePreimage: (value: unknown, path: ValidationPath) => Preimage,
): Promise<ModuleIdentityRecord<Id, Preimage>> {
  const record = expectRecord(value, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  const preimage = parsePreimage(record.preimage, [...path, "preimage"]);
  const expected = await digestCanonicalJson(preimage);
  if (id !== expected) {
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

function parseSemanticProfilePreimage(
  value: unknown,
  path: ValidationPath,
): ModuleSemanticProfilePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "definitionKind",
    "parseGoal",
    "transformPipelineDigest",
    "transformMetadataDigest",
    "loaderSemanticsDigest",
    "importMetaSemanticsDigest",
  ]);
  const definitionKind = expectOneOf(
    record.definitionKind,
    [
      "ecmascript-module",
      "ecmascript-script",
      "commonjs",
      "json",
      "wasm",
      "css",
      "text",
    ] as const,
    [...path, "definitionKind"],
  );
  const parseGoal = expectOneOf(
    record.parseGoal,
    ["module", "script", "commonjs", "json", "wasm", "css", "text"] as const,
    [...path, "parseGoal"],
  );
  if (DEFINITION_PARSE_GOAL[definitionKind] !== parseGoal) {
    fail(
      "invalid-field",
      [...path, "parseGoal"],
      "Parse goal does not match definition kind",
    );
  }
  return {
    schema: expectLiteral(record.schema, "dathra.module-semantic-profile/1", [
      ...path,
      "schema",
    ]),
    definitionKind,
    parseGoal,
    transformPipelineDigest: expectDigest(record.transformPipelineDigest, [
      ...path,
      "transformPipelineDigest",
    ]),
    transformMetadataDigest: expectDigest(record.transformMetadataDigest, [
      ...path,
      "transformMetadataDigest",
    ]),
    loaderSemanticsDigest: expectDigest(record.loaderSemanticsDigest, [
      ...path,
      "loaderSemanticsDigest",
    ]),
    importMetaSemanticsDigest: expectDigest(record.importMetaSemanticsDigest, [
      ...path,
      "importMetaSemanticsDigest",
    ]),
  };
}

function parseResolutionDomainPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ModuleResolutionDomainPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "targetEnvironmentId",
    "nativeModuleMapNamespaceDigest",
    "commonJsLoaderCacheNamespaceDigest",
    "resolverProfileDigest",
    "resolverInputTranscriptDigest",
    "moduleMapSemanticsDigest",
    "esmConditions",
    "commonJsConditions",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.module-resolution-domain/1", [
      ...path,
      "schema",
    ]),
    targetEnvironmentId: expectNonEmptyString(record.targetEnvironmentId, [
      ...path,
      "targetEnvironmentId",
    ]),
    nativeModuleMapNamespaceDigest: expectDigest(
      record.nativeModuleMapNamespaceDigest,
      [...path, "nativeModuleMapNamespaceDigest"],
    ),
    commonJsLoaderCacheNamespaceDigest: expectDigest(
      record.commonJsLoaderCacheNamespaceDigest,
      [...path, "commonJsLoaderCacheNamespaceDigest"],
    ),
    resolverProfileDigest: expectDigest(record.resolverProfileDigest, [
      ...path,
      "resolverProfileDigest",
    ]),
    resolverInputTranscriptDigest: expectDigest(
      record.resolverInputTranscriptDigest,
      [...path, "resolverInputTranscriptDigest"],
    ),
    moduleMapSemanticsDigest: expectDigest(record.moduleMapSemanticsDigest, [
      ...path,
      "moduleMapSemanticsDigest",
    ]),
    esmConditions: parseConditionProfile(
      record.esmConditions,
      [...path, "esmConditions"],
      normalize,
    ),
    commonJsConditions: parseConditionProfile(
      record.commonJsConditions,
      [...path, "commonJsConditions"],
      normalize,
    ),
  };
}

function parseInventorySite(
  value: unknown,
  path: ValidationPath,
): ModuleRequestInventorySite {
  const record = expectRecord(value, path, [
    "kind",
    "phase",
    "normalizedSyntaxDigest",
  ]);
  const kind = expectOneOf(
    record.kind,
    [
      "static-import",
      "dynamic-import",
      "commonjs-require",
      "wasm-import",
      "css-import",
    ] as const,
    [...path, "kind"],
  );
  const phase =
    record.phase === null
      ? null
      : expectOneOf(record.phase, ["source", "evaluation"] as const, [
          ...path,
          "phase",
        ]);
  if ((kind === "commonjs-require") !== (phase === null)) {
    fail(
      "invalid-field",
      [...path, "phase"],
      "CommonJS sites require null phase and native sites require a phase",
    );
  }
  return {
    kind,
    phase,
    normalizedSyntaxDigest: expectDigest(record.normalizedSyntaxDigest, [
      ...path,
      "normalizedSyntaxDigest",
    ]),
  };
}

function parseInventoryPreimage(
  value: unknown,
  path: ValidationPath,
): ModuleRequestInventoryPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "transformedContentDigest",
    "semanticProfileId",
    "extractorProfileDigest",
    "sites",
  ]);
  const sites = expectArray(record.sites, [...path, "sites"]).map(
    (site, index) => parseInventorySite(site, [...path, "sites", index]),
  );
  return {
    schema: expectLiteral(record.schema, "dathra.module-request-inventory/1", [
      ...path,
      "schema",
    ]),
    transformedContentDigest: expectDigest(record.transformedContentDigest, [
      ...path,
      "transformedContentDigest",
    ]) as ModuleContentDigest,
    semanticProfileId: expectDigest(record.semanticProfileId, [
      ...path,
      "semanticProfileId",
    ]) as ModuleSemanticProfileId,
    extractorProfileDigest: expectDigest(record.extractorProfileDigest, [
      ...path,
      "extractorProfileDigest",
    ]),
    sites: Object.freeze(sites),
  };
}

function parseExternalContractPreimage(
  value: unknown,
  path: ValidationPath,
): ExternalModuleDefinitionContractPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "externalDefinitionKind",
    "definitionSemanticsDigest",
    "moduleSourceSemanticsDigest",
    "transitiveDependencyOwnershipDigest",
    "moduleBytesCorrespondenceDigest",
  ]);
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.external-module-definition-contract/1",
      [...path, "schema"],
    ),
    externalDefinitionKind: expectNonEmptyString(
      record.externalDefinitionKind,
      [...path, "externalDefinitionKind"],
    ),
    definitionSemanticsDigest: expectDigest(record.definitionSemanticsDigest, [
      ...path,
      "definitionSemanticsDigest",
    ]),
    moduleSourceSemanticsDigest: expectDigest(
      record.moduleSourceSemanticsDigest,
      [...path, "moduleSourceSemanticsDigest"],
    ),
    transitiveDependencyOwnershipDigest: expectDigest(
      record.transitiveDependencyOwnershipDigest,
      [...path, "transitiveDependencyOwnershipDigest"],
    ),
    moduleBytesCorrespondenceDigest: expectDigest(
      record.moduleBytesCorrespondenceDigest,
      [...path, "moduleBytesCorrespondenceDigest"],
    ),
  };
}

function parseDefinitionPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ContentModuleDefinitionPreimage | ExternalModuleDefinitionPreimage {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  const kind = expectOneOf(value.kind, ["content", "external"] as const, [
    ...path,
    "kind",
  ]);
  if (kind === "content") {
    const record = expectRecord(value, path, [
      "schema",
      "kind",
      "canonicalSourceUrl",
      "sourceContentDigest",
      "transformedContentDigest",
      "semanticProfileId",
      "requestInventoryId",
    ]);
    return {
      schema: expectLiteral(record.schema, "dathra.module-definition/1", [
        ...path,
        "schema",
      ]),
      kind,
      canonicalSourceUrl: parseUrl(
        record.canonicalSourceUrl,
        [...path, "canonicalSourceUrl"],
        normalize,
      ),
      sourceContentDigest: expectDigest(record.sourceContentDigest, [
        ...path,
        "sourceContentDigest",
      ]) as ModuleContentDigest,
      transformedContentDigest: expectDigest(record.transformedContentDigest, [
        ...path,
        "transformedContentDigest",
      ]) as ModuleContentDigest,
      semanticProfileId: expectDigest(record.semanticProfileId, [
        ...path,
        "semanticProfileId",
      ]) as ModuleSemanticProfileId,
      requestInventoryId: expectDigest(record.requestInventoryId, [
        ...path,
        "requestInventoryId",
      ]) as ModuleRequestInventoryId,
    };
  }
  const record = expectRecord(value, path, [
    "schema",
    "kind",
    "canonicalSourceUrl",
    "externalDefinitionContractId",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.module-definition/1", [
      ...path,
      "schema",
    ]),
    kind,
    canonicalSourceUrl: parseUrl(
      record.canonicalSourceUrl,
      [...path, "canonicalSourceUrl"],
      normalize,
    ),
    externalDefinitionContractId: expectDigest(
      record.externalDefinitionContractId,
      [...path, "externalDefinitionContractId"],
    ) as ExternalModuleDefinitionContractId,
  };
}

function parseRuntimeBindingPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): RuntimeModuleBindingPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "resolutionDomainId",
    "moduleDefinitionId",
    "moduleBaseUrl",
    "runtimeModuleIdentityDigest",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.runtime-module-binding/1", [
      ...path,
      "schema",
    ]),
    resolutionDomainId: expectDigest(record.resolutionDomainId, [
      ...path,
      "resolutionDomainId",
    ]) as ModuleResolutionDomainId,
    moduleDefinitionId: expectDigest(record.moduleDefinitionId, [
      ...path,
      "moduleDefinitionId",
    ]) as ModuleDefinitionId,
    moduleBaseUrl: parseUrl(
      record.moduleBaseUrl,
      [...path, "moduleBaseUrl"],
      normalize,
    ),
    runtimeModuleIdentityDigest: expectDigest(
      record.runtimeModuleIdentityDigest,
      [...path, "runtimeModuleIdentityDigest"],
    ),
  };
}

function parseLoaderEntryPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ModuleLoaderEntryPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "resolutionDomainId",
    "namespaceKind",
    "moduleMapUrl",
    "moduleMapType",
    "effectiveAttributes",
    "cacheKeyDigest",
    "runtimeBindingId",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.module-loader-entry/1", [
      ...path,
      "schema",
    ]),
    resolutionDomainId: expectDigest(record.resolutionDomainId, [
      ...path,
      "resolutionDomainId",
    ]) as ModuleResolutionDomainId,
    namespaceKind: expectOneOf(
      record.namespaceKind,
      ["native", "commonjs"] as const,
      [...path, "namespaceKind"],
    ),
    moduleMapUrl: parseUrl(
      record.moduleMapUrl,
      [...path, "moduleMapUrl"],
      normalize,
    ),
    moduleMapType: expectNonEmptyString(record.moduleMapType, [
      ...path,
      "moduleMapType",
    ]),
    effectiveAttributes: parseAttributes(
      record.effectiveAttributes,
      [...path, "effectiveAttributes"],
      normalize,
    ),
    cacheKeyDigest: expectDigest(record.cacheKeyDigest, [
      ...path,
      "cacheKeyDigest",
    ]),
    runtimeBindingId: expectDigest(record.runtimeBindingId, [
      ...path,
      "runtimeBindingId",
    ]) as RuntimeModuleBindingId,
  };
}

function parseSemanticRequestPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): NativeSemanticModuleRequestPreimage | CommonJsSemanticModuleRequestPreimage {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  const kind = expectOneOf(value.kind, ["native", "commonjs"] as const, [
    ...path,
    "kind",
  ]);
  if (kind === "native") {
    const record = expectRecord(value, path, [
      "schema",
      "kind",
      "resolutionDomainId",
      "importerRuntimeBindingId",
      "phase",
      "specifier",
      "sourceAttributes",
    ]);
    return {
      schema: expectLiteral(record.schema, "dathra.native-module-request/1", [
        ...path,
        "schema",
      ]),
      kind,
      resolutionDomainId: expectDigest(record.resolutionDomainId, [
        ...path,
        "resolutionDomainId",
      ]) as ModuleResolutionDomainId,
      importerRuntimeBindingId: expectDigest(record.importerRuntimeBindingId, [
        ...path,
        "importerRuntimeBindingId",
      ]) as RuntimeModuleBindingId,
      phase: expectOneOf(record.phase, ["source", "evaluation"] as const, [
        ...path,
        "phase",
      ]),
      specifier: expectString(record.specifier, [...path, "specifier"]),
      sourceAttributes: parseAttributes(
        record.sourceAttributes,
        [...path, "sourceAttributes"],
        normalize,
      ),
    };
  }
  const record = expectRecord(value, path, [
    "schema",
    "kind",
    "resolutionDomainId",
    "importerRuntimeBindingId",
    "resolutionOriginUrl",
    "specifier",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.commonjs-module-request/1", [
      ...path,
      "schema",
    ]),
    kind,
    resolutionDomainId: expectDigest(record.resolutionDomainId, [
      ...path,
      "resolutionDomainId",
    ]) as ModuleResolutionDomainId,
    importerRuntimeBindingId: expectDigest(record.importerRuntimeBindingId, [
      ...path,
      "importerRuntimeBindingId",
    ]) as RuntimeModuleBindingId,
    resolutionOriginUrl: parseUrl(
      record.resolutionOriginUrl,
      [...path, "resolutionOriginUrl"],
      normalize,
    ),
    specifier: expectString(record.specifier, [...path, "specifier"]),
  };
}

function parseResolutionEvidencePreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
):
  | NativeModuleResolutionEvidencePreimage
  | CommonJsModuleResolutionEvidencePreimage {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  const kind = expectOneOf(value.kind, ["native", "commonjs"] as const, [
    ...path,
    "kind",
  ]);
  if (kind === "native") {
    const record = expectRecord(value, path, [
      "schema",
      "kind",
      "semanticRequestId",
      "targetLoaderEntryId",
      "observedConditionSequence",
      "effectiveAttributes",
      "redirectEvidenceDigest",
      "resolverTraceDigest",
    ]);
    return {
      schema: expectLiteral(
        record.schema,
        "dathra.native-module-resolution-evidence/1",
        [...path, "schema"],
      ),
      kind,
      semanticRequestId: expectDigest(record.semanticRequestId, [
        ...path,
        "semanticRequestId",
      ]) as SemanticModuleRequestId,
      targetLoaderEntryId: expectDigest(record.targetLoaderEntryId, [
        ...path,
        "targetLoaderEntryId",
      ]) as ModuleLoaderEntryId,
      observedConditionSequence: parseSequence(
        record.observedConditionSequence,
        [...path, "observedConditionSequence"],
      ),
      effectiveAttributes: parseAttributes(
        record.effectiveAttributes,
        [...path, "effectiveAttributes"],
        normalize,
      ),
      redirectEvidenceDigest: expectDigest(record.redirectEvidenceDigest, [
        ...path,
        "redirectEvidenceDigest",
      ]),
      resolverTraceDigest: expectDigest(record.resolverTraceDigest, [
        ...path,
        "resolverTraceDigest",
      ]),
    };
  }
  const record = expectRecord(value, path, [
    "schema",
    "kind",
    "semanticRequestId",
    "targetLoaderEntryId",
    "observedConditionSequence",
    "redirectEvidenceDigest",
    "resolverTraceDigest",
  ]);
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.commonjs-module-resolution-evidence/1",
      [...path, "schema"],
    ),
    kind,
    semanticRequestId: expectDigest(record.semanticRequestId, [
      ...path,
      "semanticRequestId",
    ]) as SemanticModuleRequestId,
    targetLoaderEntryId: expectDigest(record.targetLoaderEntryId, [
      ...path,
      "targetLoaderEntryId",
    ]) as ModuleLoaderEntryId,
    observedConditionSequence: parseSequence(record.observedConditionSequence, [
      ...path,
      "observedConditionSequence",
    ]),
    redirectEvidenceDigest: expectDigest(record.redirectEvidenceDigest, [
      ...path,
      "redirectEvidenceDigest",
    ]),
    resolverTraceDigest: expectDigest(record.resolverTraceDigest, [
      ...path,
      "resolverTraceDigest",
    ]),
  };
}

function parseResolvedRequestPreimage(
  value: unknown,
  path: ValidationPath,
): ResolvedModuleRequestPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "kind",
    "semanticRequestId",
    "targetLoaderEntryId",
    "resolutionEvidenceId",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.resolved-module-request/1", [
      ...path,
      "schema",
    ]),
    kind: expectOneOf(record.kind, ["native", "commonjs"] as const, [
      ...path,
      "kind",
    ]),
    semanticRequestId: expectDigest(record.semanticRequestId, [
      ...path,
      "semanticRequestId",
    ]) as SemanticModuleRequestId,
    targetLoaderEntryId: expectDigest(record.targetLoaderEntryId, [
      ...path,
      "targetLoaderEntryId",
    ]) as ModuleLoaderEntryId,
    resolutionEvidenceId: expectDigest(record.resolutionEvidenceId, [
      ...path,
      "resolutionEvidenceId",
    ]) as ModuleResolutionEvidenceId,
  };
}

function parseExternalRuntimeEvidencePreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ExternalRuntimeClosureEvidencePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "externalDefinitionContractId",
    "runtimeBindingId",
    "loaderEntryIds",
    "runtimeSemanticsDigest",
    "phaseCoherenceEvidenceDigest",
  ]);
  const loaderEntryIds = parseIdSet<ModuleLoaderEntryId>(
    record.loaderEntryIds,
    [...path, "loaderEntryIds"],
    normalize,
  );
  if (loaderEntryIds.length === 0) {
    fail(
      "invalid-field",
      [...path, "loaderEntryIds"],
      "Expected at least one loader entry",
    );
  }
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.external-runtime-closure-evidence/1",
      [...path, "schema"],
    ),
    externalDefinitionContractId: expectDigest(
      record.externalDefinitionContractId,
      [...path, "externalDefinitionContractId"],
    ) as ExternalModuleDefinitionContractId,
    runtimeBindingId: expectDigest(record.runtimeBindingId, [
      ...path,
      "runtimeBindingId",
    ]) as RuntimeModuleBindingId,
    loaderEntryIds,
    runtimeSemanticsDigest: expectDigest(record.runtimeSemanticsDigest, [
      ...path,
      "runtimeSemanticsDigest",
    ]),
    phaseCoherenceEvidenceDigest: expectDigest(
      record.phaseCoherenceEvidenceDigest,
      [...path, "phaseCoherenceEvidenceDigest"],
    ),
  };
}

function parseSiteEvidencePreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ModuleRequestSiteEvidencePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "requestInventoryId",
    "inventoryOrdinal",
    "normalizedSyntaxDigest",
    "importerRuntimeBindingId",
    "semanticRequestIds",
    "candidateCoverageProofDigest",
  ]);
  const semanticRequestIds = parseIdSet<SemanticModuleRequestId>(
    record.semanticRequestIds,
    [...path, "semanticRequestIds"],
    normalize,
  );
  if (semanticRequestIds.length === 0) {
    fail(
      "invalid-field",
      [...path, "semanticRequestIds"],
      "Expected at least one semantic request",
    );
  }
  return {
    schema: expectLiteral(
      record.schema,
      "dathra.module-request-site-evidence/1",
      [...path, "schema"],
    ),
    requestInventoryId: expectDigest(record.requestInventoryId, [
      ...path,
      "requestInventoryId",
    ]) as ModuleRequestInventoryId,
    inventoryOrdinal: expectSafeOrdinal(record.inventoryOrdinal, [
      ...path,
      "inventoryOrdinal",
    ]),
    normalizedSyntaxDigest: expectDigest(record.normalizedSyntaxDigest, [
      ...path,
      "normalizedSyntaxDigest",
    ]),
    importerRuntimeBindingId: expectDigest(record.importerRuntimeBindingId, [
      ...path,
      "importerRuntimeBindingId",
    ]) as RuntimeModuleBindingId,
    semanticRequestIds,
    candidateCoverageProofDigest: expectDigest(
      record.candidateCoverageProofDigest,
      [...path, "candidateCoverageProofDigest"],
    ),
  };
}

function parseSitePreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
): ModuleRequestSitePreimage {
  const record = expectRecord(value, path, [
    "schema",
    "resolutionDomainId",
    "importerRuntimeBindingId",
    "inventoryOrdinal",
    "kind",
    "phase",
    "siteEvidenceId",
    "resolvedRequestIds",
  ]);
  const kind = expectOneOf(
    record.kind,
    [
      "static-import",
      "dynamic-import",
      "commonjs-require",
      "wasm-import",
      "css-import",
    ] as const,
    [...path, "kind"],
  );
  const phase =
    record.phase === null
      ? null
      : expectOneOf(record.phase, ["source", "evaluation"] as const, [
          ...path,
          "phase",
        ]);
  if ((kind === "commonjs-require") !== (phase === null)) {
    fail(
      "invalid-field",
      [...path, "phase"],
      "Site kind and phase do not match",
    );
  }
  const resolvedRequestIds = parseIdSet<ResolvedModuleRequestId>(
    record.resolvedRequestIds,
    [...path, "resolvedRequestIds"],
    normalize,
  );
  if (resolvedRequestIds.length === 0) {
    fail(
      "invalid-field",
      [...path, "resolvedRequestIds"],
      "Expected at least one resolved request",
    );
  }
  if (
    kind !== "dynamic-import" &&
    kind !== "commonjs-require" &&
    resolvedRequestIds.length !== 1
  ) {
    fail(
      "invalid-field",
      [...path, "resolvedRequestIds"],
      "Static site must have exactly one request",
    );
  }
  return {
    schema: expectLiteral(record.schema, "dathra.module-request-site/1", [
      ...path,
      "schema",
    ]),
    resolutionDomainId: expectDigest(record.resolutionDomainId, [
      ...path,
      "resolutionDomainId",
    ]) as ModuleResolutionDomainId,
    importerRuntimeBindingId: expectDigest(record.importerRuntimeBindingId, [
      ...path,
      "importerRuntimeBindingId",
    ]) as RuntimeModuleBindingId,
    inventoryOrdinal: expectSafeOrdinal(record.inventoryOrdinal, [
      ...path,
      "inventoryOrdinal",
    ]),
    kind,
    phase,
    siteEvidenceId: expectDigest(record.siteEvidenceId, [
      ...path,
      "siteEvidenceId",
    ]) as ModuleRequestSiteEvidenceId,
    resolvedRequestIds,
  };
}

function parseEntryPreimage(
  value: unknown,
  path: ValidationPath,
): ModuleGraphEntryPreimage {
  const record = expectRecord(value, path, [
    "schema",
    "resolutionDomainId",
    "entryOrdinal",
    "entryKind",
    "entryContextDigest",
    "loaderEntryId",
  ]);
  return {
    schema: expectLiteral(record.schema, "dathra.module-graph-entry/1", [
      ...path,
      "schema",
    ]),
    resolutionDomainId: expectDigest(record.resolutionDomainId, [
      ...path,
      "resolutionDomainId",
    ]) as ModuleResolutionDomainId,
    entryOrdinal: expectSafeOrdinal(record.entryOrdinal, [
      ...path,
      "entryOrdinal",
    ]),
    entryKind: expectNonEmptyString(record.entryKind, [...path, "entryKind"]),
    entryContextDigest: expectDigest(record.entryContextDigest, [
      ...path,
      "entryContextDigest",
    ]),
    loaderEntryId: expectDigest(record.loaderEntryId, [
      ...path,
      "loaderEntryId",
    ]) as ModuleLoaderEntryId,
  };
}

async function parseRecordArray<Id extends Sha256Digest, Preimage>(
  value: unknown,
  path: ValidationPath,
  parser: (
    value: unknown,
    path: ValidationPath,
  ) => Promise<ModuleIdentityRecord<Id, Preimage>>,
  normalize: boolean,
): Promise<readonly ModuleIdentityRecord<Id, Preimage>[]> {
  const input = expectArray(value, path);
  const seen = new Set<string>();
  for (let index = 0; index < input.length; index += 1) {
    const itemPath = [...path, index];
    const record = expectRecord(input[index], itemPath, ["id", "preimage"]);
    const id = expectDigest(record.id, [...itemPath, "id"]);
    if (seen.has(id)) {
      fail("duplicate-record", [...path, index, "id"], "Duplicate record ID");
    }
    seen.add(id);
  }

  const records: ModuleIdentityRecord<Id, Preimage>[] = [];
  let nextIndex = 0;
  let stopped = false;
  async function parseNext(): Promise<void> {
    while (!stopped) {
      const index = nextIndex;
      nextIndex += 1;
      if (index >= input.length) return;
      try {
        records[index] = await parser(input[index], [...path, index]);
      } catch (error) {
        stopped = true;
        throw error;
      }
    }
  }
  const workerCount = Math.min(input.length, RECORD_PARSE_CONCURRENCY);
  await Promise.all(
    Array.from({ length: workerCount }, async () => await parseNext()),
  );

  const sorted = [...records].sort((left, right) =>
    left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
  );
  if (
    !normalize &&
    sorted.some((record, index) => record.id !== records[index].id)
  ) {
    fail("noncanonical-order", path, "Record array is not ID-sorted");
  }
  deepFreeze(sorted);
  return sorted;
}

async function parseSemanticProfileRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleSemanticProfile> {
  return await parseIdentityRecord(value, path, parseSemanticProfilePreimage);
}

async function parseResolutionDomainRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleResolutionDomain> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseResolutionDomainPreimage(preimage, preimagePath, false),
  );
}

async function parseInventoryRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleRequestInventory> {
  return await parseIdentityRecord(value, path, parseInventoryPreimage);
}

async function parseExternalContractRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ExternalModuleDefinitionContract> {
  return await parseIdentityRecord(value, path, parseExternalContractPreimage);
}

async function parseDefinitionRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleDefinition> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseDefinitionPreimage(preimage, preimagePath, false),
  );
}

async function parseRuntimeBindingRecord(
  value: unknown,
  path: ValidationPath,
): Promise<RuntimeModuleBinding> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseRuntimeBindingPreimage(preimage, preimagePath, false),
  );
}

async function parseLoaderEntryRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleLoaderEntry> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseLoaderEntryPreimage(preimage, preimagePath, false),
  );
}

async function parseSemanticRequestRecord(
  value: unknown,
  path: ValidationPath,
): Promise<SemanticModuleRequest> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseSemanticRequestPreimage(preimage, preimagePath, false),
  );
}

async function parseResolutionEvidenceRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleResolutionEvidence> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseResolutionEvidencePreimage(preimage, preimagePath, false),
  );
}

async function parseResolvedRequestRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ResolvedModuleRequest> {
  return await parseIdentityRecord(value, path, parseResolvedRequestPreimage);
}

async function parseExternalRuntimeEvidenceRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ExternalRuntimeClosureEvidence> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseExternalRuntimeEvidencePreimage(preimage, preimagePath, false),
  );
}

async function parseSiteEvidenceRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleRequestSiteEvidence> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseSiteEvidencePreimage(preimage, preimagePath, false),
  );
}

async function parseSiteRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleRequestSite> {
  return await parseIdentityRecord(value, path, (preimage, preimagePath) =>
    parseSitePreimage(preimage, preimagePath, false),
  );
}

async function parseEntryRecord(
  value: unknown,
  path: ValidationPath,
): Promise<ModuleGraphEntry> {
  return await parseIdentityRecord(value, path, parseEntryPreimage);
}

async function parseSnapshotPreimage(
  value: unknown,
  path: ValidationPath,
  normalize: boolean,
  includeSchema: boolean,
): Promise<ModuleGraphSnapshotPreimage> {
  const fields = [
    ...(includeSchema ? ["schema"] : []),
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
  ];
  const record = expectRecord(value, path, fields);
  if (includeSchema) {
    expectLiteral(record.schema, "dathra.module-graph-snapshot/1", [
      ...path,
      "schema",
    ]);
  }
  const semanticProfiles = (await parseRecordArray(
    record.semanticProfiles,
    [...path, "semanticProfiles"],
    parseSemanticProfileRecord,
    normalize,
  )) as readonly ModuleSemanticProfile[];
  const resolutionDomains = (await parseRecordArray(
    record.resolutionDomains,
    [...path, "resolutionDomains"],
    parseResolutionDomainRecord,
    normalize,
  )) as readonly ModuleResolutionDomain[];
  const requestInventories = (await parseRecordArray(
    record.requestInventories,
    [...path, "requestInventories"],
    parseInventoryRecord,
    normalize,
  )) as readonly ModuleRequestInventory[];
  const externalDefinitionContracts = (await parseRecordArray(
    record.externalDefinitionContracts,
    [...path, "externalDefinitionContracts"],
    parseExternalContractRecord,
    normalize,
  )) as readonly ExternalModuleDefinitionContract[];
  const moduleDefinitions = (await parseRecordArray(
    record.moduleDefinitions,
    [...path, "moduleDefinitions"],
    parseDefinitionRecord,
    normalize,
  )) as readonly ModuleDefinition[];
  const runtimeBindings = (await parseRecordArray(
    record.runtimeBindings,
    [...path, "runtimeBindings"],
    parseRuntimeBindingRecord,
    normalize,
  )) as readonly RuntimeModuleBinding[];
  const loaderEntries = (await parseRecordArray(
    record.loaderEntries,
    [...path, "loaderEntries"],
    parseLoaderEntryRecord,
    normalize,
  )) as readonly ModuleLoaderEntry[];
  const externalRuntimeEvidence = (await parseRecordArray(
    record.externalRuntimeEvidence,
    [...path, "externalRuntimeEvidence"],
    parseExternalRuntimeEvidenceRecord,
    normalize,
  )) as readonly ExternalRuntimeClosureEvidence[];
  const semanticRequests = (await parseRecordArray(
    record.semanticRequests,
    [...path, "semanticRequests"],
    parseSemanticRequestRecord,
    normalize,
  )) as readonly SemanticModuleRequest[];
  const resolutionEvidence = (await parseRecordArray(
    record.resolutionEvidence,
    [...path, "resolutionEvidence"],
    parseResolutionEvidenceRecord,
    normalize,
  )) as readonly ModuleResolutionEvidence[];
  const resolvedRequests = (await parseRecordArray(
    record.resolvedRequests,
    [...path, "resolvedRequests"],
    parseResolvedRequestRecord,
    normalize,
  )) as readonly ResolvedModuleRequest[];
  const requestSiteEvidence = (await parseRecordArray(
    record.requestSiteEvidence,
    [...path, "requestSiteEvidence"],
    parseSiteEvidenceRecord,
    normalize,
  )) as readonly ModuleRequestSiteEvidence[];
  const requestSites = (await parseRecordArray(
    record.requestSites,
    [...path, "requestSites"],
    parseSiteRecord,
    normalize,
  )) as readonly ModuleRequestSite[];
  const entries = (await parseRecordArray(
    record.entries,
    [...path, "entries"],
    parseEntryRecord,
    normalize,
  )) as readonly ModuleGraphEntry[];
  return {
    schema: "dathra.module-graph-snapshot/1",
    semanticProfiles,
    resolutionDomains,
    requestInventories,
    externalDefinitionContracts,
    moduleDefinitions,
    runtimeBindings,
    loaderEntries,
    externalRuntimeEvidence,
    semanticRequests,
    resolutionEvidence,
    resolvedRequests,
    requestSiteEvidence,
    requestSites,
    entries,
  };
}

function byId<RecordType extends { readonly id: string }>(
  records: readonly RecordType[],
): Map<string, RecordType> {
  return new Map(records.map((record) => [record.id, record]));
}

function requireReference<RecordType>(
  records: ReadonlyMap<string, RecordType>,
  id: string,
  path: ValidationPath,
): RecordType {
  const record = records.get(id);
  if (record === undefined) {
    fail("dangling-reference", path, `Unknown referenced ID ${id}`);
  }
  return record;
}

function equalCanonical(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left).text === canonicalizeJson(right).text;
}

function requireSameSet(
  actual: readonly string[],
  expected: readonly string[],
  path: ValidationPath,
  code: ModuleGraphErrorCode,
  detail: string,
): void {
  if (
    actual.length !== expected.length ||
    actual.some((value, index) => value !== expected[index])
  ) {
    fail(code, path, detail);
  }
}

function validateSnapshotGraph(snapshot: ModuleGraphSnapshotPreimage): void {
  if (
    snapshot.resolutionDomains.length === 0 ||
    snapshot.entries.length === 0
  ) {
    fail(
      "invalid-field",
      [],
      "Snapshot requires at least one domain and entry",
    );
  }

  const profiles = byId(snapshot.semanticProfiles);
  const domains = byId(snapshot.resolutionDomains);
  const inventories = byId(snapshot.requestInventories);
  const externalContracts = byId(snapshot.externalDefinitionContracts);
  const definitions = byId(snapshot.moduleDefinitions);
  const bindings = byId(snapshot.runtimeBindings);
  const loaderEntries = byId(snapshot.loaderEntries);
  const externalEvidence = byId(snapshot.externalRuntimeEvidence);
  const requests = byId(snapshot.semanticRequests);
  const resolutionEvidence = byId(snapshot.resolutionEvidence);
  const resolvedRequests = byId(snapshot.resolvedRequests);
  const siteEvidence = byId(snapshot.requestSiteEvidence);

  const usedProfileIds = new Set<string>();
  const usedInventoryIds = new Set<string>();
  const usedExternalContractIds = new Set<string>();
  for (const inventory of snapshot.requestInventories) {
    requireReference(profiles, inventory.preimage.semanticProfileId, [
      "requestInventories",
      inventory.id,
      "semanticProfileId",
    ]);
  }
  for (const definition of snapshot.moduleDefinitions) {
    if (definition.preimage.kind === "content") {
      const profile = requireReference(
        profiles,
        definition.preimage.semanticProfileId,
        ["moduleDefinitions", definition.id, "semanticProfileId"],
      );
      const inventory = requireReference(
        inventories,
        definition.preimage.requestInventoryId,
        ["moduleDefinitions", definition.id, "requestInventoryId"],
      );
      if (
        inventory.preimage.semanticProfileId !== profile.id ||
        inventory.preimage.transformedContentDigest !==
          definition.preimage.transformedContentDigest
      ) {
        fail(
          "identity-conflict",
          ["moduleDefinitions", definition.id],
          "Definition and request inventory do not match",
        );
      }
      usedProfileIds.add(profile.id);
      usedInventoryIds.add(inventory.id);
    } else {
      requireReference(
        externalContracts,
        definition.preimage.externalDefinitionContractId,
        ["moduleDefinitions", definition.id, "externalDefinitionContractId"],
      );
      usedExternalContractIds.add(
        definition.preimage.externalDefinitionContractId,
      );
    }
  }

  const usedDefinitionIds = new Set<string>();
  const usedDomainIds = new Set<string>();
  const runtimeIdentityOwners = new Map<string, RuntimeModuleBinding>();
  for (const binding of snapshot.runtimeBindings) {
    requireReference(domains, binding.preimage.resolutionDomainId, [
      "runtimeBindings",
      binding.id,
      "resolutionDomainId",
    ]);
    requireReference(definitions, binding.preimage.moduleDefinitionId, [
      "runtimeBindings",
      binding.id,
      "moduleDefinitionId",
    ]);
    const identityKey = `${binding.preimage.resolutionDomainId}\u0000${binding.preimage.runtimeModuleIdentityDigest}`;
    const existing = runtimeIdentityOwners.get(identityKey);
    if (existing !== undefined && existing.id !== binding.id) {
      fail(
        "identity-conflict",
        ["runtimeBindings", binding.id],
        "Runtime module identity has multiple bindings",
      );
    }
    runtimeIdentityOwners.set(identityKey, binding);
    usedDefinitionIds.add(binding.preimage.moduleDefinitionId);
    usedDomainIds.add(binding.preimage.resolutionDomainId);
  }

  const loaderEntriesByBinding = new Map<string, ModuleLoaderEntry[]>();
  const loaderTupleOwners = new Map<string, string>();
  const cacheKeyOwners = new Map<string, string>();
  for (const loaderEntry of snapshot.loaderEntries) {
    const binding = requireReference(
      bindings,
      loaderEntry.preimage.runtimeBindingId,
      ["loaderEntries", loaderEntry.id, "runtimeBindingId"],
    );
    requireReference(domains, loaderEntry.preimage.resolutionDomainId, [
      "loaderEntries",
      loaderEntry.id,
      "resolutionDomainId",
    ]);
    if (
      binding.preimage.resolutionDomainId !==
      loaderEntry.preimage.resolutionDomainId
    ) {
      fail(
        "domain-mismatch",
        ["loaderEntries", loaderEntry.id],
        "Loader entry and runtime binding domains differ",
      );
    }
    const tupleKey = canonicalizeJson({
      domain: loaderEntry.preimage.resolutionDomainId,
      namespace: loaderEntry.preimage.namespaceKind,
      url: loaderEntry.preimage.moduleMapUrl,
      type: loaderEntry.preimage.moduleMapType,
      attributes: loaderEntry.preimage.effectiveAttributes,
    }).text;
    const cacheKey = `${loaderEntry.preimage.resolutionDomainId}\u0000${loaderEntry.preimage.namespaceKind}\u0000${loaderEntry.preimage.cacheKeyDigest}`;
    const tupleOwner = loaderTupleOwners.get(tupleKey);
    if (tupleOwner !== undefined && tupleOwner !== loaderEntry.id) {
      fail(
        "identity-conflict",
        ["loaderEntries", loaderEntry.id],
        "Module-map key has multiple loader entries",
      );
    }
    const cacheOwner = cacheKeyOwners.get(cacheKey);
    if (cacheOwner !== undefined && cacheOwner !== loaderEntry.id) {
      fail(
        "identity-conflict",
        ["loaderEntries", loaderEntry.id],
        "Host cache key has multiple loader entries",
      );
    }
    loaderTupleOwners.set(tupleKey, loaderEntry.id);
    cacheKeyOwners.set(cacheKey, loaderEntry.id);
    const entries = loaderEntriesByBinding.get(binding.id) ?? [];
    entries.push(loaderEntry);
    loaderEntriesByBinding.set(binding.id, entries);
  }

  const externalEvidenceByBinding = new Map<
    string,
    ExternalRuntimeClosureEvidence
  >();
  for (const evidence of snapshot.externalRuntimeEvidence) {
    const binding = requireReference(
      bindings,
      evidence.preimage.runtimeBindingId,
      ["externalRuntimeEvidence", evidence.id, "runtimeBindingId"],
    );
    const definition = requireReference(
      definitions,
      binding.preimage.moduleDefinitionId,
      ["externalRuntimeEvidence", evidence.id, "runtimeBindingId"],
    );
    if (definition.preimage.kind !== "external") {
      fail(
        "external-contract-mismatch",
        ["externalRuntimeEvidence", evidence.id],
        "Content binding cannot have external evidence",
      );
    }
    if (
      definition.preimage.externalDefinitionContractId !==
      evidence.preimage.externalDefinitionContractId
    ) {
      fail(
        "external-contract-mismatch",
        ["externalRuntimeEvidence", evidence.id],
        "External definition contract does not match binding",
      );
    }
    requireReference(
      externalContracts,
      evidence.preimage.externalDefinitionContractId,
      ["externalRuntimeEvidence", evidence.id, "externalDefinitionContractId"],
    );
    const expectedLoaderIds = (loaderEntriesByBinding.get(binding.id) ?? [])
      .map((entry) => entry.id)
      .sort();
    requireSameSet(
      evidence.preimage.loaderEntryIds,
      expectedLoaderIds,
      ["externalRuntimeEvidence", evidence.id, "loaderEntryIds"],
      "external-contract-mismatch",
      "External evidence must bind every loader entry for the runtime binding",
    );
    if (externalEvidenceByBinding.has(binding.id)) {
      fail(
        "external-contract-mismatch",
        ["externalRuntimeEvidence", evidence.id],
        "External binding has duplicate evidence",
      );
    }
    externalEvidenceByBinding.set(binding.id, evidence);
  }
  for (const binding of snapshot.runtimeBindings) {
    const definition = requireReference(
      definitions,
      binding.preimage.moduleDefinitionId,
      [],
    );
    if (
      definition.preimage.kind === "external" &&
      !externalEvidenceByBinding.has(binding.id)
    ) {
      fail(
        "external-contract-mismatch",
        ["runtimeBindings", binding.id],
        "External binding is missing runtime closure evidence",
      );
    }
  }

  for (const request of snapshot.semanticRequests) {
    const domain = requireReference(
      domains,
      request.preimage.resolutionDomainId,
      ["semanticRequests", request.id, "resolutionDomainId"],
    );
    const importer = requireReference(
      bindings,
      request.preimage.importerRuntimeBindingId,
      ["semanticRequests", request.id, "importerRuntimeBindingId"],
    );
    if (importer.preimage.resolutionDomainId !== domain.id) {
      fail(
        "domain-mismatch",
        ["semanticRequests", request.id],
        "Request and importer domains differ",
      );
    }
    const definition = requireReference(
      definitions,
      importer.preimage.moduleDefinitionId,
      [],
    );
    if (definition.preimage.kind === "external") {
      fail(
        "external-contract-mismatch",
        ["semanticRequests", request.id],
        "External binding cannot be a request importer",
      );
    }
  }

  const resolutionEvidenceByRequest = new Map<
    string,
    ModuleResolutionEvidence
  >();
  for (const evidence of snapshot.resolutionEvidence) {
    const request = requireReference(
      requests,
      evidence.preimage.semanticRequestId,
      ["resolutionEvidence", evidence.id, "semanticRequestId"],
    );
    const target = requireReference(
      loaderEntries,
      evidence.preimage.targetLoaderEntryId,
      ["resolutionEvidence", evidence.id, "targetLoaderEntryId"],
    );
    if (request.preimage.kind !== evidence.preimage.kind) {
      fail(
        "request-conflict",
        ["resolutionEvidence", evidence.id],
        "Resolution evidence kind does not match request",
      );
    }
    if (
      request.preimage.resolutionDomainId !== target.preimage.resolutionDomainId
    ) {
      fail(
        "domain-mismatch",
        ["resolutionEvidence", evidence.id],
        "Request and target domains differ",
      );
    }
    const domain = requireReference(
      domains,
      request.preimage.resolutionDomainId,
      [],
    );
    const expectedConditionSequence =
      request.preimage.kind === "native"
        ? domain.preimage.esmConditions.observableSequence
        : domain.preimage.commonJsConditions.observableSequence;
    if (
      !equalCanonical(
        evidence.preimage.observedConditionSequence,
        expectedConditionSequence,
      )
    ) {
      fail(
        "request-conflict",
        ["resolutionEvidence", evidence.id, "observedConditionSequence"],
        "Resolver evidence condition sequence does not match its domain",
      );
    }
    if (
      evidence.preimage.kind === "native" &&
      !equalCanonical(
        evidence.preimage.effectiveAttributes,
        target.preimage.effectiveAttributes,
      )
    ) {
      fail(
        "request-conflict",
        ["resolutionEvidence", evidence.id, "effectiveAttributes"],
        "Effective attributes do not match target loader key",
      );
    }
    if (resolutionEvidenceByRequest.has(request.id)) {
      fail(
        "request-conflict",
        ["resolutionEvidence", evidence.id],
        "Semantic request has multiple resolution evidence records",
      );
    }
    resolutionEvidenceByRequest.set(request.id, evidence);
  }

  const resolvedByRequest = new Map<string, ResolvedModuleRequest>();
  const usedResolutionEvidenceIds = new Set<string>();
  for (const resolved of snapshot.resolvedRequests) {
    const request = requireReference(
      requests,
      resolved.preimage.semanticRequestId,
      ["resolvedRequests", resolved.id, "semanticRequestId"],
    );
    const evidence = requireReference(
      resolutionEvidence,
      resolved.preimage.resolutionEvidenceId,
      ["resolvedRequests", resolved.id, "resolutionEvidenceId"],
    );
    requireReference(loaderEntries, resolved.preimage.targetLoaderEntryId, [
      "resolvedRequests",
      resolved.id,
      "targetLoaderEntryId",
    ]);
    if (
      request.preimage.kind !== resolved.preimage.kind ||
      evidence.preimage.kind !== resolved.preimage.kind ||
      evidence.preimage.semanticRequestId !== request.id ||
      evidence.preimage.targetLoaderEntryId !==
        resolved.preimage.targetLoaderEntryId
    ) {
      fail(
        "request-conflict",
        ["resolvedRequests", resolved.id],
        "Resolved request association is inconsistent",
      );
    }
    if (resolvedByRequest.has(request.id)) {
      fail(
        "request-conflict",
        ["resolvedRequests", resolved.id],
        "Semantic request resolves more than once",
      );
    }
    if (usedResolutionEvidenceIds.has(evidence.id)) {
      fail(
        "request-conflict",
        ["resolvedRequests", resolved.id],
        "Resolution evidence is reused by another request",
      );
    }
    resolvedByRequest.set(request.id, resolved);
    usedResolutionEvidenceIds.add(evidence.id);
  }
  for (const request of snapshot.semanticRequests) {
    if (!resolvedByRequest.has(request.id)) {
      fail(
        "request-conflict",
        ["semanticRequests", request.id],
        "Semantic request is not resolved exactly once",
      );
    }
  }
  if (usedResolutionEvidenceIds.size !== snapshot.resolutionEvidence.length) {
    fail(
      "request-conflict",
      ["resolutionEvidence"],
      "Unused resolution evidence record",
    );
  }

  const siteEvidenceUse = new Set<string>();
  const resolvedUse = new Set<string>();
  const sitesByBinding = new Map<string, ModuleRequestSite[]>();
  const siteKeyOwners = new Set<string>();
  for (const site of snapshot.requestSites) {
    const domain = requireReference(domains, site.preimage.resolutionDomainId, [
      "requestSites",
      site.id,
      "resolutionDomainId",
    ]);
    const importer = requireReference(
      bindings,
      site.preimage.importerRuntimeBindingId,
      ["requestSites", site.id, "importerRuntimeBindingId"],
    );
    if (importer.preimage.resolutionDomainId !== domain.id) {
      fail(
        "domain-mismatch",
        ["requestSites", site.id],
        "Site and importer domains differ",
      );
    }
    const definition = requireReference(
      definitions,
      importer.preimage.moduleDefinitionId,
      [],
    );
    if (definition.preimage.kind !== "content") {
      fail(
        "external-contract-mismatch",
        ["requestSites", site.id],
        "External binding cannot own a request site",
      );
    }
    const inventory = requireReference(
      inventories,
      definition.preimage.requestInventoryId,
      [],
    );
    const descriptor = inventory.preimage.sites.at(
      site.preimage.inventoryOrdinal,
    );
    if (
      descriptor === undefined ||
      descriptor.kind !== site.preimage.kind ||
      descriptor.phase !== site.preimage.phase
    ) {
      fail(
        "site-mismatch",
        ["requestSites", site.id],
        "Site does not match request inventory descriptor",
      );
    }
    const siteKey = `${importer.id}\u0000${site.preimage.inventoryOrdinal}`;
    if (siteKeyOwners.has(siteKey)) {
      fail(
        "site-mismatch",
        ["requestSites", site.id],
        "Duplicate request site ordinal",
      );
    }
    siteKeyOwners.add(siteKey);
    const evidence = requireReference(
      siteEvidence,
      site.preimage.siteEvidenceId,
      ["requestSites", site.id, "siteEvidenceId"],
    );
    if (siteEvidenceUse.has(evidence.id)) {
      fail(
        "site-mismatch",
        ["requestSites", site.id],
        "Request-site evidence is reused",
      );
    }
    siteEvidenceUse.add(evidence.id);
    if (
      evidence.preimage.requestInventoryId !== inventory.id ||
      evidence.preimage.inventoryOrdinal !== site.preimage.inventoryOrdinal ||
      evidence.preimage.normalizedSyntaxDigest !==
        descriptor.normalizedSyntaxDigest ||
      evidence.preimage.importerRuntimeBindingId !== importer.id
    ) {
      fail(
        "site-mismatch",
        ["requestSites", site.id],
        "Request-site evidence does not match syntax site",
      );
    }
    const semanticIds: string[] = [];
    for (const resolvedId of site.preimage.resolvedRequestIds) {
      const resolved = requireReference(resolvedRequests, resolvedId, [
        "requestSites",
        site.id,
        "resolvedRequestIds",
      ]);
      const request = requireReference(
        requests,
        resolved.preimage.semanticRequestId,
        [],
      );
      if (
        request.preimage.resolutionDomainId !== domain.id ||
        request.preimage.importerRuntimeBindingId !== importer.id
      ) {
        fail(
          "site-mismatch",
          ["requestSites", site.id],
          "Resolved request belongs to another domain or importer",
        );
      }
      if (site.preimage.kind === "commonjs-require") {
        if (request.preimage.kind !== "commonjs") {
          fail(
            "site-mismatch",
            ["requestSites", site.id],
            "CommonJS site references a native request",
          );
        }
      } else if (
        request.preimage.kind !== "native" ||
        request.preimage.phase !== site.preimage.phase
      ) {
        fail(
          "site-mismatch",
          ["requestSites", site.id],
          "Native site request phase does not match",
        );
      }
      semanticIds.push(request.id);
      resolvedUse.add(resolved.id);
    }
    semanticIds.sort();
    requireSameSet(
      semanticIds,
      evidence.preimage.semanticRequestIds,
      ["requestSites", site.id, "siteEvidenceId"],
      "site-mismatch",
      "Site evidence semantic request set does not match resolved requests",
    );
    const ownedSites = sitesByBinding.get(importer.id) ?? [];
    ownedSites.push(site);
    sitesByBinding.set(importer.id, ownedSites);
  }
  if (siteEvidenceUse.size !== snapshot.requestSiteEvidence.length) {
    fail(
      "site-mismatch",
      ["requestSiteEvidence"],
      "Unused request-site evidence record",
    );
  }
  if (resolvedUse.size !== snapshot.resolvedRequests.length) {
    fail(
      "unreachable-record",
      ["resolvedRequests"],
      "Resolved request is not referenced by a site",
    );
  }

  const entriesByDomain = new Map<string, ModuleGraphEntry[]>();
  const usedLoaderEntryIds = new Set<string>();
  for (const entry of snapshot.entries) {
    const domain = requireReference(
      domains,
      entry.preimage.resolutionDomainId,
      ["entries", entry.id, "resolutionDomainId"],
    );
    const loaderEntry = requireReference(
      loaderEntries,
      entry.preimage.loaderEntryId,
      ["entries", entry.id, "loaderEntryId"],
    );
    if (loaderEntry.preimage.resolutionDomainId !== domain.id) {
      fail(
        "domain-mismatch",
        ["entries", entry.id],
        "Entry and loader entry domains differ",
      );
    }
    const binding = requireReference(
      bindings,
      loaderEntry.preimage.runtimeBindingId,
      [],
    );
    const definition = requireReference(
      definitions,
      binding.preimage.moduleDefinitionId,
      [],
    );
    if (definition.preimage.kind !== "content") {
      fail(
        "external-contract-mismatch",
        ["entries", entry.id],
        "External module cannot be a graph entry",
      );
    }
    const domainEntries = entriesByDomain.get(domain.id) ?? [];
    domainEntries.push(entry);
    entriesByDomain.set(domain.id, domainEntries);
    usedLoaderEntryIds.add(loaderEntry.id);
  }
  for (const domain of snapshot.resolutionDomains) {
    const domainEntries = entriesByDomain.get(domain.id) ?? [];
    if (domainEntries.length === 0) {
      fail(
        "unreachable-record",
        ["resolutionDomains", domain.id],
        "Resolution domain has no entry",
      );
    }
    const ordinals = domainEntries
      .map((entry) => entry.preimage.entryOrdinal)
      .sort((a, b) => a - b);
    if (ordinals.some((ordinal, index) => ordinal !== index)) {
      fail(
        "identity-conflict",
        ["entries"],
        "Entry ordinals must form a dense sequence per domain",
      );
    }
  }

  const phaseByBinding = new Map<string, number>();
  const queue: string[] = [];
  function promote(bindingId: string, phase: number): void {
    const current = phaseByBinding.get(bindingId) ?? 0;
    if (phase > current) {
      phaseByBinding.set(bindingId, phase);
      queue.push(bindingId);
    }
  }
  for (const entry of snapshot.entries) {
    const loaderEntry = requireReference(
      loaderEntries,
      entry.preimage.loaderEntryId,
      [],
    );
    promote(loaderEntry.preimage.runtimeBindingId, 2);
  }
  let queueCursor = 0;
  while (queueCursor < queue.length) {
    const bindingId = queue[queueCursor];
    queueCursor += 1;
    if ((phaseByBinding.get(bindingId) ?? 0) < 2) continue;
    const binding = requireReference(bindings, bindingId, []);
    const definition = requireReference(
      definitions,
      binding.preimage.moduleDefinitionId,
      [],
    );
    if (definition.preimage.kind === "external") continue;
    const inventory = requireReference(
      inventories,
      definition.preimage.requestInventoryId,
      [],
    );
    const ownedSites = sitesByBinding.get(binding.id) ?? [];
    if (ownedSites.length !== inventory.preimage.sites.length) {
      fail(
        "site-mismatch",
        ["runtimeBindings", binding.id],
        "Evaluation-reachable binding has incomplete request sites",
      );
    }
    for (const site of ownedSites) {
      for (const resolvedId of site.preimage.resolvedRequestIds) {
        const resolved = requireReference(resolvedRequests, resolvedId, []);
        const request = requireReference(
          requests,
          resolved.preimage.semanticRequestId,
          [],
        );
        const targetLoader = requireReference(
          loaderEntries,
          resolved.preimage.targetLoaderEntryId,
          [],
        );
        usedLoaderEntryIds.add(targetLoader.id);
        const targetPhase =
          request.preimage.kind === "native" &&
          request.preimage.phase === "source"
            ? 1
            : 2;
        promote(targetLoader.preimage.runtimeBindingId, targetPhase);
      }
    }
  }

  for (const binding of snapshot.runtimeBindings) {
    const phase = phaseByBinding.get(binding.id) ?? 0;
    if (phase === 0) {
      fail(
        "unreachable-record",
        ["runtimeBindings", binding.id],
        "Runtime binding is unreachable from entries",
      );
    }
    const definition = requireReference(
      definitions,
      binding.preimage.moduleDefinitionId,
      [],
    );
    const ownedSites = sitesByBinding.get(binding.id) ?? [];
    if (definition.preimage.kind === "external" && ownedSites.length > 0) {
      fail(
        "site-mismatch",
        ["runtimeBindings", binding.id],
        "External binding cannot own request sites",
      );
    }
    if (
      definition.preimage.kind === "content" &&
      phase === 1 &&
      ownedSites.length > 0
    ) {
      fail(
        "site-mismatch",
        ["runtimeBindings", binding.id],
        "Source-only binding must not include outgoing sites",
      );
    }
  }
  if (usedLoaderEntryIds.size !== snapshot.loaderEntries.length) {
    fail(
      "unreachable-record",
      ["loaderEntries"],
      "Loader entry is not used by an entry or resolved request",
    );
  }

  const crossPhaseTarget = new Map<string, string>();
  for (const request of snapshot.semanticRequests) {
    if (request.preimage.kind !== "native") continue;
    const resolved = requireReference(resolvedByRequest, request.id, []);
    const loaderEntry = requireReference(
      loaderEntries,
      resolved.preimage.targetLoaderEntryId,
      [],
    );
    const key = canonicalizeJson({
      domain: request.preimage.resolutionDomainId,
      importer: request.preimage.importerRuntimeBindingId,
      specifier: request.preimage.specifier,
      attributes: request.preimage.sourceAttributes,
    }).text;
    const previous = crossPhaseTarget.get(key);
    if (
      previous !== undefined &&
      previous !== loaderEntry.preimage.runtimeBindingId
    ) {
      fail(
        "request-conflict",
        ["semanticRequests", request.id],
        "Source and evaluation phases resolve to different runtime bindings",
      );
    }
    crossPhaseTarget.set(key, loaderEntry.preimage.runtimeBindingId);
  }

  function requireExactUse(
    records: readonly { readonly id: string }[],
    used: ReadonlySet<string>,
    path: string,
  ): void {
    const unused = records.find((record) => !used.has(record.id));
    if (unused !== undefined) {
      fail("unreachable-record", [path, unused.id], `Unused ${path} record`);
    }
  }
  requireExactUse(
    snapshot.semanticProfiles,
    usedProfileIds,
    "semanticProfiles",
  );
  requireExactUse(
    snapshot.requestInventories,
    usedInventoryIds,
    "requestInventories",
  );
  requireExactUse(
    snapshot.externalDefinitionContracts,
    usedExternalContractIds,
    "externalDefinitionContracts",
  );
  requireExactUse(
    snapshot.moduleDefinitions,
    usedDefinitionIds,
    "moduleDefinitions",
  );
  requireExactUse(
    snapshot.resolutionDomains,
    usedDomainIds,
    "resolutionDomains",
  );
  if (externalEvidence.size !== snapshot.externalRuntimeEvidence.length) {
    fail(
      "external-contract-mismatch",
      ["externalRuntimeEvidence"],
      "Duplicate external evidence identity",
    );
  }
}

/** Canonicalizes an absolute module URL using WHATWG parse and serialize. */
function canonicalizeModuleUrl(value: string): CanonicalModuleUrl {
  return canonicalUrl(value, []);
}

/** Computes SHA-256 over an exact module byte snapshot. */
async function digestModuleContent(
  bytes: Uint8Array,
): Promise<ModuleContentDigest> {
  return (await sha256Digest(bytes)) as ModuleContentDigest;
}

/** Creates a canonical module semantic profile. */
async function createModuleSemanticProfile(
  input: ModuleSemanticProfileInput,
): Promise<ModuleSemanticProfile> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "definitionKind",
      "parseGoal",
      "transformPipelineDigest",
      "transformMetadataDigest",
      "loaderSemanticsDigest",
      "importMetaSemanticsDigest",
    ],
  );
  const preimage = parseSemanticProfilePreimage(
    { schema: "dathra.module-semantic-profile/1", ...record },
    [],
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical module resolution domain. */
async function createModuleResolutionDomain(
  input: ModuleResolutionDomainInput,
): Promise<ModuleResolutionDomain> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "targetEnvironmentId",
      "nativeModuleMapNamespaceDigest",
      "commonJsLoaderCacheNamespaceDigest",
      "resolverProfileDigest",
      "resolverInputTranscriptDigest",
      "moduleMapSemanticsDigest",
      "esmConditions",
      "commonJsConditions",
    ],
  );
  const preimage = parseResolutionDomainPreimage(
    { schema: "dathra.module-resolution-domain/1", ...record },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical edge-independent module request inventory. */
async function createModuleRequestInventory(
  input: ModuleRequestInventoryInput,
): Promise<ModuleRequestInventory> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "transformedContentDigest",
      "semanticProfileId",
      "extractorProfileDigest",
      "sites",
    ],
  );
  const preimage = parseInventoryPreimage(
    { schema: "dathra.module-request-inventory/1", ...record },
    [],
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical domain-independent external definition contract. */
async function createExternalModuleDefinitionContract(
  input: ExternalModuleDefinitionContractInput,
): Promise<ExternalModuleDefinitionContract> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "externalDefinitionKind",
      "definitionSemanticsDigest",
      "moduleSourceSemanticsDigest",
      "transitiveDependencyOwnershipDigest",
      "moduleBytesCorrespondenceDigest",
    ],
  );
  const preimage = parseExternalContractPreimage(
    { schema: "dathra.external-module-definition-contract/1", ...record },
    [],
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical content or external module definition. */
async function createModuleDefinition(
  input: ModuleDefinitionInput,
): Promise<ModuleDefinition> {
  const closed = snapshotClosed(input);
  if (!isDataRecord(closed)) fail("invalid-field", [], "Expected a record");
  const kind = expectOneOf(closed.kind, ["content", "external"] as const, [
    "kind",
  ]);
  if (kind === "content") {
    const record = expectRecord(
      closed,
      [],
      [
        "kind",
        "sourceUrl",
        "sourceContentDigest",
        "transformedContentDigest",
        "semanticProfileId",
        "requestInventoryId",
      ],
    );
    const preimage = parseDefinitionPreimage(
      {
        schema: "dathra.module-definition/1",
        kind,
        canonicalSourceUrl: record.sourceUrl,
        sourceContentDigest: record.sourceContentDigest,
        transformedContentDigest: record.transformedContentDigest,
        semanticProfileId: record.semanticProfileId,
        requestInventoryId: record.requestInventoryId,
      },
      [],
      true,
    );
    return await createIdentityRecord(preimage);
  }
  const record = expectRecord(
    closed,
    [],
    ["kind", "sourceUrl", "externalDefinitionContractId"],
  );
  const preimage = parseDefinitionPreimage(
    {
      schema: "dathra.module-definition/1",
      kind,
      canonicalSourceUrl: record.sourceUrl,
      externalDefinitionContractId: record.externalDefinitionContractId,
    },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical runtime module binding. */
async function createRuntimeModuleBinding(
  input: RuntimeModuleBindingInput,
): Promise<RuntimeModuleBinding> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "resolutionDomainId",
      "moduleDefinitionId",
      "moduleBaseUrl",
      "runtimeModuleIdentityDigest",
    ],
  );
  const preimage = parseRuntimeBindingPreimage(
    { schema: "dathra.runtime-module-binding/1", ...record },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical native module-map or CommonJS cache entry. */
async function createModuleLoaderEntry(
  input: ModuleLoaderEntryInput,
): Promise<ModuleLoaderEntry> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "resolutionDomainId",
      "namespaceKind",
      "moduleMapUrl",
      "moduleMapType",
      "effectiveAttributes",
      "cacheKeyDigest",
      "runtimeBindingId",
    ],
  );
  const preimage = parseLoaderEntryPreimage(
    { schema: "dathra.module-loader-entry/1", ...record },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates a canonical native or CommonJS semantic request. */
async function createSemanticModuleRequest(
  input: SemanticModuleRequestInput,
): Promise<SemanticModuleRequest> {
  const closed = snapshotClosed(input);
  if (!isDataRecord(closed)) fail("invalid-field", [], "Expected a record");
  const kind = expectOneOf(closed.kind, ["native", "commonjs"] as const, [
    "kind",
  ]);
  const fields =
    kind === "native"
      ? [
          "kind",
          "resolutionDomainId",
          "importerRuntimeBindingId",
          "phase",
          "specifier",
          "sourceAttributes",
        ]
      : [
          "kind",
          "resolutionDomainId",
          "importerRuntimeBindingId",
          "resolutionOriginUrl",
          "specifier",
        ];
  const record = expectRecord(closed, [], fields);
  const preimage = parseSemanticRequestPreimage(
    {
      schema:
        kind === "native"
          ? "dathra.native-module-request/1"
          : "dathra.commonjs-module-request/1",
      ...record,
    },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates structured resolution evidence for one semantic request. */
async function createModuleResolutionEvidence(
  input: ModuleResolutionEvidenceInput,
): Promise<ModuleResolutionEvidence> {
  const closed = snapshotClosed(input);
  if (!isDataRecord(closed)) fail("invalid-field", [], "Expected a record");
  const kind = expectOneOf(closed.kind, ["native", "commonjs"] as const, [
    "kind",
  ]);
  const fields =
    kind === "native"
      ? [
          "kind",
          "semanticRequestId",
          "targetLoaderEntryId",
          "observedConditionSequence",
          "effectiveAttributes",
          "redirectEvidenceDigest",
          "resolverTraceDigest",
        ]
      : [
          "kind",
          "semanticRequestId",
          "targetLoaderEntryId",
          "observedConditionSequence",
          "redirectEvidenceDigest",
          "resolverTraceDigest",
        ];
  const record = expectRecord(closed, [], fields);
  const preimage = parseResolutionEvidencePreimage(
    {
      schema:
        kind === "native"
          ? "dathra.native-module-resolution-evidence/1"
          : "dathra.commonjs-module-resolution-evidence/1",
      ...record,
    },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates an exact semantic request, target, and evidence association. */
async function createResolvedModuleRequest(
  input: ResolvedModuleRequestInput,
): Promise<ResolvedModuleRequest> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "kind",
      "semanticRequestId",
      "targetLoaderEntryId",
      "resolutionEvidenceId",
    ],
  );
  const preimage = parseResolvedRequestPreimage(
    { schema: "dathra.resolved-module-request/1", ...record },
    [],
  );
  return await createIdentityRecord(preimage);
}

/** Creates concrete runtime closure evidence for an external binding. */
async function createExternalRuntimeClosureEvidence(
  input: ExternalRuntimeClosureEvidenceInput,
): Promise<ExternalRuntimeClosureEvidence> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "externalDefinitionContractId",
      "runtimeBindingId",
      "loaderEntryIds",
      "runtimeSemanticsDigest",
      "phaseCoherenceEvidenceDigest",
    ],
  );
  const preimage = parseExternalRuntimeEvidencePreimage(
    { schema: "dathra.external-runtime-closure-evidence/1", ...record },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates evidence binding one syntax site to semantic request keys. */
async function createModuleRequestSiteEvidence(
  input: ModuleRequestSiteEvidenceInput,
): Promise<ModuleRequestSiteEvidence> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "requestInventoryId",
      "inventoryOrdinal",
      "normalizedSyntaxDigest",
      "importerRuntimeBindingId",
      "semanticRequestIds",
      "candidateCoverageProofDigest",
    ],
  );
  const preimage = parseSiteEvidencePreimage(
    { schema: "dathra.module-request-site-evidence/1", ...record },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates one canonical source request site. */
async function createModuleRequestSite(
  input: ModuleRequestSiteInput,
): Promise<ModuleRequestSite> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "resolutionDomainId",
      "importerRuntimeBindingId",
      "inventoryOrdinal",
      "kind",
      "phase",
      "siteEvidenceId",
      "resolvedRequestIds",
    ],
  );
  const preimage = parseSitePreimage(
    { schema: "dathra.module-request-site/1", ...record },
    [],
    true,
  );
  return await createIdentityRecord(preimage);
}

/** Creates one ordered module graph entry. */
async function createModuleGraphEntry(
  input: ModuleGraphEntryInput,
): Promise<ModuleGraphEntry> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "resolutionDomainId",
      "entryOrdinal",
      "entryKind",
      "entryContextDigest",
      "loaderEntryId",
    ],
  );
  const preimage = parseEntryPreimage(
    { schema: "dathra.module-graph-entry/1", ...record },
    [],
  );
  return await createIdentityRecord(preimage);
}

/** Creates and validates a canonical immutable module graph snapshot. */
async function createModuleGraphSnapshot(
  input: ModuleGraphSnapshotInput,
): Promise<ModuleGraphSnapshot> {
  const preimage = await parseSnapshotPreimage(
    snapshotClosed(input),
    [],
    true,
    false,
  );
  validateSnapshotGraph(preimage);
  return await createIdentityRecord(preimage);
}

/** Strictly validates an untrusted canonical module graph snapshot value. */
async function parseModuleGraphSnapshot(
  value: unknown,
): Promise<ModuleGraphSnapshot> {
  const closed = snapshotClosed(value);
  const record = expectRecord(closed, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  const preimage = await parseSnapshotPreimage(
    record.preimage,
    ["preimage"],
    false,
    true,
  );
  validateSnapshotGraph(preimage);
  const expected = await digestCanonicalJson(preimage);
  if (id !== expected) {
    fail("digest-mismatch", ["id"], "Snapshot ID does not match preimage");
  }
  const result = { id: id as ModuleGraphSnapshotId, preimage };
  deepFreeze(result);
  return result;
}

export {
  ModuleGraphError,
  canonicalizeModuleUrl,
  createExternalModuleDefinitionContract,
  createExternalRuntimeClosureEvidence,
  createModuleDefinition,
  createModuleGraphEntry,
  createModuleGraphSnapshot,
  createModuleLoaderEntry,
  createModuleRequestInventory,
  createModuleRequestSite,
  createModuleRequestSiteEvidence,
  createModuleResolutionDomain,
  createModuleResolutionEvidence,
  createModuleSemanticProfile,
  createResolvedModuleRequest,
  createRuntimeModuleBinding,
  createSemanticModuleRequest,
  digestModuleContent,
  parseModuleGraphSnapshot,
};
export type {
  CanonicalModuleUrl,
  CommonJsModuleResolutionEvidenceInput,
  CommonJsSemanticModuleRequestInput,
  ContentModuleDefinitionInput,
  ExternalModuleDefinitionContract,
  ExternalModuleDefinitionContractId,
  ExternalModuleDefinitionContractInput,
  ExternalModuleDefinitionInput,
  ExternalRuntimeClosureEvidence,
  ExternalRuntimeClosureEvidenceId,
  ExternalRuntimeClosureEvidenceInput,
  ModuleConditionProfile,
  ModuleConditionProfileInput,
  ModuleContentDigest,
  ModuleDefinition,
  ModuleDefinitionId,
  ModuleDefinitionInput,
  ModuleDefinitionKind,
  ModuleGraphEntry,
  ModuleGraphEntryId,
  ModuleGraphEntryInput,
  ModuleGraphErrorCode,
  ModuleGraphPathSegment,
  ModuleGraphSnapshot,
  ModuleGraphSnapshotId,
  ModuleGraphSnapshotInput,
  ModuleGraphSnapshotPreimage,
  ModuleIdentityRecord,
  ModuleImportAttribute,
  ModuleImportAttributeInput,
  ModuleImportPhase,
  ModuleLoaderEntry,
  ModuleLoaderEntryId,
  ModuleLoaderEntryInput,
  ModuleLoaderNamespaceKind,
  ModuleParseGoal,
  ModuleRequestInventory,
  ModuleRequestInventoryId,
  ModuleRequestInventoryInput,
  ModuleRequestInventorySite,
  ModuleRequestInventorySiteInput,
  ModuleRequestSite,
  ModuleRequestSiteEvidence,
  ModuleRequestSiteEvidenceId,
  ModuleRequestSiteEvidenceInput,
  ModuleRequestSiteId,
  ModuleRequestSiteInput,
  ModuleRequestSiteKind,
  ModuleResolutionDomain,
  ModuleResolutionDomainId,
  ModuleResolutionDomainInput,
  ModuleResolutionEvidence,
  ModuleResolutionEvidenceId,
  ModuleResolutionEvidenceInput,
  ModuleSemanticProfile,
  ModuleSemanticProfileId,
  ModuleSemanticProfileInput,
  NativeModuleResolutionEvidenceInput,
  NativeSemanticModuleRequestInput,
  ResolvedModuleRequest,
  ResolvedModuleRequestId,
  ResolvedModuleRequestInput,
  RuntimeModuleBinding,
  RuntimeModuleBindingId,
  RuntimeModuleBindingInput,
  SemanticModuleRequest,
  SemanticModuleRequestId,
  SemanticModuleRequestInput,
};
