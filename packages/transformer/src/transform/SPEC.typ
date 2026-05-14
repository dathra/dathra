= transform 関数

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== インターフェース仕様

#interface_spec(
  name: "transform API",
  summary: [
    JSX を含む JavaScript コードを解析し、CSR では compiler-generated template descriptor + `fromTree()`、SSR では compile-time shell + dynamic helper 群（必要時のみ `renderToString()` fallback）へ変換する。`oxc-parser` で ESTree 互換 AST を生成し、`zimmerframe` で走査・変換、`esrap` で再生成する。
  ],
  format: [
    ```typescript
    function transform(code: string, options?: TransformOptions): TransformResult
    ```
  ],
  constraints: [
    - 純粋な ESTree ノードのみを使用して変換する
    - コンポーネント要素は tree ノードへ含めず、関数呼び出し式として出力する
    - HTML 要素は構造化配列 tree と dynamic part 群へ分解する
    - `options.mode` に応じて CSR / SSR の生成結果を切り替える
    - 必要なランタイムインポートを自動的に追加する
    - bare host-level `client:*` directive はコンポーネント要素でのみ許可する
    - `client:*` directive は 1 要素につき 1 つまでとし、内部 metadata は予約属性 `data-dh-island` / `data-dh-island-value` に正規化する
    - colocated client handler は HTML 要素でのみ許可する。MVP は `load:onClick` / `interaction:onClick`、phase 2 は `visible:onClick` / `idle:onClick` を追加対象とする
  ],
)

== 振る舞い仕様

#behavior_spec(
  name: "コンポーネント要素と HTML 要素の判別",
  summary: [
    JSX 要素のタグ名が大文字で始まる場合、または `JSXMemberExpression` の場合はコンポーネントとして扱い、それ以外は HTML 要素として扱う。
  ],
  steps: [
    1. `<Counter />` は `Counter({ ...props })` のような関数呼び出しへ変換する。
    2. `<div />` は構造化配列表現へ変換する。
    3. `<Foo.Bar />` はコンポーネント参照として扱う。
    4. ルート要素がコンポーネントの場合は tree を生成せず、直接関数呼び出しを返す。
  ],
  postconditions: [
    - コンポーネント要素は `fromTree()` / `renderToString()` のツリーノードに含まれない
    - 属性は props オブジェクトとして関数呼び出しへ渡される
  ],
)

#behavior_spec(
  name: "CSR モード変換",
  summary: [
    CSR モードでは JSX を `fromTree()` と DOM 更新ランタイム呼び出しへ変換する。
  ],
  steps: [
    1. JSX の静的部分を compile-time template descriptor にシリアライズし、`fromTree()` 呼び出しに変換する。
    2. リテラル属性は構造化配列に含める。
    3. reactive access を含む属性は `templateEffect` でラップする。
    4. reactive access を含まない式属性は lexical scope を壊さないよう `setAttr()` で一度だけ初期化する。
    4. イベントハンドラは `event()` に変換する。
    5. テキスト式は `setText()` へ変換する。
    6. コンポーネント要素は `insert()` で挿入し、`templateEffect` ではラップしない。
    7. 条件式、`.map()`、logical expression、JSX を含む一般式、`JSXSpreadChild` は `templateEffect` 経由の `insert()` として扱う。
  ],
  postconditions: [
    - `@dathra/runtime` から必要な import が自動生成される
    - DOM ナビゲーションと動的更新コードが生成される
  ],
)

#behavior_spec(
  name: "SSR モード変換",
  summary: [
    SSR モードでは JSX を compile-time shell と dynamic helper 群を用いた HTML 文字列生成コードへ変換し、generic runtime renderer が必要な場合のみ `renderToString()` fallback を用いる。
  ],
  steps: [
    1. HTML 要素を tree と dynamic part 群へ分解する。
    2. compile-time で static shell と SSR marker 文字列を生成する。
    3. text / attr / spread / insert dynamic part は helper 呼び出しへ変換する。
     4. custom element DSD など generic runtime renderer が必要な場合は `renderToString()` fallback を生成する。
     5. コンポーネント要素は関数呼び出しに変換し、insert dynamic part として渡す。
     6. 式コンテナ内のローカル static expression は、ランタイム補助変数へ退避せず元の式のまま出力する。
    ],
  postconditions: [
    - SSR 出力は DOM 依存コードを含まない
    - 条件式や `.map()` 内のネスト JSX も SSR 方式で変換される
  ],
)

#behavior_spec(
  name: "変換パイプライン",
  summary: [
    `transform` はパース、AST 走査、tree 生成、dynamic part 展開、ランタイム import 注入、コード再生成の順に処理する。
  ],
  steps: [
    1. `oxc-parser` でソースコードを ESTree 互換 AST に変換する。
    2. `zimmerframe` で AST を走査し、根 JSX 要素のみを変換する。
    3. HTML 要素を構造化配列表現へ変換する。
    4. DOM ナビゲーションまたは SSR dynamic Map を生成する。
    5. 必要なランタイム import を追加する。
    6. `esrap` でコードを再生成する。
  ],
  postconditions: [
    - 走査不要なサブツリーは `next()` を呼ばず自然にスキップされる
    - ノード置換は visitor の戻り値として新ノードを返す immutable 変換で行う
  ],
)

#behavior_spec(
  name: "islands directive handling",
  summary: [
    `client:*` directive を component call 用の内部 metadata へ正規化し、後続 runtime が strategy を読めるようにする。
  ],
  steps: [
    1. `client:load`, `client:visible`, `client:idle`, `client:interaction`, `client:media` を islands directive として認識する。
    2. `client:*` namespace の未知 directive 名は例外を投げる。
    3. directive はコンポーネント要素でのみ許可し、HTML 要素上では例外を投げる。
    4. 1 つのコンポーネント要素に複数 directive がある場合は例外を投げる。
    5. `client:load`, `client:visible`, `client:idle` は bare 指定のみ許可し、値付き指定は例外を投げる。
    6. directive 自体は user props に残さず、`data-dh-island` と必要なら `data-dh-island-value` へ変換して component props に付与する。
    7. `client:interaction` は bare 指定時に `click` を補完し、値を与える場合は string literal event type のみ許可する。`client:media` は string literal media query を必須とする。
  ],
  postconditions: [
    - transform 後の出力から `client:*` 属性は消える
    - CSR / SSR の両モードで同じ metadata key を使う
  ],
)

