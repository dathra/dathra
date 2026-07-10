# Declarative UI execution partitioning design draft

作成日: 2026-07-08
更新日: 2026-07-10

この文書は、Dathra における server / client 実行分割を見直すための設計メモである。
まだ実装は開始しない。
後方互換性は設計上の制約にせず、現行 API と runtime semantics の破壊的変更を許容する。

## 最終目標

今回の最終目標は、reactive graph hydration を実装することではない。

開発者が UI を一度自然に宣言すれば、framework / compiler が「何を server で実行するか」「何を client に送るか」「既存 DOM にどの振る舞いを接続するか」を導出できる状態を目指す。

```txt
declarative UI
  -> server で完結する処理は server に閉じる
  -> browser で必要な処理だけを client に送る
  -> server が生成した DOM をそのまま利用する
  -> 必要な振る舞いだけを既存 DOM に接続する
```

この目標では、component は UI の構造と所有権を表現するために使える。
server / client の実行場所を指定するためだけに、開発者が component を不自然に分割する必要はない。

目標を一文で表すと次のようになる。

> 宣言的 UI から server / client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する。

Hydration、reactive graph extraction、island、明示 directive は、この目標を実現するための手段または設計候補である。
この段階では、いずれも最終目標そのものではなく、採用済みの方式でもない。

## アプローチの評価基準

実現方式は、少なくとも次の基準で評価する。

- server だけで完結する処理と依存 package を client artifact から除外できる
- browser で必要な state、event、effect、DOM update だけを client で実行できる
- server が生成した HTML / DSD を再構築せず利用できる
- 実行場所の都合だけで component の責務や構造を歪めずに済む
- compiler が安全に推論できない場合は、明示 contract または diagnostic によって意味を確定できる
- client へ送る code、data、runtime work を必要な範囲に制限できる

reactive graph extraction がこれらを満たせない場合は、別の分割方式を選ぶ。
反対に、目標を保てるなら、実装方式を reactive graph に限定する必要はない。

## 合意済みの実行モデル

この節は、2026-07-10 時点で合意した設計原則を記録する。
reactive graph extraction の採否とは切り分けて扱い、後続の検討ではこの原則を評価基準として使う。
正式な仕様と API 名はまだ確定していない。

### 解析対象となるグラフ

compiler が解析する上位概念は、runtime reactive graph ではなく **実行依存グラフ** とする。
実行依存グラフには、render 計算、通常の値、function、import、event、effect、DOM update、cleanup の依存関係を含める。

reactive graph extraction を採用する場合、client reactive graph は実行依存グラフから抽出される client execution graph の一部になる。

```txt
compile-time execution dependency graph
  -> server render graph
  -> client execution graph
       -> client reactive graph
  -> serialized value
  -> shared or duplicated computation
```

### root と配置制約

**root** は、外部から観測される結果または実行入口として、それ自体を実行する必要がある node とする。
compiler は root から依存関係を逆向きにたどり、必要な node を各 artifact へ配置する。

```txt
SSR response へ出力を作る node
  -> server root

DOM event、timer、observer など、browser の外部 trigger に登録された callback
  -> client root

client で変更され得る値を DOM へ反映する updater
  -> client root

component-scoped effect と client activation / cleanup lifecycle
  -> client root

signal、function、import、通常の値
  -> root ではなく依存 node

browser-only / server-only API への参照
  -> root ではなく配置制約
```

function は定義されただけでは root にならない。
たとえば browser-only API を参照する function も、client root から到達できない場合は client artifact に含めない。

### function の client artifact 化

function の code extraction と値の serialization は、実行される phase が異なる。

```txt
function の code extraction
  -> build 時

値の serialization
  -> request ごとの SSR 時
```

client root から到達する function は、function object として serialize しない。
compiler は function 本体と client-compatible な code 依存を build 時に client artifact へ出力する。

function が参照する free variable は、client artifact に含まれる code、client で生成する値、server から serialize する値のいずれかとして解決する。

```txt
client root
  -> client function
       -> client-compatible helper code
       -> serialized capture
       -> client-only platform API
```

function と推移的な code 依存が browser で実行でき、必要な free variable を client 側で解決できる場合、その function を **client-compatible** とする。
server-only import、client へ渡せない resource、secret へ到達する function は client-compatible ではない。

client root から client-compatible ではない function へ到達した場合は compile diagnostic とする。
compiler は通常の server-only function call を暗黙の RPC または server action へ変換しない。

server で生成された closure function object も serialize しない。
closure の factory と入力が client-compatible なら client で closure を生成し、そうでなければ compile diagnostic とする。

