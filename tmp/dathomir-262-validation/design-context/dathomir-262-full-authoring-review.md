# #262 作者 API の全体レビュー案

2026-10-05、コーディネーター/Astra 第2回レビュー対応。
対象は dathra/dathra #262 / Draft PR263、親 Epic #247。
本資料は指定された GPT-6.1 Sol high の design consultation の改訂である。
この文書は利用者レビュー用の一時資料であり、Proposal の採用、①の完了、実装開始を意味しない。

## 利用者が今回判断する範囲

合意済みの基本形を維持し、追加の行、入力、通信、寿命をどう記述するかを提案する。
既存 SSR は状態と DOM を復元して接続し、新しいブラウザ UI は別の生成定義で作る構成を推奨する。
Signal の判別方法は、以前の constructor provenance 案から変更した**未採用の再提案**である。
この変更を戻り値の詳細として自動承認されたものに扱わない。

今回採用対象になり得るのは、次表の「新提案」の構文と動作契約である。
「条件付き必須」はその機能を選ぶ場合に必要という意味で、基本カウンターに全部を書く意味ではない。
「任意」は省略してネイティブ HTML、親所有の状態などを使える。
合意済みの項目も、新しい実装が成立したことを示してはいない。

| 番号 | 公開 API / option | 目的と必要になる場面 | 合意からの差分と採用対象 |
|---|---|---|---|
| N01 | `server` / `template`、別 client module、flat `defineClient` | 初期処理と接続後処理を明示する。基本形に使用 | 利用者方向決定を維持。`bind/on` は全登録名を提示 |
| N02 | unified return、ordinary `signal`、`clientModule(specifier,import.meta.url)` | 値と client module を一度関連付ける。client 機能がある component に使用 | 方向決定を維持。構造プロトコルによる Signal 判別は別の未採用変更 |
| N03 | `bind(name,{server})` / `_key` | SSR 内容を持つ表示場所、通常の一覧の識別 | 方向決定を維持。kind/child option は追加しない |
| N04 | `fragment({_key},...)` | ラッパーなしの複数要素。任意 | 新提案。持続する範囲、空表示、移動の権限まで採用対象 |
| N05 | `el` の `_ref` / `_ns` / `props` / `defaults` / `mount` / `on` | control、namespace、property、初期 native draft、接続処理、イベント。各機能で使用 | `_key` 以外の record 詳細は新提案。通常 HTML 属性と区別 |
| N06 | `prop(name,{server,input:{sink,group?,conflict?}})` | controlled control の表示と明示的書き戻し。選択時必須 | 新提案。`conflict:"hold"`、native draft の接続時採用、IME/selection の保護を含む |
| N07 | `attr(name,{server})` / `id(local)` / `ctx.control(ref)` / `ctx.formData(ref)` | 属性、label/ARIA、focus、native submission data。必要な場合だけ使用 | 新提案。property と content を混同しない |
| N08 | `on(event,name,{capture,passive,once,preventDefault,channel,concurrency})` | 既知 target の操作。option は任意 | 全名補完は維持。option、snapshot、cancel、channel は新提案 |
| N09 | `defineCreatedComponent({client,input,initialize,view,receive?})` / `createComponent(def,{_key,input})` | 独自 state/lifetime を持つ新規 child。選択時必須 | 新提案。ordinary list に要求しない。`receive` は flat registry の名前 |
| N10 | `clientModule(...,{creation:"NewRow"})` / component `input:parser` | SSR child と browser creation/input operation の明示的許可。自律 child を SSR と対応させる場合に必須 | 第2回で追加した未採用差分。公開 export、parser、receiver、seed input を不変の関連に記録 |
| N11 | `mount(name,{channel,concurrency})` / `ctx.onDispose` / `ctx.timeout` / `ctx.abortSignal` / `ctx.guard` / `ctx.isCurrent` | custom resource と遅延処理の寿命。必要な resource で使用 | 新提案。Promise 完了と resource lease 終了を分ける |
| N12 | `ctx.emit(name,DTO)` / `ctx.received` | 独立 child の明示的入出力。必要時使用 | 新提案。親の Signal 共有、child slot の直接アクセスは許可しない |
| N13 | `requests:{name:request({input,output,handle})}` / `ctx.request` | DTO による server operation。native form を選ぶ場合は不要 | 新提案。実際の validator/authentication、channel、idempotency の責任を含む |
| N14 | `deliveries:{name:delivery({input,render})}` / `ctx.deliver` / `retain()` | 宣言場所へ新しい server UI を届ける。選択時使用 | 新提案。destination を検証してから source を終了 |
| N15 | `history:{onPop,channel,concurrency}` / delivery `history:{url,mode,data}` / `ctx.navigation` | 明示的 enhanced navigation。任意 | 新提案。Back の draft 保持はアプリ方針。disposed identity は復活させない |
| N16 | `onError:"name"` / `ctx.error` / `ctx.refresh(name)` | 接続後の失敗表示と回復。任意の app reporting | 新提案。範囲の破損と初期 admission failure を区別 |
| N17 | `ClientContext<V,R,D,I>` / `RequestContract<Input,Output>` / `ctx.ui/event/input/values` | TypeScript の文脈と role access、JS runtime guard | 新提案の型詳細。型を runtime 権限や retroactive inference と扱わない |
| N18 | `await Component(input,request,{_key?})` / optional third `template` argument `request` | request を明示して child SSR を待つ。非同期 component で使用 | 第1回の lazy call を撤回した新提案。過去の awaited 案も採用済みとはしない |
| N19 | `defineRoute({render})` / `defineDelivery({routes:{url:{server}}})` | route/build entry を登録 | canonical の facade/render 形を保持。client map から `clientModule` の収集へ移す部分は新提案 |

採用候補はこれらの作者契約であり、全 browser、すべての widget、performance threshold の保証ではない。
wire bytes、marker 実装、scheduler の内部構造は担当 Issue の実装検証に残る。
ただし、その内部詳細を理由に未決の作者契約を隠さない。

## 根拠と変更の位置付け

最新の利用者メモを旧 scratch より優先した。
参照 worktree の HEAD は `0ad07bffd601fef7cd708276942b187883ea787e`。
[独立 coverage](/tmp/dathomir-262-full-review-coverage.md) が確認した PR259/261 の merge record と Accepted の意味を再利用する。
参照 branch の旧 Proposed 表記だけで Accepted 判断を再開しない。
canonical #262、Accepted #253/#260、#247–#251、最新メモ、独立 coverage を読んだ。
旧 `/tmp/dathomir-usecase-candidates-sol61.md` は存在せず、元の七つの圧力 F/C/B/D/M/T/L は保持された会話から復元した。
`session-ses_f959.md` から元の②以降の見出しは回収できなかったため、以下の章番号は今回の整理である。

| 対象 | canonical/前案 | 今回の推奨と理由 | 状態 |
|---|---|---|---|
| import facade | #262 は `@dathra/core/server`、Accepted #260 は core facade と物理 server/client sibling を併存 | 作者例を `core/server` と `core/client` に戻す。物理 package 分割は維持 | facade は根拠あり。正確な export の実装は未検証 |
| route | #262 `defineRoute({render(request)})` | `render` を保持。route に `path/server` を追加しない。URL は delivery registration で指定 | 第1回の変更を撤回 |
| component invocation | canonical は occurrence、後の scratch は awaited 案、第1回は lazy 案 | `await Component(input,request,options)` を新提案として選ぶ。非同期 server と明示 request を追いやすい | 未採用。old invocation の採用扱いを訂正 |
| nested template | 二引数 `template(values,{bind,on})` | 二引数を保持し、child SSR が必要なら optional third `request` を受け取る | 新提案。引数の追加を利用者が判断 |
| build | 手書き `clients` map | `routes.server` entry は保持し、到達する明示的 `clientModule` 参照を catalog に集める | client map の削減は新提案。任意 JS の動作推論ではない |
| Signal 判別 | private WeakSet に登録する `isSignal` を以前推奨 | trusted native-shaped protocol を再提案。通常 constructor は維持 | 意味のある未採用変更。1.1 の scope 分岐を参照 |

表記：**利用者方向決定**は最新会話で選ばれた形、**Accepted**は #253/#260 の共有契約、**新提案**は今回の判断候補、**未検証**は実装による証明がないことを示す。
Proposal/GitHub/production を更新していない。

## 1. 一つの戻り値と module の対応

### 1.1 Signal 判別の未採用変更

[以前の案](/tmp/dathomir-262-section1-return-and-client-link.md) は engine の constructor が作った object を private WeakSet に登録し、`isSignal` で確認する案を推奨した。
これは現在存在しない provenance 機構を追加する提案だった。
最新メモは ordinary `signal` と unified return を方向決定したが、この private mechanism の採用や弱化を決定していない。

