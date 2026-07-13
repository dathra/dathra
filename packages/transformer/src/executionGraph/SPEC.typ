= canonical execution graph

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

immutable ModuleGraphSnapshot と ObservationContract を dependency とし、source operation、compiler-generated operation、symbolic location、static occurrence shape、typed relation、root obligation を content-addressed な base graph として表現する。

base graph から seed ごとの potential execution と materialization を deterministic に導出しつつ、source completeness、placement permission、host ordering、concrete runtime state を後続 layer に残す。

== 設計判断

#adr(
  header("Template identity と graph vertex を分離する", Status.Accepted, "2026-07-12"),
  [
    TemplateNode を graph vertex とすると、同じ source operation が複数の resolution domain、Realm、Principal requirement に属する場合の identity を分離できない。
    generated operation ID に RootObligation ID を含めると、obligation の target がその generated operation である場合に content-addressed cycle が生じる。
  ],
  [
    TemplateNode は静的 operation identity とし、symbolic location、semantic role、StaticExecutionOccurrenceTemplate、module または generation binding を結合した QualifiedExecutionNode を graph vertex とする。
    RootDefinitionAnchor は graph と contract を参照せず先に生成する。
    root-bound generated TemplateNode は anchor ID と exact ObservationContract ID を参照し、RootObligation ID を参照しない。
  ],
  [
    - source operation と environment-specific execution identity を分離できる
    - root、contract、generated node、obligation の identity DAG が非循環になる
    - 同じ ModuleDefinition の別 RuntimeModuleBinding を混同しない
  ],
)

#adr(
  header("Base graph と受理済み analysis を分離する", Status.Accepted, "2026-07-12"),
  [
    static graph は source 解析の出力 schema を検証できるが、提出されなかった edge の欠落を単独では証明できない。
    bare graph の非到達を client exclusion に使うと、不完全な analysis が server-first の根拠になる。
  ],
  [
    EG03 は canonical base graph と deterministic topology index だけを提供する。
    後続の SC03 と PL02 は graph、module graph、contract 集合、analysis profile 集合、qualified evidence、completeness scope、producer profile、proof domain を一つの claim に束縛し、trusted verifier が exact claim を一意に受理した場合だけ branded AcceptedExecutionAnalysis を返す。
    CN01 は AcceptedExecutionAnalysis だけを placement と client exclusion に利用できる。
  ],
  [
    - missing edge と unknown code を permission にできない
    - EG03 は SC03、PL02、candidate solver の責務を奪わない
    - graph schema と analysis trust boundary を別々に更新できる
  ],
)

#adr(
  header("Root-specific least fixed point を非直列化 index で導出する", Status.Accepted, "2026-07-12"),
  [
    parent root が registration を materialize した事実と、child callback root 自身が実行する fact を一つの root identity にまとめると、nested registration と unseeded support cycle の帰属が曖昧になる。
    derived fact、path、SCC を snapshot preimage に含めると、base semantic graph の identity が derivation algorithm に依存する。
  ],
  [
    base snapshot は base record と dependency ID だけを保持する。
    fixed derivation profile は IntraRootFact、PotentialRootSupport、SeedReachability を分け、seed root の explicit entry fact から may-execute と may-materialize だけを走査する。
    child root は child obligation の target と entry fact から独立した closure を開始する。
  ],
  [
    - nested support と self support は finite record set 上で停止する
    - seed から到達しない support SCC は fact を生成しない
    - base graph identity は path tie-break と SCC algorithm から独立する
  ],
)

