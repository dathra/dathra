#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

= css tagged template literal

== 目的

`css` タグ付きテンプレートリテラルを提供し、`CSSStyleSheet` を生成する。`defineComponent` の `styles` オプションで使用され、Shadow DOM の `adoptedStyleSheets` に適用される。SSR 環境では `CSSStyleSheet` API が存在しないため、生の CSS テキストを保持する `DathraStyleSheet` オブジェクトを返す。

== インターフェース仕様

#interface_spec(
  name: "css / getCssText / global styles API",
  summary: [
    CSS テンプレート文字列を `CSSStyleSheet` または SSR 互換オブジェクトへ変換し、生の CSS テキストを抽出する API。加えて、Shadow DOM component 群へ共有スタイルを配布する `adoptGlobalStyles()` を提供する。
  ],
  format: [
    ```typescript
    function css(
      strings: TemplateStringsArray,
      ...values: unknown[]
    ): CSSStyleSheet

    function getCssText(
      sheet: CSSStyleSheet | string
    ): string | undefined

    function adoptGlobalStyles(
      ...styles: readonly (CSSStyleSheet | string)[]
    ): void

    function clearGlobalStyles(): void

    interface DathraStyleSheet extends CSSStyleSheet {
      __cssText: string;
    }
    ```
  ],
  constraints: [
    - `css()` はテンプレート文字列と補間値を結合して CSS テキストを構築する
    - CSR では `new CSSStyleSheet()` を作成し、`replaceSync()` で適用する
    - SSR では `{ __cssText }` を返す
    - `getCssText()` は文字列をそのまま返し、`__cssText` があればその値を返し、未付与の `CSSStyleSheet` では `cssRules` から復元を試みる
    - `adoptGlobalStyles()` は module-scope registry へ style を登録する
    - `clearGlobalStyles()` は登録済み global style registry を空にする
    - global style は CSS テキストまたは sheet identity 単位で重複登録しない
    - 登録済み global style は将来接続される Dathra component にも適用される
    - 既に接続済みの Dathra component に対しても global style の追加を反映する
  ],
)

== 機能仕様

#feature_spec(
  name: "stylesheet generation",
  summary: [
    CSR では `CSSStyleSheet` を、SSR では `__cssText` を持つ互換オブジェクトを返し、両環境で同じ入力 API を提供する。
  ],
  test_cases: [
    1. `CSSStyleSheet` インスタンスを返す
    2. 補間値を正しく処理する
    3. 空のスタイルを処理する
    4. 複数の補間を処理する
    5. `getCssText()` が `__cssText` を返す
    6. `getCssText()` が文字列をそのまま返す
  ],
)

#feature_spec(
  name: "global stylesheet adoption",
  summary: [
    `adoptGlobalStyles()` により、複数 component で共有する Shadow DOM 向け style を registry 化し、CSR の `adoptedStyleSheets` と SSR の DSD `<style>` 出力の両方で再利用できるようにする。
  ],
  test_cases: [
    1. `adoptGlobalStyles()` が string / `CSSStyleSheet` の両方を登録できる
    2. `css()` 由来でない `CSSStyleSheet` でも `cssRules` から CSS テキストを復元して登録できる
    3. 同じ CSS テキストまたは同じ sheet instance を重複登録しない
    4. 登録済み global style の CSS テキストを SSR 用に取得できる
    5. 登録後に接続済み ShadowRoot にも style が反映される
    6. `clearGlobalStyles()` が registry を空にして後続テストや再レンダリングを汚染しない
  ],
)

== 設計判断

#adr(
  header("CSSStyleSheet + __cssText の二重保持", Status.Accepted, "2026-03-09"),
  [
    SSR では Declarative Shadow DOM の `<style>` 出力に生の CSS テキストが必要だが、`CSSStyleSheet` API からは容易に復元できない。
  ],
  [
    CSR 環境でも `__cssText` プロパティに元の CSS テキストを保持する。
  ],
  [
    - CSR と SSR で一貫した API を保てる
    - メモリ使用量はわずかに増えるが DSD 出力が容易になる
  ],
)

#adr(
  header("SSR 環境でのフォールバック", Status.Accepted, "2026-03-09"),
  [
    Node.js などの SSR 環境には `CSSStyleSheet` API が存在しない。
  ],
  [
    SSR では `CSSStyleSheet` の代わりに `{ __cssText }` オブジェクトを返す。
  ],
  [
    - SSR でも同じ `css()` API を使える
    - `getCssText()` で安全に CSS テキストを取得できる
  ],
)

#adr(
  header("global style は registry で管理し ShadowRoot へ後付け反映する", Status.Accepted, "2026-03-15"),
  [
    Shadow DOM component 群へ共通 style を配るには、component ごとに同じ style を個別定義するだけでは重複が多く、後から theme / design token を追加したときに既存 root へも反映したい。
  ],
  [
    `adoptGlobalStyles()` は module-scope registry に shared style を登録し、接続済み ShadowRoot と将来接続される ShadowRoot の両方へ global style を適用する。
  ],
  [
    - component local style と別軸で shared style を扱える
    - SSR / CSR で同じ global style source を共有できる
    - design token や typography のような横断 style を管理しやすい
  ],
)
