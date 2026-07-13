import {
  digestCanonicalJson,
  type Sha256Digest,
} from "@dathra/shared/canonical-identity";
import { afterEach, describe, expect, it, vi } from "vitest";

import * as publicApi from "../index";
import {
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
  type ModuleGraphErrorCode,
  type ModuleGraphPathSegment,
  type ModuleGraphSnapshotInput,
  type ModuleImportAttributeInput,
  type ModuleRequestInventorySiteInput,
  type ModuleResolutionDomain,
  type ModuleSemanticProfile,
} from "./implementation";

const MODULE_GRAPH_RUNTIME_EXPORT_NAMES = [
  "ModuleGraphError",
  "canonicalizeModuleUrl",
  "createExternalModuleDefinitionContract",
  "createExternalRuntimeClosureEvidence",
  "createModuleDefinition",
  "createModuleGraphEntry",
  "createModuleGraphSnapshot",
  "createModuleLoaderEntry",
  "createModuleRequestInventory",
  "createModuleRequestSite",
  "createModuleRequestSiteEvidence",
  "createModuleResolutionDomain",
  "createModuleResolutionEvidence",
  "createModuleSemanticProfile",
  "createResolvedModuleRequest",
  "createRuntimeModuleBinding",
  "createSemanticModuleRequest",
  "digestModuleContent",
  "parseModuleGraphSnapshot",
] as const;

type ModuleGraphRuntimeExportName =
  (typeof MODULE_GRAPH_RUNTIME_EXPORT_NAMES)[number];
type AssertNever<Value extends never> = Value;
type _NoModuleGraphRuntimeExport = AssertNever<
  Extract<ModuleGraphRuntimeExportName, keyof typeof publicApi>
>;

/* eslint-disable @typescript-eslint/consistent-type-imports -- Each negative type query must fail independently for mutation sensitivity. */
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT01 = import("../index").CanonicalModuleUrl;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT02 = import("../index").CommonJsModuleResolutionEvidenceInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT03 = import("../index").CommonJsSemanticModuleRequestInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT04 = import("../index").ContentModuleDefinitionInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT05 = import("../index").ExternalModuleDefinitionContract;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT06 = import("../index").ExternalModuleDefinitionContractId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT07 = import("../index").ExternalModuleDefinitionContractInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT08 = import("../index").ExternalModuleDefinitionInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT09 = import("../index").ExternalRuntimeClosureEvidence;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT10 = import("../index").ExternalRuntimeClosureEvidenceId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT11 = import("../index").ExternalRuntimeClosureEvidenceInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT12 = import("../index").ModuleConditionProfile;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT13 = import("../index").ModuleConditionProfileInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT14 = import("../index").ModuleContentDigest;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT15 = import("../index").ModuleDefinition;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT16 = import("../index").ModuleDefinitionId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT17 = import("../index").ModuleDefinitionInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT18 = import("../index").ModuleDefinitionKind;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT19 = import("../index").ModuleGraphEntry;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT20 = import("../index").ModuleGraphEntryId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT21 = import("../index").ModuleGraphEntryInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT22 = import("../index").ModuleGraphErrorCode;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT23 = import("../index").ModuleGraphPathSegment;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT24 = import("../index").ModuleGraphSnapshot;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT25 = import("../index").ModuleGraphSnapshotId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT26 = import("../index").ModuleGraphSnapshotInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT27 = import("../index").ModuleGraphSnapshotPreimage;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT28 = import("../index").ModuleIdentityRecord<unknown, unknown>;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT29 = import("../index").ModuleImportAttribute;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT30 = import("../index").ModuleImportAttributeInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT31 = import("../index").ModuleImportPhase;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT32 = import("../index").ModuleLoaderEntry;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT33 = import("../index").ModuleLoaderEntryId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT34 = import("../index").ModuleLoaderEntryInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT35 = import("../index").ModuleLoaderNamespaceKind;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT36 = import("../index").ModuleParseGoal;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT37 = import("../index").ModuleRequestInventory;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT38 = import("../index").ModuleRequestInventoryId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT39 = import("../index").ModuleRequestInventoryInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT40 = import("../index").ModuleRequestInventorySite;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT41 = import("../index").ModuleRequestInventorySiteInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT42 = import("../index").ModuleRequestSite;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT43 = import("../index").ModuleRequestSiteEvidence;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT44 = import("../index").ModuleRequestSiteEvidenceId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT45 = import("../index").ModuleRequestSiteEvidenceInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT46 = import("../index").ModuleRequestSiteId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT47 = import("../index").ModuleRequestSiteInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT48 = import("../index").ModuleRequestSiteKind;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT49 = import("../index").ModuleResolutionDomain;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT50 = import("../index").ModuleResolutionDomainId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT51 = import("../index").ModuleResolutionDomainInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT52 = import("../index").ModuleResolutionEvidence;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT53 = import("../index").ModuleResolutionEvidenceId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT54 = import("../index").ModuleResolutionEvidenceInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT55 = import("../index").ModuleSemanticProfile;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT56 = import("../index").ModuleSemanticProfileId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT57 = import("../index").ModuleSemanticProfileInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT58 = import("../index").NativeModuleResolutionEvidenceInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT59 = import("../index").NativeSemanticModuleRequestInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT60 = import("../index").ResolvedModuleRequest;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT61 = import("../index").ResolvedModuleRequestId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT62 = import("../index").ResolvedModuleRequestInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT63 = import("../index").RuntimeModuleBinding;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT64 = import("../index").RuntimeModuleBindingId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT65 = import("../index").RuntimeModuleBindingInput;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT66 = import("../index").SemanticModuleRequest;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT67 = import("../index").SemanticModuleRequestId;
// @ts-expect-error Module Graph types remain transformer-internal.
type _NoPublicT68 = import("../index").SemanticModuleRequestInput;
/* eslint-enable @typescript-eslint/consistent-type-imports */

afterEach(() => {
  vi.restoreAllMocks();
});

const ABC_SHA256 = "sha-256:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0";

async function digest(label: string): Promise<Sha256Digest> {
  return await digestCanonicalJson({ label });
}