#adr(
  header("Concrete occurrence と host order を runtime に残す", Status.Accepted, "2026-07-12"),
  [
    base graph の caller が happens-before または synchronizes-with を任意に提出できると、実際の task source、microtask、render opportunity と無関係な order を捏造できる。
  ],
  [
    EG03 は identity slot と possible epoch kind を持つ StaticExecutionOccurrenceTemplate だけを保持する。
    base edge は caller-supplied happens-before と synchronizes-with を受理しない。
    concrete Enqueue、Start、MicrotaskCheckpoint、Complete と authenticated host profile から得る order は runtime occurrence graph が所有する。
  ],
  [
    - static graph は concrete HostInstance、Realm、activation ID を持たない
    - scheduler topology を host must-order と混同しない
    - registration と subscription の mutable state machine を runtime に残せる
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Execution graph dependency context",
  summary: [
    一つの strict ModuleGraphSnapshot と、superset を許す strict ObservationContract 集合を graph validation context とする。
  ],
  format: [
    ```typescript
    interface ExecutionGraphDependencies {
      readonly moduleGraph: ModuleGraphSnapshot
      readonly observationContracts: readonly ObservationContract[]
    }
    ```
  ],
  constraints: [
    - snapshot preimage は module graph ID と実際に参照する contract ID の昇順集合だけを保持する
    - context の extra contract は graph identity に影響しない
    - selected contract の欠落、duplicate、digest mismatch、rootDefinitionId mismatch を拒否する
    - graph が参照しない ModuleGraph record は拒否しない
  ],
)

#interface_spec(
  name: "Canonical identity records",
  summary: [
    graph-independent profile と root anchor から qualified vertex までを非循環の content-addressed record として生成する。
  ],
  format: [
    ```typescript
    function createExecutionAnalysisProfile(input: ExecutionAnalysisProfileInput, budget?: ExecutionGraphBudget): Promise<ExecutionAnalysisProfile>
    function createExecutionRootDefinition(input: ExecutionRootDefinitionInput, budget?: ExecutionGraphBudget): Promise<ExecutionRootDefinition>
    function createExecutionLocationRequirement(input: ExecutionLocationRequirementInput, budget?: ExecutionGraphBudget): Promise<ExecutionLocationRequirement>
    function createStaticExecutionOccurrenceTemplate(input: StaticExecutionOccurrenceTemplateInput, budget?: ExecutionGraphBudget): Promise<StaticExecutionOccurrenceTemplate>
    function createExecutionTemplateNode(input: ExecutionTemplateNodeInput, budget?: ExecutionGraphBudget): Promise<ExecutionTemplateNode>
    function createExecutionGenerationDomain(input: ExecutionGenerationDomainInput, budget?: ExecutionGraphBudget): Promise<ExecutionGenerationDomain>
    function createQualifiedExecutionNode(input: QualifiedExecutionNodeInput, budget?: ExecutionGraphBudget): Promise<QualifiedExecutionNode>
    ```
  ],
  constraints: [
    - creator input は getter、custom prototype、hidden property、symbol property、extra property を実行せず拒否する
    - source TemplateNode は content ModuleDefinition の URL、transformed digest、semantic profile を重複保持し、snapshot validation で完全一致させる
    - generated TemplateNode の input slot は label 順で重複を許さず、template dependency は DAG とする
    - root-bound generated TemplateNode は anchor ID と contract ID を両方持ち、unbound node は両方 null とする
    - location requirement は HostInstance、AgentCluster、Agent、Realm、Global、Principal の symbolic domain ID、allowed environment、allowed resolution domain を持つ
    - source qualified node は RuntimeModuleBinding を必須とし、definition、resolution domain、target environment を location requirement と一致させる
    - generated qualified node は closed ExecutionGenerationDomain を必須とし、location、environment、optional resolution domain、generator profile を一致させる
  ],
)

