#import "../../../functions.typ": *
#import "../../../settings.typ": *
#show: apply-settings

#design_proposal(
  issue: 262,
  name: "最初の slice の Plain JS/TS authoring API と delivery 契約",
  summary: [
    #247 の最初の実 consumer に対し、作者が初期 DOM と client 権限を普通の JS/TS で記述する公開面を提案する。
    本文の API 名と署名はレビュー対象の提案であり、production 実装済みの API ではない。
    #253 の Plain JS/TS と明示境界、#260 の capability と package 境界を入力とし、両 Issue の採用判断を変更しない。
  ],
  scope: [
    - #raw("@playground/e2e") の #raw("/store-snapshot-roundtrip") を代表する初期 DOM、state、event、binding の宣言
    - creation、request、delivery の公開宣言面と server/client entry の対応
    - author、build、server、client の検証分担、診断、zero-client-root、identity と失敗境界
    - #248 と #249 が消費する契約、および #250 と #251 の検証 gate
  ],
  non_goals: [
    - production code、既存 package SPEC/tests、server renderer、client activation transaction の実装
    - 専用 compiler、JSX、arbitrary JS/DOM からの ownership 推論、旧 API または wire format の互換維持
    - transport encoding、DOM marker の具体表現、全 adapter、性能閾値の決定
    - #253 と #260 の採用済み判断の再審議、PR merge、親 Epic close
  ],
  references: (
    link("https://github.com/dathra/dathra/issues/262")[Issue #262],
    link("https://github.com/dathra/dathra/issues/247")[Epic #247],
    link("https://github.com/dathra/dathra/issues/253")[Adopted #253],
    link("https://github.com/dathra/dathra/issues/260#issuecomment-5901570348")[Adopted #260 completion],
    link("https://github.com/dathra/dathra/issues/252")[Consumer evidence #252],
    link("https://github.com/dathra/dathra/issues/248")[Server owner #248],
    link("https://github.com/dathra/dathra/issues/249")[Client owner #249],
  ),
)

== 入力と判断境界

#252 の固定 evidence は #raw("/store-snapshot-roundtrip") の SSR に Theme #raw("snapshot-midnight") と Count #raw("7") が出ること、client で snapshot を引き継ぎ一回の click で #raw("8") へ進むことを示す。
五回 click と cleanup は consumer 検証仮説だったが、#253 と #260 の採用済み owner/lifetime 契約が反復 operation と disposal を必要とする。
現行 route は欠落 snapshot で #raw("client-default") と #raw("0") へ黙って切り替え、切断済み button の listener も残す。
これらは現行 baseline の欠落であり、新しい API の期待値にしない。
#252 の測定 source は #raw("c1a30ed86fd2bd79e1c742362f552e9f62ff9f98")、evidence は #raw("SPEC/proposals/245/252/252.typ") と PR #255 に残る。

#253 は専用 compiler と JSX を採用せず、明示的 server/client module と association を選んだ。
#260 は server/client を sibling package とし、shared に純粋な宣言契約、plugin に entry 選択と graph 診断を置いた。
#260 の Typst ADR に残る #raw("Status.Proposed") は作成時点の表記であり、Issue の completion comment と Proposal Progress の Accepted が採用記録である。
本書の選択はレビュー用の Proposed とし、両判断を再審議しない。

== 提案する公開面

初期 DOM は server entry の #raw("render") が返す #raw("ServerView") 内に、要素とテキストの宣言的な JS/TS call として書く。
#raw("el") と #raw("txt") は初期値を記述し、#raw("bind")、#raw("on")、#raw("creation") はその位置に明示的な client target を付ける。
その結果、作者は selector、DOM path、marker、response identity を手書きせずに target の所属を指定できる。
それらの API 名は本 Proposal の推奨名であり、#253 で使った #raw("element/text/renderMarkup/declareCapability") は採用済み名ではない。

#interface_spec(
  name: "Delivery と route entry",
  summary: [作者が route と server/client module を静的に対応付ける。
    adapter は server module の任意関数を解析せず、宣言 entry だけを build graph に渡す。],
  format: [
    ```ts
    // dathra.config.ts
    import { defineDelivery } from "@dathra/plugin";

    export default defineDelivery({
      routes: {
        "/store-snapshot-roundtrip": {
          server: "./snapshot.server.ts",
          client: "./snapshot.client.ts",
        },
        "/store-snapshot-repeat": {
          server: "./snapshot-repeated.server.ts",
          client: "./snapshot.client.ts",
        },
        "/details": {
          server: "./details.server.ts",
          client: "./details.client.ts",
        },
        "/static": { server: "./static.server.ts" },
      },
    });
    ```
  ],
  constraints: [
    - #raw("server") と #raw("client") は author が指定する module specifier であり、browser へ server entry を渡さない。
    - route key は静的 delivery key であり、SSR instance identity には使わない。
    - 一つの route に client entry があっても、ある response の capability 集合が空ならその response に Dathra client 参照を送らない。
    - route に client entry 自体がなければ、その route のための Dathra client artifact を build で選ばない。
    - #raw("defineDelivery") は純粋な設定値を受け、任意 JS の実行結果から route/capability を推測しない。
  ],
)

#interface_spec(
  name: "Server の初期 DOM と state",
  summary: [server entry は request ごと、UI の出現ごとに初期値を一度だけ作り、同じ値で DOM と handoff を記述する。],
  format: [
    ```ts
    // snapshot.server.ts
    import { defineRoute, occurrence, el, txt, bind, on } from "@dathra/core/server";
    import { signal } from "@dathra/reactivity";

    export function createModel(initialCount = 7) {
      return {
        count: signal(initialCount),
        theme: signal("snapshot-midnight"),
      };
    }
    export type Model = ReturnType<typeof createModel>;

    export default defineRoute({
      render(_request) {
        const state = createModel();
        return occurrence({
          state,
          values: { locale: "ja-JP" },
          view: el("article", {},
            el("p", {}, txt(`Theme: ${state.theme.value}`, bind("themeText"))),
            el("p", {}, txt(`Count: ${state.count.value}`, bind("countText"))),
            el("button", { type: "button", on: on("click", "increment") },
              txt("Increment snapshot count")),
          ),
        });
      },
    });
    ```
  ],
  constraints: [
    - #raw("state") の Signal は SSR 値を読むために一度生成する。client は同一 memory object を受け取らず、論理値から browser-local Signal を復元する。
    - #raw("values") は server が JSON-safe な plain data として検査して copy し、client が深く凍結した値として読む boundary value である。TypeScript の #raw("number") は非有限値も許すため、有限性、循環、prototype、secret 混入は server 側の検査と author の責任で扱う。
    - #raw("txt(initial, bind(exportName))") は初期テキストと明示 target を同じ場所に記述する。#raw("txt(state.count.value)") だけでは subscription を作らない。
    - #raw("on(event, exportName)") はその element の event target を宣言する。DOM の見た目から button 権限を推測しない。
    - #raw("view") の子配列と属性の詳細構文は上の入れ子 call を受ける。HTML escaping と属性許可は server renderer の検証対象となる。
  ],
)

一つの #raw("defineRoute.render") は #raw("ServerView") を返す。
初期 state を持つ root は #raw("occurrence({state, view})") として返す。
複数出現を含む route は #raw("el") が返す #raw("ServerView") の子へ #raw("occurrence") を並べる。
同じ UI 宣言を繰り返す場合、#raw("occurrence") が各出現の state と view を囲む。
一つの route response に #raw("renderCounter(7)") と #raw("renderCounter(40)") を置くと、server は二つの identity と association を発行する。
この例の #raw("createModel") は server module からの value import であり、client には type-only な #raw("Model") だけが渡る。
route の静的 client entry と export code は共有できるが、二つの Signal、target、owner は共有しない。

```ts
// snapshot-repeated.server.ts
import { defineRoute, occurrence, el, txt, bind, on } from "@dathra/core/server";
import { createModel } from "./snapshot.server";

function renderCounter(initialCount: number) {
  const state = createModel(initialCount);
  return occurrence({
    state,
    values: { locale: "ja-JP" },
    view: el("article", {},
      el("p", {}, txt(`Count: ${state.count.value}`, bind("countText"))),
      el("button", { on: on("click", "increment") }, txt("Increment")),
    ),
  });
}

export default defineRoute({
  render(_request) {
    return el("main", {}, renderCounter(7), renderCounter(40));
  },
});
```

#interface_spec(
  name: "Client の通常 export と型境界",
  summary: [client entry は server initializer を value import せず、通常の export 関数で getter と operation を提供する。],
  format: [
    ```ts
    // snapshot.client.ts
    import type { Model } from "./snapshot.server";
    import type { ClientContext } from "@dathra/core/client";

    type Ctx = ClientContext<Model, { locale: string }>;

    export function themeText(ctx: Ctx): string {
      return `Theme: ${ctx.state.theme.value}`;
    }
    export function countText(ctx: Ctx): string {
      return `Count: ${ctx.state.count.value}`;
    }
    export function increment(ctx: Ctx): void {
      ctx.state.count.set(ctx.state.count.value + 1);
    }
    ```
  ],
  constraints: [
    - #raw("import type") は TypeScript の型検査にのみ使い、emit した client module から消える。client の value graph に server initializer、renderer、request secret は入れない。#raw("Model") は server 関数の戻り型だけを参照し、browser でその関数を呼ばない。
    - #raw("ClientContext<Model, Values>") は Signal の読み取りと #raw("set")、deep-readonly な boundary value、宣言 target と request のみを公開する。復元済み state は一つの SSR instance owner に閉じる。
    - build は client module の export 存在と禁止 value import を検査する。adapter は route key と export inventory を server entry に渡し、render 中に選んだ export 名と target の一致を server response 作成時にも検査する。
    - TS 型は author の誤記を早く検出するが、cast、JS、外部入力の runtime 正当性まで証明しない。server と client preflight の値検査を省かない。
  ],
)

== 公開型の骨格

以下は候補 A の公開型を示す。
#raw("Signal<T>") は既存 engine の型であり、#raw("Restored<S>") は server で宣言した state 名と値型を client で保持する。
型だけの import は値 graph に含めず、JS 利用時と不正な payload は runtime validator が受け持つ。
以下の型は設計用署名の抜粋である。
完全な署名と各例を #raw("examples/stubs.d.ts") と隣接する例示 module に保存する。
これらは production 実装や公開済み package API ではない。

```ts
// The complete review-only signatures are in examples/stubs.d.ts.
type JsonValue = null | boolean | number | string |
  readonly JsonValue[] | { readonly [name: string]: JsonValue };
type DeepReadonlyJson<T> =
  T extends readonly (infer E)[] ? readonly DeepReadonlyJson<E>[] :
  T extends object ? { readonly [K in keyof T]: DeepReadonlyJson<T[K]> } : T;
type Restored<S> = {
  readonly [K in keyof S]: S[K] extends Signal<infer V> ? Signal<V> : never;
};
interface ClientContext<S, V, R extends object = {}, C extends string = never> {
  readonly state: Restored<S>;
  readonly values: DeepReadonlyJson<V>;
  request<K extends Extract<keyof R, string>>(
    name: K, input: RequestInput<R[K]>
  ): Promise<RequestOutput<R[K]>>;
  create<K extends C>(name: K, factory: () => ClientView): void;
}
interface ServerView { readonly environment: "server" }
interface Occurrence<S, V extends JsonValue, R extends object> extends ServerView {
  readonly state: S;
  readonly values?: V;
  readonly requests?: R;
}
declare function defineRoute(configuration: {
  render(request: RequestContext): ServerView;
}): ServerRoute;
declare function occurrence<S, V extends JsonValue, R extends object = {}>(data: {
  state: S; values?: V; view: ServerView; requests?: R;
}): Occurrence<S, V, R>;
```

#raw("RequestInput/RequestOutput") は server の #raw("RequestSpec") の検査器から推論する。
#raw("request") と #raw("create") の名前は server が宣言した集合に対して検査する。
型付き利用では request の入出力型と creation 境界名を TypeScript で照合し、未宣言名を拒否する。
#raw("ClientContext") の型引数に書く request/creation 名と server occurrence の宣言が一致するかは、型検査だけで証明できないため build と server の検査で照合する。
JS 利用と動的な名前では server/client の実行時検査を必須とする。
最初の slice の公開 binding は既存 text node を対象とする。
属性と property の mutable target は同じ明示権限原則のもとで #247 の後続実装 scope に置き、最初の fixture の受入条件には追加しない。

== creation と request の宣言面

user-created UI と明示 server request は、この最初の consumer では実行しないが、#260 が別 capability として採用したため公開宣言面を定義する。
#raw("creation(name)") は初期 #raw("view") 内に新しい child を入れられる境界を置き、client operation は #raw("ctx.create(name, factory)") を呼ぶ。
factory は client module の明示 export または operation 内の JS 関数であり、ユーザー操作後の新しい child のみを作る。
#raw("ctx.create") は既存 SSR subtree の置換権限を与えず、child scope と disposal は #249 が実装する。

#raw("requests") は #raw("occurrence") の任意 field に置き、その instance の権限だけを定義する。
server entry の #raw("requests") は name、入力と出力の検査器、server handler を宣言する。
handler は #248 が定義する request-local context を受け、認証や request-scoped resource を参照できる。
client operation は #raw("ctx.request(name, input)") でのみその handler を呼べる。
request 境界は外部入力を受けるため、ここだけ検査器を必須にする。
単なる state 引継ぎに public schema を要求しない一方、通信入力を無検証にしないためである。

```ts
// details.server.ts
import { defineRoute, occurrence, el, txt, on, creation, request } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";

function createDetailsState() { return { count: signal(7) }; }
export type DetailsState = ReturnType<typeof createDetailsState>;

const detailsInput = {
  parse(value: unknown): { id: string } {
    if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string") {
      throw new TypeError("details input requires a string id");
    }
    return { id: value.id };
  },
};
const detailsOutput = {
  parse(value: unknown): { label: string } {
    if (typeof value !== "object" || value === null || !("label" in value) || typeof value.label !== "string") {
      throw new TypeError("details output requires a string label");
    }
    return { label: value.label };
  },
};
export const detailsRequests = {
  details: request({
    input: detailsInput,
    output: detailsOutput,
    handle(input, context) { return { label: `${input.id} from ${context.request.url}` }; },
  }),
};
export type DetailsRequests = typeof detailsRequests;

export default defineRoute({
  render(_request) {
    const state = createDetailsState();
    return occurrence({
      state,
      values: { itemId: "item-1" },
      requests: detailsRequests,
      view: el("section", {},
        el("div", { create: creation("details") }),
        el("button", { on: on("click", "loadDetails") }, txt("Load")),
      ),
    });
  },
});
```

次の client entry は browser 用の #raw("el/txt") を import し、server entry は型だけで参照する。

```ts
// details.client.ts
import { el, txt } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { DetailsState, DetailsRequests } from "./details.server";

type DetailCtx = ClientContext<DetailsState, { itemId: string }, DetailsRequests, "details">;

export async function loadDetails(ctx: DetailCtx): Promise<void> {
  const result = await ctx.request("details", { id: ctx.values.itemId });
  ctx.create("details", () => el("p", {}, txt(result.label)));
}
```

#raw("detailsInput/detailsOutput") は例示 module にある最小の #raw("parse") 実装であり、codec library や wire encoding の選択ではない。
#raw("details") route は first-slice fixture への追加ではなく、採用済みの request と creation 能力の公開面を確認する設計用の例である。
#raw("/store-snapshot-repeat") と #raw("/static") も契約を検査する例示 route であり、一次 consumer は #raw("/store-snapshot-roundtrip") である。
server response の生成、commit/cancel と fresh identity の発行は #248、client の child lifetime、遅延応答の破棄と target write は #249 が所有する。
本 API は明示 request の失敗を成功扱いせず、active instance を保ったまま operation の再試行を認める。

== 例示 module と型検証の範囲

上の候補 A の module は #raw("examples/") に全文を置く。
Proposal 内の code block は先頭の file 名コメントを除き、対応する file の内容と一致させる。
#raw("dathra.config.ts") は四 route の entry を固定し、#raw("snapshot.server.ts") と #raw("snapshot.client.ts") は一次 consumer の server/client 境界を示す。
#raw("snapshot-repeated.server.ts") は二つの #raw("occurrence") を一つの #raw("ServerView") に含め、#raw("static.server.ts") は client entry のない route を示す。
#raw("details.server.ts") と #raw("details.client.ts") は同一 occurrence 内の request 宣言、creation boundary、client 操作の型を示す。
#raw("snapshot.client.ts") と #raw("details.client.ts") の server module 参照は #raw("import type") のみであり、emit 後の JavaScript にその import は残らない。
#raw("typecheck.assertions.ts") は state の欠落、readonly boundary の書換え、未宣言 request/creation 名、誤った request 入力の拒否を検査する。
#raw("examples/stubs.d.ts") は候補 API の review 用宣言であり、実 package の型や実行結果を表さない。
厳密な TypeScript check は完全な例示 module とこの stub の内部整合性を示すだけで、runtime の値検査、bundle graph、SSR や activation の成立を証明しない。
後述の選択肢 B の二表は比較用の擬似例であり、候補 A の型検証対象ではない。

== Delivery と association

#table(
  columns: (1.25fr, 3.05fr, 3.2fr),
  table.header([段階], [入力と作成するもの], [検証と権限]),
  [author], [route config の server/client entry、server #raw("view/state/values")、その位置に付いた binding/event/creation と request 定義。], [静的 key と実行環境を明示する。response identity や内部 manifest は手書きしない。],
  [build], [entry graph と bundler output。client bundle の export inventory と route 対応を保持する。], [既知の禁止 import、欠落 entry/export、server-only route の client 混入を診断する。任意 JS の意味推論はしない。],
  [server], [request ごとの初期 DOM/state、出現ごとの新 identity、不変 association、必要時の client entry reference。], [値と target 宣言を検査し、一つの response に static capability key、instance identity、論理値、root/host/control/target を結ぶ。],
  [client], [response の association と選ばれた client entry。], [取得前 preflight で root/host/control と export/値を照合し、一 identity を一 owner に入場させる。],
)

static capability key は route key と宣言 export 名から構成する安定キーであり、response-local identity は server が UI の出現ごとに発行する値である。
同じ component が一 response に二回現れれば static key と code は共有しても、identity、state、target record、activation owner は二つ作る。
同じ logical state slot の alias は一 owner 内の一つの client-local Signal を参照する。
association は server artifact の不変部分であり、client は DOM 形状や selector の一致だけで ownership を得ない。
root、Web Component host、button 等の control、binding target の存在と所属を preflight で照合する。
marker の byte 表現や locator encoding は #248/#249 の共同契約だが、この照合範囲は本 Proposal の必須条件である。

response に client capability が一つもなければ、server はその response に Dathra bootstrap、handoff、activation marker、client artifact reference を出さない。
route に client entry が無ければ build もその route 用 client entry を選ばない。
client entry がある route の一 response が capability なしなら artifact が build cache に存在し得るが、その response は参照も取得もしない。
未知または不完全な宣言を空集合へ変換して zero-root と称しない。
通常の HTML、navigation、Dathra 以外の site script はこの条件の対象外である。

固定された source、toolchain、route 設定、request 値と response identity seed から同じ意味の DOM、association と entry 選択を得る。
server は response ごとに新しい identity を発行するため、異なる response の byte 列同一性は要求しない。
同じ seed で再現した結果は比較でき、#251 は生成物と browser request を同一 revision で照合する。

== 検証と診断

#table(
  columns: (1.05fr, 2.65fr, 3.7fr),
  table.header([主体], [検査する不整合], [失敗例と actionable diagnostic]),
  [author/TS], [#raw("ClientContext") の state 名、Signal 値型、operation 引数と readonly boundary。], [#raw("state.count") の誤字は型エラー。JS 利用時や cast はこの保証の外で、後段が検査する。],
  [build/plugin], [entry 不在、client export 不在、server package への既知 value import、循環または不明な graph edge。], [#raw("snapshot.client.ts") が #raw("snapshot.server.ts") を value import した場合、import path と #raw("import type") または shared type への修正を示す。],
  [server], [unsupported value、循環参照、未定義 export 名、重複 target writer、request 検査器不在、初期 DOM と宣言の矛盾。], [#raw("bind(\"countText\")") の export が無ければ route と target を示して response commit 前に失敗する。SSR を不完全な handoff と共に送らない。],
  [client preflight], [identity、static key、entry/export、値、root、host、control、target の欠落や矛盾。], [#raw("increment") control が別 instance に属せば、response identity と target key を示して unadmitted で拒否する。SSR を保ち資源を作らない。],
  [client active], [getter/operation の例外、stale generation、許可外 target、request failure。], [対象 operation 名と identity を報告し、false success を示さない。取得後の activation 失敗は terminal とし fresh response を要求する。],
)

診断には検出段階、route、static key、可能なら response identity、宣言箇所または export 名、原因と修正方法を含める。
secret や boundary value の実値は診断へ出さない。
TypeScript transform、bundler と minifier は通常の build tool として使えるが、Vite 等の transpile のみを型検査や server/client 分離の証拠とはしない。
動的 import、環境条件、opaque plugin により client graph を確証できない場合は build を拒否するか、明示 entry と許可 graph を追加させる。
実行時の未宣言 target は推測で補わず拒否する。

== option 比較

選択肢 A は上の DOM builder、entry config、inline target と通常 export の組合せである。
選択肢 B は server と client の registry、target selector、association table を作者が別々に手書きする方式である。
選択肢 C は汎用 component 関数を browser で再実行し、closure または DOM を走査して binding を推論する方式である。
B も明示境界を守れば成立するが、A は target を初期 DOM の記述位置へ結び付けるため重複 key の照合が少ない。
C は #245 と #253 の不変条件に反する。

```ts
// Option B: two manually maintained maps for the same Count target.
server.targets.countText = "[data-count]";
client.targets.countText = "[data-count]";
client.operations.increment = "[data-increment]";
// A places bind("countText") and on("click", "increment") in view.
```

#table(
  columns: (1.15fr, 2.05fr, 2.05fr, 2.05fr),
  table.header([基準], [A: inline 宣言と entry], [B: 手書き registry], [C: 暗黙 capture]),
  [consumer], [Count と Theme を初期描画し、同じ位置へ getter を接続。繰返し操作を owner に保持。], [同じ挙動は可能だが二つの表を同期する。], [再実行と推論を許せば記述は短いが SSR identity を保持できない。],
  [型と診断], [#raw("Model") の type-only import と export inventory を検査。動的 target は server/client で検査。], [registry の型を手書きすれば検査可能だが、key と selector の重複を保守する。], [任意 closure と DOM 形状の完全解析は保証できず、不明な入力の発見点が曖昧。],
  [寿命と失敗], [#260 の owner と preflight/terminal 規則へ記録を渡す。], [同じ規則へ渡せるが不一致の箇所が増える。], [setup replay と暗黙 fallback が失敗境界を隠す。必須条件に不適合。],
  [zero-root と graph], [明示 client entry が空なら artifact 不選択。response capability が空なら参照不送信。], [空 registry を検証すれば同じ保証は可能。], [DOM 推論では未検出を空と誤認し得る。必須条件に不適合。],
  [費用と変更], [builder、server 検査、plugin、client 対応が必要。内部 manifest は自動生成。], [専用 compiler 不要だが手書き table と selector の更新負担が続く。], [短い author code の代わりに専用解析または browser 再実行が必要。],
  [判定], [推奨。AC1〜AC7 を満たす契約と検証計画を示せる。], [成立するが、作者の重複記述と不一致を増やすため退ける。], [server authority と明示境界に不適合として退ける。],
)

A と B は author の記述量以外の必須行動を満たせる。
A の inline target も export 名の対応は残るが、表示構造と target を別ファイルの selector 表へ二重記述しない。
A は DOM builder の API、server/client runtime、plugin を実装する費用を受け入れる。
現行 prototype は ordinary export と一部 identity/cleanup の成立性を示すにとどまり、A の production graph、staging、fresh-response recovery、性能優位を実証しない。

== 共有状態と寿命

#table(
  columns: (1.3fr, 3.05fr, 3.05fr),
  table.header([状態], [入場と遷移], [資源と表示]),
  [unadmitted], [SSR response があり owner は無い。検証開始で preflighting へ。], [server DOM と不変 association のみ。],
  [preflighting], [identity、key、entry、値と root/host/control/target を取得前に照合。成功で staging、拒否で unadmitted。], [拒否は非終端。owner、Signal、listener、effect、timer はゼロで SSR は不変。外部の entry 読込などが回復した場合、同じ不変 association を再検証できる。],
  [staging], [単一 owner を予約し、state を復元、getter/effect/listener を取得。全部揃えば commit して active。取得または commit 失敗で failed-terminal。], [初期 DOM write は buffer。handler は commit まで inert。失敗時に全資源を逆順解放し SSR node/value を復元。],
  [active], [同一 identity の重複入場は同じ owner を返す。operation error は active のまま再操作可。], [宣言 target のみ書ける。effect、listener、timer、child、request generation は owner に登録。],
  [failed-terminal], [staging 後の失敗で入場。同じ identity は再試行不可。fresh response の新 identity で unadmitted から始める。], [資源はゼロ、SSR 表示を保持。新 response の取得、commit/cancel は #248/#249 が検証。],
  [disposed], [active owner 終了後。再入場不可。新 response は別 identity。], [child listener/effect と generation を止めてから任意 Store を dispose。繰返し cleanup は無作用。],
)

同一 identity への並行 admission は一つの予約へ集約する。
矛盾する payload、static key、target を伴う二番目の要求は拒否し、同じ owner を別 record へ流用しない。
preflight 拒否後も association は書き換えず、同じ identity に別 payload、別 target、別 static key を差し込まない。
元の association 自体が不正なら同じ identity の訂正はできず、server が新 response と新 identity を発行する必要がある。
child removal はその child の listener、effect、timer と generation だけを止め、兄弟 owner は生かす。
owner 終了後または古い generation の callback は state と DOM を変更しない。
既存 reactivity engine の Signal、effect、batch、root cleanup を使い、subscription/DOM/lifetime の統合は #raw("@dathra/client") に置く。
#raw("batch") を transaction rollback と見なさず、初期 getter の DOM write は #249 の staging 成立を要する。

#behavior_spec(
  name: "宣言から response への受渡し",
  summary: [author の初期 DOM と capability を server が response ごとの association へ変換する。],
  preconditions: [
    - build が route の明示 entry と client graph を検査している。
    - server は request と各 UI 出現の state を一度だけ生成する。
  ],
  steps: [
    1. server が #raw("view") の初期値を描画し、inline target と使われた client export を検査する。
    2. server が出現ごとに新 identity を発行し、静的 key、論理 state 値、root/host/control/target、entry を不変 record に結ぶ。
    3. response の capability 集合が空なら Dathra client bootstrap、handoff、marker、artifact reference を省く。
    4. capability があれば必要な entry と association のみを response に渡す。
  ],
  postconditions: [
    - 初期 DOM/state の authority は server response にある。
    - 同じ宣言の複数出現は別 identity と別 state を持つ。
  ],
  errors: [
    - unsupported value、欠落 export、重複 writer は response commit 前に診断する。
    - 不確かな graph を空 capability とみなさない。
  ],
)

#behavior_spec(
  name: "既存 SSR instance の入場",
  summary: [client は宣言済み権限だけを一 owner に接続し、SSR node を再構築しない。],
  preconditions: [
    - server artifact が response-local identity と完全な association を持つ。
    - client entry が build で確認済みである。
  ],
  steps: [
    1. preflight が identity、key、entry、値、root/host/control/target を取得前に照合する。
    2. 有効なら owner を一つ予約し、Signal、getter/effect、listener を staging owner に取得する。
    3. 初期 write を buffer し、取得成功時だけ commit する。
    4. active owner が宣言 target への更新、operation、明示 request と creation を処理する。
  ],
  postconditions: [
    - client は server initializer、setup、render、初期値取得を実行しない。
    - 重複入場は listener、effect、timer、Store を増やさない。
  ],
  errors: [
    - preflight 拒否は unadmitted に戻り、資源ゼロ、SSR 不変。同じ不変 association は外部前提の回復後に再検証できるが、payload/target/static key を変更した再試行は拒否する。
    - staging/commit 失敗は failed-terminal。全資源を解放し SSR を保ち、同 identity を再利用しない。
    - hydration、CSR rerender、暗黙 network fallback を行わない。
  ],
)

== scenario の比較と evidence

#table(
  columns: (1.55fr, 2.15fr, 2.15fr, 1.65fr),
  table.header([scenario], [A の結果], [B の結果], [根拠と未検証点]),
  [初期表示と activation], [Count 7 と Theme を server view で表示し、同じ node に getter/event を接続。], [registry の selector が正しければ同じ。], [#252 の期待と #253 契約。A/B の production path は未実装。],
  [二出現と反復更新], [一 static key から二 identity、二 owner。各 Count は独立して 7→8→9。], [二 registry record を正しく scope すれば同じ。], [#253/#260 の identity 契約。二出現の API 統合は未検証。],
  [欠落または矛盾した handoff], [root/host/control/target と値を preflight で拒否し SSR 不変。], [selector 不一致を同じ規則で拒否。], [#252 の silent default は不適合。public preflight は #249 未検証。],
  [重複入場], [予約を一 owner に集約し二重 listener を防ぐ。], [同じ owner 規則が必要。], [#253/#260 の共有契約。public path は #249 未検証。],
  [preflight 拒否], [unadmitted のまま資源ゼロ。外部前提が回復すれば同じ不変 association を再検証。変更された payload/target/key は拒否し、元の record が不正なら新 response identity を要する。], [同じ非終端規則。], [#260 採用契約。A/B とも実装証拠なし。],
  [取得後の失敗], [buffer を破棄、資源逆順解放、failed-terminal。fresh SSR identity で復旧。], [同じ transaction が必要。], [#253/#260 の設計契約。一般的 DOM rollback と新 response は #248/#249 未検証。],
  [child/owner disposal と late callback], [child の資源だけ停止。全終了では child 先行、古い generation を無視。], [同じ owner 規則。], [#252 の detached listener は baseline defect。#249 public path 未検証。],
  [zero-client-root], [client entry 無し route を build で省略し、空 response は script と handoff を送らない。], [空 registry の整合検査が必要。], [#245/#260 必須。#252 に control route 不在。#251 が実測。],
  [user-created UI と server request], [宣言 child boundary と request 名のみ許可。初期 SSR node は再構築しない。], [registry に child/request を二重登録する。], [#260 が別能力として採用。transport と child lifetime は #248/#249。],
)

選択肢 C は任意の JS/DOM から権限を推測しても成立範囲を証明できず、browser setup replay も #245 の禁止に当たるため、この同じ scenario の必須条件に不適合である。
A と B の表は観測済みの挙動ではなく、各方式を契約どおり実装した場合の推論である。
#252 の実測、#253 の限定 prototype、#260 の採用決定と未実装保証を分けて扱う。

== 後続 owner と gate

#table(
  columns: (0.7fr, 4.15fr, 2.55fr),
  table.header([owner], [残る詳細と成果物], [blocking status]),
  [#247], [本 API を採用後に shared 契約と environment facade、plugin の SPEC/tests を先行し実装する。], [設計を開始できる。採用済み SPEC/tests と実装は #248/#249 production 統合と #250 完了の gate。],
  [#248], [request-local renderer、identity 発行、association encoding、response commit/cancel、server request handler と fresh-response delivery。], [設計は並行可能。採用済み契約と public path は #249 復旧統合、#250 配信統合の gate。],
  [#249], [preflight/owner、初期 write staging と rollback、child UI、late callback、operation retry、Web Components host lifetime。], [設計は並行可能。public path の失敗/cleanup/復旧 test は #250 統合と #251 最終合否の gate。],
  [#250], [選定 route の新経路移行、旧 transformer/runtime/core root path の削除、docs と release guidance。], [計画は並行可能。#247〜#249 の slice 実装が移行完了の gate。],
  [#251], [二出現、zero-root、failure、resource と同 revision 性能の fixture と承認閾値。], [早期 fixture は可能。最終合否は #250 移行と閾値承認が gate。],
)

本 Proposal の必須 API、検証責務、zero-root、identity と状態境界は後続へ委譲しない。
後続が具体 encoding や runtime algorithm を選んでも、これらの外部契約を変える場合は #262 のレビューへ戻す。
open question は置かず、後続が所有する内容と完了 gate を上表で特定した。

#adr(
  header("最初の slice の inline target と明示 entry API", Status.Proposed, "2026-09-30"),
  [
    #253 と #260 は Plain JS/TS と権限分離を採用したが、作者が初期 DOM、state、entry と対象を具体的にどう書くかは #247 に残る。
    手書き registry は成り立つ一方、同じ DOM target と client export の対応を離れた表で重複管理する。
  ],
  [
    #raw("defineDelivery") の明示 server/client entry、server #raw("defineRoute") の #raw("view/state/values/requests")、#raw("el/txt") の inline #raw("bind/on/creation")、client の通常 export と #raw("ClientContext") を採用候補とする。
    build は graph、server は response、client は preflight でそれぞれ検査する。
    初期 DOM と値は server response の正本であり、client は既存 node に宣言済み権限だけを入場させる。
  ],
  [
    作者は initial DOM と target を同じ source 上で読める。
    API と graph/response/client validator の実装費用は #247〜#249 に発生する。
    現時点で production の成立や #251 の性能合格を主張しない。
  ],
  alternatives: [
    - 二つの手書き registry は成立するが、selector と key の二重保守を増やす。
    - 暗黙 capture と browser 再実行は #245/#253 の不変条件に反する。
  ],
)

== Issue #262 の要件 coverage

以下の一行は collector の一 candidate に対応する。
source は #raw("issue-body:#262") の見出しと行番号を保持した。
分類の #raw("interface/behavior/ownership/identity/lifetime/failure/resource/non-goal") は順に module interface and seam、observable behavior、execution ownership、identity and association、lifetime and cleanup、failure and diagnostic behavior、resource and artifact constraint、non-goal を指す。
#raw("Satisfied") は本文の対応を示し、ADR の Accepted や GitHub review の Accepted を意味しない。

#table(
  columns: (1.55fr, 1.55fr, 0.9fr, 3.5fr),
  table.header([source], [分類], [処置], [本文の対応]),
  [Decision to make:3], [interface], [Satisfied], [「提案する公開面」「creation と request」「Delivery」],
  [Context and evidence:7], [ownership], [Satisfied], [「入力と判断境界」「Delivery」],
  [Context and evidence:8], [behavior], [Satisfied], [「入力と判断境界」「scenario」],
  [Context and evidence:9], [resource], [Satisfied], [「Delivery」「共有状態と寿命」],
  [Context and evidence:10], [ownership], [Satisfied], [「creation と request」「後続 owner」],
  [Context and evidence:11], [interface], [Satisfied], [「提案する公開面」「option 比較」],
  [Options considered:15], [interface], [Satisfied], [「option 比較」A],
  [Options considered:16], [interface], [Satisfied], [「option 比較」B],
  [Options considered:17], [interface], [Rejected], [「option 比較」C],
  [Decision criteria:21], [behavior], [Satisfied], [「提案する公開面」「scenario」],
  [Decision criteria:22], [interface], [Satisfied], [「提案する公開面」「option 比較」],
  [Decision criteria:23], [failure], [Satisfied], [「検証と診断」],
  [Decision criteria:24], [identity], [Satisfied], [「Delivery」],
  [Decision criteria:25], [ownership], [Satisfied], [「Delivery」「後続 owner」],
  [Acceptance criteria:29], [interface], [Satisfied], [「提案する公開面」「creation と request」],
  [Acceptance criteria:30], [identity], [Satisfied], [「Delivery」],
  [Acceptance criteria:31], [failure], [Satisfied], [「検証と診断」],
  [Acceptance criteria:32], [interface], [Satisfied], [「option 比較」],
  [Acceptance criteria:33], [lifetime], [Satisfied], [「共有状態と寿命」「scenario」],
  [Acceptance criteria:34], [ownership], [Satisfied], [「後続 owner」],
  [Acceptance criteria:35], [resource], [Satisfied], [本書と PR の検証記録],
  [Dependencies:39], [ownership], [Satisfied], [「入力と判断境界」],
  [Dependencies:40], [ownership], [Satisfied], [「後続 owner」],
  [Non-goals:44], [non-goal], [Non-goal], [冒頭 Non-goals],
  [Non-goals:45], [non-goal], [Non-goal], [冒頭 Non-goals],
  [Non-goals:46], [non-goal], [Non-goal], [冒頭 Non-goals],
  [Non-goals:47], [non-goal], [Non-goal], [冒頭 Non-goals],
)
