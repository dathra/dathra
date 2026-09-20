#import "../../../functions.typ": *
#import "../../../settings.typ": *
#show: apply-settings

= Task `#252`: 初回consumerとbaseline evidence

この文書はIssue `#252` の調査と検証準備で得たevidenceである。
Issue本文がTaskのscopeを所有し、この文書が候補比較、observable behavior、固定SHAのbaseline、測定条件、評価基準への証拠を所有する。
この文書は設計Proposalではなく、`#245` のexecution model、authoring API、support policyを決定しない。

== Evidence status

Requirements coverageは公開準備時点の来歴と、利用者が承認した受入scopeへの現在の対応を区別する。
利用者は未承認事項を残したままcommit、push、Draft PR作成、Issue `#252` への記録を許可した。
公開後のPR URL、commit SHA、検証結果、開始情報はIssue `#252` の公開コメントを参照する。
この許可は受入条件の達成、設計の承認、merge、Issue closeを含まない。

候補比較とhistorical baselineを保持し、永続collectorによる二つの新cohort、全sample、分布比較を追加した。
別の補足測定でrenderer scriptのthread CPU time、bundle別のCPU sample、GC後のheapとDOM counter、正常系の限定したsource rangeの実行回数を追加した。
個別moduleの厳密なCPU self-time、store別のretained bytes、禁止実行全体の保証、受入条件には未完了の項目がある。
測定補助と文書への独立reviewは完了し、指摘されたverifierの2件の欠落を修正した。修正差分の再reviewでも両件の解消を確認した。
performanceの許容差は未承認であり、#link("https://github.com/dathra/dathra/pull/255")[Draft PR `#255`]と#link("https://github.com/dathra/dathra/issues/252#issuecomment-5660080642")[Issue公開コメント]は2026-09-14に公開済みである。
利用者は性能thresholdを未承認のまま引き継ぐ方針を選択した。
その時点ではthresholdの承認やIssueの受入条件変更ではなかった。
その後、利用者が2026-09-20の構造化質問へ「変更して進める（推奨）」と明示回答し、evidence Taskの受入scope変更を承認した。
#link("https://github.com/dathra/dathra/issues/252#issuecomment-5749435987")[承認記録]と更新後のIssue本文を現在の受入根拠とする。
性能thresholdと製品契約の仮説は未承認のままであり、merge前のIssueはopenを維持する。

- owning Issue：`#252`、type `Task`、parent `#251`
- source SHA：`c1a30ed86fd2bd79e1c742362f552e9f62ff9f98`
- base：`origin/main`
- branch：`docs/task-252-select-consumer-baseline`
- lockfile SHA-256：`b9bd2b4e2e061437b8a1e7aae7c7f9c43d63ca7fc34e6ff6e9beaf6f4665c3c0`
- worktree：`/home/kcatt/dev/dathomir-issue-252`
- Issueのbranch、base、開始SHA：上記公開コメントへ記録済み

== Selected consumer

2026-09-14にIssue `#252` の更新本文と#link("https://github.com/dathra/dathra/issues/252#issuecomment-5660613142")[利用者の方針確認コメント]を再読した。
`#245` と `#253` の更新本文も確認し、専用compilerとJSXの必要性は `#253` が独立に判断する未決事項として扱う。
2026-09-14の委任はこの文書の説明修正だけであり、方式比較、prototype、production変更、再測定、consumerの選び直し、commit、push、GitHub書き込みは行わなかった。
2026-09-20の委任では、この説明差分の検証、commit、push、PRとIssueの更新が許可された。
固定SHAのbaseline、collector、raw JSON、thresholdと受入条件の承認状態は保持する。

初回sliceのconsumerには、`@playground/e2e` の `/store-snapshot-roundtrip` を選ぶ。
このrouteは、server側で作ったstore snapshotをDeclarative Shadow DOMへ出力し、browser側の既存custom elementがそのsnapshotを復元し、button操作で同じstateを更新する。
この一つのconsumerで、server表示、client activation、反復操作、reactive state update、disposal後の残存を同じURLから観測できる。
この選定は観測できる挙動と再現性に基づき、現行JSX、専用compilerによる自動分割、特定の生成artifactの維持を条件にしない。
以下のDSD、snapshot script、内部API、生成物への参照は固定SHAの現行実装を特定するものであり、次方式へ同じ構造を要求するものではない。

選定理由は、単に旧Proposalが参照していたからではない。
`playgrounds/e2e/src/entry-server.tsx:20-50` がroute専用の`count: 7` と`theme: "snapshot-midnight"`を作り、`storeSnapshotSchema`を`renderDSD`へ渡す。
`playgrounds/e2e/src/routes/store-snapshot-roundtrip.tsx:36-110` がSSR表示、snapshot復元、button操作、cleanup意図を一つのconsumerとして実装している。
`playgrounds/e2e/src/routes/store-snapshot-roundtrip.test.ts:18-53` がHTML、復元値、client更新を既存testとして検証している。

`docs` の実consumerも比較した。
`docs/src/pages/ReactivityPage.tsx:18-69` は`DocCodeBlock`を5個使い、`docs/src/components/DocCodeBlock/DocCodeBlock.tsx:114-169` はserver側のhighlight結果、Copy操作、reactiveな`copied` state、`onCleanup`を持つ。
しかし、現行production buildの`/reactivity`では5個のSSR code blockが表示されても、browserでCopyをclickした後のlabelは`Copy`のままだった。
このcandidateは実在するが、現行baselineではclient interactionを満たさないため初回sliceには選ばない。

候補の比較結果は次のとおりである。

- `/store-snapshot-roundtrip`：SSR snapshot、client復元、`7 -> 8`のstate update、反復click、disposal後の残存を観測できる。初回sliceに選定する。
- `/als`：SSRのAsyncLocalStorage伝播とparallel requestの分離を観測できるが、snapshot復元とcomponent cleanupを一つのscenarioで扱わない。
- `/nested-boundary`：nested hostのhydrationとouter updateを観測できるが、server state transferとcleanupの専用観測を持たない。
- `/deferred-strategies`：idle、media、visible activationと`onCleanup`を観測できるが、反復client state updateを持たない。
- `/mismatch-fallback`：hydration mismatch後のfallbackを観測できるが、正常なserver state transferの代表ではない。
- `docs /reactivity`：実際のdocs consumerだが、現行baselineではCopy activationが接続されない。
- `/`：server-onlyに見えるが、`entry-client.ts`が全routeで`appRoot`をimportし、`hydrateIslands(document)`を起動するためzero-client-rootのcontrolにはならない。

== Historical behavior evidence

S-01からS-07の以下の記録は過去の観測である。
新しいcollectorの手順や来歴を過去のsampleへ遡及して適用しない。
新cohortの対応結果はFresh browser evidenceに記録する。

=== S-01 SSR snapshot output

*Expected*：server responseは`data-dh-store`を含み、`snapshot-midnight`をsnapshotへ含める。
既存testはhydration後の初期countを`7`として扱うが、SSR HTMLではhydration markerが`Count:`と`7`の間に入るため、文字列`Count: 7`の連続出現は期待しない。

*Basis*：`packages/store/src/defineAtomStoreSnapshot/SPEC.typ:40-53`、`playgrounds/e2e/src/routes/store-snapshot-roundtrip.test.ts:18-22`。

*Observed*：`GET /store-snapshot-roundtrip`は`200`を返し、HTMLは2,573 bytesだった。
HTMLには`<script type="application/json" data-dh-store>[{"count":1,"theme":2},7,"snapshot-midnight"]</script>`と、`Count:`、hydration marker、`7`を順に含むSSR outputがある。

*Collection input*：`/tmp/opencode/route-252.html`、`/tmp/opencode/route-252-headers.txt`。
最終evidenceはこの節に埋め込んだHTML断片とHTML SHA-256 `0268538f09fbb83ce734a997a2c2907eb43fa5adfb39e0236b8fb349fe8ce9f8`であり、一時パスを唯一の根拠にしない。

=== S-02 Snapshot activation

*Expected*：既存DSDを保持したままclient側でsnapshotをstoreへhydrateし、theme `snapshot-midnight` とcount `7`を表示する。
snapshot scriptはactivation中に消費され、client component hostとそのShadowRootは残る。

*Basis*：`packages/components/src/defineComponent/SPEC.typ:137-153`、`packages/store/src/defineAtomStoreSnapshot/SPEC.typ:40-53`、`playgrounds/e2e/src/routes/store-snapshot-roundtrip.tsx:55-79`。

*Observed*：Chrome 145で`e2e-ssr-app`のShadowRootと、その内側の`e2e-store-snapshot-roundtrip-fixture`のShadowRootを探索すると、activation後もhost数は各1だった。
表示は`Theme: snapshot-midnight`、`Count: 7`で、root内の`script[data-dh-store]`は0個になった。

*Evidence*：Chrome DevToolsで記録したnavigation/snapshot-removal samples A-Eをこの文書へ転記し、sourceは`playgrounds/e2e/src/routes/store-snapshot-roundtrip.tsx:55-105`である。

=== S-03 Repeated state update

*Expected*：activeなbuttonを5回clickすると、initial count `7`から`12`へ進み、各operationが同じclient storeの値を使って表示を更新する。
これはTaskの反復操作要求とroute実装から置いた検証仮説であり、framework全体の新しい製品契約には昇格させない。

*Basis*：`playgrounds/e2e/src/routes/store-snapshot-roundtrip.tsx:95-106`、既存testの単一click検証 `playgrounds/e2e/src/routes/store-snapshot-roundtrip.test.ts:42-50`。

*Observed*：5回のbrowser runすべてで、5回のclick後に`Count: 12`になった。
同期click handler elapsedは25回のclickで0.0-4.7ms、最初のclickをwarm-upとして除いた20回では0.0-0.1msだった。
この同期elapsedは過去の集計値のみで、個別sampleと中央値をこの文書へ保存していないため、完全な測定証跡として扱わない。
clickから次の`requestAnimationFrame`までの20回のwarm-up後sampleは3.7-17.4ms、中央値16.45msだった。

*Evidence*：Chrome DevTools evaluate samples I-1 through I-5をこの文書へ転記した。既存testは`playgrounds/e2e/src/routes/store-snapshot-roundtrip.test.ts:18-53`である。

=== S-04 Disposal after removal

