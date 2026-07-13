import {
  canonicalizeJson,
  digestCanonicalJson,
  isSha256Digest,
  type CanonicalJsonValue,
  type Sha256Digest,
} from "@dathra/shared";

import {
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
  type ExternalModuleDefinitionContract,
  type ExternalModuleDefinitionContractInput,
  type ExternalRuntimeClosureEvidence,
  type ModuleDefinition,
  type ModuleDefinitionKind,
  type ModuleContentDigest,
  type ModuleGraphEntry,
  type ModuleGraphSnapshot,
  type ModuleGraphSnapshotId,
  type ModuleImportAttributeInput,
  type ModuleImportPhase,
  type ModuleLoaderEntry,
  type ModuleLoaderNamespaceKind,
  type ModuleParseGoal,
  type ModuleRequestInventory,
  type ModuleRequestSite,
  type ModuleRequestSiteEvidence,
  type ModuleRequestSiteKind,
  type ModuleResolutionDomain,
  type ModuleResolutionEvidence,
  type ModuleSemanticProfile,
  type ModuleSemanticProfileId,
  type ResolvedModuleRequest,
  type ResolvedModuleRequestId,
  type RuntimeModuleBinding,
  type RuntimeModuleBindingId,
  type SemanticModuleRequest,
  type SemanticModuleRequestId,
} from "../moduleGraph/implementation";

/** One cacheable adapter operation. */
type ModuleCoordinatorStageKind =
  | "describe-domain"
  | "resolve"
  | "load"
  | "transform"
  | "extract";

/** A positive or negative host dependency observation. */
interface ModuleCoordinatorObservation {
  readonly kind: "present" | "absent";
  readonly key: string;
  readonly digest: Sha256Digest;
}

/** The persistence and transaction replay behavior of one stage result. */
type ModuleCoordinatorCacheDisposition =
  | { readonly kind: "pure" }
  | {
      readonly kind: "replayable";
      readonly replayToken: CanonicalJsonValue;
    }
  | { readonly kind: "transaction-local" };

/** Version/configuration identities for all adapter pipeline stages. */
interface ModuleCoordinatorPipelineProfile {
  readonly aggregateAdapterProfileDigest: Sha256Digest;
  readonly resolverProfileDigest: Sha256Digest;
  readonly loadProfileDigest: Sha256Digest;
  readonly transformPipelineDigest: Sha256Digest;
  readonly loaderSemanticsDigest: Sha256Digest;
  readonly importMetaSemanticsDigest: Sha256Digest;
  readonly extractorProfileDigest: Sha256Digest;
}

/** Stable, pre-attempt configuration for one resolution domain. */
interface ModuleCoordinatorDomainInput {
  readonly stableDomainKey: string;
  readonly domainConfigurationDigest: Sha256Digest;
  readonly targetEnvironmentId: string;
  readonly nativeModuleMapNamespaceDigest: Sha256Digest;
  readonly commonJsLoaderCacheNamespaceDigest: Sha256Digest;
}

/** A native module request observed by the resolver. */
interface NativeModuleCoordinatorResolutionRequest {
  readonly kind: "native";
  readonly phase: ModuleImportPhase;
  readonly specifier: string;
  readonly resolutionOriginUrl: string;
  readonly sourceAttributes: readonly ModuleImportAttributeInput[];
}

/** A CommonJS request observed by the resolver. */
interface CommonJsModuleCoordinatorResolutionRequest {
  readonly kind: "commonjs";
  readonly specifier: string;
  readonly resolutionOriginUrl: string;
}

/** One complete native or CommonJS resolution request. */
type ModuleCoordinatorResolutionRequest =
  | NativeModuleCoordinatorResolutionRequest
  | CommonJsModuleCoordinatorResolutionRequest;

/** One ordered host entry admitted into a stable domain. */
interface ModuleCoordinatorEntryInput {
  readonly stableDomainKey: string;
  readonly entryOrdinal: number;
  readonly entryKind: string;
  readonly entryContextDigest: Sha256Digest;
  readonly request: ModuleCoordinatorResolutionRequest;
}

/** Closed input for one coordinated module graph build. */
interface ModuleCoordinatorBuildInput {
  readonly domains: readonly ModuleCoordinatorDomainInput[];
  readonly entries: readonly ModuleCoordinatorEntryInput[];
}

/** Optional invalidation and cancellation controls for one build. */
interface ModuleCoordinatorBuildOptions {
  readonly changedObservationKeys?: readonly string[];
  readonly signal?: AbortSignal;
}

interface ParsedBuildOptions {
  readonly changedObservationKeys: readonly string[];
  readonly signal: AbortSignal | undefined;
}

/** Hard limits applied independently to every build attempt. */
interface ModuleCoordinatorOptions {
  readonly maxRetries?: number;
  readonly maxFixedPointRounds?: number;
  readonly maxDomains?: number;
  readonly maxEntries?: number;
  readonly maxLoaderUnits?: number;
  readonly maxRuntimeUnits?: number;
  readonly maxSemanticRequests?: number;
  readonly maxSites?: number;
  readonly maxCandidates?: number;
  readonly maxObservations?: number;
  readonly maxCacheEntries?: number;
  readonly maxCacheBytes?: number;
}

/** Stable failure codes emitted by ModuleCoordinator. */
type ModuleCoordinatorErrorCode =
  | "invalid-input"
  | "adapter-contract"
  | "observation-conflict"
  | "domain-collision"
  | "runtime-conflict"
  | "duplicate-candidate"
  | "fixed-point-stall"
  | "budget-exceeded"
  | "commit-mismatch"
  | "unstable-input"
  | "cancelled";

/** A property or array index in a coordinator failure path. */
type ModuleCoordinatorPathSegment = string | number;

/** Describes a deterministic coordinator failure. */
class ModuleCoordinatorError extends TypeError {
  readonly code: ModuleCoordinatorErrorCode;
  readonly path: readonly ModuleCoordinatorPathSegment[];
  readonly resource: string | null;

  /** Creates an immutable coordinator diagnostic. */
  constructor(
    code: ModuleCoordinatorErrorCode,
    path: readonly ModuleCoordinatorPathSegment[],
    message: string,
    resource: string | null = null,
  ) {
    super(message);
    this.name = "ModuleCoordinatorError";
    this.code = code;
    this.path = Object.freeze([...path]);
    this.resource = resource;
    Object.freeze(this);
  }
}

/** Input used to open one isolated adapter transaction. */
interface ModuleCoordinatorBeginTransactionInput {
  readonly schema: "dathra.module-coordinator.begin-transaction/1";
  readonly transactionId: string;
  readonly attemptOrdinal: number;
  readonly buildDigest: Sha256Digest;
}

/** Input used to observe the current adapter pipeline profile. */
interface DescribePipelineInput {
  readonly schema: "dathra.module-coordinator.describe-pipeline/1";
  readonly buildDigest: Sha256Digest;
}

/** Result of observing the current adapter pipeline profile. */
interface DescribePipelineResult {
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly observations: readonly ModuleCoordinatorObservation[];
}

/** Input used to derive one attempt-specific resolution domain. */
interface DescribeDomainInput extends ModuleCoordinatorDomainInput {
  readonly schema: "dathra.module-coordinator.describe-domain/1";
  readonly aggregateAdapterProfileDigest: Sha256Digest;
  readonly resolverProfileDigest: Sha256Digest;
}

/** Result used to create one attempt-specific resolution domain. */
interface DescribeDomainResult {
  readonly resolverInputTranscriptDigest: Sha256Digest;
  readonly moduleMapSemanticsDigest: Sha256Digest;
  readonly esmConditions: {
    readonly activeSet: readonly string[];
    readonly observableSequence: readonly string[];
  };
  readonly commonJsConditions: {
    readonly activeSet: readonly string[];
    readonly observableSequence: readonly string[];
  };
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly cache: ModuleCoordinatorCacheDisposition;
}

/** Entry or importer context supplied to the resolver. */
type ResolveModuleRequester =
  | {
      readonly kind: "entry";
      readonly stableDomainKey: string;
      readonly entryOrdinal: number;
      readonly entryKind: string;
      readonly entryContextDigest: Sha256Digest;
    }
  | {
      readonly kind: "module";
      readonly importerRuntimeBindingId: RuntimeModuleBindingId;
      readonly importerModuleBaseUrl: string;
    };

/** Closed resolver operation input. */
interface ResolveModuleInput {
  readonly schema: "dathra.module-coordinator.resolve/1";
  readonly domain: ModuleResolutionDomain;
  readonly request: ModuleCoordinatorResolutionRequest;
  readonly requester: ResolveModuleRequester;
}

/** Temporary loader identity returned before runtime identity is known. */
interface ResolvedLoaderTarget {
  readonly namespaceKind: ModuleLoaderNamespaceKind;
  readonly moduleMapUrl: string;
  readonly moduleMapType: string;
  readonly effectiveAttributes: readonly ModuleImportAttributeInput[];
  readonly cacheKeyDigest: Sha256Digest;
  readonly loaderContextDigest: Sha256Digest;
}

/** Structured evidence returned by the resolver. */
interface RawModuleResolutionEvidence {
  readonly observedConditionSequence: readonly string[];
  readonly redirectEvidenceDigest: Sha256Digest;
  readonly resolverTraceDigest: Sha256Digest;
}

/** Result of resolving one entry or semantic module request. */
interface ResolveModuleResult {
  readonly target: ResolvedLoaderTarget;
  readonly evidence: RawModuleResolutionEvidence;
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly cache: ModuleCoordinatorCacheDisposition;
}

/** Closed loader operation input. */
interface LoadModuleInput {
  readonly schema: "dathra.module-coordinator.load/1";
  readonly domain: ModuleResolutionDomain;
  readonly target: ResolvedLoaderTarget;
}

interface LoadModuleResultBase {
  readonly canonicalSourceUrl: string;
  readonly moduleBaseUrl: string;
  readonly runtimeModuleIdentityDigest: Sha256Digest;
  readonly responseMetadata: CanonicalJsonValue;
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly cache: ModuleCoordinatorCacheDisposition;
}

/** Content-backed loader result. */
interface ContentLoadModuleResult extends LoadModuleResultBase {
  readonly kind: "content";
  readonly sourceBytes: Uint8Array;
}

/** Raw runtime evidence completed only after all loader aliases are known. */
interface RawExternalRuntimeAttestation {
  readonly runtimeSemanticsDigest: Sha256Digest;
  readonly phaseCoherenceEvidenceDigest: Sha256Digest;
}

/** Externally owned loader result. */
interface ExternalLoadModuleResult extends LoadModuleResultBase {
  readonly kind: "external";
  readonly definitionAttestation: ExternalModuleDefinitionContractInput;
  readonly runtimeAttestation: RawExternalRuntimeAttestation;
}

/** Result of loading one temporary loader unit. */
type LoadModuleResult = ContentLoadModuleResult | ExternalLoadModuleResult;

/** Closed transform operation input. */
interface TransformModuleInput {
  readonly schema: "dathra.module-coordinator.transform/1";
  readonly canonicalSourceUrl: string;
  readonly moduleBaseUrl: string;
  readonly sourceContentDigest: ModuleContentDigest;
  readonly sourceBytes: readonly number[];
  readonly responseMetadata: CanonicalJsonValue;
  readonly loadProfileDigest: Sha256Digest;
  readonly transformPipelineDigest: Sha256Digest;
  readonly loaderSemanticsDigest: Sha256Digest;
  readonly importMetaSemanticsDigest: Sha256Digest;
}

/** Result of transforming one content-backed runtime unit. */
interface TransformModuleResult {
  readonly transformedBytes: Uint8Array;
  readonly definitionKind: ModuleDefinitionKind;
  readonly parseGoal: ModuleParseGoal;
  readonly transformMetadataDigest: Sha256Digest;
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly cache: ModuleCoordinatorCacheDisposition;
}

/** Closed extraction operation input. */
interface ExtractModuleInput {
  readonly schema: "dathra.module-coordinator.extract/1";
  readonly canonicalSourceUrl: string;
  readonly moduleBaseUrl: string;
  readonly transformedContentDigest: ModuleContentDigest;
  readonly transformedBytes: readonly number[];
  readonly semanticProfileId: ModuleSemanticProfileId;
  readonly extractorProfileDigest: Sha256Digest;
  readonly responseMetadata: CanonicalJsonValue;
}

/** One finite source site returned by the extractor. */
interface ExtractedModuleRequestSite {
  readonly kind: ModuleRequestSiteKind;
  readonly phase: ModuleImportPhase | null;
  readonly normalizedSyntaxDigest: Sha256Digest;
  readonly candidates: readonly ModuleCoordinatorResolutionRequest[];
  readonly candidateCoverageProofDigest: Sha256Digest;
}

/** Result of extracting all source-order request sites. */
interface ExtractModuleResult {
  readonly sites: readonly ExtractedModuleRequestSite[];
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly cache: ModuleCoordinatorCacheDisposition;
}

/** Input used to restore replayable adapter effects on a cache hit. */
interface ReplayCachedStageInput {
  readonly schema: "dathra.module-coordinator.replay-cached-stage/1";
  readonly stageKey: Sha256Digest;
  readonly resultDigest: Sha256Digest;
  readonly replayToken: CanonicalJsonValue;
}

/** Exact observation validation and publication request. */
interface ModuleCoordinatorCommitInput {
  readonly schema: "dathra.module-coordinator.commit/1";
  readonly transactionId: string;
  readonly snapshotId: ModuleGraphSnapshotId;
  readonly adapterProfileDigest: Sha256Digest;
  readonly observationSetDigest: Sha256Digest;
  readonly exactObservations: readonly ModuleCoordinatorObservation[];
}

/** Atomic adapter publication result. */
type ModuleCoordinatorCommitResult =
  | {
      readonly kind: "committed";
      readonly transactionId: string;
      readonly snapshotId: ModuleGraphSnapshotId;
      readonly adapterProfileDigest: Sha256Digest;
      readonly observationSetDigest: Sha256Digest;
    }
  | {
      readonly kind: "invalidated";
      readonly changedObservationKeys: readonly string[];
    };

/** Input used to discard one unpublished adapter transaction. */
interface ModuleCoordinatorRollbackInput {
  readonly schema: "dathra.module-coordinator.rollback/1";
  readonly transactionId: string;
  readonly reason: "cancelled" | "invalidated" | "failed";
}

