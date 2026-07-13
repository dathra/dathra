import {
  CanonicalIdentityError,
  canonicalizeJson,
  createQualifiedId,
  digestCanonicalJson,
  isSha256Digest,
  type QualifiedId,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";

declare const registryIdBrand: unique symbol;

/** Canonical registry descriptor kinds. */
const REGISTRY_KINDS = [
  "codec",
  "resolver",
  "remote-operation",
  "remote-delivery-adapter",
  "subscription-source",
  "brand",
  "value-domain",
  "policy",
  "host-profile",
  "failure-schema",
] as const;

/** Canonical runtime execution environments. */
const RUNTIME_EXECUTION_ENVIRONMENTS = ["browser", "server-request"] as const;

/** Canonical execution registry implementation roles. */
const REGISTRY_IMPLEMENTATION_ROLES = [
  "codec-capture",
  "codec-materialize",
  "resolver-resolve",
  "subscription-open",
  "subscription-resume",
  "subscription-resync",
  "policy-evaluate",
  "value-domain-validate",
  "failure-schema-adapt",
  "host-profile-validate",
  "brand-validate",
  "remote-client-transport",
  "remote-client-receipt-verifier",
  "remote-server-endpoint",
  "remote-server-handler",
  "remote-server-delivery",
] as const;

/** Canonical list of all 25 legal registry role locations. */
const REGISTRY_ROLE_LOCATIONS = [
  { registryKind: "codec", environment: "browser", role: "codec-capture" },
  { registryKind: "codec", environment: "browser", role: "codec-materialize" },
  {
    registryKind: "codec",
    environment: "server-request",
    role: "codec-capture",
  },
  {
    registryKind: "codec",
    environment: "server-request",
    role: "codec-materialize",
  },
  {
    registryKind: "resolver",
    environment: "browser",
    role: "resolver-resolve",
  },
  {
    registryKind: "resolver",
    environment: "server-request",
    role: "resolver-resolve",
  },
  {
    registryKind: "subscription-source",
    environment: "browser",
    role: "subscription-open",
  },
  {
    registryKind: "subscription-source",
    environment: "browser",
    role: "subscription-resume",
  },
  {
    registryKind: "subscription-source",
    environment: "browser",
    role: "subscription-resync",
  },
  {
    registryKind: "subscription-source",
    environment: "server-request",
    role: "subscription-open",
  },
  {
    registryKind: "policy",
    environment: "browser",
    role: "policy-evaluate",
  },
  {
    registryKind: "policy",
    environment: "server-request",
    role: "policy-evaluate",
  },
  {
    registryKind: "value-domain",
    environment: "browser",
    role: "value-domain-validate",
  },
  {
    registryKind: "value-domain",
    environment: "server-request",
    role: "value-domain-validate",
  },
  {
    registryKind: "failure-schema",
    environment: "browser",
    role: "failure-schema-adapt",
  },
  {
    registryKind: "failure-schema",
    environment: "server-request",
    role: "failure-schema-adapt",
  },
  {
    registryKind: "host-profile",
    environment: "browser",
    role: "host-profile-validate",
  },
  {
    registryKind: "host-profile",
    environment: "server-request",
    role: "host-profile-validate",
  },
  {
    registryKind: "brand",
    environment: "browser",
    role: "brand-validate",
  },
  {
    registryKind: "brand",
    environment: "server-request",
    role: "brand-validate",
  },
  {
    registryKind: "remote-operation",
    environment: "browser",
    role: "remote-client-transport",
  },
  {
    registryKind: "remote-operation",
    environment: "browser",
    role: "remote-client-receipt-verifier",
  },
  {
    registryKind: "remote-operation",
    environment: "server-request",
    role: "remote-server-endpoint",
  },
  {
    registryKind: "remote-operation",
    environment: "server-request",
    role: "remote-server-handler",
  },
  {
    registryKind: "remote-delivery-adapter",
    environment: "server-request",
    role: "remote-server-delivery",
  },
] as const;

/** A closed execution registry descriptor kind. */
type RegistryKind = (typeof REGISTRY_KINDS)[number];

/** A runtime environment in which a registry role can execute. */
type RuntimeExecutionEnvironment =
  (typeof RUNTIME_EXECUTION_ENVIRONMENTS)[number];

/** Every environment that may appear in a source execution contract. */
type ExecutionEnvironment = "build" | RuntimeExecutionEnvironment;

/** A closed implementation role exposed by the execution registry. */
type RegistryImplementationRole =
  (typeof REGISTRY_IMPLEMENTATION_ROLES)[number];

/** A source-contract-local registry identifier. */
type RegistryId<Kind extends RegistryKind> = string & {
  readonly [registryIdBrand]: Kind;
};

/** A domain-separated registry identifier used after qualification. */
type QualifiedRegistryId<Kind extends RegistryKind> = Kind extends RegistryKind
  ? QualifiedId<`registry:${Kind}`>
  : never;

/** A local or qualified registry reference selected by the type parameter. */
type RegistryReference<
  Kind extends RegistryKind,
  Qualified extends boolean,
> = Qualified extends true ? QualifiedRegistryId<Kind> : RegistryId<Kind>;

/** One of the 25 legal kind, environment, and role tuples. */
type RegistryRoleLocation = (typeof REGISTRY_ROLE_LOCATIONS)[number];

/** Legal role locations for a specific registry kind. */
type RegistryRoleLocationFor<Kind extends RegistryKind> = Extract<
  RegistryRoleLocation,
  { readonly registryKind: Kind }
>;

/** Versioned interface schema for a concrete registry role. */
type RegistryRoleInterfaceSchemaId<Role extends RegistryImplementationRole> =
  `dathra.registry-role/${Role}/1`;

/** A module and export pair used before artifact finalization. */
interface ModuleExportLocator {
  readonly specifier: string;
  readonly exportName: string;
}

/** Fields common to every registry descriptor. */
interface RegistryDescriptorBase<
  Kind extends RegistryKind,
  Qualified extends boolean = false,
> {
  readonly schema: "dathra.registry/1";
  readonly kind: Kind;
  readonly id: RegistryReference<Kind, Qualified>;
  readonly version: string;
}

/** A segment in a codec graph-edge wire path. */
type CodecSlotWirePathSegment =
  | { readonly kind: "property"; readonly key: string }
  | { readonly kind: "array-index"; readonly index: number }
  | { readonly kind: "array-each" };

/** Metadata for one declarative graph edge in a codec wire value. */
interface CodecGraphEdgeSlotRecord {
  readonly name: string;
  readonly wirePath: readonly CodecSlotWirePathSegment[];
  readonly edgeKind: "graph-node" | "cell" | "reference" | "subscription";
  readonly cardinality: "one" | "optional" | "many";
}

/** A canonical table of graph-edge slots for a codec. */
interface CodecGraphEdgeSlotTable {
  readonly schema: "dathra.codec-edge-slots/1";
  readonly slots: readonly CodecGraphEdgeSlotRecord[];
}

/** Declarative metadata for a transfer codec. */
interface CodecRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"codec", Qualified> {
  readonly observationContractDigest: Sha256Digest;
  readonly wireSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly materializationTrust: "closed-declarative" | "host-attested";
  readonly graphEdgeSlots: CodecGraphEdgeSlotTable | null;
}

/** Declarative metadata for a reference resolver. */
interface ResolverRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"resolver", Qualified> {
  readonly locatorSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly exposurePolicyId: RegistryReference<"policy", Qualified>;
  readonly failureSchemaId: RegistryReference<"failure-schema", Qualified>;
}

/** Delivery semantics for a remote operation. */
type RemoteDeliveryContract<Qualified extends boolean = false> =
  | { readonly kind: "single-attempt" }
  | {
      readonly kind: "idempotent";
      readonly keyPolicyId: RegistryReference<"policy", Qualified>;
      readonly horizonMs: number;
    }
  | {
      readonly kind: "transactional";
      readonly ledgerPolicyId: RegistryReference<"policy", Qualified>;
      readonly horizonMs: number;
    };

/** Hard limits applied while processing a remote protocol. */
interface RemoteProtocolBudget {
  readonly maxRawFrameBytes: number;
  readonly maxCanonicalMessageBytes: number;
  readonly maxJsonDepth: number;
  readonly maxAuthorizationEvidenceBytes: number;
  readonly maxCapturedWireBytes: number;
  readonly maxResponsePayloadBytes: number;
  readonly maxMaterializedInputBytes: number;
  readonly maxMaterializedOutputBytes: number;
  readonly maxCodecWorkUnits: number;
  readonly maxConcurrentDecodes: number;
}

/** Declarative metadata for a remote operation. */
interface RemoteOperationRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"remote-operation", Qualified> {
  readonly inputValueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly outputValueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly applicationFailureSchemaId: RegistryReference<
    "failure-schema",
    Qualified
  >;
  readonly inputCodecId: RegistryReference<"codec", Qualified>;
  readonly outputCodecId: RegistryReference<"codec", Qualified>;
  readonly failureCodecId: RegistryReference<"codec", Qualified>;
  readonly authorizationPolicyId: RegistryReference<"policy", Qualified>;
  readonly deliveryPolicyId: RegistryReference<"policy", Qualified>;
  readonly deliveryAdapterId: RegistryReference<
    "remote-delivery-adapter",
    Qualified
  >;
  readonly transportProfileId: RegistryReference<"host-profile", Qualified>;
  readonly delivery: RemoteDeliveryContract<Qualified>;
  readonly protocolBudget: RemoteProtocolBudget;
  readonly systemFailureProtocol: "dathra.remote-system/1";
}

/** Hard limits applied to a remote delivery ledger. */
interface RemoteLedgerBudget {
  readonly maxInFlightOperations: number;
  readonly maxTerminalRecords: number;
  readonly maxTerminalBytes: number;
  readonly maxSequenceGap: number;
}

/** Declarative metadata for a remote delivery adapter. */
interface RemoteDeliveryAdapterRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"remote-delivery-adapter", Qualified> {
  readonly receiptSchema: "dathra.remote-commit-receipt/1";
  readonly nonCommitReceiptSchema: "dathra.remote-non-commit-receipt/1";
  readonly atomicity:
    | "none"
    | "fenced-idempotency"
    | "effect-ledger-result-atomic";
  readonly deliveryEnvironment: "server-request";
  readonly hostAttestationDigest: Sha256Digest;
  readonly ledgerBudget: RemoteLedgerBudget;
}

/** Sequence and retention semantics for a subscription source. */
interface SubscriptionSequenceContract {
  readonly schema: "dathra.subscription-sequence/1";
  readonly namespaceDomainId: string;
  readonly resyncNamespace: "preserve" | "rotate-with-new-snapshot";
  readonly maxOutstandingRevisions: number;
  readonly maxUnacknowledgedRevisions: number;
  readonly maxRetainedBytes: number;
  readonly maxSequenceGap: number;
  readonly cursorRetentionMs: number;
  readonly reconnectHorizonMs: number;
  readonly resyncHorizonMs: number;
  readonly terminalDeadlineMs: number;
  readonly overflow: "close-and-resync" | "fail-session";
  readonly disconnect: "retain-until-reconnect-horizon" | "close-immediately";
  readonly gc: "acknowledged-and-cursor-expired";
}

/** Declarative metadata for a subscription source. */
interface SubscriptionSourceRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"subscription-source", Qualified> {
  readonly locatorSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly revisionCodecId: RegistryReference<"codec", Qualified>;
  readonly failureSchemaId: RegistryReference<"failure-schema", Qualified>;
  readonly audiencePolicyId: RegistryReference<"policy", Qualified>;
  readonly capabilityPolicyId: RegistryReference<"policy", Qualified>;
  readonly authorizationPolicyId: RegistryReference<"policy", Qualified>;
  readonly namespaceAuthorityIssuerId: string;
  readonly namespaceAuthorityAttestationId: string;
  readonly sequenceContract: SubscriptionSequenceContract;
  readonly updateModes: readonly (
    | "replacement"
    | "stable-handle"
    | "journaled-in-place"
  )[];
}

/** Declarative metadata for a runtime brand. */
interface BrandRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"brand", Qualified> {
  readonly identityScope: "realm" | "module" | "instance";
}

/** Declarative metadata for a runtime value domain. */
interface ValueDomainRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"value-domain", Qualified> {
  readonly valueSchemaDigest: Sha256Digest;
}

/** A closed policy evaluator category. */
type PolicyKind =
  | "audience"
  | "sink"
  | "release"
  | "capability"
  | "authorization"
  | "endorsement"
  | "delivery";

/** Declarative metadata for a policy evaluator. */
interface PolicyRegistryDescriptor<
  Qualified extends boolean = false,
  Kind extends PolicyKind = PolicyKind,
> extends RegistryDescriptorBase<"policy", Qualified> {
  readonly policyKind: Kind;
  readonly ruleGraphDigest: Sha256Digest;
  readonly evaluation: "pure" | "host-authoritative-async";
}

/** Declarative metadata for a host profile. */
interface HostProfileRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"host-profile", Qualified> {
  readonly featureSetDigest: Sha256Digest;
}

/** Declarative metadata for a typed failure schema. */
interface FailureSchemaRegistryDescriptor<
  Qualified extends boolean = false,
> extends RegistryDescriptorBase<"failure-schema", Qualified> {
  readonly failureSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
}

/** The closed union of all execution registry descriptors. */
type RegistryDescriptor<Qualified extends boolean = false> =
  | CodecRegistryDescriptor<Qualified>
  | ResolverRegistryDescriptor<Qualified>
  | RemoteOperationRegistryDescriptor<Qualified>
  | RemoteDeliveryAdapterRegistryDescriptor<Qualified>
  | SubscriptionSourceRegistryDescriptor<Qualified>
  | BrandRegistryDescriptor<Qualified>
  | ValueDomainRegistryDescriptor<Qualified>
  | PolicyRegistryDescriptor<Qualified>
  | HostProfileRegistryDescriptor<Qualified>
  | FailureSchemaRegistryDescriptor<Qualified>;

/** A role requirement specialized to one legal location. */
type RegistryRoleRequirementForLocation<Location extends RegistryRoleLocation> =
  Location & {
    readonly requirement: "required" | "request-reachable";
    readonly reasonDefinitionIds: readonly string[];
  };

/** Activation metadata for one owner role. */
type RegistryRoleRequirement<Kind extends RegistryKind = RegistryKind> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryRoleRequirementForLocation<Location>
      : never
    : never;

/** A finalized implementation specialized to one legal location. */
type RegistryImplementationBindingForLocation<
  Location extends RegistryRoleLocation,
> = Location & {
  readonly artifactAddressId: string;
  readonly exportName: string;
  readonly interfaceSchemaId: RegistryRoleInterfaceSchemaId<Location["role"]>;
};

/** A finalized artifact binding for one owner role. */
type RegistryImplementationBinding<Kind extends RegistryKind = RegistryKind> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryImplementationBindingForLocation<Location>
      : never
    : never;

/** A symbolic implementation specialized to one legal location. */
type RegistrySymbolicImplementationBindingForLocation<
  Location extends RegistryRoleLocation,
> = Location & {
  readonly implementation: ModuleExportLocator;
  readonly interfaceSchemaId: RegistryRoleInterfaceSchemaId<Location["role"]>;
};

/** An artifact-independent module binding for one owner role. */
type RegistrySymbolicImplementationBinding<
  Kind extends RegistryKind = RegistryKind,
> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistrySymbolicImplementationBindingForLocation<Location>
      : never
    : never;

/** Legal targets for ordinary same-environment dependencies. */
type RegistryGenericDependencyTargetLocation = Exclude<
  RegistryRoleLocation,
  | { readonly registryKind: "remote-operation" }
  | { readonly registryKind: "remote-delivery-adapter" }
>;

/** A dependency target specialized to one legal location. */
type RegistryDependencyTargetForLocation<
  Location extends RegistryGenericDependencyTargetLocation,
> = {
  readonly targetQualifiedId: QualifiedRegistryId<Location["registryKind"]>;
  readonly targetEnvironment: Location["environment"];
  readonly targetRole: Location["role"];
};

/** Legal ordinary dependency targets in one runtime environment. */
type RegistryDependencyTargetForEnvironment<
  Environment extends RuntimeExecutionEnvironment,
> = RegistryGenericDependencyTargetLocation extends infer Location
  ? Location extends RegistryGenericDependencyTargetLocation
    ? Location["environment"] extends Environment
      ? RegistryDependencyTargetForLocation<Location>
      : never
    : never
  : never;

/** A source module export assigned to one legal registry role. */
type RegistrySourceImplementation<Kind extends RegistryKind> =
  RegistryRoleLocationFor<Kind> & {
    readonly implementation: ModuleExportLocator;
  };

/** One source-local registry declaration before qualification. */
interface RegistrySourceEntry<Kind extends RegistryKind> {
  readonly id: RegistryId<Kind>;
  readonly version: string;
  readonly descriptor: ModuleExportLocator;
  readonly implementations: readonly RegistrySourceImplementation<Kind>[];
}

/** An ordinary dependency specialized to one source location. */
type RegistryDependencyBindingForLocation<
  Location extends RegistryRoleLocation,
> = {
  readonly kind: "same-environment-import";
  readonly sourceEnvironment: Location["environment"];
  readonly sourceRole: Location["role"];
} & RegistryDependencyTargetForEnvironment<Location["environment"]>;

/** Ordinary same-environment dependencies for one source kind. */
type RegistryGenericDependencyBinding<SourceKind extends RegistryKind> =
  RegistryRoleLocationFor<SourceKind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryDependencyBindingForLocation<Location>
      : never
    : never;

/** The dedicated server endpoint to delivery adapter dependency. */
interface RemoteDeliveryDependencyBinding {
  readonly kind: "same-environment-import";
  readonly sourceEnvironment: "server-request";
  readonly sourceRole: "remote-server-endpoint";
  readonly targetQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly targetEnvironment: "server-request";
  readonly targetRole: "remote-server-delivery";
}

/** A same-environment implementation dependency. */
type RegistryDependencyBinding<SourceKind extends RegistryKind = RegistryKind> =
  | RegistryGenericDependencyBinding<SourceKind>
  | (SourceKind extends "remote-operation"
      ? RemoteDeliveryDependencyBinding
      : never);

/** Canonical preimage for a remote endpoint identity. */
interface RemoteEndpointIdentityPreimage {
  readonly schema: "dathra.remote-endpoint-identity/1";
  readonly serverDeploymentIdentityDigest: Sha256Digest;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
}

/** Public cross-environment binding for a remote request and response. */
interface RemoteRegistryProtocolBinding {
  readonly schema: "dathra.registry-protocol/1";
  readonly kind: "remote-request-response";
  readonly id: Sha256Digest;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly clientEnvironment: "browser";
  readonly clientTransportRole: "remote-client-transport";
  readonly clientVerifierRole: "remote-client-receipt-verifier";
  readonly clientDeploymentIdentityDigest: Sha256Digest;
  readonly serverEnvironment: "server-request";
  readonly serverEndpointRole: "remote-server-endpoint";
  readonly serverHandlerRole: "remote-server-handler";
  readonly serverDeploymentIdentityDigest: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly deliveryAdapterQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly deliveryEnvironment: "server-request";
  readonly deliveryRole: "remote-server-delivery";
  readonly deliveryDeploymentIdentityDigest: Sha256Digest;
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
  readonly requestSchemaDigest: Sha256Digest;
  readonly responseSchemaDigest: Sha256Digest;
  readonly protocolCodecMetadataDigest: Sha256Digest;
  readonly authorizationEvidenceVerifierMetadataDigest: Sha256Digest;
  readonly receiptVerifierMetadataDigest: Sha256Digest;
  readonly protocolBudgetDigest: Sha256Digest;
}

/** An artifact-independent remote protocol binding. */
interface RemoteRegistryProtocolTemplate {
  readonly schema: "dathra.registry-protocol-template/1";
  readonly kind: "remote-request-response";
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly clientEnvironment: "browser";
  readonly clientTransportRole: "remote-client-transport";
  readonly clientVerifierRole: "remote-client-receipt-verifier";
  readonly serverEnvironment: "server-request";
  readonly serverEndpointRole: "remote-server-endpoint";
  readonly serverHandlerRole: "remote-server-handler";
  readonly deliveryAdapterQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly deliveryEnvironment: "server-request";
  readonly deliveryRole: "remote-server-delivery";
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
  readonly requestSchemaDigest: Sha256Digest;
  readonly responseSchemaDigest: Sha256Digest;
  readonly protocolCodecMetadataDigest: Sha256Digest;
  readonly authorizationEvidenceVerifierMetadataDigest: Sha256Digest;
  readonly receiptVerifierMetadataDigest: Sha256Digest;
  readonly protocolBudgetDigest: Sha256Digest;
}

/** A protocol binding attached to an owner kind. */
type RegistryProtocolBinding = RemoteRegistryProtocolBinding;

/** Protocol bindings allowed for a specific registry kind. */
type RegistryProtocolBindingFor<Kind extends RegistryKind> =
  Kind extends "remote-operation" ? RemoteRegistryProtocolBinding : never;

/** One owner in the artifact-independent qualified universe. */
type QualifiedRegistryUniverseEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<
      RegistryDescriptor<true>,
      { readonly kind: Kind }
    >;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings: readonly RegistrySymbolicImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolTemplates: Kind extends "remote-operation"
      ? readonly RemoteRegistryProtocolTemplate[]
      : readonly [];
  };
}[RegistryKind];

