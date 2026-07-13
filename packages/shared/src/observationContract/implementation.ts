import {
  CanonicalIdentityError,
  canonicalizeJson,
  digestCanonicalJson,
  isSha256Digest,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import type {
  QualifiedRegistryId,
  RegistryEnvironmentCatalogRecord,
} from "../executionRegistry/implementation";

/** A property or array index in an observation contract failure path. */
type ObservationContractPathSegment = string | number;

/** Stable failure codes emitted by observation contract operations. */
type ObservationContractErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-cardinality"
  | "noncanonical-order"
  | "duplicate-record"
  | "digest-mismatch"
  | "dangling-reference"
  | "order-cycle"
  | "invalid-automaton"
  | "budget-exceeded"
  | "contract-mismatch"
  | "language-mismatch"
  | "invalid-refinement"
  | "missing-proof"
  | "ambiguous-proof"
  | "composition-conflict"
  | "unproven-obligation"
  | "invalid-parser-operation"
  | "host-profile-mismatch";

/** Describes why an observation contract value is invalid. */
class ObservationContractError extends TypeError {
  readonly code: ObservationContractErrorCode;
  readonly path: readonly ObservationContractPathSegment[];

  /** Creates an immutable observation contract failure. */
  constructor(
    code: ObservationContractErrorCode,
    path: readonly ObservationContractPathSegment[],
    message: string,
  ) {
    super(message);
    this.name = "ObservationContractError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

/** The permitted occurrence count for an observation constraint. */
type ObservationCardinality =
  | { readonly kind: "exactly"; readonly count: number }
  | {
      readonly kind: "range";
      readonly minimum: number;
      readonly maximum: number;
    };

/** Whether an observation is externally visible or only orders other work. */
type ObservationVisibility = "external" | "internal-ordering";

/** Immutable identity of a policy required by an observation contract. */
interface ObservationPolicyRequirement {
  readonly policyQualifiedId: QualifiedRegistryId<"policy">;
  readonly version: string;
  readonly policyRuleGraphDigest: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** A terminal outcome represented by an observation trace. */
type ObservationTerminalOutcome =
  | "success"
  | "typed-failure"
  | "cancelled"
  | "timed-out"
  | "disconnected"
  | "ambiguous";

interface ObservationConstraintBase<Kind extends string> {
  readonly kind: Kind;
  readonly id: Sha256Digest;
  readonly subjectId: string;
  readonly visibility: ObservationVisibility;
}

/** A closed, content-addressed observation requirement. */
type ObservationConstraint =
  | (ObservationConstraintBase<"value"> & {
      readonly equivalenceDomainId: string;
      readonly consistencyCutId: string;
    })
  | (ObservationConstraintBase<"dom"> & {
      readonly realizationDomainId: string;
      readonly mutableFacetPolicyId: string;
      readonly consistencyCutId: string;
    })
  | (ObservationConstraintBase<"artifact" | "protocol"> & {
      readonly byteOrMessageSchemaId: string;
      readonly cardinality: ObservationCardinality;
    })
  | (ObservationConstraintBase<"event" | "effect" | "callback"> & {
      readonly inputIdentityDomainId: string;
      readonly occurrenceIdentityDomainId: string;
      readonly cardinality: ObservationCardinality;
      readonly admissionCutId: string;
      readonly coalescingPolicyRequirement: ObservationPolicyRequirement | null;
    })
  | (ObservationConstraintBase<"identity" | "lifetime"> & {
      readonly identityDomainId: string;
      readonly lifetimeDomainId: string;
    })
  | (ObservationConstraintBase<"authority" | "exposure"> & {
      readonly policyQualifiedId: QualifiedRegistryId<"policy">;
      readonly policyEpochDomainId: string;
    })
  | {
      readonly kind: "terminal";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: "external";
      readonly outcomes: readonly ObservationTerminalOutcome[];
    };

type WithoutId<Value> = Value extends { readonly id: Sha256Digest }
  ? Omit<Value, "id">
  : never;

type WithoutSchema<Value> = Value extends { readonly schema: string }
  ? Omit<Value, "schema">
  : never;

/** Input used to create an observation constraint. */
type ObservationConstraintInput = WithoutId<ObservationConstraint>;

/** A partial-order or exclusion edge between observation constraints. */
interface ObservationOrderEdge {
  readonly id: Sha256Digest;
  readonly beforeConstraintId: Sha256Digest;
  readonly afterConstraintId: Sha256Digest;
  readonly relation: "strict" | "serial" | "exclusive";
}

/** Input used to create an observation order edge. */
type ObservationOrderEdgeInput = Omit<ObservationOrderEdge, "id">;

/** A closed rule that permits a bounded observation refinement. */
interface ObservationRefinementRule {
  readonly id: Sha256Digest;
  readonly kind:
    | "equivalent-value"
    | "narrow-cardinality"
    | "omit-unobservable-internal-step"
    | "commutative-reorder"
    | "declared-event-coalescing";
  readonly constraintIds: readonly Sha256Digest[];
  readonly proofDomainId: Sha256Digest;
}

/** Input used to create an observation refinement rule. */
type ObservationRefinementRuleInput = Omit<ObservationRefinementRule, "id">;

/** Canonical preimage of an observation contract. */
interface ObservationContractPreimage {
  readonly schema: "dathra.observation-contract/3";
  readonly rootDefinitionId: string;
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
  readonly relation: "trace-equality" | "trace-refinement";
  readonly constraints: readonly ObservationConstraint[];
  readonly orderEdges: readonly ObservationOrderEdge[];
  readonly refinementRules: readonly ObservationRefinementRule[];
}

/** A canonical observation contract and its content identity. */
interface ObservationContract {
  readonly id: Sha256Digest;
  readonly preimage: ObservationContractPreimage;
}

/** Input used to create an observation contract. */
type ObservationContractInput = Omit<ObservationContractPreimage, "schema">;

/** One symbol in a finite observation trace language. */
type ObservationTraceSymbol =
  | {
      readonly kind: "event";
      readonly id: Sha256Digest;
      readonly identityDomainDigest: Sha256Digest;
      readonly occurrenceOrdinal: number;
    }
  | {
      readonly kind: "occurrence";
      readonly id: Sha256Digest;
      readonly constraintId: Sha256Digest;
      readonly occurrenceIdentityDomainDigest: Sha256Digest;
      readonly occurrenceOrdinal: number;
      readonly observationTokenRelationDigest: Sha256Digest;
      readonly inputEventSymbolIds: readonly Sha256Digest[];
    }
  | {
      readonly kind: "terminal";
      readonly id: Sha256Digest;
      readonly constraintId: Sha256Digest;
      readonly occurrenceOrdinal: number;
      readonly outcome: ObservationTerminalOutcome;
    };

/** Input used to create an observation trace symbol. */
type ObservationTraceSymbolInput = WithoutId<ObservationTraceSymbol>;

/** A deterministic automaton transition. */
interface ObservationAutomatonTransition {
  readonly fromState: number;
  readonly symbolId: Sha256Digest;
  readonly toState: number;
}

/** Hard limits for observation automaton operations. */
interface ObservationAutomatonBudget {
  readonly maximumAlphabetSize: number;
  readonly maximumStateCount: number;
  readonly maximumTransitionCount: number;
  readonly maximumDeterminizedStateCount: number;
  readonly maximumProductStateCount: number;
}

interface AutomatonInput<Symbol> {
  readonly alphabet: readonly Symbol[];
  readonly stateCount: number;
  readonly initialState: number;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

/** Input used to create a canonical observation trace language. */
interface ObservationTraceLanguageInput extends AutomatonInput<ObservationTraceSymbol> {}

/** Canonical preimage of a complete minimal observation trace DFA. */
interface ObservationTraceLanguagePreimage extends AutomatonInput<ObservationTraceSymbol> {
  readonly schema: "dathra.observation-trace-language/1";
  readonly initialState: 0;
}

/** A canonical finite language of observation traces. */
interface ObservationTraceLanguage {
  readonly id: Sha256Digest;
  readonly preimage: ObservationTraceLanguagePreimage;
}

type ObservationInputSymbol = Extract<
  ObservationTraceSymbol,
  { readonly kind: "event" }
>;

interface ObservationInputLanguageInput extends AutomatonInput<ObservationInputSymbol> {}

interface ObservationInputLanguagePreimage extends AutomatonInput<ObservationInputSymbol> {
  readonly schema: "dathra.observation-input-language/1";
  readonly initialState: 0;
}

/** A canonical finite language over external input event symbols. */
interface ObservationInputLanguage {
  readonly id: Sha256Digest;
  readonly preimage: ObservationInputLanguagePreimage;
}

interface ObservationInputClassDescriptorPreimage {
  readonly schema: "dathra.observation-input-class/1";
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
  readonly selectorLanguageId: Sha256Digest;
}

/** One content-addressed selector in an external input partition. */
interface ObservationInputClassDescriptor {
  readonly id: Sha256Digest;
  readonly preimage: ObservationInputClassDescriptorPreimage;
}

type ObservationInputClassDescriptorInput = Omit<
  ObservationInputClassDescriptorPreimage,
  "schema"
>;

interface ObservationInputPartitionPreimage {
  readonly schema: "dathra.observation-input-partition/1";
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
  readonly universeLanguageId: Sha256Digest;
  readonly inputClasses: readonly ObservationInputClassDescriptor[];
}

/** A closed finite partition of the external input universe. */
interface ObservationInputPartition {
  readonly id: Sha256Digest;
  readonly preimage: ObservationInputPartitionPreimage;
}

type ObservationInputPartitionInput = Omit<
  ObservationInputPartitionPreimage,
  "schema"
>;

interface ObservationInputPartitionPolicyClaimPreimage {
  readonly schema: "dathra.observation-input-partition-policy-claim/1";
  readonly inputPartitionId: Sha256Digest;
  readonly universeLanguageId: Sha256Digest;
  readonly inputClassIds: readonly Sha256Digest[];
  readonly proofDomainId: Sha256Digest;
}

/** A proof claim connecting selector symbols to an external input schema. */
interface ObservationInputPartitionPolicyClaim {
  readonly id: Sha256Digest;
  readonly preimage: ObservationInputPartitionPolicyClaimPreimage;
}

type ObservationInputPartitionPolicyClaimInput = Omit<
  ObservationInputPartitionPolicyClaimPreimage,
  "schema"
>;

/** Canonical preimage of a behavior summary. */
interface ObservationBehaviorSummaryPreimage {
  readonly schema: "dathra.observation-behavior/2";
  readonly role: "source" | "candidate";
  readonly observationContractId: Sha256Digest;
  readonly semanticGraphDigest: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly traceLanguageId: Sha256Digest;
  }[];
}

/** A content-addressed map from input classes to trace languages. */
interface ObservationBehaviorSummary {
  readonly id: Sha256Digest;
  readonly preimage: ObservationBehaviorSummaryPreimage;
}

/** Input used to create an observation behavior summary. */
type ObservationBehaviorSummaryInput = Omit<
  ObservationBehaviorSummaryPreimage,
  "schema"
>;

/** Canonical preimage of a proof claim for one behavior summary derivation. */
interface ObservationBehaviorDerivationClaimPreimage {
  readonly schema: "dathra.observation-behavior-derivation-claim/2";
  readonly behaviorSummaryId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly semanticGraphDigest: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** A content-addressed claim that a summary covers a semantic graph. */
interface ObservationBehaviorDerivationClaim {
  readonly id: Sha256Digest;
  readonly preimage: ObservationBehaviorDerivationClaimPreimage;
}

/** Input used to create a behavior derivation claim. */
type ObservationBehaviorDerivationClaimInput = Omit<
  ObservationBehaviorDerivationClaimPreimage,
  "schema"
>;

interface AcceptedObservationBehaviorPreimage {
  readonly schema: "dathra.accepted-observation-behavior/1";
  readonly behaviorSummaryId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly partitionPolicyAcceptanceId: Sha256Digest;
  readonly behaviorDerivationAcceptanceId: Sha256Digest;
}

/** A validated behavior summary and its exact proof closure. */
interface AcceptedObservationBehavior {
  readonly id: Sha256Digest;
  readonly preimage: AcceptedObservationBehaviorPreimage;
}

/** One paired or epsilon symbol in an observation relation. */
interface ObservationRelationSymbol {
  readonly id: Sha256Digest;
  readonly sourceSymbolId: Sha256Digest | null;
  readonly candidateSymbolId: Sha256Digest | null;
  readonly ruleId: Sha256Digest | null;
}

/** Input used to create an observation relation symbol. */
type ObservationRelationSymbolInput = Omit<ObservationRelationSymbol, "id">;

/** Input used to create a canonical observation relation language. */
interface ObservationRelationLanguageInput extends AutomatonInput<ObservationRelationSymbol> {}

/** Canonical preimage of a complete minimal observation relation DFA. */
interface ObservationRelationLanguagePreimage extends AutomatonInput<ObservationRelationSymbol> {
  readonly schema: "dathra.observation-relation-language/1";
  readonly initialState: 0;
}

/** A canonical finite relation between source and candidate traces. */
interface ObservationRelationLanguage {
  readonly id: Sha256Digest;
  readonly preimage: ObservationRelationLanguagePreimage;
}

interface ObservationRulePolicyDescriptorPreimage {
  readonly schema: "dathra.observation-rule-policy/2";
  readonly observationContractId: Sha256Digest;
  readonly ruleId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly sourceTraceLanguageId: Sha256Digest;
  readonly candidateTraceLanguageId: Sha256Digest;
  readonly policyQualifiedId: QualifiedRegistryId<"policy">;
  readonly version: string;
  readonly policyRuleGraphDigest: Sha256Digest;
  readonly policyTransducerLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** A versioned, content-addressed policy for one rule transducer. */
interface ObservationRulePolicyDescriptor {
  readonly id: Sha256Digest;
  readonly preimage: ObservationRulePolicyDescriptorPreimage;
}

type ObservationRulePolicyDescriptorInput = Omit<
  ObservationRulePolicyDescriptorPreimage,
  "schema"
>;

interface ObservationPolicyDerivationClaimPreimage {
  readonly schema: "dathra.observation-policy-derivation-claim/1";
  readonly policyDescriptorId: Sha256Digest;
  readonly policyLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** A proof claim created before any application or comparison. */
interface ObservationPolicyDerivationClaim {
  readonly id: Sha256Digest;
  readonly preimage: ObservationPolicyDerivationClaimPreimage;
}

type ObservationPolicyDerivationClaimInput = Omit<
  ObservationPolicyDerivationClaimPreimage,
  "schema"
>;

interface ObservationRuleApplicationBase {
  readonly schema: "dathra.observation-rule-application/3";
  readonly ruleId: Sha256Digest;
  readonly sourceSummaryId: Sha256Digest;
  readonly candidateSummaryId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** Canonical preimage of one closed refinement-rule application. */
type ObservationRuleApplicationPreimage = ObservationRuleApplicationBase &
  (
    | {
        readonly kind: "equivalent-value";
        readonly allowedTokenPairs: readonly {
          readonly sourceSymbolId: Sha256Digest;
          readonly candidateSymbolId: Sha256Digest;
        }[];
      }
    | {
        readonly kind: "narrow-cardinality";
        readonly constraintId: Sha256Digest;
        readonly sourceCardinality: ObservationCardinality;
        readonly candidateCardinality: ObservationCardinality;
        readonly slotMappings: readonly {
          readonly sourceSymbolId: Sha256Digest;
          readonly candidateSymbolId: Sha256Digest | null;
        }[];
      }
    | {
        readonly kind: "omit-unobservable-internal-step";
        readonly constraintId: Sha256Digest;
        readonly omittedSourceSymbolIds: readonly Sha256Digest[];
      }
    | {
        readonly kind: "commutative-reorder";
        readonly compositionId: Sha256Digest;
        readonly bindingId: Sha256Digest;
        readonly policyDescriptorId: Sha256Digest;
        readonly policyAcceptanceId: Sha256Digest;
      }
    | {
        readonly kind: "declared-event-coalescing";
        readonly constraintId: Sha256Digest;
        readonly policyDescriptorId: Sha256Digest;
        readonly policyAcceptanceId: Sha256Digest;
        readonly eventSlotMappings: readonly {
          readonly sourceEventSymbolId: Sha256Digest;
          readonly candidateOccurrenceSymbolId: Sha256Digest;
        }[];
        readonly overflowTerminalSymbolId: Sha256Digest | null;
      }
  );

/** A content-addressed application of an observation refinement rule. */
interface ObservationRuleApplication {
  readonly id: Sha256Digest;
  readonly preimage: ObservationRuleApplicationPreimage;
}

/** Input used to create an observation refinement-rule application. */
type ObservationRuleApplicationInput =
  WithoutSchema<ObservationRuleApplicationPreimage>;

/** Canonical preimage of a source-to-candidate comparison claim. */
interface ObservationComparisonClaimPreimage {
  readonly schema: "dathra.observation-comparison-claim/2";
  readonly observationContractId: Sha256Digest;
  readonly compositionId: Sha256Digest | null;
  readonly direction: "source-to-candidate";
  readonly sourceSummaryId: Sha256Digest;
  readonly candidateSummaryId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly ruleApplicationIds: readonly Sha256Digest[];
    readonly ruleApplicationAcceptanceIds: readonly Sha256Digest[];
  }[];
}

/** A content-addressed behavior comparison claim. */
interface ObservationComparisonClaim {
  readonly id: Sha256Digest;
  readonly preimage: ObservationComparisonClaimPreimage;
}

/** Input used to create a behavior comparison claim. */
type ObservationComparisonClaimInput = Omit<
  ObservationComparisonClaimPreimage,
  "schema" | "direction"
>;

/** Canonical preimage of a proof-domain acceptance record. */
interface ObservationProofAcceptancePreimage {
  readonly schema: "dathra.observation-proof-acceptance/1";
  readonly proofDomainId: Sha256Digest;
  readonly claimDigest: Sha256Digest;
  readonly attestationDigest: Sha256Digest;
}

/** A structural proof acceptance that is trusted only by an external context. */
interface ObservationProofAcceptance {
  readonly id: Sha256Digest;
  readonly preimage: ObservationProofAcceptancePreimage;
}

/** Input used to create a structural proof acceptance record. */
type ObservationProofAcceptanceInput = Omit<
  ObservationProofAcceptancePreimage,
  "schema"
>;

/** Proof records and the exact acceptance identities trusted by a caller. */
interface TrustedObservationProofContext {
  readonly proofAcceptances: readonly ObservationProofAcceptance[];
  readonly trustedProofAcceptanceIds: readonly Sha256Digest[];
}

/** Complete inputs required to validate one behavior summary. */
interface ObservationBehaviorValidationInput extends TrustedObservationProofContext {
  readonly contract: ObservationContract;
  readonly summary: ObservationBehaviorSummary;
  readonly inputPartition: ObservationInputPartition;
  readonly inputLanguages: readonly ObservationInputLanguage[];
  readonly traceLanguages: readonly ObservationTraceLanguage[];
  readonly partitionPolicyClaim: ObservationInputPartitionPolicyClaim;
  readonly behaviorDerivationClaim: ObservationBehaviorDerivationClaim;
  readonly budget: ObservationAutomatonBudget;
}

/** Canonical preimage of a fully accepted observation relation. */
interface AcceptedObservationRelationPreimage {
  readonly schema: "dathra.accepted-observation-relation/2";
  readonly comparisonClaimId: Sha256Digest;
  readonly sourceBehaviorAcceptanceId: Sha256Digest;
  readonly candidateBehaviorAcceptanceId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly derivedAllowedRelationLanguageId: Sha256Digest;
    readonly ruleApplicationAcceptanceIds: readonly Sha256Digest[];
  }[];
}

/** A content-addressed commitment to every proof used by a comparison. */
interface AcceptedObservationRelation {
  readonly id: Sha256Digest;
  readonly preimage: AcceptedObservationRelationPreimage;
}

/** Result of comparing two behavior summaries for trace equality. */
interface ObservationComparisonDecision {
  readonly legal: boolean;
  readonly relation: "trace-equality" | "trace-refinement";
  readonly reason: string | null;
  readonly appliedRuleIds: readonly Sha256Digest[];
}

/** Input used to compare two behavior summaries for equality. */
interface ObservationEqualityInput {
  readonly contract: ObservationContract;
  readonly source: ObservationBehaviorSummary;
  readonly candidate: ObservationBehaviorSummary;
  readonly traceLanguages: readonly ObservationTraceLanguage[];
}

/** Complete closure required to derive and accept an observation relation. */
interface ObservationRelationAcceptanceInput extends TrustedObservationProofContext {
  readonly claim: ObservationComparisonClaim;
  readonly contract: ObservationContract;
  readonly sourceBehavior: ObservationBehaviorValidationInput;
  readonly candidateBehavior: ObservationBehaviorValidationInput;
  readonly traceLanguages: readonly ObservationTraceLanguage[];
  readonly actualRelationLanguages: readonly ObservationRelationLanguage[];
  readonly ruleApplications: readonly ObservationRuleApplication[];
  readonly policyDescriptors: readonly ObservationRulePolicyDescriptor[];
  readonly policyDerivationClaims: readonly ObservationPolicyDerivationClaim[];
  readonly policyTransducerLanguages: readonly ObservationRelationLanguage[];
  readonly compositionContexts: readonly ObservationRelationCompositionContext[];
  readonly budget: ObservationAutomatonBudget;
}

/** A composition and its member contracts available to refinement validation. */
interface ObservationRelationCompositionContext {
  readonly composition: ObservationComposition;
  readonly memberContracts: readonly ObservationContract[];
}

/** Inputs used to deterministically derive one class's allowed relation. */
interface ObservationAllowedRelationDerivationInput {
  readonly contract: ObservationContract;
  readonly sourceSummary: ObservationBehaviorSummary;
  readonly candidateSummary: ObservationBehaviorSummary;
  readonly inputClassId: Sha256Digest;
  readonly sourceLanguage: ObservationTraceLanguage;
  readonly candidateLanguage: ObservationTraceLanguage;
  readonly ruleApplications: readonly ObservationRuleApplication[];
  readonly policyDescriptors: readonly ObservationRulePolicyDescriptor[];
  readonly policyTransducerLanguages: readonly ObservationRelationLanguage[];
  readonly compositionContexts: readonly ObservationRelationCompositionContext[];
  readonly budget: ObservationAutomatonBudget;
}

/** A contract-qualified reference to one observation constraint. */
interface ObservationConstraintReference {
  readonly contractId: Sha256Digest;
  readonly constraintId: Sha256Digest;
}

/** A canonical resolution for constraints sharing a subject and kind. */
interface ObservationCompositionBinding {
  readonly schema: "dathra.observation-composition-binding/3";
  readonly id: Sha256Digest;
  readonly sharedSubjectId: string;
  readonly constraintKind: ObservationConstraint["kind"];
  readonly members: readonly ObservationConstraintReference[];
  readonly resolution:
    | { readonly kind: "merge-identical" }
    | {
        readonly kind: "exclusive-owner";
        readonly owner: ObservationConstraintReference;
      }
    | {
        readonly kind: "commutative";
        readonly policyRequirement: ObservationPolicyRequirement;
      }
    | {
        readonly kind: "total-order";
        readonly orderedMembers: readonly ObservationConstraintReference[];
        readonly policyRequirement: ObservationPolicyRequirement;
      };
}

/** Input used to create an observation composition binding. */
type ObservationCompositionBindingInput = Omit<
  ObservationCompositionBinding,
  "schema" | "id"
>;

interface ObservationCompositionResultContractHeader {
  readonly rootDefinitionId: string;
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
}

interface ObservationCompositionAlgebraDescriptorPreimage {
  readonly schema: "dathra.observation-composition-algebra/2";
  readonly operationKind: "commutative" | "total-order";
  readonly version: string;
  readonly constraintKind: ObservationConstraint["kind"];
  readonly policyQualifiedId: QualifiedRegistryId<"policy">;
  readonly policyRuleGraphDigest: Sha256Digest;
  readonly policyTransducerLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** A versioned algebra and policy transducer for one binding kind. */
interface ObservationCompositionAlgebraDescriptor {
  readonly id: Sha256Digest;
  readonly preimage: ObservationCompositionAlgebraDescriptorPreimage;
}

type ObservationCompositionAlgebraDescriptorInput = Omit<
  ObservationCompositionAlgebraDescriptorPreimage,
  "schema"
>;

/** Canonical preimage of a derived observation composition. */
interface ObservationCompositionPreimage {
  readonly schema: "dathra.observation-composition/4";
  readonly memberContractIds: readonly Sha256Digest[];
  readonly bindings: readonly ObservationCompositionBinding[];
  readonly resultContract: ObservationContract;
  readonly memberToResult: readonly {
    readonly member: ObservationConstraintReference;
    readonly resultConstraintId: Sha256Digest;
  }[];
  readonly resultOrderClosure: readonly {
    readonly beforeConstraintId: Sha256Digest;
    readonly afterConstraintId: Sha256Digest;
  }[];
}

/** A canonical composition derived from shared observation constraints. */
interface ObservationComposition {
  readonly id: Sha256Digest;
  readonly preimage: ObservationCompositionPreimage;
}

/** Input used to derive an observation composition. */
interface ObservationCompositionInput {
  readonly memberContracts: readonly ObservationContract[];
  readonly bindings: readonly ObservationCompositionBinding[];
  readonly resultContractHeader: ObservationCompositionResultContractHeader;
}

/** One symbol in a multi-tape composition relation. */
interface ObservationCompositionRelationSymbol {
  readonly id: Sha256Digest;
  readonly memberSymbolIds: readonly (Sha256Digest | null)[];
  readonly resultSymbolId: Sha256Digest | null;
  readonly bindingId: Sha256Digest | null;
}

/** Input used to create a composition relation symbol. */
type ObservationCompositionRelationSymbolInput = Omit<
  ObservationCompositionRelationSymbol,
  "id"
>;

/** Input used to create a canonical composition relation language. */
interface ObservationCompositionRelationLanguageInput extends AutomatonInput<ObservationCompositionRelationSymbol> {}

/** Canonical preimage of a multi-tape composition relation DFA. */
interface ObservationCompositionRelationLanguagePreimage extends AutomatonInput<ObservationCompositionRelationSymbol> {
  readonly schema: "dathra.observation-composition-relation-language/1";
  readonly initialState: 0;
}

/** A canonical finite relation between member and result traces. */
interface ObservationCompositionRelationLanguage {
  readonly id: Sha256Digest;
  readonly preimage: ObservationCompositionRelationLanguagePreimage;
}

interface ObservationCompositionPolicyApplicationPreimage {
  readonly schema: "dathra.observation-composition-policy-application/1";
  readonly compositionId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly memberTraceLanguageIds: readonly Sha256Digest[];
  readonly resultTraceLanguageId: Sha256Digest;
  readonly bindingId: Sha256Digest;
  readonly algebraDescriptorId: Sha256Digest;
  readonly policyLanguageId: Sha256Digest;
}

/** A class-local application of one structural binding policy. */
interface ObservationCompositionPolicyApplication {
  readonly id: Sha256Digest;
  readonly preimage: ObservationCompositionPolicyApplicationPreimage;
}

type ObservationCompositionPolicyApplicationInput = Omit<
  ObservationCompositionPolicyApplicationPreimage,
  "schema"
>;

interface ObservationCompositionPolicyDerivationClaimPreimage {
  readonly schema: "dathra.observation-composition-policy-derivation-claim/1";
  readonly policyApplicationId: Sha256Digest;
  readonly algebraDescriptorId: Sha256Digest;
  readonly policyLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** An upstream-only proof claim for one class-local composition policy. */
interface ObservationCompositionPolicyDerivationClaim {
  readonly id: Sha256Digest;
  readonly preimage: ObservationCompositionPolicyDerivationClaimPreimage;
}

type ObservationCompositionPolicyDerivationClaimInput = Omit<
  ObservationCompositionPolicyDerivationClaimPreimage,
  "schema"
>;

interface ObservationCompositionPolicyClosure {
  readonly bindingId: Sha256Digest;
  readonly policyApplicationId: Sha256Digest;
  readonly policyDerivationClaimId: Sha256Digest;
  readonly policyAcceptanceId: Sha256Digest;
}

/** Canonical preimage of a composition behavior claim. */
interface ObservationCompositionClaimPreimage {
  readonly schema: "dathra.observation-composition-claim/3";
  readonly compositionId: Sha256Digest;
  readonly resultContractId: Sha256Digest;
  readonly memberSummaryIds: readonly Sha256Digest[];
  readonly resultSummaryId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly memberTraceLanguageIds: readonly Sha256Digest[];
    readonly resultTraceLanguageId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly bindingIds: readonly Sha256Digest[];
    readonly policyClosures: readonly ObservationCompositionPolicyClosure[];
  }[];
}

/** A content-addressed claim about composed behavior. */
interface ObservationCompositionClaim {
  readonly id: Sha256Digest;
  readonly preimage: ObservationCompositionClaimPreimage;
}

/** Input used to create a composition behavior claim. */
type ObservationCompositionClaimInput = Omit<
  ObservationCompositionClaimPreimage,
  "schema"
>;

interface AcceptedObservationCompositionPreimage {
  readonly schema: "dathra.accepted-observation-composition/2";
  readonly compositionClaimId: Sha256Digest;
  readonly memberBehaviorAcceptanceIds: readonly Sha256Digest[];
  readonly resultBehaviorAcceptanceId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly derivedAllowedRelationLanguageId: Sha256Digest;
    readonly policyClosures: readonly ObservationCompositionPolicyClosure[];
  }[];
}

/** A validated multi-tape composition relation and behavior closure. */
interface AcceptedObservationComposition {
  readonly id: Sha256Digest;
  readonly preimage: AcceptedObservationCompositionPreimage;
}

interface ObservationCompositionAcceptanceInput extends TrustedObservationProofContext {
  readonly claim: ObservationCompositionClaim;
  readonly composition: ObservationComposition;
  readonly memberContracts: readonly ObservationContract[];
  readonly memberBehaviors: readonly ObservationBehaviorValidationInput[];
  readonly resultBehavior: ObservationBehaviorValidationInput;
  readonly traceLanguages: readonly ObservationTraceLanguage[];
  readonly actualRelationLanguages: readonly ObservationCompositionRelationLanguage[];
  readonly policyApplications: readonly ObservationCompositionPolicyApplication[];
  readonly algebraDescriptors: readonly ObservationCompositionAlgebraDescriptor[];
  readonly policyDerivationClaims: readonly ObservationCompositionPolicyDerivationClaim[];
  readonly policyTransducerLanguages: readonly ObservationCompositionRelationLanguage[];
  readonly budget: ObservationAutomatonBudget;
}

/** Inputs used to deterministically derive one class's composition relation. */
interface ObservationCompositionRelationDerivationInput {
  readonly composition: ObservationComposition;
  readonly memberContracts: readonly ObservationContract[];
  readonly inputClassId: Sha256Digest;
  readonly memberLanguages: readonly ObservationTraceLanguage[];
  readonly resultLanguage: ObservationTraceLanguage;
  readonly bindingIds: readonly Sha256Digest[];
  readonly policyApplications: readonly ObservationCompositionPolicyApplication[];
  readonly algebraDescriptors: readonly ObservationCompositionAlgebraDescriptor[];
  readonly policyTransducerLanguages: readonly ObservationCompositionRelationLanguage[];
  readonly budget: ObservationAutomatonBudget;
}

/** One atomic server-realization obligation. */
interface RealizationObligation {
  readonly id: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly constraintId: Sha256Digest;
  readonly observableIdentity: string;
  readonly expectedObservationTokenDigest: Sha256Digest;
}

/** Input used to create a realization obligation. */
type RealizationObligationInput = Omit<RealizationObligation, "id">;

/** One symbolic step in a realization sequence language. */
type RealizationTemplateStepSymbol =
  | {
      readonly kind: "artifact-token";
      readonly id: Sha256Digest;
      readonly artifactTokenClassId: string;
      readonly outputTokenRelationDigest: Sha256Digest;
    }
  | {
      readonly kind: "parser-operation";
      readonly id: Sha256Digest;
      readonly parserOperationId: string;
      readonly inputSymbolIds: readonly Sha256Digest[];
      readonly outputTokenRelationDigest: Sha256Digest;
    };

/** Input used to create a symbolic realization step. */
type RealizationTemplateStepSymbolInput =
  WithoutId<RealizationTemplateStepSymbol>;

/** Input used to create a canonical realization sequence language. */
interface RealizationSequenceLanguageInput extends AutomatonInput<RealizationTemplateStepSymbol> {}

/** Canonical preimage of a complete minimal realization sequence DFA. */
interface RealizationSequenceLanguagePreimage extends AutomatonInput<RealizationTemplateStepSymbol> {
  readonly schema: "dathra.realization-sequence-language/1";
  readonly initialState: 0;
}

/** A canonical finite language of symbolic realization steps. */
interface RealizationSequenceLanguage {
  readonly id: Sha256Digest;
  readonly preimage: RealizationSequenceLanguagePreimage;
}

/** Canonical preimage of a parser profile used for realization validation. */
interface CanonicalParserProfilePreimage {
  readonly schema: "dathra.canonical-parser-profile/1";
  readonly targetHostProfileId: QualifiedRegistryId<"host-profile">;
  readonly version: string;
  readonly encoding: "utf-8";
  readonly contentTypeIds: readonly string[];
  readonly documentModes: readonly (
    | "no-quirks"
    | "limited-quirks"
    | "quirks"
  )[];
  readonly parserOperationIds: readonly string[];
  readonly sequenceProofDomainId: Sha256Digest;
  readonly baseUrlProofDomainId: Sha256Digest;
}

/** A canonical parser profile. */
interface CanonicalParserProfile {
  readonly id: Sha256Digest;
  readonly preimage: CanonicalParserProfilePreimage;
}

/** Input used to create a canonical parser profile. */
type CanonicalParserProfileInput = Omit<
  CanonicalParserProfilePreimage,
  "schema"
>;

/** Canonical preimage of a base URL proof claim. */
interface CanonicalBaseUrlClaimPreimage {
  readonly schema: "dathra.canonical-base-url-claim/1";
  readonly parserProfileId: Sha256Digest;
  readonly canonicalBaseUrl: string;
  readonly proofDomainId: Sha256Digest;
}

/** A canonical base URL claim. */
interface CanonicalBaseUrlClaim {
  readonly id: Sha256Digest;
  readonly preimage: CanonicalBaseUrlClaimPreimage;
}

/** Input used to create a canonical base URL claim. */
type CanonicalBaseUrlClaimInput = Omit<CanonicalBaseUrlClaimPreimage, "schema">;

/** One concrete step in a realization sequence. */
type RealizationStep =
  | {
      readonly kind: "artifact-token";
      readonly id: Sha256Digest;
      readonly templateSymbolId: Sha256Digest;
      readonly artifactTokenClassId: string;
      readonly occurrenceIdentity: string;
      readonly artifactTokenId: string;
      readonly inputByteRangeDigest: Sha256Digest;
      readonly outputObservationTokenDigest: Sha256Digest;
    }
  | {
      readonly kind: "parser-operation";
      readonly id: Sha256Digest;
      readonly templateSymbolId: Sha256Digest;
      readonly occurrenceIdentity: string;
      readonly parserOperationId: string;
      readonly inputStepIds: readonly Sha256Digest[];
      readonly inputObservationTokenDigests: readonly Sha256Digest[];
      readonly outputObservationTokenDigest: Sha256Digest;
    };

/** Input used to create a concrete realization step. */
type RealizationStepInput = WithoutId<RealizationStep>;

/** Canonical preimage of a concrete realization sequence claim. */
interface RealizationSequenceClaimPreimage {
  readonly schema: "dathra.realization-sequence-claim/2";
  readonly witnessTemplateId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly realizationInputDigest: Sha256Digest;
  readonly parserProfileId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
  readonly obligationIds: readonly Sha256Digest[];
  readonly steps: readonly RealizationStep[];
  readonly parserSequence: readonly Sha256Digest[];
  readonly obligationOutputs: readonly {
    readonly obligationId: Sha256Digest;
    readonly outputStepId: Sha256Digest;
  }[];
}

/** A canonical concrete realization sequence claim. */
interface RealizationSequenceClaim {
  readonly id: Sha256Digest;
  readonly preimage: RealizationSequenceClaimPreimage;
}

/** Input used to create a concrete realization sequence claim. */
type RealizationSequenceClaimInput = Omit<
  RealizationSequenceClaimPreimage,
  "schema"
>;

/** Canonical preimage of a symbolic realization witness template. */
interface RealizationWitnessTemplatePreimage {
  readonly schema: "dathra.realization-witness-template/1";
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly parserProfileId: Sha256Digest;
  readonly obligations: readonly RealizationObligation[];
  readonly sequenceLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

/** A canonical symbolic realization witness template. */
interface RealizationWitnessTemplate {
  readonly id: Sha256Digest;
  readonly preimage: RealizationWitnessTemplatePreimage;
}

/** Input used to create a realization witness template. */
type RealizationWitnessTemplateInput = Omit<
  RealizationWitnessTemplatePreimage,
  "schema"
>;

/** Canonical preimage of symbolic realization coverage. */
interface RealizationCoverageClaimPreimage {
  readonly schema: "dathra.realization-coverage-claim/2";
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly templates: readonly {
    readonly inputClassId: Sha256Digest;
    readonly witnessTemplateId: Sha256Digest;
  }[];
  readonly proofDomainId: Sha256Digest;
}

/** A canonical symbolic realization coverage claim. */
interface RealizationCoverageClaim {
  readonly id: Sha256Digest;
  readonly preimage: RealizationCoverageClaimPreimage;
}

/** Input used to create a realization coverage claim. */
type RealizationCoverageClaimInput = Omit<
  RealizationCoverageClaimPreimage,
  "schema"
>;

/** Canonical preimage of fully validated symbolic realization coverage. */
interface AcceptedRealizationCoveragePreimage {
  readonly schema: "dathra.accepted-realization-coverage/1";
  readonly coverageClaimId: Sha256Digest;
  readonly behaviorAcceptanceId: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly witnessTemplateIds: readonly Sha256Digest[];
  readonly coverageAcceptanceId: Sha256Digest;
}

/** A validated exact mapping from every input class to one witness template. */
interface AcceptedRealizationCoverage {
  readonly id: Sha256Digest;
  readonly preimage: AcceptedRealizationCoveragePreimage;
}

/** Complete closure required to validate symbolic realization coverage. */
interface RealizationCoverageValidationInput extends TrustedObservationProofContext {
  readonly claim: RealizationCoverageClaim;
  readonly behavior: ObservationBehaviorValidationInput;
  readonly templates: readonly RealizationWitnessTemplate[];
  readonly sequenceLanguages: readonly RealizationSequenceLanguage[];
  readonly parserProfiles: readonly CanonicalParserProfile[];
  readonly budget: ObservationAutomatonBudget;
}

/** Canonical preimage of one concrete realization witness. */
interface RealizationWitnessPreimage {
  readonly schema: "dathra.realization-witness/3";
  readonly renderInstanceId: string;
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly acceptedObservationRelationId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly realizationInputDigest: Sha256Digest;
  readonly acceptedCoverageId: Sha256Digest;
  readonly coverageClaimId: Sha256Digest;
  readonly coverageAcceptanceId: Sha256Digest;
  readonly witnessTemplateId: Sha256Digest;
  readonly realizationSequenceClaimId: Sha256Digest;
  readonly sequenceAcceptanceId: Sha256Digest;
  readonly targetHostProfileId: QualifiedRegistryId<"host-profile">;
  readonly encoding: "utf-8";
  readonly contentTypeId: string;
  readonly documentMode: "no-quirks" | "limited-quirks" | "quirks";
  readonly canonicalBaseUrl: string;
  readonly baseUrlClaimId: Sha256Digest;
  readonly baseUrlAcceptanceId: Sha256Digest;
  readonly policyEpoch: string;
  readonly customElementRegistryIdentity: string;
  readonly parserProfileId: Sha256Digest;
  readonly upgradeEffectIds: readonly string[];
  readonly adoptEffectIds: readonly string[];
}

/** A canonical concrete server-realization witness. */
interface RealizationWitness {
  readonly id: Sha256Digest;
  readonly preimage: RealizationWitnessPreimage;
}

/** Input used to create a concrete realization witness. */
type RealizationWitnessInput = Omit<RealizationWitnessPreimage, "schema">;

/** Trusted context required to validate a realization witness. */
interface RealizationWitnessValidationContext {
  readonly acceptedObservationRelation: AcceptedObservationRelation;
  readonly relationAcceptanceInput: ObservationRelationAcceptanceInput;
  readonly acceptedCoverage: AcceptedRealizationCoverage;
  readonly coverageValidationInput: RealizationCoverageValidationInput;
  readonly template: RealizationWitnessTemplate;
  readonly sequenceLanguage: RealizationSequenceLanguage;
  readonly sequenceClaim: RealizationSequenceClaim;
  readonly parserProfile: CanonicalParserProfile;
  readonly baseUrlClaim: CanonicalBaseUrlClaim;
  readonly selectionHostProfileIds: readonly QualifiedRegistryId<"host-profile">[];
  readonly environmentCatalog: RegistryEnvironmentCatalogRecord;
  readonly proofAcceptances: readonly ObservationProofAcceptance[];
  readonly trustedProofAcceptanceIds: readonly Sha256Digest[];
}

type DataRecord = Record<string, unknown>;
type ValidationPath = readonly ObservationContractPathSegment[];

const CONSTRAINT_KINDS = [
  "value",
  "dom",
  "artifact",
  "protocol",
  "event",
  "effect",
  "callback",
  "identity",
  "lifetime",
  "authority",
  "exposure",
  "terminal",
] as const;
const TERMINAL_OUTCOMES = [
  "success",
  "typed-failure",
  "cancelled",
  "timed-out",
  "disconnected",
  "ambiguous",
] as const;
const DOCUMENT_MODES = ["no-quirks", "limited-quirks", "quirks"] as const;

function formatPath(path: ValidationPath): string {
  if (path.length === 0) return "$";
  return path.reduce<string>(
    (result, segment) =>
      typeof segment === "number"
        ? `${result}[${segment}]`
        : `${result}[${JSON.stringify(segment)}]`,
    "$",
  );
}

function fail(
  code: ObservationContractErrorCode,
  path: ValidationPath,
  detail: string,
): never {
  throw new ObservationContractError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

function isDataRecord(value: unknown): value is DataRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function deepFreeze(value: unknown): void {
  if (typeof value !== "object" || value === null || Object.isFrozen(value)) {
    return;
  }
  if (Array.isArray(value)) {
    for (const item of value) deepFreeze(item);
  } else {
    for (const key of Object.keys(value)) {
      const descriptor = Object.getOwnPropertyDescriptor(value, key);
      if (descriptor !== undefined && "value" in descriptor) {
        deepFreeze(descriptor.value);
      }
    }
  }
  Object.freeze(value);
}

function snapshotClosed(value: unknown): unknown {
  try {
    const text = canonicalizeJson(value).text;
    const snapshot: unknown = JSON.parse(text);
    deepFreeze(snapshot);
    return snapshot;
  } catch (error) {
    if (error instanceof CanonicalIdentityError) {
      fail("invalid-closed-record", error.path, error.message);
    }
    throw error;
  }
}

function expectRecord(
  value: unknown,
  path: ValidationPath,
  fields: readonly string[],
): DataRecord {
  if (!isDataRecord(value)) fail("invalid-field", path, "Expected a record");
  const expected = new Set(fields);
  for (const key of Object.keys(value)) {
    if (!expected.has(key)) {
      fail("invalid-field", [...path, key], "Unexpected field");
    }
  }
  for (const field of fields) {
    if (!Object.hasOwn(value, field)) {
      fail("invalid-field", [...path, field], "Missing field");
    }
  }
  return value;
}

function expectArray(value: unknown, path: ValidationPath): readonly unknown[] {
  if (!Array.isArray(value)) fail("invalid-field", path, "Expected an array");
  return value;
}

function expectString(value: unknown, path: ValidationPath): string {
  if (typeof value !== "string") {
    fail("invalid-field", path, "Expected a string");
  }
  return value;
}

function expectNonEmptyString(value: unknown, path: ValidationPath): string {
  const result = expectString(value, path);
  if (result.length === 0)
    fail("invalid-field", path, "Expected a non-empty string");
  return result;
}

function expectLiteral<const Value extends string>(
  value: unknown,
  expected: Value,
  path: ValidationPath,
): Value {
  if (value !== expected) fail("invalid-field", path, `Expected ${expected}`);
  return expected;
}

function expectOneOf<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: ValidationPath,
): Values[number] {
  if (typeof value !== "string" || !values.includes(value)) {
    fail("invalid-field", path, "Unexpected enum value");
  }
  return value;
}

function expectDigest(value: unknown, path: ValidationPath): Sha256Digest {
  if (!isSha256Digest(value))
    fail("invalid-field", path, "Invalid SHA-256 digest");
  return value;
}

function expectNullableDigest(
  value: unknown,
  path: ValidationPath,
): Sha256Digest | null {
  if (value === null) return null;
  return expectDigest(value, path);
}

function expectHostProfileId(
  value: unknown,
  path: ValidationPath,
): QualifiedRegistryId<"host-profile"> {
  return expectDigest(value, path) as QualifiedRegistryId<"host-profile">;
}

function expectPolicyId(
  value: unknown,
  path: ValidationPath,
): QualifiedRegistryId<"policy"> {
  return expectDigest(value, path) as QualifiedRegistryId<"policy">;
}

function expectNonNegativeSafeInteger(
  value: unknown,
  path: ValidationPath,
): number {
  if (typeof value !== "number" || !Number.isSafeInteger(value) || value < 0) {
    fail("invalid-field", path, "Expected a non-negative safe integer");
  }
  return value;
}

function expectPositiveSafeInteger(
  value: unknown,
  path: ValidationPath,
): number {
  const result = expectNonNegativeSafeInteger(value, path);
  if (result === 0)
    fail("invalid-field", path, "Expected a positive safe integer");
  return result;
}

function compareText(left: string, right: string): number {
  return left < right ? -1 : left > right ? 1 : 0;
}

function firstComparison(...comparisons: readonly number[]): number {
  for (const comparison of comparisons) {
    if (comparison !== 0) return comparison;
  }
  return 0;
}

function compareCanonicalList<Item>(
  items: readonly Item[],
  compare: (left: Item, right: Item) => number,
  path: ValidationPath,
): void {
  for (let index = 1; index < items.length; index += 1) {
    const order = compare(items[index - 1], items[index]);
    if (order === 0) {
      fail("duplicate-record", [...path, index], "Duplicate canonical record");
    }
    if (order > 0) {
      fail("noncanonical-order", [...path, index], "Noncanonical list order");
    }
  }
}

function sortedCopy<Item>(
  items: readonly Item[],
  compare: (left: Item, right: Item) => number,
): Item[] {
  return [...items].sort(compare);
}

function canonicalEqual(left: unknown, right: unknown): boolean {
  return canonicalizeJson(left).text === canonicalizeJson(right).text;
}

function expectCanonicalDigestList(
  value: unknown,
  path: ValidationPath,
): readonly Sha256Digest[] {
  const result = expectArray(value, path).map((item, index) =>
    expectDigest(item, [...path, index]),
  );
  compareCanonicalList(result, compareText, path);
  return result;
}

function readCardinality(
  value: unknown,
  path: ValidationPath,
): ObservationCardinality {
  if (!isDataRecord(value)) {
    fail("invalid-cardinality", path, "Expected a cardinality record");
  }
  const kind = value.kind;
  if (kind === "exactly") {
    const record = expectRecord(value, path, ["kind", "count"]);
    const count = expectNonNegativeSafeInteger(record.count, [
      ...path,
      "count",
    ]);
    return { kind, count };
  }
  if (kind === "range") {
    const record = expectRecord(value, path, ["kind", "minimum", "maximum"]);
    const minimum = expectNonNegativeSafeInteger(record.minimum, [
      ...path,
      "minimum",
    ]);
    const maximum = expectNonNegativeSafeInteger(record.maximum, [
      ...path,
      "maximum",
    ]);
    if (minimum > maximum) {
      fail("invalid-cardinality", path, "Cardinality minimum exceeds maximum");
    }
    return { kind, minimum, maximum };
  }
  fail("invalid-cardinality", [...path, "kind"], "Unknown cardinality kind");
}

function cardinalityInterval(cardinality: ObservationCardinality): {
  readonly minimum: number;
  readonly maximum: number;
} {
  return cardinality.kind === "exactly"
    ? { minimum: cardinality.count, maximum: cardinality.count }
    : { minimum: cardinality.minimum, maximum: cardinality.maximum };
}

function isCardinalitySubset(
  candidate: ObservationCardinality,
  source: ObservationCardinality,
): boolean {
  const candidateInterval = cardinalityInterval(candidate);
  const sourceInterval = cardinalityInterval(source);
  return (
    candidateInterval.minimum >= sourceInterval.minimum &&
    candidateInterval.maximum <= sourceInterval.maximum
  );
}

async function contentAddressed<Preimage>(
  preimage: Preimage,
): Promise<{ readonly id: Sha256Digest; readonly preimage: Preimage }> {
  const record = {
    id: await digestCanonicalJson(preimage),
    preimage,
  };
  deepFreeze(record);
  return record;
}

function readConstraintInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationConstraintInput {
  if (!isDataRecord(value))
    fail("invalid-field", path, "Expected a constraint record");
  const kind = expectOneOf(value.kind, CONSTRAINT_KINDS, [...path, "kind"]);
  const baseFields = includesId
    ? ["kind", "id", "subjectId", "visibility"]
    : ["kind", "subjectId", "visibility"];
  const subjectId = expectNonEmptyString(value.subjectId, [
    ...path,
    "subjectId",
  ]);

  switch (kind) {
    case "value": {
      const record = expectRecord(value, path, [
        ...baseFields,
        "equivalenceDomainId",
        "consistencyCutId",
      ]);
      return {
        kind,
        subjectId,
        visibility: expectOneOf(
          record.visibility,
          ["external", "internal-ordering"] as const,
          [...path, "visibility"],
        ),
        equivalenceDomainId: expectNonEmptyString(record.equivalenceDomainId, [
          ...path,
          "equivalenceDomainId",
        ]),
        consistencyCutId: expectNonEmptyString(record.consistencyCutId, [
          ...path,
          "consistencyCutId",
        ]),
      };
    }
    case "dom": {
      const record = expectRecord(value, path, [
        ...baseFields,
        "realizationDomainId",
        "mutableFacetPolicyId",
        "consistencyCutId",
      ]);
      return {
        kind,
        subjectId,
        visibility: expectOneOf(
          record.visibility,
          ["external", "internal-ordering"] as const,
          [...path, "visibility"],
        ),
        realizationDomainId: expectNonEmptyString(record.realizationDomainId, [
          ...path,
          "realizationDomainId",
        ]),
        mutableFacetPolicyId: expectNonEmptyString(
          record.mutableFacetPolicyId,
          [...path, "mutableFacetPolicyId"],
        ),
        consistencyCutId: expectNonEmptyString(record.consistencyCutId, [
          ...path,
          "consistencyCutId",
        ]),
      };
    }
    case "artifact":
    case "protocol": {
      const record = expectRecord(value, path, [
        ...baseFields,
        "byteOrMessageSchemaId",
        "cardinality",
      ]);
      return {
        kind,
        subjectId,
        visibility: expectOneOf(
          record.visibility,
          ["external", "internal-ordering"] as const,
          [...path, "visibility"],
        ),
        byteOrMessageSchemaId: expectNonEmptyString(
          record.byteOrMessageSchemaId,
          [...path, "byteOrMessageSchemaId"],
        ),
        cardinality: readCardinality(record.cardinality, [
          ...path,
          "cardinality",
        ]),
      };
    }
    case "event":
    case "effect":
    case "callback": {
      const record = expectRecord(value, path, [
        ...baseFields,
        "inputIdentityDomainId",
        "occurrenceIdentityDomainId",
        "cardinality",
        "admissionCutId",
        "coalescingPolicyRequirement",
      ]);
      return {
        kind,
        subjectId,
        visibility: expectOneOf(
          record.visibility,
          ["external", "internal-ordering"] as const,
          [...path, "visibility"],
        ),
        inputIdentityDomainId: expectNonEmptyString(
          record.inputIdentityDomainId,
          [...path, "inputIdentityDomainId"],
        ),
        occurrenceIdentityDomainId: expectNonEmptyString(
          record.occurrenceIdentityDomainId,
          [...path, "occurrenceIdentityDomainId"],
        ),
        cardinality: readCardinality(record.cardinality, [
          ...path,
          "cardinality",
        ]),
        admissionCutId: expectNonEmptyString(record.admissionCutId, [
          ...path,
          "admissionCutId",
        ]),
        coalescingPolicyRequirement:
          record.coalescingPolicyRequirement === null
            ? null
            : readObservationPolicyRequirement(
                record.coalescingPolicyRequirement,
                [...path, "coalescingPolicyRequirement"],
              ),
      };
    }
    case "identity":
    case "lifetime": {
      const record = expectRecord(value, path, [
        ...baseFields,
        "identityDomainId",
        "lifetimeDomainId",
      ]);
      return {
        kind,
        subjectId,
        visibility: expectOneOf(
          record.visibility,
          ["external", "internal-ordering"] as const,
          [...path, "visibility"],
        ),
        identityDomainId: expectNonEmptyString(record.identityDomainId, [
          ...path,
          "identityDomainId",
        ]),
        lifetimeDomainId: expectNonEmptyString(record.lifetimeDomainId, [
          ...path,
          "lifetimeDomainId",
        ]),
      };
    }
    case "authority":
    case "exposure": {
      const record = expectRecord(value, path, [
        ...baseFields,
        "policyQualifiedId",
        "policyEpochDomainId",
      ]);
      return {
        kind,
        subjectId,
        visibility: expectOneOf(
          record.visibility,
          ["external", "internal-ordering"] as const,
          [...path, "visibility"],
        ),
        policyQualifiedId: expectPolicyId(record.policyQualifiedId, [
          ...path,
          "policyQualifiedId",
        ]),
        policyEpochDomainId: expectNonEmptyString(record.policyEpochDomainId, [
          ...path,
          "policyEpochDomainId",
        ]),
      };
    }
    case "terminal": {
      const record = expectRecord(value, path, [...baseFields, "outcomes"]);
      expectLiteral(record.visibility, "external", [...path, "visibility"]);
      const outcomes = expectArray(record.outcomes, [...path, "outcomes"]).map(
        (outcome, index) =>
          expectOneOf(outcome, TERMINAL_OUTCOMES, [...path, "outcomes", index]),
      );
      if (outcomes.length === 0) {
        fail(
          "invalid-field",
          [...path, "outcomes"],
          "Terminal outcomes cannot be empty",
        );
      }
      const canonicalOutcomes = sortedCopy(outcomes, compareText);
      compareCanonicalList(canonicalOutcomes, compareText, [
        ...path,
        "outcomes",
      ]);
      return {
        kind,
        subjectId,
        visibility: "external",
        outcomes: canonicalOutcomes,
      };
    }
  }
}

async function readConstraint(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationConstraint> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a constraint record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readConstraintInput(record, path, true);
  const expectedId = await digestCanonicalJson(input);
  if (id !== expectedId) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Constraint digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates a closed, content-addressed observation constraint. */
async function createObservationConstraint(
  input: ObservationConstraintInput,
): Promise<ObservationConstraint> {
  const snapshot = snapshotClosed(input);
  const preimage = readConstraintInput(snapshot, [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readOrderEdgeInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationOrderEdgeInput {
  const fields = includesId
    ? ["id", "beforeConstraintId", "afterConstraintId", "relation"]
    : ["beforeConstraintId", "afterConstraintId", "relation"];
  const record = expectRecord(value, path, fields);
  const beforeConstraintId = expectDigest(record.beforeConstraintId, [
    ...path,
    "beforeConstraintId",
  ]);
  const afterConstraintId = expectDigest(record.afterConstraintId, [
    ...path,
    "afterConstraintId",
  ]);
  const relation = expectOneOf(
    record.relation,
    ["strict", "serial", "exclusive"] as const,
    [...path, "relation"],
  );
  if (beforeConstraintId === afterConstraintId) {
    fail("invalid-field", path, "Observation order edges cannot be self edges");
  }
  if (
    relation === "exclusive" &&
    compareText(beforeConstraintId, afterConstraintId) > 0
  ) {
    fail(
      "noncanonical-order",
      path,
      "Exclusive edge endpoints are not canonically oriented",
    );
  }
  return { beforeConstraintId, afterConstraintId, relation };
}

async function readOrderEdge(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationOrderEdge> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected an order edge record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readOrderEdgeInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Order edge digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates a closed, content-addressed observation order edge. */
async function createObservationOrderEdge(
  input: ObservationOrderEdgeInput,
): Promise<ObservationOrderEdge> {
  const snapshot = snapshotClosed(input);
  const preimage = readOrderEdgeInput(snapshot, [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readRefinementRuleInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationRefinementRuleInput {
  const fields = includesId
    ? ["id", "kind", "constraintIds", "proofDomainId"]
    : ["kind", "constraintIds", "proofDomainId"];
  const record = expectRecord(value, path, fields);
  const kind = expectOneOf(
    record.kind,
    [
      "equivalent-value",
      "narrow-cardinality",
      "omit-unobservable-internal-step",
      "commutative-reorder",
      "declared-event-coalescing",
    ] as const,
    [...path, "kind"],
  );
  const constraintIds = expectArray(record.constraintIds, [
    ...path,
    "constraintIds",
  ]).map((id, index) => expectDigest(id, [...path, "constraintIds", index]));
  const canonicalConstraintIds = sortedCopy(constraintIds, compareText);
  compareCanonicalList(canonicalConstraintIds, compareText, [
    ...path,
    "constraintIds",
  ]);
  if (canonicalConstraintIds.length === 0) {
    fail(
      "invalid-refinement",
      [...path, "constraintIds"],
      "A refinement rule must reference a constraint",
    );
  }
  return {
    kind,
    constraintIds: canonicalConstraintIds,
    proofDomainId: expectDigest(record.proofDomainId, [
      ...path,
      "proofDomainId",
    ]),
  };
}

async function readRefinementRule(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationRefinementRule> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a refinement rule record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readRefinementRuleInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Refinement rule digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates a closed, content-addressed observation refinement rule. */
async function createObservationRefinementRule(
  input: ObservationRefinementRuleInput,
): Promise<ObservationRefinementRule> {
  const snapshot = snapshotClosed(input);
  const preimage = readRefinementRuleInput(snapshot, [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function effectiveCardinality(
  constraint: ObservationConstraint,
): ObservationCardinality {
  if (
    constraint.kind === "artifact" ||
    constraint.kind === "protocol" ||
    constraint.kind === "event" ||
    constraint.kind === "effect" ||
    constraint.kind === "callback"
  ) {
    return constraint.cardinality;
  }
  return { kind: "exactly", count: 1 };
}

function validateOrderAcyclicity(
  constraints: readonly ObservationConstraint[],
  edges: readonly ObservationOrderEdge[],
): void {
  const outgoing = new Map<Sha256Digest, Sha256Digest[]>();
  const indegree = new Map<Sha256Digest, number>();
  for (const constraint of constraints) {
    outgoing.set(constraint.id, []);
    indegree.set(constraint.id, 0);
  }
  for (const edge of edges) {
    if (edge.relation === "exclusive") continue;
    outgoing.get(edge.beforeConstraintId)?.push(edge.afterConstraintId);
    indegree.set(
      edge.afterConstraintId,
      (indegree.get(edge.afterConstraintId) ?? 0) + 1,
    );
  }
  const ready = sortedCopy(
    constraints.filter((constraint) => indegree.get(constraint.id) === 0),
    (left, right) => compareText(left.id, right.id),
  );
  let visited = 0;
  while (ready.length > 0) {
    const current = ready.shift();
    if (current === undefined) break;
    visited += 1;
    for (const target of outgoing.get(current.id) ?? []) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        const targetConstraint = constraints.find(({ id }) => id === target);
        if (targetConstraint !== undefined) {
          ready.push(targetConstraint);
          ready.sort((left, right) => compareText(left.id, right.id));
        }
      }
    }
  }
  if (visited !== constraints.length) {
    fail(
      "order-cycle",
      ["orderEdges"],
      "Strict or serial observation order contains a cycle",
    );
  }
}

function validateRefinementRuleAgainstContract(
  rule: ObservationRefinementRule,
  constraintsById: ReadonlyMap<Sha256Digest, ObservationConstraint>,
  path: ValidationPath,
): void {
  const constraints = rule.constraintIds.map((id, index) => {
    const constraint = constraintsById.get(id);
    if (constraint === undefined) {
      fail(
        "dangling-reference",
        [...path, "constraintIds", index],
        "Refinement rule references an unknown constraint",
      );
    }
    return constraint;
  });
  switch (rule.kind) {
    case "equivalent-value":
      if (constraints.some(({ kind }) => kind !== "value")) {
        fail(
          "invalid-refinement",
          path,
          "Equivalent-value rules require value constraints",
        );
      }
      return;
    case "narrow-cardinality":
      if (
        constraints.some(
          ({ kind }) =>
            kind !== "artifact" &&
            kind !== "protocol" &&
            kind !== "event" &&
            kind !== "effect" &&
            kind !== "callback",
        )
      ) {
        fail(
          "invalid-refinement",
          path,
          "Narrow-cardinality rules require cardinality-bearing constraints",
        );
      }
      return;
    case "omit-unobservable-internal-step":
      if (
        constraints.some(({ visibility }) => visibility !== "internal-ordering")
      ) {
        fail(
          "invalid-refinement",
          path,
          "Omission rules require internal-ordering constraints",
        );
      }
      return;
    case "commutative-reorder":
      if (constraints.length < 2) {
        fail(
          "invalid-refinement",
          path,
          "Commutative reorder requires at least two constraints",
        );
      }
      return;
    case "declared-event-coalescing":
      if (
        constraints.some(
          (constraint) =>
            (constraint.kind !== "event" &&
              constraint.kind !== "effect" &&
              constraint.kind !== "callback") ||
            constraint.coalescingPolicyRequirement === null,
        )
      ) {
        fail(
          "invalid-refinement",
          path,
          "Coalescing rules require a declared coalescing policy",
        );
      }
  }
}

async function buildObservationContract(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<ObservationContract> {
  const fields = includesSchema
    ? [
        "schema",
        "rootDefinitionId",
        "externalInputIdentitySchemaId",
        "eventIdentitySchemaId",
        "initialCutId",
        "relation",
        "constraints",
        "orderEdges",
        "refinementRules",
      ]
    : [
        "rootDefinitionId",
        "externalInputIdentitySchemaId",
        "eventIdentitySchemaId",
        "initialCutId",
        "relation",
        "constraints",
        "orderEdges",
        "refinementRules",
      ];
  const record = expectRecord(value, path, fields);
  if (includesSchema) {
    expectLiteral(record.schema, "dathra.observation-contract/3", [
      ...path,
      "schema",
    ]);
  }
  const constraintValues = expectArray(record.constraints, [
    ...path,
    "constraints",
  ]);
  const constraints: ObservationConstraint[] = [];
  for (let index = 0; index < constraintValues.length; index += 1) {
    constraints.push(
      await readConstraint(constraintValues[index], [
        ...path,
        "constraints",
        index,
      ]),
    );
  }
  const canonicalConstraints = sortedCopy(constraints, (left, right) =>
    compareText(left.id, right.id),
  );
  if (
    includesSchema &&
    constraints.some(
      (constraint, index) => constraint.id !== canonicalConstraints[index]?.id,
    )
  ) {
    fail(
      "noncanonical-order",
      [...path, "constraints"],
      "Constraints are not in canonical ID order",
    );
  }
  compareCanonicalList(
    canonicalConstraints,
    (left, right) => compareText(left.id, right.id),
    [...path, "constraints"],
  );

  const edgeValues = expectArray(record.orderEdges, [...path, "orderEdges"]);
  const orderEdges: ObservationOrderEdge[] = [];
  for (let index = 0; index < edgeValues.length; index += 1) {
    orderEdges.push(
      await readOrderEdge(edgeValues[index], [...path, "orderEdges", index]),
    );
  }
  const canonicalEdges = sortedCopy(orderEdges, (left, right) =>
    compareText(left.id, right.id),
  );
  if (
    includesSchema &&
    orderEdges.some((edge, index) => edge.id !== canonicalEdges[index]?.id)
  ) {
    fail(
      "noncanonical-order",
      [...path, "orderEdges"],
      "Order edges are not in canonical ID order",
    );
  }
  compareCanonicalList(
    canonicalEdges,
    (left, right) => compareText(left.id, right.id),
    [...path, "orderEdges"],
  );

  const ruleValues = expectArray(record.refinementRules, [
    ...path,
    "refinementRules",
  ]);
  const refinementRules: ObservationRefinementRule[] = [];
  for (let index = 0; index < ruleValues.length; index += 1) {
    refinementRules.push(
      await readRefinementRule(ruleValues[index], [
        ...path,
        "refinementRules",
        index,
      ]),
    );
  }
  const canonicalRules = sortedCopy(refinementRules, (left, right) =>
    compareText(left.id, right.id),
  );
  if (
    includesSchema &&
    refinementRules.some((rule, index) => rule.id !== canonicalRules[index]?.id)
  ) {
    fail(
      "noncanonical-order",
      [...path, "refinementRules"],
      "Refinement rules are not in canonical ID order",
    );
  }
  compareCanonicalList(
    canonicalRules,
    (left, right) => compareText(left.id, right.id),
    [...path, "refinementRules"],
  );

  const constraintsById = new Map(
    canonicalConstraints.map((constraint) => [constraint.id, constraint]),
  );
  for (let index = 0; index < canonicalEdges.length; index += 1) {
    const edge = canonicalEdges[index];
    if (!constraintsById.has(edge.beforeConstraintId)) {
      fail(
        "dangling-reference",
        [...path, "orderEdges", index, "beforeConstraintId"],
        "Order edge references an unknown constraint",
      );
    }
    if (!constraintsById.has(edge.afterConstraintId)) {
      fail(
        "dangling-reference",
        [...path, "orderEdges", index, "afterConstraintId"],
        "Order edge references an unknown constraint",
      );
    }
  }
  validateOrderAcyclicity(canonicalConstraints, canonicalEdges);

  const relation = expectOneOf(
    record.relation,
    ["trace-equality", "trace-refinement"] as const,
    [...path, "relation"],
  );
  if (relation === "trace-equality" && canonicalRules.length > 0) {
    fail(
      "invalid-refinement",
      [...path, "refinementRules"],
      "Trace-equality contracts cannot contain refinement rules",
    );
  }
  const ruleKindsByConstraint = new Map<Sha256Digest, Set<string>>();
  for (let index = 0; index < canonicalRules.length; index += 1) {
    const rule = canonicalRules[index];
    validateRefinementRuleAgainstContract(rule, constraintsById, [
      ...path,
      "refinementRules",
      index,
    ]);
    for (const constraintId of rule.constraintIds) {
      let kinds = ruleKindsByConstraint.get(constraintId);
      if (kinds === undefined) {
        kinds = new Set();
        ruleKindsByConstraint.set(constraintId, kinds);
      }
      if (kinds.has(rule.kind)) {
        fail(
          "invalid-refinement",
          [...path, "refinementRules", index],
          "A constraint has duplicate refinement rules of the same kind",
        );
      }
      if (
        (rule.kind === "narrow-cardinality" ||
          rule.kind === "declared-event-coalescing") &&
        ([...kinds].includes("narrow-cardinality") ||
          [...kinds].includes("declared-event-coalescing"))
      ) {
        fail(
          "invalid-refinement",
          [...path, "refinementRules", index],
          "A constraint has conflicting cardinality-changing rules",
        );
      }
      kinds.add(rule.kind);
    }
  }

  const preimage: ObservationContractPreimage = {
    schema: "dathra.observation-contract/3",
    rootDefinitionId: expectNonEmptyString(record.rootDefinitionId, [
      ...path,
      "rootDefinitionId",
    ]),
    externalInputIdentitySchemaId: expectNonEmptyString(
      record.externalInputIdentitySchemaId,
      [...path, "externalInputIdentitySchemaId"],
    ),
    eventIdentitySchemaId: expectNonEmptyString(record.eventIdentitySchemaId, [
      ...path,
      "eventIdentitySchemaId",
    ]),
    initialCutId: expectNonEmptyString(record.initialCutId, [
      ...path,
      "initialCutId",
    ]),
    relation,
    constraints: canonicalConstraints,
    orderEdges: canonicalEdges,
    refinementRules: canonicalRules,
  };
  return await contentAddressed(preimage);
}

/** Creates a canonical observation contract from closed constraint records. */
async function createObservationContract(
  input: ObservationContractInput,
): Promise<ObservationContract> {
  return await buildObservationContract(snapshotClosed(input), [], false);
}

/** Parses and verifies a canonical observation contract. */
async function parseObservationContract(
  value: unknown,
): Promise<ObservationContract> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Observation contract digest does not match its preimage",
    );
  }
  const parsed = await buildObservationContract(
    record.preimage,
    ["preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Observation contract preimage is not canonical",
    );
  }
  return parsed;
}

async function buildObservationInputClassDescriptor(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<ObservationInputClassDescriptor> {
  const record = expectRecord(
    value,
    path,
    includesSchema
      ? [
          "schema",
          "externalInputIdentitySchemaId",
          "eventIdentitySchemaId",
          "initialCutId",
          "selectorLanguageId",
        ]
      : [
          "externalInputIdentitySchemaId",
          "eventIdentitySchemaId",
          "initialCutId",
          "selectorLanguageId",
        ],
  );
  if (includesSchema) {
    expectLiteral(record.schema, "dathra.observation-input-class/1", [
      ...path,
      "schema",
    ]);
  }
  const preimage: ObservationInputClassDescriptorPreimage = {
    schema: "dathra.observation-input-class/1",
    externalInputIdentitySchemaId: expectNonEmptyString(
      record.externalInputIdentitySchemaId,
      [...path, "externalInputIdentitySchemaId"],
    ),
    eventIdentitySchemaId: expectNonEmptyString(record.eventIdentitySchemaId, [
      ...path,
      "eventIdentitySchemaId",
    ]),
    initialCutId: expectNonEmptyString(record.initialCutId, [
      ...path,
      "initialCutId",
    ]),
    selectorLanguageId: expectDigest(record.selectorLanguageId, [
      ...path,
      "selectorLanguageId",
    ]),
  };
  return await contentAddressed(preimage);
}

/** Creates one content-addressed external input class selector. */
async function createObservationInputClassDescriptor(
  input: ObservationInputClassDescriptorInput,
): Promise<ObservationInputClassDescriptor> {
  return await buildObservationInputClassDescriptor(
    snapshotClosed(input),
    [],
    false,
  );
}

async function parseObservationInputClassDescriptor(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationInputClassDescriptor> {
  const record = expectRecord(value, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Input class descriptor digest does not match its preimage",
    );
  }
  const parsed = await buildObservationInputClassDescriptor(
    record.preimage,
    [...path, "preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      [...path, "preimage"],
      "Input class descriptor preimage is not canonical",
    );
  }
  return parsed;
}

async function buildObservationInputPartition(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<ObservationInputPartition> {
  const record = expectRecord(
    value,
    path,
    includesSchema
      ? [
          "schema",
          "externalInputIdentitySchemaId",
          "eventIdentitySchemaId",
          "initialCutId",
          "universeLanguageId",
          "inputClasses",
        ]
      : [
          "externalInputIdentitySchemaId",
          "eventIdentitySchemaId",
          "initialCutId",
          "universeLanguageId",
          "inputClasses",
        ],
  );
  if (includesSchema) {
    expectLiteral(record.schema, "dathra.observation-input-partition/1", [
      ...path,
      "schema",
    ]);
  }
  const values = expectArray(record.inputClasses, [...path, "inputClasses"]);
  const inputClasses: ObservationInputClassDescriptor[] = [];
  for (let index = 0; index < values.length; index += 1) {
    inputClasses.push(
      await parseObservationInputClassDescriptor(values[index], [
        ...path,
        "inputClasses",
        index,
      ]),
    );
  }
  const canonicalClasses = sortedCopy(inputClasses, (left, right) =>
    compareText(left.id, right.id),
  );
  compareCanonicalList(
    canonicalClasses,
    (left, right) => compareText(left.id, right.id),
    [...path, "inputClasses"],
  );
  if (
    includesSchema &&
    inputClasses.some(
      (descriptor, index) => descriptor.id !== canonicalClasses[index]?.id,
    )
  ) {
    fail(
      "noncanonical-order",
      [...path, "inputClasses"],
      "Input classes are not in canonical ID order",
    );
  }
  const externalInputIdentitySchemaId = expectNonEmptyString(
    record.externalInputIdentitySchemaId,
    [...path, "externalInputIdentitySchemaId"],
  );
  const eventIdentitySchemaId = expectNonEmptyString(
    record.eventIdentitySchemaId,
    [...path, "eventIdentitySchemaId"],
  );
  const initialCutId = expectNonEmptyString(record.initialCutId, [
    ...path,
    "initialCutId",
  ]);
  if (
    canonicalClasses.some(
      ({ preimage }) =>
        preimage.externalInputIdentitySchemaId !==
          externalInputIdentitySchemaId ||
        preimage.eventIdentitySchemaId !== eventIdentitySchemaId ||
        preimage.initialCutId !== initialCutId,
    )
  ) {
    fail(
      "contract-mismatch",
      [...path, "inputClasses"],
      "Input class descriptor headers do not match the partition",
    );
  }
  const preimage: ObservationInputPartitionPreimage = {
    schema: "dathra.observation-input-partition/1",
    externalInputIdentitySchemaId,
    eventIdentitySchemaId,
    initialCutId,
    universeLanguageId: expectDigest(record.universeLanguageId, [
      ...path,
      "universeLanguageId",
    ]),
    inputClasses: canonicalClasses,
  };
  return await contentAddressed(preimage);
}

/** Creates a closed external input partition record. */
async function createObservationInputPartition(
  input: ObservationInputPartitionInput,
): Promise<ObservationInputPartition> {
  return await buildObservationInputPartition(snapshotClosed(input), [], false);
}

async function parseObservationInputPartition(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationInputPartition> {
  const record = expectRecord(value, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Input partition digest does not match its preimage",
    );
  }
  const parsed = await buildObservationInputPartition(
    record.preimage,
    [...path, "preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      [...path, "preimage"],
      "Input partition preimage is not canonical",
    );
  }
  return parsed;
}

async function buildObservationInputPartitionPolicyClaim(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<ObservationInputPartitionPolicyClaim> {
  const record = expectRecord(
    value,
    path,
    includesSchema
      ? [
          "schema",
          "inputPartitionId",
          "universeLanguageId",
          "inputClassIds",
          "proofDomainId",
        ]
      : [
          "inputPartitionId",
          "universeLanguageId",
          "inputClassIds",
          "proofDomainId",
        ],
  );
  if (includesSchema) {
    expectLiteral(
      record.schema,
      "dathra.observation-input-partition-policy-claim/1",
      [...path, "schema"],
    );
  }
  const inputClassIds = readCanonicalizedDigestSet(record.inputClassIds, [
    ...path,
    "inputClassIds",
  ]);
  const preimage: ObservationInputPartitionPolicyClaimPreimage = {
    schema: "dathra.observation-input-partition-policy-claim/1",
    inputPartitionId: expectDigest(record.inputPartitionId, [
      ...path,
      "inputPartitionId",
    ]),
    universeLanguageId: expectDigest(record.universeLanguageId, [
      ...path,
      "universeLanguageId",
    ]),
    inputClassIds,
    proofDomainId: expectDigest(record.proofDomainId, [
      ...path,
      "proofDomainId",
    ]),
  };
  return await contentAddressed(preimage);
}

/** Creates a proof claim for the external input selector semantics. */
async function createObservationInputPartitionPolicyClaim(
  input: ObservationInputPartitionPolicyClaimInput,
): Promise<ObservationInputPartitionPolicyClaim> {
  return await buildObservationInputPartitionPolicyClaim(
    snapshotClosed(input),
    [],
    false,
  );
}

async function parseObservationInputPartitionPolicyClaim(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationInputPartitionPolicyClaim> {
  const record = expectRecord(value, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Input partition policy claim digest does not match its preimage",
    );
  }
  const parsed = await buildObservationInputPartitionPolicyClaim(
    record.preimage,
    [...path, "preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      [...path, "preimage"],
      "Input partition policy claim preimage is not canonical",
    );
  }
  return parsed;
}

function readBehaviorInputClasses(
  value: unknown,
  path: ValidationPath,
  requireCanonicalOrder: boolean,
): ObservationBehaviorSummaryPreimage["inputClasses"] {
  const inputClasses = expectArray(value, path).map((entry, index) => {
    const entryPath = [...path, index];
    const record = expectRecord(entry, entryPath, [
      "inputClassId",
      "traceLanguageId",
    ]);
    return {
      inputClassId: expectDigest(record.inputClassId, [
        ...entryPath,
        "inputClassId",
      ]),
      traceLanguageId: expectDigest(record.traceLanguageId, [
        ...entryPath,
        "traceLanguageId",
      ]),
    };
  });
  const canonical = sortedCopy(inputClasses, (left, right) =>
    compareText(left.inputClassId, right.inputClassId),
  );
  compareCanonicalList(
    canonical,
    (left, right) => compareText(left.inputClassId, right.inputClassId),
    path,
  );
  if (
    requireCanonicalOrder &&
    inputClasses.some(
      (entry, index) => entry.inputClassId !== canonical[index]?.inputClassId,
    )
  ) {
    fail(
      "noncanonical-order",
      path,
      "Input classes are not canonically ordered",
    );
  }
  return canonical;
}

async function buildObservationBehaviorSummary(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<ObservationBehaviorSummary> {
  const record = expectRecord(
    value,
    path,
    includesSchema
      ? [
          "schema",
          "role",
          "observationContractId",
          "semanticGraphDigest",
          "inputPartitionId",
          "inputClasses",
        ]
      : [
          "role",
          "observationContractId",
          "semanticGraphDigest",
          "inputPartitionId",
          "inputClasses",
        ],
  );
  if (includesSchema) {
    expectLiteral(record.schema, "dathra.observation-behavior/2", [
      ...path,
      "schema",
    ]);
  }
  const preimage: ObservationBehaviorSummaryPreimage = {
    schema: "dathra.observation-behavior/2",
    role: expectOneOf(record.role, ["source", "candidate"] as const, [
      ...path,
      "role",
    ]),
    observationContractId: expectDigest(record.observationContractId, [
      ...path,
      "observationContractId",
    ]),
    semanticGraphDigest: expectDigest(record.semanticGraphDigest, [
      ...path,
      "semanticGraphDigest",
    ]),
    inputPartitionId: expectDigest(record.inputPartitionId, [
      ...path,
      "inputPartitionId",
    ]),
    inputClasses: readBehaviorInputClasses(
      record.inputClasses,
      [...path, "inputClasses"],
      includesSchema,
    ),
  };
  return await contentAddressed(preimage);
}

/** Creates a canonical behavior summary for every external input class. */
async function createObservationBehaviorSummary(
  input: ObservationBehaviorSummaryInput,
): Promise<ObservationBehaviorSummary> {
  return await buildObservationBehaviorSummary(
    snapshotClosed(input),
    [],
    false,
  );
}

/** Parses and verifies a canonical behavior summary. */
async function parseObservationBehaviorSummary(
  value: unknown,
): Promise<ObservationBehaviorSummary> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Behavior summary digest does not match its preimage",
    );
  }
  const parsed = await buildObservationBehaviorSummary(
    record.preimage,
    ["preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Behavior summary preimage is not canonical",
    );
  }
  return parsed;
}

/** Creates a proof claim binding a behavior summary to its graph and partition. */
async function createObservationBehaviorDerivationClaim(
  input: ObservationBehaviorDerivationClaimInput,
): Promise<ObservationBehaviorDerivationClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "behaviorSummaryId",
      "observationContractId",
      "semanticGraphDigest",
      "inputPartitionId",
      "proofDomainId",
    ],
  );
  return await contentAddressed({
    schema: "dathra.observation-behavior-derivation-claim/2",
    behaviorSummaryId: expectDigest(record.behaviorSummaryId, [
      "behaviorSummaryId",
    ]),
    observationContractId: expectDigest(record.observationContractId, [
      "observationContractId",
    ]),
    semanticGraphDigest: expectDigest(record.semanticGraphDigest, [
      "semanticGraphDigest",
    ]),
    inputPartitionId: expectDigest(record.inputPartitionId, [
      "inputPartitionId",
    ]),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

async function parseObservationBehaviorDerivationClaim(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationBehaviorDerivationClaim> {
  const record = expectRecord(value, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Behavior derivation claim digest does not match its preimage",
    );
  }
  const preimageRecord = expectRecord(
    record.preimage,
    [...path, "preimage"],
    [
      "schema",
      "behaviorSummaryId",
      "observationContractId",
      "semanticGraphDigest",
      "inputPartitionId",
      "proofDomainId",
    ],
  );
  expectLiteral(
    preimageRecord.schema,
    "dathra.observation-behavior-derivation-claim/2",
    [...path, "preimage", "schema"],
  );
  const preimage: ObservationBehaviorDerivationClaimPreimage = {
    schema: "dathra.observation-behavior-derivation-claim/2",
    behaviorSummaryId: expectDigest(preimageRecord.behaviorSummaryId, [
      ...path,
      "preimage",
      "behaviorSummaryId",
    ]),
    observationContractId: expectDigest(preimageRecord.observationContractId, [
      ...path,
      "preimage",
      "observationContractId",
    ]),
    semanticGraphDigest: expectDigest(preimageRecord.semanticGraphDigest, [
      ...path,
      "preimage",
      "semanticGraphDigest",
    ]),
    inputPartitionId: expectDigest(preimageRecord.inputPartitionId, [
      ...path,
      "preimage",
      "inputPartitionId",
    ]),
    proofDomainId: expectDigest(preimageRecord.proofDomainId, [
      ...path,
      "preimage",
      "proofDomainId",
    ]),
  };
  if (!canonicalEqual(preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      [...path, "preimage"],
      "Behavior derivation claim preimage is not canonical",
    );
  }
  const parsed = { id, preimage };
  deepFreeze(parsed);
  return parsed;
}

function comparisonDecision(
  legal: boolean,
  reason: string | null,
): ObservationComparisonDecision {
  const decision: ObservationComparisonDecision = {
    legal,
    relation: "trace-equality",
    reason,
    appliedRuleIds: [],
  };
  deepFreeze(decision);
  return decision;
}

/** Compares the complete input-class trace mappings of two summaries. */
function compareObservationBehaviorEquality(
  input: ObservationEqualityInput,
): ObservationComparisonDecision {
  const { contract, source, candidate } = input;
  if (contract.preimage.relation !== "trace-equality") {
    return comparisonDecision(
      false,
      "The contract does not require trace equality",
    );
  }
  if (
    source.preimage.role !== "source" ||
    candidate.preimage.role !== "candidate"
  ) {
    return comparisonDecision(
      false,
      "Behavior summary roles do not form a source/candidate pair",
    );
  }
  if (
    source.preimage.observationContractId !== contract.id ||
    candidate.preimage.observationContractId !== contract.id
  ) {
    return comparisonDecision(
      false,
      "Behavior summaries reference a different observation contract",
    );
  }
  if (
    source.preimage.inputPartitionId !== candidate.preimage.inputPartitionId
  ) {
    return comparisonDecision(
      false,
      "Behavior summaries use different input partitions",
    );
  }
  const languages = new Map(
    input.traceLanguages.map((language) => [language.id, language]),
  );
  for (const summary of [source, candidate]) {
    for (const entry of summary.preimage.inputClasses) {
      if (!languages.has(entry.traceLanguageId)) {
        fail(
          "dangling-reference",
          ["traceLanguages", entry.traceLanguageId],
          "Behavior summary references an unavailable trace language",
        );
      }
    }
  }
  if (
    !canonicalEqual(
      source.preimage.inputClasses,
      candidate.preimage.inputClasses,
    )
  ) {
    return comparisonDecision(false, "Input-class trace languages differ");
  }
  return comparisonDecision(true, null);
}

function compareDigestPair(
  left: {
    readonly sourceSymbolId: Sha256Digest;
    readonly candidateSymbolId: Sha256Digest;
  },
  right: {
    readonly sourceSymbolId: Sha256Digest;
    readonly candidateSymbolId: Sha256Digest;
  },
): number {
  return firstComparison(
    compareText(left.sourceSymbolId, right.sourceSymbolId),
    compareText(left.candidateSymbolId, right.candidateSymbolId),
  );
}

function readRuleApplicationInput(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): ObservationRuleApplicationInput {
  if (!isDataRecord(value)) {
    fail("invalid-field", path, "Expected a rule application record");
  }
  const kind = expectOneOf(
    value.kind,
    [
      "equivalent-value",
      "narrow-cardinality",
      "omit-unobservable-internal-step",
      "commutative-reorder",
      "declared-event-coalescing",
    ] as const,
    [...path, "kind"],
  );
  const baseFields = [
    ...(includesSchema ? ["schema"] : []),
    "kind",
    "ruleId",
    "sourceSummaryId",
    "candidateSummaryId",
    "inputClassId",
    "proofDomainId",
  ];
  if (includesSchema) {
    expectLiteral(value.schema, "dathra.observation-rule-application/3", [
      ...path,
      "schema",
    ]);
  }
  const base = {
    ruleId: expectDigest(value.ruleId, [...path, "ruleId"]),
    sourceSummaryId: expectDigest(value.sourceSummaryId, [
      ...path,
      "sourceSummaryId",
    ]),
    candidateSummaryId: expectDigest(value.candidateSummaryId, [
      ...path,
      "candidateSummaryId",
    ]),
    inputClassId: expectDigest(value.inputClassId, [...path, "inputClassId"]),
    proofDomainId: expectDigest(value.proofDomainId, [
      ...path,
      "proofDomainId",
    ]),
  };
  if (kind === "equivalent-value") {
    const record = expectRecord(value, path, [
      ...baseFields,
      "allowedTokenPairs",
    ]);
    const pairs = expectArray(record.allowedTokenPairs, [
      ...path,
      "allowedTokenPairs",
    ]).map((pair, index) => {
      const pairPath = [...path, "allowedTokenPairs", index];
      const pairRecord = expectRecord(pair, pairPath, [
        "sourceSymbolId",
        "candidateSymbolId",
      ]);
      return {
        sourceSymbolId: expectDigest(pairRecord.sourceSymbolId, [
          ...pairPath,
          "sourceSymbolId",
        ]),
        candidateSymbolId: expectDigest(pairRecord.candidateSymbolId, [
          ...pairPath,
          "candidateSymbolId",
        ]),
      };
    });
    const canonicalPairs = sortedCopy(pairs, compareDigestPair);
    compareCanonicalList(canonicalPairs, compareDigestPair, [
      ...path,
      "allowedTokenPairs",
    ]);
    return { kind, ...base, allowedTokenPairs: canonicalPairs };
  }
  if (kind === "narrow-cardinality") {
    const record = expectRecord(value, path, [
      ...baseFields,
      "constraintId",
      "sourceCardinality",
      "candidateCardinality",
      "slotMappings",
    ]);
    const sourceCardinality = readCardinality(record.sourceCardinality, [
      ...path,
      "sourceCardinality",
    ]);
    const candidateCardinality = readCardinality(record.candidateCardinality, [
      ...path,
      "candidateCardinality",
    ]);
    if (!isCardinalitySubset(candidateCardinality, sourceCardinality)) {
      fail(
        "invalid-refinement",
        [...path, "candidateCardinality"],
        "Candidate cardinality is not a subset of source cardinality",
      );
    }
    const slotMappings = expectArray(record.slotMappings, [
      ...path,
      "slotMappings",
    ]).map((mapping, index) => {
      const mappingPath = [...path, "slotMappings", index];
      const mappingRecord = expectRecord(mapping, mappingPath, [
        "sourceSymbolId",
        "candidateSymbolId",
      ]);
      return {
        sourceSymbolId: expectDigest(mappingRecord.sourceSymbolId, [
          ...mappingPath,
          "sourceSymbolId",
        ]),
        candidateSymbolId: expectNullableDigest(
          mappingRecord.candidateSymbolId,
          [...mappingPath, "candidateSymbolId"],
        ),
      };
    });
    const canonicalMappings = sortedCopy(slotMappings, (left, right) =>
      firstComparison(
        compareText(left.sourceSymbolId, right.sourceSymbolId),
        compareText(
          left.candidateSymbolId ?? "",
          right.candidateSymbolId ?? "",
        ),
      ),
    );
    compareCanonicalList(
      canonicalMappings,
      (left, right) => compareText(left.sourceSymbolId, right.sourceSymbolId),
      [...path, "slotMappings"],
    );
    return {
      kind,
      ...base,
      constraintId: expectDigest(record.constraintId, [
        ...path,
        "constraintId",
      ]),
      sourceCardinality,
      candidateCardinality,
      slotMappings: canonicalMappings,
    };
  }
  if (kind === "omit-unobservable-internal-step") {
    const record = expectRecord(value, path, [
      ...baseFields,
      "constraintId",
      "omittedSourceSymbolIds",
    ]);
    const omittedSourceSymbolIds = expectCanonicalDigestList(
      sortedCopy(
        expectArray(record.omittedSourceSymbolIds, [
          ...path,
          "omittedSourceSymbolIds",
        ]).map((id, index) =>
          expectDigest(id, [...path, "omittedSourceSymbolIds", index]),
        ),
        compareText,
      ),
      [...path, "omittedSourceSymbolIds"],
    );
    return {
      kind,
      ...base,
      constraintId: expectDigest(record.constraintId, [
        ...path,
        "constraintId",
      ]),
      omittedSourceSymbolIds,
    };
  }
  if (kind === "commutative-reorder") {
    const record = expectRecord(value, path, [
      ...baseFields,
      "compositionId",
      "bindingId",
      "policyDescriptorId",
      "policyAcceptanceId",
    ]);
    return {
      kind,
      ...base,
      compositionId: expectDigest(record.compositionId, [
        ...path,
        "compositionId",
      ]),
      bindingId: expectDigest(record.bindingId, [...path, "bindingId"]),
      policyDescriptorId: expectDigest(record.policyDescriptorId, [
        ...path,
        "policyDescriptorId",
      ]),
      policyAcceptanceId: expectDigest(record.policyAcceptanceId, [
        ...path,
        "policyAcceptanceId",
      ]),
    };
  }
  const record = expectRecord(value, path, [
    ...baseFields,
    "constraintId",
    "policyDescriptorId",
    "policyAcceptanceId",
    "eventSlotMappings",
    "overflowTerminalSymbolId",
  ]);
  const eventSlotMappings = expectArray(record.eventSlotMappings, [
    ...path,
    "eventSlotMappings",
  ]).map((mapping, index) => {
    const mappingPath = [...path, "eventSlotMappings", index];
    const mappingRecord = expectRecord(mapping, mappingPath, [
      "sourceEventSymbolId",
      "candidateOccurrenceSymbolId",
    ]);
    return {
      sourceEventSymbolId: expectDigest(mappingRecord.sourceEventSymbolId, [
        ...mappingPath,
        "sourceEventSymbolId",
      ]),
      candidateOccurrenceSymbolId: expectDigest(
        mappingRecord.candidateOccurrenceSymbolId,
        [...mappingPath, "candidateOccurrenceSymbolId"],
      ),
    };
  });
  const canonicalEventMappings = sortedCopy(eventSlotMappings, (left, right) =>
    compareText(left.sourceEventSymbolId, right.sourceEventSymbolId),
  );
  compareCanonicalList(
    canonicalEventMappings,
    (left, right) =>
      compareText(left.sourceEventSymbolId, right.sourceEventSymbolId),
    [...path, "eventSlotMappings"],
  );
  return {
    kind,
    ...base,
    constraintId: expectDigest(record.constraintId, [...path, "constraintId"]),
    policyDescriptorId: expectDigest(record.policyDescriptorId, [
      ...path,
      "policyDescriptorId",
    ]),
    policyAcceptanceId: expectDigest(record.policyAcceptanceId, [
      ...path,
      "policyAcceptanceId",
    ]),
    eventSlotMappings: canonicalEventMappings,
    overflowTerminalSymbolId: expectNullableDigest(
      record.overflowTerminalSymbolId,
      [...path, "overflowTerminalSymbolId"],
    ),
  };
}

/** Creates one closed application of a contract refinement rule. */
async function createObservationRuleApplication(
  input: ObservationRuleApplicationInput,
): Promise<ObservationRuleApplication> {
  const parsed = readRuleApplicationInput(snapshotClosed(input), [], false);
  const preimage: ObservationRuleApplicationPreimage = {
    schema: "dathra.observation-rule-application/3",
    ...parsed,
  };
  return await contentAddressed(preimage);
}

async function parseObservationRuleApplication(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationRuleApplication> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, path, ["id", "preimage"]);
  const id = expectDigest(record.id, [...path, "id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Rule application digest does not match its preimage",
    );
  }
  const input = readRuleApplicationInput(
    record.preimage,
    [...path, "preimage"],
    true,
  );
  const preimage: ObservationRuleApplicationPreimage = {
    schema: "dathra.observation-rule-application/3",
    ...input,
  };
  if (!canonicalEqual(preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      [...path, "preimage"],
      "Rule application preimage is not canonical",
    );
  }
  const parsed = { id, preimage };
  deepFreeze(parsed);
  return parsed;
}

function readComparisonInputClasses(
  value: unknown,
  path: ValidationPath,
): ObservationComparisonClaimPreimage["inputClasses"] {
  const entries = expectArray(value, path).map((entry, index) => {
    const entryPath = [...path, index];
    const record = expectRecord(entry, entryPath, [
      "inputClassId",
      "actualRelationLanguageId",
      "ruleApplicationIds",
      "ruleApplicationAcceptanceIds",
    ]);
    const ruleApplicationIds = sortedCopy(
      expectArray(record.ruleApplicationIds, [
        ...entryPath,
        "ruleApplicationIds",
      ]).map((id, ruleIndex) =>
        expectDigest(id, [...entryPath, "ruleApplicationIds", ruleIndex]),
      ),
      compareText,
    );
    compareCanonicalList(ruleApplicationIds, compareText, [
      ...entryPath,
      "ruleApplicationIds",
    ]);
    const ruleApplicationAcceptanceIds = sortedCopy(
      expectArray(record.ruleApplicationAcceptanceIds, [
        ...entryPath,
        "ruleApplicationAcceptanceIds",
      ]).map((id, acceptanceIndex) =>
        expectDigest(id, [
          ...entryPath,
          "ruleApplicationAcceptanceIds",
          acceptanceIndex,
        ]),
      ),
      compareText,
    );
    compareCanonicalList(ruleApplicationAcceptanceIds, compareText, [
      ...entryPath,
      "ruleApplicationAcceptanceIds",
    ]);
    return {
      inputClassId: expectDigest(record.inputClassId, [
        ...entryPath,
        "inputClassId",
      ]),
      actualRelationLanguageId: expectDigest(record.actualRelationLanguageId, [
        ...entryPath,
        "actualRelationLanguageId",
      ]),
      ruleApplicationIds,
      ruleApplicationAcceptanceIds,
    };
  });
  const canonical = sortedCopy(entries, (left, right) =>
    compareText(left.inputClassId, right.inputClassId),
  );
  compareCanonicalList(
    canonical,
    (left, right) => compareText(left.inputClassId, right.inputClassId),
    path,
  );
  return canonical;
}

/** Creates a source-to-candidate observation comparison claim. */
async function createObservationComparisonClaim(
  input: ObservationComparisonClaimInput,
): Promise<ObservationComparisonClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "observationContractId",
      "compositionId",
      "sourceSummaryId",
      "candidateSummaryId",
      "inputClasses",
    ],
  );
  return await contentAddressed({
    schema: "dathra.observation-comparison-claim/2",
    observationContractId: expectDigest(record.observationContractId, [
      "observationContractId",
    ]),
    compositionId: expectNullableDigest(record.compositionId, [
      "compositionId",
    ]),
    direction: "source-to-candidate",
    sourceSummaryId: expectDigest(record.sourceSummaryId, ["sourceSummaryId"]),
    candidateSummaryId: expectDigest(record.candidateSummaryId, [
      "candidateSummaryId",
    ]),
    inputClasses: readComparisonInputClasses(record.inputClasses, [
      "inputClasses",
    ]),
  });
}

async function parseObservationComparisonClaim(
  value: unknown,
): Promise<ObservationComparisonClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Comparison claim digest does not match its preimage",
    );
  }
  const preimageRecord = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "observationContractId",
      "compositionId",
      "direction",
      "sourceSummaryId",
      "candidateSummaryId",
      "inputClasses",
    ],
  );
  expectLiteral(
    preimageRecord.schema,
    "dathra.observation-comparison-claim/2",
    ["preimage", "schema"],
  );
  expectLiteral(preimageRecord.direction, "source-to-candidate", [
    "preimage",
    "direction",
  ]);
  const preimage: ObservationComparisonClaimPreimage = {
    schema: "dathra.observation-comparison-claim/2",
    observationContractId: expectDigest(preimageRecord.observationContractId, [
      "preimage",
      "observationContractId",
    ]),
    compositionId: expectNullableDigest(preimageRecord.compositionId, [
      "preimage",
      "compositionId",
    ]),
    direction: "source-to-candidate",
    sourceSummaryId: expectDigest(preimageRecord.sourceSummaryId, [
      "preimage",
      "sourceSummaryId",
    ]),
    candidateSummaryId: expectDigest(preimageRecord.candidateSummaryId, [
      "preimage",
      "candidateSummaryId",
    ]),
    inputClasses: readComparisonInputClasses(preimageRecord.inputClasses, [
      "preimage",
      "inputClasses",
    ]),
  };
  if (!canonicalEqual(preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Comparison claim preimage is not canonical",
    );
  }
  const parsed = { id, preimage };
  deepFreeze(parsed);
  return parsed;
}

/** Creates a structural proof acceptance without granting trust. */
async function createObservationProofAcceptance(
  input: ObservationProofAcceptanceInput,
): Promise<ObservationProofAcceptance> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    ["proofDomainId", "claimDigest", "attestationDigest"],
  );
  return await contentAddressed({
    schema: "dathra.observation-proof-acceptance/1",
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
    claimDigest: expectDigest(record.claimDigest, ["claimDigest"]),
    attestationDigest: expectDigest(record.attestationDigest, [
      "attestationDigest",
    ]),
  });
}

/** Parses and re-digests a structural proof acceptance record. */
async function parseObservationProofAcceptance(
  value: unknown,
): Promise<ObservationProofAcceptance> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Proof acceptance digest does not match its preimage",
    );
  }
  const preimageRecord = expectRecord(
    record.preimage,
    ["preimage"],
    ["schema", "proofDomainId", "claimDigest", "attestationDigest"],
  );
  expectLiteral(
    preimageRecord.schema,
    "dathra.observation-proof-acceptance/1",
    ["preimage", "schema"],
  );
  const preimage: ObservationProofAcceptancePreimage = {
    schema: "dathra.observation-proof-acceptance/1",
    proofDomainId: expectDigest(preimageRecord.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
    claimDigest: expectDigest(preimageRecord.claimDigest, [
      "preimage",
      "claimDigest",
    ]),
    attestationDigest: expectDigest(preimageRecord.attestationDigest, [
      "preimage",
      "attestationDigest",
    ]),
  };
  if (!canonicalEqual(preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Proof acceptance preimage is not canonical",
    );
  }
  const parsed = { id, preimage };
  deepFreeze(parsed);
  return parsed;
}

/** Creates a versioned policy descriptor for one refinement-rule transducer. */
async function createObservationRulePolicyDescriptor(
  input: ObservationRulePolicyDescriptorInput,
): Promise<ObservationRulePolicyDescriptor> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "observationContractId",
      "ruleId",
      "inputClassId",
      "sourceTraceLanguageId",
      "candidateTraceLanguageId",
      "policyQualifiedId",
      "version",
      "policyRuleGraphDigest",
      "policyTransducerLanguageId",
      "proofDomainId",
    ],
  );
  return await contentAddressed({
    schema: "dathra.observation-rule-policy/2",
    observationContractId: expectDigest(record.observationContractId, [
      "observationContractId",
    ]),
    ruleId: expectDigest(record.ruleId, ["ruleId"]),
    inputClassId: expectDigest(record.inputClassId, ["inputClassId"]),
    sourceTraceLanguageId: expectDigest(record.sourceTraceLanguageId, [
      "sourceTraceLanguageId",
    ]),
    candidateTraceLanguageId: expectDigest(record.candidateTraceLanguageId, [
      "candidateTraceLanguageId",
    ]),
    policyQualifiedId: expectPolicyId(record.policyQualifiedId, [
      "policyQualifiedId",
    ]),
    version: expectNonEmptyString(record.version, ["version"]),
    policyRuleGraphDigest: expectDigest(record.policyRuleGraphDigest, [
      "policyRuleGraphDigest",
    ]),
    policyTransducerLanguageId: expectDigest(
      record.policyTransducerLanguageId,
      ["policyTransducerLanguageId"],
    ),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

async function parseObservationRulePolicyDescriptor(
  value: unknown,
): Promise<ObservationRulePolicyDescriptor> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Rule policy descriptor digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "observationContractId",
      "ruleId",
      "inputClassId",
      "sourceTraceLanguageId",
      "candidateTraceLanguageId",
      "policyQualifiedId",
      "version",
      "policyRuleGraphDigest",
      "policyTransducerLanguageId",
      "proofDomainId",
    ],
  );
  expectLiteral(preimage.schema, "dathra.observation-rule-policy/2", [
    "preimage",
    "schema",
  ]);
  const parsed = await createObservationRulePolicyDescriptor({
    observationContractId: expectDigest(preimage.observationContractId, [
      "preimage",
      "observationContractId",
    ]),
    ruleId: expectDigest(preimage.ruleId, ["preimage", "ruleId"]),
    inputClassId: expectDigest(preimage.inputClassId, [
      "preimage",
      "inputClassId",
    ]),
    sourceTraceLanguageId: expectDigest(preimage.sourceTraceLanguageId, [
      "preimage",
      "sourceTraceLanguageId",
    ]),
    candidateTraceLanguageId: expectDigest(preimage.candidateTraceLanguageId, [
      "preimage",
      "candidateTraceLanguageId",
    ]),
    policyQualifiedId: expectPolicyId(preimage.policyQualifiedId, [
      "preimage",
      "policyQualifiedId",
    ]),
    version: expectNonEmptyString(preimage.version, ["preimage", "version"]),
    policyRuleGraphDigest: expectDigest(preimage.policyRuleGraphDigest, [
      "preimage",
      "policyRuleGraphDigest",
    ]),
    policyTransducerLanguageId: expectDigest(
      preimage.policyTransducerLanguageId,
      ["preimage", "policyTransducerLanguageId"],
    ),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Rule policy descriptor preimage is not canonical",
    );
  }
  return parsed;
}

/** Creates a versioned algebra descriptor for one composition policy transducer. */
async function createObservationCompositionAlgebraDescriptor(
  input: ObservationCompositionAlgebraDescriptorInput,
): Promise<ObservationCompositionAlgebraDescriptor> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "operationKind",
      "version",
      "constraintKind",
      "policyQualifiedId",
      "policyRuleGraphDigest",
      "policyTransducerLanguageId",
      "proofDomainId",
    ],
  );
  return await contentAddressed({
    schema: "dathra.observation-composition-algebra/2",
    operationKind: expectOneOf(
      record.operationKind,
      ["commutative", "total-order"] as const,
      ["operationKind"],
    ),
    version: expectNonEmptyString(record.version, ["version"]),
    constraintKind: expectOneOf(record.constraintKind, CONSTRAINT_KINDS, [
      "constraintKind",
    ]),
    policyQualifiedId: expectPolicyId(record.policyQualifiedId, [
      "policyQualifiedId",
    ]),
    policyRuleGraphDigest: expectDigest(record.policyRuleGraphDigest, [
      "policyRuleGraphDigest",
    ]),
    policyTransducerLanguageId: expectDigest(
      record.policyTransducerLanguageId,
      ["policyTransducerLanguageId"],
    ),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

async function parseObservationCompositionAlgebraDescriptor(
  value: unknown,
): Promise<ObservationCompositionAlgebraDescriptor> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Composition algebra descriptor digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "operationKind",
      "version",
      "constraintKind",
      "policyQualifiedId",
      "policyRuleGraphDigest",
      "policyTransducerLanguageId",
      "proofDomainId",
    ],
  );
  expectLiteral(preimage.schema, "dathra.observation-composition-algebra/2", [
    "preimage",
    "schema",
  ]);
  const parsed = await createObservationCompositionAlgebraDescriptor({
    operationKind: expectOneOf(
      preimage.operationKind,
      ["commutative", "total-order"] as const,
      ["preimage", "operationKind"],
    ),
    version: expectNonEmptyString(preimage.version, ["preimage", "version"]),
    constraintKind: expectOneOf(preimage.constraintKind, CONSTRAINT_KINDS, [
      "preimage",
      "constraintKind",
    ]),
    policyQualifiedId: expectPolicyId(preimage.policyQualifiedId, [
      "preimage",
      "policyQualifiedId",
    ]),
    policyRuleGraphDigest: expectDigest(preimage.policyRuleGraphDigest, [
      "preimage",
      "policyRuleGraphDigest",
    ]),
    policyTransducerLanguageId: expectDigest(
      preimage.policyTransducerLanguageId,
      ["preimage", "policyTransducerLanguageId"],
    ),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Composition algebra descriptor preimage is not canonical",
    );
  }
  return parsed;
}

/** Creates one class-local application of a structural composition policy. */
async function createObservationCompositionPolicyApplication(
  input: ObservationCompositionPolicyApplicationInput,
): Promise<ObservationCompositionPolicyApplication> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "compositionId",
      "inputClassId",
      "memberTraceLanguageIds",
      "resultTraceLanguageId",
      "bindingId",
      "algebraDescriptorId",
      "policyLanguageId",
    ],
  );
  const memberTraceLanguageIds = expectArray(record.memberTraceLanguageIds, [
    "memberTraceLanguageIds",
  ]).map((id, index) => expectDigest(id, ["memberTraceLanguageIds", index]));
  if (memberTraceLanguageIds.length === 0) {
    fail(
      "invalid-field",
      ["memberTraceLanguageIds"],
      "Composition policy application requires a member language position",
    );
  }
  return await contentAddressed({
    schema: "dathra.observation-composition-policy-application/1",
    compositionId: expectDigest(record.compositionId, ["compositionId"]),
    inputClassId: expectDigest(record.inputClassId, ["inputClassId"]),
    memberTraceLanguageIds,
    resultTraceLanguageId: expectDigest(record.resultTraceLanguageId, [
      "resultTraceLanguageId",
    ]),
    bindingId: expectDigest(record.bindingId, ["bindingId"]),
    algebraDescriptorId: expectDigest(record.algebraDescriptorId, [
      "algebraDescriptorId",
    ]),
    policyLanguageId: expectDigest(record.policyLanguageId, [
      "policyLanguageId",
    ]),
  });
}

async function parseObservationCompositionPolicyApplication(
  value: unknown,
): Promise<ObservationCompositionPolicyApplication> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Composition policy application digest mismatch",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "compositionId",
      "inputClassId",
      "memberTraceLanguageIds",
      "resultTraceLanguageId",
      "bindingId",
      "algebraDescriptorId",
      "policyLanguageId",
    ],
  );
  expectLiteral(
    preimage.schema,
    "dathra.observation-composition-policy-application/1",
    ["preimage", "schema"],
  );
  const parsed = await createObservationCompositionPolicyApplication({
    compositionId: expectDigest(preimage.compositionId, [
      "preimage",
      "compositionId",
    ]),
    inputClassId: expectDigest(preimage.inputClassId, [
      "preimage",
      "inputClassId",
    ]),
    memberTraceLanguageIds: expectArray(preimage.memberTraceLanguageIds, [
      "preimage",
      "memberTraceLanguageIds",
    ]).map((languageId, index) =>
      expectDigest(languageId, ["preimage", "memberTraceLanguageIds", index]),
    ),
    resultTraceLanguageId: expectDigest(preimage.resultTraceLanguageId, [
      "preimage",
      "resultTraceLanguageId",
    ]),
    bindingId: expectDigest(preimage.bindingId, ["preimage", "bindingId"]),
    algebraDescriptorId: expectDigest(preimage.algebraDescriptorId, [
      "preimage",
      "algebraDescriptorId",
    ]),
    policyLanguageId: expectDigest(preimage.policyLanguageId, [
      "preimage",
      "policyLanguageId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Composition policy application preimage is not canonical",
    );
  }
  return parsed;
}

/** Creates an upstream-only proof claim for a composition policy application. */
async function createObservationCompositionPolicyDerivationClaim(
  input: ObservationCompositionPolicyDerivationClaimInput,
): Promise<ObservationCompositionPolicyDerivationClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "policyApplicationId",
      "algebraDescriptorId",
      "policyLanguageId",
      "proofDomainId",
    ],
  );
  return await contentAddressed({
    schema: "dathra.observation-composition-policy-derivation-claim/1",
    policyApplicationId: expectDigest(record.policyApplicationId, [
      "policyApplicationId",
    ]),
    algebraDescriptorId: expectDigest(record.algebraDescriptorId, [
      "algebraDescriptorId",
    ]),
    policyLanguageId: expectDigest(record.policyLanguageId, [
      "policyLanguageId",
    ]),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

async function parseObservationCompositionPolicyDerivationClaim(
  value: unknown,
): Promise<ObservationCompositionPolicyDerivationClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail("digest-mismatch", ["id"], "Composition policy claim digest mismatch");
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "policyApplicationId",
      "algebraDescriptorId",
      "policyLanguageId",
      "proofDomainId",
    ],
  );
  expectLiteral(
    preimage.schema,
    "dathra.observation-composition-policy-derivation-claim/1",
    ["preimage", "schema"],
  );
  const parsed = await createObservationCompositionPolicyDerivationClaim({
    policyApplicationId: expectDigest(preimage.policyApplicationId, [
      "preimage",
      "policyApplicationId",
    ]),
    algebraDescriptorId: expectDigest(preimage.algebraDescriptorId, [
      "preimage",
      "algebraDescriptorId",
    ]),
    policyLanguageId: expectDigest(preimage.policyLanguageId, [
      "preimage",
      "policyLanguageId",
    ]),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Composition policy derivation claim preimage is not canonical",
    );
  }
  return parsed;
}

/** Creates an acyclic proof claim over a descriptor and its policy language. */
async function createObservationPolicyDerivationClaim(
  input: ObservationPolicyDerivationClaimInput,
): Promise<ObservationPolicyDerivationClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    ["policyDescriptorId", "policyLanguageId", "proofDomainId"],
  );
  return await contentAddressed({
    schema: "dathra.observation-policy-derivation-claim/1",
    policyDescriptorId: expectDigest(record.policyDescriptorId, [
      "policyDescriptorId",
    ]),
    policyLanguageId: expectDigest(record.policyLanguageId, [
      "policyLanguageId",
    ]),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

async function parseObservationPolicyDerivationClaim(
  value: unknown,
): Promise<ObservationPolicyDerivationClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Policy derivation claim digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    ["schema", "policyDescriptorId", "policyLanguageId", "proofDomainId"],
  );
  expectLiteral(
    preimage.schema,
    "dathra.observation-policy-derivation-claim/1",
    ["preimage", "schema"],
  );
  const parsed = await createObservationPolicyDerivationClaim({
    policyDescriptorId: expectDigest(preimage.policyDescriptorId, [
      "preimage",
      "policyDescriptorId",
    ]),
    policyLanguageId: expectDigest(preimage.policyLanguageId, [
      "preimage",
      "policyLanguageId",
    ]),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Policy derivation claim preimage is not canonical",
    );
  }
  return parsed;
}

function compareConstraintReference(
  left: ObservationConstraintReference,
  right: ObservationConstraintReference,
): number {
  return firstComparison(
    compareText(left.contractId, right.contractId),
    compareText(left.constraintId, right.constraintId),
  );
}

function constraintReferenceKey(
  reference: ObservationConstraintReference,
): string {
  return `${reference.contractId}\u0000${reference.constraintId}`;
}

function readConstraintReference(
  value: unknown,
  path: ValidationPath,
): ObservationConstraintReference {
  const record = expectRecord(value, path, ["contractId", "constraintId"]);
  return {
    contractId: expectDigest(record.contractId, [...path, "contractId"]),
    constraintId: expectDigest(record.constraintId, [...path, "constraintId"]),
  };
}

function readObservationPolicyRequirement(
  value: unknown,
  path: ValidationPath,
): ObservationPolicyRequirement {
  const record = expectRecord(value, path, [
    "policyQualifiedId",
    "version",
    "policyRuleGraphDigest",
    "proofDomainId",
  ]);
  return {
    policyQualifiedId: expectPolicyId(record.policyQualifiedId, [
      ...path,
      "policyQualifiedId",
    ]),
    version: expectNonEmptyString(record.version, [...path, "version"]),
    policyRuleGraphDigest: expectDigest(record.policyRuleGraphDigest, [
      ...path,
      "policyRuleGraphDigest",
    ]),
    proofDomainId: expectDigest(record.proofDomainId, [
      ...path,
      "proofDomainId",
    ]),
  };
}

function readCompositionBindingInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationCompositionBindingInput {
  const record = expectRecord(
    value,
    path,
    includesId
      ? [
          "schema",
          "id",
          "sharedSubjectId",
          "constraintKind",
          "members",
          "resolution",
        ]
      : ["sharedSubjectId", "constraintKind", "members", "resolution"],
  );
  if (includesId) {
    expectLiteral(record.schema, "dathra.observation-composition-binding/3", [
      ...path,
      "schema",
    ]);
  }
  const members = expectArray(record.members, [...path, "members"]).map(
    (member, index) =>
      readConstraintReference(member, [...path, "members", index]),
  );
  const canonicalMembers = sortedCopy(members, compareConstraintReference);
  compareCanonicalList(canonicalMembers, compareConstraintReference, [
    ...path,
    "members",
  ]);
  if (canonicalMembers.length < 2) {
    fail(
      "composition-conflict",
      [...path, "members"],
      "A shared binding must contain at least two members",
    );
  }
  if (
    includesId &&
    members.some(
      (member, index) =>
        constraintReferenceKey(member) !==
        constraintReferenceKey(canonicalMembers[index]),
    )
  ) {
    fail(
      "noncanonical-order",
      [...path, "members"],
      "Binding members are not canonically ordered",
    );
  }
  const resolutionRecord = isDataRecord(record.resolution)
    ? record.resolution
    : fail(
        "invalid-field",
        [...path, "resolution"],
        "Expected a composition resolution record",
      );
  const resolutionKind = expectOneOf(
    resolutionRecord.kind,
    [
      "merge-identical",
      "exclusive-owner",
      "commutative",
      "total-order",
    ] as const,
    [...path, "resolution", "kind"],
  );
  let resolution: ObservationCompositionBinding["resolution"];
  if (resolutionKind === "merge-identical") {
    expectRecord(resolutionRecord, [...path, "resolution"], ["kind"]);
    resolution = { kind: resolutionKind };
  } else if (resolutionKind === "exclusive-owner") {
    const parsed = expectRecord(
      resolutionRecord,
      [...path, "resolution"],
      ["kind", "owner"],
    );
    const owner = readConstraintReference(parsed.owner, [
      ...path,
      "resolution",
      "owner",
    ]);
    if (
      !canonicalMembers.some(
        (member) =>
          constraintReferenceKey(member) === constraintReferenceKey(owner),
      )
    ) {
      fail(
        "composition-conflict",
        [...path, "resolution", "owner"],
        "Exclusive owner is not a binding member",
      );
    }
    resolution = { kind: resolutionKind, owner };
  } else if (resolutionKind === "commutative") {
    const parsed = expectRecord(
      resolutionRecord,
      [...path, "resolution"],
      ["kind", "policyRequirement"],
    );
    resolution = {
      kind: resolutionKind,
      policyRequirement: readObservationPolicyRequirement(
        parsed.policyRequirement,
        [...path, "resolution", "policyRequirement"],
      ),
    };
  } else {
    const parsed = expectRecord(
      resolutionRecord,
      [...path, "resolution"],
      ["kind", "orderedMembers", "policyRequirement"],
    );
    const orderedMembers = expectArray(parsed.orderedMembers, [
      ...path,
      "resolution",
      "orderedMembers",
    ]).map((member, index) =>
      readConstraintReference(member, [
        ...path,
        "resolution",
        "orderedMembers",
        index,
      ]),
    );
    const orderedKeys = orderedMembers.map(constraintReferenceKey);
    if (
      new Set(orderedKeys).size !== orderedKeys.length ||
      orderedKeys.length !== canonicalMembers.length ||
      canonicalMembers.some(
        (member) => !orderedKeys.includes(constraintReferenceKey(member)),
      )
    ) {
      fail(
        "composition-conflict",
        [...path, "resolution", "orderedMembers"],
        "Total-order members must be an exact binding-member permutation",
      );
    }
    resolution = {
      kind: resolutionKind,
      orderedMembers,
      policyRequirement: readObservationPolicyRequirement(
        parsed.policyRequirement,
        [...path, "resolution", "policyRequirement"],
      ),
    };
  }
  return {
    sharedSubjectId: expectNonEmptyString(record.sharedSubjectId, [
      ...path,
      "sharedSubjectId",
    ]),
    constraintKind: expectOneOf(record.constraintKind, CONSTRAINT_KINDS, [
      ...path,
      "constraintKind",
    ]),
    members: canonicalMembers,
    resolution,
  };
}

async function readCompositionBinding(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationCompositionBinding> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a composition binding record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readCompositionBindingInput(record, path, true);
  const preimage = {
    schema: "dathra.observation-composition-binding/3" as const,
    ...input,
  };
  if (id !== (await digestCanonicalJson(preimage))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Composition binding digest does not match its preimage",
    );
  }
  const result: ObservationCompositionBinding = { id, ...preimage };
  deepFreeze(result);
  return result;
}

/** Creates a canonical resolution for one shared subject and constraint kind. */
async function createObservationCompositionBinding(
  input: ObservationCompositionBindingInput,
): Promise<ObservationCompositionBinding> {
  const inputPreimage = readCompositionBindingInput(
    snapshotClosed(input),
    [],
    false,
  );
  const preimage = {
    schema: "dathra.observation-composition-binding/3" as const,
    ...inputPreimage,
  };
  const result: ObservationCompositionBinding = {
    id: await digestCanonicalJson(preimage),
    ...preimage,
  };
  deepFreeze(result);
  return result;
}

function constraintSemanticDomain(constraint: ObservationConstraint): unknown {
  const base = {
    kind: constraint.kind,
    visibility: constraint.visibility,
  };
  switch (constraint.kind) {
    case "value":
      return {
        ...base,
        equivalenceDomainId: constraint.equivalenceDomainId,
        consistencyCutId: constraint.consistencyCutId,
      };
    case "dom":
      return {
        ...base,
        realizationDomainId: constraint.realizationDomainId,
        mutableFacetPolicyId: constraint.mutableFacetPolicyId,
        consistencyCutId: constraint.consistencyCutId,
      };
    case "artifact":
    case "protocol":
      return {
        ...base,
        byteOrMessageSchemaId: constraint.byteOrMessageSchemaId,
      };
    case "event":
    case "effect":
    case "callback":
      return {
        ...base,
        inputIdentityDomainId: constraint.inputIdentityDomainId,
        occurrenceIdentityDomainId: constraint.occurrenceIdentityDomainId,
        admissionCutId: constraint.admissionCutId,
        coalescingPolicyRequirement: constraint.coalescingPolicyRequirement,
      };
    case "identity":
    case "lifetime":
      return {
        ...base,
        identityDomainId: constraint.identityDomainId,
        lifetimeDomainId: constraint.lifetimeDomainId,
      };
    case "authority":
    case "exposure":
      return {
        ...base,
        policyQualifiedId: constraint.policyQualifiedId,
        policyEpochDomainId: constraint.policyEpochDomainId,
      };
    case "terminal":
      return base;
  }
}

function isExclusiveOwnerSubset(
  owner: ObservationConstraint,
  member: ObservationConstraint,
): boolean {
  if (
    !canonicalEqual(
      constraintSemanticDomain(owner),
      constraintSemanticDomain(member),
    )
  ) {
    return false;
  }
  if (
    !isCardinalitySubset(
      effectiveCardinality(owner),
      effectiveCardinality(member),
    )
  ) {
    return false;
  }
  return (
    owner.kind !== "terminal" ||
    (member.kind === "terminal" &&
      owner.outcomes.every((outcome) => member.outcomes.includes(outcome)))
  );
}

interface ConstraintWithReference {
  readonly reference: ObservationConstraintReference;
  readonly constraint: ObservationConstraint;
}

function compositionGroupKey(constraint: ObservationConstraint): string {
  return `${constraint.subjectId}\u0000${constraint.kind}`;
}

function compareMemberMapping(
  left: ObservationCompositionPreimage["memberToResult"][number],
  right: ObservationCompositionPreimage["memberToResult"][number],
): number {
  return compareConstraintReference(left.member, right.member);
}

function deriveOrderClosure(
  resultConstraintIds: readonly Sha256Digest[],
  directEdges: ReadonlySet<string>,
): ObservationCompositionPreimage["resultOrderClosure"] {
  const outgoing = new Map<Sha256Digest, Set<Sha256Digest>>(
    resultConstraintIds.map((id) => [id, new Set()]),
  );
  const indegree = new Map<Sha256Digest, number>(
    resultConstraintIds.map((id) => [id, 0]),
  );
  for (const edge of directEdges) {
    const separator = edge.indexOf("\u0000");
    const before = edge.slice(0, separator);
    const after = edge.slice(separator + 1);
    if (!isSha256Digest(before) || !isSha256Digest(after) || before === after) {
      continue;
    }
    const targets = outgoing.get(before);
    if (targets === undefined || !outgoing.has(after) || targets.has(after)) {
      continue;
    }
    targets.add(after);
    indegree.set(after, (indegree.get(after) ?? 0) + 1);
  }
  const ready = sortedCopy(
    resultConstraintIds.filter((id) => indegree.get(id) === 0),
    compareText,
  );
  let visited = 0;
  for (let cursor = 0; cursor < ready.length; cursor += 1) {
    const current = ready[cursor];
    visited += 1;
    for (const target of sortedCopy(
      [...(outgoing.get(current) ?? [])],
      compareText,
    )) {
      const next = (indegree.get(target) ?? 0) - 1;
      indegree.set(target, next);
      if (next === 0) {
        ready.push(target);
      }
    }
  }
  if (visited !== resultConstraintIds.length) {
    fail(
      "composition-conflict",
      ["resultOrderClosure"],
      "Composed result order contains a cycle",
    );
  }
  const closure: {
    readonly beforeConstraintId: Sha256Digest;
    readonly afterConstraintId: Sha256Digest;
  }[] = [];
  for (const source of resultConstraintIds) {
    const reached = new Set<Sha256Digest>();
    const queue = [...(outgoing.get(source) ?? [])];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      const target = queue[cursor];
      if (reached.has(target)) continue;
      reached.add(target);
      for (const next of outgoing.get(target) ?? []) {
        queue.push(next);
      }
    }
    for (const target of sortedCopy([...reached], compareText)) {
      closure.push({
        beforeConstraintId: source,
        afterConstraintId: target,
      });
    }
  }
  closure.sort((left, right) =>
    firstComparison(
      compareText(left.beforeConstraintId, right.beforeConstraintId),
      compareText(left.afterConstraintId, right.afterConstraintId),
    ),
  );
  return closure;
}

function readCompositionResultContractHeader(
  value: unknown,
  path: ValidationPath,
): ObservationCompositionResultContractHeader {
  const record = expectRecord(value, path, [
    "rootDefinitionId",
    "externalInputIdentitySchemaId",
    "eventIdentitySchemaId",
    "initialCutId",
  ]);
  return {
    rootDefinitionId: expectNonEmptyString(record.rootDefinitionId, [
      ...path,
      "rootDefinitionId",
    ]),
    externalInputIdentitySchemaId: expectNonEmptyString(
      record.externalInputIdentitySchemaId,
      [...path, "externalInputIdentitySchemaId"],
    ),
    eventIdentitySchemaId: expectNonEmptyString(record.eventIdentitySchemaId, [
      ...path,
      "eventIdentitySchemaId",
    ]),
    initialCutId: expectNonEmptyString(record.initialCutId, [
      ...path,
      "initialCutId",
    ]),
  };
}

async function deriveObservationComposition(
  memberContracts: readonly ObservationContract[],
  bindings: readonly ObservationCompositionBinding[],
  resultContractHeader: ObservationCompositionResultContractHeader,
): Promise<ObservationComposition> {
  const canonicalContracts = sortedCopy(memberContracts, (left, right) =>
    compareText(left.id, right.id),
  );
  compareCanonicalList(
    canonicalContracts,
    (left, right) => compareText(left.id, right.id),
    ["memberContracts"],
  );
  if (canonicalContracts.length === 0) {
    fail(
      "composition-conflict",
      ["memberContracts"],
      "A composition must contain at least one contract",
    );
  }
  for (let index = 0; index < canonicalContracts.length; index += 1) {
    const contract = canonicalContracts[index];
    if (
      contract.preimage.externalInputIdentitySchemaId !==
        resultContractHeader.externalInputIdentitySchemaId ||
      contract.preimage.eventIdentitySchemaId !==
        resultContractHeader.eventIdentitySchemaId ||
      contract.preimage.initialCutId !== resultContractHeader.initialCutId
    ) {
      fail(
        "contract-mismatch",
        ["memberContracts", index],
        "Member contract input identity does not match the result contract header",
      );
    }
  }
  const canonicalBindings = sortedCopy(bindings, (left, right) =>
    compareText(left.id, right.id),
  );
  compareCanonicalList(
    canonicalBindings,
    (left, right) => compareText(left.id, right.id),
    ["bindings"],
  );
  const allMembers: ConstraintWithReference[] = [];
  const byReference = new Map<string, ConstraintWithReference>();
  const byGroup = new Map<string, ConstraintWithReference[]>();
  for (const contract of canonicalContracts) {
    for (const constraint of contract.preimage.constraints) {
      const item: ConstraintWithReference = {
        reference: {
          contractId: contract.id,
          constraintId: constraint.id,
        },
        constraint,
      };
      allMembers.push(item);
      byReference.set(constraintReferenceKey(item.reference), item);
      const key = compositionGroupKey(constraint);
      const group = byGroup.get(key);
      if (group === undefined) byGroup.set(key, [item]);
      else group.push(item);
    }
  }
  const bindingByGroup = new Map<string, ObservationCompositionBinding>();
  for (let index = 0; index < canonicalBindings.length; index += 1) {
    const binding = canonicalBindings[index];
    const key = `${binding.sharedSubjectId}\u0000${binding.constraintKind}`;
    if (bindingByGroup.has(key)) {
      fail(
        "composition-conflict",
        ["bindings", index],
        "A shared subject and kind has more than one binding",
      );
    }
    for (
      let memberIndex = 0;
      memberIndex < binding.members.length;
      memberIndex += 1
    ) {
      if (
        !byReference.has(constraintReferenceKey(binding.members[memberIndex]))
      ) {
        fail(
          "dangling-reference",
          ["bindings", index, "members", memberIndex],
          "Binding member does not resolve in the supplied contracts",
        );
      }
    }
    bindingByGroup.set(key, binding);
  }

  const mappingByReference = new Map<string, Sha256Digest>();
  for (const [groupKey, group] of byGroup) {
    const canonicalGroup = sortedCopy(group, (left, right) =>
      compareConstraintReference(left.reference, right.reference),
    );
    if (canonicalGroup.length === 1) {
      mappingByReference.set(
        constraintReferenceKey(canonicalGroup[0].reference),
        canonicalGroup[0].constraint.id,
      );
      if (bindingByGroup.has(groupKey)) {
        fail(
          "composition-conflict",
          ["bindings"],
          "A binding targets a constraint that is not shared",
        );
      }
      continue;
    }
    const binding = bindingByGroup.get(groupKey);
    if (binding === undefined) {
      fail(
        "composition-conflict",
        ["bindings"],
        "A shared subject and kind is missing its binding",
      );
    }
    const expectedMembers = canonicalGroup.map(({ reference }) => reference);
    if (!canonicalEqual(binding.members, expectedMembers)) {
      fail(
        "composition-conflict",
        ["bindings", binding.id, "members"],
        "Binding does not exactly cover its shared subject and kind",
      );
    }
    const firstDomain = constraintSemanticDomain(canonicalGroup[0].constraint);
    if (
      canonicalGroup.some(
        ({ constraint }) =>
          !canonicalEqual(firstDomain, constraintSemanticDomain(constraint)),
      )
    ) {
      fail(
        "composition-conflict",
        ["bindings", binding.id],
        "Shared constraints use incompatible semantic domains",
      );
    }
    if (binding.resolution.kind === "merge-identical") {
      const resultId = canonicalGroup[0].constraint.id;
      if (canonicalGroup.some(({ constraint }) => constraint.id !== resultId)) {
        fail(
          "composition-conflict",
          ["bindings", binding.id, "resolution"],
          "Merge-identical requires identical constraint records",
        );
      }
      for (const member of canonicalGroup) {
        mappingByReference.set(
          constraintReferenceKey(member.reference),
          resultId,
        );
      }
    } else if (binding.resolution.kind === "exclusive-owner") {
      const owner = byReference.get(
        constraintReferenceKey(binding.resolution.owner),
      );
      if (
        owner === undefined ||
        canonicalGroup.some(
          ({ constraint }) =>
            !isExclusiveOwnerSubset(owner.constraint, constraint),
        )
      ) {
        fail(
          "composition-conflict",
          ["bindings", binding.id, "resolution", "owner"],
          "Exclusive owner is not a safe subset of every member",
        );
      }
      for (const member of canonicalGroup) {
        mappingByReference.set(
          constraintReferenceKey(member.reference),
          owner.constraint.id,
        );
      }
    } else {
      for (const member of canonicalGroup) {
        mappingByReference.set(
          constraintReferenceKey(member.reference),
          member.constraint.id,
        );
      }
    }
    bindingByGroup.delete(groupKey);
  }
  if (bindingByGroup.size > 0) {
    fail(
      "composition-conflict",
      ["bindings"],
      "A composition binding does not correspond to a shared constraint group",
    );
  }

  const memberToResult = sortedCopy(
    allMembers.map(({ reference }) => {
      const resultConstraintId = mappingByReference.get(
        constraintReferenceKey(reference),
      );
      if (resultConstraintId === undefined) {
        fail(
          "composition-conflict",
          ["memberToResult"],
          "A member constraint has no result mapping",
        );
      }
      return { member: reference, resultConstraintId };
    }),
    compareMemberMapping,
  );
  const resultConstraintIds = sortedCopy(
    [
      ...new Set(
        memberToResult.map(({ resultConstraintId }) => resultConstraintId),
      ),
    ],
    compareText,
  );
  const resultConstraintsById = new Map<Sha256Digest, ObservationConstraint>();
  for (const member of allMembers) {
    const resultConstraintId = mappingByReference.get(
      constraintReferenceKey(member.reference),
    );
    if (resultConstraintId !== member.constraint.id) continue;
    const existing = resultConstraintsById.get(resultConstraintId);
    if (
      existing !== undefined &&
      !canonicalEqual(existing, member.constraint)
    ) {
      fail(
        "composition-conflict",
        ["resultContract", "constraints", resultConstraintId],
        "One result constraint ID resolves to incompatible records",
      );
    }
    resultConstraintsById.set(resultConstraintId, member.constraint);
  }
  const resultConstraints = resultConstraintIds.map((resultConstraintId) => {
    const constraint = resultConstraintsById.get(resultConstraintId);
    if (constraint === undefined) {
      fail(
        "composition-conflict",
        ["resultContract", "constraints", resultConstraintId],
        "A result constraint does not resolve to a member constraint record",
      );
    }
    return constraint;
  });
  const directEdges = new Set<string>();
  for (const contract of canonicalContracts) {
    for (const edge of contract.preimage.orderEdges) {
      if (edge.relation === "exclusive") continue;
      const before = mappingByReference.get(
        constraintReferenceKey({
          contractId: contract.id,
          constraintId: edge.beforeConstraintId,
        }),
      );
      const after = mappingByReference.get(
        constraintReferenceKey({
          contractId: contract.id,
          constraintId: edge.afterConstraintId,
        }),
      );
      if (before !== undefined && after !== undefined && before !== after) {
        directEdges.add(`${before}\u0000${after}`);
      }
    }
  }
  for (const binding of canonicalBindings) {
    if (binding.resolution.kind !== "total-order") continue;
    for (
      let index = 1;
      index < binding.resolution.orderedMembers.length;
      index += 1
    ) {
      const before = mappingByReference.get(
        constraintReferenceKey(binding.resolution.orderedMembers[index - 1]),
      );
      const after = mappingByReference.get(
        constraintReferenceKey(binding.resolution.orderedMembers[index]),
      );
      if (before !== undefined && after !== undefined && before !== after) {
        directEdges.add(`${before}\u0000${after}`);
      }
    }
  }
  const resultOrderClosure = deriveOrderClosure(
    resultConstraintIds,
    directEdges,
  );
  const resultOrderEdges: ObservationOrderEdge[] = [];
  for (const pair of resultOrderClosure) {
    resultOrderEdges.push(
      await createObservationOrderEdge({
        beforeConstraintId: pair.beforeConstraintId,
        afterConstraintId: pair.afterConstraintId,
        relation: "strict",
      }),
    );
  }
  const resultContract = await createObservationContract({
    ...resultContractHeader,
    relation: "trace-equality",
    constraints: resultConstraints,
    orderEdges: resultOrderEdges,
    refinementRules: [],
  });
  const preimage: ObservationCompositionPreimage = {
    schema: "dathra.observation-composition/4",
    memberContractIds: canonicalContracts.map(({ id }) => id),
    bindings: canonicalBindings,
    resultContract,
    memberToResult,
    resultOrderClosure,
  };
  return await contentAddressed(preimage);
}

/** Derives a canonical result view from supplied member contracts and bindings. */
async function createObservationComposition(
  input: ObservationCompositionInput,
): Promise<ObservationComposition> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    ["memberContracts", "bindings", "resultContractHeader"],
  );
  const contractValues = expectArray(record.memberContracts, [
    "memberContracts",
  ]);
  const contracts: ObservationContract[] = [];
  for (let index = 0; index < contractValues.length; index += 1) {
    contracts.push(await parseObservationContract(contractValues[index]));
  }
  const bindingValues = expectArray(record.bindings, ["bindings"]);
  const bindings: ObservationCompositionBinding[] = [];
  for (let index = 0; index < bindingValues.length; index += 1) {
    bindings.push(
      await readCompositionBinding(bindingValues[index], ["bindings", index]),
    );
  }
  const resultContractHeader = readCompositionResultContractHeader(
    record.resultContractHeader,
    ["resultContractHeader"],
  );
  return await deriveObservationComposition(
    contracts,
    bindings,
    resultContractHeader,
  );
}

/** Parses a composition and rejects any caller-supplied result view that cannot be rederived. */
async function parseObservationComposition(
  value: unknown,
  memberContracts: readonly ObservationContract[],
): Promise<ObservationComposition> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Composition digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "memberContractIds",
      "bindings",
      "resultContract",
      "memberToResult",
      "resultOrderClosure",
    ],
  );
  expectLiteral(preimage.schema, "dathra.observation-composition/4", [
    "preimage",
    "schema",
  ]);
  const bindingValues = expectArray(preimage.bindings, [
    "preimage",
    "bindings",
  ]);
  const bindings: ObservationCompositionBinding[] = [];
  for (let index = 0; index < bindingValues.length; index += 1) {
    bindings.push(
      await readCompositionBinding(bindingValues[index], [
        "preimage",
        "bindings",
        index,
      ]),
    );
  }
  const contracts: ObservationContract[] = [];
  for (const contract of memberContracts) {
    contracts.push(await parseObservationContract(contract));
  }
  const resultContract = await parseObservationContract(
    preimage.resultContract,
  );
  const resultContractHeader: ObservationCompositionResultContractHeader = {
    rootDefinitionId: resultContract.preimage.rootDefinitionId,
    externalInputIdentitySchemaId:
      resultContract.preimage.externalInputIdentitySchemaId,
    eventIdentitySchemaId: resultContract.preimage.eventIdentitySchemaId,
    initialCutId: resultContract.preimage.initialCutId,
  };
  const derived = await deriveObservationComposition(
    contracts,
    bindings,
    resultContractHeader,
  );
  if (derived.id !== id || !canonicalEqual(derived.preimage, record.preimage)) {
    fail(
      "composition-conflict",
      ["preimage"],
      "Composition result view does not match the canonical derivation",
    );
  }
  return derived;
}

function readCompositionPolicyClosures(
  value: unknown,
  path: ValidationPath,
): readonly ObservationCompositionPolicyClosure[] {
  const closures = expectArray(value, path).map((entry, index) => {
    const entryPath = [...path, index] as const;
    const record = expectRecord(entry, entryPath, [
      "bindingId",
      "policyApplicationId",
      "policyDerivationClaimId",
      "policyAcceptanceId",
    ]);
    return {
      bindingId: expectDigest(record.bindingId, [...entryPath, "bindingId"]),
      policyApplicationId: expectDigest(record.policyApplicationId, [
        ...entryPath,
        "policyApplicationId",
      ]),
      policyDerivationClaimId: expectDigest(record.policyDerivationClaimId, [
        ...entryPath,
        "policyDerivationClaimId",
      ]),
      policyAcceptanceId: expectDigest(record.policyAcceptanceId, [
        ...entryPath,
        "policyAcceptanceId",
      ]),
    };
  });
  const canonical = sortedCopy(closures, (left, right) =>
    compareText(left.bindingId, right.bindingId),
  );
  compareCanonicalList(
    canonical,
    (left, right) => compareText(left.bindingId, right.bindingId),
    path,
  );
  return canonical;
}

async function buildObservationCompositionClaim(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<ObservationCompositionClaim> {
  const record = expectRecord(value, path, [
    ...(includesSchema ? ["schema"] : []),
    "compositionId",
    "resultContractId",
    "memberSummaryIds",
    "resultSummaryId",
    "inputClasses",
  ]);
  if (includesSchema) {
    expectLiteral(record.schema, "dathra.observation-composition-claim/3", [
      ...path,
      "schema",
    ]);
  }
  const memberSummaryIds = expectArray(record.memberSummaryIds, [
    "memberSummaryIds",
  ]).map((id, index) => expectDigest(id, [...path, "memberSummaryIds", index]));
  if (
    memberSummaryIds.length === 0 ||
    new Set(memberSummaryIds).size !== memberSummaryIds.length
  ) {
    fail(
      "invalid-field",
      [...path, "memberSummaryIds"],
      "Composition claim requires unique member summary positions",
    );
  }
  const inputClasses = expectArray(record.inputClasses, ["inputClasses"]).map(
    (entry, index) => {
      const entryPath = [...path, "inputClasses", index] as const;
      const entryRecord = expectRecord(entry, entryPath, [
        "inputClassId",
        "memberTraceLanguageIds",
        "resultTraceLanguageId",
        "actualRelationLanguageId",
        "bindingIds",
        "policyClosures",
      ]);
      const memberTraceLanguageIds = expectArray(
        entryRecord.memberTraceLanguageIds,
        [...entryPath, "memberTraceLanguageIds"],
      ).map((id, memberIndex) =>
        expectDigest(id, [...entryPath, "memberTraceLanguageIds", memberIndex]),
      );
      if (memberTraceLanguageIds.length !== memberSummaryIds.length) {
        fail(
          "invalid-field",
          [...entryPath, "memberTraceLanguageIds"],
          "Member trace-language positions do not match member summaries",
        );
      }
      return {
        inputClassId: expectDigest(entryRecord.inputClassId, [
          ...entryPath,
          "inputClassId",
        ]),
        memberTraceLanguageIds,
        resultTraceLanguageId: expectDigest(entryRecord.resultTraceLanguageId, [
          ...entryPath,
          "resultTraceLanguageId",
        ]),
        actualRelationLanguageId: expectDigest(
          entryRecord.actualRelationLanguageId,
          [...entryPath, "actualRelationLanguageId"],
        ),
        bindingIds: readCanonicalizedDigestSet(entryRecord.bindingIds, [
          ...entryPath,
          "bindingIds",
        ]),
        policyClosures: readCompositionPolicyClosures(
          entryRecord.policyClosures,
          [...entryPath, "policyClosures"],
        ),
      };
    },
  );
  const canonicalInputClasses = sortedCopy(inputClasses, (left, right) =>
    compareText(left.inputClassId, right.inputClassId),
  );
  compareCanonicalList(
    canonicalInputClasses,
    (left, right) => compareText(left.inputClassId, right.inputClassId),
    [...path, "inputClasses"],
  );
  const preimage: ObservationCompositionClaimPreimage = {
    schema: "dathra.observation-composition-claim/3",
    compositionId: expectDigest(record.compositionId, [
      ...path,
      "compositionId",
    ]),
    resultContractId: expectDigest(record.resultContractId, [
      ...path,
      "resultContractId",
    ]),
    memberSummaryIds,
    resultSummaryId: expectDigest(record.resultSummaryId, [
      ...path,
      "resultSummaryId",
    ]),
    inputClasses: canonicalInputClasses,
  };
  return await contentAddressed(preimage);
}

/** Creates a closed behavior claim for a canonical observation composition. */
async function createObservationCompositionClaim(
  input: ObservationCompositionClaimInput,
): Promise<ObservationCompositionClaim> {
  return await buildObservationCompositionClaim(
    snapshotClosed(input),
    [],
    false,
  );
}

async function parseObservationCompositionClaim(
  value: unknown,
): Promise<ObservationCompositionClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Composition claim digest does not match its preimage",
    );
  }
  const parsed = await buildObservationCompositionClaim(
    record.preimage,
    ["preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Composition claim preimage is not canonical",
    );
  }
  return parsed;
}

function readTraceSymbolInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationTraceSymbolInput {
  if (!isDataRecord(value))
    fail("invalid-field", path, "Expected a trace symbol record");
  const kind = expectOneOf(
    value.kind,
    ["event", "occurrence", "terminal"] as const,
    [...path, "kind"],
  );
  const idField = includesId ? ["id"] : [];
  if (kind === "event") {
    const record = expectRecord(value, path, [
      "kind",
      ...idField,
      "identityDomainDigest",
      "occurrenceOrdinal",
    ]);
    return {
      kind,
      identityDomainDigest: expectDigest(record.identityDomainDigest, [
        ...path,
        "identityDomainDigest",
      ]),
      occurrenceOrdinal: expectNonNegativeSafeInteger(
        record.occurrenceOrdinal,
        [...path, "occurrenceOrdinal"],
      ),
    };
  }
  if (kind === "occurrence") {
    const record = expectRecord(value, path, [
      "kind",
      ...idField,
      "constraintId",
      "occurrenceIdentityDomainDigest",
      "occurrenceOrdinal",
      "observationTokenRelationDigest",
      "inputEventSymbolIds",
    ]);
    const inputEventSymbolIds = expectArray(record.inputEventSymbolIds, [
      ...path,
      "inputEventSymbolIds",
    ]).map((id, index) =>
      expectDigest(id, [...path, "inputEventSymbolIds", index]),
    );
    const canonicalInputIds = sortedCopy(inputEventSymbolIds, compareText);
    compareCanonicalList(canonicalInputIds, compareText, [
      ...path,
      "inputEventSymbolIds",
    ]);
    return {
      kind,
      constraintId: expectDigest(record.constraintId, [
        ...path,
        "constraintId",
      ]),
      occurrenceIdentityDomainDigest: expectDigest(
        record.occurrenceIdentityDomainDigest,
        [...path, "occurrenceIdentityDomainDigest"],
      ),
      occurrenceOrdinal: expectNonNegativeSafeInteger(
        record.occurrenceOrdinal,
        [...path, "occurrenceOrdinal"],
      ),
      observationTokenRelationDigest: expectDigest(
        record.observationTokenRelationDigest,
        [...path, "observationTokenRelationDigest"],
      ),
      inputEventSymbolIds: canonicalInputIds,
    };
  }
  const record = expectRecord(value, path, [
    "kind",
    ...idField,
    "constraintId",
    "occurrenceOrdinal",
    "outcome",
  ]);
  return {
    kind,
    constraintId: expectDigest(record.constraintId, [...path, "constraintId"]),
    occurrenceOrdinal: expectNonNegativeSafeInteger(record.occurrenceOrdinal, [
      ...path,
      "occurrenceOrdinal",
    ]),
    outcome: expectOneOf(record.outcome, TERMINAL_OUTCOMES, [
      ...path,
      "outcome",
    ]),
  };
}

async function readTraceSymbol(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationTraceSymbol> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a trace symbol record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readTraceSymbolInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Trace symbol digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates a canonical observation trace symbol. */
async function createObservationTraceSymbol(
  input: ObservationTraceSymbolInput,
): Promise<ObservationTraceSymbol> {
  const preimage = readTraceSymbolInput(snapshotClosed(input), [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readRelationSymbolInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationRelationSymbolInput {
  const fields = includesId
    ? ["id", "sourceSymbolId", "candidateSymbolId", "ruleId"]
    : ["sourceSymbolId", "candidateSymbolId", "ruleId"];
  const record = expectRecord(value, path, fields);
  const sourceSymbolId = expectNullableDigest(record.sourceSymbolId, [
    ...path,
    "sourceSymbolId",
  ]);
  const candidateSymbolId = expectNullableDigest(record.candidateSymbolId, [
    ...path,
    "candidateSymbolId",
  ]);
  if (sourceSymbolId === null && candidateSymbolId === null) {
    fail(
      "invalid-field",
      path,
      "A relation symbol must advance at least one side",
    );
  }
  return {
    sourceSymbolId,
    candidateSymbolId,
    ruleId: expectNullableDigest(record.ruleId, [...path, "ruleId"]),
  };
}

async function readRelationSymbol(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationRelationSymbol> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a relation symbol record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readRelationSymbolInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Relation symbol digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates a canonical source-to-candidate relation symbol. */
async function createObservationRelationSymbol(
  input: ObservationRelationSymbolInput,
): Promise<ObservationRelationSymbol> {
  const preimage = readRelationSymbolInput(snapshotClosed(input), [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readCompositionRelationSymbolInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): ObservationCompositionRelationSymbolInput {
  const record = expectRecord(
    value,
    path,
    includesId
      ? ["id", "memberSymbolIds", "resultSymbolId", "bindingId"]
      : ["memberSymbolIds", "resultSymbolId", "bindingId"],
  );
  const memberSymbolIds = expectArray(record.memberSymbolIds, [
    ...path,
    "memberSymbolIds",
  ]).map((id, index) =>
    expectNullableDigest(id, [...path, "memberSymbolIds", index]),
  );
  const resultSymbolId = expectNullableDigest(record.resultSymbolId, [
    ...path,
    "resultSymbolId",
  ]);
  if (resultSymbolId === null && memberSymbolIds.every((id) => id === null)) {
    fail(
      "invalid-field",
      path,
      "A composition relation symbol must advance at least one tape",
    );
  }
  return {
    memberSymbolIds,
    resultSymbolId,
    bindingId: expectNullableDigest(record.bindingId, [...path, "bindingId"]),
  };
}

async function readCompositionRelationSymbol(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationCompositionRelationSymbol> {
  const record = isDataRecord(value)
    ? value
    : fail(
        "invalid-field",
        path,
        "Expected a composition relation symbol record",
      );
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readCompositionRelationSymbolInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Composition relation symbol digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates one canonical symbol in a multi-tape composition relation. */
async function createObservationCompositionRelationSymbol(
  input: ObservationCompositionRelationSymbolInput,
): Promise<ObservationCompositionRelationSymbol> {
  const preimage = readCompositionRelationSymbolInput(
    snapshotClosed(input),
    [],
    false,
  );
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readTemplateSymbolInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): RealizationTemplateStepSymbolInput {
  if (!isDataRecord(value))
    fail("invalid-field", path, "Expected a template symbol record");
  const kind = expectOneOf(
    value.kind,
    ["artifact-token", "parser-operation"] as const,
    [...path, "kind"],
  );
  const idField = includesId ? ["id"] : [];
  if (kind === "artifact-token") {
    const record = expectRecord(value, path, [
      "kind",
      ...idField,
      "artifactTokenClassId",
      "outputTokenRelationDigest",
    ]);
    return {
      kind,
      artifactTokenClassId: expectNonEmptyString(record.artifactTokenClassId, [
        ...path,
        "artifactTokenClassId",
      ]),
      outputTokenRelationDigest: expectDigest(
        record.outputTokenRelationDigest,
        [...path, "outputTokenRelationDigest"],
      ),
    };
  }
  const record = expectRecord(value, path, [
    "kind",
    ...idField,
    "parserOperationId",
    "inputSymbolIds",
    "outputTokenRelationDigest",
  ]);
  const inputSymbolIds = expectArray(record.inputSymbolIds, [
    ...path,
    "inputSymbolIds",
  ]).map((id, index) => expectDigest(id, [...path, "inputSymbolIds", index]));
  if (new Set(inputSymbolIds).size !== inputSymbolIds.length) {
    fail(
      "duplicate-record",
      [...path, "inputSymbolIds"],
      "Template input symbols must be unique",
    );
  }
  return {
    kind,
    parserOperationId: expectNonEmptyString(record.parserOperationId, [
      ...path,
      "parserOperationId",
    ]),
    inputSymbolIds,
    outputTokenRelationDigest: expectDigest(record.outputTokenRelationDigest, [
      ...path,
      "outputTokenRelationDigest",
    ]),
  };
}

async function readTemplateSymbol(
  value: unknown,
  path: ValidationPath,
): Promise<RealizationTemplateStepSymbol> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a template symbol record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readTemplateSymbolInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Template symbol digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates a canonical symbolic realization step. */
async function createRealizationTemplateStepSymbol(
  input: RealizationTemplateStepSymbolInput,
): Promise<RealizationTemplateStepSymbol> {
  const preimage = readTemplateSymbolInput(snapshotClosed(input), [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readRealizationObligationInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): RealizationObligationInput {
  const record = expectRecord(
    value,
    path,
    includesId
      ? [
          "id",
          "observationContractId",
          "constraintId",
          "observableIdentity",
          "expectedObservationTokenDigest",
        ]
      : [
          "observationContractId",
          "constraintId",
          "observableIdentity",
          "expectedObservationTokenDigest",
        ],
  );
  return {
    observationContractId: expectDigest(record.observationContractId, [
      ...path,
      "observationContractId",
    ]),
    constraintId: expectDigest(record.constraintId, [...path, "constraintId"]),
    observableIdentity: expectNonEmptyString(record.observableIdentity, [
      ...path,
      "observableIdentity",
    ]),
    expectedObservationTokenDigest: expectDigest(
      record.expectedObservationTokenDigest,
      [...path, "expectedObservationTokenDigest"],
    ),
  };
}

async function readRealizationObligation(
  value: unknown,
  path: ValidationPath,
): Promise<RealizationObligation> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a realization obligation record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readRealizationObligationInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Realization obligation digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates one atomic observable realization obligation. */
async function createRealizationObligation(
  input: RealizationObligationInput,
): Promise<RealizationObligation> {
  const preimage = readRealizationObligationInput(
    snapshotClosed(input),
    [],
    false,
  );
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

function readCanonicalizedStringSet(
  value: unknown,
  path: ValidationPath,
  requireNonEmpty: boolean,
): readonly string[] {
  const values = expectArray(value, path).map((entry, index) =>
    expectNonEmptyString(entry, [...path, index]),
  );
  const canonical = sortedCopy(values, compareText);
  compareCanonicalList(canonical, compareText, path);
  if (requireNonEmpty && canonical.length === 0) {
    fail("invalid-field", path, "Expected at least one value");
  }
  return canonical;
}

/** Creates the canonical parser and host profile used by realization proofs. */
async function createCanonicalParserProfile(
  input: CanonicalParserProfileInput,
): Promise<CanonicalParserProfile> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "targetHostProfileId",
      "version",
      "encoding",
      "contentTypeIds",
      "documentModes",
      "parserOperationIds",
      "sequenceProofDomainId",
      "baseUrlProofDomainId",
    ],
  );
  const documentModes = expectArray(record.documentModes, [
    "documentModes",
  ]).map((mode, index) =>
    expectOneOf(mode, DOCUMENT_MODES, ["documentModes", index]),
  );
  const canonicalDocumentModes = sortedCopy(documentModes, compareText);
  compareCanonicalList(canonicalDocumentModes, compareText, ["documentModes"]);
  if (canonicalDocumentModes.length === 0) {
    fail(
      "invalid-field",
      ["documentModes"],
      "Parser profile requires a document mode",
    );
  }
  const preimage: CanonicalParserProfilePreimage = {
    schema: "dathra.canonical-parser-profile/1",
    targetHostProfileId: expectHostProfileId(record.targetHostProfileId, [
      "targetHostProfileId",
    ]),
    version: expectNonEmptyString(record.version, ["version"]),
    encoding: expectLiteral(record.encoding, "utf-8", ["encoding"]),
    contentTypeIds: readCanonicalizedStringSet(
      record.contentTypeIds,
      ["contentTypeIds"],
      true,
    ),
    documentModes: canonicalDocumentModes,
    parserOperationIds: readCanonicalizedStringSet(
      record.parserOperationIds,
      ["parserOperationIds"],
      false,
    ),
    sequenceProofDomainId: expectDigest(record.sequenceProofDomainId, [
      "sequenceProofDomainId",
    ]),
    baseUrlProofDomainId: expectDigest(record.baseUrlProofDomainId, [
      "baseUrlProofDomainId",
    ]),
  };
  return await contentAddressed(preimage);
}

function expectCanonicalAbsoluteUrl(
  value: unknown,
  path: ValidationPath,
): string {
  const text = expectNonEmptyString(value, path);
  let parsed: URL;
  try {
    parsed = new URL(text);
  } catch {
    fail("invalid-field", path, "Expected an absolute URL");
  }
  if (parsed.href !== text) {
    fail("invalid-field", path, "URL is not in canonical serialized form");
  }
  return text;
}

/** Creates an exact canonical base URL proof claim. */
async function createCanonicalBaseUrlClaim(
  input: CanonicalBaseUrlClaimInput,
): Promise<CanonicalBaseUrlClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    ["parserProfileId", "canonicalBaseUrl", "proofDomainId"],
  );
  return await contentAddressed({
    schema: "dathra.canonical-base-url-claim/1",
    parserProfileId: expectDigest(record.parserProfileId, ["parserProfileId"]),
    canonicalBaseUrl: expectCanonicalAbsoluteUrl(record.canonicalBaseUrl, [
      "canonicalBaseUrl",
    ]),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

function readRealizationStepInput(
  value: unknown,
  path: ValidationPath,
  includesId: boolean,
): RealizationStepInput {
  if (!isDataRecord(value)) {
    fail("invalid-field", path, "Expected a realization step record");
  }
  const kind = expectOneOf(
    value.kind,
    ["artifact-token", "parser-operation"] as const,
    [...path, "kind"],
  );
  const idField = includesId ? ["id"] : [];
  if (kind === "artifact-token") {
    const record = expectRecord(value, path, [
      "kind",
      ...idField,
      "templateSymbolId",
      "artifactTokenClassId",
      "occurrenceIdentity",
      "artifactTokenId",
      "inputByteRangeDigest",
      "outputObservationTokenDigest",
    ]);
    return {
      kind,
      templateSymbolId: expectDigest(record.templateSymbolId, [
        ...path,
        "templateSymbolId",
      ]),
      artifactTokenClassId: expectNonEmptyString(record.artifactTokenClassId, [
        ...path,
        "artifactTokenClassId",
      ]),
      occurrenceIdentity: expectNonEmptyString(record.occurrenceIdentity, [
        ...path,
        "occurrenceIdentity",
      ]),
      artifactTokenId: expectNonEmptyString(record.artifactTokenId, [
        ...path,
        "artifactTokenId",
      ]),
      inputByteRangeDigest: expectDigest(record.inputByteRangeDigest, [
        ...path,
        "inputByteRangeDigest",
      ]),
      outputObservationTokenDigest: expectDigest(
        record.outputObservationTokenDigest,
        [...path, "outputObservationTokenDigest"],
      ),
    };
  }
  const record = expectRecord(value, path, [
    "kind",
    ...idField,
    "templateSymbolId",
    "occurrenceIdentity",
    "parserOperationId",
    "inputStepIds",
    "inputObservationTokenDigests",
    "outputObservationTokenDigest",
  ]);
  const inputStepIds = expectArray(record.inputStepIds, [
    ...path,
    "inputStepIds",
  ]).map((id, index) => expectDigest(id, [...path, "inputStepIds", index]));
  if (new Set(inputStepIds).size !== inputStepIds.length) {
    fail(
      "duplicate-record",
      [...path, "inputStepIds"],
      "Parser input steps must be unique",
    );
  }
  const inputObservationTokenDigests = expectArray(
    record.inputObservationTokenDigests,
    [...path, "inputObservationTokenDigests"],
  ).map((digest, index) =>
    expectDigest(digest, [...path, "inputObservationTokenDigests", index]),
  );
  if (inputStepIds.length !== inputObservationTokenDigests.length) {
    fail(
      "invalid-parser-operation",
      path,
      "Parser input step and token arrays have different lengths",
    );
  }
  return {
    kind,
    templateSymbolId: expectDigest(record.templateSymbolId, [
      ...path,
      "templateSymbolId",
    ]),
    occurrenceIdentity: expectNonEmptyString(record.occurrenceIdentity, [
      ...path,
      "occurrenceIdentity",
    ]),
    parserOperationId: expectNonEmptyString(record.parserOperationId, [
      ...path,
      "parserOperationId",
    ]),
    inputStepIds,
    inputObservationTokenDigests,
    outputObservationTokenDigest: expectDigest(
      record.outputObservationTokenDigest,
      [...path, "outputObservationTokenDigest"],
    ),
  };
}

async function readRealizationStep(
  value: unknown,
  path: ValidationPath,
): Promise<RealizationStep> {
  const record = isDataRecord(value)
    ? value
    : fail("invalid-field", path, "Expected a realization step record");
  const id = expectDigest(record.id, [...path, "id"]);
  const input = readRealizationStepInput(record, path, true);
  if (id !== (await digestCanonicalJson(input))) {
    fail(
      "digest-mismatch",
      [...path, "id"],
      "Realization step digest does not match its preimage",
    );
  }
  const result = { id, ...input };
  deepFreeze(result);
  return result;
}

/** Creates one concrete artifact-token or parser-operation step. */
async function createRealizationStep(
  input: RealizationStepInput,
): Promise<RealizationStep> {
  const preimage = readRealizationStepInput(snapshotClosed(input), [], false);
  const result = { id: await digestCanonicalJson(preimage), ...preimage };
  deepFreeze(result);
  return result;
}

/** Creates a symbolic realization template that owns its obligations. */
async function createRealizationWitnessTemplate(
  input: RealizationWitnessTemplateInput,
): Promise<RealizationWitnessTemplate> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "observationContractId",
      "behaviorSummaryId",
      "inputClassId",
      "parserProfileId",
      "obligations",
      "sequenceLanguageId",
      "proofDomainId",
    ],
  );
  const obligationValues = expectArray(record.obligations, ["obligations"]);
  const obligations: RealizationObligation[] = [];
  for (let index = 0; index < obligationValues.length; index += 1) {
    obligations.push(
      await readRealizationObligation(obligationValues[index], [
        "obligations",
        index,
      ]),
    );
  }
  const canonicalObligations = sortedCopy(obligations, (left, right) =>
    compareText(left.id, right.id),
  );
  compareCanonicalList(
    canonicalObligations,
    (left, right) => compareText(left.id, right.id),
    ["obligations"],
  );
  const observationContractId = expectDigest(record.observationContractId, [
    "observationContractId",
  ]);
  if (
    canonicalObligations.some(
      (obligation) =>
        obligation.observationContractId !== observationContractId,
    )
  ) {
    fail(
      "contract-mismatch",
      ["obligations"],
      "Template obligation references a different observation contract",
    );
  }
  return await contentAddressed({
    schema: "dathra.realization-witness-template/1",
    observationContractId,
    behaviorSummaryId: expectDigest(record.behaviorSummaryId, [
      "behaviorSummaryId",
    ]),
    inputClassId: expectDigest(record.inputClassId, ["inputClassId"]),
    parserProfileId: expectDigest(record.parserProfileId, ["parserProfileId"]),
    obligations: canonicalObligations,
    sequenceLanguageId: expectDigest(record.sequenceLanguageId, [
      "sequenceLanguageId",
    ]),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

/** Creates an exact input-class to witness-template coverage claim. */
async function createRealizationCoverageClaim(
  input: RealizationCoverageClaimInput,
): Promise<RealizationCoverageClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "observationContractId",
      "behaviorSummaryId",
      "inputPartitionId",
      "templates",
      "proofDomainId",
    ],
  );
  const templates = expectArray(record.templates, ["templates"]).map(
    (template, index) => {
      const templatePath = ["templates", index] as const;
      const templateRecord = expectRecord(template, templatePath, [
        "inputClassId",
        "witnessTemplateId",
      ]);
      return {
        inputClassId: expectDigest(templateRecord.inputClassId, [
          ...templatePath,
          "inputClassId",
        ]),
        witnessTemplateId: expectDigest(templateRecord.witnessTemplateId, [
          ...templatePath,
          "witnessTemplateId",
        ]),
      };
    },
  );
  const canonicalTemplates = sortedCopy(templates, (left, right) =>
    compareText(left.inputClassId, right.inputClassId),
  );
  compareCanonicalList(
    canonicalTemplates,
    (left, right) => compareText(left.inputClassId, right.inputClassId),
    ["templates"],
  );
  return await contentAddressed({
    schema: "dathra.realization-coverage-claim/2",
    observationContractId: expectDigest(record.observationContractId, [
      "observationContractId",
    ]),
    behaviorSummaryId: expectDigest(record.behaviorSummaryId, [
      "behaviorSummaryId",
    ]),
    inputPartitionId: expectDigest(record.inputPartitionId, [
      "inputPartitionId",
    ]),
    templates: canonicalTemplates,
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
  });
}

async function parseCanonicalParserProfile(
  value: unknown,
): Promise<CanonicalParserProfile> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Parser profile digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "targetHostProfileId",
      "version",
      "encoding",
      "contentTypeIds",
      "documentModes",
      "parserOperationIds",
      "sequenceProofDomainId",
      "baseUrlProofDomainId",
    ],
  );
  expectLiteral(preimage.schema, "dathra.canonical-parser-profile/1", [
    "preimage",
    "schema",
  ]);
  const parsed = await createCanonicalParserProfile({
    targetHostProfileId: expectHostProfileId(preimage.targetHostProfileId, [
      "preimage",
      "targetHostProfileId",
    ]),
    version: expectNonEmptyString(preimage.version, ["preimage", "version"]),
    encoding: expectLiteral(preimage.encoding, "utf-8", [
      "preimage",
      "encoding",
    ]),
    contentTypeIds: readCanonicalizedStringSet(
      preimage.contentTypeIds,
      ["preimage", "contentTypeIds"],
      true,
    ),
    documentModes: expectArray(preimage.documentModes, [
      "preimage",
      "documentModes",
    ]).map((mode, index) =>
      expectOneOf(mode, DOCUMENT_MODES, ["preimage", "documentModes", index]),
    ),
    parserOperationIds: readCanonicalizedStringSet(
      preimage.parserOperationIds,
      ["preimage", "parserOperationIds"],
      false,
    ),
    sequenceProofDomainId: expectDigest(preimage.sequenceProofDomainId, [
      "preimage",
      "sequenceProofDomainId",
    ]),
    baseUrlProofDomainId: expectDigest(preimage.baseUrlProofDomainId, [
      "preimage",
      "baseUrlProofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Parser profile preimage is not canonical",
    );
  }
  return parsed;
}

async function parseRealizationWitnessTemplate(
  value: unknown,
): Promise<RealizationWitnessTemplate> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Witness template digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "observationContractId",
      "behaviorSummaryId",
      "inputClassId",
      "parserProfileId",
      "obligations",
      "sequenceLanguageId",
      "proofDomainId",
    ],
  );
  expectLiteral(preimage.schema, "dathra.realization-witness-template/1", [
    "preimage",
    "schema",
  ]);
  const obligationValues = expectArray(preimage.obligations, [
    "preimage",
    "obligations",
  ]);
  const obligations: RealizationObligation[] = [];
  for (let index = 0; index < obligationValues.length; index += 1) {
    obligations.push(
      await readRealizationObligation(obligationValues[index], [
        "preimage",
        "obligations",
        index,
      ]),
    );
  }
  const parsed = await createRealizationWitnessTemplate({
    observationContractId: expectDigest(preimage.observationContractId, [
      "preimage",
      "observationContractId",
    ]),
    behaviorSummaryId: expectDigest(preimage.behaviorSummaryId, [
      "preimage",
      "behaviorSummaryId",
    ]),
    inputClassId: expectDigest(preimage.inputClassId, [
      "preimage",
      "inputClassId",
    ]),
    parserProfileId: expectDigest(preimage.parserProfileId, [
      "preimage",
      "parserProfileId",
    ]),
    obligations,
    sequenceLanguageId: expectDigest(preimage.sequenceLanguageId, [
      "preimage",
      "sequenceLanguageId",
    ]),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Witness template preimage is not canonical",
    );
  }
  return parsed;
}

async function parseRealizationCoverageClaim(
  value: unknown,
): Promise<RealizationCoverageClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Coverage claim digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "observationContractId",
      "behaviorSummaryId",
      "inputPartitionId",
      "templates",
      "proofDomainId",
    ],
  );
  expectLiteral(preimage.schema, "dathra.realization-coverage-claim/2", [
    "preimage",
    "schema",
  ]);
  const templates = expectArray(preimage.templates, [
    "preimage",
    "templates",
  ]).map((template, index) => {
    const path = ["preimage", "templates", index] as const;
    const templateRecord = expectRecord(template, path, [
      "inputClassId",
      "witnessTemplateId",
    ]);
    return {
      inputClassId: expectDigest(templateRecord.inputClassId, [
        ...path,
        "inputClassId",
      ]),
      witnessTemplateId: expectDigest(templateRecord.witnessTemplateId, [
        ...path,
        "witnessTemplateId",
      ]),
    };
  });
  const parsed = await createRealizationCoverageClaim({
    observationContractId: expectDigest(preimage.observationContractId, [
      "preimage",
      "observationContractId",
    ]),
    behaviorSummaryId: expectDigest(preimage.behaviorSummaryId, [
      "preimage",
      "behaviorSummaryId",
    ]),
    inputPartitionId: expectDigest(preimage.inputPartitionId, [
      "preimage",
      "inputPartitionId",
    ]),
    templates,
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Coverage claim preimage is not canonical",
    );
  }
  return parsed;
}

/** Validates exact input-class coverage and every template reference closure. */
async function validateRealizationCoverageClaim(
  input: RealizationCoverageValidationInput,
): Promise<AcceptedRealizationCoverage> {
  const budget = readBudget(input.budget);
  const claim = await parseRealizationCoverageClaim(input.claim);
  const behaviorAcceptance = await validateObservationBehaviorSummary(
    input.behavior,
  );
  const contract = await parseObservationContract(input.behavior.contract);
  const summary = await parseObservationBehaviorSummary(input.behavior.summary);
  const partition = await parseObservationInputPartition(
    snapshotClosed(input.behavior.inputPartition),
    ["behavior", "inputPartition"],
  );
  if (
    claim.preimage.observationContractId !== contract.id ||
    claim.preimage.behaviorSummaryId !== summary.id ||
    claim.preimage.inputPartitionId !== partition.id ||
    summary.preimage.inputPartitionId !== partition.id
  ) {
    fail(
      "contract-mismatch",
      ["claim"],
      "Coverage claim does not bind the accepted behavior and input partition",
    );
  }
  const expectedInputClassIds = partition.preimage.inputClasses.map(
    ({ id }) => id,
  );
  if (
    !canonicalEqual(
      claim.preimage.templates.map(({ inputClassId }) => inputClassId),
      expectedInputClassIds,
    )
  ) {
    fail(
      "language-mismatch",
      ["claim", "preimage", "templates"],
      "Coverage claim must assign exactly one template to every input class",
    );
  }
  const templateById = new Map<Sha256Digest, RealizationWitnessTemplate>();
  for (let index = 0; index < input.templates.length; index += 1) {
    const template = await parseRealizationWitnessTemplate(
      input.templates[index],
    );
    if (templateById.has(template.id)) {
      fail(
        "duplicate-record",
        ["templates", index],
        "Duplicate witness template",
      );
    }
    templateById.set(template.id, template);
  }
  const sequenceLanguageById = new Map<
    Sha256Digest,
    RealizationSequenceLanguage
  >();
  for (let index = 0; index < input.sequenceLanguages.length; index += 1) {
    const language = await parseRealizationSequenceLanguage(
      input.sequenceLanguages[index],
      budget,
    );
    if (sequenceLanguageById.has(language.id)) {
      fail(
        "duplicate-record",
        ["sequenceLanguages", index],
        "Duplicate sequence language",
      );
    }
    sequenceLanguageById.set(language.id, language);
  }
  const parserProfileById = new Map<Sha256Digest, CanonicalParserProfile>();
  for (let index = 0; index < input.parserProfiles.length; index += 1) {
    const profile = await parseCanonicalParserProfile(
      input.parserProfiles[index],
    );
    if (parserProfileById.has(profile.id)) {
      fail(
        "duplicate-record",
        ["parserProfiles", index],
        "Duplicate parser profile",
      );
    }
    parserProfileById.set(profile.id, profile);
  }
  const constraintIds = new Set(
    contract.preimage.constraints.map(({ id }) => id),
  );
  const witnessTemplateIds: Sha256Digest[] = [];
  const referencedSequenceLanguageIds = new Set<Sha256Digest>();
  const referencedParserProfileIds = new Set<Sha256Digest>();
  for (let index = 0; index < claim.preimage.templates.length; index += 1) {
    const assignment = claim.preimage.templates[index];
    const template = templateById.get(assignment.witnessTemplateId);
    if (template === undefined) {
      fail(
        "dangling-reference",
        ["claim", "preimage", "templates", index, "witnessTemplateId"],
        "Coverage assignment references an unavailable witness template",
      );
    }
    const sequenceLanguage = sequenceLanguageById.get(
      template.preimage.sequenceLanguageId,
    );
    const parserProfile = parserProfileById.get(
      template.preimage.parserProfileId,
    );
    if (
      template.preimage.observationContractId !== contract.id ||
      template.preimage.behaviorSummaryId !== summary.id ||
      template.preimage.inputClassId !== assignment.inputClassId ||
      template.preimage.proofDomainId !== claim.preimage.proofDomainId ||
      sequenceLanguage === undefined ||
      parserProfile === undefined
    ) {
      fail(
        "contract-mismatch",
        ["templates", template.id],
        "Witness template does not close over its contract, behavior, class, language, and profile",
      );
    }
    referencedSequenceLanguageIds.add(sequenceLanguage.id);
    referencedParserProfileIds.add(parserProfile.id);
    const observableIdentities = new Set<string>();
    for (
      let obligationIndex = 0;
      obligationIndex < template.preimage.obligations.length;
      obligationIndex += 1
    ) {
      const obligation = template.preimage.obligations[obligationIndex];
      if (
        obligation.observationContractId !== contract.id ||
        !constraintIds.has(obligation.constraintId) ||
        observableIdentities.has(obligation.observableIdentity)
      ) {
        fail(
          "unproven-obligation",
          ["templates", template.id, "obligations", obligationIndex],
          "Template obligation is duplicated or outside the observation contract",
        );
      }
      observableIdentities.add(obligation.observableIdentity);
    }
    const sequenceSymbolIds = new Set(
      sequenceLanguage.preimage.alphabet.map(({ id }) => id),
    );
    for (const symbol of sequenceLanguage.preimage.alphabet) {
      if (
        symbol.kind === "parser-operation" &&
        (!parserProfile.preimage.parserOperationIds.includes(
          symbol.parserOperationId,
        ) ||
          symbol.inputSymbolIds.some(
            (symbolId) => !sequenceSymbolIds.has(symbolId),
          ))
      ) {
        fail(
          "invalid-parser-operation",
          ["sequenceLanguages", sequenceLanguage.id, "alphabet", symbol.id],
          "Sequence symbol is not closed over the parser profile and alphabet",
        );
      }
    }
    witnessTemplateIds.push(template.id);
  }
  if (
    templateById.size !== witnessTemplateIds.length ||
    sequenceLanguageById.size !== referencedSequenceLanguageIds.size ||
    parserProfileById.size !== referencedParserProfileIds.size
  ) {
    fail(
      "duplicate-record",
      ["templates"],
      "Coverage validation closure contains unreferenced records",
    );
  }
  const parsedAcceptances = await parseTrustedProofAcceptances(input);
  const coverageAcceptance = requireParsedTrustedProofAcceptance(
    parsedAcceptances,
    new Set(input.trustedProofAcceptanceIds),
    claim.preimage.proofDomainId,
    claim.id,
    ["proofAcceptances", "coverageClaim"],
  );
  return await contentAddressed({
    schema: "dathra.accepted-realization-coverage/1",
    coverageClaimId: claim.id,
    behaviorAcceptanceId: behaviorAcceptance.id,
    inputPartitionId: partition.id,
    witnessTemplateIds,
    coverageAcceptanceId: coverageAcceptance.id,
  });
}

function readCanonicalizedDigestSet(
  value: unknown,
  path: ValidationPath,
): readonly Sha256Digest[] {
  const values = expectArray(value, path).map((entry, index) =>
    expectDigest(entry, [...path, index]),
  );
  const canonical = sortedCopy(values, compareText);
  compareCanonicalList(canonical, compareText, path);
  return canonical;
}

function realizationStepOutputDigest(step: RealizationStep): Sha256Digest {
  return step.outputObservationTokenDigest;
}

/** Creates and internally validates one concrete realization sequence claim. */
async function createRealizationSequenceClaim(
  input: RealizationSequenceClaimInput,
): Promise<RealizationSequenceClaim> {
  const record = expectRecord(
    snapshotClosed(input),
    [],
    [
      "witnessTemplateId",
      "observationContractId",
      "behaviorSummaryId",
      "inputClassId",
      "realizationInputDigest",
      "parserProfileId",
      "proofDomainId",
      "obligationIds",
      "steps",
      "parserSequence",
      "obligationOutputs",
    ],
  );
  const stepValues = expectArray(record.steps, ["steps"]);
  const steps: RealizationStep[] = [];
  for (let index = 0; index < stepValues.length; index += 1) {
    steps.push(await readRealizationStep(stepValues[index], ["steps", index]));
  }
  const canonicalSteps = sortedCopy(steps, (left, right) =>
    compareText(left.id, right.id),
  );
  compareCanonicalList(
    canonicalSteps,
    (left, right) => compareText(left.id, right.id),
    ["steps"],
  );
  const stepById = new Map(canonicalSteps.map((step) => [step.id, step]));
  const parserSequence = expectArray(record.parserSequence, [
    "parserSequence",
  ]).map((id, index) => expectDigest(id, ["parserSequence", index]));
  if (
    parserSequence.length !== canonicalSteps.length ||
    new Set(parserSequence).size !== parserSequence.length ||
    canonicalSteps.some((step) => !parserSequence.includes(step.id))
  ) {
    fail(
      "invalid-parser-operation",
      ["parserSequence"],
      "Parser sequence must be an exact permutation of concrete steps",
    );
  }
  const positionByStepId = new Map(
    parserSequence.map((id, index) => [id, index]),
  );
  for (const step of canonicalSteps) {
    if (step.kind !== "parser-operation") continue;
    for (let index = 0; index < step.inputStepIds.length; index += 1) {
      const inputStepId = step.inputStepIds[index];
      const inputStep = stepById.get(inputStepId);
      if (inputStep === undefined) {
        fail(
          "dangling-reference",
          ["steps", step.id, "inputStepIds", index],
          "Parser operation references an unknown input step",
        );
      }
      if (
        (positionByStepId.get(inputStepId) ?? Number.MAX_SAFE_INTEGER) >=
        (positionByStepId.get(step.id) ?? -1)
      ) {
        fail(
          "invalid-parser-operation",
          ["steps", step.id, "inputStepIds", index],
          "Parser input does not precede the consuming operation",
        );
      }
      if (
        realizationStepOutputDigest(inputStep) !==
        step.inputObservationTokenDigests[index]
      ) {
        fail(
          "invalid-parser-operation",
          ["steps", step.id, "inputObservationTokenDigests", index],
          "Parser input token does not match its input step output",
        );
      }
    }
  }
  const obligationIds = readCanonicalizedDigestSet(record.obligationIds, [
    "obligationIds",
  ]);
  const obligationOutputs = expectArray(record.obligationOutputs, [
    "obligationOutputs",
  ]).map((output, index) => {
    const outputPath = ["obligationOutputs", index] as const;
    const outputRecord = expectRecord(output, outputPath, [
      "obligationId",
      "outputStepId",
    ]);
    return {
      obligationId: expectDigest(outputRecord.obligationId, [
        ...outputPath,
        "obligationId",
      ]),
      outputStepId: expectDigest(outputRecord.outputStepId, [
        ...outputPath,
        "outputStepId",
      ]),
    };
  });
  const canonicalOutputs = sortedCopy(obligationOutputs, (left, right) =>
    compareText(left.obligationId, right.obligationId),
  );
  compareCanonicalList(
    canonicalOutputs,
    (left, right) => compareText(left.obligationId, right.obligationId),
    ["obligationOutputs"],
  );
  for (let index = 0; index < canonicalOutputs.length; index += 1) {
    const output = canonicalOutputs[index];
    if (!obligationIds.includes(output.obligationId)) {
      fail(
        "unproven-obligation",
        ["obligationOutputs", index, "obligationId"],
        "Output references an obligation outside the sequence claim",
      );
    }
    if (!stepById.has(output.outputStepId)) {
      fail(
        "dangling-reference",
        ["obligationOutputs", index, "outputStepId"],
        "Obligation output references an unknown step",
      );
    }
  }
  const preimage: RealizationSequenceClaimPreimage = {
    schema: "dathra.realization-sequence-claim/2",
    witnessTemplateId: expectDigest(record.witnessTemplateId, [
      "witnessTemplateId",
    ]),
    observationContractId: expectDigest(record.observationContractId, [
      "observationContractId",
    ]),
    behaviorSummaryId: expectDigest(record.behaviorSummaryId, [
      "behaviorSummaryId",
    ]),
    inputClassId: expectDigest(record.inputClassId, ["inputClassId"]),
    realizationInputDigest: expectDigest(record.realizationInputDigest, [
      "realizationInputDigest",
    ]),
    parserProfileId: expectDigest(record.parserProfileId, ["parserProfileId"]),
    proofDomainId: expectDigest(record.proofDomainId, ["proofDomainId"]),
    obligationIds,
    steps: canonicalSteps,
    parserSequence,
    obligationOutputs: canonicalOutputs,
  };
  return await contentAddressed(preimage);
}

async function parseRealizationSequenceClaim(
  value: unknown,
): Promise<RealizationSequenceClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Sequence claim digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    [
      "schema",
      "witnessTemplateId",
      "observationContractId",
      "behaviorSummaryId",
      "inputClassId",
      "realizationInputDigest",
      "parserProfileId",
      "proofDomainId",
      "obligationIds",
      "steps",
      "parserSequence",
      "obligationOutputs",
    ],
  );
  expectLiteral(preimage.schema, "dathra.realization-sequence-claim/2", [
    "preimage",
    "schema",
  ]);
  const stepValues = expectArray(preimage.steps, ["preimage", "steps"]);
  const steps: RealizationStep[] = [];
  for (let index = 0; index < stepValues.length; index += 1) {
    steps.push(
      await readRealizationStep(stepValues[index], [
        "preimage",
        "steps",
        index,
      ]),
    );
  }
  const obligationOutputs = expectArray(preimage.obligationOutputs, [
    "preimage",
    "obligationOutputs",
  ]).map((output, index) => {
    const path = ["preimage", "obligationOutputs", index] as const;
    const outputRecord = expectRecord(output, path, [
      "obligationId",
      "outputStepId",
    ]);
    return {
      obligationId: expectDigest(outputRecord.obligationId, [
        ...path,
        "obligationId",
      ]),
      outputStepId: expectDigest(outputRecord.outputStepId, [
        ...path,
        "outputStepId",
      ]),
    };
  });
  const parsed = await createRealizationSequenceClaim({
    witnessTemplateId: expectDigest(preimage.witnessTemplateId, [
      "preimage",
      "witnessTemplateId",
    ]),
    observationContractId: expectDigest(preimage.observationContractId, [
      "preimage",
      "observationContractId",
    ]),
    behaviorSummaryId: expectDigest(preimage.behaviorSummaryId, [
      "preimage",
      "behaviorSummaryId",
    ]),
    inputClassId: expectDigest(preimage.inputClassId, [
      "preimage",
      "inputClassId",
    ]),
    realizationInputDigest: expectDigest(preimage.realizationInputDigest, [
      "preimage",
      "realizationInputDigest",
    ]),
    parserProfileId: expectDigest(preimage.parserProfileId, [
      "preimage",
      "parserProfileId",
    ]),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
    obligationIds: expectCanonicalDigestList(preimage.obligationIds, [
      "preimage",
      "obligationIds",
    ]),
    steps,
    parserSequence: expectArray(preimage.parserSequence, [
      "preimage",
      "parserSequence",
    ]).map((stepId, index) =>
      expectDigest(stepId, ["preimage", "parserSequence", index]),
    ),
    obligationOutputs,
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Sequence claim preimage is not canonical",
    );
  }
  return parsed;
}

async function parseCanonicalBaseUrlClaim(
  value: unknown,
): Promise<CanonicalBaseUrlClaim> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Base URL claim digest does not match its preimage",
    );
  }
  const preimage = expectRecord(
    record.preimage,
    ["preimage"],
    ["schema", "parserProfileId", "canonicalBaseUrl", "proofDomainId"],
  );
  expectLiteral(preimage.schema, "dathra.canonical-base-url-claim/1", [
    "preimage",
    "schema",
  ]);
  const parsed = await createCanonicalBaseUrlClaim({
    parserProfileId: expectDigest(preimage.parserProfileId, [
      "preimage",
      "parserProfileId",
    ]),
    canonicalBaseUrl: expectCanonicalAbsoluteUrl(preimage.canonicalBaseUrl, [
      "preimage",
      "canonicalBaseUrl",
    ]),
    proofDomainId: expectDigest(preimage.proofDomainId, [
      "preimage",
      "proofDomainId",
    ]),
  });
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Base URL claim preimage is not canonical",
    );
  }
  return parsed;
}

async function buildRealizationWitness(
  value: unknown,
  path: ValidationPath,
  includesSchema: boolean,
): Promise<RealizationWitness> {
  const fields = [
    "renderInstanceId",
    "observationContractId",
    "behaviorSummaryId",
    "acceptedObservationRelationId",
    "inputClassId",
    "realizationInputDigest",
    "acceptedCoverageId",
    "coverageClaimId",
    "coverageAcceptanceId",
    "witnessTemplateId",
    "realizationSequenceClaimId",
    "sequenceAcceptanceId",
    "targetHostProfileId",
    "encoding",
    "contentTypeId",
    "documentMode",
    "canonicalBaseUrl",
    "baseUrlClaimId",
    "baseUrlAcceptanceId",
    "policyEpoch",
    "customElementRegistryIdentity",
    "parserProfileId",
    "upgradeEffectIds",
    "adoptEffectIds",
  ];
  const record = expectRecord(
    value,
    path,
    includesSchema ? ["schema", ...fields] : fields,
  );
  if (includesSchema) {
    expectLiteral(record.schema, "dathra.realization-witness/3", [
      ...path,
      "schema",
    ]);
  }
  const upgradeEffectValues = expectArray(record.upgradeEffectIds, [
    ...path,
    "upgradeEffectIds",
  ]).map((id, index) =>
    expectNonEmptyString(id, [...path, "upgradeEffectIds", index]),
  );
  const adoptEffectValues = expectArray(record.adoptEffectIds, [
    ...path,
    "adoptEffectIds",
  ]).map((id, index) =>
    expectNonEmptyString(id, [...path, "adoptEffectIds", index]),
  );
  const upgradeEffectIds = sortedCopy(upgradeEffectValues, compareText);
  const adoptEffectIds = sortedCopy(adoptEffectValues, compareText);
  compareCanonicalList(upgradeEffectIds, compareText, [
    ...path,
    "upgradeEffectIds",
  ]);
  compareCanonicalList(adoptEffectIds, compareText, [
    ...path,
    "adoptEffectIds",
  ]);
  if (
    includesSchema &&
    (upgradeEffectValues.some((id, index) => id !== upgradeEffectIds[index]) ||
      adoptEffectValues.some((id, index) => id !== adoptEffectIds[index]))
  ) {
    fail(
      "noncanonical-order",
      path,
      "Witness effect IDs are not canonically ordered",
    );
  }
  if (upgradeEffectIds.some((id) => adoptEffectIds.includes(id))) {
    fail(
      "duplicate-record",
      [...path, "adoptEffectIds"],
      "An author effect cannot be both an upgrade and adopt effect",
    );
  }
  const preimage: RealizationWitnessPreimage = {
    schema: "dathra.realization-witness/3",
    renderInstanceId: expectNonEmptyString(record.renderInstanceId, [
      ...path,
      "renderInstanceId",
    ]),
    observationContractId: expectDigest(record.observationContractId, [
      ...path,
      "observationContractId",
    ]),
    behaviorSummaryId: expectDigest(record.behaviorSummaryId, [
      ...path,
      "behaviorSummaryId",
    ]),
    acceptedObservationRelationId: expectDigest(
      record.acceptedObservationRelationId,
      [...path, "acceptedObservationRelationId"],
    ),
    inputClassId: expectDigest(record.inputClassId, [...path, "inputClassId"]),
    realizationInputDigest: expectDigest(record.realizationInputDigest, [
      ...path,
      "realizationInputDigest",
    ]),
    acceptedCoverageId: expectDigest(record.acceptedCoverageId, [
      ...path,
      "acceptedCoverageId",
    ]),
    coverageClaimId: expectDigest(record.coverageClaimId, [
      ...path,
      "coverageClaimId",
    ]),
    coverageAcceptanceId: expectDigest(record.coverageAcceptanceId, [
      ...path,
      "coverageAcceptanceId",
    ]),
    witnessTemplateId: expectDigest(record.witnessTemplateId, [
      ...path,
      "witnessTemplateId",
    ]),
    realizationSequenceClaimId: expectDigest(
      record.realizationSequenceClaimId,
      [...path, "realizationSequenceClaimId"],
    ),
    sequenceAcceptanceId: expectDigest(record.sequenceAcceptanceId, [
      ...path,
      "sequenceAcceptanceId",
    ]),
    targetHostProfileId: expectHostProfileId(record.targetHostProfileId, [
      ...path,
      "targetHostProfileId",
    ]),
    encoding: expectLiteral(record.encoding, "utf-8", [...path, "encoding"]),
    contentTypeId: expectNonEmptyString(record.contentTypeId, [
      ...path,
      "contentTypeId",
    ]),
    documentMode: expectOneOf(record.documentMode, DOCUMENT_MODES, [
      ...path,
      "documentMode",
    ]),
    canonicalBaseUrl: expectCanonicalAbsoluteUrl(record.canonicalBaseUrl, [
      ...path,
      "canonicalBaseUrl",
    ]),
    baseUrlClaimId: expectDigest(record.baseUrlClaimId, [
      ...path,
      "baseUrlClaimId",
    ]),
    baseUrlAcceptanceId: expectDigest(record.baseUrlAcceptanceId, [
      ...path,
      "baseUrlAcceptanceId",
    ]),
    policyEpoch: expectNonEmptyString(record.policyEpoch, [
      ...path,
      "policyEpoch",
    ]),
    customElementRegistryIdentity: expectNonEmptyString(
      record.customElementRegistryIdentity,
      [...path, "customElementRegistryIdentity"],
    ),
    parserProfileId: expectDigest(record.parserProfileId, [
      ...path,
      "parserProfileId",
    ]),
    upgradeEffectIds,
    adoptEffectIds,
  };
  return await contentAddressed(preimage);
}

/** Creates a concrete render-instance realization witness. */
async function createRealizationWitness(
  input: RealizationWitnessInput,
): Promise<RealizationWitness> {
  return await buildRealizationWitness(snapshotClosed(input), [], false);
}

/** Parses and verifies a canonical concrete realization witness. */
async function parseRealizationWitness(
  value: unknown,
): Promise<RealizationWitness> {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Realization witness digest does not match its preimage",
    );
  }
  const parsed = await buildRealizationWitness(
    record.preimage,
    ["preimage"],
    true,
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "digest-mismatch",
      ["preimage"],
      "Realization witness preimage is not canonical",
    );
  }
  return parsed;
}

function readBudget(value: unknown): ObservationAutomatonBudget {
  const snapshot = snapshotClosed(value);
  const record = expectRecord(
    snapshot,
    ["budget"],
    [
      "maximumAlphabetSize",
      "maximumStateCount",
      "maximumTransitionCount",
      "maximumDeterminizedStateCount",
      "maximumProductStateCount",
    ],
  );
  return {
    maximumAlphabetSize: expectPositiveSafeInteger(record.maximumAlphabetSize, [
      "budget",
      "maximumAlphabetSize",
    ]),
    maximumStateCount: expectPositiveSafeInteger(record.maximumStateCount, [
      "budget",
      "maximumStateCount",
    ]),
    maximumTransitionCount: expectPositiveSafeInteger(
      record.maximumTransitionCount,
      ["budget", "maximumTransitionCount"],
    ),
    maximumDeterminizedStateCount: expectPositiveSafeInteger(
      record.maximumDeterminizedStateCount,
      ["budget", "maximumDeterminizedStateCount"],
    ),
    maximumProductStateCount: expectPositiveSafeInteger(
      record.maximumProductStateCount,
      ["budget", "maximumProductStateCount"],
    ),
  };
}

function checkBudget(
  limitName: keyof ObservationAutomatonBudget,
  limit: number,
  observed: number,
): void {
  if (observed > limit) {
    fail(
      "budget-exceeded",
      ["budget", limitName],
      `${limitName} is ${limit}, observed ${observed}`,
    );
  }
}

interface NormalizedAutomaton<Symbol> {
  readonly alphabet: readonly Symbol[];
  readonly stateCount: number;
  readonly initialState: 0;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

async function readAutomatonInput<Symbol extends { readonly id: Sha256Digest }>(
  value: unknown,
  path: ValidationPath,
  schema: string | null,
  readSymbol: (value: unknown, path: ValidationPath) => Promise<Symbol>,
): Promise<AutomatonInput<Symbol>> {
  const fields =
    schema === null
      ? [
          "alphabet",
          "stateCount",
          "initialState",
          "acceptingStates",
          "transitions",
        ]
      : [
          "schema",
          "alphabet",
          "stateCount",
          "initialState",
          "acceptingStates",
          "transitions",
        ];
  const record = expectRecord(value, path, fields);
  if (schema !== null)
    expectLiteral(record.schema, schema, [...path, "schema"]);
  const alphabetValues = expectArray(record.alphabet, [...path, "alphabet"]);
  const alphabet: Symbol[] = [];
  for (let index = 0; index < alphabetValues.length; index += 1) {
    alphabet.push(
      await readSymbol(alphabetValues[index], [...path, "alphabet", index]),
    );
  }
  const acceptingStates = expectArray(record.acceptingStates, [
    ...path,
    "acceptingStates",
  ]).map((state, index) =>
    expectNonNegativeSafeInteger(state, [...path, "acceptingStates", index]),
  );
  const transitions = expectArray(record.transitions, [
    ...path,
    "transitions",
  ]).map((transition, index): ObservationAutomatonTransition => {
    const transitionPath = [...path, "transitions", index];
    const transitionRecord = expectRecord(transition, transitionPath, [
      "fromState",
      "symbolId",
      "toState",
    ]);
    return {
      fromState: expectNonNegativeSafeInteger(transitionRecord.fromState, [
        ...transitionPath,
        "fromState",
      ]),
      symbolId: expectDigest(transitionRecord.symbolId, [
        ...transitionPath,
        "symbolId",
      ]),
      toState: expectNonNegativeSafeInteger(transitionRecord.toState, [
        ...transitionPath,
        "toState",
      ]),
    };
  });
  return {
    alphabet,
    stateCount: expectPositiveSafeInteger(record.stateCount, [
      ...path,
      "stateCount",
    ]),
    initialState: expectNonNegativeSafeInteger(record.initialState, [
      ...path,
      "initialState",
    ]),
    acceptingStates,
    transitions,
  };
}

function normalizeAutomaton<Symbol extends { readonly id: Sha256Digest }>(
  input: AutomatonInput<Symbol>,
  budget: ObservationAutomatonBudget,
): NormalizedAutomaton<Symbol> {
  checkBudget(
    "maximumAlphabetSize",
    budget.maximumAlphabetSize,
    input.alphabet.length,
  );
  checkBudget("maximumStateCount", budget.maximumStateCount, input.stateCount);
  checkBudget(
    "maximumTransitionCount",
    budget.maximumTransitionCount,
    input.transitions.length,
  );
  if (input.initialState >= input.stateCount) {
    fail(
      "invalid-automaton",
      ["initialState"],
      "Initial state is outside the automaton",
    );
  }

  const alphabet = sortedCopy(input.alphabet, (left, right) =>
    compareText(left.id, right.id),
  );
  compareCanonicalList(
    alphabet,
    (left, right) => compareText(left.id, right.id),
    ["alphabet"],
  );
  const symbolById = new Map(alphabet.map((symbol) => [symbol.id, symbol]));

  const acceptingStates = sortedCopy(
    input.acceptingStates,
    (left, right) => left - right,
  );
  compareCanonicalList(acceptingStates, (left, right) => left - right, [
    "acceptingStates",
  ]);
  const accepting = new Set<number>();
  for (let index = 0; index < acceptingStates.length; index += 1) {
    const state = acceptingStates[index];
    if (state >= input.stateCount) {
      fail(
        "invalid-automaton",
        ["acceptingStates", index],
        "Accepting state is outside the automaton",
      );
    }
    accepting.add(state);
  }

  const outgoing = new Map<number, Map<Sha256Digest, number>>();
  const reverse = new Map<number, number[]>();
  for (let state = 0; state < input.stateCount; state += 1) {
    outgoing.set(state, new Map());
    reverse.set(state, []);
  }
  for (let index = 0; index < input.transitions.length; index += 1) {
    const transition = input.transitions[index];
    if (
      transition.fromState >= input.stateCount ||
      transition.toState >= input.stateCount
    ) {
      fail(
        "invalid-automaton",
        ["transitions", index],
        "Transition state is outside the automaton",
      );
    }
    if (!symbolById.has(transition.symbolId)) {
      fail(
        "dangling-reference",
        ["transitions", index, "symbolId"],
        "Transition references an unknown alphabet symbol",
      );
    }
    const stateOutgoing = outgoing.get(transition.fromState);
    if (stateOutgoing === undefined) {
      fail(
        "invalid-automaton",
        ["transitions", index],
        "Missing transition source state",
      );
    }
    if (stateOutgoing.has(transition.symbolId)) {
      fail(
        "invalid-automaton",
        ["transitions", index],
        "Automaton is not deterministic",
      );
    }
    stateOutgoing.set(transition.symbolId, transition.toState);
    reverse.get(transition.toState)?.push(transition.fromState);
  }

  const reachable = new Set<number>([input.initialState]);
  const reachableQueue = [input.initialState];
  for (let cursor = 0; cursor < reachableQueue.length; cursor += 1) {
    const state = reachableQueue[cursor];
    for (const target of outgoing.get(state)?.values() ?? []) {
      if (!reachable.has(target)) {
        reachable.add(target);
        reachableQueue.push(target);
      }
    }
  }

  const coreachable = new Set<number>(accepting);
  const coreachableQueue = [...accepting];
  for (let cursor = 0; cursor < coreachableQueue.length; cursor += 1) {
    const state = coreachableQueue[cursor];
    for (const source of reverse.get(state) ?? []) {
      if (!coreachable.has(source)) {
        coreachable.add(source);
        coreachableQueue.push(source);
      }
    }
  }

  const productive = new Set<number>();
  for (const state of reachable) {
    if (coreachable.has(state)) productive.add(state);
  }
  const visiting = new Set<number>();
  const visited = new Set<number>();
  const visitProductive = (state: number): void => {
    if (visiting.has(state)) {
      fail(
        "invalid-automaton",
        ["transitions"],
        "Accepted paths contain a productive cycle",
      );
    }
    if (visited.has(state)) return;
    visiting.add(state);
    for (const target of outgoing.get(state)?.values() ?? []) {
      if (productive.has(target)) visitProductive(target);
    }
    visiting.delete(state);
    visited.add(state);
  };
  if (productive.has(input.initialState)) visitProductive(input.initialState);

  if (!coreachable.has(input.initialState)) {
    return {
      alphabet: [],
      stateCount: 1,
      initialState: 0,
      acceptingStates: [],
      transitions: [],
    };
  }

  const activeSymbolIds = new Set<Sha256Digest>();
  for (const source of productive) {
    for (const [symbolId, target] of outgoing.get(source) ?? []) {
      if (productive.has(target)) activeSymbolIds.add(symbolId);
    }
  }
  const activeAlphabet = alphabet.filter(({ id }) => activeSymbolIds.has(id));

  const productiveOrder = [input.initialState];
  const productiveIndex = new Map<number, number>([[input.initialState, 0]]);
  for (let cursor = 0; cursor < productiveOrder.length; cursor += 1) {
    const state = productiveOrder[cursor];
    for (const symbol of activeAlphabet) {
      const target = outgoing.get(state)?.get(symbol.id);
      if (
        target !== undefined &&
        productive.has(target) &&
        !productiveIndex.has(target)
      ) {
        productiveIndex.set(target, productiveOrder.length);
        productiveOrder.push(target);
      }
    }
  }

  const completeTransitions: number[][] = productiveOrder.map(() => []);
  let needsSink = false;
  for (
    let stateIndex = 0;
    stateIndex < productiveOrder.length;
    stateIndex += 1
  ) {
    const originalState = productiveOrder[stateIndex];
    for (const symbol of activeAlphabet) {
      const originalTarget = outgoing.get(originalState)?.get(symbol.id);
      const target =
        originalTarget === undefined
          ? undefined
          : productiveIndex.get(originalTarget);
      if (target === undefined) {
        completeTransitions[stateIndex].push(-1);
        needsSink = true;
      } else {
        completeTransitions[stateIndex].push(target);
      }
    }
  }
  if (needsSink) {
    const sink = completeTransitions.length;
    for (const transitions of completeTransitions) {
      for (let index = 0; index < transitions.length; index += 1) {
        if (transitions[index] === -1) transitions[index] = sink;
      }
    }
    completeTransitions.push(activeAlphabet.map(() => sink));
  }

  checkBudget(
    "maximumStateCount",
    budget.maximumStateCount,
    completeTransitions.length,
  );
  checkBudget(
    "maximumTransitionCount",
    budget.maximumTransitionCount,
    completeTransitions.length * activeAlphabet.length,
  );

  const productiveAccepting = new Set<number>();
  for (let index = 0; index < productiveOrder.length; index += 1) {
    if (accepting.has(productiveOrder[index])) productiveAccepting.add(index);
  }

  let partitions: number[] = completeTransitions.map((_, state) =>
    productiveAccepting.has(state) ? 1 : 0,
  );
  for (;;) {
    const signatures = new Map<string, number>();
    const nextPartitions: number[] = [];
    for (let state = 0; state < completeTransitions.length; state += 1) {
      const signature = `${productiveAccepting.has(state) ? "1" : "0"}|${completeTransitions[
        state
      ]
        .map((target) => partitions[target])
        .join(",")}`;
      let partition = signatures.get(signature);
      if (partition === undefined) {
        partition = signatures.size;
        signatures.set(signature, partition);
      }
      nextPartitions.push(partition);
    }
    if (
      nextPartitions.every(
        (partition, state) => partition === partitions[state],
      )
    ) {
      partitions = nextPartitions;
      break;
    }
    partitions = nextPartitions;
  }

  const representativeByPartition = new Map<number, number>();
  for (let state = 0; state < partitions.length; state += 1) {
    if (!representativeByPartition.has(partitions[state])) {
      representativeByPartition.set(partitions[state], state);
    }
  }
  const initialPartition = partitions[0];
  const canonicalPartitions = [initialPartition];
  const canonicalStateByPartition = new Map<number, number>([
    [initialPartition, 0],
  ]);
  for (let cursor = 0; cursor < canonicalPartitions.length; cursor += 1) {
    const partition = canonicalPartitions[cursor];
    const representative = representativeByPartition.get(partition);
    if (representative === undefined) {
      fail("invalid-automaton", [], "Missing minimized-state representative");
    }
    for (const target of completeTransitions[representative]) {
      const targetPartition = partitions[target];
      if (!canonicalStateByPartition.has(targetPartition)) {
        canonicalStateByPartition.set(
          targetPartition,
          canonicalPartitions.length,
        );
        canonicalPartitions.push(targetPartition);
      }
    }
  }

  const canonicalAcceptingStates: number[] = [];
  const canonicalTransitions: ObservationAutomatonTransition[] = [];
  for (let state = 0; state < canonicalPartitions.length; state += 1) {
    const partition = canonicalPartitions[state];
    const representative = representativeByPartition.get(partition);
    if (representative === undefined) {
      fail("invalid-automaton", [], "Missing canonical-state representative");
    }
    if (productiveAccepting.has(representative))
      canonicalAcceptingStates.push(state);
    for (
      let symbolIndex = 0;
      symbolIndex < activeAlphabet.length;
      symbolIndex += 1
    ) {
      const targetPartition =
        partitions[completeTransitions[representative][symbolIndex]];
      const toState = canonicalStateByPartition.get(targetPartition);
      if (toState === undefined) {
        fail(
          "invalid-automaton",
          [],
          "Canonical transition target is unreachable",
        );
      }
      canonicalTransitions.push({
        fromState: state,
        symbolId: activeAlphabet[symbolIndex].id,
        toState,
      });
    }
  }
  return {
    alphabet: activeAlphabet,
    stateCount: canonicalPartitions.length,
    initialState: 0,
    acceptingStates: canonicalAcceptingStates,
    transitions: canonicalTransitions,
  };
}

async function readObservationInputSymbol(
  value: unknown,
  path: ValidationPath,
): Promise<ObservationInputSymbol> {
  const symbol = await readTraceSymbol(value, path);
  if (symbol.kind !== "event") {
    fail(
      "invalid-automaton",
      path,
      "Observation input languages may contain only event symbols",
    );
  }
  return symbol;
}

async function buildObservationInputLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
  schema: string | null,
  path: ValidationPath,
): Promise<ObservationInputLanguage> {
  const input = await readAutomatonInput(
    value,
    path,
    schema,
    readObservationInputSymbol,
  );
  const normalized = normalizeAutomaton(input, budget);
  const preimage: ObservationInputLanguagePreimage = {
    schema: "dathra.observation-input-language/1",
    ...normalized,
  };
  return await contentAddressed(preimage);
}

/** Creates a canonical finite external input event language. */
async function createObservationInputLanguage(
  input: ObservationInputLanguageInput,
  budget: ObservationAutomatonBudget,
): Promise<ObservationInputLanguage> {
  return await buildObservationInputLanguage(
    snapshotClosed(input),
    readBudget(budget),
    null,
    [],
  );
}

/** Parses and verifies a canonical external input event language. */
async function parseObservationInputLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
): Promise<ObservationInputLanguage> {
  const capturedBudget = readBudget(budget);
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Input language digest does not match its preimage",
    );
  }
  const parsed = await buildObservationInputLanguage(
    record.preimage,
    capturedBudget,
    "dathra.observation-input-language/1",
    ["preimage"],
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "invalid-automaton",
      ["preimage"],
      "Input language is not in canonical DFA form",
    );
  }
  return parsed;
}

/** Returns whether every external input word in left is accepted by right. */
function isObservationInputLanguageSubset(
  left: ObservationInputLanguage,
  right: ObservationInputLanguage,
  budget: ObservationAutomatonBudget,
): boolean {
  return isAutomatonLanguageSubset(
    left.preimage,
    right.preimage,
    readBudget(budget),
  );
}

/** Returns whether two external input languages have an empty intersection. */
function areObservationInputLanguagesDisjoint(
  left: ObservationInputLanguage,
  right: ObservationInputLanguage,
  budget: ObservationAutomatonBudget,
): boolean {
  const capturedBudget = readBudget(budget);
  const leftTransitions = transitionTable(left.preimage);
  const rightTransitions = transitionTable(right.preimage);
  const leftAccepting = new Set(left.preimage.acceptingStates);
  const rightAccepting = new Set(right.preimage.acceptingStates);
  const alphabetIds = sortedCopy(
    [
      ...new Set([
        ...left.preimage.alphabet.map(({ id }) => id),
        ...right.preimage.alphabet.map(({ id }) => id),
      ]),
    ],
    compareText,
  );
  const queue: { readonly left: number; readonly right: number }[] = [
    { left: left.preimage.initialState, right: right.preimage.initialState },
  ];
  const visited = new Set<string>([
    `${left.preimage.initialState}:${right.preimage.initialState}`,
  ]);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    checkBudget(
      "maximumProductStateCount",
      capturedBudget.maximumProductStateCount,
      visited.size,
    );
    const pair = queue[cursor];
    if (leftAccepting.has(pair.left) && rightAccepting.has(pair.right)) {
      return false;
    }
    for (const symbolId of alphabetIds) {
      const leftTarget =
        pair.left === -1
          ? -1
          : (leftTransitions.get(pair.left)?.get(symbolId) ?? -1);
      const rightTarget =
        pair.right === -1
          ? -1
          : (rightTransitions.get(pair.right)?.get(symbolId) ?? -1);
      if (leftTarget === -1 || rightTarget === -1) continue;
      const key = `${leftTarget}:${rightTarget}`;
      if (!visited.has(key)) {
        visited.add(key);
        queue.push({ left: leftTarget, right: rightTarget });
      }
    }
  }
  return true;
}

/** Builds the canonical union of external input languages. */
async function unionObservationInputLanguages(
  languages: readonly ObservationInputLanguage[],
  budget: ObservationAutomatonBudget,
): Promise<ObservationInputLanguage> {
  const capturedBudget = readBudget(budget);
  if (languages.length === 0) {
    return await contentAddressed({
      schema: "dathra.observation-input-language/1",
      alphabet: [],
      stateCount: 1,
      initialState: 0,
      acceptingStates: [],
      transitions: [],
    });
  }
  const symbolById = new Map<Sha256Digest, ObservationInputSymbol>();
  for (const language of languages) {
    for (const symbol of language.preimage.alphabet) {
      const existing = symbolById.get(symbol.id);
      if (existing !== undefined && !canonicalEqual(existing, symbol)) {
        fail(
          "language-mismatch",
          ["languages", symbol.id],
          "Input languages disagree about a symbol preimage",
        );
      }
      symbolById.set(symbol.id, symbol);
    }
  }
  const alphabet = sortedCopy([...symbolById.values()], (left, right) =>
    compareText(left.id, right.id),
  );
  const tables = languages.map(({ preimage }) => transitionTable(preimage));
  const acceptingSets = languages.map(
    ({ preimage }) => new Set(preimage.acceptingStates),
  );
  const start: number[] = languages.map(
    ({ preimage }) => preimage.initialState,
  );
  const keyOf = (states: readonly number[]): string => states.join(",");
  const states: number[][] = [start];
  const stateIds = new Map<string, number>([[keyOf(start), 0]]);
  const acceptingStates: number[] = [];
  const transitions: ObservationAutomatonTransition[] = [];
  for (let cursor = 0; cursor < states.length; cursor += 1) {
    const tuple = states[cursor];
    if (
      tuple.some(
        (state, index) => state !== -1 && acceptingSets[index].has(state),
      )
    ) {
      acceptingStates.push(cursor);
    }
    for (const symbol of alphabet) {
      const targetTuple = tuple.map((state, index) =>
        state === -1 ? -1 : (tables[index].get(state)?.get(symbol.id) ?? -1),
      );
      const key = keyOf(targetTuple);
      let targetState = stateIds.get(key);
      if (targetState === undefined) {
        targetState = states.length;
        stateIds.set(key, targetState);
        states.push(targetTuple);
        checkBudget(
          "maximumDeterminizedStateCount",
          capturedBudget.maximumDeterminizedStateCount,
          states.length,
        );
      }
      transitions.push({
        fromState: cursor,
        symbolId: symbol.id,
        toState: targetState,
      });
    }
  }
  const normalized = normalizeAutomaton(
    {
      alphabet,
      stateCount: states.length,
      initialState: 0,
      acceptingStates,
      transitions,
    },
    capturedBudget,
  );
  return await contentAddressed({
    schema: "dathra.observation-input-language/1",
    ...normalized,
  });
}

async function buildTraceLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
  schema: string | null,
  path: ValidationPath,
): Promise<ObservationTraceLanguage> {
  const input = await readAutomatonInput(value, path, schema, readTraceSymbol);
  const normalized = normalizeAutomaton(input, budget);
  const preimage: ObservationTraceLanguagePreimage = {
    schema: "dathra.observation-trace-language/1",
    ...normalized,
  };
  return await contentAddressed(preimage);
}

/** Creates a reachable, complete, minimal canonical trace DFA. */
async function createObservationTraceLanguage(
  input: ObservationTraceLanguageInput,
  budget: ObservationAutomatonBudget,
): Promise<ObservationTraceLanguage> {
  const capturedBudget = readBudget(budget);
  return await buildTraceLanguage(
    snapshotClosed(input),
    capturedBudget,
    null,
    [],
  );
}

/** Parses and verifies a canonical observation trace language. */
async function parseObservationTraceLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
): Promise<ObservationTraceLanguage> {
  const capturedBudget = readBudget(budget);
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Trace language digest does not match its preimage",
    );
  }
  const parsed = await buildTraceLanguage(
    record.preimage,
    capturedBudget,
    "dathra.observation-trace-language/1",
    ["preimage"],
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "invalid-automaton",
      ["preimage"],
      "Trace language is not in canonical DFA form",
    );
  }
  return parsed;
}

async function buildRelationLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
  schema: string | null,
  path: ValidationPath,
): Promise<ObservationRelationLanguage> {
  const input = await readAutomatonInput(
    value,
    path,
    schema,
    readRelationSymbol,
  );
  const normalized = normalizeAutomaton(input, budget);
  const preimage: ObservationRelationLanguagePreimage = {
    schema: "dathra.observation-relation-language/1",
    ...normalized,
  };
  return await contentAddressed(preimage);
}

/** Creates a reachable, complete, minimal canonical relation DFA. */
async function createObservationRelationLanguage(
  input: ObservationRelationLanguageInput,
  budget: ObservationAutomatonBudget,
): Promise<ObservationRelationLanguage> {
  const capturedBudget = readBudget(budget);
  return await buildRelationLanguage(
    snapshotClosed(input),
    capturedBudget,
    null,
    [],
  );
}

/** Parses and verifies a canonical observation relation language. */
async function parseObservationRelationLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
): Promise<ObservationRelationLanguage> {
  const capturedBudget = readBudget(budget);
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Relation language digest does not match its preimage",
    );
  }
  const parsed = await buildRelationLanguage(
    record.preimage,
    capturedBudget,
    "dathra.observation-relation-language/1",
    ["preimage"],
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "invalid-automaton",
      ["preimage"],
      "Relation language is not in canonical DFA form",
    );
  }
  return parsed;
}

async function buildCompositionRelationLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
  schema: string | null,
  path: ValidationPath,
): Promise<ObservationCompositionRelationLanguage> {
  const input = await readAutomatonInput(
    value,
    path,
    schema,
    readCompositionRelationSymbol,
  );
  const normalized = normalizeAutomaton(input, budget);
  const preimage: ObservationCompositionRelationLanguagePreimage = {
    schema: "dathra.observation-composition-relation-language/1",
    ...normalized,
  };
  return await contentAddressed(preimage);
}

/** Creates a reachable, complete, minimal multi-tape composition DFA. */
async function createObservationCompositionRelationLanguage(
  input: ObservationCompositionRelationLanguageInput,
  budget: ObservationAutomatonBudget,
): Promise<ObservationCompositionRelationLanguage> {
  const capturedBudget = readBudget(budget);
  return await buildCompositionRelationLanguage(
    snapshotClosed(input),
    capturedBudget,
    null,
    [],
  );
}

/** Parses and verifies a canonical multi-tape composition DFA. */
async function parseObservationCompositionRelationLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
): Promise<ObservationCompositionRelationLanguage> {
  const capturedBudget = readBudget(budget);
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Composition relation language digest does not match its preimage",
    );
  }
  const parsed = await buildCompositionRelationLanguage(
    record.preimage,
    capturedBudget,
    "dathra.observation-composition-relation-language/1",
    ["preimage"],
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "invalid-automaton",
      ["preimage"],
      "Composition relation language is not in canonical DFA form",
    );
  }
  return parsed;
}

async function buildSequenceLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
  schema: string | null,
  path: ValidationPath,
): Promise<RealizationSequenceLanguage> {
  const input = await readAutomatonInput(
    value,
    path,
    schema,
    readTemplateSymbol,
  );
  const normalized = normalizeAutomaton(input, budget);
  const preimage: RealizationSequenceLanguagePreimage = {
    schema: "dathra.realization-sequence-language/1",
    ...normalized,
  };
  return await contentAddressed(preimage);
}

/** Creates a reachable, complete, minimal realization sequence DFA. */
async function createRealizationSequenceLanguage(
  input: RealizationSequenceLanguageInput,
  budget: ObservationAutomatonBudget,
): Promise<RealizationSequenceLanguage> {
  const capturedBudget = readBudget(budget);
  return await buildSequenceLanguage(
    snapshotClosed(input),
    capturedBudget,
    null,
    [],
  );
}

async function parseRealizationSequenceLanguage(
  value: unknown,
  budget: ObservationAutomatonBudget,
): Promise<RealizationSequenceLanguage> {
  const capturedBudget = readBudget(budget);
  const snapshot = snapshotClosed(value);
  const record = expectRecord(snapshot, [], ["id", "preimage"]);
  const id = expectDigest(record.id, ["id"]);
  if (id !== (await digestCanonicalJson(record.preimage))) {
    fail(
      "digest-mismatch",
      ["id"],
      "Sequence language digest does not match its preimage",
    );
  }
  const parsed = await buildSequenceLanguage(
    record.preimage,
    capturedBudget,
    "dathra.realization-sequence-language/1",
    ["preimage"],
  );
  if (parsed.id !== id || !canonicalEqual(parsed.preimage, record.preimage)) {
    fail(
      "invalid-automaton",
      ["preimage"],
      "Sequence language is not canonical",
    );
  }
  return parsed;
}

function transitionTable<Symbol extends { readonly id: Sha256Digest }>(
  automaton: AutomatonInput<Symbol>,
): ReadonlyMap<number, ReadonlyMap<Sha256Digest, number>> {
  const result = new Map<number, Map<Sha256Digest, number>>();
  for (let state = 0; state < automaton.stateCount; state += 1) {
    result.set(state, new Map());
  }
  for (const transition of automaton.transitions) {
    result
      .get(transition.fromState)
      ?.set(transition.symbolId, transition.toState);
  }
  return result;
}

function isAutomatonLanguageSubset<
  LeftSymbol extends { readonly id: Sha256Digest },
  RightSymbol extends { readonly id: Sha256Digest },
>(
  left: AutomatonInput<LeftSymbol>,
  right: AutomatonInput<RightSymbol>,
  budget: ObservationAutomatonBudget,
): boolean {
  const leftTransitions = transitionTable(left);
  const rightTransitions = transitionTable(right);
  const leftAccepting = new Set(left.acceptingStates);
  const rightAccepting = new Set(right.acceptingStates);
  const queue: { readonly left: number; readonly right: number }[] = [
    { left: left.initialState, right: right.initialState },
  ];
  const visited = new Set<string>([
    `${left.initialState}:${right.initialState}`,
  ]);
  checkBudget(
    "maximumProductStateCount",
    budget.maximumProductStateCount,
    visited.size,
  );
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    const pair = queue[cursor];
    if (leftAccepting.has(pair.left) && !rightAccepting.has(pair.right)) {
      return false;
    }
    for (const symbol of left.alphabet) {
      const leftTarget = leftTransitions.get(pair.left)?.get(symbol.id);
      if (leftTarget === undefined) {
        fail("invalid-automaton", [], "Left language is not complete");
      }
      const rightTarget =
        pair.right === -1
          ? -1
          : (rightTransitions.get(pair.right)?.get(symbol.id) ?? -1);
      const key = `${leftTarget}:${rightTarget}`;
      if (!visited.has(key)) {
        visited.add(key);
        checkBudget(
          "maximumProductStateCount",
          budget.maximumProductStateCount,
          visited.size,
        );
        queue.push({ left: leftTarget, right: rightTarget });
      }
    }
  }
  return true;
}

/** Returns whether every word accepted by the left trace DFA is accepted by the right DFA. */
function isObservationTraceLanguageSubset(
  left: ObservationTraceLanguage,
  right: ObservationTraceLanguage,
  budget: ObservationAutomatonBudget,
): boolean {
  const capturedBudget = readBudget(budget);
  return isAutomatonLanguageSubset(
    left.preimage,
    right.preimage,
    capturedBudget,
  );
}

function projectRelationAutomaton(
  relation: ObservationRelationLanguage,
  side: "source" | "candidate",
  target: ObservationTraceLanguage,
  budget: ObservationAutomatonBudget,
): NormalizedAutomaton<ObservationTraceSymbol> {
  const targetSymbols = new Map(
    target.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const relationSymbols = new Map(
    relation.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const epsilon = new Map<number, number[]>();
  const labelled = new Map<number, Map<Sha256Digest, number[]>>();
  for (let state = 0; state < relation.preimage.stateCount; state += 1) {
    epsilon.set(state, []);
    labelled.set(state, new Map());
  }
  for (const transition of relation.preimage.transitions) {
    const symbol = relationSymbols.get(transition.symbolId);
    if (symbol === undefined) {
      fail(
        "invalid-automaton",
        [],
        "Relation transition references an unknown symbol",
      );
    }
    const projectedId =
      side === "source" ? symbol.sourceSymbolId : symbol.candidateSymbolId;
    if (projectedId === null) {
      epsilon.get(transition.fromState)?.push(transition.toState);
      continue;
    }
    if (!targetSymbols.has(projectedId)) {
      fail(
        "language-mismatch",
        ["alphabet", symbol.id],
        "Relation projection references a symbol outside the target language",
      );
    }
    const bySymbol = labelled.get(transition.fromState);
    if (bySymbol === undefined) {
      fail("invalid-automaton", [], "Missing relation state");
    }
    let targets = bySymbol.get(projectedId);
    if (targets === undefined) {
      targets = [];
      bySymbol.set(projectedId, targets);
    }
    targets.push(transition.toState);
  }

  const closure = (states: ReadonlySet<number>): number[] => {
    const result = new Set(states);
    const queue = [...result];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const targetState of epsilon.get(queue[cursor]) ?? []) {
        if (!result.has(targetState)) {
          result.add(targetState);
          queue.push(targetState);
        }
      }
    }
    return [...result].sort((left, right) => left - right);
  };
  const keyOf = (states: readonly number[]): string => states.join(",");
  const start = closure(new Set([relation.preimage.initialState]));
  const subsets = [start];
  const subsetIds = new Map<string, number>([[keyOf(start), 0]]);
  const transitions: ObservationAutomatonTransition[] = [];
  const acceptingStates: number[] = [];
  const relationAccepting = new Set(relation.preimage.acceptingStates);
  for (let cursor = 0; cursor < subsets.length; cursor += 1) {
    const subset = subsets[cursor];
    if (subset.some((state) => relationAccepting.has(state))) {
      acceptingStates.push(cursor);
    }
    for (const symbol of target.preimage.alphabet) {
      const moved = new Set<number>();
      for (const state of subset) {
        for (const targetState of labelled.get(state)?.get(symbol.id) ?? []) {
          moved.add(targetState);
        }
      }
      const targetSubset = closure(moved);
      const key = keyOf(targetSubset);
      let targetState = subsetIds.get(key);
      if (targetState === undefined) {
        targetState = subsets.length;
        subsetIds.set(key, targetState);
        subsets.push(targetSubset);
        checkBudget(
          "maximumDeterminizedStateCount",
          budget.maximumDeterminizedStateCount,
          subsets.length,
        );
      }
      transitions.push({
        fromState: cursor,
        symbolId: symbol.id,
        toState: targetState,
      });
    }
  }
  return normalizeAutomaton(
    {
      alphabet: target.preimage.alphabet,
      stateCount: subsets.length,
      initialState: 0,
      acceptingStates,
      transitions,
    },
    budget,
  );
}

/** Projects one side of a relation through epsilon elimination and determinization. */
async function projectObservationRelationLanguage(
  relation: ObservationRelationLanguage,
  side: "source" | "candidate",
  target: ObservationTraceLanguage,
  budget: ObservationAutomatonBudget,
): Promise<ObservationTraceLanguage> {
  const capturedBudget = readBudget(budget);
  const projectedSide = expectOneOf(side, ["source", "candidate"] as const, [
    "side",
  ]);
  const normalized = projectRelationAutomaton(
    relation,
    projectedSide,
    target,
    capturedBudget,
  );
  const preimage: ObservationTraceLanguagePreimage = {
    schema: "dathra.observation-trace-language/1",
    ...normalized,
  };
  return await contentAddressed(preimage);
}

function normalizedTraceLanguageMatches(
  normalized: NormalizedAutomaton<ObservationTraceSymbol>,
  expected: ObservationTraceLanguage,
): boolean {
  return canonicalEqual(normalized, {
    alphabet: expected.preimage.alphabet,
    stateCount: expected.preimage.stateCount,
    initialState: expected.preimage.initialState,
    acceptingStates: expected.preimage.acceptingStates,
    transitions: expected.preimage.transitions,
  });
}

function normalizedInputLanguageMatches(
  normalized: NormalizedAutomaton<ObservationInputSymbol>,
  expected: ObservationInputLanguage,
): boolean {
  return canonicalEqual(normalized, {
    alphabet: expected.preimage.alphabet,
    stateCount: expected.preimage.stateCount,
    initialState: expected.preimage.initialState,
    acceptingStates: expected.preimage.acceptingStates,
    transitions: expected.preimage.transitions,
  });
}

function projectTraceEventLanguage(
  trace: ObservationTraceLanguage,
  target: ObservationInputLanguage,
  budget: ObservationAutomatonBudget,
): NormalizedAutomaton<ObservationInputSymbol> {
  const traceSymbols = new Map(
    trace.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const targetSymbols = new Map(
    target.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const epsilon = new Map<number, number[]>();
  const labelled = new Map<number, Map<Sha256Digest, number[]>>();
  for (let state = 0; state < trace.preimage.stateCount; state += 1) {
    epsilon.set(state, []);
    labelled.set(state, new Map());
  }
  for (const transition of trace.preimage.transitions) {
    const symbol = traceSymbols.get(transition.symbolId);
    if (symbol === undefined) {
      fail(
        "invalid-automaton",
        ["transitions"],
        "Trace transition references an unavailable symbol",
      );
    }
    if (symbol.kind !== "event") {
      epsilon.get(transition.fromState)?.push(transition.toState);
      continue;
    }
    if (!targetSymbols.has(symbol.id)) {
      fail(
        "language-mismatch",
        ["alphabet", symbol.id],
        "Behavior event projection contains an event outside its input selector",
      );
    }
    const bySymbol = labelled.get(transition.fromState);
    if (bySymbol === undefined) {
      fail("invalid-automaton", [], "Missing trace projection state");
    }
    const targets = bySymbol.get(symbol.id);
    if (targets === undefined) bySymbol.set(symbol.id, [transition.toState]);
    else targets.push(transition.toState);
  }
  const closure = (states: ReadonlySet<number>): number[] => {
    const result = new Set(states);
    const queue = [...result];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const targetState of epsilon.get(queue[cursor]) ?? []) {
        if (!result.has(targetState)) {
          result.add(targetState);
          queue.push(targetState);
        }
      }
    }
    return [...result].sort((left, right) => left - right);
  };
  const keyOf = (states: readonly number[]): string => states.join(",");
  const start = closure(new Set([trace.preimage.initialState]));
  const subsets = [start];
  const subsetIds = new Map<string, number>([[keyOf(start), 0]]);
  const transitions: ObservationAutomatonTransition[] = [];
  const acceptingStates: number[] = [];
  const traceAccepting = new Set(trace.preimage.acceptingStates);
  for (let cursor = 0; cursor < subsets.length; cursor += 1) {
    const subset = subsets[cursor];
    if (subset.some((state) => traceAccepting.has(state))) {
      acceptingStates.push(cursor);
    }
    for (const symbol of target.preimage.alphabet) {
      const moved = new Set<number>();
      for (const state of subset) {
        for (const targetState of labelled.get(state)?.get(symbol.id) ?? []) {
          moved.add(targetState);
        }
      }
      const targetSubset = closure(moved);
      const key = keyOf(targetSubset);
      let targetState = subsetIds.get(key);
      if (targetState === undefined) {
        targetState = subsets.length;
        subsetIds.set(key, targetState);
        subsets.push(targetSubset);
        checkBudget(
          "maximumDeterminizedStateCount",
          budget.maximumDeterminizedStateCount,
          subsets.length,
        );
      }
      transitions.push({
        fromState: cursor,
        symbolId: symbol.id,
        toState: targetState,
      });
    }
  }
  return normalizeAutomaton(
    {
      alphabet: target.preimage.alphabet,
      stateCount: subsets.length,
      initialState: 0,
      acceptingStates,
      transitions,
    },
    budget,
  );
}

interface ContractProductState {
  readonly automatonState: number;
  readonly counts: readonly number[];
  readonly seenSlots: readonly string[];
}

function effectiveBehaviorCardinality(
  constraint: ObservationConstraint,
  contract: ObservationContract,
  role: ObservationBehaviorSummaryPreimage["role"],
): ObservationCardinality {
  const cardinality = effectiveCardinality(constraint);
  if (
    role !== "candidate" ||
    !contract.preimage.refinementRules.some(
      (rule) =>
        rule.kind === "omit-unobservable-internal-step" &&
        rule.constraintIds.includes(constraint.id),
    )
  ) {
    return cardinality;
  }
  const interval = cardinalityInterval(cardinality);
  return { kind: "range", minimum: 0, maximum: interval.maximum };
}

function validateTraceLanguageAgainstContract(
  language: ObservationTraceLanguage,
  contract: ObservationContract,
  role: ObservationBehaviorSummaryPreimage["role"],
  budget: ObservationAutomatonBudget,
  path: ValidationPath,
): void {
  if (language.preimage.acceptingStates.length === 0) {
    fail(
      "language-mismatch",
      path,
      "An input class must have at least one accepted behavior trace",
    );
  }
  const constraints = contract.preimage.constraints;
  const cardinalities = constraints.map((constraint) =>
    effectiveBehaviorCardinality(constraint, contract, role),
  );
  const constraintIndexById = new Map(
    constraints.map((constraint, index) => [constraint.id, index]),
  );
  const symbols = new Map(
    language.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const outgoing = new Map<number, ObservationAutomatonTransition[]>();
  const reverse = new Map<number, number[]>();
  for (let state = 0; state < language.preimage.stateCount; state += 1) {
    outgoing.set(state, []);
    reverse.set(state, []);
  }
  for (const transition of language.preimage.transitions) {
    outgoing.get(transition.fromState)?.push(transition);
    reverse.get(transition.toState)?.push(transition.fromState);
  }
  const coreachable = new Set(language.preimage.acceptingStates);
  const coreachableQueue = [...coreachable];
  for (let cursor = 0; cursor < coreachableQueue.length; cursor += 1) {
    for (const source of reverse.get(coreachableQueue[cursor]) ?? []) {
      if (!coreachable.has(source)) {
        coreachable.add(source);
        coreachableQueue.push(source);
      }
    }
  }
  const initial: ContractProductState = {
    automatonState: language.preimage.initialState,
    counts: constraints.map(() => 0),
    seenSlots: [],
  };
  const keyOf = (state: ContractProductState): string =>
    `${state.automatonState}|${state.counts.join(",")}|${state.seenSlots.join(",")}`;
  const queue = [initial];
  const visited = new Set<string>([keyOf(initial)]);
  const accepting = new Set(language.preimage.acceptingStates);
  for (let cursor = 0; cursor < queue.length; cursor += 1) {
    checkBudget(
      "maximumProductStateCount",
      budget.maximumProductStateCount,
      visited.size,
    );
    const state = queue[cursor];
    if (accepting.has(state.automatonState)) {
      for (let index = 0; index < constraints.length; index += 1) {
        const interval = cardinalityInterval(cardinalities[index]);
        if (
          state.counts[index] < interval.minimum ||
          state.counts[index] > interval.maximum
        ) {
          fail(
            "invalid-cardinality",
            [...path, "acceptingStates", state.automatonState],
            "An accepted trace violates a constraint cardinality",
          );
        }
      }
    }
    for (const transition of outgoing.get(state.automatonState) ?? []) {
      if (!coreachable.has(transition.toState)) continue;
      const symbol = symbols.get(transition.symbolId);
      if (symbol === undefined) {
        fail(
          "invalid-automaton",
          [...path, "transitions"],
          "Trace transition references an unavailable symbol",
        );
      }
      const counts = [...state.counts];
      const seenSlots = new Set(state.seenSlots);
      let slotKey: string;
      if (symbol.kind === "event") {
        slotKey = `event:${symbol.id}`;
      } else {
        const constraintIndex = constraintIndexById.get(symbol.constraintId);
        if (constraintIndex === undefined) {
          fail(
            "dangling-reference",
            [...path, "alphabet", symbol.id, "constraintId"],
            "Trace symbol references a constraint outside the contract",
          );
        }
        const constraint = constraints[constraintIndex];
        const interval = cardinalityInterval(cardinalities[constraintIndex]);
        if (symbol.occurrenceOrdinal >= interval.maximum) {
          fail(
            "invalid-cardinality",
            [...path, "alphabet", symbol.id, "occurrenceOrdinal"],
            "Trace occurrence ordinal exceeds the constraint maximum",
          );
        }
        if (symbol.kind === "terminal") {
          if (
            constraint.kind !== "terminal" ||
            !constraint.outcomes.includes(symbol.outcome)
          ) {
            fail(
              "language-mismatch",
              [...path, "alphabet", symbol.id],
              "Terminal trace symbol is not allowed by its constraint",
            );
          }
        } else if (constraint.kind === "terminal") {
          fail(
            "language-mismatch",
            [...path, "alphabet", symbol.id],
            "A terminal constraint requires a terminal trace symbol",
          );
        }
        slotKey = `${constraint.id}:${symbol.occurrenceOrdinal}`;
        if (seenSlots.has(slotKey)) {
          fail(
            "invalid-cardinality",
            [...path, "alphabet", symbol.id],
            "An accepted trace reuses one occurrence slot",
          );
        }
        counts[constraintIndex] += 1;
        if (counts[constraintIndex] > interval.maximum) {
          fail(
            "invalid-cardinality",
            [...path, "alphabet", symbol.id],
            "An accepted trace exceeds a constraint cardinality",
          );
        }
        for (const edge of contract.preimage.orderEdges) {
          const beforeIndex = constraintIndexById.get(edge.beforeConstraintId);
          const afterIndex = constraintIndexById.get(edge.afterConstraintId);
          if (beforeIndex === undefined || afterIndex === undefined) continue;
          if (
            (edge.relation === "strict" || edge.relation === "serial") &&
            constraint.id === edge.beforeConstraintId &&
            counts[afterIndex] > 0
          ) {
            fail(
              "language-mismatch",
              [...path, "transitions"],
              "An accepted trace violates strict observation order",
            );
          }
          if (
            edge.relation === "exclusive" &&
            ((constraint.id === edge.beforeConstraintId &&
              counts[afterIndex] > 0) ||
              (constraint.id === edge.afterConstraintId &&
                counts[beforeIndex] > 0))
          ) {
            fail(
              "language-mismatch",
              [...path, "transitions"],
              "An accepted trace contains exclusive constraints together",
            );
          }
        }
      }
      if (seenSlots.has(slotKey)) {
        fail(
          "invalid-cardinality",
          [...path, "alphabet", symbol.id],
          "An accepted trace reuses one event or occurrence slot",
        );
      }
      seenSlots.add(slotKey);
      const next: ContractProductState = {
        automatonState: transition.toState,
        counts,
        seenSlots: sortedCopy([...seenSlots], compareText),
      };
      const key = keyOf(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
}

async function parseTrustedProofAcceptances(
  context: TrustedObservationProofContext,
): Promise<ReadonlyMap<Sha256Digest, ObservationProofAcceptance>> {
  const parsed = new Map<Sha256Digest, ObservationProofAcceptance>();
  for (let index = 0; index < context.proofAcceptances.length; index += 1) {
    const acceptance = await parseObservationProofAcceptance(
      context.proofAcceptances[index],
    );
    const existing = parsed.get(acceptance.id);
    if (existing !== undefined) {
      fail(
        "duplicate-record",
        ["proofAcceptances", index],
        "Proof acceptance ID is duplicated",
      );
    }
    parsed.set(acceptance.id, acceptance);
  }
  const trustedIds = new Set<Sha256Digest>();
  for (
    let index = 0;
    index < context.trustedProofAcceptanceIds.length;
    index += 1
  ) {
    const trustedId = context.trustedProofAcceptanceIds[index];
    if (trustedIds.has(trustedId)) {
      fail(
        "duplicate-record",
        ["trustedProofAcceptanceIds", index],
        "Trusted proof acceptance ID is duplicated",
      );
    }
    trustedIds.add(trustedId);
    if (!parsed.has(trustedId)) {
      fail(
        "missing-proof",
        ["trustedProofAcceptanceIds", index],
        "Trusted proof ID has no parsed acceptance record",
      );
    }
  }
  return parsed;
}

function requireParsedTrustedProofAcceptance(
  parsed: ReadonlyMap<Sha256Digest, ObservationProofAcceptance>,
  trustedIds: ReadonlySet<Sha256Digest>,
  proofDomainId: Sha256Digest,
  claimDigest: Sha256Digest,
  path: ValidationPath,
): ObservationProofAcceptance {
  let matched: ObservationProofAcceptance | undefined;
  for (const acceptance of parsed.values()) {
    if (
      trustedIds.has(acceptance.id) &&
      acceptance.preimage.proofDomainId === proofDomainId &&
      acceptance.preimage.claimDigest === claimDigest
    ) {
      if (matched !== undefined) {
        fail(
          "ambiguous-proof",
          path,
          "More than one trusted proof acceptance matches the proof domain and claim",
        );
      }
      matched = acceptance;
    }
  }
  if (matched !== undefined) return matched;
  fail(
    "missing-proof",
    path,
    "No parsed trusted proof acceptance matches the proof domain and claim",
  );
}

/** Validates partition coverage, contract conformance, and derivation proof closure. */
async function validateObservationBehaviorSummary(
  input: ObservationBehaviorValidationInput,
): Promise<AcceptedObservationBehavior> {
  const budget = readBudget(input.budget);
  const contract = await parseObservationContract(input.contract);
  const summary = await parseObservationBehaviorSummary(input.summary);
  const partition = await parseObservationInputPartition(
    snapshotClosed(input.inputPartition),
    ["inputPartition"],
  );
  const partitionPolicyClaim = await parseObservationInputPartitionPolicyClaim(
    snapshotClosed(input.partitionPolicyClaim),
    ["partitionPolicyClaim"],
  );
  const behaviorDerivationClaim = await parseObservationBehaviorDerivationClaim(
    snapshotClosed(input.behaviorDerivationClaim),
    ["behaviorDerivationClaim"],
  );
  const inputLanguages = new Map<Sha256Digest, ObservationInputLanguage>();
  for (let index = 0; index < input.inputLanguages.length; index += 1) {
    const language = await parseObservationInputLanguage(
      input.inputLanguages[index],
      budget,
    );
    inputLanguages.set(language.id, language);
  }
  const traceLanguages = new Map<Sha256Digest, ObservationTraceLanguage>();
  for (let index = 0; index < input.traceLanguages.length; index += 1) {
    const language = await parseObservationTraceLanguage(
      input.traceLanguages[index],
      budget,
    );
    traceLanguages.set(language.id, language);
  }
  if (
    summary.preimage.observationContractId !== contract.id ||
    summary.preimage.inputPartitionId !== partition.id ||
    partition.preimage.externalInputIdentitySchemaId !==
      contract.preimage.externalInputIdentitySchemaId ||
    partition.preimage.eventIdentitySchemaId !==
      contract.preimage.eventIdentitySchemaId ||
    partition.preimage.initialCutId !== contract.preimage.initialCutId
  ) {
    fail(
      "contract-mismatch",
      [],
      "Behavior summary, input partition, and observation contract are not consistently bound",
    );
  }
  const expectedClassIds = partition.preimage.inputClasses.map(({ id }) => id);
  if (
    !canonicalEqual(
      summary.preimage.inputClasses.map(({ inputClassId }) => inputClassId),
      expectedClassIds,
    )
  ) {
    fail(
      "language-mismatch",
      ["summary", "preimage", "inputClasses"],
      "Behavior summary does not cover the exact input partition",
    );
  }
  const universe = inputLanguages.get(partition.preimage.universeLanguageId);
  if (universe === undefined) {
    fail(
      "dangling-reference",
      ["inputPartition", "preimage", "universeLanguageId"],
      "Input partition references an unavailable universe language",
    );
  }
  const selectors = partition.preimage.inputClasses.map((descriptor, index) => {
    const selector = inputLanguages.get(descriptor.preimage.selectorLanguageId);
    if (selector === undefined) {
      fail(
        "dangling-reference",
        [
          "inputPartition",
          "preimage",
          "inputClasses",
          index,
          "selectorLanguageId",
        ],
        "Input class references an unavailable selector language",
      );
    }
    if (selector.preimage.acceptingStates.length === 0) {
      fail(
        "language-mismatch",
        ["inputPartition", "preimage", "inputClasses", index],
        "Input class selector cannot be empty",
      );
    }
    if (!isObservationInputLanguageSubset(selector, universe, budget)) {
      fail(
        "language-mismatch",
        ["inputPartition", "preimage", "inputClasses", index],
        "Input class selector is not a subset of the input universe",
      );
    }
    return selector;
  });
  for (let left = 0; left < selectors.length; left += 1) {
    for (let right = left + 1; right < selectors.length; right += 1) {
      if (
        !areObservationInputLanguagesDisjoint(
          selectors[left],
          selectors[right],
          budget,
        )
      ) {
        fail(
          "language-mismatch",
          ["inputPartition", "preimage", "inputClasses", right],
          "Input class selectors overlap",
        );
      }
    }
  }
  const selectorUnion = await unionObservationInputLanguages(selectors, budget);
  if (selectorUnion.id !== universe.id) {
    fail(
      "language-mismatch",
      ["inputPartition", "preimage", "universeLanguageId"],
      "Input class selectors do not cover the complete input universe",
    );
  }
  if (
    partitionPolicyClaim.preimage.inputPartitionId !== partition.id ||
    partitionPolicyClaim.preimage.universeLanguageId !== universe.id ||
    !canonicalEqual(
      partitionPolicyClaim.preimage.inputClassIds,
      expectedClassIds,
    )
  ) {
    fail(
      "contract-mismatch",
      ["partitionPolicyClaim"],
      "Partition policy claim does not bind the exact input partition",
    );
  }
  if (
    behaviorDerivationClaim.preimage.behaviorSummaryId !== summary.id ||
    behaviorDerivationClaim.preimage.observationContractId !== contract.id ||
    behaviorDerivationClaim.preimage.semanticGraphDigest !==
      summary.preimage.semanticGraphDigest ||
    behaviorDerivationClaim.preimage.inputPartitionId !== partition.id
  ) {
    fail(
      "contract-mismatch",
      ["behaviorDerivationClaim"],
      "Behavior derivation claim does not bind the exact summary closure",
    );
  }
  const parsedAcceptances = await parseTrustedProofAcceptances(input);
  const trustedIds = new Set(input.trustedProofAcceptanceIds);
  const partitionAcceptance = requireParsedTrustedProofAcceptance(
    parsedAcceptances,
    trustedIds,
    partitionPolicyClaim.preimage.proofDomainId,
    partitionPolicyClaim.id,
    ["proofAcceptances", "partitionPolicyClaim"],
  );
  const derivationAcceptance = requireParsedTrustedProofAcceptance(
    parsedAcceptances,
    trustedIds,
    behaviorDerivationClaim.preimage.proofDomainId,
    behaviorDerivationClaim.id,
    ["proofAcceptances", "behaviorDerivationClaim"],
  );
  for (
    let index = 0;
    index < summary.preimage.inputClasses.length;
    index += 1
  ) {
    const summaryClass = summary.preimage.inputClasses[index];
    const selector = selectors[index];
    const traceLanguage = traceLanguages.get(summaryClass.traceLanguageId);
    if (traceLanguage === undefined) {
      fail(
        "dangling-reference",
        ["summary", "preimage", "inputClasses", index, "traceLanguageId"],
        "Behavior summary references an unavailable trace language",
      );
    }
    const projected = projectTraceEventLanguage(
      traceLanguage,
      selector,
      budget,
    );
    if (!normalizedInputLanguageMatches(projected, selector)) {
      fail(
        "language-mismatch",
        ["summary", "preimage", "inputClasses", index],
        "Behavior event projection does not equal the input class selector",
      );
    }
    validateTraceLanguageAgainstContract(
      traceLanguage,
      contract,
      summary.preimage.role,
      budget,
      ["summary", "preimage", "inputClasses", index],
    );
  }
  return await contentAddressed({
    schema: "dathra.accepted-observation-behavior/1",
    behaviorSummaryId: summary.id,
    observationContractId: contract.id,
    inputPartitionId: partition.id,
    partitionPolicyAcceptanceId: partitionAcceptance.id,
    behaviorDerivationAcceptanceId: derivationAcceptance.id,
  });
}

interface RulePolicyRuntime {
  readonly ruleId: Sha256Digest;
  readonly language: ObservationRelationLanguage;
  readonly transitions: ReadonlyMap<number, ReadonlyMap<Sha256Digest, number>>;
  readonly acceptingStates: ReadonlySet<number>;
}

async function parseRelationCompositionContexts(
  values: readonly ObservationRelationCompositionContext[],
): Promise<ReadonlyMap<Sha256Digest, ObservationRelationCompositionContext>> {
  const contexts = new Map<
    Sha256Digest,
    ObservationRelationCompositionContext
  >();
  for (let contextIndex = 0; contextIndex < values.length; contextIndex += 1) {
    const path = ["compositionContexts", contextIndex] as const;
    const record = expectRecord(snapshotClosed(values[contextIndex]), path, [
      "composition",
      "memberContracts",
    ]);
    const memberValues = expectArray(record.memberContracts, [
      ...path,
      "memberContracts",
    ]);
    const memberContracts: ObservationContract[] = [];
    const memberContractIds = new Set<Sha256Digest>();
    for (
      let memberIndex = 0;
      memberIndex < memberValues.length;
      memberIndex += 1
    ) {
      const contract = await parseObservationContract(
        memberValues[memberIndex],
      );
      if (memberContractIds.has(contract.id)) {
        fail(
          "duplicate-record",
          [...path, "memberContracts", memberIndex],
          "Duplicate composition member contract",
        );
      }
      memberContractIds.add(contract.id);
      memberContracts.push(contract);
    }
    const composition = await parseObservationComposition(
      record.composition,
      memberContracts,
    );
    if (contexts.has(composition.id)) {
      fail("duplicate-record", path, "Duplicate relation composition context");
    }
    const context = { composition, memberContracts };
    deepFreeze(context);
    contexts.set(composition.id, context);
  }
  return contexts;
}

function requireTraceSymbol(
  symbols: ReadonlyMap<Sha256Digest, ObservationTraceSymbol>,
  id: Sha256Digest | null,
  path: ValidationPath,
): ObservationTraceSymbol | null {
  if (id === null) return null;
  const symbol = symbols.get(id);
  if (symbol === undefined) {
    fail(
      "invalid-refinement",
      path,
      "Rule mapping references a symbol outside the compared alphabet",
    );
  }
  return symbol;
}

/** Derives a class-local allowed relation from rule mappings and policy transducers. */
async function deriveAllowedObservationRelationLanguage(
  input: ObservationAllowedRelationDerivationInput,
): Promise<ObservationRelationLanguage> {
  const budget = readBudget(input.budget);
  const compositionContextById = await parseRelationCompositionContexts(
    input.compositionContexts,
  );
  const usedCompositionContextIds = new Set<Sha256Digest>();
  const sourceSymbols = new Map(
    input.sourceLanguage.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const candidateSymbols = new Map(
    input.candidateLanguage.preimage.alphabet.map((symbol) => [
      symbol.id,
      symbol,
    ]),
  );
  const constraintById = new Map(
    input.contract.preimage.constraints.map((constraint) => [
      constraint.id,
      constraint,
    ]),
  );
  const ruleById = new Map(
    input.contract.preimage.refinementRules.map((rule) => [rule.id, rule]),
  );
  const descriptorById = new Map<
    Sha256Digest,
    ObservationRulePolicyDescriptor
  >();
  for (const descriptor of input.policyDescriptors) {
    const parsed = await parseObservationRulePolicyDescriptor(descriptor);
    descriptorById.set(parsed.id, parsed);
  }
  const policyLanguageById = new Map<
    Sha256Digest,
    ObservationRelationLanguage
  >();
  for (const language of input.policyTransducerLanguages) {
    const parsed = await parseObservationRelationLanguage(language, budget);
    policyLanguageById.set(parsed.id, parsed);
  }
  const authorizedSymbols = new Map<Sha256Digest, ObservationRelationSymbol>();
  for (const [symbolId, sourceSymbol] of sourceSymbols) {
    const candidateSymbol = candidateSymbols.get(symbolId);
    if (
      candidateSymbol !== undefined &&
      canonicalEqual(sourceSymbol, candidateSymbol)
    ) {
      const identity = await createObservationRelationSymbol({
        sourceSymbolId: symbolId,
        candidateSymbolId: symbolId,
        ruleId: null,
      });
      authorizedSymbols.set(identity.id, identity);
    }
  }
  const policies: RulePolicyRuntime[] = [];
  for (
    let applicationIndex = 0;
    applicationIndex < input.ruleApplications.length;
    applicationIndex += 1
  ) {
    const application = input.ruleApplications[applicationIndex];
    const applicationPath = ["ruleApplications", applicationIndex] as const;
    const preimage = application.preimage;
    const rule = ruleById.get(preimage.ruleId);
    if (
      rule === undefined ||
      rule.kind !== preimage.kind ||
      preimage.sourceSummaryId !== input.sourceSummary.id ||
      preimage.candidateSummaryId !== input.candidateSummary.id ||
      preimage.inputClassId !== input.inputClassId ||
      preimage.proofDomainId !== rule.proofDomainId
    ) {
      fail(
        "invalid-refinement",
        applicationPath,
        "Rule application does not match the contract, summaries, class, and proof domain",
      );
    }
    if (preimage.kind === "equivalent-value") {
      for (
        let pairIndex = 0;
        pairIndex < preimage.allowedTokenPairs.length;
        pairIndex += 1
      ) {
        const pair = preimage.allowedTokenPairs[pairIndex];
        const source = requireTraceSymbol(sourceSymbols, pair.sourceSymbolId, [
          ...applicationPath,
          "allowedTokenPairs",
          pairIndex,
          "sourceSymbolId",
        ]);
        const candidate = requireTraceSymbol(
          candidateSymbols,
          pair.candidateSymbolId,
          [
            ...applicationPath,
            "allowedTokenPairs",
            pairIndex,
            "candidateSymbolId",
          ],
        );
        if (
          source?.kind !== "occurrence" ||
          candidate?.kind !== "occurrence" ||
          !rule.constraintIds.includes(source.constraintId) ||
          !rule.constraintIds.includes(candidate.constraintId)
        ) {
          fail(
            "invalid-refinement",
            [...applicationPath, "allowedTokenPairs", pairIndex],
            "Equivalent-value mapping does not resolve to the rule's occurrence constraints",
          );
        }
        const sourceConstraint = constraintById.get(source.constraintId);
        const candidateConstraint = constraintById.get(candidate.constraintId);
        if (
          sourceConstraint?.kind !== "value" ||
          candidateConstraint?.kind !== "value" ||
          sourceConstraint.equivalenceDomainId !==
            candidateConstraint.equivalenceDomainId
        ) {
          fail(
            "invalid-refinement",
            [...applicationPath, "allowedTokenPairs", pairIndex],
            "Equivalent-value mapping crosses value equivalence domains",
          );
        }
        const symbol = await createObservationRelationSymbol({
          sourceSymbolId: source.id,
          candidateSymbolId: candidate.id,
          ruleId: rule.id,
        });
        authorizedSymbols.set(symbol.id, symbol);
      }
      continue;
    }
    if (preimage.kind === "narrow-cardinality") {
      const constraint = constraintById.get(preimage.constraintId);
      if (
        constraint === undefined ||
        !rule.constraintIds.includes(constraint.id) ||
        !canonicalEqual(
          preimage.sourceCardinality,
          effectiveCardinality(constraint),
        ) ||
        !isCardinalitySubset(
          preimage.candidateCardinality,
          preimage.sourceCardinality,
        )
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Narrow-cardinality mapping does not match its contract constraint",
        );
      }
      const candidateSlots = new Set<Sha256Digest>();
      for (
        let mappingIndex = 0;
        mappingIndex < preimage.slotMappings.length;
        mappingIndex += 1
      ) {
        const mapping = preimage.slotMappings[mappingIndex];
        const source = requireTraceSymbol(
          sourceSymbols,
          mapping.sourceSymbolId,
          [...applicationPath, "slotMappings", mappingIndex, "sourceSymbolId"],
        );
        const candidate = requireTraceSymbol(
          candidateSymbols,
          mapping.candidateSymbolId,
          [
            ...applicationPath,
            "slotMappings",
            mappingIndex,
            "candidateSymbolId",
          ],
        );
        if (
          source?.kind !== "occurrence" ||
          source.constraintId !== constraint.id ||
          (candidate !== null &&
            (candidate.kind !== "occurrence" ||
              candidate.constraintId !== constraint.id)) ||
          (candidate !== null && candidateSlots.has(candidate.id))
        ) {
          fail(
            "invalid-refinement",
            [...applicationPath, "slotMappings", mappingIndex],
            "Narrow-cardinality mapping has an invalid or duplicate slot",
          );
        }
        if (candidate !== null) candidateSlots.add(candidate.id);
        const symbol = await createObservationRelationSymbol({
          sourceSymbolId: source.id,
          candidateSymbolId: candidate?.id ?? null,
          ruleId: rule.id,
        });
        authorizedSymbols.set(symbol.id, symbol);
      }
      continue;
    }
    if (preimage.kind === "omit-unobservable-internal-step") {
      const constraint = constraintById.get(preimage.constraintId);
      if (
        constraint === undefined ||
        constraint.visibility !== "internal-ordering" ||
        !rule.constraintIds.includes(constraint.id)
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Omission mapping does not target the rule's internal constraint",
        );
      }
      for (
        let symbolIndex = 0;
        symbolIndex < preimage.omittedSourceSymbolIds.length;
        symbolIndex += 1
      ) {
        const source = requireTraceSymbol(
          sourceSymbols,
          preimage.omittedSourceSymbolIds[symbolIndex],
          [...applicationPath, "omittedSourceSymbolIds", symbolIndex],
        );
        if (
          source?.kind !== "occurrence" ||
          source.constraintId !== constraint.id
        ) {
          fail(
            "invalid-refinement",
            [...applicationPath, "omittedSourceSymbolIds", symbolIndex],
            "Omission mapping references a symbol outside its constraint",
          );
        }
        const symbol = await createObservationRelationSymbol({
          sourceSymbolId: source.id,
          candidateSymbolId: null,
          ruleId: rule.id,
        });
        authorizedSymbols.set(symbol.id, symbol);
      }
      continue;
    }
    if (preimage.kind === "declared-event-coalescing") {
      const constraint = constraintById.get(preimage.constraintId);
      if (
        constraint === undefined ||
        (constraint.kind !== "event" &&
          constraint.kind !== "effect" &&
          constraint.kind !== "callback") ||
        !rule.constraintIds.includes(constraint.id) ||
        constraint.coalescingPolicyRequirement === null ||
        preimage.eventSlotMappings.length === 0
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Coalescing mapping does not match a declared event coalescing constraint",
        );
      }
      const mappedCandidateIds = new Set<Sha256Digest>();
      for (
        let mappingIndex = 0;
        mappingIndex < preimage.eventSlotMappings.length;
        mappingIndex += 1
      ) {
        const mapping = preimage.eventSlotMappings[mappingIndex];
        const source = requireTraceSymbol(
          sourceSymbols,
          mapping.sourceEventSymbolId,
          [
            ...applicationPath,
            "eventSlotMappings",
            mappingIndex,
            "sourceEventSymbolId",
          ],
        );
        const candidate = requireTraceSymbol(
          candidateSymbols,
          mapping.candidateOccurrenceSymbolId,
          [
            ...applicationPath,
            "eventSlotMappings",
            mappingIndex,
            "candidateOccurrenceSymbolId",
          ],
        );
        if (
          source?.kind !== "event" ||
          candidate?.kind !== "occurrence" ||
          candidate.constraintId !== constraint.id
        ) {
          fail(
            "invalid-refinement",
            [...applicationPath, "eventSlotMappings", mappingIndex],
            "Coalescing mapping must map source events to the declared candidate occurrence",
          );
        }
        mappedCandidateIds.add(candidate.id);
      }
      const candidateOccurrenceIds = sortedCopy(
        [...candidateSymbols.values()]
          .filter(
            (symbol) =>
              symbol.kind === "occurrence" &&
              symbol.constraintId === constraint.id,
          )
          .map(({ id }) => id),
        compareText,
      );
      if (
        !canonicalEqual(
          sortedCopy([...mappedCandidateIds], compareText),
          candidateOccurrenceIds,
        )
      ) {
        fail(
          "invalid-refinement",
          [...applicationPath, "eventSlotMappings"],
          "Coalescing mapping must cover every candidate occurrence slot",
        );
      }
      if (preimage.overflowTerminalSymbolId !== null) {
        const overflow = requireTraceSymbol(
          candidateSymbols,
          preimage.overflowTerminalSymbolId,
          [...applicationPath, "overflowTerminalSymbolId"],
        );
        if (overflow?.kind !== "terminal") {
          fail(
            "invalid-refinement",
            [...applicationPath, "overflowTerminalSymbolId"],
            "Coalescing overflow must reference a candidate terminal symbol",
          );
        }
      }
    }
    const descriptor = descriptorById.get(preimage.policyDescriptorId);
    const policyLanguage =
      descriptor === undefined
        ? undefined
        : policyLanguageById.get(
            descriptor.preimage.policyTransducerLanguageId,
          );
    if (
      descriptor === undefined ||
      policyLanguage === undefined ||
      descriptor.preimage.observationContractId !== input.contract.id ||
      descriptor.preimage.ruleId !== rule.id ||
      descriptor.preimage.inputClassId !== input.inputClassId ||
      descriptor.preimage.sourceTraceLanguageId !== input.sourceLanguage.id ||
      descriptor.preimage.candidateTraceLanguageId !==
        input.candidateLanguage.id
    ) {
      fail(
        "invalid-refinement",
        applicationPath,
        "Policy-backed rule application lacks its exact descriptor and transducer",
      );
    }
    if (preimage.kind === "declared-event-coalescing") {
      const constraint = constraintById.get(preimage.constraintId);
      const requirement =
        constraint !== undefined &&
        (constraint.kind === "event" ||
          constraint.kind === "effect" ||
          constraint.kind === "callback")
          ? constraint.coalescingPolicyRequirement
          : null;
      if (
        requirement === null ||
        descriptor.preimage.policyQualifiedId !==
          requirement.policyQualifiedId ||
        descriptor.preimage.version !== requirement.version ||
        descriptor.preimage.policyRuleGraphDigest !==
          requirement.policyRuleGraphDigest ||
        descriptor.preimage.proofDomainId !== requirement.proofDomainId
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Coalescing policy descriptor does not match the contract requirement",
        );
      }
    }
    if (preimage.kind === "commutative-reorder") {
      const context = compositionContextById.get(preimage.compositionId);
      const binding = context?.composition.preimage.bindings.find(
        ({ id }) => id === preimage.bindingId,
      );
      if (
        context === undefined ||
        binding === undefined ||
        binding.resolution.kind !== "commutative" ||
        !context.composition.preimage.memberContractIds.includes(
          input.contract.id,
        )
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Commutative application does not resolve to its contract's composition binding",
        );
      }
      const localConstraintIds = sortedCopy(
        binding.members
          .filter(({ contractId }) => contractId === input.contract.id)
          .map(({ constraintId }) => constraintId),
        compareText,
      );
      const requirement = binding.resolution.policyRequirement;
      if (
        !canonicalEqual(localConstraintIds, rule.constraintIds) ||
        descriptor.preimage.policyQualifiedId !==
          requirement.policyQualifiedId ||
        descriptor.preimage.version !== requirement.version ||
        descriptor.preimage.policyRuleGraphDigest !==
          requirement.policyRuleGraphDigest ||
        descriptor.preimage.proofDomainId !== requirement.proofDomainId
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Commutative rule constraints and policy identity do not match the binding",
        );
      }
      usedCompositionContextIds.add(context.composition.id);
    }
    for (const symbol of policyLanguage.preimage.alphabet) {
      if (symbol.ruleId !== rule.id) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Policy transducer contains a symbol for another rule",
        );
      }
      const sourceSymbol = requireTraceSymbol(
        sourceSymbols,
        symbol.sourceSymbolId,
        applicationPath,
      );
      const candidateSymbol = requireTraceSymbol(
        candidateSymbols,
        symbol.candidateSymbolId,
        applicationPath,
      );
      if (
        preimage.kind === "commutative-reorder" &&
        (sourceSymbol?.kind !== "occurrence" ||
          candidateSymbol?.kind !== "occurrence" ||
          !rule.constraintIds.includes(sourceSymbol.constraintId) ||
          !rule.constraintIds.includes(candidateSymbol.constraintId))
      ) {
        fail(
          "invalid-refinement",
          applicationPath,
          "Commutative policy symbols must be binding-local occurrence pairs",
        );
      }
      if (preimage.kind === "declared-event-coalescing") {
        const targetConstraint = constraintById.get(preimage.constraintId);
        const advancesTargetOccurrence =
          candidateSymbol?.kind === "occurrence" &&
          candidateSymbol.constraintId === targetConstraint?.id;
        const advancesDeclaredOverflow =
          candidateSymbol?.kind === "terminal" &&
          preimage.overflowTerminalSymbolId === candidateSymbol.id;
        if (
          sourceSymbol !== null ||
          (!advancesTargetOccurrence && !advancesDeclaredOverflow)
        ) {
          fail(
            "invalid-refinement",
            applicationPath,
            "Coalescing policy symbols may advance only target occurrences or the declared overflow terminal",
          );
        }
      }
      authorizedSymbols.set(symbol.id, symbol);
    }
    policies.push({
      ruleId: rule.id,
      language: policyLanguage,
      transitions: transitionTable(policyLanguage.preimage),
      acceptingStates: new Set(policyLanguage.preimage.acceptingStates),
    });
  }
  if (compositionContextById.size !== usedCompositionContextIds.size) {
    fail(
      "invalid-field",
      ["compositionContexts"],
      "Allowed relation derivation contains an unreferenced composition context",
    );
  }
  const alphabet = sortedCopy([...authorizedSymbols.values()], (left, right) =>
    compareText(left.id, right.id),
  );
  const sourceTransitions = transitionTable(input.sourceLanguage.preimage);
  const candidateTransitions = transitionTable(
    input.candidateLanguage.preimage,
  );
  const relationSymbolById = new Map(
    alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const start: number[] = [
    input.sourceLanguage.preimage.initialState,
    input.candidateLanguage.preimage.initialState,
    ...policies.map(({ language }) => language.preimage.initialState),
  ];
  const keyOf = (states: readonly number[]): string => states.join(",");
  const states: number[][] = [start];
  const stateIds = new Map<string, number>([[keyOf(start), 0]]);
  const acceptingStates: number[] = [];
  const transitions: ObservationAutomatonTransition[] = [];
  const sourceAccepting = new Set(
    input.sourceLanguage.preimage.acceptingStates,
  );
  const candidateAccepting = new Set(
    input.candidateLanguage.preimage.acceptingStates,
  );
  for (let cursor = 0; cursor < states.length; cursor += 1) {
    checkBudget(
      "maximumProductStateCount",
      budget.maximumProductStateCount,
      states.length,
    );
    const tuple = states[cursor];
    if (
      sourceAccepting.has(tuple[0]) &&
      candidateAccepting.has(tuple[1]) &&
      policies.every((policy, index) =>
        policy.acceptingStates.has(tuple[index + 2]),
      )
    ) {
      acceptingStates.push(cursor);
    }
    for (const alphabetSymbol of alphabet) {
      const relationSymbol = relationSymbolById.get(alphabetSymbol.id);
      if (relationSymbol === undefined) continue;
      const sourceTarget =
        relationSymbol.sourceSymbolId === null
          ? tuple[0]
          : sourceTransitions.get(tuple[0])?.get(relationSymbol.sourceSymbolId);
      const candidateTarget =
        relationSymbol.candidateSymbolId === null
          ? tuple[1]
          : candidateTransitions
              .get(tuple[1])
              ?.get(relationSymbol.candidateSymbolId);
      if (sourceTarget === undefined || candidateTarget === undefined) continue;
      const policyTargets: number[] = [];
      let rejectedByPolicy = false;
      for (
        let policyIndex = 0;
        policyIndex < policies.length;
        policyIndex += 1
      ) {
        const policy = policies[policyIndex];
        if (relationSymbol.ruleId !== policy.ruleId) {
          policyTargets.push(tuple[policyIndex + 2]);
          continue;
        }
        const policyTarget = policy.transitions
          .get(tuple[policyIndex + 2])
          ?.get(relationSymbol.id);
        if (policyTarget === undefined) {
          rejectedByPolicy = true;
          break;
        }
        policyTargets.push(policyTarget);
      }
      if (rejectedByPolicy) continue;
      const targetTuple = [sourceTarget, candidateTarget, ...policyTargets];
      const key = keyOf(targetTuple);
      let targetState = stateIds.get(key);
      if (targetState === undefined) {
        targetState = states.length;
        stateIds.set(key, targetState);
        states.push(targetTuple);
      }
      transitions.push({
        fromState: cursor,
        symbolId: relationSymbol.id,
        toState: targetState,
      });
    }
  }
  return await buildRelationLanguage(
    {
      alphabet,
      stateCount: states.length,
      initialState: 0,
      acceptingStates,
      transitions,
    },
    budget,
    null,
    [],
  );
}

/** Revalidates behavior and proof closure before accepting a relation. */
async function acceptObservationRelation(
  input: ObservationRelationAcceptanceInput,
): Promise<AcceptedObservationRelation> {
  const budget = readBudget(input.budget);
  const claim = await parseObservationComparisonClaim(input.claim);
  const contract = await parseObservationContract(input.contract);
  const sourceBehaviorAcceptance = await validateObservationBehaviorSummary(
    input.sourceBehavior,
  );
  const candidateBehaviorAcceptance = await validateObservationBehaviorSummary(
    input.candidateBehavior,
  );
  const sourceSummary = await parseObservationBehaviorSummary(
    input.sourceBehavior.summary,
  );
  const candidateSummary = await parseObservationBehaviorSummary(
    input.candidateBehavior.summary,
  );
  if (
    contract.preimage.relation !== "trace-refinement" ||
    claim.preimage.observationContractId !== contract.id ||
    claim.preimage.sourceSummaryId !== sourceSummary.id ||
    claim.preimage.candidateSummaryId !== candidateSummary.id ||
    sourceBehaviorAcceptance.preimage.observationContractId !== contract.id ||
    candidateBehaviorAcceptance.preimage.observationContractId !==
      contract.id ||
    sourceSummary.preimage.observationContractId !== contract.id ||
    candidateSummary.preimage.observationContractId !== contract.id ||
    sourceSummary.preimage.role !== "source" ||
    candidateSummary.preimage.role !== "candidate" ||
    sourceSummary.preimage.inputPartitionId !==
      candidateSummary.preimage.inputPartitionId
  ) {
    fail(
      "contract-mismatch",
      [],
      "Relation claim and accepted behaviors are not consistently bound",
    );
  }
  const claimInputClassIds = claim.preimage.inputClasses.map(
    ({ inputClassId }) => inputClassId,
  );
  const sourceInputClassIds = sourceSummary.preimage.inputClasses.map(
    ({ inputClassId }) => inputClassId,
  );
  const candidateInputClassIds = candidateSummary.preimage.inputClasses.map(
    ({ inputClassId }) => inputClassId,
  );
  if (
    !canonicalEqual(claimInputClassIds, sourceInputClassIds) ||
    !canonicalEqual(sourceInputClassIds, candidateInputClassIds)
  ) {
    fail(
      "contract-mismatch",
      ["claim", "preimage", "inputClasses"],
      "Relation claim must cover every accepted behavior input class",
    );
  }
  const traceLanguages = new Map<Sha256Digest, ObservationTraceLanguage>();
  for (const value of input.traceLanguages) {
    const language = await parseObservationTraceLanguage(value, budget);
    traceLanguages.set(language.id, language);
  }
  const actualRelations = new Map<Sha256Digest, ObservationRelationLanguage>();
  for (const value of input.actualRelationLanguages) {
    const language = await parseObservationRelationLanguage(value, budget);
    actualRelations.set(language.id, language);
  }
  const applications = new Map<Sha256Digest, ObservationRuleApplication>();
  for (let index = 0; index < input.ruleApplications.length; index += 1) {
    const application = await parseObservationRuleApplication(
      input.ruleApplications[index],
      ["ruleApplications", index],
    );
    if (applications.has(application.id)) {
      fail(
        "duplicate-record",
        ["ruleApplications", index],
        "Duplicate rule application",
      );
    }
    applications.set(application.id, application);
  }
  const policyDescriptors = new Map<
    Sha256Digest,
    ObservationRulePolicyDescriptor
  >();
  for (let index = 0; index < input.policyDescriptors.length; index += 1) {
    const descriptor = await parseObservationRulePolicyDescriptor(
      input.policyDescriptors[index],
    );
    if (policyDescriptors.has(descriptor.id)) {
      fail(
        "duplicate-record",
        ["policyDescriptors", index],
        "Duplicate policy descriptor",
      );
    }
    policyDescriptors.set(descriptor.id, descriptor);
  }
  const policyClaims: ObservationPolicyDerivationClaim[] = [];
  for (let index = 0; index < input.policyDerivationClaims.length; index += 1) {
    const policyClaim = await parseObservationPolicyDerivationClaim(
      input.policyDerivationClaims[index],
    );
    if (policyClaims.some(({ id }) => id === policyClaim.id)) {
      fail(
        "duplicate-record",
        ["policyDerivationClaims", index],
        "Duplicate policy claim",
      );
    }
    policyClaims.push(policyClaim);
  }
  const policyLanguages = new Map<Sha256Digest, ObservationRelationLanguage>();
  for (
    let index = 0;
    index < input.policyTransducerLanguages.length;
    index += 1
  ) {
    const language = await parseObservationRelationLanguage(
      input.policyTransducerLanguages[index],
      budget,
    );
    if (policyLanguages.has(language.id)) {
      fail(
        "duplicate-record",
        ["policyTransducerLanguages", index],
        "Duplicate policy language",
      );
    }
    policyLanguages.set(language.id, language);
  }
  const compositionContextById = await parseRelationCompositionContexts(
    input.compositionContexts,
  );
  const parsedAcceptances = await parseTrustedProofAcceptances(input);
  const trustedIds = new Set(input.trustedProofAcceptanceIds);
  const usedPolicyDescriptorIds = new Set<Sha256Digest>();
  const usedPolicyClaimIds = new Set<Sha256Digest>();
  const usedPolicyLanguageIds = new Set<Sha256Digest>();
  const usedApplicationIds = new Set<Sha256Digest>();
  const usedCompositionContextIds = new Set<Sha256Digest>();
  const acceptedClasses: Array<
    AcceptedObservationRelationPreimage["inputClasses"][number]
  > = [];
  for (
    let classIndex = 0;
    classIndex < claim.preimage.inputClasses.length;
    classIndex += 1
  ) {
    const classClaim = claim.preimage.inputClasses[classIndex];
    const classPath = [
      "claim",
      "preimage",
      "inputClasses",
      classIndex,
    ] as const;
    const sourceClass = sourceSummary.preimage.inputClasses.find(
      ({ inputClassId }) => inputClassId === classClaim.inputClassId,
    );
    const candidateClass = candidateSummary.preimage.inputClasses.find(
      ({ inputClassId }) => inputClassId === classClaim.inputClassId,
    );
    const sourceLanguage =
      sourceClass === undefined
        ? undefined
        : traceLanguages.get(sourceClass.traceLanguageId);
    const candidateLanguage =
      candidateClass === undefined
        ? undefined
        : traceLanguages.get(candidateClass.traceLanguageId);
    const actualRelation = actualRelations.get(
      classClaim.actualRelationLanguageId,
    );
    if (
      sourceLanguage === undefined ||
      candidateLanguage === undefined ||
      actualRelation === undefined
    ) {
      fail(
        "dangling-reference",
        classPath,
        "Relation claim references an unavailable class language",
      );
    }
    const classApplications = classClaim.ruleApplicationIds.map(
      (applicationId, applicationIndex) => {
        const application = applications.get(applicationId);
        if (application === undefined) {
          fail(
            "dangling-reference",
            [...classPath, "ruleApplicationIds", applicationIndex],
            "Relation claim references an unavailable rule application",
          );
        }
        usedApplicationIds.add(application.id);
        return application;
      },
    );
    const applicationAcceptanceIds = sortedCopy(
      classApplications.map(
        (application) =>
          requireParsedTrustedProofAcceptance(
            parsedAcceptances,
            trustedIds,
            application.preimage.proofDomainId,
            application.id,
            ["proofAcceptances", application.id],
          ).id,
      ),
      compareText,
    );
    if (
      !canonicalEqual(
        applicationAcceptanceIds,
        classClaim.ruleApplicationAcceptanceIds,
      )
    ) {
      fail(
        "missing-proof",
        [...classPath, "ruleApplicationAcceptanceIds"],
        "Comparison claim does not bind the exact application acceptances",
      );
    }
    const classCompositionContextById = new Map<
      Sha256Digest,
      ObservationRelationCompositionContext
    >();
    for (const application of classApplications) {
      if (
        application.preimage.kind !== "commutative-reorder" &&
        application.preimage.kind !== "declared-event-coalescing"
      ) {
        continue;
      }
      if (application.preimage.kind === "commutative-reorder") {
        const compositionContext = compositionContextById.get(
          application.preimage.compositionId,
        );
        if (
          claim.preimage.compositionId !== application.preimage.compositionId ||
          compositionContext === undefined
        ) {
          fail(
            "contract-mismatch",
            ["ruleApplications", application.id, "compositionId"],
            "Commutative application is not bound to the comparison composition context",
          );
        }
        classCompositionContextById.set(
          compositionContext.composition.id,
          compositionContext,
        );
        usedCompositionContextIds.add(compositionContext.composition.id);
      }
      const descriptor = policyDescriptors.get(
        application.preimage.policyDescriptorId,
      );
      const policyLanguage =
        descriptor === undefined
          ? undefined
          : policyLanguages.get(descriptor.preimage.policyTransducerLanguageId);
      const policyClaim =
        descriptor === undefined || policyLanguage === undefined
          ? undefined
          : policyClaims.find(
              ({ preimage }) =>
                preimage.policyDescriptorId === descriptor.id &&
                preimage.policyLanguageId === policyLanguage.id &&
                preimage.proofDomainId === descriptor.preimage.proofDomainId,
            );
      if (
        descriptor === undefined ||
        policyLanguage === undefined ||
        policyClaim === undefined
      ) {
        fail(
          "missing-proof",
          ["policyDerivationClaims", application.id],
          "Policy-backed application lacks its exact descriptor, language, and derivation claim",
        );
      }
      const policyAcceptance = requireParsedTrustedProofAcceptance(
        parsedAcceptances,
        trustedIds,
        descriptor.preimage.proofDomainId,
        policyClaim.id,
        ["proofAcceptances", application.preimage.policyAcceptanceId],
      );
      if (policyAcceptance.id !== application.preimage.policyAcceptanceId) {
        fail(
          "missing-proof",
          ["ruleApplications", application.id, "policyAcceptanceId"],
          "Rule application does not bind the exact policy derivation acceptance",
        );
      }
      usedPolicyDescriptorIds.add(descriptor.id);
      usedPolicyClaimIds.add(policyClaim.id);
      usedPolicyLanguageIds.add(policyLanguage.id);
    }
    const derivedAllowed = await deriveAllowedObservationRelationLanguage({
      contract,
      sourceSummary,
      candidateSummary,
      inputClassId: classClaim.inputClassId,
      sourceLanguage,
      candidateLanguage,
      ruleApplications: classApplications,
      policyDescriptors: input.policyDescriptors,
      policyTransducerLanguages: input.policyTransducerLanguages,
      compositionContexts: [...classCompositionContextById.values()],
      budget,
    });
    const sourceProjection = projectRelationAutomaton(
      actualRelation,
      "source",
      sourceLanguage,
      budget,
    );
    const candidateProjection = projectRelationAutomaton(
      actualRelation,
      "candidate",
      candidateLanguage,
      budget,
    );
    if (
      !normalizedTraceLanguageMatches(sourceProjection, sourceLanguage) ||
      !normalizedTraceLanguageMatches(candidateProjection, candidateLanguage)
    ) {
      fail(
        "language-mismatch",
        [...classPath, "actualRelationLanguageId"],
        "Actual relation projections do not equal both behavior languages",
      );
    }
    if (
      !isAutomatonLanguageSubset(
        actualRelation.preimage,
        derivedAllowed.preimage,
        budget,
      )
    ) {
      fail(
        "invalid-refinement",
        [...classPath, "actualRelationLanguageId"],
        "Actual relation is not included in the locally derived relation",
      );
    }
    acceptedClasses.push({
      inputClassId: classClaim.inputClassId,
      actualRelationLanguageId: actualRelation.id,
      derivedAllowedRelationLanguageId: derivedAllowed.id,
      ruleApplicationAcceptanceIds: applicationAcceptanceIds,
    });
  }
  if (
    (claim.preimage.compositionId === null) !==
    (usedCompositionContextIds.size === 0)
  ) {
    fail(
      "contract-mismatch",
      ["claim", "preimage", "compositionId"],
      "Comparison composition ID must exist exactly when a commutative application uses its context",
    );
  }
  if (
    applications.size !== usedApplicationIds.size ||
    policyDescriptors.size !== usedPolicyDescriptorIds.size ||
    policyClaims.length !== usedPolicyClaimIds.size ||
    policyLanguages.size !== usedPolicyLanguageIds.size ||
    compositionContextById.size !== usedCompositionContextIds.size
  ) {
    fail(
      "invalid-field",
      ["policyDescriptors"],
      "Relation acceptance closure contains unreferenced application, policy, or composition records",
    );
  }
  const preimage: AcceptedObservationRelationPreimage = {
    schema: "dathra.accepted-observation-relation/2",
    comparisonClaimId: claim.id,
    sourceBehaviorAcceptanceId: sourceBehaviorAcceptance.id,
    candidateBehaviorAcceptanceId: candidateBehaviorAcceptance.id,
    inputClasses: acceptedClasses,
  };
  return await contentAddressed(preimage);
}

function projectCompositionRelationAutomaton(
  relation: ObservationCompositionRelationLanguage,
  tape: number | "result",
  memberCount: number,
  target: ObservationTraceLanguage,
  budget: ObservationAutomatonBudget,
): NormalizedAutomaton<ObservationTraceSymbol> {
  const targetSymbols = new Map(
    target.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const relationSymbols = new Map(
    relation.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const epsilon = new Map<number, number[]>();
  const labelled = new Map<number, Map<Sha256Digest, number[]>>();
  for (let state = 0; state < relation.preimage.stateCount; state += 1) {
    epsilon.set(state, []);
    labelled.set(state, new Map());
  }
  for (const transition of relation.preimage.transitions) {
    const symbol = relationSymbols.get(transition.symbolId);
    if (symbol === undefined) {
      fail(
        "invalid-automaton",
        [],
        "Composition transition references an unknown relation symbol",
      );
    }
    if (symbol.memberSymbolIds.length !== memberCount) {
      fail(
        "language-mismatch",
        ["alphabet", symbol.id, "memberSymbolIds"],
        "Composition symbol member arity does not match the composition",
      );
    }
    const projectedId =
      tape === "result" ? symbol.resultSymbolId : symbol.memberSymbolIds[tape];
    if (projectedId === null) {
      epsilon.get(transition.fromState)?.push(transition.toState);
      continue;
    }
    if (!targetSymbols.has(projectedId)) {
      fail(
        "language-mismatch",
        ["alphabet", symbol.id],
        "Composition projection references a symbol outside its target language",
      );
    }
    const bySymbol = labelled.get(transition.fromState);
    if (bySymbol === undefined) {
      fail("invalid-automaton", [], "Missing composition relation state");
    }
    const targets = bySymbol.get(projectedId);
    if (targets === undefined) bySymbol.set(projectedId, [transition.toState]);
    else targets.push(transition.toState);
  }
  const closure = (states: ReadonlySet<number>): number[] => {
    const result = new Set(states);
    const queue = [...result];
    for (let cursor = 0; cursor < queue.length; cursor += 1) {
      for (const targetState of epsilon.get(queue[cursor]) ?? []) {
        if (!result.has(targetState)) {
          result.add(targetState);
          queue.push(targetState);
        }
      }
    }
    return [...result].sort((left, right) => left - right);
  };
  const keyOf = (states: readonly number[]): string => states.join(",");
  const start = closure(new Set([relation.preimage.initialState]));
  const subsets = [start];
  const subsetIds = new Map<string, number>([[keyOf(start), 0]]);
  const transitions: ObservationAutomatonTransition[] = [];
  const acceptingStates: number[] = [];
  const relationAccepting = new Set(relation.preimage.acceptingStates);
  for (let cursor = 0; cursor < subsets.length; cursor += 1) {
    const subset = subsets[cursor];
    if (subset.some((state) => relationAccepting.has(state))) {
      acceptingStates.push(cursor);
    }
    for (const symbol of target.preimage.alphabet) {
      const moved = new Set<number>();
      for (const state of subset) {
        for (const targetState of labelled.get(state)?.get(symbol.id) ?? []) {
          moved.add(targetState);
        }
      }
      const targetSubset = closure(moved);
      const key = keyOf(targetSubset);
      let targetState = subsetIds.get(key);
      if (targetState === undefined) {
        targetState = subsets.length;
        subsetIds.set(key, targetState);
        subsets.push(targetSubset);
        checkBudget(
          "maximumDeterminizedStateCount",
          budget.maximumDeterminizedStateCount,
          subsets.length,
        );
      }
      transitions.push({
        fromState: cursor,
        symbolId: symbol.id,
        toState: targetState,
      });
    }
  }
  return normalizeAutomaton(
    {
      alphabet: target.preimage.alphabet,
      stateCount: subsets.length,
      initialState: 0,
      acceptingStates,
      transitions,
    },
    budget,
  );
}

function traceSymbolMatchesComposedResult(
  memberSymbol: ObservationTraceSymbol,
  resultSymbol: ObservationTraceSymbol,
  mappedConstraintId: Sha256Digest | null,
): boolean {
  if (memberSymbol.kind !== resultSymbol.kind) return false;
  if (memberSymbol.kind === "event" && resultSymbol.kind === "event") {
    return canonicalEqual(memberSymbol, resultSymbol);
  }
  if (
    memberSymbol.kind === "occurrence" &&
    resultSymbol.kind === "occurrence"
  ) {
    return (
      mappedConstraintId === resultSymbol.constraintId &&
      memberSymbol.occurrenceIdentityDomainDigest ===
        resultSymbol.occurrenceIdentityDomainDigest &&
      memberSymbol.occurrenceOrdinal === resultSymbol.occurrenceOrdinal &&
      memberSymbol.observationTokenRelationDigest ===
        resultSymbol.observationTokenRelationDigest &&
      canonicalEqual(
        memberSymbol.inputEventSymbolIds,
        resultSymbol.inputEventSymbolIds,
      )
    );
  }
  if (memberSymbol.kind === "terminal" && resultSymbol.kind === "terminal") {
    return (
      mappedConstraintId === resultSymbol.constraintId &&
      memberSymbol.occurrenceOrdinal === resultSymbol.occurrenceOrdinal &&
      memberSymbol.outcome === resultSymbol.outcome
    );
  }
  return false;
}

interface CompositionPolicyRuntime {
  readonly bindingId: Sha256Digest;
  readonly language: ObservationCompositionRelationLanguage;
  readonly transitions: ReadonlyMap<number, ReadonlyMap<Sha256Digest, number>>;
  readonly acceptingStates: ReadonlySet<number>;
}

function nullableSymbolTuples(
  options: readonly (readonly (Sha256Digest | null)[])[],
  budget: ObservationAutomatonBudget,
): readonly (readonly (Sha256Digest | null)[])[] {
  let tuples: (Sha256Digest | null)[][] = [[]];
  for (const tapeOptions of options) {
    const next: (Sha256Digest | null)[][] = [];
    for (const tuple of tuples) {
      for (const symbolId of tapeOptions) {
        next.push([...tuple, symbolId]);
        checkBudget(
          "maximumAlphabetSize",
          budget.maximumAlphabetSize,
          next.length,
        );
      }
    }
    tuples = next;
  }
  return tuples;
}

/** Derives a class-local multi-tape relation from composition bindings and policies. */
async function deriveAllowedObservationCompositionRelationLanguage(
  input: ObservationCompositionRelationDerivationInput,
): Promise<ObservationCompositionRelationLanguage> {
  const budget = readBudget(input.budget);
  const parsedContracts: ObservationContract[] = [];
  for (const contract of input.memberContracts) {
    parsedContracts.push(await parseObservationContract(contract));
  }
  const composition = await parseObservationComposition(
    input.composition,
    parsedContracts,
  );
  const contractById = new Map(
    parsedContracts.map((contract) => [contract.id, contract]),
  );
  const orderedContracts = composition.preimage.memberContractIds.map(
    (contractId) => {
      const contract = contractById.get(contractId);
      if (contract === undefined) {
        fail(
          "contract-mismatch",
          ["memberContracts", contractId],
          "Composition member contract is unavailable",
        );
      }
      return contract;
    },
  );
  if (contractById.size !== orderedContracts.length) {
    fail(
      "contract-mismatch",
      ["memberContracts"],
      "Member contracts are not the exact composition contract set",
    );
  }
  if (input.memberLanguages.length !== orderedContracts.length) {
    fail(
      "language-mismatch",
      ["memberLanguages"],
      "Member language positions do not match supplied member contracts",
    );
  }
  const memberLanguages: ObservationTraceLanguage[] = [];
  for (let index = 0; index < input.memberLanguages.length; index += 1) {
    memberLanguages.push(
      await parseObservationTraceLanguage(input.memberLanguages[index], budget),
    );
  }
  const resultLanguage = await parseObservationTraceLanguage(
    input.resultLanguage,
    budget,
  );
  const expectedBindingIds = composition.preimage.bindings.map(({ id }) => id);
  if (!canonicalEqual(input.bindingIds, expectedBindingIds)) {
    fail(
      "contract-mismatch",
      ["bindingIds"],
      "Composition derivation does not bind the exact binding set",
    );
  }
  const memberIndexByContractId = new Map(
    orderedContracts.map((contract, index) => [contract.id, index]),
  );
  const mappingByReference = new Map(
    composition.preimage.memberToResult.map((mapping) => [
      constraintReferenceKey(mapping.member),
      mapping.resultConstraintId,
    ]),
  );
  const bindingByReference = new Map<string, ObservationCompositionBinding>();
  for (const binding of composition.preimage.bindings) {
    for (const member of binding.members) {
      bindingByReference.set(constraintReferenceKey(member), binding);
    }
  }
  const memberSymbols = memberLanguages.map(
    (language) =>
      new Map(language.preimage.alphabet.map((symbol) => [symbol.id, symbol])),
  );
  const resultSymbols = new Map(
    resultLanguage.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const authorizedSymbols = new Map<
    Sha256Digest,
    ObservationCompositionRelationSymbol
  >();
  const addAuthorizedSymbol = async (
    memberSymbolIds: readonly (Sha256Digest | null)[],
    resultSymbolId: Sha256Digest | null,
    bindingId: Sha256Digest | null,
  ): Promise<void> => {
    const symbol = await createObservationCompositionRelationSymbol({
      memberSymbolIds,
      resultSymbolId,
      bindingId,
    });
    authorizedSymbols.set(symbol.id, symbol);
    checkBudget(
      "maximumAlphabetSize",
      budget.maximumAlphabetSize,
      authorizedSymbols.size,
    );
  };

  for (const resultSymbol of resultLanguage.preimage.alphabet) {
    if (resultSymbol.kind === "event") {
      const synchronized = memberSymbols.map((symbols) => {
        const symbol = symbols.get(resultSymbol.id);
        return symbol !== undefined && canonicalEqual(symbol, resultSymbol)
          ? symbol.id
          : null;
      });
      if (synchronized.every((symbolId) => symbolId !== null)) {
        await addAuthorizedSymbol(synchronized, resultSymbol.id, null);
      }
      continue;
    }
    const mappings = composition.preimage.memberToResult.filter(
      ({ resultConstraintId }) =>
        resultConstraintId === resultSymbol.constraintId,
    );
    if (mappings.length === 0) continue;
    const bindings = new Map<Sha256Digest, ObservationCompositionBinding>();
    for (const mapping of mappings) {
      const binding = bindingByReference.get(
        constraintReferenceKey(mapping.member),
      );
      if (binding !== undefined) bindings.set(binding.id, binding);
    }
    if (bindings.size > 1) {
      fail(
        "composition-conflict",
        ["memberToResult", resultSymbol.constraintId],
        "One result symbol is controlled by more than one binding",
      );
    }
    const binding = bindings.size === 0 ? null : [...bindings.values()][0];
    const matchingByMapping = new Map<string, readonly Sha256Digest[]>();
    for (const mapping of mappings) {
      const memberIndex = memberIndexByContractId.get(
        mapping.member.contractId,
      );
      if (memberIndex === undefined) continue;
      const matches = memberLanguages[memberIndex].preimage.alphabet
        .filter((memberSymbol) =>
          traceSymbolMatchesComposedResult(
            memberSymbol,
            resultSymbol,
            mappingByReference.get(constraintReferenceKey(mapping.member)) ??
              null,
          ),
        )
        .filter(
          (memberSymbol) =>
            memberSymbol.kind !== "event" &&
            memberSymbol.constraintId === mapping.member.constraintId,
        )
        .map(({ id }) => id);
      matchingByMapping.set(constraintReferenceKey(mapping.member), matches);
    }
    if (binding === null) {
      for (const mapping of mappings) {
        const memberIndex = memberIndexByContractId.get(
          mapping.member.contractId,
        );
        if (memberIndex === undefined) continue;
        for (const symbolId of matchingByMapping.get(
          constraintReferenceKey(mapping.member),
        ) ?? []) {
          const tapes = memberLanguages.map(() => null as Sha256Digest | null);
          tapes[memberIndex] = symbolId;
          await addAuthorizedSymbol(tapes, resultSymbol.id, null);
        }
      }
      continue;
    }
    if (binding.resolution.kind === "merge-identical") {
      const options = memberLanguages.map((_, memberIndex) => {
        const members = binding.members.filter(
          ({ contractId }) =>
            memberIndexByContractId.get(contractId) === memberIndex,
        );
        if (members.length === 0) return [null] as const;
        return members.flatMap(
          (member) =>
            matchingByMapping.get(constraintReferenceKey(member)) ?? [],
        );
      });
      if (options.every((tapeOptions) => tapeOptions.length > 0)) {
        for (const tuple of nullableSymbolTuples(options, budget)) {
          await addAuthorizedSymbol(tuple, resultSymbol.id, binding.id);
        }
      }
      continue;
    }
    if (binding.resolution.kind === "exclusive-owner") {
      const ownerKey = constraintReferenceKey(binding.resolution.owner);
      const ownerIndex = memberIndexByContractId.get(
        binding.resolution.owner.contractId,
      );
      if (ownerIndex !== undefined) {
        for (const symbolId of matchingByMapping.get(ownerKey) ?? []) {
          const tapes = memberLanguages.map(() => null as Sha256Digest | null);
          tapes[ownerIndex] = symbolId;
          await addAuthorizedSymbol(tapes, resultSymbol.id, binding.id);
        }
      }
      for (const member of binding.members) {
        if (constraintReferenceKey(member) === ownerKey) continue;
        const memberIndex = memberIndexByContractId.get(member.contractId);
        if (memberIndex === undefined) continue;
        for (const symbolId of matchingByMapping.get(
          constraintReferenceKey(member),
        ) ?? []) {
          const tapes = memberLanguages.map(() => null as Sha256Digest | null);
          tapes[memberIndex] = symbolId;
          await addAuthorizedSymbol(tapes, null, binding.id);
        }
      }
    }
  }

  const descriptorById = new Map<
    Sha256Digest,
    ObservationCompositionAlgebraDescriptor
  >();
  for (let index = 0; index < input.algebraDescriptors.length; index += 1) {
    const descriptor = input.algebraDescriptors[index];
    const parsed =
      await parseObservationCompositionAlgebraDescriptor(descriptor);
    if (descriptorById.has(parsed.id)) {
      fail(
        "duplicate-record",
        ["algebraDescriptors", index],
        "Duplicate algebra descriptor",
      );
    }
    descriptorById.set(parsed.id, parsed);
  }
  const policyApplicationByBindingId = new Map<
    Sha256Digest,
    ObservationCompositionPolicyApplication
  >();
  for (let index = 0; index < input.policyApplications.length; index += 1) {
    const application = await parseObservationCompositionPolicyApplication(
      input.policyApplications[index],
    );
    if (policyApplicationByBindingId.has(application.preimage.bindingId)) {
      fail(
        "duplicate-record",
        ["policyApplications", index],
        "A binding has more than one class-local policy application",
      );
    }
    policyApplicationByBindingId.set(
      application.preimage.bindingId,
      application,
    );
  }
  const policyLanguageById = new Map<
    Sha256Digest,
    ObservationCompositionRelationLanguage
  >();
  for (
    let index = 0;
    index < input.policyTransducerLanguages.length;
    index += 1
  ) {
    const language = await parseObservationCompositionRelationLanguage(
      input.policyTransducerLanguages[index],
      budget,
    );
    if (policyLanguageById.has(language.id)) {
      fail(
        "duplicate-record",
        ["policyTransducerLanguages", index],
        "Duplicate policy language",
      );
    }
    policyLanguageById.set(language.id, language);
  }
  const usedDescriptorIds = new Set<Sha256Digest>();
  const usedPolicyLanguageIds = new Set<Sha256Digest>();
  const policies: CompositionPolicyRuntime[] = [];
  for (const binding of composition.preimage.bindings) {
    if (
      binding.resolution.kind !== "commutative" &&
      binding.resolution.kind !== "total-order"
    ) {
      if (policyApplicationByBindingId.has(binding.id)) {
        fail(
          "composition-conflict",
          ["policyApplications", binding.id],
          "A non-policy binding cannot have a policy application",
        );
      }
      continue;
    }
    const application = policyApplicationByBindingId.get(binding.id);
    const descriptor =
      application === undefined
        ? undefined
        : descriptorById.get(application.preimage.algebraDescriptorId);
    const policyLanguage =
      application === undefined
        ? undefined
        : policyLanguageById.get(application.preimage.policyLanguageId);
    const requirement = binding.resolution.policyRequirement;
    if (
      application === undefined ||
      descriptor === undefined ||
      policyLanguage === undefined ||
      application.preimage.compositionId !== composition.id ||
      application.preimage.inputClassId !== input.inputClassId ||
      !canonicalEqual(
        application.preimage.memberTraceLanguageIds,
        memberLanguages.map(({ id }) => id),
      ) ||
      application.preimage.resultTraceLanguageId !== resultLanguage.id ||
      descriptor.preimage.policyTransducerLanguageId !== policyLanguage.id ||
      descriptor.preimage.operationKind !== binding.resolution.kind ||
      descriptor.preimage.constraintKind !== binding.constraintKind ||
      descriptor.preimage.policyQualifiedId !== requirement.policyQualifiedId ||
      descriptor.preimage.version !== requirement.version ||
      descriptor.preimage.policyRuleGraphDigest !==
        requirement.policyRuleGraphDigest ||
      descriptor.preimage.proofDomainId !== requirement.proofDomainId
    ) {
      fail(
        "composition-conflict",
        ["bindings", binding.id, "resolution"],
        "Policy binding lacks its exact algebra descriptor and transducer",
      );
    }
    for (const symbol of policyLanguage.preimage.alphabet) {
      if (
        symbol.bindingId !== binding.id ||
        symbol.memberSymbolIds.length !== memberLanguages.length
      ) {
        fail(
          "composition-conflict",
          [
            "policyTransducerLanguages",
            policyLanguage.id,
            "alphabet",
            symbol.id,
          ],
          "Policy transducer symbol does not belong to its binding and member arity",
        );
      }
      const advancedMembers = symbol.memberSymbolIds.flatMap(
        (symbolId, memberIndex) =>
          symbolId === null ? [] : [{ memberIndex, symbolId }],
      );
      const advancedMember =
        advancedMembers.length === 1 ? advancedMembers[0] : null;
      const memberSymbol =
        advancedMember === null
          ? undefined
          : memberSymbols[advancedMember.memberIndex].get(
              advancedMember.symbolId,
            );
      const resultSymbol =
        symbol.resultSymbolId === null
          ? undefined
          : resultSymbols.get(symbol.resultSymbolId);
      const memberReference =
        advancedMember === null ||
        memberSymbol === undefined ||
        memberSymbol.kind === "event"
          ? undefined
          : binding.members.find(
              (member) =>
                member.contractId ===
                  orderedContracts[advancedMember.memberIndex].id &&
                member.constraintId === memberSymbol.constraintId,
            );
      const mappedConstraintId =
        memberReference === undefined
          ? undefined
          : mappingByReference.get(constraintReferenceKey(memberReference));
      if (
        advancedMembers.length !== 1 ||
        memberSymbol === undefined ||
        memberSymbol.kind === "event" ||
        resultSymbol === undefined ||
        resultSymbol.kind === "event" ||
        memberReference === undefined ||
        mappedConstraintId !== resultSymbol.constraintId ||
        !traceSymbolMatchesComposedResult(
          memberSymbol,
          resultSymbol,
          mappedConstraintId,
        )
      ) {
        fail(
          "composition-conflict",
          [
            "policyTransducerLanguages",
            policyLanguage.id,
            "alphabet",
            symbol.id,
          ],
          "Policy transducer symbol is not local to its binding member-to-result mapping",
        );
      }
      authorizedSymbols.set(symbol.id, symbol);
    }
    usedDescriptorIds.add(descriptor.id);
    usedPolicyLanguageIds.add(policyLanguage.id);
    policies.push({
      bindingId: binding.id,
      language: policyLanguage,
      transitions: transitionTable(policyLanguage.preimage),
      acceptingStates: new Set(policyLanguage.preimage.acceptingStates),
    });
  }
  const policyBindingCount = composition.preimage.bindings.filter(
    ({ resolution }) =>
      resolution.kind === "commutative" || resolution.kind === "total-order",
  ).length;
  if (
    policyApplicationByBindingId.size !== policyBindingCount ||
    descriptorById.size !== usedDescriptorIds.size ||
    policyLanguageById.size !== usedPolicyLanguageIds.size
  ) {
    fail(
      "composition-conflict",
      ["policyApplications"],
      "Composition policy derivation contains missing or unreferenced records",
    );
  }

  const alphabet = sortedCopy([...authorizedSymbols.values()], (left, right) =>
    compareText(left.id, right.id),
  );
  const memberTransitions = memberLanguages.map(({ preimage }) =>
    transitionTable(preimage),
  );
  const resultTransitions = transitionTable(resultLanguage.preimage);
  const start = [
    ...memberLanguages.map(({ preimage }) => preimage.initialState),
    resultLanguage.preimage.initialState,
    ...policies.map(({ language }) => language.preimage.initialState),
  ];
  const resultStateIndex = memberLanguages.length;
  const policyStateOffset = resultStateIndex + 1;
  const keyOf = (states: readonly number[]): string => states.join(",");
  const states: number[][] = [start];
  const stateIds = new Map<string, number>([[keyOf(start), 0]]);
  const acceptingStates: number[] = [];
  const transitions: ObservationAutomatonTransition[] = [];
  const memberAccepting = memberLanguages.map(
    ({ preimage }) => new Set(preimage.acceptingStates),
  );
  const resultAccepting = new Set(resultLanguage.preimage.acceptingStates);
  for (let cursor = 0; cursor < states.length; cursor += 1) {
    checkBudget(
      "maximumProductStateCount",
      budget.maximumProductStateCount,
      states.length,
    );
    const tuple = states[cursor];
    if (
      memberAccepting.every((accepting, index) =>
        accepting.has(tuple[index]),
      ) &&
      resultAccepting.has(tuple[resultStateIndex]) &&
      policies.every((policy, index) =>
        policy.acceptingStates.has(tuple[policyStateOffset + index]),
      )
    ) {
      acceptingStates.push(cursor);
    }
    for (const symbol of alphabet) {
      const memberTargets: number[] = [];
      let rejected = false;
      for (
        let memberIndex = 0;
        memberIndex < memberLanguages.length;
        memberIndex += 1
      ) {
        const symbolId = symbol.memberSymbolIds[memberIndex];
        const target =
          symbolId === null
            ? tuple[memberIndex]
            : memberTransitions[memberIndex]
                .get(tuple[memberIndex])
                ?.get(symbolId);
        if (target === undefined) {
          rejected = true;
          break;
        }
        memberTargets.push(target);
      }
      if (rejected) continue;
      const resultTarget =
        symbol.resultSymbolId === null
          ? tuple[resultStateIndex]
          : resultTransitions
              .get(tuple[resultStateIndex])
              ?.get(symbol.resultSymbolId);
      if (resultTarget === undefined) continue;
      const policyTargets: number[] = [];
      for (
        let policyIndex = 0;
        policyIndex < policies.length;
        policyIndex += 1
      ) {
        const policy = policies[policyIndex];
        const target =
          symbol.bindingId === policy.bindingId
            ? policy.transitions
                .get(tuple[policyStateOffset + policyIndex])
                ?.get(symbol.id)
            : tuple[policyStateOffset + policyIndex];
        if (target === undefined) {
          rejected = true;
          break;
        }
        policyTargets.push(target);
      }
      if (rejected) continue;
      const targetTuple = [...memberTargets, resultTarget, ...policyTargets];
      const key = keyOf(targetTuple);
      let targetState = stateIds.get(key);
      if (targetState === undefined) {
        targetState = states.length;
        stateIds.set(key, targetState);
        states.push(targetTuple);
      }
      transitions.push({
        fromState: cursor,
        symbolId: symbol.id,
        toState: targetState,
      });
    }
  }
  return await buildCompositionRelationLanguage(
    {
      alphabet,
      stateCount: states.length,
      initialState: 0,
      acceptingStates,
      transitions,
    },
    budget,
    null,
    [],
  );
}

/** Revalidates all behavior and relation closure before accepting a composition. */
async function acceptObservationComposition(
  input: ObservationCompositionAcceptanceInput,
): Promise<AcceptedObservationComposition> {
  const budget = readBudget(input.budget);
  const memberContracts: ObservationContract[] = [];
  for (const contract of input.memberContracts) {
    memberContracts.push(await parseObservationContract(contract));
  }
  const composition = await parseObservationComposition(
    input.composition,
    memberContracts,
  );
  const claim = await parseObservationCompositionClaim(input.claim);
  const memberBehaviorAcceptances: AcceptedObservationBehavior[] = [];
  const memberSummaries: ObservationBehaviorSummary[] = [];
  for (const behavior of input.memberBehaviors) {
    memberBehaviorAcceptances.push(
      await validateObservationBehaviorSummary(behavior),
    );
    memberSummaries.push(
      await parseObservationBehaviorSummary(behavior.summary),
    );
  }
  const resultBehaviorAcceptance = await validateObservationBehaviorSummary(
    input.resultBehavior,
  );
  const resultSummary = await parseObservationBehaviorSummary(
    input.resultBehavior.summary,
  );
  const behaviorByContractId = new Map<
    Sha256Digest,
    {
      readonly summary: ObservationBehaviorSummary;
      readonly acceptance: AcceptedObservationBehavior;
    }
  >();
  for (let index = 0; index < memberSummaries.length; index += 1) {
    const summary = memberSummaries[index];
    if (behaviorByContractId.has(summary.preimage.observationContractId)) {
      fail(
        "duplicate-record",
        ["memberBehaviors", index],
        "Duplicate member behavior contract",
      );
    }
    behaviorByContractId.set(summary.preimage.observationContractId, {
      summary,
      acceptance: memberBehaviorAcceptances[index],
    });
  }
  const orderedBehaviors = composition.preimage.memberContractIds.map(
    (contractId) => {
      const behavior = behaviorByContractId.get(contractId);
      if (behavior === undefined) {
        fail(
          "contract-mismatch",
          ["memberBehaviors", contractId],
          "Composition member has no accepted behavior",
        );
      }
      return behavior;
    },
  );
  if (
    behaviorByContractId.size !== orderedBehaviors.length ||
    claim.preimage.compositionId !== composition.id ||
    claim.preimage.resultContractId !==
      composition.preimage.resultContract.id ||
    claim.preimage.resultSummaryId !== resultSummary.id ||
    !canonicalEqual(
      claim.preimage.memberSummaryIds,
      orderedBehaviors.map(({ summary }) => summary.id),
    ) ||
    resultSummary.preimage.observationContractId !==
      composition.preimage.resultContract.id ||
    resultSummary.preimage.role !== "candidate" ||
    orderedBehaviors.some(({ summary }) => summary.preimage.role !== "source")
  ) {
    fail(
      "contract-mismatch",
      ["claim"],
      "Composition claim, contracts, and accepted behaviors are not consistently bound",
    );
  }
  const inputPartitionId = resultSummary.preimage.inputPartitionId;
  const expectedInputClassIds = resultSummary.preimage.inputClasses.map(
    ({ inputClassId }) => inputClassId,
  );
  if (
    orderedBehaviors.some(
      ({ summary }) =>
        summary.preimage.inputPartitionId !== inputPartitionId ||
        !canonicalEqual(
          summary.preimage.inputClasses.map(({ inputClassId }) => inputClassId),
          expectedInputClassIds,
        ),
    ) ||
    !canonicalEqual(
      claim.preimage.inputClasses.map(({ inputClassId }) => inputClassId),
      expectedInputClassIds,
    )
  ) {
    fail(
      "language-mismatch",
      ["claim", "preimage", "inputClasses"],
      "Composition behaviors do not share one exact input partition",
    );
  }
  const traceLanguages = new Map<Sha256Digest, ObservationTraceLanguage>();
  for (const language of input.traceLanguages) {
    const parsed = await parseObservationTraceLanguage(language, budget);
    traceLanguages.set(parsed.id, parsed);
  }
  const actualRelations = new Map<
    Sha256Digest,
    ObservationCompositionRelationLanguage
  >();
  for (const language of input.actualRelationLanguages) {
    const parsed = await parseObservationCompositionRelationLanguage(
      language,
      budget,
    );
    actualRelations.set(parsed.id, parsed);
  }
  const expectedBindingIds = composition.preimage.bindings.map(({ id }) => id);
  const bindingById = new Map(
    composition.preimage.bindings.map((binding) => [binding.id, binding]),
  );
  const expectedPolicyBindingIds = composition.preimage.bindings.flatMap(
    (binding) =>
      binding.resolution.kind === "commutative" ||
      binding.resolution.kind === "total-order"
        ? [binding.id]
        : [],
  );
  const parsedAcceptances = await parseTrustedProofAcceptances(input);
  const trustedAcceptanceIds = new Set(input.trustedProofAcceptanceIds);
  const policyApplicationById = new Map<
    Sha256Digest,
    ObservationCompositionPolicyApplication
  >();
  for (let index = 0; index < input.policyApplications.length; index += 1) {
    const application = await parseObservationCompositionPolicyApplication(
      input.policyApplications[index],
    );
    if (policyApplicationById.has(application.id)) {
      fail(
        "duplicate-record",
        ["policyApplications", index],
        "Duplicate policy application",
      );
    }
    policyApplicationById.set(application.id, application);
  }
  const descriptorById = new Map<
    Sha256Digest,
    ObservationCompositionAlgebraDescriptor
  >();
  for (let index = 0; index < input.algebraDescriptors.length; index += 1) {
    const descriptor = await parseObservationCompositionAlgebraDescriptor(
      input.algebraDescriptors[index],
    );
    if (descriptorById.has(descriptor.id)) {
      fail(
        "duplicate-record",
        ["algebraDescriptors", index],
        "Duplicate algebra descriptor",
      );
    }
    descriptorById.set(descriptor.id, descriptor);
  }
  const policyClaimById = new Map<
    Sha256Digest,
    ObservationCompositionPolicyDerivationClaim
  >();
  for (let index = 0; index < input.policyDerivationClaims.length; index += 1) {
    const policyClaim = await parseObservationCompositionPolicyDerivationClaim(
      input.policyDerivationClaims[index],
    );
    if (policyClaimById.has(policyClaim.id)) {
      fail(
        "duplicate-record",
        ["policyDerivationClaims", index],
        "Duplicate policy claim",
      );
    }
    policyClaimById.set(policyClaim.id, policyClaim);
  }
  const policyLanguageById = new Map<
    Sha256Digest,
    ObservationCompositionRelationLanguage
  >();
  for (
    let index = 0;
    index < input.policyTransducerLanguages.length;
    index += 1
  ) {
    const language = await parseObservationCompositionRelationLanguage(
      input.policyTransducerLanguages[index],
      budget,
    );
    if (policyLanguageById.has(language.id)) {
      fail(
        "duplicate-record",
        ["policyTransducerLanguages", index],
        "Duplicate policy language",
      );
    }
    policyLanguageById.set(language.id, language);
  }
  const usedPolicyApplicationIds = new Set<Sha256Digest>();
  const usedDescriptorIds = new Set<Sha256Digest>();
  const usedPolicyClaimIds = new Set<Sha256Digest>();
  const usedPolicyLanguageIds = new Set<Sha256Digest>();
  const usedPolicyAcceptanceIds = new Set<Sha256Digest>();
  const acceptedClasses: Array<
    AcceptedObservationCompositionPreimage["inputClasses"][number]
  > = [];
  for (
    let classIndex = 0;
    classIndex < claim.preimage.inputClasses.length;
    classIndex += 1
  ) {
    const classClaim = claim.preimage.inputClasses[classIndex];
    const classPath = [
      "claim",
      "preimage",
      "inputClasses",
      classIndex,
    ] as const;
    const memberTraceLanguageIds = orderedBehaviors.map(({ summary }) => {
      const entry = summary.preimage.inputClasses.find(
        ({ inputClassId }) => inputClassId === classClaim.inputClassId,
      );
      if (entry === undefined) {
        fail(
          "language-mismatch",
          classPath,
          "Member behavior is missing the input class",
        );
      }
      return entry.traceLanguageId;
    });
    const resultEntry = resultSummary.preimage.inputClasses.find(
      ({ inputClassId }) => inputClassId === classClaim.inputClassId,
    );
    if (
      resultEntry === undefined ||
      !canonicalEqual(
        classClaim.memberTraceLanguageIds,
        memberTraceLanguageIds,
      ) ||
      classClaim.resultTraceLanguageId !== resultEntry.traceLanguageId ||
      !canonicalEqual(classClaim.bindingIds, expectedBindingIds)
    ) {
      fail(
        "contract-mismatch",
        classPath,
        "Composition class does not bind the exact languages, bindings, and policies",
      );
    }
    if (
      !canonicalEqual(
        classClaim.policyClosures.map(({ bindingId }) => bindingId),
        expectedPolicyBindingIds,
      )
    ) {
      fail(
        "contract-mismatch",
        [...classPath, "policyClosures"],
        "Composition class must have exactly one closure for every policy binding",
      );
    }
    const classPolicyApplications: ObservationCompositionPolicyApplication[] =
      [];
    const classDescriptors: ObservationCompositionAlgebraDescriptor[] = [];
    const classPolicyLanguages: ObservationCompositionRelationLanguage[] = [];
    for (
      let closureIndex = 0;
      closureIndex < classClaim.policyClosures.length;
      closureIndex += 1
    ) {
      const closure = classClaim.policyClosures[closureIndex];
      const closurePath = [
        ...classPath,
        "policyClosures",
        closureIndex,
      ] as const;
      const binding = bindingById.get(closure.bindingId);
      const application = policyApplicationById.get(
        closure.policyApplicationId,
      );
      const policyClaim = policyClaimById.get(closure.policyDerivationClaimId);
      const descriptor =
        application === undefined
          ? undefined
          : descriptorById.get(application.preimage.algebraDescriptorId);
      const policyLanguage =
        application === undefined
          ? undefined
          : policyLanguageById.get(application.preimage.policyLanguageId);
      if (
        binding === undefined ||
        (binding.resolution.kind !== "commutative" &&
          binding.resolution.kind !== "total-order") ||
        application === undefined ||
        policyClaim === undefined ||
        descriptor === undefined ||
        policyLanguage === undefined
      ) {
        fail(
          "dangling-reference",
          closurePath,
          "Composition policy closure contains an unavailable or non-policy record",
        );
      }
      const requirement = binding.resolution.policyRequirement;
      if (
        application.preimage.compositionId !== composition.id ||
        application.preimage.inputClassId !== classClaim.inputClassId ||
        !canonicalEqual(
          application.preimage.memberTraceLanguageIds,
          memberTraceLanguageIds,
        ) ||
        application.preimage.resultTraceLanguageId !==
          resultEntry.traceLanguageId ||
        application.preimage.bindingId !== binding.id ||
        application.preimage.algebraDescriptorId !== descriptor.id ||
        application.preimage.policyLanguageId !== policyLanguage.id ||
        descriptor.preimage.policyTransducerLanguageId !== policyLanguage.id ||
        descriptor.preimage.operationKind !== binding.resolution.kind ||
        descriptor.preimage.constraintKind !== binding.constraintKind ||
        descriptor.preimage.policyQualifiedId !==
          requirement.policyQualifiedId ||
        descriptor.preimage.version !== requirement.version ||
        descriptor.preimage.policyRuleGraphDigest !==
          requirement.policyRuleGraphDigest ||
        descriptor.preimage.proofDomainId !== requirement.proofDomainId ||
        policyClaim.preimage.policyApplicationId !== application.id ||
        policyClaim.preimage.algebraDescriptorId !== descriptor.id ||
        policyClaim.preimage.policyLanguageId !== policyLanguage.id ||
        policyClaim.preimage.proofDomainId !== descriptor.preimage.proofDomainId
      ) {
        fail(
          "contract-mismatch",
          closurePath,
          "Composition policy closure is not exact for its binding and class languages",
        );
      }
      const acceptance = requireParsedTrustedProofAcceptance(
        parsedAcceptances,
        trustedAcceptanceIds,
        policyClaim.preimage.proofDomainId,
        policyClaim.id,
        [...closurePath, "policyAcceptanceId"],
      );
      if (acceptance.id !== closure.policyAcceptanceId) {
        fail(
          "missing-proof",
          [...closurePath, "policyAcceptanceId"],
          "Composition policy closure does not bind the exact trusted acceptance",
        );
      }
      usedPolicyApplicationIds.add(application.id);
      usedDescriptorIds.add(descriptor.id);
      usedPolicyClaimIds.add(policyClaim.id);
      usedPolicyLanguageIds.add(policyLanguage.id);
      usedPolicyAcceptanceIds.add(acceptance.id);
      classPolicyApplications.push(application);
      classDescriptors.push(descriptor);
      classPolicyLanguages.push(policyLanguage);
    }
    const memberLanguages = memberTraceLanguageIds.map(
      (languageId, memberIndex) => {
        const language = traceLanguages.get(languageId);
        if (language === undefined) {
          fail(
            "dangling-reference",
            [...classPath, "memberTraceLanguageIds", memberIndex],
            "Member trace language is unavailable",
          );
        }
        return language;
      },
    );
    const resultLanguage = traceLanguages.get(resultEntry.traceLanguageId);
    const actualRelation = actualRelations.get(
      classClaim.actualRelationLanguageId,
    );
    if (resultLanguage === undefined || actualRelation === undefined) {
      fail(
        "dangling-reference",
        classPath,
        "Composition class references an unavailable result or relation language",
      );
    }
    const derivedAllowed =
      await deriveAllowedObservationCompositionRelationLanguage({
        composition,
        memberContracts,
        inputClassId: classClaim.inputClassId,
        memberLanguages,
        resultLanguage,
        bindingIds: classClaim.bindingIds,
        policyApplications: classPolicyApplications,
        algebraDescriptors: classDescriptors,
        policyTransducerLanguages: classPolicyLanguages,
        budget,
      });
    for (
      let memberIndex = 0;
      memberIndex < memberLanguages.length;
      memberIndex += 1
    ) {
      const projection = projectCompositionRelationAutomaton(
        actualRelation,
        memberIndex,
        memberLanguages.length,
        memberLanguages[memberIndex],
        budget,
      );
      if (
        !normalizedTraceLanguageMatches(
          projection,
          memberLanguages[memberIndex],
        )
      ) {
        fail(
          "language-mismatch",
          [...classPath, "actualRelationLanguageId"],
          "Actual relation member projection does not equal its behavior language",
        );
      }
    }
    const resultProjection = projectCompositionRelationAutomaton(
      actualRelation,
      "result",
      memberLanguages.length,
      resultLanguage,
      budget,
    );
    if (!normalizedTraceLanguageMatches(resultProjection, resultLanguage)) {
      fail(
        "language-mismatch",
        [...classPath, "actualRelationLanguageId"],
        "Actual relation result projection does not equal its behavior language",
      );
    }
    if (
      !isAutomatonLanguageSubset(
        actualRelation.preimage,
        derivedAllowed.preimage,
        budget,
      )
    ) {
      fail(
        "invalid-refinement",
        [...classPath, "actualRelationLanguageId"],
        "Actual relation is not included in the derived composition relation",
      );
    }
    acceptedClasses.push({
      inputClassId: classClaim.inputClassId,
      actualRelationLanguageId: actualRelation.id,
      derivedAllowedRelationLanguageId: derivedAllowed.id,
      policyClosures: classClaim.policyClosures,
    });
  }
  if (
    policyApplicationById.size !== usedPolicyApplicationIds.size ||
    descriptorById.size !== usedDescriptorIds.size ||
    policyClaimById.size !== usedPolicyClaimIds.size ||
    policyLanguageById.size !== usedPolicyLanguageIds.size ||
    parsedAcceptances.size !== usedPolicyAcceptanceIds.size ||
    trustedAcceptanceIds.size !== usedPolicyAcceptanceIds.size
  ) {
    fail(
      "invalid-field",
      ["policyApplications"],
      "Composition acceptance closure contains unreferenced policy records",
    );
  }
  return await contentAddressed({
    schema: "dathra.accepted-observation-composition/2",
    compositionClaimId: claim.id,
    memberBehaviorAcceptanceIds: orderedBehaviors.map(
      ({ acceptance }) => acceptance.id,
    ),
    resultBehaviorAcceptanceId: resultBehaviorAcceptance.id,
    inputClasses: acceptedClasses,
  });
}

function automatonAcceptsWord<Symbol extends { readonly id: Sha256Digest }>(
  automaton: AutomatonInput<Symbol>,
  word: readonly Sha256Digest[],
): boolean {
  const transitions = transitionTable(automaton);
  let state = automaton.initialState;
  for (const symbolId of word) {
    const target = transitions.get(state)?.get(symbolId);
    if (target === undefined) return false;
    state = target;
  }
  return automaton.acceptingStates.includes(state);
}

function hasArtifactAncestor(
  step: RealizationStep,
  stepById: ReadonlyMap<Sha256Digest, RealizationStep>,
  visiting: Set<Sha256Digest>,
): boolean {
  if (step.kind === "artifact-token") return true;
  if (step.inputStepIds.length === 0 || visiting.has(step.id)) return false;
  visiting.add(step.id);
  const valid = step.inputStepIds.every((inputStepId) => {
    const inputStep = stepById.get(inputStepId);
    return (
      inputStep !== undefined &&
      hasArtifactAncestor(inputStep, stepById, visiting)
    );
  });
  visiting.delete(step.id);
  return valid;
}

/** Validates a concrete witness against every accepted symbolic and proof closure. */
async function validateRealizationWitness(
  value: RealizationWitness,
  context: RealizationWitnessValidationContext,
): Promise<void> {
  const witness = await parseRealizationWitness(value);
  const acceptedRelation = await acceptObservationRelation(
    context.relationAcceptanceInput,
  );
  const acceptedCoverage = await validateRealizationCoverageClaim(
    context.coverageValidationInput,
  );
  if (
    acceptedRelation.id !== context.acceptedObservationRelation.id ||
    acceptedCoverage.id !== context.acceptedCoverage.id
  ) {
    fail(
      "contract-mismatch",
      [],
      "Supplied accepted records do not match their revalidated closure",
    );
  }
  const contract = await parseObservationContract(
    context.coverageValidationInput.behavior.contract,
  );
  const summary = await parseObservationBehaviorSummary(
    context.coverageValidationInput.behavior.summary,
  );
  const relationCandidateSummary = await parseObservationBehaviorSummary(
    context.relationAcceptanceInput.candidateBehavior.summary,
  );
  const coverageClaim = await parseRealizationCoverageClaim(
    context.coverageValidationInput.claim,
  );
  const template = await parseRealizationWitnessTemplate(context.template);
  const sequenceLanguage = await parseRealizationSequenceLanguage(
    context.sequenceLanguage,
    context.coverageValidationInput.budget,
  );
  const sequenceClaim = await parseRealizationSequenceClaim(
    context.sequenceClaim,
  );
  const parserProfile = await parseCanonicalParserProfile(
    context.parserProfile,
  );
  const baseUrlClaim = await parseCanonicalBaseUrlClaim(context.baseUrlClaim);
  const witnessPreimage = witness.preimage;
  const templatePreimage = template.preimage;
  const sequencePreimage = sequenceClaim.preimage;
  const profilePreimage = parserProfile.preimage;
  const assignment = coverageClaim.preimage.templates.find(
    ({ inputClassId }) => inputClassId === witnessPreimage.inputClassId,
  );
  if (
    relationCandidateSummary.id !== summary.id ||
    witnessPreimage.observationContractId !== contract.id ||
    witnessPreimage.behaviorSummaryId !== summary.id ||
    witnessPreimage.acceptedObservationRelationId !== acceptedRelation.id ||
    witnessPreimage.acceptedCoverageId !== acceptedCoverage.id ||
    witnessPreimage.coverageClaimId !== coverageClaim.id ||
    witnessPreimage.coverageAcceptanceId !==
      acceptedCoverage.preimage.coverageAcceptanceId ||
    witnessPreimage.witnessTemplateId !== template.id ||
    assignment?.witnessTemplateId !== template.id ||
    !acceptedCoverage.preimage.witnessTemplateIds.includes(template.id) ||
    templatePreimage.observationContractId !== contract.id ||
    templatePreimage.behaviorSummaryId !== summary.id ||
    templatePreimage.inputClassId !== witnessPreimage.inputClassId ||
    sequencePreimage.witnessTemplateId !== template.id ||
    sequencePreimage.observationContractId !== contract.id ||
    sequencePreimage.behaviorSummaryId !== summary.id ||
    sequencePreimage.inputClassId !== witnessPreimage.inputClassId ||
    witnessPreimage.realizationSequenceClaimId !== sequenceClaim.id ||
    witnessPreimage.realizationInputDigest !==
      sequencePreimage.realizationInputDigest
  ) {
    fail(
      "contract-mismatch",
      [],
      "Witness does not bind the accepted relation, coverage, template, and sequence closure",
    );
  }
  if (
    templatePreimage.sequenceLanguageId !== sequenceLanguage.id ||
    templatePreimage.parserProfileId !== parserProfile.id ||
    sequencePreimage.parserProfileId !== parserProfile.id ||
    witnessPreimage.parserProfileId !== parserProfile.id
  ) {
    fail(
      "contract-mismatch",
      ["parserProfileId"],
      "Witness artifacts do not reference the same parser profile and sequence language",
    );
  }
  const parsedAcceptances = await parseTrustedProofAcceptances(context);
  const trustedAcceptanceIds = new Set(context.trustedProofAcceptanceIds);
  const sequenceAcceptance = requireParsedTrustedProofAcceptance(
    parsedAcceptances,
    trustedAcceptanceIds,
    profilePreimage.sequenceProofDomainId,
    sequenceClaim.id,
    ["proofAcceptances", "sequenceClaim"],
  );
  const baseUrlAcceptance = requireParsedTrustedProofAcceptance(
    parsedAcceptances,
    trustedAcceptanceIds,
    profilePreimage.baseUrlProofDomainId,
    baseUrlClaim.id,
    ["proofAcceptances", "baseUrlClaim"],
  );
  if (
    witnessPreimage.sequenceAcceptanceId !== sequenceAcceptance.id ||
    witnessPreimage.baseUrlAcceptanceId !== baseUrlAcceptance.id
  ) {
    fail(
      "missing-proof",
      ["proofAcceptances"],
      "Witness does not bind the exact sequence and base URL acceptances",
    );
  }
  const expectedObligationIds = templatePreimage.obligations.map(
    ({ id }) => id,
  );
  if (!canonicalEqual(sequencePreimage.obligationIds, expectedObligationIds)) {
    fail(
      "unproven-obligation",
      ["sequenceClaim", "preimage", "obligationIds"],
      "Sequence claim does not cover the exact template obligations",
    );
  }
  const outputByObligationId = new Map(
    sequencePreimage.obligationOutputs.map((output) => [
      output.obligationId,
      output.outputStepId,
    ]),
  );
  if (outputByObligationId.size !== expectedObligationIds.length) {
    fail(
      "unproven-obligation",
      ["sequenceClaim", "preimage", "obligationOutputs"],
      "Each template obligation must have exactly one output",
    );
  }
  const stepById = new Map(
    sequencePreimage.steps.map((step) => [step.id, step]),
  );
  const templateSymbolById = new Map(
    sequenceLanguage.preimage.alphabet.map((symbol) => [symbol.id, symbol]),
  );
  const occurrenceIdentities = new Set<string>();
  for (const step of sequencePreimage.steps) {
    if (occurrenceIdentities.has(step.occurrenceIdentity)) {
      fail(
        "duplicate-record",
        ["sequenceClaim", "preimage", "steps", step.id, "occurrenceIdentity"],
        "Concrete realization step occurrence identities must be unique",
      );
    }
    occurrenceIdentities.add(step.occurrenceIdentity);
    const templateSymbol = templateSymbolById.get(step.templateSymbolId);
    if (templateSymbol === undefined || templateSymbol.kind !== step.kind) {
      fail(
        "invalid-parser-operation",
        ["sequenceClaim", "preimage", "steps", step.id, "templateSymbolId"],
        "Concrete step does not match a sequence-language symbol",
      );
    }
    if (step.kind === "artifact-token") {
      if (
        templateSymbol.kind !== "artifact-token" ||
        templateSymbol.artifactTokenClassId !== step.artifactTokenClassId
      ) {
        fail(
          "invalid-parser-operation",
          [
            "sequenceClaim",
            "preimage",
            "steps",
            step.id,
            "artifactTokenClassId",
          ],
          "Concrete artifact token class does not match its template symbol",
        );
      }
      continue;
    }
    if (
      templateSymbol.kind !== "parser-operation" ||
      templateSymbol.parserOperationId !== step.parserOperationId ||
      !profilePreimage.parserOperationIds.includes(step.parserOperationId)
    ) {
      fail(
        "invalid-parser-operation",
        ["sequenceClaim", "preimage", "steps", step.id, "parserOperationId"],
        "Parser operation is not authorized by the template and parser profile",
      );
    }
    const inputTemplateSymbolIds = step.inputStepIds.map((inputStepId) => {
      const inputStep = stepById.get(inputStepId);
      if (inputStep === undefined) {
        fail(
          "dangling-reference",
          ["sequenceClaim", "preimage", "steps", step.id, "inputStepIds"],
          "Parser operation references an unavailable concrete step",
        );
      }
      return inputStep.templateSymbolId;
    });
    if (
      !canonicalEqual(inputTemplateSymbolIds, templateSymbol.inputSymbolIds)
    ) {
      fail(
        "invalid-parser-operation",
        ["sequenceClaim", "preimage", "steps", step.id, "inputStepIds"],
        "Concrete parser inputs do not match the template symbol inputs",
      );
    }
    for (let index = 0; index < step.inputStepIds.length; index += 1) {
      const inputStep = stepById.get(step.inputStepIds[index]);
      if (
        inputStep === undefined ||
        realizationStepOutputDigest(inputStep) !==
          step.inputObservationTokenDigests[index]
      ) {
        fail(
          "invalid-parser-operation",
          [
            "sequenceClaim",
            "preimage",
            "steps",
            step.id,
            "inputObservationTokenDigests",
            index,
          ],
          "Parser input token continuity is broken",
        );
      }
    }
  }
  const templateWord = sequencePreimage.parserSequence.map((stepId) => {
    const step = stepById.get(stepId);
    if (step === undefined) {
      fail(
        "dangling-reference",
        ["sequenceClaim", "preimage", "parserSequence"],
        "Parser sequence references an unavailable concrete step",
      );
    }
    return step.templateSymbolId;
  });
  if (!automatonAcceptsWord(sequenceLanguage.preimage, templateWord)) {
    fail(
      "invalid-parser-operation",
      ["sequenceClaim", "preimage", "parserSequence"],
      "Concrete template-symbol word is not accepted by the sequence language",
    );
  }
  for (const obligation of templatePreimage.obligations) {
    const constraint = contract.preimage.constraints.find(
      ({ id }) => id === obligation.constraintId,
    );
    const outputStepId = outputByObligationId.get(obligation.id);
    const outputStep =
      outputStepId === undefined ? undefined : stepById.get(outputStepId);
    if (
      obligation.observationContractId !== contract.id ||
      constraint === undefined ||
      outputStep === undefined ||
      realizationStepOutputDigest(outputStep) !==
        obligation.expectedObservationTokenDigest
    ) {
      fail(
        "unproven-obligation",
        ["template", "preimage", "obligations", obligation.id],
        "Realization obligation is not proven by an exact output token",
      );
    }
    if (
      constraint.kind === "dom" &&
      (outputStep.kind !== "parser-operation" ||
        !hasArtifactAncestor(outputStep, stepById, new Set()))
    ) {
      fail(
        "unproven-obligation",
        ["template", "preimage", "obligations", obligation.id],
        "Every DOM provenance branch must reach an artifact-token root",
      );
    }
  }
  if (
    sequencePreimage.proofDomainId !== profilePreimage.sequenceProofDomainId ||
    baseUrlClaim.preimage.proofDomainId !==
      profilePreimage.baseUrlProofDomainId ||
    baseUrlClaim.preimage.parserProfileId !== parserProfile.id ||
    witnessPreimage.baseUrlClaimId !== baseUrlClaim.id ||
    witnessPreimage.canonicalBaseUrl !== baseUrlClaim.preimage.canonicalBaseUrl
  ) {
    fail(
      "contract-mismatch",
      ["baseUrlClaim"],
      "Sequence or base URL claim is not bound to the parser profile and witness",
    );
  }
  if (
    witnessPreimage.targetHostProfileId !==
      profilePreimage.targetHostProfileId ||
    !profilePreimage.contentTypeIds.includes(witnessPreimage.contentTypeId) ||
    !profilePreimage.documentModes.includes(witnessPreimage.documentMode)
  ) {
    fail(
      "host-profile-mismatch",
      ["targetHostProfileId"],
      "Witness parser settings do not match the canonical parser profile",
    );
  }
  if (
    !context.selectionHostProfileIds.includes(
      witnessPreimage.targetHostProfileId,
    ) ||
    context.environmentCatalog.environment !== "browser" ||
    !context.environmentCatalog.registries.some(
      (entry) =>
        entry.kind === "host-profile" &&
        entry.qualifiedId === witnessPreimage.targetHostProfileId,
    )
  ) {
    fail(
      "host-profile-mismatch",
      ["targetHostProfileId"],
      "Target host is not present in both selection and browser environment catalog",
    );
  }
  const authorEffectIds = new Set([
    ...witnessPreimage.upgradeEffectIds,
    ...witnessPreimage.adoptEffectIds,
  ]);
  if (
    sequencePreimage.steps.some(
      (step) =>
        authorEffectIds.has(step.id) ||
        authorEffectIds.has(step.occurrenceIdentity),
    )
  ) {
    fail(
      "invalid-parser-operation",
      ["sequenceClaim", "preimage", "steps"],
      "Upgrade and adopt author effects cannot be server realization steps",
    );
  }
}

export {
  ObservationContractError,
  acceptObservationComposition,
  acceptObservationRelation,
  areObservationInputLanguagesDisjoint,
  compareObservationBehaviorEquality,
  createCanonicalBaseUrlClaim,
  createCanonicalParserProfile,
  createObservationBehaviorDerivationClaim,
  createObservationBehaviorSummary,
  createObservationComparisonClaim,
  createObservationCompositionAlgebraDescriptor,
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
  createObservationOrderEdge,
  createObservationPolicyDerivationClaim,
  createObservationProofAcceptance,
  createObservationRefinementRule,
  createObservationRelationLanguage,
  createObservationRelationSymbol,
  createObservationRulePolicyDescriptor,
  createObservationRuleApplication,
  createObservationTraceLanguage,
  createObservationTraceSymbol,
  deriveAllowedObservationRelationLanguage,
  deriveAllowedObservationCompositionRelationLanguage,
  createRealizationCoverageClaim,
  createRealizationObligation,
  createRealizationSequenceClaim,
  createRealizationSequenceLanguage,
  createRealizationStep,
  createRealizationTemplateStepSymbol,
  createRealizationWitness,
  createRealizationWitnessTemplate,
  isObservationInputLanguageSubset,
  isObservationTraceLanguageSubset,
  parseObservationBehaviorSummary,
  parseObservationComposition,
  parseObservationCompositionRelationLanguage,
  parseObservationContract,
  parseObservationInputLanguage,
  parseObservationProofAcceptance,
  parseObservationRelationLanguage,
  parseObservationTraceLanguage,
  parseRealizationWitness,
  projectObservationRelationLanguage,
  unionObservationInputLanguages,
  validateObservationBehaviorSummary,
  validateRealizationCoverageClaim,
  validateRealizationWitness,
};

export type {
  AcceptedObservationRelation,
  AcceptedObservationComposition,
  AcceptedRealizationCoverage,
  CanonicalBaseUrlClaim,
  CanonicalBaseUrlClaimInput,
  CanonicalParserProfile,
  CanonicalParserProfileInput,
  ObservationAutomatonBudget,
  AcceptedObservationBehavior,
  ObservationBehaviorDerivationClaim,
  ObservationBehaviorDerivationClaimInput,
  ObservationBehaviorSummary,
  ObservationBehaviorSummaryInput,
  ObservationBehaviorValidationInput,
  ObservationAllowedRelationDerivationInput,
  ObservationCardinality,
  ObservationComparisonClaim,
  ObservationComparisonClaimInput,
  ObservationComparisonDecision,
  ObservationEqualityInput,
  ObservationComposition,
  ObservationCompositionAcceptanceInput,
  ObservationCompositionAlgebraDescriptor,
  ObservationCompositionAlgebraDescriptorInput,
  ObservationCompositionBinding,
  ObservationCompositionBindingInput,
  ObservationCompositionClaim,
  ObservationCompositionClaimInput,
  ObservationCompositionInput,
  ObservationCompositionPolicyApplication,
  ObservationCompositionPolicyApplicationInput,
  ObservationCompositionPolicyClosure,
  ObservationCompositionPolicyDerivationClaim,
  ObservationCompositionPolicyDerivationClaimInput,
  ObservationPolicyRequirement,
  ObservationCompositionRelationDerivationInput,
  ObservationCompositionRelationLanguage,
  ObservationCompositionRelationLanguageInput,
  ObservationCompositionRelationSymbol,
  ObservationCompositionRelationSymbolInput,
  ObservationCompositionResultContractHeader,
  ObservationConstraint,
  ObservationConstraintInput,
  ObservationContract,
  ObservationContractErrorCode,
  ObservationContractInput,
  ObservationContractPathSegment,
  ObservationInputClassDescriptor,
  ObservationInputClassDescriptorInput,
  ObservationInputLanguage,
  ObservationInputLanguageInput,
  ObservationInputPartition,
  ObservationInputPartitionInput,
  ObservationInputPartitionPolicyClaim,
  ObservationInputPartitionPolicyClaimInput,
  ObservationOrderEdge,
  ObservationOrderEdgeInput,
  ObservationRefinementRule,
  ObservationRefinementRuleInput,
  ObservationRelationLanguage,
  ObservationRelationLanguageInput,
  ObservationRelationSymbol,
  ObservationRelationSymbolInput,
  ObservationRelationAcceptanceInput,
  ObservationRelationCompositionContext,
  ObservationRulePolicyDescriptor,
  ObservationRulePolicyDescriptorInput,
  ObservationPolicyDerivationClaim,
  ObservationPolicyDerivationClaimInput,
  ObservationProofAcceptance,
  ObservationProofAcceptanceInput,
  ObservationRuleApplication,
  ObservationRuleApplicationInput,
  ObservationTraceLanguage,
  ObservationTraceLanguageInput,
  ObservationTraceSymbol,
  ObservationTraceSymbolInput,
  RealizationCoverageClaim,
  RealizationCoverageClaimInput,
  RealizationCoverageValidationInput,
  RealizationObligation,
  RealizationObligationInput,
  RealizationSequenceClaim,
  RealizationSequenceClaimInput,
  RealizationSequenceLanguage,
  RealizationSequenceLanguageInput,
  RealizationStep,
  RealizationStepInput,
  RealizationTemplateStepSymbol,
  RealizationTemplateStepSymbolInput,
  RealizationWitness,
  RealizationWitnessInput,
  RealizationWitnessTemplate,
  RealizationWitnessTemplateInput,
  RealizationWitnessValidationContext,
  TrustedObservationProofContext,
};
