> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Compiler execution model

## compiler execution model

### ModuleCoordinator

現行の file 単位 `mode: "ssr" | "csr"` transform は、最終設計の compilation unit にしない。
新しい compiler は build 全体を扱う **ModuleCoordinator** を持つ。

ModuleCoordinator は、canonical resolver、conditional exports、関連 plugin transform、有限 dynamic import を解決した後に graph-completeness barrier を置く。
全 entry を content-addressed fixed point まで解析し、barrier の後でだけ final artifact を出力する。

server build と client build は、同じ graph snapshot と hash を参照する。
watch build は reverse dependency を一つの compilation transaction として invalidate する。

### immutable module graph snapshot

ModuleCoordinator が公開する graph snapshot は、一つの resolver 出力だけを表す file list ではない。
server、browser、worker など複数の resolution domain と、その domain が所有する module-map、loader cache、request、entry の exact closure を一つの immutable `ModuleGraphSnapshot` に束縛する。

snapshot の identity は、次の非循環 DAG で生成する。

```txt
ModuleSemanticProfile
  -> ModuleRequestInventory
  -> ModuleDefinition

ExternalModuleDefinitionContract
  -> external ModuleDefinition

ModuleResolutionDomain
  + ModuleDefinition
  -> RuntimeModuleBinding
  -> ModuleLoaderEntry
  -> ExternalRuntimeClosureEvidence
  -> semantic ModuleRequest
  -> ModuleResolutionEvidence
  -> ResolvedModuleRequest
  -> ModuleRequestSiteEvidence
  -> ModuleRequestSite / ModuleGraphEntry
  -> ModuleGraphSnapshot
```

import edge は `RuntimeModuleBinding` またはそれ以前の identity に入れない。
このため、module import cycle が存在しても definition、runtime binding、loader entry の ID は有限回で確定する。

各 record は versioned canonical preimage と SHA-256 ID を持つ closed immutable value とする。
canonical array は record ID 順、集合 field は canonical lexical order、source order が意味を持つ field は明示 ordinal 順に表す。
record ID と preimage の不一致、noncanonical order、duplicate ID、extra field、dangling reference は snapshot 作成時と strict validation 時の両方で拒否する。

#### semantic profile と request inventory

`ModuleSemanticProfile` は、content bytes 以外で definition semantics に影響する次の情報を束縛する。

```txt
definition kind と parse goal
transform pipeline の version、plugin order、configuration digest
semantic transform metadata digest
loader と host-hook semantics digest
import.meta semantics digest
```

host の module-map type は definition kind と同じ概念ではない。
たとえば HTML の `javascript-or-wasm` module-map type は JavaScript と WebAssembly の definition kind を直接区別しない。
したがって module-map type は `ModuleSemanticProfile` に入れず、後述する `ModuleLoaderEntry` が保持する。

`ModuleRequestInventory` は transformed content digest、semantic profile ID、versioned extractor profile digest と、source order の request-site descriptor を束縛する。
各 site descriptor は request kind、native request の `source | evaluation` phase、target を含まない normalized syntax digest を持つ。
resolved target、loader entry、candidate request ID は inventory に入れないため、inventory と import edge の間に identity cycle は生じない。

content `ModuleDefinition` は canonical source URL、exact source bytes digest、exact transformed bytes digest、semantic profile ID、request inventory ID を持つ。
definition と inventory の transformed content digest と semantic profile ID は完全一致しなければならない。

`ExternalModuleDefinitionContract` は domain と runtime binding に依存しない definition-level contract である。
versioned preimage は external definition kind、definition semantics digest、Module Source Object の availability/creation semantics digest、transitive dependency ownership digest、module bytes と manifest の correspondence digest を持つ。
built-in など host-owned bytes を使う場合も correspondence field を省略せず、host ownership を表す canonical contract digest を使う。

external `ModuleDefinition` は canonical source URL と external definition contract ID を持つ。
external definition の transitive dependency は Dathra graph に暗黙展開せず、definition contract が ownership boundary を宣言する。
一つの external definition contract は一つ以上の external definition から参照できるが、snapshot 内でどの definition からも参照されない contract record は拒否する。

#### resolution domain、runtime binding、loader entry

`ModuleResolutionDomain` は少なくとも次を束縛する。

```txt
target environment identity
native module-map と Realm の namespace digest
CommonJS loader-cache namespace digest
resolver algorithm、plugin order、configuration digest
package map、import map、redirect、filesystem、realpath、case rule を含む resolver input transcript digest
module-map と loader-cache semantics digest
ESM と CommonJS それぞれの active condition set
resolver hook から観測できる ESM と CommonJS それぞれの condition sequence
```

condition set は membership の canonical identity として sort する。
condition sequence は hook から観測できる順序を保持し、package exports/imports object の source key order と resolver traversal order は resolver input transcript に束縛する。

`RuntimeModuleBinding` は resolution domain ID、module definition ID、response URL に由来する canonical module base URL、runtime module identity digest を持つ。
runtime module identity は compiler の content-addressed definition ID とは別であり、Module Record、namespace、module source object、evaluation result、evaluation failure cache を共有する単位を表す。
一つの resolution domain 内で同じ runtime module identity digest を持つ binding は一つだけとし、definition または base URL が競合する別 binding を許可しない。

