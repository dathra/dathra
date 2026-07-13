# Codec, reference, and subscription contracts

```ts
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

```
