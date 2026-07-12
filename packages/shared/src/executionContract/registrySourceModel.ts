import type { RegistrySourceEntry } from "../executionRegistry/implementation";

/** The ten required source registry collections. */
interface ExecutionContractRegistrySources {
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
}

export type { ExecutionContractRegistrySources };