`ModuleLoaderEntry` は resolution domain ID、`native | commonjs` loader namespace kind、request/module-map URL、host module-map type、effective cache-key import attributes、host cache-key digest、runtime binding ID を持つ。
module-map URL は fetch または resolver の request URL、module base URL は response URL または host が確定した resolution base であり、redirect をまたぐ場合も同一 field に潰さない。
WHATWG URL parse/serialize は URL syntax を canonicalize するだけであり、`file:` URL の realpath、symlink、case normalization は resolver contract と transcript が所有する。

module-map key の uniqueness は URL 単体ではなく、resolution domain、loader namespace、request URL、module-map type、effective key attributes の tuple で判定する。
host cache-key digest も同じ namespace 内で一つの loader entry だけを指す。
複数の loader entry が同じ runtime binding を指すことは許可し、redirect alias や native/CommonJS cache 間で identity を共有する host semantics を表せるようにする。

external definition を持つ runtime binding には、一つの `ExternalRuntimeClosureEvidence` を要求する。
この evidence の canonical preimage は external definition contract ID、runtime binding ID、その binding を指す canonical loader-entry ID set、runtime semantics digest、phase-coherence evidence digest を持つ。
runtime semantics digest は concrete domain における module-map/cache、Module Record、namespace、evaluation/failure cache、top-level await、`import.meta` を束縛する。
phase-coherence evidence は Module Source Object の concrete availability、identity、creation failure と、source/evaluation phase が同じ runtime binding を返すことを束縛する。

external definition contract は runtime ID を含まないため `ModuleDefinition` より前に確定し、external runtime closure evidence は runtime binding と loader entry だけを参照するため import edge より前に確定する。
この分離により external contract を definition ID へ入れても identity cycle は生じない。
content runtime binding に external runtime closure evidence を付けること、および external runtime binding の evidence を欠落または重複させることを拒否する。

#### semantic request、resolution evidence、request site

ECMAScript の semantic ModuleRequest と、source syntax 上の request site を分離する。

native `ModuleRequest` identity は、resolution domain、importer runtime binding、`source | evaluation` import phase、specifier、source import attributes から作る。
static import、dynamic import、別 source site という情報と resolved target は semantic request ID に入れない。
import attribute は key と string value の exact pair とし、key order は identity に影響しない canonical order にする。

同じ domain、importer、specifier、source attributes、phase を持つ native request は一つの target だけへ解決する。
phase だけが異なる同一 native request は同じ `RuntimeModuleBinding` へ解決し、source phase と evaluation phase の違いを理由に Module Record、module source object、namespace、evaluation/failure cache identity を fork しない。

CommonJS request は ECMAScript ModuleRequest として扱わない。
CommonJS request identity は resolution domain、importer runtime binding、`createRequire()` を含む canonical resolution origin URL、specifier から作る。
target、cache key、hook evidence を request identity に入れず、同じ semantic CommonJS request を別 target へ解決する逃げ道にしない。
mutable `require.cache`、`require.extensions`、loader hook state を有限 transcript と contract へ固定できない場合は、external ownership または compiler diagnostic とする。

各 semantic request は一つの `ModuleResolutionEvidence` と一つの `ResolvedModuleRequest` に対応する。
resolution evidence は request ID、target loader-entry ID、実際に resolver が観測した condition sequence、native request の effective cache-key attributes、redirect evidence digest、resolver trace digest を束縛する。
resolution evidence の condition sequence は対応する resolution domain の ESM または CommonJS hook-visible sequence と重複・順序を含め完全一致させる。
request ごとに resolver-observable sequence が異なる target は同じ domain に混在させず、別 resolution domain として表す。
request の source attributes、resolution evidence の effective attributes、target loader entry、request URL、response/base URL の対応を domain-level opaque digest だけに委ねない。

`ResolvedModuleRequest` の canonical preimage は request kind、semantic request ID、target loader-entry ID、resolution evidence ID を持つ。
semantic request ID は target と proof metadata に依存せず、resolved request ID は target と evidence の exact association を表す。
一つの semantic request ID に対応する resolved request は一つだけとし、resolution evidence の request/target と resolved request の request/target は完全一致させる。
この record は semantic request と loader entry より後、request site より前に生成するため、import cycle を runtime binding identity へ戻さない。

`ModuleRequestSiteEvidence` は inventory ID と ordinal、inventory descriptor の normalized syntax digest、importer runtime binding ID、canonical semantic request ID set、candidate coverage proof digest を持つ。
semantic request ID set は target と resolution evidence を含まず、native request では specifier、source import attributes、phase、CommonJS request では specifier と resolution origin URL を identity 経由で束縛する。
candidate coverage proof は、inventory の当該 syntax site からその semantic request key set が導出でき、ほかの有限候補がないことを EG02 の extractor/analysis profile で証明する。
static site では literal specifier と source attributes の singleton equality、dynamic native と CommonJS site では finite candidate domain の soundness と completeness を証明する。
inventory ID、ordinal、normalized syntax digest、importer、semantic request set のいずれかを別 site と交換した evidence は拒否する。

`ModuleRequestSite` は importer runtime binding、inventory ordinal、request kind、native import phase、site evidence ID、有限な resolved request ID set を持つ。
static native、Wasm、CSS request site は一つの request を持ち、dynamic native と CommonJS request site は一つ以上の事前認証された有限候補を持てる。
同じ resolved request は複数 site から参照できる。
site が参照する各 resolved request は semantic request まで辿り、resolution domain と importer runtime binding が site と完全一致しなければならない。
native site は native semantic request だけを参照し、その import phase も site と一致させる。
CommonJS site は CommonJS semantic request だけを参照し、native request ID を候補へ混在させない。
static/dynamic という source-site kind は semantic ModuleRequest identity に入れないが、inventory descriptor と site の kind、および kind が許可する request variant/cardinality は一致させる。
site evidence の inventory、ordinal、syntax digest、importer は site と definition inventory に一致させ、site が参照する resolved request から得た semantic request ID set は site evidence の set と完全一致させる。

