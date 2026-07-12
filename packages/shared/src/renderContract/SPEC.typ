= render definition model

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

render outputを構成する四つのreference claimを、一つのversioned preimageへ束縛するpackage-localな型契約とdescriptor snapshot境界を定義する。

DI1はnominal ID、role-specific claim、definition record、creator input、domain errorを提供する。
DI2Aはcreator inputとparser inputのdescriptor occurrenceを同期的にsnapshotするpackage-internal APIを提供する。
DI2Bはそのsnapshotへscalar validationを適用し、fresh preimageとunbranded wrapperを構築する。
content identity operation、brand発行、public creator/parser、返却definitionのdeep freeze、shared package rootへの公開は後続sliceが所有する。

== 設計判断

#adr(
  header("render definition IDをprivate brandで区別する", Status.Accepted, "2026-07-12"),
  [
    `RenderDefinitionId`をplain stringまたはgenericな`Sha256Digest`のaliasにすると、未検証のdigestをdefinition identityとして入力できる。
    一方、wrapper objectを使うと既存のdigest APIとstring APIへ直接wideningできない。
  ],
  [
    `RenderDefinitionId`を`Sha256Digest`とprivateな必須`unique symbol` brandのintersectionとして定義する。
    DI1はbrandを型として公開するが、brandを発行するcreator、parser、guard、castを提供しない。
  ],
  [
    - genericなdigestまたはstringをdefinition IDへ直接代入できない
    - definition IDはgenericなdigestまたはstringとして読み出せる
    - lexicalに正しいdigestだけではdefinition preimageとの一致を証明できない
    - brand発行はclosed validationとcontent digestを所有するDI3に限定される
  ],
  alternatives: [
    1. *plain stringまたはgeneric digestのalias*: 未検証のdigestをdefinition IDとして入力できるため採用しない
    2. *opaque wrapper object*: digestとstringへのwideningを妨げるため採用しない
    3. *DI1でlexical parserまたはcastを提供する*: preimage検証なしでbrandを発行するため採用しない
  ],
)

#adr(
  header("reference claimをroleごとに異なる型にする", Status.Accepted, "2026-07-12"),
  [
    四つのreferentは同じ`Sha256Digest`表記を使うため、genericなclaim typeではobservation、response、body、exposureを交差代入できる。
    その代入はpreimage fieldとclaim semanticsの対応を型検査で失わせる。
  ],
  [
    各claimは固有の`schema`と`role` literal、およびgenericな`claimedId`を持つ独立したreadonly interfaceとする。
    `claimedId`は未信頼のreference payloadであり、referentの実在、target schema、self digest、role compatibilityを証明しない。
  ],
  [
    - claimの交差代入をliteral fieldで拒否できる
    - preimageは四つのroleをfield単位で固定できる
    - referent closureとaccepted definitionは後続validatorに残る
  ],
)

#adr(
  header("DI1のruntime surfaceをdomain errorだけに限定する", Status.Accepted, "2026-07-12"),
  [
    schema modelは型だけで表現できるが、後続のvalidationとidentity operationは一つのstable domain errorを共有する必要がある。
    未実装operationの仮exportはslice境界とbrand authorityを曖昧にする。
  ],
  [
    package-local facadeのruntime exportをimmutableな`RenderDefinitionError`だけにする。
    modelとerror codeはtype-onlyで再exportし、facadeのruntime dependencyをerror moduleだけに限定する。
  ],
  [
    - DI1だけでfailure vocabularyとerror immutabilityを検証できる
    - modelのtype-only consumerはruntime dependencyを持たない
    - creator、parser、digest、snapshot、hard limitを後続sliceより先に公開しない
  ],
)

