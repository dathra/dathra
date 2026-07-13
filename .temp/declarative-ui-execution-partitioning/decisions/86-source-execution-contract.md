### explicit contracts

library と application は、build-time の execution contract を提供できる。
contract は runtime magic ではなく、semantic manifest と同じ typed fact schema を使う。

contract は少なくとも、identity、realm、call と construct、brand、value domain、sync と async boundary、ordering、reentrancy、error、cancel、lifetime、version、security capability を宣言する。
意味を持つ field を自由記述 string で補わず、`dathra.fact/1` の closed discriminated union または kind 付き RegistryId で表す。
unknown fact kind、unknown registry kind、schema version mismatch は diagnostic とする。

ExecutionContractSource は author input であり、artifact digest や canonical module URL を要求しない。
CompiledExecutionContract は resolver の module graph-completeness barrier 後に生成し、source contract、source content、symbolic implementation export を QualifiedRegistryUniverseRecord に束縛する。
artifact bytes、artifact address、final protocol、environment catalog は bundler finalization 後に AF01 が別の finalized catalog として束縛する。
source から直接証明できた事実を contract で上書きできない。

imperative library が所有する DOM region は、author-facing `dom:external` reserved JSX directive と execution contract の ownership/effect fact を組み合わせる。
この contract は Dathra の mutation と reconciliation を禁止するが、server と client の placement directive にはならない。

### source execution contract の canonical boundary

この節は、先に記載した `SemanticFact` の behavioral reference、`SemanticRelation`、ownership、ordering、`ExecutionContractSource` の canonical validation を supersede する。
SC02A は source-local contract の schema、creator、strict parser、canonical digest、local closure だけを所有する。
SC02B は qualified/compiled schema と structural parser を所有し、SC03 だけが contract SCC namespace を計算して source-local ID を qualified ID へ変換する。

SC02A の creator と parser が返す `ExecutionContractSource` は、構造と source-local closure を満たす未信頼 claim である。
author が `integrity.source = "compiler"`、trust boundary、host assumption を宣言しても、compiler evidence、host enforcement、placement permission にはならない。
canonical digest と qualified ID も identity だけを表し、trust acceptance を表さない。
SC03 の qualified evidence と後続の `AcceptedExecutionAnalysis` がない contract を client exclusion に利用できない。

#### behavioral relation の一意性

`SemanticRelation` を behavioral cross-fact edge の唯一の正本とする。
次の field は source と compiled の `SemanticFact` から削除する。

- `read.readEffectFactId`
- `write.writeEffectFactId`
- `effect.readFactIds`
- `effect.writeFactIds`
- `effect.invocationFactIds`
- `ownership.ownerFactId`
- `ownership.lifetimeFactId`
- `ordering.memberFactIds`

read と write の `environmentFactId` と `exposureFactId` は fact attribute の参照であり、behavioral relation ではないため保持する。
effect fact は `retainsCallbacks`、`reentrant`、`schedulesWork`、`allocatesResource` だけを持つ。
ownership fact は `retention` だけを持ち、ordering fact は `relation` だけを持つ。

`orders-before` relation だけが required な `ordinal: number | null` を持つ。
ほかの relation は `ordinal` field を受理しない。
すべての relation は異なる二つの FactId を結ぶ。

relation の fact kind と subject kind は次の閉じた表に従う。

| relation | from fact / subject | to fact / subject | 追加制約 |
| --- | --- | --- | --- |
| `reads` | effect または invocation / active または callable | read / module-evaluation または value | なし |
| `writes` | effect または invocation / active または callable | write / module-evaluation または value | なし |
| `invokes` | effect または invocation / active または callable | invocation / callable | なし |
| `returns` | invocation / callable | 任意の fact / return | exportName を一致させる |
| `owns` | ownership / 任意 | identity、ownership、lifetime / 任意 | lifetime target だけを source と exact subject 一致させる |
| `orders-before` | ordering / 任意 | 任意の fact / 任意 | ordering variant に応じた ordinal を持つ |
| `transfers-as` | transfer 以外の fact / value | transfer / 同じ subject | subject を exact equality で一致させる |
| `fails-with` | effect または invocation / active または callable | failure / 同じ subject | subject を exact equality で一致させる |

