# 宣言的 UI 実行分割の実装進捗

更新日: 2026-07-13
状態: 実装中

## 再開情報

- 実装指示: `.temp/declarative-ui-execution-partitioning-implementation-goal.md`
- 設計正本: `.temp/declarative-ui-execution-partitioning.md`
- 作業 branch: `feature/declarative-ui-execution-partitioning`
- 起点 commit: `71186a8e919c44d0dbc626effdf08ed5120cd790`
- push 先: `origin/feature/declarative-ui-execution-partitioning`
- 次のscheduler action: artifact laneはaccepted AR01-E error foundationを実装する。execution laneはSC02A8D occurrence walkerを継続し、SC02A8I canonical meterは共有SPEC/test ownership返却後のready queueに保つ。
- 外部 blocker: なし

## 状態の意味

- `pending`: dependencyが未完了で開始できない。
- `ready`: production implementationを開始するdependencyが完了している。
- `contract-ready`: SPEC、先行test、公開または内部contractが固定され、実装待ちである。
- `implementing`: 宣言済みwrite setでproduction implementationとtargeted gateを進めている。
- `reviewing`: 同一revisionを固定して独立reviewを進めている。
- `merge-ready`: 既知のblockerがなく、commitとpushを待っている。
- `completed`: 検証、review、commit、push、local/remote同期が完了している。
- `blocked`: 未解決dependencyまたは外部blockerによって、そのslice自身を進められない。
- `reopened`: completed後の監査で不足が見つかり、再作業が必要である。
- `in-progress`: phaseまたは複数sliceを集約した行だけに使う。

## Dynamic scheduler

sliceのcontract固定、実装完了、review開始または収束、dependency変更、lane解放のたびにready queueを再計算する。
優先順位はcritical path、後続解放数、独立した長時間検証の順とし、write setが重ならない四laneを通常上限、統合余力がある場合は六laneを最大上限とする。
あるsliceのreviewまたはblockerは、そのsliceへ依存せずwrite setも重ならないlaneを停止しない。
固定revisionはslice-local manifestで表し、別laneのcommitによるHEAD前進と共有文書の無関係な変更では無効にしない。

| Lane | Slice | Owner | 状態 | 完了dependency OID | 専有write set | 固定contract | 次のgate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | SC02A8C active ancestor | main integration | completed | SC02A8B commit `7dc62e79832f28d9a196e6993c7a1d3429b5b5be` | `executionContract`の5-file slice | active ancestorだけをcycle、strict LIFO rollback、leave後alias、iterative depth | commit `c37a81e8d932d712c6118d6865b6b29f94d59492`をpush済み |
| L2 | AR01-E error foundation | implementation worker | implementing | accepted designとcanonical integration R2 `e22593423e52e817670a3c9a786f0e55eda0e957` | `artifactContract`のAGENTS/SPEC/cumulative test/facade/new error module/test/type fixture | exact ten-code union、immutable root-relative path、error/budget/snapshot split | focused gateとadmission sizeを確認してfixed review revisionを発行する |
| L3 | SC02A8D occurrence walker | implementation worker | implementing | SC02A8B commit `7dc62e79832f28d9a196e6993c7a1d3429b5b5be`とSC02A8C commit `c37a81e8d932d712c6118d6865b6b29f94d59492` | `executionContract`のSPEC/cumulative test/new plan module/test/type fixture | descriptor viewとactive ancestorをiterative traversalへ統合 | focused gateとadmission sizeを確認してfixed review revisionを発行する |
| L4 | SC02A8I canonical meter | ready queue | ready | ID01-CB commit `e42fec40210aeead036209f209e9038632421f5b`とSC02A8A commit `02bdfe4a662de7f0799f3211a9464303f2a2cbbc` | 後続`executionContract` canonical slice | full output非生成、exact byte/work、downstream予約 | L3の共有SPEC/test ownership返却後に開始する |

SC02A2、SC02A3、SC02A4、SC02A5、SC02A6、SC02A7、MP01-DK1-T、MP01-DR-S-R4 integration、AR01-ID、AR01-FT、AR01-EB、AR01-DB、AR01-XB、RC01-DI2B、RC01-DI3A、RC01-DI3Bはslice-local reviewが収束し、各commitをpush済みである。
SC02A5のfixed snapshotではfocused 38 tests、shared全15 filesと224 tests、typecheck、通常lint 0件、format、build、root source/build非公開検査が成功した。
type-aware lintは変更外の`rlse.config.ts:32`に既存warning 1件だけを報告した。
Popper、Ramanujan、旧MP01 design reviewer三者、旧RC01 ownerは現在のsessionから`not_found`であり、未回収結果を収束証拠として扱わない。
Nash、Socrates、Jason、Ampereの収束試行は固定入力がレビュー中または開始前に変更されたため`REVIEW INVALID`とし、判定回数へ含めない。
Linnaeus、Lagrange、Parfitの試行はdisjointなAR01 commitによるglobal HEAD前進だけで無効にしたため、slice-local manifest導入前の無効試行として判定回数へ含めない。
MP01は`DK1 taxonomy → DR → DG → DP`の独立design revisionを維持する。旧DK2のshared bridgeは追加せず、qualificationとadmissionをSC03、PL02、CN01、MP02、AF01、SL01、RR01のowner pipelineへ分ける。
AR01は`ID nominal domain → FT finalization template → entry binding → dependency binding → export binding → DP`までを共通predecessorとする。DP後は`DS → DV → DD`と`P → PS → PV → PI → PC / URL / IT`へ分岐し、AF01 candidate finalization、SL01 selection、RR01 conformanceへ合流する。
RC01はRenderDefinition、generation、RenderEnvelopeを別revisionとする。
RenderDefinition identityもmodel/error、closed snapshot、identity operationの三implementation revisionへ分ける。

MP01-DR-S R1の三役は、state update modeのauthoritative input不在、`CN01-D -> CN01-G`間のvalidation/identity欠落、既存facade inventory消失、transformer向け合法export不在をblockerとした。
R2はexact schemaを撤回し、owner correction、state prerequisite、materialization/emission schema、publication、derivation、validation、identityへ分割した。
R2収束reviewは、emission側subpath不在、DM/DEを直列化した誤り、DVがPL02-Vからprojection completenessを再検証しない点、state policy admission owner不在をblockerとした。
R3はDM/DE並列化、separate publication、state semantics authorityを解消したが、DAGの必須edge省略、raw claim closure前のequality、OC02 implementationの過大粒度で再度`REJECT`となった。
R4はOC02をdesign/type/closed validation/identity/behaviorへ、PL02 state pathをdesign/lowering/admissionへ、CN01 demand validationをraw parser/acceptanceへ分割し、全dependency edgeとtrust-safe順序を明示した。
Laplaceの旧ルールfresh convergence reviewはR1からR3のblockerが解消し、新しいcorrectness blockerがないとして`ACCEPT`した。
CN01-DVP/DVAの偽造snapshotとparser-version mismatch、AS01-MP/EPのpackage inversionとsubpath、SL01のserver-first cost orderとdeterministic tie-breakを後続fixture obligationとして残す。

進捗文書、`packages/shared/src/index.ts`、package export、共通config、複数laneの統合箇所はメインセッションだけが編集する。
各laneは専有write setだけを変更し、メインセッションがreview revisionを固定する前にroot exposureと統合gateを追加する。

## 手順の進捗

| ID | 作業 | 状態 | 証拠 |
| --- | --- | --- | --- |
| S00 | branch、計画文書、baseline | completed | `gnb` で branch を作成し、計画 commit `8a0eedd` を push した。全 baseline command が成功した |
| S01 | implementation matrix | completed | 59 row 全件が AX01 の依存閉包に入り、A01〜A44 の owner/evidence を確定した。3回目の独立レビューは ACCEPT |
| S02 | verification-gate slice | completed | 5回の独立レビューを収束させ、commit `8fe6c60` を push した |
| P01 | ExecutionGraph foundation | completed | ID01、SC01、OC01、EG01、EG02、EG03 の検証、独立レビュー、commit、push が完了した |
| P02 | semantic contract と registry | in-progress | SC01 registry contract は completed。SC02Aの設計reviewは収束済みであり、実装はSC02A1からSC02A13へ再分割した |
| P03 | 解析と placement | pending | 未着手 |
| P04 | server render | pending | 未着手 |
| P05 | materialization と projection | pending | 未着手 |
| P06 | ClientScopeGraph と client runtime | pending | 未着手 |
| P07 | DOM activation | pending | 未着手 |
| P08 | protocol と lifecycle | pending | 未着手 |
| P09 | 公開 API と移行 | pending | 未着手 |
| P10 | 全体 acceptance | pending | 未着手 |
| S10 | push 後の全体監査 | pending | 未着手 |
| S11 | exact remote OID の最終監査 | pending | 未着手 |

## Baseline

branch 作成前の `doc/hydration-policy` は clean であり、local HEAD と `origin/doc/hydration-policy` は `71186a8e919c44d0dbc626effdf08ed5120cd790` で一致していた。

| Command | 状態 | 結果 |
| --- | --- | --- |
| `pnpm build` | completed | exit 0。8 package の成果物を生成した |
| `pnpm test` | completed | exit 0。全 package test が成功した |
| `pnpm typecheck` | completed | exit 0。8 package が成功した |
| `pnpm lint` | completed | exit 0。8 package が成功した |
| `pnpm fmt:check` | completed | exit 0。script を持つ package と3 playground が成功した |
| `pnpm test:e2e` | completed | exit 0。15 files、15 tests が成功した |
| `pnpm --filter @dathra/config lint` | completed | exit 0 |
| `pnpm --filter @dathra/config lint:type-aware` | completed | exit 0 |
| `pnpm --filter @dathra/docs build` | completed | exit 0。client と server bundle を生成した |
| `pnpm --filter @dathra/docs build:cloudflare` | completed | exit 0。client と worker bundle を生成した |
| `pnpm --filter @dathra/docs fmt:check` | completed | exit 0。41 files を検査した |
| `pnpm --filter @playground/e2e build` | completed | exit 0。dependency、client、server build が成功した |
| `pnpm --filter @playground/e2e fmt:check` | completed | exit 0。46 files を検査した |
| `pnpm --filter @playground/ssr build` | completed | exit 0。dependency、client、server build が成功した |
| `pnpm --filter @playground/ssr fmt:check` | completed | exit 0。22 files を検査した |
| `pnpm --filter @playground/vanilla build` | completed | exit 0。Vite production build が成功した |
| `pnpm --filter @playground/vanilla fmt:check` | completed | exit 0。9 files を検査した |
| `pnpm --filter @playground/getting-started-check build` | completed | exit 0。client と server build が成功した |
| `pnpm --filter @playground/nuxt build` | completed | exit 0。Nuxt client、server、Nitro build が成功した |

baseline では失敗を検出しなかったため、baseline-repair slice は不要である。
plugin build の mixed exports と Rollup 型定義、config lint の TypeScript version、Nuxt build の browser data に既存 warning が出るが、いずれも exit 0 である。
`getting-started-check` と `nuxt` には `fmt:check` と `test` がなく、docs、`ssr`、`vanilla` には `test` がないため、VG01 で実処理を持つ gate を追加する。

## Implementation Matrix

依存順は foundation から user-visible workflow へ向け、各行を独立した vertical slice に分割する。
新規 API directory は、表に示す base path の下へ `AGENTS.md`、`SPEC.typ`、`implementation.test.ts`、`implementation.ts` を作る。
既存 API を更新する行は、表の SPEC と test を先に更新し、Accepted ADR と衝突する場合は superseding ADR を追加する。
schema producer だけを実装した行は、production producer と consumer の integration evidence が揃うまで completed にしない。
package 間で使う internal export、package export map、build entry は、その producer slice が同じ commit で追加する。
後段の public API 行は consumer を初めて解決可能にする作業ではなく、公開面の最終確定、JSDoc、不要な internal exposure の除去を担当する。

| ID | 設計要件 | 主担当と API base path | SPEC / Test | Implementation / artifact | Dependency | 状態 |
| --- | --- | --- | --- | --- | --- | --- |
| VG01 | docs と全 playground の実処理 gate | root、`docs/`、`playgrounds/{e2e,ssr,vanilla,getting-started-check,nuxt}/` | app ごとの workflow test と `vitest.config.ts` | package scripts、CI、Nuxt context repair | なし | completed |
| ID01 | canonical preimage、digest、qualified ID | shared: `src/canonicalIdentity/` | 同 directory の SPEC / test | 同 directory の implementation | VG01 | completed |
| SC01 | RegistryId、descriptor、symbolic/final catalog、environment projection | shared: `src/executionRegistry/` | 同 directory の SPEC / test | closed registry schema、role matrix、fixed-point derivation と validation | ID01 | completed |
| OC01 | ObservationContract、canonical trace language、composition、RealizationWitness | shared: `src/observationContract/` | 同 directory の SPEC / test | canonical DFA、relation projection/inclusion、claim、instance witness の pure implementation | SC01 / ID01 | completed |
| EG01 | immutable module graph snapshot | transformer: `src/moduleGraph/` | 同 directory の SPEC / test | canonical module request、content digest、snapshot | ID01 | completed |
| EG02 | ModuleCoordinator、fixed point、incremental invalidation | transformer: `src/moduleCoordinator/` | 同 directory の SPEC / test | resolver/load/transform adapter、barrier、cache | EG01 | completed |
| EG03 | ExecutionGraph、TemplateNode、Occurrence、root、edge | transformer: `src/executionGraph/` | 同 directory の SPEC / test | deterministic graph builder | EG02 / OC01 | completed |
| SC02 | semantic fact、relation、source/compiled execution contract | shared: `src/executionContract/` | 同 directory の SPEC / focused test | SC02A1からSC02A13のsource-local契約、SC02B qualified compiled schema | SC01 / ID01 | in-progress |
| SC03 | contract qualification、source conflict、qualification後のdangling/kind diagnostic | transformer: `src/diagnostic/`、`src/contractCompiler/` | 各 directory の SPEC / test | diagnostic path、artifact 非依存の QualifiedRegistryUniverse、policy proof-domain verifier profile admission | EG02 / SC01 / SC02 / OC01 | pending |
| PL01 | function extraction、capture、mutable state、module closure | transformer: `src/moduleClosure/` | 同 directory の SPEC / test | NativeModuleClosure と client closure evidence | EG03 / SC03 | pending |
| PL02 | root、read、effect、callback、module evaluation の導出 | transformer: `src/executionAnalysis/` | 同 directory の SPEC / test。既存 `transform/SPEC.typ` に superseding ADR | component-transparent semantic analysis | EG03 / SC03 / PL01 | pending |
| DX01 | `render:client`、`activate:*`、`dom:external` lowering | transformer: `src/executionDirectives/` | 同 directory の SPEC / test。既存 JSX/tree ADR を supersede | reserved prop validation と root/region binding | PL02 | pending |
| MP01 | materialization requirement、kind、plan schema | shared: `src/materializationContract/` | 同 directory の SPEC / test | snapshot、codec、graph-table、reference、subscription、remote kind | SC01 / OC01 | ready |
| AR01 | artifact address、exact bytes、integrity schema | shared: `src/artifactContract/` | 同 directory の SPEC / test | canonical address、URL、integrity table | ID01 | ready |
| PI01 | cost metric と plan identity schema | shared: `src/planIdentity/` | 同 directory の SPEC / test | metric vector、integrity-bound plan identity | AR01 / OC01 | pending |
| PJ01 | request class、projection definition/instance、manifest、BootAuthority | shared: `src/projectionContract/` | 同 directory の SPEC / test | request partition、ProjectionManifestCore、envelope、budget、trusted boot schema | AR01 / PI01 / MP01 | pending |
| RC01 | RenderEnvelope、publication、writer contract | shared: `src/renderContract/` | 同 directory の SPEC / test | render/writer closed schema | ID01 / OC01 | ready |
| RP01 | reference protocol schema | shared: `src/referenceProtocol/` | 同 directory の SPEC / test | grant、lease、release、wire DTO | SC01 / MP01 | pending |
| SP01 | subscription protocol schema | shared: `src/subscriptionProtocol/` | 同 directory の SPEC / test | continuity、incarnation、pair fence、resync、ack schema | RP01 | pending |
| OP01 | remote operation protocol schema | shared: `src/remoteProtocol/` | 同 directory の SPEC / test | admission、canonical wire、receipt、recovery schema | RP01 / PJ01 | pending |
| CN01 | finite candidate generation と合法性 | transformer: `src/candidatePlanner/` | 同 directory の SPEC / test | placement/materialization/adapter candidate DAG、candidate behavior summary、semantic claim、WitnessTemplate、coverage claim | PL02 / DX01 / MP01 / PJ01 / RC01 / RP01 / SP01 / OP01 / OC01 | pending |
| MP02 | demand-first MaterializationPlan 生成 | transformer: `src/materializationPlanner/` | 同 directory の SPEC / test | candidate ごとの demand、plan、diagnostic | CN01 / MP01 | pending |
| CG01 | ClientScopeGraph、root、group、state、prerequisite | transformer: `src/clientScopeGraph/` | 同 directory の SPEC / test | candidate ごとの client graph | CN01 / MP02 / DX01 | pending |
| SR01 | ExecutionGraph 由来の server renderer 生成 | transformer: `src/serverRenderer/` | 同 directory の SPEC / test。既存 mode SSR ADR を supersede | candidate ごとの generated server artifact | CN01 / RC01 | pending |
| CP01 | mode 非依存の candidate compiler facade | transformer: `src/compile/` | 同 directory の SPEC / integration test | coordinator から candidate artifact graph までの compile entry | CG01 / SR01 | pending |
| BR01 | module/contract graph と build tool の bridge | plugin: `src/buildCoordinator/` | 同 directory の SPEC / test | contract discovery、resolver bridge、graph-completeness barrier | CP01 / EG02 / SC03 | pending |
| RR01 | registry catalog と observation proof の runtime validation | runtime: `src/runtimeRegistry/` | 同 directory の SPEC / test | authenticated local catalog、pair commitment、fixed-point projection、branded policy proof verification、runtime observation conformance | SC01 / SC03 / PJ01 / OC01 | pending |
| MT01 | graph-table decode と materialization transaction | runtime: `src/materialization/` | 同 directory の SPEC / test | strict wire validation、codec preflight、budget、allocate/populate/commit | RR01 / MP01 / PJ01 | pending |
| SE01 | server-side graph-table payload encoder | runtime: `src/ssr/payloadEncoder/` | 同 directory の SPEC / test | canonical carrier、codec enforcement、budget | MT01 / MP02 / RC01 | pending |
| SR02 | RenderOperation、retry、cancel、header、stream | runtime: `src/ssr/renderOperation/` | 同 directory の SPEC / test | RenderOperation state machine、writer、dynamic sequence claim と instance witness | RC01 / SR01 / SE01 / OC01 | pending |
| SR03 | DSD、static DOM、style artifact の server output | components: 既存 `src/ssr/`、`src/defineComponent/` | 既存 SPEC / replacement test と superseding ADR | body replay を使わない renderer/shell contract | SR01 / SR02 | pending |
| CR01 | client scope instance、owner、lease、generation、transaction | runtime: `src/clientScope/` | 同 directory の SPEC / test | allocation/commit/dispose coordinator | CG01 / PJ01 / MT01 | pending |
| RF01 | RuntimeFailureChannel、FailureRef、opaque subject、pin budget | runtime: `src/runtimeFailure/` | 同 directory の SPEC / test | failure retention、pin、redaction、notification | CR01 / PJ01 | pending |
| LC01 | effect、onActivate、onDispose、cleanup DAG、late ledger | runtime: `src/lifecycle/` | 同 directory の SPEC / test | generation-owned lifecycle と bounded cleanup | CR01 / RF01 | pending |
| CP02 | ActivationCapability と budgeted operation ledger | runtime: `src/activationCapability/`、`src/operationLedger/` | 各 directory の SPEC / test | boot scope、selector、CAS、watermark、terminal slot | CR01 / RF01 / LC01 | pending |
| CR02 | request-reachable bootstrap と zero-bootstrap | runtime: `src/bootstrap/` | 同 directory の SPEC / test | private loader、BootAuthority、failure injection | CR01 / MT01 / CP02 | pending |
| DA01 | marker、binding、existing DOM attachment、DSD fence | runtime: `src/dom/markers/`、`src/activation/` | 各 directory の SPEC / test。旧 hydration marker ADR を supersede | marker index、parse/reaction fence、activation state | CR02 / DX01 / SR03 / LC01 | pending |
| DA02 | reconciliation、event admission、input preservation | runtime: `src/dom/reconciliation/`、既存 `src/events/` | 各 SPEC / test。既存 reconcile/events 契約を更新 | mutable facet reconcile と stable event entry | DA01 / LC01 | pending |
| DA03 | dynamic list、conditional UI、navigation、late fragment | runtime: `src/dom/slots/` | 同 directory の SPEC / test | slot allocation/commit transaction | DA02 / CR01 | pending |
| DA04 | custom-element shell、move、adoption、disconnect generation | components: `src/customElementShell/`、既存 `src/defineComponent/` | 新旧 directory の SPEC / test と superseding ADR | DSD-preserving platform lifecycle bridge | DA01 / DA02 / SR03 | pending |
| RP02 | reference cache、grant、lease、release | runtime: `src/reference/` | 同 directory の SPEC / test | reference runtime state machine | RP01 / MT01 / CR01 / CP02 | pending |
| SP02 | subscription continuity、pair fence、resync、ack、GC | runtime: `src/subscription/` | 同 directory の SPEC / race test | non-reused incarnation と atomic owner/session fence | SP01 / RP02 / LC01 / CP02 | pending |
| OP02 | remote admission、wire、authorization、receipt、recovery | runtime: `src/remoteOperation/` | 同 directory の SPEC / race/authority test | private object、wire DTO、verified receipt state machine | OP01 / RP02 / LC01 / CP02 | pending |
| ST01 | store snapshot API を新 materialization transport へ接続 | store: 既存 `src/defineAtomStoreSnapshot/`、runtime payload/materialization | store SPEC / replacement integration test | `AtomStoreSnapshot.hydrate()` は保持し、`data-dh-store` transport を置換 | MT01 / SE01 | pending |
| CE01 | client semantic unit と runtime import artifact | transformer: `src/clientArtifactEmitter/` | 同 directory の SPEC / test | ClientScopeGraph から request-reachable module graph を生成 | CG01 / CR02 / DA04 / SP02 / OP02 | pending |
| AF01 | candidate ごとの final bytes と integrity table | plugin: `src/artifactFinalizer/` | 同 directory の SPEC / deterministic fixture test | address、exact bytes、static sequence/base URL claim、parser reproduction record、registry catalog/pair/fixed point、manifest core integrity、metrics | BR01 / AR01 / CE01 / SR02 / PJ01 / SC01 / OC01 | pending |
| SL01 | finalization 後の cost selection と plan ID | transformer: `src/finalPlanSelector/` | 同 directory の SPEC / optimality/reproducibility test | semantic subset、cost vector、plan identity、post-finalization witness、admission sidecar | CN01 / AF01 / PI01 / OC01 | pending |
| PE01 | selected projection の manifest/envelope/bootstrap emission | plugin: `src/projectionEmitter/` | 同 directory の SPEC / artifact test | AF01 finalized core/projection の再生成なし emission、fixed envelope、zero-bootstrap output | SL01 / PJ01 / CR02 / SC01 | pending |
| BO01 | cross-build candidate orchestration | plugin: `src/buildOrchestrator/` | 同 directory の SPEC / integration test | bridge、candidate finalization、selection、projection publication | BR01 / AF01 / SL01 / PE01 | pending |
| BA01 | bundler-native finalization | plugin: `src/{vite,rollup,webpack,esbuild}/` | 各 adapter SPEC / real build fixture test | generateBundle、processAssets、onEnd integration | BO01 | pending |
| AS01 | shared contract export surface の最終監査 | shared: `src/index.ts`、`package.json`、`tsdown.config.ts` | contract integration/type test | role-scoped subpath の固定と不要な root exposure の除去 | OC01 / SC02 / MP01 / RC01 / RP01 / SP01 / OP01 / PI01 / PJ01 | pending |
| AT01 | transformer public compiler API | transformer: `src/index.ts`、`src/types.ts`、`package.json`、`tsdown.config.ts` | public API/type test と旧 transform ADR supersession | final compiler facade。`TransformOptions.mode` と旧 `transform()` を置換 | SL01 / CE01 | pending |
| AP01 | plugin public API と options | plugin: `src/index.ts`、既存 `src/plugin/`、`package.json`、`tsdown.config.ts` | public API/adapter test と旧 mode ADR supersession | `PluginOptions.mode` と per-file `doTransform` を置換 | BA01 | pending |
| AR02 | runtime public API の最終監査 | runtime: `src/index.ts`、subpath index、`package.json`、`tsdown.config.ts` | public API/type test | lifecycle、activation、protocol runtime の公開面を固定 | DA03 / SP02 / OP02 | pending |
| AU01 | components public API と JSX directive type | components: `src/index.ts`、`src/internal.ts`、`package.json`、`tsdown.config.ts` | defineComponent/JSX type replacement test | graph-transparent component と execution directive props | DA04 / DX01 | pending |
| AO01 | core author-facing facade | core: `src/contracts/`、既存 `src/ssr/`、root/runtime index、`package.json`、`tsdown.config.ts` | contracts/public API/type test | `factId`、`registryId`、`define*`、lifecycle、RenderOperation export。`./hydration` を置換 | AS01 / AT01 / AP01 / AR02 / AU01 | pending |
| MG01 | docs、全 playground、DocCodeBlock の新経路移行 | docs / playgrounds | workflow/E2E/artifact closure test | entry、examples、reference、DocCodeBlock | AO01 | pending |
| RM01 | 旧 UI hydration、island、manual API、fallback の削除 | shared/components/runtime/transformer/plugin/core | 各旧 SPEC に superseding ADR と replacement test | old directories、exports、metadata、fixture を削除 | MG01 / ST01 | pending |
| AX01 | 全 acceptance、artifact、benchmark、stress、reproducibility | repository 全体 | integration/E2E/stress/benchmark | final artifact inspection と evidence | RM01 | pending |

