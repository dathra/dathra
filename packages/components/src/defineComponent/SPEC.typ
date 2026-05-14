#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

= defineComponent

== インターフェース仕様

#interface_spec(
  name: "defineComponent API",
  summary: [
    Web Components を宣言的に定義するための高レベル API。Shadow DOM のセットアップ、`createRoot` ライフサイクル管理、Declarative Shadow DOM（DSD）のハイドレーション検出、`adoptedStyleSheets`、属性のリアクティブシグナル反映を自動化する。
  ],
  format: [
    *公開関数*:
    ```typescript
    function defineComponent<const S extends PropsSchema = {}>(
      tagName: string,
      component: FunctionComponent<S>,
      options?: ComponentOptions<S>,
    ): DefinedComponent<S>

    function bindStoreToHost(host: HTMLElement, store: AtomStore): void
    ```

    *主要型*:
    ```typescript
    type PropType =
      | StringConstructor
      | NumberConstructor
      | BooleanConstructor
      | ((value: string | null) => unknown);

    interface PropDefinition {
      type: PropType;
      default?: unknown;
      attribute?: string | false;
    }

    type PropsSchema = Record<string, PropDefinition>;

    type InferPropType<D extends PropDefinition> =
      D extends { type: StringConstructor } ? string :
      D extends { type: NumberConstructor } ? number :
      D extends { type: BooleanConstructor } ? boolean :
      D extends { type: (v: string | null) => infer R } ? R :
      unknown;

    type InferProps<S extends PropsSchema> = {
      readonly [K in keyof S]: Signal<InferPropType<S[K]>>;
    };

    type FunctionComponent<S extends PropsSchema = PropsSchema> = (
      ctx: ComponentContext<S>,
    ) => Node | DocumentFragment | string;

    interface ComponentContext<S extends PropsSchema = PropsSchema> {
      readonly host: HTMLElement;
      readonly props: Readonly<InferProps<S>>;
      readonly client: ComponentClientContext;
      readonly store: AtomStore;
    }

    interface ComponentClientContext {
      readonly strategy: "load" | "visible" | "idle" | "interaction" | "media" | null;
      readonly value: string | null;
      readonly hydrated: boolean;
    }

    interface ComponentOptions<S extends PropsSchema = PropsSchema> {
      styles?: readonly (CSSStyleSheet | string)[];
      props?: S;
      hydrate?: HydrateSetupFunction<S>;
    }

    type ComponentConstructor<S extends PropsSchema = PropsSchema> = {
      new(): HTMLElement & { [K in keyof S]: InferPropType<S[K]> };
      readonly prototype: HTMLElement;
    } & ComponentClass<S>;

    interface ComponentMetadata<S extends PropsSchema = PropsSchema> {
      readonly __tagName__: string;
      readonly __propsSchema__?: S;
    }

    interface ComponentClass<S extends PropsSchema = PropsSchema> extends Function, ComponentMetadata<S> {}

    type JSXPropValue<T> = T | { readonly value: T };

    type JSXComponentProps<S extends PropsSchema = PropsSchema> = {
      readonly [K in keyof S]?: JSXPropValue<InferPropType<S[K]>>;
    } & {
      readonly children?: unknown;
      readonly "client:load"?: true | "";
      readonly "client:visible"?: true | "";
      readonly "client:idle"?: true | "";
      readonly "client:interaction"?: true | "" | string;
      readonly "client:media"?: string;
    };

    type JSXComponent<S extends PropsSchema = PropsSchema> = (
      props: JSXComponentProps<S> | null,
    ) => Node;

    interface DefinedComponent<S extends PropsSchema = PropsSchema>
      extends ComponentMetadata<S> {
      (props: JSXComponentProps<S> | null): Node;
      readonly webComponent: ComponentConstructor<S>;
      readonly jsx: JSXComponent<S>;
    }

    type ComponentElement<C> =
      C extends ComponentMetadata<infer S>
        ? JSXComponentProps<S>
        : Record<string, unknown>;

    type HydrateSetupFunction<S extends PropsSchema = PropsSchema> = (
      ctx: ComponentContext<S>,
    ) => void;
    ```
  ],
  constraints: [
    - `tagName` は custom element 規約に従いハイフンを含む
    - `component` は `host` / `props` / `client` / `store` を持つ単一 context object を受け取る関数コンポーネントである
    - 返り値は callable な `DefinedComponent` であり、`<Counter />` のように JSX 関数コンポーネントとして使える
    - `DefinedComponent.webComponent` は CSR では登録済み `HTMLElement` クラス、SSR では `__tagName__` / `__propsSchema__` を持つプレースホルダークラスを返す
    - JSX helper props 型は compiler-reserved な `client:*` directive を受け入れて transform 入力との型整合を保つが、JSX helper runtime 自体はそれらを DOM へ書き出さない
    - JSX helper runtime は compiler-generated internal client strategy metadata がある場合、host へ `data-dh-island` / `data-dh-island-value` を自動付与できる
    - コンストラクタで props シグナルを型変換付きで初期化し、各 prop に JS property getter / setter を定義する
    - CSR の custom element constructor では current store boundary を host に捕捉する
    - JSX runtime が生成した subtree 内の custom element に対しても current store boundary が伝播する
    - `attribute: false` の prop は属性監視せず、property setter 経由でのみ更新する
    - `connectedCallback` では host に bind 済みの store を解決し、`createRoot` スコープ内で関数コンポーネントを実行する
    - 関数コンポーネントが `string` を返す場合、`defineComponent` は文字列を text node として扱わず、runtime の DOM 構築 API へ委譲して Shadow DOM に挿入する。返す文字列は **信頼できるソースからのみ渡すこと** — `innerHTML` 経由でパースされるため、平文テキストを表示したい場合は `Document` または `Text` node を返すこと
    - `connectedCallback` と `hydrate` へ渡す context には、host の island metadata を正規化した read-only `client` context を含める。`interaction` strategy で `data-dh-island-value` が欠ける場合は canonical default `click` を補完する
    - `connectedCallback` では local `styles` と `adoptGlobalStyles()` で登録済みの global style を合成し、`adoptedStyleSheets` へ反映する
    - host-level `data-dh-island*` metadata はその custom element host の hydration boundary を定義し、同じ host setup が生成した subtree 全体は strategy 発火までその boundary に従う
    - DSD が存在し、user-defined `hydrate` または compiler-generated generic setup hydration plan がある場合は既存 Shadow DOM を破壊せず hydrate パスへ入る
    - DSD が存在し、user-defined `hydrate` も compiler-generated hydration plan もない場合だけ shadowRoot をクリアして再実行する fallback を許可する
    - DSD と `hydrate` があり、host が runtime が認識する `data-dh-island` metadata（`load` / `visible` / `idle` / `interaction` / `media`）を持つ場合は `connectedCallback` で即 hydrate せず、runtime `hydrateIslands()` が呼ぶ internal hook を host に公開して遅延 hydrate する
    - compiler-generated hydration plan により hydrate される host も、`data-dh-island*` metadata を持つ場合は runtime scheduler の strategy 発火まで in-place hydration を遅延できる
    - deferred host boundary の内側にある通常の DOM 要素や plain component subtree は、host boundary が hydrate されるまで inert な SSR markup として扱う
    - descendant custom element host 自体が独立した `data-dh-island*` metadata を持つ場合だけ、outer host とは別の explicit nested boundary 候補として扱える
    - compiler-generated colocated client handler を持つ component は render ベースの setup だけでなく compiler-generated hydration plan path でも interaction replay を維持し、`interaction` では初回 event 後に target marker へ event replay する
    - compiler-generated colocated client marker は native element 単位の sub-island を作らず、nearest component host boundary へ集約される
    - DSD に SSR `<style>` が存在し、CSR で `adoptedStyleSheets` を適用する場合は `<style>` を除去して重複適用を避ける
    - `disconnectedCallback` では `dispose` により cleanup を実行する
    - SSR では `getCssText()`、`registerComponent()`、`ensureComponentRenderer()` を用いて SSR 情報を登録する
    - browser implementation path へ入る条件は `window` 単独ではなく、`document` / `HTMLElement` / `customElements` の capability で判定する
    - 属性から Signal への型変換は `String` / `Number` / `Boolean` / カスタム関数の規則に従い、初期化時と属性変更時で同じ coercion 規則を使う。`Number` では `null` を `Number(null)` にせずデフォルト値へフォールバックする
    - `bindStoreToHost()` は SSR markup の client entry など、store boundary を public API 経由で host に紐付けるために公開する
  ],
)