active subject は module-evaluation、export-value、receiver、callback-invocation、allocated-resource とする。
callable subject は export-value、receiver、parameter、return、callback-invocation、allocated-resource とする。
value subject は export-value、receiver、parameter、return、allocated-resource とする。
SC02A はこの pure table と subject shape を検証し、SC03 は subject が実際の module signature に存在するかを検証する。

一つの ownership fact は、同じ subject を持つ lifetime target を exactly 1件、identity または別 ownership の owner target を0件または1件持つ。
ownership から ownership への relation は DAG とし、owner cycle を拒否する。

`before` と `serial` の ordering fact は、target が重複しない `orders-before` relation を1件以上持つ。
ordinal は0から件数未満までを gap-free に使う。
`exclusive` と `commutative` の ordering factもtargetが重複しないrelationを1件以上持つが、ordinalはすべて`null`とする。

#### source-local closure

FactId は source contract 内で一意とする。
source contract 内の FactReference は次の表に従う。

| owner field | 許可 fact kind | cardinality |
| --- | --- | --- |
| `read.environmentFactId` | environment | exactly 1 |
| `read.exposureFactId` | exposure | exactly 1 |
| `write.environmentFactId` | environment | exactly 1 |
| `write.exposureFactId` | exposure | exactly 1 |
| relation `from` と `to` | relation table の kind | endpoint ごとに exactly 1 |
| export `factIds` | 任意の semantic fact | set |
| `hostAssumptionFactIds` | 任意の semantic fact | 未信頼 set |

host assumption の許可kindをsource schemaで狭めない。
SC03 と RR01 が host profile、proof domain、evidence admission に基づいて、どの assumption を受理できるかを決める。

すべての RegistryReference は、同じ source contract の expected kind にある RegistrySourceEntry へ解決する。
version を持つ codec、resolver、subscription、remote transfer は、`(kind, id, version)` を source entry と完全一致させる。
registry implementation は SC01 の25個の合法な kind、environment、role tuple だけを使う。

export の `factIds` は、module-evaluation 以外で同じ exportName を持つ subject だけを参照する。
`ExportExecutionContract` の direct field と照合する fact は、subject が exact に `{ kind: "export-value", exportName }` であるものだけとする。
parameter callback、return、allocated resource の fact はこの照合件数へ含めない。

`callable = "none"` は対象 invocation fact 0件とする。
それ以外は `callable` と `receiverBrandId` が一致する対象 invocation fact を exactly 1件要求する。
`transfer.kind = "none"` は対象 transfer fact 0件とする。
それ以外は binding が一致する対象 transfer fact を exactly 1件要求する。
value domain と receiver brand は source registry の expected kind に解決する。

SC03 は、export name、parameter index、parameter-local callback path、allocation site が実 module signature に存在するか、source analysis と contract が衝突しないか、locator export が descriptor と implementation interface を満たすかを検証する。
`factId()` と `registryId()` の引数が build-time string literal であることも SC03 が検証する。

#### nested callback の semantic location

この決定は、`callback-invocation`が`exportName`と`parameterIndex`だけを持つ旧shapeを supersede する。

`callback-invocation`はrequiredな`path: readonly SemanticPathSegment[]`を持つ。
pathのrootは`parameterIndex`で選択したtop-level parameter valueとし、parameter自体がcallback slotである場合は空pathを使う。
object property、tuple member、homogeneous collectionのelement domainにあるcallback slotは、既存の`property`、`tuple-index`、`element` segmentを順に並べて表す。

subject identityはruntime function instanceではなく、source-localな静的semantic locationに対して一意である。
`element`はhomogeneous collectionの全要素が共有するelement domainを表し、個々のruntime elementまたはcallback occurrenceを区別しない。
runtime occurrence identityはExecutionGraphとruntime generationが所有する。

