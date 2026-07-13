> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Observation contract implementation audit

> Successor clarification: the later composition `/4` section in this file supersedes the earlier composition `/3` schema. The preserved opening reference to `/2` and `/3` is historical and does not exclude `/4`.

#### 実装監査後の OC01 `/3` 契約

この節は、OC01 の実装監査で見つかった保証上の不足を解消するため、前節の BehaviorSummary、rule application、comparison claim、composition、coverage、witness schema を supersede する。
前節は設計判断の履歴として残すが、production implementation はこの節の `/2` または `/3` schema と API に従う。

##### 外部入力 partition と behavior conformance

trace language creator は contract-free な canonical finite DFA creator とする。
contract への適合性は、外部入力 partition と ObservationContract を受け取る非同期 validator が判定する。

```ts
type ObservationInputSymbol = Extract<
  ObservationTraceSymbol,
  { readonly kind: "event" }
>;

interface ObservationInputLanguagePreimage {
  readonly schema: "dathra.observation-input-language/1";
  readonly alphabet: readonly ObservationInputSymbol[];
  readonly stateCount: number;
  readonly initialState: 0;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

interface ObservationInputClassDescriptorPreimage {
  readonly schema: "dathra.observation-input-class/1";
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
  readonly selectorLanguageId: Sha256Digest;
}

interface ObservationInputPartitionPreimage {
  readonly schema: "dathra.observation-input-partition/1";
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
  readonly universeLanguageId: Sha256Digest;
  readonly inputClasses: readonly ObservationInputClassDescriptor[];
}

interface ObservationInputPartitionPolicyClaimPreimage {
  readonly schema: "dathra.observation-input-partition-policy-claim/1";
  readonly inputPartitionId: Sha256Digest;
  readonly universeLanguageId: Sha256Digest;
  readonly inputClassIds: readonly Sha256Digest[];
  readonly proofDomainId: Sha256Digest;
}

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

interface ObservationBehaviorDerivationClaimPreimage {
  readonly schema: "dathra.observation-behavior-derivation-claim/2";
  readonly behaviorSummaryId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly semanticGraphDigest: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

interface AcceptedObservationBehaviorPreimage {
  readonly schema: "dathra.accepted-observation-behavior/1";
  readonly behaviorSummaryId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly partitionPolicyAcceptanceId: Sha256Digest;
  readonly behaviorDerivationAcceptanceId: Sha256Digest;
}
```

`createObservationInputLanguage` と `parseObservationInputLanguage` は event symbol だけを持つ canonical complete minimal finite DFA を生成、検証する。
`isObservationInputLanguageSubset`、`areObservationInputLanguagesDisjoint`、`unionObservationInputLanguages` は hard budget を受け取る。
union は caller の state table を受け取らず、入力 language の product から canonical DFA を生成する。

`inputClasses` は selector language ID ではなく descriptor の content ID を class ID として使う。
OC01 は各 selector が universe language の subset であること、任意の二 class の intersection が空であること、全 selector の union が universe language と一致することを budgeted DFA product で検証する。
partition policy acceptance は selector symbol が external input schema と initial cut を表すことだけを証明し、partition の被覆判定を置き換えない。

behavior validator は behavior trace の event projection を class selector language と完全一致させる。
同じ product state で occurrence slot の再利用、constraint cardinality、terminal outcome、strict、serial、exclusive を検証する。
candidate behavior の `omit-unobservable-internal-step` 対象だけは実効 cardinality の minimum を0とし、source behavior と対象外 constraint は contract の cardinality を維持する。
accepted word の列挙は行わない。

##### proof acceptance の真正性

semantic validator と acceptor はすべて非同期にする。
validator は content-addressed input を closed snapshot として parse し、preimage digest を再計算してから `trustedProofAcceptanceIds` を参照する。
trusted ID と別の preimage を組み合わせた record は `digest-mismatch` で拒否する。

policy proof の参照順は次の有向非巡回 graph に固定する。

```txt
policy descriptor
  -> policy derivation claim
  -> parsed trusted policy acceptance
  -> rule application または composition binding
  -> comparison または composition claim
  -> locally derived allowed relation A
  -> accepted relation または accepted composition
```

policy derivation claim は descriptor ID、policy language ID、proof-domain ID だけを参照する。
application、binding、comparison、composition、derived `A` への後方参照を禁止する。

