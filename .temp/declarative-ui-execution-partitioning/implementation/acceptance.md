# 実装 acceptance

<a id="implementation-acceptance-slice"></a>

## 手順 5：sliceを検証する

sliceごとの最低gateは[Gate level](./workflow.md#implementation-gate-level)に従ってください。
すべてのpure helperでfull package testとbuildを繰り返さず、package integration、WS01 integration、milestoneの境界で累積gateを実行してください。
変更が package boundary を越える場合は、consumer package と関連 playground の test も実行してください。
browser workflow、DSD、event、activation、artifact delivery に影響する場合は E2E を実行してください。

少なくとも次を確認してください。

- success、typed failure、cancel、dispose の主要 path
- stale generation、duplicate event、late settlement、resync の race
- malformed manifest、wire、codec、marker、registry の拒否
- server-only import が client artifact に入らないこと
- static DOM が client mutation plan に入らないこと
- cleanup、grant、lease、budget reservation が terminal path で解放されること
- diagnostic が root から失敗 dependency までの path を示すこと

coverage は可能な限り 100% を維持してください。
既存 threshold を下げて test を通してはいけません。
実行 command、結果、未検証事項を進捗文書へ記録してください。


<a id="implementation-acceptance-final"></a>

## 手順 9：全acceptance workを検証する

全 implementation matrix が completed になった後、設計正本の「実装時の検証事項」を先頭から一件ずつ再検証してください。
各項目について、test 名、command、artifact、benchmark、inspection result のいずれが直接証拠になるかを進捗文書に記録してください。

次の root command を最終状態で実行してください。

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm lint:type-aware
pnpm fmt:check
pnpm test:e2e
pnpm --filter @dathra/config lint
pnpm --filter @dathra/config lint:type-aware
pnpm --filter @dathra/docs build
pnpm --filter @dathra/docs build:cloudflare
pnpm --filter @dathra/docs fmt:check
pnpm --filter @dathra/docs test
pnpm --filter @playground/e2e build
pnpm --filter @playground/e2e fmt:check
pnpm --filter @playground/e2e test
pnpm --filter @playground/ssr build
pnpm --filter @playground/ssr fmt:check
pnpm --filter @playground/ssr test
pnpm --filter @playground/vanilla build
pnpm --filter @playground/vanilla fmt:check
pnpm --filter @playground/vanilla test
pnpm --filter @playground/getting-started-check build
pnpm --filter @playground/getting-started-check fmt:check
pnpm --filter @playground/getting-started-check test
pnpm --filter @playground/nuxt build
pnpm --filter @playground/nuxt fmt:check
pnpm --filter @playground/nuxt test
```

formatter は変更対象だけに適用し、無関係な repository-wide churn を起こさないでください。
失敗を `passWithNoTests`、skip、threshold 低下、snapshot の無条件更新で隠してはいけません。

`DocCodeBlock` と client root がない route については、runtime behavior だけでなく final artifact closure と delivered bytes も検査してください。
server-only highlight dependency が client artifact から到達不能であることを、bundle metadata または同等の直接証拠で示してください。

<a id="implementation-acceptance-remote-audit"></a>

## 手順 10：push後の全体監査を行う

全変更をcommit、pushした後、同一のexact remote OIDを対象とする全体監査を`high`として実行してください。
reviewerの人数、独立性、役割、evidence、blocker修正後の収束条件は[Review policy R8](../process/review-policy.md#policy-r8)に従います。
primary reviewerはSPEC、test、implementation、公開APIの完全性とcorrectnessを担当し、risk reviewerはtrust boundary、artifact closure、最終目標への適合を担当します。
両reviewerには設計正本、implementation matrix、全変更diff、関連SPEC、test、implementation、公開API、docs、playground、最終検証結果を確認させてください。

次を監査対象にしてください。

- 設計要件の未実装、部分実装、意味のすり替え
- SPEC、test、implementation の不整合
- server-only closure の client artifact 混入
- fallback または旧 hydration semantics の残存
- race、authority、budget、cleanup、wire boundary の欠落
- docs、example、public export の stale state
- acceptance evidence が requirement の範囲を直接証明しているか

監査結果は[POLICY-R8-INTEGRATE](../process/review-policy.md#policy-r8-integrate)に従って統合してください。
`blocker`が見つかった場合は該当sliceを`reopened`にして、[実装ワークフローの手順2](./workflow.md#implementation-workflow-scheduler)へ戻ってください。
修正後は[POLICY-R8-CONVERGENCE](../process/review-policy.md#policy-r8-convergence)に従い、最新の検証結果、commit、push、exact remote OIDを一人のfresh reviewerへ渡してください。
`follow-up`だけを理由に全体監査を反復してはいけません。
統合した監査結果に`blocker`がなければ、手順10の全体監査を`ACCEPT`としてください。

<a id="implementation-acceptance-completion"></a>

## 手順 11：完了を報告する

全体監査が `ACCEPT` になった後、設計正本の状態を「実装完了」へ更新してください。
進捗文書の全 implementation matrix と acceptance work を completed にしてください。

最後の文書変更もcommit、pushし、そのcommitを対象にclean treeとlocal/remote同期を再確認してください。
実装完了の状態変更、completed宣言、commit OID、gate結果だけを更新する場合は[POLICY-R8-DOCUMENT](../process/review-policy.md#policy-r8-document)の`low`として扱い、semantic reviewを追加しません。
runtime contract、owner、dependency、acceptance obligationを同時に変える場合はstatus-only更新ではないため、同policyでrisk tierを再判定してください。
`git rev-parse HEAD`と`git ls-remote --heads origin refs/heads/feature/declarative-ui-execution-partitioning`を実行し、local HEAD、tracking branch、remote branch OIDが一致することを確認してください。
手順10で監査したproduction、SPEC、test、artifactのblobが最後の文書commitで変化していないことをdeterministicに照合してください。
手順10の監査対象OIDと最新remote OIDが異なる場合でも、差分が固定したstatus-only write setだけであれば監査結果を再利用できます。
それ以外のblobが変化した場合は該当sliceを`reopened`にし、手順9から再開してください。
ユーザーへの完了報告は、最新remote OIDが監査済みcontentとstatus-only commitだけで構成され、再確認の前後で変化していない場合だけ行ってください。

ユーザーには次を報告してください。

- 実装した execution model と主要な公開 API
- 削除した旧 hydration semantics
- package ごとの主要変更
- unit、integration、E2E、artifact、benchmark の検証結果
- 残る実装上の制約
- feature branch 名、最新 commit hash、push 先