同じpathを持つ`parameter` subjectはcallback function valueを表し、`callback-invocation` subjectはその静的callback slotが実行されるactive siteを表す。
SC02Aのstrict parserはparameter index、tuple index、path segmentのscalarとclosed structural ruleを検証する。
SC03はcompiler-ownedでpath traversal可能なmodule signatureまたはsource-analysis evidenceを使い、export、parameter、path、callable locationの実在を検証する。
このevidenceのschemaと生成方法はSC03の先行review unitで決定し、evidenceがないclaimはfallbackせずdiagnosticにする。

SC02A2の公開実装はtype-onlyだが、後続source snapshot、compiled contract、canonical digestはpath sequenceを変更せず保持する。

#### canonical source API

SC02A は次の synchronous creator/parser と asynchronous digest を提供する。

```ts
interface ExecutionContractBudget {
  readonly maximumInputDepth?: number;
  readonly maximumInputDataNodes?: number;
  readonly maximumInputProperties?: number;
  readonly maximumInputArrayLength?: number;
  readonly maximumInputStringCodeUnits?: number;
  readonly maximumFacts?: number;
  readonly maximumRelations?: number;
  readonly maximumExports?: number;
  readonly maximumRegistryEntries?: number;
  readonly maximumRegistryImplementations?: number;
  readonly maximumReferences?: number;
  readonly maximumSemanticPathSegments?: number;
  readonly maximumCanonicalBytes?: number;
  readonly maximumCanonicalWorkSteps?: number;
  readonly maximumValidationSteps?: number;
}

declare function factId(value: string): FactId;

declare function defineExecutionContract(
  input: ExecutionContractSourceInput,
  budget?: ExecutionContractBudget,
): ExecutionContractSource;

declare function parseExecutionContractSource(
  value: unknown,
  budget?: ExecutionContractBudget,
): ExecutionContractSource;

declare function digestExecutionContractSource(
  value: unknown,
  budget?: ExecutionContractBudget,
): Promise<Sha256Digest>;
```

`defineExecutionContract()` は set-like collection を正規化した deep-frozen snapshot を返す。
`parseExecutionContractSource()` は exact field set と canonical order を要求する。
`digestExecutionContractSource()` は unknown input を strict parser で再検証し、source snapshot 全体の canonical JCS SHA-256 を返す。
source contract 自体は digest field を持たない。

string は Unicode normalization を行わず、raw UTF-16 code-unit 順で比較する。
enum は schema に記載した固定 rank を使う。
SemanticPath は反復を許す sequence として入力順を保持する。
callback parameter index は number 昇順の set とする。
environment は build、server-request、browser の固定順とする。
relation は relation kind、from kind、from ID、ordinal null-first、to kind、to ID の tuple 順とする。
registry entry は kind 内の RegistryId 順、implementation は browser、server-request、role の固定 tuple 順とする。
export record の property insertion order は要求せず、JCS key order を identity に使う。

caller の budget override は framework hard cap を狭めることだけができる。
default hard cap は depth 64、data node 200,000、property 1,000,000、array length 200,000、string code unit 20,000,000、fact 200,000、relation 200,000、export 200,000、registry entry 200,000、registry implementation 400,000、reference 10,000,000、SemanticPath segment 2,000,000、canonical byte 200,000,000、canonical work 20,000,000、validation step 20,000,000 とする。

一つの public operation は一つの operation-local ledger を使う。
schema-aware descriptor preflight は、nested reference、SemanticPath、registry implementation を closed snapshot より前に数える。
reference cardinality は `maximumReferences` へ clone 前に一度だけ課金し、各 lookup work は `maximumValidationSteps` へ probe 前に課金する。
shared alias は出現ごとに input budget へ課金して許可し、active ancestor だけを cycle として拒否する。
descriptor preflight、ownership DAG、deep freeze は iterative に処理する。

exact canonical byte length は full canonical text を生成する前に allocation-free で測定する。
object property sort の worst-case upper bound も `maximumCanonicalWorkSteps` へ先に課金する。
上限内と確認した後だけ `canonicalizeJson()` を一回呼び、返された exact bytes を `sha256Digest()` へ渡す。

