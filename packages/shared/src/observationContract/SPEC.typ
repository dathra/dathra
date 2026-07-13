= observation contract

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

compiler、artifact finalizer、server runtime、browser runtime が、root の観測条件、source と candidate の trace relation、shared subject の composition、server realization を同じ closed schema と canonical identity で扱うための共通 contract を提供する。

OC01 は pure data の snapshot、canonical finite automaton、language projection、language inclusion、composition derivation、witness validation だけを提供する。

ExecutionGraph と candidate の生成は EG03 と CN01、proof-domain algorithm は registry implementation、exact artifact reproduction は AF01、post-finalization selection と admission sidecar は SL01、runtime conformance は RR01 が担当する。

== 設計判断

#adr(
  header("Observation record を side-effect-free な content-addressed value にする", Status.Accepted, "2026-07-12"),
  [
    contract、trace language、claim、witness の検証中に getter、custom prototype、host object を実行すると、同じ source から異なる identity と判定が生成され得る。
  ],
  [
    canonical identity と同じ plain record、null-prototype record、standard dense array、enumerable data property の制約を適用する。
    record は unknown field、accessor、hidden property、symbol property、custom prototype、cycle、unsupported value を拒否し、deep-frozen snapshot として返す。
    record ID は自身の ID field を除いた canonical preimage の SHA-256 digest、wrapper ID は canonical preimage 全体の digest とする。
  ],
  [
    - parser と creator は author callback と URL host object を実行しない
    - untrusted wire value から TypeScript brand を直接復元しない
    - digest API は WebCrypto を使うため creator と parser は非同期になる
  ],
)

#adr(
  header("Behavior を input class ごとの canonical finite trace language にする", Status.Accepted, "2026-07-12"),
  [
    一回の concrete trace または constraint ごとの cardinality summary だけでは、入力依存の分岐、排他、回数相関、partial order を一意に表せない。
  ],
  [
    external input の canonical finite partition class ごとに、event、occurrence、terminal symbol の有限 language を complete minimal DFA で表す。
    finite maximum cardinality に従って event と occurrence を ordinal slot へ展開し、同じ label を持つ複数 occurrence を別 symbol にする。
    partial order と両立する全 linearization を language に含める。
    DFA は minimization 後に initial state から symbol ID 順の breadth-first traversal で state number を振り直す。
  ],
  [
    - 同じ language は author が付けた state name と transition insertion order によらず同じ ID になる
    - productive accepting cycle は有限 cardinality contract に反するため拒否する
    - normalization、determinization、product inclusion は hard budget を超えると typed failure になり、近似結果を返さない
  ],
)

#adr(
  header("Refinement を coverage と rule inclusion の二段階で判定する", Status.Accepted, "2026-07-12"),
  [
    actual relation の source projection と candidate projection が各 behavior language に一致しても、その relation が contract rule に適合するとは限らない。
    proof acceptance の存在だけで arbitrary relation を許すと、別の value pair または trace に proof を再利用できる。
  ],
  [
    actual relation `R` の両 projection を epsilon-NFA projection、determinization、minimizationで再構築し、source と candidate language に完全一致させる。
    contract rule、accepted token pair、cardinality slot mapping、internal omission、composition algebra、coalescing transducer から allowed relation `A` を生成する。
    product emptiness で `R subset-of A` を検証する。
    proof acceptance は versioned proof-domain ID、exact claim digest、attestation digest を束縛する。
  ],
  [
    - projection equality は trace 集合の被覆を検証し、language inclusion は rule 適合性を検証する
    - callback body の一致または同じ task 内の発生は rule application にならない
    - claim、proof acceptance、accepted relation を分けるため digest cycle がない
  ],
)

#adr(
  header("Composition を subject と constraint kind ごとの canonical result view にする", Status.Accepted, "2026-07-12"),
  [
    subject 単位で一つの resolution しか持てない schema は、identity、DOM、effect など複数 facet を共有する contract を表せない。
    constraint ID だけでは同じ constraint が複数 contract に現れた場合の owner を識別できない。
  ],
  [
    constraint reference は contract ID と constraint ID の pair とする。
    binding は `(sharedSubjectId, constraintKind)` ごとに一件とし、`merge-identical`、`exclusive-owner`、`commutative`、`total-order` の closed resolution を持つ。
    creator は result constraint、全 member-to-result mapping、result order closure を導出する。
    member/result behavior は multi-tape relation language の各 projection と allowed composition relation への inclusion で検証する。
  ],
  [
    - semantic domain field の不一致を commutativity または total order で上書きしない
    - exclusive owner の cardinality と outcome は全 non-owner member の許容範囲の部分集合にする
    - caller が渡した result view と再導出結果が異なる composition を拒否する
  ],
)

