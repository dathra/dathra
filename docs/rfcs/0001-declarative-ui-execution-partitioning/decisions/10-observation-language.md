> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Observation contract language

## 意味契約

### ObservationContract

ObservationContract は root ごとに定義する。
契約には、必要に応じて次の項目を含める。

- value と DOM の内容
- artifact と protocol の出力
- event と effect の cardinality
- effect と callback の partial order
- admission cut と event source
- identity と lifetime
- consistency cut と read validity
- authority と exposure
- success、typed failure、cancel、disconnect などの terminal outcome

共有する DOM range、host target、identity domain、resource、global listener、authority realm がある root は、planning 前に composition group へまとめる。
共有 operation は、exclusive ownership、commutativity、total order のいずれかを契約しなければならない。
両立しない契約は compile diagnostic とする。

plan の合法性は、同じ external input と event identity に対する source trace と plan trace の関係で判定する。
契約は、観測集合の equality を要求するのか、許容範囲内の refinement を認めるのかを明示する。

ObservationContract は closed constraint と canonical trace language の関係として実装する。

この節は、constraint ID だけを並べた concrete trace と、constraint ごとに一つの provenance を置く `dathra.realization-witness/1` の初期案を supersede する。
後方互換 layer は設けない。

#### Constraint と order

```ts
type ObservationCardinality =
  | { readonly kind: "exactly"; readonly count: number }
  | { readonly kind: "range"; readonly minimum: number; readonly maximum: number };

type ObservationVisibility = "external" | "internal-ordering";

interface ObservationPolicyRequirement {
  readonly policyQualifiedId: QualifiedRegistryId<"policy">;
  readonly version: string;
  readonly policyRuleGraphDigest: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}

type ObservationConstraint =
  | {
      readonly kind: "value";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: ObservationVisibility;
      readonly equivalenceDomainId: string;
      readonly consistencyCutId: string;
    }
  | {
      readonly kind: "dom";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: ObservationVisibility;
      readonly realizationDomainId: string;
      readonly mutableFacetPolicyId: string;
      readonly consistencyCutId: string;
    }
  | {
      readonly kind: "artifact" | "protocol";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: ObservationVisibility;
      readonly byteOrMessageSchemaId: string;
      readonly cardinality: ObservationCardinality;
    }
  | {
      readonly kind: "event" | "effect" | "callback";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: ObservationVisibility;
      readonly inputIdentityDomainId: string;
      readonly occurrenceIdentityDomainId: string;
      readonly cardinality: ObservationCardinality;
      readonly admissionCutId: string;
      readonly coalescingPolicyRequirement: ObservationPolicyRequirement | null;
    }
  | {
      readonly kind: "identity" | "lifetime";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: ObservationVisibility;
      readonly identityDomainId: string;
      readonly lifetimeDomainId: string;
    }
  | {
      readonly kind: "authority" | "exposure";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: ObservationVisibility;
      readonly policyQualifiedId: QualifiedRegistryId<"policy">;
      readonly policyEpochDomainId: string;
    }
  | {
      readonly kind: "terminal";
      readonly id: Sha256Digest;
      readonly subjectId: string;
      readonly visibility: "external";
      readonly outcomes: readonly (
        | "success"
        | "typed-failure"
        | "cancelled"
        | "timed-out"
        | "disconnected"
        | "ambiguous"
      )[];
    };

interface ObservationOrderEdge {
  readonly id: Sha256Digest;
  readonly beforeConstraintId: Sha256Digest;
  readonly afterConstraintId: Sha256Digest;
  readonly relation: "strict" | "serial" | "exclusive";
}

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

interface CanonicalRecord<Preimage> {
  readonly id: Sha256Digest;
  readonly preimage: Preimage;
}
```

cardinality の count、minimum、maximum は非負の safe integer とし、range は `minimum <= maximum` を満たす。
cardinality field を持たない constraint の実効 cardinality は `exactly(1)` とする。
`omit-unobservable-internal-step` は `internal-ordering` の constraint にだけ適用できる。

`strict` は、両 constraint の occurrence が存在するときに全 before occurrence が全 after occurrence より先行する関係である。
`serial` は strict に加えて両 constraint の occurrence union が全順序になることを要求する。
`exclusive` は両 constraint の同一 trace 内での共存を禁止し、有向 closure には加えない。