#### hostile closed-data boundary の実装分割

この決定は、budget、descriptor、cycle、source profile、clone、freeze、canonical measurementを一つのSC02A8 implementation revisionへ含める案をsupersedeする。
各契約は別々にgreenへできるため、次の依存順で個別にreview、commit、pushする。

| revision | owner | 独立した検証 |
| --- | --- | --- |
| SC02A8A | `ExecutionContractBudget`とoperation-local ledger | exact/limit+1 counter、peak depth、ledger isolation |
| SC02A8B | distinct-container descriptor capture | getter非実行、identityごとの一回reflection、sparse/hidden/symbol rejection |
| SC02A8C | active-ancestor tracker | direct/indirect cycle、leave後alias、iterative depth |
| SC02A8D | profile-driven occurrence walkerとparent-linked plan | occurrence counter、alias再課金、failure path materialization |
| SC02A8E | execution-source cardinality/reference profile | collection、reference、SemanticPathのexact/limit+1 |
| SC02A8F | alias-expanding closed clone | caller非再読、alias identity分離、prototype normalization |
| SC02A8G | final public snapshotのiterative freeze primitive | deep chain、visited identity、validation-step exact/limit+1 |

A8AからA8Gがpackage-local facadeへ追加するsurfaceはtype-only `ExecutionContractBudget`だけとする。
ledger、descriptor view、tracker、profile、plan、clone、freezeはinternal APIであり、shared rootへ追加しない。

budget recordはcurrent `Object.prototype`またはnull prototypeを持つclosed recordだけを受理する。
present overrideは0以上、framework hard cap以下のsafe integerとし、extra、symbol、hidden、accessorを拒否する。

ledgerはcumulativeな`chargeTotal(counter, amount)`とpeak用の`observePeak("maximumInputDepth", depth)`を分ける。
depth以外の14 counterはcumulativeに課金し、depthは1-based active depthの最大値だけを観測する。
overflowまたはlimit failureではそのincrementを適用せず、一つのpublic operation内でledgerをresetしない。

host objectの受理条件は観測可能なprototypeだけで定義する。
recordはcurrent `Object.prototype`またはnull、arrayは`Array.isArray()`がtrueかつcurrent `Array.prototype`であることを要求する。
foreign realm provenance、ordinary internal slot、Proxy trapまたはhost side effectの非実行は保証しない。
reflection APIがthrowした場合はcurrent occurrence pathの`invalid-closed-record`へ変換する。

standard APIはown keyをstreaming取得できないため、distinct identityごとの`Reflect.ownKeys()` result allocationだけはprecharge前に発生し得る不可避なhost boundaryとする。
SC02A8Bはfirst-seen identityをheader phaseとview phaseに分ける。
header phaseはprototype、own key、array `length` descriptor、key metadataだけをcaptureし、walkerがproperty、key code unit、array length、source cardinalityを課金した後にだけ各descriptorを読む。

reflectionはdistinct object identityごとに一回だけ行う。
depth、data node、property、array length、string unit、source cardinality、referenceはpath occurrenceごとに再課金する。
same identityがactive ancestorにある場合だけcycleとし、leave後のshared aliasは許可する。

root depthは1とする。
data nodeはnull、boolean、number、string、array、recordの全occurrenceを数える。
propertyはsymbolを含む全own keyを数え、array intrinsic `length`だけを除く。
拒否するsymbol、hidden、accessor、extra keyもdescriptor validation前にproperty counterへ含める。
string unitはstring valueとstring keyのraw UTF-16 code unitを数え、symbolを含めない。

source profileはwalkerへ二つのhookとして注入する。
`beforeDescriptors`はfacts、relations、exports、10 registry collection、registry implementations、SemanticPath、array-valued referenceのcardinalityをchild descriptor前に課金する。
`beforeChildren`はcapture済みrecord viewからpresent scalar reference slotをchild traversal前に課金する。
missingまたはmalformed discriminatorのsemantic errorはA9以降が所有するが、structurally presentなcollectionまたはpotential referenceはsemantic validationより前に課金する。

