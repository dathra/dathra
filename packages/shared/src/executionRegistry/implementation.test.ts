import { describe, expect, expectTypeOf, it } from "vitest";

import {
  createQualifiedId,
  digestCanonicalJson,
  isSha256Digest,
} from "../canonicalIdentity/implementation";
import * as publicApi from "../index";
import {
  ExecutionRegistryError,
  REGISTRY_IMPLEMENTATION_ROLES,
  REGISTRY_KINDS,
  REGISTRY_ROLE_LOCATIONS,
  RUNTIME_EXECUTION_ENVIRONMENTS,
  createFinalizedRegistryCatalogRecord,
  createQualifiedRegistryId,
  createQualifiedRegistryUniverseRecord,
  registryId,
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
  registryRoleInterfaceSchemaId,
  validateRegistryCatalogPair,
  validateRegistryEnvironmentProjectionRecord,
  type BrandRegistryDescriptor,
  type CodecRegistryDescriptor,
  type ExecutionRegistryErrorCode,
  type ExecutionRegistryPathSegment,
  type FailureSchemaRegistryDescriptor,
  type FinalizedRegistryCatalogEntry,
  type FinalizedRegistryCatalogRecord,
  type HostProfileRegistryDescriptor,
  type PolicyRegistryDescriptor,
  type QualifiedRegistryId,
  type QualifiedRegistryUniverseEntry,
  type QualifiedRegistryUniverseRecord,
  type RegistryDependencyBinding,
  type RegistryDescriptor,
  type RegistryId,
  type RegistryImplementationBinding,
  type RegistryKind,
  type RegistryProjectionDefinitionRecord,
  type RegistryProjectionSeed,
  type RegistryRoleLocation,
  type RegistryRoleLocationFor,
  type RegistryRoleRequirement,
  type RegistrySymbolicImplementationBinding,
  type RemoteDeliveryAdapterRegistryDescriptor,
  type RemoteOperationRegistryDescriptor,
  type RemoteRegistryProtocolBinding,
  type RemoteRegistryProtocolTemplate,
  type ResolverRegistryDescriptor,
  type SubscriptionSourceRegistryDescriptor,
  type ValueDomainRegistryDescriptor,
} from "./implementation";

const EMPTY_SHA256 = "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU";

function requireDigest(value: string) {
  if (!isSha256Digest(value)) {
    throw new Error(`Invalid fixture digest: ${value}`);
  }
  return value;
}

const TEST_DIGEST = requireDigest(EMPTY_SHA256);

async function expectRegistryError(
  operation: () => unknown,
  code: ExecutionRegistryErrorCode,
  path?: readonly ExecutionRegistryPathSegment[],
): Promise<ExecutionRegistryError> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof ExecutionRegistryError)) {
      throw error;
    }
    if (error.code !== code) {
      throw new Error(`Expected error code ${code}, received ${error.code}`);
    }
    if (
      path !== undefined &&
      (error.path.length !== path.length ||
        error.path.some((segment, index) => segment !== path[index]))
    ) {
      throw new Error(
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }

  throw new Error("Expected an ExecutionRegistryError");
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

const ENVIRONMENT_ORDER = new Map([
  ["browser", 0],
  ["server-request", 1],
]);

function compareLocations(
  left: RegistryRoleLocation,
  right: RegistryRoleLocation,
): number {
  const environment =
    (ENVIRONMENT_ORDER.get(left.environment) ?? -1) -
    (ENVIRONMENT_ORDER.get(right.environment) ?? -1);
  if (environment !== 0) return environment;
  return compareText(left.role, right.role);
}

function compareSeeds(
  left: RegistryProjectionSeed,
  right: RegistryProjectionSeed,
): number {
  const definition = compareText(left.definitionId, right.definitionId);
  if (definition !== 0) return definition;
  const environment =
    (ENVIRONMENT_ORDER.get(left.environment) ?? -1) -
    (ENVIRONMENT_ORDER.get(right.environment) ?? -1);
  if (environment !== 0) return environment;
  const qualifiedId = compareText(left.qualifiedId, right.qualifiedId);
  if (qualifiedId !== 0) return qualifiedId;
  const role = compareText(left.role, right.role);
  if (role !== 0) return role;
  if (left.protocolBindingId === right.protocolBindingId) return 0;
  if (left.protocolBindingId === null) return -1;
  if (right.protocolBindingId === null) return 1;
  return compareText(left.protocolBindingId, right.protocolBindingId);
}

function compareDependencies(
  left: RegistryDependencyBinding,
  right: RegistryDependencyBinding,
): number {
  const sourceEnvironment =
    (ENVIRONMENT_ORDER.get(left.sourceEnvironment) ?? -1) -
    (ENVIRONMENT_ORDER.get(right.sourceEnvironment) ?? -1);
  if (sourceEnvironment !== 0) return sourceEnvironment;
  const sourceRole = compareText(left.sourceRole, right.sourceRole);
  if (sourceRole !== 0) return sourceRole;
  const targetId = compareText(left.targetQualifiedId, right.targetQualifiedId);
  if (targetId !== 0) return targetId;
  const targetEnvironment =
    (ENVIRONMENT_ORDER.get(left.targetEnvironment) ?? -1) -
    (ENVIRONMENT_ORDER.get(right.targetEnvironment) ?? -1);
  if (targetEnvironment !== 0) return targetEnvironment;
  return compareText(left.targetRole, right.targetRole);
}

function locationsFor<Kind extends RegistryKind>(
  kind: Kind,
): readonly RegistryRoleLocationFor<Kind>[] {
  return REGISTRY_ROLE_LOCATIONS.filter(
    (location): location is RegistryRoleLocationFor<Kind> =>
      location.registryKind === kind,
  ).toSorted(compareLocations);
}

function makeRequirements<Kind extends RegistryKind>(
  kind: Kind,
  options: FixtureOptions,
): readonly RegistryRoleRequirement<Kind>[] {
  return locationsFor(kind).map((location) => {
    const requestReachable =
      options.requestReachableCodecMaterialize === true &&
      kind === "codec" &&
      location.environment === "browser" &&
      location.role === "codec-materialize";
    return {
      ...location,
      requirement: requestReachable ? "request-reachable" : "required",
      reasonDefinitionIds: requestReachable ? ["feature"] : ["root"],
    } as RegistryRoleRequirement<Kind>;
  });
}

function makeSymbolicImplementations<Kind extends RegistryKind>(
  kind: Kind,
  options: FixtureOptions,
): readonly RegistrySymbolicImplementationBinding<Kind>[] {
  return locationsFor(kind)
    .filter(
      (location) =>
        !(
          options.omitBrowserCodecMaterialize === true &&
          kind === "codec" &&
          location.environment === "browser" &&
          location.role === "codec-materialize"
        ),
    )
    .map(
      (location) =>
        ({
          ...location,
          implementation: {
            specifier: `./${kind}/${location.environment}.js`,
            exportName: location.role,
          },
          interfaceSchemaId: registryRoleInterfaceSchemaId(location.role),
        }) as RegistrySymbolicImplementationBinding<Kind>,
    );
}

function makeFinalImplementations<Kind extends RegistryKind>(
  kind: Kind,
  options: FixtureOptions,
): readonly RegistryImplementationBinding<Kind>[] {
  return locationsFor(kind)
    .filter(
      (location) =>
        !(
          options.omitBrowserCodecMaterialize === true &&
          kind === "codec" &&
          location.environment === "browser" &&
          location.role === "codec-materialize"
        ),
    )
    .map(
      (location) =>
        ({
          ...location,
          artifactAddressId: `artifact:${kind}:${location.environment}:${location.role}`,
          exportName: location.role,
          interfaceSchemaId: registryRoleInterfaceSchemaId(location.role),
        }) as RegistryImplementationBinding<Kind>,
    );
}

interface LocalIds {
  readonly codec: RegistryId<"codec">;
  readonly resolver: RegistryId<"resolver">;
  readonly remoteOperation: RegistryId<"remote-operation">;
  readonly remoteDeliveryAdapter: RegistryId<"remote-delivery-adapter">;
  readonly subscriptionSource: RegistryId<"subscription-source">;
  readonly brand: RegistryId<"brand">;
  readonly valueDomain: RegistryId<"value-domain">;
  readonly policy: RegistryId<"policy">;
  readonly hostProfile: RegistryId<"host-profile">;
  readonly failureSchema: RegistryId<"failure-schema">;
}

function createLocalIds(): LocalIds {
  return {
    codec: registryId("codec", "codec.default"),
    resolver: registryId("resolver", "resolver.default"),
    remoteOperation: registryId("remote-operation", "remote.default"),
    remoteDeliveryAdapter: registryId(
      "remote-delivery-adapter",
      "delivery.default",
    ),
    subscriptionSource: registryId(
      "subscription-source",
      "subscription.default",
    ),
    brand: registryId("brand", "brand.default"),
    valueDomain: registryId("value-domain", "value.default"),
    policy: registryId("policy", "policy.default"),
    hostProfile: registryId("host-profile", "host.default"),
    failureSchema: registryId("failure-schema", "failure.default"),
  };
}

const REMOTE_PROTOCOL_BUDGET = {
  maxRawFrameBytes: 1,
  maxCanonicalMessageBytes: 1,
  maxJsonDepth: 1,
  maxAuthorizationEvidenceBytes: 1,
  maxCapturedWireBytes: 1,
  maxResponsePayloadBytes: 1,
  maxMaterializedInputBytes: 1,
  maxMaterializedOutputBytes: 1,
  maxCodecWorkUnits: 1,
  maxConcurrentDecodes: 1,
} as const;

const REMOTE_LEDGER_BUDGET = {
  maxInFlightOperations: 1,
  maxTerminalRecords: 1,
  maxTerminalBytes: 1,
  maxSequenceGap: 1,
} as const;

function createLocalDescriptors(): readonly RegistryDescriptor[] {
  const ids = createLocalIds();
  return [
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "codec",
      id: ids.codec,
      version: "1",
      observationContractDigest: TEST_DIGEST,
      wireSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
      materializationTrust: "closed-declarative",
      graphEdgeSlots: {
        schema: "dathra.codec-edge-slots/1",
        slots: [
          {
            name: "child",
            wirePath: [{ kind: "property", key: "child" }],
            edgeKind: "graph-node",
            cardinality: "optional",
          },
        ],
      },
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "resolver",
      id: ids.resolver,
      version: "1",
      locatorSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
      exposurePolicyId: ids.policy,
      failureSchemaId: ids.failureSchema,
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "remote-operation",
      id: ids.remoteOperation,
      version: "1",
      inputValueDomainId: ids.valueDomain,
      outputValueDomainId: ids.valueDomain,
      applicationFailureSchemaId: ids.failureSchema,
      inputCodecId: ids.codec,
      outputCodecId: ids.codec,
      failureCodecId: ids.codec,
      authorizationPolicyId: ids.policy,
      deliveryPolicyId: ids.policy,
      deliveryAdapterId: ids.remoteDeliveryAdapter,
      transportProfileId: ids.hostProfile,
      delivery: {
        kind: "idempotent",
        keyPolicyId: ids.policy,
        horizonMs: 1,
      },
      protocolBudget: REMOTE_PROTOCOL_BUDGET,
      systemFailureProtocol: "dathra.remote-system/1",
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "remote-delivery-adapter",
      id: ids.remoteDeliveryAdapter,
      version: "1",
      receiptSchema: "dathra.remote-commit-receipt/1",
      nonCommitReceiptSchema: "dathra.remote-non-commit-receipt/1",
      atomicity: "effect-ledger-result-atomic",
      deliveryEnvironment: "server-request",
      hostAttestationDigest: TEST_DIGEST,
      ledgerBudget: REMOTE_LEDGER_BUDGET,
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "subscription-source",
      id: ids.subscriptionSource,
      version: "1",
      locatorSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
      revisionCodecId: ids.codec,
      failureSchemaId: ids.failureSchema,
      audiencePolicyId: ids.policy,
      capabilityPolicyId: ids.policy,
      authorizationPolicyId: ids.policy,
      namespaceAuthorityIssuerId: "issuer",
      namespaceAuthorityAttestationId: "attestation",
      sequenceContract: {
        schema: "dathra.subscription-sequence/1",
        namespaceDomainId: "namespace",
        resyncNamespace: "preserve",
        maxOutstandingRevisions: 1,
        maxUnacknowledgedRevisions: 1,
        maxRetainedBytes: 1,
        maxSequenceGap: 1,
        cursorRetentionMs: 1,
        reconnectHorizonMs: 1,
        resyncHorizonMs: 1,
        terminalDeadlineMs: 1,
        overflow: "close-and-resync",
        disconnect: "retain-until-reconnect-horizon",
        gc: "acknowledged-and-cursor-expired",
      },
      updateModes: ["replacement", "stable-handle", "journaled-in-place"],
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "brand",
      id: ids.brand,
      version: "1",
      identityScope: "realm",
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "value-domain",
      id: ids.valueDomain,
      version: "1",
      valueSchemaDigest: TEST_DIGEST,
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "policy",
      id: ids.policy,
      version: "1",
      policyKind: "authorization",
      ruleGraphDigest: TEST_DIGEST,
      evaluation: "pure",
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "host-profile",
      id: ids.hostProfile,
      version: "1",
      featureSetDigest: TEST_DIGEST,
    }),
    defineRegistryDescriptor({
      schema: "dathra.registry/1",
      kind: "failure-schema",
      id: ids.failureSchema,
      version: "1",
      failureSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
    }),
  ];
}