### VG01 の観測条件

- docs は production server bundle を実行し、`GET /` 相当が status 200、DSD、代表 route content を返すことを検証する。
- e2e は既存の production preview + Chromium workflow 全件を継続する。
- SSR playground は production server bundle から代表 route を render し、DSD と request-scoped content を検証する。
- vanilla playground は production preview を Chromium で開き、counter interaction と reactive DOM 更新を検証する。
- getting-started-check は production server bundle を実行し、DSD と初期 counter content を検証する。
- Nuxt は production Nitro server を起動し、`GET /` の status 200、DSD、代表 counter interaction を Chromium で検証する。
- root aggregate command と CI は docs と全 playground の `build`、`fmt:check`、`test` を実行する。

### VG01 の検証証拠

新しい browser gate は、build だけでは検出できなかった既存 consumer failure を検出した。
vanilla では `Signal.update()` の呼び出しにより最初の counter click が `TypeError` になり、Nuxt では旧 setup context の `attrs` 参照により production Nitro server が `GET /` へ HTTP 500 を返した。
現行の signal API と `defineComponent()` context に consumer を移行し、Nuxt client bundle では custom-element registration が tree-shaking されないことも同じ browser test で確認した。

| Command | 状態 | 結果 |
| --- | --- | --- |
| `pnpm --filter @playground/vanilla test` | completed | production preview を Chromium で開き、JSX counter、runtime counter、list reconciliation、FC toggle、custom-element counter の interaction、reactive DOM 更新、page error 不在を検証した |
| `pnpm --filter @playground/nuxt test` | completed | production Nitro server の status 200、DSD、client registration、counter の `5` から `6` への更新を検証した |
| `pnpm --filter @playground/e2e test` | completed | package script で production build を一度完了してから、明示的な suite teardown を使う15 files、15 tests が31.23秒で成功した。終了後に preview process が残らないことを確認した |
| `pnpm --filter @playground/e2e exec tsc --noEmit` | completed | E2E harness と全 fixture の型検査が成功した |
| `pnpm fmt:check` | completed | docs、全 playground、全 package を含む14 workspace project の format gate が成功した |
| `pnpm build` | completed | 8 package の production build が成功した |
| `pnpm build:apps` | completed | docs と5 playground の production build が成功した |
| `pnpm test:apps` | completed | 最新差分で docs と全 playground の test が成功した。既存 E2E は15 files、15 tests が成功した |
| `pnpm --filter @dathra/docs build:cloudflare` | completed | client と Cloudflare worker bundle の build が成功した |
| `pnpm test` | completed | 8 package、1,330 tests が成功した |
| `pnpm typecheck` | completed | 8 package が成功した |
| `pnpm lint` | completed | 8 package が warning 0、error 0 で成功した |
| `pnpm install --frozen-lockfile` | completed | dependency 追加後の lockfile 整合性を確認した |

### Matrix 調査根拠

- transformer は現在、単一 source file を CSR/SSR mode で変換し、module graph、typed diagnostic、registry、placement solver を持たない。
- runtime/components は `renderToString`、component setup replay、numeric hydration marker、manual plan、island scheduler、rerender fallback に結合している。
- plugin は code と source map だけを返し、SSR/client build を共有する coordinator、projection manifest、content-addressed finalization を持たない。
- docs と playground の build は成功するが、Nuxt の既存 production artifact は `/` で HTTP 500 になるため、build だけでは workflow correctness を検証できない。
- `DocCodeBlock` の Shiki dependency は baseline client bundle には入らないが、旧 `hydrate:preserve` と generic hydration plan に依存しているため、A42 の最終証拠にはならない。
- `@dathra/store` の snapshot schema にある `hydrate()` は UI hydration ではなく、RM01 の削除対象外である。
- 現行 solver は final bytes を持たないため、candidate generation と finalization 後 selection を CN01 と SL01 に分離した。
- Phase 5 の finalization は Phase 6〜8 の client runtime semantic unit を実際に bundle してからでなければ cost を確定できないため、設計正本の dependency を根拠に AF01 と SL01 を runtime/activation/protocol 後へ配置した。

## 現在の Slice

### SC02A source contract decomposition

SC02Aの設計判断は変更しない。
従来のSC02Aは、独立してgreenにできるidentity、model、入力境界、semantic parser、registry/export parser、local closure、source closure、digest/publicationを一つのreview revisionへ束ねていた。
先行testが3,068行、modelが767行となり、新しいreview-unit admission gateの停止条件へ到達したため、未commit変更を保持したまま独立したvertical sliceへ段階的に再編する。
最初の再編ではidentityとmodelをSC02A1へ残したが、手書き差分が1,522行となって停止条件へ再到達した。
`FactId`とstable errorはsemantic unionなしでgreenにできるため、例外扱いせずSC02A1とSC02A2へ分けた。

| slice | 観測可能な契約 | ownerとmodule | 先行test | 単独greenの根拠 | 状態 |
| --- | --- | --- | --- | --- | --- |
| SC02A1 | source-local `FactId`とstable error | `identity.ts`、`implementation.ts` | `factId()`、Unicode、error immutability、facade boundary | semantic modelなしでidentity boundaryとして完結する | completed |
| SC02A2 | source-local subjectとpath taxonomy | `model.ts`、`implementation.ts` | 7 subject、3 pathと全variant shapeのexact type fixture | fact、relation、source envelopeなしでlocation contractとして完結する | completed |
| SC02A3 | 16 source-local factと6 transfer binding | `factModel.ts`、`implementation.ts` | 全fact kind、field、closed enum、brand分離のexact type fixture | subject modelへ依存する一つのfact schemaとして単独greenにできる | completed |
| SC02A4 | 8 source-local semantic relation | `relationModel.ts`、`implementation.ts` | 全relation endpoint、ordinal exclusivity、illegal edge fixture | fact kindへ依存するbehavioral edge schemaとして単独greenにできる | completed |
| SC02A5 | export summary schema | `exportModel.ts`、`implementation.ts` | callable、receiver brand、value domain、transfer summaryのexact fixture | factとtransfer typeだけへ依存する独立summaryである | completed |
| SC02A6 | 10 registry source collection schema | `registrySourceModel.ts`、`implementation.ts` | collection keyと`RegistrySourceEntry<Kind>`のexact mapping | SC01 typeだけへ依存する独立registry source schemaである | completed |
| SC02A7 | source contract envelope | `sourceModel.ts`、`implementation.ts` | source field、export/registry composition、untrusted claim、future API不在 | A1からA6を束ねるaggregateだけを所有する | completed |
| SC02A8-DESIGN | hostile closed-data boundaryとcanonical measurementのowner、counter、snapshot semantics | boundary/canonical別design revision | own-key課金、counter、source profile、alias clone、freeze、sort/meter work | productionをA8A-G、ID01-CB、A8I、A13へ分ける | completed |
| SC02A8A | budget contractとoperation-local ledger | `budget.ts`、focused test/type fixture | 15 field、narrow-only override、cumulative/peak exact/-1、ledger isolation | descriptorやsource semanticsなしでbudget APIを直接検証できる | completed |
| SC02A8B | distinct-container descriptor capture | `closedDescriptor.ts`、focused test | getter非実行、identity一回reflection、header/view、sparse/hidden/symbol rejection | source fieldを解釈せずdescriptor boundaryだけを検証できる | completed |
| SC02A8C | active-ancestor cycle policy | `activeAncestor.ts`、focused test | direct/indirect cycle、strict LIFO rollback、leave後alias、iterative depth | descriptor cloneと独立したcycle policyとしてgreenにできる | completed |
| SC02A8D | profile-driven occurrence walkerとparent-linked plan | `closedDataPlan.ts`、focused test | occurrence counter、alias再課金、parent path、profile hook order | A8A/B/Cを組み合わせ、clone前planだけを所有する | implementing |
| SC02A8E | execution-source cardinality/reference profile | `sourceProfile.ts`、focused test | 全source collection、reference、SemanticPathのprecharge exact/-1 | A8D profile interfaceへsource path ruleだけを実装できる | pending |
| SC02A8F | alias-expanding closed source clone | `snapshot.ts`、focused test | caller mutation隔離、alias identity分離、input再読なし | completed planからcloneだけを生成してgreenにできる | pending |
| SC02A8G | final public snapshotのiterative deep freeze | `freeze.ts`、focused test | nested freeze、deep chain、visited alias、validation step exact/-1 | A12 domain snapshotだけを入力にしてfreeze policyを検証できる | pending |
| ID01-CB | iterative bounded canonical builder | `canonicalIdentity/`のSPEC/test/implementation | byte identity、2冪境界、common-prefix、cycle/alias、instrumented work | public API/bytesを変えずcanonical builder単独でgreenにできる | completed |
| SC02A8I | canonical JCS byte/work meter | `canonicalMeasurement.ts`、focused test | UTF-8 byte一致、Unicode/number/key order、alias occurrence、byte/work exact/-1 | canonical text/digestを生成せずmeasurementだけを検証できる | ready |
| SC02A9 | subject、fact、relationのstrict parseとcanonical normalization | `semantic.ts` | 全semantic variantとcanonical order | registry、export、cross-record closureなしでstructural parserを検証できる | pending |
| SC02A10 | registry source、transfer binding、export recordのstrict parse | `registrySource.ts`、`exportSource.ts` | 10 registry kind、25 legal role tuple、transfer/export shape | semantic graph closureと独立したSC01 integrationとして検証できる | pending |
| SC02A11 | fact/relation local closure、ownership DAG、ordering semantics | `semanticClosure.ts` | endpoint/subject表、nested fact reference、ownership/order | parsed semantic recordsだけを入力にするpure validatorとして完結する | pending |
| SC02A12 | source assembly、registry/version/export/host closure、creator/parser | `source.ts` | registry reference、version、export direct summary、host assumption | A1からA11のvalidated partsを統合し、source snapshot APIを完成させる | pending |
| SC02A13 | canonical digestとpackage-local facade integration | `digest.ts`、`implementation.ts` | permutation digest、crypto failure、artifact/export boundary | 完成したsource parserへidentity operationだけを追加し、shared root publicationはAS01へ残す | pending |

各sliceは、その時点で実装する契約だけをSPECとtestへ追加し、後続sliceの失敗testを混在させない。
SC02A全体の設計review結果、relation表、reference表、budget表は親契約の制約として維持し、各sliceの実装reviewは`.temp/goal.md`の手順4から手順6を別revisionで適用する。

- **設計要件**：opaque boundary と author declaration を、source-local `FactId`、typed `SemanticFact`、typed `SemanticRelation`、export contract、SC01 registry source entry から成る closed `ExecutionContractSource` として表現する。
- **親slice境界**：SC02A1からSC02A13はsource-local契約だけを完成させる。SC02Bはqualified/compiled typeとstructural parserを追加し、SC03だけがSCC namespaceを計算してsource-local IDをqualified IDへ変換する。SC02Bのstructural brandもtrust acceptanceを意味しない。
- **変更範囲**：`packages/shared/src/executionContract/` に四点セットと focused internal module を追加し、source authoring APIをpackage-local facadeへ段階的に追加する。`@dathra/shared` rootまたはrole-scoped subpathへの公開はAS01が所有し、既存 canonical identity と execution registry の意味は変更しない。
- **package-local API**：`factId(value: string): FactId`、`defineExecutionContract(input: ExecutionContractSourceInput, budget?: ExecutionContractBudget): ExecutionContractSource`、`parseExecutionContractSource(value: unknown, budget?: ExecutionContractBudget): ExecutionContractSource`、`digestExecutionContractSource(value: unknown, budget?: ExecutionContractBudget): Promise<Sha256Digest>`、`ExecutionContractError`、`ExecutionContractBudget` と source-local semantic type だけを完成させる。`digestExecutionContractSource()` は unknown input をstrict parserで再検証してからdigestする。AS01とAO01が後でroot/subpathとauthor-facing facadeを所有し、SC02A は qualified type や acceptance API を先行公開しない。
- **trust boundary**：creator と parser の出力は、構造と source-local closure を満たす未信頼 claim である。`integrity.source = "compiler"`、`trust-boundary`、host assumption、canonical digest は evidence admission、host enforcement、placement permission を作らない。SC03 の qualified evidence と後続の `AcceptedExecutionAnalysis` がない source contract を client exclusion に利用できない。
- **behavioral edge**：`SemanticRelation` をbehavioral cross-fact edgeの唯一の正本にする。`read.readEffectFactId`、`write.writeEffectFactId`、`effect.readFactIds`、`effect.writeFactIds`、`effect.invocationFactIds`、`ownership.ownerFactId`、`ownership.lifetimeFactId`、`ordering.memberFactIds` はsource/compiled fact schemaから削除する。read/writeのenvironment/exposureはfactのattribute referenceとして残し、behavioral relationとは扱わない。
- **ownership と ordering**：ownership factはretentionだけを保持する。`owns` relationはoptionalなidentityまたはownership ownerを最大1件、lifetimeをexactly 1件結ぶ。ordering factはrelation kindだけを保持し、`orders-before` relationがmemberを結ぶ。`before`と`serial`では`ordinal`を0から始まるgap-free sequence、`exclusive`と`commutative`では`ordinal: null`のsetとする。
- **source-local closure**：FactId は contract 内で一意とし、read/write の environment と exposure、relation endpoint、export fact、host assumption を同じ contract の fact indexへ解決する。すべての semantic relation は異なる FactId を結ぶ。nested field と endpoint tag は exact reference-kind table と一致させる。host assumption は任意の local fact を未信頼 claim として参照できる。
- **registry closure**：すべての registry reference は同じ source contract の expected kind entry に解決する。version を持つ codec、resolver、subscription、remote transfer は `(kind, id, version)` を source entry と完全一致させる。registry implementation は SC01 の25 legal role tupleだけを許可する。
- **export closure**：export の `factIds` は同じ export name を持つ subject だけを参照し、module-evaluation subject を含めない。直接fieldとの照合対象はexactな`{ kind: "export-value", exportName }` subjectだけとする。`callable = none` は対象invocation fact 0件、その他はcallableとreceiver brandが一致する対象invocation fact 1件を要求する。`transfer.kind = none` は対象transfer fact 0件、その他はbindingが一致する対象transfer fact 1件を要求する。parameter callback、return、allocated resourceのinvocation/transfer factはこの件数へ含めない。value domainとreceiver brandはexact registry kindへ解決する。
- **SC03へ残す検証**：export name、parameter index、path、callback index、allocation site が実際の module signature と一致するか、source解析とcontractが衝突しないか、locator exportがdescriptor/implementation interfaceを満たすか、dependency contract SCCをどうqualificationするかだけを残す。`factId()` と `registryId()` の build-time literal 制約も SC03 が検証する。
- **identity**：source contractはdigest fieldを持たない。`digestExecutionContractSource()`は正規化済みsource snapshot全体のcanonical JCS SHA-256を返す。FactIdとRegistryIdはlocal domainに残し、qualified IDはSC02B/SC03より前に生成しない。
- **hard budget**：overrideはframework capを狭めるだけとし、一つのoperation-local ledgerをschema-aware descriptor preflight、closed snapshot、normalization、index、closure validation、canonical measurement、freeze、digestへ共有する。nested collectionはcloneより前に総数を課金する。getter、custom prototype、hidden/symbol property、sparse array、cycleはcallback実行なしで拒否する。
- **alias と stack**：shared alias は出現ごとに input budget、canonical byte、canonical workへ課金して許可し、active ancestor だけを cycle として拒否する。descriptor capture、walker、deep freeze、canonical builder、meterはiterativeにする。
- **初回並列設計レビュー**：contract、budget、最終目標の三 reviewer は全員 `REJECT` であった。trust acceptance、qualified type owner、relation subject、SemanticPath、canonical order、全 reference/version closure、host assumption、semantic edge 二重表現、ordering semantics、pre-clone budget、complexity table、API/error/test contract の指摘を blocker として採用し、この修正版へまとめた。
- **収束確認**：新しい一人のreviewerは12 blockerのうち7件を解消、5件を未解消として`REJECT`した。ownership/orderの残る二重表現、export照合subject、自己relation、reference-kind表、budget cap/counter名、exact API signatureを採用し、この最終修正版へ反映した。追加の全面reviewは行わず、SPEC tableと独立fixtureを収束証拠にする。
- **設計正本**：最終修正版を設計正本の「source execution contract の canonical boundary」へsuperseding decisionとして追加し、untrusted source、behavioral relation一元化、source closure、API、budget、failureを固定した。
- **親契約の先行draft**：61 test declaration（`it.each`展開後79 cases）と541行のSPECは、review-unit再編で`.temp/sc02a-review-unit-draft/`へそのまま保持した。後続sliceは該当するcontract fixtureだけをdraftから戻し、将来testを現在のsuiteへ混在させない。
- **red test 証拠**：再編前の`pnpm --filter @dathra/shared exec vitest run src/executionContract/implementation.test.ts`は`./implementation`不在の`Cannot find module`で失敗し、SPEC/testがproduction facadeより先に追加されたことを確認した。
- **SC02A1 SPEC/test/implementation**：141行のSPEC、focused identity/error test、`identity.ts`、6行のpackage-local facadeへ縮小した。手書き差分はAGENTSを含めても400行未満であり、後続parser、model、budget、closure、digestを含まない。
- **SC02A1 current validation**：targeted 15 testsとshared全9 files、180 testsが成功した。typecheckと通常lint 0件も成功し、type-aware lintは既存`rlse.config.ts`のwarning 1件だけを報告した。
- **SC02A1 initial parallel review**：同一hash manifestをcorrectness、SPEC/test/artifact、最終目標/package boundaryの三reviewerへ並列に渡した。最終目標と実装境界のreviewerはblockerなしで`ACCEPT`した。残るreviewerの重複指摘から、type-only facade境界の未検査、stable error codeの片方向fixture、digest形状と`FactId`戻り型の未検査をblockerとして採用した。
- **SC02A1 blocker correction**：facadeからinternal path segment typeを除き、qualified、compiled、accepted type-only importのnegative fixture、`Record<ExecutionContractErrorCode, true>`による双方向完全性、digest形状の受理、exact `FactId` return typeを追加した。文章表現だけの指摘はなく、修正後revisionを新しい一人で一回だけ収束確認する。
- **SC02A1 convergence review**：fresh reviewerはerror code完全性とFactId identity fixtureの解消、新しいcorrectness blockerの不在を確認した。internal path segment typeはfacadeから削除済みだが、その再公開を拒否するnegative fixtureがない一点だけを未解消としたため、`ExecutionContractPathSegment`のtype-only import failureを追加した。収束確認は規則どおり一回で終了し、この限定修正はtypecheckで直接検証する。
- **SC02A1 final slice gate**：限定fixture追加後、targeted 15 testsとidentity statement、branch、function、line coverage 100%、shared全9 filesと180 tests、typecheck、通常lint 0件、format、buildが成功した。type-aware lintは既存`rlse.config.ts`のwarning 1件だけであり、build artifactとshared rootにexecutionContract runtime/type APIが存在しないことをnegative inspectionで確認した。
- **dynamic scheduler migration**：worktree変更を保持し、実行中command 0件、read-only planning agent 3件を成果回収済みとしてcheckpointを作った。更新済みgoal、review手順、進捗文書を現行worktreeから再読し、L2からL4が設計レビュー先行であることをready queueへ反映した。
- **process rule commit**：review-unit admission gateとready queue、parallel lane規則を`98585c9c95bc1a02f71e26a764a67e9882519738`としてpushし、localとtracking branchのexact OID一致を確認した。このcommitはscheduler移行指示を受け取る前に完了しており、revertしない。
- **SC02A1 commit and push**：review済みのsource identity、親設計節、dynamic scheduler記録を`d5d704a45ad9366c681547fe875549b272d40d87`としてpushし、localとtracking branchのexact OID一致を確認した。SC02A1をcompletedとし、SC02A2をreadyへ移した。
- **SC02A2 red evidence**：SPECとtype fixtureを先に更新した時点のshared typecheckは、`EffectFact`、`SemanticFact`、`ExecutionContractSource`などが旧facadeに存在しないためexit 2で失敗した。type-only contractの先行失敗を確認してから`model.ts`とfacade type exportを追加した。
- **SC02A2 initial implementation gate**：16 fact、8 relation、7 subject、3 path、6 transfer binding、10 registry collection、removed field、ordinal exclusivity、未信頼source shapeをtype fixtureへ追加した。targeted 18 tests、executionContract runtime coverage 100%、shared全9 filesと183 tests、typecheck、通常lint 0件、format、buildが成功し、type-aware lintは既存warning 1件だけであった。unit差分は1,312行、最大fileは771行で停止条件未満であった。
- **SC02A2 initial parallel review**：最終目標と粒度のreviewerは、semantic taxonomyとsource envelopeが独立してgreenになるためscope blockerとした。correctnessとSPEC/test reviewerは、`ordinal?: never`が`ordinal: undefined`を受理することと、closed unionおよびrelation edge fixtureが片方向であることをblockerとした。三件を根拠とコードで再現し、すべて採用した。
- **SC02A2 first correction**：source envelope、export summary、10 registry collectionをsemantic taxonomyから分離した。non-ordering relationから`ordinal` keyを削除し、closed enum、fact kind、relation kind、endpoint、transfer shapeの双方向fixtureを追加した。
- **SC02A2 admission recheck**：first correctionはsubject/path、fact/transfer、relation matrixという三つの独立契約と手書き差分1,433行を残した。三者review開始直後にadmission gateを再適用し、reviewerを安全にshutdownして結果を採用せず、current revisionをSC02A2からSC02A4へ再編した。
- **SC02A2 subject/path revision**：current production revisionを7 subjectと3 path segmentだけへ縮小した。各variantのkeyとproperty type、closed kind union、repeated path、wrong type、extra field、後続API不在をfixtureで固定した。combined first correctionは`.temp/sc02a-review-unit-draft/`へ保持し、factとrelationの後続sliceで該当部分だけを戻す。
- **SC02A2 corrected gate**：targeted 16 tests、shared全9 filesと181 tests、typecheck、通常lint 0件、format、build、root/artifact negative inspectionが成功した。type-aware lintは既存`rlse.config.ts`のwarning 1件だけであり、SC02A2のwarningとerrorは0件である。SPEC 188行、test 319行、model 45行、facade 8行で、独立したsubject/path contractだけをreview対象とする。
- **SC02A3 red evidence**：SPECとtype fixtureだけを先に追加した時点で、focused testは`./factModel`不在、shared typecheckはfact model export不在によって失敗した。
- **SC02A3 implementation gate**：16 fact kind、6 transfer binding、全variantのexact keyとproperty type、removed behavioral field、RegistryId kind分離、facade AST、memory emit、root非公開を直接検証した。focused 25 tests、shared全12 filesと199 tests、typecheck、通常lint 0件、format、buildが成功した。type-aware lintは変更外の`rlse.config.ts`に既存warning 1件だけを報告した。
- **SC02A3 fixed review**：5 implementation fileと4 direct dependencyをmanifest `28d42170645574170c92cb8f78d13b76df83b8fb623c255d32d81ca55fb904eb`へ固定し、contract correctness、SPEC/test/artifact、最終目標とowner境界の三役へ並列reviewを開始した。
- **SC02A3 R1 blocker**：最終目標とowner境界のreviewerは、root非公開fixtureのcommentがshared root publicationをSC02A13へ誤帰属している一点だけをblockerとした。検査自体は正しく、16 fact、6 transfer binding、attribute-only境界、client/runtime非追加にはblockerがなかった。
- **SC02A3 R2**：5 commentをAS01 ownerへ修正し、SPECにもAS01 ownershipを明記した。R1の残る二reviewを`REVIEW INVALID`として停止し、新manifest `0c217050f7cdaf7381d7ebdffd48e31ffdb35252f6b25a49e8d483b775756c1b`を三役へ並列に渡した。
- **SC02A3 R2 review**：contract correctnessと最終目標/owner境界の二者は`ACCEPT`した。SPEC/test/artifact reviewerは、facadeへdirect type exportまたはruntime statementを追加しても既存fixtureが通るfalse-negative一件だけをblockerとした。
- **SC02A3 R3 correction**：facade sourceをexactly 4 `ExportDeclaration`へ固定し、memory emitを既存identity value re-export一行へ完全一致させた。focused 25 tests、typecheck、formatが成功し、新しい一人へ限定収束確認を依頼した。
- **SC02A3 completion**：収束reviewerはdirect type exportとruntime statementのsynthetic probeが拒否されることを確認して`ACCEPT`した。5 production fileを`43350db7088fa46e6e90f5db9a528b481f624da1`としてpushし、localとtracking branchの一致を確認した。
- **SC02A4 implementation gate**：8 relation kind、全endpoint、`FactEndpoint<Kind>`、`orders-before`だけが持つrequiredな`ordinal: number | null`、他variantのordinal key不在、facade AST、type-only emitを直接検証した。focused 31 tests、shared全14 filesと217 tests、typecheck、lint、format、buildがimmutable snapshotで成功した。
- **SC02A4 R1 review**：correctness reviewerは`ACCEPT`した。SPEC reviewerは`feature_spec`の非正準引数、goal/boundary reviewerはSC02A2/SC02A3節に残るrelation API不在制約をblockerとした。R1固定snapshotはdisjointなAR01 correction前の216 testsであり、current worktreeの217 testsという初期manifest記録を訂正した。
- **SC02A4 R2 convergence**：R1から`SPEC.typ`だけを修正し、stale不在制約を除去して4個の`feature_spec`を`summary`と`test_cases`へ統一した。Newtonはmanifest、10固定blob、依存、decision anchor、31 focused/217 shared test evidenceを再照合し、blocker解消と新規correctness blocker不在を確認して`ACCEPT`した。
- **SC02A4 completion**：review済み9 blobをcurrent HEADへ重ねたintegration tree `bc94eac0fc3ff771628ad0c1cef157ecf1761d39`とstaging/commit treeを一致させ、`fcfe5ee68c0cc049cf762c4578e8dc5600d1eb92`としてpushした。localとtracking branchは同じexact OIDを指す。
- **SC02A5 red evidence**：SPECと先行fixtureを追加した時点でfocused testは`./exportModel`不在、typecheckは`ExportExecutionContract`とmodule export不在によって失敗した。
- **SC02A5 implementation**：5 required readonly field、4 callable literal、`FactId` sequence、brand/value-domain `RegistryId`、既存`TransferBinding`だけを持つtype-only export summaryを追加した。parser、validator、closure、source envelope、runtime value、root exportは追加していない。
- **SC02A5 cumulative fixture correction**：SC02A3とSC02A4のfacade inventory testが5 statementを固定していたため、両testへ`exportModel`の6番目のtype-only exportだけを追加した。factとrelationのmodelまたは契約は変更していない。
- **SC02A5 gate**：focused 4 filesと38 tests、shared全16 filesと227 tests、typecheck、通常lint 0件、format、build、root sourceとgenerated declaration非公開、runtime-empty emit、diff checkが成功した。10-file write setはadmission gate未満である。
- **SC02A5 fixed review**：proposal、10 write-set blob、9 direct dependency、3 decision anchorをsynthetic commit `f75ca1c5cd02b8a8d7e588f2998028051253891d`へ固定し、correctness、SPEC/artifact、最終目標/granularityの三役へ並列reviewを開始した。
- **SC02A5 R1 disposition**：correctnessと最終目標の二役は`ACCEPT`した。SPEC/artifact reviewerの`behavior_spec`正準引数とsource-level API owner表記のblockerを採用し、generated declaration positive control、`SPEC/functions.typ` dependency、fixed/integrated test証拠の区別もR2へ反映した。
- **SC02A5 R2 convergence**：fixed synthetic commit `77f36d25053f3ff10e969981c212ec97e5f0341a`でfocused 38 tests、shared 15 filesと224 tests、typecheck、lint、format、build、declaration positive/negative inspectionが成功した。fresh reviewerは`ACCEPT`し、manifestの削除数だけ22ではなく24というerratumをintegration recordへ残した。
- **SC02A5 completion**：10-file staged treeがsynthetic tree `70eb1245e38d5962078621dca7f288f61dfde884`と一致することを確認し、commit `dc456b8fa31dd6d03a7caeaf385e9ad053e493b3`をpushした。localとtracking branchはexact OIDで一致する。
- **SC02A6 fixed gate**：10 registry kindをexact readonly collectionへ対応付ける7-file revisionをsynthetic commit `13ea5d0e4746c619f52c0c38949ba74dce1929ba`へ固定した。focused 6 filesと44 tests、shared 19 filesと271 tests、typecheck、lint 0件、format、buildがisolated snapshotで成功した。
- **SC02A6 review/completion**：low-tier primary reviewerはexact mapping、SC01/SC02A7+/AS01 owner、正準SPEC、non-vacuous type fixture、runtime-empty emit、root非公開にblocker 0件で`ACCEPT`した。進捗表の現行分割同期だけをfollow-upとして採用し、commit `ea129bb434789a2ec55386a89ebae2dc74345390`をpushした。
- **SC02A7 admission/gate**：A1からA6を束ねる8-field untrusted type-only envelopeだけへ限定した。実装差分は749 additions、10 deletions、最大377 additionsで停止条件未満である。synthetic commit `edd059f4d01f28c9671c517f146facf97ed29e63`でfocused 50 tests、shared 398 tests、typecheck、lint、format、buildが成功した。
- **SC02A7 review/completion**：low-tier primary reviewerはexact readonly shape、無brand alias、invalid claimの表現可能性、runtime-empty/package-local/root非公開、placement authority非追加を確認し、blocker/follow-up 0件で`ACCEPT`した。commit `1c393b3d120859d63a9da8e7045e40a1b0774f97`をpushし、remote OID一致を確認した。
- **SC02A8 admission split**：旧A8はbudget、descriptor capture、active ancestor、occurrence walker、source profile、clone、freeze、canonical builder、meterという別々にgreenへできる契約を含むため、そのままでは`SPLIT`とした。boundary unitはA8AからA8G、canonical unitはID01-CB、A8I、A13へ分け、同じproduction revisionへ戻さない。
- **SC02A8 boundary review**：R1三役のdepth cumulative、realm provenance、occurrence reflection、source precharge blockerを採用した。R2はpeak depth、observable prototype、distinct-identity reflection、two-stage profile、alias-expanding clone、A12 final freezeへ修正し、fresh convergence reviewerが`ACCEPT`した。
- **SC02A8 boundary follow-up**：A8Bはprecharge前の追加key metadata copyを作らず、不可避allocationを`Reflect.ownKeys()` resultへ限定する。A12 integration fixtureはfinal snapshot cardinality/depthとA8G validation-stepのexact/-1を検査する。
- **SC02A8 canonical review**：R1のcommon-prefix sort、downstream native sort/recursion、negative zero、byte oracle blockerをR2で修正した。R2 convergenceでactive-path scratch、host/GC resident表現数、shared alias fixtureの三blockerを採用し、R3はproperty cap定数倍、host storage `O(maximumCanonicalBytes)`、occurrence alias測定へ訂正した。targeted reviewerは`ACCEPT`した。
- **SC02A8 canonical follow-up**：ID01-CB/A8I fixtureは多階層active-path scratch peak、sibling record/array aliasのexact二重課金、2冪境界、最大長common-prefixを維持する。A8I admissionでmeter/downstream二重予約後のdefault work capをbenchmarkまたはprobeする。
- **ID01-CB completion**：R1 reviewでpath配列の反復copyによる二次計算量、array sparse pre-scanによるerror precedence変更、array descriptorのscratch計測漏れをblockerとして採用した。R2でparent-linked path cursor、失敗時だけのiterative path materialization、indexごとのsparse検査、array descriptor accounting、12,000-depth fixtureへ修正した。R2収束時に既存Accepted ADRの直接変更を検出したため、R3でR1 ADRをbyte-identicalに復元し、継承する新ADRを追加した。focused 66、shared 440、canonicalIdentity coverage 97.02/94.47/100/96.95、typecheck、lint、format、buildが成功し、commit `e42fec40210aeead036209f209e9038632421f5b`をpush済みである。
- **SC02A8A completion**：15-field budget、narrow-only override、operation-local ledger、cumulative/peak exact/-1、failure rollbackを実装した。R1三役は全員`ACCEPT`し、implementation reviewerのBigInt success-path costというfollow-upを採用した。R2で`amount > limit - current`により成功時をnumber演算だけにし、失敗後だけBigIntでexact attempted valueを生成した。combined gateで26 files、479 tests、`budget.ts` coverage 100%、typecheck、lint、format、buildが成功し、commit `02bdfe4a662de7f0799f3211a9464303f2a2cbbc`をpush済みである。
- **SC02A8B implementation admission**：hostile objectのdistinct-identity header/view captureだけを所有し、budget charge、walker、cycle、profile、clone、freeze、parser、meterを後続へ残す。`executionContract`内のSPEC、cumulative test、new focused module/test/type fixtureだけを専有し、facade/rootは変更しない。hostile reflection boundaryのため`high` tier、三役reviewとする。
- **SC02A8B completion**：R1はoriginal ownKeys、two-phase header/view、identity一回reflection、getter-free frozen view、stable pathを実装し、focused 48、shared 510と全gateを通過した。implementation/boundary reviewerの成功descriptorごとのpath copyとmutable iterator/`push`/inherited setter依存をblockerとして採用した。R2はindex traversal、own data-property definition、failure-only path materialization、reentrant first-failure保持へ修正し、focused 51、shared 519と全gate後にconvergence `ACCEPT`を得た。commit前の再計算で1,534 additionsの停止条件超過を検出したため、R3でerror fixture setupだけをhelper化し、test caseを保ったまま1,482 additionsへ戻した。admission reviewerはblocker/follow-up 0件で`ACCEPT`し、commit `7dc62e79832f28d9a196e6993c7a1d3429b5b5be`をpushしてremote OID一致を確認した。
- **SC02A8C completion**：active identityだけをcycleとして拒否する`WeakSet`とparent-linked LIFO trackerを実装し、leave後alias、fresh operation isolation、12,000 depth、success-path path非保持を固定した。R1 implementation/boundary reviewerは`ACCEPT`し、primary reviewerの「invalid leaveがactive setだけを破壊するmutationを検出できない」blockerを採用した。R2は各invalid leave後にstill-active identityの再enterがcycleのままであるassertionを追加し、production/SPEC/type blobを変更しなかった。fresh convergence reviewerはblocker/follow-up 0件で`ACCEPT`した。isolated focused 27、serialized shared 529、coverage、typecheck、lint、scoped type-aware lint、format、buildが成功し、commit `c37a81e8d932d712c6118d6865b6b29f94d59492`をpushしてremote OID一致を確認した。default parallel full suiteの初回二回は変更外のbuild-spawning testが5秒timeoutしたため、同じfixed revisionを`--maxWorkers=1`で完走させた。
- **follow-up**：AO01 では10 registry collectionの空配列を省略できる author helperを検討する。SC02A の strict output schema は固定collectionを維持する。
- **baseline**：shared全8 files、165 tests、typecheck、通常lint 0件、format、buildが成功した。type-aware lintは既存`rlse.config.ts`のwarning 1件だけを報告した。

