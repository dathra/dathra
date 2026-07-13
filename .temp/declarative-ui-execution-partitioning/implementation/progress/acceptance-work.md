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
