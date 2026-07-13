### server-first の合法性

初期 UI obligation を持つ root は、契約で固定した initial cut において server materialization を持たなければならない。
planner が admission point を後ろへ移して client rendering を server rendering に見せかけることは許可しない。

client-only initial UI は例外である。
例外を使えるのは、compiler が legal な server materialization を構成できないと証明した root に限る。
その root は、root-local な `render:client` contract を持たなければならない。
server materialization を構成できず、client-only contract もない場合は diagnostic とする。

server artifact が initial DOM root を満たすには、**RealizationWitness** が必要である。
RealizationWitness は、target host、encoding、content type、document mode、base URL、policy、custom-element registry、parser、upgrade、adopt の effect を記録する。

初期 DOM の各 observable node と value は、server artifact token、または author code を実行しない規範的な parser operation に由来しなければならない。
DSD は server artifact token と parser operation の連続した chain として証明する。
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
  readonly targetArtifactAddressId: ArtifactAddressId;
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

declare const artifactAddressIdBrand: unique symbol;

type ArtifactAddressId = Sha256Digest & {
  readonly [artifactAddressIdBrand]: true;
};

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

ArtifactAddressIdはgenericなSha256Digestと異なるnominal domainである。
plain string、generic digest、別のmandatory unique-symbol brandをArtifactAddressIdへ直接代入できない。
ArtifactAddressIdはSha256Digestまたはstringへwideningできるが、基礎型へwideningした後のdomain separationは保証しない。

このtypeだけではpreimage、provenance、referent closure、exact-byte integrityを証明しない。
brandを発行するidentity operation、preimage validator、parser、canonical URL、integrity tableは後続AR01 unitが所有する。
任意のcanonical digestを字句検査だけでArtifactAddressIdへ変換するAPIは提供しない。
後続producerは、ArtifactAddressPreimageを検証するidentity operationからだけArtifactAddressIdを発行する。
package-local type-only foundationはruntime JavaScriptを生成せず、shared rootへの公開はAS01が所有する。

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

#### deployment identity と artifact address preimage の実装境界

この決定は、`DeploymentIdentityPreimage`と`ArtifactAddressPreimage`を同じtype-only revisionへ含める案をsupersedeする。
両schemaはpersistent identity inputだが、別々にgreenへでき、共有facadeを逐次更新できるため、AR01-DPを完了してからAR01-Pを開始する。

正準名は`DeploymentIdentityPreimage`と`ArtifactAddressPreimage`である。
historical review proposalにある`ArtifactAddressPreimageSource`と`ArtifactKind`は現行APIではなく、`kind`は`"javascript" | "wasm" | "data"`のdirect inline unionとする。

AR01-DPは7個のrequired readonly fieldを持つexact typeだけを追加する。
digest fieldはgenericな`Sha256Digest`を使い、`DeploymentIdentityDigest`、`DeploymentIdentityId`、brand、source aliasを追加しない。
plain string fieldへのtype適合はsyntax、origin canonicality、namespace、host profile、deployment admissionを証明しない。

AR01-DP以降のownerは次の依存順に分ける。

| revision | owner | downstreamへ渡す証拠 |
| --- | --- | --- |
| AR01-DS | hostile unknown inputのclosed descriptor snapshot | fresh scalar snapshot |
| AR01-DV | deployment fieldとpublic originのsemantic canonical validation | deep-frozen validated preimage |
| AR01-DD | validated preimage全体のcanonical digest | generic `Sha256Digest` |
| AF01 | accepted candidateとcandidate-specific planごとのdeployment/artifact finalization | candidate-specific finalized evidence |
| SL01 | AF01がfinalizeしたresultだけからの最終選択 | selected AF01 evidence |
| RR01 | selected evidenceのauthenticated runtime conformance | runtime admission result |

AR01-DDはAR01-DVのexact snapshotを`digestCanonicalJson()`へ一回渡し、partial projectionまたはambient deployment stateを混入させない。
成功はpreimageのcanonical digestだけを証明し、application、release、target environment、host profileの実在またはtrustを証明しない。

AF01は「選択済みcandidate」を入力にしない。
CN01-Lのaccepted candidateとMP02のcandidate-specific planごとにdeployment identityを束縛してfinalizeし、その完了resultだけをSL01が比較する。

