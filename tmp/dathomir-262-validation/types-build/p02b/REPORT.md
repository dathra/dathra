# #262/#264 P02b：source rewrite を使わない module 境界の実証

2026-10-05 06:17 JST。
27-case P02 を保存したまま、別 runner と fixture を追加した。
API 採用、①完了、production 完成、PR263 の変更を意味しない。

## 結論

**manual explicit inventory と preserve-module server output の fallback は実行できた。**
server の `import.meta.url` を変換せず、移設後の emitted declaration URL から lookup key を作り、opaque public asset ID へ結べた。
実 Chromium で owner と behavior が同じ Signal/computed の関数 identity を使い、cross-entry computed が 2 から 4 へ更新することも確認した。

したがって、#253 の既定境界を保持する案として、この構成を推奨する。
source 型と runtime path の semantic equality は、manual inventory だけでは証明できない。
その限界と追加記述を作者と deployment owner に明示する。
source-selection/rewrite adapter の自動化を既に採用済みの条件に戻さない。

## 1. 問いと期待値

| 問い | pass 条件 | 結果 |
|---|---|---|
| metadata source rewrite は必要か | preserved server file の import.meta.url をそのまま使い、移設後に SSR lookup 成功 | pass |
| source/function selection が必要か | explicit file list と manual inventory だけ。collector import、framework call AST inspection は無し | pass |
| server module を browser で実行しないか | type-only client import 消去。SSR 実行で browser top-level error が起きない | pass |
| common engine が browser で一致するか | owner.signal===behavior.signal、computed も同じ、derived 2→4 | Chromium で pass |
| non-root public base は使えるか | 全 emitted asset が HTTP200、HTML に file URI 無し、relative shared chunk が browser でロード可能 | pass |
| pure private dependency は bundler だけで防げるか | raw build は漏洩し、明示 guard が拒否する反例 | expected negative 成立 |
| wrong path を generic/manual names だけで検出できるか | 同じ型 shape の別 module が受理され、挙動が異なる反例 | limitation を実証 |
| static と dynamic zero を区別できるか | static の entry set 0。dynamic に file があっても response refs/bootstrap/payload 0 | pass |

八つの case が期待どおり完了した。
数は coverage であり、production 合格の数ではない。

## 2. 実際の構成

```text
source/counter.server.ts
  import type Client from counter.client.js
  clientModule<typeof Client>("./counter.client.js", import.meta.url)
  server -> ordinary actual signal + plain title/visible
  template(values,{bind,on}) -> actual SSR description

ordinary TS transpilation (explicit five server files)
  out/relocated/server/counter.server.js
  out/relocated/server/route.js
  out/relocated/server/wrong.server.js
  out/relocated/server/static.route.js
  out/relocated/server/private-data.js

manual catalog keyed by emitted declaration URL
  file:/.../relocated/server/counter.client.js (virtual key)
    -> opaque counter-v1
    -> /p02b/nonroot/assets/counter.mjs

ordinary esbuild multi-entry ESM splitting
  owner.browser.ts -> owner.mjs
  counter.client.ts -> counter.mjs
  other.client.ts -> other.mjs
  actual reactivity + client facade -> shared chunks
```

client key に相当する file を server directory に置いていない。
その URL は metadata lookup key であり、server で browser module を import する指示ではない。
この区別は `fs.existsSync(key)===false` と成功した SSR lookup の組で確認した。

公開 author form は変えていない。
`server/template`、unified record、ordinary signal、別 browser module、flat `export default defineClient({countText,increment})`、二引数 clientModule、bind server marker、typed all-name helpers を保持した。
new query import、kind option、getter/operation container は追加していない。

### server/client/route の full source

- [counter.server.ts](source/counter.server.ts)：一度の association、actual Signal と plain 値、SSR marker。
- [counter.client.ts](source/counter.client.ts)：flat default registry、type-only Values、browser-only sentinel。
- [route.ts](source/route.ts)：通常 request render と dynamic-zero/wrong-path branch。
- [owner.browser.ts](source/owner.browser.ts)：ABI probe 用の ordinary runtime imports。
- [wrong.server.ts](source/wrong.server.ts) と [other.client.ts](source/other.client.ts)：type/runtime semantic mismatch の intentional counterexample。

`derived` と signal/computed の named export は probe instrumentation である。
新しい framework public helper の提案ではない。
server の初期 template を browser で実行も import もしていない。