#behavior_spec(
  name: "colocated client handlers MVP",
  summary: [
    HTML 要素上の `<strategy>:on<Event>` を sugar として認識する。v1 では target marker 付き event binding と strategy metadata へ落とし込み、必要な場合は target event type metadata も残して `defineComponent()` host / runtime 側の DSD hydration scheduling と first-event replay に使えるようにする。
  ],
  preconditions: [
    - colocated client handler は `on*` 形式の event handler key のみ許可する
    - `interaction` は 1 component render subtree 内で 1 種類の event type のみ許可する
    - v1 では 1 component render subtree 内で 1 種類の strategy (`load` または `interaction`) のみ許可する
  ],
  steps: [
    1. transformer は `<strategy>:on<Event>` を namespaced 属性として認識する
    2. transformer は target HTML 要素へ stable `data-dh-client-target` marker を付与する
    3. colocated directive 自体は出力から除去し、handler は通常の `on*` event binding として CSR transform へ流す
    4. target HTML 要素へ `data-dh-client-strategy` metadata を残す
    5. `interaction` で event type が canonical default `click` 以外の場合は target HTML 要素へ `data-dh-client-event` metadata を残す
    5. `defineComponent()` host は DSD 接続時に shadowRoot 内 marker を読んで `data-dh-island` metadata を自動付与できる
  ],
  postconditions: [
    - author は event と hydrate trigger を 1 箇所で記述できる
    - SSR 出力には target marker と target-level strategy metadata が残る
    - CSR setup 後は通常の `on*` handler として動作する
  ],
  errors: [
    - `interaction:onClick` と `interaction:onKeyDown` のように同一 subtree 内で interaction event type を混在させた場合は transform error
    - `on*` 形式でない colocated client handler は transform error
    - 同一 component render subtree に `load` と `interaction` を混在させた場合は transform error
  ],
)

#behavior_spec(
  name: "colocated client handlers phase 2 (proposal)",
  summary: [
    `visible` / `idle` も MVP と同じ colocated syntax surface を持つ。non-interaction strategies では trigger event replay を持たないため、`on*` event binding をそのまま target element に残せる。
  ],
  preconditions: [
    - `visible` / `idle` は `on*` 形式の event handler key を許可する
    - 1 component render subtree 内では 1 種類の strategy のみ許可する
    - `visible:on*` / `idle:on*` は trigger event replay を持たない
    - host-level `client:*` directive または explicit `data-dh-island*` metadata と同じ component render subtree で混在させてはならない
    - `interaction` の colocated event type は target event metadata と first-event replay を通じて host hydration trigger へ接続する
  ],
  steps: [
    1. transformer は `visible:on*` / `idle:on*` を MVP と同じ namespaced 属性として認識する
    2. target HTML 要素へ `data-dh-client-target` と `data-dh-client-strategy` を付与する
    3. handler は通常の `on*` binding として CSR setup に残す
    4. SSR 出力では `defineComponent()` host が shadowRoot marker から `visible` / `idle` island metadata を導出できる
  ],
  postconditions: [
    - `<button visible:onFocus={...}>` を target marker + `visible` strategy metadata + `focus` binding へ変換する
    - `<button idle:onScroll={...}>` を target marker + `idle` strategy metadata + `scroll` binding へ変換する
    - visible / idle は hydrate trigger が event binding と独立しているため replay は不要
    - phase 2 でも target marker 形式は MVP と共通にして、artifact-based action plan への移行余地を残す
  ],
  errors: [
    - `visible:onFocus` と `load:onMouseEnter` を同一 JSX root で混在させると transform error にする
    - `idle:onScroll` と `interaction:onKeyDown` を同一 JSX root で混在させると transform error にする
    - host-level `client:load` と subtree `visible:onClick` を同一 component render subtree で混在させると transform error にする
    - explicit `data-dh-island="load"` と subtree `idle:onClick` を同一 component render subtree で混在させると transform error にする
    - author が `data-dh-client-target` / `data-dh-client-strategy` を明示指定した場合は transform error にする
    - SVG / MathML 要素上の `visible:onClick` / `idle:onClick` は transform error にする
  ],
)

#feature_spec(
  name: "Phase 1 transformer-runtime islands contract finalization",
  summary: [
    islands metadata の key 名・strategy 名・default 値を暗黙の文字列契約ではなく、shared utility を canonical source として固定する。
  ],
  test_cases: [
    - transformer は canonical `data-dh-island` / `data-dh-island-value` / `data-dh-client-target` / `data-dh-client-strategy` を使う
    - `client:interaction` bare 指定は canonical default event type `click` を使う
    - colocated strategy 判定は canonical colocated strategy 一覧に従う
  ],
  impl_notes: [
    - strategy 名と metadata key は `@dathra/shared` の islands contract utility から参照する
    - tree transform と jsx directive parsing が別々の string literal set を持たないようにする
  ],
)

#feature_spec(
  name: "island boundary subtree semantics",
  summary: [
    transformer が生成する `data-dh-island*` metadata は nearest custom element host の hydration boundary を表し、その host setup が生成する subtree 全体が同じ strategy に従うことを前提にする。
  ],
  edge_cases: [
    - host-level `client:*` directive は component host boundary を定義し、その JSX subtree 内の plain DOM / plain component subtree を暗黙の別 boundary に分割しない
    - colocated client handler marker は native element 単位の island を作らず、nearest component host boundary に集約する
    - descendant component を別 strategy で hydrate したい場合は、その descendant 自身が explicit `client:*` / canonical `data-dh-island*` metadata を持つ boundary として表現する
  ],
  test_cases: [
    - host-level `client:*` と subtree colocated marker の混在を 1 render subtree 内で reject する
    - colocated marker だけでは nested boundary metadata を新設しない
    - descendant component に explicit `client:*` が付く場合は outer host とは別 boundary metadata を持てる余地を残す
  ],
  impl_notes: [
    - nearest host boundary ルールは plain DOM / plain component subtree に適用する
    - explicit nested host metadata を持つ descendant component は別 boundary として扱える
    - JSX subtree 内の boundary ownership が曖昧な sugar は導入しない
  ],
)

#feature_spec(
  name: "explicit nested island transform support",
  summary: [
    descendant component に付いた explicit `client:*` directive を nested island host metadata として保持し、outer host subtree 内でも独立 boundary を表現できるようにする。
  ],
  edge_cases: [
    - nested island は component host 単位でのみ表現し、HTML 要素や colocated marker を暗黙 nested boundary にしない
    - child component の `client:*` directive は child function call の props に canonical `data-dh-island*` metadata として残す
    - outer host-level `client:*` directive の存在だけでは child component の explicit island metadata を error にしない
    - 同一 host render subtree の plain HTML に対する colocated marker と host-level metadata の競合禁止は維持する
  ],
  test_cases: [
    - `<Outer client:visible><Inner client:load /></Outer>` で `Outer` と `Inner` の両方が独立 metadata を持つ
    - outer host metadata がある subtree 内でも child component の explicit `client:idle` を reject しない
    - `<button load:onClick={...}>` のような colocated marker は nested island metadata に昇格しない
  ],
  impl_notes: [
    - current component call transform は child component の metadata 保持に近いため、nested islands では mixing diagnostics の適用範囲を nearest host ごとに整理する
    - explicit nested host support を有効化した後も native element target は nearest host replay model を維持する
  ],
)

