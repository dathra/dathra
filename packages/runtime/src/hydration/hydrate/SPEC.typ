= hydrate API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

SSR で生成された DOM を再利用し、リアクティビティとイベントを接続する（Hydration）。

== 機能仕様

#feature_spec(
  name: "HydrationMismatchError",
  summary: [
    Hydration ミスマッチを表すカスタムエラークラス。メッセージに `"Hydration mismatch"` プレフィックスを付与する。
  ],
  api: [
    ```typescript
    class HydrationMismatchError extends Error \{
      name: "HydrationMismatchError";
      constructor(message: string);
    \}
    ```
  ],
  test_cases: [
    - Error のインスタンスである
    - 正しい name を持つ
    - 正しいメッセージプレフィックスを持つ
  ],
)

#feature_spec(
  name: "handleMismatch",
  summary: [
    Hydration ミスマッチの処理。開発モード（`__DEV__`）では `HydrationMismatchError` を投げて処理を中断し、本番モードでは警告を出して `false` を返し CSR フォールバックを許可する。
  ],
  api: [
    ```typescript
    function handleMismatch(
      message: string,
      details?: \{
        markerId?: number;
        markerType?: string;
        expected?: string;
        actual?: string;
      \}
    ): boolean
    ```
  ],
  test_cases: [
    - dev モードで HydrationMismatchError を投げる
    - 本番モードで警告し false を返す
  ],
)

#feature_spec(
  name: "isHydrated / markHydrated",
  summary: [
    冪等性管理ユーティリティ。`WeakMap` で ShadowRoot の Hydration 状態を追跡する。
  ],
  api: [
    ```typescript
    function isHydrated(root: ShadowRoot): boolean
    function markHydrated(root: ShadowRoot): void
    ```
  ],
  test_cases: [
    - 新しい ShadowRoot に対して false を返す
    - markHydrated 後に true を返す
  ],
)

#feature_spec(
  name: "hydrateRoot",
  summary: [
    SSR 生成の `ShadowRoot` を Hydrate する。`WeakMap` で二重 Hydration を防止（冪等性保証）し、`createRoot` で cleanup スコープを作成する。状態スクリプト（`<script data-dh-state>`）をパースして初期状態を復元する。closed ShadowRoot は Hydrate 不可。
  ],
  api: [
    ```typescript
    function hydrateRoot(
      root: ShadowRoot,
      setup: (ctx: HydrationContext) => void,
      options?: \{
        store?: AtomStore;
        storeSnapshotSchema?: AtomStoreSnapshot<
          Record<string, PrimitiveAtom<unknown>>
        >;
      \}
    ): RootDispose | null
    ```

    - `root`: Hydrate 対象の ShadowRoot
    - `setup`: Hydration コンテキストを受け取るセットアップ関数
    - `options.store`: request-scoped な AtomStore
    - `options.storeSnapshotSchema`: store snapshot のスキーマ（`store` と併用必須）
    - 戻り値: cleanup 用の dispose 関数、または Hydrate 不可の場合 `null`
  ],
  test_cases: [
    - ShadowRoot をハイドレートする
    - ハイドレート済みの root に null を返す（冪等性）
    - dispose 関数を返しクリーンアップする
    - request-scoped store をハイドレーションコンテキストに渡す
    - schema 提供時に setup 実行前に store snapshot をハイドレート
    - storeSnapshotSchema を store なしで渡すとエラーを投げる
    - compiler-generated hydration plan により text / attr / event / insert binding を DSD へ in-place 接続できる
  ],
)