/** Adapter operations scoped to one build attempt. */
interface ModuleCoordinatorAdapterTransaction {
  describePipeline(
    input: DescribePipelineInput,
  ): Promise<DescribePipelineResult>;
  describeDomain(input: DescribeDomainInput): Promise<DescribeDomainResult>;
  resolve(input: ResolveModuleInput): Promise<ResolveModuleResult>;
  load(input: LoadModuleInput): Promise<LoadModuleResult>;
  transform(input: TransformModuleInput): Promise<TransformModuleResult>;
  extract(input: ExtractModuleInput): Promise<ExtractModuleResult>;
  replayCachedStage(input: ReplayCachedStageInput): Promise<void>;
  tryCommit(
    input: ModuleCoordinatorCommitInput,
  ): Promise<ModuleCoordinatorCommitResult>;
  rollback(input: ModuleCoordinatorRollbackInput): Promise<void>;
}

/** Bundler-neutral host adapter for coordinated module discovery. */
interface ModuleCoordinatorAdapter {
  beginTransaction(
    input: ModuleCoordinatorBeginTransactionInput,
  ): Promise<ModuleCoordinatorAdapterTransaction>;
}

/** Immutable result of one successful coordinated build. */
interface ModuleCoordinatorBuildResult {
  readonly snapshot: ModuleGraphSnapshot;
  readonly transactionId: string;
  readonly attempts: number;
  readonly observationSetDigest: Sha256Digest;
}

/** Public summary of the last committed coordinator state. */
interface ModuleCoordinatorStatus {
  readonly generation: number;
  readonly snapshotId: ModuleGraphSnapshotId | null;
  readonly cacheEntries: number;
  readonly cacheBytes: number;
}

type ValidationPath = readonly ModuleCoordinatorPathSegment[];
type ErrorSource = "input" | "adapter";
type DataRecord = Record<string, unknown>;

interface ResolvedOptions {
  readonly maxRetries: number;
  readonly maxFixedPointRounds: number;
  readonly maxDomains: number;
  readonly maxEntries: number;
  readonly maxLoaderUnits: number;
  readonly maxRuntimeUnits: number;
  readonly maxSemanticRequests: number;
  readonly maxSites: number;
  readonly maxCandidates: number;
  readonly maxObservations: number;
  readonly maxCacheEntries: number;
  readonly maxCacheBytes: number;
}

interface CacheEntry {
  readonly stage: ModuleCoordinatorStageKind;
  readonly stageKey: Sha256Digest;
  readonly result: unknown;
  readonly resultDigest: Sha256Digest;
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly disposition: Exclude<
    ModuleCoordinatorCacheDisposition,
    { readonly kind: "transaction-local" }
  >;
  readonly owners: readonly string[];
  readonly generation: number;
  readonly byteSize: number;
}

interface CommittedState {
  readonly generation: number;
  readonly snapshot: ModuleGraphSnapshot | null;
  readonly cache: ReadonlyMap<string, CacheEntry>;
  readonly cacheBytes: number;
  readonly observations: ReadonlyMap<string, ModuleCoordinatorObservation>;
  readonly observationOwners: ReadonlyMap<string, ReadonlySet<string>>;
  readonly entryToRuntime: ReadonlyMap<string, string>;
  readonly targetToImporters: ReadonlyMap<string, ReadonlySet<string>>;
}

interface StageExecution<T> {
  readonly value: T;
  readonly stageKey: Sha256Digest;
}

const DEFAULT_OPTIONS: ResolvedOptions = {
  maxRetries: 3,
  maxFixedPointRounds: 10_000,
  maxDomains: 128,
  maxEntries: 10_000,
  maxLoaderUnits: 100_000,
  maxRuntimeUnits: 100_000,
  maxSemanticRequests: 500_000,
  maxSites: 500_000,
  maxCandidates: 1_000_000,
  maxObservations: 1_000_000,
  maxCacheEntries: 500_000,
  maxCacheBytes: 512 * 1024 * 1024,
};

const DEFINITION_PARSE_GOAL = {
  "ecmascript-module": "module",
  "ecmascript-script": "script",
  commonjs: "commonjs",
  json: "json",
  wasm: "wasm",
  css: "css",
  text: "text",
} as const satisfies Record<ModuleDefinitionKind, ModuleParseGoal>;

function fail(
  code: ModuleCoordinatorErrorCode,
  path: ValidationPath,
  message: string,
  resource: string | null = null,
): never {
  throw new ModuleCoordinatorError(code, path, message, resource);
}

function sourceCode(source: ErrorSource): ModuleCoordinatorErrorCode {
  return source === "input" ? "invalid-input" : "adapter-contract";
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function deepFreeze(value: unknown): void {
  if (value === null || typeof value !== "object") return;
  if (value instanceof Uint8Array || Object.isFrozen(value)) return;
  for (const descriptor of Object.values(
    Object.getOwnPropertyDescriptors(value),
  )) {
    if ("value" in descriptor) deepFreeze(descriptor.value);
  }
  Object.freeze(value);
}

function snapshotClosed(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
  ancestors: WeakSet<object> = new WeakSet(),
): unknown {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      fail(sourceCode(source), path, "Closed data numbers must be finite");
    }
    return value;
  }
  if (value instanceof Uint8Array) return new Uint8Array(value);
  if (typeof value !== "object") {
    fail(sourceCode(source), path, "Value is not closed data");
  }
  if (ancestors.has(value)) {
    fail(sourceCode(source), path, "Closed data cannot contain cycles");
  }
  ancestors.add(value);

  if (Array.isArray(value)) {
    if (Object.getPrototypeOf(value) !== Array.prototype) {
      fail(sourceCode(source), path, "Array has a custom prototype");
    }
    const descriptors = Object.getOwnPropertyDescriptors(value);
    const symbols = Object.getOwnPropertySymbols(value);
    if (symbols.length > 0) {
      fail(sourceCode(source), path, "Array contains symbol properties");
    }
    const result: unknown[] = [];
    for (let index = 0; index < value.length; index += 1) {
      const descriptor = Object.getOwnPropertyDescriptor(value, String(index));
      if (
        descriptor === undefined ||
        !("value" in descriptor) ||
        descriptor.enumerable !== true
      ) {
        fail(
          sourceCode(source),
          [...path, index],
          "Array is sparse or accessor-backed",
        );
      }
      result.push(
        snapshotClosed(descriptor.value, [...path, index], source, ancestors),
      );
    }
    const expectedKeys = new Set([
      ...Array.from({ length: value.length }, (_, index) => String(index)),
      "length",
    ]);
    if (Object.keys(descriptors).some((key) => !expectedKeys.has(key))) {
      fail(sourceCode(source), path, "Array contains unsupported properties");
    }
    ancestors.delete(value);
    return result;
  }

  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(sourceCode(source), path, "Record has a custom prototype");
  }
  if (Object.getOwnPropertySymbols(value).length > 0) {
    fail(sourceCode(source), path, "Record contains symbol properties");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const result: DataRecord = {};
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      fail(
        sourceCode(source),
        [...path, key],
        "Record properties must be enumerable data properties",
      );
    }
    result[key] = snapshotClosed(
      descriptor.value,
      [...path, key],
      source,
      ancestors,
    );
  }
  ancestors.delete(value);
  return result;
}

function expectAnyRecord(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): DataRecord {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(sourceCode(source), path, "Expected a record");
  }
  return value as DataRecord;
}

function expectRecord(
  value: unknown,
  path: ValidationPath,
  keys: readonly string[],
  source: ErrorSource,
): DataRecord {
  const record = expectAnyRecord(value, path, source);
  const actual = Object.keys(record).sort();
  const expected = [...keys].sort();
  if (
    actual.length !== expected.length ||
    actual.some((key, index) => key !== expected[index])
  ) {
    fail(sourceCode(source), path, "Record fields do not match the contract");
  }
  return record;
}

function expectArray(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): readonly unknown[] {
  if (!Array.isArray(value)) {
    fail(sourceCode(source), path, "Expected an array");
  }
  return value;
}

function expectText(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): string {
  if (typeof value !== "string") {
    fail(sourceCode(source), path, "Expected a string");
  }
  try {
    canonicalizeJson(value);
  } catch {
    fail(sourceCode(source), path, "String is not well-formed Unicode");
  }
  return value;
}

function expectString(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): string {
  const result = expectText(value, path, source);
  if (result.length === 0) {
    fail(sourceCode(source), path, "Expected a non-empty string");
  }
  return result;
}

function expectOrdinal(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): number {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value < 0) {
    fail(sourceCode(source), path, "Expected a non-negative safe integer");
  }
  return value;
}

function expectDigest(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): Sha256Digest {
  if (!isSha256Digest(value)) {
    fail(sourceCode(source), path, "Expected a canonical SHA-256 digest");
  }
  return value;
}

function expectLiteral<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: ValidationPath,
  source: ErrorSource,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    fail(sourceCode(source), path, "Unexpected literal value");
  }
  return value;
}

function expectCanonicalUrl(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): string {
  const text = expectText(value, path, source);
  let canonical: string;
  try {
    canonical = canonicalizeModuleUrl(text);
  } catch {
    fail(sourceCode(source), path, "Expected an absolute module URL");
  }
  if (canonical !== text) {
    fail(sourceCode(source), path, "Module URL is not canonical");
  }
  return canonical;
}

function expectCanonicalData(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): CanonicalJsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (value instanceof Uint8Array) {
    fail(sourceCode(source), path, "Canonical metadata cannot contain bytes");
  }
  if (Array.isArray(value)) {
    return value.map((item, index) =>
      expectCanonicalData(item, [...path, index], source),
    );
  }
  if (typeof value === "object") {
    const result: { [key: string]: CanonicalJsonValue } = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = expectCanonicalData(item, [...path, key], source);
    }
    return result;
  }
  fail(sourceCode(source), path, "Expected canonical metadata");
}

function expectBytes(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): Uint8Array {
  if (!(value instanceof Uint8Array)) {
    fail(sourceCode(source), path, "Expected Uint8Array bytes");
  }
  return new Uint8Array(value);
}

function parseAttributes(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): readonly ModuleImportAttributeInput[] {
  const attributes = expectArray(value, path, source).map((item, index) => {
    const record = expectRecord(
      item,
      [...path, index],
      ["key", "value"],
      source,
    );
    return {
      key: expectText(record.key, [...path, index, "key"], source),
      value: expectText(record.value, [...path, index, "value"], source),
    };
  });
  const sorted = [...attributes].sort((left, right) => {
    const key = compareText(left.key, right.key);
    return key === 0 ? compareText(left.value, right.value) : key;
  });
  if (
    sorted.some((attribute, index) => attribute.key === sorted[index - 1]?.key)
  ) {
    fail(sourceCode(source), path, "Import attribute keys must be unique");
  }
  return sorted;
}

function parseRequest(
  value: unknown,
  path: ValidationPath,
  source: ErrorSource,
): ModuleCoordinatorResolutionRequest {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail(sourceCode(source), path, "Expected a resolution request");
  }
  const kindValue = (value as DataRecord).kind;
  if (kindValue === "native") {
    const record = expectRecord(
      value,
      path,
      ["kind", "phase", "specifier", "resolutionOriginUrl", "sourceAttributes"],
      source,
    );
    return {
      kind: "native",
      phase: expectLiteral(
        record.phase,
        ["source", "evaluation"],
        [...path, "phase"],
        source,
      ),
      specifier: expectText(record.specifier, [...path, "specifier"], source),
      resolutionOriginUrl: expectCanonicalUrl(
        record.resolutionOriginUrl,
        [...path, "resolutionOriginUrl"],
        source,
      ),
      sourceAttributes: parseAttributes(
        record.sourceAttributes,
        [...path, "sourceAttributes"],
        source,
      ),
    };
  }
  if (kindValue === "commonjs") {
    const record = expectRecord(
      value,
      path,
      ["kind", "specifier", "resolutionOriginUrl"],
      source,
    );
    return {
      kind: "commonjs",
      specifier: expectText(record.specifier, [...path, "specifier"], source),
      resolutionOriginUrl: expectCanonicalUrl(
        record.resolutionOriginUrl,
        [...path, "resolutionOriginUrl"],
        source,
      ),
    };
  }
  fail(sourceCode(source), [...path, "kind"], "Unknown request kind");
}

function parseBuildInput(value: unknown): ModuleCoordinatorBuildInput {
  const closed = snapshotClosed(value, [], "input");
  const record = expectRecord(closed, [], ["domains", "entries"], "input");
  const domains = expectArray(record.domains, ["domains"], "input").map(
    (item, index) => {
      const domain = expectRecord(
        item,
        ["domains", index],
        [
          "stableDomainKey",
          "domainConfigurationDigest",
          "targetEnvironmentId",
          "nativeModuleMapNamespaceDigest",
          "commonJsLoaderCacheNamespaceDigest",
        ],
        "input",
      );
      return {
        stableDomainKey: expectString(
          domain.stableDomainKey,
          ["domains", index, "stableDomainKey"],
          "input",
        ),
        domainConfigurationDigest: expectDigest(
          domain.domainConfigurationDigest,
          ["domains", index, "domainConfigurationDigest"],
          "input",
        ),
        targetEnvironmentId: expectString(
          domain.targetEnvironmentId,
          ["domains", index, "targetEnvironmentId"],
          "input",
        ),
        nativeModuleMapNamespaceDigest: expectDigest(
          domain.nativeModuleMapNamespaceDigest,
          ["domains", index, "nativeModuleMapNamespaceDigest"],
          "input",
        ),
        commonJsLoaderCacheNamespaceDigest: expectDigest(
          domain.commonJsLoaderCacheNamespaceDigest,
          ["domains", index, "commonJsLoaderCacheNamespaceDigest"],
          "input",
        ),
      };
    },
  );
  const entries = expectArray(record.entries, ["entries"], "input").map(
    (item, index) => {
      const entry = expectRecord(
        item,
        ["entries", index],
        [
          "stableDomainKey",
          "entryOrdinal",
          "entryKind",
          "entryContextDigest",
          "request",
        ],
        "input",
      );
      const request = parseRequest(
        entry.request,
        ["entries", index, "request"],
        "input",
      );
      if (request.kind === "native" && request.phase !== "evaluation") {
        fail(
          "invalid-input",
          ["entries", index, "request", "phase"],
          "Entries must be evaluation admissions",
          "entryOrdinal",
        );
      }
      return {
        stableDomainKey: expectString(
          entry.stableDomainKey,
          ["entries", index, "stableDomainKey"],
          "input",
        ),
        entryOrdinal: expectOrdinal(
          entry.entryOrdinal,
          ["entries", index, "entryOrdinal"],
          "input",
        ),
        entryKind: expectString(
          entry.entryKind,
          ["entries", index, "entryKind"],
          "input",
        ),
        entryContextDigest: expectDigest(
          entry.entryContextDigest,
          ["entries", index, "entryContextDigest"],
          "input",
        ),
        request,
      };
    },
  );

  const domainKeys = new Set<string>();
  for (const [index, domain] of domains.entries()) {
    if (domainKeys.has(domain.stableDomainKey)) {
      fail(
        "invalid-input",
        ["domains", index, "stableDomainKey"],
        "Stable domain keys must be unique",
        "stableDomainKey",
      );
    }
    domainKeys.add(domain.stableDomainKey);
  }
  const entriesByDomain = new Map<string, ModuleCoordinatorEntryInput[]>();
  for (const [index, entry] of entries.entries()) {
    if (!domainKeys.has(entry.stableDomainKey)) {
      fail(
        "invalid-input",
        ["entries", index, "stableDomainKey"],
        "Entry references an unknown stable domain",
        "stableDomainKey",
      );
    }
    const list = entriesByDomain.get(entry.stableDomainKey) ?? [];
    list.push(entry);
    entriesByDomain.set(entry.stableDomainKey, list);
  }
  for (const [stableDomainKey, domainEntries] of entriesByDomain) {
    const ordinals = domainEntries
      .map((entry) => entry.entryOrdinal)
      .sort((a, b) => a - b);
    if (ordinals.some((ordinal, index) => ordinal !== index)) {
      fail(
        "invalid-input",
        ["entries"],
        `Entry ordinals for ${stableDomainKey} must be dense from zero`,
        "entryOrdinal",
      );
    }
  }

  const result = {
    domains: [...domains].sort((left, right) =>
      compareText(left.stableDomainKey, right.stableDomainKey),
    ),
    entries: [...entries].sort((left, right) => {
      const domain = compareText(left.stableDomainKey, right.stableDomainKey);
      return domain === 0 ? left.entryOrdinal - right.entryOrdinal : domain;
    }),
  };
  deepFreeze(result);
  return result;
}

