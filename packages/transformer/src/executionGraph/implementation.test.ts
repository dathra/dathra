import {
  createObservationConstraint,
  createObservationContract,
  digestCanonicalJson,
  type ObservationConstraint,
  type ObservationContract,
  type Sha256Digest,
} from "@dathra/shared";
import { describe, expect, it } from "vitest";

import * as publicApi from "../index";
import {
  createModuleDefinition,
  createModuleGraphEntry,
  createModuleGraphSnapshot,
  createModuleLoaderEntry,
  createModuleRequestInventory,
  createModuleResolutionDomain,
  createModuleSemanticProfile,
  createRuntimeModuleBinding,
  digestModuleContent,
  type ModuleDefinition,
  type ModuleGraphSnapshot,
  type ModuleLoaderEntry,
  type ModuleResolutionDomain,
  type ModuleSemanticProfile,
  type RuntimeModuleBinding,
} from "../moduleGraph/implementation";
import {
  EXECUTION_GRAPH_DERIVATION_PROFILE,
  ExecutionGraphError,
  createExecutionAnalysisProfile,
  createExecutionEdge,
  createExecutionGenerationDomain,
  createExecutionGraphIndex,
  createExecutionGraphSnapshot,
  createExecutionLocationRequirement,
  createExecutionRootDefinition,
  createExecutionRootObligation,
  createExecutionTemplateNode,
  createQualifiedExecutionNode,
  createReactiveSupportTemplate,
  createRegistrationSupportTemplate,
  createStaticExecutionOccurrenceTemplate,
  parseExecutionGraphSnapshot,
  type ExecutionAnalysisProfile,
  type ExecutionEdge,
  type ExecutionGraphErrorCode,
  type ExecutionGraphPathSegment,
  type ExecutionGraphSnapshotInput,
  type ExecutionLocationRequirement,
  type ExecutionOperationKind,
  type ExecutionRootDefinition,
  type ExecutionRootObligation,
  type ExecutionSemanticRole,
  type ExecutionTemplateNode,
  type QualifiedExecutionNode,
  type ReactiveSupportTemplate,
  type RegistrationSupportTemplate,
  type StaticExecutionOccurrenceTemplate,
} from "./implementation";
import {
  EDGE_ROLE_RULE,
  REACTIVE_SUPPORT_OPERATION_RULE,
  SCHEDULER_SEQUENCE_RULE,
} from "./model";

async function digest(label: string): Promise<Sha256Digest> {
  return await digestCanonicalJson({ label });
}

