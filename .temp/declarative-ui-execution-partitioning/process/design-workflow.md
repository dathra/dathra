# 自律的な設計検討ワークフロー


ここから先の設計検討と設計判断は、ユーザーの承認を待たず、メインエージェントが自律的に進めてください。
設計上の選択、不確実性、優先順位について、ユーザーへ質問してはいけません。
リポジトリ、設計文書、一次資料、sub-agent を使って調査し、最終的な判断はメインエージェントが行ってください。

最終目標は次のとおりです。

> 宣言的 UI から server / client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する。

Reactive graph、hydration、island、directive、client scope DAG は、最終目標を達成するための手段です。
特定の手段を維持すること自体を目的にしてはいけません。

`.temp/declarative-ui-execution-partitioning/README.md` と、そこから参照される `decisions/` 配下の担当文書を設計判断の正本として扱ってください。
同文書の合意済み事項を制約とし、履歴として残された過去案を現行方針と混同してはいけません。
後方互換性は制約とせず、必要な破壊的変更を許容してください。
設計検討が目的であるため、production code の実装は開始しないでください。

独立reviewの共通規則は[`review-policy.md`](review-policy.md)を正本とします。
implementationからreview policyを参照しても、この文書の「production codeの実装は開始しない」という設計作業条件はimplementationへ持ち込みません。


## 0. 既存決定を baseline audit する

`.temp/declarative-ui-execution-partitioning/README.md` のindexから担当文書をたどり、現行方針として扱われている決定事項を抽出してください。
抽出した決定事項の依存関係を整理し、ほかの判断の前提になるものから順番に監査してください。

最終目標、破壊的変更を許容する方針、production code の実装をまだ開始しないという作業条件は、監査によって変更する対象に含めないでください。
historical または superseded と明記された過去案も、現行の決定事項として監査してはいけません。
それ以外の合意済み実行モデル、配置規則、transfer protocol、client scope DAG、activation policy などは監査対象に含めてください。

各決定事項を既存の提案として扱い、[`POLICY-R8-INITIAL`](review-policy.md#policy-r8-initial)に従って同一revisionを評価させてください。
メインセッションは[`POLICY-R8-INTEGRATE`](review-policy.md#policy-r8-integrate)に従って根拠のある指摘だけを採用してください。

実質的な問題が見つからなかった決定事項は、白紙から再決定せず、現行の決定を維持してください。
好みの違いだけを理由に、合意済み事項を未決事項へ戻してはいけません。

実質的な問題が見つかった決定事項は未決事項へ戻し、手順 2 から手順 8 に従って調査、提案、評価、修正、文書化、commit、push を行ってください。
修正した決定を push した後は、通常の未決事項へ進む前に、手順 0 の残りの監査へ戻ってください。

すべての現行決定を監査し、再検討が必要な決定を収束させた後で、手順 1 へ進んでください。

## 1. 未決事項を一つ選ぶ

`.temp/declarative-ui-execution-partitioning/README.md` が参照する担当文書の未決事項と、検討中に新しく発見した未決事項から、次に扱う項目を一つ選んでください。
他の判断の前提になる事項、最終目標への影響が大きい事項、設計の手戻りを生みやすい事項を優先してください。
選んだ事項が別の未決事項に依存している場合は、その依存先を先に扱ってください。

## 2. 前提を調査する

提案を作る前に、設計文書全体と関連する source code、`SPEC.typ`、`implementation.test.ts` を確認してください。
現行実装についての主張は、記憶や推測ではなく、実際のコードを根拠にしてください。
外部技術の仕様が判断に影響する場合は、公式文書、標準仕様、原論文などの一次資料を確認してください。

<a id="design-workflow-proposal-review"></a>

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


## 4. Reviewへ渡す

提案を[`POLICY-R8-UNIT`](review-policy.md#policy-r8-unit)で分解し、[`POLICY-R8-EVIDENCE`](review-policy.md#policy-r8-evidence)に従ってcandidateを固定してください。
初期reviewは[`POLICY-R8-INITIAL`](review-policy.md#policy-r8-initial)に従います。

## 5. 評価結果を統合する

review resultは[`POLICY-R8-INTEGRATE`](review-policy.md#policy-r8-integrate)に従って検証し、根拠のあるblockerだけを採用してください。

## 6. 修正後の収束を確認する

blocker修正後は[`POLICY-R8-CONVERGENCE`](review-policy.md#policy-r8-convergence)に従います。
review済みになった提案だけを手順7へ渡してください。

## 7. 決定を設計文書へ反映する

収束した決定だけを `.temp/declarative-ui-execution-partitioning/README.md` が示す一つの担当文書に記録してください。
決定内容、理由、却下した主要な代替案、制約、diagnostic、実装時の検証事項を記載してください。
「実装前に決めること」と「現時点の整理」も更新し、解決済みの事項を未決定のまま残してはいけません。
過去案を残す場合は、現行方針ではないことと、どの決定によって supersede されたかを明記してください。

文書の編集には `japanese-tech-writing` skill を使用してください。
編集後は Markdown、コードフェンス、`git diff --check`、文書内の矛盾を検証してください。
proposalとcommit対象文書が異なる場合は、commit対象excerptと固定decisionの対応を同じcandidate evidenceへ含めてください。
転記後にcandidateを変更せず、reviewと検証が収束したらユーザーへ確認を求めずcommitとpushへ進んでください。

## 8. 決定を commit して push する

今回の決定に関係する文書だけを stage し、無関係な変更を commit に含めないでください。
commit直前に`review:evidence`を再検証し、staged path inventory、file mode、blob OIDがreview済みcandidateと完全一致することを確認してください。
commit後もcommit treeの対象pathとblob OIDを同じevidenceへ照合してください。
決定内容を特定できる commit message で commit し、現在の作業ブランチへ push してください。
push 後は、local HEAD と追跡先の remote branch が同じ commit を指していることを確認してください。

baseline audit の途中で決定を修正した場合は、ユーザーへ確認を求めず、手順 0 の残りの監査へ戻ってください。
未決事項が残っている場合は、ユーザーへ確認を求めず、手順 1 に戻ってください。
すべての未決事項を処理した場合は、文書全体の最終監査へ進んでください。

## 9. 文書全体を最終監査する

すべての未決事項を処理した後、文書全体を`high`として同一revisionへ固定してください。
primary reviewerとrisk reviewerは、合意事項の矛盾、未回収の未決事項、誤った前提、実現不可能な組み合わせ、最終目標からの逸脱を分担して確認します。
監査結果は[`POLICY-R8-INTEGRATE`](review-policy.md#policy-r8-integrate)に従って統合してください。
`blocker` が見つかった場合は、該当事項を再び未決事項として扱い、提案と評価の手順へ戻ってください。
`follow-up` は実装時の検証事項として記録し、`blocker` がなければ統合した監査結果を `ACCEPT` としてください。

## 10. 完了を報告する

文書全体の監査が収束したら、作業ツリーが clean であり、local branch と remote branch が同期していることを確認してください。
最後に、決定した主要事項、残された実装時の検証事項、最新の commit hash、push 先をユーザーへ報告してください。

sub-agent を利用できない、必要な権限や認証がないなど、設計判断では解決できない外部要因がある場合だけ作業を停止してください。
その場合は、阻害要因、完了済みの作業、再開条件をユーザーへ報告してください。
