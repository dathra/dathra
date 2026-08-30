> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Server rendering and delivery

## server render と delivery

### render body の実行回数

server root は obligation であり、body の invocation count ではない。
初期 UI は server materialization を要求するが、body は static witness または cache witness によってゼロ回になり得る。
speculative attempt によって複数回実行される場合もある。

generation-scoped contribution から外部へ影響できるのは、選択されて commit された RenderEnvelope だけである。
Early Hints などの operation-scoped publication は、事前に claim した authority と compatible envelope set を持つ場合だけ、最終 envelope の選択前に発生できる。

static または cache witness が代替できるのは、initial render-materialization obligation に限る。
witness は、source、artifact、module dependency、classified read と consistency cut、variation key、principal、exposure realm、version、freshness、invalidation、status、response contribution、ordered body、handoff、DSD を束縛する。

cache hit では、generation、sequence、epoch、publication authority を現在の operation へ付け替える。
per-request resource、handler、action、transaction、cleanup、non-cache-replayable contribution は witness で省略できない。
witness は effect receipt を持たず、effect を replay しない。

### RenderOperation

RenderOperation は、次の owner である。

- request context
- deadline と cancel
- render generation
- child operation
- spawn lease と resource lease
- response contribution
- stream epoch
- cleanup owner

async continuation と async iterator は spawn lease を持つ。
deadline または cancel は、新しい spawn と publication の authority を revoke する。
late callback は diagnostic と owner-safe な resource settlement だけを行える。

operation の primary terminal は、`completed`、`failed`、`cancelled`、`timedOut`、`writerOutcomeUnknown` である。
generation の terminal は、`published`、`publicationUnknown`、`superseded`、`failed`、`cancelled` である。
primary terminal は後から書き換えない。

### RenderDefinition content identity

RenderDefinitionは、render outputを構成する四つのreferent claimを一つのcontent-addressed identityへ束縛する。

```ts
declare const renderDefinitionIdBrand: unique symbol;

type RenderDefinitionId = Sha256Digest & {
  readonly [renderDefinitionIdBrand]: true;
};

interface RenderObservationReferenceClaim {
  readonly schema: "dathra.render-definition-observation-reference/1";
  readonly role: "observation-contract";
  readonly claimedId: Sha256Digest;
}

interface RenderResponseReferenceClaim {
  readonly schema: "dathra.render-definition-response-reference/1";
  readonly role: "response-contribution-set";
  readonly claimedId: Sha256Digest;
}

interface RenderBodyReferenceClaim {
  readonly schema: "dathra.render-definition-body-reference/1";
  readonly role: "ordered-body-plan";
  readonly claimedId: Sha256Digest;
}

interface RenderExposureReferenceClaim {
  readonly schema: "dathra.render-definition-exposure-reference/1";
  readonly role: "exposure-contract";
  readonly claimedId: Sha256Digest;
}

interface RenderDefinitionPreimage {
  readonly schema: "dathra.render-definition/1";
  readonly observationContract: RenderObservationReferenceClaim;
  readonly responseContributions: RenderResponseReferenceClaim;
  readonly orderedBodyPlan: RenderBodyReferenceClaim;
  readonly exposure: RenderExposureReferenceClaim;
}

interface RenderDefinition {
  readonly id: RenderDefinitionId;
  readonly preimage: RenderDefinitionPreimage;
}

interface RenderDefinitionInput {
  readonly observationContractId: Sha256Digest;
  readonly responseContributionSetId: Sha256Digest;
  readonly orderedBodyPlanId: Sha256Digest;
  readonly exposureContractId: Sha256Digest;
}

type RenderDefinitionErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-reference"
  | "digest-mismatch"
  | "budget-exceeded"
  | "crypto-unavailable";

class RenderDefinitionError extends TypeError {
  readonly code: RenderDefinitionErrorCode;
  readonly path: readonly (string | number)[];
}

interface RenderDefinitionHardLimits {
  readonly maximumOwnKeysPerRecord: 16;
  readonly maximumPropertyKeyCodeUnits: 128;
  readonly maximumInputStringCodeUnits: 256;
}

declare function createRenderDefinition(
  input: RenderDefinitionInput,
): Promise<RenderDefinition>;

declare function parseRenderDefinition(
  value: unknown,
): Promise<RenderDefinition>;
```