#feature_spec(
  name: "generic setup hydration plan runtime (proposal)",
  summary: [
    compiler-generated hydration plan を受け取り、generic setup component の SSR DSD に対して text / attr / event / insert binding を in-place 接続する。
  ],
  api: [
    ```typescript
    interface GenericHydrationPlan {
      readonly namespace: "html" | "svg" | "math"
      readonly bindings: readonly HydrationBinding[]
      readonly nestedBoundaries: readonly NestedBoundaryRef[]
    }

    type HydrationBinding =
      | TextBinding
      | AttrBinding
      | EventBinding
      | InsertBinding
      | SpreadBinding

    interface TextBinding {
      readonly kind: "text"
      readonly markerId: number
      readonly expression: unknown
    }

    interface AttrBinding {
      readonly kind: "attr"
      readonly path: readonly number[]
      readonly key: string
      readonly expression: unknown
    }

    interface EventBinding {
      readonly kind: "event"
      readonly path: readonly number[]
      readonly eventType: string
      readonly expression: unknown
    }

    interface InsertBinding {
      readonly kind: "insert"
      readonly markerId: number
      readonly path: readonly number[]
      readonly expression: unknown
      readonly isComponent: boolean
    }

    interface SpreadBinding {
      readonly kind: "spread"
      readonly path: readonly number[]
      readonly expression: unknown
    }

    interface NestedBoundaryRef {
      readonly path: readonly number[]
      readonly tagName: string
      readonly islandStrategy: string | null
    }

    function hydrateWithPlan(
      root: ShadowRoot,
      plan: GenericHydrationPlan,
      options?: HydrationOptions,
    ): RootDispose | null
    ```
  ],
  impl_notes: [
    - plan は SSR marker と stable node path/id によって既存 DSD ノードを参照できる必要がある
    - hydrate runtime は root DOM を再生成せず、既存 node へ binding を接続する
    - nested island boundary として宣言された descendant host は opaque subtree として扱い、outer hydration plan から直接 mutation しない
    - plan mismatch は既存 hydration mismatch 規則に従い、dev では throw / prod では warning + fallback を許可する
    - `attr` / `event` / `spread` binding は `path` で既存要素を解決し、`text` / `insert` は `markerId` で既存 SSR marker を解決する
    - marker 解決は per-root の index を使って O(1) で行い、walk 済み marker 配列の線形検索へ戻さない
    - `nestedBoundaries` がある場合、outer plan の marker index にはその subtree 内の marker を含めず、duplicate marker id があっても nested host 側へ誤接続しない
    - `path` は `fromTree`/SSR tree の child index 規則と共有し、placeholder を含めた安定 index として扱う
  ],
  test_cases: [
    - text binding を marker に接続できる
    - attr binding を既存要素へ接続できる
    - event binding を既存要素へ接続できる
    - insert binding を SSR marker に接続できる
    - nested boundary 指定位置は outer hydration plan が直接書き換えない
    - nested boundary subtree に duplicate marker id があっても outer plan は outer marker を解決する
    - `path` 解決に失敗した binding は hydration mismatch 扱いになる
  ],
  edge_cases: [
    - current `hydrate()` は texts/events の簡易版なので、generic plan runtime はそれを attrs/inserts/nested-boundary aware に拡張する方向でよい
    - components 側の compiler-generated plan path と plain `hydrate` API の責務は分離する
    - `unsupportedReason` を持つ host は hydrateWithPlan を使わず fallback path に回す
  ],
)

#feature_spec(
  name: "unsupported plan fallback handling",
  summary: [
    compiler-generated hydration metadata が `unsupportedReason` を持つ場合、runtime は generic plan hydration を試みず clear-and-rerender fallback へ明示的に流す。
  ],
  test_cases: [
    - unsupported reason を持つ host は `hydrateWithPlan()` を呼ばない
    - unsupported reason は dev diagnostics に出せる
    - supported host と unsupported host が混在しても islands scheduler は host 単位で動作する
  ],
  impl_notes: [
    - unsupported 判定は transform responsibility とし、runtime は metadata を読むだけに留める
    - fallback path でも host metadata `data-dh-island*` の scheduler 契約は維持する
  ],
)

#behavior_spec(
  name: "vertical slice: visible outer host with load nested child",
  summary: [
    `hydrateIslands()` と `hydrateWithPlan()` は、`Outer client:visible` の subtree 内に `Inner client:load` があるケースで child を先に hydrate し、outer hydrate 時にも child subtree を opaque boundary として保全する。
  ],
  preconditions: [
    - outer/inner host は canonical `data-dh-island*` metadata と `planFactory` 由来 hydration metadata を持つ
    - outer plan は child host を `NestedBoundaryRef` として保持する
    - child host は unsupported ではない
  ],
  steps: [
    1. `hydrateIslands()` は DOM と open ShadowRoot を走査し、outer/inner host の両方を boundary 候補として収集する
    2. scheduler は `load` child host を即時 hydrate し、`visible` outer host は observer 待ちにする
    3. child host は `hydrateWithPlan()` により既存 DSD へ in-place binding を接続する
    4. visible 発火後、outer host も `hydrateWithPlan()` を実行するが、`NestedBoundaryRef` に一致する child subtree は mutate しない
  ],
  postconditions: [
    - child host は outer host より先に hydrate できる
    - outer host hydrate は child host DOM を破壊しない
    - host 単位の cleanup / hydrated status は outer/inner で独立する
  ],
)

