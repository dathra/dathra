= artifact contract type domains

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

artifact addressをgenericなSHA-256 digestや他のdigest domainから区別し、後続のartifact contractが誤ったdomainの値をaddress fieldへ入力できないpackage-localなnominal subtypeを定義する。

artifact finalizationの決定項目をexactなclosed productとして固定し、unsupportedなliteral、欠落したfield、変更されたproperty modifierを後続のaddress preimageへ混入させないpackage-localなtypeを定義する。

artifact内のentry責務とentry invocation順序のclaimをexactなclosed productとして固定し、unsupportedなrole、欠落したfield、変更されたproperty modifierを後続のaddress preimageへ混入させないpackage-localなtypeを定義する。

artifactのdependency slotが参照するartifact addressとexport nameのclaimをexactなclosed productとして固定し、unsupportedなdependency kind、欠落したfield、変更されたproperty modifierを後続のaddress preimageへ混入させないpackage-localなtypeを定義する。

artifactが公開するexport name、member semantic ID、export責務のclaimをexactなclosed productとして固定し、unsupportedなexport role、欠落したfield、変更されたproperty modifierを後続のaddress preimageへ混入させないpackage-localなtypeを定義する。

deployment identityのpersistent identity inputをexactなclosed productとして固定し、欠落したfield、別domainのdigest、変更されたproperty modifierを後続のdeployment snapshot、validation、digest operationへ混入させないpackage-localなtypeを定義する。

これらのAPIはtype-only foundationであり、runtime operationとshared package rootの公開面を増やさない。

== 設計判断

#adr(
  header("artifact addressを独立したnominal digest domainにする", Status.Accepted, "2026-07-12"),
  [
    artifact addressをplain stringまたはgenericな`Sha256Digest`のaliasにすると、exact-byte digest、URL、他domainのdigestをaddress fieldへ代入できる。
    一方、opaque wrapper objectでは既存のdigest APIとstring APIへ直接wideningできない。
  ],
  [
    `ArtifactAddressId`を`Sha256Digest`とprivateな必須`unique symbol` brandのintersectionとして定義する。
    package-local facadeからtype-onlyで提供し、brandを発行するruntime operationとshared package root exportは追加しない。
  ],
  [
    - generic digestや他のnominal digest subtypeをartifact addressとして直接入力できない
    - artifact addressはgeneric digestまたはstringとして読み出せる
    - 基礎型へwideningした後はnominal domainを復元できないため、基礎型を経由したdomain separationは保証しない
    - 後続producerはartifact addressの意味を検証するidentity operationからだけbrandを返す必要がある
  ],
  alternatives: [
    1. *plain stringまたはgeneric digestのalias*: address fieldへの誤入力を拒否できないため採用しない
    2. *opaque wrapper object*: canonical digestとして既存APIへwideningできないため採用しない
    3. *このunitでcreatorまたはparserを提供する*: preimageとcanonical validationが未確定のまま文字列形状をprovenanceとして扱うため採用しない
  ],
)

#adr(
  header("artifact finalization templateをclosed productにする", Status.Accepted, "2026-07-12"),
  [
    artifactのwrapper、dependency reference、export emission、entry invocation、source separator、wasm binding、data bindingが異なれば、後続のartifact address identity inputも異なる。
    openなstring fieldまたはoptional fieldを許すrecordでは、未定義のfinalization方式や暗黙のdefaultがidentity inputへ入る。
  ],
  [
    `ArtifactFinalizationTemplate`を10個のrequiredかつreadonlyなpropertyからなるinterfaceとして定義する。
    各property typeは採用済みのliteralまたはliteral unionだけに限定し、focused modelからpackage-local facadeへtype-onlyで提供する。
    parser、creator、validator、guard、cast、binding、aggregate、URL、integrity、closure、shared package root exportは追加しない。
  ],
  [
    - 後続contractはfinalization方式のclosed vocabularyを再利用できる
    - type fixtureはkeys、property types、required modifier、readonly modifierの変更を検出できる
    - typeへの適合はcanonicality、provenance、trust、artifactの実在を証明しない
    - runtime validationとidentity operationは後続unitに残る
  ],
  alternatives: [
    1. *openなstring record*: unsupportedな方式とliteral wideningを拒否できないため採用しない
    2. *runtime enum object*: type-only contractにruntime valueとinitializationを追加するため採用しない
    3. *address preimage aggregateと同時に提供する*: 後続bindingとidentity inputをplaceholderとして公開するため採用しない
  ],
)