#adr(
  header("RealizationWitness を concrete instance と symbolic coverage に分ける", Status.Accepted, "2026-07-12"),
  [
    constraint ID ごとに provenance を一件置くだけでは、各 observable node と value の由来、parser step の連続性、全 input class の server materialization を証明できない。
    token stream の一致だけでは raw artifact bytes の同一性を証明できない。
  ],
  [
    concrete witness は一つの render instance、atomic obligation、artifact-token step、parser-operation step、input/output token、parser sequence を束縛する。
    WitnessTemplate は obligation record の実体と canonical symbolic sequence language を所有する。
    coverage claim は input class ごとに exactly one template を割り当てる。
    AF01 は raw exact byte digest、byte length、encoding、content type、parser profile ID と version、parser input bytes digest、token stream digest を再現した record を生成する。
  ],
  [
    - DSD は artifact token から parser operation へ進む chain として証明する
    - upgrade と adopt の author effect は記録するが server realization step にしない
    - SL01 は AF01 の reproduction record を post-finalization witness と admission sidecar に束縛する
    - dynamic response は RenderOperation が instance byte stream と witness step を commit protocol 内で検証する
  ],
)

#adr(
  header("contract-free DFA と contract conformance を分離する", Status.Accepted, "2026-07-12"),
  [
    `createObservationTraceLanguage` の入力には ObservationContract と external input partition がないため、従来の interface constraint が要求した cardinality、terminal、order、input class の適合性を creator だけでは判定できない。
    この判断は「Behavior を input class ごとの canonical finite trace language にする」のうち、creator が contract 適合性まで保証する意味を supersede する。
  ],
  [
    trace language creator と parser は canonical finite DFA だけを保証する。
    content-addressed input partition は canonical universe language と class selector language の実体を所有する。
    非同期 behavior validator は selector の相互排他と全域被覆、event projection、occurrence slot、cardinality、terminal、strict、serial、exclusive を hard-budget product で検証する。
    検証済み behavior は summary、contract、partition、partition policy acceptance、behavior derivation acceptance を束縛する AcceptedObservationBehavior になる。
  ],
  [
    - accepted word を列挙しない
    - selector symbol と external input schema の意味対応は独立した partition policy acceptance が証明する
    - partition policy acceptance は automaton の subset、intersection、union 検査を代替しない
  ],
)

#adr(
  header("allowed relation を policy product から再導出する", Status.Accepted, "2026-07-12"),
  [
    caller が `allowedRelationLanguageId` を指定できる schema では、`A = R` を渡して cardinality、coalescing、commutativity の制約を迂回できる。
    trusted ID に含まれる record の digest を再計算しない validator では、正規の ID と別 claim の preimage を組み合わせられる。
    この判断は「Refinement を coverage と rule inclusion の二段階で判定する」の claim schema と proof trust 手順を supersede する。
  ],
  [
    rule application と comparison claim から global allowed relation ID を削除する。
    OC01 は source/candidate DFA、constraint-qualified local mapping、独立して証明された rule-policy transducer の product から `A` を生成する。
    semantic validator と acceptor は非同期にし、proof acceptance を closed parse して digest を再計算した後だけ external trusted ID set を参照する。
    `acceptObservationRelation` は accepted source/candidate behavior、actual relation、derived `A`、全 application acceptance の closure を再検証して AcceptedObservationRelation を生成する。
  ],
  [
    - policy descriptor、policy claim、policy acceptance、application、comparison、derived `A`、accepted relation の順序は非巡回にする
    - policy claim は application、comparison、derived `A` を参照しない
    - identity 以外の local mapping は rule の constraint、symbol kind、slot、epsilon 方向、policy transducer に完全に解決する
  ],
)

#adr(
  header("rule policy identity と composition binding を閉じる", Status.Accepted, "2026-07-12"),
  [
    rule policy descriptor `/1` は qualified policy ID だけを持つため、同じ ID の policy 実装が変更されても application の意味を固定できない。
    `commutative-reorder` application が持つ composition ID と binding ID を解決しない場合、存在しない binding または別 contract の binding を policy の根拠にできる。
    この判断は「allowed relation を policy product から再導出する」の rule policy descriptor `/1` と commutative application の validation closure を supersede する。
  ],
  [
    rule policy descriptor `/2` は qualified policy ID、version、immutable policy rule graph digest、proof domain を束縛する。
    relation acceptance は composition と exact member contract closure を受け取り、composition `/4` を再導出してから commutative application の composition ID と binding ID を解決する。
    application の contract は composition member でなければならず、rule の constraint ID 集合は binding に含まれる同じ contract の constraint ID 集合と完全一致させる。
    binding は commutative resolution でなければならず、その policy requirement と descriptor の policy ID、version、rule graph digest、proof domain を完全一致させる。
  ],
  [
    - comparison claim の composition ID は全 commutative application の composition ID と一致させる
    - commutative policy symbol は source と candidate の両方を進める occurrence pair とし、両 constraint を binding-local な rule constraint に解決する
    - duplicate、extra、unreferenced composition context を拒否する
  ],
)

