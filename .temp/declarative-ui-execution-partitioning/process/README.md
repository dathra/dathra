# Process文書

このディレクトリは、設計判断とreviewに共通する実行手順を所有します。
runtime contractと実装順序は所有しません。

## Owner

| 文書 | Owner |
| --- | --- |
| [`design-workflow.md`](design-workflow.md) | 設計上の未決事項を調査し、提案し、正本へ反映してpushする自律手順 |
| [`review-policy.md`](review-policy.md) | R8のrisk tier、review unit、reviewer数、candidate、evidence、結果統合、収束上限 |

設計作業は[`design-workflow.md`](design-workflow.md)から開始し、reviewが必要な地点だけ[`review-policy.md`](review-policy.md#policy-r8)へ移ります。
実装作業は[`implementation/README.md`](../implementation/README.md)から開始し、同じreview policyを参照します。
design workflowにあるproduction code変更禁止は設計作業だけの条件であり、implementationへ継承しません。