#adr(
  header("artifact entry bindingをrole unionとclosed productで表す", Status.Accepted, "2026-07-12"),
  [
    artifact address preimageは、各entryの責務、semantic identity claim、finalized module上のexport name claim、canonical invocation sequence上のordinal claimを区別する必要がある。
    openなstring role、optional field、mutable fieldを許すrecordでは、未定義のentry責務や暗黙のdefaultがidentity inputへ入る。
  ],
  [
    `ArtifactEntryRole`を3個のliteralからなるunion、`ArtifactEntryBinding`を4個のrequiredかつreadonlyなpropertyからなるinterfaceとして定義する。
    二つのtypeを同じfocused modelに置き、package-local facadeからtype-onlyで提供する。
    parser、creator、validator、aggregate、dependency binding、export binding、URL、integrity、closure、identity operation、shared package root exportは追加しない。
  ],
  [
    - 後続contractはentry roleとbindingのclosed vocabularyを再利用できる
    - type fixtureはrole union、keys、property types、required modifier、readonly modifierの変更を検出できる
    - typeへの適合はsemantic IDまたはexportの実在、ordinalのsafe integer、nonnegative、gap-free、一意性、canonical order、provenance、trustを証明しない
    - semantic canonical validationとidentity operationは後続unitに残る
  ],
  alternatives: [
    1. *roleをinline unionだけにする*: 採択済みschemaが要求する`ArtifactEntryRole` surfaceを失うため採用しない
    2. *runtime enum object*: type-only contractにruntime valueとinitializationを追加するため採用しない
    3. *ordinal validationを同時に提供する*: collection全体なしではgap-freeまたはuniqueを判定できないため採用しない
    4. *dependency、export、aggregateと同時に提供する*: 独立して検証できる後続contractを束ねるため採用しない
  ],
)

#adr(
  header("artifact dependency bindingをinline kind unionとclosed productで表す", Status.Accepted, "2026-07-13"),
  [
    artifact address preimageは、finalized artifact内のdependency slot、reference方式、参照先artifact address、参照先export name claimを区別する必要がある。
    openなstring kind、optional field、mutable fieldを許すrecordでは、未定義のdependency方式や暗黙のdefaultがidentity inputへ入る。
  ],
  [
    `ArtifactDependencyBinding`を4個のrequiredかつreadonlyなpropertyからなるinterfaceとして定義する。
    `kind`は`static-import`、`dynamic-import`、`wasm-import`、`data-reference`のinlineなclosed literal unionとし、`ArtifactDependencyKind` aliasは追加しない。
    focused modelからpackage-local facadeへtype-onlyで提供する。
    validation、target existence、ordering、duplicates、identity issuance、URL、integrity、trust、aggregate、root publication、parser、creator、guard、runtime behaviorは追加しない。
  ],
  [
    - 後続contractはdependency bindingのclosed productをidentity inputとして再利用できる
    - type fixtureはkeys、property types、required modifier、readonly modifier、closed kind unionの変更を検出できる
    - typeへの適合はslotまたはtarget exportの妥当性、target artifactの実在、canonical order、一意性、provenance、trustを証明しない
    - semantic canonical validation、collection invariant、identity operationは後続unitに残る
  ],
  alternatives: [
    1. *`ArtifactDependencyKind` aliasを追加する*: 採択済みcontractに存在しないtype surfaceを増やすため採用しない
    2. *kindをopenなstringにする*: unsupportedなdependency方式を拒否できないため採用しない
    3. *runtime enum objectを追加する*: type-only contractにruntime valueとinitializationを追加するため採用しない
    4. *validationまたはaggregateと同時に提供する*: 単一bindingでは判定できないordering、duplicates、target existenceをこのleaf contractへ混入させるため採用しない
  ],
)

#adr(
  header("artifact export bindingをinline role unionとclosed productで表す", Status.Accepted, "2026-07-13"),
  [
    artifact address preimageは、finalized artifact上のexport name、参照先memberのsemantic identity claim、exportの責務を区別する必要がある。
    openなstring role、optional field、mutable fieldを許すrecordでは、未定義のexport責務や暗黙のdefaultがidentity inputへ入る。
  ],
  [
    `ArtifactExportBinding`を3個のrequiredかつreadonlyなpropertyからなるinterfaceとして定義する。
    property名はentry bindingの`exportedName`ではなく`exportName`とし、`memberSemanticId`はplain `string`のまま保持する。
    `exportRole`は`definition`、`integration-provider`、`runtime-bootstrap`、`registry-implementation`、`data-handle`、`wasm-binding`のinlineなclosed literal unionとし、`ArtifactExportRole`または別のhelper aliasは追加しない。
    focused modelからpackage-local facadeへtype-onlyで提供する。
    export table、aggregate、preimage、name validation、member-role validation、canonical ordering、duplicate rejection、identity issuance、URL、integrity、trust、provenance、closure、parser、creator、guard、cast、root publication、runtime behavior、client inclusionは追加しない。
  ],
  [
    - 後続contractはexport bindingのclosed productをpersistent artifact identity inputとして再利用できる
    - type fixtureはkeys、property types、required modifier、readonly modifier、closed role unionの変更を検出できる
    - typeへの適合はexport nameまたはmemberの実在、memberとroleの整合、canonical order、一意性、provenance、trustを証明しない
    - semantic canonical validation、collection invariant、identity operationは後続unitに残る
  ],
  alternatives: [
    1. *`ArtifactExportRole` aliasを追加する*: 採択済みcontractに存在しないtype surfaceを増やすため採用しない
    2. *entry bindingと同じ`exportedName`を使う*: artifactが公開するbinding側のschema名`exportName`を失うため採用しない
    3. *roleをopenなstringにする*: unsupportedなexport責務とclient inclusionを拒否できないため採用しない
    4. *validationまたはaggregateと同時に提供する*: 単一bindingでは判定できないname existence、member-role整合、ordering、duplicatesをこのleaf contractへ混入させるため採用しない
  ],
)

