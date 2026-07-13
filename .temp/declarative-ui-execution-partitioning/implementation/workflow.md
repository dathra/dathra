# 実装ワークフロー

## 作業記録

実装進捗は[進捗正本](./progress/README.md)と、そこから参照される分割文書へ記録してください。
この進捗文書には、少なくとも次の内容を記録してください。

- 設計要件と acceptance work の一覧
- 各要件を担当する package、API、SPEC、test、implementation
- dependency と実装順序
- `pending`、`in-progress`、`completed` の状態
- 実行した検証 command と結果
- 独立レビューの結果と採否
- slice ごとの commit hash と push 先
- 未完了事項と外部 blocker

進捗文書のrisk tierとreview要否は[POLICY-R8-DOCUMENT](../process/review-policy.md#policy-r8-document)に従ってください。

設計正本の acceptance work を要約だけで消化せず、一項目につき一つ以上の直接的な検証証拠へ対応付けてください。
長期作業の context が圧縮されても、この進捗文書から次の作業を再開できる状態を維持してください。

goal文書と進捗文書は`.temp/`がignore対象でも`git add -f`でfeature branchに含めてください。


<a id="implementation-gate-level"></a>

## Gate level

| gate level | 必須commandとartifact |
| --- | --- |
| slice | focused test、scoped typecheckまたはcompile、scoped lint、変更pathのformat、diff check |
| boundary-sensitive slice | slice gateに加え、変更したboundaryへ直接対応するartifact inspection、consumer test、またはE2Eだけ |
| package integration | 関連slice群をdownstreamへ渡す前に変更packageのtest、typecheck、lint、buildを一回 |
| WS01 integration | WS01の累積integration test、browser E2E、server/client bundle inspection |
| milestone / final | root build、test、typecheck、lint、format、全関連E2E |

同じcontentに対するfull package test、declaration build、root buildをsliceごとに繰り返してはいけません。
最後のpackage integration gate以降に対象packageまたはdependency contentが変わった場合だけ再実行してください。
correctness上の具体的な疑義、baselineとの差分、package境界変更がある場合は、表の最低条件を超えるtargeted gateを追加してください。


## 手順 0：実装 branch と baseline を準備する

最初に `git status`、最近の commit、local HEAD、追跡先 remote branch を確認してください。
初回branch作成時はsource branchの`doc/hydration-policy`がcleanで、`origin/doc/hydration-policy`と同期していることを確認してください。
`feature/declarative-ui-execution-partitioning`がすでに存在する場合は、そのbranchをcheckoutし、tracking branchとの同期を確認してください。

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

<a id="implementation-workflow-scheduler"></a>

## 手順 2：ready queueと並列laneを更新する

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

各laneのrisk tier、review unit、candidate、evidenceは[Review policy R8](../process/review-policy.md#policy-r8)に従って固定してください。
`review:evidence`の入力、検証時点、dependency evidenceの再利用条件は[POLICY-R8-EVIDENCE](../process/review-policy.md#policy-r8-evidence)だけを正本とします。

workerは実装と検証を終え、実行中commandを終了し、write ownershipをメインセッションへ返してからreviewへ移ります。
review proposal、machine-generated evidence、進捗文書はメインセッションだけが編集します。
review中のfreeze条件と無効化条件は[POLICY-R8-EVIDENCE](../process/review-policy.md#policy-r8-evidence)に従ってください。

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

新しい設計判断または既存判断をsupersedeする変更が必要な場合は、SPECとtestを更新する前に[設計決定ワークフロー](../process/design-workflow.md#design-workflow-proposal-review)へ移ってください。
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

## 手順 5：sliceを検証する

slice gateとintegration gateは[実装acceptanceの手順5](./acceptance.md#implementation-acceptance-slice)に従って実行してください。

## 手順 6：sliceをreviewする

risk tierを判定し、[Review policy R8](../process/review-policy.md#policy-r8)に従ってreviewを完了してください。
既知のblockerがなく、必要なevidenceがexact candidateへ束縛された後だけ手順7へ進みます。

## 手順 7：slice を commit して push する

review完了条件は[POLICY-R8-CONVERGENCE](../process/review-policy.md#policy-r8-convergence)に従ってください。
`low`はdeterministic slice gate、`medium`と`high`は必要なsemantic reviewが完了した場合だけstageしてください。
無関係な変更、生成 cache、coverage output、debug log を commit に含めてはいけません。

`medium`と`high`は[POLICY-R8-EVIDENCE](../process/review-policy.md#policy-r8-evidence)が定めるcommit前検証を実行してください。
全tierでstaged path inventory、file mode、blob OIDが固定したwrite setと完全一致しない場合はcommitしてはいけません。
commit 前に `git diff --check` と staged file listを確認してください。
変更内容を特定できる commit message で commit し、`feature/declarative-ui-execution-partitioning` へ push してください。
commit後にdeterministic commandでcommit treeの対象path、mode、blob OIDを固定candidateへ再照合してください。
push 後は local HEAD と tracking branch が同じ commit を指すことを確認してください。

進捗文書へcommit hashと検証証拠を記録し、status/evidence-only更新は次のprocess／implementation commitまたは複数sliceのcheckpointへまとめてください。
未完了 slice がある場合は、ユーザーへ確認を求めず手順 2 に戻ってください。

## 手順 8：旧実装を削除する

新経路で全 call site と fixture を置き換えた後、設計正本が破壊的削除を決めた UI hydration implementation を削除してください。
旧経路を先に削除して作業ツリーを長期間壊した状態にせず、同じ slice で consumer migration と replacement test を完了してください。

最終的に `rg` で旧 API、directive、marker、island metadata、scheduler、fallback の参照を調査してください。
historical design record を除き、production、public export、docs、playground、active test に旧 semantics を残してはいけません。
同名でも別責務の API は、qualified import path と振る舞いを確認して保持してください。


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
