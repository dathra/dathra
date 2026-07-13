# 宣言的 UI 実行分割の実装指示

この文書全体を `/goal` の実行指示として扱ってください。
ユーザーの承認を待たず、調査、仕様更新、テスト作成、実装、移行、検証、レビュー、commit、push を自律的に進めてください。

## 最終目標

最終目標は次のとおりです。

> 宣言的 UI から server と client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する設計を、Dathra の production code、仕様、テスト、公開 API、文書、playground に実装する。

`.temp/declarative-ui-execution-partitioning/README.md` と、そこから参照される `decisions/` 配下の担当文書を execution partitioning の設計判断の正本として扱ってください。
同文書の「破棄した案」を除く規範本文、解決済みの設計事項、実装時の検証事項を実装要件とします。

この goal は production code の変更を明示的に許可します。
設計文書に残る「実装未着手」と「production code を変更しない」という記述は、設計フェーズの完了時点を表す状態記録です。
実装開始時に状態を「実装中」へ更新してください。
[acceptanceの手順10](./acceptance.md#implementation-acceptance-remote-audit)の全体監査が`ACCEPT`になった後に「実装完了」へ更新してください。
[手順11](./acceptance.md#implementation-acceptance-completion)で最新remote OIDと監査済みcontentの一致を確認した後だけgoalを完了してください。

後方互換性は制約にしません。
設計正本が削除を決めた hydration API、island semantics、fallback は、互換 layer を残さず置き換えてください。
ただし、`@dathra/store` の snapshot API など、UI hydration と無関係な同名 API を文字列一致だけで削除してはいけません。

この goal の実行開始を、大規模変更の実装アプローチに対するユーザーの承認として扱ってください。
設計、優先順位、実装方法についてユーザーへ追加承認を求めないでください。

設計および実装の独立reviewは[`POLICY-R8`](../process/review-policy.md#policy-r8)に従ってください。
設計検討専用の[`design-workflow.md`](../process/design-workflow.md)にある「production codeの実装は開始しない」という条件は、このimplementation goalへ持ち込みません。

## 正本と優先順位

実装判断では、次の資料を照合してください。

1. root と対象 package の `AGENTS.md`
2. `.temp/declarative-ui-execution-partitioning/README.md` が参照する担当文書の現行方針
3. 対象 API と同じディレクトリの `SPEC.typ`
4. 対象 API と同じディレクトリの `implementation.test.ts`
5. compiler、runtime、plugin、components、core、docs、playground の実コード
6. 依存 package、Web 標準、外部技術の一次資料

現行 `implementation.ts` は既存実装を調査する根拠ですが、新仕様の正本ではありません。
新しい振る舞いは設計正本から対象 package の `SPEC.typ` へ落とし込み、その仕様を `implementation.test.ts` で検証してから実装してください。

Accepted ADR の意味内容を直接書き換えてはいけません。
既存 ADR と新設計が衝突する場合は、既存 ADR を supersede する新しい ADR を追加してください。

設計正本に実装不能な矛盾が見つかった場合は、都合のよい fallback を実装してはいけません。
該当事項を未決事項へ戻し、[設計決定ワークフロー](../process/design-workflow.md#design-workflow-proposal-review)でsuperseding decisionを確定してから実装を再開してください。

## 完了条件

次の条件をすべて満たすまで goal を完了扱いにしてはいけません。

- 設計正本の実装方針 1 から 8 が production code とテストへ反映されている
- 設計正本の「実装時の検証事項」を一件ずつ検証し、証拠を記録している
- compiler が ExecutionGraph、ObservationContract、MaterializationPlan、ClientScopeGraph から server/client 配置を導出する
- server-only code、依存 package、resource が client artifact closure に入らない
- server が生成した HTML と DSD を component body の再実行なしで activation できる
- client root がない route では bootstrap と request payload が生成されない
- `DocCodeBlock` の syntax highlight と highlighted subtree が server に残り、copy interaction だけが client artifact に入る
- `render:client`、`activate:*`、`dom:external` と関連 diagnostic が設計どおりに動作する
- reference、subscription、remote operation、failure、cleanup、budget、authority の state machine が設計契約を満たす
- subscription の session incarnation と owner/session pair fence が revision、terminal event、acknowledgement の race を拒否する
- remote operation の private object、wire DTO、verified receipt が環境境界で混同されない
- 旧 `client:*` hydration semantics、`hydrate:*`、component hydrate option、island scheduler、manual UI hydrate API、rerender fallback が削除されている
- components、runtime、transformer、plugin、core の公開 export と JSDoc が新しい API に一致する
- docs と playground が旧 hydration の説明や利用例を残していない
- docs と全 playground が実処理を持つ `build`、`fmt:check`、`test` gate を公開し、no-op script なしで成功する
- package ごとの SPEC、test、implementation が相互に整合している
- unit test、integration test、E2E、build、typecheck、lint、format check が成功する
- 独立した sub-agent による push 後の全体監査が `ACCEPT` になる
- 作業ツリーが clean で、local HEAD と remote branch が同じ commit を指している

interface と placeholder だけを追加した状態、旧実装と新実装を並存させた状態、一部 package だけを移行した状態は完了ではありません。
既存テストが通ることだけを、新しい設計の実装証拠にしてはいけません。
