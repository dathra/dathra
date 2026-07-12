# 宣言的 UI 実行分割の実装進捗

更新日: 2026-07-12
状態: 実装中

## 再開情報

- 実装指示: `.temp/declarative-ui-execution-partitioning-implementation-goal.md`
- 設計正本: `.temp/declarative-ui-execution-partitioning.md`
- 作業 branch: `feature/declarative-ui-execution-partitioning`
- 起点 commit: `71186a8e919c44d0dbc626effdf08ed5120cd790`
- push 先: `origin/feature/declarative-ui-execution-partitioning`
- 次の作業: SC02 semantic fact、relation、source/compiled execution contract の設計要件と既存 shared package を調査し、high-cost 判定後に slice contract を確定する。
- 外部 blocker: なし

## 状態の意味

- `pending`: 未着手である。
- `in-progress`: 現在の slice で作業している。
- `completed`: 直接的な検証証拠、独立レビュー、commit、push が揃っている。
- `reopened`: 完了後の監査で不足が見つかり、再作業が必要である。

## 手順の進捗

| ID | 作業 | 状態 | 証拠 |
| --- | --- | --- | --- |
| S00 | branch、計画文書、baseline | completed | `gnb` で branch を作成し、計画 commit `8a0eedd` を push した。全 baseline command が成功した |
| S01 | implementation matrix | completed | 59 row 全件が AX01 の依存閉包に入り、A01〜A44 の owner/evidence を確定した。3回目の独立レビューは ACCEPT |
| S02 | verification-gate slice | completed | 5回の独立レビューを収束させ、commit `8fe6c60` を push した |
| P01 | ExecutionGraph foundation | completed | ID01、SC01、OC01、EG01、EG02、EG03 の検証、独立レビュー、commit、push が完了した |
| P02 | semantic contract と registry | in-progress | SC01 registry contract は completed。SC02 と SC03 は未着手 |
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
| SC02 | semantic fact、relation、source/compiled execution contract | shared: `src/executionContract/` | 同 directory の SPEC / test | qualification 前後の contract schema | SC01 / ID01 | pending |
| SC03 | contract qualification、conflict、dangling、kind diagnostic | transformer: `src/diagnostic/`、`src/contractCompiler/` | 各 directory の SPEC / test | diagnostic path、artifact 非依存の QualifiedRegistryUniverse、policy proof-domain verifier profile admission | EG02 / SC01 / SC02 / OC01 | pending |
| PL01 | function extraction、capture、mutable state、module closure | transformer: `src/moduleClosure/` | 同 directory の SPEC / test | NativeModuleClosure と client closure evidence | EG03 / SC03 | pending |
| PL02 | root、read、effect、callback、module evaluation の導出 | transformer: `src/executionAnalysis/` | 同 directory の SPEC / test。既存 `transform/SPEC.typ` に superseding ADR | component-transparent semantic analysis | EG03 / SC03 / PL01 | pending |
| DX01 | `render:client`、`activate:*`、`dom:external` lowering | transformer: `src/executionDirectives/` | 同 directory の SPEC / test。既存 JSX/tree ADR を supersede | reserved prop validation と root/region binding | PL02 | pending |
| MP01 | materialization requirement、kind、plan schema | shared: `src/materializationContract/` | 同 directory の SPEC / test | snapshot、codec、graph-table、reference、subscription、remote kind | SC01 / OC01 | pending |
| AR01 | artifact address、exact bytes、integrity schema | shared: `src/artifactContract/` | 同 directory の SPEC / test | canonical address、URL、integrity table | ID01 | pending |
| PI01 | cost metric と plan identity schema | shared: `src/planIdentity/` | 同 directory の SPEC / test | metric vector、integrity-bound plan identity | AR01 / OC01 | pending |
| PJ01 | request class、projection definition/instance、manifest、BootAuthority | shared: `src/projectionContract/` | 同 directory の SPEC / test | request partition、ProjectionManifestCore、envelope、budget、trusted boot schema | AR01 / PI01 / MP01 | pending |
| RC01 | RenderEnvelope、publication、writer contract | shared: `src/renderContract/` | 同 directory の SPEC / test | render/writer closed schema | ID01 / OC01 | pending |
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

## 未完了事項

- Phase 1 から Phase 10 を vertical slice 単位で実装する。
- push 後の全体監査と exact remote OID の最終監査を完了する。
