# 検証前の検討資料

このディレクトリは、実験の入力となった議論のsnapshotを保存する。
API採用、①完了、Accepted ADRの変更を意味しない。
内容は検証前の推奨を含み、成立性の主張は上位のreview-summaryと各実験の結果で再評価する。

- `dathomir-262-three-concerns-review.md`：public surfaceの縮小、Signal recognition、owned payload、58項目と七つのuse case。
- `dathomir-262-section1-review-status.md`：利用者との①の議論と選択の経緯。
- `dathomir-262-full-authoring-review.md`：R2の全体案、19 public surface群、58項目の原文。
- `dathomir-262-signal-and-feasibility-review.md`：B9、X6、P7の検証前の比較。
- `provenance.json`：コピー元と内容hash。元資料内の絶対pathは当時の参照先であり、このPRに全ての一時資料が含まれるとは限らない。

これらはIssueを置き換えるtask ledgerではない。
現在のscopeと採用判断は #262、実験の保存は #264 を参照する。