### component body の契約

component body は、render-safe な宣言と計算を記述する領域とする。
ここでいう render-safe は、再実行によって返り値以外の観測可能なアプリケーション動作を変えないことを指す。

component body には、JSX、通常の宣言、render-safe な計算、compiler が意味を理解する framework primitive を直接記述できる。
実行場所、実行時刻、実行回数が意味を持つ副作用は、component body に直接記述せず、event、client effect、client lifecycle、server action、request handler などの明示的な実行入口へ置く。

event handler 内の副作用は、browser event が client root になるため許可する。
server render の結果に使われる計算は、返り値への依存関係から server graph へ配置する。

`Date.now()`、`Math.random()`、platform API の read などは、観測可能な書き込み副作用とは分けて、非決定的な入力または配置制約として扱う。
これらの値を server と client のどちらで計算するかは、capture model とあわせて決める。

### server-first の配置規則

初期 UI と server だけで完結する仕事は server へ閉じ、interaction と継続的な更新に必要な仕事だけを client へ配置する。

```txt
server render root から必要になる計算
  -> server で実行する

browser event、client state、client-only API から必要になる計算
  -> client で実行する

server で確定した値を client root が参照する
  -> server snapshot を serialize する

server / client のどちらでも同じ意味で計算でき、server render 中に値が得られる
  -> server snapshot を default にする
  -> client 計算に利点があり、同値性を証明できる場合だけ client で再計算できる
```

compile-time constant は request payload に含めず、client artifact へ直接埋め込む。
client-owned state は client で生成し、初期値が server の計算結果に依存する場合だけ初期値を serialize する。

client root から参照されない server 計算結果は、client payload に含めない。
client での再計算は source semantics ではなく optimization として扱い、最初の実装では必須としない。

cross-boundary value では、serialize 可能かという **transferability** と、client へ公開してよいかという **exposure policy** を分けて判定する。
client へ移送できない resource と、serializable でも secret を含む値は compile diagnostic とする。

### cross-boundary transfer protocol

serializer は cross-boundary dependency を扱う方法の一つとし、すべての依存を serialization へ押し込まない。
compiler は各 cross-boundary dependency に **transfer plan** を割り当てる。

```txt
inline
  -> compile-time constant を client artifact へ埋め込む

serialize
  -> server snapshot を client value として復元する

code extraction
  -> client-compatible function と code 依存を client artifact へ出力する

reconstruction
  -> class、signal、store などを code と入力値から client で再構築する

reference resolution
  -> DOM node、asset、framework-owned resource を marker、id、URL などから解決する

remote operation
  -> 明示された server action または streaming protocol を使う
```

compiler は次の順序で transfer plan を検討する。

```txt
1. client root から参照されていない
   -> server に閉じる

2. compile-time constant である
   -> inline

3. data として transfer できる
   -> serialize

4. client で同じ意味を再構築できる
   -> code extraction または reconstruction

5. framework、library、application が transfer contract を提供する
   -> codec、resolver、adapter を使う

6. remote operation として明示されている
   -> server action または protocol を使う

7. 正しい transfer plan を構築できない
   -> compile diagnostic または SSR diagnostic
```

custom class を含む未知の型は、型名だけを理由に unsupported としない。
compiler による再構築、組み込み contract、user / library contract の順に対応方法を探す。

この設計でいう **unsupported** は、「framework の型一覧にないこと」ではなく、「安全で意味を保つ transfer plan を構築できないこと」を指す。

transfer plan を構築した後も exposure policy を検証する。
codec や adapter が存在しても、secret など client へ公開できない値の transfer は許可しない。

### semantic classification と unknown

compiler は、すべての dependency に実行環境、副作用、transfer capability に関する semantic classification を与える。
classification の情報源は次の三層とする。

```txt
project source と解析可能な dependency
  -> compiler が source を解析する

Dathra で compile された package
  -> package が semantic manifest を生成して提供する

source または manifest から判定できない dependency
  -> framework、library、application が明示 contract を提供する
```

project source は、可能な範囲で module をまたいだ whole-program analysis の対象にする。
Dathra package の semantic manifest には、少なくとも export ごとの environment constraint、render safety、effect、transfer capability、code dependency を記録できるようにする。
manifest schema と明示 contract の API はまだ決定しない。

semantic information が不足している dependency を、即座に unsupported としない。
root からの到達関係と必要な transfer plan に応じて、次のように扱う。