*Expected*：component hostをDOMから除去した後、旧buttonのlistenerは無効になり、切断済みShadowRootのDOMやstateをlate clickが変更しない。
この期待値はrouteのlistener cleanup意図から置いたconsumer検証仮説である。
既存のdisconnected cleanup契約はowner/rootに登録したcleanupを対象とし、`void`のhydrate callbackから返した関数の登録を保証しない。

*Basis*：`playgrounds/e2e/src/routes/store-snapshot-roundtrip.tsx:100-109`、`packages/components/src/defineComponent/SPEC.typ:182-193`、`packages/components/src/defineComponent/SPEC.typ:153`、`packages/components/src/defineComponent/implementation.ts:1305-1316`。

*Observed*：fresh reload後、初期`Count: 7`を保持したfixture hostをremoveし、切断済みbuttonをclickすると、そのDetached ShadowRootの表示が`Count: 8`へ変化した。
したがって、このbaselineではrouteのhydrate callbackが返すlistener cleanupが実行されていない。

*Cause evidence*：routeは`hydrate` callbackから関数をreturnするが、`HydrateSetupFunction`の戻り値は`void`であり、`createClientDefinedComponent`の`runHydrate`は`hydrateSetup!(ctx)`の戻り値を保存せず、`createRoot`のdisposeだけを`#dispose`へ保存する。
このTaskではproduction codeを修正しない。

=== S-05 Failure behavior

*Expected*：snapshotが欠落または不正な場合のfailure outcomeは、SSR DOMを黙って別のclient renderへ置き換えず、観測可能な診断とresource cleanupを持つ必要がある。
具体的なfailure UI、diagnostic wording、fallback policyはこのTaskで決定しない。

*Basis*：`#245` のno-reconstruction、no-fallback原則、`playgrounds/e2e/src/routes/store-snapshot-roundtrip.tsx:12-34`、`packages/components/src/defineComponent/SPEC.typ:142-145`。

*Observed*：selected routeで欠落、shape不一致、malformed snapshotをbrowserへ投入するfailure injectionを実行した。
measurement-onlyの`ShadowRoot.prototype.querySelector` wrapperで、hydrate callbackが読むsnapshotを3通りに差し替えた。

- snapshot missing：client表示は`Theme: client-default`、`Count: 0`になり、snapshot scriptは残った。button click後は`Count: 1`になり、custom diagnosticは出なかった。
- shape mismatch（`[]`）：client表示は`Theme: client-default`、`Count: 0`になり、snapshot scriptは除去された。button click後は`Count: 1`になり、custom diagnosticは出なかった。
- malformed JSON（`not-json`）：SSR表示の`Theme: snapshot-midnight`、`Count: 7`を保持し、snapshot scriptも残った。hydrate error `[dathra] Error in component hydrate: SyntaxError`が出て、button click後も`Count: 7`だった。

`decodeSerializedSnapshot`はshape不一致を`null`にする一方、malformed JSONでは例外を投げるため、3つのoutcomeは分けて記録する。

*Evidence status*：failure injectionは実測済みだが、期待するfailure contractは未承認である。
missingとshape mismatchのsilent defaultは成功、fallback同等、またはbehavior同等として扱わない。

=== S-06 Zero-client-root control

*Expected*：complete accepted planがclient rootを持たないrouteは、client entry、bootstrap、activation resourceを出力しない。

*Basis*：`#245` のzero-client-root completion criteria、`SPEC/proposals/103-declarative-ui-execution-partitioning/110.typ:219-231`。

このhistorical記録の「complete accepted plan」と旧 `#103` 文書への参照は当時の説明として保持する。
現在の必須条件の根拠は `#245` であり、次方式にcompilerによるplan生成や旧artifact構造を要求しない。

*Observed*：`@playground/e2e`の`/`を取得すると、SSR HTMLに`/assets/main-y28fv6Un.js`のmodule scriptと`<e2e-ssr-app>`がある。
browserで`/`を開くとhome titleが表示され、resourceは`main-y28fv6Un.js`と`appRoot-C_yo0zt-.js`の2件だった。
encoded body bytesはそれぞれ52,529と33,428、documentはencoded 1,653 bytesだった。
`playgrounds/e2e/src/entry-client.ts:6-9`はrouteに関係なく`appRoot`をimportし、`hydrateIslands(document)`を呼ぶ。
既存のe2e playgroundにはzero-client-rootのcontrol routeは存在しない。

*Collection input*：`/tmp/opencode/task-252-e2e-home.html`。
最終evidenceはこの節に埋め込んだscriptとhostの断片、SHA-256 `9091116ee7b866d123aec12841efe060baaa6d2ce45e8359711ad73fb933cbfe`、`playgrounds/e2e/src/routes.ts:1-17`、`playgrounds/e2e/src/entry-client.ts:1-10`である。

zero-client-rootのcontrolが存在しないため、後続Taskへ次のcontrol fixtureを提案する。
fixtureはserver-only HTMLを返し、Dathra custom element、client entry script、Dathra bootstrap、activation resourceを持たない。
同じbrowser計測でdocumentを取得し、module script request、Dathra client artifact request、activation hook、client-created DOMが0件であることを期待値とする。
このTaskではfixtureを追加しない。

=== S-07 Docs consumer comparison

*Expected*：actual docs consumerはSSR code blockを保持し、client Copy interactionが既存hostへ接続され、repeated operationとcleanupを観測できる。

*Basis*：`docs/src/pages/ReactivityPage.tsx:18-69`、`docs/src/components/DocCodeBlock/DocCodeBlock.tsx:114-169`、`docs/src/entry-server.tsx:8-44`。

*Observed*：production `/reactivity`は5個の`dathra-code` host、5個のhighlighted `pre.shiki`、5個の`Copy` buttonをSSRした。
browserで最初のbuttonをclickしてもlabelは`Copy`のままで、1900ms後も`Copy`だった。
現行のclient pathではこのDSD componentにclient activationが接続されていない。

*Collection input*：`/tmp/opencode/task-252-docs-reactivity.html`。
最終evidenceはこの節に埋め込んだ5 host、5 highlighted block、Copy observationとHTML SHA-256 `7d1b48331bdb1c27784a7d09359618905b41a402419036e7518b07f7911c4df3`である。

== Historical production baseline

=== Environment

- source：`c1a30ed86fd2bd79e1c742362f552e9f62ff9f98`
- lockfile：`pnpm-lock.yaml` SHA-256 `b9bd2b4e2e061437b8a1e7aae7c7f9c43d63ca7fc34e6ff6e9beaf6f4665c3c0`
- Node：`v24.19.0`
- pnpm：`10.17.1`
- browser：Chrome `145.0.0.0`
- OS：Linux `6.18.33.2-microsoft-standard-WSL2`
- viewport：`1600x1000`
- device pixel ratio：`0.8`
- network：localhost HTTP/1.1、throttlingなし
- cache：Chrome DevTools reload with `ignoreCache: true`
- build：`pnpm --filter @playground/e2e build`
- preview：`PORT=3190 pnpm --filter @playground/e2e preview`
- URL：`http://127.0.0.1:3190/store-snapshot-roundtrip`
- observation interval：navigationとloadのtimestamp、および`script[data-dh-store]` removalのtimestampをそれぞれ収集

`pnpm --filter @playground/e2e test` はbuildを含めて成功し、15 test filesと15 testsがpassした。
実行時間は29.62秒だった。
build中には既存のplugin warning（`MIXED_EXPORTS`とRollup型の`IMPORT_IS_UNDEFINED`）が出たが、buildとtestは失敗していない。

=== Artifacts

- `playgrounds/e2e/dist/client/index.html`：1,378 bytes、SHA-256 `4c57b9149e99477036ac718faed29d23e49dccc080266d2a6a605f29cff1ae1e`
- `playgrounds/e2e/dist/client/assets/main-y28fv6Un.js`：52,529 bytes、SHA-256 `055a73be9762faf69e16582c55eb6d46df4082abddbc6c6a1f0cfcb1541c59cc`
- `playgrounds/e2e/dist/client/assets/appRoot-C_yo0zt-.js`：33,428 bytes、SHA-256 `ad727a68b2ec2c68b04df6b972add372a9b6056ad5f542c999c0d43c6a2d91fd`
- `playgrounds/e2e/dist/server/entry-server.js`：130,451 bytes、SHA-256 `a52b664c86203828ac802c00add856e65a1b8e4f5372ab9b2d4a004bba791181`
- docs `dist/client/index.html`：1,778 bytes、SHA-256 `12329a2aff1af3b02461acf8856879689f6b16e5b39d99d5f3376fd27b563ae9`
- docs `dist/client/assets/main-DoZ2D7Hc.js`：52,156 bytes、SHA-256 `34a3b0de17a4aff580e79183c4f71c163df232643ca9a9ccefe842e232cbad81`
- docs `dist/client/assets/DocsAppRoot-BRfkl5ir.js`：102,441 bytes、SHA-256 `c36035c5ec17984c984d983122e9fab22b6a47eb99fa3757d32b38f9df8b6c3c`
- docs `dist/server/entry-server.js`：192,400 bytes、SHA-256 `ff628ed433d5702d523db60a521eb10d6cc3e0b94243fdcfdd92ef76740ace54`

=== Fresh checkout reproducibility

`c1a30ed86fd2bd79e1c742362f552e9f62ff9f98`から`/tmp/opencode/task-252-fresh`へdetached worktreeを作った。
そこで`pnpm install --frozen-lockfile --offline`を実行し、e2e build/testとdocs build/testを再実行した。
e2eとdocsの4つずつのproduction artifactについて、元worktreeとの`cmp`がすべて成功した。
fresh worktreeは`git status`がcleanであり、別のsource変更を含まない。
この過去の実行で再現したのはbuild、既存test、artifactだけである。
当時未実施だったブラウザー計測は、Fresh browser evidenceで別の手順とcohortとして追加した。

以下は元worktreeのbrowser cohortで観測したresourceであり、fresh worktreeの再計測ではない。
Normal routeのbrowser resourceは、documentのほかに次の3件だった。

- `main-y28fv6Un.js`：encoded 52,529 bytes、transfer 52,829 bytes
- `appRoot-C_yo0zt-.js`：encoded 33,428 bytes、transfer 33,728 bytes
- `/favicon.ico`：encoded 9 bytes、transfer 309 bytes。これはpreviewの404 console errorであり、selected consumerのbehaviorとは分離する。

Normal routeでXHRまたはfetch requestは発生しなかった。

=== Timing samples

