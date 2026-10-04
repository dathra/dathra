# #262 Assignment A：P01 型と P02 build graph の検証

更新：2026-10-05 06:00 JST 前後。
対象は Proposal #262 / Draft PR263 の未採用 authoring 案である。
この資料は採用、①完了、実装完了を意味しない。
作成と実行は `tmp/dathomir-262-validation/types-build/` 内だけで行った。

## 利用者の判断に戻す結論

flat `defineClient`、全登録名を候補にする `bind/on`、普通の `signal`、unified return、別 browser module、二引数 `clientModule` は、今回の小さい型検証で成立した。
build 側は未採用 adapter を使った成立証拠であり、Accepted #253 の方式の実装済み証拠ではない。
ただし、次の修正と条件が必要になる。

1. **型の入力整合性**：create parser の出力を、選択された receive だけでなく、`ctx.received` の型を要求する全登録関数と照合する。
   元の宣言は `label:number` を返す parser と `label:string` を必要とする receive を受理した。
   この反例を保存し、実験宣言だけを修正した。
2. **bind の boolean**：`checked/defaultChecked` と presence attribute に SSR boolean を渡せる宣言にする。
   `kind` は追加しない。
   content に現れる boolean は空内容とする案を今回追加した。
   boolean の空内容規則は新しい未採用提案であり、型を通すことと表示規則の採用は別の判断である。
3. **module の照合**：`typeof A` と runtime path の同一性を erased generic から保証できるとは言わない。
   この試作では、TS の元ソースの default symbol を比較する明示 inventory rule を追加した。
   source 分析を採らない場合、形の一致までに保証を限定する必要がある。
4. **relocation の変換**：source の `import.meta.url` をそのまま bundled SSR の URL として扱うと、実際の lookup が失敗した。
   明示 `clientModule` 呼出しの metadata に限って source の参照キーを保存し、相対 emitted artifact manifest へ結ぶ adapter は動いた。
   この source rewrite を導入するかは新しい user review の対象にする。
   現在の Accepted 境界を維持する既定案として、preserve-module output と manual explicit inventory を先に推奨する（後述、未実行）。
   server/template の関数抽出、共有、browser 実行は行わない。

これらは既存の ordinary constructor や user-decided public name を置き換える案ではない。
readonly owned payload は依然として新しい context 契約の候補であり、native Signal と同じ runtime equality を証明していない。
5. **browser tracking ABI**：per-entry bundle が同じ engine source を含んでも runtime instance は一致しない。
   実 emitted modules で cross-engine computed の stale result を再現した。
   通常 bundler の shared runtime chunk または一つの ordinary engine import URL を推奨し、production loader と client の同一 identity を gate にする。
   この per-entry adapter のまま runtime 全体が成立したとは言わない。

## 1. 実行した範囲と証拠の種類

| 種類 | 実際に使ったもの | その証拠で言えること |
|---|---|---|
| 実 Signal 型 | `packages/reactivity/src/index.ts` と `src/types/index.ts` | 独自 Signal stub ではない。`signal(7)` の型が実 `Signal<number>` であり、value が any でない |
| public 型 | `runtime/contracts.ts`, `client.d.ts`, `server.d.ts` | 提案宣言の strict/checkJs、名前、制約、declaration emit の成立。production API の型ではない |
| 実 engine code | esbuild が repository reactivity source と alien-signals を bundle | SSR snapshot fixture と明示 fresh initialization が実 engine の peek/set を使う |
| 実 bundler | esbuild 0.25.10、ESM、treeShaking:false | 入力 graph、出力分離、実行時 sentinel、relocated file lookup |
| 試作 adapter | `collector.mjs`, `runtime/*.mjs`, `run-build.mjs` | literal reference の inventory と小さい SSR description renderer の成立 |
| Vitest | `verification.test.ts` の二検証 | 再現コマンドで P01/P02 の assertions が完了する |

### Accepted #253 と adapter の境界

