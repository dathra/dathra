# Reactive graph hydration policy draft

作成日: 2026-07-08

この文書は、Hydration の仕組みを見直す前の方針メモである。
まだ実装は開始しない。
目的は「何を hydrate するか」ではなく、「何を client に持っていくか」を設計の中心に置くこと。

2026-07-08 追記:

- `client:*` opt-in island を中心にする案は、初期仮説として残す
- 現時点の本命案は、component 単位の hydrate ではなく、compiler-inferred reactive graph hydration である
- まだ確定ではないため、この文書では「初期案」と「主軸案」を分けて記録する

## 基本方針

Dathra は SSR / DSD を first-class に扱う。
その上で、Hydration は component を丸ごと client で再実行する仕組みではなく、client に必要な reactive edge だけを既存 DOM に接続する仕組みとして再定義する。

現時点の主軸案は次の通り。

- hydrate unit は component ではなく、DOM binding / event / signal / effect の edge である
- compiler は source を server render graph と client reactive graph に分ける
- server render graph は SSR HTML / DSD を作るだけで、client bundle に入らない
- client reactive graph は event handler / signal / DOM binding だけを含む
- client graph が必要とする server 計算済みの値だけを serialized capture として渡す
- `defineComponent` は DOM ownership boundary / Web Component boundary であり、hydrate unit ではない
- functional component は graph-transparent な render function として扱い、hydrate boundary にはしない
- `client:*` は主に activation timing / override policy として扱う
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
ただし、Dathra ではより細かい reactive graph extraction を目指すため、この案をそのまま最終方針にはしない可能性が高い。

## Reactive graph extraction 方針

主軸案では、component を hydrate するのではなく、reactive graph のうち client に必要な edge だけを hydrate する。

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

この方針では、`client:*` がない component でも、compiler が client reactive graph を検出すれば必要最小限の client artifact を生成できる。
逆に、`client:*` があっても component 全体を client artifact に入れる必要はない。

`client:*` は次のような意味へ寄せる。

```txt
onClick / signal / effect などがある
  -> compiler が client graph を推論する

client:load / client:idle / client:visible / client:interaction / client:media
  -> 推論された client graph の activation policy を指定する

client graph が存在しない箇所の client:*
  -> 明示的な action island / imperative hook として扱うか、diagnostic にする
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

通常の HTML 要素は、デフォルトでは SSR HTML に展開されるだけである。

```tsx
<button onClick={copy}>Copy</button>
```

この `onClick` は自動では client に残らない。
静かに消すと危険なので、方針としては compile error または warning に寄せる。

client 側で動かしたい場合は、通常 DOM にも `client:*` を許可する方向を検討する。

```tsx
<button client:load onClick={() => copy(code)}>Copy</button>
```

この場合、`button` を root とする DOM island / action island を compiler が生成する。
ただし reactive graph extraction 方針では、`client:*` がなくても `onClick` を compiler が client edge として推論できる可能性がある。
その場合の `client:*` は、hydration boundary ではなく activation policy になる。

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

`defineComponent` は client-capable な Web Component boundary を作る API として扱う。
ただし、client-capable であること、DOM ownership boundary であること、実際の hydrate unit であることは分ける。

```tsx
<Counter />
```

初期 opt-in 案では、この形は SSR / DSD を出すが、client では preserve-only とする。
counter logic は動かない。

```tsx
<Counter client:load />
```

この形で初めて client boundary になり、DSD への in-place hydration または client mount の対象になる。

reactive graph extraction 方針では、`defineComponent` の役割は少し変わる。

```txt
defineComponent:
  custom element registration
  host element identity
  ShadowRoot / DSD ownership
  styles ownership
  lifecycle ownership

hydrate unit:
  compiler が抽出した client reactive graph
```

つまり、`defineComponent` は client-capable ではあるが、component 全体を hydrate する単位ではない。
Web Component の ShadowRoot 内にある必要最小限の binding / event / cleanup だけを接続する。

## DSD と Hydration の関係

DSD は SSR HTML から Shadow DOM を構築する仕組みである。
Hydration は既存 DOM に client runtime を接続する仕組みである。

したがって、DSD があることは hydrate intent ではない。

```txt
DSD あり + client reactive graph なし
  -> preserve DSD
  -> setup / hydrate は実行しない

DSD あり + client reactive graph あり
  -> activation policy に従って hydrate
  -> planFactory があれば hydrateWithPlan
  -> user hydrate があれば escape hatch として使う

DSD なし + client runtime context
  -> 通常 CSR mount
