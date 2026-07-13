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

SC02A8Bはdistinct container identityごとのoperation-localな二段階descriptor captureをinternal APIとして追加する。

SC02A8Cは同時にactiveなcontainer identityだけをcycleとして拒否するoperation-local trackerをinternal APIとして追加する。

SC02A8D-Pはoccurrence ID、parent link、single segmentだけを保持するoperation-local plan builderと、failure時だけpathをmaterializeするinternal APIを追加する。

SC02A8D-WはA8A、A8B、A8CとD-Pを一つのiterative walkerへ統合し、genericな二段階profile hookをinternal APIとして追加する。

SC02A8E-Cはexecution sourceのcollection cardinalityだけをwalkerのdescriptor前profileとして追加する。

SC02A8E-Rはexecution sourceのpotential reference cardinalityだけをwalkerの二段階profileとして追加する。

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

#adr(
  header("distinct container descriptorをheaderとviewの二段階でcaptureする", Status.Accepted, "2026-07-13"),
  [
    hostile containerのown keyと全descriptorを事前課金前に同時に読むと、property、key code unit、array lengthのhard capがdescriptor reflectionとview allocationを停止できない。
    alias occurrenceごとに同じcontainerを再reflectionすると、host side effectとcapture結果がidentityごとに変化する。
  ],
  [
    freshなoperation-local captureはidentity cacheを所有し、first-seen containerをheader phaseとview phaseに分ける。
    headerはprototype、未加工の凍結済み`Reflect.ownKeys()` result、arrayの場合はintrinsic `length` descriptorだけをcaptureする。
    callerがheader由来counterを課金した後だけviewを完成し、完成viewをidentityごとに再利用する。
  ],
  [
    - headerはarray intrinsic `length`を含むoriginal own-key sequenceをfilterまたはcopyせず保持する
    - callerはdescriptorを読む前にsymbolや拒否対象keyも含めて課金し、array intrinsic `length`だけをproperty counterから除外する
    - completed view以外のfailedまたはincomplete stateをcomplete cacheとして公開しない
    - budget charge、occurrence walker、cycle、source profile、clone、final snapshot freeze、parser、meter、public source operationは後続sliceが所有する
    - descriptor captureとそのtypeはruntime facadeまたはshared rootへ公開しない
  ],
)

#adr(
  header("descriptor captureの成功経路をmutable array prototypeとpath copyから分離する", Status.Accepted, "2026-07-13"),
  [
    frozenなown-key resultでも`for...of`はmutableな`Array.prototype[Symbol.iterator]`を参照し、通常のindex assignmentはinherited setterを実行し得る。
    descriptor読取後のphase確認でproperty pathを毎回spreadすると、成功経路にproperty countとdepthの積に比例する未課金allocationが生じる。
  ],
  [
    own-key resultはown `length`とindexによって走査し、sanitized entry/itemはown data propertyとして定義する。
    phase確認はcontainer pathとactive segmentを別々に保持し、full property pathはfailure時だけmaterializeする。
    reentrant trapが最初のcapture failureを再送出した場合は、そのfailureを別のreflection failureへwrapし直さない。
  ],
  [
    - hostile trapがarray iteratorまたはinherited index setterを変更してもdescriptorを省略せずsanitized viewを構築する
    - success pathではcaller path iteratorを実行しない
    - failure pathのimmutable snapshot作成は`ExecutionContractError`が所有する
  ],
)

#adr(
  header("active ancestorだけをoperation-localなLIFO stateで追跡する", Status.Accepted, "2026-07-13"),
  [
    traversal全体のvisited identity setはleave済みのshared aliasまでcycleとして拒否する。
    recursive call stackまたはpath sequenceをactive stateへ保存すると、host call-stack limitまたは成功経路のdepth比例path allocationへ依存する。
  ],
  [
    freshなtrackerはactive identityの`WeakSet`と、identityとparentだけを持つtop-linked LIFO stateを所有する。
    `enter()`は同じidentityがactiveな場合だけcurrent occurrence pathの`invalid-closed-record`で拒否し、成功時だけidentityとtopを追加する。
    `leave()`はexactなcurrent top identityだけを受理し、active setから削除してparentを復元する。
  ],
  [
    - failed enterとout-of-order、duplicate、unknown leaveはtracker stateを変更しない
    - leave後の同じidentityは合法なshared aliasとして再enterできる
    - success pathではpathを反復、copy、保存せず、cycle failure時だけ既存`fail()`へcurrent occurrence pathを渡す
    - tracker stateはactive depthに比例し、recursive traversalまたはmutableなArray prototypeのstack behaviorへ依存しない
    - descriptor、budget、walker、profile、clone、freeze、parser、meterを追加しない
    - trackerとfactoryはpackage-local facadeまたはshared rootへ公開しない
  ],
)