[Accepted #253](https://github.com/dathra/dathra/blob/0ad07bffd601fef7cd708276942b187883ea787e/SPEC/proposals/245/253/253.typ#L64) は専用 compiler を採用せず、通常 TS/bundler/minifier と限定 graph check を許す。
同じ資料の108、241、276、298行は、bounded analysis/generation を選択していないことと、ordinary bundler へ explicit client entry を渡す方式を示す。

今回の emitted graph と declared server-only resource の照合は、狭い boundary check の証拠にできる。
一方、`collector.mjs` が direct imported call の subset を選び、source reference から entries/manifest を組み、第二引数 `import.meta.url` の AST range を source URL literal へ置換する処理は、新しい未採用 analysis/rewrite adapter である。
「compiler-free に既に含まれる実装詳細」として扱わない。
制限された call grammar、default/profile/parser symbol rule も新しい制約である。
採る場合は別の user review と必要な Proposal/ADR scope 判断があり、Accepted 本文を黙って変更しない。

専用 compiler、JSX、function extraction、arbitrary closure serialization はこの実験にも無い。
それでも source metadata を rewrite することは source transformation であり、no function extraction と Accepted analysis/generation 境界を混同しない。

runtime facade はこの実験用の小さい実装である。
現在の core API や production admission loader を実行した証拠ではない。
既存 plugin の SPEC は JSX/TSX transformer 統合を規定しており、この compiler-free reference inventory adapter の実装済み保証ではない。

参照元は `three-concerns-review.md`、`signal-and-feasibility-review.md`、Signal の SPEC/test/types、plugin の SPEC/test とする。
canonical reference worktree の HEAD は読み取りで `0ad07bffd601fef7cd708276942b187883ea787e` を確認した。
Accepted #253/#260 の意味、immutable association、同一 association の preflight retry、terminal admission failure を変更しない。
この試作は admission を実装しないので、それらの runtime 成立証拠にも数えない。

## 2. P01 の結果

`logs/p01-result.json` が機械可読の最終結果である。

- TypeScript 6.0.3 の strict、noImplicitAny、checkJs、skipLibCheck:false が通った。
- 22 個の `@ts-expect-error` が有効だった。
  同じ source path の CompilerHost から suppression を除き、22 個の診断が出ることも確認した。
- suppression のない五つの negative が拒否された。
- declaration emit が完了した。
- Signal import の symbol origin は実際に `packages/reactivity/src/types/index.ts` だった。

### 2.1 全登録名と contextual typing

server と create profile template の `bind/on` は、同じ flat registry の全名を受け取る。
`bind("increment", {server:"..."})` と `on("click","countText")` を型として許可し、未登録名を拒否した。
getter と operation の役割で補完候補を分けていない。
この型の許可は、それぞれの関数をその用途で実行して安全だという runtime 証明ではない。

一方、先に独立定義した `ClientContext<Values>` の `ctx.ui` は、後の registry から名前を自動獲得できず、既定では string-wide になる。
`negative/role-leak.ts` に typo が通る反例を残した。
parameter 型のない独立関数は noImplicitAny で拒否する。
inline object の関数に server 側 Values が魔法のように推論されるとは主張しない。

型だけの回避形は二つを実際に通した。

```ts
// Names are derived from the single flat runtime registration.
type Context = ClientContext<CounterValues, unknown, unknown, unknown,
  keyof typeof functions>;
function countText(ctx: Context): string {
  ctx.ui.bind("increment");
  ctx.ui.on("click", "countText");
  return String(ctx.values.count.value);
}
function increment(ctx: Context): void {
  ctx.values.count.set(n => n + 1);
}
const functions = { countText, increment };
export default defineClient(functions);
```

`fixtures/inferred-registry-names.ts` は、この循環を明示 context と return annotation で有限にした形である。
runtime registration は一度だけであり、bindings/operations container もない。
全登録名の union を使い、role filtering を導入しない。
これは optional な型付け方法として推奨する。

強い代案は `type Registry = {countText(ctx:Context):string; increment(ctx:Context):void}` と `keyof Registry`、`satisfies Registry` を使い、default を直接 flat literal に保つ形である。
`fixtures/typed-client-names.ts` が通った。
この代案は signature と名前を型宣言にもう一度書くが、runtime の二重登録はしない。
型だけの名前重複を避けたい場合には、前者の local registry が小さい。
両方とも context と return annotation を置いた形だけが今回の証拠である。

### 2.2 unified record と snapshot

counter の return は `count:Signal<number>` と `title:string` などが一つの record に入る。
server template では snapshot の count を number として読み、書き込みは禁止する。
client context では Signal の `set` を使え、plain slot と nested payload は readonly として型付けする。
`set(previous=>previous)` と readonly updater previous は型として通る。

これは facade の型だけの証拠である。
setter の外部 alias isolation、Object.is、通知、readonly view identity は実行していない。
また、readonly projection は native Signal consumer への構造的代入を閉じていない。
coordinator の反例を `fixtures/native-assignability-acceptance.ts` で再現し、strict の compile acceptance として保存した。

```ts
function nativeConsumer(owned: OwnedSignal<{n:number}>) {
  const native: Signal<{n:number}> = owned;
  native.value.n++; // Compiles; do not treat this as a runtime permission.
  return native;
}
```

これは expected-error assertion ではない。
直接の `ctx.values.payload.value.n++` を拒否しても、構造的に compatible な native view へ渡した後の mutation を TypeScript だけで禁止できない。
runtime freeze と alias isolation は依然必要であり、その native consumer は runtime で throw し得る。
native equality や native updater semantics を完全に保持したとは言わない。
新 branding や engine 変更を今回追加していない。

Signal を認識する真正性、duplicate engine、Computed、第三者 adapter の安全性も P01 の通過からは導けない。
試作 SSR snapshot は、native fixture の peek を使う限定処理であり、前の structural transfer profile 全体の実装ではない。

### 2.3 parser、receive、createComponent input

元の宣言が受理した反例は `logs/p01-received-gap-before.json` に残した。

```ts
function parse(raw: unknown) { return { label: Number(raw) }; }
function initialize(input: ReturnType<typeof parse>) {
  return { count: signal(input.label) };
}
type Values = ReturnType<typeof initialize>;
function receive(ctx: ClientContext<Values, unknown, unknown, {label:string}>) {
  ctx.values.count.set(ctx.received.label.toUpperCase().length);
}
// Previously accepted although the parser produces a number.
const Broken = defineClient({receive}, {create:{
  input:parse, initialize, receive:"receive",
  template(values) { return String(values.count.value); },
}});
```

修正案は parser result `I` の readonly 型を、全登録関数の context が要求する received 型の intersection と照合する。
既存の values 照合も保持する。
新しい public API 名や role container は増やさない。
不整合には `INPUT_TYPE_MISMATCH` の型診断を出す。

selected receive だけを検査する代案は単純だが、同じ input を読む getter や operation の違反を見逃す。
`received-other-function.ts` は selected receive が number を正しく読む一方、別の registered getter が string を要求する反例である。
この例も元は受理され、修正後は拒否された。
all-name bind/on を維持する設計では全関数への検査を選ぶ。
これは、同じ owner の関数 context が同じ current received input を公開するという前提である。
関数ごとに別 input を配る設計へ進むなら、別の明示契約が必要になる。

parser result は `createComponent` の input 型にも伝播する。
`{id:string,label:string}` の parser に `{id:1,...}` を渡す negative を拒否した。
readonly received への代入も拒否した。
JS の関数本体が parser 出力を正しく使うことを TS 宣言から保証するとは言わない。

### 2.4 boolean placement と残る input の境界

`fixtures/boolean-placement.ts` は次を positive として検証した。

```ts
el("input", {type:"checkbox", props:{
  checked:bind("checked", {server:true}), defaultChecked:true,
}});
el("input", {props:{defaultChecked:bind("checked", {server:true})}});
el("button", {disabled:bind("disabled", {server:true})}, "Save");
el("button", {disabled:bind("disabled", {server:false})}, "Enabled");
```

元の `Content` は boolean を除外したため、すべての placement で共有する `BindingOptions.server` も boolean を拒否していた。
修正宣言では boolean を含める。
試作 serializer は native boolean attribute の true を presence、false を omission にし、`aria-busy:false` は文字列 `"false"` にする。
`props.checked/defaultChecked` の SSR 表現も確認した。

content の boolean を空内容とする案は、`condition && el(...)` を記述できるため推奨する。
文字列 `"true"/"false"` を表示したい場合は作者が `String(value)` を返す。
強い代案は content の boolean を診断する形であるが、今回その制限を便宜的に採らない。
空内容であっても bind marker は client capability を保持する。
これは permanent kind の指定ではなく、placement ごとの値の解釈である。

ただし、この declaration の `ClientContext.input.value` は string のままである。
checkbox/radio/file/multiple-select の sink 型、live property、default property と dirty flag、IME、caret、reset は証拠対象外である。
`checked` の型を通した結果から boolean input adoption が成立したとは言わない。

### 2.5 今回の negative と宣言の修正

| negative | 最終結果 | 意味 |
|---|---|---|
| `state-mismatch.server.ts` | TS2769/2349 | 実 client values と異なる server return を拒否 |
| `unannotated.client.ts` | TS7006 | 独立関数の parameter を自動推論したとは言えない |
| `kind.option.ts` | TS2353 | 公開 kind option を導入していない |
| `received-mismatch.ts` | TS2345 | parser number 対 receive string を拒否 |
| `received-other-function.ts` | TS2345 | selected receive が正しくても他関数の received 違反を拒否 |

最初の setup failure は conditional type の改行位置と、actual package path の parent 数だった。
ログを保持し、それぞれ構文と config を修正した。
また public marker return type が export されておらず、独立関数の declaration で TS4058 が出た。
`BindingMarker/EventMarker` の型 export を追加した。
元の full diagnostic は再実行で上書きしたため、その一点は `p01-initial-public-export-failure.txt` に転記と明示している。
他の retained negative は実 compiler の診断ログである。

## 3. P02 の結果

`logs/p02-result.json` に 27 case の最終結果がある。
case 数は coverage の数であり、production correctness の証明数ではない。

### 3.1 module/import graph

実際に build した counter と route は `graph/counter.server.ts`, `counter.client.ts`, `route.ts` にある。
server/client の二つのファイルを一つにしていない。

```text
SSR entry
  -> route.ts
     -> counter.server.ts -> actual reactivity source
                          -> private.server.ts -> node:crypto + secret
     -> one/widget.server.ts
     -> two/widget.server.ts
     -> experimental server facade

Type-only edges (erased from emitted runtime)
  counter.server.ts -> default counter.client.ts
  counter.client.ts -> Values from counter.server.ts

Explicit metadata inventory
  counter.server.ts --clientModule--> counter.client.ts
  one/widget.server.ts --clientModule--> one/widget.client.ts
  two/widget.server.ts --clientModule--> two/widget.client.ts

Browser entries
  -> corresponding .client.ts -> experimental flat client facade
  -> row.client.ts -> neutral row-input.ts + actual reactivity source
```

server-secret sentinel は SSR 出力に実際に残す。
browser top-level sentinel も browser 出力に残す。
treeShaking:false であり、tree shaking による秘密の除去を前提にしていない。
metafile の input graph と出力内容を両方確認した。
server-only guard はこの実験で明示 inventory に登録した resource path だけに適用する。
`.server.ts` suffix を根拠に任意 module を server-only と認定しない。
SSR を実行しても browser top-level counter は変化しなかった。

ordinary runtime import で `.client.ts` を server に入れる negative は、実行時に `BROWSER_TOP_LEVEL_EXECUTED_ON_SERVER` で失敗した。
browser が server-only dependency を import する negative は、実 esbuild が `node:crypto` を解決できず失敗した。
後者だけで全 server dependency の漏洩を防げるとは言わない。
その反例として、browser-compatible な `graph/private-data.ts` の秘密 constant を client が import する例を追加した。
raw esbuild は成功し、その秘密 constant が browser output に入った。
通常 build path にも適用した explicit inventory guard が `E_BROWSER_POLICY_INPUT` で拒否した。
これは bundler magic でなく、declared policy と正規化した graph path の検査である。
未登録 private module を任意に見つける classifier ではない。
不明な境界を production でどう拒否するかは明示 inventory の仕様として別途必要になる。

### 3.2 何が同一性を検査できるか

```ts
import type A from "../one/widget.client.js";
clientModule<typeof A>("../two/widget.client.js", import.meta.url);
```

A/B は同じ default registry shape を持つ。
このコードは TypeScript 単独では診断ゼロだった。
型 generic が消えた後に build がその type-only linkage を比較できる、とは言わない。
この source rule と call grammar は未採用 adapter の一部であり、Accepted #253 の規則に自動昇格させない。

今回の追加 rule は次の範囲を明示して検査する。

1. framework の `clientModule` symbol を、import alias と namespace も含めて特定する。
2. literal specifier を宣言元から TS module resolution で解決する。
3. `typeof importedDefault` または `typeof Namespace.default` の symbol と、runtime path の module default symbol を元ソースの TS Program で比較する。
4. default registry の finite function names と optional create profile を inventory へ登録する。
5. SSR と create profile を組にする explicit shape では、neutral parser の symbol を照合する。

したがって same-shape mismatch は **この追加 source rule によって** `E_TYPE_RUNTIME_SOURCE_MISMATCH` で拒否した。
照合単位は default definition symbol であり、reexport が同じ default へ到達する場合の module 全体の同等性は保証しない。
実参照 module URI は catalog の別の identity である。
これは関数の意味の同等性、偽った declaration、build 後に差し替えた code、third-party provenance の証明ではない。
opaque generic alias、外部 JS と declaration の不一致を shape だけで検出できるとは言わない。
production でこの厳しい source rule を採らない場合、その一致は未検証と表示し、明示 inventory などの別の association 権限を設ける必要がある。

代案は source type witness の同一性を検査せず、runtime default/profile/name validation だけにする形である。
JS と外部 module に自然だが、TS author の wrong-path typo を検出できない。
source-analysis adapter を別途採る場合には、known source の typo を診断するこの rule を推奨する。
現在の境界を保つ場合は manual inventory と runtime default/name validation に保証を限定し、type/runtime semantic mismatch の検出を約束しない。
新しい query import syntax は不要である。

### 3.3 support した import form と診断

| form | 今回の adapter | 証拠または診断 |
|---|---|---|
| `import {clientModule} ...` | 対応 | direct symbol |
| `import {clientModule as link} ...; link<typeof Client>(...)` | 対応 | 実 counter SSR/build/lookup |
| `import * as server ...; server.clientModule<typeof Client>(...)` | 対応 | one/widget の実 SSR/build/lookup |
| `import type * as Browser ...; association<typeof Browser.default>(...)` | 対応 | default symbol 照合 |
| `const forward=clientModule; forward(...)` | この adapter は拒否 | `E_CLIENT_LINK_INDIRECTION`。direct imported alias または namespace を示す |
| nonliteral specifier | この adapter は拒否 | `E_CLIENT_LINK_LITERAL`。literal と宣言位置の import.meta.url を示す |
| 同名の unrelated `function clientModule` | framework として扱わない | collect/rewrite ともゼロ |

local forwarding が原理的に不可能だとは判断していない。
今の bounded rule の外であり、production の明示 inventory 形が必要になる。
任意 function body を抽出したり、その実行から reference を推測したりしない。

### 3.4 relocation は実 lookup で比較した

変換しない build では、SSR bundle の `import.meta.url` から次を実際に解決しようとした。

```text
out/build/naive/server/counter.client.js
```

その file は存在せず、SSR response の module lookup が `E_MODULE_LOOKUP` で失敗した。
string grep による予想ではなく、実行と file existence の反例である。
同じ basename の `one/widget.client.js` と `two/widget.client.js` も、宣言元を失えば区別できない。

修正 adapter は明示 call の base metadata だけを source URL key に変換する。
manifest はその key から `../browser/client-N.mjs` の相対 path へ結ぶ。
source URL は内部 index のキーとして使用し、deploy 時の source file read には使わない。
この実験でも公開 payload から source の絶対 path を除き、`module-0` などの opaque lookup ID と public URL に変えた。
source URL key は server catalog 内にしか置かない。
この ID は per-occurrence identity でなく、一 build fixture 内の module lookup ID である。
production の immutable association や state codec ではない。

fixed output を別の deployment directory にコピーし、元 output を退避し、graph source directory も一時的に unavailable にした。
その状態で relocated SSR bundle を新たに import して SSR を実行し、internal manifest の相対 file URL から三つの browser output を実際に import した。
この段階の file import は deployment smoke であり、public HTTP URL の証拠とは区別する。
各 actual default の function names/callability と catalog の一致も確認した。
元 source と元 output に依存した lookup ではなかった。

browser import は Node に最小 `window` sentinel を置いた module-load smoke である。
実 browser、DOM、CSP、network failure、admission transaction の proof と呼ばない。
その後、別の bounded HTTP mount を追加して public URL と response byte を確認した。
一つの ESM deployment layout だけが証拠であり、Vite/webpack など全 target の対応保証ではない。

#### non-root HTTP mount の追加証拠

Node HTTP server を一時 port で起動し、`/proof/non-root/page` と `/proof/non-root/assets/` を公開した。
実 HTTP response の module map は opaque IDs と public asset URLs を持ち、source の `file:` URL と絶対 filesystem path を含まなかった。
browser bundle は通常 minifier の whitespace/comment 除去を使い、送信 JS byte にも実験 source path が含まれないことを確認した。

生成 bootstrap URL と三つの client URL を実際に fetch し、200 と JavaScript content type を確認した。
fetch した self-contained module byte は Node data URL と window shim で評価できた。
`page-static` の HTTP body は HTML だけで、script/module map を持たなかった。
port、URL、bytes、request path は `p02-result.json` に記録する。

これは実 HTTP mount の URL/byte 証拠であり、production transport の検証ではない。
bootstrap は fetch したが、実 browser で実行して DOM admission する検証ではない。
一つの public base layout のみが対象であり、cross-origin、CSP、cache/version、reverse proxy、実 loader protocol は除外する。

#### source rewrite を採らない fallback

preserve-module output を使い、emitted server module の相対 specifier がそのまま lookup key になる配置にする。
key は file が存在するという意味でなく、clientModule metadata の同一 lookup key である。
manual manifest は、その emitted key を public browser artifact に結ぶ。

```js
// Deployment-owned explicit inventory; not inferred from an author function body.
function catalogFor(serverOutputURL, publicBase) {
  const declaration = new URL("./components/counter.server.js", serverOutputURL);
  const key = new URL("./counter.client.js", declaration).href;
  return { [key]: {
    id:"counter-client", publicURL:publicBase + "assets/counter.client.js",
    file:"../browser/components/counter.client.js", names:["countText","increment"],
  } };
}
```

この config は client code を server に import/execute せず、server/template を移動または抽出しない。
output location を catalog へ渡せば relocation 後の emitted URL を使える。
作者の component association は一度のままであり、追加記述は deployment の explicit entry inventory である。
重複を減らせない点と layout の責任は残る。

この fallback は reasoning sketch のみで、今回 preserve-module output を実行していない。
動いた bundled metadata rewrite と証拠を取り違えない。
#253 の既定境界を維持する推奨はこの fallback である。
自動 source inventory/rewrite を採るなら、少なくとも call grammar と第二引数の source URL literal 置換、entries/manifest selection を新しい scope として user review する。

#### 同じ source と同じ browser engine instance は違う

independent worker B の P03.20 は server snapshot recognition と browser tracking ABI を分ける必要を示した。
B の directory は変更せず、ここでも actual emitted module を使って再現した。
`graph/engine-a.client.ts` と `engine-b.client.ts` は同じ repository の signal/computed を import する。

```js
const count = engineA.signal(1);
const same = engineA.computed(() => count.value * 2);
const foreign = engineB.computed(() => count.value * 2);
// First reads: same=2, foreign=2.
count.set(2);
// Independent emitted bundles: same=4, foreign remains 2.
```

二つの独立 browser bundle の metafile は同じ実 engine source を含んだ。
しかし actual emitted exports の `engineA.signal !== engineB.signal` であり、foreign computed は 2 のままだった。
これは type shape や payload snapshot の話ではなく、live subscription を所有する engine の ABI の問題である。

次に同じ二 entry を一回の普通の esbuild build で `splitting:true` として出力した。
actual file imports が同じ shared chunk に達し、signal と computed の関数 identity が一致した。
cross-entry computed は正しく 2 から 4 へ更新した。
shared の emitted graph も保存した。
この code は engine を変更せず、通常 bundler の共有を利用する。

**推奨 gate**は、同じ realm の Dathra live dependency graph で、loader、復元 Signal、client code、created child code が同じ browser engine URL/runtime instance を使うことである。
後から delivery された module もこの identity を維持する必要がある。
バージョンや bundle URL が違うと、同じ package source でも条件を満たさない。

main adapter は依然 entry ごとの自己完結 bundle を作り、loader を実装していない。
この gate はまだ未達である。
shared build の positive は独立した小さい emitted engine fixture の証拠であり、全 adapter/HTTP/admission integration を修正した証拠ではない。
production では loader を含む app-wide multi-entry graph の shared chunk、または single ordinary external runtime URL にすることを推奨する。

server の snapshot producer が別の engine copy に由来することは、この理由では禁止しない。
server から live tracking object を渡さず、値を snapshot して共通 browser engine へ復元する契約とは両立する。
独立 Web Component の内部 engine と Dathra live graph の間に暗黙共有を導入もしない。
これは消費者の computed が stale になる実用上の問題であり、一般的な性能 deduplication の要請とは区別する。

### 3.5 default/profile/parser/name の negative

| case | 検出地点 | 結果 |
|---|---|---|
| missing module | explicit source inventory | `E_MODULE_MISSING` |
| no default | explicit source inventory | `E_DEFAULT_MISSING` |
| invalid default registry | type-informed source inventory | `E_DEFAULT_PROFILE` |
| different default with same shape | TS 単独では受理、source identity rule では拒否 | `E_TYPE_RUNTIME_SOURCE_MISMATCH` |
| different neutral parser symbol | explicit create/SSR profile rule | `E_CREATE_INPUT_SOURCE_MISMATCH` |
| plain Client を createComponent へ渡す | 提案 type と試作 JS | TS2345 / `E_NO_CREATE_PROFILE` |
| registry の non-function | 試作 JS | `E_CLIENT_FUNCTION` |
| JS bind の unknown name | SSR fixture の activation 検査 | `E_FUNCTION_NAME: misspelled; available label` |
| invalid input record | neutral parser を実行 | `E_ROW_INPUT` |

neutral parser source identity は arbitrary validation function の意味の同等性ではない。
同じ意味の別 parser function もこの rule では拒否する。
SSR/created permission の境界を明確にするための未採用 rule であり、source shape を隠した wrapper まで安全と主張しない。
実装へ進むなら、nonliteral/external profile を許可する明示 inventory を別途設計する。

### 3.6 optional create profile

`graph/row.client.ts` と `graph/row.server.ts` は complete な宣言である。
server と browser profile が neutral `parseRow` を使い、browser initialize は ordinary `signal` を使う。
SSRed row の描画では browser initialize を実行しなかった。
`createComponent` の description を評価しても initialize counter はゼロだった。
明示 fresh initialization を一度実行したときだけ counter が一となり、実 Signal の peek/set が動いた。

この証拠は browser creation profile の graph と lazy intent の成立に限る。
SSR node adoption、parent の child slot 権限、local state restoration、receive schedule、key reorder、fragment、disposal を実装した証拠ではない。
optional 第二引数 create 自体も未採用提案のままである。

### 3.7 static と dynamic zero を分けた

| case | build に存在するもの | 実 response に出たもの |
|---|---|---|
| static-only route | 選択 browser entry 0、browser file 0 | HTML のみ。module refs 0、bootstrap 空、payload null |
| dynamic static branch | potential browser artifact 3 が残る | HTML のみ。同じ三つを response に送らない |
| declared Client + unified Signal record + no markers | potential browser artifact 3 が残る | SSR HTML のみ。prepared record を activation payload にしない |
| 空 server content の bind | association と marker は必要 | 試作 collector は activation を保持する |

利用しない module が他の build output にあることと、その response が browser へ byte を送ることを同一視しない。
この実験では response object の module refs、bootstrap string、payload と、build file selection を別々に assert した。
HTTP middleware が本当に不要 script を差し込まないことや production serializer の omission は未検証である。
active response の bootstrap は fixture の文字列であり、production bootstrap implementation ではない。

## 4. public surface の判定

| surface | この結果 | 残る境界 |
|---|---|---|
| `signal` と実 `Signal<T>` | 実型と小さい実行を使用 | restoration/recognition/alias isolation は別 proof |
| `defineClient({...})` | flat all-name と finite default 型が成立 | 関数 parameter の自動 Values 推論は証明していない |
| optional `defineClient(...,{create})` | contextual template と parser/value/input 制約が成立 | 未採用。runtime permission/adoption/receive は未証明 |
| `clientModule<typeof Client>(literal,import.meta.url)` | 宣言と新しい未採用 adapter が成立 | type-only だけでは identity 不成立。rewrite は user review gate。manual inventory fallback は未実行 |
| `defineComponent({client,server,template})` | unified return と typed helpers、awaited SSR を実行 | production occurrence identity/admission は実装していない |
| `Component(input,request,{_key?})` | route fixture と row fixture で使用 | _key と response identity/DOM identity の同一性を保証しない |
| `defineRoute({render(request)})` | 実 SSR fixture | route/build registration は wrapper adapter。delivery/history は除外 |
| server/client `el` と `_key/props/on` | description と型を使用 | full tag/property/namespace typing、DOM reconciliation は除外 |
| `bind(name,{server})` | all-name、text、boolean placement、empty marker を確認 | property update/adoption/IME/caret は除外 |
| `on(event,name,options?)` | all-name 型を確認 | event propagation/concurrency は実装していない |
| `id(local)` | signature のみ存在 | uniqueness/a11y association は除外 |
| `createComponent(Client,{_key,input})` | typed parser output と lazy intent を確認 | fresh owner allocation と cleanup は除外 |
| `ctx.values/received/ui`, Signal `value/peek/set` | scoped readonly 型の一部を確認 | 新 owned facade の runtime semantics は除外 |
| `ctx.run` | simple sync callback を許可、async callback を拒否 | late-write fence、Promise/lease/pin の runtime は除外 |
| `ctx.input/event` | text/small placeholder のみ | control/event 完全型ではない |
| `ClientContext` の request/delivery generics R/D | 未使用 placeholder | DTO、server operation、delivery は今回の feasibility 判定対象外 |

公開 `kind`、prop/attr helper、query import、states/values の別 container、per-occurrence client selector は増やしていない。
source inventory、manifest、experimental renderer は内部実験 seam であり、新しい作者 helper として隠して提案するものではない。

## 5. 実行環境と再現

`logs/versions.json` に観測値を記録した。

| tool | version |
|---|---|
| Node | 24.15.0 |
| pnpm | 10.17.1 |
| TypeScript | 6.0.3 |
| Vitest | 4.0.4 |
| Vite dependency used to resolve esbuild | 6.4.1 |
| esbuild | 0.25.10 |
| alien-signals | 3.2.0 |

repository root で次を実行する。
依存追加は不要である。

```sh
node tmp/dathomir-262-validation/types-build/run-types.mjs
node tmp/dathomir-262-validation/types-build/run-build.mjs
packages/reactivity/node_modules/.bin/vitest run --config "$PWD/tmp/dathomir-262-validation/types-build/vitest.config.mjs"
```

最後の Vitest は二検証とも pass し、P01/P02 harness を実行した。
更新後の最終 Vitest ログは `logs/vitest-engine-reviewed.txt` である。
native assignability acceptance、non-root HTTP、pure-private guard、emitted engine negative/shared positive を含む P01/P02 を二検証とも実行した。
既存 package test や production implementation を変更していない。

### setup failure と修正を含むログ

- `p01-initial.txt`：conditional type の parse failure。
- `p01-after-parse-fix.txt`：actual engine path の parent 数が不正。
- `p01-initial-public-export-failure.txt`：export 不備の転記。full 原文が上書きされたことを明記。
- `p01-received-gap-before.json`：二つの received mismatch が元の宣言で診断ゼロ。
- `p01-negative-*.txt`：修正後の実 negative 診断。
- `p01-unsuppressed.json`：suppression を除いた 22 診断。
- `p02-first-run.txt`：literal reference は import でないため TS Program が runtime target をまだ持たず、default lookup が module missing に分類された。
  explicit literal target を先に inventory root へ加える二段階処理で修正。
- `p02-*.metafile.json`：実 bundler input/output graph。
- `p02-result.json`：expected negative、URL decode unit、actual relocated lookup、HTTP mount、pure-private leak を含む最終 27 case。
- `vitest-final.txt`：root に vitest command が無い setup failure。
- `vitest-package-run.txt`：require-resolution で Vitest CJS entry を指した setup failure。
  package の Vitest ESM entry を local config から解決する形へ修正。
- `vitest-http-reviewed.txt`：pure-private guard が expected exception を出さなかった実験 failure。
  metafile input は esbuild invocation directory 相対なのに repo root として照合していた。
  `absWorkingDir:repo` を明示し、graph と policy の normalization base を統一した。
  正規化の誤りが guard を抜けさせる反例を保存した。
- `file-url-space-unicode` case：`path.dirname(fileURLToPath(import.meta.url))` に修正し、space と日本語を含む URL の decode/round trip unit を確認。
  alternate checkout や Windows 実行の証拠ではない。
- intermediate P02 の Node module-type warning は、実験 runtime file を `.mjs` にするだけで解消。
  package manifest は変更しなかった。

## 6. coverage と次の判定 gate

P01/P02 は 58 問と元の七 witness を完了させる検証ではない。
今回の型と graph が、それらを作者 API から排除しないかを早期に調べた。

| 元 witness | 今回触れた圧力 | 未証明で保持する要求 |
|---|---|---|
| F 編集中 feedback | text sink の型、boolean property の宣言 | pre-admission edits、IME、caret、a11y、複数 control |
| C reusable cart panels | reusable client/default と autonomous profile の module seam | borrowed/independent ownership、共有 state の actual lifetime |
| B search/history/draft | route request と dynamic zero branch | request race、native/partial navigation、Back の application policy |
| D real Docs Copy | browser-only code と server-only graph の分離 | real host、timer feedback、host disposal、static control |
| M multi-step | unified readonly return と received/input 型 | retained/hidden/disposed draft、checkpoint、late validation |
| T editable table | parser output、_key description、lazy new child profile | business/DOM/response identity、reorder、dirty draft、fragment |
| L live source conflict | no duplicate registration と module seam | conflict/version/disconnect、subscription disposal |

counter は baseline であり、Docs Copy や M/T/L の代替としない。
これらの未証明部分を unsupported と判断する資料でもない。

今回の判定変更は小さく限定する。

1. #247 の API/type owner は `CompatibleReceived` の all-function 制約、boolean content policy、optional names annotation を未採用差分として review する。
2. #247 の build owner は preserve-module/manual explicit inventory を既定として具体化する。
   known-source call selection、metadata relocation rewrite は Accepted #253 で選択済みとせず、新 scope にするかを user に戻す。
   production plugin 対応や外部/opaque inventory は別の実装 gate にする。
3. #247 の browser build owner と #249 の restoration owner は、loader と全 admitted client の shared engine identity を構成する。
   metadata adapter の per-entry build はこの gate を満たしていない。
   SERVER snapshot の duplicate source と混同せず、後続 delivery の runtime URL/version compatibility も gate に含める。
4. #248 の admission/delivery owner は module/default/profile manifest の runtime 検証、per-occurrence immutable association、zero payload/transport を証明する。
   今回の manifest をそのまま admission authority と呼ばない。
5. #249 の owner は readonly owned facade と alias identity、DOM/input adoption、receive publication、lease pin を各 proof slice で確かめる。
   P01/P02 通過によってそれらを engine-equivalent や rollback 済みに昇格させない。

追加の runtime campaign はこの assignment では始めない。
今回見つかった反例と修正を先に coordinator/Astra/user が review する。

## 7. preservation と delivery

既存 dirty root と package manifest/lockfile、および前の二資料の hash を `logs/preservation-before.json` と最終 `preservation-after.json` で比較する。
assigned directory の generated files は実験証拠として保持する。
GitHub、Proposal、Accepted ADR、production file、既存 test に write は行わない。

## archiveで追加した確認

この本文は最初のP01/P02の判定を保持する。
後続の [P02b](p02b/REPORT.md) でmanual inventoryとpreserve-moduleのfallbackを実行したため、本文中のfallback未実行は初回時点の状態である。
archiveのVitest wrapperにP02bを追加し、三つのrunnerを再実行する。
元workerのP01/P02結果は `logs/p01-result-worker-baseline.json` と `logs/p02-result-worker-baseline.json` に保持する。
