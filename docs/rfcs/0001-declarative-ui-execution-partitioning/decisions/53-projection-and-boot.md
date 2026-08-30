> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

This file completes the split `ProjectionManifestCore` mapping introduced in [D51](51-graph-table-payload.md) after the records defined in [D52](52-registry-and-manifest.md).

# Projection, loader, and boot contracts

```ts
interface GraphTableBudget {
  readonly maxRawCarrierBytes: number;
  readonly maxCanonicalBytes: number;
  readonly maxDecodedCodeUnits: number;
  readonly maxJsonDepth: number;
  readonly maxSymbols: number;
  readonly maxNodes: number;
  readonly maxCells: number;
  readonly maxSubscriptions: number;
  readonly maxRoots: number;
  readonly maxArrayLength: number;
  readonly maxEntriesPerNode: number;
  readonly maxTotalEntries: number;
  readonly maxPathWitnessSteps: number;
  readonly maxCodecPayloadBytes: number;
  readonly maxMaterializedObjects: number;
  readonly maxMaterializedBytes: number;
  readonly maxCodecWorkUnits: number;
}

interface RootBindingSchemaRecord {
  readonly id: string;
  readonly rootDefinitionId: string;
  readonly activationGroupDefinitionId: string;
  readonly ownerDefinitionId: string;
  readonly captureLayoutDigest: Sha256Digest;
  readonly domTargetDefinitionIds: readonly string[];
  readonly referenceUseSchemaIds: readonly string[];
  readonly subscriptionUseSchemaIds: readonly string[];
}

type ReferencePathSegment =
  | { readonly kind: "capture"; readonly name: string }
  | { readonly kind: "cell-initial" }
  | { readonly kind: "cell-value" }
  | { readonly kind: "subscription-initial" }
  | { readonly kind: "subscription-revision" }
  | { readonly kind: "object-entry"; readonly key: WireKey }
  | { readonly kind: "array-index"; readonly index: number | "*" }
  | { readonly kind: "map-key"; readonly ordinal: number | "*" }
  | { readonly kind: "map-value"; readonly ordinal: number | "*" }
  | { readonly kind: "set-item"; readonly ordinal: number | "*" }
  | { readonly kind: "codec-slot"; readonly name: string; readonly ordinal: number | "*" };

interface ReferenceUseSchemaRecord {
  readonly id: string;
  readonly rootBindingSchemaId: string;
  readonly pathPattern: readonly ReferencePathSegment[];
  readonly pathPatternDigest: Sha256Digest;
  readonly resolverQualifiedId: QualifiedRegistryId<"resolver">;
  readonly valueDomainQualifiedId: QualifiedRegistryId<"value-domain">;
  readonly exposureFactQualifiedId: QualifiedFactId;
  readonly audiencePolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly capabilityPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly authorizationPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly capabilityRequired: boolean;
  readonly shareDomainId: string;
}

interface SubscriptionUseSchemaRecord {
  readonly id: string;
  readonly rootBindingSchemaId: string;
  readonly pathPattern: readonly ReferencePathSegment[];
  readonly pathPatternDigest: Sha256Digest;
  readonly sourceQualifiedId: QualifiedRegistryId<"subscription-source">;
  readonly valueDomainQualifiedId: QualifiedRegistryId<"value-domain">;
  readonly revisionCodecQualifiedId: QualifiedRegistryId<"codec">;
  readonly failureSchemaQualifiedId: QualifiedRegistryId<"failure-schema">;
  readonly audiencePolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly capabilityPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly authorizationPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly shareDomainId: string;
  readonly updateMode: "replacement" | "stable-handle" | "journaled-in-place";
}

interface ReferenceMaterializationCacheKeyPreimage {
  readonly schema: "dathra.reference-cache-key/1";
  readonly envelopeKind: "request-graph" | "dynamic-instantiation";
  readonly envelopeInstanceId: string;
  readonly valueRevisionId: string;
  readonly referenceNodeId: string;
  readonly referenceUseSchemaId: string;
  readonly resolverQualifiedId: QualifiedRegistryId<"resolver">;
  readonly canonicalLocator: CodecWireValue;
  readonly canonicalLocatorDigest: Sha256Digest;
  readonly shareDomainId: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly audienceEvaluationDigest: Sha256Digest;
  readonly authorizationGenerationId: string;
  readonly authorizationGrantId: string;
  readonly capabilityGrantId: string | null;
  readonly capabilityBindingDigest: Sha256Digest;
}

interface IntegrationTargetRecord {
  readonly integrationKey: string;
  readonly kind: "existing-root" | "insertion-slot";
  readonly definitionId: string;
  readonly bindingSchemaId: string;
  readonly cardinality: "one" | "many";
}

interface IntegrationModuleRecord {
  readonly sourceSpecifier: `dathra:activation/${string}`;
  readonly artifactAddressId: string;
  readonly exportName: string;
  readonly activationGroupDefinitionIds: readonly string[];
  readonly clientRootDefinitionIds: readonly string[];
  readonly insertionSlotDefinitionIds: readonly string[];
  readonly authorityScopeId: string;
  readonly instanceDomainId: string;
  readonly targets: Readonly<Record<string, IntegrationTargetRecord>>;
}

interface ProjectionInstancePreimage {
  readonly schema: "dathra.projection-instance/1";
  readonly build: string;
  readonly graphSnapshotDigest: Sha256Digest;
  readonly projectionDefinitionId: string;
  readonly requestClassId: string;
  readonly requestJointVariantId: string;
}

interface ProjectionManifestCore {
  readonly schema: "dathra.projection-core/1";
  readonly build: string;
  readonly projectionDefinitionId: string;
  readonly requestClassId: string;
  readonly requestJointVariantId: string;
  readonly graphSnapshotDigest: Sha256Digest;
  readonly selectionDomainDescriptorDigest: Sha256Digest;
  readonly deploymentIdentity: DeploymentIdentityPreimage;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly artifactBaseUrl: string;
  readonly artifacts: Readonly<Record<string, ArtifactManifestRecord>>;
  readonly definitions: Readonly<Record<string, DefinitionManifestRecord>>;
  readonly registryCatalog: RegistryEnvironmentCatalogRecord;
  readonly registryProtocolCatalog: RegistryProtocolCatalogRecord;
  readonly registryCatalogPairCommitment: RegistryCatalogPairCommitment;
  readonly registryProjection: RegistryEnvironmentProjectionRecord;
  readonly prerequisiteEdges: readonly PrerequisiteEdgeDefinition[];
  readonly rootBindingSchemas: Readonly<Record<string, RootBindingSchemaRecord>>;
  readonly referenceUseSchemas: Readonly<Record<string, ReferenceUseSchemaRecord>>;
  readonly subscriptionUseSchemas: Readonly<Record<string, SubscriptionUseSchemaRecord>>;
  readonly integrationModules: Readonly<Record<string, IntegrationModuleRecord>>;
  readonly allocationTransactions: Readonly<
    Record<string, AllocationTransactionDefinitionRecord>
  >;
  readonly commitTransactions: Readonly<Record<string, CommitTransactionDefinitionRecord>>;
  readonly graphTableBudget: GraphTableBudget;
  readonly lateLedgerBudget: LateLedgerBudget;
  readonly failurePinBudget: FailurePinBudget;
  readonly dynamicInstantiationBudget: DynamicInstantiationBudget;
  readonly subscriptionRuntimeBudget: SubscriptionRuntimeBudget;
  readonly allowedGlobalSymbolKeys: readonly string[];
}

interface ProjectionManifest {
  readonly schema: "dathra.projection-envelope/1";
  readonly build: string;
  readonly projection: string;
  readonly projectionInstance: ProjectionInstancePreimage;
  readonly coreUrl: string;
  readonly coreDigest: Sha256Digest;
  readonly coreByteLength: string;
  readonly planId: string;
  readonly estimatorVersion: "dathra.cost/1";
  readonly costOrder: readonly PartitioningCostMetric[];
  readonly metricVector: readonly string[];
}

interface TrustedBootRecord {
  readonly schema: "dathra.boot/1";
  readonly build: string;
  readonly projection: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly planId: string;
  readonly manifestUrl: string;
  readonly manifestDigest: Sha256Digest;
  readonly envelopeInstance: string | null;
  readonly envelopeDigest: Sha256Digest | null;
  readonly payloadCarrier: {
    readonly encoding: "utf-8";
    readonly rawByteLength: number;
    readonly rawDigest: Sha256Digest;
    readonly decodedCodeUnits: number;
    readonly decodedTextDigest: Sha256Digest;
  } | null;
  readonly loaderAttestationId: string;
  readonly policyGrantAuthorityAttestationId: string;
  readonly subscriptionNamespaceAuthorityAttestationId: string;
  readonly remoteAuthorizationEvidenceIssuerAttestationId: string;
  readonly remoteProtocolCodecAttestationId: string;
}

interface LoaderAttestationPreimage {
  readonly schema: "dathra.loader-attestation-preimage/1";
  readonly hostImplementationDigest: Sha256Digest;
  readonly realmIdentityDigest: Sha256Digest;
  readonly documentGenerationId: string;
  readonly moduleMapEpoch: string;
  readonly decodingPolicyDigest: Sha256Digest;
  readonly redirectPolicyDigest: Sha256Digest;
  readonly artifactAddressSchema: "dathra.artifact-address/1";
  readonly artifactUrlSchema: "dathra.artifact-url/1";
}

interface LoaderAttestation {
  readonly schema: "dathra.loader-attestation/1";
  readonly id: string;
  readonly preimage: LoaderAttestationPreimage;
}

interface VerifiedModuleLoader {
  loadManifest(url: string, exactDigest: Sha256Digest, signal: AbortSignal): Promise<unknown>;
  loadManifestCore(
    url: string,
    exactDigest: Sha256Digest,
    byteLength: number,
    signal: AbortSignal,
  ): Promise<unknown>;
  loadArtifact(
    record: ArtifactManifestRecord,
    artifactBaseUrl: string,
    signal: AbortSignal,
  ): Promise<unknown>;
}

declare const verifiedLoaderCapabilityBrand: unique symbol;

interface VerifiedLoaderCapability {
  readonly [verifiedLoaderCapabilityBrand]: true;
  readonly opaqueId: string;
  readonly attestation: LoaderAttestation;
}

declare const verifiedBootContextBrand: unique symbol;

interface VerifiedBootContext {
  readonly [verifiedBootContextBrand]: true;
  readonly record: TrustedBootRecord;
  readonly loaderCapability: VerifiedLoaderCapability;
  readonly loader: VerifiedModuleLoader;
  readonly policyGrants: PolicyGrantAuthority;
  readonly subscriptionNamespaces: SubscriptionNamespaceAuthority;
  readonly remoteAuthorizationEvidence: RemoteAuthorizationEvidenceIssuer;
  readonly remoteProtocolCodec: RemoteProtocolCodec;
}

interface BootAuthority {
  readonly failures: RuntimeFailureChannel;
  verify(
    rawBootRecord: unknown,
    root: Document | ShadowRoot,
    signal: AbortSignal,
  ): Promise<VerifiedBootContext>;
}
```