AR01-PはID01と既存AR01-DP、AR01-FT、AR01-EB、AR01-DB、AR01-XBへ依存し、canonical schemaにある10個のrequired readonly fieldだけを追加する。
`ArtifactAddressPreimageSource`、`ArtifactKind`、source alias、derived digest、derived URL、byte lengthを追加しない。
readonly collectionはstructural sequenceであり、empty、duplicate、unsorted、dangling、role mismatch、kind/template mismatchをtypeだけでは拒否しない。

AR01-P以降のownerは次の依存順に分ける。

| revision | owner | 明示的に証明しないもの |
| --- | --- | --- |
| AR01-PS | hostile unknown inputのclosed structural snapshot | canonical order、referent existence |
| AR01-PV-U/O/E/K/S/I | base URL input、sort、duplicate、ordinal、kind/template、local consistencyのsemantic validationと統合 | target artifact existence、placement、trust |
| AR01-PI | validated preimage digestとpost-success `ArtifactAddressId` brand発行 | referent closure、final bytes、client inclusion |
| AR01-PC-I/T/X/S/C | target address/export index、existence、compatibilityとartifact dependency graph closure統合 | candidate selection、runtime trust |
| AR01-URL | normalized base、kind segment、address、extensionからのcanonical URL contract | actual fetch bytes |
| AR01-IT-M/S/V | address、exact digest、byte lengthを持つintegrity table schema、snapshot、validation | table production、runtime conformance |

AR01-Pのtype-only fixtureはexact key、modifier、direct inline union、invalid stateの表現可能性、runtime-empty emit、shared-root非公開だけを検査する。
compile-time fixtureは`declare const targetId: ArtifactAddressId`を使えるが、runtime JCS fixtureのためにprivate brandをassertionで捏造しない。

full-field identity fixtureはAR01-PIが所有する。
最初にdependencyを持たないlegitimate leaf preimageから`ArtifactAddressId`を発行し、そのIDでnon-empty dependency fixtureを構築する。
validated snapshot全体が再projectionされずdigestへ渡ること、合法なtyped mutationがdigestを変えること、異なる二要素を持つraw canonical corpusの追加、削除、値、順序がbytesを変えることを別々に検査する。
unsortedまたはduplicate collectionはAR01-PV-O/Eがdigest前に拒否し、singleton schema mutationはuntyped validator negative fixtureへ置く。

AR01-URLはcanonical URL derivation contractを、AR01-IT-M/S/Vはintegrity schema、snapshot、validatorを所有する。
AF01はcandidateごとにactual deployment、artifact graph、canonical URL、final bytes、integrity table、reproduction evidenceを生成する。
AR01のschema/validatorとAF01のproductionを同じ責務として扱わない。

CN01-Lはcandidate legalityとplacement、SL01はAF01-finalized candidateのselection、RR01はselected AF01 evidenceのruntime conformance、AS01はrootまたはsubpath publicationを所有する。
RR01はselected deployment preimage/digest、`artifactBaseUrl`、address preimage/digest、canonical URL、actual exact digest、byte length、integrityを相互検証し、不一致時に別candidate、artifact、URLへfallbackしない。

AR01-DPの手書き差分は合計700行、最大test file 300行以下を見込む。
AR01-Pはruntime JCS matrixをAR01-PIへ移したうえで合計900行、最大test file 350行以下を見込む。
合計1,500行または一file 1,000行の停止条件へ達した場合は実装を止め、fixture責務を別review revisionへ再分割する。

#### artifact contract error と resource foundation の実装分割

AR01-DSとAR01-PSを開始する前に、error contract、budget/ledger、descriptor snapshotの課金順を固定する。
error、budget contract、ledger、descriptor kernelは別々にgreenへできるため、`AR01-E -> AR01-B-C -> AR01-B-L -> AR01-K -> {AR01-DS, AR01-PS}`の独立revisionに分ける。
AR01-DDとAR01-PIの前には、canonical textを生成せずexact byte/workを課金する`AR01-CM-T/B/W/R`を置く。

AR01-Eは次のpackage-localなexact error codeだけを提供する。

```ts
type ArtifactContractErrorCode =
  | "invalid-closed-record"
  | "invalid-field"
  | "invalid-url"
  | "noncanonical-order"
  | "duplicate-record"
  | "dangling-reference"
  | "kind-mismatch"
  | "semantic-mismatch"
  | "budget-exceeded"
  | "crypto-unavailable";

class ArtifactContractError extends TypeError {
  readonly code: ArtifactContractErrorCode;
  readonly path: readonly (string | number)[];

  constructor(
    code: ArtifactContractErrorCode,
    path: readonly (string | number)[],
    message: string,
  );
}
```