/** The complete artifact-independent qualified registry universe. */
interface QualifiedRegistryUniverseRecord {
  readonly schema: "dathra.qualified-registry-universe/1";
  readonly registries: readonly QualifiedRegistryUniverseEntry[];
  readonly digest: Sha256Digest;
}

/** Input used to create a self-digested qualified universe. */
type QualifiedRegistryUniverseInput = Omit<
  QualifiedRegistryUniverseRecord,
  "digest"
>;

/** One owner in the globally finalized registry catalog. */
type FinalizedRegistryCatalogEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<
      RegistryDescriptor<true>,
      { readonly kind: Kind }
    >;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings: readonly RegistryImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolBindings: readonly RegistryProtocolBindingFor<Kind>[];
  };
}[RegistryKind];

/** The globally finalized registry catalog for one build candidate. */
interface FinalizedRegistryCatalogRecord {
  readonly schema: "dathra.finalized-registry-catalog/1";
  readonly symbolicUniverseDigest: Sha256Digest;
  readonly registries: readonly FinalizedRegistryCatalogEntry[];
  readonly digest: Sha256Digest;
}

/** Input used to create a self-digested finalized catalog. */
type FinalizedRegistryCatalogInput = Omit<
  FinalizedRegistryCatalogRecord,
  "digest"
>;

/** One owner in a runtime environment catalog. */
type RegistryEnvironmentCatalogEntry = FinalizedRegistryCatalogEntry;

/** The exact registry universe available in one runtime environment. */
interface RegistryEnvironmentCatalogRecord {
  readonly schema: "dathra.registry-environment-catalog/1";
  readonly environment: RuntimeExecutionEnvironment;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly registries: readonly RegistryEnvironmentCatalogEntry[];
  readonly digest: Sha256Digest;
}

/** The public protocol bindings shared by browser and server catalogs. */
interface RegistryProtocolCatalogRecord {
  readonly schema: "dathra.registry-protocol-catalog/1";
  readonly bindings: readonly RemoteRegistryProtocolBinding[];
  readonly digest: Sha256Digest;
}

/** A commitment binding the global, browser, server, and protocol catalogs. */
interface RegistryCatalogPairCommitment {
  readonly schema: "dathra.registry-catalog-pair/1";
  readonly globalFinalCatalogDigest: Sha256Digest;
  readonly browserCatalogDigest: Sha256Digest;
  readonly serverCatalogDigest: Sha256Digest;
  readonly protocolCatalogDigest: Sha256Digest;
  readonly digest: Sha256Digest;
}

/** Fields shared by all definition-owned projection seeds. */
interface RegistryProjectionSeedBase {
  readonly schema: "dathra.registry-projection-seed/1";
  readonly definitionId: string;
}

/** Legal non-protocol projection seed locations. */
type RegistryNonProtocolSeedLocation = Exclude<
  RegistryRoleLocation,
  | { readonly registryKind: "remote-operation" }
  | { readonly registryKind: "remote-delivery-adapter" }
>;

/** A non-protocol projection seed specialized to one legal location. */
type RegistryProjectionSeedForLocation<
  Location extends RegistryNonProtocolSeedLocation,
> = RegistryProjectionSeedBase & {
  readonly qualifiedId: QualifiedRegistryId<Location["registryKind"]>;
  readonly environment: Location["environment"];
  readonly role: Location["role"];
  readonly protocolBindingId: null;
};

/** The closed union of all non-protocol projection seeds. */
type RegistryNonProtocolProjectionSeed =
  RegistryNonProtocolSeedLocation extends infer Location
    ? Location extends RegistryNonProtocolSeedLocation
      ? RegistryProjectionSeedForLocation<Location>
      : never
    : never;

/** A remote operation seed bound to an explicit public protocol. */
type RegistryProtocolProjectionSeed = RegistryProjectionSeedBase &
  (
    | {
        readonly qualifiedId: QualifiedRegistryId<"remote-operation">;
        readonly environment: "browser";
        readonly role: "remote-client-transport";
        readonly protocolBindingId: Sha256Digest;
      }
    | {
        readonly qualifiedId: QualifiedRegistryId<"remote-operation">;
        readonly environment: "server-request";
        readonly role: "remote-server-endpoint";
        readonly protocolBindingId: Sha256Digest;
      }
  );

/** A definition-owned initial role for environment projection. */
type RegistryProjectionSeed =
  | RegistryNonProtocolProjectionSeed
  | RegistryProtocolProjectionSeed;

/** The projection inputs owned by one selected definition. */
interface RegistryProjectionDefinitionRecord {
  readonly definitionId: string;
  readonly registryProjectionSeeds: readonly RegistryProjectionSeed[];
}

/** One selected owner group in an environment projection. */
type RegistryEnvironmentProjectionEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly kind: Kind;
    readonly activeRoleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly selectedImplementationBindings: readonly RegistryImplementationBinding<Kind>[];
    readonly selectedDependencyBindings: readonly RegistryDependencyBinding<Kind>[];
  };
}[RegistryKind];

/** The exact owner-grouped role fixed point for one environment. */
interface RegistryEnvironmentProjectionRecord {
  readonly schema: "dathra.registry-environment-projection/2";
  readonly environment: RuntimeExecutionEnvironment;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly catalogDigest: Sha256Digest;
  readonly catalogPairCommitmentDigest: Sha256Digest;
  readonly seeds: readonly RegistryProjectionSeed[];
  readonly registries: readonly RegistryEnvironmentProjectionEntry[];
  readonly protocolBindingIds: readonly Sha256Digest[];
  readonly digest: Sha256Digest;
}

/** Stable path segment reported by execution registry validation. */
type ExecutionRegistryPathSegment = string | number;

/** Stable failure codes emitted by execution registry operations. */
type ExecutionRegistryErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-registry-id"
  | "invalid-role-location"
  | "noncanonical-order"
  | "duplicate-record"
  | "digest-mismatch"
  | "dangling-reference"
  | "kind-mismatch"
  | "environment-mismatch"
  | "missing-implementation"
  | "ambiguous-implementation"
  | "invalid-protocol"
  | "invalid-seed"
  | "projection-mismatch";

/** Describes why an execution registry value is invalid. */
class ExecutionRegistryError extends TypeError {
  readonly code: ExecutionRegistryErrorCode;
  readonly path: readonly ExecutionRegistryPathSegment[];

  /** Creates an immutable execution registry failure. */
  constructor(
    code: ExecutionRegistryErrorCode,
    path: readonly ExecutionRegistryPathSegment[],
    message: string,
  ) {
    super(message);
    this.name = "ExecutionRegistryError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

type DataRecord = Record<string, unknown>;
type ValidationPath = readonly ExecutionRegistryPathSegment[];

const registryKindSet = new Set<string>(REGISTRY_KINDS);
const runtimeEnvironmentSet = new Set<string>(RUNTIME_EXECUTION_ENVIRONMENTS);
const registryRoleSet = new Set<string>(REGISTRY_IMPLEMENTATION_ROLES);
const roleLocationSet = new Set<string>(
  REGISTRY_ROLE_LOCATIONS.map(
    ({ registryKind, environment, role }) =>
      `${registryKind}\u0000${environment}\u0000${role}`,
  ),
);

function formatPath(path: ValidationPath): string {
  if (path.length === 0) return "$";
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : `${result}[${JSON.stringify(segment)}]`,
    "$",
  );
}

function fail(
  code: ExecutionRegistryErrorCode,
  path: ValidationPath,
  detail: string,
): never {
  throw new ExecutionRegistryError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  for (const child of Object.values(value)) deepFreeze(child);
  Object.freeze(value);
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

function expectDataRecord(value: unknown, path: ValidationPath): DataRecord {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    fail("invalid-field", path, "Expected a record");
  }
  return value as DataRecord;
}

function expectRecord(
  value: unknown,
  path: ValidationPath,
  fields: readonly string[],
): DataRecord {
  const record = expectDataRecord(value, path);
  const expected = new Set(fields);
  for (const key of Object.keys(record)) {
    if (!expected.has(key)) {
      fail("invalid-field", [...path, key], "Unexpected field");
    }
  }
  for (const field of fields) {
    if (!Object.hasOwn(record, field)) {
      fail("invalid-field", [...path, field], "Missing field");
    }
  }
  return record;
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
  const text = expectString(value, path);
  if (text.length === 0)
    fail("invalid-field", path, "Expected a non-empty string");
  return text;
}

function expectLiteral<const Value extends string>(
  value: unknown,
  expected: Value,
  path: ValidationPath,
): Value {
  if (value !== expected) fail("invalid-field", path, `Expected ${expected}`);
  return expected;
}

function expectOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: ValidationPath,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    fail("invalid-field", path, "Unexpected enum value");
  }
  return value;
}

function expectDigest(value: unknown, path: ValidationPath): Sha256Digest {
  if (!isSha256Digest(value))
    fail("invalid-field", path, "Invalid SHA-256 digest");
  return value;
}

function expectPositiveSafeInteger(
  value: unknown,
  path: ValidationPath,
): number {
  if (!Number.isSafeInteger(value) || typeof value !== "number" || value <= 0) {
    fail("invalid-field", path, "Expected a positive safe integer");
  }
  return value;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function firstComparison(...comparisons: readonly number[]): number {
  for (const comparison of comparisons) {
    if (comparison !== 0) return comparison;
  }
  return 0;
}

const environmentRank: Readonly<Record<RuntimeExecutionEnvironment, number>> = {
  browser: 0,
  "server-request": 1,
};

function compareLocation(
  left: Pick<RegistryRoleLocation, "environment" | "role">,
  right: Pick<RegistryRoleLocation, "environment" | "role">,
): number {
  return firstComparison(
    environmentRank[left.environment] - environmentRank[right.environment],
    compareText(left.role, right.role),
  );
}

function compareCanonicalList<Item>(
  items: readonly Item[],
  compare: (left: Item, right: Item) => number,
  path: ValidationPath,
): void {
  for (let index = 1; index < items.length; index += 1) {
    const order = compare(items[index - 1], items[index]);
    if (order === 0) {
      fail("duplicate-record", [...path, index], "Duplicate canonical record");
    }
    if (order > 0) {
      fail("noncanonical-order", [...path, index], "Noncanonical list order");
    }
  }
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left).text === canonicalizeJson(right).text;
}

function withSelfField(
  record: Readonly<DataRecord>,
  field: string,
  value: string,
): DataRecord {
  const result: DataRecord = {};
  for (const key of Object.keys(record))
    result[key] = key === field ? value : record[key];
  return result;
}

async function selfDigest(
  record: Readonly<DataRecord>,
  field: string,
): Promise<Sha256Digest> {
  return await digestCanonicalJson(withSelfField(record, field, ""));
}

function isRegistryKind(value: unknown): value is RegistryKind {
  return typeof value === "string" && registryKindSet.has(value);
}

function isRuntimeEnvironment(
  value: unknown,
): value is RuntimeExecutionEnvironment {
  return typeof value === "string" && runtimeEnvironmentSet.has(value);
}

function isRegistryRole(value: unknown): value is RegistryImplementationRole {
  return typeof value === "string" && registryRoleSet.has(value);
}

/** Returns whether a kind, environment, and role form a legal tuple. */
function isRegistryRoleLocation(
  registryKind: unknown,
  environment: unknown,
  role: unknown,
): boolean {
  return (
    typeof registryKind === "string" &&
    typeof environment === "string" &&
    typeof role === "string" &&
    roleLocationSet.has(`${registryKind}\u0000${environment}\u0000${role}`)
  );
}

function assertRoleLocation(
  registryKind: unknown,
  environment: unknown,
  role: unknown,
  path: ValidationPath,
): asserts registryKind is RegistryKind {
  if (!isRegistryRoleLocation(registryKind, environment, role)) {
    fail("invalid-role-location", path, "Illegal registry role location");
  }
}

/** Creates a validated source-local registry identifier. */
function registryId<Kind extends RegistryKind>(
  kind: Kind,
  value: string,
): RegistryId<Kind> {
  if (!isRegistryKind(kind))
    fail("invalid-field", ["kind"], "Unknown registry kind");
  if (typeof value !== "string" || value.length === 0) {
    fail("invalid-registry-id", ["value"], "Registry ID must be non-empty");
  }
  try {
    canonicalizeJson(value);
  } catch (error) {
    if (error instanceof CanonicalIdentityError) {
      fail(
        "invalid-registry-id",
        ["value"],
        "Registry ID contains invalid Unicode",
      );
    }
    throw error;
  }
  return value as RegistryId<Kind>;
}

/** Creates a domain-separated qualified registry identifier. */
async function createQualifiedRegistryId<Kind extends RegistryKind>(
  namespaceId: Sha256Digest,
  kind: Kind,
  localId: RegistryId<Kind>,
): Promise<QualifiedRegistryId<Kind>> {
  if (!isRegistryKind(kind))
    fail("invalid-field", ["kind"], "Unknown registry kind");
  expectDigest(namespaceId, ["namespaceId"]);
  const checkedLocalId = registryId(kind, localId);
  return (await createQualifiedId({
    namespaceId,
    kind: `registry:${kind}` as const,
    localId: checkedLocalId,
  })) as QualifiedRegistryId<Kind>;
}

/** Returns the versioned interface schema for a registry role. */
function registryRoleInterfaceSchemaId<Role extends RegistryImplementationRole>(
  role: Role,
): RegistryRoleInterfaceSchemaId<Role> {
  if (!isRegistryRole(role)) {
    fail(
      "invalid-role-location",
      ["role"],
      "Unknown registry implementation role",
    );
  }
  return `dathra.registry-role/${role}/1`;
}

function expectRegistryReference<Kind extends RegistryKind>(
  value: unknown,
  qualified: boolean,
  path: ValidationPath,
): RegistryReference<Kind, boolean> {
  if (qualified) {
    return expectDigest(value, path) as RegistryReference<Kind, boolean>;
  }
  const id = expectNonEmptyString(value, path);
  return id as RegistryReference<Kind, boolean>;
}

