# #262 の三つの懸念に対する比較レビュー

この資料は利用者による検討用であり、Proposal の改訂、採用、①の完了を意味しない。
R2 の全体レビューは変更せず、ここで差分を示す。
今回の推奨は、決定済みの作者の書き方を保ち、重複する登録を減らすことである。
Signal の識別と成立性は独立レビューを統合し、B/C に具体的な推奨と差分を記す。
コードは未実装 API の設計例であり、コンパイルや動作の成功を示さない。

## 最初に確認する結論

1. **A の推奨**：R2 の三種類の表示宣言を、配置先が明示された一つの bind にまとめる。
   自律 child は flat defineClient の任意の第二引数に一つの作成プロフィールを持ち、clientModule の追加の factory 名をなくす。
   request/delivery の wrapper 関数をなくし、宣言 record にする。
   二つの遅延処理の有効性 helper を、一つの同期 ctx.run にする。
2. **境界として残すもの**：server/client の別ファイル、type/runtime の clientModule 参照、実際の input parser、SSR template と新 child 専用 template、イベントの書き戻し先、operation と resource の寿命。
   名前を減らしても、これらの意味を消したり推測したりしない。
3. **B の推奨**：trusted structural profile とする。own getter/plain prototype を要求せず、full protocol fake は排除しない。native provenance が必要なら、明示許可された engine introspection scope を選ぶ。
4. **C の推奨**：owned readonly payload/外部 setter 引数の隔離、failed receive の publication gate、最後の callback の pin を契約に加える。これらは未採用の追加である。
5. **次に実行する検証**：実際の Signal 型と縮小 API の型を調べる P01、capture/alias/facade を調べる P03 の二つに限定する。
   この割当では実験を開始しない。

## 0. 根拠と判定の単位

最新の方向決定は `tmp/dathomir-262-section1-review-status.md` と会話の明示的指示による。
メモの「①まで」という旧制限は今回の全体レビュー拡張によって解除されているが、①の完了は宣言しない。
R2 と独立 coverage の 58 項目、canonical の 27 候補、元の七場面 F/C/B/D/M/T/L は残す。
数は網羅性の索引であり、正しさの証拠ではない。

canonical reference は worktree `dathomir-proposal-262-authoring-api`、確認した HEAD は `0ad07bffd601fef7cd708276942b187883ea787e`。
Accepted #253/#260 の immutable association、server authority、no replay、zero-root、terminal admission、独立 child の rollback 除外を変更しない。
#260 の古い Status.Proposed 表記を、採用済み判断の再開理由にしない。
現在の package API が新しい facade や bind を実装しているとも扱わない。

A の成立性を判断するため、現 checkout の次の SPEC、test source、型を限定して読んだ。

- reactivity の signal SPEC/test、公開 Signal 型、公開 index。
- createRoot と onCleanup の SPEC、対応 test の nested/dispose/throw cases。
- runtime の events SPEC/test と AGENTS。
- dom/attr SPEC/test、spread SPEC、Input intrinsic 型、reconcile SPEC。
- core package exports と canonical 262/253/260 の authoring、package、failure contract。

現在の setAttr/setProp は低水準の更新先を区別できるが、immutable admission や IME 保護を証明しない。
event の cleanup と root の nested disposal は再利用の足場である。
current reconcile は単一 Node と create/update callback を扱い、SSR child、fragment extent、明示的権限の実装証明ではない。
公開 untrack の SPEC/test はこの場所に見つからず、receive の dependency isolation を既存 API 一つで済ませると主張しない。
ソースのテストを読んだだけで、今回テストを実行したことにはしない。

## A. 作者が覚える契約を減らす

### A01. API 数だけで単純さを判断しない

**要求と問い**：R2 は約 44 の surface を挙げた。
counter と通常の行編集にも、自律 child 用の仕組みを要求していないか。
**推奨**：基本、DOM placement、自律 child、通信、寿命の五つの作者概念に整理する。
基本例には任意の拡張を要求せず、同じ profile/能力を二つの string で選ぶ登録を除く。

ここで数える callable は、R2 の import/helper 19 個と ctx method 10 個の合計 29 個である。
型、option、context field、native DOM API は別に数える。
focus()/returned release()/cancel() と callback fields も別 inventory に明示しており、上の29→23は top-level helper と ctx method に限定した同じ数え方である。
縮小案は import/helper 14 個、ctx method 9 個で 23 個となる。
六つ減ること自体ではなく、factory の再選択、場所と helper の二重指定、不要な wrapper の三つの重複を減らす点を評価する。

**最も強い代案**：R2 の分離名を維持し、初心者向け facade を別に足す。
専門用途の明示性を保てるが、二つの public API を覚える負担と adapter 間の差が増えるので今回は選ばない。
**失敗ケース**：低い名前数のため cleanup/validation を任意 callback の責任へ押し戻す。
これを縮小とは数えない。
**状態と gate**：新提案。
#247 は型と登録、#249 は public-path の成立性を検証する。

### A02. bind の適用先を配置から明示する

**要求と問い**：利用者は bind を display marker と決め、kind/child option を拒否した。
R2 の prop/attr が別名で必要か。
**推奨**：三種類の helper を一つの bind にまとめ、el の明示した配置先で更新方法を決める。

```ts
// R2
el("input", {
  "aria-invalid": attr("invalid", { server: "false" }),
  props: { value: prop("draftText", {
    server: values.draft.value, input: { sink: "setDraft" },
  }) },
});

// Reduced proposal
el("input", {
  "aria-invalid": bind("invalid", { server: "false" }),
  props: { value: bind("draftText", {
    server: values.draft.value, input: { sink: "setDraft" },
  }) },
});
el("p", {}, bind("message", { server: "Ready" }));
```

content の bind は text、empty、element、fragment、許可済み child intent を動的に表示する。
通常属性の場所は reflected attribute、props の場所は live property である。
これは初期結果の型を固定する仕組みではなく、作者が明示した DOM 更新先の違いである。
attribute の場所へ child DOM を返せば、placement と関数名を示す runtime diagnostic にする。
bind/on の補完は双方とも全登録名を提示し、getter/operation の型で絞らない。

input は writable control を選ぶ場合の新しい optional bind option で、sink は flat function 名である。
getter から setter を推測しない。
input.group は複数 control を一つの draft として調停するときだけ明示する。
保守的な競合保持を標準にし、R2 の単一選択肢 conflict:"hold" は public option から外す。
解決は明示 edit/commit、または app が選んだ draft の採用であり、未知の入力履歴から勝者を決めない。
group 競合中の app 解決は sink のモデル結果と宣言済み各 control の一致を検査して解除する。
不一致のまま ctx.refresh しただけでは解除しない。
接続時の競合を解く次の観測済み explicit edit/commit は、その source revision と sink の結果を新しい group 値として扱う。
他 control が known/unknown composition に保護されていなければ、宣言済み peer property をその値へ同期して一致を再検査する。
保護中の peer は更新を保留し、native 確定境界まで pending を表示する。
単に getter が異なる値を返したことを解決の意思と推測しない。
強制上書き API を暗黙に加えない。
任意の per-key formatter/caret mapping は追加 adapter の review 対象である。

boolean attribute は true で存在、false/null で不在にする。
ARIA の false は文字列 "false" として返す。
current setAttr の boolean 処理を、そのまま全 ARIA policy の証拠にしない。
property value/checked と attribute value/checked の違いは配置として残る。

**最も強い代案**：prop/attr を残す。
誤った配置の説明が短くなるが、props.value と prop の二重指定は境界を増やさない。
縮小案でも props map を省略しないので、更新先は曖昧にならない。
**失敗ケース**：Promise/live Node/raw HTML、input option の attribute/content 使用は plan error。
新しい DOM を作って SSR admission mismatch を修復しない。
**状態と gate**：bind 名、server 内容、動的 content は方向決定。
placement 統合と input option は新提案。
#247 の型、#249 の input/adoption が gate。

### A03. native draft と explicit sink を両方残す

**要求と問い**：編集するすべての文字を Signal に通す必要があるか。
**推奨**：native-owned draft は通常の props.defaultValue/defaultChecked と FormData で扱う。
controlled draft は props.value/checked の bind と明示 sink を使う。
R2 の独自 defaults record をなくし、native property の名前を使う。

同値の property 書き込みは省く。
既存 SSR control の default と native draft を接続時に再初期化しない。
defaultValue は reset baseline を表し、dirty な現在値を「サーバー値へ戻す」操作ではない。
active な default 更新は native adapter の明示契約であり、dirty flag や IME を履歴から推定しない。
checkbox/radio/select の native default と選択集合の違いは個別 adapter の gate に残す。
selectedValues のような semantic property は native に存在すると偽らず、採用する adapter の登録を必要とする。

controlled sink の admission 順序は R2 を維持する。
preflight read → provisional slots/capture listener → latest native read/synchronous model-only sink → commit 前 revision 再照合 → commit → automatic refresh。
失敗時は staged slots を捨て、SSR node と現在の native edit を残す。
acquisition 後 failure は terminal で、same identity を再初期化しない。
pre-bootstrap composition の履歴は回収できないため、unknown editable control への異なる整形値は確定境界まで保留する。
content bind の自動 refresh は通常どおり行う。

**最も強い代案**：controlled-only。
検索や validation には便利だが、native form、IME、複数 step の draft を不必要にモデルへコピーする。
native-only も async feedback が必要なフォームでは不十分なので一律選択しない。
**失敗ケース**：native-owned input の reorder/removal による focus/selection は key だけで証明しない。
**状態と gate**：新提案。
F/T/M を含む #249 の実ブラウザ gate。

### A04. 一つの client definition に一つの browser 作成プロフィールを持たせる

**要求と問い**：R2 の default client、named factory、creation string、receiver string、parser を別々に関連付ける必要があるか。
**推奨**：flat defineClient の任意の第二引数に create profile を置く。
普通の counter は第二引数を使わない。
default client identity と profile identity を一つにし、SSR の clientModule は採用済みの二引数を保つ。

```ts
// R2
const Client = defineClient({ draftText, setDraft, receiveRow });
const NewRow = defineCreatedComponent({
  client: Client, input: parseRowInput, initialize: createRowValues,
  receive: "receiveRow", view: browserOnlyTemplate,
});
clientModule<typeof Client>("./row.client.js", import.meta.url, { creation: "NewRow" });
createComponent(NewRow, { _key: row.id, input: row });

// Reduced proposal, not adopted
const Client = defineClient({ draftText, setDraft, receiveRow }, {
  create: {
    input: parseRowInput,
    initialize: createRowValues,
    template: browserOnlyTemplate,
    receive: "receiveRow",
  },
});
clientModule<typeof Client>("./row.client.js", import.meta.url);
createComponent(Client, { _key: row.id, input: row });
```

create は registry の容器ではなく、optional lifecycle metadata である。
第一引数は flat な function 登録だけであり、そこに bindings/operations の分類を導入しない。
SSR server/template と browser create.template は別の実装である。
SSR child の接続で initialize/create.template を実行しない。
純粋な createComponent は intent を返し、absent key の公開準備段階だけで新 state を初期化する。

