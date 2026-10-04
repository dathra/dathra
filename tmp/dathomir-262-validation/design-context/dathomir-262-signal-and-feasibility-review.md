# #262 / PR263 Signal 判別と実装成立性の限定レビュー

2026-10-05。直接割当 B/C、GPT-6.1 Sol high。
担当成果物はこのファイルだけである。
API 数の削減 A は lead の担当であり、このレビューでは独立に判別契約と成立性を判断する。
利用者による採用、①完了、Accepted ADR の変更、実装開始を意味しない。

## 推奨

Signal の constructor 真正性は、現在の採用済み契約を成立させる必須条件ではない。
信頼する作者コードの公開構造プロトコルを transfer の入口に使い、通常の `signal`、統合戻り値、復元後の owner/lease による書き込み制御を維持する案を推奨する。
ただし R2 の「plain prototype と own getter」は既存 SPEC の保証ではないため、推奨する protocol から除く。
完全な protocol 偽装を区別しないことは新しい未採用判断として明記し、constructor provenance を求めるなら engine の追加 introspection scope を明示して別案を採る。

成立性は既存 engine の同期通知、Object.is、cleanup を利用できるが、新しい admission、capture、writer、lease の成立を既存テストから導けない。
特に receive の失敗時表示保持には、`batch` と別の publication gate が必要である。
タイマーの最後の resource を発火前に解放すると callback 自身が失効するため、callback 実行中の pin が必要である。
以下の七つの小さな proof slice を依存順に提案する。
今回は source と契約を調べただけで、slice は実行していない。

## 正本と確認した証拠

優先順位は今回の利用者指示、[最新決定メモ](dathomir-262-section1-review-status.md)、[R2 全体案](dathomir-262-full-authoring-review.md)、Accepted #253/#260、canonical #262/PR263、package SPEC/tests の順である。
R2 の新しい細部を利用者決定に昇格させない。
メモの「①以外に進まない」は今回の明示的な全体レビュー許可によって範囲だけ更新されており、①の完了条件は維持する。

| source | 今回の確認と証拠の限界 |
|---|---|
| global/repo `AGENTS.md` | effective rules を再読。日本語、実用性、Accepted 保持、独立成果物、直接 terminal 報告を適用 |
| `japanese-tech-writing`、repo `dathomir-proposal-decision` | 再読。日本語の資料と read-only 設計レビューに適用。canonical admission/更新は実行しない |
| exact Orca の `skills get orca-cli` / `skills get orchestration` | 読込済み。relay handshake `0.1.0+713c81fdef1a`。直接割当のため lifecycle message は生成しない |
| canonical #262 | `proposal-262-authoring-api` の `SPEC/proposals/245/262/262.typ` と examples の stubs/assertions を読んだ。既存 canonical は occurrence/state/role filtering の旧レビュー形で、新しい flat/unified 形の実装証拠ではない |
| Accepted #253/#260 | 前割当で取得済みの正本を保持。immutable association、preflight/acquisition の失敗区分、no replay、fresh identity、独立 owner、engine observable semantics を変更しない |
| [Signal SPEC](../packages/reactivity/src/signal/SPEC.typ)、tests、[public types](../packages/reactivity/src/types/index.ts) | value/set/peek/tag、Object.is、同期通知、readonly value が正本。constructor predicate、prototype、own descriptor の配置は契約にない |
| computed/effect/createRoot/onCleanup/batch/templateEffect の SPEC と関連 tests | computed は別 tag と read-only API。templateEffect は root に自動登録、通常 effect は自動登録されない。batch は例外時にも変更を通知する。参照した tests は新 lifecycle の証拠ではない |
| [reconcile SPEC](../packages/runtime/src/reconcile/SPEC.typ)、関連 tests | Node 一個/項目の keyed reuse/reorder を検証。SSR adoption、persistent fragment、child owner permission は検証対象外 |
| [attr SPEC](../packages/runtime/src/dom/attr/SPEC.typ)、関連 tests | setProp の value/checked 代入を検証。adoption revision、IME、caret、first refresh の安全性は検証していない |
| core/reactivity exports | 現 checkout に defineClient/clientModule/defineCreatedComponent/isSignal の production export はない。新 API の fixture には提案宣言または限定 kernel が必要 |

現在の checkout は `49b1adf`、canonical PR branch は取得済み `0ad07bffd601fef7cd708276942b187883ea787e` を読んだ。
今の GitHub head/merge 状態を新しく問い合わせたとは主張しない。
既存の `.opencode/plugins/format-lint.ts`、`AGENTS.md`、`mise.toml`、`session-ses_f959.md`、他の tmp を変更しない。

## B 原子的な判別判断

この B01–B09 は今回新しく整理した番号であり、過去の②以降の見出しではない。
すべての推奨細部は提案で、runtime 保証は未検証である。