createRenderDefinitionは四つのdigestをrole-specificなclosed claimへ配置し、RenderDefinitionPreimageのcanonical digestをRenderDefinitionIdとする。
parseRenderDefinitionはwrapperとpreimageをstrictにsnapshotし、同じdigestを再計算してidと照合する。
両operationはcaller objectを保持せず、freshでdeep-frozenなrecordを返す。

RenderDefinitionIdが証明するのは、closed preimageとself digestの一致だけである。
claimedIdの字句妥当性はtargetの実在、target schema、self digest、role compatibility、cross-reference closureを証明しない。
accepted definition、actual SSRまたはDSD output、ObservationContract conformance、runtime trustも後続validatorが所有する。
generic digestまたはcanonical digest stringだけからRenderDefinitionIdを発行するparser、guard、cast helperは提供しない。
RenderDefinitionIdを発行できるのは、createRenderDefinitionと、full recordをstrict parseしてself digestを再計算するparseRenderDefinitionだけである。

creator input、parser wrapper、preimage、四つのclaimは、current-realmのordinary plain recordまたはnull-prototype recordだけを受理する。
Proxyは入力契約外であり、標準ECMAScript APIではtrapを実行せず識別できないため、Proxy trap非実行を保証しない。
ordinary recordのaccessorはdescriptorから検出し、getterとsetterを実行せず拒否する。

schema record occurrenceは、creator input、またはparserのwrapper、preimage、observation、response、body、exposureの固定preorderで処理する。
各recordはnon-recordとprototype、ownKeys、16-key cap、128-code-unit key cap、descriptor snapshot、structural ruleの順に検証する。
同じobject identityは一度だけsnapshotし、schema pathごとのrole validationは別々に行う。
expected nested recordの発見に必要なancestor data descriptorは、nested budget failureより前にsnapshot済みでよい。
key countまたはproperty key lengthに違反したrecordではdescriptorを取得せず、後続recordも処理しない。
descriptor取得後にaccessor、hidden property、symbol propertyの違反を検出した場合は、残りの処理と後続recordの処理を行わない。
いずれの違反でもextra property valueを読み出さず、canonical digestを開始しない。

全reachable recordをsnapshotした後、expected string fieldを固定record orderとfield orderで検査する。
string fieldは256 code unitsを上限とし、その後にmissing、raw UTF-16順のextra、schemaとrole、digest、hash、wrapper comparisonを検証する。
budget failureは`budget-exceeded`とし、key違反はrecord path、string違反はfield pathを返す。
hard limitはversioned implementationの固定値であり、callerは緩和できない。

valid parser inputは最大6 schema occurrenceと19 propertyである。
per-record capからdescriptor対象は最大96 keysとなり、operation-wide total key counterは持たない。
各distinct recordのhost own-key result allocationは、already-materialized object APIではper-record cap適用前にcaller-controlledなkey列挙を必要とするため、framework budgetでは事前停止できない。
各own-key resultの返却直後に16-key capを適用し、その後のdescriptor scan、nested traversal、snapshot、digestを固定上限内に制限する。
wire、network、fileからobjectを作るownerは、object construction前のbyte length、depth、key count admissionを別に行う。
RC01-DIはraw byte parserを所有しない。

creatorとparserは次のfailure mappingを共有する。

