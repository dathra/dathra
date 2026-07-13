> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Cross-boundary materialization

## cross-boundary materialization

### demand-first planning

cross-boundary dependency では、先に **MaterializationRequirement** と **EmissionRequirement** を導出する。

- MaterializationRequirement は、target に必要な value、identity、state、lifetime を表す。
- EmissionRequirement は、どの sink にどの representation を出すかを表す。

serializer の型一覧を先に照合しない。
ObservationContract を満たす plan を有限候補から選ぶ。

候補は次の通りである。

- no transfer と server-only
- compile-time inline
- server snapshot
- target-native construction または module binding
- tracked reconstruction codec
- locator による reference resolution
- snapshot と subscription
- author-visible な explicit async remote operation

server render 中に合法な値が既に得られる場合は、server snapshot を既定候補にする。
client recomputation は、同値性と cost の両方が成立するときだけ選ぶ。

plan は一つの enum を順に試す first-match 方式ではない。
複数 step と route variant を持つ finite DAG または decision graph として構成する。

### materialization mechanism taxonomy

materialization mechanismの分類は、次のclosed unionとする。

```ts
type MaterializationMechanismKind =
  | "inline"
  | "snapshot"
  | "target-native"
  | "codec"
  | "reference"
  | "subscription"
  | "remote";
```

kindは、mechanismがdemandへ直接提供する結果、またはmechanismを直接支配するcontractで決める。
mechanism内部のcodec、locator、policy、initial payload、transport dependencyを推移的にたどって外側のmechanismを再分類しない。

各kindの分類条件は次のとおりである。

- **inline**：build時に完全確定したrepresentationをcompiler-owned literalとしてtarget artifactへ直接含める。
- **snapshot**：inlineまたは継続contractを使わず、source stateの有限なstandalone captureを直接materializeする。
- **target-native**：source-derived representation、locator、codec、reference、subscription、remote contractを直接消費せず、target moduleまたはhost bindingから値を得る。
- **codec**：declared codec contractによるrepresentation変換またはreconstructionを直接のmechanismとする。
- **reference**：declared resolver contractとlocatorによるreferentまたはhandle解決を直接のmechanismとし、remote-operation bindingを含めない。
- **subscription**：initial snapshot revisionとlog-boundary cursorのjoint consistency point、および継続revisionを一体で提供するdeclared subscription contractを直接消費する。
- **remote**：declared remote-operation contractからauthor-visibleなexplicit async operation bindingを直接得る。

subscriptionのinitial snapshotは、外側のmechanismをsnapshotへ再分類しない。
subscriptionのrevision codecとremote operationのinput、output、failure codecは、外側のmechanismをcodecへ再分類しない。
remote operationがtarget側でhandleまたはbindingを使っても、外側のmechanismをreferenceまたはtarget-nativeへ再分類しない。

inlineはrequest-specific carrierを必要としないが、artifact bytesを通じたemissionである。
したがって、exposure、integrity、artifact closureの検査を省略しない。

subscriptionのopen、継続revision適用、resync、acknowledgementはsubscription protocolとstate machineが所有する。
remote callのdispatch、authorization、receipt、recoveryはremote protocol rootが所有する。

このtaxonomyへの所属は、placement、legality、equivalence、native closure、trust acceptance、client inclusionを証明しない。
unknownな依存をfull client moduleへ含めるfallbackとしても使わない。

server-onlyはexecution placement、graph-tableはrequest-specific data carrierであり、mechanism kindではない。
no-transferの意味、成立条件、ownerはcandidate legalityとplannerの独立決定へ残す。

#### transfer admission の owner pipeline

MP01-DK2という独立したshared bridge APIは作らない。
source claimのqualification、full execution analysisのacceptance、candidate admission、plan生成、finalization、selectionを、それぞれの既存ownerへ配置する。

