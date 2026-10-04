# 型とbuildの検証資料

[P01/P02の27-case初回報告](REPORT.md) と [P02bの8-case追加報告](p02b/REPORT.md) を順に読む。
P02bは自動source選択とmetadata書換えを使わないmanual inventory案を実際に検証した。
初回報告にあるfallback未実行という記述はP02b前の状態である。

## 再実行

[共通の依存準備](../README.md) の後、repository rootで実行する。

```sh
packages/reactivity/node_modules/.bin/vitest run --config "$PWD/tmp/dathomir-262-validation/types-build/vitest.config.mjs"
```

三つのVitest検証が、strict/checkJsとdeclaration emit、P02の27件、P02bの8件を実行する。
個別runnerとfixtureは各報告に記載する。
出力とruntime facadeは実験用であり、production API、SSR admission、state restorationを統合した証明ではない。
archiveでは元workerの結果と修正前の診断を保持し、生成outとterminal送信receiptを除いた。

active codeだけをformat/lintし、意図的なnegativeとhistoryの失敗sourceは保存する。

archive整形でupdaterが複数行になり、expected-errorの位置がずれた初回失敗を `logs/archive-format-directive-failure.log` に保存した。
assertionを削除せず、診断対象行の直前へdirectiveを移した。