#adr(
  header("DI2Aでdescriptor resource境界を独立させる", Status.Accepted, "2026-07-12"),
  [
    creatorとparserがcaller recordを通常のproperty accessで読むと、accessor実行、入力規模の無制限化、非同期処理中のmutation混入が起きる。
    nested aliasをschema pathごとに再列挙すると、同じobjectのdescriptor観測結果を一operation内で統一できない。
  ],
  [
    current-realmのordinary plain recordまたはnull-prototype recordだけを対象に、prototype、identity cache、own keys、hard limit、descriptor、structural rule、expected child discoveryの順で同期snapshotする。
    reflection結果はobject identityごとに再利用しつつ、schema pathごとのoccurrenceを保持する。
    package-internal surfaceには、凍結したpath、string own key、expected fieldのmissing/string/non-string/object stateだけを公開し、descriptor mapとcaller objectを公開しない。
  ],
  [
    - caller accessorとextra property valueを読まずにdescriptor resource境界を検証できる
    - callerが緩和できない固定上限でdescriptor workを制限できる
    - DI2Bはcaller recordを再読せずscalar validationとfresh constructionへ進める
    - DI2Aはmissing、extra、literal、digestをfailureへ分類しない
    - Proxyは標準APIでtrapなしに識別できないため入力契約外になる
  ],
  alternatives: [
    1. *descriptorとscalar validationを一revisionに束ねる*: resource boundaryを単独検証できずreview責務が過大になるため採用しない
    2. *operation-wide key counter*: expected childのdescriptor取得前にnested key数を確定できないため採用しない
    3. *MapまたはPropertyDescriptorを返す*: mutationとcaller object再読を後段へ漏らすため採用しない
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Render definition identity",
  summary: [
    closedなrender definition preimageのcanonical SHA-256 digestであることを表すnominal subtypeを定義する。
  ],
  format: [
    ```typescript
    declare const renderDefinitionIdBrand: unique symbol

    type RenderDefinitionId = Sha256Digest & {
      readonly [renderDefinitionIdBrand]: true
    }
    ```
  ],
  constraints: [
    - `renderDefinitionIdBrand`はmodel内部に留め、exportしない
    - brand propertyはreadonlyかつmandatoryとする
    - `string`またはgenericな`Sha256Digest`から`RenderDefinitionId`への代入は失敗する
    - `RenderDefinitionId`から`Sha256Digest`または`string`へのwideningは成功する
    - IDを発行するruntime APIはDI1に含めない
  ],
)

#interface_spec(
  name: "Role-specific reference claims",
  summary: [
    render definitionが参照する四つのroleを、schemaとrole literalが異なるclosed type shapeとして表す。
  ],
  format: [
    ```typescript
    interface RenderObservationReferenceClaim {
      readonly schema: "dathra.render-definition-observation-reference/1"
      readonly role: "observation-contract"
      readonly claimedId: Sha256Digest
    }

    interface RenderResponseReferenceClaim {
      readonly schema: "dathra.render-definition-response-reference/1"
      readonly role: "response-contribution-set"
      readonly claimedId: Sha256Digest
    }

    interface RenderBodyReferenceClaim {
      readonly schema: "dathra.render-definition-body-reference/1"
      readonly role: "ordered-body-plan"
      readonly claimedId: Sha256Digest
    }

    interface RenderExposureReferenceClaim {
      readonly schema: "dathra.render-definition-exposure-reference/1"
      readonly role: "exposure-contract"
      readonly claimedId: Sha256Digest
    }
    ```
  ],
  constraints: [
    - 各claimは`schema`、`role`、`claimedId`の三fieldだけを持つ
    - 全fieldをreadonlyとする
    - 四つのclaim typeは相互に代入できない
    - `claimedId`はgenericな`Sha256Digest`であり、accepted referentを表さない
  ],
)

#interface_spec(
  name: "Render definition records",
  summary: [
    四つのreference claimをversioned preimageへ配置し、identity wrapperとcreator inputの型shapeを固定する。
  ],
  format: [
    ```typescript
    interface RenderDefinitionPreimage {
      readonly schema: "dathra.render-definition/1"
      readonly observationContract: RenderObservationReferenceClaim
      readonly responseContributions: RenderResponseReferenceClaim
      readonly orderedBodyPlan: RenderBodyReferenceClaim
      readonly exposure: RenderExposureReferenceClaim
    }

    interface RenderDefinition {
      readonly id: RenderDefinitionId
      readonly preimage: RenderDefinitionPreimage
    }

    interface RenderDefinitionInput {
      readonly observationContractId: Sha256Digest
      readonly responseContributionSetId: Sha256Digest
      readonly orderedBodyPlanId: Sha256Digest
      readonly exposureContractId: Sha256Digest
    }
    ```
  ],
  constraints: [
    - 各interfaceはformatに示すfieldだけを持ち、全fieldをreadonlyとする
    - `RenderDefinitionInput`は未信頼のgeneric digestを保持し、validation済みsnapshotを表さない
    - readonly typeはruntime freezeを保証しない
  ],
)