## 3. manual inventory の実体と負担

runner が所有する explicit record は次である。
source の関数本体や call の AST を探してこの record を作っていない。

```js
const inventory = [
  { declaration:"counter.server.js", specifier:"./counter.client.js",
    id:"counter-v1", source:"counter.client.ts", asset:"counter",
    names:["countText","increment"] },
  { declaration:"wrong.server.js", specifier:"./other.client.js",
    id:"other-v1", source:"other.client.ts", asset:"other",
    names:["countText","increment"] },
];
function catalogAt(outputRootURL) {
  return Object.fromEntries(inventory.map(entry => {
    const declaring = new URL("server/" + entry.declaration, outputRootURL);
    const key = new URL(entry.specifier, declaring).href;
    return [key, {
      id:entry.id,
      publicURL:"/p02b/nonroot/assets/" + entry.asset + ".mjs",
      names:entry.names,
    }];
  }));
}
```

server renderer の呼出し側は deployed output root URL を渡す。
元 source URL を manifest に固定する必要はない。
record の declaration path と specifier は emitted module の配置に合う必要がある。
browser entry と function names を記述する重複も残る。

具体的な deployment obligation は次の五つである。

1. server application の module 境界を保ち、declaring file の相対配置を維持する。
2. manual inventory の emitted declaration path と client specifier を実際の output と合わせる。
3. public asset name と non-root base を HTTP mount と合わせる。
4. loader/owner と全 client entry を同じ browser graph で bundle し、同じ engine import identity を維持する。
5. route ごとの explicit entry set を漏れなく宣言し、response-specific な marker/capability omission と混同しない。

この追加記述は component の per-occurrence selector ではなく、deployment の explicit entry/inventory である。
作者の component 内 association は一度のままである。
重複を隠して「一切重複しない」とは説明しない。

## 4. relocation の actual lookup

ordinary `ts.transpileModule` で五つの明示 server file を各 `.js` に出した。
正常な TypeScript emit 以外の source transform はない。
`import.meta.url` はそのまま残した。
型引数と type-only import の消去は通常 TypeScript の責務である。

生成 server package resolver は、この実験だけの `@dathra/core/server` facade と実 reactivity bundle を解決する。
これらの generated package.json は実験 output 内だけに作る。
root や production の package manifest/lockfile は変更しない。

original output を relocated へコピーし、original を退避した。
source directory も一時的に unavailable にし、その状態で relocated driver を新規 import した。
manual catalog は relocated output root から構成した。
SSR は `Count: 3` を生成した。
source が無くても、declaring module の emitted import.meta.url は新しい場所を指し、catalog の key と一致した。

古い output root から作った catalog を渡す negative は `E_MODULE_LOOKUP` で拒否した。
誤った names inventory は `E_FUNCTION_NAME: increment` で拒否した。
layout と names の手動維持が必要であることを具体的に示している。

## 5. browser の実 engine identity

esbuild 0.25.10 の ordinary multi-entry、ESM、splitting:true、treeShaking:false を使った。
source-selection plugin、metadata rewrite plugin は使っていない。
owner entry と client behavior は actual repository reactivity source を同じ build に入れる。
shared chunk は普通の bundler output である。

HTTP server は `/p02b/nonroot/` を公開した。
Chromium 141.0.7390.37、Playwright 1.56.1 で page を実際に開いた。
共有 chunk の relative imports が同じ HTTP module URL に達することを request log と関数 identity で確認した。

```js
const owner = await import("/p02b/nonroot/assets/owner.mjs");
const behavior = await import("/p02b/nonroot/assets/counter.mjs");
owner.signal === behavior.signal;       // true
owner.computed === behavior.computed;   // true
const count = owner.signal(1);
const derived = behavior.derived(count);
derived.value;                          // 2
count.set(2);
derived.value;                          // 4
```

これは実 Chromium の module/engine 証拠である。
owner.signal(1) は ABI probe で明示した新 Signal であり、SSR payload restoration を実装した initializer ではない。
DOM admission、SSR node identity、event listener、owned facade、input、disposal を証明していない。
page error はゼロだった。

前の P02 negative の separate bundles による stale computed を失敗 baseline として残している。
P02b はその一部を shared build と実 browser で解決した証拠であり、前の adapter の結果を上書きしていない。
同じ engine source path や同じ byte だけで十分とは言わない。
version/URL が異なる late delivery を含めた app integration は今後の gate に残る。
独立 SERVER snapshot producer の engine copy を禁止する理由にはしない。

