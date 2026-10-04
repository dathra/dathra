# native historyの3観測

Chromium 141.0.7390.37で3件が通った。
同一document内の履歴を対象とし、実Dathraのnavigation実装やcross-document BFCacheは対象外である。

| 観測 | 提案への影響 |
|---|---|
| pushState後にapplicationが変更したDOMは、Backのpopstateだけでは戻らない | URLとhistory DTOを受け取った後、fresh responseか明示checkpointから表示を更新する必要がある |
| 保存後に元のnested objectを変更してもhistory.stateは変わらない | checkpointは保存時のsnapshotであり、現在のdraftの参照とは扱わない |
| 関数を含むstateはDataCloneErrorとなり、直前のURLとstateを維持する | Signalや実行handleをそのまま保存せず、明示DTOを検証してからhistoryへ渡す |

Backで未完draftを戻すか、最後の確定queryを戻すかはアプリの判断として残る。
この3件から一律のdraft保持policyは決めない。
履歴entryにdisposed owner identityを記録しても、そのownerが再び有効になる根拠にはならない。

deliveryの状態モデルで区別した「destinationはcommit済みだがhistory更新は失敗」という状態は、productionで独立に扱う必要がある。
この実験はその組合せを実装せず、browser側の失敗条件と限界を確認した。

## 再実行

```sh
node tmp/dathomir-262-validation/native-history/run.mjs
```

`contract.md`が実験前の期待値、`history.test.mjs`が操作と検査、`observations.json`が結果である。
Playwrightのrouteでsame-originのHTMLを返しているため、実HTTP serverやtransportは証明しない。
全browser、scroll restoration、cross-document navigation、BFCache、storage quota、Dathraのdraft codecは未検証である。
所有する後続は #262 のhistory契約、#249 のnavigation実装、#250/#251 のconsumerとbrowser証拠となる。
