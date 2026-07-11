# Declarative UI execution partitioning design

作成日: 2026-07-08
更新日: 2026-07-12
状態: 設計判断完了、実装中

この文書は、Dathra の server と client の実行分割に関する設計判断の正本である。
末尾の「破棄した案」を除くすべての節を、現行方針の規範として扱う。
「破棄した案」は設計経緯であり、実装要件ではない。

後方互換性は設計上の制約にしない。
現行の hydration API、island scheduler、directive、runtime semantics は、必要であれば破壊的に変更する。

設計判断を正本として固定し、production code への実装を進める。

## 最終目標

開発者が UI を一度自然に宣言すれば、compiler が server と client の実行配置を導出できる状態を目指す。

> 宣言的 UI から server と client の実行配置を導出し、server-first な出力と必要最小限の client runtime を両立する。

この目標は、component を server component と client component に分割すること自体を求めない。
component は UI の構造と所有権を表現できるが、実行場所の境界にはしない。

初期 UI を構成する root は、明示的な client-only opt-out がない限り server で materialize する。
server で完結する計算、依存 package、resource は client artifact に入れない。
browser では、interaction、継続的な state 更新、client-only platform operation に必要な code と runtime だけを起動する。

server が生成した HTML と Declarative Shadow DOM（DSD）は、client activation のために component body を再実行せず、そのまま利用する。
client activation は既存 DOM に listener、binding、effect、cleanup を接続する処理である。

Reactive graph、hydration、island、directive は実現手段であり、最終目標ではない。

## 保証する範囲

現行方針は、次の性質を保証対象にする。

- 初期 UI root は、明示的な client-only opt-out がない限り server artifact から実現する。
- server でだけ必要な計算と依存は server に閉じる。
- client artifact の各 semantic unit は、具体的な client root、materialization、recorder、guard、host adapter のいずれかから根拠を持つ。
- static DOM は client mutation plan に含めず、既存 node を暗黙に置換しない。
- client placement、transfer、activation を安全に構成できない場合は、具体的な dependency path を示して失敗する。
- compiler は暗黙の RPC、component replay、component 全体の rerender fallback を生成しない。

「必要最小限」は、任意の JavaScript 変換に対する大域的な最適解を意味しない。
compiler がサポートする有限候補集合の中で、契約を満たす候補を比較し、server 配置と client cost に関する設定済みの順序で最良の候補を選ぶ。

現行方針は、任意の JavaScript と host の完全な形式検証を保証しない。
任意の第三者 code と同じ authority realm を共有した場合の noninterference、network effect の無条件な exactly-once、すべての scheduler に対する liveness も baseline の保証に含めない。

## 基本用語

- **ObservationContract**：root が外部へ示す value、DOM、artifact、protocol、effect、terminal outcome の観測条件である。
- **ExecutionGraph**：compiler が source と契約から構築する、実行、依存、effect、ownership、transfer の保守的な上限グラフである。
- **TemplateNode**：source 上の静的な operation 定義である。
- **Occurrence**：request、render attempt、activation、event などで生じる TemplateNode の動的な実行である。
- **root**：外部から要求される結果または実行入口を表す obligation である。
- **ClientScopeGraph**：client root、state、artifact、DOM target、ownership、activation を表す compiler 生成グラフである。
- **MaterializationPlan**：cross-boundary demand を target の値、identity、reference、subscription、remote operation として満たす計画である。
- **activation**：既存 DOM または compiler 生成 DOM に client behavior を接続し、client root を実行可能にする処理である。

## 意味契約

### ObservationContract

ObservationContract は root ごとに定義する。
契約には、必要に応じて次の項目を含める。

- value と DOM の内容
- artifact と protocol の出力
- event と effect の cardinality
- effect と callback の partial order
- admission cut と event source
- identity と lifetime
- consistency cut と read validity
- authority と exposure
- success、typed failure、cancel、disconnect などの terminal outcome

共有する DOM range、host target、identity domain、resource、global listener、authority realm がある root は、planning 前に composition group へまとめる。
共有 operation は、exclusive ownership、commutativity、total order のいずれかを契約しなければならない。
両立しない契約は compile diagnostic とする。

plan の合法性は、同じ external input と event identity に対する source trace と plan trace の関係で判定する。
契約は、観測集合の equality を要求するのか、許容範囲内の refinement を認めるのかを明示する。

ObservationContract は次の closed schema を正本とする。

```ts
type ObservationCardinality =
  | { readonly kind: "exactly"; readonly count: number }
  | { readonly kind: "range"; readonly minimum: number; readonly maximum: number };

type ObservationConstraint =
  | {
      readonly kind: "value";
      readonly id: string;
      readonly subjectId: string;
      readonly equivalenceDomainId: string;
      readonly consistencyCutId: string;
    }
  | {
      readonly kind: "dom";
      readonly id: string;
      readonly subjectId: string;
      readonly realizationDomainId: string;
      readonly mutableFacetPolicyId: string;
      readonly consistencyCutId: string;
    }
  | {
      readonly kind: "artifact" | "protocol";
      readonly id: string;
      readonly subjectId: string;
      readonly byteOrMessageSchemaId: string;
      readonly cardinality: ObservationCardinality;
    }
  | {
      readonly kind: "event" | "effect" | "callback";
      readonly id: string;
      readonly subjectId: string;
      readonly inputIdentityDomainId: string;
      readonly occurrenceIdentityDomainId: string;
      readonly cardinality: ObservationCardinality;
      readonly admissionCutId: string;
      readonly coalescingPolicyId: string | null;
    }
  | {
      readonly kind: "identity" | "lifetime";
      readonly id: string;
      readonly subjectId: string;
      readonly identityDomainId: string;
      readonly lifetimeDomainId: string;
    }
  | {
      readonly kind: "authority" | "exposure";
      readonly id: string;
      readonly subjectId: string;
      readonly policyQualifiedId: QualifiedRegistryId<"policy">;
      readonly policyEpochDomainId: string;
    }
  | {
      readonly kind: "terminal";
      readonly id: string;
      readonly subjectId: string;
      readonly outcomes: readonly (
        | "success"
        | "typed-failure"
        | "cancelled"
        | "timed-out"
        | "disconnected"
        | "ambiguous"
      )[];
    };

interface ObservationOrderEdge {
  readonly id: string;
  readonly beforeConstraintId: string;
  readonly afterConstraintId: string;
  readonly relation: "strict" | "serial" | "exclusive";
}

interface ObservationRefinementRule {
  readonly id: string;
  readonly kind:
    | "equivalent-value"
    | "narrow-cardinality"
    | "omit-unobservable-internal-step"
    | "commutative-reorder"
    | "declared-event-coalescing";
  readonly constraintIds: readonly string[];
  readonly proofDomainId: string;
}

interface ObservationContractPreimage {
  readonly schema: "dathra.observation-contract/1";
  readonly rootDefinitionId: string;
  readonly externalInputIdentitySchemaId: string;
  readonly eventIdentitySchemaId: string;
  readonly initialCutId: string;
  readonly relation: "trace-equality" | "trace-refinement";
  readonly constraints: readonly ObservationConstraint[];
  readonly orderEdges: readonly ObservationOrderEdge[];
  readonly refinementRules: readonly ObservationRefinementRule[];
}

interface ObservationCompositionBinding {
  readonly sharedSubjectId: string;
  readonly memberConstraintIds: readonly string[];
  readonly resolution:
    | { readonly kind: "exclusive-owner"; readonly ownerConstraintId: string }
    | { readonly kind: "commutative"; readonly proofDomainId: string }
    | { readonly kind: "total-order"; readonly orderedConstraintIds: readonly string[] };
}

interface ObservationCompositionPreimage {
  readonly schema: "dathra.observation-composition/1";
  readonly memberContractIds: readonly string[];
  readonly bindings: readonly ObservationCompositionBinding[];
}

interface RealizationWitnessPreimage {
  readonly schema: "dathra.realization-witness/1";
  readonly observationContractId: string;
  readonly targetHostProfileId: QualifiedRegistryId<"host-profile">;
  readonly encoding: "utf-8";
  readonly contentTypeId: string;
  readonly documentMode: "no-quirks" | "limited-quirks" | "quirks";
  readonly canonicalBaseUrl: string;
  readonly policyEpoch: string;
  readonly customElementRegistryIdentity: string;
  readonly parserProfileId: string;
  readonly parserOperationIds: readonly string[];
  readonly upgradeEffectIds: readonly string[];
  readonly adoptEffectIds: readonly string[];
  readonly realizedConstraintIds: readonly string[];
}
```

constraint、order edge、refinement rule、composition binding は ID 順に並べ、各 ID は ID field を除く canonical record の digest とする。
contract ID、composition ID、RealizationWitness ID はそれぞれ canonical preimage 全体の digest とする。
outcome と member ID の list は重複なしの昇順とし、dangling edge、order cycle、同じ shared subject に対する複数 resolution を拒否する。

`trace-equality` は、同じ external input identity ごとに constraint ID、occurrence identity、cardinality、terminal、partial-order closure が一致する場合だけ合法とする。
`trace-refinement` は source constraint ごとに明示された ObservationRefinementRule だけを適用できる。
value replacement は同じ equivalence domain の proof、cardinality narrowing は source range の部分集合、reorder は composition が証明した commutative set に限定する。
event coalescing は、coalescing policy が入力 event identity から出力 occurrence identity への total mapping、保持する order、cardinality、overflow terminal を定義する場合だけ許可する。
単に同じ callback body であることや同じ task 内で発生したことを coalescing の根拠にしない。

composition は member contract を shared subject ごとに join する。
同じ subject の identity、lifetime、authority、exposure、terminal が一致せず、exclusive owner、commutativity proof、total order のいずれでも解決できない場合は planning 前の compile diagnostic とする。
RealizationWitness は実現した constraint を一つずつ参照し、未証明 constraint、別 contract の witness、canonical parser profile にない operation を受理しない。
targetHostProfileId は selection domain の hostProfileIds と対象 environment catalog の qualified host-profile membership の両方に存在しなければならない。

### server-first の合法性

初期 UI obligation を持つ root は、契約で固定した initial cut において server materialization を持たなければならない。
planner が admission point を後ろへ移して client rendering を server rendering に見せかけることは許可しない。

client-only initial UI は例外である。
例外を使えるのは、compiler が legal な server materialization を構成できないと証明した root に限る。
その root は、root-local な `render:client` contract を持たなければならない。
server materialization を構成できず、client-only contract もない場合は diagnostic とする。

server artifact が initial DOM root を満たすには、**RealizationWitness** が必要である。
RealizationWitness は、target host、encoding、content type、document mode、base URL、policy、custom-element registry、parser、upgrade、adopt の effect を記録する。

初期 DOM の各 observable node と value は、server artifact token、DSD、または author code を実行しない規範的な parser operation に由来しなければならない。
custom-element constructor、upgrade、adopt が実行した author code の DOM write は client effect であり、server materialization の根拠にはしない。

### client artifact の選択

compiler が扱う候補集合は、compiler がサポートする placement、materialization、adapter、optional capability の組み合わせを網羅する。
候補は decision DAG として表現し、必要に応じて build-time solver と runtime guard を使う。

候補を比較する単位は **PartitioningSelectionDomain** とする。
一つの domain は、同じ ExecutionGraph snapshot、toolchain profile、host profile 集合、宣言済み request-envelope class 集合を共有する deployment projection 全体である。
shared chunk と shared runtime を projection ごとに別々に最適化せず、domain 全体の候補 plan に含める。

domain は候補に依存しない次の descriptor で固定する。

```ts
interface RequestJointVariantDescriptor {
  readonly schema: "dathra.request-variant/1";
  readonly id: string;
  readonly keyAliasPartitionId: string;
  readonly generationAssignmentId: string;
  readonly cardinalityBoundId: string;
  readonly resolvedInstanceFamilyDigest: Sha256Digest;
}

interface DeploymentProjectionDefinitionPreimage {
  readonly schema: "dathra.projection-definition/1";
  readonly graphSnapshotDigest: Sha256Digest;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly rootObligationIds: readonly string[];
  readonly outputProtocolIds: readonly string[];
  readonly hostProfileIds: readonly QualifiedRegistryId<"host-profile">[];
  readonly requestInputDomainContractDigest: Sha256Digest;
  readonly authorityScopeId: string;
  readonly exposureDomainId: string;
}

interface DeploymentProjectionDefinition {
  readonly id: string;
  readonly preimage: DeploymentProjectionDefinitionPreimage;
}

interface RequestEnvelopeClassDescriptor {
  readonly schema: "dathra.request-class/1";
  readonly id: string;
  readonly predicateRegionDigest: Sha256Digest;
  readonly projectionIds: readonly string[];
  readonly inputDomainContractDigest: Sha256Digest;
  readonly jointVariants: readonly RequestJointVariantDescriptor[];
}

type RequestScalarAtomRegion =
  | { readonly kind: "absent" }
  | { readonly kind: "null" }
  | { readonly kind: "boolean"; readonly value: boolean }
  | {
      readonly kind: "number-interval";
      readonly lower: number | null;
      readonly lowerInclusive: boolean;
      readonly upper: number | null;
      readonly upperInclusive: boolean;
    }
  | { readonly kind: "string-exact"; readonly values: readonly string[] }
  | {
      readonly kind: "string-prefix-region";
      readonly prefix: string;
      readonly excludedChildPrefixes: readonly string[];
      readonly includeExactPrefix: boolean;
    };

interface RequestFieldAtomDescriptor {
  readonly schema: "dathra.request-field-atom/1";
  readonly id: string;
  readonly inputFieldId: string;
  readonly region: RequestScalarAtomRegion;
}

interface RequestInputFieldPartitionDescriptor {
  readonly schema: "dathra.request-field-partition/1";
  readonly id: string;
  readonly inputFieldId: string;
  readonly valueKind: "null-only" | "boolean" | "finite-number" | "string";
  readonly presence: "required" | "optional";
  readonly nullable: boolean;
  readonly atoms: readonly RequestFieldAtomDescriptor[];
}

interface RequestJointInputAtomDescriptor {
  readonly schema: "dathra.request-joint-input-atom/1";
  readonly id: string;
  readonly assignments: readonly {
    readonly inputFieldId: string;
    readonly fieldAtomId: string;
  }[];
}

interface RequestClassificationRecord {
  readonly jointInputAtomId: string;
  readonly classId: string;
}

interface RequestEnvelopePartitionContract {
  readonly schema: "dathra.request-partition/1";
  readonly inputUniverseDigest: Sha256Digest;
  readonly fieldPartitions: readonly RequestInputFieldPartitionDescriptor[];
  readonly jointInputAtoms: readonly RequestJointInputAtomDescriptor[];
  readonly classification: readonly RequestClassificationRecord[];
  readonly classifierDigest: Sha256Digest;
  readonly classes: readonly RequestEnvelopeClassDescriptor[];
}

interface PartitioningSelectionDomainDescriptor {
  readonly schema: "dathra.selection-domain/1";
  readonly graphSnapshotDigest: Sha256Digest;
  readonly bundlerProfileDigest: Sha256Digest;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly artifactBaseUrl: string;
  readonly hostProfileIds: readonly QualifiedRegistryId<"host-profile">[];
  readonly projectionDefinitions: readonly DeploymentProjectionDefinition[];
  readonly requestPartition: RequestEnvelopePartitionContract;
}
```

すべての ID list と record list は重複なしの content-addressed ID 昇順とする。
projection definition ID は canonical DeploymentProjectionDefinitionPreimage の digest とする。
preimage は root obligation、output protocol、host profile、request input domain、authority、exposure だけを含み、candidate plan、artifact address、manifest digest、metric vector を含めない。
RequestEnvelopeClassDescriptor.projectionIds は selection domain の projectionDefinitions だけを参照し、ProjectionManifest の instance identity を参照しない。
`classes` は class ID 順、各 class の `jointVariants` は variant ID 順に固定する。
joint variant は alias partition、generation assignment、cardinality bound の許可された組み合わせを一つに固定し、三軸の不正な Cartesian product を作らない。

classifier の identity は、author predicate の syntax tree や相関する Boolean test の RODD から直接作らない。
compiler は分類に使う request field を absent、null、boolean、finite number interval、string exact set、string prefix trie leaf の closed scalar algebra で、pairwise disjoint かつ exhaustive な RequestFieldAtomDescriptor へ正規化する。
複雑な request value は application が content-bound contract で scalar classification key へ射影し、その射影を server request work と ObservationContract に含める。

RequestJointInputAtomDescriptor は各 field から atom を一つずつ選ぶ canonical assignment tuple である。
input domain が禁止する組み合わせは jointInputAtoms へ入れず、許可 tuple の list 自体を input universe とするため、相関 field の不正な Cartesian product を作らない。
field atom は field ID と region、field partition は field ID と全 atom、joint atom は assignment 全体から content-addressed ID を作る。
required field は absent atom、non-nullable field は null atom を持てず、optional または nullable field は対応 atom をちょうど一つ持つ。
number interval の境界、string exact set、prefix の excluded child は closed decision procedure で交差、包含、空集合を判定し、NaN、infinity、lone surrogate、重複値、非正規化 interval を拒否する。

classification は joint input atom ID ごとに class ID を一つ割り当てる昇順 table であり、欠落、重複、unknown atom、unknown class を許さない。
各 class の predicateRegionDigest は classification がその class へ割り当てた joint input atom ID の昇順 list の digest とする。
author の `equal`、`member-of`、range、prefix predicate はこの atom set の union へ lower し、同じ region set は同じ classification table になる。
`classifierDigest` は field partition、joint input atom、classification table の canonical digest とする。
compiler はこの table を runtime 用 multiway decision DAG へ圧縮できるが、圧縮 graph は semantic identity や cost partition の正本にしない。
compiler は projection reachability、input domain、joint variant 集合が等しい predicate region を必ず merge し、これ以上 merge できない maximal equivalence class を作る。
class ID と variant ID は、それぞれ ID field を除く canonical descriptor の digest とする。
author が同じ request 集合を任意に分割して cost を変えることはできない。

class contract が finite な joint variant または instance cardinality を列挙できない場合、その軸を使う metric は `UNBOUNDED` とする。

TemplateNode ID は、canonical module URL、transform 後 module content digest、semantic operation kind、normalized syntax tree の preorder ordinal から作る。
compiler 生成 operation の ID は、generator schema version、入力 node ID、root obligation ID、operation kind から作る。
**ClientSemanticUnitId** は、この canonical operation ID、environment qualification、semantic role の tuple である。

client semantic unit の universe には、client で実行する operation、保持する runtime record、decoder、adapter、recorder、guard を含める。
chunk、minifier が複製した syntax、manifest 内の同じ ID は別 semantic unit にしない。
二つの候補の subset 関係は、同じ PartitioningSelectionDomain の ClientSemanticUnitId 集合だけで比較する。

候補の比較順序は次の通りとする。

1. ObservationContract を満たさない候補を除外する。
2. ほかの合法候補の client semantic unit 集合の strict superset である候補を除外し、合法な server placement を最大化する。
3. 残る候補を deterministic な cost vector で比較する。

既定の cost vector は、次の辞書式順序とする。

1. final transform 後に client へ配信する manifest と artifact bytes
2. client parse と evaluation の operation estimate
3. client resident mutable record count
4. activation critical path の runtime work
5. contract が宣言した request envelope における HTML carrier bytes
6. server request work

動的な値は、contract が宣言した上限または区間の上限を非負整数へ正規化する。
すべての値が同じ場合は、content-addressed plan ID の昇順で選ぶ。

build config の `partitioning.costOrder` は、上記六項目の順序だけを変更できる。
ObservationContract、server-first、justification の条件を cost 設定で弱めることはできない。

```ts
type PartitioningCostMetric =
  | "client-delivered-bytes"
  | "client-parse-evaluation"
  | "client-resident-records"
  | "activation-critical-work"
  | "html-carrier-bytes"
  | "server-request-work";

interface PartitioningConfig {
  costOrder?: readonly PartitioningCostMetric[];
}
```

`costOrder` を指定する場合は六項目を重複なくすべて列挙する。

既定 estimator version は `dathra.cost/1` とする。
各 metric は unsigned 64-bit integer で表し、有限値は `2^63 - 2` で saturation し、未知または上限を持たない値は `UNBOUNDED = 2^63 - 1` とする。

`dathra.cost/1` は、content-addressed toolchain、resolver、target、printer、minifier、chunking、WebAssembly lowering を固定した **BundlerProfile** を入力にする。
profile は ambient path、時刻、乱数、列挙順の揺れを入力にせず、同じ domain と候補から同じ final artifact graph を生成しなければならない。

各合法候補は、比較前に同じ BundlerProfile で finalization する。
finalizer は module と chunk dependency graph の strongly connected component を先に collapse する。
cyclic SCC は一つの addressable chunk artifact へ coalesce し、condensation DAG の各 node を一つの addressable artifact とする。
各 artifact の address preimage は次の closed schema を持つ。

```ts
type ArtifactEntryRole =
  | "runtime-entry"
  | "integration-entry"
  | "definition-entry";

interface DeploymentIdentityPreimage {
  readonly schema: "dathra.deployment-identity/1";
  readonly applicationNamespaceDigest: Sha256Digest;
  readonly releaseIdentity: string;
  readonly targetEnvironmentId: string;
  readonly canonicalPublicOrigin: string;
  readonly contractNamespaceGraphDigest: Sha256Digest;
  readonly hostProfileSetDigest: Sha256Digest;
}

interface ArtifactFinalizationTemplate {
  readonly schema: "dathra.artifact-finalization/1";
  readonly textEncoding: "utf-8";
  readonly moduleFormat: "esm";
  readonly wrapper: "none" | "runtime-registration" | "integration-registration";
  readonly dependencyReference: "canonical-relative-url" | "canonical-absolute-url";
  readonly exportEmission: "sorted-named-exports";
  readonly entryInvocation: "none" | "sorted-registration-calls";
  readonly sourceSeparator: "lf-semicolon";
  readonly wasmBinding: "external-module" | "none";
  readonly dataBinding: "external-fetch" | "none";
}

interface ArtifactEntryBinding {
  readonly role: ArtifactEntryRole;
  readonly entrySemanticId: string;
  readonly exportedName: string;
  readonly invocationOrdinal: number;
}

interface ArtifactDependencyBinding {
  readonly slot: string;
  readonly kind: "static-import" | "dynamic-import" | "wasm-import" | "data-reference";
  readonly targetArtifactAddressId: string;
  readonly targetExportName: string | null;
}

interface ArtifactExportBinding {
  readonly exportName: string;
  readonly memberSemanticId: string;
  readonly exportRole:
    | "definition"
    | "integration-provider"
    | "runtime-bootstrap"
    | "registry-implementation"
    | "data-handle"
    | "wasm-binding";
}

interface ArtifactAddressPreimage {
  readonly schema: "dathra.artifact-address/1";
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly artifactBaseUrl: string;
  readonly bundlerProfileDigest: Sha256Digest;
  readonly kind: "javascript" | "wasm" | "data";
  readonly finalizationTemplate: ArtifactFinalizationTemplate;
  readonly entryBindings: readonly ArtifactEntryBinding[];
  readonly memberSemanticIds: readonly string[];
  readonly dependencyBindings: readonly ArtifactDependencyBinding[];
  readonly exportTable: readonly ArtifactExportBinding[];
}

interface ArtifactIntegrityEntry {
  readonly artifactAddressId: string;
  readonly exactDigest: Sha256Digest;
  readonly byteLength: number;
}

interface ArtifactIntegrityTable {
  readonly schema: "dathra.artifact-integrity-table/1";
  readonly entries: readonly ArtifactIntegrityEntry[];
}

interface ManifestCoreIntegrityEntry {
  readonly projectionDefinitionId: string;
  readonly requestClassId: string;
  readonly requestJointVariantId: string;
  readonly coreDigest: Sha256Digest;
  readonly coreByteLength: number;
}

interface ManifestCoreIntegrityTable {
  readonly schema: "dathra.manifest-core-integrity-table/1";
  readonly entries: readonly ManifestCoreIntegrityEntry[];
}

interface PartitioningMetricVector {
  readonly schema: "dathra.metric-vector/1";
  readonly estimatorVersion: "dathra.cost/1";
  readonly costOrder: readonly PartitioningCostMetric[];
  readonly values: readonly string[];
}

interface PlanIdentityPreimage {
  readonly schema: "dathra.plan-identity/1";
  readonly candidateGraphDigest: Sha256Digest;
  readonly selectionDomainDescriptorDigest: Sha256Digest;
  readonly bundlerProfileDigest: Sha256Digest;
  readonly artifactIntegrityTable: ArtifactIntegrityTable;
  readonly manifestCoreIntegrityTable: ManifestCoreIntegrityTable;
  readonly metricVector: PartitioningMetricVector;
}
```

memberSemanticIds は canonical semantic ID 昇順であり、member ordinal はその index である。
dependencyBindings は `slot`、`kind`、target ArtifactAddressId、target export の順、exportTable は exportName 順に canonicalize し、重複する slot と exportName を拒否する。
entryBindings は role、entry semantic ID、exported name、invocation ordinal の順に並べ、ordinal は 0 から隙間なく一意にする。
一つの SCC に複数 entry がある場合も全 entry binding を保持し、単一 role へ潰さない。
shared chunk、Wasm module、data table のように invocation entry を持たない artifact は空 entryBindings を使う。
ArtifactFinalizationTemplate は linker wrapper、import/export emission、entry invocation、source separator、text encoding を closed enum で固定する。
BundlerProfile が同じでも finalization template、entry binding、labeled import slot、export binding のいずれかが異なれば別 address になる。
**ArtifactAddressId** は canonical ArtifactAddressPreimage の digest とする。
同じ bytes でも module identity または SCC membership が異なる artifact は別 ArtifactAddressId を持つ。

`artifactBaseUrl` は absolute URL として parse し、username、password、query、fragment を拒否し、default port と dot segment を URL Standard serializer で正規化した後、path を一つの `/` で終わらせる。
canonical URL は `dathra.artifact-url/1` 規則で、正規化済み base URL に `javascript/`、`wasm/`、`data/` の kind segment、ArtifactAddressId の digest 部分、固定 extension `.mjs`、`.wasm`、`.dhdata` を順に連結して一意に導出する。
segment は ASCII base64url だけを許し、percent encoding の別表現を受理しない。
URL を manifest や definition ごとに上書きできない。

artifact は依存先の ArtifactAddressId を含められるが、自身の exact-byte digest と plan ID を自身の bytes に埋めない。
runtime が必要とする plan ID、integrity digest、deployment metadata は TrustedBootRecord、ProjectionManifest envelope、ProjectionManifestCore から渡す。

deploymentIdentityDigest は canonical DeploymentIdentityPreimage の digest とする。
DeploymentIdentityPreimage は application、release、target environment、public origin、contract namespace graph、host profile set だけを含み、plan ID、manifest digest、artifact address、artifact exact digest を含めない。
ArtifactAddressId を URL と import reference へ埋めて final bytes を生成した後、各 artifact の exact-byte SHA-256 digest を計算する。
ArtifactIntegrityTable は ArtifactAddressId 順で重複なく並べ、address、exact digest、byte length を一つに束縛する。
ManifestCoreIntegrityTable は projection definition、request class、joint variant の tuple 順に並べ、plan ID と metric を持たない canonical ProjectionManifestCore の exact digest と byte length を束縛する。
PartitioningMetricVector は costOrder と同じ長さの decimal value を保持する。
plan ID は、canonical candidate graph、PartitioningSelectionDomainDescriptor、BundlerProfile、ArtifactIntegrityTable、PartitioningMetricVector を束縛した canonical PlanIdentityPreimage の digest とする。
plan ID は manifest にだけ記録するため、自己参照は発生しない。

`dathra.cost/1` は各 metric を次のように数える。

- **client-delivered-bytes**：request-envelope class ごとに各 joint variant から cold client が取得する ProjectionManifestCore exact bytes、candidate-invariant な固定長 ProjectionManifest envelope bytes、reachable JavaScript、WebAssembly、data artifact exact bytes を数える。artifact は ArtifactAddressId ごとに variant 内で一回だけ数え、class 内の最大 variant 値を class ID 順に saturation 加算する。別 class から同じ core または shared artifact へ到達する場合は class ごとに数える。client が取得しない source map と debug metadata は除外するが、取得する signature envelope、decoder table、static data は含める。
- **client-parse-evaluation**：BundlerProfile が固定した ESTree parser で final JavaScript を再解析した syntax node、ECMAScript Module Record の instantiation と evaluation、固定した WebAssembly decoder の instruction をそれぞれ一 cost unit として数える。
- **client-resident-records**：compiler 生成 mutable cell、subscription、owner、lease、recorder、guard、materialization handle について、request-envelope class 内の最大同時 instance 数を求め、class ID 順に saturation 加算する。environment-permanent な shared record は domain 全体で一回だけ数える。
- **activation-critical-work**：request-envelope class ごとに、jointVariants を resolved prerequisite graph へ適用する。各 variant の condensation DAG 最長 path 上にある load、verify、allocate、populate、register、recorder-install、reconcile、commit、effect-start operation を数え、class 内の最大値を class ID 順に saturation 加算する。
- **html-carrier-bytes**：各 request-envelope class について、exact `<template data-dh-payload="...">` opener、HTML text context へ escape 済み canonical graph-table text、`</template>` closer を response writer が UTF-8 encode した byte length の契約上限を、class ID 順に saturation 加算する。JSON の escape 前 byte length で代用しない。
- **server-request-work**：各 request-envelope class の server-request phase で発生する TemplateNode Occurrence 数の契約上限を、class ID 順に saturation 加算する。

ClientSemanticUnitId の subset 比較では、複数 root または projection が共有する static runtime definition を一つの PartitioningSelectionDomain 内で一回だけ数える。
client-delivered-bytes では cold request を比較単位とし、同じ joint variant 内の shared artifact だけを一回にする。
browser cache、別 request、別 navigation による再利用は baseline estimator の値を減らす根拠にしない。
instance record は宣言済み最大同時 cardinality を数える。
dynamic cardinality は contract が宣言した上限を使い、上限がなければ `UNBOUNDED` とする。

estimator version、costOrder、metric vector は PlanIdentityPreimage と ProjectionManifest envelope に記録する。
PlanIdentityPreimage の metric vector は costOrder と同じ六要素を持ち、unsigned value を leading zero のない decimal string で記録する。
固定長 envelope では同じ値を unsigned 64-bit big-endian base64url へ encode し、decode 後の値が plan preimage と一致しなければならない。

module import の到達可能性だけでは、client unit の根拠にならない。
各 unit は具体的な contract obligation への justification path を持たなければならない。

## compiler execution model

### ModuleCoordinator

現行の file 単位 `mode: "ssr" | "csr"` transform は、最終設計の compilation unit にしない。
新しい compiler は build 全体を扱う **ModuleCoordinator** を持つ。

ModuleCoordinator は、canonical resolver、conditional exports、関連 plugin transform、有限 dynamic import を解決した後に graph-completeness barrier を置く。
全 entry を content-addressed fixed point まで解析し、barrier の後でだけ final artifact を出力する。

server build と client build は、同じ graph snapshot と hash を参照する。
watch build は reverse dependency を一つの compilation transaction として invalidate する。

### ExecutionGraph の qualification

ExecutionGraph の node は TemplateNode であり、動的実行そのものではない。
各 node は、少なくとも次の location と instance domain を持つ。

```txt
HostInstance
  x AgentCluster
  x Agent
  x Realm
  x Global
  x Principal
```

Occurrence は、必要に応じて次の identity を持つ。

```txt
rootInstanceId
activationId
continuationId
registrationId
allocationId
```

Occurrence は、module instance、request、render attempt、activation、event task、update flush、remote invocation、cleanup など複数の epoch instance に同時に属し得る。

task source、microtask、render opportunity の順序は、任意の `happens-before` edge で捏造しない。
`Enqueue`、`Start`、`MicrotaskCheckpoint`、`Complete` の動的 event と host scheduler semantics から導出する。

### node と edge

ExecutionGraph は、少なくとも次の node を表現する。

- module instantiation、module evaluation、module binding cell
- allocation、heap region、property read、property write
- state read、state write、compute、call、branch
- callback registration、callback body
- await、continuation、return、throw、reject、abort
- DOM create、DOM reference、DOM binding、DOM mutation
- effect、resource、lifecycle、stream step
- transfer demand、protocol operation、artifact contribution
- admission adapter、event recorder、catch-up read
- capability use、authority possession、enforcement boundary

ExecutionGraph は、少なくとも次の edge を表現する。

- data と control
- call と possible-call
- reads-from と writes-to
- possible-subscription と untracked-data
- invalidation
- registration、materializes、obligates
- scheduling、settles、resumes、abrupt-to-handler
- happens-before と synchronizes-with
- module-link、live-binding-read、live-binding-write、evaluate-before
- alias と identity
- ownership、lifetime、cleanup
- transfer
- capability use と authority possession

未対応構文は、信頼できる summary、target-native semantic closure、diagnostic のいずれかで扱う。

### root の導出

root の seed は、外部から admission される entry、初期 UI、artifact、request handler、action、明示 lifecycle、明示 effect、platform obligation である。

callback registration は、すべてを seed にしない。
initial UI などの seed から `may-materialize` と `may-execute` の forward least fixed point を計算し、宣言的に必要な registration site を発見する。

RegistrationInstance は、`pending`、`active`、`cancelled`、`closed` の protocol state を持つ。
callback の発火は registration state ではなく、`CallbackInvocationOccurrence` として表す。

DOM event listener の invocation は、event path の entry と phase ごとの native snapshot、removed flag、propagation guard、type、capture、`once`、AbortSignal を反映する。
`once` listener は callback Start の直前に close する。

registration が有効な trigger snapshot に参加した場合だけ、callback を contingent client root とする。
callback 内で新しい registration が materialize される場合も、同じ fixed point を続ける。

root は、phase、trigger、owner、cardinality、admission cut、cancellation、terminal outcome、ObservationContract を持つ。
root は obligation であり、元の source function を一回呼ぶという意味ではない。

### reactive dependency

compile-time graph は、runtime dependency の保守的な上限を表す。
runtime signal graph は、実際に tracked read を行った collector ごとに構築する。

ReadOccurrence は `collectorEvaluationId` と `trackingMode` を持つ。
tracked occurrence を抽出した後で dependency identity を deduplicate する。
untracked read が同じ signal を読んでも、tracked subscription を消してはならない。

evaluation result の publication と subscription generation の activation は、一つの linearization protocol に置く。
各 tracked dependency が read 後に変更されていないことを検証するか、provisional subscription が区間中の invalidation を記録する。
stale な結果は publish せず、primitive contract に従って dirty または retry とする。

client updater root は、active subscription generation 上で invalidator から binding へ到達する場合だけ存在する。
無関係な browser write が存在するだけで updater root を作らない。

### read の classification

read は一つの enum に押し込まず、独立した軸で分類する。

- **Stability**：immutable、stable-within token、may-change
- **Consistency**：none、snapshot token、linearizable authority
- **ReplayPolicy**：duplicate、reorder、recompute の可否
- **Effect**：read 自体の observable effect
- **Realm**：read が成立する host と realm
- **Exposure**：result を公開できる audience と sink

複数 read で一つの invariant を支える場合は、共通 cut、version、transaction、history point を要求する。
validity は planning 時だけでなく、transfer、admission、recompute など実際の consumption point で検証する。

