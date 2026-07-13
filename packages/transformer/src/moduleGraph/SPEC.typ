= immutable module graph snapshot

#import "/SPEC/functions.typ": *
#import "/SPEC/settings.typ": *
#show: apply-settings

== 目的

server、browser、worker など複数の resolution domain について、module definition、runtime module identity、loader cache、semantic request、source site を混同しない immutable graph snapshot を提供する。

ModuleCoordinator が resolver、loader、transform、extractor の結果を graph-completeness barrier の前に固定し、server/client artifact が同じ canonical snapshot ID を参照できる foundation とする。

== 設計判断

#adr(
  header("Module identity を非循環 DAG に分離する", Status.Accepted, "2026-07-12"),
  [
    module ID に outgoing request または target ID を含めると import cycle の content-addressed fixed point が自己参照になる。
    一方、compiler content identity と runtime Module Record/cache identity を一つにすると redirect、複数 Realm、native/CommonJS cache、同一 bytes の別 runtime instance を表せない。
  ],
  [
    semantic profile、edge-independent request inventory、external definition contract、module definition、resolution domain、runtime binding、loader entry、external runtime evidence、semantic request、resolution evidence、resolved request、request-site evidence、request site/entry、snapshot の順に identity を生成する。
    import edge は runtime binding ID 以前の preimage に含めない。
  ],
  [
    - import cycle を有限な canonical record で表せる
    - definition ID と Module Record/namespace/evaluation/failure identity を別々に検証できる
    - record 数は増えるが、各 trust boundary と cache identity が明示される
  ],
)

#adr(
  header("Resolution domain と module-map/cache key を明示する", Status.Accepted, "2026-07-12"),
  [
    server と client、別 Realm、native module map と CommonJS loader は、同じ specifier を別 target または別 cache namespace へ解決できる。
    HTML module map は request URL と module type で key を作り、module base URL には redirect 後の response URL を使う。
    Node.js loader hook は effective import attributes を cache key に使える。
  ],
  [
    snapshot は複数の `ModuleResolutionDomain` を持つ。
    domain は native module-map/Realm と CommonJS loader-cache namespace、resolver profile/input transcript、module-map semantics、condition set と hook-visible condition sequence を束縛する。
    `RuntimeModuleBinding` と `ModuleLoaderEntry` を分離し、loader entry は request URL、module-map type、effective key attributes、cache-key digest を、runtime binding は response/base URL と runtime module identity を持つ。
  ],
  [
    - 同じ URL を別 domain または別 module-map type で使える
    - request URL と response/base URL を失わない
    - WHATWG URL canonicalization は syntax だけを担当し、realpath、symlink、case、redirect は resolver evidence が担当する
  ],
  references: (
    link("https://html.spec.whatwg.org/multipage/webappapis.html#module-map")[HTML Standard module map],
    link("https://url.spec.whatwg.org/")[URL Standard],
    link("https://nodejs.org/api/module.html#customization-hooks")[Node.js module hooks],
  ),
)

#adr(
  header("Semantic request、resolution、source site を分離する", Status.Accepted, "2026-07-12"),
  [
    ECMAScript ModuleRequest equality は specifier、phase、import attributes で決まり、static/dynamic source site の位置では決まらない。
    CommonJS resolution は `createRequire()` origin と別 loader/cache semantics を持つ。
    source syntax site と request key の結合を ordinal だけにすると、同じ importer の別 specifier を交換できる。
  ],
  [
    native semantic request ID は domain、importer runtime binding、`source | evaluation` phase、specifier、source attributes から作る。
    CommonJS request ID は domain、importer、resolution origin URL、specifier から作る。
    target と resolver evidence は `ResolvedModuleRequest` で一対一に結合する。
    `ModuleRequestSiteEvidence` は inventory syntax、semantic request key set、finite candidate coverage proof を結合し、site は resolved request ID set を参照する。
  ],
  [
    - 複数 site が同じ semantic request と resolution を共有できる
    - static site の literal equality と dynamic/CommonJS site の有限候補被覆を区別できる
    - CommonJS cache state を semantic request identity の逃げ道にできない
  ],
  references: (
    link("https://tc39.es/ecma262/#sec-modulerequest-record")[ECMAScript ModuleRequest Records],
    link("https://tc39.es/proposal-source-phase-imports/")[Source Phase Imports],
    link("https://nodejs.org/api/modules.html#modules-commonjs-modules")[Node.js CommonJS modules],
  ),
)

#adr(
  header("Snapshot closure を source/evaluation phase で検証する", Status.Accepted, "2026-07-12"),
  [
    source-phase import は target Module Record または Module Source Object を load するが、その transitive request を evaluation traversal しない。
    単純な graph reachability は source-only target の outgoing site を誤って要求するか、evaluation へ昇格した target の site 欠落を見逃す。
  ],
  [
    reachability を `source < evaluation` lattice の fixed point とする。
    entry、evaluation-phase native request、CommonJS request は evaluation を伝播し、source-phase request は source だけを伝播する。
    evaluation reachable content binding だけに inventory と完全一致する site closure を要求し、source-only binding の site record は拒否する。
    同じ native request key の source/evaluation phase は同じ runtime binding へ解決する。
  ],
  [
    - source-only WebAssembly module などを transitive evaluation せず表せる
    - 別 path から evaluation に昇格した場合は site closure を必ず検査する
    - snapshot 公開後の extension は mutation ではなく link 前の新 snapshot とする
  ],
)