各sampleはproduction previewを同じURLへreloadし、network throttlingなしで取得した。
snapshot removal markerはmeasurement-onlyの`Element.prototype.remove` wrapperで`script[data-dh-store]` removalを記録した。
このwrapperはsource artifactへ含めていない。
元のcollectorコード、wrapperの導入と復元の手順、readiness待機条件は保存していない。
failure injectionとinteractionについても完全な実行手順が残っておらず、別sessionでの測定再現には、明示した新しい手順での再測定が必要である。
新しい手順を過去のsampleの収集手順として扱わない。

navigationの単位はmsで、`responseEnd`、`domContentLoadedEventEnd`、`loadEventEnd`、`storeScriptRemoved`、`main` resource duration、`appRoot` resource durationを記録した。
`response-end-to-snapshot-removal`は`storeScriptRemoved - responseEnd`である。
script除去の後にも初期renderとlistener登録が続くため、この値はactivationの一部を観測する代理指標であり、操作可能になるまでの完了時間ではない。

#table(
  columns: (auto, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr, 1fr),
  table.header([Sample], [responseEnd], [DCL], [load], [snapshot removal], [main], [appRoot], [response-end-to-snapshot-removal]),
  [A], [4.0], [14.8], [15.0], [23.0], [2.5], [2.8], [19.0],
  [B], [6.6], [15.8], [16.1], [26.3], [2.9], [3.4], [19.7],
  [C], [4.7], [13.5], [13.9], [21.2], [2.5], [2.5], [16.5],
  [D], [4.1], [15.2], [15.6], [24.1], [4.6], [2.2], [20.0],
  [E], [4.0], [17.3], [17.6], [25.4], [5.0], [2.1], [21.4],
)

Summary statistics for five navigation/snapshot-removal samples:

- navigation load duration：`13.9-17.6ms`、median `15.6ms`
- DCL：`13.5-17.3ms`、median `15.2ms`
- response-end-to-snapshot-removal：`16.5-21.4ms`、median `19.7ms`
- main resource duration：`2.5-5.0ms`、median `2.9ms`
- appRoot resource duration：`2.1-3.4ms`、median `2.5ms`
- document transfer：5 samplesすべて`2,873 bytes`

Interaction測定は各reload後にbuttonを5回clickし、各clickから次の`requestAnimationFrame`までを測った。
各5回の最初のclickをwarm-upとして中央値から除外した。

#table(
  columns: (auto, 1fr, 1fr, 1fr, 1fr, 1fr),
  table.header([Sample], [1], [2], [3], [4], [5]),
  [I-1], [7.5], [8.1], [16.6], [16.4], [16.4],
  [I-2], [0.5], [7.6], [17.3], [16.3], [17.2],
  [I-3], [0.3], [17.2], [16.5], [16.1], [17.3],
  [I-4], [0.4], [15.0], [16.3], [17.2], [16.6],
  [I-5], [0.5], [3.7], [16.8], [17.4], [16.1],
)

Warm-up後の20 samplesは`3.7-17.4ms`、中央値`16.45ms`だった。
この指標はclick handlerのCPU self-timeではなく、DOM update後に次のframeへ到達するまでのelapsedである。

`performance` APIとこの測定方法では、module evaluationのCPU self-timeをnetwork response durationから分離できない。
したがって、初期JS実行時間のexact値は未測定とし、DCL、resource duration、response-end-to-snapshot-removalを代替指標として扱う。

JS heap、retained store、listener countのmemory値は測定していない。
disposalについてはS-04のdetached DOM mutationを観測したが、heap snapshotによるretained object量は未測定である。

== Fresh browser evidence

=== Durable artifacts and provenance

利用者はこのsessionで測定補助の実装と二つのcohortの実行を許可し、GitHubへの書き込みを禁止した。
測定補助の対象はproduction previewの観測だけであり、追加理由はhistorical collectorと完全な手順の欠落を補うためである。
Issueへの事前コメントは投稿せず、この説明を未投稿の記録として保持する。
このcohort収集で追加したファイルは、この文書と同じディレクトリの次の4ファイルである。

- `collect.mjs`：checkout検証、install、build/test、preview起動、browser収集、全sample保存、終了処理。
- `verify.mjs`：保存済みcohortのobserved behavior、artifact、HTML、環境、統計の再計算、CLIの入力不足と上書き拒否を検査する補助。
- `cohort-a.json`：元worktreeからの新cohort A。開始は`2026-09-09T10:34:43.505Z`。
- `cohort-b.json`：clean detached `/tmp/opencode/task-252-fresh`からの新cohort B。開始は`2026-09-09T10:35:43.184Z`。

両cohortのsource SHAとlockfileはEvidence statusと同じである。
収集時のcollector SHA-256は`3fa64b8c1296a805d0d247c45e359e4dd3744d17881db9843437467204f5c0c5`で一致する。
各JSONはHTMLのhash、size、script開始tag、snapshot payload、全navigation、全click、failure、disposal、request、resource timing、console errorを保持する。
full HTML、headers、cookies、環境変数一覧、full trace、heap dumpは保存しない。
JSONの`status: complete`はcollectorの収集完了だけを表し、Issueの完了や製品契約への合格ではない。
試作collectorのsmoke runも先に実行したが、final cohortへ混ぜず、統計から除外した別手順の開発検証として扱う。

=== Reproduction procedure

移動前に、この文書のあるworktreeを作業ディレクトリにして、次のコマンドを順に実行した。
このコマンド記録は収集時のパスを保持している。
同名のcohortは上書きを拒否するため、再実行時は新しい出力名を指定する。

```sh
node SPEC/proposals/245-server-authoritative-execution/252-collect.mjs /home/kcatt/dev/dathomir-issue-252 SPEC/proposals/245-server-authoritative-execution/252-cohort-a.json
node SPEC/proposals/245-server-authoritative-execution/252-collect.mjs /tmp/opencode/task-252-fresh SPEC/proposals/245-server-authoritative-execution/252-cohort-b.json
node SPEC/proposals/245-server-authoritative-execution/252-verify.mjs
```

現在の保存先は`SPEC/proposals/245/252/`であり、移動時にJSONの内容と`collectorSha256`は変更していない。
`collect.mjs`の変更はUsageのファイル名と、checkout検査で許可するevidenceディレクトリの2箇所、およびその2箇所の改行だけである。
`verify.mjs`はUsageの`collect.mjs`を`252-collect.mjs`へ戻し、checkout検査の2箇所を収集時のパスと改行へ戻したテキストをSHA-256で検証する。
この逆変換で収集時のcollector全体のバイト列を検証し、移動後のcollectorで既存cohortを収集したとは扱わない。
測定処理は変更しておらず、移動に伴う再測定は行っていない。

移動後はrepository rootから次のコマンドを使う。
公開commit後のcheckoutは測定対象の固定SHAと異なるため、再測定では第一引数の`"$PWD"`を固定SHAのclean checkoutへ置き換える。
collector自体は公開されたevidenceディレクトリから実行する。
再測定例の出力名は保存済みcohortと分けており、新しいJSONには実行したcollector自身のhashが記録される。
`verify.mjs`の対象は保存済みのcohort A/Bである。

```sh
node SPEC/proposals/245/252/collect.mjs "$PWD" SPEC/proposals/245/252/cohort-a-rerun.json
node SPEC/proposals/245/252/collect.mjs /tmp/opencode/task-252-fresh SPEC/proposals/245/252/cohort-b-rerun.json
node SPEC/proposals/245/252/verify.mjs
```

collectorは固定SHA、evidence以外のtracked差分とuntracked sourceの不在を検査する。
続いて`pnpm install --frozen-lockfile --offline`、`pnpm --filter @playground/e2e test`、`pnpm --filter @dathra/docs build`、`pnpm --filter @dathra/docs test`を順に実行する。
e2eのtest scriptはproduction buildを含む。
offline installには既存pnpm storeが必要であり、別machineでは事前のdependency取得が必要になる。
Playwrightのbrowser binaryも事前に必要で、今回使ったものは既存のChromium `141.0.7390.37`である。
新しいcheckoutを用意する場合は、Historical production baselineの`git worktree add --detach`の手順と同じSHAを用いる。

previewは空きportを選んで`PORT=<port> pnpm --filter <package> preview`で起動する。
HTTP `200`を最大120回、各request timeout `1000ms`、再試行間隔`250ms`で待つ。
実際のURLと起動コマンドはJSONの`previews`に保持する。
各測定は`goto(..., waitUntil: "load")`から開始し、正常系のreadiness待機は最大`10s`とする。
終了時はcontext、browserを閉じ、collectorが起動したpreviewのprocess groupにSIGTERMを送り、親processの終了待ちが`5s`を超えた場合はSIGKILLを送る。
collectorの強制終了やOS停止まではこの後処理で保証しない。

両cohortはNode `v24.19.0`、pnpm `10.17.1`、Playwright `1.56.1`、headless Chromium `141.0.7390.37`、viewport `1600x1000`、DPR `1`で実行した。
OSはLinux `6.18.33.2-microsoft-standard-WSL2 x64`、CPUはIntel Core i5-13400F、可視logical CPU数は8である。
各navigationで新しいbrowser contextを使い、CDPでcacheを無効化し、service workerをblockする。
cohortごとに新しいbrowser processを起動し、Aの終了後にBを実行した。
networkとCPUのthrottlingはなく、localhost HTTP/1.1、同じhostであるが、OSのpage cache、CPU温度、他processの負荷を隔離していない。
historical Chrome `145`、DPR `0.8`、DevTools reloadとは条件が異なるため、旧分布との直接比較を行わない。

=== Readiness and observation hooks

collectorは`page.addInitScript`でapp JSより前に三つのprototype wrapperを導入する。
`EventTarget.prototype.addEventListener`はnative登録をそのまま委譲し、`[data-testid="snapshot-increment"]`のclick listener登録後にmicrotaskを予約する。
microtaskでは初期表示`Count: 7`と`Theme: snapshot-midnight`を検査し、`HTMLElement.click()`による`Count: 8`への更新を観測した後の`performance.now()`を`probe.ready`へ記録する。
したがって`ready - responseEnd`は操作可能だったことを確認するまでのelapsedであり、登録完了時刻だけのproxyでも、厳密なactivation完了時刻でもない。
probeの実行とDOM読取の費用を含む上限側の観測であり、画面へのpaint完了を意味しない。