strict と serial の self edge と cycle を拒否する。
exclusive の pair は小さい constraint ID を `beforeConstraintId` に置く。

#### Canonical trace language

一つの concrete trace は cardinality range、入力依存の分岐、event 間の相関を証明できない。
source と candidate の behavior は、external input の canonical finite partition class ごとの有限 trace language として表す。

```ts
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
      readonly outcome:
        | "success"
        | "typed-failure"
        | "cancelled"
        | "timed-out"
        | "disconnected"
        | "ambiguous";
    };

interface ObservationAutomatonTransition {
  readonly fromState: number;
  readonly symbolId: Sha256Digest;
  readonly toState: number;
}

interface ObservationTraceLanguagePreimage {
  readonly schema: "dathra.observation-trace-language/1";
  readonly alphabet: readonly ObservationTraceSymbol[];
  readonly stateCount: number;
  readonly initialState: 0;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

interface ObservationAutomatonBudget {
  readonly maximumAlphabetSize: number;
  readonly maximumStateCount: number;
  readonly maximumTransitionCount: number;
  readonly maximumDeterminizedStateCount: number;
  readonly maximumProductStateCount: number;
}

interface ObservationBehaviorSummaryPreimage {
  readonly schema: "dathra.observation-behavior/1";
  readonly role: "source" | "candidate";
  readonly observationContractId: Sha256Digest;
  readonly semanticGraphDigest: Sha256Digest;
  readonly inputPartitionDigest: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly traceLanguageId: Sha256Digest;
  }[];
}

interface ObservationBehaviorDerivationClaimPreimage {
  readonly schema: "dathra.observation-behavior-derivation-claim/1";
  readonly behaviorSummaryId: Sha256Digest;
  readonly observationContractId: Sha256Digest;
  readonly semanticGraphDigest: Sha256Digest;
  readonly inputPartitionDigest: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
}
```

trace language は reachable、deterministic、complete、minimal な DFA とする。
DFA を最小化した後、initial state から symbol ID 順に breadth-first traversal して state number を振り直す。
alphabet、accepting state、transition table は canonical order に固定し、DFA 全体を一つの preimage として hash する。
alphabet に含める symbol は accepted word のいずれかに出現するものだけとし、常に rejecting sink へ進む未使用 symbol を canonical language に残さない。

state ごとの recursive hash は cycle を作るため使用しない。
initial state から到達でき、accepting state へ到達できる productive cycle は有限 cardinality contract に反するため拒否する。
normalization、projection、determinization、product inclusion は toolchain profile が与える hard automaton budget を消費する。
budget を超えた場合は dependency path を持つ typed diagnostic とし、部分的な relation、近似 equality、runtime fallback を生成しない。

event と occurrence は同じ alphabet に置く。
同じ callback body または同じ label を持つ occurrence も、constraint ID、identity domain、ordinal から作る別 slot とする。
各 partial order と両立する全 linearization を language に含めるため、独立な `a0` と `a1` は `a0 a1` と `a1 a0` の両方を持ち、直列化された trace と区別できる。

BehaviorSummary の summary ID は semantic graph digest を束縛する。
trace equality の比較対象から role、semantic graph digest、summary ID を除き、input class ごとの canonical language ID を比較する。
summary が semantic graph と contract の全 behavior を被覆することは、summary ID、graph digest、contract ID、input partition digest を持つ derivation claim に対する proof acceptance で証明する。

#### Equality と refinement

`trace-equality` は、source と candidate が同じ contract と input class 集合を持ち、class ごとの canonical trace language が一致する場合だけ合法とする。
cardinality、terminal outcome、occurrence identity、partial order は alphabet と accepted language に含まれるため、別の unchecked summary field へ退避しない。
OC01 は accepted language と cardinality counter、terminal checker、strict、serial、exclusive の violation automaton を product し、contract に違反する accepted word が存在しないことを検証する。
accepted word を全列挙して検証したことにはしない。

refinement は、actual relation `R` と rule-derived allowed relation `A` を分けて判定する。