#feature_spec(
  name: "hydrateIslands",
  summary: [
    `data-dh-island` / `data-dh-island-value` metadata を持つ component host を走査し、strategy ごとに hydration を遅延実行する。`load`, `visible`, `idle`, `interaction`, `media` をサポートし、同一 island の二重起動を防ぐ。
  ],
  api: [
    ```typescript
    function hydrateIslands(
      root?: Document | ShadowRoot | Element
    ): () => void
    ```

    - `root`: islands を探索する起点。省略時は `document`
    - 戻り値: 未発火 strategy の observer / listener / timer を解除する cleanup 関数
  ],
  test_cases: [
    - `load` strategy は `window.load` 後に hydrate する
    - `visible` strategy は `IntersectionObserver` 発火前は hydrate しない
    - `idle` strategy は `requestIdleCallback` で hydrate し、API がない場合は timeout fallback で hydrate する
    - `interaction` strategy は指定 event で hydrate し、値欠如時は `click` を使う
    - `media` strategy は media query が match した時に hydrate する
    - browser API がない strategy は fail-open で即 hydrate する
    - 同一 island を複数回 scan しても二重 hydrate しない
    - pending schedule は cleanup 関数または `cancelScheduledIslandHydration()` で cancel でき、後続 scan で再 schedule できる
    - open ShadowRoot 内の island も再帰的に検出する
    - island boundary は host setup subtree 全体を支配し、plain descendant subtree は outer host の strategy 発火まで inert のまま残る
    - explicit nested island host が存在する場合のみ inner host を別 boundary 候補として scan する
  ],
  impl_notes: [
    - custom element 側は runtime が呼ぶ internal hydration hook を host instance に公開する
    - browser API が未提供の strategy は fail-open で即 hydrate する
    - strategy 発火後は observer / listener を即解除する
    - `@dathra/components` 連携のため `HYDRATE_ISLANDS_HOOK` / `HYDRATE_ISLANDS_STATUS` / `cancelScheduledIslandHydration()` と関連型を hydration package から export する
    - scheduler は `data-dh-island*` metadata を持つ host を boundary の最小単位として扱い、native element marker や plain child component を個別 boundary としては扱わない
  ],
)

#feature_spec(
  name: "colocated client handler hydration MVP (proposal)",
  summary: [
    transformer が付与した target strategy metadata / event metadata / marker を使い、`<strategy>:on<Event>` を render replay ベースで有効化する。
  ],
  test_cases: [
    - `load` strategy では host setup 実行後に target button click handler が有効になる
    - `interaction` strategy では初回 event 後に host setup を実行し、その event を target へ replay する
    - target marker が見つからない場合は replay をスキップしつつ hydrate 自体は継続する
    - host dispose 時に pending replay state を cleanup する
    - v1 capture 制約で生成された transform output だけを前提にする
  ],
  impl_notes: [
    - MVP では compiler-generated action plan registry を持たず、CSR setup で通常の `onClick` binding を再生成する
    - runtime は interaction trigger event を一時保持し、host setup 後に `data-dh-client-target` marker を持つ target へ synthetic event を再配送する
    - non-bubbling interaction event に対応するため、colocated interaction target が存在する host では scheduler が target element へ直接 listener を張る
    - capture validation 自体は compiler が担い、runtime は validated output だけを実行する
  ],
)

