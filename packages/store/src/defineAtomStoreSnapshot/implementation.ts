import type { PrimitiveAtom } from "../atom/implementation";
import type { AtomStore } from "../createAtomStore/implementation";

type AtomStoreSnapshotSchema = Record<string, PrimitiveAtom<unknown>>;

type InferPrimitiveAtomValue<T> = T extends PrimitiveAtom<infer U> ? U : never;

type AtomStoreSnapshotValue<S extends AtomStoreSnapshotSchema> = {
  readonly [K in keyof S]: InferPrimitiveAtomValue<S[K]>;
};

interface AtomStoreSnapshot<S extends AtomStoreSnapshotSchema> {
  readonly schema: Readonly<S>;
  serialize(store: AtomStore): AtomStoreSnapshotValue<S>;
  values(
    snapshot: AtomStoreSnapshotValue<S>,
  ): Iterable<readonly [S[keyof S], unknown]>;
  hydrate(store: AtomStore, snapshot: AtomStoreSnapshotValue<S>): void;
}

function assertPrimitiveAtomSchema(
  schema: Record<string, { kind: string }>,
): void {
  for (const [stableId, atom] of Object.entries(schema)) {
    if (atom.kind !== "primitive") {
      throw new Error(
        `[dathra] Snapshot schema entry "${stableId}" must reference a primitive atom`,
      );
    }
  }
}

function defineAtomStoreSnapshot<const S extends AtomStoreSnapshotSchema>(
  schema: S,
): AtomStoreSnapshot<S> {
  assertPrimitiveAtomSchema(schema);

  const frozenSchema: Readonly<S> = Object.freeze({ ...schema });
  const entries = Object.entries(frozenSchema) as Array<[keyof S, S[keyof S]]>;

  return {
    schema: frozenSchema,
    serialize(store) {
      const snapshot: Partial<AtomStoreSnapshotValue<S>> = {};

      for (const [stableId, atom] of entries) {
        snapshot[stableId] = store.get(
          atom,
        ) as AtomStoreSnapshotValue<S>[keyof S];
      }

      return Object.freeze(snapshot) as AtomStoreSnapshotValue<S>;
    },
    values(snapshot) {
      return entries.map(([stableId, atom]) => {
        return [atom, snapshot[stableId]] as const;
      });
    },
    hydrate(store, snapshot) {
      for (const [stableId, atom] of entries) {
        store.set(atom, snapshot[stableId]);
      }
    },
  };
}

export { defineAtomStoreSnapshot };
export type {
  AtomStoreSnapshot,
  AtomStoreSnapshotSchema,
  AtomStoreSnapshotValue,
  InferPrimitiveAtomValue,
};