function resolveOptions(options: ModuleCoordinatorOptions): ResolvedOptions {
  const closed = snapshotClosed(options, ["options"], "input");
  const allowed = Object.keys(DEFAULT_OPTIONS);
  const record = expectAnyRecord(closed, ["options"], "input");
  for (const key of Object.keys(record)) {
    if (!allowed.includes(key)) {
      fail("invalid-input", ["options", key], "Unknown coordinator option");
    }
  }
  const result: DataRecord = { ...DEFAULT_OPTIONS };
  for (const [key, value] of Object.entries(record)) {
    result[key] = expectOrdinal(value, ["options", key], "input");
  }
  return {
    maxRetries: result.maxRetries as number,
    maxFixedPointRounds: result.maxFixedPointRounds as number,
    maxDomains: result.maxDomains as number,
    maxEntries: result.maxEntries as number,
    maxLoaderUnits: result.maxLoaderUnits as number,
    maxRuntimeUnits: result.maxRuntimeUnits as number,
    maxSemanticRequests: result.maxSemanticRequests as number,
    maxSites: result.maxSites as number,
    maxCandidates: result.maxCandidates as number,
    maxObservations: result.maxObservations as number,
    maxCacheEntries: result.maxCacheEntries as number,
    maxCacheBytes: result.maxCacheBytes as number,
  };
}

function canonicalStageValue(value: unknown): CanonicalJsonValue {
  if (value instanceof Uint8Array) {
    return {
      schema: "dathra.module-coordinator.bytes/1",
      bytes: Array.from(value),
    };
  }
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean" ||
    typeof value === "number"
  ) {
    return value;
  }
  if (Array.isArray(value)) return value.map(canonicalStageValue);
  if (typeof value === "object") {
    const result: { [key: string]: CanonicalJsonValue } = {};
    for (const [key, item] of Object.entries(value)) {
      result[key] = canonicalStageValue(item);
    }
    return result;
  }
  fail("adapter-contract", [], "Stage value cannot be canonically encoded");
}

function stageCacheSize(value: unknown): number {
  return canonicalizeJson(canonicalStageValue(value)).bytes.byteLength;
}

function checkBudget(
  value: number,
  limit: number,
  resource: keyof ResolvedOptions,
): void {
  if (value > limit) {
    fail(
      "budget-exceeded",
      [],
      `${resource} budget exceeded: ${value} > ${limit}`,
      resource,
    );
  }
}

function entryOwner(entry: ModuleCoordinatorEntryInput): string {
  return `entry:${entry.stableDomainKey}:${entry.entryOrdinal}`;
}

function runtimeOwner(domainId: string, runtimeDigest: string): string {
  return `runtime:${domainId}:${runtimeDigest}`;
}

function loaderOwner(loaderKey: string): string {
  return `loader:${loaderKey}`;
}

function joinPhase(
  left: ModuleImportPhase,
  right: ModuleImportPhase,
): ModuleImportPhase {
  return left === "evaluation" || right === "evaluation"
    ? "evaluation"
    : "source";
}

function cloneOwners(
  source: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, Set<string>> {
  return new Map([...source].map(([key, owners]) => [key, new Set(owners)]));
}

function cloneReverseGraph(
  source: ReadonlyMap<string, ReadonlySet<string>>,
): Map<string, Set<string>> {
  return cloneOwners(source);
}

function freezeSetMap(
  source: Map<string, Set<string>>,
): ReadonlyMap<string, ReadonlySet<string>> {
  return new Map(
    [...source]
      .sort(([left], [right]) => compareText(left, right))
      .map(([key, values]) => [key, new Set([...values].sort())]),
  );
}

function emptyCommittedState(): CommittedState {
  return {
    generation: 0,
    snapshot: null,
    cache: new Map(),
    cacheBytes: 0,
    observations: new Map(),
    observationOwners: new Map(),
    entryToRuntime: new Map(),
    targetToImporters: new Map(),
  };
}

function parseObservations(
  value: unknown,
  path: ValidationPath,
): readonly ModuleCoordinatorObservation[] {
  const observations = expectArray(value, path, "adapter").map(
    (item, index) => {
      const record = expectRecord(
        item,
        [...path, index],
        ["kind", "key", "digest"],
        "adapter",
      );
      return {
        kind: expectLiteral(
          record.kind,
          ["present", "absent"],
          [...path, index, "kind"],
          "adapter",
        ),
        key: expectString(record.key, [...path, index, "key"], "adapter"),
        digest: expectDigest(
          record.digest,
          [...path, index, "digest"],
          "adapter",
        ),
      };
    },
  );
  if (!observations.some((observation) => observation.kind === "present")) {
    fail(
      "adapter-contract",
      path,
      "Every observed stage must report a present observation",
      "observations",
    );
  }
  if (!observations.some((observation) => observation.kind === "absent")) {
    fail(
      "adapter-contract",
      path,
      "Every observed stage must report an absent observation",
      "observations",
    );
  }
  const byKey = new Map<string, ModuleCoordinatorObservation>();
  for (const observation of observations) {
    const existing = byKey.get(observation.key);
    if (existing === undefined) {
      byKey.set(observation.key, observation);
      continue;
    }
    if (
      existing.digest !== observation.digest ||
      existing.kind !== observation.kind
    ) {
      fail(
        "observation-conflict",
        path,
        `Observation ${observation.key} has conflicting values`,
        "observations",
      );
    }
    fail(
      "adapter-contract",
      path,
      `Observation ${observation.key} is duplicated`,
      "observations",
    );
  }
  const result = [...byKey.values()].sort((left, right) =>
    compareText(left.key, right.key),
  );
  deepFreeze(result);
  return result;
}

function parseCacheDisposition(
  value: unknown,
  path: ValidationPath,
): ModuleCoordinatorCacheDisposition {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    fail("adapter-contract", path, "Expected a cache disposition");
  }
  const kind = (value as DataRecord).kind;
  if (kind === "replayable") {
    const record = expectRecord(
      value,
      path,
      ["kind", "replayToken"],
      "adapter",
    );
    return {
      kind,
      replayToken: expectCanonicalData(
        record.replayToken,
        [...path, "replayToken"],
        "adapter",
      ),
    };
  }
  const record = expectRecord(value, path, ["kind"], "adapter");
  return {
    kind: expectLiteral(
      record.kind,
      ["pure", "transaction-local"],
      [...path, "kind"],
      "adapter",
    ),
  };
}

function parsePipelineResult(value: unknown): DescribePipelineResult {
  const closed = snapshotClosed(value, ["describePipeline"], "adapter");
  const record = expectRecord(
    closed,
    ["describePipeline"],
    ["profile", "observations"],
    "adapter",
  );
  const profile = expectRecord(
    record.profile,
    ["describePipeline", "profile"],
    [
      "aggregateAdapterProfileDigest",
      "resolverProfileDigest",
      "loadProfileDigest",
      "transformPipelineDigest",
      "loaderSemanticsDigest",
      "importMetaSemanticsDigest",
      "extractorProfileDigest",
    ],
    "adapter",
  );
  const result = {
    profile: {
      aggregateAdapterProfileDigest: expectDigest(
        profile.aggregateAdapterProfileDigest,
        ["describePipeline", "profile", "aggregateAdapterProfileDigest"],
        "adapter",
      ),
      resolverProfileDigest: expectDigest(
        profile.resolverProfileDigest,
        ["describePipeline", "profile", "resolverProfileDigest"],
        "adapter",
      ),
      loadProfileDigest: expectDigest(
        profile.loadProfileDigest,
        ["describePipeline", "profile", "loadProfileDigest"],
        "adapter",
      ),
      transformPipelineDigest: expectDigest(
        profile.transformPipelineDigest,
        ["describePipeline", "profile", "transformPipelineDigest"],
        "adapter",
      ),
      loaderSemanticsDigest: expectDigest(
        profile.loaderSemanticsDigest,
        ["describePipeline", "profile", "loaderSemanticsDigest"],
        "adapter",
      ),
      importMetaSemanticsDigest: expectDigest(
        profile.importMetaSemanticsDigest,
        ["describePipeline", "profile", "importMetaSemanticsDigest"],
        "adapter",
      ),
      extractorProfileDigest: expectDigest(
        profile.extractorProfileDigest,
        ["describePipeline", "profile", "extractorProfileDigest"],
        "adapter",
      ),
    },
    observations: parseObservations(record.observations, [
      "describePipeline",
      "observations",
    ]),
  };
  deepFreeze(result);
  return result;
}

function parseConditionProfile(
  value: unknown,
  path: ValidationPath,
): {
  readonly activeSet: readonly string[];
  readonly observableSequence: readonly string[];
} {
  const record = expectRecord(
    value,
    path,
    ["activeSet", "observableSequence"],
    "adapter",
  );
  const activeSet = expectArray(
    record.activeSet,
    [...path, "activeSet"],
    "adapter",
  )
    .map((item, index) =>
      expectString(item, [...path, "activeSet", index], "adapter"),
    )
    .sort();
  if (
    activeSet.some((condition, index) => condition === activeSet[index - 1])
  ) {
    fail(
      "adapter-contract",
      [...path, "activeSet"],
      "Active conditions must be unique",
    );
  }
  const observableSequence = expectArray(
    record.observableSequence,
    [...path, "observableSequence"],
    "adapter",
  ).map((item, index) =>
    expectString(item, [...path, "observableSequence", index], "adapter"),
  );
  return { activeSet, observableSequence };
}

function parseDomainResult(value: unknown): DescribeDomainResult {
  const closed = snapshotClosed(value, ["describeDomain"], "adapter");
  const record = expectRecord(
    closed,
    ["describeDomain"],
    [
      "resolverInputTranscriptDigest",
      "moduleMapSemanticsDigest",
      "esmConditions",
      "commonJsConditions",
      "observations",
      "cache",
    ],
    "adapter",
  );
  const result = {
    resolverInputTranscriptDigest: expectDigest(
      record.resolverInputTranscriptDigest,
      ["describeDomain", "resolverInputTranscriptDigest"],
      "adapter",
    ),
    moduleMapSemanticsDigest: expectDigest(
      record.moduleMapSemanticsDigest,
      ["describeDomain", "moduleMapSemanticsDigest"],
      "adapter",
    ),
    esmConditions: parseConditionProfile(record.esmConditions, [
      "describeDomain",
      "esmConditions",
    ]),
    commonJsConditions: parseConditionProfile(record.commonJsConditions, [
      "describeDomain",
      "commonJsConditions",
    ]),
    observations: parseObservations(record.observations, [
      "describeDomain",
      "observations",
    ]),
    cache: parseCacheDisposition(record.cache, ["describeDomain", "cache"]),
  };
  deepFreeze(result);
  return result;
}

function parseResolveResult(value: unknown): ResolveModuleResult {
  const closed = snapshotClosed(value, ["resolve"], "adapter");
  const record = expectRecord(
    closed,
    ["resolve"],
    ["target", "evidence", "observations", "cache"],
    "adapter",
  );
  const target = expectRecord(
    record.target,
    ["resolve", "target"],
    [
      "namespaceKind",
      "moduleMapUrl",
      "moduleMapType",
      "effectiveAttributes",
      "cacheKeyDigest",
      "loaderContextDigest",
    ],
    "adapter",
  );
  const evidence = expectRecord(
    record.evidence,
    ["resolve", "evidence"],
    [
      "observedConditionSequence",
      "redirectEvidenceDigest",
      "resolverTraceDigest",
    ],
    "adapter",
  );
  const result = {
    target: {
      namespaceKind: expectLiteral(
        target.namespaceKind,
        ["native", "commonjs"],
        ["resolve", "target", "namespaceKind"],
        "adapter",
      ),
      moduleMapUrl: expectCanonicalUrl(
        target.moduleMapUrl,
        ["resolve", "target", "moduleMapUrl"],
        "adapter",
      ),
      moduleMapType: expectString(
        target.moduleMapType,
        ["resolve", "target", "moduleMapType"],
        "adapter",
      ),
      effectiveAttributes: parseAttributes(
        target.effectiveAttributes,
        ["resolve", "target", "effectiveAttributes"],
        "adapter",
      ),
      cacheKeyDigest: expectDigest(
        target.cacheKeyDigest,
        ["resolve", "target", "cacheKeyDigest"],
        "adapter",
      ),
      loaderContextDigest: expectDigest(
        target.loaderContextDigest,
        ["resolve", "target", "loaderContextDigest"],
        "adapter",
      ),
    },
    evidence: {
      observedConditionSequence: expectArray(
        evidence.observedConditionSequence,
        ["resolve", "evidence", "observedConditionSequence"],
        "adapter",
      ).map((item, index) =>
        expectString(
          item,
          ["resolve", "evidence", "observedConditionSequence", index],
          "adapter",
        ),
      ),
      redirectEvidenceDigest: expectDigest(
        evidence.redirectEvidenceDigest,
        ["resolve", "evidence", "redirectEvidenceDigest"],
        "adapter",
      ),
      resolverTraceDigest: expectDigest(
        evidence.resolverTraceDigest,
        ["resolve", "evidence", "resolverTraceDigest"],
        "adapter",
      ),
    },
    observations: parseObservations(record.observations, [
      "resolve",
      "observations",
    ]),
    cache: parseCacheDisposition(record.cache, ["resolve", "cache"]),
  };
  deepFreeze(result);
  return result;
}

