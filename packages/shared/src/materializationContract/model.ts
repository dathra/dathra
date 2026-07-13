/**
 * Classifies a materialization mechanism by its direct result or governing contract.
 *
 * Membership does not establish placement, legality, equivalence, trust, client inclusion,
 * or the native closure of a target module or host binding.
 */
type MaterializationMechanismKind =
  | "inline"
  | "snapshot"
  | "target-native"
  | "codec"
  | "reference"
  | "subscription"
  | "remote";

export type { MaterializationMechanismKind };
