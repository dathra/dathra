# 実装ロードマップ

## 実装戦略 R7：walking skeletonを先に通す

この節は、未完了foundationをphase順に横展開してからuser-visible integrationへ進む実装順序と、すべてのsliceでfull gateを繰り返す規則をsupersedeします。
設計正本のruntime semantics、既存sliceのowner、dependency、排他的write set、acceptance obligationは変更しません。
変更するのは実装の優先順位、review unit、gateの実行頻度です。
reviewer数と収束上限は[Review policy R8](../process/review-policy.md#policy-r8)だけを正本とします。

次の主要マイルストーンを**WS01 maintainable walking skeleton**とします。
WS01は専用の簡易IRまたは使い捨てruntimeを作らず、最終構造と同じ経路を通る最小のend-to-end実装です。

```text
source
  -> ExecutionGraph
  -> ObservationContract
  -> MaterializationPlan
  -> ClientScopeGraph
  -> server/client artifact
  -> SSR
  -> activation
```

最初に扱うworkflowは、server-onlyなhighlight処理とstatic subtreeをserverへ残し、copy interactionのcallbackだけをclient artifactへ含める`DocCodeBlock`相当のfixtureです。
特定のcomponent名またはfixture pathをproduction codeへ埋め込んではいけません。
最初のrevisionで対応するnode、edge、materialization、activation variantを限定して構いませんが、未対応variantをeager hydration、component rerender、full module配信、暗黙RPCへfallbackしてはいけません。
未対応variantはdependency pathを持つcompile diagnosticにし、後続sliceは同じIRとartifact contractへvariantを追加してください。

| slice | 完成させる経路 | 主なowner | 単独のacceptance |
| --- | --- | --- | --- |
| `WS01-0` | 既存matrixからWS01-A〜Eに必要なfine slice、dependency OID、owner、排他的write setを抽出する | main integration process | 未完了dependencyを迂回せず、各WS01 sliceの開始条件とintegration ownerをacyclicな表へ固定する |
| `WS01-A` | sourceからserver root、browser callback、必要edgeを導出し、ExecutionGraphとObservationContractへ接続する | transformer analysis | component名に依存しないfixtureからroot/edgeとdiagnosticを決定的に生成する |
| `WS01-B` | callbackに必要なmaterializationとclient scopeだけを導出し、server/client artifact closureを分離する | transformer planner/compiler | server-only importがclient closureへ入らず、static subtreeがclient mutation planへ入らない |
| `WS01-C` | server artifactからstatic HTML、DSD、activation metadataを生成する | transformer server renderer、runtime SSR、components SSR | highlighted subtreeをserverで生成し、component bodyのclient再実行を要求しない |
| `WS01-D` | 既存DOMへcallbackだけをattachし、client rootがないrouteをzero-bootstrapにする | runtime bootstrap、activation、DOM event | copy interactionだけがactivateされ、static DOM identityを維持し、root不在時はpayloadとbootstrapを生成しない |
| `WS01-E` | build toolからbrowserまで接続し、artifactを検査する | plugin、docs fixture、playground E2E | SSR前表示、interaction、server-only exclusion、body非再実行、zero-bootstrapを一つのworkflowで検証する |

WS01-0を完了した後、WS01-AからWS01-Eを直列の主経路とします。
各sliceはその時点で実用的なsupported subsetとしてgreenにし、後続sliceのplaceholder APIまたはproduction stubを追加してはいけません。
WS01-EのE2Eとartifact inspectionはgoal完了まで恒久的な回帰testとして保持してください。

WS01 IDは既存matrixのdependencyを置き換えるaliasではありません。
WS01-AはcompletedなEG03 `4ebd2204e504c21d34e50db6e0b89b55e2c3df41`とOC01 `86204daaead270029be46acd7f212f156716fd07`に加え、少なくともSC02 completion、SC03-Q/C/T、PL01、PL02-A/Vの順に依存します。
したがって、SC02の直接dependencyであるSC02A8D-WはWS01が直接必要とするfoundationとして再開対象です。

WS01-0はWS01-B以降についても、現行matrixのtarget ownerからdependency closureを逆向きにたどり、必要なaggregateを既存のfine review unitへ展開します。
既存aggregateの一部variantだけをsupported subsetへ含める場合は、ownerとdependency edgeを保ったfine sliceをprocess reviewで先に固定してください。
completed commitまたはreview済みexact revisionがないdependencyをdiagnosticで代用してproduction実装を開始してはいけません。

この戦略を採用した時点でreview中またはcommit準備中のfixed revisionは、blobとdecision anchorが変わっていなければ完了まで継続します。
fixed revisionになる前の未commit差分は破棄せず、実行中commandを安全に終了し、write ownershipと再開条件を進捗文書へ記録して保管してください。
その差分を横方向foundation sliceとしてreview、commit、pushせず、WS01が直接必要になった場合またはWS01-E完了後に再開します。
それ以外の横方向foundation sliceも、WS01が直接必要とするdependencyを除いてWS01-E完了後へ延期します。


## 実装順序

次のphase一覧はgoal全体のacceptance coverageとdependencyを表し、WS01-E完了前のscheduler順序を表しません。
実装はWS01の主経路を優先し、各WS01 sliceが必要とするphase要件だけを最終構造へ実装してください。
WS01-E完了後は、次のdependency orderを基本として未完了variantとprotocolを拡張します。
実コードを調査して依存関係が異なると証明できた場合は、理由を進捗文書に記録して順序を修正してください。

### Phase 1：ExecutionGraph foundation

- ModuleCoordinator と module graph snapshot
- ExecutionGraph の node、edge、TemplateNode、Occurrence、identity
- ObservationContract、composition、RealizationWitness
- canonical preimage、digest、qualified ID の共通 primitive
- incremental invalidation と deterministic graph test

### Phase 2：semantic contract と registry

- semantic fact、relation、execution contract
- registry descriptor と environment/role binding
- browser/server-request projection と protocol binding
- conflict、namespace、dangling reference、kind mismatch diagnostic
- contract compiler と runtime validation

### Phase 3：解析と placement

- root、read、effect、callback、module evaluation の導出
- functional component と `defineComponent` の graph transparency
- function extraction、capture、mutable state、module closure
- environment constraint、exposure、authority label
- finite candidate solver、cost vector、diagnostic path

### Phase 4：server render

- server renderer を ExecutionGraph から生成する経路
- RenderOperation、retry、cancellation、header、stream
- FinalHeaderCommit、Early Hints、non-atomic writer
- DSD、static DOM、style artifact の server output

### Phase 5：materialization と projection

- MaterializationRequirement と MaterializationPlan
- snapshot、codec、graph-table、reference、subscription、remote operation
- request class、projection definition、projection instance
- artifact address、integrity、manifest core、fixed envelope、plan identity
- budget、wire validation、private loader と boot authority

### Phase 6：ClientScopeGraph と client runtime

- client root、activation group、shared state、prerequisite
- lifetime owner、lease、generation、allocation/commit transaction
- bootstrap の request-reachable projection
- RuntimeFailureChannel、FailureRef、cleanup ledger
- client root がない route の zero-bootstrap path

### Phase 7：DOM activation

- marker、binding、existing DOM attachment
- DSD parse fence と custom-element reaction ordering
- reconciliation、user input、autofill、history restoration
- event admission、interaction recording、dynamic client UI
- `render:client`、`activate:*`、`dom:external`

### Phase 8：protocol と lifecycle

- reference cache、grant、lease、release
- subscription continuity、namespace、session incarnation、pair fence、resync、ack、GC
- remote admission、canonical wire、authorization cut、receipt、recovery、watermark
- effect、activation、dispose、late settlement、failure containment
- hard budget と bounded cleanup

### Phase 9：公開 API と移行

- components、runtime、core、plugin の export
- `defineComponent` と functional component の最終 semantics
- docs と playground の新 API への移行
- `DocCodeBlock` の server/client artifact 分割
- 旧 hydration、island、manual hydrate、fallback の削除
- 旧 semantics の test fixture と reference data の置換

### Phase 10：全体 acceptance

- 設計正本の全 acceptance work の直接検証
- cross-package integration と E2E
- artifact closure、byte identity、reproducible build の検査
- race、budget、cancellation、cleanup、authority の stress test
- incremental build cost と runtime memory の測定
- 公開 API、docs、example の整合確認

各 phase は複数の vertical slice に分割して構いません。
型だけをまとめて追加し、利用されない placeholder を残したまま phase 完了としてはいけません。