#adr(
  header("parent-linked occurrence planをwalkerから分離する", Status.Accepted, "2026-07-13"),
  [
    full pathを各occurrenceへ保存すると、depthとnode数の積に比例するallocationがwalkerのbudget admissionより前に発生する。
    parent-linked planとdescriptor、budget、cycle、profileを同じrevisionで実装すると、単独で検証できるpath modelとhostile-data traversalが一つのreview unitへ結合する。
  ],
  [
    freshなbuilderはoccurrence ID、parent occurrence ID、single segment、1-based depthと、scalar valueまたはrecord/array kindだけをpreorder planへ追加する。
    current pathとdirect child pathはparent linkを参照するdeferred immutable arrayとし、pathが観測された時だけrecursive call stackを使わず反復的にmaterializeする。
    descriptor、budget、active ancestor、generic profileを統合するwalkerは、完成したbuilderへ依存する後続SC02A8D-Wが所有する。
  ],
  [
    - root occurrence IDは0、parentとsegmentは`null`、depthは1とする
    - plan nodeはfull path、caller object、descriptor、ledger、profile、clone、source fieldを保持しない
    - builderはempty finish、repeated finish、finish後のappend、second root、unknown parentをinternal `TypeError`で拒否する
    - occurrence、plan、builderとfactoryはpackage-local facade、shared root、generated root declarationへ公開しない
  ],
)

#adr(
  header("generic closed-data admissionをiterative occurrence walkerへ統合する", Status.Accepted, "2026-07-13"),
  [
    distinct container identityだけを課金するとshared aliasのpath occurrence costを過小評価する。
    descriptor completionより前にproperty、key code unit、array lengthを課金しなければ、hostile containerの全descriptor allocationをhard capで停止できない。
    source-specific field ruleをgeneric walkerへ埋め込むと、closed-data admissionとexecution source schemaのownerが混在する。
  ],
  [
    freshなwalkerはA8A ledger、A8B descriptor capture、A8C active-ancestor tracker、D-P builderとexplicit visit/leave frame stackを一つのoperationで使う。
    depth、data node、string scalarとheader-derived counterは全path occurrenceへ課金し、shared aliasでも両profile hookを再実行する一方、descriptor header/viewはidentityごとに再利用する。
    generic profileは`beforeDescriptors`と`beforeChildren`だけを定義し、source-specific cardinalityとreference ruleは後続A8Eが所有する。
  ],
  [
    - root depthは1とし、array intrinsic `length`はproperty countからだけ除外してstring key unitへ含める
    - `beforeDescriptors`はgeneric header課金後かつview completion前、`beforeChildren`はcompletion後かつcycle判定とchild scheduling前に呼ぶ
    - full pathはframeまたはplanへ保存せず、budget、descriptor、cycle、profile failureが観測した時だけD-P parent linkからmaterializeする
    - walkerはsource field、clone、final freeze、parser、canonical meter、digest、identity、trust、authority、client permissionを追加しない
    - profileとwalker factoryはpackage-local facade、shared root、generated root declarationへ公開しない
  ],
)

#adr(
  header("source collection cardinalityをdescriptor completion前のprofileへ分離する", Status.Accepted, "2026-07-13"),
  [
    generic walkerへexecution sourceのfield名を埋め込むと、closed-data admissionとsource schemaのownerが混在する。
    collection elementのdescriptorを完成した後にsource固有capを検査すると、limitを超えるinputがchild descriptor workを先に発生させる。
  ],
  [
    freshなsource collection profileはparent-linked occurrence roleだけを保持し、`beforeDescriptors`で対象containerのcardinalityをoperation-local ledgerへ課金する。
    facts、relations、exports、10個のregistry collection、各registry entryのimplementationsを、それぞれ既存の専用counterへ課金する。
    profileはcollection element semantics、reference、SemanticPath、closureを検査しない。
  ],
  [
    - factsとrelationsはarray length、exportsはrecord own-key countを専用counterへ課金する
    - 10個のregistry collectionは`maximumRegistryEntries`、implementationsは`maximumRegistryImplementations`へ累積課金する
    - shared aliasもtarget occurrenceごとに再課金し、failure pathは対象container occurrenceとする
    - occurrence、header、caller objectを変更または保持せず、boundedなoperation-local role stateだけを保持する
    - factoryとprofileはpackage-local facade、shared root、generated root declarationへ公開しない
  ],
)

