> [!CAUTION]
> Historical, provisional design from reverted PR #80. It is not a current specification or implementation plan. Embedded revision, slice, review, owner, branch, commit, push, and write-set instructions are non-operative historical context. Current `SPEC.typ` files and executable tests are authoritative; see [RFC 0001](../README.md).

# Remote operation protocol

```ts
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
