= module coordinator

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

resolver、loader、transformer、extractor を一つの observed transaction として実行し、複数 resolution domain の module graph を deterministic fixed point まで閉じる。

adapter が観測した input と staged effect を atomic commit で再検証し、graph-completeness barrier を通過した immutable `ModuleGraphSnapshot` だけを committed state として公開する。

== 設計判断

#adr(
  header("Attempt-specific domain を single-writer transaction で構築する", Status.Accepted, "2026-07-12"),
  [
    build input に完成済み domain ID を固定すると、retry 中に package map、import map、resolver configuration が変化しても古い identity を再利用してしまう。
    また、同時 build が cache と committed snapshot を別々に更新すると、一つの epoch に属さない state が公開される。
  ],
  [
    coordinator は build request を呼び出し順に直列化する single writer とする。
    各 attempt で pipeline profile と domain transcript を観測し、その結果から `ModuleResolutionDomain` を生成する。
    stable domain key から final domain ID への写像は一 attempt 内で injective とし、別 key の collapse を拒否する。
  ],
  [
    - retry は current resolver/domain semantics を identity に反映する
    - 前回 commit 済み snapshot は次の atomic commit まで変更されない
    - 並行性は adapter 内部に許せるが、coordinator state の publication は一列になる
  ],
)

#adr(
  header("Loader identity と runtime identity を fixed point 内で merge する", Status.Accepted, "2026-07-12"),
  [
    resolve 時点の request/module-map key は、redirect 後の base URL や runtime Module Record identity と同じではない。
    source-phase alias と evaluation-phase alias が load 後に同じ runtime module へ合流する場合、resolve 単位の traversal では outgoing request の必要性を誤判定する。
  ],
  [
    resolve result は temporary loader unit を作り、load 後にだけ `(domainId, runtimeModuleIdentityDigest)` で runtime unit を merge する。
    runtime phase は `source < evaluation` の join とし、初めて evaluation へ昇格した runtime unit の extracted site を一度だけ enqueue する。
    source-only target は load、transform、extract まで実行するが outgoing candidate を resolve しない。
  ],
  [
    - redirect、loader alias、native/CommonJS cache identity を失わない
    - import cycle と source-to-evaluation promotion を有限に処理できる
    - 同じ runtime identity に矛盾する definition、base URL、runtime semantics が現れた場合は diagnostic になる
  ],
)

#adr(
  header("Stage cache を observation と replay contract に束縛する", Status.Accepted, "2026-07-12"),
  [
    operation の一部 field だけを cache key にすると、entry context、module-map type、attributes、response metadata の違いを無視できる。
    また、plugin effect や watch registration を伴う result を値だけ再利用すると、current transaction に必要な effect が欠落する。
  ],
  [
    stage key は schema、stage kind、aggregate adapter profile、stage profile、attempt domain または stable domain configuration、complete operation input の canonical digest とする。
    result は `pure`、closed replay token を持つ `replayable`、永続化しない `transaction-local` のいずれかを宣言する。
    cache hit は保存済み positive/negative observation を再提出し、`replayable` では `replayCachedStage` を実行する。
  ],
  [
    - 同じ stage key の adapter operation は一 transaction で一度だけになる
    - failed、cancelled、invalidated attempt の overlay は committed cache を変更しない
    - observation owner と target-to-importer reverse graph から transitive invalidation を行える
  ],
)

#adr(
  header("Observation validation と publication を一つの commit point にする", Status.Accepted, "2026-07-12"),
  [
    observation の最終確認と staged effect の publication を別 operation にすると、その間の filesystem/config change による TOCTOU を防げない。
    commit 開始後の AbortSignal と publication の競合も、呼び出し側だけでは判定できない。
  ],
  [
    `tryCommit` は transaction、snapshot、adapter profile、observation set digest、exact observation を受け、再検証と publication を一つの linearization point で行う。
    committed receipt が exact request と一致した場合は、呼び出し中に abort されても prepared state を swap する。
    invalidated result は publication を行わず、changed observation を使う新 attempt へ進む。
  ],
  [
    - successful build が指す snapshot と adapter effect は同じ epoch に属する
    - commit 前の error/cancel と invalidated attempt は rollback できる
    - receipt mismatch、retry exhaustion、不安定な observation は typed diagnostic になる
  ],
)

== インターフェース仕様

#interface_spec(
  name: "ModuleCoordinator adapter transaction",
  summary: [
    bundler-neutral adapter が一 build attempt の observed stage と atomic publication を提供する。
  ],
  format: [
    ```typescript
    interface ModuleCoordinatorAdapter {
      beginTransaction(
        input: ModuleCoordinatorBeginTransactionInput,
      ): Promise<ModuleCoordinatorAdapterTransaction>
    }

    interface ModuleCoordinatorAdapterTransaction {
      describePipeline(input: DescribePipelineInput): Promise<DescribePipelineResult>
      describeDomain(input: DescribeDomainInput): Promise<DescribeDomainResult>
      resolve(input: ResolveModuleInput): Promise<ResolveModuleResult>
      load(input: LoadModuleInput): Promise<LoadModuleResult>
      transform(input: TransformModuleInput): Promise<TransformModuleResult>
      extract(input: ExtractModuleInput): Promise<ExtractModuleResult>
      replayCachedStage(input: ReplayCachedStageInput): Promise<void>
      tryCommit(input: ModuleCoordinatorCommitInput): Promise<ModuleCoordinatorCommitResult>
      rollback(input: ModuleCoordinatorRollbackInput): Promise<void>
    }
    ```
  ],
  constraints: [
    - operation input は versioned、closed、canonical、deeply immutable な record とする
    - adapter result は getter、custom prototype、symbol、hidden/extra mutable state を持たない closed data とする
    - source/transformed result bytes は callback return 直後に coordinator が copy し、後続 operation へは deeply immutable な byte sequence を渡す
    - 各 observed stage result は present と absent の dependency observation を一つ以上持つ
    - 同じ observation key に異なる digest が現れた attempt を拒否する
  ],
)