#adr(
  header("source reference cardinalityをsemantic validation前のprofileへ分離する", Status.Accepted, "2026-07-13"),
  [
    reference slotはsource root、fact、relation endpoint、export summary、transfer bindingに分散しており、generic walkerへfield名を埋め込むとclosed-data admissionとsource schemaのownerが混在する。
    semantic discriminatorやreference valueを検証した後に課金すると、malformed inputがhard capを回避してdescriptorとvalidation workを先に発生させる。
  ],
  [
    freshなsource reference profileはparent-linked occurrence roleだけを保持する。
    array-valued potential referenceは`beforeDescriptors`でlengthを、presentなscalar potential referenceは`beforeChildren`で一件を`maximumReferences`へ課金する。
    課金対象はstructural locationとfield presenceだけで決め、discriminator、reference value、closure、registry kindを検証しない。
  ],
  [
    - array-valued referenceはrootのhost assumption、factのhost profile、sink policy、capability policy、exportのfact ID collectionとする
    - scalar referenceはfact attribute、relation endpoint、exportのreceiver brandとvalue domain、factまたはexportのtransfer bindingにあるregistry IDとする
    - missing slotは課金せず、presentなnullable slotとmalformed discriminator上のpotential slotは一件として課金する
    - shared array aliasもtarget occurrenceごとに再課金し、failure pathはarray containerまたはscalar slotとする
    - role stateはoccurrence IDとstructural roleだけをown data propertyとして保持し、captured record entryはown lengthとindexで走査する
    - occurrence、header、view、caller objectを変更または保持せず、factoryとprofileをpackage-local facade、shared root、generated root declarationへ公開しない
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

#interface_spec(
  name: "Operation-local closed container descriptor capture",
  summary: [
    hostile containerのheaderとgetter-free descriptor viewをdistinct identityごとに一度だけcaptureするinternal APIを提供する。
  ],
  format: [
    ```typescript
    type ClosedDescriptorValue = null | boolean | number | string | object

    type ClosedContainerHeader =
      | { readonly kind: "record"; readonly ownKeys: readonly PropertyKey[] }
      | { readonly kind: "array"; readonly ownKeys: readonly PropertyKey[]; readonly length: number }

    type ClosedContainerView =
      | { readonly kind: "record"; readonly entries: readonly (readonly [string, ClosedDescriptorValue])[] }
      | { readonly kind: "array"; readonly items: readonly ClosedDescriptorValue[] }

    interface ClosedDescriptorCapture {
      captureHeader(value: unknown, path: readonly (string | number)[]): ClosedContainerHeader
      completeView(value: object, path: readonly (string | number)[]): ClosedContainerView
    }

    function createClosedDescriptorCapture(): ClosedDescriptorCapture
    ```
  ],
  constraints: [
    - factoryはfreshなoperation-local identity cacheを毎回作成する
    - headerはnon-null objectだけを受け入れ、recordはprototypeがcurrent `Object.prototype`またはnull、arrayは`Array.isArray()`がtrueかつprototypeがcurrent `Array.prototype`であることを要求する
    - headerはprototypeと`Reflect.ownKeys()`をdistinct identityごとに一回だけ読み、ownKeys result自体をfilterまたはcopyせずfreezeして公開する
    - array headerのownKeysはintrinsic `length`を含み、そのdescriptorをheader phaseで一回だけ読み、non-enumerable、non-configurableなown data descriptorと0以上2^32-1以下のintegerである宣言lengthを公開する
    - callerはownKeys、string key code unit、array length、header-only source cardinalityを課金し、array intrinsic `length`だけをproperty課金から除外した後に`completeView()`を呼ぶ
    - view phaseは`length`以外の各own descriptorを最大一回読み、accessorを実行せず、frozenなentry、entry sequence、item sequence、viewを返す
    - descriptor valueはnull、boolean、number、string、non-null objectだけを受理し、undefined、bigint、symbol、functionを拒否する
    - numberのfinite性、negative zero、stringのUnicode validityをこのAPIで検査しない
    - recordのsymbolはcontainer path、string propertyはproperty path、array indexはnumeric path、array extra string keyはstring path、sparse slotは最初のmissing numeric pathで`invalid-closed-record`にする
    - prototype、ownKeys、descriptor reflectionがthrowした場合は対応するcontainerまたはproperty pathの`invalid-closed-record`へ変換する
    - complete viewはalias occurrenceで同一identityに再利用し、failedまたはreentrant incomplete captureをcomplete viewとしてpublishしない
    - ownKeys traversalはarray iteratorを使わず、sanitized entry/itemはinherited setterを実行しないown data propertyとして定義する
    - success pathではfull property pathをcopyせず、active container pathとsegmentからfailure時だけmaterializeする
    - reentrant capture failureがreflection trapから再送出された場合は最初のfailureを保持する
    - internal moduleだけがexportし、package-local facade、shared root、generated root declarationへ公開しない
  ],
)