```

## client:* の再定義

現在の `client:*` は「自動 hydrate を遅らせる」意味に近い。
初期 opt-in 案では「client boundary を作り、その起動タイミングを指定する」意味に変える。
reactive graph extraction 方針では「推論された client graph の activation policy」を第一義にする。

候補:

- `client:load`
- `client:visible`
- `client:idle`
- `client:interaction`
- `client:media`

未決事項:

- `client:load` を `window.load` 後にするか、client entry 実行時にすぐ起動する意味に変えるか
- 通常 DOM の `client:*` を full DOM island とするか action-only island とするか
- `client:*` boundary 内で許す capture model をどう制限するか
- `client:*` がない event handler を default `load` 相当で有効化するか、diagnostic にするか
- `client:*` を boundary directive として残す escape hatch が必要か

## server code と client code の分離

最小 hydrate の本質は、hydrate 量ではなく client に送るコード量を最小にすることである。

そのためには、server artifact と client artifact を分ける必要がある。
ただし、source/API を分ける必要があるという意味ではない。

理想は、同じ source を解析して次を生成すること。

```txt
server artifact
  -> SSR HTML / DSD を生成する
  -> server-only 処理を実行できる
  -> client に送らない

client artifact
  -> client reactive graph だけを動かす
  -> event handler / signal / hydrate plan を含む
  -> server-only 処理を含めない

manifest
  -> boundary / graph id
  -> strategy
  -> serialized captures
  -> client chunk reference
```

reactive graph extraction 方針では、manifest の中心は boundary id ではなく binding graph になる。

```txt
manifest
  -> host owner
  -> DOM path / marker
  -> activation policy
  -> serialized captures
  -> client graph chunk reference
  -> preserved region information
```

今の transformer は `mode: "ssr" | "csr"` で出力を切り替えている。
しかし、それは output mode の切り替えであり、`client:*` boundary だけを client artifact として抽出する仕組みではない。

この差分を新設計で埋める必要がある。

## capture model

client reactive graph から参照された値や処理は、client artifact に入る可能性がある。
ここを曖昧にすると、server-only 処理や重い依存が client に漏れる。

区別したいもの。

```txt
server-only
  -> client graph から処理として参照禁止

client-only
  -> server render 中に実行禁止

universal
  -> server / client 両方で使用可

serialized value
  -> server で計算済みなら client に値として渡せる
```

重要な区別:

```tsx
const result = serverWork(input);
<button client:load onClick={() => useResult(result)} />
```

`result` が serializable なら許可できる。
この場合、client graph は `serverWork` の処理ではなく、server で計算済みの `result` だけを capture する。

```tsx
<button client:load onClick={() => useResult(serverWork(input))} />
```

これは `serverWork` の処理そのものを client graph へ持ち込む。
`serverWork` が server-only なら compile error にする。

## hydrate:preserve の位置づけ

`hydrate:preserve` は「client に送らない」指定ではない。
これは「hydrated graph が存在する owner 内で、この subtree の DOM を触らない」指定である。

新方針では、全体が hydrate されない場合は `hydrate:preserve` は不要になる。
用途は、client graph が存在する owner 内で一部だけ preserve したい場合に限定する。

## unsupported fallback

最小 hydrate 方針では、unsupported component は基本的に static preserve でよい。
ただし、client reactive graph が検出されているのに hydrate / client artifact を生成できない場合は、静かに fallback するとバグになる。

方針案:

- client reactive graph なしで unsupported
  - preserve-only
- client reactive graph ありで unsupported
  - dev error
  - 必要なら明示 escape hatch を別途検討
- `client:*` ありだが client reactive graph を生成できない
  - dev error
  - `client:*` を書いた author intent を無視しない
- rerender fallback
  - 原則 escape hatch
  - デフォルト挙動にはしない

## nested boundary

static parent の内側に explicit child island / child client graph があるケースは許可したい。

```tsx
<Outer>
  <Inner client:load />
</Outer>
```

この場合、`Outer` は static preserve でも、`Inner` は独立した client graph として起動できるべきである。

そのため、runtime scheduler は static parent の ShadowRoot 内も scan できる必要がある。

## 実装前に決めること

まだ実装には入らない。
先に次を決める。

1. hydrate unit を component boundary ではなく reactive edge として仕様化するか
2. compiler が client reactive graph と判定する最小条件
3. `client:*` がない event handler / signal binding を自動 client graph にするか
4. `client:*` を activation policy として再定義するか、boundary escape hatch としても残すか
5. `client:load` の timing semantics
6. capture model の最小仕様
7. server-only / client-only / universal の判定方法
8. functional component を graph-transparent に扱える範囲
9. opaque imported component の contract
10. `defineComponent` の DSD preserve-only 時に constructor / connectedCallback で何を許すか
11. DSD style の扱い
12. `data-dh-store` snapshot を client graph が必要な場合だけ出す方法
13. unsupported + client reactive graph の diagnostic
14. 既存 `hydrateWithPlan` / `hydrateIslands` をどこまで再利用するか

## 現時点の結論

現時点では、次を新しい設計の中心に置く。

```txt
HTML は server-first。
client runtime に入るのは compiler が抽出した client reactive graph だけ。
Hydration は DSD の自動反応でも component replay でもない。
Hydration は既存 DOM に reactive edge を接続する処理である。
```