### semantic evidence

semantic fact の情報源は次の三つである。

- compiler が直接解析できる source
- Dathra package が生成する content-bound semantic manifest
- opaque boundary に対する明示 execution contract

これらは first-match の優先順位ではなく、一つの typed fact lattice へ evidence を供給する。
明示 contract は、直接証明できた source fact と矛盾できない。
矛盾は diagnostic とする。

semantic manifest と contract は、少なくとも次の fact を表現できるようにする。

- environment と host profile
- effect と read
- possible call と higher-order invocation summary
- callback retention、reentrancy、spawned work
- identity と ownership
- transfer capability
- exposure と integrity
- version、artifact digest、dependency epoch
- trust boundary

TypeScript type は補助情報として利用できるが、配置と effect の唯一の根拠にはしない。

unknown code が server root だけから到達し、server execution に不足 fact がなければ server に閉じられる。
unknown code が client、effect、authority に関係する場合は、同じ authority realm で到達可能な capability、resource、root へ保守的な edge を追加する。
unknown は permission にならない。

通常の browser realm の executable code は、静的 import がなくても ambient authority を持つ。
`CapabilityUse` がないことは、authority を剥奪したことを意味しない。
authority を制限する場合は、Worker、sandbox、compartment など実際の enforcement boundary を要求する。

### artifact 出力

一つの ExecutionGraph から、次の artifact を別々に生成する。

- server renderer と server artifact graph
- client definition と client artifact graph
- deployment manifest
- request ごとの reachable projection と transfer payload

server と client は、同じ component body を二回実行する二つの mode ではない。
同じ semantic IR から生成される別 program である。

semantic inclusion と physical bundling は分離する。
chunk をまとめても、activation policy、ownership、module identity を統合しない。

最終 bundler transform 後に client closure を再検証する。
server-only dependency、unrelated unit、version mismatch、integrity mismatch が混入した場合は artifact を失敗させる。

## component と JavaScript の扱い

### component body

component body は render-safe な宣言領域とする。
JSX、純粋または replay-safe な計算、classified read handle、compiler が理解する framework primitive を記述できる。

render safety は checked effect contract である。
ambient write、timer、resource construction、未分類の time、random、network、storage access は、classified handle または明示 root adapter を介さない限り body で拒否する。

未知 helper call は versioned effect summary を要求し、summary は cache と retry witness の dependency になる。
framework が検出できない effect は contract violation である。
検出した場合は publication 前に generation を失敗させ、cache と retry の保証を無効化する。

実行回数に意味がある database write などは、request handler、action、transaction、明示 remote protocol に置く。
汎用的な `serverEffect` は導入しない。

response status、header、head、preload、metadata は、用途別の declarative contribution として扱う。
これらは deterministic な merge と conflict rule を持つ。

### plain DOM

plain DOM は server または client boundary を作らない。
static DOM は server artifact に materialize し、client update plan から除外する。

plain DOM の client lifetime は、compiler 生成 marker range と coordinator で表現する。
client root があれば、`defineComponent` がなくても client scope を作れる。

### functional component

compiler が source または semantic expansion summary を持つ functional component は graph-transparent とする。
component call 自体を hydrate unit にしない。

first-class escape、dynamic dispatch、opaque import は invocation node として残す。
points-to summary、target-native module closure、明示 contract のいずれも構成できなければ diagnostic とする。

### defineComponent

`defineComponent` は、次の責務を持つ。

- custom-element identity
- ShadowRoot と DSD の ownership
- static style artifact
- custom-element registration
- lifetime region の候補
- platform lifecycle record

`defineComponent` は、server と client の境界、hydrate unit、activation group、chunk boundary ではない。
一つの host は、複数の shared state と activation group を所有できる。

### function と module extraction

function object と ECMAScript Environment Record は serialize しない。
runtime に parser、scope engine、eval engine を追加しない。

build 時の code extraction と request 時の capture materialization を分ける。
runtime へ送るのは、認証済み native artifact、有限な CaptureLayout、承認済み value、compiler-owned cell ID、reference である。

client-reachable callable は、次の有限候補で扱う。

- native syntax で生成する allocation unit
- target-native module closure の binding
- closed capture を持つ compiler 生成 adapter
- 仕様上の bind operation を保持できる known bound function plan
- contract を持つ intrinsic または host callable reference
- diagnostic

Script、CommonJS、Module の parse goal を勝手に変えない。
Script または CommonJS を Module として出力するのは、global environment、top-level `this`、declaration、host hook、source URL、early error、loader semantics の同値性を証明できる場合に限る。

**NativeModuleClosure** は、一つの target module map に属する Module Record と ModuleRequest の必要な transitive closure である。
live binding、namespace identity、cycle、top-level await、`import.meta`、evaluation failure cache を保持する。

dynamic import は、事前認証された有限候補、または同じ graph epoch で link 前に認証する extension に限定する。
host が module bytes と manifest の対応を保証できない場合は、native reuse を許可しない。

source evaluation event は別 realm で replay しない。
object、array、RegExp、template、computed key、spread、class heritage、field、static block、default initializer、bind も observable evaluation event に含む。

client で同じ code を評価する場合は、source event を replay するのではなく、client に配置された別の合法な event として扱う。
server result の client recomputation は、ObservationContract に対する同値性を証明できる場合だけ選ぶ。

direct eval、indirect eval、Function constructor、`with` は別々に分類する。
direct eval は ECMAScript の Reference 条件と current Realm の `%eval%` identity を満たす場合だけ direct と判定する。
その環境を保持できない場合は、native ownership または diagnostic とする。

### capture と mutable state

capture の安全性は binding だけでなく、値から到達する alias graph 全体で判定する。
`const` binding は deep immutable の証明にならない。

mutable capture は、次のいずれかを選ぶ。

- immutable snapshot
- source 側の将来観測がない exclusive handoff
- target-native ownership
- compiler-owned stable cell
- author-visible な explicit remote shared state
- unsupported diagnostic

silent な mutable copy と fork は許可しない。

reflection obligation は観測項目ごとに判定する。
`Function.prototype.toString()`、identity、`caller`、`arguments`、descriptor、prototype、extensibility を一つの「native emission」でまとめて証明したことにしない。

Proxy、host object、private brand、internal slot、SharedArrayBuffer、WeakMap などを一般 object として introspect しない。
target-native ownership、型別 contract、reference、DTO のいずれも構成できなければ diagnostic とする。

## cross-boundary materialization

### demand-first planning

cross-boundary dependency では、先に **MaterializationRequirement** と **EmissionRequirement** を導出する。

- MaterializationRequirement は、target に必要な value、identity、state、lifetime を表す。
- EmissionRequirement は、どの sink にどの representation を出すかを表す。

serializer の型一覧を先に照合しない。
ObservationContract を満たす plan を有限候補から選ぶ。

候補は次の通りである。

- no transfer と server-only
- compile-time inline
- server snapshot
- target-native construction または module binding
- tracked reconstruction codec
- locator による reference resolution
- snapshot と subscription
- author-visible な explicit async remote operation

server render 中に合法な値が既に得られる場合は、server snapshot を既定候補にする。
client recomputation は、同値性と cost の両方が成立するときだけ選ぶ。

plan は一つの enum を順に試す first-match 方式ではない。
複数 step と route variant を持つ finite DAG または decision graph として構成する。

### materialization state

MaterializationAttempt は `committed` または `failedPrecommit` で終了する。
provisional graph は、allocate、populate、pure finalize、validate の順に構築する。

registry commit は、provisional graph と identity registry に対する一つの pointer または version swap とする。
precommit operation は pure、reversible、lease-based のいずれかでなければならない。
provisional root は commit 前に escape できない。

commit 済み MaterializedGraphInstance は、`inactive`、`active`、`activationFailed`、`retired` を独立して遷移する。
postcommit effect と outbox は別の state machine を持つ。
postcommit failure で公開済み generation を rollback または削除しない。

### identity

identity domain は次のように分ける。

- materialized graph 内の alias
- target lifetime identity
- application entity identity
- remote locator
- authority capability

locator と capability を同じ token にしない。
locator を知っているだけでは access できない。

structural deduplication は、identity を持たない immutable data に限定する。
更新は、immutable replacement、stable handle または cell、journaled in-place update のいずれかを ObservationContract で選ぶ。

MaterializedGraphInstance は、identity-connected root、cell、prototype、local symbol、backing store、view を canonicalize する。
cross-payload reuse は、realm、lifetime、principal、tenant、session、policy epoch、label、build、schema、codec version、ObservationContract が両立する場合だけ許可する。
reuse 前に authority を再検証し、generation pin を原子的に取得する。

### snapshot と codec

snapshot plan は、**CaptureConsistency** を満たさなければならない。
CaptureConsistency は、immutability、stable revision、quiescence、registered atomic capture protocol のいずれかで証明する。

eligibility 判定で accessor、Proxy trap、未知 user code を実行しない。
plan commitment 後に選択した codec は一回だけ実行する。
codec failure で別候補を試して effect を重複させず、その attempt を失敗させる。

snapshot eligibility は、strong edge と明示登録された logical backing edge だけを走査する。
列挙できない weak association、private state、internal slot は `OpaqueAll` として扱う。

value は次の段階で扱う。

1. compiler が証明した plain graph data
2. Dathra が追跡する codec または brand-creating hook
3. built-in type codec
4. target-native construction、DTO、reference、diagnostic

任意 constructor の実行や `Object.create(prototype)` で private brand と internal slot を再現しない。

### continuous update

subscription の `open` は、snapshot revision と log-boundary cursor を一つの consistency point で返す。
contract は sequence namespace、gap、cursor expiry、acknowledgement watermark、reconnect、resync、policy revalidation、retention、budget、GC を定義する。

SubscriptionSession は target lifetime が所有する authority-bound resource である。
MaterializationAttempt は consumer lease を持つだけである。
attempt failure 後に provisional root へ event を渡さない。

各 revision は、base generation と base revision を持つ UpdateAttempt として適用する。
decode、authority validation、provisional allocation を publication 前に完了する。

replacement と handle update は、一つの generation または cell swap で publish する。
in-place update は exclusive observation barrier、完全な undo journal、deferred notification を要求する。
failure 時は前 revision と cursor と acknowledgement を維持し、retry または resync contract に従う。

snapshot と subscription の組は TransferBinding の `subscription`、qualified SubscriptionSourceRegistryDescriptor、SubscriptionUseSchemaRecord、graph-table の SubscriptionRecord で表す。
SubscriptionRecord の initialSnapshot、snapshotRevision、logBoundaryCursor、transport continuity、sequence namespace は source の `open` が返す一つの consistency point と一致しなければならない。
SubscriptionRecord は SSR/browser handoff record であり、browser-local owner generation または session identity を含めない。
source descriptor は locator、value domain、revision codec、failure schema、audience、capability、authorization、sequence contract、update mode を閉じ、manifest の use schema と相互検証する。
SubscriptionSequenceContract の count、byte、gap は正の safe integer、horizon と deadline は正の safe integer millisecond とする。
各 descriptor の contract は ProjectionManifestCore.subscriptionRuntimeBudget 以下、core budget は RuntimeHostAdapter.subscriptionHardLimit 以下でなければならない。

sequence namespace ID は source qualified ID、canonical locator digest、principal、descriptor の namespaceDomainId、source が attestation した sequence epoch の canonical SubscriptionSequenceNamespacePreimage digest とする。
runtime は VerifiedBootContext の SubscriptionNamespaceAuthority で issuer、proof、source、locator、principal、namespace domain、epoch、preimage digest を検証し、source が任意 namespace ID を自己申告することを許さない。
transport continuity ID は source、canonical locator、principal、policy epoch、verified sequence namespace の canonical SubscriptionTransportContinuityPreimage digest とし、SSR/browser handoff で維持する。
runtime は wrapper 作成ごとに coordinator ID、client-local owner generation、単調 session incarnation sequence の canonical SubscriptionSessionIncarnationPreimage から新しい sessionIncarnationId を発行する。
sequence は leading zero のない unsigned decimal string とし、resume、reconnect wrapper replacement、resync のたびに進め、同じ owner generation 内でも再利用しない。
local SubscriptionSession identity は session incarnation ID、transport continuity ID、client-local owner generation、use schema、share domain、authorization generation、audience evaluation、capability binding の canonical preimage digest とし、SSR generation を browser owner として再利用しない。
runtime は owner generation、session incarnation、root binding、use schema を SubscriptionRuntimeRequestContext として wrapper 側だけに保持する。
open 前に locator、authenticated local registry catalog、grant、share domain を検証し、session budget を provisional に予約して private SubscriptionAdmissionToken を source-facing SubscriptionTransportOpenRequest へ渡す。
source-facing open、resume、resync request は owner generation、root binding schema、use schema、local session identity を含めない。
source は SubscriptionTransportOpenResult として initial consistency point、transport session、namespace attestation だけを返し、runtime identity、budget claim ID、terminal deadline、grant claim を生成しない。
runtime は返却値を検証した後に SubscriptionSession wrapper を作り、identity、budget claim、deadline、grant claim、transport forwarding を owner generation の cleanup ledger に同時登録する。
session admission は concurrent session、outstanding revision、unacknowledged revision、retained byte、gap の枠を原子的に予約し、budgetClaimId を session terminal まで保持する。
枠を予約できない場合は source を開かず typed admission failure にする。
SSR から browser への handoff では、browser source の `resume` に initial snapshot、snapshot revision、log-boundary cursor、expected transport continuity ID、expected sequence namespace を渡す。
resume は cursor より後の event だけを admission し、open を再実行して snapshot と log の間に gap を作らない。
source implementation の server `open` と browser `resume` は同じ qualified descriptor と sequence contract に束縛し、client-only polling へ置換しない。
transport の `next()` は revision、gap、cursor expiry、typed failure の SubscriptionTransportEvent を返し、runtime-local owner generation または session identity を生成しない。
revision event は transport continuity ID、sequence namespace、transport base revision を持つ SubscriptionTransportRevisionEnvelope を運ぶ。
wrapper は revision の continuity、namespace、base revision、payload digest を検証し、すべての event を wrapper 作成時の owner generation と local session identity を持つ SubscriptionRuntimeEventEnvelope で包む。
coordinator は revision publication、gap/resync 遷移、cursor-expired terminal、typed-failure terminal、acknowledgement forwarding の各直前に、envelope の `(capturedOwnerGenerationId, capturedSessionIdentityDigest)` を current wrapper pair と一つの lock で原子的に照合する。
pair が異なる旧 wrapper の revision、terminal event、acknowledgement は current session へ作用させず破棄し、transport close だけを旧 wrapper の cleanup ledger で完了する。
throw または reject は runtime failure とするが、同じ pair fence を通らない旧 wrapper failure で current session を失敗させない。

acknowledgement は revision publication 後だけ単調に進め、失敗 UpdateAttempt の sequence と cursor を acknowledge しない。
consumer が maxUnacknowledgedRevisions、maxOutstandingRevisions、maxRetainedBytes、maxSequenceGap のいずれかへ達した場合は新 revision を無制限に buffer せず、contract の overflow に従って close-and-resync または failed terminal にする。
acknowledged revision の payload は cursorRetentionMs と reconnectHorizonMs の必要範囲だけ保持し、`acknowledged-and-cursor-expired` 条件を満たした順に GC する。
disconnect は contract に従って即時 close、または reconnectHorizonMs まで budget 内で保持し、期限後は cursor-expired terminal にする。
resync は resyncHorizonMs 内だけ許可し、session は terminalDeadlineMs までに close、failed、superseded のいずれかへ terminalize して budget claim と grant claim を解放する。
cursor expiry または policy revalidation 後の resync は SubscriptionSession の captured method から行わない。
runtime は fresh capability/authorization evaluation、grant claim、provisional budget token を取得し、local expected old session identity と transport continuity ID、expected old namespace、new authorization generation を持つ SubscriptionLocalResyncCommand を作る。
runtime は command の local old identity が current wrapper と一致することを検証した後、local identity を除いた SubscriptionTransportResyncRequest を source へ渡す。
source は old transport continuity と namespace が current transport に一致する場合だけ新しい initial consistency point を返し、runtime-local identity を観測しない。
resync は旧 session を新 session identity へ暗黙 alias せず、必ず新しい sessionIncarnationId を発行する。
provisional new session の検証後に current wrapper pair と generation value を一つの atomic swap で publish して旧 session と旧 grant claim を閉じる。
sequence contract が `preserve` なら resync result の namespace は old namespace と一致しなければならない。
`rotate-with-new-snapshot` なら新 snapshot consistency point と新 attested namespace を同時 publish し、旧 namespace の revision を新 session へ admission しない。
SubscriptionUseSchemaRecord または required symbolic registry universe entry がない subscription demand は client polling へ fallback せず compile diagnostic とする。

### remote operation

remote operation は、author-visible な async API としてだけ導入する。
compiler は通常の server function call を暗黙 RPC に変換しない。

baseline の ExecutionEnvironment は build、server-request、browser の三つに閉じる。
remote operation の `remote` は browser から server-request への protocol semantics を表し、第三の Dathra runtime environment を意味しない。
RemoteDeliveryAdapter は server-request 上の host-attested role とし、外部 service、database、queue との通信は adapter 自身の delivery contract と host attestation の内側で実行する。
server-request から別 Dathra runtime へ処理を再委譲する機能を将来追加する場合は、同一環境 import で代用せず、専用 endpoint、wire DTO、authority evidence、receipt conversion、protocol budget を持つ第二の明示 protocol として設計する。

baseline は ambiguous failure 後の blind retry と exactly-once を保証しない。
adapter は、principal-bound key、request commitment、authorization、idempotency、fencing、retention、result disclosure、ambiguous reconciliation を定義する。

transactional exactly-once を名乗れるのは、effect と ledger と result が一つの atomic commit に入る場合、または sink が同等の fenced idempotency を保証する場合だけである。
この保証は host-attested RemoteDeliveryAdapter が server-local RemoteAdapterCommitReceipt を発行し、endpoint の wire proof を browser authority が検証して作る VerifiedRemoteCommitReceipt を commit certainty の根拠にする。
transactional handler の対象 effect は RemoteAtomicTransaction を経由しなければならず、transaction 外の author effect を exactly-once 保証へ含めない。
保証期間を明示し、retention 終了後は `Expired` または `Ambiguous` とする。

### exposure と integrity

PrincipalContext は trusted host が作り、request、session、tenant、route、policy epoch に束縛する。

exposure label は、data、alias、value または DOM structure に影響する control dependency を通じて伝播する。
timing と termination の noninterference は baseline の保証外である。

release は、元の値と label を変更せず、sink、audience、purpose に限定した derived value と audit record を作る。
restricting owner の承認と audit append が完了する前に sink へ公開しない。

integrity endorsement は release と分ける。
live DOM から adopt した値は、検証または endorsement が完了するまで untrusted とする。

### request graph-table payload

request ごとの materialization data は、versioned な **graph-table payload** で送る。
payload は executable script と data attribute store にしない。

HTML carrier は、次の non-executable template とする。

```html
<template data-dh-payload="projection-instance-id">{"schema":"dathra.graph/1","build":"...","projection":"..."}</template>
```

payload encoder は HTML text context に対して `&`、`<`、`>` を escape し、template content が element または executable content として解釈されないようにする。
runtime は HTML parser が document encoding から復号した `template.content.textContent` を取得し、strict JSON parser で解釈する。
digest 検証では parse result を JCS で canonical UTF-8 bytes に再 encode する。

response writer は document encoding を UTF-8 に固定し、carrier を送る前に rawByteLength、rawDigest、decodedCodeUnits、decodedTextDigest を計算して GraphTableBudget を適用する。
raw fields は canonical opener、HTML-escaped text content、closer を含む template carrier 全体の exact response bytes、decoded fields は HTML parser 復号後の `template.content.textContent` DOMString とその UTF-8 encoding の SHA-256 digest を表す。
opener の attribute order、引用符、projection instance ID の encoding、closer は `dathra.payload-carrier/1` の固定 template で生成し、任意の HTML printer に委ねない。
BootAuthority はこの host-side PayloadCarrier attestation を TrustedBootRecord の一部として認証する。
browser runtime は raw response bytes を再取得できるとは仮定せず、attestation と decoded DOMString の code-unit length と digest を照合する。

envelope は、少なくとも次の field を持つ。

- `schema`
- `build`
- `projection`
- `instance`
- `digest`
- `symbols`
- `nodes`
- `cells`
- `subscriptions`
- `roots`

table record は次の discriminated schema を持つ。

```ts
type WireScalar = null | boolean | number | string;

type WireSpecial =
  | { readonly $undefined: true }
  | { readonly $bigint: string }
  | { readonly $number: "-0" | "NaN" | "+Infinity" | "-Infinity" }
  | { readonly $bytes: string };

type WellKnownSymbolName =
  | "asyncDispose"
  | "asyncIterator"
  | "dispose"
  | "hasInstance"
  | "isConcatSpreadable"
  | "iterator"
  | "match"
  | "matchAll"
  | "replace"
  | "search"
  | "species"
  | "split"
  | "toPrimitive"
  | "toStringTag"
  | "unscopables";

type WireSymbol =
  | { readonly $symbol: "local"; readonly id: string }
  | { readonly $symbol: "global"; readonly key: string }
  | { readonly $symbol: "well-known"; readonly name: WellKnownSymbolName };

type WireValue =
  | WireScalar
  | WireSpecial
  | WireSymbol
  | { readonly $ref: string }
  | { readonly $cell: string }
  | { readonly $subscription: string };

type WireKey = string | WireSymbol;

type CodecWireValue =
  | WireScalar
  | WireSpecial
  | readonly CodecWireValue[]
  | { readonly [key: string]: CodecWireValue };

type GraphNodeRecord =
  | {
      readonly id: string;
      readonly kind: "object";
      readonly prototype: "object" | "null";
      readonly entries: readonly (readonly [WireKey, WireValue])[];
    }
  | {
      readonly id: string;
      readonly kind: "array";
      readonly length: number;
      readonly entries: readonly (readonly [number, WireValue])[];
    }
  | {
      readonly id: string;
      readonly kind: "map";
      readonly entries: readonly (readonly [WireValue, WireValue])[];
    }
  | { readonly id: string; readonly kind: "set"; readonly items: readonly WireValue[] }
  | {
      readonly id: string;
      readonly kind: "codec";
      readonly codec: {
        readonly qualifiedId: QualifiedRegistryId<"codec">;
        readonly version: string;
      };
      readonly payload: CodecWireValue;
    }
  | {
      readonly id: string;
      readonly kind: "reference";
      readonly resolverQualifiedId: QualifiedRegistryId<"resolver">;
      readonly locator: CodecWireValue;
      readonly capabilityRef: string | null;
    };

interface LocalSymbolRecord {
  readonly id: string;
  readonly description: string | null;
}

interface CellRecord {
  readonly id: string;
  readonly mode: "immutable" | "mutable";
  readonly initial: WireValue;
}

interface SubscriptionRecord {
  readonly id: string;
  readonly sourceQualifiedId: QualifiedRegistryId<"subscription-source">;
  readonly locator: CodecWireValue;
  readonly capabilityRef: string | null;
  readonly transportContinuityId: string;
  readonly sequenceNamespaceId: string;
  readonly sequenceEpochId: string;
  readonly sequenceNamespaceAttestationDigest: Sha256Digest;
  readonly initialSnapshot: WireValue;
  readonly snapshotRevision: string;
  readonly logBoundaryCursor: CodecWireValue;
}

type GraphPathWitnessStep =
  | { readonly kind: "capture"; readonly captureName: string }
  | { readonly kind: "cell-initial"; readonly cellId: string }
  | { readonly kind: "cell-value"; readonly cellId: string; readonly revisionId: string }
  | { readonly kind: "object-entry"; readonly nodeId: string; readonly key: WireKey }
  | { readonly kind: "array-index"; readonly nodeId: string; readonly index: number }
  | { readonly kind: "map-key"; readonly nodeId: string; readonly ordinal: number }
  | { readonly kind: "map-value"; readonly nodeId: string; readonly ordinal: number }
  | { readonly kind: "set-item"; readonly nodeId: string; readonly ordinal: number }
  | {
      readonly kind: "codec-slot";
      readonly nodeId: string;
      readonly name: string;
      readonly ordinal: number;
    }
  | { readonly kind: "subscription-initial"; readonly subscriptionId: string }
  | {
      readonly kind: "subscription-revision";
      readonly subscriptionId: string;
      readonly revisionId: string;
    };

interface GraphPathWitness {
  readonly schema: "dathra.graph-path/1";
  readonly rootBindingSchemaId: string;
  readonly rootInstanceId: string;
  readonly steps: readonly GraphPathWitnessStep[];
  readonly terminal:
    | { readonly kind: "reference"; readonly referenceNodeId: string }
    | { readonly kind: "subscription"; readonly subscriptionId: string };
  readonly digest: Sha256Digest;
}

interface RootBindingRecord {
  readonly bindingSchemaId: string;
  readonly rootInstanceId: string;
  readonly definitionId: string;
  readonly activationGroupDefinitionId: string;
  readonly ownerDefinitionId: string;
  readonly ownerInstanceId: string;
  readonly captureLayoutDigest: Sha256Digest;
  readonly captures: Readonly<Record<string, WireValue>>;
  readonly domTargets: readonly {
    readonly definitionId: string;
    readonly instanceId: string;
    readonly markerRangeId: string;
  }[];
  readonly referenceUses: readonly {
    readonly referenceNodeId: string;
    readonly pathWitness: GraphPathWitness;
    readonly referenceUseSchemaId: string;
  }[];
  readonly subscriptionUses: readonly {
    readonly subscriptionId: string;
    readonly pathWitness: GraphPathWitness;
    readonly subscriptionUseSchemaId: string;
  }[];
}

interface GraphTableEnvelope {
  readonly schema: "dathra.graph/1";
  readonly build: string;
  readonly projection: string;
  readonly instance: string;
  readonly digest: Sha256Digest;
  readonly symbols: readonly LocalSymbolRecord[];
  readonly nodes: readonly GraphNodeRecord[];
  readonly cells: readonly CellRecord[];
  readonly subscriptions: readonly SubscriptionRecord[];
  readonly roots: readonly RootBindingRecord[];
}
```

`$bytes` は padding なしの base64url、`$bigint` は canonical decimal string とする。
finite JSON number 以外は `$number` tag で表す。
WireScalar の number は有限かつ negative zero ではない値に限定する。

local symbol の `id` は envelope 内 identity であり、同じ ID は symbols table の一 record と同じ新規 Symbol を参照する。
WireSymbol 自体に description を重複して持たせない。
symbols table は ID 昇順で、ID と description の組を一意にする。
global symbol は ProjectionManifestCore の allowedGlobalSymbolKeys に含まれる key だけを `Symbol.for(key)` で materialize する。
allowlist は environment-permanent、principal-independent、tenant-independent、public identity として contract された key に限定する。
payload は allowlist にない global symbol registry entry を作れない。
well-known symbol は `dathra.well-known-symbol/1` の closed name list から host の対応する `Symbol` static property を参照する。
host profile が宣言しない well-known symbol は materialize 前に失敗させ、local symbol や global registry symbol へ代替しない。

built-in object snapshot は、`Object.prototype` または null prototype を持ち、accessor、non-default data descriptor、non-enumerable property、custom internal slot を観測する必要がない ordinary object に限定する。
built-in array snapshot は標準 Array prototype、`length`、既定 descriptor の indexed data property だけを扱う。
array entry がない index は hole であり、`$undefined` entry と区別する。
array length は safe integer かつ `0 <= length <= 2^32 - 1` とする。
array index は重複のない昇順整数で、`0 <= index <= 2^32 - 2` かつ `index < length` を満たさなければならない。

Map と Set は標準 prototype、insertion order、custom own property を観測しない場合だけ built-in snapshot を使う。
prototype、descriptor、accessor、subclass、class brand、internal slot の観測が必要な値は、codec、reference、target-native ownership、diagnostic のいずれかで扱う。

codec は versioned な CodecWireValue schema を所有する。
alias と cycle が必要な codec は、自身の payload 内に ID table を定義し、`validateWire` と materializer で検証する。
framework は codec payload を一般 JavaScript object として introspect しない。
codec payload から framework graph edge を公開する場合は CodecGraphEdgeSlotTable を descriptor に含める。
slot table は slot name 順、wire path は property、exact array index、単一の array-each から成る closed path とし、edge kind と one/optional/many cardinality を固定する。
slot name と canonical wire path は重複できず、array-each は cardinality `many` の slot に一度だけ使える。
runtime は materialization 前に canonical wire path を反復走査し、抽出した edge を stable ordinal 順に並べて GraphPathWitness の codec-slot name/ordinal と照合する。
path 不一致、cardinality 違反、宣言 edge kind と WireValue tag の不一致を codec invocation 前に拒否する。
graphEdgeSlots が null の codec では codec-slot witness を禁止し、payload 内の `$ref`、`$cell`、`$subscription` という形の object を framework edge として解釈しない。
GraphNodeRecord の codec qualifiedId と resolverQualifiedId は RegistryEnvironmentCatalogEntry の qualifiedId であり、source-local ID を wire へ出さない。

canonical JSON は RFC 8785 の JSON Canonicalization Scheme を使う。
`symbols` は symbol ID、`nodes` は node ID、`cells` は cell ID、`subscriptions` は subscription ID、`roots` は root instance ID の昇順に並べる。
object entry は ECMAScript の `OwnPropertyKeys` order、Map と Set は insertion order、array entry は index order を保つ。
host raw path は strict UTF-8 を検証し、browser JSON decoder は duplicate JSON property、lone surrogate、I-JSON number、framework record schema にない field を canonicalization 前に拒否する。
codec payload の field は、closed-declarative codec では framework validator、host-attested codec では attested `validateWire` が codec schema に従って検証する。
table ID、object key、Map key、Set item、array index の重複も、各 schema の identity rule に従って拒否する。
decoded DOMString は JCS が生成する canonical JSON text と code point 単位で完全一致しなければならず、leading、trailing、inter-token whitespace を許さない。
parser は maxJsonDepth を iterative preflight で検証してから recursive value を構築する。
GraphTableBudget の全 field は正の safe integer とし、raw carrier byte、canonical byte、decoded code unit、JSON depth、symbol、node、cell、subscription、root、entry、array length、codec payload、materialized object、retained materialized byte、codec work unit の上限を shell allocation 前に検証する。
closed-declarative codec は framework validator で wire schema を検証し、CodecMaterializationProgram から objectCount、retainedBytes、workUnits の上限を静的に計算する。
host-attested codec だけが executable な `validateWire`、`preflight`、`materialize` を提供できる。
この codec は host private allowlist の implementation digest、実行 realm、metering または同等の resource enforcement、conformance vector に束縛し、`defineTransferCodec()` を呼んだだけの author object を attested と扱わない。
runtime は built-in shell と全 codec estimate を saturation 加算し、budget 内であることを確認するまで shell allocation と codec materialization を開始しない。
host-attested codec preflight 自体は maxCodecPayloadBytes 内の wire tree だけを反復走査し、host read、network、capability use、author callback、materialized value allocation を行えないことを host enforcement boundary で保証する。
host がこの enforcement を提供できない executable codec は materialization candidate にせず、closed declarative DTO、reference、target-native ownership のいずれかを要求する。
maxArrayLength は `2^32 - 1` 以下とし、runtime host profile の hard ceiling を超える budget を manifest 自体の検証で拒否する。

digest 表記は `sha-256:<padding なし base64url>` とする。
envelope の `digest` は、digest field を空 string にした canonical UTF-8 JSON の SHA-256 digest である。
この自己 digest だけを authenticity の根拠にしない。
manifestDigest は canonical JCS manifest bytes、artifact digest は host decoder が module parser または WebAssembly compiler へ渡す exact bytes の SHA-256 digest とする。

plan-independent な ProjectionManifestCore は、次の mapping を持つ。

