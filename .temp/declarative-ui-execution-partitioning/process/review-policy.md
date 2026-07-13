# Review policy R8

この文書は設計提案、implementation slice、process revisionに共通するreview policyの正本です。
依存文書はこの規則を複製せず、該当するstable headingを参照してください。

<a id="policy-r8"></a>

## POLICY-R8：適用範囲

R8は以前の逐次review、全変更への複数reviewer割当、無制限反復、成功時の手書きmanifestとattestationをsupersedeします。
runtime semantics、review unit分割、immutable candidate、`blocker`と`follow-up`の分類、blocker修正後の一回だけの収束reviewは維持します。
R8固定前にreviewを開始したrevisionには遡及適用せず、そのrevisionだけは開始時の規則で完了させます。

<a id="policy-r8-risk"></a>

## POLICY-R8-RISK：risk tier

review開始前に、すべてのrevisionのrisk tierと判定根拠を進捗文書へ記録してください。
`medium`と`high`はproposalにも同じtierと根拠を記録してください。

| risk tier | 初期semantic reviewer | blocker修正後の収束reviewer | 最大session数 |
| --- | ---: | ---: | ---: |
| `low` | 0 | 0 | 0 |
| `medium` | 1 | 1 | 2 |
| `high` | 2 | 1 | 3 |

`low`は次の条件をすべて満たすrevisionだけに適用します。

- 一つのpackage-local type surface、Accepted decisionを適用するpure helper、deterministicなtest-only evidence、またはstatus/evidence-only文書更新である
- runtime behavior、parser、validator、state transition、新しいsemantic decisionを変更しない
- public API、wire schema、永続identity、trust、authority、server/client artifact inclusionを変更しない
- 明示GC、process-global state、timer、race、module-loader isolationをtest harnessの証明対象にしない

`low`はdeterministic gateとメインセッションのdiff確認だけで完了します。
semantic reviewer、proposal、manifest、attestationを作りません。

`medium`は`low`と`high`のどちらにも該当しないrevisionです。
primary reviewer一人がcorrectness、SPEC/test/implementation、実現可能性を一つのdeltaとして確認します。

次のいずれかを変更するrevisionは`high`です。

- 複数packageの責務境界
- identity、trust boundary、authority
- concurrency、race、state machine
- untrustedな可変長inputのparserまたはserializer
- server/client artifact inclusionまたはruntime admission
- public API、wire schema、永続identity
- 後から変更するコストが特に高い不可逆な契約

`high`はprimary reviewerとrisk-specific reviewerを同じrevisionへ並列に割り当てます。
risk reviewerはimplementation、performance、test、identity、trust、authority、package boundaryのうち、変更riskに該当する論点だけを担当します。

<a id="policy-r8-unit"></a>

## POLICY-R8-UNIT：review unit

proposalを固定する前に、決定内容、owner、依存先、独立した検証方法へ分解してください。
別々に仕様化して検証でき、一方を確定しても他方の選択肢を不当に固定せず、途中状態をgreenに保てる決定は別unitにします。
同じ不変条件の成立に同時決定が必要で、分けると矛盾した契約しか作れない事項だけを一unitへ含められます。

reviewerが独立したparser、validator、solver、state machine、identity operationを三つ以上追う見込みの場合は、review開始前にunit分割を再判定してください。
文章量やfile数だけを分割理由にはしませんが、責務と検証方法が独立している場合は一unitへ束ねられません。
収束reviewでもblockerが残ったunitは、同じscopeを改名して回数をresetせず、責務を分割するか契約を再設計してください。

<a id="policy-r8-evidence"></a>

## POLICY-R8-EVIDENCE：candidateとevidence

review中はproposal、write set、dependency、decision anchor、candidateをfreezeします。
メインセッションは固定blobをcurrent dependency baseへ重ねたsingle-parent synthetic commitを、branchを移動せずに作成してください。
reviewerはmutableなshared worktreeではなく、synthetic commitのisolated worktreeまたは固定Git objectを評価します。

`low`はimmutable synthetic commit、exact path一覧、deterministic gate結果、適用したAccepted decisionのcanonical pathまたはIDを進捗記録へ残します。

`medium`と`high`はrepository-ownedの`review:evidence` commandを使います。
commandへのinputは次を固定します。

- baseとsingle-parent candidate
- proposal
- exact write set
- exact dependency revisionとpath
- canonical source pathとstable headingを持つdecision anchor
- exact candidateのisolated worktreeで完了したgate command、exit code、summary
- review終了後はreviewer ID、role、verdict、review result本文

review開始前は空の`reviewResults`を含むinputからevidenceを生成し、candidate、path、gate、proposal、dependency、anchorを固定します。
review結果を受け取った後はresult本文をinputへ直接追加し、filesystem pathを介さず同じevidenceへGit blobとして束縛します。
結果統合前とcommit前に同じinputで`verify`し、不一致ならそのreview resultをcurrent revisionへ適用してはいけません。

gateはメインセッションがexact candidateのisolated worktreeで先に実行します。
`review:evidence`はgateを再実行せず、渡されたsuccess resultをほかの固定入力と一緒に検証します。
未実行または失敗したgateをsuccessとして入力してはいけません。

通常成功時にmanifest、attestation、OID inventoryを手書きしないでください。
reviewerも成功したhash照合とfull gateを繰り返しません。
automationの不一致または具体的なcorrectness疑義がある場合だけ、対象を限定して再計算します。