async function expectGraphError(
  operation: Promise<unknown>,
  code: ExecutionGraphErrorCode,
  path?: readonly ExecutionGraphPathSegment[],
): Promise<ExecutionGraphError> {
  try {
    await operation;
  } catch (error) {
    if (!(error instanceof ExecutionGraphError)) throw error;
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

  throw new Error("Expected ExecutionGraphError");
}

async function findMinimumPassingLimit(
  maximum: number,
  operation: (limit: number) => Promise<unknown>,
): Promise<number> {
  let lower = 0;
  let upper = maximum;
  while (lower < upper) {
    const candidate = Math.floor((lower + upper) / 2);
    try {
      await operation(candidate);
      upper = candidate;
    } catch (error) {
      if (
        !(error instanceof ExecutionGraphError) ||
        error.code !== "budget-exceeded"
      ) {
        throw error;
      }
      lower = candidate + 1;
    }
  }
  await operation(lower);
  return lower;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requireRecord(value: unknown): Record<string, unknown> {
  if (!isRecord(value)) throw new Error("Expected a record");
  return value;
}

function requireArray(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected an array");
  return value;
}

function jsonClone(value: unknown): unknown {
  const result: unknown = JSON.parse(JSON.stringify(value));
  return result;
}

interface ModuleNodeFixture {
  readonly profile: ModuleSemanticProfile;
  readonly domain: ModuleResolutionDomain;
  readonly definition: ModuleDefinition;
  readonly binding: RuntimeModuleBinding;
  readonly loaderEntry: ModuleLoaderEntry;
}

async function createModuleNode(
  label: string,
  targetEnvironmentId: string,
): Promise<ModuleNodeFixtureWithRecords> {
  const profile = await createModuleSemanticProfile({
    definitionKind: "ecmascript-module",
    parseGoal: "module",
    transformPipelineDigest: await digest(`${label}:pipeline`),
    transformMetadataDigest: await digest(`${label}:metadata`),
    loaderSemanticsDigest: await digest(`${label}:loader`),
    importMetaSemanticsDigest: await digest(`${label}:import-meta`),
  });
  const domain = await createModuleResolutionDomain({
    targetEnvironmentId,
    nativeModuleMapNamespaceDigest: await digest(`${label}:native-map`),
    commonJsLoaderCacheNamespaceDigest: await digest(`${label}:cjs-cache`),
    resolverProfileDigest: await digest(`${label}:resolver-profile`),
    resolverInputTranscriptDigest: await digest(`${label}:resolver-input`),
    moduleMapSemanticsDigest: await digest(`${label}:module-map`),
    esmConditions: {
      activeSet: ["import", targetEnvironmentId],
      observableSequence: [targetEnvironmentId, "import"],
    },
    commonJsConditions: {
      activeSet: ["require", targetEnvironmentId],
      observableSequence: ["require", targetEnvironmentId],
    },
  });
  const sourceContentDigest = await digestModuleContent(
    new TextEncoder().encode(`source:${label}`),
  );
  const transformedContentDigest = await digestModuleContent(
    new TextEncoder().encode(`transformed:${label}`),
  );
  const inventory = await createModuleRequestInventory({
    transformedContentDigest,
    semanticProfileId: profile.id,
    extractorProfileDigest: await digest(`${label}:extractor`),
    sites: [],
  });
  const definition = await createModuleDefinition({
    kind: "content",
    sourceUrl: `file:///src/${label}.tsx`,
    sourceContentDigest,
    transformedContentDigest,
    semanticProfileId: profile.id,
    requestInventoryId: inventory.id,
  });
  const binding = await createRuntimeModuleBinding({
    resolutionDomainId: domain.id,
    moduleDefinitionId: definition.id,
    moduleBaseUrl: `https://example.test/${label}.js`,
    runtimeModuleIdentityDigest: await digest(`${label}:runtime`),
  });
  const loaderEntry = await createModuleLoaderEntry({
    resolutionDomainId: domain.id,
    namespaceKind: "native",
    moduleMapUrl: `https://example.test/${label}.js`,
    moduleMapType: "javascript-or-wasm",
    effectiveAttributes: [],
    cacheKeyDigest: await digest(`${label}:cache`),
    runtimeBindingId: binding.id,
  });
  const entry = await createModuleGraphEntry({
    resolutionDomainId: domain.id,
    entryOrdinal: 0,
    entryKind: "module",
    entryContextDigest: await digest(`${label}:entry`),
    loaderEntryId: loaderEntry.id,
  });

  return {
    profile,
    domain,
    definition,
    binding,
    loaderEntry,
    records: { inventory, entry },
  };
}

async function createModuleGraph(
  nodes: readonly ModuleNodeFixtureWithRecords[],
): Promise<ModuleGraphSnapshot> {
  return await createModuleGraphSnapshot({
    semanticProfiles: nodes.map((node) => node.profile),
    resolutionDomains: nodes.map((node) => node.domain),
    requestInventories: nodes.map((node) => node.records.inventory),
    externalDefinitionContracts: [],
    moduleDefinitions: nodes.map((node) => node.definition),
    runtimeBindings: nodes.map((node) => node.binding),
    loaderEntries: nodes.map((node) => node.loaderEntry),
    externalRuntimeEvidence: [],
    semanticRequests: [],
    resolutionEvidence: [],
    resolvedRequests: [],
    requestSiteEvidence: [],
    requestSites: [],
    entries: nodes.map((node) => node.records.entry),
  });
}

interface ModuleNodeFixtureWithRecords extends ModuleNodeFixture {
  readonly records: {
    readonly inventory: Awaited<
      ReturnType<typeof createModuleRequestInventory>
    >;
    readonly entry: Awaited<ReturnType<typeof createModuleGraphEntry>>;
  };
}

interface RootContractFixture {
  readonly contract: ObservationContract;
  readonly trigger: ObservationConstraint | null;
  readonly owner: ObservationConstraint | null;
  readonly terminal: ObservationConstraint;
}

function requireTrigger(fixture: RootContractFixture): ObservationConstraint {
  if (fixture.trigger === null) {
    throw new Error("Expected a trigger constraint");
  }
  return fixture.trigger;
}

async function createRootContract(
  rootDefinitionId: string,
  triggerKind: "event" | "effect" | "callback" | null,
  label: string,
): Promise<RootContractFixture> {
  const trigger =
    triggerKind === null
      ? null
      : await createObservationConstraint({
          kind: triggerKind,
          subjectId: `${rootDefinitionId}:trigger`,
          visibility: "external",
          inputIdentityDomainId: `${label}:input-domain`,
          occurrenceIdentityDomainId: `${label}:occurrence-domain`,
          cardinality: { kind: "exactly", count: 1 },
          admissionCutId: `${label}:initial-cut`,
          coalescingPolicyRequirement: null,
        });
  const owner = await createObservationConstraint({
    kind: "identity",
    subjectId: `${rootDefinitionId}:owner`,
    visibility: "external",
    identityDomainId: `${label}:owner-identity`,
    lifetimeDomainId: `${label}:owner-lifetime`,
  });
  const terminal = await createObservationConstraint({
    kind: "terminal",
    subjectId: rootDefinitionId,
    visibility: "external",
    outcomes: ["success", "cancelled"],
  });
  const contract = await createObservationContract({
    rootDefinitionId,
    externalInputIdentitySchemaId: `${label}:external-input/1`,
    eventIdentitySchemaId: `${label}:event/1`,
    initialCutId: `${label}:initial-cut`,
    relation: "trace-equality",
    constraints:
      trigger === null ? [owner, terminal] : [trigger, owner, terminal],
    orderEdges: [],
    refinementRules: [],
  });

  return { contract, trigger, owner, terminal };
}

interface GraphRecordSet {
  readonly analysisProfiles: ExecutionAnalysisProfile[];
  readonly rootDefinitions: ExecutionRootDefinition[];
  readonly locationRequirements: ExecutionLocationRequirement[];
  readonly occurrenceTemplates: StaticExecutionOccurrenceTemplate[];
  readonly templateNodes: ExecutionTemplateNode[];
  readonly generationDomains: Awaited<
    ReturnType<typeof createExecutionGenerationDomain>
  >[];
  readonly qualifiedNodes: QualifiedExecutionNode[];
  readonly edges: ExecutionEdge[];
  readonly registrationSupports: RegistrationSupportTemplate[];
  readonly reactiveSupports: ReactiveSupportTemplate[];
  readonly rootObligations: ExecutionRootObligation[];
}

function emptyGraphRecords(): GraphRecordSet {
  return {
    analysisProfiles: [],
    rootDefinitions: [],
    locationRequirements: [],
    occurrenceTemplates: [],
    templateNodes: [],
    generationDomains: [],
    qualifiedNodes: [],
    edges: [],
    registrationSupports: [],
    reactiveSupports: [],
    rootObligations: [],
  };
}

function snapshotInput(records: GraphRecordSet): ExecutionGraphSnapshotInput {
  return {
    analysisProfiles: records.analysisProfiles,
    rootDefinitions: records.rootDefinitions,
    locationRequirements: records.locationRequirements,
    occurrenceTemplates: records.occurrenceTemplates,
    templateNodes: records.templateNodes,
    generationDomains: records.generationDomains,
    qualifiedNodes: records.qualifiedNodes,
    edges: records.edges,
    registrationSupports: records.registrationSupports,
    reactiveSupports: records.reactiveSupports,
    rootObligations: records.rootObligations,
  };
}

interface BaseFixture {
  readonly module: ModuleNodeFixtureWithRecords;
  readonly dependencies: {
    readonly moduleGraph: ModuleGraphSnapshot;
    observationContracts: ObservationContract[];
  };
  readonly records: GraphRecordSet;
  readonly analysisProfile: ExecutionAnalysisProfile;
  readonly location: ExecutionLocationRequirement;
  readonly root: ExecutionRootDefinition;
  readonly contract: RootContractFixture;
  readonly occurrence: StaticExecutionOccurrenceTemplate;
  readonly template: ExecutionTemplateNode;
  readonly node: QualifiedExecutionNode;
  readonly obligation: ExecutionRootObligation;
}

async function createAnalysisProfile(
  label: string,
): Promise<ExecutionAnalysisProfile> {
  return await createExecutionAnalysisProfile({
    analyzerImplementationDigest: await digest(`${label}:analyzer`),
    analyzerVersion: "1.0.0",
    normalizedSyntaxSchemaId: "dathra.normalized-syntax/1",
    operationTaxonomySchemaId: "dathra.execution-operation/1",
    analysisConfigurationDigest: await digest(`${label}:analysis-config`),
  });
}

async function createLocation(
  label: string,
  module: ModuleNodeFixture,
): Promise<ExecutionLocationRequirement> {
  return await createExecutionLocationRequirement({
    hostInstanceDomainId: await digest(`${label}:host-instance`),
    agentClusterDomainId: await digest(`${label}:agent-cluster`),
    agentDomainId: await digest(`${label}:agent`),
    realmDomainId: await digest(`${label}:realm`),
    globalDomainId: await digest(`${label}:global`),
    principalDomainId: await digest(`${label}:principal`),
    targetEnvironmentIds: [module.domain.preimage.targetEnvironmentId],
    resolutionDomainIds: [module.domain.id],
  });
}

async function createSourceNode(input: {
  readonly label: string;
  readonly module: ModuleNodeFixture;
  readonly analysisProfile: ExecutionAnalysisProfile;
  readonly location: ExecutionLocationRequirement;
  readonly operationKind: ExecutionOperationKind;
  readonly semanticRole: ExecutionSemanticRole;
  readonly ordinal: number;
  readonly identitySlots?: readonly (
    | "root-instance"
    | "activation"
    | "continuation"
    | "registration"
    | "allocation"
  )[];
  readonly epochKinds?: readonly (
    | "module-instance"
    | "request"
    | "render-attempt"
    | "activation"
    | "event-task"
    | "update-flush"
    | "remote-invocation"
    | "cleanup"
  )[];
}): Promise<{
  readonly occurrence: StaticExecutionOccurrenceTemplate;
  readonly template: ExecutionTemplateNode;
  readonly node: QualifiedExecutionNode;
}> {
  const occurrence = await createStaticExecutionOccurrenceTemplate({
    identitySlots: input.identitySlots ?? [],
    epochKinds: input.epochKinds ?? ["module-instance"],
  });
  if (input.module.definition.preimage.kind !== "content") {
    throw new Error("Expected content module fixture");
  }
  const template = await createExecutionTemplateNode({
    kind: "source",
    moduleDefinitionId: input.module.definition.id,
    canonicalSourceUrl: input.module.definition.preimage.canonicalSourceUrl,
    transformedContentDigest:
      input.module.definition.preimage.transformedContentDigest,
    semanticProfileId: input.module.definition.preimage.semanticProfileId,
    analysisProfileId: input.analysisProfile.id,
    normalizedSyntaxDigest: await digest(`${input.label}:syntax`),
    operationKind: input.operationKind,
    preorderOrdinal: input.ordinal,
  });
  const node = await createQualifiedExecutionNode({
    templateNodeId: template.id,
    locationRequirementId: input.location.id,
    occurrenceTemplateId: occurrence.id,
    semanticRole: input.semanticRole,
    binding: {
      kind: "module",
      runtimeBindingId: input.module.binding.id,
    },
  });
  return { occurrence, template, node };
}

async function createBaseFixture(label = "base"): Promise<BaseFixture> {
  const module = await createModuleNode(`${label}-module`, "browser");
  const moduleGraph = await createModuleGraph([module]);
  const analysisProfile = await createAnalysisProfile(label);
  const location = await createLocation(label, module);
  const root = await createExecutionRootDefinition({
    rootKeyDigest: await digest(`${label}:root-key`),
    admission: "seed",
    kind: "initial-ui",
    phase: "render",
  });
  const contract = await createRootContract(root.id, null, `${label}:contract`);
  const source = await createSourceNode({
    label: `${label}:root`,
    module,
    analysisProfile,
    location,
    operationKind: "compute",
    semanticRole: "execution",
    ordinal: 0,
    identitySlots: ["root-instance"],
    epochKinds: ["render-attempt"],
  });
  const obligation = await createExecutionRootObligation({
    rootDefinitionId: root.id,
    observationContractId: contract.contract.id,
    targetNodeId: source.node.id,
    entryFactKind: "execute",
    triggerConstraintIds: [],
    ownerConstraintIds: contract.owner === null ? [] : [contract.owner.id],
    terminalConstraintId: contract.terminal.id,
  });
  const records = emptyGraphRecords();
  records.analysisProfiles.push(analysisProfile);
  records.rootDefinitions.push(root);
  records.locationRequirements.push(location);
  records.occurrenceTemplates.push(source.occurrence);
  records.templateNodes.push(source.template);
  records.qualifiedNodes.push(source.node);
  records.rootObligations.push(obligation);
  return {
    module,
    dependencies: {
      moduleGraph,
      observationContracts: [contract.contract],
    },
    records,
    analysisProfile,
    location,
    root,
    contract,
    occurrence: source.occurrence,
    template: source.template,
    node: source.node,
    obligation,
  };
}

describe("execution graph identity records", () => {
  it("creates immutable content-addressed source records", async () => {
    const fixture = await createBaseFixture();
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );

    expect(snapshot.id).toBe(await digestCanonicalJson(snapshot.preimage));
    expect(Object.isFrozen(snapshot)).toBe(true);
    expect(Object.isFrozen(snapshot.preimage.qualifiedNodes)).toBe(true);
    expect(snapshot.preimage.moduleGraphSnapshotId).toBe(
      fixture.dependencies.moduleGraph.id,
    );
    expect(snapshot.preimage.observationContractIds).toEqual([
      fixture.contract.contract.id,
    ]);
  });

  it("canonicalizes symbolic sets and rejects getters before reading them", async () => {
    const module = await createModuleNode("sets-module", "browser");
    const server = await createModuleNode("sets-server", "server-request");
    const first = await createExecutionLocationRequirement({
      hostInstanceDomainId: await digest("sets:host"),
      agentClusterDomainId: await digest("sets:cluster"),
      agentDomainId: await digest("sets:agent"),
      realmDomainId: await digest("sets:realm"),
      globalDomainId: await digest("sets:global"),
      principalDomainId: await digest("sets:principal"),
      targetEnvironmentIds: ["server-request", "browser"],
      resolutionDomainIds: [server.domain.id, module.domain.id],
    });
    const second = await createExecutionLocationRequirement({
      hostInstanceDomainId: first.preimage.hostInstanceDomainId,
      agentClusterDomainId: first.preimage.agentClusterDomainId,
      agentDomainId: first.preimage.agentDomainId,
      realmDomainId: first.preimage.realmDomainId,
      globalDomainId: first.preimage.globalDomainId,
      principalDomainId: first.preimage.principalDomainId,
      targetEnvironmentIds: ["browser", "server-request"],
      resolutionDomainIds: [module.domain.id, server.domain.id],
    });
    expect(first.id).toBe(second.id);

    let getterRuns = 0;
    const input = {
      analyzerImplementationDigest: await digest("getter:analyzer"),
      analyzerVersion: "1",
      normalizedSyntaxSchemaId: "syntax/1",
      operationTaxonomySchemaId: "operations/1",
      analysisConfigurationDigest: await digest("getter:config"),
    };
    Object.defineProperty(input, "extra", {
      enumerable: true,
      get() {
        getterRuns += 1;
        return "forbidden";
      },
    });
    await expectGraphError(
      createExecutionAnalysisProfile(input),
      "invalid-closed-record",
    );
    expect(getterRuns).toBe(0);

    const extraSchemaInput = {
      schema: "dathra.execution-analysis-profile/1",
      analyzerImplementationDigest: await digest("extra-schema:analyzer"),
      analyzerVersion: "1",
      normalizedSyntaxSchemaId: "syntax/1",
      operationTaxonomySchemaId: "operations/1",
      analysisConfigurationDigest: await digest("extra-schema:config"),
    };
    await expectGraphError(
      createExecutionAnalysisProfile(extraSchemaInput),
      "invalid-field",
    );
  });

  it("makes root-bound generated identity contract-sensitive without an obligation cycle", async () => {
    const fixture = await createBaseFixture("generated");
    const first = await createExecutionTemplateNode({
      kind: "generated",
      generatorSchemaId: "dathra.generator/1",
      generatorProfileDigest: await digest("generated:profile"),
      inputs: [{ slot: "source", templateNodeId: fixture.template.id }],
      rootDefinitionId: fixture.root.id,
      observationContractId: fixture.contract.contract.id,
      operationKind: "artifact-contribution",
      ordinal: 0,
    });
    const otherContract = await createRootContract(
      fixture.root.id,
      null,
      "generated:other-contract",
    );
    if (first.preimage.kind !== "generated") {
      throw new Error("Expected a generated template");
    }
    const second = await createExecutionTemplateNode({
      kind: "generated",
      generatorSchemaId: "dathra.generator/1",
      generatorProfileDigest: first.preimage.generatorProfileDigest,
      inputs: [{ slot: "source", templateNodeId: fixture.template.id }],
      rootDefinitionId: fixture.root.id,
      observationContractId: otherContract.contract.id,
      operationKind: "artifact-contribution",
      ordinal: 0,
    });

    expect(first.id).not.toBe(second.id);
    expect("rootObligationId" in first.preimage).toBe(false);
  });
});

describe("execution graph cross-record validation", () => {
  it("round-trips a strict canonical snapshot and permits extra context contracts", async () => {
    const fixture = await createBaseFixture("round-trip");
    const extraRoot = await createExecutionRootDefinition({
      rootKeyDigest: await digest("extra:root"),
      admission: "seed",
      kind: "initial-ui",
      phase: "render",
    });
    const extra = await createRootContract(extraRoot.id, null, "extra");
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const parsed = await parseExecutionGraphSnapshot(
      JSON.parse(JSON.stringify(snapshot)),
      {
        moduleGraph: fixture.dependencies.moduleGraph,
        observationContracts: [extra.contract, fixture.contract.contract],
      },
    );

    expect(parsed).toEqual(snapshot);
  });

  it("rejects a missing selected contract and a forged nested identity", async () => {
    const fixture = await createBaseFixture("missing-contract");
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    await expectGraphError(
      parseExecutionGraphSnapshot(snapshot, {
        moduleGraph: fixture.dependencies.moduleGraph,
        observationContracts: [],
      }),
      "dependency-mismatch",
    );

    const forged = requireRecord(jsonClone(snapshot));
    const forgedPreimage = requireRecord(forged.preimage);
    const forgedNodes = requireArray(forgedPreimage.qualifiedNodes);
    requireRecord(forgedNodes[0]).id = await digest("forged-node");
    forged.id = await digestCanonicalJson(forgedPreimage);
    await expectGraphError(
      parseExecutionGraphSnapshot(forged, fixture.dependencies),
      "digest-mismatch",
    );
  });

  it("rejects a source binding whose resolution domain is outside the location", async () => {
    const fixture = await createBaseFixture("binding-location");
    const server = await createModuleNode("binding-server", "server-request");
    const moduleGraph = await createModuleGraph([fixture.module, server]);
    const wrongLocation = await createLocation("wrong-location", server);
    const wrongNode = await createQualifiedExecutionNode({
      templateNodeId: fixture.template.id,
      locationRequirementId: wrongLocation.id,
      occurrenceTemplateId: fixture.occurrence.id,
      semanticRole: "execution",
      binding: {
        kind: "module",
        runtimeBindingId: fixture.module.binding.id,
      },
    });
    fixture.records.locationRequirements[0] = wrongLocation;
    fixture.records.qualifiedNodes[0] = wrongNode;
    fixture.records.rootObligations[0] = await createExecutionRootObligation({
      rootDefinitionId: fixture.obligation.preimage.rootDefinitionId,
      observationContractId: fixture.obligation.preimage.observationContractId,
      targetNodeId: wrongNode.id,
      entryFactKind: fixture.obligation.preimage.entryFactKind,
      triggerConstraintIds: fixture.obligation.preimage.triggerConstraintIds,
      ownerConstraintIds: fixture.obligation.preimage.ownerConstraintIds,
      terminalConstraintId: fixture.obligation.preimage.terminalConstraintId,
    });
    const input = snapshotInput(fixture.records);
    await expectGraphError(
      createExecutionGraphSnapshot(input, {
        moduleGraph,
        observationContracts: [fixture.contract.contract],
      }),
      "location-mismatch",
    );
  });

  it("rejects a generation domain whose resolution environment disagrees", async () => {
    const server = await createModuleNode(
      "generation-server",
      "server-request",
    );
    const fixture = await createBaseFixture("generation-location");
    const moduleGraph = await createModuleGraph([fixture.module, server]);
    const location = await createExecutionLocationRequirement({
      hostInstanceDomainId: fixture.location.preimage.hostInstanceDomainId,
      agentClusterDomainId: fixture.location.preimage.agentClusterDomainId,
      agentDomainId: fixture.location.preimage.agentDomainId,
      realmDomainId: fixture.location.preimage.realmDomainId,
      globalDomainId: fixture.location.preimage.globalDomainId,
      principalDomainId: fixture.location.preimage.principalDomainId,
      targetEnvironmentIds: ["browser", "server-request"],
      resolutionDomainIds: [fixture.module.domain.id, server.domain.id],
    });
    const generated = await createExecutionTemplateNode({
      kind: "generated",
      generatorSchemaId: "dathra.generator/1",
      generatorProfileDigest: await digest("generation:profile"),
      inputs: [{ slot: "source", templateNodeId: fixture.template.id }],
      rootDefinitionId: null,
      observationContractId: null,
      operationKind: "artifact-contribution",
      ordinal: 1,
    });
    if (generated.preimage.kind !== "generated") {
      throw new Error("Expected a generated template");
    }
    const domain = await createExecutionGenerationDomain({
      locationRequirementId: location.id,
      targetEnvironmentId: "browser",
      resolutionDomainId: server.domain.id,
      generatorProfileDigest: generated.preimage.generatorProfileDigest,
    });
    const occurrence = await createStaticExecutionOccurrenceTemplate({
      identitySlots: [],
      epochKinds: ["render-attempt"],
    });
    const node = await createQualifiedExecutionNode({
      templateNodeId: generated.id,
      locationRequirementId: location.id,
      occurrenceTemplateId: occurrence.id,
      semanticRole: "artifact",
      binding: { kind: "generated", generationDomainId: domain.id },
    });
    fixture.records.locationRequirements.push(location);
    fixture.records.occurrenceTemplates.push(occurrence);
    fixture.records.templateNodes.push(generated);
    fixture.records.generationDomains.push(domain);
    fixture.records.qualifiedNodes.push(node);

    await expectGraphError(
      createExecutionGraphSnapshot(snapshotInput(fixture.records), {
        moduleGraph,
        observationContracts: [fixture.contract.contract],
      }),
      "location-mismatch",
    );
  });

  it("rejects a root-bound generated template that selects another contract", async () => {
    const fixture = await createBaseFixture("generated-contract-mismatch");
    const otherContract = await createRootContract(
      fixture.root.id,
      null,
      "generated-contract-mismatch:other",
    );
    const generated = await createExecutionTemplateNode({
      kind: "generated",
      generatorSchemaId: "dathra.generator/1",
      generatorProfileDigest: await digest(
        "generated-contract-mismatch:profile",
      ),
      inputs: [{ slot: "source", templateNodeId: fixture.template.id }],
      rootDefinitionId: fixture.root.id,
      observationContractId: otherContract.contract.id,
      operationKind: "artifact-contribution",
      ordinal: 1,
    });
    if (generated.preimage.kind !== "generated") {
      throw new Error("Expected a generated template");
    }
    const generationDomain = await createExecutionGenerationDomain({
      locationRequirementId: fixture.location.id,
      targetEnvironmentId: "browser",
      resolutionDomainId: fixture.module.domain.id,
      generatorProfileDigest: generated.preimage.generatorProfileDigest,
    });
    const occurrence = await createStaticExecutionOccurrenceTemplate({
      identitySlots: [],
      epochKinds: ["render-attempt"],
    });
    const node = await createQualifiedExecutionNode({
      templateNodeId: generated.id,
      locationRequirementId: fixture.location.id,
      occurrenceTemplateId: occurrence.id,
      semanticRole: "artifact",
      binding: {
        kind: "generated",
        generationDomainId: generationDomain.id,
      },
    });
    fixture.records.occurrenceTemplates.push(occurrence);
    fixture.records.templateNodes.push(generated);
    fixture.records.generationDomains.push(generationDomain);
    fixture.records.qualifiedNodes.push(node);
    fixture.dependencies.observationContracts.push(otherContract.contract);

    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "root-contract-mismatch",
    );
  });

  it("rejects an entry fact that violates the root-kind table", async () => {
    const fixture = await createBaseFixture("entry-fact");
    fixture.records.rootObligations[0] = await createExecutionRootObligation({
      rootDefinitionId: fixture.root.id,
      observationContractId: fixture.contract.contract.id,
      targetNodeId: fixture.node.id,
      entryFactKind: "materialize",
      triggerConstraintIds: [],
      ownerConstraintIds:
        fixture.contract.owner === null ? [] : [fixture.contract.owner.id],
      terminalConstraintId: fixture.contract.terminal.id,
    });
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "root-contract-mismatch",
    );
  });

  it("rejects an unused auxiliary record but accepts an unreachable primary node", async () => {
    const fixture = await createBaseFixture("reachability");
    const unusedProfile = await createAnalysisProfile("unused");
    fixture.records.analysisProfiles.push(unusedProfile);
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "unreachable-auxiliary",
    );

    fixture.records.analysisProfiles.pop();
    const unreachable = await createSourceNode({
      label: "unreachable",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 99,
    });
    fixture.records.occurrenceTemplates.push(unreachable.occurrence);
    fixture.records.templateNodes.push(unreachable.template);
    fixture.records.qualifiedNodes.push(unreachable.node);
    await expect(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
    ).resolves.toBeDefined();
  });

  it("rejects noncanonical parser order", async () => {
    const fixture = await createBaseFixture("order");
    const extra = await createSourceNode({
      label: "order-extra",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "branch",
      semanticRole: "execution",
      ordinal: 1,
    });
    fixture.records.occurrenceTemplates.push(extra.occurrence);
    fixture.records.templateNodes.push(extra.template);
    fixture.records.qualifiedNodes.push(extra.node);
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const reversed = requireRecord(jsonClone(snapshot));
    const reversedPreimage = requireRecord(reversed.preimage);
    requireArray(reversedPreimage.qualifiedNodes).reverse();
    reversed.id = await digestCanonicalJson(reversedPreimage);
    await expectGraphError(
      parseExecutionGraphSnapshot(reversed, fixture.dependencies),
      "noncanonical-order",
    );
  });
});

