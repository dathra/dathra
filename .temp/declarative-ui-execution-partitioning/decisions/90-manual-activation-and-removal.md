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
