= transform/mode-ssr

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 設計判断

#adr(
  header: header("SSR dynamic Map のキー安定化", Status.Accepted, "2026-03-09"),
  context: [
    SSR ランタイムでは text / insert プレースホルダーが連番 ID で解決される。
  ],
  decision: [
    `renderToString` へ渡す `dynamicValues` は、まず text / insert dynamic part に 1..n の連番キーを割り当て、その後 attr / spread dynamic part を n+1 以降へ配置する。
  ],
  rationale: [
    - SSR ランタイムのマーカー参照は text / insert プレースホルダーに対する連番 ID で行われる
    - attr / spread を同じ連番に混在させると、後続 insert / text が別 ID を参照して値がずれる
  ],
)

== 機能仕様

#feature_spec(
  name: "SSR JSX transform",
  summary: [
    SSR モードで JSX を compile-time shell と dynamic helper 呼び出しへ変換する。custom element DSD など generic runtime が必要なケースでは `renderToString(tree, state, new Map(...))` fallback を許可する。
  ],
  api: [
    ```typescript
    function transformJSXForSSRNode(
      node: JSXElement | JSXFragment,
      state: TransformState,
      nested: NestedTransformers,
    ): ESTNode
    ```
  ],
  constraints: [
    - compiler が static HTML shell を事前生成できる場合は `renderDynamicText` / `renderDynamicAttr` / `renderDynamicSpread` / `renderDynamicInsert` / `renderDynamicEach` を使う文字列結合へ変換する
    - custom element DSD など generic runtime renderer が必要なケースでは従来の `renderToString(tree, state, new Map(...))` fallback を使ってよい
    - text / insert / attr / spread を動的値へ反映する
    - logical expression や JSX を含む一般式は `insert` dynamic part として扱う
    - event は SSR HTML 出力に不要のため除外する
  ],
  test_cases: [
    - compile-time shell path では dynamic helper import が登録される
    - 動的値なしなら static string literal を直接返す
    - 動的値ありなら helper 呼び出しを含む文字列結合を生成する
    - event dynamic part は SSR 出力 helper に含まれない
    - attr dynamic part が先に出現しても text / insert marker id 対応が崩れない
    - custom element を含む tree は `renderToString` fallback を使える
  ],
  impl_notes: [
    - 動的テキスト（`renderDynamicText`）呼び出しの直後に `<!---->` を static part として結合し、Hydration 時のテキストノード境界を確保する
  ],
)