interface QualifiedIds {
  readonly codec: QualifiedRegistryId<"codec">;
  readonly resolver: QualifiedRegistryId<"resolver">;
  readonly remoteOperation: QualifiedRegistryId<"remote-operation">;
  readonly remoteDeliveryAdapter: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly subscriptionSource: QualifiedRegistryId<"subscription-source">;
  readonly brand: QualifiedRegistryId<"brand">;
  readonly valueDomain: QualifiedRegistryId<"value-domain">;
  readonly policy: QualifiedRegistryId<"policy">;
  readonly hostProfile: QualifiedRegistryId<"host-profile">;
  readonly failureSchema: QualifiedRegistryId<"failure-schema">;
}

async function createQualifiedIds(
  namespaceId = TEST_DIGEST,
): Promise<QualifiedIds> {
  const local = createLocalIds();
  return {
    codec: await createQualifiedRegistryId(namespaceId, "codec", local.codec),
    resolver: await createQualifiedRegistryId(
      namespaceId,
      "resolver",
      local.resolver,
    ),
    remoteOperation: await createQualifiedRegistryId(
      namespaceId,
      "remote-operation",
      local.remoteOperation,
    ),
    remoteDeliveryAdapter: await createQualifiedRegistryId(
      namespaceId,
      "remote-delivery-adapter",
      local.remoteDeliveryAdapter,
    ),
    subscriptionSource: await createQualifiedRegistryId(
      namespaceId,
      "subscription-source",
      local.subscriptionSource,
    ),
    brand: await createQualifiedRegistryId(namespaceId, "brand", local.brand),
    valueDomain: await createQualifiedRegistryId(
      namespaceId,
      "value-domain",
      local.valueDomain,
    ),
    policy: await createQualifiedRegistryId(
      namespaceId,
      "policy",
      local.policy,
    ),
    hostProfile: await createQualifiedRegistryId(
      namespaceId,
      "host-profile",
      local.hostProfile,
    ),
    failureSchema: await createQualifiedRegistryId(
      namespaceId,
      "failure-schema",
      local.failureSchema,
    ),
  };
}

interface QualifiedDescriptors {
  readonly codec: CodecRegistryDescriptor<true>;
  readonly resolver: ResolverRegistryDescriptor<true>;
  readonly remoteOperation: RemoteOperationRegistryDescriptor<true>;
  readonly remoteDeliveryAdapter: RemoteDeliveryAdapterRegistryDescriptor<true>;
  readonly subscriptionSource: SubscriptionSourceRegistryDescriptor<true>;
  readonly brand: BrandRegistryDescriptor<true>;
  readonly valueDomain: ValueDomainRegistryDescriptor<true>;
  readonly policy: PolicyRegistryDescriptor<true>;
  readonly hostProfile: HostProfileRegistryDescriptor<true>;
  readonly failureSchema: FailureSchemaRegistryDescriptor<true>;
}