#adr(
  header("coalescing policy requirement を contract に固定する", Status.Accepted, "2026-07-12"),
  [
    event、effect、callback constraint の `coalescingPolicyId: string` と rule policy descriptor の qualified policy ID、version、rule graph digest は相互に比較できない。
    qualified policy ID だけを constraint に持たせても、同じ ID の別 version、別 rule graph、別 proof domain への差し替えを防げない。
    この判断は ObservationContract `/2` の coalescing policy field と RuleApplication `/2` の declared-event-coalescing variant を supersede する。
  ],
  [
    ObservationContract `/3` は coalescing 対象 constraint に `ObservationPolicyRequirement` または null を持たせる。
    requirement は qualified policy ID、version、immutable policy rule graph digest、proof domain を束縛する。
    RuleApplication `/3` は重複する coalescing policy string を持たず、constraint ID、policy descriptor ID、policy acceptance ID、slot mapping を束縛する。
    relation derivation は constraint requirement と descriptor の四項目を完全一致させる。
  ],
  [
    - requirement は descriptor、transducer、claim、acceptance、application の ID を含めないため proof DAG は非巡回に保たれる
    - policy rule graph digest は OC01 の下流 record を参照しない immutable upstream identity とする
    - old string field、qualified ID だけの requirement、requirement と不一致な descriptor を拒否する
  ],
)

#adr(
  header("composition result を独立した trace-equality contract にする", Status.Accepted, "2026-07-12"),
  [
    algebra ID だけを持つ composition は operation kind と allowed multi-tape relation を再導出できない。
    result constraint ID だけでは result BehaviorSummary が参照する ObservationContract も存在しない。
    この判断は「Composition を subject と constraint kind ごとの canonical result view にする」の `/2` schema を supersede する。
  ],
  [
    composition `/3` は先行する versioned algebra descriptor、policy transducer、trusted policy acceptance を binding に持つ。
    creator は caller の closed result header と member contract から result constraints、mapping、order closure を導出し、refinement rule を持たない独立した trace-equality ObservationContract を生成する。
    composition は full result contract を所有し、result contract は composition ID を参照しない。
    accepted composition は policy product から multi-tape `A` を導出し、全 member projection、result projection、actual inclusion を検証する。
  ],
  [
    - commutative と total-order の両方が policy acceptance を必要とする
    - 非 identity multi-tape symbol は exact binding ID を持つ
    - member-to-result の変換許可は result contract ではなく derived multi-tape `A` が所有する
  ],
)

#adr(
  header("composition policy を class-local な非巡回 closure にする", Status.Accepted, "2026-07-12"),
  [
    binding `/2` が descriptor と acceptance を参照し、descriptor が policy language、policy symbol が exact binding ID を参照すると content digest の fixed point が必要になる。
    composition-global policy application は input class ごとに異なる trace alphabet を束縛できない。
    この判断は「composition result を独立した trace-equality contract にする」の descriptor、language、acceptance を binding より先に生成する順序と binding `/2`、composition `/3`、claim `/2`、accepted composition `/1` schema を supersede する。
  ],
  [
    binding `/3` は structural resolution と immutable policy requirement だけを持ち、composition `/4` は independent result contract を維持する。
    class-local policy application は composition、class、member/result language、binding、descriptor、language を束縛し、composition 専用 derivation claim と trusted acceptance を後段で生成する。
    composition claim `/3` と accepted composition `/2` は binding、application、derivation claim、acceptance の exact class-local closure を持つ。
    derived allowed relation は actual relation と composition claim ID に依存せず、検証済み policy closure だけから生成する。
  ],
  [
    - policy requirement と descriptor は qualified policy ID、version、immutable rule graph digest、proof domain を完全一致させる
    - policy symbol は binding-local な exactly one member tape と対応する result constraint だけを進める
    - policy binding は class ごとに exactly one closure、非 policy binding は zero closure とする
    - OC01 は typed explicit reference DAG を保証し、opaque attestation の upstream-only branded trust admission は SC03 と RR01 が検証する
  ],
)