| 番号 / source requirement | 問い | 推奨契約と具体例 | 最も強い代案と理由 | edge / failure | 状態 | owner / proof gate |
|---|---|---|---|---|---|---|
| B01 / A03、メモ1.6、Accepted260 | native constructor 真正性が必要か | 必須にしない。trusted author protocol を slot 宣言として解釈し、browser では native `signal(capturedValue)` を作る。origin の真偽と owner authority を分ける | private engine predicate は native だけを許す product 契約なら正確。新たな scope 許可と複数 copy 方針が必要 | native 判定に成功しても payload、proxy、作者関数、権限が安全とは限らない | 未採用推奨。ordinary signal/unified return は利用者決定 | coordinator/user：構造か provenance かを採用判断。#248/#249：P03 |
| B02 / A03、Signal SPEC、R2 1.1 | protocol を current object layout に固定するか | 固定しない。data descriptor の tag=`signal`、callable set/peek と value property の存在を公開 structural profile とする。own/inherited と plain/class の差で排除しない。判別時に value getter/peek は実行しない | R2 の own-only profile は安易な衝突を減らし検査が簡単。ただし公開 SPEC にない配置制約で正しい wrapper を落とす | tag/method が accessor の wrapper は判別時に実行せず明示 adapter へ案内。setter の有無で TS readonly を真正性判定しない | 新しい transfer profile の提案。engine の既存仕様とは区別 | #262 profile 判断、#248 descriptor walk、P03。prototype chain は cycle guard/有限検査 |
| B03 / A03/A06/A55 | false positive/negative は何を壊すか | tag だけなら ordinary data。`{__type__:"signal",value:7}` は readonly record。完全 protocol は作者が slot と宣言したものとして capture する | nominal 判定は同名 protocol DTO の取り違えを防ぐ。native-only 要件が出た場合に選ぶ理由になる | 完全偽装は slot 化で余分な data を失い、悪い peek は副作用/throw。recognized slot にはこの解釈を診断できる名前/path を持たせる。未知 accessor を評価して候補探しをしない | 偽装非排除は未採用の明示的弱化。安全性の証明ではない | #248 validation、P03。ambiguous 作者値は ordinary DTO 化または明示 adapter |
| B04 / A03/A06、Accepted260 | trust boundary はどこか | server が実行を許した作者コード内の protocol に限定。request/delivery の外部入力は validator を通した data。受信 JSON の tag から executable protocol を復元しない | constructor-only は供給 package の provenance を狭められるが、作者コード全体の sandbox にはならない | proxy descriptor trap、getter/method は作者の実行能力。悪意ある object の停止/無副作用をこの判別で保証しない | 提案。外部認証/validation 境界は Accepted を保持 | #248 auth/capture。P03 は trusted path のみ。sandbox は今回範囲外 |
| B05 / A03/A13、Signal/computed types | duplicate copies と computed は同じ slot か | 同じ public profile の異なる engine copy の Signal は受ける。computed は mutable slot に変換しない。derived 値が必要なら server は明示 snapshot DTO、browser は restored source から computed を定義する | nominal predicate を各許可 engine copy の registry へ照会すれば native-only を保てる。解決済み copies の明示 inventory が必要 | single-copy WeakSet は別 ESM/CJS/copy の正当な signal を false negative にする。computed を signal とすると dependency semantics を失う | 同 copy/計算値の扱いは提案。ordinary Signal 方向を保持 | #247 engine profile、#248 capture、#249 restore、P03 |
| B06 / A03、#247 non-goal、Accepted260 | nominal introspection は engine semantics の変更か | constructor 登録と `isSignal` は additive introspection と評価する。通知/Object.is を変える必要はないが、engine 内変更なので現在の scope のまま実装しない | 許可された engine scope で private registry を入れる案はもっとも強い provenance。非 forgeable 判定を本当に要求する場合の第一候補 | global public Symbol brand だけでは真正性にならない。duplicate copy の registry 合流を dedupe 前提で隠さない。Accepted を変える必要があるかは新案の意味差分で判断する | discussion のみ。engine modification は未認可 | coordinator：scope 判断。engine owner：Signal SPEC/tests から追加 predicate を設計、P03 を拡張 |
| B07 / A03/A06/A56 | existing-engine 外部 adapter だけで nominal 判定できるか | 外部 adapter は protocol/codec 境界として用意し得るが、ordinary signal の constructor 真正性を後付け保証したとは言わない。通常 profile の fallback でよい | 作者が登録 wrapper constructor からだけ作るなら外部 WeakSet provenance は正確。ただし既存 ordinary imports を網羅しない | `signal(7)` を毎回 register させる主 API は利用者決定に追加負担。production 内部 layout 探索を adapter に隠すのも durable contract でない | 拡張 seam の提案。public adapter API の綴りは A 担当へ委ねる | #247 extension、#248 recognition。computed/第三者の実要求が出たときのみ限定 profile fixture |
| B08 / A05/A39、Accepted260 | aliases と ownership を predicate が解くか | object identity ごとに一度 capture。`{a:s,nested:{b:s}}` は一 owner の一 slot、同値別 Signal は別 slot。異なる owner の同一 s は両 path を示して拒否 | adapter が明示 stable identity を返すなら wrapper alias を保持できるが、別途 identity contract が必要 | payload equality、business `_key`、module ID を slot identity に使わない。二つの wrapper が同じ underlying slot でも自動共有と推測しない | same-owner alias は提案、implicit cross-owner sharing 禁止は Accepted | #248 collector/#249 restore、P03 |
| B09 / A04/A42、メモ1.6、Signal SPEC、R2 1.2 | Signal payload readonly は決定済みか | 決定済みではないが、owned context の payload を readonly にする明示 profile を推奨。native engine は変更しない。updater の previous は readonly view、同一 view を返すと native original に戻して Object.is no-op。record replacement で実用的 nested state を支える | 全 nested mutation を lease-aware proxy で監視する mutable profile は通常 T に近い。ただし setter 引数の外部 alias まで管理しなければ late-write を止められない | raw payload を露出すると `.set` guard を bypass。deep proxy/freeze/argument isolation は context の新契約であり、普通の Signal<T> と全点で同一だと主張しない | readonly payload profile は未採用推奨。plain return container readonly は利用者決定 | #247 projected type/#249 facade、P01/P03/P07。engine の追跡/通知は保持、author projection の意味差分は明示 |

