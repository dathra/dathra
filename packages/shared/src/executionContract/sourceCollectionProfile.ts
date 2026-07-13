import type { ClosedDataProfile } from "./closedDataWalker";

type OccurrenceRole =
  | "root"
  | "facts"
  | "relations"
  | "exports"
  | "registries"
  | "registry-entries"
  | "registry-entry"
  | "registry-implementations"
  | "other";

function defineOccurrenceRole(
  roles: OccurrenceRole[],
  occurrenceId: number,
  role: OccurrenceRole,
): void {
  const defined = Reflect.defineProperty(roles, occurrenceId, {
    configurable: true,
    enumerable: true,
    value: role,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define source collection role");
  }
}

function registryCollectionRole(
  segment: string | number | null,
): OccurrenceRole {
  if (segment === null) return "other";
  switch (segment) {
    case "codecs":
    case "resolvers":
    case "remoteOperations":
    case "remoteDeliveryAdapters":
    case "subscriptionSources":
    case "brands":
    case "valueDomains":
    case "policies":
    case "hostProfiles":
    case "failureSchemas":
      return "registry-entries";
    default:
      return "other";
  }
}

function childRole(
  parentRole: OccurrenceRole,
  segment: string | number | null,
): OccurrenceRole {
  if (parentRole === "root") {
    if (segment === null) return "other";
    switch (segment) {
      case "facts":
        return "facts";
      case "relations":
        return "relations";
      case "exports":
        return "exports";
      case "registries":
        return "registries";
      default:
        return "other";
    }
  }

  if (parentRole === "registries") return registryCollectionRole(segment);
  if (parentRole === "registry-entries" && typeof segment === "number") {
    return "registry-entry";
  }
  if (parentRole === "registry-entry" && segment === "implementations") {
    return "registry-implementations";
  }
  return "other";
}

/** Creates a fresh source collection cardinality profile for one operation. */
function createSourceCollectionProfile(): ClosedDataProfile {
  const occurrenceRoles: OccurrenceRole[] = [];

  const profile: ClosedDataProfile = {
    beforeChildren() {},
    beforeDescriptors(occurrence, header, ledger) {
      const role =
        occurrence.parentOccurrenceId === null
          ? "root"
          : childRole(
              occurrenceRoles[occurrence.parentOccurrenceId] ?? "other",
              occurrence.segment,
            );
      defineOccurrenceRole(occurrenceRoles, occurrence.occurrenceId, role);

      if (header.kind === "array") {
        if (role === "facts") {
          ledger.chargeTotal("maximumFacts", header.length, occurrence.path);
          return;
        }
        if (role === "relations") {
          ledger.chargeTotal(
            "maximumRelations",
            header.length,
            occurrence.path,
          );
          return;
        }
        if (role === "registry-entries") {
          ledger.chargeTotal(
            "maximumRegistryEntries",
            header.length,
            occurrence.path,
          );
          return;
        }
        if (role === "registry-implementations") {
          ledger.chargeTotal(
            "maximumRegistryImplementations",
            header.length,
            occurrence.path,
          );
        }
        return;
      }

      if (role === "exports") {
        ledger.chargeTotal(
          "maximumExports",
          header.ownKeys.length,
          occurrence.path,
        );
      }
    },
  };
  return Object.freeze(profile);
}

export { createSourceCollectionProfile };
