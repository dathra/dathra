# #262 Assignment B の実 engine 検証と二 gate の追加検証

2026-10-05。GPT-6.1 Sol high、直接割当。
担当はこのディレクトリだけで、production/canonical/GitHub/Accepted は変更しない。
Proposal は Proposed のままである。
global/repo rules、matching Orca guide、関連 Signal/computed/effect/batch/createRoot/templateEffect/onCleanup SPEC/tests と actual types を確認した。
入力は最新 three-concerns-review と signal-and-feasibility-review、および追加 critique。

## 最終結果と証拠の単位

actual source engine と、その source を別 bundle にした二つ目の実 engine copy を使用した。
受理済みbaselineは Vitest 4.0.4 で P03 21、P06 7、P07 22 の計50 cases PASS、strict TypeScript 6.0.3 noEmit PASSである。
results.json はその50件のbaselineとしてbyte単位で変更せず、baseline-50.jsonにSHA-256を記録した。
追加11件を含む最終結果は61 cases PASS、strict noEmit PASSで、followup-results.jsonにcommands/stdout/stderr/source SHA-256を保存した。
baselineの関連kernel/runner/README/testはhistory/baseline-50-*に保持する。
baselineには3 suites、現在のrunnerには追加gate suiteも含む4 suitesがある。
初回 node:test の使用はrepoのVitestルールに不適合だったため、assertionsを削除せずVitestに移行した。
旧sourceはhistory/node-test-*、旧実行証拠はlogsに保持した。
初回 node:test の15 cases と型結果は logs/p03-phase.json、logs/p03-typecheck-phase.json に保存し、Vitest の最終結果へ流用しない。
Node 24.15.0、pnpm 10.17.1、Vitest 4.0.4、TypeScript 6.0.3、esbuild 0.25.10、alien-signals 3.2.0、happy-dom 20.5.3。
tsx 4.20.6 は初回実行と既存 esbuild の解決元としてのみ使用した。
これは新しい公開 API の production proof ではなく、actual engine の上に置いた限定 capture/facade kernel の証拠である。

| 論点 | 観測と判断への影響 |
|---|---|
| one-peek/alias | 同 source Signal は一 capture 内で peek 一回、同 owner の二 path は一 browser slot。別同値 Signal は別 slot。cross-owner 同 Signal は診断 |
| recognition | inherited data methods/value getter を受理し、own accessor shadow は飛び越えない。判別中 getter/peek は0。tag-only は data、computed は mutable slot にしない、full fake は受理、throwing peek は error |
| duplicate copy | actual current source を別 bundle にし、異なる constructor の source Signal を受理。ただし browser の cross-copy computed は stale になった。source capture の互換性と tracking ABI は別であり、owner/behavior graph が一つの engine identity を使う gate が必要 |
| identity/no-op | same external root unchanged、same previous、same owned value/peek は通知0。別 external root は同値でも通知。changed external snapshot は通知。field order は正規化する未採用codec意味論で、標準JS列挙順を維持しない。array order と alias topology は区別 |
| nested alias / sharing | updater が previous の nested alias を返すと、その immutable node を保持。新 parent `{child:prev.child,n:prev.n+1}` の nested owned node も再利用し、child-selecting computed は native 同様に再通知しない。external nested object が別 root で変わっても旧 node へ漏れない |
| readonly/raw escape | value/peek/updater は recursive frozen owned data。外部 caller object は freeze しない。external alias と native source state はコピーで分離。内部 native cell を公開しない |
| revocation | cached set は失効後 updater 自体を呼ばない。updater 内で失効した場合も final write を再検査。cached peek の passive readonly read はこの kernel では許可し、write capability と区別 |
| binding phase | flat namesを全て残したまま bind(increment) の .set/updater を mutation 前に拒否。request/emit/timeout/control の capability acquisition も拒否。captured native handle の任意作用は防げない trusted author boundary |
| native semantics | tracking、peek、computed、batch、stop は actual engine を通る。owned previous→previous の Object.is no-op は保持。external mutation→explicit set の通知は native raw alias と意図的に異なる未採用 context contract |
| snapshot の強さ | 同じ captured graph を template/handoff に使う output coherence は成立。side-effectful trusted fake peek が別 Signal を変えると、captured pair は同時刻の live pair でなくなり得る。structural recognition は pure peek/global instantaneous snapshot を証明しない |
| 数値 | finite domain、-0 は codec に専用 atom を持ち JSON roundtrip 後も保持。NaN は native API の有効入力だが、この未採用 finite transfer profile では path error |

