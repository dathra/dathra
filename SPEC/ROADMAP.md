# Dathra ロードマップメモ

この文書は repository 全体のロードマップを把握するための補助メモである。

- 仕様の正本ではない
- 詳細仕様・API・振る舞い・テストケースは各 package の `SPEC.typ` と `implementation.test.ts` を正とする
- この文書は「何を、どの順序で、どの完成条件で進めるか」を俯瞰するために置く

## 戦略方針

現在の大方針は以下の 1 行に集約する。

**DSD Islands Framework with Component-Level Edge Caching**

目標は、Dathra を以下の性質を持つ framework へ発展させること。

- Compiler-First
- Fine-grained Reactivity
- Web Components / Declarative Shadow DOM 中心
- SSR / Edge 実行を前提にした request-safe な状態管理
- Islands ベースの段階的 hydration
- component 単位での cache / stream / style 制御

## 全体フェーズ

### Phase 0 — 基盤整備

SSR・hydration・store・style に関する基礎 primitive を整える。

### Phase 1 — Islands 連結

compiler が出した islands 指示と runtime の hydration 実行を end-to-end で接続する。

### Phase 2 — Edge / Cache 実運用化

component 単位 cache と edge 実行モデルを renderer に統合する。

### Phase 3 — Streaming 配信化

streaming SSR を islands / cache と矛盾なく接続し、配信パイプラインとして成立させる。

### Phase 4 — DX / 安定化

authoring DX・plugin 統合・文書化・検証系を仕上げ、継続運用可能な形に整える。

## Phase 0 — 基盤整備

### Pillar 1. Islands Directive

- 概要
  - JSX 上で `client:*` 指示を書けるようにし、islands hydration の宣言面を作る
- 対象 package
  - `packages/transformer`
  - 必要に応じて `packages/plugin`
- 依存順
  - なし
  - Phase 0 の最初に着手可能
- 完了条件
  - `client:load`
  - `client:visible`
  - `client:idle`
  - `client:interaction`
  - `client:media`
  - 以上が transform 対象として解釈される
  - 不正な directive 組み合わせが検証される
  - SSR / CSR それぞれで必要な出力情報が確定する
- 想定 API / primitive
  - JSX attribute としての `client:*`
  - transform 後 metadata を保持する internal shape
- 変更対象の入口ファイル
  - `packages/transformer/src/transform/jsx/implementation.ts`
  - `packages/transformer/src/transform/mode-ssr/implementation.ts`
  - `packages/transformer/src/transform/mode-csr/implementation.ts`
  - `packages/transformer/src/types.ts`
- 最初の test 観点
  - `client:visible` 付き JSX が SSR 出力に必要情報を残す
  - 無効な directive 組み合わせが transform error になる

### Pillar 2. Hydration Strategy Engine

- 概要
  - islands directive の出力を runtime 側で実行し、いつ hydration するかを制御する
- 対象 package
  - `packages/runtime`
  - `packages/core`
- 依存順
  - Pillar 1 の出力形式に依存
- 完了条件
  - strategy ごとの hydration 実行器がある
  - `visible` は IntersectionObserver を使う
  - `idle` は requestIdleCallback 相当を使う
  - `interaction` は user event 起点で hydrate する
  - `media` は media query 条件で hydrate する
  - hydrate 済み island を二重起動しない
- 想定 API / primitive
  - `hydrateIslands()`
  - strategy runner registry
  - island state marker / boot metadata reader
- 変更対象の入口ファイル
  - `packages/runtime/src/hydration/hydrate/implementation.ts`
  - `packages/runtime/src/hydration/index.ts`
  - `packages/core/src/runtime/index.ts`
- 最初の test 観点
  - `visible` island が observer 発火前は hydrate しない
  - 同一 island が二重 hydrate されない

### Pillar 3. Component-Level Cache

- 概要
  - component ごとの SSR 結果を cache 可能にする共通 abstraction を導入する
- 対象 package
  - `packages/runtime`
  - `packages/components`
  - 必要に応じて `packages/shared`
- 依存順
  - Pillar 1 / 2 と独立に設計できる
  - 実運用では Pillar 4 と接続が必要
- 完了条件
  - `ComponentCache` 相当の interface が定義されている
  - cache key / input / invalidation の責務境界が決まっている
  - cached renderer を組み立てる helper がある
  - Node / Edge adapter を追加可能な構造になっている