function parseExternalDefinitionAttestation(
  value: unknown,
): ExternalModuleDefinitionContractInput {
  const record = expectRecord(
    value,
    ["load", "definitionAttestation"],
    [
      "externalDefinitionKind",
      "definitionSemanticsDigest",
      "moduleSourceSemanticsDigest",
      "transitiveDependencyOwnershipDigest",
      "moduleBytesCorrespondenceDigest",
    ],
    "adapter",
  );
  return {
    externalDefinitionKind: expectString(
      record.externalDefinitionKind,
      ["load", "definitionAttestation", "externalDefinitionKind"],
      "adapter",
    ),
    definitionSemanticsDigest: expectDigest(
      record.definitionSemanticsDigest,
      ["load", "definitionAttestation", "definitionSemanticsDigest"],
      "adapter",
    ),
    moduleSourceSemanticsDigest: expectDigest(
      record.moduleSourceSemanticsDigest,
      ["load", "definitionAttestation", "moduleSourceSemanticsDigest"],
      "adapter",
    ),
    transitiveDependencyOwnershipDigest: expectDigest(
      record.transitiveDependencyOwnershipDigest,
      ["load", "definitionAttestation", "transitiveDependencyOwnershipDigest"],
      "adapter",
    ),
    moduleBytesCorrespondenceDigest: expectDigest(
      record.moduleBytesCorrespondenceDigest,
      ["load", "definitionAttestation", "moduleBytesCorrespondenceDigest"],
      "adapter",
    ),
  };
}

function parseLoadResult(value: unknown): LoadModuleResult {
  const closed = snapshotClosed(value, ["load"], "adapter");
  if (closed === null || typeof closed !== "object" || Array.isArray(closed)) {
    fail("adapter-contract", ["load"], "Expected a loader result");
  }
  const kind = (closed as DataRecord).kind;
  const commonKeys = [
    "kind",
    "canonicalSourceUrl",
    "moduleBaseUrl",
    "runtimeModuleIdentityDigest",
    "responseMetadata",
    "observations",
    "cache",
  ];
  const keys =
    kind === "content"
      ? [...commonKeys, "sourceBytes"]
      : [...commonKeys, "definitionAttestation", "runtimeAttestation"];
  const record = expectRecord(closed, ["load"], keys, "adapter");
  const base = {
    canonicalSourceUrl: expectCanonicalUrl(
      record.canonicalSourceUrl,
      ["load", "canonicalSourceUrl"],
      "adapter",
    ),
    moduleBaseUrl: expectCanonicalUrl(
      record.moduleBaseUrl,
      ["load", "moduleBaseUrl"],
      "adapter",
    ),
    runtimeModuleIdentityDigest: expectDigest(
      record.runtimeModuleIdentityDigest,
      ["load", "runtimeModuleIdentityDigest"],
      "adapter",
    ),
    responseMetadata: expectCanonicalData(
      record.responseMetadata,
      ["load", "responseMetadata"],
      "adapter",
    ),
    observations: parseObservations(record.observations, [
      "load",
      "observations",
    ]),
    cache: parseCacheDisposition(record.cache, ["load", "cache"]),
  };
  if (kind === "content") {
    const result: ContentLoadModuleResult = {
      ...base,
      kind,
      sourceBytes: expectBytes(
        record.sourceBytes,
        ["load", "sourceBytes"],
        "adapter",
      ),
    };
    deepFreeze(result);
    return result;
  }
  if (kind !== "external") {
    fail("adapter-contract", ["load", "kind"], "Unknown loader result kind");
  }
  const runtime = expectRecord(
    record.runtimeAttestation,
    ["load", "runtimeAttestation"],
    ["runtimeSemanticsDigest", "phaseCoherenceEvidenceDigest"],
    "adapter",
  );
  const result: ExternalLoadModuleResult = {
    ...base,
    kind,
    definitionAttestation: parseExternalDefinitionAttestation(
      record.definitionAttestation,
    ),
    runtimeAttestation: {
      runtimeSemanticsDigest: expectDigest(
        runtime.runtimeSemanticsDigest,
        ["load", "runtimeAttestation", "runtimeSemanticsDigest"],
        "adapter",
      ),
      phaseCoherenceEvidenceDigest: expectDigest(
        runtime.phaseCoherenceEvidenceDigest,
        ["load", "runtimeAttestation", "phaseCoherenceEvidenceDigest"],
        "adapter",
      ),
    },
  };
  deepFreeze(result);
  return result;
}

function parseTransformResult(value: unknown): TransformModuleResult {
  const closed = snapshotClosed(value, ["transform"], "adapter");
  const record = expectRecord(
    closed,
    ["transform"],
    [
      "transformedBytes",
      "definitionKind",
      "parseGoal",
      "transformMetadataDigest",
      "observations",
      "cache",
    ],
    "adapter",
  );
  const definitionKind = expectLiteral(
    record.definitionKind,
    [
      "ecmascript-module",
      "ecmascript-script",
      "commonjs",
      "json",
      "wasm",
      "css",
      "text",
    ],
    ["transform", "definitionKind"],
    "adapter",
  );
  const parseGoal = expectLiteral(
    record.parseGoal,
    ["module", "script", "commonjs", "json", "wasm", "css", "text"],
    ["transform", "parseGoal"],
    "adapter",
  );
  if (DEFINITION_PARSE_GOAL[definitionKind] !== parseGoal) {
    fail(
      "adapter-contract",
      ["transform", "parseGoal"],
      "Definition kind and parse goal do not match",
    );
  }
  const result = {
    transformedBytes: expectBytes(
      record.transformedBytes,
      ["transform", "transformedBytes"],
      "adapter",
    ),
    definitionKind,
    parseGoal,
    transformMetadataDigest: expectDigest(
      record.transformMetadataDigest,
      ["transform", "transformMetadataDigest"],
      "adapter",
    ),
    observations: parseObservations(record.observations, [
      "transform",
      "observations",
    ]),
    cache: parseCacheDisposition(record.cache, ["transform", "cache"]),
  };
  deepFreeze(result);
  return result;
}

function parseExtractResult(value: unknown): ExtractModuleResult {
  const closed = snapshotClosed(value, ["extract"], "adapter");
  const record = expectRecord(
    closed,
    ["extract"],
    ["sites", "observations", "cache"],
    "adapter",
  );
  const sites = expectArray(record.sites, ["extract", "sites"], "adapter").map(
    (item, index) => {
      const site = expectRecord(
        item,
        ["extract", "sites", index],
        [
          "kind",
          "phase",
          "normalizedSyntaxDigest",
          "candidates",
          "candidateCoverageProofDigest",
        ],
        "adapter",
      );
      const kind = expectLiteral(
        site.kind,
        [
          "static-import",
          "dynamic-import",
          "commonjs-require",
          "wasm-import",
          "css-import",
        ],
        ["extract", "sites", index, "kind"],
        "adapter",
      );
      const phase =
        site.phase === null
          ? null
          : expectLiteral(
              site.phase,
              ["source", "evaluation"],
              ["extract", "sites", index, "phase"],
              "adapter",
            );
      if ((kind === "commonjs-require") !== (phase === null)) {
        fail(
          "adapter-contract",
          ["extract", "sites", index, "phase"],
          "Only CommonJS sites use a null phase",
        );
      }
      const candidates = expectArray(
        site.candidates,
        ["extract", "sites", index, "candidates"],
        "adapter",
      ).map((candidate, candidateIndex) =>
        parseRequest(
          candidate,
          ["extract", "sites", index, "candidates", candidateIndex],
          "adapter",
        ),
      );
      if (candidates.length === 0) {
        fail(
          "adapter-contract",
          ["extract", "sites", index, "candidates"],
          "Every extracted site needs a finite non-empty candidate set",
        );
      }
      if (
        kind !== "dynamic-import" &&
        kind !== "commonjs-require" &&
        candidates.length !== 1
      ) {
        fail(
          "adapter-contract",
          ["extract", "sites", index, "candidates"],
          "Static sites require exactly one candidate",
        );
      }
      return {
        kind,
        phase,
        normalizedSyntaxDigest: expectDigest(
          site.normalizedSyntaxDigest,
          ["extract", "sites", index, "normalizedSyntaxDigest"],
          "adapter",
        ),
        candidates,
        candidateCoverageProofDigest: expectDigest(
          site.candidateCoverageProofDigest,
          ["extract", "sites", index, "candidateCoverageProofDigest"],
          "adapter",
        ),
      };
    },
  );
  const result = {
    sites,
    observations: parseObservations(record.observations, [
      "extract",
      "observations",
    ]),
    cache: parseCacheDisposition(record.cache, ["extract", "cache"]),
  };
  deepFreeze(result);
  return result;
}

function parseCommitResult(value: unknown): ModuleCoordinatorCommitResult {
  const closed = snapshotClosed(value, ["tryCommit"], "adapter");
  if (closed === null || typeof closed !== "object" || Array.isArray(closed)) {
    fail("adapter-contract", ["tryCommit"], "Expected a commit result");
  }
  const kind = (closed as DataRecord).kind;
  if (kind === "invalidated") {
    const record = expectRecord(
      closed,
      ["tryCommit"],
      ["kind", "changedObservationKeys"],
      "adapter",
    );
    const changedObservationKeys = expectArray(
      record.changedObservationKeys,
      ["tryCommit", "changedObservationKeys"],
      "adapter",
    ).map((item, index) =>
      expectString(
        item,
        ["tryCommit", "changedObservationKeys", index],
        "adapter",
      ),
    );
    const canonical = [...new Set(changedObservationKeys)].sort();
    if (
      canonical.length !== changedObservationKeys.length ||
      canonical.some((key, index) => key !== changedObservationKeys[index])
    ) {
      fail(
        "adapter-contract",
        ["tryCommit", "changedObservationKeys"],
        "Changed observation keys must be a canonical set",
      );
    }
    return { kind, changedObservationKeys: canonical };
  }
  const record = expectRecord(
    closed,
    ["tryCommit"],
    [
      "kind",
      "transactionId",
      "snapshotId",
      "adapterProfileDigest",
      "observationSetDigest",
    ],
    "adapter",
  );
  return {
    kind: expectLiteral(
      record.kind,
      ["committed"],
      ["tryCommit", "kind"],
      "adapter",
    ),
    transactionId: expectString(
      record.transactionId,
      ["tryCommit", "transactionId"],
      "adapter",
    ),
    snapshotId: expectDigest(
      record.snapshotId,
      ["tryCommit", "snapshotId"],
      "adapter",
    ) as ModuleGraphSnapshotId,
    adapterProfileDigest: expectDigest(
      record.adapterProfileDigest,
      ["tryCommit", "adapterProfileDigest"],
      "adapter",
    ),
    observationSetDigest: expectDigest(
      record.observationSetDigest,
      ["tryCommit", "observationSetDigest"],
      "adapter",
    ),
  };
}

interface AttemptStageRecord {
  readonly stage: ModuleCoordinatorStageKind;
  readonly stageKey: Sha256Digest;
  readonly result: unknown;
  readonly resultDigest: Sha256Digest;
  readonly observations: readonly ModuleCoordinatorObservation[];
  readonly disposition: ModuleCoordinatorCacheDisposition;
  readonly owners: Set<string>;
  readonly generation: number;
  readonly byteSize: number;
}

class AttemptContext {
  readonly observations = new Map<string, ModuleCoordinatorObservation>();
  readonly observationOwners = new Map<string, Set<string>>();
  readonly stageRecords = new Map<string, AttemptStageRecord>();
  readonly persistentStageKeys = new Set<string>();

  constructor(
    readonly transaction: ModuleCoordinatorAdapterTransaction,
    readonly availableCache: ReadonlyMap<string, CacheEntry>,
    readonly nextGeneration: number,
    readonly limits: ResolvedOptions,
  ) {}

  addObservations(
    observations: readonly ModuleCoordinatorObservation[],
    owner: string,
  ): void {
    for (const observation of observations) {
      const existing = this.observations.get(observation.key);
      if (
        existing !== undefined &&
        (existing.digest !== observation.digest ||
          existing.kind !== observation.kind)
      ) {
        fail(
          "observation-conflict",
          ["observations"],
          `Observation ${observation.key} changed during one attempt`,
          "observations",
        );
      }
      this.observations.set(observation.key, observation);
      const owners =
        this.observationOwners.get(observation.key) ?? new Set<string>();
      owners.add(owner);
      this.observationOwners.set(observation.key, owners);
    }
    checkBudget(
      this.observations.size,
      this.limits.maxObservations,
      "maxObservations",
    );
  }

  associateOwner(stageKey: string, owner: string): void {
    const stage = this.stageRecords.get(stageKey);
    if (stage === undefined) return;
    stage.owners.add(owner);
    this.addObservations(stage.observations, owner);
  }

  async runStage<
    T extends {
      readonly observations: readonly ModuleCoordinatorObservation[];
      readonly cache: ModuleCoordinatorCacheDisposition;
    },
  >(input: {
    readonly stage: ModuleCoordinatorStageKind;
    readonly adapterProfileDigest: Sha256Digest;
    readonly stageProfileDigest: Sha256Digest;
    readonly domainIdentity: string;
    readonly operationInput: unknown;
    readonly owner: string;
    readonly invoke: () => Promise<unknown>;
    readonly parse: (value: unknown) => T;
  }): Promise<StageExecution<T>> {
    const stageKey = await digestCanonicalJson({
      schema: "dathra.module-coordinator.stage-key/1",
      stage: input.stage,
      aggregateAdapterProfileDigest: input.adapterProfileDigest,
      stageProfileDigest: input.stageProfileDigest,
      domainIdentity: input.domainIdentity,
      operationInput: canonicalStageValue(input.operationInput),
    });
    const local = this.stageRecords.get(stageKey);
    if (local !== undefined) {
      this.associateOwner(stageKey, input.owner);
      return { value: local.result as T, stageKey };
    }

    const cached = this.availableCache.get(stageKey);
    if (cached !== undefined) {
      if (cached.stage !== input.stage) {
        fail(
          "adapter-contract",
          ["cache"],
          "Cached stage kind does not match its key",
        );
      }
      if (cached.disposition.kind === "replayable") {
        const replayInput: ReplayCachedStageInput = {
          schema: "dathra.module-coordinator.replay-cached-stage/1",
          stageKey,
          resultDigest: cached.resultDigest,
          replayToken: cached.disposition.replayToken,
        };
        deepFreeze(replayInput);
        await this.transaction.replayCachedStage(replayInput);
      }
      const record: AttemptStageRecord = {
        stage: input.stage,
        stageKey,
        result: cached.result,
        resultDigest: cached.resultDigest,
        observations: cached.observations,
        disposition: cached.disposition,
        owners: new Set([input.owner]),
        generation: cached.generation,
        byteSize: cached.byteSize,
      };
      this.stageRecords.set(stageKey, record);
      this.persistentStageKeys.add(stageKey);
      this.addObservations(cached.observations, input.owner);
      return { value: cached.result as T, stageKey };
    }

    deepFreeze(input.operationInput);
    const result = input.parse(await input.invoke());
    const resultDigest = await digestCanonicalJson(canonicalStageValue(result));
    const record: AttemptStageRecord = {
      stage: input.stage,
      stageKey,
      result,
      resultDigest,
      observations: result.observations,
      disposition: result.cache,
      owners: new Set([input.owner]),
      generation: this.nextGeneration,
      byteSize: stageCacheSize(result),
    };
    this.stageRecords.set(stageKey, record);
    this.addObservations(result.observations, input.owner);
    if (result.cache.kind !== "transaction-local") {
      this.persistentStageKeys.add(stageKey);
    }
    return { value: result, stageKey };
  }
}