== 設計判断

#adr(
  header("createRoot による cleanup スコープ", Status.Accepted, "2026-03-09"),
  [
    Web Component のライフサイクルに effect cleanup を統合し、メモリリークを防ぐ必要がある。
  ],
  [
    `connectedCallback` 内で `createRoot` を使い、`disconnectedCallback` で `dispose` する。
  ],
  [
    - effect の自動クリーンアップが保証される
    - reactivity パッケージの Owner/Root パターンと一貫する
  ],
)

#adr(
  header("DSD ハイドレーション検出", Status.Accepted, "2026-03-09"),
  [
    SSR で生成済みの Declarative Shadow DOM を検出し、hydrate パスへ分岐する必要がある。
  ],
  [
    `shadowRoot.childNodes.length > 0` で DSD の存在を判定する。
  ],
  [
    - DSD 対応ブラウザでは ShadowRoot に既存コンテンツが入る
    - `hydrate` オプションがある場合のみハイドレーションモードになる
  ],
)

#adr(
  header("islands metadata を持つ host の hydrate は runtime scheduler に委譲する", Status.Accepted, "2026-03-16"),
  [
    Phase 0 / Pillar 2 では component 自体の hydrate 実装は維持しつつ、`client:*` directive 由来 metadata に応じて hydration のタイミングだけを遅延制御する必要がある。
  ],
  [
    runtime が認識する `data-dh-island` metadata を持つ host は `connectedCallback` で即 hydrate せず、runtime `hydrateIslands()` が呼ぶ internal hook を instance 上へ登録して strategy 発火時に hydrate する。未知の値は island とみなさず通常 hydrate にフォールバックする。
  ],
  [
    - Web Component 自身が ShadowRoot hydration の責務を持つ ADR と両立できる
    - scheduler 実装を runtime 側へ閉じ込められる
    - island でない component の既存 hydrate/setup フローを壊さない
  ],
)

