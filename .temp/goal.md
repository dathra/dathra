# 自律的な設計検討の実行指示

ここから先の設計検討と設計判断は、ユーザーの承認を待たず、メインエージェントが自律的に進めてください。
設計上の選択、不確実性、優先順位について、ユーザーへ質問してはいけません。
リポジトリ、設計文書、一次資料、sub-agent を使って調査し、最終的な判断はメインエージェントが行ってください。

最終目標は次のとおりです。

> 宣言的 UI から server / client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する。

Reactive graph、hydration、island、directive、client scope DAG は、最終目標を達成するための手段です。
特定の手段を維持すること自体を目的にしてはいけません。

`.temp/declarative-ui-execution-partitioning.md` を設計判断の正本として扱ってください。
同文書の合意済み事項を制約とし、履歴として残された過去案を現行方針と混同してはいけません。
後方互換性は制約とせず、必要な破壊的変更を許容してください。
設計検討が目的であるため、production code の実装は開始しないでください。

この文書の手順 4 から手順 6 は、独立レビューに関する共通手順でもある。
実装 goal から参照された場合はレビュー手順だけを適用し、この文書の「production code の実装は開始しない」という作業条件を実装 goal へ持ち込まないでください。
実装 goal に固有の検証、commit、push、完了条件は、実装 goal の記述を優先してください。

通常の未決事項を検討する前に、手順 0 の baseline audit を一度だけ実行してください。
baseline audit の完了後は、手順 1 から手順 8 を未決事項がなくなるまで繰り返してください。

## 0. 既存決定を baseline audit する

`.temp/declarative-ui-execution-partitioning.md` から、現行方針として扱われている決定事項を抽出してください。
抽出した決定事項の依存関係を整理し、ほかの判断の前提になるものから順番に監査してください。

最終目標、破壊的変更を許容する方針、production code の実装をまだ開始しないという作業条件は、監査によって変更する対象に含めないでください。
historical または superseded と明記された過去案も、現行の決定事項として監査してはいけません。
それ以外の合意済み実行モデル、配置規則、transfer protocol、client scope DAG、activation policy などは監査対象に含めてください。

各決定事項を既存の提案として扱い、同一 revision を手順 4 の並列レビューで評価させてください。
メインセッションは手順 5 と同じ方法で評価結果を検証し、根拠のある指摘だけを採用してください。

実質的な問題が見つからなかった決定事項は、白紙から再決定せず、現行の決定を維持してください。
好みの違いだけを理由に、合意済み事項を未決事項へ戻してはいけません。

実質的な問題が見つかった決定事項は未決事項へ戻し、手順 2 から手順 8 に従って調査、提案、評価、修正、文書化、commit、push を行ってください。
修正した決定を push した後は、通常の未決事項へ進む前に、手順 0 の残りの監査へ戻ってください。

すべての現行決定を監査し、再検討が必要な決定を収束させた後で、手順 1 へ進んでください。

## 1. 未決事項を一つ選ぶ

`.temp/declarative-ui-execution-partitioning.md` の「実装前に決めること」と、検討中に新しく発見した未決事項から、次に扱う項目を一つ選んでください。
他の判断の前提になる事項、最終目標への影響が大きい事項、設計の手戻りを生みやすい事項を優先してください。
選んだ事項が別の未決事項に依存している場合は、その依存先を先に扱ってください。

## 2. 前提を調査する

提案を作る前に、設計文書全体と関連する source code、`SPEC.typ`、`implementation.test.ts` を確認してください。
現行実装についての主張は、記憶や推測ではなく、実際のコードを根拠にしてください。
外部技術の仕様が判断に影響する場合は、公式文書、標準仕様、原論文などの一次資料を確認してください。

## 3. 提案を作る

合意済み事項と最終目標を基に、選んだ未決事項に対する提案を一つ作ってください。
提案には、少なくとも次の内容を含めてください。

