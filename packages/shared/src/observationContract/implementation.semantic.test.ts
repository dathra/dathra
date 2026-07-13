import { describe, expect, it } from "vitest";

import {
  digestCanonicalJson,
  isSha256Digest,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import {
  createFinalizedRegistryCatalogRecord,
  createQualifiedRegistryId,
  deriveRegistryEnvironmentCatalogRecord,
  digestRegistryDescriptor,
  registryId,
  registryRoleInterfaceSchemaId,
  type QualifiedRegistryId,
  type RegistryEnvironmentCatalogRecord,
} from "../executionRegistry/implementation";
import {
  ObservationContractError,
  acceptObservationComposition,
  acceptObservationRelation,
  createCanonicalBaseUrlClaim,
  createCanonicalParserProfile,
  createObservationBehaviorDerivationClaim,
  createObservationBehaviorSummary,
  createObservationComparisonClaim,
  createObservationCompositionAlgebraDescriptor,
  createObservationPolicyDerivationClaim,
  createObservationComposition,
  createObservationCompositionBinding,
  createObservationCompositionClaim,
  createObservationCompositionPolicyApplication,
  createObservationCompositionPolicyDerivationClaim,
  createObservationCompositionRelationLanguage,
  createObservationCompositionRelationSymbol,
  createObservationConstraint,
  createObservationContract,
  createObservationInputClassDescriptor,
  createObservationInputLanguage,
  createObservationInputPartition,
  createObservationInputPartitionPolicyClaim,
  createObservationProofAcceptance,
  createObservationRefinementRule,
  createObservationRelationLanguage,
  createObservationRelationSymbol,
  createObservationRuleApplication,
  createObservationRulePolicyDescriptor,
  createObservationTraceLanguage,
  createObservationTraceSymbol,
  deriveAllowedObservationRelationLanguage,
  createRealizationCoverageClaim,
  createRealizationObligation,
  createRealizationSequenceClaim,
  createRealizationSequenceLanguage,
  createRealizationStep,
  createRealizationTemplateStepSymbol,
  createRealizationWitness,
  createRealizationWitnessTemplate,
  parseObservationProofAcceptance,
  parseObservationComposition,
  parseRealizationWitness,
  unionObservationInputLanguages,
  validateObservationBehaviorSummary,
  validateRealizationCoverageClaim,
  validateRealizationWitness,
  type ObservationAutomatonBudget,
  type ObservationBehaviorValidationInput,
  type ObservationContract,
  type ObservationContractErrorCode,
  type ObservationContractPathSegment,
  type ObservationInputClassDescriptor,
  type ObservationInputLanguage,
  type ObservationInputPartition,
  type ObservationTraceLanguage,
  type RealizationCoverageValidationInput,
} from "./implementation";

const EMPTY_SHA256 = "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU";

function requireDigest(value: string): Sha256Digest {
  if (!isSha256Digest(value))
    throw new Error(`Invalid fixture digest: ${value}`);
  return value;
}

const TEST_DIGEST = requireDigest(EMPTY_SHA256);

const TEST_BUDGET: ObservationAutomatonBudget = {
  maximumAlphabetSize: 64,
  maximumStateCount: 256,
  maximumTransitionCount: 16_384,
  maximumDeterminizedStateCount: 256,
  maximumProductStateCount: 65_536,
};

async function expectObservationError(
  operation: () => unknown,
  code: ObservationContractErrorCode,
  path?: readonly ObservationContractPathSegment[],
): Promise<ObservationContractError> {
  try {
    await operation();
  } catch (error) {
    if (!(error instanceof ObservationContractError)) throw error;
    if (error.code !== code) {
      throw new Error(`Expected error code ${code}, received ${error.code}`);
    }
    if (
      path !== undefined &&
      JSON.stringify(error.path) !== JSON.stringify(path)
    ) {
      throw new Error("Observation error path did not match the expected path");
    }
    return error;
  }
  throw new Error("Expected an ObservationContractError");
}

function createTrieInput<Symbol extends { readonly id: Sha256Digest }>(
  alphabet: readonly Symbol[],
  words: readonly (readonly Sha256Digest[])[],
) {
  const transitions = new Map<number, Map<Sha256Digest, number>>();
  const acceptingStates = new Set<number>();
  let stateCount = 1;
  for (const word of words) {
    let state = 0;
    for (const symbolId of word) {
      let outgoing = transitions.get(state);
      if (outgoing === undefined) {
        outgoing = new Map();
        transitions.set(state, outgoing);
      }
      let target = outgoing.get(symbolId);
      if (target === undefined) {
        target = stateCount;
        stateCount += 1;
        outgoing.set(symbolId, target);
      }
      state = target;
    }
    acceptingStates.add(state);
  }
  return {
    alphabet,
    stateCount,
    initialState: 0,
    acceptingStates: [...acceptingStates],
    transitions: [...transitions].flatMap(([fromState, outgoing]) =>
      [...outgoing].map(([symbolId, toState]) => ({
        fromState,
        symbolId,
        toState,
      })),
    ),
  };
}

async function createHostCatalog(): Promise<{
  readonly hostProfileId: QualifiedRegistryId<"host-profile">;
  readonly catalog: RegistryEnvironmentCatalogRecord;
}> {
  const hostProfileId = await createQualifiedRegistryId(
    TEST_DIGEST,
    "host-profile",
    registryId("host-profile", "browser.default"),
  );
  const descriptor = {
    schema: "dathra.registry/1",
    kind: "host-profile",
    id: hostProfileId,
    version: "1",
    featureSetDigest: TEST_DIGEST,
  } as const;
  const descriptorDigest = await digestRegistryDescriptor(descriptor);
  const catalog = await createFinalizedRegistryCatalogRecord({
    schema: "dathra.finalized-registry-catalog/1",
    symbolicUniverseDigest: TEST_DIGEST,
    registries: [
      {
        qualifiedId: hostProfileId,
        contractNamespaceId: TEST_DIGEST,
        kind: "host-profile",
        version: "1",
        descriptor,
        descriptorDigest,
        roleRequirements: [
          {
            registryKind: "host-profile",
            environment: "browser",
            role: "host-profile-validate",
            requirement: "required",
            reasonDefinitionIds: ["root"],
          },
        ],
        implementationBindings: [
          {
            registryKind: "host-profile",
            environment: "browser",
            role: "host-profile-validate",
            artifactAddressId: "artifact:host-profile",
            exportName: "validateHostProfile",
            interfaceSchemaId: registryRoleInterfaceSchemaId(
              "host-profile-validate",
            ),
          },
        ],
        dependencyBindings: [],
        protocolBindings: [],
      },
    ],
  });
  return {
    hostProfileId,
    catalog: await deriveRegistryEnvironmentCatalogRecord(
      catalog,
      "browser",
      TEST_DIGEST,
    ),
  };
}

interface InputPartitionFixture {
  readonly universe: ObservationInputLanguage;
  readonly selector: ObservationInputLanguage;
  readonly descriptor: ObservationInputClassDescriptor;
  readonly partition: ObservationInputPartition;
  readonly policyClaim: Awaited<
    ReturnType<typeof createObservationInputPartitionPolicyClaim>
  >;
  readonly policyAcceptance: Awaited<
    ReturnType<typeof createObservationProofAcceptance>
  >;
}

async function createSingleClassInputPartition(): Promise<InputPartitionFixture> {
  const epsilonInput = {
    alphabet: [],
    stateCount: 1,
    initialState: 0,
    acceptingStates: [0],
    transitions: [],
  } as const;
  const universe = await createObservationInputLanguage(
    epsilonInput,
    TEST_BUDGET,
  );
  const selector = await createObservationInputLanguage(
    epsilonInput,
    TEST_BUDGET,
  );
  const descriptor = await createObservationInputClassDescriptor({
    externalInputIdentitySchemaId: "input/1",
    eventIdentitySchemaId: "event/1",
    initialCutId: "initial",
    selectorLanguageId: selector.id,
  });
  const partition = await createObservationInputPartition({
    externalInputIdentitySchemaId: "input/1",
    eventIdentitySchemaId: "event/1",
    initialCutId: "initial",
    universeLanguageId: universe.id,
    inputClasses: [descriptor],
  });
  const policyClaim = await createObservationInputPartitionPolicyClaim({
    inputPartitionId: partition.id,
    universeLanguageId: universe.id,
    inputClassIds: [descriptor.id],
    proofDomainId: TEST_DIGEST,
  });
  const policyAcceptance = await createObservationProofAcceptance({
    proofDomainId: TEST_DIGEST,
    claimDigest: policyClaim.id,
    attestationDigest: TEST_DIGEST,
  });
  return {
    universe,
    selector,
    descriptor,
    partition,
    policyClaim,
    policyAcceptance,
  };
}

async function createTerminalContract(): Promise<{
  readonly contract: ObservationContract;
  readonly terminalConstraintId: Sha256Digest;
}> {
  const terminal = await createObservationConstraint({
    kind: "terminal",
    subjectId: "root.terminal",
    visibility: "external",
    outcomes: ["success"],
  });
  const contract = await createObservationContract({
    rootDefinitionId: "root",
    externalInputIdentitySchemaId: "input/1",
    eventIdentitySchemaId: "event/1",
    initialCutId: "initial",
    relation: "trace-equality",
    constraints: [terminal],
    orderEdges: [],
    refinementRules: [],
  });
  return { contract, terminalConstraintId: terminal.id };
}

async function createBehaviorValidationFixture(
  terminalOrdinal = 0,
): Promise<ObservationBehaviorValidationInput> {
  const { contract, terminalConstraintId } = await createTerminalContract();
  const input = await createSingleClassInputPartition();
  const terminal = await createObservationTraceSymbol({
    kind: "terminal",
    constraintId: terminalConstraintId,
    occurrenceOrdinal: terminalOrdinal,
    outcome: "success",
  });
  const traceLanguage = await createObservationTraceLanguage(
    createTrieInput([terminal], [[terminal.id]]),
    TEST_BUDGET,
  );
  const summary = await createObservationBehaviorSummary({
    role: "candidate",
    observationContractId: contract.id,
    semanticGraphDigest: await digestCanonicalJson({ graph: "candidate" }),
    inputPartitionId: input.partition.id,
    inputClasses: [
      {
        inputClassId: input.descriptor.id,
        traceLanguageId: traceLanguage.id,
      },
    ],
  });
  const derivationClaim = await createObservationBehaviorDerivationClaim({
    behaviorSummaryId: summary.id,
    observationContractId: contract.id,
    semanticGraphDigest: summary.preimage.semanticGraphDigest,
    inputPartitionId: input.partition.id,
    proofDomainId: TEST_DIGEST,
  });
  const derivationAcceptance = await createObservationProofAcceptance({
    proofDomainId: TEST_DIGEST,
    claimDigest: derivationClaim.id,
    attestationDigest: TEST_DIGEST,
  });
  return {
    contract,
    summary,
    inputPartition: input.partition,
    inputLanguages: [input.universe, input.selector],
    traceLanguages: [traceLanguage],
    partitionPolicyClaim: input.policyClaim,
    behaviorDerivationClaim: derivationClaim,
    proofAcceptances: [input.policyAcceptance, derivationAcceptance],
    trustedProofAcceptanceIds: [
      input.policyAcceptance.id,
      derivationAcceptance.id,
    ],
    budget: TEST_BUDGET,
  };
}

async function createAcceptedBehaviorForTrace(
  contract: ObservationContract,
  input: InputPartitionFixture,
  traceLanguage: ObservationTraceLanguage,
  role: "source" | "candidate",
  graphName: string,
) {
  const summary = await createObservationBehaviorSummary({
    role,
    observationContractId: contract.id,
    semanticGraphDigest: await digestCanonicalJson({ graph: graphName }),
    inputPartitionId: input.partition.id,
    inputClasses: [
      {
        inputClassId: input.descriptor.id,
        traceLanguageId: traceLanguage.id,
      },
    ],
  });
  const derivationClaim = await createObservationBehaviorDerivationClaim({
    behaviorSummaryId: summary.id,
    observationContractId: contract.id,
    semanticGraphDigest: summary.preimage.semanticGraphDigest,
    inputPartitionId: input.partition.id,
    proofDomainId: TEST_DIGEST,
  });
  const derivationAcceptance = await createObservationProofAcceptance({
    proofDomainId: TEST_DIGEST,
    claimDigest: derivationClaim.id,
    attestationDigest: TEST_DIGEST,
  });
  const validationInput: ObservationBehaviorValidationInput = {
    contract,
    summary,
    inputPartition: input.partition,
    inputLanguages: [input.universe, input.selector],
    traceLanguages: [traceLanguage],
    partitionPolicyClaim: input.policyClaim,
    behaviorDerivationClaim: derivationClaim,
    proofAcceptances: [input.policyAcceptance, derivationAcceptance],
    trustedProofAcceptanceIds: [
      input.policyAcceptance.id,
      derivationAcceptance.id,
    ],
    budget: TEST_BUDGET,
  };
  return {
    summary,
    validationInput,
    accepted: await validateObservationBehaviorSummary(validationInput),
  };
}

describe("semantic behavior validation", () => {
  it("accepts a closed, exhaustive input partition and contract-conformant behavior", async () => {
    const input = await createBehaviorValidationFixture();
    const accepted = await validateObservationBehaviorSummary(input);
    expect(accepted.preimage.behaviorSummaryId).toBe(input.summary.id);
    expect(accepted.preimage.inputPartitionId).toBe(input.inputPartition.id);
    expect(accepted.id).toBe(await digestCanonicalJson(accepted.preimage));

    const union = await unionObservationInputLanguages(
      [input.inputLanguages[1]],
      TEST_BUDGET,
    );
    expect(union).toEqual(input.inputLanguages[0]);
    expect(
      await parseObservationProofAcceptance(input.proofAcceptances[0]),
    ).toEqual(input.proofAcceptances[0]);
  });

  it("rejects an input partition that does not cover its universe", async () => {
    const event = await createObservationTraceSymbol({
      kind: "event",
      identityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
    });
    if (event.kind !== "event") throw new Error("Expected an event fixture");
    const universe = await createObservationInputLanguage(
      createTrieInput([event], [[], [event.id]]),
      TEST_BUDGET,
    );
    const selector = await createObservationInputLanguage(
      createTrieInput([], [[]]),
      TEST_BUDGET,
    );
    const descriptor = await createObservationInputClassDescriptor({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      selectorLanguageId: selector.id,
    });
    const partition = await createObservationInputPartition({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      universeLanguageId: universe.id,
      inputClasses: [descriptor],
    });
    const valid = await createBehaviorValidationFixture();
    const policyClaim = await createObservationInputPartitionPolicyClaim({
      inputPartitionId: partition.id,
      universeLanguageId: universe.id,
      inputClassIds: [descriptor.id],
      proofDomainId: TEST_DIGEST,
    });
    const policyAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: policyClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const summary = await createObservationBehaviorSummary({
      role: "candidate",
      observationContractId: valid.contract.id,
      semanticGraphDigest: valid.summary.preimage.semanticGraphDigest,
      inputPartitionId: partition.id,
      inputClasses: [
        {
          inputClassId: descriptor.id,
          traceLanguageId: valid.traceLanguages[0].id,
        },
      ],
    });
    const derivationClaim = await createObservationBehaviorDerivationClaim({
      behaviorSummaryId: summary.id,
      observationContractId: valid.contract.id,
      semanticGraphDigest: summary.preimage.semanticGraphDigest,
      inputPartitionId: partition.id,
      proofDomainId: TEST_DIGEST,
    });
    const derivationAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: derivationClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    await expectObservationError(async () => {
      await validateObservationBehaviorSummary({
        ...valid,
        summary,
        inputPartition: partition,
        inputLanguages: [universe, selector],
        partitionPolicyClaim: policyClaim,
        behaviorDerivationClaim: derivationClaim,
        proofAcceptances: [policyAcceptance, derivationAcceptance],
        trustedProofAcceptanceIds: [
          policyAcceptance.id,
          derivationAcceptance.id,
        ],
      });
    }, "language-mismatch");
  });

  it("rejects a contract-invalid occurrence ordinal after DFA creation", async () => {
    const input = await createBehaviorValidationFixture(1);
    await expectObservationError(async () => {
      await validateObservationBehaviorSummary(input);
    }, "invalid-cardinality");
  });

  it("re-digests a trusted proof record before consulting its trusted ID", async () => {
    const input = await createBehaviorValidationFixture();
    const original = input.proofAcceptances[0];
    const forged = {
      ...original,
      preimage: {
        ...original.preimage,
        claimDigest: TEST_DIGEST,
      },
    };
    await expectObservationError(async () => {
      await validateObservationBehaviorSummary({
        ...input,
        proofAcceptances: [forged, input.proofAcceptances[1]],
      });
    }, "digest-mismatch");
    await expectObservationError(async () => {
      await validateObservationBehaviorSummary({
        ...input,
        proofAcceptances: [
          input.proofAcceptances[0],
          input.proofAcceptances[0],
          input.proofAcceptances[1],
        ],
      });
    }, "duplicate-record");
    const alternate = await createObservationProofAcceptance({
      proofDomainId: original.preimage.proofDomainId,
      claimDigest: original.preimage.claimDigest,
      attestationDigest: await digestCanonicalJson("alternate-attestation"),
    });
    await expectObservationError(async () => {
      await validateObservationBehaviorSummary({
        ...input,
        proofAcceptances: [original, alternate, input.proofAcceptances[1]],
        trustedProofAcceptanceIds: [
          original.id,
          alternate.id,
          input.proofAcceptances[1].id,
        ],
      });
    }, "ambiguous-proof");
  });
});

async function createEquivalentRelationFixture() {
  const value = await createObservationConstraint({
    kind: "value",
    subjectId: "value",
    visibility: "external",
    equivalenceDomainId: "value/1",
    consistencyCutId: "cut",
  });
  const dom = await createObservationConstraint({
    kind: "dom",
    subjectId: "dom",
    visibility: "external",
    realizationDomainId: "dom/1",
    mutableFacetPolicyId: "immutable",
    consistencyCutId: "cut",
  });
  const rule = await createObservationRefinementRule({
    kind: "equivalent-value",
    constraintIds: [value.id],
    proofDomainId: TEST_DIGEST,
  });
  const contract = await createObservationContract({
    rootDefinitionId: "root",
    externalInputIdentitySchemaId: "input/1",
    eventIdentitySchemaId: "event/1",
    initialCutId: "initial",
    relation: "trace-refinement",
    constraints: [value, dom],
    orderEdges: [],
    refinementRules: [rule],
  });
  const input = await createSingleClassInputPartition();
  const sourceSymbol = await createObservationTraceSymbol({
    kind: "occurrence",
    constraintId: value.id,
    occurrenceIdentityDomainDigest: TEST_DIGEST,
    occurrenceOrdinal: 0,
    observationTokenRelationDigest: await digestCanonicalJson("source"),
    inputEventSymbolIds: [],
  });
  const candidateSymbol = await createObservationTraceSymbol({
    kind: "occurrence",
    constraintId: value.id,
    occurrenceIdentityDomainDigest: TEST_DIGEST,
    occurrenceOrdinal: 0,
    observationTokenRelationDigest: await digestCanonicalJson("candidate"),
    inputEventSymbolIds: [],
  });
  const domSymbol = await createObservationTraceSymbol({
    kind: "occurrence",
    constraintId: dom.id,
    occurrenceIdentityDomainDigest: TEST_DIGEST,
    occurrenceOrdinal: 0,
    observationTokenRelationDigest: await digestCanonicalJson("dom"),
    inputEventSymbolIds: [],
  });
  const sourceLanguage = await createObservationTraceLanguage(
    createTrieInput(
      [sourceSymbol, domSymbol],
      [[sourceSymbol.id, domSymbol.id]],
    ),
    TEST_BUDGET,
  );
  const candidateLanguage = await createObservationTraceLanguage(
    createTrieInput(
      [candidateSymbol, domSymbol],
      [[candidateSymbol.id, domSymbol.id]],
    ),
    TEST_BUDGET,
  );
  const source = await createAcceptedBehaviorForTrace(
    contract,
    input,
    sourceLanguage,
    "source",
    "source",
  );
  const candidate = await createAcceptedBehaviorForTrace(
    contract,
    input,
    candidateLanguage,
    "candidate",
    "candidate",
  );
  const relationSymbol = await createObservationRelationSymbol({
    sourceSymbolId: sourceSymbol.id,
    candidateSymbolId: candidateSymbol.id,
    ruleId: rule.id,
  });
  const domRelationSymbol = await createObservationRelationSymbol({
    sourceSymbolId: domSymbol.id,
    candidateSymbolId: domSymbol.id,
    ruleId: null,
  });
  const actualRelation = await createObservationRelationLanguage(
    createTrieInput(
      [relationSymbol, domRelationSymbol],
      [[relationSymbol.id, domRelationSymbol.id]],
    ),
    TEST_BUDGET,
  );
  const application = await createObservationRuleApplication({
    kind: "equivalent-value",
    ruleId: rule.id,
    sourceSummaryId: source.summary.id,
    candidateSummaryId: candidate.summary.id,
    inputClassId: input.descriptor.id,
    proofDomainId: TEST_DIGEST,
    allowedTokenPairs: [
      {
        sourceSymbolId: sourceSymbol.id,
        candidateSymbolId: candidateSymbol.id,
      },
    ],
  });
  const applicationAcceptance = await createObservationProofAcceptance({
    proofDomainId: TEST_DIGEST,
    claimDigest: application.id,
    attestationDigest: TEST_DIGEST,
  });
  const claim = await createObservationComparisonClaim({
    observationContractId: contract.id,
    compositionId: null,
    sourceSummaryId: source.summary.id,
    candidateSummaryId: candidate.summary.id,
    inputClasses: [
      {
        inputClassId: input.descriptor.id,
        actualRelationLanguageId: actualRelation.id,
        ruleApplicationIds: [application.id],
        ruleApplicationAcceptanceIds: [applicationAcceptance.id],
      },
    ],
  });
  return {
    value,
    dom,
    rule,
    contract,
    input,
    sourceSymbol,
    candidateSymbol,
    domSymbol,
    sourceLanguage,
    candidateLanguage,
    source,
    candidate,
    relationSymbol,
    actualRelation,
    application,
    applicationAcceptance,
    claim,
  };
}

describe("derived observation relation", () => {
  it("derives A from local rule mappings and accepts R without caller-supplied A", async () => {
    const fixture = await createEquivalentRelationFixture();
    const acceptanceInput = {
      claim: fixture.claim,
      contract: fixture.contract,
      sourceBehavior: fixture.source.validationInput,
      candidateBehavior: fixture.candidate.validationInput,
      traceLanguages: [fixture.sourceLanguage, fixture.candidateLanguage],
      actualRelationLanguages: [fixture.actualRelation],
      ruleApplications: [fixture.application],
      policyDescriptors: [],
      policyDerivationClaims: [],
      policyTransducerLanguages: [],
      compositionContexts: [],
      proofAcceptances: [fixture.applicationAcceptance],
      trustedProofAcceptanceIds: [fixture.applicationAcceptance.id],
      budget: TEST_BUDGET,
    } as const;
    const accepted = await acceptObservationRelation(acceptanceInput);
    expect(accepted.preimage.comparisonClaimId).toBe(fixture.claim.id);
    expect(
      accepted.preimage.inputClasses[0].derivedAllowedRelationLanguageId,
    ).toMatch(/^sha-256:/u);
    await expectObservationError(async () => {
      await acceptObservationRelation({
        ...acceptanceInput,
        ruleApplications: [fixture.application, fixture.application],
      });
    }, "duplicate-record");
    const unboundCompositionClaim = await createObservationComparisonClaim({
      observationContractId: fixture.contract.id,
      compositionId: TEST_DIGEST,
      sourceSummaryId: fixture.source.summary.id,
      candidateSummaryId: fixture.candidate.summary.id,
      inputClasses: fixture.claim.preimage.inputClasses,
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        ...acceptanceInput,
        claim: unboundCompositionClaim,
      });
    }, "contract-mismatch");
  });

  it("rejects behaviors accepted under a different relation contract", async () => {
    const fixture = await createEquivalentRelationFixture();
    const foreignContract = await createObservationContract({
      rootDefinitionId: "foreign-equivalent-value",
      externalInputIdentitySchemaId:
        fixture.contract.preimage.externalInputIdentitySchemaId,
      eventIdentitySchemaId: fixture.contract.preimage.eventIdentitySchemaId,
      initialCutId: fixture.contract.preimage.initialCutId,
      relation: "trace-refinement",
      constraints: fixture.contract.preimage.constraints,
      orderEdges: fixture.contract.preimage.orderEdges,
      refinementRules: fixture.contract.preimage.refinementRules,
    });
    const source = await createAcceptedBehaviorForTrace(
      foreignContract,
      fixture.input,
      fixture.sourceLanguage,
      "source",
      "foreign-source",
    );
    const candidate = await createAcceptedBehaviorForTrace(
      foreignContract,
      fixture.input,
      fixture.candidateLanguage,
      "candidate",
      "foreign-candidate",
    );
    const application = await createObservationRuleApplication({
      kind: "equivalent-value",
      ruleId: fixture.rule.id,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClassId: fixture.input.descriptor.id,
      proofDomainId: TEST_DIGEST,
      allowedTokenPairs: [
        {
          sourceSymbolId: fixture.sourceSymbol.id,
          candidateSymbolId: fixture.candidateSymbol.id,
        },
      ],
    });
    const applicationAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: application.id,
      attestationDigest: TEST_DIGEST,
    });
    const claim = await createObservationComparisonClaim({
      observationContractId: fixture.contract.id,
      compositionId: null,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClasses: [
        {
          inputClassId: fixture.input.descriptor.id,
          actualRelationLanguageId: fixture.actualRelation.id,
          ruleApplicationIds: [application.id],
          ruleApplicationAcceptanceIds: [applicationAcceptance.id],
        },
      ],
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        claim,
        contract: fixture.contract,
        sourceBehavior: source.validationInput,
        candidateBehavior: candidate.validationInput,
        traceLanguages: [fixture.sourceLanguage, fixture.candidateLanguage],
        actualRelationLanguages: [fixture.actualRelation],
        ruleApplications: [application],
        policyDescriptors: [],
        policyDerivationClaims: [],
        policyTransducerLanguages: [],
        compositionContexts: [],
        proofAcceptances: [applicationAcceptance],
        trustedProofAcceptanceIds: [applicationAcceptance.id],
        budget: TEST_BUDGET,
      });
    }, "contract-mismatch");
  });

  it("rejects a comparison claim that omits an accepted input class", async () => {
    const inputEvent = await createObservationTraceSymbol({
      kind: "event",
      identityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
    });
    if (inputEvent.kind !== "event") throw new Error("Expected input event");
    const universe = await createObservationInputLanguage(
      createTrieInput([inputEvent], [[], [inputEvent.id]]),
      TEST_BUDGET,
    );
    const emptySelector = await createObservationInputLanguage(
      createTrieInput([], [[]]),
      TEST_BUDGET,
    );
    const eventSelector = await createObservationInputLanguage(
      createTrieInput([inputEvent], [[inputEvent.id]]),
      TEST_BUDGET,
    );
    const emptyClass = await createObservationInputClassDescriptor({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      selectorLanguageId: emptySelector.id,
    });
    const eventClass = await createObservationInputClassDescriptor({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      selectorLanguageId: eventSelector.id,
    });
    const partition = await createObservationInputPartition({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      universeLanguageId: universe.id,
      inputClasses: [emptyClass, eventClass],
    });
    const partitionPolicyClaim =
      await createObservationInputPartitionPolicyClaim({
        inputPartitionId: partition.id,
        universeLanguageId: universe.id,
        inputClassIds: [emptyClass.id, eventClass.id],
        proofDomainId: TEST_DIGEST,
      });
    const partitionAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: partitionPolicyClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const constraint = await createObservationConstraint({
      kind: "dom",
      subjectId: "root",
      visibility: "external",
      realizationDomainId: "dom/1",
      mutableFacetPolicyId: "immutable",
      consistencyCutId: "cut",
    });
    const contract = await createObservationContract({
      rootDefinitionId: "two-input-classes",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [constraint],
      orderEdges: [],
      refinementRules: [],
    });
    const emptyOccurrence = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: constraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("empty"),
      inputEventSymbolIds: [],
    });
    const eventOccurrence = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: constraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("event"),
      inputEventSymbolIds: [inputEvent.id],
    });
    const emptyTrace = await createObservationTraceLanguage(
      createTrieInput([emptyOccurrence], [[emptyOccurrence.id]]),
      TEST_BUDGET,
    );
    const eventTrace = await createObservationTraceLanguage(
      createTrieInput(
        [inputEvent, eventOccurrence],
        [[inputEvent.id, eventOccurrence.id]],
      ),
      TEST_BUDGET,
    );
    const createBehavior = async (role: "source" | "candidate") => {
      const summary = await createObservationBehaviorSummary({
        role,
        observationContractId: contract.id,
        semanticGraphDigest: await digestCanonicalJson({ graph: role }),
        inputPartitionId: partition.id,
        inputClasses: [
          { inputClassId: emptyClass.id, traceLanguageId: emptyTrace.id },
          { inputClassId: eventClass.id, traceLanguageId: eventTrace.id },
        ],
      });
      const derivationClaim = await createObservationBehaviorDerivationClaim({
        behaviorSummaryId: summary.id,
        observationContractId: contract.id,
        semanticGraphDigest: summary.preimage.semanticGraphDigest,
        inputPartitionId: partition.id,
        proofDomainId: TEST_DIGEST,
      });
      const derivationAcceptance = await createObservationProofAcceptance({
        proofDomainId: TEST_DIGEST,
        claimDigest: derivationClaim.id,
        attestationDigest: TEST_DIGEST,
      });
      const validationInput: ObservationBehaviorValidationInput = {
        contract,
        summary,
        inputPartition: partition,
        inputLanguages: [universe, emptySelector, eventSelector],
        traceLanguages: [emptyTrace, eventTrace],
        partitionPolicyClaim,
        behaviorDerivationClaim: derivationClaim,
        proofAcceptances: [partitionAcceptance, derivationAcceptance],
        trustedProofAcceptanceIds: [
          partitionAcceptance.id,
          derivationAcceptance.id,
        ],
        budget: TEST_BUDGET,
      };
      await validateObservationBehaviorSummary(validationInput);
      return { summary, validationInput };
    };
    const source = await createBehavior("source");
    const candidate = await createBehavior("candidate");
    const emptyRelationSymbol = await createObservationRelationSymbol({
      sourceSymbolId: emptyOccurrence.id,
      candidateSymbolId: emptyOccurrence.id,
      ruleId: null,
    });
    const emptyRelation = await createObservationRelationLanguage(
      createTrieInput([emptyRelationSymbol], [[emptyRelationSymbol.id]]),
      TEST_BUDGET,
    );
    const claim = await createObservationComparisonClaim({
      observationContractId: contract.id,
      compositionId: null,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClasses: [
        {
          inputClassId: emptyClass.id,
          actualRelationLanguageId: emptyRelation.id,
          ruleApplicationIds: [],
          ruleApplicationAcceptanceIds: [],
        },
      ],
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        claim,
        contract,
        sourceBehavior: source.validationInput,
        candidateBehavior: candidate.validationInput,
        traceLanguages: [emptyTrace, eventTrace],
        actualRelationLanguages: [emptyRelation],
        ruleApplications: [],
        policyDescriptors: [],
        policyDerivationClaims: [],
        policyTransducerLanguages: [],
        compositionContexts: [],
        proofAcceptances: [],
        trustedProofAcceptanceIds: [],
        budget: TEST_BUDGET,
      });
    }, "contract-mismatch");
  });

  it("rejects caller-supplied A and mappings outside the compared alphabets", async () => {
    const fixture = await createEquivalentRelationFixture();
    const callerSelectedClaim = {
      observationContractId: fixture.contract.id,
      compositionId: null,
      sourceSummaryId: fixture.source.summary.id,
      candidateSummaryId: fixture.candidate.summary.id,
      inputClasses: [
        {
          inputClassId: fixture.input.descriptor.id,
          actualRelationLanguageId: fixture.actualRelation.id,
          allowedRelationLanguageId: fixture.actualRelation.id,
          ruleApplicationIds: [fixture.application.id],
          ruleApplicationAcceptanceIds: [fixture.applicationAcceptance.id],
        },
      ],
    };
    await expectObservationError(async () => {
      await createObservationComparisonClaim(callerSelectedClaim);
    }, "invalid-field");

    const invalidApplication = await createObservationRuleApplication({
      kind: "equivalent-value",
      ruleId: fixture.rule.id,
      sourceSummaryId: fixture.source.summary.id,
      candidateSummaryId: fixture.candidate.summary.id,
      inputClassId: fixture.input.descriptor.id,
      proofDomainId: TEST_DIGEST,
      allowedTokenPairs: [
        {
          sourceSymbolId: fixture.sourceSymbol.id,
          candidateSymbolId: TEST_DIGEST,
        },
      ],
    });
    const invalidAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: invalidApplication.id,
      attestationDigest: TEST_DIGEST,
    });
    const invalidClaim = await createObservationComparisonClaim({
      observationContractId: fixture.contract.id,
      compositionId: null,
      sourceSummaryId: fixture.source.summary.id,
      candidateSummaryId: fixture.candidate.summary.id,
      inputClasses: [
        {
          inputClassId: fixture.input.descriptor.id,
          actualRelationLanguageId: fixture.actualRelation.id,
          ruleApplicationIds: [invalidApplication.id],
          ruleApplicationAcceptanceIds: [invalidAcceptance.id],
        },
      ],
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        claim: invalidClaim,
        contract: fixture.contract,
        sourceBehavior: fixture.source.validationInput,
        candidateBehavior: fixture.candidate.validationInput,
        traceLanguages: [fixture.sourceLanguage, fixture.candidateLanguage],
        actualRelationLanguages: [fixture.actualRelation],
        ruleApplications: [invalidApplication],
        policyDescriptors: [],
        policyDerivationClaims: [],
        policyTransducerLanguages: [],
        compositionContexts: [],
        proofAcceptances: [invalidAcceptance],
        trustedProofAcceptanceIds: [invalidAcceptance.id],
        budget: TEST_BUDGET,
      });
    }, "invalid-refinement");
  });

  it("requires the complete policy proof DAG before using a coalescing transducer", async () => {
    const policyQualifiedId = await createQualifiedRegistryId(
      TEST_DIGEST,
      "policy",
      registryId("policy", "coalesce.latest"),
    );
    const policyRuleGraphDigest = await digestCanonicalJson({
      operation: "coalesce-latest",
      version: "1",
    });
    const constraint = await createObservationConstraint({
      kind: "event",
      subjectId: "input.change",
      visibility: "external",
      inputIdentityDomainId: "event.input/1",
      occurrenceIdentityDomainId: "event.occurrence/1",
      cardinality: { kind: "range", minimum: 0, maximum: 1 },
      admissionCutId: "initial",
      coalescingPolicyRequirement: {
        policyQualifiedId,
        version: "1",
        policyRuleGraphDigest,
        proofDomainId: TEST_DIGEST,
      },
    });
    const rule = await createObservationRefinementRule({
      kind: "declared-event-coalescing",
      constraintIds: [constraint.id],
      proofDomainId: TEST_DIGEST,
    });
    const contract = await createObservationContract({
      rootDefinitionId: "coalescing",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [constraint],
      orderEdges: [],
      refinementRules: [rule],
    });
    const event = await createObservationTraceSymbol({
      kind: "event",
      identityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
    });
    if (event.kind !== "event") throw new Error("Expected an event fixture");
    const occurrence = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: constraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [event.id],
    });
    const inputLanguage = await createObservationInputLanguage(
      createTrieInput([event], [[event.id]]),
      TEST_BUDGET,
    );
    const descriptor = await createObservationInputClassDescriptor({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      selectorLanguageId: inputLanguage.id,
    });
    const partition = await createObservationInputPartition({
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      universeLanguageId: inputLanguage.id,
      inputClasses: [descriptor],
    });
    const partitionPolicyClaim =
      await createObservationInputPartitionPolicyClaim({
        inputPartitionId: partition.id,
        universeLanguageId: inputLanguage.id,
        inputClassIds: [descriptor.id],
        proofDomainId: TEST_DIGEST,
      });
    const partitionPolicyAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: partitionPolicyClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const input: InputPartitionFixture = {
      universe: inputLanguage,
      selector: inputLanguage,
      descriptor,
      partition,
      policyClaim: partitionPolicyClaim,
      policyAcceptance: partitionPolicyAcceptance,
    };
    const sourceLanguage = await createObservationTraceLanguage(
      createTrieInput([event], [[event.id]]),
      TEST_BUDGET,
    );
    const candidateLanguage = await createObservationTraceLanguage(
      createTrieInput([event, occurrence], [[event.id, occurrence.id]]),
      TEST_BUDGET,
    );
    const source = await createAcceptedBehaviorForTrace(
      contract,
      input,
      sourceLanguage,
      "source",
      "coalescing-source",
    );
    const candidate = await createAcceptedBehaviorForTrace(
      contract,
      input,
      candidateLanguage,
      "candidate",
      "coalescing-candidate",
    );
    const identitySymbol = await createObservationRelationSymbol({
      sourceSymbolId: event.id,
      candidateSymbolId: event.id,
      ruleId: null,
    });
    const policySymbol = await createObservationRelationSymbol({
      sourceSymbolId: null,
      candidateSymbolId: occurrence.id,
      ruleId: rule.id,
    });
    const policyLanguage = await createObservationRelationLanguage(
      createTrieInput([policySymbol], [[policySymbol.id]]),
      TEST_BUDGET,
    );
    const actualRelation = await createObservationRelationLanguage(
      createTrieInput(
        [identitySymbol, policySymbol],
        [[identitySymbol.id, policySymbol.id]],
      ),
      TEST_BUDGET,
    );
    const policyDescriptor = await createObservationRulePolicyDescriptor({
      observationContractId: contract.id,
      ruleId: rule.id,
      inputClassId: descriptor.id,
      sourceTraceLanguageId: sourceLanguage.id,
      candidateTraceLanguageId: candidateLanguage.id,
      policyQualifiedId,
      version: "1",
      policyRuleGraphDigest,
      policyTransducerLanguageId: policyLanguage.id,
      proofDomainId: TEST_DIGEST,
    });
    const policyDerivationClaim = await createObservationPolicyDerivationClaim({
      policyDescriptorId: policyDescriptor.id,
      policyLanguageId: policyLanguage.id,
      proofDomainId: TEST_DIGEST,
    });
    const policyAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: policyDerivationClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const application = await createObservationRuleApplication({
      kind: "declared-event-coalescing",
      ruleId: rule.id,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClassId: descriptor.id,
      proofDomainId: TEST_DIGEST,
      constraintId: constraint.id,
      policyDescriptorId: policyDescriptor.id,
      policyAcceptanceId: policyAcceptance.id,
      eventSlotMappings: [
        {
          sourceEventSymbolId: event.id,
          candidateOccurrenceSymbolId: occurrence.id,
        },
      ],
      overflowTerminalSymbolId: null,
    });
    const applicationAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: application.id,
      attestationDigest: TEST_DIGEST,
    });
    const claim = await createObservationComparisonClaim({
      observationContractId: contract.id,
      compositionId: null,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClasses: [
        {
          inputClassId: descriptor.id,
          actualRelationLanguageId: actualRelation.id,
          ruleApplicationIds: [application.id],
          ruleApplicationAcceptanceIds: [applicationAcceptance.id],
        },
      ],
    });
    const acceptanceInput = {
      claim,
      contract,
      sourceBehavior: source.validationInput,
      candidateBehavior: candidate.validationInput,
      traceLanguages: [sourceLanguage, candidateLanguage],
      actualRelationLanguages: [actualRelation],
      ruleApplications: [application],
      policyDescriptors: [policyDescriptor],
      policyDerivationClaims: [policyDerivationClaim],
      policyTransducerLanguages: [policyLanguage],
      compositionContexts: [],
      proofAcceptances: [applicationAcceptance, policyAcceptance],
      trustedProofAcceptanceIds: [
        applicationAcceptance.id,
        policyAcceptance.id,
      ],
      budget: TEST_BUDGET,
    } as const;
    await expect(
      acceptObservationRelation(acceptanceInput),
    ).resolves.toMatchObject({
      preimage: { comparisonClaimId: claim.id },
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        ...acceptanceInput,
        policyDerivationClaims: [],
      });
    }, "missing-proof");

    const wrongPolicyDescriptor = await createObservationRulePolicyDescriptor({
      observationContractId: contract.id,
      ruleId: rule.id,
      inputClassId: descriptor.id,
      sourceTraceLanguageId: sourceLanguage.id,
      candidateTraceLanguageId: candidateLanguage.id,
      policyQualifiedId,
      version: "1",
      policyRuleGraphDigest: await digestCanonicalJson({
        operation: "coalesce-latest",
        version: "2",
      }),
      policyTransducerLanguageId: policyLanguage.id,
      proofDomainId: TEST_DIGEST,
    });
    const wrongPolicyClaim = await createObservationPolicyDerivationClaim({
      policyDescriptorId: wrongPolicyDescriptor.id,
      policyLanguageId: policyLanguage.id,
      proofDomainId: TEST_DIGEST,
    });
    const wrongPolicyAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: wrongPolicyClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const wrongApplication = await createObservationRuleApplication({
      kind: "declared-event-coalescing",
      ruleId: rule.id,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClassId: descriptor.id,
      proofDomainId: TEST_DIGEST,
      constraintId: constraint.id,
      policyDescriptorId: wrongPolicyDescriptor.id,
      policyAcceptanceId: wrongPolicyAcceptance.id,
      eventSlotMappings: [
        {
          sourceEventSymbolId: event.id,
          candidateOccurrenceSymbolId: occurrence.id,
        },
      ],
      overflowTerminalSymbolId: null,
    });
    const wrongApplicationAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: wrongApplication.id,
      attestationDigest: TEST_DIGEST,
    });
    const wrongClaim = await createObservationComparisonClaim({
      observationContractId: contract.id,
      compositionId: null,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClasses: [
        {
          inputClassId: descriptor.id,
          actualRelationLanguageId: actualRelation.id,
          ruleApplicationIds: [wrongApplication.id],
          ruleApplicationAcceptanceIds: [wrongApplicationAcceptance.id],
        },
      ],
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        ...acceptanceInput,
        claim: wrongClaim,
        ruleApplications: [wrongApplication],
        policyDescriptors: [wrongPolicyDescriptor],
        policyDerivationClaims: [wrongPolicyClaim],
        proofAcceptances: [wrongApplicationAcceptance, wrongPolicyAcceptance],
        trustedProofAcceptanceIds: [
          wrongApplicationAcceptance.id,
          wrongPolicyAcceptance.id,
        ],
      });
    }, "invalid-refinement");
  });

  it("rejects coalescing policy symbols outside the target constraint", async () => {
    const policyQualifiedId = await createQualifiedRegistryId(
      TEST_DIGEST,
      "policy",
      registryId("policy", "coalesce.target-local"),
    );
    const policyRuleGraphDigest = await digestCanonicalJson({
      operation: "coalesce-target-local",
      version: "1",
    });
    const coalescingConstraint = await createObservationConstraint({
      kind: "event",
      subjectId: "input.change",
      visibility: "external",
      inputIdentityDomainId: "event.input/1",
      occurrenceIdentityDomainId: "event.occurrence/1",
      cardinality: { kind: "range", minimum: 0, maximum: 1 },
      admissionCutId: "initial",
      coalescingPolicyRequirement: {
        policyQualifiedId,
        version: "1",
        policyRuleGraphDigest,
        proofDomainId: TEST_DIGEST,
      },
    });
    const unrelatedConstraint = await createObservationConstraint({
      kind: "value",
      subjectId: "unrelated.value",
      visibility: "external",
      equivalenceDomainId: "value/1",
      consistencyCutId: "cut",
    });
    const rule = await createObservationRefinementRule({
      kind: "declared-event-coalescing",
      constraintIds: [coalescingConstraint.id],
      proofDomainId: TEST_DIGEST,
    });
    const contract = await createObservationContract({
      rootDefinitionId: "coalescing-target-local",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [coalescingConstraint, unrelatedConstraint],
      orderEdges: [],
      refinementRules: [rule],
    });
    const event = await createObservationTraceSymbol({
      kind: "event",
      identityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
    });
    if (event.kind !== "event") throw new Error("Expected input event");
    const coalescedOccurrence = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: coalescingConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("coalesced"),
      inputEventSymbolIds: [event.id],
    });
    const sourceValue = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: unrelatedConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("source"),
      inputEventSymbolIds: [event.id],
    });
    const candidateValue = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: unrelatedConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("candidate"),
      inputEventSymbolIds: [event.id],
    });
    const sourceLanguage = await createObservationTraceLanguage(
      createTrieInput([event, sourceValue], [[event.id, sourceValue.id]]),
      TEST_BUDGET,
    );
    const candidateLanguage = await createObservationTraceLanguage(
      createTrieInput(
        [event, coalescedOccurrence, candidateValue],
        [[event.id, coalescedOccurrence.id, candidateValue.id]],
      ),
      TEST_BUDGET,
    );
    const inputClassId = await digestCanonicalJson("coalescing-input-class");
    const inputPartitionId = await digestCanonicalJson(
      "coalescing-input-partition",
    );
    const sourceSummary = await createObservationBehaviorSummary({
      role: "source",
      observationContractId: contract.id,
      semanticGraphDigest: await digestCanonicalJson("coalescing-source"),
      inputPartitionId,
      inputClasses: [{ inputClassId, traceLanguageId: sourceLanguage.id }],
    });
    const candidateSummary = await createObservationBehaviorSummary({
      role: "candidate",
      observationContractId: contract.id,
      semanticGraphDigest: await digestCanonicalJson("coalescing-candidate"),
      inputPartitionId,
      inputClasses: [{ inputClassId, traceLanguageId: candidateLanguage.id }],
    });
    const coalescingSymbol = await createObservationRelationSymbol({
      sourceSymbolId: null,
      candidateSymbolId: coalescedOccurrence.id,
      ruleId: rule.id,
    });
    const unrelatedSymbol = await createObservationRelationSymbol({
      sourceSymbolId: sourceValue.id,
      candidateSymbolId: candidateValue.id,
      ruleId: rule.id,
    });
    const policyLanguage = await createObservationRelationLanguage(
      createTrieInput(
        [coalescingSymbol, unrelatedSymbol],
        [[coalescingSymbol.id, unrelatedSymbol.id]],
      ),
      TEST_BUDGET,
    );
    const policyDescriptor = await createObservationRulePolicyDescriptor({
      observationContractId: contract.id,
      ruleId: rule.id,
      inputClassId,
      sourceTraceLanguageId: sourceLanguage.id,
      candidateTraceLanguageId: candidateLanguage.id,
      policyQualifiedId,
      version: "1",
      policyRuleGraphDigest,
      policyTransducerLanguageId: policyLanguage.id,
      proofDomainId: TEST_DIGEST,
    });
    const application = await createObservationRuleApplication({
      kind: "declared-event-coalescing",
      ruleId: rule.id,
      sourceSummaryId: sourceSummary.id,
      candidateSummaryId: candidateSummary.id,
      inputClassId,
      proofDomainId: TEST_DIGEST,
      constraintId: coalescingConstraint.id,
      policyDescriptorId: policyDescriptor.id,
      policyAcceptanceId: TEST_DIGEST,
      eventSlotMappings: [
        {
          sourceEventSymbolId: event.id,
          candidateOccurrenceSymbolId: coalescedOccurrence.id,
        },
      ],
      overflowTerminalSymbolId: null,
    });
    await expectObservationError(async () => {
      await deriveAllowedObservationRelationLanguage({
        contract,
        sourceSummary,
        candidateSummary,
        inputClassId,
        sourceLanguage,
        candidateLanguage,
        ruleApplications: [application],
        policyDescriptors: [policyDescriptor],
        policyTransducerLanguages: [policyLanguage],
        compositionContexts: [],
        budget: TEST_BUDGET,
      });
    }, "invalid-refinement");
  });

  it("binds commutative policy applications to an exact composition binding", async () => {
    const firstConstraint = await createObservationConstraint({
      kind: "event",
      subjectId: "shared.queue",
      visibility: "external",
      inputIdentityDomainId: "queue.input/1",
      occurrenceIdentityDomainId: "queue.occurrence/1",
      cardinality: { kind: "exactly", count: 1 },
      admissionCutId: "initial",
      coalescingPolicyRequirement: null,
    });
    const secondConstraint = await createObservationConstraint({
      kind: "event",
      subjectId: "shared.queue",
      visibility: "external",
      inputIdentityDomainId: "queue.input/1",
      occurrenceIdentityDomainId: "queue.occurrence/1",
      cardinality: { kind: "range", minimum: 1, maximum: 1 },
      admissionCutId: "initial",
      coalescingPolicyRequirement: null,
    });
    const rule = await createObservationRefinementRule({
      kind: "commutative-reorder",
      constraintIds: [firstConstraint.id, secondConstraint.id],
      proofDomainId: TEST_DIGEST,
    });
    const contract = await createObservationContract({
      rootDefinitionId: "commutative-refinement",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [firstConstraint, secondConstraint],
      orderEdges: [],
      refinementRules: [rule],
    });
    const policyQualifiedId = await createQualifiedRegistryId(
      TEST_DIGEST,
      "policy",
      registryId("policy", "composition.commutative"),
    );
    const policyRuleGraphDigest = await digestCanonicalJson({
      operation: "commutative",
      version: "1",
    });
    const binding = await createObservationCompositionBinding({
      sharedSubjectId: "shared.queue",
      constraintKind: "event",
      members: [
        { contractId: contract.id, constraintId: firstConstraint.id },
        { contractId: contract.id, constraintId: secondConstraint.id },
      ],
      resolution: {
        kind: "commutative",
        policyRequirement: {
          policyQualifiedId,
          version: "1",
          policyRuleGraphDigest,
          proofDomainId: TEST_DIGEST,
        },
      },
    });
    const composition = await createObservationComposition({
      memberContracts: [contract],
      bindings: [binding],
      resultContractHeader: {
        rootDefinitionId: "commutative-refinement-result",
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
      },
    });
    const input = await createSingleClassInputPartition();
    const firstSymbol = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: firstConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("first"),
      inputEventSymbolIds: [],
    });
    const secondSymbol = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: secondConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("second"),
      inputEventSymbolIds: [],
    });
    const sourceLanguage = await createObservationTraceLanguage(
      createTrieInput(
        [firstSymbol, secondSymbol],
        [[firstSymbol.id, secondSymbol.id]],
      ),
      TEST_BUDGET,
    );
    const candidateLanguage = await createObservationTraceLanguage(
      createTrieInput(
        [firstSymbol, secondSymbol],
        [[secondSymbol.id, firstSymbol.id]],
      ),
      TEST_BUDGET,
    );
    const source = await createAcceptedBehaviorForTrace(
      contract,
      input,
      sourceLanguage,
      "source",
      "commutative-source",
    );
    const candidate = await createAcceptedBehaviorForTrace(
      contract,
      input,
      candidateLanguage,
      "candidate",
      "commutative-candidate",
    );
    const firstPolicySymbol = await createObservationRelationSymbol({
      sourceSymbolId: firstSymbol.id,
      candidateSymbolId: secondSymbol.id,
      ruleId: rule.id,
    });
    const secondPolicySymbol = await createObservationRelationSymbol({
      sourceSymbolId: secondSymbol.id,
      candidateSymbolId: firstSymbol.id,
      ruleId: rule.id,
    });
    const policyLanguage = await createObservationRelationLanguage(
      createTrieInput(
        [firstPolicySymbol, secondPolicySymbol],
        [[firstPolicySymbol.id, secondPolicySymbol.id]],
      ),
      TEST_BUDGET,
    );
    const createPolicyDescriptor = async (ruleGraphDigest: Sha256Digest) =>
      await createObservationRulePolicyDescriptor({
        observationContractId: contract.id,
        ruleId: rule.id,
        inputClassId: input.descriptor.id,
        sourceTraceLanguageId: sourceLanguage.id,
        candidateTraceLanguageId: candidateLanguage.id,
        policyQualifiedId,
        version: "1",
        policyRuleGraphDigest: ruleGraphDigest,
        policyTransducerLanguageId: policyLanguage.id,
        proofDomainId: TEST_DIGEST,
      });
    const createAcceptanceInput = async (
      policyDescriptor: Awaited<ReturnType<typeof createPolicyDescriptor>>,
      bindingId: Sha256Digest,
    ) => {
      const policyDerivationClaim =
        await createObservationPolicyDerivationClaim({
          policyDescriptorId: policyDescriptor.id,
          policyLanguageId: policyLanguage.id,
          proofDomainId: TEST_DIGEST,
        });
      const policyAcceptance = await createObservationProofAcceptance({
        proofDomainId: TEST_DIGEST,
        claimDigest: policyDerivationClaim.id,
        attestationDigest: TEST_DIGEST,
      });
      const application = await createObservationRuleApplication({
        kind: "commutative-reorder",
        ruleId: rule.id,
        sourceSummaryId: source.summary.id,
        candidateSummaryId: candidate.summary.id,
        inputClassId: input.descriptor.id,
        proofDomainId: TEST_DIGEST,
        compositionId: composition.id,
        bindingId,
        policyDescriptorId: policyDescriptor.id,
        policyAcceptanceId: policyAcceptance.id,
      });
      const applicationAcceptance = await createObservationProofAcceptance({
        proofDomainId: TEST_DIGEST,
        claimDigest: application.id,
        attestationDigest: TEST_DIGEST,
      });
      const claim = await createObservationComparisonClaim({
        observationContractId: contract.id,
        compositionId: composition.id,
        sourceSummaryId: source.summary.id,
        candidateSummaryId: candidate.summary.id,
        inputClasses: [
          {
            inputClassId: input.descriptor.id,
            actualRelationLanguageId: policyLanguage.id,
            ruleApplicationIds: [application.id],
            ruleApplicationAcceptanceIds: [applicationAcceptance.id],
          },
        ],
      });
      return {
        claim,
        contract,
        sourceBehavior: source.validationInput,
        candidateBehavior: candidate.validationInput,
        traceLanguages: [sourceLanguage, candidateLanguage],
        actualRelationLanguages: [policyLanguage],
        ruleApplications: [application],
        policyDescriptors: [policyDescriptor],
        policyDerivationClaims: [policyDerivationClaim],
        policyTransducerLanguages: [policyLanguage],
        compositionContexts: [{ composition, memberContracts: [contract] }],
        proofAcceptances: [applicationAcceptance, policyAcceptance],
        trustedProofAcceptanceIds: [
          applicationAcceptance.id,
          policyAcceptance.id,
        ],
        budget: TEST_BUDGET,
      } as const;
    };

    const policyDescriptor = await createPolicyDescriptor(
      policyRuleGraphDigest,
    );
    const validAcceptanceInput = await createAcceptanceInput(
      policyDescriptor,
      binding.id,
    );
    await expect(
      acceptObservationRelation(validAcceptanceInput),
    ).resolves.toMatchObject({
      preimage: { schema: "dathra.accepted-observation-relation/2" },
    });

    await expectObservationError(async () => {
      await acceptObservationRelation({
        ...validAcceptanceInput,
        compositionContexts: [
          ...validAcceptanceInput.compositionContexts,
          ...validAcceptanceInput.compositionContexts,
        ],
      });
    }, "duplicate-record");

    const unreferencedComposition = await createObservationComposition({
      memberContracts: [contract],
      bindings: [binding],
      resultContractHeader: {
        rootDefinitionId: "unreferenced-commutative-result",
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
      },
    });
    await expectObservationError(async () => {
      await acceptObservationRelation({
        ...validAcceptanceInput,
        compositionContexts: [
          ...validAcceptanceInput.compositionContexts,
          {
            composition: unreferencedComposition,
            memberContracts: [contract],
          },
        ],
      });
    }, "invalid-field");

    const unknownBindingId = await digestCanonicalJson("unknown-binding");
    await expectObservationError(async () => {
      await acceptObservationRelation(
        await createAcceptanceInput(policyDescriptor, unknownBindingId),
      );
    }, "invalid-refinement");

    const wrongRuleGraphDescriptor = await createPolicyDescriptor(
      await digestCanonicalJson({ operation: "commutative", version: "2" }),
    );
    await expectObservationError(async () => {
      await acceptObservationRelation(
        await createAcceptanceInput(wrongRuleGraphDescriptor, binding.id),
      );
    }, "invalid-refinement");
  });

  it("allows a candidate to omit only a declared internal-ordering step", async () => {
    const internal = await createObservationConstraint({
      kind: "dom",
      subjectId: "internal.marker",
      visibility: "internal-ordering",
      realizationDomainId: "dom/internal/1",
      mutableFacetPolicyId: "immutable",
      consistencyCutId: "cut",
    });
    const rule = await createObservationRefinementRule({
      kind: "omit-unobservable-internal-step",
      constraintIds: [internal.id],
      proofDomainId: TEST_DIGEST,
    });
    const contract = await createObservationContract({
      rootDefinitionId: "omit-internal",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [internal],
      orderEdges: [],
      refinementRules: [rule],
    });
    const input = await createSingleClassInputPartition();
    const internalSymbol = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: internal.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [],
    });
    const sourceLanguage = await createObservationTraceLanguage(
      createTrieInput([internalSymbol], [[internalSymbol.id]]),
      TEST_BUDGET,
    );
    const candidateLanguage = await createObservationTraceLanguage(
      createTrieInput([], [[]]),
      TEST_BUDGET,
    );
    const source = await createAcceptedBehaviorForTrace(
      contract,
      input,
      sourceLanguage,
      "source",
      "omit-source",
    );
    const candidate = await createAcceptedBehaviorForTrace(
      contract,
      input,
      candidateLanguage,
      "candidate",
      "omit-candidate",
    );
    const relationSymbol = await createObservationRelationSymbol({
      sourceSymbolId: internalSymbol.id,
      candidateSymbolId: null,
      ruleId: rule.id,
    });
    const actualRelation = await createObservationRelationLanguage(
      createTrieInput([relationSymbol], [[relationSymbol.id]]),
      TEST_BUDGET,
    );
    const application = await createObservationRuleApplication({
      kind: "omit-unobservable-internal-step",
      ruleId: rule.id,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClassId: input.descriptor.id,
      proofDomainId: TEST_DIGEST,
      constraintId: internal.id,
      omittedSourceSymbolIds: [internalSymbol.id],
    });
    const applicationAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: application.id,
      attestationDigest: TEST_DIGEST,
    });
    const claim = await createObservationComparisonClaim({
      observationContractId: contract.id,
      compositionId: null,
      sourceSummaryId: source.summary.id,
      candidateSummaryId: candidate.summary.id,
      inputClasses: [
        {
          inputClassId: input.descriptor.id,
          actualRelationLanguageId: actualRelation.id,
          ruleApplicationIds: [application.id],
          ruleApplicationAcceptanceIds: [applicationAcceptance.id],
        },
      ],
    });
    await expect(
      acceptObservationRelation({
        claim,
        contract,
        sourceBehavior: source.validationInput,
        candidateBehavior: candidate.validationInput,
        traceLanguages: [sourceLanguage, candidateLanguage],
        actualRelationLanguages: [actualRelation],
        ruleApplications: [application],
        policyDescriptors: [],
        policyDerivationClaims: [],
        policyTransducerLanguages: [],
        compositionContexts: [],
        proofAcceptances: [applicationAcceptance],
        trustedProofAcceptanceIds: [applicationAcceptance.id],
        budget: TEST_BUDGET,
      }),
    ).resolves.toMatchObject({ preimage: { comparisonClaimId: claim.id } });
  });

  it("narrows cardinality through a unique source-to-candidate slot mapping", async () => {
    const artifact = await createObservationConstraint({
      kind: "artifact",
      subjectId: "artifact.chunk",
      visibility: "external",
      byteOrMessageSchemaId: "artifact/1",
      cardinality: { kind: "range", minimum: 0, maximum: 2 },
    });
    const rule = await createObservationRefinementRule({
      kind: "narrow-cardinality",
      constraintIds: [artifact.id],
      proofDomainId: TEST_DIGEST,
    });
    const contract = await createObservationContract({
      rootDefinitionId: "narrow-cardinality",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [artifact],
      orderEdges: [],
      refinementRules: [rule],
    });
    const input = await createSingleClassInputPartition();
    const firstSlot = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: artifact.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [],
    });
    const secondSlot = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: artifact.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 1,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [],
    });
    const sourceLanguage = await createObservationTraceLanguage(
      createTrieInput([firstSlot, secondSlot], [[firstSlot.id, secondSlot.id]]),
      TEST_BUDGET,
    );
    const candidateLanguage = await createObservationTraceLanguage(
      createTrieInput([firstSlot], [[firstSlot.id]]),
      TEST_BUDGET,
    );
    const source = await createAcceptedBehaviorForTrace(
      contract,
      input,
      sourceLanguage,
      "source",
      "narrow-source",
    );
    const candidate = await createAcceptedBehaviorForTrace(
      contract,
      input,
      candidateLanguage,
      "candidate",
      "narrow-candidate",
    );
    const identitySymbol = await createObservationRelationSymbol({
      sourceSymbolId: firstSlot.id,
      candidateSymbolId: firstSlot.id,
      ruleId: null,
    });
    const omittedSymbol = await createObservationRelationSymbol({
      sourceSymbolId: secondSlot.id,
      candidateSymbolId: null,
      ruleId: rule.id,
    });
    const actualRelation = await createObservationRelationLanguage(
      createTrieInput(
        [identitySymbol, omittedSymbol],
        [[identitySymbol.id, omittedSymbol.id]],
      ),
      TEST_BUDGET,
    );
    const makeApplication = async (duplicateCandidateSlot: boolean) =>
      await createObservationRuleApplication({
        kind: "narrow-cardinality",
        ruleId: rule.id,
        sourceSummaryId: source.summary.id,
        candidateSummaryId: candidate.summary.id,
        inputClassId: input.descriptor.id,
        proofDomainId: TEST_DIGEST,
        constraintId: artifact.id,
        sourceCardinality: { kind: "range", minimum: 0, maximum: 2 },
        candidateCardinality: { kind: "range", minimum: 0, maximum: 1 },
        slotMappings: [
          { sourceSymbolId: firstSlot.id, candidateSymbolId: firstSlot.id },
          {
            sourceSymbolId: secondSlot.id,
            candidateSymbolId: duplicateCandidateSlot ? firstSlot.id : null,
          },
        ],
      });
    const acceptApplication = async (
      application: Awaited<ReturnType<typeof makeApplication>>,
    ) => {
      const applicationAcceptance = await createObservationProofAcceptance({
        proofDomainId: TEST_DIGEST,
        claimDigest: application.id,
        attestationDigest: TEST_DIGEST,
      });
      const claim = await createObservationComparisonClaim({
        observationContractId: contract.id,
        compositionId: null,
        sourceSummaryId: source.summary.id,
        candidateSummaryId: candidate.summary.id,
        inputClasses: [
          {
            inputClassId: input.descriptor.id,
            actualRelationLanguageId: actualRelation.id,
            ruleApplicationIds: [application.id],
            ruleApplicationAcceptanceIds: [applicationAcceptance.id],
          },
        ],
      });
      return await acceptObservationRelation({
        claim,
        contract,
        sourceBehavior: source.validationInput,
        candidateBehavior: candidate.validationInput,
        traceLanguages: [sourceLanguage, candidateLanguage],
        actualRelationLanguages: [actualRelation],
        ruleApplications: [application],
        policyDescriptors: [],
        policyDerivationClaims: [],
        policyTransducerLanguages: [],
        compositionContexts: [],
        proofAcceptances: [applicationAcceptance],
        trustedProofAcceptanceIds: [applicationAcceptance.id],
        budget: TEST_BUDGET,
      });
    };
    await expect(
      acceptApplication(await makeApplication(false)),
    ).resolves.toMatchObject({
      preimage: { schema: "dathra.accepted-observation-relation/2" },
    });
    await expectObservationError(async () => {
      await acceptApplication(await makeApplication(true));
    }, "invalid-refinement");
  });
});