### 構造案の具体的な判別手順

1. 正規の transfer walk で候補 object の descriptor を調べる。
   public tag/set/peek/value は prototype 上でもよく、取得のため getter を呼ばない。
2. data tag と data callable methods を満たす候補を、この transfer profile の Signal とする。
   value は存在だけを確認し、descriptor の getter/own 配置や setter absence を native 証明に使わない。
   method accessor など判別に実行が必要な wrapper は明示 adapter を求める診断を出す。
3. object を capture map へ登録し、trusted `peek.call(candidate)` を一度呼ぶ。
   有限 data domain と alias を検証して snapshot を確定し、template と handoff に同じ snapshot を渡す。
4. malformed/throw は response publication 前の server error にする。
   invalid association の browser fallback や initializer replay に変換しない。
5. browser では snapshot から native slot を owner ごとに一度作り、公開 mutation facade は invocation の phase/lifetime/generation を検査する。

この profile は既存 TypeScript interface のすべての構造実装を自動認識する契約ではない。
プロパティを accessor で提供する実装も型として可能なので、profile と adapter の境界を document に明記する。
nominal を採用する場合も payload validation と owner restoration は同じように必要である。

## C 今修正すべき成立性の論点

| 番号 / source requirement | 問い | 推奨契約と具体的遷移 | 最も強い代案と理由 | edge / failure | 状態 | owner / proof gate |
|---|---|---|---|---|---|---|
| X01 / A35/A44、R2 3.3/4.3、batch SPEC | receive が書いた後 throw しても表示を保てるか | receive の model changes は rollback しない。write を trigger しても child binding は plan だけ作り、receive 成功後に publish。失敗した causal attempt の pending plan は捨て、lastAttempt を記録する | shadow model 上で受けて成功時にまとめて commit は強い atomic model。ただし ordinary Signal/reference semantics まで別に定義する必要がある | `batch(()=>{s.set(1);throw e})` は flush する。batch だけの実装は last committed display 保持と両立しない。次の healthy attempt が部分変更済み model を読むことは明示する | 必要な実装構造の提案。failure contract は未検証 | #249 writer/receive、P06 |
| X02 / A41/A42、R2 4.2 | 最後の timer resource 発火で callback が失効するか | timer handle を ledger から外す前後に invocation pin を保持し、token check→callback→finally pin release。`settled && resources=0 && pins=0` で lease close | callback を独立 owned invocation に移譲する案も成立し得るが token と親 channel の transfer contract を増やす | resource 除去直後に close してから guarded callback を呼ぶ実装は正常な Copy timer の `.set` を落とす | 提案。R2 に順序が未規定 | #249 leases、P07 |
| X03 / A41/A42、createRoot/onCleanup SPEC | engine root だけで resource lifecycle を実装できるか | templateEffect は child root、通常 effect stop は明示 ledger 登録、timer/subscription は lease に登録。await 後の新規 acquisition は context の explicit liveness gate を使う | すべての実 resource を public onDispose に明示する方式は簡潔だが、callback の generation guard は別途必要 | root dispose は raw effect、fetch、native subscription を自動停止しない。synchronous subscription callback が disposer return より先に来るなら provisional acquisition が必要 | engine の既存挙動は SPEC/tests 証拠、新 ledger は未検証 | #249 resource adapter、P07 |
| X04 / A07/A20/A21、R2 1.7/2.3/2.4 | pre-admission draft と auto first refresh が衝突するか | provisional slots に latest native draft を採用し、commit 直前 revision を再確認。content の first refresh は実行し、control の異なる formatter write は composing/unknown/dirty policy で保留する | native-owned draft を blur/submit で commit は実用的で未知 composition を減らす。reactive peers が必要な場面の代替には一律にしない | native edit を SSR default に戻す rollback は禁止。未知 composition に synthetic event の isComposing だけで過去の履歴を捏造しない。listener reread だけでは新 revision の優先規則が未完成 | 利用者 first refresh 方向を保持、draft policy は提案 | #249 control transaction、#251 実 IME、P05 |
| X05 / A33/A34/A38、R2 3.2、Accepted no replay | SSR retained child を creation factory で補修するか | SSR では immutable permission/parser/seed/slots の復元のみ。factory initialize/view は absent token の新 child だけ。adoption mismatch は preflight reject | 親 keyed model は独立 child lifetime が不要なら簡単。ただし autonomous rows の削除/再追加を別意味に変えない | old reconcile の one-Node key ledger は factory permission、persistent multi-node extent、independent child rollback を証明しない | Accepted 境界を保持、新 creation ledger は未検証 | #248 association/#249 creation、P04 |
| X06 / A04/A42、B09、Accepted generation | raw object alias が late model write を逃がさないか | owned payload は readonly view。`.set(object)` は owned data として入力 alias を隔離し、updater の同一 previous は native identity に戻す。この projection を explicit context contract とする | mutable proxy は direct edits を保持できるが caller が setter 引数の raw object を後で触る問題が残る。完全 membrane の別 proof が必要 | `const x={n:1};ctx.values.s.set(x);dispose();x.n=2` が owned model を変えるなら generation gate が破綻。readonly facade の説明だけでは防げない | 新 profile の提案/未検証。engine semantics と context semantics を混同しない | #249 facade、P03/P07。nested useful state は immutable replacement で支持 |

