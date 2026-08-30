> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Contract compilation and registry qualification


package と application は、`dathra.contract.ts` の default export に `defineExecutionContract()` の result を置く。
各 RegistrySourceEntry は descriptor locator と、environment/role ごとの implementation locator を別々に持つ。
locator は named export または content-bound dependency manifest の export を参照する。
codec、resolver、subscription source、remote operation、remote delivery adapter は対応する `define*` helper の result を role implementation として参照し、それ以外は registry kind ごとの versioned descriptor export と executable role export を分ける。
compiler は specifier を contract module 基準で解決し、descriptor の kind、`id`、`version`、schema と各 role export の interface schema が RegistrySourceEntry に一致することを確認して CompiledExecutionContract へ digest を付ける。
複数 role が同じ `defineRemoteOperation()` などの definition export から導出される場合、compiler は environment ごとの virtual module と role export を先に生成する。
QualifiedRegistryUniverseEntry の symbolic implementation binding は元の aggregate export ではなく生成後の role export を指し、role closure を分離できない definition は diagnostic とする。
registry key、FactId、export fact reference は重複、dangling reference、kind mismatch を許さない。
ExportExecutionContract の直接 field と参照先 fact が同じ意味を重複して宣言した場合は、値が一致しなければ diagnostic とする。
`factId()` と `registryId()` の引数は contract file 内の build-time string literal に限定する。

FactId と RegistryId は ExecutionContractSource 内だけで一意な local ID である。
compiler は dependency contract graph の strongly connected component を collapse する。
各 contract SCC ID は member の canonical source contract、canonical source module ID、source content digest、member ordinal、condensation DAG の outgoing contract namespace ID から作り、各 member の compiled contract semantic digest と namespace ID を SCC ID と member ordinal から導出する。
local ID を namespace で修飾した QualifiedFactId と QualifiedRegistryId だけを manifest、wire、runtime graph へ出す。
ArtifactAddressId と exact-byte artifact digest は namespace ID の入力にしないため、contract qualification は bundling candidate に依存せず、artifact integrity との自己参照も発生しない。

SemanticSubject は fact の適用先を一意にする。
parameter index、callback parameter、return path、allocation site、export name が実際の export signature と semantic summary に存在しない場合は diagnostic とする。
SemanticPathSegment の tuple index は非負 safe integer とし、`element` は contract が homogeneous collection と宣言した value domain だけで使える。
SemanticRelation の endpoint は同じ source contract の fact に解決し、relation kind と両 subject の組み合わせを typed schema で検証する。
compiler は SemanticFact、SemanticRelation、ExportExecutionContract の全 nested FactReference と RegistryReference を再帰的に qualified form へ変換する。
CompiledExecutionContract は ExecutionContractSource を継承せず、`SemanticFact<true>`、`SemanticRelation<true>`、`ExportExecutionContract<true>` だけを保持する。
source-local ID を含む contract は build/debug input にだけ残し、ProjectionManifestCore と runtime artifact へ出さない。

各 RegistryDescriptor は `dathra.registry/1` の kind ごとの closed schema を持つ。
metadata-only descriptor は `defineRegistryDescriptor()` で宣言し、runtime で使う policy、value-domain、failure-schema、host-profile、brand は kind ごとの `define*` helper で executable implementation を宣言する。
codec、resolver、subscription source、remote operation、remote delivery adapter も対応する executable helper の result を使う。
compiler は RegistrySourceEntry の source implementation export が対応 interface を満たすことを検証し、descriptor 内の全 nested RegistryReference を qualified ID へ変換する。
その後、SC03 は operation 単位に closed RegistryRoleRequirement、symbolic implementation binding、同一環境 dependency、cross-environment protocol template を生成する。
AF01 は deployment と artifact finalization 後に symbolic binding と protocol template を final implementation binding と protocol binding へ解決する。
role の許可範囲と requirement は次の表を正本とする。