#feature_spec(
  name: "generic setup hydration plan generation (proposal)",
  summary: [
    transform 可能な generic setup component について、component definition object に `planFactory` を付与し、client で既存 DSD へ in-place 接続できるようにする。
  ],
  api: [
    ```typescript
    interface GenericHydrationPlan {
      readonly namespace: "html" | "svg" | "math";
      readonly bindings: readonly HydrationBinding[];
      readonly nestedBoundaries: readonly NestedBoundaryRef[];
    }

    type HydrationBinding =
      | TextBinding
      | AttrBinding
      | EventBinding
      | InsertBinding
      | SpreadBinding;

    interface TextBinding {
      readonly kind: "text";
      readonly markerId: number;
      readonly expression: unknown;
    }

    interface AttrBinding {
      readonly kind: "attr";
      readonly path: readonly number[];
      readonly key: string;
      readonly expression: unknown;
    }

    interface EventBinding {
      readonly kind: "event";
      readonly path: readonly number[];
      readonly eventType: string;
      readonly expression: unknown;
    }

    interface InsertBinding {
      readonly kind: "insert";
      readonly markerId: number;
      readonly path: readonly number[];
      readonly expression: unknown;
      readonly isComponent: boolean;
    }

    interface SpreadBinding {
      readonly kind: "spread";
      readonly path: readonly number[];
      readonly expression: unknown;
    }

    interface NestedBoundaryRef {
      readonly path: readonly number[];
      readonly tagName: string;
      readonly islandStrategy: string | null;
    }
    ```
  ],
  test_cases: [
    - simple transformable setup から generic hydration metadata が生成される
    - text / attr / event / insert binding が plan に反映される
    - nested child component with explicit `client:*` は `nestedBoundaries` として plan に含まれる
    - plan 生成不能な setup は `unsupportedReason` 付き metadata に落とす
    - `DynamicPart.path` と SSR marker id から plan の `path` / `markerId` が安定生成される
  ],
  impl_notes: [
    - existing dynamicParts / tree output を generic hydration plan の土台として再利用できる
    - `text` / `insert` は既存 SSR marker id を再利用し、`attr` / `event` / `spread` / nested boundary は tree path を stable node ref として使う
    - initial implementation では component definition ごとに static `planFactory` を出力し、runtime は host/ctx を渡して expression を評価できる形にする
  ],
)

#feature_spec(
  name: "runtime branching plan generation (v2)",
  summary: [
    `if/else` や guard return を含む setup について、各分岐が静的な JSX を返す場合、分岐ごとに独立した planFactory を生成し、ハイドレーション時に条件評価して一致するプランを適用する。条件がSSRとクライアントで異なる場合は既存のPath B（full rerender）へフォールバックする。
  ],
  api: [
    ```typescript
    interface DispatchHydrationPlan {
      readonly kind: "dispatch";
      readonly condition: () => boolean;
      readonly plans: readonly {
        readonly planFactory: (__dh_host: unknown, __dh_ctx: unknown) => GenericHydrationPlan;
        readonly shapeHash: string;
      }[];
      readonly nestedBoundaries: readonly NestedBoundaryRef[];
    }
    ```
  ],
  test_cases: [
    - `if (cond) return <A/>; return <B/>;` のような guard-return パターンから dispatch plan が生成される
    - `if (cond) { return <A/>; } else { return <B/>; }` のような if/else パターンから dispatch plan が生成される
    - `return cond ? (<A/>) : (<B/>);` のように各 branch が括弧付き JSX でも dispatch plan が生成される
    - 各分岐が異なる element type を持つ場合、shapeHash が異なる値になる
    - 各分岐が同じ element type を持つ場合、shapeHash が同じ値になる
    - ハイドレーション時に条件が true の分岐の planFactory が適用される
    - 分岐のいずれかが unsupported pattern を含む場合、全体が unsupported reason にフォールバックする
    - 分岐内の nested island は nestedBoundaries として正しく追跡される
    - 分岐内の colocated directive は guard 対象となる（unsupported + colocated の組み合わせ）
    - 三項演算子 `{cond ? <A/> : <B/>}` は引き続き insert binding として扱い、dispatch plan にはしない
    - ネストした `if` は v2 では unsupported のままにする
  ],
  impl_notes: [
    - `hasRuntimeBranching` が検出するパターンのうち、guard-return と if/else のみを対象にする
    - 各分岐の JSX root を独立に `jsxToTree` して planFactory を生成する
    - shapeHash は element type のシーケンスから導出し、SSR/クライアント間の構造一致を検証する
    - 三項演算子・論理式は既存の insert binding として扱い、dispatch plan には含めない
    - ネストした if/switch は unsupported-component-body にフォールバック
  ],
)