#interface_spec(
  name: "Operation-local active ancestor tracker",
  summary: [
    traversal中に同時にactiveなobject identityだけをcycleとして識別するinternal APIを提供する。
  ],
  format: [
    ```typescript
    interface ActiveAncestorTracker {
      enter(value: object, path: readonly (string | number)[]): void
      leave(value: object): void
    }

    function createActiveAncestorTracker(): ActiveAncestorTracker
    ```
  ],
  constraints: [
    - factoryはfreshなoperation-local trackerを毎回作成する
    - successful enterはidentityをactive `WeakSet`へ追加し、identityとparentだけを持つnew topを作成する
    - 同じidentityがactiveなdirectまたはindirect cycleはcurrent occurrence pathの`invalid-closed-record`で拒否し、tracker stateを変更しない
    - leaveはexactなcurrent top identityだけを受理し、active identityを削除してparent topを復元する
    - out-of-order、duplicate、unknown leaveはinternal `TypeError`で拒否し、tracker stateを変更しない
    - leave後の同じidentityはshared aliasとして再enterできる
    - enterとleaveはiterativeであり、12,000 depthをJavaScript call stackに依存せず処理する
    - successful enterはpathを反復、copy、保存せず、cycle failureだけが既存`fail()`によるimmutable path snapshotを作る
    - active stateにmutable arrayまたはmutableな`Array.prototype` traversalを使用しない
    - internal moduleだけがexportし、package-local facade、shared root、generated root declarationへ公開しない
  ],
)

#interface_spec(
  name: "Parent-linked closed data occurrence plan",
  summary: [
    後続walkerがcaller objectやfull pathを保持せずにpreorder occurrence sequenceを構築するinternal builderを提供する。
  ],
  format: [
    ```typescript
    type ClosedDataPlanNodeValue =
      | { readonly kind: "null"; readonly value: null }
      | { readonly kind: "boolean"; readonly value: boolean }
      | { readonly kind: "number"; readonly value: number }
      | { readonly kind: "string"; readonly value: string }
      | { readonly kind: "record" }
      | { readonly kind: "array" }

    interface ClosedDataOccurrence {
      readonly occurrenceId: number
      readonly parentOccurrenceId: number | null
      readonly segment: string | number | null
      readonly depth: number
      readonly path: readonly (string | number)[]
      childPath(segment: string | number): readonly (string | number)[]
    }

    interface ClosedDataPlan {
      readonly nodes: readonly ClosedDataPlanNode[]
    }

    interface OccurrencePlanBuilder {
      rootPath(): readonly (string | number)[]
      childPath(parentOccurrenceId: number, segment: string | number): readonly (string | number)[]
      appendRoot(value: ClosedDataPlanNodeValue): ClosedDataOccurrence
      appendChild(
        parentOccurrenceId: number,
        segment: string | number,
        value: ClosedDataPlanNodeValue,
      ): ClosedDataOccurrence
      finish(): ClosedDataPlan
    }

    function createOccurrencePlanBuilder(): OccurrencePlanBuilder
    ```
  ],
  constraints: [
    - factoryは呼び出しごとにfreshなoperation-local builderを作る
    - rootは一度だけ追加し、occurrence ID 0、parentとsegmentは`null`、depthは1とする
    - child occurrence IDはappend順、depthはparent depth + 1とし、既存parent IDと一つのstring keyまたはnumeric array indexだけを保持する
    - scalar nodeはclassified value、container nodeはrecord/array kindだけを保持し、caller object、descriptor view、ledger、profile、clone、full path arrayを保持しない
    - root path、child path、occurrenceの`path`と`childPath()`は観測時だけparent chainを反復的にmaterializeするimmutable arrayとする
    - `finish()`はplan、node sequence、全nodeをfreezeし、同じbuilderでのappendと再finishを不能にする
    - plan、node、occurrence、builder、factoryはinternal moduleだけがexportし、package-local facade、shared root、generated root declarationへ公開しない
  ],
)