#adr(
  header("coverage acceptance を witness 自身へ束縛する", Status.Accepted, "2026-07-12"),
  [
    BehaviorSummary と coverage claim を受け取らない witness validator は、全 input class への exactly-one template と trusted coverage acceptance を検証できない。
    template symbol の artifact class と concrete artifact step が接続されず、一部だけ artifact-rooted な parser graph も DSD provenance を通過できる。
    この判断は「RealizationWitness を concrete instance と symbolic coverage に分ける」の `/2` witness schema を supersede する。
  ],
  [
    coverage validator は full BehaviorSummary、InputPartition、全 template、全 sequence language、coverage claim、trusted acceptance の exact closure を検証する。
    witness `/3` は coverage claim ID、coverage acceptance ID、selected template ID、sequence claim ID を自身の preimage に持つ。
    artifact concrete step は `artifactTokenClassId` を持ち、template symbol と一致する。
    DOM obligation の全 provenance path は non-empty で artifact-token root に到達する。
  ],
  [
    - zero-input parser branch を DSD provenance に使わない
    - artifact-rooted branch と未証明 branch の合流を受理しない
    - symbolic token relation と concrete output の意味対応は exact sequence claim に対する trusted proof-domain acceptance が証明する
  ],
)

== interface specification

#interface_spec(
  name: "Observation constraint and contract",
  summary: [
    root の value、DOM、artifact、protocol、event、effect、callback、identity、lifetime、authority、exposure、terminal を content-addressed closed constraint として定義する。
  ],
  format: [
    ```typescript
    type ObservationCardinality =
      | { readonly kind: "exactly"; readonly count: number }
      | { readonly kind: "range"; readonly minimum: number; readonly maximum: number }

    type ObservationVisibility = "external" | "internal-ordering"
    interface ObservationPolicyRequirement {
      readonly policyQualifiedId: QualifiedRegistryId<"policy">
      readonly version: string
      readonly policyRuleGraphDigest: Sha256Digest
      readonly proofDomainId: Sha256Digest
    }
    type ObservationConstraint
    type ObservationConstraintInput
    type ObservationOrderEdge
    type ObservationOrderEdgeInput
    type ObservationRefinementRule
    type ObservationRefinementRuleInput

    interface ObservationContractPreimage {
      readonly schema: "dathra.observation-contract/3"
      readonly rootDefinitionId: string
      readonly externalInputIdentitySchemaId: string
      readonly eventIdentitySchemaId: string
      readonly initialCutId: string
      readonly relation: "trace-equality" | "trace-refinement"
      readonly constraints: readonly ObservationConstraint[]
      readonly orderEdges: readonly ObservationOrderEdge[]
      readonly refinementRules: readonly ObservationRefinementRule[]
    }

    interface ObservationContract {
      readonly id: Sha256Digest
      readonly preimage: ObservationContractPreimage
    }

    function createObservationConstraint(input: ObservationConstraintInput): Promise<ObservationConstraint>
    function createObservationOrderEdge(input: ObservationOrderEdgeInput): Promise<ObservationOrderEdge>
    function createObservationRefinementRule(input: ObservationRefinementRuleInput): Promise<ObservationRefinementRule>
    function createObservationContract(input: ObservationContractInput): Promise<ObservationContract>
    function parseObservationContract(value: unknown): Promise<ObservationContract>
    ```
  ],
  constraints: [
    - cardinality value は非負の safe integer とし、range は `minimum <= maximum` とする
    - cardinality field を持たない constraint の実効 cardinality は `exactly(1)` とする
    - terminal constraint は `external` とし、outcome は non-empty、strictly sorted、duplicate-free とする
    - constraint、edge、rule は ID 順、rule の constraint ID は strictly sorted とする
    - edge endpoint と rule constraint は同じ contract 内に解決する
    - strict と serial の self edge と cycle、exclusive の非 canonical orientation を拒否する
    - trace-equality contract は refinement rule を持たない
    - omit rule は internal-ordering constraint、coalescing rule は non-null immutable policy requirement を持つ event、effect、callback にだけ適用する
    - coalescing policy requirement は qualified policy ID、version、immutable rule graph digest、proof domain を束縛する
    - 同じ constraint に同種または競合する cardinality-changing rule を複数適用しない
  ],
)

