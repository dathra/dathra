# counterを最初に実装する場合の採用範囲

この文書は #262 のレビュー用の提案であり、実装の着手承認ではない。
現在のIssueを置き換えるtask一覧は作らず、#247 配下の既存ownerが最初に共有すべき契約を整理する。

## 最初に成立させる利用場面

serverが初期countを7として計算し、SSRには `Count: 7` とボタンを出す。
clientは同じcountを復元し、既存の表示位置へ接続する。
ボタンでcountを増やすと表示が更新され、ownerの終了後には古い操作から更新できない。
別のserver-only responseではclient entry、bootstrap、marker、handoffを送らない。

時刻から決めた通常値やthemeはserverのcaptureを使い、browserで再計算しない。
同じSignalを戻り値の二つのpathに置いた場合には、一つのclient-local slotへ対応する。
この追加条件により、単なる別実装のclient counterを成功例と取り違えない。

## このsliceで先に決める契約

| 境界 | 必要な決定 | 検証で見ること |
|---|---|---|
| author | server/templateとflat client registry、bind/on、clientModuleの対応 | 全関数名の補完、誤った名前の診断、通常JSでも実行時検証できること |
| build | 明示module参照を配置先のclient assetへ対応付ける方法 | server-only依存の混入拒否、実URLの解決、型参照とruntime参照の区別、固定inputと環境での提供結果の再現性 |
| server | 一度のcaptureからtemplateとhandoffを作る方法 | request-localな初期値、same-slot alias、fresh response identity |
| client | immutable associationのpreflight、復元、resource取得、commit | preflight拒否のSSR維持、取得途中とcommit時のDOM失敗で元のSSR nodeと表示を保持、commit前のwrite bufferとevent gate、owned resourceのcleanup、取得後失敗のidentity terminal化 |
| binding | 読取り専用phaseと自動初回更新 | 書込み前の拒否、既存text node保持、初回更新をclick待ちにしないこと |
| operation | admitted ownerの書込み権限とlistenerの寿命 | clickで更新、dispose後のcached setter拒否、重複listenerなし |
| response selection | server-only responseとclient capabilityのあるresponseの区別 | build artifactがあることと、そのresponseがassetを送ることを混同しない |

module参照の成立性を、型検査だけで済ませない。
また、一つのcounterで型、build、capture、DOMの各kernelが別々に合格しても、同じpublic entryからつながった証明にはならない。
productionでは共有fixtureを通してこの接続を検証する。

## 後続の検討を止めずに保留できるもの

counterの採用に、自律childの入力更新、controlled formの全adapter、historyのdraft policy、四つの通信concurrencyを一括採用する必要はない。
これらは七つのuse caseに必要な要求として残し、各sliceのpublic contractとして別に採用する。
未実装を理由にunsupportedへ変えない。

最初のcounterは数値を扱うため、複雑なobjectのowned payload差分を全て使うconsumerではない。
ただし、後でobject stateを支える際にreadonly、alias隔離、既存Signalとの違いが必要になる事実は隠さない。
最初のSPECには、そのsliceが実際に扱う値と未採用の拡張範囲を明記する。

## このsliceで発見したときに戻す判断

- 型とruntime pathが食い違う場合は、名前を増やして回避せず、build inventoryの保証範囲へ戻す。
- 復元したSignalを別entryのcomputedが追跡できない場合は、browser engineの共有配置を修正する。serverのcapture元copyを一律禁止しない。
- 接続失敗で元SSRを戻せない場合は、初期admissionのwrite planと資源取得の境界を見直す。active updateのdamaged policyで代用しない。
- counterを成立させるためにserver/templateのbrowser再実行が必要になった場合は、そのcandidateを不合格とする。
- native inputの保存に成功しても、synthetic composition試験だけでIME対応済みと判定しない。対象controlの実browserと実IMEの検証を別に残す。

これらは後から人手で表示を補修すればよいという受入条件ではない。
失敗したcandidateと変更する判断を対応付け、次の小さい実験かProposalの修正へ戻す。

## 同時に進められる作業

#248 と #249 は、共有するassociationとmarkerの契約を採用した後、同じfixtureを使ってserver側とclient側を並行実装できる。
#251 は期待値と失敗fixtureを先に用意し、#250 は両方のpublic entryが揃った時点で接続する。
実装中に契約の矛盾が見つかれば #262 へ戻し、Accepted ADRの意味をその場で書き換えない。

次のconsumerは一列の工程に固定しない。

- Fの編集とフィードバックはinput adapterの要件を検証する。
- Cの共有cartはpackage再利用とownerの寿命を検証する。
- Bの検索と履歴は通信競合とdraft policyを検証する。
- Dの実Docs Copyは実consumerの成功表示とresource cleanupを検証する。

M、T、Lも独立した圧力として残す。
先行sliceで新たに必要となった契約がそれらに影響する場合は、対応する実例を前倒しする。
全設計の完了を待って一括実装する進め方にはしない。

## レビュー後の正本への反映

この資料と実験を見て採用範囲を決めた後、#262 のProposalと例を現行案へ更新する。
PR #263 の旧案を、実験結果が増えたという理由だけで採用済みにしない。
#264 の証拠保存PRのmergeは、API採用や #247 の完了と別の判断である。
