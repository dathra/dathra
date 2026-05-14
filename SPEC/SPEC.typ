#import "functions.typ": *
#import "settings.typ": apply-settings
#show: apply-settings

= SPEC.typ

== 目的

VNode ベースの構成から、Compiler-First / Fine-grained Reactivity / Direct DOM /
Web Components を中核とする構成へ移行する。

この文書は repository 全体の *umbrella spec* として、
全体方針・責務分担・横断原則のみを定義する。
詳細な API 署名、詳細な振る舞い、詳細なデータ形式、package 固有の設計判断は
各 package の `SPEC.typ` と `implementation.test.ts` を正とする。

- VNode システムは repository 全体の前提として廃止する
- JSX は compiler が静的/動的に分解し、各 mode に適した出力へ変換する
- runtime は最小限の原語を提供し、複雑さは compiler 側へ寄せる
- reactivity は TC39 Signals に整合した読み取りモデルを採用する
- Web Components は主要な公開コンポーネントモデルとして扱う
- client / ssr / edge の環境差は package specs で吸収する

== インターフェース仕様

#interface_spec(
  name: "リポジトリ全体アーキテクチャ",
  summary: [
    Transformer, Runtime, Reactivity, Components, Store, Plugin, Core の各層が
    明確な責務境界を持って協調する。
  ],
  format: [
    - `packages/transformer/**/SPEC.typ`: JSX/TSX の解析、IR、CSR/SSR 変換
    - `packages/runtime/**/SPEC.typ`: DOM 原語、SSR 出力、Hydration、serialize/deserialize
    - `packages/reactivity/**/SPEC.typ`: signal / computed / effect / batch / createRoot
    - `packages/components/**/SPEC.typ`: defineComponent、CSS、DSD SSR、component registry
    - `packages/store/**/SPEC.typ`: atom store と snapshot 契約
    - `packages/plugin/**/SPEC.typ`: build tool 統合と mode 伝播
    - `packages/core/**/SPEC.typ`: 公開 API 集約と JSX runtime
  ],
  constraints: [
    - top-level spec は package 間の境界と全体方針のみを扱う
    - マーカー文字列、API 署名、変換規則、アルゴリズム詳細は担当 package spec に置く
  ],
)

#interface_spec(
  name: "仕様の正本",
  summary: [
    repository 内の仕様は責務単位で分割管理し、詳細仕様の正本を一意にする。
  ],
  format: [
    - `SPEC/SPEC.typ`: 全体方針、責務境界、横断原則、repo-wide ADR 運用
    - `packages/**/SPEC.typ`: package / feature ごとの詳細仕様と設計判断
    - `packages/**/implementation.test.ts`: 期待される挙動の検証基準
  ],
  constraints: [
    - 実装変更時は担当 package の `SPEC.typ` と `implementation.test.ts` を先に更新する
    - top-level spec に package 詳細を再掲しない
    - top-level spec は詳細挙動の正本にならない
  ],
)

== 振る舞い仕様

#behavior_spec(
  name: "仕様変更フロー",
  summary: [
    仕様変更は責務を持つ package を起点に行い、top-level spec は境界変更がある場合のみ更新する。
  ],
  preconditions: [
    - 変更対象の機能に対応する package / feature が特定できる
  ],
  steps: [
    1. 変更の主担当 package を特定する
    2. 該当 package の `SPEC.typ` と `implementation.test.ts` を更新する
    3. package 間の責務境界や repo-wide 原則に変化がある場合のみ `SPEC/SPEC.typ` を更新する
    4. 複数 package に影響する場合は、影響を受ける各 package spec を整合させる
  ],
  postconditions: [
    - 仕様変更の正本が担当 package に集約されている
    - top-level spec と package specs の役割分担が維持されている
  ],
  errors: [
    - package detail を top-level spec に直接追加しない
  ],
)

#behavior_spec(
  name: "横断整合性の維持",
  summary: [
    各 package の仕様は end-to-end で接続され、単体で正しくても隣接層と矛盾してはならない。
  ],
  steps: [
    1. transformer は runtime が解釈できる出力のみを生成する
    2. SSR / Hydration / state transfer は同じ構造モデルと状態モデルを共有する
    3. components は runtime / reactivity / store の契約に従う
    4. plugin は build tool 上の mode を transformer へ正しく伝播する
  ],
  postconditions: [
    - 層をまたぐ責務境界が明確である
    - 詳細仕様の所在を package 単位で追跡できる
    - repo-wide の判断は top-level spec から把握できる
  ],
)

== 決定の優先順位

以下の順序で設計判断を行う。

1. *責務境界と仕様の所有者*
2. *compiler と runtime の契約*
3. *SSR / Hydration / state transfer の整合*
4. *公開 API の最小化*
5. *client / ssr / edge の環境制約*
6. *上記を崩さない範囲での DX 改善*


== ADR

=== ADR 運用ルール

- ADR は設計判断の履歴として記録する
- `Status.Accepted` になった ADR は、採用済み判断として扱い、意味内容を直接書き換えない
- `Status.Accepted` の ADR に判断変更が必要な場合は、新しい ADR を追加し、既存 ADR を supersede する関係を明示する
- 既存 ADR に直接加えてよい修正は、誤字脱字、リンク修正、表現明確化など、判断内容を変えない変更に限る
- package 固有の詳細 ADR は、以後は担当 package の `SPEC.typ` に記録する
- `SPEC/SPEC.typ` には repo-wide な判断と document boundary に関する ADR のみを新規追加する
- 以下の historical ADR は履歴保持のため残し、意味内容を変更しない
- historical ADR 内の参照先が旧 top-level section 名を含む場合でも、現行の正本は各 package spec とする

#adr(
  header("トップレベル SPEC の境界", Status.Accepted, "2026-03-13"),
  [
    `SPEC/SPEC.typ` に package-level の API 詳細、Hydration 手順、IR 形式、runtime 契約などが蓄積し、
    各 package の `SPEC.typ` と重複・乖離が発生していた。
  ],
  [
    `SPEC/SPEC.typ` は umbrella spec とし、全体方針・責務境界・横断原則のみを定義する。
    詳細な API、詳細な振る舞い、詳細なデータ形式、package 固有の設計判断は
    担当 package の `SPEC.typ` と `implementation.test.ts` を正とする。
    既存の詳細 ADR は履歴として保持するが、継続的な詳細更新は担当 package 側で行う。
  ],
  [
    - top-level spec と package specs の重複を減らせる
    - 詳細仕様の変更箇所を担当 package に局所化できる
    - repo-wide の意図と package-level の正本を分離できる
  ],
  alternatives: [
    1. *top-level に詳細を残す*: 全体像は見やすいが、重複と乖離が起きやすい
    2. *単一の巨大 SPEC に集約する*: 正本は一つになるが、責務境界が不明瞭になり変更コストが高い
  ],
)

=== Historical ADRs