#feature_spec(
  name: "initial unsupported generic setup patterns",
  summary: [
    initial rollout では hydration plan を sound に生成できる setup だけを対象にし、解析不能または DOM preservation を壊しやすい setup は unsupported reason 付きで除外する。
  ],
  edge_cases: [
    - `document` / `window` / `host` / `shadowRoot` への imperative query・mutation を含む setup は `imperative-dom-query`
    - `typeof document === "undefined"` / `typeof window === "undefined"` のような environment probe だけであれば `imperative-dom-query` にはしない
    - JSX tree 外で Node identity を生成・保持して append/reuse する setup は `node-identity-reuse`
    - SSR と CSR で element shape が変わりうる runtime-only branching を含む setup は `runtime-branching`（v2 でサポート。各分岐が静的JSXでsame-shapeならplanFactoryを生成）
    - spread/object merge を compile 時に正規化できない setup は `non-normalizable-spread`
    - opaque helper call が DOM tree shape を返す setup は `opaque-helper-call`
    - `async` function / arrow function は Promise を返すため hydration plan を sound に生成できず `unsupported-component-body` とする
    - generator function (`function*`) は iterator を返すため hydration plan を sound に生成できず `unsupported-component-body` とする
    - `for` / `while` / `do-while` / `for-in` / `for-of` loop を含む setup body は prelude として extractable でないため `unsupported-component-body` となる
    - `try` / `catch` / `finally` を含む setup body は prelude として extractable でないため `unsupported-component-body` となる
    - ネストした `if` / `switch` を含む setup body は v2 でも解析不能なため `unsupported-component-body` となる
    - 分岐のいずれかが非静的JSX（関数呼び出しの戻り値等）を返す場合は `runtime-branching` のまま unsupported となる
    - class expression は function-like ではないため metadata なし（`__hydrationMetadata__` を付与しない）
  ],
  test_cases: [
    - unsupported setup は `unsupportedReason` 付き metadata に落とす
    - supported setup は `planFactory` を持つ hydration metadata を生成する
    - unsupported 判定は dev diagnostics に出せる粒度を持つ
    - `imperative-dom-query` / `node-identity-reuse` / `non-normalizable-spread` / `opaque-helper-call` を区別できる
    - guard-return パターン（`if (cond) return <A/>; return <B/>;`）は dispatch plan としてサポートされる
    - if/else パターン（`if (cond) { return <A/>; } else { return <B/>; }`）は dispatch plan としてサポートされる
    - `return cond ? (<A/>) : (<B/>);` のような return ternary の括弧付き branch も dispatch plan としてサポートされる
    - ネストした `if` / `switch` は unsupported-component-body に分類される
    - 分岐のいずれかが非静的JSXを返す場合は unsupported-component-body に分類される
    - `typeof document` / `typeof window` による environment probe を含む same-shape setup は supported のままにできる
    - top-level local zero-arg helper が直接 JSX を返すだけなら、component setup からその helper を経由しても `planFactory` を生成できる
    - top-level local helper が trivial argument forwarding で JSX を返すだけなら、component setup からその helper を経由しても `planFactory` を生成できる
    - top-level local helper 内の `const` / `function` prelude が JSX return 前にある場合も、same-shape なら `planFactory` を生成できる
    - top-level local helper chain が複数段あっても、最終的に local helper chain が JSX に解決できるなら `planFactory` を生成できる
    - top-level local helper が transparent thunk wrapper (`return render()`) なら、zero-arg callback の return JSX / local helper chain を辿って `planFactory` を生成できる
    - known imported transparent thunk wrapper (`@dathra/core` / `@dathra/store` の `withStore(store, () => <JSX />)` など) は opaque helper 扱いせず、zero-arg callback の return JSX / local helper chain を辿って `planFactory` を生成できる
    - imported transparent thunk wrapper の callback が root component element を返し、その props に local prelude を閉じ込めた function-valued prop (`renderPage={() => pageContent}` など) を含んでも `planFactory` を生成できる
    - helper param が destructuring pattern でも、call site の object/array argument をその pattern に安全に束縛できるなら `planFactory` を生成できる
    - helper chain 展開で setup param / helper param / helper-local prelude (`const` / `function`) の binding 名が衝突する場合、alpha-renaming で collision を避けた prelude を生成する
    - `async () => <div>hi</div>` のような async setup は `unsupported-component-body` に分類する
    - `function*` generator setup は `unsupported-component-body` に分類する
    - `for` / `while` / `do-while` loop を含む setup は `unsupported-component-body` に分類する
    - `try/catch` を含む setup は `unsupported-component-body` に分類する
    - class expression を component arg に渡した場合は metadata を付与しない
    - `for-in` / `for-of` loop を含む setup は `unsupported-component-body` に分類する
    - 上記パターンが deeply nested されていても同様に分類する
  ],
  impl_notes: [
    - initial rollout は coverage より soundness を優先する
    - unsupported patterns は transform error ではなく fallback reason として保持し、component 自体は動作可能にする
    - transparent thunk wrapper は v1 では zero-arg callback だけを対象にし、callback を直接 return する same-module helper または source-aware な known imported API contract に限定する
  ],
)

#feature_spec(
  name: "planFactory placement",
  summary: [
    generic hydration plan の source of truth は transform が component definition object へ付与する static metadata とし、SSR registry はそれをミラーする。
  ],
  api: [
    ```typescript
    interface ComponentHydrationMetadata {
      readonly kind: "generic-plan";
      readonly planFactory?: unknown;
      readonly unsupportedReason?: string;
    }
    ```
  ],
  test_cases: [
    - transform 生成コードは component definition object に hydration metadata を付与できる
    - `defineComponent` は同 metadata を SSR registration へ流せる
    - runtime/SSR は同一 metadata surface を共有できる
  ],
  impl_notes: [
    - registry だけに置くと CSR path が参照しづらく、definition object だけに置くと SSR renderer が参照しづらいため、definition object を source of truth にして registry を mirror にする
    - ideal path では `planFactory` を唯一の実行 surface とし、artifact mirror は持ち込まない
  ],
)

#behavior_spec(
  name: "vertical slice: visible outer host with load nested child",
  summary: [
    `<Outer client:visible><Inner client:load /></Outer>` を author が書いたとき、transform・SSR・runtime hydration が end-to-end で連携し、child は `load` で先に hydrate し、outer は `visible` 発火時に child を壊さず hydrate する。
  ],
  preconditions: [
    - `Outer` / `Inner` は generic hydration plan 対応 setup とする
    - child custom element は explicit `client:load` により independent boundary metadata を持つ
    - outer plan は child host を `NestedBoundaryRef` として保持する
  ],
  steps: [
    1. transformer は `Outer` call に `data-dh-island="visible"` metadata を付与する
    2. transformer は descendant `Inner` call に `data-dh-island="load"` metadata を保持する
    3. transformer は `Outer` と `Inner` の component definition ごとに `hydrationMetadata.planFactory` を付与する
    4. transformer は `Outer` の plan へ child host の `NestedBoundaryRef` を含める
  ],
  postconditions: [
    - output code だけで outer/inner の island boundary と hydration metadata が追跡できる
    - nested child は colocated marker ではなく explicit host boundary として扱われる
  ],
)

== 設計判断

#adr(
  header("oxc-parser + zimmerframe の採用", Status.Accepted, "2026-03-09"),
  [
    高速で軽量な JSX トランスフォームパイプラインを、不要な AST 変換アダプタなしで構成する必要がある。
  ],
  [
    `oxc-parser` + `zimmerframe` + 素の ESTree ノードオブジェクト組み立てを使用する。
  ],
  [
    - `oxc-parser` は純粋な ESTree 互換 AST を高速に出力できる
    - 外部 AST ビルダー依存を増やさずに済む
    - `zimmerframe` は visitor パターンで根 JSX 要素のみの変換に適している
  ],
)

#adr(
  header("コンポーネント判別基準", Status.Accepted, "2026-03-09"),
  [
    transform はランタイム情報なしで HTML 要素とコンポーネントを静的に判別する必要がある。
  ],
  [
    タグ名の先頭文字が大文字の場合、または `JSXMemberExpression` の場合をコンポーネントとして扱う。
  ],
  [
    - JSX の標準慣例に従う
    - コンパイル時に判別可能である
  ],
)