manifest は、明示 clientModule の actual default export とその唯一の create profile、parser/receiver code reference を記録する。
server の input:parseRowInput は public DTO を許可して immutable initial seed を作るために残す。
browser の create.input は実際の incoming DTO 検証のために残す。
両者は同じ neutral parser export identity であることを照合する。
型や関数名の一致だけでこの権限を保証しない。
profile が存在しない、parser が違う、receiver 名が callable でない場合、SSR の retained-child input を許可しない。
flat default に後から別 factory を差し込んで SSR child の権限を変えない。

new-only child は、browser graph の explicit client catalog 内の client definition とその create profile から作る。
catalog の全 profile が response の全 child slot を開くわけではない。
parent は宣言 bind の containment 外や child の private slot に触れない。
profile のない client definition でも普通の SSR-only interactive component として使える。
SSR と同形の browser creation を必須にしない。

**最も強い代案**：R2 の named factory を維持する。
同じ default behavior に複数の独立 creation schema/view を結びやすい。
しかし普通の reusable row の選択名が二つになるため、基本形には選ばない。
異なる autonomous 契約は小さな別 entry module の default として表し、behavior/model/formatter の通常 import は再利用する。
一つの profile 内の合法な見た目の違いは validated input で表せる。
複数 schema に一つの behavior を付ける用途で entry 分割が実際に負担なら、named profile extension を別 review する。
その用途を unsupported と宣言するための単純化ではない。
**失敗ケース**：same key でも異なる client identity は新 lifetime への active replacement。
failed admission の補修や immutable seed の書換えには使わない。
**状態と gate**：第二引数 create と createComponent の client-definition 受入れは新提案。
#247 の module inventory、#249 の SSR retention/new creation が gate。

### A05. parser と receive は別の責務として残す

**要求と問い**：実際の parser/receiver まで消せるか。
**推奨**：parser は unknown を normalized public DTO に変える普通のアプリ関数、receive は flat registry の同期 model-only function とする。
constructor、受信、初期 SSR authority を一つの callback にまとめない。

同じ normalized DTO の再評価は receive を呼ばない。
初回 SSR seed と同値ならゼロ回、changed input は child commit 後に一回。
new child は initialize(input) を baseline とし、直後に同じ receive を二度呼ばない。
producer の dependency tracking を閉じ、親の plan 公開が成功した後に receive を実行する。
receive は emit/request/resource/focus を行わず、dirty draft を保持するかはアプリの model policy とする。
stale generation は捨て、同じ key の unchanged input は no-op。
フィードバック循環の検出、失敗 input の自動再実行抑止は R2 の契約を残す。

**最も強い代案**：slot と input field の automatic copying。
単純な label では短くなるが、dirty draft、version、checkpoint の意味を推測することになる。
ordinary JS にも同じ受信 policy が必要なので採用しない。
**失敗ケース**：receive で label は更新しても dirty draft を上書きしない。
Beta pending の後に Gamma を受け取れば Gamma だけを届ける。
**状態と gate**：新提案。
T/C/M、#249 の convergence gate。

### A06. operation の選択と lifetime helper の役割を絞る

**要求と問い**：ctx.guard/isCurrent/timeout/onDispose、四つの scheduling がすべて必要か。
**推奨**：guard と isCurrent を一つの ctx.run(callback) にまとめる。
callback は同期のみで、owner/lease/channel token が無効なら評価せず undefined を返す。
async の後と外部 source の callback を同じ形で守る。
新しい lease や resource を暗黙に作る関数ではない。

```ts
// R2
if (!ctx.isCurrent()) return;
ctx.values.status.set("Ready");
source.onmessage = ctx.guard(event => apply(event));

// Reduced proposal
ctx.run(() => ctx.values.status.set("Ready"));
source.onmessage = event => ctx.run(() => apply(event));
```

async 前に読み取る必要のある DTO と native event snapshot は、run の外で一度保存する。
run の中で source version/revision をさらに照合する。
synchronous run を万能 transaction/rollback としない。
run 内で発生した error は active error として報告する。
stale write の最後の防御は guarded values と owned display commit の側にも必要である。
plain ctx.input/event 値を読めても、dead owner を復活させない。

onDispose と timeout は残す。
native setTimeout + onDispose + unregister + token guard を毎回作者に組ませるより、Copy feedback の timer を一つの owned primitive にする方が短い。
arbitrary subscription は onDispose が stop を所有し、run が遅延 callback の有効性を検査する。
abortSignal は fetch の中断要求を表し、network mutation の取り消しを保証しない。

operation の Promise 完了と resource lease 完了を分ける。
Copy timer や mount subscription は function の return 後も必要なためである。
replace は pending operation と completed lease を終了する。
parallel は sibling lease を失効させない。
join は pending Promise のみ共有し、queue は Promise settle で次を始める。
この四方針は enum の選択で残し、新しい四 helper を増やさない。
既定は parallel、既定 channel は owner 内の登録 function 名とする。
異なる宣言を同じ channel で置換する場合だけ channel を書く。
mutation の commandId/expectedVersion は scheduling と別に必要である。

**最も強い代案**：AbortSignal と native APIs だけにする。
中断を無視する応答、copy timer、Promise 完了後の subscription の処理を毎アプリが実装することになる。
lease の誤用を減らすための縮小にならないので選ばない。
R2 の guard/isCurrent を残す方が read-only liveness query はしやすいが、先に検査して後から書く split を避けるため run を選ぶ。
**失敗ケース**：join 済み Promise と残る timer を混同しない。
stop が throw してもほかの stop を続ける。
**状態と gate**：ctx.run と既定値は新提案。
D/L/M、#249 の operation/lease gate。

### A07. request/delivery の wrapper だけを消す

**要求と問い**：request({input,output,handle}) と delivery({input,render}) に別 constructor が必要か。
**推奨**：defineComponent の requests/deliveries 内の ordinary record を検査する。
境界はその宣言位置にあり、wrapper がなければ成立しない意味を追加しない。

```ts
// R2
requests: { check: request({ input: parseInput, output: parseReply, handle }) },
deliveries: { results: delivery({ input: parseQuery, render }) },

// Reduced proposal
requests: { check: { input: parseInput, output: parseReply, handle } },
deliveries: { results: { input: parseQuery, render } },
```

handle/render は server module に残る。
input/output parser、認証、DTO、operation の書き込み guard を省かない。
fresh delivery の response/target validation と destination-first switch を維持する。
ctx.request と ctx.deliver は異なる authority を持つため残す。
ctx.deliver に DTO request の実行や initial template の browser replay を混ぜない。

**最も強い代案**：単一 request の response union に UI と DTO を入れる。
名前は一つ減るが、model update と new server-owned UI の admission/disposal を全 call-site で判別する負担が増える。
plain record にして共通 transport 内部を再利用する方を選ぶ。
**失敗ケース**：latest-wins は server mutation の冪等性ではない。
failed destination が source を先に dispose しない。
**状態と gate**：wrapper 除去は新提案。
explicit communication は Accepted の維持。
#248 と #247 の contextual typing が gate。

### A08. 減らさない helper の理由

| 残すもの | 残す理由と失敗の境界 |
|---|---|
| fragment({_key?},...) | valid table/wrapperless group の persistent extent。element wrapper に置き換えると実用例が変わる。未採用 |
| createComponent(Client,{_key,input}) | ordinary el とは違う local state/lifetime の明示 intent。el の tag から ownership を推測しない |
| id(local) と _ref | repeated label/ARIA と focus/FormData の既知 target。global ID collision と DOM scan を避ける |
| mount(name,options) | commit 後の resource 接続を producer evaluation と分ける。既存 SSR setup の replay にしない |
| ctx.control / ctx.formData | known target の focus と native successful controls。raw Node への無制限 mutation 権限にしない |
| ctx.emit / ctx.received | independent owner 間の明示 DTO。borrowed state と implicit cross-owner sharing を混同しない |
| retain() | partial server delivery の content を binding producer が明示保持する。undefined を誤記と区別する |
| ctx.refresh / onError | intact active range の再評価と、healthy error 表示。terminal admission を再試行しない |
| history と ctx.navigation | Back draft policy をアプリが選ぶ。disposed response identity を復活させない |

最も強い代案は、これらを一つの raw DOM/async extension callback に委ねる形である。
API は短くなるが、所有権の境界、失敗後の回復、通常の JS 診断が作者ごとの規約になる。
明示性に実際の効果がある helper は残す。

## A.9 名前と option の差分一覧

「除去」はこの縮小候補から外すという意味で、canonical API を削除したという意味ではない。

| 分類 | 変わらないもの | 新しい形 | 外す R2 surface |
|---|---|---|---|
| 基本と値 | defineComponent、server/template、flat defineClient、ordinary signal/unified return、clientModule の二引数 | defineClient 第二引数 create は optional | clientModule.creation string、named factory export selection |
| 表示 | bind(name,{server})、el pure description、_key、id、_ref/_ns、on/mount、fragment | attribute/content/props の配置で bind を解釈、bind.input | prop、attr、input.conflict:"hold" |
| native draft | native form、FormData、default semantics | props.defaultValue/defaultChecked | 独自 defaults record |
| 自律 child | explicit input parser、receive 名、initialize/new-only template、createComponent intent | profile を default client に所属させ、createComponent(Client,...) | defineCreatedComponent、profile.client、named NewRow の再指定、view という別名 |
| communication | requests/deliveries の宣言、ctx.request/ctx.deliver、history | maps の ordinary declaration record | request()/delivery() wrapper |
| lifetime | onDispose、timeout、abortSignal、operation/lease、channel/concurrency | ctx.run(syncCallback) | ctx.guard、ctx.isCurrent |
| role/type/diagnostic | ClientContext、RequestContract、ctx.values/ui/event/input/received/navigation/error、onError、refresh | ctx.event.ref は declared _ref の文字列を返す | role-based completion filter は導入しない |
| route/build | defineRoute({render})、defineDelivery({routes:{url:{server}}})、explicit awaited component/request | R2 と同じ reference-index proposal | 新しい package path/route syntax は追加しない |

public callback fields は create.{input,initialize,template,receive}、component.input/server/template/requests/deliveries/history/onError。
request entry は input/output/handle、delivery entry は input/render。
callback body を compiler に抽出させない。
constructor を消しても、これらが API であることは inventory から隠さない。

on/mount の option は capture/passive/once/preventDefault（on のみ）、channel/concurrency。
concurrency は parallel/replace/join/queue。
bind は server、property 用 input:{sink,group?}。
SSR template では server が actual content、new-only browser template では server を省略する。
createComponent は _key/input、fragment は _key?、el の reserved metadata は _key/_ref/_ns/on/props/mount。
id は local、ctx.control は ref と focus()、ctx.formData は formRef。
ctx.emit(name,DTO)、request(name,DTO)、deliver(target,DTO,{history?})、refresh(name)、run(callback)、onDispose(stop)、timeout(callback,delay) が public method である。
onDispose は idempotent release()、timeout は cancel() を返す。
history の onPop/channel/concurrency と delivery の url/mode/data は R2 を維持する。
new child だけの内部 lifetime API、raw target discovery、public child update/move/dispose handles は増やさない。

## A.10 四つの作者例

以下は縮小案の一貫した source sketch である。
未実装の facade、ClientContext の型と defineClient の第二引数を、現在使える package export と混同しない。
ctx 引数は明示的に型を付け、template の typed tools だけが proposed contextual typing に依存する。
TS の型 import は消えるが、runtime の clientModule 参照との一致は build/admission の別検査である。

### 例1. counter は二つの component file で書く