#### entry、phase-aware closure、snapshot

`ModuleGraphEntry` は resolution domain、dense entry ordinal、entry kind、entry loader context digest、content loader-entry ID を束縛する。
entry loader context は top-level fetch options、credentials、referrer policy、worker/script kind、`import.meta.main` など entry admission に影響する host semantics を含む。

module graph reachability は次の二段階 lattice で判定する。

```txt
source < evaluation
```

- entry は target runtime binding を `evaluation` reachable にする
- evaluation-phase native request は target を `evaluation` reachable にする
- CommonJS request は target を `evaluation` reachable にする
- source-phase native request は target を `source` reachable にするが、その target の request site を再帰 traversal しない
- source reachable binding が別 path から evaluation reachable へ昇格した場合は、その時点で request site を traversal する

evaluation reachable な content runtime binding には、definition の request inventory と ordinal、kind、phase が完全一致する request site が必要である。
source-only reachable な content runtime binding は definition と inventory を保持するが、その binding の request site と outgoing resolved request を snapshot に持たない。
external runtime binding は source/evaluation のどちらでも leaf とし、request site を持たない。

snapshot validation は domain ごとに entry から phase-aware fixed point を計算し、次を拒否する。

- reachable でない runtime binding、loader entry、definition、profile、inventory、external definition contract、domain
- site から参照されない resolved request、および resolved request と一対一対応しない semantic request と resolution evidence
- site と一対一対応しない request-site evidence、または inventory syntax と semantic request key set の coverage proof mismatch
- entry または resolved request から参照されない loader entry
- cross-domain importer または target
- external definition を持つ entry または importer
- external runtime closure evidence の欠落、重複、content binding への誤付与、definition contract/runtime binding/loader-entry set の不一致
- inventory の trailing site を含む欠落、duplicate ordinal、kind/phase mismatch
- request site と semantic request の domain、importer、native/CommonJS variant、native phase mismatch
- native request の cross-phase runtime binding mismatch
- module-map/cache key conflict

import cycle は runtime binding ID に edge を含めないため合法であり、evaluation reachable subgraph の phase-aware fixed point で処理する。
entry order は dense ordinal に保持し、snapshot 内の entry record array 自体は record ID 順に canonicalize する。

`ModuleGraphSnapshot` は semantic profile、resolution domain、request inventory、external definition contract、module definition、runtime binding、loader entry、external runtime closure evidence、semantic request、resolution evidence、resolved request、request-site evidence、request site、entry の exact-use closure 全体を hash する。
snapshot 作成後に record または candidate を追加しない。
同じ graph epoch で認証した dynamic extension も、link 前に新しい immutable snapshot と snapshot ID を確定してから使う。

### ModuleCoordinator transaction

ModuleCoordinator は bundler hook を直接呼ぶ stateless helper ではなく、最後に commit された immutable snapshot、stage cache、observation reverse index、entry-to-runtime mapping、target-to-importer reverse graph を所有する single-writer coordinator である。
build request は呼び出し順に queue し、同時に二つの transaction が committed state を変更しない。

build input は unique stable domain key、domain configuration digest、target environment、native module-map/Realm namespace、CommonJS loader-cache namespace と、ordered entry request を持つ。
entry request は stable domain key、domain 内で0から始まる dense ordinal、entry kind、entry context digest、native または CommonJS resolution request を持つ。
entry context digest は credentials、referrer policy、worker/script kind、`import.meta.main`、top-level fetch options など admission と loader behavior に影響する host context を束縛する。

stable domain key は build input 内で unique とし、一つの attempt で別の stable key から同じ final `ModuleResolutionDomainId` が生成された場合は coalesce せず diagnostic とする。
これにより entry ordinal は stable key と final domain の間で一対一に対応する。

#### adapter profile と attempt-specific domain

各 adapter transaction は、最初に observed pipeline profile を返す。
pipeline profile は aggregate adapter profile、resolver、load、transform pipeline、loader semantics、`import.meta` semantics、extractor の version/configuration digest と、それらを導出した dependency observation を持つ。

domain は完成済み `ModuleResolutionDomain` として build input から固定しない。
transaction の `describeDomain` stage が stable domain configuration から resolver input transcript、module-map semantics、attempt-specific condition profile を導出し、coordinator がその attempt の `ModuleResolutionDomain` を生成する。
retry 時に package map、import map、filesystem rule、resolver config が変わった場合は observation と transcript が変わり、新しい domain ID を生成する。
entry は stable domain key から attempt-specific domain ID へ rebinding する。

resolver profile と module-map semantics は `ModuleResolutionDomain`、load/transform/loader/`import.meta` profile は `ModuleSemanticProfile`、extractor profile は `ModuleRequestInventory` に完全一致させる。
adapter の stage semantics が変わったのに final graph identity が変わらない output は adapter contract 違反とする。
external definition attestation と runtime attestation も現在の adapter profile の下で導出し、profile が semantic difference を生む場合は contract/evidence digest を変更する。

#### adapter transaction

adapter transaction は少なくとも次の operation を持つ。

