# 宣言的 UI 実行分割の実装進捗

更新日: 2026-07-12
状態: 実装中

## 再開情報

- 実装指示: `.temp/declarative-ui-execution-partitioning-implementation-goal.md`
- 設計正本: `.temp/declarative-ui-execution-partitioning.md`
- 作業 branch: `feature/declarative-ui-execution-partitioning`
- 起点 commit: `71186a8e919c44d0dbc626effdf08ed5120cd790`
- push 先: `origin/feature/declarative-ui-execution-partitioning`
- 次の作業: SC01 の RegistryId、closed descriptor、environment/role/protocol binding を SPEC と test から実装する。
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
| P01 | ExecutionGraph foundation | in-progress | ID01 canonical identity は completed。OC01 と module/ExecutionGraph slice は未着手 |
| P02 | semantic contract と registry | in-progress | OC01 の前提になる SC01 registry contract を先行する |
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
| SC01 | RegistryId、descriptor、environment/role/protocol binding | shared: `src/executionRegistry/` | 同 directory の SPEC / test | closed registry schema と validation | ID01 | in-progress |
| OC01 | ObservationContract、composition、RealizationWitness | shared: `src/observationContract/` | 同 directory の SPEC / test | 同 directory の implementation | SC01 / ID01 | pending |
| EG01 | immutable module graph snapshot | transformer: `src/moduleGraph/` | 同 directory の SPEC / test | canonical module request、content digest、snapshot | ID01 | pending |
| EG02 | ModuleCoordinator、fixed point、incremental invalidation | transformer: `src/moduleCoordinator/` | 同 directory の SPEC / test | resolver/load/transform adapter、barrier、cache | EG01 | pending |
| EG03 | ExecutionGraph、TemplateNode、Occurrence、root、edge | transformer: `src/executionGraph/` | 同 directory の SPEC / test | deterministic graph builder | EG02 / OC01 | pending |
| SC02 | semantic fact、relation、source/compiled execution contract | shared: `src/executionContract/` | 同 directory の SPEC / test | qualification 前後の contract schema | SC01 / ID01 | pending |
| SC03 | contract qualification、conflict、dangling、kind diagnostic | transformer: `src/diagnostic/`、`src/contractCompiler/` | 各 directory の SPEC / test | diagnostic path と compiled registry projection | EG02 / SC01 / SC02 | pending |
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
| CN01 | finite candidate generation と合法性 | transformer: `src/candidatePlanner/` | 同 directory の SPEC / test | placement/materialization/adapter candidate DAG と justification | PL02 / DX01 / MP01 / PJ01 / RC01 / RP01 / SP01 / OP01 | pending |
| MP02 | demand-first MaterializationPlan 生成 | transformer: `src/materializationPlanner/` | 同 directory の SPEC / test | candidate ごとの demand、plan、diagnostic | CN01 / MP01 | pending |
| CG01 | ClientScopeGraph、root、group、state、prerequisite | transformer: `src/clientScopeGraph/` | 同 directory の SPEC / test | candidate ごとの client graph | CN01 / MP02 / DX01 | pending |
| SR01 | ExecutionGraph 由来の server renderer 生成 | transformer: `src/serverRenderer/` | 同 directory の SPEC / test。既存 mode SSR ADR を supersede | candidate ごとの generated server artifact | CN01 / RC01 | pending |
| CP01 | mode 非依存の candidate compiler facade | transformer: `src/compile/` | 同 directory の SPEC / integration test | coordinator から candidate artifact graph までの compile entry | CG01 / SR01 | pending |
| BR01 | module/contract graph と build tool の bridge | plugin: `src/buildCoordinator/` | 同 directory の SPEC / test | contract discovery、resolver bridge、graph-completeness barrier | CP01 / EG02 / SC03 | pending |
| RR01 | compiled registry の runtime role validation | runtime: `src/runtimeRegistry/` | 同 directory の SPEC / test | environment/role projection、policy input、conformance | SC01 / SC03 / PJ01 | pending |
| MT01 | graph-table decode と materialization transaction | runtime: `src/materialization/` | 同 directory の SPEC / test | strict wire validation、codec preflight、budget、allocate/populate/commit | RR01 / MP01 / PJ01 | pending |
| SE01 | server-side graph-table payload encoder | runtime: `src/ssr/payloadEncoder/` | 同 directory の SPEC / test | canonical carrier、codec enforcement、budget | MT01 / MP02 / RC01 | pending |
| SR02 | RenderOperation、retry、cancel、header、stream | runtime: `src/ssr/renderOperation/` | 同 directory の SPEC / test | RenderOperation state machine と writer | RC01 / SR01 / SE01 | pending |
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
| AF01 | candidate ごとの final bytes と integrity table | plugin: `src/artifactFinalizer/` | 同 directory の SPEC / deterministic fixture test | SCC collapse、address、exact bytes、manifest core integrity、metrics | BR01 / AR01 / CE01 / SR02 | pending |
| SL01 | finalization 後の cost selection と plan ID | transformer: `src/finalPlanSelector/` | 同 directory の SPEC / optimality/reproducibility test | semantic subset、cost vector、plan identity、witness | CN01 / AF01 / PI01 / OC01 | pending |
| PE01 | selected projection の manifest/envelope/bootstrap emission | plugin: `src/projectionEmitter/` | 同 directory の SPEC / artifact test | fixed envelope、plan-bound manifest、zero-bootstrap output | SL01 / PJ01 / CR02 | pending |
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

