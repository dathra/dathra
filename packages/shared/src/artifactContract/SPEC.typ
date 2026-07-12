= artifact contract type domains

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

artifact addressをgenericなSHA-256 digestや他のdigest domainから区別し、後続のartifact contractが誤ったdomainの値をaddress fieldへ入力できないpackage-localなnominal subtypeを定義する。

artifact finalizationの決定項目をexactなclosed productとして固定し、unsupportedなliteral、欠落したfield、変更されたproperty modifierを後続のaddress preimageへ混入させないpackage-localなtypeを定義する。

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
    - facadeのASTで`./model`からtype-only `ArtifactAddressId`だけがexportされることを検査する
    - facade、address model、finalization template modelのmemory emitがmodule marker `export {};`だけであることを検査する
    - type-only consumerのmemory emitにruntime import edgeがないことを検査する
    - shared package rootから`ArtifactAddressId`をimportできないことを検査する
  ],
)

#feature_spec(
  name: "Type-only artifact finalization template",
  summary: [
    後続bindingとaggregateを仮実装せず、`ArtifactFinalizationTemplate`だけをcurrent revisionのpackage-local facadeへ追加する。
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
    - facadeのASTが`./model`の`ArtifactAddressId`と`./finalizationTemplateModel`の`ArtifactFinalizationTemplate`だけをtype-only exportすることを検査する
    - facade、address model、finalization template model、type-only consumerのmemory emitがruntime edge、value、effectを持たないことを検査する
    - 後続binding、aggregate、validator、identity operation、URL、integrity、closureがfacadeに存在しないことを検査する
    - shared package rootから`ArtifactFinalizationTemplate`をimportできないことを検査する
  ],
)

== 責務境界

- canonical snapshot validator、artifact address identity operation、creator、parser、guard、castは後続AR01 unitが所有する
- entry binding、dependency binding、export binding、artifact address preimage aggregateは後続AR01 unitが所有する
- artifact URL、exact-byte integrity、artifact closureは後続unitが所有する
- SC01 migrationはAR01-I後のintegration unitが所有する
- このunitはcanonicality、provenance acceptance、trust admission、referent closure、artifact existence、exact-byte integrityを表さない
- runtime cast helperと任意のcanonical SHA-256文字列をbrand化するAPIを追加しない