#interface_spec(
  name: "Profile-driven iterative closed data walker",
  summary: [
    generic structural admissionとsource-specific precharge hookを統合し、D-Pのparent-linked planを構築するinternal walkerを提供する。
  ],
  format: [
    ```typescript
    interface ClosedDataProfile {
      beforeDescriptors(
        occurrence: ClosedDataOccurrence,
        header: ClosedContainerHeader,
        ledger: BudgetLedger,
      ): void
      beforeChildren(
        occurrence: ClosedDataOccurrence,
        view: ClosedContainerView,
        ledger: BudgetLedger,
      ): void
    }

    function createClosedDataPlan(
      value: unknown,
      ledger: BudgetLedger,
      profile?: ClosedDataProfile,
    ): ClosedDataPlan
    ```
  ],
  constraints: [
    - factoryは呼び出しごとにfresh descriptor capture、active-ancestor tracker、occurrence-plan builder、frame stackを作る
    - walkerはrecursive call stackを使わず、visit frameへcaller value、parent occurrence ID、single segment、1-based depthだけを保持する
    - scalarはnull、boolean、number、stringだけを受理し、containerはA8Bのheader/view contractに従う
    - default profileはno-opとし、injected profileはcaller-owned ledgerへsource-specific counterだけを課金する
    - `beforeDescriptors`はcontainer occurrence、captured header、ledgerをgeneric header課金後かつ`completeView()`前に受け取る
    - `beforeChildren`は同じoccurrence、completed view、同じledgerをactive-ancestor enterとchild schedulingの前に受け取る
    - factoryとprofileはinternal moduleだけがexportし、package-local facade、shared root、generated root declarationへ公開しない
  ],
)

#interface_spec(
  name: "Execution-source collection cardinality profile",
  summary: [
    source collectionの専用hard capをchild descriptor completion前に課金するinternal profileを提供する。
  ],
  format: [
    ```typescript
    function createSourceCollectionProfile(): ClosedDataProfile
    ```
  ],
  constraints: [
    - factoryはfreshなoperation-local profileを毎回作成する
    - rootのfactsとrelationsがarrayの場合はlengthを`maximumFacts`と`maximumRelations`へ課金する
    - rootのexportsがrecordの場合はraw own-key countを`maximumExports`へ課金する
    - rootのregistriesにある10個のsource collectionがarrayの場合は各lengthを`maximumRegistryEntries`へ累積課金する
    - 各registry collection itemのimplementationsがarrayの場合はlengthを`maximumRegistryImplementations`へ累積課金する
    - target containerはgeneric header課金後かつchild descriptor completion前に課金する
    - source field以外、collection element、reference、SemanticPath、semantic discriminator、closureを解釈しない
    - role stateはoccurrence IDとstructural roleだけを保持し、caller object、header、view、full pathを保持しない
    - internal moduleだけがfactoryをexportし、package-local facade、shared root、generated root declarationへ公開しない
  ],
)

#interface_spec(
  name: "Execution-source reference cardinality profile",
  summary: [
    structurally presentなsource reference slotをsemantic validation前に専用hard capへ課金するinternal profileを提供する。
  ],
  format: [
    ```typescript
    function createSourceReferenceProfile(): ClosedDataProfile
    ```
  ],
  constraints: [
    - factoryはfreshなoperation-local profileを毎回作成する
    - rootの`hostAssumptionFactIds`、factの`hostProfileIds`、`sinkPolicyIds`、`capabilityPolicyIds`、exportの`factIds`がarrayの場合は各lengthを`maximumReferences`へ累積課金する
    - factの`environmentFactId`、`exposureFactId`、`receiverBrandId`、`brandId`、`schemaId`、`audiencePolicyId`、`releasePolicyId`、`endorsementPolicyId`をpresentなscalar potential referenceとして課金する
    - relation endpointの`factId`、exportの`receiverBrandId`と`valueDomainId`をpresentなscalar potential referenceとして課金する
    - fact bindingまたはexport transferの`codecId`、`resolverId`、`capabilityPolicyId`、`sourceId`、`operationId`をpresentなscalar potential referenceとして課金する
    - array-valued referenceはgeneric header課金後かつchild descriptor completion前、scalar referenceはcompleted record viewの取得後かつchild traversal前に課金する
    - missing slotは課金せず、presentな`null`とmalformed discriminator上のpotential slotはvalueを解釈せず課金する
    - declaration ID、version、locator、fact kind、callback parameter indexをreferenceとして課金しない
    - role stateはoccurrence IDとstructural roleだけをown data propertyとして保持し、caller object、header、view、full pathを保持しない
    - captured record entryはmutableなarray iteratorに依存せずown lengthとindexで走査する
    - internal moduleだけがfactoryをexportし、package-local facade、shared root、generated root declarationへ公開しない
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

#behavior_spec(
  name: "closed containerをheaderとviewの二段階でcaptureする",
  summary: "distinct identityのmetadataを固定し、callerのheader-derived counter課金後だけgetter-free viewを完成する。",
  preconditions: [
    - callerはfreshなoperation-local captureを保持し、view completion前にproperty、key code unit、array length、header-only source cardinalityを課金する
  ],
  steps: [
    - observable prototypeとarray conditionを検査し、original `Reflect.ownKeys()` resultとarray intrinsic `length` descriptorからheaderを作る
    - callerがheader-derived counterを課金する
    - 課金後に`length`以外のdescriptorを各一回だけ読む
    - enumerable data property、array indexの完全性、descriptor value domainを検査する
    - frozenなrecord entry sequenceまたはdense array item sequenceのviewを作る
  ],
  postconditions: [
    - headerはoriginal frozen ownKeysとarray declared lengthを公開し、property descriptorをまだ読まない
    - getterを実行せず、finiteでないnumber、negative zero、lone surrogate stringもcaptureする
    - aliasに同じheaderとcompleted viewをreflectionなしで返す
  ],
  errors: [
    - non-object、custom/foreign prototype、invalid array length descriptorとheader reflection exceptionをcontainer pathの`invalid-closed-record`にする
    - symbol、hidden、accessor、disappearing descriptor、array extra key、sparse slot、unsupported descriptor valueをaccepted pathの`invalid-closed-record`で拒否する
    - descriptor reflection exceptionをaccepted property pathの`invalid-closed-record`へ変換する
    - failedまたはreentrant incomplete captureをcomplete viewとしてcacheしない
  ],
)