function filterCommittedCache(
  state: CommittedState,
  changedObservationKeys: ReadonlySet<string>,
): Map<string, CacheEntry> {
  if (changedObservationKeys.size === 0) return new Map(state.cache);
  const invalidatedOwners = new Set<string>();
  let global = false;
  for (const key of changedObservationKeys) {
    for (const owner of state.observationOwners.get(key) ?? []) {
      if (owner === "global") global = true;
      invalidatedOwners.add(owner);
      const mapped = state.entryToRuntime.get(owner);
      if (mapped !== undefined) invalidatedOwners.add(mapped);
    }
  }
  if (global) return new Map();

  const pending = [...invalidatedOwners];
  while (pending.length > 0) {
    const target = pending.pop();
    if (target === undefined) continue;
    for (const importer of state.targetToImporters.get(target) ?? []) {
      if (invalidatedOwners.has(importer)) continue;
      invalidatedOwners.add(importer);
      pending.push(importer);
    }
  }

  const result = new Map<string, CacheEntry>();
  for (const [key, entry] of state.cache) {
    const directlyChanged = entry.observations.some((observation) =>
      changedObservationKeys.has(observation.key),
    );
    const ownerChanged = entry.owners.some((owner) =>
      invalidatedOwners.has(owner),
    );
    if (!directlyChanged && !ownerChanged) result.set(key, entry);
  }
  return result;
}

interface DomainWork {
  readonly input: ModuleCoordinatorDomainInput;
  readonly domain: ModuleResolutionDomain;
}

interface EntryWork {
  readonly input: ModuleCoordinatorEntryInput;
  readonly domain: DomainWork;
  targetLoaderKey: string | null;
}

interface ResolutionTask {
  readonly key: string;
  readonly domain: DomainWork;
  readonly request: ModuleCoordinatorResolutionRequest;
  readonly requester: ResolveModuleRequester;
  readonly requiredPhase: ModuleImportPhase;
  readonly owner: string;
  readonly entry: EntryWork | null;
  readonly semanticRequestId: string | null;
}

interface RequestWork {
  readonly request: SemanticModuleRequest;
  readonly requestInput: ModuleCoordinatorResolutionRequest;
  readonly importer: RuntimeUnit;
  targetLoaderKey: string | null;
  resolveResult: ResolveModuleResult | null;
}

interface LoaderUnit {
  readonly key: Sha256Digest;
  readonly domain: DomainWork;
  readonly target: ResolvedLoaderTarget;
  readonly resolveStageKeys: Set<string>;
  requiredPhase: ModuleImportPhase;
  loadResult: LoadModuleResult | null;
  loadStageKey: string | null;
  runtimeKey: string | null;
  loaderEntry: ModuleLoaderEntry | null;
}

interface SiteWork {
  readonly runtime: RuntimeUnit;
  readonly inventoryOrdinal: number;
  readonly descriptor: ExtractedModuleRequestSite;
  readonly semanticRequestIds: SemanticModuleRequestId[];
}

interface ValidatedCandidate {
  readonly candidate: ModuleCoordinatorResolutionRequest;
  readonly request: SemanticModuleRequest;
}

interface RuntimeUnit {
  readonly key: string;
  readonly domain: DomainWork;
  readonly runtimeModuleIdentityDigest: Sha256Digest;
  readonly loadSemanticDigest: Sha256Digest;
  readonly loadResult: LoadModuleResult;
  readonly loaderKeys: Set<string>;
  phase: ModuleImportPhase;
  processed: boolean;
  sitesEnqueued: boolean;
  semanticProfile: ModuleSemanticProfile | null;
  inventory: ModuleRequestInventory | null;
  externalContract: ExternalModuleDefinitionContract | null;
  definition: ModuleDefinition | null;
  binding: RuntimeModuleBinding | null;
  extractedSites: readonly ExtractedModuleRequestSite[];
  validatedCandidates: readonly (readonly ValidatedCandidate[])[];
}

interface PreparedAttempt {
  readonly snapshot: ModuleGraphSnapshot;
  readonly context: AttemptContext;
  readonly cache: ReadonlyMap<string, CacheEntry>;
  readonly cacheBytes: number;
  readonly observationSetDigest: Sha256Digest;
  readonly exactObservations: readonly ModuleCoordinatorObservation[];
  readonly entryToRuntime: ReadonlyMap<string, string>;
  readonly targetToImporters: ReadonlyMap<string, ReadonlySet<string>>;
}

interface QueuedBuild {
  readonly input: ModuleCoordinatorBuildInput;
  readonly options: ParsedBuildOptions;
  readonly resolve: (result: ModuleCoordinatorBuildResult) => void;
  readonly reject: (reason: unknown) => void;
}

interface FixedPointState {
  readonly domains: Map<string, DomainWork>;
  readonly entries: EntryWork[];
  readonly resolutionTasks: Map<string, ResolutionTask>;
  readonly requestWorks: Map<string, RequestWork>;
  readonly loaderUnits: Map<string, LoaderUnit>;
  readonly runtimeUnits: Map<string, RuntimeUnit>;
  readonly siteWorks: SiteWork[];
  readonly semanticProfiles: Map<string, ModuleSemanticProfile>;
  readonly inventories: Map<string, ModuleRequestInventory>;
  readonly externalContracts: Map<string, ExternalModuleDefinitionContract>;
  readonly definitions: Map<string, ModuleDefinition>;
  readonly bindings: Map<string, RuntimeModuleBinding>;
  readonly loaderEntries: Map<string, ModuleLoaderEntry>;
  readonly semanticRequests: Map<string, SemanticModuleRequest>;
  readonly resolutionEvidence: Map<string, ModuleResolutionEvidence>;
  readonly resolvedRequests: Map<string, ResolvedModuleRequest>;
  readonly siteEvidence: Map<string, ModuleRequestSiteEvidence>;
  readonly requestSites: Map<string, ModuleRequestSite>;
  readonly graphEntries: Map<string, ModuleGraphEntry>;
  readonly externalRuntimeEvidence: Map<string, ExternalRuntimeClosureEvidence>;
  readonly pendingLoads: Set<string>;
  readonly pendingRuntimeProcessing: Set<string>;
  readonly entryToRuntime: Map<string, string>;
  readonly targetToImporters: Map<string, Set<string>>;
  siteCount: number;
  candidateCount: number;
  fixedPointRounds: number;
}

function createFixedPointState(
  domains: Map<string, DomainWork>,
): FixedPointState {
  return {
    domains,
    entries: [],
    resolutionTasks: new Map(),
    requestWorks: new Map(),
    loaderUnits: new Map(),
    runtimeUnits: new Map(),
    siteWorks: [],
    semanticProfiles: new Map(),
    inventories: new Map(),
    externalContracts: new Map(),
    definitions: new Map(),
    bindings: new Map(),
    loaderEntries: new Map(),
    semanticRequests: new Map(),
    resolutionEvidence: new Map(),
    resolvedRequests: new Map(),
    siteEvidence: new Map(),
    requestSites: new Map(),
    graphEntries: new Map(),
    externalRuntimeEvidence: new Map(),
    pendingLoads: new Set(),
    pendingRuntimeProcessing: new Set(),
    entryToRuntime: new Map(),
    targetToImporters: new Map(),
    siteCount: 0,
    candidateCount: 0,
    fixedPointRounds: 0,
  };
}

async function digestLoaderTarget(
  domain: ModuleResolutionDomain,
  target: ResolvedLoaderTarget,
): Promise<Sha256Digest> {
  return await digestCanonicalJson({
    schema: "dathra.module-coordinator.loader-unit/1",
    resolutionDomainId: domain.id,
    namespaceKind: target.namespaceKind,
    moduleMapUrl: target.moduleMapUrl,
    moduleMapType: target.moduleMapType,
    effectiveAttributes: target.effectiveAttributes,
    cacheKeyDigest: target.cacheKeyDigest,
    loaderContextDigest: target.loaderContextDigest,
  });
}

async function digestLoadSemantics(
  result: LoadModuleResult,
): Promise<Sha256Digest> {
  const common = {
    canonicalSourceUrl: result.canonicalSourceUrl,
    moduleBaseUrl: result.moduleBaseUrl,
    runtimeModuleIdentityDigest: result.runtimeModuleIdentityDigest,
    responseMetadata: result.responseMetadata,
  };
  return await digestCanonicalJson(
    result.kind === "content"
      ? {
          schema: "dathra.module-coordinator.content-load-semantics/1",
          ...common,
          sourceBytes: canonicalStageValue(result.sourceBytes),
        }
      : {
          schema: "dathra.module-coordinator.external-load-semantics/1",
          ...common,
          definitionAttestation: result.definitionAttestation,
          runtimeAttestation: result.runtimeAttestation,
        },
  );
}

function requiredPhaseForRequest(
  request: ModuleCoordinatorResolutionRequest,
): ModuleImportPhase {
  return request.kind === "commonjs" ? "evaluation" : request.phase;
}

function assertResolvedTargetKind(
  request: ModuleCoordinatorResolutionRequest,
  target: ResolvedLoaderTarget,
): void {
  const expected = request.kind === "native" ? "native" : "commonjs";
  if (target.namespaceKind !== expected) {
    fail(
      "adapter-contract",
      ["resolve", "target", "namespaceKind"],
      "Resolved loader namespace does not match request semantics",
    );
  }
}

async function ensureLoaderEntry(
  state: FixedPointState,
  loader: LoaderUnit,
  runtime: RuntimeUnit,
): Promise<void> {
  if (loader.loaderEntry !== null) return;
  if (runtime.binding === null) {
    fail(
      "fixed-point-stall",
      [],
      "Runtime binding is unavailable",
      "runtimeBinding",
    );
  }
  const entry = await createModuleLoaderEntry({
    resolutionDomainId: runtime.domain.domain.id,
    namespaceKind: loader.target.namespaceKind,
    moduleMapUrl: loader.target.moduleMapUrl,
    moduleMapType: loader.target.moduleMapType,
    effectiveAttributes: loader.target.effectiveAttributes,
    cacheKeyDigest: loader.target.cacheKeyDigest,
    runtimeBindingId: runtime.binding.id,
  });
  loader.loaderEntry = entry;
  state.loaderEntries.set(entry.id, entry);
}

function addReverseEdge(
  graph: Map<string, Set<string>>,
  target: string,
  importer: string,
): void {
  const importers = graph.get(target) ?? new Set<string>();
  importers.add(importer);
  graph.set(target, importers);
}

async function validateRuntimeCandidates(
  runtime: RuntimeUnit,
): Promise<readonly (readonly ValidatedCandidate[])[]> {
  if (runtime.binding === null) {
    fail("fixed-point-stall", [], "Candidate importer binding is unavailable");
  }
  const sites: ValidatedCandidate[][] = [];
  for (const [
    inventoryOrdinal,
    descriptor,
  ] of runtime.extractedSites.entries()) {
    const seen = new Set<string>();
    const candidates: ValidatedCandidate[] = [];
    for (const candidate of descriptor.candidates) {
      if (
        candidate.resolutionOriginUrl !== runtime.binding.preimage.moduleBaseUrl
      ) {
        fail(
          "adapter-contract",
          ["extract", "sites", inventoryOrdinal, "candidates"],
          "Module request resolution origin must equal the importer base URL",
        );
      }
      if (
        descriptor.kind === "commonjs-require"
          ? candidate.kind !== "commonjs"
          : candidate.kind !== "native"
      ) {
        fail(
          "adapter-contract",
          ["extract", "sites", inventoryOrdinal, "candidates"],
          "Candidate request kind does not match its source site",
        );
      }
      if (candidate.kind === "native" && candidate.phase !== descriptor.phase) {
        fail(
          "adapter-contract",
          ["extract", "sites", inventoryOrdinal, "candidates"],
          "Candidate phase does not match its source site",
        );
      }
      const request = await createSemanticModuleRequest(
        candidate.kind === "native"
          ? {
              kind: "native",
              resolutionDomainId: runtime.domain.domain.id,
              importerRuntimeBindingId: runtime.binding.id,
              phase: candidate.phase,
              specifier: candidate.specifier,
              sourceAttributes: candidate.sourceAttributes,
            }
          : {
              kind: "commonjs",
              resolutionDomainId: runtime.domain.domain.id,
              importerRuntimeBindingId: runtime.binding.id,
              resolutionOriginUrl: candidate.resolutionOriginUrl,
              specifier: candidate.specifier,
            },
      );
      if (seen.has(request.id)) {
        fail(
          "duplicate-candidate",
          ["extract", "sites", inventoryOrdinal, "candidates"],
          "One source site contains duplicate semantic candidates",
          "candidates",
        );
      }
      seen.add(request.id);
      candidates.push({ candidate, request });
    }
    sites.push(candidates);
  }
  return sites;
}