function createQualifiedDescriptors(ids: QualifiedIds): QualifiedDescriptors {
  return {
    codec: {
      schema: "dathra.registry/1",
      kind: "codec",
      id: ids.codec,
      version: "1",
      observationContractDigest: TEST_DIGEST,
      wireSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
      materializationTrust: "closed-declarative",
      graphEdgeSlots: null,
    },
    resolver: {
      schema: "dathra.registry/1",
      kind: "resolver",
      id: ids.resolver,
      version: "1",
      locatorSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
      exposurePolicyId: ids.policy,
      failureSchemaId: ids.failureSchema,
    },
    remoteOperation: {
      schema: "dathra.registry/1",
      kind: "remote-operation",
      id: ids.remoteOperation,
      version: "1",
      inputValueDomainId: ids.valueDomain,
      outputValueDomainId: ids.valueDomain,
      applicationFailureSchemaId: ids.failureSchema,
      inputCodecId: ids.codec,
      outputCodecId: ids.codec,
      failureCodecId: ids.codec,
      authorizationPolicyId: ids.policy,
      deliveryPolicyId: ids.policy,
      deliveryAdapterId: ids.remoteDeliveryAdapter,
      transportProfileId: ids.hostProfile,
      delivery: { kind: "single-attempt" },
      protocolBudget: REMOTE_PROTOCOL_BUDGET,
      systemFailureProtocol: "dathra.remote-system/1",
    },
    remoteDeliveryAdapter: {
      schema: "dathra.registry/1",
      kind: "remote-delivery-adapter",
      id: ids.remoteDeliveryAdapter,
      version: "1",
      receiptSchema: "dathra.remote-commit-receipt/1",
      nonCommitReceiptSchema: "dathra.remote-non-commit-receipt/1",
      atomicity: "fenced-idempotency",
      deliveryEnvironment: "server-request",
      hostAttestationDigest: TEST_DIGEST,
      ledgerBudget: REMOTE_LEDGER_BUDGET,
    },
    subscriptionSource: {
      schema: "dathra.registry/1",
      kind: "subscription-source",
      id: ids.subscriptionSource,
      version: "1",
      locatorSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
      revisionCodecId: ids.codec,
      failureSchemaId: ids.failureSchema,
      audiencePolicyId: ids.policy,
      capabilityPolicyId: ids.policy,
      authorizationPolicyId: ids.policy,
      namespaceAuthorityIssuerId: "issuer",
      namespaceAuthorityAttestationId: "attestation",
      sequenceContract: {
        schema: "dathra.subscription-sequence/1",
        namespaceDomainId: "namespace",
        resyncNamespace: "rotate-with-new-snapshot",
        maxOutstandingRevisions: 1,
        maxUnacknowledgedRevisions: 1,
        maxRetainedBytes: 1,
        maxSequenceGap: 1,
        cursorRetentionMs: 1,
        reconnectHorizonMs: 1,
        resyncHorizonMs: 1,
        terminalDeadlineMs: 1,
        overflow: "fail-session",
        disconnect: "close-immediately",
        gc: "acknowledged-and-cursor-expired",
      },
      updateModes: ["replacement", "stable-handle", "journaled-in-place"],
    },
    brand: {
      schema: "dathra.registry/1",
      kind: "brand",
      id: ids.brand,
      version: "1",
      identityScope: "instance",
    },
    valueDomain: {
      schema: "dathra.registry/1",
      kind: "value-domain",
      id: ids.valueDomain,
      version: "1",
      valueSchemaDigest: TEST_DIGEST,
    },
    policy: {
      schema: "dathra.registry/1",
      kind: "policy",
      id: ids.policy,
      version: "1",
      policyKind: "delivery",
      ruleGraphDigest: TEST_DIGEST,
      evaluation: "host-authoritative-async",
    },
    hostProfile: {
      schema: "dathra.registry/1",
      kind: "host-profile",
      id: ids.hostProfile,
      version: "1",
      featureSetDigest: TEST_DIGEST,
    },
    failureSchema: {
      schema: "dathra.registry/1",
      kind: "failure-schema",
      id: ids.failureSchema,
      version: "1",
      failureSchemaDigest: TEST_DIGEST,
      valueDomainId: ids.valueDomain,
    },
  };
}

function descriptorFor(
  descriptors: QualifiedDescriptors,
  kind: RegistryKind,
): RegistryDescriptor<true> {
  switch (kind) {
    case "codec":
      return descriptors.codec;
    case "resolver":
      return descriptors.resolver;
    case "remote-operation":
      return descriptors.remoteOperation;
    case "remote-delivery-adapter":
      return descriptors.remoteDeliveryAdapter;
    case "subscription-source":
      return descriptors.subscriptionSource;
    case "brand":
      return descriptors.brand;
    case "value-domain":
      return descriptors.valueDomain;
    case "policy":
      return descriptors.policy;
    case "host-profile":
      return descriptors.hostProfile;
    case "failure-schema":
      return descriptors.failureSchema;
  }
}

interface FixtureOptions {
  readonly dependencyCycle?: boolean;
  readonly requestReachableCodecMaterialize?: boolean;
  readonly omitBrowserCodecMaterialize?: boolean;
}

interface CatalogFixture {
  readonly namespaceId: typeof TEST_DIGEST;
  readonly browserDeployment: typeof TEST_DIGEST;
  readonly serverDeployment: typeof TEST_DIGEST;
  readonly ids: QualifiedIds;
  readonly descriptors: QualifiedDescriptors;
  readonly template: RemoteRegistryProtocolTemplate;
  readonly protocol: RemoteRegistryProtocolBinding;
  readonly universe: QualifiedRegistryUniverseRecord;
  readonly finalCatalog: FinalizedRegistryCatalogRecord;
  readonly browserCatalog: Awaited<
    ReturnType<typeof deriveRegistryEnvironmentCatalogRecord>
  >;
  readonly serverCatalog: Awaited<
    ReturnType<typeof deriveRegistryEnvironmentCatalogRecord>
  >;
  readonly protocolCatalog: Awaited<
    ReturnType<typeof deriveRegistryProtocolCatalogRecord>
  >;
  readonly commitment: Awaited<
    ReturnType<typeof deriveRegistryCatalogPairCommitment>
  >;
}

function dependenciesFor(
  kind: RegistryKind,
  ids: QualifiedIds,
  options: FixtureOptions,
): readonly RegistryDependencyBinding[] {
  if (kind === "codec" && options.dependencyCycle === true) {
    return [
      {
        kind: "same-environment-import",
        sourceEnvironment: "browser",
        sourceRole: "codec-capture",
        targetQualifiedId: ids.valueDomain,
        targetEnvironment: "browser",
        targetRole: "value-domain-validate",
      },
    ];
  }
  if (kind === "value-domain" && options.dependencyCycle === true) {
    return [
      {
        kind: "same-environment-import",
        sourceEnvironment: "browser",
        sourceRole: "value-domain-validate",
        targetQualifiedId: ids.codec,
        targetEnvironment: "browser",
        targetRole: "codec-materialize",
      },
    ];
  }
  if (kind === "remote-operation") {
    const dependencies: RegistryDependencyBinding<"remote-operation">[] = [
      {
        kind: "same-environment-import",
        sourceEnvironment: "browser",
        sourceRole: "remote-client-transport",
        targetQualifiedId: ids.hostProfile,
        targetEnvironment: "browser",
        targetRole: "host-profile-validate",
      },
      {
        kind: "same-environment-import",
        sourceEnvironment: "server-request",
        sourceRole: "remote-server-endpoint",
        targetQualifiedId: ids.remoteDeliveryAdapter,
        targetEnvironment: "server-request",
        targetRole: "remote-server-delivery",
      },
      {
        kind: "same-environment-import",
        sourceEnvironment: "server-request",
        sourceRole: "remote-server-endpoint",
        targetQualifiedId: ids.hostProfile,
        targetEnvironment: "server-request",
        targetRole: "host-profile-validate",
      },
    ];
    return dependencies.sort(compareDependencies);
  }
  return [];
}