describe("relation taxonomy", () => {
  it("matches the independent canonical edge and support tables", () => {
    expect(EDGE_ROLE_RULE).toEqual({
      "may-execute": { source: "any", target: "any" },
      "may-materialize": { source: "any", target: "any" },
      data: {
        source: [
          "module",
          "memory",
          "execution",
          "dom",
          "effect",
          "protocol",
          "recorder",
        ],
        target: [
          "module",
          "memory",
          "execution",
          "dom",
          "effect",
          "transfer",
          "protocol",
          "artifact",
          "admission",
          "recorder",
          "authority",
        ],
      },
      control: {
        source: ["module", "execution", "effect", "admission", "scheduler"],
        target: [
          "module",
          "execution",
          "registration",
          "dom",
          "effect",
          "protocol",
          "admission",
          "scheduler",
        ],
      },
      call: {
        source: ["execution", "registration", "admission", "protocol"],
        target: ["module", "execution", "effect", "admission", "protocol"],
      },
      "possible-call": {
        source: ["execution", "registration", "admission", "protocol"],
        target: ["module", "execution", "effect", "admission", "protocol"],
      },
      "reads-from": {
        source: ["module", "memory", "recorder"],
        target: ["module", "memory", "dom"],
      },
      "writes-to": {
        source: ["module", "memory", "dom"],
        target: ["module", "memory", "dom"],
      },
      "possible-subscription": {
        source: ["memory", "recorder"],
        target: ["module", "memory"],
      },
      "untracked-data": {
        source: ["memory", "recorder", "execution"],
        target: ["module", "memory", "execution"],
      },
      invalidation: {
        source: ["module", "memory", "execution"],
        target: ["execution", "dom", "effect"],
      },
      registration: { source: ["registration"], target: ["execution"] },
      materializes: {
        source: "any",
        target: ["memory", "registration", "dom", "protocol", "artifact"],
      },
      obligates: {
        source: "any",
        target: ["effect", "transfer", "protocol", "artifact", "authority"],
      },
      scheduling: {
        source: ["registration", "execution", "effect", "scheduler"],
        target: ["execution", "scheduler"],
      },
      "scheduler-sequence": {
        source: ["scheduler"],
        target: ["scheduler"],
      },
      settles: {
        source: ["execution", "effect", "protocol"],
        target: ["execution"],
      },
      resumes: {
        source: ["scheduler", "execution", "protocol"],
        target: ["execution"],
      },
      "abrupt-to-handler": {
        source: ["execution", "effect", "protocol"],
        target: ["execution"],
      },
      "module-link": { source: ["module"], target: ["module"] },
      "live-binding-read": {
        source: ["module", "memory"],
        target: ["module"],
      },
      "live-binding-write": {
        source: ["module", "memory"],
        target: ["module"],
      },
      "evaluate-before": { source: ["module"], target: ["module"] },
      "possible-alias": { source: "any", target: "any" },
      identity: { source: "any", target: "any" },
      ownership: { source: "any", target: "any" },
      lifetime: { source: "any", target: "any" },
      cleanup: {
        source: ["memory", "registration", "dom", "effect", "protocol"],
        target: ["execution", "effect"],
      },
      transfer: {
        source: "any",
        target: ["transfer", "protocol", "artifact"],
      },
      "capability-use": { source: "any", target: ["authority"] },
      "authority-possession": { source: ["authority"], target: "any" },
    });
    expect(REACTIVE_SUPPORT_OPERATION_RULE).toEqual({
      collector: ["compute", "effect"],
      read: ["state-read", "property-read", "catch-up-read"],
      dependency: ["heap-region", "module-binding-cell"],
      binding: ["dom-binding"],
    });
    expect(SCHEDULER_SEQUENCE_RULE).toEqual([
      "scheduler-enqueue:scheduler-start",
      "scheduler-start:scheduler-microtask-checkpoint",
      "scheduler-start:scheduler-complete",
      "scheduler-microtask-checkpoint:scheduler-microtask-checkpoint",
      "scheduler-microtask-checkpoint:scheduler-complete",
    ]);
  });
});