#adr(
  header("deployment identity preimageをgeneric digestからなるclosed productにする", Status.Accepted, "2026-07-13"),
  [
    deployment identityはapplication namespace、release、target environment、public origin、contract namespace graph、host profile setを一つのpersistent identity inputとして区別する必要がある。
    optionalまたはmutableなfield、別のdeployment固有digest brandを持つrecordでは、後続のsnapshot、validation、digest operationとartifact address preimageの境界が曖昧になる。
  ],
  [
    `DeploymentIdentityPreimage`を7個のrequiredかつreadonlyなpropertyからなるinterfaceとして定義する。
    3個のdigest fieldはgenericな`Sha256Digest`をそのまま使い、`DeploymentIdentityDigest`、`DeploymentIdentityId`、brand、source aliasを追加しない。
    focused modelからpackage-local facadeへtype-onlyで提供する。
    snapshot、validator、normalizer、parser、creator、digest operation、URL、artifact address preimage aggregate、root publication、runtime valueは追加しない。
  ],
  [
    - 後続contractはdeployment identityのexactなpersistent identity inputを再利用できる
    - type fixtureはkeys、property types、required modifier、readonly modifierの変更を検出できる
    - typeへの適合はstring syntax、origin canonicality、namespaceまたはhost profileの実在、canonicality、provenance、trust、deployment admissionを証明しない
    - hostile input snapshotはAR01-DS、semantic canonical validationはAR01-DV、canonical digestはAR01-DDに残る
  ],
  alternatives: [
    1. *deployment固有digestまたはID brandを追加する*: preimage schemaと後続digest operationを同じtype-only unitへ混在させるため採用しない
    2. *digest fieldをplain stringにする*: generic SHA-256 digest contractを失うため採用しない
    3. *artifact address preimageと同時に提供する*: 独立して検証できるpersistent identity schemaと共有facade更新を一つのrevisionへ束ねるため採用しない
    4. *validatorまたはdigest operationを同時に提供する*: untrustedなtype-level vocabularyへcanonicalityまたはidentityの証明責務を混入させるため採用しない
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Artifact address identity",
  summary: [
    `dathra.artifact-address` domainのcanonical preimageからID01のSHA-256 operationで導出されるdigestを、独立したnominal subtypeとして表す。
  ],
  format: [
    ```typescript
    import type { Sha256Digest } from "../canonicalIdentity/implementation"

    declare const artifactAddressIdBrand: unique symbol

    type ArtifactAddressId = Sha256Digest & {
      readonly [artifactAddressIdBrand]: true
    }
    ```
  ],
  constraints: [
    - `artifactAddressIdBrand`はmodel内部に留め、exportしない
    - `string`またはgenericな`Sha256Digest`から`ArtifactAddressId`への代入は失敗する
    - `ArtifactAddressId`から`Sha256Digest`または`string`へのwideningは成功する
    - distinctな必須`unique symbol` brandを持つnominal digest subtypeとの直接代入は両方向で失敗する
    - package-local facade、model、type-only consumerはruntime import edge、runtime value、top-level effectを持たない
    - shared package rootへの公開はAS01が所有する
  ],
)

#interface_spec(
  name: "Artifact finalization template",
  summary: [
    artifact bytesをfinalizeする際にidentity inputへ含める決定項目を、requiredかつreadonlyなclosed productとして表す。
  ],
  format: [
    ```typescript
    interface ArtifactFinalizationTemplate {
      readonly schema: "dathra.artifact-finalization/1"
      readonly textEncoding: "utf-8"
      readonly moduleFormat: "esm"
      readonly wrapper:
        | "none"
        | "runtime-registration"
        | "integration-registration"
      readonly dependencyReference:
        | "canonical-relative-url"
        | "canonical-absolute-url"
      readonly exportEmission: "sorted-named-exports"
      readonly entryInvocation: "none" | "sorted-registration-calls"
      readonly sourceSeparator: "lf-semicolon"
      readonly wasmBinding: "external-module" | "none"
      readonly dataBinding: "external-fetch" | "none"
    }
    ```
  ],
  constraints: [
    - `keyof ArtifactFinalizationTemplate`は記載した10個のpropertyだけである
    - 全propertyはrequiredかつreadonlyであり、index signatureを持たない
    - 各property typeは記載したliteralまたはliteral unionと双方向に一致する
    - `ArtifactFinalizationTemplate`は`finalizationTemplateModel`内部で定義し、package-local facadeからtype-onlyで提供する
    - facade、address model、finalization template model、type-only consumerはruntime import edge、runtime value、top-level effectを持たない
    - shared package rootへの公開はAS01が所有する
  ],
)

