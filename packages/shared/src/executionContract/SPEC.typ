= source execution contract identity, subject, fact, relation, export, registry, envelope, and budget model

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

source execution contractが、qualification前のfactを一つのcontract内で参照するためのlocal identity、stable failure、source-local subjectとvalue path、closed fact schema、未信頼なsource envelopeを提供する。

SC02A1は`FactId`、`factId()`、`ExecutionContractError`だけをpackage-local facadeから公開する。

SC02A2はsemantic subjectとpath segmentをtype-only modelとして追加する。

SC02A3はsemantic factとtransfer bindingをtype-only modelとして追加する。

SC02A4はsemantic relationをtype-only modelとして追加する。

SC02A5はmodule exportごとのexecution summaryをtype-only modelとして追加する。

SC02A6は10種類のregistry source collectionをtype-only modelとして追加する。

SC02A7はSC02A1からSC02A6のtypeを束ねる未信頼なsource envelopeをtype-only modelとして追加する。

SC02A8Aは15種類のframework hard capを狭めるbudget contractと、一つのoperation内だけで使用するinternal ledgerを追加する。

unknown input preflight、strict parser、closure、creator、freeze、digestは後続の独立review unitが追加する。

== 設計判断

#adr(
  header("source-local fact identityをqualified identityから分離する", Status.Accepted, "2026-07-12"),
  [
    source declarationの短いIDとmodule namespaceでqualifiedされたIDを同じ型にすると、qualification前のclaimがcompiler evidenceとして使われても型で検出できない。
  ],
  [
    `FactId`は一つのsource contract内だけで意味を持つbranded stringとする。
    `factId()`はnon-emptyなvalid Unicode stringをnormalizationせずに受理する。
    qualified ID、compiled contract、accepted evidenceは後続sliceだけが定義する。
  ],
  [
    - digestの形を持つ文字列もsource-local IDとして扱う
    - provenanceやtrustを文字列形状から推測しない
    - SCC namespaceによるqualificationはSC03だけが行う
  ],
)

#adr(
  header("source contract failureをimmutableなcodeとpathで表す", Status.Accepted, "2026-07-12"),
  [
    parser、closure validator、digestが異なるerror shapeを送出すると、compiler diagnosticが失敗位置と分類を安定して扱えない。
  ],
  [
    source contract operationは`ExecutionContractError`を共通failureとする。
    error codeはclosed union、pathはrootからのpropertyまたはarray indexのimmutable snapshotとする。
    error自身もfreezeし、送出後に分類やpathを書き換えられないようにする。
  ],
  [
    - SC02A1は後続operationが使う全stable codeを先に固定する
    - nested parserは同じerrorへfield prefixを追加する
    - package-local facadeはinternalな`fail()` helperを公開しない
  ],
)

#adr(
  header("semantic factをattributeだけのclosed unionとして固定する", Status.Accepted, "2026-07-12"),
  [
    behavioral edgeをfact fieldとrelationの両方で表すと、二つの表現が矛盾し、どちらを正本として扱うかを一意に決められない。
    registry referenceをkindなしのstringで表すと、異なるregistry domainのIDを取り違えてもtype boundaryで検出できない。
  ],
  [
    source-local `SemanticFact`は`schema`、`FactId`、`SemanticSubject`を共有する16種類のclosed discriminated unionとする。
    read、write、effect、ownership、orderingはattributeだけを保持し、behavioral cross-fact edgeを保持しない。
    `TransferBinding`は6種類のclosed unionとし、registry referenceにはkind付きのsource-local `RegistryId`を使う。
  ],
  [
    - source-local factは構造を表す未信頼claimであり、module signatureとの一致やtrust acceptanceを証明しない
    - behavioral relation、closure、strict parserは後続review unitが定義する
    - SC02A3はruntime valueを追加しない
  ],
)

#adr(
  header("behavioral cross-fact edgeをSemanticRelationへ一元化する", Status.Accepted, "2026-07-12"),
  [
    fact fieldとrelationが同じbehavioral dependencyを表すと、二つの表現が矛盾し、どちらを正本として扱うかを一意に決められない。
  ],
  [
    reads、writes、invokes、returns、owns、orders-before、transfers-as、fails-withはsource-local `SemanticRelation`だけに保持する。
    endpointはsource-local `FactId`とexpected fact kind tagを保持する。
    `orders-before`だけがrequiredな`ordinal: number | null`を持つ。
  ],
  [
    - endpointが参照するfactの実在、tagとの一致、subject constraintは後続SC02A local closureが検証する
    - ownership cardinality、ownership DAG、ordering ordinal semanticsは後続SC02A local closureが検証する
    - SC02A4はruntime value、parser、validator、closureを追加しない
  ],
)

#adr(
  header("export summaryの構造claimをclosure validationから分離する", Status.Accepted, "2026-07-12"),
  [
    module exportのsummary型へfact、registry、callable、transferの整合性検証まで埋め込むと、source envelopeとindexが存在しない段階では単独で検証できず、構造claimとvalidation済みcontractの境界も曖昧になる。
  ],
  [
    `ExportExecutionContract`はfact ID、callable form、receiver brand、value domain、transfer bindingだけを保持する未信頼なsource-local structural claimとする。
    factとregistryの実在、direct fieldとの整合、canonical order、export closureは後続SC02A operationだけが検証する。
  ],
  [
    - SC02A5はparser、validator、source envelope、registry aggregate、digestを追加しない
    - qualified、compiled、accepted contractは後続sliceだけが定義する
    - typeへの適合だけではmodule exportの実在、trust acceptance、client exclusionを証明しない
  ],
)