`Element.prototype.remove`はnative除去後にsnapshot scriptの除去時刻を記録する。
`snapshotRemoved - responseEnd`は部分的なproxyとして別fieldと別分布を維持する。
`ShadowRoot.prototype.querySelector`は`e2e-ssr-app`のowner rootで、正確なselector `script[type="application/json"][data-dh-store]`を読む場合に限定して参照を保存し、failure時だけ一度差し替える。
正常時に保存するidentityはsnapshot読取時点から後のfixture、ShadowRoot、count要素、button要素に限る。
SSR parseの瞬間からのidentity、全tree、setup/render/fallback実行回数を検証したものではない。

readiness確認に使う最初のclickをwarm-upとして保持し、残る4回はprototypeを復元した後に`HTMLElement.click()`を実行する。
三つのprototypeが保存したnative functionと同一であることを検査し、正常5 runとfailure3 runのすべてで`restored: true`を記録した。
各clickの同期elapsedと次のrAF callbackまでのelapsedを記録する。
synthetic clickはtrusted input、pointer hit testing、Playwrightのactionability待機を含まない。
補助的にhookなしの別contextでPlaywright `getByTestId(...).click()`を5回実行し、同じcount遷移を確認したが、そのrunをtiming分布へ混ぜない。

=== Fresh scenario outcomes

- S-01：両cohortの正常5 runでHTMLは`2,573 bytes`、snapshot payloadとHTML hashはhistorical記録に一致した。
- S-02：全10 runで初期theme/countを検査した後、最初のclickが`7 -> 8`へ更新した。snapshot読取時点からの四つのnode identityもすべて一致した。
- S-03：全10 runで計5回のclickが`7 -> 12`へ進んだ。各cohortに25 clickの全sampleを保存し、warm-up除外後20 sampleの統計を計算した。
- S-04：全10 runでremove後も`Count: 12`を保持したが、microtaskとrAFを待った後のdetached clickが`Count: 13`へ更新した。hookなしrunでも同じ結果だった。
- S-05 missing：各cohortで1回。scriptを消さずquery結果だけをnullにした。`Count: 0`、`Theme: client-default`、script残存、click後`1`、detach後のlate clickで`2`、hydrate diagnosticなし。
- S-05 shape：各cohortで1回。snapshot textを`[]`にした。default表示、script除去、click後`1`、late click後`2`、hydrate diagnosticなし。
- S-05 malformed：各cohortで1回。snapshot textを`not-json`にした。hydrate diagnosticが出て、SSRの実際のtextContent `Count:7`と`Theme:snapshot-midnight`を保持し、通常clickとlate clickでも変わらなかった。scriptは残った。
- S-06：各cohortで`/`を観測した。module scriptが1個、JS resourceが2件あり、zero-client-root controlにはならない。新しいproduction controlは作っていない。
- S-07：各cohortでdocs `/reactivity`の5 host、5 highlighted block、5 Copy buttonを確認した。最初のbuttonをtrusted clickで5回操作してもlabelは毎回`Copy`、1900ms後も`Copy`だった。timer開始やcleanupの成立までは検証できない。

failureではinjection実行を確認し、missing/shapeはlistener登録、malformedはhydrate diagnosticを待ち、さらに`100ms`後に表示を読む。
これらは各mode一回ずつのbehavior観測であり、failureやdocsの時間指標について5 sampleの性能分布を主張しない。
missing/shapeのdefault復帰を成功やbehavior同等へ読み替えず、malformedの表示保持だけでbounded failure cleanupを証明したとも扱わない。

両cohortの8 build artifactはhashとbytesがすべて一致し、historical artifact記録とも一致した。
正常routeのJSはmain `52,529 bytes`とappRoot `33,428 bytes`、transferは`52,829`と`33,728 bytes`だった。
全正常runのdocument transferは`2,873 bytes`で、XHR/fetch requestはなかった。
resource timingのencoded/decoded bytesはこのpreviewでは等しく、圧縮配信の評価ではない。

=== Distribution comparison

表の単位はmsであり、括弧はminからmax、中央はmedianである。
JSONの`normal`に全標本、`distributionsMs`にn、min、Q1、median、Q3、maxを保持する。
quartileはsort後のindex `(n - 1) * p`に対する線形補間で計算し、medianも同じ方式とする。
navigationは各5 sampleをすべて使い、clickは各runの最初の1回だけを除外した20 sampleを使う。

#table(
  columns: (2fr, 1.7fr, 1.7fr, 1fr),
  table.header([Metric], [A median (range)], [B median (range)], [B minus A median]),
  [Navigation load], [27.30 (14.20-66.60)], [14.50 (12.70-16.60)], [-12.80],
  [Response end to observed ready], [32.50 (19.00-48.10)], [25.10 (20.10-44.40)], [-7.40],
  [Snapshot removal proxy], [31.80 (18.30-46.80)], [24.30 (19.40-43.60)], [-7.50],
  [Post-warm-up synchronous click], [0.15 (0.00-0.90)], [0.10 (0.00-0.40)], [-0.05],
  [Post-warm-up next rAF], [8.85 (0.40-23.80)], [9.95 (0.40-17.70)], [+1.10],
  [Navigation response end], [6.10 (3.90-39.70)], [4.30 (4.00-6.20)], [-1.80],
  [DOMContentLoaded end], [27.30 (13.90-65.70)], [14.00 (12.20-16.50)], [-13.30],
  [Main resource duration], [3.10 (2.20-20.30)], [2.90 (2.10-3.20)], [-0.20],
  [AppRoot resource duration], [2.50 (2.20-9.20)], [2.60 (2.20-3.90)], [+0.10],
)

末尾4指標も各5 sampleであり、`verify.mjs`がraw JSONから同じquartile方式で再計算して出力する。

readinessのQ1-Q3はAが`29.10-44.00ms`、Bが`23.30-33.10ms`だった。
loadのQ1-Q3はAが`16.10-42.90ms`、Bが`13.30-15.20ms`だった。
同じartifactでもこの二回の実行条件では分布が変動し、特にloadのばらつきが異なった。
この比較はbehaviorとartifactの再現、および時間分布の記述であって、統計的同等性、改善、回帰、許容差の根拠を確定するものではない。
短い同期sampleの`0`はbrowser clockの観測値であり、CPU費用がないことを意味しない。

この二つのcohortではCPU profilerによるmodule self-timeを収集していない。
DOM参照をcollectorが意図的に保持するため、ここでのheap総量をappのretained store量に帰属させることもできない。
次節の補足測定は別contextと別collectorによるものであり、既存cohortにCPUやmemoryの測定値を遡及して追加しない。

== Supplementary CPU and retention evidence

=== Scope and provenance

利用者が許可した残作業として、production sourceを変更せずにCPU、GC後の保持量、実行回数の観測可能範囲を調べた。
補助を追加する理由は、既存のwall-timeとstrong DOM referenceによるprobeではこの三点を検証できないためである。
Issueへの事前記録はGitHub書き込み禁止に従って未投稿とし、この節に保持する。
補足収集時には`collect.mjs`、`verify.mjs`、既存cohort JSONを編集していない。
独立review後に`verify.mjs`と`verify-profile.mjs`だけを強化し、collectorと保存済みJSONは変更していない。

- `profile.mjs`：既存buildの検証、preview起動、独立したCPU、memory、coverage収集。
- `verify-profile.mjs`：保存済みraw値、source range、hash、GC control、behaviorの検査と統計再計算。
- `profile-a.json`：元worktree、開始`2026-09-10T07:28:44.361Z`、218,305 bytes。
- `profile-b.json`：clean detached worktree、開始`2026-09-10T07:29:00.180Z`、222,135 bytes。

補足collectorのSHA-256は両方とも`30e15731ff8a0cbad21fc81fb85efc6a936ca4b0596183f1ebb7aecd51cb0acc`である。
JSONの`originalEvidence`には移動後の元collector、元verifier、二つの元cohortのfile hashを記録した。
元cohortが保持する収集時のcollector hashとは別の来歴であり、Relocation verificationの逆変換を置き換えない。
`profile.mjs`は`verify.mjs`をhash用に読むだけで、importも実行もせず、測定値の算出に使わない。
その記録値`13926a02038cebc203f950edd2e5807642d5d3efc7611e9f0fbaead52a7d370b`は収集時の付随metadataとして固定照合し、修正後verifierのhashとは主張しない。
将来の再収集では現行verifierのhashも受理し、保存済み結果のhistorical値と区別する。
現行の`collect.mjs`と二cohortは引き続き実ファイルのhashを照合する。
元verifierのバイト列の再構成は行わず、保存済みhashの付け替えやbrowser再測定も行っていない。

固定source、lockfile、e2eの4 artifactは既存baselineと一致し、32 contextすべてで取得HTMLと配信された2 scriptのbody hashも照合した。
この補足では保存済みproduction buildを利用し、install、build、package testを再実行していない。
`git ls-remote origin refs/heads/main`は同じ固定SHAを返し、fresh worktreeはcleanだった。
Task input collectorの5 source groupも再収集し、すべてcollected、warningなしだった。

両補足runはNode `v24.21.0`であり、元cohortの`v24.19.0`とは異なる。
pnpm `10.17.1`、Playwright `1.56.1`、headless Chromium `141.0.7390.37`、OS、CPU、viewport `1600x1000`、DPR `1`は元cohortと同じである。
cacheを無効化したnew context、service worker block、throttlingなし、localhost、host負荷非隔離という条件を保持し、A終了後にBを実行した。
各cohortでCPUを5 navigation、memoryをremove 5 navigationとkeep 5 navigation、coverageを1 navigation測定した。
CPU標本は先頭を含めて全5件を保持し、navigationのwarm-up除外はない。
先行smoke runとlint修正前の試行は補助開発の検証であり、final標本に含めない。
lintが検出したfinally内のthrowを修正した後、補足JSONを両方とも再収集し、古いhashの測定値へ新hashを付け替えていない。

=== Initial script CPU boundary

`Performance.enable({timeDomain: "threadTicks"})`と`Profiler.start`をnavigation前に実行する。
`goto(load)`後にsnapshot消費と正確な初期textをpollし、その観測後にCPU profileを停止してthread metricを読む。
callback登録時刻へのhookは使わず、最初のclickはprofile停止後に実行して`7 -> 12`を検査する。
したがって区間は初期処理を含むが、厳密なactivation完了時刻や初回interaction時間ではない。

