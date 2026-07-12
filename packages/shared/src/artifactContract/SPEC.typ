= artifact address nominal domain

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

artifact addressをgenericなSHA-256 digestや他のdigest domainから区別し、後続のartifact contractが誤ったdomainの値をaddress fieldへ入力できないpackage-localなnominal subtypeを定義する。

このAPIはtype-only foundationであり、runtime operationとshared package rootの公開面を増やさない。

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

== 機能仕様

#feature_spec(
  name: "Type-only artifact address domain",
  summary: [
    後続schemaやruntime operationを仮実装せず、`ArtifactAddressId`だけをpackage-local facadeから提供する。
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
    - facadeのASTで唯一のexportが`./model`からのtype-only `ArtifactAddressId`であることを検査する
    - facadeとmodelのmemory emitがmodule marker `export {};`だけであることを検査する
    - type-only consumerのmemory emitにruntime import edgeがないことを検査する
    - shared package rootから`ArtifactAddressId`をimportできないことを検査する
  ],
)

== 責務境界

- artifact address preimage、canonical validator、creator、parser、guardは後続AR01 unitが所有する
- artifact URL、exact-byte integrity、artifact closureは後続unitが所有する
- SC01 migrationはAR01-I後のintegration unitが所有する
- このunitはprovenance acceptance、referent closure、exact-byte integrityを表さない
- runtime cast helperと任意のcanonical SHA-256文字列をbrand化するAPIを追加しない