```ts
type DefinitionKind =
  | "lifetime-region"
  | "shared-state"
  | "client-root"
  | "activation-group"
  | "client-artifact"
  | "dom-target"
  | "event-recorder"
  | "shell-registration"
  | "dom-template"
  | "insertion-slot"
  | "external-dom-region"
  | "subscription-session"
  | "allocation-transaction"
  | "commit-transaction";

interface DefinitionManifestRecord {
  readonly definitionId: string;
  readonly kind: DefinitionKind;
  readonly artifact: {
    readonly artifactAddressId: string;
    readonly exportName: string;
  } | null;
  readonly contractDigest: Sha256Digest;
  readonly keySchemaDigest: Sha256Digest;
  readonly registryProjectionSeeds: readonly RegistryProjectionSeed[];
  readonly containmentPolicy: PostActiveFailureContainment | null;
}

interface ArtifactManifestRecord {
  readonly artifactAddressId: string;
  readonly addressPreimage: ArtifactAddressPreimage;
  readonly exactDigest: Sha256Digest;
  readonly byteLength: number;
}

type RegistryImplementationRole =
  | "codec-capture"
  | "codec-materialize"
  | "resolver-resolve"
  | "subscription-open"
  | "subscription-resume"
  | "subscription-resync"
  | "policy-evaluate"
  | "value-domain-validate"
  | "failure-schema-adapt"
  | "host-profile-validate"
  | "brand-validate"
  | "remote-client-transport"
  | "remote-client-receipt-verifier"
  | "remote-server-endpoint"
  | "remote-server-handler"
  | "remote-server-delivery";

type RuntimeExecutionEnvironment = Exclude<ExecutionEnvironment, "build">;

type RegistryRoleLocation =
  | { readonly registryKind: "codec"; readonly environment: "browser"; readonly role: "codec-capture" }
  | { readonly registryKind: "codec"; readonly environment: "browser"; readonly role: "codec-materialize" }
  | { readonly registryKind: "codec"; readonly environment: "server-request"; readonly role: "codec-capture" }
  | { readonly registryKind: "codec"; readonly environment: "server-request"; readonly role: "codec-materialize" }
  | { readonly registryKind: "resolver"; readonly environment: "browser"; readonly role: "resolver-resolve" }
  | { readonly registryKind: "resolver"; readonly environment: "server-request"; readonly role: "resolver-resolve" }
  | { readonly registryKind: "subscription-source"; readonly environment: "browser"; readonly role: "subscription-open" }
  | { readonly registryKind: "subscription-source"; readonly environment: "browser"; readonly role: "subscription-resume" }
  | { readonly registryKind: "subscription-source"; readonly environment: "browser"; readonly role: "subscription-resync" }
  | { readonly registryKind: "subscription-source"; readonly environment: "server-request"; readonly role: "subscription-open" }
  | { readonly registryKind: "policy"; readonly environment: "browser"; readonly role: "policy-evaluate" }
  | { readonly registryKind: "policy"; readonly environment: "server-request"; readonly role: "policy-evaluate" }
  | { readonly registryKind: "value-domain"; readonly environment: "browser"; readonly role: "value-domain-validate" }
  | { readonly registryKind: "value-domain"; readonly environment: "server-request"; readonly role: "value-domain-validate" }
  | { readonly registryKind: "failure-schema"; readonly environment: "browser"; readonly role: "failure-schema-adapt" }
  | { readonly registryKind: "failure-schema"; readonly environment: "server-request"; readonly role: "failure-schema-adapt" }
  | { readonly registryKind: "host-profile"; readonly environment: "browser"; readonly role: "host-profile-validate" }
  | { readonly registryKind: "host-profile"; readonly environment: "server-request"; readonly role: "host-profile-validate" }
  | { readonly registryKind: "brand"; readonly environment: "browser"; readonly role: "brand-validate" }
  | { readonly registryKind: "brand"; readonly environment: "server-request"; readonly role: "brand-validate" }
  | { readonly registryKind: "remote-operation"; readonly environment: "browser"; readonly role: "remote-client-transport" }
  | { readonly registryKind: "remote-operation"; readonly environment: "browser"; readonly role: "remote-client-receipt-verifier" }
  | { readonly registryKind: "remote-operation"; readonly environment: "server-request"; readonly role: "remote-server-endpoint" }
  | { readonly registryKind: "remote-operation"; readonly environment: "server-request"; readonly role: "remote-server-handler" }
  | {
      readonly registryKind: "remote-delivery-adapter";
      readonly environment: "server-request";
      readonly role: "remote-server-delivery";
    };

type RegistryRoleLocationFor<Kind extends RegistryKind> = Extract<
  RegistryRoleLocation,
  { readonly registryKind: Kind }
>;

type RegistryRoleInterfaceSchemaId<Role extends RegistryImplementationRole> =
  `dathra.registry-role/${Role}/1`;

type RegistryRoleRequirementForLocation<Location extends RegistryRoleLocation> =
  Location & {
    readonly requirement: "required" | "request-reachable";
    readonly reasonDefinitionIds: readonly string[];
  };

type RegistryRoleRequirement<Kind extends RegistryKind = RegistryKind> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryRoleRequirementForLocation<Location>
      : never
    : never;

type RegistryImplementationBindingForLocation<
  Location extends RegistryRoleLocation,
> = Location & {
  readonly artifactAddressId: string;
  readonly exportName: string;
  readonly interfaceSchemaId: RegistryRoleInterfaceSchemaId<Location["role"]>;
};

type RegistryImplementationBinding<Kind extends RegistryKind = RegistryKind> =
  RegistryRoleLocationFor<Kind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryImplementationBindingForLocation<Location>
      : never
    : never;

type RegistryGenericDependencyTargetLocation = Exclude<
  RegistryRoleLocation,
  | { readonly registryKind: "remote-operation" }
  | { readonly registryKind: "remote-delivery-adapter" }
>;

type RegistryDependencyTargetForLocation<
  Location extends RegistryGenericDependencyTargetLocation,
> = {
  readonly targetQualifiedId: QualifiedRegistryId<Location["registryKind"]>;
  readonly targetEnvironment: Location["environment"];
  readonly targetRole: Location["role"];
};

type RegistryDependencyTargetForEnvironment<
  Environment extends RuntimeExecutionEnvironment,
> = RegistryGenericDependencyTargetLocation extends infer Location
  ? Location extends RegistryGenericDependencyTargetLocation
    ? Location["environment"] extends Environment
      ? RegistryDependencyTargetForLocation<Location>
      : never
    : never
  : never;

type RegistryDependencyBindingForLocation<Location extends RegistryRoleLocation> = {
  readonly kind: "same-environment-import";
  readonly sourceEnvironment: Location["environment"];
  readonly sourceRole: Location["role"];
} & RegistryDependencyTargetForEnvironment<Location["environment"]>;

type RegistryGenericDependencyBinding<SourceKind extends RegistryKind> =
  RegistryRoleLocationFor<SourceKind> extends infer Location
    ? Location extends RegistryRoleLocation
      ? RegistryDependencyBindingForLocation<Location>
      : never
    : never;

interface RemoteDeliveryDependencyBinding {
  readonly kind: "same-environment-import";
  readonly sourceEnvironment: "server-request";
  readonly sourceRole: "remote-server-endpoint";
  readonly targetQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly targetEnvironment: "server-request";
  readonly targetRole: "remote-server-delivery";
}

type RegistryDependencyBinding<SourceKind extends RegistryKind = RegistryKind> =
  | RegistryGenericDependencyBinding<SourceKind>
  | (SourceKind extends "remote-operation" ? RemoteDeliveryDependencyBinding : never);

interface RemoteEndpointIdentityPreimage {
  readonly schema: "dathra.remote-endpoint-identity/1";
  readonly serverDeploymentIdentityDigest: Sha256Digest;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
}

interface RemoteRegistryProtocolBinding {
  readonly schema: "dathra.registry-protocol/1";
  readonly kind: "remote-request-response";
  readonly id: Sha256Digest;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly clientEnvironment: "browser";
  readonly clientTransportRole: "remote-client-transport";
  readonly clientVerifierRole: "remote-client-receipt-verifier";
  readonly clientDeploymentIdentityDigest: Sha256Digest;
  readonly serverEnvironment: "server-request";
  readonly serverEndpointRole: "remote-server-endpoint";
  readonly serverHandlerRole: "remote-server-handler";
  readonly serverDeploymentIdentityDigest: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly deliveryAdapterQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly deliveryEnvironment: "server-request";
  readonly deliveryRole: "remote-server-delivery";
  readonly deliveryDeploymentIdentityDigest: Sha256Digest;
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
  readonly requestSchemaDigest: Sha256Digest;
  readonly responseSchemaDigest: Sha256Digest;
  readonly protocolCodecMetadataDigest: Sha256Digest;
  readonly authorizationEvidenceVerifierMetadataDigest: Sha256Digest;
  readonly receiptVerifierMetadataDigest: Sha256Digest;
  readonly protocolBudgetDigest: Sha256Digest;
}

type RegistryProtocolBinding = RemoteRegistryProtocolBinding;

type RegistryProtocolBindingFor<Kind extends RegistryKind> = Kind extends "remote-operation"
  ? RemoteRegistryProtocolBinding
  : never;

interface RemoteRegistryProtocolTemplate {
  readonly schema: "dathra.registry-protocol-template/1";
  readonly kind: "remote-request-response";
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly clientEnvironment: "browser";
  readonly clientTransportRole: "remote-client-transport";
  readonly clientVerifierRole: "remote-client-receipt-verifier";
  readonly serverEnvironment: "server-request";
  readonly serverEndpointRole: "remote-server-endpoint";
  readonly serverHandlerRole: "remote-server-handler";
  readonly deliveryAdapterQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly deliveryEnvironment: "server-request";
  readonly deliveryRole: "remote-server-delivery";
  readonly transportProfileQualifiedId: QualifiedRegistryId<"host-profile">;
  readonly requestSchemaDigest: Sha256Digest;
  readonly responseSchemaDigest: Sha256Digest;
  readonly protocolCodecMetadataDigest: Sha256Digest;
  readonly authorizationEvidenceVerifierMetadataDigest: Sha256Digest;
  readonly receiptVerifierMetadataDigest: Sha256Digest;
  readonly protocolBudgetDigest: Sha256Digest;
}

type RegistrySymbolicImplementationBindingForLocation<
  Location extends RegistryRoleLocation,
> = Location & {
  readonly implementation: ModuleExportLocator;
  readonly interfaceSchemaId: RegistryRoleInterfaceSchemaId<Location["role"]>;
};

type RegistrySymbolicImplementationBinding<
  Kind extends RegistryKind = RegistryKind,
> = RegistryRoleLocationFor<Kind> extends infer Location
  ? Location extends RegistryRoleLocation
    ? RegistrySymbolicImplementationBindingForLocation<Location>
    : never
  : never;

type QualifiedRegistryUniverseEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<RegistryDescriptor<true>, { readonly kind: Kind }>;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings:
      readonly RegistrySymbolicImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolTemplates: Kind extends "remote-operation"
      ? readonly RemoteRegistryProtocolTemplate[]
      : readonly [];
  };
}[RegistryKind];

interface QualifiedRegistryUniverseRecord {
  readonly schema: "dathra.qualified-registry-universe/1";
  readonly registries: readonly QualifiedRegistryUniverseEntry[];
  readonly digest: Sha256Digest;
}

type FinalizedRegistryCatalogEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<RegistryDescriptor<true>, { readonly kind: Kind }>;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings: readonly RegistryImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolBindings: readonly RegistryProtocolBindingFor<Kind>[];
  };
}[RegistryKind];

interface FinalizedRegistryCatalogRecord {
  readonly schema: "dathra.finalized-registry-catalog/1";
  readonly symbolicUniverseDigest: Sha256Digest;
  readonly registries: readonly FinalizedRegistryCatalogEntry[];
  readonly digest: Sha256Digest;
}

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

## server render と delivery

### render body の実行回数

server root は obligation であり、body の invocation count ではない。
初期 UI は server materialization を要求するが、body は static witness または cache witness によってゼロ回になり得る。
speculative attempt によって複数回実行される場合もある。

generation-scoped contribution から外部へ影響できるのは、選択されて commit された RenderEnvelope だけである。
Early Hints などの operation-scoped publication は、事前に claim した authority と compatible envelope set を持つ場合だけ、最終 envelope の選択前に発生できる。

static または cache witness が代替できるのは、initial render-materialization obligation に限る。
witness は、source、artifact、module dependency、classified read と consistency cut、variation key、principal、exposure realm、version、freshness、invalidation、status、response contribution、ordered body、handoff、DSD を束縛する。

cache hit では、generation、sequence、epoch、publication authority を現在の operation へ付け替える。
per-request resource、handler、action、transaction、cleanup、non-cache-replayable contribution は witness で省略できない。
witness は effect receipt を持たず、effect を replay しない。

### RenderOperation

RenderOperation は、次の owner である。

- request context
- deadline と cancel
- render generation
- child operation
- spawn lease と resource lease
- response contribution
- stream epoch
- cleanup owner

async continuation と async iterator は spawn lease を持つ。
deadline または cancel は、新しい spawn と publication の authority を revoke する。
late callback は diagnostic と owner-safe な resource settlement だけを行える。

operation の primary terminal は、`completed`、`failed`、`cancelled`、`timedOut`、`writerOutcomeUnknown` である。
generation の terminal は、`published`、`publicationUnknown`、`superseded`、`failed`、`cancelled` である。
primary terminal は後から書き換えない。

RenderEnvelope と operation publication は次の identity を持つ。

```ts
interface RenderEnvelope {
  readonly id: string;
  readonly definitionId: string;
  readonly generationId: string;
  readonly observationContractDigest: Sha256Digest;
  readonly responseContributionDigest: Sha256Digest;
  readonly orderedBodyPlanDigest: Sha256Digest;
  readonly exposureDigest: Sha256Digest;
}

interface PublicationClaim {
  readonly id: string;
  readonly kind: "early-hints";
  readonly authorityScopeId: string;
  readonly canonicalHeaders: readonly (readonly [string, string])[];
  readonly compatibleEnvelopeDefinitionIds: readonly string[];
  readonly pinnedEnvelopeId: string | null;
  readonly exposureDigest: Sha256Digest;
  readonly retryMode: "retain-compatible-set" | "pin-single-envelope";
}

interface PublicationLedgerEntry {
  readonly claimId: string;
  readonly sequence: number;
  readonly acceptance: "prepared" | "rejected" | "writer-accepted";
  readonly transport: "not-started" | "flushed" | "failed" | "unknown";
}
```

RenderEnvelope definition ID は、全 response contribution、ordered body plan、exposure を content-addressed に束縛する。
RenderEnvelope ID は definition ID と generation ID を束縛する。
PublicationClaim の header は host profile の parser で正規化し、header name、field value、target URL、fetch mode、credentials、referrer policy を canonical form にする。
compatibleEnvelopeDefinitionIds は重複のない ID 昇順とし、claim 作成時の live candidate definition set の subset でなければならない。
`retain-compatible-set` では pinnedEnvelopeId を null とし、`pin-single-envelope` では一つの live envelope ID を記録する。

baseline の 103 Early Hints は、host profile が許可した `Link` の `preload`、`modulepreload`、`preconnect` relation だけを送れる。
`Set-Cookie`、principal-dependent secret、選択候補によって audience が変わる target は許可しない。

lease authority の `released`、`revoked`、`expired` と、underlying resource の `settled`、`abandoned` を分ける。
cleanup abandonment は secondary status であり、失敗した request を success に変えない。

parent completion は、spawn gate が閉じ、owned child と resource が contract terminal に達するまで待つ。

### non-replay read

body は classified read handle を dereference できるが、non-replay read を直接取得しない。
取得は operation-owned input または resource root が一回に coalesce する。

non-replay result は、次の sharing policy を持つ。

- **operationShareable**：immutable result を全 generation が再取得せず共有できる。
- **generationBound**：最初の consumption が generation を選択し、irreversible latch を設定して競合 generation と retry を禁止する。

未分類の ambient read は render-unsafe とする。

### retry と cancellation

generation は、phase、retryAllowed、irreversibleLatch を持つ。
retry は、旧 generation を immutable な `superseded` または `failed` にし、retired-generation cleanup owner へ cleanup を移した後でだけ開始する。

cancellation、deadline、lease acquisition、generation selection、sequence terminal、writer acceptance は、一つの operation-epoch linearization protocol を使う。
publication validation と writer acceptance は一つの action とする。

cancel が先なら writer acceptance を拒否する。
acceptance が先なら reservation は committed のまま残り、cancel は後続 publication と transport にだけ影響する。

### response phase

response phase は次の順序で進む。

```txt
header-open
  -> header-preparing
  -> final-header-committed
  -> body-open

header-preparing -> header-open(new header epoch) | failed
```

`header-preparing` への遷移は、現在の header epoch に対する新しい contribution authority の取得を閉じるが、外部 publication と retry latch をまだ発生させない。
precommit failure では preparation を破棄し、外部 writer acceptance がない場合だけ新しい header epoch を `header-open` から開始できる。

**FinalHeaderCommit** は、RenderEnvelope の選択、operation-scoped contribution と選択 generation contribution の merge、conflict validation、canonical header seal、writer acceptance、`final-header-committed` への遷移、generation pin、retry latch を一つの non-suspending linearization action で行う。
writer が acceptance を返さない場合は action を commit せず、部分的に seal された header state を残さない。
host writer adapter は non-reentrant な atomic acceptance を提供し、外部で受理した後に refusal を返してはならない。
この truthful atomic acceptance capability は speculative generation、streaming response、103 Early Hints の必須条件である。

atomic acceptance を提供できない host profile は、103、streaming、write invocation 後の retry を禁止する。
一つの RenderEnvelope を外部 write 前に pin し、status、header、body をすべて buffer した後で、一つの **BufferedFinalWrite** を行う。
host profile は bounded response buffer contract を持ち、上限を超える可能性がある route は build diagnostic または外部 write 前の typed failure にする。
write invocation の直前に irreversible latch を設定し、adapter が外部受理の有無を証明できなければ operation を `writerOutcomeUnknown`、generation を `publicationUnknown` にする。
unknown outcome は外部 publication 済みとして exposure と cleanup を処理し、別 generation または別 write へ retry しない。
FinalHeaderCommit 後は、transport flush の成否にかかわらず別 generation へ retry しない。
superseded generation の contribution は FinalHeaderCommit 前に破棄する。

header lease は body sequence と backpressure に依存できない。
continuation は header authority だけを先に release できる。

final header transport flush は FinalHeaderCommit 後に行い、既に設定済みの irreversible latch を変更しない。
body enqueue は final-header-committed 後にだけ行う。

Early Hints の writer acceptance 前に、coordinator は claim の authority、exposure、canonical header、compatibleEnvelopeDefinitionIds、pinnedEnvelopeId を検証する。
Early Hints は truthful atomic acceptance capability がある host profile だけで有効にする。
compatible set は、各 hint が ObservationContract 上合法で、その external fetch effect を含めてもよい生存 RenderEnvelope だけから成る。

claim が全生存 envelope と互換なら候補集合を維持できる。
一部だけと互換なら、writer acceptance と同じ linearization point で生存集合を compatible set へ絞り、集合外の generation を superseded にする。
`pin-single-envelope` は、この集合の live envelope が一つであり、pinnedEnvelopeId がその ID と一致する場合だけ使える。
compatible set が空なら hint を送らない。

複数の 103 response は PublicationLedger の sequence 順に扱う。
後続 claim は、それ以前の全 writer-accepted claim と互換な envelope の共通部分をさらに狭める。
retry は `retain-compatible-set` の definition 内に限り、既に accepted された全 hint effect を新 generation の ObservationContract に引き継げる場合だけ許す。
`pin-single-envelope` acceptance 後は render retry を許さない。

cancel、FinalHeaderCommit、103 writer acceptance は operation-epoch の同じ linearization protocol で競合させる。
cancel または FinalHeaderCommit が先なら新しい 103 を拒否する。
103 acceptance が先なら publication は irreversible であり、後の cancel は取り消せない。
transport outcome が不明な accepted entry は、retry と exposure の判定では送信済みとして扱う。

### stream

sequence reservation ledger と transport outcome を分ける。
reservation は `committed`、`skipped`、`incomplete` のいずれかで一度だけ terminal になる。
committed reservation は、後で transport が abort しても incomplete に戻さない。

server は次の watermark を別々に記録する。

- writerAccepted
- transportQueued
- transportFlushed

いずれも clientReceived を意味しない。
client だけが、受信 byte と観測した stream terminal から received prefix を判断する。

transport は committed または skipped の連続した sequence だけを進める。
skipped は byte を出さない。
最初の incomplete reservation が abort watermark を固定し、それより後の entry を同じ epoch で expose しない。

prefix safety は reservation 単位ではなく、encoded response の任意 byte cut で判定する。
宣言した decoder と HTML parser がその位置を EOF として処理しても、tokenizer と escaping の trust boundary を壊さず、承認済み commitment と事前に claim した realization effect だけを公開しなければならない。

group atomicity が必要な payload は、completeness と integrity gate の後ろで inert に保つ。
native active HTML は group atomicity を主張しない。

### external platform effect

parser insertion、module evaluation、`customElements.define()`、platform mutation が external code を同期実行し得る場合は、その前に footprint と global root と latch を claim する。
claim できなければ、definition または upgrade 前の stub を置くか、対象 region を reconciliation と rollback の対象外である unmanaged irreversible boundary とする。

事後 diagnostic は安全策にならない。
adapter は invocation 前に spawn lease と resource lease を確保し、return された Promise または resource を synchronous registration gate の解放前に owner へ束縛する。

## ClientScopeGraph

### definition と instance

ClientScopeGraph は、少なくとも次の definition を持つ。

- LifetimeRegionDefinition
- SharedStateDefinition
- ClientRootDefinition
- ActivationGroupDefinition
- ClientArtifact
- DOMTarget
- EventRecorderDefinition
- ShellRegistrationArtifact
- DOMTemplateArtifact
- InsertionSlotDefinition
- ExternalDomRegionDefinition
- SubscriptionSessionDefinition
- AllocationTransactionDefinition
- CommitTransactionDefinition

placement、activation policy、ownership edge、coordinator affinity、dispose rule は definition に属する。
payload は definition を変更せず、検証済み binding と instance key だけを供給する。

SSR payload、compiler 生成 mutation、検証済み fragment、client navigation は、既存 definition の instance だけを作れる。
任意 code と placement を持つ hydration plan を runtime へ渡さない。

### prerequisite edge

prerequisite edge の source は ActivationGroupDefinition、SharedStateDefinition、EventRecorderDefinition のいずれかである。
target は SharedStateDefinition、SubscriptionSessionDefinition、ClientArtifact、ShellRegistrationArtifact、EventRecorderDefinition、または ActivationGroupDefinition である。
optional capability と optional adapter は planning 時に選択または除外する。
runtime instance graph に残る prerequisite edge はすべて required とする。

definition graph と resolved instance graph を同じ型で表さない。
definition は key expression と generation selector を持ち、instance 化時に曖昧さのない identity へ解決する。

```ts
type GenerationSelector =
  | "same-owner-generation"
  | "environment-generation"
  | "explicit-shared-generation";

type PrerequisiteSourceKind = "activation-group" | "shared-state" | "event-recorder";

type SourceGenerationDomain = "owner" | "environment" | "shared";

type RetentionContract = "owned" | "leased" | "borrowed" | "environment-permanent";

interface PrerequisiteEdgeBase {
  readonly id: string;
  readonly sourceDefinitionId: string;
  readonly sourceKeySchemaId: string;
  readonly sourceGenerationDomain: SourceGenerationDomain;
  readonly targetDefinitionId: string;
  readonly targetKeyExpressionId: string;
  readonly generation: GenerationSelector;
  readonly required: true;
}

type PrerequisiteEdgeDefinition = PrerequisiteEdgeBase &
  (
    | {
        readonly sourceKind: "shared-state";
        readonly targetKind: "shared-state";
        readonly kind: "allocation";
        readonly readiness: "allocated";
        readonly retention: "owned" | "leased";
        readonly allocationTransactionDefinitionId: string | null;
      }
    | {
        readonly sourceKind: "activation-group" | "event-recorder";
        readonly targetKind: "shared-state";
        readonly kind: "allocation";
        readonly readiness: "allocated";
        readonly retention: "owned" | "leased";
        readonly allocationTransactionDefinitionId: null;
      }
    | {
        readonly sourceKind: PrerequisiteSourceKind;
        readonly targetKind: "subscription-session";
        readonly kind: "allocation";
        readonly readiness: "opened";
        readonly retention: "owned" | "leased";
        readonly allocationTransactionDefinitionId: null;
      }
    | {
        readonly sourceKind: PrerequisiteSourceKind;
        readonly targetKind: "client-artifact";
        readonly kind: "allocation";
        readonly readiness: "loaded";
        readonly retention: "borrowed" | "environment-permanent";
        readonly allocationTransactionDefinitionId: null;
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "shell-registration";
        readonly kind: "commit";
        readonly readiness: "registered";
        readonly retention: "environment-permanent";
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "event-recorder";
        readonly kind: "commit";
        readonly readiness: "recorder-ready";
        readonly retention: "owned" | "leased";
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "activation-group";
        readonly kind: "commit";
        readonly readiness: "recorder-ready";
        readonly retention: "borrowed";
        readonly commitTransactionDefinitionId: string;
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "activation-group";
        readonly kind: "effect";
        readonly readiness: "active";
        readonly retention: "borrowed";
      }
  );

interface CanonicalInstanceKey {
  readonly schema: "dathra.instance-key/1";
  readonly keySchemaId: string;
  readonly digest: Sha256Digest;
  readonly value: CodecWireValue;
}

interface GenerationCreationOperationPreimage {
  readonly schema: "dathra.generation-creation-operation/1";
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly definitionId: string;
  readonly instanceKeyDigest: Sha256Digest;
  readonly requesterGenerationId: string | null;
  readonly triggerKind:
    | "root-materialization"
    | "activation"
    | "shared-state-restart"
    | "slot-instantiation"
    | "subscription-resync";
  readonly triggerIdentityId: string;
  readonly attemptSequence: number;
}

interface GenerationIncarnationPreimage {
  readonly schema: "dathra.generation-incarnation/1";
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly definitionId: string;
  readonly instanceId: string;
  readonly sequence: number;
  readonly previousGenerationId: string | null;
  readonly creationOperation: GenerationCreationOperationPreimage;
}

interface GenerationIdentityBase {
  readonly schema: "dathra.generation-identity/1";
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly definitionId: string;
  readonly instanceId: string;
  readonly instanceKey: CanonicalInstanceKey;
  readonly incarnation: GenerationIncarnationPreimage;
}

type GenerationIdentityPreimage =
  | (GenerationIdentityBase & {
      readonly selector: "same-owner-generation";
      readonly ownerDefinitionId: string;
      readonly ownerInstanceId: string;
      readonly ownerGenerationId: string;
    })
  | (GenerationIdentityBase & {
      readonly selector: "environment-generation";
      readonly realmIdentityDigest: Sha256Digest;
      readonly documentGenerationId: string;
      readonly environmentGenerationId: string;
    })
  | (GenerationIdentityBase & {
      readonly selector: "explicit-shared-generation";
      readonly sharedGenerationContractId: string;
      readonly sharedGenerationKey: CanonicalInstanceKey;
      readonly authorityGenerationId: string;
    });

interface ResolvedPrerequisiteEdgeBase {
  readonly edgeDefinitionId: string;
  readonly sourceKind: PrerequisiteSourceKind;
  readonly sourceDefinitionId: string;
  readonly sourceInstanceKey: CanonicalInstanceKey;
  readonly sourceInstanceId: string;
  readonly sourceGenerationIdentity: GenerationIdentityPreimage;
  readonly sourceGenerationId: string;
  readonly targetDefinitionId: string;
  readonly targetInstanceKey: CanonicalInstanceKey;
  readonly targetInstanceId: string;
  readonly targetGenerationIdentity: GenerationIdentityPreimage;
  readonly targetGenerationId: string;
  readonly required: true;
}

type ResolvedPrerequisiteEdge = ResolvedPrerequisiteEdgeBase &
  (
    | {
        readonly sourceKind: "shared-state";
        readonly targetKind: "shared-state";
        readonly kind: "allocation";
        readonly readiness: "allocated";
        readonly retention: "owned" | "leased";
        readonly allocationTransactionInstanceId: string | null;
      }
    | {
        readonly sourceKind: "activation-group" | "event-recorder";
        readonly targetKind: "shared-state";
        readonly kind: "allocation";
        readonly readiness: "allocated";
        readonly retention: "owned" | "leased";
        readonly allocationTransactionInstanceId: null;
      }
    | {
        readonly sourceKind: PrerequisiteSourceKind;
        readonly targetKind: "subscription-session";
        readonly kind: "allocation";
        readonly readiness: "opened";
        readonly retention: "owned" | "leased";
        readonly allocationTransactionInstanceId: null;
      }
    | {
        readonly sourceKind: PrerequisiteSourceKind;
        readonly targetKind: "client-artifact";
        readonly kind: "allocation";
        readonly readiness: "loaded";
        readonly retention: "borrowed" | "environment-permanent";
        readonly allocationTransactionInstanceId: null;
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "shell-registration";
        readonly kind: "commit";
        readonly readiness: "registered";
        readonly retention: "environment-permanent";
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "event-recorder";
        readonly kind: "commit";
        readonly readiness: "recorder-ready";
        readonly retention: "owned" | "leased";
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "activation-group";
        readonly kind: "commit";
        readonly readiness: "recorder-ready";
        readonly retention: "borrowed";
        readonly commitTransactionInstanceId: string;
      }
    | {
        readonly sourceKind: "activation-group";
        readonly targetKind: "activation-group";
        readonly kind: "effect";
        readonly readiness: "active";
        readonly retention: "borrowed";
      }
  );

interface AllocationTransactionMemberIdentity {
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly definitionId: string;
  readonly instanceKey: CanonicalInstanceKey;
  readonly instanceId: string;
  readonly ownerDefinitionId: string | null;
  readonly ownerInstanceId: string | null;
  readonly ownerGenerationId: string | null;
  readonly generationIdentity: GenerationIdentityPreimage;
  readonly generationId: string;
}

interface AllocationTransactionInstanceIdentityPreimage {
  readonly schema: "dathra.allocation-transaction-instance/1";
  readonly transactionDefinitionId: string;
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly members: readonly AllocationTransactionMemberIdentity[];
}

interface AllocationTransactionInstanceIdentity {
  readonly preimage: AllocationTransactionInstanceIdentityPreimage;
  readonly transactionInstanceId: string;
}

interface CommitTransactionMemberIdentity {
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly definitionId: string;
  readonly instanceKey: CanonicalInstanceKey;
  readonly instanceId: string;
  readonly ownerDefinitionId: string | null;
  readonly ownerInstanceId: string | null;
  readonly ownerGenerationId: string | null;
  readonly generationIdentity: GenerationIdentityPreimage;
  readonly generationId: string;
}

interface CommitTransactionInstanceIdentityPreimage {
  readonly schema: "dathra.commit-transaction-instance/1";
  readonly transactionDefinitionId: string;
  readonly coordinatorId: string;
  readonly instanceDomainId: string;
  readonly members: readonly CommitTransactionMemberIdentity[];
}

interface CommitTransactionInstanceIdentity {
  readonly preimage: CommitTransactionInstanceIdentityPreimage;
  readonly transactionInstanceId: string;
}

interface GenerationScopedOperationIdentityPreimage {
  readonly schema: "dathra.generation-operation/1";
  readonly operationKind:
    | "allocation"
    | "activation"
    | "update"
    | "cleanup"
    | "slot-mutation";
  readonly operationId: string;
  readonly generationId: string;
  readonly attemptSequence: number;
}

interface AllocationTransactionDefinitionRecord {
  readonly id: string;
  readonly memberDefinitionIds: readonly string[];
  readonly memberKeySchemaIds: Readonly<Record<string, string>>;
  readonly allocationEdgeIds: readonly string[];
  readonly coordinatorAffinityId: string;
}

interface CommitTransactionDefinitionRecord {
  readonly id: string;
  readonly memberActivationGroupDefinitionIds: readonly string[];
  readonly commitEdgeIds: readonly string[];
  readonly coordinatorAffinityId: string;
}
```

`targetKeyExpressionId` は compiler が認証した pure expression を指す。
`sourceKeySchemaId` と `sourceGenerationDomain` は、source definition の instance identity contract と一致しなければならない。
allocationTransactionDefinitionId と allocationTransactionInstanceId を non-null にできるのは、sourceKind と targetKind がともに `shared-state` である edge だけである。
それ以外の allocation edge は transaction field を null に固定する。
instance 化時は、root binding または AllocationTransactionInstance が source key と実 generation を先に確定する。
その source instance と検証済み payload を入力に target の canonical key を一回評価し、definition、key、generation domain から target instance ID と実 generation ID を確定する。
CanonicalInstanceKey の value は key schema が出力した CodecWireValue であり、digest は schema ID と canonical JCS value の digest とする。
registry は digest だけで equality を決めず、canonical value も比較して collision を拒否する。
generation ID は選択された GenerationIdentityPreimage 全体の digest とし、selector ごとに必要な owner、environment、shared authority field を省略できない。
GenerationIncarnationPreimage.sequence は同じ coordinator、instance domain、definition、instance の registry slot で coordinator が線形化して発行する非負 safe integer である。
初回を 0 とし、restart、同じ key の再作成、tombstone 後の再利用では previousGenerationId を現在値へ設定して一つ増やす。
sequence reservation と generation registry publication は同じ CAS に含め、失敗した attempt の sequence を別 generation に再利用しない。
creation operation ID は canonical GenerationCreationOperationPreimage の digest とする。
この preimage は requester の既存 generation と外部 trigger identity を参照できるが、作成対象の generation ID、GenerationScopedOperationIdentityPreimage、target generation callback を参照できない。
GenerationIncarnationPreimage は full creation preimage を含むため、実装が循環する文字列 ID を代入して identity cycle を隠すこともできない。
ResolvedPrerequisiteEdge の generation ID は対応 preimage の digest と一致し、同じ文字列 ID だけを根拠に別 coordinator、instance domain、definition、instance を alias しない。
transaction member は generation preimage 全体を含むため incarnation を継承する。
generation-scoped operation、callback guard、waiter、cleanup token、fence は GenerationScopedOperationIdentityPreimage または generation ID を必ず含み、旧 incarnation の continuation を新 incarnation へ通さない。
解決不能、複数候補、selector と実 generation の不一致は activation 前に失敗させ、別 instance へ fallback しない。

SharedStateDefinition は、対象 generation の handle と初期 state が allocate、populate、validate された時点で ready になる。
SubscriptionSessionDefinition は、snapshot revision と log-boundary cursor を一つの consistency point で open し、session、grant claim、cleanup entry を owner ledger に登録した時点で ready になる。
ClientArtifact は、load、integrity、必要な evaluation-safety validation が完了した時点で ready になる。
ShellRegistrationArtifact は、対象 registry への registration と必要な parse fence が完了した時点で ready になる。
EventRecorderDefinition は、admission frontier より前に stable native entry が設置された時点で recorder-ready になる。
ActivationGroupDefinition は、同じ CommitTransactionInstance の recorder-ready、または別 transaction の active state に達した時点で ready になる。

policy を最初に満たした root が到達する allocation source graph が、shared state の allocation lease を取得する。
同じ resolved key と generation の dependent source node は一つの allocation を共有し、別々に初期化しない。

allocation edge graph は ActivationGroupInstance、SharedStateInstance、EventRecorderInstance を source node とし、SharedStateInstance、SubscriptionSessionInstance、ClientArtifactInstance を target node とする。
allocation cycle は、全 provisional instance shell を effect なしで先に確保でき、populate と validate が未確定 peer の committed state を要求しない場合だけ、AllocationTransactionDefinition へ collapse する。
transaction definition は member definition、member key schema、allocation edge ID、coordinator affinity を持ち、member edge の allocationTransactionDefinitionId と一致しなければならない。
transaction member は coordinator、instance domain、definition、instance ID、canonical key、owner identity、generation preimage を含む tuple の canonical byte 順に並べる。
transactionInstanceId は canonical AllocationTransactionInstanceIdentityPreimage の digest とし、digest と preimage の双方を registry で比較する。
全 member shell、edge、lease intent を一つの provisional registry generation で allocate、populate、validate し、一つの version pointer swap で同時 publish する。
commit 前に member handle を transaction 外へ escape させず、一 member の failure では全 member を publish せず同じ cleanup ledger へ渡す。
それ以外の allocation cycle は compile diagnostic とする。

commit edge の strongly connected component は、compiler が一つの CommitTransactionDefinition へ collapse する。
member を同じ coordinator の non-suspending job で co-stage、co-validate、atomic publish できない場合は compile diagnostic とする。
CommitTransactionInstance ID は canonical CommitTransactionInstanceIdentityPreimage の digest とする。
commit member も coordinator、instance domain、definition、instance、canonical key、owner identity、generation preimage を含み、failure closure の co-commit group identity に使う。

active readiness を gate する effect edge graph は acyclic でなければならない。
相互に active 後の値を観測するだけの関係は prerequisite にせず、activation を gate しない subscription または event edge として表す。

`owned` target は source が唯一の owner となり、source より先に dispose する。
同じ target instance に複数の live `owned` edge が解決された場合は commit 前に失敗させる。
`leased` target は lease ごとに release し、最後の lease が target disposal を起動する。
`borrowed` target は別 owner が source generation より長く生存することを planning と commit で検証し、source disposal では破棄しない。
`environment-permanent` target は Realm または registry lifetime に属し、module evaluation や custom-element registration のような不可逆 state を source disposal の対象にしない。

同じ target instance への全 edge は一つの RetentionClaimSet として commit 前に統合する。
`owned` claim は一つだけ許し、`leased` または別の `owned` と共存できない。
`leased` claim は複数と `borrowed` を許すが、`owned` と共存できない。
`environment-permanent` は `borrowed` だけと共存できる。
`borrowed` だけの claim set は、別の owner、live lease、environment-permanent owner のいずれかが target lifetime を保証しなければ失敗させる。

required prerequisite の target failure は source node と transitive dependent を failed status にし、まだ発生していない effect を起動しない。
source node の cancel は自身の owned target と lease だけを release し、borrowed、environment-permanent、ほかの live lease がある target を cancel しない。
dispose は effect と dependent node を先に止め、transaction collapse 後の resolved prerequisite condensation DAG の reverse order で owned target と lease を cleanup する。

### lifetime と coordinator

coordinator は、Dathra が access できる participating Document と ShadowRoot ごとに lazy に作る。
client instance は、すべての DOMTarget coordinator を記録する。

Dathra が行う remove は、platform mutation 前に `detached-pending` へ遷移する。
外部 detach は、shell callback、MutationObserver delivery、guarded framework entry のうち最初に観測できた時点で有効になる。

commit、effect start、framework DOM write の前に pending record を drain し、connectivity、ownerDocument、coordinator set、generation を再検証する。
同期 author reentrancy を起こし得る operation は、その前後を guard boundary とする。

実行中 JavaScript を同期停止できるとは仮定しない。
generation capability と AbortSignal を revoke し、instrumented continuation が次の observable operation へ進む前に終了させる。

同じ checkpoint 内の reconnect が incarnation を維持できるのは、完全な record sequence が reconnect を示し、その間に guarded operation がなく、ownerDocument と coordinator set が変わらない場合だけである。
通常の remove と reinsert で state を維持するには明示 lifecycle-preservation contract を要求する。

adoption は旧 document generation を失効させる。
cross-coordinator migration は、全 target を再検証して document-wide scheduler barrier を取る明示 transaction とする。

### marker と failure closure

marker range は、同じ coordinator 内に generation-matched pair が一つだけ存在し、順序が正しく、range が proper nesting かつ non-crossing である場合だけ有効である。

invariant violation に参加する全 instance と、同じ co-commit group の instance を failure seed とする。
required-edge dependent、owned descendant、required DOMTarget を失う instance を fixed point で追加する。

seed generation、lease intent、pending slot operation を revoke してから dispose する。
independent owner は、その required target と edge が影響を受けない場合だけ生存できる。

### shared state

SharedStateInstance は次の state を持つ。

```txt
unallocated
  -> allocating
  -> allocated
  -> disposal-scheduled
  -> disposing
  -> disposed

