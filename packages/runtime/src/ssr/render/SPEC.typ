= render API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

構造化配列（Tree）を SSR 用の HTML 文字列にレンダリングする。

== 機能仕様

#feature_spec(
  name: "renderTree",
  summary: [
    構造化配列を HTML 文字列にレンダリングする。マーカーを自動挿入し、Hydration に対応した出力を生成する。
  ],
  api: [
    ```typescript
    function renderTree(tree: Tree\[\], options?: RenderOptions): string
    ```

    - `tree`: レンダリング対象の構造化配列
    - `options`: レンダリングオプション（任意）

    *RenderContext*:
    ```typescript
    interface RenderContext {
      markerId: number;
      state: StateObject;
      dynamicValues: Map<number, unknown>;
      componentRenderer?: ComponentRenderer;
      store?: AtomStore;
      storeSnapshotSchema?: AtomStoreSnapshot<Record<string, PrimitiveAtom<unknown>>>;
    }
    ```

    `ComponentRenderer` は Web Components の Declarative Shadow DOM (DSD) 内容を生成する関数。

    - 引数: `tagName` (カスタム要素名), `attrs` (属性オブジェクト)
    - 第3引数で request-scoped `store` を受け取れる
    - 戻り値: DSD の HTML 文字列、または `null`（登録されていない場合）

    `RenderOptions` は必要に応じて `store?: AtomStore` と `storeSnapshotSchema?: AtomStoreSnapshot<...>` を受け取り、SSR render 全体を request-scoped store boundary 内で評価できる。

    - render 実行中に nested `withStore()` boundary が作られた場合、`ComponentRenderer` にはその時点で active な store を優先して渡す
    - `storeSnapshotSchema` が指定された場合、SSR 出力へ `<script type="application/json" data-dh-store>...</script>` を挿入する
    - `storeSnapshotSchema` を使う場合は `store` も必須とする
    - `data-dh-store` の payload は `storeSnapshotSchema.serialize(store)` を `serializeState()` でシリアライズした plain object とする
    - 既存の `data-dh-state` とは別 script として扱う
  ],
  test_cases: [
    - 単純な要素をレンダリング
    - ネストされた要素をレンダリング
    - void 要素を正しくレンダリング
    - boolean 属性をレンダリング
    - 属性のイベントハンドラをスキップ
    - テキストコンテンツの HTML をエスケープ
    - 属性値の HTML をエスケープ
    - テキストプレースホルダーをマーカー付きでレンダリング
    - each プレースホルダーをブロックマーカー付きでレンダリング
    - 複数の動的値をレンダリング
    - request-scoped store を render option 経由で ComponentRenderer に渡す
    - nested render で active store boundary を render option の store より優先する
    - storeSnapshotSchema 指定時に store snapshot script を出力する
    - style オブジェクトを CSS 文字列にシリアライズして SSR 出力に含める
    - compiled SSR helper が dynamic text / attr / spread / insert / each を文字列へレンダリングできる
    - setComponentRenderer で設定したグローバル componentRenderer を使用する
    - storeSnapshotSchema を store なしで指定するとエラーをスローする
  ],
  edge_cases: [
    - `storeSnapshotSchema` 指定時に `store` が未指定の場合はエラーをスローする
    - `ComponentRenderer` が `null` を返した場合は通常の要素として扱う
  ],
  impl_notes: [
    - `escapeHtml`: XSS 防止のための HTML エスケープ
    - `escapeAttr`: 属性値のエスケープ
    - `camelToKebab`: CSS プロパティ名を camelCase → kebab-case に変換
    - `serializeStyleObject`: style オブジェクトを CSS 文字列に変換
    - `renderAttrs`: 属性のレンダリング（boolean 属性、style オブジェクト対応）
    - compiled SSR helper 群は transformer が事前生成した静的 shell へ動的値だけを埋め込む
    - Void 要素（`<br>`、`<img>` 等）の閉じタグ省略
    - Boolean 属性（`disabled`, `checked` 等）の判定
    - Declarative Shadow DOM の生成（カスタム要素向け）
    - store snapshot schema がある場合の `<script data-dh-store>` 生成
    - Web 標準 API のみ使用（Node.js 依存ゼロ）
    - HTML エスケープは最小限の置換で実装（バンドルサイズ考慮）
    - プレースホルダーはマーカーに変換し、動的値があれば埋め込む
    - compiler-generated generic hydration plan を使う component では、SSR marker / stable node reference を hydration runtime と共有できるよう出力を安定化する
    - 動的テキスト値の後には `<!---->` を挿入し、Hydration 時にブラウザが隣接テキストノードを結合してしまう問題を防止する
  ],
)

