= hydration

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

SSR 後の hydration を始めるための公開 API を提供する。
低レベルな `@dathra/runtime/hydration` の `hydrateIslands` を直接利用者に要求せず、
`@dathra/core/hydration` から短い導線で islands hydration を開始できるようにする。

== インターフェース仕様

#interface_spec(
  name: "core hydration API",
  summary: [
    `@dathra/core/hydration` は `hydrate()` を公開し、指定 root 内の hydration island を起動する。
  ],
  format: [
    *エクスポート*:
    - `hydrate(root?: Document | ShadowRoot | Element): () => void`

    *使用例*:
    ```typescript
    import { hydrate } from "@dathra/core/hydration";
    import "./App";

    hydrate();
    ```
  ],
  constraints: [
    - `root` を省略した場合は `document` を対象にする
    - `hydrate()` は `@dathra/runtime/hydration` の `hydrateIslands()` を呼び出す
    - `hydrateIslands()` が返す cleanup 関数をそのまま返す
  ],
)

== 機能仕様

#feature_spec(
  name: "hydration convenience API",
  summary: [
    client entry から `hydrateIslands(document)` を直接書かずに hydration を開始できる。
  ],
  test_cases: [
    - `hydrate()` が `document` を既定 root として `hydrateIslands()` を呼ぶ
    - `hydrate(root)` が指定 root を `hydrateIslands()` に渡す
    - `hydrate()` が cleanup 関数を返す
  ],
)
