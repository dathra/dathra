= render definition model

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

render outputを構成する四つのreference claimを、一つのversioned preimageへ束縛するpackage-localな型契約を定義する。

このsliceはnominal ID、role-specific claim、definition record、creator input、domain errorだけを提供する。
content identity operationとshared package rootへの公開は後続sliceが所有する。

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

== 責務境界

- hard-limit valueとoption、descriptor preflight、closed synchronous snapshot、validation order、parser behaviorはDI2が所有する
- creator、verified parser、canonical digest、brand発行、returned recordのdeep freeze、crypto error変換はDI3が所有する
- referent closureとaccepted definitionは後続RC01 unitが所有する
- `RenderEnvelope`、generation、publication、writer、authority、runtime conformanceは後続unitが所有する
- shared package rootまたはrole-scoped subpathへの公開はAS01が所有する
- DI1はdescriptorを読み取らず、recordを生成またはfreezeせず、WebCryptoとcanonical identity operationを呼び出さない