#adr(
  header("SSR 環境の判定", Status.Accepted, "2026-03-09"),
  [
    SSR では DOM 操作を避け、registry 登録のみ行う必要がある。
  ],
  [
    `typeof window === "undefined"` で SSR を判定する。
  ],
  [
    - Node.js / Edge ランタイムで機能する
    - SSR ではプレースホルダークラス返却で十分になる
  ],
)

#adr(
  header("browser 実装 path は custom element capability で判定する", Status.Accepted, "2026-04-23"),
  [
    `defineComponent` が実際に必要とするのは server かどうかそのものではなく、browser custom element 実装を安全に有効化できるかどうかである。`window` だけを見ると shim / partial DOM / test runtime で誤判定しやすい。
  ],
  [
    `defineComponent` と JSX helper の runtime branch は `document` / `HTMLElement` / `customElements` を満たすときだけ browser implementation path に入る。満たさない場合は SSR registration / placeholder path を使う。
  ],
  [
    - `window` 単独より意図に近い capability probe になる
    - partial DOM runtime で unsafe な custom element path を避けられる
    - SSR registration と JSX helper の branch 条件を揃えやすい
  ],
)

#adr(
  header("JSX helper は define-time の runtime decision に固定する", Status.Accepted, "2026-04-29"),
  [
    capability が非同期 polyfill などで後から変化すると、`defineComponent` が SSR registration / placeholder path を選んだ後に JSX helper だけが browser path へ切り替わる可能性がある。その場合、custom element が登録されていない tag の `HTMLElement` を生成し、upgrade / lifecycle / hydration が実行されない。
  ],
  [
    JSX helper は `defineComponent` 呼び出し時に決定した runtime decision を保持し、呼び出しごとに capability を再判定しない。browser path を選んだ definition は browser JSX element を生成し、server path を選んだ definition は capability が後から増えても DSD 文字列を返す。
  ],
  [
    - `defineComponent` と JSX helper の runtime path が常に一致する
    - 後から追加された partial DOM / customElements polyfill による未登録 custom element 生成を避けられる
    - runtime capability が変わる環境では、必要な polyfill を読み込んだ後に `defineComponent` を呼ぶ責務が明確になる
  ],
)

#adr(
  header("adoptedStyleSheets パターン", Status.Accepted, "2026-03-09"),
  [
    Shadow DOM へのスタイル適用をメモリ効率よく行い、DSD の `<style>` とも整合させる必要がある。
  ],
  [
    CSS はコンストラクタ内で `adoptedStyleSheets` に適用する。
  ],
  [
    - `<style>` タグより共有効率が良い
    - DSD ハイドレーション時は SSR の `<style>` を置き換えられる
  ],
)

#adr(
  header("global style は component local style より前に合成する", Status.Accepted, "2026-03-15"),
  [
    design token / typography / reset のような global style は複数 component で共有したいが、component 固有 style で上書きできる余地も残す必要がある。
  ],
  [
    `defineComponent` は `adoptGlobalStyles()` で登録済みの global style を local `styles` より前に `adoptedStyleSheets` へ並べる。重複する style は 1 回だけ採用する。
  ],
  [
    - shared style の優先順位が安定する
    - component 固有 style は後段で override しやすい
    - local/global の同一 style 重複を避けられる
  ],
)

#adr(
  header("Props シグナルの即時初期化と型変換", Status.Accepted, "2026-03-09"),
  [
    `connectedCallback` 前に属性が設定される可能性があり、props へのアクセスを早期に可能にする必要がある。
  ],
  [
    コンストラクタで全 props のシグナルを型変換付きで作成し、`attributeChangedCallback` で型変換後に更新する。
  ],
  [
    - setup から即座に props へアクセスできる
    - property setter と attributeChangedCallback の更新経路を一元化できる
  ],
)

#adr(
  header("attrs から props への移行", Status.Accepted, "2026-03-09"),
  [
    文字列配列の `attrs` だけでは型情報が失われ、TypeScript との統合が弱い。
  ],
  [
    `ComponentOptions.attrs` を廃止し、`ComponentOptions.props: PropsSchema` に置き換える。
  ],
  [
    - ランタイム変換と型推論を同時に扱える
    - JS property と HTML attribute の両方を統一的に扱える
  ],
)

#adr(
  header("属性→プロパティの一方向同期", Status.Accepted, "2026-03-09"),
  [
    属性とシグナルを双方向同期すると、DOM 更新コストと無限ループのリスクが増える。
  ],
  [
    HTML 属性の変更は自動的にシグナル値を更新するが、シグナル値の変更を HTML 属性へは反映しない。
  ],
  [
    - 属性変更は直感的に props へ反映される
    - 属性へ戻す必要がある場合だけ利用者が明示的に `setAttribute` する
  ],
)

#adr(
  header("ComponentElement 型ヘルパーと module augmentation", Status.Accepted, "2026-03-09"),
  [
    TSX で custom element の型補完を提供するには、拡張可能な JSX 型定義が必要である。
  ],
  [
    `ComponentElement<C>` と `JSX.IntrinsicElements` の `interface` を使い、module augmentation で型補完を追加できるようにする。
  ],
  [
    - declaration merging による拡張が可能になる
    - 利用者がコンポーネント定義ファイル内で直接型を拡張できる
  ],
)