#feature_spec(
  name: "component-target colocated action artifact hydration (proposal)",
  summary: [
    component 要素 target に対する colocated handler は child host の internal action binding metadata と compiler-generated action registry を用いて hydrate 時に復元する。
  ],
  edge_cases: [
    - runtime は child host event surface から観測できる event だけを bind し、shadow 内部 DOM の private 構造へは依存しない
    - `interaction` では trigger event と binding event が一致する場合のみ first-event replay を行う
    - initial rollout では capture payload を持たず、runtime は action id から module-registered handler を直接解決する
    - explicit `client:*` と component-target colocated artifact binding の競合は transformer 側で reject され、runtime へ持ち込まれない
  ],
  test_cases: [
    - child host が `data-dh-island="load"` と action binding metadata を持つ場合、load hydrate 後に host event listener が bind される
    - child host が `data-dh-island="interaction"` と action binding metadata を持つ場合、trigger event 後に hydrate し、その event を artifact binding へ replay する
    - unsupported / missing action artifact id は hydrate 自体を壊さず diagnostic を出して binding だけを skip する
    - host dispose 時に bound listener と pending replay state が cleanup される
  ],
  impl_notes: [
    - MVP の HTML target render replay pathとは別に、component target は registry lookup + host binding path を持つ
    - runtime は action artifact の評価主体ではなく、registry から解決した handler factory を host context へ接続するだけに留める
    - nested island host が独立 hydrate するケースでも child host 自身の binding metadata だけで完結する必要がある
  ],
)

#feature_spec(
  name: "colocated visible:onClick / idle:onClick phase 2 (proposal)",
  summary: [
    existing islands scheduler の `visible` / `idle` 戦略へ colocated click syntax を拡張し、render replay ベースの host setup path を再利用する。
  ],
  edge_cases: [
    - runtime 自体は target marker を直接 scan せず、component host が shadowRoot marker を読んで導出した `data-dh-island="visible" | "idle"` を起点に動作する
    - 1 host には 1 strategy だけが導出される前提とし、mixed strategy は transformer / component 側で reject する
    - host-level `client:*` / `data-dh-island*` metadata と colocated phase 2 syntax の競合は runtime へ持ち込まない
  ],
  test_cases: [
    - `visible:onClick` host は IntersectionObserver 発火まで setup しない
    - `idle:onClick` host は requestIdleCallback または timeout fallback まで setup しない
    - `visible:onClick` / `idle:onClick` は strategy 発火後に click handler が有効になる
    - visible / idle は trigger replay を持たない
    - host-level `data-dh-island*` metadata と colocated phase 2 marker が競合する component は dev diagnostics により colocated path を無効化する
  ],
  impl_notes: [
    - component host が shadowRoot marker から導出した `data-dh-island="visible" | "idle"` を runtime が既存 islands strategy と同じ scheduler へ載せる
    - setup rerender 自体は MVP と同じ path を通し、追加の event buffering は不要
    - IntersectionObserver / requestIdleCallback 不在時の fail-open は既存 islands runtime と同じ規則に従う
  ],
)

#feature_spec(
  name: "Phase 1 finalized islands metadata contract",
  summary: [
    runtime は islands metadata key と strategy 名を shared canonical contract から参照し、transformer 出力との契約を 1 箇所へ集約する。
  ],
  test_cases: [
    - runtime は canonical strategy 一覧に含まれる host だけを island として扱う
    - `interaction` host の default event type は canonical default `click` を使う
    - malformed または未知の strategy は island として扱わない
  ],
  impl_notes: [
    - `data-dh-island` / `data-dh-island-value` / `data-dh-client-target` / `data-dh-client-strategy` の key 名を shared islands contract utility から参照する
    - transformer と runtime が独自 union/string literal を別管理しないようにする
  ],
)

#feature_spec(
  name: "nested island boundary semantics (proposal)",
  summary: [
    outer island host の内側に別 strategy の island host を置ける余地を残しつつ、boundary の最小単位を custom element host に限定する。
  ],
  edge_cases: [
    - nested boundary 候補は descendant custom element host が独立した canonical `data-dh-island*` metadata を持つ場合に限る
    - plain DOM subtree と compiler-generated colocated marker は nearest host boundary に従い、暗黙の sub-island を形成しない
    - outer host が deferred であっても、inner host を独立起動させるかどうかは runtime scan order と scheduler contract を別途定義する
  ],
  test_cases: [
    - outer host の plain descendant subtree は outer strategy 発火まで interactive にならない
    - descendant custom element host が独立 metadata を持つ場合は nested boundary 候補として検出できる
    - native element marker だけでは nested boundary を形成しない
  ],
  impl_notes: [
    - 現段階では design direction を定義するのみで、outer/inner の優先順位や stop-at-boundary traversal は未実装でもよい
    - runtime 実装に進む際は cleanup ownership と duplicate scan 防止の責務を boundary 単位で整理する
  ],
)

