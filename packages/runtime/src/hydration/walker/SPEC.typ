= walker API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

Hydration 時に SSR マーカー（コメントノード）を TreeWalker で線形探索する。

== 機能仕様

#feature_spec(
  name: "parseMarker",
  summary: [
    コメントノードの内容をパースし、マーカー情報を抽出する。マーカー形式は `dh:\{type\}:\{id\}`（例: `dh:t:1`）。ブロック終了マーカーは `/dh:b` 形式。
  ],
  api: [
    ```typescript
    function parseMarker(comment: Comment): MarkerInfo | null
    ```

    *型定義*:
    ```typescript
    enum HydrationMarkerType \{
      Text = "t",
      Insert = "i",
      Block = "b",
      BlockEnd = "/b",
    \}

    interface MarkerInfo \{
      type: HydrationMarkerType;
      id: number;
      node: Comment;
    \}
    ```

    *定数*:
    - `MARKER_PREFIX = "dh:"` — マーカーのプレフィックス
    - `BLOCK_END = "/dh:b"` — ブロック終了マーカー
  ],
  test_cases: [
    - テキストマーカーのパース
    - insert マーカーのパース
    - block マーカーのパース
    - block end マーカーのパース
    - 無効なマーカーに null を返す
    - 空コメントに null を返す
    - 部分的なマーカーに null を返す
  ],
)

#feature_spec(
  name: "createWalker",
  summary: [
    コメントノードフィルター付きの `TreeWalker` を作成する。`NodeFilter.SHOW_COMMENT` を使用。
  ],
  api: [
    ```typescript
    function createWalker(root: Node): TreeWalker
    ```
  ],
  test_cases: [
    - コメントノード用の TreeWalker を作成
  ],
)

#feature_spec(
  name: "findMarkers",
  summary: [
    コンテナ内の全マーカーを収集して配列で返す。
  ],
  api: [
    ```typescript
    function findMarkers(container: Node): MarkerInfo[]
    ```
  ],
  test_cases: [
    - コンテナ内の全マーカーを検出
    - マーカーがない場合は空配列を返す
  ],
)

#feature_spec(
  name: "findMarker",
  summary: [
    TreeWalker を使って次のマーカーを検索する。マーカーでないコメントはスキップする。
  ],
  api: [
    ```typescript
    function findMarker(walker: TreeWalker): MarkerInfo | null
    ```
  ],
  test_cases: [
    - Walker 内の次のマーカーを検出
    - マーカーがない場合に null を返す
    - 非マーカーコメントをスキップ
  ],
)

#feature_spec(
  name: "getTextNodeAfterMarker",
  summary: [
    テキストマーカー直後のテキストノードを取得する。存在しなければ空のテキストノードを作成して挿入する。
  ],
  api: [
    ```typescript
    function getTextNodeAfterMarker(marker: Comment): Text | null
    ```
  ],
  test_cases: [
    - マーカー後の既存テキストノードを返す
    - テキストがない場合にテキストノードを作成
    - コメントが最後の子の場合にテキストノードを作成
  ],
  impl_notes: [
    - `TreeWalker` による線形探索は O(n) だが、DOM ツリーを1回走査で完了
    - マーカー形式: `<!--dh:\{type\}:\{id\}-->`（例: `<!--dh:t:1-->`）
    - `getTextNodeAfterMarker` でテキストノードがなければ作成することで、SSR 出力の空テキスト問題に対処
  ],
)