- 決定する内容
- 最終目標に適している理由
- 比較した代替案と採用しない理由
- compiler、runtime、SSR、CSR、DSD、公開 API への影響
- 想定する edge case と diagnostic
- 実現可能性の根拠
- まだ検証できていない前提

## 4. 独立レビューを並列実行する

提案を作ったセッション自身だけで評価を完結させてはいけません。
同一 revision の提案を、後述するrisk tierで定めた一人以上の新しい独立sub-agentへ渡してください。
reviewerが複数の場合は、互いに独立したsessionへ並列に渡してください。
レビュー中に提案を変更せず、全 reviewer が同じ入力を評価できる状態を維持してください。
dependencyとwrite setが独立した複数のreview unitは、unitごとにrevisionとreviewer setを固定したうえで同時にレビューして構いません。
異なるunitの指摘と収束状態を混ぜず、各unitの結果を別々に統合してください。

### レビュー回数の上限

同一review unitの有効なレビューは、初期レビュー一回と、blocker修正後の収束レビュー一回を上限とします。
初期レビューはrisk tierで定めたreviewerを同一revisionへ並列に割り当て、全結果を回収してからblockerを一括修正してください。
収束レビューは初期レビューへ参加していない一人だけが、採用したblockerの解消と変更範囲のregressionを確認します。

| risk tier | 初期reviewer | 収束reviewer | 同一unitの最大session数 |
| --- | ---: | ---: | ---: |
| `low` | 1 | 1 | 2 |
| `medium` | 2 | 1 | 3 |
| `high` | 3 | 1 | 4 |

収束レビューでcorrectness blockerが残った場合は、同じscopeの三回目のレビューを開始してはいけません。
そのreview unitを過大または契約未確定と判定し、依存順の小さいreview unitへ分割するか、前提をtestまたはprobeで確定して提案を作り直してください。
同じscopeを別名のreview unitへ変更して回数をresetしてはいけません。

文章表現、命名、最適化、将来拡張だけのfollow-upは再レビューの理由にしません。
proposal、write set、dependency、decision anchorの外部変更によって`REVIEW INVALID`になった試行は有効な回数へ含めませんが、無関係なbranch HEAD前進を理由に無効化してはいけません。

固定revisionはreview-unit manifestとimmutable review snapshotで表してください。

manifestは次の入力を固定します。

- proposalのpath、SHA-256、Git blob OID
- 割当write setの完全なpath inventory、file mode、SHA-256、Git blob OID
- 直接dependencyのpathとGit blob OID
- decision excerptごとのcanonical source path、stable decision IDまたは決定的な抽出command、抽出結果のSHA-256とGit blob OID
- 上記blobをcurrent dependency baseへ重ねて作ったsynthetic Git treeまたはcommit OID

manifestの機械的整合性は、reviewerごとに同じhash、blob、dependency、decision anchorを再計算させず、メインセッションが一回の決定的なreview attestationとして検証してください。
attestationは、manifest自身のSHA-256、proposal、write set、dependency、decision anchor、synthetic treeまたはcommit、実行したgate commandと終了状態をmanifest revisionへ束縛します。
reviewerはmanifest hash、synthetic commit、attestationのbindingを確認し、担当論点に関係する入力だけをspot checkしてください。
attestationに不整合がある場合、またはreviewerが具体的な疑義を示した場合だけ、対象を限定して再計算またはtestを再実行してください。
semantic correctness、owner boundary、実装可能性の評価を、機械的OID照合の重複で置き換えてはいけません。

共有文書から本文をmanifestへcopyするだけではdecision anchorになりません。
メインセッションはreview開始前、結果統合直前、commit直前に同じ抽出commandをsource pathへ再実行し、抽出結果をmanifestと照合してattestationを更新してください。
共有文書全体のhashは固定せず、関連excerptの変更だけを検出してください。