`ScriptDuration`の差分はrenderer thread上のscript実行に対するCPU timeであり、navigationやresourceの経過時間を代用していない。
#link("https://raw.githubusercontent.com/chromium/chromium/141.0.7390.37/third_party/blink/renderer/core/inspector/inspector_performance_agent.cc")[Chromium 141の計測実装]ではthreadTicksを`ThreadTicks::Now()`から取得し、script呼び出しのnested durationを二重加算せず、nested layoutとstyle処理を差し引く。
この値には計測下の処理とautomationのscript呼び出しが含まれ得るため、applicationだけの厳密なself-timeとは呼ばない。
worker、別isolate、browser process、network待ちのCPUは対象外である。

#table(
  columns: (1fr, 2fr, 2fr),
  table.header([Sample], [A ScriptDuration ms], [B ScriptDuration ms]),
  [1], [6.258], [5.147],
  [2], [4.898], [5.712],
  [3], [4.927], [5.034],
  [4], [4.989], [4.975],
  [5], [4.980], [4.695],
  [Median], [4.980], [5.034],
  [Q1-Q3], [4.927-4.989], [4.975-5.147],
  [Min-max], [4.898-6.258], [4.695-5.712],
)

raw JSONの`before`と`after`はseconds、`threadMs`は差分をmsへ換算した値である。
`TaskDuration`、`ThreadTime`、`DevToolsCommandDuration`も別fieldに保持し、ScriptDurationに加算したり、automation費用の推定として減算したりしない。
`V8CompileDuration`の観測値は全件0だが、moduleのparse、compile、JIT費用が存在しないことを意味しない。
特定probeに計上された値であり、compile全体の費用はこの測定から分離できない。

CPU profilerはinterval `1000us`のleaf stack sampleを保存する。
配信scriptの完全一致URLでmainとappRootを区別し、native/idle/GCとURL不明のsampleを未帰属として残す。
両bundleは複数moduleを含むため、bundle名をpackageやcomponentの名前へ読み替えない。
sample数はmsではなく、`timeDeltas`をCPU timeとして合計せず、thread timeをsample比率でmoduleへ按分もしない。

- Aのmain leaf sample数：`5, 4, 4, 6, 5`。appRoot：`1, 0, 0, 0, 0`。
- Bのmain leaf sample数：`5, 4, 4, 4, 3`。appRoot：`0, 1, 0, 0, 1`。

0 sampleはsampling interval内に短い処理を捕捉できなかった場合を含み、未実行やCPU費用0の証拠にはならない。
JSONには全node、call frame、sample ID、timeDelta、profile開始終了時刻を保持し、再分類できるようにした。
このCPU分布は記述的なbaselineであり、元cohortのreadiness分布との直接比較やperformance thresholdの承認には使わない。

=== Post-GC retention boundary

memory runではCPU profiler、precise coverage、prototype wrapper、ElementHandleを使わない。
activation後にfixture host、button、unrooted sentinelへのWeakRefだけをwindowへ置き、DOMやstoreへのstrong referenceをcollectorから保持しない。
各`Runtime.evaluate`はIIFEのlocal変数を使い、returnByValueで文字列、boolean、数値を含むJSONだけを返す。
DOMのremote object IDを保存せず、detached buttonをlate clickしない。

4 checkpointはactive、5 click後のupdated、removeまたはkeep後のafter、さらに100ms待ったsettledである。
各checkpoint前にtimer taskを挟んで2回`HeapProfiler.collectGarbage`を要求する。
これはWeakRefのderefによる同一job内の一時的な保持を次のGCへ持ち越さないためである。
heapとDOM counterを読んだ後にWeakRefの生存booleanを読み、測定自身の一時allocationがそのcheckpointのheap値へ入るのを避ける。
各pairでremove/keepの実行順を交互に変え、keepも同じclick、rAF、GC、待機を通す。

#table(
  columns: (2.5fr, 1.4fr, 1.4fr),
  table.header([Used JS heap metric (bytes)], [A median], [B median]),
  [Remove: active], [869,604], [869,684],
  [Remove: updated], [906,080], [906,160],
  [Remove: settled], [902,728], [902,788],
  [Remove: settled minus updated], [-3,352], [-3,372],
  [Keep: active], [869,684], [869,684],
  [Keep: updated and settled], [906,160], [906,160],
  [Keep: settled minus updated], [0], [0],
)

各rowは5標本であり、全checkpointをJSONの`memory`へ保存した。
removeのwithin-navigation差分のrangeは両cohortとも`-3,372`から`-3,352 bytes`、keepは全件`0 bytes`だった。
removeでは全10 runでGC後のhostとbuttonのWeakRefが消え、keepでは全10 runで残った。
sentinelはすべてのcheckpointで消えたため、無関係なunrooted objectの回収も確認できた。
DOM counterはupdatedでdocuments `2`、nodes `399`、JS listener `1`、remove後settledで`2 / 388 / 0`、keep後は`2 / 399 / 1`だった。

この差分はstoreのretained sizeではなく、isolateのused JS heapの変化である。
rawにはtotalSize、embedderHeapUsedSize、backingStorageSizeも返されたfieldのまま保存したが、process RSSやDOM全体のnative allocation量とは異なる。
activeからupdatedへの約36KB増加はkeepにも現れ、評価scriptのcompile/cacheなど計測下の費用を含み得るため、storeへの増分として帰属しない。
retainer graph、個々のstore、timer、pending taskの所有者は検査しておらず、長期や大量のmount/dispose stressも未測定である。

S-04のlate click gapと今回の回収結果は矛盾しない。
S-04は外部からbuttonを保持した場合のlistener無効化を問い、今回は外部strong referenceを残さない場合の回収を問う。
GCによりlistener counterが0になっても、disconnectedCallbackがlistenerを明示的に解除した証拠にはならない。
したがってcleanup gapを修正済み、全resourceが解放済み、memory leakが存在しないとは結論しない。
keepは同じconsumerのsham controlであり、zero-client-root controlの代替ではない。

=== Execution counting feasibility

#link("https://chromedevtools.github.io/devtools-protocol/tot/Profiler/#method-startPreciseCoverage")[CDP precise coverage]の`callCount: true`と`detailed: true`をnavigation前に開始した。
この方法はproduction sourceや配信bodyを書き換えずに関数とblockのcountを収集できるが、optimized codeの実行を妨げるため、CPUとmemoryのrunへ混ぜない。
各cohortで正常系を1回だけ測り、初期観測でcountを取得してresetし、5 click後にupdate区間を別に取得した。
二つの配信bundleのraw coverageを保持し、markerを含む最小のfunction range、source断片、UTF-16 offsetを照合した。

#table(
  columns: (2.4fr, 1.7fr, 0.7fr, 1fr),
  table.header([Resolved target], [Bundle range start:end], [Initial count A/B], [5-click count]),
  [Fixture component setup], [appRoot `30550:30716`], [0 / 0], [not returned],
  [Fixture generated planFactory], [appRoot `30773:30994`], [0 / 0], [not returned],
  [Fixture hydrate callback], [appRoot `31018:31812`], [1 / 1], [not returned],
  [Fixture local text render], [appRoot `31590:31693`], [1 / 1], [5 / 5],
  [Runtime runSetup], [main `50027:50289`], [0 / 0], [not returned],
  [Runtime preserveUnsupportedHydration], [main `50293:50671`], [0 / 0], [not returned],
  [Runtime runUnsupportedHydrationFallback], [main `50675:50917`], [0 / 0], [not returned],
)

`fixtureSetup`のmarkerは二つのrangeに一致したため、component bodyとgenerated planFactoryを別行にした。
update区間で返されなかったfunctionを0として保存しておらず、初期coverageの0と区別している。
対応sourceはrouteの`36-52`、`55-109`、componentsの`runSetup`、`preserveUnsupportedHydration`、`runUnsupportedHydrationFallback`である。

この結果から、固定buildの正常系について、上記の実行箇所をproduction変更なしに計数する方法が実行可能だと確認できる。
表の内部関数、generated planFactory、bundle rangeは現行実装固有の観測対象であり、次方式に同名の関数、同じrange、同じ生成物を要求しない。
次方式の検証対象は採用契約の禁止実行に対応づける必要があり、この表の0回だけでその不在を保証しない。
ただし、同じsource rangeの複数closureはinstance別に分離できず、全setup、tree reconciliation、動的生成関数、別isolateを網羅した分類ではない。
fixtureのlocal `render`はactivation中に1回呼ばれて初期textを書き直している。
component bodyの0回だけを根拠に「render再実行なし」やserver authorityへの適合を宣言しない。
新しい契約で許可するupdateと禁止するreconstructionの分類は、このTaskで決定しない。

missing、shape、malformedへのcoverageは今回追加していない。
既存failure injectionとprecise coverageを別contextで組み合わせることは技術的に可能だが、上記rangeのcountだけではsilent defaultを含むすべてのfallbackを識別できない。
failure contract、zero-client-rootのfixture、新candidateの実行箇所対応を後続で定義し、failure時とinstance別の保証を検証する必要がある。
これらを計数できない値0で埋めず、性能thresholdと同様に未承認の判断を残す。

=== Supplement reproduction

既存baselineのinstall/build手順で同じ4 artifactを用意した後、repository rootで次を実行する。
出力が既に存在する場合は上書きを拒否するため、再実行時は別名を指定する。
実行時には`profile-a-rerun.json`ではなく`profile-a.json`、Bも同様の保存名を指定した。

```sh
node SPEC/proposals/245/252/profile.mjs "$PWD" SPEC/proposals/245/252/profile-a-rerun.json
node SPEC/proposals/245/252/profile.mjs /tmp/opencode/task-252-fresh SPEC/proposals/245/252/profile-b-rerun.json
node SPEC/proposals/245/252/verify-profile.mjs "$PWD" SPEC/proposals/245/252/profile-a-rerun.json SPEC/proposals/245/252/profile-b-rerun.json
```

補助は既存Playwrightをcheckoutから解決し、dependencyの追加やdownloadを行わない。
previewは空きportを使い、120回のHTTP readiness retry、request timeout 1000ms、間隔250ms、goto timeout 10s、初期状態pollは最大500回と間隔20msである。
browser command自体の遅延があるため、poll全体の厳密なwall-time上限を10sとは扱わない。
成功時も失敗時もbrowser/contextを閉じ、owned preview process groupへSIGTERMを送る。
親processが5sで終わらない場合はSIGKILLを送り、OS停止やcollectorへの強制killまでのcleanupは保証しない。
取得失敗時はfailed resultを保存して非zero exitとし、欠測を成功値として補わない。