Accepted260 の120–124行は通知意味論の維持と batch throw flush を既に記録している。
batch の例外 flush は既知の制約であり、新たに発見した engine bug と呼ばない。
context profile の external reference/readonly semantics の差分は明示し、Accepted260 を黙って再解釈しない。
global instantaneous snapshot が必要なら、capture 中の side effect を禁止する author semantic contract または native provenance scope を別途判断する。
native predicate だけでも任意 Proxy data walk の副作用を全面排除したことにはならない。

record列挙順の正規化も、finite numbers/NaN制限とraw alias分離に並ぶ未採用codec意味論である。
coordinatorの観測では graph({z:1,a:2})→restore により Object.keys が[z,a]から[a,z]に変わる。
graphがfieldsをsortするためであり、「native-equivalent readonly projection」という保証には含められない。
productionで標準JSのrecord列挙順を保持する方式は有効な代案で、比較用fingerprintの順序正規化と復元recordの順序保存を別責務にできる。
この追加指摘は文書にだけ反映し、二 gate 以外のcodec実験や契約採用は行わない。

## コードと再現

repository root から実行する。

```sh
node tmp/dathomir-262-validation/state-lifetime/run.mjs
```

この runner は actual source の二つ目の bundle、strict noEmit、Vitest の四 suite を順に実行する。
予期しない failure は非0で終了し、途中結果も followup-results.json に残す。
個別の再現は次のとおり。

```sh
node tmp/dathomir-262-validation/state-lifetime/build-copy.mjs
node_modules/.bin/tsc -p tmp/dathomir-262-validation/state-lifetime/tsconfig.json
packages/reactivity/node_modules/.bin/vitest run --config tmp/dathomir-262-validation/state-lifetime/vitest.config.ts p03.test.ts p06.test.ts p07.test.ts gates-followup.test.ts
```

graph.ts は trusted finite graph/profile、owned.ts は readonly owned payload/cache/write gate、p03.test.ts は actual engine に対する契約の検査である。
decode は kernel が作った trusted graph に限り、untrusted wire validation、server auth、codec extension を実装したとは扱わない。
plain alias の保持は各 finite data graph 内の契約であり、異なる Signal payload graph を跨ぐ arbitrary heap identity は保証しない。
inspection budget 64 と data walk budget 10000 は実験の内部上限であり、公開値や性能保証ではない。
cache は external root ごとの最新 snapshot だけを WeakMap に保持し、全履歴を保存しない。
owned immutable data はその owner の ledger に登録し、別 owner へは明示 copy を行う。

counterexamples-initial.json は五つの誤った claim が実際に fail した証拠である。
counterexamples.test.ts は誤った draft claim を意図的に assert し、失敗結果を残すための独立 script である。
通常の成功 suite に含めない。
特に native mutable alias と owned profile の違いを engine regression と呼ばない。

```sh
packages/reactivity/node_modules/.bin/vitest run --config tmp/dathomir-262-validation/state-lifetime/vitest.config.ts counterexamples.test.ts
```

最初の build は実験内の相対 path が一段深く、module resolution で失敗した。
logs/p03-initial-0.json を保存し、import root を直して成功した。
最初の strict check は test helper の unknown narrowing が nested function に保持されず失敗した。
logs/p03-typecheck-initial.json を保存し、narrowed const を使って修正した。
runtime failure や反例を削除して pass したことにはしない。

## 続く範囲と限界

P06 は actual engine と happy-dom の実 DOM object を使う7 cases、P07 は actual engine と Vitest fake timers の22 cases を実行した。
real browser、real clipboard、real EventSource の観測とは区別する。

## 失敗を残して修正した最小契約