#interface_spec(
  name: "ModuleCoordinator",
  summary: [
    build queue、committed snapshot、persistent stage cache、observation reverse index、entry/runtime mapping を所有する。
  ],
  format: [
    ```typescript
    interface ModuleCoordinatorBuildInput {
      readonly domains: readonly ModuleCoordinatorDomainInput[]
      readonly entries: readonly ModuleCoordinatorEntryInput[]
    }

    interface ModuleCoordinatorBuildOptions {
      readonly changedObservationKeys?: readonly string[]
      readonly signal?: AbortSignal
    }

    class ModuleCoordinator {
      readonly committedSnapshot: ModuleGraphSnapshot | null
      readonly status: ModuleCoordinatorStatus

      build(
        input: ModuleCoordinatorBuildInput,
        options?: ModuleCoordinatorBuildOptions,
      ): Promise<ModuleCoordinatorBuildResult>
    }

    function createModuleCoordinator(
      adapter: ModuleCoordinatorAdapter,
      options?: ModuleCoordinatorOptions,
    ): ModuleCoordinator
    ```
  ],
  constraints: [
    - domain key は unique、entry ordinal は domain ごとに0から始まる dense sequence とする
    - entry は evaluation admission とし、native または CommonJS resolution request を明示する
    - build request は invocation order で一つずつ transaction を実行する
    - public snapshot、status、result は caller mutation から隔離する
  ],
)

== 機能仕様

#feature_spec(
  name: "Deterministic graph-completeness fixed point",
  summary: [
    lexical stage-key round で resolve、load、alias merge、transform/extract、phase promotion、candidate enqueue を繰り返す。
  ],
  test_cases: [
    - adapter completion timing と candidate discovery order が異なっても同じ snapshot ID を生成する
    - evaluation import cycle を有限に閉じる
    - source-only target の outgoing request を resolve しない
    - source alias が別 evaluation alias と同じ runtime unit に merge すると outgoing request を一度だけ enqueue する
    - external runtime evidence は fixed point 後の exact loader alias set を持つ
    - pending work が進まない状態、duplicate candidate、runtime merge conflict を拒否する
  ],
)

#feature_spec(
  name: "Observed cache and incremental invalidation",
  summary: [
    committed cache を copy-on-write で再利用し、changed observation の owner closure だけを再計算する。
  ],
  test_cases: [
    - pure hit は adapter stage を再実行しない
    - replayable hit は stage を再実行せず current transaction へ replay する
    - transaction-local result は次 transaction で再実行する
    - cache hit の observation と複数 owner を current commit に再提出する
    - observation/reverse lineage を保持しない unpinned cache entry は commit 時に deterministic eviction する
    - target observation の change は previous target-to-importer reverse closure を invalidate する
    - global pipeline/domain observation の change は全 cache を invalidate する
    - failed、cancelled、invalidated attempt は cache write と owner update を残さない
    - failed/cancelled rebuild の changed observation は pending ledger に残し、次の build が成功するまで旧 cache を再利用しない
  ],
)

#feature_spec(
  name: "Atomic commit, retry, and cancellation",
  summary: [
    graph snapshot validation 後に exact observation と staged effect を一つの commit point で確定する。
  ],
  test_cases: [
    - mid-build invalidation は新しい profile/domain を観測する attempt で retry する
    - commit 前の abort は rollback し previous snapshot を保持する
    - tryCommit 中の abort 後に committed receipt が返れば成功 state を swap する
    - invalidated result 後の abort は publication なしの cancel とする
    - receipt field mismatch と throw を失敗として扱い previous state を保持する
    - concurrent build は invocation order で commit する
  ],
)

#feature_spec(
  name: "Hard resource budgets",
  summary: [
    host input が有限であることを coordinator 自身の上限で保証する。
  ],
  test_cases: [
    - retry と fixed-point round の上限を検査する
    - domain、entry、loader unit、runtime unit、semantic request、site、candidate、observation の上限を検査する
    - persistent cache entry/byte budget を current graph の pinned evidence にも適用する
    - budget 超過時は commit せず previous snapshot と cache を保持する
  ],
)

#feature_spec(
  name: "Immutable public boundary",
  summary: [
    untrusted build/adapter value を getter 実行なしで検証し、graph barrier 後の immutable state だけを公開する。
  ],
  test_cases: [
    - build input と adapter result の accessor/custom prototype/extra field を拒否する
    - byte result の callback 後 mutation が graph identity を変更しない
    - `createModuleGraphSnapshot` が失敗した attempt は `tryCommit` を呼ばない
    - transformer root export から coordinator、adapter type、error type を利用できる
  ],
)

== failure

`ModuleCoordinatorError` は immutable な `code`、`path`、必要な場合は `resource` を持つ。

```typescript
type ModuleCoordinatorErrorCode =
  | "invalid-input"
  | "adapter-contract"
  | "observation-conflict"
  | "domain-collision"
  | "runtime-conflict"
  | "duplicate-candidate"
  | "fixed-point-stall"
  | "budget-exceeded"
  | "commit-mismatch"
  | "unstable-input"
  | "cancelled"
```