| registry kind | environment と role | requirement |
| --- | --- | --- |
| codec | runtime environment の capture/materialize | request graph が使う方向だけ必須 |
| resolver | runtime environment の resolve | reference demand から到達する場合に必須 |
| subscription-source | server-request または browser の open、browser の resume/resync | SSR、client-only initial render、handoff/resync の利用形態ごとに必須 |
| policy | runtime environment の evaluate | policy fact から到達する場合に必須 |
| value-domain、failure-schema、host-profile、brand | runtime environment の各 validator/adaptor | consumer role から到達する場合に必須 |
| remote-operation | browser の transport/verifier、server-request の endpoint/handler | browser callable を公開する operation では 4 role すべて必須 |
| remote-delivery-adapter | server-request の delivery | remote operation から参照された場合に一つだけ必須 |

この表にない kind、environment、role の組は source entry の時点で diagnostic とする。
required role に実装がない場合、または同じ `(qualified registry ID, environment, role)` に複数実装がある場合も diagnostic とする。
selected owner の required role と、reason が到達した request-reachable role を final projection に残し、到達しない optional implementation を artifact closure へ入れない。
RegistryProtocolBinding は remote-operation entry だけが持てる。
ほかの registry kind の protocolBindings は型上 `never[]` であり、runtime record では空配列にする。

#### registry qualification と environment catalog の補足決定

この節は、旧 `RegistryEnvironmentProjectionRecord/1`、`CompiledExecutionContract/1`、flat binding array、component ごとの暗黙 owner 対応を supersede する。
後方互換 layer は設けない。

`RegistryId<Kind>` は source contract 内だけで有効な non-empty string とし、lone surrogate を拒否するが Unicode normalization は行わない。
`QualifiedRegistryId<Kind>` は `dathra.qualified-id/1` の kind field を `registry:${Kind}` とした digest である。
SC03 は namespace digest、domain、local ID から qualified ID を再計算し、source-local reference をすべて qualified form へ変換する。
runtime は digest-shaped local string の由来を文字列だけから推測せず、canonical digest shape、schema context、catalog の ID-to-kind membership、nested reference resolution を検証する。
source-local ID が final artifact へ残らないことの証明責務は SC03 qualification と artifact inspection に置く。
wire decoder が受け取る未検証 field は `unknown` または専用 `Raw*` record とし、qualified ID と digest の brand は closed schema、canonical form、catalog membership の検証後にだけ生成する。

RegistryDescriptor と nested metadata は getter、method、hidden property を持たない closed data snapshot とする。
executable helper result は descriptor を継承せず、`descriptor` field と environment/role implementation を分離する。
descriptor locator と implementation locator も別 export のまま保持する。
すべての digest field は canonical `Sha256Digest`、semantic ID と version は non-empty valid Unicode、budget、count、horizon は正の safe integer とする。
Proxy は caller contract 外とする。

同じ owner の role requirement は `(qualifiedId, environment, role)` で一意とする。
複数宣言の reason は union して raw UTF-16 順に並べ、`required` と `request-reachable` が競合する場合は `required` を優先して一 record にする。
`reasonDefinitionIds` は non-empty、unique、canonical order とする。
同じ `(qualifiedId, environment, role)` の implementation は一 build candidate につき exactly one とし、複数 candidate は別 catalog とする。
dependency は `(sourceQualifiedId, sourceEnvironment, sourceRole, targetQualifiedId, targetEnvironment, targetRole)` で一意とし、source と target の environment を一致させる。

SC03 は artifact address を持たない `QualifiedRegistryUniverseRecord` を生成する。
この symbolic universe は qualified descriptor、全 role requirement、module/export locator、same-environment dependency、deployment 未確定の protocol template を保持する。
AF01 は candidate artifact と deployment identity の確定後に symbolic universe を exact transform し、global finalized registry catalog を生成する。
endpointIdentity は server deployment、operation qualified ID、transport profile を持つ `RemoteEndpointIdentityPreimage` の canonical digest として導出し、author string や artifact URL を直接使わない。
descriptor、kind、version、namespace、requirement、dependency semantics の追加、欠落、変更を禁止し、各 symbolic implementation locator を一つの artifact address と export name へ解決する。