plan nodeはfull path arrayを保持せず、parent occurrence IDと一つのsegmentだけを持つ。
error時だけ最大depth 64のparent chainからpathをmaterializeする。
descriptor view、occurrence node、captured property、clone node、array slot、stackのallocationは対応するcounter cap以下にする。

SC02A8Fはplanだけを読み、callerを再reflectionしない。
shared aliasはoutputで保持せず、path occurrenceごとにfresh subtreeへ展開する。
recordはnull prototype、arrayはstandard arrayへ正規化し、enumerable data propertyとして構築する。

raw cloneはoperation外へ公開せず、A9からA12が同期的にfresh domain recordへ変換する。
A12はfinal snapshotのnode、property、array、string cardinalityがadmitted capを超えないことを検査し、A8Gでdeep-freezeしたrootだけをpublic `ExecutionContractSource`として発行する。
A8Gはbrand、identity、trust、placement permissionを発行しない。

budget argumentのroot failure pathは`["budget"]`、field failureは`["budget", field]`とする。
depth/node breachはcurrent occurrence、property/key/array breachはcontainer、source cardinalityは対象collection、scalar referenceは対象slot、sparse/cycleは発見したchild occurrenceをpathにする。
canonical work/byteのglobal budget failureはroot pathとし、canonical scalarまたはUnicode failureはID01と同じvalue/property pathにする。

#### occurrence walker と source profile の追加分割

この決定は、上表の`SC02A8D`と`SC02A8E`を一つずつのimplementation revisionとして扱う部分だけをsupersedeする。
既存のbudget、descriptor、active-ancestor、clone、freezeの意味は変更しない。

`SC02A8D`はparent-linked planとwalker integrationを別々にgreenへできるため、次の直列revisionへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| SC02A8D-P | occurrence ID、parent ID、一segmentだけを保持するplanとfailure時path materialization | source-local path type | full path非保持、root/record/array path、12,000 depth、failure時だけのiterative materialization |
| SC02A8D-W | A8A/B/CとD-Pを統合するiterative occurrence walkerとgeneric profile hook | SC02A8A、A8B、A8C、A8D-P | root depth、全node/key/string/array課金、alias再課金、active cycle、hook order、operation isolation |

SC02A8D-Pはcaller object、descriptor、budget ledger、profile、cloneを参照しない。
SC02A8D-Wはplanを構築するがsource固有fieldを解釈せず、`beforeDescriptors`と`beforeChildren`のgeneric hook順序だけを固定する。
進行中の旧SC02A8D combined draftは破棄せず、fixed review revisionを作る前にD-PとD-Wのwrite setへ分類する。

`SC02A8E`はcollection、reference、SemanticPathの独立counterを一つのreview unitに束ねない。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| SC02A8E-C | facts、relations、exports、10 registry collection、registry implementationのcardinality profile | SC02A8D-W | 各collectionのexact/limit+1、descriptor前課金、非対象field非課金 |
| SC02A8E-R | scalar referenceとarray-valued referenceのcardinality profile | SC02A8D-W | structurally presentなpotential referenceのexact/limit+1、semantic validation前課金 |
| SC02A8E-P | `SemanticPath` segmentのcardinality profile | SC02A8D-W | repeated segment、empty path、全subject occurrence、child descriptor前のprecharge、exact/limit+1 |
| SC02A8E-I | C/R/P hookの一回だけのcompositionとsource profile integration | SC02A8E-C、A8E-R、A8E-P | hook順序、二重課金なし、operation-local ledger共有、failure path |

SC02A8E-C、A8E-R、A8E-Pはdisjoint focused module/testとして並列reviewできる。
SC02A8E-Iだけが三profileを組み合わせ、source profile全体をwalkerへ渡す。

