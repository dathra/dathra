= execution registry contract

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

compiler、artifact finalizer、server runtime、browser runtime が、registry descriptor、environment role、public protocol、environment projection を同じ closed schema と canonical identity で扱うための共通 contract を提供する。

SC01 は純粋な schema、snapshot、digest、導出、検証だけを提供する。

symbolic universe の発見は SC03、candidate artifact の finalization は AF01、selected artifact の emission は PE01、認証済み runtime conformance は RR01 が担当する。

== 設計判断

#adr(
  header("source-local registry ID と qualified registry ID を分離する", Status.Accepted, "2026-07-12"),
  [
    source contract の短い local ID と runtime artifact の content-addressed ID を同じ文字列型にすると、未 qualification の値が artifact へ漏れても検出できない。
  ],
  [
    `RegistryId<Kind>` は source contract 内だけで有効な non-empty valid Unicode string とする。
    `QualifiedRegistryId<Kind>` は `dathra.qualified-id/1` の kind を `registry:${Kind}` とした `QualifiedId` とする。
    Unicode normalization は行わず、lone surrogate だけを拒否する。
  ],
  [
    - digest 形状の local ID も local ID として扱い、文字列形状から provenance を推測しない
    - final record は schema context、kind membership、nested reference resolution を検証してから qualified brand を得る
    - source-local ID が artifact に残らないことは SC03 と artifact inspection が証明する
  ],
)

#adr(
  header("registry record を side-effect-free な closed snapshot に制限する", Status.Accepted, "2026-07-12"),
  [
    descriptor や catalog の検証中に getter、`toJSON`、custom prototype、hidden state を実行すると、同じ宣言から異なる artifact が生成され得る。
  ],
  [
    public validator は canonical identity と同じ current-realm plain object、null-prototype record、standard dense array、enumerable data property の制約を適用する。
    expected field 以外の field、hidden property、symbol property、accessor、custom prototype、cycle、unsupported value を拒否する。
    受理した値は deep-frozen data clone として返す。
    Proxy は caller contract 外とする。
  ],
  [
    - validator は author callback を実行しない
    - unknown wire value から brand を作る境界が一箇所になる
    - Proxy trap を標準 JavaScript だけで副作用なく検出できないため、Proxy は入力してはならない
  ],
)

#adr(
  header("catalog と protocol の identity を full-record self digest にする", Status.Accepted, "2026-07-12"),
  [
    個別 field の寄せ集めや insertion order に依存する hash は、compiler と runtime の exact equality を証明できない。
  ],
  [
    descriptor digest は self field を持たない qualified descriptor 全体の canonical JCS bytes から生成する。
    `RemoteRegistryProtocolBinding.id` は自身の `id` だけを empty string にした full binding から生成する。
    universe、final catalog、environment catalog、protocol catalog、pair commitment、environment projection は自身の `digest` だけを empty string にした full record から生成する。
    入力として保持する別 record の digest field は消さない。
  ],
  [
    - 後段 digest を前段 preimage に含めない生成 DAG を維持できる
    - validator は exact record の追加、欠落、並び替えを digest mismatch として検出できる
    - digest API は WebCrypto を使うため非同期になる
  ],
)

#adr(
  header("environment projection を exact seed からの finite least fixed point とする", Status.Accepted, "2026-07-12"),
  [
    component 単位の暗黙 hydration や flat binding array は、どの owner と role が artifact を必要としたかを失う。
    protocol 自身を initial root にすると、使われない remote operation が自己正当化できる。
  ],
  [
    selected definition が宣言した exact seed union だけを initial root とする。
    seed role、protocol mandatory role、active requirement、unique implementation、same-environment dependency target を変化がなくなるまで追加する。
    projection は owner ごとに active requirement、selected implementation、selected dependency を保持する。
    remote browser transport と server endpoint は non-null protocol seed からだけ選択する。
  ],
  [
    - dependency cycle は有限の owner/role 集合上で収束する
    - selected implementation を持たない owner と fixed point にない extra record を拒否できる
    - runtime artifact closure は実際に選択された role だけを含む
  ],
)