proposal、write-set membership、対象file content、dependency content、decision anchorが変わった場合はreviewを`REVIEW INVALID`とします。
別unitのcommitによるbranch HEAD前進、割当外fileの変更、共有文書の無関係な変更だけでreviewを無効にしてはいけません。
外部sessionまたはuser changesは破棄せず、対象unitの新revisionとして固定してください。

exact OIDで固定済みのdependency evidenceはcontentが変わらない限り再利用します。
同じcontentのfull gateとsemantic reviewを繰り返してはいけません。

R8のbase toolingはcommit `686fa4d454460efecf70a6370a902c4f2c3217e0`、inline review result bindingはcommit `dd7826fb28e27c5a93a083c9cad04f72c216af81`で完了済みです。
新規reviewを固定する前に両commitがcandidateのancestorであり、root commandとfixtureが同じcontentであることを確認してください。
commandまたはfixtureが存在しないか固定contentと異なる場合だけ、別のtooling revisionとして修正します。

<a id="policy-r8-initial"></a>

## POLICY-R8-INITIAL：初期review

`medium`と`high`はproposalまたはimplementationを担当していない新しいsub-agentへ同じcandidateを渡してください。
同じagent sessionへ提案、実装、最終評価を完結させてはいけません。
複数reviewerを使う場合は互いに独立したsessionへ同時に割り当て、全resultを回収してから修正します。
一人がblockerを報告しても、fixed inputが外部変更で無効にならない限り残る初期reviewerを停止しません。

primary reviewerは少なくとも次を確認します。

- proposal、設計正本、SPEC、test、implementationの整合
- 現行実装、最終目標、外部仕様に関する前提
- correctness、failure、型安全性、実現可能性
- server-firstと必要最小限のclient runtimeへの適合
- 暗黙fallback、過剰な制約、未検証placeholderの不在
- testがimplementation detailではなく契約を検証していること
- 独立して確定できる複数責務を一unitへ束ねていないこと

implementation sliceでは変更riskと交差する次の項目も確認します。

- server-only closureがclient artifactへ漏れないこと
- ownership、generation、session identity、cleanupがrace-safeであること
- authority、private brand、wire DTO、receiptの境界が保たれること
- budgetとterminal stateがresource leakまたは永久holeを作らないこと
- public APIとdiagnosticが実用的であること

review capsuleは決定、変更した不変条件、担当論点、関連diff、decision anchor、evidence参照を2,000 tokens以内の目安で示します。
proposal、manifest、source、test outputをcapsuleへ全文転記せず、固定pathまたはOIDから読ませてください。
通常resultは800 tokens以内、blocker最大3件、follow-up最大3件を目安とします。
4件以上の指摘は同じroot causeの最大3groupへまとめ、安全にまとめられない場合は超過理由を明記します。

<a id="policy-r8-integrate"></a>

## POLICY-R8-INTEGRATE：結果統合

メインセッションはreview resultをそのまま採用せず、根拠と固定revisionを照合してください。
正しい指摘だけを採用し、採用しない指摘には理由を記録します。

指摘は次の二種類に分類します。

- `blocker`：correctness、security、実装可能性、不可逆な契約に影響する指摘
- `follow-up`：最適化、命名、将来拡張、現在の作業を妨げない改善

独立したunitの過剰な束ね方は`blocker`です。
このblockerは一括修正せず、proposalを依存順のunitへ分割します。

reviewer同士の結論が対立した場合は、メインセッションが根拠を比較します。
事実不足の論点だけを一次資料、targeted test、artifact inspection、最小probeで検証してください。
多数決を目的としたreviewer追加は禁止します。

`blocker`は同じ原因ごとにまとめて一度に修正します。
`follow-up`は進捗へ記録し、candidateを変更またはreviewを反復する理由にしません。
一unitのblockerは、そのunitへ依存せずwrite setも重ならないunitを停止しません。

<a id="policy-r8-convergence"></a>

## POLICY-R8-CONVERGENCE：収束review

根拠のあるblockerを修正した場合だけ、初期reviewに参加していない一人へdelta convergenceを依頼します。
capsuleは初期revision、採用blocker、変更blobとhunk、影響dependency closure、targeted gate evidenceだけを含めます。
収束reviewerはblocker解消と変更範囲のregressionだけを確認し、snapshot全体を再評価しません。

文章表現、命名、follow-upだけの変更では収束reviewを実行しません。
write set、owner、public contract、trust boundaryがblocker解消範囲を越えた場合は、risk tierを再判定した新しい初期revisionとします。

収束reviewでもblockerが残った場合は、同じunitの三回目を開始してはいけません。
unitを依存順の小さい責務へ分割するか、前提と契約を再設計します。
同じscopeを別名へ変更してreview回数をresetしてはいけません。

次を満たしたrevisionをreview済みとします。

- 既知のblockerが残っていない
- 判断を変え得る前提誤りが残っていない
- 既決定事項との矛盾がない
- 最終目標への適合理由と実現方法を説明できる
- 残る不確実性がfollow-upまたは実装時の検証事項として明示されている

<a id="policy-r8-document"></a>

## POLICY-R8-DOCUMENT：文書revision

status、commit OID、gate結果、review結果だけの進捗更新は`low`です。
次のprocessまたはimplementation commitへまとめるか、複数sliceのcheckpointとして一括commitしてください。

文書がruntime contract、owner、dependency、write set、acceptance obligation、gate義務を変更する場合だけ、内容に応じて`medium`または`high`としてsemantic reviewを行います。
archive snapshotとcompatibility indexだけの機械移行でも、現在の正本ownerを変更する場合は`medium`として扱います。