#interface_spec(
  name: "Canonical trace language",
  summary: [
    finite observation trace set を canonical complete minimal DFA として生成、parse、比較する。
  ],
  format: [
    ```typescript
    type ObservationTraceSymbol
    type ObservationTraceSymbolInput

    interface ObservationAutomatonBudget {
      readonly maximumAlphabetSize: number
      readonly maximumStateCount: number
      readonly maximumTransitionCount: number
      readonly maximumDeterminizedStateCount: number
      readonly maximumProductStateCount: number
    }

    interface ObservationTraceLanguage
    interface ObservationTraceLanguageInput

    function createObservationTraceSymbol(
      input: ObservationTraceSymbolInput
    ): Promise<ObservationTraceSymbol>

    function createObservationTraceLanguage(
      input: ObservationTraceLanguageInput,
      budget: ObservationAutomatonBudget
    ): Promise<ObservationTraceLanguage>

    function parseObservationTraceLanguage(
      value: unknown,
      budget: ObservationAutomatonBudget
    ): Promise<ObservationTraceLanguage>

    function isObservationTraceLanguageSubset(
      left: ObservationTraceLanguage,
      right: ObservationTraceLanguage,
      budget: ObservationAutomatonBudget
    ): boolean
    ```
  ],
  constraints: [
    - creator は unreachable state を除き、rejecting sink で complete 化し、partition refinement で minimize する
    - creator は initial state から symbol ID 順に breadth-first traversal して state number を0から振り直す
    - parser は reachable、complete、minimal、canonical numbering、canonical table order を再検証し、入力を並べ替えて受理しない
    - alphabet symbol は accepted word のいずれかに出現するものだけを canonical language に残す
    - creator と parser は contract-free な automaton operation とし、event selector、occurrence ordinal、cardinality、terminal、order の意味検証は behavior validator が行う
    - accepted path 上の productive cycle を拒否する
    - subset は product graph で `left accepting && right rejecting` state の到達不能を検証する
    - budget 超過を typed failure とし、partial DFA または approximation を返さない
  ],
)

