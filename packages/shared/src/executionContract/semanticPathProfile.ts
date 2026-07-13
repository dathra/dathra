import type { ClosedDataProfile } from "./closedDataWalker";
import type { ClosedContainerHeader } from "./closedDescriptor";
import type { ClosedDataOccurrence } from "./occurrencePlan";

type SemanticPathOccurrenceRole =
  | "other"
  | "source-root"
  | "facts"
  | "fact"
  | "subject"
  | "semantic-path";

function defineSemanticPathRole(
  roles: SemanticPathOccurrenceRole[],
  occurrenceId: number,
  role: SemanticPathOccurrenceRole,
): void {
  const defined = Reflect.defineProperty(roles, occurrenceId, {
    configurable: true,
    enumerable: true,
    value: role,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define SemanticPath role");
  }
}

function classifyOccurrence(
  occurrence: ClosedDataOccurrence,
  header: ClosedContainerHeader,
  roles: readonly SemanticPathOccurrenceRole[],
): SemanticPathOccurrenceRole {
  if (occurrence.parentOccurrenceId === null) {
    return header.kind === "record" ? "source-root" : "other";
  }

  const parentRole = roles[occurrence.parentOccurrenceId];
  if (
    parentRole === "source-root" &&
    occurrence.segment === "facts" &&
    header.kind === "array"
  ) {
    return "facts";
  }
  if (
    parentRole === "facts" &&
    typeof occurrence.segment === "number" &&
    header.kind === "record"
  ) {
    return "fact";
  }
  if (
    parentRole === "fact" &&
    occurrence.segment === "subject" &&
    header.kind === "record"
  ) {
    return "subject";
  }
  if (
    parentRole === "subject" &&
    occurrence.segment === "path" &&
    header.kind === "array"
  ) {
    return "semantic-path";
  }
  return "other";
}

/** Creates a fresh profile that precharges source fact semantic path segments. */
function createSemanticPathProfile(): ClosedDataProfile {
  const roles: SemanticPathOccurrenceRole[] = [];
  const profile: ClosedDataProfile = {
    beforeChildren() {},
    beforeDescriptors(occurrence, header, ledger) {
      const role = classifyOccurrence(occurrence, header, roles);
      defineSemanticPathRole(roles, occurrence.occurrenceId, role);
      if (role !== "semantic-path" || header.kind !== "array") return;

      ledger.chargeTotal(
        "maximumSemanticPathSegments",
        header.length,
        occurrence.path,
      );
    },
  };
  return Object.freeze(profile);
}

export { createSemanticPathProfile };