#adr(
  header("production adapter が確定するまで transformer root export を追加しない", Status.Accepted, "2026-07-13"),
  [
    immutable Module Graph は将来の ModuleCoordinator と compiler output の基盤だが、default branch の現行 transform はまだ snapshot を生成または消費しない。
    adapter がない段階で producer API を `@dathra/transformer` の package root へ公開すると、実 build 経路で検証していない契約を公開 API として固定する。
  ],
  [
    Module Graph は `moduleGraph` directory の internal foundation として保持し、`packages/transformer/src/index.ts` から export しない。
    最初の production adapter は source observation から snapshot を生成し、既存または新しい compiler output まで到達する経路を検証してから公開境界を決定する。
  ],
  [
    - snapshot の仕様、テスト、実装を現行 transform の動作から分離して保持できる
    - 現在の `@dathra/transformer` 公開 API と build artifact は増えない
    - ModuleCoordinator または compiler adapter の導入時に successor ADR と integration evidence が必要になる
  ],
)

== インターフェース仕様

#interface_spec(
  name: "Immutable module graph records",
  summary: [
    versioned canonical preimage、SHA-256 identity、deeply immutable record を依存順に生成する。
  ],
  format: [
    ```typescript
    type ModuleImportPhase = "source" | "evaluation"
    type ModuleLoaderNamespaceKind = "native" | "commonjs"
    type ModuleRequestSiteKind =
      | "static-import"
      | "dynamic-import"
      | "commonjs-require"
      | "wasm-import"
      | "css-import"

    interface ModuleIdentityRecord<Id, Preimage> {
      readonly id: Id
      readonly preimage: Preimage
    }

    function canonicalizeModuleUrl(value: string): CanonicalModuleUrl
    function digestModuleContent(bytes: Uint8Array): Promise<ModuleContentDigest>

    function createModuleSemanticProfile(input: ModuleSemanticProfileInput): Promise<ModuleSemanticProfile>
    function createModuleResolutionDomain(input: ModuleResolutionDomainInput): Promise<ModuleResolutionDomain>
    function createModuleRequestInventory(input: ModuleRequestInventoryInput): Promise<ModuleRequestInventory>
    function createExternalModuleDefinitionContract(input: ExternalModuleDefinitionContractInput): Promise<ExternalModuleDefinitionContract>
    function createModuleDefinition(input: ModuleDefinitionInput): Promise<ModuleDefinition>
    function createRuntimeModuleBinding(input: RuntimeModuleBindingInput): Promise<RuntimeModuleBinding>
    function createModuleLoaderEntry(input: ModuleLoaderEntryInput): Promise<ModuleLoaderEntry>
    function createSemanticModuleRequest(input: SemanticModuleRequestInput): Promise<SemanticModuleRequest>
    function createModuleResolutionEvidence(input: ModuleResolutionEvidenceInput): Promise<ModuleResolutionEvidence>
    function createResolvedModuleRequest(input: ResolvedModuleRequestInput): Promise<ResolvedModuleRequest>
    function createExternalRuntimeClosureEvidence(input: ExternalRuntimeClosureEvidenceInput): Promise<ExternalRuntimeClosureEvidence>
    function createModuleRequestSiteEvidence(input: ModuleRequestSiteEvidenceInput): Promise<ModuleRequestSiteEvidence>
    function createModuleRequestSite(input: ModuleRequestSiteInput): Promise<ModuleRequestSite>
    function createModuleGraphEntry(input: ModuleGraphEntryInput): Promise<ModuleGraphEntry>
    ```
  ],
  constraints: [
    - creator input は own enumerable data property だけを持つ closed plain record/array とし、getter、custom prototype、hidden/symbol/extra property を実行せず拒否する
    - creator は URL、set、import attributes、ID set を canonicalize する
    - strict snapshot parser は canonical form を変更せず、noncanonical URL/order/set を拒否する
    - 全 record は versioned preimage の canonical digest と deep-frozen snapshot を返す
  ],
)