function makeUniverseEntry(
  kind: RegistryKind,
  descriptor: RegistryDescriptor<true>,
  descriptorDigest: typeof TEST_DIGEST,
  requirements: readonly RegistryRoleRequirement[],
  implementations: readonly RegistrySymbolicImplementationBinding[],
  dependencies: readonly RegistryDependencyBinding[],
  protocolTemplates: readonly RemoteRegistryProtocolTemplate[],
): QualifiedRegistryUniverseEntry {
  return {
    qualifiedId: descriptor.id,
    contractNamespaceId: TEST_DIGEST,
    kind,
    version: descriptor.version,
    descriptor,
    descriptorDigest,
    roleRequirements: requirements,
    implementationBindings: implementations,
    dependencyBindings: dependencies,
    protocolTemplates,
  } as QualifiedRegistryUniverseEntry;
}

function makeFinalEntry(
  kind: RegistryKind,
  descriptor: RegistryDescriptor<true>,
  descriptorDigest: typeof TEST_DIGEST,
  requirements: readonly RegistryRoleRequirement[],
  implementations: readonly RegistryImplementationBinding[],
  dependencies: readonly RegistryDependencyBinding[],
  protocolBindings: readonly RemoteRegistryProtocolBinding[],
): FinalizedRegistryCatalogEntry {
  return {
    qualifiedId: descriptor.id,
    contractNamespaceId: TEST_DIGEST,
    kind,
    version: descriptor.version,
    descriptor,
    descriptorDigest,
    roleRequirements: requirements,
    implementationBindings: implementations,
    dependencyBindings: dependencies,
    protocolBindings,
  } as FinalizedRegistryCatalogEntry;
}

async function buildCatalogFixture(
  options: FixtureOptions = {},
): Promise<CatalogFixture> {
  const namespaceId = TEST_DIGEST;
  const browserDeployment = await digestCanonicalJson("browser-deployment");
  const serverDeployment = await digestCanonicalJson("server-deployment");
  const ids = await createQualifiedIds(namespaceId);
  const descriptors = createQualifiedDescriptors(ids);
  const template: RemoteRegistryProtocolTemplate = {
    schema: "dathra.registry-protocol-template/1",
    kind: "remote-request-response",
    operationQualifiedId: ids.remoteOperation,
    clientEnvironment: "browser",
    clientTransportRole: "remote-client-transport",
    clientVerifierRole: "remote-client-receipt-verifier",
    serverEnvironment: "server-request",
    serverEndpointRole: "remote-server-endpoint",
    serverHandlerRole: "remote-server-handler",
    deliveryAdapterQualifiedId: ids.remoteDeliveryAdapter,
    deliveryEnvironment: "server-request",
    deliveryRole: "remote-server-delivery",
    transportProfileQualifiedId: ids.hostProfile,
    requestSchemaDigest: await digestCanonicalJson("request-schema"),
    responseSchemaDigest: await digestCanonicalJson("response-schema"),
    protocolCodecMetadataDigest: await digestCanonicalJson("codec-metadata"),
    authorizationEvidenceVerifierMetadataDigest: await digestCanonicalJson(
      "authorization-verifier",
    ),
    receiptVerifierMetadataDigest:
      await digestCanonicalJson("receipt-verifier"),
    protocolBudgetDigest: await digestCanonicalJson(REMOTE_PROTOCOL_BUDGET),
  };
  const protocol = await createRemoteRegistryProtocolBinding(
    template,
    browserDeployment,
    serverDeployment,
  );

  const universeEntries: QualifiedRegistryUniverseEntry[] = [];
  const finalEntries: FinalizedRegistryCatalogEntry[] = [];
  for (const kind of REGISTRY_KINDS) {
    const descriptor = descriptorFor(descriptors, kind);
    const descriptorDigest = await digestRegistryDescriptor(descriptor);
    const requirements = makeRequirements(kind, options);
    const symbolicImplementations = makeSymbolicImplementations(kind, options);
    const finalImplementations = makeFinalImplementations(kind, options);
    const dependencies = dependenciesFor(kind, ids, options);
    const templates = kind === "remote-operation" ? [template] : [];
    const protocols = kind === "remote-operation" ? [protocol] : [];
    universeEntries.push(
      makeUniverseEntry(
        kind,
        descriptor,
        descriptorDigest,
        requirements,
        symbolicImplementations,
        dependencies,
        templates,
      ),
    );
    finalEntries.push(
      makeFinalEntry(
        kind,
        descriptor,
        descriptorDigest,
        requirements,
        finalImplementations,
        dependencies,
        protocols,
      ),
    );
  }
  universeEntries.sort((left, right) =>
    compareText(left.qualifiedId, right.qualifiedId),
  );
  finalEntries.sort((left, right) =>
    compareText(left.qualifiedId, right.qualifiedId),
  );

  const universe = await createQualifiedRegistryUniverseRecord({
    schema: "dathra.qualified-registry-universe/1",
    registries: universeEntries,
  });
  const finalCatalog = await createFinalizedRegistryCatalogRecord({
    schema: "dathra.finalized-registry-catalog/1",
    symbolicUniverseDigest: universe.digest,
    registries: finalEntries,
  });
  const browserCatalog = await deriveRegistryEnvironmentCatalogRecord(
    finalCatalog,
    "browser",
    browserDeployment,
  );
  const serverCatalog = await deriveRegistryEnvironmentCatalogRecord(
    finalCatalog,
    "server-request",
    serverDeployment,
  );
  const protocolCatalog =
    await deriveRegistryProtocolCatalogRecord(finalCatalog);
  const commitment = await deriveRegistryCatalogPairCommitment(
    finalCatalog,
    browserCatalog,
    serverCatalog,
    protocolCatalog,
  );
  return {
    namespaceId,
    browserDeployment,
    serverDeployment,
    ids,
    descriptors,
    template,
    protocol,
    universe,
    finalCatalog,
    browserCatalog,
    serverCatalog,
    protocolCatalog,
    commitment,
  };
}

function createDefinitions(
  fixture: CatalogFixture,
  includeFeature = false,
): readonly RegistryProjectionDefinitionRecord[] {
  const browserSeeds: RegistryProjectionSeed[] = [
    {
      schema: "dathra.registry-projection-seed/1",
      definitionId: "browser-root",
      qualifiedId: fixture.ids.codec,
      environment: "browser",
      role: "codec-capture",
      protocolBindingId: null,
    },
    {
      schema: "dathra.registry-projection-seed/1",
      definitionId: "browser-root",
      qualifiedId: fixture.ids.remoteOperation,
      environment: "browser",
      role: "remote-client-transport",
      protocolBindingId: fixture.protocol.id,
    },
  ];
  browserSeeds.sort(compareSeeds);

  const definitions: RegistryProjectionDefinitionRecord[] = [
    {
      definitionId: "browser-root",
      registryProjectionSeeds: browserSeeds,
    },
    {
      definitionId: "server-root",
      registryProjectionSeeds: [
        {
          schema: "dathra.registry-projection-seed/1",
          definitionId: "server-root",
          qualifiedId: fixture.ids.remoteOperation,
          environment: "server-request",
          role: "remote-server-endpoint",
          protocolBindingId: fixture.protocol.id,
        },
      ],
    },
  ];
  if (includeFeature) {
    definitions.push({ definitionId: "feature", registryProjectionSeeds: [] });
  }
  return definitions.toSorted((left, right) =>
    compareText(left.definitionId, right.definitionId),
  );
}

