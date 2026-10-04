# 実 Docs Copy の比較基準

対象は現在の `docs/src/components/DocCodeBlock/DocCodeBlock.tsx` である。
新しい #262 API の実装ではなく、#251 の比較 consumer の不足を確認する。
source を新しく build し、既存 package の配布 artifact を依存として使用する。
package artifact の hash を残し、同じ revision の全 package を再 build した証拠とは扱わない。

## 期待する利用者の動作

1. Copy を押すと表示中のコードがコピーされる。
2. clipboard の Promise が成功したときだけ成功表示する。
3. 失敗または Clipboard API 不在の場合は、手動選択などの回復方法を表示する。
4. 連打しても古い timer が新しい feedback を消さない。
5. host を削除すると owned timer を止める。

## 現行 source から検証する差分

現行 handler は clipboard の成功を待たずに copied を true にし、rejection を捨てる。
ブラウザ検証では「Copied! が表示された」を現行 baseline の観測として記録する。
これは上記2と3の合格ではない。
権限と OS の clipboard は mock するため、実クリップボードへの書込みは証明しない。

production source は変更しない。
この不足を新 API の互換要件として継承しない。