##### rule-derived allowed relation

ObservationRuleApplication `/2` から global `allowedRelationLanguageId` を削除する。
ComparisonClaim `/2` も caller が選んだ allowed relation ID を持たない。

```ts
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

interface ObservationPolicyDerivationClaimPreimage {
  readonly schema: "dathra.observation-policy-derivation-claim/1";
  readonly policyDescriptorId: Sha256Digest;
  readonly policyLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

type ObservationRuleApplicationPreimage = {
  readonly schema: "dathra.observation-rule-application/3";
  readonly ruleId: Sha256Digest;
  readonly sourceSummaryId: Sha256Digest;
  readonly candidateSummaryId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
} & (
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
```

`deriveAllowedObservationRelationLanguage` は source DFA、candidate DFA、contract rule、local mapping、policy descriptor、policy transducer から `A` を生成する。
identity 以外の global relation を caller から受け取らない。

local mapping は source と candidate の alphabet、および rule の constraint へ完全に解決する。
`ruleId: null` は同じ symbol ID の identity mapping だけを許可する。
equivalent-value は rule の value constraint、narrow-cardinality は同じ cardinality-bearing constraint の unique slot、omit は source internal-ordering occurrence から candidate epsilon への一方向だけを許可する。
coalescing は独立して証明された policy descriptor が source event ID を固定し、candidate occurrence slot の total mapping、non-empty preimage、cardinality、declared overflow terminal を検証する。
commutative と total-order は policy transducer が受理した word だけを許可し、non-null pair であることだけを根拠にしない。

ObservationContract `/3` の coalescing 対象 constraint は、文字列 ID ではなく `ObservationPolicyRequirement` を持つ。
Requirement は qualified policy ID、version、immutable policy rule graph digest、proof domain を固定する。
RuleApplication `/3` は重複する policy ID を持たず、constraint requirement と descriptor の四項目を完全一致させる。
Requirement は下流 record の ID を含まないため、descriptor、derivation claim、acceptance、application への生成順は非巡回になる。
Coalescing policy transducer の rule symbol は source 側を進めず、candidate 側の対象 occurrence または application が宣言した overflow terminal だけを進める。
Rule 対象外 constraint と external input event は identity symbol だけで進める。

Rule policy descriptor `/2` は qualified policy ID だけでなく、version と immutable policy rule graph digest を束縛する。
同じ qualified ID を維持したまま policy 実装が変わっても、既存 application の意味は変化しない。

`commutative-reorder` は relation acceptance が受け取る composition context から exact composition `/4` と member contract closure を再導出する。
Comparison claim の composition ID、application の composition ID と binding ID、comparison contract の member contract ID、rule constraint ID 集合を同じ context に解決する。
Binding は commutative resolution でなければならず、その policy requirement と descriptor の qualified ID、version、rule graph digest、proof domain を完全一致させる。

Commutative policy symbol は source と candidate の両方を進める occurrence pair とする。
各 occurrence constraint は同じ contract に属する binding member かつ rule constraint でなければならない。
Duplicate、extra、unreferenced composition context は acceptance closure に含めない。

global `A` は source state、candidate state、rule-policy state の product として構築する。
対象外 symbol は identity としてだけ進み、rule-policy symbol は該当 transducer を進める。
`acceptObservationRelation` は source と candidate の accepted behavior、actual relation `R`、derived `A`、全 application acceptance を再検証してから AcceptedObservationRelation を生成する。
structural digest creator を accepted relation の公開 API にしない。
同じ proof domain と claim に一致する trusted acceptance は exactly one とし、複数の attestation が一致する場合は曖昧として拒否する。
Duplicate rule application は map で上書きせず、exact closure 違反として拒否する。
`commutative-reorder` application がない ComparisonClaim の composition ID は null とする。
Application がある場合は、全 application の composition ID と exact composition context を claim の composition ID に一致させる。

##### composition result contract

Composition `/3` は完全な result ObservationContract を所有する。
result contract は composition ID を参照しないため、composition digest との cycle を作らない。

