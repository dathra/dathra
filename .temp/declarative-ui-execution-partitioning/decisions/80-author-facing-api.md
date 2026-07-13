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