environment `E` の registry universe `U_E` は、global finalized catalog のうち `E` の implementation を一件以上持つ owner の exact set とする。
`RegistryEnvironmentCatalogRecord` は `U_E` と対象 environment の `deploymentIdentityDigest: Sha256Digest` を明示入力として deterministic に射影し、owner metadata、qualified descriptor と digest、`E` の全 requirement、implementation、dependency、利用可能な public protocol binding を保持する。
build validator は owner set だけでなく全 field と array を global finalized catalog と同じgeneric deployment identity digestから再計算して exact equality を検証する。
browser catalog は browser implementation、browser dependency、public protocol metadata だけを持ち、server implementation、server dependency、server artifact locator を持たない。
catalog にある未選択 implementation の metadata byte は cost metric に含めるが、artifact table と module graph には final projection が選んだ binding だけを入れる。

`DefinitionManifestRecord.registryProjectionSeeds` は definition が要求する registry owner、environment、role、protocol binding を閉じた record として宣言する。
各 environment の initial seed set は selected definition records が持つ同じ environment の seed の exact union とし、外部 seed、暗黙 initial owner、protocol による自己正当化を許さない。
`request-reachable` requirement は owner がすでに選択され、かつ reason の少なくとも一つが selected definition set に含まれる場合だけ active になる。
`required` requirement は owner が当該 environment で選択された時点で必ず active になる。

environment projection は catalog と exact seed set から finite least fixed point で生成する。
最初に seed role と seed が参照する protocol の mandatory role を選択する。
次に selected owner の required requirement、selected owner かつ reason が到達した request-reachable requirement、各 role の unique implementation、implementation の全 dependency target を追加する。
dependency が新しい owner を選択した場合は、その owner の required requirement も追加し、変化がなくなるまで反復する。
projection は active requirement、selected implementation、selected dependency、included protocol ID の exact result を owner group ごとに保持する。
dependency source は同じ owner group の selected implementation、target は同じ projection の target owner group にある selected implementationへ exactly 解決する。
selected implementation を持たない owner group と、fixed point で正当化されない extra record を拒否する。

remote-operation role は generic dependency target にできない。
browser transport と server endpoint は non-null protocol seed からだけ選択し、protocol expansion が browser verifier と server handler を追加する。
endpoint-to-handler relation は RemoteRegistryProtocolBinding の operationQualifiedId、serverEndpointRole、serverHandlerRole が直接所有し、RegistryDependencyBinding へ重複して記録しない。
server endpoint は descriptor が選んだ remote-delivery-adapter の delivery role へだけ same-environment dependency を持つ。
adapter implementation は server catalog と server projection だけに存在する。
RemoteRegistryProtocolBinding の ID は `id` を空 string にした full binding の canonical digest とする。
同じ protocol ID は対応する browser/server projection に exactly once 現れる。
binding の clientDeploymentIdentityDigest は browser catalog と browser projection の deploymentIdentityDigest に一致し、serverDeploymentIdentityDigest と deliveryDeploymentIdentityDigest は server catalog と server projection の deploymentIdentityDigest に一致する。

`RegistryProtocolCatalogRecord` は public protocol binding を ID 順に保持し、重複を拒否し、digest field を空 string にした full record の canonical digest を持つ。
global catalog から browser/server catalog と protocol catalog を生成した後、global、browser、server、protocol の四つの catalog digest を `RegistryCatalogPairCommitment` に束縛する。
build pair validator は両 environment の protocol ID、deployment identity、endpoint、handler、adapter closure を同時に検証する。
browser runtime は browser catalog、browser projection、public protocol metadata、BootAuthority が認証した pair commitment だけを受け取る。
server implementation closure の完全性は build pair validator が証明し、browser runtime は local closure と認証済み pair commitment を検証する。
server runtime も同じ規則を対称に適用する。

digest の生成順は qualified descriptor、symbolic universe、plan 非依存の deployment identity、plan 非依存の artifact address、public protocol binding、global finalized catalog、environment catalog、public protocol catalog、pair commitment、environment projection、candidate manifest core と integrity table、metric vector、plan identity、selected envelope とする。
後段の digest を前段の preimage に含めない。
descriptorDigest は self field を持たない qualified descriptor 全体の canonical JCS bytes から生成する。
RemoteRegistryProtocolBinding.id は id field だけを空 string にし、ほかの digest-valued field を保持した full binding から生成する。
QualifiedRegistryUniverseRecord、FinalizedRegistryCatalogRecord、RegistryEnvironmentCatalogRecord、RegistryProtocolCatalogRecord、RegistryCatalogPairCommitment、RegistryEnvironmentProjectionRecord は自身の digest field だけを空 string にし、入力として持つほかの digest-valued field を保持した full record から生成する。