- 想定 API / primitive
  - `ComponentCache`
  - `createCachedRenderer()`
  - cache key builder
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/render/implementation.ts`
  - `packages/runtime/src/ssr/index.ts`
  - `packages/components/src/ssr/implementation.ts`
- 最初の test 観点
  - 同一入力では cache hit する
  - 入力差分があると cache miss になる

### Pillar 4. Streaming SSR

- 概要
  - 既存の string SSR に加えて stream 出力を追加する
- 対象 package
  - `packages/runtime`
  - 必要に応じて `packages/components`
- 依存順
  - Pillar 3 と接続しやすい
  - islands metadata の扱いで Pillar 1 / 2 と整合が必要
- 完了条件
  - `renderToStream()` 相当の API が定義される
  - 既存 `renderToString()` と役割分担が整理される
  - marker / serialization / component renderer が stream でも成立する
  - stream 中断時の失敗モードが定義される
- 想定 API / primitive
  - `renderToStream()`
  - stream writer / enqueue abstraction
  - abort-aware render context
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/render/implementation.ts`
  - `packages/runtime/src/ssr/index.ts`
  - `packages/runtime/src/ssr/markers/implementation.ts`
- 最初の test 観点
  - string renderer と stream renderer で同等 HTML が得られる
  - abort 時に stream が安全に停止する

### Pillar 5. AsyncLocalStorage Store Migration

- 概要
  - Node.js / Edge で request-safe な store boundary を実現する
- 対象 package
  - `packages/store`
  - 影響確認先として `packages/runtime`, `packages/components`, `packages/core`
- 依存順
  - Phase 0 の他 pillar と並行可能
- 完了条件
  - Node.js / Edge build で `AsyncLocalStorage` を使う
  - browser build は同期スタックのまま維持する
  - `withStore()` の公開 API を変えない
  - 並行 SSR request で store が漏洩しない
  - async callback 内で `getCurrentStore()` が正しく動く
- 想定 API / primitive
  - `withStore()`
  - `getCurrentStore()`
  - internal `runWithStoreContext()`
- 変更対象の入口ファイル
  - `packages/store/src/withStore/implementation.ts`
  - `packages/store/src/withStore/internal.ts`
  - `packages/store/src/withStore/internal.node.ts`
- 最初の test 観点
  - `await` / microtask / timer を跨いでも current store が維持される
  - 並行 request で store が混線しない
- 状態
  - **完了**

### Pillar 6. Shadow DOM Global CSS Injection

- 概要
  - Shadow DOM component 群へ全体 CSS を注入・共有する仕組みを作る
- 対象 package
  - `packages/components`
  - `packages/runtime`
  - 必要に応じて `packages/core`
- 依存順
  - Phase 0 の最後に置くのが自然
  - SSR / hydration と接続するため Pillar 2 / 4 の前提整理があると進めやすい
- 完了条件
  - `adoptGlobalStyles()` 相当の API / primitive がある
  - 同一 style を component 間で再利用できる
  - SSR 初期描画と hydration 後で style 適用が破綻しない
  - Shadow DOM 境界を越える style 配布の責務が整理される
- 想定 API / primitive
  - `adoptGlobalStyles()`
  - global style registry
  - SSR style serialization hook
- 変更対象の入口ファイル
  - `packages/components/src/css/implementation.ts`
  - `packages/components/src/defineComponent/implementation.ts`
  - `packages/runtime/src/hydration/hydrate/implementation.ts`
- 最初の test 観点
  - 複数 component が同一 global style を重複登録しない
  - SSR 後 hydration しても style が欠落しない
- 状態
  - **次候補**

## Phase 1 — Islands 連結

### Pillar 1. Transformer-Runtime Contract Finalization

- 概要
  - directive が最終的にどの metadata へ落ちるかを固定し、runtime と契約化する
- 対象 package
  - `packages/transformer`
  - `packages/runtime`
  - `packages/plugin`
- 依存順
  - Phase 0 / Pillar 1, 2 完了後
- 完了条件
  - transformer 出力の islands metadata 形式が固定される
  - runtime がその形式のみを前提に hydrate できる
  - build tool 経由でも mode / metadata が失われない
- 想定 API / primitive
  - internal island metadata schema
  - transformer-runtime contract tests
- 変更対象の入口ファイル
  - `packages/transformer/src/types.ts`
  - `packages/runtime/src/hydration/deserialize/implementation.ts`
  - `packages/plugin/src/plugin/implementation.ts`
- 最初の test 観点
  - plugin 経由 build でも islands metadata が保持される
  - runtime が旧形式 metadata を前提にしない

### Pillar 2. SSR Island Markers and Payload Shape

- 概要
  - SSR HTML に islands の起動情報を埋め込み、client が復元可能にする
- 対象 package
  - `packages/runtime`
  - `packages/transformer`
  - `packages/components`
