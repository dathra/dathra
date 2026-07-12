import type { RegistrySourceEntry } from "../executionRegistry/implementation";
import type { ExecutionContractRegistrySources } from "./implementation";

type Copy<Value> = { [Key in keyof Value]: Value[Key] };
type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <
        Value,
      >() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type ExpectTrue<Value extends true> = Value;
type ExpectFalse<Value extends false> = Value;
type OptionalKeys<Value> = {
  [Key in keyof Value]-?: Record<never, never> extends Pick<Value, Key>
    ? Key
    : never;
}[keyof Value];
type ReadonlyKeys<Value> = {
  [Key in keyof Value]-?: Equal<
    Pick<Value, Key>,
    Readonly<Pick<Value, Key>>
  > extends true
    ? Key
    : never;
}[keyof Value];
type StrictReadonlyArrayKeys<Value> = {
  [Key in keyof Value]-?: Value[Key] extends readonly unknown[]
    ? Value[Key] extends unknown[]
      ? never
      : Key
    : never;
}[keyof Value];

type ExpectedExecutionContractRegistrySources = {
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

type WrongKindRegistrySources = {
  readonly codecs: readonly RegistrySourceEntry<"resolver">[];
  readonly resolvers: readonly RegistrySourceEntry<"codec">[];
  readonly remoteOperations: readonly RegistrySourceEntry<"remote-delivery-adapter">[];
  readonly remoteDeliveryAdapters: readonly RegistrySourceEntry<"remote-operation">[];
  readonly subscriptionSources: readonly RegistrySourceEntry<"policy">[];
  readonly brands: readonly RegistrySourceEntry<"value-domain">[];
  readonly valueDomains: readonly RegistrySourceEntry<"brand">[];
  readonly policies: readonly RegistrySourceEntry<"host-profile">[];
  readonly hostProfiles: readonly RegistrySourceEntry<"failure-schema">[];
  readonly failureSchemas: readonly RegistrySourceEntry<"subscription-source">[];
};

type MissingFieldRegistrySources = Omit<
  ExpectedExecutionContractRegistrySources,
  "failureSchemas"
>;
type ExtraFieldRegistrySources = ExpectedExecutionContractRegistrySources & {
  readonly registryVersions: readonly string[];
};
type OptionalFieldRegistrySources = Omit<
  ExpectedExecutionContractRegistrySources,
  "codecs"
> & {
  readonly codecs?: readonly RegistrySourceEntry<"codec">[];
};
type MutableFieldRegistrySources = Omit<
  ExpectedExecutionContractRegistrySources,
  "codecs"
> & {
  codecs: readonly RegistrySourceEntry<"codec">[];
};
type MutableArrayRegistrySources = Omit<
  ExpectedExecutionContractRegistrySources,
  "codecs"
> & {
  readonly codecs: RegistrySourceEntry<"codec">[];
};

type ContractHasExactShape = ExpectTrue<
  Equal<
    Copy<ExecutionContractRegistrySources>,
    Copy<ExpectedExecutionContractRegistrySources>
  >
>;
type ContractHasExactKeys = ExpectTrue<
  Equal<
    keyof ExecutionContractRegistrySources,
    keyof ExpectedExecutionContractRegistrySources
  >
>;
type ContractHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ExecutionContractRegistrySources>, never>
>;
type ContractHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ExecutionContractRegistrySources>,
    keyof ExpectedExecutionContractRegistrySources
  >
>;
type ContractHasOnlyReadonlyArrays = ExpectTrue<
  Equal<
    StrictReadonlyArrayKeys<ExecutionContractRegistrySources>,
    keyof ExpectedExecutionContractRegistrySources
  >
>;

type CodecsKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["codecs"],
    readonly RegistrySourceEntry<"codec">[]
  >
>;
type ResolversKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["resolvers"],
    readonly RegistrySourceEntry<"resolver">[]
  >
>;
type RemoteOperationsKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["remoteOperations"],
    readonly RegistrySourceEntry<"remote-operation">[]
  >
>;
type RemoteDeliveryAdaptersKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["remoteDeliveryAdapters"],
    readonly RegistrySourceEntry<"remote-delivery-adapter">[]
  >
>;
type SubscriptionSourcesKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["subscriptionSources"],
    readonly RegistrySourceEntry<"subscription-source">[]
  >
>;
type BrandsKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["brands"],
    readonly RegistrySourceEntry<"brand">[]
  >
>;
type ValueDomainsKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["valueDomains"],
    readonly RegistrySourceEntry<"value-domain">[]
  >
>;
type PoliciesKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["policies"],
    readonly RegistrySourceEntry<"policy">[]
  >
>;
type HostProfilesKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["hostProfiles"],
    readonly RegistrySourceEntry<"host-profile">[]
  >
>;
type FailureSchemasKindMapping = ExpectTrue<
  Equal<
    ExecutionContractRegistrySources["failureSchemas"],
    readonly RegistrySourceEntry<"failure-schema">[]
  >
>;

type WrongCodecKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["codecs"],
    WrongKindRegistrySources["codecs"]
  >
>;
type WrongResolverKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["resolvers"],
    WrongKindRegistrySources["resolvers"]
  >
>;
type WrongRemoteOperationKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["remoteOperations"],
    WrongKindRegistrySources["remoteOperations"]
  >
>;
type WrongRemoteDeliveryAdapterKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["remoteDeliveryAdapters"],
    WrongKindRegistrySources["remoteDeliveryAdapters"]
  >
>;
type WrongSubscriptionSourceKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["subscriptionSources"],
    WrongKindRegistrySources["subscriptionSources"]
  >
>;
type WrongBrandKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["brands"],
    WrongKindRegistrySources["brands"]
  >
>;
type WrongValueDomainKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["valueDomains"],
    WrongKindRegistrySources["valueDomains"]
  >
>;
type WrongPolicyKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["policies"],
    WrongKindRegistrySources["policies"]
  >
>;
type WrongHostProfileKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["hostProfiles"],
    WrongKindRegistrySources["hostProfiles"]
  >
>;
type WrongFailureSchemaKindIsRejected = ExpectFalse<
  Equal<
    ExecutionContractRegistrySources["failureSchemas"],
    WrongKindRegistrySources["failureSchemas"]
  >
>;

type MissingFieldIsRejected = ExpectFalse<
  Equal<
    Copy<ExecutionContractRegistrySources>,
    Copy<MissingFieldRegistrySources>
  >
>;
type MissingFieldWitness = ExpectFalse<
  "failureSchemas" extends keyof MissingFieldRegistrySources ? true : false
>;
type ExtraFieldIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractRegistrySources>, Copy<ExtraFieldRegistrySources>>
>;
type ExtraFieldWitness = ExpectTrue<
  "registryVersions" extends keyof ExtraFieldRegistrySources ? true : false
>;
type OptionalFieldIsRejected = ExpectFalse<
  Equal<
    Copy<ExecutionContractRegistrySources>,
    Copy<OptionalFieldRegistrySources>
  >
>;
type OptionalFieldWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalFieldRegistrySources>, "codecs">
>;
type MutableFieldIsRejected = ExpectFalse<
  Equal<
    Copy<ExecutionContractRegistrySources>,
    Copy<MutableFieldRegistrySources>
  >
>;
type MutableFieldWitness = ExpectFalse<
  "codecs" extends ReadonlyKeys<MutableFieldRegistrySources> ? true : false
>;
type MutableArrayIsRejected = ExpectFalse<
  Equal<
    Copy<ExecutionContractRegistrySources>,
    Copy<MutableArrayRegistrySources>
  >
>;
type MutableArrayWitness = ExpectTrue<
  MutableArrayRegistrySources["codecs"] extends unknown[] ? true : false
>;

type ExecutionContractRegistrySourcesTypeFixture = readonly [
  ContractHasExactShape,
  ContractHasExactKeys,
  ContractHasNoOptionalKeys,
  ContractHasOnlyReadonlyKeys,
  ContractHasOnlyReadonlyArrays,
  CodecsKindMapping,
  ResolversKindMapping,
  RemoteOperationsKindMapping,
  RemoteDeliveryAdaptersKindMapping,
  SubscriptionSourcesKindMapping,
  BrandsKindMapping,
  ValueDomainsKindMapping,
  PoliciesKindMapping,
  HostProfilesKindMapping,
  FailureSchemasKindMapping,
  WrongCodecKindIsRejected,
  WrongResolverKindIsRejected,
  WrongRemoteOperationKindIsRejected,
  WrongRemoteDeliveryAdapterKindIsRejected,
  WrongSubscriptionSourceKindIsRejected,
  WrongBrandKindIsRejected,
  WrongValueDomainKindIsRejected,
  WrongPolicyKindIsRejected,
  WrongHostProfileKindIsRejected,
  WrongFailureSchemaKindIsRejected,
  MissingFieldIsRejected,
  MissingFieldWitness,
  ExtraFieldIsRejected,
  ExtraFieldWitness,
  OptionalFieldIsRejected,
  OptionalFieldWitness,
  MutableFieldIsRejected,
  MutableFieldWitness,
  MutableArrayIsRejected,
  MutableArrayWitness,
];

export type { ExecutionContractRegistrySourcesTypeFixture };
