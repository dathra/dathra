# 実装milestone

このディレクトリはactiveな期限付きmilestoneだけを所有します。
completed、interrupted、supersededになったmilestoneは内容を変更せず、[`archive/goals/`](../../archive/goals/README.md)へ移します。

## Active milestone

| Milestone | Lifecycle | 判定根拠 | Scheduler選択 |
| --- | --- | --- | --- |
| [`doc-code-block-demonstration-2026-07-14.md`](doc-code-block-demonstration-2026-07-14.md) | `active` | [provenanceと状態証拠](../../archive/document-split-2026-07-13.md#期限付きgoalの分類) | 未選択。現在のactionは[進捗正本](../progress/current.md)が所有する |

状態は日付だけで決めていません。
進捗、commit、review、blockerの各logに`DR00`から`DR04`の完了、明示的な中断、supersedeの証拠がないため、`active`と判定しました。

現行schedulerがこのmilestoneを選択した場合だけ、milestone内のDR00からDR04を順に実行します。
milestoneの実行対象選択と次のactionは[進捗正本](../progress/current.md)だけが所有します。
完了または中断時は結果、暫定実装、follow-upを[進捗正本](../progress/README.md)へ記録します。