#adr(
  header("registry source collectionをkindごとのexact mappingとして固定する", Status.Accepted, "2026-07-13"),
  [
    source contractがkindなしのregistry entry collectionを共有すると、異なるregistry domainのentryを誤ったcollectionへ配置してもtype boundaryで検出できない。
    aggregateへparserやcanonical semanticsを埋め込むと、source shapeと後続validation operationの責務が混在する。
  ],
  [
    `ExecutionContractRegistrySources`は10個のrequired readonly fieldを持ち、各fieldを対応する`RegistrySourceEntry<Kind>`のreadonly arrayへexactに対応付ける。
    このmodelは未信頼なsource-local structural claimだけを表し、runtime operationまたはcollection semanticsを追加しない。
  ],
  [
    - SC01の`RegistrySourceEntry`を再利用し、entry shapeやregistry kind taxonomyを複製しない
    - non-empty、order、duplicate、registry closureは後続SC02A operationだけが検証する
    - SC02A6はsource envelope、parser、validator、freeze、digestを追加しない
  ],
)

#adr(
  header("source envelopeを未信頼な構造集約として分離する", Status.Accepted, "2026-07-13"),
  [
    source envelopeの型へversion検査、duplicate排除、reference closure、canonical orderを含めると、source-local author inputとvalidation済みsnapshotの境界が型だけでは区別できなくなる。
    parserやcreatorを同時に追加すると、8 fieldのcomposition contractと後続operationの責務を独立して検査できない。
  ],
  [
    `ExecutionContractSourceInput`はSC02A1からSC02A6のtypeをexactに8個のrequired readonly fieldへ束ねる。
    `ExecutionContractSource`はbrandを加えず`ExecutionContractSourceInput`と同一のaliasとし、未信頼なsource-local structural claimだけを表す。
  ],
  [
    - empty ID、任意version、empty collection、duplicate、dangling reference、closure不整合はこの型だけでは拒否しない
    - SC02A8からSC02A13がdescriptor preflight、budget、strict parse、canonical order、duplicate rule、closure、creator、freeze、digestを所有する
    - qualified、compiled、accepted、trust、authority、root publicationはこのsliceで追加しない
    - SC02A7はruntime operation、runtime value、browser behaviorを追加しない
  ],
)

#adr(
  header("budget contractとoperation-local ledgerをhostile data traversalから分離する", Status.Accepted, "2026-07-13"),
  [
    budget validation、descriptor capture、cycle detection、source profile、clone、freeze、canonical measurementを一つのrevisionへ含めると、独立してgreenにできるruntime責務が結合し、failure時のcounter semanticsと公開境界を単独で検査できない。
  ],
  [
    `ExecutionContractBudget`は15個のoptional readonly fieldだけを持つnarrow-only overrideとする。
    internal ledgerはdepth以外をoverflow-safeなcumulative total、depthを1-based active depthのpeakとして扱い、一つのpublic operation内でresetしない。
    SC02A8Aはbudget record validationとledgerだけを所有し、descriptor以降のhostile data traversalを後続revisionへ残す。
  ],
  [
    - package-local facadeへ追加するsurfaceはtype-only `ExecutionContractBudget`だけとする
    - ledger、factory、counter type、default hard capはinternal moduleだけに保持する
    - shared root、generated root declaration、runtime facadeへbudget runtime valueを公開しない
    - descriptor、profile、clone、freeze、meter、parser、public source operationを追加しない
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Source-local fact identity",
  summary: [
    source contract内だけで有効なfact identifierを作成する。
  ],
  format: [
    ```typescript
    type FactId = string & FactIdBrand

    function factId(value: string): FactId
    ```
  ],
  constraints: [
    - `factId()`はempty stringとlone surrogateを`invalid-fact-id`で拒否する
    - Unicode normalizationを行わず、受け取ったcode-unit sequenceを保持する
    - valid surrogate pairは受理する
    - raw stringを`FactId`へ暗黙代入できない
  ],
)

#interface_spec(
  name: "Stable execution contract failure",
  summary: [
    source contract operationの失敗分類とroot-relative pathをimmutableなerrorとして表す。
  ],
  format: [
    ```typescript
    type ExecutionContractErrorCode =
      | "invalid-closed-record"
      | "invalid-field"
      | "invalid-fact-id"
      | "invalid-registry-id"
      | "noncanonical-order"
      | "duplicate-record"
      | "dangling-reference"
      | "kind-mismatch"
      | "version-mismatch"
      | "semantic-mismatch"
      | "budget-exceeded"
      | "crypto-unavailable"

    class ExecutionContractError extends TypeError {
      readonly code: ExecutionContractErrorCode
      readonly path: readonly (string | number)[]
    }
    ```
  ],
  constraints: [
    - constructorはcaller pathをcopyしてからfreezeする
    - error object自身をfreezeする
    - helperが生成するmessageはrootを`$`としてpathを含む
    - facadeのruntime value exportは`ExecutionContractError`と`factId`だけとする
  ],
)