C、R、Pのprofile hookはframework-ownedなinternal boundaryとし、public extensibility pointにしない。
hookへ渡すoccurrence、captured header、captured view、およびviewから到達できるcaller-owned valueはread-only observationである。
hookが変更してよいのは、渡されたoperation-local ledgerとcaller objectを保持しないboundedなprofile-owned operation-local stateだけとする。

Iは各phaseで適用可能なC、R、Pのmethodをこの順に一回だけ呼び、同じoccurrence、headerまたはview、同一ledger objectを転送する。
先行methodが失敗した場合は後続methodを呼ばず、errorとfailure pathを変換しない。
I自身はcounterを課金せず、successとfailureの両方でhook入力とcaller descriptorが変化しないことをfocused testで検証する。

#### source profile integration reviewの追加分割

この決定は、`SC02A8E-I`のruntime semanticsを変更せず、composition実装とpost-call lifetime evidenceを一つのreview unitとして扱う部分だけをsupersedeする。
旧`SC02A8E-I` combined revisionを新しい名前のまま再reviewせず、次の直列revisionへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| SC02A8E-I-C | C、R、P factoryと両hook phaseのcomposition core | completedなSC02A8E-C、A8E-R、A8E-P | child stateのfreshness、C/R/P順、exactly once、同一引数とledger、二重課金なし、first failure、入力非変更、internal signature |
| SC02A8E-I-L | live compositeがhook引数またはcaller-owned valueを同期call後に保持しないlifetime evidence | review済みexact SC02A8E-I-C | successとfailureのcollectability、retaining mutantによるnegative control、GC flag復元、反復安定性 |

SC02A8E-I-Cはuntrusted source preflightのruntime admission、failure order、read-only boundaryを統合するため`high` tierとし、primary、implementation、boundaryの三役で初期reviewする。
SC02A8E-I-Lはproduction contractを変更しないが、明示GC、memory lifetime、process-global flagのtest isolationを扱うため`medium` tierとし、primaryとimplementationの二役で初期reviewする。
各unitでblockerを修正した場合の収束reviewは、初期reviewへ参加していない一名だけが担当する。

SC02A8E-I-Cだけが`executionContract/sourceProfile.ts`、`executionContract/sourceProfile.test.ts`、`executionContract/sourceProfile.type-fixture.ts`を所有する。
SC02A8E-I-Lはproductionを変更せず、`executionContract/sourceProfileLifetime.test.ts`だけを所有する。
`executionContract/SPEC.typ`とcumulative testはmain integration ownerが各revisionで逐次更新する。

I-Lのcollectability testは、検査終了までcomposite profileへのstrong referenceを保持する。
これにより、profileまたはprofileが保持するchild stateがhook引数を保持した実装ではWeakRef targetが回収されず、testが失敗する。
retaining mutantを同じharnessへ通し、negative controlが実際に失敗状態を観測できることも検査する。

明示GCを取得するためにV8 flagを一時変更する場合は、collector取得直後に`finally`で元のdisabled状態へ戻し、新しいVM contextに`gc`が残らないことを検査する。
I-Lはtest harnessのprocess-global stateをsuccess、failure、test failureのいずれでも残さない。

I-CとI-Lの両方が完了した時点だけをsource profile integration completionとする。
この追加分割はcounter、hook順序、failure、read-only boundary、package publication、public APIを変更しない。

#### bounded canonical measurement の実装分割

canonical identity workはhostile-input boundaryからさらに分ける。
ID01-CB、SC02A8I、SC02A13を同じproduction revisionへ含めない。

| revision | owner | 独立した検証 |
| --- | --- | --- |
| ID01-CB | byte-identicalなiterative canonical builder | existing vectors、depth、cycle/alias、instrumented sort/work bound |
| SC02A8I | full outputを作らないexact byte/work meter | ID01 byte oracle、work/byte exact/limit+1、alias occurrence |
| SC02A13 | canonicalizeとdigestのintegration | canonicalize exact once、digest exact once、failure時zero call |