| 証拠 | 失敗した claim | 修正と設計への帰結 |
|---|---|---|
| logs/vitest-initial-structural-sharing.json | `{child:prev.child,n:prev.n+1}` で child computed が native 1回に対し facade 2回。同一 invocation の alias facade も別 object | owned node を recursive に再利用。fingerprint に明示 owned identity も含め、同値別 child を誤 no-op にしない。slot identity ごとの invocation-local projection cache。別 token 間では cache を共有しない |
| logs/vitest-retry-gap.json | failed receive が model を変えた後、retry の `.set` は native no-op。success と記録しても表示は旧値 | successful receive が refresh revision を発行し、actual effect が現在の依存を再収集する。candidate を成功 attempt で公開、Object.is 同値表示は書かない |
| logs/vitest-source-fence-counterexample.json | source を stop しても別 resource が lease を生かすと cached callback が再びモデルを書ける | sourceOpen token を ledger cleanup 前に失効。lease の有効性と source の有効性を分ける |
| logs/vitest-async-source-counterexample.json | pending source continuation も lease guard だけでは stop 後に書ける | managed callback の resource-current predicate を setter projection に結ぶ。Promise settle まで pin、source stop で write authority は即失効。late rejection は consume し active error と分ける |
| logs/vitest-foreign-reentrancy-counterexample.json | foreign native Promise が sync run を通過し timer/source pin は0。cleanup の再入で新 lease も live Set の iteration に巻き込まれる | PromiseLike の then を一度取得して観測する。新 admission を先に予約し、旧集合の snapshot だけを cleanup。最後に admission された replace が勝つ |
| logs/vitest-counterexamples.json | clone毎回/no isolation/native raw alias notification/batch rollback/last-resource early-close の五 claim | 意図的な5 failをそのまま保存。nativeとcontext差分、known batch制約、pin必要性を示す。production regressionではない |

P06 は failed-attempt DOM plan を破棄し、部分変更済み model と外部 native effect は戻さない。
healthy event が後でその partial model を表示することも観測した。
SSR seed同値0、latest pending、同 failed input 自動再試行0、明示 retry、disposed input、parent tracking からの child read 分離を検査した。
queue の flush は親 publication/追跡完了後に明示呼出しする fixture であり、production scheduler の全体実装ではない。

P07 は pin→last resource除去→callback→sync return/Promise settle の順を実行した。
replace/dispose は pending pin を待たず authority を失効し、parallel sibling/別 channel は維持した。
sync acquisition の event は disposer を登録するまで buffer し、callback throw では sourceを一度停止した。
cleanup throw を記録して reverse cleanup を継続し、終了 lease を channel registry から外した。
root が plain effect を自動停止しない既知制約も actual source で確認した。
provider 自身が resource を作った後 disposer を返さず throw する場合は、その provider の rollback または stop-before-start adapter が必要である。
handle の無い外部 resource を一般に停止できるとは主張しない。
managed subscribe の resource predicate は内部 kernel の責務案であり、新しい public helper の採用ではない。
任意の native source に onDispose と run を別々に渡すだけで、この対応付けを推測できるとは扱わない。

## binding evaluator の Promise edge

P03.21 は flat async operation が setter/request を触って rejected Promise を返す場合を実行した。
evaluator は Promise を content として拒否し、その時点で rejection observation を付けた。
await 後で owner がまだ live な場合も binding setter が mutation 前に拒否し、disposal 後の rejection も passive diagnostic に consume した。
model更新0、capability呼出し0、四 rejectionの観測を確認し、Vitest に unhandled rejection は出なかった。
追加gateでは、同じpromise.tsのPromiseLike observationをevaluator/receive/leaseで共用した。
本物のforeign native Promiseとtrusted thenableを拒否して観測する範囲は追加11件で確認した。
content grammarは依然text/nullのfixtureであり、全DOM content grammarとproduction diagnostic routingは未証明のgateとして残す。
任意 captured native handle の副作用は sandbox できず、invalid return を見つけても rollback はできない。

## 別 realm Promise と replace の再入