#interface_spec(
  name: "Semantic subject and path model",
  summary: [
    semantic factの対象を7種類のclosed discriminated union、nested value pathを3種類のsequence elementで表す。
  ],
  format: [
    ```typescript
    type SemanticPathSegment =
      | { readonly kind: "property"; readonly key: string }
      | { readonly kind: "tuple-index"; readonly index: number }
      | { readonly kind: "element" }

    type SemanticSubject =
      | { readonly kind: "module-evaluation" }
      | { readonly kind: "export-value"; readonly exportName: string }
      | { readonly kind: "receiver"; readonly exportName: string }
      | { readonly kind: "parameter"; readonly exportName: string; readonly index: number; readonly path: readonly SemanticPathSegment[] }
      | { readonly kind: "return"; readonly exportName: string; readonly path: readonly SemanticPathSegment[] }
      | { readonly kind: "callback-invocation"; readonly exportName: string; readonly parameterIndex: number; readonly path: readonly SemanticPathSegment[] }
      | { readonly kind: "allocated-resource"; readonly exportName: string; readonly allocationSiteId: string }
    ```
  ],
  constraints: [
    - pathはsetではなくsequenceであり、同じsegmentを複数回含めることができる
    - callback pathのrootは`parameterIndex`で選んだtop-level parameter valueとする
    - top-level parameter自体がcallback slotなら空path、nested callback slotなら`property`、`tuple-index`、`element`を順に並べたrequired pathで表す
    - `element`はhomogeneous collectionに共通する静的element domainであり、個々のruntime elementやcallback occurrenceを識別しない
    - callback subject identityはruntime function instanceではなく、source-localな静的semantic locationに対して一意とする
    - subjectは未信頼なsource-local location claimであり、型への適合は実module signatureとの一致を証明しない
    - 後続SC02A strict parserはindex、path segment scalar、closed structural ruleを検証する
    - SC03はcompiler-ownedでpath traversal可能なmodule signatureまたはsource-analysis evidenceを使い、export、parameter、callback path、callable location、allocation siteの実在を検証する
    - SC03 evidenceのschemaと生成はSC03の先行review unitが定義し、evidenceがないclaimはfallbackせずdiagnosticにする
    - fact kind、behavioral relation、trust acceptanceをこのmodelへ埋め込まない
  ],
)

#interface_spec(
  name: "Source-local transfer binding",
  summary: [
    valueのtransfer mechanismと必要なsource-local registry referenceを6種類のclosed discriminated unionで表す。
  ],
  format: [
    ```typescript
    type TransferBinding =
      | { readonly kind: "none" }
      | { readonly kind: "snapshot" }
      | {
          readonly kind: "codec"
          readonly codecId: RegistryId<"codec">
          readonly version: string
        }
      | {
          readonly kind: "reference"
          readonly resolverId: RegistryId<"resolver">
          readonly version: string
          readonly capabilityPolicyId: RegistryId<"policy">
        }
      | {
          readonly kind: "subscription"
          readonly sourceId: RegistryId<"subscription-source">
          readonly version: string
        }
      | {
          readonly kind: "remote"
          readonly operationId: RegistryId<"remote-operation">
          readonly version: string
        }
    ```
  ],
  constraints: [
    - `none`と`snapshot`は`kind`以外のfieldを持たない
    - `codec`、`reference`、`subscription`、`remote`はrequiredな`version`を持つ
    - registry IDはqualification前のsource-local `RegistryId`であり、kindごとのbrandを保持する
    - `reference`のcapability policyは`RegistryId<"policy">`であり、resolver IDと同じdomainとして扱わない
    - parserによるversion文字列とclosed structural ruleの検証は後続review unitが定義する
  ],
)