#feature_spec(
  name: "generic hydration plan compatible SSR output (proposal)",
  summary: [
    compiler-generated generic hydration plan が既存 DSD へ接続できるよう、SSR 出力は marker と安定した node 参照規則を保持する。
  ],
  constraints: [
    - text / insert の既存 hydration marker はそのまま再利用できる
    - attr / event binding が必要な要素には plan 側で参照可能な stable path または stable binding id を与える
    - nested island host は outer plan が opaque subtree として扱えるよう boundary marker または stable host 参照を持てる
  ],
  test_cases: [
    - generic hydration plan 対応 component の SSR 出力は text/insert marker を保持する
    - attr/event binding 対象要素を plan から一意に参照できる
    - nested island host を outer hydration plan から opaque boundary として識別できる
  ],
  impl_notes: [
    - render API 自体の public surface は増やさず、component renderer と `planFactory` が前提とする marker/path 契約として扱ってよい
  ],
)

#feature_spec(
  name: "compiled SSR helper primitives",
  summary: [
    transformer が事前生成した static shell へ dynamic text / attr / spread / insert / each を埋め込むための helper を提供する。
  ],
  api: [
    ```typescript
    function renderDynamicText(value: unknown): string
    function renderDynamicInsert(value: unknown): string
    function renderDynamicEach(value: unknown): string
    function renderDynamicAttr(name: string, value: unknown): string
    function renderDynamicSpread(props: Record<string, unknown> | null | undefined): string
    ```
  ],
  test_cases: [
    - dynamic text を HTML escape してレンダリングする
    - dynamic insert は string のみをそのまま出力し、それ以外は空 placeholder comment を返す
    - dynamic each は string array を連結する
    - dynamic attr は boolean / style object / nullish を generic render と同じ規則で処理する
    - dynamic spread は event handler を除外し、各 key を attr helper と同じ規則で処理する
  ],
)

#feature_spec(
  name: "renderToString",
  summary: [
    状態付きの完全な HTML 文字列を生成する便利メソッド。`renderTree` + 状態スクリプトの挿入を行う。
  ],
  api: [
    ```typescript
    function renderToString(
      tree: Tree\[\],
      state?: StateObject,
      dynamicValues?: Map<number, unknown>,
      componentRenderer?: ComponentRenderer,
      store?: AtomStore,
    ): string

    function renderToString(
      tree: Tree\[\],
      options?: RenderOptions,
    ): string
    ```

    - `tree`: レンダリング対象の構造化配列
    - `state`: Signal の初期値オブジェクト（任意）
    - `dynamicValues`: 動的値のマップ（任意）
    - `componentRenderer`: コンポーネントレンダラー関数（任意）
    - `store`: request-scoped AtomStore（任意）
    - `options`: RenderOptions オブジェクト形式のオーバーロード（任意）
  ],
  test_cases: [
    - 状態付きでレンダリング
    - 状態が空の場合 state script をスキップ
    - 第5引数として request-scoped store を受け付ける
    - オブジェクトオーバーロードで storeSnapshotSchema をサポート
  ],
)

#feature_spec(
  name: "setComponentRenderer",
  summary: [
    グローバルな ComponentRenderer を設定する。SSR 時に Web Components の Declarative Shadow DOM を生成するために使用する。
  ],
  api: [
    ```typescript
    function setComponentRenderer(renderer: ComponentRenderer | undefined): void
    ```

    - `renderer`: 設定するレンダラー関数、または `undefined` で解除
  ],
  impl_notes: [
    - 個別の `RenderOptions` でもオーバーライド可能
  ],
)

#feature_spec(
  name: "createContext",
  summary: [
    レンダリングコンテキストを生成する。マーカー ID のカウンターや状態を管理する。
  ],
  api: [
    ```typescript
    function createContext(options?: RenderOptions): RenderContext
    ```

    - `options`: レンダリングオプション（任意）
  ],
  impl_notes: [
    - `state` と `dynamicValues` は null 非許容で、`createContext` で `options.state ?? {}` のように初期化
  ],
)

