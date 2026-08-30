> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Client scope and activation

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