#behavior_spec(
  name: "active ancestorをstrictなenter/leave順で追跡する",
  summary: "同時にactiveなidentityだけをcycleとして拒否し、leave済みaliasの再出現を受理する。",
  preconditions: [
    - callerは一つのiterative traversal用に作成したfresh trackerを保持している
  ],
  steps: [
    - object occurrenceを処理する直前に`enter(value, path)`を呼ぶ
    - child occurrenceを処理した後にexactなreverse orderで`leave(value)`を呼ぶ
  ],
  postconditions: [
    - directまたはindirect cycleではないenterだけがactive stateへ追加される
    - successful leave後は同じidentityをshared aliasとして再enterできる
    - success pathでpathを反復、copy、保存しない
    - 12,000 depthのenterとleaveをrecursive call stackなしで完了する
  ],
  errors: [
    - active identityの再enterを`invalid-closed-record`とcurrent occurrence pathで拒否し、failed enter前のstateを保持する
    - out-of-order、duplicate、unknown leaveをinternal `TypeError`で拒否し、failure前のstateを保持する
  ],
)

#behavior_spec(
  name: "parent linkからoccurrence pathをdeferred materializeする",
  summary: "preorder nodeへfull pathを保存せず、failure consumerが観測したpathだけを反復的に構築する。",
  preconditions: [
    - callerはfresh builderへrootを追加済みであり、child追加時は既存parent occurrence IDを指定する
  ],
  steps: [
    - rootまたはchild用のdeferred pathを作る
    - classified scalar valueまたはcontainer kindをappendし、append順のoccurrence IDとparent由来のdepthを決める
    - pathが観測された場合だけcurrent segmentからparent linkをrootまで反復し、root-relative順序のarrayを作る
    - traversal完了後に`finish()`し、frozen node sequenceを返す
  ],
  postconditions: [
    - plan nodeはoccurrence locationとclassified value/kindだけを保持する
    - root pathはempty、record propertyはstring segment、array itemはnumber segmentとして順序を保持する
    - materialized path、occurrence、node、node sequence、planはimmutableである
    - 12,000-level parent chainのpath materializationはJavaScript call stackへ依存しない
    - 別のbuilder呼び出しはnode sequenceとlifecycle stateを共有しない
  ],
  errors: [
    - root未追加のchild、unknown parent、second root、finish後のappendをinternal `TypeError`で拒否し、failure前のnode sequenceを保持する
    - empty planとrepeated finishをinternal `TypeError`で拒否する
  ],
)