#interface_spec(
  name: "Behavior summary and relation comparison",
  summary: [
    external input universe の finite partition、contract-conformant behavior、policy-derived relation acceptance を canonical record にする。
  ],
  format: [
    ```typescript
    interface ObservationInputLanguage
    interface ObservationInputClassDescriptor
    interface ObservationInputPartition
    interface ObservationInputPartitionPolicyClaim
    interface ObservationBehaviorSummary
    interface ObservationBehaviorDerivationClaim
    interface AcceptedObservationBehavior
    interface ObservationRelationLanguage
    interface ObservationRulePolicyDescriptor
    interface ObservationPolicyDerivationClaim
    interface ObservationRuleApplication
    interface ObservationComparisonClaim
    interface ObservationRelationCompositionContext {
      readonly composition: ObservationComposition
      readonly memberContracts: readonly ObservationContract[]
    }
    interface ObservationProofAcceptance
    interface ObservationProofAcceptanceInput
    interface ObservationEqualityInput
    interface TrustedObservationProofContext {
      readonly proofAcceptances: readonly ObservationProofAcceptance[]
      readonly trustedProofAcceptanceIds: readonly Sha256Digest[]
    }
    interface AcceptedObservationRelation

    function createObservationInputLanguage(input: ObservationInputLanguageInput, budget: ObservationAutomatonBudget): Promise<ObservationInputLanguage>
    function parseObservationInputLanguage(value: unknown, budget: ObservationAutomatonBudget): Promise<ObservationInputLanguage>
    function isObservationInputLanguageSubset(left: ObservationInputLanguage, right: ObservationInputLanguage, budget: ObservationAutomatonBudget): boolean
    function areObservationInputLanguagesDisjoint(left: ObservationInputLanguage, right: ObservationInputLanguage, budget: ObservationAutomatonBudget): boolean
    function unionObservationInputLanguages(languages: readonly ObservationInputLanguage[], budget: ObservationAutomatonBudget): Promise<ObservationInputLanguage>
    function createObservationInputClassDescriptor(input: ObservationInputClassDescriptorInput): Promise<ObservationInputClassDescriptor>
    function createObservationInputPartition(input: ObservationInputPartitionInput): Promise<ObservationInputPartition>
    function createObservationInputPartitionPolicyClaim(input: ObservationInputPartitionPolicyClaimInput): Promise<ObservationInputPartitionPolicyClaim>
    function createObservationBehaviorSummary(input: ObservationBehaviorSummaryInput): Promise<ObservationBehaviorSummary>
    function parseObservationBehaviorSummary(value: unknown): Promise<ObservationBehaviorSummary>
    function createObservationBehaviorDerivationClaim(input: ObservationBehaviorDerivationClaimInput): Promise<ObservationBehaviorDerivationClaim>
    function validateObservationBehaviorSummary(input: ObservationBehaviorValidationInput): Promise<AcceptedObservationBehavior>

    function createObservationRelationSymbol(
      input: ObservationRelationSymbolInput
    ): Promise<ObservationRelationSymbol>

    function createObservationRelationLanguage(
      input: ObservationRelationLanguageInput,
      budget: ObservationAutomatonBudget
    ): Promise<ObservationRelationLanguage>
    function parseObservationRelationLanguage(value: unknown, budget: ObservationAutomatonBudget): Promise<ObservationRelationLanguage>

    function projectObservationRelationLanguage(
      relation: ObservationRelationLanguage,
      side: "source" | "candidate",
      target: ObservationTraceLanguage,
      budget: ObservationAutomatonBudget
    ): Promise<ObservationTraceLanguage>

    function compareObservationBehaviorEquality(input: ObservationEqualityInput): Promise<ObservationComparisonDecision>
    function createObservationRulePolicyDescriptor(input: ObservationRulePolicyDescriptorInput): Promise<ObservationRulePolicyDescriptor>
    function createObservationPolicyDerivationClaim(input: ObservationPolicyDerivationClaimInput): Promise<ObservationPolicyDerivationClaim>
    function createObservationRuleApplication(input: ObservationRuleApplicationInput): Promise<ObservationRuleApplication>
    function createObservationComparisonClaim(input: ObservationComparisonClaimInput): Promise<ObservationComparisonClaim>
    function deriveAllowedObservationRelationLanguage(input: ObservationAllowedRelationDerivationInput): Promise<ObservationRelationLanguage>
    function createObservationProofAcceptance(input: ObservationProofAcceptanceInput): Promise<ObservationProofAcceptance>
    function parseObservationProofAcceptance(value: unknown): Promise<ObservationProofAcceptance>
    function acceptObservationRelation(input: ObservationRelationAcceptanceInput): Promise<AcceptedObservationRelation>
    ```
  ],
  constraints: [
    - input language は event symbol だけを持つ canonical complete minimal finite DFA とする
    - input partition は canonical universe language を pairwise-disjoint selector language で過不足なく被覆する
    - partition policy claim は external input schema、event schema、initial cut、universe、全 descriptor を束縛し、automaton の被覆検査を代替しない
    - summary は contract ID、semantic graph digest、input partition ID、input class descriptor ID と language ID の exact mapping を持つ
    - behavior validation は event projection、occurrence slot reuse、cardinality、terminal outcome、strict、serial、exclusive を budgeted product で検証する
    - candidate behavior の `omit-unobservable-internal-step` 対象 constraint だけは実効 cardinality の minimum を0とし、source behavior と rule 対象外 constraint は contract の cardinality を維持する
    - source と candidate の accepted behavior は summary ID、graph、contract、partition、partition policy acceptance、behavior derivation acceptance を束縛する
    - relation acceptance の source/candidate summary と behavior validation contract は top-level relation contract と完全一致する
    - comparison claim の input class 集合は source/candidate behavior と同じ partition の全 class に完全一致する
    - equality は role、semantic graph digest、summary ID を除いた input-class language の完全一致とする
    - relation symbol は source と candidate の少なくとも一方を持つ
    - actual relation の両 projection は対応する source と candidate language に完全一致する
    - comparison claim は actual relation と rule application closure を持ち、caller-supplied allowed relation ID を持たない
    - rule application は constraint-qualified symbol、slot、epsilon direction を閉じ、対象外 symbol を identity としてだけ扱う
    - rule policy descriptor `/2` は qualified policy ID、version、immutable policy rule graph digest、proof domain を束縛する
    - commutative と coalescing は application より先に生成、検証された policy descriptor、transducer、acceptance を参照する
    - declared-event-coalescing application `/3` は重複する policy string を持たず、constraint の policy requirement と descriptor を完全一致させる
    - coalescing policy transducer の非 identity symbol は candidate 側の対象 occurrence または宣言済み overflow terminal だけを進め、source 側と rule 対象外 constraint を進めない
    - commutative application は再導出済み composition `/4` の exact binding に解決し、comparison claim、member contract、rule constraint、binding policy requirement と完全一致する
    - commutative application がない comparison claim の composition ID は null とし、存在する場合は全 application と exact composition context に一致させる
    - commutative policy symbol の source と candidate は binding-local な occurrence constraint に解決する
    - allowed relation は source/candidate DFA、local mapping、lifted policy transducer の budgeted product から再導出する
    - actual relation は derived allowed relation の subset でなければならない
    - semantic validator は proof acceptance を closed parse して digest を再計算した後だけ trusted ID set を参照する
    - 同じ proof domain と claim に一致する trusted acceptance は exactly one とし、複数の attestation が一致する場合は曖昧として拒否する
    - acceptObservationRelation は comparison、source/candidate accepted behavior、全 rule acceptance、derived allowed relation を exact に束縛する
    - duplicate rule application を exact closure 違反として拒否する
    - relation acceptance は duplicate、extra、unreferenced composition context を拒否する
  ],
)