#adr(
  header("コンポーネントの props 渡し方", Status.Accepted, "2026-03-09"),
  [
    コンポーネント要素の JSX 属性をどう実行時に渡すかを一貫化する必要がある。
  ],
  [
    JSX 属性をそのまま props オブジェクトとして渡し、`computed()` ラッピングは行わない。
  ],
  [
    - 関数コンポーネントは一度だけ実行される想定と整合する
    - props は初期値として使われ、必要ならコンポーネント内部で signal 化される
  ],
)

#adr(
  header("コンポーネント insert を templateEffect でラップしない", Status.Accepted, "2026-03-09"),
  [
    コンポーネント要素を動的挿入対象として扱うが、props 変化のたびに再生成してはならない。
  ],
  [
    コンポーネントを `insert()` で挿入する際は `templateEffect` でラップしない。
  ],
  [
    - コンポーネント内部状態のリセットを防ぐ
    - 条件式や `.map()` のような式全体再評価ケースだけが `templateEffect` の対象になる
  ],
)

#adr(
  header("静的式属性（reactive access なし）の扱い", Status.Accepted, "2026-03-09"),
  [
    式属性のうち reactive access を含まないものまで effect 化すると不要なオーバーヘッドになる。
  ],
  [
    `.value` アクセスを含まない式属性は `templateEffect` でラップせず、静的属性オブジェクトに含める。
  ],
  [
    - 非 reactive な式は一度だけ評価すれば十分である
    - 不要な effect 生成を防げる
  ],
)

#adr(
  header("ハイフン付き属性名の扱い", Status.Accepted, "2026-03-09"),
  [
    `data-foo` や `aria-label` のような属性名は JavaScript 識別子として不正である。
  ],
  [
    有効な識別子でない属性名は文字列リテラルキーの ObjectProperty として出力する。
  ],
  [
    - 構文エラーのある JS 出力を避けられる
    - ハイフン付き属性を安全に保持できる
  ],
)

#adr(
  header("型安全性 — `as` アサーションの除去", Status.Accepted, "2026-03-09"),
  [
    transformer 内の `as` キャストは型安全性を弱め、visitor 内の絞り込みを阻害する。
  ],
  [
    `as unknown as X` は禁止し、TypeScript の型推論・型ガードで対応する。必要時のみ直接 `as X` を許可する。
  ],
  [
    - JSX ノード型を `ESTNode` に揃えることで visitor と型整合が取れる
    - 型ガードの恩恵で後続コードの安全性が上がる
  ],
)

#adr(
  header("Fragment の dynamicParts の正しい収集", Status.Accepted, "2026-03-09"),
  [
    Fragment 変換で `processChildren` が push した dynamic parts を取りこぼす不整合が起こりうる。
  ],
  [
    Fragment パスでは `dynamicParts` ローカル変数をそのまま戻り値に含め、`children.flatMap((c) => c.dynamicParts)` は使わない。
  ],
  [
    - Fragment 内の動的テキストやコンポーネント insert の消失を防ぐ
    - 非 Fragment パスと同じ一貫した収集モデルになる
  ],
)

#adr(
  header("logical expression を insert として扱う", Status.Accepted, "2026-03-09"),
  [
    `{cond && <A/>}` や `{a || <B/>}` は頻出だが、text dynamic part では安全に扱えない。
  ],
  [
    `JSXExpressionContainer` 内の `LogicalExpression` は `{insert}` dynamic part として扱う。
  ],
  [
    - CSR では `templateEffect + insert()`、SSR では `renderToString()` 用の動的値へ変換される
    - JSX を含む条件レンダリングを一貫して処理できる
  ],
)

#adr(
  header("式内 JSX の汎用フォールバック", Status.Accepted, "2026-03-09"),
  [
    ArrayExpression / ObjectExpression / SequenceExpression などに JSX が埋め込まれる場合、既存の特殊分岐だけでは取りこぼす。
  ],
  [
    式サブツリーに `JSXElement` または `JSXFragment` が含まれる場合は `transformNestedJSX` を適用して `insert` dynamic part として扱う。
  ],
  [
    - JSX を含む式を text 更新ではなくノード挿入の責務へ寄せられる
    - 条件分岐以外の式構造でも一貫した変換ができる
  ],
)

#adr(
  header("namespaced 属性名を文字列キーとして保持", Status.Accepted, "2026-03-09"),
  [
    `xlink:href` のような namespaced 属性は `:` を含み JavaScript 識別子にできない。
  ],
  [
    `JSXNamespacedName` 属性は `"namespace:name"` 形式の文字列キーとして出力する。
  ],
  [
    - SVG 属性を落とさず安全に保持できる
    - 不正な識別子生成を避けられる
  ],
)

#adr(
  header("JSXSpreadChild の変換", Status.Accepted, "2026-03-09"),
  [
    `JSXSpreadChild` を無視すると子要素が静かに欠落する。
  ],
  [
    `JSXSpreadChild` は `insert` dynamic part として扱い、式は `transformNestedJSX` で mode-aware に先行変換する。
  ],
  [
    - 既存の動的挿入フローへ統合できる
    - spread child を含む JSX を欠落させず変換できる
  ],
)

#adr(
  header("SSR モードにおける `transformNestedJSX` の mode 伝播", Status.Accepted, "2026-03-09"),
  [
    `transformNestedJSX` が `state.mode` を無視すると、SSR モードでも条件分岐内 JSX が CSR の `fromTree` へ誤変換される。
  ],
  [
    `transformNestedJSX` 内の visitor は `state.mode` に応じて、SSR では `transformJSXForSSRNode`、CSR では `transformJSXNode` を呼ぶ。
  ],
  [
    - SSR モードの条件式や `.map()` 内 JSX が `renderToString()` に変換される
    - CSR の既存動作は維持される
  ],
)

== 機能仕様