async function expectModuleGraphError(
  operation: Promise<unknown>,
  code: ModuleGraphErrorCode,
  path?: readonly ModuleGraphPathSegment[],
): Promise<ModuleGraphError> {
  try {
    await operation;
  } catch (error) {
    if (!(error instanceof ModuleGraphError)) throw error;
    if (error.code !== code) {
      throw new Error(`Expected ${code}, received ${error.code}`);
    }
    if (
      path !== undefined &&
      (error.path.length !== path.length ||
        error.path.some((segment, index) => segment !== path[index]))
    ) {
      throw new Error(
        `Expected path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }

  throw new Error("Expected ModuleGraphError");
}

async function createProfile(label: string): Promise<ModuleSemanticProfile> {
  return await createModuleSemanticProfile({
    definitionKind: "ecmascript-module",
    parseGoal: "module",
    transformPipelineDigest: await digest(`${label}:pipeline`),
    transformMetadataDigest: await digest(`${label}:metadata`),
    loaderSemanticsDigest: await digest(`${label}:loader`),
    importMetaSemanticsDigest: await digest(`${label}:import-meta`),
  });
}

async function createDomain(label: string): Promise<ModuleResolutionDomain> {
  return await createModuleResolutionDomain({
    targetEnvironmentId: label,
    nativeModuleMapNamespaceDigest: await digest(`${label}:native-map`),
    commonJsLoaderCacheNamespaceDigest: await digest(`${label}:cjs-cache`),
    resolverProfileDigest: await digest(`${label}:resolver-profile`),
    resolverInputTranscriptDigest: await digest(`${label}:resolver-input`),
    moduleMapSemanticsDigest: await digest(`${label}:module-map`),
    esmConditions: {
      activeSet: ["import", label],
      observableSequence: [label, "import"],
    },
    commonJsConditions: {
      activeSet: ["require", label],
      observableSequence: ["require", label],
    },
  });
}

async function createContentNode(input: {
  readonly label: string;
  readonly profile: ModuleSemanticProfile;
  readonly domain: ModuleResolutionDomain;
  readonly sites: readonly ModuleRequestInventorySiteInput[];
  readonly moduleMapUrl?: string;
}) {
  const sourceContentDigest = await digestModuleContent(
    new TextEncoder().encode(`source:${input.label}`),
  );
  const transformedContentDigest = await digestModuleContent(
    new TextEncoder().encode(`transformed:${input.label}`),
  );
  const inventory = await createModuleRequestInventory({
    transformedContentDigest,
    semanticProfileId: input.profile.id,
    extractorProfileDigest: await digest(`${input.label}:extractor`),
    sites: input.sites,
  });
  const definition = await createModuleDefinition({
    kind: "content",
    sourceUrl: `file:///src/${input.label}.tsx`,
    sourceContentDigest,
    transformedContentDigest,
    semanticProfileId: input.profile.id,
    requestInventoryId: inventory.id,
  });
  const binding = await createRuntimeModuleBinding({
    resolutionDomainId: input.domain.id,
    moduleDefinitionId: definition.id,
    moduleBaseUrl: `https://example.test/${input.label}.js`,
    runtimeModuleIdentityDigest: await digest(
      `${input.domain.preimage.targetEnvironmentId}:${input.label}:runtime`,
    ),
  });
  const loaderEntry = await createModuleLoaderEntry({
    resolutionDomainId: input.domain.id,
    namespaceKind: "native",
    moduleMapUrl:
      input.moduleMapUrl ?? `https://example.test/${input.label}.js`,
    moduleMapType: "javascript-or-wasm",
    effectiveAttributes: [],
    cacheKeyDigest: await digest(
      `${input.domain.preimage.targetEnvironmentId}:${input.label}:cache`,
    ),
    runtimeBindingId: binding.id,
  });

  return {
    sourceContentDigest,
    transformedContentDigest,
    inventory,
    definition,
    binding,
    loaderEntry,
  };
}

type ContentNode = Awaited<ReturnType<typeof createContentNode>>;

async function createNativeEdge(input: {
  readonly domain: ModuleResolutionDomain;
  readonly importer: ContentNode;
  readonly target: {
    readonly binding: ContentNode["binding"];
    readonly loaderEntry: ContentNode["loaderEntry"];
  };
  readonly inventoryOrdinal: number;
  readonly siteKind: Exclude<
    ModuleRequestInventorySiteInput["kind"],
    "commonjs-require"
  >;
  readonly phase: "source" | "evaluation";
  readonly syntaxDigest: Sha256Digest;
  readonly specifier: string;
  readonly sourceAttributes?: readonly ModuleImportAttributeInput[];
}) {
  const sourceAttributes = input.sourceAttributes ?? [];
  const request = await createSemanticModuleRequest({
    kind: "native",
    resolutionDomainId: input.domain.id,
    importerRuntimeBindingId: input.importer.binding.id,
    phase: input.phase,
    specifier: input.specifier,
    sourceAttributes,
  });
  const resolutionEvidence = await createModuleResolutionEvidence({
    kind: "native",
    semanticRequestId: request.id,
    targetLoaderEntryId: input.target.loaderEntry.id,
    observedConditionSequence:
      input.domain.preimage.esmConditions.observableSequence,
    effectiveAttributes: input.target.loaderEntry.preimage.effectiveAttributes,
    redirectEvidenceDigest: await digest(
      `${input.specifier}:${input.phase}:redirect`,
    ),
    resolverTraceDigest: await digest(
      `${input.specifier}:${input.phase}:trace`,
    ),
  });
  const resolvedRequest = await createResolvedModuleRequest({
    kind: "native",
    semanticRequestId: request.id,
    targetLoaderEntryId: input.target.loaderEntry.id,
    resolutionEvidenceId: resolutionEvidence.id,
  });
  const siteEvidence = await createModuleRequestSiteEvidence({
    requestInventoryId: input.importer.inventory.id,
    inventoryOrdinal: input.inventoryOrdinal,
    normalizedSyntaxDigest: input.syntaxDigest,
    importerRuntimeBindingId: input.importer.binding.id,
    semanticRequestIds: [request.id],
    candidateCoverageProofDigest: await digest(
      `${input.specifier}:${input.inventoryOrdinal}:coverage`,
    ),
  });
  const site = await createModuleRequestSite({
    resolutionDomainId: input.domain.id,
    importerRuntimeBindingId: input.importer.binding.id,
    inventoryOrdinal: input.inventoryOrdinal,
    kind: input.siteKind,
    phase: input.phase,
    siteEvidenceId: siteEvidence.id,
    resolvedRequestIds: [resolvedRequest.id],
  });

  return { request, resolutionEvidence, resolvedRequest, siteEvidence, site };
}

async function createCommonJsEdge(input: {
  readonly domain: ModuleResolutionDomain;
  readonly importer: ContentNode;
  readonly target: ContentNode;
  readonly syntaxDigest: Sha256Digest;
  readonly specifier: string;
}) {
  const request = await createSemanticModuleRequest({
    kind: "commonjs",
    resolutionDomainId: input.domain.id,
    importerRuntimeBindingId: input.importer.binding.id,
    resolutionOriginUrl: input.importer.binding.preimage.moduleBaseUrl,
    specifier: input.specifier,
  });
  const resolutionEvidence = await createModuleResolutionEvidence({
    kind: "commonjs",
    semanticRequestId: request.id,
    targetLoaderEntryId: input.target.loaderEntry.id,
    observedConditionSequence:
      input.domain.preimage.commonJsConditions.observableSequence,
    redirectEvidenceDigest: await digest(`${input.specifier}:cjs:redirect`),
    resolverTraceDigest: await digest(`${input.specifier}:cjs:trace`),
  });
  const resolvedRequest = await createResolvedModuleRequest({
    kind: "commonjs",
    semanticRequestId: request.id,
    targetLoaderEntryId: input.target.loaderEntry.id,
    resolutionEvidenceId: resolutionEvidence.id,
  });
  const siteEvidence = await createModuleRequestSiteEvidence({
    requestInventoryId: input.importer.inventory.id,
    inventoryOrdinal: 0,
    normalizedSyntaxDigest: input.syntaxDigest,
    importerRuntimeBindingId: input.importer.binding.id,
    semanticRequestIds: [request.id],
    candidateCoverageProofDigest: await digest(
      `${input.specifier}:cjs:coverage`,
    ),
  });
  const site = await createModuleRequestSite({
    resolutionDomainId: input.domain.id,
    importerRuntimeBindingId: input.importer.binding.id,
    inventoryOrdinal: 0,
    kind: "commonjs-require",
    phase: null,
    siteEvidenceId: siteEvidence.id,
    resolvedRequestIds: [resolvedRequest.id],
  });

  return { request, resolutionEvidence, resolvedRequest, siteEvidence, site };
}

async function createEntry(
  domain: ModuleResolutionDomain,
  node: ContentNode,
  ordinal = 0,
) {
  return await createModuleGraphEntry({
    resolutionDomainId: domain.id,
    entryOrdinal: ordinal,
    entryKind: "module",
    entryContextDigest: await digest(
      `${domain.preimage.targetEnvironmentId}:${ordinal}:entry`,
    ),
    loaderEntryId: node.loaderEntry.id,
  });
}

function snapshotInput(input: {
  readonly profiles: ModuleGraphSnapshotInput["semanticProfiles"];
  readonly domains: ModuleGraphSnapshotInput["resolutionDomains"];
  readonly inventories: ModuleGraphSnapshotInput["requestInventories"];
  readonly externalContracts?: ModuleGraphSnapshotInput["externalDefinitionContracts"];
  readonly definitions: ModuleGraphSnapshotInput["moduleDefinitions"];
  readonly bindings: ModuleGraphSnapshotInput["runtimeBindings"];
  readonly loaderEntries: ModuleGraphSnapshotInput["loaderEntries"];
  readonly externalEvidence?: ModuleGraphSnapshotInput["externalRuntimeEvidence"];
  readonly requests?: ModuleGraphSnapshotInput["semanticRequests"];
  readonly resolutionEvidence?: ModuleGraphSnapshotInput["resolutionEvidence"];
  readonly resolvedRequests?: ModuleGraphSnapshotInput["resolvedRequests"];
  readonly siteEvidence?: ModuleGraphSnapshotInput["requestSiteEvidence"];
  readonly sites?: ModuleGraphSnapshotInput["requestSites"];
  readonly entries: ModuleGraphSnapshotInput["entries"];
}): ModuleGraphSnapshotInput {
  return {
    semanticProfiles: input.profiles,
    resolutionDomains: input.domains,
    requestInventories: input.inventories,
    externalDefinitionContracts: input.externalContracts ?? [],
    moduleDefinitions: input.definitions,
    runtimeBindings: input.bindings,
    loaderEntries: input.loaderEntries,
    externalRuntimeEvidence: input.externalEvidence ?? [],
    semanticRequests: input.requests ?? [],
    resolutionEvidence: input.resolutionEvidence ?? [],
    resolvedRequests: input.resolvedRequests ?? [],
    requestSiteEvidence: input.siteEvidence ?? [],
    requestSites: input.sites ?? [],
    entries: input.entries,
  };
}

function malformedSnapshotWithProfiles(
  semanticProfiles: readonly ModuleSemanticProfile[],
): unknown {
  return {
    id: ABC_SHA256,
    preimage: {
      schema: "dathra.module-graph-snapshot/1",
      semanticProfiles,
      resolutionDomains: [],
      requestInventories: [],
      externalDefinitionContracts: [],
      moduleDefinitions: [],
      runtimeBindings: [],
      loaderEntries: [],
      externalRuntimeEvidence: [],
      semanticRequests: [],
      resolutionEvidence: [],
      resolvedRequests: [],
      requestSiteEvidence: [],
      requestSites: [],
      entries: [],
    },
  };
}

async function createEmptyGraph(label = "browser") {
  const profile = await createProfile(label);
  const domain = await createDomain(label);
  const node = await createContentNode({
    label: "entry",
    profile,
    domain,
    sites: [],
  });
  const entry = await createEntry(domain, node);
  const input = snapshotInput({
    profiles: [profile],
    domains: [domain],
    inventories: [node.inventory],
    definitions: [node.definition],
    bindings: [node.binding],
    loaderEntries: [node.loaderEntry],
    entries: [entry],
  });
  return { profile, domain, node, entry, input };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) {
    throw new Error("Expected record");
  }
  return value;
}

