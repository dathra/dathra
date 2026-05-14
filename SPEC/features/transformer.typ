#import "../functions.typ": feature_spec
#import "../settings.typ": apply-settings
#show: apply-settings

= transformer 機能詳細設計

#feature_spec(
  name: "transform (CSR)",
  summary: [
    JSX を含むソースコードを構造化配列（IR）と Runtime 呼び出しコードに変換する。
    CSR モードでは DOM 操作コードを生成する。
  ],
  api: [
    ```typescript
    function transform(
      code: string,
      options?: TransformOptions
    ): TransformResult

    interface TransformOptions \{
      mode?: 'csr' | 'ssr';    // デフォルト: 'csr'
      sourceMap?: boolean;      // デフォルト: false
      filename?: string;        // ソースマップ用ファイル名
    \}

    interface TransformResult \{
      code: string;
      map?: SourceMap;
    \}
    ```

    *パラメータ*:
    - `code`: JSX を含む JavaScript/TypeScript ソースコード
    - `options`: 変換オプション

    *戻り値*: 変換後のコードとオプションでソースマップ
  ],
  edge_cases: [
    1. *空コード*: 空文字列や JSX なしのコードの処理
    2. *構文エラー*: 不正な JSX の処理
    3. *ネストした JSX*: コンポーネント内の JSX
    4. *条件付き JSX*: 三項演算子や && での条件分岐
    5. *Fragment*: `<>...</>` の処理
    6. *既存の import*: Runtime import との重複処理
  ],
  test_cases: [
    *基本変換*:
    + 単純な要素: `<div />` → `fromTree([['div', null]], 0)`
    + 属性あり: `<div class="foo" />` → `fromTree([['div', \{class: 'foo'\}]], 0)`
    + テキスト: `<div>hello</div>` → `fromTree([['div', null, 'hello']], 0)`
    + ネスト: `<div><span /></div>` → 正しくネストされた配列

    *動的コンテンツ*:
    + 動的テキスト: `<div>\{count.value\}</div>` → `templateEffect(() => setText(...))`
    + 動的属性: `<div class=\{cls.value\} />` → `templateEffect(() => setAttr(...))`
    + イベント: `<button onClick=\{handler\} />` → `event('click', node, handler)`

    *プレースホルダー*:
    + 動的テキスト位置に `\{text\}` プレースホルダー
    + 挿入位置に `\{insert\}` プレースホルダー

    *import 生成*:
    + 使用した Runtime 関数のみ import される
    + `@dathra/runtime` からインポート
    + 既存の import と重複しない

    *Fragment*:
    + `<><div /><span /></>` → 複数ルート要素の配列

    *条件分岐*:
    + `\{show && <div />\}` → insert プレースホルダー + reconcile
    + `\{show ? <A /> : <B />\}` → 条件付き insert
  ],
  impl_notes: [
    *パース戦略*:
    - Babel parser で JSX をパース
    - Babel traverse で JSX ノードを訪問
    - Babel generator でコード生成

    *変換フロー*:
    1. JSXElement/JSXFragment を検出
    2. 構造化配列（Tree）に変換
    3. 動的部分を抽出（DynamicPart[]）
    4. Runtime 呼び出しコードを生成
    5. 必要な Runtime import を追加

    *動的部分の検出*:
    - `.value` アクセスを含む式 → リアクティブ
    - 静的リテラル → そのまま埋め込み
    - イベントハンドラ（on\*） → event() 呼び出し

    *ナビゲーションコード生成*:
    - 各動的部分のパス（インデックス配列）を計算
    - `firstChild` / `nextSibling` の連鎖でノード取得
  ],
)

#feature_spec(
  name: "transform (SSR)",
  summary: [
    SSR モードでは HTML 文字列を生成するコードを出力する。
    Hydration 用のマーカーを適切に挿入する。
  ],
  api: [
    ```typescript
    // options.mode = 'ssr' を指定
    transform(code, \{ mode: 'ssr' \})
    ```
  ],
  edge_cases: [
    1. *XSS 防止*: ユーザー入力のエスケープ
    2. *状態シリアライズ*: Signal 初期値の転送
    3. *void 要素*: `<input>`, `<br>` の正しい出力
  ],
  test_cases: [
    *基本出力*:
    + 静的要素 → HTML 文字列リテラル
    + 動的テキスト → `renderToString` で変換

    *マーカー挿入*:
    + 動的テキスト前に `\<!--dh:t:ID-->`
    + 挿入ポイントに `\<!--dh:i:ID-->`
    + ブロック境界に `\<!--dh:b:ID-->...\<!--/dh:b-->`

    *import 生成*:
    + SSR 用 Runtime 関数のインポート
    + `renderToString`, `serializeState` など

    *状態転送*:
    + Signal 初期値がシリアライズされる
    + `<script data-dh-state>` が出力に含まれる
  ],
  impl_notes: [
    *CSR との差分*:
    - DOM 操作コードの代わりに文字列生成コード
    - `fromTree` → `renderToString`
    - `templateEffect` → 即時評価して文字列に埋め込み

    *コンポーネント関数*:
    - SSR では関数呼び出しが HTML 文字列を返す
    - Transformer がモードに応じて出力を切り替え
  ],
)

