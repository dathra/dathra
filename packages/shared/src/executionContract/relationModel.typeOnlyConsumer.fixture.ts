import type {
  FactEndpoint,
  SemanticRelation,
  SemanticRelationKind,
} from "./implementation";

type RelationConsumer = readonly [
  SemanticRelationKind,
  FactEndpoint<"read">,
  SemanticRelation,
];

export type { RelationConsumer };
