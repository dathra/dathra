/**
 * Tests for Hydration state deserialization.
 */

import { atom, createAtomStore, defineAtomStoreSnapshot } from "@dathra/store";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

import {
  deserializeState,
  parseStoreScript,
  parseStateScript,
} from "@/hydration/deserialize/implementation";
import { serializeState } from "@/ssr/serialize/implementation";

describe("deserializeState", () => {
  it("deserializes primitive values", () => {
    const state = { count: 42, name: "test", active: true };
    const serialized = serializeState(state);

    const result = deserializeState(serialized);
    expect(result).toEqual(state);
  });

  it("deserializes null values", () => {
    const state = { nullVal: null };
    const serialized = serializeState(state);

    const result = deserializeState(serialized);
    expect(result.nullVal).toBeNull();
  });

  it("deserializes arrays", () => {
    const state = { items: [1, 2, 3] };
    const serialized = serializeState(state);

    const result = deserializeState(serialized);
    expect(result.items).toEqual([1, 2, 3]);
  });

  it("deserializes Date objects", () => {
    const date = new Date("2024-01-01T00:00:00.000Z");
    const state = { date };
    const serialized = serializeState(state);

    const result = deserializeState(serialized);
    expect(result.date).toBeInstanceOf(Date);
    expect((result.date as Date).toISOString()).toBe(date.toISOString());
  });

  it("deserializes Map objects", () => {
    const map = new Map([
      ["a", 1],
      ["b", 2],
    ]);
    const state = { map };
    const serialized = serializeState(state);

    const result = deserializeState(serialized);
    expect(result.map).toBeInstanceOf(Map);
    expect((result.map as Map<string, number>).get("a")).toBe(1);
  });

  it("deserializes Set objects", () => {
    const set = new Set([1, 2, 3]);
    const state = { set };
    const serialized = serializeState(state);

    const result = deserializeState(serialized);
    expect(result.set).toBeInstanceOf(Set);
    expect((result.set as Set<number>).has(2)).toBe(true);
  });
});

describe("parseStateScript", () => {
  let container: HTMLElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  it("finds and parses state script", () => {
    const state = { count: 42 };
    const serialized = serializeState(state);
    container.innerHTML = `<script type="application/json" data-dh-state>${serialized}</script>`;

    const result = parseStateScript(container);
    expect(result).toEqual(state);
  });

  it("removes state script from DOM", () => {
    const state = { count: 42 };
    const serialized = serializeState(state);
    container.innerHTML = `<script type="application/json" data-dh-state>${serialized}</script>`;

    parseStateScript(container);

    const script = container.querySelector("script[data-dh-state]");
    expect(script).toBeNull();
  });

  it("returns null when no state script found", () => {
    container.innerHTML = "<div>No state</div>";

    const result = parseStateScript(container);
    expect(result).toBeNull();
  });

  it("handles nested containers", () => {
    const state = { nested: true };
    const serialized = serializeState(state);
    container.innerHTML = `
      <div>
        <span>
          <script type="application/json" data-dh-state>${serialized}</script>
        </span>
      </div>
    `;

    const result = parseStateScript(container);
    expect(result).toEqual(state);
  });

  it("handles complex state objects", () => {
    const state = {
      user: { name: "Alice", age: 30 },
      items: ["a", "b", "c"],
      active: true,
    };
    const serialized = serializeState(state);
    container.innerHTML = `<script type="application/json" data-dh-state>${serialized}</script>`;

    const result = parseStateScript(container);
    expect(result).toEqual(state);
  });

  it("supports restoring a store snapshot parsed from a store script", () => {
    const countAtom = atom("count", 0);
    const themeAtom = atom("theme", "light");
    const schema = defineAtomStoreSnapshot({
      count: countAtom,
      theme: themeAtom,
    });
    const sourceStore = createAtomStore({ appId: "deserialize-source" });

    sourceStore.set(countAtom, 21);
    sourceStore.set(themeAtom, "dark");

    const serialized = serializeState(schema.serialize(sourceStore));
    container.innerHTML = `<script type="application/json" data-dh-store>${serialized}</script>`;

    const parsed = parseStoreScript(container);
    const restoredStore = createAtomStore({
      appId: "deserialize-target",
      values: schema.values(parsed as { count: number; theme: string }),
    });

    expect(restoredStore.ref(countAtom).value).toBe(21);
    expect(restoredStore.ref(themeAtom).value).toBe("dark");
  });

  it("finds and parses store snapshot script", () => {
    const state = { count: 42 };
    const serialized = serializeState(state);
    container.innerHTML = `<script type="application/json" data-dh-store>${serialized}</script>`;

    const result = parseStoreScript(container);
    expect(result).toEqual(state);
  });
});