const DESCRIPTOR_BASE_FIELDS = ["schema", "kind", "id", "version"] as const;

function descriptorFields(...fields: readonly string[]): readonly string[] {
  return [...DESCRIPTOR_BASE_FIELDS, ...fields];
}

function validateDescriptorBase(
  record: DataRecord,
  qualified: boolean,
  path: ValidationPath,
): RegistryKind {
  expectLiteral(record.schema, "dathra.registry/1", [...path, "schema"]);
  if (!isRegistryKind(record.kind)) {
    fail("invalid-field", [...path, "kind"], "Unknown registry kind");
  }
  expectRegistryReference(record.id, qualified, [...path, "id"]);
  expectNonEmptyString(record.version, [...path, "version"]);
  return record.kind;
}

function validateWirePathSegment(
  value: unknown,
  path: ValidationPath,
): CodecSlotWirePathSegment {
  const head = expectDataRecord(value, path);
  switch (head.kind) {
    case "property": {
      const record = expectRecord(value, path, ["kind", "key"]);
      expectString(record.key, [...path, "key"]);
      return record as unknown as CodecSlotWirePathSegment;
    }
    case "array-index": {
      const record = expectRecord(value, path, ["kind", "index"]);
      if (
        typeof record.index !== "number" ||
        !Number.isSafeInteger(record.index) ||
        record.index < 0 ||
        record.index > 0xffff_fffe
      ) {
        fail(
          "invalid-field",
          [...path, "index"],
          "Expected an ECMAScript array index",
        );
      }
      return record as unknown as CodecSlotWirePathSegment;
    }
    case "array-each":
      return expectRecord(value, path, [
        "kind",
      ]) as unknown as CodecSlotWirePathSegment;
    default:
      return fail(
        "invalid-field",
        [...path, "kind"],
        "Unknown wire path segment",
      );
  }
}

function validateCodecGraphEdgeSlots(
  value: unknown,
  path: ValidationPath,
): CodecGraphEdgeSlotTable | null {
  if (value === null) return null;
  const record = expectRecord(value, path, ["schema", "slots"]);
  expectLiteral(record.schema, "dathra.codec-edge-slots/1", [
    ...path,
    "schema",
  ]);
  const slotValues = expectArray(record.slots, [...path, "slots"]);
  const slots: CodecGraphEdgeSlotRecord[] = [];
  const wirePaths = new Set<string>();
  for (let index = 0; index < slotValues.length; index += 1) {
    const slotPath = [...path, "slots", index] as const;
    const slot = expectRecord(slotValues[index], slotPath, [
      "name",
      "wirePath",
      "edgeKind",
      "cardinality",
    ]);
    const name = expectNonEmptyString(slot.name, [...slotPath, "name"]);
    const cardinality = expectOneOf(
      slot.cardinality,
      ["one", "optional", "many"] as const,
      [...slotPath, "cardinality"],
    );
    expectOneOf(
      slot.edgeKind,
      ["graph-node", "cell", "reference", "subscription"] as const,
      [...slotPath, "edgeKind"],
    );
    const pathValues = expectArray(slot.wirePath, [...slotPath, "wirePath"]);
    let arrayEachCount = 0;
    for (let pathIndex = 0; pathIndex < pathValues.length; pathIndex += 1) {
      const segment = validateWirePathSegment(pathValues[pathIndex], [
        ...slotPath,
        "wirePath",
        pathIndex,
      ]);
      if (segment.kind === "array-each") arrayEachCount += 1;
    }
    if (
      arrayEachCount > 1 ||
      (arrayEachCount === 1 && cardinality !== "many")
    ) {
      fail(
        "invalid-field",
        [...slotPath, "wirePath"],
        "array-each requires many cardinality and may occur once",
      );
    }
    const wirePathKey = canonicalizeJson(slot.wirePath).text;
    if (wirePaths.has(wirePathKey)) {
      fail(
        "duplicate-record",
        [...slotPath, "wirePath"],
        "Duplicate codec wire path",
      );
    }
    wirePaths.add(wirePathKey);
    slots.push({
      name,
      wirePath: slot.wirePath,
      edgeKind: slot.edgeKind,
      cardinality,
    } as CodecGraphEdgeSlotRecord);
  }
  compareCanonicalList(
    slots,
    (left, right) => compareText(left.name, right.name),
    [...path, "slots"],
  );
  return record as unknown as CodecGraphEdgeSlotTable;
}

const REMOTE_PROTOCOL_BUDGET_FIELDS = [
  "maxRawFrameBytes",
  "maxCanonicalMessageBytes",
  "maxJsonDepth",
  "maxAuthorizationEvidenceBytes",
  "maxCapturedWireBytes",
  "maxResponsePayloadBytes",
  "maxMaterializedInputBytes",
  "maxMaterializedOutputBytes",
  "maxCodecWorkUnits",
  "maxConcurrentDecodes",
] as const;

function validatePositiveIntegerRecord(
  value: unknown,
  fields: readonly string[],
  path: ValidationPath,
): DataRecord {
  const record = expectRecord(value, path, fields);
  for (const field of fields) {
    expectPositiveSafeInteger(record[field], [...path, field]);
  }
  return record;
}

function validateRemoteDeliveryContract(
  value: unknown,
  qualified: boolean,
  path: ValidationPath,
): RemoteDeliveryContract<boolean> {
  const head = expectDataRecord(value, path);
  switch (head.kind) {
    case "single-attempt":
      return expectRecord(value, path, [
        "kind",
      ]) as RemoteDeliveryContract<boolean>;
    case "idempotent": {
      const record = expectRecord(value, path, [
        "kind",
        "keyPolicyId",
        "horizonMs",
      ]);
      expectRegistryReference(record.keyPolicyId, qualified, [
        ...path,
        "keyPolicyId",
      ]);
      expectPositiveSafeInteger(record.horizonMs, [...path, "horizonMs"]);
      return record as unknown as RemoteDeliveryContract<boolean>;
    }
    case "transactional": {
      const record = expectRecord(value, path, [
        "kind",
        "ledgerPolicyId",
        "horizonMs",
      ]);
      expectRegistryReference(record.ledgerPolicyId, qualified, [
        ...path,
        "ledgerPolicyId",
      ]);
      expectPositiveSafeInteger(record.horizonMs, [...path, "horizonMs"]);
      return record as unknown as RemoteDeliveryContract<boolean>;
    }
    default:
      return fail(
        "invalid-field",
        [...path, "kind"],
        "Unknown delivery contract",
      );
  }
}

const SUBSCRIPTION_SEQUENCE_FIELDS = [
  "schema",
  "namespaceDomainId",
  "resyncNamespace",
  "maxOutstandingRevisions",
  "maxUnacknowledgedRevisions",
  "maxRetainedBytes",
  "maxSequenceGap",
  "cursorRetentionMs",
  "reconnectHorizonMs",
  "resyncHorizonMs",
  "terminalDeadlineMs",
  "overflow",
  "disconnect",
  "gc",
] as const;

function validateSubscriptionSequence(
  value: unknown,
  path: ValidationPath,
): SubscriptionSequenceContract {
  const record = expectRecord(value, path, SUBSCRIPTION_SEQUENCE_FIELDS);
  expectLiteral(record.schema, "dathra.subscription-sequence/1", [
    ...path,
    "schema",
  ]);
  expectNonEmptyString(record.namespaceDomainId, [
    ...path,
    "namespaceDomainId",
  ]);
  expectOneOf(
    record.resyncNamespace,
    ["preserve", "rotate-with-new-snapshot"] as const,
    [...path, "resyncNamespace"],
  );
  for (const field of [
    "maxOutstandingRevisions",
    "maxUnacknowledgedRevisions",
    "maxRetainedBytes",
    "maxSequenceGap",
    "cursorRetentionMs",
    "reconnectHorizonMs",
    "resyncHorizonMs",
    "terminalDeadlineMs",
  ] as const) {
    expectPositiveSafeInteger(record[field], [...path, field]);
  }
  expectOneOf(record.overflow, ["close-and-resync", "fail-session"] as const, [
    ...path,
    "overflow",
  ]);
  expectOneOf(
    record.disconnect,
    ["retain-until-reconnect-horizon", "close-immediately"] as const,
    [...path, "disconnect"],
  );
  expectLiteral(record.gc, "acknowledged-and-cursor-expired", [...path, "gc"]);
  return record as unknown as SubscriptionSequenceContract;
}

const UPDATE_MODES = [
  "replacement",
  "stable-handle",
  "journaled-in-place",
] as const;

function validateUpdateModes(value: unknown, path: ValidationPath): void {
  const modes = expectArray(value, path);
  if (modes.length === 0)
    fail("invalid-field", path, "At least one update mode is required");
  let previousRank = -1;
  for (let index = 0; index < modes.length; index += 1) {
    const mode = expectOneOf(modes[index], UPDATE_MODES, [...path, index]);
    const rank = UPDATE_MODES.indexOf(mode);
    if (rank === previousRank) {
      fail("duplicate-record", [...path, index], "Duplicate update mode");
    }
    if (rank < previousRank) {
      fail(
        "noncanonical-order",
        [...path, index],
        "Noncanonical update mode order",
      );
    }
    previousRank = rank;
  }
}

function validateRegistryDescriptorSnapshot<Qualified extends boolean>(
  value: unknown,
  qualified: Qualified,
  path: ValidationPath = [],
): RegistryDescriptor<Qualified> {
  const head = expectDataRecord(value, path);
  if (!isRegistryKind(head.kind)) {
    fail("invalid-field", [...path, "kind"], "Unknown registry kind");
  }
  let record: DataRecord;
  switch (head.kind) {
    case "codec":
      record = expectRecord(
        value,
        path,
        descriptorFields(
          "observationContractDigest",
          "wireSchemaDigest",
          "valueDomainId",
          "materializationTrust",
          "graphEdgeSlots",
        ),
      );
      validateDescriptorBase(record, qualified, path);
      expectDigest(record.observationContractDigest, [
        ...path,
        "observationContractDigest",
      ]);
      expectDigest(record.wireSchemaDigest, [...path, "wireSchemaDigest"]);
      expectRegistryReference(record.valueDomainId, qualified, [
        ...path,
        "valueDomainId",
      ]);
      expectOneOf(
        record.materializationTrust,
        ["closed-declarative", "host-attested"] as const,
        [...path, "materializationTrust"],
      );
      validateCodecGraphEdgeSlots(record.graphEdgeSlots, [
        ...path,
        "graphEdgeSlots",
      ]);
      break;
    case "resolver":
      record = expectRecord(
        value,
        path,
        descriptorFields(
          "locatorSchemaDigest",
          "valueDomainId",
          "exposurePolicyId",
          "failureSchemaId",
        ),
      );
      validateDescriptorBase(record, qualified, path);
      expectDigest(record.locatorSchemaDigest, [
        ...path,
        "locatorSchemaDigest",
      ]);
      expectRegistryReference(record.valueDomainId, qualified, [
        ...path,
        "valueDomainId",
      ]);
      expectRegistryReference(record.exposurePolicyId, qualified, [
        ...path,
        "exposurePolicyId",
      ]);
      expectRegistryReference(record.failureSchemaId, qualified, [
        ...path,
        "failureSchemaId",
      ]);
      break;
    case "remote-operation":
      record = expectRecord(
        value,
        path,
        descriptorFields(
          "inputValueDomainId",
          "outputValueDomainId",
          "applicationFailureSchemaId",
          "inputCodecId",
          "outputCodecId",
          "failureCodecId",
          "authorizationPolicyId",
          "deliveryPolicyId",
          "deliveryAdapterId",
          "transportProfileId",
          "delivery",
          "protocolBudget",
          "systemFailureProtocol",
        ),
      );
      validateDescriptorBase(record, qualified, path);
      for (const field of [
        "inputValueDomainId",
        "outputValueDomainId",
      ] as const) {
        expectRegistryReference(record[field], qualified, [...path, field]);
      }
      expectRegistryReference(record.applicationFailureSchemaId, qualified, [
        ...path,
        "applicationFailureSchemaId",
      ]);
      for (const field of [
        "inputCodecId",
        "outputCodecId",
        "failureCodecId",
      ] as const) {
        expectRegistryReference(record[field], qualified, [...path, field]);
      }
      for (const field of [
        "authorizationPolicyId",
        "deliveryPolicyId",
      ] as const) {
        expectRegistryReference(record[field], qualified, [...path, field]);
      }
      expectRegistryReference(record.deliveryAdapterId, qualified, [
        ...path,
        "deliveryAdapterId",
      ]);
      expectRegistryReference(record.transportProfileId, qualified, [
        ...path,
        "transportProfileId",
      ]);
      validateRemoteDeliveryContract(record.delivery, qualified, [
        ...path,
        "delivery",
      ]);
      validatePositiveIntegerRecord(
        record.protocolBudget,
        REMOTE_PROTOCOL_BUDGET_FIELDS,
        [...path, "protocolBudget"],
      );
      expectLiteral(record.systemFailureProtocol, "dathra.remote-system/1", [
        ...path,
        "systemFailureProtocol",
      ]);
      break;
    case "remote-delivery-adapter":
      record = expectRecord(
        value,
        path,
        descriptorFields(
          "receiptSchema",
          "nonCommitReceiptSchema",
          "atomicity",
          "deliveryEnvironment",
          "hostAttestationDigest",
          "ledgerBudget",
        ),
      );
      validateDescriptorBase(record, qualified, path);
      expectLiteral(record.receiptSchema, "dathra.remote-commit-receipt/1", [
        ...path,
        "receiptSchema",
      ]);
      expectLiteral(
        record.nonCommitReceiptSchema,
        "dathra.remote-non-commit-receipt/1",
        [...path, "nonCommitReceiptSchema"],
      );
      expectOneOf(
        record.atomicity,
        ["none", "fenced-idempotency", "effect-ledger-result-atomic"] as const,
        [...path, "atomicity"],
      );
      expectLiteral(record.deliveryEnvironment, "server-request", [
        ...path,
        "deliveryEnvironment",
      ]);
      expectDigest(record.hostAttestationDigest, [
        ...path,
        "hostAttestationDigest",
      ]);
      validatePositiveIntegerRecord(
        record.ledgerBudget,
        [
          "maxInFlightOperations",
          "maxTerminalRecords",
          "maxTerminalBytes",
          "maxSequenceGap",
        ],
        [...path, "ledgerBudget"],
      );
      break;
    case "subscription-source":
      record = expectRecord(
        value,
        path,
        descriptorFields(
          "locatorSchemaDigest",
          "valueDomainId",
          "revisionCodecId",
          "failureSchemaId",
          "audiencePolicyId",
          "capabilityPolicyId",
          "authorizationPolicyId",
          "namespaceAuthorityIssuerId",
          "namespaceAuthorityAttestationId",
          "sequenceContract",
          "updateModes",
        ),
      );
      validateDescriptorBase(record, qualified, path);
      expectDigest(record.locatorSchemaDigest, [
        ...path,
        "locatorSchemaDigest",
      ]);
      expectRegistryReference(record.valueDomainId, qualified, [
        ...path,
        "valueDomainId",
      ]);
      expectRegistryReference(record.revisionCodecId, qualified, [
        ...path,
        "revisionCodecId",
      ]);
      expectRegistryReference(record.failureSchemaId, qualified, [
        ...path,
        "failureSchemaId",
      ]);
      for (const field of [
        "audiencePolicyId",
        "capabilityPolicyId",
        "authorizationPolicyId",
      ] as const) {
        expectRegistryReference(record[field], qualified, [...path, field]);
      }
      expectNonEmptyString(record.namespaceAuthorityIssuerId, [
        ...path,
        "namespaceAuthorityIssuerId",
      ]);
      expectNonEmptyString(record.namespaceAuthorityAttestationId, [
        ...path,
        "namespaceAuthorityAttestationId",
      ]);
      validateSubscriptionSequence(record.sequenceContract, [
        ...path,
        "sequenceContract",
      ]);
      validateUpdateModes(record.updateModes, [...path, "updateModes"]);
      break;
    case "brand":
      record = expectRecord(value, path, descriptorFields("identityScope"));
      validateDescriptorBase(record, qualified, path);
      expectOneOf(
        record.identityScope,
        ["realm", "module", "instance"] as const,
        [...path, "identityScope"],
      );
      break;
    case "value-domain":
      record = expectRecord(value, path, descriptorFields("valueSchemaDigest"));
      validateDescriptorBase(record, qualified, path);
      expectDigest(record.valueSchemaDigest, [...path, "valueSchemaDigest"]);
      break;
    case "policy":
      record = expectRecord(
        value,
        path,
        descriptorFields("policyKind", "ruleGraphDigest", "evaluation"),
      );
      validateDescriptorBase(record, qualified, path);
      expectOneOf(
        record.policyKind,
        [
          "audience",
          "sink",
          "release",
          "capability",
          "authorization",
          "endorsement",
          "delivery",
        ] as const,
        [...path, "policyKind"],
      );
      expectDigest(record.ruleGraphDigest, [...path, "ruleGraphDigest"]);
      expectOneOf(
        record.evaluation,
        ["pure", "host-authoritative-async"] as const,
        [...path, "evaluation"],
      );
      break;
    case "host-profile":
      record = expectRecord(value, path, descriptorFields("featureSetDigest"));
      validateDescriptorBase(record, qualified, path);
      expectDigest(record.featureSetDigest, [...path, "featureSetDigest"]);
      break;
    case "failure-schema":
      record = expectRecord(
        value,
        path,
        descriptorFields("failureSchemaDigest", "valueDomainId"),
      );
      validateDescriptorBase(record, qualified, path);
      expectDigest(record.failureSchemaDigest, [
        ...path,
        "failureSchemaDigest",
      ]);
      expectRegistryReference(record.valueDomainId, qualified, [
        ...path,
        "valueDomainId",
      ]);
      break;
  }
  return record as unknown as RegistryDescriptor<Qualified>;
}