## C 七つの最小 proof slice

以下は実行提案であり、今回の許可は実行を含まない。
各 slice は一つの小 fixture と固定 trace に限定する。
提案 kernel を使う場合は「その kernel による契約の実現可能性」までを証拠とし、production API の証明へ昇格させない。
現在の旧 stubs は role filtering と state/values 分離を含むため、P01 の証拠に再利用しない。

### P01 名前、値型、type-only cycle

- **source / 問い**: A02/A04/A08–A11/A45、メモ1.2/1.6。完成 component 型の循環を避け、flat names と Values を実際に表現できるか。
- **推奨と fixture**: prepare.ts、counter.server.ts、counter.client.ts、assertions.ts の四 source。prepare が `{count:signal(7), title:"Counter"}` を返し、client は `ClientContext<ReturnType<typeof prepare>>` を type-only import、server は type-only default と accepted 二引数 clientModule を使う。`bind("increment")` と `on("click","countText")` を型として許す。
- **実 API / stub の区分**: native Signal<T> は actual package type を import。defineClient/defineComponent/clientModule/ClientContext は提案する最小 public declarations であり、runtime stub に安全性を任せない。strict/noImplicitAny、宣言出力も確認する。
- **pass**: count.value/peek/updater は number、plain title と container replacement は readonly error、nested payload/updater previous の直接 mutation も profile の readonly error、typo 名は error、両 helper は全登録名を許す。server 完成 Component の型を client が import せず public declarations が有限に出る。path mismatch は TS だけで検出したとしない。
- **fail と変更する判断**: contextual typing を後付け推論できない/循環 error/any 漏れなら、独立 prepare type の明示注釈を正式推奨に固定。値型を手書きする最強の代案は循環を切れるが二重記述が増える。候補を role filtering に戻して逃げない。
- **edge / 状態**: JS は型証拠対象外、cast は runtime gate を省かない。仮型の通過は型面だけの proof。未実行。
- **owner / gate**: #247 public type owner。P02 の build graph へ進む前の型成立条件。

### P02 emitted server/browser graph と zero-root

- **source / 問い**: A02/A10–A13/A34/A53/A54、Accepted260。型だけの import、runtime literal reference、deployment relocation が同時に成立するか。
- **推奨と fixture**: 同じ四 source に server secret sentinel、browser-only top-level sentinel、neutral input parser を一つ追加し、static route を一つ置く。通常 browser/server bundler の二 entry と最小 reference collector/manifest adapter で emitted graph を確認する。literal `clientModule<typeof Client>("./counter.client.js",import.meta.url)` を使用する。
- **実 API / stub の区分**: actual selected bundler/compiler を使用。collector、facade siblings、module wrapper が未実装なら限定 adapter と明示する。ブラウザ export を偽の空 stub に置換して graph isolation が通ったとはしない。
- **pass**: browser emitted dependency graph に server module/secret がなく、server 実行時に browser top-level sentinel が走らない。neutral parser は両 graph から同じ定義に対応する。source ref と emitted URL が manifest で解決する。型と literal を意図的に別 default にした negative は collector diagnostic。static route は client entry 選択なし、実 response は bootstrap/handoff/activation marker/artifact ref がない。
- **fail と変更する判断**: type witness と literal の対応を確認できないなら #247 が syntax-aware collector を持つか、明示 catalog を strong alternative として判断する。module value import や server secrets の tree shaking へ戻さない。collector は専用 author compiler とは区別する。zero-root 不成立なら選択と出力を別 gate として修正する。
- **edge / 状態**: sentinel 無しだけでは graph proof でない。dynamic import/side effect graph も列挙する。別 route の cached artifact の存在は response capability と区別する。未実行。
- **owner / gate**: #247 build/#248 output、P01 後。一 bundler と一 output deployment layout まで。他 adapters 全般は証明しない。