#adr(
  header("SSR Hydration マーカー設計", Status.Accepted, "2026-01-19"),
  [
    SSR で生成した HTML を CSR で再利用（Hydration）するには、動的な箇所を特定するためのマーカーが必要。マーカーの方式と粒度を決定する必要がある。

    検討すべき観点：
    - DOM の汚染度（属性 vs コメント）
    - 探索コスト（線形走査 vs 直接参照）
    - テキストノードや挿入点の表現（属性では不可）
    - デバッグ容易性
  ],
  [
    *混在方式* を採用する。

    - 境界（挿入点・ブロック・テキスト）: HTMLコメント
    - 要素への紐付け: `data-*` 属性（必要時のみ）

    基本は *コメント境界＋順序* で復元する。`data-*` は以下の場合のみ使用：
    - 復元が壊れやすい箇所の補強
    - 機能コンポーネントの適用先の明示
    - デバッグ可視化
  ],
  [
    - コメントで境界を表現することで、テキストノードや挿入点も統一的に扱える
    - `data-*` を原則使わないことで、本番 HTML がクリーンに保たれる
    - 順序ベースの復元は、DOM 構造の変更に弱い（SSR/CSR の出力が一致する前提）
  ],
  alternatives: [
    1. *コメントのみ*: DOM がクリーンだが、要素への直接参照ができない
    2. *`data-*` のみ*: テキストノードや挿入点の表現が困難
    3. *混在（常時 `data-*`）*: DOM が汚れる、本番で不要な情報が残る
  ],
  references: (
    link("https://github.com/solidjs/solid")[SolidJS - Hydration 実装],
    link("https://svelte.dev/docs/svelte/svelte-compiler")[Svelte - claim による DOM 再利用],
  ),
)

#adr(
  header("Shadow DOM Hydration スコープ", Status.Accepted, "2026-01-19"),
  [
    Web Components の Shadow DOM を SSR → Hydration する際、どの範囲を対象にするか、どの API を使うかを決定する必要がある。

    検討すべき観点：
    - `open` vs `closed` ShadowRoot のアクセス可否
    - Declarative Shadow DOM (DSD) のブラウザ対応状況
    - SSR 出力に Shadow DOM 内容を含められるか
  ],
  [
    - *ShadowRoot は `open` のみ対象* とする
    - *Declarative Shadow DOM (DSD) を第一候補* とする
    - 非対応環境は `attachShadow()` → DOM 構築 → Hydration にフォールバック
  ],
  [
    - `open` 限定により、外部から `el.shadowRoot` で走査可能
    - DSD により、SSR で Shadow DOM 内容を HTML に含められる
    - 非対応ブラウザではフォールバックが必要（初期表示が遅れる可能性）
    - `closed` な Shadow DOM は Hydration 対象外となる
  ],
  alternatives: [
    1. *DSD なし（クライアント生成のみ）*: SSR の恩恵が Shadow 内に及ばない
    2. *`closed` も対象*: 外部からアクセス不可、参照確保タイミングが複雑化
  ],
  references: (
    link("https://developer.chrome.com/docs/css-ui/declarative-shadow-dom")[Declarative Shadow DOM - Chrome Developers],
  ),
)

#adr(
  header("Web Component の Hydration 責務", Status.Accepted, "2026-01-19"),
  [
    Hydration を「誰が」実行するかを決定する必要がある。アプリ全体の `hydrate()` が一括で行うか、各 Web Component が自分の ShadowRoot を担当するか。

    検討すべき観点：
    - Web Component を外部フレームワーク（React/Vue）でも使いたい
    - 二重初期化の防止
    - パフォーマンス（一括 vs 個別）
  ],
  [
    *Web Component が自分の ShadowRoot を担当* する。

    - 各 WC は `connectedCallback` 等で自身の `shadowRoot` を Hydration
    - アプリ全体の `hydrate()` は補助的な役割（呼ぶだけ/一括最適化用）
    - 二重初期化は検出してスキップ（冪等性を保証）
  ],
  [
    - React/Vue 等から使っても、WC 単体で Hydration が完結する
    - Dathra アプリでは全体 `hydrate()` による一括最適化も可能
    - 冪等性の保証が必須（WeakMap で管理）
    - WC ごとに Hydration ロジックを持つため、コードが分散する
  ],
  alternatives: [
    1. *アプリ全体の `hydrate()` が一括管理*: 外部 FW から使う場合に機能しない
    2. *完全に分離（WC は独自実装）*: Dathra の恩恵が Shadow 内に及ばない
  ],
  references: (),
)

#adr(
  header("Hydration 探索戦略", Status.Accepted, "2026-01-25"),
  [
    Hydration 時に SSR マーカーをどのように探索するかを決定する必要がある。

    検討すべき観点：
    - 探索コスト（線形 vs 直接参照）
    - 実装複雑性
    - ミスマッチ時の検出容易性
  ],
  [
    *TreeWalker による線形探索* を採用する。

    - `document.createTreeWalker()` でコメントノードを順番に走査
    - マーカーの種類（text/insert/block）に応じて処理を分岐
    - 探索範囲は ShadowRoot 単位で自然に分離される
  ],
  [
    - O(n) だが、Web Component 分割により各 ShadowRoot は数十〜数百ノード程度
    - TreeWalker はブラウザのネイティブ API で高度に最適化されている
    - SolidJS・Svelte と同様のアプローチで実績あり
    - シンプルで実装・デバッグが容易
  ],
  alternatives: [
    1. *key で直接参照*: `data-dh="ID"` で要素を特定。O(1) だが HTML が汚れる、ID 管理が複雑
    2. *境界スコープ化*: ブロック単位で探索範囲を限定。実装が複雑
  ],
  references: (
    link(
      "https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/internal/client/dom/hydration.js",
    )[Svelte - hydration.js],
  ),
)

#adr(
  header("Hydration の冪等性保証", Status.Accepted, "2026-01-25"),
  [
    二重初期化を検出して安全にスキップできる仕組みが必要。

    検討すべき観点：
    - フラグの管理方法（DOM 属性 vs メモリ）
    - スコープ（要素単位 / ShadowRoot 単位）
    - 性能への影響
  ],
  [
    *WeakMap による ShadowRoot 単位の管理* を採用する。

    ```typescript
    const hydratedRoots = new WeakMap<ShadowRoot, true>();

    function hydrate(root: ShadowRoot) {
      if (hydratedRoots.has(root)) return; // 二重初期化防止
      hydratedRoots.set(root, true);
      // ... Hydration 処理 ...
    }
    ```
  ],
  [
    - 本番 HTML がクリーンに保たれる（`data-dh-hydrated` 属性不要）
    - ShadowRoot が GC されると自動的にエントリも削除される
    - 要素単位の管理は不要（ShadowRoot 単位で十分）
  ],
  alternatives: [
    1. *`data-dh-hydrated` 属性*: DOM 上で可視、デバッグ容易だが HTML が汚れる
    2. *ハイブリッド*: 本番=WeakMap、開発=属性。環境差異が生じる
  ],
  references: (),
)

#adr(
  header("Hydration ミスマッチ方針", Status.Accepted, "2026-01-25"),
  [
    SSR と CSR の出力が一致しない場合の対処方針を決定する必要がある。

    検討すべき観点：
    - 開発体験（早期発見）
    - 本番環境の安定性
    - 復旧可能性
  ],
  [
    *環境別の方針* を採用する。

    - *開発環境（`__DEV__`）*: 例外を投げて停止。バグを早期発見。
    - *本番環境*: 警告をコンソールに出力し、CSR フォールバックを試みる。

    Svelte の `recover` オプションと同様のアプローチ。
  ],
  [
    - 開発時は厳格にバグを発見できる
    - 本番では安定性を優先し、ユーザー体験を損なわない
    - 警告により問題の存在は把握できる
  ],
  alternatives: [
    1. *常に例外*: 本番で脆い
    2. *常にフォールバック*: 開発時に問題が隠れる
  ],
  references: (
    link(
      "https://github.com/sveltejs/svelte/blob/main/packages/svelte/src/internal/client/render.js",
    )[Svelte - render.js hydrate()],
  ),
)