workerは実装と検証を終え、実行中commandを終了し、対象fileのwrite ownershipをメインセッションへ返してからmanifestを発行します。
review開始から結果統合まで、proposal、manifest、割当write setはメインセッションがfreezeし、workerとreviewerは編集しません。
進捗文書、proposal、manifestは常にメインセッションだけが編集します。

メインセッションは固定blobをGit object databaseへ保存し、branchを動かさないsynthetic commitを作ります。
reviewerはmutableなshared worktreeを正本として読まず、synthetic commitのisolated worktreeまたはmanifest指定のGit blobを評価します。
testも原則としてisolated review snapshotで実行し、shared worktree上のtestは補助証拠としてだけ扱います。

別review unitのcommitによるbranch HEADの前進、割当外fileの変更、共有設計文書の無関係な節の変更だけでreviewを無効にしてはいけません。
proposal、write-set membership、対象file content、dependency content、decision excerptのいずれかが固定入力と異なる場合だけ、そのreview resultを`REVIEW INVALID`として破棄してください。
外部sessionまたはユーザー変更は破棄または上書きせず、対象unitの新revisionとして再評価してください。

レビューへ渡す前に、提案に含まれる決定を、決定内容、owner、依存先、独立した検証方法の表へ分解してください。
別々に仕様化して検証でき、一方を確定しても他方の選択肢を不当に固定せず、途中状態を整合したまま保存できる決定は、独立した review unit とします。
独立した review unit を複数含む提案は、依存順に分割してからレビューしてください。
同じ不変条件を成立させるために同時決定が必要であり、分けると一時的に矛盾した契約しか作れない事項だけを一つの review unit に含めて構いません。

提案本文と主要なfixtureの合計が大きくなる見込み、または reviewer が互いに独立した parser、validator、solver、state machine、identity operation を三つ以上追う必要がある場合は、review unit の再判定を必須とします。
文章量やsource file数だけを分割理由にはしませんが、この再判定を省略してはいけません。

proposalを固定する前に、`low`、`medium`、`high`のrisk tierと判定根拠を明記してください。
このrisk tier、attestation、output limit、delta convergence規則は、新たに固定するrevisionから適用し、すでにreviewを開始したrevisionへ遡及適用しません。

`low`は一人のreviewerを使います。
次のすべてを満たす提案だけを`low`にできます。

- 一つのpackage-local contractまたはtype-only surfaceだけを変更する
- runtime behavior、parser、validator、state transitionを変更しない
- public API、wire schema、永続identity、trustまたはauthority boundaryを変更しない
- 既存のAccepted decisionを適用し、新しい不可逆な意味判断を追加しない

`medium`は二人のreviewerを使います。
`low`にも`high`にも該当しないproposalを`medium`とします。

`high`は三人のreviewerを使います。
次のいずれかに該当する提案を`high`とします。

- 複数 package の責務境界を変更する
- identity、trust boundary、authority を扱う
- concurrency、race、state machine を扱う
- untrustedな可変長inputのparserまたはserializerを扱う
- server/client artifact inclusionまたはruntime admissionを変更する
- 公開 API、wire schema、永続 identity を決定する
- 後から変更するコストが特に高い

reviewer には提案、設計文書のパス、関連コードの場所、評価基準を渡し、特定の結論へ誘導してはいけません。
各 reviewer 自身にも、設計文書と関連コードを確認させてください。

reviewer の役割は次のように分け、全員へ同じgeneral reviewを依頼しないでください。

1. primary reviewer：contract correctness、合意済み事項、blocker全体
2. implementation reviewer：実装可能性、性能、budget、test、実コードとの接続（`medium`と`high`）
3. boundary reviewer：identity、trust、authority、最終目標、package boundary、過剰設計（`high`）

primary reviewerには次の共通事項をすべて評価させてください。
implementation reviewerとboundary reviewerは担当範囲と交差する項目だけを評価し、primaryの前提に具体的な矛盾を見つけた場合は担当外でも報告してください。

