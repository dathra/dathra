
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