#adr(
  header("Hydration 初期化順序", Status.Accepted, "2026-01-25"),
  [
    イベント復元と effect 接続をどの順序で行うかを決定する必要がある。

    検討すべき観点：
    - ユーザーインタラクションの即応性
    - 初期レンダリングの正確性
    - 競合条件の回避
  ],
  [
    *走査中に同時接続* を採用する。

    マーカーの走査と接続を分離せず、各ノードに対して effect とイベントを同時に接続する。

    ```typescript
    function hydrate(root: ShadowRoot) {
      const walker = document.createTreeWalker(root, NodeFilter.SHOW_COMMENT);
      while (walker.nextNode()) {
        const marker = walker.currentNode;
        // マーカーの種類に応じて effect とイベントを両方接続
        connectEffects(marker);
        connectEvents(marker);
      }
    }
    ```
  ],
  [
    - 順序問題を回避できる（イベント発火時に effect が未接続という状態が発生しない）
    - SolidJS・Svelte と同様のアプローチで実績あり
    - 実装がシンプル
  ],
  alternatives: [
    1. *イベント復元 → effect 接続*: イベント発火時に状態不整合が発生するリスク
    2. *effect 接続 → イベント復元*: 安全だがユーザー操作が無視される期間が生じる
    3. *イベントキューイング*: 実装が複雑、遅延実行による予期しない挙動のリスク
  ],
  references: (),
)

#adr(
  header("状態転送の範囲", Status.Accepted, "2026-01-27"),
  [
    SSR → CSR で何をどこまで転送するかを決定する必要がある。

    検討すべき観点：
    - 転送量（HTML サイズへの影響）
    - 再現性（完全に同じ状態になるか）
    - セキュリティ（何を露出するか）
  ],
  [
    *初期値のみ* を転送する。

    - Signal の初期値のみを転送
    - computed は CSR 側で再計算（軽量な処理が大半）
    - Signal ID は転送しない（DOM 位置から暗黙的に対応付け）

    将来的に重い computed のキャッシュが必要になった場合は、スナップショット方式をオプションとして v2 で検討する。
  ],
  [
    - 転送サイズを最小化できる
    - 実装がシンプル
    - ほとんどの computed は軽量で再計算コストが低い
    - 重い派生値がある場合は性能に影響する可能性
  ],
  alternatives: [
    ("なし（再実行のみ）", "初期値すら転送しない。最小だが、すべての状態を再構築する必要がある"),
    ("Signal ID + 初期値", "ID で明示的に対応付け。転送サイズ増加"),
    ("スナップショット", "computed 含む完全な状態。最大の転送サイズだが完全な再現性"),
  ],
  references: ("Hydration ADR", "Runtime 原語 ADR"),
)

#adr(
  header("状態転送の注入形式", Status.Accepted, "2026-01-27"),
  [
    転送された状態をどのようにクライアントに渡すかを決定する必要がある。

    検討すべき観点：
    - パースコスト
    - CSP 互換性
    - コード分割との相性
  ],
  [
    *`<script type="application/json">` を各 Web Component 内に配置* する。

    ```html
    <my-counter>
      <template shadowrootmode="open">
        <script type="application/json" data-dh-state>{"count": 5}</script>
        <button>Count: 5</button>
      </template>
    </my-counter>
    ```

    - `type="application/json"` はスクリプトとして実行されない（CSP 安全）
    - `data-dh-state` 属性で識別
    - 各 Web Component が自身の状態を持つ（責務分離）
    - Hydration 時に `<script>` 要素は削除される
  ],
  [
    - CSP（Content Security Policy）に準拠
    - グローバル汚染なし
    - 各 WC が独立して Hydrate 可能
    - パースは JSON.parse で高速
    - Shadow DOM 内に隠蔽されるため、Light DOM を汚染しない
  ],
  alternatives: [
    ("window.\_\_DATHOMIR\_STATE\_\_", "グローバル変数。シンプルだが汚染とスコープの問題あり"),
    ("グローバル `<script>`", "一箇所に集約。WC の独立性を損なう"),
    ("data 属性", "サイズ制限と複雑なデータの扱いが困難"),
  ],
  references: ("SSR マーカープロトコル Interface Spec", "Hydration Behavior Spec"),
)

#adr(
  header("状態転送のエスケープ規約", Status.Accepted, "2026-01-27"),
  [
    状態を文字列化・復元する際の XSS 対策を決定する必要がある。

    検討すべき観点：
    - セキュリティ（XSS 防止）
    - 対応型（文字列、数値、オブジェクト、循環参照）
    - 性能（シリアライズコスト）
  ],
  [
    *devalue ライブラリ* を使用する。

    ```javascript
    import { stringify, parse } from 'devalue';

    // SSR
    const html = `<script type="application/json">${stringify(state)}</script>`;

    // CSR
    const state = parse(jsonString);
    ```

    devalue の特徴：
    - XSS エスケープ済み（`</script>` などを安全にエンコード）
    - 循環参照対応
    - Date, RegExp, Map, Set, BigInt 対応
    - Svelte/SvelteKit での実績
    - ~1KB のサイズ
  ],
  [
    - セキュリティが実証済み（Svelte が採用）
    - 自前実装のリスクを回避
    - 豊富な型サポート
    - 外部依存が増える（ただし小さい）
    - *バンドルサイズの扱い*: devalue (~1KB) は SSR 用依存であり、Runtime 目標 (< 2KB) とは別枠。CSR のみの場合は不要。
  ],
  alternatives: [
    ("JSON.stringify + 手動エスケープ", "依存なしだが、エッジケースでの脆弱性リスク"),
    ("superjson", "~3KB と大きめ。tRPC で使用"),
    ("serialize-javascript", "関数対応だがセキュリティ注意が必要"),
  ],
  references: ("devalue: https://github.com/Rich-Harris/devalue",),
)

#adr(
  header("状態転送の信頼境界", Status.Accepted, "2026-01-27"),
  [
    サーバ生成データの取り扱いと改ざん耐性の要否を決定する必要がある。

    検討すべき観点：
    - セキュリティモデル
    - 署名/検証の必要性
    - 性能への影響
  ],
  [
    *サーバを信頼し、機密情報を状態に含めない* 方針を採用。

    セキュリティ原則：
    1. サーバが生成したデータは信頼する（署名/検証なし）
    2. 機密情報（パスワード、APIキー等）は状態に含めない
    3. 状態はすべてクライアントに露出する前提で設計

    開発者ガイドライン：
    - 認証後はセッショントークンを使用（状態に保存しない）
    - 機密データはサーバーサイドでのみ処理
    - 状態に含めるデータは「公開されても問題ない」ものに限定

    これは SvelteKit の `_` プレフィックスによる機密フィールド除外と同様のアプローチ。
  ],
  [
    - 実装がシンプル（署名/検証不要）
    - 性能への影響なし
    - 開発者に適切なセキュリティ意識を促す
    - 改ざんされても機密情報は漏洩しない設計
    - 改ざんによる不正動作は防げない（ただし、これは一般的なクライアント側の制約）
  ],
  alternatives: [
    ("署名付き状態", "改ざん検出可能だが、実装複雑化と性能低下"),
    ("完全検証", "すべての状態をサーバーで再検証。高コスト"),
  ],
  references: ("SvelteKit state management: https://svelte.dev/docs/kit/state-management",),
)