### P03 capture、recognition、alias と復元

- **source / 問い**: A03–A07/A39、B01–B09。snapshot と facade が ordinary Signal semantics を保ち、DOM と handoff を同じ値から作れるか。
- **推奨と fixture**: actual native `s=signal({n:7})` を nested alias で返す。別 Signal を同値で返す。capture 後に server s を `{n:8}` に更新し、captured template と decoded handoff を比較する。二つ目の module copy、computed、tag-only record、inherited-method wrapper、full protocol fake、throwing peek、cross-owner alias を小さい固定入力 corpus にする。
- **実 API / stub の区分**: signal/computed/effect/batch は actual exports。collector/codec/facade は提案の限定 kernel。engine constructor layout に private access しない。認識時に value/peek を触った回数を fixture logger で記録する。
- **pass**: tag-only は readonly data、full protocol fake は structural 案では recognized と明示、computed は mutable restore されない。capture は Signal 一 object あたり一 peek、template/handoff とも7。browser aliases は同じ slot、同値別 slot は別、server と browser は別 memory。native facade の `.set(previous=>previous)` は Object.is により再通知なし、同一 owned value の peek/value は同じ view、value は tracking/peek は非tracking。setter に渡した外部 mutable record の後続変更は owned value に漏れない。cross-owner alias/throw は publication 前 error。
- **fail と変更する判断**: facade で same-previous no-op/notification が変わるなら view-to-native identity の対応を修正する。readonly projection が外部 alias mutation を止めないなら X06 の入力 isolation を必須にする。正当 copy/wrapper が落ちるなら B02 profile または explicit adapter を改める。full spoof 排除を product requirement にするなら structural pass を十分とせず B06 の expanded nominal scope へ移る。
- **最強代案 / edge / 状態**: nominal は origin を強め、complete mutable membrane は payload mutation を許すが、それぞれ明示 scope/意味差分が要る。input snapshot projection の契約外で元の mutable reference と同じ観測を約束しない。snapshot 時点を跨ぐ任意作者副作用に対する全体 atomicity は約束しない。未実行。
- **owner / gate**: #248 collector/#249 facade。P01 の actual T を使用。P04/P05/P06 の state fixture より先に行う。

### P04 SSR adoption、_key、fragment と child-local state

- **source / 問い**: A14–A16/A28–A40、X05。no replay のまま keyed local state と persistent range を支えられるか。
- **推奨と fixture**: SSR の二行 a/b、各行は input と label の二 node extent、local draft と独立 token。a を編集して `[a,b]→[b,a]→[b]→[b,a]` を行う。SSR association に actual factory identity/seed/receiver/parser を入れ、initializer/view/cleanup/node-write counter を置く。空 bind と same-key changed-tag、duplicate key、wrong factory の negative を固定 trace に加える。
- **実 API / stub の区分**: native DOM と actual Signals は実 API。persistent description ledger/admission/factory resolver は限定 kernel。既存 reconcile は比較対象であり adoption stub の中に「採用成功」を直書きしない。fragment は提案、_key/pure el は利用者方向。
- **pass**: SSR restore の initialize/template replay は0、same-key compatible reorder は同じ local state/token/extent。removal は child/resource を一度停止し、re-add は fresh token+initialize一回。fragment の両 node がまとまって移り key は HTML に出ない。duplicate/wrong permission は DOM/resource acquisition 前に error。independent admitted child を parent rejection の rollback へ巻き込まない。空内容でも declared bind extent が残る。
- **fail と変更する判断**: multi-node extent が ambiguous なら persistent fragment ledger を修正し、合法な wrapper を strong alternative に提示する。new state が毎 producer evaluation で作られるなら lazy intent→membership staging を必須化する。SSR mismatch を fresh creation で補修して通さない。
- **edge / 状態**: DOM logical identity の通過だけで focus/IME/Web Component physical move を保証しない。composition 中の move は保留を検証し、native state-preserving move は選んだ host の別証拠が必要。未実行。
- **owner / gate**: #248 metadata/#249 reconciliation、P03 と P02 の resolver 前提。F/T/M pressure。二行 fixture のみ。

### P05 admission 前の edit、IME、caret と first refresh

- **source / 問い**: A15/A17–A27/A30、X04、利用者 first refresh。current native state を保護しつつ初回自動表示を行えるか。
- **推奨と fixture**: SSR draft="a"、bootstrap 前に native value="あ"。input/selection、composition known/unknown、同 group の二 control を持ち、provisional listener registration 後に native edit を一回挿入する。server content `Count:7` と client `Count=7` の binding も同 fixture に置く。reset を一回含める。
- **実 API / stub の区分**: real browser DOM/event/default reset と actual Signals。proposed sink/revision/admission/writer は限定 adapter。synthetic composition は phase trace の proof に限る。実 IME は選択 OS/browser の一手動ケースを別記録する。
- **pass**: draft 採用と commit revision check が最後の edit を使う。content binding は commit 後自動で Count=7、同値 control write は0。unknown/composing の異なる formatter value は保留し、observed boundary 後に選択 policy で反映する。group の異なる値は hold、同値は採用。admission throw は current native edit を保ち provisional state/resources を捨てる。uncanceled reset 後のモデルと defaults が一致する。選択と focus を保つ同値 case を記録する。
- **fail と変更する判断**: overwrite/二重 sink/selection loss なら revision gate または prop adapter を修正。per-key formatter は mapping proof がなければ blur/submit に移す。native-owned draft が strong alternative。自動 first refresh 自体を click 待ちへ変更しない。
- **edge / 状態**: 実 IME を再現できなければ未知として hold の設計証拠だけ残す。a11y/checkbox/radio/select/file/native submitter の全保証はこの fixture から出ない。契約は58項目に残す。未実行。
- **owner / gate**: #249 controls/#251 browser、P03 と P04 retained-node policy の後。F first、C/T peers、M reset。real IME 一環境まで。

