import type { SemanticFactKind } from "./factModel";
import type { FactId } from "./identity";

/** The complete source-local semantic relation taxonomy. */
type SemanticRelationKind =
  | "reads"
  | "writes"
  | "invokes"
  | "returns"
  | "owns"
  | "orders-before"
  | "transfers-as"
  | "fails-with";

/** A typed source-local fact reference used by a semantic relation. */
type FactEndpoint<Kind extends SemanticFactKind> = {
  readonly factId: FactId;
  readonly factKind: Kind;
};

type RelationBase = {
  readonly schema: "dathra.relation/1";
};

/** The closed union of source-local behavioral cross-fact edges. */
type SemanticRelation = RelationBase &
  (
    | {
        readonly kind: "reads";
        readonly from: FactEndpoint<"effect" | "invocation">;
        readonly to: FactEndpoint<"read">;
      }
    | {
        readonly kind: "writes";
        readonly from: FactEndpoint<"effect" | "invocation">;
        readonly to: FactEndpoint<"write">;
      }
    | {
        readonly kind: "invokes";
        readonly from: FactEndpoint<"effect" | "invocation">;
        readonly to: FactEndpoint<"invocation">;
      }
    | {
        readonly kind: "returns";
        readonly from: FactEndpoint<"invocation">;
        readonly to: FactEndpoint<SemanticFactKind>;
      }
    | {
        readonly kind: "owns";
        readonly from: FactEndpoint<"ownership">;
        readonly to: FactEndpoint<"identity" | "ownership" | "lifetime">;
      }
    | {
        readonly kind: "orders-before";
        readonly from: FactEndpoint<"ordering">;
        readonly to: FactEndpoint<SemanticFactKind>;
        readonly ordinal: number | null;
      }
    | {
        readonly kind: "transfers-as";
        readonly from: FactEndpoint<Exclude<SemanticFactKind, "transfer">>;
        readonly to: FactEndpoint<"transfer">;
      }
    | {
        readonly kind: "fails-with";
        readonly from: FactEndpoint<"effect" | "invocation">;
        readonly to: FactEndpoint<"failure">;
      }
  );

export type { SemanticRelationKind, FactEndpoint, SemanticRelation };