P07.17–22 は node:vm が作る本物の別 realm Promise を run/timeout/subscribe に返した。
修正前は run が Promise を同期結果として返し、timer/source は settle 前に pin を失った。
修正後は run が戻り値を拒否して rejection を観測し、managed async callback は fulfillment/rejection まで pin を保った。
foreign fulfillment 後の guarded write、foreign rejection 後の active/late diagnostic、trusted then getter/call throw の pin 解放も確認した。
logs/vitest-foreign-reentrancy-counterexample.json に修正前の4 fail、history/pre-foreign-reentrancy-leases.ts に旧kernelを残す。

推奨は realmを限定せず PromiseLike を assimilate し、sync run は同じ観測処理を付けて async result を拒否する契約である。
then は一度取得し、呼出しを Promise job に送り、throw と rejection を観測する。
最も強い代案は nominal realm限定と事前に bridge された Promise だけを受け付ける方式だが、iframe由来の正当な結果にも不要な変換責務を課すため採らない。
この提案は「任意 thenable を safely sandbox できる」という保証を含まない。
then getter/call は trusted author code で、直接のnative副作用、無限ループ、settleしないPromiseを抑制しない。
settleしない結果は pinを保つが、明示 dispose/replace はそれを待たず write authority を失効する。
追加gateによりbinding evaluatorとReceiveQueueにもこの観測処理を適用したが、production implementationの証拠には読み替えない。

replace は新 lease を予約してから旧集合の snapshotを失効する。
cleanup中に再入した replace はその予約も失効できるため、外側 begin は失効済みleaseを返し得る。
operation dispatcher は返却後に current を再確認してからauthor bodyを呼ぶ必要がある。
P07.20 はこの返却値、再入側だけのregistry所属、cleanup回数、owner disposeによる最終停止を検査した。
最も強い代案は同 channel の cleanup 再入を一律拒否する方式だが、正当なcleanup起点の後続操作を禁止するため、admission順序を明示する方を推奨する。
50件baselineの旧sibling失効は順次処理であり、その間のcached write窓を追加gateで再現した。
現在の候補kernelは旧集合全体のauthorityを先に失効し、返却したdrainでabort/cleanupを後から呼ぶ。
この二段階contractは未採用案であり、Accepted260やnative engineの変更を伴わない。
無限に再入するauthor cleanup、任意 AbortSignal listener の例外、実schedulerの全callback経路を安全に停止したとは主張しない。

## 二 gate の追加結果と推奨

直接のfollow-upは06:10 JSTを目標に二点だけを扱い、判断ownerは#262、evidence/archive ownerは#264である。
11件全てが修正前にfailし、logs/vitest-gates-before-fix.jsonにはforeign Promise由来のunhandled rejection 2件も残る。
これは50件baselineの不足を示すkernelの反例で、engineのbug報告ではない。

| Gate | source/question | 推奨する未採用contract | 最強代案と判断理由 | 実証と残るgate |
|---|---|---|---|---|
| PromiseLike observation | coordinator follow-up (1)、all-name bind、sync receiveのscopeがasync resultへ漏れないか | promise.tsでthenを一度取得し観測。bindingはcontent拒否、receiveはsync failure。receiveのinvocation tokenはauthor callbackがreturn/throwした直後、result inspection/native batch flush前に失効 | realm限定とbridgeは正当なforeign Promiseへ変換責務を課す。receiveをawaitする代案はdelivery/publication/identity contractを別設計にするため、このgateでは採らない | G01–G07。real node:vm Promise、trusted thenable、await後live/disposed、cached setter/capability、native effect flushを実行。全content grammar/実scheduler/任意native副作用は未証明 |
| revoke-all then cleanup | coordinator follow-up (2)、A cleanupがBのcached writer/source callbackを再入するとどうなるか | 新admission予約→全旧leaseのactive=false/sourceCurrent=false→旧snapshotのabort/cleanup。cleanupが再入した最後のreplace admissionが勝つ。返却leaseが既にstaleならdispatcherはbodyを開始しない | sequential invalidateはcleanup後にBを止めるので、その前のwriteを許してしまう。cleanup再入一律拒否は正当な後続operationを制限する。二段階revocationを推奨 | G08–G11。A cleanup/abort、B provider stopによるcached event、last-admission、dispose再入を実行。任意listener例外/無限再入/production全schedulerは未証明 |