```txt
server root からだけ到達する unknown code
  -> server に閉じる

server で得た結果だけを client root が必要とする
  -> code は server に閉じ、結果の transfer plan を構築する

client root から code として到達する
  -> client-compatible かを source、manifest、contract、client build で検証する

client recomputation optimization に利用したい
  -> render safety と同値性を証明できなければ optimization を行わない

component body に裸の unknown side effect がある
  -> 明示 contract または compile diagnostic を要求する
```

unknown は通常の配置を直ちに失敗させるものではなく、証明を必要とする変換だけを制限する。
client root へ安全に配置できず、ほかの transfer plan も構築できない場合に限り diagnostic とする。

「すべてを解析する」は、すべての source を compiler 単独で証明することに限定しない。
compiler inference、semantic manifest、明示 contract のいずれかにより、すべての cross-boundary dependency を分類できる状態を目指す。

### 破壊的変更と client scope DAG

最終仕様は現行の component hydration、island scheduler、manual hydration API との互換性を前提にしない。
再利用する既存実装は、新しい実行モデルへ適合する内部処理だけに限定する。

client runtime の ownership は、次の三つに分ける。

```txt
lifetime owner
  -> client scope をいつ dispose するかを決める

shared state scope
  -> signal、resource、reconstruction result の identity を保持する

activation group
  -> client root の code をいつ load して起動するかを決める
```

client scope は component tree ではなく、client root と shared dependency から compiler が導出する DAG とする。

```txt
lifetime owner
  -> shared state scope
       -> interaction activation group
       -> visible activation group
       -> effect activation group
```

異なる activation group が mutable state を共有する場合、shared state scope を prerequisite として分離する。
最初に起動した dependent group が shared state scope を初期化し、後から起動した group は現在の state を読んで DOM と effect を同期する。
異なる policy を持つ group を、実装の単純化だけを理由に早い policy へ統合しない。

immutable capture の共有だけでは activation group を統合しない。
semantic grouping と client chunk の bundle optimization も分けて扱う。

`defineComponent` の host は Web Component、ShadowRoot、style、disconnect notification の lifetime owner 候補として扱う。
`defineComponent` 自体を client boundary、hydrate unit、activation group にはしない。

functional component は graph-transparent とし、独自 owner を作らない。
plain DOM では、compiler が生成する SSR marker または DOM range を lifetime anchor として使う。

通常利用で manual `hydrate()` を要求しない。
client scope がある場合だけ compiler / plugin が bootstrap と manifest を生成し、client scope がなければ client bootstrap 自体を生成しない。

現行の `client:*`、`data-dh-island` scheduler、`hydrate` option、`planFactory`、component-level hydration semantics は互換性の対象にしない。
author-facing な activation policy には `client:*` を引き継がず、placement と timing の違いを名前でも区別する `activate:*` を使う。
既存の内部処理を残す場合も、新しい client scope semantics に必要なものだけを再定義して使う。

安全な client scope artifact または transfer plan を構築できない場合は diagnostic とする。
component 全体を黙って rerender する fallback は最終仕様に含めない。

実装は段階的に進めてもよいが、移行途中の制約を最終 API と execution model へ持ち込まない。

### client lifecycle

DOM が document へ接続された時点と、activation group が起動した時点は同じとは限らない。
そのため、client lifecycle の基準には mount ではなく compiler-derived client scope を使う。

API 名は未決定だが、意味は次のように固定する。

```txt
effect
  -> client reactive root
  -> activation 時に実行する
  -> 依存値の変更時に再実行する

client activation hook
  -> client root
  -> owning activation group ごとに一度実行する

client cleanup hook
  -> client lifecycle root
  -> owning activation group または shared state scope の破棄時に実行する

event handler
  -> client root
  -> 対応する browser event が発生した時だけ実行する
```

effect の cleanup は、再実行前と owning client scope の破棄時に実行する。

### server render の実行回数

汎用的な `serverEffect` は導入しない。
server render 計算は replay 可能とし、ゼロ回、一回、複数回のいずれで実行されても意味が変わらないことを契約とする。

実行回数に意味がある database write などの処理は、component render の外にある server action、request handler、transaction で扱う。
response header、resource preload、head metadata などが必要になった場合は、汎用 effect ではなく用途別の宣言 API を検討する。

### root 判定と activation policy

server / client root の判定と、client graph をいつ起動するかという activation policy は別の設計段階に分ける。

```txt
1. server / client root を判定する
2. execution dependency graph を分割する
3. client root を activation group にまとめる
4. activation policy を割り当てる
```

placement は compiler が root と依存関係から導出し、directive による client opt-in を要求しない。

