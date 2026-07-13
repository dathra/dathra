import { describe, expect, expectTypeOf, it } from "vitest";

import {
  digestCanonicalJson,
  isSha256Digest,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import * as publicApi from "../index";
import {
  ObservationContractError,
  createObservationConstraint,
  createObservationContract,
  createObservationOrderEdge,
  createObservationRefinementRule,
  createObservationTraceLanguage,
  createObservationTraceSymbol,
  isObservationTraceLanguageSubset,
  parseObservationContract,
  parseObservationTraceLanguage,
  validateRealizationWitness,
  type ObservationAutomatonBudget,
  type ObservationContract,
  type ObservationContractErrorCode,
  type ObservationContractPathSegment,
  type ObservationEqualityInput,
  type ObservationProofAcceptance,
  type ObservationProofAcceptanceInput,
  type ObservationTraceLanguage,
} from "./implementation";

const EMPTY_SHA256 = "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU";

function requireDigest(value: string): Sha256Digest {
  if (!isSha256Digest(value)) {
    throw new Error(`Invalid fixture digest: ${value}`);
  }
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
    if (!(error instanceof ObservationContractError)) {
      throw error;
    }
    if (error.code !== code) {
      throw new Error(`Expected error code ${code}, received ${error.code}`);
    }
    if (
      path !== undefined &&
      (error.path.length !== path.length ||
        error.path.some((segment, index) => segment !== path[index]))
    ) {
      throw new Error(
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }

  throw new Error("Expected an ObservationContractError");
}

interface TrieTransition {
  readonly fromState: number;
  readonly symbolId: Sha256Digest;
  readonly toState: number;
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

  const records: TrieTransition[] = [];
  for (const [fromState, outgoing] of transitions) {
    for (const [symbolId, toState] of outgoing) {
      records.push({ fromState, symbolId, toState });
    }
  }

  return {
    alphabet,
    stateCount,
    initialState: 0,
    acceptingStates: [...acceptingStates],
    transitions: records,
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

describe("observation constraint and contract", () => {
  it("creates deterministic constraint, edge, rule, and contract identities", async () => {
    const first = await createObservationConstraint({
      kind: "event",
      subjectId: "button.click",
      visibility: "external",
      inputIdentityDomainId: "event.input/1",
      occurrenceIdentityDomainId: "event.occurrence/1",
      cardinality: { kind: "range", minimum: 0, maximum: 2 },
      admissionCutId: "activated",
      coalescingPolicyRequirement: null,
    });
    const second = await createObservationConstraint({
      coalescingPolicyRequirement: null,
      admissionCutId: "activated",
      cardinality: { maximum: 2, minimum: 0, kind: "range" },
      occurrenceIdentityDomainId: "event.occurrence/1",
      inputIdentityDomainId: "event.input/1",
      visibility: "external",
      subjectId: "button.click",
      kind: "event",
    });
    expect(first).toEqual(second);
    expect(first.id).toBe(
      await digestCanonicalJson({
        kind: "event",
        subjectId: "button.click",
        visibility: "external",
        inputIdentityDomainId: "event.input/1",
        occurrenceIdentityDomainId: "event.occurrence/1",
        cardinality: { kind: "range", minimum: 0, maximum: 2 },
        admissionCutId: "activated",
        coalescingPolicyRequirement: null,
      }),
    );

    const terminal = await createObservationConstraint({
      kind: "terminal",
      subjectId: "root.terminal",
      visibility: "external",
      outcomes: ["success"],
    });
    const edge = await createObservationOrderEdge({
      beforeConstraintId: first.id,
      afterConstraintId: terminal.id,
      relation: "strict",
    });
    const rule = await createObservationRefinementRule({
      kind: "narrow-cardinality",
      constraintIds: [first.id],
      proofDomainId: TEST_DIGEST,
    });
    const contract = await createObservationContract({
      rootDefinitionId: "root",
      externalInputIdentitySchemaId: "input/1",
      eventIdentitySchemaId: "event/1",
      initialCutId: "initial",
      relation: "trace-refinement",
      constraints: [terminal, first],
      orderEdges: [edge],
      refinementRules: [rule],
    });
    expect(contract.preimage.constraints.map(({ id }) => id)).toEqual(
      [first.id, terminal.id].toSorted(),
    );
    expect(contract.id).toBe(await digestCanonicalJson(contract.preimage));
    expect(Object.isFrozen(contract.preimage.constraints)).toBe(true);
    expect(await parseObservationContract(contract)).toEqual(contract);

    const noncanonicalPreimage = {
      ...contract.preimage,
      constraints: [...contract.preimage.constraints].reverse(),
    };
    const noncanonicalId = await digestCanonicalJson(noncanonicalPreimage);
    await expectObservationError(
      async () => {
        await parseObservationContract({
          id: noncanonicalId,
          preimage: noncanonicalPreimage,
        });
      },
      "noncanonical-order",
      ["preimage", "constraints"],
    );
  });

  it("rejects invalid cardinality, dangling edges, cycles, and equality rules", async () => {
    await expectObservationError(
      async () => {
        await createObservationConstraint({
          kind: "event",
          subjectId: "event",
          visibility: "external",
          inputIdentityDomainId: "input",
          occurrenceIdentityDomainId: "occurrence",
          cardinality: { kind: "range", minimum: 2, maximum: 1 },
          admissionCutId: "cut",
          coalescingPolicyRequirement: null,
        });
      },
      "invalid-cardinality",
      ["cardinality"],
    );

    const first = await createObservationConstraint({
      kind: "value",
      subjectId: "first",
      visibility: "external",
      equivalenceDomainId: "value/1",
      consistencyCutId: "cut",
    });
    const second = await createObservationConstraint({
      kind: "value",
      subjectId: "second",
      visibility: "external",
      equivalenceDomainId: "value/1",
      consistencyCutId: "cut",
    });
    const firstToSecond = await createObservationOrderEdge({
      beforeConstraintId: first.id,
      afterConstraintId: second.id,
      relation: "strict",
    });
    const secondToFirst = await createObservationOrderEdge({
      beforeConstraintId: second.id,
      afterConstraintId: first.id,
      relation: "strict",
    });
    await expectObservationError(async () => {
      await createObservationContract({
        rootDefinitionId: "root",
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
        relation: "trace-equality",
        constraints: [first, second],
        orderEdges: [firstToSecond, secondToFirst],
        refinementRules: [],
      });
    }, "order-cycle");

    const rule = await createObservationRefinementRule({
      kind: "equivalent-value",
      constraintIds: [first.id],
      proofDomainId: TEST_DIGEST,
    });
    await expectObservationError(async () => {
      await createObservationContract({
        rootDefinitionId: "root",
        externalInputIdentitySchemaId: "input/1",
        eventIdentitySchemaId: "event/1",
        initialCutId: "initial",
        relation: "trace-equality",
        constraints: [first],
        orderEdges: [],
        refinementRules: [rule],
      });
    }, "invalid-refinement");
  });

  it("rejects digest changes and accessors without executing them", async () => {
    const { contract } = await createTerminalContract();
    const tampered = {
      ...contract,
      preimage: {
        ...contract.preimage,
        rootDefinitionId: "different-root",
      },
    };
    await expectObservationError(async () => {
      await parseObservationContract(tampered);
    }, "digest-mismatch");

    let reads = 0;
    const malformed = { ...contract };
    Object.defineProperty(malformed, "preimage", {
      enumerable: true,
      get() {
        reads += 1;
        return contract.preimage;
      },
    });
    await expectObservationError(async () => {
      await parseObservationContract(malformed);
    }, "invalid-closed-record");
    expect(reads).toBe(0);
  });
});

describe("canonical trace language", () => {
  it("normalizes state numbering, removes unreachable states, and minimizes", async () => {
    const { terminalConstraintId } = await createTerminalContract();
    const symbol = await createObservationTraceSymbol({
      kind: "terminal",
      constraintId: terminalConstraintId,
      occurrenceOrdinal: 0,
      outcome: "success",
    });
    const canonical = await createObservationTraceLanguage(
      createTrieInput([symbol], [[symbol.id]]),
      TEST_BUDGET,
    );
    const renumbered = await createObservationTraceLanguage(
      {
        alphabet: [symbol],
        stateCount: 5,
        initialState: 2,
        acceptingStates: [4],
        transitions: [
          { fromState: 2, symbolId: symbol.id, toState: 4 },
          { fromState: 1, symbolId: symbol.id, toState: 3 },
        ],
      },
      TEST_BUDGET,
    );
    expect(renumbered).toEqual(canonical);
    expect(canonical.preimage.initialState).toBe(0);
    expect(await parseObservationTraceLanguage(canonical, TEST_BUDGET)).toEqual(
      canonical,
    );
  });

  it("distinguishes independent occurrence slots from serialized slots", async () => {
    const event = await createObservationConstraint({
      kind: "event",
      subjectId: "event",
      visibility: "external",
      inputIdentityDomainId: "input",
      occurrenceIdentityDomainId: "occurrence",
      cardinality: { kind: "exactly", count: 2 },
      admissionCutId: "cut",
      coalescingPolicyRequirement: null,
    });
    const first = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: event.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 0,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [],
    });
    const second = await createObservationTraceSymbol({
      kind: "occurrence",
      constraintId: event.id,
      occurrenceIdentityDomainDigest: TEST_DIGEST,
      occurrenceOrdinal: 1,
      observationTokenRelationDigest: TEST_DIGEST,
      inputEventSymbolIds: [],
    });
    expect(first.id).not.toBe(second.id);
    const serialized = await createObservationTraceLanguage(
      createTrieInput([first, second], [[first.id, second.id]]),
      TEST_BUDGET,
    );
    const independent = await createObservationTraceLanguage(
      createTrieInput(
        [first, second],
        [
          [first.id, second.id],
          [second.id, first.id],
        ],
      ),
      TEST_BUDGET,
    );
    expect(serialized.id).not.toBe(independent.id);
    expect(
      isObservationTraceLanguageSubset(serialized, independent, TEST_BUDGET),
    ).toBe(true);
    expect(
      isObservationTraceLanguageSubset(independent, serialized, TEST_BUDGET),
    ).toBe(false);
  });

  it("rejects productive accepting cycles and deterministic budget overflow", async () => {
    const { terminalConstraintId } = await createTerminalContract();
    const symbol = await createObservationTraceSymbol({
      kind: "terminal",
      constraintId: terminalConstraintId,
      occurrenceOrdinal: 0,
      outcome: "success",
    });
    await expectObservationError(async () => {
      await createObservationTraceLanguage(
        {
          alphabet: [symbol],
          stateCount: 1,
          initialState: 0,
          acceptingStates: [0],
          transitions: [{ fromState: 0, symbolId: symbol.id, toState: 0 }],
        },
        TEST_BUDGET,
      );
    }, "invalid-automaton");
    await expectObservationError(async () => {
      await createObservationTraceLanguage(
        createTrieInput([symbol], [[symbol.id]]),
        {
          ...TEST_BUDGET,
          maximumStateCount: 1,
        },
      );
    }, "budget-exceeded");
  });
});

describe("public surface", () => {
  it("exports the observation contract API and branded types", () => {
    expect(publicApi.createObservationContract).toBe(createObservationContract);
    expect(publicApi.createObservationTraceLanguage).toBe(
      createObservationTraceLanguage,
    );
    expect(publicApi.validateRealizationWitness).toBe(
      validateRealizationWitness,
    );
    expectTypeOf<
      ObservationTraceLanguage["id"]
    >().toEqualTypeOf<Sha256Digest>();
    expectTypeOf<
      ObservationProofAcceptance["id"]
    >().toEqualTypeOf<Sha256Digest>();
    expectTypeOf<
      ObservationProofAcceptanceInput["claimDigest"]
    >().toEqualTypeOf<Sha256Digest>();
    expectTypeOf<
      ObservationEqualityInput["contract"]
    >().toEqualTypeOf<ObservationContract>();
  });
});