#interface_spec(
  name: "Render definition failure",
  summary: [
    後続のclosed validationとcontent identity operationが共有するstable codeとimmutable pathを表す。
  ],
  format: [
    ```typescript
    type RenderDefinitionErrorCode =
      | "invalid-closed-record"
      | "invalid-field"
      | "invalid-reference"
      | "digest-mismatch"
      | "budget-exceeded"
      | "crypto-unavailable"

    class RenderDefinitionError extends TypeError {
      readonly code: RenderDefinitionErrorCode
      readonly path: readonly (string | number)[]
    }
    ```
  ],
  constraints: [
    - constructorは受け取ったpathを新しいarrayへcopyしてfreezeする
    - constructorは初期化後のerror objectをfreezeする
    - callerがconstructorへ渡したpathを後から変更してもerror pathは変わらない
    - error code unionへ別codeを追加しない
  ],
)

== 振る舞い仕様

#behavior_spec(
  name: "Domain error construction",
  summary: [
    stable code、path snapshot、messageを持つ変更不能な`TypeError`を生成する。
  ],
  preconditions: [
    - codeが`RenderDefinitionErrorCode`に属する
    - pathの各segmentがstringまたはnumberである
  ],
  steps: [
    1. messageを`TypeError`へ渡す
    2. error nameとcodeを設定する
    3. pathをfresh arrayへcopyしてfreezeする
    4. error objectをfreezeする
  ],
  postconditions: [
    - errorは`RenderDefinitionError`かつ`TypeError`である
    - source pathとerror pathは異なるarray identityを持つ
    - source path、error path、error codeへの後続mutationはerrorの観測値を変えない
  ],
)

#behavior_spec(
  name: "Closed descriptor snapshot",
  summary: [
    creatorの一record、またはparserのwrapper、preimage、四claimを固定preorderで同期snapshotする。
  ],
  preconditions: [
    - Proxyを入力しない
    - hard limitはown keys 16、property key 128 UTF-16 code unitsである
  ],
  steps: [
    1. occurrenceがnon-null objectで、prototypeがcurrent-realmの`Object.prototype`またはnullであることをown-key列挙前に検査する
    2. object identity cacheにsnapshotがあれば再利用する
    3. 未snapshot objectの`Reflect.ownKeys()`をexactly once呼ぶ
    4. key数16以下、全string key長128以下を順に検査する
    5. 上限内の全own keyのdescriptorをexactly once取得してidentity cacheへ保存する
    6. symbol、hidden property、accessorをrecord pathの`invalid-closed-record`で拒否する
    7. expected enumerable data descriptorだけからnested occurrenceをschema field orderで発見する
  ],
  postconditions: [
    - creatorは最大一occurrence、parserは最大六occurrenceを処理する
    - aliasのhost reflectionは一回で、pathごとのoccurrenceは独立して残る
    - key countまたはkey length超過はrecord pathの`budget-exceeded`になる
    - budget failureでは違反recordのdescriptor、後続record、extra valueを処理しない
  ],
)

#behavior_spec(
  name: "Sanitized descriptor occurrence projection",
  summary: [
    host reflection結果から、DI2Bがcallerを再読せず利用できるimmutableなschema occurrence viewを構築する。
  ],
  steps: [
    1. occurrenceごとにrecord kind、path、全string own keyをfresh arrayへcopyする
    2. expected field orderで、fieldをmissing、string、non-string、objectのいずれかへprojectする
    3. string stateだけがcaptured primitive stringを保持し、object stateはcaller objectを保持しない
    4. field、key、path、occurrence、root snapshotをfreezeする
  ],
  postconditions: [
    - output surfaceにMap、PropertyDescriptor、caller record、symbol keyを含めない
    - missing field、extra field、256 code unitsを超えるexpected stringもfailureへ分類せず保持する
    - nested expected fieldがprimitiveの場合は親field stateへ保持し、child occurrenceを作らない
    - schema、role、digestの意味検証とfresh domain record構築はDI2Bへ残る
  ],
)

== 機能仕様