/** Validates and snapshots a source-local registry descriptor. */
function defineRegistryDescriptor<Descriptor extends RegistryDescriptor<false>>(
  descriptor: Descriptor,
): Descriptor {
  const snapshot = snapshotClosed(descriptor);
  validateRegistryDescriptorSnapshot(snapshot, false);
  return snapshot as Descriptor;
}

/** Parses and snapshots a fully qualified registry descriptor. */
function parseQualifiedRegistryDescriptor(
  value: unknown,
): RegistryDescriptor<true> {
  const snapshot = snapshotClosed(value);
  return validateRegistryDescriptorSnapshot(snapshot, true);
}

/** Computes the canonical digest of a qualified registry descriptor. */
async function digestRegistryDescriptor(
  descriptor: RegistryDescriptor<true>,
): Promise<Sha256Digest> {
  const snapshot = parseQualifiedRegistryDescriptor(descriptor);
  return await digestCanonicalJson(snapshot);
}

const REMOTE_PROTOCOL_TEMPLATE_FIELDS = [
  "schema",
  "kind",
  "operationQualifiedId",
  "clientEnvironment",
  "clientTransportRole",
  "clientVerifierRole",
  "serverEnvironment",
  "serverEndpointRole",
  "serverHandlerRole",
  "deliveryAdapterQualifiedId",
  "deliveryEnvironment",
  "deliveryRole",
  "transportProfileQualifiedId",
  "requestSchemaDigest",
  "responseSchemaDigest",
  "protocolCodecMetadataDigest",
  "authorizationEvidenceVerifierMetadataDigest",
  "receiptVerifierMetadataDigest",
  "protocolBudgetDigest",
] as const;

const REMOTE_PROTOCOL_BINDING_FIELDS = [
  "schema",
  "kind",
  "id",
  "operationQualifiedId",
  "clientEnvironment",
  "clientTransportRole",
  "clientVerifierRole",
  "clientDeploymentIdentityDigest",
  "serverEnvironment",
  "serverEndpointRole",
  "serverHandlerRole",
  "serverDeploymentIdentityDigest",
  "endpointIdentity",
  "deliveryAdapterQualifiedId",
  "deliveryEnvironment",
  "deliveryRole",
  "deliveryDeploymentIdentityDigest",
  "transportProfileQualifiedId",
  "requestSchemaDigest",
  "responseSchemaDigest",
  "protocolCodecMetadataDigest",
  "authorizationEvidenceVerifierMetadataDigest",
  "receiptVerifierMetadataDigest",
  "protocolBudgetDigest",
] as const;

function validateRemoteProtocolCommon(
  record: DataRecord,
  path: ValidationPath,
  schema: "dathra.registry-protocol-template/1" | "dathra.registry-protocol/1",
): void {
  expectLiteral(record.schema, schema, [...path, "schema"]);
  expectLiteral(record.kind, "remote-request-response", [...path, "kind"]);
  expectDigest(record.operationQualifiedId, [...path, "operationQualifiedId"]);
  expectLiteral(record.clientEnvironment, "browser", [
    ...path,
    "clientEnvironment",
  ]);
  expectLiteral(record.clientTransportRole, "remote-client-transport", [
    ...path,
    "clientTransportRole",
  ]);
  expectLiteral(record.clientVerifierRole, "remote-client-receipt-verifier", [
    ...path,
    "clientVerifierRole",
  ]);
  expectLiteral(record.serverEnvironment, "server-request", [
    ...path,
    "serverEnvironment",
  ]);
  expectLiteral(record.serverEndpointRole, "remote-server-endpoint", [
    ...path,
    "serverEndpointRole",
  ]);
  expectLiteral(record.serverHandlerRole, "remote-server-handler", [
    ...path,
    "serverHandlerRole",
  ]);
  expectDigest(record.deliveryAdapterQualifiedId, [
    ...path,
    "deliveryAdapterQualifiedId",
  ]);
  expectLiteral(record.deliveryEnvironment, "server-request", [
    ...path,
    "deliveryEnvironment",
  ]);
  expectLiteral(record.deliveryRole, "remote-server-delivery", [
    ...path,
    "deliveryRole",
  ]);
  expectDigest(record.transportProfileQualifiedId, [
    ...path,
    "transportProfileQualifiedId",
  ]);
  for (const field of [
    "requestSchemaDigest",
    "responseSchemaDigest",
    "protocolCodecMetadataDigest",
    "authorizationEvidenceVerifierMetadataDigest",
    "receiptVerifierMetadataDigest",
    "protocolBudgetDigest",
  ] as const) {
    expectDigest(record[field], [...path, field]);
  }
}

function validateRemoteProtocolTemplateSnapshot(
  value: unknown,
  path: ValidationPath,
): RemoteRegistryProtocolTemplate {
  const record = expectRecord(value, path, REMOTE_PROTOCOL_TEMPLATE_FIELDS);
  validateRemoteProtocolCommon(
    record,
    path,
    "dathra.registry-protocol-template/1",
  );
  return record as unknown as RemoteRegistryProtocolTemplate;
}

async function validateRemoteProtocolBindingSnapshot(
  value: unknown,
  path: ValidationPath,
): Promise<RemoteRegistryProtocolBinding> {
  const record = expectRecord(value, path, REMOTE_PROTOCOL_BINDING_FIELDS);
  validateRemoteProtocolCommon(record, path, "dathra.registry-protocol/1");
  const id = expectDigest(record.id, [...path, "id"]);
  const clientDeploymentIdentityDigest = expectDigest(
    record.clientDeploymentIdentityDigest,
    [...path, "clientDeploymentIdentityDigest"],
  );
  const serverDeploymentIdentityDigest = expectDigest(
    record.serverDeploymentIdentityDigest,
    [...path, "serverDeploymentIdentityDigest"],
  );
  const deliveryDeploymentIdentityDigest = expectDigest(
    record.deliveryDeploymentIdentityDigest,
    [...path, "deliveryDeploymentIdentityDigest"],
  );
  if (deliveryDeploymentIdentityDigest !== serverDeploymentIdentityDigest) {
    fail(
      "environment-mismatch",
      [...path, "deliveryDeploymentIdentityDigest"],
      "Delivery and server deployments must match",
    );
  }
  const endpointIdentity = expectDigest(record.endpointIdentity, [
    ...path,
    "endpointIdentity",
  ]);
  const expectedEndpoint = await digestCanonicalJson({
    schema: "dathra.remote-endpoint-identity/1",
    serverDeploymentIdentityDigest,
    operationQualifiedId: record.operationQualifiedId,
    transportProfileQualifiedId: record.transportProfileQualifiedId,
  });
  if (endpointIdentity !== expectedEndpoint) {
    fail(
      "digest-mismatch",
      [...path, "endpointIdentity"],
      "Endpoint identity mismatch",
    );
  }
  const expectedId = await selfDigest(record, "id");
  if (id !== expectedId) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Protocol binding identity mismatch",
    );
  }
  expectDigest(clientDeploymentIdentityDigest, [
    ...path,
    "clientDeploymentIdentityDigest",
  ]);
  return record as unknown as RemoteRegistryProtocolBinding;
}

/** Finalizes an artifact-independent protocol template for two deployments. */
async function createRemoteRegistryProtocolBinding(
  template: RemoteRegistryProtocolTemplate,
  browserDeploymentIdentityDigest: Sha256Digest,
  serverDeploymentIdentityDigest: Sha256Digest,
): Promise<RemoteRegistryProtocolBinding> {
  const snapshot = snapshotClosed(template);
  const validated = validateRemoteProtocolTemplateSnapshot(snapshot, []);
  const browserDeployment = expectDigest(browserDeploymentIdentityDigest, [
    "browserDeploymentIdentityDigest",
  ]);
  const serverDeployment = expectDigest(serverDeploymentIdentityDigest, [
    "serverDeploymentIdentityDigest",
  ]);
  const endpointIdentity = await digestCanonicalJson({
    schema: "dathra.remote-endpoint-identity/1",
    serverDeploymentIdentityDigest: serverDeployment,
    operationQualifiedId: validated.operationQualifiedId,
    transportProfileQualifiedId: validated.transportProfileQualifiedId,
  } satisfies RemoteEndpointIdentityPreimage);
  const candidate: DataRecord = {
    schema: "dathra.registry-protocol/1",
    kind: validated.kind,
    id: "",
    operationQualifiedId: validated.operationQualifiedId,
    clientEnvironment: validated.clientEnvironment,
    clientTransportRole: validated.clientTransportRole,
    clientVerifierRole: validated.clientVerifierRole,
    clientDeploymentIdentityDigest: browserDeployment,
    serverEnvironment: validated.serverEnvironment,
    serverEndpointRole: validated.serverEndpointRole,
    serverHandlerRole: validated.serverHandlerRole,
    serverDeploymentIdentityDigest: serverDeployment,
    endpointIdentity,
    deliveryAdapterQualifiedId: validated.deliveryAdapterQualifiedId,
    deliveryEnvironment: validated.deliveryEnvironment,
    deliveryRole: validated.deliveryRole,
    deliveryDeploymentIdentityDigest: serverDeployment,
    transportProfileQualifiedId: validated.transportProfileQualifiedId,
    requestSchemaDigest: validated.requestSchemaDigest,
    responseSchemaDigest: validated.responseSchemaDigest,
    protocolCodecMetadataDigest: validated.protocolCodecMetadataDigest,
    authorizationEvidenceVerifierMetadataDigest:
      validated.authorizationEvidenceVerifierMetadataDigest,
    receiptVerifierMetadataDigest: validated.receiptVerifierMetadataDigest,
    protocolBudgetDigest: validated.protocolBudgetDigest,
  };
  candidate.id = await digestCanonicalJson(candidate);
  const result = snapshotClosed(candidate);
  return await validateRemoteProtocolBindingSnapshot(result, []);
}

/** Parses and verifies a finalized public remote protocol binding. */
async function parseRemoteRegistryProtocolBinding(
  value: unknown,
): Promise<RemoteRegistryProtocolBinding> {
  const snapshot = snapshotClosed(value);
  return await validateRemoteProtocolBindingSnapshot(snapshot, []);
}

function validateRequirementList(
  value: unknown,
  ownerKind: RegistryKind,
  path: ValidationPath,
): readonly RegistryRoleRequirement[] {
  const values = expectArray(value, path);
  const result: RegistryRoleRequirement[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const itemPath = [...path, index] as const;
    const record = expectRecord(values[index], itemPath, [
      "registryKind",
      "environment",
      "role",
      "requirement",
      "reasonDefinitionIds",
    ]);
    if (record.registryKind !== ownerKind) {
      fail(
        "kind-mismatch",
        [...itemPath, "registryKind"],
        "Requirement owner kind mismatch",
      );
    }
    assertRoleLocation(
      record.registryKind,
      record.environment,
      record.role,
      itemPath,
    );
    expectOneOf(
      record.requirement,
      ["required", "request-reachable"] as const,
      [...itemPath, "requirement"],
    );
    const reasonValues = expectArray(record.reasonDefinitionIds, [
      ...itemPath,
      "reasonDefinitionIds",
    ]);
    if (reasonValues.length === 0) {
      fail(
        "invalid-field",
        [...itemPath, "reasonDefinitionIds"],
        "Requirement reasons must be non-empty",
      );
    }
    const reasons = reasonValues.map((reason, reasonIndex) =>
      expectNonEmptyString(reason, [
        ...itemPath,
        "reasonDefinitionIds",
        reasonIndex,
      ]),
    );
    compareCanonicalList(reasons, compareText, [
      ...itemPath,
      "reasonDefinitionIds",
    ]);
    result.push(record as unknown as RegistryRoleRequirement);
  }
  compareCanonicalList(result, compareLocation, path);
  return result;
}

function validateModuleExportLocator(
  value: unknown,
  path: ValidationPath,
): ModuleExportLocator {
  const record = expectRecord(value, path, ["specifier", "exportName"]);
  expectNonEmptyString(record.specifier, [...path, "specifier"]);
  expectNonEmptyString(record.exportName, [...path, "exportName"]);
  return record as unknown as ModuleExportLocator;
}

function validateSymbolicImplementationList(
  value: unknown,
  ownerKind: RegistryKind,
  path: ValidationPath,
): readonly RegistrySymbolicImplementationBinding[] {
  const values = expectArray(value, path);
  const result: RegistrySymbolicImplementationBinding[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const itemPath = [...path, index] as const;
    const record = expectRecord(values[index], itemPath, [
      "registryKind",
      "environment",
      "role",
      "implementation",
      "interfaceSchemaId",
    ]);
    if (record.registryKind !== ownerKind) {
      fail(
        "kind-mismatch",
        [...itemPath, "registryKind"],
        "Implementation owner mismatch",
      );
    }
    assertRoleLocation(
      record.registryKind,
      record.environment,
      record.role,
      itemPath,
    );
    validateModuleExportLocator(record.implementation, [
      ...itemPath,
      "implementation",
    ]);
    const role = record.role;
    if (!isRegistryRole(role)) {
      fail(
        "invalid-role-location",
        [...itemPath, "role"],
        "Unknown implementation role",
      );
    }
    expectLiteral(
      record.interfaceSchemaId,
      registryRoleInterfaceSchemaId(role),
      [...itemPath, "interfaceSchemaId"],
    );
    result.push(record as unknown as RegistrySymbolicImplementationBinding);
  }
  compareCanonicalList(result, compareLocation, path);
  return result;
}

function validateFinalImplementationList(
  value: unknown,
  ownerKind: RegistryKind,
  path: ValidationPath,
): readonly RegistryImplementationBinding[] {
  const values = expectArray(value, path);
  const result: RegistryImplementationBinding[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const itemPath = [...path, index] as const;
    const record = expectRecord(values[index], itemPath, [
      "registryKind",
      "environment",
      "role",
      "artifactAddressId",
      "exportName",
      "interfaceSchemaId",
    ]);
    if (record.registryKind !== ownerKind) {
      fail(
        "kind-mismatch",
        [...itemPath, "registryKind"],
        "Implementation owner mismatch",
      );
    }
    assertRoleLocation(
      record.registryKind,
      record.environment,
      record.role,
      itemPath,
    );
    expectNonEmptyString(record.artifactAddressId, [
      ...itemPath,
      "artifactAddressId",
    ]);
    expectNonEmptyString(record.exportName, [...itemPath, "exportName"]);
    const role = record.role;
    if (!isRegistryRole(role)) {
      fail(
        "invalid-role-location",
        [...itemPath, "role"],
        "Unknown implementation role",
      );
    }
    expectLiteral(
      record.interfaceSchemaId,
      registryRoleInterfaceSchemaId(role),
      [...itemPath, "interfaceSchemaId"],
    );
    result.push(record as unknown as RegistryImplementationBinding);
  }
  compareCanonicalList(result, compareLocation, path);
  return result;
}

function compareDependency(
  left: RegistryDependencyBinding,
  right: RegistryDependencyBinding,
): number {
  return firstComparison(
    environmentRank[left.sourceEnvironment] -
      environmentRank[right.sourceEnvironment],
    compareText(left.sourceRole, right.sourceRole),
    compareText(left.targetQualifiedId, right.targetQualifiedId),
    environmentRank[left.targetEnvironment] -
      environmentRank[right.targetEnvironment],
    compareText(left.targetRole, right.targetRole),
  );
}

function validateDependencyList(
  value: unknown,
  ownerKind: RegistryKind,
  path: ValidationPath,
): readonly RegistryDependencyBinding[] {
  const values = expectArray(value, path);
  const result: RegistryDependencyBinding[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const itemPath = [...path, index] as const;
    const record = expectRecord(values[index], itemPath, [
      "kind",
      "sourceEnvironment",
      "sourceRole",
      "targetQualifiedId",
      "targetEnvironment",
      "targetRole",
    ]);
    expectLiteral(record.kind, "same-environment-import", [
      ...itemPath,
      "kind",
    ]);
    assertRoleLocation(ownerKind, record.sourceEnvironment, record.sourceRole, [
      ...itemPath,
      "sourceRole",
    ]);
    expectDigest(record.targetQualifiedId, [...itemPath, "targetQualifiedId"]);
    if (!isRuntimeEnvironment(record.targetEnvironment)) {
      fail(
        "invalid-field",
        [...itemPath, "targetEnvironment"],
        "Unknown target environment",
      );
    }
    if (!isRegistryRole(record.targetRole)) {
      fail(
        "invalid-role-location",
        [...itemPath, "targetRole"],
        "Unknown target role",
      );
    }
    if (record.sourceEnvironment !== record.targetEnvironment) {
      fail(
        "environment-mismatch",
        [...itemPath, "targetEnvironment"],
        "Registry dependencies must stay in one environment",
      );
    }
    result.push(record as unknown as RegistryDependencyBinding);
  }
  compareCanonicalList(result, compareDependency, path);
  return result;
}

function compareProtocolTemplate(
  left: RemoteRegistryProtocolTemplate,
  right: RemoteRegistryProtocolTemplate,
): number {
  return firstComparison(
    compareText(left.operationQualifiedId, right.operationQualifiedId),
    compareText(
      left.deliveryAdapterQualifiedId,
      right.deliveryAdapterQualifiedId,
    ),
    compareText(
      left.transportProfileQualifiedId,
      right.transportProfileQualifiedId,
    ),
    compareText(left.requestSchemaDigest, right.requestSchemaDigest),
    compareText(left.responseSchemaDigest, right.responseSchemaDigest),
    compareText(
      left.protocolCodecMetadataDigest,
      right.protocolCodecMetadataDigest,
    ),
    compareText(
      left.authorizationEvidenceVerifierMetadataDigest,
      right.authorizationEvidenceVerifierMetadataDigest,
    ),
    compareText(
      left.receiptVerifierMetadataDigest,
      right.receiptVerifierMetadataDigest,
    ),
    compareText(left.protocolBudgetDigest, right.protocolBudgetDigest),
  );
}