#interface_spec(
  name: "Operation and relation taxonomy",
  summary: [
    operation kind、semantic role、edge kind、endpoint role、traversal semantics を closed table として固定する。
  ],
  format: [
    ```typescript
    type ExecutionOperationKind =
      | "module-instantiation" | "module-evaluation" | "module-binding-cell"
      | "allocation" | "heap-region" | "property-read" | "property-write"
      | "state-read" | "state-write" | "compute" | "call" | "branch"
      | "callback-registration" | "callback-body"
      | "await" | "continuation" | "return" | "throw" | "reject" | "abort"
      | "dom-create" | "dom-reference" | "dom-binding" | "dom-mutation"
      | "effect" | "resource" | "lifecycle" | "stream-step"
      | "transfer-demand" | "protocol-operation" | "artifact-contribution"
      | "admission-adapter" | "event-recorder" | "catch-up-read"
      | "capability-use" | "authority-possession" | "enforcement-boundary"
      | "scheduler-enqueue" | "scheduler-start"
      | "scheduler-microtask-checkpoint" | "scheduler-complete"

    type ExecutionEdgeKind =
      | "may-execute" | "may-materialize"
      | "data" | "control" | "call" | "possible-call"
      | "reads-from" | "writes-to" | "possible-subscription" | "untracked-data"
      | "invalidation" | "registration" | "materializes" | "obligates"
      | "scheduling" | "scheduler-sequence" | "settles" | "resumes" | "abrupt-to-handler"
      | "module-link" | "live-binding-read" | "live-binding-write" | "evaluate-before"
      | "possible-alias" | "identity" | "ownership" | "lifetime" | "cleanup"
      | "transfer" | "capability-use" | "authority-possession"

    type ExecutionEdgeInput =
      | {
          readonly kind: Exclude<ExecutionEdgeKind, "identity">
          readonly sourceNodeId: QualifiedExecutionNodeId
          readonly targetNodeId: QualifiedExecutionNodeId
          readonly identitySlot?: never
        }
      | {
          readonly kind: "identity"
          readonly sourceNodeId: QualifiedExecutionNodeId
          readonly targetNodeId: QualifiedExecutionNodeId
          readonly identitySlot: ExecutionOccurrenceIdentitySlot
        }
    ```

    operation kind から semantic role への正準表は次のとおりである。

    ```typescript
    const operationRole = {
      module: ["module-instantiation", "module-evaluation", "module-binding-cell"],
      memory: ["allocation", "heap-region", "property-read", "property-write", "state-read", "state-write"],
      execution: ["compute", "call", "branch", "callback-body", "await", "continuation", "return", "throw", "reject", "abort"],
      registration: ["callback-registration"],
      dom: ["dom-create", "dom-reference", "dom-binding", "dom-mutation"],
      effect: ["effect", "resource", "lifecycle", "stream-step"],
      transfer: ["transfer-demand"],
      protocol: ["protocol-operation"],
      artifact: ["artifact-contribution"],
      admission: ["admission-adapter"],
      recorder: ["event-recorder", "catch-up-read"],
      authority: ["capability-use", "authority-possession", "enforcement-boundary"],
      scheduler: ["scheduler-enqueue", "scheduler-start", "scheduler-microtask-checkpoint", "scheduler-complete"],
    }
    ```

    edge kind の source role と target role は次の正準表を使う。
    `*` はすべての semantic role を表す。

    ```typescript
    const edgeRole = {
      "may-execute": ["*", "*"],
      "may-materialize": ["*", "*"],
      data: [["module", "memory", "execution", "dom", "effect", "protocol", "recorder"], ["module", "memory", "execution", "dom", "effect", "transfer", "protocol", "artifact", "admission", "recorder", "authority"]],
      control: [["module", "execution", "effect", "admission", "scheduler"], ["module", "execution", "registration", "dom", "effect", "protocol", "admission", "scheduler"]],
      call: [["execution", "registration", "admission", "protocol"], ["module", "execution", "effect", "admission", "protocol"]],
      "possible-call": [["execution", "registration", "admission", "protocol"], ["module", "execution", "effect", "admission", "protocol"]],
      "reads-from": [["module", "memory", "recorder"], ["module", "memory", "dom"]],
      "writes-to": [["module", "memory", "dom"], ["module", "memory", "dom"]],
      "possible-subscription": [["memory", "recorder"], ["module", "memory"]],
      "untracked-data": [["memory", "recorder", "execution"], ["module", "memory", "execution"]],
      invalidation: [["module", "memory", "execution"], ["execution", "dom", "effect"]],
      registration: [["registration"], ["execution"]],
      materializes: ["*", ["memory", "registration", "dom", "protocol", "artifact"]],
      obligates: ["*", ["effect", "transfer", "protocol", "artifact", "authority"]],
      scheduling: [["registration", "execution", "effect", "scheduler"], ["execution", "scheduler"]],
      "scheduler-sequence": [["scheduler"], ["scheduler"]],
      settles: [["execution", "effect", "protocol"], ["execution"]],
      resumes: [["scheduler", "execution", "protocol"], ["execution"]],
      "abrupt-to-handler": [["execution", "effect", "protocol"], ["execution"]],
      "module-link": [["module"], ["module"]],
      "live-binding-read": [["module", "memory"], ["module"]],
      "live-binding-write": [["module", "memory"], ["module"]],
      "evaluate-before": [["module"], ["module"]],
      "possible-alias": ["*", "*"],
      identity: ["*", "*"],
      ownership: ["*", "*"],
      lifetime: ["*", "*"],
      cleanup: [["memory", "registration", "dom", "effect", "protocol"], ["execution", "effect"]],
      transfer: ["*", ["transfer", "protocol", "artifact"]],
      "capability-use": ["*", ["authority"]],
      "authority-possession": [["authority"], "*"],
    }
    ```
  ],
  constraints: [
    - operation kind は module、memory、execution、registration、dom、effect、transfer、protocol、artifact、admission、recorder、authority、scheduler の semantic role に一意に対応する
    - edge kind は source role と target role の closed endpoint table を持つ
    - registration は callback-registration から callback-body だけを結ぶ
    - scheduler-sequence は enqueue から start、start から checkpoint または complete、checkpoint から checkpoint または complete だけを結ぶ
    - identity は exact identitySlot を preimage に含め、同じ semantic role かつ両 occurrence template がその slot を持つ node だけを結ぶ
    - identity の symbolic location と binding は base validator で同一性を要求せず、trusted verifier が claim の completeness scope と proof domain の範囲で qualification する
    - non-identity edge は identitySlot field を受理しない
    - identity は node collapse と traversal に使わない
    - possible-alias は identity union に使わない
    - may-execute だけが execute fact を伝播し、may-materialize だけが materialize fact を伝播する
    - happens-before と synchronizes-with は base input kind に含めない
  ],
)