`ArtifactContractError`は`name`を`"ArtifactContractError"`に固定する。
constructorはcaller pathをfresh arrayへcopyしてfreezeし、初期化後のerror object自身もfreezeする。
stable observationはclass、`TypeError`継承、name、code、root-relative pathだけであり、message文言とstackはcontractにしない。
path helper aliasはpackage-local facadeへ追加せず、path typeをerror fieldとconstructorへinlineにする。

後続internal moduleは`fail(code, path, detail): never`をerror moduleから使えるが、package-local facadeは`ArtifactContractError`をruntime value、`ArtifactContractErrorCode`をtypeとしてだけexportする。
`fail`、path formatter、helper typeをfacadeからexportしない。
shared package rootへの公開はAS01だけが所有する。

各codeの意味とownerを次に固定する。

| code | 意味 | owner |
| --- | --- | --- |
| `invalid-closed-record` | prototype、own key、descriptor、accessor、hidden/symbol property、sparse collection、reflection failureによりclosed dataとして観測できない | AR01-K、AR01-DS、AR01-PS、AR01-IT-S |
| `invalid-field` | closed snapshot内のscalar、literal、digest lexical form、number、schema、required relation endpointの値自体がfield contractを満たさない | AR01-DV、AR01-DD、AR01-PV-U/O/E/K/S/I、AR01-PI、AR01-IT-V |
| `invalid-url` | URLがparse不能、許可scheme/origin/path条件違反、canonical serializerまたはderived URLと不一致 | AR01-DV、AR01-PV-U、AR01-URL |
| `noncanonical-order` | collection elementは個別にvalidだが採択済みcomparator順ではない | AR01-PV-O、AR01-PV-E、AR01-IT-V |
| `duplicate-record` | canonical keyまたはidentity tupleがcollection内で重複する | AR01-PV-O、AR01-PV-E、AR01-PC-I、AR01-IT-V |
| `dangling-reference` | graph closure時に要求されたartifact、member、exportなどのreferentが存在しない | AR01-PC-T、AR01-PC-X |
| `kind-mismatch` | referentは存在するがartifact、dependency、finalization kindの組合せが許可されない | AR01-PV-K、AR01-PV-S、AR01-PC-S |
| `semantic-mismatch` | referentとkindは存在するがentry、export、member roleまたはsemantic bindingが一致しない | AR01-PV-S、AR01-PC-S |
| `budget-exceeded` | AR01-B-Cが定義するoperation-local hard limitを課金前検査で超える | AR01-B-L以降の課金sliceとAR01-CM-R |
| `crypto-unavailable` | canonical digestに必要なWebCrypto capabilityが利用できない | AR01-DD、AR01-PI |

schema version違反と不正なaddress lexical formは`invalid-field`にする。
`digest-mismatch`、`integrity-mismatch`、`authentication-failed`、actual-byte mismatch、fallback codeはAR01へ追加しない。
artifact exact bytesとselected evidenceの照合はAF01、SL01、RR01が所有する。

pathは各operationが直接受け取ったinput rootに相対なproperty名またはarray indexのsequenceとする。
WebCrypto不在とinput内の一箇所へ帰属できないcanonical byte/work budget failureは空path `[]`にする。
nested operationのprefix、複数failureのprecedence、budget counterごとのpathは各operationのSPECで固定し、AR01-Eでは決めない。

AR01-Eはerror objectを作る能力だけを提供し、input acceptance、canonicality、identity、trust、provenance、placement、client inclusion、runtime admissionの証拠を生成しない。
完全なAR01 parser、validator、producer surfaceはbuild/server側に残し、error classの存在をclient artifactへの到達許可にしない。

AR01-B-CとAR01-B-LはAR01-Eの`budget-exceeded`を再利用するが、AR01-Eはbudget type、ledger、default、override、counterを持たない。
AR01-B-Cはexact counter、hard cap、narrow-only override、AR01-B-Lはoperation-local ledgerとrollbackだけを独立して設計、review、実装する。
generic shared snapshot utilityは現時点で追加せず、artifact-local descriptor kernelをDSとPSで共有できるかを各snapshot revisionで判断する。

#### artifact resource、validation、closure の追加分割

