# 宣言的 UI 実行分割の実装指示

この文書全体を `/goal` の実行指示として扱ってください。
ユーザーの承認を待たず、調査、仕様更新、テスト作成、実装、移行、検証、レビュー、commit、push を自律的に進めてください。

## 最終目標

最終目標は次のとおりです。

> 宣言的 UI から server と client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する設計を、Dathra の production code、仕様、テスト、公開 API、文書、playground に実装する。

`.temp/declarative-ui-execution-partitioning.md` を execution partitioning の設計判断の正本として扱ってください。
同文書の「破棄した案」を除く規範本文、解決済みの設計事項、実装時の検証事項を実装要件とします。

この goal は production code の変更を明示的に許可します。
設計文書に残る「実装未着手」と「production code を変更しない」という記述は、設計フェーズの完了時点を表す状態記録です。
実装開始時に状態を「実装中」へ更新してください。
手順 10 の全体監査が `ACCEPT` になった後に「実装完了」へ更新し、その文書 commit の exact remote OID に対する手順 11 の最終監査が `ACCEPT` になった後だけ goal を完了してください。

後方互換性は制約にしません。
設計正本が削除を決めた hydration API、island semantics、fallback は、互換 layer を残さず置き換えてください。
ただし、`@dathra/store` の snapshot API など、UI hydration と無関係な同名 API を文字列一致だけで削除してはいけません。

この goal の実行開始を、大規模変更の実装アプローチに対するユーザーの承認として扱ってください。
設計、優先順位、実装方法についてユーザーへ追加承認を求めないでください。

設計および実装の独立レビューは、`.temp/goal.md` の手順 4 から手順 6 にある並列レビュー、`blocker` / `follow-up` 分類、収束確認の規則に従ってください。
本文中の逐次レビュー、または実質的な指摘がなくなるまで無制限に反復する規則は、この並列レビュー規則によって supersede されます。
`.temp/goal.md` の設計検討専用の作業条件はこの implementation goal へ持ち込まず、レビュー手順だけを共通規則として参照してください。

## 正本と優先順位

実装判断では、次の資料を照合してください。

1. root と対象 package の `AGENTS.md`
2. `.temp/declarative-ui-execution-partitioning.md` の現行方針
3. 対象 API と同じディレクトリの `SPEC.typ`
4. 対象 API と同じディレクトリの `implementation.test.ts`
5. compiler、runtime、plugin、components、core、docs、playground の実コード
6. 依存 package、Web 標準、外部技術の一次資料

現行 `implementation.ts` は既存実装を調査する根拠ですが、新仕様の正本ではありません。
新しい振る舞いは設計正本から対象 package の `SPEC.typ` へ落とし込み、その仕様を `implementation.test.ts` で検証してから実装してください。

Accepted ADR の意味内容を直接書き換えてはいけません。
既存 ADR と新設計が衝突する場合は、既存 ADR を supersede する新しい ADR を追加してください。

設計正本に実装不能な矛盾が見つかった場合は、都合のよい fallback を実装してはいけません。
該当事項を未決事項へ戻し、独立した sub-agent の評価を経て設計正本に superseding decision を記録してから実装を再開してください。

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

## 作業記録

実装開始時に `.temp/declarative-ui-execution-partitioning-implementation-progress.md` を作成してください。
この進捗文書には、少なくとも次の内容を記録してください。

- 設計要件と acceptance work の一覧
- 各要件を担当する package、API、SPEC、test、implementation
- dependency と実装順序
- `pending`、`in-progress`、`completed` の状態
- 実行した検証 command と結果
- 独立レビューの結果と採否
- slice ごとの commit hash と push 先
- 未完了事項と外部 blocker

設計正本の acceptance work を要約だけで消化せず、一項目につき一つ以上の直接的な検証証拠へ対応付けてください。
長期作業の context が圧縮されても、この進捗文書から次の作業を再開できる状態を維持してください。

goal 文書と進捗文書は `.temp/` が ignore 対象でも `git add -f` で feature branch に含めてください。

## 実装戦略 R7：walking skeletonを先に通す

この節は、未完了foundationをphase順に横展開してからuser-visible integrationへ進む実装順序と、すべてのsliceへ同じ証跡とfull gateを要求する規則をsupersedeします。
設計正本のruntime semantics、既存sliceのowner、dependency、排他的write set、acceptance obligationは変更しません。
変更するのは実装の優先順位、review unit、review回数、gateの実行頻度です。

次の主要マイルストーンを**WS01 maintainable walking skeleton**とします。
WS01は専用の簡易IRまたは使い捨てruntimeを作らず、最終構造と同じ経路を通る最小のend-to-end実装です。

```text
source
  -> ExecutionGraph
  -> ObservationContract
  -> MaterializationPlan
  -> ClientScopeGraph
  -> server/client artifact
  -> SSR
  -> activation
```

