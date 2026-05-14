= staticTree

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

JSX 変換が生成した compile-time tree descriptor を静的に読み取り、CSR markup cache や SSR shell で再利用できる HTML 断片へシリアライズする補助機能。

== 機能仕様

#feature_spec(
  name: "static tree roots parsing",
  summary: [
    ESTree の `ArrayExpression` で表現された tree descriptor を `StaticTreeNode` の配列として読み取る。
    静的に評価できない descriptor は `null` を返し、呼び出し側が通常の runtime path に fallback できるようにする。
  ],
  api: [
    ```typescript
    function readStaticTreeRoots(tree: ESTNode): StaticTreeNode[] | null
    ```
  ],
  edge_cases: [
    - root が `ArrayExpression` でない場合は `null`
    - root 配列または children に hole / null entry がある場合は `null`
    - tag が string literal でない場合は `null`
    - attrs が `null` literal または静的 object literal でない場合は `null`
    - `{text}` / `{insert}` / `{each}` marker は専用 node として扱う
  ],
  test_cases: [
    - 静的な HTML tree descriptor を読み取る
    - `{text}` marker を読み取る
    - 静的でない descriptor は `null` を返す
  ],
)

#feature_spec(
  name: "static markup serialization",
  summary: [
    読み取った `StaticTreeNode` を HTML markup へシリアライズする。
    text は HTML escape し、attribute は attribute 文脈で escape する。
    style object は kebab-case の CSS text に変換する。
  ],
  api: [
    ```typescript
    function serializeMarkupNode(
      node: StaticTreeNode,
      namespace: "html" | "svg" | "math",
      textPlaceholderId: { current: number },
    ): string

    function serializeStaticAttrs(
      attrs: Record<string, StaticAttrValue> | null,
    ): string
    ```
  ],
  edge_cases: [
    - `null` / `false` attribute は出力しない
    - `true` attribute は boolean attribute として出力する
    - HTML void element は closing tag を出力しない
    - SVG / MathML namespace 内では HTML void element 処理を適用しない
    - `{text}` marker は stable id 付き placeholder comment へ変換する
  ],
  test_cases: [
    - text と attribute を escape する
    - boolean / null attribute を HTML attribute としてシリアライズする
    - style object を CSS text に変換する
    - HTML void element を self-closing shell としてシリアライズする
  ],
)

#feature_spec(
  name: "custom element detection",
  summary: [
    static tree 内に custom element tag（hyphen を含む tag）が含まれるかを検出する。
    SSR では custom element を含む tree を compile-time shell ではなく `renderToString()` fallback へ送る判断に使う。
  ],
  api: [
    ```typescript
    function hasCustomElement(node: StaticTreeNode): boolean
    ```
  ],
  test_cases: [
    - descendant custom element を検出する
    - 通常 HTML element だけの場合は false を返す
  ],
)