#feature_spec(
  name: "nested island scheduling support (proposal)",
  summary: [
    `hydrateIslands()` は outer island host の subtree 内にある descendant island host も独立 boundary として収集し、strategy ごとに別々に schedule できるようにする。
  ],
  edge_cases: [
    - nested boundary の最小単位は canonical `data-dh-island*` metadata を持つ custom element host に限る
    - host ごとの pending cleanup / hydrated status は独立管理する
    - runtime は outer host が island であることを理由に descendant host の scan を止めない
    - native element marker や plain subtree は nested boundary として収集しない
  ],
  steps: [
    1. `hydrateIslands()` は root 以下の DOM と open ShadowRoot を再帰走査する
    2. canonical strategy を持つ host を見つけたら、ancestor island の有無にかかわらず boundary 候補へ追加する
    3. scheduler は host ごとに strategy を評価し、発火した host だけの internal hydrate hook を呼ぶ
    4. outer host / inner host はそれぞれ独立に cleanup と re-scan の対象になる
  ],
  test_cases: [
    - outer island host の shadowRoot / light DOM 内にある descendant island host を収集できる
    - inner host は outer host より先に strategy 発火して hydrate できる
    - outer host の cleanup は pending inner host schedule を巻き込まず、host 単位で独立に cancel する
    - re-scan 後に outer/inner の未発火 host をそれぞれ再 schedule できる
  ],
  impl_notes: [
    - current `collectIslandHosts()` は nested host を収集する形に近いが、これを正式 contract として固定する
    - generic setup hydration plan により outer host が in-place hydration できる場合、nested host DOM 破壊の多くを回避できる
  ],
)

#adr(
  header("nested island host も hydrateIslands の独立スケジュール対象にする", Status.Proposed, "2026-03-18"),
  [
    nearest host boundary ルールだけでは、outer island の subtree 内にある eager child UI を別 strategy で先行起動できない。explicit nested islands を許可するなら runtime scheduler も host ごとの独立性を持つ必要がある。
  ],
  [
    `hydrateIslands()` は ancestor island の存在を理由に descendant island host を除外せず、canonical metadata を持つ host をすべて boundary 候補として収集し、strategy ごとに独立 schedule する。
  ],
  [
    - explicit nested islands が outer/inner 独立で機能する
    - schedule / cleanup / re-scan の責務を host ごとに保てる
    - outer rerender による nested host DOM の破壊を防ぐ別設計が必要になる
  ],
)

#adr(
  header("generic setup hydration plan を hydration runtime の正式経路にする", Status.Proposed, "2026-03-18"),
  [
    `hydrate` option を手書きしない component でも SSR DSD を再利用したい。現状の clear-and-rerender fallback では nested child island や SSR shell を壊しやすい。
  ],
  [
    hydration runtime は compiler-generated generic hydration plan を受け取り、既存 DSD marker と node 参照を使って in-place binding を接続する正式経路を持つ。
  ],
  [
    - generic setup component も hydration-first で扱える
    - nested island support の前提である DOM preservation に近づく
    - transformer/SSR/components とまたぐ artifact 契約の固定が必要になる
  ],
)

#feature_spec(
  name: "hydrate",
  summary: [
    テキストバインディングとイベントバインディングを接続する簡易 Hydrate API。
  ],
  api: [
    ```typescript
    function hydrate(
      root: ShadowRoot,
      bindings: \{
        texts?: Map<number, () => unknown>;
        events?: Map<Element, Map<string, EventListener>>;
      \},
      options?: \{
        store?: AtomStore;
        storeSnapshotSchema?: AtomStoreSnapshot<
          Record<string, PrimitiveAtom<unknown>>
        >;
      \}
    ): RootDispose | null
    ```
  ],
  test_cases: [
    - テキストバインディングをマーカーに接続
    - イベントバインディングを要素に接続
    - ハイドレート済みの root に null を返す
    - request-scoped store オプションを受け取る
    - data-dh-store script から store 値をハイドレート
    - data-dh-store script がない場合は store 値をそのままにする
  ],
)

