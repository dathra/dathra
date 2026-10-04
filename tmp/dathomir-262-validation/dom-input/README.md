# P04/P05 の DOM と入力の検証

#262/PR263 の検討に使う、一時的な browser kernel と再現テストである。
実際の reactivity engine を Chromium に bundle して、SSR node の接続と入力の初回同期を検証した。
テストの成功には反例の再現成功も含むため、全契約の成立を意味しない。
Accepted #253/#260 と利用者の選択は変更しておらず、この文書の提案はすべて未採用である。
成果物の保存は coordinator が扱う Task #264 の範囲に引き渡す。

## 再現方法と実行環境

リポジトリ root で次を実行する。
既存の workspace dependencies と Playwright の browser cache を使い、インストールや manifest の更新を行わない。

```sh
node tmp/dathomir-262-validation/dom-input/run.mjs
packages/reactivity/node_modules/.bin/oxlint --deny-warnings tmp/dathomir-262-validation/dom-input/*.mjs
```

Node v24.15.0、Vitest 4.0.4、Playwright 1.56.1、Chromium 141.0.7390.37、esbuild 0.25.10、alien-signals 3.2.0 を使用した。
headless の実 browser であり、DOM mock ではない。
checkout の HEAD は `49b1adf502dad7de0b4709c1595d87529f0d2ebd` で、bundle に含めた実ソースの SHA-256 を [build-provenance.json](./build-provenance.json) に記録した。
installed dependencies や browser がない別環境での実行は検証していない。
browser の挙動が変わった場合、反例の assertion が失敗することも結果として扱う。

実験コードはこのディレクトリで完結し、実 engine の読み込みだけを `packages/` に依存する。
他 worker の live な実験ディレクトリには依存しない。
`run.mjs` は browser bundle、provenance、最新のテストログと観測 JSON を上書きする。
保存済みの `history/` は実行時に変更しない。
移設時は directory の階層と実ソースの import を coordinator が確認する必要がある。

## 参照した正本と証拠の境界