最初に扱うworkflowは、server-onlyなhighlight処理とstatic subtreeをserverへ残し、copy interactionのcallbackだけをclient artifactへ含める`DocCodeBlock`相当のfixtureです。
特定のcomponent名またはfixture pathをproduction codeへ埋め込んではいけません。
最初のrevisionで対応するnode、edge、materialization、activation variantを限定して構いませんが、未対応variantをeager hydration、component rerender、full module配信、暗黙RPCへfallbackしてはいけません。
未対応variantはdependency pathを持つcompile diagnosticにし、後続sliceは同じIRとartifact contractへvariantを追加してください。

| slice | 完成させる経路 | 主なowner | 単独のacceptance |
| --- | --- | --- | --- |
| `WS01-0` | 既存matrixからWS01-A〜Eに必要なfine slice、dependency OID、owner、排他的write setを抽出する | main integration process | 未完了dependencyを迂回せず、各WS01 sliceの開始条件とintegration ownerをacyclicな表へ固定する |
| `WS01-A` | sourceからserver root、browser callback、必要edgeを導出し、ExecutionGraphとObservationContractへ接続する | transformer analysis | component名に依存しないfixtureからroot/edgeとdiagnosticを決定的に生成する |
| `WS01-B` | callbackに必要なmaterializationとclient scopeだけを導出し、server/client artifact closureを分離する | transformer planner/compiler | server-only importがclient closureへ入らず、static subtreeがclient mutation planへ入らない |
| `WS01-C` | server artifactからstatic HTML、DSD、activation metadataを生成する | transformer server renderer、runtime SSR、components SSR | highlighted subtreeをserverで生成し、component bodyのclient再実行を要求しない |
| `WS01-D` | 既存DOMへcallbackだけをattachし、client rootがないrouteをzero-bootstrapにする | runtime bootstrap、activation、DOM event | copy interactionだけがactivateされ、static DOM identityを維持し、root不在時はpayloadとbootstrapを生成しない |
| `WS01-E` | build toolからbrowserまで接続し、artifactを検査する | plugin、docs fixture、playground E2E | SSR前表示、interaction、server-only exclusion、body非再実行、zero-bootstrapを一つのworkflowで検証する |

WS01-0を完了した後、WS01-AからWS01-Eを直列の主経路とします。
各sliceはその時点で実用的なsupported subsetとしてgreenにし、後続sliceのplaceholder APIまたはproduction stubを追加してはいけません。
WS01-EのE2Eとartifact inspectionはgoal完了まで恒久的な回帰testとして保持してください。

WS01 IDは既存matrixのdependencyを置き換えるaliasではありません。
WS01-AはcompletedなEG03 `4ebd2204e504c21d34e50db6e0b89b55e2c3df41`とOC01 `86204daaead270029be46acd7f212f156716fd07`に加え、少なくともSC02 completion、SC03-Q/C/T、PL01、PL02-A/Vの順に依存します。
したがって、SC02の直接dependencyであるSC02A8D-WはWS01が直接必要とするfoundationとして再開対象です。

WS01-0はWS01-B以降についても、現行matrixのtarget ownerからdependency closureを逆向きにたどり、必要なaggregateを既存のfine review unitへ展開します。
既存aggregateの一部variantだけをsupported subsetへ含める場合は、ownerとdependency edgeを保ったfine sliceをprocess reviewで先に固定してください。
completed commitまたはreview済みexact revisionがないdependencyをdiagnosticで代用してproduction実装を開始してはいけません。

この戦略を採用した時点でreview中またはcommit準備中のfixed revisionは、blobとdecision anchorが変わっていなければ完了まで継続します。
fixed revisionになる前の未commit差分は破棄せず、実行中commandを安全に終了し、write ownershipと再開条件を進捗文書へ記録して保管してください。
その差分を横方向foundation sliceとしてreview、commit、pushせず、WS01が直接必要になった場合またはWS01-E完了後に再開します。
それ以外の横方向foundation sliceも、WS01が直接必要とするdependencyを除いてWS01-E完了後へ延期します。

## Reviewとgateの負荷配分

同一review unitの回数上限は`.temp/goal.md`の手順4から手順6に従います。
有効な初期レビューは一回、blocker修正後の収束レビューは一回だけです。
収束後もblockerが残る場合は、三回目を開始せずreview unitを分割するか前提を再設計してください。

`low`のimplementation sliceは、review対象のsynthetic commit OID、exact path一覧、focused gate結果を進捗文書へ記録すればよく、別のproposal、manifest、attestationを必須としません。
`medium`と`high`、package境界、公開API、identity、trust、authority、race、server/client artifact inclusionを変更するsliceはslice-local manifestとattestationを維持してください。
process文書だけを変更しruntime contractを変更しないrevisionは、一人のreviewerが義務保持、dependency、実行可能性だけを確認します。

| gate level | 必須commandとartifact |
| --- | --- |
| `low` | focused test、scoped typecheckまたはcompile、scoped lint、format、diff check |
| `medium` | `low`に加え、変更packageのtest、typecheck、lint、build |
| `high` | `medium`に加え、影響するconsumer package、artifact inspection、関連E2E |
| WS01 integration | WS01の累積integration test、browser E2E、server/client bundle inspection |
| milestone / final | root build、test、typecheck、lint、format、全関連E2E |

