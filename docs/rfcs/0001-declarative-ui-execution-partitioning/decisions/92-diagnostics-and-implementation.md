> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Diagnostics and implementation direction

> Successor clarification: [Acceptance evidence](../implementation/acceptance.md#observationcontract-open-obligations) and the [restart inventory](../restart-inventory.md#observationcontract-open-proof-obligations) identify unresolved repeated-event and long-lived-subscription semantics. They supersede any preserved statement below that every pre-implementation design question was resolved or that the listed implementation order is active.

## diagnostic policy

diagnostic は、component 単位の「unsupported」だけを返さない。
少なくとも次の情報を含める。

- root instance と admission cut
- root から失敗 dependency までの edge chain
- 不足または矛盾する semantic fact
- 満たせなかった ObservationContract
- 拒否した placement と materialization candidate
- authority または exposure rule
- 利用可能な module split、manifest、contract、codec、reference、explicit remote API

runtime unknown は eager activation、full module、rerender を許可する理由にならない。
runtime failure は affected scope を明示的に失敗させ、SSR DOM を可能な範囲で保持し、RuntimeFailureChannel へ報告する。

## 実装方針

実装は次の順序で進める。

1. ModuleCoordinator と ExecutionGraph IR を導入する。
2. semantic manifest と execution contract の typed schema を導入する。
3. root、Occurrence、read、effect、module closure の解析を実装する。
4. server renderer と RenderOperation を新しい IR から生成する。
5. MaterializationPlan と request projection を生成する。
6. ClientScopeGraph、artifact、bootstrap を生成する。
7. DSD、marker、reconciliation、activation policy を実装する。
8. 旧 hydration と island semantics を削除する。

production code を変更する前に、関連 package の `SPEC.typ` と `implementation.test.ts` を新しい契約へ更新する。
Accepted ADR の意味を直接書き換えず、必要な場合は superseding ADR を追加する。

## 実装時の検証事項

次の項目は設計上の未決事項ではなく、実装が設計を満たすかを確認する acceptance work である。

- ModuleCoordinator の incremental build cost と memory usage
- solver が declared candidate universe 内の最適解を再現できること
- ObservationContract の trace equality/refinement、coalescing、composition、RealizationWitness の canonical comparison が実装間で一致すること
- selection-domain class から worst-case resolved graph と同じ metric vector を再現できること
- canonical scalar field atom と許可 joint atom の classification table が記述順によらず同じ class と digest を作り、input universe を排他的かつ網羅すること
- plan-independent DeploymentProjectionDefinition ID が manifest instance、artifact、metric から独立していること
- ArtifactAddressId、exact-byte digest、plan ID に自己参照がなく、reproducible build になること
- deployment identity、finalization template、複数 entry binding、labeled dependency、export table、base URL normalization が一つの ArtifactAddressId に一つの bytes identity だけを割り当てること
- ProjectionManifestCore が plan より先に exact bytes を確定し、固定長 envelope と class/variant ごとの cold reachable artifact を client-delivered-bytes が数えること
- final bundler closure から server-only dependency が除外されること
- source、manifest、contract の conflict diagnostic
- SemanticSubject、relation、qualified fact と registry ID の namespace 衝突検査
- module map、import map、integrity、redirect の host profile ごとの適合性
- SC03 の qualified symbolic universe、AF01 の final/environment catalog と exact-seed fixed-point projection、PE01 の selected emission、RR01 の authenticated local validation が同じ registry identity と role closure に一致し、browser role から server-request artifact closure を拒否すること
- finite GraphPathWitness の edge continuity、cycle rejection、path pattern、locator validation、private grant pin、reference cache identity が invocation 前に完了すること
- codec graph edge slot table が wire path、edge kind、cardinality、witness ordinal を materialization 前に検証すること
- BootAuthority が manifest 前に loader と failure channel を注入し、private capability を Realm、Document generation、module-map epoch、decoder、redirect policy に束縛すること
- 7 種類の policy input、value-domain、failure-schema、host-profile、brand implementation の conformance
- RenderOperation の cancel、retry、header、stream race
- FinalHeaderCommit と複数 103 publication の writer acceptance linearization
- runtime-owned subscription wrapper が wrapper ごとに non-reused session incarnation を発行し、SSR handoff record、source-facing request、transport event から client-local owner/session identity を除外し、全 runtime event と acknowledgement を captured owner generation/session identity の atomic pair fence に通して、transport continuity、boot-bound private namespace authority、local/transport resync 分離、purpose-bound grant evidence、budget、overflow、acknowledgement、GC を強制すること
- allocation token、cleanup deadline、LateSettlementLedger の race
- target generation を参照しない creation operation、restartable generation、allocation/commit transaction が coordinator-issued incarnation から identity を作ること
- retention claim set、CleanupTaskToken、LateCleanupLedger、hard admission budget、sink-side atomic generation fence、self-await rejection
- graph-table budget、declarative/host-attested codec enforcement、疎配列、global symbol allowlist、well-known symbol の validation
- raw carrier attestation、decoded canonical text、JSON depth、local symbol table の validation
- DSD parse fence と全 custom-element reaction の順序
- same-checkpoint move、adoption、cross-coordinator migration
- user input、autofill、history restoration、form group の reconciliation
- interaction、load、error、media、animation などの event admission frontier
- dynamic list、conditional UI、client navigation、late fragment の slot transaction
- activation capability の boot scope、instance selector、stale rejection、failure channel
- stable integration key、opaque ref、release/expiry も terminalize する budgeted slot operation ledger、expected epoch CAS、watermark compaction
- opaque public failure subject、owner tombstone、disposable snapshot、FailurePinBudget、独立 handle lease と FailureRef pin、retention limit 0
- effect、onActivate、onDispose、owned resource の cleanup DAG
- remote outcome の cancellation、expiry、ambiguity、delivery horizon
- pre-admission outcome、immutable wire commitment、private object と untrusted wire DTO の分離、authorization cut、browser transport/verifier と server endpoint/handler/delivery の role 分割、canonical frame、protocol budget、replay/evidence watermark 分離、receipt proof、元の ambiguity を保持する recovery
- endpoint が server-local receipt から closed wire DTO を再構築し、receipt proof を先に確定してから完成した receipt を含む response proof を canonicalize すること
- `render:client` の literal prop、spread diagnostic、reserved prop removal
- `dom:external` の region identity、exclusive nesting、SSR preservation、lifetime、cleanup、reserved prop removal
- non-atomic writer の BufferedFinalWrite と writerOutcomeUnknown terminal
- DocCodeBlock から highlight dependency が client artifact に入らないこと
- client root がない route で bootstrap と payload がゼロになること
- diagnostic が root から失敗 dependency までの path を示すこと

## 解決済みの設計事項

実装前に必要だった設計判断は、次の通り解決した。

1. reactive graph 単体ではなく ExecutionGraph を採用し、runtime reactive graph はその動的部分集合とする。
2. ExecutionGraph と transfer plan の compiler IR を ModuleCoordinator で構築する。
3. shared state、activation group、prerequisite を ClientScopeGraph で表現する。
4. lifetime は Document または ShadowRoot coordinator、marker、custom-element host、lease で管理する。
5. client artifact と manifest は full deployment graph と request-reachable projection に分ける。
6. semantic manifest と明示 contract は同じ typed fact schema を使う。
7. serializer は型一覧ではなく MaterializationPlan の一候補とする。
8. built-in と user codec は identity、lifetime、effect、authority を含む contract を持つ。
9. reconstruction、reference、subscription、remote operation は独立した owner と state machine を持つ。
10. client recomputation は source semantics ではなく、同値性を証明した optimization とする。
11. secret と exposure は data、alias、control dependency を伝播する label と release contract で扱う。
12. source、manifest、contract は first-match priority を持たず、fact conflict を diagnostic にする。
13. nondeterministic read は独立した stability、consistency、replay 軸で扱う。
14. activation policy は `activate:*` とし、event source ごとの admission frontier を定義する。
15. server-only、client-only、universal は root reachability と environment constraint から導出する。
16. functional component は compiler-visible または summary-backed な範囲で graph-transparent とする。
17. opaque imported component は semantic manifest、native closure、明示 contract、diagnostic のいずれかで扱う。
18. bootstrap は projected client work がある場合だけ生成し、任意 plan を受け取る public hydrate API を残さない。
19. `defineComponent` host と plain DOM marker は lifetime owner になれるが hydration boundary にはしない。
20. DSD static style は SSR artifact と client-created template artifact を分け、SSR instance へ再挿入しない。
21. `data-dh-store` は継承せず、必要な value だけを versioned inert graph-table payload で送る。
22. transfer failure は root、demand、candidate、contract を示す diagnostic にする。
23. 既存 hydration 実装の再利用を設計制約にせず、新しい contract に適合する内部処理だけを個別に採用する。
24. plan selection は candidate-independent な selection-domain descriptor と versioned cost estimator で決定する。
25. artifact address、exact-byte integrity digest、versioned plan identity preimage を分離し、自己参照しない content identity を使う。
26. prerequisite は definition と resolved instance を分け、allocation と commit の cycle を明示 transaction へ collapse する。
27. async allocation は acquisition token と cleanup ledger を使い、hard admission と terminal bound を満たす deadline 後の result だけを LateSettlementLedger で処理する。
28. graph-table は expansion budget、closed declarative または host-attested codec、疎配列、local/global/well-known symbol identity、reference と subscription capability を versioned wire schema で検証する。
29. ProjectionManifestCore は definition、binding、registry catalog/projection、artifact integrity、integration capability の許可関係を固定し、外側 envelope は plan と core integrity を束縛する。
30. execution contract は SemanticSubject、typed relation、qualified fact と registry ID を持つ semantic graph とする。
31. activation capability は verified boot context と instance domain に束縛し、runtime failure と cleanup order を公開契約にする。
32. remote call は success、application failure、cancel、expiry、ambiguity、system failure を closed outcome として返す。
33. final header と Early Hints は publication claim、compatible envelope set、atomic writer acceptance で線形化する。
34. BootAuthority は manifest の外側から VerifiedModuleLoader と failure channel を注入し、loader capability を Realm、Document generation、module map、decoder、redirect policy に束縛する。
35. runtime registry は metadata digest だけでなく、policy evaluator と kind ごとの validator implementation を content-bound artifact として持つ。
36. reference は capture path ごとの ReferenceUseSchema から authorization、exposure、audience、share domain を構成する。
37. request-envelope class は disjoint scalar field atom と許可 joint atom の canonical classification table が作る排他的、網羅的、maximal な partition とする。
38. artifact metadata は一つの artifacts table に集約し、deployment identity、finalization template、複数 entry、labeled binding、export table を含む address preimage から URL と bytes を一意に導出する。
39. generation、allocation transaction、commit transaction identity は coordinator-issued incarnation、selector preimage、full instance scope から導出し、旧 continuation と新 generation を分離する。
40. retention claim は target ごとに統合し、budgeted late DAG の reuse を terminal、または sink-side compare-and-mutate と publication に線形化した generation fence まで遮断する。
41. graph-table carrier は host-side raw-byte attestation、canonical decoded text、JSON depth、symbol table を検証する。
42. CompiledExecutionContract の registry universe と finalized registry catalog は nested reference まで qualified ID に変換し、source-local ID を runtime artifact へ残さない。
43. RuntimeFailure は具体的な internal subject と opaque public subject を分け、owner tombstone と hard-budgeted disposable snapshot から独立した FailureRef pin を作る。
44. advanced activation は stable integration key から opaque instance と slot ref を解決し、expected slot epoch を instantiate-time CAS する PreparedInstantiationEnvelope だけを受け付ける。
45. non-atomic writer は 103 と streaming を使わず、unknown external outcome を terminal として retry を禁止する。
46. remote outcome は private authority が検証した commit/non-commit receipt で certainty を先に分類し、recovery failure でも元の ambiguous outcome を保持する。
47. reference cache identity は envelope、revision、resolver、locator、audience、share domain、private grant、authorization generation を含み、cache lease と grant claim を原子的に pin する。
48. dynamic instantiation は boot graph-table とは別 schema を使い、operation、slot generation、expected epoch、canonical key、principal、policy epoch に束縛する。
49. client cost は class/variant ごとの cold delivered manifest core、固定長 envelope、artifact、exact HTML carrier bytes を数える。
50. ObservationContract は closed constraint と input class ごとの canonical trace-language DFA を持ち、actual relation の両 projection、rule-derived allowed relation への language inclusion、composition result、RealizationWitness preimage から canonical trace relation を判定する。
51. remote non-commit certainty は将来の commit を禁止する terminal tombstone と fence を atomic ledger write に含む receipt だけから導出する。
52. remote operation descriptor は input、output、failure codec と対応 value domain/failure schema を qualified ID で束縛する。
53. PolicyGrantAuthority は canonical policy input から revocable、expiring、lifetime-bound grant を発行し、author object に authority brand を与えない。
54. arbitrary JavaScript codec は通常 materialization boundary にせず、closed declarative program または host-attested enforcement を要求する。
55. subscription は qualified source descriptor、graph-table record、use schema、session identity、revision envelope、resume/ack protocol を持つ。
56. `render:client` は literal `true` の reserved JSX prop とし、dynamic/spread ambiguity を diagnostic にする。
57. reference と subscription use は digest だけでなく root anchor、concrete edge、terminal を持つ finite GraphPathWitness で path pattern に結び付ける。
58. dynamic instantiation は prepared/terminal count、byte、age、replay horizon を hard budget で admission し、terminal prefix を slot operation watermark へ圧縮する。
59. remote operation ID は issuer epoch、sequence、admission expiry を認証し、terminal prefix watermark と stateless expiry で古い ID を永久拒否する。
60. subscription resync は旧 session の captured authority を使わず、fresh grant と expected old identity を持つ request から新 session を作る。
61. projection definition は plan-independent preimage、request instance は ProjectionInstancePreimage、candidate data は plan-independent ProjectionManifestCore で分ける。
62. client delivery cost は plan 前に確定した manifest core exact bytes と candidate-invariant な固定長 outer envelope を含める。
63. generation creation operation は target generation ID を含まない closed preimage とし、generation identity の hash cycle を禁止する。
64. InstanceHandle は caller ごとの lease とし、一 caller の release でほかの caller の status、tombstone、FailureRef を失効させない。
65. remote request commitment は qualified input codec と immutable canonical captured wire を束縛し、handler はその wire から新規 materialize した input だけを受け取る。
66. 公開済み slot operation sequence は release、expiry、revocation、validation failure でも non-commit terminal へ移し、watermark を塞ぐ永久 hole を作らない。
67. codec payload 内の graph edge は content-bound CodecGraphEdgeSlotTable が wire path、kind、cardinality、ordinal を宣言した場合だけ witness に使う。
68. DisposeResult を含む全 public failure outcome は FailureRef を原子的に予約し、枯渇時も内部 terminalization を止めず explicit budget failure を返す。
69. remote call は ledger と別 namespace の local attempt ID を capture 前に作り、capture/admission failure を operationId null の pre-admission outcome にする。
70. remote authorization は evaluation、grant、generation を commitment と ledger に束縛し、revocation と effect-admission cut を private authority で線形化する。
71. remote watermark は再実行拒否だけを証明し、terminal evidence 削除後の元 outcome は valid receipt がなければ ambiguous にする。
72. subscription source は outstanding/unacknowledged revision、retained byte、gap、cursor/reconnect/resync horizon、terminal deadline、GC を closed sequence contract と hard budget で制限する。
73. subscription source は transport consistency point だけを返し、runtime wrapper が identity、grant、budget claim、deadline、cleanup ownership を保持する。
74. subscription sequence namespace は source、locator、principal、namespace domain、attested epoch の canonical preimage とし、SSR record、resume/resync、全 revision に束縛する。
75. remote terminal evidence を失った operation は public reason `terminal-evidence-expired`、recovery null の ambiguous outcome にする。
76. `dom:external` は compiler-generated external regionへ lower する reserved JSX directive とし、Dathra DOMTarget との overlap、nested owner、cleanup 不在を diagnostic にする。
77. subscription は SSR と browser の間で transport continuity ID だけを継承し、client-local owner generation を含む session identity は browser runtime wrapper が新しく導出する。
78. subscription transport event は local identity を運ばず、runtime wrapper が全 event に captured owner generation と wrapper ごとに一意な session incarnation を含む session identity を付与し、revision、terminal、acknowledgement の直前に current wrapper pair と原子的に照合する。
79. subscription sequence namespace attestation は boot record に束縛された private authority だけが検証し、source の自己申告 digest を信頼しない。
80. runtime-owned AuthorizationGrantClaim は extension へ渡さず、resolver、subscription source、remote adapter には purpose-bound AuthorizationGrantEvidence だけを渡す。
81. remote operation の implementation binding は browser transport/verifier と server-request endpoint/handler に分け、delivery は remote-delivery-adapter entry が所有し、client projection から server-only closure を排除する。
82. SubscriptionRecord は transport continuity、namespace、snapshot、cursor だけを handoff し、browser-local session identity を持たない。local resync command と source 向け transport request も分離する。
83. remote protocol は AuthorizationGrantEvidence、RemoteCapturedRequest、branded receipt を直列化せず、proof を持つ untrusted wire DTO を host authority が検証して local private object を新規生成する。
84. registry binding は kind ごとの closed environment/role table、role requirement、同一環境 import、環境別 catalog/projection、cross-environment protocol binding を正本とする。
85. remote wire は versioned canonical JCS UTF-8 frame とし、raw frame、depth、evidence、payload、materialization、codec work を RemoteProtocolBudget で effect admission 前に制限する。
86. baseline の実行環境は build、server-request、browser に閉じる。remote operation の delivery adapter は server-request で実行し、第三 runtime への再委譲は暗黙 import ではなく将来の明示 protocol とする。
87. subscription の owner generation、root binding、use schema、local session identity は runtime wrapper context にだけ保持し、source-facing open/resume/resync request または transport event へ渡さない。
88. subscription wrapper は coordinator-issued monotonic session incarnation を一つずつ持ち、同じ owner generation と transport continuity を保つ resync でも session identity digest を再利用しない。

## 現行方針の要約

現行方針は、component hydration を細分化するだけの設計ではない。
compiler が宣言的 UI から実行 obligation、effect、ownership、transfer を導出し、別々の server program と client program を生成する設計である。

```txt
declarative UI
  -> ModuleCoordinator
  -> ExecutionGraph
  -> ObservationContract composition
  -> server renderer
  -> MaterializationPlan
  -> ClientScopeGraph
  -> request-reachable client projection
```

通常の開発者は、client placement を opt-in しない。
event、state update、client effect、client-only platform operation から client root が導出される。

`activate:*` は placement を変更せず、推論済み root の起動時刻だけを指定する。
server-only work は client root から到達しないため client artifact に入らない。
