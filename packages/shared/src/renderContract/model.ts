import type { Sha256Digest } from "../canonicalIdentity/implementation";

declare const renderDefinitionIdBrand: unique symbol;

/** A canonical digest in the render-definition identity domain. */
type RenderDefinitionId = Sha256Digest & {
  readonly [renderDefinitionIdBrand]: true;
};

/** Claims the observation contract referenced by a render definition. */
interface RenderObservationReferenceClaim {
  readonly schema: "dathra.render-definition-observation-reference/1";
  readonly role: "observation-contract";
  readonly claimedId: Sha256Digest;
}

/** Claims the response contribution set referenced by a render definition. */
interface RenderResponseReferenceClaim {
  readonly schema: "dathra.render-definition-response-reference/1";
  readonly role: "response-contribution-set";
  readonly claimedId: Sha256Digest;
}

/** Claims the ordered body plan referenced by a render definition. */
interface RenderBodyReferenceClaim {
  readonly schema: "dathra.render-definition-body-reference/1";
  readonly role: "ordered-body-plan";
  readonly claimedId: Sha256Digest;
}

/** Claims the exposure contract referenced by a render definition. */
interface RenderExposureReferenceClaim {
  readonly schema: "dathra.render-definition-exposure-reference/1";
  readonly role: "exposure-contract";
  readonly claimedId: Sha256Digest;
}

/** The versioned content preimage of a render definition. */
interface RenderDefinitionPreimage {
  readonly schema: "dathra.render-definition/1";
  readonly observationContract: RenderObservationReferenceClaim;
  readonly responseContributions: RenderResponseReferenceClaim;
  readonly orderedBodyPlan: RenderBodyReferenceClaim;
  readonly exposure: RenderExposureReferenceClaim;
}

/** A render definition paired with its content identity. */
interface RenderDefinition {
  readonly id: RenderDefinitionId;
  readonly preimage: RenderDefinitionPreimage;
}

/** Untrusted reference identifiers supplied to a render-definition creator. */
interface RenderDefinitionInput {
  readonly observationContractId: Sha256Digest;
  readonly responseContributionSetId: Sha256Digest;
  readonly orderedBodyPlanId: Sha256Digest;
  readonly exposureContractId: Sha256Digest;
}

export type {
  RenderDefinitionId,
  RenderObservationReferenceClaim,
  RenderResponseReferenceClaim,
  RenderBodyReferenceClaim,
  RenderExposureReferenceClaim,
  RenderDefinitionPreimage,
  RenderDefinition,
  RenderDefinitionInput,
};