- 依存順
  - Phase 1 / Pillar 1 に依存
- 完了条件
  - island 境界が SSR HTML 上で識別できる
  - client boot に必要な payload 形式が決まる
  - store / props / hydration strategy の受け渡し責務が定義される
- 想定 API / primitive
  - island marker creator
  - island payload serializer / deserializer
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/markers/implementation.ts`
  - `packages/runtime/src/ssr/serialize/implementation.ts`
  - `packages/runtime/src/hydration/deserialize/implementation.ts`
- 最初の test 観点
  - SSR HTML から island payload を復元できる
  - props と strategy が marker 経由で失われない

### Pillar 3. Partial Hydration Boot Flow

- 概要
  - island ごとに必要な範囲だけ hydrate する起動フローを完成させる
- 対象 package
  - `packages/runtime`
  - `packages/core`
- 依存順
  - Phase 1 / Pillar 1, 2 に依存
- 完了条件
  - island 単位で hydrate 開始できる
  - page 全体 hydration を前提にしない
  - nested island / sibling island の起動順が破綻しない
- 想定 API / primitive
  - island boot scheduler
  - per-island hydration entry
- 変更対象の入口ファイル
  - `packages/runtime/src/hydration/hydrate/implementation.ts`
  - `packages/runtime/src/hydration/walker/implementation.ts`
- 最初の test 観点
  - sibling island を独立 hydrate できる
  - nested island の親子順が壊れない

### Pillar 4. Playground / Example Validation

- 概要
  - islands の設計が机上仕様で終わらないよう、playground と実例で検証する
- 対象 package
  - `playgrounds/**`
  - 補助として `packages/plugin`, `packages/core`
- 依存順
  - Phase 1 / Pillar 1-3 に依存
- 完了条件
  - 最低 1 つ以上の islands playground がある
  - `load / visible / idle / interaction / media` の挙動差が見える
  - SSR → hydration の流れを人間が目視で確認できる
- 想定 API / primitive
  - playground 用 demo entry
  - e2e verification scripts
- 変更対象の入口ファイル
  - `playgrounds/**/src/*`
  - `playgrounds/**/vite.config.ts`
- 最初の test 観点
  - Playwright で strategy ごとの hydration タイミング差を確認できる
  - 初期 SSR HTML と hydrate 後 UI が整合する

## Phase 2 — Edge / Cache 実運用化

### Pillar 1. Cache Key and Invalidation Model

- 概要
  - component cache の key 設計と invalidation 責務を明確化する
- 対象 package
  - `packages/runtime`
  - `packages/shared`
- 依存順
  - Phase 0 / Pillar 3 に依存
- 完了条件
  - props / store snapshot / request context のうち何を key に含めるか定義される
  - cache hit / miss の整合条件が定義される
  - invalidation 戦略を差し替え可能にする
- 想定 API / primitive
  - cache key schema
  - invalidation policy interface
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/render/implementation.ts`
  - `packages/shared/src/index.ts`
- 最初の test 観点
  - key 生成が順序や表現差分で不安定にならない
  - invalidation policy を差し替えても renderer 契約が崩れない

### Pillar 2. Edge Adapter Layer

- 概要
  - Cloudflare Workers 等に載せられる cache / render adapter 層を整える
- 対象 package
  - `packages/runtime`
  - `packages/plugin`
  - 必要に応じて adapter 用 package
- 依存順
  - Phase 2 / Pillar 1 に依存
- 完了条件
  - edge runtime 前提で動く adapter interface がある
  - platform 固有 API を core renderer から分離できている
  - Node / Edge の両方で置き換え可能である