同じfull package test、declaration build、root buildをdisjointなpure helperごとに繰り返してはいけません。
correctness上の具体的な疑義、baselineとの差分、package境界変更がある場合は、表の最低条件を超えるtargeted gateを追加してください。

## 手順 0：実装 branch と baseline を準備する

最初に `git status`、最近の commit、local HEAD、追跡先 remote branch を確認してください。
現在の `doc/hydration-policy` が clean で、`origin/doc/hydration-policy` と同期していることを確認してください。

新規 branch は独自 command を使って次のように作成してください。

```sh
gnb -f doc/hydration-policy declarative-ui-execution-partitioning
```

作成される branch 名は `feature/declarative-ui-execution-partitioning` とします。
同名 branch がすでに存在する場合は新しい branch を重ねて作らず、その branch の状態と remote tracking を確認して継続してください。
`git reset --hard`、force push、既存の user changes の破棄は禁止します。

branch 作成後、goal 文書と進捗文書を最初の計画 commit に含め、remote tracking branch を作成してください。

実装前 baseline として、少なくとも次を実行してください。

```sh
pnpm build
pnpm test
pnpm typecheck
pnpm lint
pnpm fmt:check
pnpm test:e2e
pnpm --filter @dathra/config lint
pnpm --filter @dathra/config lint:type-aware
pnpm --filter @dathra/docs build
pnpm --filter @dathra/docs build:cloudflare
pnpm --filter @dathra/docs fmt:check
pnpm --filter @playground/e2e build
pnpm --filter @playground/e2e fmt:check
pnpm --filter @playground/ssr build
pnpm --filter @playground/ssr fmt:check
pnpm --filter @playground/vanilla build
pnpm --filter @playground/vanilla fmt:check
pnpm --filter @playground/getting-started-check build
pnpm --filter @playground/nuxt build
```

baseline failure がある場合は、失敗 command、対象 package、既存 branch でも再現するかを進捗文書に記録してください。
既存 branch でも再現する scope 外 failure が最終検証を妨げる場合は、手順 2 と同じ規律で独立した baseline-repair slice を作成してください。
baseline-repair slice は failure を解消する最小変更だけを含め、独立レビューと別 commit を必要とします。
production implementation を変更する repair では、関連 SPEC、test、implementation の三点を更新してください。
package script、tooling config、文書、format だけを修正する repair では、変更対象に対応する検証を追加し、存在しない production API の三点セットを作ってはいけません。
無関係な機能追加や refactor を baseline repair の名目で行ってはいけません。
repository 内で修正できず、認証、権限、外部 service、host dependency、user の product decision が必要な failure だけを外部 blocker として扱ってください。
最終完了時には、上記 command がすべて成功する状態を必要とします。

手順 1 で implementation matrix を確定した後、最初の vertical slice として verification-gate slice を実行してください。
verification-gate slice を完了するまで Phase 1 の production implementation を開始してはいけません。
この slice では、`@dathra/docs` と全 playground に実処理を持つ `build`、`fmt:check`、`test` script を揃えてください。
既存の中央 E2E suite を package の `test` から呼ぶ場合は、その package 固有の workflow を選択して検証しなければなりません。
`passWithNoTests`、常に成功する shell command、build だけを別名にした test script は gate として認めません。
新しい gate 自体を実行し、独立レビュー、commit、push を完了してから Phase 1 へ進んでください。

## 手順 1：実装 matrix を確定する

設計正本から、公開 API、compiler IR、runtime state、wire schema、artifact、diagnostic、削除対象、acceptance work を抽出してください。
抽出した要件を package と既存 API へ対応付け、進捗文書に implementation matrix を作ってください。

少なくとも `shared`、`components`、`runtime`、`transformer`、`plugin`、`core`、`docs`、`playgrounds` を確認してください。
`reactivity` と `store` は名前だけで変更対象に含めず、ExecutionGraph と materialization の依存が実際に到達する場合だけ対象にしてください。

新しい API または内部機能が必要な場合は、次の構成を作業単位にしてください。

```txt
packages/{package-name}/src/{api-name}/
├── AGENTS.md
├── SPEC.typ
├── implementation.test.ts
└── implementation.ts
```

この四点セットは API の仕様、契約 test、package-local facade を固定する最小構成です。
`implementation.ts` 一ファイルへすべての責務を集約する規則ではありません。
独立して説明できる parser、validator、solver、state machine、budget ledger などは同じ API directory の internal module へ分け、`implementation.ts` からだけ公開してください。

既存ディレクトリへ責務を追加する場合は、そのディレクトリの既存構成と正準 `SPEC/SPEC.typ` の記法に合わせてください。

implementation matrix は、依存先のない foundation から user-visible workflow へ向かう順に並べてください。
package 単位で横に実装するのではなく、観測可能な振る舞いを一つずつ完成させる vertical slice に分割してください。

## 手順 2：ready queue と並列 lane を更新する