```ts
// counter.server.ts
import { defineComponent, clientModule, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import type CounterClient from "./counter.client.js";

type CounterValues = {
  count: Signal<number>;
  theme: Signal<string>;
  title: string;
};
const Counter = defineComponent({
  client: clientModule<typeof CounterClient>("./counter.client.js", import.meta.url),
  server(input: { start: number; title: string }): CounterValues {
    return { count: signal(input.start), theme: signal("snapshot-midnight"), title: input.title };
  },
  template(values, { bind, on }) {
    return el("section", {},
      el("p", {}, bind("themeText", { server: values.theme.value })),
      el("p", {}, bind("countText", { server: `${values.title}: ${values.count.value}` })),
      el("button", { type: "button", on: [on("click", "increment")] }, "+1"),
    );
  },
});
export type { CounterValues };
export { Counter };
```

```ts
// counter.client.ts
import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { CounterValues } from "./counter.server.js";

function countText(ctx: ClientContext<CounterValues>) {
  return `${ctx.values.title}: ${ctx.values.count.value}`;
}
function themeText(ctx: ClientContext<CounterValues>) { return ctx.values.theme.value; }
function increment(ctx: ClientContext<CounterValues>) {
  ctx.values.count.set(previous => previous + 1);
}
export default defineClient({ countText, increment, themeText });
```

client の parameter 型は明示 CounterValues、server の return 型も明示 CounterValues なので、typeof Counter の循環推論に依存しない。
type-only 相互参照は型検査の dependency であり、runtime cycle ではない。
ただし browser 側 tsconfig が server module の型を読むための環境を用意する費用は残る。
public DTO/values を neutral types file に移す代案も有効であり、別 file が必須とはしない。
JavaScript は type import/annotation を省略する。
JS に TS completion と同じ保証があると主張しない。

同じ Counter を 7 と 40 で二回 SSR しても state は別 owner に復元する。
plain title は readonly、theme/count は browser-local restored slot。
Count 7→8、snapshot-midnight、繰り返し接続で listener が増えないことが primary baseline である。

### 例2. 普通の編集一覧は自律 child を作らない

各 row の native draft を保ち、Save でまとめて model に反映するフォームである。
reorder で DOM control を保持する必要があり、各 row に独自 Signal/receiver は必要ない。

```ts
// editable-list.server.ts
import { defineComponent, clientModule, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import type ListClient from "./editable-list.client.js";
type Item = { id: string; label: string };
type ListValues = { rows: Signal<readonly Item[]>; message: Signal<string>; rich: Signal<boolean> };
const EditableList = defineComponent({
  client: clientModule<typeof ListClient>("./editable-list.client.js", import.meta.url),
  server(_input: Record<string, never>): ListValues {
    return {
      rows: signal<readonly Item[]>([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]),
      message: signal("Edit labels and save"), rich: signal(false),
    };
  },
  template(values, { bind, on, id }) {
    const serverRows = values.rows.value.map(item => el("li", { _key: item.id },
      el("label", { for: id(item.id) }, "Label"),
      el("input", { id: id(item.id), name: `label:${item.id}`,
        props: { defaultValue: item.label } }),
      el("button", { type: "button", _ref: item.id,
        on: [on("click", "remove")] }, "Remove"),
    ));
    return el("form", { _ref: "rows-form",
      on: [on("submit", "save", { preventDefault: true })] },
      el("ul", {}, bind("rows", { server: serverRows })),
      el("p", {}, bind("message", { server: values.message.value })),
      el("button", { type: "button", on: [on("click", "add")] }, "Add"),
      el("button", { type: "button", on: [on("click", "reverse")] }, "Reverse"),
      el("button", { type: "button", on: [on("click", "toggleRich")] }, "Toggle status style"),
      el("button", { type: "submit" }, "Save"),
    );
  },
});
export type { Item, ListValues };
export { EditableList };
```

```ts
// editable-list.client.ts
import { defineClient, el } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { ListValues } from "./editable-list.server.js";
type ListContext = ClientContext<ListValues>;
function rows(ctx: ListContext) {
  const { id, on } = ctx.ui;
  return ctx.values.rows.value.map(item => el("li", { _key: item.id },
    el("label", { for: id(item.id) }, "Label"),
    el("input", { id: id(item.id), name: `label:${item.id}`,
      props: { defaultValue: item.label } }),
    el("button", { type: "button", _ref: item.id,
      on: [on("click", "remove")] }, "Remove"),
  ));
}
function message(ctx: ListContext) {
  return ctx.values.rich.value
    ? el("strong", {}, ctx.values.message.value)
    : ctx.values.message.value;
}
function add(ctx: ListContext) {
  ctx.values.rows.set(previous => [
    ...previous, { id: crypto.randomUUID(), label: "New row" },
  ]);
}
function reverse(ctx: ListContext) {
  ctx.values.rows.set(previous => [...previous].reverse());
}
function remove(ctx: ListContext) {
  const id = ctx.event.ref;
  if (typeof id !== "string") throw new Error("Missing declared row control ref");
  ctx.values.rows.set(previous => previous.filter(item => item.id !== id));
}
function toggleRich(ctx: ListContext) {
  ctx.values.rich.set(previous => !previous);
}
function save(ctx: ListContext) {
  const form = ctx.formData("rows-form");
  const updated = ctx.values.rows.value.map(item => {
    const draft = form.get(`label:${item.id}`);
    if (typeof draft !== "string") throw new Error("Expected row label text");
    return { id: item.id, label: draft };
  });
  ctx.values.rows.set(updated);
  ctx.values.message.set("Saved locally; server persistence is a separate request");
}
export default defineClient({ rows, message, add, reverse, remove, toggleRich, save });
```

最初の client rows が SSR と同じなら、既存 input を保持し、typed native draft を再作成しない。
a/b の反転は同じ control を移し、empty list は child state を残す隠蔽ではなく除去になる。
message は SSR text → strong DOM → text を同じ bind で表す。
新しい row の description は純粋で、実 DOM と listener は runtime の公開準備で作る。
Save の server 永続化は意図的に含めず、次の explicit request の形を使う。
focused/composing row の reorder は R2 の保留 policy とブラウザ gate を残す。

### 例3. dirty draft を持つ autonomous row

この場合は incoming label と local draft を分け、dirty draft を external update から守る。
shared model helper は neutral module に置き、server-specific input acquisition と browser creation permission を混ぜない。

```ts
// row.model.ts
import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
type RowInput = { id: string; label: string };
type RowValues = {
  id: string; incoming: Signal<string>; draft: Signal<string>; dirty: Signal<boolean>;
};
function parseRowInput(raw: unknown): RowInput {
  if (typeof raw !== "object" || raw === null ||
      !("id" in raw) || typeof raw.id !== "string" ||
      !("label" in raw) || typeof raw.label !== "string") {
    throw new Error("Expected row id and label");
  }
  return { id: raw.id, label: raw.label };
}
function createRowValues(input: RowInput): RowValues {
  return {
    id: input.id, incoming: signal(input.label), draft: signal(input.label), dirty: signal(false),
  };
}
export type { RowInput, RowValues };
export { parseRowInput, createRowValues };
```

```ts
// row.client.ts
import { defineClient, el } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import { parseRowInput, createRowValues } from "./row.model.js";
import type { RowInput, RowValues } from "./row.model.js";
type RowContext = ClientContext<RowValues, {}, {}, RowInput>;
function draftText(ctx: RowContext) { return ctx.values.draft.value; }
function dirtyText(ctx: RowContext) { return ctx.values.dirty.value ? "Unsaved" : ""; }
function setDraft(ctx: RowContext) {
  ctx.values.draft.set(ctx.input.value);
  ctx.values.dirty.set(ctx.input.reason !== "reset");
}
function receiveRow(ctx: RowContext) {
  const incoming = ctx.received;
  if (incoming.id !== ctx.values.id) throw new Error("Row business identity changed");
  ctx.values.incoming.set(incoming.label);
  if (!ctx.values.dirty.value) ctx.values.draft.set(incoming.label);
}
function remove(ctx: RowContext) { ctx.emit("row-remove", { id: ctx.values.id }); }
const RowClient = defineClient({ draftText, dirtyText, setDraft, receiveRow, remove }, {
  create: {
    input: parseRowInput,
    initialize: createRowValues,
    receive: "receiveRow",
    template(values, { bind, on, id }) {
      return el("li", {},
        el("label", { for: id("draft") }, "Row label"),
        el("input", { id: id("draft"), name: "label", props: {
          value: bind("draftText", { input: { sink: "setDraft" } }),
        } }),
        el("span", { "aria-live": "polite" }, bind("dirtyText")),
        el("button", { type: "button", on: [on("click", "remove")] }, "Remove"),
      );
    },
  },
});
export default RowClient;
```

```ts
// row.server.ts
import { defineComponent, clientModule, el } from "@dathra/core/server";
import type RowClient from "./row.client.js";
import { parseRowInput, createRowValues } from "./row.model.js";
import type { RowInput, RowValues } from "./row.model.js";
const Row = defineComponent({
  client: clientModule<typeof RowClient>("./row.client.js", import.meta.url),
  input: parseRowInput,
  server(input: RowInput): RowValues { return createRowValues(input); },
  template(values, { bind, on, id }) {
    return el("li", {},
      el("label", { for: id("draft") }, "Row label"),
      el("input", { id: id("draft"), name: "label", props: {
        value: bind("draftText", { server: values.draft.value, input: { sink: "setDraft" } }),
      } }),
      el("span", { "aria-live": "polite" }, bind("dirtyText", { server: "" })),
      el("button", { type: "button", on: [on("click", "remove")] }, "Remove"),
    );
  },
});
export { Row };
```

SSR existing child の接続では createRowValues/initialize/server/template を再実行せず、snapshot から local slots を復元する。
createRowValues を browser から import するのは新 child の公開前 initialization に限る。
neutral input/model code まで server-only とみなす必要はないが、DB、secret、server request を含む initializer は共有できない。
SSR template と browser template の構造は二か所に書いている。
これは利用者が拒否した initial template sharing を避け、新 creation authority を明示するための実際の重複である。

```ts
// autonomous-list.client.ts
import { defineClient, createComponent } from "@dathra/core/client";
import RowClient from "./row.client.js";
import type { ClientContext } from "@dathra/core/client";
import type { AutonomousValues } from "./autonomous-list.server.js";
type ListContext = ClientContext<AutonomousValues>;
function rows(ctx: ListContext) {
  return ctx.values.items.value.map(item =>
    createComponent(RowClient, { _key: item.id, input: item }));
}
function add(ctx: ListContext) {
  ctx.values.items.set(previous => [...previous, { id: crypto.randomUUID(), label: "New" }]);
}
function reverse(ctx: ListContext) {
  ctx.values.items.set(previous => [...previous].reverse());
}
function update(ctx: ListContext) {
  ctx.values.items.set(previous => previous.map((item, index) =>
    index === 0 ? { ...item, label: item.label + "!" } : item));
}
function remove(ctx: ListContext) {
  const detail: unknown = ctx.event.detail;
  if (typeof detail !== "object" || detail === null ||
      !("id" in detail) || typeof detail.id !== "string") throw new Error("Expected row id");
  const id = detail.id;
  ctx.values.items.set(previous => previous.filter(item => item.id !== id));
}
export default defineClient({ rows, add, reverse, update, remove });
```

