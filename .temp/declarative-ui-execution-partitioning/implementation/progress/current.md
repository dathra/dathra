# 宣言的 UI 実行分割の実装進捗

更新日: 2026-07-13
状態: 実装中

## 再開情報

- 実装指示: [`../README.md`](../README.md)
- 設計正本: [`../../README.md`](../../README.md)
- process正本: [`../../process/README.md`](../../process/README.md)
- review正本: [`../../process/review-policy.md`](../../process/review-policy.md#policy-r8)
- 作業 branch: `feature/declarative-ui-execution-partitioning`
- 起点 commit: `71186a8e919c44d0dbc626effdf08ed5120cd790`
- push 先: `origin/feature/declarative-ui-execution-partitioning`
- 次のscheduler action: SC02A8Fのowner、write set、exact dependency、integration gateを固定したprocess revisionを`medium`としてreview、commit、pushする。その後、同revisionだけを実装admissionとしてSC02A8FのSPEC、先行test、plan-only clone、package integrationを進める。
- 期限付きgoal: [`DocCodeBlock動作実証`](../milestones/doc-code-block-demonstration-2026-07-14.md)のlifecycleは`active`だが、schedulerには未選択であり、この分類は次のactionを変更しない。
- 外部 blocker: なし

## 文書再編checkpoint

- checkpoint HEAD: `dd7826fb28e27c5a93a083c9cad04f72c216af81`
- review evidence bootstrap: base tooling `686fa4d454460efecf70a6370a902c4f2c3217e0`とinline result binding `dd7826fb28e27c5a93a083c9cad04f72c216af81`をcommit、push済み
- owner: main integration session
- write set: `.temp/declarative-ui-execution-partitioning/`配下のowner文書、4個の旧path compatibility index
- package差分: なし
- candidate revision: exact OIDは自己参照を避けて進捗本文へ埋め込まず、`review:evidence`を正本とする
- gate: snapshot hash、section ownership、relative link、code fence、archive boundary、compatibility reachability、重複規則、line countのpre-candidate検査は成功した。diff checkを含む同じ検査をexact candidateで再実行する
- review: exact reviewer resultと収束状態は`review:evidence`だけが所有し、このstatus文書へ複製しない
- blocker: 文書再編のblockerはreview evidenceへ記録する。外部blockerはなし

## 状態の意味

- `pending`: dependencyが未完了で開始できない。
- `ready`: production implementationを開始するdependencyが完了している。
- `contract-ready`: SPEC、先行test、公開または内部contractが固定され、実装待ちである。
- `implementing`: 宣言済みwrite setでproduction implementationとtargeted gateを進めている。
- `reviewing`: 同一revisionを固定して独立reviewを進めている。
- `merge-ready`: 既知のblockerがなく、commitとpushを待っている。
- `completed`: 検証、review、commit、push、local/remote同期が完了している。
- `blocked`: 未解決dependencyまたは外部blockerによって、そのslice自身を進められない。
- `reopened`: completed後の監査で不足が見つかり、再作業が必要である。
- `deferred`: dependencyは満たすか未commit draftを保持しているが、WS01主経路を優先するため再開条件まで作業しない。
- `superseded`: 後続の細粒度sliceに置き換えられた履歴上のaggregateであり、新規実装またはreview対象にしない。
- `in-progress`: phaseまたは複数sliceを集約した行だけに使う。

## 実装戦略 R7

従来のphase-first schedulingは、内部foundationの完了数を増やしてもbrowserで動く新経路を長期間作れない問題があった。
R7は既存のruntime semantics、owner、dependency、排他的write setを維持し、次の実装優先順位だけをsupersedeする。

最優先マイルストーンを`WS01 maintainable walking skeleton`とする。
WS01は専用の簡易IRまたは使い捨てruntimeを作らず、最終構造と同じ`ExecutionGraph -> ObservationContract -> MaterializationPlan -> ClientScopeGraph -> artifact -> SSR -> activation`を通るsupported subsetを作る。
未対応variantはcompile diagnosticにし、eager hydration、component rerender、full module配信、暗黙RPCへfallbackしない。

最初のworkflowは、server-onlyなhighlight処理とhighlighted subtreeをserverへ残し、copy interactionだけをclient artifactへ含める`DocCodeBlock`相当のfixtureとする。
production codeは特定のcomponent名またはfixture pathへ依存してはいけない。

| slice | 状態 | dependency | ownerとwrite set | acceptance |
| --- | --- | --- | --- | --- |
| `WS01-0` | contract-ready | implementation matrix、EG03 `4ebd2204e504c21d34e50db6e0b89b55e2c3df41`、OC01 `86204daaead270029be46acd7f212f156716fd07`、R7 R2 process commit | main integrationのprocess文書だけ | A〜Eごとの既存fine slice、dependency OID、owner、排他的write set、integration ownerを固定し、Kahn順序を確認する |
| `WS01-A` | blocked | WS01-0、SC02 completion、SC03-Q/C/T、PL01、PL02-A/V、EG03、OC01 | 既存SC02/SC03/PL01 ownerとtransformer analysisの専有SPEC/test/implementation | prerequisiteがcompletedまたはreview済みexact revisionになった後だけroot/edgeとdiagnosticを生成する |
| `WS01-B` | pending | WS01-A | transformer planner/compilerのSPEC/test/implementation | callbackに必要なmaterializationとclient scopeだけを作り、server-only importとstatic subtreeをclient artifactから除外する |
| `WS01-C` | pending | WS01-B | server renderer、runtime SSR、components SSR | highlighted subtree、DSD、activation metadataをserver生成し、client body replayを要求しない |
| `WS01-D` | pending | WS01-C | runtime bootstrap、activation、DOM event | 既存DOMへcopy callbackだけをattachし、client root不在routeをzero-bootstrapにする |
| `WS01-E` | pending | WS01-D | plugin、docs fixture、playground E2E | SSR前表示、interaction、server-only exclusion、body非再実行、zero-bootstrapをbrowserとbundleで検証する |

WS01-E完了後、既存implementation matrixの未完了sliceへ戻り、同じIRとartifact contractへvariant、protocol、budget、race、cleanupを追加する。
WS01-EのE2Eとartifact inspectionは最終goalまで恒久的な回帰testとして保持する。

### WS01の既存dependency closure

WS01 IDは既存matrixのdependencyを短絡しません。
次のaggregate closureをWS01-0で既存のfine review unitへ展開し、各unitのcompleted commitまたはreview済みexact revision、owner、排他的write setを固定してから対象WS01 sliceをreadyにします。

| WS01 slice | 既存matrixから維持するminimum owner chain | 現在の開始可否 |
| --- | --- | --- |
| `WS01-A` | `SC02 -> SC03-Q/C/T -> PL01 -> PL02-A/V`。EG03 `4ebd2204e504c21d34e50db6e0b89b55e2c3df41`とOC01 `86204daaead270029be46acd7f212f156716fd07`はcompleted | blocked。SC02 completionから開始する |
| `WS01-B` | WS01-A、DX01、MP01、AR01、PI01、PJ01、RC01、RP01、SP01、OP01、CN01、MP02、CG01 | blocked。各aggregateをsupported subsetのfine sliceへ分けてもowner/dependencyを削除しない |
| `WS01-C` | WS01-B、RR01、MT01、SE01、SR01、SR02、SR03 | blocked。server renderer、payload、render operation、DSD integrationを同じcandidate evidenceへ接続する |
| `WS01-D` | WS01-C、CR01、RF01、LC01、CP02、CR02、DA01、DA02、DA04、RP02、SP02、OP02、CE01 | blocked。未使用protocol variantを省く場合もCE01 aggregateのdependencyを黙って削除せずfine slice化する |
| `WS01-E` | WS01-A〜D、CP01、BR01、AF01、SL01、PE01、BO01、BA01、AS01、AT01、AP01、AR02、AU01、AO01、MG01 | blocked。public/build/docs/E2E integrationまで同じartifact evidenceを使う |

このclosureのedgeを削除または逆転する変更はR7 process revisionでは行いません。
supported subsetのためにaggregateを細分化する場合は、production開始前に別のprocess revisionでfine slice、dependency、write set、integration ownerをreviewします。

reviewのrisk tier、reviewer数、candidate、evidence、収束上限は[Review policy R8](../../process/review-policy.md#policy-r8)に従う。
gate levelと再実行条件は[実装workflow](../workflow.md#implementation-gate-level)に従う。

## Dynamic scheduler

sliceのcontract固定、実装完了、review開始または収束、dependency変更、lane解放のたびにready queueを再計算する。
優先順位はcritical path、後続解放数、独立した長時間検証の順とし、write setが重ならない四laneを通常上限、統合余力がある場合は六laneを最大上限とする。
あるsliceのreviewまたはblockerは、そのsliceへ依存せずwrite setも重ならないlaneを停止しない。
固定revisionと無効化条件は[POLICY-R8-EVIDENCE](../../process/review-policy.md#policy-r8-evidence)に従う。

| Lane | Slice | Owner | 状態 | 完了dependency OID | 専有write set | 固定contract | 次のgate |
| --- | --- | --- | --- | --- | --- | --- | --- |
| L1 | R7 R2 process integration | main integration | completed | R7 R1 blocker、AR01-E `b05c061b6be3be35bbb6f21c3fb9de128c35edcb`、SC02A8D-P `fac2f6b9edce32a7470b312f990f238255cb9b7b` | implementation goal、progress | walking skeleton優先、既存dependency closure維持、review上限、段階的gate | commit `150a58de638074a72738e2bec78d0f9be2e623b6`をpush済み |
| L2 | WS01-0 dependency closure audit | main integration | implementing | R7 R2 process commit `150a58de638074a72738e2bec78d0f9be2e623b6`、implementation matrix、EG03、OC01、SC02A8D-W `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`、SC02A8E-I-C `f35f192fc5ebc316cbe28a8841620237679c83fc`、SC02A8E-I-L `942003109cbfd0cc8776ae2c665e24828996cdeb` | implementation goalとprogressのprocess tableだけ | A〜Eのexact fine slice、OID、owner、write set、integration owner、Kahn順序 | SC02A8F process revisionをreview、commit、pushしてimplementation laneを解放する |
| L3 | SC02A8D-W walker integration | main integration | completed | SC02A8A `02bdfe4a662de7f0799f3211a9464303f2a2cbbc`、A8B `7dc62e79832f28d9a196e6993c7a1d3429b5b5be`、A8C `c37a81e8d932d712c6118d6865b6b29f94d59492`、D-P `fac2f6b9edce32a7470b312f990f238255cb9b7b` | `SPEC.typ`、cumulative test、`closedDataWalker.ts`、focused test、type fixture | generic iterative walkerだけを所有し、source fieldとcloneを含めない | commit `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`をpushし、remote OID一致を確認した |
| L4 | WS01-A compiler analysis path | main integration | blocked | WS01-0、SC02、SC03-Q/C/T、PL01、PL02-A/V、EG03、OC01 | 既存ownerのfine sliceとtransformer analysisの専有SPEC/test/implementation | server root、browser callback、必要edge、dependency diagnostic | prerequisite chainの全exact revisionが固定されるまでproductionを開始しない |
| L5 | SC02A8F alias-expanding closed clone | main integrationと専有worker | ready | D-P `fac2f6b9edce32a7470b312f990f238255cb9b7b`、D-W `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`、I-C `f35f192fc5ebc316cbe28a8841620237679c83fc`、I-L `942003109cbfd0cc8776ae2c665e24828996cdeb` | main: `SPEC.typ`、`implementation.test.ts`。worker: `snapshot.ts`、`snapshot.test.ts`、`snapshot.type-fixture.ts` | completed planだけからiterative cloneを作り、callerを再読せず、aliasを出現ごとのfresh subtreeへ展開し、record/arrayを正規化する。clone、type、moduleはpackage internalのままにする | process revisionのreviewとpush後、SPECと先行testを固定してfocused gateへ進む |

AR01-Eはcommit `b05c061b6be3be35bbb6f21c3fb9de128c35edcb`、SC02A8D-Pはcommit `fac2f6b9edce32a7470b312f990f238255cb9b7b`、SC02A8D-Wはcommit `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`としてreview、gate、push、remote OID確認まで完了した。
旧SC02A8D combined draftはcommit `48106fc1bda21d4f09b9e979b57686b2bf62b458`と`refs/codex/reviews/sc02a8d-implementation-r1`で保持する。
旧`closedDataPlan.ts`のblob `11d574573b761cfe3ee2f2ecaff1db81e6e8a211`、testのblob `d4d06e0cf7f2b58fd6a7917f631ddb25ce0e975c`、type fixtureのblob `7ba30e8cdef0653befc201947691c9e11c693277`は、D-Pのoccurrence planとD-Wのgeneric walkerへ観測条件を移管済みである。
この保存先、移管先、D-W remote OIDを先に記録した後、3個のsuperseded duplicateをworktreeから整理した。combined revisionとしてreview、commit、pushは行っていない。
SC02A8D-Wの旧5-file draftもsynthetic commit `b17f6de14ee24e932310c762e3aa9473f9f16398`、tree `14955dae8663d65482b5e6c6f73b51869ae5ebe6`、`refs/codex/drafts/sc02a8d-w-r7-deferred`で履歴証拠として保持する。completed revisionの正本はcommit `510a13a0a9ed03ee61de0f9c4f34b0d6e1b62d0b`である。

### PR #80 CI repair lane

`PR80-CI1`はPR #80の`fmt / fmt`、`lint / lint`、`test / test`回帰だけを扱う一時laneであり、WS01-0とSC02A8D-Wのwrite setを変更しない。
risk tierは`medium`とする。runtime/public contractは変更しないが、root test scheduling、shared test artifact生成、複数packageとappのCI gateへ影響するためである。
`main@3c3b4eb016249d9b35d3149679b8d2df360504f5`では同一commandがgreenであり、PR HEAD `150a58de638074a72738e2bec78d0f9be2e623b6`でのみ再現したため、3件ともPR回帰と判定した。
固定contractは、fmtが未buildのVite configをloadしないこと、type-aware lint errorを型安全なtest codeで除去すること、shared publication artifactをsuiteごとに一度だけ生成すること、timeoutを延長せずworkspace package間の資源競合を除去することである。
状態は`completed`。synthetic commit `bcffb9335fd524d76eaf13701a4a1225c6a1d5ec`に対するprimary/implementation reviewは、いずれもblockerなしで`ACCEPT`した。root `fmt:check`、`lint`、`lint:type-aware`、`typecheck`、`test`、config lint、clean-checkout fmtも成功した。commit `d2822b1f032ab2e278fdaf3034aced0a9d5ce4ef`をpush済みである。
follow-upとして、CI test jobの実測wall-clockをgreen確認後に記録する。また、2個目の一時directory作成自体が失敗した場合に1個目を除去するcleanup強化は、今回のCI原因ではない低確率改善として後続test-infrastructure maintenanceへ送る。

R1 commit `d2822b1f032ab2e278fdaf3034aced0a9d5ce4ef`をpushしたCI run `29220801848`では、fmt 22秒、lint 47秒、typecheck 45秒がgreenになったが、testはtransformer内の12,000段DAG stress testが5.009秒でdefault timeoutに到達した。
package間を直列化した後も、transformer内の14 test fileが同時実行されてCPUを競合していたことが残存原因である。
production validatorは明示stackとMap/Setによる`O(V+E)`、record sortだけ`O(n log n)`であり、計算量退行はない。creatorとsnapshotの再canonicalizationは未信頼入力、digest、budget、TOCTOU境界の検証であり削除しない。
`PR80-CI2`は`packages/transformer/vitest.config.ts`だけを所有し、12,000段、709 tests、coverage、default timeoutを維持したまま、executionGraph fileをgroup 0、残る13 fileをgroup 1の排他的inline projectへ分ける。risk tierは`medium`、状態は`completed`とする。synthetic commit `1f5a20e82945256f5451079b66f7ea48979564d4`のprimary/implementation reviewはいずれもblockerなしで`ACCEPT`した。commit `6565c76a5a0dd742f21298f103e55d1ba7a46a22`をpush済みである。
focused transformer testは14 files、709 testsを3回連続で成功し、deep testは2.858〜2.937秒、package全体は5.74〜5.91秒だった。root testも全8 package、1,916 testsで成功した。

`PR80-CI2` commit `6565c76a5a0dd742f21298f103e55d1ba7a46a22`後のCI run `29221692385`では、executionGraph fileを単独化してもrunner上のfile時間は7.641秒となり、同じtestが5秒を超えた。inline projectの排他性と709 testsは正しく維持されていた。
一時計測ではlocalのtest内時間約2.97秒のうち、契約対象外の12,000件fixture作成が約1.15秒、snapshotの全record再digestとDAG検証が約1.81秒だった。
`PR80-CI3`は既存testの深度、record数、snapshot検証、default timeoutを変えず、content-addressed fixture準備だけを専用`beforeAll`へ分け、test timeoutがsnapshot検証だけを測るようにする。production、SPEC、公開APIは変更しない。risk tierは`medium`、状態は`completed`とする。synthetic commit `a6b84993e328bd124d5d571140d1ea1fe053a58e`のprimary/implementation reviewはいずれもblockerなしで`ACCEPT`した。review済みtreeと同一のcommit `63f4597c16e72b8275bac0ce80a95c50cc052da4`をpushし、local、tracking branch、remoteのexact OID一致を確認した。
focused transformer testは14 files、709 testsを3回連続で成功し、snapshot検証は1.806〜2.159秒だった。file全体のfixture生成と全33 testsは引き続き4.006〜4.878秒実行され、coverageは不変である。
最終local gateではroot `fmt:check`、`lint`、`lint:type-aware`、`typecheck`、全8 package 1,916 tests、config lintが成功した。PR #80のCI run `29222197116`はfmt 22秒、lint 52秒、typecheck 46秒、test 1分52秒、E2E 3分14秒ですべてgreenとなり、Cloudflare Workers buildもpassした。CI repair laneの未解決blockerはない。

SC02A2、SC02A3、SC02A4、SC02A5、SC02A6、SC02A7、MP01-DK1-T、MP01-DR-S-R4 integration、AR01-ID、AR01-FT、AR01-EB、AR01-DB、AR01-XB、RC01-DI2B、RC01-DI3A、RC01-DI3Bはslice-local reviewが収束し、各commitをpush済みである。
SC02A5のfixed snapshotではfocused 38 tests、shared全15 filesと224 tests、typecheck、通常lint 0件、format、build、root source/build非公開検査が成功した。
type-aware lintは変更外の`rlse.config.ts:32`に既存warning 1件だけを報告した。
Popper、Ramanujan、旧MP01 design reviewer三者、旧RC01 ownerは現在のsessionから`not_found`であり、未回収結果を収束証拠として扱わない。
Nash、Socrates、Jason、Ampereの収束試行は固定入力がレビュー中または開始前に変更されたため`REVIEW INVALID`とし、判定回数へ含めない。
Linnaeus、Lagrange、Parfitの試行はdisjointなAR01 commitによるglobal HEAD前進だけで無効にしたため、slice-local manifest導入前の無効試行として判定回数へ含めない。
MP01は`DK1 taxonomy → DR → DG → DP`の独立design revisionを維持する。旧DK2のshared bridgeは追加せず、qualificationとadmissionをSC03、PL02、CN01、MP02、AF01、SL01、RR01のowner pipelineへ分ける。
AR01は`ID nominal domain → FT finalization template → entry binding → dependency binding → export binding → DP/P`までをtype foundationとする。runtime foundationは`E → B-C → B-L → K`とし、K後に`DS → DV → DD`と`PS → {PV-U/O/E/K/S} → PV-I → PI`へ分岐する。PI後は`PC-I → {PC-T, PC-X} → PC-S → PC-C`、URL、`IT-M → IT-S → IT-V`へ進み、AF01 candidate finalization、SL01 selection、RR01 conformanceへ合流する。
RC01はRenderDefinition、generation、RenderEnvelopeを別revisionとする。
RenderDefinition identityもmodel/error、closed snapshot、identity operationの三implementation revisionへ分ける。

MP01-DR-S R1の三役は、state update modeのauthoritative input不在、`CN01-D -> CN01-G`間のvalidation/identity欠落、既存facade inventory消失、transformer向け合法export不在をblockerとした。
R2はexact schemaを撤回し、owner correction、state prerequisite、materialization/emission schema、publication、derivation、validation、identityへ分割した。
R2収束reviewは、emission側subpath不在、DM/DEを直列化した誤り、DVがPL02-Vからprojection completenessを再検証しない点、state policy admission owner不在をblockerとした。
R3はDM/DE並列化、separate publication、state semantics authorityを解消したが、DAGの必須edge省略、raw claim closure前のequality、OC02 implementationの過大粒度で再度`REJECT`となった。
R4はOC02をdesign/type/closed validation/identity/behaviorへ、PL02 state pathをdesign/lowering/admissionへ、CN01 demand validationをraw parser/acceptanceへ分割し、全dependency edgeとtrust-safe順序を明示した。
Laplaceの旧ルールfresh convergence reviewはR1からR3のblockerが解消し、新しいcorrectness blockerがないとして`ACCEPT`した。
CN01-DVP/DVAの偽造snapshotとparser-version mismatch、AS01-MP/EPのpackage inversionとsubpath、SL01のserver-first cost orderとdeterministic tie-breakを後続fixture obligationとして残す。

進捗文書、`packages/shared/src/index.ts`、package export、共通config、複数laneの統合箇所はメインセッションだけが編集する。
各laneは専有write setだけを変更し、メインセッションがreview revisionを固定する前にroot exposureと統合gateを追加する。

## 手順の進捗

| ID | 作業 | 状態 | 証拠 |
| --- | --- | --- | --- |
| S00 | branch、計画文書、baseline | completed | `gnb` で branch を作成し、計画 commit `8a0eedd` を push した。全 baseline command が成功した |
| S01 | implementation matrix | completed | 59 row 全件が AX01 の依存閉包に入り、A01〜A44 の owner/evidence を確定した。3回目の独立レビューは ACCEPT |
| S02 | verification-gate slice | completed | 5回の独立レビューを収束させ、commit `8fe6c60` を push した |
| P01 | ExecutionGraph foundation | completed | ID01、SC01、OC01、EG01、EG02、EG03 の検証、独立レビュー、commit、push が完了した |
| P02 | semantic contract と registry | in-progress | SC01 registry contract、AR01-E、SC02A8D-Pまでcompleted。残る横方向sliceはWS01が直接必要とするdependencyだけを先行する |
| WS01 | maintainable walking skeleton | blocked | WS01-0で既存dependency closureを固定し、SC02からPL02までのprerequisiteを完了した後にWS01-Aを開始する |
| P03 | 解析と placement | pending | 未着手 |
| P04 | server render | pending | 未着手 |
| P05 | materialization と projection | pending | 未着手 |
| P06 | ClientScopeGraph と client runtime | pending | 未着手 |
| P07 | DOM activation | pending | 未着手 |
| P08 | protocol と lifecycle | pending | 未着手 |
| P09 | 公開 API と移行 | pending | 未着手 |
| P10 | 全体 acceptance | pending | 未着手 |
| S10 | push 後の全体監査 | pending | 未着手 |
| S11 | exact remote OIDと監査済みcontentの完了検証 | pending | 未着手 |