推論した activation group の既定 policy は `eager` とする。
明示的な activation policy が必要な場合は `activate:*` を使い、推論済み client graph の起動時刻だけを変更する。
`activate:*` は client root を新しく作らない。
client root がない場所への activation 指定は compile diagnostic とする。

## 現在検討しているアプローチ

現在は、compiler が source から実行依存グラフを構築し、server render graph と client execution graph を抽出する方式を検討している。
これは有望な仮説ではあるが、実現可能性、解析限界、明示 contract の必要範囲をまだ検証していない。

2026-07-08 追記:

- `client:*` opt-in island を中心にする案は、初期仮説として残す
- compiler-inferred reactive graph extraction は、component より細かい実行分割を実現する候補として検討する
- この文書では、最終目標と実現方式を分け、各方式を未確定の設計案として記録する

## Reactive graph extraction の初期設計仮説

この節は、client scope DAG を最終形とする合意より前に検討した reactive edge model を記録している。
reactive dependency extraction は再利用候補だが、component と hydrate unit を中心にした記述は client scope DAG によって supersede される。

Dathra は SSR / DSD を first-class に扱う。
reactive graph extraction 案では、Hydration を component 全体の client 再実行ではなく、client に必要な reactive edge を既存 DOM に接続する処理として捉える。

この案が置く仮説は次の通り。

- hydrate unit は component ではなく、DOM binding / event / signal / effect の edge である
- compiler は source を server render graph と client reactive graph に分ける
- server render graph は SSR HTML / DSD を作るだけで、client bundle に入らない
- client reactive graph は event handler / signal / DOM binding だけを含む
- client graph が必要とする server 計算済みの値だけを serialized capture として渡す
- `defineComponent` は DOM ownership boundary / Web Component boundary であり、hydrate unit ではない
- functional component は graph-transparent な render function として扱い、hydrate boundary にはしない
- activation policy の構文は未決定とし、現在の `client:*` が残ることを前提にしない
- `hydrate:preserve` は DOM subtree の保全指定であり、server code を client から除外する指定ではない

初期 opt-in 案の原則は次の通り。

- plain DOM は自動 hydrate しない
- 普通の functional component も自動 hydrate しない
- `defineComponent` も `client:*` なしでは自動 hydrate しない
- `client:*` は「hydration を遅らせる directive」ではなく、「client boundary を作る directive」として扱う
- `planFactory` は hydrate 可能性を示す capability であり、hydrate すべきという intent ではない
- DSD が存在しても、hydrate intent がなければ preserve-only とする

つまり、基本ルールは次の形を目指す。

```txt
client:* がないもの
  -> server/render-time HTML
  -> client runtime に入れない
  -> hydrate しない

client:* があるもの
  -> client boundary
  -> strategy に従って client 側で起動する
```

この初期案は、Astro 的な明示 island model に近い。
この案は、browser event callback を directive なしで client root とする合意済みの規則とは両立しない。
そのため、採用候補ではなく設計経緯を示す比較案として残す。

## Reactive graph extraction の分割モデル

この案では、component を hydrate するのではなく、reactive graph のうち client に必要な edge だけを hydrate する。

compiler は component body / JSX / signal usage / event handler / directive を解析し、少なくとも次の 4 種類の artifact に分ける。

```txt
server render graph
  -> SSR HTML / DSD を生成する
  -> server-only 処理を実行できる
  -> client に送らない

client reactive graph
  -> signal / effect / event handler / DOM binding を含む
  -> 既存 DOM の path / marker に binding を接続する
  -> server-only 処理を含めない

serialized capture
  -> server で計算済みの値を client graph に渡す
  -> primitive / JSON-safe / framework-defined serializable value に制限する

preserved DOM region
  -> SSR 済み DOM を client 側で再構築しない
  -> hydrate 対象から除外されるが、必要なら外側の client graph から参照可能にする
```

期待する mental model:

```txt
hydrate されるもの:
  DOM binding
  event listener
  signal/effect edge
  cleanup edge

hydrate されないもの:
  component call そのもの
  server-only render work
  static DOM
  preserved DOM subtree
```

この案では、`client:*` がない component でも、compiler が client reactive graph を検出すれば必要最小限の client artifact を生成できる。
逆に、`client:*` があっても component 全体を client artifact に入れる必要はない。

activation policy の明示 API を導入する場合は、次の役割だけを持たせる。

```txt
browser event、client effect、client で変更され得る値の DOM updater がある
  -> compiler が client graph を推論する

明示された activation policy
  -> 推論された client graph の activation policy を変更する

client graph が存在しない箇所の activation policy
  -> compile diagnostic にする
```