#feature_spec(
  name: "jsxToTree",
  summary: [
    JSX AST ノードを構造化配列（Tree）に変換する内部関数。
    動的部分を抽出してメタデータとして返す。
  ],
  api: [
    ```typescript
    interface TreeResult \{
      tree: t.Expression;           // Babel AST の配列式
      dynamicParts: DynamicPart[];  // 動的部分のメタデータ
    \}

    interface DynamicPart \{
      type: 'text' | 'attr' | 'event' | 'spread' | 'insert';
      path: number[];               // ノードへのパス
      expression: t.Expression;     // 動的な式
      key?: string;                 // 属性名やイベントタイプ
    \}

    function jsxToTree(
      node: t.JSXElement | t.JSXFragment,
      state: TransformState
    ): TreeResult
    ```
  ],
  edge_cases: [
    1. *空白テキスト*: 意味のない空白の除去
    2. *連続テキスト*: 複数のテキストノードのマージ
    3. *ネストした式*: `\{items.map(...)\}` の処理
  ],
  test_cases: [
    *要素変換*:
    + `<div />` → `['div', null]`
    + `<div class="foo" />` → `['div', \{class: 'foo'\}]`
    + `<div>text</div>` → `['div', null, 'text']`

    *動的部分抽出*:
    + `<div>\{x.value\}</div>` → tree に `\{text\}`, dynamicParts に式
    + `<div class=\{x.value\} />` → dynamicParts に attr 情報

    *パス計算*:
    + ルート要素 → `[0]`
    + 最初の子 → `[0, 0]`
    + 2番目の子 → `[0, 1]`
  ],
  impl_notes: [
    *再帰処理*:
    - JSXElement を再帰的に処理
    - 各レベルでパスを更新

    *空白処理*:
    - 改行と空白のみのテキストは除去
    - 意味のあるテキストは保持
  ],
)

#feature_spec(
  name: "containsReactiveAccess",
  summary: [
    式が Signal アクセス（.value）を含むかを判定する。
    リアクティブな式を templateEffect で包む必要があるか判断する。
  ],
  api: [
    ```typescript
    function containsReactiveAccess(node: t.Node): boolean
    ```
  ],
  edge_cases: [
    1. *ネストした .value*: `obj.nested.value`
    2. *条件式内*: `cond ? a.value : b`
    3. *関数呼び出し内*: `fn(x.value)`
    4. *テンプレートリテラル*: `` `$\{x.value\}` ``
  ],
  test_cases: [
    *検出する*:
    + `count.value` → true
    + `count.value + 1` → true
    + `arr.map(x => x.value)` → true
    + `obj?.value` → true

    *検出しない*:
    + `"static"` → false
    + `123` → false
    + `handler` (関数参照) → false
    + `obj.property` (value以外) → false
  ],
  impl_notes: [
    *AST 走査*:
    - Babel traverse で MemberExpression を探索
    - `property.name === 'value'` をチェック

    *最適化*:
    - 静的な式は templateEffect で包まない
    - バンドルサイズと実行時オーバーヘッドを削減
  ],
)

#feature_spec(
  name: "generateNavigation",
  summary: [
    動的部分へのナビゲーションコードを生成する。
    パス配列から firstChild/nextSibling の連鎖を構築。
  ],
  api: [
    ```typescript
    function generateNavigation(
      fragmentId: t.Identifier,
      path: number[],
      isText: boolean,
      state: TransformState
    ): t.Expression
    ```
  ],
  edge_cases: [
    1. *空パス*: ルート要素自体
    2. *深いパス*: 多段階のナビゲーション
    3. *テキストノード*: isText=true での特殊処理
  ],
  test_cases: [
    + `[0]` → `firstChild(fragment)`
    + `[1]` → `nextSibling(firstChild(fragment))`
    + `[0, 0]` → `firstChild(firstChild(fragment))`
    + `[0, 1]` → `nextSibling(firstChild(firstChild(fragment)))`
    + isText=true → `firstChild(node, true)`
  ],
  impl_notes: [
    *コード生成*:
    - Babel types で CallExpression を構築
    - ネストした呼び出しを連鎖

    *isText の意味*:
    - テキストノードを取得する場合に true
    - firstChild の第2引数として渡す
  ],
)

#feature_spec(
  name: "generateRuntimeImports",
  summary: [
    使用した Runtime 関数の import 文を生成する。
    必要な関数のみをインポートして Tree shaking を有効に。
  ],
  api: [
    ```typescript
    function generateRuntimeImports(
      usedImports: Set<string>,
      mode: 'csr' | 'ssr'
    ): t.ImportDeclaration
    ```
  ],
  edge_cases: [
    1. *空セット*: 何もインポートしない
    2. *既存 import*: 重複を避ける
  ],
  test_cases: [
    + `\{fromTree, firstChild\}` → `import \{ fromTree, firstChild \} from '@dathra/runtime'`
    + SSR モード → `import \{ renderToString, ... \} from '@dathra/runtime'`
    + 空セット → import 文なし
  ],
  impl_notes: [
    *実装*:
    - Set から配列に変換
    - ImportDeclaration を構築
    - ファイル先頭に挿入
  ],
)