implementation matrix を dependency DAG として扱い、未完了項目を一つずつ直列に選んではいけません。
依存条件を満たし、write set が重ならず、互いの未確定契約を前提にしない vertical slice の集合を ready queue としてください。
通常は四本、利用可能な独立実行枠と統合余力がある場合は最大六本の implementation、review、verification lane を同時に進めてください。
一度に複数の密結合 slice を開始してはいけません。

次の事象が起きるたびに、phase の完了を待たず ready queue と lane assignment を再計算してください。

- dependency slice の contract が固定された
- implementation と slice gate が完了した
- review が開始、収束、または blocker によって再開された
- 設計変更によって dependency または write set が変わった
- implementation、review、verification lane のいずれかが空いた

slice の実行状態は次の意味で使ってください。

- `pending`：dependency が未完了で開始できない
- `ready`：production implementation を開始するdependencyが完了している
- `contract-ready`：SPEC、先行test、公開または内部contractが固定され、実装待ちである
- `implementing`：宣言済みwrite setでproduction implementationとtargeted gateを進めている
- `reviewing`：同一revisionを固定して独立reviewを進めている
- `merge-ready`：既知のblockerがなく、commitとpushを待っている
- `completed`：検証、review、commit、push、local/remote同期が完了している
- `blocked`：未解決dependencyまたは外部blockerがあり、そのslice自身を進められない
- `reopened`：completed後の監査で不足が見つかり、再作業が必要である

`contract-ready` のdependencyからはdownstreamの調査、SPEC案、fixture、red test準備だけを開始できます。
downstreamのproduction implementationは、dependencyが`completed`になるか、review済みのexact revisionを同じisolated laneへ明示的に取り込んだ後だけ開始してください。

ready queueでは、最長のdownstream dependency chain上にあるslice、後続sliceを多く解放するslice、長時間の独立検証を持つsliceの順で優先してください。
あるsliceのreview、blocker修正、収束確認は、そのsliceへ依存せずwrite setも重ならないlaneを停止する理由になりません。
ただし、WS01-Eが完了するまではWS01の直列主経路を最優先します。
WS01へ直接必要でないfoundation sliceは、dependencyがreadyでもmain integration owner、共有SPEC、cumulative test、package exportのwrite ownershipを占有してはいけません。
WS01の待ち時間に並行実行できるのは、主経路とwrite setが分離し、統合負荷によってWS01を遅らせない作業だけです。

各laneのowner、状態、dependency OID、write set、固定contract、次のgateを進捗文書へ記録してください。
API directory内のSPEC、test、production moduleは担当laneだけが編集し、進捗文書、root barrel、package export、共通config、複数laneの統合箇所はメインセッションだけが編集してください。
担当laneは共有統合ファイルを変更せず、メインセッションがslice revisionを固定する前に必要なexport変更を統合してください。

`medium`と`high`の各laneの固定revisionは、proposal、割当write setの完全なpath inventoryと全fileのmode、SHA-256、Git blob OID、直接dependency OID、decision anchor、synthetic review commit OIDを持つslice-local manifestで表してください。
`low`のimplementation sliceは前節の軽量化規則に従い、immutable synthetic commit、exact path一覧、gate結果だけを固定してください。
decision anchorはcanonical source path、stable decision IDまたは決定的な抽出command、抽出結果のSHA-256とGit blob OIDを持ちます。
共有文書からcopyした抜粋だけをanchorとしてはいけません。

`medium`と`high`のmanifestの全path、mode、hash、blob、dependency、decision anchor、synthetic commit、gate commandを一回の決定的なreview attestationで検証してください。
attestationはmanifest SHA-256とsynthetic commitへ束縛し、メインセッションがreview開始前、結果統合直前、commit直前に再生成または再検証してください。
reviewerごとに全OID照合とfull gateを重複実行させず、reviewerはattestation bindingと担当論点に必要な対象だけをspot checkします。
具体的な不整合またはcorrectness上の疑義がある場合は、対象を限定したhash照合、test、artifact inspectionを追加できます。

workerは実装と検証を終え、実行中commandを終了し、write ownershipをメインセッションへ返してからreviewへ移ります。
メインセッションは固定blobをGit object databaseへ保存し、current dependency baseへ重ねたsynthetic commitをbranch移動なしで作成します。
reviewerはそのisolated snapshotを評価し、shared worktreeを正本にしません。

review proposal、slice-local manifest、進捗文書はメインセッションだけが編集します。
review中のproposal、manifest、割当write setはfreezeし、workerとreviewerに編集させてはいけません。

別laneのcommitでbranch HEADが進んだことや、共有文書の無関係な節が変わったことだけをreview無効化の理由にしてはいけません。
proposal content、write-set membership、対象file content、dependency content、またはdecision anchorが変わった場合だけ、そのsliceのrevisionを無効にしてください。
外部sessionの変更は保持し、対象reviewを無効にして新revisionへ固定してください。

slice 開始前に次を明文化してください。

- この slice が実現する設計要件
- 変更する package と API
- 更新する SPEC と ADR
- 先に追加する test case
- compiler、runtime、SSR、browser、plugin、公開 API への影響
- failure、race、authority、budget、cleanup の edge case
- slice 完了を証明する command と artifact inspection