```txt
describePipeline
describeDomain
resolve
load
transform
extract
replayCachedStage
tryCommit
rollback
```

各 operation は versioned closed canonical input record を受け取る。
adapter が観測し得る field、profile、entry/loader context lineage、response metadata は省略せず operation input に含める。
result metadata も closed record とし、source/transformed bytes は coordinator が callback return 直後に copy する。
後続 operation へ渡す byte sequence は deeply immutable とし、adapter による変更で事前計算済み stage key と実際の operation input を乖離させない。

全 stage result は positive lookup と negative lookup の両方を含む canonical dependency observation set を返す。
observation は non-empty key と exact digest を持つ。
同じ key に別 digest が現れた attempt は unstable input として失敗する。
resolver が directory search や fallback candidate の不存在を利用した場合も、その absence を observation に含める。

resolve は domain、request/module-map URL、module-map type、effective cache-key attributes、host cache key と structured resolver evidence を返す。
resolve 時点では runtime identity と response/base URL を確定したことにしない。

load は resolved loader target を受け、response/base URL、runtime module identity digest と、content bytes または external raw attestation を返す。
coordinator は resolve result から一時 loader unit を作り、load 後にだけ `(domainId, runtimeModuleIdentityDigest)` で runtime unit を merge する。
同じ runtime identity に merge された loader alias の module definition、base URL、runtime semantics が競合する場合は diagnostic とする。

transform は exact source digest と load metadata を受け、exact transformed bytes と semantic profile fields を返す。
extract は exact transformed digest と semantic profile ID を受け、source order の inventory descriptor、各 site の normalized syntax digest、finite candidate set、coverage proof digest を返す。
static site は一候補、dynamic native と CommonJS site は一つ以上の有限候補を必要とし、duplicate semantic candidate は拒否する。

external adapter result は domain-independent definition attestation と、domain/runtime-specific raw attestation を分ける。
adapter は `ExternalRuntimeClosureEvidence` を直接完成させない。
coordinator が fixed point と alias merge を完了した後、runtime binding を指すすべての canonical loader-entry ID と raw attestation を使って evidence record を生成する。
definition contract に domain-specific resolver/runtime profile を混ぜず、それらは runtime evidence に束縛する。

#### deterministic fixed point

fixed point は versioned stage key の lexical order による deterministic round で進める。

```txt
entry/request resolve
  -> loader unit load
  -> runtime alias merge
  -> content transform/extract または external attestation
  -> phase promotion
  -> evaluation-reachable site candidate enqueue
```

temporary loader unit は domain、loader namespace、module-map key/cache-key tuple で identity を持つ。
runtime unit は load 後の domain と runtime identity で identity を持つ。
semantic request は importer runtime binding が確定した後に一回だけ生成・resolveする。

runtime phase は `source < evaluation` の join とする。
source loader alias と evaluation loader alias が同じ runtime unit に merge した場合も runtime phase を join する。
runtime unit が初めて evaluation へ遷移した時点で、extract 済み inventory の site candidate を一回だけ queue する。
source-only runtime unit は load、transform、extract まで完了して definition/inventory を確定するが、evaluation へ昇格するまで outgoing candidate を resolve しない。

pending stage がなくなった後にだけ、external runtime evidence、resolved request、request-site evidence、request site、entry を生成する。
その record set に対する `createModuleGraphSnapshot()` の成功を graph-completeness barrier とする。
barrier 前に final artifact、manifest、compiled execution contract を公開しない。

hard budget は transaction retry、fixed-point round、domain、entry、loader/runtime module、semantic request、site、candidate、observation、persistent cache entry/byte を制限する。
budget 超過、pending work があるのに state が進まない fixed point、duplicate/conflicting stage result は typed diagnostic とする。

#### stage cache

stage cache key は部分的な手書き field list ではなく、次の canonical preimage 全体の digest とする。

```txt
stage-key schema/version
stage kind
aggregate adapter profile digest
stage profile digest
attempt-specific domain ID または stable domain configuration
operation に渡す complete closed canonical input record
```

entry context、loader context lineage、module-map type、effective attributes、response metadata が operation behavior に影響し得る場合は operation input に入るため、自動的に cache key に入る。
同じ stage key に対する adapter operation は一 transaction で一回だけ呼ぶ。

cache hit でも保存済み observation を current attempt の exact observation set と `tryCommit` へ再提出する。
同じ cache entry を複数 entry/runtime unit が共有した場合は、transaction-local overlay 上で owner set を union する。

各 stage は cache disposition を次のいずれかで宣言する。

- `pure`：adapter transaction へ再登録すべき effect がない
- `replayable`：closed replay token で全 staged effect を再登録できる
- `transaction-local`：cross-transaction cache へ保存しない

replayable cache hit は stage key、result digest、replay token を `replayCachedStage` へ渡し、現在の transaction に effect を再登録する。
token で完全再現できない emission、watch registration、plugin effect を持つ stage は transaction-local とする。

active attempt は committed cache を直接変更せず、copy-on-write overlay を使う。
失敗、cancel、invalidated attempt の新規 cache result と owner update は破棄する。
commit 後は current graph が参照する cache/read evidence を pin し、残りを committed generation と canonical key 順で deterministic eviction する。
unpinned cache を保持する場合は、その entry が依存する observation owner、entry-to-runtime mapping、target-to-importer reverse edge も同じ lifetime で保持しなければならない。
初期実装は lineage を失った cache hit を禁止するため、current graph に pin されない cache entry を commit 時に deterministic eviction する。
current graph の pinned cache/read evidence だけで budget を超える場合は commit しない。