```ts
// autonomous-list.server.ts
import { defineComponent, clientModule, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import type ListClient from "./autonomous-list.client.js";
import type { RowInput } from "./row.model.js";
import { Row } from "./row.server.js";
type AutonomousValues = { items: Signal<readonly RowInput[]> };
const AutonomousList = defineComponent({
  client: clientModule<typeof ListClient>("./autonomous-list.client.js", import.meta.url),
  server(_input: Record<string, never>): AutonomousValues {
    return { items: signal<readonly RowInput[]>([{ id: "a", label: "Alpha" }, { id: "b", label: "Beta" }]) };
  },
  async template(values, { bind, on }, request: Request) {
    const initial = await Promise.all(values.items.value.map(item =>
      Row(item, request, { _key: item.id })));
    return el("section", {},
      el("ul", { on: [on("row-remove", "remove")] }, bind("rows", { server: initial })),
      el("button", { type: "button", on: [on("click", "add")] }, "Add"),
      el("button", { type: "button", on: [on("click", "reverse")] }, "Reverse"),
      el("button", { type: "button", on: [on("click", "update")] }, "Update first"),
    );
  },
});
export type { AutonomousValues };
export { AutonomousList };
```

parent ul の on は明示した containment message port で、raw DOM bubbling による child ownership 推論ではない。
同じ a/b intent は recorded default/profile/input seed と照合し、SSR child を保持する。
変更 input のみ receive、reorder は compatible extent を移動、remove は child-local cleanup。
再追加は fresh token。
初期 SSR と一致しない client factory を同じ a/b に載せて admission を修復しない。

| transition | 期待する state と DOM |
|---|---|
| Alpha seed → 同値の新 object | receive 0 回、initialize 0 回、既存 node/state を保持 |
| Alpha → Beta、clean | receive 1 回、incoming と draft を Beta に |
| Alpha → Beta、draft が dirty | receive 1 回、incoming のみ変更、local draft を保持 |
| queued Beta → newer Gamma | 古い pending Beta は捨て、Gamma を一回適用 |
| absent c → intent c | parser → provisional initialize/template 一回 → validate → publish |
| c remove → c readd | stop 後、fresh state/token。disposed response identity を復活させない |
| tag/ns/client identity change | 明示 active replacement。初期 admission mismatch の修復にはしない |
| child admission failure | parent/sibling の independently active child を rollback しない |

### 例4. async feedback は explicit sink と run で書く

フォームは string draft を保持し、blur で read-only server check を行う。
validation の返答は現在の draft revision と一致するときだけ反映する。
日本語 IME の履歴や caret を server に委ねない。

```ts
// input-form.server.ts
import { defineComponent, clientModule, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import type FormClient from "./input-form.client.js";
type CheckInput = { text: string; revision: number };
type CheckReply = { revision: number; message: string };
type FormValues = { draft: Signal<string>; revision: Signal<number>; error: Signal<string> };
function parseCheckInput(raw: unknown): CheckInput {
  if (typeof raw !== "object" || raw === null ||
      !("text" in raw) || typeof raw.text !== "string" ||
      !("revision" in raw) || typeof raw.revision !== "number" ||
      !Number.isSafeInteger(raw.revision) || raw.revision < 0) throw new Error("Expected text and revision");
  return { text: raw.text, revision: raw.revision };
}
function parseCheckReply(raw: unknown): CheckReply {
  if (typeof raw !== "object" || raw === null ||
      !("revision" in raw) || typeof raw.revision !== "number" ||
      !Number.isSafeInteger(raw.revision) ||
      !("message" in raw) || typeof raw.message !== "string") throw new Error("Expected validation reply");
  return { revision: raw.revision, message: raw.message };
}
const InputForm = defineComponent({
  client: clientModule<typeof FormClient>("./input-form.client.js", import.meta.url),
  requests: {
    check: {
      input: parseCheckInput, output: parseCheckReply,
      async handle(input: CheckInput, _request: Request): Promise<CheckReply> {
        return { revision: input.revision,
          message: input.text.trim().length === 0 ? "Enter a display name" : "" };
      },
    },
  },
  server(_input: Record<string, never>): FormValues {
    return { draft: signal(""), revision: signal(0), error: signal("") };
  },
  template(values, { bind, on, id }) {
    return el("div", {},
      el("label", { for: id("name") }, "Display name"),
      el("input", {
        id: id("name"), name: "displayName", type: "text",
        "aria-describedby": id("name-error"),
        "aria-invalid": bind("invalid", { server: "false" }),
        props: { value: bind("draftText", {
          server: values.draft.value, input: { sink: "setDraft", group: "name-draft" },
        }) },
        on: [on("blur", "validate", { channel: "validation", concurrency: "replace" })],
      }),
      el("p", { id: id("name-error"), "aria-live": "polite" }, bind("errorText", { server: "" })),
    );
  },
});
export type { CheckInput, CheckReply, FormValues };
export { InputForm };
```

```ts
// input-form.client.ts
import { defineClient } from "@dathra/core/client";
import type { ClientContext, RequestContract } from "@dathra/core/client";
import type { FormValues, CheckInput, CheckReply } from "./input-form.server.js";
type FormContext = ClientContext<FormValues, { check: RequestContract<CheckInput, CheckReply> }>;
function draftText(ctx: FormContext) { return ctx.values.draft.value; }
function errorText(ctx: FormContext) { return ctx.values.error.value; }
function invalid(ctx: FormContext) { return ctx.values.error.value === "" ? "false" : "true"; }
function setDraft(ctx: FormContext) {
  ctx.values.draft.set(ctx.input.value);
  ctx.values.revision.set(previous => previous + 1);
}
async function validate(ctx: FormContext) {
  const revision = ctx.values.revision.value;
  const text = ctx.values.draft.value;
  try {
    const reply = await ctx.request("check", { text, revision });
    ctx.run(() => {
      if (reply.revision === ctx.values.revision.value) ctx.values.error.set(reply.message);
    });
  } catch (error) {
    ctx.run(() => {
      if (revision === ctx.values.revision.value) {
        ctx.values.error.set("Validation unavailable; edit or blur to retry");
      }
    });
  }
}
export default defineClient({ draftText, errorText, invalid, setDraft, validate });
```

input は draft/revision を同期更新し、composing/unknown native draft へ整形値を assign しない。
別 control が同じ name-draft group を持つ場合も、同じモデルへ書くという対応は明示宣言である。
native edit と外部値が競合したら、current draft と pending/version をアプリが表示する。
read-only check の例は通信宣言を示すもので、server-side name validation の妥当性、認証、保存の証拠ではない。
実 mutation の submit は commandId/expectedVersion と実際の認証を持つ別 entry にする。

### 共通 route/build と import graph

```ts
// review-route.server.ts
import { defineRoute, el } from "@dathra/core/server";
import { Counter } from "./counter.server.js";
import { EditableList } from "./editable-list.server.js";
import { AutonomousList } from "./autonomous-list.server.js";
import { InputForm } from "./input-form.server.js";
const route = defineRoute({
  async render(request: Request) {
    return el("main", {},
      await Counter({ start: 7, title: "Count" }, request),
      await Counter({ start: 40, title: "Other count" }, request),
      await EditableList({}, request),
      await AutonomousList({}, request),
      await InputForm({}, request),
    );
  },
});
export default route;
```

```ts
// dathra.config.ts
import { defineDelivery } from "@dathra/plugin";
export default defineDelivery({
  routes: { "/authoring-review": { server: "./review-route.server.ts" } },
});
```

```text
route -> core/server facade -> accepted server sibling
      -> component.server -> neutral input/model + reactivity
component.server -- type-only --> component.client default type
component.client -- type-only --> exported public Values/DTO
browser entry -> core/client facade -> accepted client sibling
              -> client default/create profile -> neutral input/model + reactivity
build index -> explicit clientModule refs -> browser entry/default identity manifest
```

SSR build は ordinary client import を実行しない。
browser graph に server module/template/request handle を runtime import しない。
build は static clientModule の specifier/base と actual default export/profile を照合し、opaque な参照は明示 inventory を求める。
type-only generics、tree shaking、function extraction を実行時対応の根拠にしない。
parser code reference は neutral export 由来とし、build で照合できない arbitrary closure の一致を仮定しない。
実 package の core/server/client exports と build collector は gate であり、現在既に公開されているとの主張ではない。
component.input を宣言しない純 counter へ、全 server argument を暗黙に渡さない。
server-only route は client reference/target/entry を発行せず、zero-root response は activation code/data を省く。

| 例 | R2 の必須作者 file | 縮小案の必須作者 file と差分 |
|---|---|---|
| counter | prepare、server、client の3つ（R2 の例） | server、client の2つ。public Values の明示型で type cycle を止める。neutral type file は任意 |
| ordinary editable list | 自律 row を適用すると row model/client/server + parent client/server の5つ | parent server/client の2つ。native-owned row draft は独立 owner を不要とする。要件が違うので同条件の削減と偽らない |
| autonomous row/list | row model/client/server + parent client/server の5つ | 同じ5つ。named factory/creation option の対応を除去。SSR/new template は残る |
| async form | server/client、必要なら neutral DTO の2〜3つ | 同じ2〜3つ。request wrapper を外し、run で late-write 方針を一つにする |
| route/config | app 全体の共通 file | app 全体の共通 file。component ごとに clients map を足さない |

縮小案は、file 数の削減だけを理由に native-owned を選ばない。
ordinary と autonomous は distinct desired behavior に対する別例であり、dirty local state を要求する row を普通の input に格下げしない。
C の independently packaged quantity/header/drawer は、borrowed model と independent DTO の両仮説を残す。
両側の module boundary に実際の価値があるため、すべてを一ファイルに戻す案は選ばない。

## A.11 七場面に対する縮小案の判定

元の七場面は会話の provenance を使う。
独立レビューで新しくまとめた七分類や counter と置き換えない。
各場面の desired behavior を現262の実装有無より先に置く。

| 圧力 | desired behavior と具体的な遷移 | 縮小案の契約と R2 との差分 | 失敗/限界と gate |
|---|---|---|---|
| F feedback 中の編集 | 日本語変換を続けながら async error を見る。caret/selection を保ち、keyboard で error control へ移る | explicit props.value bind/sink、observed native revision、id/ARIA、ctx.run。prop/attr 名を減らすだけで input transaction を削らない | 二 control の異なる draft を hold。未知の composition 履歴は推定しない。#249 の実ブラウザ |
| C separate packaged cart | quantity editor/header/drawer が同じ数量と totals を表示。drawer を閉じても cart は残り、independent editor の dirty draft は保つ | borrowed は app の flat functions へ通常 import。independent は各 default/create profile と validated input/message。implicit shared Signal は増やさない | shared service が本当に必要なら #247/#249 scope の具体的 owner を決める。二つの ownership 仮説は同じ desired outcome で比較 |
| B search/history/draft | 検索 A の結果を表示し、未完 draft B を書き、Back/forward を使う | native GET、whole fresh response、partial delivery を比較。partial は declarations record、retain、ctx.deliver、history のまま。Back が committed query を戻すか draft を戻すかは app DTO policy | source は destination validation 前に止めない。古い query の model write を run と revision で止める。disposed identity の復活なし。#248/#249 |
| D 実 Docs Copy | article の独立 host/control が Copy を実行し、feedback を一時表示。host 除去で timer/listener を止める | explicit on + timeout/onDispose、known host association。static article/control は client を発行しない | Clipboard の既実行外部作用を undo しない。実 consumer を現APIへ移行済みと主張しない。#250 integration、#249 lifetime |
| M multi-step | Next/Back に draft を残し、hidden step と removed step を区別。checkpoint と late validation を管理 | hidden retained owner と outside-child checkpoint + fresh child の二 policy。create profile 入力、receive、run を使う。Back universal retention は導入しない | removed old owner の validation reply を捨てる。checkpoint transfer は app が許可した DTO。#249/#248 |
| T editable table | business row refresh/reorder と editing identity を区別し、競合 version を示す | _key、fragment optional、autonomous profile/receive か native-owned form。same values の receive を省く | business ID/control token/response identity は別。same key changed tag/ns/behavior を置換。IME move は保留。#249 |
| L live source conflict | 新 version を表示し、dirty draft と remote 値を並べて判断。disconnect/gap と removal を扱う | mount + onDispose + run。source version parser と expectedVersion submit を app に残す | gap は authoritative snapshot request。reconnect で history を仮定しない。旧 subscription/late callback を止める。#248/#249 |