function enqueueRuntimeSites(
  state: FixedPointState,
  runtime: RuntimeUnit,
  limits: ResolvedOptions,
): void {
  if (
    runtime.phase !== "evaluation" ||
    runtime.sitesEnqueued ||
    runtime.binding === null ||
    runtime.inventory === null
  ) {
    return;
  }
  runtime.sitesEnqueued = true;

  for (const [
    inventoryOrdinal,
    descriptor,
  ] of runtime.extractedSites.entries()) {
    const siteWork: SiteWork = {
      runtime,
      inventoryOrdinal,
      descriptor,
      semanticRequestIds: [],
    };
    const validatedCandidates = runtime.validatedCandidates[inventoryOrdinal];
    for (const { candidate, request } of validatedCandidates) {
      siteWork.semanticRequestIds.push(request.id);
      state.semanticRequests.set(request.id, request);

      if (!state.requestWorks.has(request.id)) {
        const work: RequestWork = {
          request,
          requestInput: candidate,
          importer: runtime,
          targetLoaderKey: null,
          resolveResult: null,
        };
        state.requestWorks.set(request.id, work);
        state.resolutionTasks.set(request.id, {
          key: request.id,
          domain: runtime.domain,
          request: candidate,
          requester: {
            kind: "module",
            importerRuntimeBindingId: runtime.binding.id,
            importerModuleBaseUrl: runtime.binding.preimage.moduleBaseUrl,
          },
          requiredPhase: requiredPhaseForRequest(candidate),
          owner: runtime.key,
          entry: null,
          semanticRequestId: request.id,
        });
      }
    }
    state.siteWorks.push(siteWork);
  }
  checkBudget(
    state.requestWorks.size,
    limits.maxSemanticRequests,
    "maxSemanticRequests",
  );
}

async function processRuntimeUnit(input: {
  readonly state: FixedPointState;
  readonly runtime: RuntimeUnit;
  readonly context: AttemptContext;
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly transformStageProfileDigest: Sha256Digest;
  readonly limits: ResolvedOptions;
}): Promise<void> {
  const { state, runtime, context, profile, limits } = input;
  if (runtime.processed) {
    for (const loaderKey of runtime.loaderKeys) {
      const loader = state.loaderUnits.get(loaderKey);
      if (loader !== undefined) await ensureLoaderEntry(state, loader, runtime);
    }
    enqueueRuntimeSites(state, runtime, limits);
    return;
  }

  if (runtime.loadResult.kind === "content") {
    const sourceContentDigest = await digestModuleContent(
      runtime.loadResult.sourceBytes,
    );
    const transformInput: TransformModuleInput = {
      schema: "dathra.module-coordinator.transform/1",
      canonicalSourceUrl: runtime.loadResult.canonicalSourceUrl,
      moduleBaseUrl: runtime.loadResult.moduleBaseUrl,
      sourceContentDigest,
      sourceBytes: Object.freeze(Array.from(runtime.loadResult.sourceBytes)),
      responseMetadata: runtime.loadResult.responseMetadata,
      loadProfileDigest: profile.loadProfileDigest,
      transformPipelineDigest: profile.transformPipelineDigest,
      loaderSemanticsDigest: profile.loaderSemanticsDigest,
      importMetaSemanticsDigest: profile.importMetaSemanticsDigest,
    };
    const transform = await context.runStage({
      stage: "transform",
      adapterProfileDigest: profile.aggregateAdapterProfileDigest,
      stageProfileDigest: input.transformStageProfileDigest,
      domainIdentity: runtime.domain.domain.id,
      operationInput: transformInput,
      owner: runtime.key,
      invoke: async () => await context.transaction.transform(transformInput),
      parse: parseTransformResult,
    });
    const transformedContentDigest = await digestModuleContent(
      transform.value.transformedBytes,
    );
    const loaderSemanticsDigest = await digestCanonicalJson({
      schema: "dathra.module-coordinator.loader-semantic-profile/1",
      loadProfileDigest: profile.loadProfileDigest,
      loaderSemanticsDigest: profile.loaderSemanticsDigest,
    });
    const semanticProfile = await createModuleSemanticProfile({
      definitionKind: transform.value.definitionKind,
      parseGoal: transform.value.parseGoal,
      transformPipelineDigest: profile.transformPipelineDigest,
      transformMetadataDigest: transform.value.transformMetadataDigest,
      loaderSemanticsDigest,
      importMetaSemanticsDigest: profile.importMetaSemanticsDigest,
    });
    const extractInput: ExtractModuleInput = {
      schema: "dathra.module-coordinator.extract/1",
      canonicalSourceUrl: runtime.loadResult.canonicalSourceUrl,
      moduleBaseUrl: runtime.loadResult.moduleBaseUrl,
      transformedContentDigest,
      transformedBytes: Object.freeze(
        Array.from(transform.value.transformedBytes),
      ),
      semanticProfileId: semanticProfile.id,
      extractorProfileDigest: profile.extractorProfileDigest,
      responseMetadata: runtime.loadResult.responseMetadata,
    };
    const extract = await context.runStage({
      stage: "extract",
      adapterProfileDigest: profile.aggregateAdapterProfileDigest,
      stageProfileDigest: profile.extractorProfileDigest,
      domainIdentity: runtime.domain.domain.id,
      operationInput: extractInput,
      owner: runtime.key,
      invoke: async () => await context.transaction.extract(extractInput),
      parse: parseExtractResult,
    });
    state.siteCount += extract.value.sites.length;
    state.candidateCount += extract.value.sites.reduce(
      (count, site) => count + site.candidates.length,
      0,
    );
    checkBudget(state.siteCount, limits.maxSites, "maxSites");
    checkBudget(state.candidateCount, limits.maxCandidates, "maxCandidates");

    const inventory = await createModuleRequestInventory({
      transformedContentDigest,
      semanticProfileId: semanticProfile.id,
      extractorProfileDigest: profile.extractorProfileDigest,
      sites: extract.value.sites.map((site) => ({
        kind: site.kind,
        phase: site.phase,
        normalizedSyntaxDigest: site.normalizedSyntaxDigest,
      })),
    });
    const definition = await createModuleDefinition({
      kind: "content",
      sourceUrl: runtime.loadResult.canonicalSourceUrl,
      sourceContentDigest,
      transformedContentDigest,
      semanticProfileId: semanticProfile.id,
      requestInventoryId: inventory.id,
    });
    const binding = await createRuntimeModuleBinding({
      resolutionDomainId: runtime.domain.domain.id,
      moduleDefinitionId: definition.id,
      moduleBaseUrl: runtime.loadResult.moduleBaseUrl,
      runtimeModuleIdentityDigest: runtime.runtimeModuleIdentityDigest,
    });
    runtime.semanticProfile = semanticProfile;
    runtime.inventory = inventory;
    runtime.definition = definition;
    runtime.binding = binding;
    runtime.extractedSites = extract.value.sites;
    runtime.validatedCandidates = await validateRuntimeCandidates(runtime);
    state.semanticProfiles.set(semanticProfile.id, semanticProfile);
    state.inventories.set(inventory.id, inventory);
    state.definitions.set(definition.id, definition);
    state.bindings.set(binding.id, binding);
  } else {
    const externalContract = await createExternalModuleDefinitionContract(
      runtime.loadResult.definitionAttestation,
    );
    const definition = await createModuleDefinition({
      kind: "external",
      sourceUrl: runtime.loadResult.canonicalSourceUrl,
      externalDefinitionContractId: externalContract.id,
    });
    const binding = await createRuntimeModuleBinding({
      resolutionDomainId: runtime.domain.domain.id,
      moduleDefinitionId: definition.id,
      moduleBaseUrl: runtime.loadResult.moduleBaseUrl,
      runtimeModuleIdentityDigest: runtime.runtimeModuleIdentityDigest,
    });
    runtime.externalContract = externalContract;
    runtime.definition = definition;
    runtime.binding = binding;
    state.externalContracts.set(externalContract.id, externalContract);
    state.definitions.set(definition.id, definition);
    state.bindings.set(binding.id, binding);
  }
  runtime.processed = true;
  for (const loaderKey of runtime.loaderKeys) {
    const loader = state.loaderUnits.get(loaderKey);
    if (loader !== undefined) await ensureLoaderEntry(state, loader, runtime);
  }
  enqueueRuntimeSites(state, runtime, limits);
}

async function processResolutionTasks(input: {
  readonly state: FixedPointState;
  readonly context: AttemptContext;
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly limits: ResolvedOptions;
}): Promise<number> {
  const tasks = [...input.state.resolutionTasks.values()].sort((left, right) =>
    compareText(left.key, right.key),
  );
  input.state.resolutionTasks.clear();
  for (const task of tasks) {
    const operation: ResolveModuleInput = {
      schema: "dathra.module-coordinator.resolve/1",
      domain: task.domain.domain,
      request: task.request,
      requester: task.requester,
    };
    const resolution = await input.context.runStage({
      stage: "resolve",
      adapterProfileDigest: input.profile.aggregateAdapterProfileDigest,
      stageProfileDigest: input.profile.resolverProfileDigest,
      domainIdentity: task.domain.domain.id,
      operationInput: operation,
      owner: task.owner,
      invoke: async () => await input.context.transaction.resolve(operation),
      parse: parseResolveResult,
    });
    assertResolvedTargetKind(task.request, resolution.value.target);
    const loaderKey = await digestLoaderTarget(
      task.domain.domain,
      resolution.value.target,
    );
    let loader = input.state.loaderUnits.get(loaderKey);
    if (loader === undefined) {
      loader = {
        key: loaderKey,
        domain: task.domain,
        target: resolution.value.target,
        resolveStageKeys: new Set(),
        requiredPhase: task.requiredPhase,
        loadResult: null,
        loadStageKey: null,
        runtimeKey: null,
        loaderEntry: null,
      };
      input.state.loaderUnits.set(loaderKey, loader);
      input.state.pendingLoads.add(loaderKey);
      checkBudget(
        input.state.loaderUnits.size,
        input.limits.maxLoaderUnits,
        "maxLoaderUnits",
      );
    } else {
      loader.requiredPhase = joinPhase(
        loader.requiredPhase,
        task.requiredPhase,
      );
    }
    loader.resolveStageKeys.add(resolution.stageKey);

    if (task.entry !== null) task.entry.targetLoaderKey = loaderKey;
    if (task.semanticRequestId !== null) {
      const requestWork = input.state.requestWorks.get(task.semanticRequestId);
      if (requestWork === undefined) {
        fail("fixed-point-stall", [], "Semantic request work is unavailable");
      }
      requestWork.targetLoaderKey = loaderKey;
      requestWork.resolveResult = resolution.value;
    }
    if (loader.runtimeKey !== null) {
      const runtime = input.state.runtimeUnits.get(loader.runtimeKey);
      if (runtime === undefined) {
        fail("fixed-point-stall", [], "Resolved runtime unit is unavailable");
      }
      const previousPhase = runtime.phase;
      runtime.phase = joinPhase(runtime.phase, task.requiredPhase);
      input.context.associateOwner(resolution.stageKey, runtime.key);
      if (previousPhase !== runtime.phase) {
        enqueueRuntimeSites(input.state, runtime, input.limits);
      }
    }
  }
  return tasks.length;
}

async function processLoads(input: {
  readonly state: FixedPointState;
  readonly context: AttemptContext;
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly limits: ResolvedOptions;
}): Promise<number> {
  const loaderKeys = [...input.state.pendingLoads].sort();
  input.state.pendingLoads.clear();
  for (const loaderKey of loaderKeys) {
    const loader = input.state.loaderUnits.get(loaderKey);
    if (loader === undefined || loader.loadResult !== null) continue;
    const operation: LoadModuleInput = {
      schema: "dathra.module-coordinator.load/1",
      domain: loader.domain.domain,
      target: loader.target,
    };
    const load = await input.context.runStage({
      stage: "load",
      adapterProfileDigest: input.profile.aggregateAdapterProfileDigest,
      stageProfileDigest: input.profile.loadProfileDigest,
      domainIdentity: loader.domain.domain.id,
      operationInput: operation,
      owner: loaderOwner(loader.key),
      invoke: async () => await input.context.transaction.load(operation),
      parse: parseLoadResult,
    });
    loader.loadResult = load.value;
    loader.loadStageKey = load.stageKey;
    const owner = runtimeOwner(
      loader.domain.domain.id,
      load.value.runtimeModuleIdentityDigest,
    );
    loader.runtimeKey = owner;
    const loadSemanticDigest = await digestLoadSemantics(load.value);
    let runtime = input.state.runtimeUnits.get(owner);
    if (runtime === undefined) {
      runtime = {
        key: owner,
        domain: loader.domain,
        runtimeModuleIdentityDigest: load.value.runtimeModuleIdentityDigest,
        loadSemanticDigest,
        loadResult: load.value,
        loaderKeys: new Set(),
        phase: loader.requiredPhase,
        processed: false,
        sitesEnqueued: false,
        semanticProfile: null,
        inventory: null,
        externalContract: null,
        definition: null,
        binding: null,
        extractedSites: [],
        validatedCandidates: [],
      };
      input.state.runtimeUnits.set(owner, runtime);
      input.state.pendingRuntimeProcessing.add(owner);
      checkBudget(
        input.state.runtimeUnits.size,
        input.limits.maxRuntimeUnits,
        "maxRuntimeUnits",
      );
    } else {
      if (runtime.loadSemanticDigest !== loadSemanticDigest) {
        fail(
          "runtime-conflict",
          ["load", "runtimeModuleIdentityDigest"],
          "Loader aliases produced conflicting semantics for one runtime identity",
          "runtimeModuleIdentityDigest",
        );
      }
      runtime.phase = joinPhase(runtime.phase, loader.requiredPhase);
    }
    runtime.loaderKeys.add(loader.key);
    input.context.associateOwner(load.stageKey, runtime.key);
    for (const stageKey of loader.resolveStageKeys) {
      input.context.associateOwner(stageKey, runtime.key);
    }
    if (runtime.processed) {
      await ensureLoaderEntry(input.state, loader, runtime);
      enqueueRuntimeSites(input.state, runtime, input.limits);
    }
  }
  return loaderKeys.length;
}

async function processRuntimeUnits(input: {
  readonly state: FixedPointState;
  readonly context: AttemptContext;
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly transformStageProfileDigest: Sha256Digest;
  readonly limits: ResolvedOptions;
}): Promise<number> {
  const runtimeKeys = [...input.state.pendingRuntimeProcessing].sort();
  input.state.pendingRuntimeProcessing.clear();
  for (const runtimeKey of runtimeKeys) {
    const runtime = input.state.runtimeUnits.get(runtimeKey);
    if (runtime === undefined) continue;
    await processRuntimeUnit({ ...input, runtime });
  }
  return runtimeKeys.length;
}