projection definition ID は selection domain の DeploymentProjectionDefinitionPreimage、projection instance ID は canonical ProjectionInstancePreimage の digest とする。
ProjectionManifestCore は candidate-dependent な artifact、definition、registry、budget を持つが、plan ID、metric vector、自身の digest、外側 envelope digest を含まない。
compiler は core を canonical JCS UTF-8 bytes にして exact digest と byte length を確定し、その tuple を ManifestCoreIntegrityTable と client-delivered-bytes へ入れてから plan ID を計算する。

ProjectionManifest は core の外側にある固定 field set の envelope である。
core URL は manifest base URL、`cores/`、core digest の base64url 部分、固定 `.dhmanifest` extension から導出し、任意 URL へ差し替えない。
coreByteLength と metricVector は unsigned 64-bit big-endian の padding なし base64url 11文字で encode し、digest、plan ID、projection ID も固定長表記にする。
costOrder は同じ metric 名集合の permutation で総 byte length が変わらない。
したがって canonical envelope byte length は同じ selection domain の全 candidate で一定であり、その既知の固定 byte length も各 class の client-delivered-bytes に加算できる。
envelope の内容は plan ID に依存するが byte length は依存せず、size metric の自己参照を作らない。

TrustedBootRecord は graph-table carrier の値ではなく、integrity-protected bootstrap module、認証済み response metadata、または同等の host channel から runtime へ渡す。
TrustedBootRecord を含む carrier の trust anchor は、対象 ProjectionManifest envelope の外側に置く。
同じ manifest が digest を記録する artifact に、その manifestDigest または自身の artifact digest を埋めてはならない。