raw JSONにはCPU call frameとproduction source断片を含むが、full HTML、headers、cookies、環境変数一覧、heap dumpを含めない。
URLはこのrunのlocalhost resourceだけであることを検査し、保存内容は公開済みsource、fixture値、local環境の来歴に限定した。
この内容点検は独立reviewや完全なsecret検出の保証とは別である。

== Evaluation criteria

この表のperformance thresholdは承認済みの製品契約ではない。
実測のばらつきとconsumer要件だけでは削減率を正当化できないため、数値thresholdは未承認として残す。
表のDSD、snapshotの形式、script名と計測hookは現行baselineの測定条件であり、候補の構文、compiler、自動分割、artifact形式の採用条件ではない。
候補には `#245` のserver authority、no-reconstruction、no-fallback、zero-client-rootとconsumerの必要な挙動を要求し、具体的な方式の選択は `#253` に委ねる。
禁止実行のcount `0`という条件は維持するが、現行source rangeとの一致を合格条件にはしない。

#table(
  columns: (1.5fr, 1.4fr, 2.2fr, 2.4fr, 1.5fr),
  table.header([Metric], [Definition], [Condition], [Current baseline], [Approval]),
  [Server authority], [initial HTML and snapshot values], [fresh production response], [snapshot present, theme `snapshot-midnight`, count `7`], [required by `#245`],
  [No reconstruction], [no setup/render re-execution or tree reconciliation; SSR node identity retained], [DSD route with client activation; prohibited execution count `0`], [4 node identity一致。補足の正常系setup rangeは0、local text renderは初期1回。禁止実行全体は未保証], [required by `#245`; unverified],
  [No fallback], [no silent client-render fallback], [missing, shape mismatch, malformed snapshot; fallback count `0`], [3 failure outcomeを記録。補足の正常系runtime fallback rangeは0。failure時の計数は未検証], [required by `#245`; unverified],
  [Repeated update], [five click operations from count `7`], [same browser page, first click warm-up], [fresh全10 runで`12`。rAF median A `8.85ms`、B `9.95ms`], [observed only; threshold unapproved],
  [Cleanup], [old control cannot mutate after disposal], [remove host, then click saved control], [historical `7 -> 8`、fresh反復後`12 -> 13`], [consumer hypothesis unmet; contract unapproved],
  [Failure], [missing or malformed snapshot has explicit bounded outcome], [fault injection before activation], [missing/shapeはsilent default、malformedはdiagnostic error、いずれも契約未承認], [required gap, no fix in this Task],
  [Zero client root], [no client entry, bootstrap, or activation resource], [existing static route], [`/` is not a control; bootstrap is present], [control fixture absent],
  [Client bytes], [encoded and transfer bytes per request], [production preview, no throttling], [document `2,573`, main `52,529`, appRoot `33,428` encoded bytes], [descriptive baseline only],
  [Initial JS CPU], [renderer ScriptDuration thread CPU time in ms], [profiler付き初期観測区間、各5回], [補足A median `4.980ms`、B `5.034ms`。module self-timeではない], [threshold unapproved],
  [Memory], [post-GC isolate heap bytes and DOM/listener counts], [別run、remove/keep各5回、WeakRef control], [補足のremove差分median A `-3,352`、B `-3,372 bytes`。store帰属は未測定], [descriptive only; no retained-store guarantee],
)

No numerical performance threshold is adopted here.
bytesの単位はbyte、時間の単位はmsである。
性能指標の候補合格値、許容差、承認根拠は未確定であり、この表だけで候補実装の合否は判定できない。
承認されたTask scopeでは、必須原則と未承認の評価候補を区別し、後続ownerへ渡すevidenceとしてこの表を提出する。
`#245` のno-reconstruction、no-fallback、zero-client-rootは必須条件として扱うが、現行routeの観測値を合格値へ読み替えない。

=== Approved evidence-task scope

評価表の時間とbytesは実測値であり、承認待ちの具体的な数値threshold案は提示していない。
反復5 clickで`7 -> 12`となる期待値は検証仮説、disposal後の旧control無効化は未承認のconsumer仮説、failureのbounded outcomeは具体契約が未決の評価候補である。
利用者のin-session承認に基づき、Issue `#252` のWork 7とAcceptance criteria第4項だけを変更した。
#link("https://github.com/dathra/dathra/issues/252#issuecomment-5749435987")[エージェントによる承認記録]は、#link("https://github.com/dathra/dathra/issues/252#issuecomment-5749424143")[確認案と理由]への回答を記録しており、利用者本人がGitHubコメントを投稿したという意味ではない。

- consumer選定、再現可能なbaseline、必須条件と未承認仮説の区別、後続ownerへの引継ぎをもって、このevidence Taskを受入可能とする。
- 性能合格値と許容差は未承認のまま、`#251` のownerが候補実装の合否評価前に決める。
- 反復操作、cleanup、failureの検証仮説は製品契約として採用せず、`#253` の判断入力へ渡す。
- `#245` のserver authority、no-reconstruction、no-fallback、zero-client-rootは必須のまま維持する。

control fixtureの実装、module/store別の網羅測定、禁止実行全体の保証は後続検証であり、このTaskの追加条件にはしない。

== Requirements coverage

WORK-07、AC-04、WORK-11以外の各行は、2026-09-10T07:15:58.984Zのcollectorが取得したIssue本文snapshot（Issue updatedAt `2026-09-09T02:45:34Z`）の`issueRequirements.*` candidateを一つだけ対応づける。
SourceのIssue番号、heading、lineと公開準備時のdispositionを保持し、更新本文の行番号や公開後の状態へ遡及して書き換えない。
公開後の状態は#link("https://github.com/dathra/dathra/issues/252#issuecomment-5660080642")[PR `#255` 公開コメント]を参照する。

2026-09-14T09:28:54.979Zに再収集した本文snapshot（Issue updatedAt `2026-09-14T07:37:00Z`）は5 source groupすべてcollected、warningsなしだった。
更新本文ではWORK-01からWORK-10、VER、AC、DEP、NGのSource lineは従来値に5を加えた位置に対応し、PARENT、OUTCOME、PREの行番号は変わらない。
PRE-04の現在の文言は「次方式の実装の完了待ちにはしない」であり、compiler実装の採用を前提にしない。
追加されたWork冒頭の一段落はcollector上で一つのcandidateとなるため、WORK-11として現在のSourceと対応づける。
2026-09-20T11:05:51.673Zの再収集でもIssue本文のupdatedAtは同じで、5 source groupすべてcollected、warningsなし、native parentは `#251` だった。
scope変更後のsnapshot（Issue updatedAt `2026-09-20T11:12:38Z`）では本文の行数を保持し、Work line 31とAcceptance criteria line 52の2行だけを更新した。
WORK-07とAC-04はこのsnapshotへ対応を更新する。他のSource lineの対応は上記のままである。
公開準備時の未投稿記録に対する現在の対応は、開始情報と補助の理由が初回公開コメントへ記録済み、独立reviewがPR本文へ記録済み、後続handoffが末尾の2コメントへ投稿済みである。
AC-05のPRは公開済みで検証evidenceもあるが、mergeと完了記録は今回の提出後に残る。AC-06の公開とReady化は今回の利用者許可に基づく。