#adr(
  header("Transformer 出力形式", Status.Accepted, "2026-01-26"),
  [
    transformer が生成するコードの形式を決定する必要がある。

    検討すべき観点：
    - transformer の実装量
    - runtime の複雑性
    - 最適化の余地
    - 独自性と将来の拡張性
    - バンドルサイズ（目標 < 2KB）
  ],
  [
    *構造化配列方式* を採用する。

    Svelte 5 の `from_tree` アプローチを参考に、DOM 構造を配列で表現する。

    構造化配列の形式：
    - `[tag, attrs, ...children]`
    - `tag`: 要素名（文字列）
    - `attrs`: 属性オブジェクト（`null` の場合もある）
    - `children`: 文字列 または ネストした配列
    - 動的箇所は `\{text\}`, `\{insert\}` などのプレースホルダーで表現

    Transformer 出力例：
    - `fromTree([['button', \{ class: 'btn' \}, 'Count: ', ['\{text\}', null]]], 1)`
    - `firstChild(fragment)` でボタン要素を取得
    - `templateEffect(() => setText(text, count.value))` でリアクティブ更新
  ],
  [
    *利点*:
    - 型安全: TypeScript で構造を厳密に検証可能
    - 拡張性: Compiler が構造を完全に理解し、高度な最適化が可能
    - デバッグ容易性: 構造が明確で可視化しやすい
    - 独自性: Dathra の特徴として打ち出せる（先進的アプローチ）
    - Compiler 制御: 静的/動的の完全な分離、特殊化が容易

    *欠点*:
    - 実績が少ない: Svelte 5 では実験的機能
    - Runtime 実装: HTML パーサーではなく独自実装が必要
    - 初期パフォーマンス: ブラウザ最適化の恩恵を受けにくい可能性
  ],
  alternatives: [
    1. *HTML String 方式* (Svelte 5 デフォルト): `fromHtml()` 形式。ブラウザの HTML パーサーを活用し、実績あり（1-2KB 達成済み）。もし構造化配列方式でパフォーマンスや実装の問題が発生した場合の有力な代替案。
    2. *Template String 方式* (SolidJS 型): `template()` + 多数の runtime helpers。バンドルサイズ 6-7KB で目標を超過するため不採用。
  ],
  references: (
    link("https://svelte.dev/docs/svelte/svelte-compiler")[Svelte 5 - from_tree (experimental)],
  ),
)

#adr(
  header("IR の安定性方針", Status.Accepted, "2026-01-26"),
  [
    内部表現（IR）のバージョン管理方針を決定する必要がある。

    検討すべき観点：
    - 破壊的変更の頻度
    - ビルドキャッシュの互換性
    - 開発速度 vs 安定性
  ],
  [
    *内部専用（破壊変更 OK）* を採用する。

    - v1.0 までは IR（構造化配列形式）の破壊的変更を許容
    - `@dathra/transformer` と `@dathra/runtime` のバージョンを厳密に紐付け（peerDependencies）
    - ユーザーは手書きしない（Transformer が生成）ため、影響は限定的
  ],
  [
    - 開発速度を優先し、最適化を試行錯誤できる
    - 互換性負債を回避し、将来の改善余地を確保
    - v1.0 以降は semver で管理し、メジャーバージョンでのみ破壊変更
    - ビルドキャッシュは transformer と runtime のバージョン組み合わせで管理
  ],
  alternatives: [
    1. *初期から semver 管理*: 安定性は高いが、v1.0 前の最適化が制約される
  ],
  references: (),
)

#adr(
  header("Runtime 原語の最小セット", Status.Accepted, "2026-01-27"),
  [
    runtime が提供する基本操作（原語）の最小セットを決定する必要がある。

    検討すべき観点：
    - 構造化配列方式（`fromTree`）の実装要件
    - バンドルサイズ（目標 < 2KB）
    - SSR/CSR 両対応
    - Hydration 互換性
    - Cleanup 契約（Owner/Root ベース）との整合性
    - リスト差分の責務
  ],
  [
    *最小セット* を以下に定める。

    *DOM 生成*:
    - `fromTree(structure, flags)`: 構造化配列から DOM を生成
    - `firstChild(node, isText?)`: 最初の子ノードを取得
    - `nextSibling(node)`: 次の兄弟ノードを取得

    *DOM 操作*:
    - `setText(node, value)`: テキストノードの内容を設定
    - `setAttr(element, name, value)`: 属性を設定
    - `setProp(element, name, value)`: プロパティを設定
    - `spread(element, prevProps, nextProps)`: 複数属性を一括設定（差分更新対応）
    - `append(parent, child)`: 子ノードを追加
    - `insert(parent, child, anchor)`: 指定位置に挿入

    *リスト*:
    - `reconcile(parent, items, keyFn, createFn)`: keyed list の差分更新

    *リアクティビティ*:
    - `templateEffect(fn)`: テンプレート用 effect（再実行可能）
    - `createRoot(fn)`: cleanup スコープを作成し、dispose 関数を返す

    *イベント*:
    - `event(type, element, handler)`: イベントリスナーを追加

    合計: *14 関数*（推定 ~1.6KB、目標 2KB 以内）
  ],
  [
    - Cleanup 契約（Owner/Root ベース）のため `createRoot` を追加
    - リスト差分を Runtime に集約することで、出力コードを簡潔に保つ
    - `spread` を追加し、`\{...props\}` の差分更新をサポート
    - `fromTree` が中核となり、他は補助的な操作のみ
    - Compiler が複雑さを担当し、Runtime はシンプルに保つ
    - `templateEffect` は alien-signals の `effect` をラップし、バッチング制御を追加

    *バンドルサイズ推定*:
    - DOM 生成/操作: ~580B
    - spread: ~150B
    - reconcile: ~400B
    - templateEffect + createRoot: ~350B
    - event: ~50B
    - 合計: ~1.6KB（目標 2KB 以内、マージン ~400B）
  ],
  alternatives: [
    1. *reconcile を Compiler 展開*: 出力コードが肥大化し、重複が発生するため不採用
    2. *createRoot なし*: Cleanup 契約と整合しないため不採用
  ],
  references: (
    link("https://svelte.dev/docs/svelte/svelte-internal")[Svelte 5 - Internal runtime],
  ),
)

#adr(
  header("イベントシステム方針", Status.Accepted, "2026-01-26"),
  [
    イベントリスナーを直接付けるか、委譲するかを決定する必要がある。

    検討すべき観点：
    - 性能（イベント数が多い場合）
    - メモリ使用量
    - SSR 互換性
    - バンドルサイズ（目標 < 2KB）
  ],
  [
    *直付け（addEventListener）* を採用する。

    - `event(type, element, handler)` で要素に直接リスナーを追加
    - 委譲システムは実装しない（v1.0）
    - Hydration 時は関数参照を直接復元
  ],
  [
    - シンプルで実装コストが低い、バンドルサイズへの影響が最小
    - SSR 互換性が高い（Hydration で関数参照を復元するだけ）
    - Web Components パターンでは各コンポーネントが小規模のため、委譲の恩恵が少ない
    - バブリングしないイベント（focus, blur 等）も統一的に扱える
    - 委譲システムは 500B-1KB 必要で、目標 2KB に対して大きい
  ],
  alternatives: [
    1. *委譲（SolidJS 型）*: メモリ効率的だが、SSR で `$$click` プロパティの復元が必要。バンドルサイズ増加。
    2. *委譲（オプトイン）*: 柔軟だが実装が複雑。v2 で検討可能。
  ],
  references: (),
)