#interface_spec(
  name: "Observation composition",
  summary: [
    shared subject の member contract を kind ごとに join し、canonical result view と member/result language relation を検証する。
  ],
  format: [
    ```typescript
    interface ObservationConstraintReference
    interface ObservationCompositionResultContractHeader
    interface ObservationPolicyRequirement
    interface ObservationCompositionAlgebraDescriptor
    interface ObservationCompositionBinding
    interface ObservationComposition
    interface ObservationCompositionRelationLanguage
    interface ObservationCompositionPolicyApplication
    interface ObservationCompositionPolicyDerivationClaim
    interface ObservationCompositionClaim
    interface AcceptedObservationComposition

    function createObservationCompositionAlgebraDescriptor(
      input: ObservationCompositionAlgebraDescriptorInput
    ): Promise<ObservationCompositionAlgebraDescriptor>

    function createObservationCompositionBinding(
      input: ObservationCompositionBindingInput
    ): Promise<ObservationCompositionBinding>

    function createObservationComposition(
      input: ObservationCompositionInput
    ): Promise<ObservationComposition>

    function parseObservationComposition(
      value: unknown,
      memberContracts: readonly ObservationContract[]
    ): Promise<ObservationComposition>

    function createObservationCompositionRelationLanguage(
      input: ObservationCompositionRelationLanguageInput,
      budget: ObservationAutomatonBudget
    ): Promise<ObservationCompositionRelationLanguage>

    function parseObservationCompositionRelationLanguage(
      value: unknown,
      budget: ObservationAutomatonBudget
    ): Promise<ObservationCompositionRelationLanguage>

    function createObservationCompositionPolicyApplication(
      input: ObservationCompositionPolicyApplicationInput
    ): Promise<ObservationCompositionPolicyApplication>

    function createObservationCompositionPolicyDerivationClaim(
      input: ObservationCompositionPolicyDerivationClaimInput
    ): Promise<ObservationCompositionPolicyDerivationClaim>

    function createObservationCompositionClaim(
      input: ObservationCompositionClaimInput
    ): Promise<ObservationCompositionClaim>

    function deriveAllowedObservationCompositionRelationLanguage(
      input: ObservationCompositionRelationDerivationInput
    ): Promise<ObservationCompositionRelationLanguage>

    function acceptObservationComposition(
      input: ObservationCompositionAcceptanceInput
    ): Promise<AcceptedObservationComposition>
    ```
  ],
  constraints: [
    - member contract ID と constraint reference は supplied contract に exact に解決する
    - member contract の external input schema、event schema、initial cut は result contract header と一致する
    - shared `(subjectId, kind)` の全 reference は exactly one binding に属する
    - merge-identical は同一 record、exclusive owner は owner constraint の安全な subset とする
    - binding `/3` は structural resolution と policy qualified ID、version、immutable rule graph digest、proof domain だけを持つ
    - composition `/4` は policy language、descriptor、claim、acceptance を所有せず、class-local policy closure より先に生成できる
    - total-order の ordered member は binding member の exact permutation とする
    - creator は result constraint、全 member mapping、result order transitive closure を再導出し、refinement rule を持たない独立した trace-equality result contract を生成する
    - result contract は composition ID を参照せず、composition が full result contract を所有する
    - result order cycle と incompatible semantic domain を composition conflict にする
    - multi-tape symbol の member position は member contract ID order と一致し、全 tape が null の symbol を拒否する
    - 非 identity multi-tape symbol は exact binding ID を持つ
    - policy symbol は event を持たず、exactly one binding member tape とその member-to-result constraint だけを進める
    - policy application は composition、input class、全 member/result language、binding、descriptor、policy language を束縛する
    - composition policy derivation claim は application、descriptor、language、proof domain だけを参照し、acceptance と下流 claim を参照しない
    - 各 input class の policy binding は exactly one closure、merge-identical と exclusive-owner は zero closure とする
    - composition claim `/3` は result contract ID と result summary ID と exact policy closure を持ち、caller-supplied allowed relation ID を持たない
    - derived allowed relation は actual relation と composition claim ID を入力にしない
    - OC01 は attestation digest を opaque non-reference とし、upstream-only verifier profile の admission と branded trust result は SC03 と RR01 の契約で検証する
    - acceptor は policy-product から multi-tape allowed relation を導出し、actual relation の各 member/result projection と inclusion を検証する
    - result summary の observation contract ID は composition が所有する result contract ID と一致する
  ],
)