## 6. private graph と zero の境界

`private-data.ts` の browser-compatible constant を browser entry が import すると raw esbuild は成功し、秘密 constant が出力へ入った。
この反例の出力を保存した。
明示的に登録した resource paths を metafile input と照合する guard が拒否した。
`.server.ts` suffix から arbitrary private code を分類していない。
未知 module の私的意味や、公開 return record へ作者が直接入れた秘密を自動検出する仕組みではない。

dynamic route は browser file を二つ持つが、no-marker response は modules、bootstrap、payload を送らない。
Signal を含む server record を作っても、marker が無い場合は activation payload にしなかった。
HTTP zero page に script は無かった。

static-only route は manual entry set 自体が空であり、対応 browser output directory の files はゼロだった。
static entry set は作者/deployment が明示する。
実 template から capability を推測して静的分類する source analyzer はない。
誤って空 inventory に client marker の response を渡せば lookup error になり、黙って static に fallback しない。

dynamic-zero response に送信しないことと、potential asset が build output に存在しないことを区別する。
HTTP body は opaque module ID と public path を持ち、private file URL を持たなかった。
これは一つの HTTP mount の証拠であり、production transport/codec/security protocol 完成ではない。

## 7. source 型と runtime module の semantic mismatch

`wrong.server.ts` は `typeof CounterClient` を型に使い、runtime path を `other.client.js` にする。
双方の flat default は同じ function names と同じ context 型を持つ。
ordinary strict TypeScript はこれを受理した。
manual inventory も other module を valid default/name の組として受理した。

SSR は `Count: 3` であり、Chromium の other getter は同じ count2 に対して `OTHER: 2` を返した。
名前と型の形が一致しても、作者が意図した module と同じとは証明できない。

この fallback では type/runtime path の source identity analysis を行わないため、この wrong-path semantic mismatch は検出不能として公開する。
profile/default の runtime validation を加えても、同じ正当な shape の違う意味を自動判定することはできない。
強い代案は、前の未採用 source-symbol inventory/rewrite または新しい explicit provenance 契約である。
それを採る場合は #253 の scope を別途 review する必要があり、この fallback に黙って持ち込まない。

今回の推奨は、ordinary tools/manual entries のままで保証を正直に限定し、この負担が実作者に耐えられるかを #262 で review することである。

## 8. 再現と provenance

repository root から実行する。

```sh
node tmp/dathomir-262-validation/types-build/p02b/run-p02b.mjs
```

- Node 24.15.0。
- TypeScript 6.0.3（actual repository Signal types、strict typecheck）。
- esbuild 0.25.10。
- installed Playwright 1.56.1、Chromium 141.0.7390.37。
- browser binary/dependencies は既存環境を使用し、install/update は行わなかった。

`run-first.log` に最初の actual run、`logs/result.json` に八 case と browser version、`logs/browser.metafile.json` に shared output graph を保存した。
この runner は Node assertion を使う executable experiment であり、production regression suite ではない。
Chromium を起動できない環境では明確な blocker を記録し、browser evidence を pass としない。
今回の browserEvidence.ran は true だった。

canonical Taskは [#264](https://github.com/dathra/dathra/issues/264) を参照する。
#264 は成果物保存の Task、#262 は未採用設計の正本のままである。
archive branch、Draft PR、Issue の更新は coordinator が所有し、この assignment では行わない。

親 directory の P01/P02/REPORT は変更していない。
特に旧 `p02-result.json` の byte が同じであることを runner で assert した。
root の既存 dirty files、package manifest/lockfile、Accepted ADR、production、PR263 は変更していない。

## 9. まだ採用しないもの

- manual catalog/public ID/names/version と route entry set の production schema。
- all adapters/platforms の preserve-module output layout。
- module byte integrity、cache、CSP、cross-origin、deployment rollback。
- per-occurrence immutable association と server authority の admission/terminality。
- state restoration、owned facade、DOM/input、disposal、late work。
- hidden dynamic imports または arbitrary server-only code の classification。

実証された module fallback を次の design review の材料にする。
これらの要求を useful feature の unsupported 宣言に変えない。

archiveでは生成outを除き、sourceとrunnerと観測を保存する。
Vitest wrapperからこのrunnerも実行するため、再実行には親のREADMEを参照する。
