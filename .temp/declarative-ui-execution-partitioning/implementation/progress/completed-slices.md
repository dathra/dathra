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
