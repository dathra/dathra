# #264 最終統合資料の独立レビュー

対象は archive の evidence head `0307be8c30267745c62b8f90ad8ac2bcce80464c`。
設計所有者は #262、証拠保存の所有者は #264。
GPT-6.1 Sol high の継続セッションで、読み込み済みの global/archive AGENTS、Task、review、実行ファイルに対応する Orca guide を適用した。
日本語の記述前に japanese-tech-writing を再読した。

## 判定

**今回の指定範囲で、修正を要求する新しい指摘はない（P0/P1/P2/P3：0件）。**
独立した実験を公開APIの合成保証に読み替える記述、Accepted #253/#260 の黙示的な変更、確認対象の利用者決定の脱落は見つからなかった。
限定証拠として #264 のレビュー用引渡しを進める推奨であり、API採用、①完了、production合格、Taskのmerge/closeを承認する判定ではない。

## 判断を支える照合

| 対象 | 実際の証拠との照合 | 判定と推奨 |
|---|---|---|
| P02bのmanual inventory | `types-build/p02b/run-p02b.mjs:393` は wrong response が `other-v1` に結び付くことをassertし、実browserの `OTHER: 2` を記録。REPORTの誤参照節、`review-summary.md:69`、coverage R2-A11は型shapeと名前の一致がsource同一性を保証しないと明記 | 誤参照拒否の過大主張なし。manual inventoryを候補として残し、source同一性を自動保証すると約束しない |
| buildとブラウザ追跡 | P02bは通常のpreserve-module出力、移設後lookup、共有engineのcomputed更新を実行。REPORTはbrowser側でfresh Signalを作るprobeであり、SSR復元/DOM admissionの統合ではないと限定 | #253で専用compilerを採用したとは扱っていない。build方式を他adapter全般へ一般化しない |
| 初期commitの部分失敗 | `dom-input/p04-kernel.mjs:179` でsetter前にinverseを記録。`p04.test.mjs:814` 以降は二つ目が変更後throwした時の両Text復元、同じnode、停止、terminal identity、独立counterの更新保持をassert | 初期rollbackの限定成立証拠。readme/summary/coverage R2-A15がinverse失敗と全DOM操作を未証明としており、Acceptedの全面要求を達成済みとはしていない |
| postcommit初回refresh | `counter-kernel.mjs:74` はactive/commitの後にrefreshし、失敗を明示resultへ記録。`counter.test.mjs:262` はactive、失敗result、元表示、duplicate owner、明示retryをassert | 初期required commit失敗とactive refresh失敗を区別する未採用kernel契約として一致。初期commit失敗のterminalityをこのretryで置換していない |
| owned payloadとnative Signal | state-lifetime README、summary、coverage R2-A04/A06はexternal raw alias、finite number/NaN、record列挙順の差を明記。nested structural sharingの限定修正をnative全般の同等性へ広げていない | Accepted260の通知意味論を黙示的に変更していない。codecのkey sortも未採用で、標準JS列挙順の保持は有効な代案として残る |
| 合成保証 | P02b browser probe、B61、DOM53は異なるkernel。README、summary末尾、first-slice、coverage R2-A34、aggregateのscopeがpublic server/build/state/admissionのjoint path未証明を明記 | 八つのrunner成功を製品の統合成功と扱っていない。counterの公開一本化は後続のproof gate |
| 利用者が決めた表記 | P02bのcounter sourceはtype-only default参照と二引数clientModule、ordinary signalの統一record、template(values,{bind,on})、flat default defineClient、実SSR内容をserverに渡すbindを使用。summaryは全名候補と自動初回更新を保持。coverageは_keyとfragment公開表記未採用を区別 | query import、kind/child、役割containerの追加採用や役割別補完への後退を確認範囲では認めない |
| 58項目と七witness | coverageにR2-A01–A58を維持。summaryの七witness表は実cart、Docs移行、実HTTP/history、実IME/a11y等を未証明として残す | テスト件数を機能合格数に変換していない。未証明を要件削除やunsupported判断にしていない |
| Task引渡し | task-validationは19対応行でDraft引渡しとpending-mergeを区別。API採用とEpic完了をnon-goalとしている | #264の記録だけで#262/#247を完了扱いしていない |

## 後続で維持する具体的な条件

以下は既に資料に残る未証明事項であり、新しい不具合の指摘ではない。

1. #249のproduction初期admissionでは、**required initial writeと追加のpostcommit refreshの境界を先に固定する**。
   required initial writeの失敗を、active refreshの失敗と命名してretry可能にする実装はAccepted #253/#260を満たさない。
   counter kernel単独は、この境界を公開API全体で実証していない。
2. inverse failureをAggregateErrorに残す処理は、元SSR表示を必ず戻せる証明ではない。
   supported target/write planについてAcceptedの保持要求を満たすか、満たせない設計なら明示した新判断が必要になる。
3. owned payloadの採用時は、readonly保護、外部alias隔離、transfer profileをそれぞれ選ぶ。
   通知や列挙順の差を「readonly化だけ」と扱わず、Acceptedの意味を変える場合は利用者レビューと新ADRの判断へ戻す。
4. manual inventoryの同じshapeの誤参照を許容するか、source provenance検査を追加するかは#262の選択として残る。
   P02のsource-aware adapterとP02bのmanual方式の保証を合算しない。

## 実施した確認と限界

`git rev-parse HEAD`で対象headを確認し、レビュー開始時と本文作成直前の`git status --short`は空だった。
指定されたREPORT、DOM README/contract、state-lifetime README、review-summary、first-slice、coverage、root README、task-validation、aggregate-results、archive-checksを読み、必要なDOM kernel/assertionとP02b source/assertionを照合した。
Accepted #253のactivation transaction、#260のreactivity維持範囲とlifecycle要求も再照合した。

既存aggregateはNode v24.15.0で八つのstepがexitCode 0、archive-checksはactive90ファイルのformat/lint成功を記録している。
今回これらのgreen suite、format/lint、source hash検査は再実行していない。
新しいscratch反例、engine再レビュー、live terminal調査、production変更は行っていない。
旧独立レビューの三指摘は解決済みとして扱い、再開していない。