| stage | owner | output boundary |
| --- | --- | --- |
| registry schemaとsymbolic catalog | SC01 | trust acceptanceではないregistry contract |
| source-local transfer claim | SC02A | 未信頼な`TransferBinding` |
| qualifiedまたはcompiled transfer claim | SC02B | acceptanceではないqualified structural claim |
| registry qualification | SC03-Q | kind、qualified ID、version、artifact-independent symbolic registry closureを検証したtransformer-local evidence |
| source/module conflict | SC03-C | module signature、locator、source analysisとのnon-conflict evidence |
| proof-domain trust admission | SC03-T | SC03-Q/C evidenceとtrusted proof acceptanceを束縛したcaller-unforgeable qualification evidence |
| module closure | PL01 | native module closure evidence |
| state observation contract | OC02-SD/ST/SV/SI/SR | design、type、closed validation、content identity、behavioral integrationを分離したstate observation contract |
| state semantics lowering | PL02-SL | compiler derivationまたはSC03-T accepted author policyから作るprovenance付きunaccepted lowering claim |
| state authority admission | PL02-SA | exact contract、graph、source、qualification、proof scopeへ束縛した`AcceptedStateObservationSemantics` |
| execution analysis claim | PL02-A | graph、SC03 evidence、PL01 closure、completeness scope、producer profile、proof domainを束縛したclaim |
| full analysis acceptance | PL02-V | caller-unforgeableな`AcceptedExecutionAnalysis` |
| materialization demand projection | CN01-DM | accepted analysisから独立導出したunbranded raw materialization claim |
| emission demand projection | CN01-DE | accepted analysisから独立導出したunbranded raw emission claim |
| raw demand closure | CN01-DVP | 両raw claimをdescriptor-basedに閉じたfresh immutable snapshot |
| demand acceptance | CN01-DVA | accepted analysisから再投影して完全一致とcross-demand closureを検証したcaller-unforgeable set |
| demand identity | CN01-DI | accepted demand setをgraph、analysis、state evidence、projection versionへ束縛したidentity |
| candidate derivation | CN01-G | identified accepted demand setから導出したfinite candidate set |
| candidate legality | CN01-L | mechanism legality、candidate固有のroleとprotocol template、target capability、behavior summary、ObservationContract適合を束縛したclosed accepted candidate set |
| candidate-specific plan | MP02 | accepted set内のcandidateごとにevidence identityを保持するplan |
| finalized candidate evidence | AF01 | final artifact address、export、implementation、deployment-bound protocol binding、canonical evidence ID |
| final selection | SL01 | finalized candidate集合から選んだcandidateとselection evidence |
| runtime conformance | RR01 | authenticated local catalogまたはprojectionとcanonical evidence IDのruntime検証 |

`AcceptedExecutionAnalysis`のownerはSC03ではない。
SC03はPL02のgraph completenessを待たず、PL02がSC03 evidenceを消費する。
この向きにすることでqualificationとfull analysisのdependency cycleを作らない。

OC02-SD/ST/SV/SI/SR、SC03-Q/C/T、PL02-SD/SL/SA/A/V、MP01-DR-M/E、AS01-MP/EP、CN01-DM/DE/DVP/DVA/DI/G/Lは、それぞれ独立したreview unitとする。
一つのSC03またはCN01 revisionへ複数validator、trust boundary、candidate solverを束ねない。

#### state semantics と demand admission の dependency DAG

MaterializationRequirementのstate payloadはまだ固定しない。
既存ObservationContractにauthoritativeなstate update semanticsが存在しないため、先にstate observationとauthority admissionを次の依存順で完成させる。

```text
OC02-SD design
  -> OC02-ST package-internal type schema
  -> OC02-SV descriptor-based closed validation
  -> OC02-SI content identity and ObservationContract integration
  -> OC02-SR trace/relation/composition integration

OC02-SD -> PL02-SD state authority-admission design

SC02A/B author policy claim
  -> SC03-Q/C/T qualified and trusted policy evidence
  -> PL02-SL state semantics lowering

OC02-SV/SI/SR + PL02-SD + SC03-T + graph/source evidence
  -> PL02-SL
  -> PL02-SA state authority admission
  -> PL02-A
  -> PL02-V

OC02-ST + PL02-SD
  -> MP01-DR-M
  -> AS01-MP

MP01-DR-E
  -> AS01-EP

PL02-V + AS01-MP -> CN01-DM --+
PL02-V + AS01-EP -> CN01-DE --+-> CN01-DVP
                                      |
PL02-V -------------------------------+-> CN01-DVA

CN01-DVP -> CN01-DVA -> CN01-DI -> CN01-G -> CN01-L
  -> MP02 -> AF01 -> SL01
```