function validateProtocolTemplateList(
  value: unknown,
  ownerKind: RegistryKind,
  ownerId: string,
  path: ValidationPath,
): readonly RemoteRegistryProtocolTemplate[] {
  const values = expectArray(value, path);
  if (ownerKind !== "remote-operation" && values.length !== 0) {
    fail(
      "invalid-protocol",
      path,
      "Only remote operations may own protocol templates",
    );
  }
  const result = values.map((item, index) => {
    const template = validateRemoteProtocolTemplateSnapshot(item, [
      ...path,
      index,
    ]);
    if (template.operationQualifiedId !== ownerId) {
      fail(
        "kind-mismatch",
        [...path, index, "operationQualifiedId"],
        "Protocol template owner mismatch",
      );
    }
    return template;
  });
  compareCanonicalList(result, compareProtocolTemplate, path);
  return result;
}

async function validateProtocolBindingList(
  value: unknown,
  ownerKind: RegistryKind,
  ownerId: string,
  path: ValidationPath,
): Promise<readonly RemoteRegistryProtocolBinding[]> {
  const values = expectArray(value, path);
  if (ownerKind !== "remote-operation" && values.length !== 0) {
    fail(
      "invalid-protocol",
      path,
      "Only remote operations may own protocol bindings",
    );
  }
  const result: RemoteRegistryProtocolBinding[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const binding = await validateRemoteProtocolBindingSnapshot(values[index], [
      ...path,
      index,
    ]);
    if (binding.operationQualifiedId !== ownerId) {
      fail(
        "kind-mismatch",
        [...path, index, "operationQualifiedId"],
        "Protocol binding owner mismatch",
      );
    }
    result.push(binding);
  }
  compareCanonicalList(
    result,
    (left, right) => compareText(left.id, right.id),
    path,
  );
  return result;
}

type CatalogEntryMode = "symbolic" | "final";

interface ValidatedCatalogEntry {
  readonly value:
    | QualifiedRegistryUniverseEntry
    | FinalizedRegistryCatalogEntry;
  readonly kind: RegistryKind;
  readonly qualifiedId: string;
  readonly descriptor: RegistryDescriptor<true>;
  readonly requirements: readonly RegistryRoleRequirement[];
  readonly implementations: readonly (
    | RegistrySymbolicImplementationBinding
    | RegistryImplementationBinding
  )[];
  readonly dependencies: readonly RegistryDependencyBinding[];
  readonly protocolTemplates: readonly RemoteRegistryProtocolTemplate[];
  readonly protocolBindings: readonly RemoteRegistryProtocolBinding[];
}

interface RegistryReferenceRecord {
  readonly id: string;
  readonly kind: RegistryKind;
  readonly path: readonly string[];
}

function descriptorReferences(
  descriptor: RegistryDescriptor<true>,
): readonly RegistryReferenceRecord[] {
  switch (descriptor.kind) {
    case "codec":
      return [
        {
          id: descriptor.valueDomainId,
          kind: "value-domain",
          path: ["valueDomainId"],
        },
      ];
    case "resolver":
      return [
        {
          id: descriptor.valueDomainId,
          kind: "value-domain",
          path: ["valueDomainId"],
        },
        {
          id: descriptor.exposurePolicyId,
          kind: "policy",
          path: ["exposurePolicyId"],
        },
        {
          id: descriptor.failureSchemaId,
          kind: "failure-schema",
          path: ["failureSchemaId"],
        },
      ];
    case "remote-operation": {
      const references: RegistryReferenceRecord[] = [
        {
          id: descriptor.inputValueDomainId,
          kind: "value-domain",
          path: ["inputValueDomainId"],
        },
        {
          id: descriptor.outputValueDomainId,
          kind: "value-domain",
          path: ["outputValueDomainId"],
        },
        {
          id: descriptor.applicationFailureSchemaId,
          kind: "failure-schema",
          path: ["applicationFailureSchemaId"],
        },
        { id: descriptor.inputCodecId, kind: "codec", path: ["inputCodecId"] },
        {
          id: descriptor.outputCodecId,
          kind: "codec",
          path: ["outputCodecId"],
        },
        {
          id: descriptor.failureCodecId,
          kind: "codec",
          path: ["failureCodecId"],
        },
        {
          id: descriptor.authorizationPolicyId,
          kind: "policy",
          path: ["authorizationPolicyId"],
        },
        {
          id: descriptor.deliveryPolicyId,
          kind: "policy",
          path: ["deliveryPolicyId"],
        },
        {
          id: descriptor.deliveryAdapterId,
          kind: "remote-delivery-adapter",
          path: ["deliveryAdapterId"],
        },
        {
          id: descriptor.transportProfileId,
          kind: "host-profile",
          path: ["transportProfileId"],
        },
      ];
      if (descriptor.delivery.kind === "idempotent") {
        references.push({
          id: descriptor.delivery.keyPolicyId,
          kind: "policy",
          path: ["delivery", "keyPolicyId"],
        });
      } else if (descriptor.delivery.kind === "transactional") {
        references.push({
          id: descriptor.delivery.ledgerPolicyId,
          kind: "policy",
          path: ["delivery", "ledgerPolicyId"],
        });
      }
      return references;
    }
    case "subscription-source":
      return [
        {
          id: descriptor.valueDomainId,
          kind: "value-domain",
          path: ["valueDomainId"],
        },
        {
          id: descriptor.revisionCodecId,
          kind: "codec",
          path: ["revisionCodecId"],
        },
        {
          id: descriptor.failureSchemaId,
          kind: "failure-schema",
          path: ["failureSchemaId"],
        },
        {
          id: descriptor.audiencePolicyId,
          kind: "policy",
          path: ["audiencePolicyId"],
        },
        {
          id: descriptor.capabilityPolicyId,
          kind: "policy",
          path: ["capabilityPolicyId"],
        },
        {
          id: descriptor.authorizationPolicyId,
          kind: "policy",
          path: ["authorizationPolicyId"],
        },
      ];
    case "failure-schema":
      return [
        {
          id: descriptor.valueDomainId,
          kind: "value-domain",
          path: ["valueDomainId"],
        },
      ];
    case "remote-delivery-adapter":
    case "brand":
    case "value-domain":
    case "policy":
    case "host-profile":
      return [];
  }
}

function implementationKey(
  binding: Pick<RegistryRoleLocation, "environment" | "role">,
): string {
  return `${binding.environment}\u0000${binding.role}`;
}

function hasImplementation(
  entry: ValidatedCatalogEntry,
  environment: RuntimeExecutionEnvironment,
  role: RegistryImplementationRole,
): boolean {
  return entry.implementations.some(
    (binding) => binding.environment === environment && binding.role === role,
  );
}

async function validateCatalogEntry(
  value: unknown,
  mode: CatalogEntryMode,
  path: ValidationPath,
  environment?: RuntimeExecutionEnvironment,
): Promise<ValidatedCatalogEntry> {
  const protocolField =
    mode === "symbolic" ? "protocolTemplates" : "protocolBindings";
  const record = expectRecord(value, path, [
    "qualifiedId",
    "contractNamespaceId",
    "kind",
    "version",
    "descriptor",
    "descriptorDigest",
    "roleRequirements",
    "implementationBindings",
    "dependencyBindings",
    protocolField,
  ]);
  const qualifiedId = expectDigest(record.qualifiedId, [
    ...path,
    "qualifiedId",
  ]);
  expectDigest(record.contractNamespaceId, [...path, "contractNamespaceId"]);
  if (!isRegistryKind(record.kind)) {
    fail("invalid-field", [...path, "kind"], "Unknown registry kind");
  }
  const kind = record.kind;
  const version = expectNonEmptyString(record.version, [...path, "version"]);
  const descriptor = validateRegistryDescriptorSnapshot(
    record.descriptor,
    true,
    [...path, "descriptor"],
  );
  if (
    descriptor.kind !== kind ||
    descriptor.id !== qualifiedId ||
    descriptor.version !== version
  ) {
    fail(
      "kind-mismatch",
      path,
      "Catalog entry metadata does not match descriptor",
    );
  }
  const descriptorDigest = expectDigest(record.descriptorDigest, [
    ...path,
    "descriptorDigest",
  ]);
  const expectedDescriptorDigest = await digestCanonicalJson(descriptor);
  if (descriptorDigest !== expectedDescriptorDigest) {
    fail(
      "digest-mismatch",
      [...path, "descriptorDigest"],
      "Descriptor digest mismatch",
    );
  }
  const requirements = validateRequirementList(record.roleRequirements, kind, [
    ...path,
    "roleRequirements",
  ]);
  const implementations =
    mode === "symbolic"
      ? validateSymbolicImplementationList(
          record.implementationBindings,
          kind,
          [...path, "implementationBindings"],
        )
      : validateFinalImplementationList(record.implementationBindings, kind, [
          ...path,
          "implementationBindings",
        ]);
  const dependencies = validateDependencyList(record.dependencyBindings, kind, [
    ...path,
    "dependencyBindings",
  ]);
  if (environment !== undefined) {
    if (implementations.length === 0) {
      fail(
        "missing-implementation",
        [...path, "implementationBindings"],
        "Empty environment owner",
      );
    }
    for (const [field, bindings] of [
      ["roleRequirements", requirements],
      ["implementationBindings", implementations],
    ] as const) {
      for (let index = 0; index < bindings.length; index += 1) {
        if (bindings[index].environment !== environment) {
          fail(
            "environment-mismatch",
            [...path, field, index, "environment"],
            "Environment catalog contains a foreign role",
          );
        }
      }
    }
    for (let index = 0; index < dependencies.length; index += 1) {
      if (dependencies[index].sourceEnvironment !== environment) {
        fail(
          "environment-mismatch",
          [...path, "dependencyBindings", index, "sourceEnvironment"],
          "Environment catalog contains a foreign dependency",
        );
      }
    }
  }
  const implementationKeys = new Set(
    implementations.map((binding) => implementationKey(binding)),
  );
  for (let index = 0; index < requirements.length; index += 1) {
    const requirement = requirements[index];
    if (
      requirement.requirement === "required" &&
      !implementationKeys.has(implementationKey(requirement))
    ) {
      fail(
        "missing-implementation",
        [...path, "roleRequirements", index],
        "Required role has no implementation",
      );
    }
  }
  const protocolTemplates =
    mode === "symbolic"
      ? validateProtocolTemplateList(
          record.protocolTemplates,
          kind,
          qualifiedId,
          [...path, "protocolTemplates"],
        )
      : [];
  const protocolBindings =
    mode === "final"
      ? await validateProtocolBindingList(
          record.protocolBindings,
          kind,
          qualifiedId,
          [...path, "protocolBindings"],
        )
      : [];
  if (descriptor.kind === "remote-operation") {
    const expectedProtocolBudgetDigest = await digestCanonicalJson(
      descriptor.protocolBudget,
    );
    for (let index = 0; index < protocolTemplates.length; index += 1) {
      if (
        protocolTemplates[index].protocolBudgetDigest !==
        expectedProtocolBudgetDigest
      ) {
        fail(
          "digest-mismatch",
          [...path, "protocolTemplates", index, "protocolBudgetDigest"],
          "Protocol template budget differs from its descriptor",
        );
      }
    }
    for (let index = 0; index < protocolBindings.length; index += 1) {
      if (
        protocolBindings[index].protocolBudgetDigest !==
        expectedProtocolBudgetDigest
      ) {
        fail(
          "digest-mismatch",
          [...path, "protocolBindings", index, "protocolBudgetDigest"],
          "Protocol binding budget differs from its descriptor",
        );
      }
    }
  }
  return {
    value: record as unknown as
      | QualifiedRegistryUniverseEntry
      | FinalizedRegistryCatalogEntry,
    kind,
    qualifiedId,
    descriptor,
    requirements,
    implementations,
    dependencies,
    protocolTemplates,
    protocolBindings,
  };
}

function resolveEntry(
  entries: ReadonlyMap<string, ValidatedCatalogEntry>,
  id: string,
  expectedKind: RegistryKind,
  path: ValidationPath,
): ValidatedCatalogEntry {
  const entry = entries.get(id);
  if (entry === undefined) {
    fail("dangling-reference", path, "Registry reference does not resolve");
  }
  if (entry.kind !== expectedKind) {
    fail(
      "kind-mismatch",
      path,
      "Registry reference resolves to the wrong kind",
    );
  }
  return entry;
}

function validateCatalogClosure(
  entries: readonly ValidatedCatalogEntry[],
  path: ValidationPath,
  environment?: RuntimeExecutionEnvironment,
): void {
  const byId = new Map(entries.map((entry) => [entry.qualifiedId, entry]));
  for (let entryIndex = 0; entryIndex < entries.length; entryIndex += 1) {
    const entry = entries[entryIndex];
    const entryPath = [...path, entryIndex] as const;
    for (const reference of descriptorReferences(entry.descriptor)) {
      const target = byId.get(reference.id);
      if (target === undefined && environment !== undefined) continue;
      resolveEntry(byId, reference.id, reference.kind, [
        ...entryPath,
        "descriptor",
        ...reference.path,
      ]);
    }
    if (
      entry.descriptor.kind === "remote-operation" &&
      environment === undefined
    ) {
      const remoteDescriptor = entry.descriptor;
      const inputCodec = resolveEntry(
        byId,
        remoteDescriptor.inputCodecId,
        "codec",
        [...entryPath, "descriptor", "inputCodecId"],
      );
      const outputCodec = resolveEntry(
        byId,
        remoteDescriptor.outputCodecId,
        "codec",
        [...entryPath, "descriptor", "outputCodecId"],
      );
      const failureCodec = resolveEntry(
        byId,
        remoteDescriptor.failureCodecId,
        "codec",
        [...entryPath, "descriptor", "failureCodecId"],
      );
      const failureSchema = resolveEntry(
        byId,
        remoteDescriptor.applicationFailureSchemaId,
        "failure-schema",
        [...entryPath, "descriptor", "applicationFailureSchemaId"],
      );
      if (
        inputCodec.descriptor.kind !== "codec" ||
        inputCodec.descriptor.valueDomainId !==
          remoteDescriptor.inputValueDomainId
      ) {
        fail(
          "kind-mismatch",
          [...entryPath, "descriptor", "inputCodecId"],
          "Input codec value domain differs from the remote operation",
        );
      }
      if (
        outputCodec.descriptor.kind !== "codec" ||
        outputCodec.descriptor.valueDomainId !==
          remoteDescriptor.outputValueDomainId
      ) {
        fail(
          "kind-mismatch",
          [...entryPath, "descriptor", "outputCodecId"],
          "Output codec value domain differs from the remote operation",
        );
      }
      if (
        failureCodec.descriptor.kind !== "codec" ||
        failureSchema.descriptor.kind !== "failure-schema" ||
        failureCodec.descriptor.valueDomainId !==
          failureSchema.descriptor.valueDomainId
      ) {
        fail(
          "kind-mismatch",
          [...entryPath, "descriptor", "failureCodecId"],
          "Failure codec value domain differs from the application failure schema",
        );
      }
      const protocolCount =
        entry.protocolTemplates.length + entry.protocolBindings.length;
      if (protocolCount > 0) {
        const deliveryDependencies = entry.dependencies.filter(
          (dependency) =>
            dependency.sourceEnvironment === "server-request" &&
            dependency.sourceRole === "remote-server-endpoint" &&
            dependency.targetQualifiedId ===
              remoteDescriptor.deliveryAdapterId &&
            dependency.targetRole === "remote-server-delivery",
        );
        if (deliveryDependencies.length !== 1) {
          fail(
            deliveryDependencies.length === 0
              ? "missing-implementation"
              : "ambiguous-implementation",
            [...entryPath, "dependencyBindings"],
            "Remote delivery dependency must resolve exactly once",
          );
        }
        for (const [profileEnvironment, profileSourceRole] of [
          ["browser", "remote-client-transport"],
          ["server-request", "remote-server-endpoint"],
        ] as const) {
          const profileDependencies = entry.dependencies.filter(
            (dependency) =>
              dependency.sourceEnvironment === profileEnvironment &&
              dependency.sourceRole === profileSourceRole &&
              dependency.targetQualifiedId ===
                remoteDescriptor.transportProfileId &&
              dependency.targetEnvironment === profileEnvironment &&
              dependency.targetRole === "host-profile-validate",
          );
          if (profileDependencies.length !== 1) {
            fail(
              profileDependencies.length === 0
                ? "missing-implementation"
                : "ambiguous-implementation",
              [...entryPath, "dependencyBindings"],
              `Transport profile dependency for ${profileEnvironment} must resolve exactly once`,
            );
          }
        }
      }
    }
    for (let index = 0; index < entry.dependencies.length; index += 1) {
      const dependency = entry.dependencies[index];
      const dependencyPath = [
        ...entryPath,
        "dependencyBindings",
        index,
      ] as const;
      const target = byId.get(dependency.targetQualifiedId);
      if (target === undefined) {
        fail(
          "dangling-reference",
          [...dependencyPath, "targetQualifiedId"],
          "Dependency target does not resolve",
        );
      }
      if (
        !isRegistryRoleLocation(
          target.kind,
          dependency.targetEnvironment,
          dependency.targetRole,
        )
      ) {
        fail(
          "invalid-role-location",
          [...dependencyPath, "targetRole"],
          "Dependency target role is illegal for its owner",
        );
      }
      if (target.kind === "remote-operation") {
        fail(
          "invalid-role-location",
          [...dependencyPath, "targetQualifiedId"],
          "Remote operations cannot be generic dependency targets",
        );
      }
      if (target.kind === "remote-delivery-adapter") {
        if (
          entry.kind !== "remote-operation" ||
          dependency.sourceEnvironment !== "server-request" ||
          dependency.sourceRole !== "remote-server-endpoint" ||
          dependency.targetRole !== "remote-server-delivery"
        ) {
          fail(
            "invalid-role-location",
            dependencyPath,
            "Invalid remote delivery dependency",
          );
        }
        if (
          entry.descriptor.kind !== "remote-operation" ||
          entry.descriptor.deliveryAdapterId !== dependency.targetQualifiedId
        ) {
          fail(
            "kind-mismatch",
            [...dependencyPath, "targetQualifiedId"],
            "Delivery dependency differs from the operation descriptor",
          );
        }
      }
      if (
        !hasImplementation(
          entry,
          dependency.sourceEnvironment,
          dependency.sourceRole,
        )
      ) {
        fail(
          "missing-implementation",
          [...dependencyPath, "sourceRole"],
          "Dependency source implementation is missing",
        );
      }
      if (
        !hasImplementation(
          target,
          dependency.targetEnvironment,
          dependency.targetRole,
        )
      ) {
        fail(
          "missing-implementation",
          [...dependencyPath, "targetRole"],
          "Dependency target implementation is missing",
        );
      }
    }
    const protocols = [...entry.protocolTemplates, ...entry.protocolBindings];
    for (let index = 0; index < protocols.length; index += 1) {
      const protocol = protocols[index];
      const protocolField =
        entry.protocolTemplates.length > index
          ? "protocolTemplates"
          : "protocolBindings";
      const protocolPath = [...entryPath, protocolField, index] as const;
      const adapter = byId.get(protocol.deliveryAdapterQualifiedId);
      if (environment === undefined || environment === "server-request") {
        resolveEntry(
          byId,
          protocol.deliveryAdapterQualifiedId,
          "remote-delivery-adapter",
          [...protocolPath, "deliveryAdapterQualifiedId"],
        );
      }
      const profile = byId.get(protocol.transportProfileQualifiedId);
      if (profile !== undefined || environment === undefined) {
        resolveEntry(
          byId,
          protocol.transportProfileQualifiedId,
          "host-profile",
          [...protocolPath, "transportProfileQualifiedId"],
        );
      }
      if (
        entry.descriptor.kind !== "remote-operation" ||
        entry.descriptor.deliveryAdapterId !==
          protocol.deliveryAdapterQualifiedId ||
        entry.descriptor.transportProfileId !==
          protocol.transportProfileQualifiedId
      ) {
        fail(
          "kind-mismatch",
          protocolPath,
          "Protocol metadata differs from descriptor",
        );
      }
      for (const [roleEnvironment, role] of [
        ["browser", "remote-client-transport"],
        ["browser", "remote-client-receipt-verifier"],
        ["server-request", "remote-server-endpoint"],
        ["server-request", "remote-server-handler"],
      ] as const) {
        if (
          (environment === undefined || environment === roleEnvironment) &&
          !hasImplementation(entry, roleEnvironment, role)
        ) {
          fail(
            "missing-implementation",
            protocolPath,
            `Protocol role ${role} is missing`,
          );
        }
      }
      if (
        (environment === undefined || environment === "server-request") &&
        (adapter === undefined ||
          !hasImplementation(
            adapter,
            "server-request",
            "remote-server-delivery",
          ))
      ) {
        fail(
          "missing-implementation",
          protocolPath,
          "Remote delivery implementation is missing",
        );
      }
    }
  }
}