次の断片は新しい helper を隠さず、R2 の policy を縮小 API へ置き換えたものである。
完全な app/module の動作証拠ではない。

```ts
// Docs Copy operation; Context has the declared text and feedback Signals.
// on("click", "copy", { concurrency: "replace" })
async function copy(ctx: CopyContext) {
  const text = ctx.values.text;
  try {
    await navigator.clipboard.writeText(text);
    ctx.run(() => {
      ctx.values.feedback.set("Copied");
      ctx.timeout(() => ctx.values.feedback.set("Copy"), 1500);
    });
  } catch (error) {
    ctx.run(() => ctx.values.feedback.set("Copy unavailable; select the text"));
  }
}
// 1500 is an example UI duration, not a framework performance target.

// Live source operation; mount("connect", {channel:"source",concurrency:"replace"})
function connect(ctx: DashboardContext) {
  const source = new EventSource(ctx.values.sourceUrl);
  ctx.onDispose(() => source.close());
  source.onmessage = event => ctx.run(() => {
    const raw: unknown = JSON.parse(event.data);
    if (typeof raw !== "object" || raw === null ||
        !("version" in raw) || typeof raw.version !== "number" ||
        !Number.isSafeInteger(raw.version) ||
        !("value" in raw) || typeof raw.value !== "number" ||
        !Number.isFinite(raw.value)) throw new Error("Invalid source update");
    if (raw.version <= ctx.values.version.value) return;
    if (raw.version !== ctx.values.version.value + 1) {
      ctx.values.status.set("Source gap; load an authoritative snapshot");
      return;
    }
    ctx.values.version.set(raw.version);
    ctx.values.remote.set(raw.value);
    if (ctx.values.dirty.value) ctx.values.pending.set(raw.value);
    else ctx.values.draft.set(String(raw.value));
  });
  source.onerror = () => ctx.run(() => ctx.values.status.set("Disconnected"));
}
```

CopyContext と DashboardContext はこの断片の適用先が宣言する Values/ClientContext の明示型を指す。
undefined helper/formatter を complete example の一部にしたものではない。
これらの policy 断片から TS inference を証明しない。
検証するときは actual public context types と Values の全文を fixture に用意する。

M は、保持する step を hidden DOM に残す場合と、draft/checkpoint を親 model に置いて child を除去する場合を独立に判断する。
後者では再追加時の initialize が新 token に checkpoint DTO を読む。
SSR response identity や disposed local instance を使い回さない。
Next が pending validation を待つか取消すかも app policy で、queue/join と checkpoint revision を明示する。
hidden controls の native submit/disabled/keyboard 順序を別に確かめる。

T は L17 を business ID、E9 を生きている control lifetime、R61 を immutable SSR association として区別する。
L17 が変わらなくても R62 の fresh response へ E9 を自動転用しない。
draft を戻すなら app が validated DTO を新 owner に渡す。
normal unkeyed element は keyed anchors の gap 内で ordinal matching、消えた anchor の unmatched gap は交換する R2 policy を維持する。
fragment は persistent extent、independent child の interior は opaque。
tag/namespace/client identity を shape scan で所有権と同一視しない。

B は native GET の URL と unfinished draft、enhanced history DTO の draft、現在の DOM control を分ける。
source の生存中に fresh destination を検証し、commit に成功してから source を終える。
destination の required admission failure は terminal、active damaged range は fenced として healthy error 表示/native navigation を残す。
両者を万能 rollback や同じ retry で処理しない。

## A.12 R2、縮小案、raw-extension 案を同じ条件で比較する

| 条件 | R2 | 縮小案（推奨） | raw-extension 案 |
|---|---|---|---|
| SSR authority/no replay | explicit profile/manifest が必要 | 同じ。default identity と唯一 profile に集約 | 作者規約だけなら満たせない |
| zero-root/server-only | response catalog と capability 分離 | 同じ。任意 create profile の存在は activation の発行理由にならない | arbitrary extension の runtime activation 推測は不適合 |
| JS/TS usability | 29 callable と named factory pairing | 23 callable、placement/default pairing。actual type evidence は未検証 | 少数 API でも JS の role/target 診断がアプリ任せ |
| native form/IME/caret | explicit prop/input/cleanup | explicit props/bind/input/cleanup を維持 | setter 推測や live Node mutation に寄せると満たせない |
| reusable independent child | default/factory/creation/parser の照合 | default/profile/parser の照合。複数契約は別 default entry | inner ownership を自由 callback の戻り値から推測する案は不適合 |
| request/delivery/error | explicit constructors/contexts | ordinary declarations、別 contexts/authority は維持 | 単一 async callback では response admission の境界が読みにくい |
| lifetime/resources | guard/query と helper群 | run と必要な resource primitive。operation/lease は同じ | return=cleanup とみなすと D/L の要件を落とす |
| practical maintenance | 専用名は明快だが再登録が多い | 重複対応を減らす。二つの template と parser は残る | hidden helper が app ごとに増え、実質の API 数を隠す |
| evidence | R2 の提案と既存足場 | source comparison と契約推論のみ | 実用性を満たす全条件を満たす prototype の証拠なし |

raw-extension は全機能を unsupported にしないが、必要な ownership/resource protocol を各 app が再構成する。
R2 と縮小案は採用済み制約に理論上整合する候補であり、runtime 成立をこの表の「整合」で証明しない。
縮小案で実装の gate が失敗した場合は、原因となった縮小だけを戻す。
たとえば bind placement が型/診断を破るなら prop/attr を戻すのであって、native form や controlled input を落とさない。

## B. Signal 判別は構造案を選ぶが、真正性を保証しない

独立 Sol の [B/C レビュー](dathomir-262-signal-and-feasibility-review.md)を受け、B01–B09 と X01–X06 を検討した。
以下はその結論を縮小案へ統合した推奨である。
R2 の own getter/plain prototype 制限、payload facade の説明不足は、この資料で明示的に変更する。
利用者がこれらを承認したとは扱わない。

### B01. ordinary constructor を保持し、trusted transfer profile を使う

**要求と問い**：通常の signal を一つの戻り値へ入れる方向決定を、native constructor predicate の追加なしで満たせるか。
**推奨**：信頼する作者コードに限る structural transfer profile とし、native constructor 真正性を必須にしない。
source の constructor provenance と、復元後の owner/write authority は別の検査である。

Signal SPEC/public type が約束するのは value/set/peek/tag と通知であり、plain prototype、own getter、descriptor 配置ではない。
R2 の現在の実装 layout への制限を除く。
同じ protocol の duplicate engine copy、class wrapper、inherited methods を、配置だけで落とさない。
browser restoration は source code/object を移すのでなく、captured data から既存 engine の owner-local slot を作る。

**最も強い代案**：engine に private registry と predicate を追加する nominal profile。
完全な protocol 偽装を区別する native-only 契約にはこちらを選ぶべきである。
通知や Object.is を変えずに introspection を加えることは論理的に可能であり、Accepted によって一律禁止されているとは言わない。
ただし #247 の engine-internal non-goal を拡張する明示認可、許可された複数 copy の registry 方針、computed/adapter の扱いが要る。
ordinary imports の一部だけを登録する external wrapper を、全 native constructor の真正性と偽らない。

**失敗と tradeoff**：full protocol fake は構造案で認識される。
この弱い保証を受け入れられない product requirement が出たら nominal scope へ切り替える。
構造判定に成功しても trusted peek の副作用や malicious Proxy を無害化しない。
**状態と gate**：未採用推奨。
constructor/ordinary unified return は方向決定を維持。
#262/#247 の scope review、#248 capture/#249 restore の P03。

### B02. descriptor の有限 lookup と判別結果を固定する

**推奨手順**は次のとおりである。

1. 候補 object から prototype chain をたどり、tag/set/peek/value の各 name を通常の shadowing 順で解決する。
   最初に見つかった descriptor を使い、own accessor を飛び越えて prototype の method を拾わない。
   visited set と内部 inspection budget で有限にする。
   budget 超過や proxy/prototype inspection throw は publication 前の path diagnostic とし、無限走査や推測へ進まない。
   budget の数値は #248 の実装 gate で決め、今回作者 option/性能 threshold を増やさない。
2. tag は data descriptor の "signal"、set/peek は data descriptor の callable、value は descriptor が存在することを条件にする。
   prototype の plain/class、value の data/getter/setter 有無、TS readonly の descriptor 表現で真正性を判定しない。
   判別のため getter/peek を呼ばない。
3. qualified object を capture map に先に記録し、trusted peek.call(candidate) を一回実行する。
   snapshot の値域を検査し、同じ captured graph から template と handoff を作る。
4. qualify しないものは ordinary data walk へ進む。
   tag だけを理由に拒否しない。
   ordinary walk が function/accessor/class 等を受け取れなければ、その理由と値の path を診断する。
   accessor-method wrapper の自動実行を要求せず、DTO 化/明示 adapter の選択を案内する。

| 値 | 決まった結果 |
|---|---|
| {__type__:"signal",value:7} | readonly ordinary data。Signal としない |
| data tag/set/peek、value が inherited getter | structural slot。判別中 getter/peek は0、capture peek は1 |
| tag または method を accessor で提供 | accessor を実行せず、ordinary transfer の accessor error/adapter 案内 |
| 完全 protocol を持つ偽装 record | structural slot として解釈する。extra data field をそのまま DTO として移すとは約束しない |
| peek が throw、値域が不正 | response publication 前の server error。client initializer fallback にしない |
| __type__:"computed" | mutable Signal slot にしない。明示 snapshot DTO または restored sources から client 側で derived 値を用意 |
| 別 engine copy の same public profile | 構造案では受け入れ、owner-local native slot へ復元 |
| 第三者の異なる protocol / method accessor | native と推測せず adapter/DTO の具体的診断 |
| incoming JSON の tag | executable protocol を復元しない。外部 input validator の data |

descriptor inspection は Proxy trap を実行し得る。
trusted author path を停止/無副作用とする sandbox ではない。
finite lookup は framework が prototype chain を無制限に追わないという契約で、arbitrary trap の JavaScript 自体を停止する保証ではない。

