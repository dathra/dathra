import { effect } from "@dathra/reactivity";
import { describe, expect, it, vi } from "vitest";

import {
  atom as defineAtom,
  type Getter as StoreGetter,
} from "../atom/implementation";
import * as storeModule from "./implementation";

type AtomUpdate<T> = T | ((prev: T) => T);
type Getter = <T>(atom: ReadableAtom<T>) => T;

interface PrimitiveAtom<T> {
  key: string;
  kind: "primitive";
  init: T;
}

interface DerivedAtom<T> {
  key: string;
  kind: "derived";
  read: (get: Getter) => T;
}

type ReadableAtom<T> = PrimitiveAtom<T> | DerivedAtom<T>;

interface ReadableAtomRef<T> {
  readonly value: T;
  peek(): T;
}

interface WritableAtomRef<T> extends ReadableAtomRef<T> {
  set(update: AtomUpdate<T>): void;
}

interface AtomStore {
  readonly appId: string;
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

type CreateAtomStore = (options: {
  appId: string;
  values?: Iterable<readonly [PrimitiveAtom<unknown>, unknown]>;
}) => AtomStore;

const { createAtomStore } = storeModule as unknown as {
  createAtomStore: CreateAtomStore;
};

function primitiveAtom<T>(key: string, init: T): PrimitiveAtom<T> {
  return { key, kind: "primitive", init };
}

function derivedAtom<T>(key: string, read: (get: Getter) => T): DerivedAtom<T> {
  return { key, kind: "derived", read };
}

describe("createAtomStore", () => {
  describe("Basic behavior", () => {
    it("creates a store with appId and primitive initial values", () => {
      const countAtom = primitiveAtom("count", 0);
      const store = createAtomStore({ appId: "app-1" });

      expect(store.appId).toBe("app-1");
      expect(store.ref(countAtom).value).toBe(0);
      expect(store.get(countAtom)).toBe(0);
    });

    it("applies initial values passed to createAtomStore", () => {
      const countAtom = primitiveAtom("count", 0);
      const nameAtom = primitiveAtom("name", "guest");

      const store = createAtomStore({
        appId: "app-1",
        values: [
          [countAtom, 42],
          [nameAtom, "dathra"],
        ],
      });

      expect(store.ref(countAtom).value).toBe(42);
      expect(store.ref(nameAtom).value).toBe("dathra");
    });

    it("keeps the same atom definition isolated across different stores", () => {
      const countAtom = primitiveAtom("count", 0);
      const left = createAtomStore({ appId: "app-left" });
      const right = createAtomStore({ appId: "app-right" });

      left.ref(countAtom).set(10);

      expect(left.ref(countAtom).value).toBe(10);
      expect(right.ref(countAtom).value).toBe(0);
    });
  });

  describe("AtomRef", () => {
    it("returns a stable ref for the same atom in the same store", () => {
      const countAtom = primitiveAtom("count", 0);
      const store = createAtomStore({ appId: "app-1" });

      expect(store.ref(countAtom)).toBe(store.ref(countAtom));
    });

    it("returns a stable ref for the same derived atom in the same store", () => {
      const countAtom = primitiveAtom("count", 1);
      const doubledAtom = derivedAtom("doubled", (get) => get(countAtom) * 2);
      const store = createAtomStore({ appId: "app-1" });

      expect(store.ref(doubledAtom)).toBe(store.ref(doubledAtom));
    });

    it("supports signal-like writes through ref.set with updater functions", () => {
      const countAtom = primitiveAtom("count", 1);
      const store = createAtomStore({ appId: "app-1" });
      const count = store.ref(countAtom);

      count.set((prev) => prev + 4);

      expect(count.value).toBe(5);
    });

    it("returns a read-only ref for derived atoms", () => {
      const countAtom = primitiveAtom("count", 2);
      const doubledAtom = derivedAtom("doubled", (get) => get(countAtom) * 2);
      const store = createAtomStore({ appId: "app-1" });
      const doubled = store.ref(doubledAtom);

      expect(doubled.value).toBe(4);
      expect("set" in doubled).toBe(false);
    });
  });

  describe("Dependency tracking", () => {
    it("tracks ref(atom).value reads inside effect", () => {
      const countAtom = primitiveAtom("count", 0);
      const store = createAtomStore({ appId: "app-1" });
      const count = store.ref(countAtom);
      const observed: number[] = [];

      effect(() => {
        observed.push(count.value);
      });

      count.set(1);
      count.set(2);

      expect(observed).toEqual([0, 1, 2]);
    });

    it("tracks store.get(atom) reads inside effect", () => {
      const countAtom = primitiveAtom("count", 0);
      const store = createAtomStore({ appId: "app-1" });
      const observed: number[] = [];

      effect(() => {
        observed.push(store.get(countAtom));
      });

      store.set(countAtom, 1);

      expect(observed).toEqual([0, 1]);
    });

    it("does not track ref(atom).peek() reads inside effect", () => {
      const countAtom = primitiveAtom("count", 0);
      const store = createAtomStore({ appId: "app-1" });
      const count = store.ref(countAtom);
      const observed: number[] = [];

      effect(() => {
        observed.push(count.peek());
      });

      count.set(1);
      count.set(2);

      expect(observed).toEqual([0]);
    });

    it("does not track store.peek(atom) reads inside effect", () => {
      const countAtom = primitiveAtom("count", 0);
      const doubledAtom = derivedAtom("doubled", (get) => get(countAtom) * 2);
      const store = createAtomStore({ appId: "app-1" });
      const observed: number[] = [];

      effect(() => {
        observed.push(store.peek(doubledAtom));
      });

      store.set(countAtom, 1);
      store.set(countAtom, 2);

      expect(observed).toEqual([0]);
    });

    it("does not track derived ref.peek() reads inside effect", () => {
      const countAtom = primitiveAtom("count", 1);
      const doubledAtom = derivedAtom("doubled", (get) => get(countAtom) * 2);
      const store = createAtomStore({ appId: "app-1" });
      const doubled = store.ref(doubledAtom);
      const observed: number[] = [];

      effect(() => {
        observed.push(doubled.peek());
      });

      store.set(countAtom, 3);

      expect(observed).toEqual([2]);
    });
  });

  describe("Notification semantics", () => {
    it("does not re-run effects when the same value is set", () => {
      const countAtom = primitiveAtom("count", 5);
      const store = createAtomStore({ appId: "app-1" });
      const count = store.ref(countAtom);
      const spy = vi.fn();

      effect(() => {
        spy(count.value);
      });

      count.set(5);
      store.set(countAtom, 5);

      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("uses Object.is semantics for NaN", () => {
      const valueAtom = primitiveAtom("value", Number.NaN);
      const store = createAtomStore({ appId: "app-1" });
      const value = store.ref(valueAtom);
      const spy = vi.fn();

      effect(() => {
        spy(value.value);
      });

      value.set(Number.NaN);

      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("Derived atoms", () => {
    it("keeps derived atom caches isolated per store", () => {
      const countAtom = primitiveAtom("count", 1);
      const getter = vi.fn((get: Getter) => get(countAtom) * 2);
      const doubledAtom = derivedAtom("doubled", getter);
      const root = createAtomStore({ appId: "app-1" });
      const child = root.fork({ values: [[countAtom, 10]] });

      expect(root.ref(doubledAtom).value).toBe(2);
      expect(root.ref(doubledAtom).value).toBe(2);
      expect(child.ref(doubledAtom).value).toBe(20);
      expect(child.ref(doubledAtom).value).toBe(20);

      expect(getter).toHaveBeenCalledTimes(2);
    });

    it("recomputes derived atoms when their dependencies change in the same store", () => {
      const countAtom = primitiveAtom("count", 1);
      const doubledAtom = derivedAtom("doubled", (get) => get(countAtom) * 2);
      const store = createAtomStore({ appId: "app-1" });
      const observed: number[] = [];

      effect(() => {
        observed.push(store.ref(doubledAtom).value);
      });

      store.set(countAtom, 5);

      expect(observed).toEqual([2, 10]);
    });
  });

  describe("fork", () => {
    it("reads through to parent values until an atom is overridden", () => {
      const countAtom = primitiveAtom("count", 0);
      const root = createAtomStore({ appId: "app-1" });
      const child = root.fork();

      root.set(countAtom, 1);
      expect(child.ref(countAtom).value).toBe(1);

      root.set(countAtom, 2);
      expect(child.ref(countAtom).value).toBe(2);
    });

    it("shadows parent updates after the child overrides an atom", () => {
      const countAtom = primitiveAtom("count", 0);
      const root = createAtomStore({ appId: "app-1" });
      const child = root.fork();

      root.set(countAtom, 1);
      child.set(countAtom, 10);
      root.set(countAtom, 2);

      expect(root.ref(countAtom).value).toBe(2);
      expect(child.ref(countAtom).value).toBe(10);
    });

    it("accepts fork-time initial overrides", () => {
      const themeAtom = primitiveAtom("theme", "light");
      const root = createAtomStore({ appId: "app-1" });
      const child = root.fork({ values: [[themeAtom, "dark"]] });

      expect(root.ref(themeAtom).value).toBe("light");
      expect(child.ref(themeAtom).value).toBe("dark");
    });
  });

  describe("dispose", () => {
    it("disposes a child store without affecting the parent store", () => {
      const countAtom = primitiveAtom("count", 0);
      const root = createAtomStore({ appId: "app-1" });
      const child = root.fork();

      child.dispose();

      expect(() => child.get(countAtom)).toThrow("AtomStore has been disposed");
      expect(root.get(countAtom)).toBe(0);
    });

    it("cascades disposal from parent stores to child forks", () => {
      const countAtom = primitiveAtom("count", 0);
      const root = createAtomStore({ appId: "app-1" });
      const child = root.fork();

      root.dispose();

      expect(() => root.get(countAtom)).toThrow("AtomStore has been disposed");
      expect(() => child.get(countAtom)).toThrow("AtomStore has been disposed");
    });

    it("fails fast for read and write APIs after disposal, including existing refs", () => {
      const countAtom = primitiveAtom("count", 1);
      const doubledAtom = derivedAtom("doubled", (get) => get(countAtom) * 2);
      const store = createAtomStore({ appId: "app-1" });
      const count = store.ref(countAtom);
      const doubled = store.ref(doubledAtom);

      store.dispose();

      expect(() => store.ref(countAtom)).toThrow("AtomStore has been disposed");
      expect(() => store.set(countAtom, 2)).toThrow(
        "AtomStore has been disposed",
      );
      expect(() => store.peek(countAtom)).toThrow(
        "AtomStore has been disposed",
      );
      expect(() => count.value).toThrow("AtomStore has been disposed");
      expect(() => count.peek()).toThrow("AtomStore has been disposed");
      expect(() => doubled.value).toThrow("AtomStore has been disposed");
      expect(() => doubled.peek()).toThrow("AtomStore has been disposed");
    });
  });

  describe("Integration with atom()", () => {
    it("works with real atom definitions exported by the package", () => {
      const countAtom = defineAtom("count", 1);
      const doubledAtom = defineAtom(
        "doubled",
        (get: StoreGetter) => get(countAtom) * 2,
      );
      const store = createAtomStore({ appId: "app-1" });

      expect(store.ref(countAtom).value).toBe(1);
      expect(store.ref(doubledAtom).value).toBe(2);

      store.ref(countAtom).set(5);

      expect(store.ref(countAtom).value).toBe(5);
      expect(store.ref(doubledAtom).value).toBe(10);
    });

    it("keeps values isolated when the same real atom definition is shared across stores", () => {
      const countAtom = defineAtom("count", 1);
      const left = createAtomStore({ appId: "app-left" });
      const right = createAtomStore({ appId: "app-right" });

      left.ref(countAtom).set(10);

      expect(left.ref(countAtom).value).toBe(10);
      expect(right.ref(countAtom).value).toBe(1);
    });

    it("treats distinct atom objects with the same key as different state slots", () => {
      const leftAtom = defineAtom("count", 1);
      const rightAtom = defineAtom("count", 1);
      const store = createAtomStore({ appId: "app-1" });

      store.ref(leftAtom).set(10);

      expect(store.ref(leftAtom).value).toBe(10);
      expect(store.ref(rightAtom).value).toBe(1);
    });
  });
});