#adr(
  header("cross-environment relation を public protocol catalog と pair commitment に閉じる", Status.Accepted, "2026-07-12"),
  [
    browser catalog が server implementation locator を直接保持すると、server-only code と trust boundary が client artifact へ漏れる。
  ],
  [
    generic dependency は同一 environment に限定し、remote operation と remote delivery adapter を generic target にしない。
    browser transport と server endpoint の対応は `RemoteRegistryProtocolBinding` が所有する。
    global、browser、server、protocol の四つの catalog digest を `RegistryCatalogPairCommitment` に束縛する。
  ],
  [
    - browser catalog は server artifact locator を持たずに public protocol metadata を検証できる
    - build pair validator が endpoint、handler、delivery adapter、deployment identity の閉包を証明する
    - browser と server runtime は local projection と認証済み pair commitment だけを検証できる
  ],
)

== interface specification

#interface_spec(
  name: "Registry identity and role domain",
  summary: [
    10種類の registry kind、16種類の implementation role、2種類の runtime environment、25個の合法 role tuple を closed domain として公開する。
  ],
  format: [
    ```typescript
    type RegistryKind =
      | "codec"
      | "resolver"
      | "remote-operation"
      | "remote-delivery-adapter"
      | "subscription-source"
      | "brand"
      | "value-domain"
      | "policy"
      | "host-profile"
      | "failure-schema"

    type ExecutionEnvironment = "build" | "server-request" | "browser"
    type RuntimeExecutionEnvironment = Exclude<ExecutionEnvironment, "build">

    type RegistryId<Kind extends RegistryKind> = string & RegistryIdBrand<Kind>
    type QualifiedRegistryId<Kind extends RegistryKind> =
      QualifiedId<`registry:${Kind}`>

    const REGISTRY_KINDS: readonly RegistryKind[]
    const REGISTRY_IMPLEMENTATION_ROLES: readonly RegistryImplementationRole[]
    const REGISTRY_ROLE_LOCATIONS: readonly RegistryRoleLocation[]

    function registryId<Kind extends RegistryKind>(
      kind: Kind,
      value: string
    ): RegistryId<Kind>

    function createQualifiedRegistryId<Kind extends RegistryKind>(
      namespaceId: Sha256Digest,
      kind: Kind,
      localId: RegistryId<Kind>
    ): Promise<QualifiedRegistryId<Kind>>

    function isRegistryRoleLocation(
      registryKind: unknown,
      environment: unknown,
      role: unknown
    ): boolean

    function registryRoleInterfaceSchemaId<Role extends RegistryImplementationRole>(
      role: Role
    ): `dathra.registry-role/${Role}/1`
    ```
  ],
  constraints: [
    - `registryId()` は unknown kind、empty string、lone surrogate を拒否する
    - qualified ID の domain は必ず `registry:${Kind}` とする
    - `build` environment は role location に存在しない
    - 全組み合わせ320個のうち25個だけを合法とし、残る295個を拒否する
  ],
)