describe("registry identity and role matrix", () => {
  it("exposes the exact closed domains", () => {
    expect(REGISTRY_KINDS).toEqual([
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
    ]);
    expect(RUNTIME_EXECUTION_ENVIRONMENTS).toEqual([
      "browser",
      "server-request",
    ]);
    expect(REGISTRY_IMPLEMENTATION_ROLES).toHaveLength(16);
    expect(REGISTRY_ROLE_LOCATIONS).toHaveLength(25);
    expect(
      new Set(
        REGISTRY_ROLE_LOCATIONS.map((location) => JSON.stringify(location)),
      ),
    ).toHaveLength(25);
  });

  it("accepts all 25 legal tuples and rejects the other 295 tuples", () => {
    const legal = new Set(
      REGISTRY_ROLE_LOCATIONS.map(
        ({ registryKind, environment, role }) =>
          `${registryKind}\0${environment}\0${role}`,
      ),
    );
    let invalidCount = 0;
    for (const kind of REGISTRY_KINDS) {
      for (const environment of RUNTIME_EXECUTION_ENVIRONMENTS) {
        for (const role of REGISTRY_IMPLEMENTATION_ROLES) {
          const expected = legal.has(`${kind}\0${environment}\0${role}`);
          expect(isRegistryRoleLocation(kind, environment, role)).toBe(
            expected,
          );
          if (!expected) invalidCount += 1;
        }
      }
    }
    expect(invalidCount).toBe(295);
    expect(isRegistryRoleLocation("codec", "build", "codec-capture")).toBe(
      false,
    );
    expect(isRegistryRoleLocation("unknown", "browser", "codec-capture")).toBe(
      false,
    );
  });

  it("creates source-local and domain-separated qualified IDs", async () => {
    const local = registryId("codec", "codec.é");
    expectTypeOf(local).toEqualTypeOf<RegistryId<"codec">>();
    expect(local).toBe("codec.é");
    const qualified = await createQualifiedRegistryId(
      TEST_DIGEST,
      "codec",
      local,
    );
    expect(qualified).toBe(
      await createQualifiedId({
        namespaceId: TEST_DIGEST,
        kind: "registry:codec",
        localId: local,
      }),
    );
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(registryId, undefined, ["codec", ""]),
        ),
      "invalid-registry-id",
    );
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(registryId, undefined, ["codec", "\ud800"]),
        ),
      "invalid-registry-id",
    );
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(registryId, undefined, ["other", "id"]),
        ),
      "invalid-field",
    );
    await expectRegistryError(
      async () =>
        await Reflect.apply(createQualifiedRegistryId, undefined, [
          "not-a-digest",
          "codec",
          local,
        ]),
      "invalid-field",
      ["namespaceId"],
    );
  });

  it("derives role interface schema IDs and rejects unknown roles", async () => {
    expect(registryRoleInterfaceSchemaId("codec-capture")).toBe(
      "dathra.registry-role/codec-capture/1",
    );
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(registryRoleInterfaceSchemaId, undefined, [
            "unknown-role",
          ]),
        ),
      "invalid-role-location",
    );
  });
});

describe("registry descriptors", () => {
  it("accepts all 10 kind-specific local descriptors as frozen snapshots", () => {
    const descriptors = createLocalDescriptors();
    expect(descriptors.map(({ kind }) => kind)).toEqual(REGISTRY_KINDS);
    for (const descriptor of descriptors) {
      expect(Object.isFrozen(descriptor)).toBe(true);
      expect(descriptor.schema).toBe("dathra.registry/1");
    }
  });

  it("accepts all 10 qualified descriptors and computes exact descriptor digests", async () => {
    const ids = await createQualifiedIds();
    const descriptors = createQualifiedDescriptors(ids);
    for (const kind of REGISTRY_KINDS) {
      const parsed = parseQualifiedRegistryDescriptor(
        descriptorFor(descriptors, kind),
      );
      expect(parsed.kind).toBe(kind);
      expect(await digestRegistryDescriptor(parsed)).toBe(
        await digestCanonicalJson(parsed),
      );
    }
  });

  it("rejects extra, hidden, accessor, and malformed nested fields without invoking getters", async () => {
    const base = structuredClone(createLocalDescriptors()[6]);
    const extra = { ...base, extra: true };
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [extra]),
        ),
      "invalid-field",
      ["extra"],
    );

    const hidden = structuredClone(base);
    Object.defineProperty(hidden, "hidden", { value: true });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [hidden]),
        ),
      "invalid-closed-record",
    );

    let getterCalls = 0;
    const accessor = structuredClone(base);
    Object.defineProperty(accessor, "version", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "1";
      },
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [accessor]),
        ),
      "invalid-closed-record",
      ["version"],
    );
    expect(getterCalls).toBe(0);

    const invalidBudget = structuredClone(createLocalDescriptors()[2]);
    const budget: unknown = Reflect.get(invalidBudget, "protocolBudget");
    if (typeof budget !== "object" || budget === null) {
      throw new Error("Missing protocol budget fixture");
    }
    Reflect.set(budget, "maxJsonDepth", 0);
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [invalidBudget]),
        ),
      "invalid-field",
      ["protocolBudget", "maxJsonDepth"],
    );
  });

  it("rejects noncanonical update modes and invalid qualified reference shapes", async () => {
    const subscription = structuredClone(createLocalDescriptors()[4]);
    Reflect.set(subscription, "updateModes", ["stable-handle", "replacement"]);
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [subscription]),
        ),
      "noncanonical-order",
      ["updateModes", 1],
    );

    const ids = await createQualifiedIds();
    const descriptor = structuredClone(
      createQualifiedDescriptors(ids).resolver,
    );
    Reflect.set(descriptor, "valueDomainId", "not-a-digest");
    await expectRegistryError(
      async () =>
        await Promise.resolve(parseQualifiedRegistryDescriptor(descriptor)),
      "invalid-field",
      ["valueDomainId"],
    );
  });

  it("enforces canonical codec slot names, unique paths, and array-each cardinality", async () => {
    const codec = structuredClone(createLocalDescriptors()[0]);
    Reflect.set(codec, "graphEdgeSlots", {
      schema: "dathra.codec-edge-slots/1",
      slots: [
        {
          name: "z",
          wirePath: [{ kind: "property", key: "z" }],
          edgeKind: "graph-node",
          cardinality: "one",
        },
        {
          name: "a",
          wirePath: [{ kind: "property", key: "a" }],
          edgeKind: "cell",
          cardinality: "one",
        },
      ],
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [codec]),
        ),
      "noncanonical-order",
    );

    const duplicatePath = structuredClone(createLocalDescriptors()[0]);
    Reflect.set(duplicatePath, "graphEdgeSlots", {
      schema: "dathra.codec-edge-slots/1",
      slots: [
        {
          name: "a",
          wirePath: [{ kind: "property", key: "same" }],
          edgeKind: "graph-node",
          cardinality: "one",
        },
        {
          name: "b",
          wirePath: [{ kind: "property", key: "same" }],
          edgeKind: "cell",
          cardinality: "one",
        },
      ],
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [duplicatePath]),
        ),
      "duplicate-record",
    );

    const invalidEach = structuredClone(createLocalDescriptors()[0]);
    Reflect.set(invalidEach, "graphEdgeSlots", {
      schema: "dathra.codec-edge-slots/1",
      slots: [
        {
          name: "items",
          wirePath: [{ kind: "array-each" }, { kind: "array-each" }],
          edgeKind: "graph-node",
          cardinality: "one",
        },
      ],
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [invalidEach]),
        ),
      "invalid-field",
    );

    const invalidIndex = structuredClone(createLocalDescriptors()[0]);
    Reflect.set(invalidIndex, "graphEdgeSlots", {
      schema: "dathra.codec-edge-slots/1",
      slots: [
        {
          name: "index",
          wirePath: [{ kind: "array-index", index: 0xffff_ffff }],
          edgeKind: "graph-node",
          cardinality: "one",
        },
      ],
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [invalidIndex]),
        ),
      "invalid-field",
      ["graphEdgeSlots", "slots", 0, "wirePath", 0, "index"],
    );
  });

  it("keeps zero-field union variants closed while allowing empty property keys", async () => {
    const emptyKey = structuredClone(createLocalDescriptors()[0]);
    Reflect.set(emptyKey, "graphEdgeSlots", {
      schema: "dathra.codec-edge-slots/1",
      slots: [
        {
          name: "empty-key",
          wirePath: [{ kind: "property", key: "" }],
          edgeKind: "graph-node",
          cardinality: "one",
        },
        {
          name: "root",
          wirePath: [],
          edgeKind: "cell",
          cardinality: "one",
        },
      ],
    });
    expect(
      Reflect.apply(defineRegistryDescriptor, undefined, [emptyKey]),
    ).toEqual(emptyKey);

    const ids = await createQualifiedIds();
    const extraArrayEach = structuredClone(
      createQualifiedDescriptors(ids).codec,
    );
    Reflect.set(extraArrayEach, "graphEdgeSlots", {
      schema: "dathra.codec-edge-slots/1",
      slots: [
        {
          name: "items",
          wirePath: [{ kind: "array-each", extra: true }],
          edgeKind: "graph-node",
          cardinality: "many",
        },
      ],
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(parseQualifiedRegistryDescriptor(extraArrayEach)),
      "invalid-field",
      ["graphEdgeSlots", "slots", 0, "wirePath", 0, "extra"],
    );

    const extraSingleAttempt = structuredClone(createLocalDescriptors()[2]);
    Reflect.set(extraSingleAttempt, "delivery", {
      kind: "single-attempt",
      extra: true,
    });
    await expectRegistryError(
      async () =>
        await Promise.resolve(
          Reflect.apply(defineRegistryDescriptor, undefined, [
            extraSingleAttempt,
          ]),
        ),
      "invalid-field",
      ["delivery", "extra"],
    );
  });
});

