= fromTree API

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

構造化配列（Tree）から DOM フラグメントを生成するファクトリ関数を提供する。Svelte 5 の `from_tree` アプローチに基づく。

== 機能仕様

#feature_spec(
  name: "fromTree",
  summary: [
    構造化配列から DOM を生成するファクトリ関数を返す。
  ],
  api: [
    ```typescript
    function fromTree(
      structure: readonly Tree[],
      flags?: Namespace
    ): () => DocumentFragment

    function fromMarkup(
      markup: string,
      flags?: Namespace
    ): () => DocumentFragment
    ```

    - `WeakMap` によるテンプレートキャッシュで、2回目以降は `cloneNode(true)` による高速クローン
    - プレースホルダー（`{text}`、`{insert}`、`{each}` 等）はスキップし、静的部分のみ生成
    - `flags` で名前空間を指定（HTML=0、SVG=1、MathML=2）
    - キャッシュキーは `structure` 配列参照と `flags` の組み合わせ（異なる `flags` は独立したキャッシュエントリ）
    - compiler-generated output 向けに、tree 配列の代わりに事前シリアライズ済みテンプレート descriptor も受け取れる
      - descriptor は静的 markup 文字列と root namespace を含む
      - runtime は descriptor を再度 tree 解釈せず、markup を 1 回だけ template 化してクローンする
      - compiler が text placeholder を comment marker として埋め込んだ場合、runtime は template 初期化時に空 text node へ置き換える
    - `fromMarkup()` は runtime 外部から HTML/SVG/MathML markup 文字列を runtime の DOM 構築経路で `DocumentFragment` 化するための公開 API として提供する
    - 入力 `markup` は **信頼できるソースからのみ渡すこと** — `innerHTML` 経由でパースされるため、インラインイベントハンドラや `javascript:` URL を含む文字列を挿入すると XSS 脆弱性となる

    *型定義*:

    構造化配列の型は `@/types/tree` で定義：

    - `Tree`: `TreeNode | TextContent | Placeholder`
    - `TreeNode`: `[tag: string, attrs: Attrs | null, ...children: Tree[]]`
    - `Placeholder`: `[type: PlaceholderType, id: number | null]`
    - `Namespace`: `enum { HTML = 0, SVG = 1, MathML = 2 }`
  ],
  test_cases: [
    - 単純な要素の生成
    - 属性付き要素の生成
    - style オブジェクトを CSS テキストにシリアライズ
    - 空の style オブジェクトの省略
    - テキストノードの生成
    - ネストした要素の生成
    - \{text\} プレースホルダー用テキストノードの生成
    - \{insert\} プレースホルダー用コメントノードの生成
    - 空配列の処理
    - プレースホルダー混在の子要素処理
    - 複数のルート要素
    - 深くネストした要素
    - テンプレートファクトリのキャッシュ
    - クローンされたフラグメントを返す
    - compiler-generated descriptor からフラグメントを生成する
    - markup 文字列からフラグメントを生成する
    - compiler-generated text placeholder marker を空 text node に変換する
    - SVG 要素を正しい名前空間で生成
    - 異なる flags で独立したキャッシュエントリを生成
    - MathML 名前空間の自動検出
    - bare SVG markup descriptor を正しい名前空間で生成する
  ],
  impl_notes: [
    - テンプレートキャッシュに `WeakMap` を使用し、GC によるメモリ解放を保証
    - `cloneNode(true)` による DOM クローンは、`innerHTML` パースより高速かつ予測可能
    - compiler-generated descriptor path は tree 解釈の代わりに HTML/template parser を利用して初期テンプレートを作る
  ],
)

== 設計判断

#adr(
  header("SVG/MathML 名前空間の自動検出", Status.Accepted, "2026-02-11"),
  [
    呼び出し側で名前空間を手動指定するのは煩雑。
  ],
  [
    `<svg>` タグと `<math>` タグで自動的に名前空間を切り替える。
    - `tag === "svg"` → `Namespace.SVG`
    - `tag === "math"` → `Namespace.MathML`
    - 子要素のレンダリング後、親の名前空間に復元
    - これにより、`<div><svg>...</svg></div>` のような混在構造も正しく動作
  ],
  [
    transformer の生成コードで名前空間を意識する必要がなく、コードが簡潔になる。
  ],
)

#adr(
  header("style オブジェクトのサポート", Status.Accepted, "2026-02-11"),
  [
    JSX で `style={{ padding: "20px", borderRadius: "8px" }}` のように書きたい。
  ],
  [
    属性設定時に style オブジェクトを検出し、CSS 文字列に変換。
    - `camelCase` → `kebab-case` への変換
    - null/空文字の値を除外
    - 結果が空なら style 属性を設定しない
  ],
  [
    JSX の自然なスタイル記法をそのまま使えるため、別途 CSS 文字列を組み立てる必要がない。
  ],
)
