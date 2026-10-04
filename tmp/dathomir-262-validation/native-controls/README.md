# native form の9観測と設計への影響

Chromium 141.0.7390.37で9件のテストが通った。
これはDathraのinput adapterが実装済みという意味ではなく、adapterが守るべきnative動作の証拠である。

| 観測 | #262/#249で具体化する契約 |
|---|---|
| `new FormData(form)`は押したbuttonのname/valueを含まない。submitterを渡すと含む | `ctx.formData`が現在のsubmit操作のsubmitterを引き継ぐか、明示的に受け取るかを定義する。省略したままnative同等と呼ばない |
| required違反はsubmitを止める。formnovalidateのbuttonはsubmitできる | explicit interceptionでもnative validationとsubmitterの違いを保持する |
| 別のsection内でも同じform/nameのradioは互いのcheckedを変える | 所有範囲のDOMだけではradioの書込み範囲を閉じられない。group membershipを明示し、shared formのownerか明示したgroup契約で扱う |
| form外のradioもform属性でgroupへ参加する | DOMの包含だけでgroupを推測しない。宣言済みform関連を検証する |
| dirty valueを維持したままdefaultValueを更新でき、resetは新defaultへ戻る | live valueとreset baselineを混同しない |
| resetイベント内では旧draft、reset完了後にはdefaultが読める。cancelしたresetは旧draftを維持 | sinkをresetイベントの先頭で同期実行して旧値を復元しない。キャンセル結果を確認して同期する |
| multiple selectは同じnameの複数entry。Object.fromEntriesは一つを落とす | `FormData`を単純なobjectへ暗黙変換しない。selection adapterは集合を扱う |
| `select.selectedValues = [...]`はnative selectionを変えない | 存在しないpropertyをnative APIとして公開しない。必要なら明示adapterを作る |
| FileはFormDataで内容を保つがJSONでは`{}`。file.valueへの非空代入は拒否される | FileをSSR readonly DTOの一部へ押し込めず、native multipartや明示transportへ渡す |
| number inputに`-`を入力するとvalueは空、badInputはtrue | valueだけでは途中の文字列を復元できない。文字列draftの完全保持が必要ならtext/inputmodeか専用adapterを比較する |

radioの提案は、分離されたUIを一律unsupportedにする判断ではない。
同じnative groupとして協調する責務を一つのownerへ置く案と、明示したgroup契約を比較する必要がある。
任意のDOM探索から新しい更新権限を与えない。

## 再実行

```sh
node tmp/dathomir-262-validation/native-controls/run.mjs
```

`native.test.mjs`に実際のHTMLと操作、`observations.json`に結果、`latest-run.log`に実行ログを残した。
一つのテストが複数の関連観測を持つため、表の行数とテスト数は一致しない。
OSのIME、全browser、アクセシビリティツリーの読み上げ、実upload server、Dathraの提案input kernelは未検証。
既存のP05結果と組み合わせる際も、この9件だけでcontrolled form全体の合格とは扱わない。
