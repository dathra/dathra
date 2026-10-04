# Task #264 の coordinator-owned evidence review

2026-10-05、GPT-6.1 Sol high、直接割当。
判断ownerは #262、証拠保存ownerは #264。
global AGENTS、archive AGENTS、task-workのverify/handoff、Issue管理規則、日本語執筆規則、同一Orca executableのguideを確認した。
開始HEADは7a3fde1949a25809cfb8d616886c112e005a8ecf、開始git statusはuntracked tmp/のみだった。
このファイルだけを書き、凍結されたcoordinator資料や各kernelは修正しない。

## 結果

P0/P1の問題は見つからなかった。
証拠の対応付けにP2を1件、最初のsliceの検証条件の明記にP2を1件、再現前提の文書化にP3を1件挙げる。
既存の39/9/3/4件という実行数を虚偽と判定するものではなく、どのbuildに属する合格かと、後続sliceが満たす条件を明確にする指摘である。
A/DOMの未コピー行はpendingとして保持し、不在や未完了をfindingに数えない。

## R1 P2 Docsの合格記録と後のbuildを結ぶ証拠がない

対象はdocs-copy/README.md:36–40、build-provenance.json:2、observations.json:2、latest-run.log:12である。
READMEはarchiveでbuild:deps後のsourceから再生成したartifactを使い、そのhashと観測を残したと記載する。
しかし、現在のbuild-provenanceは2026-10-04T20:55:46.242Z、現在のobservationsは20:28:32.211Z、4件PASSのlogも05:28:28 JSTである。
後の05:55 buildに、先の05:28の4件PASSをそのまま対応付けることはできない。

現在のprovenanceに記録した6入力のhashは実ファイルと一致した。
これだけでは先のbrowser runが同じ出力を使用した証明にならず、build scriptはclient/server出力のhashやtest run IDを観測へ渡していない。
「4件は実際に通った」という観測は保持し、「現在のrebuilt artifactsでも4件確認済み」という読み方だけを未確認にする。

推奨修正は、今回の後のbuildに対してDocsの既存4件だけを一度実行し、観測にそのbuild IDまたはclient/server output hashを対応付けることである。
これは件数を増やす再実行ではなく、更新したartifactと実行記録を結ぶ未解決criterionの確認である。
代案は、古いrunに属するprovenance/outputを分離保存し、後のbuildは未実行とREADMEへ明記すること。
本reviewではsuiteを再実行せず、provenance gapをcoordinatorへ返す。

## R2 P2 最初のsliceにcommit-time failure時のSSR保持を明記する

対象はfirst-slice-review.md:24のclient検証欄である。
現在はpreflight拒否のSSR維持と「取得途中の失敗のterminal化とcleanup」を列挙しているが、commit中のDOM書込み失敗に対する元のSSR node/display保持を列挙していない。

Accepted #260 のSPEC/proposals/245/260/260.typ:221–230はcommit failureもterminalとし、逆順cleanup、write破棄、元のSSR node/display保持を要求する。
Accepted #253 のSPEC/proposals/245/253/253.typ:345–356もinitial writesのbuffer、イベント遮断、acquisition/commit failure時のSSR保持を要求する。
初回counterが新しいpublic pathへ進むとき、この条件は複雑なconsumerと一緒に保留する任意要件ではない。

推奨修正はclient行へ「initial write buffer/event gate、commit-time DOM write failureでも元のSSR node/display保持、全owned resource cleanup、identity terminal」を追加すること。
同じpublic entryの共有fixtureでcommit failureを注入するproof gateも明記する。
新たにAcceptedの意味を採用する修正ではなく、既存の必須条件をsliceの検証欄へ再掲する修正である。
現文書がAcceptedを能動的に変更したとは判定しないが、表だけを後続acceptance checklistへ移す場合には不足する。
active deliveryのdamaged modelを、この初期admission criterionの代用にしない。

## R3 P3 browser実験の再現前提が省略されている