- 想定 API / primitive
  - edge cache adapter
  - platform environment adapter
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/index.ts`
  - `packages/plugin/src/plugin/implementation.ts`
- 最初の test 観点
  - adapter 未設定時の fallback が明確
  - edge 向け adapter を差し込んでも core API が変わらない

### Pillar 3. Cache-aware Component Renderer

- 概要
  - component renderer が cache 層を透過的に使えるようにする
- 対象 package
  - `packages/components`
  - `packages/runtime`
- 依存順
  - Phase 2 / Pillar 1, 2 に依存
- 完了条件
  - component render 前後に cache lookup / store が組み込まれる
  - cache hit 時に不要な render work を省略できる
  - cache miss 時に結果を保存できる
- 想定 API / primitive
  - cache-aware component renderer wrapper
- 変更対象の入口ファイル
  - `packages/components/src/ssr/implementation.ts`
  - `packages/runtime/src/ssr/render/implementation.ts`
- 最初の test 観点
  - cache hit 時に component setup が再実行されない
  - cache miss 時に renderer 結果が保存される

### Pillar 4. Request Context and Cache Safety

- 概要
  - request-local 状態と cache 共有状態が混ざらないよう安全境界を固める
- 対象 package
  - `packages/store`
  - `packages/runtime`
  - `packages/components`
- 依存順
  - Phase 0 / Pillar 5 および Phase 2 / Pillar 3 に依存
- 完了条件
  - request-local data を cache key / render path へどう反映するかが明文化される
  - user-specific state が共有 cache に混入しない
  - SSR request isolation と cache 共有の境界が検証される
- 想定 API / primitive
  - request context extractor
  - cache safety guardrails
- 変更対象の入口ファイル
  - `packages/store/src/withStore/implementation.ts`
  - `packages/runtime/src/ssr/render/implementation.ts`
- 最初の test 観点
  - user-specific store が shared cache に誤混入しない
  - 同一 component でも request context 差分を正しく区別する

## Phase 3 — Streaming 配信化

### Pillar 1. Stream Renderer Core

- 概要
  - chunk 単位で HTML を流せる renderer core を作る
- 対象 package
  - `packages/runtime`
- 依存順
  - Phase 0 / Pillar 4 に依存
- 完了条件
  - stream writer abstraction がある
  - renderer が逐次 flush 可能になる
  - string renderer と結果整合性を取れる
- 想定 API / primitive
  - stream writer
  - chunk scheduler
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/render/implementation.ts`
  - `packages/runtime/src/ssr/index.ts`
- 最初の test 観点
  - flush 順と最終 HTML が期待どおりである
  - text / marker / component を混在しても stream が崩れない

### Pillar 2. Stream + Islands Coordination

- 概要
  - stream 中に islands metadata を安全に配置し、hydrate 側と接続する
- 対象 package
  - `packages/runtime`
  - `packages/transformer`
- 依存順
  - Phase 1 完了、および Phase 3 / Pillar 1 に依存
- 完了条件
  - stream 途中でも islands metadata が壊れない
  - hydrate 側が chunk 境界に依存しない
  - island boot 情報が最終的に一貫した形で届く
- 想定 API / primitive
  - stream-safe island marker emission
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/markers/implementation.ts`
  - `packages/runtime/src/hydration/deserialize/implementation.ts`
- 最初の test 観点
  - chunk 分割位置が変わっても island 復元結果が同じ
  - marker の前後が別 chunk でも hydrate できる

### Pillar 3. Stream + Cache Coordination

- 概要
  - cached component と streaming output を矛盾なく共存させる
- 対象 package
  - `packages/runtime`
  - `packages/components`
- 依存順
  - Phase 2 完了、および Phase 3 / Pillar 1 に依存
- 完了条件
  - cache hit component を stream に直接流せる
  - cache miss component も同じ output contract に従う
  - partial flush と cache の整合条件が定義される
- 想定 API / primitive
  - cached chunk producer
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/render/implementation.ts`
  - `packages/components/src/ssr/implementation.ts`
- 最初の test 観点
  - cache hit chunk が stream 上で正しい位置に入る
  - miss / hit 混在でも順序が壊れない

### Pillar 4. Abort / Error / Fallback Handling

- 概要
  - stream 中断、component error、fallback 置換を扱えるようにする
- 対象 package
  - `packages/runtime`
  - 必要に応じて `packages/components`
- 依存順
  - Phase 3 / Pillar 1-3 に依存
- 完了条件
  - abort signal の扱いが定義される
  - partial output 済み時の error policy が決まる
  - fallback rendering の責務境界が明確である
- 想定 API / primitive
  - abort-aware render context
  - stream fallback handler
- 変更対象の入口ファイル
  - `packages/runtime/src/ssr/render/implementation.ts`
- 最初の test 観点
  - abort 後に余計な chunk を書かない
  - component error 時に fallback policy が一貫している

## Phase 4 — DX / 安定化

### Pillar 1. Plugin and Tooling Integration

- 概要
  - islands / SSR / stream / cache の mode が build tool と破綻なく接続するようにする
- 対象 package
  - `packages/plugin`
  - `packages/transformer`
- 依存順
  - Phase 1-3 の主要契約に依存
- 完了条件
  - plugin 経由で必要な compile mode が伝播する
  - DX 上の default 設定が整理される
  - example project から迷わず使える
- 想定 API / primitive
  - plugin option surface
  - mode propagation contract
- 変更対象の入口ファイル
  - `packages/plugin/src/plugin/implementation.ts`
  - `packages/transformer/src/index.ts`