| Failure | Code | Path |
| --- | --- | --- |
| non-record、custom prototype、accessor、hidden property、symbol property | `invalid-closed-record` | 違反recordへのpath |
| missing key | `invalid-field` | expected keyまでのpath |
| extra key | `invalid-field` | extra keyまでのpath |
| schemaまたはroleがexpected literal以外（非stringを含む） | `invalid-field` | 違反fieldへのpath |
| creator inputまたはnested claimedIdの非string、malformed string、noncanonical digest | `invalid-reference` | digest fieldへのpath |
| parser wrapperの`id`の非string、malformed string、noncanonical digest | `invalid-field` | `id` fieldへのpath |
| lexicalに正しいwrapper `id`と再計算値の不一致 | `digest-mismatch` | `id` fieldへのpath |
| WebCrypto不在 | `crypto-unavailable` | root path |
| snapshot済みpreimageのその他のcanonicalization failure | `invalid-field` | 元failure pathにoperationのpathをprefixしたpath |

schemaとroleは、非stringを含むexpected literal以外の値を`invalid-field`とする。
CanonicalIdentityErrorはRenderDefinitionErrorへ変換し、public operationから漏らさない。
RenderDefinitionError constructorはpathをcopyしてfreezeし、error object自身もfreezeする。

複数違反がある場合は、次の順序で最初の一件だけを返す。

1. schema record occurrenceをpreorderで走査し、non-record、prototype、per-record key count、property key length、descriptor structural ruleを検査する。
2. 全reachable occurrenceのsnapshot後、expected string fieldのlengthを固定field orderで検査する。
3. 各recordでexpected key listの順にmissing keyを検査する。
4. 各recordでraw UTF-16 key順にextra keyを検査する。
5. schemaとroleを固定field orderで検査する。
6. digest fieldを固定field orderで検査する。
7. snapshot済みpreimageをcanonicalizeしてdigestする。
8. parserだけがwrapper `id`と再計算値を比較する。

creator inputのfield orderは、observationContractId、responseContributionSetId、orderedBodyPlanId、exposureContractIdとする。
parserはwrapperのid、preimageの順で処理する。
preimageのfield orderは、schema、observationContract、responseContributions、orderedBodyPlan、exposureとする。
四つのclaimはobservation、response、body、exposureの順に処理し、各claimのfield orderはschema、role、claimedIdとする。

RenderDefinition preimage、ID、creator、verified parser、domain errorはRC01-DIが所有する。
ObservationContractのpure structural validationとwitness semanticsはOC01が所有する。
referent closureとaccepted definitionは後続RC01 unitが所有する。
static exact bytesとreproduction recordの生成はAF01が所有し、reproduction recordだけではstatic actual-output acceptanceにならない。
post-finalization reproduction verificationとwitnessまたはadmission sidecar bindingはSL01が所有する。
dynamic output claim、witness、writer、FinalHeaderCommit state machineはSR02が所有する。
authenticated runtime conformanceはRR01が所有する。
generation、envelope、publication、authorityは後続RC01 unitとSR02が所有する。
shared rootまたはrole-scoped subpathへの公開はAS01が所有する。
RenderDefinitionのparserとreferent closureをbrowser runtimeへ自動配置しない。
hard limitとProxy exclusionはclient inclusion permissionを作らない。

RenderEnvelope と operation publication は次の identity を持つ。

```ts
interface RenderEnvelope {
  readonly id: string;
  readonly definitionId: RenderDefinitionId;
  readonly generationId: string;
  readonly observationContractDigest: Sha256Digest;
  readonly responseContributionDigest: Sha256Digest;
  readonly orderedBodyPlanDigest: Sha256Digest;
  readonly exposureDigest: Sha256Digest;
}

interface PublicationClaim {
  readonly id: string;
  readonly kind: "early-hints";
  readonly authorityScopeId: string;
  readonly canonicalHeaders: readonly (readonly [string, string])[];
  readonly compatibleEnvelopeDefinitionIds: readonly string[];
  readonly pinnedEnvelopeId: string | null;
  readonly exposureDigest: Sha256Digest;
  readonly retryMode: "retain-compatible-set" | "pin-single-envelope";
}

interface PublicationLedgerEntry {
  readonly claimId: string;
  readonly sequence: number;
  readonly acceptance: "prepared" | "rejected" | "writer-accepted";
  readonly transport: "not-started" | "flushed" | "failed" | "unknown";
}
```