```ts
interface ObservationRelationSymbol {
  readonly id: Sha256Digest;
  readonly sourceSymbolId: Sha256Digest | null;
  readonly candidateSymbolId: Sha256Digest | null;
  readonly ruleId: Sha256Digest | null;
}

interface ObservationRelationLanguagePreimage {
  readonly schema: "dathra.observation-relation-language/1";
  readonly alphabet: readonly ObservationRelationSymbol[];
  readonly stateCount: number;
  readonly initialState: 0;
  readonly acceptingStates: readonly number[];
  readonly transitions: readonly ObservationAutomatonTransition[];
}

type ObservationRuleApplicationPreimage = {
  readonly schema: "dathra.observation-rule-application/1";
  readonly ruleId: Sha256Digest;
  readonly sourceSummaryId: Sha256Digest;
  readonly candidateSummaryId: Sha256Digest;
  readonly inputClassId: Sha256Digest;
  readonly proofDomainId: Sha256Digest;
  readonly allowedRelationLanguageId: Sha256Digest;
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
      readonly independenceRelationDigest: Sha256Digest;
    }
  | {
      readonly kind: "declared-event-coalescing";
      readonly constraintId: Sha256Digest;
      readonly policyTransducerLanguageId: Sha256Digest;
      readonly eventSlotMappings: readonly {
        readonly sourceEventSymbolId: Sha256Digest;
        readonly candidateOccurrenceSymbolId: Sha256Digest;
      }[];
      readonly overflowTerminalSymbolId: Sha256Digest | null;
    }
);

interface ObservationComparisonClaimPreimage {
  readonly schema: "dathra.observation-comparison-claim/1";
  readonly observationContractId: Sha256Digest;
  readonly compositionId: Sha256Digest | null;
  readonly direction: "source-to-candidate";
  readonly sourceSummaryId: Sha256Digest;
  readonly candidateSummaryId: Sha256Digest;
  readonly inputClasses: readonly {
    readonly inputClassId: Sha256Digest;
    readonly actualRelationLanguageId: Sha256Digest;
    readonly allowedRelationLanguageId: Sha256Digest;
    readonly ruleApplicationIds: readonly Sha256Digest[];
  }[];
}

interface ObservationProofAcceptancePreimage {
  readonly schema: "dathra.observation-proof-acceptance/1";
  readonly proofDomainId: Sha256Digest;
  readonly claimDigest: Sha256Digest;
  readonly attestationDigest: Sha256Digest;
}

interface AcceptedObservationRelationPreimage {
  readonly schema: "dathra.accepted-observation-relation/1";
  readonly comparisonClaimDigest: Sha256Digest;
  readonly sourceDerivationAcceptanceId: Sha256Digest;
  readonly candidateDerivationAcceptanceId: Sha256Digest;
  readonly ruleApplicationAcceptanceIds: readonly Sha256Digest[];
}
```

relation symbol は source と candidate の少なくとも一方を持つ。
actual relation の source projection と candidate projection を epsilon-NFA projection、determinization、minimization によって再構築し、各 BehaviorSummary の language と完全一致させる。
この projection equality は trace 集合の被覆を証明するが、rule 適合性そのものは証明しない。

OC01 は contract の refinement rule、accepted value pair、cardinality interval と slot mapping、internal omission、composition algebra の independence relation、coalescing policy の canonical finite-state transducer から allowed relation `A` を生成する。
そのうえで product emptiness により `R subset-of A` を検証する。
proof acceptance だけを根拠に arbitrary relation を合法化しない。

equivalent value は同じ equivalence domain が受理した token pair、cardinality narrowing は source interval の部分集合、internal omission は `internal-ordering` slot、reorder は composition が宣言した independence relationだけを許可する。
coalescing は event slot から output occurrence slot への total mapping、空でない output preimage、quotient language、cardinality、overflow terminal を allowed relation に含める。
callback body の一致または同じ task 内の発生は rule application にならない。

claim、proof acceptance、accepted relation は別の content-addressed record とする。
claim は contract、composition、方向、source/candidate summary、rule、slot mapping、cardinality、overflow、binding を束縛する。
proof acceptance は versioned content-addressed proof domain、exact claim digest、attestation digest を束縛する。
proof acceptance は proof-domain verifier が検証済み context にだけ生成し、untrusted wire record から brand を復元しない。