#feature_spec(
  name: "closed ShadowRoot の処理",
  summary: [
    closed ShadowRoot は Hydration 対象外。DEV モードで `console.warn` を出力し `null` を返す。
  ],
  test_cases: [
    - closed ShadowRoot に null を返し警告する
  ],
)

#feature_spec(
  name: "hydrateTextMarker",
  summary: [
    テキストマーカー直後のテキストノードをリアクティブに更新する。`templateEffect` を使用して値の変更を自動反映する。
  ],
  api: [
    ```typescript
    function hydrateTextMarker(
      marker: MarkerInfo,
      getValue: () => unknown
    ): void
    ```
  ],
  test_cases: [
    - マーカー後のテキストノードをリアクティブに更新
  ],
)

#feature_spec(
  name: "createHydrationContext",
  summary: [
    Hydration コンテキストを作成する。状態解析とマーカー収集を行う。`options.store` が指定された場合はコンテキストに store を保持する。
  ],
  api: [
    ```typescript
    function createHydrationContext(
      root: ShadowRoot,
      options?: HydrationOptions
    ): HydrationContext

    interface HydrationOptions \{
      store?: AtomStore;
      storeSnapshotSchema?: AtomStoreSnapshot<
        Record<string, PrimitiveAtom<unknown>>
      >;
    \}

    interface HydrationContext \{
      state: Record<string, unknown>;
      walker: TreeWalker;
      markers: MarkerInfo[];
      markerIndex: number;
      eventHandlers: Map<Element, Map<string, EventListener>>;
      store?: AtomStore;
    \}
    ```
  ],
  impl_notes: [
    - `WeakMap` による冪等性保証で、同一 ShadowRoot の二重 Hydration を防止
    - islands runtime は host metadata `data-dh-island` / `data-dh-island-value` を読み、component host の internal hook を strategy ごとに起動する
    - `createRoot` スコープで管理し、dispose 時に全リスナーを自動クリーンアップ
    - `__DEV__` フラグで開発/本番の挙動を分岐
    - `state` は `parseStateScript` が `null` を返した場合に `\{\}` でフォールバック（`null` は保持しない）
    - `options.store` がある場合は hydration setup 全体をその store boundary 内で実行する
    - `options.storeSnapshotSchema` がある場合は `data-dh-store` script を parse し、setup 実行前に `storeSnapshotSchema.hydrate(store, snapshot)` を行う
    - `storeSnapshotSchema` を指定する場合は `store` も必須とする
    - `HydrationMismatchError`、`hydrateTextMarker`、`hydrateIslands` は公開 API として export される
    - `nextMarker` は実装内部ユーティリティとして非公開（export しない）
  ],
)

== 将来拡張案

#adr(
  header("first interaction replay を hydration runtime が担う", Status.Proposed, "2026-03-16"),
  [
    `interaction:onClick` 系 syntax では「最初の 1 回の event が hydrate trigger だけで消費される」挙動が UX を悪化させる。colocated client handler を導入するなら、初回 event も author の意図した処理へつなげたい。
  ],
  [
    interaction strategy の trigger event と compiler-generated action event が同一の場合、runtime は初回 event を保持し、host hydrate 完了後に target HTML 要素へ replay する。replay 可否は transformer が action plan metadata で示す。
  ],
  [
    - author は「最初の click から効く」感覚で書きやすくなる
    - runtime に event buffering / replay の責務が増える
    - submit や non-bubbling event など replay semantics の難しいケースは別途検討が必要
  ],
)

== 検討事項

- artifact-based action registry を v2 以降でどう導入するか（static field / symbol / hydrate option 拡張）
- target element marker を attribute にするか comment marker/path にするか
- replay 対象 event を click のみに絞るか、input/change/focus まで含めるか
- target 不在や stale marker を dev warning にするか hydration error にするか
- imported helper や module-level binding を将来の capture model に含めるか
- readonly object / tuple の nested serializability をどこまで保証するか
- `visible:onClick` / `idle:onClick` を phase 2 に含めたあと、`media:onClick` を同じ replay-less path へ載せるか