BootAuthority と VerifiedModuleLoader の実体は、Dathra runtime entry を呼ぶ host trust anchor が manifest を読む前に注入する。
runtime は manifest から loader implementation を取得しない。
BootAuthority の RuntimeFailureChannel も manifest 検証前に作り、boot、manifest、artifact failure を host sink と FailureRef から観測できるようにする。
host trust anchor は loader object identity と opaque VerifiedLoaderCapability を BootAuthority の private trust store に登録する。
capability は loader implementation、Realm identity、Document generation、module-map epoch、decoding policy、redirect policy を一つの canonical LoaderAttestationPreimage に束縛し、attestation ID はその digest とする。
public issuer は存在せず、manifest、author code、loader 自身が同じ形の object や自己申告 ID を作っても private store membership を満たさない。
BootAuthority は raw boot record の authenticity、principal、policy epoch を検証し、loaderAttestationId に対応する private capability が対象 root の現在の Realm、Document generation、module-map epoch と一致する場合だけ VerifiedBootContext を作る。
同時に policyGrantAuthorityAttestationId が host private store の PolicyGrantAuthority と一致することを検証し、loader と grant authority の両方を同じ VerifiedBootContext に束縛する。
subscriptionNamespaceAuthorityAttestationId も private SubscriptionNamespaceAuthority と一致させ、source descriptor の issuer ID と attestation ID を boot authority に照合する。
remoteAuthorizationEvidenceIssuerAttestationId は browser の private RemoteAuthorizationEvidenceIssuer と一致させ、protocol binding の endpoint、verifier profile、deployment identity に対する evidence だけを発行できるようにする。
remoteProtocolCodecAttestationId は `dathra.remote-jcs-utf8/1` の strict encoder/decoder を持つ private RemoteProtocolCodec と一致させ、protocol binding の codec metadata digest に照合する。
server-request environment は対応する RemoteAuthorizationEvidenceVerifier と RemoteProtocolCodec を host trust anchor から注入し、protocol binding の verifier/codec metadata digest と attestation を照合する。
author code、manifest、registry evaluator は PolicyGrantAuthority、SubscriptionNamespaceAuthority、remote evidence issuer/verifier を注入、置換できない。