#### SC02A relation and subject table

string比較はUnicode normalizationを行わないraw UTF-16 code-unit順とし、enumはこの表とtype unionに記載した固定rankを使う。

| relation | from fact/subject | to fact/subject | 追加制約 |
| --- | --- | --- | --- |
| `reads` | effectまたはinvocation / activeまたはcallable subject | read / module-evaluationまたはvalue subject | N/A |
| `writes` | effectまたはinvocation / activeまたはcallable subject | write / module-evaluationまたはvalue subject | N/A |
| `invokes` | effectまたはinvocation / activeまたはcallable subject | invocation / callable subject | N/A |
| `returns` | invocation / callable subject | any fact / return subject | exportNameを一致させる |
| `owns` | ownership / any subject | identity、ownership、lifetime / any subject | lifetime targetだけをsource ownershipとexact subject一致させる |
| `orders-before` | ordering / any subject | any fact / any subject | sourceとtargetを異なるIDにし、variantに応じたordinalを持つ |
| `transfers-as` | transfer以外のfact / value subject | transfer / 同じsubject | sourceとtargetを異なるIDにし、subjectをexact equalityで一致させる |
| `fails-with` | effectまたはinvocation / activeまたはcallable subject | failure / 同じsubject | subjectをexact equalityで一致させる |

active subject は module-evaluation、export-value、receiver、callback-invocation、allocated-resource とする。
callable subject は export-value、receiver、parameter、return、callback-invocation、allocated-resource とする。
value subject は export-value、receiver、parameter、return、allocated-resource とする。
SC02A はこの pure table と subject shapeを検証し、SC03 は実module signatureとの一致を検証する。
`orders-before` variantだけがrequiredな`ordinal: number | null`を持ち、ほかのrelation variantはordinal fieldを受理しない。
すべてのrelationはsourceとtargetに異なるFactIdを要求する。
一つのownership factは同じsubjectのlifetime targetをexactly 1件、identityまたは別ownershipのowner targetを0件または1件持ち、それ以外の`owns` relationを持てない。
ownershipからownershipへのowner relationはDAGとし、owner cycleを拒否する。
`before`と`serial`のordering factは、targetが重複しない`orders-before` relationを1件以上持ち、ordinalを0から件数未満までgap-freeに使う。
`exclusive`と`commutative`のordering factは、targetが重複しない`orders-before` relationを1件以上持ち、ordinalをすべてnullにする。

#### SC02A exact fact reference table

| owner field | 許可fact kind | nullable | cardinality/semantic |
| --- | --- | --- | --- |
| `read.environmentFactId` | environment | no | exactly 1 |
| `read.exposureFactId` | exposure | no | exactly 1 |
| `write.environmentFactId` | environment | no | exactly 1 |
| `write.exposureFactId` | exposure | no | exactly 1 |
| relation `from` / `to` | relation and subject table | no | endpointごとにexactly 1 |
| export `factIds` | any semantic fact | no | raw UTF-16順のset。subjectをexport closureへ一致させる |
| `hostAssumptionFactIds` | any semantic fact | no | raw UTF-16順の未信頼set |

ownershipとorderingのmember referenceはnested fieldに保持せず、`owns`と`orders-before` relationだけに保持する。

#### SC02A canonical collection table

| collection | semantic | creator | strict parser |
| --- | --- | --- | --- |
| SemanticPath | sequence | 入力順と反復を保持 | 同じsequenceを受理 |
| fact、host assumption、export fact、registry reference set | set | raw UTF-16 ID順へsort | strictly sortedを要求 |
| callback parameter index | set | number昇順へsort | strictly sortedを要求 |
| environment | fixed-order set | build、server-request、browserの順へsort | fixed rank順を要求 |
| relation | set | relation kind、from kind、from ID、ordinal null-first、to kind、to IDの固定tuple順へsort | tupleのstrict orderを要求 |
| registry entry | kind-local set | RegistryId順へsort | strictly sortedを要求 |
| registry implementation | role set | browser、server-request、roleの固定rank順へsort | strictly sortedを要求 |
| export record property | unordered map | property setを保持 | insertion orderを要求しない。JCS key orderをidentityに使う |

#### SC02A parent decomposition and complexity gate

SC02Aはuntrustedな可変長input parserとmany-to-many local referenceを扱うためhigh-cost sliceに該当する。

| 責務 | internal module | owner | dependency |
| --- | --- | --- | --- |
| type、taxonomy、subject/relation table、error | `model.ts` | SC02A schema | SC01/ID01 typeのみ |
| hard cap、schema-aware descriptor preflight、ledger | `budget.ts` | public operation | `model.ts` |
| closed snapshot、scalar、set、JCS byte measurement、freeze | `canonical.ts` | canonical boundary | `budget.ts`、`model.ts` |
| subject、fact、relation、transfer、export parse | `semantic.ts` | semantic schema | `canonical.ts`、`model.ts` |
| registry source、source assembly、local closure、digest | `source.ts` | ExecutionContractSource | `semantic.ts`、SC01 public API |
| package-local orchestration | `implementation.ts` | public facade | 上記全module |

| phaseまたはrelation | owner | input最大cardinality | index | worst-case | output上限 | counterと課金時点 |
| --- | --- | --- | --- | --- | --- | --- |
| descriptor preflight/snapshot | canonical boundary | data node `200,000`、property `1,000,000` | active ancestor、alias map | `O(N)` | data node cap以下 | `maximumInputDepth`、`maximumInputDataNodes`、`maximumInputProperties`、`maximumInputArrayLength`、`maximumInputStringCodeUnits`をdescriptor/container読取前 |
| fact/registry index | source closure | fact `200,000`、registry `200,000` | FactId map、kind/RegistryId map | `O(F + G)` | `F + G` | `maximumFacts`、`maximumRegistryEntries`をclone前、`maximumValidationSteps`をmap insertion前 |
| nested fact/export/host reference | source closure | reference `10,000,000` | FactId map | `O(F + Rf)` | input fact数以下 | `maximumReferences`をclone前に一度、`maximumValidationSteps`をlookup前にprobeごと |
| relation endpoint/subject | semantic schema | relation `200,000`、endpoint `400,000` | FactId map、closed subject table | `O(F + R)` | relation cap以下 | `maximumRelations`とendpoint分の`maximumReferences`をclone前、`maximumValidationSteps`をlookup/subject判定前 |
| ownership DAG | source closure | ownership factとowner relationを各`200,000`以下 | ownership FactIdからoptional owner | `O(F + R)` | base relation以外の出力なし | `maximumValidationSteps`をadjacency insertionとiterative DFS edge probe前 |
| registry reference/version | source closure | reference `10,000,000` | kind/RegistryId map | `O(G + Rg)` | registry cap以下 | `maximumReferences`をclone前に一度、`maximumValidationSteps`をlookup/version比較前 |
| registry implementation | registry source | implementation `400,000` | kind/environment/role key | `O(I log I)` | implementation cap以下 | `maximumRegistryImplementations`をclone前、`maximumCanonicalWorkSteps`をsort前、`maximumValidationSteps`をtuple判定前 |
| normalization | semantic/source creator | 各collection hard cap以下 | fixed comparator | `O(N log N)` | input record数以下 | `maximumCanonicalWorkSteps`のworst-case upper boundをsort前、`maximumValidationSteps`をduplicate判定前 |
| local closure | source closure | `F + G + Rf + Rg` | 上記二map | `O(F + G + Rf + Rg)` | 一つのsource snapshot | `maximumValidationSteps`を各probe前 |
| canonical measurement/JCS | canonical boundary | normalized data node cap以下 | iterative frame | `O(N + P log P)` | canonical byte `200,000,000` | `maximumCanonicalBytes`と`maximumCanonicalWorkSteps`をfull text生成前 |
| deep freeze | canonical boundary | output data node cap以下 | visited set、iterative stack | `O(N)` | 同じsnapshot | `maximumValidationSteps`をstack push前 |
| SHA-256 digest | source identity | canonical byte cap以下 | N/A | `O(B)` | 43文字digest一件 | `maximumCanonicalBytes`検査後にcanonicalizeJsonを一回だけ呼び、そのbytesをsha256Digestへ渡す |

#### SC02A budget proposal

`ExecutionContractBudget` は次のfieldを持ち、default値をframework hard capとする。

| field | default hard cap |
| --- | ---: |
| `maximumInputDepth` | 64 |
| `maximumInputDataNodes` | 200,000 |
| `maximumInputProperties` | 1,000,000 |
| `maximumInputArrayLength` | 200,000 |
| `maximumInputStringCodeUnits` | 20,000,000 |
| `maximumFacts` | 200,000 |
| `maximumRelations` | 200,000 |
| `maximumExports` | 200,000 |
| `maximumRegistryEntries` | 200,000 |
| `maximumRegistryImplementations` | 400,000 |
| `maximumReferences` | 10,000,000 |
| `maximumSemanticPathSegments` | 2,000,000 |
| `maximumCanonicalBytes` | 200,000,000 |
| `maximumCanonicalWorkSteps` | 20,000,000 |
| `maximumValidationSteps` | 20,000,000 |

schema-aware preflightはnested reference、SemanticPath、registry implementationをclosed snapshotより前にdescriptorだけで数える。
exact canonical byte lengthはallocation-freeに測定し、canonical workはobject property sortのworst-case upper boundを先に課金する。
上限内と確認した後だけ`canonicalizeJson()`を一回呼び、返されたexact bytesを`sha256Digest()`へ渡す。

#### SC02A failure and test contract

`ExecutionContractError` は immutable な `(string | number)[]` path と、`invalid-closed-record`、`invalid-field`、`invalid-fact-id`、`invalid-registry-id`、`noncanonical-order`、`duplicate-record`、`dangling-reference`、`kind-mismatch`、`version-mismatch`、`semantic-mismatch`、`budget-exceeded`、`crypto-unavailable` のstable codeを持つ。
SC01/ID01 failureは元のpathへ現在のfield prefixを付けてこのerrorへ変換し、別error classをpublic operationから漏らさない。

先行testは次を独立fixtureで検証する。

- 16 fact kind、8 relation kind、7 subject kind、3 path segment kindの全variant
- fact kind、relation endpoint、subject pair、nested reference kindの正準表と全swap rejection
- 10 registry kind、25 legal role tuple、295 illegal tuple、transfer version mismatch
- cross-fact relationの唯一性とexport callable/receiver/transfer exact closure
- creator permutationの同一snapshot/digestとstrict parserのnoncanonical rejection
- repeated SemanticPath、shared alias、direct/indirect cycle、getter/hidden/symbol/custom prototype/sparse array
- 全budget counterのzero、exact boundary、boundary-minus-oneとnested collectionのpre-clone failure
- deep inputのtyped failure、iterative freeze、caller mutation不変性
- `@dathra/shared` root exportとqualified/accepted APIの不在

### AR01-FT artifact finalization template

- **contract**：`ArtifactFinalizationTemplate`を10個のrequired readonly propertyからなるpackage-local type-only closed productとして追加した。binding、aggregate、validator、identity operation、URL、integrity、closure、runtime value、shared root exportは追加していない。
- **initial implementation gate**：focused 5 tests、shared 12 filesと200 tests、typecheck、lint、format、build、source rootと生成declarationのnegative inspectionが成功した。
- **R2 initial review**：correctnessと最終目標の二reviewerは`ACCEPT`した。SPEC/artifact reviewerは、package build entryだけをinternal facadeへ変更すると生成declarationから型が公開されてもfocused testがgreenになるfixture holeをblockerとした。
- **R3 correction**：SPECへ実build declaration検査を追加し、temporary outputへshared packageをbuildして`index.d.mts`と`index.d.cts`のexport surfaceから`ArtifactAddressId`と`ArtifactFinalizationTemplate`を拒否するtestを追加した。build entry mutationでは新testがexit 1となることを確認した。
- **R3 convergence**：Hubbleはtemporary outputのsuccess、build failure、assertion failureでのcleanup、両declaration entry、mutation resistanceを確認し、`ACCEPT`した。named export抽出のpositive controlは将来強化できるfollow-upであり、current blockerではない。
- **final gate**：immutable R3 snapshotでfocused 6 tests、shared 12 filesと201 tests、typecheck、lint、format、buildが成功した。current integrated shared stateでも14 filesと217 testsが成功した。
- **commitとpush**：type schemaを`9cff8edc119813fdef64980a247eb920de2e0ff2`、declaration boundary correctionを`8d164cdb0234c58a3957dd7d740cd1c4ed7117fb`としてpushし、localとtracking branchの一致を確認した。