続いて、slice に含まれる契約を、観測可能な振る舞い、owner、依存先、変更するmodule、先行test、単独でgreenにできるかの表へ分解してください。
別々に仕様化して検証でき、一方を実装しても他方の契約を仮実装で固定せず、repositoryを整合したgreen状態にできる契約は、別のvertical sliceにしてください。
public APIへまだ公開しないfoundationでも、後続実装なしに自身の契約を直接検証でき、placeholderではない場合は独立したvertical sliceとして扱えます。

次のいずれかに該当した場合は、実装を開始せずslice分割を再判定してください。

- 一つのsliceが、互いに独立したparser、normalizer、semantic validator、closure validator、solver、state machine、identity operationを三つ以上含む
- 一つのsliceが、別々に検証できるpublic schema、trust boundary、authority boundary、永続identityを複数変更する
- 一つのsliceの先行test計画に、単独でgreenにできる契約群が三つ以上ある
- 手書きのSPEC、test、production codeの予定差分が合計1,500行を超える、または一つの手書きfileが1,000行を超える見込みである

行数条件は自動的な分割境界ではなく、意味的な分割を再判定するための停止条件です。
再判定の結果、分割しない場合は、各責務を別sliceへ分けると成立しない同一不変条件と、reviewerが一つのrevisionとして評価できる根拠を進捗文書へ記録してください。
実装後にこの条件へ到達した場合も、そのままレビューへ進まず、未commit変更を保持したままreview unitを再編してください。
後続sliceのtestはそのsliceの開始時に追加し、現在のsliceへ意図的に失敗する将来testを混在させてはいけません。

次のいずれかを扱う slice は high-cost slice とし、実装前に責務と module の対応表を作成してください。

- untrusted な可変長 input の parser
- fixed point、再帰構造、SCC
- many-to-many relation、relation join、積集合
- cross-package state または authority boundary

high-cost slice では、各 relation または処理について owner、左右の最大 cardinality、利用する index、worst-case complexity、出力上限、対応する budget counter と課金タイミングを一表にしてください。
該当しない欄は、理由を付けた `N/A` として構いません。
この表から独立した parser、validator、derivation、index、state machine が見つかった場合は、同じ vertical slice 内でも internal module を分けてください。
一つの vertical slice であることを、一つの source file であることと同一視してはいけません。
internal moduleへ分けるだけでは前述のreview-unit admission gateを満たしません。
別々にgreenにできる責務は、source fileだけでなくvertical sliceとreview revisionも分けてください。

この内容を進捗文書と session plan に反映してください。

新しい設計判断または既存判断を supersede する変更が必要な場合は、SPEC と test を更新する前に `.temp/goal.md` の手順 4 から手順 6 で設計案をレビューしてください。
既存の Accepted decision を適用するだけの slice では、設計レビューを重ねず実装へ進んでください。

## 手順 3：SPEC と test を先に更新する

production implementation を変更する前に、対象 API の `SPEC.typ` を更新してください。
次に `implementation.test.ts` へ期待する振る舞いと failure case を追加し、可能な範囲で新 test が旧実装に対して失敗することを確認してください。

この goal の実行をもって、旧 hydration semantics を検証する test の修正と置換を明示的に許可します。
ただし、旧 test を削除する場合は、superseding SPEC と新契約を検証する replacement test を同じ slice に追加してください。
coverage を減らすための test 削除、assertion の弱体化、skip 化は禁止します。

SPEC、test、implementation の三ファイルは、各 slice の終了時点で相互に整合させてください。
次の slice に進むために、意図的な不整合を commit してはいけません。

## 手順 4：production code を実装する

既存 package の責務と local pattern に従い、SPEC と test を満たす最小の production change を実装してください。
設計正本が要求する複雑さを、簡単な compatibility fallback、eager hydration、full module 配信、component rerender、暗黙 RPC へ置き換えてはいけません。

compiler unknown は dependency closure を示す diagnostic にし、runtime fallback の理由にしないでください。
server-only dependency が client artifact に到達した場合は、bundle を許可して runtime で無視するのではなく build を失敗させてください。

公開 API には英語の JSDoc を追加してください。
code comment も英語で記述し、処理から明らかなコメントは追加しないでください。
TypeScript の型安全性を弱める cast、`any`、unchecked wire object、private brand の shape-based reconstruction は導入しないでください。

unrelated refactor、format churn、metadata update を同じ slice に含めないでください。
作業中に user または別 agent の変更を見つけた場合は、破棄せず、その変更と整合する形で実装してください。

## 実装順序

次のphase一覧はgoal全体のacceptance coverageとdependencyを表し、WS01-E完了前のscheduler順序を表しません。
実装はWS01の主経路を優先し、各WS01 sliceが必要とするphase要件だけを最終構造へ実装してください。
WS01-E完了後は、次のdependency orderを基本として未完了variantとprotocolを拡張します。
実コードを調査して依存関係が異なると証明できた場合は、理由を進捗文書に記録して順序を修正してください。

