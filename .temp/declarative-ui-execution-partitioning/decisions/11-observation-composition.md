#### Composition

composition の constraint reference は contract ID で修飾する。
binding は shared subject 全体ではなく `(sharedSubjectId, constraintKind)` ごとに一件作る。

```ts
interface ObservationConstraintReference {
  readonly contractId: Sha256Digest;
  readonly constraintId: Sha256Digest;
}

interface ObservationCompositionBinding {
  readonly id: Sha256Digest;
  readonly sharedSubjectId: string;
  readonly constraintKind: ObservationConstraint["kind"];
  readonly members: readonly ObservationConstraintReference[];
  readonly resolution:
    | { readonly kind: "merge-identical" }
    | { readonly kind: "exclusive-owner"; readonly owner: ObservationConstraintReference }
    | {
        readonly kind: "commutative";
        readonly compositionAlgebraId: Sha256Digest;
        readonly proofDomainId: Sha256Digest;
      }
    | {
        readonly kind: "total-order";
        readonly compositionAlgebraId: Sha256Digest;
        readonly orderedMembers: readonly ObservationConstraintReference[];
      };
}

interface ObservationCompositionPreimage {
  readonly schema: "dathra.observation-composition/2";
  readonly memberContractIds: readonly Sha256Digest[];
  readonly bindings: readonly ObservationCompositionBinding[];
  readonly resultConstraintIds: readonly Sha256Digest[];
  readonly memberToResult: readonly {
    readonly member: ObservationConstraintReference;
    readonly resultConstraintId: Sha256Digest;
  }[];
  readonly resultOrderClosure: readonly {
    readonly beforeConstraintId: Sha256Digest;
    readonly afterConstraintId: Sha256Digest;
  }[];
}

interface ObservationCompositionRelationSymbol {
  readonly id: Sha256Digest;
  readonly memberSymbolIds: readonly (Sha256Digest | null)[];
  readonly resultSymbolId: Sha256Digest | null;
  readonly bindingId: Sha256Digest | null;
}

interface ObservationCompositionRelationLanguagePreimage {
  readonly schema: "dathra.observation-composition-relation-language/1";
  readonly alphabet: readonly ObservationCompositionRelationSymbol[];
  readonly stateCount: number;
  readonly initialState: 0;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

interface ObservationCompositionClaimPreimage {
  readonly schema: "dathra.observation-composition-claim/1";
  readonly compositionId: Sha256Digest;
  readonly memberSummaryIds: readonly Sha256Digest[];
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly memberTraceLanguageIds: readonly Sha256Digest[];
    readonly resultTraceLanguageId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly allowedRelationLanguageId: Sha256Digest;
  }[];
  readonly compositionAlgebraIds: readonly Sha256Digest[];
}
```

binding は同じ subject と kind の全 shared reference を過不足なく覆う。
semantic domain field は resolution より先に compatibility を検証する。
`merge-identical` は同じ constraint record、exclusive owner は owner の cardinality と outcome がほかの member の部分集合になる場合だけ使える。
commutative と total order は versioned composition algebra が定義する operation kind に限る。

creator は result constraint、全 member-to-result mapping、result order closure を再計算する。
parser は caller が渡した result view と再計算結果の完全一致を要求する。
member/result trace language の composition は multi-tape relation language として表し、各 member projection と result projection の完全一致、actual relation と algebra-derived allowed relation の包含を検証する。
`memberSymbolIds` の position は `memberContractIds` の canonical order と一致させ、全 member symbol と result symbol が null の relation symbol を拒否する。

#### RealizationWitness

RealizationWitness は一つの concrete render instance の証拠である。
全 external input class に server materialization が存在することは、別の symbolic WitnessTemplate と coverage claim で証明する。