#### observation、invalidation、atomic commit

committed observation reverse index は全 observation key を、その observation を利用したすべての entry/runtime/cache owner へ対応付ける。
entry resolution observation は entry owner として記録し、commit 時に resolved target runtime owner へ対応付ける。
owner を有限に特定できない pipeline/domain/build-level observation は global とし、その key の change は全 cache を invalidate する。

watch change または previous attempt の invalidated result は observation reverse index から seed owner を求め、前回 snapshot の target-to-importer edge で reverse transitive closure を計算する。
closure owner の cache entry を一つの copy-on-write working state から除外し、一つの rebuild transaction で再計算する。
previous committed snapshot、cache、reverse graph は新 transaction が commit するまで変更しない。
一度観測した changed-observation key は、対応する rebuild が失敗または cancel されても coordinator の pending invalidation ledger に残し、後続 build の successful commit まで破棄しない。

final observation validation と publication を別 operation に分けない。
`tryCommit(transactionId, snapshotId, adapterProfileDigest, observationSetDigest, exactObservations)` が observation の再検証と staged effect publication を一つの atomic linearization point で行う。
result は次のどちらかである。

- exact transaction/snapshot/profile/observation digest を持つ committed receipt
- publication を行わず canonical changed-observation key set を持つ invalidated result

receipt field が request と一致しない result は adapter contract failure とする。
throw は publication がなく rollback 可能であることを adapter contract とし、保証できない adapter は unsupported とする。

coordinator は `tryCommit` 呼び出し前に AbortSignal を検査する。
呼び出し開始後は commit operation を abort せず、その result を commit/cancel の linearization point とする。
committed receipt を受け取った場合は、その間に abort が発火しても prepared coordinator state を必ず swap して成功を返す。
invalidated result の場合は publication がないため、その時点の abort を cancel として扱える。
commit 前の error/cancel は rollback し、前回 committed state を保持する。

pipeline/domain profile observation が retry 中に変化した場合は describe stage と domain ID を再生成する。
retry、round、cache budget の範囲で安定しない host は typed failure とし、古い snapshot を新 build の成功として返さない。

### ExecutionGraph の qualification

ExecutionGraph の node は TemplateNode であり、動的実行そのものではない。
各 node は、少なくとも次の location と instance domain を持つ。

```txt
HostInstance
  x AgentCluster
  x Agent
  x Realm
  x Global
  x Principal
```

Occurrence は、必要に応じて次の identity を持つ。

```txt
rootInstanceId
activationId
continuationId
registrationId
allocationId
```

Occurrence は、module instance、request、render attempt、activation、event task、update flush、remote invocation、cleanup など複数の epoch instance に同時に属し得る。

task source、microtask、render opportunity の順序は、任意の `happens-before` edge で捏造しない。
`Enqueue`、`Start`、`MicrotaskCheckpoint`、`Complete` の動的 event と host scheduler semantics から導出する。

### node と edge

ExecutionGraph は、少なくとも次の node を表現する。

- module instantiation、module evaluation、module binding cell
- allocation、heap region、property read、property write
- state read、state write、compute、call、branch
- callback registration、callback body
- await、continuation、return、throw、reject、abort
- DOM create、DOM reference、DOM binding、DOM mutation
- effect、resource、lifecycle、stream step
- transfer demand、protocol operation、artifact contribution
- admission adapter、event recorder、catch-up read
- capability use、authority possession、enforcement boundary

ExecutionGraph は、少なくとも次の edge を表現する。

- data と control
- call と possible-call
- reads-from と writes-to
- possible-subscription と untracked-data
- invalidation
- registration、materializes、obligates
- scheduling、settles、resumes、abrupt-to-handler
- happens-before と synchronizes-with
- module-link、live-binding-read、live-binding-write、evaluate-before
- alias と identity
- ownership、lifetime、cleanup
- transfer
- capability use と authority possession

未対応構文は、信頼できる summary、target-native semantic closure、diagnostic のいずれかで扱う。

### root の導出

root の seed は、外部から admission される entry、初期 UI、artifact、request handler、action、明示 lifecycle、明示 effect、platform obligation である。

callback registration は、すべてを seed にしない。
initial UI などの seed から `may-materialize` と `may-execute` の forward least fixed point を計算し、宣言的に必要な registration site を発見する。

RegistrationInstance は、`pending`、`active`、`cancelled`、`closed` の protocol state を持つ。
callback の発火は registration state ではなく、`CallbackInvocationOccurrence` として表す。

DOM event listener の invocation は、event path の entry と phase ごとの native snapshot、removed flag、propagation guard、type、capture、`once`、AbortSignal を反映する。
`once` listener は callback Start の直前に close する。

registration が有効な trigger snapshot に参加した場合だけ、callback を contingent client root とする。
callback 内で新しい registration が materialize される場合も、同じ fixed point を続ける。

root は、phase、trigger、owner、cardinality、admission cut、cancellation、terminal outcome、ObservationContract を持つ。
root は obligation であり、元の source function を一回呼ぶという意味ではない。

### reactive dependency

compile-time graph は、runtime dependency の保守的な上限を表す。
runtime signal graph は、実際に tracked read を行った collector ごとに構築する。

ReadOccurrence は `collectorEvaluationId` と `trackingMode` を持つ。
tracked occurrence を抽出した後で dependency identity を deduplicate する。
untracked read が同じ signal を読んでも、tracked subscription を消してはならない。