#interface_spec(
  name: "Closed source-local semantic fact model",
  summary: [
    source-local semantic claimを共通baseと16種類のattribute-only variantで表す。
  ],
  format: [
    ```typescript
    type SemanticFactKind =
      | "environment"
      | "read"
      | "write"
      | "effect"
      | "invocation"
      | "identity"
      | "ownership"
      | "ordering"
      | "failure"
      | "cancellation"
      | "lifetime"
      | "transfer"
      | "exposure"
      | "integrity"
      | "dependency-epoch"
      | "trust-boundary"

    interface FactBase {
      readonly schema: "dathra.fact/1"
      readonly id: FactId
      readonly subject: SemanticSubject
    }

    type SemanticFact = FactBase & (
      | {
          readonly kind: "environment"
          readonly environments: readonly ExecutionEnvironment[]
          readonly hostProfileIds: readonly RegistryId<"host-profile">[]
        }
      | {
          readonly kind: "read"
          readonly stability: "immutable" | "stable-within-token" | "may-change"
          readonly consistency: "none" | "snapshot-token" | "linearizable-authority"
          readonly replay: {
            readonly duplicate: boolean
            readonly reorder: boolean
            readonly recompute: boolean
          }
          readonly environmentFactId: FactId
          readonly exposureFactId: FactId
        }
      | {
          readonly kind: "write"
          readonly environmentFactId: FactId
          readonly exposureFactId: FactId
        }
      | {
          readonly kind: "effect"
          readonly retainsCallbacks: boolean
          readonly reentrant: boolean
          readonly schedulesWork: boolean
          readonly allocatesResource: boolean
        }
      | {
          readonly kind: "invocation"
          readonly callable: "call" | "construct" | "call-and-construct"
          readonly boundary: "sync" | "async"
          readonly callbackParameterIndexes: readonly number[]
          readonly retainsCallbacks: boolean
          readonly reentrant: boolean
          readonly receiverBrandId: RegistryId<"brand"> | null
        }
      | {
          readonly kind: "identity"
          readonly scope: "none" | "realm" | "module" | "instance"
          readonly brandId: RegistryId<"brand"> | null
        }
      | {
          readonly kind: "ownership"
          readonly retention: "owned" | "leased" | "borrowed" | "environment-permanent"
        }
      | {
          readonly kind: "ordering"
          readonly relation: "before" | "serial" | "exclusive" | "commutative"
        }
      | {
          readonly kind: "failure"
          readonly channel: "typed-result" | "throw" | "reject" | "abort"
          readonly schemaId: RegistryId<"failure-schema">
        }
      | {
          readonly kind: "cancellation"
          readonly point: "before-start" | "before-commit" | "best-effort-after-commit"
          readonly propagation: "owned-descendants" | "explicit-edges"
        }
      | {
          readonly kind: "lifetime"
          readonly domain: "call" | "request" | "generation" | "owner" | "realm" | "process"
          readonly cleanup: "none" | "sync" | "async"
        }
      | {
          readonly kind: "transfer"
          readonly binding: TransferBinding
        }
      | {
          readonly kind: "exposure"
          readonly audiencePolicyId: RegistryId<"policy">
          readonly sinkPolicyIds: readonly RegistryId<"policy">[]
          readonly releasePolicyId: RegistryId<"policy"> | null
        }
      | {
          readonly kind: "integrity"
          readonly source: "compiler" | "signed-manifest" | "validated-input" | "untrusted"
          readonly endorsementPolicyId: RegistryId<"policy"> | null
        }
      | {
          readonly kind: "dependency-epoch"
          readonly epochId: string
          readonly invalidation: "content-addressed" | "host-supplied" | "explicit"
        }
      | {
          readonly kind: "trust-boundary"
          readonly enforcement: "worker" | "sandbox" | "compartment" | "host-process"
          readonly capabilityPolicyIds: readonly RegistryId<"policy">[]
        }
    )
    ```
  ],
  constraints: [
    - すべてのvariantはexactに`schema`、`id`、`subject`と各variant固有fieldを持つ
    - `schema`は`"dathra.fact/1"`、`id`はsource-local `FactId`、`subject`はSC02A2の`SemanticSubject`とする
    - callback subjectはrequiredなparameter-local `path`を含む現行shapeをそのまま使う
    - readとwriteは`environmentFactId`と`exposureFactId`だけをfact attribute referenceとして保持する
    - effectは`retainsCallbacks`、`reentrant`、`schedulesWork`、`allocatesResource`だけを固有fieldとして持つ
    - ownershipは`retention`だけ、orderingは`relation`だけを固有fieldとして持つ
    - read、write、effect、ownership、orderingはbehavioral relationやmemberを表すfieldを持たない
    - `SemanticFactKind`、`TransferBinding`、`SemanticFact`だけをfact modelからpackage-local facadeへtype-only exportする
    - individual fact interfaceとhelper aliasをpackage-local facadeへexportしない
    - registry aggregate、source envelope、parser、validator、closure、digest、qualified、compiled、accepted APIを追加しない
    - package rootへ公開せず、shared rootへの公開はAS01が所有し、facadeのruntime valueは`ExecutionContractError`と`factId`だけとする
  ],
)