#interface_spec(
  name: "Realization witness",
  summary: [
    symbolic input-class coverage と一つの concrete render instance の server realization を、atomic obligation と parser step で証明する。
  ],
  format: [
    ```typescript
    interface RealizationObligation
    interface RealizationTemplateStepSymbol
    interface RealizationSequenceLanguage
    interface RealizationWitnessTemplate
    interface RealizationCoverageClaim
    interface AcceptedRealizationCoverage
    interface CanonicalParserProfile
    interface CanonicalBaseUrlClaim
    type RealizationStep
    interface RealizationSequenceClaim
    interface RealizationWitness
    interface RealizationWitnessValidationContext

    function createRealizationObligation(input: RealizationObligationInput): Promise<RealizationObligation>
    function createRealizationTemplateStepSymbol(input: RealizationTemplateStepSymbolInput): Promise<RealizationTemplateStepSymbol>
    function createRealizationSequenceLanguage(input: RealizationSequenceLanguageInput, budget: ObservationAutomatonBudget): Promise<RealizationSequenceLanguage>
    function createRealizationWitnessTemplate(input: RealizationWitnessTemplateInput): Promise<RealizationWitnessTemplate>
    function createRealizationCoverageClaim(input: RealizationCoverageClaimInput): Promise<RealizationCoverageClaim>
    function validateRealizationCoverageClaim(input: RealizationCoverageValidationInput): Promise<AcceptedRealizationCoverage>
    function createCanonicalParserProfile(input: CanonicalParserProfileInput): Promise<CanonicalParserProfile>
    function createCanonicalBaseUrlClaim(input: CanonicalBaseUrlClaimInput): Promise<CanonicalBaseUrlClaim>
    function createRealizationStep(input: RealizationStepInput): Promise<RealizationStep>
    function createRealizationSequenceClaim(input: RealizationSequenceClaimInput): Promise<RealizationSequenceClaim>
    function createRealizationWitness(input: RealizationWitnessInput): Promise<RealizationWitness>
    function parseRealizationWitness(value: unknown): Promise<RealizationWitness>
    function validateRealizationWitness(witness: RealizationWitness, context: RealizationWitnessValidationContext): Promise<void>
    ```
  ],
  constraints: [
    - template は obligation record の実体と canonical sequence language を所有する
    - coverage claim `/2` は behavior summary と input partition の全 class に exactly one template を割り当て、余分な class を持たない
    - coverage validator は full behavior、partition、全 template、全 sequence language、closed-parsed trusted coverage acceptance の closure を検証する
    - witness `/3` は accepted relation、accepted coverage、coverage claim/acceptance、selected template、sequence claim/acceptance、base URL claim/acceptance を自身の preimage に持つ
    - concrete sequence claim `/2` は template ID を参照し、obligation ID 集合を template と完全一致させる
    - concrete step の template symbol word は template sequence language に受理される
    - artifact-token concrete step は `artifactTokenClassId` を持ち、template symbol と一致する
    - obligation は exactly one output step を持ち、output token は expected token と一致する
    - parser step の input step と token、parser sequence、step DAG は連続し cycle を持たない
    - DOM obligation の全 provenance path は non-empty で artifact-token root に到達し、zero-input parser branch と未証明 branch の合流を受理しない
    - upgrade と adopt effect ID は server realization step に使えない
    - parser operation、encoding、content type、document mode、target host は parser profile に適合する
    - canonical base URL は profile の proof domain が accepted した exact claim に一致する
    - sequence、coverage、base URL の acceptance は closed parse と digest 再計算後に trusted proof context と一致する
    - target host は selection host ID と validated environment catalog の host-profile entry の両方に存在する
    - 別 contract、別 summary、別 input class、未証明 obligation、unknown parser operation を拒否する
  ],
)

#interface_spec(
  name: "Observation contract failure",
  summary: [
    malformed record、canonicality violation、relation mismatch、composition conflict、witness failure を stable code と path で報告する。
  ],
  format: [
    ```typescript
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
      | "composition-conflict"
      | "unproven-obligation"
      | "invalid-parser-operation"
      | "host-profile-mismatch"

    class ObservationContractError extends TypeError {
      readonly code: ObservationContractErrorCode
      readonly path: readonly (string | number)[]
    }
    ```
  ],
  constraints: [
    - malformed input は最初に失敗した root-to-value path を持つ
    - error code と path は immutable snapshot とする
    - well-formed だが equality または refinement を満たさない比較は immutable rejected decision とし、malformed input と区別する
    - budget failure は limit 名、limit、observed count を path と message で特定する
  ],
)