describe("symbolic and finalized catalogs", () => {
  it("creates and parses exact self-digested records", async () => {
    const fixture = await buildCatalogFixture({ dependencyCycle: true });
    expect(
      await parseQualifiedRegistryUniverseRecord(fixture.universe),
    ).toEqual(fixture.universe);
    expect(
      await parseFinalizedRegistryCatalogRecord(fixture.finalCatalog),
    ).toEqual(fixture.finalCatalog);
    expect(fixture.universe.digest).toBe(
      await digestCanonicalJson({ ...fixture.universe, digest: "" }),
    );
    expect(fixture.finalCatalog.digest).toBe(
      await digestCanonicalJson({ ...fixture.finalCatalog, digest: "" }),
    );
    expect(
      fixture.finalCatalog.registries.map(({ qualifiedId }) => qualifiedId),
    ).toEqual(
      fixture.finalCatalog.registries
        .map(({ qualifiedId }) => qualifiedId)
        .toSorted(compareText),
    );
  });

  it("rejects self-digest mismatch, noncanonical owners, and duplicate roles", async () => {
    const fixture = await buildCatalogFixture();
    const badDigest = structuredClone(fixture.universe);
    Reflect.set(badDigest, "digest", TEST_DIGEST);
    if (TEST_DIGEST === fixture.universe.digest) {
      Reflect.set(badDigest, "digest", await digestCanonicalJson("different"));
    }
    await expectRegistryError(
      async () => await parseQualifiedRegistryUniverseRecord(badDigest),
      "digest-mismatch",
      ["digest"],
    );

    const reverse = structuredClone(fixture.finalCatalog);
    const reverseRegistries = [...reverse.registries].reverse();
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: reverse.schema,
            symbolicUniverseDigest: reverse.symbolicUniverseDigest,
            registries: reverseRegistries,
          },
        ]),
      "noncanonical-order",
    );

    const duplicateRole = structuredClone(fixture.finalCatalog);
    const codec = duplicateRole.registries.find(({ kind }) => kind === "codec");
    if (codec === undefined) throw new Error("Missing codec fixture");
    const implementations = Reflect.get(codec, "implementationBindings");
    Reflect.set(codec, "implementationBindings", [
      implementations[0],
      implementations[0],
    ]);
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: duplicateRole.schema,
            symbolicUniverseDigest: duplicateRole.symbolicUniverseDigest,
            registries: duplicateRole.registries,
          },
        ]),
      "duplicate-record",
    );
  });

  it("rejects dangling references, kind mismatch, descriptor mismatch, and missing required implementations", async () => {
    const fixture = await buildCatalogFixture();

    const dangling = structuredClone(fixture.finalCatalog);
    const withoutValueDomain = dangling.registries.filter(
      ({ kind }) => kind !== "value-domain",
    );
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: dangling.schema,
            symbolicUniverseDigest: dangling.symbolicUniverseDigest,
            registries: withoutValueDomain,
          },
        ]),
      "dangling-reference",
    );

    const kindMismatch = structuredClone(fixture.finalCatalog);
    const codec = kindMismatch.registries.find(({ kind }) => kind === "codec");
    if (codec === undefined) throw new Error("Missing codec fixture");
    Reflect.set(
      Reflect.get(codec, "descriptor"),
      "valueDomainId",
      fixture.ids.policy,
    );
    Reflect.set(
      codec,
      "descriptorDigest",
      await digestRegistryDescriptor(Reflect.get(codec, "descriptor")),
    );
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: kindMismatch.schema,
            symbolicUniverseDigest: kindMismatch.symbolicUniverseDigest,
            registries: kindMismatch.registries,
          },
        ]),
      "kind-mismatch",
    );

    const descriptorMismatch = structuredClone(fixture.finalCatalog);
    const resolver = descriptorMismatch.registries.find(
      ({ kind }) => kind === "resolver",
    );
    if (resolver === undefined) throw new Error("Missing resolver fixture");
    Reflect.set(resolver, "version", "different");
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: descriptorMismatch.schema,
            symbolicUniverseDigest: descriptorMismatch.symbolicUniverseDigest,
            registries: descriptorMismatch.registries,
          },
        ]),
      "kind-mismatch",
    );

    const missing = structuredClone(fixture.finalCatalog);
    const policy = missing.registries.find(({ kind }) => kind === "policy");
    if (policy === undefined) throw new Error("Missing policy fixture");
    Reflect.set(policy, "implementationBindings", []);
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: missing.schema,
            symbolicUniverseDigest: missing.symbolicUniverseDigest,
            registries: missing.registries,
          },
        ]),
      "missing-implementation",
    );
  });

  it("rejects illegal and cross-environment dependencies", async () => {
    const fixture = await buildCatalogFixture();
    const invalid = structuredClone(fixture.finalCatalog);
    const codec = invalid.registries.find(({ kind }) => kind === "codec");
    if (codec === undefined) throw new Error("Missing codec fixture");
    Reflect.set(codec, "dependencyBindings", [
      {
        kind: "same-environment-import",
        sourceEnvironment: "browser",
        sourceRole: "codec-capture",
        targetQualifiedId: fixture.ids.valueDomain,
        targetEnvironment: "server-request",
        targetRole: "value-domain-validate",
      },
    ]);
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: invalid.schema,
            symbolicUniverseDigest: invalid.symbolicUniverseDigest,
            registries: invalid.registries,
          },
        ]),
      "environment-mismatch",
    );

    Reflect.set(codec, "dependencyBindings", [
      {
        kind: "same-environment-import",
        sourceEnvironment: "browser",
        sourceRole: "codec-capture",
        targetQualifiedId: fixture.ids.remoteOperation,
        targetEnvironment: "browser",
        targetRole: "remote-client-transport",
      },
    ]);
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: invalid.schema,
            symbolicUniverseDigest: invalid.symbolicUniverseDigest,
            registries: invalid.registries,
          },
        ]),
      "invalid-role-location",
    );
  });

  it("binds remote protocol budgets and delivery dependencies to the operation descriptor", async () => {
    const fixture = await buildCatalogFixture();
    const invalidBudget = structuredClone(fixture.universe);
    const symbolicRemote = invalidBudget.registries.find(
      ({ kind }) => kind === "remote-operation",
    );
    if (symbolicRemote === undefined) throw new Error("Missing remote fixture");
    const templates: unknown = Reflect.get(symbolicRemote, "protocolTemplates");
    if (!Array.isArray(templates) || templates.length === 0) {
      throw new Error("Missing protocol template fixture");
    }
    const template: unknown = templates[0];
    if (typeof template !== "object" || template === null) {
      throw new Error("Invalid protocol template fixture");
    }
    Reflect.set(template, "protocolBudgetDigest", TEST_DIGEST);
    await expectRegistryError(
      async () =>
        await Reflect.apply(createQualifiedRegistryUniverseRecord, undefined, [
          {
            schema: invalidBudget.schema,
            registries: invalidBudget.registries,
          },
        ]),
      "digest-mismatch",
    );

    const missingDelivery = structuredClone(fixture.finalCatalog);
    const finalizedRemote = missingDelivery.registries.find(
      ({ kind }) => kind === "remote-operation",
    );
    if (finalizedRemote === undefined)
      throw new Error("Missing remote fixture");
    Reflect.set(finalizedRemote, "dependencyBindings", []);
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: missingDelivery.schema,
            symbolicUniverseDigest: missingDelivery.symbolicUniverseDigest,
            registries: missingDelivery.registries,
          },
        ]),
      "missing-implementation",
    );

    const missingProfileDependency = structuredClone(fixture.finalCatalog);
    const profileRemote = missingProfileDependency.registries.find(
      ({ kind }) => kind === "remote-operation",
    );
    if (profileRemote === undefined) throw new Error("Missing remote fixture");
    Reflect.set(
      profileRemote,
      "dependencyBindings",
      profileRemote.dependencyBindings.filter(
        ({ targetQualifiedId }) =>
          targetQualifiedId !== fixture.ids.hostProfile,
      ),
    );
    await expectRegistryError(
      async () =>
        await Reflect.apply(createFinalizedRegistryCatalogRecord, undefined, [
          {
            schema: missingProfileDependency.schema,
            symbolicUniverseDigest:
              missingProfileDependency.symbolicUniverseDigest,
            registries: missingProfileDependency.registries,
          },
        ]),
      "missing-implementation",
    );
  });
});

