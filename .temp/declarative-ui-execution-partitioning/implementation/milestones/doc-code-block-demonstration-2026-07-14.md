# 宣言的 UI 実行分割の期限付き動作実証

この文書全体を `/goal` の実行指示として扱ってください。
2026年7月14日中に、宣言的 UI 実行分割の価値を一つの実動する縦断機能で証明してください。
調査、仕様更新、テスト、実装、検証、review、commit、pushは、ユーザーの追加承認を待たずに進めてください。

## この Goal の位置付け

長期の最終目標は次のとおりです。

> 宣言的 UI から server と client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する。

この Goal は長期目標を変更しません。
[長期implementation goal](../goal.md)の全機能を完成させるGoalでもありません。
期限までに user-visible な一経路を動かし、長期実装の方向性と実現可能性を確認するための期限付き milestone です。
`milestones/`への配置はlifecycle分類であり、現行schedulerがこのGoalを実行対象へ選んだことを意味しません。
次の優先規則は、進捗正本がこのGoalを選択した期間だけ適用します。

この Goal の作業中に限り、次の規則を優先してください。

- 本文の実装順序は、既存 implementation matrix の breadth-first な実装順序より優先する
- review unit、risk tier、reviewer数、evidence、収束上限は[Review policy R8](../../process/review-policy.md#policy-r8)に従う
- root と対象 package の `AGENTS.md`、`SPEC.typ`、`implementation.test.ts` を正本とする規則は維持する
- Accepted ADR の意味内容を直接変更しない規則は維持する
- 既存の user changes を破棄、revert、上書きしない規則は維持する

この Goal が完了または中断した時点で、一時的な優先規則は終了します。
長期実装へ戻る前に、この milestone で生じた暫定実装と follow-up を進捗文書へ引き継いでください。

## 動作実証の対象

`docs/src/components/DocCodeBlock/DocCodeBlock.tsx` を起点に、次の一経路を完成させてください。

1. syntax highlight は server で実行する
2. highlighted HTML は SSR 出力に含める
3. highlighted subtree は browser で再構築しない
4. copy interaction に必要な処理だけを browser で利用可能にする
5. server-only な syntax highlight の実装と依存 package を client artifact に含めない

対象ファイルの実際の構成が変わっている場合は、同じユーザー体験を所有する現在の component と route を特定して対象にしてください。

## 完了条件

次の条件をすべて満たした場合だけ、この Goal を完了扱いにしてください。

- JavaScript を無効にしても、対象 code block が highlight 済み HTML として表示される
- JavaScript を有効にすると、copy 操作が browser 上で成功する
- copy interaction の activation によって highlighted subtree を再生成または全面 rerender しない
- client artifact の検査で、syntax highlight の server-only module と依存 package が含まれていないことを確認できる
- 対象 package の build、typecheck、lint、unit test が成功する
- production 相当の docs build が成功する
- 対象経路の Playwright E2E が成功する
- R8 reviewで未解決のblockerが残っていない
- milestone に関係する変更だけを commit し、現在の作業 branch へ push している

完了報告には、実行した command、bundle inspection の対象 artifact、E2E の結果、commit hash、push 先を記載してください。
この milestone の完了を、長期 implementation goal 全体の完了として報告してはいけません。

## 許可する暫定手段

既存の SSR、transformer、runtime、hydration または activation mechanism は再利用して構いません。
完全な reactive graph inference が未完成の場合は、copy interaction の client root を指定する既存 mechanism または最小の内部 adapter を利用して構いません。

暫定手段には次の制約を課してください。

- 新しい恒久的な public API として公開しない
- `DocCodeBlock` 固有の server-only 処理を汎用 client bundle へ含めない
- server component 全体を browser で再実行する fallback にしない
- 後から inferred client root の結果へ置換できる単一の内部境界へ隔離する
- 暫定である理由と置換条件を進捗文書へ記録する

既存の `client:*` 相当の記法を利用する場合も、長期設計として再採用したとは扱わないでください。
この Goal では、最小経路の動作実証に限定した adapter として扱います。

## 対象外

次の作業は、この Goal の完了に必要な場合を除いて開始しないでください。

- 汎用 reactive graph analyzer の完成
- signal、effect、closure、resource の完全な server/client 配置
- 全 artifact identity、integrity、manifest、authority protocol の完成
- 新しい browser runtime 全体の完成
- 旧 hydration API の全面削除
- 全 component、docs、playground の移行
- 既存 implementation matrix の未完了 foundation を順番に埋める作業
- repository 全体の無関係な baseline failure の修正
- milestone に不要な refactor、命名変更、format churn

対象外の不足を発見した場合は follow-up として記録し、現在の縦断経路を妨げない限り作業を広げないでください。

## 実装単位

次の順序で、一つずつ green にできる vertical slice として進めてください。

### DR00：現在地と最短経路の確認

- `git status`、HEAD、tracking branch、既存の未コミット変更を記録する
- `DocCodeBlock` から SSR、transformer、browser runtime までの現行経路を確認する
- 再利用する既存 mechanism と、変更が必要な最小 write set を決める
- 対象 package と docs の targeted baseline だけを実行する

調査だけで60分を超えないでください。
完全な長期設計が必要だと判明しても、この milestone では内部 adapter で境界を作れるかを先に検証してください。

### DR01：server 出力

- syntax highlight の計算を server 側の責務として分離する
- highlighted HTML を SSR 出力へ含める
- JavaScript 無効時の表示を test で固定する
- client interaction がなくても単独で green になる状態にする

### DR02：client interaction

- copy interaction だけを client 側で利用可能にする
- 必要最小限の値だけを server から client へ渡す
- event attachment と copy 成功を test で固定する
- highlighted subtree を再生成しないことを確認する

### DR03：artifact 分離

- client artifact を生成する
- syntax highlight の server-only module と依存 package が含まれないことを機械的に検査する
- 漏洩を検出できる targeted test または artifact inspection command を残す

### DR04：ユーザー経路の検証

- production 相当の docs build を実行する
- JavaScript 無効時の SSR 表示を Playwright で検証する
- JavaScript 有効時の copy interaction を Playwright で検証する
- 対象 package の build、typecheck、lint、test を実行する
- 既知の制約と長期 Goal へ戻す follow-up を進捗文書へ記録する

各 slice は、一つの観測可能な振る舞いだけを完成させてください。
手書き差分が合計600行を超える見込み、または一つの手書きファイルの差分が400行を超える見込みになった場合は、実装を続ける前に責務を再分割してください。
行数を減らすために test や SPEC を省略してはいけません。

## 仕様と実装

production code を変更する場合は、対象 API の `SPEC.typ` と `implementation.test.ts` を先に更新してください。
その後に `implementation.ts` または内部 module を変更してください。
slice 終了時には、SPEC、test、implementation を相互に整合させてください。

新しい API directory が必要な場合は、repository の四点セット構成に従ってください。
一つの `implementation.ts` に SSR、artifact selection、browser activation、E2E support を集約してはいけません。

新しい設計判断を避けられない場合は、長期契約を広げず、この milestone に必要な可逆な内部判断を選んでください。
Accepted ADR を変更する必要がある場合だけ、superseding ADR を追加してください。

## Review scope

review の目的は、期限内の動作実証を壊す correctness issue と、長期目標への復帰を妨げる不可逆な判断を検出することです。
全履歴、既存の約7万行の変更、implementation matrix 全体を再レビューしてはいけません。

各sliceのtargeted gateが成功した後、今回のsliceの差分だけを[Review policy R8](../../process/review-policy.md#policy-r8)へ渡してください。
このmilestoneはreviewer数、evidence、反復回数を上書きしません。

reviewer には、次の項目だけを blocker として評価させてください。

- 完了条件を満たせない correctness issue
- server-only code または依存 package の client artifact への漏洩
- SSR 出力、copy interaction、既存の対象経路を壊す regression
- security、data corruption、無制限な処理を生む問題
- 長期設計へ置換できない public contract または責務の固定化
- test が実装の成功条件を実際には検証していない問題

次の項目は、現在の動作実証を壊さない限り follow-up としてください。

- 命名と内部 abstraction の改善
- 汎用化と追加 component への展開
- 長期 reactive graph の網羅性
- milestone の対象外にある性能改善
- docs 全体と playground 全体の移行
- 将来の API ergonomics

review resultの形式、統合、blocker修正後の収束は[POLICY-R8-INTEGRATE](../../process/review-policy.md#policy-r8-integrate)と[POLICY-R8-CONVERGENCE](../../process/review-policy.md#policy-r8-convergence)に従ってください。

## 検証

全 repository の baseline repair を先に完了しようとしてはいけません。
まず対象 package、docs build、対象 E2E、client artifact inspection を実行してください。
無関係な既存 failure は再現条件を記録し、この milestone を直接妨げる場合だけ修正対象にしてください。

最低限、次の証拠を残してください。

- JavaScript 無効時に highlight 済み HTML が存在する E2E assertion
- JavaScript 有効時に copy 操作が成功する E2E assertion
- highlighted subtree が activation 前後で再生成されないことを示す assertion または DOM identity の検査
- client artifact に server-only highlight dependency がないことを示す command と結果
- 対象 package の build、typecheck、lint、test の結果
- production 相当の docs build の結果

test を弱める、skip する、常に成功する command へ置き換える方法で期限を満たしてはいけません。

## 時間超過への対応

一つの問題について90分間、完了条件に近づく観測可能な進展がない場合は、その問題の一般化を停止してください。
既存 mechanism の再利用、内部 adapter、対象 component 固有の小さな境界へ戻し、縦断経路を先に完成させてください。

deadline までに全条件を満たせない見込みになった場合は、次の順序を守って範囲を縮小してください。

1. 追加 component と汎用化を外す
2. 自動推論を外し、置換可能な内部 adapter にする
3. 長期 runtime との統合を外し、既存 runtime を再利用する

次の条件は範囲から外してはいけません。

- server で生成された highlighted HTML
- browser で動作する copy interaction
- client artifact からの server-only dependency の除外
- build と E2E による検証

## Commit と push

既存の未コミット変更を自動的に今回の commit へ含めてはいけません。
今回の milestone に必要な変更だけを path 単位で stage してください。
既存変更と同じ file を変更する必要がある場合は、既存変更を保持したまま意図を確認し、今回の差分として説明できる状態にしてください。

各 slice を必ず個別 push する必要はありません。
すべての完了条件とR8 reviewを満たした後、意味的に説明できる一つ以上のcommitを作り、現在のtracking branchへ一回pushしてください。
force push は禁止します。

push 後に local HEAD と remote branch の OID を確認してください。
その後、完了した条件、暫定 adapter、未完了の長期作業、follow-up をユーザーへ報告してください。