canonical list は normalization せず raw UTF-16 tuple 順で検証する。
update mode は `replacement`、`stable-handle`、`journaled-in-place`、environment は `browser`、`server-request` の固定順とする。
requirement と implementation は environment と role、dependency は source environment、source role、target qualified ID、target environment、target role、protocol は ID、owner group は qualified ID の順に並べる。
DefinitionManifestRecord.registryProjectionSeeds は environment、qualified ID、role、protocol binding ID の順、projection の seeds は definition ID、environment、qualified ID、role、protocol binding ID の順に並べる。
各 DefinitionManifestRecord の seed は自身の definitionId と同じ definitionId を持ち、list は strictly sorted かつ duplicate-free とする。
projection の seeds も strictly sorted かつ duplicate-free とし、selected definition records が持つ同じ environment の seed の exact union と一致させる。
protocol binding ID は null を digest string より前に置き、同じ `(definition ID, environment, qualified ID, role)` に異なる protocol binding ID を割り当てることを拒否する。
RemoteRegistryProtocolTemplate は operation qualified ID、delivery adapter qualified ID、transport profile qualified ID、request schema digest、response schema digest、protocol codec metadata digest、authorization verifier metadata digest、receipt verifier metadata digest、protocol budget digest の順に並べ、完全に同じ tuple を重複できない。

SC01 は schema、closed snapshot、role matrix、digest、fixed-point derivation と validator を提供する。
SC03 は symbolic qualified universe を担当する。
AF01 は candidate ごとの finalized global/environment/protocol catalog、pair commitment、exact seed projection、manifest core bytes、integrity table、metric vector を plan selection 前に完成させる。
PE01 は plan selection 後に AF01 が完成させた selected candidate の core、projection、envelope、bootstrap を再生成せず emission する。
RR01 は authenticated local catalog と projection の conformance を担当する。
compiler から global catalog までの完全性は build TCB と acceptance test が検証し、runtime が source compiler semantics を再実行するという旧要求は supersede する。

pure policy の ruleGraph は framework の versioned closed algebra で canonicalize し、PolicyEvaluator の build-time conformance vector と一致しなければならない。
host-authoritative-async policy は authority、read、ordering、cancellation を SemanticFact で宣言し、coordinator-owned operation としてだけ実行する。
PolicyEvaluator の policyKind と PolicyInputByKind の key は一致しなければならず、audience、sink、release、capability、authorization、endorsement、delivery の別 kind の入力を流用しない。
runtime は manifest binding、graph subject、principal、policy epoch、host capability、operation record から PolicyInputByKind を導出し、author が policy input や authorizationGenerationId を直接渡さない。
signal を除く evaluation input は canonical PolicyEvaluationPreimage として digest し、同じ意味の評価が同じ identity を持つようにする。

capability または authorization evaluator の allow result は grant そのものではなく PolicyGrantTerms である。
host-injected PolicyGrantAuthority は private monotonic authorization generation と revocation epoch を読み、evaluation digest、issuer policy、principal、policy epoch、terms を束縛した AuthorizationGrant を発行する。
author object、evaluator、payload は private brand を作れない。
expiry または revocation では generation を進め、旧 grant の新規 claim を拒否する。

reference cache hit は、必要な capability grant と authorization grant が同じ principal、policy epoch、share domain、alias permission、lifetime を許すことを確認し、全 AuthorizationGrantClaim と cache lease を一つの coordinator lock で原子的に取得した場合だけ返す。
claim 取得と同時に revocation または expiry が競合した場合は authority の linearization point で一方だけを勝たせ、失効した grant から value alias を返さない。
claim release、owner disposal、cache eviction は同じ lease count を減らし、grant が許す lifetime を越えて resolved value を保持しない。
runtime は resolver、subscription source、remote adapter を呼ぶ直前に owner claim から purpose、audience、具体的な request/use/operation binding digest を持つ AuthorizationGrantEvidence を発行する。
evidence は release method を持たず、extension が保持または破棄しても runtime owner claim の lifetime を変更できない。
evidence issuance と owner claim の cache/session/remote cut への promotion は同じ authority lock で行い、extension invocation 後の owner claim release は runtime だけが行う。
ValueDomainValidator、FailureSchemaAdapter の validate と toPublicDetails、HostProfileValidator、BrandValidator は effect-free かつ deterministic でなければならない。
codec の `validateWire` と resolver の `validateLocator` は effect-free かつ deterministic でなければならない。
locator validation は resolve、network、capability use より前に実行する。
ReferenceResult の failure value は ResolverRegistryDescriptor の failureSchemaId に適合し、value は valueDomainId に適合しなければならない。
resolver は expected failure を `ReferenceResult` で返し、throw または reject は runtime failure として dependent scope を失敗させる。