#interface_spec(
  name: "Registry descriptor schema",
  summary: [
    全 descriptor は `dathra.registry/1`、kind、ID、version と kind 固有 metadata を持つ closed discriminated union である。
  ],
  format: [
    ```typescript
    type RegistryDescriptor<Qualified extends boolean = false> =
      | CodecRegistryDescriptor<Qualified>
      | ResolverRegistryDescriptor<Qualified>
      | RemoteOperationRegistryDescriptor<Qualified>
      | RemoteDeliveryAdapterRegistryDescriptor<Qualified>
      | SubscriptionSourceRegistryDescriptor<Qualified>
      | BrandRegistryDescriptor<Qualified>
      | ValueDomainRegistryDescriptor<Qualified>
      | PolicyRegistryDescriptor<Qualified>
      | HostProfileRegistryDescriptor<Qualified>
      | FailureSchemaRegistryDescriptor<Qualified>

    function defineRegistryDescriptor<Descriptor extends RegistryDescriptor<false>>(
      descriptor: Descriptor
    ): Descriptor

    function parseQualifiedRegistryDescriptor(
      value: unknown
    ): RegistryDescriptor<true>

    function digestRegistryDescriptor(
      descriptor: RegistryDescriptor<true>
    ): Promise<Sha256Digest>
    ```
  ],
  constraints: [
    - `schema` は `dathra.registry/1`、`kind` は既知の10種類、`version` は non-empty valid Unicode とする
    - local descriptor の全 reference は同じ kind brand の `RegistryId` とし、qualified descriptor の全 reference は canonical digest とする
    - digest field は canonical `Sha256Digest` とする
    - budget、count、horizon は正の safe integer とする
    - subscription update mode は `replacement`、`stable-handle`、`journaled-in-place` の固定順で unique にする
    - executable helper result は descriptor を継承せず、後続 package が `descriptor` field と role implementation を分離する
  ],
)

#interface_spec(
  name: "Role, implementation, dependency, and protocol schema",
  summary: [
    registry owner の requirement、symbolic/final implementation、same-environment dependency、remote public protocol を closed record で表す。
  ],
  format: [
    ```typescript
    type RegistryRoleRequirement<Kind extends RegistryKind = RegistryKind>
    type RegistrySymbolicImplementationBinding<Kind extends RegistryKind = RegistryKind>
    type RegistryImplementationBinding<Kind extends RegistryKind = RegistryKind>
    type RegistryDependencyBinding<Kind extends RegistryKind = RegistryKind>

    type RegistrySourceImplementation<Kind extends RegistryKind> =
      RegistryRoleLocationFor<Kind> & {
        readonly implementation: ModuleExportLocator
      }

    interface RegistrySourceEntry<Kind extends RegistryKind> {
      readonly id: RegistryId<Kind>
      readonly version: string
      readonly descriptor: ModuleExportLocator
      readonly implementations: readonly RegistrySourceImplementation<Kind>[]
    }

    interface RemoteRegistryProtocolTemplate
    interface RemoteRegistryProtocolBinding

    function createRemoteRegistryProtocolBinding(
      template: RemoteRegistryProtocolTemplate,
      browserDeploymentIdentityDigest: Sha256Digest,
      serverDeploymentIdentityDigest: Sha256Digest
    ): Promise<RemoteRegistryProtocolBinding>

    function parseRemoteRegistryProtocolBinding(
      value: unknown
    ): Promise<RemoteRegistryProtocolBinding>
    ```
  ],
  constraints: [
    - requirement は owner kind の合法 role location だけを使う
    - `reasonDefinitionIds` は non-empty、strictly sorted、duplicate-free とする
    - 同じ owner/environment/role の requirement は一件にまとめ、`required` を `request-reachable` より優先する
    - implementation の interface schema は role から一意に導出する
    - 同じ owner/environment/role の final implementation は candidate ごとに exactly one とする
    - dependency の source と target environment は一致させる
    - generic dependency は remote operation と remote delivery adapter を target にできない
    - remote delivery dependency は server endpoint から descriptor が指す adapter の server delivery へだけ張る
    - remote transport と server endpoint は protocol が指す host profile の同一環境 validator へ exactly one dependency を持つ
    - endpoint-to-handler relation は protocol binding が所有し、dependency へ重複させない
    - protocol binding の endpoint identity は server deployment、operation ID、transport profile の canonical digest とする
    - protocol binding ID は `id` だけを empty string にした full binding の digest とする
  ],
)