### SC01 execution registry contract

- **設計要件**：source-local `RegistryId` と namespace-qualified identity を分離し、10種類の registry descriptor、許可された environment/role、同一環境 dependency、remote request-response protocol binding を closed discriminated schema として表す。
- **変更範囲**：`packages/shared/src/executionRegistry/` に `AGENTS.md`、`SPEC.typ`、`implementation.test.ts`、`implementation.ts` を追加し、`packages/shared/src/index.ts` から後続 compiler/runtime slice が使う contract と validator を公開する。
- **SPEC と ADR**：`dathra.registry/1` descriptor、`dathra.registry-role/*/1` interface schema、`dathra.registry-protocol/1`、`dathra.registry-environment-projection/1` の closed schema と role matrix を新規 ADR で固定する。既存 Accepted ADR の変更はない。
- **先行 test**：10 descriptor kind、local/qualified ID、role requirement、implementation binding、same-environment dependency、remote protocol binding、environment projection の成功系を追加する。unknown/extra/accessor field、kind/reference mismatch、illegal environment/role、interface schema mismatch、cross-environment import、non-remote protocol、delivery/server deployment mismatch、重複 binding を失敗系として追加する。
- **影響範囲**：shared の pure contract/validation API と export surface だけを変更する。SC03 が source contract を qualification し、RR01 が runtime projection を検証するまで compiler/runtime の既存挙動は変更しない。
- **依存順の理由**：SC01 は Phase 2 の contract だが、Phase 1 の OC01 が registry identity を参照する。独立レビュー済み matrix の依存順に従い、ID01 の直後、OC01 より前に実装する。
- **edge case**：descriptor と binding は getter を実行せず closed data record として snapshot する。`build` は runtime role location に含めず、same-environment import の両 environment を一致させる。cross-environment edge は remote-operation の protocol binding だけに限定し、delivery environment と deployment identity の整合を検証する。
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
| A14 | compiled registry projection と environment closure | SC03 / RR01 / CE01 | `packages/runtime/src/runtimeRegistry/implementation.test.ts` | pending | 未取得 |
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

## Slice Log

| Slice | 状態 | 設計要件 | 検証 | Review | Commit / Push |
| --- | --- | --- | --- | --- | --- |
| PLAN-00 | completed | 実装 branch、正本、進捗台帳を確立する | clean tree と local/remote tracking を確認 | goal 文書の事前独立レビューは `ACCEPT` | `8a0eedd` / push 済み |
| BASELINE-00 | completed | 実装前の既存挙動と gate を固定する | Baseline 表の19 command | production change がないため独立実装レビュー対象外 | この記録を次の文書 commit に含める |
| MATRIX-01 | completed | package/API/SPEC/test/implementation と acceptance owner を確定する | 59 row、未定義 dependency 0、cycle 0、AX01 閉包外 0 | 3回目の独立レビュー `ACCEPT` | この記録を matrix commit に含める |
| VG01 | completed | docs と全 playground に実処理の build/fmt/test gate を設ける | 全 app production workflow、root aggregate、CI format/build/test | 5回目の独立レビュー `ACCEPT` | `8fe6c60` / push 済み |
| ID01 | completed | canonical preimage、digest、qualified ID の共通 primitive | shared test/typecheck/lint/build と artifact inspection | 2回目の独立レビュー `ACCEPT` | `3816c34` / push 済み |
| SC01 | in-progress | closed registry schema と environment/role/protocol binding | shared test/typecheck/lint/build と role matrix coverage | 実装後に新しい reviewer へ依頼する | 未 commit |

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

## Commit / Push Log

| Slice | Commit | Remote | 同期確認 |
| --- | --- | --- | --- |
| PLAN-00 | `8a0eedd` | `origin/feature/declarative-ui-execution-partitioning` | push 後に tracking branch と一致した |
| BASELINE-00 | `9cd4266` | `origin/feature/declarative-ui-execution-partitioning` | push 後に tracking branch と一致した |
| MATRIX-01 | `549e312` | `origin/feature/declarative-ui-execution-partitioning` | push 後に tracking branch と一致した |
| VG01 | `8fe6c60` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `8fe6c60cd2e4cab82b9785525a76e5f485148e95` で一致した |
| ID01 | `3816c34` | `origin/feature/declarative-ui-execution-partitioning` | local と tracking branch が `3816c342ce203cbf5ddf5b91c67479c03e72a163` で一致した |

## 未完了事項

- Phase 1 から Phase 10 を vertical slice 単位で実装する。
- push 後の全体監査と exact remote OID の最終監査を完了する。