describe("derived observation composition", () => {
  it("derives an independent result contract and accepts a merge relation", async () => {
    const shared = await createObservationConstraint({
      kind: "identity",
      subjectId: "shared.host",
      visibility: "external",
      identityDomainId: "identity/1",
      lifetimeDomainId: "document",
    });
    const makeContract = async (rootDefinitionId: string) =>
      await createObservationContract({
        rootDefinitionId,
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
        relation: "trace-equality",
        constraints: [shared],
        orderEdges: [],
        refinementRules: [],
      });
    const first = await makeContract("first");
    const second = await makeContract("second");
    const binding = await createObservationCompositionBinding({
      sharedSubjectId: "shared.host",
      constraintKind: "identity",
      members: [
        { contractId: first.id, constraintId: shared.id },
        { contractId: second.id, constraintId: shared.id },
      ],
      resolution: { kind: "merge-identical" },
    });
    const composition = await createObservationComposition({
      memberContracts: [first, second],
      bindings: [binding],
      resultContractHeader: {
        rootDefinitionId: "composed",
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
      },
    });
    expect(composition.preimage.schema).toBe(
      "dathra.observation-composition/4",
    );
    expect(composition.preimage.resultContract.preimage).toMatchObject({
      rootDefinitionId: "composed",
      relation: "trace-equality",
      refinementRules: [],
    });
    expect(composition.preimage.resultContract.preimage.constraints).toEqual([
      shared,
    ]);
    expect(
      await parseObservationComposition(composition, [first, second]),
    ).toEqual(composition);

    const input = await createSingleClassInputPartition();
    const symbol = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: shared.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [],
    });
    const traceLanguage = await createObservationTraceLanguage(
      createTrieInput([symbol], [[symbol.id]]),
      TEST_BUDGET,
    );
    const firstBehavior = await createAcceptedBehaviorForTrace(
      first,
      input,
      traceLanguage,
      "source",
      "first",
    );
    const secondBehavior = await createAcceptedBehaviorForTrace(
      second,
      input,
      traceLanguage,
      "source",
      "second",
    );
    const resultBehavior = await createAcceptedBehaviorForTrace(
      composition.preimage.resultContract,
      input,
      traceLanguage,
      "candidate",
      "result",
    );
    const behaviorByContractId = new Map([
      [first.id, firstBehavior],
      [second.id, secondBehavior],
    ]);
    const orderedBehaviors = composition.preimage.memberContractIds.map(
      (contractId) => {
        const behavior = behaviorByContractId.get(contractId);
        if (behavior === undefined) throw new Error("Missing member behavior");
        return behavior;
      },
    );
    const relationSymbol = await createObservationCompositionRelationSymbol({
      memberSymbolIds: orderedBehaviors.map(() => symbol.id),
      resultSymbolId: symbol.id,
      bindingId: binding.id,
    });
    const actualRelation = await createObservationCompositionRelationLanguage(
      createTrieInput([relationSymbol], [[relationSymbol.id]]),
      TEST_BUDGET,
    );
    const claim = await createObservationCompositionClaim({
      compositionId: composition.id,
      resultContractId: composition.preimage.resultContract.id,
      memberSummaryIds: orderedBehaviors.map(({ summary }) => summary.id),
      resultSummaryId: resultBehavior.summary.id,
      inputClasses: [
        {
          inputClassId: input.descriptor.id,
          memberTraceLanguageIds: orderedBehaviors.map(() => traceLanguage.id),
          resultTraceLanguageId: traceLanguage.id,
          actualRelationLanguageId: actualRelation.id,
          bindingIds: [binding.id],
          policyClosures: [],
        },
      ],
    });
    const accepted = await acceptObservationComposition({
      claim,
      composition,
      memberContracts: [first, second],
      memberBehaviors: orderedBehaviors.map(
        ({ validationInput }) => validationInput,
      ),
      resultBehavior: resultBehavior.validationInput,
      traceLanguages: [traceLanguage],
      actualRelationLanguages: [actualRelation],
      policyApplications: [],
      algebraDescriptors: [],
      policyDerivationClaims: [],
      policyTransducerLanguages: [],
      proofAcceptances: [],
      trustedProofAcceptanceIds: [],
      budget: TEST_BUDGET,
    });
    expect(accepted.preimage.compositionClaimId).toBe(claim.id);
    expect(accepted.preimage.resultBehaviorAcceptanceId).toBe(
      resultBehavior.accepted.id,
    );

    const callerSelectedClaim = {
      compositionId: composition.id,
      resultContractId: composition.preimage.resultContract.id,
      memberSummaryIds: orderedBehaviors.map(({ summary }) => summary.id),
      resultSummaryId: resultBehavior.summary.id,
      inputClasses: [
        {
          inputClassId: input.descriptor.id,
          memberTraceLanguageIds: orderedBehaviors.map(() => traceLanguage.id),
          resultTraceLanguageId: traceLanguage.id,
          actualRelationLanguageId: actualRelation.id,
          allowedRelationLanguageId: actualRelation.id,
          bindingIds: [binding.id],
          policyClosures: [],
        },
      ],
    };
    await expectObservationError(async () => {
      await createObservationCompositionClaim(callerSelectedClaim);
    }, "invalid-field");
  });

  it("accepts a class-local commutative policy and rejects a cross-mapped symbol", async () => {
    const firstConstraint = await createObservationConstraint({
      kind: "event",
      subjectId: "shared.queue",
      visibility: "external",
      inputIdentityDomainId: "queue.input/1",
      occurrenceIdentityDomainId: "queue.occurrence/1",
      cardinality: { kind: "exactly", count: 1 },
      admissionCutId: "initial",
      coalescingPolicyRequirement: null,
    });
    const secondConstraint = await createObservationConstraint({
      kind: "event",
      subjectId: "shared.queue",
      visibility: "external",
      inputIdentityDomainId: "queue.input/1",
      occurrenceIdentityDomainId: "queue.occurrence/1",
      cardinality: { kind: "range", minimum: 1, maximum: 1 },
      admissionCutId: "initial",
      coalescingPolicyRequirement: null,
    });
    const makeContract = async (
      rootDefinitionId: string,
      constraint: typeof firstConstraint,
    ) =>
      await createObservationContract({
        rootDefinitionId,
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
        relation: "trace-equality",
        constraints: [constraint],
        orderEdges: [],
        refinementRules: [],
      });
    const first = await makeContract("commutative:first", firstConstraint);
    const second = await makeContract("commutative:second", secondConstraint);
    const policyQualifiedId = await createQualifiedRegistryId(
      TEST_DIGEST,
      "policy",
      registryId("policy", "composition.commutative"),
    );
    const policyRuleGraphDigest = await digestCanonicalJson({
      operation: "commutative",
      version: "1",
    });
    const binding = await createObservationCompositionBinding({
      sharedSubjectId: "shared.queue",
      constraintKind: "event",
      members: [
        { contractId: first.id, constraintId: firstConstraint.id },
        { contractId: second.id, constraintId: secondConstraint.id },
      ],
      resolution: {
        kind: "commutative",
        policyRequirement: {
          policyQualifiedId,
          version: "1",
          policyRuleGraphDigest,
          proofDomainId: TEST_DIGEST,
        },
      },
    });
    const composition = await createObservationComposition({
      memberContracts: [first, second],
      bindings: [binding],
      resultContractHeader: {
        rootDefinitionId: "commutative:result",
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
      },
    });
    const input = await createSingleClassInputPartition();
    const firstSymbol = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: firstConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("first"),
      inputEventSymbolIds: [],
    });
    const secondSymbol = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: secondConstraint.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: await digestCanonicalJson("second"),
      inputEventSymbolIds: [],
    });
    const firstLanguage = await createObservationTraceLanguage(
      createTrieInput([firstSymbol], [[firstSymbol.id]]),
      TEST_BUDGET,
    );
    const secondLanguage = await createObservationTraceLanguage(
      createTrieInput([secondSymbol], [[secondSymbol.id]]),
      TEST_BUDGET,
    );
    const resultLanguage = await createObservationTraceLanguage(
      createTrieInput(
        [firstSymbol, secondSymbol],
        [[firstSymbol.id, secondSymbol.id]],
      ),
      TEST_BUDGET,
    );
    const firstBehavior = await createAcceptedBehaviorForTrace(
      first,
      input,
      firstLanguage,
      "source",
      "commutative-first",
    );
    const secondBehavior = await createAcceptedBehaviorForTrace(
      second,
      input,
      secondLanguage,
      "source",
      "commutative-second",
    );
    const resultBehavior = await createAcceptedBehaviorForTrace(
      composition.preimage.resultContract,
      input,
      resultLanguage,
      "candidate",
      "commutative-result",
    );
    const behaviorByContractId = new Map([
      [
        first.id,
        {
          behavior: firstBehavior,
          language: firstLanguage,
          symbol: firstSymbol,
        },
      ],
      [
        second.id,
        {
          behavior: secondBehavior,
          language: secondLanguage,
          symbol: secondSymbol,
        },
      ],
    ]);
    const ordered = composition.preimage.memberContractIds.map((contractId) => {
      const member = behaviorByContractId.get(contractId);
      if (member === undefined) throw new Error("Missing commutative member");
      return member;
    });
    const firstMemberIndex = ordered.findIndex(
      ({ symbol }) => symbol.id === firstSymbol.id,
    );
    const secondMemberIndex = ordered.findIndex(
      ({ symbol }) => symbol.id === secondSymbol.id,
    );
    const makePolicySymbol = async (
      memberIndex: number,
      memberSymbolId: Sha256Digest,
      resultSymbolId: Sha256Digest,
    ) => {
      const memberSymbolIds = ordered.map(() => null as Sha256Digest | null);
      memberSymbolIds[memberIndex] = memberSymbolId;
      return await createObservationCompositionRelationSymbol({
        memberSymbolIds,
        resultSymbolId,
        bindingId: binding.id,
      });
    };
    const firstPolicySymbol = await makePolicySymbol(
      firstMemberIndex,
      firstSymbol.id,
      firstSymbol.id,
    );
    const secondPolicySymbol = await makePolicySymbol(
      secondMemberIndex,
      secondSymbol.id,
      secondSymbol.id,
    );
    const policyLanguage = await createObservationCompositionRelationLanguage(
      createTrieInput(
        [firstPolicySymbol, secondPolicySymbol],
        [
          [firstPolicySymbol.id, secondPolicySymbol.id],
          [secondPolicySymbol.id, firstPolicySymbol.id],
        ],
      ),
      TEST_BUDGET,
    );
    const actualRelation = await createObservationCompositionRelationLanguage(
      createTrieInput(
        [firstPolicySymbol, secondPolicySymbol],
        [[firstPolicySymbol.id, secondPolicySymbol.id]],
      ),
      TEST_BUDGET,
    );
    const algebraDescriptor =
      await createObservationCompositionAlgebraDescriptor({
        operationKind: "commutative",
        version: "1",
        constraintKind: "event",
        policyQualifiedId,
        policyRuleGraphDigest,
        policyTransducerLanguageId: policyLanguage.id,
        proofDomainId: TEST_DIGEST,
      });
    const policyApplication =
      await createObservationCompositionPolicyApplication({
        compositionId: composition.id,
        inputClassId: input.descriptor.id,
        memberTraceLanguageIds: ordered.map(({ language }) => language.id),
        resultTraceLanguageId: resultLanguage.id,
        bindingId: binding.id,
        algebraDescriptorId: algebraDescriptor.id,
        policyLanguageId: policyLanguage.id,
      });
    const policyDerivationClaim =
      await createObservationCompositionPolicyDerivationClaim({
        policyApplicationId: policyApplication.id,
        algebraDescriptorId: algebraDescriptor.id,
        policyLanguageId: policyLanguage.id,
        proofDomainId: TEST_DIGEST,
      });
    const policyAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: policyDerivationClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const policyClosure = {
      bindingId: binding.id,
      policyApplicationId: policyApplication.id,
      policyDerivationClaimId: policyDerivationClaim.id,
      policyAcceptanceId: policyAcceptance.id,
    };
    const claim = await createObservationCompositionClaim({
      compositionId: composition.id,
      resultContractId: composition.preimage.resultContract.id,
      memberSummaryIds: ordered.map(({ behavior }) => behavior.summary.id),
      resultSummaryId: resultBehavior.summary.id,
      inputClasses: [
        {
          inputClassId: input.descriptor.id,
          memberTraceLanguageIds: ordered.map(({ language }) => language.id),
          resultTraceLanguageId: resultLanguage.id,
          actualRelationLanguageId: actualRelation.id,
          bindingIds: [binding.id],
          policyClosures: [policyClosure],
        },
      ],
    });
    const acceptanceInput = {
      claim,
      composition,
      memberContracts: [first, second],
      memberBehaviors: ordered.map(({ behavior }) => behavior.validationInput),
      resultBehavior: resultBehavior.validationInput,
      traceLanguages: [firstLanguage, secondLanguage, resultLanguage],
      actualRelationLanguages: [actualRelation],
      policyApplications: [policyApplication],
      algebraDescriptors: [algebraDescriptor],
      policyDerivationClaims: [policyDerivationClaim],
      policyTransducerLanguages: [policyLanguage],
      proofAcceptances: [policyAcceptance],
      trustedProofAcceptanceIds: [policyAcceptance.id],
      budget: TEST_BUDGET,
    } as const;
    await expect(
      acceptObservationComposition(acceptanceInput),
    ).resolves.toMatchObject({
      preimage: { schema: "dathra.accepted-observation-composition/2" },
    });

    const crossMappedSymbol = await makePolicySymbol(
      secondMemberIndex,
      secondSymbol.id,
      firstSymbol.id,
    );
    const invalidPolicyLanguage =
      await createObservationCompositionRelationLanguage(
        createTrieInput([crossMappedSymbol], [[crossMappedSymbol.id]]),
        TEST_BUDGET,
      );
    const invalidDescriptor =
      await createObservationCompositionAlgebraDescriptor({
        operationKind: "commutative",
        version: "1",
        constraintKind: "event",
        policyQualifiedId,
        policyRuleGraphDigest,
        policyTransducerLanguageId: invalidPolicyLanguage.id,
        proofDomainId: TEST_DIGEST,
      });
    const invalidApplication =
      await createObservationCompositionPolicyApplication({
        compositionId: composition.id,
        inputClassId: input.descriptor.id,
        memberTraceLanguageIds: ordered.map(({ language }) => language.id),
        resultTraceLanguageId: resultLanguage.id,
        bindingId: binding.id,
        algebraDescriptorId: invalidDescriptor.id,
        policyLanguageId: invalidPolicyLanguage.id,
      });
    const invalidDerivationClaim =
      await createObservationCompositionPolicyDerivationClaim({
        policyApplicationId: invalidApplication.id,
        algebraDescriptorId: invalidDescriptor.id,
        policyLanguageId: invalidPolicyLanguage.id,
        proofDomainId: TEST_DIGEST,
      });
    const invalidAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: invalidDerivationClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const invalidClaim = await createObservationCompositionClaim({
      compositionId: composition.id,
      resultContractId: composition.preimage.resultContract.id,
      memberSummaryIds: ordered.map(({ behavior }) => behavior.summary.id),
      resultSummaryId: resultBehavior.summary.id,
      inputClasses: [
        {
          inputClassId: input.descriptor.id,
          memberTraceLanguageIds: ordered.map(({ language }) => language.id),
          resultTraceLanguageId: resultLanguage.id,
          actualRelationLanguageId: actualRelation.id,
          bindingIds: [binding.id],
          policyClosures: [
            {
              bindingId: binding.id,
              policyApplicationId: invalidApplication.id,
              policyDerivationClaimId: invalidDerivationClaim.id,
              policyAcceptanceId: invalidAcceptance.id,
            },
          ],
        },
      ],
    });
    await expectObservationError(async () => {
      await acceptObservationComposition({
        ...acceptanceInput,
        claim: invalidClaim,
        policyApplications: [invalidApplication],
        algebraDescriptors: [invalidDescriptor],
        policyDerivationClaims: [invalidDerivationClaim],
        policyTransducerLanguages: [invalidPolicyLanguage],
        proofAcceptances: [invalidAcceptance],
        trustedProofAcceptanceIds: [invalidAcceptance.id],
      });
    }, "composition-conflict");
  });
});

