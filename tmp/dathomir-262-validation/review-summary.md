# authoring案の追加検証から分かったこと

この文書は #262 の採用前レビュー資料である。
実行可能な証拠の保存は #264、APIの採用判断は #262 が所有する。
Accepted #253/#260 と production source は変更していない。

## 先に判断する範囲

利用者が選んだ書き方は維持する。

- サーバー側は `defineComponent({ client, server, template })`、ブラウザ側は別モジュールの flat な `defineClient({ countText, increment })`。
- `bind` と `on` の候補には登録された全関数名を出す。
- 独自query importを使わず、クライアント型と実行時module参照の二重記載を許す。
- `server()` はSignalと通常値を一つのrecordで返す。
- `bind` は表示位置の宣言とし、`server` に実際のSSR内容を渡す。
- 通常の一覧の保持条件は `_key` で表す。
- admission成功後に、一度だけ自動でbindingを更新する。

これらの表記を変えずに、型検査、書込み権限、DOM保持、ブラウザの入力を成立させる契約を調べた。
以下の推奨は新しい契約の採用ではない。
実験の合格も、フレームワークの実装完了を意味しない。

## 証拠が答える問い

| 証拠 | 答えられること | 答えられないこと |
|---|---|---|
| TypeScriptとJavaScriptの型検査 | この型宣言と例の組合せが成立するか、意図した誤用が拒否されるか | 実行時の同じmodule、DOM所有権、任意のconsumerへの適用 |
| 実Signal engineを使った限定kernel | capture、alias、失効、receive、leaseの特定の処理順序 | 提案API全体や実アプリへの統合 |
| 実browserの限定kernel | 指定したDOMと入力操作の結果 | OSの実IME、全browser、全Web Components |
| native formの観測 | browser固有の基準動作とadapterが守る条件 | 提案input adapterの完成 |
| 現行Docs Copyの観測 | 実consumerの現状と移行時の期待値 | 新APIによるSSR接続や移行の完成 |
| deliveryの状態モデル | 明示した状態遷移と応答順序での競合 | 実HTTP、history、DOM切替、認証、server mutationの冪等性 |

テスト数を足し合わせて「網羅率」と呼ばない。
不具合の観測テストが通った場合は、不具合が再現したという意味になる。

## Signalのcaptureとbrowser側の追跡

実Signal sourceを使った検証では、同じslotのaliasと一度のpeekを保持できた。
一方で、side effectを持つtrusted fakeのpeekは別のSignalを更新でき、captureした組合せがどの瞬間のlive stateとも一致しない反例が出た。
同じcaptured graphをtemplateとhandoffに使う整合性と、全状態を瞬間的に切り取る保証は別である。

browser側にも別の境界がある。
あるengineで作ったSignalを、独立bundleの別engineのcomputedで読むと、Signal更新後もcomputedが古い値を返した。
serverで複数copyのSignalをcaptureできることは、browserで複数engineの追跡がつながる証明にならない。
ownerとbehaviorが同じengine実体を使うbuild上の条件か、明示したbridgeが必要になる。
この結果はengineの既存SPEC違反ではなく、統合側が守る境界の証拠である。

## readonly型だけでは閉じられない経路

提案の `OwnedSignal<{ n: number }>` を既存の `Signal<{ n: number }>` 型の変数へ代入し、その変数から `value.n++` を実行するコードはstrict TypeScriptで受理された。
TypeScriptの構造的な互換性により、context上のreadonly指定を別のconsumerの型から回避できるためである。

directなcontext書込みを型検査で拒否することと、任意のconsumerへの代入を拒否することは区別する。
実行時のreadonly保護は引き続き必要であり、native Signalを前提にobjectを直接変更するconsumerでは例外になる可能性を明記する。
この観測を理由に、engineの型markerや公開APIを無断で変更しない。

## 同じ表示先を更新する通信

検索と履歴移動が別channelの場合、各channelの最新応答であっても、同じ表示先へ古い結果を上書きできる。
その反例と、表示先の世代を併用する案を [deliveryの実験](delivery-races/README.md) に残した。
39件には4応答の全24完了順序を含む。

replacement deliveryには、channelの寿命と表示先の更新世代を両方使う案を推奨する。
新しい要求が失敗しても古い要求を復活させず、現在の表示を維持して明示的な再試行を許す。
appendやmergeの規則は、この結果だけでは決めない。

destination検証中はsourceを維持する。
host commitの直前にsourceの更新権限を失効させ、commit後のhistory失敗やcleanup失敗を別々に記録する。
commit途中にDOMなどが部分変更された場合の全面rollbackは約束しない。
これはactiveな表示切替の検討であり、Accepted #260 の初期admission rollbackを弱める判断ではない。

モデルの表示先は互いに独立している。
祖先の表示切替が子の表示先も除去する場合、子のepochだけでは祖先の失効を表せない。
その場合はancestor lifetimeとの結合が必要だが、この39件では証明していない。

## 状態と寿命の61件で修正したこと

