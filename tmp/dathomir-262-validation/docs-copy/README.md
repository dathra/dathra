# 実 Docs Copy の追加観測

Chromium 141.0.7390.37、Node 24.15.0、Vitest 4.0.4 で4件の観測テストが通った。
**製品として4項目が合格したという意味ではない。**
テストは不具合を含む現行挙動を記録している。

| 条件 | 実際の観測 | 製品としての判断 |
|---|---|---|
| SSR の既存 code block をクリック | clipboard 呼出し0回、表示は Copy | 接続不足。#252 S-07 の既知の結果と一致 |
| 同じコンポーネントを browser で新規生成、Clipboard API なし | 呼出し0回でも Copied! | 成功の誤表示 |
| browser 新規生成、clipboard が reject | 呼出し1回、Copied! | 失敗を利用者へ伝えない |
| browser 新規生成、連打後に host を削除 | 前 timer と最終 timer に clearTimeout が計2回 | この限定した cleanup 経路は成立 |

SSR の接続不足を回避するために production を変更したわけではない。
ブラウザに登録済みの実 `dathra-code` を `document.createElement` で新規生成し、CSR 経路を独立して調べた。
これは新しい #262 API の SSR admission 証明にはならない。

## 設計へ反映する点

Copy の成功表示は clipboard Promise の成功後に限る。
失敗と API 不在には手動選択などの回復表示を用意する。
operation の完了後も timer が有効であることと、host 削除で失効することを両立させる必要がある。
既存の SSR 不具合を新方式の互換基準として引き継がない。
Clipboard の実行済み外部作用を rollback できるとは扱わない。

## 再実行

```sh
pnpm --filter @playground/e2e build:deps
node tmp/dathomir-262-validation/docs-copy/build.mjs
node tmp/dathomir-262-validation/docs-copy/run.mjs
```

build 出力はこのディレクトリの `build/` に隔離した。
元の `docs/dist` と package source は変更していない。
archive checkoutでは先に `build:deps` を実行し、そのsourceから再生成したpackage artifactを使った。
親ディレクトリの `dependencies-build.log` がその実行記録である。
このbuild script自体はdependencyの再buildを行わないため、再実行時も前提コマンドを省略しない。
移動先で Shiki の依存を解決するため、検証用 SSR build では Shiki を bundle した。
`build-provenance.json` に source と使用済み package artifact の hash、`observations.json` に観測結果を残した。

初回は既知の SSR 接続不足により feedback 検証へ到達できなかった。
その後、SSR と browser 新規生成を別ケースに分けた。
OS の clipboard、実際の permission prompt、全 browser、移動中の host、遅い clipboard 結果による競合は、この4件では証明しない。

所有する後続は #250 の実 consumer 移行と #251 の期待値、#249 の operation/resource lifetime である。
修正は未採用 API の production 実装と混ぜず、後続の範囲を明示して扱う。

独立レビューR1を受けて現buildに対して4件を再実行した。
`run-provenance.json` が使用build全出力、build provenance、観測結果、実行ログのSHA256を結び付ける。