### AR01-EB artifact entry binding

- **contract**：`ArtifactEntryRole`の3 literalと、role、semantic ID、exported name、invocation ordinalを持つ`ArtifactEntryBinding`だけをpackage-local type-only schemaとして追加した。ordinal legality、semantic/export existence、canonical order、aggregate、validator、identity、runtime valueは後続へ残した。
- **fixed gate**：focused 2 filesと9 tests、shared 14 filesと214 tests、typecheck、lint、format、build、runtime-empty emit、root/generated declaration非公開がsynthetic commit `8395f3e5dca2f2d348cc8ffdcff36adce7b70331`で成功した。
- **parallel review**：correctness、最終目標/boundary、SPEC/artifactの三役は、exact two-type schema、既存ID/template不変、正準SPEC、cumulative facade、future API不在を確認し、全員`ACCEPT`、blocker/follow-up 0件と判定した。
- **completion**：disjointなSC02A5とRC01-DI2AのHEAD前進後も固定8 blobを維持し、current parentへ重ねたstaged tree `85fd580d21abbbaf3dc4c404730f22b3db4e7ae3`を確認した。commit `106acaea86dabecfb4ce256373279a4fd4801b30`をpushし、localとtracking branchのexact OIDが一致する。

### AR01-DB artifact dependency binding

- **contract/admission**：`slot`、inlineな4 kind、nominal `targetArtifactAddressId`、nullable `targetExportName`を持つrequired readonlyなpackage-local typeだけを所有する。validation、target existence、order、duplicate、aggregate、identity、URL、integrity、trust、root publicationは後続へ残す。永続artifact identity inputを固定するため`high` tierとした。
- **main fixture correction**：review固定前にmodel内のprivate `ArtifactDependencyKind` aliasを見逃す穴を発見し、modelのexact exportとdirect negative importを追加した。初期snapshotではfocused 12 tests、shared 269 tests、typecheck、lint、format、buildが成功した。
- **R1 initial review**：implementationとboundary reviewerは`ACCEPT`した。primary reviewerは、finalization/entry feature specに残る歴史的2/4-type facade期待とdependency-binding不在、およびprivate kind aliasがgreenになるAST fixture holeをblockerとした。両方を採用した。
- **R2 correction/gate**：旧feature/test obligationを現行4-model/5-type累積facadeへ同期し、model ASTで一つのinterface、4 property、direct 4-literal union、type alias不在を固定した。isolated snapshotでfocused 13 tests、typecheck、lint、formatが成功し、private alias mutationはfocused testをexit 1にした。full shared test/buildは変更外R1 attestationを継承し、fresh delta reviewerの収束確認中である。
- **follow-up**：後続validatorで`targetExportName: null`のsort位置とstring comparisonを固定する。identity operationはextra own propertyを拒否したclosed snapshotだけから`ArtifactAddressId`を発行する。
- **R2 convergence/completion**：fresh reviewerはstale cumulative SPECとprivate inline-alias blockerの解消、新規correctness blocker不在を確認して`ACCEPT`した。8 staged blobをR2 manifestと一致させ、commit `31a6da6154d75a58cc09b0946bb2fae6c265a22b`をpushし、localとtracking branchのexact OID一致を確認した。

### AR01 identity preimage admission

- **AR01-XB contract**：`exportName`、`memberSemanticId`、inlineな6-role unionを持つrequired readonlyな`ArtifactExportBinding`だけを所有する。export table、aggregate、validator、identity、URL、integrity、trust、root publication、runtime behaviorは後続へ残す。persistent artifact identity inputを固定するため`high` tierとする。
- **AR01-XB fixed gate**：8-file revisionをsynthetic commit `2abd9d8d5966b69a130df413a8850f01ec7c5a2a`へ固定した。focused 18 tests、shared 414 tests、typecheck、lint、format、build、runtime-empty emit、root/generated declaration非公開が成功した。593 additions、22 deletions、最大214 additionsで停止条件未満である。
- **AR01-XB review/completion**：primary、implementation、boundaryの三役はcanonical 3-field/6-role schema、inline union、non-vacuous fixture、runtime-empty/root非公開、trust/placement非証明を確認し、全員`ACCEPT`、blocker 0件とした。8 staged blobをmanifestへ一致させ、commit `44a1b0f1dbd5c0f4e053040d1df08359ba319b93`をpushし、remote OID一致を確認した。
- **AR01-XB follow-up**：後続文書ではAR01のintegrity schemaとAF01のfinal artifact bytes/integrity table生成を区別して記述する。現行binding contractのblockerではない。
- **AR01-DP/P admission split**：`DeploymentIdentityPreimage`と`ArtifactAddressPreimage`は別々の永続identity schemaであり、後続operationなしにexact type/JCS fixtureで単独greenへできるため、同一revisionへ束ねない。AR01-DPを先行し、そのreview/commit後にAR01-Pを逐次実装する。
- **AR01-DP completion**：`schema: "dathra.deployment-identity/1"`、`applicationNamespaceDigest`、`releaseIdentity`、`targetEnvironmentId`、`canonicalPublicOrigin`、`contractNamespaceGraphDigest`、`hostProfileSetDigest`の7 required readonly fieldを持つtype-only aggregateを追加した。digestはgeneric `Sha256Digest`を再利用し、別ID/aliasを追加していない。R1三役は全員`ACCEPT`し、ID01-CB後のcurrent-base integrationでも8 write-set blobの同一性とfocused 23、shared 445、typecheck、lint、format、buildを再確認した。commit `f56864d544217188e1fd4372d7f180cda435b991`をpush済みである。
- **AR01-P exact pending contract**：正準名は`ArtifactAddressPreimage`とし、`ArtifactAddressPreimageSource`を追加しない。`kind`は`"javascript" | "wasm" | "data"`のinline unionとし、`ArtifactKind` aliasを追加しない。ID01、DP、既存FT/EB/DB/XBへ依存する10-field aggregateだけを所有する。
- **AR01-P implementation admission**：canonical schema順の10 required readonly fieldだけを追加し、collectionのsemantic invariant、snapshot、validation、identity operation、URL、integrity、closureを後続へ残す。`artifactContract`内のSPEC、cumulative facade/test/consumer、new focused model/test/type fixtureだけを専有する。persistent identity inputのため`high` tier、三役reviewとする。
- **AR01-P completion**：R1はexact 10-field、direct inline kind union、invalid-state representability、runtime-empty/root非公開を満たし、isolated focused 29、shared 485、typecheck、lint、scoped type-aware lint、format、buildが成功した。primary/boundary reviewerがpackage `AGENTS.md`のstale owner/7-type記述を同一blockerとして報告したため採用し、implementation reviewerのnon-never witness follow-upもR2へ取り込んだ。R2 convergenceはblocker/follow-up 0件で`ACCEPT`し、commit `c53a50e94b474213511ad73fb106e4681a5de6f9`をpushしてremote OID一致を確認した。
- **AR01-PS scheduler correction**：AR01-P completionだけではproduction-readyにならない。accepted AR01-P designはPS以降をexact hard limit、canonical rule、error vocabularyの先行design review完了まで開始しないと明記しているため、PSを`pending`へ戻した。resource/error foundationを独立してgreenにできる場合はPSへ束ねず別revisionへ分ける。
- **AR01 resource/error decomposition**：先行調査はAR01-DS/PSの前にerror、budget/ledger、snapshot課金順を固定し、DD/PI前にbounded canonical meterを置く必要を確認した。独立してgreenにできるerrorとbudgetを同じrevisionへ束ねず、`AR01-E -> AR01-B -> {AR01-DS, AR01-PS}`へ分ける。generic shared snapshot utilityは追加せず、artifact-local descriptor kernelの共有可否をDS/PSで判断する。
- **AR01-E design admission**：exact ten-code union、immutable root-relative path、package-local error classとinternal `fail`、downstream code ownerだけを決める。budget counter/hard cap、snapshot、validator、precedence、canonical meter、identity、URL、closure、publicationは含めない。一つのpackage-local runtime contractでidentity/trust/public rootを変更しないため`medium` tier、primary/implementation二役reviewとする。
- **AR01-E design completion**：primary/implementation reviewerはexact taxonomy、AF01/SL01/RR01とのfailure owner境界、immutable error/path、facade/root非公開、error/budget/snapshot分割、独立実装可能性を確認し、blocker/follow-up 0件で`ACCEPT`した。canonical integration R1 reviewerのconstructor signature欠落と`invalid-field`からclosed snapshot境界が落ちた二blockerを採用し、R2でaccepted proposalのexact surfaceへ復元した。fresh convergence reviewerはblocker/follow-up 0件で`ACCEPT`した。AR01-Bのcounter/cap/課金順は未決定のまま別revisionに残した。
- **AR01-DP design convergence**：R1で欠けていたDS structural snapshot、DV semantic validator、DD canonical digest、AF01/RR01 binding ownerをR2へ追加した。convergenceでAF01をselected candidateへ依存させた逆順をblockerとして採用し、R3で`CN01-L -> MP02 -> AF01 per candidate -> SL01 -> RR01`へ訂正した。targeted reviewerはblocker/follow-up 0件で`ACCEPT`した。
- **AR01-P design convergence**：runtime JCS fixtureをtype-only PからPIへ移し、legitimate leaf address発行後にbranded dependency corpusを作る。PS/PV/PI/PC/URL/IT、AR01 schema、AF01 production、CN01-L legality、SL01 selection、RR01 conformanceを分離した。R2 convergenceでRR01がgeneric AF01 evidenceを受ける抜け道をblockerとして採用し、R3でSL01-selected AF01 evidenceだけへ限定した。targeted reviewerはblocker/follow-up 0件で`ACCEPT`した。
- **AR01 historical vocabulary**：旧`AR01-P-DECOMP-R2` blobをimmutable dependencyとして固定し、`ArtifactAddressPreimageSource`と`ArtifactKind`をhistorical vocabularyに限定した。現行typeは`ArtifactAddressPreimage`とdirect inline kindだけを使う。
- **AR01 admission estimate**：DPは合計700 additions、最大test 300 additions、Pは合計900 additions、最大test 350 additions以下を見込む。合計1,500または一file 1,000の停止条件へ達した場合は実装を止め、fixture責務を別revisionへ分ける。

| revision | 契約 | 状態 | 次のdependency |
| --- | --- | --- | --- |
| AR01-E | exact package-local error vocabulary | implementing | accepted design R1とcanonical integration R2 |
| AR01-B | hard budget/operation-local ledger | pending | AR01-Eとexact counter/cap design |
| AR01-DP | exact 7-field deployment preimage type | completed | ID01 |
| AR01-DS | hostile closed descriptor snapshot | pending | DPは完了、AR01-E/B未完了 |
| AR01-DV | deployment semantic canonical validation | pending | DSとorigin/string rule design |
| AR01-DD | validated deployment preimage digest | pending | DV |
| AR01-P | exact 10-field artifact address preimage type | completed | DP、FT、EB、DB、XB、ID01 |
| AR01-PS | hostile closed structural snapshot | pending | Pは完了、AR01-E/B未完了 |
| AR01-PV | URL/order/duplicate/ordinal/kind-template validation | pending | PSとcanonical rule design |
| AR01-PI | ArtifactAddressId identity operation | pending | PV |
| AR01-PC | target/export/dependency graph closure | pending | PIとartifact graph |
| AR01-URL | canonical artifact URL contract | pending | PI |
| AR01-IT | integrity table schema/validator | pending | PI |

### RC01-DI implementation decomposition

R2とR3はRenderDefinition model、closed snapshot、content identity operationを一つのimplementation revisionとしていた。

三契約は依存順に単独greenへできるため、同じrevisionではreviewしない。

| Slice | 契約 | 専有module | 先行test | 単独greenの根拠 | 状態 |
| --- | --- | --- | --- | --- | --- |
| RC01-DI1 | versioned schema、nominal ID、reference claim type、domain error | `model.ts`、`error.ts`、`implementation.ts` | exact type、brand separation、claim非互換、error immutability、後続API不在 | parserとdigestなしで型とfailure vocabularyを直接検証できる | completed |
| RC01-DI2A | record key hard limit、descriptor preflight、identity cache、sanitized occurrence snapshot | `descriptorSnapshot.ts`、focused testとtype fixture | prototype、key cap、descriptor order、alias、structural rejection、primitive deferral | caller objectを後段へ渡さないdescriptor resource境界として単独greenにできる | completed |
| RC01-DI2B | expected string cap、missing/extra、schema/role/digest、fresh scalar construction | `validatedSnapshot.ts`、focused testとtype fixture | string boundary、全failure code/path、fresh preimage/unbranded wrapper | DI2A snapshotだけを入力にしてcallerを再読せず単独greenにできる | completed |
| RC01-DI3A | creator、content digest、brand発行、fresh root freeze | `operations.ts`、`implementation.ts`、`implementation.test.ts`、`typeContract.fixture.ts` | digest equality、mutation snapshot、crypto変換、root freeze、parser不在 | creatorはparser equalityなしでvalidated preimageからidentityを発行し単独greenにできる | completed |
| RC01-DI3B | verified parser、self-digest equality、mismatch | DI3Aと同じ6-file cumulative write set | parse success、mismatch code/path、crypto変換、identity non-sharing | parserはDI3A creatorをpredecessorにして独立追加できる | completed |

RC01-DI2Aはunknown objectの可変own keyを扱うhigh-cost sliceとする。

resource contractは`.temp/review-proposals/RC01-DI-R5-RESOURCE.md`で収束し、per-record cap、最大6 occurrence、最大96 descriptor、deterministic failure orderを固定した。

各distinct recordのhost own-key列挙はalready-materialized ordinary object APIの不可避なcostとして分離し、返却直後からdescriptor scan、nested traversal、snapshot、digestをhard capで有界化する。

Proxyは入力契約外とし、wire ownerはobject construction前のbyte、depth、key count admissionを別に所有する。

- **RC01-DI2 process incident**：combined DI2はdescriptor boundaryとscalar/schema validationを一revisionへ実装し、手書き1,488行、98 focused testsへ到達した。既存implementation goalは「別々にgreenにできる契約を別sliceにする」「実装後に判明してもreviewへ進まず再編する」と既に要求していたため、これはルール不足ではなくworker dispatch前にmainがadmission gateを適用しなかった運用逸脱である。
- **RC01-DI2 incident containment**：combined revisionはreview、commit、pushしていない。5 blobをGit object databaseと`.temp/review-manifests/RC01-DI2-COMBINED-DRAFT.md`へcheckpointし、worktreeから`closedSnapshot.*`を外してDI2AとDI2Bへ分割した。
- **RC01-DI2A boundary**：DI2Aはprototype、16-key cap、128-key-code-unit cap、descriptor取得、structural rejection、object identity cache、schema-path occurrence projectionだけを所有する。256 expected string cap、missing/extra、literal、digest、fresh constructionはDI2Bへ残す。
- **RC01-DI2A main correction**：nested expected fieldのprimitiveをDI2Aで拒否せず親field stateへ保持するようにし、DI2Bがcallerを再読せず分類できる境界を補った。descriptor消失probeを追加し、内部key型を`Reflect.ownKeys()`の実型`string | symbol`へ限定した。
- **RC01-DI2A fixed gate**：synthetic commit `4c62d3b746ef0bf66faace841c5ebdbae46ac87a`でfocused 48 tests、対象production coverage 100%、shared 16 filesと262 tests、typecheck、通常lint 0件、format、build、root/generated/runtime非公開、diff checkが成功した。type-aware lintは変更外の既存warning 1件だけである。1,239 additions、8 deletions、最大file 694行で、一つのdescriptor occurrence契約として三役review中である。
- **RC01-DI2A review/completion**：correctness/security、SPEC/type/artifact、最終目標/granularityの三役は全員`ACCEPT`、blocker 0件と判定した。staged treeをsynthetic tree `94af8a723770eb8202433c5fad91b606eb59d032`と一致させ、commit `bd1fd198a2281c0f5b3725a265e49d0c2db4e0eb`をpushし、localとtracking branchのexact OID一致を確認した。
- **RC01-DI2B required fixture**：DI2Bはsanitized DI2A snapshotだけを入力とし、caller recordへのreflectionとproperty accessをすべて失敗させてもscalar validationとfresh constructionが完了することを先行testで固定する。
- **RC01-DI2B gate**：focused validated snapshot 116 tests、renderContract 3 filesと164 tests、shared全19 filesと382 tests、typecheck、通常lint 0件、format、buildが成功した。caller recordとreflectionをDI2A snapshot後に利用不能にするfixtureもgreenである。
- **RC01-DI2B risk tier**：package-internal APIだが、attacker-controlled scalar inputを後続identity operationより前に閉じるtrust-boundary validatorであるため`high`とした。primary、implementation、boundaryの三役を使う。
- **RC01-DI2B fixed revision**：5-file write setをsynthetic commit `0cda1c775a4f8778555a4413e927a2023916cafa`へ固定した。manifest SHA-256は`53c772eb41234a28b2ff5562ea7ed7b35efe2edc599f5ae1f79d2a911f2a45c0`、attestationは`RC01-DI2B-R1-ATTESTATION-1`である。
- **RC01-DI2B initial review**：implementationとboundary reviewerは`ACCEPT`した。primary reviewerは、R5のpost-digest freezeとDI2B pre-digest freezeの矛盾、およびparser functionとgenerated/runtime artifactの非公開fixture不足をblockerとした。両方を採用した。
- **RC01-DI2B R2 convergence**：type/root negativeとESM/CJS/declaration artifact検査は解消済みと判定された。freeze splitも正しかったが、R1 Accepted ADRを直接変更した履歴違反一件が新blockerとなった。
- **RC01-DI2B R3 convergence/completion**：R1 Accepted ADRの23行をbyte-identicalに戻し、R5 timingだけをsupersedeする新Accepted ADRへ分離した。targeted reviewerはblocker/follow-up 0件で`ACCEPT`した。isolated R2でrender 165 tests、shared 382 tests、typecheck、lint、format、build、R3でrender 165 testsとformatが成功し、commit `50744910cfb052cf5249a40a3b9d60c5128f3a48`をpushした。
- **RC01-DI3 admission split**：creatorとverified parserは別々にgreenへでき、現行DI3説明は非分割の同一不変条件を示せないため、worker dispatch前にDI3A creatorとDI3B parserへ分割した。両sliceはidentity、private brand authority、untrusted parserまたはartifact inclusion境界を扱う`high` tierとし、各revisionを三役reviewする。DI3A/DI3Bのunion write setはAGENTS、SPEC、`operations.ts`、facade、implementation test、`typeContract.fixture.ts`の6ファイルで、逐次実装する。
- **RC01-DI3A gate/review**：synthetic commit `4a2f90790f532c3e8697873ce61d3e4dcd4777b6`でrender 176 tests、shared 409 tests、operations coverage 100%、typecheck、lint、format、buildが成功した。primary、implementation、boundaryの三役はdigest順序、failure mapping、brand authority、preimage reuse、package/root/browser境界を確認し、全員`ACCEPT`、blocker/follow-up 0件とした。
- **RC01-DI3A completion**：6 staged blobとfixed manifestを一致させ、commit `9a1b9b59bfac9c2eee8c4f38ed8c096006a2e110`をpushした。remote branchのexact OID一致を確認し、DI3Bを実装可能にした。
- **RC01-DI3B gate/review**：initial synthetic commit `d9c3632ceefe04414e38cd7f1c4a34f3edc0e593`でrender 187 tests、shared 425 tests、operations coverage 100%、typecheck、lint、format、buildが成功した。primary、implementation、boundaryの三役は全員`ACCEPT`し、AST authority call-site fixtureとDI3A cumulative wordingをfollow-upとして採用した。
- **RC01-DI3B convergence/completion**：R2 synthetic commit `7706eeb50e738dc13e3998a20535805a31feec50`でfocused 187 tests、typecheck、lint、formatが成功した。fresh reviewerはprivate assertionがcreator/parser各一回でmismatch後にだけ呼ばれることと、DI3A/DI3B wordingを確認してblocker/follow-up 0件で`ACCEPT`した。commit `8a70f80dd722ed936a570b7d7e2683daab871a76`をpushし、remote branchとexact OIDで一致した。

- **RC01-DI1 red evidence**：SPECとtestを先に追加した時点で、focused suiteは`./implementation`不在のmodule resolution errorによって失敗した。
- **RC01-DI1 implementation gate**：private nominal ID、四つのrole-specific claim、preimage、definition、input、六error code、immutable error、package-local facadeを追加した。focused 10 tests、shared全13 filesと209 tests、root全test、shared/root build、typecheck、通常lint 0件、formatが成功した。type-aware lintは変更外の`rlse.config.ts`に既存warning 1件だけを報告した。
- **RC01-DI1 boundary**：hard limit、descriptor preflight、snapshot、validator、creator、parser、digest、brand発行、referent closure、envelope、root exportは追加していない。7 implementation fileと2 direct dependencyをmanifest `220fa34f7081fab0d50bac69ca60fca5b19d75861569d64fb1de8c426ad3c102`へ固定した。
- **RC01-DI1 R1 review**：identity/trust reviewerは`ACCEPT`した。correctness reviewerはprivate brand export modifierとerror field modifier/typeのfixture hole二件だけをblockerとした。残るreviewerは固定file変更前に停止したため、R2で三役の初期reviewを再実行する。
- **RC01-DI1 R2 snapshot**：brand export modifierをAST、error fieldのrequired、readonly、exact typeをtype fixtureで固定した。focused 10 tests、typecheck、lint、formatが成功した。7 fileをsynthetic commit `79d5da77cfbc664d23ca99f4c2f7abc413bc799b`へ保存し、shared worktreeではなくimmutable snapshotを三役へ渡した。
- **RC01-DI1 post-commit audit**：R2固定7 blobがcommit `639bc26cf460f5f5c4965d67f5a3e657f4690cca`と一致することをmanifest `b032cc5fc569ded43797ef2699e89cc7b2a93e82725a3adab627cabc50ed76f0`へ固定した。correctness、SPEC/artifact、最終目標/ownerの三役は、R1 fixture blockerの解消、type-only boundary、root/client非追加、後続DI2/DI3責務の維持を確認し、全員`ACCEPT`、blocker/follow-up 0件と判定した。

## 直前に完了した Slice

### EG03 ExecutionGraph