#interface_spec(
  name: "Closed source-local semantic relation model",
  summary: [
    behavioral cross-fact edgeを8種類のsource-local typed relation unionで表す。
  ],
  format: [
    ```typescript
    type SemanticRelationKind =
      | "reads"
      | "writes"
      | "invokes"
      | "returns"
      | "owns"
      | "orders-before"
      | "transfers-as"
      | "fails-with"

    type FactEndpoint<Kind extends SemanticFactKind> = {
      readonly factId: FactId
      readonly factKind: Kind
    }

    type SemanticRelation = { readonly schema: "dathra.relation/1" } & (
      | {
          readonly kind: "reads"
          readonly from: FactEndpoint<"effect" | "invocation">
          readonly to: FactEndpoint<"read">
        }
      | {
          readonly kind: "writes"
          readonly from: FactEndpoint<"effect" | "invocation">
          readonly to: FactEndpoint<"write">
        }
      | {
          readonly kind: "invokes"
          readonly from: FactEndpoint<"effect" | "invocation">
          readonly to: FactEndpoint<"invocation">
        }
      | {
          readonly kind: "returns"
          readonly from: FactEndpoint<"invocation">
          readonly to: FactEndpoint<SemanticFactKind>
        }
      | {
          readonly kind: "owns"
          readonly from: FactEndpoint<"ownership">
          readonly to: FactEndpoint<"identity" | "ownership" | "lifetime">
        }
      | {
          readonly kind: "orders-before"
          readonly from: FactEndpoint<"ordering">
          readonly to: FactEndpoint<SemanticFactKind>
          readonly ordinal: number | null
        }
      | {
          readonly kind: "transfers-as"
          readonly from: FactEndpoint<Exclude<SemanticFactKind, "transfer">>
          readonly to: FactEndpoint<"transfer">
        }
      | {
          readonly kind: "fails-with"
          readonly from: FactEndpoint<"effect" | "invocation">
          readonly to: FactEndpoint<"failure">
        }
    )
    ```
  ],
  constraints: [
    - endpointはexactに`factId: FactId`と`factKind`を持ち、subjectを複製しない
    - readsはeffectまたはinvocationからreadへ向かう
    - writesはeffectまたはinvocationからwriteへ向かう
    - invokesはeffectまたはinvocationからinvocationへ向かう
    - returnsはinvocationから任意のfact kindへ向かう
    - ownsはownershipからidentity、ownership、lifetimeのいずれかへ向かう
    - orders-beforeはorderingから任意のfact kindへ向かい、requiredな`ordinal: number | null`を持つ
    - transfers-asはtransfer以外のfact kindからtransferへ向かう
    - fails-withはeffectまたはinvocationからfailureへ向かう
    - orders-before以外の7 variantは`ordinal` keyを持たず、`ordinal: undefined`も受理しない
    - active subjectはmodule-evaluation、export-value、receiver、callback-invocation、allocated-resourceとする
    - callable subjectはexport-value、receiver、parameter、return、callback-invocation、allocated-resourceとする
    - value subjectはexport-value、receiver、parameter、return、allocated-resourceとする
    - readsとwritesのsourceはactiveまたはcallable subject、targetはmodule-evaluationまたはvalue subjectとする
    - invokesのsourceはactiveまたはcallable subject、targetはcallable subjectとする
    - returnsのsourceはcallable subject、targetは同じexportNameのreturn subjectとする
    - ownsとorders-beforeは上記fact-kind constraint内の任意subjectを結ぶ。ただしownsのlifetime targetはsource ownershipとexactに同じsubjectとする
    - transfers-asはvalue subjectからexactに同じsubjectへ向かい、fails-withはactiveまたはcallable subjectからexactに同じsubjectへ向かう
    - endpointのfact実在、異なるFactId、factKind tag、subject pairは後続SC02A local closureが検証する
    - ownership cardinality、ownership DAG、ordering fact別のordinal制約は後続SC02A local closureが検証する
    - `SemanticRelationKind`、`FactEndpoint`、`SemanticRelation`だけをrelation modelからpackage-local facadeへtype-only exportする
    - individual relation interfaceとhelper aliasをrelation modelまたはpackage-local facadeからexportしない
    - parser、validator、closure、normalizer、source envelope、digest、qualified、compiled、accepted APIを追加しない
    - package rootへ公開せず、shared rootへの公開はAS01が所有し、facadeへruntime valueまたはruntime import edgeを追加しない
  ],
)

#interface_spec(
  name: "Source-local export execution summary",
  summary: [
    module export一件に紐づくfact参照とdirect execution summaryを一つのclosed structural claimで表す。
  ],
  format: [
    ```typescript
    interface ExportExecutionContract {
      readonly factIds: readonly FactId[]
      readonly callable: "none" | "call" | "construct" | "call-and-construct"
      readonly receiverBrandId: RegistryId<"brand"> | null
      readonly valueDomainId: RegistryId<"value-domain">
      readonly transfer: TransferBinding
    }
    ```
  ],
  constraints: [
    - exactに`factIds`、`callable`、`receiverBrandId`、`valueDomainId`、`transfer`の5 fieldをrequiredかつreadonlyで持つ
    - `factIds`はsource-local `FactId`のreadonly sequenceであり、このsliceではfactの実在、export subjectとの一致、set uniqueness、canonical orderを証明しない
    - `callable`は`none`、`call`、`construct`、`call-and-construct`のclosed unionとする
    - `receiverBrandId`は`RegistryId<"brand"> | null`、`valueDomainId`はrequiredな`RegistryId<"value-domain">`とし、registry kindを相互代入できない
    - `transfer`はSC02A3の`TransferBinding`をそのまま保持する
    - callable、receiver brand、transfer factの整合性とregistry closureは後続SC02A source closureが検証する
    - `ExportExecutionContract`だけをexport modelからpackage-local facadeへtype-only exportし、callable helper aliasを公開しない
    - parser、validator、normalizer、source envelope、registry aggregate、digest、qualified、compiled、accepted APIを追加しない
    - package rootへ公開せず、shared rootへの公開はAS01が所有し、facadeへruntime valueまたはruntime import edgeを追加しない
  ],
)

#interface_spec(
  name: "Source-local registry source collections",
  summary: [
    source contractが参照する10種類のregistry declaration collectionをkind-safeな一つのstructural claimで表す。
  ],
  format: [
    ```typescript
    interface ExecutionContractRegistrySources {
      readonly codecs: readonly RegistrySourceEntry<"codec">[]
      readonly resolvers: readonly RegistrySourceEntry<"resolver">[]
      readonly remoteOperations: readonly RegistrySourceEntry<"remote-operation">[]
      readonly remoteDeliveryAdapters: readonly RegistrySourceEntry<"remote-delivery-adapter">[]
      readonly subscriptionSources: readonly RegistrySourceEntry<"subscription-source">[]
      readonly brands: readonly RegistrySourceEntry<"brand">[]
      readonly valueDomains: readonly RegistrySourceEntry<"value-domain">[]
      readonly policies: readonly RegistrySourceEntry<"policy">[]
      readonly hostProfiles: readonly RegistrySourceEntry<"host-profile">[]
      readonly failureSchemas: readonly RegistrySourceEntry<"failure-schema">[]
    }
    ```
  ],
  constraints: [
    - exactに`codecs`、`resolvers`、`remoteOperations`、`remoteDeliveryAdapters`、`subscriptionSources`、`brands`、`valueDomains`、`policies`、`hostProfiles`、`failureSchemas`の10 fieldをrequiredかつreadonlyで持つ
    - 各fieldは対応するregistry kindの`RegistrySourceEntry`だけを要素に持つreadonly arrayとし、異なるkindのentryを相互代入できない
    - collectionはemptyを許容し、このsliceではnon-empty、canonical order、duplicate、entry closureを証明しない
    - SC01の`RegistrySourceEntry` typeを直接importし、entry shape、registry kind、helper aliasを複製しない
    - `ExecutionContractRegistrySources`だけをregistry source modelからpackage-local facadeへtype-only exportする
    - runtime parser、validator、envelope、operation、freezeを追加せず、runtime valueまたはruntime import edgeを生成しない
    - package rootへ公開せず、shared rootへの公開はAS01が所有する
  ],
)