上表の`SC02A8I` combined revisionは、次の追加分割によってsupersedeする。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| SC02A8I-T | canonical outputを生成しないiterative measurement traversalとevent contract | ID01-CB | scalar/container/canonical-key event、iterative depth、cycle/alias occurrence、property insertion permutation、path一致 |
| SC02A8I-B | T eventからのexact UTF-8 canonical byte measurement | SC02A8I-T | ID01 byte oracle、Unicode/number/escape/key punctuation、key order/permutation、exact/limit+1 |
| SC02A8I-W | T eventからのcanonical work upper-bound measurement | SC02A8I-T | comparison/move/common-prefix bound、key permutation、saturating arithmetic、exact/limit+1 |
| SC02A8I-R | byte/workを同じoperation-local ledgerへ予約するintegration | SC02A8I-B、A8I-W、SC02A8A | meter分とdownstream builder分の二重予約、failure時zero canonicalize/digest call |

SC02A8I-BとSC02A8I-Wは同じT event contractだけへ依存し、disjoint module/testとして並列reviewできる。
SC02A8I-Rまで完了してもcanonical text生成とdigestはSC02A13のownerに残る。

追加分割sliceの排他的focused write setを次に固定する。

| revision | production path | focused test path | type fixture path |
| --- | --- | --- | --- |
| SC02A8D-P | `executionContract/occurrencePlan.ts` | `executionContract/occurrencePlan.test.ts` | `executionContract/occurrencePlan.type-fixture.ts` |
| SC02A8D-W | `executionContract/closedDataWalker.ts` | `executionContract/closedDataWalker.test.ts` | `executionContract/closedDataWalker.type-fixture.ts` |
| SC02A8E-C | `executionContract/sourceCollectionProfile.ts` | `executionContract/sourceCollectionProfile.test.ts` | N/A。runtime hookだけを所有する |
| SC02A8E-R | `executionContract/sourceReferenceProfile.ts` | `executionContract/sourceReferenceProfile.test.ts` | N/A。runtime hookだけを所有する |
| SC02A8E-P | `executionContract/semanticPathProfile.ts` | `executionContract/semanticPathProfile.test.ts` | N/A。runtime hookだけを所有する |
| SC02A8E-I-C | `executionContract/sourceProfile.ts` | `executionContract/sourceProfile.test.ts` | `executionContract/sourceProfile.type-fixture.ts` |
| SC02A8E-I-L | N/A。test-only lifetime evidence | `executionContract/sourceProfileLifetime.test.ts` | N/A。runtime APIを追加しない |
| SC02A8I-T | `executionContract/canonicalMeasurementTraversal.ts` | `executionContract/canonicalMeasurementTraversal.test.ts` | `executionContract/canonicalMeasurementTraversal.type-fixture.ts` |
| SC02A8I-B | `executionContract/canonicalByteMeasurement.ts` | `executionContract/canonicalByteMeasurement.test.ts` | N/A。T event consumerだけを所有する |
| SC02A8I-W | `executionContract/canonicalWorkMeasurement.ts` | `executionContract/canonicalWorkMeasurement.test.ts` | N/A。T event consumerだけを所有する |
| SC02A8I-R | `executionContract/canonicalMeasurement.ts` | `executionContract/canonicalMeasurement.test.ts` | `executionContract/canonicalMeasurement.type-fixture.ts` |

この表のpathはslice間で共有しない。
`executionContract/SPEC.typ`、`executionContract/implementation.test.ts`、package facade、shared rootはmain integration ownerが一sliceずつ逐次更新する。

ID01-CBはnative `.sort()`をraw UTF-16 comparatorのiterative stable merge sortへ置き換え、recursive string compositionをiterative frame/chunk builderへ置き換える。
public `canonicalizeJson()`のsignature、error、path、prototype/descriptor rule、cycle/alias semantics、text、bytesを変更しない。

record property countを`p`、最大key長を`m`、`levels = ceil(log2(max(1, p)))`とする。
comparison countは`p * levels`以下、一comparisonのUTF-16 scanは`2 * m + 1`以下、moveは`2 * p * levels`以下とする。
`sortWorkBound = p * levels * (2 * m + 1) + 2 * p * levels`をrecordごとのworst-case upper boundとする。
long common-prefix keyをscan boundへ含め、A8Iは全乗算と加算をremaining limit + 1へsaturateしてsafe integer overflow前に停止する。