runtime は VerifiedBootContext の loader で ProjectionManifest envelope bytes を取得して boot digest、fixed encoding、projection instance preimage を確認する。
envelope の plan ID は認証済み TrustedBootRecord.planId と一致しなければならない。
次に derived core URL から ProjectionManifestCore の exact byte length と digest を検証する。
runtime は request projection だけから full-domain candidate graph を再構築して plan ID を再計算するとは仮定しない。
検証後は `(build, projection definition ID, definitionId)` で definition を、qualified registry ID で codec、resolver、subscription source、policy、host profile、failure schema、remote operation、remote delivery adapter を引く。
ProjectionManifestCore は authenticated browser environment catalog、pair commitment、exact fixed-point projection を保持する。
catalog は browser candidate binding metadata と public protocol metadata を保持するが、artifact table と module graph は projection が選択した binding だけを保持する。
browser-reachable binding が要求する qualified registry role が catalog または projection にない場合は、module load と materialization の前に失敗させる。
descriptor が参照していても server-request role からだけ到達する handler、delivery adapter、ledger、endpoint artifact は client core に入れない。
browser runtime は protocol binding に固定された endpoint identity、deployment identity、transport profile、schema、verifier metadata の存在を要求するが、接続先 implementation artifact の不在を dangling client dependency と扱わない。

VerifiedModuleLoader は capability に束縛された ArtifactAddressPreimage、artifactBaseUrl、decoder、module-map epoch から canonical URL を導出し、module parser へ渡す実 bytes の digest と byteLength を module instantiation 前に検証する。
artifact fetch の redirect は capability の closed redirect policy が明示的に許可して最終 URL と identity を同じ attestation に束縛する場合以外は拒否する。
host がこの対応を attestation できない場合は client artifact を起動しない。

manifest の artifact、definition、registry、binding、reference use、integration、transaction record key と内側の ID は一致しなければならない。
manifest 内の ID list と allowedGlobalSymbolKeys は重複なしの昇順に canonicalize する。
artifact metadata の正本は artifacts table だけであり、definition、registry、integration record は ArtifactAddressId と exportName だけを参照する。
同じ ArtifactAddressId に複数の address preimage、canonical URL、exact digest、byteLength を割り当ててはならない。
runtime は DeploymentIdentityPreimage の digest、addressPreimage の digest、manifest の artifactBaseUrl、導出した canonical URL、実 bytes の exact digest と byteLength をすべて照合する。
dependencyBindings の target qualified registry role は同じ environment projection 内の implementation binding に解決し、その artifact は同じ artifacts table 内で閉じる。
同一環境 import graph は SCC collapse 後に acyclic であることを load 前に検証する。
build validator は QualifiedRegistryUniverseRecord から finalized global/environment catalog への exact transform を検証する。
runtime は BootAuthority が認証した local environment catalog、pair commitment、projection の namespace、qualified ID、kind、version、descriptor、requirement、implementation、dependency、protocol、digest を相互検証する。
RootBindingRecord は bindingSchemaId が指す root、activation group、owner、capture layout、DOMTarget definition の組み合わせと完全に一致しなければならない。
capture key 集合、reference use path、subscription use path、resolved prerequisite、transaction membership、marker provenance、artifact digest、required registry、containment policy も allocation 前に検証する。