## DocCodeBlock を基準にした期待分割

`docs/src/components/DocCodeBlock/DocCodeBlock.tsx` は、この設計で解きたい代表例である。

現在の component には、server-only にしたい処理と client で必要な処理が同居している。

```txt
server-only にしたいもの:
  source の整形
  syntax highlight
  highlighted HTML の生成
  highlighted DOM の SSR

client に必要なもの:
  copied signal
  copy button の class binding
  copy button の text binding
  onClick handler
  clipboard write
  reset timer
  cleanup

serialized capture:
  source
  initial copied=false

preserved DOM:
  highlighted code subtree
```

期待する出力は次の形である。

```txt
server artifact:
  source = getCodeSource(children, props.code)
  highlightedHtml = highlightCode(source, props.language)
  render DSD / HTML

client artifact:
  copied signal
  handleCopy()
  bind button.class
  bind button.text
  attach button.click
  cleanup resetTimer

manifest:
  host/path information
  activation policy
  serialized source
  binding plan
```

重要な点は、`hydrate:preserve` だけでは server-only code の分離にはならないことである。
`hydrate:preserve` は DOM subtree を壊さない指定であり、highlight 処理やその import を client artifact から除外する責務は compiler の graph 分割が持つ。

## 対象ごとの意味

### plain DOM

初期 opt-in 案では、通常の HTML 要素はデフォルトで SSR HTML に展開されるだけである。

```tsx
<button onClick={copy}>Copy</button>
```

この初期案では、`onClick` は自動では client に残らない。
ただし、合意済みの root 判定では browser event callback を client root とするため、この挙動は現在の設計候補ではない。

初期案では、client 側で動かしたい通常 DOM にも `client:*` を許可する方向を検討していた。

```tsx
<button client:load onClick={() => copy(code)}>Copy</button>
```

初期案では、`button` を root とする DOM island / action island を compiler が生成する。
現在の設計では、`client:*` がなくても `onClick` を client root と判定する。

### functional component

普通の関数コンポーネントは、graph-transparent な render function として扱う。
custom element identity、ShadowRoot、lifecycle、hydrate boundary は持たない。

```tsx
function HighlightedCode({ code }) {
  const html = highlight(code);
  return <pre server:html={html} />;
}
```

この component が server-only work だけを持つなら、server 側で展開され、client bundle に入らないことを目指す。
別途 `defineServerComponent` のような API は現時点では不要と考える。

一方で、functional component が signal / event handler / effect を含む場合、その component 自体を hydrate boundary にするのではなく、caller の graph へ展開して client reactive edge だけを抽出する。

```tsx
function CopyButton({ source }) {
  const copied = signal(false);
  return (
    <button onClick={() => copied.set(true)}>
      {copied.value ? "Copied" : "Copy"}
    </button>
  );
}
```

この場合、`CopyButton` component を hydrate するのではない。
`copied` signal、button text binding、button click handler だけを client graph に入れる。

解析できない imported functional component は opaque として扱う。
opaque component に client reactive edge が必要な場合は、compile 済み manifest / 明示 contract / diagnostic のいずれかが必要になる。

### defineComponent

`defineComponent` は Web Component の DOM ownership と lifetime を提供する API として扱う。

```txt
defineComponent:
  custom element registration
  host element identity
  ShadowRoot / DSD ownership
  styles ownership
  disconnect notification

担当しないもの:
  server / client boundary
  hydrate unit
  activation group
  client chunk boundary
```

一つの `defineComponent` host は、複数の shared state scope と activation group の lifetime owner になり得る。
一方、plain DOM の client scope は `defineComponent` なしでも marker または DOM range を owner にできる。

## DSD と client scope activation

DSD は SSR HTML から Shadow DOM を構築する仕組みである。
client scope activation は、既存 DOM に必要な client behavior を接続する仕組みである。

したがって、DSD があることは client scope の存在または activation intent を意味しない。

```txt
DSD あり + client scope なし
  -> preserve DSD
  -> client runtime を起動しない

DSD あり + client scope あり
  -> activation policy に従って prerequisite scope と activation group を起動する
  -> compiler-generated DOM reference と binding plan を既存 DSD へ接続する

DSD なし + CSR execution
  -> 同じ scope artifact を fresh DOM mount path で起動する
```

## activation policy と activate:* の扱い

現在の `client:*` は「自動 hydrate を遅らせる」意味に近い。
見直し後はこの構文と名前を author-facing API として引き継がない。