async function validateCatalogEntries(
  value: unknown,
  mode: CatalogEntryMode,
  path: ValidationPath,
  environment?: RuntimeExecutionEnvironment,
): Promise<readonly ValidatedCatalogEntry[]> {
  const values = expectArray(value, path);
  const entries: ValidatedCatalogEntry[] = [];
  for (let index = 0; index < values.length; index += 1) {
    entries.push(
      await validateCatalogEntry(
        values[index],
        mode,
        [...path, index],
        environment,
      ),
    );
  }
  compareCanonicalList(
    entries,
    (left, right) => compareText(left.qualifiedId, right.qualifiedId),
    path,
  );
  validateCatalogClosure(entries, path, environment);
  return entries;
}

async function validateSelfDigest(
  record: DataRecord,
  path: ValidationPath,
): Promise<void> {
  const digest = expectDigest(record.digest, [...path, "digest"]);
  const expected = await selfDigest(record, "digest");
  if (digest !== expected) {
    fail("digest-mismatch", [...path, "digest"], "Record self digest mismatch");
  }
}

/** Creates a validated, self-digested qualified registry universe. */
async function createQualifiedRegistryUniverseRecord(
  input: QualifiedRegistryUniverseInput,
): Promise<QualifiedRegistryUniverseRecord> {
  const snapshot = snapshotClosed(input);
  const record = expectRecord(snapshot, [], ["schema", "registries"]);
  expectLiteral(record.schema, "dathra.qualified-registry-universe/1", [
    "schema",
  ]);
  await validateCatalogEntries(record.registries, "symbolic", ["registries"]);
  const candidate: DataRecord = {
    schema: record.schema,
    registries: record.registries,
    digest: "",
  };
  candidate.digest = await digestCanonicalJson(candidate);
  return await parseQualifiedRegistryUniverseRecord(candidate);
}

/** Parses and verifies a qualified registry universe. */
async function parseQualifiedRegistryUniverseRecord(
  value: unknown,
): Promise<QualifiedRegistryUniverseRecord> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["schema", "registries", "digest"]);
  expectLiteral(record.schema, "dathra.qualified-registry-universe/1", [
    "schema",
  ]);
  await validateCatalogEntries(record.registries, "symbolic", ["registries"]);
  await validateSelfDigest(record, []);
  return record as unknown as QualifiedRegistryUniverseRecord;
}

/** Creates a validated, self-digested globally finalized registry catalog. */
async function createFinalizedRegistryCatalogRecord(
  input: FinalizedRegistryCatalogInput,
): Promise<FinalizedRegistryCatalogRecord> {
  const snapshot = snapshotClosed(input);
  const record = expectRecord(
    snapshot,
    [],
    ["schema", "symbolicUniverseDigest", "registries"],
  );
  expectLiteral(record.schema, "dathra.finalized-registry-catalog/1", [
    "schema",
  ]);
  expectDigest(record.symbolicUniverseDigest, ["symbolicUniverseDigest"]);
  await validateCatalogEntries(record.registries, "final", ["registries"]);
  const candidate: DataRecord = {
    schema: record.schema,
    symbolicUniverseDigest: record.symbolicUniverseDigest,
    registries: record.registries,
    digest: "",
  };
  candidate.digest = await digestCanonicalJson(candidate);
  return await parseFinalizedRegistryCatalogRecord(candidate);
}

/** Parses and verifies a globally finalized registry catalog. */
async function parseFinalizedRegistryCatalogRecord(
  value: unknown,
): Promise<FinalizedRegistryCatalogRecord> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(
    snapshot,
    [],
    ["schema", "symbolicUniverseDigest", "registries", "digest"],
  );
  expectLiteral(record.schema, "dathra.finalized-registry-catalog/1", [
    "schema",
  ]);
  expectDigest(record.symbolicUniverseDigest, ["symbolicUniverseDigest"]);
  await validateCatalogEntries(record.registries, "final", ["registries"]);
  await validateSelfDigest(record, []);
  return record as unknown as FinalizedRegistryCatalogRecord;
}

/** Derives the exact registry catalog available in one runtime environment. */
async function deriveRegistryEnvironmentCatalogRecord(
  catalog: FinalizedRegistryCatalogRecord,
  environment: RuntimeExecutionEnvironment,
  deploymentIdentityDigest: Sha256Digest,
): Promise<RegistryEnvironmentCatalogRecord> {
  const globalCatalog = await parseFinalizedRegistryCatalogRecord(catalog);
  if (!isRuntimeEnvironment(environment)) {
    fail("invalid-field", ["environment"], "Unknown runtime environment");
  }
  const deployment = expectDigest(deploymentIdentityDigest, [
    "deploymentIdentityDigest",
  ]);
  const registries: FinalizedRegistryCatalogEntry[] = [];
  for (const entry of globalCatalog.registries) {
    const implementations = entry.implementationBindings.filter(
      (binding) => binding.environment === environment,
    );
    if (implementations.length === 0) continue;
    registries.push({
      qualifiedId: entry.qualifiedId,
      contractNamespaceId: entry.contractNamespaceId,
      kind: entry.kind,
      version: entry.version,
      descriptor: entry.descriptor,
      descriptorDigest: entry.descriptorDigest,
      roleRequirements: entry.roleRequirements.filter(
        (requirement) => requirement.environment === environment,
      ),
      implementationBindings: implementations,
      dependencyBindings: entry.dependencyBindings.filter(
        (dependency) => dependency.sourceEnvironment === environment,
      ),
      protocolBindings: entry.protocolBindings,
    } as FinalizedRegistryCatalogEntry);
  }
  const candidate: DataRecord = {
    schema: "dathra.registry-environment-catalog/1",
    environment,
    deploymentIdentityDigest: deployment,
    registries,
    digest: "",
  };
  candidate.digest = await digestCanonicalJson(candidate);
  return await parseRegistryEnvironmentCatalogRecord(candidate);
}

/** Parses and verifies one runtime environment registry catalog. */
async function parseRegistryEnvironmentCatalogRecord(
  value: unknown,
): Promise<RegistryEnvironmentCatalogRecord> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(
    snapshot,
    [],
    [
      "schema",
      "environment",
      "deploymentIdentityDigest",
      "registries",
      "digest",
    ],
  );
  expectLiteral(record.schema, "dathra.registry-environment-catalog/1", [
    "schema",
  ]);
  if (!isRuntimeEnvironment(record.environment)) {
    fail("invalid-field", ["environment"], "Unknown runtime environment");
  }
  expectDigest(record.deploymentIdentityDigest, ["deploymentIdentityDigest"]);
  await validateCatalogEntries(
    record.registries,
    "final",
    ["registries"],
    record.environment,
  );
  await validateSelfDigest(record, []);
  return record as unknown as RegistryEnvironmentCatalogRecord;
}

/** Derives the canonical public protocol catalog from a global catalog. */
async function deriveRegistryProtocolCatalogRecord(
  catalog: FinalizedRegistryCatalogRecord,
): Promise<RegistryProtocolCatalogRecord> {
  const globalCatalog = await parseFinalizedRegistryCatalogRecord(catalog);
  const bindings = globalCatalog.registries
    .flatMap((entry) => entry.protocolBindings)
    .sort((left, right) => compareText(left.id, right.id));
  compareCanonicalList(
    bindings,
    (left, right) => compareText(left.id, right.id),
    ["bindings"],
  );
  const candidate: DataRecord = {
    schema: "dathra.registry-protocol-catalog/1",
    bindings,
    digest: "",
  };
  candidate.digest = await digestCanonicalJson(candidate);
  return await parseRegistryProtocolCatalogRecord(candidate);
}

/** Parses and verifies the public protocol catalog. */
async function parseRegistryProtocolCatalogRecord(
  value: unknown,
): Promise<RegistryProtocolCatalogRecord> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["schema", "bindings", "digest"]);
  expectLiteral(record.schema, "dathra.registry-protocol-catalog/1", [
    "schema",
  ]);
  const values = expectArray(record.bindings, ["bindings"]);
  const bindings: RemoteRegistryProtocolBinding[] = [];
  for (let index = 0; index < values.length; index += 1) {
    bindings.push(
      await validateRemoteProtocolBindingSnapshot(values[index], [
        "bindings",
        index,
      ]),
    );
  }
  compareCanonicalList(
    bindings,
    (left, right) => compareText(left.id, right.id),
    ["bindings"],
  );
  await validateSelfDigest(record, []);
  return record as unknown as RegistryProtocolCatalogRecord;
}

/** Parses and verifies a four-catalog commitment. */
async function parseRegistryCatalogPairCommitment(
  value: unknown,
): Promise<RegistryCatalogPairCommitment> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(
    snapshot,
    [],
    [
      "schema",
      "globalFinalCatalogDigest",
      "browserCatalogDigest",
      "serverCatalogDigest",
      "protocolCatalogDigest",
      "digest",
    ],
  );
  expectLiteral(record.schema, "dathra.registry-catalog-pair/1", ["schema"]);
  for (const field of [
    "globalFinalCatalogDigest",
    "browserCatalogDigest",
    "serverCatalogDigest",
    "protocolCatalogDigest",
  ] as const) {
    expectDigest(record[field], [field]);
  }
  await validateSelfDigest(record, []);
  return record as unknown as RegistryCatalogPairCommitment;
}

function catalogEntryById(
  catalog: RegistryEnvironmentCatalogRecord | FinalizedRegistryCatalogRecord,
  id: string,
): FinalizedRegistryCatalogEntry | undefined {
  return catalog.registries.find((entry) => entry.qualifiedId === id);
}

function requireCatalogRole(
  catalog: RegistryEnvironmentCatalogRecord,
  ownerId: string,
  kind: RegistryKind,
  role: RegistryImplementationRole,
  path: ValidationPath,
): FinalizedRegistryCatalogEntry {
  const entry = catalogEntryById(catalog, ownerId);
  if (entry === undefined) {
    fail(
      "dangling-reference",
      path,
      "Protocol owner is absent from environment catalog",
    );
  }
  if (entry.kind !== kind) {
    fail("kind-mismatch", path, "Protocol owner kind mismatch");
  }
  if (
    !entry.implementationBindings.some(
      (binding) =>
        binding.environment === catalog.environment && binding.role === role,
    )
  ) {
    fail("missing-implementation", path, `Protocol role ${role} is missing`);
  }
  return entry;
}

async function validateCatalogPairComponents(
  globalCatalog: FinalizedRegistryCatalogRecord,
  browserCatalog: RegistryEnvironmentCatalogRecord,
  serverCatalog: RegistryEnvironmentCatalogRecord,
  protocolCatalog: RegistryProtocolCatalogRecord,
): Promise<void> {
  if (
    browserCatalog.environment !== "browser" ||
    serverCatalog.environment !== "server-request"
  ) {
    fail("environment-mismatch", [], "Catalog pair environments are invalid");
  }
  const expectedBrowser = await deriveRegistryEnvironmentCatalogRecord(
    globalCatalog,
    "browser",
    browserCatalog.deploymentIdentityDigest,
  );
  const expectedServer = await deriveRegistryEnvironmentCatalogRecord(
    globalCatalog,
    "server-request",
    serverCatalog.deploymentIdentityDigest,
  );
  const expectedProtocols =
    await deriveRegistryProtocolCatalogRecord(globalCatalog);
  if (!canonicalEqual(browserCatalog, expectedBrowser)) {
    fail(
      "digest-mismatch",
      ["browserCatalog"],
      "Browser catalog is not an exact projection",
    );
  }
  if (!canonicalEqual(serverCatalog, expectedServer)) {
    fail(
      "digest-mismatch",
      ["serverCatalog"],
      "Server catalog is not an exact projection",
    );
  }
  if (!canonicalEqual(protocolCatalog, expectedProtocols)) {
    fail(
      "digest-mismatch",
      ["protocolCatalog"],
      "Protocol catalog is not exact",
    );
  }
  for (let index = 0; index < protocolCatalog.bindings.length; index += 1) {
    const protocol = protocolCatalog.bindings[index];
    const path = ["protocolCatalog", "bindings", index] as const;
    if (
      protocol.clientDeploymentIdentityDigest !==
      browserCatalog.deploymentIdentityDigest
    ) {
      fail(
        "environment-mismatch",
        [...path, "clientDeploymentIdentityDigest"],
        "Protocol client deployment mismatch",
      );
    }
    if (
      protocol.serverDeploymentIdentityDigest !==
        serverCatalog.deploymentIdentityDigest ||
      protocol.deliveryDeploymentIdentityDigest !==
        serverCatalog.deploymentIdentityDigest
    ) {
      fail(
        "environment-mismatch",
        [...path, "serverDeploymentIdentityDigest"],
        "Protocol server deployment mismatch",
      );
    }
    const browserOperation = requireCatalogRole(
      browserCatalog,
      protocol.operationQualifiedId,
      "remote-operation",
      protocol.clientTransportRole,
      path,
    );
    requireCatalogRole(
      browserCatalog,
      protocol.operationQualifiedId,
      "remote-operation",
      protocol.clientVerifierRole,
      path,
    );
    const serverOperation = requireCatalogRole(
      serverCatalog,
      protocol.operationQualifiedId,
      "remote-operation",
      protocol.serverEndpointRole,
      path,
    );
    requireCatalogRole(
      serverCatalog,
      protocol.operationQualifiedId,
      "remote-operation",
      protocol.serverHandlerRole,
      path,
    );
    requireCatalogRole(
      browserCatalog,
      protocol.transportProfileQualifiedId,
      "host-profile",
      "host-profile-validate",
      path,
    );
    requireCatalogRole(
      serverCatalog,
      protocol.transportProfileQualifiedId,
      "host-profile",
      "host-profile-validate",
      path,
    );
    requireCatalogRole(
      serverCatalog,
      protocol.deliveryAdapterQualifiedId,
      "remote-delivery-adapter",
      protocol.deliveryRole,
      path,
    );
    const deliveryDependencies = serverOperation.dependencyBindings.filter(
      (dependency) =>
        dependency.sourceRole === "remote-server-endpoint" &&
        dependency.targetQualifiedId === protocol.deliveryAdapterQualifiedId &&
        dependency.targetRole === "remote-server-delivery",
    );
    if (deliveryDependencies.length !== 1) {
      fail(
        deliveryDependencies.length === 0
          ? "missing-implementation"
          : "ambiguous-implementation",
        path,
        "Protocol delivery dependency must resolve exactly once",
      );
    }
    for (const [operation, profileEnvironment, profileSourceRole] of [
      [browserOperation, "browser", "remote-client-transport"],
      [serverOperation, "server-request", "remote-server-endpoint"],
    ] as const) {
      const profileDependencies = operation.dependencyBindings.filter(
        (dependency) =>
          dependency.sourceEnvironment === profileEnvironment &&
          dependency.sourceRole === profileSourceRole &&
          dependency.targetQualifiedId ===
            protocol.transportProfileQualifiedId &&
          dependency.targetEnvironment === profileEnvironment &&
          dependency.targetRole === "host-profile-validate",
      );
      if (profileDependencies.length !== 1) {
        fail(
          profileDependencies.length === 0
            ? "missing-implementation"
            : "ambiguous-implementation",
          path,
          `Protocol transport profile dependency for ${profileEnvironment} must resolve exactly once`,
        );
      }
    }
  }
}

