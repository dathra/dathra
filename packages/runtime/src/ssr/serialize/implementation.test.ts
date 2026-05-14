/**
 * Tests for state serialization.
 */

import { atom, createAtomStore, defineAtomStoreSnapshot } from "@dathra/store";
import { describe, expect, it } from "vitest";

import { deserializeState } from "@/hydration/deserialize/implementation";
import { isSerializable, serializeState } from "@/ssr/serialize/implementation";

describe("State Serialization", () => {
  it("serializes primitive values", () => {
    const state = {
      string: "hello",
      number: 42,
      boolean: true,
      nullValue: null,
    };
    const serialized = serializeState(state);
    expect(serialized).toContain('"hello"');
    expect(serialized).toContain("42");
    expect(serialized).toContain("true");
  });

  it("serializes arrays", () => {
    const state = {
      items: [1, 2, 3],
    };
    const serialized = serializeState(state);
    expect(serialized).toContain("1");
    expect(serialized).toContain("2");
    expect(serialized).toContain("3");
  });

  it("serializes nested objects", () => {
    const state = {
      user: {
        name: "John",
        age: 30,
      },
    };
    const serialized = serializeState(state);
    expect(serialized).toContain('"John"');
    expect(serialized).toContain("30");
  });

  it("serializes Date objects", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const state = { date };
    const serialized = serializeState(state);
    expect(serialized).toBeTruthy();
  });

  it("serializes Map objects", () => {
    const map = new Map([["key", "value"]]);
    const state = { map };
    const serialized = serializeState(state);
    expect(serialized).toBeTruthy();
  });

  it("serializes Set objects", () => {
    const set = new Set([1, 2, 3]);
    const state = { set };
    const serialized = serializeState(state);
    expect(serialized).toBeTruthy();
  });

  it("serializes BigInt", () => {
    const state = { big: BigInt(9007199254740991) };
    const serialized = serializeState(state);
    expect(serialized).toBeTruthy();
  });
});

describe("isSerializable", () => {
  it("returns true for primitives", () => {
    expect(isSerializable("string")).toBe(true);
    expect(isSerializable(42)).toBe(true);
    expect(isSerializable(true)).toBe(true);
    expect(isSerializable(null)).toBe(true);
    expect(isSerializable(undefined)).toBe(true);
  });

  it("returns true for BigInt", () => {
    expect(isSerializable(BigInt(123))).toBe(true);
  });

  it("returns false for functions", () => {
    expect(isSerializable(() => {})).toBe(false);
  });

  it("returns false for symbols", () => {
    expect(isSerializable(Symbol("test"))).toBe(false);
  });

  it("returns true for Date", () => {
    expect(isSerializable(new Date())).toBe(true);
  });

  it("returns true for RegExp", () => {
    expect(isSerializable(/test/)).toBe(true);
  });

  it("returns true for Map", () => {
    expect(isSerializable(new Map())).toBe(true);
  });

  it("returns true for Set", () => {
    expect(isSerializable(new Set())).toBe(true);
  });

  it("returns true for serializable arrays", () => {
    expect(isSerializable([1, 2, 3])).toBe(true);
    expect(isSerializable(["a", "b", "c"])).toBe(true);
  });

  it("returns false for arrays with functions", () => {
    expect(isSerializable([1, () => {}, 3])).toBe(false);
  });

  it("returns true for serializable objects", () => {
    expect(isSerializable({ a: 1, b: "test" })).toBe(true);
  });

  it("returns false for objects with functions", () => {
    expect(isSerializable({ fn: () => {} })).toBe(false);
  });
});

describe("Atom store snapshot integration", () => {
  it("round-trips a snapshot object through serializeState and deserializeState", () => {
    const countAtom = atom("count", 0);
    const themeAtom = atom("theme", "light");
    const schema = defineAtomStoreSnapshot({
      count: countAtom,
      theme: themeAtom,
    });
    const store = createAtomStore({ appId: "runtime-snapshot" });

    store.set(countAtom, 12);
    store.set(themeAtom, "dark");

    const snapshot = schema.serialize(store);
    const serialized = serializeState(snapshot);
    const deserialized = deserializeState(serialized);

    expect(deserialized).toEqual({ count: 12, theme: "dark" });
  });

  it("keeps runtime serialization as a plain object layer over snapshot schemas", () => {
    const sessionAtom = atom("session", { user: "luke", role: "admin" });
    const schema = defineAtomStoreSnapshot({ session: sessionAtom });
    const store = createAtomStore({ appId: "runtime-session" });

    store.set(sessionAtom, { user: "leia", role: "editor" });

    const serialized = serializeState(schema.serialize(store));
    const restored = deserializeState(serialized);

    expect(restored).toEqual({
      session: { user: "leia", role: "editor" },
    });
  });
});