```ts
interface ObservationCompositionResultContractHeader {
  readonly rootDefinitionId: string;
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
}

interface ObservationCompositionAlgebraDescriptorPreimage {
  readonly schema: "dathra.observation-composition-algebra/1";
  readonly operationKind: "commutative" | "total-order";
  readonly version: string;
  readonly constraintKind: ObservationConstraint["kind"];
  readonly policyQualifiedId: QualifiedRegistryId<"policy">;
  readonly policyTransducerLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

interface ObservationCompositionBinding {
  readonly schema: "dathra.observation-composition-binding/2";
  readonly id: Sha256Digest;
  readonly sharedSubjectId: string;
  readonly constraintKind: ObservationConstraint["kind"];
  readonly members: readonly ObservationConstraintReference[];
  readonly resolution:
    | { readonly kind: "merge-identical" }
    | { readonly kind: "exclusive-owner"; readonly owner: ObservationConstraintReference }
    | {
        readonly kind: "commutative";
        readonly algebraDescriptorId: Sha256Digest;
        readonly policyAcceptanceId: Sha256Digest;
      }
    | {
        readonly kind: "total-order";
        readonly algebraDescriptorId: Sha256Digest;
        readonly policyAcceptanceId: Sha256Digest;
        readonly orderedMembers: readonly ObservationConstraintReference[];
      };
}

interface ObservationCompositionPreimage {
  readonly schema: "dathra.observation-composition/3";
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

interface ObservationCompositionClaimPreimage {
  readonly schema: "dathra.observation-composition-claim/2";
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
    readonly bindingPolicyAcceptanceIds: readonly Sha256Digest[];
  }[];
}

interface AcceptedObservationCompositionPreimage {
  readonly schema: "dathra.accepted-observation-composition/1";
  readonly compositionClaimId: Sha256Digest;
  readonly memberBehaviorAcceptanceIds: readonly Sha256Digest[];
  readonly resultBehaviorAcceptanceId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly derivedAllowedRelationLanguageId: Sha256Digest;
    readonly bindingPolicyAcceptanceIds: readonly Sha256Digest[];
  }[];
}
```

全 member contract は result header の external input schema、event schema、initial cut と一致する。
creator は result constraint、mapping、order closure を導出し、`relation: "trace-equality"`、refinement rule なしの result contract を生成する。
member-to-result の変換許可は composition policy から導出した multi-tape `A` だけが所有する。

commutative と total-order はどちらも先行する algebra descriptor と trusted policy acceptance を必要とする。
非 identity multi-tape symbol は exact binding ID を持つ。
CompositionClaim `/2` は composition ID、result contract ID、result summary ID、member summary、actual relation、policy reference を束縛するが、allowed relation ID は持たない。
`acceptObservationComposition` は multi-tape `A` を budgeted product で導出し、各 member projection、result projection、actual relation inclusion を検証して accepted composition を生成する。

##### composition policy の非巡回 `/4` 契約

Composition `/3` の policy-backed binding は生成不能な digest cycle を持つ。
Binding ID は descriptor と policy acceptance を参照し、descriptor は policy language を参照し、policy language symbol は exact Binding ID を参照するためである。
この判断は composition `/3` の independent result contract を維持し、descriptor、language、acceptance を binding より先に生成する順序と binding `/2`、composition `/3`、claim `/2`、accepted composition `/1` schema だけを supersede する。

```ts
interface ObservationCompositionBinding {
  readonly schema: "dathra.observation-composition-binding/3";
  readonly id: Sha256Digest;
  readonly sharedSubjectId: string;
  readonly constraintKind: ObservationConstraint["kind"];
  readonly members: readonly ObservationConstraintReference[];
  readonly resolution:
    | { readonly kind: "merge-identical" }
    | { readonly kind: "exclusive-owner"; readonly owner: ObservationConstraintReference }
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

interface ObservationCompositionPolicyDerivationClaimPreimage {
  readonly schema: "dathra.observation-composition-policy-derivation-claim/1";
  readonly policyApplicationId: Sha256Digest;
  readonly algebraDescriptorId: Sha256Digest;
  readonly policyLanguageId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

interface ObservationCompositionPolicyClosure {
  readonly bindingId: Sha256Digest;
  readonly policyApplicationId: Sha256Digest;
  readonly policyDerivationClaimId: Sha256Digest;
  readonly policyAcceptanceId: Sha256Digest;
}

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
```

Binding `/3` は structural identity と immutable policy requirement だけを持ち、policy language、descriptor、claim、acceptance を参照しない。
Composition `/4` は binding、independent result contract、member mapping、order closure だけを所有する。