disposal-scheduled -> allocated
unallocated | allocating | allocated | disposal-scheduled -> disposing
```

SharedStateInstance は lifecycle state と直交する health と cleanup outcome を持つ。

```ts
declare const failureRefBrand: unique symbol;

interface FailureRef {
  readonly [failureRefBrand]: true;
  readonly coordinatorId: string;
  readonly sequence: number;
  readonly claimId: string;
  readonly expiresAt: number;
  read(): RuntimeFailure | null;
  release(): void;
}

interface InternalFailureLink {
  readonly sequence: number;
  readonly ownerClaimId: string;
}

type Health =
  | { readonly state: "healthy" }
  | { readonly state: "failed"; readonly failure: FailureRef };

type InternalHealthState =
  | { readonly state: "healthy" }
  | { readonly state: "failed"; readonly failure: InternalFailureLink };

type CleanupCompletion =
  | { readonly state: "not-started" }
  | { readonly state: "running" }
  | { readonly state: "completed" }
  | { readonly state: "abandoned"; readonly deadline: number };

interface CleanupOutcome {
  readonly completion: CleanupCompletion;
  readonly failures: readonly FailureRef[];
}

interface InternalCleanupOutcome {
  readonly completion: CleanupCompletion;
  readonly failures: readonly InternalFailureLink[];
}

interface FailurePinBudget {
  readonly maxOwnerClaims: number;
  readonly maxPublicClaims: number;
  readonly maxPinnedBytes: number;
  readonly maxPublicFailureBytes: number;
  readonly maxClaimAgeMs: number;
  readonly maxFailureLinksPerOwner: number;
  readonly maxHandleLeases: number;
}

interface LateLedgerBudget {
  readonly maxOpenLedgers: number;
  readonly maxRetainedTasks: number;
  readonly maxRetainedBytes: number;
  readonly maxAgeMs: number;
}

declare const generationFencedCleanupTokenBrand: unique symbol;

interface GenerationFencedCleanupToken {
  readonly [generationFencedCleanupTokenBrand]: true;
  readonly adapterQualifiedId: string;
  readonly sinkIdentityDigest: Sha256Digest;
  readonly resourceIdentityDigest: Sha256Digest;
  readonly ownerGenerationId: string;
  readonly fenceSequence: number;
  readonly compareAndMutateProtocolId: string;
}

interface LateCleanupAdmission {
  readonly retainedTaskCount: number;
  readonly retainedByteUpperBound: number;
  readonly hardTerminalWithinMs: number;
  readonly fenceToken: GenerationFencedCleanupToken | null;
}
```

instance の内部 state は InternalHealthState と InternalCleanupOutcome の InternalFailureLink を保持し、FailureRef object を共有または保持しない。
InternalFailureLink の ownerClaimId は bounded public RuntimeFailure tombstone を channel に保持する private owner claim であり、retainedFailureLimit が 0 でも handle lifetime 中の status を再構築できる。
coordinator は instance admission 前に maxFailureLinksPerOwner 分の owner claim slot と byte upper bound を予約する。
同じ owner で上限を超えた secondary failure は個別 link を増やさず、一つの bounded overflow failure に集約する。
public Health と CleanupOutcome を返すたびに、owner claim から sequence ごとの独立した public pin claim を新しく作る。
public status に raw exception object を保持しない。

allocation または runtime failure は health を `failed` にし、generation と waiter を revoke して `disposing` へ進む。
cleanup failure は CleanupOutcome.failures、abandonment は CleanupOutcome.completion に記録し、同時に成立できる。
どちらも primary health failure を上書きしない。
owner lifecycle は cleanup outcome にかかわらず `disposed` まで terminalize する。

各 AllocationAttempt は immutable な attempt epoch、publication CAS、cleanup ledger を持つ。
async acquisition を開始する adapter は、host operation を呼ぶ前に cleanup ledger の open gate から AcquisitionToken を同期取得する。
deadline 後の settlement を許す adapter は、operation 開始前に LateCleanupAdmission を提示し、coordinator は late-ledger count、retained task、retained byte、age の全枠を原子的に予約する。
予約できなければ host operation を開始せず、activation を bounded resource failure にする。
token は `pending` から、resource と cleanup entry を同時登録する `acquired`、resource を得なかった `empty`、LateSettlementLedger へ移す `abandoned` のいずれかへ一回だけ terminalize する。
adapter は取得した resource の cleanup entry を、resource handle が adapter から escape する前、かつ token を `acquired` にする同じ action で ledger へ登録する。
allocation result を公開できるのは、attempt epoch と owner generation が有効なまま `allocating -> allocated` の CAS に勝った場合だけである。

disposal または failure が CAS に先勝ちした場合、late allocation result は waiter、registry、client code へ公開しない。
deadline abandonment 前の late result と partial allocation は同じ cleanup ledger に渡し、登録済み entry だけを reverse acquisition order で drain する。
cleanup request は何度受けても同じ completion を返し、各 cleanup body は ledger entry ごとに at most once だけ開始する。

disposal は acquisition gate を閉じて新しい token を拒否する。
cleanup ledger は AllocationAttempt 自体が settled し、全 token が terminal になり、全登録済み cleanup body が terminal になるまで `completion: completed` を公開しない。

cleanup deadline に達した pending token は environment-owned LateSettlementLedger へ原子的に移し、owner の CleanupOutcome.completion を `abandoned` にできる。
その後に resource が返った場合は owner へ公開せず、late ledger に cleanup entry を登録して直ちに実行する。
late cleanup の結果は abandoned owner の terminal outcome を書き換えず、runtime failure channel に secondary settlement として報告する。
late settlement callback、retained byte upper bound、`maxAgeMs` 以下の host-enforced terminal acknowledgement を提供できない host operation は abandonment を許可せず、owner が settlement を待てない lifetime では利用を diagnostic にする。
max age では adapter が隔離 operation を強制終了し、terminal acknowledgement 後にだけ予約と retained buffer を解放する。
in-realm の任意 Promise や author callback は同期停止できないため、terminable host compartment の証明がない限り LateSettlementLedger へ移せず、通常 cleanup completion を待つ。

SharedStateInstance identity は、definition ID、CanonicalInstanceKey、owner instance と generation、coordinator または environment domain から作る。
異なる canonical key は、author contract が同じ key value へ正規化した場合を除き alias しない。
最初の lease は generation と handle を予約し、同時 lease は同じ allocation を待つ。

allocation failure は partial cleanup を実行し、waiter を失敗させる。
waiter の owner generation が失効した場合は lease intent を解放する。

last release は epoch-checked disposal を schedule する。
`disposing` 前の reacquire は schedule を取り消せる。
`disposing` 中の新 lease は cleanup 完了を待ち、restartable definition だけが新 generation を作れる。

disposer が同じ key と generation を acquire または await してはならない。
disposal dependency は SCC diagnostic に含める。
cleanup task 外からの reentrant disposal は同じ ledger completion を待ち、cleanup body を再実行しない。
cleanup task 内の self-await は lifecycle cleanup 節の規則で拒否する。

### activation state

ActivationGroupInstance は次の state を持つ。

```txt
inactive
  -> loading
  -> recorder-ready
  -> staging
  -> committing
  -> active
  -> disposing
  -> disposed

inactive | loading | recorder-ready | staging | active -> disposing
committing -> active | disposing
```

ActivationGroupInstance も lifecycle state と直交する Health と CleanupOutcome を持つ。
activation failure は health を `failed` にし、generation、recorder、pending effect を revoke して `disposing` へ進む。
cleanup outcome は primary health failure を上書きせず、lifecycle は `disposed` まで進める。
cleanup request は idempotent に同じ completion を返し、各 cleanup body は at most once だけ開始する。
cleanup task 外からの reentrant disposal は同じ completion を待つ。

`committing` と disposal または failure request は coordinator の一つの linearization point で競合させる。
terminal request が先なら staged change を publish せず `disposing` へ進む。
commit が先なら一度 `active` を publish してから `disposing` へ進む。
通常 disposal では failure containment を起動せず、failure request の場合だけ post-active containment rule を適用する。

各 ActivationGroupDefinition は次の post-active failure containment を一つ持つ。

```ts
type PostActiveFailureContainment =
  | { readonly kind: "stop-behavior-preserve-dom" }
  | {
      readonly kind: "dispose-owned-client-region";
      readonly slotDefinitionIds: readonly string[];
    }
  | { readonly kind: "escalate-owner" };
```

どの policy でも、失敗 generation の pending effect、waiter、recorder admission、将来の framework DOM mutation を revoke し、RuntimeFailureChannel へ primary failure を一回報告する。
`stop-behavior-preserve-dom` は、既に commit した DOM を保持して behavior と owned resource だけを dispose する既定値である。
`dispose-owned-client-region` は、指定 InsertionSlotDefinition が生成し、ほかの owner が参照しない client-created node だけを transaction で除去できる。
SSR node、adopted node、user-editable DOM はこの policy でも除去しない。
`escalate-owner` は owning LifetimeRegionInstance を failure seed に加え、通常の fixed-point failure closure を適用する。

containment policy は既に外部へ発生した author effect、platform effect、network effect の rollback を主張しない。
policy と対象 slot は ObservationContract、manifest、commit validation に含める。

preload と module evaluation を分ける。
pre-active に evaluation する module graph は、top-level effect、custom-element registration、platform write、task、microtask、observer schedule、top-level await を持たないことを証明する。

さらに、mutable global、clock、random、DOM、storage、locale、environment read が export、control flow、reachable allocation に影響しないことを、pre-active interval 全体で証明する。
証明できない evaluation は post-active root とする。
active になるためにその export が必要なら diagnostic とする。

final drain、revalidation、commit、active publication は、一つの synchronous かつ non-suspending な JavaScript job とする。
この区間に `await`、dynamic import、event-loop spin、author-reentrant call、microtask checkpoint を入れない。

### activation policy

client root の既定 policy は `activate:eager` である。
author-facing policy は次の通りとする。

- **`activate:eager`**：値を取らず、prerequisite が揃い次第起動する既定 policy である。
- **`activate:visible={options}`**：対象 Element または generated sentinel が `IntersectionObserver` の条件を満たしたときに起動する。
- **`activate:idle={{ timeout }}`**：idle scheduler で起動し、正の整数 millisecond で指定した `timeout` を deadline とする。
- **`activate:media="query"`**：空でない media query string が最初に一致したときに起動する。
- **`activate:interaction={options}`**：事前に準備した native recorder または eager stub が指定 event を admission したときに起動する。

`activate:visible` の `options` は、`rootMargin?: string` と `threshold?: number | readonly number[]` を持つ。
省略値は `rootMargin: "0px"` と `threshold: 0` である。
directive value 自体を省略した場合も、この省略値を使う。
`rootMargin` は build target の IntersectionObserver grammar で parse できなければならない。
threshold は有限な `0` 以上 `1` 以下の値とし、array は重複を除いて昇順に canonicalize する。

`activate:idle` の timeout は正の safe integer millisecond とする。
`activate:media` は build target の media query grammar で parse し、空または invalid な query を diagnostic とする。

`activate:interaction` の `options` は、空でない `events: readonly string[]`、`queue?: "first" | "latest" | "all"`、`limit?: number`、`overflow?: "fail" | "drop-oldest" | "drop-newest"` を持つ。
省略値は `queue: "first"`、`limit: 1`、`overflow: "fail"` である。
compiler は各 event が event root の admission contract と一致することを検証する。
event type は重複のない canonical list とし、limit は正の safe integer とする。
`first` と `latest` は limit を `1` に固定し、`all` だけが一より大きい bounded queue を持てる。

`activate:*` は client root を作らない。
client root がない region への指定は diagnostic とする。

policy は source-tree lexical region から、root が持つすべての DOMTarget edge を使って決める。
複数 policy にまたがる root は、意味を保って split できる場合だけ分割する。
split できなければ diagnostic とする。

targetless application root の既定は eager である。
module dependency artifact は targetless root ではないため、この規則で eager にしない。

`visible` で IntersectionObserver が利用できない場合だけ eager fallback を許す。
`idle` は明示 deadline fallback を持つ。
それ以外の implicit eager fallback は許さない。

一度 active になった group は、visible または media 条件が変わっても deactivate しない。

### event admission

event root は、admission する trigger source を列挙する。
source には、parser、resource、network、lifecycle、media、animation、transition、timer、observer、device、trusted user input、author-script dispatch を含める。

stable native recorder または complete handler は、列挙した source が最初に dispatch できる admission frontier より前に、宣言した EventTarget と native phase へ設置する。

platform-inert contract は、platform が実際に抑止する event class だけを遅延させられる。
readiness をすべての admitted source より前に保証できない場合は、その source を contract から実際に排除する、complete handler を eager に設置する、または diagnostic とする。

listener を recording から invocation へ切り替えるために remove と re-add を行わない。
type、target、capture、passive、once、signal、source order を維持する stable entry を使う。

deferred listener は、native slot が実際に invocation された場合だけ immutable snapshot を作る。
DOM `Event` を再 dispatch しない。

user activation、propagation、cancel、default action、microtask order、pointer capture、drag、IME、focus、selection、submit、navigation、後続 event targeting に依存する handler は、complete handler を native slot で eager に実行するか diagnostic とする。

### DSD と custom element shell

DSD は **Dathra-inactive** である。
これは Dathra module、binding、component body が未起動という意味であり、HTML parser と custom-element platform effect が inert という意味ではない。

generated shell の constructor と parser-time lifecycle は `attachShadow()` を呼ばない。
parser-created または parser の可能性がある host では、`ElementInternals.shadowRoot === null` を DSD 不在の証拠にしない。

compiler は host ごとの parse-complete fence を出力する。
fence は DSD template または host-end marker の後に置き、microtask だけで代替しない。

fence 前の constructor と custom-element reaction は、すべて capture と enqueue だけを行う。
対象には、attributeChanged、connected、disconnected、connectedMove、adopted、formAssociated、formDisabled、formReset、formStateRestore を含む。

author callback は fence 後に generation guard の下で UA order を保って drain する。

client-created であることを compiler creation operation が保証した host だけが、宣言済み factory で ShadowRoot を作る。
factory は immutable shadow template と static style artifact を含む。
SSR instance は既存 DSD と style を再挿入しない。

ShellRegistrationArtifact は registry と tag ごとに一つの shell subclass を持つ。
registration、upgrade、`:defined`、`whenDefined()`、form association は instance activation と別の platform observable である。

form-associated semantics と同期 preactivation API は、eager shell stub で満たすか diagnostic とする。
client scope と shell obligation がなければ、shell bootstrap を生成しない。

### DOM reconciliation

structural fingerprint は、browser-canonical で immutable な structure だけを対象にする。
form value、selection、focus、scroll、autofill、editable content を structure mismatch にしない。

SSR または adopted user-editable facet は、すべて `unknown` から始める。
compiler-created かつ未公開の control、または platform adapter が attestation した control だけを `pristine` にできる。

reconciliation は、同じ mutable state と native side-effect group から成る transitive component ごとに二段階で行う。

1. setter と effect を実行せず、unknown または dirty facet を snapshot する。
2. deterministic merge contract に従って state を解決し、publish する。

DOM-wins は state equivalence class 単位で判断する。
競合値がある場合は deterministic merge または event-order contract を要求し、DOM traversal order で選ばない。

DOM-wins の native state は adoption-only である。
同じ node を保持し、activation 中に value、default value、checked、default checked、selected、default selected、files、selection、reset、reflecting setter を呼ばない。

hidden UA state は DOM-owned のままにする。
write が必要な場合は、merge と event-order contract を要求する。

built-in facet には、value、default value、checked、default checked、indeterminate、option selectedness、editable content、selection、files、radio、select、form group を含む。
custom control は element-owned snapshot、merge、write contract を持たなければ opaque DOM-owned state とする。

focus と scroll の復元は post-active effect とする。

### dynamic client UI

client-created UI は、compiler 生成 DOMTemplateArtifact と InsertionSlotDefinition からだけ作る。
slot definition は、anchor、cardinality、key domain、allowed order operation、binding schema、coordinator を持つ。

slot は coordinator-serialized epoch と operation sequence を持つ。
operation envelope は、artifact、slot、owner generation、operation ID、expected epoch、key、必要に応じて item generation を持つ。

deduplication は epoch validation より前に行う。
同じ canonical payload の retry は保存済み terminal result を返し、operation ID を異なる payload で再利用した場合は失敗する。

remove は item generation を tombstone にする。
同じ key の再利用は新しい generation を作る。

move は同じ slot 内に限定する。
cross-slot move は diagnostic とするか、両 slot、両 epoch、item generation、canonical lock order を持つ一つの transaction とする。

### activation failure

pre-active failure では SSR node を置換または削除しない。
affected behavior を明示的に failed にし、RuntimeFailureChannel へ報告する。

script-capable post-active effect は rollback できるとは主張しない。
definition が宣言した containment policy に従う。
SSR preservation が必要な root で post-active mutation を許容できなければ compile diagnostic とする。

## author-facing API

### activation directive

配置は compiler が root と dependency から導出する。
client code への opt-in directive は要求しない。

`activate:*` は、既に推論した client root の起動時刻だけを変更する。
plain DOM、functional component、`defineComponent` host のいずれにも指定できる。

directive の region と root の DOMTarget が一致しない場合は、source-tree lexical region の規則に従って split または diagnostic とする。
directive value は build 時に決まる定数でなければならない。
compiler は reserved attribute を DOM attribute または component props へ渡さない。

reserved JSX attribute は次の排他的 union とする。

```ts
interface VisibleActivationOptions {
  readonly rootMargin?: string;
  readonly threshold?: number | readonly number[];
}

interface IdleActivationOptions {
  readonly timeout: number;
}

interface InteractionActivationOptions {
  readonly events: readonly string[];
  readonly queue?: "first" | "latest" | "all";
  readonly limit?: number;
  readonly overflow?: "fail" | "drop-oldest" | "drop-newest";
}

type ActivationDirectiveProps =
  | {
      readonly "activate:eager"?: true;
      readonly "activate:visible"?: never;
      readonly "activate:idle"?: never;
      readonly "activate:media"?: never;
      readonly "activate:interaction"?: never;
    }
  | {
      readonly "activate:eager"?: never;
      readonly "activate:visible": true | VisibleActivationOptions;
      readonly "activate:idle"?: never;
      readonly "activate:media"?: never;
      readonly "activate:interaction"?: never;
    }
  | {
      readonly "activate:eager"?: never;
      readonly "activate:visible"?: never;
      readonly "activate:idle": IdleActivationOptions;
      readonly "activate:media"?: never;
      readonly "activate:interaction"?: never;
    }
  | {
      readonly "activate:eager"?: never;
      readonly "activate:visible"?: never;
      readonly "activate:idle"?: never;
      readonly "activate:media": string;
      readonly "activate:interaction"?: never;
    }
  | {
      readonly "activate:eager"?: never;
      readonly "activate:visible"?: never;
      readonly "activate:idle"?: never;
      readonly "activate:media"?: never;
      readonly "activate:interaction": InteractionActivationOptions;
    };

interface ClientOnlyRenderDirectiveProps {
  readonly "render:client"?: true;
}

interface ExternalDomOwnershipOptions {
  readonly initialContent: "preserve-ssr" | "empty";
  readonly lifetime: "nearest-activation-group" | "host-element";
  readonly cleanup: "author-required";
}

interface ExternalDomDirectiveProps {
  readonly "dom:external"?: true | ExternalDomOwnershipOptions;
}

type ExecutionDirectiveProps = ActivationDirectiveProps &
  ClientOnlyRenderDirectiveProps &
  ExternalDomDirectiveProps;
```

intrinsic element と component の通常 props は ExecutionDirectiveProps と intersection し、先頭 branch の全 property 省略によって activation directive なしを表す。
同じ lexical region に複数の activation directive が現れる場合は、spread を含めて compile diagnostic とする。
親子 region の異なる policy は、各 root の全 DOMTarget が一つの region に収まり、root split が意味を保てる場合だけ共存できる。

### client-only initial rendering

`render:client` は、compiler が legal な server materialization を構成できないと証明した root に対する root-local acknowledgement である。
この contract は対象 root を client-only initial root にし、server artifact には compiler 生成 anchor と必要な noninteractive fallback だけを出力する。

`render:client` は activation timing を指定しない。
server materialization が legal な root への指定は diagnostic とする。
親に置いた `render:client` は、子または sibling の initial UI obligation を抑制しない。
対象 root を一意に選べない region 指定も diagnostic とする。
値は literal `true` だけを許し、false、dynamic expression、runtime 条件を受理しない。
spread を含む props は build 時に一意に解決し、重複する `render:client`、unknown spread、対象 root をまたぐ spread は diagnostic とする。
compiler は `render:client` を DOM attribute または component prop へ渡さず、root-local server materialization diagnostic の acknowledgement としてだけ消費する。
`render:client` と `activate:*` は直交し、同じ root に併記した場合も initial placement と activation timing をそれぞれの契約で検証する。

### external DOM ownership

`dom:external` は editor、chart、map など imperative library が container descendants を排他的に所有するための reserved JSX directive である。
intrinsic DOM container、または compiler が一意な intrinsic container へ lower できる graph-transparent component にだけ指定できる。
値は literal `true` または build-time constant ExternalDomOwnershipOptions とし、dynamic value、unknown spread、複数 container へまたがる指定を diagnostic にする。

compiler は directive site の TemplateNode ID、owner definition、DOMTarget marker range から ExternalDomRegionDefinition ID を生成する。
container element 自体の insertion、removal、connectivity、owner generation は Dathra が管理するが、commit 後の descendant node、text、attribute、selection、focus、library resource は external owner が管理する。
Dathra の binding、reconciliation、dynamic slot、event recorder target、別 DOMTarget は external descendant range に入れない。
external region の crossing、部分 overlap、nested `dom:external` は拒否し、一つの descendant node に owner を二つ割り当てない。

`initialContent: preserve-ssr` は SSR descendants を imperative owner の initial input として保持し、activation 時に Dathra が diff、clear、reinsert しない。
`initialContent: empty` は server artifact に空 anchor range だけを出し、imperative owner の client operation が descendants を作る。
external descendants が initial UI obligation を持つ場合、empty は server-first の例外を暗黙承認せず、同じ root に legal な `render:client` contract を要求する。
既定の `true` は preserve-ssr、nearest-activation-group、author-required と同じである。

imperative setup は `onActivate`、`effect`、または execution contract で client effect として導出し、返却 cleanup または `onDispose` を同じ lifetime owner に登録する。
`cleanup: author-required` を満たす cleanup path と resource ownership を証明できなければ diagnostic にする。
host-element lifetime は element disconnect/adoption generation、nearest-activation-group は owning group disposal で authority を revoke し、cleanup 後の external mutation を generation guard で拒否する。

`dom:external` 自体は server/client placement や activation timing を指定しない。
compiler は reserved prop を DOM attribute と component prop へ渡さず、ExternalDomRegionDefinition と ownership exclusion だけへ lower する。

### lifecycle と effect

author-facing lifecycle primitive は次の型を持つ。

```ts
type Cleanup = () => void | Promise<void>;

type RuntimeFailureCode =
  | "activation-failed"
  | "cleanup-failed"
  | "cleanup-self-await"
  | "late-settlement-failed"
  | "failure-observer-failed"
  | "integrity-failed"
  | "protocol-failed"
  | "ownership-violated";

type InternalRuntimeFailureSubject =
  | { readonly kind: "coordinator"; readonly coordinatorId: string }
  | { readonly kind: "projection"; readonly build: string; readonly projection: string }
  | { readonly kind: "manifest"; readonly manifestUrl: string }
  | { readonly kind: "artifact"; readonly artifactAddressId: string }
  | { readonly kind: "definition"; readonly definitionId: string }
  | {
      readonly kind: "generation";
      readonly definitionId: string;
      readonly generationId: string;
    }
  | {
      readonly kind: "instance";
      readonly definitionId: string;
      readonly instanceId: string;
      readonly generationId: string;
    }
  | {
      readonly kind: "cleanup-task";
      readonly ownerInstanceId: string;
      readonly taskId: string;
    };

type RuntimeFailureSubjectCategory = InternalRuntimeFailureSubject["kind"];

interface RuntimeFailureSubject {
  readonly kind: "opaque";
  readonly category: RuntimeFailureSubjectCategory;
  readonly publicId: string;
}

interface InternalRuntimeFailureRecord {
  readonly sequence: number;
  readonly code: RuntimeFailureCode;
  readonly phase: "boot" | "pre-active" | "post-active" | "disposing" | "late-settlement";
  readonly subject: InternalRuntimeFailureSubject;
  readonly primary: boolean;
  readonly details: unknown;
}

interface RuntimeFailure {
  readonly sequence: number;
  readonly code: RuntimeFailureCode;
  readonly phase: "boot" | "pre-active" | "post-active" | "disposing" | "late-settlement";
  readonly subject: RuntimeFailureSubject;
  readonly primary: boolean;
  readonly details: CodecWireValue | null;
}

interface RuntimeFailureChannel {
  subscribe(listener: (failure: RuntimeFailure) => void): Cleanup;
  retained(): readonly RuntimeFailure[];
  pin(sequence: number): FailureRef | null;
}

interface RuntimeFailureSink {
  publish(failure: RuntimeFailure): void;
}

interface RuntimeHostAdapter {
  readonly failureSink: RuntimeFailureSink;
  readonly retainedFailureLimit: number;
  readonly lateLedgerHardLimit: LateLedgerBudget;
  readonly failurePinHardLimit: FailurePinBudget;
  readonly dynamicInstantiationHardLimit: DynamicInstantiationBudget;
  readonly subscriptionHardLimit: SubscriptionRuntimeBudget;
  readonly remoteProtocolHardLimit: RemoteProtocolBudget;
  readonly remoteLedgerHardLimit: RemoteLedgerBudget;
}

declare function effect(run: () => void | Cleanup): void;
declare function onActivate(run: () => void | Cleanup): void;
declare function onDispose(run: Cleanup): void;
declare function runtimeFailures(root: Document | ShadowRoot): RuntimeFailureChannel;
```

`effect` は client reactive root を作り、owning activation group が `active` になった後に一回実行する。
tracked dependency が invalidate された場合は、前回の cleanup を完了してから再実行する。
group disposal では最後の cleanup を実行する。

各 effect は monotonically increasing generation と、`idle`、`running`、`cleaning`、`disposed` state を持つ。
`running` または `cleaning` 中の invalidation は dirty flag 一つへ coalesce し、現在の cleanup 完了後に最新 state で一回だけ再評価する。
owner generation が cleanup 中に失効した場合は再評価せず、cleanup completion を owner disposal へ渡す。

再評価前の cleanup が reject した場合は effect root と owning ActivationGroupInstance の health を failed にし、post-active containment policy を適用する。
owner disposal 中の cleanup rejection は CleanupOutcome.failures へ FailureRef を追加し、既存の primary health failure を上書きしない。
cleanup rejection を無視して effect body を再実行しない。

`onActivate` は owning ActivationGroupInstance の generation ごとに一回実行する。
return した cleanup は、その generation の disposal 時に実行する。

`onDispose` は、compiler が call site から一意に導出した LifetimeRegionInstance の generation ごとに一回登録する。
owner を一意に導出できない call site は diagnostic とする。
async cleanup は owner の cleanup completion に参加する。

cleanup は generation ごとの DAG で順序付ける。
child LifetimeRegion、dependent activation group、effect cleanup、`onActivate` が返した cleanup、`onDispose` hook、owned resource と leased prerequisite の順に provider より dependent を先にする。
同じ owner 内で dependency edge がない effect cleanup、`onActivate` cleanup、`onDispose` hook は、それぞれ reverse registration order で実行する。
`onDispose` hook が参照できるよう、owned resource と lease は hook 完了後に release する。

cleanup DAG の独立 branch は並行実行できるが、edge で後続する cleanup は predecessor の async completion を待つ。
一つの cleanup failure で残りの cleanup を省略せず、primary failure と secondary cleanup failure を RuntimeFailureChannel と CleanupOutcome に集約する。

coordinator は各 cleanup callback を呼ぶ前に CleanupTaskToken を作り、task ID、owner generation、predecessor、state、retained byte upper bound、optional GenerationFencedCleanupToken を ledger へ登録する。
token は `pending`、`running`、`completed`、`failed`、`moved-to-late-ledger` の一方向 state を持つ。

cleanup deadline では、事前に LateCleanupAdmission を予約し、hard terminal bound を持つ token だけを一つの environment-owned LateCleanupLedger へ原子的に移せる。
running token、pending token、未開始の残余 DAG に movable でない task が一つでもあれば owner を `abandoned` とせず、通常の `disposing` と completion wait を継続する。
移動が成立した場合だけ owner の completion を `abandoned` にする。
late ledger は元の dependency order を維持して可能な task を継続し、late failure を FailureRef と secondary RuntimeFailure にする。
manifest の LateLedgerBudget は host の lateLedgerHardLimit 以下でなければならず、open ledger、task、retained byte の reservation は hard limit を超えない。
各 ledger は maxAgeMs までに adapter の terminal acknowledgement を得て閉じるため、永続 pending operation を late ledger へ admission しない。

同じ resource identity の新 generation は、旧 generation の LateSettlementLedger と LateCleanupLedger が terminal になるまで reuse barrier で待つ。
例外として、関連する全 adapter が private store で真正性を検証した GenerationFencedCleanupToken を持つ場合だけ、新 generation を開始できる。
fenceSequence は sink identity と resource identity ごとの単調増加値であり、新 generation は sink 側の CAS で次 sequence へ rotate した receipt を得る。
coordinator はこの rotation と新 generation の registry publication を一つの commit decision に束縛し、rotation 前に新 handle を公開しない。
cleanup adapter は cleanup mutation ごとに resource identity、owner generation、expected fenceSequence を sink へ渡し、sink は compare と mutation を一つの不可分 operation として実行する。
author code または adapter が check 後に suspend して別 operation で mutation する方式は generation-fenced と認めない。
旧 cleanup が sink operation に先勝ちした場合はその mutation が terminal になった後でだけ rotation と新 publication を行い、rotation が先勝ちした場合は旧 mutation を effect なしで stale terminal にする。
stale token の cleanup は新 generation の handle、registry entry、external resource を変更できず、fence violation を secondary runtime failure として terminalize する。
sink-side compare-and-mutate と rotation receipt を提供できない adapter では、token があっても reuse barrier を解除しない。

runtime は現在実行中の CleanupTaskToken を async context に記録する。
cleanup callback が同じ owner の `handle.dispose()` を呼んだ場合は新しい wait edge を作らず、即時の `cleanup-self-await` DisposeResult を返して failure を記録する。
別 owner の dispose を await する場合も cleanup DAG に cycle が生じれば同じ方法で拒否する。
この failure の public pin を予約できない場合も wait edge は作らず、内部 failure と disposal state を terminalize して `failure-pin-budget-exhausted` DisposeResult を返す。

RuntimeFailureChannel は coordinator ごとに一つ持ち、sequence は coordinator 内で単調増加する。
primary failure は generation ごとに一回 publish し、cleanup と late settlement は `primary: false` で追加する。
manifest または artifact failure のように generation がない failure も InternalRuntimeFailureSubject では具体的な coordinator、projection、manifest、artifact identity を保持できる。
subscriber、sink、retained、FailureRef.read が受け取る public RuntimeFailure は、subject を category と audience-scoped opaque publicId だけへ変換する。
publicId は host secret、channel audience、subject identity、redaction epoch から導出し、manifest URL、artifact address、definition ID、instance ID、generation ID、task ID を復元できない。
公開 details は RuntimeFailureChannel の audience と exposure policy を通過した CodecWireValue に限定し、内部 exception object、capability、secret を直接渡さない。
RuntimeHostAdapter は bootstrap 時に coordinator へ注入し、retainedFailureLimit は非負 safe integer とする。
manifest の FailurePinBudget は host の failurePinHardLimit 以下でなければならない。
budget field は非負 safe integer、maxClaimAgeMs は public claim を許す場合に正の safe integer とし、owner claim、public claim、pinned byte を原子的に reserve/release する。
public details は canonical byte length が maxPublicFailureBytes を超える場合に null へ redact して bounded tombstone を作り、巨大 details のために failure reporting 自体を失敗させない。

FailureRef は runtime だけが生成する pin capability である。
internal health、cleanup、activation failure state は failure sequence と private owner claim ID だけを保持する。
`InstanceHandle.status()` の各呼び出し、各 activation result、各 cleanup result、`RuntimeFailureChannel.pin()` は、同じ sequence に対しても別の claim ID と別の FailureRef object を作る。
一つの FailureRef の `release()` は自身の claim だけを解放し、別 snapshot、別 result、別 caller の pin を失効させない。
pinned record は retainedFailureLimit が 0 でも自身の claim の release まで取得できる。
public claim は maxPublicClaims、maxPinnedBytes、maxClaimAgeMs の hard limit を持ち、expiry で自動 release する。
`release()` は idempotent であり、release または expiry 後の同じ FailureRef の `read()` は常に null を返す。
status、DisposeResult、activation result、cleanup result は返却値に含む全 FailureRef claim を一つの reservation で取得し、途中まで pin した public outcome を返さない。
budget 不足では各 API の explicit `failure-pin-budget-exhausted` result を返し、unbounded claim を作らない。
内部 InternalHealthState、InternalCleanupOutcome、owner disposal、failure containment は public pin の成否と独立して terminalize し、public result 構築待ちで cleanup を停止しない。
failure record は coordinator state へ commit した後、coordinator lock の外で subscriber と sink に通知する。
subscriber または sink の throw は元の failure と containment を変更せず、別の secondary failure として bounded channel に記録する。
失敗した subscriber または sink へ、その通知失敗を同期再通知せず、対象 subscription を quarantine する。

### contract、codec、remote operation

build-time extension API は次の型を持つ。

```ts
type ExecutionEnvironment = "build" | "server-request" | "browser";