#interface_spec(
  name: "Artifact entry binding",
  summary: [
    artifact内のentry責務とidentity、export、invocation ordinalのclaimを、closed role unionとrequiredかつreadonlyなclosed productとして表す。
  ],
  format: [
    ```typescript
    type ArtifactEntryRole =
      | "runtime-entry"
      | "integration-entry"
      | "definition-entry"

    interface ArtifactEntryBinding {
      readonly role: ArtifactEntryRole
      readonly entrySemanticId: string
      readonly exportedName: string
      readonly invocationOrdinal: number
    }
    ```
  ],
  constraints: [
    - `ArtifactEntryRole`は記載した3個のliteralと双方向に一致する
    - `keyof ArtifactEntryBinding`は記載した4個のpropertyだけである
    - 全propertyはrequiredかつreadonlyであり、index signatureを持たない
    - 各property typeは記載したtypeと双方向に一致する
    - `ArtifactEntryRole`と`ArtifactEntryBinding`は`entryBindingModel`内部で定義し、package-local facadeからtype-onlyで提供する
    - facade、entry binding model、type-only consumerはruntime import edge、runtime value、top-level effectを持たない
    - shared package rootへの公開はAS01が所有する
  ],
)

#interface_spec(
  name: "Artifact dependency binding",
  summary: [
    artifact dependencyのslot、kind、target artifact address、target export nameのclaimを、requiredかつreadonlyなclosed productとして表す。
  ],
  format: [
    ```typescript
    import type { ArtifactAddressId } from "./model"

    interface ArtifactDependencyBinding {
      readonly slot: string
      readonly kind:
        | "static-import"
        | "dynamic-import"
        | "wasm-import"
        | "data-reference"
      readonly targetArtifactAddressId: ArtifactAddressId
      readonly targetExportName: string | null
    }

    export type { ArtifactDependencyBinding }
    ```
  ],
  constraints: [
    - `keyof ArtifactDependencyBinding`は記載した4個のpropertyだけである
    - 全propertyはrequiredかつreadonlyであり、index signatureを持たない
    - 各property typeは記載したtypeと双方向に一致する
    - `kind`は記載した4個のliteralからなるinline unionであり、`ArtifactDependencyKind` aliasを追加しない
    - `targetArtifactAddressId`はpackage-localな`ArtifactAddressId`そのものであり、plain stringまたはgeneric digestへwidenしない
    - `targetExportName`は`string | null`であり、missing、`undefined`、またはnon-null stringだけへ変更しない
    - `ArtifactDependencyBinding`は`dependencyBindingModel`内部で定義し、package-local facadeからtype-onlyで提供する
    - facade、dependency binding model、type fixture、type-only consumerはruntime import edge、runtime value、top-level effectを持たない
    - shared package rootへの公開はAS01が所有する
  ],
)

#interface_spec(
  name: "Artifact export binding",
  summary: [
    artifact exportのname、member semantic identity、roleのclaimを、requiredかつreadonlyなclosed productとして表す。
  ],
  format: [
    ```typescript
    interface ArtifactExportBinding {
      readonly exportName: string
      readonly memberSemanticId: string
      readonly exportRole:
        | "definition"
        | "integration-provider"
        | "runtime-bootstrap"
        | "registry-implementation"
        | "data-handle"
        | "wasm-binding"
    }

    export type { ArtifactExportBinding }
    ```
  ],
  constraints: [
    - `keyof ArtifactExportBinding`は記載した3個のpropertyだけである
    - 全propertyはrequiredかつreadonlyであり、index signatureを持たない
    - 各property typeは記載したtypeと双方向に一致する
    - property名は`exportName`であり、entry bindingの`exportedName`ではない
    - `exportName`と`memberSemanticId`はplain `string`であり、`null`または他のdomainを追加しない
    - `exportRole`は記載した6個のliteralからなるinline unionであり、`ArtifactExportRole`または別のhelper aliasを追加しない
    - `ArtifactExportBinding`は`exportBindingModel`内部で定義し、package-local facadeからtype-onlyで提供する
    - facade、export binding model、type fixture、type-only consumerはruntime import edge、runtime value、top-level effectを持たない
    - shared package rootへの公開はAS01が所有する
  ],
)

#interface_spec(
  name: "Deployment identity preimage",
  summary: [
    deployment identityのpersistent identity inputを、genericなSHA-256 digestとplain stringからなるrequiredかつreadonlyなclosed productとして表す。
  ],
  format: [
    ```typescript
    import type { Sha256Digest } from "../canonicalIdentity/implementation"

    interface DeploymentIdentityPreimage {
      readonly schema: "dathra.deployment-identity/1"
      readonly applicationNamespaceDigest: Sha256Digest
      readonly releaseIdentity: string
      readonly targetEnvironmentId: string
      readonly canonicalPublicOrigin: string
      readonly contractNamespaceGraphDigest: Sha256Digest
      readonly hostProfileSetDigest: Sha256Digest
    }

    export type { DeploymentIdentityPreimage }
    ```
  ],
  constraints: [
    - `keyof DeploymentIdentityPreimage`は記載した7個のpropertyだけである
    - 全propertyはrequiredかつreadonlyであり、index signatureを持たない
    - 各property typeは記載したliteral、plain `string`、またはgenericな`Sha256Digest`と双方向に一致する
    - `DeploymentIdentityDigest`、`DeploymentIdentityId`、brand、source aliasを追加しない
    - `DeploymentIdentityPreimage`は`deploymentIdentityModel`内部で定義し、package-local facadeの末尾からtype-onlyで提供する
    - facade、deployment identity model、type fixture、type-only consumerはruntime import edge、runtime value、top-level effectを持たない
    - shared package rootへの公開はAS01が所有する
  ],
)

