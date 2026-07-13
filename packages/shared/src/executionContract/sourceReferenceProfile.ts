import type { BudgetLedger } from "./budget";
import type { ClosedDataProfile } from "./closedDataWalker";
import type {
  ClosedContainerHeader,
  ClosedContainerView,
} from "./closedDescriptor";
import type { ClosedDataOccurrence } from "./occurrencePlan";

type SourceReferenceRole =
  | "source"
  | "facts"
  | "fact"
  | "relations"
  | "relation"
  | "relation-endpoint"
  | "exports"
  | "export"
  | "transfer"
  | "reference-array"
  | "other";

function defineSourceReferenceRole(
  roles: SourceReferenceRole[],
  occurrenceId: number,
  role: SourceReferenceRole,
): void {
  const defined = Reflect.defineProperty(roles, occurrenceId, {
    configurable: true,
    enumerable: true,
    value: role,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define source reference role");
  }
}

function childRole(
  parentRole: SourceReferenceRole,
  segment: string | number,
): SourceReferenceRole {
  switch (parentRole) {
    case "source":
      if (segment === "facts") return "facts";
      if (segment === "relations") return "relations";
      if (segment === "exports") return "exports";
      if (segment === "hostAssumptionFactIds") return "reference-array";
      return "other";
    case "facts":
      return typeof segment === "number" ? "fact" : "other";
    case "fact":
      if (segment === "binding") return "transfer";
      if (
        segment === "hostProfileIds" ||
        segment === "sinkPolicyIds" ||
        segment === "capabilityPolicyIds"
      ) {
        return "reference-array";
      }
      return "other";
    case "relations":
      return typeof segment === "number" ? "relation" : "other";
    case "relation":
      return segment === "from" || segment === "to"
        ? "relation-endpoint"
        : "other";
    case "exports":
      return typeof segment === "string" ? "export" : "other";
    case "export":
      if (segment === "factIds") return "reference-array";
      if (segment === "transfer") return "transfer";
      return "other";
    case "other":
    case "reference-array":
    case "relation-endpoint":
    case "transfer":
      return "other";
  }
}

function isScalarReferenceSlot(
  role: SourceReferenceRole,
  key: string,
): boolean {
  switch (role) {
    case "fact":
      return (
        key === "environmentFactId" ||
        key === "exposureFactId" ||
        key === "receiverBrandId" ||
        key === "brandId" ||
        key === "schemaId" ||
        key === "audiencePolicyId" ||
        key === "releasePolicyId" ||
        key === "endorsementPolicyId"
      );
    case "relation-endpoint":
      return key === "factId";
    case "export":
      return key === "receiverBrandId" || key === "valueDomainId";
    case "transfer":
      return (
        key === "codecId" ||
        key === "resolverId" ||
        key === "capabilityPolicyId" ||
        key === "sourceId" ||
        key === "operationId"
      );
    case "exports":
    case "facts":
    case "other":
    case "reference-array":
    case "relation":
    case "relations":
    case "source":
      return false;
  }
}

/** Creates a fresh profile that charges source reference occurrences. */
function createSourceReferenceProfile(): ClosedDataProfile {
  const roles: SourceReferenceRole[] = [];

  function roleFor(occurrence: ClosedDataOccurrence): SourceReferenceRole {
    if (occurrence.parentOccurrenceId === null) return "source";
    if (occurrence.segment === null) return "other";
    return childRole(roles[occurrence.parentOccurrenceId], occurrence.segment);
  }

  function beforeDescriptors(
    occurrence: ClosedDataOccurrence,
    header: ClosedContainerHeader,
    ledger: BudgetLedger,
  ): void {
    const role = roleFor(occurrence);
    defineSourceReferenceRole(roles, occurrence.occurrenceId, role);
    if (role !== "reference-array" || header.kind !== "array") return;
    ledger.chargeTotal("maximumReferences", header.length, occurrence.path);
  }

  function beforeChildren(
    occurrence: ClosedDataOccurrence,
    view: ClosedContainerView,
    ledger: BudgetLedger,
  ): void {
    if (view.kind !== "record") return;
    const role = roles[occurrence.occurrenceId];
    for (let index = 0; index < view.entries.length; index += 1) {
      const key = view.entries[index][0];
      if (!isScalarReferenceSlot(role, key)) continue;
      ledger.chargeTotal("maximumReferences", 1, occurrence.childPath(key));
    }
  }

  return Object.freeze({ beforeDescriptors, beforeChildren });
}

export { createSourceReferenceProfile };