このDAGからMP01、CN01、candidate、plan、selectionをOC02、SC03、PL02へ戻すedgeを作らない。

OC02のreview unitは次の責務だけを持つ。

| unit | owner responsibility | 禁止する責務 |
| --- | --- | --- |
| OC02-SD | state observationの存在条件、subject、visibility、consistency cut、order、terminal、update vocabulary、mode cardinality、provenance、migrationを設計する | production implementation |
| OC02-ST | package-internalなexact readonly state preimage型を定義する | public union、parser、identity、behavior |
| OC02-SV | unknown inputをdescriptor-based hard budgetでfresh deep-frozen unbranded preimageへ閉じる | digest、authority、relation/composition |
| OC02-SI | SV outputへcontent identityを付け、superseding ObservationContract schemaとcreator/parserへ統合する | trust、lowering、demand projection |
| OC02-SR | identified state constraintのtrace、relation、composition、refinement、equalityへの効果を実装する | parser、identity、authority |

OC02-SDはcompiler-derivedとauthor-policyの表現、policy reference、診断を含め、state observationの存在条件からschema migrationまでを決定する。
OC02-SDは既存Accepted ADRの意味を書き換えず、superseding ADRを追加する。
OC02-STはexact readonly shapeとnon-vacuous type fixtureだけを追加し、public union、unknown parser、identity、behaviorを変更しない。
OC02-SVはunknown inputを同期的に処理し、accessor、symbol、hidden field、custom prototype、cycle、許可外alias、budget excessをcaller code実行なしで拒否する。
OC02-SVはfresh deep-frozen unbranded preimageだけを返し、digestまたはaccepted brandを発行しない。
content identityは内容の同一性だけを証明し、state semanticsを採用するauthorityを証明しない。

author state policyをfree string、bare digest、raw registry ID、update-mode stringからacceptしない。
author-facing APIはsemantic optionを受け取り、それらの低水準値の手動指定を要求しない。
author policyはSC02A/Bの未信頼なsource-local claimとし、SC03-Q/C/Tがsource/module conflict、qualified policy、proof-domain trustを検証する。

PL02-SLはcompiler由来またはauthor policy由来のstate semanticsをloweringするが、自身のoutputをacceptできない。
compiler由来ではexact source analysis、graph/root、ObservationContract、producer profile、completeness scopeを束縛する。
author policy由来ではexactなSC03-T accepted declarationとpolicy evidenceを要求する。
どちらのformも、起点となるcontract constraintまたはaccepted policy identityへのprovenanceを保持する。

PL02-SDはstate authority admissionのinput、output、identity preimage、failure、caller-unforgeable representationを先に設計する。
PL02-SAはPL02-SL claimをOC02-SI/SR、graph/root、ObservationContract、source analysis、producer profile、completeness scope、およびauthor-policy formで該当するSC03-T evidenceへ照合する。
compiler-derived formではcompiler derivation evidence、author-policy formではauthor-policy provenanceを検証した後だけ`AcceptedStateObservationSemantics`を発行する。
PL02-Aはそのevidenceをclaimへ含め、PL02-Vがidentityを再検証して`AcceptedExecutionAnalysis`のclosureへ取り込む。

MP01-DR-MはOC02-STと収束済みPL02-SD decisionだけをdesign dependencyにする。
shared production codeからtransformer-privateな`AcceptedStateObservationSemantics`またはtransformer moduleをimportしない。
このpackage boundaryをfixtureで直接検査する。

materializationとemissionのatomic vocabularyは別review unit、別subpathとする。

```text
@dathra/shared/materialization-contract
@dathra/shared/emission-contract
```

AS01-MPとAS01-EPはpackage exports、build entry、generated declaration、runtime-empty emit、type-only consumer、shared root非公開をそれぞれ独立して検査する。