**最も強い代案**：R2 の own-only 検査。
簡単で衝突は減るが、公開 SPEC にない layout を作者の制限へ昇格させるため採用しない。
**状態と gate**：新 transfer profile。
P03 の corpus、descriptor logger と error paths。
一般 codec/第三者 adapter の全設計は今回の範囲外で、ordinary constructor を新 facade constructor に置き換えない。

### B03. owned payload は新しい readonly 契約として提案する

**要求と問い**：disposed/late invocation が .set を通さずに object payload を変えることを防げるか。
**推奨**：ClientContext の slot payload を owned readonly data とし、外部 setter argument を隔離する。
plain returned containers が readonly という利用者決定から、Signal<T> の任意 T まで既に readonly と決まったことにはしない。
これは追加の未採用 facade 契約である。
native engine と native constructor を変更しない。

```ts
// Proposed type projection; no new runtime constructor.
// DeepReadonly<T> is limited to the admitted finite data domain.
interface OwnedSignal<T> {
  readonly value: DeepReadonly<T>;
  peek(): DeepReadonly<T>;
  set(input: T | DeepReadonly<T> |
    ((previous: DeepReadonly<T>) => T | DeepReadonly<T>)): void;
}
// ClientContext<V>.values projects Signal<T> to OwnedSignal<T>.
// server() still returns ordinary native Signal<T>.
```

DeepReadonly と OwnedSignal は type-level surface の提案である。
ここで型名の採用まで決めないが、readonly previous と value の意味は inventory から隠さない。
native Signal<T> とすべて同一の assignability/heap identity を持つとは主張しない。

初期 capture と新 child の initialize result で、finite payload の owned graph を検査して隔離する。
返された source Signal の object と live context の slot object が同一という保証は与えず、snapshot から private owner-local native slots を用意する。
新 child の initialize 自体は一回であり、source Signal の任意 closure/effect を新 owner の behavior として移植しない。
その結果を扱う処理は flat registered functions と context を通す。
作者が自分の global/raw engine handle を別に変更する作用を sandbox/rollback する保証は今回の profile に含めない。
server/native memory や external object をそのまま client-owned slot へ入れない。
value は native tracking read、peek は非 tracking read を通し、同じ owned value に対して同じ readonly view を返す。
invocation ごとの wrapper は同一 slot authority に結び、view/node の identity map は owner の ledger に置く。
same-owner の同 Signal object は一つの slot、別の同値 Signal は別 slot、cross-owner 同 Signal は両 path を示して拒否する。

#### コピーと identity を次のように選ぶ

「毎 .set で無条件 clone」では、同じ x を二回渡すだけで二回目の Object.is が変わる。
これを native と同じ通知と説明できないため、縮小案では次の policy を推奨する。

- admitted finite data は入るたびに検査する。
  primitive は native Object.is の値、already-owned readonly view は native owned node に対応させる。
- external root object identity ごとに、最後に検査した data snapshot と owned copy を weak ledger に記録する。
  同じ external object の同じ admitted snapshot なら同じ owned node を再利用する。
  changed snapshot なら fresh owned copy。
  比較は getter を実行しない data walk と、field/array order、primitive、snapshot 内の alias topology の明示ルールを使う。
  field order は無視し、array order と source alias の同一/別を含める。
- 異なる external root object は同値でも別 owned root とし、native の object replacement と同じく通知の対象にする。
  決して全 .set を structural equality で抑止しない。
- snapshot 内の同じ plain object alias は同じ owned node とする。
  snapshot 間で任意の nested heap identity を永続保持する保証は加えない。
  cycle/function/accessor 等は transfer profile の path error、必要な domain codec は別 owner/gate。
- updater が同じ previous view を返す場合、その対応する native owned node をそのまま渡す。
  same-previous no-op を clone で壊さない。
  previous の nested mutation は型で拒否し、runtime readonly view でも拒否する。
- caller の x を freeze/書換えない。
  freeze/read-only membrane の対象は owned copy/view である。
  external x の変更は次の明示 .set まで owner に漏れない。

| 操作 | 縮小案の期待と native との差分 |
|---|---|
| .set(x); .set(x)、x の内容は同じ | 最初は新 copy、二回目は同じ owned node。二回目の通知0 |
| .set(x); x.n=2、再 set なし | owned value は旧値、通知0。native raw alias の直接変更と意図的に異なる |
| 上記の後 .set(x) | changed snapshot を fresh owned node とし通知。native が same object のため再通知しない場合と意図的に異なる |
| .set({n:1}); .set({n:1}) | 別 external roots なので別 owned roots、二回目も通知。全面 deep-equal suppression にしない |
| .set(previous=>previous) | same native owned node、通知0 |
| .set(previous=>({...previous,n:previous.n+1})) | fresh immutable replacement、通知 |
| .set(slot.value) / .set(slot.peek()) | owned view が同じ native node に対応、同値 identity の no-op |
| .set(previous=>{previous.n++;return previous}) | readonly profile の違反。native mutable T の作法と意図的に異なる |
| dispose 後 x.n=2 | external copy 変更で owned state/DOM を書けない。古い facade の .set も拒否 |
| 別 owner に readonly DTO を渡す | explicit validated copy は可能。同 Signal slot の暗黙共有にはしない |

Object.is、track/peek、同期通知と batch の挙動は、native engine が実際に保持する owned nodes に対して維持する。
external raw object identity と mutation の観測はこの facade の新契約で変わる。
したがって「native Signal<T> の完全な同等物」とは呼ばない。
Accepted #260 の「Signal 読取り、依存追跡、通知、computed、effect、batch、root cleanup の observable semantics を維持する」（260.typ 120行）は維持する。
この提案は直接 import する native API を変更せず、ClientContext の transfer/ownership projection を別契約として追加する判断である。
もしその Accepted 文を「復元された context も external raw payload alias を含む native Signal<T> と完全同等」と解釈するなら、上表の changed-external-root/read-only の差分は両立しない。
その場合は facade profile を未採用に戻し、native payload の弱い ownership 保証を明示するか、新しい superseding 判断を coordinator が承認する必要がある。
今回その解釈変更や supersession は行わない。
推奨する採用単位は、native API 同等の偽装ではなく、明示した owned context profile である。
finite DTO の immutable replacement で cart、list、draft、checkpoint を扱えるが、任意 class や mutable library object をこの限定 profile で全部覆ったことにはしない。

**最も強い代案**：mutable payload の完全な lease-aware membrane。
nested mutation を許せるが、外部 x の alias isolation と通知の定義が同じく必要で、raw setter argument をそのまま保持する案では late-write を止められない。
external alias の弱い保証を明記して native payload をそのまま使う案はより native に近いが、R2 の「model write を generation で止める」という契約を弱める。
今回の推奨は readonly owned profile とし、mutable domain は明示 adapter の scope を選ぶ。
**状態と gate**：未採用の追加契約。
#247 projected types、#248 capture、#249 isolation/view cache の P01/P03/P07。
weak ledger と比較 policy が実際に成立するかは未実証。
比較用 snapshot は caller object の live reference を保存せず、data と alias topology を隔離した形にする。
履歴のすべてを強参照で蓄積する cache にはしない。

## C. 成立性によって変える内部契約と小さな検証

### C01. failed receive は model を戻さず、当該 publication を止める

**source と問い**：独立 X01、batch SPEC の「例外で部分更新可視化」、R2 last committed display。
receive が .set の後に throw したとき表示を残せるか。
**推奨**：DOM writer に receive attempt の publication gate を持つ。
batch を model transaction と扱わない。

1. parent producer の tracking を閉じ、valid parent plan を公開してから child receive を enqueue。
2. receive attempt に causal/generation token と publication-closed 状態を付ける。
   .set の同期通知や batch の例外 flush は許し、binding effect は DOM write でなく candidate plan を作る。
3. receive 成功時に candidate を検査して公開する。
   throw では当該 causal attempt の candidate を捨て、lastAttempt と partially changed model を残す。
   同じ failed input の自動 retry はしない。
4. later healthy input、native event、明示 ctx.refresh ではその時点の部分変更済み model を読める。
   これが成功すれば、その値が表示される。
   failed attempt の DOM publication を遅らせないという保証と、永久 model rollback を区別する。

```text
display Alpha / model Alpha
receive(Beta): incoming.set(Beta); draft.set(Beta); throw
=> model Beta / display Alpha / failed-attempt plan discarded
later healthy refresh
=> reads Beta; valid candidate publishes Beta
```

これは一般 getter/operation の全副作用を rollback する仕組みではない。
healthy error range への diagnostic publication は failed child content と別の authority で行う。
child mutation が shared borrowed owner のほかの framework display に届く場合も、同じ causal attempt に属する writer を gate する。
independently active owner、外部 JS effect、network/host の作用を一括 rollback しない。
receive は model-only とし raw DOM/emit/resource を許可しない。

**最も強い代案**：shadow model で receive し成功時だけまとめて commit。
より強い model atomicity を与えるが、ordinary references/Signal の間接参照まで transaction へ巻き込む追加契約が要る。
今回の目的には publication gate を選ぶ。
**状態と gate**：X01 により R2 の不十分な説明を修正する新内部契約。
#249 writer、P06。
native batch の source test は読んだが、新 gate は実行していない。

### C02. 最後の timer callback を pin してから resource を外す

**source と問い**：X02、Copy feedback、R2 resource=0 による lease close。
fulfilled operation の最後の timer は、発火しただけで callback が無効にならないか。
**推奨**：owned callback の実行 pin を lease close 条件に含める。
timeout callback は void または Promise<void> を返せる契約にする。
ctx.run は同期 gate のまま、async callback の await 後の write は run を使う。

```text
valid token?
  no: callback not evaluated
  yes: acquire callback pin
       remove fired timer handle from resource ledger
       invoke callback
       void: finally release pin
       Promise: observe fulfillment/rejection; finally release pin on settle
normal idle-close iff operation settled && resources=0 && pins=0
replace/dispose: invalidate token immediately, regardless of pending pins
```

最後の resource がなくなっても callback/promise settle まで lease の使用が可能である。
cancel/replace/dispose は pin の完了を待たずに authority を失効する。
pending Promise が物理的に止まる保証はなく、await 後は ctx.run と guarded slot/commit が write を止める。
callback が新 timer を登録すれば resource が残るので idle-close しない。
join/queue は元の operation Promise 完了で判断し、timer pin の寿命と混同しない。

```ts
// Proposed async timeout behavior.
ctx.timeout(async () => {
  const reply = await fetch("/public-feedback", { signal: ctx.abortSignal });
  ctx.run(() => ctx.values.feedback.set(reply.ok ? "Ready" : "Unavailable"));
}, 1500);
```

この断片は async pin の説明用であり、新 server communication の例にはしない。
framework data operation は requests/ctx.request を使う。
native fetch の外部 authority はアプリが選ぶ browser-only capability である。

active callback throw/rejection は healthy error channel へ報告して pin を finally release する。
旧 token の late rejection は consume して disposed model を更新しない。
元の成功済み operation Promise を後から reject へ書き換えない。
onDispose release、timeout cancel は idempotent。
ctx.run の同期 callback 中も pin を持ち、自分が最後の resource を release しても callback の残りを idle-close で落とさない。
author が明示 dispose/replace したなら、その後の guarded write は同 callback 中でも拒否する。