#adr(
  header("defineComponent は callable definition object を返す", Status.Accepted, "2026-03-11"),
  [
    custom element class だけを返すと `<my-counter>` 用の module augmentation が別途必要になり、TSX で `Counter` をそのまま書けないため DX が落ちる。
  ],
  [
    `defineComponent` は `webComponent` と `jsx` を持つ callable な `DefinedComponent` を返し、返り値自体を JSX 関数コンポーネントとして使えるようにする。
  ],
  [
    - `const Counter = defineComponent(...)` のまま `<Counter initial={1} />` が書ける
    - SSR では同じ返り値を `renderDSD(Counter, ...)` に渡せる
    - custom element class が必要な場面では `Counter.webComponent` から明示的に参照できる
  ],
)

#adr(
  header("関数コンポーネントのリアクティブ props サポート", Status.Accepted, "2026-03-09"),
  [
    既存の関数コンポーネントを Web Component 化しつつ、props の継続的な変化にも反応できる必要がある。
  ],
  [
    `defineComponent` の第 2 引数として関数コンポーネント `(props) => Node` を受け取り、props をリアクティブなシグナルとして渡す。
  ],
  [
    - 関数は初回レンダリング時に 1 回だけ実行される
    - `.value` と `effect` を通じて props の変化を自動追跡できる
    - 初期段階では `props` だけを使うコンポーネントも、`({ props }) => ...` として簡潔に書ける
  ],
)

#adr(
  header("関数コンポーネントは単一 context object を受け取る", Status.Accepted, "2026-03-10"),
  [
    `props` とは別に `store` や `host` などのコンポーネント実行文脈を追加していくと、多引数 API は拡張時に不安定になりやすい。
  ],
  [
    関数コンポーネントと hydrate 関数は、`host` / `props` / `store` をまとめた単一の `ComponentContext` object を受け取る。
  ],
  [
    - API の将来拡張がしやすくなる
    - `ctx.store` を中心に state access を統一できる
    - props だけを使う場合も object destructuring で簡潔に書ける
  ],
)

#adr(
  header("client metadata は ComponentContext から読めるようにする", Status.Proposed, "2026-03-16"),
  [
    `client:*` を host metadata へ正規化するだけでは component author から hydration strategy の意図が見えづらく、colocated client handler 設計とも接続しにくい。
  ],
  [
    `ComponentContext` / hydrate context に `client` object を追加し、strategy / value / hydrated を読み取れるようにする。`client` は host の island metadata を runtime が正規化した read-only view とし、unknown metadata は `null` として扱う。
  ],
  [
    - render と hydrate の両方から client strategy を同じ mental model で参照できる
    - bare host-level `client:*` と将来の colocated client handlers を同じ context surface へ寄せられる
    - existing `props` / `store` 中心 API と整合する
  ],
)

#adr(
  header("compiler-generated client handlers も defineComponent host 境界へ集約する", Status.Proposed, "2026-03-16"),
  [
    colocated client handler syntax を導入しても、runtime scheduler と cleanup は Web Component host 単位で管理した方が既存 island 設計と両立しやすい。
  ],
  [
    `<strategy>:on<Event>` は target HTML 要素に直接 hydrate 境界を作らず、transformer が target marker と strategy metadata を埋め込む。`defineComponent` host は DSD 接続時に shadowRoot 内 metadata を読んで island 境界へ集約する。
  ],
  [
    - scheduler / cleanup / store boundary を host 単位で維持できる
    - native element 単位の sub-island を runtime へ増やさずに済む
    - element-level syntax と host-level execution model を両立できる
  ],
)

#adr(
  header("island boundary は host setup subtree を支配する", Status.Accepted, "2026-03-18"),
  [
    delayed hydration strategy を持つ host の内側で、どこまでを inert SSR subtree とみなすかが曖昧だと、author が「どの UI がいつ interactive になるか」を予測できない。
  ],
  [
    `data-dh-island*` metadata を持つ custom element host は 1 つの hydration boundary として扱い、その host setup が生成した subtree 全体は strategy 発火までその boundary に従う。通常の DOM 要素や plain component subtree は独立 hydrate せず、outer host が hydrate された時点でまとめて interactive になる。
  ],
  [
    - `load` / `idle` / `visible` / `interaction` の semantics が subtree 単位で安定する
    - root CSR rerender の副作用で「たまたま動く」UI と strategy-driven hydration を区別しやすい
    - author は即時 interactive にしたい UI を明示的な別 boundary として切り出す必要がある
  ],
)

#adr(
  header("nested island boundary は explicit descendant host だけを候補にする", Status.Proposed, "2026-03-18"),
  [
    outer island の内側にも別 priority で hydrate したい UI は存在するが、native element marker や plain child component まで自動で sub-island 化すると execution model が複雑化する。
  ],
  [
    nested island は descendant custom element host が独立した `data-dh-island*` metadata を持つ場合にだけ導入し、nearest host boundary を明示的に分割する。colocated client marker は引き続き nearest component host へ集約し、native element 単位の暗黙 sub-island は導入しない。
  ],
  [
    - current host-centric scheduler / cleanup / store boundary を維持しやすい
    - Astro/Fresh 系の explicit island mental model に近い
    - nested boundary の可否、outer/inner strategy の優先順位、scan order は別途 runtime / transformer contract として詰める必要がある
  ],
)