### Phase 1：ExecutionGraph foundation

- ModuleCoordinator と module graph snapshot
- ExecutionGraph の node、edge、TemplateNode、Occurrence、identity
- ObservationContract、composition、RealizationWitness
- canonical preimage、digest、qualified ID の共通 primitive
- incremental invalidation と deterministic graph test

### Phase 2：semantic contract と registry

- semantic fact、relation、execution contract
- registry descriptor と environment/role binding
- browser/server-request projection と protocol binding
- conflict、namespace、dangling reference、kind mismatch diagnostic
- contract compiler と runtime validation

### Phase 3：解析と placement

- root、read、effect、callback、module evaluation の導出
- functional component と `defineComponent` の graph transparency
- function extraction、capture、mutable state、module closure
- environment constraint、exposure、authority label
- finite candidate solver、cost vector、diagnostic path

### Phase 4：server render

- server renderer を ExecutionGraph から生成する経路
- RenderOperation、retry、cancellation、header、stream
- FinalHeaderCommit、Early Hints、non-atomic writer
- DSD、static DOM、style artifact の server output

### Phase 5：materialization と projection

- MaterializationRequirement と MaterializationPlan
- snapshot、codec、graph-table、reference、subscription、remote operation
- request class、projection definition、projection instance
- artifact address、integrity、manifest core、fixed envelope、plan identity
- budget、wire validation、private loader と boot authority

### Phase 6：ClientScopeGraph と client runtime

- client root、activation group、shared state、prerequisite
- lifetime owner、lease、generation、allocation/commit transaction
- bootstrap の request-reachable projection
- RuntimeFailureChannel、FailureRef、cleanup ledger
- client root がない route の zero-bootstrap path

### Phase 7：DOM activation

- marker、binding、existing DOM attachment
- DSD parse fence と custom-element reaction ordering
- reconciliation、user input、autofill、history restoration
- event admission、interaction recording、dynamic client UI
- `render:client`、`activate:*`、`dom:external`

### Phase 8：protocol と lifecycle

- reference cache、grant、lease、release
- subscription continuity、namespace、session incarnation、pair fence、resync、ack、GC
- remote admission、canonical wire、authorization cut、receipt、recovery、watermark
- effect、activation、dispose、late settlement、failure containment
- hard budget と bounded cleanup

### Phase 9：公開 API と移行

- components、runtime、core、plugin の export
- `defineComponent` と functional component の最終 semantics
- docs と playground の新 API への移行
- `DocCodeBlock` の server/client artifact 分割
- 旧 hydration、island、manual hydrate、fallback の削除
- 旧 semantics の test fixture と reference data の置換

### Phase 10：全体 acceptance

- 設計正本の全 acceptance work の直接検証
- cross-package integration と E2E
- artifact closure、byte identity、reproducible build の検査
- race、budget、cancellation、cleanup、authority の stress test
- incremental build cost と runtime memory の測定
- 公開 API、docs、example の整合確認

各 phase は複数の vertical slice に分割して構いません。
型だけをまとめて追加し、利用されない placeholder を残したまま phase 完了としてはいけません。

## 手順 5：slice を検証する

sliceごとの最低gateは「Reviewとgateの負荷配分」に従ってください。
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

## 手順 6：独立レビューを並列実行する

各 vertical slice の実装と検証が完了した後、実装を担当していない新しい独立した sub-agent に同一 revision を並列レビューさせてください。
同じ agent session に提案、実装、最終評価を完結させてはいけません。
write setとdependencyが独立した複数sliceは、それぞれのrevisionを固定し、sliceごとのreviewer setを混同せず同時にreviewして構いません。
一つのsliceが`reviewing`である間も、無関係なsliceのimplementation、verification、reviewを継続してください。

`medium`と`high`のreviewerにはslice-local manifestを渡し、manifestに含まれないbranch HEADの前進やdisjoint write setの変更を`REVIEW INVALID`にしないよう明示してください。
`low`のimplementation sliceでは、manifestの代わりに前節で固定したsynthetic commit OID、exact path一覧、gate結果、適用したAccepted decisionのpathまたはIDを渡してください。
`medium`と`high`が共有設計文書を参照する場合は、文書全体のhashではなく、source pathと決定的な抽出規則を持つdecision anchorをmanifestへ固定してください。
`medium`と`high`のreviewerはmanifestのsynthetic commitをisolated worktreeで読み、manifest hash、synthetic commit、review attestationのbindingを確認してください。
`low`のreviewerは同じくisolatedなsynthetic commitを読み、exact path一覧とgate結果を確認してください。

review開始前にrisk tierと根拠を進捗文書へ記録し、`medium`と`high`ではproposalにも記録してください。
このrisk tier、output limit、delta convergence規則と、`medium`、`high`のattestation規則は、新たに固定するrevisionから適用し、すでにreviewを開始したrevisionへ遡及適用しません。