[state/lifetimeの実験](state-lifetime/README.md) は実engineと限定kernelを使い、strict TypeScriptと61件がarchiveでも通った。
P06のDOMはhappy-dom、timerの順序はVitest fake timersであり、実browser全体の証拠とは区別する。

| 修正前の反例 | 候補kernelで修正した点 |
|---|---|
| updaterで変更していないnested childまでcloneされ、computedが余分に通知された | owned nodeの再利用と、slotごとのinvocation内facade cacheを追加した |
| failed receiveでmodelだけ変わり、retryのsetterがno-opになると表示が古いままになった | successful receiveが依存再収集とpublicationのrefreshを起こすようにした |
| sourceを停止しても別resourceがleaseを生かすと、古いcallbackが書けた | source tokenとlease tokenを分けてsetterの権限へ結び付けた |
| 別realmのPromiseを同期結果と誤認し、callbackのpinやrejection観測が抜けた | thenを一度取得する観測処理をlease、binding、receiveで共有した |
| replace中の旧Aのcleanupから、まだ失効していない旧Bが書けた | 全旧権限を失効させてからabortとcleanupを呼ぶ二段階の候補を検証した |

receiveは同期のままで、Promiseを返した場合は失敗とする。
author callbackから戻った時点でinvocationの更新権限を閉じるため、native batchのflushやawait後の処理へ権限を持ち越さない。
replace中に再入した操作は最後のadmissionを優先し、外側へ返ったleaseが既に失効している場合は、dispatcherがbody実行前に再確認する。

これらは未採用のintegration契約である。
任意のthenable、外部native handle、無限再入、全schedulerをsandboxできるとは扱わない。
codecのfinite number制限、NaNの拒否、record列挙順の正規化も実験上の選択であり、native-equivalentなreadonly化と呼ばない。
標準JSの列挙順を保持する案はproduction側の有効な代案として残す。

## native formから追加する条件

[native formの9観測](native-controls/README.md) は、次の契約を具体化する材料になる。

1. `ctx.formData` は送信ボタンのsubmitterを扱う必要がある。
   `new FormData(form)`だけでは押したbuttonのname/valueを落とす。
   requiredとformnovalidateも維持する。
2. ラジオボタンのgroupはDOMの包含範囲と一致しない。
   別ownerのsectionやform外のcontrolでも、同じform/nameなら一方の操作が他方のcheckedを変える。
   shared formのownerまたは明示したgroup契約を設け、勝手に他ownerの書込み権限を取得しない。
3. live valueとreset baselineは別である。
   dirtyなvalueを維持しながらdefaultValueを更新でき、reset後は新しいdefaultへ戻る。
   resetイベント中は旧値を読むため、キャンセル結果とnative reset完了を確認してsinkへ同期する。
4. FormDataは複数の同名entryとFileを保持する。
   単純なobject化やSSR用JSONへの暗黙変換は情報を失う。
5. number inputの入力途中の文字列は、常にvalueから復元できるとは限らない。
   Chromiumでは `-` の入力時にvalueが空でもbadInputがtrueになる。
   完全な文字列draftが要件なら、text/inputmodeか専用adapterを比較する。

これらを理由にフォームを一律unsupportedにはしない。
通常のnative-owned formと、明示sinkを持つcontrolled inputの両方を残し、必要なcontrolごとに契約を定める。

## 実Docs Copyの移行条件

[実Docs Copyの観測](docs-copy/README.md) では、SSRの既存code blockはクリックしてもclipboardを呼ばなかった。
これは #252 S-07 の既知の接続不足と一致する。
新しくbrowserで生成した同じコンポーネントでは、Clipboard APIがなくても、Promiseがrejectしても `Copied!` を表示した。

移行後の成功表示はclipboard Promiseの成功後に限る。
失敗時やAPI不在時には、手動選択などの回復手段を出す。
成功後の表示用timerはoperationのPromise完了後も生存し、hostの削除時には失効する必要がある。
連打後の前timerとhost削除時の最終timerの解除は、現行consumerの限定経路で観測できた。
新APIのlease証明と、この実consumerの移行証明は別々に必要になる。

## Backとdraftの復元

[native historyの3観測](native-history/README.md) では、同一documentのBackはURLとstateを戻しても、applicationが更新したDOMを元に戻さなかった。
history.stateは保存時のcloneであり、後から変更したdraftを自動では追跡しない。
関数を含むstateはDataCloneErrorとなった。

したがって履歴宣言には、確定queryか未完draftのどちらを保存するか、どのDTOからfreshな表示を作るかを明記する。
この結果だけで一律のdraft保持policyや、cross-document BFCacheの扱いを決めない。

## 採用済みの意味を守る境界

- preflightの再試行は同じimmutable associationを維持し、外部prerequisiteの回復を待つ。
  同じidentityのpayloadやtargetを修正して通す扱いにはしない。
- acquisition後にterminalとなったidentityを再利用しない。
  Backや再追加で必要ならfresh identityを使う。
- 初回接続にSSR templateやinitializerを実行しない。
  admission成功後の初回binding更新と、admissionそのものを分ける。
- batchはtransactionではない。
  receiveが途中で失敗した場合のmodel変更と、そのcandidateのDOM公開を分けて評価する。