evaluation result の publication と subscription generation の activation は、一つの linearization protocol に置く。
各 tracked dependency が read 後に変更されていないことを検証するか、provisional subscription が区間中の invalidation を記録する。
stale な結果は publish せず、primitive contract に従って dirty または retry とする。

client updater root は、active subscription generation 上で invalidator から binding へ到達する場合だけ存在する。
無関係な browser write が存在するだけで updater root を作らない。

### read の classification

read は一つの enum に押し込まず、独立した軸で分類する。

- **Stability**：immutable、stable-within token、may-change
- **Consistency**：none、snapshot token、linearizable authority
- **ReplayPolicy**：duplicate、reorder、recompute の可否
- **Effect**：read 自体の observable effect
- **Realm**：read が成立する host と realm
- **Exposure**：result を公開できる audience と sink

複数 read で一つの invariant を支える場合は、共通 cut、version、transaction、history point を要求する。
validity は planning 時だけでなく、transfer、admission、recompute など実際の consumption point で検証する。

### semantic evidence

semantic fact の情報源は次の三つである。

- compiler が直接解析できる source
- Dathra package が生成する content-bound semantic manifest
- opaque boundary に対する明示 execution contract

これらは first-match の優先順位ではなく、一つの typed fact lattice へ evidence を供給する。
明示 contract は、直接証明できた source fact と矛盾できない。
矛盾は diagnostic とする。

semantic manifest と contract は、少なくとも次の fact を表現できるようにする。

- environment と host profile
- effect と read
- possible call と higher-order invocation summary
- callback retention、reentrancy、spawned work
- identity と ownership
- transfer capability
- exposure と integrity
- version、artifact digest、dependency epoch
- trust boundary

TypeScript type は補助情報として利用できるが、配置と effect の唯一の根拠にはしない。

unknown code が server root だけから到達し、server execution に不足 fact がなければ server に閉じられる。
unknown code が client、effect、authority に関係する場合は、同じ authority realm で到達可能な capability、resource、root へ保守的な edge を追加する。
unknown は permission にならない。

通常の browser realm の executable code は、静的 import がなくても ambient authority を持つ。
`CapabilityUse` がないことは、authority を剥奪したことを意味しない。
authority を制限する場合は、Worker、sandbox、compartment など実際の enforcement boundary を要求する。

### artifact 出力

一つの ExecutionGraph から、次の artifact を別々に生成する。

- server renderer と server artifact graph
- client definition と client artifact graph
- deployment manifest
- request ごとの reachable projection と transfer payload

server と client は、同じ component body を二回実行する二つの mode ではない。
同じ semantic IR から生成される別 program である。

semantic inclusion と physical bundling は分離する。
chunk をまとめても、activation policy、ownership、module identity を統合しない。

最終 bundler transform 後に client closure を再検証する。
server-only dependency、unrelated unit、version mismatch、integrity mismatch が混入した場合は artifact を失敗させる。

### ExecutionGraph kernel の canonical boundary

この節は、先に記載した TemplateNode vertex、generated operation identity、Occurrence、`happens-before`、`synchronizes-with` の扱いを supersede する。
TemplateNode は source または compiler-generated operation の静的 identity とする。
ExecutionGraph の vertex は、TemplateNode に symbolic location、semantic role、static occurrence shape、module または generation binding を結合した `QualifiedExecutionNode` とする。

EG03 は canonical base graph と deterministic な非直列化 index だけを所有する。
source 解析は PL02、semantic fact と host、authority qualification は SC03、concrete Occurrence と mutable state は runtime が所有する。
PL02 は EG03 の依存先ではなく、後から closed `ExecutionGraphInput` を生成する producer である。

base graph は実行許可や client 除外の証明ではない。
後続の SC03 と PL02 は、graph snapshot、module graph、contract 集合、analysis profile 集合、qualified evidence 集合、completeness scope、producer profile、proof domain を一つの `ExecutionAnalysisClaim` に束縛する。
trusted verifier は exact claim に対する decision を一つだけ受理し、caller が構築できない branded `AcceptedExecutionAnalysis` を返す。
この受理は、claim が束縛する completeness scope と proof domain の範囲で static assertion を qualified fact として扱えることだけを意味する。
concrete occurrence identity と scope 外の実行事実を証明しない。
CN01 は `AcceptedExecutionAnalysis` だけを placement と client exclusion の入力にでき、bare graph、自己申告 record、proof-domain digest を permission として扱わない。

#### dependency と identity DAG

ExecutionGraph の dependency context は、一つの strict `ModuleGraphSnapshot` と、superset を許す strict `ObservationContract` 集合である。
snapshot preimage は module graph ID と実際に参照する contract ID の昇順集合だけを保持する。
context に余分な contract があっても identity は変わらないが、参照 contract の欠落、重複、digest mismatch は拒否する。

record identity は次の順序で構築する。

1. `ExecutionAnalysisProfile`
2. `RootDefinitionAnchor`
3. `ExecutionLocationRequirement`
4. `StaticExecutionOccurrenceTemplate`
5. source または generated `ExecutionTemplateNode`
6. `ExecutionGenerationDomain`
7. `QualifiedExecutionNode`
8. typed `ExecutionEdge`
9. `RegistrationSupportTemplate` または `ReactiveSupportTemplate`
10. `RootObligation`
11. `ExecutionGraphSnapshot`