declare const sha256DigestBrand: unique symbol;
declare const qualifiedIdBrand: unique symbol;
declare const factIdBrand: unique symbol;
declare const registryIdBrand: unique symbol;
declare const qualifiedFactIdBrand: unique symbol;

type Sha256Digest = string & { readonly [sha256DigestBrand]: true };
type QualifiedId<Domain extends string> = Sha256Digest & {
  readonly [qualifiedIdBrand]: Domain;
};

type FactId = string & { readonly [factIdBrand]: true };
type QualifiedFactId = string & { readonly [qualifiedFactIdBrand]: true };

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
  | "failure-schema";

type RegistryId<Kind extends RegistryKind> = string & {
  readonly [registryIdBrand]: Kind;
};

type QualifiedRegistryId<Kind extends RegistryKind> = Kind extends RegistryKind
  ? QualifiedId<`registry:${Kind}`>
  : never;

type SemanticPathSegment =
  | { readonly kind: "property"; readonly key: string }
  | { readonly kind: "tuple-index"; readonly index: number }
  | { readonly kind: "element" };

type SemanticSubject =
  | { readonly kind: "module-evaluation" }
  | { readonly kind: "export-value"; readonly exportName: string }
  | { readonly kind: "receiver"; readonly exportName: string }
  | {
      readonly kind: "parameter";
      readonly exportName: string;
      readonly index: number;
      readonly path: readonly SemanticPathSegment[];
    }
  | {
      readonly kind: "return";
      readonly exportName: string;
      readonly path: readonly SemanticPathSegment[];
    }
  | {
      readonly kind: "callback-invocation";
      readonly exportName: string;
      readonly parameterIndex: number;
    }
  | {
      readonly kind: "allocated-resource";
      readonly exportName: string;
      readonly allocationSiteId: string;
    };

type FactReference<Qualified extends boolean> = Qualified extends true
  ? QualifiedFactId
  : FactId;

type RegistryReference<
  Kind extends RegistryKind,
  Qualified extends boolean,
> = Qualified extends true ? QualifiedRegistryId<Kind> : RegistryId<Kind>;

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
  | "trust-boundary";

interface FactBase<Qualified extends boolean> {
  readonly schema: "dathra.fact/1";
  readonly id: FactReference<Qualified>;
  readonly subject: SemanticSubject;
}

interface FactEndpoint<
  Kind extends SemanticFactKind,
  Qualified extends boolean,
> {
  readonly factId: FactReference<Qualified>;
  readonly factKind: Kind;
}

type SemanticRelation<Qualified extends boolean = false> = {
  readonly schema: "dathra.relation/1";
} &
  (
    | {
        readonly kind: "reads";
        readonly from: FactEndpoint<"effect" | "invocation", Qualified>;
        readonly to: FactEndpoint<"read", Qualified>;
      }
    | {
        readonly kind: "writes";
        readonly from: FactEndpoint<"effect" | "invocation", Qualified>;
        readonly to: FactEndpoint<"write", Qualified>;
      }
    | {
        readonly kind: "invokes";
        readonly from: FactEndpoint<"effect" | "invocation", Qualified>;
        readonly to: FactEndpoint<"invocation", Qualified>;
      }
    | {
        readonly kind: "returns";
        readonly from: FactEndpoint<"invocation", Qualified>;
        readonly to: FactEndpoint<SemanticFactKind, Qualified>;
      }
    | {
        readonly kind: "owns";
        readonly from: FactEndpoint<"ownership", Qualified>;
        readonly to: FactEndpoint<"identity" | "lifetime", Qualified>;
      }
    | {
        readonly kind: "orders-before";
        readonly from: FactEndpoint<"ordering", Qualified>;
        readonly to: FactEndpoint<SemanticFactKind, Qualified>;
      }
    | {
        readonly kind: "transfers-as";
        readonly from: FactEndpoint<SemanticFactKind, Qualified>;
        readonly to: FactEndpoint<"transfer", Qualified>;
      }
    | {
        readonly kind: "fails-with";
        readonly from: FactEndpoint<"effect" | "invocation", Qualified>;
        readonly to: FactEndpoint<"failure", Qualified>;
      }
  );

type SemanticFact<Qualified extends boolean = false> = FactBase<Qualified> &
  (
    | {
        readonly kind: "environment";
        readonly environments: readonly ExecutionEnvironment[];
        readonly hostProfileIds: readonly RegistryReference<"host-profile", Qualified>[];
      }
    | {
        readonly kind: "read";
        readonly stability: "immutable" | "stable-within-token" | "may-change";
        readonly consistency: "none" | "snapshot-token" | "linearizable-authority";
        readonly replay: {
          readonly duplicate: boolean;
          readonly reorder: boolean;
          readonly recompute: boolean;
        };
        readonly readEffectFactId: FactReference<Qualified> | null;
        readonly environmentFactId: FactReference<Qualified>;
        readonly exposureFactId: FactReference<Qualified>;
      }
    | {
        readonly kind: "write";
        readonly writeEffectFactId: FactReference<Qualified>;
        readonly environmentFactId: FactReference<Qualified>;
        readonly exposureFactId: FactReference<Qualified>;
      }
    | {
        readonly kind: "effect";
        readonly readFactIds: readonly FactReference<Qualified>[];
        readonly writeFactIds: readonly FactReference<Qualified>[];
        readonly invocationFactIds: readonly FactReference<Qualified>[];
        readonly retainsCallbacks: boolean;
        readonly reentrant: boolean;
        readonly schedulesWork: boolean;
        readonly allocatesResource: boolean;
      }
    | {
        readonly kind: "invocation";
        readonly callable: "call" | "construct" | "call-and-construct";
        readonly boundary: "sync" | "async";
        readonly callbackParameterIndexes: readonly number[];
        readonly retainsCallbacks: boolean;
        readonly reentrant: boolean;
        readonly receiverBrandId: RegistryReference<"brand", Qualified> | null;
      }
    | {
        readonly kind: "identity";
        readonly scope: "none" | "realm" | "module" | "instance";
        readonly brandId: RegistryReference<"brand", Qualified> | null;
      }
    | {
        readonly kind: "ownership";
        readonly retention: RetentionContract;
        readonly ownerFactId: FactReference<Qualified> | null;
        readonly lifetimeFactId: FactReference<Qualified>;
      }
    | {
        readonly kind: "ordering";
        readonly relation: "before" | "serial" | "exclusive" | "commutative";
        readonly memberFactIds: readonly FactReference<Qualified>[];
      }
    | {
        readonly kind: "failure";
        readonly channel: "typed-result" | "throw" | "reject" | "abort";
        readonly schemaId: RegistryReference<"failure-schema", Qualified>;
      }
    | {
        readonly kind: "cancellation";
        readonly point: "before-start" | "before-commit" | "best-effort-after-commit";
        readonly propagation: "owned-descendants" | "explicit-edges";
      }
    | {
        readonly kind: "lifetime";
        readonly domain: "call" | "request" | "generation" | "owner" | "realm" | "process";
        readonly cleanup: "none" | "sync" | "async";
      }
    | {
        readonly kind: "transfer";
        readonly binding: TransferBinding<Qualified>;
      }
    | {
        readonly kind: "exposure";
        readonly audiencePolicyId: RegistryReference<"policy", Qualified>;
        readonly sinkPolicyIds: readonly RegistryReference<"policy", Qualified>[];
        readonly releasePolicyId: RegistryReference<"policy", Qualified> | null;
      }
    | {
        readonly kind: "integrity";
        readonly source: "compiler" | "signed-manifest" | "validated-input" | "untrusted";
        readonly endorsementPolicyId: RegistryReference<"policy", Qualified> | null;
      }
    | {
        readonly kind: "dependency-epoch";
        readonly epochId: string;
        readonly invalidation: "content-addressed" | "host-supplied" | "explicit";
      }
    | {
        readonly kind: "trust-boundary";
        readonly enforcement: "worker" | "sandbox" | "compartment" | "host-process";
        readonly capabilityPolicyIds: readonly RegistryReference<"policy", Qualified>[];
      }
  );

type TransferBinding<Qualified extends boolean = false> =
  | { readonly kind: "none" }
  | { readonly kind: "snapshot" }
  | {
      readonly kind: "codec";
      readonly codecId: RegistryReference<"codec", Qualified>;
      readonly version: string;
    }
  | {
      readonly kind: "reference";
      readonly resolverId: RegistryReference<"resolver", Qualified>;
      readonly version: string;
      readonly capabilityPolicyId: RegistryReference<"policy", Qualified>;
    }
  | {
      readonly kind: "subscription";
      readonly sourceId: RegistryReference<"subscription-source", Qualified>;
      readonly version: string;
    }
  | {
      readonly kind: "remote";
      readonly operationId: RegistryReference<"remote-operation", Qualified>;
      readonly version: string;
    };

interface ExportExecutionContract<Qualified extends boolean = false> {
  readonly factIds: readonly FactReference<Qualified>[];
  readonly callable: "none" | "call" | "construct" | "call-and-construct";
  readonly receiverBrandId: RegistryReference<"brand", Qualified> | null;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly transfer: TransferBinding<Qualified>;
}

interface ModuleExportLocator {
  readonly specifier: string;
  readonly exportName: string;
}

interface RegistryDescriptorBase<
  Kind extends RegistryKind,
  Qualified extends boolean = false,
> {
  readonly schema: "dathra.registry/1";
  readonly kind: Kind;
  readonly id: RegistryReference<Kind, Qualified>;
  readonly version: string;
}

type CodecSlotWirePathSegment =
  | { readonly kind: "property"; readonly key: string }
  | { readonly kind: "array-index"; readonly index: number }
  | { readonly kind: "array-each" };

interface CodecGraphEdgeSlotRecord {
  readonly name: string;
  readonly wirePath: readonly CodecSlotWirePathSegment[];
  readonly edgeKind: "graph-node" | "cell" | "reference" | "subscription";
  readonly cardinality: "one" | "optional" | "many";
}

interface CodecGraphEdgeSlotTable {
  readonly schema: "dathra.codec-edge-slots/1";
  readonly slots: readonly CodecGraphEdgeSlotRecord[];
}

interface CodecRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"codec", Qualified> {
  readonly observationContractDigest: Sha256Digest;
  readonly wireSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly materializationTrust: "closed-declarative" | "host-attested";
  readonly graphEdgeSlots: CodecGraphEdgeSlotTable | null;
}

interface ResolverRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"resolver", Qualified> {
  readonly locatorSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly exposurePolicyId: RegistryReference<"policy", Qualified>;
  readonly failureSchemaId: RegistryReference<"failure-schema", Qualified>;
}

interface RemoteOperationRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"remote-operation", Qualified> {
  readonly inputValueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly outputValueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly applicationFailureSchemaId: RegistryReference<"failure-schema", Qualified>;
  readonly inputCodecId: RegistryReference<"codec", Qualified>;
  readonly outputCodecId: RegistryReference<"codec", Qualified>;
  readonly failureCodecId: RegistryReference<"codec", Qualified>;
  readonly authorizationPolicyId: RegistryReference<"policy", Qualified>;
  readonly deliveryPolicyId: RegistryReference<"policy", Qualified>;
  readonly deliveryAdapterId: RegistryReference<"remote-delivery-adapter", Qualified>;
  readonly transportProfileId: RegistryReference<"host-profile", Qualified>;
  readonly delivery: RemoteDeliveryContract<Qualified>;
  readonly protocolBudget: RemoteProtocolBudget;
  readonly systemFailureProtocol: "dathra.remote-system/1";
}

interface RemoteDeliveryAdapterRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"remote-delivery-adapter", Qualified> {
  readonly receiptSchema: "dathra.remote-commit-receipt/1";
  readonly nonCommitReceiptSchema: "dathra.remote-non-commit-receipt/1";
  readonly atomicity:
    | "none"
    | "fenced-idempotency"
    | "effect-ledger-result-atomic";
  readonly deliveryEnvironment: "server-request";
  readonly hostAttestationDigest: Sha256Digest;
  readonly ledgerBudget: RemoteLedgerBudget;
}

interface SubscriptionSequenceContract {
  readonly schema: "dathra.subscription-sequence/1";
  readonly namespaceDomainId: string;
  readonly resyncNamespace: "preserve" | "rotate-with-new-snapshot";
  readonly maxOutstandingRevisions: number;
  readonly maxUnacknowledgedRevisions: number;
  readonly maxRetainedBytes: number;
  readonly maxSequenceGap: number;
  readonly cursorRetentionMs: number;
  readonly reconnectHorizonMs: number;
  readonly resyncHorizonMs: number;
  readonly terminalDeadlineMs: number;
  readonly overflow: "close-and-resync" | "fail-session";
  readonly disconnect: "retain-until-reconnect-horizon" | "close-immediately";
  readonly gc: "acknowledged-and-cursor-expired";
}

interface SubscriptionRuntimeBudget {
  readonly maxConcurrentSessions: number;
  readonly maxOutstandingRevisions: number;
  readonly maxUnacknowledgedRevisions: number;
  readonly maxRetainedBytes: number;
  readonly maxSequenceGap: number;
  readonly maxCursorRetentionMs: number;
  readonly maxReconnectHorizonMs: number;
  readonly maxResyncHorizonMs: number;
  readonly maxTerminalDeadlineMs: number;
}

interface SubscriptionSourceRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"subscription-source", Qualified> {
  readonly locatorSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
  readonly revisionCodecId: RegistryReference<"codec", Qualified>;
  readonly failureSchemaId: RegistryReference<"failure-schema", Qualified>;
  readonly audiencePolicyId: RegistryReference<"policy", Qualified>;
  readonly capabilityPolicyId: RegistryReference<"policy", Qualified>;
  readonly authorizationPolicyId: RegistryReference<"policy", Qualified>;
  readonly namespaceAuthorityIssuerId: string;
  readonly namespaceAuthorityAttestationId: string;
  readonly sequenceContract: SubscriptionSequenceContract;
  readonly updateModes: readonly (
    | "replacement"
    | "stable-handle"
    | "journaled-in-place"
  )[];
}

interface BrandRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"brand", Qualified> {
  readonly identityScope: "realm" | "module" | "instance";
}

interface ValueDomainRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"value-domain", Qualified> {
  readonly valueSchemaDigest: Sha256Digest;
}

type PolicyKind =
  | "audience"
  | "sink"
  | "release"
  | "capability"
  | "authorization"
  | "endorsement"
  | "delivery";

interface PolicyRegistryDescriptor<
  Qualified extends boolean = false,
  Kind extends PolicyKind = PolicyKind,
> extends RegistryDescriptorBase<"policy", Qualified> {
  readonly policyKind: Kind;
  readonly ruleGraphDigest: Sha256Digest;
  readonly evaluation: "pure" | "host-authoritative-async";
}

interface HostProfileRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"host-profile", Qualified> {
  readonly featureSetDigest: Sha256Digest;
}

interface FailureSchemaRegistryDescriptor<Qualified extends boolean = false>
  extends RegistryDescriptorBase<"failure-schema", Qualified> {
  readonly failureSchemaDigest: Sha256Digest;
  readonly valueDomainId: RegistryReference<"value-domain", Qualified>;
}

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
  | FailureSchemaRegistryDescriptor<Qualified>;

interface RegistryEvaluationContext {
  readonly build: string;
  readonly projection: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly signal: AbortSignal;
}

interface PolicyInputByKind {
  readonly audience: {
    readonly kind: "audience";
    readonly exposureFactId: QualifiedFactId;
    readonly principalContextId: string;
    readonly audienceContext: CodecWireValue;
    readonly valueSummary: CodecWireValue;
  };
  readonly sink: {
    readonly kind: "sink";
    readonly exposureFactId: QualifiedFactId;
    readonly sinkQualifiedId: string;
    readonly audienceContext: CodecWireValue;
    readonly valueSummary: CodecWireValue;
  };
  readonly release: {
    readonly kind: "release";
    readonly exposureFactId: QualifiedFactId;
    readonly sinkPolicyQualifiedId: QualifiedRegistryId<"policy">;
    readonly purposeQualifiedId: string;
    readonly auditOperationId: string;
    readonly valueSummary: CodecWireValue;
  };
  readonly capability: {
    readonly kind: "capability";
    readonly operationQualifiedId: string;
    readonly capabilityRef: string | null;
    readonly subject: CodecWireValue;
  };
  readonly authorization: {
    readonly kind: "authorization";
    readonly operationQualifiedId: string;
    readonly capabilityRef: string | null;
    readonly subject: CodecWireValue;
  };
  readonly endorsement: {
    readonly kind: "endorsement";
    readonly integrityFactId: QualifiedFactId;
    readonly sourceAttestation: CodecWireValue;
    readonly valueSummary: CodecWireValue;
  };
  readonly delivery: {
    readonly kind: "delivery";
    readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
    readonly operationId: string;
    readonly action: "admit" | "retry-same-id" | "query-ledger" | "classify-terminal";
    readonly requestCommitment: Sha256Digest;
  };
}

type PolicyInput = PolicyInputByKind[PolicyKind];

interface PolicyGrantTerms {
  readonly scopeDigest: Sha256Digest;
  readonly shareDomainId: string | null;
  readonly aliasPermission: "isolated" | "same-share-domain";
  readonly lifetime: "evaluation" | "root-generation" | "owner-generation";
  readonly expiresAt: number | null;
  readonly revocationDomainId: string;
}

interface PolicyAllowResultByKind {
  readonly audience: { readonly audienceScopeDigest: Sha256Digest };
  readonly sink: { readonly sinkScopeDigest: Sha256Digest };
  readonly release: {
    readonly derived: CodecWireValue;
    readonly auditRecord: CodecWireValue;
  };
  readonly capability: { readonly grantTerms: PolicyGrantTerms };
  readonly authorization: { readonly grantTerms: PolicyGrantTerms };
  readonly endorsement: { readonly endorsementDigest: Sha256Digest };
  readonly delivery: {
    readonly allowedAction: PolicyInputByKind["delivery"]["action"];
    readonly horizonMs: number;
  };
}

type PolicyDecision<Kind extends PolicyKind = PolicyKind> =
  | ({ readonly decision: "allow" } & PolicyAllowResultByKind[Kind])
  | { readonly decision: "deny"; readonly reasonCode: string };

interface PolicyEvaluationPreimage<Kind extends PolicyKind> {
  readonly schema: "dathra.policy-evaluation/1";
  readonly policyQualifiedId: QualifiedRegistryId<"policy">;
  readonly policyKind: Kind;
  readonly build: string;
  readonly projection: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationGenerationId: string;
  readonly input: PolicyInputByKind[Kind];
}

interface AuthorizationGrantPreimage {
  readonly schema: "dathra.authorization-grant/1";
  readonly issuerPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly policyKind: "capability" | "authorization";
  readonly evaluationDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationGenerationId: string;
  readonly revocationEpoch: string;
  readonly issuedAt: number;
  readonly terms: PolicyGrantTerms;
}

declare const authorizationGrantBrand: unique symbol;
declare const authorizationGrantClaimBrand: unique symbol;

interface AuthorizationGrant {
  readonly [authorizationGrantBrand]: true;
  readonly id: string;
  readonly preimage: AuthorizationGrantPreimage;
}

interface AuthorizationGrantClaim {
  readonly [authorizationGrantClaimBrand]: true;
  readonly grantId: string;
  readonly claimId: string;
  readonly authorizationGenerationId: string;
  readonly expiresAt: number | null;
  release(): void;
}

declare const authorizationGrantEvidenceBrand: unique symbol;

interface AuthorizationGrantEvidence {
  readonly [authorizationGrantEvidenceBrand]: true;
  readonly evidenceId: string;
  readonly grantId: string;
  readonly authorizationGenerationId: string;
  readonly evaluationDigest: Sha256Digest;
  readonly purpose: "reference-resolve" | "subscription-open" | "remote-admission";
  readonly audienceId: string;
  readonly bindingDigest: Sha256Digest;
  readonly expiresAt: number | null;
}

interface RemoteAuthorizationEvidenceWire {
  readonly schema: "dathra.remote-authorization-evidence/1";
  readonly issuerId: string;
  readonly verifierProfileId: string;
  readonly protocolBindingId: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly evidenceId: string;
  readonly issuerPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly grantId: string;
  readonly authorizationGenerationId: string;
  readonly revocationEpoch: string;
  readonly grantTermsDigest: Sha256Digest;
  readonly evaluationDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly requestCommitment: Sha256Digest;
  readonly attemptId: string;
  readonly nonce: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly replayExpiresAt: number;
  readonly proof: CodecWireValue;
}

interface RemoteAuthorizationEvidenceExpectation {
  readonly protocolBindingId: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly authorizationPolicyQualifiedId: QualifiedRegistryId<"policy">;
  readonly requestCommitment: Sha256Digest;
  readonly attemptId: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly evaluationDigest: Sha256Digest;
  readonly maximumExpiresAt: number;
}

declare const verifiedRemoteAuthorizationEvidenceBrand: unique symbol;

interface VerifiedRemoteAuthorizationEvidence {
  readonly [verifiedRemoteAuthorizationEvidenceBrand]: true;
  readonly wire: RemoteAuthorizationEvidenceWire;
  readonly verifiedAt: number;
}

declare const remoteAuthorizationEvidenceIssuerBrand: unique symbol;
declare const remoteAuthorizationEvidenceVerifierBrand: unique symbol;

interface RemoteAuthorizationEvidenceIssuer {
  readonly [remoteAuthorizationEvidenceIssuerBrand]: true;
  readonly attestationId: string;
  issue(
    claim: AuthorizationGrantClaim,
    expected: RemoteAuthorizationEvidenceExpectation,
    issuedAt: number,
  ): RemoteAuthorizationEvidenceWire | null;
}

interface RemoteAuthorizationEvidenceVerifier {
  readonly [remoteAuthorizationEvidenceVerifierBrand]: true;
  readonly attestationId: string;
  verify(
    evidence: RemoteAuthorizationEvidenceWire,
    expected: RemoteAuthorizationEvidenceExpectation,
    verifiedAt: number,
  ): VerifiedRemoteAuthorizationEvidence | null;
}

declare const policyGrantAuthorityBrand: unique symbol;

type AuthorizationPolicyEvaluation =
  | PolicyEvaluationPreimage<"capability">
  | PolicyEvaluationPreimage<"authorization">;

interface PolicyGrantAuthority {
  readonly [policyGrantAuthorityBrand]: true;
  readonly attestationId: string;
  issue(
    evaluation: AuthorizationPolicyEvaluation,
    terms: PolicyGrantTerms,
    issuedAt: number,
  ): AuthorizationGrant;
  pin(
    grantId: string,
    expectedAuthorizationGenerationId: string,
  ): AuthorizationGrantClaim | null;
  evidence(
    claim: AuthorizationGrantClaim,
    evaluationDigest: Sha256Digest,
    purpose: AuthorizationGrantEvidence["purpose"],
    audienceId: string,
    bindingDigest: Sha256Digest,
  ): AuthorizationGrantEvidence | null;
  verifyEvidence(
    evidence: AuthorizationGrantEvidence,
    expectedPurpose: AuthorizationGrantEvidence["purpose"],
  ): AuthorizationGrantClaim | null;
  pinRemoteEvidence(evidence: VerifiedRemoteAuthorizationEvidence): AuthorizationGrantClaim | null;
  admitRemoteOperation(
    claim: AuthorizationGrantClaim,
    operationId: string,
    requestCommitment: Sha256Digest,
    evaluationDigest: Sha256Digest,
  ): RemoteAuthorizationCut | null;
}

interface PolicyEvaluator<Kind extends PolicyKind = PolicyKind> {
  readonly descriptor: PolicyRegistryDescriptor<false, Kind>;
  evaluate(
    input: PolicyInputByKind[Kind],
    context: RegistryEvaluationContext,
  ): PolicyDecision<Kind> | Promise<PolicyDecision<Kind>>;
}

interface ValueDomainValidator {
  readonly descriptor: ValueDomainRegistryDescriptor;
  validate(value: unknown): boolean;
}

interface FailureSchemaAdapter {
  readonly descriptor: FailureSchemaRegistryDescriptor;
  validate(value: unknown): boolean;
  toPublicDetails(value: unknown): CodecWireValue | null;
}

interface HostProfileValidator {
  readonly descriptor: HostProfileRegistryDescriptor;
  validateAttestation(attestation: CodecWireValue): boolean;
}

interface BrandValidator {
  readonly descriptor: BrandRegistryDescriptor;
  hasBrand(value: unknown, context: RegistryEvaluationContext): boolean;
}

type RegistrySourceImplementation<Kind extends RegistryKind> =
  RegistryRoleLocationFor<Kind> & {
    readonly implementation: ModuleExportLocator;
  };

interface RegistrySourceEntry<Kind extends RegistryKind> {
  readonly id: RegistryId<Kind>;
  readonly version: string;
  readonly descriptor: ModuleExportLocator;
  readonly implementations: readonly RegistrySourceImplementation<Kind>[];
}

interface ExecutionContractSource {
  readonly schema: "dathra.execution/1";
  readonly id: string;
  readonly version: string;
  readonly facts: readonly SemanticFact[];
  readonly relations: readonly SemanticRelation[];
  readonly exports: Readonly<Record<string, ExportExecutionContract>>;
  readonly registries: {
    readonly codecs: readonly RegistrySourceEntry<"codec">[];
    readonly resolvers: readonly RegistrySourceEntry<"resolver">[];
    readonly remoteOperations: readonly RegistrySourceEntry<"remote-operation">[];
    readonly remoteDeliveryAdapters: readonly RegistrySourceEntry<"remote-delivery-adapter">[];
    readonly subscriptionSources: readonly RegistrySourceEntry<"subscription-source">[];
    readonly brands: readonly RegistrySourceEntry<"brand">[];
    readonly valueDomains: readonly RegistrySourceEntry<"value-domain">[];
    readonly policies: readonly RegistrySourceEntry<"policy">[];
    readonly hostProfiles: readonly RegistrySourceEntry<"host-profile">[];
    readonly failureSchemas: readonly RegistrySourceEntry<"failure-schema">[];
  };
  readonly hostAssumptionFactIds: readonly FactId[];
}

interface RegistryProjectionSeedBase {
  readonly schema: "dathra.registry-projection-seed/1";
  readonly definitionId: string;
}

type RegistryNonProtocolSeedLocation = Exclude<
  RegistryRoleLocation,
  | { readonly registryKind: "remote-operation" }
  | { readonly registryKind: "remote-delivery-adapter" }
>;

type RegistryProjectionSeedForLocation<
  Location extends RegistryNonProtocolSeedLocation,
> = RegistryProjectionSeedBase & {
  readonly qualifiedId: QualifiedRegistryId<Location["registryKind"]>;
  readonly environment: Location["environment"];
  readonly role: Location["role"];
  readonly protocolBindingId: null;
};

type RegistryNonProtocolProjectionSeed =
  RegistryNonProtocolSeedLocation extends infer Location
    ? Location extends RegistryNonProtocolSeedLocation
      ? RegistryProjectionSeedForLocation<Location>
      : never
    : never;

type RegistryProtocolProjectionSeed = RegistryProjectionSeedBase &
  (
    | {
        readonly qualifiedId: QualifiedRegistryId<"remote-operation">;
        readonly environment: "browser";
        readonly role: "remote-client-transport";
        readonly protocolBindingId: Sha256Digest;
      }
    | {
        readonly qualifiedId: QualifiedRegistryId<"remote-operation">;
        readonly environment: "server-request";
        readonly role: "remote-server-endpoint";
        readonly protocolBindingId: Sha256Digest;
      }
  );

type RegistryProjectionSeed =
  | RegistryNonProtocolProjectionSeed
  | RegistryProtocolProjectionSeed;

type RegistryEnvironmentCatalogEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly contractNamespaceId: Sha256Digest;
    readonly kind: Kind;
    readonly version: string;
    readonly descriptor: Extract<RegistryDescriptor<true>, { readonly kind: Kind }>;
    readonly descriptorDigest: Sha256Digest;
    readonly roleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly implementationBindings: readonly RegistryImplementationBinding<Kind>[];
    readonly dependencyBindings: readonly RegistryDependencyBinding<Kind>[];
    readonly protocolBindings: readonly RegistryProtocolBindingFor<Kind>[];
  };
}[RegistryKind];

interface RegistryEnvironmentCatalogRecord {
  readonly schema: "dathra.registry-environment-catalog/1";
  readonly environment: RuntimeExecutionEnvironment;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly registries: readonly RegistryEnvironmentCatalogEntry[];
  readonly digest: Sha256Digest;
}

type RegistryEnvironmentProjectionEntry = {
  [Kind in RegistryKind]: {
    readonly qualifiedId: QualifiedRegistryId<Kind>;
    readonly kind: Kind;
    readonly activeRoleRequirements: readonly RegistryRoleRequirement<Kind>[];
    readonly selectedImplementationBindings:
      readonly RegistryImplementationBinding<Kind>[];
    readonly selectedDependencyBindings: readonly RegistryDependencyBinding<Kind>[];
  };
}[RegistryKind];

interface RegistryProtocolCatalogRecord {
  readonly schema: "dathra.registry-protocol-catalog/1";
  readonly bindings: readonly RemoteRegistryProtocolBinding[];
  readonly digest: Sha256Digest;
}

interface RegistryCatalogPairCommitment {
  readonly schema: "dathra.registry-catalog-pair/1";
  readonly globalFinalCatalogDigest: Sha256Digest;
  readonly browserCatalogDigest: Sha256Digest;
  readonly serverCatalogDigest: Sha256Digest;
  readonly protocolCatalogDigest: Sha256Digest;
  readonly digest: Sha256Digest;
}

interface RegistryEnvironmentProjectionRecord {
  readonly schema: "dathra.registry-environment-projection/2";
  readonly environment: RuntimeExecutionEnvironment;
  readonly deploymentIdentityDigest: Sha256Digest;
  readonly catalogDigest: Sha256Digest;
  readonly catalogPairCommitmentDigest: Sha256Digest;
  readonly seeds: readonly RegistryProjectionSeed[];
  readonly registries: readonly RegistryEnvironmentProjectionEntry[];
  readonly protocolBindingIds: readonly Sha256Digest[];
  readonly digest: Sha256Digest;
}

interface CompiledFactRecord {
  readonly fact: SemanticFact<true>;
}

interface CompiledRelationRecord {
  readonly relation: SemanticRelation<true>;
}

interface CompiledExecutionContract {
  readonly schema: "dathra.compiled-execution/2";
  readonly sourceContractId: string;
  readonly sourceContractVersion: string;
  readonly namespaceId: Sha256Digest;
  readonly semanticDigest: Sha256Digest;
  readonly sourceModuleContentDigest: Sha256Digest;
  readonly qualifiedFacts: readonly CompiledFactRecord[];
  readonly qualifiedRelations: readonly CompiledRelationRecord[];
  readonly exports: Readonly<Record<string, ExportExecutionContract<true>>>;
  readonly hostAssumptionFactIds: readonly QualifiedFactId[];
  readonly registryUniverse: QualifiedRegistryUniverseRecord;
}

interface CodecContext {
  readonly build: string;
  readonly principal: string;
  readonly policyEpoch: string;
  readonly signal: AbortSignal;
}

interface CodecMaterializationEstimate {
  readonly objectCount: number;
  readonly retainedBytes: number;
  readonly workUnits: number;
}

interface CodecPreflightContext {
  readonly build: string;
  readonly projection: string;
  readonly maxCodecPayloadBytes: number;
}

type CodecMaterializationInstruction =
  | { readonly op: "allocate-object"; readonly prototype: "object" | "null" }
  | { readonly op: "allocate-array"; readonly lengthPath: readonly string[] }
  | { readonly op: "allocate-map" }
  | { readonly op: "allocate-set" }
  | {
      readonly op: "copy-wire-path";
      readonly from: readonly string[];
      readonly to: readonly string[];
    }
  | { readonly op: "finish" };

interface CodecMaterializationProgram {
  readonly schema: "dathra.codec-materialization/1";
  readonly instructions: readonly CodecMaterializationInstruction[];
  readonly maximumObjectCount: number;
  readonly maximumRetainedBytes: number;
  readonly maximumWorkUnits: number;
}

interface TransferCodecBase<Value, Wire extends CodecWireValue> {
  readonly descriptor: CodecRegistryDescriptor<false>;
  capture(value: Value, context: CodecContext): Wire | Promise<Wire>;
}

interface DeclarativeTransferCodec<Value, Wire extends CodecWireValue>
  extends TransferCodecBase<Value, Wire> {
  readonly descriptor: CodecRegistryDescriptor<false> & {
    readonly materializationTrust: "closed-declarative";
  };
  readonly materializationProgram: CodecMaterializationProgram;
}

declare const hostAttestedCodecBrand: unique symbol;

interface HostAttestedTransferCodec<Value, Wire extends CodecWireValue>
  extends TransferCodecBase<Value, Wire> {
  readonly [hostAttestedCodecBrand]: true;
  readonly descriptor: CodecRegistryDescriptor<false> & {
    readonly materializationTrust: "host-attested";
  };
  validateWire(value: unknown): value is Wire;
  preflight(value: Wire, context: CodecPreflightContext): CodecMaterializationEstimate;
  materialize(value: Wire, context: CodecContext): Value | Promise<Value>;
  cleanup?(value: Value, context: CodecContext): void | Promise<void>;
}

type TransferCodec<Value, Wire extends CodecWireValue> =
  | DeclarativeTransferCodec<Value, Wire>
  | HostAttestedTransferCodec<Value, Wire>;

interface ReferenceRequest<Locator extends CodecWireValue> {
  readonly locator: Locator;
  readonly capabilityRef: string | null;
  readonly expectedValueDomainId: QualifiedRegistryId<"value-domain">;
  readonly rootBindingSchemaId: string;
  readonly referenceUseSchemaId: string;
  readonly exposureFactId: QualifiedFactId;
  readonly audiencePolicyId: QualifiedRegistryId<"policy">;
  readonly capabilityPolicyId: QualifiedRegistryId<"policy">;
  readonly authorizationPolicyId: QualifiedRegistryId<"policy">;
  readonly authorizationEvidence: AuthorizationGrantEvidence;
  readonly capabilityEvidence: AuthorizationGrantEvidence | null;
  readonly shareDomainId: string;
}

type ReferenceResult<Value, Failure> =
  | { readonly ok: true; readonly value: Value }
  | { readonly ok: false; readonly error: Failure };

interface ReferenceResolver<Value, Locator extends CodecWireValue, Failure> {
  readonly descriptor: ResolverRegistryDescriptor<false>;
  validateLocator(value: unknown): value is Locator;
  resolve(
    request: ReferenceRequest<Locator>,
    context: CodecContext,
  ): ReferenceResult<Value, Failure> | Promise<ReferenceResult<Value, Failure>>;
  release?(value: Value, context: CodecContext): void | Promise<void>;
}