- owned payloadのalias隔離を選ぶ場合、そのobservableな違いを明記する。
  native Signalと全面的に同じと記載しない。
- 全登録名が補完されることは、全関数がbindingで正常に実行できることを意味しない。
  bindingでは書込みとresource取得を実行前に拒否する必要がある。
  任意のJavaScript closureや外部handleまでsandboxできるとは扱わない。

## 七つのuse caseとの対応

| use case | 今回の証拠が追加するもの | この資料だけでは未証明のもの |
|---|---|---|
| F：フィードバックを見ながら編集 | native form、reset、submitter、入力途中の値の基準 | 実OSのIME、全controlのadapter、読み上げと実画面の操作性 |
| C：別packageに分けた共有cart | 型、module参照、owned payloadのaliasとscopeの比較材料 | 実package配布、複数独立ownerでの共有serviceとcleanup |
| B：検索と履歴と未完draft | 同じ表示先への競合、native historyのsnapshotとDOM非復元 | 実HTTPとnavigation、選択したdraft policyのend-to-end |
| D：実Docs Copyとserver-only article | 現行consumerのSSR接続不足、成功誤表示、限定timer cleanup | 新APIでの移行、実clipboard permission、実SSR admission |
| M：複数stepのフォーム | checkpoint DTO、late write、ownerの寿命を分ける材料 | 実multi-step画面、保存失敗、再接続後の復帰 |
| T：編集可能な一覧 | keyとDOM寿命、native inputの要求、入力型の境界 | 実tableのsort/filter/virtualization、業務IDとの対応、a11y |
| L：live更新とlocal draftの競合 | callbackの寿命、receive失敗、source失効の限定kernel | 実transportのgap/reconnect、version競合、server側の更新競合 |

counterは最初の接続を確かめるbaselineであり、この七つを代替しない。
表の未証明項目は要件の削除でもunsupported判断でもない。
後続で対象consumerを選び、今回のkernelを統合したときに検証する範囲である。

## 後続Issueへ渡すもの

| 所有者 | この検証を使って決めること |
|---|---|
| #262 / #247 | 未採用契約の選択、表記と実用例の整合、どのsliceから実装へ進めるか |
| #248 | module inventory、response identity、SSR association、native formや通信に必要なserver側境界 |
| #249 | capture復元、書込み権限、DOM所有、input adapter、receive、lease、destination世代 |
| #250 | 実Docs Copy、フォーム、一覧などconsumerへの接続と移行 |
| #251 | 実browser、build adapter、障害経路、複雑なconsumerの期待値と証拠 |
| #264 | この限定実験のsourceと再実行手順をDraft PRで保存すること |

counterの最初のsliceを、全consumerや全browserの検証が終わるまで止める必要はない。
ただし型検査の成功だけでDOM/inputやproductionの保証へ進めず、選んだsliceの期待値をSPECとtestsに先に記録する。

## 利用者レビューに残す契約

| 論点 | 現時点の推奨 | 採用時に明記する限界 |
|---|---|---|
| Signalのrecognition | trustedな構造protocolと有限のtransfer profileを比較の基準にする | native constructorの真正性や、side effectを持つfakeの瞬間snapshotは保証しない。nominal predicateはengineへの追加契約を別途判断する |
| owned payload | 外部aliasを隔離し、readonlyなowned graphをcontextへ渡す案 | 外部objectを直接変更してから同じrootをsetした場合の通知はnative raw aliasと異なる。Acceptedのobservable維持を黙って読み替えない |
| module参照 | explicitなclient参照とbuild graph検査を保つ | source URLの書換えや許容call grammarを導入する場合、そのadapterは新しい選択としてレビューする。#253 のcompiler不採用から自動的に許可されたとは扱わない |
| receive失敗 | 失敗したcandidateのDOM公開を止め、modelの部分変更は隠さず記録する案 | batchをrollbackと呼ばない。後のhealthy refreshが部分変更を表示し得る |
| resourceと非同期 | operation完了とresource lifetimeを分け、callbackの実行中はpinを持つ案 | disposeやreplaceはpinを待たず権限を失効する。任意の外部作用を取り消せるとは扱わない |
| native input | native-ownedとcontrolledを分け、controlledは明示sinkと競合policyを持つ案 | pre-bootstrapのIME履歴を推測しない。radio、reset、Fileなどは個別のnative意味論を保持する |
| 表示切替と履歴 | replacement先の世代とchannelの寿命を併用し、Backは明示DTOかfresh responseへ結び付ける案 | disposed identityの復活を認めず、append/mergeや祖先targetの競合は別の契約を定める |

この表は追加した全APIを採用する投票ではない。
どの契約を最初のcounter sliceに必要とするかを切り分け、残るuse caseの要件を保持したまま段階的にProposalへ反映する。
PR #263 の旧案を、この実験の合格だけを理由にmerge可能とは扱わない。

## 統合作業中の結果

P03/P06/P07は最終結果を受領し、archiveで再検証した。
P01/P02とP04/P05は担当Solの最終結果を受領してから、この文書と索引に追加する。
途中の結果を最終合格と扱わない。
