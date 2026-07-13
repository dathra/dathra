import type {
  FactEndpoint,
  SemanticFactKind,
  SemanticRelation,
  SemanticRelationKind,
} from "./implementation";

type RelationVariant<Kind extends SemanticRelationKind> = Extract<
  SemanticRelation,
  { readonly kind: Kind }
>;

declare const factId: FactEndpoint<SemanticFactKind>["factId"];
declare const reads: RelationVariant<"reads">;
declare const writes: RelationVariant<"writes">;
declare const invokes: RelationVariant<"invokes">;
declare const returns: RelationVariant<"returns">;
declare const owns: RelationVariant<"owns">;
declare const ordersBefore: RelationVariant<"orders-before">;
declare const transfersAs: RelationVariant<"transfers-as">;
declare const failsWith: RelationVariant<"fails-with">;

// @ts-expect-error Relation discriminants are readonly.
reads.kind = "reads";
// @ts-expect-error Relation endpoints are readonly.
reads.from = { factId, factKind: "effect" };
// @ts-expect-error Endpoint fact identifiers are readonly.
reads.from.factId = factId;
// @ts-expect-error Endpoint kind tags are readonly.
reads.from.factKind = "effect";
// @ts-expect-error Ordering ordinals are readonly.
ordersBefore.ordinal = 1;

const readsFromRead: RelationVariant<"reads"> = {
  ...reads,
  from: {
    factId,
    // @ts-expect-error Reads starts only from effect or invocation facts.
    factKind: "read",
  },
};
void readsFromRead;

const readsToWrite: RelationVariant<"reads"> = {
  ...reads,
  to: {
    factId,
    // @ts-expect-error Reads targets only read facts.
    factKind: "write",
  },
};
void readsToWrite;

const writesFromRead: RelationVariant<"writes"> = {
  ...writes,
  from: {
    factId,
    // @ts-expect-error Writes starts only from effect or invocation facts.
    factKind: "read",
  },
};
void writesFromRead;

const writesToRead: RelationVariant<"writes"> = {
  ...writes,
  to: {
    factId,
    // @ts-expect-error Writes targets only write facts.
    factKind: "read",
  },
};
void writesToRead;

const invokesFromRead: RelationVariant<"invokes"> = {
  ...invokes,
  from: {
    factId,
    // @ts-expect-error Invokes starts only from effect or invocation facts.
    factKind: "read",
  },
};
void invokesFromRead;

const invokesToRead: RelationVariant<"invokes"> = {
  ...invokes,
  to: {
    factId,
    // @ts-expect-error Invokes targets only invocation facts.
    factKind: "read",
  },
};
void invokesToRead;

const returnsFromEffect: RelationVariant<"returns"> = {
  ...returns,
  from: {
    factId,
    // @ts-expect-error Returns starts only from invocation facts.
    factKind: "effect",
  },
};
void returnsFromEffect;

const returnsToUnknown: RelationVariant<"returns"> = {
  ...returns,
  to: {
    factId,
    // @ts-expect-error Returns targets only closed semantic fact kinds.
    factKind: "unknown",
  },
};
void returnsToUnknown;

const ownsFromIdentity: RelationVariant<"owns"> = {
  ...owns,
  from: {
    factId,
    // @ts-expect-error Owns starts only from ownership facts.
    factKind: "identity",
  },
};
void ownsFromIdentity;

const ownsToRead: RelationVariant<"owns"> = {
  ...owns,
  to: {
    factId,
    // @ts-expect-error Owns targets only identity, ownership, or lifetime facts.
    factKind: "read",
  },
};
void ownsToRead;

const ordersFromEffect: RelationVariant<"orders-before"> = {
  ...ordersBefore,
  from: {
    factId,
    // @ts-expect-error Orders-before starts only from ordering facts.
    factKind: "effect",
  },
};
void ordersFromEffect;

const ordersToUnknown: RelationVariant<"orders-before"> = {
  ...ordersBefore,
  to: {
    factId,
    // @ts-expect-error Orders-before targets only closed semantic fact kinds.
    factKind: "unknown",
  },
};
void ordersToUnknown;

const transfersFromTransfer: RelationVariant<"transfers-as"> = {
  ...transfersAs,
  from: {
    factId,
    // @ts-expect-error Transfer facts cannot be transfers-as sources.
    factKind: "transfer",
  },
};
void transfersFromTransfer;

const transfersToRead: RelationVariant<"transfers-as"> = {
  ...transfersAs,
  to: {
    factId,
    // @ts-expect-error Transfers-as targets only transfer facts.
    factKind: "read",
  },
};
void transfersToRead;

const failsFromRead: RelationVariant<"fails-with"> = {
  ...failsWith,
  from: {
    factId,
    // @ts-expect-error Fails-with starts only from effect or invocation facts.
    factKind: "read",
  },
};
void failsFromRead;

const failsToRead: RelationVariant<"fails-with"> = {
  ...failsWith,
  to: {
    factId,
    // @ts-expect-error Fails-with targets only failure facts.
    factKind: "read",
  },
};
void failsToRead;

const readsWithUndefinedOrdinal: RelationVariant<"reads"> = {
  ...reads,
  // @ts-expect-error Non-ordering relations have no ordinal key.
  ordinal: undefined,
};
void readsWithUndefinedOrdinal;

// @ts-expect-error Orders-before requires an explicit number or null ordinal.
const ordersWithoutOrdinal: RelationVariant<"orders-before"> = {
  schema: "dathra.relation/1",
  kind: "orders-before",
  from: { factId, factKind: "ordering" },
  to: { factId, factKind: "read" },
};
void ordersWithoutOrdinal;