CN01-DMとCN01-DEは同じexact `AcceptedExecutionAnalysis`から独立にraw claimを導出する。
DMとDEはclosed parse、completeness acceptance、cross-demand consistency、identity、candidate selectionを所有しない。

CN01-DVPは両raw claimをunknown inputとして受ける。
equality、sort、semantic lookup、projection comparisonより先にdescriptor-based preflightとhard budgetを適用し、accessor、custom prototype、symbol、hidden field、malformed collection、cycle、不正aliasをcaller code実行なしで拒否する。
caller objectを保持せず、fresh deep-frozen joint snapshotだけを返す。

CN01-DVAはcaller-unforgeableな`AcceptedExecutionAnalysis`とimmutable DVP snapshotだけを受け、raw claim objectを受けない。
accepted analysis identity、DVP provenance、parser versionを検証した後、DM/DEを再投影し、安全なsnapshotとcanonical structural equalityで比較する。
graph/root/evidence/state semantics reference、materialization/emission completeness、cross-demand consistency、canonical order、duplicate ruleを検証してからfresh setとprivate `AcceptedDemandSet` brandを発行する。

CN01-DIだけがaccepted demand setをgraph、analysis、state evidence、projection versionへidentity-bindする。
CN01-GはCN01-DI outputだけを消費し、新しいdemandを生成しない。

SL01はobservationally legalかつfinalizedなcandidateからserver-first preferenceを適用して最終選択する。
candidate enumeration orderをselection policyにせず、SL01の独立revisionでserver/client cost order、同順位のdeterministic tie-break、selection evidenceへの束縛を検査する。

admission失敗またはlegal candidate不在はtyped build diagnosticとする。
full client module、eager hydration、runtime admission、runtime ignore、first-success fallbackへ移行しない。

bindingまたはmechanismごとの責務は次のとおりとする。

| bindingまたはmechanism | SC03 | CN01 |
| --- | --- | --- |
| `none` | registryを解決せず、structural claimをqualification evidenceへ保持する | このbindingからpositive mechanismを生成しない |
| `snapshot` | registryを解決せず、source/module conflictとproof scopeだけを束縛する | capture legality、cost、ObservationContract適合を検証する |
| `codec` | exact codec kind、qualified ID、version、symbolic registry closureを検証する | candidate固有のcodec role、target capability、behavior legalityを検証する |
| `reference` | exact resolverまたはpolicy kind、qualified ID、version、symbolic closureを検証する | candidate固有のrole、grantまたはprotocol template、target capability、behavior legalityを検証する |
| `subscription` | exact subscription-source kind、qualified ID、version、symbolic closureを検証する | candidate固有のrole、protocol template、continuity requirement、behavior legalityを検証する |
| `remote` | exact remote-operation kind、qualified ID、version、symbolic closureを検証する | candidate固有のrole、protocol template、target capability、behavior legalityを検証する |
| `inline` | raw bindingからmappingしない | accepted semantics、equivalence、exposure、artifact capabilityからだけ導出する |
| `target-native` | raw bindingからmappingしない | accepted semantics、native closure、target capabilityからだけ導出する |

registry IDまたはversionを持たない`none`と`snapshot`へregistry field requirementを適用しない。
kind文字列の一致だけで未信頼なclaimをadmitしてはならない。

SC03はartifact-independentなsymbolic registry universeだけを検証する。
CN01はcandidate固有のrequired role、protocol template、target capabilityを検証する。
AF01はfinal implementation、artifact address、deployment identityへ束縛したprotocol bindingを検証する。
RR01はfinalized artifactのcanonical evidence IDとauthenticated local catalogまたはprojectionを使ってruntime conformanceを再検証する。

transformer-private brand、raw `TransferBinding`、bare registry record、`AcceptedExecutionAnalysis`をbrowserへ配送して再admissionしない。

CN01-Lはclosedかつcaller-unforgeableなaccepted candidate setを返す。
MP02はそのset内の各candidateについてplanを生成し、candidate evidence identityを保持する。
MP02へselected candidateを渡さず、MP02はfinal selectionを行わない。
AF01がcandidateごとにfinalizeした後、SL01だけが最終candidateを選択する。