この決定は、`AR01-B`、`AR01-PV`、`AR01-PC`、`AR01-IT`をそれぞれ一つのimplementation revisionとして扱う案をsupersedeする。
AR01-E、AR01-DD、AR01-PI、AR01-URLは現行の独立境界を維持する。

budget contractとledgerは別々に直接検証できるため、次の順序へ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| AR01-B-C | exact budget counter、default hard cap、closed narrow-only override resolution | AR01-E | 全counterのdefault、0/exact/+1 override、extra/hidden/accessor、root/field error path |
| AR01-B-L | operation-local cumulative/peak ledgerと失敗時rollback | AR01-B-C | exact/limit+1、overflow、ledger isolation、失敗increment非適用 |

AR01-B-Cは課金を行わず、AR01-B-Lはhostile inputやartifact fieldを解釈しない。
exact counterとhard capはAR01-B-Cの先行design reviewで固定する。

operation全体の課金順は一つのaggregate ownerへ戻さず、各consumerとintegration ownerへ割り当てる。

| timing owner | 課金順の検証義務 |
| --- | --- |
| AR01-B-C | hostile budget overrideをartifact inputより先にclosed validationする |
| AR01-K | own key数とkey長、array length、property workをdescriptor completionより先に課金する |
| AR01-DS、AR01-PS、AR01-IT-S | data node、depth、string value、collection occurrenceをprojection allocationより先に課金する |
| AR01-DV、AR01-PV-U/O/E/K/S、AR01-IT-V | Unicode scan、URL parse、comparison、Set/index構築より先にstring/validation stepを課金する |
| AR01-PC-I/T/X/S | index allocation、lookup、compatibility probeより先にcardinality/validation stepを課金する |
| AR01-CM-R | DD/PIのcanonicalizeまたはdigest callより先にexact byte/workとdownstream builder分を同じledgerへ予約する |
| AR01-PV-I、AR01-PC-C | sibling evidenceを採択済み順で統合し、先行failure後に後続validatorまたはidentityを呼ばない |

各ownerは自身の入力root相対pathとfailure precedenceをfocused testで固定する。

AR01-DDとAR01-PIに必要なbounded canonical meterは、traversal、byte、work、ledger reservationへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| AR01-CM-T | canonical outputを生成しないiterative measurement traversal/event contract | ID01-CB | scalar/container/key event、iterative depth、cycle/alias occurrence、path一致 |
| AR01-CM-B | T eventからのexact canonical UTF-8 byte measurement | AR01-CM-T | ID01 byte oracle、Unicode/number/escape/key punctuation、property insertion permutation |
| AR01-CM-W | T eventからのcanonical work upper-bound measurement | AR01-CM-T | comparison/move/common-prefix、property insertion permutation、saturating arithmetic |
| AR01-CM-R | byte/workとdownstream builder分のoperation-local ledger reservation | AR01-CM-B、AR01-CM-W、AR01-B-L | exact/limit+1、二重予約、failure時zero canonicalize/digest call |

AR01-CM-BとAR01-CM-Wは同じT event contractだけへ依存し、後述する排他的focused pathで並列reviewできる。
AR01-CM-Rはcanonical textまたはdigestを生成せず、AR01-DDとAR01-PIだけがvalidated preimageをdigestへ渡す。

deploymentとartifactのhostile snapshotは、共通kernelとschema projectionへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| AR01-K | artifact-local descriptor capture kernel | AR01-B-L | getter非実行、prototype、own key/descriptor、identity cache、課金順、failure path |
| AR01-DS | deployment identity schema projection | AR01-K、AR01-DP | exact 7-field snapshot、fresh scalar output、caller非再読 |
| AR01-PS | artifact address schema/collection projection | AR01-K、AR01-P | exact 10-field snapshot、nested collection occurrence、fresh unbranded output、caller非再読 |

AR01-Kはdeployment/artifact field名、URL、canonical order、referentを解釈しない。
AR01-DSとAR01-PSはK completion後にdisjoint module/testとして並列reviewできる。