#interface_spec(
  name: "Symbolic and finalized registry catalogs",
  summary: [
    artifact-independent symbolic universe と artifact/deployment 確定後の global catalog を exact owner record の列として表す。
  ],
  format: [
    ```typescript
    interface QualifiedRegistryUniverseRecord {
      readonly schema: "dathra.qualified-registry-universe/1"
      readonly registries: readonly QualifiedRegistryUniverseEntry[]
      readonly digest: Sha256Digest
    }

    interface FinalizedRegistryCatalogRecord {
      readonly schema: "dathra.finalized-registry-catalog/1"
      readonly symbolicUniverseDigest: Sha256Digest
      readonly registries: readonly FinalizedRegistryCatalogEntry[]
      readonly digest: Sha256Digest
    }

    function createQualifiedRegistryUniverseRecord(
      input: Omit<QualifiedRegistryUniverseRecord, "digest">
    ): Promise<QualifiedRegistryUniverseRecord>

    function parseQualifiedRegistryUniverseRecord(
      value: unknown
    ): Promise<QualifiedRegistryUniverseRecord>

    function createFinalizedRegistryCatalogRecord(
      input: Omit<FinalizedRegistryCatalogRecord, "digest">
    ): Promise<FinalizedRegistryCatalogRecord>

    function parseFinalizedRegistryCatalogRecord(
      value: unknown
    ): Promise<FinalizedRegistryCatalogRecord>
    ```
  ],
  constraints: [
    - owner record は qualified ID の raw UTF-16 順で strictly sorted、duplicate-free とする
    - entry の qualified ID、kind、version は descriptor と一致させる
    - descriptor digest は qualified descriptor 全体の canonical digest と一致させる
    - nested registry reference は同じ catalog の期待 kind entry へ解決する
    - requirement と implementation は environment、role の順に並べる
    - dependency は source environment、source role、target ID、target environment、target role の順に並べる
    - protocol template は確定済み10-field tuple 順、protocol binding は ID 順に並べる
    - dangling reference、kind mismatch、duplicate role、missing required implementation を拒否する
  ],
)

#interface_spec(
  name: "Environment catalog and pair commitment",
  summary: [
    global finalized catalog から browser/server-request catalog と public protocol catalog を deterministic に射影し、四つの digest を pair commitment に束縛する。
  ],
  format: [
    ```typescript
    interface RegistryEnvironmentCatalogRecord
    interface RegistryProtocolCatalogRecord
    interface RegistryCatalogPairCommitment

    function deriveRegistryEnvironmentCatalogRecord(
      catalog: FinalizedRegistryCatalogRecord,
      environment: RuntimeExecutionEnvironment,
      deploymentIdentityDigest: Sha256Digest
    ): Promise<RegistryEnvironmentCatalogRecord>

    function parseRegistryEnvironmentCatalogRecord(
      value: unknown
    ): Promise<RegistryEnvironmentCatalogRecord>

    function deriveRegistryProtocolCatalogRecord(
      catalog: FinalizedRegistryCatalogRecord
    ): Promise<RegistryProtocolCatalogRecord>

    function parseRegistryProtocolCatalogRecord(
      value: unknown
    ): Promise<RegistryProtocolCatalogRecord>

    function deriveRegistryCatalogPairCommitment(
      globalCatalog: FinalizedRegistryCatalogRecord,
      browserCatalog: RegistryEnvironmentCatalogRecord,
      serverCatalog: RegistryEnvironmentCatalogRecord,
      protocolCatalog: RegistryProtocolCatalogRecord
    ): Promise<RegistryCatalogPairCommitment>

    function validateRegistryCatalogPair(
      globalCatalog: FinalizedRegistryCatalogRecord,
      browserCatalog: RegistryEnvironmentCatalogRecord,
      serverCatalog: RegistryEnvironmentCatalogRecord,
      protocolCatalog: RegistryProtocolCatalogRecord,
      commitment: RegistryCatalogPairCommitment
    ): Promise<void>
    ```
  ],
  constraints: [
    - environment catalog は対象 environment の implementation を一件以上持つ owner の exact set とする
    - environment catalog は対象 environment の requirement、implementation、dependency と利用可能な public protocol metadata だけを持つ
    - browser catalog は server implementation、server dependency、server artifact locator を持たない
    - protocol catalog は binding ID 順で strictly sorted、duplicate-free とする
    - browser deployment は client deployment、server deployment は endpoint と delivery deployment に一致させる
    - operation descriptor、endpoint、handler、delivery adapter、transport profile の閉包を pair validation で検証する
  ],
)