variantごとに必要なqualification、proof、analysis、candidate legality evidenceが欠ける場合はtyped build diagnosticとする。
別kind、full client module、runtime admission、eager hydration、runtime ignoreへfallbackしない。

実装時は7 literalの双方向exact type fixture、除外literal、package-local facadeのruntime空性、明示的なtype-only consumer entryのemitを直接検査する。
root未到達のbuild artifactだけをtype-only境界の証拠にしない。

### materialization state

MaterializationAttempt は `committed` または `failedPrecommit` で終了する。
provisional graph は、allocate、populate、pure finalize、validate の順に構築する。

registry commit は、provisional graph と identity registry に対する一つの pointer または version swap とする。
precommit operation は pure、reversible、lease-based のいずれかでなければならない。
provisional root は commit 前に escape できない。

commit 済み MaterializedGraphInstance は、`inactive`、`active`、`activationFailed`、`retired` を独立して遷移する。
postcommit effect と outbox は別の state machine を持つ。
postcommit failure で公開済み generation を rollback または削除しない。

### identity

identity domain は次のように分ける。

- materialized graph 内の alias
- target lifetime identity
- application entity identity
- remote locator
- authority capability

locator と capability を同じ token にしない。
locator を知っているだけでは access できない。

structural deduplication は、identity を持たない immutable data に限定する。
更新は、immutable replacement、stable handle または cell、journaled in-place update のいずれかを ObservationContract で選ぶ。

MaterializedGraphInstance は、identity-connected root、cell、prototype、local symbol、backing store、view を canonicalize する。
cross-payload reuse は、realm、lifetime、principal、tenant、session、policy epoch、label、build、schema、codec version、ObservationContract が両立する場合だけ許可する。
reuse 前に authority を再検証し、generation pin を原子的に取得する。

### snapshot と codec

snapshot plan は、**CaptureConsistency** を満たさなければならない。
CaptureConsistency は、immutability、stable revision、quiescence、registered atomic capture protocol のいずれかで証明する。

eligibility 判定で accessor、Proxy trap、未知 user code を実行しない。
plan commitment 後に選択した codec は一回だけ実行する。
codec failure で別候補を試して effect を重複させず、その attempt を失敗させる。

snapshot eligibility は、strong edge と明示登録された logical backing edge だけを走査する。
列挙できない weak association、private state、internal slot は `OpaqueAll` として扱う。

value は次の段階で扱う。

1. compiler が証明した plain graph data
2. Dathra が追跡する codec または brand-creating hook
3. built-in type codec
4. target-native construction、DTO、reference、diagnostic

任意 constructor の実行や `Object.create(prototype)` で private brand と internal slot を再現しない。

### continuous update

subscription の `open` は、snapshot revision と log-boundary cursor を一つの consistency point で返す。
contract は sequence namespace、gap、cursor expiry、acknowledgement watermark、reconnect、resync、policy revalidation、retention、budget、GC を定義する。

SubscriptionSession は target lifetime が所有する authority-bound resource である。
MaterializationAttempt は consumer lease を持つだけである。
attempt failure 後に provisional root へ event を渡さない。

各 revision は、base generation と base revision を持つ UpdateAttempt として適用する。
decode、authority validation、provisional allocation を publication 前に完了する。

replacement と handle update は、一つの generation または cell swap で publish する。
in-place update は exclusive observation barrier、完全な undo journal、deferred notification を要求する。
failure 時は前 revision と cursor と acknowledgement を維持し、retry または resync contract に従う。

snapshot と subscription の組は TransferBinding の `subscription`、qualified SubscriptionSourceRegistryDescriptor、SubscriptionUseSchemaRecord、graph-table の SubscriptionRecord で表す。
SubscriptionRecord の initialSnapshot、snapshotRevision、logBoundaryCursor、transport continuity、sequence namespace は source の `open` が返す一つの consistency point と一致しなければならない。
SubscriptionRecord は SSR/browser handoff record であり、browser-local owner generation または session identity を含めない。
source descriptor は locator、value domain、revision codec、failure schema、audience、capability、authorization、sequence contract、update mode を閉じ、manifest の use schema と相互検証する。
SubscriptionSequenceContract の count、byte、gap は正の safe integer、horizon と deadline は正の safe integer millisecond とする。
各 descriptor の contract は ProjectionManifestCore.subscriptionRuntimeBudget 以下、core budget は RuntimeHostAdapter.subscriptionHardLimit 以下でなければならない。

