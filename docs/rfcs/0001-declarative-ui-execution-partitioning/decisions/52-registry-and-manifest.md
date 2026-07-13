# Definition, artifact, and registry manifests

```ts
type DefinitionKind =
  | "lifetime-region"
  | "shared-state"
  | "client-root"
  | "activation-group"
  | "client-artifact"
  | "dom-target"
  | "event-recorder"
  | "shell-registration"
  | "dom-template"
  | "insertion-slot"
  | "external-dom-region"
  | "subscription-session"
  | "allocation-transaction"
  | "commit-transaction";

interface DefinitionManifestRecord {
  readonly definitionId: string;
  readonly kind: DefinitionKind;
  readonly artifact: {
    readonly artifactAddressId: string;
    readonly exportName: string;
  } | null;
  readonly contractDigest: Sha256Digest;
  readonly keySchemaDigest: Sha256Digest;
  readonly registryProjectionSeeds: readonly RegistryProjectionSeed[];
  readonly containmentPolicy: PostActiveFailureContainment | null;
}

interface ArtifactManifestRecord {
  readonly artifactAddressId: string;
  readonly addressPreimage: ArtifactAddressPreimage;
  readonly exactDigest: Sha256Digest;
  readonly byteLength: number;
}

type RegistryImplementationRole =
  | "codec-capture"
  | "codec-materialize"
  | "resolver-resolve"
  | "subscription-open"
  | "subscription-resume"
  | "subscription-resync"
  | "policy-evaluate"
  | "value-domain-validate"
  | "failure-schema-adapt"
  | "host-profile-validate"
  | "brand-validate"
  | "remote-client-transport"
  | "remote-client-receipt-verifier"
  | "remote-server-endpoint"
  | "remote-server-handler"
  | "remote-server-delivery";

type RuntimeExecutionEnvironment = Exclude<ExecutionEnvironment, "build">;

type RegistryRoleLocation =
  | { readonly registryKind: "codec"; readonly environment: "browser"; readonly role: "codec-capture" }
  | { readonly registryKind: "codec"; readonly environment: "browser"; readonly role: "codec-materialize" }
  | { readonly registryKind: "codec"; readonly environment: "server-request"; readonly role: "codec-capture" }
  | { readonly registryKind: "codec"; readonly environment: "server-request"; readonly role: "codec-materialize" }
  | { readonly registryKind: "resolver"; readonly environment: "browser"; readonly role: "resolver-resolve" }
  | { readonly registryKind: "resolver"; readonly environment: "server-request"; readonly role: "resolver-resolve" }
  | { readonly registryKind: "subscription-source"; readonly environment: "browser"; readonly role: "subscription-open" }
  | { readonly registryKind: "subscription-source"; readonly environment: "browser"; readonly role: "subscription-resume" }
  | { readonly registryKind: "subscription-source"; readonly environment: "browser"; readonly role: "subscription-resync" }
  | { readonly registryKind: "subscription-source"; readonly environment: "server-request"; readonly role: "subscription-open" }
  | { readonly registryKind: "policy"; readonly environment: "browser"; readonly role: "policy-evaluate" }
  | { readonly registryKind: "policy"; readonly environment: "server-request"; readonly role: "policy-evaluate" }
  | { readonly registryKind: "value-domain"; readonly environment: "browser"; readonly role: "value-domain-validate" }
  | { readonly registryKind: "value-domain"; readonly environment: "server-request"; readonly role: "value-domain-validate" }
  | { readonly registryKind: "failure-schema"; readonly environment: "browser"; readonly role: "failure-schema-adapt" }
  | { readonly registryKind: "failure-schema"; readonly environment: "server-request"; readonly role: "failure-schema-adapt" }
  | { readonly registryKind: "host-profile"; readonly environment: "browser"; readonly role: "host-profile-validate" }
  | { readonly registryKind: "host-profile"; readonly environment: "server-request"; readonly role: "host-profile-validate" }
  | { readonly registryKind: "brand"; readonly environment: "browser"; readonly role: "brand-validate" }
  | { readonly registryKind: "brand"; readonly environment: "server-request"; readonly role: "brand-validate" }
  | { readonly registryKind: "remote-operation"; readonly environment: "browser"; readonly role: "remote-client-transport" }
  | { readonly registryKind: "remote-operation"; readonly environment: "browser"; readonly role: "remote-client-receipt-verifier" }
  | { readonly registryKind: "remote-operation"; readonly environment: "server-request"; readonly role: "remote-server-endpoint" }
  | { readonly registryKind: "remote-operation"; readonly environment: "server-request"; readonly role: "remote-server-handler" }
  | {
      readonly registryKind: "remote-delivery-adapter";
      readonly environment: "server-request";
      readonly role: "remote-server-delivery";
    };

type RegistryRoleLocationFor<Kind extends RegistryKind> = Extract<
  RegistryRoleLocation,
  { readonly registryKind: Kind }
>;

type RegistryRoleInterfaceSchemaId<Role extends RegistryImplementationRole> =
  `dathra.registry-role/${Role}/1`;

type RegistryRoleRequirementForLocation<Location extends RegistryRoleLocation> =
  Location & {
    readonly requirement: "required" | "request-reachable";
    readonly reasonDefinitionIds: readonly string[];
  };

type RegistryRoleRequirement<Kind extends RegistryKind = RegistryKind> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryRoleRequirementForLocation<Location>
      : never
    : never;

type RegistryImplementationBindingForLocation<
  Location extends RegistryRoleLocation,
> = Location & {
  readonly artifactAddressId: string;
  readonly exportName: string;
  readonly interfaceSchemaId: RegistryRoleInterfaceSchemaId<Location["role"]>;
};

type RegistryImplementationBinding<Kind extends RegistryKind = RegistryKind> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryImplementationBindingForLocation<Location>
      : never
    : never;

type RegistryGenericDependencyTargetLocation = Exclude<
  RegistryRoleLocation,
  | { readonly registryKind: "remote-operation" }
  | { readonly registryKind: "remote-delivery-adapter" }
>;

type RegistryDependencyTargetForLocation<
  Location extends RegistryGenericDependencyTargetLocation,
> = {
  readonly targetQualifiedId: QualifiedRegistryId<Location["registryKind"]>;
  readonly targetEnvironment: Location["environment"];
  readonly targetRole: Location["role"];
};

type RegistryDependencyTargetForEnvironment<
  Environment extends RuntimeExecutionEnvironment,
> = RegistryGenericDependencyTargetLocation extends infer Location
  ? Location extends RegistryGenericDependencyTargetLocation
    ? Location["environment"] extends Environment
      ? RegistryDependencyTargetForLocation<Location>
      : never
    : never
  : never;

type RegistryDependencyBindingForLocation<Location extends RegistryRoleLocation> = {
  readonly kind: "same-environment-import";
  readonly sourceEnvironment: Location["environment"];
  readonly sourceRole: Location["role"];
} & RegistryDependencyTargetForEnvironment<Location["environment"]>;

type RegistryGenericDependencyBinding<SourceKind extends RegistryKind> =
  RegistryRoleLocationFor<SourceKind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryDependencyBindingForLocation<Location>
      : never
    : never;

interface RemoteDeliveryDependencyBinding {
  readonly kind: "same-environment-import";
  readonly sourceEnvironment: "server-request";
  readonly sourceRole: "remote-server-endpoint";
  readonly targetQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly targetEnvironment: "server-request";
  readonly targetRole: "remote-server-delivery";
}

type RegistryDependencyBinding<SourceKind extends RegistryKind = RegistryKind> =
  | RegistryGenericDependencyBinding<SourceKind>
  | (SourceKind extends "remote-operation" ? RemoteDeliveryDependencyBinding : never);

interface RemoteEndpointIdentityPreimage {
  readonly schema: "dathra.remote-endpoint-identity/1";
  readonly serverDeploymentIdentityDigest: Sha256Digest;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
}

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

type RegistryProtocolBinding = RemoteRegistryProtocolBinding;

type RegistryProtocolBindingFor<Kind extends RegistryKind> = Kind extends "remote-operation"
  ? RemoteRegistryProtocolBinding
  : never;

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

type RegistrySymbolicImplementationBindingForLocation<
  Location extends RegistryRoleLocation,
> = Location & {
  readonly implementation: ModuleExportLocator;
  readonly interfaceSchemaId: RegistryRoleInterfaceSchemaId<Location["role"]>;
};

type RegistrySymbolicImplementationBinding<
  Kind extends RegistryKind = RegistryKind,
> = RegistryRoleLocationFor<Kind> extends infer Location
  ? Location extends RegistryRoleLocation
    ? RegistrySymbolicImplementationBindingForLocation<Location>
    : never
  : never;

type QualifiedRegistryUniverseEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<RegistryDescriptor<true>, { readonly kind: Kind }>;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings:
      readonly RegistrySymbolicImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolTemplates: Kind extends "remote-operation"
      ? readonly RemoteRegistryProtocolTemplate[]
      : readonly [];
  };
}[RegistryKind];

interface QualifiedRegistryUniverseRecord {
  readonly schema: "dathra.qualified-registry-universe/1";
  readonly registries: readonly QualifiedRegistryUniverseEntry[];
  readonly digest: Sha256Digest;
}

type FinalizedRegistryCatalogEntry = {
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

interface FinalizedRegistryCatalogRecord {
  readonly schema: "dathra.finalized-registry-catalog/1";
  readonly symbolicUniverseDigest: Sha256Digest;
  readonly registries: readonly FinalizedRegistryCatalogEntry[];
  readonly digest: Sha256Digest;
}

```
