/** Deliberately failing claims, retained as counterevidence, not engine bugs. */
import assert from "node:assert/strict";
import { test } from "node:test";
import { batch, effect, signal } from "../../../packages/reactivity/src/index.ts";

test("NAIVE-01 unconditional clone should preserve same-external-root no-op", () => {
  const cell = signal({ n: 0 });
  let notifications = 0;
  const stop = effect(() => { cell.value; notifications++; });
  const input = { n: 1 };
  cell.set(structuredClone(input));
  const afterFirst = notifications;
  cell.set(structuredClone(input));
  stop();
  assert.equal(notifications, afterFirst);
});

test("NAIVE-02 setter guard alone should isolate captured external payload aliases", () => {
  const raw = { nested: { n: 1 } };
  const cell = signal(raw);
  raw.nested.n = 2;
  assert.equal(cell.peek().nested.n, 1);
});

test("NATIVE-DIFFERENCE-03 mutated same object explicit set should notify as proposed profile", () => {
  const raw = { n: 1 };
  const cell = signal(raw);
  let notifications = 0;
  const stop = effect(() => { cell.value; notifications++; });
  raw.n = 2;
  cell.set(raw);
  stop();
  assert.equal(notifications, 2);
});

test("KNOWN-CONSTRAINT-04 batch throw should roll back display publication", () => {
  const cell = signal("Alpha");
  let display = "";
  const stop = effect(() => { display = cell.value; });
  assert.throws(() => batch(() => { cell.set("Beta"); throw new Error("receive-failed"); }));
  stop();
  assert.equal(display, "Alpha");
});

test("NAIVE-05 closing last timer lease before callback should allow normal callback", () => {
  let active = true;
  let resources = 1;
  let writes = 0;
  resources--;
  if (resources === 0) active = false;
  if (active) writes++;
  assert.equal(writes, 1);
});