#feature_spec(
  name: "transform coverage",
  summary: [
    単純な JSX、動的属性、イベント、Fragment、コンポーネント、SSR 分岐、ネスト JSX、ランタイム import 注入まで含めて変換結果を検証する。
  ],
  edge_cases: [
    - 空の JSX 要素
    - 動的コンテンツを含む Fragment
    - スプレッド属性
    - 条件付きレンダリング
    - リストレンダリング
    - コンポーネントの children 伝達
    - ハイフン付き属性名
    - 静的式属性
    - logical expression
    - 式内 JSX の汎用フォールバック
    - `JSXSpreadChild`
    - namespaced 属性
  ],
  test_cases: [
    - 単純な JSX 要素を変換する
    - 属性付き要素を変換する
    - 動的テキストを変換する
    - イベントハンドラを変換する
    - ネストされた要素を変換する
    - SSR モードで `renderToString` を使用する
    - コンポーネント要素を関数呼び出しに変換する（CSR）
    - コンポーネント要素を関数呼び出しに変換する（SSR）
    - ネストされたコンポーネント要素を insert として扱う
    - スプレッド属性（HTML 要素）を `spread()` + `templateEffect` に変換する
    - 条件付きレンダリング（ternary 式）を `insert()` + `templateEffect` に変換する
    - リストレンダリング（`.map()` 式）を `insert()` + `templateEffect` に変換する
    - 既存 import 文がある場合、ランタイムインポートをその直後に挿入する
    - ネストされた Fragment（CSR）を処理する
    - Fragment 内の動的テキストで `templateEffect` + `setText` が正しく生成される
    - Fragment 内のコンポーネントで `insert()` が正しく生成される
    - ハイフン付き属性名で文字列リテラルキーの ObjectProperty を生成する
    - 静的式属性では `templateEffect` なしで `setAttr()` により初期化する
    - 関数スコープ内ローカル識別子を属性に渡しても hoist によるスコープ破壊が起きない
    - SSR モードの条件付きレンダリングで各 JSX 分岐が `renderToString()` に変換される
    - SSR モードの logical expression で JSX 分岐が `renderToString()` に変換される
    - `client:visible` 付き component を `data-dh-island="visible"` metadata 付き function call へ変換する
    - `client:interaction="mouseenter"` を `data-dh-island-value` 付き metadata へ変換する
    - bare `client:interaction` を `data-dh-island-value="click"` へ変換する
     - `client:media` に string literal がない場合を transform error にする
     - `client:visible="foo"` のような値付き valueless directive を transform error にする
      - HTML 要素上の `client:*` directive を transform error にする
      - 複数の `client:*` directive 組み合わせを transform error にする
      - 未知の `client:*` directive 名を transform error にする
      - islands directive と `data-dh-island*` 明示 props の衝突を transform error にする
      - `<button load:onClick={...}>` を target marker 付き `onClick` へ変換する
      - `<button interaction:onClick={...}>` を interaction strategy metadata 付きへ変換する
      - 1 JSX root 内で `load:onClick` と `interaction:onClick` を混在させると transform error にする
    ],
  )

== 将来拡張案

#adr(
  header("colocated client handler syntax", Status.Proposed, "2026-03-16"),
  [
    現状の `client:*` は component host 単位の hydrate timing だけを宣言でき、実際の event handler は `hydrate` 実装側へ分離される。そのため author は「いつ起動するか」と「何をするか」を別の場所で読む必要があり、DX が低い。
  ],
  [
    将来拡張として `<strategy>:on<Event>` 形式の colocated syntax を導入し、HTML 要素上に書いた client handler を transformer が抽出して host-local な client action plan へ変換する。v1 では `load:onClick` / `interaction:onClick` に絞り、transformer は target element の stable id、strategy metadata、handler 本体、必要な capture 情報を compiler artifact へ近い形で残す。
  ],
  [
    - author は event と hydrate trigger を同じ場所で読める
    - runtime は compiler-generated artifact を用いて自動 hydrate / event binding / replay を行える
    - 実装は current `client:*` metadata 正規化より大幅に広い compiler 責務を持つ
  ],
  alternatives: [
    - `clientActions` のような名前付き action を component option へ分離登録する
    - 現行の host-level `client:*` + hand-written `hydrate` を維持する
  ],
)

#adr(
  header("colocated syntax の第 2 段階は non-interaction scheduler へ広げる", Status.Proposed, "2026-03-16"),
  [
    MVP だけでは click-trigger hydration の UX は検証できるが、below-the-fold や idle-priority UI に同じ書き味を適用できない。
  ],
  [
    phase 2 では `visible:onClick` / `idle:onClick` を追加し、event binding の colocated 体験を保ったまま既存 islands scheduler の `visible` / `idle` 戦略へ接続する。
  ],
  [
    - author は strategy の違いだけを変えて同じ mental model で書ける
    - runtime の replay 複雑性は `interaction` に閉じ込められる
    - parser / transformer / component host 側の marker surface を使い回せる
  ],
)

#adr(
  header("component target の colocated handler は function prop ではなく action artifact で運ぶ", Status.Proposed, "2026-04-07"),
  [
    `<Counter load:onClick={() => doThing()} />` のような component 要素 target は、parent callsite にある handler closure を child host が後から hydrate するときにも復元できる必要がある。しかし SSR では function-valued prop は DSD / attribute surface に残らないため、単純に `onClick` prop へ書き換えるだけでは child island の独立 hydrate 時に handler を失う。
  ],
  [
    component target の colocated handler は callsite-scoped client action artifact として抽出し、child host には strategy metadata に加えて action binding metadata と serializable capture payload を残す。runtime は child host hydrate 時に artifact registry から handler を解決して bind する。
  ],
  [
    - parent callsite に書かれた handler を SSR 後の child island hydrate でも失わない
    - HTML target の render replay model と component target の artifact model を明確に分離できる
    - capture model v2 を component target に対して本当に必要な箇所へ限定して導入できる
  ],
  alternatives: [
    - component target でも単純に `on*` prop へ書き換える（SSR で function prop が失われる）
    - component target を永続的に unsupported にする（author 体験と実用性を損なう）
    - child host が parent render closure を暗黙参照できる前提を置く（module/instance ownership が壊れる）
  ],
)

#adr(
  header("runtime branching を dispatch plan でサポートする", Status.Accepted, "2026-04-02"),
  [
    現実のコンポーネントはローディング/エラー/空状態/認証チェックなどの条件分岐を必ず持つ。runtime-branching を unsupported にすると、SSRハイドレーションが使えるのは「ただのカウンター」程度の実用性がないケースに限られる。フレームワークとしての実用性を確保するため、静的解析可能な分岐パターンをサポートする必要がある。
  ],
  [
    `if/else` と guard-return（`if (cond) return <A/>; return <B/>;`）について、各分岐が静的JSXを返す場合、分岐ごとに独立した planFactory を生成する。ハイドレーション時に条件を評価し、一致するプランを適用する。条件がSSRとクライアントで異なる場合は、既存のPath B（full rerender）へフォールバックする。
  ],
  [
    - 実世界のコンポーネントの8〜9割が planFactory 対応になる
    - 各分岐のplanFactory生成は既存ロジックの再利用で実装できる
    - reconciliation に近づかず、in-place hydration の設計を維持できる
    - 偽陽性ゼロ：SSR/クライアント間の構造不一致は安全にフォールバックする
  ],
  alternatives: [
    - 全分岐をunsupportedのままにする（実用性が皆無）
    - 共通部分マージ（実装コストが高くreconciliationに近づく）
    - 三項演算子・switch も含める（v2では複雑すぎるため対象外）
  ],
)