#interface_spec(
  name: "Untrusted source execution contract envelope",
  summary: [
    source-local fact、relation、export summary、registry source collection、host assumptionを一つの未信頼なstructural claimへ束ねる。
  ],
  format: [
    ```typescript
    interface ExecutionContractSourceInput {
      readonly schema: "dathra.execution/1"
      readonly id: string
      readonly version: string
      readonly facts: readonly SemanticFact[]
      readonly relations: readonly SemanticRelation[]
      readonly exports: Readonly<Record<string, ExportExecutionContract>>
      readonly registries: ExecutionContractRegistrySources
      readonly hostAssumptionFactIds: readonly FactId[]
    }

    type ExecutionContractSource = ExecutionContractSourceInput
    ```
  ],
  constraints: [
    - exactに`schema`、`id`、`version`、`facts`、`relations`、`exports`、`registries`、`hostAssumptionFactIds`の8 fieldをrequiredかつreadonlyで持つ
    - `schema`はexactに`"dathra.execution/1"`とし、`id`と`version`はexactに`string`としてnullableにしない
    - `facts`、`relations`、`hostAssumptionFactIds`はそれぞれ`SemanticFact`、`SemanticRelation`、`FactId`のreadonly arrayとする
    - `exports`は`Readonly<Record<string, ExportExecutionContract>>`、`registries`は`ExecutionContractRegistrySources`をそのまま再利用する
    - `ExecutionContractSource`と`ExecutionContractSourceInput`は同一typeであり、validated、canonical、qualified、compiled、accepted、trusted、authoritativeであることを示すbrandを持たない
    - empty ID、invalid version、empty collection、duplicate、dangling reference、fact kind mismatch、export closure、registry closure、host assumption closureを型への適合だけでは拒否または証明しない
    - source modelは`ExecutionContractSourceInput`と`ExecutionContractSource`だけをexportし、package-local facadeはこの2 typeだけをtype-only exportする
    - parser、validator、budget、descriptor preflight、canonical order、duplicate rule、closure、creator、freeze、digest、identityを追加せず、runtime codeまたはruntime import edgeを生成しない
    - package rootへ公開せず、shared rootへの公開はAS01が所有し、runtime operation、runtime value、browser behaviorを追加しない
  ],
)

#interface_spec(
  name: "Source execution contract budget override",
  summary: [
    source execution contract operationが共有するframework hard capをcallerが狭めるためのtype-only contractを提供する。
  ],
  format: [
    ```typescript
    interface ExecutionContractBudget {
      readonly maximumInputDepth?: number
      readonly maximumInputDataNodes?: number
      readonly maximumInputProperties?: number
      readonly maximumInputArrayLength?: number
      readonly maximumInputStringCodeUnits?: number
      readonly maximumFacts?: number
      readonly maximumRelations?: number
      readonly maximumExports?: number
      readonly maximumRegistryEntries?: number
      readonly maximumRegistryImplementations?: number
      readonly maximumReferences?: number
      readonly maximumSemanticPathSegments?: number
      readonly maximumCanonicalBytes?: number
      readonly maximumCanonicalWorkSteps?: number
      readonly maximumValidationSteps?: number
    }
    ```
  ],
  constraints: [
    - exactに上記15 fieldだけをoptionalかつreadonlyで持ち、各present valueはnumberとする
    - default hard capは順に64、200,000、1,000,000、200,000、20,000,000、200,000、200,000、200,000、200,000、400,000、10,000,000、2,000,000、200,000,000、20,000,000、20,000,000とする
    - runtime overrideは`undefined`、current `Object.prototype`を持つrecord、またはnull-prototype recordだけを受理する
    - present valueは0以上、対応するdefault hard cap以下のsafe integerとする
    - extra string field、symbol、hidden property、accessorを拒否する
    - budget argument全体のfailure pathは`["budget"]`、field failure pathは`["budget", field]`とする
    - package-local facadeへ`ExecutionContractBudget`だけをtype-only exportする
    - ledger、factory、counter type、default hard capをruntime facadeまたはshared rootへ公開しない
  ],
)

== 振る舞い仕様

#behavior_spec(
  name: "source-local FactIdを作成する",
  summary: "valid Unicode stringをnormalizationせずsource-local identityへ変換する。",
  preconditions: [
    - inputはnon-emptyなvalid Unicode stringである
  ],
  steps: [
    - inputを`factId`へ渡す
  ],
  postconditions: [
    - 同じcode-unit sequenceを持つ`FactId`を返す
  ],
)