== 振る舞い仕様

#behavior_spec(
  name: "Nominal assignment boundary",
  summary: [
    artifact address fieldへの入力方向だけをnominal brandで保護し、canonical digestまたはstringとしての読み出しを妨げない。
  ],
  preconditions: [
    - 入力候補がplain string、generic digest、artifact address、または別nominal digest subtypeのいずれかである
  ],
  steps: [
    1. address fieldへの入力時にprivate brandの存在を型検査する
    2. brandを持たない値または別brandだけを持つ値を拒否する
    3. address IDの読み出し時は基礎型`Sha256Digest`または`string`へのwideningを許可する
  ],
  postconditions: [
    - address domain以外の値をaddress fieldへ直接代入できない
    - address IDを既存のdigest APIまたはstring APIへ渡せる
  ],
)

#behavior_spec(
  name: "Finalization template structural boundary",
  summary: [
    finalization template自身のkeys、property types、required modifier、readonly modifierを型検査で固定する。
  ],
  preconditions: [
    - 比較対象が採用済みtemplateまたはmissing、extra、optional、mutable、widened variantである
  ],
  steps: [
    1. templateのkeysが採用済み10 propertyと双方向に一致することを検査する
    2. 各property typeが採用済みliteralまたはliteral unionと双方向に一致することを検査する
    3. 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    4. missing、extra、optional、mutable、widened variantがexact contractと一致しないことを検査する
  ],
  postconditions: [
    - package-local type contractのclosed product shapeを変更する差分を検出できる
    - runtime value、runtime validation、identity operationは追加されない
  ],
)

#behavior_spec(
  name: "Entry binding structural boundary",
  summary: [
    entry role unionとentry binding自身のkeys、property types、required modifier、readonly modifierを型検査で固定する。
  ],
  preconditions: [
    - 比較対象が採用済みroleまたは追加、欠落、widened role variantである
    - 比較対象が採用済みbindingまたはmissing、extra、optional、mutable、widened、role変更、ordinal変更variantである
  ],
  steps: [
    1. role unionが採用済み3 literalと双方向に一致することを検査する
    2. bindingのkeysが採用済み4 propertyと双方向に一致することを検査する
    3. 各property typeが採用済みtypeと双方向に一致することを検査する
    4. 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    5. missing、extra、optional、mutable、widened、role変更、ordinal変更variantがexact contractと一致しないことを検査する
  ],
  postconditions: [
    - package-local type contractのclosed unionまたはclosed product shapeを変更する差分を検出できる
    - runtime value、runtime validation、identity operationは追加されない
  ],
)

#behavior_spec(
  name: "Dependency binding structural boundary",
  summary: [
    dependency binding自身のkeys、property types、required modifier、readonly modifier、inline closed kind unionを型検査で固定する。
  ],
  preconditions: [
    - 比較対象が採択済みbindingまたはmissing、extra、optional、mutable、widened、kind変更、target address変更、target export nullability変更variantである
  ],
  steps: [
    1. bindingのkeysが採択済み4 propertyと双方向に一致することを検査する
    2. `kind` unionが採択済み4 literalと双方向に一致することを検査する
    3. 各property typeが採択済みtypeと双方向に一致することを検査する
    4. 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    5. missing、extra、optional、mutable、widened、kind変更、target address変更、target export nullability変更variantがexact contractと一致しないことを検査する
  ],
  postconditions: [
    - package-local type contractのclosed unionまたはclosed product shapeを変更する差分を検出できる
    - validation、collection invariant、runtime value、runtime behavior、identity operationは追加されない
  ],
)

#behavior_spec(
  name: "Export binding structural boundary",
  summary: [
    export binding自身のkeys、property types、required modifier、readonly modifier、inline closed role unionを型検査で固定する。
  ],
  preconditions: [
    - 比較対象が採択済みbindingまたはmissing member semantic ID、extra integrity、optional、all-mutable、string field widening、unsupported role variantである
  ],
  steps: [
    1. bindingのkeysが採択済み3 propertyと双方向に一致することを検査する
    2. `exportRole` unionが採択済み6 literalと双方向に一致することを検査する
    3. `exportName`と`memberSemanticId`がplain `string`であることを検査する
    4. 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    5. missing member semantic ID、extra integrity、optional、all-mutable、両string fieldの`string | null` widening、unsupported role variantがexact contractと一致しないことを検査する
  ],
  postconditions: [
    - package-local type contractのclosed unionまたはclosed product shapeを変更する差分を検出できる
    - validation、collection invariant、runtime value、runtime behavior、identity operationは追加されない
  ],
)