#interface_spec(
  name: "Exact seed and environment projection",
  summary: [
    selected definition の seed union と environment catalog から owner-grouped least fixed point projection を導出する。
  ],
  format: [
    ```typescript
    interface RegistryProjectionDefinitionRecord {
      readonly definitionId: string
      readonly registryProjectionSeeds: readonly RegistryProjectionSeed[]
    }

    interface RegistryEnvironmentProjectionRecord {
      readonly schema: "dathra.registry-environment-projection/2"
      readonly environment: RuntimeExecutionEnvironment
      readonly deploymentIdentityDigest: Sha256Digest
      readonly catalogDigest: Sha256Digest
      readonly catalogPairCommitmentDigest: Sha256Digest
      readonly seeds: readonly RegistryProjectionSeed[]
      readonly registries: readonly RegistryEnvironmentProjectionEntry[]
      readonly protocolBindingIds: readonly Sha256Digest[]
      readonly digest: Sha256Digest
    }

    function deriveRegistryEnvironmentProjectionRecord(
      catalog: RegistryEnvironmentCatalogRecord,
      protocolCatalog: RegistryProtocolCatalogRecord,
      commitment: RegistryCatalogPairCommitment,
      definitions: readonly RegistryProjectionDefinitionRecord[]
    ): Promise<RegistryEnvironmentProjectionRecord>

    function parseRegistryEnvironmentProjectionRecord(
      value: unknown
    ): Promise<RegistryEnvironmentProjectionRecord>

    function validateRegistryEnvironmentProjectionRecord(
      value: unknown,
      catalog: RegistryEnvironmentCatalogRecord,
      protocolCatalog: RegistryProtocolCatalogRecord,
      commitment: RegistryCatalogPairCommitment,
      definitions: readonly RegistryProjectionDefinitionRecord[]
    ): Promise<RegistryEnvironmentProjectionRecord>
    ```
  ],
  constraints: [
    - definition record は definition ID 順で strictly sorted、duplicate-free とする
    - definition 内 seed は environment、qualified ID、role、protocol ID の順に並べ、seed の definition ID は owner definition と一致させる
    - projection seed は definition ID、environment、qualified ID、role、protocol ID の順に並べる
    - null protocol ID は digest より前に並べる
    - non-protocol seed は remote operation と delivery adapter を選択できない
    - protocol seed は browser transport または server endpoint だけを選択できる
    - selected protocol ID は browser transport seed と server endpoint seed を少なくとも一件ずつ持ち、各 environment projection の protocol ID set には一回だけ現れる
    - request-reachable requirement は owner が選択済みで reason definition が selected set に含まれる場合だけ active にする
    - required requirement は owner が選択された時点で active にする
    - selected role の unique implementation と全 dependency target を追加し、変化がなくなるまで反復する
    - protocol expansion は browser verifier または server handler を追加する
    - output owner group は qualified ID 順、protocol ID は raw UTF-16 順とする
    - output は再導出結果と exact equality でなければならない
  ],
)