対象はnative-controls/README.md:23–29、native-history/README.md:19–25、docs-copy/README.md:26–32、共通READMEである。
各コマンドは既存node_modulesからVitest/Playwrightを解決し、chromium.launch()はインストール済みのbrowser binaryを利用する。
現在の再実行欄はnode runまたはbuild:depsを示すが、workspace依存のinstallとPlaywright Chromium binaryの準備を示していない。

既に準備済みのこのcheckoutでのPASSを否定しない。
新しいclone/hostではnode runner以前に依存解決、またはchromium.launchで止まる前提が文書から分からないため、archiveとしての再現性を補う指摘である。
推奨修正は共通READMEにrepo root、Node/pnpm、lockfile準拠のdependency install、対応PlaywrightのChromium install、必要なhost librariesを前提として列挙すること。
例えば既存workspaceのPlaywrightを使う `pnpm --filter @playground/e2e exec playwright install chromium` を示し、system dependencyの導入はhost側の準備として分ける。
browser installやsystem変更は本reviewでは実行していない。

## 確認した対応と問題に数えなかった範囲

- delivery-racesの15個別caseと4応答の24順列は39件のlogと一致する。
  channel-onlyの反例とdestination epochの候補を区別しており、独立target、prepare中source維持、stale prepared解放、identity retry、commit/history/cleanup失敗はassertionに対応する。
  modelはtarget epochだけのkernelで、channel lifecycleを統合実装した証拠ではないが、全体資料は両者の併用を未採用の推奨と記載している。
  prepare内部rollback、duplicate reservation、release throw、祖先target、実DOM/HTTPは明示された未証明範囲であり、不具合を隠したPASSとは数えない。
- native-controlsの9caseと保存された観測値は整合する。
  submitter、formnovalidate、radioのnative group、dirty/defaultValue、同名entry、File、number途中入力の結論をassertionsが支える。
  reset-orderはprogrammatic form.reset()のfixtureで、実OS IMEや全control adapterの合格ではない。
  user reset buttonを含む全event schedulingを証明したとは読み替えない。
- native-historyの3caseはsame-document BackのURL/stateとDOM、structured clone、DataCloneErrorを実際にassertする。
  cross-document/BFCache、全履歴codec、Dathra復元実装を証明したとは記載していない。
- Docsの不具合を再現したPASSを製品PASSとして扱っていない。
  実sourceのhandleCopyはclipboard Promiseを待たずcopied=trueとしrejectを空catchで消す。
  SSR既存hostと新規CSR hostを分け、timerの結論をclearTimeoutの限定instrumentationに留めている。
  実clipboard permission、遅い応答、移動host、新API migrationは未証明として残る。
- review-summaryは実験と採用、source captureとbrowser engine tracking、native/raw aliasとowned codecを区別している。
  finite/NaNとrecord列挙順も未採用の差分と明記され、全58問や七witnessの完成を宣言していない。
- source-provenance.jsonの25列挙sourceをoriginal/archiveの両方でSHA-256比較し、全25が記載hashと一致した。
  manifestの「列挙sourceだけ」というscopeを維持し、全checkoutや全bundleの一致へ拡大しない。
- coverage.mdはR2-A01からR2-A58まで58行、重複0、欠番0だった。
  A/DOM行の本文は限定実験の対象説明として読み、最終受領前のpending statusを優先した。
- state-lifetimeはREADMEだけを整合確認した。
  archiveの61件/strict TS、lint修正の一時失敗、baseline保存の説明は更新された索引/summaryと一致する。
  kernelを再レビューしたりsuiteを再実行したりしていない。

## 実施したcheckと限界

指定された4ディレクトリのREADME、contract、test、model/build/runner/config、JSON観測と既存logを静的に対照した。
review-summary、first-slice、coverage、source-provenance、Accepted #253/#260の関連箇所、Docs handler、dependency manifestも読んだ。
実行したcheckは25入力の二checkout hash比較と58 coverage IDの重複/欠番確認である。
passing suite再実行、scratch browser/transport実験、source修正、live terminal inspection、新worker、GitHub変更は行っていない。
これらのreview結果は#264のarchive品質に関するもので、#262の契約採用や#247 production readinessを判定しない。