describe("operation taxonomy", () => {
  it("accepts every canonical operation-role pair and rejects every swapped role", async () => {
    const fixture = await createBaseFixture("operation-role-table");
    const operationRoles: readonly (readonly [
      ExecutionOperationKind,
      ExecutionSemanticRole,
    ])[] = [
      ["module-instantiation", "module"],
      ["module-evaluation", "module"],
      ["module-binding-cell", "module"],
      ["allocation", "memory"],
      ["heap-region", "memory"],
      ["property-read", "memory"],
      ["property-write", "memory"],
      ["state-read", "memory"],
      ["state-write", "memory"],
      ["compute", "execution"],
      ["call", "execution"],
      ["branch", "execution"],
      ["callback-registration", "registration"],
      ["callback-body", "execution"],
      ["await", "execution"],
      ["continuation", "execution"],
      ["return", "execution"],
      ["throw", "execution"],
      ["reject", "execution"],
      ["abort", "execution"],
      ["dom-create", "dom"],
      ["dom-reference", "dom"],
      ["dom-binding", "dom"],
      ["dom-mutation", "dom"],
      ["effect", "effect"],
      ["resource", "effect"],
      ["lifecycle", "effect"],
      ["stream-step", "effect"],
      ["transfer-demand", "transfer"],
      ["protocol-operation", "protocol"],
      ["artifact-contribution", "artifact"],
      ["admission-adapter", "admission"],
      ["event-recorder", "recorder"],
      ["catch-up-read", "recorder"],
      ["capability-use", "authority"],
      ["authority-possession", "authority"],
      ["enforcement-boundary", "authority"],
      ["scheduler-enqueue", "scheduler"],
      ["scheduler-start", "scheduler"],
      ["scheduler-microtask-checkpoint", "scheduler"],
      ["scheduler-complete", "scheduler"],
    ];
    const nodes = new Map<
      ExecutionOperationKind,
      Awaited<ReturnType<typeof createSourceNode>>
    >();
    for (const [
      ordinal,
      [operationKind, semanticRole],
    ] of operationRoles.entries()) {
      const node = await createSourceNode({
        label: `operation-role-table:${operationKind}`,
        module: fixture.module,
        analysisProfile: fixture.analysisProfile,
        location: fixture.location,
        operationKind,
        semanticRole,
        ordinal: 100 + ordinal,
      });
      nodes.set(operationKind, node);
      if (
        !fixture.records.occurrenceTemplates.some(
          (occurrence) => occurrence.id === node.occurrence.id,
        )
      ) {
        fixture.records.occurrenceTemplates.push(node.occurrence);
      }
      fixture.records.templateNodes.push(node.template);
      fixture.records.qualifiedNodes.push(node.node);
    }

    await expect(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
    ).resolves.toBeDefined();

    for (const [operationKind, semanticRole] of operationRoles) {
      const current = nodes.get(operationKind);
      if (current === undefined) throw new Error("Expected operation node");
      const wrongNode = await createQualifiedExecutionNode({
        templateNodeId: current.template.id,
        locationRequirementId: fixture.location.id,
        occurrenceTemplateId: current.occurrence.id,
        semanticRole: semanticRole === "module" ? "memory" : "module",
        binding: {
          kind: "module",
          runtimeBindingId: fixture.module.binding.id,
        },
      });
      await expectGraphError(
        createExecutionGraphSnapshot(
          snapshotInput({
            ...fixture.records,
            qualifiedNodes: fixture.records.qualifiedNodes.map((node) =>
              node.id === current.node.id ? wrongNode : node,
            ),
          }),
          fixture.dependencies,
        ),
        "role-mismatch",
      );
    }
  });
});