- `low`：一package内のtype-only surface、またはAccepted decisionを適用するpure internal helperであり、state transition、untrusted input reflection、parser、public API、wire、identity、trust、authority、server/client artifact inclusionを変更しないslice。reviewerは一人
- `medium`：`low`と`high`のどちらにも該当しないslice。reviewerは二人
- `high`：複数package境界、identity、trust、authority、concurrency、race、state machine、untrusted可変長parser/serializer、server/client artifact inclusion、runtime admission、公開API、wire schema、永続identityのいずれかを変更するslice。reviewerは三人

reviewer の役割は次のように分けてください。

1. primary：correctness、failure、型安全性、既決定事項との整合性
2. implementation：SPEC / test / implementation、artifact、性能、budget、公開 API（`medium`と`high`）
3. boundary：最終目標、identity、trust、authority、race、package boundary、暗黙fallback、過剰設計（`high`）

primary reviewerには、少なくとも次をすべて確認させてください。
implementation reviewerとboundary reviewerは担当範囲と交差する項目だけを確認し、primaryの前提に具体的な矛盾を見つけた場合は担当外でも報告してください。

- 設計正本、SPEC、test、implementation が一致するか
- old hydration semantics または暗黙 fallback が残っていないか
- server-only closure が client artifact へ漏れないか
- ownership、generation、session identity、cleanup が race-safe か
- authority、private brand、wire DTO、receipt の trust boundary が保たれるか
- budget と terminal state が resource leak や永久 hole を作らないか
- public API と diagnostic が実用的か
- test が implementation detail ではなく契約を検証しているか
- unrelated change や未完了 placeholder が混入していないか

reviewerへ渡すreview capsuleは2,000 tokens以内を目安とし、sliceの決定、変更した不変条件、担当論点、関連diff、decision anchor、attestation参照だけを含めてください。
proposal、manifest、source、test outputをcapsuleへ全文転記せず、固定pathまたはOIDから必要な箇所を読ませてください。
reviewerの通常出力は800 tokens以内、blocker最大3件、follow-up最大3件を目安とし、成功した機械検証を繰り返し列挙させないでください。
4件以上の指摘は省略せず同じroot causeの最大3 groupへまとめ、安全にまとめられない場合は上限超過理由を明記させてください。

メインセッションは全 review result の重複を除き、根拠とコードを照合して、正しい指摘だけを採用してください。
一人がblockerを報告しても、同じfixed revisionの初期reviewer setを停止せず、全roleの結果を回収してから修正してください。
外部変更でfixed inputが無効になった場合だけ早期停止でき、その場合は新revisionへ通常人数の初期reviewer setを再実行してください。
結果統合直前にmanifest、proposal、全write-set blob、dependency OID、decision anchorを再照合し、不一致なら`REVIEW INVALID`としてください。
指摘は `.temp/goal.md` の規則に従って `blocker` と `follow-up` に分類してください。
`blocker` はまとめて修正し、targeted test と slice gate を再実行してください。
`follow-up` は進捗文書へ記録し、現在の slice を停止する理由にしないでください。
レビュー上の `blocker` は修正必須の指摘を表し、「自律実行と blocker」で定義する外部 blocker や goal の停止状態を意味しません。

`blocker` を修正した場合は、最初の並列レビューに参加していない一人の独立した sub-agent に収束確認を依頼してください。
収束確認は原則一回とし、初期revision、採用blocker、変更blobとhunk、影響dependency closure、targeted gate attestationだけを渡すdelta reviewにしてください。
収束reviewerはblocker解消と変更範囲のregressionだけを確認し、初期snapshot全体を再評価しません。
write set、owner、public contract、trust boundaryがblocker解消範囲を越えて変わった場合は、risk tierを再判定した新しい初期reviewを実行してください。
残る不確実性は追加の全面レビューではなく、SPEC、test、最小実装、または artifact inspection で検証してください。
収束確認でblockerが残った場合は同じreview unitの三回目を開始せず、`.temp/goal.md`の回数上限に従ってunit分割または前提の再設計へ戻ってください。
収束確認を待つ間に停止するのは、そのrevisionとdownstream dependencyだけです。
ready queueの無関係なlaneは停止せず、手順2の再計算結果に従って進めてください。

sub-agent は調査、fixture、独立した write set の実装にも使えます。
ただし、メインセッションは各変更の統合、SPEC/test/implementation の整合、最終判断に責任を持ってください。

## 手順 7：slice を commit して push する

review が収束した slice だけを stage してください。
無関係な変更、生成 cache、coverage output、debug log を commit に含めてはいけません。

commit直前にmanifest自身、proposal、全dependency OID、decision anchorを再照合してください。
staged path inventory、file mode、blob OIDがmanifestの割当write setと完全一致しない場合はcommitしてはいけません。
commit 前に `git diff --check` と staged file listを確認してください。
変更内容を特定できる commit message で commit し、`feature/declarative-ui-execution-partitioning` へ push してください。
commit後にcommit treeの対象path、mode、blob OIDをmanifestへ再照合してください。
push 後は local HEAD と tracking branch が同じ commit を指すことを確認してください。

