# #262 の追加検証

利用者が2026-10-05 06:50 JSTまでの検討と検証を許可した作業の成果物である。
ProposalとAccepted ADRの正本は変更していない。
ここにあるコードは採用前の実験であり、実製品の実装完了を意味しない。

## 読む順序

1. [レビュー用の全体像](review-summary.md) と [最初のsliceの採用範囲](first-slice-review.md) を読む。
2. [58項目の対応表](coverage.md) と各READMEで、証拠と未証明範囲を見る。
3. コードと実行ログを確認し、必要なら同じコマンドを再実行する。

## 検証の区別

| 場所 | 対象 | 証拠の種類 |
|---|---|---|
| [types-build](types-build/README.md) | P01 型、P02 module graph | strict/checkJs、22 expected-error、5負例。P02の27件とP02bの8件、実browserの共有engine |
| [state-lifetime](state-lifetime/README.md) | P03 capture、P06 receive、P07 lease | 実engineを使った61件とstrict TypeScript。archiveでも再実行済み |
| [dom-input](dom-input/README.md) | P04 DOM、P05 input | 実Chromiumで53件。初期commit失敗とcounterを含む限定kernel |
| [delivery-races](delivery-races/README.md) | 同一表示先への通信競合 | 状態モデル39件。channelだけでは不足する反例を含む |
| [docs-copy](docs-copy/README.md) | 実Docs Copy | Chromiumの4観測。SSR接続不足とCSR成功誤表示を記録 |
| [native-controls](native-controls/README.md) | native form | Chromiumの9観測。submitter、radio、reset、Fileなどの基準 |
| [native-history](native-history/README.md) | native history | Chromiumの3観測。Back、clone、DataCloneErrorの境界 |

テスト数は相互に異なる範囲を数えるため、足し合わせて製品の網羅率にはしない。
失敗挙動を再現するテストの成功と、製品の期待値の合格も区別する。

## 作業の境界

検証checkoutは `49b1adf502dad7de0b4709c1595d87529f0d2ebd`。
参照Proposal PR263は `0ad07bffd601fef7cd708276942b187883ea787e`。
既存の `.opencode/plugins/format-lint.ts`、`AGENTS.md`、`mise.toml` の変更を保持した。
実験ごとに依存artifactとsourceの違いを記す。
root checkoutとProposal worktreeが同じrevisionであるとは扱わない。

Issue #262入力collectorは5群すべてcollected、warning 0で再収集した。
採用済み#253/#260を再審議せず、必要な新しい契約は利用者レビュー対象として残す。
親#247と関連#248/#249/#250/#251のproduction着手には、それぞれ対象sliceのProposal採用とSPEC/tests先行更新が必要となる。

## 再実行の共通前提

repository rootでNode 24とpnpmを用意し、lockfileに従って依存をinstallする。
ブラウザ観測にはPlaywrightのChromium binaryとhost libraryも必要となる。

```sh
pnpm install --frozen-lockfile --ignore-scripts
pnpm --filter @playground/e2e exec playwright install chromium
```

Linuxでhost libraryが不足する環境では、Playwrightの `install-deps chromium` を環境管理者の権限で実行する。
Docsだけは各READMEの `build:deps` とbuildも先に実行する。
準備済みcheckoutで通った結果を、依存未導入の環境でもそのまま動く保証にはしない。

保存済みのraw logと診断は出力の空白を保持する。
`.gitattributes` はその証拠ファイルとsnapshot末尾の空行だけをwhitespace検査から区別し、実行するsourceの検査は維持する。

## 全体の再実行

共通前提とDocs dependency buildの後に実行する。

```sh
pnpm --filter @playground/e2e build:deps
node tmp/dathomir-262-validation/run-all.mjs
```

`aggregate-results.json` に各runnerのexit statusと実行時刻を記録する。
個別の観測、負例、環境、未証明範囲は各ディレクトリに保持する。
この一括runnerは独立した実験の再実行であり、production統合testではない。
