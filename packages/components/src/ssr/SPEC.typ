#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

= SSR DSD Renderer

== 目的

Declarative Shadow DOM を使った Web Components の SSR レンダリングを提供する。React、Vue、Next.js など、任意のフレームワークから利用可能なクロスフレームワーク API として機能する。

== インターフェース仕様

#interface_spec(
  name: "SSR renderer API",
  summary: [
    Web Component を Declarative Shadow DOM 付きの HTML 文字列として SSR 出力する API 群。
  ],
  format: [
    ```typescript
    function renderDSD(
      target: string | ComponentMetadata,
      attrs?: Record<string, unknown>,
      options?: {
        store?: AtomStore;
        storeSnapshotSchema?: AtomStoreSnapshot<Record<string, PrimitiveAtom<unknown>>>;
      },
    ): string

    function renderDSDContent(
      target: string | ComponentMetadata,
      attrs?: Record<string, unknown>,
      options?: {
        store?: AtomStore;
        storeSnapshotSchema?: AtomStoreSnapshot<Record<string, PrimitiveAtom<unknown>>>;
      },
    ): string

    function ensureComponentRenderer(): void

    function createComponentRenderer(): (
      tagName: string,
      attrs: Record<string, unknown>,
    ) => string | null

    interface ComponentMetadata {
      readonly __tagName__: string;
    }
    ```
  ],
  constraints: [
    - `renderDSD()` は `<custom-el><template shadowrootmode="open">...</template></custom-el>` を返す
    - `renderDSDContent()` は template 部分のみ返す
    - 未登録コンポーネントでは `renderDSD()` と `renderDSDContent()` は例外を投げる
    - `ensureComponentRenderer()` は冪等である
    - `createComponentRenderer()` が返す renderer は未登録時に `null` を返す
    - `renderDSD()` は属性値中の `&`, `"`, `<`, `>` を HTML エスケープする
    - `options.store` が指定された場合、SSR 時の `ComponentContext.store` はその store instance を返す
    - `options.store` が未指定でも、active な `withStore()` boundary が存在する場合はその store instance を返す
    - `options.store` も active `withStore()` boundary もない場合、SSR 時の `ctx.store` アクセスは明示的に例外を投げる
    - `options.storeSnapshotSchema` が指定された場合、DSD template 内へ `<script type="application/json" data-dh-store>` を含める
    - `options.storeSnapshotSchema` を使う場合は `options.store` も必須とする
    - `adoptGlobalStyles()` で登録済みの global style は component local style より前に DSD `<style>` として出力する
    - 同一 CSS テキストが global/local の両方に存在する場合、DSD `<style>` は 1 回だけ出力する
    - compiler-generated generic hydration plan に対応する component では、DSD template 内に hydration runtime が参照できる marker / stable binding reference を保持する
  ],
)

== 機能仕様