`defineRemoteOperation()` の `handler` は server root であり、returned `RemoteOperation` の call は author-visible な async protocol root である。
compiler は handler body を client artifact に入れず、call を同期 local function に見せかけない。
compiler は一つの qualified remote operation から browser の remote-client-transport/receipt-verifier と server-request の endpoint/handler binding を別々に生成する。
remote-server-delivery binding は descriptor が参照する remote-delivery-adapter entry が所有する。
ProjectionManifestCore は browser binding、browser codec/policy dependency、public protocol binding metadata だけを含み、server handler、deliveryAdapterId の implementation、ledger、server-only import closure を含まない。
handler の typed application failure は `RemoteApplicationResult` の `ok: false` で返す。
caller は success、application failure、cancelled、expired、ambiguous、system failure を `RemoteOutcome` の closed union で受け取る。
remote call entry は input capture 前に coordinator-local な RemoteCallAttemptIdentityPreimage の sequence を同期発行し、attempt ID をその digest とする。
attempt sequence は remote operation sequence、ledger、watermark と別 namespace であり、remote commit authority を持たない。
capture reject、capture codec 不在、capture 中 cancel、reserve 前の authorization/admission failure は Promise rejection にせず、`operationId: null` の RemotePreAdmissionOutcome を返す。
この path は remote operation sequence を発行しないため terminal hole を作らない。
RemoteDeliveryAdapter.reserve() が成功した後の outcome だけが attemptId と non-null operationId の両方を持つ。
RemoteDeliveryAdapter は registry export として実行可能であり、SC03 は descriptor と symbolic implementation locator を同じ universe entry に束縛する。
AF01 は artifact finalization 後に implementation artifact、export、host attestation を finalized catalog entry に束縛する。
ただし RemoteDeliveryAdapter、RemoteServerEndpoint、handler、ledger は server-request role であり、browser の RemoteOperation callable が直接 import または invoke しない。
browser role は RemoteClientTransport と RemoteClientReceiptVerifier だけを持つ。
browser runtime は private RemoteCapturedRequest から untrusted DTO の RemoteCapturedRequestWire を作り、private RemoteAuthorizationEvidenceIssuer で endpoint、protocol binding、operation、request commitment、attempt、principal、policy epoch、evaluation、expiry、nonce を束縛した RemoteAuthorizationEvidenceWire を発行する。
AuthorizationGrantClaim、AuthorizationGrantEvidence、RemoteCapturedRequest の private brand または private-store membership を wire DTO へ直列化しない。
RemoteProtocolCodec は admission/execution の DTO を `dathra.remote-jcs-utf8/1` の canonical JCS UTF-8 bytes にし、RemoteClientTransport は RemoteWireFrame の exact bytes だけを server endpoint へ送る。
admission response の protocol proof を検証して operation identity を得た後、同じ captured request commitment と protocol binding を持つ execution frame を送る。
admission response を得る前の transport failure では server endpoint が effect を開始できず、予約済み slot があっても deadline で non-commit terminal へ進むため pre-admission outcome にする。
server endpoint は raw frame length を allocation 前に検査し、host-injected RemoteProtocolCodec で canonical encoding、message kind、closed schema、depth、digest、byte length を検証する。
その後、RemoteAuthorizationEvidenceVerifier が issuer proof または認証済み channel proof、audience、endpoint、operation、request commitment、attempt、policy evaluation、expiry、replay window を検証し、VerifiedRemoteAuthorizationEvidence を作る。
evidence proof は proof field を空にした canonical evidence DTO 全体を認証する。
verifier は `(issuerId, evidenceId, nonce, attemptId, requestCommitment)` を replay window 中保持し、同じ admission の再送は同じ予約済み operation へだけ対応付け、別 operation の発行には使わない。
execution での再提示は admission が作った同じ operation identity に一致する場合だけ許可し、window 終了後または異なる endpoint、attempt、commitment での提示を拒否する。
server-local PolicyGrantAuthority は verified evidence から新しい local claim を pin し、adapter invocation 用の release method を持たない AuthorizationGrantEvidence と authorization cut を発行する。
wire evidence、verified evidence、server-local claim は別 identity であり、wire object の shape または digest だけから private brand を復元しない。
server endpoint は RemoteDeliveryAdapter の RemoteAdapterCommitReceipt または RemoteAdapterNonCommitReceipt を plain RemoteCommitReceiptWire または RemoteNonCommitReceiptWire へ変換し、protocol binding、endpoint、server deployment、issuer、verifier profile、proof sequence、expiry、canonical message digest を持つ RemoteProtocolProof を付けて canonical response frame を作る。
proof は proof field を空にした canonical DTO digest 全体を認証し、receipt または admission response の一 field だけへ付けた署名として扱わない。
execution response は browser verifier が exact frame、protocol binding、endpoint、expected operation、request commitment、protocol digest、receipt proof、receipt field を検証してから branded receipt を生成し、その後だけ output/failure codec で materialize する。
VerifiedRemoteCommitReceipt と VerifiedRemoteNonCommitReceipt は検証済み wire DTO を `wire` field に保持する browser-local capability であり、wire DTO を継承せず、server-local adapter receipt の brand も再利用しない。
runtime は host private store で検証済みの adapter capability だけを呼び、author が構築した同形 object、receipt brand、自己申告 descriptor を信頼しない。
`effect-ledger-result-atomic` adapter は handler へ RemoteAtomicTransaction を渡し、`stage()` を通る effect、operation ledger、encoded terminal result を一つの commit に入れた後でだけ RemoteAdapterCommitReceipt を発行する。
`fenced-idempotency` は同等の sink fence を receipt に束縛し、`none` は transactional exactly-once plan の候補にならない。
remote runtime は author input を input codec で一回だけ capture し、captured wire を単独で canonical JCS UTF-8 encode する。
RemoteRequestCommitmentPreimage は wire encoding、qualified codec ID/version、wire schema、principal、policy epoch、canonical captured wire digest、exact byte length を固定し、captured value 自体を preimage に重複格納しない。
capture 後に authorization policy を canonical input で評価し、PolicyGrantAuthority から authorization evaluation digest、grant ID、authorization generation を持つ claim を取得する。
この三 field も request commitment と operation identity に含める。
request commitment はこの full preimage の canonical digest とし、RemoteCapturedRequest は private brand、captured wire、immutable canonical bytes を browser-local に保持する。
RemoteCapturedRequestWire は commitment、preimage、captured wire だけを持つ untrusted DTO であり、server は captured wire を同じ encoding で再 encode して digest、byte length、commitment を照合した後に別の server-local RemoteCapturedRequest を作る。
capture 完了後は元の author input object を remote protocol から切り離し、mutation、getter、Proxy、別 caller の alias を再読しない。
その後、private issuer から principal と operation qualified ID ごとの issuer epoch、単調 sequence、admission expiry を持つ authenticated operation ID を発行する。
private issuer は verified RemoteDeliveryAdapter.reserve() を通じて ledger budget と terminal slot を原子的に予約し、RemoteAdmissionResult が成功した場合だけ execute へ進む。
operation ID は canonical RemoteOperationIdentityPreimage と host authentication tag の fixed encoding とし、sequence は leading zero のない unsigned decimal string とする。
adapter は operationId から preimage を復号・認証し、RemoteDeliveryRequest.operationIdentity と byte-for-byte 一致する場合だけ admission する。
server は captured wire、wire digest、codec ID/version/schema、request commitment を再検証し、その immutable wire から新しく materialize した Input だけを `run(input, transaction)` と handler へ渡す。
RemoteDeliveryRequest.requestCommitment、operationIdentity.requestCommitment、capturedRequest.commitment は完全一致しなければならない。
adapter または handler が caller realm の元 Input object を受け取る API は提供しない。