#adr(
  header("unsupported setup + colocated directive は transform error にする", Status.Accepted, "2026-03-31"),
  [
    hydration plan が生成できない component に colocated directive が存在すると、runtime は Path B（full rerender）を使い、SSR shadow DOM を破棄して setup を再実行する。handler closure が SSR state（signal 初期値等）を capture していた場合、CSR 側では新しい（異なる）値で再生成され、visual jump やロジックの不整合が発生する。MVP にはこの問題を検出する仕組みがなく、サイレントに壊れる。
  ],
  [
    unsupported hydration reason が確定した時点で component body の JSX を走査し、colocated client directive を検出した場合は transform error にする。error message に unsupported reason を含め、developer に setup の simplify か directive の除去を促す。
  ],
  [
    - サイレントな SSR state 消失を compile time で防止できる
    - error message が具体的な unsupported reason を含むため、fix の方向が明確
    - colocated directive を持たない unsupported component は影響なし（従来通り fallback）
    - 将来 capture model v2 で制約が緩和される可能性があるが、現時点では保守的に禁止する
  ],
  alternatives: [
    - soft warning（console.warn 相当）で通過させ、runtime で best-effort hydration する
    - `unsupportedReason` metadata に colocated 情報を付加して runtime 側で判断させる
    - colocated directive を含む場合のみ plan 生成を試み、失敗したら fallback する
  ],
)

#adr(
  header("island metadata は nearest host boundary の subtree semantics を表す", Status.Accepted, "2026-03-18"),
  [
    transform が付与する `data-dh-island*` metadata の意味が host 自身だけなのか subtree 全体なのか曖昧だと、runtime scheduler と author mental model がずれる。
  ],
  [
    host-level `client:*` directive と canonical `data-dh-island*` metadata は nearest custom element host の hydration boundary を表し、その host render/setup が生成した subtree 全体が同じ strategy に従うものとして扱う。
  ],
  [
    - strategy-driven hydration と root CSR rerender を明確に区別できる
    - plain child component や native element を暗黙 sub-island とみなす複雑性を避けられる
    - author は eager interactive な UI を別 boundary として明示的に切り出す必要がある
  ],
)

#adr(
  header("nested islands は explicit descendant host metadata だけを候補にする", Status.Proposed, "2026-03-18"),
  [
    outer boundary の内側にも別 strategy を与えたい UI はあるが、HTML 要素 marker や plain child component まで boundary 候補にすると transform error 規則と runtime traversal が複雑化する。
  ],
  [
    nested island は descendant custom element host が独立した `client:*` または canonical `data-dh-island*` metadata を持つ場合にのみ候補とし、colocated client marker は引き続き nearest host へ集約する。
  ],
  [
    - host-centric contract を保ったまま explicit nested boundary へ拡張できる
    - Astro/Fresh に近い explicit island model を採用できる
    - outer/inner boundary の scan order や ownership は runtime 側の後続仕様として詰める必要がある
  ],
)

#adr(
  header("nested islands を explicit host metadata で正式サポートする", Status.Proposed, "2026-03-18"),
  [
    outer island の subtree 内にある child custom element も別 strategy で hydrate したい。transform が explicit host metadata をそのまま保持できれば、runtime は descendant host を独立 boundary として扱える。
  ],
  [
    component child に付いた `client:*` directive は outer host metadata に吸収せず、その child function call 自体の canonical `data-dh-island*` metadata として保持する。これにより descendant custom element host は outer host の subtree 内でも独立 island boundary を表現できる。
  ],
  [
    - transform は explicit nested island host を自然に表現できる
    - colocated marker は引き続き nearest host へ集約し、native element ベースの暗黙 nested islands は避けられる
    - same render subtree における host-level metadata と colocated marker の混在ルールを nested host aware に見直す必要がある
  ],
)

#adr(
  header("containsNodeType の zimmerframe ユニバーサルビジターバグ修正", Status.Accepted, "2026-03-26"),
  [
    `containsNodeType` は zimmerframe の `_` (universal) ビジターを使って AST を深く走査し、指定した型のノードが存在するかを判定する関数である。しかし `_` ビジターが `next()` を呼んでいなかったため、ルートノードの型のみをチェックし、子孫ノードを一切走査していなかった。このため `getUnsupportedHydrationReason` 内の `containsNodeType` による深い `IfStatement`/`SwitchStatement` 検出（line 1242 付近）が常に `false` を返し、事実上デッドコードになっていた。
  ],
  [
    `_` ビジターに `{ next }` パラメータを追加し、型チェック後に `next()` を呼び出すよう修正する。これにより `containsNodeType` が本来意図していた深い走査を正しく行えるようになる。
  ],
  [
    - `containsNodeType` が子孫ノードを正しく走査し、ネストされた `IfStatement`/`SwitchStatement` を検出できるようになる
    - IIFE 内の分岐等、`hasRuntimeBranching` のトップレベルチェックでは捕捉できないパターンが `runtime-branching` として正しく分類される
    - 以前 `unsupported-component-body` と分類されていた一部コンポーネントが、より正確な `runtime-branching` に再分類される
  ],
)

#behavior_spec(
  name: "colocated client handler transform (proposal)",
  summary: [
    `<strategy>:on<Event>` を component-local client action artifact へ変換し、host hydration と target event binding を compiler が接続する。
  ],
  preconditions: [
    - v1 では `defineComponent()` の render 関数が返す JSX subtree 内でのみ許可する
    - directive target は HTML 要素であり、component 要素ではない
    - v1 では 1 つの render subtree で使用する client strategy は 1 種類に制限する
  ],
  steps: [
    1. transformer は `<strategy>:on<Event>` 形式の namespaced 属性を認識する
    2. handler 式を抽出し、stable action id と target element id を割り当てる
    3. enclosing component host 用に `data-dh-island` / `data-dh-island-value` metadata を生成する
    4. target HTML 要素には hydration 後の再接続に必要な内部 marker を付与する
    5. handler は compiler-generated client action plan へ移し、component definition 側へ注入する
    6. interaction strategy の trigger event と bound event が同一の場合、runtime が first event replay できる形で metadata を残す
  ],
  postconditions: [
    - source 上では event と hydrate trigger が colocated に見える
    - generated output では runtime が解釈できる内部 metadata / action artifact に分解される
    - bare `client:*` と同じ host-level island scheduler と整合する
  ],
  errors: [
    - `defineComponent()` render subtree 外の HTML 要素で使った場合は transform error
    - 同一 render subtree で複数 strategy を混在させた場合は transform error
    - v1 で許可していない capture や unsupported event forms は transform error
  ],
)