client placement は compiler が推論するため、`client:*` を client code への opt-in または component boundary として使わない。
一方、`visible`、`idle`、`media` などの performance policy は source の意味だけから決められないため、`activate:*` で明示する。

client root を含む activation group の既定 policy は `eager` とする。
`eager` は対象 HTML と prerequisite scope の準備が完了した時点で activation を開始する意味であり、`window.load` を待つ意味ではない。
通常の UI は directive を書かなくても `eager` で動作する。

author-facing API は次の policy を扱う。

- **`activate:eager`**：既定 policy を明示する。
- **`activate:visible`**：対象が最初に可視条件を満たした時点で起動する。
- **`activate:idle`**：browser が idle work を実行できる時点で起動する。
- **`activate:interaction`**：対象への対応可能な最初の interaction を契機に起動する。
- **`activate:media="..."`**：指定した media query が最初に一致した時点で起動する。

activation state は次の一方向の遷移とする。

```txt
inactive -> activating -> active -> disposed
```

一度 `active` になった group は、可視条件または media query が後から成立しなくなっても deactivate しない。
再び必要になった code と state を復元する契約がないため、activation policy は起動時刻だけを決める。

DOM subtree に置かれた `activate:*` は、その subtree に observable target または lifecycle owner を持つ推論済み client root へ適用する。
subtree 自体を client boundary に変換せず、共有する mutable state は client scope DAG 上の prerequisite scope として扱う。
同じ依存関係に異なる policy が指定された場合、compiler は意味を保ったまま activation group を分割する。
分割できない場合は compile diagnostic とし、早い policy へ暗黙に統合しない。

event-only graph に `interaction` を自動割り当てない。
最初の event が handler の code load より先に発生すると、transient user activation、submit、navigation、focus などの意味を保持できない場合があるためである。
`activate:interaction` は明示指定とし、最初の event を意味どおり処理できる場合だけ許可する。
event の buffer と replay で意味を保持できる場合はその方法を使う。
user activation 中の同期実行が必要な場合は、同期 stub または handler を event 発生前に読み込んでおく必要があり、それを保証できなければ compile diagnostic とする。
native default action を replay できない場合も compile diagnostic とする。

client root がない場所への `activate:*` は compile diagnostic とする。
advanced integration 向けの manual activation API を公開するかは、generated bootstrap の責務と合わせて別途決める。

未決事項：

- `activate:*` が対象とする activation group を曖昧さなく選択する規則
- `visible` の observation 条件と `idle` の scheduler fallback
- `interaction` で対応する event と first-event 処理の compatibility matrix
- client scope DAG 上の prerequisite activation の具体的な実行順序

## server code と client code の分離

client runtime を必要な範囲に制限するには、DOM へ接続する処理だけでなく、client に送る code graph も分割する必要がある。

そのためには、server artifact と client artifact を分ける必要がある。
ただし、source/API を分ける必要があるという意味ではない。

同じ source を解析して次を生成する。

```txt
server artifact
  -> SSR HTML / DSD を生成する
  -> server-only 処理を実行できる
  -> client に送らない

client scope artifact
  -> shared state scope と activation group を構築する
  -> event handler / signal / effect / binding / cleanup を含む
  -> server-only 処理を含めない

manifest
  -> lifetime owner / scope id
  -> prerequisite scope ids
  -> activation policy
  -> transfer plans
  -> client chunk reference
```

manifest の中心は component boundary ではなく client scope DAG になる。

```txt
manifest
  -> lifetime owner
  -> shared state scope
  -> activation group
  -> prerequisite edges
  -> DOM path / marker
  -> activation policy
  -> transfer plans
  -> client scope chunk reference
  -> preserved region information
```

今の transformer は `mode: "ssr" | "csr"` で出力を切り替えている。
しかし、それは output mode の切り替えであり、root と依存関係から client execution graph だけを抽出する仕組みではない。

この差分を新設計で埋める必要がある。

## cross-boundary transfer model

client execution graph から参照された値や処理には、明示的な transfer plan が必要になる。
ここを曖昧にすると、server-only 処理や重い依存が client に漏れる。

placement constraint と transfer plan は別に判定する。

```txt
server-only
  -> client graph から処理として参照禁止

client-only
  -> server render 中に実行禁止

universal
  -> server / client 両方で使用可

serialized value
  -> server で計算済みなら client に値として渡せる

client-reachable function
  -> function object は serialize しない
  -> client-compatible なら function code を client artifact へ出力する

reconstructable value
  -> class code、factory、入力値から client で再構築する

reference value
  -> marker、id、URL などから client 側の値を解決する

remote operation
  -> 明示された server action または protocol を使う
```