Policy transducer は composition と input class の member/result trace language が確定した後に生成する。
Policy application は composition、input class、canonical member order の全 language、binding、descriptor、policy language を束縛し、acceptance を参照しない。
Composition 専用 derivation claim が application、descriptor、language、proof domain を束縛し、その claim に対する trusted acceptance を CompositionClaim の class-local closure が参照する。

各 policy symbol は exact binding ID を持つだけでは不十分である。
Event symbol を policy symbol に使わず、exactly one の non-null member tape と non-null result symbol を持たせる。
Member symbol の constraint は該当 tape の binding member に属し、binding 外 tape は null とする。
Result symbol の constraint は同じ member reference の `memberToResult` 先と一致させる。
この binding-locality を検証した symbol だけから allowed relation `A` を構築する。

各 input class で commutative または total-order binding は exactly one policy closure、merge-identical と exclusive-owner は zero policy closure を持つ。
Application、descriptor、claim、language、acceptance の duplicate、extra、unreferenced record を拒否する。
Descriptor の operation、constraint kind、policy qualified ID、version、rule graph digest、proof domain は binding requirement と完全一致させる。

Derived `A` は composition、class language、binding、検証済み policy closure だけから生成し、actual relation `R` と CompositionClaim ID を入力にしない。
CompositionClaim と `A` は同じ closure から並行に導出され、acceptor が全 projection と `R subset A` を検証して AcceptedComposition `/2` を生成する。

`ObservationProofAcceptance.attestationDigest` は OC01 の typed reference graph では opaque non-reference とする。
Policy proof verifier が derivation claim とその transitive upstream closure だけを入力にして branded trust result を返すことは SC03 と RR01 の責務であり、違反する verifier profile を trusted domain へ admission しない。

```txt
Binding
  -> Composition + independent result contract
  -> class-local member/result languages
  -> policy language
  -> algebra descriptor
  -> policy application
  -> policy derivation claim
  -> trusted policy acceptance
  -> { CompositionClaim, derived allowed relation A }
  -> AcceptedComposition
```

##### coverage と concrete witness

coverage と witness は別の acceptance closure を持つ。

```ts
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

interface AcceptedRealizationCoveragePreimage {
  readonly schema: "dathra.accepted-realization-coverage/1";
  readonly coverageClaimId: Sha256Digest;
  readonly behaviorAcceptanceId: Sha256Digest;
  readonly inputPartitionId: Sha256Digest;
  readonly witnessTemplateIds: readonly Sha256Digest[];
  readonly coverageAcceptanceId: Sha256Digest;
}

type RealizationStepV2 =
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

interface RealizationSequenceClaimPreimageV2 {
  readonly schema: "dathra.realization-sequence-claim/2";
  readonly witnessTemplateId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly realizationInputDigest: Sha256Digest;
  readonly parserProfileId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
  readonly obligationIds: readonly Sha256Digest[];
  readonly steps: readonly RealizationStepV2[];
  readonly parserSequence: readonly Sha256Digest[];
  readonly obligationOutputs: readonly {
    readonly obligationId: Sha256Digest;
    readonly outputStepId: Sha256Digest;
  }[];
}

interface RealizationWitnessPreimageV3 {
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
```

`validateRealizationCoverageClaim` は full BehaviorSummary、InputPartition、全 template、全 sequence language、coverage claim、trusted coverage acceptance を受け取る。
validator は全 input class に exactly one template があり、余分な class がなく、contract、summary、partition、profile の参照が閉じていることを検証する。

witness は accepted observation relation、accepted coverage、coverage claim と acceptance、sequence claim と acceptance、base URL claim と acceptance を自身の preimage に記録する。
artifact concrete step の `artifactTokenClassId` は template symbol と一致させる。
symbolic output relation と concrete token の意味的適合は sequence proof-domain verifier が検証し、OC01 は再計算済み sequence claim digest に対する exact trusted acceptance を要求する。

DOM obligation の output へ至る全 provenance path は、一つ以上の artifact-token step に到達しなければならない。
入力を持たない parser-operation branch、parser だけで始まる branch、artifact-rooted branch と未証明 branch の合流を拒否する。

##### budget と failure

normalization、determinization、projection、partition union/intersection、contract violation product、rule-policy product、composition-policy product は明示された hard budget を消費する。
budget 超過時は `budget-exceeded` を返し、近似、部分 DFA、runtime fallback を生成しない。