#interface_spec(
  name: "Execution registry failure",
  summary: [
    schema、identity、order、reference、protocol、projection の失敗を stable code と value path で報告する。
  ],
  format: [
    ```typescript
    type ExecutionRegistryErrorCode =
      | "invalid-closed-record"
      | "invalid-field"
      | "invalid-registry-id"
      | "invalid-role-location"
      | "noncanonical-order"
      | "duplicate-record"
      | "digest-mismatch"
      | "dangling-reference"
      | "kind-mismatch"
      | "environment-mismatch"
      | "missing-implementation"
      | "ambiguous-implementation"
      | "invalid-protocol"
      | "invalid-seed"
      | "projection-mismatch"

    class ExecutionRegistryError extends TypeError {
      readonly code: ExecutionRegistryErrorCode
      readonly path: readonly (string | number)[]
    }
    ```
  ],
  constraints: [
    - path は root から failure value までを示す immutable snapshot とする
    - canonical identity failure は author accessor を実行せず `invalid-closed-record` へ写像する
    - error 自体と path は caller が変更できないようにする
  ],
)

== behavior specification

#behavior_spec(
  name: "Canonical catalog validation",
  summary: [
    catalog validator は closed snapshot を取得してから field、order、digest、cross-reference を検証する。
  ],
  steps: [
    1. 入力全体を accessor を実行せず closed data snapshot にする。
    2. schema と exact field set を検証する。
    3. owner、requirement、implementation、dependency、protocol list の canonical order と uniqueness を検証する。
    4. descriptor kind、nested registry reference、role location、interface schema を検証する。
    5. descriptor digest と record self digest を再計算する。
    6. deep-frozen typed snapshot を返す。
  ],
  errors: [
    - extra/missing/accessor field は `invalid-closed-record` または `invalid-field` とする
    - sort violation は `noncanonical-order`、同一 key は `duplicate-record` とする
    - nested reference の欠落は `dangling-reference`、期待 kind の不一致は `kind-mismatch` とする
    - self digest の不一致は `digest-mismatch` とする
  ],
)

#behavior_spec(
  name: "Environment projection fixed point",
  summary: [
    environment projection は catalog の有限 role set 上で deterministic に収束する。
  ],
  preconditions: [
    - catalog、protocol catalog、pair commitment は個別 schema と self digest を満たす
    - commitment の対象 environment catalog digest と protocol catalog digest が入力に一致する
    - selected definition と seed list は canonical order と exact ownership を満たす
  ],
  steps: [
    1. 対象 environment の全 seed role を選択する。
    2. protocol seed の binding を検証し、browser verifier または server handler を選択する。
    3. selected owner の required requirement と、selected reason に到達した request-reachable requirement を active にする。
    4. active role と seed/dependency role の unique implementation を選択する。
    5. selected role を source とする dependency を選び、その target role を選択する。
    6. 新しい role、requirement、dependency がなくなるまで3から5を反復する。
    7. owner group と protocol ID を canonical order で materialize し、self digest を生成する。
  ],
  postconditions: [
    - 各 owner group は一件以上の selected implementation を持つ
    - selected dependency の source と target は projection 内の implementation へ exactly 解決する
    - fixed point にない record は存在しない
  ],
  errors: [
    - arbitrary seed、protocol self-selection、seed kind mismatch は `invalid-seed` とする
    - role implementation の欠落または重複は `missing-implementation` または `ambiguous-implementation` とする
    - supplied projection と再導出結果の差は `projection-mismatch` とする
  ],
)

== test cases

- 10 descriptor kind の local/qualified success と closed-record failure を検証する。
- 25 legal role tuple をすべて受理し、残る295 tuple をすべて拒否する。
- symbolic universe、final catalog、environment catalog、protocol catalog、pair commitment の success と self-digest mismatch を検証する。
- noncanonical order、duplicate owner/role/protocol、dangling reference、kind mismatch、cross-environment dependency を拒否する。
- remote protocol の endpoint identity、binding ID、deployment equality、four-role closure、delivery adapter closure を検証する。
- definition seed の exact ownership、order、duplicate、protocol restriction を検証する。
- required と request-reachable activation、dependency cycle、remote expansion を含む least fixed point を検証する。
- missing/extra projection record と protocol self-selection を拒否する。
- public root export から全 contract と validator を利用できることを検証する。