reserve 後かつ handler、RemoteAtomicTransaction.stage、external effect より前に、runtime は PolicyGrantAuthority.admitRemoteOperation() で grant claim と revocation を線形化する。
revocation が先勝ちした場合は authority が null を返し、adapter は effect を開始せず authorization-denied の RemoteAdapterNonCommitReceipt へ terminalize する。
runtime はこの場合 `execute()` を呼ばず、verified adapter の `rejectBeforeEffect()` で予約済み ledger slot、terminal fence、authorization-denied terminal を一つの atomic write にする。
cut が先勝ちした場合は RemoteAuthorizationCut を operation ledger に pin し、その operation の terminal まで有効にする。
以後の revocation は新しい operation と未 cut operation を拒否するが、既に cut を取得した operation の意味を途中で書き換えない。
commit/non-commit receipt は evaluation digest、grant ID、authorization generation、cut ID を束縛し、terminal 後に claim と cut pin を解放する。
author は RemoteCallOptions から任意 operation ID を注入せず、same-ID retry と ledger query は RemoteRecoveryCapability だけが行う。
adapter は effect 前に operation identity の authentication、principal、operation kind、expiry、sequence watermark を検証し、expired ID、retired issuer epoch、watermark 以下の sequence の再実行を effect なしで拒否する。
この replay rejection 自体を元 operation の non-commit 証明には使わない。
non-commit を確定する adapter は、ledger entry を `pending -> non-commit-terminal` へ遷移させ、同じ operationId と request commitment の将来の commit を拒否する terminal fence を同じ atomic write で設置する。
RemoteAdapterNonCommitReceipt はこの tombstone、terminal outcome、terminal digest、ledger entry digest、fence ID を束縛し、単なる「該当行を観測できなかった」という照会結果から発行しない。