describe("protocol, environment catalogs, and pair commitment", () => {
  it("derives endpoint and protocol identities from the exact full records", async () => {
    const fixture = await buildCatalogFixture();
    const endpointIdentity = await digestCanonicalJson({
      schema: "dathra.remote-endpoint-identity/1",
      serverDeploymentIdentityDigest: fixture.serverDeployment,
      operationQualifiedId: fixture.ids.remoteOperation,
      transportProfileQualifiedId: fixture.ids.hostProfile,
    });
    expect(fixture.protocol.endpointIdentity).toBe(endpointIdentity);
    expect(fixture.protocol.id).toBe(
      await digestCanonicalJson({ ...fixture.protocol, id: "" }),
    );
    expect(await parseRemoteRegistryProtocolBinding(fixture.protocol)).toEqual(
      fixture.protocol,
    );
  });

  it("derives exact environment and protocol catalogs without cross-environment locators", async () => {
    const fixture = await buildCatalogFixture();
    expect(
      await parseRegistryEnvironmentCatalogRecord(fixture.browserCatalog),
    ).toEqual(fixture.browserCatalog);
    expect(
      await parseRegistryEnvironmentCatalogRecord(fixture.serverCatalog),
    ).toEqual(fixture.serverCatalog);
    expect(
      await parseRegistryProtocolCatalogRecord(fixture.protocolCatalog),
    ).toEqual(fixture.protocolCatalog);
    expect(fixture.browserCatalog.registries).not.toContainEqual(
      expect.objectContaining({ kind: "remote-delivery-adapter" }),
    );
    for (const entry of fixture.browserCatalog.registries) {
      expect(
        entry.implementationBindings.every(
          ({ environment }) => environment === "browser",
        ),
      ).toBe(true);
      expect(
        entry.dependencyBindings.every(
          ({ sourceEnvironment }) => sourceEnvironment === "browser",
        ),
      ).toBe(true);
    }
    expect(fixture.protocolCatalog.bindings).toEqual([fixture.protocol]);
  });

  it("binds all four catalogs and validates the remote four-role and adapter closure", async () => {
    const fixture = await buildCatalogFixture();
    expect(
      await parseRegistryCatalogPairCommitment(fixture.commitment),
    ).toEqual(fixture.commitment);
    expect(fixture.commitment).toMatchObject({
      globalFinalCatalogDigest: fixture.finalCatalog.digest,
      browserCatalogDigest: fixture.browserCatalog.digest,
      serverCatalogDigest: fixture.serverCatalog.digest,
      protocolCatalogDigest: fixture.protocolCatalog.digest,
    });
    await expect(
      validateRegistryCatalogPair(
        fixture.finalCatalog,
        fixture.browserCatalog,
        fixture.serverCatalog,
        fixture.protocolCatalog,
        fixture.commitment,
      ),
    ).resolves.toBeUndefined();
  });

  it("rejects protocol self-digest, deployment, endpoint, and pair mismatches", async () => {
    const fixture = await buildCatalogFixture();
    const protocol = structuredClone(fixture.protocol);
    Reflect.set(protocol, "id", await digestCanonicalJson("wrong-protocol"));
    await expectRegistryError(
      async () => await parseRemoteRegistryProtocolBinding(protocol),
      "digest-mismatch",
      ["id"],
    );

    const serverCatalog = structuredClone(fixture.serverCatalog);
    Reflect.set(serverCatalog, "deploymentIdentityDigest", TEST_DIGEST);
    Reflect.set(
      serverCatalog,
      "digest",
      await digestCanonicalJson({ ...serverCatalog, digest: "" }),
    );
    await expectRegistryError(
      async () =>
        await validateRegistryCatalogPair(
          fixture.finalCatalog,
          fixture.browserCatalog,
          serverCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
        ),
      "environment-mismatch",
    );

    const pair = structuredClone(fixture.commitment);
    Reflect.set(pair, "protocolCatalogDigest", TEST_DIGEST);
    Reflect.set(
      pair,
      "digest",
      await digestCanonicalJson({ ...pair, digest: "" }),
    );
    await expectRegistryError(
      async () =>
        await validateRegistryCatalogPair(
          fixture.finalCatalog,
          fixture.browserCatalog,
          fixture.serverCatalog,
          fixture.protocolCatalog,
          pair,
        ),
      "digest-mismatch",
    );
  });
});

