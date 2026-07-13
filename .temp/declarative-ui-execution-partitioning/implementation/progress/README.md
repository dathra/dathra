# 宣言的UI実行分割の実装進捗

この文書は実装進捗の正本indexです。
現在の作業再開には`current.md`、`active-slices.md`、`blockers.md`を先に読みます。

| ID | 内容 | 正本 |
| --- | --- | --- |
| `P00` | 再開情報、状態定義、R7、scheduler、lane | [`current.md`](current.md) |
| `P10` | baseline、implementation matrix、調査根拠 | [`baseline-and-matrix.md`](baseline-and-matrix.md) |
| `P20` | 現在のsliceと契約分割 | [`active-slices.md`](active-slices.md) |
| `P30` | 完了済みsliceの詳細 | [`completed-slices.md`](completed-slices.md) |
| `P40` | acceptance work | [`acceptance-work.md`](acceptance-work.md) |
| `P50` | slice log | [`slice-log.md`](slice-log.md) |
| `P60` | review log | [`review-log.md`](review-log.md) |
| `P70` | commitとpushのlog | [`commit-log.md`](commit-log.md) |
| `P80` | 未完了事項と外部blocker | [`blockers.md`](blockers.md) |

進捗文書はmain integration ownerだけが編集します。
文書更新のrisk tierとreview要否は[POLICY-R8-DOCUMENT](../../process/review-policy.md#policy-r8-document)に従います。
runtime contract、owner、dependency、write set、acceptance obligation、gate義務を変える場合は、[実装文書のowner index](../README.md)から該当する正本を先に更新します。

完了済みの詳細は`completed-slices.md`と各logへ移し、`current.md`と`active-slices.md`を再開に必要な情報だけに保ってください。
過去の一体型進捗は[`../../archive/snapshots/implementation-progress-monolith-v1.md`](../../archive/snapshots/implementation-progress-monolith-v1.md)へ凍結しています。