### P06 receive の収束と失敗時 publication

- **source / 問い**: A35/A39/A44、X01、R2 3.3。parent tracking を漏らさず、等値抑止/最新値/failed attempt を区別できるか。
- **推奨と fixture**: parent Signal input と child draft/error の二 Signals。child receive は draft を読む。SSR seed same→equal-new-object→changed B→pending C/D→write then throw→explicit retry を一 trace にする。framework-known upward echo で B→A→B の causal cycle を一つ加える。
- **実 API / stub の区分**: actual templateEffect/batch/Signals の同期通知を使う。parent completed callback 後 queue、causal token、publication gate は限定 kernel。engine 内部の untrack を追加しない。receive 中に DOM を直接書いて通さない。
- **pass**: SSR seed 同値 receive0、record-order差の同値0、changed一回、pending はlatest Dのみ。child-only draft edit で parent producer の依存が増えない。write-then-throw は model mutation を保持しつつ当該 plan のDOM publication0、last committed display維持。同じ failed input の自動再実行0、明示retryまたはchanged inputで再実行。disposed tokenのdelivery0。cycleはbounded diagnosis、JS loopしない。
- **fail と変更する判断**: failure が DOM を出すなら X01 の separate writer gate を入れる。依存漏れなら receive を parent tracking 完了後へ移す。causal coalesce が成功済み input と failed input を混同するなら applied/lastAttempt/pending の三状態を分ける。strong alternative は transactional shadow receiver だが独立 model contract が増える。
- **edge / 状態**: 外部 async echo 全体の因果推定や arbitrary synchronous author loop の停止は保証しない。framework queue に work quota を設け、新 user event は別 causal turn。partial model の次の healthy publication を万能 rollback と呼ばない。未実行。
- **owner / gate**: #249 receive/writer、P03 の facade と P04 child token 後。C/M/T/L pressure。

### P07 timer、subscription、late write と channel isolation

- **source / 問い**: A37/A40–A48/A55、X02/X03、D/B/M/T/L。settled operation の resource を生かし、終了した write を確実に止められるか。
- **推奨と fixture**: actual Signals/effect/templateEffect/root に小 lease ledger と deterministic scheduler を付ける。fulfilled Copy-like operation が timer を一つ残し、その最後の callback が status を戻す。同期 callback を返す subscription を一つ登録し、dispose後に保存 callback を呼ぶ。channel queryはreplace、saveはparallelとし、deferred completionを新→旧の順でresolveする。cleanup throwを一つ入れる。
- **実 API / stub の区分**: actual engine の停止/通知、deferred Promise は実 JavaScript。onDispose/timeout/guard/tokens は提案 kernel。clipboard/network はこの trace では stub。実 Copy 成功失敗や EventSource の host behavior を証明しない。
- **pass**: Promise fulfilled後のtimerでwrite一回、callback最後にlease閉鎖。callback が Promise を返すことを許すなら pin は settle まで保持し、許さない場合は同期 callback 契約を診断する。replace/dispose後のold callback/Promiseのmodel+DOM write0。parallel saveはquery replaceで失効しない。外部 setter argument alias による disposed model の変更も0。ordinary effect stopは明示され、templateEffect/rootだけの取り残しをしない。同期source発火はprovisional acquisitionへ属し、失敗ならreturned disposerを一度呼ぶ。token失効→contained resources→shared stateの順、cleanup throwでも残りstop。一つのrelease/cancelを二回呼んでもstop一回。
- **fail と変更する判断**: last timer writeが落ちるならcallback pinを採る。late-writeが通るならraw captured mutable Signalを渡さずinvocation facadeを閉じる。parallelまで止まるならowner世代とchannel/lease世代を分離する。strong alternativeはすべてowned result publicationへ戻す方式だがnative subscription callbackの所有登録は残る。
- **edge / 状態**: abortはserver mutation undoでない。joinはpendingだけ、queueはPromise settleで進めると文書化し、長寿命subscriptionにqueueを永久阻止させない。clipboard、actual source close、history/transportは別の選択host gate。未実行。
- **owner / gate**: #249 leases、P03 write facade 後。P01/P02 と独立に ledger のモデル検討は可能。

## 依存順、上限、coverage