RenderEnvelope definition ID は、四つのrole-specific reference claimを含むclosed preimageとself digestの一致だけをcontent-addressedに束縛する。
actual response contribution、ordered body plan、exposureとのreferent closureは、後続validatorが別に証明する。
RenderEnvelope ID は definition ID と generation ID を束縛する。
PublicationClaim の header は host profile の parser で正規化し、header name、field value、target URL、fetch mode、credentials、referrer policy を canonical form にする。
compatibleEnvelopeDefinitionIds は重複のない ID 昇順とし、claim 作成時の live candidate definition set の subset でなければならない。
`retain-compatible-set` では pinnedEnvelopeId を null とし、`pin-single-envelope` では一つの live envelope ID を記録する。

baseline の 103 Early Hints は、host profile が許可した `Link` の `preload`、`modulepreload`、`preconnect` relation だけを送れる。
`Set-Cookie`、principal-dependent secret、選択候補によって audience が変わる target は許可しない。

lease authority の `released`、`revoked`、`expired` と、underlying resource の `settled`、`abandoned` を分ける。
cleanup abandonment は secondary status であり、失敗した request を success に変えない。

parent completion は、spawn gate が閉じ、owned child と resource が contract terminal に達するまで待つ。

### non-replay read

body は classified read handle を dereference できるが、non-replay read を直接取得しない。
取得は operation-owned input または resource root が一回に coalesce する。

non-replay result は、次の sharing policy を持つ。

- **operationShareable**：immutable result を全 generation が再取得せず共有できる。
- **generationBound**：最初の consumption が generation を選択し、irreversible latch を設定して競合 generation と retry を禁止する。

未分類の ambient read は render-unsafe とする。

### retry と cancellation

generation は、phase、retryAllowed、irreversibleLatch を持つ。
retry は、旧 generation を immutable な `superseded` または `failed` にし、retired-generation cleanup owner へ cleanup を移した後でだけ開始する。

cancellation、deadline、lease acquisition、generation selection、sequence terminal、writer acceptance は、一つの operation-epoch linearization protocol を使う。
publication validation と writer acceptance は一つの action とする。

cancel が先なら writer acceptance を拒否する。
acceptance が先なら reservation は committed のまま残り、cancel は後続 publication と transport にだけ影響する。

### response phase

response phase は次の順序で進む。

```txt
header-open
  -> header-preparing
  -> final-header-committed
  -> body-open

header-preparing -> header-open(new header epoch) | failed
```

`header-preparing` への遷移は、現在の header epoch に対する新しい contribution authority の取得を閉じるが、外部 publication と retry latch をまだ発生させない。
precommit failure では preparation を破棄し、外部 writer acceptance がない場合だけ新しい header epoch を `header-open` から開始できる。

**FinalHeaderCommit** は、RenderEnvelope の選択、operation-scoped contribution と選択 generation contribution の merge、conflict validation、canonical header seal、writer acceptance、`final-header-committed` への遷移、generation pin、retry latch を一つの non-suspending linearization action で行う。
writer が acceptance を返さない場合は action を commit せず、部分的に seal された header state を残さない。
host writer adapter は non-reentrant な atomic acceptance を提供し、外部で受理した後に refusal を返してはならない。
この truthful atomic acceptance capability は speculative generation、streaming response、103 Early Hints の必須条件である。