interface SubscriptionSessionIncarnationPreimage {
  readonly schema: "dathra.subscription-session-incarnation/1";
  readonly coordinatorId: string;
  readonly ownerGenerationId: string;
  readonly sessionIncarnationSequence: string;
}

interface SubscriptionSessionIdentityPreimage {
  readonly schema: "dathra.subscription-session/1";
  readonly sessionIncarnationId: string;
  readonly transportContinuityId: string;
  readonly subscriptionUseSchemaId: string;
  readonly shareDomainId: string;
  readonly ownerGenerationId: string;
  readonly authorizationGenerationId: string;
  readonly audienceEvaluationDigest: Sha256Digest;
  readonly capabilityBindingDigest: Sha256Digest;
}

interface SubscriptionTransportContinuityPreimage {
  readonly schema: "dathra.subscription-continuity/1";
  readonly sourceQualifiedId: QualifiedRegistryId<"subscription-source">;
  readonly canonicalLocatorDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly sequenceNamespaceId: string;
}

interface SubscriptionSequenceNamespacePreimage {
  readonly schema: "dathra.subscription-namespace/1";
  readonly sourceQualifiedId: QualifiedRegistryId<"subscription-source">;
  readonly canonicalLocatorDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly namespaceDomainId: string;
  readonly sequenceEpochId: string;
}

interface SubscriptionSequenceNamespaceAttestation {
  readonly issuerId: string;
  readonly preimage: SubscriptionSequenceNamespacePreimage;
  readonly namespaceId: string;
  readonly proof: CodecWireValue;
}

declare const verifiedSubscriptionNamespaceBrand: unique symbol;

interface VerifiedSubscriptionSequenceNamespace {
  readonly [verifiedSubscriptionNamespaceBrand]: true;
  readonly preimage: SubscriptionSequenceNamespacePreimage;
  readonly namespaceId: string;
  readonly attestationDigest: Sha256Digest;
}

declare const subscriptionNamespaceAuthorityBrand: unique symbol;

interface SubscriptionNamespaceAuthority {
  readonly [subscriptionNamespaceAuthorityBrand]: true;
  readonly issuerId: string;
  readonly attestationId: string;
  verify(
    attestation: SubscriptionSequenceNamespaceAttestation,
    expectedSourceQualifiedId: QualifiedRegistryId<"subscription-source">,
    expectedCanonicalLocatorDigest: Sha256Digest,
    expectedPrincipalContextId: string,
    expectedNamespaceDomainId: string,
  ): VerifiedSubscriptionSequenceNamespace | null;
}

declare const subscriptionAdmissionTokenBrand: unique symbol;

interface SubscriptionAdmissionToken {
  readonly [subscriptionAdmissionTokenBrand]: true;
  readonly claimId: string;
  readonly terminalDeadline: number;
}

interface SubscriptionRuntimeRequestContext {
  readonly ownerGenerationId: string;
  readonly sessionIncarnationId: string;
  readonly rootBindingSchemaId: string;
  readonly subscriptionUseSchemaId: string;
}

interface SubscriptionTransportOpenRequest<Locator extends CodecWireValue> {
  readonly locator: Locator;
  readonly authorizationEvidence: AuthorizationGrantEvidence;
  readonly capabilityEvidence: AuthorizationGrantEvidence | null;
  readonly admission: SubscriptionAdmissionToken;
  readonly signal: AbortSignal;
}

interface SubscriptionTransportResumeRequest<Locator extends CodecWireValue, Value>
  extends SubscriptionTransportOpenRequest<Locator> {
  readonly expectedTransportContinuityId: string;
  readonly expectedSequenceNamespaceId: string;
  readonly initialSnapshot: Value;
  readonly snapshotRevision: string;
  readonly logBoundaryCursor: CodecWireValue;
}

interface SubscriptionLocalResyncCommand {
  readonly expectedOldSessionIdentityDigest: Sha256Digest;
  readonly expectedOldTransportContinuityId: string;
  readonly expectedOldSequenceNamespaceId: string;
  readonly newAuthorizationGenerationId: string;
}

interface SubscriptionTransportResyncRequest<Locator extends CodecWireValue>
  extends SubscriptionTransportOpenRequest<Locator> {
  readonly expectedOldTransportContinuityId: string;
  readonly expectedOldSequenceNamespaceId: string;
  readonly newAuthorizationGenerationId: string;
}

interface SubscriptionTransportRevisionEnvelope<Wire extends CodecWireValue> {
  readonly schema: "dathra.subscription-revision/1";
  readonly transportContinuityId: string;
  readonly sequenceNamespaceId: string;
  readonly sequence: string;
  readonly baseRevision: string;
  readonly revision: string;
  readonly cursor: CodecWireValue;
  readonly payload: Wire;
  readonly payloadDigest: Sha256Digest;
}

type SubscriptionTransportEvent<Wire extends CodecWireValue, Failure> =
  | {
      readonly kind: "revision";
      readonly envelope: SubscriptionTransportRevisionEnvelope<Wire>;
    }
  | { readonly kind: "gap"; readonly expectedSequence: string; readonly receivedSequence: string }
  | { readonly kind: "cursor-expired" }
  | { readonly kind: "typed-failure"; readonly error: Failure };

interface SubscriptionRuntimeEventEnvelope<Wire extends CodecWireValue, Failure> {
  readonly schema: "dathra.subscription-runtime-event/1";
  readonly capturedOwnerGenerationId: string;
  readonly capturedSessionIdentityDigest: Sha256Digest;
  readonly transportEvent: SubscriptionTransportEvent<Wire, Failure>;
}

type SubscriptionEvent<Wire extends CodecWireValue, Failure> =
  SubscriptionRuntimeEventEnvelope<Wire, Failure>;

interface SubscriptionTransportSession<Wire extends CodecWireValue, Failure> {
  readonly transportSessionId: string;
  readonly transportContinuityId: string;
  readonly sequenceNamespace: SubscriptionSequenceNamespaceAttestation;
  next(signal: AbortSignal): Promise<SubscriptionTransportEvent<Wire, Failure>>;
  acknowledge(sequence: string, cursor: CodecWireValue): Promise<void>;
  close(): Promise<void>;
}

interface SubscriptionSession<Value, Wire extends CodecWireValue, Failure> {
  readonly identity: SubscriptionSessionIdentityPreimage;
  readonly capturedOwnerGenerationId: string;
  readonly budgetClaimId: string;
  readonly terminalDeadline: number;
  readonly initialSnapshot: Value;
  readonly snapshotRevision: string;
  readonly logBoundaryCursor: CodecWireValue;
  next(signal: AbortSignal): Promise<SubscriptionEvent<Wire, Failure>>;
  acknowledge(sequence: string, cursor: CodecWireValue): Promise<void>;
  close(): Promise<void>;
}

type SubscriptionTransportOpenResult<Value, Wire extends CodecWireValue, Failure> =
  | {
      readonly ok: true;
      readonly initialSnapshot: Value;
      readonly snapshotRevision: string;
      readonly logBoundaryCursor: CodecWireValue;
      readonly transport: SubscriptionTransportSession<Wire, Failure>;
    }
  | { readonly ok: false; readonly error: Failure };

interface SubscriptionSource<
  Value,
  Locator extends CodecWireValue,
  RevisionWire extends CodecWireValue,
  Failure,
> {
  readonly descriptor: SubscriptionSourceRegistryDescriptor<false>;
  validateLocator(value: unknown): value is Locator;
  open(
    request: SubscriptionTransportOpenRequest<Locator>,
    context: CodecContext,
  ): Promise<SubscriptionTransportOpenResult<Value, RevisionWire, Failure>>;
  resume(
    request: SubscriptionTransportResumeRequest<Locator, Value>,
    context: CodecContext,
  ): Promise<SubscriptionTransportOpenResult<Value, RevisionWire, Failure>>;
  resync(
    request: SubscriptionTransportResyncRequest<Locator>,
    context: CodecContext,
  ): Promise<SubscriptionTransportOpenResult<Value, RevisionWire, Failure>>;
}

type RemoteDeliveryContract<Qualified extends boolean = false> =
  | { readonly kind: "single-attempt" }
  | {
      readonly kind: "idempotent";
      readonly keyPolicyId: RegistryReference<"policy", Qualified>;
      readonly horizonMs: number;
    }
  | {
      readonly kind: "transactional";
      readonly ledgerPolicyId: RegistryReference<"policy", Qualified>;
      readonly horizonMs: number;
    };

interface RemoteOperationContract<
  Input,
  Output,
  Failure,
  InputWire extends CodecWireValue,
  OutputWire extends CodecWireValue,
  FailureWire extends CodecWireValue,
> {
  readonly descriptor: RemoteOperationRegistryDescriptor<false>;
  readonly inputCodec: TransferCodec<Input, InputWire>;
  readonly outputCodec: TransferCodec<Output, OutputWire>;
  readonly failureCodec: TransferCodec<Failure, FailureWire>;
  readonly cancellation: "before-commit" | "best-effort-after-commit";
}

interface RemoteContext {
  readonly principal: string;
  readonly operationId: string;
  readonly requestCommitment: Sha256Digest;
  readonly policyEpoch: string;
  readonly authorizationGenerationId: string;
  readonly authorizationCutId: string;
  readonly signal: AbortSignal;
  readonly transaction: RemoteAtomicTransaction | null;
}

declare function factId(value: string): FactId;

declare function registryId<Kind extends RegistryKind>(
  kind: Kind,
  value: string,
): RegistryId<Kind>;

declare function defineExecutionContract(
  contract: ExecutionContractSource,
): ExecutionContractSource;

declare function defineRegistryDescriptor<Descriptor extends RegistryDescriptor<false>>(
  descriptor: Descriptor,
): Descriptor;

declare function definePolicyEvaluator(evaluator: PolicyEvaluator): PolicyEvaluator;
declare function defineValueDomainValidator(
  validator: ValueDomainValidator,
): ValueDomainValidator;
declare function defineFailureSchemaAdapter(
  adapter: FailureSchemaAdapter,
): FailureSchemaAdapter;
declare function defineHostProfileValidator(
  validator: HostProfileValidator,
): HostProfileValidator;
declare function defineBrandValidator(validator: BrandValidator): BrandValidator;

declare function defineTransferCodec<Value, Wire extends CodecWireValue>(
  codec: TransferCodec<Value, Wire>,
): TransferCodec<Value, Wire>;

declare function defineReferenceResolver<Value, Locator extends CodecWireValue, Failure>(
  resolver: ReferenceResolver<Value, Locator, Failure>,
): ReferenceResolver<Value, Locator, Failure>;

declare function defineSubscriptionSource<
  Value,
  Locator extends CodecWireValue,
  RevisionWire extends CodecWireValue,
  Failure,
>(
  source: SubscriptionSource<Value, Locator, RevisionWire, Failure>,
): SubscriptionSource<Value, Locator, RevisionWire, Failure>;

interface RemoteCallOptions {
  readonly signal?: AbortSignal;
}

interface RemoteCallAttemptIdentityPreimage {
  readonly schema: "dathra.remote-call-attempt/1";
  readonly coordinatorId: string;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly principalContextId: string;
  readonly localAttemptSequence: string;
}

type RemotePreAdmissionSystemFailure =
  | { readonly code: "capture-failed" }
  | { readonly code: "capture-codec-unavailable" }
  | { readonly code: "authorization-denied" }
  | { readonly code: "admission-unavailable" }
  | { readonly code: "internal-failure" };

type RemotePreAdmissionOutcome = {
  readonly attemptId: string;
  readonly operationId: null;
} &
  (
    | {
        readonly kind: "cancelled";
        readonly phase: "before-capture" | "during-capture" | "before-admission";
      }
    | { readonly kind: "system-failure"; readonly error: RemotePreAdmissionSystemFailure }
  );

interface RemoteOperationIdentityPreimage {
  readonly schema: "dathra.remote-operation-identity/1";
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly requestCommitment: Sha256Digest;
  readonly principalContextId: string;
  readonly authorizationEvaluationDigest: Sha256Digest;
  readonly authorizationGrantId: string;
  readonly authorizationGenerationId: string;
  readonly issuerEpoch: string;
  readonly sequence: string;
  readonly admissionExpiresAt: number;
}

type RemoteWireEncoding = "dathra.remote-jcs-utf8/1";

type RemoteWireMessageKind =
  | "admission-request"
  | "admission-response"
  | "execution-request"
  | "execution-response";

interface RemoteWireFrame {
  readonly encoding: RemoteWireEncoding;
  readonly messageKind: RemoteWireMessageKind;
  readonly exactBytes: Uint8Array;
  readonly exactByteLength: number;
  readonly exactDigest: Sha256Digest;
}

interface RemoteProtocolBudget {
  readonly maxRawFrameBytes: number;
  readonly maxCanonicalMessageBytes: number;
  readonly maxJsonDepth: number;
  readonly maxAuthorizationEvidenceBytes: number;
  readonly maxCapturedWireBytes: number;
  readonly maxResponsePayloadBytes: number;
  readonly maxMaterializedInputBytes: number;
  readonly maxMaterializedOutputBytes: number;
  readonly maxCodecWorkUnits: number;
  readonly maxConcurrentDecodes: number;
}

interface RemoteRequestCommitmentPreimage {
  readonly schema: "dathra.remote-request-commitment/1";
  readonly wireEncoding: RemoteWireEncoding;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly inputCodecQualifiedId: QualifiedRegistryId<"codec">;
  readonly inputCodecVersion: string;
  readonly wireSchemaDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationEvaluationDigest: Sha256Digest;
  readonly authorizationGrantId: string;
  readonly authorizationGenerationId: string;
  readonly capturedWireCanonicalDigest: Sha256Digest;
  readonly capturedWireCanonicalByteLength: number;
}

declare const remoteCapturedRequestBrand: unique symbol;

type RawRemoteCapturedRequestWire = Readonly<Record<string, unknown>>;

interface RemoteCapturedRequestWire<Wire extends CodecWireValue> {
  readonly schema: "dathra.remote-captured-request/1";
  readonly commitment: Sha256Digest;
  readonly preimage: RemoteRequestCommitmentPreimage;
  readonly capturedWire: Wire;
}

interface RemoteCapturedRequest<Wire extends CodecWireValue> {
  readonly [remoteCapturedRequestBrand]: true;
  readonly commitment: Sha256Digest;
  readonly preimage: RemoteRequestCommitmentPreimage;
  readonly capturedWire: Wire;
  readonly canonicalCapturedWireBytes: Uint8Array;
}

declare const remoteAuthorizationCutBrand: unique symbol;

interface RemoteAuthorizationCut {
  readonly [remoteAuthorizationCutBrand]: true;
  readonly id: string;
  readonly operationId: string;
  readonly requestCommitment: Sha256Digest;
  readonly authorizationEvaluationDigest: Sha256Digest;
  readonly authorizationGrantId: string;
  readonly authorizationGenerationId: string;
  readonly admittedAt: number;
}

interface RemoteLedgerBudget {
  readonly maxInFlightOperations: number;
  readonly maxTerminalRecords: number;
  readonly maxTerminalBytes: number;
  readonly maxSequenceGap: number;
}

interface RemoteOperationHighWatermark {
  readonly schema: "dathra.remote-operation-watermark/1";
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly principalContextId: string;
  readonly issuerEpoch: string;
  readonly replayRejectedThroughSequence: string;
  readonly terminalEvidenceDiscardedThroughSequence: string;
}

type RemoteApplicationResult<Output, Failure> =
  | { readonly ok: true; readonly value: Output }
  | { readonly ok: false; readonly error: Failure };

type RemoteSystemFailure = { readonly commit: "not-committed" } &
  (
    | { readonly code: "authorization-denied" }
    | { readonly code: "transport-unavailable" }
    | { readonly code: "integrity-failed" }
    | { readonly code: "protocol-violation" }
    | { readonly code: "codec-failed" }
    | { readonly code: "version-mismatch" }
      | { readonly code: "internal-failure" }
  );

declare const remoteAtomicTransactionBrand: unique symbol;
declare const remoteAdapterCommitReceiptBrand: unique symbol;
declare const remoteAdapterNonCommitReceiptBrand: unique symbol;
declare const verifiedRemoteCommitReceiptBrand: unique symbol;
declare const verifiedRemoteNonCommitReceiptBrand: unique symbol;

interface RemoteAtomicTransaction {
  readonly [remoteAtomicTransactionBrand]: true;
  readonly operationId: string;
  readonly requestCommitment: Sha256Digest;
  stage(effectQualifiedId: QualifiedFactId, input: CodecWireValue): Promise<CodecWireValue>;
}

interface RemoteProtocolProof {
  readonly issuerId: string;
  readonly protocolBindingId: Sha256Digest;
  readonly verifierProfileId: string;
  readonly endpointIdentity: Sha256Digest;
  readonly serverDeploymentIdentityDigest: Sha256Digest;
  readonly proofSequence: string;
  readonly issuedAt: number;
  readonly expiresAt: number;
  readonly messageDigest: Sha256Digest;
  readonly proof: CodecWireValue;
}

interface RemoteCommitReceiptRecord {
  readonly adapterQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly operationId: string;
  readonly issuerEpoch: string;
  readonly operationSequence: string;
  readonly admissionExpiresAt: number;
  readonly requestCommitment: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationEvaluationDigest: Sha256Digest;
  readonly authorizationGrantId: string;
  readonly authorizationGenerationId: string;
  readonly authorizationCutId: string;
  readonly ledgerEntryDigest: Sha256Digest;
  readonly effectSetDigest: Sha256Digest;
  readonly terminalDigest: Sha256Digest;
  readonly commitEpoch: string;
  readonly expiresAt: number;
}

interface RemoteAdapterCommitReceipt extends RemoteCommitReceiptRecord {
  readonly [remoteAdapterCommitReceiptBrand]: true;
}

interface RemoteCommitReceiptWire extends RemoteCommitReceiptRecord {
  readonly schema: "dathra.remote-commit-receipt/1";
  readonly proof: RemoteProtocolProof;
}

interface VerifiedRemoteCommitReceipt {
  readonly [verifiedRemoteCommitReceiptBrand]: true;
  readonly wire: RemoteCommitReceiptWire;
  readonly verifiedAt: number;
}

type RemoteNonCommitTerminal =
  | { readonly kind: "cancelled-before-commit" }
  | { readonly kind: "expired"; readonly horizonMs: number }
  | { readonly kind: "system-failure"; readonly error: RemoteSystemFailure };

interface RemoteNonCommitReceiptRecord {
  readonly adapterQualifiedId: QualifiedRegistryId<"remote-delivery-adapter">;
  readonly operationId: string;
  readonly issuerEpoch: string;
  readonly operationSequence: string;
  readonly admissionExpiresAt: number;
  readonly requestCommitment: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationEvaluationDigest: Sha256Digest;
  readonly authorizationGrantId: string;
  readonly authorizationGenerationId: string;
  readonly authorizationCutId: string | null;
  readonly observedLedgerEpoch: string;
  readonly terminalFenceId: string;
  readonly terminal: RemoteNonCommitTerminal;
  readonly terminalDigest: Sha256Digest;
  readonly ledgerEntryDigest: Sha256Digest;
  readonly expiresAt: number;
}

interface RemoteAdapterNonCommitReceipt extends RemoteNonCommitReceiptRecord {
  readonly [remoteAdapterNonCommitReceiptBrand]: true;
}

interface RemoteNonCommitReceiptWire extends RemoteNonCommitReceiptRecord {
  readonly schema: "dathra.remote-non-commit-receipt/1";
  readonly proof: RemoteProtocolProof;
}

interface VerifiedRemoteNonCommitReceipt {
  readonly [verifiedRemoteNonCommitReceiptBrand]: true;
  readonly wire: RemoteNonCommitReceiptWire;
  readonly verifiedAt: number;
}

interface RemoteDeliveryRequest<InputWire extends CodecWireValue> {
  readonly capturedRequest: RemoteCapturedRequest<InputWire>;
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly operationId: string;
  readonly operationIdentity: RemoteOperationIdentityPreimage;
  readonly requestCommitment: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationCut: RemoteAuthorizationCut;
  readonly signal: AbortSignal;
}

interface RemoteAdmissionRequest {
  readonly operationQualifiedId: QualifiedRegistryId<"remote-operation">;
  readonly requestCommitment: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly authorizationEvaluationDigest: Sha256Digest;
  readonly authorizationEvidence: AuthorizationGrantEvidence;
  readonly requestedExpiresAt: number;
}

type RemoteAdmissionResult =
  | {
      readonly ok: true;
      readonly operationId: string;
      readonly identity: RemoteOperationIdentityPreimage;
    }
  | {
      readonly ok: false;
      readonly rejectionOperationId: string;
      readonly error: RemoteSystemFailure;
    };

interface RemoteWireAdmissionRequest<InputWire extends CodecWireValue> {
  readonly schema: "dathra.remote-wire-admission/1";
  readonly protocolBindingId: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly attemptId: string;
  readonly capturedRequest: RemoteCapturedRequestWire<InputWire>;
  readonly authorizationEvidence: RemoteAuthorizationEvidenceWire;
  readonly requestedExpiresAt: number;
}

type RemoteWireAdmissionResponse =
  | {
      readonly ok: true;
      readonly protocolBindingId: Sha256Digest;
      readonly endpointIdentity: Sha256Digest;
      readonly attemptId: string;
      readonly operationId: string;
      readonly operationIdentity: RemoteOperationIdentityPreimage;
      readonly protocolDigest: Sha256Digest;
      readonly proof: RemoteProtocolProof;
    }
  | {
      readonly ok: false;
      readonly protocolBindingId: Sha256Digest;
      readonly endpointIdentity: Sha256Digest;
      readonly attemptId: string;
      readonly error: RemotePreAdmissionSystemFailure;
      readonly protocolDigest: Sha256Digest;
      readonly proof: RemoteProtocolProof;
    };

interface RemoteWireExecutionRequest<InputWire extends CodecWireValue> {
  readonly schema: "dathra.remote-wire-execution/1";
  readonly protocolBindingId: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly attemptId: string;
  readonly operationId: string;
  readonly operationIdentity: RemoteOperationIdentityPreimage;
  readonly capturedRequest: RemoteCapturedRequestWire<InputWire>;
  readonly authorizationEvidence: RemoteAuthorizationEvidenceWire;
}

interface RemoteWireExecutionResponse<
  OutputWire extends CodecWireValue,
  FailureWire extends CodecWireValue,
> {
  readonly schema: "dathra.remote-wire-response/1";
  readonly protocolBindingId: Sha256Digest;
  readonly endpointIdentity: Sha256Digest;
  readonly attemptId: string;
  readonly operationId: string;
  readonly requestCommitment: Sha256Digest;
  readonly attempt: RemoteWireAdapterAttempt<OutputWire, FailureWire>;
  readonly protocolDigest: Sha256Digest;
  readonly proof: RemoteProtocolProof;
}

type RemoteDecodedWireMessage =
  | RemoteWireAdmissionRequest<CodecWireValue>
  | RemoteWireAdmissionResponse
  | RemoteWireExecutionRequest<CodecWireValue>
  | RemoteWireExecutionResponse<CodecWireValue, CodecWireValue>;

declare const verifiedRemoteWireMessageBrand: unique symbol;
declare const remoteProtocolCodecBrand: unique symbol;

interface VerifiedRemoteWireMessage {
  readonly [verifiedRemoteWireMessageBrand]: true;
  readonly message: RemoteDecodedWireMessage;
  readonly canonicalDigest: Sha256Digest;
  readonly canonicalByteLength: number;
  readonly jsonDepth: number;
}

interface RemoteProtocolCodec {
  readonly [remoteProtocolCodecBrand]: true;
  readonly attestationId: string;
  encode(message: RemoteDecodedWireMessage, budget: RemoteProtocolBudget): RemoteWireFrame | null;
  decode(
    frame: RemoteWireFrame,
    expectedKind: RemoteWireMessageKind,
    budget: RemoteProtocolBudget,
  ): VerifiedRemoteWireMessage | null;
}

interface RemoteClientTransport {
  admit(
    frame: RemoteWireFrame,
    signal: AbortSignal,
  ): Promise<RemoteWireFrame>;
  execute(
    frame: RemoteWireFrame,
    signal: AbortSignal,
  ): Promise<RemoteWireFrame>;
}

interface RemoteClientReceiptVerifier<
  OutputWire extends CodecWireValue,
  FailureWire extends CodecWireValue,
> {
  verifyAdmission(
    responseFrame: RemoteWireFrame,
    expectedProtocolBindingId: Sha256Digest,
    expectedEndpointIdentity: Sha256Digest,
    expectedAttemptId: string,
    expectedCommitment: Sha256Digest,
  ): RemoteWireAdmissionResponse | null;
  verifyExecution(
    responseFrame: RemoteWireFrame,
    expectedProtocolBindingId: Sha256Digest,
    expectedEndpointIdentity: Sha256Digest,
    expectedAttemptId: string,
    expectedOperation: RemoteOperationIdentityPreimage,
    expectedCommitment: Sha256Digest,
  ): RemoteVerifiedAdapterAttempt<OutputWire, FailureWire> | null;
}

interface RemoteServerEndpoint {
  admit(
    requestFrame: RemoteWireFrame,
    signal: AbortSignal,
  ): Promise<RemoteWireFrame>;
  execute(
    requestFrame: RemoteWireFrame,
    signal: AbortSignal,
  ): Promise<RemoteWireFrame>;
}

type RemoteCommittedTerminal<Output, Failure> =
  | {
      readonly kind: "application-result";
      readonly result: RemoteApplicationResult<Output, Failure>;
    }
  | { readonly kind: "cancelled-after-commit" };

type RemoteWireAdapterAttempt<OutputWire extends CodecWireValue, FailureWire extends CodecWireValue> =
  | {
      readonly kind: "committed";
      readonly receipt: RemoteCommitReceiptWire;
      readonly terminal: RemoteCommittedTerminal<OutputWire, FailureWire>;
    }
  | {
      readonly kind: "not-committed";
      readonly receipt: RemoteNonCommitReceiptWire;
    }
  | {
      readonly kind: "ambiguous";
      readonly reason:
        | "transport-outcome-unknown"
        | "result-integrity-unknown"
        | "cancel-after-commit-unknown"
        | "ledger-unavailable"
        | "terminal-evidence-expired";
    };

type RemoteServerAdapterAttempt<Output, Failure> =
  | {
      readonly kind: "committed";
      readonly receipt: RemoteAdapterCommitReceipt;
      readonly terminal: RemoteCommittedTerminal<Output, Failure>;
    }
  | {
      readonly kind: "not-committed";
      readonly receipt: RemoteAdapterNonCommitReceipt;
    }
  | {
      readonly kind: "ambiguous";
      readonly reason:
        | "transport-outcome-unknown"
        | "result-integrity-unknown"
        | "cancel-after-commit-unknown"
        | "ledger-unavailable"
        | "terminal-evidence-expired";
    };

type RemoteVerifiedAdapterAttempt<
  OutputWire extends CodecWireValue,
  FailureWire extends CodecWireValue,
> =
  | {
      readonly kind: "committed";
      readonly receipt: VerifiedRemoteCommitReceipt;
      readonly terminal: RemoteCommittedTerminal<OutputWire, FailureWire>;
    }
  | {
      readonly kind: "not-committed";
      readonly receipt: VerifiedRemoteNonCommitReceipt;
    }
  | {
      readonly kind: "ambiguous";
      readonly reason:
        | "transport-outcome-unknown"
        | "result-integrity-unknown"
        | "cancel-after-commit-unknown"
        | "ledger-unavailable"
        | "terminal-evidence-expired";
    };

interface RemoteDeliveryAdapter<
  Input,
  InputWire extends CodecWireValue,
  Output,
  Failure,
> {
  readonly descriptor: RemoteDeliveryAdapterRegistryDescriptor<false>;
  reserve(
    request: RemoteAdmissionRequest,
    signal: AbortSignal,
  ): Promise<RemoteAdmissionResult>;
  rejectBeforeEffect(
    request: Omit<RemoteDeliveryRequest<InputWire>, "authorizationCut" | "signal">,
    terminal: RemoteNonCommitTerminal,
    signal: AbortSignal,
  ): Promise<RemoteAdapterNonCommitReceipt>;
  execute(
    request: RemoteDeliveryRequest<InputWire>,
    run: (
      input: Input,
      transaction: RemoteAtomicTransaction | null,
    ) => Promise<RemoteApplicationResult<Output, Failure>>,
  ): Promise<RemoteServerAdapterAttempt<Output, Failure>>;
  recover(
    request: Omit<RemoteDeliveryRequest<InputWire>, "signal">,
    signal: AbortSignal,
  ): Promise<RemoteServerAdapterAttempt<Output, Failure>>;
}

type RemoteCertainOutcome<Output, Failure> = {
  readonly attemptId: string;
  readonly operationId: string;
} &
  (
    | { readonly kind: "success"; readonly value: Output }
    | { readonly kind: "application-failure"; readonly error: Failure }
    | { readonly kind: "cancelled"; readonly phase: "before-commit" | "after-commit" }
    | { readonly kind: "expired"; readonly horizonMs: number }
    | { readonly kind: "system-failure"; readonly error: RemoteSystemFailure }
  );

type RemoteAmbiguityReason =
  | "transport-outcome-unknown"
  | "result-integrity-unknown"
  | "cancel-after-commit-unknown"
  | "ledger-unavailable"
  | "terminal-evidence-expired";

interface RemoteAmbiguitySnapshot {
  readonly attemptId: string;
  readonly operationId: string;
  readonly requestCommitment: Sha256Digest;
  readonly reason: RemoteAmbiguityReason;
}

type RecoverableRemoteAmbiguitySnapshot = RemoteAmbiguitySnapshot & {
  readonly reason: Exclude<RemoteAmbiguityReason, "terminal-evidence-expired">;
};

type RecoveryAttemptFailure =
  | { readonly code: "authorization-denied" }
  | { readonly code: "capability-expired" }
  | { readonly code: "transport-unavailable" }
  | { readonly code: "integrity-failed" }
  | { readonly code: "ledger-unavailable" }
  | { readonly code: "protocol-violation" };

type RecoveryAttemptResult<Output, Failure> =
  | {
      readonly kind: "resolved";
      readonly outcome: RemoteCertainOutcome<Output, Failure>;
    }
  | {
      readonly kind: "still-ambiguous";
      readonly original: RecoverableRemoteAmbiguitySnapshot;
      readonly attemptFailure: RecoveryAttemptFailure;
    };

declare const remoteRecoveryCapabilityBrand: unique symbol;

type RemoteRecoveryCapability<Output, Failure> = {
  readonly [remoteRecoveryCapabilityBrand]: true;
  readonly original: RecoverableRemoteAmbiguitySnapshot;
} &
  (
    | {
      readonly kind: "retry-same-operation" | "query-ledger";
      readonly operationId: string;
      readonly requestCommitment: Sha256Digest;
      readonly principalContextId: string;
      readonly policyEpoch: string;
      readonly expiresAt: number;
      recover(): Promise<RecoveryAttemptResult<Output, Failure>>;
    }
    | {
        readonly kind: "manual-reconciliation";
        readonly operationId: string;
        readonly requestCommitment: Sha256Digest;
        readonly principalContextId: string;
        readonly policyEpoch: string;
        readonly expiresAt: number;
        reconcile(evidence: CodecWireValue): Promise<RecoveryAttemptResult<Output, Failure>>;
      }
  );

type RemoteOutcome<Output, Failure> =
  | RemotePreAdmissionOutcome
  | RemoteCertainOutcome<Output, Failure>
  | (RecoverableRemoteAmbiguitySnapshot & {
      readonly kind: "ambiguous";
      readonly recovery: RemoteRecoveryCapability<Output, Failure> | null;
    })
  | (RemoteAmbiguitySnapshot & {
      readonly kind: "ambiguous";
      readonly reason: "terminal-evidence-expired";
      readonly recovery: null;
    });

interface RemoteOperation<Input, Output, Failure> {
  readonly descriptor: RemoteOperationRegistryDescriptor<false>;
  (input: Input, options?: RemoteCallOptions): Promise<RemoteOutcome<Output, Failure>>;
}

declare function defineRemoteOperation<
  Input,
  Output,
  Failure,
  InputWire extends CodecWireValue,
  OutputWire extends CodecWireValue,
  FailureWire extends CodecWireValue,
>(
  contract: RemoteOperationContract<
    Input,
    Output,
    Failure,
    InputWire,
    OutputWire,
    FailureWire
  >,
  handler: (
    input: Input,
    context: RemoteContext,
  ) => Promise<RemoteApplicationResult<Output, Failure>>,
): RemoteOperation<Input, Output, Failure>;

declare function defineRemoteDeliveryAdapter<
  Input,
  InputWire extends CodecWireValue,
  Output,
  Failure,