#interface_spec(
  name: "Root obligation and support",
  summary: [
    primitive root anchor を exact ObservationContract constraint と target node に結合し、registration と reactive dependency が contingent root を support する条件を閉じる。
  ],
  format: [
    ```typescript
    function createExecutionEdge(input: ExecutionEdgeInput, budget?: ExecutionGraphBudget): Promise<ExecutionEdge>
    function createRegistrationSupportTemplate(input: RegistrationSupportTemplateInput, budget?: ExecutionGraphBudget): Promise<RegistrationSupportTemplate>
    function createReactiveSupportTemplate(input: ReactiveSupportTemplateInput, budget?: ExecutionGraphBudget): Promise<ReactiveSupportTemplate>
    function createExecutionRootObligation(input: ExecutionRootObligationInput, budget?: ExecutionGraphBudget): Promise<ExecutionRootObligation>
    ```
  ],
  constraints: [
    - RootObligation は explicit execute または materialize entry fact を一つ持つ
    - trigger constraint は contract 内の event、effect、callback だけを参照し、admissionCutId を contract.initialCutId と一致させる
    - owner constraint は同じ contract の identity、lifetime だけを参照する
    - terminal constraint は同じ contract の terminal を一つ参照し、subjectId を root anchor ID と一致させる
    - external-entry、request-handler、action は seed、admission、execute、event trigger 1件とする
    - initial-ui は seed、render、execute、trigger なしとする
    - artifact は seed、build、materialize、trigger なしとする
    - lifecycle と effect は seed、対応 phase、execute、effect trigger 1件とする
    - platform-obligation は seed、admission、execute、trigger なしとする
    - callback は contingent、event、execute、callback trigger 1件とする
    - reactive-updater は contingent、update、execute、effect trigger 1件とする
    - registration support は registration edge endpoint、callback target、child obligation、trigger constraint を完全一致させる
    - 一つの registration node は同じ once、abortable、protocol tuple を共有する複数の callback support を持てる
    - 同じ registration node の option tuple が異なる場合は producer normalization の欠落として拒否する
    - callback fan-out は有限候補の conservative union とし、guard correlation と concrete selection を base graph に含めない
    - reactive support は read-to-collector data edge、read-to-dependency subscription edge、dependency-to-binding invalidation path、child obligation、trigger constraint を完全一致させる
    - reactive support は collector を compute または effect、read を state-read、property-read、catch-up-read のいずれか、dependency を heap-region または module-binding-cell、binding を dom-binding に限定する
    - untracked-data は reactive support を満たさない
  ],
)