- **設計要件**：immutable module graph と ObservationContract を基礎に、TemplateNode、symbolic-qualified static vertex、StaticExecutionOccurrenceTemplate、root obligation、typed relation edge を deterministic base graph として表現する。concrete Occurrence は runtime に残す。
- **変更範囲**：`packages/transformer/src/executionGraph/` に四点セットを追加する。source AST 解析は PL02、semantic completeness acceptance と host/authority qualification は SC03 と PL02 に残し、EG03 は canonical graph schema、strict validator、potential-root fixed point、非直列化 index に限定する。
- **canonical identity**：analysis profile、primitive root anchor、symbolic location requirement、static occurrence template、source/generated TemplateNode、generation domain、QualifiedExecutionNode、edge、support、RootObligation、snapshot の非循環 DAG とする。root-bound generated node は anchor と exact contract を参照し、RootObligation ID は参照しない。
- **root derivation**：seed root の explicit entry fact から `may-execute | may-materialize` だけを走査し、`IntraRootFact`、`PotentialRootSupport`、`SeedReachability` を分離する。registration と reactive support は child obligation、trigger constraint、node、edge/path を完全一致させる。unseeded support SCC は fact を生成しない。
- **trust boundary**：bare graph と missing edge は client exclusion の permission ではない。後続の trusted verifier が graph、module、contract、profile、qualified evidence、completeness scope を束縛した exact claim を一意に受理し、branded `AcceptedExecutionAnalysis` を返した場合だけ CN01 が使用できる。
- **独立設計レビュー**：1回目は location trust、runtime binding、generic activation、root-specific fact、derived identity、edge algebra、exact-use、anchor cycle、analysis profile、runtime boundary、PL02 direction を指摘した。2回目は superseding decision、entry fact、contract field binding、generated contract sensitivity、module/location consistency、support coupling、completeness acceptance、index determinism を指摘した。3回目は generation environment、root-bound generated closure、reactive trigger、trusted acceptance を指摘した。全指摘を反映した4回目の Ptolemy レビューは `ACCEPT` である。
- **変更前 baseline**：transformer 全13 files、676 tests、typecheck、lint 0件、format check、build が成功した。worktree は clean で local と upstream は `c369dae91b5093504544b3ba49976f3a6c6ee3c8` に一致した。
- **先行 SPEC/test**：canonical identity、dependency context、root-contract closure、edge algebra、registration/reactive support、fixed point、derived index、hard budget、package-local facade boundary を `packages/transformer/src/executionGraph/SPEC.typ` と `implementation.test.ts` に追加した。
- **red test 証拠**：`pnpm --filter @dathra/transformer exec vitest run src/executionGraph/implementation.test.ts` は `./implementation` 不在で失敗し、SPEC と test が production implementation より先に追加されたことを確認した。
- **実装済み API**：analysis profile、root anchor、location requirement、static occurrence template、source/generated TemplateNode、generation domain、QualifiedExecutionNode、typed edge、registration/reactive support、RootObligation、snapshot creator/parser、ExecutionGraphIndex を package-local facade として実装した。npm root の最終 compiler facade は AT01 が所有する。
- **cross-record validation**：strict ModuleGraphSnapshot と selected ObservationContract、content definition、RuntimeModuleBinding、resolution environment、generation domain、operation role、edge endpoint、root-kind table、trigger/owner/terminal constraint、support path、auxiliary exact-use を publication 前に検証する。unreachable primary node/edge は保守的上限として許可する。
- **derived index**：fixed profile `dathra.execution-graph-derivation/1` で seed root だけから `may-execute | may-materialize` を走査し、root-specific fact、potential support、seed reachability、shortest justification、support chain、traversal SCC/condensation を非直列化 index に生成する。unseeded support cycle は fact を生成しない。
- **hard budget**：getter を実行しない descriptor preflight、framework hard cap を狭める override、operation-local BudgetLedger、dependency pre-parse cardinality、canonical byte の事前計測、validation、fact、traversal、support probe、derived support、path、SCC、index の hard limit を追加した。
- **初回実装の検証**：transformer 全14 files、697 tests が成功した。ExecutionGraph は21 tests、statement 86.68%、branch 67.26%、function 92.06%、line 87.54% であった。typecheck、通常 lint 0件、format check、build が成功した。type-aware lint は ExecutionGraph の warning/error 0件で、既存 transform/rlse の warning 14件だけを報告した。
- **初回 artifact 検査**：初回 revision の ESM/CJS build に `node:`、`createHash`、`Buffer` はなかった。
- **初回並列実装レビュー**：同一 revision を三人で評価した。registration site の callback fan-out 拒否、recursive template DAG と未課金 support probe、under-specified identity edge を blocker として採用した。SPEC table、fixture、JSDoc、npm root exposure は関連する correctness 修正と package boundary 修正へ統合した。
- **corrective design review**：identity slot、registration fan-out、full taxonomy、hard budget、internal module 分割、npm root 非公開、decomposition gate の同一案を三人で評価した。contract と package boundary は `ACCEPT` であった。budget reviewer が SCC 前処理と最終 index work の未課金を blocker としたため、全 phase で共有する operation-local BudgetLedger と `maximumIndexSteps` を追加した。
- **corrective red test**：更新後の25 tests は旧実装に対して7件失敗した。失敗は registration fan-out、identity slot、new budget field、npm root boundary であり、test fixture 自体の scheduler occurrence 重複を修正後に production code を変更した。
- **corrective implementation**：identity edge を exact occurrence slot を持つ discriminated union にし、同じ registration node の同一 option tuple から複数 support を許可した。support derivation は registration node と reactive collector の index を使い、candidate probe を課金する。template DAG は iterative DFS に変更した。
- **internal module 分割**：`implementation.ts` を4,743行の monolith から274行の package-local facade へ縮小した。`model.ts`、`budget.ts`、`canonical.ts`、`validation.ts`、`derivation.ts` は一方向の import graph を持ち、循環 import はない。
- **追加 fixture**：41 operation kind の正準 role と role swap、full edge-role table、reactive operation table、scheduler 16 pair、identity slot と cross-location assertion、registration fan-out と option mismatch、不成立 support probe、support-chain tie-break、12,000 node の generated-template DAG、全主要 budget counter、npm root negative boundary を追加した。
- **現在の検証**：transformer 全14 files、709 tests が成功した。ExecutionGraph は33 tests、statement 89.24%、branch 71.02%、function 94.36%、line 90.35% である。typecheck、通常 lint 0件、format check、build が成功した。type-aware lint は ExecutionGraph の warning/error 0件で、既存 transform/rlse の warning 14件だけを報告した。
- **corrective artifact 検査**：built ESM/CJS/DTS と runtime export に snapshot creator/parser、index creator、ExecutionGraphError、ExecutionGraph schema text は含まれない。ExecutionGraph source に Node.js 固有の crypto API、`createHash`、`Buffer` dependency はない。
- **初回収束確認**：初回並列レビューに参加していない Banach は、graph record cardinality が canonical clone より後に検査されること、reactive invalidation path の可変長 work が未課金であること、final index が課金前に spread allocation を行うことを blocker として `REJECT` した。設計正本の relation 列挙に `scheduler-sequence` がない点は follow-up とした。
- **収束 blocker 修正**：creator と parser の両方で descriptor-only graph cardinality preflight を `snapshotClosed` より前に実行し、invalidation edge ID と可変長 reference work を probe 前に課金した。SCC と final index は可変長 map、sort、output、candidate allocation の前に operation-local ledger を課金し、課金前の collection spread を除去した。getter 非実行、exact boundary、boundary-minus-one の test を追加し、設計正本の relation 列挙へ `scheduler-sequence` を追加した。
- **収束確認結果**：同じ Banach が固定 hash の修正後 revision を限定再確認し、三つの blocker と `scheduler-sequence` follow-up の解消、新しい correctness blocker の不在を確認して `ACCEPT` とした。
- **follow-up**：複数要素の invalidation path を使い、validation step の差分課金を固定値で検証する fixture は将来の回帰検出を強める。現 slice の correctness と完了を妨げないため、blocker にはしない。
- **commit と push**：並列レビューとhigh-cost分割規則を文書commit `84515f14a2ae54f2b458fc47a858ba4ac16aa8f6`、ExecutionGraph実装と設計正本をimplementation commit `4ebd2204e504c21d34e50db6e0b89b55e2c3df41` としてpushした。push後のlocal HEADとtracking branchは後者のexact OIDで一致した。
- **完了証拠**：targeted 33 tests、transformer全14 files、709 tests、typecheck、通常lint 0件、type-aware lintの新規warning 0件、format、build、artifact非公開境界、root/registration/scheduler/cycle/budget fixture、独立実装レビュー、収束確認が成功した。commit、push、exact remote OIDも確認済みである。

#### EG03 decomposition gate

EG03 は untrusted parser、many-to-many relation、fixed point、SCC を扱うため high-cost slice に該当する。
四点セットは package-local facade と正本であり、内部責務を一つの source file へ集約しない。

| 責務 | internal module | owner | cardinality と index | budget charge |
| --- | --- | --- | --- | --- |
| record、ID、taxonomy | `model.ts` | EG03 schema | finite record kind | record cap、validation step |
| hard cap と operation ledger | `budget.ts` | EG03 operation | counter ごとに1 ledger | 全 counter の事前課金 |
| closed parse と canonical identity | `canonical.ts` | creator/parser | input node と record の1:N | input、dependency、record、canonical byte |
| cross-record invariant | `validation.ts` | snapshot publication | reference と edge のN:1、support path の1:N | validation step |
| root closure と topology index | `derivation.ts` | nonserialized index | node から edge/support の1:N index | fact、traversal、support、path、SCC、index |
| operation orchestration | `implementation.ts` | package-local facade | 一つの call に一つの ledger | phase 間で同じ ledger を共有 |

| relation | source 最大 cardinality | target 最大 cardinality | index | owner |
| --- | --- | --- | --- | --- |
| traversal edge | node から record cap まで | node へ record cap まで | source node ID | EG03 derivation |
| registration support | registration node から record cap まで | callback root は複数 site から参照可能 | registration node ID | EG03 static support、PL02 producer normalization |
| reactive support | collector から record cap まで | updater root は複数 support から参照可能 | collector node ID | EG03 static support |
| seed reachability | seed から root 数まで | root は seed 数まで | root support adjacency | EG03 derivation |

## その前に完了した Slice

### EG02 ModuleCoordinator

- **設計要件**：resolver/load/transform/extract を一つの observed transaction として実行し、multi-domain module graph を deterministic fixed point まで閉じ、stable observation の atomic commit 後だけ immutable snapshot を公開する。
- **変更範囲**：設計正本に coordinator transaction、adapter profile、attempt-specific domain、stage cache、phase join、reverse invalidation、atomic commit/cancel を追記し、`packages/transformer/src/moduleCoordinator/` に四点セットを追加する。plugin/bundler bridge は BR01 に残す。
- **domain/profile**：build input は stable domain config を持ち、attempt の describe stage が current transcript/profile observation から final domain ID を生成する。別 stable key が同じ domain ID へ collapse する場合は拒否する。resolver/load/transform/extract profile は EG01 graph record の既存 field に完全一致させる。
- **adapter transaction**：`describePipeline`、`describeDomain`、`resolve`、`load`、`transform`、`extract`、`replayCachedStage`、`tryCommit`、`rollback` を closed operation input と positive/negative observation で契約化する。
- **fixed point**：resolve 後の loader unit と load 後の runtime unit を分離し、alias merge 後に `source < evaluation` phase を join する。evaluation 初回遷移で extract 済み site を一度だけ queue し、source-only target は outgoing request を resolve しない。
- **cache/invalidation**：stage key は profile、domain、complete operation input の canonical digest とする。cache effect は pure/replayable/transaction-local に分類し、hit observation と全 owner を current attempt に再登録する。watch change は observation owner と previous target-to-importer reverse closureから一 transaction で invalidate する。
- **atomicity**：final validation と publication は `tryCommit` の単一 linearization point とする。commit 呼び出し後は abort せず、committed receipt 後は必ず prepared state を swap する。失敗/cancel/invalidated attempt は previous snapshot/cache を変更しない。
- **budget**：retry、round、domain/entry/module/request/site/candidate/observation、persistent cache entry/byte を hard limit にする。current graph evidence を pin できない場合は commit しない。
- **先行 test**：entry/domain validation、cycle、source-only/alias phase upgrade、external alias evidence、deterministic order、observation conflict、mid-build invalidation/retry、atomic commit/abort race、rollback、cache hit/replay/uncacheable、reverse invalidation、profile/domain refresh、全 budget failure を追加する。
- **red test 証拠**：`pnpm --filter @dathra/transformer exec vitest run src/moduleCoordinator/implementation.test.ts` は `./implementation` 不在で失敗し、SPEC と test が production implementation より先に追加されたことを確認した。
- **実装済み API**：single-writer `ModuleCoordinator`、observed adapter transaction、attempt-specific domain、native/CommonJS entry/request、resolve/load/transform/extract、pure/replayable/transaction-local cache、atomic `tryCommit`/rollback、hard budget と typed diagnostic を root export へ追加した。
- **fixed point**：temporary loader unit と load 後の runtime unit を分離し、runtime identity alias、`source < evaluation` phase join、cycle、source-only extraction、evaluation promotion、external exact alias evidence を graph-completeness barrier 前に閉じる。
- **cache/invalidation**：complete immutable operation input と stage profile から key を作り、cache hit の observation/effect/owner を current transaction へ再登録する。pending invalidation は successful commit まで保持し、reverse lineage を保持しない unpinned cross-graph cache は deterministic eviction する。
- **atomicity**：queued input は invocation 時に snapshot し、prepared coordinator state と result を `tryCommit` 前に完成させる。commit 中 abort の後に exact receipt が返る場合は必ず state を swap し、invalidated/throw/cancel は publication なしで rollback する。
- **現在の検証**：transformer 全13 files、676 tests が成功した。ModuleCoordinator は49 tests、statement 88.84%、branch 78.53%、function 97.03%、line 89.51% である。typecheck、通常 lint 0件、format check、build が成功した。type-aware lint は ModuleCoordinator の warning/error 0件で、既存 transform/rlse の warning 14件だけを報告した。
- **artifact 検査**：ESM/CJS build に `node:`、`createHash`、`Buffer` はない。declaration は public constructor/factory、adapter transaction、commit/cache/observation 型を公開し、built ESM から `createModuleCoordinator`、`ModuleCoordinator`、`ModuleCoordinatorError` を function として実行確認した。
- **独立設計レビュー**：entry metadata、profile-to-graph binding、closed stage key、owner reverse index、commit/cancel race、external evidence timing、domain injectivity、alias phase join、cache effect replay の指摘を反映し、Halley の3回目レビューは `ACCEPT` である。
- **独立実装レビュー**：1回目の queue snapshot、cross-graph cache lineage、lint、実 delay fixture の4指摘をすべて回帰 test 付きで修正した。Parfit の2回目レビューは全指摘の解消と最新49 tests/gate を確認し `ACCEPT` である。
- **完了証拠**：targeted red test、transformer test/typecheck/lint/type-aware lint/format/build、transaction race fixture、cache/invalidation fixture、独立実装レビューが成功した。実装 commit `dd54efc3c2d3957a3301a4598e778c35995a9fe8` を push し、local と tracking branch の exact OID が一致することを確認した。

## 以前に完了した Slice

### EG01 immutable module graph snapshot

- **設計要件**：server、browser、worker など複数の resolution domain を一つの immutable snapshot に束縛し、content definition、runtime module identity、loader cache identity、semantic request、source site を混同しない module graph foundation を作る。
- **変更範囲**：設計正本の ModuleCoordinator と NativeModuleClosure を具体化し、`packages/transformer/src/moduleGraph/` に `AGENTS.md`、`SPEC.typ`、`implementation.test.ts`、`implementation.ts` を追加する。producer slice として transformer root export も追加する。
- **identity DAG**：semantic profile、edge-independent request inventory、external definition contract、module definition、resolution domain、runtime binding、loader entry、external runtime closure evidence、semantic request、resolution evidence、resolved request、request-site evidence、request site/entry、snapshot の順に ID を生成する。import edge は runtime binding ID へ戻さないため cycle を許容する。
- **resolution domain**：native module-map/Realm と CommonJS loader-cache namespace、resolver profile/input transcript、module-map semantics、condition set と hook-visible sequence を domain ごとに保持する。同じ source URL でも domain、module-map type、effective attributes、transform output が異なれば別 record を許可する。
- **module identity**：compiler の `ModuleDefinitionId` と runtime の Module Record/namespace/evaluation/failure identity を分離する。request/module-map URL と response/base URL、module-map type と definition kind、source attributes と effective cache-key attributes も別 field にする。
- **request semantics**：ECMAScript ModuleRequest identity を site ordinal から分離し、specifier、attributes、phase が同じ request は一つの target に限定する。CommonJS は resolution origin を持つ別 request とし、semantic request、target loader entry、structured resolver evidence を `ResolvedModuleRequest` で一対一に結合する。inventory syntax と site の semantic request key set は `ModuleRequestSiteEvidence` の finite coverage proof で結合する。
- **phase-aware closure**：`source < evaluation` の fixed point を使う。source-phase target は transitive site を traversal せず、evaluation へ到達した content binding だけが inventory と完全一致する site closure を必要とする。cross-phase request は同じ runtime binding を共有する。
- **external leaf**：external definition は entry/importer にしない。runtime ID に依存しない `ExternalModuleDefinitionContract` と、binding/loader entry 後の `ExternalRuntimeClosureEvidence` を分離し、Module Source Object、namespace、evaluation/failure、TLA、`import.meta`、transitive ownership、byte correspondence を二段階で証明できる target だけを許す。
- **先行 test**：URL canonicalization、exact byte digest、record ID DAG、multi-domain resolution、request/response URL、module-map key、ESM request dedup、CommonJS origin、source/evaluation phase、cycle、exact reachability、unused/dangling/cross-domain/external role、noncanonical order、forged digest、getter 非実行、public export を実装前に追加する。
- **変更前 baseline**：transformer 11 files、607 tests、typecheck、lint 0件、format check、build がすべて成功した。
- **red test 証拠**：`pnpm --filter @dathra/transformer exec vitest run src/moduleGraph/implementation.test.ts` は `./implementation` 不在で失敗し、SPEC と test が production implementation より先に追加されたことを確認した。
- **実装済み API**：URL/content digest、semantic profile、resolution domain、request inventory、二段階 external contract、definition、runtime binding、loader entry、native/CommonJS semantic request、resolution evidence、resolved request、request-site evidence/site、entry、snapshot creator と strict parser を実装し、transformer root から公開した。
- **実装済み validation**：closed input、record digest、canonical order、multi-domain namespace、runtime/cache identity conflict、request/evidence/target 一対一対応、syntax/request-key coverage、external exact evidence、`source < evaluation` fixed point、cycle、cross-phase coherence、exact-use closure を検証する。
- **現在の検証**：transformer 全12 files、627 tests が成功した。moduleGraph は20 tests、statement 88.49%、branch 74.84%、function 100%、line 89.71% である。typecheck、lint 0件、format check、build が成功した。type-aware lint は moduleGraph の warning/error 0件で、既存 transform/rlse の warning 14件だけを報告した。
- **artifact 検査**：ESM/CJS build に `node:`、`createHash`、`Buffer` はない。declaration は snapshot creator/parser/error と全 producer type を公開する。build artifact で `abc` digest、URL canonicalization、creator/parser の function export を実行確認した。
- **独立レビュー**：単一 graph、URL-only identity、site-bound request、opaque domain evidence の不足を指摘した設計レビューを取り込み、definition/runtime/cache identity、resolution evidence、source phase、loader namespace を分離した。ResolvedModuleRequest、二段階 external contract、request-site coverage evidence まで設計正本へ追記し、Kepler の最終 design review は `ACCEPT` である。実装レビューで condition sequence の重複/order を包含判定で失う問題を修正し、Bacon の2回目の独立実装レビューは `ACCEPT` である。
- **完了証拠**：transformer test、typecheck、lint、type-aware lint、format、build、canonical vector、cycle/source-phase fixture、独立実装レビューが成功した。実装 commit `4efc445af301512fb627af6c7d568fee5a06de0f` を `origin/feature/declarative-ui-execution-partitioning` へ push した。

## さらに以前に完了した Slice

### OC01 observation contract

- **設計要件**：root の観測条件を closed constraint と canonical trace language で表し、source と candidate の equality または明示 rule による refinement を有限に判定する。
- **変更範囲**：`packages/shared/src/observationContract/` に `AGENTS.md`、`SPEC.typ`、`implementation.test.ts`、`implementation.ts` を追加し、後続 compiler、finalizer、runtime が使う pure contract API を root export へ追加する。
- **canonical behavior**：一回の concrete trace ではなく、external input class ごとの minimal complete DFA を正本とする。DFA は unique occurrence slot を alphabet に持ち、全 partial-order linearization、cardinality、terminal を language に保持する。
- **refinement 判定**：actual relation `R` の source/candidate projection が各 behavior language と一致し、contract rule から生成した allowed relation `A` に `R` が包含されることを検証する。proof acceptance だけで arbitrary relation を合法化しない。
- **composition**：constraint reference を contract ID で修飾し、`(subjectId, kind)` ごとの binding、`merge-identical`、exclusive owner、commutative、total order、member-to-result mapping、result order closure を canonical record にする。
- **RealizationWitness**：concrete render instance の atomic obligation、artifact token、parser step、token continuity、parser profile、host membership を検証する。全 input class の可能性は symbolic template、exact artifact provenance は AF01 の byte reproduction record、final witness と sidecar への結合は SL01 が担当する。
- **先行 test**：closed schema、digest、canonical DFA normalization、language equality/inclusion、epsilon projection、全 refinement kind、composition conflict/result、witness coverage/parser/host failure を追加する。実装不在による targeted failure を確認してから production code を追加する。
- **red test 証拠**：`pnpm --filter @dathra/shared exec vitest run src/observationContract/implementation.test.ts` は `./implementation` 不在で失敗し、SPEC と test が production implementation より先に追加されたことを確認した。
- **edge case**：同じ label を持つ複数 occurrence、optional slot、exclusive branch、transitive order、coalescing quotient、rule 外 relation、productive cycle、ambiguous rule、別 contract witness、unknown parser operation、unproved obligation を拒否する。
- **実装済みの semantic closure**：input universe の exact partition、contract-conformant behavior acceptance、caller-supplied `A` を持たない relation acceptance、immutable policy requirement と proof closure、独立 result contract を所有する composition `/4`、class-local policy application、coverage `/2`、sequence `/2`、witness `/3` を production code と replacement test へ反映した。
- **解消済みの設計 blocker**：composition policy の digest cycle は structural binding と class-local policy application を分離して解消した。coalescing は ObservationContract `/3` の immutable policy requirement と RuleApplication `/3` に移行し、descriptor の qualified ID、version、rule graph digest、proof domain を完全一致させた。
- **現在の検証**：semantic test 16件と既存 replacement test 7件を含む shared 全165件が coverage 付きで成功した。observationContract は statement 84.40%、branch 69.24%、function 90.14%、line 84.63% である。typecheck、lint 0件、format check、build が成功した。type-aware lint は observationContract の warning 0件、既存 `rlse.config.ts` の warning 1件である。
- **artifact 検査**：shared ESM/CJS build に `node:`、`createHash`、`Buffer` はなく、declaration は policy requirement、relation composition context、proof acceptance input、equality input を公開する。
- **完了証拠**：shared test、typecheck、lint、format、build、browser-compatible artifact inspection、known canonical vector、独立実装レビュー、commit、push を必要とする。

## 過去の Slice

### SC01 execution registry contract

- **設計要件**：source-local `RegistryId` と `registry:${Kind}` domain の qualified identity を分離し、10種類の descriptor、25個の合法 role tuple、symbolic/final catalog、exact seed、同一環境 dependency、remote protocol、owner-grouped projection を closed schema として表す。
- **変更範囲**：`packages/shared/src/executionRegistry/` に `AGENTS.md`、`SPEC.typ`、`implementation.test.ts`、`implementation.ts` を追加し、`packages/shared/src/index.ts` から後続 compiler/runtime slice が使う contract と validator を公開する。
- **SPEC と ADR**：`dathra.registry/1`、role interface、symbolic universe、environment catalog、catalog pair、protocol、projection seed、`dathra.registry-environment-projection/2` の closed schema、self digest、生成 DAG、fixed-point rule を新規 ADR で固定する。既存 Accepted ADR の変更はない。
- **先行 test**：10 descriptor kind、local/qualified identity、25 legal role tuple、symbolic/final catalog、definition seed、required/request-reachable activation、dependency cycle、remote protocol expansion、pair commitment、projection fixed point の成功系を追加する。closed record違反、kind/reference mismatch、295 illegal role tuple、cross-environment import、noncanonical order、duplicate、missing/extra fixed-point record、protocol self-selection、deployment/digest mismatch を失敗系として追加する。
- **影響範囲**：shared の pure contract、derivation、validation API と export surface だけを変更する。SC03 は artifact 非依存 universe、AF01 は final catalog/projection/core、PE01 は selected emission、RR01 は authenticated local conformance を後続 slice で接続する。
- **依存順の理由**：SC01 は Phase 2 の contract だが、Phase 1 の OC01 が registry identity を参照する。独立レビュー済み matrix の依存順に従い、ID01 の直後、OC01 より前に実装する。
- **edge case**：descriptor と binding は getter を実行せず closed data record として snapshot する。`build` role、cross-environment import、remote role の protocol 外 selection、arbitrary seed、catalog/projection の追加と欠落を拒否する。dependency cycle は finite owner/role fixed point で収束させ、self digest の生成 DAG に後段参照を入れない。
- **完了証拠**：shared の test、typecheck、lint、build、root export、全 role matrix と closed-schema failure の coverage、独立レビュー、commit、push を必要とする。

## 完了した Slice の証拠

### ID01 canonical identity

- `implementation.test.ts` を先に追加し、実装不在による失敗を確認してから production implementation を追加した。
- `pnpm --filter @dathra/shared test` は5 files、115 tests が成功し、`canonicalIdentity/implementation.ts` は statement 97.41%、branch 96.39%、function 100%、line 97.36% であった。
- `pnpm --filter @dathra/shared typecheck`、`lint`、`fmt:check`、`build` はすべて成功した。
- `pnpm --filter @dathra/shared lint:type-aware` は ID01 の error と warning が0件で成功した。既存の `rlse.config.ts` に warning が1件残る。
- ESM/CJS/DTS build artifact に Node.js 固有の crypto API、`Buffer`、`createHash` が含まれないことを検索で確認した。
- build 後の ESM API で `abc` の SHA-256 vector が `sha-256:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0` になることを実行して確認した。
- 2回目の独立レビューは `ACCEPT` であり、実装 commit `3816c342ce203cbf5ddf5b91c67479c03e72a163` を push した。
- push 後に local と tracking branch が同じ exact OID であることを確認した。