>(
  adapter: RemoteDeliveryAdapter<Input, InputWire, Output, Failure>,
): RemoteDeliveryAdapter<Input, InputWire, Output, Failure>;
```

package と application は、`dathra.contract.ts` の default export に `defineExecutionContract()` の result を置く。
各 RegistrySourceEntry は descriptor locator と、environment/role ごとの implementation locator を別々に持つ。
locator は named export または content-bound dependency manifest の export を参照する。
codec、resolver、subscription source、remote operation、remote delivery adapter は対応する `define*` helper の result を role implementation として参照し、それ以外は registry kind ごとの versioned descriptor export と executable role export を分ける。
compiler は specifier を contract module 基準で解決し、descriptor の kind、`id`、`version`、schema と各 role export の interface schema が RegistrySourceEntry に一致することを確認して CompiledExecutionContract へ digest を付ける。
複数 role が同じ `defineRemoteOperation()` などの definition export から導出される場合、compiler は environment ごとの virtual module と role export を先に生成する。
QualifiedRegistryUniverseEntry の symbolic implementation binding は元の aggregate export ではなく生成後の role export を指し、role closure を分離できない definition は diagnostic とする。
registry key、FactId、export fact reference は重複、dangling reference、kind mismatch を許さない。
ExportExecutionContract の直接 field と参照先 fact が同じ意味を重複して宣言した場合は、値が一致しなければ diagnostic とする。
`factId()` と `registryId()` の引数は contract file 内の build-time string literal に限定する。

FactId と RegistryId は ExecutionContractSource 内だけで一意な local ID である。
compiler は dependency contract graph の strongly connected component を collapse する。
各 contract SCC ID は member の canonical source contract、canonical source module ID、source content digest、member ordinal、condensation DAG の outgoing contract namespace ID から作り、各 member の compiled contract semantic digest と namespace ID を SCC ID と member ordinal から導出する。
local ID を namespace で修飾した QualifiedFactId と QualifiedRegistryId だけを manifest、wire、runtime graph へ出す。
ArtifactAddressId と exact-byte artifact digest は namespace ID の入力にしないため、contract qualification は bundling candidate に依存せず、artifact integrity との自己参照も発生しない。

SemanticSubject は fact の適用先を一意にする。
parameter index、callback parameter、return path、allocation site、export name が実際の export signature と semantic summary に存在しない場合は diagnostic とする。
SemanticPathSegment の tuple index は非負 safe integer とし、`element` は contract が homogeneous collection と宣言した value domain だけで使える。
SemanticRelation の endpoint は同じ source contract の fact に解決し、relation kind と両 subject の組み合わせを typed schema で検証する。
compiler は SemanticFact、SemanticRelation、ExportExecutionContract の全 nested FactReference と RegistryReference を再帰的に qualified form へ変換する。
CompiledExecutionContract は ExecutionContractSource を継承せず、`SemanticFact<true>`、`SemanticRelation<true>`、`ExportExecutionContract<true>` だけを保持する。
source-local ID を含む contract は build/debug input にだけ残し、ProjectionManifestCore と runtime artifact へ出さない。

各 RegistryDescriptor は `dathra.registry/1` の kind ごとの closed schema を持つ。
metadata-only descriptor は `defineRegistryDescriptor()` で宣言し、runtime で使う policy、value-domain、failure-schema、host-profile、brand は kind ごとの `define*` helper で executable implementation を宣言する。
codec、resolver、subscription source、remote operation、remote delivery adapter も対応する executable helper の result を使う。
compiler は RegistrySourceEntry の source implementation export が対応 interface を満たすことを検証し、descriptor 内の全 nested RegistryReference を qualified ID へ変換する。
その後、SC03 は operation 単位に closed RegistryRoleRequirement、symbolic implementation binding、同一環境 dependency、cross-environment protocol template を生成する。
AF01 は deployment と artifact finalization 後に symbolic binding と protocol template を final implementation binding と protocol binding へ解決する。
role の許可範囲と requirement は次の表を正本とする。

| registry kind | environment と role | requirement |
| --- | --- | --- |
| codec | runtime environment の capture/materialize | request graph が使う方向だけ必須 |
| resolver | runtime environment の resolve | reference demand から到達する場合に必須 |
| subscription-source | server-request または browser の open、browser の resume/resync | SSR、client-only initial render、handoff/resync の利用形態ごとに必須 |
| policy | runtime environment の evaluate | policy fact から到達する場合に必須 |
| value-domain、failure-schema、host-profile、brand | runtime environment の各 validator/adaptor | consumer role から到達する場合に必須 |
| remote-operation | browser の transport/verifier、server-request の endpoint/handler | browser callable を公開する operation では 4 role すべて必須 |
| remote-delivery-adapter | server-request の delivery | remote operation から参照された場合に一つだけ必須 |

この表にない kind、environment、role の組は source entry の時点で diagnostic とする。
required role に実装がない場合、または同じ `(qualified registry ID, environment, role)` に複数実装がある場合も diagnostic とする。
selected owner の required role と、reason が到達した request-reachable role を final projection に残し、到達しない optional implementation を artifact closure へ入れない。
RegistryProtocolBinding は remote-operation entry だけが持てる。
ほかの registry kind の protocolBindings は型上 `never[]` であり、runtime record では空配列にする。

#### registry qualification と environment catalog の補足決定

この節は、旧 `RegistryEnvironmentProjectionRecord/1`、`CompiledExecutionContract/1`、flat binding array、component ごとの暗黙 owner 対応を supersede する。
後方互換 layer は設けない。

`RegistryId<Kind>` は source contract 内だけで有効な non-empty string とし、lone surrogate を拒否するが Unicode normalization は行わない。
`QualifiedRegistryId<Kind>` は `dathra.qualified-id/1` の kind field を `registry:${Kind}` とした digest である。
SC03 は namespace digest、domain、local ID から qualified ID を再計算し、source-local reference をすべて qualified form へ変換する。
runtime は digest-shaped local string の由来を文字列だけから推測せず、canonical digest shape、schema context、catalog の ID-to-kind membership、nested reference resolution を検証する。
source-local ID が final artifact へ残らないことの証明責務は SC03 qualification と artifact inspection に置く。
wire decoder が受け取る未検証 field は `unknown` または専用 `Raw*` record とし、qualified ID と digest の brand は closed schema、canonical form、catalog membership の検証後にだけ生成する。

RegistryDescriptor と nested metadata は getter、method、hidden property を持たない closed data snapshot とする。
executable helper result は descriptor を継承せず、`descriptor` field と environment/role implementation を分離する。
descriptor locator と implementation locator も別 export のまま保持する。
すべての digest field は canonical `Sha256Digest`、semantic ID と version は non-empty valid Unicode、budget、count、horizon は正の safe integer とする。
Proxy は caller contract 外とする。

同じ owner の role requirement は `(qualifiedId, environment, role)` で一意とする。
複数宣言の reason は union して raw UTF-16 順に並べ、`required` と `request-reachable` が競合する場合は `required` を優先して一 record にする。
`reasonDefinitionIds` は non-empty、unique、canonical order とする。
同じ `(qualifiedId, environment, role)` の implementation は一 build candidate につき exactly one とし、複数 candidate は別 catalog とする。
dependency は `(sourceQualifiedId, sourceEnvironment, sourceRole, targetQualifiedId, targetEnvironment, targetRole)` で一意とし、source と target の environment を一致させる。

SC03 は artifact address を持たない `QualifiedRegistryUniverseRecord` を生成する。
この symbolic universe は qualified descriptor、全 role requirement、module/export locator、same-environment dependency、deployment 未確定の protocol template を保持する。
AF01 は candidate artifact と deployment identity の確定後に symbolic universe を exact transform し、global finalized registry catalog を生成する。
endpointIdentity は server deployment、operation qualified ID、transport profile を持つ `RemoteEndpointIdentityPreimage` の canonical digest として導出し、author string や artifact URL を直接使わない。
descriptor、kind、version、namespace、requirement、dependency semantics の追加、欠落、変更を禁止し、各 symbolic implementation locator を一つの artifact address と export name へ解決する。

environment `E` の registry universe `U_E` は、global finalized catalog のうち `E` の implementation を一件以上持つ owner の exact set とする。
`RegistryEnvironmentCatalogRecord` は `U_E` と対象 environment の DeploymentIdentityDigest を明示入力として deterministic に射影し、owner metadata、qualified descriptor と digest、`E` の全 requirement、implementation、dependency、利用可能な public protocol binding を保持する。
build validator は owner set だけでなく全 field と array を global finalized catalog と DeploymentIdentityDigest から再計算して exact equality を検証する。
browser catalog は browser implementation、browser dependency、public protocol metadata だけを持ち、server implementation、server dependency、server artifact locator を持たない。
catalog にある未選択 implementation の metadata byte は cost metric に含めるが、artifact table と module graph には final projection が選んだ binding だけを入れる。

`DefinitionManifestRecord.registryProjectionSeeds` は definition が要求する registry owner、environment、role、protocol binding を閉じた record として宣言する。
各 environment の initial seed set は selected definition records が持つ同じ environment の seed の exact union とし、外部 seed、暗黙 initial owner、protocol による自己正当化を許さない。
`request-reachable` requirement は owner がすでに選択され、かつ reason の少なくとも一つが selected definition set に含まれる場合だけ active になる。
`required` requirement は owner が当該 environment で選択された時点で必ず active になる。

environment projection は catalog と exact seed set から finite least fixed point で生成する。
最初に seed role と seed が参照する protocol の mandatory role を選択する。
次に selected owner の required requirement、selected owner かつ reason が到達した request-reachable requirement、各 role の unique implementation、implementation の全 dependency target を追加する。
dependency が新しい owner を選択した場合は、その owner の required requirement も追加し、変化がなくなるまで反復する。
projection は active requirement、selected implementation、selected dependency、included protocol ID の exact result を owner group ごとに保持する。
dependency source は同じ owner group の selected implementation、target は同じ projection の target owner group にある selected implementationへ exactly 解決する。
selected implementation を持たない owner group と、fixed point で正当化されない extra record を拒否する。

remote-operation role は generic dependency target にできない。
browser transport と server endpoint は non-null protocol seed からだけ選択し、protocol expansion が browser verifier と server handler を追加する。
endpoint-to-handler relation は RemoteRegistryProtocolBinding の operationQualifiedId、serverEndpointRole、serverHandlerRole が直接所有し、RegistryDependencyBinding へ重複して記録しない。
server endpoint は descriptor が選んだ remote-delivery-adapter の delivery role へだけ same-environment dependency を持つ。
adapter implementation は server catalog と server projection だけに存在する。
RemoteRegistryProtocolBinding の ID は `id` を空 string にした full binding の canonical digest とする。
同じ protocol ID は対応する browser/server projection に exactly once 現れる。
binding の clientDeploymentIdentityDigest は browser catalog と browser projection の deploymentIdentityDigest に一致し、serverDeploymentIdentityDigest と deliveryDeploymentIdentityDigest は server catalog と server projection の deploymentIdentityDigest に一致する。

`RegistryProtocolCatalogRecord` は public protocol binding を ID 順に保持し、重複を拒否し、digest field を空 string にした full record の canonical digest を持つ。
global catalog から browser/server catalog と protocol catalog を生成した後、global、browser、server、protocol の四つの catalog digest を `RegistryCatalogPairCommitment` に束縛する。
build pair validator は両 environment の protocol ID、deployment identity、endpoint、handler、adapter closure を同時に検証する。
browser runtime は browser catalog、browser projection、public protocol metadata、BootAuthority が認証した pair commitment だけを受け取る。
server implementation closure の完全性は build pair validator が証明し、browser runtime は local closure と認証済み pair commitment を検証する。
server runtime も同じ規則を対称に適用する。

digest の生成順は qualified descriptor、symbolic universe、plan 非依存の deployment identity、plan 非依存の artifact address、public protocol binding、global finalized catalog、environment catalog、public protocol catalog、pair commitment、environment projection、candidate manifest core と integrity table、metric vector、plan identity、selected envelope とする。
後段の digest を前段の preimage に含めない。
descriptorDigest は self field を持たない qualified descriptor 全体の canonical JCS bytes から生成する。
RemoteRegistryProtocolBinding.id は id field だけを空 string にし、ほかの digest-valued field を保持した full binding から生成する。
QualifiedRegistryUniverseRecord、FinalizedRegistryCatalogRecord、RegistryEnvironmentCatalogRecord、RegistryProtocolCatalogRecord、RegistryCatalogPairCommitment、RegistryEnvironmentProjectionRecord は自身の digest field だけを空 string にし、入力として持つほかの digest-valued field を保持した full record から生成する。

canonical list は normalization せず raw UTF-16 tuple 順で検証する。
update mode は `replacement`、`stable-handle`、`journaled-in-place`、environment は `browser`、`server-request` の固定順とする。
requirement と implementation は environment と role、dependency は source environment、source role、target qualified ID、target environment、target role、protocol は ID、owner group は qualified ID の順に並べる。
DefinitionManifestRecord.registryProjectionSeeds は environment、qualified ID、role、protocol binding ID の順、projection の seeds は definition ID、environment、qualified ID、role、protocol binding ID の順に並べる。
各 DefinitionManifestRecord の seed は自身の definitionId と同じ definitionId を持ち、list は strictly sorted かつ duplicate-free とする。
projection の seeds も strictly sorted かつ duplicate-free とし、selected definition records が持つ同じ environment の seed の exact union と一致させる。
protocol binding ID は null を digest string より前に置き、同じ `(definition ID, environment, qualified ID, role)` に異なる protocol binding ID を割り当てることを拒否する。
RemoteRegistryProtocolTemplate は operation qualified ID、delivery adapter qualified ID、transport profile qualified ID、request schema digest、response schema digest、protocol codec metadata digest、authorization verifier metadata digest、receipt verifier metadata digest、protocol budget digest の順に並べ、完全に同じ tuple を重複できない。

SC01 は schema、closed snapshot、role matrix、digest、fixed-point derivation と validator を提供する。
SC03 は symbolic qualified universe を担当する。
AF01 は candidate ごとの finalized global/environment/protocol catalog、pair commitment、exact seed projection、manifest core bytes、integrity table、metric vector を plan selection 前に完成させる。
PE01 は plan selection 後に AF01 が完成させた selected candidate の core、projection、envelope、bootstrap を再生成せず emission する。
RR01 は authenticated local catalog と projection の conformance を担当する。
compiler から global catalog までの完全性は build TCB と acceptance test が検証し、runtime が source compiler semantics を再実行するという旧要求は supersede する。

pure policy の ruleGraph は framework の versioned closed algebra で canonicalize し、PolicyEvaluator の build-time conformance vector と一致しなければならない。
host-authoritative-async policy は authority、read、ordering、cancellation を SemanticFact で宣言し、coordinator-owned operation としてだけ実行する。
PolicyEvaluator の policyKind と PolicyInputByKind の key は一致しなければならず、audience、sink、release、capability、authorization、endorsement、delivery の別 kind の入力を流用しない。
runtime は manifest binding、graph subject、principal、policy epoch、host capability、operation record から PolicyInputByKind を導出し、author が policy input や authorizationGenerationId を直接渡さない。
signal を除く evaluation input は canonical PolicyEvaluationPreimage として digest し、同じ意味の評価が同じ identity を持つようにする。

capability または authorization evaluator の allow result は grant そのものではなく PolicyGrantTerms である。
host-injected PolicyGrantAuthority は private monotonic authorization generation と revocation epoch を読み、evaluation digest、issuer policy、principal、policy epoch、terms を束縛した AuthorizationGrant を発行する。
author object、evaluator、payload は private brand を作れない。
expiry または revocation では generation を進め、旧 grant の新規 claim を拒否する。

reference cache hit は、必要な capability grant と authorization grant が同じ principal、policy epoch、share domain、alias permission、lifetime を許すことを確認し、全 AuthorizationGrantClaim と cache lease を一つの coordinator lock で原子的に取得した場合だけ返す。
claim 取得と同時に revocation または expiry が競合した場合は authority の linearization point で一方だけを勝たせ、失効した grant から value alias を返さない。
claim release、owner disposal、cache eviction は同じ lease count を減らし、grant が許す lifetime を越えて resolved value を保持しない。
runtime は resolver、subscription source、remote adapter を呼ぶ直前に owner claim から purpose、audience、具体的な request/use/operation binding digest を持つ AuthorizationGrantEvidence を発行する。
evidence は release method を持たず、extension が保持または破棄しても runtime owner claim の lifetime を変更できない。
evidence issuance と owner claim の cache/session/remote cut への promotion は同じ authority lock で行い、extension invocation 後の owner claim release は runtime だけが行う。
ValueDomainValidator、FailureSchemaAdapter の validate と toPublicDetails、HostProfileValidator、BrandValidator は effect-free かつ deterministic でなければならない。
codec の `validateWire` と resolver の `validateLocator` は effect-free かつ deterministic でなければならない。
locator validation は resolve、network、capability use より前に実行する。
ReferenceResult の failure value は ResolverRegistryDescriptor の failureSchemaId に適合し、value は valueDomainId に適合しなければならない。
resolver は expected failure を `ReferenceResult` で返し、throw または reject は runtime failure として dependent scope を失敗させる。

`defineRemoteOperation()` の `handler` は server root であり、returned `RemoteOperation` の call は author-visible な async protocol root である。
compiler は handler body を client artifact に入れず、call を同期 local function に見せかけない。
compiler は一つの qualified remote operation から browser の remote-client-transport/receipt-verifier と server-request の endpoint/handler binding を別々に生成する。
remote-server-delivery binding は descriptor が参照する remote-delivery-adapter entry が所有する。
ProjectionManifestCore は browser binding、browser codec/policy dependency、public protocol binding metadata だけを含み、server handler、deliveryAdapterId の implementation、ledger、server-only import closure を含まない。
handler の typed application failure は `RemoteApplicationResult` の `ok: false` で返す。
caller は success、application failure、cancelled、expired、ambiguous、system failure を `RemoteOutcome` の closed union で受け取る。
remote call entry は input capture 前に coordinator-local な RemoteCallAttemptIdentityPreimage の sequence を同期発行し、attempt ID をその digest とする。
attempt sequence は remote operation sequence、ledger、watermark と別 namespace であり、remote commit authority を持たない。
capture reject、capture codec 不在、capture 中 cancel、reserve 前の authorization/admission failure は Promise rejection にせず、`operationId: null` の RemotePreAdmissionOutcome を返す。
この path は remote operation sequence を発行しないため terminal hole を作らない。
RemoteDeliveryAdapter.reserve() が成功した後の outcome だけが attemptId と non-null operationId の両方を持つ。
RemoteDeliveryAdapter は registry export として実行可能であり、SC03 は descriptor と symbolic implementation locator を同じ universe entry に束縛する。
AF01 は artifact finalization 後に implementation artifact、export、host attestation を finalized catalog entry に束縛する。
ただし RemoteDeliveryAdapter、RemoteServerEndpoint、handler、ledger は server-request role であり、browser の RemoteOperation callable が直接 import または invoke しない。
browser role は RemoteClientTransport と RemoteClientReceiptVerifier だけを持つ。
browser runtime は private RemoteCapturedRequest から untrusted DTO の RemoteCapturedRequestWire を作り、private RemoteAuthorizationEvidenceIssuer で endpoint、protocol binding、operation、request commitment、attempt、principal、policy epoch、evaluation、expiry、nonce を束縛した RemoteAuthorizationEvidenceWire を発行する。
AuthorizationGrantClaim、AuthorizationGrantEvidence、RemoteCapturedRequest の private brand または private-store membership を wire DTO へ直列化しない。
RemoteProtocolCodec は admission/execution の DTO を `dathra.remote-jcs-utf8/1` の canonical JCS UTF-8 bytes にし、RemoteClientTransport は RemoteWireFrame の exact bytes だけを server endpoint へ送る。
admission response の protocol proof を検証して operation identity を得た後、同じ captured request commitment と protocol binding を持つ execution frame を送る。
admission response を得る前の transport failure では server endpoint が effect を開始できず、予約済み slot があっても deadline で non-commit terminal へ進むため pre-admission outcome にする。
server endpoint は raw frame length を allocation 前に検査し、host-injected RemoteProtocolCodec で canonical encoding、message kind、closed schema、depth、digest、byte length を検証する。
その後、RemoteAuthorizationEvidenceVerifier が issuer proof または認証済み channel proof、audience、endpoint、operation、request commitment、attempt、policy evaluation、expiry、replay window を検証し、VerifiedRemoteAuthorizationEvidence を作る。
evidence proof は proof field を空にした canonical evidence DTO 全体を認証する。
verifier は `(issuerId, evidenceId, nonce, attemptId, requestCommitment)` を replay window 中保持し、同じ admission の再送は同じ予約済み operation へだけ対応付け、別 operation の発行には使わない。
execution での再提示は admission が作った同じ operation identity に一致する場合だけ許可し、window 終了後または異なる endpoint、attempt、commitment での提示を拒否する。
server-local PolicyGrantAuthority は verified evidence から新しい local claim を pin し、adapter invocation 用の release method を持たない AuthorizationGrantEvidence と authorization cut を発行する。
wire evidence、verified evidence、server-local claim は別 identity であり、wire object の shape または digest だけから private brand を復元しない。
server endpoint は RemoteDeliveryAdapter の RemoteAdapterCommitReceipt または RemoteAdapterNonCommitReceipt を plain RemoteCommitReceiptWire または RemoteNonCommitReceiptWire へ変換し、protocol binding、endpoint、server deployment、issuer、verifier profile、proof sequence、expiry、canonical message digest を持つ RemoteProtocolProof を付けて canonical response frame を作る。
proof は proof field を空にした canonical DTO digest 全体を認証し、receipt または admission response の一 field だけへ付けた署名として扱わない。
execution response は browser verifier が exact frame、protocol binding、endpoint、expected operation、request commitment、protocol digest、receipt proof、receipt field を検証してから branded receipt を生成し、その後だけ output/failure codec で materialize する。
VerifiedRemoteCommitReceipt と VerifiedRemoteNonCommitReceipt は検証済み wire DTO を `wire` field に保持する browser-local capability であり、wire DTO を継承せず、server-local adapter receipt の brand も再利用しない。
runtime は host private store で検証済みの adapter capability だけを呼び、author が構築した同形 object、receipt brand、自己申告 descriptor を信頼しない。
`effect-ledger-result-atomic` adapter は handler へ RemoteAtomicTransaction を渡し、`stage()` を通る effect、operation ledger、encoded terminal result を一つの commit に入れた後でだけ RemoteAdapterCommitReceipt を発行する。
`fenced-idempotency` は同等の sink fence を receipt に束縛し、`none` は transactional exactly-once plan の候補にならない。
remote runtime は author input を input codec で一回だけ capture し、captured wire を単独で canonical JCS UTF-8 encode する。
RemoteRequestCommitmentPreimage は wire encoding、qualified codec ID/version、wire schema、principal、policy epoch、canonical captured wire digest、exact byte length を固定し、captured value 自体を preimage に重複格納しない。
capture 後に authorization policy を canonical input で評価し、PolicyGrantAuthority から authorization evaluation digest、grant ID、authorization generation を持つ claim を取得する。
この三 field も request commitment と operation identity に含める。
request commitment はこの full preimage の canonical digest とし、RemoteCapturedRequest は private brand、captured wire、immutable canonical bytes を browser-local に保持する。
RemoteCapturedRequestWire は commitment、preimage、captured wire だけを持つ untrusted DTO であり、server は captured wire を同じ encoding で再 encode して digest、byte length、commitment を照合した後に別の server-local RemoteCapturedRequest を作る。
capture 完了後は元の author input object を remote protocol から切り離し、mutation、getter、Proxy、別 caller の alias を再読しない。
その後、private issuer から principal と operation qualified ID ごとの issuer epoch、単調 sequence、admission expiry を持つ authenticated operation ID を発行する。
private issuer は verified RemoteDeliveryAdapter.reserve() を通じて ledger budget と terminal slot を原子的に予約し、RemoteAdmissionResult が成功した場合だけ execute へ進む。
operation ID は canonical RemoteOperationIdentityPreimage と host authentication tag の fixed encoding とし、sequence は leading zero のない unsigned decimal string とする。
adapter は operationId から preimage を復号・認証し、RemoteDeliveryRequest.operationIdentity と byte-for-byte 一致する場合だけ admission する。
server は captured wire、wire digest、codec ID/version/schema、request commitment を再検証し、その immutable wire から新しく materialize した Input だけを `run(input, transaction)` と handler へ渡す。
RemoteDeliveryRequest.requestCommitment、operationIdentity.requestCommitment、capturedRequest.commitment は完全一致しなければならない。
adapter または handler が caller realm の元 Input object を受け取る API は提供しない。

reserve 後かつ handler、RemoteAtomicTransaction.stage、external effect より前に、runtime は PolicyGrantAuthority.admitRemoteOperation() で grant claim と revocation を線形化する。
revocation が先勝ちした場合は authority が null を返し、adapter は effect を開始せず authorization-denied の RemoteAdapterNonCommitReceipt へ terminalize する。
runtime はこの場合 `execute()` を呼ばず、verified adapter の `rejectBeforeEffect()` で予約済み ledger slot、terminal fence、authorization-denied terminal を一つの atomic write にする。
cut が先勝ちした場合は RemoteAuthorizationCut を operation ledger に pin し、その operation の terminal まで有効にする。
以後の revocation は新しい operation と未 cut operation を拒否するが、既に cut を取得した operation の意味を途中で書き換えない。
commit/non-commit receipt は evaluation digest、grant ID、authorization generation、cut ID を束縛し、terminal 後に claim と cut pin を解放する。
author は RemoteCallOptions から任意 operation ID を注入せず、same-ID retry と ledger query は RemoteRecoveryCapability だけが行う。
adapter は effect 前に operation identity の authentication、principal、operation kind、expiry、sequence watermark を検証し、expired ID、retired issuer epoch、watermark 以下の sequence の再実行を effect なしで拒否する。
この replay rejection 自体を元 operation の non-commit 証明には使わない。
non-commit を確定する adapter は、ledger entry を `pending -> non-commit-terminal` へ遷移させ、同じ operationId と request commitment の将来の commit を拒否する terminal fence を同じ atomic write で設置する。
RemoteAdapterNonCommitReceipt はこの tombstone、terminal outcome、terminal digest、ledger entry digest、fence ID を束縛し、単なる「該当行を観測できなかった」という照会結果から発行しない。

commit と non-commit の terminal record は、receipt/result の保証期間と recovery horizon が終了するまで terminal kind、terminal digest、receipt evidence を保持する。
期間内に terminal record budget が不足する場合は新 admission を止め、evidence を早期削除しない。
保証期間終了後、issuer epoch 内で hole のない terminal sequence prefix を RemoteOperationHighWatermark の replayRejectedThroughSequence へ進め、terminal record を削除した prefix を terminalEvidenceDiscardedThroughSequence に記録する。
watermark 更新と個別 terminal record の削除は同じ ledger transaction で行い、削除後の duplicate は effect なしに拒否するが、元の commit/non-commit kind を watermark から推測しない。
issuer epoch の admission expiry 後は authenticated token の expiry を stateless に検証し、retired epoch の ID を新 epoch で再利用しない。
RemoteProtocolBudget は raw frame、canonical message、JSON depth、authorization evidence、captured wire、response payload、materialized input/output、codec work、concurrent decode を制限する。
全 field は正の safe integer とし、RemoteOperationRegistryDescriptor.protocolBudget が RuntimeHostAdapter.remoteProtocolHardLimit を超える場合は registry load 前に拒否する。
endpoint と browser verifier は maxRawFrameBytes を JSON parse または base allocation より前に検査し、strict decoder が canonical JCS、closed field set、duplicate key、UTF-8、depth、subtree byte length を検証する。
evidence、captured wire、response payload は canonical bytes 上の subtree range から独立に数え、宣言した digest と length を再計算する。
input/output/failure codec は preflight estimate を saturation 加算し、materialized byte と work unit の全 reservation が成功するまで author codec、handler、adapter effect を開始しない。
response encoding でも同じ budget を適用し、上限超過時は effect の commit certainty を receipt から分類して protocol-budget failure または ambiguous を返す。

in-flight hole、terminal record、terminal byte、sequence gap は descriptor の RemoteLedgerBudget 以下に制限する。
RemoteLedgerBudget の全 field は正の safe integer とし、RuntimeHostAdapter.remoteLedgerHardLimit を超える descriptor を registry load 前に拒否する。
issuer は valid operation ID を公開する前に adapter の in-flight と terminal 枠を予約し、予約できない場合は remote admission を作らず local non-commit system failure を返す。
この failure の correlation operationId は admissionExpiresAt が issuance 時刻以下の signed rejection ID とし、adapter が stateless に commit 不能と判定できる。
発行後の operation は予約済み terminal slot を必ず commit または non-commit record へ移し、evidence horizon 後にだけ watermark へ compact する。
したがって fence を永久に一件ずつ保持せず、削除後も古い operation ID が commit 可能に戻らない。
ただし evidence を削除した operation の照会、retry、recovery は、caller が有効な receipt を提示できない限り `terminal-evidence-expired` の ambiguous とする。
この outcome は古い operation の再実行も terminal evidence の復元もできないため、recovery capability を常に null にする。
remote runtime は Promise を reject せず、次の commit-certainty 順序で outcome を一意に分類する。

1. browser verifier が operation、request commitment、principal、policy epoch、terminal tombstone、fence、RemoteNonCommitTerminal を束縛した VerifiedRemoteNonCommitReceipt を検証できる場合だけ、cancelled、expired、または `dathra.remote-system/1` の system failure を返す。
2. 同 verifier が VerifiedRemoteCommitReceipt と terminal digest を検証できた場合だけ、success、application failure、または証明済み after-commit cancellation を返す。
3. commit の有無または commit 後 terminal の integrity を証明できない場合は、transport、protocol、codec failure ではなく ambiguous を返す。

RemoteSystemFailure の transport-unavailable は `commit: not-committed` を必須とする。
JavaScript agent の強制終了など Promise settlement 自体が不可能な場合の liveness は保証しない。

`cancelled` の `after-commit` は remote protocol が cancellation terminal を証明した場合だけ返し、terminal を証明できなければ `ambiguous` にする。
idempotent operation は horizon 内で同じ operationId だけを retry でき、transactional operation は ledger policy に従って query する。
`expired` は operation が commit されなかったことを protocol が証明し、admission または deduplication horizon が終了した場合だけ返す。
operation token の expiry または replay watermark だけでは過去の non-commit を証明しない。
commit の有無を確定できないまま horizon を越えた場合は必ず `ambiguous` とし、別 operationId の自動 retry を許さない。

ambiguous outcome は、delivery policy と現在の authorization が許す場合だけ RemoteRecoveryCapability を持つ。
capability は principal context、policy epoch、operationId、requestCommitment、delivery contract、horizon に束縛し、各 `recover()` または `reconcile()` の直前に policy を再評価する。
idempotent recovery は同じ operationId の retry、transactional recovery は ledger query、single-attempt は明示許可された manual reconciliation だけを提供する。
capability は元の RemoteAmbiguitySnapshot を immutable に保持する。
recovery が valid receipt を得た場合だけ `resolved` と RemoteCertainOutcome を返す。
stale、unauthorized、expired、transport、integrity、ledger、protocol failure では新しい `not-committed` claim を作らず、元の snapshot と RecoveryAttemptFailure を持つ `still-ambiguous` を返す。
したがって recovery failure が元の commit uncertainty を system failure で上書きすることはない。

RemoteOperationRegistryDescriptor の applicationFailureSchemaId は failureCodec の value domain と一致し、system failure は author codec ではなく固定 protocol codec を使う。
inputCodecId と outputCodecId の valueDomainId は remote descriptor の inputValueDomainId と outputValueDomainId に一致しなければならない。
failureCodecId の valueDomainId は applicationFailureSchemaId が指す FailureSchemaRegistryDescriptor.valueDomainId と一致しなければならない。
deliveryAdapterId と deliveryPolicyId は compiled descriptor では qualified ID である。
transportProfileId も qualified host-profile ID とし、protocol binding の transport profile、request/response schema、evidence/receipt verifier metadata、protocol budget digest と一致させる。
delivery adapter dependency は remote-server-endpoint から descriptor が選んだ remote-server-delivery role への binding としてだけ現れ、browser dependency binding に入れない。
protocol binding の deliveryEnvironment と RemoteDeliveryAdapterRegistryDescriptor.deliveryEnvironment が異なる場合は diagnostic とする。
delivery horizon は正の safe integer millisecond とし、idempotency key と transaction ledger の意味は参照した policy descriptor が定義する。

### explicit contracts

library と application は、build-time の execution contract を提供できる。
contract は runtime magic ではなく、semantic manifest と同じ typed fact schema を使う。

contract は少なくとも、identity、realm、call と construct、brand、value domain、sync と async boundary、ordering、reentrancy、error、cancel、lifetime、version、security capability を宣言する。
意味を持つ field を自由記述 string で補わず、`dathra.fact/1` の closed discriminated union または kind 付き RegistryId で表す。
unknown fact kind、unknown registry kind、schema version mismatch は diagnostic とする。

ExecutionContractSource は author input であり、artifact digest や canonical module URL を要求しない。
CompiledExecutionContract は resolver の module graph-completeness barrier 後に生成し、source contract、source content、symbolic implementation export を QualifiedRegistryUniverseRecord に束縛する。
artifact bytes、artifact address、final protocol、environment catalog は bundler finalization 後に AF01 が別の finalized catalog として束縛する。
source から直接証明できた事実を contract で上書きできない。

imperative library が所有する DOM region は、author-facing `dom:external` reserved JSX directive と execution contract の ownership/effect fact を組み合わせる。
この contract は Dathra の mutation と reconciliation を禁止するが、server と client の placement directive にはならない。

### manual activation

通常利用では `hydrate()` または manual activation を要求しない。
compiler が client projection を生成した場合だけ bootstrap を出力する。
client root がなければ bootstrap を出力しない。

baseline の public API に、任意 plan を受け取る `hydrate()` を残さない。
advanced integration は、build が生成した capability handle を通じて、宣言済み definition の activation または instance 作成だけを要求できる。
integration API は placement、code、ownership を追加できない。

build が生成する integration handle は次の型を持つ。

```ts
type InstanceLifecycle = "inactive" | "activating" | "active" | "disposing" | "disposed";

interface ActivationScope {
  readonly build: string;
  readonly projection: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly instanceDomainId: string;
}

declare const existingInstanceRefBrand: unique symbol;
declare const insertionSlotRefBrand: unique symbol;
declare const preparedInstantiationEnvelopeBrand: unique symbol;
declare const instantiationOperationRefBrand: unique symbol;

interface ExistingInstanceRef {
  readonly [existingInstanceRefBrand]: true;
  readonly integrationKey: string;
  readonly opaqueId: string;
}

interface InsertionSlotRef {
  readonly [insertionSlotRefBrand]: true;
  readonly integrationKey: string;
  readonly opaqueId: string;
}

interface InstantiationOperationRef {
  readonly [instantiationOperationRefBrand]: true;
  readonly operationId: string;
  readonly issuerEpoch: string;
  readonly sequence: string;
  readonly expiresAt: number;
  release(): void;
}

interface InstantiationRequest {
  readonly slot: InsertionSlotRef;
  readonly operation: InstantiationOperationRef;
  readonly key: CodecWireValue;
  readonly payload: unknown;
}

interface SlotOperationIdentityPreimage {
  readonly schema: "dathra.slot-operation-identity/1";
  readonly slotDefinitionId: string;
  readonly slotInstanceId: string;
  readonly slotGenerationId: string;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly issuerEpoch: string;
  readonly sequence: string;
  readonly admissionExpiresAt: number;
}

interface DynamicInstantiationIdentityPreimage {
  readonly schema: "dathra.dynamic-instantiation-identity/1";
  readonly build: string;
  readonly projection: string;
  readonly integrationKey: string;
  readonly operationId: string;
  readonly operationIssuerEpoch: string;
  readonly operationSequence: string;
  readonly admissionExpiresAt: number;
  readonly slotDefinitionId: string;
  readonly slotInstanceId: string;
  readonly slotGenerationId: string;
  readonly expectedSlotEpoch: number;
  readonly keyDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly graphPayloadDigest: Sha256Digest;
}

interface DynamicInstantiationEnvelope {
  readonly schema: "dathra.dynamic-instantiation/1";
  readonly instanceId: string;
  readonly build: string;
  readonly projection: string;
  readonly integrationKey: string;
  readonly operationId: string;
  readonly operationIssuerEpoch: string;
  readonly operationSequence: string;
  readonly admissionExpiresAt: number;
  readonly slotDefinitionId: string;
  readonly slotInstanceId: string;
  readonly slotGenerationId: string;
  readonly expectedSlotEpoch: number;
  readonly key: CodecWireValue;
  readonly keyDigest: Sha256Digest;
  readonly principalContextId: string;
  readonly policyEpoch: string;
  readonly graphPayloadDigest: Sha256Digest;
  readonly digest: Sha256Digest;
  readonly symbols: readonly LocalSymbolRecord[];
  readonly nodes: readonly GraphNodeRecord[];
  readonly cells: readonly CellRecord[];
  readonly subscriptions: readonly SubscriptionRecord[];
  readonly roots: readonly RootBindingRecord[];
}

interface PreparedInstantiationEnvelope {
  readonly [preparedInstantiationEnvelopeBrand]: true;
  readonly integrationKey: string;
  readonly operationId: string;
  readonly preparedRecordId: string;
  readonly operationSequence: string;
  readonly expiresAt: number;
  readonly slotGenerationId: string;
  readonly expectedSlotEpoch: number;
  readonly dynamicEnvelopeInstanceId: string;
  readonly key: CodecWireValue;
  release(): void;
}