#adr(
  header("イベントハンドラ表現", Status.Accepted, "2026-01-26"),
  [
    ハンドラをどう表現するかを決定する必要がある。

    検討すべき観点：
    - SSR 互換性
    - Hydration の容易性
    - セキュリティ
    - イベントシステム方針（直付け）との整合性
  ],
  [
    *関数参照（直接）* を採用する。

    - CSR: `event('click', button, () => count.update(v => v + 1))` で関数を直接渡す
    - SSR → Hydration: マーカーと関数の紐付け情報を管理し、Hydration 時に復元
    - ID 参照は不要（委譲システムがないため）
  ],
  [
    - 直付けイベントシステムと整合性がある
    - シンプルで理解しやすい
    - SSR では Hydration マーカーと関数の対応関係を保持する必要がある
    - セキュリティ: 関数は Transformer が生成するコード内に埋め込まれる
  ],
  alternatives: [
    1. *ID 参照*: `event('click', button, 'handler_1')` 形式。委譲システムで有用だが、直付けでは不要な複雑性。
  ],
  references: (),
)

#adr(
  header("Cleanup 契約", Status.Accepted, "2026-01-27"),
  [
    effect / event / timer 等の解除責務とスコープ単位を決定する必要がある。

    検討すべき観点：
    - メモリリーク防止
    - コンポーネント境界との関係
    - API の明瞭性
    - バンドルサイズ
  ],
  [
    *Owner/Root ベース（SolidJS 型）* を採用する。

    - `createRoot(fn)` で cleanup スコープを作成
    - スコープ内の effect/event は自動的に追跡される
    - `createRoot()` は dispose 関数を返し、呼び出すと全て cleanup
    - Web Component の `disconnectedCallback` で dispose を呼ぶ

    実装イメージ：
    ```typescript
    class MyCounter extends HTMLElement \{
      #dispose;

      connectedCallback() \{
        this.#dispose = createRoot(() => \{
          // このスコープ内の effect/event は自動追跡
          templateEffect(() => setText(text, count.value));
          event('click', button, handler);
        \});
      \}

      disconnectedCallback() \{
        this.#dispose?.();
      \}
    \}
    ```
  ],
  [
    - effect/event の配列を手動管理する必要がない
    - SolidJS と同様のパターンで実績あり
    - 一つの `dispose()` 呼び出しで全て解決
    - ネストしたコンポーネントも自動的に追跡
    - `createRoot()` の実装が必要（約 200-300B のコード追加）
  ],
  alternatives: [
    1. *alien-signals 自動追跡 + 手動イベント管理*: バンドルサイズ最小だが、イベントリスナーの手動管理が必要
    2. *手動管理*: 完全な制御だが、忘れるとメモリリーク
    3. *WeakMap + FinalizationRegistry*: 自動だが cleanup タイミングが不確定
  ],
  references: (
    link("https://www.solidjs.com/docs/latest/api#createroot")[SolidJS - createRoot()],
  ),
)

#adr(
  header("コンポーネント境界の意味論", Status.Accepted, "2026-01-27"),
  [
    コンポーネントが cleanup スコープを持つかを決定する必要がある。

    検討すべき観点：
    - メモリ管理の単位
    - 再利用性
    - アンマウント時の挙動
    - Cleanup 契約との整合性
  ],
  [
    *cleanup スコープを持つ* を採用する。

    - 各 Web Component は `createRoot()` で独自の cleanup スコープを作成
    - `disconnectedCallback` で自動的に cleanup
    - コンポーネント内の全ての effect/event はスコープに紐付く
  ],
  [
    - メモリリーク防止が自動的
    - Web Components 標準のライフサイクルと統合
    - Cleanup 契約（Owner/Root ベース）と整合性がある
    - コンポーネント単位で完全に独立した管理が可能
  ],
  alternatives: [
    1. *cleanup スコープを持たない*: 手動管理が必要で、メモリリークのリスクが高い
  ],
  references: (),
)

#adr(
  header("Fragment/制御フローの境界表現", Status.Accepted, "2026-01-27"),
  [
    Fragment / if / each の境界をどう表現するかを決定する必要がある。

    検討すべき観点：
    - Hydration の容易性
    - 差分更新の効率
    - keyed list の要件
    - SSR マーカープロトコルとの整合性
  ],
  [
    *SSR マーカープロトコルに準拠* する。

    - `<!--dh:b:ID-->` ... `<!--/dh:b-->`: 制御フロー（if/each）の開始・終了
    - `<!--dh:i:ID-->`: 挿入点（0/1/複数ノード）
    - keyed list は `reconcile()` で管理し、key は要素の識別に使用

    *keyed list の表現*:
    - Compiler が `reconcile(parent, items, keyFn, createFn)` を生成
    - 各アイテムの key は `keyFn(item)` で取得
    - 新規/更新/削除は `reconcile` が差分計算して実行
  ],
  [
    - SSR マーカープロトコルと統一することで実装がシンプルに
    - コメント境界により、Hydration 時に制御フローの範囲を特定可能
    - `reconcile` がリスト差分を担当し、keyed/unkeyed を統一的に扱う
    - 制御フロー境界内のノードは動的に変化するため、コメントマーカーが適切
  ],
  alternatives: [
    1. *属性マーカー*: 動的に変化するノード群の境界を属性で表現するのは困難
    2. *マーカーなし*: Hydration 時に範囲を特定できなくなる
  ],
  references: (),
)

#adr(
  header("更新単位の責務分担", Status.Accepted, "2026-01-27"),
  [
    テキスト / 属性 / リスト差分の責務を runtime と transformer のどちらが持つかを決定する必要がある。

    検討すべき観点：
    - transformer の実装量
    - runtime のバンドルサイズ
    - 最適化の余地
    - 出力コードの簡潔さ
  ],
  [
    *Compiler-First 哲学* に基づき、以下の責務分担を採用する。

    *Compiler（Transformer）の責務*:
    - 静的/動的の分離と判定
    - 構造化配列（`fromTree` の引数）の生成
    - 最適化された更新コードの生成（`setText`, `setAttr` の呼び出し）
    - `reconcile` の呼び出しコード生成（keyed/unkeyed の判定を含む）

    *Runtime の責務*:
    - `fromTree()`: 構造化配列から DOM を生成
    - `setText()`, `setAttr()`, `setProp()`: 単純な更新操作
    - `reconcile()`: keyed list の差分計算と適用
    - `templateEffect()`: リアクティブな再実行
  ],
  [
    - Compiler が静的解析で最適化を行い、Runtime は単純な実行のみ
    - テキスト/属性の更新は Compiler が `templateEffect` 内に最適なコードを生成
    - リスト差分は Runtime の `reconcile` に集約し、出力コードの重複を防ぐ
    - `reconcile` を Runtime に持つことで ~400B 増加するが、出力コードが大幅に簡潔化
  ],
  alternatives: [
    1. *リスト差分も Compiler 展開*: 各リストに差分ロジックが埋め込まれ、出力コードが肥大化
    2. *全て Runtime*: Compiler の最適化の恩恵が受けられず、汎用コードが増える
  ],
  references: (),
)