### SC01 execution registry contract

- `SPEC.typ` と `implementation.test.ts` を先に追加し、`implementation.ts` 不在による targeted test failure を確認してから production implementation と root export を追加した。
- 10 descriptor kind、25 legal role tuple と295 illegal tuple、local/qualified identity、closed nested union、symbolic/final/environment/protocol catalog、pair commitment、exact seed、dependency cycle、remote protocol、owner-grouped fixed point を直接検証した。
- `pnpm --filter @dathra/shared test` は6 files、142 tests が成功し、`executionRegistry/implementation.ts` は statement 89.57%、branch 77.71%、function 96.4%、line 89.26% であった。
- `pnpm --filter @dathra/shared typecheck`、`lint`、`fmt:check`、`build` はすべて成功し、通常 lint は warning と error が0件であった。
- `pnpm --filter @dathra/shared lint:type-aware` は成功し、SC01 の warning と error は0件であった。既存の `rlse.config.ts` に warning が1件残る。
- ESM/CJS build artifact に `node:crypto`、`createHash`、`Buffer`、`Array.prototype.toSorted` が含まれないことを検索し、ESM root から主要4 API が function として公開されることを実行確認した。
- Nash の nested union と empty property key、Lagrange の paired protocol seed と host-profile closure の指摘を test-first で修正した。
- 3回目の独立実装レビューは `ACCEPT` であり、SC03・AF01・RR01との producer/consumer integration は計画どおり後続 slice に残る。
- implementation commit `da05b191945df608e09a61d87538a7bf69ceca82` を push した。
- push 後に local と tracking branch が `da05b191945df608e09a61d87538a7bf69ceca82` で一致した。

## Acceptance Work

各項目は設計正本の「実装時の検証事項」に一対一で対応する。
`completed` にするには test、command、artifact、benchmark、inspection result のいずれかによる直接証拠が必要である。

| ID | Acceptance work | Owner row(s) | Planned evidence path | 状態 | 直接証拠 |
| --- | --- | --- | --- | --- | --- |
| A01 | ModuleCoordinator の incremental build cost と memory usage | EG02 | `packages/transformer/src/moduleCoordinator/benchmark.test.ts` | pending | 未取得 |
| A02 | declared candidate universe 内の solver 最適性 | CN01 / AF01 / SL01 | `packages/transformer/src/finalPlanSelector/implementation.test.ts` | pending | 未取得 |
| A03 | ObservationContract と RealizationWitness の canonical comparison | OC01 | `packages/shared/src/observationContract/implementation.test.ts` | pending | 未取得 |
| A04 | selection-domain class の worst-case metric 再現 | PJ01 / AF01 / SL01 | `packages/transformer/src/finalPlanSelector/implementation.test.ts` | pending | 未取得 |
| A05 | canonical atom classification と digest の順序独立性、排他性、網羅性 | PJ01 | `packages/shared/src/projectionContract/implementation.test.ts` | pending | 未取得 |
| A06 | plan-independent DeploymentProjectionDefinition ID | PJ01 | `packages/shared/src/projectionContract/implementation.test.ts` | pending | 未取得 |
| A07 | ArtifactAddressId、exact-byte digest、plan ID の非自己参照と再現性 | AR01 / PI01 / AF01 / SL01 | `packages/plugin/src/artifactFinalizer/reproducibility.test.ts` | pending | 未取得 |
| A08 | 一つの ArtifactAddressId に対する単一 bytes identity | AR01 / AF01 | `packages/plugin/src/artifactFinalizer/implementation.test.ts` | pending | 未取得 |
| A09 | ProjectionManifestCore、固定長 envelope、cold reachable bytes の計数 | PJ01 / AF01 / PE01 | `packages/plugin/src/projectionEmitter/implementation.test.ts` | pending | 未取得 |
| A10 | final bundler closure からの server-only dependency 除外 | CE01 / AF01 / BA01 | `packages/plugin/src/artifactFinalizer/artifactClosure.test.ts` | pending | 未取得 |
| A11 | source、manifest、contract conflict diagnostic | SC03 / PE01 | `packages/transformer/src/contractCompiler/implementation.test.ts` | pending | 未取得 |
| A12 | semantic ID と registry ID の namespace 衝突検査 | SC01 / SC02 / SC03 | `packages/transformer/src/contractCompiler/implementation.test.ts` | pending | 未取得 |
| A13 | module map、import map、integrity、redirect の host profile 適合性 | RR01 / CR02 / PE01 / BA01 | `packages/plugin/src/projectionEmitter/implementation.test.ts` | pending | 未取得 |
| A14 | qualified universe、final/environment catalog、fixed-point projection、runtime local closure | SC03 / AF01 / PE01 / RR01 | `packages/transformer/src/contractCompiler/implementation.test.ts`、`packages/plugin/src/artifactFinalizer/implementation.test.ts`、`packages/plugin/src/projectionEmitter/implementation.test.ts`、`packages/runtime/src/runtimeRegistry/implementation.test.ts` | pending | 未取得 |
| A15 | GraphPathWitness と private grant/reference identity の事前検証 | SC03 / MT01 / RP02 | `packages/runtime/src/reference/implementation.test.ts` | pending | 未取得 |
| A16 | codec graph edge slot table の materialization 前検証 | MT01 | `packages/runtime/src/materialization/implementation.test.ts` | pending | 未取得 |
| A17 | BootAuthority の事前注入と capability binding | PJ01 / CR02 | `packages/runtime/src/bootstrap/implementation.test.ts` | pending | 未取得 |
| A18 | policy input、value-domain、failure-schema、host-profile、brand の conformance | SC01 / RR01 | `packages/runtime/src/runtimeRegistry/implementation.test.ts` | pending | 未取得 |
| A19 | RenderOperation の cancel、retry、header、stream race | SR02 | `packages/runtime/src/ssr/renderOperation/implementation.test.ts` | pending | 未取得 |
| A20 | FinalHeaderCommit と複数 103 publication の linearization | SR02 | `packages/runtime/src/ssr/renderOperation/implementation.test.ts` | pending | 未取得 |
| A21 | subscription incarnation、pair fence、continuity、resync、ack、budget、GC | SP01 / SP02 | `packages/runtime/src/subscription/implementation.test.ts` | pending | 未取得 |
| A22 | allocation token、cleanup deadline、LateSettlementLedger race | LC01 / CR01 | `packages/runtime/src/lifecycle/implementation.test.ts` | pending | 未取得 |
| A23 | creation operation と allocation/commit identity | CR01 | `packages/runtime/src/clientScope/implementation.test.ts` | pending | 未取得 |
| A24 | retention、CleanupTaskToken、LateCleanupLedger、hard budget、generation fence | LC01 / CP02 | `packages/runtime/src/lifecycle/implementation.test.ts` | pending | 未取得 |
| A25 | graph-table budget、codec enforcement、疎配列、symbol validation | MT01 | `packages/runtime/src/materialization/implementation.test.ts` | pending | 未取得 |
| A26 | carrier attestation、canonical text、JSON depth、local symbol validation | MT01 / SE01 / CR02 | `packages/runtime/src/materialization/implementation.test.ts` | pending | 未取得 |
| A27 | DSD parse fence と custom-element reaction ordering | DA01 / DA04 | `packages/runtime/src/activation/implementation.test.ts` | pending | 未取得 |
| A28 | move、adoption、cross-coordinator migration | DA04 / CR01 | `packages/components/src/customElementShell/implementation.test.ts` | pending | 未取得 |
| A29 | input、autofill、history restoration、form reconciliation | DA02 | `packages/runtime/src/dom/reconciliation/implementation.test.ts` | pending | 未取得 |
| A30 | interaction、load、media、animation event admission frontier | DA02 | `packages/runtime/src/events/implementation.test.ts` | pending | 未取得 |
| A31 | dynamic UI と late fragment の slot transaction | DA03 | `packages/runtime/src/dom/slots/implementation.test.ts` | pending | 未取得 |
| A32 | activation capability の scope、selector、stale rejection、failure | CP02 / DA01 | `packages/runtime/src/activationCapability/implementation.test.ts` | pending | 未取得 |
| A33 | integration key、opaque ref、budgeted operation ledger、CAS、watermark | PJ01 / PE01 / CP02 / DA03 | `packages/runtime/src/operationLedger/implementation.test.ts` と projection integration test | pending | 未取得 |
| A34 | failure subject、tombstone、snapshot、pin budget、lease | RF01 | `packages/runtime/src/runtimeFailure/implementation.test.ts` | pending | 未取得 |
| A35 | effect、onActivate、onDispose、owned resource cleanup DAG | LC01 | `packages/runtime/src/lifecycle/implementation.test.ts` | pending | 未取得 |
| A36 | remote outcome の cancellation、expiry、ambiguity、delivery horizon | OP01 / OP02 | `packages/runtime/src/remoteOperation/implementation.test.ts` | pending | 未取得 |
| A37 | remote trust boundary、canonical frame、budget、receipt、recovery | OP01 / OP02 / RR01 | `packages/runtime/src/remoteOperation/implementation.test.ts` | pending | 未取得 |
| A38 | server receipt から closed wire DTO と response proof を構築する順序 | OP01 / OP02 | `packages/runtime/src/remoteOperation/implementation.test.ts` | pending | 未取得 |
| A39 | `render:client` の prop 契約と reserved prop removal | DX01 / AU01 | `packages/transformer/src/executionDirectives/implementation.test.ts` | pending | 未取得 |
| A40 | `dom:external` の identity、nesting、SSR、lifetime、cleanup | DX01 / DA01 / DA04 / LC01 | `playgrounds/e2e/src/routes/external-dom-ownership.test.ts` と directive unit test | pending | 未取得 |
| A41 | non-atomic writer の BufferedFinalWrite と unknown terminal | SR02 | `packages/runtime/src/ssr/renderOperation/implementation.test.ts` | pending | 未取得 |
| A42 | DocCodeBlock の server-only highlight artifact closure | MG01 / CE01 / AF01 | `docs/src/components/DocCodeBlock/DocCodeBlock.artifact.test.ts` | pending | 未取得 |
| A43 | client root がない route の zero bootstrap と zero payload | CG01 / SE01 / CR02 / PE01 | `packages/plugin/src/projectionEmitter/zeroBootstrap.test.ts` と emitted route artifact inspection | pending | 未取得 |
| A44 | root から失敗 dependency までの diagnostic path | SC03 / PL02 / CN01 | `packages/transformer/src/diagnostic/implementation.test.ts` | pending | 未取得 |
| A45 | policy attestation の upstream-only closure と branded trust admission | SC03 / RR01 | `packages/transformer/src/contractCompiler/policyProofDomain.test.ts` と `packages/runtime/src/runtimeRegistry/policyProofVerifier.test.ts` | pending | 未取得 |

## Slice Log

| Slice | 状態 | 設計要件 | 検証 | Review | Commit / Push |
| --- | --- | --- | --- | --- | --- |
| PLAN-00 | completed | 実装 branch、正本、進捗台帳を確立する | clean tree と local/remote tracking を確認 | goal 文書の事前独立レビューは `ACCEPT` | `8a0eedd` / push 済み |
| BASELINE-00 | completed | 実装前の既存挙動と gate を固定する | Baseline 表の19 command | production change がないため独立実装レビュー対象外 | この記録を次の文書 commit に含める |
| MATRIX-01 | completed | package/API/SPEC/test/implementation と acceptance owner を確定する | 59 row、未定義 dependency 0、cycle 0、AX01 閉包外 0 | 3回目の独立レビュー `ACCEPT` | この記録を matrix commit に含める |
| VG01 | completed | docs と全 playground に実処理の build/fmt/test gate を設ける | 全 app production workflow、root aggregate、CI format/build/test | 5回目の独立レビュー `ACCEPT` | `8fe6c60` / push 済み |
| ID01 | completed | canonical preimage、digest、qualified ID の共通 primitive | shared test/typecheck/lint/build と artifact inspection | 2回目の独立レビュー `ACCEPT` | `3816c34` / push 済み |
| SC01-DESIGN | completed | flat projection と artifact 順序の矛盾を解消する | design type/prose、matrix、生成 DAG の整合確認 | proposal review と final actual diff review は `ACCEPT` | `17591e5` / push 済み |
| SC01 | completed | closed registry schema、catalog、fixed-point projection | shared 6 files・142 tests、typecheck、lint、fmt、build、artifact inspection | 3回目の独立実装レビューは `ACCEPT` | `da05b19` / push 済み |
| OC01-DESIGN | completed | canonical trace language、relation inclusion、composition result、instance witness | 設計正本、matrix、digest DAG、責務分担を更新した | 提案と2回目の actual diff レビューは `ACCEPT` | `2900469` / push 済み |
| OC01-DESIGN-REVISION | completed | contract conformance、derived relation、proof DAG、result contract、coverage closure | composition `/4`、class-local policy closure、contract/application `/3` coalescing requirement の superseding ADR と interface specification を更新した | cycle proposal は Archimedes、coalescing requirement は Pauli が評価し、指摘を反映済み | `86204da` / origin tracking branch |
| OC01 | completed | canonical contract、relation、composition、realization | shared 8 files・165 tests、typecheck、lint、fmt、build、browser artifact inspection が成功 | Cicero の focused 最終レビューは `ACCEPT` | `86204da` / origin tracking branch |
| EG01-DESIGN | completed | multi-domain module graph、非循環 identity DAG、phase-aware exact closure | 設計正本、EG01 SPEC、先行 contract test、targeted red failure | 複数回の proposal/actual diff review を収束し、Kepler の最終レビューは `ACCEPT` | この slice の implementation commit に含める |
| EG01 | completed | canonical immutable module graph snapshot と strict exact-use validation | transformer 12 files・627 tests、typecheck、lint、type-aware lint、fmt、build、artifact inspection が成功 | condition sequence の指摘を修正し、Bacon の2回目レビューは `ACCEPT` | `4efc445` / push 済み |
| SC02A2 | completed | source-local subjectとpath taxonomy | focused 17 tests、shared 191 tests、typecheck、lint、fmt、build、root非公開 | McClintockのslice-local収束reviewは`ACCEPT` | `7b22d0d` / push済み |
| SC02A3 | completed | source-local factとtransfer binding | focused 25 tests、shared 199 tests、typecheck、lint、fmt、build、root非公開 | KantのR3 convergence reviewは`ACCEPT` | `43350db` / push済み |
| SC02A4 | completed | source-local semantic relation | focused 31 tests、shared 217 tests、typecheck、lint、fmt、build | NewtonのR2 convergence reviewは`ACCEPT` | `fcfe5ee` / push済み |
| SC02A5 | completed | source-local export summary | fixed focused 38 tests、shared 224 tests、typecheck、lint、fmt、build、declaration非公開 | CiceroのR2 convergence reviewは`ACCEPT` | `dc456b8` / push済み |
| MP01-DK1-T | completed | materialization mechanismの7 literal taxonomy | focused 5 tests、shared 191 tests、typecheck、lint、fmt | Godelのslice-local収束reviewは`ACCEPT` | `ff28849` / push済み |
| MP01-DR-S | reopened | demand ownerとatomic requirement前提の分解 | R1三役とR2 fresh convergenceでowner、admission、publicationを照合 | R2はRussellが`REJECT`。R3でblocker修正中 | production commitなし |
| AR01-ID | completed | ArtifactAddressIdのtype-only nominal domain | type、AST、memory emit、root非公開 | 三役のimplementation reviewはすべて`ACCEPT` | `14edf91`と`c147270` / push済み |
| AR01-EB | completed | artifact entry roleとentry binding | focused 9 tests、shared 214 tests、typecheck、lint、fmt、build、root非公開 | 三役全員`ACCEPT`、blocker/follow-up 0件 | `106acae` / push済み |
| RC01-DI2A | completed | descriptor occurrence snapshot boundary | fixed focused 48 tests、shared 262 tests、coverage 100%、全package gate | 三役全員`ACCEPT`、blocker 0件 | `bd1fd19` / push済み |

## Review Log