制約の根拠は [#247 Non-goals](https://github.com/dathra/dathra/issues/247) の「`@dathra/reactivity` のengine内部を変更すること」と、Accepted #260 の reactivity 維持範囲である。
[#260 の source](/home/kcatt/dev/dathomir-proposal-262-authoring-api/SPEC/proposals/245/260/260.typ:120) の 120–122 行は既存 observable semantics を維持し、restoration/admission を engine 外へ置く。
[同じ source の326行](/home/kcatt/dev/dathomir-proposal-262-authoring-api/SPEC/proposals/245/260/260.typ:326) も「reactivity engine は保持し、復元・admission・DOM binding・寿命は client integration layer に置く」とする。
これは公開 predicate の追加を論理的に不可能とする文言ではない。
しかし以前の WeakSet 案は constructor 内への登録追加が必要なので、現在の #247 scope のまま実施できるとは扱えない。

今回は ordinary constructor を変えず、**信頼する作者コードの公開構造プロトコル**を判別に使う案を推奨する。
private provenance の代替保証ではない。
完全な protocol を偽装した作者 object と native Signal を区別できなくなる、未採用の弱い契約である。
名目的な真正性が必要なら、コーディネーターが engine predicate の別 scope を承認する分岐を選ぶ。
Accepted の意味変更が必要になる場合は supersession に戻し、この資料で書き換えない。

判別結果は次の一つの手順で決める。

1. own property descriptor を調べる。判別時に `.value` getter や `.peek()` を呼ばない。
2. plain/null-prototype object で、own data property `__type__ === "signal"`、setter のない own `value` getter、own callable data property `set/peek` を全部持つ場合だけ protocol Signal とする。
3. その場合は信頼した `peek` を一度呼び、結果を transfer domain として検証する。同じ object の alias は一つの slot capture にする。throw は response publication 前の診断にする。
4. それ以外は通常 data として検証する。`{__type__:"signal",value:7}` は常に readonly 通常 record。tag だけで error や slot にしない。accessor/function を含む通常 record は通常 data 規則の error にし、判別のため実行しない。

| 入力 | 決定的な結果と限界 |
|---|---|
| 現在の ordinary Signal | protocol に一致し、論理値を capture。browser では選択した native engine に復元 |
| 同じ engine の別 bundle copy | 同じ protocol なら受け入れる。private registry の同一性を保証しない。capture object alias と browser engine instance は別概念 |
| plain tag-bearing record | readonly data。method/accessor があれば通常 data 検証で拒否 |
| third-party/computed | 別 tag/class/prototype/shape は自動 slot 化しない。DTO か明示 adapter を使う |
| third-party が full protocol を実装/偽装 | 区別不能なので slot として扱う。native provenance、同等の副作用、安全な peek を証明しない |
| Proxy/悪意ある作者コード | descriptor inspection 自体の trap や peek の副作用を sandbox できない。外部 input は validator を通した data のみとし、この信頼境界へ直接渡さない |

既存 Signal SPEC は `value/set/peek/__type__` を規定し、実装は own getter/method を返す。
これは構造案の入力適合の根拠であり、private authenticity の根拠ではない。
今後の duplicate engine、false protocol、capture throw、adapter について実装証拠が必要である。

### 1.2 readonly record と snapshot

通常の record/array を readonly にし、Signal だけを browser-local な可変 slot に復元する。
同 owner の Signal alias は同じ slot とし、異なる owner への偶然の alias は両方の宣言位置を示して拒否する。
plain heap 全体の object identity は約束しない。
Signal の payload も readonly data とし、通知には `.set({...})` を使う。

transfer domain は finite JSON-like own data と protocol Signal である。
循環、accessor、function、class、undefined、sparse array、Symbol key/value、非有限値を path 付きで診断する。
Date や domain model は DTO/明示 adapter へ変換する。
File は native form/browser transport で扱い、SSR graph に保存しない。

`server` 解決後に一度 capture し、`template` と handoff は同じ immutable snapshot view を読む。
server が後で Signal を更新しても DOM 7 と handoff 8 に分裂させない。
native draft を browser の provisional slot に採用しても、元の immutable association の payload は変更しない。

### 1.3 型と runtime association

`defineClient` は flat object の名前を保持する。
別途宣言した function の未注釈 parameter を後から推論できるとは扱わない。
独立した prepare function の type-only import、または共有 public value type で `ClientContext` を明示する。
完成した server component の型を client が参照すると循環し得るため、prepare/value type を分ける。

`bind/on` は全登録名を補完する。
getter/operation 別の型候補に戻さない。
read invocation の `.set`、適用外の `ctx.input/received/event`、不正な結果は runtime 診断にする。
型は pure function、module path の一致、runtime capability を証明しない。

`clientModule` は inert reference を作る。
server は client module を value import/実行しない。
build は literal reference と type witness を解決し、通常 browser build と manifest を作る。
生成 wrapper が実際の module export object に code identity を付ける方法は、内部 build 責務である。
function extraction、tree shaking による server 秘密除去、closure serialization は使わない。
デプロイ後の `import.meta.url` と source の相対参照を混同しないよう relocation が必要である。

### 1.4 カウンターの完全な作者例

以下は提案 API の source sketch であり、実行/型推論を実証した code ではない。
二つの counter は同じ module を使い、別の response identity/state を持つ。
canonical primary consumer の Theme snapshot-midnight、Count 7→8 と、plain title の readonly handoff を一緒に示す。
review 用 route は実 consumer の移行や観測結果を主張しない。
```ts
// counter.values.server.ts
import { signal } from "@dathra/reactivity";

function prepareCounter(input: { start: number; title: string }) {
  return { count: signal(input.start), theme: signal("snapshot-midnight"), title: input.title };
}

export { prepareCounter };
```

```ts
// counter.client.ts
import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { prepareCounter } from "./counter.values.server.js";

type Values = Awaited<ReturnType<typeof prepareCounter>>;

function countText(ctx: ClientContext<Values>) {
  return `${ctx.values.title}: ${ctx.values.count.value}`;
}

function themeText(ctx: ClientContext<Values>) { return ctx.values.theme.value; }

function increment(ctx: ClientContext<Values>) {
  ctx.values.count.set(previous => previous + 1);
}

export default defineClient({ countText, increment, themeText });
```

```ts
// counter.server.ts
import { clientModule, defineComponent } from "@dathra/core/server";
import { el } from "@dathra/core/server";
import type CounterClient from "./counter.client.js";
import { prepareCounter } from "./counter.values.server.js";

const Counter = defineComponent({
  client: clientModule<typeof CounterClient>("./counter.client.js", import.meta.url),
  server: prepareCounter,
  template(values, { bind, on }) {
    return el("section", {},
      el("p", {}, bind("themeText", { server: values.theme.value })),
      el("p", {}, bind("countText", {
        server: `${values.title}: ${values.count.value}`,
      })),
      el("button", { type: "button", on: [on("click", "increment")] }, "+1"),
    );
  },
});

export { Counter };
```

```ts
// counter-route.server.ts
import { defineRoute, el } from "@dathra/core/server";
import { Counter } from "./counter.server.js";
const route = defineRoute({
  async render(request) {
    return el("main", {},
      await Counter({ start: 7, title: "Count" }, request),
      await Counter({ start: 40, title: "Other count" }, request));
  },
});
export default route;
```


### 1.5 build と route registration

作者 entry は次の明示的登録を使う。
`defineRoute` は URL 登録を行わず、request の `render` を提供する。
adapter は対応する route を選び、その `render(request)` を待つ。
component call も同じ request を明示して待ち、child identity/未公開 resource を request scope に記録する。
awaited component call と async `template` は今回の未採用契約である。


```ts
// dathra.config.ts
import { defineDelivery } from "@dathra/plugin";
export default defineDelivery({
  routes: {
    "/counter-review": { server: "./counter-route.server.ts" },
    "/row-review": { server: "./list-route.server.ts" },
    "/directory": { server: "./directory-route.server.ts" },
    "/article": { server: "./article-route.server.ts" },
    "/static": { server: "./static-route.server.ts" },
  },
});
```

`routes/server` 登録は canonical の形を保持する。
手書き `clients` map をなくし、到達する明示的 `clientModule` を収集する部分は新提案である。
module graph の可能な catalog と実際の response capability を区別する。
不明な参照を zero とみなさず、response が zero なら activation 用 code/data を送らない。
server-only entry が client reference を宣言しなければ、その route の client entry も選択しない。
未使用の別 route artifact/cache の削除までは求めない。

```text
route -> core/server -> physical server + components/server
client -> core/client -> physical client + components/client
server/client -> narrow shared + reactivity (+ optional store)
counter.server -- type-only --> counter.client
counter.client -- type-only --> prepareCounter
build index -> explicit clientModule -> actual browser exports/manifest
```

metadata index は callback 本体を抽出/実行せず、明示参照と export の対応を記録する。
間接/動的な参照を照合できなければ、未検証のリンクとして診断し、明示 inventory を求める。
server initializer の実行で browser graph を推測しない。


### 1.6 表示式の重複をどう減らすか

小さな counter は初期表示と client getter に短い式を二度書ける。
localization や金額の計算が複雑なら、次の neutral formatter を両 module から import する形を推奨する。
server/client runtime と初期 template は共有しない。

```ts
// counter.format.ts; ordinary shared application code, no server/client runtime imports.
function formatCounter(title: string, count: number) { return `${title}: ${count}`; }
export { formatCounter };
```


| 案 | 作者の費用と選択理由 |
|---|---|
| 短い式を二度書く | 小例では最小。表現のずれをレビューする |
| neutral pure formatter | 計算を一か所にする。非自明な表示に推奨。browser graph へ server dependency が入らないか検証 |
| initialLabel を返す | SSR 用表示として有用。ただし plain label は readonly なので更新計算は別に必要 |
| formatted Signal を追加 | 独立して変える表示なら有用。重複回避だけのために同期対象 slot を増やさない |
| initial template の共有 | 利用者が拒否した案。formatter 再利用と区別し、採用しない |

### 1.7 SSR 接続と最初の表示更新

既存 DOM/state を検証して接続し、成功した admission commit の後、一度 client 結果を自動反映する方向を維持する。
同じ内容なら不要な書き込みを避け、異なる内容なら宣言範囲へ反映する。
たとえば SSR `Count: 7` と意図した client `Count = 7` は、接続後にその text extent だけを変更する。
クリック待ちや initial template replay にしない。

admission に必要な producer/resource/commit の失敗を「後の refresh」に移して terminality を回避しない。
接続後の refresh failure は別の active failure として扱う。
controlled property の native edit 保護は後述の新提案であり、content bind の自動更新を取り消すものではない。


## 2. 表示と input の契約

### 2.1 bind の結果と純粋な記述

`bind(name,{server})` は actual SSR 内容を持つ持続する表示範囲である。
string は escaped text、`null/[]` は空、element/fragment/array/許可された child intent は構造を表す。
text と DOM を相互に変更でき、kind/child option や永久カテゴリを要求しない。
Promise、raw HTML、live Node、arbitrary object を無条件に表示結果へしない。
非同期処理は owned model を更新し、native widget は明示した範囲/adapter/disposer を使う。

`el` は純粋な記述を返し、評価時に DOM/listener/Signal を作らない。
通常属性と `_key/_ref/_ns/on/props/defaults/mount` metadata を分ける。
新 browser child の view では `bind(name)` と `prop(name,{input})` を使い、存在しない SSR/default を名乗らない。
その child の initial state から最初の結果を用意して公開する。

### 2.2 property とイベントの明示

content は bind、live property は prop、reflected attribute は attr として役割を分ける。
getter から setter を推測しない。
以下は宣言済み values/tools を使う form パターンで、全 module を実装した証拠ではない。

```ts
// Same shape in an SSR template; ctx.ui supplies typed tools in a result producer.
const { prop, attr, on, id } = tools;
return el("div", {},
  el("label", { for: id("email") }, "Email"),
  el("input", {
    id: id("email"), _ref: "email", name: "email", type: "email", required: true,
    "aria-describedby": id("email-error"),
    "aria-invalid": attr("invalid", { server: false }),
    props: { value: prop("draftText", {
      server: values.draft.value,
      input: { sink: "setDraft", group: "email-draft", conflict: "hold" },
    }) },
  }),
  el("p", { id: id("email-error"), "aria-live": "polite" },
    bind("errorText", { server: "" })),
  el("button", { type: "submit" }, "Save"),
);
```


input の sink は flat registry の名前である。
prop が input/change/composition/reset の同期 resource を所有し、同じ sink のため on を二度書かせない。
`on` は別の操作や submit を対象にし、preventDefault は同期的に行う。
passive と preventDefault の矛盾を宣言時に診断する。

`ctx.event` は宣言済み current control の snapshot、`ctx.input` は sink 用 native capture、`ctx.received` は child input DTO である。
`event.target` の形から権限を推測しない。
async 前に必要な値を読んで保存する。
`id(local)` は instance ごとの HTML ID/reference、`_ref` は既知 control、`ctx.control(ref).focus()` は許可済み focus 操作を表す。

### 2.3 native draft を採用する transaction

1. preflight は immutable association、property/group/sink と live control を読み、資源を作らない。
2. staging は provisional restored slots と capture listener を作る。登録直後に native value を再読し、preflight 後の変更を回収する。
3. sink は provisional model-only context で実行する。request、emit、focus、timer、resource 登録を許可しない。直接の global side effect は sandbox/rollback 保証の外である。
4. commit 直前に capture revision/live property を再照合し、最新 draft を再適用する。安定しない場合は無限 retry をせず admission failure にする。具体的な内部 work quota は #249 の gate。
5. commit 後の初回 property 更新も最新 native revision と model を照合する。後から来た edit を古い結果で上書きしない。同値なら assign しない。

group に一つの changed native value、または同じ changed value が複数ある場合はその値を採る。
異なる draft が複数ある場合は `conflict:"hold"` とし、それぞれの native value を保持して property 書き込みを停止し、解決を表示する。
未知の過去 timestamp で勝者を選ばない。
次の明示 edit または app merge 操作が sink を通して解決する。
一つの model を表示する複数 control でも setter/group の関連は作者が指定する。

failed admission は provisional model を捨て、元の SSR node とその時点の native edit を保存する。
server default へ control を戻す rollback ではない。
acquisition 後 failure は terminal で fresh response が必要である。
immutable snapshot/target を訂正して同じ identity を retry しない。

### 2.4 bootstrap 前の composition の観測限界

value の差から「IME 変換中だった」と判定しない。
接続前に compositionstart が終わったかどうかは、現在値だけでは回収できない。
推奨する安全規則は、接続時の native draft を常に取り込み、editing/composition の状態が不明な editable control へ初回の異なる整形値を assign しないことである。
focus/selection を信頼して読めない host では unknown のまま保持する。

新しく観測した compositionend、blur、native commit 境界で adapter が確定した後に保留を解く。
普通の文字入力は native draft と同じ model 値を反映するので同値書き込みになり、日常入力を停止しない。
external update/formatter が異なる値を要求する場合は pending/conflict を表示し、blur/明示 commit まで保留する。
これは編集を保護する observable policy であり、過去の IME 履歴を知る保証ではない。
無期限に保留し得る破損 host/不明 adapter は状態と解決手段を診断する。
content bind は通常どおり更新する。

### 2.5 caret、reset、selection、accessibility

同値 assign を避け、compatible node を保持する。
文字列の強制整形は blur/submit を基本とし、毎キー整形を選ぶ場合は明示した caret mapping の証拠を必要とする。
remote change が dirty/composing draft と競合したら app state に pending/version を残し、勝手に上書きしない。

uncanceled native reset の後、default を `ctx.input.reason="reset"` の sink で model へ同期する。
native-owned draft は `defaults` と FormData で扱い、毎 keystroke を Signal に通す必要はない。
numeric draft は string にし、空や途中の小数を許す。
checked/selection は専用 adapter で扱う。
`selectedValues` は semantic adapter port であり、存在しない native writable property の説明ではない。
radio group は選択値と既知 membership を扱い、bool の二値だけで衝突判定しない。

label/ARIA の関連、error text、keyboard focus、live region を別々に検証する。
_key 保持は caret/IME/Web Component callback の証明にならない。
native validation、name、disabled、submitter、multipart/File は explicit interception なしで使える。


## 3. child の identity、許可と収束

### 3.1 key、fragment と matching

_key は一つの owner/range/sibling collection 内の finite string/number とし、型違いの `1` と `"1"` を区別する。
duplicate key は write 前の plan error とする。
compatible kind/tag/namespace/behavior/creation identity なら node/lifetime を保持する。
変更された tag/namespace/independent behavior はその entry を交換する。
listener 名だけの変更は compatible element の owned listener を更新する。
SSR admission mismatch の補修として browser child を作り直さない。

unkeyed entry は対応する keyed anchor 間の gap 内で ordinal matching する。
keyed anchor を越えて control/state を流用しない。
anchor が消えた unmatched gap は保守的に交換し、stateful reorder には明示 key を推奨する。

fragment({_key},...) は wrapperless な持続範囲とする新提案である。
DocumentFragment object の挿入後の空化を lifetime と混同しない。
空 bind/fragment は更新 capability を保持し、component の除去が lifetime を終了する。
独立 child の interior は opaque、outer movement/removal は明示 containment の範囲に限定する。
composing entry の並べ替えは完了境界まで保留する。
実際の focus/connected host の維持は adapter の証拠が必要である。

### 3.2 SSR child の明示的 creation 許可

同じ flat default object だけでは、複数の creation definitions から安全に選べない。
今回 `clientModule(...,{creation:"NewRow"})` を追加する新提案を選ぶ。
これは reusable server component に一度書く association option であり、occurrence の client string や bind の child tag ではない。

build/response の推奨契約は次のとおりである。

- 選択した module の default と named creation export を実際の export identity へ結び、build/module/export version を含む code reference を作る。
- manifest は creation definition、actual flat client default、registered receiver name、input parser の code reference を記録する。literal/reference/export を照合できない場合は明示 inventory を要求し、推測で認可しない。
- server component の `input:parser` と creation の parser が同じ許可済み code reference であることを照合する。server はその public input を正規化/凍結し、initial input seed を association に含める。任意の server arguments を暗黙に全部転送しない。
- SSR association は default identity、allowed creation identity、receiver/parser reference、seed input、初期 slot/targets/containment を immutable に記録する。
- browser loader は actual named export を読み、登録された definition identity、actual default、receiver/parser reference を照合する。parent から任意 callback/別 parser を渡して child slot を開かない。

compatible SSR child への最初の intent は許可済み metadata を active ledger に照合保存するだけである。
新しい受信権限をあとから追加したり、immutable snapshot/targets を変更したりしない。
同じ default に別の creation export があっても、既存 SSR child の保持/receive adapter として許可済み export 以外を取り付けようとすれば拒否する。
一方、成功した親 active update が別の許可済み catalog factory を明示して incompatible entry を交換する場合は、旧 child を終了して fresh browser child を作る。
これは旧 association の変更や failed admission の補修ではなく、3.1 の明示的 active replacement である。
active な browser-created child の creation identity を変更する場合は古い child を終了し、新 token の別 child として作る。

parent の bind はその範囲で許可された structural result を出すが、child の slot にアクセスしない。
new child の factory も selected browser graph の明示 catalog にある definition だけを許可する。
これは compiler/function extraction を要求せず、普通の module export と index/wrapper/manifest を必要とする新契約である。
実装証明がないことと、許可ルールを未定にすることは区別する。

```ts
// row.types.ts
import type { Signal } from "@dathra/reactivity";

type RowInput = { itemId: string; label: string };
type RowValues = {
  itemId: string;
  incoming: Signal<string>;
  draft: Signal<string>;
  dirty: Signal<boolean>;
};

function parseRowInput(value: unknown): RowInput {
  if (typeof value !== "object" || value === null ||
      !("itemId" in value) || typeof value.itemId !== "string" ||
      !("label" in value) || typeof value.label !== "string") {
    throw new Error("Expected row itemId and label");
  }
  return { itemId: value.itemId, label: value.label };
}
export type { RowInput, RowValues };
export { parseRowInput };
```

```ts
// row.client.ts
import { defineClient, defineCreatedComponent } from "@dathra/core/client";
import { signal } from "@dathra/reactivity";
import { el } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import { parseRowInput } from "./row.types.js";
import type { RowInput, RowValues } from "./row.types.js";

type RowContext = ClientContext<RowValues, {}, {}, RowInput>;

function draftText(ctx: RowContext) { return ctx.values.draft.value; }
function dirtyText(ctx: RowContext) {
  return ctx.values.dirty.value ? "Unsaved" : "";
}
function setDraft(ctx: RowContext) {
  ctx.values.draft.set(ctx.input.value);
  ctx.values.dirty.set(ctx.input.reason === "reset" ? false : true);
}
function remove(ctx: RowContext) {
  ctx.emit("row-remove", { itemId: ctx.values.itemId });
}

function receiveRow(ctx: RowContext) {
  const input = ctx.received;
  if (input.itemId !== ctx.values.itemId) throw new Error("Row item identity changed");
  ctx.values.incoming.set(input.label);
  if (!ctx.values.dirty.value) ctx.values.draft.set(input.label);
}
const RowClient = defineClient({ draftText, dirtyText, setDraft, remove, receiveRow });

const NewRow = defineCreatedComponent({
  client: RowClient,
  input: parseRowInput,
  initialize(input: RowInput): RowValues {
    return {
      itemId: input.itemId,
      incoming: signal(input.label),
      draft: signal(input.label),
      dirty: signal(false),
    };
  },
  receive: "receiveRow",
  view(values, { bind, prop, on, id }) {
    return el("li", {},
      el("label", { for: id("draft") }, "Row label"),
      el("input", {
        id: id("draft"), _ref: "draft", name: "label", type: "text",
        props: { value: prop("draftText", { input: { sink: "setDraft" } }) },
      }),
      el("span", { "aria-live": "polite" }, bind("dirtyText")),
      el("button", { type: "button", on: [on("click", "remove")] }, "Remove"),
    );
  },
});

export { NewRow };
export default RowClient;
```

```ts
// row.server.ts
import { clientModule, defineComponent } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { el } from "@dathra/core/server";
import type RowClient from "./row.client.js";
import { parseRowInput } from "./row.types.js";
import type { RowInput, RowValues } from "./row.types.js";

const Row = defineComponent({
  client: clientModule<typeof RowClient>("./row.client.js", import.meta.url, {
    creation: "NewRow",
  }),
  input: parseRowInput,
  server(input: RowInput): RowValues {
    return {
      itemId: input.itemId, incoming: signal(input.label),
      draft: signal(input.label), dirty: signal(false),
    };
  },
  template(values, { bind, prop, on, id }) {
    return el("li", {},
      el("label", { for: id("draft") }, "Row label"),
      el("input", {
        id: id("draft"), _ref: "draft", name: "label", type: "text",
        props: { value: prop("draftText", {
          server: values.draft.value, input: { sink: "setDraft" },
        }) },
      }),
      el("span", { "aria-live": "polite" }, bind("dirtyText", { server: "" })),
      el("button", { type: "button", on: [on("click", "remove")] }, "Remove"),
    );
  },
});

export { Row };
```


server の template と browser の new-only view は別に置く。
SSR の既存 child は snapshot の local slots を復元し、initialize/view/server template を実行しない。
new-only child は validated input を使って provisional lifetime 内で一度 initialize/view し、結果/graph/resources を検証して公開する。
同じ key の再評価だけでは初期化しない。

### 3.3 receive の収束規則

receiver は `receive:"receiveRow"` のように flat registry の function を選ぶ。
receive は同期的な model-only operation とし、readonly `ctx.received` と child-owned Signal の読み書きだけを使う。
Promise、emit、request、resource/timer/focus をこの phase に許可しない。
追加の async validation は別の明示操作/channel/resource で行う。
受信を user input として再送する自動 echo を作らない。

比較は object identity ではなく、parser 後の finite data の値で行う。
record は field order を無視し、array は順序を含め、primitive を比較する。
Signal、function、live object を input としない。
新 object を毎回返しても同値なら receive を実行しない。

- SSR は immutable initial input seed を baseline とする。最初の client intent が同値なら receive はゼロ回。異なれば child 自身の commit 後に一回。
- new child は initialize した input を baseline とし、同じ input のため receive を直後に二度呼ばない。
- parent producer の依存追跡が閉じ、その result generation の publication が成功してから receive queue を実行する。child の読みを parent subscription に混ぜない。
- `(parent/child lifetime, creation identity, parent result generation, input sequence)` を照合し、古い pending intent は実行前に捨てる。最新に coalesce する。child commit 前の input は保存し、child 自身の commit 後、最初の binding flush に先立って最新 changed input を一回受ける。旧 immutable input seed は変えない。
- successful receive の後だけ applied input を更新する。failure は last attempt を記録して同一 input の自動再実行を止め、変化した input または明示 ctx.refresh で再試行する。既に変わった Signal を rollback したとは言わない。

| trace | 実行と結果 |
|---|---|
| SSR seed `{itemId:"a",label:"Alpha"}`、最初の新 object も同値 | receive 0。restore だけ。native dirty draft も保持 |
| parent getter 再評価で同じ Alpha | receive 0。duplication effects/messages なし |
| parent label が Beta | queue 後 receive 1。incoming=Beta。dirty=false なら draft も更新 |
| dirty draft が日本語編集中 | receive 1 でも draft を保持。pending/conflict は app が表示 |
| Beta が pending の間に Gamma | Beta を捨て Gamma 1。disposed/replaced child への両 input は捨てる |
| receiver が parent へ emit/async echo を要求 | phase error。親 normalization/明示 user operation に移す |

書き込みで child binding が再計算されても、ordinary property assign は user input event を発生させない契約とする。
custom resource が別経路で upward feedback を作る場合は、同値更新の抑止と因果 queue の cycle 診断が必要である。
同一受信への再入は queue に退避し、同じ input の再到達を抑止する。
同じ因果 turn の input/message trace が Beta→Alpha→Beta のように過去の正規化値へ戻れば、該当辺を cycle として停止して診断し、最後の committed display を残す。
単純な同値更新は先に no-op として省略する。
新しい user/source event は別の因果 turn とし、parallel sibling を旧 turn と誤って停止しない。
単調に増え続ける arbitrary JS を完全判定できるとは言わず、scheduler の bounded work quota で停止させる。
値や production threshold はここで捏造せず、#249 が loop/再入/cleanup tests とともに内部 budget を決定する。
queue budget は framework が scheduling する反復を対象とし、callback body 内の無限 loop を止める JavaScript sandbox ではない。
これは batch が loop を消す保証ではない。
通常の Row 例は receive が model だけを更新し、remove/commit は明示 user event だけなので feedback を作らない。

```ts
// list.types.ts
import type { Signal } from "@dathra/reactivity";
import type { RowInput } from "./row.types.js";
type ListValues = {
  rows: Signal<readonly RowInput[]>;
  showRows: Signal<boolean>;
};
export type { ListValues };
```

```ts
// list.client.ts
import { createComponent, defineClient } from "@dathra/core/client";
import { el } from "@dathra/core/client";
import { NewRow } from "./row.client.js";
import type { ClientContext } from "@dathra/core/client";
import type { ListValues } from "./list.types.js";

function rows(ctx: ClientContext<ListValues>) {
  if (!ctx.values.showRows.value) return [];
  return ctx.values.rows.value.map(item =>
    createComponent(NewRow, { _key: item.itemId, input: item }));
}
function summary(ctx: ClientContext<ListValues>) {
  return ctx.values.showRows.value
    ? el("strong", {}, `${ctx.values.rows.value.length} rows`)
    : "Rows hidden; press Toggle to show";
}
function add(ctx: ClientContext<ListValues>) {
  const itemId = crypto.randomUUID();
  ctx.values.rows.set(previous => [...previous, { itemId, label: "New row" }]);
}
function reverse(ctx: ClientContext<ListValues>) {
  ctx.values.rows.set(previous => [...previous].reverse());
}
function update(ctx: ClientContext<ListValues>) {
  ctx.values.rows.set(previous => previous.map((item, index) =>
    index === 0 ? { ...item, label: `${item.label}!` } : item));
}
function remove(ctx: ClientContext<ListValues>) {
  const detail: unknown = ctx.event.detail;
  if (typeof detail !== "object" || detail === null ||
      !("itemId" in detail) || typeof detail.itemId !== "string") {
    throw new Error("row-remove requires itemId");
  }
  const itemId = detail.itemId;
  ctx.values.rows.set(previous => previous.filter(item => item.itemId !== itemId));
}
function toggle(ctx: ClientContext<ListValues>) {
  ctx.values.showRows.set(previous => !previous);
}
export default defineClient({ rows, summary, add, reverse, update, remove, toggle });
```

```ts
// list.server.ts
import { clientModule, defineComponent } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { el } from "@dathra/core/server";
import type ListClient from "./list.client.js";
import type { ListValues } from "./list.types.js";
import type { RowInput } from "./row.types.js";
import { Row } from "./row.server.js";

const List = defineComponent({
  client: clientModule<typeof ListClient>("./list.client.js", import.meta.url),
  server(_input: Record<string, never>): ListValues {
    return {
      rows: signal<readonly RowInput[]>([{ itemId: "a", label: "Alpha" }, { itemId: "b", label: "Beta" }]),
      showRows: signal(true),
    };
  },
  async template(values, { bind, on }, request) {
    const serverRows = await Promise.all(values.rows.value.map(item =>
      Row(item, request, { _key: item.itemId })));
    return el("section", {},
      el("p", {}, bind("summary", { server: `${values.rows.value.length} rows` })),
      el("ul", { on: [on("row-remove", "remove")] }, bind("rows", {
        server: serverRows,
      })),
      el("button", { type: "button", on: [on("click", "add")] }, "Add"),
      el("button", { type: "button", on: [on("click", "reverse")] }, "Reverse"),
      el("button", { type: "button", on: [on("click", "update")] }, "Update first label"),
      el("button", { type: "button", on: [on("click", "toggle")] }, "Toggle"),
    );
  },
});
export { List };
```

```ts
// list-route.server.ts
import { defineRoute, el } from "@dathra/core/server";
import { List } from "./list.server.js";
const route = defineRoute({
  async render(request) {
    return el("main", {}, await List({}, request), await List({}, request));
  },
});
export default route;
```


summary は SSR text → strong DOM → text、rows は非空 SSR → empty → new children を同じ public bind で表す。
既存 a/b は recorded key/extent と許可済み NewRow identity により保持し、factory は呼ばない。
Add は absent key だけ作り、Update は上記の一回 receive、Reverse は compatible extent を移す。
Remove/empty は contained child を終了し、再追加は同じ business id でも fresh browser token/state とする。
失敗した provisional child の資源だけを捨て、既存 sibling を保つ。
公開後の不可逆 failure は active fence に分ける。


## 4. composition と Promise/resource の寿命

### 4.1 借用 owner と独立 owner

cart の quantity/header/drawer は一つの cart owner を借りる構成を推奨する。
別 package の server helper と flat client functions を app が登録し、同じ model を context で渡す。
drawer の extent/resource を止めても header の quantity を捨てない。
複数の同 component は別 owner/state であり、code reuse と mutable sharing を混同しない。

```ts
// cart.types.ts
import type { Signal } from "@dathra/reactivity";
type CartValues = { quantity: Signal<string>; unitPrice: number };
export type { CartValues };

// quantity-panel.client.ts (independently packaged, borrowed model)
import type { ClientContext } from "@dathra/core/client";
import type { CartValues } from "./cart.types.js";
function quantityText(ctx: ClientContext<CartValues>) { return ctx.values.quantity.value; }
function setQuantity(ctx: ClientContext<CartValues>) {
  ctx.values.quantity.set(ctx.input.value);
}
export { quantityText, setQuantity };

// cart-header.client.ts (separate package)
import type { ClientContext } from "@dathra/core/client";
import type { CartValues } from "./cart.types.js";
function totalText(ctx: ClientContext<CartValues>) {
  const draft = ctx.values.quantity.value;
  const quantity = Number(draft);
  return draft.trim() !== "" && Number.isFinite(quantity) && quantity >= 0
    ? `Total ${quantity * ctx.values.unitPrice}` : "Enter a valid quantity";
}
export { totalText };

// cart.client.ts
import { defineClient } from "@dathra/core/client";
import { quantityText, setQuantity } from "./quantity-panel.client.js";
import { totalText } from "./cart-header.client.js";
export default defineClient({ quantityText, setQuantity, totalText });
```


独立 owner が必要なら DTO input/receive と versioned child message を使う。
同じ Signal を黙って共有しない。
以下は別の所有方針を比較する complete browser definition で、SSR counterpart は上の Row と同じ permission/input/template の明示形を使う。
これだけで独立 sharing の production support を証明したとはしない。

```ts
// quantity-independent.client.ts; same client module can pair with a server component.
import { defineClient, defineCreatedComponent } from "@dathra/core/client";
import { signal } from "@dathra/reactivity";
import { el } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Signal } from "@dathra/reactivity";
type Input = { value: string; version: number };
type Values = { draft: Signal<string>; version: Signal<number>; dirty: Signal<boolean> };
type QuantityContext = ClientContext<Values, {}, {}, Input>;
function quantityText(ctx: QuantityContext) { return ctx.values.draft.value; }
function change(ctx: QuantityContext) {
  ctx.values.draft.set(ctx.input.value);
  ctx.values.dirty.set(true);
}
function commit(ctx: QuantityContext) {
  ctx.emit("quantity-change", { value: ctx.values.draft.value, expected: ctx.values.version.value });
}
function receiveQuantity(ctx: QuantityContext) {
  const input = ctx.received;
  if (input.version <= ctx.values.version.value) return;
  ctx.values.version.set(input.version);
  if (!ctx.values.dirty.value) ctx.values.draft.set(input.value);
}
const QuantityClient = defineClient({ quantityText, change, commit, receiveQuantity });
function parseQuantityInput(value: unknown): Input {
  if (typeof value !== "object" || value === null ||
      !("value" in value) || typeof value.value !== "string" ||
      !("version" in value) || typeof value.version !== "number" ||
      !Number.isSafeInteger(value.version)) throw new Error("Expected quantity and version");
  return { value: value.value, version: value.version };
}
const NewQuantity = defineCreatedComponent({
  client: QuantityClient,
  input: parseQuantityInput,
  initialize(input: Input): Values {
    return { draft: signal(input.value), version: signal(input.version), dirty: signal(false) };
  },
  receive: "receiveQuantity",
  view(values, { prop, on }) {
    return el("div", {},
      el("input", { type: "text", props: {
        value: prop("quantityText", { input: { sink: "change" } }),
      } }),
      el("button", { type: "button", on: [on("click", "commit")] }, "Apply"));
  },
});
export { NewQuantity };
export default QuantityClient;
```


dirty editor への外部 quantity は conflict として表示する。
即時に一つの mutable service を複数 owner から使う要件が本当に必要なら、#247/#249 の明示 service owner/lease scope をコーディネーターへ戻す。
借用/独立は同じ shopper outcome を比較する実験仮説であり、探索前に利用者へ二者択一を迫らない。

### 4.2 operation、lease、channel を分ける

**operation**は function/Promise の一回の実行、**resource lease**はその invocation が残す timer/subscription/observer の寿命である。
operation が成功しても、所有 resource がある lease は残す。
resource がなくなり Promise も settle した lease は閉じ、古い context を失効させる。
ctx.guard は liveness を確認するだけで source を所有しないので、外部 source は onDispose などの登録が必要である。

| scheduling | Promise と lease の動作 |
|---|---|
| `parallel` | invocation ごとの token/lease。新しい実行は同 channel の sibling を失効させない |
| `replace` | channel epoch を進め、前の pending operation を abort し、completed operation の残る lease も閉じる |
| `join` | pending Promise だけを共有。Promise settle 後は次の operation を始められる。古い継続 resource は owner/replace によって終了 |
| `queue` | Promise settle を基準に次の command を開始。subscription 終了まで待ち続けない。enqueue した command data は明示 snapshot |

mount の subscription は mount function return 後も lease に残る。
Copy の feedback timer も fulfilled Promise 後に残る。
Search/receive は通常 settle 時に resource がないので lease を閉じる。
replace された source/timer の callback、disposed child の promise は token を確認して model write 前に止める。
callback error は既に成功した Promise を retroactively reject せず、active error として報告し、該当 resource/範囲だけを停止する。

ctx.onDispose は release を返し、release は解除と stop を一度だけ実行する。
ctx.timeout は cancel を返し、自動発火後は timer resource を lease から除く。
cleanup は token を失効し、contained child/resource、shared state の順で行い、throw があっても残りを止める。
独立 child は parent admission が失敗しても rollback 対象にしない。

### 4.3 host、native widget、active error

mount は成功した接続/新 child 公開後の明示的接続操作であり、initial setup/template の replay ではない。
Web Component interior を tag/shadow shape から所有範囲に推測しない。
第三者 widget は明示 target/interior grant と disposer を持つ adapter を必要とする。
具体的な全 adapter API の採用は今回の scope 外であるが、有用な widget を一律 unsupported に落とさない。

active preparation error は committed display を残して provisional additions を停止する。
onError は healthy status 範囲に原因/回復を示し、ctx.refresh は intact active binding の retry を行う。
不可逆な DOM/host failure は damaged extent を fence し、影響外 owner を残す。
範囲の integrity を失ったら fresh delivery/native response の回復を提示する。
Signal、network mutation、全 host side effect の万能 rollback を保証しない。


## 5. requests、fresh delivery と history

### 5.1 検証と channel

DTO operation は request の input/output validator と server authentication を宣言する。
fresh server UI は別 delivery を宣言し、初期 template を browser に持ち込まない。
検索は pending query と committed results を分け、native GET/whole response/partial delivery を同じ desired journey で比較する。
以下の code は Back 時に committed query を戻すアプリ方針を選ぶ。
未完 draft を history DTO へ保存して戻す方針も有効であり、framework の普遍的保持規則へしない。

```ts
// search.client.ts
import { defineClient, retain } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Signal } from "@dathra/reactivity";
type Values = { draft: Signal<string>; committed: Signal<string>; status: Signal<string> };
type SearchContext = ClientContext<Values, {}, { results: { query: string } }>;
function draftText(ctx: SearchContext) { return ctx.values.draft.value; }
function setDraft(ctx: SearchContext) { ctx.values.draft.set(ctx.input.value); }
function statusText(ctx: SearchContext) { return ctx.values.status.value; }
function results(ctx: SearchContext) { return retain(); }
async function search(ctx: SearchContext) {
  const query = ctx.values.draft.value;
  ctx.values.status.set("Loading");
  try {
    await ctx.deliver("results", { query }, {
      history: { url: `/directory?q=${encodeURIComponent(query)}`, mode: "push",
        data: { committed: query, draft: query } },
    });
    ctx.values.committed.set(query);
    ctx.values.status.set("Ready");
  } catch (error) {
    if (!ctx.isCurrent()) return;
    ctx.values.status.set("Could not load results. Current results are retained; retry Search.");
  }
}
async function restore(ctx: SearchContext) {
  const query = new URL(ctx.navigation.url).searchParams.get("q") ?? "";
  // This fixture chooses Back restores the committed query, not an unfinished draft.
  ctx.values.draft.set(query);
  ctx.values.status.set("Loading previous results");
  try {
    await ctx.deliver("results", { query });
    ctx.values.committed.set(query);
    ctx.values.status.set("Ready");
  } catch (error) {
    if (ctx.isCurrent()) ctx.values.status.set("Back results unavailable; retry or navigate normally.");
  }
}
export default defineClient({ draftText, setDraft, statusText, results, search, restore });
```

```ts
// search.server.ts (deterministic in-memory directory, not a production service)
import { clientModule, defineComponent, delivery } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { el } from "@dathra/core/server";
import type SearchClient from "./search.client.js";
const directory = ["Alpha", "Beta", "Gamma"];
function parseQuery(value: unknown): { query: string } {
  if (typeof value !== "object" || value === null ||
      !("query" in value) || typeof value.query !== "string") throw new Error("Expected query string");
  return { query: value.query };
}
function resultView(query: string) {
  return el("ul", {}, ...directory.filter(label => label.toLowerCase().includes(query.toLowerCase()))
    .map(label => el("li", { _key: label }, label)));
}
const Search = defineComponent({
  client: clientModule<typeof SearchClient>("./search.client.js", import.meta.url),
  history: { onPop: "restore", channel: "query", concurrency: "replace" },
  deliveries: { results: delivery({
    input: parseQuery,
    render(input, request) { return resultView(input.query); },
  }) },
  server(input: { query: string }) {
    return { draft: signal(input.query), committed: signal(input.query), status: signal("Ready") };
  },
  template(values, { bind, prop, on }) {
    return el("section", {},
      el("form", { action: "/directory", method: "get", _ref: "search",
        on: [on("submit", "search", { preventDefault: true, channel: "query", concurrency: "replace" })] },
        el("input", { name: "q", type: "search", "aria-label": "Search directory", props: {
          value: prop("draftText", { server: values.draft.value, input: { sink: "setDraft" } }),
        } }), el("button", { type: "submit" }, "Search")),
      el("p", { role: "status" }, bind("statusText", { server: "Ready" })),
      el("div", {}, bind("results", { server: resultView(values.committed.value) })),
    );
  },
});
export { Search };
```

```ts
// directory-route.server.ts
import { defineRoute } from "@dathra/core/server";
import { Search } from "./search.server.js";
const route = defineRoute({
  async render(request) {
    return await Search({ query: new URL(request.url).searchParams.get("q") ?? "" }, request);
  },
});
export default route;
```

```ts
import { request } from "@dathra/core/server";
// Application functions used by the component server declaration.
function parseValidation(value: unknown): { text: string; revision: number } {
  if (typeof value !== "object" || value === null ||
      !("text" in value) || typeof value.text !== "string" ||
      !("revision" in value) || typeof value.revision !== "number" ||
      !Number.isSafeInteger(value.revision)) throw new Error("Expected text and revision");
  return { text: value.text, revision: value.revision };
}
function parseValidationResult(value: unknown): { revision: number; message: string } {
  if (typeof value !== "object" || value === null ||
      !("revision" in value) || typeof value.revision !== "number" ||
      !("message" in value) || typeof value.message !== "string" ||
      !Number.isSafeInteger(value.revision)) throw new Error("Invalid validation result");
  return { revision: value.revision, message: value.message };
}
// Imported request() is a new proposed server API, not a function in Values.
const validation = request({
  input: parseValidation, output: parseValidationResult,
  async handle(input, request) {
    request.abortSignal.throwIfAborted();
    return { revision: input.revision, message: input.text.trim() ? "" : "Required" };
  },
});
// Place as requests:{validation} in defineComponent; browser uses ctx.request("validation", payload).
```


validation は component の requests に置き、client の RequestContract と actual validator を照合する。
型は input/output の runtime authorization を代替しない。

latest-wins は owner/child/channel token を model .set の前に照合する。
DOM publish だけを守って古い reply に model を変えさせない。
別 channel の save/source を search と一緒に abort しない。
abort は server mutation が未実行だった証拠ではない。
mutating retry は application command ID、server deduplication/status query と unknown outcome 表示を必要とする。
join/latest-wins から exactly-once mutation を推論しない。

### 5.2 destination と history

destination の fresh association、targets/resources を検証し、切替可能になるまで source を disposal しない。
commit switch の後に outgoing containment を終了し、選択した history bookkeeping を行う。
URL/DOM/native side effect 全体の atomic rollback を約束しない。
history の書き込みが公開後に失敗したら UI/URL のどちらが変わったかを示す。

popstate は既に URL を変更している。
fetch が失敗したら source content を保持しつつ mismatch/loading/error と retry/native navigation を表示する。
disposed/failed-terminal identity を cached HTML/handoff から復活させない。
DTO/checkpoint は fresh response/new browser instance の seed としてのみ使う。
retained live document/bfcache の pause/resume は別 policy で、initializer を replay しない。
visibility/pagehide を無条件に disposal と同一視しない。

async SSR/streaming の committed association unit、cancel、既送信 bytes の回収不能は #248 に残す。
buffered first transport は有効だが、それを理由に streaming という実用的カテゴリーを捨てない。


## 6. 元の七つの利用場面と確認責任

以下の F/C/B/D/M/T/L は保持された会話の分類である。
独立 reviewer が再分類した W1–W7 に置き換えない。
counter は #252/#253/#260 の baseline として別に扱う。
既存実装の default count や listener leak を期待動作にしない。

| 場面 | 利用者が望む動作 | 境界、failure と今回の判断 |
|---|---|---|
| F feedback 中の編集 | 日本語入力、途中 selection、validation、submit error の訂正 | pre-admission edit/IME/caret/reset/a11y を別々に確認。controlled/native draft は同じ保存目標で比較 |
| C 別 package の cart panels | quantity editor/header/drawer の値が一致し、drawer 終了で cart を失わない | 借用 owner を推奨。独立 owner は versioned DTO/message。mutable shared service は別 scope 判断 |
| B search/history/draft | draft と committed query を区別し、競合 search、Back、失敗に対応 | native navigation、response replacement、partial delivery を比較。Back retention は app variant |
| D 実 Docs Copy と static control | 実 Docs の article/TOC/code block を読んで Copy、成否を確認 | clipboard reject、再実行、feedback timer、host disposal、late fulfillment。counter で代用しない |
| M 多段階の申請 | Next/Back で draft を維持し、checkpoint、遅い validation を処理 | retained hidden と disposed/fresh DTO seed を別判断。二 step の bounded slice |
| T editable table | 編集中の reorder/追加/削除、remote refresh/save conflict | business id、control/editor token、response id を分ける。dirty draft/version を保持 |
| L live source | remote update と手入力の conflict を選び、disconnect/reconnect に対応 | monotonic version/gap resync、subscription lease、late work、pending remote。全 streaming 保証にしない |

### 6.1 実 Docs Copy の bounded example

実 Docs の Copy host、既存 code text/markup、複数 block を fixture 基準に使う。
以下は必要動作を示す小さい source sketch で、実 Docs を移行した証拠ではない。
clipboard を user gesture 中に呼び、fulfillment の後だけ success を表示する。

```ts
// docs-copy.client.ts
import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Signal } from "@dathra/reactivity";
type Values = { text: string; feedback: Signal<string> };
function feedback(ctx: ClientContext<Values>) { return ctx.values.feedback.value; }
async function copy(ctx: ClientContext<Values>) {
  try {
    await navigator.clipboard.writeText(ctx.values.text);
    ctx.values.feedback.set("Copied");
    ctx.timeout(() => ctx.values.feedback.set(""), 1500);
  } catch (error) {
    if (ctx.isCurrent()) ctx.values.feedback.set("Copy failed. Try again or select the text.");
  }
}
export default defineClient({ feedback, copy });
```

```ts
// docs-copy.server.ts
import { defineComponent, clientModule } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { el } from "@dathra/core/server";
import type CopyClient from "./docs-copy.client.js";
const CopyBlock = defineComponent({
  client: clientModule<typeof CopyClient>("./docs-copy.client.js", import.meta.url),
  server(input: { text: string }) { return { text: input.text, feedback: signal("") }; },
  template(values, { bind, on }) {
    return el("section", {}, el("pre", {}, el("code", {}, values.text)),
      el("button", { type: "button", on: [on("click", "copy", {
        channel: "copy-feedback", concurrency: "replace",
      })] }, "Copy"),
      el("span", { role: "status" }, bind("feedback", { server: "" })));
  },
});
export { CopyBlock };
```


```ts
// article-route.server.ts
import { defineRoute, el } from "@dathra/core/server";
import { CopyBlock } from "./docs-copy.server.js";
const route = defineRoute({
  async render(request) {
    return el("article", {},
      el("nav", { "aria-label": "Table of contents" },
        el("a", { href: "#example" }, "Example")),
      el("h2", { id: "example" }, "Example"),
      await CopyBlock({ text: "signal(7)" }, request),
      await CopyBlock({ text: "count.set(previous => previous + 1)" }, request));
  },
});
export default route;
```

```ts
// static-route.server.ts
import { defineRoute, el } from "@dathra/core/server";
const route = defineRoute({
  render(request) {
    return el("article", {}, el("h1", {}, "Static article"),
      el("a", { href: "#example" }, "Example"),
      el("pre", { id: "example" }, "signal(7)"));
  },
});
export default route;
```

1500ms は例の feedback 表示時間で、production performance threshold ではない。
Copy の Promise が成功しても timer lease を保持する。
次の replace は過去の completed timer lease も停止し、古い timer が新しい feedback を消さない。
clipboard 自体の既成 side effect は取り消せず、古い fulfillment による model 更新だけを防ぐ。
static article は client capability を宣言せず、Dathra activation code/data/marker を送らない。

### 6.2 M の draft/checkpoint 方針

近い二 step は retained hidden を推奨する。
二つの keyed child を残し、hidden/inert、必要な pause、focus 移動を明示する。
hidden は disposed と同義にしない。
長い flow/eviction は、child が宣言した draft DTO/revision を親 checkpoint へ保存してから removal する。
Back は checkpoint から fresh browser child を作り、旧 raw Signal/SSR identity を復活させない。
server checkpoint mutation は command ID/expected version と unknown outcome を扱う。

以下は type と実 validation declaration を対応させた policy sketch である。
input sink が revision を増やし、reply と現在 revision が違えば error model に書かない。

```ts
// Policy sketch: explicitly annotated context; Values is this application's declared graph.
// validateStep runs as on("blur","validateStep",{channel:"step-validation",concurrency:"replace"}).
type ValidationInput = { text: string; revision: number };
type ValidationReply = { revision: number; message: string };
type StepValues = { draft: Signal<string>; revision: Signal<number>; error: Signal<string> };
type StepContext = ClientContext<StepValues, {
  validation: RequestContract<ValidationInput, ValidationReply>;
}>;
async function validateStep(ctx: StepContext) {
  const revision = ctx.values.revision.value;
  const reply = await ctx.request("validation", { text: ctx.values.draft.value, revision });
  if (!ctx.isCurrent() || reply.revision !== ctx.values.revision.value) return;
  ctx.values.error.set(reply.message);
}
```


retained step の validation は必要に応じて cancel/pause し、disposed step は token で late reply を止める。
Next が await validation するか cancel するかは app policy にする。
framework の万能 draft retention を約束しない。

### 6.3 T の三つの identity

business id L17 は data refresh 後も同じであり得る。
editor/control token E9 は compatible keyed extent が生きている間だけ保つ。
SSR response identity R61 は immutable で、次の R62 に流用しない。
_key=L17 は table range 内の matching key で、R61 や global ownership ではない。

Row pattern を valid tr/td の server/new-only view に適用する。
receive で baseline/version を更新し、dirty string draft は保持して conflict を示す。
save は id/draft/expectedVersion/commandId を検証し、success/version または conflict DTO を返す。
delete/readd は新 editor token、response replacement は fresh association とする。
R62 へ draft を残す場合は明示 DTO merge を行う。

IME 中の reorder は保留し、非編集中の操作は継続する。
focused row removal は次の宣言 control へ focus を移す。
same key でも tag/namespace/behavior が変われば交換する。
_key があるだけで caret/host callback を保証しない。

### 6.4 L の version、conflict と subscription

以下は一 source の policy sketch である。
型の field と native browser dependency を明記し、未知の browser factory helper を置かない。
mount/再接続を同じ replace channel で宣言する。

```ts
// Bounded subscription operation; mount("connect") owns it after successful commit.
// DashboardValues = {sourceUrl:string; remote:Signal<number>; draft:Signal<string>;
//   dirty:Signal<boolean>; version:Signal<number>; pending:Signal<number|null>;
//   status:Signal<string>}; imports follow the previous client modules.
function connect(ctx: ClientContext<DashboardValues>) {
  const source = new EventSource(ctx.values.sourceUrl);
  ctx.onDispose(() => source.close());
  source.onmessage = ctx.guard(event => {
    const raw: unknown = JSON.parse(event.data);
    if (typeof raw !== "object" || raw === null ||
        !("version" in raw) || typeof raw.version !== "number" ||
        !("value" in raw) || typeof raw.value !== "number" ||
        !Number.isSafeInteger(raw.version) || !Number.isFinite(raw.value)) {
      ctx.values.status.set("Invalid source update; reconnect or refresh"); return;
    }
    if (raw.version <= ctx.values.version.value) return;
    if (raw.version !== ctx.values.version.value + 1) {
      ctx.values.status.set("Source gap; refresh authoritative snapshot");
      return; // a declared snapshot request resolves gap, never infer missing history
    }
    ctx.values.version.set(raw.version);
    ctx.values.remote.set(raw.value);
    if (ctx.values.dirty.value) ctx.values.pending.set(raw.value);
    else ctx.values.draft.set(String(raw.value));
  });
  source.onerror = ctx.guard(() => ctx.values.status.set("Disconnected; current values may be stale"));
  // The owned disposer runs when connect is superseded or the owner is disposed.
}
```


`mount("connect",{channel:"source",concurrency:"replace"})` と reconnect button の同名 channel を使う。
function return 後も onDispose が source lease を維持し、replace は古い source を close して token を失効する。
ctx.guard の parse/callback error は active error に報告し、既に成功した mount Promise を書き換えない。
raw JSON error で「更新成功」と表示しない。

古い version は無視し、gap は宣言した snapshot request で resync する。
remote change は dirty/composing draft に pending として残す。
「remote を採る」は draft/pending/dirty を更新し、「自分の値を保存」は expected version とともに submit する。
EventSource の reconnect を history replay の保証にしない。
disconnect は stale 表示とし、removal は subscription と queued callback を止める。

### 6.5 state/failure/recovery の対応

| 状態/遷移 | 表示と資源 | retry/回復 |
|---|---|---|
| unadmitted → preflighting | association/target/entry を読み、まだ owner/resource を作らない | 外部 prerequisite が戻ったときのみ同 immutable association を再検証 |
| preflight reject | SSR node/native edits を保存 | payload/target/static key の訂正は fresh response |
| staging → active | provisional graph/resources と required commit 成功 | duplicate は一つの owner を共有。成功後の自動 refresh は一回 |
| acquisition/required commit failure | staged model/write を捨て cleanup、SSR を保持 | failed-terminal。同 identity へ再 admission しない |
| active plan/receive error | committed display を保つ。既存 Signal 変更を rollback したとは言わない | 新 input または明示 active refresh。失敗 input の自動連打を抑止 |
| active irreversible damage | damaged extent を fence、影響外 owner を保つ | healthy error marker、許可した fresh delivery/native response |
| child remove/owner dispose | token を失効、child/resource、shared state の順で終了 | readd は fresh token。disposed SSR identity は復活しない |
| stale async/source/timer | model write 前に token を照合 | abort の成否に関係なく publication を止める |
| server mutation lost reply | outcome unknown を表示 | idempotency/status query。blind retry をしない |
| delivery failure | destination viability 確認前は source を終了しない | fresh unit retry/native navigation。history partial outcome を区別 |
| zero capability | bootstrap/handoff/activation marker/client reference を省略 | unknown catalog と empty interactive bind は zero でない |

新 browser child の construction/active/disposed token と、active range の intact/fenced は SSR admission state と分ける。
これらは domain state であり、Orca Dispatch/lifecycle ID ではない。

### 6.6 証拠の owner と選ぶ probe

| owner | 採用後の実装/証拠 | 開始/完了条件 |
|---|---|---|
| #262/#247 | author surface、public data/protocol、strict actual types、JS diagnostics、reference/permission manifest、build graph | mandatory author 判断はここで示す。private predicate が必要なら別 scope 承認 |
| #248 | capture/SSR/reflection、immutable association/creation seed、requests/auth、response/stream commit | adopted contract と SPEC/tests の後に production 実装 |
| #249 | admission/terminal cleanup、restoration、controls/IME、reconciliation/receive scheduling、leases、active fencing/history | 選んだ capability の public-path proof。内部 loop quota も tests とともに決定 |
| #250 | consumer migration/export/route integration と regression | #247–#249 の対象 slice が実行可能になってから完了 |
| #251 | 同 revision の実 consumer/bytes/resources/browser support matrix | 選んだ witness と承認 threshold を使う。全 adapter を証明したと扱わない |
| coordinator/user | 新提案と scope の review、canonical revision/experiment/adoption | この資料だけで①を完了せず merge/Accepted ADR を変更しない |

後で選ぶ最初の parallel probe は最大四つに絞る。
(1) counter と SSR keyed adoption/text↔DOM、(2) F の native adoption/IME/二 control、(3) C/T の借用/独立 state と reorder、(4) 実 D Copy と zero-root control を推奨する。
共有 fixture でも C/T は別評価にする。
M は retention/checkpoint が child API を制約したとき、B は enhanced delivery/history を選ぶとき、L は live resource/conflict を support claim に含めるときに持ち出す。
数や小→大の順序を目的にせず、具体的な decision を変える bounded slice とする。
今回それらを実験していない。


## 付録 A 原子的な58項目

58 は coverage 件数で、正しさの証明ではない。
A01–A58 は独立 critique と対応し、1.xx–6.xx は今回の分解番号である。
Cnn は #262 Issue body の line nn、D1.n は最新メモ、U は会話、G247 等は scope Issue、A253/A260 は Accepted source を指す。
source/問い/推奨と構文/強い代案/edge/状態/owner と gate を分けた。
新提案はすべて未検証であり、Accepted と direction が含まれても新実装の証拠を増やさない。

| 項目 | source/元の圧力 | 問い | 推奨契約と構文/遷移 | 強い代案と理由 | edge/failure | 状態 | owner/proof gate |
|---|---|---|---|---|---|---|---|
| 1.01 / A01 | U; C35/C44–47; scope | 今回何を採用するか | N01–N19 の新提案を利用者 review に戻す。①完了/production 更新ではない | 対象 slice だけを採用する選択も有効 | 資料を Accepted ADR や merge へ直結しない | 利用者範囲指定 | coordinator/user：明示的採用と実装認可 |
| 1.02 / A02 | D1.1/1.2; C3/C7/C11/C29; counter基準/D | server/client はどこで実行するか | server/template は server、flat default registry は別 browser module。counter 完全例 | neutral formatter は共有可能。initial template は共有しない | server value import を browser graph に含めない | 方向決定/未検証 | #247 graph/type、#248 SSR、#249 admission |
| 1.03 / A03 | D1.6; C3/C7/C29; counter基準/C/T | ordinary Signal の判別を何にするか | 1.1 の trusted own-descriptor protocol。tag-bearing plain record は readonly data。旧 WeakSet 案からの未採用変更 | private isSignal は強いが constructor 登録変更に別 scope が必要 | full protocol spoof/第三者/duplicate engine を真正性と区別 | 未採用変更/未検証 | #262 判断、#247 scope、#248 capture/#249 restore |
| 1.04 / A04 | D1.6; C3/C30; F/C/M/T/L | record と slot の何を書けるか | plain graph readonly、owned Signal .set。slot/record replacement を拒否 | parent Signal record の .set({...}) は変更単位を明示できる | nested payload mutation を通知や rollback と扱わない | 方向決定+新詳細/未検証 | #247 type、#249 facade/engine 通知同等性 |
| 1.05 / A05 | D1.6; C21/C24/C30; A260; C | nested alias を保持するか | 同 owner の同 Signal は一 slot。異なる同値 Signal は別 slot | plain record を value copy する方が heap identity を約束しない | 独立 owner の alias は両 path を示して拒否 | Accepted+新 graph 詳細/未検証 | #248 collector、#249 alias restore |
| 1.06 / A06 | C22/C23/C29/C31; D1.6; F/B/M/T/L | transfer できる値は何か | finite own data/array と protocol slot。unsupported path に DTO 修正を示す | Date/domain の明示 codec/DTO は実用的 | cycle/function/accessor/class/undefined/sparse/nonfinite を黙って変換しない | 新提案/未検証 | #262 domain、#248 validation |
| 1.07 / A07 | C9/C21/C30; D1.6; counter基準/D | DOM と snapshot をいつ採るか | server 解決後一 capture。template/encoding は同じ snapshot | plain immutable DTO を返す形は server resource を減らす | async template 中の live reread で DOM 7/transfer 8 にしない | 新提案/未検証 | #248 capture/publication |
| 1.08 / A08 | D1.2; C3/C29/C31; counter基準/F/D | bind/on の候補は役割別か | 両方に flat registry の全名。receiveRow も候補 | role context の guard は候補を減らさず誤用を診断できる | get 用に選んだ increment の .set は phase error | 方向決定/未検証 | #247 completion、#249 invocation/result |
| 1.09 / A09 | C23/C29/C31; D1.6; counter基準/C | client parameter はどう型付けするか | 独立 prepare の ReturnType または共有 Values を ClientContext に注釈 | inline satisfies は contextual typing に使える | 完成 component の相互 type import/無注釈 parameter を推論済みとしない | 新提案/未検証 | #247 actual strict public type fixture |
| 1.10 / A10 | D1.6; C24/C29/C31; counter基準/C | type/runtime path を二度書くか | type-only default と clientModule literal path を維持 | 生成 typed catalog は減らせるが追加 tooling を要する | type erasure で runtime link が出来たとしない | 方向決定/未検証 | #247 witness/index、#248 deployment |
| 1.11 / A11 | C23/C24/C31; D1.6; C/T | type witness と actual module をどう照合するか | direct resolved path と actual default/function inventory を比較 | 間接 library は明示 inventory で対応 | 同じ名前だけの別 module は Values/authority が同じではない | 新提案/未検証 | #247 checker、#249 runtime default |
| 1.12 / A12 | C22/C24/C25/C29/C30; G247; D/B | deployment 後の reference はどう解決するか | source ref→manifest→output URL。creation export/parser/receiver permission を index | host の明示 entry inventory は有効 | import.meta.url の source/output 差を server client import で補修しない | 新提案/未検証 | #247 build adapter/manifest、#248 lookup |
| 1.13 / A13 | C7/C9/C24/C25; G247; D/static | package/graph と再現性は何を保証するか | core facade→server/client siblings。固定 source/env/input/seed で比較可能 semantics | 物理 package を直接 import しても境界は同じだが作者例を変更しない | transpile を隔離 proof、unknown を zero としない | Accepted+新 tooling/未検証 | #247 graph、#251 同 revision artifacts |
| 2.01 / A14 | D1.3; C3/C29; counter基準/T | bind の content category は固定か | text/empty/element/fragment/authorized child を動的に切替。summary/rows 例 | raw native widget は明示 grant/adapter で支える | Promise/raw Node/raw HTML を黙って表示結果にしない | 方向決定+新 grammar/未検証 | #247 result、#248 SSR、#249 writer |
| 2.02 / A15 | D1.5; C9/C30/C33; A253/A260; counter基準/F/T | 接続直後の異なる結果はいつ出すか | 成功 commit 後自動 refresh 一回。Count:7→Count=7 trace | 同値 write 省略は有効。invalidation 待ちは採用方向でない | 必要 staging failure を active に移して terminality 回避しない | 方向決定+Accepted/未検証 | #249 staging/refresh/SSR preservation |
| 2.03 / A16 | C23/C31/C33; D1.2; counter基準/F/D | preflight/producer/operation の違いは何か | preflight 検証、staging read、active operation mutation。phase 違反を診断 | 役割別 context view は使えるが completion を狭めない | JS/cast/throw で type safety を runtime proof にしない | Accepted+新 invocation/未検証 | #247 types、#249 phase/error |
| 2.04 / A17 | C3/C22/C29/C31; U; F/T | event は何を読み取るか | ctx.event は既知 current control snapshot、ctx.control は限定 projection | native Event adapter は明示 integration で使える | target retarget/await 後の cancel/外国 node を誤所有しない | 新提案/未検証 | #249 event/host adapter、#251 F |
| 2.05 / A18 | C3/C22/C29; U; F/B/D | event options と scheduling は何か | on array、sync preventDefault、capture/passive/once、channel/concurrency | delegation は declared target context を守れば有効 | passive conflict/duplicate admission/once 再登録を診断 | 新提案/未検証 | #247 declaration、#249 listener/token |
| 2.06 / A19 | C3/C22/C29; G247; U; F/T | attribute と property はどう分けるか | attr は反映属性、prop は live adapter、defaults は native seed | semantic shorthand は仕様が明示されれば有効 | value attribute と live draft、boolean/ARIA reflection を混同しない | 新提案/未検証 | #248 default reflection、#249 adapters |
| 2.07 / A20 | D1.5; C21/C30/C33; U; F/C | 接続前 input の書き戻しはどこか | provisional sink、capture revision reread、native adopt、multi-control hold。2.3 | uncontrolled/default+FormData は reactive peers 不要なら簡単 | failed admission は model を捨て native edits を保存。getter から setter を推定しない | 新提案/未検証 | #249 transaction/group、#251 F/C |
| 2.08 / A21 | U; C21/C22; F/T/L | IME の不明な開始状態はどう扱うか | value から履歴を推定せず unknown editable の異なる初回整形を保留。観測 boundary で解く | native draft を blur/submit で commit する形は簡単 | remote change は pending/conflict。判別不能 host の保留を可視化 | 新提案/未検証 | #249 control adapter、#251 selected IME |
| 2.09 / A22 | U; C21/C22; F/T | caret/selection は何を保つか | 同値 assign を避け compatible node を保持。整形は blur/submit | 毎キー整形は explicit caret mapping と証拠があれば選べる | surrogate/selection replacement/type change は _key だけで守れない | 新提案/未検証 | #249 text adapter、#251 F/T |
| 2.10 / A23 | U; G247/G249; F/M | native form/reset は何を残すか | validation/names/submitter は native。uncanceled reset 後 sink に defaults を戻す | native action の zero-root form は first-class | controlled model と reset がずれると次 refresh が reset を打ち消す | 新提案+Accepted zero-root/未検証 | #248 response、#249 reset/submit |
| 2.11 / A24 | U; C21/C22; F/T/M | accessibility と focus はどう指定するか | id の scoped reference、label/error/ARIA、declared focus 先 | semantic controls は custom widget より必要操作が少ない | reused ID、reorder/removal の focus は key identity では解決しない | 新提案/未検証 | #247 syntax、#249 focus、#251 a11y |
| 2.12 / A25 | U; D1.6; F/C/T | numeric draft を domain state にいつ変えるか | string draft を保ち input/blur/submit の選んだ境界で parse | native uncontrolled draft→blur domain commit は有効 | 空/途中小数を Number で消し、NaN を transfer しない | 新提案/未検証 | #262 examples、#249/#251 F/C/T |
| 2.13 / A26 | U; C3/C22; F/T | checkbox/radio/select は文字列だけか | checked/semantic selectedValues と sink、explicit group/reset authority | native selection/FormData は client owner 不要 | 存在しない DOM property/foreign radio peer/option reorder を誤説明しない | 新提案/未検証 | #248 reflection、#249 control group |
| 2.14 / A27 | U; C22/C23; F | file はどう扱うか | browser operation/FormData/明示 transport。cancel/error を所有 | native multipart は server-only でも実用的 | File restore や programmatic file selection を plain writer にしない | 新提案/未検証 | #247/#248 transport、#249 control |
| 3.01 / A28 | D1.4; C24/C30; T | _key の scope は何か | owner/range/siblings。duplicate は write 前 error、HTML に出さない | positional stateless list は不要な key を減らせる | 他 range の同 key は node/state 移動の権限でない | 方向決定+新 scope/未検証 | #248 metadata、#249 ledger |
| 3.02 / A29 | D1.4; U; T/M | same key の changed tag はどうなるか | kind/tag/namespace/behavior/creation で compatibility。違えば交換。unkeyed は gap ordinal | revision key は意図した reset を表せる | SSR mismatch を active reconstruction で隠さない | 新提案/未検証 | #249 matching/permission、#251 T |
| 3.03 / A30 | D1.4; U; G249; F/T/D | reorder で host/native state は保つか | logical owner/extent を保ち、composition move は保留 | adapter の state-preserving move は証拠があれば選ぶ | remove/reinsert を connected/focus/IME guarantee としない | 新提案/未検証 | #249 move、#251 F/T/D |
| 3.04 / A31 | D1.7; U; T | 複数要素の一項目はどう書くか | fragment({_key},dt,dd) の persistent range | valid wrapper は HTML が許せば簡単 | native DocumentFragment や foreign child interior を lifetime にしない | 新提案/未検証 | #248 extent、#249 fragment move |
| 3.05 / A32 | D1.3/1.7; U; B/T | empty 表示は capability を失うか | null/[] は content/resource removal、marker/range は存続 | component removal は lifetime 終了を明示する | empty interactive は zero-root でない。DOM 位置を推測しない | 方向決定+新 extent/未検証 | #248 empty target、#249 insert/dispose |
| 3.06 / A33 | D1.8; U; C10/C29; M/T | new child の state はいつ作るか | pure createComponent intent、validated factory input、absent token だけ initialize/view | 親の keyed model は独立 lifetime 不要なら簡単 | producer 内の eager signal/listener/DOM を禁止 | 新提案/未検証 | #247 factory type、#249 staging |
| 3.07 / A34 | D1.8; A253/A260; U; M/T | SSR child と factory をどう許可するか | clientModule.creation、manifest の export/parser/receiver/seed を immutable 記録。restore のみ | 親所有 state は工数が少ないが autonomous child の代替ではない | same default の別 factory を認可しない。missing snapshot を initialize で補修しない | 新提案+Accepted no-replay/未検証 | #247 manifest、#248 association、#249 permission |
| 3.08 / A35 | D1.8; U; C/M/T/L | receive は何回実行するか | normalized structural compare。SSR seed 同値0、changed一回、latest pendingのみ。model-only sync | 親所有 state や revision-key reset は別の有効な意味 | dependency を親へ漏らさず、echo/再入/cycle を診断。dirty draft保持 | 新提案/未検証 | #249 scheduling/loop、#251 C/M/T |
| 3.09 / A36 | C33; D1.8/1.9; U; M/T | new child construction が失敗したらどうするか | provisional cleanup、committed siblings を保つ。再追加は fresh token | declared error placeholder は範囲内なら可能 | 公開後不可逆 failure を万能 rollback としない | 新提案/未検証 | #249 create/fence、#262 recovery |
| 4.01 / A37 | C21/C29/C30; A260; C | 別 package panels は状態をどう共有するか | 一 cart owner を借り、flat functions/server helpers、別 target/resource | 独立 owners の versioned messages は autonomous panel で有効 | drawer removal で quantity を終了しない。target の二重 writer を拒否 | Accepted model+新 surface/未検証 | #247 composition、#249 scoped resources |
| 4.02 / A38 | C21/C24/C30; A260; C/M/T | reused/independent component の差は何か | code 再利用、fresh response identity/state。child admission は parent active に依存しない | plain helper は owner 境界を不要にできる | parent failed admission が active child を SSR へ戻さない | Accepted/未検証 | #248 identity、#249 independent rollback |
| 4.03 / A39 | C24/C30; A260; U; C | mutable cross-owner sharing は暗黙か | 拒否。versioned DTO/receiver/emit。実 shared service は scope gate | borrowed owner は cart default。copy は独立だが共有ではない | global singleton/request alias を shared contract としない | Accepted boundary+新 service branch/未検証 | #247 scope、#248 isolation、#249 lease |
| 4.04 / A40 | C30/C33; A260; U; C/M/T | 親が独立 child を移動/除去できるか | 明示 containment の outer extent だけ。interior opaque | 別 host/region は layout が許せば簡単 | parent transaction が取得していない active child を rollback しない | Accepted+新 move/未検証 | #248 containment、#249 cleanup |
| 4.05 / A41 | C33; A253/A260; U; D/M/L | resource は Promise return で終わるか | operation と lease を分ける。onDispose/timeout/mount は必要な resource を保持 | 明示 native disposer は適切。engine root だけでは不足 | cleanup throw を集約、child を shared state より先に停止 | Accepted+新 lease/未検証 | #249 ledger、#251 resource evidence |
| 4.06 / A42 | C33; A260; U; B/D/M/T/L | late work/parallel/join をどう守るか | replace は旧 lease全部を終了、join は pending Promise、parallel は sibling token独立 | 結果を owned publication に戻す形は raw捕捉を減らす | model write前に guard。ctx.guard単独では source所有しない | Accepted+新 scheduling/未検証 | #249 contexts/leases/races |
| 4.07 / A43 | G249; C23/C31; U; D/T/L | 外部 DOM damage/native widget をどう扱うか | recorded integrity、damaged range fence、widget は grant/disposer | selected adapter は有用で一律除外しない | foreign node adoption、selector 再構築、shadow形状推論をしない | 新提案/未検証 | #249 adapter/integrity、#251 D/L |
| 4.08 / A44 | D1.9; C33; U; B/T/L | active partial failure の利用者回復は何か | last display/healthy status、intact refresh、damagedなら fresh delivery/native response | 可逆 write の bounded undo は有効だが万能でない | Signal/network/host 全体を巻き戻したとしない | 新提案/未検証 | #262 policy、#249 fence/recovery |
| 5.01 / A45 | C3/C10/C22/C29; A260; F/B/M/T | server operation はどう宣言するか | request input/output/handle、delivery input/render、ctx authority、server auth | native form action は enhancement 不要なら簡単 | 名前/identity claim を認証としない。callbacks を serializeしない | Accepted boundary+新 surface/未検証 | #247 type、#248 handler、#249 guard |
| 5.02 / A46 | A260; U; B/M/T/L | 競合 completion の勝者は何か | replace query channel、parallel/save別channel、model .set前に世代照合 | queue は順序 commands、all-results は明示収集で有効 | owner全体世代で別saveをcancelしない | 新提案/未検証 | #249 generations、#251 B/M/T/L |
| 5.03 / A47 | A260; U; B/M/L | cancel は何を保証するか | abort と publication token を両方使う。source displayを保持 | transport cancel不可なら結果抑止だけでも有用 | server mutation未実行/undoをabortから推論しない | Accepted+新 abort facade/未検証 | #248 cancel、#249 lease |
| 5.04 / A48 | A253/A260; U; F/B/D/M/T | retry はどれが安全か | preflight外部回復、terminal fresh response、active再操作、unknown mutation statusを分ける | idempotencyがなければserver結果確認後に明示retry | latest-wins/join は mutation exactly-onceでない | Accepted+新 operation policy/未検証 | #248 command status、#249 identity |
| 5.05 / A49 | C10/C29/C30; A260; U; B/T | server delivery の権限はどこから来るか | ctx.deliver の fresh unitをdeclared bindへ。retainで現行contentを保つ | DTO requestは既存model更新、native responseはbaseline | cachedHTML/旧payload差替えで新authorityにしない | Accepted+新 API/未検証 | #248 fresh unit、#249 switch |
| 5.06 / A50 | C22/C29; G248/G249; U; B/M | navigation の失敗前に何を終了するか | destination validate/prepare後にswitchしsourceを終了 | native navigationは既知のserver response取得方法 | history/DOMの非atomic結果、popURL既変更を表示 | 新提案/未検証 | #248/#249 destination、#250 integration |
| 5.07 / A51 | A260; U; B/M | Back は disposed owner を復活するか | fresh response/DTO seed。live retained/bfcacheは別policy | 明示 live cacheはlease/evictionがあれば有効 | visibility/pagehide=disposeと決めつけない。Back draftはapp方針 | Accepted+新 history/未検証 | #249 history、#251 B/M |
| 5.08 / A52 | G248; C10/C34; U; B/L | async SSR/streamは何を約束するか | 明示request/await、committed association unit、cancelをserver所有 | buffered first transportは実装を限定できる | 既送信bytesを撤回、stream failure後CSR replayをしない | 新宣言/詳細実装はscope外 | #248 stream、#251 selected fixture |
| 6.01 / A53 | C9/C24/C30; G247; A260; D/static | static route の code を何で選ぶか | 明示entry/ref graphからcatalog。client refなしならroute client entryなし | 他route artifact/cacheを残してもよい | unknown graphをzeroとしない。typesだけでsecrecy証明しない | Accepted+新 catalog/未検証 | #247 selection、#251 artifacts |
| 6.02 / A54 | C9/C24/C30; G248/G251; D/static | zero response は何を省略するか | bootstrap/handoff/activation markers/client artifact参照、static親は必要childだけ | potential catalogとresponse capabilityを分ける | empty bindはcapability、incomplete宣言はerror | Accepted/未検証 | #248 output、#249 resources、#251 bytes |
| 6.03 / A55 | C23/C31/C33; U; 七場面/counter基準 | diagnostic は何を示すか | phase/code/name/target/identity/cause/repair/allowed recovery。active onErrorのみ | productionはsecretなし要約、devは位置詳細 | raw payload/secretをlogしない。callback errorをfulfilledPromiseの失敗に変えない | 新提案/未検証 | #247/#248/#249 stage-specific JS/TS cases |
| 6.04 / A56 | C23/C31; U; F/D/L | rich data/widget の修正経路は何か | DTO/codecと明示native grant/disposer。all adapterを今回作らない | native form/navigation/selected widgetは実用代替 | Proxy/class/foreignNodeを自動判別し安全としない | 新提案/詳細scope外 | #247 extensions、#249 adapter gate |
| 6.05 / A57 | C8/C21/C32/C33; U; F/C/B/D/M/T/L | 七 witness は何を証明するか | baseline counterとは別のF/C/B/D/M/T/Lを会話由来と明示。個別判断とtraceを残す | shared fixtureは重複を減らすが判断を統合しない | counterで実Copy/M/T/Lを代用、少数例で広いsupportを宣言しない | 提案/未検証 | coordinator/user selection、#251 matrix |
| 6.06 / A58 | C25/C34/C35/C39/C40/C44–47; G247–251; U; scope/七場面 | 今回は何を実行しないか | repo temp資料のみ。canonical/production/test/GitHub/merge/worker/thresholdなし | 採用後の明示認可でSPEC/tests/implementationへ移る | mandatory author問いを未決のまま下流へ押し出さない | 実行scope外 | coordinator認可、#247–#251 proof gates |

## 付録 B canonical 27候補と crosswalk

source の見出し/行番号は既存 Issue body の provenance を保持する。
canonical collector を再実行したとは扱わない。
今回の session 追加条件は58項目に明示し、歴史的な Issue line を増やさない。

| source field / heading / line | canonical 要求の内容 | 対応項目 |
|---|---|---|
| decisionToMake / Decision to make / 3 | Plain JS/TS の初期DOM、境界値、binding/operation/target/entryとstage検証 | A02–19, 28–40, 45–54 |
| contextAndEvidence / Context and evidence / 7 | Accepted compiler/JSX/明示境界、server authority、package/engine | A02–05, 08, 13, 37–42 |
| contextAndEvidence / Context and evidence / 8 | primary consumer の期待動作と欠陥baselineを区別 | A57 |
| contextAndEvidence / Context and evidence / 9 | initial setup/template replay禁止、zero-root omission | A07, 13–16, 53–54 |
| contextAndEvidence / Context and evidence / 10 | creation/request/delivery宣言、#248/#249の責務 | A33–36, 45–52, 58 |
| contextAndEvidence / Context and evidence / 11 | 旧packageを無条件互換制約にしない。対応付けを理解可能にする | A02, 06, 10–12, 58 |
| optionsConsidered / Options considered / 15 | declarative builderと明示capability pairingの比較 | A02, 14–19, 28–36 |
| optionsConsidered / Options considered / 16 | 手書きregistryの有効性と維持費用の比較 | A11–13 |
| optionsConsidered / Options considered / 17 | generic component/implicit captureと境界の比較 | A02, 14–16, 34 |
| decisionCriteria / Decision criteria / 21 | 実際の初期/更新/disposal、独立反復の実用性 | A07, 15, 20–27, 33–42, 57 |
| decisionCriteria / Decision criteria / 22 | 実行/target/communication/failureを読み取れ、manifest費用を説明 | A06, 12, 17–27, 45–52 |
| decisionCriteria / Decision criteria / 23 | TS/build/server/client別の原因/位置/修正diagnostic | A03, 06, 08–13, 16, 55–56 |
| decisionCriteria / Decision criteria / 24 | response identity/static capability、code/data分離とzero-root | A05, 10–13, 28, 38–39, 53–54 |
| decisionCriteria / Decision criteria / 25 | 下流owner、再現可能な提供結果 | A13, 52, 58 |
| acceptanceCriteria / Acceptance criteria / 29 | small JS/TS primary APIとcreation/request/delivery例 | A02, 08–19, 33–36, 45, 49–52 |
| acceptanceCriteria / Acceptance criteria / 30 | 初期正本、反復、identity、code/data、zero-root | A05, 07, 12, 15, 37–40, 49, 53–54 |
| acceptanceCriteria / Acceptance criteria / 31 | 段階検証/actionable error、JS/DOM ownership推測禁止 | A06, 08–13, 16–19, 43, 55–56 |
| acceptanceCriteria / Acceptance criteria / 32 | 同consumerで書き方/type/実行/失敗/保守の比較 | A57 |
| acceptanceCriteria / Acceptance criteria / 33 | success/update/mismatch/duplicate/preflight/acquisition/dispose/zeroの状態 | A15–16, 28–44, 46–51, 54, 57 |
| acceptanceCriteria / Acceptance criteria / 34 | 詳細/evidence/owner/blockingを示し必須判断を先送りしない | A52, 58 |
| acceptanceCriteria / Acceptance criteria / 35 | canonical path/collector/compile/whitespace、Draft/Proposed/user acceptance | A01, 58 |
| dependencies / Dependencies / 39 | Accepted253/260と252完了証拠を再利用 | A58 |
| dependencies / Dependencies / 40 | 247–249 parallel designと完了gateを区別 | A58 |
| nonGoals / Non-goals / 44 | production/test/runtime実装は今回対象外 | A01, 58 |
| nonGoals / Non-goals / 45 | 専用compiler/JSX/暗黙ownership/無条件互換を追加しない | A02, 10, 12–13, 58 |
| nonGoals / Non-goals / 46 | all adapter/encoding/marker/performance thresholdを今回決定しない | A30–31, 52, 58 |
| nonGoals / Non-goals / 47 | Accepted253/260を無断で再開せずmerge/親closeをしない | A01, 58 |

27/27 候補を58項目へ対応させた。
source 行の要求は維持し、公開/Proposal 更新は今回実行していない。
元の F/C/B/D/M/T/L の具体例は6章、scope/実装 gate は6.6に対応する。

## 付録 C 全公開 surface と option

前ページ N01–N19 が利用者の採用判断の入口、以下が例に使った surface の全 inventory である。
code にある native API と application function は framework API と区別する。
すべての「新提案」は未検証であり、既存 export があると主張しない。

| surface | method/option と契約 | 状態 |
|---|---|---|
| `defineComponent` | client/server/template。新 option input/requests/deliveries/history/onError。server(input,request)、template(snapshot,tools,request?) | 基本名は方向決定、追加は新提案 |
| returned Component | `await Component(input,request,{_key?})`。request-owned ServerView を返す | awaited 選択は未採用新提案 |
| `defineRoute` | render(request) の sync/async result。path/server option は使用しない | canonical 形保持、async 詳細は未検証 |
| `defineDelivery` | routes:{url:{server:specifier}}。clients map を clientModule index へ置換 | 既存登録形、収集変更は新提案 |
| `clientModule` | type-only default の型、specifier/baseURL。optional creation は named factory permission | 二引数は方向決定、creation は第2回新提案 |
| `defineClient` | flat callable registry、default export。全名を bind/on に提示 | 方向決定 |
| `ClientContext<V,R,D,I>` | Values、RequestContract map、delivery input map、received input。適用外 projection は runtime error | 型詳細は新提案、runtime proof でない |
| `RequestContract<Input,Output>` | client 側の共有 public type witness。actual validator/permission は別 | 新提案 |
| `signal` / Signal | existing value/peek/set(update)/__type__。snapshot readonly、browser slot は guarded mutation | ordinary constructor は方向決定、構造判別は未採用変更 |
| `el` | pure description。ordinary attrs と _key/_ref/_ns/on/props/defaults/mount を分離 | _key/pure は方向決定、record 詳細は新提案 |
| `fragment` | {_key?},children。persistent extent、interior authority を明示 | 新提案 |
| `bind` | name,{server:actualSSR}。new-only view の name overload。text/empty/DOM/child を動的表示 | marker は方向決定、grammar/overload 詳細は新提案 |
| `prop` | name,{server?,input?}。input:{sink,group?,conflict?}。chosen conflict は hold。server 省略は new-only | 新提案 |
| `attr` | name,{server?}、boolean/ARIA/null reflection を adapter ごとに指定 | 新提案 |
| `defaults` | value/checked/selectedValues の native initial seed。retained draft を更新時 reset しない | 新提案 |
| `on` | event/name、capture/passive/once/preventDefault/channel/concurrency | 全名は方向決定、option は新提案 |
| `id` / `_ref` / `_ns` | local HTML-ID reference、owned control name、explicit namespace。metadata を HTML に出さない | 新提案 |
| `mount` | registered operation name、channel/concurrency。成功 commit 後の attachment | 新提案 |
| `defineCreatedComponent` | client actual default、input parser、initialize、new-only view、optional receive 名 | 新提案 |
| `createComponent` | definition,{_key,input}。pure lazy intent。authorized factory だけ使用 | 新提案 |
| `request` | input/output validator、authenticated handle(input,request) | explicit boundary は Accepted、綴りは新提案 |
| `delivery` | input validator、server-only render(input,request)、fresh unit | explicit authority は Accepted、綴りは新提案 |
| `retain` | 現在 commit した content/resources を保持する result | 新提案 |
| component `history` | onPop/channel/concurrency。route history writer を明示 | 新提案 |
| delivery `history` | url/mode/data。mode は push/replace | 新提案 |
| component `onError` | active reporting の registered name | 新提案 |
| `ctx.values` | readonly graph/Signal facade。write 前に phase/lifetime/lease/generation を確認 | unified record は方向決定、guard 詳細は新提案 |
| `ctx.ui` | pure description tools。function parameter の既知 names 以上を遡及推論しない | 新提案 |
| `ctx.event` | declared current control の type/key/isComposing/value/checked/selectedValues/detail/submitter、同期 preventDefault() | 新提案 |
| `ctx.input` | sink capture、value/checked/selectedValues/ref/revision/selection/composition/reason。reason は input/change/reset/adopt | 新提案 |
| `ctx.received` | registered receive phase の validated readonly DTO、親 slot を含めない | 新提案 |
| `ctx.navigation` | history phase の URL/app data snapshot | 新提案 |
| `ctx.error` | phase/code/target/scope/cause category/allowed recovery、secret/raw payload を含めない | 新提案 |
| `ctx.control(ref)` | owned property/selection projection、focus()。general interior mutation を与えない | 新提案 |
| `ctx.formData(ref)` | declared form の native successful control/submitter data。File は browser/transport のみ | 新提案 |
| `ctx.emit(name,DTO)` | recorded containment port から declared on target への owned message。raw DOM bubbling を仮定しない | 新提案、receive phase では拒否 |
| `ctx.request(name,input)` | recorded DTO request、actual validation/auth/abort/token | 新提案 |
| `ctx.deliver(target,input,{history?})` | declared fresh UI target、destination 検証後 switch | 新提案 |
| `ctx.refresh(name)` | intact active binding の明示 retry。failed receive も再試行可能、成功同値 receive は省略 | 新提案 |
| `ctx.onDispose(stop)` | owned resource 登録。returned release() は unregister+stop を一度だけ実行 | 新提案、lease は operation return 後も存続 |
| `ctx.timeout(callback,delay)` | owned timer、returned cancel()。発火/取消で resource を除く | 新提案 |
| `ctx.abortSignal` | operation/lease cancellation。mutation の undo ではない | 新提案 |
| `ctx.guard(callback)` | lease/owner/token を照合。callback error を active error にする。source ownership は別途必要 | 新提案 |
| `ctx.isCurrent()` | 現在の invocation/lease が有効かを読む | 新提案 |

`creation` marker、`ctx.create`、`defineCreatedChild`、`keyed()`、`child()` と public child update/move/dispose handle は採用候補から外す。
normal list は _key、display は bind、autonomous state は明示 factory と membership/input にまとめる。
内部 slot/target IDs、factory permission、mutation plan、resource ledger は必要だが作者に同じ対応を二重登録させない。
public `isSignal` はこの構造案では導入せず、以前の private predicate を必要とする場合だけ別 scope を承認する。
native widget/codec の general helper は code に隠して追加しない。

## コーディネーターから利用者へ戻す判断

1. 既存 engine scope を保って trusted structural Signal protocol を選ぶか、private provenance を必要として別 scope を承認するか。今回の推奨は構造案だが、以前より弱い未採用変更と明示する。
2. stateful child の creation permission/input seed と new-only initialize/view、registered receive を選ぶか。独立 lifetime が不要なら親の keyed state を推奨する。
3. explicit property sink と native adoption/unknown composition hold を選ぶか。native-owned draft も同じ desired behavior で比較する。
4. proposed fragment と deterministic compatibility/gap matching を選ぶか。physical move/IME/host の保証は選択 adapter の証拠に限定する。
5. operation/lease/channel を分け、destination-first delivery と app-specific Back policy、scope-specific active recovery を選ぶか。

具体的な新提案を以上の形に揃えた。
未検証項目を全①の完了条件として無制限に増やさず、選んだ slice ごとに proof gate を置く。
user acceptance、Proposal revision、実装、merge はこの資料の作成に含まれない。

## 検査と第2回 delivery 記録

実施したのは source の限定再読、日本語への整理、58項目/27候補/七場面の整合、code/option inventory、構文例の内部整合と whitespace 確認である。
runtime/browser/Typst/TypeScript experiment は追加していない。
新しい code がコンパイル/実行できると主張しない。
旧 disposable stubs の結果は旧 shape の限定的型証拠だけである。
既存 dirty checkout、canonical source、Issue/PR、config/process、workers を変更していない。
repository ではこの割当 Markdown だけを更新し、scratch は /tmp に置いた。

R1 の accepted/turn_started receipt は旧版の delivery 記録であり、この R2 が届いた証拠へ流用しない。
R2 の bounded checks は /tmp/dathomir-262-full-authoring-review-r2-checks.json に記録した。
58行の項目/8欄、27候補/crosswalk、七圧力、19 surface groups、Japanese prose、code fence、facade/request/permission の一致、whitespace を確認した。
これらは coverage と文書整合の検査で、動作証明ではない。
R2 は coordinator `term_5db51934-7dd7-406b-97eb-1456c9a07fda` へ送信し、`accepted:true` と `input_accepted` / `turn_started` を確認した。
receipt は `/tmp/dathomir-262-full-authoring-r2-delivery-receipt.json` に保存した。
送信 request ID は `003523ad-ee22-4ffa-bc0b-0cfa87be028c` であり、Dispatch/lifecycle ID ではない。
これは受信と turn 開始の確認であり、推奨案の承認を意味しない。
直接割当で live Dispatch はないため worker_done/lifecycle ID を生成しない。