== 設計判断

#adr(
  header("Declarative Shadow DOM 対応", Status.Accepted, "2026-02-11"),
  [
    Web Components の SSR には Declarative Shadow DOM (DSD) が必要。
  ],
  [
    `ComponentRenderer` を使用して DSD を生成。
    - カスタム要素（タグ名に `-` を含む）を検出
    - `ComponentRenderer` が登録されていれば、DSD 形式で出力:
      ```html
      <my-component>
        <template shadowrootmode="open">
          {Shadow DOM content}
        </template>
      </my-component>
      ```
    - `ComponentRenderer` が `null` を返せば通常の要素として扱う
  ],
  [
    Web Components を SSR で正しくレンダリングできる。クライアント側でのハイドレーション時に Shadow DOM を再構築する必要がない。
  ],
)

#adr(
  header("グローバル ComponentRenderer", Status.Accepted, "2026-02-11"),
  [
    すべてのレンダリング関数で同じ ComponentRenderer を共有したい。
  ],
  [
    `setComponentRenderer()` でグローバルに設定可能。
    - 個別の `RenderOptions` でもオーバーライド可能
  ],
  [
    コンポーネントレンダラーを一箇所で登録すれば全レンダリングに反映される。テスト時はオーバーライドで差し替えが可能。
  ],
)

#adr(
  header("state と dynamicValues の null 非許容", Status.Accepted, "2026-02-11"),
  [
    空オブジェクト/Map で統一したほうがコードが簡潔。
  ],
  [
    `RenderContext` では `state` と `dynamicValues` を null 非許容で定義。
    - `createContext` で `options.state ?? {}` のように初期化
  ],
  [
    各関数で null チェックが不要になり、コードが簡潔になる。
  ],
)

#adr(
  header("style オブジェクトのサポート", Status.Accepted, "2026-02-11"),
  [
    JSX で `style={{ padding: "20px" }}` のように書きたい。
  ],
  [
    `renderAttrs` 内で style オブジェクトを CSS 文字列に変換。
    - `camelCase` → `kebab-case` への変換
    - null/空文字の値を除外
  ],
  [
    JSX の自然な記法でスタイルを記述でき、SSR でも正しく出力される。
  ],
)

#adr(
  header("SSR store は request-scoped render option で渡す", Status.Accepted, "2026-03-10"),
  [
    SSR 中に store を使う場合、module global ではなく request ごとに分離された store instance を render 呼び出し側から明示的に渡す必要がある。
  ],
  [
    `RenderOptions.store` と `renderToString(..., store?)` を通じて store を受け取り、render 全体をその store boundary 内で実行する。`ComponentRenderer` にも同じ store を渡す。
  ],
  [
    request 境界が明確になり、components/ssr 側の `ctx.store` と整合する。
  ],
)

#adr(
  header("ComponentRenderer は active store boundary を優先する", Status.Accepted, "2026-03-11"),
  [
    SSR 中に nested helper が `withStore()` でより内側の store boundary を作る場合、custom element DSD render でもその内側 boundary を観測する必要がある。
  ],
  [
    custom element render 時は render option の `store` だけでなく current active store boundary を確認し、存在する場合は active boundary を優先して `ComponentRenderer` へ渡す。
  ],
  [
    - nested SSR helper でも store override が一貫して動作する
    - `components/ssr` の `ctx.store` fallback と整合する
    - explicit root store は fallback として維持できる
  ],
)

#adr(
  header("store snapshot は明示 schema に基づく別 script として埋め込む", Status.Accepted, "2026-03-10"),
  [
    SSR 時に store の値を hydration へ渡したいが、既存の reactivity state script と責務を混ぜると構造が曖昧になる。
  ],
  [
    `storeSnapshotSchema` が指定された場合は `<script type="application/json" data-dh-store>` を別途出力し、payload には schema が列挙した primitive atom 値だけを plain object として格納する。
  ],
  [
    - store transfer と既存 state transfer の責務を分離できる
    - schema ベースの明示 transfer と整合する
    - hydration 側で store snapshot だけを独立に復元できる
  ],
)