```ts
interface RealizationObligation {
  readonly id: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly constraintId: Sha256Digest;
  readonly observableIdentity: string;
  readonly expectedObservationTokenDigest: Sha256Digest;
}

type RealizationStep =
  | {
      readonly kind: "artifact-token";
      readonly id: Sha256Digest;
      readonly templateSymbolId: Sha256Digest;
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

interface RealizationSequenceLanguagePreimage {
  readonly schema: "dathra.realization-sequence-language/1";
  readonly alphabet: readonly RealizationTemplateStepSymbol[];
  readonly stateCount: number;
  readonly initialState: 0;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

interface RealizationSequenceClaimPreimage {
  readonly schema: "dathra.realization-sequence-claim/1";
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

interface CanonicalParserProfilePreimage {
  readonly schema: "dathra.canonical-parser-profile/1";
  readonly targetHostProfileId: QualifiedRegistryId<"host-profile">;
  readonly version: string;
  readonly encoding: "utf-8";
  readonly contentTypeIds: readonly string[];
  readonly documentModes: readonly ("no-quirks" | "limited-quirks" | "quirks")[];
  readonly parserOperationIds: readonly string[];
  readonly sequenceProofDomainId: Sha256Digest;
  readonly baseUrlProofDomainId: Sha256Digest;
}

interface CanonicalBaseUrlClaimPreimage {
  readonly schema: "dathra.canonical-base-url-claim/1";
  readonly parserProfileId: Sha256Digest;
  readonly canonicalBaseUrl: string;
  readonly proofDomainId: Sha256Digest;
}

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

interface RealizationCoverageClaimPreimage {
  readonly schema: "dathra.realization-coverage-claim/1";
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly inputPartitionDigest: Sha256Digest;
  readonly templates: readonly {
    readonly inputClassId: Sha256Digest;
    readonly witnessTemplateId: Sha256Digest;
  }[];
  readonly proofDomainId: Sha256Digest;
}

interface RealizationWitnessPreimage {
  readonly schema: "dathra.realization-witness/2";
  readonly renderInstanceId: string;
  readonly observationContractId: Sha256Digest;
  readonly behaviorSummaryId: Sha256Digest;
  readonly comparisonClaimDigest: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly realizationInputDigest: Sha256Digest;
  readonly realizationSequenceClaimId: Sha256Digest;
  readonly targetHostProfileId: QualifiedRegistryId<"host-profile">;
  readonly encoding: "utf-8";
  readonly contentTypeId: string;
  readonly documentMode: "no-quirks" | "limited-quirks" | "quirks";
  readonly canonicalBaseUrl: string;
  readonly baseUrlClaimDigest: Sha256Digest;
  readonly policyEpoch: string;
  readonly customElementRegistryIdentity: string;
  readonly parserProfileId: Sha256Digest;
  readonly upgradeEffectIds: readonly string[];
  readonly adoptEffectIds: readonly string[];
}

interface ArtifactReproductionRecordPreimage {
  readonly schema: "dathra.artifact-reproduction/1";
  readonly artifactAddressId: string;
  readonly rawExactByteDigest: Sha256Digest;
  readonly byteLength: number;
  readonly encoding: "utf-8";
  readonly contentTypeId: string;
  readonly parserProfileId: Sha256Digest;
  readonly parserProfileVersion: string;
  readonly parserInputBytesDigest: Sha256Digest;
  readonly tokenStreamDigest: Sha256Digest;
  readonly witnessTemplateId: Sha256Digest;
}

interface ObservationAdmissionSidecarPreimage {
  readonly schema: "dathra.observation-admission-sidecar/1";
  readonly witnessId: Sha256Digest;
  readonly reproductionRecordId: Sha256Digest;
  readonly selectionDomainDigest: Sha256Digest;
  readonly environmentCatalogDigest: Sha256Digest;
  readonly artifactAddressId: string;
  readonly rawExactByteDigest: Sha256Digest;
}
```

各 observable node と value は atomic obligation を持つ。
WitnessTemplate は obligation record の実体と canonical symbolic sequence language を所有する。
concrete sequence claim は template ID を参照し、obligation ID 集合が template の obligation 集合と完全一致しなければならない。
各 concrete step の `templateSymbolId` から作る word は template の sequence language に受理されなければならない。
obligation は exactly one output step に解決し、step DAG の input と output token は連続しなければならない。
DSD は artifact token から canonical parser operation へ進む chain として記録し、単独 provenance にしない。
upgrade と adopt の author effect は記録するが、RealizationStep の kind には含めない。

OC01 は URL host object を実行しない。
canonical base URL は parser profile が指定する proof domain の claim として検証する。
parser operation は profile の operation set に含まれ、content type、document mode、encoding、target host は profile と一致しなければならない。

targetHostProfileId は selection domain の hostProfileIds と対象 environment catalog の qualified host-profile membership の両方に存在しなければならない。
selection、catalog、artifact exact digest は witness preimage に入れず、finalization 後の admission sidecar で束縛する。

sidecar の hash だけを artifact provenance の証拠にしない。
AF01 は artifact address、raw exact byte digest、byte length、encoding、content type、parser profile ID と version、parser input bytes digest、token stream digest、witness template ID を持つ reproduction record を生成する。
SL01 は検証済み reproduction record を参照し、post-finalization witness と admission sidecar に束縛する。
同じ parser profile で exact bytes を再処理して token と step を再現できない candidate は拒否する。
dynamic response は RenderOperation が同じ検証を instance byte stream と witness step に対して commit protocol 内で行う。

OC01 は closed schema、canonical automaton、projection、language inclusion、contract conformance、claim と witness の構造検証だけを担当する。
trusted toolchain provider は CanonicalParserProfile を供給する。
EG03 と PL02 は source summary、CN01 は candidate summary、semantic claim、WitnessTemplate、coverage claim を生成する。
AF01 は static sequence claim、base URL claim、exact-byte reproduction を生成する。
SL01 は reproduction を検証して post-finalization witness と admission sidecar に束縛する。
RenderOperation は dynamic sequence claim と concrete instance witness を生成し、RR01 は runtime conformance を再検証する。