最初の実行許可を得る場合は P01 と P03 の二 slice までを推奨する。
型と普通の Signal semantics が成立しない段階でブラウザ fixture を広げない。
その後は P02、P04、P05、P06、P07 の未解決 gate のうち実際に採用する contract を判断するものだけ選ぶ。
全七 slice は一回の固定 trace、失敗時の修正後再実行は一回までとし、未解決なら原因と契約の選択肢を戻す。
これは実験実施の承認ではなく、bounded plan の提案である。
performance、全 bundler、全 browser、全 codec、全 native widget の campaign は行わない。

| retained A questions | この B/C 割当の対応または明示 scope 外 |
|---|---|
| A01 | 本文の非採用境界。最終 adoption は coordinator/user |
| A02 | P01/P02 |
| A03–A07 | B01–B09/P01/P03/X04 |
| A08–A13 | P01/P02。API surface 削減は A 担当 |
| A14–A16 | P04/P05、既存 admission terminality 保持 |
| A17–A22 | P05/P07。event options 全種の動作は本小 fixture の証明外 |
| A23–A27 | P05 に reset/selection の圧力。a11y、numeric parse、radio/select/file/submitter は既存契約を保持し、選択 control adapter の別 gate。今回その実装 proof は対象外 |
| A28–A34 | P02/P04/X05 |
| A35–A36 | P04/P06/X01 |
| A37–A40 | B08/P03/P04/P06/P07。borrowed owner surface の簡素化は A 担当 |
| A41–A44 | X01–X03/P06/P07。外部 damaged DOM の全 recovery と全 widget は別 #249 gate |
| A45–A48 | P01/P07 の typed request/channel/late-write。server auth、mutation command id、unknown outcome retry の実 transport proof は #248、今回対象外 |
| A49–A52 | P02/P04/P07 の fresh identity/authority/generation が前提。destination/history/pop/bfcache/stream の product 契約は R2 保持。新 transport/history campaign は今回対象外 |
| A53–A54 | P02。static route selection と zero response output を分ける |
| A55–A56 | 各 negative の path/phase/recovery diagnostic。rich codec/native grant 全般の API 採用は A 担当/後続選択 gate |
| A57–A58 | 下表、実行なし、結果ごとの evidence level、coordinator への完了報告 |

58/58 の disposition を付けた。
今回その全項目の実装を証明したという意味ではない。
R2 の canonical 27/27 crosswalk をそのまま上位 constraint として保持し、原要件の削除/完了を宣言しない。

| 元の七 witness | 今回の decisive pressure | この slice が証明しない残り |
|---|---|---|
| F 編集/feedback | P05 の native draft/IME boundary/caret/reset、P07 late validation | actual Japanese IME host、a11y/native submitter、全 control adapters |
| C 別 package cart panels | P01/P02 package boundary、P03 alias、P04/P07 drawer cleanup、P06 explicit receive | 実 cart composition の全 authoring example。implicit mutable sharing は導入しない |
| B search/history | P07 replace race/abort publication、P02 code/authority | destination-first switch、pop URL、Back draft、bfcache の選択browser proof |
| D 実 Docs Copy | P07 fulfilled timer lease、P02 article static zero、P04 contained extent | actual Docs article/TOC/codeblock+clipboard success/error は前提 witness のまま。timer stub を実 Copy proof にしない |
| M multistep draft | P04 retain/re-add local state、P06 changed receive、P07 late validation | Next/Back checkpoint、server command dedupe/unknown outcome の two-step product trace |
| T editable table | P04 keyed two-node reorder/local draft、P05 control state、P06 remote dirty state | business/control/fresh-response identity の全 save/conflict flow、physical host move |
| L live source | P07 subscription lease/late callback、P06 input version convergence | actual version gap resync、snapshot request、source reconnect/close の選択transport trace |

不足を「unsupported」に変換しない。
この bounded evidence と、将来 product support を宣言するための witness proof を分ける。

## lead/coordinator に戻す具体的判断

1. B の推奨は trusted structural transfer profile。native constructor provenance が本当に要るなら expanded engine scope にして private registry、許可 copies、computed の扱いを別途採る。
2. R2 1.1 の own/plain/getter 条件は current implementation layout であり、public protocol 契約に置き換える。
3. R2 1.2 の Signal payload readonly は利用者決定でないが、late-write gate を守る owned context profile として明示して提案する。updater/view の identity と setter 引数の外部 alias isolation が必要であり、native engine 自体の仕様変更にはしない。
4. receive の failed attempt に対する DOM publication gate と、最後の resource callback pin を内部責務として追加する。
5. proof はまず P01/P03、続いて採用判断に必要な残り slice。source 読みだけで feasibility 完了にしない。

残る利用者判断は構造/provenance の scope 選択と immutable payload profile を追加するかである。
実装側の残る具体的質問は facade の T/identity 同等性、manifest relocation、SSR child resolver、native revision gate、receive writer gate、lease callback pin であり、それぞれ P01–P07 の pass/fail が判断を変える。
API 名の追加/削減判断と最終採用はこの担当では行わない。

## 実際に行った検査と delivery

