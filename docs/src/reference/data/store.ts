import type { ReferenceDocument } from "../types";

const storeReference: ReferenceDocument = {
  path: "/reference/store",
  title: "Store API Reference",
  packageName: "@dathra/store",
  exportPath: "@dathra/store",
  importPath: "@dathra/store",
  preferredImport: "@dathra/core/store",
  level: "recommended",
  audience:
    "Application authors using atom state and contributors working on SSR store boundaries.",
  description: "Atomic state management with explicit store boundaries and serializable snapshots.",
  declarationFile: "packages/store/dist/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: ["atom", "createAtomStore", "defineAtomStoreSnapshot", "getCurrentStore", "withStore"],
    },
    {
      label: "Types",
      items: [
        "AppId",
        "AtomStore",
        "AtomStoreSnapshot",
        "AtomStoreSnapshotSchema",
        "AtomStoreSnapshotValue",
        "AtomUpdate",
        "DerivedAtom",
        "Getter",
        "InferPrimitiveAtomValue",
        "PrimitiveAtom",
        "ReadableAtom",
        "ReadableAtomRef",
        "WritableAtom",
        "WritableAtomRef",
      ],
    },
  ],
  apis: [
    {
      name: "atom()",
      kind: "function",
      description: "Create primitive or derived atomic state units.",
      signature: `type Getter = <T>(atom: ReadableAtom<T>) => T;
type NonFunction<T> = T extends (...args: never[]) => unknown ? never : T;

declare function atom<T>(key: string, read: (get: Getter) => T): DerivedAtom<T>;
declare function atom<T>(key: string, initialValue: NonFunction<T>): PrimitiveAtom<T>;`,
      parameters: [
        {
          name: "key",
          type: "string",
          description: "Stable atom key used for lookup and debugging.",
        },
        {
          name: "defaultValue / read",
          type: "T | ((get: Getter) => T)",
          description: "Primitive default value or derived read function.",
        },
      ],
      returns: "A PrimitiveAtom<T> or DerivedAtom<T>.",
    },
    {
      name: "createAtomStore()",
      kind: "function",
      description: "Create an atom store instance for a Dathra application or request boundary.",
      signature: `declare function createAtomStore(options: {
  appId: AppId;
  values?: Iterable<readonly [WritableAtom<unknown>, unknown]>;
}): AtomStore;`,
      returns: "An AtomStore instance.",
    },
    {
      name: "withStore() / getCurrentStore()",
      kind: "function",
      description: "Run code within a store boundary and read the current active store.",
      signature: `declare function getCurrentStore(): AtomStore | undefined;
declare function withStore<T>(store: AtomStore, render: () => T): T;`,
      parameters: [
        { name: "store", type: "AtomStore", description: "Store to bind while render executes." },
        {
          name: "render",
          type: "() => T",
          description: "Callback that runs with the store as current context.",
        },
      ],
      returns:
        "withStore returns the callback result; getCurrentStore returns the active store or undefined.",
    },
    {
      name: "defineAtomStoreSnapshot()",
      kind: "function",
      description: "Define a serializable snapshot schema for a selected set of primitive atoms.",
      signature: `type AtomStoreSnapshotSchema = Record<string, PrimitiveAtom<unknown>>;
type InferPrimitiveAtomValue<T> = T extends PrimitiveAtom<infer U> ? U : never;
type AtomStoreSnapshotValue<S extends AtomStoreSnapshotSchema> = {
  readonly [K in keyof S]: InferPrimitiveAtomValue<S[K]>;
};

interface AtomStoreSnapshot<S extends AtomStoreSnapshotSchema> {
  readonly schema: Readonly<S>;
  serialize(store: AtomStore): AtomStoreSnapshotValue<S>;
  values(snapshot: AtomStoreSnapshotValue<S>): Iterable<readonly [S[keyof S], unknown]>;
  hydrate(store: AtomStore, snapshot: AtomStoreSnapshotValue<S>): void;
}

declare function defineAtomStoreSnapshot<const S extends AtomStoreSnapshotSchema>(schema: S): AtomStoreSnapshot<S>;`,
      parameters: [
        {
          name: "schema",
          type: "S extends AtomStoreSnapshotSchema",
          description: "Object mapping snapshot field names to primitive atoms.",
        },
      ],
      returns: "An AtomStoreSnapshot<S> with serialize, values, and hydrate helpers.",
    },
  ],
};

const storeInternalReference: ReferenceDocument = {
  path: "/reference/store/internal",
  title: "Store Internal API Reference",
  packageName: "@dathra/store",
  exportPath: "@dathra/store/internal",
  importPath: "@dathra/store/internal",
  level: "internal",
  audience: "Dathra contributors and packages that intentionally consume exported store internals.",
  description: "Internal-but-exported access to the current store boundary.",
  declarationFile: "packages/store/dist/internal.d.mts",
  exports: [{ label: "Functions", items: ["getCurrentStore"] }],
  apis: [
    {
      name: "getCurrentStore()",
      kind: "function",
      description: "Return the currently active store in the nearest withStore boundary.",
      signature: "declare function getCurrentStore(): AtomStore | undefined;",
      returns: "The current AtomStore or undefined.",
      notes: [
        "The root @dathra/store export also exposes getCurrentStore(). Use the root export unless you are integrating package internals.",
      ],
    },
  ],
};

export { storeInternalReference, storeReference };
