# native historyの検証前の期待値

未解決の契約は、#262 のhistory宣言が何を自動復元できるかである。
#264 のdelivery比較を補う限定実験として、ブラウザ本来の履歴と提案ownerの復元を区別する。

1. same-documentのpushStateとBackだけでは、applicationが更新したDOMを過去の表示に戻さない。
2. history.stateは保存時のstructured cloneであり、元objectの後からの変更を反映しない。
3. 関数を含むstateはDataCloneErrorとなり、現在のURLと既存stateを変更しない。

1が成立すれば、履歴entryにdisposed owner identityを保存するだけで表示を復元できるとは扱わず、fresh responseか明示checkpoint復元を必要とする。
2と3はhistory用DTOの境界を明記する根拠になる。
実Dathraのnavigation、HTTP応答、cross-document BFCache、全browserの証明はしない。