PromiseLikeを観測してもreceiveをasyncにはしない。
flushはその場でfailedを返しappliedを更新せず、native partial model効果のrollbackも追加しない。
ReceiveQueue.errorsには同期attempt failure、rejectionsには後続のpassive rejection observationを保存し、後続rejectionによるDOM成功公開は行わない。
receive callbackが終了したらvalid=falseにするため、await後だけでなくnative batch flush中のeffectからcached writerを呼んでも拒否される。
G07は実engineでこの窓を検査し、以前のfinallyだけでは失効が遅かったことを示した。

revoke()はinternal kernelのauthority失効とdrainを分ける候補で、公開API追加を提案したものではない。
managed sourceCurrentはsourceOpenとlease.currentの積で、lease revocationにより最初のabort/cleanup前からfalseになる。
source callbackはこのpredicateをuser onValue呼出し前に検査し、captured setterも同じguardを使う。
resource disposerはsnapshotへ移すため重複停止せず、旧BのcleanupはAの再入後にも元のdrainで実行する。
logs/vitest-sibling-write-before-fix.jsonは、旧A cleanup中のB cached writeにより実modelが1になったことを[model,denials,cleanupErrors]=[1,0,1]で記録した。
候補では同じtraceが[0,1,0]となる。

最初の修正後runは追加11件PASSだったが、既存P03.21の「2 microtasks後にrejectionsが3」という観測タイミングassertionがfailした。
共通PromiseLike assimilationには追加Promise jobsがあるため、assertionを保持して16 microtasksをdrainするfixtureへ変更した。
logs/followup-after-fix-timing.jsonに60 PASS/1 FAILを残し、最終は61 PASSである。
任意thenableの無限処理、永久pending、getter/callでcaptured native handleを使う副作用をsandboxしたとは主張しない。

## browser engine identity の追加制約

P03.20 では owner slot を native engine A で復元し、computed を別 bundle B で作った。
slot 1→2 に対し A computed は2→4、B computed は2→2の staleを観測した。
structural protocol を受理することは source の snapshot capture に有効だが、独立する reactive scheduler 間の tracking を接続しない。
#247 は browser owner/behavior が使う engine identity の graph検査または選択adapterを必要とする。
最も強い代案は明示的な cross-engine bridge だが、同期/所有/通知の別 proof が要る。
server側の正当な duplicate copy の入力を一律に除外してこの問題を隠さない。
これは Accepted260/native engine の bugでも、その採用済み意味論の変更でもない。
実 DocsCopy source は clipboard Promise の成功前に copied=true を立て、rejection を空 catch で消している。
目標は fulfilled clipboard の後だけ成功 feedback、失敗は成功表示にせず診断する契約である。
Copy-like kernel timer の pass を、実 DocCodeBlock の migration または real clipboard の成功証拠にしない。

P03 は型名、API reduction、SSR adoption、IME、history、real Docs/browser source、production cleanup の完成を証明しない。
全58問/七 witness の requirements は元資料に残し、この実験の pass 件数と混同しない。

## archiveでの再検証

判断のownerは #262、証拠保存のownerは #264 under #247である。
coordinatorはこの作業treeへsourceをコピーし、strict TypeScriptと61件を再実行して成功を確認した。
active sourceのformatとlintを整え、依存追跡の意図的な読取りをvoidで明示し、thenableの負例だけにlint例外の理由を記した。
最初の機械的なlint修正がcounterexample内の代入まで変更したため、型検査が拒否した。
元の代入に戻して再検証した記録は `logs/archive-lint-edit-typecheck-failure.json` と最新の `followup-results.json` にある。
五つの意図的な誤claimも再実行し、五件すべてが引き続き失敗することを `logs/archive-counterexamples.json` に保存した。
50件baselineの `results.json` と `history/` のsourceは変更していない。
terminal配送receiptは実装成立性の証拠ではないため、このarchiveの現行ログ選択から除いた。