sequence namespace ID は source qualified ID、canonical locator digest、principal、descriptor の namespaceDomainId、source が attestation した sequence epoch の canonical SubscriptionSequenceNamespacePreimage digest とする。
runtime は VerifiedBootContext の SubscriptionNamespaceAuthority で issuer、proof、source、locator、principal、namespace domain、epoch、preimage digest を検証し、source が任意 namespace ID を自己申告することを許さない。
transport continuity ID は source、canonical locator、principal、policy epoch、verified sequence namespace の canonical SubscriptionTransportContinuityPreimage digest とし、SSR/browser handoff で維持する。
runtime は wrapper 作成ごとに coordinator ID、client-local owner generation、単調 session incarnation sequence の canonical SubscriptionSessionIncarnationPreimage から新しい sessionIncarnationId を発行する。
sequence は leading zero のない unsigned decimal string とし、resume、reconnect wrapper replacement、resync のたびに進め、同じ owner generation 内でも再利用しない。
local SubscriptionSession identity は session incarnation ID、transport continuity ID、client-local owner generation、use schema、share domain、authorization generation、audience evaluation、capability binding の canonical preimage digest とし、SSR generation を browser owner として再利用しない。
runtime は owner generation、session incarnation、root binding、use schema を SubscriptionRuntimeRequestContext として wrapper 側だけに保持する。
open 前に locator、authenticated local registry catalog、grant、share domain を検証し、session budget を provisional に予約して private SubscriptionAdmissionToken を source-facing SubscriptionTransportOpenRequest へ渡す。
source-facing open、resume、resync request は owner generation、root binding schema、use schema、local session identity を含めない。
source は SubscriptionTransportOpenResult として initial consistency point、transport session、namespace attestation だけを返し、runtime identity、budget claim ID、terminal deadline、grant claim を生成しない。
runtime は返却値を検証した後に SubscriptionSession wrapper を作り、identity、budget claim、deadline、grant claim、transport forwarding を owner generation の cleanup ledger に同時登録する。
session admission は concurrent session、outstanding revision、unacknowledged revision、retained byte、gap の枠を原子的に予約し、budgetClaimId を session terminal まで保持する。
枠を予約できない場合は source を開かず typed admission failure にする。
SSR から browser への handoff では、browser source の `resume` に initial snapshot、snapshot revision、log-boundary cursor、expected transport continuity ID、expected sequence namespace を渡す。
resume は cursor より後の event だけを admission し、open を再実行して snapshot と log の間に gap を作らない。
source implementation の server `open` と browser `resume` は同じ qualified descriptor と sequence contract に束縛し、client-only polling へ置換しない。
transport の `next()` は revision、gap、cursor expiry、typed failure の SubscriptionTransportEvent を返し、runtime-local owner generation または session identity を生成しない。
revision event は transport continuity ID、sequence namespace、transport base revision を持つ SubscriptionTransportRevisionEnvelope を運ぶ。
wrapper は revision の continuity、namespace、base revision、payload digest を検証し、すべての event を wrapper 作成時の owner generation と local session identity を持つ SubscriptionRuntimeEventEnvelope で包む。
coordinator は revision publication、gap/resync 遷移、cursor-expired terminal、typed-failure terminal、acknowledgement forwarding の各直前に、envelope の `(capturedOwnerGenerationId, capturedSessionIdentityDigest)` を current wrapper pair と一つの lock で原子的に照合する。
pair が異なる旧 wrapper の revision、terminal event、acknowledgement は current session へ作用させず破棄し、transport close だけを旧 wrapper の cleanup ledger で完了する。
throw または reject は runtime failure とするが、同じ pair fence を通らない旧 wrapper failure で current session を失敗させない。

