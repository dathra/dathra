> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Source and compiled execution contracts

```ts
interface ExecutionContractSource {
  readonly schema: "dathra.execution/1";
  readonly id: string;
  readonly version: string;
  readonly facts: readonly SemanticFact[];
  readonly relations: readonly SemanticRelation[];
  readonly exports: Readonly<Record<string, ExportExecutionContract>>;
  readonly registries: {
    readonly codecs: readonly RegistrySourceEntry<"codec">[];
    readonly resolvers: readonly RegistrySourceEntry<"resolver">[];
    readonly remoteOperations: readonly RegistrySourceEntry<"remote-operation">[];
    readonly remoteDeliveryAdapters: readonly RegistrySourceEntry<"remote-delivery-adapter">[];
    readonly subscriptionSources: readonly RegistrySourceEntry<"subscription-source">[];
    readonly brands: readonly RegistrySourceEntry<"brand">[];
    readonly valueDomains: readonly RegistrySourceEntry<"value-domain">[];
    readonly policies: readonly RegistrySourceEntry<"policy">[];
    readonly hostProfiles: readonly RegistrySourceEntry<"host-profile">[];
    readonly failureSchemas: readonly RegistrySourceEntry<"failure-schema">[];
  };
  readonly hostAssumptionFactIds: readonly FactId[];
}

interface RegistryProjectionSeedBase {
  readonly schema: "dathra.registry-projection-seed/1";
  readonly definitionId: string;
}

type RegistryNonProtocolSeedLocation = Exclude<
  RegistryRoleLocation,
  | { readonly registryKind: "remote-operation" }
  | { readonly registryKind: "remote-delivery-adapter" }
>;

type RegistryProjectionSeedForLocation<
  Location extends RegistryNonProtocolSeedLocation,
> = RegistryProjectionSeedBase & {
  readonly qualifiedId: QualifiedRegistryId<Location["registryKind"]>;
  readonly environment: Location["environment"];
  readonly role: Location["role"];
  readonly protocolBindingId: null;
};

type RegistryNonProtocolProjectionSeed =
  RegistryNonProtocolSeedLocation extends infer Location
    ? Location extends RegistryNonProtocolSeedLocation
      ? RegistryProjectionSeedForLocation<Location>
      : never
    : never;

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

type RegistryProjectionSeed =
  | RegistryNonProtocolProjectionSeed
  | RegistryProtocolProjectionSeed;

type RegistryEnvironmentCatalogEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<RegistryDescriptor<true>, { readonly kind: Kind }>;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings: readonly RegistryImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolBindings: readonly RegistryProtocolBindingFor<Kind>[];
  };
}[RegistryKind];

interface RegistryEnvironmentCatalogRecord {
  readonly schema: "dathra.registry-environment-catalog/1";
  readonly environment: RuntimeExecutionEnvironment;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly registries: readonly RegistryEnvironmentCatalogEntry[];
  readonly digest: Sha256Digest;
}

type RegistryEnvironmentProjectionEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly kind: Kind;
    readonly activeRoleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly selectedImplementationBindings:
      readonly RegistryImplementationBinding<Kind>[];
    readonly selectedDependencyBindings: readonly RegistryDependencyBinding<Kind>[];
  };
}[RegistryKind];

interface RegistryProtocolCatalogRecord {
  readonly schema: "dathra.registry-protocol-catalog/1";
  readonly bindings: readonly RemoteRegistryProtocolBinding[];
  readonly digest: Sha256Digest;
}

interface RegistryCatalogPairCommitment {
  readonly schema: "dathra.registry-catalog-pair/1";
  readonly globalFinalCatalogDigest: Sha256Digest;
  readonly browserCatalogDigest: Sha256Digest;
  readonly serverCatalogDigest: Sha256Digest;
  readonly protocolCatalogDigest: Sha256Digest;
  readonly digest: Sha256Digest;
}

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

interface CompiledFactRecord {
  readonly fact: SemanticFact<true>;
}

interface CompiledRelationRecord {
  readonly relation: SemanticRelation<true>;
}

interface CompiledExecutionContract {
  readonly schema: "dathra.compiled-execution/2";
  readonly sourceContractId: string;
  readonly sourceContractVersion: string;
  readonly namespaceId: Sha256Digest;
  readonly semanticDigest: Sha256Digest;
  readonly sourceModuleContentDigest: Sha256Digest;
  readonly qualifiedFacts: readonly CompiledFactRecord[];
  readonly qualifiedRelations: readonly CompiledRelationRecord[];
  readonly exports: Readonly<Record<string, ExportExecutionContract<true>>>;
  readonly hostAssumptionFactIds: readonly QualifiedFactId[];
  readonly registryUniverse: QualifiedRegistryUniverseRecord;
}

```
