= jsx-runtime

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

JSX ランタイムの実装。`jsx`/`jsxs`/`Fragment` を提供し、Dathra の JSX 変換出力が呼び出す関数群。

== 機能仕様

#feature_spec(
  name: "jsx / jsxs（要素生成）",
  summary: [
    JSX 変換が出力する `jsx()` / `jsxs()` ファクトリ関数。
    タグ名または関数コンポーネントを受け取り、DOM 要素を生成する。
    イベントハンドラ、リアクティブ属性、リアクティブテキスト子要素をサポートする。
  ],
  api: [
    ```typescript
    function jsx(
      tag: string | ((props: JSXProps) => Node),
      props: JSXProps | null,
    ): Node

    function jsxs(
      tag: string | ((props: JSXProps) => Node),
      props: JSXProps | null,
    ): Node
    ```

    *要素生成*:
    - `tag` が文字列の場合、対応する HTML 要素を生成する
    - `tag` が関数の場合、関数コンポーネントとして `props` を渡して呼び出す
    - `props` が `null` の場合、空オブジェクトとして扱う

    *子要素の処理*:
    - 文字列・数値はテキストノードとして追加
    - `null`、`undefined`、`boolean` は無視
    - `Node` インスタンスはそのまま追加
    - 関数はリアクティブ getter として扱い、`templateEffect` でテキストを更新

    *イベントハンドラ*:
    - `on` で始まるキー（例: `onClick`）をイベントリスナーとして登録
    - camelCase イベント名を lowercase に変換（`onClick` → `click`）
    - 値が関数でない場合は無視する

    *リアクティブ属性*:
    - `.value` プロパティを持つオブジェクトをリアクティブ値として検出
    - `templateEffect` で属性値を自動更新する

    *関数コンポーネント + withStore*:
    - `withStore` コンテキスト内で関数コンポーネントを呼び出すとストアが伝播する
    - JSX サブツリー内のネストされたカスタム要素にもストアが伝播する
  ],
  edge_cases: [
    - `props` が `null` → 空オブジェクトとして処理
    - 関数でないイベントハンドラ値 → 無視（TypeError を投げない）
    - `null`/`undefined`/`boolean` の子要素 → 無視
  ],
  test_cases: [
    - 指定タグで DOM 要素を生成
    - span 要素の生成
    - 静的属性付き要素の生成
    - 静的テキスト子要素付き要素の生成
    - 複数テキスト子要素付き要素の生成（jsxs）
    - null, undefined, boolean の子要素を無視
    - 数値の子要素を処理
    - 子要素の Node を追加
    - 関数コンポーネントを props で呼び出す
    - props が null の場合は空 props で関数コンポーネントを呼び出す
    - withStore で通常の関数コンポーネントをサポート
    - withStore で JSX 生成のカスタム要素をサポート
    - JSX サブツリー内のネストされたカスタム要素に store を伝播
    - イベントリスナーをアタッチ
    - 関数でないイベントハンドラ値はアタッチしない
    - 複数のイベントハンドラを処理
    - camelCase イベント名を lowercase に変換
    - getter 関数をリアクティブテキスト子要素としてサポート
    - リアクティブ値を属性にバインド
    - リアクティブ値変更時に class 属性を更新
  ],
)

#feature_spec(
  name: "Fragment",
  summary: [
    JSX `<>...</>` 構文に対応する Fragment コンポーネント。
    ラッパー要素なしで複数の子要素を `DocumentFragment` としてレンダリングする。
    関数の子要素はリアクティブ getter として扱い、`templateEffect` でテキストを同期する。
  ],
  api: [
    ```typescript
    function Fragment(props: FragmentProps): DocumentFragment

    interface FragmentProps {
      children?: JSXChild | JSXChild[];
    }
    ```

    *子要素の処理*:
    - 文字列・数値はテキストノードとして追加
    - `null`、`undefined`、`boolean` は無視
    - `Node` インスタンスはそのまま追加
    - 関数はリアクティブ getter として扱い、`templateEffect` でテキストノードを更新
    - 子要素がない場合は空の `DocumentFragment` を返す
  ],
  edge_cases: [
    - 子要素がない場合 → 空の `DocumentFragment`
    - `null`/`undefined`/`boolean` の子要素 → 無視
  ],
  test_cases: [
    - DocumentFragment を生成
    - 文字列の子要素をレンダリング
    - 複数の文字列子要素をレンダリング
    - 数値の子要素をレンダリング
    - null, undefined, boolean の子要素を無視
    - Node の子要素をそのままレンダリング
    - 子要素がない場合は空の Fragment をレンダリング
    - 関数の子要素をリアクティブ getter として扱う
  ],
)
