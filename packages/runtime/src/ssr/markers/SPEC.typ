= markers API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

SSR 出力に挿入するマーカー文字列を生成する。Hydration 時にこれらのマーカーを探索して動的ノードを特定する。

== 機能仕様

#feature_spec(
  name: "createMarker",
  summary: [
    SSR 用コメントマーカー文字列を生成する。形式: `<!--dh:{type}:{id}-->`
  ],
  api: [
    ```typescript
    function createMarker(type: MarkerType, id: number | string): string
    ```

    - `type`: マーカー種別（`MarkerType` enum 値）
    - `id`: マーカーの一意識別子（数値または文字列）

    *MarkerType enum*:
    ```typescript
    enum MarkerType {
      Text = "t",
      Insert = "i",
      Block = "b",
    }
    ```
  ],
  test_cases: [
    - 数値 ID でテキストマーカーを生成
    - 文字列 ID でテキストマーカーを生成
    - 挿入マーカーを生成
    - ブロックマーカーを生成
  ],
  impl_notes: [
    - コメントノードベースのマーカーで、DOM 構造に影響を与えない
  ],
)

#feature_spec(
  name: "createBlockEndMarker",
  summary: [
    ブロック終了マーカーを生成する。形式: `<!--/dh:b-->`
  ],
  api: [
    ```typescript
    function createBlockEndMarker(): string
    ```
  ],
  test_cases: [
    - ブロック終了マーカーを生成
  ],
)

#feature_spec(
  name: "createDataMarker",
  summary: [
    要素用 data 属性マーカーを生成する。形式: `data-dh="{id}"`
  ],
  api: [
    ```typescript
    function createDataMarker(id: number | string): string
    ```

    - `id`: 要素の一意識別子（数値または文字列）
  ],
  test_cases: [
    - 数値 ID で data 属性を生成
    - 文字列 ID で data 属性を生成
  ],
  impl_notes: [
    - `data-dh` 属性マーカーは要素にバインドされた動的データの識別に使用
  ],
)

#feature_spec(
  name: "createStateScript",
  summary: [
    状態スクリプトタグを生成する。形式: `<script type="application/json" data-dh-state>{state}</script>`
  ],
  api: [
    ```typescript
    function createStateScript(serializedState: string): string
    ```

    - `serializedState`: シリアライズ済みの状態文字列
  ],
  test_cases: [
    - 状態スクリプト要素を生成
    - 空の状態を処理
  ],
  impl_notes: [
    - `type="application/json"` でブラウザのスクリプト実行を防止
  ],
)

#feature_spec(
  name: "createStoreScript",
  summary: [
    store snapshot スクリプトタグを生成する。形式: `<script type="application/json" data-dh-store>{snapshot}</script>`
  ],
  api: [
    ```typescript
    function createStoreScript(serializedSnapshot: string): string
    ```

    - `serializedSnapshot`: シリアライズ済みの store snapshot 文字列
  ],
  test_cases: [
    - store snapshot スクリプト要素を生成
  ],
  impl_notes: [
    - `type="application/json"` でブラウザのスクリプト実行を防止
  ],
)

== マーカープロトコル

- テキスト: `<!--dh:t:{id}-->` — 動的テキストの位置を示す
- 挿入: `<!--dh:i:{id}-->` — 動的コンポーネント挿入位置を示す
- ブロック: `<!--dh:b:{id}-->...<!--/dh:b-->` — 条件分岐/リストのブロック範囲
- 状態: `<script type="application/json" data-dh-state>` — シリアライズされた Signal 初期値
- store: `<script type="application/json" data-dh-store>` — シリアライズされた store snapshot
