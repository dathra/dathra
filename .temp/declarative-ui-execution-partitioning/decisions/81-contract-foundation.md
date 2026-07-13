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
      readonly path: readonly SemanticPathSegment[];
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

```