**最も強い代案**：timeout callback を同期に限定し、async は別 owned operation へ移す。
単純だが public operation-dispatch helper を追加しないと browser の遅延処理の作法が分かれる。
owned pin の方を選び、Promise の意味と cancellation を明示する。
**状態と gate**：新内部契約、async callback の許可も新提案。
#249 P07。
one fulfilled timer、one async timer、cancel-before-resolve、parallel/replace だけを後で検証する。

### C03. engine root は lease の代わりではない

**source と問い**：X03/X04/X05/X06、actual createRoot/onCleanup/events と新 API。
既存テストのどこまでが使えるか。
**推奨**：templateEffect の root tracking を使い、普通の effect の stop、timer、source disposer は explicit ledger に登録する。
await 後の context resource acquisition は token を先に照合する。
同期 subscription callback が disposer の return より先に来る場合も provisional acquisition に属し、失敗後に返った disposer を一度だけ止める。

current root cleanup だけで fetch/clipboard/source/.set argument alias は管理できない。
capture/view cache、writer gate、lease pin、input revision、profile permissions は追加 kernel の責任である。
Signal の tests が通ることをこれらの実装完了としない。
旧 canonical stub は state/values 分離と role filtering を持つ旧形であり、flat/unified/readonly projection の型 proof に流用しない。

**最も強い代案**：既存 engine の API を変えてすべてを root に束ねる。
現在の Accepted engine 境界と scope に追加承認が要るため、新 client adapter/kernel で統合する方を選ぶ。
**状態と gate**：既存 root/notification の契約は source evidence、新 kernel は未検証。
#249。native edit は P05、SSR permissions は P02/P04、alias isolation は P03。

### C04. 次の許可は P01 と P03 の二 slice に限定する

ここで提案するのは実施計画であり、この割当では未実行である。
両 slice は一つの固定 fixture、初回一回と修正後の一回までとし、未解決なら契約を戻して review する。
数値の性能目標、全ブラウザ、全 bundler、全 codec の campaign を追加しない。
P01 の型は P03 の候補 facade へ渡すので、完全に独立の大量実験とはしない。

| 計画 | fixture と成果物 | pass | fail で変える判断 | evidence level/owner |
|---|---|---|---|---|
| P01 flat names、型、type-only cycle | counter.server/client、minimal proposed declarations、assertions の一小fixture。assertions に create profile/placement/readonly previous の小callを加え、whole list/formを複製しない。actual Signal<T>、strict/noImplicitAny、declaration emit、一つのdiagnostic log | bind("increment") と on("click","countText") の両方を許す。typo は error。ordinary return の count number/plain title、owned previous readonly が有効。finite declarations、any 漏れなし | cycle/context inference が崩れるなら neutral explicit Values file を正式形にする。profile template の型を推測できないなら Values を明示 annotation。role filtering を復活させない。placement が不明確なら prop/attr を限定して戻す | actual engine type を使った限定型証拠。提案 declarations の通過は runtime proof でない。#247 |
| P03 capture/recognition/alias/owned payload | native Signals、computed、two copies、inherited wrapper、tag-only/full fake、throwing peek の固定 corpus。minimal capture/restore/facade kernel、actual effect/batch。trace log と kernel source | 一 object 一 peek、template/handoff同snapshot、same Signal aliasは一slot。track/peek同等、same-owned view/same-external-unchanged/same-previous通知0。別 external rootは通知、mutated external rootの明示 setは更新、external alias変更は漏れない。wrong owner/late writeを拒否 | full spoof 排除が必要なら nominal scope。native通知を preserve できない場合は cache/profile を修正し、残る意図的差分を user review。readonly isolation失敗なら raw exposureを外す。payload要求がprofile外なら explicit adapter/別scopeを選ぶ | actual engine + 限定kernel の実現可能性。production public-path proofへ昇格しない。#248/#249 |

P03 の model の origin と restoration memory を区別し、template と encoding の間に source を変更する negative を入れる。
native source が変わっても captured SSR text/data は同じ7を使う。
same Signal を違う owners へ出す場合は両 path の error、同値別 Signal は別 slot。
updater(previous=>previous) だけ通して same raw argument の identity 問題を見落とさない。

以下の五 slice は plan として残すが、最初の実行依頼に全部含めない。

| 次の gate/trigger | fixture/pass | fail で変える判断 | ownerと限界 |
|---|---|---|---|
| P02 reference/profile/graph/zero が採用判断に必要 | 一 bundler、browser-only/server-secret sentinel、neutral parser、literal clientModule と static route。emitted graph/URL relocation、default/profile parser一致、zero activation 出力 | collector 不成立なら explicit inventory/wrapper seamを具体化。type-only mismatch diagnosticの費用を明示。server/client import統合やtree shakingへ逃げない | #247/#248。一deployment layoutのみ。runtime browser moduleを空stubへ置換しない |
| P04 SSR list/local child/fragment の選択 | 二SSR rows、two-node extent、a/b reorder/remove/readd、empty/text/DOM、changed tag/ns/default、wrong profile。SSR init/template0、new init1、stop1、independent child rollbackなし | default/profile provenance不能ならR2のexplicit named factory permissionを戻す。fragment ledger failureは合法wrapper代案と比較。自主stateを落とさない | #248/#249。node identityからphysical IME/host moveは証明しない |
| P05 controlled input が選ばれた時 | SSR a→preboot あ→registration後edit。二group controls、unknown/observedcomposition、reset、Count:7→Count=7。latestdraft採用、same-valuewrite0、hold、failed admission nativeedit維持 | sink/revision/placement修正。per-key formatterはmappingがなければblur/submit。初回refreshをclick待ちへ戻さない | #249/#251。synthetic eventは実Japanese IME proofでない。OS/browser一manualcaseまで |
| P06 receive convergence/writer を選ぶ時 | same/new-object/changed B/pending C-D/write-throw/healthy-refresh/causal loop。same0、changed1、latestD、failed DOM0/partial model、healthypublish、dependency漏れ0 | X01gateを修正、parenttracking後schedulingへ。shadowmodelが必要なら契約scopeを明示。batch=rollbackとしない | #249。arbitrary JS loopや外部echo全体を止めるproofではない |
| P07 resource/async pins が選ばれた時 | fulfilledtimerとasync timer、同期source、old/newPromise、replace/parallel、cleanupthrow。lastcallbackwrite、settlepin、latewrite0、sibling維持、stop1 | pin/generation/ledger修正。Promise callbackを支えられなければ同期制約とdispatch代案をreview。mutationのundoへ拡大しない | #249。clipboard/network/source/historyの実host behaviorは別gate |

P02–P07 の contract は未採用/未実行で、機能を unsupported にするための先送りではない。
#262 の必須作者判断は A/B/C で選び、その実装を各 owner が SPEC/tests と public path で証明する。
選んでいない全 adapter/performance threshold を今回の小さな proof へ混ぜない。

## 統合後の状態と失敗の境界

| 状態/出来事 | 本資料の推奨結果 | 修正してはならない境界 |
|---|---|---|
| preflight reject | 資源0、SSR/native edit保持。外部前提回復後に同じ immutable association を再検証 | payload/target/keyを同 identity へ差し替えない |
| acquisition/required commit failure | provisional graph/resources/writeを破棄。identityはfailed-terminal | client新作成でSSR補修しない。回復はfresh response |
| successful admission | 既存state/DOM authorityを採用し、最初のbinding refreshを自動反映 | initial server template/setupをbrowser実行しない |
| native draft conflict | revision/sinkで採用、unknown/composing/複数draftはholdと解決表示 | formatterやSSR defaultでtyped editを消さない |
| receive write then throw | 部分model変更あり、当該candidate publicationなし、healthy error表示 | permanent model rollbackとは呼ばない。後のhealthyrefreshは部分modelを出せる |
| new child construction failure | そのprovisional childだけstop、last committed range/siblingを保持 | independently active childをparentrollbackへ含めない |
| active irreversible damage | damaged extentをfence、healthy error/explicitfreshdelivery/native navigation | 全DOM/network/host作用のrollback保証なし |
| remove/dispose/replace | token先行失効、containedresource/child、sharedstateの順でcleanup | pendingpin/Promiseを待ってauthorityを延命しない。readdはfresh token |
| last timer fires | pin→resource除去→callback→syncreturn/Promisesettleでpin解放 | Promise完了とlease/resource終了を同一にしない |
| zero-root response | bootstrap/handoff/activation marker/client refを省略 | empty interactive bindやunknowncatalogをzeroと誤判定しない |

## 利用者に戻す一つの縮小案

R2 をそのまま採るより、上の A を推奨する。
flat defineClient と二引数 clientModule はそのまま使い、追加の factory 選択を default/profile にまとめる。
bind を表示場所の唯一の helper にして、content/attribute/live property の実際の違いは宣言の配置として残す。
request/delivery の record と ctx.run へ揃え、timer/cleanup/explicit communication の実用的 primitive は残す。

Signal は trusted structural profile とし、constructor 真正性を保証しない。
readonly owned payload は新しい facade 契約として明示し、external alias 隔離と same-input/same-previous の identity policy を組にする。
receive writer gate と callback pin は成立性に必要な内部責務として採用候補に含める。
これらを実装が簡単だから選ぶのではなく、F/C/B/D/M/T/L で draft、display、resource を失わないために選ぶ。

利用者が今回判断する新しい差分は次の四つである。

1. bind placement、optional create profile、ordinary communication record、run という縮小 surface。
2. native provenance を要求しない structural recognition と、R2 の own/plain 制限の除去。
3. context payload の readonly/isolation と、native raw alias とは異なる明示 identity/notification policy。
4. 計画だけの P01/P03 を次の二検証として選ぶか。検証実施の許可は本資料の作成と別である。

primitive state だけを先に選ぶこともできるが、nested payload の追加契約を黙って native Signal<T> と同一視して実装しない。
nominal を必要とする判断なら coordinator が engine introspection scope を明示して別案を扱う。
child/fragment/controlled input/history の production support や①完了は、この推奨を読んだだけで確定しない。
新提案を選んだ後、#247–#251 の該当 owner が SPEC/tests、実 public path、選択 consumer の証拠を持つ。
Accepted の最初の counter slice を、全七場面や後続の全 prototype の完成まで止める要件は追加しない。
これらの例は探索で契約を確かめる材料であり、全要求/設計を完了してから実装へ進む waterfall を提案しない。

## 付録1 58質問の差分と保持

この表の R2-A01〜A58 は旧全体レビューの索引で、本文 A01〜A12 は今回の新しい比較番号である。
元の source/decision/witness の provenance は R2 の8欄表に保持し、ここでは変更と実装 gate を追跡する。
「保持」された R2 の新提案も未採用のままで、Accepted と利用者方向決定の境界を維持する。
リンクだけを coverage としないため、各質問の disposition を一行ずつ記す。

