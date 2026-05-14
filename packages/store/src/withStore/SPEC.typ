#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

= withStore API

== 目的

root render と nested subtree の両方で同じ記法を使い、明示的な store boundary を構築できるようにする。

== 機能仕様

#feature_spec(
  name: "withStore",
  summary: [
    `render` callback を特定の `AtomStore` 境界の中で評価する boundary primitive。`mount()` / `hydrate()` の root boundary と nested subtree override の両方で共通に使う。
  ],
  api: [
    ```typescript
    function withStore<T>(store: AtomStore, render: () => T): T;

    function getCurrentStore(): AtomStore | undefined;
    ```

    *boundary semantics*:
    - `withStore(store, render)` は `render()` を同期的に評価する
    - callback 内で生成された Dathra subtree は `store` を継承する
    - nested `withStore()` は内側の store を優先する

    *usage*:
    - root boundary: `mount(root, withStore(store, () => <App />))`
    - nested boundary: `return withStore(store.fork(...), () => <Subtree />)`

    *introspection semantics*:
    - `getCurrentStore()` は現在 active な store boundary を返す
    - boundary 外では `undefined` を返す
    - Node.js / Edge: `AsyncLocalStorage` によりリクエストスコープで分離される
    - Browser: module-global 同期スタックで管理される
  ],
  edge_cases: [
    - browser build: `withStore()` は非同期継承を行わない（module-global 同期スタック）
    - Node.js / Edge build: `AsyncLocalStorage` により、同一リクエスト内の非同期 callback にも store boundary が自動伝播する
    - callback を抜けた後は外側の store boundary に戻る
    - boundary 外で store-required API を呼ぶ場合は開発時に fail-fast できる設計を優先する
    - 並行リクエスト間で store boundary が漏洩しない（Node.js / Edge build）
  ],
  test_cases: [
    - root render で `withStore()` を使って store boundary を作成する
    - nested `withStore()` が内側優先で store を切り替える
    - callback 終了後に外側の store boundary が復元される
    - `fork()` した child store を nested boundary に適用できる
    - 並行 `withStore()` 呼び出しが互いの store boundary に干渉しない
    - nested code が current store boundary を通じて atom 値を解決できる
  ],
)

== 設計判断

#adr(
  header("store boundary の primitive は withStore に統一する", Status.Accepted, "2026-03-10"),
  [
    root mount と nested subtree override で別々の boundary API を持つと、store 伝播の mental model が分裂する。
  ],
  [
    root・nested の両方で `withStore(store, render)` を store boundary の共通 primitive とする。
  ],
  [
    - `mount()` / `hydrate()` の書き方と subtree override の書き方を揃えられる
    - store 伝播の開始地点がコード上で明示される
    - context lookup を導入せずに boundary を表現できる
  ],
)

#adr(
  header("withStore は同期 boundary に限定する", Status.Superseded, "2026-03-10"),
  [
    async context propagation まで含めると、runtime 状態管理が複雑になり、store boundary の予測可能性が下がる。
  ],
  [
    `withStore()` は同期的な render boundary に限定し、非同期 callback への暗黙伝播は行わない。
  ],
  [
    - 実行モデルが単純になる
    - boundary の有効範囲を AST と callsite で把握しやすい
    - 非同期文脈で store が必要な場合は明示的に渡す設計を促せる
  ],
)

#adr(
  header("Node.js / Edge では AsyncLocalStorage でリクエスト分離する", Status.Accepted, "2026-03-14"),
  [
    SSR で複数リクエストが同時に処理される場合、module-global な `storeStack` 配列では
    リクエスト A の store boundary がリクエスト B に漏洩する。
    Islands Architecture + Edge SSR を実現するには、リクエストごとの store 分離が必須。
  ],
  [
    internal store stack の実装を環境ごとに分離する：

    - *Node.js / Edge build* (`internal.node.ts`): `AsyncLocalStorage` を使い、
      `withStore()` の `run()` 内でリクエストスコープの store stack を保持する。
      同一リクエスト内の非同期 callback にも store boundary が自動伝播する。
    - *Browser build* (`internal.ts`): 従来の module-global 同期スタックを維持する。
      ブラウザは単一ユーザー・単一スレッドのため、同期スタックで十分。
    - `package.json` の conditional exports (`"node"` vs `"default"`) で解決する。
    - 公開 API (`withStore`, `getCurrentStore`) のシグネチャは変更しない。
  ],
  [
    - 並行 SSR リクエスト間の store 漏洩が解消される
    - `withStore` の公開 API は完全に後方互換
    - Node.js / Edge での非同期 callback 内で `getCurrentStore()` が store を返すようになる（振る舞い変更）
    - ブラウザ build は変更なし — バンドルサイズ増加ゼロ
    - `AsyncLocalStorage` は Node.js 16+、Cloudflare Workers、Deno、Bun すべてで利用可能
  ],
  supersedes: ("withStore は同期 boundary に限定する",),
)
