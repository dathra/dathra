= ssr

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

Dathra アプリケーションを SSR で使い始めるための公開 API を提供する。
低レベルな `@dathra/components/ssr` の `renderDSD` を直接利用者に要求せず、
`@dathra/core/ssr` から短い導線で Declarative Shadow DOM HTML を生成できるようにする。

== インターフェース仕様

#interface_spec(
  name: "core SSR API",
  summary: [
    `@dathra/core/ssr` は `render()` と `defineSsrEntry()` を公開し、Dathra component の SSR HTML 生成と SSR entry の型付き contract を提供する。
  ],
  format: [
    *エクスポート*:
    - `render(...args: Parameters<typeof renderDSD>): ReturnType<typeof renderDSD>`
    - `defineSsrEntry<const Handler extends SsrEntryHandler>(handler: Handler): Handler`
    - `SsrEntryContext`
    - `SsrEntryResult`
    - `SsrEntryHandler`

    *使用例*:
    ```typescript
    import { defineSsrEntry, render } from "@dathra/core/ssr";
    import { App } from "./App";

    export default defineSsrEntry(({ request }) => {
      return {
        statusCode: 200,
        html: render(App, { path: new URL(request.url).pathname }),
      };
    });
    ```
  ],
  constraints: [
    - `render()` は `@dathra/components/ssr` の `renderDSD()` と同じ引数を受け付ける
    - `render()` は `renderDSD()` の戻り値をそのまま返す
    - store などの SSR option は `renderDSD()` に透過的に渡す
    - `defineSsrEntry()` は handler を変更せず、具体的な handler 型を保ったまま返す
    - `defineSsrEntry()` の handler は `{ request, requestId, url }` を受け取る
    - `defineSsrEntry()` の handler は `string`、`Response`、または `{ html, statusCode?, headers? }` を返せる
  ],
)

== 機能仕様

#feature_spec(
  name: "SSR convenience render",
  summary: [
    SSR entry から `renderDSD` を直接 import しなくても DSD HTML を生成できる。
  ],
  test_cases: [
    - `render()` が `renderDSD()` に引数を透過的に渡す
    - `render()` が `renderDSD()` の戻り値を返す
    - `defineSsrEntry()` が handler をそのまま返す
    - `defineSsrEntry()` が `Response` を返す handler を型として受け付ける
  ],
)