#adr(
  header("Effect スケジューリング", Status.Accepted, "2026-01-26"),
  [
    effect の実行タイミングを決定する必要がある。

    検討すべき観点：
    - 更新の即時性 vs バッチング
    - 性能
    - alien-signals との整合性
  ],
  [
    *batched flush* を採用する。

    - alien-signals の `batch()` 関数を使用
    - `batch()` 内での複数の signal 更新は、終了時に一度だけ effect を実行
    - `templateEffect` は内部で `effect` をラップし、適切にバッチング
    - Transformer が自動的に適切な箇所で `batch()` を挿入（オプション）
    - ユーザーも手動で `batch()` を使用可能
  ],
  [
    - パフォーマンス効率的: 複数の signal 更新で何度も DOM 更新が走ることを防ぐ
    - alien-signals が標準サポートしているため、実装コストが低い
    - 明示的な制御が可能で、予測可能な挙動
    - SolidJS と同様のアプローチで実績あり
  ],
  alternatives: [
    1. *同期（即時）*: シンプルだが、パフォーマンスが低下する可能性
    2. *microtask（自動バッチング）*: 自動的だが、alien-signals がサポートしておらず、実装が複雑
  ],
  references: (
    link("https://github.com/stackblitz/alien-signals")[alien-signals - batch()],
  ),
)

#adr(
  header("公開 API の範囲", Status.Accepted, "2026-02-05"),
  [
    `memo` / `untrack` / `cleanup` 等を公開 API に含めるかを決定する必要がある。

    検討すべき観点：
    - 開発者体験
    - API サーフェスの大きさ
    - 互換性コスト
  ],
  [
    *最小限の API を v1.0 で公開* する。

    *v1.0 で公開*:
    - `signal(value)`: 基本的なリアクティブな値
    - `computed(fn)`: 派生値
    - `effect(fn)`: 副作用
    - `batch(fn)`: バッチ更新
    - `createRoot(fn)`: cleanup スコープ作成

    *v2 で検討*:
    - `untrack(fn)`: 使用頻度低い
    - `onCleanup(fn)`: createRoot で代替可能
    - `memo`: computed のエイリアス不要
  ],
  [
    - API サーフェスを小さく保ち、互換性コストを最小化
    - Web Components + リアクティビティに集中
    - 後から追加しても破壊的変更にならない
    - alien-signals の基本 API と整合性がある
  ],
  alternatives: [
    ("全て公開", "API サーフェスが大きくなり、互換性コストが増大"),
    ("signal/computed のみ", "batch や createRoot がないと実用性が低い"),
  ],
  references: (
    link("https://github.com/stackblitz/alien-signals")[alien-signals API],
    link("https://www.solidjs.com/docs/latest/api")[SolidJS API],
  ),
)

#adr(
  header("値読み取りの規約", Status.Accepted, "2026-02-05"),
  [
    Signal の値を `.value` で読むか、アクセサ関数も許容するかを決定する必要がある。

    検討すべき観点：
    - TC39 Signals 仕様との整合性
    - 開発者体験
    - 型安全性
  ],
  [
    *`.value` 固定（TC39 準拠）* を採用する。

    ```javascript
    // ✅ 許可: 読み取り
    const value = signal.value;
    const derived = computed.value;

    // ✅ 許可: 書き込み（メソッド経由）
    signal.set(newValue);
    signal.update(prev => prev + 1);

    // ❌ 不許可: .value への直接代入
    signal.value = newValue;  // TypeScript エラー (readonly)

    // ❌ 不許可: 関数呼び出し形式
    const value = signal();
    signal(newValue);
    ```
  ],
  [
    - TC39 Signals 仕様との整合性
    - alien-signals がデフォルトで `.value` を推奨
    - Dathra の独自性として *TC39 準拠* を打ち出す
    - 型安全性が高い（getter/setter として明確）
    - Vue 3 Composition API とも整合性がある
  ],
  alternatives: [
    ("アクセサ関数も許容", "柔軟だが、どちらを使うか迷いが生じる。SolidJS 型"),
    ("関数呼び出しのみ", "TC39 仕様から逸脱し、独自性を失う"),
  ],
  references: (
    link("https://github.com/tc39/proposal-signals")[TC39 Signals Proposal],
  ),
)

#adr(
  header("SSR 対象の範囲", Status.Accepted, "2026-02-05"),
  [
    文字列 SSR のみか、サーバ DOM 生成も視野に入れるかを決定する必要がある。

    検討すべき観点：
    - 実装複雑性
    - Edge 環境での動作
    - 性能
  ],
  [
    *環境別の出力最適化* を採用する。

    | 環境 | 出力形式 |
    |------|----------|
    | `client` | ブラウザ用 JS |
    | `ssr` | Node.js 互換 SSR（文字列生成） |
    | `edge` | Edge Runtime 用 SSR（Web 標準 API のみ） |

    *v1.0*: 文字列 SSR のみ実装
    - 構造化配列 → HTML 文字列生成
    - Web 標準 API のみ使用
    - Node.js API は使わない（`edge` 環境対応）

    *v2*: サーバ DOM 生成を検討
    - jsdom, happy-dom, linkedom 等
    - パフォーマンステストの結果次第
  ],
  [
    - Edge 環境（Cloudflare Workers, Deno Deploy）で動作
    - 文字列 SSR で十分な性能とシンプルさを実現
    - Svelte が文字列ベース SSR で成功している実績
    - Vite Environment API で環境別に最適化可能
  ],
  alternatives: [
    ("サーバ DOM 生成", "実装複雑化、Edge 環境で制約。v2 で検討"),
    ("Node.js 専用 SSR", "Edge 環境で動作しない。現代的でない"),
  ],
  references: (
    link("https://vitejs.dev/guide/api-environment.html")[Vite Environment API],
  ),
)

#adr(
  header("Edge 環境の制約", Status.Accepted, "2026-02-05"),
  [
    Node 依存ゼロをいつから前提にするかを決定する必要がある。

    検討すべき観点：
    - 対応環境の広さ
    - 実装の制約
    - タイムライン
  ],
  [
    *v1.0 から Node.js 依存ゼロ*、Environment API で `edge` 環境を明示的にサポートする。

    *実装指針*:
    - Node.js 固有 API を使わない（`fs`, `path`, `Buffer` 等）
    - Web 標準 API のみ使用（Fetch, URL, TextEncoder, TextDecoder 等）
    - Vite の `edge` 環境で専用最適化

    ```javascript
    // vite.config.js
    export default \{
      environments: \{
        edge: \{
          resolve: \{
            conditions: ['edge', 'worker']
          \}
        \}
      \}
    \}
    ```
  ],
  [
    - 現代的なフレームワークの要件（Cloudflare Workers, Vercel Edge, Deno Deploy）
    - 後から対応すると破壊的変更が必要
    - Web 標準 API で十分実装可能
    - Vite Environment API により環境別の条件分岐が可能
  ],
  alternatives: [
    ("段階的移行", "v1 で Node.js 依存があると、後で破壊的変更が必要"),
    ("Node.js 専用", "Edge 環境で動作せず、モダンでない"),
  ],
  references: (
    link("https://workers.cloudflare.com/")[Cloudflare Workers],
    link("https://deno.com/deploy")[Deno Deploy],
  ),
)