ID01-CB自体はbudget引数またはpublic APIを追加しない。
standalone `canonicalizeJson()`のmemoryはactive path上のproperty occurrenceに対する`O(P)`だけを主張する。
A8I/A13のadmitted snapshotでは、active-path key/scratch entryをproperty capの定数倍に制限し、two-buffer merge sortは`2 * maximumInputProperties`以下とする。

SC02A8Iはfull canonical textまたはencoded bytesを生成しない。
traversal frame、current/ancestor recordのkey state、counter、numberごとの`JSON.stringify`結果だけを一時allocationとして使う。
stringとproperty keyはraw UTF-16をscanし、lone surrogate、JSON escape、UTF-8 byte lengthをID01と同じ規則で処理する。
numberはfiniteかつnegative zeroでない値だけを受理する。

`linearWork`はdata node occurrence、property occurrence、array slot occurrence、string code unitの合計とする。
meterは各linear workを実行直前に課金し、recordではsort開始前にそのrecordの`sortWorkBound`全量を課金する。
snapshot全体の未測定workをmeter開始前に知っているとは仮定しない。

exact byte countをfull output生成前に`maximumCanonicalBytes`へ課金する。
meter完了後、実測した同じ`linearWork + sortWork`をdownstream `canonicalizeJson()`分として追加予約する。
追加予約が失敗した場合はcanonical text、encoded bytes、digestを生成しない。

A12 snapshotはcaller aliasを保持しないが、framework-owned aliasの不在までは保証しない。
A8IとID01-CBはactive ancestorだけをcycleとし、leave後に再出現するshared aliasをvisited setでdedupしない。
aliasはpath occurrenceごとにbyte、linear work、sort workを再測定、再課金、再serializeする。

「allocation-free」はmeter自身がfull canonical textまたはbyte arrayを作らない意味に限定する。
A13のbounded output allocation、`join`中のchunks/text共存、WebCrypto内部copy、GC時期まで存在しないとは主張しない。
frameworkは不要になったfull-payload referenceをphaseごとに解放し、hostとGCを含むresident storageは実装依存の定数倍`O(maximumCanonicalBytes)`とする。

A13は同じoperation-local ledgerをresetせず、A12のexact snapshotへ`canonicalizeJson()`を一回呼び、その返却bytesを`sha256Digest()`へ一回渡す。
再canonicalizeまたは再encodeしない。

ID01-CB fixtureはproperty countが2の冪の直前、exact、直後であるrecord、最大長common-prefix、shared alias、cycleを含める。
A8I fixtureはUnicode、escape、number boundary、negative zero、property insertion permutation、nested record/array、sibling record/array aliasについて、meter byte lengthと`canonicalizeJson(value).bytes.byteLength`を比較する。
active-path scratchの合計peakとalias occurrenceごとのexact二重課金も検査する。

meterとdownstream builderを二重計上したdefault `maximumCanonicalWorkSteps`の実用上限はA8I implementation admissionでbenchmarkまたはprobeする。
cap変更が必要なら別design revisionへ戻し、実装都合で暗黙に緩和しない。

realm provenanceを推定する案、aliasをglobal visited setでdedupする案、meterだけをboundedにしてdownstream native sort/recursive builderを残す案、canonical byte capだけでCPU workを代用する案は採用しない。

`ExecutionContractError` は immutable な path と stable code を持つ。
code は `invalid-closed-record`、`invalid-field`、`invalid-fact-id`、`invalid-registry-id`、`noncanonical-order`、`duplicate-record`、`dangling-reference`、`kind-mismatch`、`version-mismatch`、`semantic-mismatch`、`budget-exceeded`、`crypto-unavailable` とする。
SC01 と ID01 の failure は current field prefix を付けてこの error へ変換し、別 error class を public operation から漏らさない。