重要な区別:

```tsx
const result = serverWork(input);
<button onClick={() => useResult(result)} />
```

`result` が serializable なら許可できる。
この場合、client graph は `serverWork` の処理ではなく、server で計算済みの `result` を snapshot として capture する。
同値性を証明した client recomputation を導入しない限り、この serialize path を default とする。

```tsx
<button onClick={() => useResult(serverWork(input))} />
```

これは `serverWork` の処理そのものを client graph へ持ち込む。
`serverWork` が server-only なら compile error にする。

## DOM preservation

static DOM は client mutation plan に含めず、明示 directive がなくてもそのまま保持する。
compiler が binding または insertion target として抽出した DOM だけを client scope から更新する。

現行の `hydrate:preserve` は互換性の対象にしない。
imperative code などのために明示的な DOM preservation contract が必要だと判明した場合だけ、新しい semantics で別途導入する。

## unsupported fallback

unsupported は component 単位ではなく、cross-boundary dependency または client scope artifact 単位で判定する。

方針:

- client root なし
  - preserve-only
- client root ありで安全な transfer plan または client scope artifact を生成できない
  - dev error
  - 利用可能な extension contract を diagnostic で提示する
- 明示された activation policy があるが client execution graph を生成できない
  - dev error
  - author intent を無視しない
- rerender fallback
  - component 全体の暗黙 rerender は行わない

## nested client scope

static parent の内側に独立した child client scope を置ける。
child scope は custom element host に限定せず、compiler-generated marker または DOM range を lifetime owner にできる。

outer に client scope がない場合も、child scope は独立した activation policy で起動できる。
outer と child が shared state scope を共有する場合は、client scope DAG の prerequisite edge で表現する。

## 実装前に決めること

まだ実装には入らない。
先に次を決める。

1. reactive graph extraction を client scope DAG の導出方式として採用するか
2. execution dependency graph と transfer plan の compiler IR
3. shared state scope、activation group、prerequisite edge の compiler IR
4. lifetime owner の導出、disconnect 検出、dispose semantics
5. client scope artifact と manifest schema
6. semantic manifest schema と明示 execution contract の API
7. serializer が扱う value model、identity、循環参照、deduplication
8. built-in transfer contract と user / library extension contract
9. reconstruction、reference resolution、remote operation の lifecycle と ownership
10. client recomputation の同値性証明と cost model
11. secret と client exposure policy を表す contract
12. source、manifest、contract が競合した場合の優先順位と diagnostic
13. 非決定的な入力と platform API read の配置規則
14. `activate:*` の observation 条件、scheduler fallback、first-event compatibility
15. server-only / client-only / universal の判定方法
16. functional component を graph-transparent に扱える範囲
17. opaque imported component の contract
18. generated bootstrap と advanced integration 向け low-level activation API の責務
19. `defineComponent` host と plain DOM marker の lifetime owner semantics
20. DSD style の扱い
21. `data-dh-store` snapshot を shared state scope が必要な場合だけ出す方法
22. transfer plan を構築できない client dependency の diagnostic
23. 既存 `hydrateWithPlan` / `hydrateIslands` から再利用する内部処理

## 現時点の整理

最終目標として固定するのは、宣言的 UI から server / client の実行配置を導出し、client へ送る処理を必要な範囲に制限することである。

component body の render-safe 契約、root と配置制約の区別、server-first の配置規則、cross-boundary transfer protocol、semantic classification の三層構造、client activation lifecycle、`eager` を既定値とする activation policy、server render の replay 可能性は、実装方式に依存しない設計原則として合意した。

後方互換性は設計上の制約にせず、最終形を compiler-generated client scope DAG とする。
現行の component hydration、manual `hydrate()`、island host boundary、暗黙 rerender fallback の semantics は引き継がない。

reactive graph extraction を client scope DAG の導出へどこまで使うかは、まだ決定していない。
activation policy は `activate:*` で表現し、指定がない activation group は `eager` とする。
各 policy の observation 条件、scheduler fallback、first-event compatibility は今後決める。

client scope DAG が目指す実行モデルは次の通り。

```txt
HTML は server-first。
client runtime に入るのは compiler が生成した client scope DAG とその code dependency だけ。
component replay と manual hydration call は通常の実行経路にしない。
client activation は既存 DOM に必要な behavior だけを接続する。
```

## 議論メモ: runtime reactive graph と compiler-inferred client graph

