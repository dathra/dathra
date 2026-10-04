# native control から入力契約を確かめる

対象は #262 の input/formData 宣言と #249 のnative control adapterである。
P05の提案kernelと重複させず、実Chromiumのnative動作だけを観測する。
productionのAPIを実装しない。

検証前の問いは次のとおり。

- formData取得時にsubmitterを渡さないと、押したbuttonのname/valueが落ちるか。
- native validation、reset、disabled control、複数選択を一つの文字列モデルで扱えるか。
- 別のownerを想定したradioが、native groupを通して互いを書き換えるか。
- FileをJSONの境界値として扱わず、native FormDataに残す必要があるか。
- number controlのvalueだけで、入力途中の文字列を復元できるか。

観測結果はhelperの採用や全browserの保証ではない。
公開APIへの反映はレビュー対象とし、作者が利用するnative機能を一律unsupportedにしない。