async function addCallbackRoot(
  fixture: BaseFixture,
  label: string,
): Promise<{
  readonly root: ExecutionRootDefinition;
  readonly contract: RootContractFixture;
  readonly callback: Awaited<ReturnType<typeof createSourceNode>>;
  readonly obligation: ExecutionRootObligation;
}> {
  const root = await createExecutionRootDefinition({
    rootKeyDigest: await digest(`${label}:root`),
    admission: "contingent",
    kind: "callback",
    phase: "event",
  });
  const contract = await createRootContract(
    root.id,
    "callback",
    `${label}:contract`,
  );
  const callback = await createSourceNode({
    label: `${label}:callback`,
    module: fixture.module,
    analysisProfile: fixture.analysisProfile,
    location: fixture.location,
    operationKind: "callback-body",
    semanticRole: "execution",
    ordinal: fixture.records.templateNodes.length,
    identitySlots: ["root-instance", "activation", "registration"],
    epochKinds: ["event-task", "activation"],
  });
  if (contract.trigger === null) throw new Error("Expected callback trigger");
  const obligation = await createExecutionRootObligation({
    rootDefinitionId: root.id,
    observationContractId: contract.contract.id,
    targetNodeId: callback.node.id,
    entryFactKind: "execute",
    triggerConstraintIds: [contract.trigger.id],
    ownerConstraintIds: contract.owner === null ? [] : [contract.owner.id],
    terminalConstraintId: contract.terminal.id,
  });
  fixture.records.rootDefinitions.push(root);
  if (
    !fixture.records.occurrenceTemplates.some(
      (occurrence) => occurrence.id === callback.occurrence.id,
    )
  ) {
    fixture.records.occurrenceTemplates.push(callback.occurrence);
  }
  fixture.records.templateNodes.push(callback.template);
  fixture.records.qualifiedNodes.push(callback.node);
  fixture.records.rootObligations.push(obligation);
  fixture.dependencies.observationContracts = [
    ...fixture.dependencies.observationContracts,
    contract.contract,
  ];
  return { root, contract, callback, obligation };
}

describe("registration root support", () => {
  it("attributes callback execution to the contingent child root", async () => {
    const fixture = await createBaseFixture("registration");
    const callback = await addCallbackRoot(fixture, "registration-child");
    const registration = await createSourceNode({
      label: "registration-site",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "callback-registration",
      semanticRole: "registration",
      ordinal: 10,
      identitySlots: ["registration"],
      epochKinds: ["render-attempt"],
    });
    fixture.records.occurrenceTemplates.push(registration.occurrence);
    fixture.records.templateNodes.push(registration.template);
    fixture.records.qualifiedNodes.push(registration.node);
    const materialize = await createExecutionEdge({
      kind: "may-materialize",
      sourceNodeId: fixture.node.id,
      targetNodeId: registration.node.id,
    });
    const registrationEdge = await createExecutionEdge({
      kind: "registration",
      sourceNodeId: registration.node.id,
      targetNodeId: callback.callback.node.id,
    });
    const support = await createRegistrationSupportTemplate({
      registrationNodeId: registration.node.id,
      registrationEdgeId: registrationEdge.id,
      callbackNodeId: callback.callback.node.id,
      contingentRootDefinitionId: callback.root.id,
      triggerConstraintId: requireTrigger(callback.contract).id,
      once: true,
      abortable: true,
      protocol: "dathra.registration-state/1",
    });
    fixture.records.edges.push(materialize, registrationEdge);
    fixture.records.registrationSupports.push(support);
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );

    expect(index.potentialRootSupports).toEqual([
      {
        parentRootDefinitionId: fixture.root.id,
        contingentRootDefinitionId: callback.root.id,
        supportTemplateId: support.id,
      },
    ]);
    expect(index.intraRootFacts).toContainEqual({
      rootDefinitionId: callback.root.id,
      factKind: "execute",
      nodeId: callback.callback.node.id,
    });
    expect(index.intraRootFacts).not.toContainEqual({
      rootDefinitionId: fixture.root.id,
      factKind: "execute",
      nodeId: callback.callback.node.id,
    });
  });

  it("supports finite callback fan-out with one site-level option tuple", async () => {
    const fixture = await createBaseFixture("registration-fan-out");
    const first = await addCallbackRoot(fixture, "registration-fan-out:first");
    const second = await addCallbackRoot(
      fixture,
      "registration-fan-out:second",
    );
    const registration = await createSourceNode({
      label: "registration-fan-out:site",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "callback-registration",
      semanticRole: "registration",
      ordinal: 13,
      identitySlots: ["registration"],
      epochKinds: ["render-attempt"],
    });
    fixture.records.occurrenceTemplates.push(registration.occurrence);
    fixture.records.templateNodes.push(registration.template);
    fixture.records.qualifiedNodes.push(registration.node);
    const materialize = await createExecutionEdge({
      kind: "may-materialize",
      sourceNodeId: fixture.node.id,
      targetNodeId: registration.node.id,
    });
    const firstEdge = await createExecutionEdge({
      kind: "registration",
      sourceNodeId: registration.node.id,
      targetNodeId: first.callback.node.id,
    });
    const secondEdge = await createExecutionEdge({
      kind: "registration",
      sourceNodeId: registration.node.id,
      targetNodeId: second.callback.node.id,
    });
    const firstSupport = await createRegistrationSupportTemplate({
      registrationNodeId: registration.node.id,
      registrationEdgeId: firstEdge.id,
      callbackNodeId: first.callback.node.id,
      contingentRootDefinitionId: first.root.id,
      triggerConstraintId: requireTrigger(first.contract).id,
      once: true,
      abortable: true,
      protocol: "dathra.registration-state/1",
    });
    const secondSupport = await createRegistrationSupportTemplate({
      registrationNodeId: registration.node.id,
      registrationEdgeId: secondEdge.id,
      callbackNodeId: second.callback.node.id,
      contingentRootDefinitionId: second.root.id,
      triggerConstraintId: requireTrigger(second.contract).id,
      once: true,
      abortable: true,
      protocol: "dathra.registration-state/1",
    });
    fixture.records.edges.push(materialize, firstEdge, secondEdge);
    fixture.records.registrationSupports.push(firstSupport, secondSupport);
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );

    expect(index.potentialRootSupports).toEqual(
      [firstSupport, secondSupport]
        .map((support) => ({
          parentRootDefinitionId: fixture.root.id,
          contingentRootDefinitionId:
            support.preimage.contingentRootDefinitionId,
          supportTemplateId: support.id,
        }))
        .sort((left, right) =>
          left.contingentRootDefinitionId < right.contingentRootDefinitionId
            ? -1
            : left.contingentRootDefinitionId > right.contingentRootDefinitionId
              ? 1
              : left.supportTemplateId < right.supportTemplateId
                ? -1
                : 1,
        ),
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumSupportChecks: 0,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumDerivedSupports: 0,
      }),
      "budget-exceeded",
    );
    await expect(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumSupportChecks: 2,
        maximumDerivedSupports: 2,
      }),
    ).resolves.toBeDefined();
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumSupportChecks: 1,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumDerivedSupports: 1,
      }),
      "budget-exceeded",
    );

    fixture.records.registrationSupports[1] =
      await createRegistrationSupportTemplate({
        registrationNodeId: registration.node.id,
        registrationEdgeId: secondEdge.id,
        callbackNodeId: second.callback.node.id,
        contingentRootDefinitionId: second.root.id,
        triggerConstraintId: requireTrigger(second.contract).id,
        once: false,
        abortable: true,
        protocol: "dathra.registration-state/1",
      });
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "support-mismatch",
    );
  });

  it("rejects registration support whose child trigger or endpoint is swapped", async () => {
    const fixture = await createBaseFixture("registration-mismatch");
    const callback = await addCallbackRoot(
      fixture,
      "registration-mismatch-child",
    );
    const registration = await createSourceNode({
      label: "registration-mismatch-site",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "callback-registration",
      semanticRole: "registration",
      ordinal: 11,
    });
    fixture.records.occurrenceTemplates.push(registration.occurrence);
    fixture.records.templateNodes.push(registration.template);
    fixture.records.qualifiedNodes.push(registration.node);
    const otherCallback = await createSourceNode({
      label: "registration-mismatch-other-callback",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "callback-body",
      semanticRole: "execution",
      ordinal: 12,
    });
    fixture.records.templateNodes.push(otherCallback.template);
    fixture.records.qualifiedNodes.push(otherCallback.node);
    const wrongEdge = await createExecutionEdge({
      kind: "registration",
      sourceNodeId: registration.node.id,
      targetNodeId: otherCallback.node.id,
    });
    fixture.records.edges.push(wrongEdge);
    fixture.records.registrationSupports.push(
      await createRegistrationSupportTemplate({
        registrationNodeId: registration.node.id,
        registrationEdgeId: wrongEdge.id,
        callbackNodeId: callback.callback.node.id,
        contingentRootDefinitionId: callback.root.id,
        triggerConstraintId: requireTrigger(callback.contract).id,
        once: false,
        abortable: false,
        protocol: "dathra.registration-state/1",
      }),
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "support-mismatch",
    );
  });

  it("keeps an unseeded callback support cycle inactive", async () => {
    const fixture = await createBaseFixture("unseeded-cycle");
    const first = await addCallbackRoot(fixture, "unseeded-first");
    const second = await addCallbackRoot(fixture, "unseeded-second");
    const firstRegistration = await createSourceNode({
      label: "unseeded-first-registration",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "callback-registration",
      semanticRole: "registration",
      ordinal: 40,
      identitySlots: ["registration"],
      epochKinds: ["event-task"],
    });
    const secondRegistration = await createSourceNode({
      label: "unseeded-second-registration",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "callback-registration",
      semanticRole: "registration",
      ordinal: 41,
      identitySlots: ["registration"],
      epochKinds: ["event-task"],
    });
    fixture.records.occurrenceTemplates.push(firstRegistration.occurrence);
    fixture.records.templateNodes.push(
      firstRegistration.template,
      secondRegistration.template,
    );
    fixture.records.qualifiedNodes.push(
      firstRegistration.node,
      secondRegistration.node,
    );
    const firstMaterialize = await createExecutionEdge({
      kind: "may-materialize",
      sourceNodeId: first.callback.node.id,
      targetNodeId: firstRegistration.node.id,
    });
    const secondMaterialize = await createExecutionEdge({
      kind: "may-materialize",
      sourceNodeId: second.callback.node.id,
      targetNodeId: secondRegistration.node.id,
    });
    const firstRegistrationEdge = await createExecutionEdge({
      kind: "registration",
      sourceNodeId: firstRegistration.node.id,
      targetNodeId: second.callback.node.id,
    });
    const secondRegistrationEdge = await createExecutionEdge({
      kind: "registration",
      sourceNodeId: secondRegistration.node.id,
      targetNodeId: first.callback.node.id,
    });
    fixture.records.edges.push(
      firstMaterialize,
      secondMaterialize,
      firstRegistrationEdge,
      secondRegistrationEdge,
    );
    fixture.records.registrationSupports.push(
      await createRegistrationSupportTemplate({
        registrationNodeId: firstRegistration.node.id,
        registrationEdgeId: firstRegistrationEdge.id,
        callbackNodeId: second.callback.node.id,
        contingentRootDefinitionId: second.root.id,
        triggerConstraintId: requireTrigger(second.contract).id,
        once: false,
        abortable: true,
        protocol: "dathra.registration-state/1",
      }),
      await createRegistrationSupportTemplate({
        registrationNodeId: secondRegistration.node.id,
        registrationEdgeId: secondRegistrationEdge.id,
        callbackNodeId: first.callback.node.id,
        contingentRootDefinitionId: first.root.id,
        triggerConstraintId: requireTrigger(first.contract).id,
        once: false,
        abortable: true,
        protocol: "dathra.registration-state/1",
      }),
    );
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );

    expect(index.potentialRootSupports).toEqual([]);
    expect(index.intraRootFacts).not.toContainEqual({
      rootDefinitionId: first.root.id,
      factKind: "execute",
      nodeId: first.callback.node.id,
    });
    expect(index.intraRootFacts).not.toContainEqual({
      rootDefinitionId: second.root.id,
      factKind: "execute",
      nodeId: second.callback.node.id,
    });
  });

  it("uses support template ID to break equal-length support-chain ties", async () => {
    const fixture = await createBaseFixture("support-chain-tie");
    const callback = await addCallbackRoot(fixture, "support-chain-tie:child");
    const supports: RegistrationSupportTemplate[] = [];
    for (const ordinal of [70, 71]) {
      const registration = await createSourceNode({
        label: `support-chain-tie:registration:${ordinal}`,
        module: fixture.module,
        analysisProfile: fixture.analysisProfile,
        location: fixture.location,
        operationKind: "callback-registration",
        semanticRole: "registration",
        ordinal,
        identitySlots: ["registration"],
      });
      if (
        !fixture.records.occurrenceTemplates.some(
          (occurrence) => occurrence.id === registration.occurrence.id,
        )
      ) {
        fixture.records.occurrenceTemplates.push(registration.occurrence);
      }
      fixture.records.templateNodes.push(registration.template);
      fixture.records.qualifiedNodes.push(registration.node);
      const materialize = await createExecutionEdge({
        kind: "may-materialize",
        sourceNodeId: fixture.node.id,
        targetNodeId: registration.node.id,
      });
      const registrationEdge = await createExecutionEdge({
        kind: "registration",
        sourceNodeId: registration.node.id,
        targetNodeId: callback.callback.node.id,
      });
      const support = await createRegistrationSupportTemplate({
        registrationNodeId: registration.node.id,
        registrationEdgeId: registrationEdge.id,
        callbackNodeId: callback.callback.node.id,
        contingentRootDefinitionId: callback.root.id,
        triggerConstraintId: requireTrigger(callback.contract).id,
        once: false,
        abortable: true,
        protocol: "dathra.registration-state/1",
      });
      fixture.records.edges.push(materialize, registrationEdge);
      fixture.records.registrationSupports.push(support);
      supports.push(support);
    }
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );
    const expected = supports.map((support) => support.id).sort()[0];

    expect(index.getSupportChain(fixture.root.id, callback.root.id)).toEqual({
      seedRootDefinitionId: fixture.root.id,
      supportedRootDefinitionId: callback.root.id,
      supportTemplateIds: [expected],
    });
  });
});