describe("exact seed fixed-point projection", () => {
  it("closes required roles and dependency cycles to an owner-grouped fixed point", async () => {
    const fixture = await buildCatalogFixture({ dependencyCycle: true });
    const definitions = createDefinitions(fixture);
    const projection = await deriveRegistryEnvironmentProjectionRecord(
      fixture.browserCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      definitions,
    );
    expect(await parseRegistryEnvironmentProjectionRecord(projection)).toEqual(
      projection,
    );
    expect(
      await validateRegistryEnvironmentProjectionRecord(
        projection,
        fixture.browserCatalog,
        fixture.protocolCatalog,
        fixture.commitment,
        definitions,
      ),
    ).toEqual(projection);
    const codec = projection.registries.find(({ kind }) => kind === "codec");
    const valueDomain = projection.registries.find(
      ({ kind }) => kind === "value-domain",
    );
    expect(
      codec?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["codec-capture", "codec-materialize"]);
    expect(
      valueDomain?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["value-domain-validate"]);
    expect(projection.protocolBindingIds).toEqual([fixture.protocol.id]);
  });

  it("expands browser and server protocol seeds without using protocol as an implicit root", async () => {
    const fixture = await buildCatalogFixture();
    const definitions = createDefinitions(fixture);
    const browser = await deriveRegistryEnvironmentProjectionRecord(
      fixture.browserCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      definitions,
    );
    const server = await deriveRegistryEnvironmentProjectionRecord(
      fixture.serverCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      definitions,
    );
    const browserRemote = browser.registries.find(
      ({ qualifiedId }) => qualifiedId === fixture.ids.remoteOperation,
    );
    const serverRemote = server.registries.find(
      ({ qualifiedId }) => qualifiedId === fixture.ids.remoteOperation,
    );
    const adapter = server.registries.find(
      ({ qualifiedId }) => qualifiedId === fixture.ids.remoteDeliveryAdapter,
    );
    const browserProfile = browser.registries.find(
      ({ qualifiedId }) => qualifiedId === fixture.ids.hostProfile,
    );
    const serverProfile = server.registries.find(
      ({ qualifiedId }) => qualifiedId === fixture.ids.hostProfile,
    );
    expect(
      browserRemote?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["remote-client-receipt-verifier", "remote-client-transport"]);
    expect(
      serverRemote?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["remote-server-endpoint", "remote-server-handler"]);
    expect(
      adapter?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["remote-server-delivery"]);
    expect(
      browserProfile?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["host-profile-validate"]);
    expect(
      serverProfile?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["host-profile-validate"]);
    expect(browser.protocolBindingIds).toEqual([fixture.protocol.id]);
    expect(server.protocolBindingIds).toEqual([fixture.protocol.id]);
  });

  it("requires every selected protocol to have browser and server seeds", async () => {
    const fixture = await buildCatalogFixture();
    const browserOnly = createDefinitions(fixture).filter(
      ({ definitionId }) => definitionId !== "server-root",
    );
    await expectRegistryError(
      async () =>
        await deriveRegistryEnvironmentProjectionRecord(
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          browserOnly,
        ),
      "invalid-seed",
    );
  });

  it("activates request-reachable requirements only when a reason definition is selected", async () => {
    const fixture = await buildCatalogFixture({
      requestReachableCodecMaterialize: true,
    });
    const withoutReason = await deriveRegistryEnvironmentProjectionRecord(
      fixture.browserCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      createDefinitions(fixture),
    );
    const withReason = await deriveRegistryEnvironmentProjectionRecord(
      fixture.browserCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      createDefinitions(fixture, true),
    );
    const withoutCodec = withoutReason.registries.find(
      ({ kind }) => kind === "codec",
    );
    const withCodec = withReason.registries.find(
      ({ kind }) => kind === "codec",
    );
    expect(
      withoutCodec?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["codec-capture"]);
    expect(
      withCodec?.selectedImplementationBindings.map(({ role }) => role),
    ).toEqual(["codec-capture", "codec-materialize"]);
  });

  it("snapshots every projection input before the first asynchronous boundary", async () => {
    const fixture = await buildCatalogFixture();
    const definitions = structuredClone(createDefinitions(fixture));
    const projectionPromise = deriveRegistryEnvironmentProjectionRecord(
      fixture.browserCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      definitions,
    );
    const browserRoot = definitions.find(
      ({ definitionId }) => definitionId === "browser-root",
    );
    if (browserRoot === undefined)
      throw new Error("Missing browser definition");
    Reflect.set(browserRoot, "registryProjectionSeeds", []);

    const projection = await projectionPromise;
    expect(projection.seeds).toHaveLength(2);
    expect(projection.protocolBindingIds).toEqual([fixture.protocol.id]);
  });

  it("rejects missing active implementations, arbitrary seeds, duplicates, and protocol misuse", async () => {
    const missing = await buildCatalogFixture({
      requestReachableCodecMaterialize: true,
      omitBrowserCodecMaterialize: true,
    });
    await expectRegistryError(
      async () =>
        await deriveRegistryEnvironmentProjectionRecord(
          missing.browserCatalog,
          missing.protocolCatalog,
          missing.commitment,
          createDefinitions(missing, true),
        ),
      "missing-implementation",
    );

    const fixture = await buildCatalogFixture();
    const definitions = structuredClone(createDefinitions(fixture));
    const browserRoot = definitions.find(
      ({ definitionId }) => definitionId === "browser-root",
    );
    if (browserRoot === undefined)
      throw new Error("Missing browser definition");
    const arbitraryId = await createQualifiedRegistryId(
      TEST_DIGEST,
      "codec",
      registryId("codec", "unknown"),
    );
    Reflect.set(browserRoot, "registryProjectionSeeds", [
      {
        schema: "dathra.registry-projection-seed/1",
        definitionId: "browser-root",
        qualifiedId: arbitraryId,
        environment: "browser",
        role: "codec-capture",
        protocolBindingId: null,
      },
    ]);
    await expectRegistryError(
      async () =>
        await deriveRegistryEnvironmentProjectionRecord(
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          definitions,
        ),
      "invalid-seed",
    );

    const duplicate = structuredClone(createDefinitions(fixture));
    const duplicateRoot = duplicate.find(
      ({ definitionId }) => definitionId === "browser-root",
    );
    if (duplicateRoot === undefined)
      throw new Error("Missing browser definition");
    const firstSeed = duplicateRoot.registryProjectionSeeds[0];
    Reflect.set(duplicateRoot, "registryProjectionSeeds", [
      firstSeed,
      firstSeed,
    ]);
    await expectRegistryError(
      async () =>
        await deriveRegistryEnvironmentProjectionRecord(
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          duplicate,
        ),
      "duplicate-record",
    );

    const unordered = structuredClone(createDefinitions(fixture));
    const unorderedRoot = unordered.find(
      ({ definitionId }) => definitionId === "browser-root",
    );
    if (unorderedRoot === undefined)
      throw new Error("Missing browser definition");
    Reflect.set(
      unorderedRoot,
      "registryProjectionSeeds",
      [...unorderedRoot.registryProjectionSeeds].reverse(),
    );
    await expectRegistryError(
      async () =>
        await deriveRegistryEnvironmentProjectionRecord(
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          unordered,
        ),
      "noncanonical-order",
    );

    const misuse = structuredClone(createDefinitions(fixture));
    const misuseRoot = misuse.find(
      ({ definitionId }) => definitionId === "browser-root",
    );
    if (misuseRoot === undefined) throw new Error("Missing browser definition");
    Reflect.set(misuseRoot, "registryProjectionSeeds", [
      {
        schema: "dathra.registry-projection-seed/1",
        definitionId: "browser-root",
        qualifiedId: fixture.ids.codec,
        environment: "browser",
        role: "codec-capture",
        protocolBindingId: fixture.protocol.id,
      },
    ]);
    await expectRegistryError(
      async () =>
        await deriveRegistryEnvironmentProjectionRecord(
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          misuse,
        ),
      "invalid-seed",
    );
  });

  it("rejects self-consistent projections with missing or extra fixed-point records", async () => {
    const fixture = await buildCatalogFixture({ dependencyCycle: true });
    const definitions = createDefinitions(fixture);
    const projection = await deriveRegistryEnvironmentProjectionRecord(
      fixture.browserCatalog,
      fixture.protocolCatalog,
      fixture.commitment,
      definitions,
    );
    const missing = structuredClone(projection);
    Reflect.set(
      missing,
      "registries",
      missing.registries.filter(
        ({ qualifiedId }) => qualifiedId !== fixture.ids.remoteOperation,
      ),
    );
    Reflect.set(
      missing,
      "digest",
      await digestCanonicalJson({ ...missing, digest: "" }),
    );
    await expectRegistryError(
      async () =>
        await validateRegistryEnvironmentProjectionRecord(
          missing,
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          definitions,
        ),
      "projection-mismatch",
    );

    const brand = fixture.browserCatalog.registries.find(
      ({ kind }) => kind === "brand",
    );
    if (brand === undefined) throw new Error("Missing brand fixture");
    const extra = structuredClone(projection);
    const extraRegistries = [
      ...extra.registries,
      {
        qualifiedId: brand.qualifiedId,
        kind: brand.kind,
        activeRoleRequirements: brand.roleRequirements,
        selectedImplementationBindings: brand.implementationBindings,
        selectedDependencyBindings: brand.dependencyBindings,
      },
    ].sort((left, right) => compareText(left.qualifiedId, right.qualifiedId));
    Reflect.set(extra, "registries", extraRegistries);
    Reflect.set(
      extra,
      "digest",
      await digestCanonicalJson({ ...extra, digest: "" }),
    );
    await expectRegistryError(
      async () =>
        await validateRegistryEnvironmentProjectionRecord(
          extra,
          fixture.browserCatalog,
          fixture.protocolCatalog,
          fixture.commitment,
          definitions,
        ),
      "projection-mismatch",
    );
  });
});

describe("execution registry public API", () => {
  it("exports all public contract and validator values from the package root", () => {
    expect(publicApi.ExecutionRegistryError).toBe(ExecutionRegistryError);
    expect(publicApi.REGISTRY_KINDS).toBe(REGISTRY_KINDS);
    expect(publicApi.REGISTRY_ROLE_LOCATIONS).toBe(REGISTRY_ROLE_LOCATIONS);
    expect(publicApi.registryId).toBe(registryId);
    expect(publicApi.defineRegistryDescriptor).toBe(defineRegistryDescriptor);
    expect(publicApi.deriveRegistryEnvironmentProjectionRecord).toBe(
      deriveRegistryEnvironmentProjectionRecord,
    );
  });
});