`ExecutionAnalysisProfile` は analyzer implementation digest、version、normalized syntax schema、operation taxonomy schema、analysis configuration digest を持つ。
この record は provenance identity であり、semantic fact の正しさや graph completeness を証明しない。

`RootDefinitionAnchor` は root key digest、`seed | contingent`、root kind、phase だけを持つ。
graph node、contract、constraint、support を anchor に含めないため、contract と root target が後続 record から anchor を参照しても identity cycle は生じない。

`ExecutionLocationRequirement` は、HostInstance、AgentCluster、Agent、Realm、Global、Principal の六軸の symbolic domain ID を持つ。
さらに target environment ID の集合と ModuleResolutionDomain ID の集合を持つ。
host profile の認証と authority enforcement の証明は含めず、SC03 の qualified evidence に残す。

source TemplateNode は content `ModuleDefinition` だけを参照できる。
preimage は canonical source URL、transform 後 content digest、semantic profile ID、analysis profile ID、normalized syntax digest、operation kind、preorder ordinal を持ち、ModuleGraphSnapshot の definition と完全一致させる。
external `ModuleDefinition` から source TemplateNode を作ることはできない。

generated TemplateNode は generator schema、generator profile digest、slot label 付き input TemplateNode ID、operation kind、ordinal を持つ。
root に依存しない generated node は root anchor ID と contract ID をともに `null` にする。
root に依存する generated node は両方を保持し、contract の `rootDefinitionId`、anchor の唯一の RootObligation、obligation の contract ID を完全一致させる。
contract が変われば generated node ID も変わるため、generated identity に RootObligation ID を含めない。
generated TemplateNode の input relation は DAG とし、ExecutionEdge の cycle とは分離する。

`ExecutionGenerationDomain` は location requirement ID、target environment ID、optional ModuleResolutionDomain ID、generator profile digest を持つ。
resolution domain がある場合は、その domain が location requirement に含まれ、domain の `targetEnvironmentId` と generation domain の target environment が一致しなければならない。

source `QualifiedExecutionNode` は `RuntimeModuleBindingId` を必須とし、binding の ModuleDefinition、resolution domain、target environment を TemplateNode と location requirement に一致させる。
generated `QualifiedExecutionNode` は `ExecutionGenerationDomainId` を必須とし、location requirement、target environment、generator profile を generated TemplateNode と一致させる。
`null` binding と concrete HostInstance、Realm、Principal ID は base graph に入れない。

#### root と ObservationContract

RootObligation は anchor ID、contract ID、target QualifiedExecutionNode ID、`execute | materialize` の entry fact、trigger constraint ID 集合、owner constraint ID 集合、terminal constraint ID を持つ。
anchor は trigger、cardinality、admission cut、owner、cancellation、terminal outcome を重複保持しない。

trigger constraint は contract 内の `event | effect | callback` constraint だけを参照し、その `admissionCutId` を contract の `initialCutId` と一致させる。
trigger cardinality、`inputIdentityDomainId`、`occurrenceIdentityDomainId` は参照 constraint から取得する。
contract の `eventIdentitySchemaId` は contract-level schema として独立に保持し、constraint の identity domain と同一視しない。

owner constraint は同じ contract の `identity | lifetime` constraint だけを参照する。
terminal constraint は同じ contract の `terminal` constraint を一つだけ参照し、その `subjectId` を root anchor ID と一致させる。
cancellation と terminal outcome は terminal constraint の outcome 集合を正本とする。

root kind は次の表で admission、phase、entry fact、trigger constraint を固定する。

| root kind | admission | phase | entry fact | trigger constraint |
| --- | --- | --- | --- | --- |
| `external-entry` | `seed` | `admission` | `execute` | `event` を1件 |
| `initial-ui` | `seed` | `render` | `execute` | なし |
| `artifact` | `seed` | `build` | `materialize` | なし |
| `request-handler` | `seed` | `admission` | `execute` | `event` を1件 |
| `action` | `seed` | `admission` | `execute` | `event` を1件 |
| `lifecycle` | `seed` | `lifecycle` | `execute` | `effect` を1件 |
| `effect` | `seed` | `effect` | `execute` | `effect` を1件 |
| `platform-obligation` | `seed` | `admission` | `execute` | なし |
| `callback` | `contingent` | `event` | `execute` | `callback` を1件 |
| `reactive-updater` | `contingent` | `update` | `execute` | `effect` を1件 |

owner constraint はすべての root kind で optional な exact set とする。
異なる root kind tuple が必要になった場合は caller option を追加せず、schema と ADR を更新する。

各 root anchor は RootObligation を一つだけ持つ。
各 contingent root は support template から一回以上参照されなければならないが、seed から到達しない support cycle は許可する。

#### edge algebra と root support

root fixed point を伝播する edge は `may-execute` と `may-materialize` だけとする。
`may-execute` は `execute(source)` から `execute(target)` を導出する。
`may-materialize` は `execute(source)` または `materialize(source)` から `materialize(target)` を導出する。