#behavior_spec(
  name: "Deployment identity preimage structural boundary",
  summary: [
    deployment identity preimage自身のkeys、property types、required modifier、readonly modifierを型検査で固定する。
  ],
  preconditions: [
    - 比較対象が採択済みpreimageまたはmissing、extra、optional、mutable、wrong schema、widened digest、widened string variantである
  ],
  steps: [
    1. preimageのkeysが採択済み7 propertyと双方向に一致することを検査する
    2. 3個のdigest fieldがgenericな`Sha256Digest`、3個のidentity fieldがplain `string`、`schema`が採択済みliteralと双方向に一致することを検査する
    3. 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    4. missing、extra、optional、mutable、wrong schema、widened digest、widened string variantがexact contractと一致しないことを検査する
  ],
  postconditions: [
    - package-local type contractのclosed product shapeを変更する差分を検出できる
    - snapshot、validation、digest operation、runtime value、runtime behaviorは追加されない
  ],
)

== 機能仕様

#feature_spec(
  name: "Type-only artifact address domain",
  summary: [
    後続address identity operationを仮実装せず、`ArtifactAddressId`をpackage-local facadeから提供する。
  ],
  api: [
    ```typescript
    type ArtifactAddressId = Sha256Digest & {
      readonly [artifactAddressIdBrand]: true
    }
    ```
  ],
  edge_cases: [
    - `ArtifactAddressId`は`never`へ縮退しない
    - genericな`Sha256Digest`をwidening経由で再brand化できない
    - 別nominal digest subtypeと直接相互代入できない
  ],
  test_cases: [
    - `IsNever<ArtifactAddressId>`が`false`であることをtype fixtureで検査する
    - `ArtifactAddressId extends Sha256Digest`が`true`、逆方向が`false`であることを検査する
    - plain string、generic digest、別nominal digest subtypeからの代入拒否を検査する
    - `ArtifactAddressId`からgeneric digestとstringへの代入成功を検査する
    - 別brandとの直接代入を両方向で拒否することを検査する
    - creator、parser、guard、preimage typeがfacadeに存在しないことを検査する
    - facadeのASTが6個のfocused modelから現行の7 typeだけを採択済み順序でtype-only exportすることを検査する
    - facade、全6 model、全type fixtureのmemory emitがmodule marker `export {};`だけであることを検査する
    - type-only consumerのmemory emitにruntime import edgeがないことを検査する
    - shared package rootから`ArtifactAddressId`をimportできないことを検査する
  ],
)

#feature_spec(
  name: "Type-only artifact finalization template",
  summary: [
    `ArtifactFinalizationTemplate`をpackage-local facadeへtype-onlyで提供し、現行の累積facadeでは後続追加済みbinding contractと共存させる。
  ],
  api: [
    ```typescript
    interface ArtifactFinalizationTemplate {
      readonly schema: "dathra.artifact-finalization/1"
      readonly textEncoding: "utf-8"
      readonly moduleFormat: "esm"
      readonly wrapper:
        | "none"
        | "runtime-registration"
        | "integration-registration"
      readonly dependencyReference:
        | "canonical-relative-url"
        | "canonical-absolute-url"
      readonly exportEmission: "sorted-named-exports"
      readonly entryInvocation: "none" | "sorted-registration-calls"
      readonly sourceSeparator: "lf-semicolon"
      readonly wasmBinding: "external-module" | "none"
      readonly dataBinding: "external-fetch" | "none"
    }
    ```
  ],
  edge_cases: [
    - literal unionに未定義の値を追加しない
    - propertyをoptionalまたはmutableにしない
    - string、index signature、追加propertyでclosed productをwidenしない
    - typeへの適合をcanonicality、provenance、trust、artifactの実在の証拠として扱わない
  ],
  test_cases: [
    - `keyof`と全property typeが期待型と双方向に一致することを検査する
    - 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    - missing、extra、optional、mutable、widened variantがexact contractと一致しないことを検査する
    - facadeのASTが6個のfocused modelから現行の`ArtifactAddressId`、`ArtifactFinalizationTemplate`、`ArtifactEntryRole`、`ArtifactEntryBinding`、`ArtifactDependencyBinding`、`ArtifactExportBinding`、`DeploymentIdentityPreimage`だけをこの順でtype-only exportすることを検査する
    - facade、全model、全type fixture、type-only consumerのmemory emitがruntime edge、value、effectを持たないことを検査する
    - 後続aggregate、validator、identity operation、URL、integrity、closureがfacadeに存在しないことを検査する
    - shared package rootから`ArtifactFinalizationTemplate`をimportできないことを検査する
    - shared packageを一時出力先へbuildし、生成された`index.d.mts`と`index.d.cts`のexport surfaceに現行の7 typeと禁止されたhelper aliasが存在せず、既存root typeが存在することを検査する
  ],
)