describe("module graph primitives", () => {
  it("canonicalizes absolute URLs without dropping query or fragment", () => {
    expect(
      canonicalizeModuleUrl("HTTPS://EXAMPLE.COM:443/a/../module.js?x=1#part"),
    ).toBe("https://example.com/module.js?x=1#part");
    expect(canonicalizeModuleUrl("node:fs")).toBe("node:fs");
    expect(canonicalizeModuleUrl("dathra-virtual:component/counter")).toBe(
      "dathra-virtual:component/counter",
    );
    expect(() => canonicalizeModuleUrl("./relative.js")).toThrow(
      ModuleGraphError,
    );
    expect(() => canonicalizeModuleUrl("https://example.test/\ud800")).toThrow(
      ModuleGraphError,
    );
  });

  it("digests an exact byte snapshot", async () => {
    const bytes = new TextEncoder().encode("abc");
    const digestPromise = digestModuleContent(bytes);
    bytes.fill(0);
    await expect(digestPromise).resolves.toBe(ABC_SHA256);
  });

  it("canonicalizes set-like fields while preserving observable sequences", async () => {
    const first = await createDomain("browser");
    const second = await createModuleResolutionDomain({
      targetEnvironmentId: first.preimage.targetEnvironmentId,
      nativeModuleMapNamespaceDigest:
        first.preimage.nativeModuleMapNamespaceDigest,
      commonJsLoaderCacheNamespaceDigest:
        first.preimage.commonJsLoaderCacheNamespaceDigest,
      resolverProfileDigest: first.preimage.resolverProfileDigest,
      resolverInputTranscriptDigest:
        first.preimage.resolverInputTranscriptDigest,
      moduleMapSemanticsDigest: first.preimage.moduleMapSemanticsDigest,
      esmConditions: {
        activeSet: ["browser", "import"],
        observableSequence: ["browser", "import"],
      },
      commonJsConditions: {
        activeSet: ["browser", "require"],
        observableSequence: ["require", "browser"],
      },
    });

    expect(first.id).toBe(second.id);
    expect(first.preimage.esmConditions.activeSet).toEqual([
      "browser",
      "import",
    ]);
    expect(first.preimage.esmConditions.observableSequence).toEqual([
      "browser",
      "import",
    ]);
    expect(first.id).toBe(await digestCanonicalJson(first.preimage));
    expect(Object.isFrozen(first.preimage.esmConditions.activeSet)).toBe(true);

    const repeatedSequence = await createModuleResolutionDomain({
      targetEnvironmentId: first.preimage.targetEnvironmentId,
      nativeModuleMapNamespaceDigest:
        first.preimage.nativeModuleMapNamespaceDigest,
      commonJsLoaderCacheNamespaceDigest:
        first.preimage.commonJsLoaderCacheNamespaceDigest,
      resolverProfileDigest: first.preimage.resolverProfileDigest,
      resolverInputTranscriptDigest:
        first.preimage.resolverInputTranscriptDigest,
      moduleMapSemanticsDigest: first.preimage.moduleMapSemanticsDigest,
      esmConditions: {
        activeSet: ["import", "browser"],
        observableSequence: ["browser", "import", "browser"],
      },
      commonJsConditions: first.preimage.commonJsConditions,
    });
    expect(repeatedSequence.preimage.esmConditions.observableSequence).toEqual([
      "browser",
      "import",
      "browser",
    ]);
  });

  it("canonicalizes import attributes by key and rejects duplicate keys", async () => {
    const graph = await createEmptyGraph("attributes");
    const cacheKeyDigest = await digest("attribute cache key");
    const first = await createModuleLoaderEntry({
      resolutionDomainId: graph.domain.id,
      namespaceKind: "native",
      moduleMapUrl: "https://example.test/data.json",
      moduleMapType: "json",
      effectiveAttributes: [
        { key: "type", value: "json" },
        { key: "integrity", value: "test" },
      ],
      cacheKeyDigest,
      runtimeBindingId: graph.node.binding.id,
    });
    const second = await createModuleLoaderEntry({
      resolutionDomainId: graph.domain.id,
      namespaceKind: "native",
      moduleMapUrl: "https://example.test/data.json",
      moduleMapType: "json",
      effectiveAttributes: [
        { key: "integrity", value: "test" },
        { key: "type", value: "json" },
      ],
      cacheKeyDigest,
      runtimeBindingId: graph.node.binding.id,
    });

    expect(first.id).toBe(second.id);
    expect(first.preimage.effectiveAttributes.map(({ key }) => key)).toEqual([
      "integrity",
      "type",
    ]);
    await expectModuleGraphError(
      createModuleLoaderEntry({
        resolutionDomainId: graph.domain.id,
        namespaceKind: "native",
        moduleMapUrl: "https://example.test/data.json",
        moduleMapType: "json",
        effectiveAttributes: [
          { key: "type", value: "json" },
          { key: "type", value: "css" },
        ],
        cacheKeyDigest,
        runtimeBindingId: graph.node.binding.id,
      }),
      "duplicate-record",
    );
  });

  it("rejects closed-input violations without invoking accessors", async () => {
    let getterCalls = 0;
    const input = {
      definitionKind: "ecmascript-module" as const,
      parseGoal: "module" as const,
      transformPipelineDigest: await digest("pipeline"),
      transformMetadataDigest: await digest("metadata"),
      loaderSemanticsDigest: await digest("loader"),
      importMetaSemanticsDigest: await digest("meta"),
    };
    Object.defineProperty(input, "extra", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return true;
      },
    });

    await expectModuleGraphError(
      createModuleSemanticProfile(input),
      "invalid-closed-record",
      ["extra"],
    );
    expect(getterCalls).toBe(0);
  });

  it("deep-freezes nested inventory site records", async () => {
    const profile = await createProfile("immutable-inventory");
    const transformedContentDigest = await digestModuleContent(
      new TextEncoder().encode("immutable transformed content"),
    );
    const inventory = await createModuleRequestInventory({
      transformedContentDigest,
      semanticProfileId: profile.id,
      extractorProfileDigest: await digest("immutable extractor"),
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: await digest("immutable syntax"),
        },
      ],
    });
    const site = inventory.preimage.sites[0];

    expect(Object.isFrozen(site)).toBe(true);
    expect(Reflect.set(site, "kind", "dynamic-import")).toBe(false);
    expect(inventory.id).toBe(await digestCanonicalJson(inventory.preimage));
  });
});