#behavior_spec(
  name: "closed-data occurrenceを課金してparent-linked planを作る",
  summary: "distinct identityのcaptureを再利用しながら、shared aliasを含む全path occurrenceを反復的にadmitする。",
  preconditions: [
    - callerは一つのoperation用にfresh ledgerと、必要な場合はexecution-source profileを保持している
  ],
  steps: [
    - current occurrenceの1-based depth peakとdata node 1を課金し、string valueならraw UTF-16 code unit数を課金する
    - containerならheaderをcaptureし、array intrinsic `length`以外のown key数、symbol以外の全string key code unit数、array declared lengthをcurrent container pathで課金する
    - generic header-derived課金の後に`beforeDescriptors`を呼び、その後だけdescriptor viewを完成する
    - completed viewで`beforeChildren`を呼び、active ancestorへenterし、captured orderのchild frameとleave frameをexplicit stackへ積む
    - scalarまたはcontainer occurrenceをD-P builderへpreorder appendし、最後にfrozen planを返す
  ],
  postconditions: [
    - null、boolean、number、string、record、arrayの全occurrenceは`maximumInputDataNodes`へ1ずつ課金される
    - shared aliasはoccurrenceごとにdepth、node、property、array length、string unit、両profile hookを再適用されるが、headerとviewはidentityごとに再利用される
    - symbol、hidden、accessor、array extra keyはdescriptor validationに失敗する前にproperty課金され、symbolはstring unitへ課金されない
    - directまたはindirect active cycleだけを拒否し、leave済みidentityを後続aliasとして再訪できる
    - 別のfactory呼び出しはdescriptor cache、active ancestor、frame、builder stateを共有しない
  ],
  errors: [
    - depthまたはdata node超過をcurrent occurrence path、property、key unit、array length超過をcurrent container pathの`budget-exceeded`にする
    - descriptor failureをA8Bが定めるcontainerまたはproperty path、active cycleをcycle child occurrence pathの`invalid-closed-record`にする
    - unsupported structural scalarをcurrent occurrence pathの`invalid-closed-record`にする
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

#feature_spec(
  name: "Operation-local distinct-container descriptor capture",
  summary: [
    後続のoccurrence walkerが事前課金後だけ使えるgetter-freeなheader/view captureをinternal APIとして提供する。
  ],
  test_cases: [
    - current/null record prototypeとcurrent `Array.prototype`を受理し、primitive、custom/foreign prototypeを拒否する
    - original `Reflect.ownKeys()` resultがfrozenの同一identityで公開され、arrayのintrinsic `length`、symbol、hidden、extra keyをfilterしないことを検査する
    - headerの後、caller prechargeの後にだけview completionを呼び、record/array property descriptorがprecharge前に読まれない順序を検査する
    - prototype、ownKeys、intrinsic length descriptor、その他のdescriptorがdistinct identityごとに一回だけreflectionされ、aliasが同じfrozen header/viewを再利用することを検査する
    - sparse、extra、symbol、hidden、accessor、disappearing descriptor、reflection exceptionのstable code/path、getter非実行、unsupported value rejectionを検査する
    - `NaN`、infinity、negative zero、lone surrogate stringをこのsliceが拒否しないことを検査する
    - failed/reentrant incomplete viewがcomplete cacheへpublishされず、後続aliasでdescriptorを再reflectionしないことを検査する
    - hostile own-key iteratorとinherited array index setterへ依存せず、success path iteratorを実行しないことを検査する
    - reentrant trapが最初のfailureを再送出しても別のreflection failureへwrapしないことを検査する
    - exact internal type signatureとfrozen sanitized outputを検査する
    - budget、walker、cycle、profile、clone、final freeze、parser、meter、public source operationを追加せず、facade、shared root、generated root declarationにdescriptor internalが公開されないことを検査する
  ],
)

#feature_spec(
  name: "Operation-local active-ancestor cycle policy",
  summary: [
    後続のiterative occurrence walkerが、合法なshared aliasを保持しながらactive ancestor cycleだけを拒否するinternal trackerを提供する。
  ],
  test_cases: [
    - direct cycleとindirect cycleをcurrent occurrence pathで拒否することを検査する
    - failed enterがactive stateを変更せず、その後のstrict leaveと再利用を妨げないことを検査する
    - out-of-order、duplicate、unknown leaveを`TypeError`で拒否し、LIFO stateを破壊しないことを検査する
    - leave済みidentityのsibling/shared alias再enterとfresh operation isolationを検査する
    - 12,000 depthをiterativeにenter/leaveできることを検査する
    - success pathでpathを反復または保存せず、cycle failure時だけimmutable path snapshotを作ることを検査する
    - mutableなArray prototype traversal/stateへ依存しないことを検査する
    - exact internal signatureとtype fixtureのruntime code不在を検査する
    - descriptor、budget、walker、profile、clone、freeze、parser、meterを追加せず、facade、shared root、generated root declarationにtrackerを公開しないことを検査する
  ],
)

#feature_spec(
  name: "Parent-linked occurrence plan and deferred path",
  summary: [
    後続walkerがbudget、descriptor、profileと独立して利用できるoperation-local plan/path boundaryを提供する。
  ],
  test_cases: [
    - root、record property、array itemとnull/boolean/number/stringのpreorder node、occurrence ID、parent ID、single segment、1-based depthを検査する
    - plan nodeがfull path、caller object、descriptor、ledger、profile、cloneを保持しないことを検査する
    - root、current、direct child pathが観測時だけparent chainからimmutable arrayへmaterializeされることを検査する
    - plan、node sequence、全node、occurrence、materialized pathのimmutabilityを検査する
    - 12,000-level parent chainをrecursive call stackとmutable Array prototype traversalなしでmaterializeできることを検査する
    - unknown parent、root未追加child、second root、empty/repeated finish、finish後appendのfailureとrollbackを検査する
    - fresh builderのoperation isolationを検査する
    - exact internal signatureとtype fixtureのruntime code不在を検査する
    - descriptor、budget、active ancestor、walker、profile、source field、clone、freeze、parser、identity、trust、authority、client permissionを追加せず、facade、shared root、generated root declarationにplan internalを公開しないことを検査する
  ],
)

