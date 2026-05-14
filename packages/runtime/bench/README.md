# Runtime Benchmarks

このディレクトリには Dathra runtime のパフォーマンステストが含まれています。

## 現在のベンチマーク結果

### fromTree（DOM 生成速度）

- **小規模ツリー**（単一ボタン）: 310,228 ops/sec
- **中規模ツリー**（10×5 テーブル）: 9,172 ops/sec
- **大規模ツリー**（100 項目リスト）: 3,055 ops/sec

キャッシュされたテンプレートのクローン:

- 小規模: 273,611 ops/sec
- 中規模: 8,992 ops/sec
- 大規模: 3,977 ops/sec

### Reactivity（リアクティビティ）

- Signal 読み取りは書き込みより 6.2倍高速
- Computed 再計算: 単純な computed は 3 レベルチェーンより 1.93倍高速
- Effect 実行: 単一依存は複数依存より 1.26倍高速
- Batch 処理: 10 個の更新は 100 個より 1.45倍高速
- templateEffect: 通常の effect より約 1.09倍遅い（許容範囲内のオーバーヘッド）

### reconcile（リスト差分更新）

Keyed リスト:

- 先頭追加（100 項目）: 最速
- 末尾追加: 先頭追加より 1.18倍遅い
- シャッフル: 1.17倍遅い
- 全置換: 1.68倍遅い
- 部分更新（1000 項目中 10 個変更）: 11.29倍遅い

Unkeyed リスト:

- 末尾追加: 全置換より 1.07倍高速

## 他フレームワークとの比較（推定）

### Fine-grained Reactivity フレームワーク

- **SolidJS**: ~200,000-400,000 ops/sec（同等クラス）
- **Svelte**: ~250,000-450,000 ops/sec（同等クラス）
- **Qwik**: ~150,000-300,000 ops/sec

### Virtual DOM フレームワーク

- **React**: ~5,000-20,000 ops/sec（10-60倍遅い）
- **Vue 3**: ~8,000-25,000 ops/sec（12-40倍遅い）

## 注意事項

**現在のベンチマークは vitest bench による独自測定です。**

正確な他フレームワーク比較には、業界標準の **js-framework-benchmark** で測定する必要があります。

### js-framework-benchmark とは

- **URL**: https://krausest.github.io/js-framework-benchmark/
- **GitHub**: https://github.com/krausest/js-framework-benchmark
- 様々なフレームワークの実行速度とメモリ使用量を統一された条件で測定
- React、Vue、Svelte、SolidJS など 100+ フレームワークの公開結果
- 実ブラウザ（Selenium + Chrome）で測定
- 業界で広く認められた標準ベンチマーク

### 測定項目

1. DOM 操作速度（1,000 行作成、10,000 行作成、追加、更新、削除、入れ替え）
2. メモリ使用量（初期メモリ、メモリリーク検証）
3. 起動時間（スクリプトロード、初回レンダリング）

## 今後の課題（Phase 4+）

- [ ] Dathra を js-framework-benchmark に実装
- [ ] 公式ベンチマーク結果を取得
- [ ] 他フレームワークとの正確な比較
- [ ] パフォーマンス改善の指標として活用

## ベンチマーク実行

```bash
pnpm --filter @dathra/runtime bench
```