#feature_spec(
  name: "DSD rendering",
  summary: [
    registry 上の ComponentRegistration を参照し、属性値の型変換と CSS 付与を行ったうえで DSD HTML を生成する。
  ],
  test_cases: [
    1. `renderDSD()` が完全な要素 HTML を生成する
    2. `renderDSD()` に Component Class を渡せる
    3. `renderDSD()` に tagName 文字列を渡せる
    4. `renderDSD()` が未登録コンポーネントで例外を投げる
    5. `renderDSDContent()` が DSD template のみ生成する
    6. `renderDSDContent()` に Component Class を渡せる
    7. `renderDSDContent()` が未登録コンポーネントで例外を投げる
    8. 属性値が正しく HTML エスケープされる
    9. CSS が `<style>` タグとして DSD に含まれる
    10. 複数の `<style>` タグが正しく出力される
    10.5. global style が component local style より前に出力される
    10.6. global/local で重複する CSS テキストは 1 回だけ出力される
    11. `ensureComponentRenderer()` が複数回呼ばれても安全である
    12. `createComponentRenderer()` が返す renderer が未登録コンポーネントで `null` を返す
      13. `Number` 型プロップで `null` 属性はデフォルト値を使う
      14. `String` 型プロップで `null` 属性はデフォルト値を使う
      15. SSR で `options.store` を渡した場合、`ctx.store` から同じ store instance を取得できる
    16. SSR で `options.store` がなくても active `withStore()` boundary がある場合、`ctx.store` からその store instance を取得できる
    17. SSR で `options.store` も active `withStore()` boundary もない場合、`ctx.store` にアクセスすると明示エラーになる
    18. `options.storeSnapshotSchema` を渡した場合、DSD に `data-dh-store` script が含まれる
    19. `options.storeSnapshotSchema` を `options.store` なしで使うとエラーになる
    20. `_resetRendererState()` は components 側の初期化フラグだけでなく runtime 側の global renderer も解除し、テスト間で状態を分離する
  ],
  impl_notes: [
    *使用例*:
    - React/Next.js/Vue などから `renderDSD()` または `renderDSDContent()` を直接呼び出せる
    - `defineComponent` が SSR で初回評価された際に `ensureComponentRenderer()` を自動実行する
    - generic setup hydration plan 対応 component では SSR marker/path 契約と hydration plan が同じ reference 規則を共有する
  ],
)

#feature_spec(
  name: "generic setup hydration compatible DSD output (proposal)",
  summary: [
    transform 由来 generic setup component が client で in-place hydration できるよう、DSD renderer は `planFactory` が期待する marker/path 契約を壊さない形で出力する。
  ],
  test_cases: [
    - generic hydration plan 対応 component の DSD は hydration marker を保持する
    - nested island host を含む DSD でも child host を境界として識別できる
    - plan 非対応 component は従来どおり単純 DSD 出力でよい
  ],
  impl_notes: [
    - public API surface は維持しつつ、renderer は extra artifact transport を増やさず existing marker/path 規則の安定化に集中する
  ],
)

== 設計判断

#adr(
  header("クロスフレームワーク対応", Status.Accepted, "2026-03-09"),
  [
    Dathra 以外の SSR 環境でも Web Components を利用できるようにする必要がある。
  ],
  [
    `renderDSD` と `renderDSDContent` を独立した API として提供する。
  ],
  [
    - React、Vue、Next.js などでも利用できる
    - Dathra の `renderToString` に依存しない
  ],
)

#adr(
  header("Component Class サポート", Status.Accepted, "2026-03-09"),
  [
    タグ名文字列だけだと typo が起きやすく、リファクタリングも弱い。
  ],
  [
    `renderDSD` / `renderDSDContent` の第一引数に Component Class を受け入れる。
  ],
  [
    - `__tagName__` からタグ名を安全に取得できる
    - 文字列指定も下位互換として残す
  ],
)

#adr(
  header("属性の自動エスケープ", Status.Accepted, "2026-03-09"),
  [
    SSR で文字列連結により HTML を生成するため、属性値の XSS 対策が必要である。
  ],
  [
    `renderDSD` が生成する属性値を自動的に HTML エスケープする。
  ],
  [
    - `renderDSD()` 内部で `&`, `"`, `<`, `>` を変換する
    - 利用者が個別にエスケープを意識しなくてよい
  ],
)

#adr(
  header("ComponentRenderer の自動セットアップ", Status.Accepted, "2026-03-09"),
  [
    SSR 初期化を利用者に委ねると、セットアップ忘れが起きやすい。
  ],
  [
    `defineComponent` が SSR で初めて呼ばれた際に `ensureComponentRenderer()` を自動実行する。
  ],
  [
    - ボイラープレートが減る
    - `_rendererInitialized` による冪等制御が必要になる
  ],
)

#adr(
  header("Declarative Shadow DOM の採用", Status.Accepted, "2026-03-09"),
  [
    SSR HTML からブラウザが直接 Shadow DOM を構築できる仕組みが必要である。
  ],
  [
    SSR HTML に `<template shadowrootmode="open">` を使用する。
  ],
  [
    - JavaScript なしで Shadow DOM を構築できる
    - Hydration で既存 DOM を再利用しやすい
    - 古いブラウザでは defineComponent 側のフォールバックが必要
  ],
)