#interface_spec(
  name: "Base snapshot and deterministic index",
  summary: [
    canonical base record だけを snapshot identity に含め、root-specific closure と topology query を fixed derivation profile で計算する。
  ],
  format: [
    ```typescript
    function createExecutionGraphSnapshot(
      input: ExecutionGraphSnapshotInput,
      dependencies: ExecutionGraphDependencies,
      budget?: ExecutionGraphBudget,
    ): Promise<ExecutionGraphSnapshot>

    function parseExecutionGraphSnapshot(
      value: unknown,
      dependencies: ExecutionGraphDependencies,
      budget?: ExecutionGraphBudget,
    ): Promise<ExecutionGraphSnapshot>

    function createExecutionGraphIndex(
      snapshot: ExecutionGraphSnapshot,
      dependencies: ExecutionGraphDependencies,
      budget?: ExecutionGraphBudget,
    ): Promise<ExecutionGraphIndex>
    ```
  ],
  constraints: [
    - record array は ID の code-unit 順とし、creator は normalize、parser は exact order を要求する
    - base snapshot は root fact、support closure、path、SCC、condensation、host order を含めない
    - unreachable QualifiedExecutionNode と edge は conservative upper bound として許可する
    - selected contract、analysis profile、root、location、occurrence template、TemplateNode、generation domain、support、obligation は structural exact-use を要求する
    - fixed profile dathra.execution-graph-derivation/1 だけを使い、caller-supplied derivation policy を受理しない
    - justification path は traversal edge 数を最小化し、同数なら edge ID sequence の辞書式順で選ぶ
    - support chain は support 数を最小化し、同数なら support template ID sequence の辞書式順で選ぶ
    - SCC と condensation は may-execute と may-materialize の directed subgraph だけを対象とする
    - roots-for-node は execute と materialize を保持する IntraRootFact を返す
  ],
)

#interface_spec(
  name: "Hard resource budget",
  summary: [
    canonicalization と graph derivation の前後に hard limit を適用し、partial result を公開しない。
  ],
  format: [
    ```typescript
    interface ExecutionGraphBudget {
      readonly maximumInputDepth?: number
      readonly maximumInputDataNodes?: number
      readonly maximumInputProperties?: number
      readonly maximumInputArrayLength?: number
      readonly maximumInputStringCodeUnits?: number
      readonly maximumDependencyContracts?: number
      readonly maximumDependencyModuleRecords?: number
      readonly maximumRecordsPerKind?: number
      readonly maximumCanonicalBytes?: number
      readonly maximumValidationSteps?: number
      readonly maximumDerivationFacts?: number
      readonly maximumTraversalSteps?: number
      readonly maximumSupportChecks?: number
      readonly maximumDerivedSupports?: number
      readonly maximumPathSteps?: number
      readonly maximumSccSteps?: number
      readonly maximumIndexSteps?: number
    }
    ```

    counter の正準課金単位は次のとおりである。

    ```text
    input data/property/string  descriptor を読む直前。operation 全体で累積する
    array/depth                 各 container を降りる直前。framework hard cap を超えない
    dependency record          dependency clone と parser 呼び出しより前
    record per kind            record array の parse と allocation より前
    canonical byte             各 canonicalization の full text 生成より前。operation 全体で累積する
    validation step            record、reference、edge、support、path element の検査直前
    derivation fact            fact insertion の直前
    traversal step             traversal edge probe の直前
    support check              成立しない候補を含む support probe の直前
    derived support            support insertion の直前
    path step                  path candidate の生成と比較の直前
    SCC step                   adjacency、sort comparison、DFS、component、condensation work の直前
    index step                 index map、sort comparison、output entry の構築直前
    ```
  ],
  constraints: [
    - budget override は framework hard cap を狭めることだけができる
    - 一つの公開 operation は一つの operation-local BudgetLedger を全 phase へ共有する
    - descriptor preflight は getter を実行せず、depth、data node、property、array length、string code unit を canonical JSON より前に制限する
    - dependency contract 数、module record 数、各 graph record 数を clone、parser、allocation より前に制限する
    - canonical byte は budget-aware preflight で計測し、full canonical text を生成する前に制限する
    - validation、fixed-point fact、traversal、support probe、derived support、path、SCC、index work を各 work の直前に制限する
    - sort は comparator invocation を対応 counter に課金し、zero budget で比較 work を開始しない
    - budget failure は typed ExecutionGraphError を返し、snapshot または index を返さない
  ],
)