describe("reactive root support", () => {
  it("derives a potential updater only from the complete tracked path", async () => {
    const fixture = await createBaseFixture("reactive");
    const updaterRoot = await createExecutionRootDefinition({
      rootKeyDigest: await digest("reactive:updater-root"),
      admission: "contingent",
      kind: "reactive-updater",
      phase: "update",
    });
    const updaterContract = await createRootContract(
      updaterRoot.id,
      "effect",
      "reactive:updater-contract",
    );
    const read = await createSourceNode({
      label: "reactive:read",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "state-read",
      semanticRole: "memory",
      ordinal: 20,
    });
    const dependency = await createSourceNode({
      label: "reactive:dependency",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "heap-region",
      semanticRole: "memory",
      ordinal: 21,
      identitySlots: ["allocation"],
    });
    const binding = await createSourceNode({
      label: "reactive:binding",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "dom-binding",
      semanticRole: "dom",
      ordinal: 22,
      identitySlots: ["root-instance", "activation"],
      epochKinds: ["update-flush"],
    });
    const updaterObligation = await createExecutionRootObligation({
      rootDefinitionId: updaterRoot.id,
      observationContractId: updaterContract.contract.id,
      targetNodeId: binding.node.id,
      entryFactKind: "execute",
      triggerConstraintIds: [requireTrigger(updaterContract).id],
      ownerConstraintIds:
        updaterContract.owner === null ? [] : [updaterContract.owner.id],
      terminalConstraintId: updaterContract.terminal.id,
    });
    const executeRead = await createExecutionEdge({
      kind: "may-execute",
      sourceNodeId: fixture.node.id,
      targetNodeId: read.node.id,
    });
    const materializeBinding = await createExecutionEdge({
      kind: "may-materialize",
      sourceNodeId: fixture.node.id,
      targetNodeId: binding.node.id,
    });
    const dataEdge = await createExecutionEdge({
      kind: "data",
      sourceNodeId: read.node.id,
      targetNodeId: fixture.node.id,
    });
    const subscriptionEdge = await createExecutionEdge({
      kind: "possible-subscription",
      sourceNodeId: read.node.id,
      targetNodeId: dependency.node.id,
    });
    const invalidationEdge = await createExecutionEdge({
      kind: "invalidation",
      sourceNodeId: dependency.node.id,
      targetNodeId: binding.node.id,
    });
    const support = await createReactiveSupportTemplate({
      collectorNodeId: fixture.node.id,
      readNodeId: read.node.id,
      dependencyNodeId: dependency.node.id,
      bindingNodeId: binding.node.id,
      dataEdgeId: dataEdge.id,
      subscriptionEdgeId: subscriptionEdge.id,
      invalidationEdgeIds: [invalidationEdge.id],
      contingentRootDefinitionId: updaterRoot.id,
      triggerConstraintId: requireTrigger(updaterContract).id,
    });
    fixture.records.rootDefinitions.push(updaterRoot);
    fixture.records.rootObligations.push(updaterObligation);
    fixture.records.occurrenceTemplates.push(
      read.occurrence,
      dependency.occurrence,
      binding.occurrence,
    );
    fixture.records.templateNodes.push(
      read.template,
      dependency.template,
      binding.template,
    );
    fixture.records.qualifiedNodes.push(
      read.node,
      dependency.node,
      binding.node,
    );
    fixture.records.edges.push(
      executeRead,
      materializeBinding,
      dataEdge,
      subscriptionEdge,
      invalidationEdge,
    );
    fixture.records.reactiveSupports.push(support);
    fixture.dependencies.observationContracts = [
      ...fixture.dependencies.observationContracts,
      updaterContract.contract,
    ];
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );

    expect(index.potentialRootSupports).toContainEqual({
      parentRootDefinitionId: fixture.root.id,
      contingentRootDefinitionId: updaterRoot.id,
      supportTemplateId: support.id,
    });
    expect(index.intraRootFacts).toContainEqual({
      rootDefinitionId: updaterRoot.id,
      factKind: "execute",
      nodeId: binding.node.id,
    });

    const inactiveSnapshot = await createExecutionGraphSnapshot(
      snapshotInput({
        ...fixture.records,
        edges: fixture.records.edges.filter(
          (edge) => edge.id !== executeRead.id,
        ),
      }),
      fixture.dependencies,
    );
    await expectGraphError(
      createExecutionGraphIndex(inactiveSnapshot, fixture.dependencies, {
        maximumSupportChecks: 0,
      }),
      "budget-exceeded",
    );
    const inactiveIndex = await createExecutionGraphIndex(
      inactiveSnapshot,
      fixture.dependencies,
    );
    expect(inactiveIndex.potentialRootSupports).toEqual([]);
  });

  it("does not accept untracked-data as subscription evidence", async () => {
    const fixture = await createBaseFixture("untracked");
    const updaterRoot = await createExecutionRootDefinition({
      rootKeyDigest: await digest("untracked:root"),
      admission: "contingent",
      kind: "reactive-updater",
      phase: "update",
    });
    const contract = await createRootContract(
      updaterRoot.id,
      "effect",
      "untracked:contract",
    );
    const read = await createSourceNode({
      label: "untracked:read",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "state-read",
      semanticRole: "memory",
      ordinal: 60,
    });
    const dependency = await createSourceNode({
      label: "untracked:dependency",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "heap-region",
      semanticRole: "memory",
      ordinal: 61,
    });
    const binding = await createSourceNode({
      label: "untracked:binding",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "dom-binding",
      semanticRole: "dom",
      ordinal: 62,
      identitySlots: ["root-instance", "activation"],
      epochKinds: ["update-flush"],
    });
    const obligation = await createExecutionRootObligation({
      rootDefinitionId: updaterRoot.id,
      observationContractId: contract.contract.id,
      targetNodeId: binding.node.id,
      entryFactKind: "execute",
      triggerConstraintIds: [requireTrigger(contract).id],
      ownerConstraintIds: contract.owner === null ? [] : [contract.owner.id],
      terminalConstraintId: contract.terminal.id,
    });
    const dataEdge = await createExecutionEdge({
      kind: "data",
      sourceNodeId: read.node.id,
      targetNodeId: fixture.node.id,
    });
    const untrackedEdge = await createExecutionEdge({
      kind: "untracked-data",
      sourceNodeId: read.node.id,
      targetNodeId: dependency.node.id,
    });
    const invalidationEdge = await createExecutionEdge({
      kind: "invalidation",
      sourceNodeId: dependency.node.id,
      targetNodeId: binding.node.id,
    });
    fixture.records.rootDefinitions.push(updaterRoot);
    fixture.records.rootObligations.push(obligation);
    fixture.records.occurrenceTemplates.push(
      read.occurrence,
      binding.occurrence,
    );
    fixture.records.templateNodes.push(
      read.template,
      dependency.template,
      binding.template,
    );
    fixture.records.qualifiedNodes.push(
      read.node,
      dependency.node,
      binding.node,
    );
    fixture.records.edges.push(dataEdge, untrackedEdge, invalidationEdge);
    fixture.records.reactiveSupports.push(
      await createReactiveSupportTemplate({
        collectorNodeId: fixture.node.id,
        readNodeId: read.node.id,
        dependencyNodeId: dependency.node.id,
        bindingNodeId: binding.node.id,
        dataEdgeId: dataEdge.id,
        subscriptionEdgeId: untrackedEdge.id,
        invalidationEdgeIds: [invalidationEdge.id],
        contingentRootDefinitionId: updaterRoot.id,
        triggerConstraintId: requireTrigger(contract).id,
      }),
    );
    fixture.dependencies.observationContracts.push(contract.contract);

    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "support-mismatch",
    );
  });
});