describe("module graph snapshot", () => {
  it("creates and strictly parses a canonical deeply immutable snapshot", async () => {
    const graph = await createEmptyGraph();
    const snapshot = await createModuleGraphSnapshot(graph.input);

    expect(snapshot.id).toBe(await digestCanonicalJson(snapshot.preimage));
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.preimage.moduleDefinitions)).toBe(true);
    await expect(
      parseModuleGraphSnapshot(JSON.parse(JSON.stringify(snapshot))),
    ).resolves.toEqual(snapshot);
  });

  it("consumes the phase fixed-point queue without removing its head", async () => {
    const graph = await createEmptyGraph("cursor-queue");
    const shiftSpy = vi.spyOn(Array.prototype, "shift");

    const snapshot = await createModuleGraphSnapshot(graph.input);
    const shiftCalls = shiftSpy.mock.calls.length;
    shiftSpy.mockRestore();

    expect(snapshot).toBeDefined();
    expect(shiftCalls).toBe(0);
  });

  it("deep-freezes nested records returned by the strict parser", async () => {
    const profile = await createProfile("parsed-immutability");
    const domain = await createDomain("parsed-immutability");
    const syntaxDigest = await digest("parsed immutable syntax");
    const importer = await createContentNode({
      label: "parsed-immutable-importer",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: syntaxDigest,
        },
      ],
    });
    const target = await createContentNode({
      label: "parsed-immutable-target",
      profile,
      domain,
      sites: [],
    });
    const edge = await createNativeEdge({
      domain,
      importer,
      target,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest,
      specifier: "./parsed-immutable-target.js",
    });
    const entry = await createEntry(domain, importer);
    const snapshot = await createModuleGraphSnapshot(
      snapshotInput({
        profiles: [profile],
        domains: [domain],
        inventories: [importer.inventory, target.inventory],
        definitions: [importer.definition, target.definition],
        bindings: [importer.binding, target.binding],
        loaderEntries: [importer.loaderEntry, target.loaderEntry],
        requests: [edge.request],
        resolutionEvidence: [edge.resolutionEvidence],
        resolvedRequests: [edge.resolvedRequest],
        siteEvidence: [edge.siteEvidence],
        sites: [edge.site],
        entries: [entry],
      }),
    );
    const parsed = await parseModuleGraphSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
    );
    const parsedInventory = parsed.preimage.requestInventories.find(
      (inventory) => inventory.id === importer.inventory.id,
    );
    const parsedSite = parsedInventory?.preimage.sites[0];
    if (parsedInventory === undefined || parsedSite === undefined) {
      throw new Error("Expected parsed inventory site");
    }

    expect(Object.isFrozen(parsedSite)).toBe(true);
    expect(Reflect.set(parsedSite, "kind", "dynamic-import")).toBe(false);
    expect(parsedInventory.id).toBe(
      await digestCanonicalJson(parsedInventory.preimage),
    );
  });

  it("stores multiple resolution domains in one snapshot", async () => {
    const profile = await createProfile("shared");
    const browser = await createDomain("browser");
    const server = await createDomain("server");
    const sourceContentDigest = await digestModuleContent(
      new TextEncoder().encode("shared source"),
    );
    const transformedContentDigest = await digestModuleContent(
      new TextEncoder().encode("shared transformed"),
    );
    const inventory = await createModuleRequestInventory({
      transformedContentDigest,
      semanticProfileId: profile.id,
      extractorProfileDigest: await digest("shared extractor"),
      sites: [],
    });
    const definition = await createModuleDefinition({
      kind: "content",
      sourceUrl: "file:///src/shared.ts",
      sourceContentDigest,
      transformedContentDigest,
      semanticProfileId: profile.id,
      requestInventoryId: inventory.id,
    });

    async function bind(domain: ModuleResolutionDomain) {
      const binding = await createRuntimeModuleBinding({
        resolutionDomainId: domain.id,
        moduleDefinitionId: definition.id,
        moduleBaseUrl: "https://example.test/shared.js",
        runtimeModuleIdentityDigest: await digest(
          `${domain.preimage.targetEnvironmentId}:shared runtime`,
        ),
      });
      const loaderEntry = await createModuleLoaderEntry({
        resolutionDomainId: domain.id,
        namespaceKind: "native",
        moduleMapUrl: "https://example.test/shared.js",
        moduleMapType: "javascript-or-wasm",
        effectiveAttributes: [],
        cacheKeyDigest: await digest(
          `${domain.preimage.targetEnvironmentId}:shared cache`,
        ),
        runtimeBindingId: binding.id,
      });
      const entry = await createModuleGraphEntry({
        resolutionDomainId: domain.id,
        entryOrdinal: 0,
        entryKind: "module",
        entryContextDigest: await digest(
          `${domain.preimage.targetEnvironmentId}:entry`,
        ),
        loaderEntryId: loaderEntry.id,
      });
      return { binding, loaderEntry, entry };
    }

    const browserGraph = await bind(browser);
    const serverGraph = await bind(server);
    await expect(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [server, browser],
          inventories: [inventory],
          definitions: [definition],
          bindings: [serverGraph.binding, browserGraph.binding],
          loaderEntries: [serverGraph.loaderEntry, browserGraph.loaderEntry],
          entries: [serverGraph.entry, browserGraph.entry],
        }),
      ),
    ).resolves.toBeDefined();
  });

  it("rejects a request whose target belongs to another resolution domain", async () => {
    const profile = await createProfile("cross-domain");
    const browser = await createDomain("cross-browser");
    const server = await createDomain("cross-server");
    const syntaxDigest = await digest("cross-domain syntax");
    const importer = await createContentNode({
      label: "cross-importer",
      profile,
      domain: browser,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: syntaxDigest,
        },
      ],
    });
    const target = await createContentNode({
      label: "cross-target",
      profile,
      domain: server,
      sites: [],
    });
    const edge = await createNativeEdge({
      domain: browser,
      importer,
      target,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest,
      specifier: "./cross-target.js",
    });
    const browserEntry = await createEntry(browser, importer);
    const serverEntry = await createEntry(server, target);

    await expectModuleGraphError(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [browser, server],
          inventories: [importer.inventory, target.inventory],
          definitions: [importer.definition, target.definition],
          bindings: [importer.binding, target.binding],
          loaderEntries: [importer.loaderEntry, target.loaderEntry],
          requests: [edge.request],
          resolutionEvidence: [edge.resolutionEvidence],
          resolvedRequests: [edge.resolvedRequest],
          siteEvidence: [edge.siteEvidence],
          sites: [edge.site],
          entries: [browserEntry, serverEntry],
        }),
      ),
      "domain-mismatch",
    );
  });

  it("requires resolution evidence to preserve the exact domain condition sequence", async () => {
    const profile = await createProfile("condition-evidence");
    const domain = await createDomain("condition-evidence");
    const syntaxDigest = await digest("condition evidence syntax");
    const importer = await createContentNode({
      label: "condition-importer",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: syntaxDigest,
        },
      ],
    });
    const target = await createContentNode({
      label: "condition-target",
      profile,
      domain,
      sites: [],
    });
    const edge = await createNativeEdge({
      domain,
      importer,
      target,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest,
      specifier: "./condition-target.js",
    });
    const wrongEvidence = await createModuleResolutionEvidence({
      kind: "native",
      semanticRequestId: edge.request.id,
      targetLoaderEntryId: target.loaderEntry.id,
      observedConditionSequence: ["import", "condition-evidence"],
      effectiveAttributes: target.loaderEntry.preimage.effectiveAttributes,
      redirectEvidenceDigest: await digest("wrong condition redirect"),
      resolverTraceDigest: await digest("wrong condition trace"),
    });
    const wrongResolved = await createResolvedModuleRequest({
      kind: "native",
      semanticRequestId: edge.request.id,
      targetLoaderEntryId: target.loaderEntry.id,
      resolutionEvidenceId: wrongEvidence.id,
    });
    const wrongSite = await createModuleRequestSite({
      resolutionDomainId: edge.site.preimage.resolutionDomainId,
      importerRuntimeBindingId: edge.site.preimage.importerRuntimeBindingId,
      inventoryOrdinal: edge.site.preimage.inventoryOrdinal,
      kind: edge.site.preimage.kind,
      phase: edge.site.preimage.phase,
      siteEvidenceId: edge.site.preimage.siteEvidenceId,
      resolvedRequestIds: [wrongResolved.id],
    });
    const entry = await createEntry(domain, importer);

    await expectModuleGraphError(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [domain],
          inventories: [importer.inventory, target.inventory],
          definitions: [importer.definition, target.definition],
          bindings: [importer.binding, target.binding],
          loaderEntries: [importer.loaderEntry, target.loaderEntry],
          requests: [edge.request],
          resolutionEvidence: [wrongEvidence],
          resolvedRequests: [wrongResolved],
          siteEvidence: [edge.siteEvidence],
          sites: [wrongSite],
          entries: [entry],
        }),
      ),
      "request-conflict",
    );
  });

  it("accepts an evaluation import cycle", async () => {
    const profile = await createProfile("cycle");
    const domain = await createDomain("cycle");
    const aSyntax = await digest("a syntax");
    const bSyntax = await digest("b syntax");
    const a = await createContentNode({
      label: "a",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: aSyntax,
        },
      ],
    });
    const b = await createContentNode({
      label: "b",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: bSyntax,
        },
      ],
    });
    const aToB = await createNativeEdge({
      domain,
      importer: a,
      target: b,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest: aSyntax,
      specifier: "./b.js",
    });
    const bToA = await createNativeEdge({
      domain,
      importer: b,
      target: a,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest: bSyntax,
      specifier: "./a.js",
    });
    const entry = await createEntry(domain, a);

    await expect(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [domain],
          inventories: [b.inventory, a.inventory],
          definitions: [b.definition, a.definition],
          bindings: [b.binding, a.binding],
          loaderEntries: [b.loaderEntry, a.loaderEntry],
          requests: [bToA.request, aToB.request],
          resolutionEvidence: [
            bToA.resolutionEvidence,
            aToB.resolutionEvidence,
          ],
          resolvedRequests: [bToA.resolvedRequest, aToB.resolvedRequest],
          siteEvidence: [bToA.siteEvidence, aToB.siteEvidence],
          sites: [bToA.site, aToB.site],
          entries: [entry],
        }),
      ),
    ).resolves.toBeDefined();
  });

  it("does not traverse outgoing sites of a source-only target", async () => {
    const profile = await createProfile("source-only");
    const domain = await createDomain("source-only");
    const entrySyntax = await digest("entry source syntax");
    const targetSyntax = await digest("target evaluation syntax");
    const entryNode = await createContentNode({
      label: "source-entry",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "source",
          normalizedSyntaxDigest: entrySyntax,
        },
      ],
    });
    const targetNode = await createContentNode({
      label: "source-target",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: targetSyntax,
        },
      ],
    });
    const sourceEdge = await createNativeEdge({
      domain,
      importer: entryNode,
      target: targetNode,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "source",
      syntaxDigest: entrySyntax,
      specifier: "./source-target.js",
    });
    const entry = await createEntry(domain, entryNode);
    const baseInput = snapshotInput({
      profiles: [profile],
      domains: [domain],
      inventories: [entryNode.inventory, targetNode.inventory],
      definitions: [entryNode.definition, targetNode.definition],
      bindings: [entryNode.binding, targetNode.binding],
      loaderEntries: [entryNode.loaderEntry, targetNode.loaderEntry],
      requests: [sourceEdge.request],
      resolutionEvidence: [sourceEdge.resolutionEvidence],
      resolvedRequests: [sourceEdge.resolvedRequest],
      siteEvidence: [sourceEdge.siteEvidence],
      sites: [sourceEdge.site],
      entries: [entry],
    });

    await expect(createModuleGraphSnapshot(baseInput)).resolves.toBeDefined();

    const forbiddenEdge = await createNativeEdge({
      domain,
      importer: targetNode,
      target: entryNode,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest: targetSyntax,
      specifier: "./source-entry.js",
    });
    await expectModuleGraphError(
      createModuleGraphSnapshot({
        ...baseInput,
        semanticRequests: [
          ...baseInput.semanticRequests,
          forbiddenEdge.request,
        ],
        resolutionEvidence: [
          ...baseInput.resolutionEvidence,
          forbiddenEdge.resolutionEvidence,
        ],
        resolvedRequests: [
          ...baseInput.resolvedRequests,
          forbiddenEdge.resolvedRequest,
        ],
        requestSiteEvidence: [
          ...baseInput.requestSiteEvidence,
          forbiddenEdge.siteEvidence,
        ],
        requestSites: [...baseInput.requestSites, forbiddenEdge.site],
      }),
      "site-mismatch",
    );
  });

  it("requires source and evaluation phases to share a runtime binding", async () => {
    const profile = await createProfile("phase");
    const domain = await createDomain("phase");
    const sourceSyntax = await digest("source phase syntax");
    const evaluationSyntax = await digest("evaluation phase syntax");
    const importer = await createContentNode({
      label: "phase-entry",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "source",
          normalizedSyntaxDigest: sourceSyntax,
        },
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: evaluationSyntax,
        },
      ],
    });
    const sourceTarget = await createContentNode({
      label: "phase-source-target",
      profile,
      domain,
      sites: [],
    });
    const evaluationTarget = await createContentNode({
      label: "phase-evaluation-target",
      profile,
      domain,
      sites: [],
    });
    const sourceEdge = await createNativeEdge({
      domain,
      importer,
      target: sourceTarget,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "source",
      syntaxDigest: sourceSyntax,
      specifier: "./same.wasm",
      sourceAttributes: [{ key: "type", value: "wasm" }],
    });
    const evaluationEdge = await createNativeEdge({
      domain,
      importer,
      target: evaluationTarget,
      inventoryOrdinal: 1,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest: evaluationSyntax,
      specifier: "./same.wasm",
      sourceAttributes: [{ key: "type", value: "wasm" }],
    });
    const entry = await createEntry(domain, importer);

    await expectModuleGraphError(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [domain],
          inventories: [
            importer.inventory,
            sourceTarget.inventory,
            evaluationTarget.inventory,
          ],
          definitions: [
            importer.definition,
            sourceTarget.definition,
            evaluationTarget.definition,
          ],
          bindings: [
            importer.binding,
            sourceTarget.binding,
            evaluationTarget.binding,
          ],
          loaderEntries: [
            importer.loaderEntry,
            sourceTarget.loaderEntry,
            evaluationTarget.loaderEntry,
          ],
          requests: [sourceEdge.request, evaluationEdge.request],
          resolutionEvidence: [
            sourceEdge.resolutionEvidence,
            evaluationEdge.resolutionEvidence,
          ],
          resolvedRequests: [
            sourceEdge.resolvedRequest,
            evaluationEdge.resolvedRequest,
          ],
          siteEvidence: [sourceEdge.siteEvidence, evaluationEdge.siteEvidence],
          sites: [sourceEdge.site, evaluationEdge.site],
          entries: [entry],
        }),
      ),
      "request-conflict",
    );
  });

  it("accepts CommonJS requests as a separate semantic request kind", async () => {
    const profile = await createProfile("commonjs");
    const domain = await createDomain("commonjs");
    const syntaxDigest = await digest("require syntax");
    const importer = await createContentNode({
      label: "cjs-entry",
      profile,
      domain,
      sites: [
        {
          kind: "commonjs-require",
          phase: null,
          normalizedSyntaxDigest: syntaxDigest,
        },
      ],
    });
    const target = await createContentNode({
      label: "cjs-target",
      profile,
      domain,
      sites: [],
    });
    const edge = await createCommonJsEdge({
      domain,
      importer,
      target,
      syntaxDigest,
      specifier: "./cjs-target.js",
    });
    const entry = await createEntry(domain, importer);

    await expect(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [domain],
          inventories: [importer.inventory, target.inventory],
          definitions: [importer.definition, target.definition],
          bindings: [importer.binding, target.binding],
          loaderEntries: [importer.loaderEntry, target.loaderEntry],
          requests: [edge.request],
          resolutionEvidence: [edge.resolutionEvidence],
          resolvedRequests: [edge.resolvedRequest],
          siteEvidence: [edge.siteEvidence],
          sites: [edge.site],
          entries: [entry],
        }),
      ),
    ).resolves.toBeDefined();
    if (edge.request.preimage.kind !== "commonjs") {
      throw new Error("Expected CommonJS request");
    }
    expect(edge.request.preimage.resolutionOriginUrl).toBe(
      importer.binding.preimage.moduleBaseUrl,
    );
  });

  it("rejects multiple resolutions for one CommonJS semantic request", async () => {
    const profile = await createProfile("commonjs-conflict");
    const domain = await createDomain("commonjs-conflict");
    const syntaxDigest = await digest("commonjs conflict syntax");
    const importer = await createContentNode({
      label: "commonjs-conflict-entry",
      profile,
      domain,
      sites: [
        {
          kind: "commonjs-require",
          phase: null,
          normalizedSyntaxDigest: syntaxDigest,
        },
      ],
    });
    const firstTarget = await createContentNode({
      label: "commonjs-conflict-first",
      profile,
      domain,
      sites: [],
    });
    const secondTarget = await createContentNode({
      label: "commonjs-conflict-second",
      profile,
      domain,
      sites: [],
    });
    const first = await createCommonJsEdge({
      domain,
      importer,
      target: firstTarget,
      syntaxDigest,
      specifier: "./dependency.js",
    });
    const secondEvidence = await createModuleResolutionEvidence({
      kind: "commonjs",
      semanticRequestId: first.request.id,
      targetLoaderEntryId: secondTarget.loaderEntry.id,
      observedConditionSequence:
        domain.preimage.commonJsConditions.observableSequence,
      redirectEvidenceDigest: await digest("second cjs redirect"),
      resolverTraceDigest: await digest("second cjs trace"),
    });
    const secondResolved = await createResolvedModuleRequest({
      kind: "commonjs",
      semanticRequestId: first.request.id,
      targetLoaderEntryId: secondTarget.loaderEntry.id,
      resolutionEvidenceId: secondEvidence.id,
    });
    const entry = await createEntry(domain, importer);

    await expectModuleGraphError(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [domain],
          inventories: [
            importer.inventory,
            firstTarget.inventory,
            secondTarget.inventory,
          ],
          definitions: [
            importer.definition,
            firstTarget.definition,
            secondTarget.definition,
          ],
          bindings: [
            importer.binding,
            firstTarget.binding,
            secondTarget.binding,
          ],
          loaderEntries: [
            importer.loaderEntry,
            firstTarget.loaderEntry,
            secondTarget.loaderEntry,
          ],
          requests: [first.request],
          resolutionEvidence: [first.resolutionEvidence, secondEvidence],
          resolvedRequests: [first.resolvedRequest, secondResolved],
          siteEvidence: [first.siteEvidence],
          sites: [first.site],
          entries: [entry],
        }),
      ),
      "request-conflict",
    );
  });

  it("requires both external definition contract and runtime closure evidence", async () => {
    const profile = await createProfile("external");
    const domain = await createDomain("external");
    const syntaxDigest = await digest("external syntax");
    const importer = await createContentNode({
      label: "external-entry",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: syntaxDigest,
        },
      ],
    });
    const contract = await createExternalModuleDefinitionContract({
      externalDefinitionKind: "node-builtin",
      definitionSemanticsDigest: await digest("external semantics"),
      moduleSourceSemanticsDigest: await digest("external source semantics"),
      transitiveDependencyOwnershipDigest: await digest("external ownership"),
      moduleBytesCorrespondenceDigest: await digest("external bytes"),
    });
    const definition = await createModuleDefinition({
      kind: "external",
      sourceUrl: "node:fs",
      externalDefinitionContractId: contract.id,
    });
    const binding = await createRuntimeModuleBinding({
      resolutionDomainId: domain.id,
      moduleDefinitionId: definition.id,
      moduleBaseUrl: "node:fs",
      runtimeModuleIdentityDigest: await digest("node fs runtime"),
    });
    const loaderEntry = await createModuleLoaderEntry({
      resolutionDomainId: domain.id,
      namespaceKind: "native",
      moduleMapUrl: "node:fs",
      moduleMapType: "builtin",
      effectiveAttributes: [],
      cacheKeyDigest: await digest("node fs cache"),
      runtimeBindingId: binding.id,
    });
    const externalEvidence = await createExternalRuntimeClosureEvidence({
      externalDefinitionContractId: contract.id,
      runtimeBindingId: binding.id,
      loaderEntryIds: [loaderEntry.id],
      runtimeSemanticsDigest: await digest("node fs runtime semantics"),
      phaseCoherenceEvidenceDigest: await digest("node fs phase coherence"),
    });
    const target = { binding, loaderEntry };
    const edge = await createNativeEdge({
      domain,
      importer,
      target,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest,
      specifier: "node:fs",
    });
    const entry = await createEntry(domain, importer);
    const validInput = snapshotInput({
      profiles: [profile],
      domains: [domain],
      inventories: [importer.inventory],
      externalContracts: [contract],
      definitions: [importer.definition, definition],
      bindings: [importer.binding, binding],
      loaderEntries: [importer.loaderEntry, loaderEntry],
      externalEvidence: [externalEvidence],
      requests: [edge.request],
      resolutionEvidence: [edge.resolutionEvidence],
      resolvedRequests: [edge.resolvedRequest],
      siteEvidence: [edge.siteEvidence],
      sites: [edge.site],
      entries: [entry],
    });

    await expect(createModuleGraphSnapshot(validInput)).resolves.toBeDefined();
    await expectModuleGraphError(
      createModuleGraphSnapshot({ ...validInput, externalRuntimeEvidence: [] }),
      "external-contract-mismatch",
    );

    const mismatchedEvidence = await createExternalRuntimeClosureEvidence({
      externalDefinitionContractId: contract.id,
      runtimeBindingId: binding.id,
      loaderEntryIds: [importer.loaderEntry.id],
      runtimeSemanticsDigest: await digest("mismatched runtime semantics"),
      phaseCoherenceEvidenceDigest: await digest("mismatched phase coherence"),
    });
    await expectModuleGraphError(
      createModuleGraphSnapshot({
        ...validInput,
        externalRuntimeEvidence: [mismatchedEvidence],
      }),
      "external-contract-mismatch",
    );

    const externalEntry = await createModuleGraphEntry({
      resolutionDomainId: domain.id,
      entryOrdinal: 1,
      entryKind: "module",
      entryContextDigest: await digest("external entry context"),
      loaderEntryId: loaderEntry.id,
    });
    await expectModuleGraphError(
      createModuleGraphSnapshot({
        ...validInput,
        entries: [...validInput.entries, externalEntry],
      }),
      "external-contract-mismatch",
    );
  });

  it("rejects a resolved request swapped into another syntax site", async () => {
    const profile = await createProfile("site-swap");
    const domain = await createDomain("site-swap");
    const aSyntax = await digest("import a syntax");
    const bSyntax = await digest("import b syntax");
    const importer = await createContentNode({
      label: "swap-entry",
      profile,
      domain,
      sites: [
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: aSyntax,
        },
        {
          kind: "static-import",
          phase: "evaluation",
          normalizedSyntaxDigest: bSyntax,
        },
      ],
    });
    const a = await createContentNode({
      label: "swap-a",
      profile,
      domain,
      sites: [],
    });
    const b = await createContentNode({
      label: "swap-b",
      profile,
      domain,
      sites: [],
    });
    const edgeA = await createNativeEdge({
      domain,
      importer,
      target: a,
      inventoryOrdinal: 0,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest: aSyntax,
      specifier: "./a.js",
    });
    const edgeB = await createNativeEdge({
      domain,
      importer,
      target: b,
      inventoryOrdinal: 1,
      siteKind: "static-import",
      phase: "evaluation",
      syntaxDigest: bSyntax,
      specifier: "./b.js",
    });
    const swappedSite = await createModuleRequestSite({
      resolutionDomainId: domain.id,
      importerRuntimeBindingId: importer.binding.id,
      inventoryOrdinal: 0,
      kind: "static-import",
      phase: "evaluation",
      siteEvidenceId: edgeA.siteEvidence.id,
      resolvedRequestIds: [edgeB.resolvedRequest.id],
    });
    const entry = await createEntry(domain, importer);

    await expectModuleGraphError(
      createModuleGraphSnapshot(
        snapshotInput({
          profiles: [profile],
          domains: [domain],
          inventories: [importer.inventory, a.inventory, b.inventory],
          definitions: [importer.definition, a.definition, b.definition],
          bindings: [importer.binding, a.binding, b.binding],
          loaderEntries: [importer.loaderEntry, a.loaderEntry, b.loaderEntry],
          requests: [edgeA.request, edgeB.request],
          resolutionEvidence: [
            edgeA.resolutionEvidence,
            edgeB.resolutionEvidence,
          ],
          resolvedRequests: [edgeA.resolvedRequest, edgeB.resolvedRequest],
          siteEvidence: [edgeA.siteEvidence, edgeB.siteEvidence],
          sites: [swappedSite, edgeB.site],
          entries: [entry],
        }),
      ),
      "site-mismatch",
    );
  });

  it("rejects dangling, unreachable, and duplicate module-map identities", async () => {
    const graph = await createEmptyGraph("conflict");
    const orphan = await createContentNode({
      label: "orphan",
      profile: graph.profile,
      domain: graph.domain,
      sites: [],
    });

    await expectModuleGraphError(
      createModuleGraphSnapshot({
        ...graph.input,
        requestInventories: [
          ...graph.input.requestInventories,
          orphan.inventory,
        ],
        moduleDefinitions: [
          ...graph.input.moduleDefinitions,
          orphan.definition,
        ],
        runtimeBindings: [...graph.input.runtimeBindings, orphan.binding],
        loaderEntries: [...graph.input.loaderEntries, orphan.loaderEntry],
      }),
      "unreachable-record",
    );

    const conflictingEntry = await createModuleLoaderEntry({
      resolutionDomainId: graph.domain.id,
      namespaceKind: "native",
      moduleMapUrl: graph.node.loaderEntry.preimage.moduleMapUrl,
      moduleMapType: graph.node.loaderEntry.preimage.moduleMapType,
      effectiveAttributes: graph.node.loaderEntry.preimage.effectiveAttributes,
      cacheKeyDigest: await digest("different cache key"),
      runtimeBindingId: orphan.binding.id,
    });
    const orphanEntry = await createModuleGraphEntry({
      resolutionDomainId: graph.domain.id,
      entryOrdinal: 1,
      entryKind: "module",
      entryContextDigest: await digest("orphan entry"),
      loaderEntryId: conflictingEntry.id,
    });
    await expectModuleGraphError(
      createModuleGraphSnapshot({
        ...graph.input,
        requestInventories: [
          ...graph.input.requestInventories,
          orphan.inventory,
        ],
        moduleDefinitions: [
          ...graph.input.moduleDefinitions,
          orphan.definition,
        ],
        runtimeBindings: [...graph.input.runtimeBindings, orphan.binding],
        loaderEntries: [...graph.input.loaderEntries, conflictingEntry],
        entries: [...graph.input.entries, orphanEntry],
      }),
      "identity-conflict",
    );

    const sparseEntry = await createModuleGraphEntry({
      resolutionDomainId: graph.domain.id,
      entryOrdinal: 2,
      entryKind: "module",
      entryContextDigest: await digest("sparse entry"),
      loaderEntryId: orphan.loaderEntry.id,
    });
    await expectModuleGraphError(
      createModuleGraphSnapshot({
        ...graph.input,
        requestInventories: [
          ...graph.input.requestInventories,
          orphan.inventory,
        ],
        moduleDefinitions: [
          ...graph.input.moduleDefinitions,
          orphan.definition,
        ],
        runtimeBindings: [...graph.input.runtimeBindings, orphan.binding],
        loaderEntries: [...graph.input.loaderEntries, orphan.loaderEntry],
        entries: [...graph.input.entries, sparseEntry],
      }),
      "identity-conflict",
    );
  });

  it("rejects duplicate record IDs before starting digest work", async () => {
    const profile = await createProfile("duplicate-preflight");
    const digestSpy = vi.spyOn(globalThis.crypto.subtle, "digest");

    await expectModuleGraphError(
      parseModuleGraphSnapshot(
        malformedSnapshotWithProfiles([profile, profile]),
      ),
      "duplicate-record",
    );
    expect(digestSpy).not.toHaveBeenCalled();
  });

  it("bounds concurrent record digest validation", async () => {
    const profiles: ModuleSemanticProfile[] = [];
    for (let index = 0; index < 64; index += 1) {
      profiles.push(await createProfile(`bounded-digest-${index}`));
    }
    profiles.sort((left, right) =>
      left.id < right.id ? -1 : left.id > right.id ? 1 : 0,
    );

    const originalDigest = globalThis.crypto.subtle.digest.bind(
      globalThis.crypto.subtle,
    );
    let active = 0;
    let maximumActive = 0;
    const digestSpy = vi
      .spyOn(globalThis.crypto.subtle, "digest")
      .mockImplementation(async (algorithm, data) => {
        active += 1;
        maximumActive = Math.max(maximumActive, active);
        try {
          return await originalDigest(algorithm, data);
        } finally {
          active -= 1;
        }
      });

    await expectModuleGraphError(
      parseModuleGraphSnapshot(malformedSnapshotWithProfiles(profiles)),
      "invalid-field",
    );
    expect(digestSpy).toHaveBeenCalledTimes(profiles.length);
    expect(maximumActive).toBeGreaterThan(1);
    expect(maximumActive).toBeLessThanOrEqual(32);
  });

  it("rejects forged IDs and noncanonical record order", async () => {
    const profile = await createProfile("strict");
    const domain = await createDomain("strict");
    const first = await createContentNode({
      label: "strict-first",
      profile,
      domain,
      sites: [],
    });
    const second = await createContentNode({
      label: "strict-second",
      profile,
      domain,
      sites: [],
    });
    const firstEntry = await createEntry(domain, first, 0);
    const secondEntry = await createEntry(domain, second, 1);
    const snapshot = await createModuleGraphSnapshot(
      snapshotInput({
        profiles: [profile],
        domains: [domain],
        inventories: [first.inventory, second.inventory],
        definitions: [first.definition, second.definition],
        bindings: [first.binding, second.binding],
        loaderEntries: [first.loaderEntry, second.loaderEntry],
        entries: [firstEntry, secondEntry],
      }),
    );

    const forged: unknown = JSON.parse(JSON.stringify(snapshot));
    const forgedPreimage = requireRecord(requireRecord(forged).preimage);
    const definitions = forgedPreimage.moduleDefinitions;
    if (!Array.isArray(definitions)) throw new Error("Expected definitions");
    Reflect.set(requireRecord(definitions[0]), "id", await digest("forged"));
    await expectModuleGraphError(
      parseModuleGraphSnapshot(forged),
      "digest-mismatch",
    );

    const reordered: unknown = JSON.parse(JSON.stringify(snapshot));
    const reorderedPreimage = requireRecord(requireRecord(reordered).preimage);
    const reorderedDefinitions = reorderedPreimage.moduleDefinitions;
    if (!Array.isArray(reorderedDefinitions)) {
      throw new Error("Expected definitions");
    }
    reorderedDefinitions.reverse();
    await expectModuleGraphError(
      parseModuleGraphSnapshot(reordered),
      "noncanonical-order",
    );
  });

  it("does not invoke accessors while rejecting an untrusted snapshot", async () => {
    let getterCalls = 0;
    const value = {};
    Object.defineProperty(value, "id", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "forged";
      },
    });

    await expectModuleGraphError(
      parseModuleGraphSnapshot(value),
      "invalid-closed-record",
      ["id"],
    );
    expect(getterCalls).toBe(0);
  });

  it("rejects deeply nested malformed input without overflowing the call stack", async () => {
    let value: unknown = null;
    for (let depth = 0; depth < 20_000; depth += 1) {
      value = [value];
    }

    await expectModuleGraphError(
      parseModuleGraphSnapshot(value),
      "invalid-field",
      [],
    );
  });

  it("keeps the producer API internal until a production adapter exists", () => {
    for (const name of MODULE_GRAPH_RUNTIME_EXPORT_NAMES) {
      expect(publicApi).not.toHaveProperty(name);
    }
  });
});