[三つの関心のレビュー](../design-context/dathomir-262-three-concerns-review.md) と [authoring のレビュー](../design-context/dathomir-262-full-authoring-review.md) の P04/P05 を対象にした。
Accepted source は別 checkout の [#253](https://github.com/dathra/dathra/blob/0ad07bffd601fef7cd708276942b187883ea787e/SPEC/proposals/245/253/253.typ) と [#260](https://github.com/dathra/dathra/blob/0ad07bffd601fef7cd708276942b187883ea787e/SPEC/proposals/245/260/260.typ)、検討中の source は同 checkout の [#262](https://github.com/dathra/dathra/blob/0ad07bffd601fef7cd708276942b187883ea787e/SPEC/proposals/245/262/262.typ) を読んだ。
実装側では reactivity の signal、effect、batch、createRoot、onCleanup、templateEffect、および runtime の reconcile、DOM 挿入、属性、event の SPEC と tests を確認した。

SSR は server が出力した状態を表す固定 HTML fixture である。
compiler が本物の server module から HTML と association を発行するところは実行していない。
fixture が事前に指定した node reference、marker extent、snapshot、module default/profile/parser の識別子を client に渡す。
node の形を走査して ownership や descriptor を推測する処理は含まない。

flat `defineClient`、kind を持たない `bind` marker、`_key` 属性、server/client の分離は利用者の選択として保持する。
この kernel はその authoring API を新たに実装していない。
`_key` は明示 association と active intent に記録し、SSR 属性から token を発行する処理や公開 child handle の提案には使わない。
`inspect()`、phase hook、raw signal はテスト用の観測手段である。

## 判断に使える観測

| 検討対象 | 観測 | 変わる判断または proof status |
| --- | --- | --- |
| P04 existing-row attachment | 二つの SSR row の全 node を保持し、admission 中の DOM mutation は 0、initializer と template と factory は 0 | 明示 extent と snapshot を使う小さい kernel では成立。既存 `reconcile` をそのまま adoption に使う案は反例あり |
| P04 first refresh | kernel が commit 後の microtask を一回予約。同じ key なら生成 0、新しい `c` だけ initializer と template と factory が各 1 | admission のゼロ呼び出しと active creation の計数を分ける必要がある |
| P04 keyed lifetime | 編集した row を reorder して node、draft、token を保持。remove の cleanup は一回で、re-add は新 node と fresh token | sibling extent 内の typed key と明示 incompatible profile による lifetime 判定を支持 |
| P04 create profile | default/profile/parser 不一致を acquisition 前に拒否し、tag/namespace/default の active replacement は旧 lifetime を終了 | 初期 mismatch を silent reconstruction で処理しない。active replacement は別の操作として扱う |
| P04 fragment ownership | 二つの sibling node と start/end marker を移動。bare DocumentFragment は挿入後に空になる | logical fragment に retained extent が必要。DocumentFragment object だけでは不足 |
| P04 bind placement | 同じ marker で Text、二つの DOM node、empty、Text を公開。同じ Text の更新は `.data` を使用 | kind の固定なしでこの小さい配置 kernel は成立。compiler の変換との統合は未検証 |
| P04 independent-child containment | 失敗する parent plan と enclosing parent admission の間に child が更新を続け、parent の cleanup は child を止めない | rollback は parent の acquisition に限定する。明示 outer extent の削除時だけ child owner を終了する |
| P04 staging event gate | baseline は afterAcquire の synthetic input で draft を変えていた。修正版は commit まで edit callback を遮断し、live native property を保つ | token.active だけでは staging gate として不足。P05 の宣言 model-only draft adoption と通常 operation を分ける |
| P04 partial DOM commit | 一つ目の owned Text setter が成功し、二つ目が実 DOM を変更した後に throw。二つ目と一つ目を逆順に戻し、元の node と表示、terminal identity を確認 | failCommit を write 前に throw する実験から partial-write rollback の proof を導けない。可逆な二つの明示 Text target について限定的に成立 |
| counter admission failure | baseline は required failure 後の同 association retry を許していた。修正版は予約を acquisition 前に置き、effect と operation listener を終了し terminal に記録 | 成功後だけの WeakMap 登録では Accepted260 の failure identity を保持できない |
| counter postcommit refresh | admission の commit 後に setter failure を記録し、active owner の明示 retry は成功。disposed identity の再 admission は拒否 | 初期 acquisition/commit failure と active refresh operation failure の証拠を分ける必要がある |
| P04 host movement | `insertBefore` は同じ Node でも disconnect/connect を呼び focus を失う | logical lifetime の保持から native focus や Web Component callback の保持を導けない |
| P04 optional moveBefore | Chromium の `moveBefore` は focus を保持し `connectedMoveCallback` を呼ぶが selection `[1,2]` が `[0,0]` になる | state-preserving move だけで caret 保持を約束する案は、この fixture で反例あり |
| P05 native revision | 接続前の「あ」、listener gap、event のない live property change を model-only sink に反映。古い publication は拒否 | 初回 refresh 前の latest native read と、event revision に加えた live value の比較を支持 |
| P05 controlled/native sink | native-owned の keystroke は DOM に留め、controlled は指定した sink を通す。同値 property assign は 0 | sink ごとの explicit ownership を支持。form defaultValue は live draft と別に扱う |
| P05 multi-control conflict | 異なる pre-admission draft は hold。remote model 更新だけでは解除せず、explicit edit と peer の protection 条件で解決 | 一つの scalar に複数 control を載せるには conflict と pending の規則が必要 |
| P05 reset completion | trusted click の reset listener microtask は default action と後続 cancellation より早い。次 task の cancellation/revision 確認は単一 control で成立 | microtask を native reset 完了の境界にする案は棄却候補。owner が timer を持ち cleanup する案を支持 |
| P05 group reset | default が `a` と `b` の二つの control は native reset 後に `[a,b]`、現在の scalar sink 後に `[b,b]` | 複数 control の reset は未成立。各 default を保存する hold または明示解決規則の設計が残る |
| P05 formatter release | synthetic composition 中の異なる formatter 結果は hold できるが、compositionend 後の final input で `[あ]` が `[[あ]]` になる | 任意 formatter を compositionend で即公開する一般契約は未成立。final-event protocol と caret mapping を決めるまで保留する候補 |

これらの「支持」は、この kernel と fixture における証拠の評価である。
Accepted decision の変更、公開 API の採用、production implementation の完了は coordinator と利用者が判断する。

## P04 の接続と失敗の扱い

初期 preflight は key の重複、root と marker の位置、default/profile/parser の一致、tag/namespace、snapshot を読む。
同じ list の extent が重ならないことと、outer marker 内に未宣言の node がないことも acquisition 前に確認する。
preflight mismatch はまだ acquisition を記録していないため、修正された catalog で再試行できる。
acquisition 後の required commit failure は同じ association object について terminal に記録し、復元した二つの scope を一回ずつ dispose する。
重複 active admission は同じ owner を返す。

admission の復元は `signal(snapshot)` と既存 node への listener の接続であり、creation callback を使わない。
effect は実 engine を使い、返された stop を `onCleanup` に登録する。
自動 first refresh は commit 後に開始し、新しい key または明示 incompatible entry にだけ creation callback を使う。
新 child の template が throw した場合は provisional scope を cleanup し、既存 row の DOM と independent child の model を戻さない。

enclosing parent admission のテストは、すでに active な list に fixture-issued outer extent grant を渡す。
parent が acquired した listener を失敗時に終了し、child の更新を failure 前後に観測する。
child root を明示的に remove する別操作では child owner を dispose する。
これは実 `createRoot` の scope 分離の実験であり、完成した Accepted admission runtime の統合テストではない。

coordinator review では、`token.active` だけを確認した edit listener が staging 中の synthetic input を処理する反例が見つかった。
修正版は `committed` も確認する。
staging hook が live `.value` を変えて input を dispatch しても restored model は `Alpha`、label は `Alpha` のままで、native property の draft は保持する。
active になった後の input で初めて framework の edit operation が draft を更新する。
実 Playwright edit の `isTrusted: true` は接続前の別 test で観測しており、staging hook の synthetic event を trusted native input の証拠とは扱わない。
P04 の restored snapshot model と native draft を分けるこの条件は、P05 の explicit model-only native draft adoption と異なる経路を検証する。

partial commit の fixture は、今回取得する二つの row にある明示 label Text を write target にする。
一つ目の setter は native `CharacterData.data` を変更し、二つ目は native setter の実行後に throw する。
失敗した二つ目にも inverse を登録済みであるため、両 target を逆順に戻す。
child scope と listener の cleanup は二回で、late input は stopped model を変えず、同 association の retry は terminal error になる。
setter の途中で独立 active counter が 7 から 8 に更新されても、その Text と model は rollback の対象にならない。
live input property に残した draft も戻さない。
`failCommit` の write 前の throw は従来の acquisition-failure test として保持し、この partial DOM commit の test と区別する。

この inverse journal は、可逆な二つの Text.data setter だけを実証した。
native setter を包む fixture setter の inverse は成功する条件であり、任意の不可逆な setter、node の structural operation、observer の既発通知を巻き戻す保証はない。
inverse setter が失敗した場合は resource を終了して terminal を保持し、AggregateError に元の commit error と restoration error を残すが、元の表示の回復は未証明である。

## P05 の入力の扱い

controlled admission は preflight、listener staging、latest native read、provisional model-only sink、revision/live value の再比較、commit、自動 initial effect refresh の順で進む。
sink の request、emit、timeout、onDispose、control access は provisional phase で拒否し、async sink も拒否する。
比較が安定するまで最大三回試し、安定しない場合や required commit failure では listener と effect を終了する。
その際に native `.value` を server snapshot に戻さない。

composition を接続前に観測していない control は `unknown` とする。
異なる formatter 結果の公開を保留し、観測した blur、change、compositionend を release の候補として扱う。
この kernel の任意 formatter の release は反例を含むため、そのまま採用できる契約ではない。
同値 refresh による caret `[1,2]` の保持は実 keyboard と selection API で検証したが、値が変わる formatter の caret mapping は実装していない。

reset の timer は owner の resource として登録する。
uncanceled reset の次 task で native value を読んで sink に渡し、間に新しい input revision があれば古い reset candidate を捨てる。
dispose は timer を cancel する。
単一 control と同じ default の fixture で成立した結果を、異なる default の group に一般化しない。

## counter baseline と統合の残作業

[counter.test.mjs](./counter.test.mjs) は SSR `Count: 7` の original Text を記録し、snapshot 7 を復元する。
initializer と template の witness は呼び出すと throw し、admission 後も呼び出し数は 0 である。
commit 後の自動 refresh は同じ Text を `Count = 7` に変更する。
実 click で 8、続く四回の click で 12 になり、dispose 後は click と raw signal の変更で DOM が更新されない。

この baseline は getter、event operation、actual effect、cleanup を一つの browser で実行する。
build worker の module linker、state worker の restore kernel、real server emission を合わせた joint integration は実行していない。
counter の成功だけでその joint proof を完了したとは扱わない。

counter は preflight を通した後、Signal と effect の取得前に association を予約する。
required admission failure は effect と listener を終了し、同 association object の retry を拒否する。
failure 後に取得済み raw Signal を変更しても getter は再実行されず、click も operation を呼ばない。
disposed owner の再 admission も terminal error とし、再取得や再 activation を行わない。

自動 postcommit refresh は owner が active になってから実行する。
その failure は `initialRefresh.ok: false` と error に記録し、admission failure として隠さない。
active owner の duplicate admission は同じ owner を返し、明示 `refresh()` の retry を許す。
これは Accepted260 の active operation failure と required initial admission failure を区別するための未採用の観測 API である。
refresh failure の fixture は setter が書く前に throw する場合であり、active operation が途中で DOM を変えた場合の rollback を証明していない。

## テストと保存した失敗

coordinator review 後の最終 suite は P04 が 24 件、P05 が 17 件、counterexample が 8 件、counter が 4 件の合計 53 件である。
最終結果と時刻は [latest-run.log](./latest-run.log)、syntax check と Oxlint 1.51.0 の結果は [syntax-lint.log](./syntax-lint.log) に保存する。
4 本の観測 JSON は assertion が読んだ node identity、callback count、native value、phase、revision、selection を保存する。

| ファイル | 役割 |
| --- | --- |
| [contract.md](./contract.md) | kernel 内だけで使う未採用の実験条件 |
| [p04-kernel.mjs](./p04-kernel.mjs)、[p04.test.mjs](./p04.test.mjs)、[p04-observations.json](./p04-observations.json) | keyed SSR 接続、active update、fragment、containment、terminal phase |
| [p05-kernel.mjs](./p05-kernel.mjs)、[p05.test.mjs](./p05.test.mjs)、[p05-observations.json](./p05-observations.json) | native draft、sink、revision、conflict、caret、reset |
| [counterexamples.test.mjs](./counterexamples.test.mjs)、[counterexamples-observations.json](./counterexamples-observations.json) | 単純案と一般化した保証を破る browser 観測 |
| [counter-kernel.mjs](./counter-kernel.mjs)、[counter-observations.json](./counter-observations.json) | 一つの counter に通した actual engine の証拠 |
| [browser.mjs](./browser.mjs)、[browser-harness.mjs](./browser-harness.mjs)、[run.mjs](./run.mjs)、[vitest.config.mjs](./vitest.config.mjs) | 固定 SSR fixture、実 browser、bundle と実行手順 |
| [history/](./history/) | 初期の失敗ログ、観測 JSON、reset microtask 版のソース snapshot、47-case baseline、coordinator review の red-before-fix 証拠 |

最初の実行では reset microtask の欠陥に加え、native/controlled の sink 呼び出し数を二回とした test expectation が失敗した。
実 browser は input 以外に change と blur を届けたため、回数だけでなく operation reason を確認するように test を修正した。
次の実行では next-task reset の観測を待っていなかったことと、moveBefore が selection を保存するという誤った expectation が失敗した。
reset は deferred task を待つ test に修正し、selection loss は counterexample として残した。
terminal phase の追加 test は cleanup に渡した配列への参照を保持して順序を誤認したため、test 側で snapshot を保存するように修正した。
これらの失敗を [first-run.log](./history/first-run.log)、[second-run.log](./history/second-run.log)、[terminal-phase-first-run.log](./history/terminal-phase-first-run.log) に残している。
history 内の kernel は参照用 snapshot であり、現在の実行 entry point ではない。

新 Dispatch の変更前に、47-case の source、test、bundle、provenance、README、観測 JSON、ログを [coordinator-review-baseline/](./history/coordinator-review-baseline/) にコピーした。
追加した六つの test の red run は 53 件中 5 件が失敗し、trusted pre-admission edit の区別を確認する一件は baseline のまま成功した。
gate、partial-write path、counter failure identity、disposed retry、postcommit error 分離の失敗を [coordinator-review-red-latest-run.log](./history/coordinator-review-red-latest-run.log) に保持した。
修正後も従来の assertion を残し、同じ全 suite を実行した。

## 未検証の保証

CompositionEvent と InputEvent の composition 系試験は synthetic dispatch であり、観測した composition event の `isTrusted` は false である。
OS の日本語 IME、candidate window、native composition session の継続を検証していない。
実 browser を使ったことから native IME proof を導けない。

複数 browser、モバイル input、selection direction、Shadow DOM、nested form、textarea、contenteditable、checkbox、select、file input、radio group は対象外である。
P04 の custom extent publisher は package の production reconcile を置き換えるパッチではない。
同じ association object の WeakMap は logical response ID の認証や replay prevention の proof にならない。
staging の同時 admission が reservation を共有して待つ経路は、この synchronous kernel では未実装である。
module linker、parser purity、server emission、ownership authority、transport、scheduler と receive ordering、公開 phase facade の全体は未統合である。
この task は実験ファイルだけを作成し、production API、Accepted ADR、package SPEC/tests、GitHub、manifest、lockfile、既存 dirty file を変更していない。

archiveでは生成browser bundleを除外し、runnerで同じsourceから再生成する。
歴史snapshotのbundleも除外しており、baseline sourceと当時のprovenance、観測、raw logを保持する。
依存とbrowserの準備は [共通README](../README.md) を参照する。