実施したのは rules/skills と上記 source の限定再読、契約比較、固定 proof plan、58項目と七 witness の対応確認、Markdown/whitespace 検査である。
TypeScript、browser、runtime、Typst、build experiment は実行していない。
package tests は source として読んだのであり、新しく pass したとは主張しない。
変更した repository ファイルはこの割当 Markdown だけである。
Dispatch がないため lifecycle ID/worker_done は生成しない。

delivery receipt は送信後この末尾に記録する。

### lead delivery receipt

```json
{
  "role": "lead",
  "terminal": "term_c7ff7d7f-5f15-489e-a1e7-ef90ed2259b9",
  "exit_code": 0,
  "stdout": "{\n  \"id\": \"1f0eea8b-19c2-4bed-ba6f-cb4d043e03ea\",\n  \"ok\": true,\n  \"result\": {\n    \"send\": {\n      \"handle\": \"term_c7ff7d7f-5f15-489e-a1e7-ef90ed2259b9\",\n      \"accepted\": true,\n      \"bytesWritten\": 2412,\n      \"prompt\": {\n        \"requestId\": \"332cb6c9-edcd-4fba-81e1-6fa7512e1ad4\",\n        \"stages\": [\n          \"input_accepted\"\n        ],\n        \"provider\": \"codex\",\n        \"observation\": \"supported\",\n        \"processIncarnation\": \"dfeb53d0-8668-4f2e-848e-8a070337c7d0\",\n        \"generation\": 17,\n        \"baselineWorkingSequence\": 7,\n        \"baselineExplicitWorkingStartedAt\": 1791141458156,\n        \"baselinePermissionSequence\": 0\n      }\n    },\n    \"mutation\": {\n      \"requestId\": \"332cb6c9-edcd-4fba-81e1-6fa7512e1ad4\",\n      \"replayed\": false\n    },\n    \"warnings\": [\n      \"input was accepted but no turn start was observed, so the Enter may have been swallowed. Confirm delivery by reissuing the exact command with --retry-request 332cb6c9-edcd-4fba-81e1-6fa7512e1ad4 --wait-submit <seconds>; the same request ID replays the receipt instead of sending the prompt again.\"\n    ]\n  },\n  \"_meta\": {\n    \"runtimeId\": \"1ade07e0-5ede-479c-97ad-6b48b60c6753\"\n  }\n}\n",
  "stderr": "[relay-connect] Handshake OK at version=0.1.0+713c81fdef1a\n"
}
```

### coordinator delivery receipt

```json
{
  "role": "coordinator",
  "terminal": "term_5db51934-7dd7-406b-97eb-1456c9a07fda",
  "exit_code": 0,
  "stdout": "{\n  \"id\": \"ff001f33-7b10-4d1f-9612-3dde9e322af2\",\n  \"ok\": true,\n  \"result\": {\n    \"send\": {\n      \"handle\": \"term_5db51934-7dd7-406b-97eb-1456c9a07fda\",\n      \"accepted\": true,\n      \"bytesWritten\": 2412,\n      \"prompt\": {\n        \"requestId\": \"50f32246-f047-44ae-ba5d-9fd7d6b01390\",\n        \"stages\": [\n          \"input_accepted\",\n          \"turn_started\"\n        ],\n        \"provider\": \"codex\",\n        \"observation\": \"supported\",\n        \"processIncarnation\": \"6688810d-c15a-48ab-b545-d743d1a6e69a\",\n        \"generation\": 11,\n        \"baselineWorkingSequence\": 34,\n        \"baselineExplicitWorkingStartedAt\": null,\n        \"baselinePermissionSequence\": 0\n      }\n    },\n    \"mutation\": {\n      \"requestId\": \"50f32246-f047-44ae-ba5d-9fd7d6b01390\",\n      \"replayed\": false\n    }\n  },\n  \"_meta\": {\n    \"runtimeId\": \"1ade07e0-5ede-479c-97ad-6b48b60c6753\"\n  }\n}\n",
  "stderr": "[relay-connect] Handshake OK at version=0.1.0+713c81fdef1a\n"
}
```

### delivery の判定

coordinator は `accepted:true` と `input_accepted` / `turn_started` を確認した。
request ID は `50f32246-f047-44ae-ba5d-9fd7d6b01390`。
lead は `accepted:true` と `input_accepted` を確認し、10秒の観測では turn_started が出なかった。
request ID は `332cb6c9-edcd-4fba-81e1-6fa7512e1ad4`。
lead の受信開始やレビュー完了を証明したとは扱わず、重複 prompt は送らない。
coordinator の拒否/stale はなかったため terminal-list/retry は行っていない。
これらは terminal prompt の receipt であり、採用判断や Dispatch/lifecycle ID ではない。

文書検査は B9、X6、P7 の22項目、A01–A58の58/58 disposition、F/C/B/D/M/T/Lの7/7、row columns、fence balance、末尾空白を確認した。
既存 tracked dirty files の `git diff --check` も通ったが、そのファイルを本担当が修正したという意味ではない。
今回の bounded assignment は完了報告を配送した状態で、coordinator のレビューと追加の限定修正依頼に対応できる。