commit と non-commit の terminal record は、receipt/result の保証期間と recovery horizon が終了するまで terminal kind、terminal digest、receipt evidence を保持する。
期間内に terminal record budget が不足する場合は新 admission を止め、evidence を早期削除しない。
保証期間終了後、issuer epoch 内で hole のない terminal sequence prefix を RemoteOperationHighWatermark の replayRejectedThroughSequence へ進め、terminal record を削除した prefix を terminalEvidenceDiscardedThroughSequence に記録する。
watermark 更新と個別 terminal record の削除は同じ ledger transaction で行い、削除後の duplicate は effect なしに拒否するが、元の commit/non-commit kind を watermark から推測しない。
issuer epoch の admission expiry 後は authenticated token の expiry を stateless に検証し、retired epoch の ID を新 epoch で再利用しない。
RemoteProtocolBudget は raw frame、canonical message、JSON depth、authorization evidence、captured wire、response payload、materialized input/output、codec work、concurrent decode を制限する。
全 field は正の safe integer とし、RemoteOperationRegistryDescriptor.protocolBudget が RuntimeHostAdapter.remoteProtocolHardLimit を超える場合は registry load 前に拒否する。
endpoint と browser verifier は maxRawFrameBytes を JSON parse または base allocation より前に検査し、strict decoder が canonical JCS、closed field set、duplicate key、UTF-8、depth、subtree byte length を検証する。
evidence、captured wire、response payload は canonical bytes 上の subtree range から独立に数え、宣言した digest と length を再計算する。
input/output/failure codec は preflight estimate を saturation 加算し、materialized byte と work unit の全 reservation が成功するまで author codec、handler、adapter effect を開始しない。
response encoding でも同じ budget を適用し、上限超過時は effect の commit certainty を receipt から分類して protocol-budget failure または ambiguous を返す。