- 最初の test 観点
  - plugin 設定で islands / SSR / cache / stream mode が意図通り切り替わる
  - default 設定で最小構成が動く

### Pillar 2. Testing Matrix Expansion

- 概要
  - feature 単体テストだけでなく、層をまたぐ検証を増やす
- 対象 package
  - `packages/**`
  - `playgrounds/**`
- 依存順
  - 各 phase の実装完了に追従
- 完了条件
  - transform → SSR → hydrate までの統合検証がある
  - Node / browser / edge を意識した検証観点が増える
  - cache / stream / island の組み合わせが回帰テスト化される
- 想定 API / primitive
  - e2e test matrix
  - cross-package fixtures
- 変更対象の入口ファイル
  - `packages/**/implementation.test.ts`
  - `playgrounds/**`
- 最初の test 観点
  - 代表フローを e2e で再現できる
  - package 単体テストだけでは漏れる組み合わせを補完できる

### Pillar 3. Documentation and Recipes

- 概要
  - 使い方、設計意図、移行方法を利用者視点で整理する
- 対象 package
  - `SPEC/`
  - 各 package docs / README / playgrounds
- 依存順
  - 主要 pillar 完了後
- 完了条件
  - islands の書き方
  - SSR / cache / stream の選択指針
  - store boundary と request isolation の説明
  - Shadow DOM style 戦略の説明
- 想定 API / primitive
  - recipe docs
  - migration guides
- 変更対象の入口ファイル
  - `SPEC/ROADMAP.md`
  - `SPEC/SPEC.typ`
  - playground docs / package README
- 最初の test 観点
  - 主要機能に最低 1 つずつ実例がある
  - 新規利用者がサンプルから再現可能である

### Pillar 4. Production Readiness Review

- 概要
  - 仕様・実装・テスト・DX のズレを横断的に棚卸しする
- 対象 package
  - repository 全体
- 依存順
  - Phase 1-4 の主要要素完了後
- 完了条件
  - package ごとの SPEC / test / implementation の乖離が把握されている
  - 高リスク箇所に review / benchmark / examples が揃っている
  - main に継続投入できる安定度になっている
- 想定 API / primitive
  - review checklist
  - benchmark / readiness criteria
- 変更対象の入口ファイル
  - `SPEC/SPEC.typ`
  - `packages/**/SPEC.typ`
  - `packages/**/implementation.test.ts`
- 最初の test 観点
  - 重点 package で spec-review を回せる
  - benchmark / example / regression の 3 点が揃う

## 現在のスナップショット

### 完了済み

- Phase 0 / Pillar 1: Islands Directive
  - `client:load` / `client:visible` / `client:idle` / `client:interaction` / `client:media` を transform 対象として解釈できる
  - host-level `client:*` metadata の正規化と不正組み合わせの検証が入っている
  - colocated client handler として `load:onClick` / `interaction:onClick` / `visible:onClick` / `idle:onClick` を HTML 要素で扱える

- Phase 0 / Pillar 2: Hydration Strategy Engine
  - `hydrateIslands()` に strategy runner があり、`load` / `visible` / `idle` / `interaction` / `media` を実行できる
  - hydrate 済み island の二重起動を防ぐ
  - colocated click hydration も host metadata 経由で同じ scheduler に載る

- Phase 0 / Pillar 5: AsyncLocalStorage Store Migration
  - Node.js / Edge で `withStore()` が `AsyncLocalStorage` を使う
  - browser は同期スタックを維持する
  - 並行 SSR request の分離を確認済み
  - SSR playground に具体例を追加済み

- Phase 0 / Pillar 6: Shadow DOM Global CSS Injection
  - global style adoption と registry/dedupe の基盤が入っている
  - SSR 初期描画と hydration 後の style 整合を扱う実装とテストがある
  - whitespace 差分だけの同義 CSS を重複登録しないよう normalizing dedupe を入れている

### 次候補

- Phase 1 / Pillar 1: Transformer-Runtime Contract Finalization
- Phase 1 / Pillar 2: SSR Island Markers and Payload Shape
- Phase 1 / Pillar 4: Playground / Example Validation の整理と回帰自動化

### 未着手が多い領域

- component-level cache
- streaming SSR
- Phase 1-4 の未完了 pillar 接続

## 運用メモ

- この文書は planning memo であり、仕様変更の正本にはしない
- 各 pillar 着手時は、まず関係 package の `SPEC.typ` と `implementation.test.ts` を更新する
- package 境界や repo-wide 原則に変更が出る場合のみ `SPEC/SPEC.typ` も更新する