#feature_spec(
  name: "RC01-DI1 package-local facade",
  summary: [
    render definitionの型modelとdomain errorだけをpackage-local facadeから公開する。
  ],
  api: [
    ```typescript
    export { RenderDefinitionError }
    export type {
      RenderDefinitionErrorCode,
      RenderDefinitionId,
      RenderObservationReferenceClaim,
      RenderResponseReferenceClaim,
      RenderBodyReferenceClaim,
      RenderExposureReferenceClaim,
      RenderDefinitionPreimage,
      RenderDefinition,
      RenderDefinitionInput,
    }
    ```
  ],
  test_cases: [
    - generic digestからdefinition IDへの代入拒否と、definition IDからdigestおよびstringへのwideningを検査する
    - 四つのclaim typeが全方向で交差代入できないことを検査する
    - claim、preimage、definition、inputのexact readonly shapeを検査する
    - error codeのexact unionとerrorのcopy、freeze、継承を検査する
    - facadeのsource ASTでexport名、type-only区分、module specifierを検査する
    - facadeのruntime keyが`RenderDefinitionError`だけであることを検査する
    - facade emitがerror以外のruntime dependencyを持たないことを検査する
    - creator、parser、ID parser、ID guard、ID cast、accepted definitionがfacadeに存在しないことをnegative type fixtureで検査する
    - DI1の全exportをshared package rootからimportできないことをnegative type fixtureで検査する
  ],
)

#feature_spec(
  name: "RC01-DI2A package-internal descriptor snapshot",
  summary: [
    DI2Bがscalar validationを行う前に使用する、creator/parser共通のdescriptor occurrence snapshotを提供する。
  ],
  api: [
    ```typescript
    type RenderDefinitionDescriptorRecordKind =
      | "creator-input"
      | "wrapper"
      | "preimage"
      | "observation-claim"
      | "response-claim"
      | "body-claim"
      | "exposure-claim"

    type RenderDefinitionDescriptorFieldSnapshot =
      | { readonly key: string; readonly state: "missing" }
      | { readonly key: string; readonly state: "string"; readonly value: string }
      | { readonly key: string; readonly state: "non-string" }
      | { readonly key: string; readonly state: "object" }

    interface RenderDefinitionDescriptorOccurrence {
      readonly kind: RenderDefinitionDescriptorRecordKind
      readonly path: readonly string[]
      readonly ownKeys: readonly string[]
      readonly fields: readonly RenderDefinitionDescriptorFieldSnapshot[]
    }

    interface RenderDefinitionDescriptorSnapshot {
      readonly occurrences: readonly RenderDefinitionDescriptorOccurrence[]
    }

    function snapshotRenderDefinitionCreatorDescriptors(
      value: unknown,
    ): RenderDefinitionDescriptorSnapshot

    function snapshotRenderDefinitionParserDescriptors(
      value: unknown,
    ): RenderDefinitionDescriptorSnapshot
    ```
  ],
  test_cases: [
    - plain recordとnull-prototype recordを受理し、creator一occurrenceとparser六occurrenceを固定preorderで返す
    - prototype、ownKeys、key count、key length、descriptor、structural rule、child discoveryの順序をprobeする
    - 16 keysと128 key code unitsのboundaryとboundary plus oneを検査する
    - aliasのownKeysとdescriptorが一回で、path occurrenceが別に残ることを検査する
    - nested failureでancestor descriptorだけを読み、違反recordと後続recordを処理しないことを検査する
    - accessor、hidden、symbolをgetter実行なしの`invalid-closed-record`とrecord pathで拒否する
    - missing、extra、long string、wrong literal、malformed digestをDI2Aでは拒否しないことを検査する
    - nested expected fieldのmissing、string、null、numberを親field stateへ保持し、DI2Aでは拒否しないことを検査する
    - extra property valueのProxy trapを実行しないことを検査する
    - outputがimmutableで、Map、descriptor、caller objectを公開しないことを検査する
    - package-local facadeとshared rootへDI2A APIを追加しない
  ],
)

== 責務境界

- record key cap、property key cap、descriptor preflight、identity cache、schema occurrence projectionはDI2Aが所有する
- expected string cap、missing/extra classification、schema/role/digest validation、fresh preimageとunbranded wrapper構築はDI2Bが所有する
- DI2AとDI2Bのhard limitはcaller optionにせず、package-local facadeとshared rootへAPIを追加しない
- creator、verified parser、canonical digest、brand発行、returned recordのdeep freeze、crypto error変換はDI3が所有する
- referent closureとaccepted definitionは後続RC01 unitが所有する
- `RenderEnvelope`、generation、publication、writer、authority、runtime conformanceは後続unitが所有する
- shared package rootまたはrole-scoped subpathへの公開はAS01が所有する
- DI1はdescriptorを読み取らず、recordを生成またはfreezeせず、WebCryptoとcanonical identity operationを呼び出さない
- DI2Aはscalar semantic validation、domain record構築、canonicalization、content digest、wrapper ID equality、WebCrypto、brand発行、public creator/parser、deep freezeを実行しない
