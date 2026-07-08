# Hydration opt-in policy draft

作成日: 2026-07-08

この文書は、Hydration の仕組みを見直す前の方針メモである。
まだ実装は開始しない。
目的は「何を hydrate するか」ではなく、「何を client に持っていくか」を設計の中心に置くこと。

## 基本方針

Dathra は SSR / DSD を first-class に扱う。
その上で、Hydration はデフォルト動作ではなく、明示された client boundary だけに限定する。

原則は次の通り。

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

### functional component

普通の関数コンポーネントは、server/render-time component として扱う。
custom element identity、ShadowRoot、lifecycle、hydrate boundary は持たない。

```tsx
function HighlightedCode({ code }) {
  const html = highlight(code);
  return <pre server:html={html} />;
}
```

このような component は server 側で展開され、client bundle に入らないことを目指す。
別途 `defineServerComponent` のような API は現時点では不要と考える。

### defineComponent

`defineComponent` は client-capable な Web Component boundary を作る API として扱う。
ただし、client-capable であることと、実際に hydrate することは分ける。

```tsx
<Counter />
```

この形は SSR / DSD を出すが、client では preserve-only とする。
counter logic は動かない。

```tsx
<Counter client:load />
```

この形で初めて client boundary になり、DSD への in-place hydration または client mount の対象になる。

## DSD と Hydration の関係

DSD は SSR HTML から Shadow DOM を構築する仕組みである。
Hydration は既存 DOM に client runtime を接続する仕組みである。

したがって、DSD があることは hydrate intent ではない。

```txt
DSD あり + client:* なし
  -> preserve DSD
  -> setup / hydrate は実行しない

DSD あり + client:* あり
  -> strategy に従って hydrate
  -> planFactory があれば hydrateWithPlan
  -> user hydrate があればそれを使う

DSD なし + client runtime context
  -> 通常 CSR mount
```

## client:* の再定義

現在の `client:*` は「自動 hydrate を遅らせる」意味に近い。
新方針では「client boundary を作り、その起動タイミングを指定する」意味に変える。

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
  -> client:* boundary だけを動かす
  -> event handler / signal / hydrate plan を含む
  -> server-only 処理を含めない

manifest
  -> boundary id
  -> strategy
  -> serialized captures
  -> client chunk reference
```

今の transformer は `mode: "ssr" | "csr"` で出力を切り替えている。
しかし、それは output mode の切り替えであり、`client:*` boundary だけを client artifact として抽出する仕組みではない。

この差分を新設計で埋める必要がある。

## capture model

`client:*` boundary から参照された値や処理は、client artifact に入る可能性がある。
ここを曖昧にすると、server-only 処理や重い依存が client に漏れる。

区別したいもの。

```txt
server-only
  -> client:* から処理として参照禁止

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

```tsx
<button client:load onClick={() => useResult(serverWork(input))} />
```

これは `serverWork` の処理そのものを client boundary へ持ち込む。
`serverWork` が server-only なら compile error にする。

## hydrate:preserve の位置づけ

`hydrate:preserve` は「client に送らない」指定ではない。
これは「hydrated boundary 内で、この subtree の DOM を触らない」指定である。

新方針では、全体が hydrate されない場合は `hydrate:preserve` は不要になる。
用途は、client boundary 内で一部だけ preserve したい場合に限定する。

## unsupported fallback

最小 hydrate 方針では、unsupported component は基本的に static preserve でよい。
ただし、`client:*` が明示されているのに hydrate / client artifact を生成できない場合は、静かに fallback するとバグになる。

方針案:

- `client:*` なしで unsupported
  - preserve-only
- `client:*` ありで unsupported
  - dev error
  - 必要なら明示 escape hatch を別途検討
- rerender fallback
  - 原則 escape hatch
  - デフォルト挙動にはしない

## nested boundary

static parent の内側に explicit child island があるケースは許可したい。

```tsx
<Outer>
  <Inner client:load />
</Outer>
```

この場合、`Outer` は static preserve でも、`Inner` は独立して client boundary として起動できるべきである。

そのため、runtime scheduler は static parent の ShadowRoot 内も scan できる必要がある。

## 実装前に決めること

まだ実装には入らない。
先に次を決める。

1. `client:*` を通常 DOM に許可するか
2. 通常 DOM の `client:*` は action-only か DOM island か
3. `client:load` の timing semantics
4. capture model の最小仕様
5. server-only / client-only / universal の判定方法
6. `defineComponent` の DSD preserve-only 時に constructor / connectedCallback で何を許すか
7. DSD style の扱い
8. `data-dh-store` snapshot を client boundary のみに出す方法
9. unsupported + `client:*` の diagnostic
10. 既存 `hydrateWithPlan` / `hydrateIslands` をどこまで再利用するか

## 現時点の結論

現時点では、次を新しい設計の中心に置く。

```txt
HTML は server-first。
client runtime に入るのは client:* boundary だけ。
Hydration は DSD の自動反応ではなく、client boundary の実行結果である。
```

