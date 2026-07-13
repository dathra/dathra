import type {
  ExecutionEnvironment,
  RegistryId,
} from "../executionRegistry/implementation";
import type { FactId } from "./identity";
import type { SemanticSubject } from "./model";

/** The complete source-local semantic fact taxonomy. */
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

/** A source-local value transfer declaration. */
type TransferBinding =
  | { readonly kind: "none" }
  | { readonly kind: "snapshot" }
  | {
      readonly kind: "codec";
      readonly codecId: RegistryId<"codec">;
      readonly version: string;
    }
  | {
      readonly kind: "reference";
      readonly resolverId: RegistryId<"resolver">;
      readonly version: string;
      readonly capabilityPolicyId: RegistryId<"policy">;
    }
  | {
      readonly kind: "subscription";
      readonly sourceId: RegistryId<"subscription-source">;
      readonly version: string;
    }
  | {
      readonly kind: "remote";
      readonly operationId: RegistryId<"remote-operation">;
      readonly version: string;
    };

interface FactBase {
  readonly schema: "dathra.fact/1";
  readonly id: FactId;
  readonly subject: SemanticSubject;
}

/** The closed union of source-local semantic fact claims. */
type SemanticFact = FactBase &
  (
    | {
        readonly kind: "environment";
        readonly environments: readonly ExecutionEnvironment[];
        readonly hostProfileIds: readonly RegistryId<"host-profile">[];
      }
    | {
        readonly kind: "read";
        readonly stability: "immutable" | "stable-within-token" | "may-change";
        readonly consistency:
          | "none"
          | "snapshot-token"
          | "linearizable-authority";
        readonly replay: {
          readonly duplicate: boolean;
          readonly reorder: boolean;
          readonly recompute: boolean;
        };
        readonly environmentFactId: FactId;
        readonly exposureFactId: FactId;
      }
    | {
        readonly kind: "write";
        readonly environmentFactId: FactId;
        readonly exposureFactId: FactId;
      }
    | {
        readonly kind: "effect";
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
        readonly receiverBrandId: RegistryId<"brand"> | null;
      }
    | {
        readonly kind: "identity";
        readonly scope: "none" | "realm" | "module" | "instance";
        readonly brandId: RegistryId<"brand"> | null;
      }
    | {
        readonly kind: "ownership";
        readonly retention:
          | "owned"
          | "leased"
          | "borrowed"
          | "environment-permanent";
      }
    | {
        readonly kind: "ordering";
        readonly relation: "before" | "serial" | "exclusive" | "commutative";
      }
    | {
        readonly kind: "failure";
        readonly channel: "typed-result" | "throw" | "reject" | "abort";
        readonly schemaId: RegistryId<"failure-schema">;
      }
    | {
        readonly kind: "cancellation";
        readonly point:
          | "before-start"
          | "before-commit"
          | "best-effort-after-commit";
        readonly propagation: "owned-descendants" | "explicit-edges";
      }
    | {
        readonly kind: "lifetime";
        readonly domain:
          | "call"
          | "request"
          | "generation"
          | "owner"
          | "realm"
          | "process";
        readonly cleanup: "none" | "sync" | "async";
      }
    | {
        readonly kind: "transfer";
        readonly binding: TransferBinding;
      }
    | {
        readonly kind: "exposure";
        readonly audiencePolicyId: RegistryId<"policy">;
        readonly sinkPolicyIds: readonly RegistryId<"policy">[];
        readonly releasePolicyId: RegistryId<"policy"> | null;
      }
    | {
        readonly kind: "integrity";
        readonly source:
          | "compiler"
          | "signed-manifest"
          | "validated-input"
          | "untrusted";
        readonly endorsementPolicyId: RegistryId<"policy"> | null;
      }
    | {
        readonly kind: "dependency-epoch";
        readonly epochId: string;
        readonly invalidation:
          | "content-addressed"
          | "host-supplied"
          | "explicit";
      }
    | {
        readonly kind: "trust-boundary";
        readonly enforcement:
          | "worker"
          | "sandbox"
          | "compartment"
          | "host-process";
        readonly capabilityPolicyIds: readonly RegistryId<"policy">[];
      }
  );

export type { SemanticFactKind, TransferBinding, SemanticFact };