/** Derives a commitment over the global, browser, server, and protocol catalogs. */
async function deriveRegistryCatalogPairCommitment(
  globalCatalog: FinalizedRegistryCatalogRecord,
  browserCatalog: RegistryEnvironmentCatalogRecord,
  serverCatalog: RegistryEnvironmentCatalogRecord,
  protocolCatalog: RegistryProtocolCatalogRecord,
): Promise<RegistryCatalogPairCommitment> {
  const globalSnapshot = snapshotClosed(globalCatalog);
  const browserSnapshot = snapshotClosed(browserCatalog);
  const serverSnapshot = snapshotClosed(serverCatalog);
  const protocolSnapshot = snapshotClosed(protocolCatalog);
  const global = await parseFinalizedRegistryCatalogRecord(globalSnapshot);
  const browser = await parseRegistryEnvironmentCatalogRecord(browserSnapshot);
  const server = await parseRegistryEnvironmentCatalogRecord(serverSnapshot);
  const protocols = await parseRegistryProtocolCatalogRecord(protocolSnapshot);
  await validateCatalogPairComponents(global, browser, server, protocols);
  const candidate: DataRecord = {
    schema: "dathra.registry-catalog-pair/1",
    globalFinalCatalogDigest: global.digest,
    browserCatalogDigest: browser.digest,
    serverCatalogDigest: server.digest,
    protocolCatalogDigest: protocols.digest,
    digest: "",
  };
  candidate.digest = await digestCanonicalJson(candidate);
  return await parseRegistryCatalogPairCommitment(candidate);
}

/** Validates an exact browser/server catalog pair and its commitment. */
async function validateRegistryCatalogPair(
  globalCatalog: FinalizedRegistryCatalogRecord,
  browserCatalog: RegistryEnvironmentCatalogRecord,
  serverCatalog: RegistryEnvironmentCatalogRecord,
  protocolCatalog: RegistryProtocolCatalogRecord,
  commitment: RegistryCatalogPairCommitment,
): Promise<void> {
  const globalSnapshot = snapshotClosed(globalCatalog);
  const browserSnapshot = snapshotClosed(browserCatalog);
  const serverSnapshot = snapshotClosed(serverCatalog);
  const protocolSnapshot = snapshotClosed(protocolCatalog);
  const commitmentSnapshot = snapshotClosed(commitment);
  const global = await parseFinalizedRegistryCatalogRecord(globalSnapshot);
  const browser = await parseRegistryEnvironmentCatalogRecord(browserSnapshot);
  const server = await parseRegistryEnvironmentCatalogRecord(serverSnapshot);
  const protocols = await parseRegistryProtocolCatalogRecord(protocolSnapshot);
  const pair = await parseRegistryCatalogPairCommitment(commitmentSnapshot);
  await validateCatalogPairComponents(global, browser, server, protocols);
  if (pair.globalFinalCatalogDigest !== global.digest) {
    fail(
      "digest-mismatch",
      ["globalFinalCatalogDigest"],
      "Global catalog commitment mismatch",
    );
  }
  if (pair.browserCatalogDigest !== browser.digest) {
    fail(
      "digest-mismatch",
      ["browserCatalogDigest"],
      "Browser catalog commitment mismatch",
    );
  }
  if (pair.serverCatalogDigest !== server.digest) {
    fail(
      "digest-mismatch",
      ["serverCatalogDigest"],
      "Server catalog commitment mismatch",
    );
  }
  if (pair.protocolCatalogDigest !== protocols.digest) {
    fail(
      "digest-mismatch",
      ["protocolCatalogDigest"],
      "Protocol catalog commitment mismatch",
    );
  }
}

function compareNullableDigest(
  left: Sha256Digest | null,
  right: Sha256Digest | null,
): number {
  if (left === right) return 0;
  if (left === null) return -1;
  if (right === null) return 1;
  return compareText(left, right);
}

function compareSeed(
  left: RegistryProjectionSeed,
  right: RegistryProjectionSeed,
  includeDefinition: boolean,
): number {
  return firstComparison(
    includeDefinition ? compareText(left.definitionId, right.definitionId) : 0,
    environmentRank[left.environment] - environmentRank[right.environment],
    compareText(left.qualifiedId, right.qualifiedId),
    compareText(left.role, right.role),
    compareNullableDigest(left.protocolBindingId, right.protocolBindingId),
  );
}

function validateProjectionSeedSnapshot(
  value: unknown,
  path: ValidationPath,
  expectedDefinitionId?: string,
): RegistryProjectionSeed {
  const record = expectRecord(value, path, [
    "schema",
    "definitionId",
    "qualifiedId",
    "environment",
    "role",
    "protocolBindingId",
  ]);
  expectLiteral(record.schema, "dathra.registry-projection-seed/1", [
    ...path,
    "schema",
  ]);
  const definitionId = expectNonEmptyString(record.definitionId, [
    ...path,
    "definitionId",
  ]);
  if (
    expectedDefinitionId !== undefined &&
    definitionId !== expectedDefinitionId
  ) {
    fail(
      "invalid-seed",
      [...path, "definitionId"],
      "Seed definition does not match its owner",
    );
  }
  expectDigest(record.qualifiedId, [...path, "qualifiedId"]);
  if (!isRuntimeEnvironment(record.environment)) {
    fail("invalid-seed", [...path, "environment"], "Unknown seed environment");
  }
  if (!isRegistryRole(record.role)) {
    fail("invalid-seed", [...path, "role"], "Unknown seed role");
  }
  if (record.protocolBindingId === null) {
    if (record.role.startsWith("remote-")) {
      fail(
        "invalid-seed",
        [...path, "role"],
        "Remote roles require an explicit protocol",
      );
    }
  } else {
    expectDigest(record.protocolBindingId, [...path, "protocolBindingId"]);
    const legalProtocolSeed =
      (record.environment === "browser" &&
        record.role === "remote-client-transport") ||
      (record.environment === "server-request" &&
        record.role === "remote-server-endpoint");
    if (!legalProtocolSeed) {
      fail("invalid-seed", path, "Illegal protocol projection seed");
    }
  }
  return record as unknown as RegistryProjectionSeed;
}

function validateProjectionDefinitions(
  value: unknown,
): readonly RegistryProjectionDefinitionRecord[] {
  const snapshot = snapshotClosed(value);
  const values = expectArray(snapshot, ["definitions"]);
  const definitions: RegistryProjectionDefinitionRecord[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const path = ["definitions", index] as const;
    const record = expectRecord(values[index], path, [
      "definitionId",
      "registryProjectionSeeds",
    ]);
    const definitionId = expectNonEmptyString(record.definitionId, [
      ...path,
      "definitionId",
    ]);
    const seedValues = expectArray(record.registryProjectionSeeds, [
      ...path,
      "registryProjectionSeeds",
    ]);
    const seeds = seedValues.map((seed, seedIndex) =>
      validateProjectionSeedSnapshot(
        seed,
        [...path, "registryProjectionSeeds", seedIndex],
        definitionId,
      ),
    );
    compareCanonicalList(
      seeds,
      (left, right) => compareSeed(left, right, false),
      [...path, "registryProjectionSeeds"],
    );
    const baseKeys = new Set<string>();
    for (let seedIndex = 0; seedIndex < seeds.length; seedIndex += 1) {
      const seed = seeds[seedIndex];
      const key = `${seed.environment}\u0000${seed.qualifiedId}\u0000${seed.role}`;
      if (baseKeys.has(key)) {
        fail(
          "duplicate-record",
          [...path, "registryProjectionSeeds", seedIndex],
          "A role seed cannot select multiple protocol bindings",
        );
      }
      baseKeys.add(key);
    }
    definitions.push({
      definitionId,
      registryProjectionSeeds: seeds,
    });
  }
  compareCanonicalList(
    definitions,
    (left, right) => compareText(left.definitionId, right.definitionId),
    ["definitions"],
  );
  return definitions;
}

function validateProtocolSeedPairing(
  definitions: readonly RegistryProjectionDefinitionRecord[],
  protocolCatalog: RegistryProtocolCatalogRecord,
): void {
  const protocolById = new Map(
    protocolCatalog.bindings.map((protocol) => [protocol.id, protocol]),
  );
  const selectedSides = new Map<
    Sha256Digest,
    { browser: boolean; server: boolean }
  >();
  for (
    let definitionIndex = 0;
    definitionIndex < definitions.length;
    definitionIndex += 1
  ) {
    const definition = definitions[definitionIndex];
    for (
      let seedIndex = 0;
      seedIndex < definition.registryProjectionSeeds.length;
      seedIndex += 1
    ) {
      const seed = definition.registryProjectionSeeds[seedIndex];
      if (seed.protocolBindingId === null) continue;
      const path = [
        "definitions",
        definitionIndex,
        "registryProjectionSeeds",
        seedIndex,
      ] as const;
      const protocol = protocolById.get(seed.protocolBindingId);
      if (protocol === undefined) {
        fail(
          "invalid-seed",
          [...path, "protocolBindingId"],
          "Protocol seed does not resolve",
        );
      }
      if (protocol.operationQualifiedId !== seed.qualifiedId) {
        fail(
          "invalid-seed",
          [...path, "qualifiedId"],
          "Protocol seed owner differs from its binding",
        );
      }
      const sides = selectedSides.get(protocol.id) ?? {
        browser: false,
        server: false,
      };
      if (seed.environment === "browser") sides.browser = true;
      else sides.server = true;
      selectedSides.set(protocol.id, sides);
    }
  }
  for (const [protocolId, sides] of selectedSides) {
    if (!sides.browser || !sides.server) {
      fail(
        "invalid-seed",
        ["definitions"],
        `Protocol ${protocolId} requires browser and server seeds`,
      );
    }
  }
}

interface ProjectionOwnerState {
  readonly entry: FinalizedRegistryCatalogEntry;
  readonly roles: Set<RegistryImplementationRole>;
  readonly activeRequirementKeys: Set<string>;
  readonly dependencyKeys: Set<string>;
}

function projectionOwner(
  states: Map<string, ProjectionOwnerState>,
  entries: ReadonlyMap<string, FinalizedRegistryCatalogEntry>,
  qualifiedId: string,
  path: ValidationPath,
): ProjectionOwnerState {
  const existing = states.get(qualifiedId);
  if (existing !== undefined) return existing;
  const entry = entries.get(qualifiedId);
  if (entry === undefined) {
    fail(
      "invalid-seed",
      path,
      "Projection owner is absent from the environment catalog",
    );
  }
  const state: ProjectionOwnerState = {
    entry,
    roles: new Set(),
    activeRequirementKeys: new Set(),
    dependencyKeys: new Set(),
  };
  states.set(qualifiedId, state);
  return state;
}

function selectProjectionRole(
  states: Map<string, ProjectionOwnerState>,
  entries: ReadonlyMap<string, FinalizedRegistryCatalogEntry>,
  qualifiedId: string,
  environment: RuntimeExecutionEnvironment,
  role: RegistryImplementationRole,
  path: ValidationPath,
): boolean {
  const state = projectionOwner(states, entries, qualifiedId, path);
  if (!isRegistryRoleLocation(state.entry.kind, environment, role)) {
    fail(
      "invalid-seed",
      path,
      "Role is illegal for the selected projection owner",
    );
  }
  const size = state.roles.size;
  state.roles.add(role);
  return state.roles.size !== size;
}

function dependencyKey(dependency: RegistryDependencyBinding): string {
  return `${dependency.sourceEnvironment}\u0000${dependency.sourceRole}\u0000${dependency.targetQualifiedId}\u0000${dependency.targetEnvironment}\u0000${dependency.targetRole}`;
}

function validateProjectionCatalogCommitment(
  catalog: RegistryEnvironmentCatalogRecord,
  protocolCatalog: RegistryProtocolCatalogRecord,
  commitment: RegistryCatalogPairCommitment,
): void {
  const catalogDigest =
    catalog.environment === "browser"
      ? commitment.browserCatalogDigest
      : commitment.serverCatalogDigest;
  if (catalogDigest !== catalog.digest) {
    fail(
      "digest-mismatch",
      ["commitment"],
      "Environment catalog is not committed",
    );
  }
  if (commitment.protocolCatalogDigest !== protocolCatalog.digest) {
    fail(
      "digest-mismatch",
      ["commitment"],
      "Protocol catalog is not committed",
    );
  }
}