- 提案内部に矛盾がないか
- 現行実装、最終目標、外部仕様に関する前提が正しいか
- server-first と必要最小限の client runtime を妨げないか
- 厳しい反論、反例、見落とされた edge case がないか
- component author に不自然な制約を要求しないか
- diagnostic で済ませた機能が実用性を損なわないか
- より単純または適切な代替案がないか
- 独立して確定できる複数の決定を一つの review unit に束ねていないか

各指摘には、重大度、根拠、影響、推奨する修正を含めさせてください。
根拠のない一般論や好みだけの指摘は受け入れないでください。

reviewerへ渡すreview capsuleは、決定内容、変更された不変条件、担当論点、関連diff、decision anchor、attestationへの参照を2,000 tokens以内の目安でまとめてください。
canonical proposal、manifest、diff、test artifactはcapsuleへ全文転記せず、固定pathまたはOIDから必要な箇所を読ませてください。
reviewerの通常出力は800 tokens以内を目安とし、`verdict`、blocker最大3件、follow-up最大3件、必要最小限の根拠だけを返させてください。
4件以上の指摘がある場合は省略せず、同じroot causeの指摘を最大3 groupへまとめてください。安全にまとめられない場合は上限を超え、理由を明記してください。
成功したhash照合、test、build結果を長文で再掲せず、attestationのIDまたは固定revisionを参照させてください。
criticalな証明をこの上限内で表せない場合だけ超過を許可し、超過理由を明記させてください。

## 5. 評価結果を統合する

メインセッションは review result をそのまま採用せず、重複を除き、根拠と設計文書を照合してください。
正しいと判断できる指摘だけを提案へ取り込み、採用しない指摘には理由を記録してください。

一人のreviewerがblockerを報告しても、同じfixed revisionを評価中のほかのreviewerを停止してはいけません。
初期reviewer setの全role結果を回収してから、blockerをまとめて修正してください。
固定入力が外部変更によって無効になった場合だけ残るreviewerを早期停止でき、その場合は新revisionを通常人数の初期reviewer setへ渡し直してください。

結果を統合する直前に、manifest自身、proposal、write-set inventoryと全blob、dependency OID、decision anchorを再照合してください。
一件でも一致しない場合は、その結果をcurrent revisionへ適用せず`REVIEW INVALID`とします。

採用する指摘は、次の二種類に分類してください。

- `blocker`：correctness、security、実装可能性、不可逆な契約に影響する指摘
- `follow-up`：最適化、命名、将来の拡張、現在の作業を妨げない改善

独立した review unit の過剰な束ね方が見つかった場合は `blocker` とします。
この blocker は提案内容を一括修正して解消せず、提案を依存順の review unit へ分割し、各 unit を別 revision として手順 3 から評価してください。

`blocker` は同じ原因から生じる指摘をまとめ、提案を一度に修正してください。
`follow-up` は設計文書または進捗文書へ記録し、提案や実装を停止する理由にしないでください。
一つのreview unitに`blocker`が見つかっても、そのunitへ依存せずwrite setも重ならないreview unitの評価、実装、検証を停止してはいけません。

reviewer 同士の結論が対立した場合は、メインセッションが根拠を比較して判断してください。
事実確認が不足して判断できない論点だけを、対象を限定した調査、一次資料、test fixture、または実行可能な probe で検証してください。
意見の多数決を目的とした reviewer の追加は禁止します。

## 6. 修正後の収束を確認する

`blocker` を取り込んで提案を意味上変更した場合は、最初の並列レビューに参加していない一人の独立した sub-agent へ収束確認を依頼してください。
収束確認は原則一回とし、文章表現または `follow-up` だけを変更した場合は実施しないでください。
収束確認でblockerが残った場合は同一review unitのレビューを終了し、手順4の回数上限に従ってunit分割または前提の再設計へ戻ってください。