AR01-PVのsemantic validationは次の独立revisionへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| AR01-PV-U | `artifactBaseUrl`のabsolute/canonical URL validation | AR01-PS | scheme、credentials、query/fragment、default port、dot segment、末尾slash |
| AR01-PV-O | collection comparator、canonical order、duplicate rejection | AR01-PS | member、dependency、exportのexact comparator、null位置、unsorted/duplicate path |
| AR01-PV-E | entry bindingのorder、ordinal、gap-free uniqueness | AR01-PS | empty/non-empty、0 start、gap、duplicate、role/name tuple order |
| AR01-PV-K | artifact kindとfinalization/dependency template compatibility | AR01-PS | javascript/wasm/dataごとの合法matrixとkind mismatch path |
| AR01-PV-S | member、entry、export、dependencyのartifact-local semantic consistency | AR01-PS | local referent、role compatibility、semantic mismatch path |
| AR01-PV-I | U/O/E/K/S結果の統合とdeep-frozen validated preimage発行 | AR01-PV-U、PV-O、PV-E、PV-K、PV-S | caller再読なし、全field保持、失敗時identity zero call、fresh frozen output |

AR01-PV-U、PV-O、PV-E、PV-K、PV-Sはvalidated brandまたはaggregate resultを単独発行しない。
各revisionは同じAR01-PS snapshotをread-only入力にでき、disjoint module/testとして並列reviewできる。
AR01-PV-Iだけが全証拠を束ね、AR01-PIへ渡すvalidated preimageを発行する。

AR01-PCのgraph closureはindex、existence、compatibility、integrationへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| AR01-PC-I | PI-issued artifact addressによるimmutable artifact/export index | AR01-PI | duplicate artifact、deterministic index、input cardinality、caller非再読 |
| AR01-PC-T | dependency target artifact existence closure | AR01-PC-I | dangling target、self edge policy、all dependency occurrence、failure path |
| AR01-PC-X | target export existence closure | AR01-PC-I | null export、missing export、duplicate export、failure path |
| AR01-PC-S | resolved target/exportのkindとsemantic compatibility | AR01-PC-T、AR01-PC-X | dependency kind、artifact kind、export role、semantic binding matrix |
| AR01-PC-C | T/X/S結果の統合とclosed artifact graph発行 | AR01-PC-S | dangling zero、全address/export binding保持、fresh frozen closure、fallback禁止 |

AR01-PC-TとAR01-PC-Xは同じimmutable indexへ依存し、disjoint module/testとして並列reviewできる。
AR01-PC-Sは存在しないreferentをsentinelで扱わず、T/Xが解決したtargetだけを受け取る。

AR01-ITはtype、hostile snapshot、semantic validationへ分ける。

| revision | owner | dependency | 独立した検証 |
| --- | --- | --- | --- |
| AR01-IT-M | `ArtifactIntegrityEntry`と`ArtifactIntegrityTable`のexact type-only schema | AR01-PI | exact key/modifier/type、runtime-empty、root非公開 |
| AR01-IT-S | unknown integrity tableのclosed structural snapshot | AR01-K、AR01-IT-M | getter非実行、entry occurrence、budget、fresh scalar snapshot |
| AR01-IT-V | schema、address order/duplicate、digest、byteLengthのsemantic validation | AR01-IT-S | exact schema、canonical order、duplicate、safe byteLength、fresh frozen output |

AR01-IT-Mはvalidatorまたはruntime authorityを追加せず、AR01-IT-Sはcanonical orderとdigest意味を解釈しない。
integrity table productionとselected runtime conformanceは引き続きAF01、SL01、RR01が所有する。

追加分割後の主要dependencyは次の順序とする。

```text
AR01-E -> AR01-B-C -> AR01-B-L -> AR01-K -> { AR01-DS, AR01-PS }
ID01-CB -> AR01-CM-T -> { AR01-CM-B, AR01-CM-W } -> AR01-CM-R
AR01-DS -> AR01-DV -> AR01-DD; AR01-DD also depends on AR01-CM-R
AR01-PS -> { PV-U, PV-O, PV-E, PV-K, PV-S } -> PV-I -> AR01-PI; AR01-PI also depends on AR01-CM-R
AR01-PI -> PC-I -> { PC-T, PC-X } -> PC-S -> PC-C
AR01-PI -> IT-M -> IT-S -> IT-V
```

追加分割sliceの排他的focused write setを次に固定する。

