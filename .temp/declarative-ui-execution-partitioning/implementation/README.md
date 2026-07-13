# 実装文書

このディレクトリは、宣言的UI実行分割をproductionへ実装するための正本indexです。
設計判断は一つ上の[設計index](../README.md)、共通review規則は[Review policy R8](../process/review-policy.md#policy-r8)を参照してください。

## Owner

| 文書 | Owner |
| --- | --- |
| [`goal.md`](goal.md) | 最終目標、適用範囲、正本の優先順位、完了条件 |
| [`workflow.md`](workflow.md) | baseline、slice admission、scheduler、SPECとtestとimplementation、gate、commit、push、blocker処理 |
| [`roadmap.md`](roadmap.md) | R7、walking skeleton、phase、dependency、実装順序 |
| [`acceptance.md`](acceptance.md) | slice検証、integration gate、全体acceptance、push後監査 |
| [`progress/`](progress/README.md) | 現在地、activeとcompletedのslice、reviewとcommitとblockerのlog |
| [`milestones/`](milestones/README.md) | 期限付きmilestoneの状態、優先順位、完了後の復帰先 |

同じ規則を複数の文書へ複製しません。
依存する文書はowner文書のstable headingまたはpolicy IDを参照してください。

## 再開順

contextを失った状態からは、次の順に読みます。

1. [`goal.md`](goal.md)
2. [`workflow.md`](workflow.md)
3. [`roadmap.md`](roadmap.md)
4. [`acceptance.md`](acceptance.md)
5. [`progress/README.md`](progress/README.md)と現在地
6. [`milestones/README.md`](milestones/README.md)

milestoneの`active`はcompleted、interrupted、supersededではないlifecycle状態を表します。
実行対象の選択と次のscheduler actionは[進捗正本](progress/current.md)だけが所有し、milestoneの配置だけでは変更しません。

`archive/`は履歴証拠であり、作業再開や現在の判断には使用しません。