acknowledgement は revision publication 後だけ単調に進め、失敗 UpdateAttempt の sequence と cursor を acknowledge しない。
consumer が maxUnacknowledgedRevisions、maxOutstandingRevisions、maxRetainedBytes、maxSequenceGap のいずれかへ達した場合は新 revision を無制限に buffer せず、contract の overflow に従って close-and-resync または failed terminal にする。
acknowledged revision の payload は cursorRetentionMs と reconnectHorizonMs の必要範囲だけ保持し、`acknowledged-and-cursor-expired` 条件を満たした順に GC する。
disconnect は contract に従って即時 close、または reconnectHorizonMs まで budget 内で保持し、期限後は cursor-expired terminal にする。
resync は resyncHorizonMs 内だけ許可し、session は terminalDeadlineMs までに close、failed、superseded のいずれかへ terminalize して budget claim と grant claim を解放する。
cursor expiry または policy revalidation 後の resync は SubscriptionSession の captured method から行わない。
runtime は fresh capability/authorization evaluation、grant claim、provisional budget token を取得し、local expected old session identity と transport continuity ID、expected old namespace、new authorization generation を持つ SubscriptionLocalResyncCommand を作る。
runtime は command の local old identity が current wrapper と一致することを検証した後、local identity を除いた SubscriptionTransportResyncRequest を source へ渡す。
source は old transport continuity と namespace が current transport に一致する場合だけ新しい initial consistency point を返し、runtime-local identity を観測しない。
resync は旧 session を新 session identity へ暗黙 alias せず、必ず新しい sessionIncarnationId を発行する。
provisional new session の検証後に current wrapper pair と generation value を一つの atomic swap で publish して旧 session と旧 grant claim を閉じる。
sequence contract が `preserve` なら resync result の namespace は old namespace と一致しなければならない。
`rotate-with-new-snapshot` なら新 snapshot consistency point と新 attested namespace を同時 publish し、旧 namespace の revision を新 session へ admission しない。
SubscriptionUseSchemaRecord または required symbolic registry universe entry がない subscription demand は client polling へ fallback せず compile diagnostic とする。

### remote operation

remote operation は、author-visible な async API としてだけ導入する。
compiler は通常の server function call を暗黙 RPC に変換しない。

baseline の ExecutionEnvironment は build、server-request、browser の三つに閉じる。
remote operation の `remote` は browser から server-request への protocol semantics を表し、第三の Dathra runtime environment を意味しない。
RemoteDeliveryAdapter は server-request 上の host-attested role とし、外部 service、database、queue との通信は adapter 自身の delivery contract と host attestation の内側で実行する。
server-request から別 Dathra runtime へ処理を再委譲する機能を将来追加する場合は、同一環境 import で代用せず、専用 endpoint、wire DTO、authority evidence、receipt conversion、protocol budget を持つ第二の明示 protocol として設計する。

baseline は ambiguous failure 後の blind retry と exactly-once を保証しない。
adapter は、principal-bound key、request commitment、authorization、idempotency、fencing、retention、result disclosure、ambiguous reconciliation を定義する。

transactional exactly-once を名乗れるのは、effect と ledger と result が一つの atomic commit に入る場合、または sink が同等の fenced idempotency を保証する場合だけである。
この保証は host-attested RemoteDeliveryAdapter が server-local RemoteAdapterCommitReceipt を発行し、endpoint の wire proof を browser authority が検証して作る VerifiedRemoteCommitReceipt を commit certainty の根拠にする。
transactional handler の対象 effect は RemoteAtomicTransaction を経由しなければならず、transaction 外の author effect を exactly-once 保証へ含めない。
保証期間を明示し、retention 終了後は `Expired` または `Ambiguous` とする。

### exposure と integrity

PrincipalContext は trusted host が作り、request、session、tenant、route、policy epoch に束縛する。

exposure label は、data、alias、value または DOM structure に影響する control dependency を通じて伝播する。
timing と termination の noninterference は baseline の保証外である。

release は、元の値と label を変更せず、sink、audience、purpose に限定した derived value と audit record を作る。
restricting owner の承認と audit append が完了する前に sink へ公開しない。

integrity endorsement は release と分ける。
live DOM から adopt した値は、検証または endorsement が完了するまで untrusted とする。