#adr(
  header("nested island boundary を正式サポートする", Status.Proposed, "2026-03-18"),
  [
    outer island の subtree 内でも、優先度や trigger が異なる interactive UI を独立して起動したい。boundary を host 単位に限定したまま nested islands を正式に扱えれば、SSR shell を維持しつつ局所的な interactivity を段階的に解放できる。
  ],
  [
    descendant custom element host が独立した canonical `data-dh-island*` metadata を持つ場合、Dathra はそれを outer host とは別の explicit nested island boundary として扱う。nested boundary は nearest ancestor island host の subtree 内に存在してもよく、runtime scheduler は outer/inner をそれぞれ独立に schedule できるようにする。
  ],
  [
    - author は eager child / deferred parent のような構成を explicit host 分割で表現できる
    - host-centric cleanup / store boundary model は維持できる
    - boundary traversal、SSR artifact retention、outer setup rerender 時の nested host 保全など追加設計が必要になる
  ],
)

#adr(
  header("generic setup は compiler-generated hydration plan で DSD に接続する", Status.Proposed, "2026-03-18"),
  [
    `hydrate` option を手書きしない generic setup component でも、SSR DSD を破壊せずそのまま interactive にできる方が nested islands と progressive hydration の両方に有利である。現在の `shadowRoot.innerHTML = ""` fallback は outer host rerender 時に descendant island host を破壊しやすい。
  ],
  [
    transformer が生成できる JSX/setup については compiler-generated hydration plan を持たせ、`defineComponent` は DSD 接続時にその plan を優先して in-place hydration を実行する。user-defined `hydrate` がある場合はそれを優先し、どちらもない手書き setup だけを clear-and-rerender fallback とする。
  ],
  [
    - generic setup component でも SSR shell を温存したまま hydration できる
    - outer host が nested child island host を丸ごと消すケースを大きく減らせる
    - compiler が plan を生成できない imperative setup は引き続き fallback 扱いになる
  ],
)

#adr(
  header("colocated client handlers MVP は render replay で実現する", Status.Proposed, "2026-03-16"),
  [
    将来は compiler-generated action plan を個別 bind する設計を見据えるが、まず UX を検証できる MVP が必要である。現行 runtime / transformer の構造では host setup を hydrate entrypoint に再利用する方が変更範囲を抑えやすい。
  ],
  [
    MVP では `<strategy>:on<Event>` を compiler が target marker + strategy metadata へ変換し、必要に応じて target event metadata も残す。component は DSD を保持したまま strategy 発火後に root setup を再実行する。`interaction` では trigger event 後に host subtree の target 要素へ synthetic event を replay する。
  ],
  [
    - MVP を比較的短い変更で動かせる
    - SSR DSD を部分再利用するのではなく、hydrate 時に client render へ切り替える
    - `hydrate` option と共存させるには別の artifact-based 設計が必要になる
  ],
)

#adr(
  header("visible:onClick と idle:onClick も同じ host replay model へ載せる", Status.Proposed, "2026-03-16"),
  [
    colocated click syntax を load / interaction だけに留めると、非同期 scheduler を使いたい UI だけ author 体験が分断される。
  ],
  [
    phase 2 では `visible:on*` / `idle:on*` も追加し、component host は shadowRoot marker から `visible` / `idle` island metadata を導出する。`interaction` では必要に応じて target event metadata も読み、1 host 内で 1 種類の interaction event type を island value として導出する。strategy 発火後は MVP と同じ render-based setup を実行し、event binding は rerender 後の target に有効化される。host-level `client:*` / `data-dh-island*` metadata との混在、および `hydrate` option との併用は引き続き不許可とし、実装は dev diagnostics を出して colocated path を無効化する。
  ],
  [
    - author は strategy だけを差し替えて同じ書き味を維持できる
    - replay が必要な `interaction` と不要な `visible` / `idle` を同じ setup path に載せつつ、複雑性を分離できる
    - host-level scheduler / store boundary / cleanup は既存 islands integration のまま再利用できる
  ],
)

#adr(
  header("colocated client handler の capture は v1 で厳格に制限する", Status.Proposed, "2026-03-16"),
  [
    colocated syntax は author 体験を改善する一方で、任意の closure capture を許すと compiler / runtime の責務が急激に肥大化する。
  ],
  [
    MVP 実装は render replay ベースで inline handler 自体を setup に残すが、artifact-based action extraction へ進む v2 では compiler-generated client handler が参照できる外側値を `props`, `store`, signal, serializable で不変な local `const` に限定する。serializable local `const` には primitive literal、primitive-only template literal、readonly tuple、readonly object literal を含める。
  ],
  [
    - MVP の後でも capture model の拡張方針をぶらさずに進められる
    - `ctx.client` / `ctx.store` を中心に mental model を揃えやすい
    - imported helper や class instance capture は将来拡張として切り出せる
  ],
)

#adr(
  header("component target の colocated handler は child host event surface を bind 点にする", Status.Proposed, "2026-04-07"),
  [
    component 要素 target の colocated handler は parent callsite に書かれるが、SSR 後に実際に hydrate されるのは child custom element host である。runtime が bind できる安定 surface は child host 自身であり、shadow 内部 DOM へ親が直接 reach する contract は持てない。
  ],
  [
    component target の artifact-based handler binding は child host から観測できる event surface を bind 点とする。標準 DOM event で child host まで届かない event は child 側が host event として明示 re-emit するか、component target colocated では unsupported とする。
  ],
  [
    - runtime の binding point が child host で固定され、SSR/CSR の ownership が明確になる
    - child shadow DOM の内部構造変更を親 callsite の契約に露出しない
    - host へ届く event だけを component target colocated の対象にすることで replay semantics を定義しやすい
  ],
)

