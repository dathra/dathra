import type { ObservationContract, Sha256Digest } from "@dathra/shared";

import type {
  CanonicalModuleUrl,
  ModuleContentDigest,
  ModuleDefinitionId,
  ModuleGraphSnapshot,
  ModuleGraphSnapshotId,
  ModuleResolutionDomainId,
  ModuleSemanticProfileId,
  RuntimeModuleBindingId,
} from "../moduleGraph/implementation";

declare const executionGraphIdBrand: unique symbol;

/** A content-addressed execution graph identity branded by record kind. */
type ExecutionGraphId<Kind extends string> = Sha256Digest & {
  readonly [executionGraphIdBrand]: Kind;
};

type ExecutionAnalysisProfileId = ExecutionGraphId<"analysis-profile">;

type ExecutionRootDefinitionId = ExecutionGraphId<"root-definition">;

type ExecutionLocationRequirementId = ExecutionGraphId<"location-requirement">;

type StaticExecutionOccurrenceTemplateId =
  ExecutionGraphId<"occurrence-template">;

type ExecutionTemplateNodeId = ExecutionGraphId<"template-node">;

type ExecutionGenerationDomainId = ExecutionGraphId<"generation-domain">;

type QualifiedExecutionNodeId = ExecutionGraphId<"qualified-node">;

type ExecutionEdgeId = ExecutionGraphId<"edge">;

type RegistrationSupportTemplateId = ExecutionGraphId<"registration-support">;

type ReactiveSupportTemplateId = ExecutionGraphId<"reactive-support">;

type ExecutionRootObligationId = ExecutionGraphId<"root-obligation">;

type ExecutionGraphSnapshotId = ExecutionGraphId<"snapshot">;

/** A property or array index in an execution graph failure path. */
type ExecutionGraphPathSegment = string | number;

/** Stable failure codes emitted by execution graph operations. */
type ExecutionGraphErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "noncanonical-order"
  | "duplicate-record"
  | "digest-mismatch"
  | "dangling-reference"
  | "dependency-mismatch"
  | "identity-cycle"
  | "role-mismatch"
  | "location-mismatch"
  | "edge-mismatch"
  | "root-contract-mismatch"
  | "support-mismatch"
  | "unreachable-auxiliary"
  | "budget-exceeded";

/** Describes why an execution graph value is invalid. */
class ExecutionGraphError extends TypeError {
  readonly code: ExecutionGraphErrorCode;
  readonly path: readonly ExecutionGraphPathSegment[];