#behavior_spec(
  name: "unsupported hydration + colocated directive combination guard",
  summary: [
    hydration plan 生成が不可能（unsupported pattern）なコンポーネントに colocated client directive が存在する場合、transform error として検出する。この組み合わせは Path B（full rerender）へ fallback し、SSR state が失われるため、サイレントな破壊を防止する。
  ],
  preconditions: [
    - component setup が unsupported reason（runtime-branching, imperative-dom-query, opaque-helper-call 等）を持つ
    - 同一 component の render subtree 内に colocated client directive（`load:onClick`, `interaction:onClick` 等）が存在する
  ],
  steps: [
    1. `buildComponentHydrationMetadata` で unsupported reason が確定した時点で、component body の JSX AST を走査して colocated directive の有無を検出する
    2. colocated directive が検出された場合、unsupported reason を含む transform error を throw する
    3. colocated directive が存在しない場合は、従来通り `unsupportedReason` metadata を返す
  ],
  postconditions: [
    - unsupported setup + colocated directive の組み合わせは transform error として明示的に報告される
    - developer は setup を simplify するか colocated directive を除去するかの明確な選択肢を持つ
    - colocated directive を含まない unsupported component は従来通り `unsupportedReason` fallback で動作する
  ],
  errors: [
    - `[dathra] Colocated client directives (e.g. load:onClick) cannot be used in a component whose setup is unsupported for hydration plan generation (reason: <unsupportedReason>). The component would fall back to a full rerender, losing SSR state captured by the handler. Simplify the setup function or remove the colocated directive.`
  ],
)

#behavior_spec(
  name: "client handler capture model v2 (proposal)",
  summary: [
    将来 artifact-based client action plan へ移行する場合に備え、colocated client handler の capture 制約を事前に定義しておく。
  ],
  preconditions: [
    - MVP は render replay ベースなので compile-time capture validation を行わない
    - artifact-based action extraction を導入する段階で有効化する
  ],
  steps: [
    1. handler 本体が参照する外側識別子を抽出する
    2. `props`, `store`, signal、serializable で不変な local `const` を v1 の許可対象として扱う
    3. serializable local `const` には primitive literal、primitive だけで構成される template literal、readonly tuple / readonly object literal を含める
    4. imported binding は直接 capture 許可せず、handler 内で再評価できる literal / primitive const 経由に限定する
    5. DOM node、class instance、mutable object、non-serializable value を参照した場合は transform error にする
    6. unsupported capture が 1 つでもあれば action artifact を生成せず、diagnostic を返して変換を中断する
  ],
  postconditions: [
    - v2 では author が書ける handler の範囲が明確になる
    - runtime は serializable / replayable な action artifact だけを受け取る
  ],
  errors: [
    - `const button = document.createElement("button")` のような DOM capture を含む handler は transform error
    - object / array literal を mutable に保持して capture する handler は transform error
    - class instance や `new` されたオブジェクトを capture する handler は transform error
    - runtime 値を埋め込む template literal や mutable tuple/object を capture する handler は transform error
  ],
)

#behavior_spec(
  name: "component-target colocated client handlers v2 (proposal)",
  summary: [
    `<Child load:onClick={...} />` や `<Child interaction:onKeyDown={...} />` のような component 要素 target を、callsite-scoped client action artifact と child host metadata へ分解し、SSR 後の独立 hydrate でも parent callsite handler を復元できるようにする。
  ],
  preconditions: [
    - directive target は component 要素であり、最終的に custom element host を持つ `defineComponent()` へ解決される
    - component target は explicit `client:*` / `data-dh-island*` metadata と colocated directive を同時指定しない
    - initial rollout では handler は module-scope で再評価できる形（module binding reference または module binding だけを参照する expression-body inline arrow）に限定する
    - bound event は child host boundary から観測可能か、child 側が host event として明示 re-emit する必要がある
  ],
  steps: [
    1. transformer は component target の `<strategy>:on<Event>` を認識する
    2. handler 本体を module-local client action artifact と stable action id へ抽出する
    3. action が参照する serializable capture payload を callsite ごとに生成する
    4. child component call には canonical `data-dh-island*` metadata と、internal action binding metadata / capture payload metadata を注入する
    5. runtime は child host hydrate 時に artifact registry から action id を解決し、host-visible event surface へ bind する
    6. `interaction` では trigger event と bound event が一致する場合、child host hydrate 直後に first-event replay を適用する
  ],
  postconditions: [
    - source 上では component target でも event と hydrate trigger が colocated に見える
    - SSR 後の child island 独立 hydrate でも parent callsite handler を復元できる
    - bare `client:*` を使わなくても child host 単位の deferred hydration を表現できる
  ],
  errors: [
    - child host boundary から観測不能な event を component target へ colocate した場合は transform error
    - callsite local capture や block-body inline handler など、module-scope で再評価できない handler は transform error
    - component target colocated と explicit `client:*` / `data-dh-island*` metadata を同時指定した場合は transform error
  ],
)

#feature_spec(
  name: "colocated client handlers v1 (proposal)",
  summary: [
    初期バージョンでは click-first の DX 改善を優先し、HTML 要素上の inline client handler を render replay ベースの host island hydration へ落とし込む。
  ],
  edge_cases: [
    - 同じ要素に複数の `<strategy>:on*` を書く場合の strategy 一貫性
    - `interaction:onClick` の first event replay
    - setup rerender で inline closure がそのまま再生成されること
    - nested JSX expression や loop 内 target に stable id をどう振るか
  ],
  test_cases: [
    - `<button load:onClick={...}>` を target marker + strategy metadata へ変換する
    - `<button interaction:onClick={...}>` を interaction metadata 付き transform output へ変換する
    - 同一 JSX root 内で `load:onClick` と `interaction:onClick` を混在させると transform error にする
    - colocated handler は通常の `onClick` binding として CSR setup に残る
    - target element に stable id marker が付与される
  ],
  impl_notes: [
    - colocated syntax は user-facing には 1 箇所に見えるが、MVP 実装では handler 自体は通常の render/setup に残す
    - v1 は HTML 要素 target のみを扱い、component target や custom event は後続検討に回す
    - strategy の host boundary 解決は `defineComponent()` 単位を基本とする
    - compile-time capture validation は v2 の artifact-based action extraction 時に導入する
  ],
)

== 検討事項

- imported function や module-level binding を v2 以降でどこまで許可するか（ただし known transparent thunk wrapper の allowlist は v1 で持ち込める）
- readonly object literal の許容範囲を shallow に留めるか nested readonly まで広げるか
- loop / conditional 内 target の stable id を DOM path で表すか marker で表すか
- 複数 strategy を 1 component 内で許可するか、sub-island 分割を別機能にするか
- custom event や form submit の replay semantics を v1 へ含めるか
- `visible:onClick` の observer options（threshold / rootMargin）を syntax に露出するか、runtime default に固定するか
- `idle:onClick` の timeout hint を将来 syntax へ含めるか