#behavior_spec(
  name: "component-target colocated action artifact support (proposal)",
  summary: [
    component 要素上の colocated handler は function prop transport ではなく compiler-generated action artifact binding として扱い、child host が独立 hydrate しても parent callsite の意図した handler を復元できるようにする。
  ],
  preconditions: [
    - child host は canonical `data-dh-island*` metadata と internal action binding metadata を持つ
    - initial rollout の action artifact は module-scope で再評価可能な handler のみを対象とし、runtime が追加の capture deserialize を必要としない
    - event surface は child host から観測できるか、child が host event として re-emit する
  ],
  steps: [
    1. child host は DSD 接続時に compiler-generated action binding metadata の有無を検査する
    2. strategy 発火までは既存 island scheduler に従って hydrate を遅延する
    3. hydrate 時に runtime action registry から action artifact を解決し、child host event surface へ listener を bind する
    4. `interaction` では trigger event が action binding event と一致する場合、hydrate 直後に replay を適用する
    5. child host dispose 時は action listener と pending replay state を cleanup する
  ],
  postconditions: [
    - component target colocated handler は child host の独立 hydrate 後も有効になる
    - function prop が SSR で失われても action artifact binding により handler が復元される
    - `hydrate` option と compiler-generated artifact path の責務が分離される
  ],
)

#adr(
  header("store binding は components 内部実装で扱う", Status.Accepted, "2026-03-10"),
  [
    `withStore()` の boundary を custom element instance まで運ぶ仕組みは必要だが、利用者に public API として公開すると mental model が複雑になる。
  ],
  [
    current store の捕捉と host への binding は `@dathra/components` 内部実装に閉じ込め、公開 API には含めない。
  ],
  [
    - 利用者は `withStore()` と `ctx.store` だけを理解すればよい
    - host-to-store binding の実装を将来変更しやすい
    - `@dathra/store` は atom/store/boundary の public API に集中できる
  ],
)

#adr(
  header("subtree store binding は custom element name 規約で判定する", Status.Accepted, "2026-03-10"),
  [
    JSX runtime が生成した subtree へ store を伝播する際、custom element host を軽量に検出する必要がある。
  ],
  [
    初期バージョンでは tag name にハイフンを含む要素を custom element host とみなし、store binding の対象にする。
  ],
  [
    - HTML Custom Elements の命名規約と一致する
    - `customElements.get()` への依存を避けて軽量に走査できる
    - 将来より厳密な host 判定が必要になった場合の差し替え余地を残せる
  ],
)

#adr(
  header("connectedCallback / attributeChangedCallback のエラーハンドリング", Status.Accepted, "2026-03-09"),
  [
    setup や属性更新処理が例外を投げても、コンポーネントのライフサイクル全体を壊さない必要がある。
  ],
  [
    `connectedCallback` 内の `createRoot` 呼び出しと `attributeChangedCallback` 内のシグナル更新を try-catch で保護する。
  ],
  [
    - 例外時でも `disconnectedCallback` は安全に動作できる
    - 属性更新エラーをログ化しつつ他の処理継続が可能になる
  ],
)

#adr(
  header("attribute: false による属性非監視プロパティ", Status.Accepted, "2026-03-09"),
  [
    SSR から属性として渡せない値や、JS property だけで更新したい props を扱う必要がある。
  ],
  [
    `PropDefinition.attribute: false` の prop は `observedAttributes` に含めず、`getDefaultValue(def)` で初期化する。
  ],
  [
    - `attributeChangedCallback` では更新されない
    - property setter 経由でのみシグナルを更新する
  ],
)

#adr(
  header("DSD 存在時に hydrate なしの場合の再レンダリング", Status.Accepted, "2026-03-09"),
  [
    SSR で生成した DSD をそのまま再利用できず、hydrate 実装も提供されないケースがある。
  ],
  [
    DSD が存在し、かつ `hydrate` オプションが未指定の場合は `shadowRoot.innerHTML = ""` 後に `resolvedSetup` を再実行する。
  ],
  [
    - hydrate なしコンポーネントは毎回クリーンなセットアップを期待できる
    - SSR で描画された DSD コンテンツは CSR 初期化時に意図的に破棄される
  ],
)