#adr(
  header("SSR における属性→プロップ型変換", Status.Accepted, "2026-03-09"),
  [
    CSR と SSR で属性値の解釈が一致しないと Hydration Mismatch が発生する。
  ],
  [
    SSR の `coerceForSSR` は CSR の `coerceValue` と同じ型変換ルールに従う。
  ],
  [
    - `Boolean`: 属性存在で `true`、不在で `false`
    - `Number` と `String`: `null` ならデフォルト値にフォールバック
    - カスタム関数は `null` を含めてそのまま渡す
  ],
)

#adr(
  header("SSR store は request-scoped option として渡す", Status.Accepted, "2026-03-10"),
  [
    SSR では module global store を使わず、request ごとに分離された store instance を明示的に渡す必要がある。
  ],
  [
    `renderDSD` / `renderDSDContent` は `options.store` を受け取り、指定時のみ `ctx.store` を有効化する。未指定時の `ctx.store` は明示エラーとする。
  ],
  [
    - SSR request 境界を明示できる
    - CSR の `withStore()` モデルと整合する
    - store を必要としない SSR 利用では追加コストなしで使える
  ],
)

#adr(
  header("SSR store は active boundary fallback を許可する", Status.Accepted, "2026-03-11"),
  [
    nested SSR helper や custom renderer が `renderDSD()` / `renderDSDContent()` を既存の store boundary 内から呼び出す場合、毎回 `options.store` を明示しないと利用が不自然になる。
  ],
  [
    `options.store` がない場合でも active な `withStore()` boundary があればその store を `ctx.store` に使い、どちらも存在しない場合のみ明示エラーとする。
  ],
  [
    - explicit option を最優先しつつ nested SSR helper との相性を保てる
    - CSR の `withStore()` モデルと揃う
    - store が不要な SSR 利用では従来どおり追加コストなしで使える
  ],
)

#adr(
  header("DSD store snapshot は template 内の別 script として出力する", Status.Accepted, "2026-03-10"),
  [
    DSD 内で store snapshot を hydration に渡したいが、既存の state script とは責務を分離したい。
  ],
  [
    `options.storeSnapshotSchema` が指定された場合は `<template shadowrootmode="open">` 内へ `<script type="application/json" data-dh-store>` を挿入する。payload は schema が列挙した atom 値のみとする。
  ],
  [
    - DSD 単位で store snapshot を局所化できる
    - hydration 側が template 内から store snapshot を独立に復元できる
    - store を使わない SSR には影響しない
  ],
)

#adr(
  header("DSD は global style を local style より前に含める", Status.Accepted, "2026-03-15"),
  [
    CSR では `adoptedStyleSheets` によって global style と local style を順序付きで合成するため、SSR の `<style>` 出力も同じ順序でないと hydration 後の見た目差分が起きやすい。
  ],
  [
    `renderDSD` / `renderDSDContent` は `adoptGlobalStyles()` で登録された CSS テキストを local CSS より前に template 内へ並べ、同じ CSS テキストは重複出力しない。
  ],
  [
    - SSR / CSR で style 適用順を揃えられる
    - global style の説明責務を component 定義から分離できる
    - shared typography / reset の重複 `<style>` を減らせる
  ],
)

#adr(
  header("createComponentRenderer と _resetRendererState", Status.Accepted, "2026-03-09"),
  [
    テストや将来のレンダラー差し替えに向けて、内部初期化状態とレンダラー生成を個別に扱う必要がある。
  ],
  [
    `createComponentRenderer` と `_resetRendererState` を内部向け API としてエクスポートする。
  ],
  [
    - テスト間で状態を確実に分離できる
    - 将来のカスタムレンダラー注入点になる
  ],
)