async function createAttemptDomains(input: {
  readonly buildInput: ModuleCoordinatorBuildInput;
  readonly context: AttemptContext;
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly limits: ResolvedOptions;
}): Promise<Map<string, DomainWork>> {
  checkBudget(
    input.buildInput.domains.length,
    input.limits.maxDomains,
    "maxDomains",
  );
  const domains = new Map<string, DomainWork>();
  const finalIds = new Map<string, string>();
  for (const domainInput of input.buildInput.domains) {
    const operation: DescribeDomainInput = {
      schema: "dathra.module-coordinator.describe-domain/1",
      ...domainInput,
      aggregateAdapterProfileDigest:
        input.profile.aggregateAdapterProfileDigest,
      resolverProfileDigest: input.profile.resolverProfileDigest,
    };
    const description = await input.context.runStage({
      stage: "describe-domain",
      adapterProfileDigest: input.profile.aggregateAdapterProfileDigest,
      stageProfileDigest: input.profile.resolverProfileDigest,
      domainIdentity: domainInput.domainConfigurationDigest,
      operationInput: operation,
      owner: "global",
      invoke: async () =>
        await input.context.transaction.describeDomain(operation),
      parse: parseDomainResult,
    });
    const domain = await createModuleResolutionDomain({
      targetEnvironmentId: domainInput.targetEnvironmentId,
      nativeModuleMapNamespaceDigest:
        domainInput.nativeModuleMapNamespaceDigest,
      commonJsLoaderCacheNamespaceDigest:
        domainInput.commonJsLoaderCacheNamespaceDigest,
      resolverProfileDigest: input.profile.resolverProfileDigest,
      resolverInputTranscriptDigest:
        description.value.resolverInputTranscriptDigest,
      moduleMapSemanticsDigest: description.value.moduleMapSemanticsDigest,
      esmConditions: description.value.esmConditions,
      commonJsConditions: description.value.commonJsConditions,
    });
    const existingStableKey = finalIds.get(domain.id);
    if (
      existingStableKey !== undefined &&
      existingStableKey !== domainInput.stableDomainKey
    ) {
      fail(
        "domain-collision",
        ["resolutionDomains"],
        `Stable domains ${existingStableKey} and ${domainInput.stableDomainKey} collapsed to one final domain`,
        "resolutionDomains",
      );
    }
    finalIds.set(domain.id, domainInput.stableDomainKey);
    domains.set(domainInput.stableDomainKey, { input: domainInput, domain });
  }
  return domains;
}

function enqueueEntries(
  state: FixedPointState,
  input: ModuleCoordinatorBuildInput,
  limits: ResolvedOptions,
): void {
  checkBudget(input.entries.length, limits.maxEntries, "maxEntries");
  for (const entryInput of input.entries) {
    const domain = state.domains.get(entryInput.stableDomainKey);
    if (domain === undefined) {
      fail("invalid-input", ["entries"], "Entry domain is unavailable");
    }
    const entry: EntryWork = {
      input: entryInput,
      domain,
      targetLoaderKey: null,
    };
    state.entries.push(entry);
    const owner = entryOwner(entryInput);
    state.resolutionTasks.set(owner, {
      key: owner,
      domain,
      request: entryInput.request,
      requester: {
        kind: "entry",
        stableDomainKey: entryInput.stableDomainKey,
        entryOrdinal: entryInput.entryOrdinal,
        entryKind: entryInput.entryKind,
        entryContextDigest: entryInput.entryContextDigest,
      },
      requiredPhase: "evaluation",
      owner,
      entry,
      semanticRequestId: null,
    });
  }
}

async function runFixedPoint(input: {
  readonly state: FixedPointState;
  readonly context: AttemptContext;
  readonly profile: ModuleCoordinatorPipelineProfile;
  readonly transformStageProfileDigest: Sha256Digest;
  readonly limits: ResolvedOptions;
}): Promise<void> {
  while (
    input.state.resolutionTasks.size > 0 ||
    input.state.pendingLoads.size > 0 ||
    input.state.pendingRuntimeProcessing.size > 0
  ) {
    input.state.fixedPointRounds += 1;
    checkBudget(
      input.state.fixedPointRounds,
      input.limits.maxFixedPointRounds,
      "maxFixedPointRounds",
    );
    let progress = 0;
    progress += await processResolutionTasks(input);
    progress += await processLoads(input);
    progress += await processRuntimeUnits(input);
    if (progress === 0) {
      fail(
        "fixed-point-stall",
        [],
        "Pending module work made no progress",
        "fixedPoint",
      );
    }
  }
}

async function finalizeGraph(
  state: FixedPointState,
): Promise<ModuleGraphSnapshot> {
  const resolvedRequestIds = new Map<string, ResolvedModuleRequestId>();
  for (const [requestId, work] of [...state.requestWorks].sort(
    ([left], [right]) => compareText(left, right),
  )) {
    if (work.targetLoaderKey === null || work.resolveResult === null) {
      fail("fixed-point-stall", [], "A semantic request was not resolved");
    }
    const loader = state.loaderUnits.get(work.targetLoaderKey);
    if (
      loader === undefined ||
      loader.loaderEntry === null ||
      loader.runtimeKey === null
    ) {
      fail("fixed-point-stall", [], "A resolved loader entry is unavailable");
    }
    const evidence = await createModuleResolutionEvidence(
      work.request.preimage.kind === "native"
        ? {
            kind: "native",
            semanticRequestId: work.request.id,
            targetLoaderEntryId: loader.loaderEntry.id,
            observedConditionSequence:
              work.resolveResult.evidence.observedConditionSequence,
            effectiveAttributes: loader.target.effectiveAttributes,
            redirectEvidenceDigest:
              work.resolveResult.evidence.redirectEvidenceDigest,
            resolverTraceDigest:
              work.resolveResult.evidence.resolverTraceDigest,
          }
        : {
            kind: "commonjs",
            semanticRequestId: work.request.id,
            targetLoaderEntryId: loader.loaderEntry.id,
            observedConditionSequence:
              work.resolveResult.evidence.observedConditionSequence,
            redirectEvidenceDigest:
              work.resolveResult.evidence.redirectEvidenceDigest,
            resolverTraceDigest:
              work.resolveResult.evidence.resolverTraceDigest,
          },
    );
    const resolved = await createResolvedModuleRequest({
      kind: work.request.preimage.kind,
      semanticRequestId: work.request.id,
      targetLoaderEntryId: loader.loaderEntry.id,
      resolutionEvidenceId: evidence.id,
    });
    state.resolutionEvidence.set(evidence.id, evidence);
    state.resolvedRequests.set(resolved.id, resolved);
    resolvedRequestIds.set(requestId, resolved.id);
    addReverseEdge(
      state.targetToImporters,
      loader.runtimeKey,
      work.importer.key,
    );
  }

  for (const siteWork of state.siteWorks) {
    const runtime = siteWork.runtime;
    if (runtime.binding === null || runtime.inventory === null) {
      fail("fixed-point-stall", [], "Site importer records are unavailable");
    }
    const siteEvidence = await createModuleRequestSiteEvidence({
      requestInventoryId: runtime.inventory.id,
      inventoryOrdinal: siteWork.inventoryOrdinal,
      normalizedSyntaxDigest: siteWork.descriptor.normalizedSyntaxDigest,
      importerRuntimeBindingId: runtime.binding.id,
      semanticRequestIds: siteWork.semanticRequestIds,
      candidateCoverageProofDigest:
        siteWork.descriptor.candidateCoverageProofDigest,
    });
    const resolvedIds = siteWork.semanticRequestIds.map((requestId) => {
      const resolvedId = resolvedRequestIds.get(requestId);
      if (resolvedId === undefined) {
        fail(
          "fixed-point-stall",
          [],
          "Site candidate resolution is unavailable",
        );
      }
      return resolvedId;
    });
    const site = await createModuleRequestSite({
      resolutionDomainId: runtime.domain.domain.id,
      importerRuntimeBindingId: runtime.binding.id,
      inventoryOrdinal: siteWork.inventoryOrdinal,
      kind: siteWork.descriptor.kind,
      phase: siteWork.descriptor.phase,
      siteEvidenceId: siteEvidence.id,
      resolvedRequestIds: resolvedIds,
    });
    state.siteEvidence.set(siteEvidence.id, siteEvidence);
    state.requestSites.set(site.id, site);
  }

  for (const entryWork of state.entries) {
    if (entryWork.targetLoaderKey === null) {
      fail("fixed-point-stall", [], "Entry resolution is unavailable");
    }
    const loader = state.loaderUnits.get(entryWork.targetLoaderKey);
    if (
      loader === undefined ||
      loader.loaderEntry === null ||
      loader.runtimeKey === null
    ) {
      fail("fixed-point-stall", [], "Entry loader is unavailable");
    }
    const entry = await createModuleGraphEntry({
      resolutionDomainId: entryWork.domain.domain.id,
      entryOrdinal: entryWork.input.entryOrdinal,
      entryKind: entryWork.input.entryKind,
      entryContextDigest: entryWork.input.entryContextDigest,
      loaderEntryId: loader.loaderEntry.id,
    });
    state.graphEntries.set(entry.id, entry);
    state.entryToRuntime.set(entryOwner(entryWork.input), loader.runtimeKey);
  }

  for (const runtime of [...state.runtimeUnits.values()].sort((left, right) =>
    compareText(left.key, right.key),
  )) {
    if (
      runtime.loadResult.kind !== "external" ||
      runtime.binding === null ||
      runtime.externalContract === null
    ) {
      continue;
    }
    const loaderEntryIds = [...runtime.loaderKeys].map((loaderKey) => {
      const loaderEntry = state.loaderUnits.get(loaderKey)?.loaderEntry;
      if (loaderEntry === null || loaderEntry === undefined) {
        fail("fixed-point-stall", [], "External loader alias is unavailable");
      }
      return loaderEntry.id;
    });
    const evidence = await createExternalRuntimeClosureEvidence({
      externalDefinitionContractId: runtime.externalContract.id,
      runtimeBindingId: runtime.binding.id,
      loaderEntryIds,
      runtimeSemanticsDigest:
        runtime.loadResult.runtimeAttestation.runtimeSemanticsDigest,
      phaseCoherenceEvidenceDigest:
        runtime.loadResult.runtimeAttestation.phaseCoherenceEvidenceDigest,
    });
    state.externalRuntimeEvidence.set(evidence.id, evidence);
  }

  return await createModuleGraphSnapshot({
    semanticProfiles: [...state.semanticProfiles.values()],
    resolutionDomains: [...state.domains.values()].map((work) => work.domain),
    requestInventories: [...state.inventories.values()],
    externalDefinitionContracts: [...state.externalContracts.values()],
    moduleDefinitions: [...state.definitions.values()],
    runtimeBindings: [...state.bindings.values()],
    loaderEntries: [...state.loaderEntries.values()],
    externalRuntimeEvidence: [...state.externalRuntimeEvidence.values()],
    semanticRequests: [...state.semanticRequests.values()],
    resolutionEvidence: [...state.resolutionEvidence.values()],
    resolvedRequests: [...state.resolvedRequests.values()],
    requestSiteEvidence: [...state.siteEvidence.values()],
    requestSites: [...state.requestSites.values()],
    entries: [...state.graphEntries.values()],
  });
}

function preparePersistentCache(input: {
  readonly availableCache: ReadonlyMap<string, CacheEntry>;
  readonly context: AttemptContext;
  readonly limits: ResolvedOptions;
  readonly reservedBytes: number;
}): {
  readonly cache: ReadonlyMap<string, CacheEntry>;
  readonly bytes: number;
} {
  const cache = new Map(input.availableCache);
  for (const [stageKey, stage] of input.context.stageRecords) {
    if (stage.disposition.kind === "transaction-local") {
      cache.delete(stageKey);
      continue;
    }
    const owners = [...stage.owners].sort();
    const byteSize = stageCacheSize({
      schema: "dathra.module-coordinator.persistent-cache-entry/1",
      stage: stage.stage,
      stageKey: stage.stageKey,
      result: stage.result,
      resultDigest: stage.resultDigest,
      observations: stage.observations,
      disposition: stage.disposition,
      owners,
      generation: stage.generation,
    });
    cache.set(stageKey, {
      stage: stage.stage,
      stageKey: stage.stageKey,
      result: stage.result,
      resultDigest: stage.resultDigest,
      observations: stage.observations,
      disposition: stage.disposition,
      owners,
      generation: stage.generation,
      byteSize,
    });
  }

  const pinned = [...input.context.persistentStageKeys]
    .map((key) => cache.get(key))
    .filter((entry): entry is CacheEntry => entry !== undefined);
  const pinnedBytes = pinned.reduce((sum, entry) => sum + entry.byteSize, 0);
  checkBudget(pinned.length, input.limits.maxCacheEntries, "maxCacheEntries");
  checkBudget(
    pinnedBytes + input.reservedBytes,
    input.limits.maxCacheBytes,
    "maxCacheBytes",
  );

  const candidates = [...cache.entries()]
    .filter(([key]) => !input.context.persistentStageKeys.has(key))
    .sort(([leftKey, left], [rightKey, right]) => {
      const generation = left.generation - right.generation;
      return generation === 0 ? compareText(leftKey, rightKey) : generation;
    });
  let bytes = [...cache.values()].reduce(
    (sum, entry) => sum + entry.byteSize,
    0,
  );
  for (const candidate of candidates) {
    if (cache.delete(candidate[0])) bytes -= candidate[1].byteSize;
  }
  checkBudget(cache.size, input.limits.maxCacheEntries, "maxCacheEntries");
  checkBudget(
    bytes + input.reservedBytes,
    input.limits.maxCacheBytes,
    "maxCacheBytes",
  );
  return { cache, bytes: bytes + input.reservedBytes };
}

async function prepareAttempt(input: {
  readonly buildInput: ModuleCoordinatorBuildInput;
  readonly transaction: ModuleCoordinatorAdapterTransaction;
  readonly availableCache: ReadonlyMap<string, CacheEntry>;
  readonly nextGeneration: number;
  readonly limits: ResolvedOptions;
  readonly buildDigest: Sha256Digest;
}): Promise<
  PreparedAttempt & { readonly profile: ModuleCoordinatorPipelineProfile }