#behavior_spec(
  name: "compiler-generated generic setup hydration plan (proposal)",
  summary: [
    transform 可能な generic setup component は compiler-generated hydration plan によって SSR DSD へ in-place 接続し、手書き `hydrate` がなくても shadowRoot 全消去を避けられるようにする。
  ],
  preconditions: [
    - public API として `ComponentOptions.hydrate` は維持し、compiler-generated plan は内部実装 detail として扱う
    - user-defined `hydrate` がある場合はそちらを優先し、compiler-generated plan は fallback しない
    - compiler-generated plan が利用可能な host は `runSetup()` による clear-and-rerender ではなく hydration runtime を使って既存 DSD へ接続する
    - plan を生成できない imperative setup は従来どおり fallback clear-and-rerender を許可する
    - plan 対象外の理由は dev diagnostics と SSR registry metadata から追跡できる
  ],
  steps: [
    1. SSR では transform 由来 setup が marker 付き DSD を出力する
    2. CSR `connectedCallback` は host shadowRoot に DSD がある場合、user-defined `hydrate` の有無を先に確認する
    3. user-defined `hydrate` がなく compiler-generated plan がある場合、generic setup hydration runtime を呼んで text / attr / event / insert binding を既存 DSD へ接続する
    4. strategy metadata を持つ island host では、その hydration plan 実行自体を runtime scheduler で遅延する
    5. plan がない場合だけ `shadowRoot.innerHTML = ""` fallback に落とす
  ],
  postconditions: [
    - transform 由来 setup component は `hydrate` option なしでも SSR DSD を破壊せず interactive になる
    - compiler-generated hydration plan を持つ host は `data-dh-island="visible"` などの strategy 発火後に in-place hydration される
    - plan 非対応の imperative setup component は従来どおり clear-and-rerender fallback に落ちる
    - descendant nested island host を含む outer component が generic hydration plan で hydrate しても child host DOM は初回 hydrate 時に破壊されない
    - `runSetup()` は将来的に「fresh mount path」と「fallback clear-and-rerender path」へ縮退し、DSD 接続の主経路は hydration plan path へ寄せる
    - initial rollout では component body 内の imperative DOM query / mutation、runtime-only branching、opaque spread semantics を含む setup を plan 対象外にしてもよい
  ],
)

#feature_spec(
  name: "initial unsupported setup patterns for generic hydration plan",
  summary: [
    初期 rollout では compiler が安全に hydration plan を生成できる setup だけを対象にし、解析不能または DOM preservation を壊しやすい setup は明示的に unsupported とする。
  ],
  edge_cases: [
    - component body 内で `document` / `window` / `shadowRoot` / `host` へ imperative query・mutation を行う setup は unsupported
    - JSX tree の外で DOM Node を自前生成し、その Node identity を前提に append/reuse する setup は unsupported
    - runtime 条件分岐により SSR と CSR で異なる element shape を返しうる setup は unsupported
    - object spread の意味を compile 時に正規化できないケースは unsupported
    - imported helper や opaque function call が JSX tree shape を返すケースは、初期 rollout では unsupported にしてよい
  ],
  test_cases: [
    - unsupported pattern を含む component は hydration plan を持たず fallback clear-and-rerender path に残る
    - unsupported reason は dev diagnostics と registry metadata から読める
    - plan 対応 component と unsupported component が同じ app に混在しても registration が壊れない
  ],
  impl_notes: [
    - initial rollout のゴールは coverage 最大化より soundness 優先とする
    - unsupported から supported への拡張は transform capability を 1 パターンずつ増やす形で進める
  ],
)

#feature_spec(
  name: "planFactory placement",
  summary: [
    compiler-generated hydration plan は component definition に紐づく static metadata として保持し、SSR registry と CSR defineComponent の両方から参照できるようにする。
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
    - transform が生成した `planFactory` は component definition/static metadata から取得できる
    - SSR `registerComponent()` は同じ hydration metadata を registry へ保存できる
    - CSR `defineComponent` は instance hydrate 時に component definition から `planFactory` を読める
  ],
  impl_notes: [
    - supported component では `planFactory` を持つ metadata を definition object へ付与し、unsupported component では `unsupportedReason` だけを持つ metadata を definition object へ付与する
    - registry だけに plan を置くと CSR path が参照しづらく、definition object だけに置くと SSR renderer が registry 経由で読めないため、definition object を source of truth にして registry はミラーする
  ],
)

== 機能仕様