== 機能仕様

#feature_spec(
  name: "Canonical graph identity",
  summary: [
    input order と caller mutation に依存しない immutable record DAG と snapshot ID を生成する。
  ],
  test_cases: [
    - source TemplateNode が content definition の URL、digest、profile と一致する
    - external definition、別 runtime binding、別 environment、別 generator profile を拒否する
    - generated template cycle、dangling reference、root と contract の交換を拒否する
    - record array と set-like field を code-unit 順へ normalize する
    - strict parser が forged ID、noncanonical order、extra field、getter を拒否する
    - output と nested record を変更できない
  ],
)

#feature_spec(
  name: "Exact root contract closure",
  summary: [
    root kind table と ObservationContract constraint を一意に結び、別 root または別 contract の support 差し替えを拒否する。
  ],
  test_cases: [
    - terminal subject、trigger kind/count、admission cut、root phase、entry fact の不一致を拒否する
    - callback support が exact registration edge、callback target、trigger constraint を要求する
    - 一つの registration node から同じ option tuple を持つ複数 callback support を受理し、tuple 不一致を拒否する
    - reactive support が exact collector/read/dependency/binding path と effect trigger を要求する
    - root-bound generated node が anchor の唯一の obligation と同じ contract を要求する
    - contingent root の support 欠落を拒否し、unseeded support cycle は受理する
  ],
)

#feature_spec(
  name: "Potential root fixed point",
  summary: [
    seed root だけから root-specific execute、materialize、support、seed reachability を least fixed point まで導出する。
  ],
  test_cases: [
    - execute と materialize の伝播を別 fact として保持する
    - parent registration の callback fact を child root ID に帰属させる
    - nested registration と self support が停止する
    - seed から到達しない support SCC が fact を生成しない
    - reactive support は collector/read execution と binding materialization が揃う場合だけ導出する
    - arbitrary data、identity、possible-alias、scheduler relation が closure を増やさない
    - 同じ registration node の複数 callback support を別々の potential support として導出する
  ],
)

#feature_spec(
  name: "Deterministic topology index",
  summary: [
    snapshot identity を変更せず、lookup、edge、occurrence、root、path、SCC、condensation query を返す。
  ],
  test_cases: [
    - equal-length path と support chain を ID sequence で決定する
    - roots-for-node が root ID と fact kind を保持する
    - identity と possible-alias を SCC に含めない
    - identity edge は両 endpoint の exact slot を要求し、role 不一致、slot 欠落、non-identity edge の identitySlot を拒否する
    - legal と illegal の全 scheduler sequence を独立 fixture で検証する
    - callback と reactive updater target の required occurrence slot を検証する
    - unreachable primary node を query できる
  ],
)

#feature_spec(
  name: "Bounded strict validation",
  summary: [
    untrusted graph と dependency context を normalize または拒否し、resource limit 内だけで snapshot と index を返す。
  ],
  test_cases: [
    - context の extra contract を許可し、selected contract の欠落を拒否する
    - oversized array、deep input、long string、record count、canonical byte を preflight または snapshot budget で拒否する
    - validation、fact、traversal、成立しない support probe、derived support、path、SCC、index の zero、境界値、境界値未満を検証する
    - deep generated template DAG を iterative に検証し、call stack failure を返さない
    - package-local facade から creator、parser、index、error type を利用できる
    - transformer npm root は AT01 より前に ExecutionGraph の creator、parser、index、error type を公開しない
  ],
)