> {
  const context = new AttemptContext(
    input.transaction,
    input.availableCache,
    input.nextGeneration,
    input.limits,
  );
  const pipelineInput: DescribePipelineInput = {
    schema: "dathra.module-coordinator.describe-pipeline/1",
    buildDigest: input.buildDigest,
  };
  deepFreeze(pipelineInput);
  const pipeline = parsePipelineResult(
    await input.transaction.describePipeline(pipelineInput),
  );
  context.addObservations(pipeline.observations, "global");
  const domains = await createAttemptDomains({
    buildInput: input.buildInput,
    context,
    profile: pipeline.profile,
    limits: input.limits,
  });
  const state = createFixedPointState(domains);
  enqueueEntries(state, input.buildInput, input.limits);
  const transformStageProfileDigest = await digestCanonicalJson({
    schema: "dathra.module-coordinator.transform-stage-profile/1",
    loadProfileDigest: pipeline.profile.loadProfileDigest,
    transformPipelineDigest: pipeline.profile.transformPipelineDigest,
    loaderSemanticsDigest: pipeline.profile.loaderSemanticsDigest,
    importMetaSemanticsDigest: pipeline.profile.importMetaSemanticsDigest,
  });
  await runFixedPoint({
    state,
    context,
    profile: pipeline.profile,
    transformStageProfileDigest,
    limits: input.limits,
  });
  const snapshot = await finalizeGraph(state);

  for (const [observationKey, owners] of context.observationOwners) {
    for (const owner of owners) {
      const mapped = state.entryToRuntime.get(owner);
      if (mapped !== undefined) owners.add(mapped);
    }
    context.observationOwners.set(observationKey, owners);
  }
  const exactObservations = [...context.observations.values()].sort(
    (left, right) => compareText(left.key, right.key),
  );
  deepFreeze(exactObservations);
  const observationSetPreimage = {
    schema: "dathra.module-coordinator.observation-set/1",
    observations: exactObservations,
  } as const;
  const observationBytes = canonicalizeJson(observationSetPreimage).bytes
    .byteLength;
  const persistent = preparePersistentCache({
    availableCache: input.availableCache,
    context,
    limits: input.limits,
    reservedBytes: observationBytes,
  });
  const observationSetDigest = await digestCanonicalJson(
    observationSetPreimage,
  );
  return {
    snapshot,
    context,
    cache: persistent.cache,
    cacheBytes: persistent.bytes,
    observationSetDigest,
    exactObservations,
    entryToRuntime: new Map(state.entryToRuntime),
    targetToImporters: freezeSetMap(state.targetToImporters),
    profile: pipeline.profile,
  };
}

function validateTransaction(
  value: ModuleCoordinatorAdapterTransaction,
): ModuleCoordinatorAdapterTransaction {
  for (const method of [
    "describePipeline",
    "describeDomain",
    "resolve",
    "load",
    "transform",
    "extract",
    "replayCachedStage",
    "tryCommit",
    "rollback",
  ] as const) {
    if (typeof value[method] !== "function") {
      fail(
        "adapter-contract",
        ["beginTransaction", method],
        `Adapter transaction is missing ${method}`,
      );
    }
  }
  return value;
}

function validateCommittedReceipt(
  result: ModuleCoordinatorCommitResult,
  request: ModuleCoordinatorCommitInput,
): void {
  if (result.kind !== "committed") return;
  if (
    result.transactionId !== request.transactionId ||
    result.snapshotId !== request.snapshotId ||
    result.adapterProfileDigest !== request.adapterProfileDigest ||
    result.observationSetDigest !== request.observationSetDigest
  ) {
    fail(
      "commit-mismatch",
      ["tryCommit"],
      "Committed receipt does not exactly match its request",
      "tryCommit",
    );
  }
}

async function rollbackTransaction(
  transaction: ModuleCoordinatorAdapterTransaction,
  transactionId: string,
  reason: ModuleCoordinatorRollbackInput["reason"],
): Promise<void> {
  const rollbackInput: ModuleCoordinatorRollbackInput = {
    schema: "dathra.module-coordinator.rollback/1",
    transactionId,
    reason,
  };
  deepFreeze(rollbackInput);
  await transaction.rollback(rollbackInput);
}

function parseChangedObservationKeys(value: unknown): readonly string[] {
  if (value === undefined) return [];
  const closed = snapshotClosed(value, ["changedObservationKeys"], "input");
  const keys = expectArray(closed, ["changedObservationKeys"], "input").map(
    (item, index) =>
      expectString(item, ["changedObservationKeys", index], "input"),
  );
  return [...new Set(keys)].sort();
}

function parseBuildOptions(
  value: ModuleCoordinatorBuildOptions,
): ParsedBuildOptions {
  const candidate: unknown = value;
  if (candidate === null || typeof candidate !== "object") {
    fail("invalid-input", ["options"], "Build options must be a record");
  }
  const prototype = Reflect.getPrototypeOf(candidate);
  if (prototype !== Object.prototype && prototype !== null) {
    fail("invalid-input", ["options"], "Build options have a custom prototype");
  }
  if (Object.getOwnPropertySymbols(candidate).length > 0) {
    fail(
      "invalid-input",
      ["options"],
      "Build options contain symbol properties",
    );
  }
  const descriptors = Object.getOwnPropertyDescriptors(candidate);
  for (const [key, descriptor] of Object.entries(descriptors)) {
    if (key !== "changedObservationKeys" && key !== "signal") {
      fail("invalid-input", ["options", key], "Unknown build option");
    }
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      fail(
        "invalid-input",
        ["options", key],
        "Build options must use enumerable data properties",
      );
    }
  }
  const changedDescriptor = Object.getOwnPropertyDescriptor(
    candidate,
    "changedObservationKeys",
  );
  const signalDescriptor = Object.getOwnPropertyDescriptor(candidate, "signal");
  const changedValue: unknown =
    changedDescriptor === undefined || !("value" in changedDescriptor)
      ? undefined
      : changedDescriptor.value;
  const signalValue: unknown =
    signalDescriptor === undefined || !("value" in signalDescriptor)
      ? undefined
      : signalDescriptor.value;
  if (signalValue !== undefined && !(signalValue instanceof AbortSignal)) {
    fail(
      "invalid-input",
      ["signal"],
      "signal must be an AbortSignal",
      "signal",
    );
  }
  const signal = signalValue instanceof AbortSignal ? signalValue : undefined;
  return {
    changedObservationKeys: parseChangedObservationKeys(changedValue),
    signal,
  };
}

function isAborted(signal: AbortSignal | undefined): boolean {
  return signal?.aborted === true;
}

function validateAdapter(
  adapter: ModuleCoordinatorAdapter,
): ModuleCoordinatorAdapter {
  const candidate: unknown = adapter;
  if (
    candidate === null ||
    typeof candidate !== "object" ||
    !("beginTransaction" in candidate) ||
    typeof candidate.beginTransaction !== "function"
  ) {
    fail(
      "invalid-input",
      ["adapter"],
      "Adapter must provide beginTransaction",
      "adapter",
    );
  }
  return adapter;
}

/** Coordinates deterministic, observed module graph build transactions. */
class ModuleCoordinator {
  #state: CommittedState = emptyCommittedState();
  readonly #queue: QueuedBuild[] = [];
  readonly #adapter: ModuleCoordinatorAdapter;
  readonly #options: ResolvedOptions;
  readonly #pendingObservationKeys = new Set<string>();
  #running = false;
  #buildSequence = 0;

  constructor(
    adapter: ModuleCoordinatorAdapter,
    options: ModuleCoordinatorOptions = {},
  ) {
    this.#adapter = validateAdapter(adapter);
    this.#options = Object.freeze(resolveOptions(options));
  }

  /** The last atomically committed immutable module graph snapshot. */
  get committedSnapshot(): ModuleGraphSnapshot | null {
    return this.#state.snapshot;
  }

  /** Returns an immutable summary of committed cache and snapshot state. */
  get status(): ModuleCoordinatorStatus {
    const value = {
      generation: this.#state.generation,
      snapshotId: this.#state.snapshot?.id ?? null,
      cacheEntries: this.#state.cache.size,
      cacheBytes: this.#state.cacheBytes,
    };
    Object.freeze(value);
    return value;
  }

  /** Builds and atomically publishes one complete module graph snapshot. */
  async build(
    input: ModuleCoordinatorBuildInput,
    options: ModuleCoordinatorBuildOptions = {},
  ): Promise<ModuleCoordinatorBuildResult> {
    const inputSnapshot = parseBuildInput(input);
    const optionsSnapshot = parseBuildOptions(options);
    return await new Promise((resolve, reject) => {
      this.#queue.push({
        input: inputSnapshot,
        options: optionsSnapshot,
        resolve,
        reject,
      });
      void this.#drainQueue();
    });
  }

  async #drainQueue(): Promise<void> {
    if (this.#running) return;
    this.#running = true;
    try {
      while (this.#queue.length > 0) {
        const queued = this.#queue.shift();
        if (queued === undefined) continue;
        try {
          queued.resolve(
            await this.#executeBuild(queued.input, queued.options),
          );
        } catch (error) {
          queued.reject(error);
        }
      }
    } finally {
      this.#running = false;
    }
  }

  async #executeBuild(
    buildInput: ModuleCoordinatorBuildInput,
    parsedBuildOptions: ParsedBuildOptions,
  ): Promise<ModuleCoordinatorBuildResult> {
    const requestedObservationKeys = parsedBuildOptions.changedObservationKeys;
    for (const key of requestedObservationKeys) {
      this.#pendingObservationKeys.add(key);
    }
    checkBudget(
      buildInput.domains.length,
      this.#options.maxDomains,
      "maxDomains",
    );
    checkBudget(
      buildInput.entries.length,
      this.#options.maxEntries,
      "maxEntries",
    );
    const signal = parsedBuildOptions.signal;
    const changedObservationKeys = new Set(this.#pendingObservationKeys);
    const buildDigest = await digestCanonicalJson(buildInput);
    const buildOrdinal = this.#buildSequence;
    this.#buildSequence += 1;

    let attemptOrdinal = 0;
    while (attemptOrdinal <= this.#options.maxRetries) {
      if (isAborted(signal)) {
        fail("cancelled", ["signal"], "Build was cancelled", "signal");
      }
      const transactionId = `module-build:${buildOrdinal}:attempt:${attemptOrdinal}`;
      const beginInput: ModuleCoordinatorBeginTransactionInput = {
        schema: "dathra.module-coordinator.begin-transaction/1",
        transactionId,
        attemptOrdinal,
        buildDigest,
      };
      deepFreeze(beginInput);
      const transaction = validateTransaction(
        await this.#adapter.beginTransaction(beginInput),
      );
      let rolledBack = false;
      try {
        const availableCache = filterCommittedCache(
          this.#state,
          changedObservationKeys,
        );
        const prepared = await prepareAttempt({
          buildInput,
          transaction,
          availableCache,
          nextGeneration: this.#state.generation + 1,
          limits: this.#options,
          buildDigest,
        });
        if (isAborted(signal)) {
          fail("cancelled", ["signal"], "Build was cancelled", "signal");
        }
        const commitInput: ModuleCoordinatorCommitInput = {
          schema: "dathra.module-coordinator.commit/1",
          transactionId,
          snapshotId: prepared.snapshot.id,
          adapterProfileDigest: prepared.profile.aggregateAdapterProfileDigest,
          observationSetDigest: prepared.observationSetDigest,
          exactObservations: prepared.exactObservations,
        };
        deepFreeze(commitInput);
        const nextState: CommittedState = {
          generation: this.#state.generation + 1,
          snapshot: prepared.snapshot,
          cache: prepared.cache,
          cacheBytes: prepared.cacheBytes,
          observations: new Map(
            prepared.exactObservations.map((observation) => [
              observation.key,
              observation,
            ]),
          ),
          observationOwners: freezeSetMap(
            cloneOwners(prepared.context.observationOwners),
          ),
          entryToRuntime: new Map(prepared.entryToRuntime),
          targetToImporters: cloneReverseGraph(prepared.targetToImporters),
        };
        const buildResult: ModuleCoordinatorBuildResult = {
          snapshot: prepared.snapshot,
          transactionId,
          attempts: attemptOrdinal + 1,
          observationSetDigest: prepared.observationSetDigest,
        };
        Object.freeze(buildResult);
        const commitResult = parseCommitResult(
          await transaction.tryCommit(commitInput),
        );
        validateCommittedReceipt(commitResult, commitInput);
        if (commitResult.kind === "invalidated") {
          await rollbackTransaction(transaction, transactionId, "invalidated");
          rolledBack = true;
          for (const key of commitResult.changedObservationKeys) {
            changedObservationKeys.add(key);
            this.#pendingObservationKeys.add(key);
          }
          if (isAborted(signal)) {
            fail("cancelled", ["signal"], "Build was cancelled", "signal");
          }
          if (attemptOrdinal >= this.#options.maxRetries) {
            fail(
              "budget-exceeded",
              [],
              "maxRetries budget exceeded",
              "maxRetries",
            );
          }
          attemptOrdinal += 1;
          continue;
        }

        this.#state = nextState;
        this.#pendingObservationKeys.clear();
        return buildResult;
      } catch (error) {
        if (!rolledBack) {
          await rollbackTransaction(
            transaction,
            transactionId,
            error instanceof ModuleCoordinatorError &&
              error.code === "cancelled"
              ? "cancelled"
              : "failed",
          );
        }
        throw error;
      }
    }
    fail(
      "unstable-input",
      [],
      "Build attempts ended without a committed or rejected result",
      "maxRetries",
    );
  }
}

/** Creates a stateful single-writer module coordinator. */
function createModuleCoordinator(
  adapter: ModuleCoordinatorAdapter,
  options: ModuleCoordinatorOptions = {},
): ModuleCoordinator {
  return new ModuleCoordinator(adapter, options);
}

export { ModuleCoordinator, ModuleCoordinatorError, createModuleCoordinator };
export type {
  CommonJsModuleCoordinatorResolutionRequest,
  ContentLoadModuleResult,
  DescribeDomainInput,
  DescribeDomainResult,
  DescribePipelineInput,
  DescribePipelineResult,
  ExternalLoadModuleResult,
  ExtractedModuleRequestSite,
  ExtractModuleInput,
  ExtractModuleResult,
  LoadModuleInput,
  LoadModuleResult,
  ModuleCoordinatorAdapter,
  ModuleCoordinatorAdapterTransaction,
  ModuleCoordinatorBeginTransactionInput,
  ModuleCoordinatorBuildInput,
  ModuleCoordinatorBuildOptions,
  ModuleCoordinatorBuildResult,
  ModuleCoordinatorCacheDisposition,
  ModuleCoordinatorCommitInput,
  ModuleCoordinatorCommitResult,
  ModuleCoordinatorDomainInput,
  ModuleCoordinatorEntryInput,
  ModuleCoordinatorErrorCode,
  ModuleCoordinatorObservation,
  ModuleCoordinatorOptions,
  ModuleCoordinatorPathSegment,
  ModuleCoordinatorPipelineProfile,
  ModuleCoordinatorResolutionRequest,
  ModuleCoordinatorRollbackInput,
  ModuleCoordinatorStageKind,
  ModuleCoordinatorStatus,
  NativeModuleCoordinatorResolutionRequest,
  RawExternalRuntimeAttestation,
  RawModuleResolutionEvidence,
  ReplayCachedStageInput,
  ResolvedLoaderTarget,
  ResolveModuleInput,
  ResolveModuleRequester,
  ResolveModuleResult,
  TransformModuleInput,
  TransformModuleResult,
};
