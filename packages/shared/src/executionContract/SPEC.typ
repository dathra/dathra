= source execution contract identity, subject, fact, relation, and export model

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

source execution contractが、qualification前のfactを一つのcontract内で参照するためのlocal identity、stable failure、source-local subjectとvalue path、closed fact schemaを提供する。

SC02A1は`FactId`、`factId()`、`ExecutionContractError`だけをpackage-local facadeから公開する。

SC02A2はsemantic subjectとpath segmentをtype-only modelとして追加する。

SC02A3はsemantic factとtransfer bindingをtype-only modelとして追加する。

SC02A4はsemantic relationをtype-only modelとして追加する。

SC02A5はmodule exportごとのexecution summaryをtype-only modelとして追加する。

source envelope、unknown input parser、budget、closure、digestは後続の独立review unitが追加する。

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
    - aggregate source、source envelope、qualified、compiled、accepted、digest APIが存在しないことを検査する
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
    - package rootへ公開されず、individual relation、parser、validator、closure、source、order-semantic APIが存在しないことを検査する
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
    - package rootのsourceとbuild declarationへ公開されず、parser、validator、source envelope、registry aggregate、digest、qualified、compiled、accepted APIが存在しないことを検査する
  ],
)
