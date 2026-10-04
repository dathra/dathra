# delivery の競合モデルの結果

2026-10-05 に Node 24.15.0 と Vitest 4.0.4 で39件が通った。
24件は4つの応答完了順序の全順列で、残りは失敗と境界の個別ケースである。
これは小さな状態モデルの結果であり、production delivery の合格ではない。

## 判断への影響

**operation channel だけの世代管理では不足する。**
search と history が独立 channel のまま同じ results を更新すると、新しい結果の後に古い結果が上書きできる。
この反例をテストで再現した。
replacement delivery には表示先ごとの世代を加え、最後に始めた要求だけが commit できる案を推奨する。
新しい要求が失敗しても古い要求を自動復活させず、現在の表示を維持して明示的な再試行を許す。
append や merge の処理にこの規則を流用する判断はしていない。

source の書込み権限は host commit 前に失効させ、destination 検証中は維持する。
commit の途中で外部表示を変更してから throw した場合、モデルは damaged を報告する。
元の表示へ戻ったと偽らない。
history だけの失敗と source cleanup の失敗も、destination commit と区別して報告する。

## Accepted 契約との関係

同じ immutable association の preflight 再試行は、外部 prerequisite の回復時だけ許す。
同じ identity の target を変更した再試行は拒否する。
staging に進んでから失効した candidate は、その identity を再利用しない。
disposed identity を Back で復活させず、fresh identity を使う。

初期 SSR admission と active destination switching は別の状態機械である。
このモデルの damaged は active switching の結果であり、Accepted #260 の初期 admission rollback を弱める提案ではない。

## 再実行

リポジトリのルートで実行する。

```sh
node tmp/dathomir-262-validation/delivery-races/run.mjs
```

`result.json` と `latest-run.log` に実行結果を残す。
`contract.md` はテスト前に置いた期待値、`model.test.mjs` は反例と期待動作である。

## 残る穴

- prepare が途中で資源を取得して throw した場合、その内部 rollback は prepare 側の責務として未実装。
- duplicate admission の共有予約は対象外。
- 同期 commit 中の再入は拒否している。production のキュー規則は未決定。
- resource release が throw する場合の全件 cleanup は、このモデルでは証明しない。
- association の比較は実験用の固定 field に限る。wire encoding と parser の証明ではない。
- DOM、browser history、HTTP、認証、server mutation の冪等性は未検証。

所有者は authoring contract が #262/#247、server response が #248、destination writer と世代が #249、実 consumer と browser evidence が #250/#251 となる。
追加契約の採用は利用者レビューを待つ。