#behavior_spec(
  name: "invalidなFactId inputを拒否する",
  summary: "source-local identityとして表現できないruntime inputを診断する。",
  preconditions: [
    - inputはempty string、lone surrogate、または非string runtime valueである
  ],
  steps: [
    - inputを`factId`へ渡す
  ],
  errors: [
    - 空pathと`invalid-fact-id` codeを持つ`ExecutionContractError`を送出する
  ],
)

#behavior_spec(
  name: "ExecutionContractErrorの診断snapshotを保持する",
  summary: "callerの後続mutationからerror codeとpathを隔離する。",
  preconditions: [
    - mutable pathを使って`ExecutionContractError`を作成している
  ],
  steps: [
    - callerが元のpath、`error.path`、error fieldの書き換えを試みる
  ],
  postconditions: [
    - error codeとpath snapshotは変化しない
  ],
)

#behavior_spec(
  name: "budget overrideをoperation-local ledgerへ解決する",
  summary: "closedなnarrow-only overrideとframework hard capからfresh ledgerを作成する。",
  preconditions: [
    - budget argumentは`undefined`またはclosedなplain/null-prototype recordである
  ],
  steps: [
    - own keyとdescriptorをgetter実行なしで検査する
    - present overrideを対応するframework hard capと比較する
    - defaultとoverrideを解決してfresh ledgerを作成する
  ],
  postconditions: [
    - operationごとにusageを共有しないfresh ledgerを返す
    - overrideがないcounterにはframework hard capを適用する
  ],
  errors: [
    - invalidなroot recordを`invalid-closed-record`と`["budget"]`で拒否する
    - extra fieldまたはinvalid valueを`invalid-field`とfield pathで拒否する
    - hidden propertyまたはaccessorを`invalid-closed-record`とfield pathで拒否する
  ],
)

#behavior_spec(
  name: "operation-local budget usageを課金する",
  summary: "一つのoperationにおけるcumulative workとpeak depthをhard limit内に制限する。",
  preconditions: [
    - callerは一つのpublic operation用に作成したfresh ledgerを保持している
  ],
  steps: [
    - depth以外の14 counterを`chargeTotal(counter, amount)`でcumulativeに課金する
    - `maximumInputDepth`を`observePeak("maximumInputDepth", depth)`で1-based peakとして観測する
  ],
  postconditions: [
    - exact limitまでのtotalまたはpeakを受理する
    - failed incrementをusageへ適用せず、後続の合法な課金を継続できる
    - ledgerはnested phase用のreset operationを提供しない
  ],
  errors: [
    - overflowまたはlimit超過を`budget-exceeded`で拒否する
    - error messageにcounter、limit、attempted valueを含める
    - failure pathは課金callerが渡したcurrent operation pathを保持する
  ],
)

== 機能仕様

#feature_spec(
  name: "Source-local identity boundary",
  summary: [
    後続のsemantic modelとstrict parserが共有するsource-local identityとfailure vocabularyを提供する。
  ],
  test_cases: [
    - valid Unicode、composed/decomposed sequence、surrogate pairを検査する
    - empty、lone surrogate、非string runtime valueを検査する
    - errorとpathのimmutabilityを検査する
    - qualified、compiled、accepted APIがfacadeに存在しないことを検査する
  ],
)

#feature_spec(
  name: "Source-local subject model",
  summary: [
    後続のfact modelとstrict parserが共有するlocationとnested pathのtype-only taxonomyを提供する。
  ],
  test_cases: [
    - 7 subject kindと3 path segment kindを双方向のexact type fixtureで検査する
    - 各variantのkeyとproperty typeを双方向のexact type fixtureで検査する
    - direct callbackの空path、object property callback、tuple callback、element callbackを区別できることを検査する
    - pathの順序とrepeated path segmentを保持できることを検査する
    - wrong property type、extra property、callback pathの省略をnegative type fixtureで検査する
    - qualified、compiled、accepted、digest APIが存在しないことを検査する
    - facadeのruntime valueが`ExecutionContractError`と`factId`だけであることを検査する
  ],
)

#feature_spec(
  name: "Closed source-local fact schema",
  summary: [
    後続のstrict parserとclosure validatorが扱うfact claimのtype-only schemaを提供する。
  ],
  test_cases: [
    - 16 fact kindを双方向のexact type fixtureで検査する
    - すべてのfact variantのexact keyとproperty typeを検査する
    - 6 transfer binding variantのexact key、registry kind、version、policy fieldを検査する
    - removed behavioral fieldを各該当variantが受理しないことを検査する
    - `FactId`とrequired callback pathを含む`SemanticSubject`を再利用することを検査する
    - 異なるkindの`RegistryId`を相互代入できないことを検査する
    - fact modelとtype-only consumerがruntime codeを生成しないことを検査する
    - package-local facadeがfact modelから3 typeだけを公開し、runtime valueを追加しないことを検査する
    - package rootへ公開されず、後続review unitのAPIが存在しないことを検査する
  ],
)