#table(
  columns: (auto, 2.4fr, 6fr),
  table.header([ID], [Source], [Candidate and disposition]),
  [PARENT-01], [Issue `#252`, Parent issue, line 3], [Candidate `#251`。native parent relationshipも`#251`で一致した。],
  [OUTCOME-01], [Issue `#252`, Outcome, line 7], [初回sliceのconsumer、observable behavior、baseline、測定手順、評価基準をこの文書で対応する。設計判断はscope外に置いた。],
  [PRE-01], [Issue `#252`, Preconditions, line 13], [`#245`、`#251`、`#246`、`#250`の最新本文とコメントを再読した。Task input collectorは5 source groupすべてcollected、warningsなし。],
  [PRE-02], [Issue `#252`, Preconditions, line 14], [repositoryと対象consumerのAGENTS、SPEC、tests、`manage-github-issue-work`、`dathomir-task-work`を確認した。],
  [PRE-03], [Issue `#252`, Preconditions, line 15], [git status、branch、base、SHAを確認し、専用worktreeを用意した。Issueへの開始記録は未投稿である。],
  [PRE-04], [Issue `#252`, Preconditions, line 16], [`#246`とcompiler、server、client implementationの完了を待たず、現行consumer調査を実施した。],
  [WORK-01], [Issue `#252`, Work, line 20], [docsとplayground候補を比較し、利用箇所、server処理、reactive update、failure、cleanup、再現性を記録した。],
  [WORK-02], [Issue `#252`, Work, line 21], [`/store-snapshot-roundtrip`を最小の代表consumerとして選んだ。docs candidateはclient activation不足として除外した。],
  [WORK-03], [Issue `#252`, Work, line 22], [S-01からS-07でexpected、basis、observed、evidenceを別フィールドにした。failureの実測結果を契約未承認のまま記録し、未承認outcomeは成功扱いしていない。],
  [WORK-04], [Issue `#252`, Work, line 23], [固定SHA、lockfile、環境、build、preview、URL、cache、throttling、観測区間をProduction baselineへ記録した。],
  [WORK-05], [Issue `#252`, Work, line 24], [fresh二cohortに加え、別の補足二runでthread CPU、leaf sample、post-GC heapとDOM counter、WeakRef controlを保存した。厳密なactivation完了、module self-time、store別retained bytesは未測定。],
  [WORK-06], [Issue `#252`, Work, line 25], [既存`/`を調査したが、global client bootstrapがあるためzero-client-root controlではない。不在と将来controlの入力を記録した。],
  [WORK-07], [Issue `#252`, Work, line 31; 2026-09-20 approved snapshot], [Evaluation criteriaで必須原則、実測値、未承認仮説を区別した。性能合格値は `#251` のownerへ、反復操作/cleanup/failure仮説は `#253` へ引き継ぎ、承認記録をリンクした。改訂後のevidence要件を満たす。],
  [WORK-08], [Issue `#252`, Work, line 27], [このTypst文書と同じディレクトリへ元collectorと検査補助、二cohort、補足collectorと検査補助、二profile JSONを保存した。historical raw traceや開発試行の一時パスは最終evidenceにしない。],
  [WORK-09], [Issue `#252`, Work, line 28], [`#253`と`#250`へ渡すconsumer、挙動、差分、未確定事項をこの文書に整理した。GitHub転記は未実施である。],
  [WORK-10], [Issue `#252`, Work, line 30], [変更はevidence文書と元4測定artifact、補足4測定artifactのみ。production code、package SPEC/tests、Accepted ADR、公開API、dependencies、旧Proposalは変更していない。補助の対象と理由はlocal-only指示に従い文書へ保持し、Issueコメントは未投稿。],
  [WORK-11], [Issue `#252`, Work, line 20; 2026-09-14 snapshot], [追加段落とcomment `5660613142`に対応。Selected consumer、Execution counting feasibility、Evaluation criteriaで現行実装と次方式を区別した。固定baselineとconsumerを保持し、方式比較、書き換え、prototype、再測定を追加していない。未承認threshold、仮説、測定限界は未解決のままである。],
  [VER-01], [Issue `#252`, Verification, line 36], [e2e test、docs build/test、root test、typecheck、lint、format check、production artifact hashを記録した。],
  [VER-02], [Issue `#252`, Verification, line 37], [fresh二cohortで正常反復操作、failure、disposal、docsを実測した。補足の正常系でCPU、GC後の保持量、限定source range計数を追加した。module self-time、store帰属、厳密なactivation完了、failure時の計数は未測定。],
  [VER-03], [Issue `#252`, Verification, line 38], [clean detached同一SHAでinstall、build、既存test、browserを再実行した。8 artifactとbehaviorが一致し、異なる時間分布を省略せず比較した。時間の同等性や受入合格は主張しない。],
  [VER-04], [Issue `#252`, Verification, line 39], [`git diff --check`、untracked文書の`git diff --no-index --check`、root format check、Typst compileは成功した。],
  [VER-05], [Issue `#252`, Verification, line 40], [session `ses_f75c34819fferQPhKq6Eq7EDiK`で全scriptと文書の独立reviewおよび両verifier実行が完了した。P2の2件を修正しnegative regressionを追加した。再reviewで両件の解消を確認し、新しいblocking指摘はなかった。PRへの記録は未実施。],
  [AC-01], [Issue `#252`, Acceptance criteria, line 44], [Selected consumer、候補比較、S-01からS-07を明記した。],
  [AC-02], [Issue `#252`, Acceptance criteria, line 45], [新collectorと全sample、固定SHA、buildコマンド、hash、環境、二cohort比較を永続化し、fresh checkout相当で実行した。historical collectorの来歴欠落は解消したことにせず保持する。],
  [AC-03], [Issue `#252`, Acceptance criteria, line 46], [S-04のcleanup gap、S-05のfailure outcomeと契約gap、JS self-timeとmemoryの限界を明記した。旧欠落を正解とは扱っていない。],
  [AC-04], [Issue `#252`, Acceptance criteria, line 52; 2026-09-20 approved snapshot], [consumer、再現可能なbaseline、必須条件と未承認仮説の区別を記録し、`#253` と `#250` へhandoff済み。承認されたevidence受入境界を満たし、thresholdと製品契約は採用していない。],
  [AC-05], [Issue `#252`, Acceptance criteria, line 48], [文書と補助測定はあるが、PR、merge、完了コメントはまだないため未達である。],
  [AC-06], [Issue `#252`, Acceptance criteria, line 49], [このsessionではlocal evidenceのみを作成し、commit、push、PR、Issue metadata、Issue comment、merge、closeを自動実行していない。],
  [DEP-01], [Issue `#252`, Dependencies, line 53], [着手を妨げるdependencyはない。`#253`へ渡す入力を整理したが、`#253`の完了は待っていない。],
  [NG-01], [Issue `#252`, Non-goals, line 58], [execution model、profile、authoring API、artifact、lifecycleの設計を決定していない。],
  [NG-02], [Issue `#252`, Non-goals, line 59], [compiler、server renderer、client runtime、control fixtureをproduction実装していない。],
  [NG-03], [Issue `#252`, Non-goals, line 60], [cleanup gap、docs activation不足、favicon 404をbaseline observationとして残し、修正していない。],
  [NG-04], [Issue `#252`, Non-goals, line 61], [全consumer、全browser、全adapterの網羅測定とproduction readiness判定をしていない。],
  [NG-05], [Issue `#252`, Non-goals, line 62], [`#103`系列の結論、測定値、旧PRを再検証せず採用していない。],
)

== Clarification verification

2026-09-14の説明修正では、`git diff --check`と次の二つのTypst compileが成功した。
既存mise設定のdeprecation warningは出たが、compile errorはなかった。

```sh
mise exec typst@0.15.0 -- typst compile --root . SPEC/proposals/245/252/252.typ /tmp/opencode/task-252-clarification-evidence.pdf
mise exec typst@0.15.0 -- typst compile --root . SPEC/SPEC.typ /tmp/opencode/task-252-clarification-umbrella.pdf
```

変更対象はこの文書だけであり、collector、verifier、raw JSON、baselineの測定値は変更していない。
browser、build、package test、測定は再実行していない。
この説明差分は別reviewer session `ses_f60bdf3abffeB4E5NlihLD2tlh`で最新のIssue本文と追加コメントに照らして確認し、指摘はなかった。
このreviewは説明差分のみを対象とし、baseline計測の再検証を意味しない。

2026-09-20の公開準備では公開済み状態の訂正とRemaining owner decisionを追加した。
既存の独立reviewの対象は2026-09-14の説明差分までであり、この追記を同reviewで確認済みとは扱わない。
次の検証を再実行し、すべて成功した。

```sh
node --check SPEC/proposals/245/252/collect.mjs
node --check SPEC/proposals/245/252/verify.mjs
node --check SPEC/proposals/245/252/profile.mjs
node --check SPEC/proposals/245/252/verify-profile.mjs
node SPEC/proposals/245/252/verify.mjs
node SPEC/proposals/245/252/verify-profile.mjs "$PWD" SPEC/proposals/245/252/profile-a.json SPEC/proposals/245/252/profile-b.json
pnpm --filter @playground/e2e exec oxfmt --check "$PWD/SPEC/proposals/245/252/collect.mjs" "$PWD/SPEC/proposals/245/252/verify.mjs" "$PWD/SPEC/proposals/245/252/profile.mjs" "$PWD/SPEC/proposals/245/252/verify-profile.mjs"
pnpm --filter @dathra/components exec oxlint "$PWD/SPEC/proposals/245/252/verify.mjs" "$PWD/SPEC/proposals/245/252/profile.mjs" "$PWD/SPEC/proposals/245/252/verify-profile.mjs"
pnpm fmt:check
git diff --check
mise exec typst@0.15.0 -- typst compile --root . SPEC/proposals/245/252/252.typ /tmp/opencode/task-252-ready-evidence.pdf
mise exec typst@0.15.0 -- typst compile --root . SPEC/SPEC.typ /tmp/opencode/task-252-ready-umbrella.pdf
```

両verifierのnegative regressionと保存済みevidenceの検査を含む。
browser測定、production build、package test/typecheckは再実行していない。
GitHubのreviewとinline commentはこの確認時点では0件で、既存の方針コメントに説明差分を対応づけた。
この検証時点では受入判断が未解決だったためDraftを維持し、Issue本文の受入条件は変更しなかった。
その後の明示承認でWork 7とAC4を更新し、本節の検証後に文書のscope反映とTypst compile、whitespace、要件coverage、両verifierを再確認した。
独立reviewの記録は従前の差分を対象とするものであり、scope承認を新しい独立reviewと読み替えない。

== Historical verification record

実行したcommandと結果は次のとおりである。

- `pnpm install --frozen-lockfile --offline`：成功
- `pnpm --filter @playground/e2e build`：成功
- `pnpm --filter @playground/e2e test`：15 files、15 tests pass
- `pnpm --filter @dathra/docs build`：成功、clientとserver production artifactを生成
- `pnpm --filter @dathra/docs test`：1 file、1 test pass
- `pnpm test`：全8 packageのtestが成功
- `pnpm typecheck`：全8 packageが成功
- `pnpm lint`：全8 packageがwarning/errorなし
- `pnpm fmt:check`：全13対象package/playgroundが成功
- `git diff --check`：成功
- `git diff --no-index --check /dev/null SPEC/proposals/245-server-authoritative-execution/252.typ`：whitespace errorなし
- `mise exec typst@0.15.0 -- typst compile --root . SPEC/proposals/245-server-authoritative-execution/252.typ /tmp/opencode/task-252-evidence.pdf`：成功
- `git worktree add --detach /tmp/opencode/task-252-fresh c1a30ed86fd2bd79e1c742362f552e9f62ff9f98`：成功
- fresh worktreeで`pnpm install --frozen-lockfile --offline`：成功
- fresh worktreeでe2e test：15 files、15 tests pass
- fresh worktreeでdocs build/test：build成功、1 file、1 test pass
- fresh worktreeと元worktreeのe2e、docs artifact：byte単位で一致

fresh-checkout追記とcoverage記載の訂正後に`git diff --check`、untracked文書のwhitespace check、evidence文書のTypst compileを再実行して成功した。
全体`SPEC/SPEC.typ`のTypst compileも成功した。
この過去の検証時点ではブラウザー計測の再現確認は未完了だった。
thresholdとfailure contractの承認、PR公開も未完了である。

== Fresh verification record

両cohort内でinstall、e2e production build/test、docs production build/testを再実行し、すべてexit `0`だった。
e2eは各15 files / 15 tests、docsは各1 file / 1 testがpassした。
root packageのtest/typecheck/lintは今回再実行しておらず、上のHistorical verification recordに限定する。
fresh checkoutは収集後も`git status --short`が空だった。

`252-verify.mjs`の最初の実行では、malformed時のSSR textContentを`Count: 7`と仮定してassertionが失敗した。
保存済みJSONとSSR markerを確認し、baseline用の観測検査を実際の`Count:7`と`Theme:snapshot-midnight`へ訂正した。
production source、既存test、cohort値は変更していない。
訂正後の検査では、二cohort、正常10 navigation、50 click、6 failure injection、hook復元、artifact/HTML/environment一致、全分布の再計算、CLI guardがpassした。

移動前に次の追加検証を実行した。コマンドは当時のパスを保持している。

