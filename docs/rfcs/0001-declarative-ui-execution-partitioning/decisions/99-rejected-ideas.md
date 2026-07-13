> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Rejected alternatives

## 破棄した案

この節は設計経緯であり、現行方針ではない。

### component 単位の自動 hydration

すべての `defineComponent` を client で再実行し、必要に応じて `client:*` で遅らせる方式は採用しない。
server-only work と client interaction が同じ component body にある場合、server-only dependency が client artifact へ漏れやすいためである。

この案は、ExecutionGraph と compiler 生成 client scope によって supersede された。

### `client:*` opt-in island

plain DOM、functional component、`defineComponent` に `client:*` を付けた箇所だけを client boundary にする案は採用しない。
開発者が placement の都合で component と DOM structure を分割する必要が生じ、event callback から自動導出できる client root も二重指定になるためである。

timing policy の必要性だけを `activate:*` として残した。

### reactive edge だけを hydrate unit とする案

DOM binding、event、signal、effect の edge を component より細かく抽出する方向は残した。
ただし、解析対象を runtime reactive graph だけに限定する案は採用しない。

module evaluation、ordinary value、async continuation、effect order、resource、ownership、transfer、authority も必要なため、上位概念を ExecutionGraph とした。

### 優先順位式 transfer

`inline`、`serialize`、`reconstruct`、`reference`、`remote` を順に試して最初の成功を使う方式は採用しない。
identity、consistency、exposure、lifetime を複数 step で満たす必要があり、単一の first-match では正しい plan を選べないためである。

MaterializationRequirement と EmissionRequirement を先に導出し、有限 plan DAG を比較する方式が supersede した。

### closure factory replay

server で生成した closure を、factory と input から client で作り直す一般則は採用しない。
factory evaluation 自体が observable event であり、lexical environment、private state、module identity、effect を一般には再現できないためである。

function code は build artifact として native semantics を保って出力し、capture は明示 plan で materialize する。

### unknown の暗黙 fallback

unknown code を eager hydration、full module、component rerender、RPC へ自動的に落とす案は採用しない。
unknown は、必要な proof obligation の dependency closure だけを保守的に阻止し、合法な native closure、contract、reference、diagnostic のいずれかへ進める。

### `hydrate:preserve`

static DOM は directive がなくても update plan から除外する。
server-only code を client artifact から除外する責務は compiler slicing にあるため、`hydrate:preserve` を execution partitioning API として継承しない。