| 対象 | Reviewer | 結果 | 採否と対応 |
| --- | --- | --- | --- |
| implementation goal | goal 作成時の独立 reviewer | ACCEPT | 指摘を収束済み。実装指示の正本として採用した |
| Implementation Matrix 初回 | Hypatia (`019f51dd-7ae2-7560-b20e-245a5e4f2d86`) | CHANGES REQUIRED | candidate/final selection 分割、runtime materialization/registry/capability、store migration、dependency inversion、acceptance owner、package 別 public API、VG01 観測条件をすべて採用した |
| Implementation Matrix 2回目 | Fermat (`019f51eb-7486-78c1-8511-857b82d585ce`) | CHANGES REQUIRED | ST01 の最終依存、producer-owned internal export、A13/A26/A33/A40/A43 の owner と evidence、再開情報を修正した |
| Implementation Matrix 3回目 | Peirce (`019f51f5-61ab-79b3-9b70-028cffe3b506`) | ACCEPT | 実質的な不足なし。59 row と A01〜A44 の実装・検証計画を確定した |
| VG01 初回 | Aristotle (`019f5215-c14f-7ac2-b741-0e481550f7ff`) | CHANGES REQUIRED | E2E harness の明示 teardown、startup failure cleanup、動的 preview log、vanilla failure diagnostics を採用した。Nuxt の no-op tree-shaking barrier は削除し、Vue JSX plugin の PURE 対象から Dathra API を除外した |
| VG01 2回目 | Epicurus (`019f5224-2ee9-7510-b7f0-ea7ef0b161f2`) | CHANGES REQUIRED | E2E と Nuxt の readiness request に wall-clock deadline を追加した。E2E は cleanup 中 state の再取得を待機させ、Nuxt は SIGKILL 後の未終了と複数 cleanup failure を報告するようにした |
| VG01 3回目 | Volta (`019f5230-d95b-7b20-a374-461da6026706`) | CHANGES REQUIRED | vanilla の未到達 demo に残っていた旧 `Signal.update()` を現行 API へ移行し、runtime API と FC の production interaction を Chromium gate に追加した。docs と playground の `.update()` 残存が 0 件であることを確認した |
| VG01 4回目 | Boyle (`019f523a-1682-7ca2-839a-4da76ca0579a`) | CHANGES REQUIRED | E2E build を harness の unmanaged child から package `test` script の前段へ移した。production build は一度だけ実行され、各 test file は preview と browser だけを所有して明示的に解放する |
| VG01 5回目 | Hilbert (`019f5240-f9b5-79e3-8523-3551bbebfe23`) | ACCEPT | 実質的な問題は残っていない。VG01 の全要件、既往リスク、tracked/untracked 差分、lockfile の変更範囲を確定した |
| ID01 初回 | Kierkegaard (`019f525f-03b5-7da2-aa37-86fc578aac96`) | CHANGES REQUIRED | `Uint8Array.from()` が overridable iterator を実行する問題、qualified input の field 再読と accessor 実行、non-zero pad bit test の不足を採用した。SPEC と失敗 test を先に追加し、intrinsic typed-array copy、closed descriptor snapshot、同長 invalid vector へ修正した |
| ID01 2回目 | Heisenberg (`019f526c-208a-7591-995c-ed105f435ee9`) | ACCEPT | 初回3件の根本解消、JCS、digest pad bit、domain separation、typed failure、public export、browser-compatible artifact を確認した。残余リスクは契約外の Proxy と cross-engine smoke test に限定される |
| SC01 前提調査 | Plato (`019f5273-c284-7043-a6b3-eb435c8df012`) | CHANGES REQUIRED | identity domain、flat projection owner、canonical order、digest型、requirement意味、descriptor/executable境界、artifact順序の未決定を検出した |
| SC01 projection | Euler (`019f5277-ddaf-7743-b2fd-7513f91422ab`) | DESIGN CHANGE REQUIRED | flat binding arrayがownerを失うことを確認し、owner-grouped projection `/2` を採用した |
| SC01 design 初回 | Averroes (`019f527f-0c37-7531-ac5a-d50c6f8d1691`) | CHANGES REQUIRED | empty target group、requirement activation、source-local由来のruntime過剰保証、remote deployment closureを修正した |
| SC01 design 2回目 | Mencius (`019f5286-9578-7e03-af6d-99de3d42507a`) | CHANGES REQUIRED | projectionにactive requirementを追加し、dependency先ownerのrequired roleまでfinite fixed pointで閉じるようにした |
| SC01 design 3回目 | Wegener (`019f528c-9261-7970-bac6-19e97c80f3cf`) | CHANGES REQUIRED | arbitrary seedと不完全catalogを拒否するため、definition seedとenvironment catalogからprojectionを再計算する契約へ変更した |
| SC01 design 4回目 | Banach (`019f5294-42a0-7792-94c6-72bc4ddfec11`) | CHANGES REQUIRED | catalogのexact owner/record、remote seed限定、implementation一意性、SC03とAF01のartifact責務、projection self digestを修正した |
| SC01 design 5回目 | Turing (`019f52a7-91bb-7972-86b1-7d3a1eea47e6`) | CHANGES REQUIRED | global universeと`U_E`を分離し、全record exact projection、build pair validationとruntime local validationの境界を固定した |
| SC01 design 6回目 | Faraday (`019f52ab-c66c-7680-8999-c2b2e9589ead`) | CHANGES REQUIRED | deployment、protocol catalog、pair commitmentのdigest生成順に残った循環を除去した |
| SC01 design 7回目 | Euclid (`019f52ad-f5bc-77c3-8682-0f61a65c2106`) | ACCEPT | qualified descriptorからmanifest/planまでの生成 DAG、catalog completeness、seed、fixed point、artifact ordering、cross-environment boundaryにblocking findingがないことを確認した |
| SC01 actual diff 初回 | Hume (`019f52b5-1e2f-7332-bbfa-4e4f9f90090f`) | CHANGES REQUIRED | protocol catalog schema、symbolic/final artifact ordering、runtime local validation、deployment equality、A14 ownerを正本へ転記した |
| SC01 actual diff 2回目 | Lorentz (`019f52bc-bfb6-7ea1-8faa-afc64bfb9f63`) | CHANGES REQUIRED | endpoint identity導出、environment catalog入力、4 catalog digest、record別self digest、seed/template canonical tupleを追加した |
| SC01 actual diff 3回目 | Zeno (`019f52c4-4e24-7ce3-ae94-435bba71e049`) | CHANGES REQUIRED | candidate coreをAF01へ移し、protocol/catalog順、required role、seed重複、self digest fieldを修正した |
| SC01 actual diff 全文 | Carver (`019f52d1-3f01-7f32-a5f9-5835b31eac05`) | CHANGES REQUIRED | runtime brand、distributive role union、protocol-owned endpoint-handler relation、stale責務文、進捗状態を修正した |
| SC01 actual diff 型閉包 | Gibbs (`019f52e1-d492-7e80-9098-22b92afe19d8`) | CHANGES REQUIRED | role locationを25個の完全なliteral tupleへ展開し、残っていたdigest/qualified IDのbrand漏れと再開スコープを修正した |
| SC01 actual diff 最終精査 | Franklin (`019f52ee-aa86-7283-b5c0-2bc9abffaa23`) | CHANGES REQUIRED | `RealizationWitnessPreimage.targetHostProfileId`をqualified IDへ変更し、selection domainとenvironment catalogへの所属を必須にした。8個のtargeted probeと14個のTypeScript block結合はstrict diagnostics 0だった |
| SC01 actual diff 最終 | Linnaeus (`019f52f7-4b4a-7500-bf0e-152e620e1a10`) | ACCEPT | 前回指摘の解消、14個のTypeScript block、targeted probe、digest DAG、責務分担、進捗台帳、actual diff全文にblocking findingがないことを確認した |
| SC01 implementation 初回 | Nash (`019f5313-fd73-7383-8f0b-d9d56ed70052`) | CHANGES REQUIRED | `array-each` と `single-attempt` の extra field を拒否し、codec property path の empty key と empty root path を受理する回帰 test を追加した |
| SC01 implementation 2回目 | Lagrange (`019f531e-3ce5-72c0-be70-4c2515933598`) | CHANGES REQUIRED | selected protocol の browser/server seed 対応と、remote transport/endpoint から両 environment の host-profile validator への exact dependency closure を追加した |
| SC01 implementation 3回目 | James (`019f5328-0697-7c91-b1d0-2fe21ebd654e`) | ACCEPT | 既往4 finding の解消と current diff の closed schema、catalog、protocol、fixed-point、snapshot、public API にblocking findingがないことを確認した。後続 integration はSC03・AF01・RR01が担当する |
| OC01 前提調査 | Galileo (`019f532f-93cc-7b32-a981-43a25ff5ed66`) | CHANGES REQUIRED | binding ID、trace schema、order semantics、proof evidence、parser profile、witness coverage、constraint-qualified reference の未定義を検出した |
| OC01 API/algorithm 調査 | Mendel (`019f532f-949b-71d0-bbfe-8042de5ca92f`) | CHANGES REQUIRED | concrete trace、canonical comparison、composition result、witness validation context を明文化しなければ A03 を判定不能と確認した |
| OC01 proposal 初回 | Sartre (`019f5339-f357-76c1-92f0-57202f91268f`) | CHANGES REQUIRED | 一回の trace で trace 集合の cardinality を証明していた問題、claim replay、片方向 order 検査、composition result、atomic realization、後続 slice の責務を修正した |
| OC01 proof boundary | Harvey (`019f533c-555d-7c11-ac6d-b21ba47b6f1e`) | CHANGES REQUIRED | proof acceptance を `(proofDomainId, claimDigest, attestationDigest)` に束縛し、witness と deployment/final bytes の sidecar を分離した |
| OC01 proposal 2回目 | Curie (`019f5348-2cc2-7731-9eb3-9fcba4414ebd`) | CHANGES REQUIRED | symbolic DAG が分岐と相関を失うため canonical automaton へ変更し、composition algebra、instance witness、exact-byte reproduction を追加した |
| OC01 proposal 3回目 | Nietzsche (`019f5350-1411-7043-8c7c-c7bc034b0c32`) | CHANGES REQUIRED | projection equality だけで rule 適合を証明していない点、同 label occurrence の identity 消失、token と raw bytes の混同を修正した |
| OC01 proposal 最終 | Ampere (`019f5353-5149-7251-9c2a-b634a2f608c1`) | ACCEPT | rule-derived allowed relation への language inclusion、ordinal slot identity、raw exact bytes と parser profile の再処理が既往 finding を根本解消し、新しい blocking finding がないことを確認した |
| OC01 actual diff 初回 | Beauvoir (`019f5365-45bc-7771-8f63-28387437dcd8`) | CHANGES REQUIRED | WitnessTemplate に obligation 実体と sequence language を所有させ、concrete claim から template への参照を追加した。reproduction producer を AF01 に統一し、SL01 は witness/sidecar binding に限定した |
| OC01 actual diff 2回目 | Darwin (`019f5369-d5d9-75c2-877a-b5442e1403c5`) | ACCEPT | WitnessTemplate の参照閉包と AF01/SL01 の producer/consumer 境界を含む actual document diff に blocking finding がないことを確認した |
| OC01 implementation soundness 初回 | Gauss (`019f538b-733c-73c3-9ba5-224a3ef473b7`) | CHANGES REQUIRED | contractを受けないDFA、callerが選べるallowed relation、trusted IDと偽preimageの付替え、未検証AcceptedRelation、composition algebra入力不足、coverage closure不在、symbolic/concrete token断絶、混在DSD provenanceの8 blockerを採用した。既存15 test成功だけでは完了にしない |
| OC01 superseding proposal 初回 | Planck (`019f539b-1e28-7f42-9c98-4ed400a064ea`) | CHANGES REQUIRED | input partition実体、caller-selected allowed IDの完全削除、closure-validating accept API、independent result contract、coverage/witness直接bindingを採用した |
| OC01 superseding proposal 2回目 | Singer (`019f539c-5173-7ed1-95ca-eabca159b191`) | CHANGES REQUIRED | input selectorの全域性と排他性、constraint-qualified local mapping、policy proof DAGの非巡回性を追加した。独立trace-equality result contractは条件付きで妥当と確認した |
| OC01 superseding proposal 3回目 | Jason (`019f539e-2ea5-7ad1-be6f-6b7b4e56397b`) | ACCEPT | universe partition、local mapping closure、policy DAG、result contractの非自己参照を含む修正版に既知blockerと隠れた入力がないことを確認した |
| OC01 superseding actual diff 初回 | Maxwell (`019f53a1-7ad6-7090-9289-11befcdbd9f8`) | CHANGES REQUIRED | 旧Accepted proof履歴を復元し、input language schema/API、RuleApplication/CompositionClaim successor schema、SequenceClaim `/2` と完全なWitness `/3`を追加した |
| OC01 superseding actual diff 2回目 | Lovelace (`019f53a5-2ad8-7b50-b38d-0480e4adb1a6`) | ACCEPT | 旧`RealizationStep` `/1`と新`RealizationStepV2` `/2`の分離を修正後、既往findingと新規blocking findingがないことを確認した |
| OC01 composition policy cycle 初回 | Schrodinger (`019f53ca-6afd-70a3-b9e0-6f17599810b0`) | CHANGES REQUIRED | digest cycle の実在と structural binding 分離を確認した。policy application を composition-global ではなく input-class-local にし、composition/class/language replay closure、derivation claim ID、upstream-only attestation、exactly-one 全単射を追加する指摘を採用した |
| OC01 composition policy cycle 2回目 | Dewey (`019f53cf-e6f6-7b52-aef9-2eb371b46562`) | CHANGES REQUIRED | exact binding ID だけでなく tape/constraint/result mapping の binding-locality、immutable policy rule-graph digest、attestation責務の明示、CompositionClaimから独立した`A`導出を追加した。policy applicationをacceptanceより上流へ移す案を採用した |
| OC01 policy attestation 境界 | Arendt (`019f53d4-1511-7462-ab4c-fb9657f1fe3a`) | 条件付き ACCEPT | `ObservationProofAcceptance/1` の維持は妥当。OC01はtyped explicit reference DAGだけを保証し、opaque attestationのtransitive upstream-only検証とbranded trust admissionはSC03/RR01のverifier責務・acceptance evidenceとして追加する。汎用dependency配列は採用しない |
| OC01 composition policy cycle 最終 | Archimedes (`019f53de-7bd1-7751-9c3e-863b2cccb5b9`) | ACCEPT | structural binding、immutable policy requirement、class-local application/claim/acceptance closure、binding-local symbol検証、claim非依存`A`導出、SC03/RR01 attestation責務を含む最終proposalにblocking findingがないことを確認した |
| OC01 coalescing policy identity | Pauli (`019f5400-7a87-77a1-8546-bceb228e00a9`) | CHANGES REQUIRED | qualified ID だけでは version、rule graph、proof domain の差し替えを防げないため、constraint に immutable requirement 全体を持たせ、application の重複 string を削除する案を採用した |
| OC01 implementation 再監査 | Dalton (`019f53fa-ea8d-7441-94c6-4172b5ad41b2`) | CHANGES REQUIRED | coalescing の rule 外 symbol、同一 claim の複数 trusted acceptance、duplicate application、proof/equality input type の export 不足をすべて採用し、SPEC、失敗 test、実装へ反映した |
| OC01 implementation 最終監査試行 | Parfit (`019f540a-2b3a-7242-bf95-1d7c602be804`) | REVIEW INCOMPLETE | 確認済み範囲の新規 blocker は0件だが全経路を照合できず、ACCEPT として採用しない。公開typeの修正だけは確認済み |
| OC01 implementation focused 再監査 | Raman (`019f540d-1d7a-79e2-8e9e-4f8cb49a200a`) | CHANGES REQUIRED | commutative application がない claim の任意 composition ID が受理される bypass を採用した。composition ID を application/context の有無と iff で束縛する失敗 test と検証を追加した |
| OC01 implementation focused 最終 | Cicero (`019f5412-8515-7f40-bdc4-9b3dcf3b4818`) | ACCEPT | immutable coalescing requirement、target-local symbol、unique trust、duplicate拒否、public type、commutative context、relation contract/class、composition ID iff を確認した。observation 23 test と shared typecheck も成功した |
| SC02A2 initial correctness | Pasteur (`019f55b3-24f7-7883-a28a-dec4769ad92d`) | REJECT | `ordinal?: never`が`exactOptionalPropertyTypes`無効時に`ordinal: undefined`を受理すること、closed unionと8 relation edge fixtureが片方向であることを採用した |
| SC02A2 initial SPEC/test | Fermat (`019f55b3-2b88-7551-be1f-550d8ff0534f`) | REJECT | ordinal field不在と`undefined`拒否、全relation endpointとclosed enumの双方向fixture、SPEC目的文の更新を採用した。10 registry collection fixtureは分割後のSC02A3へ移した |
| SC02A2 initial goal/granularity | Rawls (`019f55b3-3225-7200-80f5-77c86c3b6421`) | REJECT | semantic taxonomyとsource envelopeが独立してgreenになるscope blockerを採用し、SC02A2とSC02A3へ別revisionとして分割した |
| SC02A2 subject correctness | Parfit (`019f55cc-92e7-7f23-9799-e476b4710174`) | ACCEPT | 7 subject、3 path、variant shape、sequence、type-only facade、後続API不在、独立greenにblocking findingなしと確認した |
| SC02A2 subject SPEC/test | Sagan (`019f55cc-94ac-7603-bd0c-d91e6babacab`) | REJECT | SPEC未規定のKind alias公開と、TransferBindingおよびExecutionContractSourceのtype-only不在fixture不足を採用した |
| SC02A2 subject final goal | Euclid (`019f55cc-98d8-7ea1-9243-1c7a2884e3dc`) | REJECT | nested parameter内の複数callbackを一意にできないschema blockerとTransferBinding境界fixture不足を採用した。path追加はAccepted designを変えるためSC02A2-CBPATH-R1へ分離してdesign reviewする |
| MP01-DK-R1 contract/granularity | Boole (`019f55b3-38bb-7ca0-8118-d87abc62152d`) | REJECT | taxonomy/disposition/carrierとTransferBinding/trust/registry bridgeのscope分割、atomic step discriminant、全kind共通trust gate、exact SC01 entry/version/remote role closureを採用した |
| MP01-DK-R1 feasibility | Kepler (`019f55b3-4002-7070-96b2-958238dc9379`) | REJECT | inlineをrequest-specific carrier不要だがemissionありと定義し、candidate legality、projection導出順、owner別diagnosticをtaxonomy unitから除外する指摘を採用した |
| MP01-DK-R1 final goal | Singer (`019f55b3-49bf-7c02-8f52-e2e5146d2ef9`) | REJECT | kindをrepeatable atomic stepとし、inline/target-nativeを排他的に定義し、TransferBindingを未信頼なcandidate constraint、SC01 closureをexact role/version/protocol bindingとする指摘を採用した |
| RC01-A-R1 identity/authority | Archimedes (`019f55a9-b132-7a00-94a0-cea7e64a27a7`) | REJECT | RenderDefinitionとRenderEnvelopeのscope分割、generation identityの独立前提、referent resolution、authority operation/generation/epoch binding、error変換を採用した |
| RC01-A-R1 final goal | Curie (`019f55a9-b7f4-7ca3-9c92-a09012a685f2`) | REJECT | RenderDefinitionとRenderEnvelopeのscope分割、generic digestからactual outputへのdomain-specific closure、RR01/SR02責務分離、generation契約の先行を採用した |
| RC01-A-R1 feasibility | Peirce (`019f55a9-c09e-7031-8e84-d8a223bdb21d`) | REVIEW INCOMPLETE | sessionがresultを返さず`not_found`になった。二件の独立した根拠とmain sessionの照合でscope blockerを採用し、combined revisionを破棄した |
| AR01-I-R1 initial review | Confucius、Dewey、Ramanujan | REVIEW INCOMPLETE | 三sessionがresultを返さず`not_found`になった。旧combined proposalを採用せず、preimage source domainをAR01-P-R1として新revisionへ分けた |
| AR01-P-R1 identity | Aristotle (`019f55c7-354d-7351-9afa-c53f014fb733`) | REJECT | nominal subtypeの片方向保証、collection一意性、SCC collapse後のdependency DAG前提を指摘した。identity保証の表現はAR01-IDへ、canonical ruleとDAG前提は後続P/Vへ分ける |
| AR01-P-R1 feasibility | Carson (`019f55c7-3692-7033-bd2d-c637e71d09fa`) | REJECT | source type unitへcanonical validatorとURL受理規則が混入したblockerを採用した。structural typeのextra-field保証、semantic ID provenance、artifact owner分離を後続前提へ記録する |
| AR01-P-R1 final goal/granularity | Turing (`019f55c7-38ab-76e0-a3f3-98bde72dd5d8`) | REJECT | nominal domainとsource schemaが独立してgreenになるscope blockerを採用した。combined proposalは一括修正せず、AR01-IDとAR01-Pの別revisionへ分割する |
| MP01-DK1-R1 contract | Noether (`019f55c1-2bc7-7cc1-bdd0-ad75c9ce991e`) | REJECT | server-onlyとno-transferの混同、snapshot/subscriptionのjoint consistency owner、target-native/codec/remoteの重複を採用した。protocol operationはtaxonomyから除外する |
| MP01-DK1-R1 feasibility | Galileo (`019f55c1-2cd0-78b1-86a3-e7e39f3d7158`) | REJECT | step/DAG semanticsをtype-only unitで証明できないことと、root未到達artifact inspectionが空証明になることを採用した。typecheckとtype-only consumer inspectionへ限定する |
| MP01-DK1-R1 goal/granularity | Bacon (`019f55c1-2f2a-7d90-9f85-b320d5f84f64`) | REJECT | taxonomy、server-only disposition、graph-table carrierが独立してgreenになるscope blockerを採用した。MP01-DK1-Tを7 literalのmechanism taxonomyだけの新revisionへ分割した |
| SC02A2 slice-local convergence | McClintock (`019f55fa-d4ca-7461-843c-b5d56b81b88e`) | ACCEPT | required callback path、static slot identity、SC02A/SC03/runtime owner、後続type boundary、SPEC/test/model/facadeに新規blockerがないことを固定manifestで確認した |
| AR01-ID design convergence | Descartes (`019f55fd-d326-73b0-85f3-3040bfde4678`) | ACCEPT | 一方向assignability、distinct brand、type/AST/emit検証、root owner、preimageとidentity operationの後続分離にdesign blockerがないことを確認した |
| AR01-ID implementation correctness | Beauvoir (`019f5601-36b1-7553-b4f5-e7f7b93d5f3c`) | ACCEPT | private mandatory brand、一方向assignability、distinct brand、non-vacuous negative fixture、runtime-empty emit、root非公開を確認した |
| AR01-ID implementation SPEC/artifact | Lorentz (`019f5602-a980-7060-877e-b15fdb1a8975`) | ACCEPT | SPEC/test/model/facade、exact AST export、memory emit、build declaration、JSDoc、変更範囲にblockerがないことを確認した |
| AR01-ID implementation goal/boundary | Arendt (`019f5603-4f52-77e2-8b16-a9c2857be7c3`) | ACCEPT | type-only foundationがruntimeを増やさず、provenance、integrity、closureを後続ownerへ維持し、独立して有用であることを確認した |
| RC01-DI-R4 contract | Carver (`019f55f9-4d4a-73c1-abc2-7e2620b4b0c0`) | REJECT | nested record discovery前にoperation total key countを確定できないことと、budget違反同士の順序未定義を採用した |
| RC01-DI-R4 feasibility | Newton (`019f55f9-4e98-71b3-99ca-5f646ab7284b`) | REJECT | ancestor descriptorなしにnested total capを課金できず、object identityとschema occurrenceの区別も必要と確認した |
| RC01-DI-R4 goal/granularity | Wegener (`019f55f9-5094-7953-b35f-94440732c6b0`) | REJECT | prototype検査をownKeysより先に置き、record-local cap後にdescriptorを読む実装可能な順序へ変更する指摘を採用した |
| MP01-DK1-T slice-local convergence | Godel (`019f55fd-9a85-7790-9eac-d5f06ca7570a`) | ACCEPT | native closureを証明しない境界、7 literal taxonomy、exact facade AST、type-only emit、root非公開にblockerがないことを確認した |
| RC01-DI-R5 convergence | Franklin (`019f55ff-961d-71d2-9d1d-af8ec8897420`) | ACCEPT | per-record cap、object identity cache、descriptor discovery、deterministic budget order、Proxy契約外境界、server-first impactに新規blockerがないことを確認した |
| AR01-ID / RC01-DI design integration初回 | Epicurus (`019f5608-ad71-77c3-be5d-5b64887ea5b1`) | REJECT | failure mapping、resource wording、owner/server-first境界、referent trust boundary、brand authorityの転記不足を採用し、固定済み決定だけを設計正本へ補った |
| SC02A3 R1 goal/boundary | Mill (`019f560f-51ce-73d3-b4c6-31d784199b16`) | REJECT | root非公開fixtureのowner comment 5件がSC02A13へ誤帰属していたため、AS01へ修正しSPECにもownerを明記した。それ以外のcontract blockerはなかった |
| SC02A3 R1 correctness / SPEC | Volta、Archimedes | REVIEW INVALID | owner blockerの修正でmanifest記載fileが変わるため、安全に停止して判定へ含めなかった |
| AR01-ID / RC01-DI design integration収束 | Dirac (`019f560f-58ef-7d21-8d3a-4ccd11330330`) | REJECT | 5 blocker中4件は解消した。generic wrong-primitive rowがdigest固有rowと重なる一件だけを採用し、schema/role違反へ限定した |
| AR01-FT-R1 design review | Ramanujan、Hilbert | REVIEW INVALID | 固定proposalがreview中に別laneから変更されたため、二者とも判定を発行せず停止した。変更内容を保持して必須proposal項目を補いR2へ固定した |
| AR01-ID / RC01-DI failure mapping targeted recheck | Dirac (`019f560f-58ef-7d21-8d3a-4ccd11330330`) | RESOLVED | generic rowを削除し、schema/roleは`invalid-field`、creator/nested digestは`invalid-reference`、wrapper IDは`invalid-field`へ一意に分類したことを固定excerptで確認した |
| SC02A3 R2 correctness | Euclid (`019f5614-8800-7e12-b3a6-3e263fb6019b`) | ACCEPT | 16 fact、6 binding、全field、RegistryId domain、AS01 owner、type-only facadeにblockerがないことを確認した |
| SC02A3 R2 SPEC/artifact | Bohr (`019f5614-82df-7fb3-aeb4-de1e463d4293`) | REJECT | facade AST/emit fixtureがdirect type exportとruntime statementを見逃すfalse-negativeを採用し、全statementとemitをexactに固定した |
| SC02A3 R2 goal/boundary | Aristotle (`019f5614-8442-7531-908a-86499f569cb7`) | ACCEPT | source-local、attribute-only、callback path、AS01 owner、runtime/client/root非追加にblockerがないことを確認した |
| AR01-FT-R2 contract/granularity | Copernicus (`019f5616-eb12-7d41-b97b-468e0068635e`) | ACCEPT | 10-field closed product、field semantics、owner分離、単独green、後続sort tupleをfollow-upとして確認した |
| AR01-FT-R2 feasibility/final goal | James (`019f5616-e9b4-7113-81f0-7e1e44c8711d`) | ACCEPT | type-only feasibility、runtime edge不在、server-first適合を確認した。runtime closed record、cross-field legality、exact-byte algorithm、stable diagnosticを後続validator/finalizer obligationとして記録した |
| AR01-FT implementation correctness | Beauvoir (`019f5627-d809-7093-b5dc-feb292b33066`) | ACCEPT | exact keys、property、modifier、nominal predecessor、runtime-empty emit、package boundaryにblockerがないことを確認した |
| AR01-FT implementation SPEC/artifact | Fermat (`019f5627-dae8-7aa0-991b-8dfd27db7329`) | REJECT | build entry mutationで生成declarationから型が公開されてもfocused testが通るfixture holeを採用した。named integrity table negative fixtureとfacade export orderはfollow-upとした |
| AR01-FT implementation final goal | Mendel (`019f5627-d6ad-7f12-adfb-56f256298cb4`) | ACCEPT | type-only schemaがruntime/client edgeを作らず、後続ownerとAS01 publicationを維持することを確認した |
| AR01-FT declaration boundary convergence | Hubble (`019f5637-0f8f-7ff0-9573-c1a034026a2f`) | ACCEPT | temporary build、両declaration export、mutation rejection、全terminal pathのcleanupを確認し、R2 blockerの解消と新規blocker不在を確認した |
| SC02A3 R3 convergence | Kant (`019f561c-e251-7f40-8b9c-e860d924d837`) | ACCEPT | exact facade statement inventoryとemit equalityがdirect type exportおよびruntime statementのsynthetic mutationを拒否することを確認した |
| RC01-DI1 R1 correctness | Harvey (`019f5618-9ca4-79a1-8442-da365311f084`) | REJECT | private brandのexport modifierとerror fieldのrequired、readonly、exact typeを既存fixtureが保証しない二blockerを採用した |
| RC01-DI1 R1 SPEC/artifact | Aquinas (`019f5618-9b90-7e11-852d-4e5a60e58221`) | REVIEW INVALID | manifest-listed fixture変更前に停止したため判定へ含めず、R2で通常人数の初期reviewを再実行する |
| RC01-DI1 R1 goal/boundary | Popper (`019f5618-9f6f-7621-9cae-5c762038ee29`) | ACCEPT | untrusted claim、brand authority、後続owner、root/client非追加にblockerがないことを確認した |
| PROCESS-SLICE-LOCAL R1 correctness | Hooke (`019f561c-e372-7043-8a0a-9dd2662c5426`) | REJECT | atomic result/commit binding、review中ownership、完全な固定入力とdecision anchorの不足を採用した |
| PROCESS-SLICE-LOCAL R1 usability | Dewey (`019f561c-e627-7252-a3a6-503424f60b13`) | REJECT | implementation goalの無効化条件、decision source再抽出、初期role coverage、進捗owner不一致を採用した |
| MP01-DK2 owner integration | Singer (`019f5646-4c0c-7010-9542-e240be3d699c`) | ACCEPT | shared bridgeを追加せず、SC01からRR01までのqualification、candidate legality、finalization、selection、runtime conformance ownerが設計正本へ漏れなく転記されたことを確認した |
| SC02A4 R1 correctness | Euler | ACCEPT | 8 relation union、endpoint type、ordinal exclusivity、type-only facadeにcorrectness blockerがないことを確認した |
| SC02A4 R1 SPEC | Banach | REJECT | `feature_spec`が正準macroに存在しない`description`と`validation`引数を使うblockerを採用した |
| SC02A4 R1 goal/boundary | Ampere | REJECT | SC02A2とSC02A3の累積SPECにrelation/endpoint API不在というstale制約が残るblockerを採用した。R1 snapshot test総数の記録も216へ訂正した |
| SC02A4 R2 convergence | Newton (`019f564c-12e3-77e2-bddc-f9714d0ae6e1`) | ACCEPT | stale不在制約とmacro引数の修正、SC02A1からSC02A4の意味保持、固定31 focused/217 shared testsを確認し、残存blockerなしと判定した |
| RC01-DI1 post-commit correctness | Plato (`019f5656-0168-7d00-8e54-843a1640670f`) | ACCEPT | private brand、4 claim、preimage/definition/input、6 error code、immutable field、R1 mutation fixture、boundary外API不在をexact commitで確認した |
| RC01-DI1 post-commit SPEC/artifact | Gauss (`019f5656-27f3-7263-b19e-3f623354c4d4`) | ACCEPT | SPEC/test/model/error/facade、runtime emit、root declaration非公開、focused 10 testsとpackage gateをisolated exact commitで確認した |
| RC01-DI1 post-commit goal/boundary | Hooke (`019f5656-5d07-7d53-ad9b-98160674382d`) | ACCEPT | DI2/DI3、RR01、SR02、envelope ownerを先取りせず、client edge、hydration、fallbackを追加しないtype-only foundationであることを確認した |
| SC02A5 R1 correctness | Harvey (`019f5666-8067-7300-a0d6-20c4840947d0`) | ACCEPT | exact five-field type-only schema、non-vacuous mutation fixture、runtime-empty facade、後続責務不在を確認した |
| SC02A5 R1 SPEC/artifact | Heisenberg (`019f5666-53aa-73d0-addb-d8b8b1fbbfac`) | REJECT | 非正準`behavior_spec`引数とsource-level API ownerの不一致を採用し、declaration positive controlと`SPEC/functions.typ` dependencyもR2へ反映した |
| SC02A5 R1 goal/granularity | Copernicus (`019f5666-2d73-7483-884e-d82707876aa2`) | ACCEPT | fixed snapshotは15 files/224 testsであり、別laneを含む16/227 integration証拠と区別するfollow-upを採用した |
| SC02A5 R2 convergence | Cicero (`019f5674-d29a-7ee0-9471-5cc44b3cda25`) | ACCEPT | R1 blocker、positive declaration control、fixed evidence、11 dependency、10 blobを再照合し、新規blockerなしと判定した。削除数erratumだけをintegration recordへ残した |
| MP01-DR-S R1 contract | Lagrange (`019f5668-6c48-7a92-b759-ec85b89e546f`) | REJECT | state updateModeのauthoritative input、DV/DI trust chain、累積facade inventoryの不足を採用した |
| MP01-DR-S R1 feasibility | Hegel (`019f566b-1abd-7eb2-872a-3ae83bd81e9c`) | REJECT | DV/DI欠落、既存taxonomy削除、transformerからshared contractへの合法export経路不在を採用した |
| MP01-DR-S R1 goal/granularity | Huygens (`019f566b-6d00-7602-b607-78c49201c070`) | REJECT | state projection未決定とowner correction/exact schemaの過剰な束ね方を採用し、schemaを前提unit後へ延期した |
| MP01-DR-S R2 convergence | Russell (`019f5677-8f4a-7701-8d50-af226abd76fa`) | REJECT | emission publication不在、DM/DE直列化、DVのPL02-V再検証不足、state policy admission owner不在をR3 blockerとして採用した |
| MP01-DR-S R3 convergence | Epicurus (`019f5684-538c-7f93-b5eb-4220911aab17`) | REJECT | DAGのSC03-T/PL02-S/MP依存省略、raw claim closure前のequality、OC02-SI過大scopeをR4 blockerとして採用した |
| RC01-DI2A correctness/security | Archimedes (`019f567e-86fd-7b83-bdbd-7d89e89b99bf`) | ACCEPT | reflection順、hard limit、alias、mutation isolation、structural rejection、failure path、DI2B継続surfaceにcorrectness/security blockerがないことを確認した |
| RC01-DI2A SPEC/type/artifact | Boyle (`019f567e-88cd-7e80-a19f-6d1efb844680`) | ACCEPT | 正準SPEC macro、新Accepted ADR、exact internal type、DI1 blob不変、facade/root/build非公開、fixed gateを確認した |
| RC01-DI2A goal/granularity | Pauli (`019f567e-8ba1-7000-8752-16625404e979`) | ACCEPT | DI2A/DI2B分割、単独有用性、sanitized surface、server-first/client最小境界、admission上限にblockerがないことを確認した |
| SC02 facade fixture R2 convergence | Turing (`019f56eb-1a11-76f1-a0fa-2eda514c06ee`) | ACCEPT | future-owner negativeをcentral exact facade fixtureへ集約し、predecessorのmodel-local、permanent negative、root boundaryを維持した。fixed 5 filesと39 testsを確認し、blocker/follow-up 0件と判定した |
| MP01-DR-S R4 convergence | Laplace (`019f56eb-1904-7fb3-8699-03cd59894f33`) | ACCEPT | R1からR3のDAG、authority、raw closure、OC02粒度blockerが解消し、cycle、trust gap、premature schemaがないことを確認した。後続3 fixture obligationだけをfollow-upとした |
| MP01 R4 actual integration R1 | Herschel (`019f56f2-421e-7bf0-bb6a-82f38d35714a`) | REJECT | OC02-SD/ST/SV、compiler/author provenanceとconditional SC03-T、DVA parser-version checkの転記漏れ三群を採用した |
| MP01 R4 actual integration R2 | Gibbs (`019f56fc-177b-7591-b36a-fa4597ca9054`) | ACCEPT | 三つの転記漏れがaccepted R4から復元され、変更段落にowner driftまたは新規矛盾がないことを確認した |
| RC01-DI2B R2 ADR/publication convergence | Erdos (`019f56ff-d016-7ec3-892e-d8b5bd49235e`) | REJECT | publication fixtureは解消したが、R1 Accepted ADRの直接変更を履歴blockerとして採用した |
| RC01-DI2B R3 ADR-history targeted recheck | Chandrasekhar (`019f5707-fabc-77a3-b3bd-ca5d6d4ada29`) | ACCEPT | R1 ADRのbyte一致、新ADRだけのR5 supersession、DI2B/DI3 freeze ownerを確認し、blocker/follow-up 0件と判定した |
| SC02A6 low-tier primary | Dalton (`019f5704-8743-78e1-978c-067af73add04`) | ACCEPT | exact 10 collection mapping、SC01/SC02A7+/AS01 owner、正準SPEC、runtime-empty/root非公開を確認した。進捗表同期だけをfollow-upとした |
| AR01-DB R1 primary | Plato (`019f5709-d333-7663-b31a-a60aa23e4e6d`) | REJECT | finalization/entry feature specのstale累積facadeと、private kind aliasを見逃すinline-union fixture holeを採用した |
| AR01-DB R1 implementation | Pasteur (`019f5709-d435-77b2-8ac4-5600fd782844`) | ACCEPT | exact model、modifier fixture、facade/root/emit、isolated gateを確認し、後続validator/identityへの二follow-upだけを残した |
| AR01-DB R1 boundary | Dalton (`019f5709-d655-75e2-8707-8d3cdbb391f1`) | ACCEPT | persistent identity input、untrusted claim、AS01 root owner、client runtime非追加、後続責務分離を確認した |
| AR01-DB R2 convergence | Lovelace (`019f5713-fcf0-76e2-aff2-50a30f3240bb`) | ACCEPT | 4-model/5-type累積SPECとdirect inline-union AST fixtureが両blockerを解消し、変更2 blobに新規blockerがないことを確認した |
| RC01-DI3B R1 primary | `019f5816-2bad-7353-b05d-f56b4ddce054` | ACCEPT | strict parser、digest equality、brand authorityを確認し、authority call-site AST fixtureだけをfollow-upとした |
| RC01-DI3B R1 implementation | `019f5816-4e63-7c91-ade8-75db544a8ede` | ACCEPT | focused/shared gate、root/browser boundaryを確認し、AST fixtureとstale SPEC wordingをfollow-upとした |
| RC01-DI3B R1 boundary | `019f5816-6b61-7b11-96f8-d5e091879554` | ACCEPT | referent/trust/publicationを先取りしないself-digest parser境界を確認した |
| RC01-DI3B R2 convergence | `019f5823-d7a5-7e40-a498-d50a15c8ba74` | ACCEPT | ASTでauthority helperがcreator/parser各一回、parserではmismatch後であることとDI3A/DI3B wordingを確認した |
| SC02A8 boundary R1 三役 | `019f5811-9979-7b53-868f-f0cf8f770def`、`019f5811-bc08-7c81-84a3-2da0d5c24187`、`019f5811-d901-79c1-989a-c27c4c071ed6` | REJECT | depth、realm provenance、reflection identity、source profile、sort/downstream boundのblockerを採用した |
| SC02A8 boundary R2 convergence | `019f582a-afc5-7441-ba39-93607dcfbd3c` | ACCEPT | peak depth、observable prototype、distinct reflection、occurrence alias、two-stage profile、A12 freeze、7-way splitを確認した |
| SC02A8 canonical R2 convergence | `019f5833-304e-7761-b47d-4c3980b84fc1` | REJECT | active-path scratch underbound、host/GC 3-representation保証、shared alias fixture欠落を採用した |
| SC02A8 canonical R3 targeted | `019f583a-228f-7780-ab37-ae41486cb603` | ACCEPT | property-cap scratch、host storage big-O、occurrence alias measurementが三blockerを解消したことを確認した |
| AR01-DP/P R1 三役 | `019f581a-7dc0-7780-976d-f02eb07fabd6`、`019f581a-9e49-7453-adec-52a753c5b071`、`019f581a-d238-79d0-b7e3-e2e799ac5e58` | REJECT | historical binding、private branded JCS fixture、DeploymentIdentity pipeline、AR01/AF01/CN01-L/SL01/RR01 owner、line estimateを採用した |
| AR01-DP R2 convergence | `019f582d-f134-73f3-a5e6-a26cf52123f6` | REJECT | AF01をselected candidateへ依存させた逆順をblockerとし、RR01 target明記をfollow-upとした |
| AR01-DP R3 targeted | `019f5832-7f08-7b00-8a32-db302739f7c2` | ACCEPT | candidateごとのAF01 finalization後にSL01 selectionを行う順序とRR01検証対象を確認した |
| AR01-P R2 convergence | `019f5837-08dd-7241-809e-9c4297e927f5` | REJECT | RR01がgeneric AF01 evidenceを受けてSL01を迂回できるowner blockerを採用した |
| AR01-P R3 targeted | `019f583c-9da2-7c33-9027-58eb1f2c12d5` | ACCEPT | RR01をSL01-selected AF01 evidenceだけへ限定し、candidate/artifact/URL fallbackがないことを確認した |
| ID01-CB R1 primary | `019f585e-4fc8-7f42-9a9f-0e0a9f476d46` | REJECT | parent path配列copyによる二次計算量とfailure path materialization不足を採用した |
| ID01-CB R1 implementation | `019f585e-50c8-7830-af1a-c8b8ac9b396b` | REJECT | array sparse pre-scanのerror precedence変更と深い入力へのboundedness不足を採用した |
| ID01-CB R1 boundary | `019f585e-52fa-7751-a85f-974c41b04202` | REJECT | array descriptorがactive scratch accountingから漏れるblockerを採用した |
| ID01-CB R2 convergence | `019f5866-92a3-7bf2-b1ff-c7f4f107fd59` | REJECT | runtime blocker解消を確認したが、Accepted ADRの直接変更を履歴blockerとして採用した |
| ID01-CB R3 targeted | `019f586a-868d-7733-ad78-e5e58c9f8d53` | ACCEPT | R1 ADRのbyte-identical復元と継承ADRだけによる訂正を確認した |
| AR01-DP R1 primary | `019f586a-87a8-74f2-a441-c773d86de644` | ACCEPT | exact 7-field schema、generic digest、type-only facadeにblockerがないことを確認した |
| AR01-DP R1 implementation | `019f586a-896c-7a21-8d66-b17276c2d3e2` | ACCEPT | type fixture、runtime-empty emit、focused/full gateを確認した |
| AR01-DP R1 boundary | `019f586a-8b98-7a93-b721-ef4c4e0f2994` | ACCEPT | validation、identity、trust、publicationを先取りしない境界を確認した |
| AR01-DP current-base integration | `019f5870-1ddc-7b11-9999-8a1de77f6a24` | ACCEPT | ID01-CB後も8 write-set blobが同一で、依存とgateが有効なことを確認した |
| SC02A8A R1 primary | `019f586a-8e51-7d30-ae5d-a015c4164ac3` | ACCEPT | budget contract、override、exact/-1、ledger isolationを確認した |
| SC02A8A R1 implementation | `019f586e-9aea-7f83-b030-36653d1845a4` | ACCEPT | correctness blockerなし。成功chargeごとのBigInt変換をperformance follow-upとした |
| SC02A8A R1 boundary | `019f586e-9c1e-7800-a286-6c1d1041bc44` | ACCEPT | descriptor/source/canonical責務を先取りしないoperation-local contractを確認した |
| SC02A8A R2 convergence | `019f5873-a8f9-7a91-9207-51206cc6fd46` | ACCEPT | success pathのnumber-only chargeとfailure時のexact BigInt attempted valueを確認した |
| PROCESS-PROGRESS-V4 primary | `019f587b-059d-7be2-82b5-7398d0fab81b` | ACCEPT | 完了OID、review/gate記録、state transition、SC02A8B/AR01-Pのdisjoint next pairを確認した |
| AR01-P R1 primary | `019f5887-5107-7e00-9abf-0eb7de1191c0` | REJECT | package `AGENTS.md`のaggregate非owner/7-type記述と8番目typeの矛盾を採用した |
| AR01-P R1 implementation | `019f5887-543d-73c1-b275-c3d8598fd8bb` | ACCEPT | exact type/AST/runtime-empty/gateを確認し、invalid-state witnessのnon-never明示をfollow-upとした |
| AR01-P R1 boundary | `019f5887-5203-7243-be3c-6f7637555567` | REJECT | primaryと同じstale package ownership/facade blockerを報告し、下流owner維持を要求した |
| AR01-P R2 convergence | `019f588d-8265-74f2-bf1d-b03d3498ac25` | ACCEPT | `AGENTS.md`のowner/8-type同期と二つのnon-never witness、2-file deltaにregressionがないことを確認した |
| SC02A8B R1 primary | `019f5891-503d-7482-9fd3-39599a4e9c49` | ACCEPT | two-phase contract、SPEC/test/implementation、alias/cache/path、internal boundary、admissionを確認した |
| SC02A8B R1 implementation | `019f5891-514e-7c32-b62b-6d5675e83394` | REJECT | mutable own-key iterator、`push`/inherited setterと成功descriptorごとのpath copyをblockerとして採用した |
| SC02A8B R1 boundary | `019f5891-5360-7960-bb60-5773c5c22803` | REJECT | 未課金の`O(property * depth)`成功path allocationを同一blockerとして採用した |
| SC02A8B R2 convergence | `019f589b-dd71-7312-9bcc-1fd2f1cffd5e` | ACCEPT | failure-only path、index traversal、own data property、reentrant failure保持、ADR履歴を確認した |
| SC02A8B R3 admission | `019f58a2-2c20-76c3-ae0f-8941ae759283` | ACCEPT | test helperが12 error pathを保持し、R2からtest blobだけ変更、1,482 additionsであることを確認した |
| SC02A8C R1 primary | `019f58ae-bcba-7112-9c05-610d639972d9` | REJECT | invalid leave後にactive setだけを破壊するmutationを検出できないfixture holeを採用した |
| SC02A8C R1 implementation | `019f58ae-bdc6-7302-9c3d-b9a22fde8b1f` | ACCEPT | state整合性、rollback、strict LIFO、path非保持、12,000 depth、internal boundaryを確認した |
| SC02A8C R1 boundary | `019f58ae-bff8-7551-ad33-95e773cad890` | ACCEPT | active-only cycle、operation isolation、authority/placement/client permission非追加、downstream owner分離を確認した |
| SC02A8C R2 convergence | `019f58b7-14bb-7f42-a264-0cb28327e593` | ACCEPT | invalid leave後のstill-active再enter assertionがactive-set deletion mutationを検出し、追加failureがstateを変えないことを確認した |
| AR01-E design R1 primary | `019f58bb-7a3e-7070-9b35-8c8a6d14d34d` | ACCEPT | exact ten-code taxonomy、AR01/AF01/RR01 owner、path/facade/root boundary、review-unit分割を確認した |
| AR01-E design R1 implementation | `019f58bb-7b84-71e2-9c95-c0bfdd5167b6` | ACCEPT | immutable runtime shape、testability、precedent接続、budget/parser非依存の独立greenを確認した |
| AR01-E canonical integration R1 | `019f58c2-d9bf-71a2-8d78-05413fa60e48` | REJECT | constructor signature欠落と`invalid-field`のclosed snapshot境界欠落をsemantic transfer blockerとして採用した |
| AR01-E canonical integration R2 convergence | `019f58c6-5e51-7fc2-b8a5-fc5b224ff387` | ACCEPT | exact constructor復元、invalid-field scope復元、AR01-E excerptの局所regression不在を確認した |