data、control、call、possible-call、reads-from、writes-to、possible-subscription、untracked-data、invalidation、registration、materializes、obligates、scheduling、scheduler-sequence、settles、resumes、abrupt-to-handler、module-link、live-binding-read、live-binding-write、evaluate-before、possible-alias、identity、ownership、lifetime、cleanup、transfer、capability-use、authority-possession は topology と evidence だけを表す。
各 relation は direction と endpoint operation category の閉じた表を持ち、snapshot validator が table と完全一致させる。
`identity` edge は対象となる `ExecutionOccurrenceIdentitySlot` を一つ保持する。
両 endpoint は同じ semantic role を持ち、各 StaticExecutionOccurrenceTemplate がその exact slot を含まなければならない。
symbolic location と binding の一致は base graph の受理条件にせず、後続の trusted verifier が exact claim の completeness scope と proof domain の範囲で assertion を qualified fact として受理する。
`identity` は fixed point traversal と node collapse には使わない。
`possible-alias` は identity union に使わない。

caller は base graph に `happens-before` と `synchronizes-with` を提出できない。
static scheduler event node と typed scheduling relation は記録できるが、それだけから host must-order を導出しない。
concrete `Enqueue`、`Start`、`MicrotaskCheckpoint`、`Complete` と authenticated host profile から得る order は runtime occurrence graph が所有する。

`RegistrationSupportTemplate` は callback-registration node、registration edge、callback-body node、contingent callback root、child root の trigger constraint ID、`once`、abortability、protocol version を持つ。
registration edge の endpoint は registration node から callback body とし、child obligation の target、entry fact、root kind、contract、trigger constraint と完全一致させる。
一つの registration node は、同じ `once`、abortability、protocol version を共有する複数の callback support を持てる。
この fan-out は有限な callback 候補の保守的な union であり、guard correlation と concrete callback selection は後続の semantic analysis と runtime occurrence が所有する。
producer が有限な registration option 候補を持つ場合は option tuple ごとに deterministic な generated registration node へ正規化し、同じ tuple の callback 候補を unsupported にしない。
parent root の closure が registration node を materialize した場合だけ potential support を導出する。
static protocol は `pending -> active | cancelled | closed` と `active -> cancelled | closed` を許可し、mutable RegistrationInstance state は runtime が所有する。

`ReactiveSupportTemplate` は collector、read、dependency、binding node、read から collector への data edge、read から dependency への possible-subscription edge、dependency から binding への non-empty contiguous invalidation path、contingent updater root、child root の trigger constraint ID を持つ。
child obligation の target を binding、entry fact を `execute`、root kind を `reactive-updater`、trigger constraint を同じ `effect` constraint と一致させる。
parent root が collector と read を execute し、binding を materialize した場合だけ potential support を導出する。
`untracked-data` edge は reactive support の根拠にできない。
active subscription generation と実際の updater activation は runtime が所有する。

index は次の三種類の root-specific record を別々に導出する。

- `IntraRootFact(rootId, execute | materialize, nodeId)`
- `PotentialRootSupport(parentRootId, contingentRootId, supportTemplateId)`
- `SeedReachability(seedRootId, supportedRootId)`

derivation は seed root の RootObligation にある entry fact だけから開始する。
support された child root は parent root の fact を引き継がず、child root 自身の target と entry fact から closure を開始する。
nested support と self support は finite record set 上で saturate し、seed から到達しない support SCC は fact を生成しない。

#### occurrence と derived index

`StaticExecutionOccurrenceTemplate` は、`root-instance`、`activation`、`continuation`、`registration`、`allocation` の identity slot 集合と、`module-instance`、`request`、`render-attempt`、`activation`、`event-task`、`update-flush`、`remote-invocation`、`cleanup` の possible epoch kind 集合だけを持つ。
concrete occurrence ID と epoch instance ID は持たない。

すべての root target は `root-instance` slot を持つ。
callback root target は `registration` と `activation` slot も持ち、reactive updater root target は `activation` slot も持つ。

base ExecutionGraphSnapshot は root fact、support closure、justification path、SCC、condensation、host order を直列化しない。
これらは fixed derivation profile `dathra.execution-graph-derivation/1` を使う `ExecutionGraphIndex` が計算する。

index の全出力は code-unit tuple 順にする。
intra-root justification path は traversal edge 数が最小の path を選び、同数なら edge ID sequence の辞書式順で選ぶ。
support chain は support 数が最小の chain を選び、同数なら support template ID sequence の辞書式順で選ぶ。
SCC と condensation は `may-execute | may-materialize` の directed subgraph だけを対象とする。
roots-for-node は root ID だけの union ではなく、`execute | materialize` を保持する `IntraRootFact` を返す。
occurrence query は QualifiedExecutionNode が参照する static template を返す。

unreachable な QualifiedExecutionNode と semantic edge は、保守的な静的上限として snapshot に保持できる。
analysis profile、location requirement、generation domain、occurrence template、TemplateNode、support、RootObligation、selected contract は structural owner からの exact use を要求する。
ExecutionGraph が参照しない EG01 module record は拒否しない。

creator と parser は canonicalization 前に property descriptor を getter 実行なしで走査する。
caller が指定する budget override は framework の hard cap を狭めることだけができ、上限を拡張できない。
一つの公開 operation は operation-local `BudgetLedger` を生成し、canonicalization、dependency preflight、cross-record validation、fixed point、support probe、path、SCC、最終 index 構築へ共有する。
hard budget は depth、data node、property、array length、string code unit、dependency record、各 graph record、canonical byte、validation step、fixed-point fact、traversal step、support probe、derived support、path、SCC work、index work を制限する。
各 counter は対象 work の allocation、sort、parser 呼び出し、candidate 判定より前に課金する。
dependency cardinality は dependency snapshot の clone と parser 呼び出しより前に descriptor から検査する。
canonical byte は value 単位で preflight 中に計測し、上限内と確認した後だけ full canonical text を生成する。