#feature_spec(
  name: "defineComponent test coverage",
  summary: [
    defineComponent の主な責務である custom element 定義、Props 型変換、DSD ハイドレーション、SSR 連携、cleanup を検証する。
  ],
  test_cases: [
    1. カスタム要素を正しく定義する
    2. Shadow DOM が生成される
    3. `setup` 関数が呼ばれる
    4. `adoptedStyleSheets` にスタイルが適用される
    5. props スキーマから observedAttributes が自動生成される
    6. props シグナルが正しい型変換で初期化される（String, Number, Boolean）
    7. 属性変更が型変換後にシグナルに反映される
    8. JS property setter で直接値をシグナルに設定できる
    9. Boolean 型は属性の存在/不在で true/false になる
    10. default 値が未設定の属性に適用される
    11. `disconnectedCallback` で cleanup が実行される
    12. DSD が存在する場合にハイドレーションモードで動作する
    13. DSD 非対応ブラウザで `<template>` がフォールバック展開される
    14. SSR 環境でレジストリに登録される
    15. `defineComponent()` の返り値が `webComponent` と `jsx` を持つ callable object になる
    16. `__tagName__` と `__propsSchema__` が返り値に付与される
    17. `DefinedComponent.webComponent` を `renderDSD` の引数として使用できる
    18. `ComponentElement<typeof MyComp>` で JSX props 型が推論される
    19. 返り値自体を JSX 関数コンポーネントとして使うと host props / children が custom element に渡る
    20. Number 型の prop: `null` 属性値はデフォルト値を使用する（`Number(null)` = 0 を使わない）
    21. `setup` 関数がエラーを投げても `#dispose` が安全に扱われる（再接続時も動作）
    22. `withStore()` 内で生成された custom element が `ctx.store` から同じ store instance を受け取る
    23. nested `withStore()` で生成された custom element は内側の store instance を受け取る
    24. `withStore()` 内の JSX subtree に含まれる nested custom element も store instance を受け取る
    25. `adoptGlobalStyles()` で登録した global style が `adoptedStyleSheets` に含まれる
    26. component 接続後に `adoptGlobalStyles()` を呼んでも既存 ShadowRoot へ style が反映される
     27. component が切断されている間は global style 更新を受け取らず、再接続時に最新の style 集合へ再同期する
     28. custom coercer prop は属性未指定の初期化時も属性除去時も同じ `null` 入力規則で評価される
     29. DSD hydration 時に SSR `<style>` を除去し、global/local の `adoptedStyleSheets` へ置き換える
     30. `data-dh-island` を持つ DSD component は `connectedCallback` で hydrate せず、`hydrateIslands()` の strategy 発火後に hydrate する
     31. JSX helper で `client:*` directive を書いても型エラーにならず、runtime では DOM attribute として書き出されない
     32. `ctx.client` から island strategy / value / hydrated 状態を読める
     33. colocated client handler MVP は host-level island metadata により setup を遅延実行する
     34. artifact-based client handler へ進む段階では capture model を `props` / `store` / signal / serializable local `const` へ制限する
     35. `interaction:onClick` は host setup 完了後に target click を replay する
     36. `visible:onClick` / `idle:onClick` は replay を行わず、strategy 発火後の setup rerender で click handler を有効化する
     37. deferred outer host の subtree にある descendant island host は explicit nested boundary として独立 schedule できる
     38. nested child island が outer host より先に hydrate しても、outer host の未発火 strategy によって child の hydrated state が破壊されない
     39. outer host rerender が起きる場合、SSR DSD 由来の descendant island host metadata が再接続可能な形で保全される
  ],
)

#behavior_spec(
  name: "nested island boundary support (proposal)",
  summary: [
    descendant custom element host に付いた canonical `data-dh-island*` metadata を explicit nested island boundary として扱い、outer host と独立に hydrate できるようにする。
  ],
  preconditions: [
    - nested boundary は custom element host 単位に限り、native element marker や plain component subtree を直接 boundary にしない
    - outer host と inner host はそれぞれ own `HYDRATE_ISLANDS_HOOK` / cleanup ownership を持つ
    - nested child の store binding は nearest host hierarchy を保ったまま独立 hydrate できる必要がある
    - colocated marker は引き続き nearest host へ集約するため、nested child 化したい場合は child host 自体を explicit island に分割する
  ],
  steps: [
    1. author は outer host の render subtree 内に descendant custom element host を配置し、その child host 自体へ `client:*` または canonical `data-dh-island*` metadata を与える
    2. runtime `hydrateIslands()` は DOM / open ShadowRoot を走査し、outer host の subtree 内にある descendant island host も独立 host として収集する
    3. scheduler は host ごとに strategy を評価し、outer/inner の発火順を固定せず独立に hydrate を試みる
    4. outer host が setup rerender を行う場合は、SSR output が descendant island host を安定 tag + metadata 付きで再生成し、必要なら child host が再接続後に再 schedule される
  ],
  postconditions: [
    - outer `client:visible` host 内の child `client:load` host は child 側の strategy で先に hydrate できる
    - outer `client:interaction` host が未発火でも、child `client:idle` host は idle で hydrate できる
    - child host が先に hydrate 済みのあと outer host が hydrate しても child host の metadata と再接続可能性が保たれる
    - native element に付いた colocated marker だけでは nested boundary を作らない
    - outer host の render-based setup が shadowRoot 全消去を行う path では、nested child を破壊しうるため preservation strategy か stop-at-boundary rerender 規則が必要になる
  ],
)

#behavior_spec(
  name: "vertical slice: visible outer host with load nested child",
  summary: [
    explicit nested island の代表ユースケースとして、`Outer client:visible` の SSR DSD 内に `Inner client:load` がある場合、child は先行 hydrate し、outer は後から in-place hydrate しても child host を破壊しない。
  ],
  preconditions: [
    - `Outer` / `Inner` は `planFactory` を持つ generic hydration plan 対応 component である
    - `Inner` host は explicit `data-dh-island="load"` metadata を持つ
    - `Outer` host は explicit `data-dh-island="visible"` metadata を持つ
  ],
  steps: [
    1. SSR では `Outer` DSD の中に `Inner` host + child DSD がそのまま出力される
    2. client boot 後、runtime は `Inner` host を `load` strategy で先に schedule し、`hydrateWithPlan()` により child host を in-place hydrate する
    3. `Outer` host は `visible` 発火まで inert のまま残る
    4. `visible` 発火後、`Outer` host は `planFactory` 由来 plan で hydrate し、`NestedBoundaryRef` に該当する `Inner` subtree を mutate しない
  ],
  postconditions: [
    - child host は outer host より先に interactive になれる
    - outer host hydrate 後も child host の DOM / event / hydrated state は維持される
    - clear-and-rerender fallback は unsupported host にしか使われない
  ],
)