in-flight hole、terminal record、terminal byte、sequence gap は descriptor の RemoteLedgerBudget 以下に制限する。
RemoteLedgerBudget の全 field は正の safe integer とし、RuntimeHostAdapter.remoteLedgerHardLimit を超える descriptor を registry load 前に拒否する。
issuer は valid operation ID を公開する前に adapter の in-flight と terminal 枠を予約し、予約できない場合は remote admission を作らず local non-commit system failure を返す。
この failure の correlation operationId は admissionExpiresAt が issuance 時刻以下の signed rejection ID とし、adapter が stateless に commit 不能と判定できる。
発行後の operation は予約済み terminal slot を必ず commit または non-commit record へ移し、evidence horizon 後にだけ watermark へ compact する。
したがって fence を永久に一件ずつ保持せず、削除後も古い operation ID が commit 可能に戻らない。
ただし evidence を削除した operation の照会、retry、recovery は、caller が有効な receipt を提示できない限り `terminal-evidence-expired` の ambiguous とする。
この outcome は古い operation の再実行も terminal evidence の復元もできないため、recovery capability を常に null にする。
remote runtime は Promise を reject せず、次の commit-certainty 順序で outcome を一意に分類する。

1. browser verifier が operation、request commitment、principal、policy epoch、terminal tombstone、fence、RemoteNonCommitTerminal を束縛した VerifiedRemoteNonCommitReceipt を検証できる場合だけ、cancelled、expired、または `dathra.remote-system/1` の system failure を返す。
2. 同 verifier が VerifiedRemoteCommitReceipt と terminal digest を検証できた場合だけ、success、application failure、または証明済み after-commit cancellation を返す。
3. commit の有無または commit 後 terminal の integrity を証明できない場合は、transport、protocol、codec failure ではなく ambiguous を返す。

RemoteSystemFailure の transport-unavailable は `commit: not-committed` を必須とする。
JavaScript agent の強制終了など Promise settlement 自体が不可能な場合の liveness は保証しない。

`cancelled` の `after-commit` は remote protocol が cancellation terminal を証明した場合だけ返し、terminal を証明できなければ `ambiguous` にする。
idempotent operation は horizon 内で同じ operationId だけを retry でき、transactional operation は ledger policy に従って query する。
`expired` は operation が commit されなかったことを protocol が証明し、admission または deduplication horizon が終了した場合だけ返す。
operation token の expiry または replay watermark だけでは過去の non-commit を証明しない。
commit の有無を確定できないまま horizon を越えた場合は必ず `ambiguous` とし、別 operationId の自動 retry を許さない。

ambiguous outcome は、delivery policy と現在の authorization が許す場合だけ RemoteRecoveryCapability を持つ。
capability は principal context、policy epoch、operationId、requestCommitment、delivery contract、horizon に束縛し、各 `recover()` または `reconcile()` の直前に policy を再評価する。
idempotent recovery は同じ operationId の retry、transactional recovery は ledger query、single-attempt は明示許可された manual reconciliation だけを提供する。
capability は元の RemoteAmbiguitySnapshot を immutable に保持する。
recovery が valid receipt を得た場合だけ `resolved` と RemoteCertainOutcome を返す。
stale、unauthorized、expired、transport、integrity、ledger、protocol failure では新しい `not-committed` claim を作らず、元の snapshot と RecoveryAttemptFailure を持つ `still-ambiguous` を返す。
したがって recovery failure が元の commit uncertainty を system failure で上書きすることはない。

RemoteOperationRegistryDescriptor の applicationFailureSchemaId は failureCodec の value domain と一致し、system failure は author codec ではなく固定 protocol codec を使う。
inputCodecId と outputCodecId の valueDomainId は remote descriptor の inputValueDomainId と outputValueDomainId に一致しなければならない。
failureCodecId の valueDomainId は applicationFailureSchemaId が指す FailureSchemaRegistryDescriptor.valueDomainId と一致しなければならない。
deliveryAdapterId と deliveryPolicyId は compiled descriptor では qualified ID である。
transportProfileId も qualified host-profile ID とし、protocol binding の transport profile、request/response schema、evidence/receipt verifier metadata、protocol budget digest と一致させる。
delivery adapter dependency は remote-server-endpoint から descriptor が選んだ remote-server-delivery role への binding としてだけ現れ、browser dependency binding に入れない。
protocol binding の deliveryEnvironment と RemoteDeliveryAdapterRegistryDescriptor.deliveryEnvironment が異なる場合は diagnostic とする。
delivery horizon は正の safe integer millisecond とし、idempotency key と transaction ledger の意味は参照した policy descriptor が定義する。