describe("realization coverage and witness closure", () => {
  it("accepts full class coverage and binds the concrete witness to every acceptance", async () => {
    const relation = await createEquivalentRelationFixture();
    if (relation.domSymbol.kind !== "occurrence") {
      throw new Error("Expected an occurrence fixture");
    }
    const expectedObservationTokenDigest =
      relation.domSymbol.observationTokenRelationDigest;
    const relationAcceptanceInput = {
      claim: relation.claim,
      contract: relation.contract,
      sourceBehavior: relation.source.validationInput,
      candidateBehavior: relation.candidate.validationInput,
      traceLanguages: [relation.sourceLanguage, relation.candidateLanguage],
      actualRelationLanguages: [relation.actualRelation],
      ruleApplications: [relation.application],
      policyDescriptors: [],
      policyDerivationClaims: [],
      policyTransducerLanguages: [],
      compositionContexts: [],
      proofAcceptances: [relation.applicationAcceptance],
      trustedProofAcceptanceIds: [relation.applicationAcceptance.id],
      budget: TEST_BUDGET,
    } as const;
    const acceptedRelation = await acceptObservationRelation(
      relationAcceptanceInput,
    );
    const { hostProfileId, catalog } = await createHostCatalog();
    const parserProfile = await createCanonicalParserProfile({
      targetHostProfileId: hostProfileId,
      version: "1",
      encoding: "utf-8",
      contentTypeIds: ["text/html"],
      documentModes: ["no-quirks"],
      parserOperationIds: ["insert-token", "join-token", "zero-input"],
      sequenceProofDomainId: TEST_DIGEST,
      baseUrlProofDomainId: TEST_DIGEST,
    });
    const obligation = await createRealizationObligation({
      observationContractId: relation.contract.id,
      constraintId: relation.dom.id,
      observableIdentity: "dom",
      expectedObservationTokenDigest,
    });
    const artifactTemplateSymbol = await createRealizationTemplateStepSymbol({
      kind: "artifact-token",
      artifactTokenClassId: "html-token",
      outputTokenRelationDigest: TEST_DIGEST,
    });
    const directParserTemplateSymbol =
      await createRealizationTemplateStepSymbol({
        kind: "parser-operation",
        parserOperationId: "insert-token",
        inputSymbolIds: [artifactTemplateSymbol.id],
        outputTokenRelationDigest: TEST_DIGEST,
      });
    const zeroInputTemplateSymbol = await createRealizationTemplateStepSymbol({
      kind: "parser-operation",
      parserOperationId: "zero-input",
      inputSymbolIds: [],
      outputTokenRelationDigest: TEST_DIGEST,
    });
    const joinTemplateSymbol = await createRealizationTemplateStepSymbol({
      kind: "parser-operation",
      parserOperationId: "join-token",
      inputSymbolIds: [
        directParserTemplateSymbol.id,
        zeroInputTemplateSymbol.id,
      ],
      outputTokenRelationDigest: TEST_DIGEST,
    });
    const sequenceLanguage = await createRealizationSequenceLanguage(
      createTrieInput(
        [
          artifactTemplateSymbol,
          directParserTemplateSymbol,
          zeroInputTemplateSymbol,
          joinTemplateSymbol,
        ],
        [
          [artifactTemplateSymbol.id, directParserTemplateSymbol.id],
          [
            artifactTemplateSymbol.id,
            directParserTemplateSymbol.id,
            zeroInputTemplateSymbol.id,
            joinTemplateSymbol.id,
          ],
        ],
      ),
      TEST_BUDGET,
    );
    const template = await createRealizationWitnessTemplate({
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      inputClassId: relation.input.descriptor.id,
      parserProfileId: parserProfile.id,
      obligations: [obligation],
      sequenceLanguageId: sequenceLanguage.id,
      proofDomainId: TEST_DIGEST,
    });
    const coverageClaim = await createRealizationCoverageClaim({
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      inputPartitionId: relation.input.partition.id,
      templates: [
        {
          inputClassId: relation.input.descriptor.id,
          witnessTemplateId: template.id,
        },
      ],
      proofDomainId: TEST_DIGEST,
    });
    const coverageAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: coverageClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const coverageValidationInput: RealizationCoverageValidationInput = {
      claim: coverageClaim,
      behavior: relation.candidate.validationInput,
      templates: [template],
      sequenceLanguages: [sequenceLanguage],
      parserProfiles: [parserProfile],
      proofAcceptances: [coverageAcceptance],
      trustedProofAcceptanceIds: [coverageAcceptance.id],
      budget: TEST_BUDGET,
    };
    const acceptedCoverage = await validateRealizationCoverageClaim(
      coverageValidationInput,
    );
    const artifactStep = await createRealizationStep({
      kind: "artifact-token",
      templateSymbolId: artifactTemplateSymbol.id,
      artifactTokenClassId: "html-token",
      occurrenceIdentity: "token:0",
      artifactTokenId: "token:html:0",
      inputByteRangeDigest: TEST_DIGEST,
      outputObservationTokenDigest: TEST_DIGEST,
    });
    const directParserStep = await createRealizationStep({
      kind: "parser-operation",
      templateSymbolId: directParserTemplateSymbol.id,
      occurrenceIdentity: "parser:direct",
      parserOperationId: "insert-token",
      inputStepIds: [artifactStep.id],
      inputObservationTokenDigests: [TEST_DIGEST],
      outputObservationTokenDigest: expectedObservationTokenDigest,
    });
    const sequenceClaim = await createRealizationSequenceClaim({
      witnessTemplateId: template.id,
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      inputClassId: relation.input.descriptor.id,
      realizationInputDigest: TEST_DIGEST,
      parserProfileId: parserProfile.id,
      proofDomainId: TEST_DIGEST,
      obligationIds: [obligation.id],
      steps: [artifactStep, directParserStep],
      parserSequence: [artifactStep.id, directParserStep.id],
      obligationOutputs: [
        { obligationId: obligation.id, outputStepId: directParserStep.id },
      ],
    });
    const sequenceAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: sequenceClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const baseUrlClaim = await createCanonicalBaseUrlClaim({
      parserProfileId: parserProfile.id,
      canonicalBaseUrl: "https://example.test/docs/",
      proofDomainId: TEST_DIGEST,
    });
    const baseUrlAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: baseUrlClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const witness = await createRealizationWitness({
      renderInstanceId: "render:1",
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      acceptedObservationRelationId: acceptedRelation.id,
      inputClassId: relation.input.descriptor.id,
      realizationInputDigest: TEST_DIGEST,
      acceptedCoverageId: acceptedCoverage.id,
      coverageClaimId: coverageClaim.id,
      coverageAcceptanceId: coverageAcceptance.id,
      witnessTemplateId: template.id,
      realizationSequenceClaimId: sequenceClaim.id,
      sequenceAcceptanceId: sequenceAcceptance.id,
      targetHostProfileId: hostProfileId,
      encoding: "utf-8",
      contentTypeId: "text/html",
      documentMode: "no-quirks",
      canonicalBaseUrl: "https://example.test/docs/",
      baseUrlClaimId: baseUrlClaim.id,
      baseUrlAcceptanceId: baseUrlAcceptance.id,
      policyEpoch: "policy:1",
      customElementRegistryIdentity: "registry:document:1",
      parserProfileId: parserProfile.id,
      upgradeEffectIds: [],
      adoptEffectIds: [],
    });
    const witnessContext = {
      acceptedObservationRelation: acceptedRelation,
      relationAcceptanceInput,
      acceptedCoverage,
      coverageValidationInput,
      template,
      sequenceLanguage,
      sequenceClaim,
      parserProfile,
      baseUrlClaim,
      selectionHostProfileIds: [hostProfileId],
      environmentCatalog: catalog,
      proofAcceptances: [sequenceAcceptance, baseUrlAcceptance],
      trustedProofAcceptanceIds: [sequenceAcceptance.id, baseUrlAcceptance.id],
    } as const;
    await expect(
      validateRealizationWitness(witness, witnessContext),
    ).resolves.toBeUndefined();
    expect(await parseRealizationWitness(witness)).toEqual(witness);

    const incompleteCoverageClaim = await createRealizationCoverageClaim({
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      inputPartitionId: relation.input.partition.id,
      templates: [],
      proofDomainId: TEST_DIGEST,
    });
    const incompleteAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: incompleteCoverageClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    await expectObservationError(async () => {
      await validateRealizationCoverageClaim({
        ...coverageValidationInput,
        claim: incompleteCoverageClaim,
        proofAcceptances: [incompleteAcceptance],
        trustedProofAcceptanceIds: [incompleteAcceptance.id],
      });
    }, "language-mismatch");

    const mismatchedStep = await createRealizationStep({
      kind: "artifact-token",
      templateSymbolId: artifactTemplateSymbol.id,
      artifactTokenClassId: "css-token",
      occurrenceIdentity: "token:0",
      artifactTokenId: "token:css:0",
      inputByteRangeDigest: TEST_DIGEST,
      outputObservationTokenDigest: expectedObservationTokenDigest,
    });
    const mismatchedSequenceClaim = await createRealizationSequenceClaim({
      witnessTemplateId: template.id,
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      inputClassId: relation.input.descriptor.id,
      realizationInputDigest: TEST_DIGEST,
      parserProfileId: parserProfile.id,
      proofDomainId: TEST_DIGEST,
      obligationIds: [obligation.id],
      steps: [mismatchedStep],
      parserSequence: [mismatchedStep.id],
      obligationOutputs: [
        { obligationId: obligation.id, outputStepId: mismatchedStep.id },
      ],
    });
    const mismatchedAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: mismatchedSequenceClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const mismatchedWitness = await createRealizationWitness({
      renderInstanceId: "render:1",
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      acceptedObservationRelationId: acceptedRelation.id,
      inputClassId: relation.input.descriptor.id,
      realizationInputDigest: TEST_DIGEST,
      acceptedCoverageId: acceptedCoverage.id,
      coverageClaimId: coverageClaim.id,
      coverageAcceptanceId: coverageAcceptance.id,
      witnessTemplateId: template.id,
      realizationSequenceClaimId: mismatchedSequenceClaim.id,
      sequenceAcceptanceId: mismatchedAcceptance.id,
      targetHostProfileId: hostProfileId,
      encoding: "utf-8",
      contentTypeId: "text/html",
      documentMode: "no-quirks",
      canonicalBaseUrl: "https://example.test/docs/",
      baseUrlClaimId: baseUrlClaim.id,
      baseUrlAcceptanceId: baseUrlAcceptance.id,
      policyEpoch: "policy:1",
      customElementRegistryIdentity: "registry:document:1",
      parserProfileId: parserProfile.id,
      upgradeEffectIds: [],
      adoptEffectIds: [],
    });
    await expectObservationError(async () => {
      await validateRealizationWitness(mismatchedWitness, {
        ...witnessContext,
        sequenceClaim: mismatchedSequenceClaim,
        proofAcceptances: [mismatchedAcceptance, baseUrlAcceptance],
        trustedProofAcceptanceIds: [
          mismatchedAcceptance.id,
          baseUrlAcceptance.id,
        ],
      });
    }, "invalid-parser-operation");

    const zeroInputStep = await createRealizationStep({
      kind: "parser-operation",
      templateSymbolId: zeroInputTemplateSymbol.id,
      occurrenceIdentity: "parser:zero",
      parserOperationId: "zero-input",
      inputStepIds: [],
      inputObservationTokenDigests: [],
      outputObservationTokenDigest: TEST_DIGEST,
    });
    const joinStep = await createRealizationStep({
      kind: "parser-operation",
      templateSymbolId: joinTemplateSymbol.id,
      occurrenceIdentity: "parser:join",
      parserOperationId: "join-token",
      inputStepIds: [directParserStep.id, zeroInputStep.id],
      inputObservationTokenDigests: [
        expectedObservationTokenDigest,
        TEST_DIGEST,
      ],
      outputObservationTokenDigest: expectedObservationTokenDigest,
    });
    const mixedBranchSequenceClaim = await createRealizationSequenceClaim({
      witnessTemplateId: template.id,
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      inputClassId: relation.input.descriptor.id,
      realizationInputDigest: TEST_DIGEST,
      parserProfileId: parserProfile.id,
      proofDomainId: TEST_DIGEST,
      obligationIds: [obligation.id],
      steps: [artifactStep, directParserStep, zeroInputStep, joinStep],
      parserSequence: [
        artifactStep.id,
        directParserStep.id,
        zeroInputStep.id,
        joinStep.id,
      ],
      obligationOutputs: [
        { obligationId: obligation.id, outputStepId: joinStep.id },
      ],
    });
    const mixedBranchAcceptance = await createObservationProofAcceptance({
      proofDomainId: TEST_DIGEST,
      claimDigest: mixedBranchSequenceClaim.id,
      attestationDigest: TEST_DIGEST,
    });
    const mixedBranchWitness = await createRealizationWitness({
      renderInstanceId: "render:mixed",
      observationContractId: relation.contract.id,
      behaviorSummaryId: relation.candidate.summary.id,
      acceptedObservationRelationId: acceptedRelation.id,
      inputClassId: relation.input.descriptor.id,
      realizationInputDigest: TEST_DIGEST,
      acceptedCoverageId: acceptedCoverage.id,
      coverageClaimId: coverageClaim.id,
      coverageAcceptanceId: coverageAcceptance.id,
      witnessTemplateId: template.id,
      realizationSequenceClaimId: mixedBranchSequenceClaim.id,
      sequenceAcceptanceId: mixedBranchAcceptance.id,
      targetHostProfileId: hostProfileId,
      encoding: "utf-8",
      contentTypeId: "text/html",
      documentMode: "no-quirks",
      canonicalBaseUrl: "https://example.test/docs/",
      baseUrlClaimId: baseUrlClaim.id,
      baseUrlAcceptanceId: baseUrlAcceptance.id,
      policyEpoch: "policy:1",
      customElementRegistryIdentity: "registry:document:1",
      parserProfileId: parserProfile.id,
      upgradeEffectIds: [],
      adoptEffectIds: [],
    });
    await expectObservationError(async () => {
      await validateRealizationWitness(mixedBranchWitness, {
        ...witnessContext,
        sequenceClaim: mixedBranchSequenceClaim,
        proofAcceptances: [mixedBranchAcceptance, baseUrlAcceptance],
        trustedProofAcceptanceIds: [
          mixedBranchAcceptance.id,
          baseUrlAcceptance.id,
        ],
      });
    }, "unproven-obligation");
  });
});
