import {
  computed,
  signal,
  type Computed,
  type Signal,
  type SignalUpdate,
} from "@dathra/reactivity";

import type {
  DerivedAtom,
  PrimitiveAtom,
  ReadableAtom,
} from "../atom/implementation";

type AppId = string;
type AtomUpdate<T> = SignalUpdate<T>;

interface ReadableAtomRef<T> {
  readonly value: T;
  peek(): T;
}

interface WritableAtomRef<T> extends ReadableAtomRef<T> {
  set(update: AtomUpdate<T>): void;
}

interface AtomStore {
  readonly appId: AppId;
  ref<T>(atom: DerivedAtom<T>): ReadableAtomRef<T>;
  ref<T>(atom: PrimitiveAtom<T>): WritableAtomRef<T>;
  get<T>(atom: ReadableAtom<T>): T;
  peek<T>(atom: ReadableAtom<T>): T;
  set<T>(atom: PrimitiveAtom<T>, update: AtomUpdate<T>): void;
  fork(options?: {
    values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>;
  }): AtomStore;
  dispose(): void;
}

interface PrimitiveEntry<T> {
  effective: Computed<T>;
  hasLocal: Signal<boolean>;
  local: Signal<T>;
  ref: WritableAtomRef<T>;
}

interface DerivedEntry<T> {
  computed: Computed<T>;
  ref: ReadableAtomRef<T>;
}

function isDerivedAtom<T>(atom: ReadableAtom<T>): atom is DerivedAtom<T> {
  return atom.kind === "derived";
}

class AtomStoreImpl implements AtomStore {
  readonly appId: AppId;

  #children = new Set<AtomStoreImpl>();
  #derivedEntries = new Map<DerivedAtom<unknown>, DerivedEntry<unknown>>();
  #disposed = false;
  #parent: AtomStoreImpl | undefined;
  #primitiveEntries = new Map<
    PrimitiveAtom<unknown>,
    PrimitiveEntry<unknown>
  >();

  constructor(
    appId: AppId,
    parent?: AtomStoreImpl,
    values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>,
  ) {
    this.appId = appId;
    this.#parent = parent;
    if (parent !== undefined) {
      parent.#children.add(this);
    }

    if (values !== undefined) {
      for (const [atom, value] of values) {
        this.#ensurePrimitiveEntry(atom, value, true);
      }
    }
  }

  ref<T>(atom: DerivedAtom<T>): ReadableAtomRef<T>;
  ref<T>(atom: PrimitiveAtom<T>): WritableAtomRef<T>;
  ref<T>(atom: ReadableAtom<T>): ReadableAtomRef<T> | WritableAtomRef<T> {
    this.#assertActive();
    if (isDerivedAtom(atom)) {
      return this.#ensureDerivedEntry(atom).ref;
    }
    return this.#ensurePrimitiveEntry(atom).ref;
  }

  get<T>(atom: ReadableAtom<T>): T {
    if (isDerivedAtom(atom)) {
      return this.ref(atom).value;
    }
    return this.ref(atom).value;
  }

  peek<T>(atom: ReadableAtom<T>): T {
    if (isDerivedAtom(atom)) {
      return this.ref(atom).peek();
    }
    return this.ref(atom).peek();
  }

  set<T>(atom: PrimitiveAtom<T>, update: AtomUpdate<T>): void {
    this.#assertActive();
    this.#applyPrimitiveUpdate(this.#ensurePrimitiveEntry(atom), update);
  }

  fork(options?: {
    values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>;
  }): AtomStore {
    this.#assertActive();
    return new AtomStoreImpl(this.appId, this, options?.values);
  }

  dispose(): void {
    if (this.#disposed) return;

    const children = Array.from(this.#children);
    for (const child of children) {
      child.dispose();
    }

    this.#children.clear();
    const parent = this.#parent;
    if (parent !== undefined) {
      parent.#children.delete(this);
    }
    this.#parent = undefined;
    this.#primitiveEntries.clear();
    this.#derivedEntries.clear();
    this.#disposed = true;
  }

  #applyPrimitiveUpdate<T>(
    entry: PrimitiveEntry<T>,
    update: AtomUpdate<T>,
  ): void {
    this.#assertActive();
    const previousValue = entry.effective.peek();
    const nextValue =
      typeof update === "function"
        ? (update as (prev: T) => T)(previousValue)
        : update;

    entry.local.set(nextValue);
    if (!entry.hasLocal.peek()) {
      entry.hasLocal.set(true);
    }
  }

  #assertActive(): void {
    if (this.#disposed) {
      throw new Error("AtomStore has been disposed");
    }
  }

  #ensureDerivedEntry<T>(atom: DerivedAtom<T>): DerivedEntry<T> {
    const existing = this.#derivedEntries.get(atom) as
      | DerivedEntry<T>
      | undefined;
    if (existing !== undefined) {
      return existing;
    }

    const value = computed(() => {
      this.#assertActive();
      return atom.read((target) => this.get(target));
    });

    const ref: ReadableAtomRef<T> = {
      get value() {
        return value.value;
      },
      peek() {
        return value.peek();
      },
    };

    const entry: DerivedEntry<T> = {
      computed: value,
      ref,
    };

    this.#derivedEntries.set(atom, entry as DerivedEntry<unknown>);
    return entry;
  }

  #ensurePrimitiveEntry<T>(
    atom: PrimitiveAtom<T>,
    initialValue: T = atom.init,
    hasLocalOverride = false,
  ): PrimitiveEntry<T> {
    const existing = this.#primitiveEntries.get(atom) as
      | PrimitiveEntry<T>
      | undefined;
    if (existing !== undefined) {
      if (hasLocalOverride) {
        existing.local.set(initialValue);
        if (!existing.hasLocal.peek()) {
          existing.hasLocal.set(true);
        }
      }
      return existing;
    }

    const hasLocal = signal(hasLocalOverride);
    const local = signal(initialValue);
    const effective = computed(() => {
      this.#assertActive();
      if (hasLocal.value || this.#parent === undefined) {
        return local.value;
      }
      return this.#parent.get(atom);
    });

    const ref: WritableAtomRef<T> = {
      get value() {
        return effective.value;
      },
      peek() {
        return effective.peek();
      },
      set: (update) => {
        this.#assertActive();
        const previousValue = effective.peek();
        const nextValue =
          typeof update === "function"
            ? (update as (prev: T) => T)(previousValue)
            : update;

        local.set(nextValue);
        if (!hasLocal.peek()) {
          hasLocal.set(true);
        }
      },
    };

    const entry: PrimitiveEntry<T> = {
      effective,
      hasLocal,
      local,
      ref,
    };

    this.#primitiveEntries.set(atom, entry as PrimitiveEntry<unknown>);
    return entry;
  }
}

function createAtomStore(options: {
  appId: AppId;
  values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>;
}): AtomStore {
  return new AtomStoreImpl(options.appId, undefined, options.values);
}

export { createAtomStore };
export type { AppId, AtomStore, AtomUpdate, ReadableAtomRef, WritableAtomRef };