| R2項目 | 問い | 本資料の disposition | 具体的参照 | owner/proof |
|---|---|---|---|---|
| R2-A01 | 今回何を採用するか | 採用/①完了/実装を分離 | 0/統合結論 | coordinator/user |
| R2-A02 | server/client はどこで実行するか | 別server/client、no replay維持 | A04/A10/P02 | #247 |
| R2-A03 | ordinary Signal の判別を何にするか | own/plainを外す構造profileへ変更。真正性なし | B01/B02/P03 | #247/#248 |
| R2-A04 | record と slot の何を書けるか | plain readonly維持。owned payloadは新契約 | B03/P01/P03 | #247/#249 |
| R2-A05 | nested alias を保持するか | same-owner slot alias、external payload alias隔離 | B03/P03 | #248/#249 |
| R2-A06 | transfer できる値は何か | finite dataとpath error。rich codecは明示gate | B02/B03/A08 | #248 |
| R2-A07 | DOM と snapshot をいつ採るか | 一captureからtemplate/handoff。live source rereadなし | B02/P03 | #248 |
| R2-A08 | bind/on の候補は役割別か | flat/all-nameを方向決定のまま保持 | A02/A10/P01 | #247 |
| R2-A09 | client parameter はどう型付けするか | explicit public Values annotation。inference未証明 | A10/P01 | #247 |
| R2-A10 | type/runtime path を二度書くか | 二引数clientModuleと許容された二度のpathを保持 | A04/A10/P02 | #247 |
| R2-A11 | type witness と actual module をどう照合するか | actual default/profile/parserをmanifestで照合 | A04/A10/P02 | #247 |
| R2-A12 | deployment 後の reference はどう解決するか | source/emitted URL relocation gate維持 | A10/P02 | #247 |
| R2-A13 | package/graph と再現性は何を保証するか | sibling/facade/engine境界、stubをproduction proofにしない | 0/A10/C03/P02 | #247/#250 |
| R2-A14 | bind の content category は固定か | dynamic contentを維持、placement bindへ統合 | A02/例2 | #247/#249 |
| R2-A15 | 接続直後の異なる結果はいつ出すか | commit後automatic refreshを維持 | A03/例1/P05 | #249 |
| R2-A16 | preflight/producer/operation の違いは何か | preflight/required commit/active failureを分離 | 統合状態表/C01 | #249 |
| R2-A17 | event は何を読み取るか | known event snapshot。new event.refを明示 | A06/A09/例2 | #247/#249 |
| R2-A18 | event options と scheduling は何か | on/mount options、四schedulingをenumで保持 | A06/A09 | #249 |
| R2-A19 | attribute と property はどう分けるか | helper3つをbind1つへ、属性/props配置は残す | A02/例4/P01 | #247/#249 |
| R2-A20 | 接続前 input の書き戻しはどこか | input.sink/groupを明示、native revision transaction保持 | A02/A03/例4/P05 | #249 |
| R2-A21 | IME の不明な開始状態はどう扱うか | unknown native compositionは確定境界までhold | A03/A11/P05 | #249/#251 |
| R2-A22 | caret/selection は何を保つか | same-value write省略、caret mappingはadapter証拠 | A03/A11/P05 | #249/#251 |
| R2-A23 | native form/reset は何を残すか | native forms/defaultValue/resetを維持 | A03/例2/例4/P05 | #249 |
| R2-A24 | accessibility と focus はどう指定するか | id/ARIA/known focusを保持、all a11y proofではない | A08/例4/A11 | #249/#250 |
| R2-A25 | numeric draft を domain state にいつ変えるか | 途中のnumeric draftはstring、domain parseをcommit時に | A03/例4/R2 2.5 | #249 |
| R2-A26 | checkbox/radio/select は文字列だけか | checked/radio/selectは専用adapter、文字列へ一律化しない | A03/R2 2.5 | #249 |
| R2-A27 | file はどう扱うか | native File/FormData、payload transport domainと分離 | A03/例2/R2 2.5 | #248/#249 |
| R2-A28 | _key の scope は何か | keyはowner/range/sibling内。string/number型を区別 | 例2/例3/R2 3.1 | #249 |
| R2-A29 | same key の changed tag はどうなるか | same key changed tag/ns/defaultはactive replacement | A04/例3/P04 | #249 |
| R2-A30 | reorder で host/native state は保つか | compatible extent保持、physical host/IMEは別proof | A03/A11/P04/P05 | #249/#251 |
| R2-A31 | 複数要素の一項目はどう書くか | optional fragment/persistent extent候補を保持 | A08/A11/P04 | #249 |
| R2-A32 | empty 表示は capability を失うか | empty bind/fragmentはcapabilityを失わない | A02/例2/P04 | #249 |
| R2-A33 | new child の state はいつ作るか | create profile/lazy intent、absent keyだけinit | A04/例3/P04 | #249 |
| R2-A34 | SSR child と factory をどう許可するか | named factoryを唯一default/profile permissionへ変更 | A04/例3/P02/P04 | #247/#248/#249 |
| R2-A35 | receive は何回実行するか | normalized input equality、receive0/1/latest | A05/例3/C01/P06 | #249 |
| R2-A36 | new child construction が失敗したらどうするか | provisional new childだけcleanup、siblingを保持 | 例3/統合状態表/P04 | #249 |
| R2-A37 | 別 package panels は状態をどう共有するか | borrowed/independent panelの同desired outcomeを比較 | A10/A11 C | #247/#249 |
| R2-A38 | reused/independent component の差は何か | code reuseとstate ownerを区別、cross-owner sharingなし | A04/A11 C | #249 |
| R2-A39 | mutable cross-owner sharing は暗黙か | implicit shared Signalを拒否、DTO/owned serviceは明示scope | B03/A11 C/P03 | #247/#249 |
| R2-A40 | 親が独立 child を移動/除去できるか | explicit containment、child interior opaque、cleanup | A04/例3/A11 T | #249 |
| R2-A41 | resource は Promise return で終わるか | operationとleaseを分離、callback pin追加 | A06/C02/P07 | #249 |
| R2-A42 | late work/parallel/join をどう守るか | guard/queryをrunへ統合、alias isolation/token/pin | A06/B03/C02/P07 | #249 |
| R2-A43 | 外部 DOM damage/native widget をどう扱うか | raw widget interior grantを推測しない。damaged extent fence | A08/A11/統合状態表 | #249 |
| R2-A44 | active partial failure の利用者回復は何か | failed receive publication gate、model partial、後healthy refresh | C01/統合状態表/P06 | #249 |
| R2-A45 | server operation はどう宣言するか | wrapperをrecordへ。DTO/auth境界は残す | A07/例4/P01 | #247/#248 |
| R2-A46 | 競合 completion の勝者は何か | replace/latest、revision guardでmodel writeも保護 | A06/例4/A11 B/L | #249 |
| R2-A47 | cancel は何を保証するか | abortはundoでない、late commit/model writeを止める | A06/C02/統合状態表 | #248/#249 |
| R2-A48 | retry はどれが安全か | idempotency/unknown outcomeはmutation contract、blind retryなし | A07/A11 M/B/統合状態表 | #248 |
| R2-A49 | server delivery の権限はどこから来るか | delivery recordはfresh response authority、retain保持 | A07/A08/A11 B/P02 | #248/#249 |
| R2-A50 | navigation の失敗前に何を終了するか | destination validation/commit後にsource終了 | A07/A11 B/統合状態表 | #248/#249 |
| R2-A51 | Back は disposed owner を復活するか | Back draftはapp DTO policy、disposed identity revivalなし | A08/A11 B/M | #249 |
| R2-A52 | async SSR/streamは何を約束するか | awaited SSR/request scope維持。stream公開境界はR2保持 | A10/R2 5.2/P02 | #248 |
| R2-A53 | static route の code を何で選ぶか | static routeからclient entryを選ばない | A10/P02 | #247 |
| R2-A54 | zero response は何を省略するか | zero response activation code/data/refsを省く | A10/統合状態表/P02 | #248 |
| R2-A55 | diagnostic は何を示すか | path/phase/name/target/recoveryを示す負例 | A02/B02/C01/P01–P07 | #247/#248/#249 |
| R2-A56 | rich data/widget の修正経路は何か | codec/adapterを明示ownerへ。有用featureを一律unsupportedにしない | A08/B03/C04 | #247/#249 |
| R2-A57 | 七 witness は何を証明するか | 元のF/C/B/D/M/T/Lを独立判断、counterと区別 | A11/P01–P07 | #250/#251 |
| R2-A58 | 今回は何を実行しないか | discussion artifactのみ、runtime/TS/build実験0 | 0/C04/検査とdelivery | #262/coordinator/user |

58/58 の disposition があり、未検証の動作を58件完了と宣言しない。
表示/input adapter、version/auth/history/stream、actual consumer migration の全 proof はここで実施しない。
各 support 要求は保持し、許可された次 slice を選ぶ。

## 付録2 canonical 27候補の source crosswalk

R2 の collector provenance を再利用した表であり、fresh collector/Issue body collection は実施していない。
対応する R2-A 番号は付録1で本資料へ接続している。

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

27/27 の source rows を保持した。
canonical mandatory requirements の削除、scope変更、GitHub状態の更新はしていない。
元の七 witness は A.11 の七行が conversation provenance を持つ。
counter/Theme/Count は primary baseline として例1に別に残す。

## 検査と delivery

この資料は A を自分で比較し、独立 Sol B/C の B9/X6/P7 を読み、coordinator の追加指摘を統合した結果である。
X01 を publication gate、X02 を sync/async callback pin、X06 を readonly owned payload/identity cache の具体的 semantics へ反映した。
単なる未検証 footnote として残していない。

callable count の内訳は次の同じ分類による。

- R2 import/helper：defineComponent、defineRoute、defineDelivery、clientModule、defineClient、signal、el、fragment、bind、prop、attr、id、on、mount、defineCreatedComponent、createComponent、request、delivery、retain（19）。
- 縮小 import/helper：defineComponent、defineRoute、defineDelivery、clientModule、defineClient、signal、el、fragment、bind、id、on、mount、createComponent、retain（14）。
- R2 ctx method：control、formData、emit、request、deliver、refresh、onDispose、timeout、guard、isCurrent（10）。
- 縮小 ctx method：control、formData、emit、request、deliver、refresh、onDispose、timeout、run（9）。

これは追加 callback fields、type projections、property placement の理解を無料と数えた指標ではない。
profile input/initialize/template/receive、operation/resource/authority は実際の概念として残る。
app の parseRowInput/createRowValues、native FormData/fetch/Clipboard/EventSource は Dathra の hidden helper に数えず、上のコードに定義/呼出しを明示した。
新しい constructor を signal の代わりに要求していない。

実施した検査は source の限定再読、設計/差分レビュー、58 disposition/27 source rows/七 witness の文書対応、callable count と code fence/whitespace、既存 reference/dirty file の hash preservation である。
strict TypeScript、runtime、browser、build、Typst、production package test の実行は0。
native tests は source evidence、旧仮型 test は旧shapeの証拠、この資料のコードは提案である。
P01/P03 は予定であり、結果ではない。

検査結果は /tmp/dathomir-three-concerns-checks.json に記録する。
担当した repository file はこの Markdown だけで、R2、最新メモ、peer file、canonical Proposal、Issue/PR、既存 dirty files は編集しない。
live Dispatch はないので worker_done や lifecycle ID を生成しない。
coordinator `term_5db51934-7dd7-406b-97eb-1456c9a07fda` へ統合結果を送信した。
`accepted:true` と `input_accepted` / `turn_started` を確認した。
送信 request ID は `34052680-58d4-40a8-a97a-8a71eb61ddd0`（実際の receipt ID、Dispatch/lifecycle ID ではない）。
receipt は `/tmp/dathomir-three-concerns-delivery-receipt.json`、送信本文は `/tmp/dathomir-three-concerns-coordinator-report.txt`。
受信と turn 開始を確認したもので、設計の承認ではない。
新しい handle の探索、再送、daemon restart は不要だった。