describe("deterministic derivation index", () => {
  it("selects the lexicographically smallest shortest path and traversal SCC", async () => {
    const fixture = await createBaseFixture("path");
    const first = await createSourceNode({
      label: "path:first",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 50,
    });
    const second = await createSourceNode({
      label: "path:second",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 51,
    });
    const target = await createSourceNode({
      label: "path:target",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 52,
    });
    fixture.records.occurrenceTemplates.push(first.occurrence);
    fixture.records.templateNodes.push(
      first.template,
      second.template,
      target.template,
    );
    fixture.records.qualifiedNodes.push(first.node, second.node, target.node);
    const rootToFirst = await createExecutionEdge({
      kind: "may-execute",
      sourceNodeId: fixture.node.id,
      targetNodeId: first.node.id,
    });
    const firstToTarget = await createExecutionEdge({
      kind: "may-execute",
      sourceNodeId: first.node.id,
      targetNodeId: target.node.id,
    });
    const rootToSecond = await createExecutionEdge({
      kind: "may-execute",
      sourceNodeId: fixture.node.id,
      targetNodeId: second.node.id,
    });
    const secondToTarget = await createExecutionEdge({
      kind: "may-execute",
      sourceNodeId: second.node.id,
      targetNodeId: target.node.id,
    });
    const targetToRoot = await createExecutionEdge({
      kind: "may-execute",
      sourceNodeId: target.node.id,
      targetNodeId: fixture.node.id,
    });
    fixture.records.edges.push(
      rootToFirst,
      firstToTarget,
      rootToSecond,
      secondToTarget,
      targetToRoot,
    );
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );
    const expectedPath =
      rootToFirst.id < rootToSecond.id
        ? [rootToFirst.id, firstToTarget.id]
        : [rootToSecond.id, secondToTarget.id];

    expect(
      index.getJustificationPath(fixture.root.id, "execute", target.node.id),
    ).toEqual({
      rootDefinitionId: fixture.root.id,
      factKind: "execute",
      nodeId: target.node.id,
      edgeIds: expectedPath,
    });
    expect(index.getStronglyConnectedComponent(fixture.node.id)).toEqual(
      index.getStronglyConnectedComponent(target.node.id),
    );
  });

  it("keeps non-traversal relations out of root closure and SCCs", async () => {
    const fixture = await createBaseFixture("index");
    const second = await createSourceNode({
      label: "index:second",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 30,
      identitySlots: ["root-instance"],
    });
    fixture.records.occurrenceTemplates.push(second.occurrence);
    fixture.records.templateNodes.push(second.template);
    fixture.records.qualifiedNodes.push(second.node);
    fixture.records.edges.push(
      await createExecutionEdge({
        kind: "identity",
        sourceNodeId: fixture.node.id,
        targetNodeId: second.node.id,
        identitySlot: "root-instance",
      }),
    );
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );

    expect(index.intraRootFacts).not.toContainEqual({
      rootDefinitionId: fixture.root.id,
      factKind: "execute",
      nodeId: second.node.id,
    });
    expect(index.getStronglyConnectedComponent(fixture.node.id)).not.toEqual(
      index.getStronglyConnectedComponent(second.node.id),
    );
  });

  it("requires an exact shared occurrence slot for identity edges", async () => {
    const fixture = await createBaseFixture("identity-slot");
    const missingSlot = await createSourceNode({
      label: "identity-slot:missing",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 31,
    });
    fixture.records.occurrenceTemplates.push(missingSlot.occurrence);
    fixture.records.templateNodes.push(missingSlot.template);
    fixture.records.qualifiedNodes.push(missingSlot.node);
    fixture.records.edges.push(
      await createExecutionEdge({
        kind: "identity",
        sourceNodeId: fixture.node.id,
        targetNodeId: missingSlot.node.id,
        identitySlot: "root-instance",
      }),
    );

    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "edge-mismatch",
    );
  });

  it("keeps identity assertions symbolic across locations and bindings", async () => {
    const fixture = await createBaseFixture("identity-symbolic");
    const otherModule = await createModuleNode(
      "identity-symbolic:other",
      "browser",
    );
    const otherLocation = await createLocation(
      "identity-symbolic:other-location",
      otherModule,
    );
    const other = await createSourceNode({
      label: "identity-symbolic:other-node",
      module: otherModule,
      analysisProfile: fixture.analysisProfile,
      location: otherLocation,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 33,
      identitySlots: ["root-instance"],
    });
    fixture.records.locationRequirements.push(otherLocation);
    fixture.records.occurrenceTemplates.push(other.occurrence);
    fixture.records.templateNodes.push(other.template);
    fixture.records.qualifiedNodes.push(other.node);
    fixture.records.edges.push(
      await createExecutionEdge({
        kind: "identity",
        sourceNodeId: fixture.node.id,
        targetNodeId: other.node.id,
        identitySlot: "root-instance",
      }),
    );

    await expect(
      createExecutionGraphSnapshot(snapshotInput(fixture.records), {
        moduleGraph: await createModuleGraph([fixture.module, otherModule]),
        observationContracts: fixture.dependencies.observationContracts,
      }),
    ).resolves.toBeDefined();
  });

  it("rejects identity edges across semantic roles", async () => {
    const fixture = await createBaseFixture("identity-role");
    const memory = await createSourceNode({
      label: "identity-role:memory",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "allocation",
      semanticRole: "memory",
      ordinal: 32,
      identitySlots: ["root-instance"],
    });
    fixture.records.occurrenceTemplates.push(memory.occurrence);
    fixture.records.templateNodes.push(memory.template);
    fixture.records.qualifiedNodes.push(memory.node);
    fixture.records.edges.push(
      await createExecutionEdge({
        kind: "identity",
        sourceNodeId: fixture.node.id,
        targetNodeId: memory.node.id,
        identitySlot: "root-instance",
      }),
    );

    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
      "edge-mismatch",
    );
  });

  it("rejects identitySlot on a non-identity edge in the strict parser", async () => {
    const fixture = await createBaseFixture("identity-slot-extra-field");
    fixture.records.edges.push(
      await createExecutionEdge({
        kind: "may-execute",
        sourceNodeId: fixture.node.id,
        targetNodeId: fixture.node.id,
      }),
    );
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const forged = requireRecord(jsonClone(snapshot));
    const preimage = requireRecord(forged.preimage);
    const edgeRecord = requireRecord(requireArray(preimage.edges)[0]);
    const edgePreimage = requireRecord(edgeRecord.preimage);
    edgePreimage.identitySlot = "root-instance";
    edgeRecord.id = await digestCanonicalJson(edgePreimage);
    forged.id = await digestCanonicalJson(preimage);

    await expectGraphError(
      parseExecutionGraphSnapshot(forged, fixture.dependencies),
      "invalid-field",
    );
  });

  it("validates every scheduler sequence pair from the canonical table", async () => {
    const fixture = await createBaseFixture("scheduler-sequence");
    const operationKinds = [
      "scheduler-enqueue",
      "scheduler-start",
      "scheduler-microtask-checkpoint",
      "scheduler-complete",
    ] as const;
    const allowed = new Set([
      "scheduler-enqueue:scheduler-start",
      "scheduler-start:scheduler-microtask-checkpoint",
      "scheduler-start:scheduler-complete",
      "scheduler-microtask-checkpoint:scheduler-microtask-checkpoint",
      "scheduler-microtask-checkpoint:scheduler-complete",
    ]);
    const nodes = new Map<
      (typeof operationKinds)[number],
      Awaited<ReturnType<typeof createSourceNode>>
    >();
    for (const [ordinal, operationKind] of operationKinds.entries()) {
      const node = await createSourceNode({
        label: `scheduler-sequence:${operationKind}`,
        module: fixture.module,
        analysisProfile: fixture.analysisProfile,
        location: fixture.location,
        operationKind,
        semanticRole: "scheduler",
        ordinal: 40 + ordinal,
      });
      nodes.set(operationKind, node);
      if (
        !fixture.records.occurrenceTemplates.some(
          (occurrence) => occurrence.id === node.occurrence.id,
        )
      ) {
        fixture.records.occurrenceTemplates.push(node.occurrence);
      }
      fixture.records.templateNodes.push(node.template);
      fixture.records.qualifiedNodes.push(node.node);
    }

    for (const sourceKind of operationKinds) {
      for (const targetKind of operationKinds) {
        const source = nodes.get(sourceKind);
        const target = nodes.get(targetKind);
        if (source === undefined || target === undefined) {
          throw new Error("Expected scheduler fixture node");
        }
        const edge = await createExecutionEdge({
          kind: "scheduler-sequence",
          sourceNodeId: source.node.id,
          targetNodeId: target.node.id,
        });
        const operation = createExecutionGraphSnapshot(
          snapshotInput({ ...fixture.records, edges: [edge] }),
          fixture.dependencies,
        );
        let outcome: "accepted" | ExecutionGraphErrorCode;
        try {
          await operation;
          outcome = "accepted";
        } catch (error) {
          if (!(error instanceof ExecutionGraphError)) throw error;
          outcome = error.code;
        }
        expect(outcome).toBe(
          allowed.has(`${sourceKind}:${targetKind}`)
            ? "accepted"
            : "edge-mismatch",
        );
      }
    }
  });

  it("uses the fixed derivation profile and preserves fact kind in roots-for-node", async () => {
    const fixture = await createBaseFixture("profile");
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const index = await createExecutionGraphIndex(
      snapshot,
      fixture.dependencies,
    );

    expect(index.derivationProfile).toBe("dathra.execution-graph-derivation/1");
    expect(index.derivationProfile).toBe(EXECUTION_GRAPH_DERIVATION_PROFILE);
    expect(index.getRootsForNode(fixture.node.id)).toEqual([
      {
        rootDefinitionId: fixture.root.id,
        factKind: "execute",
        nodeId: fixture.node.id,
      },
    ]);
    expect(index.getOccurrenceTemplate(fixture.node.id)).toEqual(
      fixture.occurrence,
    );
  });

  it("fails atomically when derivation or preflight budget is exhausted", async () => {
    const fixture = await createBaseFixture("budget");
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumDerivationFacts: 0,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        {
          maximumInputDepth: 1,
        },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        {
          maximumValidationSteps: 0,
        },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        {
          maximumDependencyContracts: 0,
        },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        {
          maximumDependencyModuleRecords: 0,
        },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        {
          maximumRecordsPerKind: 0,
        },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumSccSteps: 0,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumIndexSteps: 0,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionAnalysisProfile(
        {
          analyzerImplementationDigest: await digest("budget:canonical"),
          analyzerVersion: "1.0.0",
          normalizedSyntaxSchemaId: "dathra.normalized-syntax/1",
          operationTaxonomySchemaId: "dathra.execution-operation/1",
          analysisConfigurationDigest: await digest("budget:configuration"),
        },
        { maximumCanonicalBytes: 0 },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionAnalysisProfile(
        {
          analyzerImplementationDigest: await digest("budget:hard-cap"),
          analyzerVersion: "1.0.0",
          normalizedSyntaxSchemaId: "dathra.normalized-syntax/1",
          operationTaxonomySchemaId: "dathra.execution-operation/1",
          analysisConfigurationDigest: await digest(
            "budget:hard-cap-configuration",
          ),
        },
        { maximumInputDepth: 65 },
      ),
      "invalid-field",
    );
    await expectGraphError(
      createExecutionAnalysisProfile(
        {
          analyzerImplementationDigest: await digest("budget:validation"),
          analyzerVersion: "1.0.0",
          normalizedSyntaxSchemaId: "dathra.normalized-syntax/1",
          operationTaxonomySchemaId: "dathra.execution-operation/1",
          analysisConfigurationDigest: await digest(
            "budget:validation-configuration",
          ),
        },
        { maximumValidationSteps: 0 },
      ),
      "budget-exceeded",
    );

    const traversed = await createSourceNode({
      label: "budget:traversed",
      module: fixture.module,
      analysisProfile: fixture.analysisProfile,
      location: fixture.location,
      operationKind: "compute",
      semanticRole: "execution",
      ordinal: 90,
    });
    if (
      !fixture.records.occurrenceTemplates.some(
        (occurrence) => occurrence.id === traversed.occurrence.id,
      )
    ) {
      fixture.records.occurrenceTemplates.push(traversed.occurrence);
    }
    fixture.records.templateNodes.push(traversed.template);
    fixture.records.qualifiedNodes.push(traversed.node);
    fixture.records.edges.push(
      await createExecutionEdge({
        kind: "may-execute",
        sourceNodeId: fixture.node.id,
        targetNodeId: traversed.node.id,
      }),
    );
    const traversalSnapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    await expectGraphError(
      createExecutionGraphIndex(traversalSnapshot, fixture.dependencies, {
        maximumTraversalSteps: 0,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(traversalSnapshot, fixture.dependencies, {
        maximumPathSteps: 0,
      }),
      "budget-exceeded",
    );
  });

  it("checks graph cardinality before canonical clone work", async () => {
    const fixture = await createBaseFixture("budget-cardinality-preflight");
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    let reads = 0;
    const profiles: ExecutionAnalysisProfile[] = [];
    Object.defineProperty(profiles, "0", {
      configurable: true,
      enumerable: true,
      get() {
        reads += 1;
        return fixture.analysisProfile;
      },
    });
    profiles.length = 1;
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput({ ...fixture.records, analysisProfiles: profiles }),
        fixture.dependencies,
        { maximumRecordsPerKind: 0 },
      ),
      "budget-exceeded",
    );
    const parsedInput = requireRecord(jsonClone(snapshot));
    const parsedPreimage = requireRecord(parsedInput.preimage);
    parsedPreimage.analysisProfiles = profiles;
    await expectGraphError(
      parseExecutionGraphSnapshot(parsedInput, fixture.dependencies, {
        maximumRecordsPerKind: 0,
      }),
      "budget-exceeded",
    );
    expect(reads).toBe(0);

    await expect(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        { maximumRecordsPerKind: 1 },
      ),
    ).resolves.toBeDefined();
    await expect(
      parseExecutionGraphSnapshot(snapshot, fixture.dependencies, {
        maximumRecordsPerKind: 1,
      }),
    ).resolves.toBeDefined();
  });

  it("accepts exact work limits and rejects boundary-minus-one", async () => {
    const fixture = await createBaseFixture("budget-exact-boundary");
    const snapshot = await createExecutionGraphSnapshot(
      snapshotInput(fixture.records),
      fixture.dependencies,
    );
    const validationBoundary = await findMinimumPassingLimit(
      10_000,
      async (maximumValidationSteps) =>
        await createExecutionGraphSnapshot(
          snapshotInput(fixture.records),
          fixture.dependencies,
          { maximumValidationSteps },
        ),
    );
    const canonicalBoundary = await findMinimumPassingLimit(
      1_000_000,
      async (maximumCanonicalBytes) =>
        await createExecutionGraphSnapshot(
          snapshotInput(fixture.records),
          fixture.dependencies,
          { maximumCanonicalBytes },
        ),
    );
    const sccBoundary = await findMinimumPassingLimit(
      10_000,
      async (maximumSccSteps) =>
        await createExecutionGraphIndex(snapshot, fixture.dependencies, {
          maximumSccSteps,
        }),
    );
    const indexBoundary = await findMinimumPassingLimit(
      10_000,
      async (maximumIndexSteps) =>
        await createExecutionGraphIndex(snapshot, fixture.dependencies, {
          maximumIndexSteps,
        }),
    );
    expect(validationBoundary).toBeGreaterThan(0);
    expect(canonicalBoundary).toBeGreaterThan(0);
    expect(sccBoundary).toBeGreaterThan(0);
    expect(indexBoundary).toBeGreaterThan(0);
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        { maximumValidationSteps: validationBoundary - 1 },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
        { maximumCanonicalBytes: canonicalBoundary - 1 },
      ),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumSccSteps: sccBoundary - 1,
      }),
      "budget-exceeded",
    );
    await expectGraphError(
      createExecutionGraphIndex(snapshot, fixture.dependencies, {
        maximumIndexSteps: indexBoundary - 1,
      }),
      "budget-exceeded",
    );
  });

  it("validates a deep generated-template DAG without recursive stack use", async () => {
    const fixture = await createBaseFixture("deep-template-dag");
    const generatorProfileDigest = await digest("deep-template-dag:generator");
    let previous = fixture.template;
    for (let ordinal = 0; ordinal < 12_000; ordinal += 1) {
      const generated = await createExecutionTemplateNode({
        kind: "generated",
        generatorSchemaId: "dathra.deep-template-dag/1",
        generatorProfileDigest,
        inputs: [{ slot: "previous", templateNodeId: previous.id }],
        rootDefinitionId: null,
        observationContractId: null,
        operationKind: "compute",
        ordinal,
      });
      fixture.records.templateNodes.push(generated);
      previous = generated;
    }
    const occurrence = await createStaticExecutionOccurrenceTemplate({
      identitySlots: [],
      epochKinds: ["render-attempt"],
    });
    const generationDomain = await createExecutionGenerationDomain({
      locationRequirementId: fixture.location.id,
      targetEnvironmentId: fixture.module.domain.preimage.targetEnvironmentId,
      resolutionDomainId: fixture.module.domain.id,
      generatorProfileDigest,
    });
    const node = await createQualifiedExecutionNode({
      templateNodeId: previous.id,
      locationRequirementId: fixture.location.id,
      occurrenceTemplateId: occurrence.id,
      semanticRole: "execution",
      binding: {
        kind: "generated",
        generationDomainId: generationDomain.id,
      },
    });
    fixture.records.occurrenceTemplates.push(occurrence);
    fixture.records.generationDomains.push(generationDomain);
    fixture.records.qualifiedNodes.push(node);

    await expect(
      createExecutionGraphSnapshot(
        snapshotInput(fixture.records),
        fixture.dependencies,
      ),
    ).resolves.toBeDefined();
  });
});

describe("package boundary", () => {
  it("keeps the package-local graph facade out of the npm root API", () => {
    expect(publicApi).not.toHaveProperty("createExecutionGraphSnapshot");
    expect(publicApi).not.toHaveProperty("parseExecutionGraphSnapshot");
    expect(publicApi).not.toHaveProperty("createExecutionGraphIndex");
    expect(publicApi).not.toHaveProperty("ExecutionGraphError");
  });
});
