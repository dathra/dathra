import type { ClosedDataProfile } from "./closedDataWalker";
import { createSemanticPathProfile } from "./semanticPathProfile";
import { createSourceCollectionProfile } from "./sourceCollectionProfile";
import { createSourceReferenceProfile } from "./sourceReferenceProfile";

/** Creates a fresh execution-source profile for one walker operation. */
function createSourceProfile(): ClosedDataProfile {
  const collectionProfile = createSourceCollectionProfile();
  const referenceProfile = createSourceReferenceProfile();
  const semanticPathProfile = createSemanticPathProfile();

  const profile: ClosedDataProfile = {
    beforeChildren(occurrence, view, ledger) {
      collectionProfile.beforeChildren(occurrence, view, ledger);
      referenceProfile.beforeChildren(occurrence, view, ledger);
      semanticPathProfile.beforeChildren(occurrence, view, ledger);
    },
    beforeDescriptors(occurrence, header, ledger) {
      collectionProfile.beforeDescriptors(occurrence, header, ledger);
      referenceProfile.beforeDescriptors(occurrence, header, ledger);
      semanticPathProfile.beforeDescriptors(occurrence, header, ledger);
    },
  };
  return Object.freeze(profile);
}

export { createSourceProfile };