#feature_spec(
  name: "Type-only artifact entry binding",
  summary: [
    `ArtifactEntryRole`と`ArtifactEntryBinding`をpackage-local facadeへtype-onlyで提供し、現行の累積facadeではdependency bindingおよびexport bindingと共存させる。
  ],
  api: [
    ```typescript
    type ArtifactEntryRole =
      | "runtime-entry"
      | "integration-entry"
      | "definition-entry"

    interface ArtifactEntryBinding {
      readonly role: ArtifactEntryRole
      readonly entrySemanticId: string
      readonly exportedName: string
      readonly invocationOrdinal: number
    }
    ```
  ],
  edge_cases: [
    - role unionに未定義の値を追加せず、`string`へwidenしない
    - propertyをoptionalまたはmutableにしない
    - string propertyまたはordinal propertyを他のtypeへwidenしない
    - typeへの適合をsemantic IDまたはexportの実在、ordinalのsafe integer、nonnegative、gap-free、一意性、canonical order、provenance、trustの証拠として扱わない
  ],
  test_cases: [
    - role unionが期待する3 literalと双方向に一致することを検査する
    - `keyof`と全property typeが期待型と双方向に一致することを検査する
    - 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    - missing、extra、optional、mutable、widened、role変更、ordinal変更variantがexact contractと一致しないことを非空なnegative fixtureで検査する
    - facadeのASTが6個のfocused modelから現行の7 typeだけを採択済み順序でtype-only exportすることを検査する
    - facade、全model、type fixture、type-only consumerのmemory emitがruntime edge、value、effectを持たないことを検査する
    - 後続aggregate、validator、identity operation、URL、integrity、closureがfacadeに存在しないことを検査する
    - shared package rootから`ArtifactEntryRole`と`ArtifactEntryBinding`をimportできないことを検査する
    - shared packageを一時出力先へbuildし、生成された`index.d.mts`と`index.d.cts`のexport surfaceに現行の7 typeと禁止されたhelper aliasが存在せず、既存root typeが存在することを検査する
  ],
)

#feature_spec(
  name: "Type-only artifact dependency binding",
  summary: [
    validator、aggregate、identity operationを仮実装せず、`ArtifactDependencyBinding`を現行のpackage-local facadeでexport bindingと共存させる。
  ],
  api: [
    ```typescript
    import type { ArtifactAddressId } from "./model"

    interface ArtifactDependencyBinding {
      readonly slot: string
      readonly kind:
        | "static-import"
        | "dynamic-import"
        | "wasm-import"
        | "data-reference"
      readonly targetArtifactAddressId: ArtifactAddressId
      readonly targetExportName: string | null
    }

    export type { ArtifactDependencyBinding }
    ```
  ],
  edge_cases: [
    - kind unionに未定義の値を追加せず、`string`へwidenしない
    - `ArtifactDependencyKind` aliasを追加しない
    - propertyをoptionalまたはmutableにしない
    - target artifact addressをplain stringまたはgeneric digestへwidenしない
    - nullableなtarget export nameをoptional fieldまたはnon-null stringへ変更しない
    - typeへの適合をvalidation、target existence、ordering、duplicates、identity issuance、URL、integrity、trust、aggregate publicationの証拠として扱わない
  ],
  test_cases: [
    - `keyof`と全property typeが期待型と双方向に一致することを検査する
    - kind unionが期待する4 literalと双方向に一致することを検査する
    - 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    - missing、extra、optional、mutable、widened、kind変更、target address変更、target export nullability変更variantがexact contractと一致しないことを非空なnegative fixtureで検査する
    - facadeのASTが6個のfocused modelから採択済み7 typeだけを採択済み順序でtype-only exportし、禁止されたhelper aliasをexportしないことを検査する
    - facade、全6 model、全type fixture、type-only consumerのmemory emitがruntime edge、value、effectを持たないことを検査する
    - validator、aggregate、identity operation、URL、integrity、closureがfacadeに存在しないことを検査する
    - shared package rootから`ArtifactDependencyBinding`をimportできないことを検査する
    - shared packageを一時出力先へbuildし、生成された`index.d.mts`と`index.d.cts`のexport surfaceに現行の7 typeと禁止されたhelper aliasが存在せず、既存root typeが存在することを検査する
  ],
)

#feature_spec(
  name: "Type-only artifact export binding",
  summary: [
    export table、validator、aggregate、identity operationを仮実装せず、`ArtifactExportBinding`だけをcurrent revisionのpackage-local facadeへ追加する。
  ],
  api: [
    ```typescript
    interface ArtifactExportBinding {
      readonly exportName: string
      readonly memberSemanticId: string
      readonly exportRole:
        | "definition"
        | "integration-provider"
        | "runtime-bootstrap"
        | "registry-implementation"
        | "data-handle"
        | "wasm-binding"
    }

    export type { ArtifactExportBinding }
    ```
  ],
  edge_cases: [
    - property名をentry bindingの`exportedName`へ変更しない
    - role unionに未定義の値を追加せず、`string`へwidenしない
    - `ArtifactExportRole`または別のhelper aliasを追加しない
    - propertyをoptionalまたはmutableにしない
    - `exportName`と`memberSemanticId`を`string | null`または別のdomainへwidenしない
    - typeへの適合をname syntaxまたはexistence、member-role validation、canonical sort、duplicate rejection、digestまたは`ArtifactAddressId` issuance、URL、integrity、trust、provenance、closureの証拠として扱わない
  ],
  test_cases: [
    - `keyof`と全property typeが期待型と双方向に一致することを検査する
    - `exportRole` unionが期待する6 literalと双方向に一致することを検査する
    - 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    - missing `memberSemanticId`、extra `integrity`、optional、all-mutable、両string fieldの`string | null` widening、unsupported role variantがexact contractと一致しないことを非空なnegative fixtureで検査する
    - model ASTが1個のinterface、`exportName`、`memberSemanticId`、`exportRole`の順の3 property、directな6-string-literal role union、0個のtype alias、`ArtifactExportBinding`だけのnamed type-only exportを持つことを検査する
    - facadeのASTが6個のfocused modelから採択済み7 typeだけを採択済み順序でtype-only exportし、追加statementを持たないことを検査する
    - facade、export binding model、type fixture、type-only consumerのmemory emitがruntime edge、value、effectを持たないことを検査する
    - package-local facadeから`ArtifactExportBinding`をtype-only importでき、shared package rootからはimportできないことを検査する
    - export table、aggregate、preimage、validator、identity operation、URL、integrity、closureがfacadeに存在しないことを検査する
    - shared packageを一時出力先へbuildし、生成された`index.d.mts`と`index.d.cts`のexport surfaceに`ArtifactExportBinding`と`ArtifactExportRole`が存在せず、positive controlとして`Sha256Digest`が存在することを検査する
  ],
)