#adr(
  header("Web Components 属性/プロパティのリフレクション", Status.Superseded, "2026-02-05"),
  [
    属性とプロパティの同期方法を決定する必要がある。

    検討すべき観点：
    - Web Components 標準との整合性
    - リアクティビティとの統合
    - 性能
  ],
  [
    *手動リフレクション*（v1.0 では自動サポートなし）を採用する。

    - Web Components 標準の `observedAttributes` + `attributeChangedCallback` を使用
    - Dathra は自動リフレクションを提供しない
    - ユーザーが必要に応じて `setAttr` / `setProp` で手動管理

    ```javascript
    class MyElement extends HTMLElement \{
      static observedAttributes = ['count'];
      #count = signal(0);

      attributeChangedCallback(name, oldValue, newValue) \{
        if (name === 'count') \{
          this.#count.set(Number(newValue));
        \}
      \}

      set count(value) \{
        this.#count.set(value);
        this.setAttribute('count', value);
      \}
    \}
    ```
  ],
  [
    - 属性↔プロパティの自動同期は複雑で、実装コストが高い
    - Web Components 標準の仕組みで十分
    - バンドルサイズへの影響を最小化
    - ユーザーが必要な箇所だけ実装できる柔軟性
  ],
  alternatives: [
    ("自動リフレクション", "実装複雑、バンドルサイズ増加、すべての WC で必要とは限らない"),
    ("デコレータベース", "Stage 3 Decorators の安定化待ち、v2 で検討可能"),
  ],
  references: (
    link("https://developer.mozilla.org/en-US/docs/Web/API/Web_components")[Web Components - MDN],
  ),
)

#adr(
  header("診断情報の詳細度", Status.Accepted, "2026-02-05"),
  [
    ミスマッチ時にどこまで情報を出すかを決定する必要がある。

    検討すべき観点：
    - デバッグ容易性
    - 本番環境での情報漏洩
    - バンドルサイズ
  ],
  [
    *開発環境でのみ詳細情報* を出力する。

    | 情報 | 開発 (`__DEV__`) | 本番 |
    |------|------------------|------|
    | Hydration ミスマッチ位置 | ✅ | ❌ |
    | 期待値 vs 実際値 | ✅ | ❌ |
    | マーカー ID | ✅ | ❌ |
    | スタックトレース | ✅ | ❌ |
    | 警告メッセージ | ✅ | ✅ (簡易) |

    ```javascript
    if (__DEV__) \{
      console.error(`Hydration mismatch at <!--dh:t:$\{id\}-->`, \{
        expected: expectedText,
        actual: actualText,
        element: node.parentElement
      \});
    \} else \{
      console.warn('Hydration mismatch detected');
    \}
    ```
  ],
  [
    - 開発時のデバッグ効率を最大化
    - 本番では詳細情報を除外してバンドルサイズを削減
    - `__DEV__` フラグで分岐し、本番ビルド時に dead code elimination
    - Svelte, Vue と同様のアプローチで実績あり
  ],
  alternatives: [
    ("常に詳細情報", "バンドルサイズ増加、本番で不要な情報が露出"),
    ("常に簡易情報", "開発時のデバッグが困難"),
  ],
  references: (),
)

#adr(
  header("SSR モード伝播", Status.Accepted, "2026-02-05"),
  [
    plugin / transformer に SSR モードフラグをどう渡すかを決定する必要がある。

    検討すべき観点：
    - ビルドツールとの統合
    - 環境変数 vs 設定ファイル
    - 誤設定の防止
  ],
  [
    *Vite Environment API を優先* し、後方互換を確保する。

    *優先順位*:
    1. *Environment API* (`environment.name`) - Vite 6+
    2. `options.ssr` - Vite 5 後方互換
    3. `import.meta.env.SSR` - 最終フォールバック

    ```javascript
    // Plugin 実装
    export function dathra() \{
      return \{
        name: 'dathra',
        transform(code, id, options) \{
          const environment = options?.environment || this.environment;

          // Environment API で環境判定（優先）
          const envName = environment?.name
            || (options?.ssr ? 'ssr' : 'client');

          const isSSR = envName === 'ssr' || envName === 'edge';

          return isSSR
            ? transformSSR(code, envName)
            : transformClient(code);
        \}
      \}
    \}
    ```
  ],
  [
    - Vite 6+ の新標準（Environment API）に準拠
    - 複数環境（`client`, `ssr`, `edge`, `worker`）に柔軟に対応
    - Vite 5 での動作も保証（後方互換）
    - 環境名を Transformer に渡すことで、環境別最適化が可能
    - ビルドツールから明示的に伝播されるため、誤設定が少ない
  ],
  alternatives: [
    ("環境変数のみ", "ビルドツールとの統合が弱く、誤設定のリスク"),
    ("設定ファイル", "ユーザーが手動設定する必要があり、煩雑"),
  ],
  references: (
    link("https://vitejs.dev/guide/api-environment.html")[Vite Environment API],
  ),
)

#adr(
  header("Web Components 高レベル API 方式", Status.Accepted, "2026-02-09"),
  [
    Web Components を定義するための高レベル API の形式を決定する必要がある。
    ユーザーが書くボイラープレートを最小化しつつ、Compiler-First 哲学に合致し、
    バンドルサイズへの影響を最小限に抑える方式を選択する。

    検討すべき観点：
    - Transformer 出力との親和性
    - バンドルサイズ（~500B 追加まで）
    - Shadow DOM / Hydration / cleanup の自動化
    - 属性リフレクションの DX
  ],
  [
    *`defineComponent` 関数方式* を採用する。

    - `defineComponent(tagName, setup, options?)` で Web Component を定義・登録
    - 内部で `HTMLElement` サブクラスを自動生成
    - `connectedCallback` で `createRoot` → `setup` → `shadowRoot.append`
    - `disconnectedCallback` で `dispose()` による自動 cleanup
    - `options.props` で型付き Props システムを提供（`options.attrs` を置換）
    - `options.styles` で `adoptedStyleSheets` 自動適用
    - `options.hydrate` で DSD 検出 + Hydration パス分岐
    - `css` タグテンプレートで `CSSStyleSheet` を簡潔に作成
  ],
  [
    - Transformer が `setup` 内の JSX を変換するだけで動作（既存変換パイプラインと整合）
    - クラス構文不要で出力コードが簡潔
    - 推定 ~600B（props + css ヘルパー含む）で目標 2KB 以内
    - DSD 検出は `this.shadowRoot` の存在チェックのみで軽量
    - 再接続時の状態リセットはシンプルだが、永続化は外部スコープで対応可能
  ],
  alternatives: [
    1. *クラスデコレータ方式*: Stage 3 Decorators 依存。バンドルサイズ増加。v2 で検討可能。
    2. *`DathraElement` 基底クラス*: クラス継承が冗長。Transformer 出力として不適。
    3. *マクロ方式*: Transformer でコンパイル時に完全展開。柔軟だが実装コストが高い。
  ],
  references: (
    link("https://lit.dev/docs/")[Lit - Web Components library],
    link("https://stenciljs.com/docs/introduction")[Stencil - Web Components compiler],
  ),
)

