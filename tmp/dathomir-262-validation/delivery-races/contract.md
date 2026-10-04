# fresh delivery の競合検証

所有する判断は #262 の通信宣言と、#248/#249 の destination 切替契約である。
本資料とコードは採用前の実験であり、production runtime を実装しない。

## 検証前に置く期待値

- 同じ表示先への新しい要求が始まった後、古い要求は表示を上書きしない。
  operation channel が異なる場合も同じとする。
  新しい要求の失敗後に古い要求を自動復活させない。
- 別の表示先への要求は互いを失効させない。
- destination の検証と準備が終わるまでは source の表示と owner を維持する。
- 準備中に失効した destination は provisional resource を破棄する。
- response identity が再利用された場合は拒否する。
  Back 用 DTO から fresh response を得ることと、disposed identity の再利用を区別する。
- source の終了が同期 callback を呼んでも、旧 owner の書込み権限は既に失効している。
- commit 前の失敗は source を維持する。
  commit が不可逆な変更をした後の失敗は damaged として明示する。
  全 DOM と history の rollback ができたとは扱わない。
- history 書込みの失敗は、既に commit した destination と区別して報告する。

## 比較する案

1. channel ごとの token だけで通信結果を抑止する。
2. channel の寿命に加え、表示先ごとの要求世代を照合する。

案1の反例が再現した場合、案2の世代がどの操作で進むかを #262 の未採用契約として提案する。
本実験の last-intent-wins は destination replacement 用の案であり、append stream や merge operation の既定動作を決めない。

## 証拠の限界

手動で解決する Promise と fault injection を使う状態モデルである。
HTTP、実 DOM、history API、認証、server command の冪等性を証明しない。
単一 JavaScript turn の同期 commit を仮定する。
実際の DOM callback と reentrancy は別の検証が必要となる。