#feature_spec(
  name: "Type-only deployment identity preimage",
  summary: [
    snapshot、validator、digest operation、artifact address preimageを仮実装せず、`DeploymentIdentityPreimage`だけをcurrent revisionのpackage-local facadeへ追加する。
  ],
  api: [
    ```typescript
    import type { Sha256Digest } from "../canonicalIdentity/implementation"

    interface DeploymentIdentityPreimage {
      readonly schema: "dathra.deployment-identity/1"
      readonly applicationNamespaceDigest: Sha256Digest
      readonly releaseIdentity: string
      readonly targetEnvironmentId: string
      readonly canonicalPublicOrigin: string
      readonly contractNamespaceGraphDigest: Sha256Digest
      readonly hostProfileSetDigest: Sha256Digest
    }

    export type { DeploymentIdentityPreimage }
    ```
  ],
  edge_cases: [
    - schema literalを`string`または別versionへwidenしない
    - digest fieldをplain string、別digest domain、deployment固有brandまたはIDへ変更しない
    - string fieldをnullable、optional、URL objectまたは別domainへ変更しない
    - propertyをoptionalまたはmutableにしない
    - typeへの適合をsyntax、origin canonicality、namespaceまたはhost profileの実在、canonicality、provenance、trust、deployment admissionの証拠として扱わない
  ],
  test_cases: [
    - `keyof`と全property typeが期待型と双方向に一致することを検査する
    - 全propertyがrequiredかつreadonlyであることをmodifier-sensitive fixtureで検査する
    - missing、extra、optional、mutable、wrong schema、widened digest、widened string variantがexact contractと一致しないことを非空なnegative fixtureで検査する
    - model ASTが1個のinterface、採択済み順序の7 property、0個のtype alias、`Sha256Digest`だけのtype-only import、`DeploymentIdentityPreimage`だけのnamed type-only exportを持つことを検査する
    - facadeのASTが6個のfocused modelから採択済み7 typeだけを採択済み順序でtype-only exportし、追加statementを持たないことを検査する
    - facade、deployment identity model、type fixture、type-only consumerのmemory emitがruntime edge、value、effectを持たないことを検査する
    - package-local facadeから`DeploymentIdentityPreimage`をtype-only importでき、shared package rootからはimportできないことを検査する
    - deployment identity alias、brand、snapshot、validator、parser、creator、digest operation、URL、artifact address preimageがfacadeに存在しないことを検査する
    - shared packageを一時出力先へbuildし、生成された`index.d.mts`と`index.d.cts`のexport surfaceに`DeploymentIdentityPreimage`、`DeploymentIdentityDigest`、`DeploymentIdentityId`が存在せず、positive controlとして`Sha256Digest`が存在することを検査する
  ],
)

== 責務境界

- canonical snapshot validator、artifact address identity operation、creator、parser、guard、castは後続AR01 unitが所有する
- export table、artifact address preimage aggregateは後続AR01 unitが所有する
- entry bindingのsemantic canonical validatorは後続AR01 unitが所有する
- dependency bindingのsemantic validation、target existence、ordering、duplicatesは後続AR01 unitが所有する
- export bindingのname syntaxとexistence、member-role validation、canonical ordering、duplicatesは後続AR01 unitが所有する
- deployment identityのhostile input snapshotはAR01-DS、semantic canonical validationはAR01-DV、validated preimage全体のcanonical digestはAR01-DDが所有する
- artifact address preimage aggregateはAR01-Pが所有し、AR01-DDのgeneric digestを入力として受け取る
- artifact URL、exact-byte integrity、artifact closureは後続unitが所有する
- SC01 migrationはAR01-I後のintegration unitが所有する
- このunitはcanonicality、provenance acceptance、trust admission、referent closure、artifact existence、exact-byte integrityを表さない
- runtime cast helperと任意のcanonical SHA-256文字列をbrand化するAPIを追加しない