#feature_spec(
  name: "Closed source-local relation schema",
  summary: [
    後続のstrict parserとlocal closureが扱うbehavioral edgeのtype-only schemaを提供する。
  ],
  test_cases: [
    - 8 relation kindを双方向のexact type fixtureで検査する
    - 8 variantと全from/to endpointのexact keyおよびproperty typeを双方向fixtureで検査する
    - 全legal endpoint kindと、8 relationのfrom/to両位置におけるillegal fact-kind edgeをnegative type fixtureで検査する
    - orders-beforeのrequiredな`number | null` ordinalと、ほかの7 variantにordinal keyが存在しないことを検査する
    - kind、endpoint、ordinalのreadonly mutation、`ordinal: undefined`、raw string endpoint、extra endpoint fieldをnon-vacuous negative type fixtureで検査する
    - relation modelと実ファイルのtype-only consumerがruntime codeを生成しないことを検査する
    - package-local facadeがrelation modelから3 typeだけを公開し、runtime valueまたはruntime import edgeを追加しないことを検査する
    - package rootへ公開されず、individual relation、parser、validator、closure、order-semantic APIが存在しないことを検査する
  ],
)

#feature_spec(
  name: "Source-local export summary schema",
  summary: [
    後続のstrict parserとsource closureが扱うmodule export summaryのtype-only schemaを提供する。
  ],
  test_cases: [
    - 4 callable literalと5 required readonly fieldのexact keyおよびproperty typeを双方向fixtureで検査する
    - missing、extra、optional、mutable、widened fieldを実装定数に依存しないnon-vacuous negative fixtureで拒否する
    - brandとvalue-domainの`RegistryId`を相互代入できないことを検査する
    - export model、package-local facade、type-only consumerがruntime import edgeを生成しないことを検査する
    - package-local facadeがexport modelから`ExportExecutionContract`だけを公開し、helper aliasまたはruntime valueを追加しないことを検査する
    - package rootのsourceとbuild declarationへ公開されず、parser、validator、digest、qualified、compiled、accepted APIが存在しないことを検査する
  ],
)

#feature_spec(
  name: "Source-local registry source collection schema",
  summary: [
    SC02A7のsource envelopeと後続のstrict parser、registry closureが扱う10種類のregistry source collectionをtype-only schemaとして提供する。
  ],
  test_cases: [
    - 10個のexact key、required readonly field、readonly array propertyを双方向fixtureで検査する
    - 各collectionを対応する`RegistrySourceEntry<Kind>`へexactに対応付けることを全10 kindで検査する
    - wrong kind、mutable field、mutable array、optional field、missing field、extra fieldをnon-vacuous negative fixtureで拒否する
    - registry source modelとtype fixtureがruntime codeまたはruntime import edgeを生成しないことを検査する
    - package-local facadeがregistry source modelから`ExecutionContractRegistrySources`だけをtype-only exportし、runtime valueを追加しないことを検査する
    - package rootのsourceとbuild declarationへ公開されず、SC01の`RegistrySourceEntry`が存在するpositive controlと対比して検査する
    - parser、validator、operation、helper alias、freeze、non-empty、order、duplicate semanticsを追加しないことを検査する
  ],
)

#feature_spec(
  name: "Untrusted source execution contract envelope schema",
  summary: [
    SC02A1からSC02A6のsource-local typeを、後続operationが受け取る未信頼なtype-only aggregateへ束ねる。
  ],
  test_cases: [
    - 8個のexact key、required readonly modifier、exact property typeを双方向fixtureで検査する
    - `ExecutionContractSourceInput`と`ExecutionContractSource`が同一typeであることを検査する
    - missing、extra、optional、mutable、widened、wrong schema、raw string host ID、mutable arrayを実装定数に依存しないnon-vacuous negative fixtureで拒否する
    - fact、relation、export、registry、host assumptionの全collectionがemptyな値も未信頼なstructural typeへ適合することを検査する
    - non-emptyなfact、relation、export、host assumptionを持ちながら、empty ID、invalid version、duplicate、dangling reference、registry closure不整合を含む値が未信頼なstructural typeへ適合することを検査する
    - source modelがexactに2 typeだけをexportし、source modelとtype fixtureがexport marker以外のruntime codeまたはruntime import edgeを生成しないことを検査する
    - package-local facadeがsource modelから2 typeだけをtype-only exportし、runtime valueは`ExecutionContractError`と`factId`だけであることを検査する
    - package rootのsourceとbuild declarationへ公開されず、SC01の`RegistrySourceEntry`が存在するpositive controlと対比して検査する
    - source model自体にはSC02A8からSC02A13のparser、validator、budget、preflight、canonical、duplicate、closure、creator、freeze、digest APIと、qualified、compiled、accepted、trust、authority APIを追加しないことを検査する
  ],
)

#feature_spec(
  name: "Budget contract and operation-local ledger",
  summary: [
    後続のsource operationが共有するhard cap contractと、operation間でusageを共有しないinternal ledgerを提供する。
  ],
  test_cases: [
    - 15個のexact optional readonly number fieldを双方向type fixtureで検査する
    - default hard cap、0 override、exact limit、limit+1を全15 counterで検査する
    - current `Object.prototype`とnull-prototype recordを受理し、custom prototype、extra、symbol、hidden、accessor、invalid safe integer、hard cap拡張を拒否する
    - budget root pathとfield path、counter、limit、attempted valueを持つfailureを検査する
    - depth以外のcumulative total、depthの1-based peak、overflow-safe failure、failed incrementの非適用を検査する
    - fresh ledgerのoperation isolationとreset API不在を検査する
    - package-local facadeへtypeだけを追加し、ledger、factory、counter type、default hard capがruntime facade、shared root、generated root declarationへ公開されないことを検査する
    - descriptor、profile、clone、freeze、meter、parser、public source operationが追加されないことを検査する
  ],
)