envelope は boot record の build、projection、instance、envelopeDigest と一致しなければならない。
request-specific envelope を持たない projection では、boot record の envelope fields と payloadCarrier を null にする。

node ID と cell ID は、build、projection、request instance の namespace 内で一意にする。
graph table は ID reference で alias と cycle を表現し、runtime は全 shell と cell を allocate してから edge を populate する。

payload に function code、module source、authority capability の秘密部分を入れない。
`capabilityRef` は TrustedBootRecord の principal と policy epoch に束縛された host capability registry の non-secret index であり、locator と同じ bearer token にしない。
resolver は locator、capabilityRef、root binding schema、exposure contract、audience をまとめて検証する。
resolver implementation を呼ぶ前に、runtime は descriptor digest と locator schema を確認し、pure な `validateLocator`、capability authorization、exposure/audience check を完了する。
locator validation failure は resolver side effect を実行せず typed reference failure にする。

各 reference materialization demand は、RootBindingRecord の referenceUses から request node、actual path、ReferenceUseSchemaRecord を一意に結び付ける。
actual path は digest から逆算せず、wire の GraphPathWitness を root anchor から一 step ずつ graph table に照合して得る。
各 step は実在する capture、node entry、cell edge、codec-declared slot、subscription edge と一致し、terminal は use record の referenceNodeId または subscriptionId と一致しなければならない。
前 step が指す WireValue の record identity は次 step の nodeId、cellId、subscriptionId と一致しなければならず、独立した正しい edge を並べただけの不連続 witness を拒否する。
witness digest は digest field を空にした canonical witness の digest とし、runtime は full witness と digest の双方を比較する。
step 数は maxPathWitnessSteps 以下とし、`(record kind, record ID, edge selector)` が同じ edge を一 witness 内で再訪する path を拒否する。
cycle を含む graph でも terminal までの単純 path だけを witness にできるため、runtime は全 path を列挙せず有限時間で検証する。

検証済み concrete step 列を ReferencePathSegment へ射影した actual path は manifest の pathPattern に一致し、schema が指定する resolver、value domain、exposure fact、audience policy、capability policy、authorization policy を ReferenceRequest へ供給する。
`cell-initial` は CellRecord の immutable initial edge、`cell-value` は authorization generation ごとに再検証した live cell value edge を表し、両者を同じ witness digest にしない。
`subscription-initial` は handoff snapshot、`subscription-revision` は session identity と revision ID に束縛した update payload を表し、revision ごとに authorization と cache identity を更新する。
同じ RootBindingSchemaRecord 内の pathPattern は pairwise disjoint でなければならず、一つの actual path に複数 schema が一致する manifest を拒否する。
既定の resolution cache key は canonical ReferenceMaterializationCacheKeyPreimage の digest とする。
boot request graph と dynamic instantiation を envelopeKind で分け、それぞれ graph instance ID または dynamic envelope identity を envelopeInstanceId にする。
envelope instance、value revision、reference node、use schema、resolver、canonical locator、share domain、principal、policy epoch、audience evaluation、authorization generation、grant、capability binding のどれかが異なる resolution は共有しない。
cache entry は canonical locator を含む key preimage 自体も保持して digest collision を拒否する。
異なる use を共有できるのは、shareDomainId が等しく、全 policy evaluator が同じ alias と lifetime を明示的に許可した場合だけである。

materialization 前に schema、trusted boot binding、digest、budget、ID uniqueness、reference closure、local registry catalog/projection、binding authorization、capability、exposure を検証する。
validation failure は dependent scope を `failed` status にし、別 candidate や rerender へ fallback しない。

request-specific capture、reference、subscription handle、dynamic instance metadata が一つもない projection では、graph-table carrier を出力しない。
static client artifact と DOM marker だけで activation できる場合も zero-payload とする。