atomic acceptance を提供できない host profile は、103、streaming、write invocation 後の retry を禁止する。
一つの RenderEnvelope を外部 write 前に pin し、status、header、body をすべて buffer した後で、一つの **BufferedFinalWrite** を行う。
host profile は bounded response buffer contract を持ち、上限を超える可能性がある route は build diagnostic または外部 write 前の typed failure にする。
write invocation の直前に irreversible latch を設定し、adapter が外部受理の有無を証明できなければ operation を `writerOutcomeUnknown`、generation を `publicationUnknown` にする。
unknown outcome は外部 publication 済みとして exposure と cleanup を処理し、別 generation または別 write へ retry しない。
FinalHeaderCommit 後は、transport flush の成否にかかわらず別 generation へ retry しない。
superseded generation の contribution は FinalHeaderCommit 前に破棄する。

header lease は body sequence と backpressure に依存できない。
continuation は header authority だけを先に release できる。

final header transport flush は FinalHeaderCommit 後に行い、既に設定済みの irreversible latch を変更しない。
body enqueue は final-header-committed 後にだけ行う。

Early Hints の writer acceptance 前に、coordinator は claim の authority、exposure、canonical header、compatibleEnvelopeDefinitionIds、pinnedEnvelopeId を検証する。
Early Hints は truthful atomic acceptance capability がある host profile だけで有効にする。
compatible set は、各 hint が ObservationContract 上合法で、その external fetch effect を含めてもよい生存 RenderEnvelope だけから成る。

claim が全生存 envelope と互換なら候補集合を維持できる。
一部だけと互換なら、writer acceptance と同じ linearization point で生存集合を compatible set へ絞り、集合外の generation を superseded にする。
`pin-single-envelope` は、この集合の live envelope が一つであり、pinnedEnvelopeId がその ID と一致する場合だけ使える。
compatible set が空なら hint を送らない。

複数の 103 response は PublicationLedger の sequence 順に扱う。
後続 claim は、それ以前の全 writer-accepted claim と互換な envelope の共通部分をさらに狭める。
retry は `retain-compatible-set` の definition 内に限り、既に accepted された全 hint effect を新 generation の ObservationContract に引き継げる場合だけ許す。
`pin-single-envelope` acceptance 後は render retry を許さない。

cancel、FinalHeaderCommit、103 writer acceptance は operation-epoch の同じ linearization protocol で競合させる。
cancel または FinalHeaderCommit が先なら新しい 103 を拒否する。
103 acceptance が先なら publication は irreversible であり、後の cancel は取り消せない。
transport outcome が不明な accepted entry は、retry と exposure の判定では送信済みとして扱う。

### stream

sequence reservation ledger と transport outcome を分ける。
reservation は `committed`、`skipped`、`incomplete` のいずれかで一度だけ terminal になる。
committed reservation は、後で transport が abort しても incomplete に戻さない。

server は次の watermark を別々に記録する。

- writerAccepted
- transportQueued
- transportFlushed

いずれも clientReceived を意味しない。
client だけが、受信 byte と観測した stream terminal から received prefix を判断する。

transport は committed または skipped の連続した sequence だけを進める。
skipped は byte を出さない。
最初の incomplete reservation が abort watermark を固定し、それより後の entry を同じ epoch で expose しない。

prefix safety は reservation 単位ではなく、encoded response の任意 byte cut で判定する。
宣言した decoder と HTML parser がその位置を EOF として処理しても、tokenizer と escaping の trust boundary を壊さず、承認済み commitment と事前に claim した realization effect だけを公開しなければならない。

group atomicity が必要な payload は、completeness と integrity gate の後ろで inert に保つ。
native active HTML は group atomicity を主張しない。

### external platform effect

parser insertion、module evaluation、`customElements.define()`、platform mutation が external code を同期実行し得る場合は、その前に footprint と global root と latch を claim する。
claim できなければ、definition または upgrade 前の stub を置くか、対象 region を reconciliation と rollback の対象外である unmanaged irreversible boundary とする。

事後 diagnostic は安全策にならない。
adapter は invocation 前に spawn lease と resource lease を確保し、return された Promise または resource を synchronous registration gate の解放前に owner へ束縛する。