```sh
node --check SPEC/proposals/245-server-authoritative-execution/252-collect.mjs
node --check SPEC/proposals/245-server-authoritative-execution/252-verify.mjs
node SPEC/proposals/245-server-authoritative-execution/252-verify.mjs
pnpm --filter @playground/e2e exec oxfmt --check /home/kcatt/dev/dathomir-issue-252/SPEC/proposals/245-server-authoritative-execution/252-collect.mjs /home/kcatt/dev/dathomir-issue-252/SPEC/proposals/245-server-authoritative-execution/252-verify.mjs
git diff --check
mise exec typst@0.15.0 -- typst compile --root . SPEC/proposals/245-server-authoritative-execution/252.typ /tmp/opencode/task-252-evidence.pdf
mise exec typst@0.15.0 -- typst compile --root . SPEC/SPEC.typ /tmp/opencode/task-252-umbrella.pdf
```

構文検査、cohort検査、補助2ファイルのformat check、両Typst compileは成功した。
untrackedの5ファイルそれぞれに`git diff --no-index --check /dev/null <path>`も実行し、whitespace errorはなかった。
Typst実行時には既存mise設定の`experimental_monorepo_root` deprecation warningが出たが、compileは成功した。
このTaskではその設定を変更しない。

== Relocation verification

利用者が承認した`SPEC/proposals/245/252/`への移動後、次の検証を実行して成功した。
これは配置変更の検証であり、browser測定やpackage testの再実行ではない。

```sh
node --check SPEC/proposals/245/252/collect.mjs
node --check SPEC/proposals/245/252/verify.mjs
node SPEC/proposals/245/252/verify.mjs
pnpm --filter @playground/e2e exec oxfmt --check "$PWD/SPEC/proposals/245/252/collect.mjs" "$PWD/SPEC/proposals/245/252/verify.mjs"
pnpm fmt:check
git diff --check
mise exec typst@0.15.0 -- typst compile --root . SPEC/proposals/245/252/252.typ /tmp/opencode/task-252-relocated-evidence.pdf
mise exec typst@0.15.0 -- typst compile --root . SPEC/SPEC.typ /tmp/opencode/task-252-relocated-umbrella.pdf
```

保存済みcohortの検証はrepository外の作業ディレクトリからも成功した。
補助は同じディレクトリのファイルを読み、CLI guard検査のcheckout rootは移動後の補助の位置から求める。
5ファイルのwhitespace検査と、移動前後の両JSONのSHA-256一致も確認した。
raw JSONへ直接実行したoxfmt checkはformat差分を報告したが、収集時のバイト列を保持するため整形していない。
trackedとuntrackedを含む参照検索で残った旧パスは、過去のコマンド記録とcollectorの逆変換に限定される。

== Supplement verification record

補足の検証は次のコマンドで実行した。

```sh
node --check SPEC/proposals/245/252/profile.mjs
node --check SPEC/proposals/245/252/verify-profile.mjs
node SPEC/proposals/245/252/verify-profile.mjs "$PWD" SPEC/proposals/245/252/profile-a.json SPEC/proposals/245/252/profile-b.json
node SPEC/proposals/245/252/verify.mjs
pnpm --filter @dathra/components exec oxlint "$PWD/SPEC/proposals/245/252/profile.mjs" "$PWD/SPEC/proposals/245/252/verify-profile.mjs"
pnpm --filter @playground/e2e exec oxfmt --check "$PWD/SPEC/proposals/245/252/profile.mjs" "$PWD/SPEC/proposals/245/252/verify-profile.mjs"
pnpm fmt:check
git diff --check
git diff --no-index --check /dev/null SPEC/proposals/245/252/252.typ
mise exec typst@0.15.0 -- typst compile --root . SPEC/proposals/245/252/252.typ /tmp/opencode/task-252-supplement-evidence.pdf
mise exec typst@0.15.0 -- typst compile --root . SPEC/SPEC.typ /tmp/opencode/task-252-supplement-umbrella.pdf
```

構文検査、raw検査、lint、format、Typst compileは成功した。
二つのverifierは計9ファイルのwhitespaceも検査し、元cohortの収集時hashと補足の収集時hashを別々に検証した。
補足verifierはCPU metricの差分、leaf sampleの再集計、全coverage rangeの境界と対応source、7つの初期実行箇所、updateの5回、全GC sentinel、remove/keepの生存差、32 navigationの初期表示と160 clickを確認した。
quartileの小さな既知入力と、引数不足、既存outputの上書き拒否も検査している。
これらは保存観測と補助の検査であり、新しいpackage testや製品契約の合格判定ではない。

最初にrootから`pnpm exec oxlint`を呼んだ際はcommand not foundだったため、既存packageの解決範囲に訂正した。
そのlintでfinally内のthrowを2件検出し、元の失敗を上書きせずcleanup failureを記録して非zero exitにする処理へ修正した。
修正後はwarning/errorともに0で、finalの両測定を再実行した。
Typstには既存mise設定のdeprecation warningがあるがcompileは成功し、設定は変更していない。
元collector、元verifier、元cohortへの独立reviewは変更せずに進められる状態を維持した。

== Independent review

利用者からsession `ses_f75c34819fferQPhKq6Eq7EDiK`のreview結果を受領した。
reviewerは全scriptと文書を読み、両verifierを実行し、測定の境界と限界の記載を妥当と判断した。
独立reviewと、次のP2指摘2件の修正差分の再reviewが完了した。

- R-07：補足verifierが保存済みselectionに存在するmatchしか検査せず、raw updateにfallback range `50675:50917`、count `1`があっても空selectionを受理した。検証済みbundle sourceの全marker出現箇所を独立列挙し、各raw phaseから完全なselectionを再構成して空配列も含めdeepEqualする処理へ修正した。同じraw fallback注入と初期selectionのmatch欠落を拒否するnegative regressionを追加した。
- R-08：元verifierがuninstrumented runのclick列しか検査せず、初期値とdisposalの矛盾を見逃した。初期count/theme、detached状態、除去前後の`Count: 12`、late click後の`Count: 13`を検査する処理へ修正した。各fieldを一つずつ矛盾させた6ケースを拒否するnegative regressionを追加した。

negative regressionは各cohortのin-memory cloneだけを変更し、保存済みJSONは変更しない。
修正後に両verifier、両verifierの構文検査、targeted lint/format、whitespace、文書とumbrellaのTypst compileを実行して成功した。
collector、観測値、historical hashは保持し、browser、build、package testを再実行していない。
同じreviewer sessionで両verifierを再実行し、元の反例2件と未知のverifier digestが拒否されることをメモリ内で独立に確認した。
両指摘は解消し、新しいblocking指摘はなかった。測定上の制約や受入条件の承認を解消したという意味ではない。

以下は先行するhistorical文書へのreview記録である。

別エージェントがIssue `#252` の現行本文、`#245`、参照source、保存済み証跡をread-onlyで確認した。
review sessionは`ses_f7a549529ffed9lLN92f0qZQ5r`である。
reviewerは表示されたtimingの算術、lockfile、8 artifact、3 HTMLのhash一致を確認したが、過去のブラウザー操作やbuild/testを再実行したわけではない。

- R-01：元のbrowser collectorと完全な手順が欠落している。過去の測定再現性は未達とし、新しい手順による再測定を残作業にした。
- R-02：fresh buildとブラウザー計測の再現を混同していた。VER-03とAC-02を未完了へ訂正した。
- R-03：snapshot除去をactivation完了と呼んでいた。既存sampleは保持し、部分的な代理指標へ訂正した。
- R-04：no-fallbackとno-reconstructionの条件が不足していた。既存要求を表へ反映し、未検証であることを明記した。
- R-05：同期click elapsedの個別sampleと中央値が未保存だった。historical summaryへ限定し、VER-02の未測定項目も訂正した。
- R-06：未登録のreturn cleanupとroot cleanup契約を混同していた。listener無効化の期待値をconsumer検証仮説へ訂正した。

今回R-01、R-02、R-05の新しい測定証跡はcollectorと二cohortで追加した。
R-03には操作成功に基づくreadinessを追加したが、historical proxyはそのまま保持する。
R-04には今回の補足で正常系の限定したsource range計数を追加したが、禁止実行全体の保証とfailure時の計数は残る。
先行sessionでは新collectorのreviewを`opencode run`で試し、通常起動と`--pure`再試行の両方が`Unexpected server error`で失敗した。
error refは`err_b529f3ba`と`err_856ef45b`であり、その試行からreview結果は得られなかった。
今回の独立review完了の根拠はその試行やローカル検査ではなく、上記のreviewer sessionである。

== Handoff

`#253`へ渡す入力は、selected consumer、S-01からS-05のhistoricalおよびfresh観測、failure contract gap、control route不足、artifactのhashとsize、新collector、二cohortの各5正常runと全sample、分布比較である。
`#250`へ渡す入力は、現行baselineがserver snapshot復元とclient state updateを実行できる一方、cleanup gap、docs consumerのactivation不足、zero-client-root control不在を持つことである。

未承認のperformance threshold、failure outcome、zero-client-root controlの代替案は、このTaskで決定済みとは扱わない。
補足のCPU thread-time、GC control、source range coverageも`#253`と`#250`への引継ぎに含める。
module/store別の未測定項目と禁止実行全体の検証、zero-client-root controlの実装は後続の検証課題であり、網羅測定やcontrol実装を `#252` の追加完了条件にはしない。
このTaskは測定限界とcontrol不在を明記することを許容しており、failure/cleanupの仮説と製品契約の判断は未解決として引き継ぐ。
`#253` への#link("https://github.com/dathra/dathra/issues/253#issuecomment-5749439212")[判断入力handoff]と、`#250` への#link("https://github.com/dathra/dathra/issues/250#issuecomment-5749439304")[slice計画handoff]を投稿した。
両コメントは測定evidence revision `4e6b91eab9147222cbec2b22b53b257a7474b470`、固定source、承認状態を特定する。本追記は観測値を変更しない。
公開状態はIssue `#252` のコメントとPR `#255` で確認する。
承認されたscopeに対するmerge前のevidenceと引継ぎは揃った。AC-05のmergeと完了記録は未実施であり、Task全体はopenのままにする。
collectorによる再測定と二cohort比較は実行済みであり、次のsessionで過去の来歴を再構成する必要はない。
性能thresholdは未承認のまま引き継ぐ。evidence Taskの受入scope変更は上記の明示承認に基づくものであり、製品契約の承認とは区別する。