#feature_spec(
  name: "Iterative occurrence walker and generic profile hooks",
  summary: [
    A8A、A8B、A8C、D-Pを統合し、後続source profileとsnapshot cloneが利用できるinternal traversal boundaryを提供する。
  ],
  test_cases: [
    - root depth 1、null/boolean/number/string/object occurrence、property、array length、raw string key/value code unitのexactとlimit+1を検査する
    - array intrinsic `length`がpropertyには含まれずstring key unitには含まれることを検査する
    - symbol、hidden、accessor、array extra keyがdescriptor failure前にpropertyへ課金され、symbolがstring unitへ課金されないことを検査する
    - shared aliasの全input budgetと両profile hookをoccurrenceごとに再課金し、descriptor header/viewはidentityごとに一度だけcaptureすることを検査する
    - `beforeDescriptors`がview completion前、`beforeChildren`がcompletion後かつcycle/child前に呼ばれ、occurrence、header/view、ledger contextが正しいことを検査する
    - getterを実行せず、deep iterative fixtureがJavaScript call stackに依存せずdepth budgetで停止することを検査する
    - direct/indirect cycle、sparse/descriptor failure、budget failureがD-P parent linkから正しいimmutable pathをmaterializeすることを検査する
    - captured record entryとarray itemの順序でpreorder planを構築することを検査する
    - fresh walkerのdescriptor/cycle/frame/builder stateとfresh ledgerのoperation isolationを検査する
    - exact internal signatureとtype fixtureのruntime code不在を検査する
    - execution-source-specific cardinality/reference accounting、clone、final freeze、parser、identity、trust、authority、client permissionを追加せず、facade、shared root、generated root declarationにprofile/walkerを公開しないことを検査する
  ],
)

#feature_spec(
  name: "Execution-source collection cardinality precharge",
  summary: [
    source collectionのcardinalityをsemantic validationとchild descriptor completionより前に専用counterへ課金する。
  ],
  test_cases: [
    - facts、relations、exportsのexactとlimit+1、および対象containerのfailure pathを検査する
    - 10個すべてのregistry collectionを`maximumRegistryEntries`へ累積課金することを検査する
    - 各registry entryのimplementationsを`maximumRegistryImplementations`へ累積課金することを検査する
    - target arrayのchild descriptorがinvalidでもcardinality breachが先に失敗することを検査する
    - shared aliasをtarget occurrenceごとに再課金し、fresh profile operationがstateを共有しないことを検査する
    - non-target field、collection element semantics、reference、SemanticPathを課金または検証しないことを検査する
    - successとfailureの両方でcaller data、occurrence、headerを変更せず、caller objectをrole stateへ保持しないことを検査する
    - factory、profile、role stateがpackage-local facade、shared root、generated root declarationへ公開されないことを検査する
  ],
)

#feature_spec(
  name: "Execution-source reference cardinality precharge",
  summary: [
    source reference slotのcardinalityをsemantic validationとchild traversalより前に専用counterへ課金する。
  ],
  test_cases: [
    - root、fact、relation endpoint、export summary、transfer bindingにあるscalar reference各族のexactとlimit+1、およびslot failure pathを検査する
    - host assumption、host profile、sink policy、capability policy、export fact ID collectionのarray lengthを累積課金することを検査する
    - target arrayのchild descriptorがinvalidでもreference cardinality breachが先に失敗することを検査する
    - presentなnullable slotとmalformed discriminator上のpotential slotを課金し、missing slotを課金しないことを検査する
    - shared array aliasをtarget occurrenceごとに再課金し、fresh profile operationがstateを共有しないことを検査する
    - declaration、version、locator、fact kind、callback parameter indexと非対象fieldを課金または検証しないことを検査する
    - mutableな`Map.prototype`、inherited array setter、`Array.prototype[Symbol.iterator]`に依存せずroleとcaptured entryを走査することを検査する
    - successとfailureの両方でcaller data、occurrence、header、viewを変更せず、caller objectをrole stateへ保持しないことを検査する
    - factory、profile、role stateがpackage-local facade、shared root、generated root declarationへ公開されないことを検査する
  ],
)