収束確認用capsuleは、初期revision、採用したblocker、変更したblobとhunk、影響するdependency closure、targeted gate attestationだけを含めてください。
収束reviewerには、採用した`blocker`の解消と変更範囲に新しいcorrectness blockerが生じていないことだけをdelta reviewさせ、初期snapshot全体を最初から再評価させないでください。
write set、owner、public contract、trust boundaryがblocker解消範囲を越えて変わった場合はdelta convergenceを使わず、risk tierを再判定した新しい初期revisionとしてreviewしてください。
新しい疑問が出た場合も、同じ提案に対する全面レビューを繰り返してはいけません。
設計判断を変え得る疑問は、対象を限定した調査、一次資料、test、または最小の実行可能な probe で検証してください。
収束確認を待つ間に停止するのは、対象unitとそのdownstream dependencyだけです。
ほかの独立unitは固有のrevisionを維持して進行してください。

次の条件を満たした提案を implementation-ready とします。

- 既知の `blocker` が残っていない
- 判断を変え得る前提誤りが残っていない
- 合意済み事項との矛盾がない
- 最終目標への適合理由と実現方法を説明できる
- 残る不確実性が `follow-up` または実装時の検証事項として明示されている

## 7. 決定を設計文書へ反映する

収束した決定だけを `.temp/declarative-ui-execution-partitioning.md` に記録してください。
決定内容、理由、却下した主要な代替案、制約、diagnostic、実装時の検証事項を記載してください。
「実装前に決めること」と「現時点の整理」も更新し、解決済みの事項を未決定のまま残してはいけません。
過去案を残す場合は、現行方針ではないことと、どの決定によって supersede されたかを明記してください。

文書の編集には `japanese-tech-writing` skill を使用してください。
編集後は Markdown、コードフェンス、`git diff --check`、文書内の矛盾を検証してください。
proposalとcommit対象文書が異なる場合は、commit対象excerptと固定decisionの対応をactual-integration manifestへ固定し、一人の独立reviewerに転記漏れと矛盾だけを確認させてください。
検証とactual integration reviewの後は、ユーザーへ確認を求めず、変更の commit と push へ進んでください。

## 8. 決定を commit して push する

今回の決定に関係する文書だけを stage し、無関係な変更を commit に含めないでください。
commit直前にmanifestとdecision anchorを再照合し、staged path inventory、file mode、blob OIDがactual-integration manifestと完全一致することを確認してください。
commit後もcommit treeの対象pathとblob OIDを同じmanifestへ照合してください。
決定内容を特定できる commit message で commit し、現在の作業ブランチへ push してください。
push 後は、local HEAD と追跡先の remote branch が同じ commit を指していることを確認してください。

baseline audit の途中で決定を修正した場合は、ユーザーへ確認を求めず、手順 0 の残りの監査へ戻ってください。
未決事項が残っている場合は、ユーザーへ確認を求めず、手順 1 に戻ってください。
すべての未決事項を処理した場合は、文書全体の最終監査へ進んでください。

## 9. 文書全体を最終監査する

すべての未決事項を処理した後、同一 revision の文書全体を三人の新しい独立した sub-agent に並列監査させてください。
手順 4 と同じ三つの役割に分け、合意事項の矛盾、未回収の未決事項、誤った前提、実現不可能な組み合わせ、最終目標からの逸脱を確認させてください。
監査結果は手順 5 と同じ方法で統合してください。
`blocker` が見つかった場合は、該当事項を再び未決事項として扱い、提案と評価の手順へ戻ってください。
`follow-up` は実装時の検証事項として記録し、`blocker` がなければ統合した監査結果を `ACCEPT` としてください。

## 10. 完了を報告する

文書全体の監査が収束したら、作業ツリーが clean であり、local branch と remote branch が同期していることを確認してください。
最後に、決定した主要事項、残された実装時の検証事項、最新の commit hash、push 先をユーザーへ報告してください。

sub-agent を利用できない、必要な権限や認証がないなど、設計判断では解決できない外部要因がある場合だけ作業を停止してください。
その場合は、阻害要因、完了済みの作業、再開条件をユーザーへ報告してください。