| revision | production path | focused test path | type fixture path |
| --- | --- | --- | --- |
| AR01-B-C | `artifactContract/budgetContract.ts` | `artifactContract/budgetContract.test.ts` | `artifactContract/budgetContract.type-fixture.ts` |
| AR01-B-L | `artifactContract/budgetLedger.ts` | `artifactContract/budgetLedger.test.ts` | `artifactContract/budgetLedger.type-fixture.ts` |
| AR01-CM-T | `artifactContract/canonicalMeasurementTraversal.ts` | `artifactContract/canonicalMeasurementTraversal.test.ts` | `artifactContract/canonicalMeasurementTraversal.type-fixture.ts` |
| AR01-CM-B | `artifactContract/canonicalByteMeasurement.ts` | `artifactContract/canonicalByteMeasurement.test.ts` | N/A。T event consumerだけを所有する |
| AR01-CM-W | `artifactContract/canonicalWorkMeasurement.ts` | `artifactContract/canonicalWorkMeasurement.test.ts` | N/A。T event consumerだけを所有する |
| AR01-CM-R | `artifactContract/canonicalMeasurement.ts` | `artifactContract/canonicalMeasurement.test.ts` | `artifactContract/canonicalMeasurement.type-fixture.ts` |
| AR01-K | `artifactContract/descriptorCapture.ts` | `artifactContract/descriptorCapture.test.ts` | `artifactContract/descriptorCapture.type-fixture.ts` |
| AR01-DS | `artifactContract/deploymentSnapshot.ts` | `artifactContract/deploymentSnapshot.test.ts` | `artifactContract/deploymentSnapshot.type-fixture.ts` |
| AR01-PS | `artifactContract/artifactAddressSnapshot.ts` | `artifactContract/artifactAddressSnapshot.test.ts` | `artifactContract/artifactAddressSnapshot.type-fixture.ts` |
| AR01-PV-U | `artifactContract/artifactBaseUrlValidation.ts` | `artifactContract/artifactBaseUrlValidation.test.ts` | N/A。snapshot validatorだけを所有する |
| AR01-PV-O | `artifactContract/artifactCollectionOrderValidation.ts` | `artifactContract/artifactCollectionOrderValidation.test.ts` | N/A。snapshot validatorだけを所有する |
| AR01-PV-E | `artifactContract/artifactEntryValidation.ts` | `artifactContract/artifactEntryValidation.test.ts` | N/A。snapshot validatorだけを所有する |
| AR01-PV-K | `artifactContract/artifactKindCompatibility.ts` | `artifactContract/artifactKindCompatibility.test.ts` | N/A。snapshot validatorだけを所有する |
| AR01-PV-S | `artifactContract/artifactSemanticConsistency.ts` | `artifactContract/artifactSemanticConsistency.test.ts` | N/A。snapshot validatorだけを所有する |
| AR01-PV-I | `artifactContract/artifactPreimageValidation.ts` | `artifactContract/artifactPreimageValidation.test.ts` | `artifactContract/artifactPreimageValidation.type-fixture.ts` |
| AR01-PC-I | `artifactContract/artifactGraphIndex.ts` | `artifactContract/artifactGraphIndex.test.ts` | `artifactContract/artifactGraphIndex.type-fixture.ts` |
| AR01-PC-T | `artifactContract/artifactTargetClosure.ts` | `artifactContract/artifactTargetClosure.test.ts` | N/A。resolved evidenceだけを返す |
| AR01-PC-X | `artifactContract/artifactExportClosure.ts` | `artifactContract/artifactExportClosure.test.ts` | N/A。resolved evidenceだけを返す |
| AR01-PC-S | `artifactContract/artifactCompatibilityClosure.ts` | `artifactContract/artifactCompatibilityClosure.test.ts` | N/A。resolved evidence consumerだけを所有する |
| AR01-PC-C | `artifactContract/artifactGraphClosure.ts` | `artifactContract/artifactGraphClosure.test.ts` | `artifactContract/artifactGraphClosure.type-fixture.ts` |
| AR01-IT-M | `artifactContract/integrityTableModel.ts` | `artifactContract/integrityTableModel.test.ts` | `artifactContract/integrityTableModel.type-fixture.ts` |
| AR01-IT-S | `artifactContract/integrityTableSnapshot.ts` | `artifactContract/integrityTableSnapshot.test.ts` | `artifactContract/integrityTableSnapshot.type-fixture.ts` |
| AR01-IT-V | `artifactContract/integrityTableValidation.ts` | `artifactContract/integrityTableValidation.test.ts` | `artifactContract/integrityTableValidation.type-fixture.ts` |

この表のpathはslice間で共有しない。
`artifactContract/SPEC.typ`、`artifactContract/implementation.test.ts`、package facade、shared root、進捗文書はmain integration ownerがslice revision固定前に一sliceずつ逐次統合する。

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