#interface_spec(
  name: "Module graph snapshot",
  summary: [
    全 record の exact-use closure と phase-aware reachability を検証し、canonical snapshot ID を生成または strict validation する。
  ],
  format: [
    ```typescript
    interface ModuleGraphSnapshotPreimage {
      readonly schema: "dathra.module-graph-snapshot/1"
      readonly semanticProfiles: readonly ModuleSemanticProfile[]
      readonly resolutionDomains: readonly ModuleResolutionDomain[]
      readonly requestInventories: readonly ModuleRequestInventory[]
      readonly externalDefinitionContracts: readonly ExternalModuleDefinitionContract[]
      readonly moduleDefinitions: readonly ModuleDefinition[]
      readonly runtimeBindings: readonly RuntimeModuleBinding[]
      readonly loaderEntries: readonly ModuleLoaderEntry[]
      readonly externalRuntimeEvidence: readonly ExternalRuntimeClosureEvidence[]
      readonly semanticRequests: readonly SemanticModuleRequest[]
      readonly resolutionEvidence: readonly ModuleResolutionEvidence[]
      readonly resolvedRequests: readonly ResolvedModuleRequest[]
      readonly requestSiteEvidence: readonly ModuleRequestSiteEvidence[]
      readonly requestSites: readonly ModuleRequestSite[]
      readonly entries: readonly ModuleGraphEntry[]
    }

    interface ModuleGraphSnapshot {
      readonly id: ModuleGraphSnapshotId
      readonly preimage: ModuleGraphSnapshotPreimage
    }

    function createModuleGraphSnapshot(input: ModuleGraphSnapshotInput): Promise<ModuleGraphSnapshot>
    function parseModuleGraphSnapshot(value: unknown): Promise<ModuleGraphSnapshot>
    ```
  ],
  constraints: [
    - creator は各 record array を ID 順に canonicalize し、parser は exact order を要求する
    - domain ごとの entry ordinal は0から始まる dense sequence とする
    - record ID、semantic key、runtime identity、module-map/cache key、site ordinal の duplicate/conflict を拒否する
    - external definition は entry/importer にせず、definition contract と runtime evidence を一つずつ要求する
    - content binding の inventory/profile/content digest を一致させる
    - resolution evidence の condition sequence は対応 domain の ESM/CommonJS sequence と重複・順序を含め完全一致させる
    - site、site evidence、semantic request、resolution evidence、resolved request の importer/domain/kind/phase/key set を一致させる
    - source/evaluation fixed point で全 record の exact reachability と exact use を検証する
  ],
)

== 機能仕様

#feature_spec(
  name: "Canonical URL and content identity",
  summary: [
    absolute module URL を WHATWG parse/serialize で canonicalize し、exact byte snapshot の SHA-256 digest を生成する。
  ],
  edge_cases: [
    - query と fragment は保持する
    - relative URL、invalid URL、lone surrogate を拒否する
    - plugin virtual ID は caller が absolute custom-scheme URL へ変換してから渡す
    - digest 開始後の caller mutation は結果を変えない
  ],
  test_cases: [
    - host/default port/dot segment を canonicalize する
    - `node:` と custom-scheme URL を保持する
    - `abc` の既知 SHA-256 vector に一致する
  ],
)

#feature_spec(
  name: "Canonical record DAG",
  summary: [
    edge-independent definition identity から resolved site までを非循環に生成する。
  ],
  test_cases: [
    - record ID が公開 preimage の canonical digest と一致する
    - active condition set と import attributes は input order に依存しない
    - hook-visible condition sequence は重複を含む exact order を保持し、inventory source order も保持する
    - request URL、response/base URL、definition kind、module-map type を別 field として保持する
    - native semantic request は site/target から独立し、CommonJS request は resolution origin を保持する
    - output と nested record は変更できない
  ],
)

#feature_spec(
  name: "Exact graph closure",
  summary: [
    multi-domain graph、cycle、source-only target、external leaf を phase-aware fixed point で検証する。
  ],
  test_cases: [
    - domain ごとに同じ module-map URL を使用できる
    - evaluation import cycle を受理する
    - source-only target の outgoing site 不在を受理し、site が存在すれば拒否する
    - source/evaluation phase が別 runtime binding へ解決する graph を拒否する
    - external target は二段階 contract/evidence が揃う場合だけ受理する
    - dangling、cross-domain、unreachable、unused、duplicate、module-map/cache conflict を拒否する
    - site と semantic request の specifier/attributes/origin を交換した coverage evidence を拒否する
  ],
)

#feature_spec(
  name: "Strict snapshot validation",
  summary: [
    untrusted closed value を normalize せず検証し、canonical immutable snapshot だけを返す。
  ],
  test_cases: [
    - canonical JSON round-trip snapshot を受理する
    - forged nested ID と snapshot ID を拒否する
    - reversed record order、unsorted attributes/set、noncanonical URL を拒否する
    - extra/missing/accessor property を getter 実行なしで拒否する
    - production adapter が確定するまでは transformer root export に creator、parser、error type を含めない
  ],
)

== failure

`ModuleGraphError` は immutable な `code` と root からの `path` を持つ。

```typescript
type ModuleGraphErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-url"
  | "noncanonical-order"
  | "duplicate-record"
  | "digest-mismatch"
  | "dangling-reference"
  | "domain-mismatch"
  | "identity-conflict"
  | "request-conflict"
  | "site-mismatch"
  | "external-contract-mismatch"
  | "unreachable-record"
```

Proxy は canonical identity primitive と同様に caller contract 外とする。