Dathra には既に runtime reactive graph がある。
`signal` / `computed` / `effect` / `templateEffect` により、実行時に signal read と effect / binding の依存関係が記録され、signal update に応じて DOM binding や effect が再実行される。

ただし、この runtime reactive graph は「reactive な要素を source から特定する」ためのものではない。
役割は、既に実行された binding / effect が読んだ signal を追跡し、その signal が変化した時に該当 effect を再実行することである。

```txt
runtime reactive graph:
  -> signal update に対して、どの effect / binding を再実行するかを管理する

compiler-inferred client reactive graph:
  -> source を解析し、client に送るべき signal / event / DOM binding / cleanup edge を抽出する
```

そのため、runtime graph が存在するだけでは server-only code の client bundle 混入は防げない。
client で component body 全体を実行して runtime graph を作る場合、server-only work や重い依存も同じ client artifact に巻き込まれやすい。

`DocCodeBlock` の例では、client に必要なのは `copied` signal、copy button の class / text binding、`onClick` handler、timer cleanup である。
一方、syntax highlight や highlighted HTML の生成は server render graph に閉じたい。

したがって、問題の根は次の点にある。

```txt
server と client で component body / setup が同じ実行単位として扱われると、
server-only work と client reactive work が client artifact 上で分離されにくい。
```

reactive graph extraction 案の狙いは、DOM 再構築を避けることだけではない。
client に送る code graph を、実際に必要な reactive edge まで小さくすることも狙っている。

## 議論メモ: React / Vue との比較

React の従来 hydration も、server で component tree を render し、client で同じ component tree を再実行して既存 DOM に event / state / effect を接続する model である。
このため、server-only work と client interaction が同じ component に同居すると、client component 側へ server-only dependency が巻き込まれやすい。

React Server Components は、この問題を component boundary で解く。

```txt
React Server Components:
  Server Component は server だけで実行され、client bundle に入らない
  Client Component は browser で hydrate / interactive になる
  "use client" 以降の subtree は client artifact に入る
```

Dathra の reactive graph extraction 案は、React Server Components より細かい粒度を目指す。

```txt
React の境界:
  component boundary

Dathra reactive graph hydration の境界:
  DOM binding / event / signal / effect edge
```

Vue も同系統の問題を持つ。
Vue SSR は基本的に universal component model であり、server で render した Vue app と同じ app implementation を client でも作成して hydration する。
Vue 公式 docs でも、SSR app は多くの code が server と client の両方で動く isomorphic / universal app と説明されている。

Vue template compiler は、Dathra がいう reactive edge に近い情報を一部持っている。
たとえば static hoisting、patch flags、block tree / tree flattening により、どの element が dynamic class / props / text を持つか、どの dynamic descendants だけを hydration 時に辿ればよいかを把握する。

ただし、Vue の compiler hints は主に runtime rendering / hydration の最適化に使われる。

```txt
Vue compiler hints:
  -> static subtree を skip する
  -> patch flag により class / text / props などの update fast path を使う
  -> hydration 時に block nodes と dynamic descendants だけを辿る

使われないもの:
  -> server-only import を client bundle から落とすための program slicing boundary
```

つまり Vue の template-level partial hydration は、DOM traversal / patch cost の削減であり、component execution / bundle graph の分離ではない。
client hydration 後も Vue component instance、reactive scope、props、lifecycle、provide/inject、refs、scheduler、render effect が必要になる。

Nuxt は server/client 分離を framework layer の明示 boundary で扱う。

```txt
Nuxt の boundary:
  .server.vue
  .client.vue
  <ClientOnly>
  server components / islands
  lazy hydration strategies
```

たとえば `.server.vue` の server component では、markdown parsing や highlighting libraries を client bundle に含めないことができる。
これは component / file boundary による分離であり、template compiler の patch flags による自動 program slicing ではない。

Vue / Nuxt と Dathra 案の違いは次の通り。

```txt
Vue:
  template compiler が dynamic binding を把握する
  hydration / patch を fast path 化する
  server/client bundle 分離は component / file boundary に寄せる

Nuxt:
  .server.vue / .client.vue / islands で明示的に境界を作る
  lazy hydration は component 単位で activation timing を制御する

Dathra reactive graph extraction 案:
  compiler が source を server render graph と client reactive graph に分割する
  component body 全体を client で再実行しない
  client には必要な reactive edge と serialized capture だけを送る
```

この比較は、reactive graph extraction 案の位置づけを確認するために使う。
Dathra が最終的に選ぶ方式は、component boundary、template-level dynamic hints、reactive edge boundary を含む候補を、冒頭の評価基準に照らして決める。