## Commit / Push Log

| Slice | Commit | Remote | 同期確認 |
| --- | --- | --- | --- |
| PLAN-00 | `8a0eedd` | `origin/feature/declarative-ui-execution-partitioning` | push 後に tracking branch と一致した |
| BASELINE-00 | `9cd4266` | `origin/feature/declarative-ui-execution-partitioning` | push 後に tracking branch と一致した |
| MATRIX-01 | `549e312` | `origin/feature/declarative-ui-execution-partitioning` | push 後に tracking branch と一致した |
| VG01 | `8fe6c60` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `8fe6c60cd2e4cab82b9785525a76e5f485148e95` で一致した |
| ID01 | `3816c34` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `3816c342ce203cbf5ddf5b91c67479c03e72a163` で一致した |
| SC01-DESIGN | `17591e5` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `17591e5d8d0d4f54501d12753353bf8887a70f6e` で一致した |
| SC01 | `da05b19` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `da05b191945df608e09a61d87538a7bf69ceca82` で一致した |
| OC01-DESIGN | `2900469` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `29004694c0f5a700825afe2d22e15e70ffe5f8f5` で一致した |
| OC01 | `86204da` | `origin/feature/declarative-ui-execution-partitioning` | implementation commit を完了記録 commit と同時に push し、tracking branch の履歴へ包含されることを確認する |
| SCHEDULER-RULE | `98585c9` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `98585c9c95bc1a02f71e26a764a67e9882519738` で一致した |
| SC02A1 | `d5d704a` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `d5d704a45ad9366c681547fe875549b272d40d87` で一致した |
| AR01-ID | `14edf91` | `origin/feature/declarative-ui-execution-partitioning` | package-local nominal domainをpushし、localとtracking branchがcommit時に一致した |
| AR01-ID-FACADE | `c147270` | `origin/feature/declarative-ui-execution-partitioning` | facade AST inspection修正をpushし、後続HEADから到達できる |
| SC02A2 | `7b22d0d` | `origin/feature/declarative-ui-execution-partitioning` | subject/path revisionをpushし、slice-local reviewの`ACCEPT`を回収した |
| MP01-DK1-T | `ff28849` | `origin/feature/declarative-ui-execution-partitioning` | taxonomy revisionをpushし、slice-local reviewの`ACCEPT`を回収した。localとtracking branchは`ff28849987a7d40d84e402b6d1accabea09129c7`で一致した |
| DESIGN-CONTRACT-INTEGRATION | `afcac4d` | `origin/feature/declarative-ui-execution-partitioning` | SC02A2、MP01、AR01-ID、RC01-DIの収束済みdecisionを設計正本へ統合し、localとtracking branchが`afcac4d39fc79650e7ca2292ac3cb827cccf5f0d`で一致した |
| SC02A3 | `43350db` | `origin/feature/declarative-ui-execution-partitioning` | source-local fact schemaをpushし、localとtracking branchが`43350db7088fa46e6e90f5db9a528b481f624da1`で一致した |
| PROCESS-IMMUTABLE-REVIEW | `f19c6dd` | `origin/feature/declarative-ui-execution-partitioning` | immutable synthetic review revision規則をpushし、後続HEADから到達できる |
| AR01-FT | `9cff8ed` | `origin/feature/declarative-ui-execution-partitioning` | package-local finalization template typeをpushし、後続correctionで生成declaration gateを補強した |
| RC01-DI1 | `639bc26` | `origin/feature/declarative-ui-execution-partitioning` | render definition modelをpushし、localとtracking branchがcommit時に一致した |
| AR01-FT-DECLARATION | `8d164cd` | `origin/feature/declarative-ui-execution-partitioning` | R3収束済みdeclaration boundary testをpushし、localとtracking branchが`8d164cdb0234c58a3957dd7d740cd1c4ed7117fb`で一致した |
| MP01-OWNER-PIPELINE | `122c47b` | `origin/feature/declarative-ui-execution-partitioning` | DK2 shared bridgeを除去したowner pipelineをpushし、localとtracking branchが`122c47b7d66a6b83d7c0d5280bb22354aedbfe78`で一致した |
| SC02A4 | `fcfe5ee` | `origin/feature/declarative-ui-execution-partitioning` | source-local relation schemaをpushし、localとtracking branchが`fcfe5ee68c0cc049cf762c4578e8dc5600d1eb92`で一致した |
| SC02A5 | `dc456b8` | `origin/feature/declarative-ui-execution-partitioning` | source-local export summaryをpushし、localとtracking branchが`dc456b8fa31dd6d03a7caeaf385e9ad053e493b3`で一致した |
| RC01-DI2A | `bd1fd19` | `origin/feature/declarative-ui-execution-partitioning` | descriptor occurrence snapshotをpushし、localとtracking branchが`bd1fd198a2281c0f5b3725a265e49d0c2db4e0eb`で一致した |
| SC02-FACADE-FIXTURE | `b7f5b71` | `origin/feature/declarative-ui-execution-partitioning` | central facade ownership testをpushし、localとtracking branchが`b7f5b71dbb23f4cc442a8883fc29957bfa0c8269`で一致した |
| MP01-R4-INTEGRATION | `0c73a73` | `origin/feature/declarative-ui-execution-partitioning` | accepted state/demand admission detailをpushし、後続HEADから到達できる |
| SC02A6 | `ea129bb` | `origin/feature/declarative-ui-execution-partitioning` | registry source collection schemaをpushし、localとtracking branchが`ea129bb434789a2ec55386a89ebae2dc74345390`で一致した |
| RC01-DI2B | `5074491` | `origin/feature/declarative-ui-execution-partitioning` | validated scalar snapshotをpushし、localとtracking branchが`50744910cfb052cf5249a40a3b9d60c5128f3a48`で一致した |
| AR01-DB | `31a6da6` | `origin/feature/declarative-ui-execution-partitioning` | dependency binding identity-input schemaをpushし、localとtracking branchが`31a6da6154d75a58cc09b0946bb2fae6c265a22b`で一致した |
| PROCESS-REVIEW-V2 | `5eb062f` | `origin/feature/declarative-ui-execution-partitioning` | risk tier、attestation、capsule、delta convergence規則をpushし、localとtracking branchが`5eb062f7612855c9662486ea794b0aa0524092e2`で一致した |
| SC02A7 | `1c393b3` | `origin/feature/declarative-ui-execution-partitioning` | source contract envelopeをpushし、localとtracking branchが`1c393b3d120859d63a9da8e7045e40a1b0774f97`で一致した |
| RC01-DI3A | `9a1b9b5` | `origin/feature/declarative-ui-execution-partitioning` | render definition creatorをpushし、localとtracking branchが`9a1b9b59bfac9c2eee8c4f38ed8c096006a2e110`で一致した |
| AR01-XB | `44a1b0f` | `origin/feature/declarative-ui-execution-partitioning` | artifact export bindingをpushし、localとtracking branchが`44a1b0f1dbd5c0f4e053040d1df08359ba319b93`で一致した |
| RC01-DI3B | `8a70f80` | `origin/feature/declarative-ui-execution-partitioning` | verified render definition parserをpushし、localとtracking branchが`8a70f80dd722ed936a570b7d7e2683daab871a76`で一致した |
| EXECUTION-BOUNDARY-DESIGN | `b3b6ed2` | `origin/feature/declarative-ui-execution-partitioning` | SC02A8とAR01のimplementation splitをpushし、後続HEADから到達できる |
| ID01-CB | `e42fec4` | `origin/feature/declarative-ui-execution-partitioning` | bounded canonical builderをpushし、localとtracking branchが`e42fec40210aeead036209f209e9038632421f5b`で一致した |
| AR01-DP | `f56864d` | `origin/feature/declarative-ui-execution-partitioning` | deployment identity preimageをpushし、localとtracking branchが`f56864d544217188e1fd4372d7f180cda435b991`で一致した |
| SC02A8A | `02bdfe4` | `origin/feature/declarative-ui-execution-partitioning` | execution contract budget/ledgerをpushし、localとtracking branchが`02bdfe4a662de7f0799f3211a9464303f2a2cbbc`で一致した |
| PROCESS-PROGRESS-V4 | `c221bb2` | `origin/feature/declarative-ui-execution-partitioning` | 完了済み3 sliceとready queueを同期し、localとtracking branchが`c221bb2c22191ca2d55eccde18474fea1431f52d`で一致した |
| AR01-P | `c53a50e` | `origin/feature/declarative-ui-execution-partitioning` | artifact address preimageをpushし、localとtracking branchが`c53a50e94b474213511ad73fb106e4681a5de6f9`で一致した |
| SC02A8B | `7dc62e7` | `origin/feature/declarative-ui-execution-partitioning` | distinct-container descriptor captureをpushし、localとtracking branchが`7dc62e79832f28d9a196e6993c7a1d3429b5b5be`で一致した |
| SC02A8C | `c37a81e` | `origin/feature/declarative-ui-execution-partitioning` | active-ancestor trackerをpushし、localとtracking branchが`c37a81e8d932d712c6118d6865b6b29f94d59492`で一致した |

## 未完了事項

- Phase 1 から Phase 10 を vertical slice 単位で実装する。
- push 後の全体監査と exact remote OID の最終監査を完了する。