/** Derives the exact least-fixed-point registry projection for one environment. */
async function deriveRegistryEnvironmentProjectionRecord(
  catalog: RegistryEnvironmentCatalogRecord,
  protocolCatalog: RegistryProtocolCatalogRecord,
  commitment: RegistryCatalogPairCommitment,
  definitions: readonly RegistryProjectionDefinitionRecord[],
): Promise<RegistryEnvironmentProjectionRecord> {
  const catalogSnapshot = snapshotClosed(catalog);
  const protocolSnapshot = snapshotClosed(protocolCatalog);
  const commitmentSnapshot = snapshotClosed(commitment);
  const definitionSnapshot = snapshotClosed(definitions);
  const environmentCatalog =
    await parseRegistryEnvironmentCatalogRecord(catalogSnapshot);
  const protocols = await parseRegistryProtocolCatalogRecord(protocolSnapshot);
  const pair = await parseRegistryCatalogPairCommitment(commitmentSnapshot);
  validateProjectionCatalogCommitment(environmentCatalog, protocols, pair);
  const selectedDefinitions = validateProjectionDefinitions(definitionSnapshot);
  validateProtocolSeedPairing(selectedDefinitions, protocols);
  const selectedDefinitionIds = new Set(
    selectedDefinitions.map(({ definitionId }) => definitionId),
  );
  const seeds = selectedDefinitions
    .flatMap(({ registryProjectionSeeds }) => registryProjectionSeeds)
    .filter((seed) => seed.environment === environmentCatalog.environment)
    .sort((left, right) => compareSeed(left, right, true));
  compareCanonicalList(seeds, (left, right) => compareSeed(left, right, true), [
    "seeds",
  ]);
  const entries = new Map(
    environmentCatalog.registries.map((entry) => [entry.qualifiedId, entry]),
  );
  const protocolById = new Map(
    protocols.bindings.map((protocol) => [protocol.id, protocol]),
  );
  const states = new Map<string, ProjectionOwnerState>();
  const selectedProtocolIds = new Set<Sha256Digest>();

  for (let index = 0; index < seeds.length; index += 1) {
    const seed = seeds[index];
    const path = ["seeds", index] as const;
    const entry = entries.get(seed.qualifiedId);
    if (entry === undefined) {
      fail(
        "invalid-seed",
        [...path, "qualifiedId"],
        "Seed owner is absent from catalog",
      );
    }
    if (!isRegistryRoleLocation(entry.kind, seed.environment, seed.role)) {
      fail(
        "invalid-seed",
        [...path, "role"],
        "Seed role does not match owner kind",
      );
    }
    if (seed.protocolBindingId === null) {
      if (
        entry.kind === "remote-operation" ||
        entry.kind === "remote-delivery-adapter"
      ) {
        fail("invalid-seed", path, "Remote owners require a protocol seed");
      }
      selectProjectionRole(
        states,
        entries,
        seed.qualifiedId,
        seed.environment,
        seed.role,
        path,
      );
      continue;
    }
    if (entry.kind !== "remote-operation") {
      fail(
        "invalid-seed",
        path,
        "Protocol seed owner must be a remote operation",
      );
    }
    const protocol = protocolById.get(seed.protocolBindingId);
    if (
      protocol === undefined ||
      protocol.operationQualifiedId !== seed.qualifiedId
    ) {
      fail(
        "invalid-seed",
        [...path, "protocolBindingId"],
        "Protocol seed does not resolve",
      );
    }
    const localProtocol = entry.protocolBindings.filter(
      (binding) => binding.id === protocol.id,
    );
    if (localProtocol.length !== 1) {
      fail(
        "invalid-seed",
        [...path, "protocolBindingId"],
        "Protocol is unavailable locally",
      );
    }
    if (
      (environmentCatalog.environment === "browser" &&
        protocol.clientDeploymentIdentityDigest !==
          environmentCatalog.deploymentIdentityDigest) ||
      (environmentCatalog.environment === "server-request" &&
        (protocol.serverDeploymentIdentityDigest !==
          environmentCatalog.deploymentIdentityDigest ||
          protocol.deliveryDeploymentIdentityDigest !==
            environmentCatalog.deploymentIdentityDigest))
    ) {
      fail(
        "environment-mismatch",
        [...path, "protocolBindingId"],
        "Protocol deployment differs from environment catalog",
      );
    }
    selectProjectionRole(
      states,
      entries,
      seed.qualifiedId,
      seed.environment,
      seed.role,
      path,
    );
    selectProjectionRole(
      states,
      entries,
      seed.qualifiedId,
      seed.environment,
      environmentCatalog.environment === "browser"
        ? protocol.clientVerifierRole
        : protocol.serverHandlerRole,
      path,
    );
    selectedProtocolIds.add(protocol.id);
  }

  let changed = true;
  while (changed) {
    changed = false;
    for (const state of states.values()) {
      for (const requirement of state.entry.roleRequirements) {
        const active =
          requirement.requirement === "required" ||
          requirement.reasonDefinitionIds.some((reason) =>
            selectedDefinitionIds.has(reason),
          );
        if (!active) continue;
        const key = implementationKey(requirement);
        const previousSize = state.activeRequirementKeys.size;
        state.activeRequirementKeys.add(key);
        if (state.activeRequirementKeys.size !== previousSize) changed = true;
        if (
          selectProjectionRole(
            states,
            entries,
            state.entry.qualifiedId,
            requirement.environment,
            requirement.role,
            ["registries", state.entry.qualifiedId, "roleRequirements"],
          )
        ) {
          changed = true;
        }
      }
      for (const role of state.roles) {
        const implementations = state.entry.implementationBindings.filter(
          (binding) =>
            binding.environment === environmentCatalog.environment &&
            binding.role === role,
        );
        if (implementations.length === 0) {
          fail(
            "missing-implementation",
            ["registries", state.entry.qualifiedId, "implementationBindings"],
            `Selected role ${role} has no implementation`,
          );
        }
        if (implementations.length > 1) {
          fail(
            "ambiguous-implementation",
            ["registries", state.entry.qualifiedId, "implementationBindings"],
            `Selected role ${role} has multiple implementations`,
          );
        }
        for (const dependency of state.entry.dependencyBindings) {
          if (
            dependency.sourceEnvironment !== environmentCatalog.environment ||
            dependency.sourceRole !== role
          ) {
            continue;
          }
          const key = dependencyKey(dependency);
          const previousSize = state.dependencyKeys.size;
          state.dependencyKeys.add(key);
          if (state.dependencyKeys.size !== previousSize) changed = true;
          if (
            selectProjectionRole(
              states,
              entries,
              dependency.targetQualifiedId,
              dependency.targetEnvironment,
              dependency.targetRole,
              ["registries", state.entry.qualifiedId, "dependencyBindings"],
            )
          ) {
            changed = true;
          }
        }
      }
    }
  }

  const projectionEntries: RegistryEnvironmentProjectionEntry[] = [];
  for (const state of [...states.values()].sort((left, right) =>
    compareText(left.entry.qualifiedId, right.entry.qualifiedId),
  )) {
    const activeRoleRequirements = state.entry.roleRequirements.filter(
      (requirement) =>
        state.activeRequirementKeys.has(implementationKey(requirement)),
    );
    const selectedImplementationBindings =
      state.entry.implementationBindings.filter((binding) =>
        state.roles.has(binding.role),
      );
    if (selectedImplementationBindings.length === 0) {
      fail(
        "missing-implementation",
        ["registries", state.entry.qualifiedId],
        "Selected owner has no implementation",
      );
    }
    const selectedDependencyBindings = state.entry.dependencyBindings.filter(
      (dependency) => state.dependencyKeys.has(dependencyKey(dependency)),
    );
    projectionEntries.push({
      qualifiedId: state.entry.qualifiedId,
      kind: state.entry.kind,
      activeRoleRequirements,
      selectedImplementationBindings,
      selectedDependencyBindings,
    } as RegistryEnvironmentProjectionEntry);
  }
  const protocolBindingIds = [...selectedProtocolIds].sort(compareText);
  const candidate: DataRecord = {
    schema: "dathra.registry-environment-projection/2",
    environment: environmentCatalog.environment,
    deploymentIdentityDigest: environmentCatalog.deploymentIdentityDigest,
    catalogDigest: environmentCatalog.digest,
    catalogPairCommitmentDigest: pair.digest,
    seeds,
    registries: projectionEntries,
    protocolBindingIds,
    digest: "",
  };
  candidate.digest = await digestCanonicalJson(candidate);
  return await parseRegistryEnvironmentProjectionRecord(candidate);
}

function validateProjectionEntries(
  value: unknown,
  environment: RuntimeExecutionEnvironment,
  path: ValidationPath,
): readonly RegistryEnvironmentProjectionEntry[] {
  const values = expectArray(value, path);
  const result: RegistryEnvironmentProjectionEntry[] = [];
  for (let index = 0; index < values.length; index += 1) {
    const entryPath = [...path, index] as const;
    const record = expectRecord(values[index], entryPath, [
      "qualifiedId",
      "kind",
      "activeRoleRequirements",
      "selectedImplementationBindings",
      "selectedDependencyBindings",
    ]);
    const qualifiedId = expectDigest(record.qualifiedId, [
      ...entryPath,
      "qualifiedId",
    ]);
    if (!isRegistryKind(record.kind)) {
      fail(
        "invalid-field",
        [...entryPath, "kind"],
        "Unknown projection owner kind",
      );
    }
    const kind = record.kind;
    const requirements = validateRequirementList(
      record.activeRoleRequirements,
      kind,
      [...entryPath, "activeRoleRequirements"],
    );
    const implementations = validateFinalImplementationList(
      record.selectedImplementationBindings,
      kind,
      [...entryPath, "selectedImplementationBindings"],
    );
    if (implementations.length === 0) {
      fail(
        "missing-implementation",
        [...entryPath, "selectedImplementationBindings"],
        "Projection owner must contain an implementation",
      );
    }
    const dependencies = validateDependencyList(
      record.selectedDependencyBindings,
      kind,
      [...entryPath, "selectedDependencyBindings"],
    );
    for (const [field, bindings] of [
      ["activeRoleRequirements", requirements],
      ["selectedImplementationBindings", implementations],
    ] as const) {
      for (
        let bindingIndex = 0;
        bindingIndex < bindings.length;
        bindingIndex += 1
      ) {
        if (bindings[bindingIndex].environment !== environment) {
          fail(
            "environment-mismatch",
            [...entryPath, field, bindingIndex, "environment"],
            "Projection contains a foreign role",
          );
        }
      }
    }
    for (
      let dependencyIndex = 0;
      dependencyIndex < dependencies.length;
      dependencyIndex += 1
    ) {
      if (dependencies[dependencyIndex].sourceEnvironment !== environment) {
        fail(
          "environment-mismatch",
          [
            ...entryPath,
            "selectedDependencyBindings",
            dependencyIndex,
            "sourceEnvironment",
          ],
          "Projection contains a foreign dependency",
        );
      }
    }
    result.push({
      qualifiedId,
      kind,
      activeRoleRequirements: requirements,
      selectedImplementationBindings: implementations,
      selectedDependencyBindings: dependencies,
    } as RegistryEnvironmentProjectionEntry);
  }
  compareCanonicalList(
    result,
    (left, right) => compareText(left.qualifiedId, right.qualifiedId),
    path,
  );
  const byId = new Map(result.map((entry) => [entry.qualifiedId, entry]));
  for (let entryIndex = 0; entryIndex < result.length; entryIndex += 1) {
    const entry = result[entryIndex];
    const implementationKeys = new Set(
      entry.selectedImplementationBindings.map((binding) =>
        implementationKey(binding),
      ),
    );
    for (
      let requirementIndex = 0;
      requirementIndex < entry.activeRoleRequirements.length;
      requirementIndex += 1
    ) {
      if (
        !implementationKeys.has(
          implementationKey(entry.activeRoleRequirements[requirementIndex]),
        )
      ) {
        fail(
          "missing-implementation",
          [...path, entryIndex, "activeRoleRequirements", requirementIndex],
          "Active requirement has no selected implementation",
        );
      }
    }
    for (
      let dependencyIndex = 0;
      dependencyIndex < entry.selectedDependencyBindings.length;
      dependencyIndex += 1
    ) {
      const dependency = entry.selectedDependencyBindings[dependencyIndex];
      if (
        !implementationKeys.has(
          `${dependency.sourceEnvironment}\u0000${dependency.sourceRole}`,
        )
      ) {
        fail(
          "missing-implementation",
          [...path, entryIndex, "selectedDependencyBindings", dependencyIndex],
          "Projection dependency source implementation is absent",
        );
      }
      const target = byId.get(dependency.targetQualifiedId);
      if (target === undefined) {
        fail(
          "dangling-reference",
          [...path, entryIndex, "selectedDependencyBindings", dependencyIndex],
          "Projection dependency target is absent",
        );
      }
      if (target.kind === "remote-operation") {
        fail(
          "invalid-role-location",
          [...path, entryIndex, "selectedDependencyBindings", dependencyIndex],
          "Remote operation cannot be a projection dependency target",
        );
      }
      if (
        target.kind === "remote-delivery-adapter" &&
        (entry.kind !== "remote-operation" ||
          dependency.sourceEnvironment !== "server-request" ||
          dependency.sourceRole !== "remote-server-endpoint" ||
          dependency.targetRole !== "remote-server-delivery")
      ) {
        fail(
          "invalid-role-location",
          [...path, entryIndex, "selectedDependencyBindings", dependencyIndex],
          "Invalid remote delivery projection dependency",
        );
      }
      if (
        !isRegistryRoleLocation(
          target.kind,
          dependency.targetEnvironment,
          dependency.targetRole,
        ) ||
        !target.selectedImplementationBindings.some(
          (binding) =>
            binding.environment === dependency.targetEnvironment &&
            binding.role === dependency.targetRole,
        )
      ) {
        fail(
          "missing-implementation",
          [...path, entryIndex, "selectedDependencyBindings", dependencyIndex],
          "Projection dependency target implementation is absent",
        );
      }
    }
  }
  return result;
}

/** Parses and verifies the internal shape and self digest of an environment projection. */
async function parseRegistryEnvironmentProjectionRecord(
  value: unknown,
): Promise<RegistryEnvironmentProjectionRecord> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(
    snapshot,
    [],
    [
      "schema",
      "environment",
      "deploymentIdentityDigest",
      "catalogDigest",
      "catalogPairCommitmentDigest",
      "seeds",
      "registries",
      "protocolBindingIds",
      "digest",
    ],
  );
  expectLiteral(record.schema, "dathra.registry-environment-projection/2", [
    "schema",
  ]);
  if (!isRuntimeEnvironment(record.environment)) {
    fail("invalid-field", ["environment"], "Unknown projection environment");
  }
  for (const field of [
    "deploymentIdentityDigest",
    "catalogDigest",
    "catalogPairCommitmentDigest",
  ] as const) {
    expectDigest(record[field], [field]);
  }
  const seedValues = expectArray(record.seeds, ["seeds"]);
  const seeds = seedValues.map((seed, index) =>
    validateProjectionSeedSnapshot(seed, ["seeds", index]),
  );
  for (let index = 0; index < seeds.length; index += 1) {
    if (seeds[index].environment !== record.environment) {
      fail(
        "environment-mismatch",
        ["seeds", index, "environment"],
        "Projection seed belongs to another environment",
      );
    }
  }
  compareCanonicalList(seeds, (left, right) => compareSeed(left, right, true), [
    "seeds",
  ]);
  validateProjectionEntries(record.registries, record.environment, [
    "registries",
  ]);
  const protocolValues = expectArray(record.protocolBindingIds, [
    "protocolBindingIds",
  ]);
  const protocolIds = protocolValues.map((id, index) =>
    expectDigest(id, ["protocolBindingIds", index]),
  );
  compareCanonicalList(protocolIds, compareText, ["protocolBindingIds"]);
  await validateSelfDigest(record, []);
  return record as unknown as RegistryEnvironmentProjectionRecord;
}

/** Validates a supplied projection against an exact least-fixed-point derivation. */
async function validateRegistryEnvironmentProjectionRecord(
  value: unknown,
  catalog: RegistryEnvironmentCatalogRecord,
  protocolCatalog: RegistryProtocolCatalogRecord,
  commitment: RegistryCatalogPairCommitment,
  definitions: readonly RegistryProjectionDefinitionRecord[],
): Promise<RegistryEnvironmentProjectionRecord> {
  const valueSnapshot = snapshotClosed(value);
  const catalogSnapshot = snapshotClosed(catalog);
  const protocolSnapshot = snapshotClosed(protocolCatalog);
  const commitmentSnapshot = snapshotClosed(commitment);
  const definitionSnapshot = snapshotClosed(definitions);
  const supplied =
    await parseRegistryEnvironmentProjectionRecord(valueSnapshot);
  const capturedCatalog =
    await parseRegistryEnvironmentCatalogRecord(catalogSnapshot);
  const capturedProtocols =
    await parseRegistryProtocolCatalogRecord(protocolSnapshot);
  const capturedCommitment =
    await parseRegistryCatalogPairCommitment(commitmentSnapshot);
  const capturedDefinitions = validateProjectionDefinitions(definitionSnapshot);
  const expected = await deriveRegistryEnvironmentProjectionRecord(
    capturedCatalog,
    capturedProtocols,
    capturedCommitment,
    capturedDefinitions,
  );
  if (!canonicalEqual(supplied, expected)) {
    fail(
      "projection-mismatch",
      [],
      "Projection differs from the exact fixed point",
    );
  }
  return supplied;
}

export {
  ExecutionRegistryError,
  REGISTRY_IMPLEMENTATION_ROLES,
  REGISTRY_KINDS,
  REGISTRY_ROLE_LOCATIONS,
  RUNTIME_EXECUTION_ENVIRONMENTS,
  createFinalizedRegistryCatalogRecord,
  createQualifiedRegistryId,
  createQualifiedRegistryUniverseRecord,
  createRemoteRegistryProtocolBinding,
  defineRegistryDescriptor,
  deriveRegistryCatalogPairCommitment,
  deriveRegistryEnvironmentCatalogRecord,
  deriveRegistryEnvironmentProjectionRecord,
  deriveRegistryProtocolCatalogRecord,
  digestRegistryDescriptor,
  isRegistryRoleLocation,
  parseFinalizedRegistryCatalogRecord,
  parseQualifiedRegistryDescriptor,
  parseQualifiedRegistryUniverseRecord,
  parseRegistryCatalogPairCommitment,
  parseRegistryEnvironmentCatalogRecord,
  parseRegistryEnvironmentProjectionRecord,
  parseRegistryProtocolCatalogRecord,
  parseRemoteRegistryProtocolBinding,
  registryId,
  registryRoleInterfaceSchemaId,
  validateRegistryCatalogPair,
  validateRegistryEnvironmentProjectionRecord,
};
export type {
  BrandRegistryDescriptor,
  CodecGraphEdgeSlotRecord,
  CodecGraphEdgeSlotTable,
  CodecRegistryDescriptor,
  CodecSlotWirePathSegment,
  ExecutionRegistryErrorCode,
  ExecutionRegistryPathSegment,
  ExecutionEnvironment,
  FailureSchemaRegistryDescriptor,
  FinalizedRegistryCatalogEntry,
  FinalizedRegistryCatalogInput,
  FinalizedRegistryCatalogRecord,
  HostProfileRegistryDescriptor,
  ModuleExportLocator,
  PolicyKind,
  PolicyRegistryDescriptor,
  QualifiedRegistryId,
  QualifiedRegistryUniverseEntry,
  QualifiedRegistryUniverseInput,
  QualifiedRegistryUniverseRecord,
  RegistryCatalogPairCommitment,
  RegistryDependencyBinding,
  RegistryDependencyBindingForLocation,
  RegistryDependencyTargetForEnvironment,
  RegistryDependencyTargetForLocation,
  RegistryDescriptor,
  RegistryDescriptorBase,
  RegistryEnvironmentCatalogEntry,
  RegistryEnvironmentCatalogRecord,
  RegistryEnvironmentProjectionEntry,
  RegistryEnvironmentProjectionRecord,
  RegistryGenericDependencyBinding,
  RegistryGenericDependencyTargetLocation,
  RegistryId,
  RegistryImplementationBinding,
  RegistryImplementationBindingForLocation,
  RegistryImplementationRole,
  RegistryKind,
  RegistryNonProtocolProjectionSeed,
  RegistryNonProtocolSeedLocation,
  RegistryProjectionDefinitionRecord,
  RegistryProjectionSeed,
  RegistryProjectionSeedBase,
  RegistryProjectionSeedForLocation,
  RegistryProtocolBinding,
  RegistryProtocolBindingFor,
  RegistryProtocolCatalogRecord,
  RegistryProtocolProjectionSeed,
  RegistryReference,
  RegistryRoleInterfaceSchemaId,
  RegistryRoleLocation,
  RegistryRoleLocationFor,
  RegistryRoleRequirement,
  RegistryRoleRequirementForLocation,
  RegistrySymbolicImplementationBinding,
  RegistrySymbolicImplementationBindingForLocation,
  RegistrySourceEntry,
  RegistrySourceImplementation,
  RemoteDeliveryAdapterRegistryDescriptor,
  RemoteDeliveryContract,
  RemoteDeliveryDependencyBinding,
  RemoteEndpointIdentityPreimage,
  RemoteLedgerBudget,
  RemoteOperationRegistryDescriptor,
  RemoteProtocolBudget,
  RemoteRegistryProtocolBinding,
  RemoteRegistryProtocolTemplate,
  ResolverRegistryDescriptor,
  RuntimeExecutionEnvironment,
  SubscriptionSequenceContract,
  SubscriptionSourceRegistryDescriptor,
  ValueDomainRegistryDescriptor,
};