進捗文書へ commit hash と検証証拠を記録してください。
未完了 slice がある場合は、ユーザーへ確認を求めず手順 2 に戻ってください。

## 手順 8：旧実装を削除する

新経路で全 call site と fixture を置き換えた後、設計正本が破壊的削除を決めた UI hydration implementation を削除してください。
旧経路を先に削除して作業ツリーを長期間壊した状態にせず、同じ slice で consumer migration と replacement test を完了してください。

最終的に `rg` で旧 API、directive、marker、island metadata、scheduler、fallback の参照を調査してください。
historical design record を除き、production、public export、docs、playground、active test に旧 semantics を残してはいけません。
同名でも別責務の API は、qualified import path と振る舞いを確認して保持してください。

## 手順 9：全 acceptance work を検証する

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

## 手順 10：push 後の全体監査を行う

全変更を commit、push した後、同一の exact remote OID を三人の新しい独立した sub-agent に並列監査させてください。
reviewer は correctness と trust boundary、SPEC と実装の完全性、最終目標と artifact acceptance の三つの役割に分けてください。
全 reviewer には設計正本、implementation matrix、全変更 diff、関連 SPEC、test、implementation、公開 API、docs、playground、最終検証結果を確認させてください。

次を監査対象にしてください。

- 設計要件の未実装、部分実装、意味のすり替え
- SPEC、test、implementation の不整合
- server-only closure の client artifact 混入
- fallback または旧 hydration semantics の残存
- race、authority、budget、cleanup、wire boundary の欠落
- docs、example、public export の stale state
- acceptance evidence が requirement の範囲を直接証明しているか

監査結果は重複を除き、`blocker` と `follow-up` に分類してください。
`blocker` が見つかった場合は該当 slice を reopened にして手順 2 へ戻ってください。
修正後は新しい一人の reviewer で収束確認し、最新の検証結果、commit、push、exact remote OID を監査させてください。
`follow-up` だけを理由に全体監査を反復してはいけません。
全 reviewer の指摘を統合した結果に `blocker` がなければ、手順 10 の全体監査を `ACCEPT` としてください。

## 手順 11：完了を報告する

全体監査が `ACCEPT` になった後、設計正本の状態を「実装完了」へ更新してください。
進捗文書の全 implementation matrix と acceptance work を completed にしてください。

最後の文書変更も commit、push し、その commit を対象に clean tree と local/remote 同期を再確認してください。
監査直前に `git rev-parse HEAD` と `git ls-remote --heads origin refs/heads/feature/declarative-ui-execution-partitioning` を実行し、local HEAD と remote branch OID が一致することを確認してください。
その後、別の二人の新しい独立した sub-agent に、この exact remote OID を明示して最終監査を並列に依頼してください。
一人は実装完了の状態変更、進捗文書の completed 宣言、acceptance evidence、最新 diff を確認し、もう一人は clean tree、local/remote 同期、監査対象 OID の不変性を確認してください。
最後の文書 commit が表現変更だけであっても、この監査を省略してはいけません。
二人の監査結果を統合し、`blocker` がなければ最終監査を `ACCEPT` としてください。
最終監査で `blocker` が出た場合は該当 slice を reopened にし、修正、検証、commit、push 後に、二人の新しい reviewer で最新 remote HEAD を並列監査してください。
`follow-up` は進捗文書へ記録し、goal の完了条件を満たしている場合は再監査の理由にしないでください。
最終監査が `ACCEPT` になった後、`git ls-remote` を再実行してください。
監査前に渡した OID と監査後の remote OID が異なる場合は監査結果を無効とし、新しい exact remote OID に対する監査をやり直してください。
ユーザーへの完了報告は、監査前後で変化していない最新 remote OID に対する最終監査が `ACCEPT` になった後だけ行ってください。

ユーザーには次を報告してください。

- 実装した execution model と主要な公開 API
- 削除した旧 hydration semantics
- package ごとの主要変更
- unit、integration、E2E、artifact、benchmark の検証結果
- 残る実装上の制約
- feature branch 名、最新 commit hash、push 先

## 自律実行と blocker

実装上の不確実性、設計判断、優先順位は、コード、SPEC、設計正本、一次資料、sub-agent を使って解決してください。
人間の選好を聞かなくても最終目標から判断できる事項は、ユーザーへ質問してはいけません。

network、認証、権限、再現不能な外部 service、利用不能な host dependency、user の product decision など、repository 内の変更では解決できない要因だけを外部 blocker とします。
外部 blocker がなければ、途中報告で作業を止めず、次の slice へ進んでください。
一つの blocker が見つかっても、独立して進められる slice と検証を先に完了してください。
同じ外部 blocker が三回連続する goal turn で再確認され、ほかに意味のある作業が残っていない場合だけ goal を `blocked` にしてください。
一回目または二回目の失敗、作業量、難度、時間を blocker 扱いしてはいけません。

goal の完了条件を、実装済みの一部へ狭めてはいけません。
token、時間、変更量、実装難度を理由に、scaffolding、MVP、互換 layer、未検証の placeholder を最終成果としてはいけません。