#adr(
  header("Props ベース API 設計", Status.Accepted, "2026-02-10"),
  [
    `defineComponent` の外部インターフェース（属性/プロパティ）の定義方法を決定する必要がある。
    現行の `attrs: readonly string[]` は型情報を持たず、すべて `Signal<string | null>` として
    扱われるため、数値やブール値の変換がユーザー責任となり DX が悪い。

    また、TSX で custom element を使用する際に型補完が効かない問題がある。

    検討すべき観点：
    - TypeScript の型推論との統合
    - HTML attribute（string のみ）と JS property（任意型）の二重性
    - Signal ベースのリアクティビティとの統合
    - バンドルサイズへの影響
    - JSX/TSX での型補完

    本 ADR は「Web Components 属性/プロパティのリフレクション」(2026-02-05) を Supersede する。
  ],
  [
    *`options.props` による型付き Props スキーマ* を採用する。

    *API 設計*:
    ```typescript
    // Props 定義
    defineComponent('my-counter', (host, \{ props \}) => \{
      // props.count: Computed<number> — 型推論で自動決定
      return <button>\{props.count.value\}</button>;
    \}, \{
      props: \{
        count: \{ type: Number, default: 0 \},
        label: \{ type: String, default: 'Count' \},
        active: \{ type: Boolean, default: false \},
      \},
    \});
    ```

    *設計原則*:
    1. `type` フィールド（`String` / `Number` / `Boolean` / カスタム関数）で
      ランタイム型変換と TypeScript 型推論を同時に実現
    2. `default` で初期値を提供（属性未設定時に使用）
    3. `attribute` で属性名マッピングをカスタマイズ（`false` で属性観測をスキップ）
    4. Props は `Computed<T>` として `ctx.props` から公開（読み取り専用）
    5. 要素に property getter/setter を自動定義（JS からの直接アクセス対応）
    6. `const S extends PropsSchema` ジェネリクスで `type` のリテラル型を保持し、正確な推論を実現

    *属性→値の型変換規則*:
    | `type` | 属性値 → プロパティ値 |
    |--------|------------------------|
    | `String` | `attrValue`（そのまま） |
    | `Number` | `Number(attrValue)` |
    | `Boolean` | `attrValue !== null`（存在 = true、不在 = false） |
    | カスタム関数 | `fn(attrValue)` |

    *属性削除時*（`attrValue === null`）:
    - `Boolean`: `false`
    - `String` / `Number` / カスタム: `default` 値にフォールバック

    *属性名マッピング*:
    - デフォルト: camelCase → kebab-case（`initialCount` → `initial-count`）
    - カスタム: `attribute: 'data-count'` で明示指定
    - 無効化: `attribute: false` で属性観測をスキップ（プロパティ専用）
  ],
  [
    *利点*:
    - `type` フィールドがランタイム変換と TypeScript 推論の二重の役割を果たし、定義が DRY
    - ユーザーが手動で `Number(attrValue)` 等を書く必要がない
    - `Computed<T>` 公開によりコンポーネント内部での不正な `.set()` を防止
    - `const` type parameter により `StringConstructor` / `NumberConstructor` がリテラル保持
    - property getter/setter によりバニラ JS からも型付きアクセスが可能
    - Lit / Stencil の開発者に馴染みのあるパターン

    *トレードオフ*:
    - Props システムのランタイムコストが ~200B 増加（型変換 + getter/setter 定義）
    - プロパティ → 属性の自動反映は行わない（明示的な片方向のみ）
    - `Computed<T>` の `__type__` が `"computed"` となり、概念上は "prop" とのギャップがある
      （v2 で `PropSignal<T>` を検討可能）
  ],
  alternatives: [
    1. *TypeScript ジェネリクスのみ*: `defineComponent<\{ count: number \}>(...)` 形式。型安全だがランタイム型変換情報がなく、属性からの number/boolean 変換ができない。
    2. *Vue 3 型の PropType システム*: `\{ type: [Number, String] \}` のような union 型サポート。実装が複雑で v1.0 のスコープを超える。
    3. *デコレータベース*: `@Prop() count = 0` 形式。Stage 3 Decorators 依存。v2 で検討可能。
    4. *手動リフレクション維持*: 前回の決定。DX が悪く、型安全性が低い。
  ],
  references: (
    link("https://lit.dev/docs/components/properties/")[Lit - Reactive Properties],
    link("https://stenciljs.com/docs/properties")[Stencil - Props],
    link(
      "https://developer.mozilla.org/en-US/docs/Web/API/Web_components/Using_custom_elements",
    )[MDN - Custom Elements],
  ),
)

#adr(
  header("JSX 型ヘルパー設計", Status.Accepted, "2026-02-10"),
  [
    `defineComponent` で作成した custom element を TSX で使用する際に、型補完を効かせる方法を
    決定する必要がある。

    検討すべき観点：
    - TypeScript の module augmentation の制約
    - 開発者体験（ボイラープレートの少なさ）
    - 既存の `IntrinsicElements` catch-all との共存
    - Transformer による自動生成の可能性
  ],
  [
    *`ComponentElement<C>` 型ヘルパー + `interface` ベースの `IntrinsicElements`* を採用する。

    *Step 1*: `JSX.IntrinsicElements` を `type` から `interface` に変更
    ```typescript
    // Before (type — 拡張不可)
    export type IntrinsicElements = RuntimeJSX.IntrinsicElements & \{
      [K: `$\{string\}-$\{string\}`]: Record<string, unknown>;
    \};

    // After (interface — module augmentation 可能)
    export interface IntrinsicElements extends RuntimeJSX.IntrinsicElements \{
      [K: `$\{string\}-$\{string\}`]: Record<string, unknown>;
    \}
    ```

    *Step 2*: `ComponentElement<C>` 型ヘルパーを提供
    ```typescript
    type ComponentElement<C> =
      C extends \{ __propsSchema__?: infer S \} ?
        (S extends PropsSchema ? \{
          [K in keyof S]?: InferPropType<S[K]>;
        \} & \{ children?: unknown \} : Record<string, unknown>) :
        Record<string, unknown>;
    ```

    *Step 3*: ユーザーが module augmentation で登録
    ```typescript
    declare module '@dathra/core/jsx-runtime' \{
      namespace JSX \{
        interface IntrinsicElements \{
          'my-counter': ComponentElement<typeof Counter>;
        \}
      \}
    \}
    ```

    interface の specific key は pattern index signature より優先されるため、
    登録されたカスタム要素は正確な型でチェックされ、未登録要素は catch-all が適用される。
  ],
  [
    *利点*:
    - TypeScript 標準の module augmentation パターンを使用（特殊な仕組み不要）
    - `ComponentElement<typeof Counter>` の1行で Props 型を自動抽出
    - 登録済み要素はタイポを検出可能（catch-all ではなく specific type が優先）
    - 未登録のカスタム要素は従来通り `Record<string, unknown>` で許容

    *トレードオフ*:
    - ユーザーが `declare module` を書く必要がある（1ファイルにまとめれば軽微）
    - Transformer による自動生成は v2 で検討
    - `IntrinsicElements` を `type` → `interface` に変更する破壊的変更（後方互換不要なので問題なし）
  ],
  alternatives: [
    1. *Transformer 自動生成*: `.d.ts` ファイルを自動生成。DX は最高だが Transformer の実装コストが高い。v2 で検討。
    2. *グローバル型宣言*: `declare global \{ namespace JSX \}` 形式。複数 JSX ライブラリとの衝突リスク。
    3. *型 registry パターン*: 中央の registry interface に登録。module augmentation の方がシンプル。
  ],
  references: (
    link("https://www.typescriptlang.org/docs/handbook/declaration-merging.html")[TypeScript - Declaration Merging],
    link("https://lit.dev/docs/frameworks/react/#typed-jsx")[Lit - Typed JSX],
  ),
)
