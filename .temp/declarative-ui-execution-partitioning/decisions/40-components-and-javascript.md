## component と JavaScript の扱い

### component body

component body は render-safe な宣言領域とする。
JSX、純粋または replay-safe な計算、classified read handle、compiler が理解する framework primitive を記述できる。

render safety は checked effect contract である。
ambient write、timer、resource construction、未分類の time、random、network、storage access は、classified handle または明示 root adapter を介さない限り body で拒否する。

未知 helper call は versioned effect summary を要求し、summary は cache と retry witness の dependency になる。
framework が検出できない effect は contract violation である。
検出した場合は publication 前に generation を失敗させ、cache と retry の保証を無効化する。

実行回数に意味がある database write などは、request handler、action、transaction、明示 remote protocol に置く。
汎用的な `serverEffect` は導入しない。

response status、header、head、preload、metadata は、用途別の declarative contribution として扱う。
これらは deterministic な merge と conflict rule を持つ。

### plain DOM

plain DOM は server または client boundary を作らない。
static DOM は server artifact に materialize し、client update plan から除外する。

plain DOM の client lifetime は、compiler 生成 marker range と coordinator で表現する。
client root があれば、`defineComponent` がなくても client scope を作れる。

### functional component

compiler が source または semantic expansion summary を持つ functional component は graph-transparent とする。
component call 自体を hydrate unit にしない。

first-class escape、dynamic dispatch、opaque import は invocation node として残す。
points-to summary、target-native module closure、明示 contract のいずれも構成できなければ diagnostic とする。

### defineComponent

`defineComponent` は、次の責務を持つ。

- custom-element identity
- ShadowRoot と DSD の ownership
- static style artifact
- custom-element registration
- lifetime region の候補
- platform lifecycle record

`defineComponent` は、server と client の境界、hydrate unit、activation group、chunk boundary ではない。
一つの host は、複数の shared state と activation group を所有できる。

### function と module extraction

function object と ECMAScript Environment Record は serialize しない。
runtime に parser、scope engine、eval engine を追加しない。

build 時の code extraction と request 時の capture materialization を分ける。
runtime へ送るのは、認証済み native artifact、有限な CaptureLayout、承認済み value、compiler-owned cell ID、reference である。

client-reachable callable は、次の有限候補で扱う。

- native syntax で生成する allocation unit
- target-native module closure の binding
- closed capture を持つ compiler 生成 adapter
- 仕様上の bind operation を保持できる known bound function plan
- contract を持つ intrinsic または host callable reference
- diagnostic

Script、CommonJS、Module の parse goal を勝手に変えない。
Script または CommonJS を Module として出力するのは、global environment、top-level `this`、declaration、host hook、source URL、early error、loader semantics の同値性を証明できる場合に限る。

**NativeModuleClosure** は、一つの target module map に属する Module Record と ModuleRequest の必要な transitive closure である。
live binding、namespace identity、cycle、top-level await、`import.meta`、evaluation failure cache を保持する。

source-phase import を含む closure は Module Source Object の availability、identity、creation failure と、同じ semantic request の source/evaluation phase が同じ RuntimeModuleBinding を参照する証拠を保持する。
source phase は target Module Record を load しても transitive request を evaluation traversal せず、evaluation phase へ昇格した場合だけその request inventory を traversal する。

dynamic import は、事前認証された有限候補、または同じ graph epoch で link 前に認証する extension に限定する。
host が module bytes と manifest の対応を保証できない場合は、native reuse を許可しない。

external definition contract は definition semantics、transitive dependency ownership、module bytes と manifest の対応、Module Source Object の host-level availability/creation semantics を runtime ID に依存せず束縛する。
external runtime closure evidence は concrete domain の module-map/cache identity、Module Record と namespace identity、evaluation と failure cache、top-level await、`import.meta`、Module Source Object の concrete identity/failure、source/evaluation phase coherence を runtime binding と loader-entry set に束縛する。
source-only external target を含め、この二段階 contract/evidence を証明できない external module は NativeModuleClosure に採用せず diagnostic とする。

source evaluation event は別 realm で replay しない。
object、array、RegExp、template、computed key、spread、class heritage、field、static block、default initializer、bind も observable evaluation event に含む。

client で同じ code を評価する場合は、source event を replay するのではなく、client に配置された別の合法な event として扱う。
server result の client recomputation は、ObservationContract に対する同値性を証明できる場合だけ選ぶ。

direct eval、indirect eval、Function constructor、`with` は別々に分類する。
direct eval は ECMAScript の Reference 条件と current Realm の `%eval%` identity を満たす場合だけ direct と判定する。
その環境を保持できない場合は、native ownership または diagnostic とする。

### capture と mutable state

capture の安全性は binding だけでなく、値から到達する alias graph 全体で判定する。
`const` binding は deep immutable の証明にならない。

mutable capture は、次のいずれかを選ぶ。

- immutable snapshot
- source 側の将来観測がない exclusive handoff
- target-native ownership
- compiler-owned stable cell
- author-visible な explicit remote shared state
- unsupported diagnostic

silent な mutable copy と fork は許可しない。

reflection obligation は観測項目ごとに判定する。
`Function.prototype.toString()`、identity、`caller`、`arguments`、descriptor、prototype、extensibility を一つの「native emission」でまとめて証明したことにしない。

Proxy、host object、private brand、internal slot、SharedArrayBuffer、WeakMap などを一般 object として introspect しない。
target-native ownership、型別 contract、reference、DTO のいずれも構成できなければ diagnostic とする。