interface DynamicInstantiationBudget {
  readonly maxPreparedRecords: number;
  readonly maxPreparedBytes: number;
  readonly maxPreparedAgeMs: number;
  readonly maxTerminalRecords: number;
  readonly maxTerminalBytes: number;
  readonly replayHorizonMs: number;
  readonly maxSequenceGap: number;
}

type SlotOperationTerminal =
  | { readonly commit: "committed"; readonly terminalDigest: Sha256Digest }
  | {
      readonly commit: "not-committed";
      readonly reason:
        | "operation-ref-released"
        | "operation-ref-expired"
        | "capability-revoked"
        | "prepared-record-released"
        | "prepared-record-expired"
        | "slot-epoch-stale"
        | "validation-failed";
    };

interface SlotOperationTerminalRecord {
  readonly schema: "dathra.slot-operation-terminal/1";
  readonly slotInstanceId: string;
  readonly slotGenerationId: string;
  readonly issuerEpoch: string;
  readonly sequence: string;
  readonly operationId: string;
  readonly requestCommitment: Sha256Digest | null;
  readonly terminal: SlotOperationTerminal;
}

interface SlotOperationHighWatermark {
  readonly schema: "dathra.slot-operation-watermark/1";
  readonly slotInstanceId: string;
  readonly slotGenerationId: string;
  readonly issuerEpoch: string;
  readonly rejectedThroughSequence: string;
}

type ActivationProtocolFailure =
  | { readonly code: "coordinator-not-ready"; readonly failure: FailureRef }
  | { readonly code: "stale-capability" }
  | { readonly code: "integration-key-not-found" }
  | { readonly code: "wrong-target-kind" }
  | { readonly code: "target-not-found" }
  | { readonly code: "target-ambiguous" }
  | { readonly code: "generation-mismatch" }
  | { readonly code: "invalid-payload" }
  | { readonly code: "operation-conflict" }
  | { readonly code: "operation-expired" }
  | { readonly code: "prepared-record-expired" }
  | { readonly code: "dynamic-instantiation-budget-exhausted" }
  | { readonly code: "slot-epoch-mismatch" }
  | { readonly code: "authorization-denied" }
  | {
      readonly code: "failure-pin-budget-exhausted";
      readonly cleanupHandle: InstanceHandle | null;
      readonly internalTerminal: "recorded" | "not-applicable";
    }
  | {
      readonly code: "activation-failed";
      readonly failure: FailureRef;
      readonly cleanupHandle: InstanceHandle | null;
    };

type DisposeResult =
  | {
      readonly ok: true;
      readonly disposition: "lease-released" | "instance-disposed";
      readonly outcome: CleanupOutcome;
    }
  | {
      readonly ok: false;
      readonly error:
        | { readonly code: "cleanup-self-await"; readonly failure: FailureRef }
        | {
            readonly code: "failure-pin-budget-exhausted";
            readonly disposition: "lease-released" | "instance-disposed";
            readonly internalTerminal: "recorded";
          };
    };

interface InstanceHandle {
  readonly id: string;
  readonly leaseId: string;
  status(): InstanceStatusResult;
  dispose(): Promise<DisposeResult>;
  release(): HandleReleaseResult;
}

interface InstanceStatusSnapshot {
  readonly lifecycle: InstanceLifecycle;
  readonly health: Health;
  readonly cleanup: CleanupOutcome;
  readonly expiresAt: number;
  release(): void;
}

type InstanceStatusResult =
  | { readonly ok: true; readonly snapshot: InstanceStatusSnapshot }
  | {
      readonly ok: false;
      readonly error:
        | { readonly code: "failure-pin-budget-exhausted" }
        | { readonly code: "released-handle" };
    };

type HandleReleaseResult =
  | { readonly ok: true }
  | { readonly ok: false; readonly error: { readonly code: "handle-lease-active" } };

type InstanceOperationResult =
  | { readonly ok: true; readonly handle: InstanceHandle }
  | { readonly ok: false; readonly error: ActivationProtocolFailure };

type ResolveIntegrationResult<Ref> =
  | { readonly ok: true; readonly refs: readonly Ref[] }
  | { readonly ok: false; readonly error: ActivationProtocolFailure };

type PrepareInstantiationResult =
  | { readonly ok: true; readonly envelope: PreparedInstantiationEnvelope }
  | { readonly ok: false; readonly error: ActivationProtocolFailure };

type ReserveInstantiationOperationResult =
  | { readonly ok: true; readonly operation: InstantiationOperationRef }
  | { readonly ok: false; readonly error: ActivationProtocolFailure };

interface ActivationCapability {
  readonly scope: ActivationScope;
  readonly failures: RuntimeFailureChannel;
  resolveExisting(integrationKey: string): Promise<ResolveIntegrationResult<ExistingInstanceRef>>;
  resolveInsertionSlots(
    integrationKey: string,
  ): Promise<ResolveIntegrationResult<InsertionSlotRef>>;
  activate(target: ExistingInstanceRef): Promise<InstanceOperationResult>;
  reserveInstantiationOperation(
    slot: InsertionSlotRef,
  ): Promise<ReserveInstantiationOperationResult>;
  prepareInstantiation(request: InstantiationRequest): Promise<PrepareInstantiationResult>;
  instantiate(envelope: PreparedInstantiationEnvelope): Promise<InstanceOperationResult>;
}

interface ActivationCapabilityProvider {
  forCoordinator(
    root: Document | ShadowRoot,
  ): Promise<
    | { readonly ok: true; readonly capability: ActivationCapability }
    | { readonly ok: false; readonly error: ActivationProtocolFailure }
  >;
}
```

`dathra:activation/<compiler-generated-id>` という build-time specifier の named export は ActivationCapabilityProvider である。
ProjectionManifestCore の IntegrationModuleRecord が source specifier、artifact、export name、stable integration key、許可 definition を束縛する。
provider は、指定 Document または ShadowRoot の coordinator が検証済み TrustedBootRecord を持つ場合だけ ActivationCapability を返す。

capability は ActivationGroupDefinition、ClientRootDefinition、InsertionSlotDefinition、build、projection、principal context、policy epoch、instance domain、authority scope に束縛する。
coordinator の boot generation、principal、policy epoch、Document generation のいずれかが変わった時点で stale になり、以後の operation は `stale-capability` result を返す。
application が同等 object を構築して capability を代用することはできない。

`resolveExisting(integrationKey)` は manifest の existing-root target と現在の coordinator instance を照合し、instance ID と generation を内包する opaque ExistingInstanceRef を stable instance order で返す。
`resolveInsertionSlots(integrationKey)` も同じ方法で、slot instance と現在 epoch を内包する opaque InsertionSlotRef を返す。
application は raw instance ID、generation ID、slot generation を selector として入力しない。

`reserveInstantiationOperation(slot)` は current slot generation の private authority から次の issuer epoch、operation sequence、admission expiry を持つ InstantiationOperationRef を取得する。
ref reservation 自体も DynamicInstantiationBudget の prepared count と terminal 枠を予約する。
未使用 ref の `release()`、expiry、capability revocation は予約を破棄せず、対応 reason の commit 不能な SlotOperationTerminalRecord へ原子的に変換する。
trusted server handoff は同じ authority protocol が認証した operation token を boot channel から ref に変換し、author-provided string を変換しない。

`activate(target)` は ref が capability scope の live generation に属することを再検証し、束縛済み ActivationGroupDefinition と prerequisite だけを直ちに起動する。
既に active な target も同じ underlying instance に対する新しい leaseId の InstanceHandle を返し、InstanceHandle object と release ownership を caller 間で共有しない。
handle lease count は FailurePinBudget.maxHandleLeases の admission 対象とし、枠がなければ既存 instance を返さず bounded failure にする。
別 instance へ fallback しない。

`prepareInstantiation(request)` は unknown payload を GraphTableEnvelope と区別される DynamicInstantiationEnvelope として検証する。
dynamic envelope は build、projection、integration key、operation ID、issuer epoch、operation sequence、admission expiry、slot definition、slot instance、slot generation、expected slot epoch、canonical key、principal context、policy epoch、payload digest を一つに束縛し、boot 時の graph-table instance や digest を再利用しない。
operation ID は slot authority が issuer epoch と単調増加 operation sequence から発行する authenticated ID とし、application が任意 UUID を authority ID として持ち込まない。
operationSequence は leading zero のない unsigned decimal string とし、operationId は canonical slot operation identity と host authentication tag の fixed encoding から作る。
admissionExpiresAt を過ぎた ID、現在の issuer epoch と異なる ID、slot watermark 以下の sequence を allocation 前に `operation-expired` とする。
graphPayloadDigest は symbols、nodes、cells、subscriptions、roots の canonical graph body digest とする。
instanceId は canonical DynamicInstantiationIdentityPreimage の digest とし、envelope 自身や instanceId を identity preimage に含めない。
envelope digest は instanceId を確定した後、digest field だけを空にした canonical DynamicInstantiationEnvelope から計算する。
runtime は identity preimage、graph payload、envelope の三 digest と keyDigest、operationId を重複検査する。
expectedSlotEpoch は非負 safe integer とし、prepare 時点の slot epoch と一致しなければ PreparedInstantiationEnvelope を作らない。
request の operation ref、key、opaque slot ref と dynamic envelope の対応 field が完全一致し、manifest binding、capability scope、current slot generation が有効な場合だけ private brand を持つ PreparedInstantiationEnvelope を作る。
prepare は operation ref の reservation を prepared record へ原子的に変換し、検証済み payload byte と将来の terminal record の count/byte 枠を同じ admission transaction で予約する。
manifest の DynamicInstantiationBudget は host hard limit 以下とし、予約できなければ payload を保持せず `dynamic-instantiation-budget-exhausted` を返す。
count と byte field は非負 safe integer、age と replay horizon は正の safe integer millisecond とし、host limit を超える manifest を boot validation で拒否する。
検証済み payload と capability は runtime private registry に preparedRecordId で保持し、public field から差し替えられない。
prepared record は maxPreparedAgeMs 以下の expiresAt を持ち、instantiate の開始または `release()` で一回だけ consume する。
prepared expiry、release、capability revocation、slot generation/epoch の失効では payload と grant を解放する一方、terminal reservation を対応 reason の commit 不能な SlotOperationTerminalRecord へ原子的に変換して stale prepared record を purge する。
invalid payload、duplicate operationId with different canonical request、stale slot generation は allocation 前に失敗させる。
`instantiate(envelope)` は brand と current slot generation を再検証し、expectedSlotEpoch から次 epoch への CAS を allocation/commit transaction の linearization point に含める。
別 operation が先に epoch を進めた場合は payload や generation が同じでも `slot-epoch-mismatch` を返し、stale prepared envelope を再 prepare なしで commit しない。
CAS に勝った operation だけが capability に束縛済み ClientRootDefinition と InsertionSlotDefinition を instance 化し、dynamicEnvelopeInstanceId をその root の reference cache identity に使う。

公開済み operation sequence は committed result、validation failure、ref/prepared release、expiry、revocation、stale epoch のいずれでも必ず SlotOperationTerminalRecord へ terminalize する。
terminal result と item tombstone は replayHorizonMs まで operation sequence、request commitment、terminal digest を bounded terminal ledger に保持する。
horizon 後は連続して terminal な sequence prefix を SlotOperationHighWatermark へ圧縮し、個別 payload と result を破棄する。
watermark 以下の retry は effect を再実行せず `operation-expired` を返し、同じ operation の過去 terminal result を再現できるとは主張しない。
未 terminal sequence に hole がある場合はその先を compact せず、terminal ledger の予約が尽きる前に新 operation admission を止める。
live hole 数と newest-issued から oldest-nonterminal までの距離は maxPreparedRecords と maxSequenceGap の両方で制限し、すべての hole は maxPreparedAgeMs 以内に non-commit terminal へ移す。
terminal capacity は terminal record または watermark への遷移まで解放せず、release を capacity 解放の近道にしない。
item tombstone は item generation と operation sequence を束縛し、generation fence または watermark が stale mutation を拒否できる時点でだけ個別 record を解放する。

activation が instance shell または resource を作った後に失敗した場合は、activation-failed result に FailureRef と cleanupHandle を付ける。
caller は cleanupHandle の dispose outcome を待てるため、失敗 instance の cleanup ownership を失わない。

InstanceLifecycle は handle に属する required group の aggregate である。
一つでも pre-active state にあれば `activating`、すべて active なら `active`、disposal 開始後は `disposing`、全 cleanup terminal 後は `disposed` とする。
failure は lifecycle へ埋め込まず Health で表す。
`status()` は全 failure pin をまとめて取得した disposable InstanceStatusSnapshot を返し、caller は snapshot の `release()` で全 claim を解放する。
snapshot と内側の FailureRef は expiresAt で自動失効するため、caller が release を忘れても runtime pin budget を永久に占有しない。
`dispose()` はその handle の activation lease を一回だけ解放する。
ほかの owning lease が残る場合は `lease-released` と current cleanup outcome を返し、最後の lease だけが underlying instance disposal を起動して `instance-disposed` を返す。
owner generation の失効、DOM lifetime の終了、failure containment は handle lease 数にかかわらず全 activation lease を revoke して underlying disposal を起動し、manual handle が owner lifetime を延長することを許さない。
`InstanceHandle.release()` は自身の activation lease が dispose 済みの場合だけ成功し、その handle lease と status claim だけを解放する。
underlying owner tombstone と instance registry entry は instance が disposed かつ全 handle lease が release された後にだけ解放する。
release 後の同じ handle の status は `released-handle` を返すが、別 caller の handle lease と FailureRef を失効させない。

### 破壊的に削除する API

次の author-facing semantics は互換性の対象にしない。

- `client:*` を hydration opt-in または timing directive とする semantics
- `hydrate:*`
- component-level `hydrate` option
- `data-dh-island` を中心にした island scheduler
- `planFactory` を component hydration intent とする semantics
- manual `hydrate(plan)`
- unsupported 時の component rerender fallback

既存内部 code を再利用する場合も、新しい state、ownership、failure contract に適合する処理だけを採用する。

## DocCodeBlock の期待分割

`docs/src/components/DocCodeBlock/DocCodeBlock.tsx` は、受け入れ例として使う。

server artifact に残す処理は次の通りである。

- source の取得と整形
- syntax highlight
- highlighted HTML と DSD の生成
- static style と static code subtree

client artifact に入れる処理は次の通りである。

- `copied` state の client initializer
- button class と text の binding
- click listener
- clipboard operation
- reset timer
- timer と listener の cleanup

`copied = false` は client-owned initializer であり、server payload に serialize しない。
`source` は click handler が clipboard write に必要とする場合だけ server snapshot として transfer する。
highlighted HTML と highlight dependency は client graph から到達しないため、client artifact に入れない。

highlighted subtree は static DOM として保持する。
`hydrate:preserve` のような directive で server code を除外するのではなく、ExecutionGraph の reachability と transfer plan で除外する。

期待する artifact は次の通りである。

```txt
server renderer
  -> source と highlighted HTML
  -> DSD と static styles
  -> button の initial DOM

request projection
  -> source snapshot（copy handler が必要な場合だけ）
  -> host、marker、binding identity

client artifact
  -> copied state initializer
  -> click handler
  -> class/text binding
  -> timer cleanup
```

client activation は highlighted subtree を再構築せず、button の既存 node に behavior を接続する。

## diagnostic policy

diagnostic は、component 単位の「unsupported」だけを返さない。
少なくとも次の情報を含める。

- root instance と admission cut
- root から失敗 dependency までの edge chain
- 不足または矛盾する semantic fact
- 満たせなかった ObservationContract
- 拒否した placement と materialization candidate
- authority または exposure rule
- 利用可能な module split、manifest、contract、codec、reference、explicit remote API

runtime unknown は eager activation、full module、rerender を許可する理由にならない。
runtime failure は affected scope を明示的に失敗させ、SSR DOM を可能な範囲で保持し、RuntimeFailureChannel へ報告する。

## 実装方針

実装は次の順序で進める。

1. ModuleCoordinator と ExecutionGraph IR を導入する。
2. semantic manifest と execution contract の typed schema を導入する。
3. root、Occurrence、read、effect、module closure の解析を実装する。
4. server renderer と RenderOperation を新しい IR から生成する。
5. MaterializationPlan と request projection を生成する。
6. ClientScopeGraph、artifact、bootstrap を生成する。
7. DSD、marker、reconciliation、activation policy を実装する。
8. 旧 hydration と island semantics を削除する。

production code を変更する前に、関連 package の `SPEC.typ` と `implementation.test.ts` を新しい契約へ更新する。
Accepted ADR の意味を直接書き換えず、必要な場合は superseding ADR を追加する。

## 実装時の検証事項

次の項目は設計上の未決事項ではなく、実装が設計を満たすかを確認する acceptance work である。

- ModuleCoordinator の incremental build cost と memory usage
- solver が declared candidate universe 内の最適解を再現できること
- ObservationContract の trace equality/refinement、coalescing、composition、RealizationWitness の canonical comparison が実装間で一致すること
- selection-domain class から worst-case resolved graph と同じ metric vector を再現できること
- canonical scalar field atom と許可 joint atom の classification table が記述順によらず同じ class と digest を作り、input universe を排他的かつ網羅すること
- plan-independent DeploymentProjectionDefinition ID が manifest instance、artifact、metric から独立していること
- ArtifactAddressId、exact-byte digest、plan ID に自己参照がなく、reproducible build になること
- deployment identity、finalization template、複数 entry binding、labeled dependency、export table、base URL normalization が一つの ArtifactAddressId に一つの bytes identity だけを割り当てること
- ProjectionManifestCore が plan より先に exact bytes を確定し、固定長 envelope と class/variant ごとの cold reachable artifact を client-delivered-bytes が数えること
- final bundler closure から server-only dependency が除外されること
- source、manifest、contract の conflict diagnostic
- SemanticSubject、relation、qualified fact と registry ID の namespace 衝突検査
- module map、import map、integrity、redirect の host profile ごとの適合性
- SC03 の qualified symbolic universe、AF01 の final/environment catalog と exact-seed fixed-point projection、PE01 の selected emission、RR01 の authenticated local validation が同じ registry identity と role closure に一致し、browser role から server-request artifact closure を拒否すること
- finite GraphPathWitness の edge continuity、cycle rejection、path pattern、locator validation、private grant pin、reference cache identity が invocation 前に完了すること
- codec graph edge slot table が wire path、edge kind、cardinality、witness ordinal を materialization 前に検証すること
- BootAuthority が manifest 前に loader と failure channel を注入し、private capability を Realm、Document generation、module-map epoch、decoder、redirect policy に束縛すること
- 7 種類の policy input、value-domain、failure-schema、host-profile、brand implementation の conformance
- RenderOperation の cancel、retry、header、stream race
- FinalHeaderCommit と複数 103 publication の writer acceptance linearization
- runtime-owned subscription wrapper が wrapper ごとに non-reused session incarnation を発行し、SSR handoff record、source-facing request、transport event から client-local owner/session identity を除外し、全 runtime event と acknowledgement を captured owner generation/session identity の atomic pair fence に通して、transport continuity、boot-bound private namespace authority、local/transport resync 分離、purpose-bound grant evidence、budget、overflow、acknowledgement、GC を強制すること
- allocation token、cleanup deadline、LateSettlementLedger の race
- target generation を参照しない creation operation、restartable generation、allocation/commit transaction が coordinator-issued incarnation から identity を作ること
- retention claim set、CleanupTaskToken、LateCleanupLedger、hard admission budget、sink-side atomic generation fence、self-await rejection
- graph-table budget、declarative/host-attested codec enforcement、疎配列、global symbol allowlist、well-known symbol の validation
- raw carrier attestation、decoded canonical text、JSON depth、local symbol table の validation
- DSD parse fence と全 custom-element reaction の順序
- same-checkpoint move、adoption、cross-coordinator migration
- user input、autofill、history restoration、form group の reconciliation
- interaction、load、error、media、animation などの event admission frontier
- dynamic list、conditional UI、client navigation、late fragment の slot transaction
- activation capability の boot scope、instance selector、stale rejection、failure channel
- stable integration key、opaque ref、release/expiry も terminalize する budgeted slot operation ledger、expected epoch CAS、watermark compaction
- opaque public failure subject、owner tombstone、disposable snapshot、FailurePinBudget、独立 handle lease と FailureRef pin、retention limit 0
- effect、onActivate、onDispose、owned resource の cleanup DAG
- remote outcome の cancellation、expiry、ambiguity、delivery horizon
- pre-admission outcome、immutable wire commitment、private object と untrusted wire DTO の分離、authorization cut、browser transport/verifier と server endpoint/handler/delivery の role 分割、canonical frame、protocol budget、replay/evidence watermark 分離、receipt proof、元の ambiguity を保持する recovery
- endpoint が server-local receipt から closed wire DTO を再構築し、receipt proof を先に確定してから完成した receipt を含む response proof を canonicalize すること
- `render:client` の literal prop、spread diagnostic、reserved prop removal
- `dom:external` の region identity、exclusive nesting、SSR preservation、lifetime、cleanup、reserved prop removal
- non-atomic writer の BufferedFinalWrite と writerOutcomeUnknown terminal
- DocCodeBlock から highlight dependency が client artifact に入らないこと
- client root がない route で bootstrap と payload がゼロになること
- diagnostic が root から失敗 dependency までの path を示すこと

## 解決済みの設計事項

実装前に必要だった設計判断は、次の通り解決した。

1. reactive graph 単体ではなく ExecutionGraph を採用し、runtime reactive graph はその動的部分集合とする。
2. ExecutionGraph と transfer plan の compiler IR を ModuleCoordinator で構築する。
3. shared state、activation group、prerequisite を ClientScopeGraph で表現する。
4. lifetime は Document または ShadowRoot coordinator、marker、custom-element host、lease で管理する。
5. client artifact と manifest は full deployment graph と request-reachable projection に分ける。
6. semantic manifest と明示 contract は同じ typed fact schema を使う。
7. serializer は型一覧ではなく MaterializationPlan の一候補とする。
8. built-in と user codec は identity、lifetime、effect、authority を含む contract を持つ。
9. reconstruction、reference、subscription、remote operation は独立した owner と state machine を持つ。
10. client recomputation は source semantics ではなく、同値性を証明した optimization とする。
11. secret と exposure は data、alias、control dependency を伝播する label と release contract で扱う。
12. source、manifest、contract は first-match priority を持たず、fact conflict を diagnostic にする。
13. nondeterministic read は独立した stability、consistency、replay 軸で扱う。
14. activation policy は `activate:*` とし、event source ごとの admission frontier を定義する。
15. server-only、client-only、universal は root reachability と environment constraint から導出する。
16. functional component は compiler-visible または summary-backed な範囲で graph-transparent とする。
17. opaque imported component は semantic manifest、native closure、明示 contract、diagnostic のいずれかで扱う。
18. bootstrap は projected client work がある場合だけ生成し、任意 plan を受け取る public hydrate API を残さない。
19. `defineComponent` host と plain DOM marker は lifetime owner になれるが hydration boundary にはしない。
20. DSD static style は SSR artifact と client-created template artifact を分け、SSR instance へ再挿入しない。
21. `data-dh-store` は継承せず、必要な value だけを versioned inert graph-table payload で送る。
22. transfer failure は root、demand、candidate、contract を示す diagnostic にする。
23. 既存 hydration 実装の再利用を設計制約にせず、新しい contract に適合する内部処理だけを個別に採用する。
24. plan selection は candidate-independent な selection-domain descriptor と versioned cost estimator で決定する。
25. artifact address、exact-byte integrity digest、versioned plan identity preimage を分離し、自己参照しない content identity を使う。
26. prerequisite は definition と resolved instance を分け、allocation と commit の cycle を明示 transaction へ collapse する。
27. async allocation は acquisition token と cleanup ledger を使い、hard admission と terminal bound を満たす deadline 後の result だけを LateSettlementLedger で処理する。
28. graph-table は expansion budget、closed declarative または host-attested codec、疎配列、local/global/well-known symbol identity、reference と subscription capability を versioned wire schema で検証する。
29. ProjectionManifestCore は definition、binding、registry catalog/projection、artifact integrity、integration capability の許可関係を固定し、外側 envelope は plan と core integrity を束縛する。
30. execution contract は SemanticSubject、typed relation、qualified fact と registry ID を持つ semantic graph とする。
31. activation capability は verified boot context と instance domain に束縛し、runtime failure と cleanup order を公開契約にする。
32. remote call は success、application failure、cancel、expiry、ambiguity、system failure を closed outcome として返す。
33. final header と Early Hints は publication claim、compatible envelope set、atomic writer acceptance で線形化する。
34. BootAuthority は manifest の外側から VerifiedModuleLoader と failure channel を注入し、loader capability を Realm、Document generation、module map、decoder、redirect policy に束縛する。
35. runtime registry は metadata digest だけでなく、policy evaluator と kind ごとの validator implementation を content-bound artifact として持つ。
36. reference は capture path ごとの ReferenceUseSchema から authorization、exposure、audience、share domain を構成する。
37. request-envelope class は disjoint scalar field atom と許可 joint atom の canonical classification table が作る排他的、網羅的、maximal な partition とする。
38. artifact metadata は一つの artifacts table に集約し、deployment identity、finalization template、複数 entry、labeled binding、export table を含む address preimage から URL と bytes を一意に導出する。
39. generation、allocation transaction、commit transaction identity は coordinator-issued incarnation、selector preimage、full instance scope から導出し、旧 continuation と新 generation を分離する。
40. retention claim は target ごとに統合し、budgeted late DAG の reuse を terminal、または sink-side compare-and-mutate と publication に線形化した generation fence まで遮断する。
41. graph-table carrier は host-side raw-byte attestation、canonical decoded text、JSON depth、symbol table を検証する。
42. CompiledExecutionContract の registry universe と finalized registry catalog は nested reference まで qualified ID に変換し、source-local ID を runtime artifact へ残さない。
43. RuntimeFailure は具体的な internal subject と opaque public subject を分け、owner tombstone と hard-budgeted disposable snapshot から独立した FailureRef pin を作る。
44. advanced activation は stable integration key から opaque instance と slot ref を解決し、expected slot epoch を instantiate-time CAS する PreparedInstantiationEnvelope だけを受け付ける。
45. non-atomic writer は 103 と streaming を使わず、unknown external outcome を terminal として retry を禁止する。
46. remote outcome は private authority が検証した commit/non-commit receipt で certainty を先に分類し、recovery failure でも元の ambiguous outcome を保持する。
47. reference cache identity は envelope、revision、resolver、locator、audience、share domain、private grant、authorization generation を含み、cache lease と grant claim を原子的に pin する。
48. dynamic instantiation は boot graph-table とは別 schema を使い、operation、slot generation、expected epoch、canonical key、principal、policy epoch に束縛する。
49. client cost は class/variant ごとの cold delivered manifest core、固定長 envelope、artifact、exact HTML carrier bytes を数える。
50. ObservationContract は closed constraint、partial order、refinement rule、composition binding、RealizationWitness preimage から canonical trace relation を判定する。
51. remote non-commit certainty は将来の commit を禁止する terminal tombstone と fence を atomic ledger write に含む receipt だけから導出する。
52. remote operation descriptor は input、output、failure codec と対応 value domain/failure schema を qualified ID で束縛する。
53. PolicyGrantAuthority は canonical policy input から revocable、expiring、lifetime-bound grant を発行し、author object に authority brand を与えない。
54. arbitrary JavaScript codec は通常 materialization boundary にせず、closed declarative program または host-attested enforcement を要求する。
55. subscription は qualified source descriptor、graph-table record、use schema、session identity、revision envelope、resume/ack protocol を持つ。
56. `render:client` は literal `true` の reserved JSX prop とし、dynamic/spread ambiguity を diagnostic にする。
57. reference と subscription use は digest だけでなく root anchor、concrete edge、terminal を持つ finite GraphPathWitness で path pattern に結び付ける。
58. dynamic instantiation は prepared/terminal count、byte、age、replay horizon を hard budget で admission し、terminal prefix を slot operation watermark へ圧縮する。
59. remote operation ID は issuer epoch、sequence、admission expiry を認証し、terminal prefix watermark と stateless expiry で古い ID を永久拒否する。
60. subscription resync は旧 session の captured authority を使わず、fresh grant と expected old identity を持つ request から新 session を作る。
61. projection definition は plan-independent preimage、request instance は ProjectionInstancePreimage、candidate data は plan-independent ProjectionManifestCore で分ける。
62. client delivery cost は plan 前に確定した manifest core exact bytes と candidate-invariant な固定長 outer envelope を含める。
63. generation creation operation は target generation ID を含まない closed preimage とし、generation identity の hash cycle を禁止する。
64. InstanceHandle は caller ごとの lease とし、一 caller の release でほかの caller の status、tombstone、FailureRef を失効させない。
65. remote request commitment は qualified input codec と immutable canonical captured wire を束縛し、handler はその wire から新規 materialize した input だけを受け取る。
66. 公開済み slot operation sequence は release、expiry、revocation、validation failure でも non-commit terminal へ移し、watermark を塞ぐ永久 hole を作らない。
67. codec payload 内の graph edge は content-bound CodecGraphEdgeSlotTable が wire path、kind、cardinality、ordinal を宣言した場合だけ witness に使う。
68. DisposeResult を含む全 public failure outcome は FailureRef を原子的に予約し、枯渇時も内部 terminalization を止めず explicit budget failure を返す。
69. remote call は ledger と別 namespace の local attempt ID を capture 前に作り、capture/admission failure を operationId null の pre-admission outcome にする。
70. remote authorization は evaluation、grant、generation を commitment と ledger に束縛し、revocation と effect-admission cut を private authority で線形化する。
71. remote watermark は再実行拒否だけを証明し、terminal evidence 削除後の元 outcome は valid receipt がなければ ambiguous にする。
72. subscription source は outstanding/unacknowledged revision、retained byte、gap、cursor/reconnect/resync horizon、terminal deadline、GC を closed sequence contract と hard budget で制限する。
73. subscription source は transport consistency point だけを返し、runtime wrapper が identity、grant、budget claim、deadline、cleanup ownership を保持する。
74. subscription sequence namespace は source、locator、principal、namespace domain、attested epoch の canonical preimage とし、SSR record、resume/resync、全 revision に束縛する。
75. remote terminal evidence を失った operation は public reason `terminal-evidence-expired`、recovery null の ambiguous outcome にする。
76. `dom:external` は compiler-generated external regionへ lower する reserved JSX directive とし、Dathra DOMTarget との overlap、nested owner、cleanup 不在を diagnostic にする。
77. subscription は SSR と browser の間で transport continuity ID だけを継承し、client-local owner generation を含む session identity は browser runtime wrapper が新しく導出する。
78. subscription transport event は local identity を運ばず、runtime wrapper が全 event に captured owner generation と wrapper ごとに一意な session incarnation を含む session identity を付与し、revision、terminal、acknowledgement の直前に current wrapper pair と原子的に照合する。
79. subscription sequence namespace attestation は boot record に束縛された private authority だけが検証し、source の自己申告 digest を信頼しない。
80. runtime-owned AuthorizationGrantClaim は extension へ渡さず、resolver、subscription source、remote adapter には purpose-bound AuthorizationGrantEvidence だけを渡す。
81. remote operation の implementation binding は browser transport/verifier と server-request endpoint/handler に分け、delivery は remote-delivery-adapter entry が所有し、client projection から server-only closure を排除する。
82. SubscriptionRecord は transport continuity、namespace、snapshot、cursor だけを handoff し、browser-local session identity を持たない。local resync command と source 向け transport request も分離する。
83. remote protocol は AuthorizationGrantEvidence、RemoteCapturedRequest、branded receipt を直列化せず、proof を持つ untrusted wire DTO を host authority が検証して local private object を新規生成する。
84. registry binding は kind ごとの closed environment/role table、role requirement、同一環境 import、環境別 catalog/projection、cross-environment protocol binding を正本とする。
85. remote wire は versioned canonical JCS UTF-8 frame とし、raw frame、depth、evidence、payload、materialization、codec work を RemoteProtocolBudget で effect admission 前に制限する。
86. baseline の実行環境は build、server-request、browser に閉じる。remote operation の delivery adapter は server-request で実行し、第三 runtime への再委譲は暗黙 import ではなく将来の明示 protocol とする。
87. subscription の owner generation、root binding、use schema、local session identity は runtime wrapper context にだけ保持し、source-facing open/resume/resync request または transport event へ渡さない。
88. subscription wrapper は coordinator-issued monotonic session incarnation を一つずつ持ち、同じ owner generation と transport continuity を保つ resync でも session identity digest を再利用しない。

## 現行方針の要約

現行方針は、component hydration を細分化するだけの設計ではない。
compiler が宣言的 UI から実行 obligation、effect、ownership、transfer を導出し、別々の server program と client program を生成する設計である。

```txt
declarative UI
  -> ModuleCoordinator
  -> ExecutionGraph
  -> ObservationContract composition
  -> server renderer
  -> MaterializationPlan
  -> ClientScopeGraph
  -> request-reachable client projection
```

通常の開発者は、client placement を opt-in しない。
event、state update、client effect、client-only platform operation から client root が導出される。

`activate:*` は placement を変更せず、推論済み root の起動時刻だけを指定する。
server-only work は client root から到達しないため client artifact に入らない。

## 破棄した案

この節は設計経緯であり、現行方針ではない。

### component 単位の自動 hydration

すべての `defineComponent` を client で再実行し、必要に応じて `client:*` で遅らせる方式は採用しない。
server-only work と client interaction が同じ component body にある場合、server-only dependency が client artifact へ漏れやすいためである。

この案は、ExecutionGraph と compiler 生成 client scope によって supersede された。

### `client:*` opt-in island

plain DOM、functional component、`defineComponent` に `client:*` を付けた箇所だけを client boundary にする案は採用しない。
開発者が placement の都合で component と DOM structure を分割する必要が生じ、event callback から自動導出できる client root も二重指定になるためである。

timing policy の必要性だけを `activate:*` として残した。

### reactive edge だけを hydrate unit とする案

DOM binding、event、signal、effect の edge を component より細かく抽出する方向は残した。
ただし、解析対象を runtime reactive graph だけに限定する案は採用しない。

module evaluation、ordinary value、async continuation、effect order、resource、ownership、transfer、authority も必要なため、上位概念を ExecutionGraph とした。

### 優先順位式 transfer

`inline`、`serialize`、`reconstruct`、`reference`、`remote` を順に試して最初の成功を使う方式は採用しない。
identity、consistency、exposure、lifetime を複数 step で満たす必要があり、単一の first-match では正しい plan を選べないためである。

MaterializationRequirement と EmissionRequirement を先に導出し、有限 plan DAG を比較する方式が supersede した。

### closure factory replay

server で生成した closure を、factory と input から client で作り直す一般則は採用しない。
factory evaluation 自体が observable event であり、lexical environment、private state、module identity、effect を一般には再現できないためである。

function code は build artifact として native semantics を保って出力し、capture は明示 plan で materialize する。

### unknown の暗黙 fallback

unknown code を eager hydration、full module、component rerender、RPC へ自動的に落とす案は採用しない。
unknown は、必要な proof obligation の dependency closure だけを保守的に阻止し、合法な native closure、contract、reference、diagnostic のいずれかへ進める。

### `hydrate:preserve`

static DOM は directive がなくても update plan から除外する。
server-only code を client artifact から除外する責務は compiler slicing にあるため、`hydrate:preserve` を execution partitioning API として継承しない。