  /** Creates an immutable execution graph failure. */
  constructor(
    code: ExecutionGraphErrorCode,
    path: readonly ExecutionGraphPathSegment[],
    message: string,
  ) {
    super(message);
    this.name = "ExecutionGraphError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

interface ExecutionIdentityRecord<Id, Preimage> {
  readonly id: Id;
  readonly preimage: Preimage;
}

interface ExecutionAnalysisProfilePreimage {
  readonly schema: "dathra.execution-analysis-profile/1";
  readonly analyzerImplementationDigest: Sha256Digest;
  readonly analyzerVersion: string;
  readonly normalizedSyntaxSchemaId: string;
  readonly operationTaxonomySchemaId: string;
  readonly analysisConfigurationDigest: Sha256Digest;
}

/** Immutable provenance identity for one execution analysis profile. */
type ExecutionAnalysisProfile = ExecutionIdentityRecord<
  ExecutionAnalysisProfileId,
  ExecutionAnalysisProfilePreimage
>;

type ExecutionAnalysisProfileInput = Omit<
  ExecutionAnalysisProfilePreimage,
  "schema"
>;

type ExecutionRootAdmission = "seed" | "contingent";

type ExecutionRootKind =
  | "external-entry"
  | "initial-ui"
  | "artifact"
  | "request-handler"
  | "action"
  | "lifecycle"
  | "effect"
  | "platform-obligation"
  | "callback"
  | "reactive-updater";

type ExecutionRootPhase =
  | "admission"
  | "render"
  | "build"
  | "lifecycle"
  | "effect"
  | "event"
  | "update";

interface ExecutionRootDefinitionPreimage {
  readonly schema: "dathra.execution-root-definition/1";
  readonly rootKeyDigest: Sha256Digest;
  readonly admission: ExecutionRootAdmission;
  readonly kind: ExecutionRootKind;
  readonly phase: ExecutionRootPhase;
}

/** Primitive root identity independent of graph nodes and contracts. */
type ExecutionRootDefinition = ExecutionIdentityRecord<
  ExecutionRootDefinitionId,
  ExecutionRootDefinitionPreimage
>;

type ExecutionRootDefinitionInput = Omit<
  ExecutionRootDefinitionPreimage,
  "schema"
>;

interface ExecutionLocationRequirementPreimage {
  readonly schema: "dathra.execution-location-requirement/1";
  readonly hostInstanceDomainId: Sha256Digest;
  readonly agentClusterDomainId: Sha256Digest;
  readonly agentDomainId: Sha256Digest;
  readonly realmDomainId: Sha256Digest;
  readonly globalDomainId: Sha256Digest;
  readonly principalDomainId: Sha256Digest;
  readonly targetEnvironmentIds: readonly string[];
  readonly resolutionDomainIds: readonly ModuleResolutionDomainId[];
}

/** Symbolic execution location requirements without concrete host instances. */
type ExecutionLocationRequirement = ExecutionIdentityRecord<
  ExecutionLocationRequirementId,
  ExecutionLocationRequirementPreimage
>;

type ExecutionLocationRequirementInput = Omit<
  ExecutionLocationRequirementPreimage,
  "schema"
>;

type ExecutionOccurrenceIdentitySlot =
  | "root-instance"
  | "activation"
  | "continuation"
  | "registration"
  | "allocation";

type ExecutionEpochKind =
  | "module-instance"
  | "request"
  | "render-attempt"
  | "activation"
  | "event-task"
  | "update-flush"
  | "remote-invocation"
  | "cleanup";

interface StaticExecutionOccurrenceTemplatePreimage {
  readonly schema: "dathra.static-execution-occurrence/1";
  readonly identitySlots: readonly ExecutionOccurrenceIdentitySlot[];
  readonly epochKinds: readonly ExecutionEpochKind[];
}

/** Static occurrence shape without concrete runtime identities. */
type StaticExecutionOccurrenceTemplate = ExecutionIdentityRecord<
  StaticExecutionOccurrenceTemplateId,
  StaticExecutionOccurrenceTemplatePreimage
>;

type StaticExecutionOccurrenceTemplateInput = Omit<
  StaticExecutionOccurrenceTemplatePreimage,
  "schema"
>;

type ExecutionOperationKind =
  | "module-instantiation"
  | "module-evaluation"
  | "module-binding-cell"
  | "allocation"
  | "heap-region"
  | "property-read"
  | "property-write"
  | "state-read"
  | "state-write"
  | "compute"
  | "call"
  | "branch"
  | "callback-registration"
  | "callback-body"
  | "await"
  | "continuation"
  | "return"
  | "throw"
  | "reject"
  | "abort"
  | "dom-create"
  | "dom-reference"
  | "dom-binding"
  | "dom-mutation"
  | "effect"
  | "resource"
  | "lifecycle"
  | "stream-step"
  | "transfer-demand"
  | "protocol-operation"
  | "artifact-contribution"
  | "admission-adapter"
  | "event-recorder"
  | "catch-up-read"
  | "capability-use"
  | "authority-possession"
  | "enforcement-boundary"
  | "scheduler-enqueue"
  | "scheduler-start"
  | "scheduler-microtask-checkpoint"
  | "scheduler-complete";

type ExecutionSemanticRole =
  | "module"
  | "memory"
  | "execution"
  | "registration"
  | "dom"
  | "effect"
  | "transfer"
  | "protocol"
  | "artifact"
  | "admission"
  | "recorder"
  | "authority"
  | "scheduler";

interface GeneratedTemplateInputBinding {
  readonly slot: string;
  readonly templateNodeId: ExecutionTemplateNodeId;
}

interface SourceExecutionTemplateNodePreimage {
  readonly schema: "dathra.execution-template-node/1";
  readonly kind: "source";
  readonly moduleDefinitionId: ModuleDefinitionId;
  readonly canonicalSourceUrl: CanonicalModuleUrl;
  readonly transformedContentDigest: ModuleContentDigest;
  readonly semanticProfileId: ModuleSemanticProfileId;
  readonly analysisProfileId: ExecutionAnalysisProfileId;
  readonly normalizedSyntaxDigest: Sha256Digest;
  readonly operationKind: ExecutionOperationKind;
  readonly preorderOrdinal: number;
}

interface GeneratedExecutionTemplateNodePreimage {
  readonly schema: "dathra.execution-template-node/1";
  readonly kind: "generated";
  readonly generatorSchemaId: string;
  readonly generatorProfileDigest: Sha256Digest;
  readonly inputs: readonly GeneratedTemplateInputBinding[];
  readonly rootDefinitionId: ExecutionRootDefinitionId | null;
  readonly observationContractId: Sha256Digest | null;
  readonly operationKind: ExecutionOperationKind;
  readonly ordinal: number;
}

type ExecutionTemplateNodePreimage =
  | SourceExecutionTemplateNodePreimage
  | GeneratedExecutionTemplateNodePreimage;

/** Static source or compiler-generated operation identity. */
type ExecutionTemplateNode = ExecutionIdentityRecord<
  ExecutionTemplateNodeId,
  ExecutionTemplateNodePreimage
>;

type SourceExecutionTemplateNodeInput = Omit<
  SourceExecutionTemplateNodePreimage,
  "schema" | "canonicalSourceUrl"
> & { readonly canonicalSourceUrl: string };

type GeneratedExecutionTemplateNodeInput = Omit<
  GeneratedExecutionTemplateNodePreimage,
  "schema"
>;

type ExecutionTemplateNodeInput =
  | SourceExecutionTemplateNodeInput
  | GeneratedExecutionTemplateNodeInput;

interface ExecutionGenerationDomainPreimage {
  readonly schema: "dathra.execution-generation-domain/1";
  readonly locationRequirementId: ExecutionLocationRequirementId;
  readonly targetEnvironmentId: string;
  readonly resolutionDomainId: ModuleResolutionDomainId | null;
  readonly generatorProfileDigest: Sha256Digest;
}

/** Symbolic generation binding for one generated execution node. */
type ExecutionGenerationDomain = ExecutionIdentityRecord<
  ExecutionGenerationDomainId,
  ExecutionGenerationDomainPreimage
>;

type ExecutionGenerationDomainInput = Omit<
  ExecutionGenerationDomainPreimage,
  "schema"
>;

type QualifiedExecutionBinding =
  | {
      readonly kind: "module";
      readonly runtimeBindingId: RuntimeModuleBindingId;
    }
  | {
      readonly kind: "generated";
      readonly generationDomainId: ExecutionGenerationDomainId;
    };

interface QualifiedExecutionNodePreimage {
  readonly schema: "dathra.qualified-execution-node/1";
  readonly templateNodeId: ExecutionTemplateNodeId;
  readonly locationRequirementId: ExecutionLocationRequirementId;
  readonly occurrenceTemplateId: StaticExecutionOccurrenceTemplateId;
  readonly semanticRole: ExecutionSemanticRole;
  readonly binding: QualifiedExecutionBinding;
}

/** Static graph vertex qualified by symbolic location and binding. */
type QualifiedExecutionNode = ExecutionIdentityRecord<
  QualifiedExecutionNodeId,
  QualifiedExecutionNodePreimage
>;

type QualifiedExecutionNodeInput = Omit<
  QualifiedExecutionNodePreimage,
  "schema"
>;

type ExecutionEdgeKind =
  | "may-execute"
  | "may-materialize"
  | "data"
  | "control"
  | "call"
  | "possible-call"
  | "reads-from"
  | "writes-to"
  | "possible-subscription"
  | "untracked-data"
  | "invalidation"
  | "registration"
  | "materializes"
  | "obligates"
  | "scheduling"
  | "scheduler-sequence"
  | "settles"
  | "resumes"
  | "abrupt-to-handler"
  | "module-link"
  | "live-binding-read"
  | "live-binding-write"
  | "evaluate-before"
  | "possible-alias"
  | "identity"
  | "ownership"
  | "lifetime"
  | "cleanup"
  | "transfer"
  | "capability-use"
  | "authority-possession";

interface NonIdentityExecutionEdgePreimage {
  readonly schema: "dathra.execution-edge/1";
  readonly kind: Exclude<ExecutionEdgeKind, "identity">;
  readonly sourceNodeId: QualifiedExecutionNodeId;
  readonly targetNodeId: QualifiedExecutionNodeId;
}

interface IdentityExecutionEdgePreimage {
  readonly schema: "dathra.execution-edge/1";
  readonly kind: "identity";
  readonly sourceNodeId: QualifiedExecutionNodeId;
  readonly targetNodeId: QualifiedExecutionNodeId;
  readonly identitySlot: ExecutionOccurrenceIdentitySlot;
}

type ExecutionEdgePreimage =
  | NonIdentityExecutionEdgePreimage
  | IdentityExecutionEdgePreimage;

/** One typed static relation between qualified execution nodes. */
type ExecutionEdge = ExecutionIdentityRecord<
  ExecutionEdgeId,
  ExecutionEdgePreimage
>;

type NonIdentityExecutionEdgeInput = Omit<
  NonIdentityExecutionEdgePreimage,
  "schema"
> & {
  readonly identitySlot?: never;
};

type IdentityExecutionEdgeInput = Omit<IdentityExecutionEdgePreimage, "schema">;

type ExecutionEdgeInput =
  | NonIdentityExecutionEdgeInput
  | IdentityExecutionEdgeInput;

interface RegistrationSupportTemplatePreimage {
  readonly schema: "dathra.registration-support/1";
  readonly registrationNodeId: QualifiedExecutionNodeId;
  readonly registrationEdgeId: ExecutionEdgeId;
  readonly callbackNodeId: QualifiedExecutionNodeId;
  readonly contingentRootDefinitionId: ExecutionRootDefinitionId;
  readonly triggerConstraintId: Sha256Digest;
  readonly once: boolean;
  readonly abortable: boolean;
  readonly protocol: "dathra.registration-state/1";
}

/** Static evidence that a materialized registration can support a callback root. */
type RegistrationSupportTemplate = ExecutionIdentityRecord<
  RegistrationSupportTemplateId,
  RegistrationSupportTemplatePreimage
>;

type RegistrationSupportTemplateInput = Omit<
  RegistrationSupportTemplatePreimage,
  "schema"
>;

interface ReactiveSupportTemplatePreimage {
  readonly schema: "dathra.reactive-support/1";
  readonly collectorNodeId: QualifiedExecutionNodeId;
  readonly readNodeId: QualifiedExecutionNodeId;
  readonly dependencyNodeId: QualifiedExecutionNodeId;
  readonly bindingNodeId: QualifiedExecutionNodeId;
  readonly dataEdgeId: ExecutionEdgeId;
  readonly subscriptionEdgeId: ExecutionEdgeId;
  readonly invalidationEdgeIds: readonly ExecutionEdgeId[];
  readonly contingentRootDefinitionId: ExecutionRootDefinitionId;
  readonly triggerConstraintId: Sha256Digest;
}

/** Static evidence for one potential reactive updater root. */
type ReactiveSupportTemplate = ExecutionIdentityRecord<
  ReactiveSupportTemplateId,
  ReactiveSupportTemplatePreimage
>;

type ReactiveSupportTemplateInput = Omit<
  ReactiveSupportTemplatePreimage,
  "schema"
>;

type ExecutionRootEntryFactKind = "execute" | "materialize";

interface ExecutionRootObligationPreimage {
  readonly schema: "dathra.execution-root-obligation/1";
  readonly rootDefinitionId: ExecutionRootDefinitionId;
  readonly observationContractId: Sha256Digest;
  readonly targetNodeId: QualifiedExecutionNodeId;
  readonly entryFactKind: ExecutionRootEntryFactKind;
  readonly triggerConstraintIds: readonly Sha256Digest[];
  readonly ownerConstraintIds: readonly Sha256Digest[];
  readonly terminalConstraintId: Sha256Digest;
}

/** Exact binding from a primitive root to its contract and graph target. */
type ExecutionRootObligation = ExecutionIdentityRecord<
  ExecutionRootObligationId,
  ExecutionRootObligationPreimage
>;

type ExecutionRootObligationInput = Omit<
  ExecutionRootObligationPreimage,
  "schema"
>;

interface ExecutionGraphSnapshotPreimage {
  readonly schema: "dathra.execution-graph-snapshot/1";
  readonly moduleGraphSnapshotId: ModuleGraphSnapshotId;
  readonly observationContractIds: readonly Sha256Digest[];
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

/** Canonical immutable static execution graph. */
type ExecutionGraphSnapshot = ExecutionIdentityRecord<
  ExecutionGraphSnapshotId,
  ExecutionGraphSnapshotPreimage
>;

interface ExecutionGraphSnapshotInput {
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

/** Dependency records used to validate an execution graph snapshot. */
interface ExecutionGraphDependencies {
  readonly moduleGraph: ModuleGraphSnapshot;
  readonly observationContracts: readonly ObservationContract[];
}

interface IntraRootFact {
  readonly rootDefinitionId: ExecutionRootDefinitionId;
  readonly factKind: ExecutionRootEntryFactKind;
  readonly nodeId: QualifiedExecutionNodeId;
}

interface PotentialRootSupport {
  readonly parentRootDefinitionId: ExecutionRootDefinitionId;
  readonly contingentRootDefinitionId: ExecutionRootDefinitionId;
  readonly supportTemplateId:
    | RegistrationSupportTemplateId
    | ReactiveSupportTemplateId;
}

interface SeedReachability {
  readonly seedRootDefinitionId: ExecutionRootDefinitionId;
  readonly supportedRootDefinitionId: ExecutionRootDefinitionId;
}

interface ExecutionJustificationPath {
  readonly rootDefinitionId: ExecutionRootDefinitionId;
  readonly factKind: ExecutionRootEntryFactKind;
  readonly nodeId: QualifiedExecutionNodeId;
  readonly edgeIds: readonly ExecutionEdgeId[];
}

interface ExecutionSupportChain {
  readonly seedRootDefinitionId: ExecutionRootDefinitionId;
  readonly supportedRootDefinitionId: ExecutionRootDefinitionId;
  readonly supportTemplateIds: readonly (
    | RegistrationSupportTemplateId
    | ReactiveSupportTemplateId
  )[];
}

interface ExecutionGraphStronglyConnectedComponent {
  readonly id: QualifiedExecutionNodeId;
  readonly nodeIds: readonly QualifiedExecutionNodeId[];
}

interface ExecutionGraphCondensationEdge {
  readonly sourceComponentId: QualifiedExecutionNodeId;
  readonly targetComponentId: QualifiedExecutionNodeId;
}

/** Deterministic nonserialized topology and potential-root index. */
interface ExecutionGraphIndex {
  readonly derivationProfile: typeof EXECUTION_GRAPH_DERIVATION_PROFILE;
  readonly snapshot: ExecutionGraphSnapshot;
  readonly intraRootFacts: readonly IntraRootFact[];
  readonly potentialRootSupports: readonly PotentialRootSupport[];
  readonly seedReachability: readonly SeedReachability[];
  readonly stronglyConnectedComponents: readonly ExecutionGraphStronglyConnectedComponent[];
  readonly condensationEdges: readonly ExecutionGraphCondensationEdge[];
  readonly getTemplateNode: (
    id: ExecutionTemplateNodeId,
  ) => ExecutionTemplateNode | null;
  readonly getQualifiedNode: (
    id: QualifiedExecutionNodeId,
  ) => QualifiedExecutionNode | null;
  readonly getIncomingEdges: (
    id: QualifiedExecutionNodeId,
  ) => readonly ExecutionEdge[];
  readonly getOutgoingEdges: (
    id: QualifiedExecutionNodeId,
  ) => readonly ExecutionEdge[];
  readonly getOccurrenceTemplate: (
    id: QualifiedExecutionNodeId,
  ) => StaticExecutionOccurrenceTemplate | null;
  readonly getFactsForRoot: (
    id: ExecutionRootDefinitionId,
  ) => readonly IntraRootFact[];
  readonly getRootsForNode: (
    id: QualifiedExecutionNodeId,
  ) => readonly IntraRootFact[];
  readonly getJustificationPath: (
    rootId: ExecutionRootDefinitionId,
    factKind: ExecutionRootEntryFactKind,
    nodeId: QualifiedExecutionNodeId,
  ) => ExecutionJustificationPath | null;
  readonly getSupportChain: (
    seedRootId: ExecutionRootDefinitionId,
    supportedRootId: ExecutionRootDefinitionId,
  ) => ExecutionSupportChain | null;
  readonly getStronglyConnectedComponent: (
    nodeId: QualifiedExecutionNodeId,
  ) => ExecutionGraphStronglyConnectedComponent | null;
}

type ValidationPath = readonly ExecutionGraphPathSegment[];

type DataRecord = Record<string, unknown>;

const EXECUTION_GRAPH_DERIVATION_PROFILE =
  "dathra.execution-graph-derivation/1" as const;

const ROOT_ADMISSIONS = ["seed", "contingent"] as const;

const ROOT_KINDS = [
  "external-entry",
  "initial-ui",
  "artifact",
  "request-handler",
  "action",
  "lifecycle",
  "effect",
  "platform-obligation",
  "callback",
  "reactive-updater",
] as const;

const ROOT_PHASES = [
  "admission",
  "render",
  "build",
  "lifecycle",
  "effect",
  "event",
  "update",
] as const;

const OCCURRENCE_SLOTS = [
  "root-instance",
  "activation",
  "continuation",
  "registration",
  "allocation",
] as const;

const EPOCH_KINDS = [
  "module-instance",
  "request",
  "render-attempt",
  "activation",
  "event-task",
  "update-flush",
  "remote-invocation",
  "cleanup",
] as const;

const OPERATION_KINDS = [
  "module-instantiation",
  "module-evaluation",
  "module-binding-cell",
  "allocation",
  "heap-region",
  "property-read",
  "property-write",
  "state-read",
  "state-write",
  "compute",
  "call",
  "branch",
  "callback-registration",
  "callback-body",
  "await",
  "continuation",
  "return",
  "throw",
  "reject",
  "abort",
  "dom-create",
  "dom-reference",
  "dom-binding",
  "dom-mutation",
  "effect",
  "resource",
  "lifecycle",
  "stream-step",
  "transfer-demand",
  "protocol-operation",
  "artifact-contribution",
  "admission-adapter",
  "event-recorder",
  "catch-up-read",
  "capability-use",
  "authority-possession",
  "enforcement-boundary",
  "scheduler-enqueue",
  "scheduler-start",
  "scheduler-microtask-checkpoint",
  "scheduler-complete",
] as const;

const SEMANTIC_ROLES = [
  "module",
  "memory",
  "execution",
  "registration",
  "dom",
  "effect",
  "transfer",
  "protocol",
  "artifact",
  "admission",
  "recorder",
  "authority",
  "scheduler",
] as const;

const EDGE_KINDS = [
  "may-execute",
  "may-materialize",
  "data",
  "control",
  "call",
  "possible-call",
  "reads-from",
  "writes-to",
  "possible-subscription",
  "untracked-data",
  "invalidation",
  "registration",
  "materializes",
  "obligates",
  "scheduling",
  "scheduler-sequence",
  "settles",
  "resumes",
  "abrupt-to-handler",
  "module-link",
  "live-binding-read",
  "live-binding-write",
  "evaluate-before",
  "possible-alias",
  "identity",
  "ownership",
  "lifetime",
  "cleanup",
  "transfer",
  "capability-use",
  "authority-possession",
] as const;

const OPERATION_ROLE = {
  "module-instantiation": "module",
  "module-evaluation": "module",
  "module-binding-cell": "module",
  allocation: "memory",
  "heap-region": "memory",
  "property-read": "memory",
  "property-write": "memory",
  "state-read": "memory",
  "state-write": "memory",
  compute: "execution",
  call: "execution",
  branch: "execution",
  "callback-registration": "registration",
  "callback-body": "execution",
  await: "execution",
  continuation: "execution",
  return: "execution",
  throw: "execution",
  reject: "execution",
  abort: "execution",
  "dom-create": "dom",
  "dom-reference": "dom",
  "dom-binding": "dom",
  "dom-mutation": "dom",
  effect: "effect",
  resource: "effect",
  lifecycle: "effect",
  "stream-step": "effect",
  "transfer-demand": "transfer",
  "protocol-operation": "protocol",
  "artifact-contribution": "artifact",
  "admission-adapter": "admission",
  "event-recorder": "recorder",
  "catch-up-read": "recorder",
  "capability-use": "authority",
  "authority-possession": "authority",
  "enforcement-boundary": "authority",
  "scheduler-enqueue": "scheduler",
  "scheduler-start": "scheduler",
  "scheduler-microtask-checkpoint": "scheduler",
  "scheduler-complete": "scheduler",
} as const satisfies Record<ExecutionOperationKind, ExecutionSemanticRole>;

interface RootKindRule {
  readonly admission: ExecutionRootAdmission;
  readonly phase: ExecutionRootPhase;
  readonly entryFactKind: ExecutionRootEntryFactKind;
  readonly triggerKind: "event" | "effect" | "callback" | null;
}

const ROOT_KIND_RULE = {
  "external-entry": {
    admission: "seed",
    phase: "admission",
    entryFactKind: "execute",
    triggerKind: "event",
  },
  "initial-ui": {
    admission: "seed",
    phase: "render",
    entryFactKind: "execute",
    triggerKind: null,
  },
  artifact: {
    admission: "seed",
    phase: "build",
    entryFactKind: "materialize",
    triggerKind: null,
  },
  "request-handler": {
    admission: "seed",
    phase: "admission",
    entryFactKind: "execute",
    triggerKind: "event",
  },
  action: {
    admission: "seed",
    phase: "admission",
    entryFactKind: "execute",
    triggerKind: "event",
  },
  lifecycle: {
    admission: "seed",
    phase: "lifecycle",
    entryFactKind: "execute",
    triggerKind: "effect",
  },
  effect: {
    admission: "seed",
    phase: "effect",
    entryFactKind: "execute",
    triggerKind: "effect",
  },
  "platform-obligation": {
    admission: "seed",
    phase: "admission",
    entryFactKind: "execute",
    triggerKind: null,
  },
  callback: {
    admission: "contingent",
    phase: "event",
    entryFactKind: "execute",
    triggerKind: "callback",
  },
  "reactive-updater": {
    admission: "contingent",
    phase: "update",
    entryFactKind: "execute",
    triggerKind: "effect",
  },
} as const satisfies Record<ExecutionRootKind, RootKindRule>;

interface EdgeRoleRule {
  readonly source: readonly ExecutionSemanticRole[] | "any";
  readonly target: readonly ExecutionSemanticRole[] | "any";
}

const EDGE_ROLE_RULE = {
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
  "scheduler-sequence": { source: ["scheduler"], target: ["scheduler"] },
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
} as const satisfies Record<ExecutionEdgeKind, EdgeRoleRule>;

const REACTIVE_SUPPORT_OPERATION_RULE = {
  collector: ["compute", "effect"],
  read: ["state-read", "property-read", "catch-up-read"],
  dependency: ["heap-region", "module-binding-cell"],
  binding: ["dom-binding"],
} as const satisfies Record<string, readonly ExecutionOperationKind[]>;

const SCHEDULER_SEQUENCE_RULE = [
  "scheduler-enqueue:scheduler-start",
  "scheduler-start:scheduler-microtask-checkpoint",
  "scheduler-start:scheduler-complete",
  "scheduler-microtask-checkpoint:scheduler-microtask-checkpoint",
  "scheduler-microtask-checkpoint:scheduler-complete",
] as const;

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
  code: ExecutionGraphErrorCode,
  path: ValidationPath,
  detail: string,
): never {
  throw new ExecutionGraphError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

function deepFreeze(value: unknown): void {
  const pending = [value];
  const visited = new WeakSet<object>();
  while (pending.length > 0) {
    const current = pending.pop();
    if (
      typeof current !== "object" ||
      current === null ||
      Object.isFrozen(current) ||
      visited.has(current)
    ) {
      continue;
    }
    visited.add(current);
    for (const descriptor of Object.values(
      Object.getOwnPropertyDescriptors(current),
    )) {
      if ("value" in descriptor) pending.push(descriptor.value);
    }
    Object.freeze(current);
  }
}

function isDataRecord(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function mapById<Value extends { readonly id: string }>(
  values: readonly Value[],
): ReadonlyMap<Value["id"], Value> {
  return new Map(values.map((value) => [value.id, value]));
}

function requireMapValue<Id, Value>(
  map: ReadonlyMap<Id, Value>,
  id: Id,
  path: ValidationPath,
  label: string,
): Value {
  const value = map.get(id);
  if (value === undefined) {
    fail("dangling-reference", path, `Unknown ${label}`);
  }
  return value;
}

export {
  EDGE_KINDS,
  EDGE_ROLE_RULE,
  EPOCH_KINDS,
  EXECUTION_GRAPH_DERIVATION_PROFILE,
  ExecutionGraphError,
  OCCURRENCE_SLOTS,
  OPERATION_KINDS,
  OPERATION_ROLE,
  REACTIVE_SUPPORT_OPERATION_RULE,
  ROOT_ADMISSIONS,
  ROOT_KINDS,
  ROOT_KIND_RULE,
  ROOT_PHASES,
  SCHEDULER_SEQUENCE_RULE,
  SEMANTIC_ROLES,
  deepFreeze,
  fail,
  isDataRecord,
  mapById,
  requireMapValue,
};
export type {
  DataRecord,
  EdgeRoleRule,
  ExecutionAnalysisProfile,
  ExecutionAnalysisProfileId,
  ExecutionAnalysisProfileInput,
  ExecutionAnalysisProfilePreimage,
  ExecutionEdge,
  ExecutionEdgeId,
  ExecutionEdgeInput,
  ExecutionEdgeKind,
  ExecutionEdgePreimage,
  ExecutionEpochKind,
  ExecutionGenerationDomain,
  ExecutionGenerationDomainId,
  ExecutionGenerationDomainInput,
  ExecutionGenerationDomainPreimage,
  ExecutionGraphCondensationEdge,
  ExecutionGraphDependencies,
  ExecutionGraphErrorCode,
  ExecutionGraphIndex,
  ExecutionGraphPathSegment,
  ExecutionGraphSnapshot,
  ExecutionGraphSnapshotId,
  ExecutionGraphSnapshotInput,
  ExecutionGraphSnapshotPreimage,
  ExecutionGraphStronglyConnectedComponent,
  ExecutionIdentityRecord,
  ExecutionJustificationPath,
  ExecutionLocationRequirement,
  ExecutionLocationRequirementId,
  ExecutionLocationRequirementInput,
  ExecutionLocationRequirementPreimage,
  ExecutionOccurrenceIdentitySlot,
  ExecutionOperationKind,
  ExecutionRootAdmission,
  ExecutionRootDefinition,
  ExecutionRootDefinitionId,
  ExecutionRootDefinitionInput,
  ExecutionRootDefinitionPreimage,
  ExecutionRootEntryFactKind,
  ExecutionRootKind,
  ExecutionRootObligation,
  ExecutionRootObligationId,
  ExecutionRootObligationInput,
  ExecutionRootObligationPreimage,
  ExecutionRootPhase,
  ExecutionSemanticRole,
  ExecutionSupportChain,
  ExecutionTemplateNode,
  ExecutionTemplateNodeId,
  ExecutionTemplateNodeInput,
  ExecutionTemplateNodePreimage,
  GeneratedExecutionTemplateNodeInput,
  GeneratedExecutionTemplateNodePreimage,
  GeneratedTemplateInputBinding,
  IntraRootFact,
  PotentialRootSupport,
  QualifiedExecutionBinding,
  QualifiedExecutionNode,
  QualifiedExecutionNodeId,
  QualifiedExecutionNodeInput,
  QualifiedExecutionNodePreimage,
  ReactiveSupportTemplate,
  ReactiveSupportTemplateId,
  ReactiveSupportTemplateInput,
  ReactiveSupportTemplatePreimage,
  RegistrationSupportTemplate,
  RegistrationSupportTemplateId,
  RegistrationSupportTemplateInput,
  RegistrationSupportTemplatePreimage,
  RootKindRule,
  SeedReachability,
  SourceExecutionTemplateNodeInput,
  SourceExecutionTemplateNodePreimage,
  StaticExecutionOccurrenceTemplate,
  StaticExecutionOccurrenceTemplateId,
  StaticExecutionOccurrenceTemplateInput,
  StaticExecutionOccurrenceTemplatePreimage,
  ValidationPath,
};
