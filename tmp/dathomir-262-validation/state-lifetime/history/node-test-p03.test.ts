import assert from "node:assert/strict";
import { test } from "node:test";
import { batch, computed, effect, signal } from "../../../packages/reactivity/src/index.ts";
import { CaptureUniverse, graph, recordValue, restore, structuralPeek } from "./graph.ts";
import { OwnedOwner } from "./owned.ts";
import type { Facade } from "./owned.ts";
import { context } from "./phases.ts";
import type { Context } from "./phases.ts";

function record(value: unknown): Record<string, unknown> {
  assert.ok(recordValue(value));
  return value;
}
function facade(value: unknown): Facade {
  assert.ok(recordValue(value));
  const projected = value;
  // Tests use the public projection returned by the experimental owner.
  assert.equal(typeof value.set, "function");
  assert.equal(typeof value.peek, "function");
  function peek(): unknown { return typeof projected.peek === "function" ? projected.peek() : undefined; }
  function set(input: unknown): void { if (typeof projected.set === "function") projected.set(input); }
  return { get value() { return projected.value; }, set, peek, __type__: "signal" };
}

test("P03.01 one-peek aliases; captured template and JSON handoff use one isolated snapshot", () => {
  const s = signal({ n: 7 });
  let reads = 0;
  const source = { __type__: "signal", set: s.set, get value() { throw new Error("must-not-track"); }, peek() { reads++; return s.peek(); } };
  const capture = new CaptureUniverse();
  const snapshot = capture.capture({}, { a: source, nested: { b: source }, plain: { title: "Counter" } });
  assert.equal(reads, 1);
  s.set({ n: 8 });
  const ssr = record(restore(snapshot, payload => Object.freeze({ value: restore(payload) })));
  const a = record(ssr.a);
  assert.equal(record(a.value).n, 7);
  const encoded: unknown = JSON.parse(JSON.stringify(snapshot));
  assert.ok(recordValue(encoded));
  // Decode uses the trusted graph produced by capture; untrusted validation is separate.
  const roundtrip = JSON.parse(JSON.stringify(snapshot));
  const owner = new OwnedOwner();
  const browser = record(owner.restore(roundtrip));
  assert.equal(browser.a, record(browser.nested).b);
  assert.equal(record(facade(browser.a).peek()).n, 7);
  assert.equal(record(facade(browser.a).value).n, record(a.value).n);
  assert.equal(s.peek().n, 8);
  assert.throws(() => capture.capture({}, { again: source }), /cross-owner-alias/);
});

test("P03.02 same-valued distinct Signals remain separate slots", () => {
  const snapshot = new CaptureUniverse().capture({}, { a: signal(7), b: signal(7) });
  const owner = new OwnedOwner();
  const view = record(owner.restore(snapshot));
  assert.notEqual(view.a, view.b);
  facade(view.a).set(8);
  assert.equal(facade(view.b).peek(), 7);
});

test("P03.03 inherited protocol; first shadowing accessor wins without executing", () => {
  let gets = 0;
  let peeks = 0;
  const protocol = { __type__: "signal", set() {}, peek() { peeks++; return 7; }, get value() { gets++; return 7; } };
  const inherited = Object.create(protocol);
  assert.equal(typeof structuralPeek(inherited), "function");
  assert.equal(gets, 0);
  assert.equal(peeks, 0);
  new CaptureUniverse().capture({}, { inherited });
  assert.equal(peeks, 1);
  assert.equal(gets, 0);
  const shadow = Object.create(protocol);
  Object.defineProperty(shadow, "peek", { get() { gets++; return () => 7; } });
  assert.equal(structuralPeek(shadow), undefined);
  assert.equal(gets, 0);
  assert.throws(() => new CaptureUniverse().capture({}, shadow), /nonplain-data/);
});

test("P03.04 tag-only data, computed, trusted full fake, throwing peek and malformed payload", () => {
  const tagOnly = { __type__: "signal", value: 7 };
  assert.equal(structuralPeek(tagOnly), undefined);
  assert.deepEqual(restore(new CaptureUniverse().capture({}, tagOnly)), tagOnly);
  const c = computed(() => 14);
  assert.equal(structuralPeek(c), undefined);
  assert.throws(() => new CaptureUniverse().capture({}, { c }), /accessor|non-data/);
  const fake = { __type__: "signal", value: 4, set() {}, peek() { return 4; }, extra: "not-transferred" };
  const view = record(new OwnedOwner().restore(new CaptureUniverse().capture({}, fake)));
  assert.equal(view.value, 4);
  assert.equal(view.extra, undefined);
  assert.throws(() => new CaptureUniverse().capture({}, { ...fake, peek() { throw new Error("author-error"); } }), /peek-failed.*author-error/);
  assert.throws(() => new CaptureUniverse().capture({}, { ...fake, peek() { return { invalid: () => 1 }; } }), /non-data-value.*invalid/);
});

test("P03.05 actual bundled second engine copy is accepted structurally", async () => {
  const copyPath: string = "./engine-copy.mjs";
  const second = await import(copyPath);
  const secondSignal: unknown = second.signal;
  assert.equal(typeof secondSignal, "function");
  assert.notEqual(secondSignal, signal);
  assert.ok(typeof secondSignal === "function");
  const differentCopy: unknown = secondSignal(9);
  const browser = record(new OwnedOwner().restore(new CaptureUniverse().capture({}, { other: differentCopy })));
  assert.equal(facade(browser.other).peek(), 9);
});

test("P03.06 identity/no-op matrix with actual effect notifications", () => {
  const owner = new OwnedOwner();
  const slot = owner.slot({ n: 0 });
  const history: unknown[] = [];
  const stop = effect(() => history.push(slot.value));
  const x = { n: 1 };
  slot.set(x);
  const first = slot.peek();
  assert.equal(slot.value, first);
  assert.notEqual(first, x);
  slot.set(x);
  slot.set((previous: unknown) => previous);
  slot.set(slot.value);
  slot.set(slot.peek());
  assert.equal(history.length, 2);
  x.n = 2;
  assert.equal(record(slot.peek()).n, 1);
  assert.equal(history.length, 2);
  slot.set(x);
  assert.equal(record(slot.peek()).n, 2);
  assert.equal(history.length, 3);
  slot.set({ n: 2 });
  assert.equal(history.length, 4);
  slot.set({ n: 2 });
  assert.equal(history.length, 5);
  slot.set((previous: unknown) => ({ ...record(previous), n: 3 }));
  assert.equal(history.length, 6);
  assert.equal(record(slot.peek()).n, 3);
  stop();
});

test("P03.07 nested alias updater; external nested mutation reused across distinct roots", () => {
  const owner = new OwnedOwner();
  const shared = { n: 1 };
  const a = { left: shared, right: shared };
  const b = { left: shared, right: shared };
  const slot = owner.slot(a);
  const initial = record(slot.peek());
  assert.equal(initial.left, initial.right);
  const capturedNested = initial.left;
  slot.set((previous: unknown) => record(previous).left);
  assert.equal(slot.peek(), capturedNested);
  slot.set((previous: unknown) => previous);
  assert.equal(slot.peek(), capturedNested);
  shared.n = 2;
  slot.set(b);
  const second = record(slot.peek());
  assert.equal(second.left, second.right);
  assert.notEqual(second.left, capturedNested);
  assert.equal(record(second.left).n, 2);
  assert.equal(record(capturedNested).n, 1);
  slot.set(a);
  assert.equal(record(record(slot.peek()).left).n, 2);
  const beforeTopology = slot.peek();
  a.right = { n: 2 };
  slot.set(a);
  assert.notEqual(slot.peek(), beforeTopology);
  assert.notEqual(record(slot.peek()).left, record(slot.peek()).right);
});

test("P03.08 field-order insensitive; array order and negative zero retained through wire", () => {
  const owner = new OwnedOwner();
  const x: Record<string, unknown> = { a: 1, b: 2 };
  const slot = owner.slot(x);
  const before = slot.peek();
  delete x.a;
  x.a = 1;
  slot.set(x);
  assert.equal(slot.peek(), before);
  const array = [1, 2];
  slot.set(array);
  const old = slot.peek();
  array.reverse();
  slot.set(array);
  assert.notEqual(slot.peek(), old);
  assert.deepEqual(slot.peek(), [2, 1]);
  const native = signal(-0);
  const snapshot = new CaptureUniverse().capture({}, native);
  const restored = facade(new OwnedOwner().restore(JSON.parse(JSON.stringify(snapshot))));
  assert.ok(Object.is(restored.peek(), -0));
  let updates = 0;
  const stop = effect(() => { restored.value; updates++; });
  restored.set(0);
  assert.equal(updates, 2);
  assert.throws(() => restored.set(NaN), /nonfinite/);
  stop();
});

test("P03.09 no raw payload escape via peek/updater; caller remains mutable", () => {
  const owner = new OwnedOwner();
  const external = { nested: { n: 1 }, list: [{ n: 2 }] };
  const slot = owner.slot(external);
  assert.equal(Object.isFrozen(external), false);
  assert.equal(Object.isFrozen(external.nested), false);
  const view = record(slot.peek());
  assert.throws(() => { record(view.nested).n = 99; }, TypeError);
  assert.equal(Reflect.set(record(view.nested), "n", 99), false);
  assert.equal(Reflect.defineProperty(record(view.nested), "n", { value: 99 }), false);
  assert.throws(() => slot.set((previous: unknown) => { record(record(previous).nested).n = 99; return previous; }), TypeError);
  external.nested.n = 3;
  external.list[0].n = 4;
  assert.equal(record(view.nested).n, 1);
  assert.equal(record(record(slot.peek()).nested).n, 1);
  assert.equal(slot.peek(), view);
});

test("P03.10 revoked cached setters/updaters and disposed caller aliases cannot write", () => {
  const owner = new OwnedOwner();
  const external = { n: 1 };
  let current = true;
  const slot = owner.slot(external, () => current);
  const cachedSet = slot.set;
  const cachedPeek = slot.peek;
  current = false;
  let updaterCalls = 0;
  assert.throws(() => cachedSet(() => { updaterCalls++; return { n: 2 }; }), /stale-write/);
  assert.equal(updaterCalls, 0);
  // Passive readonly reads remain allowed; revocation applies to write authority.
  assert.equal(record(cachedPeek()).n, 1);
  current = true;
  assert.throws(() => cachedSet(() => { current = false; return { n: 2 }; }), /after-updater/);
  assert.equal(record(slot.peek()).n, 1);
  owner.dispose();
  external.n = 10;
  assert.equal(record(cachedPeek()).n, 1);
  assert.throws(() => cachedSet({ n: 3 }), /stale-write/);
});

test("P03.11 actual tracking, peek, computed, batch and stop through readonly projection", () => {
  const owner = new OwnedOwner();
  const slot = owner.slot(1);
  let tracked = 0;
  let untracked = 0;
  const derived = computed(() => Number(slot.value) * 2);
  const stop = effect(() => { derived.value; tracked++; });
  const stopPeek = effect(() => { slot.peek(); untracked++; });
  batch(() => { slot.set(2); slot.set(3); });
  assert.equal(derived.peek(), 6);
  assert.equal(tracked, 2);
  assert.equal(untracked, 1);
  stop(); stopPeek();
  slot.set(4);
  assert.equal(tracked, 2);
});

test("P03.12 trusted side-effectful peek disproves a global instantaneous cut", () => {
  const a = signal(1);
  const b = signal(1);
  const actualPairs: string[] = [];
  const stop = effect(() => actualPairs.push(`${a.value},${b.value}`));
  const fakeB = { __type__: "signal", set: b.set, get value() { return b.value; }, peek() { batch(() => { a.set(2); b.set(2); }); return b.peek(); } };
  const snapshot = new CaptureUniverse().capture({}, { a, b: fakeB });
  const captured = record(restore(snapshot, payload => Object.freeze({ value: restore(payload) })));
  assert.equal(record(captured.a).value, 1);
  assert.equal(record(captured.b).value, 2);
  assert.deepEqual(actualPairs, ["1,1", "2,2"]);
  assert.equal(actualPairs.includes("1,2"), false);
  // Output coherence holds; purity or a native provenance scope is needed for stronger claims.
  assert.deepEqual(restore(snapshot, payload => Object.freeze({ value: restore(payload) })), captured);
  stop();
});

test("P03.13 finite domain diagnostics never execute ordinary getters", () => {
  let getters = 0;
  assert.throws(() => graph({ get forbidden() { getters++; return 1; } }), /accessor.*forbidden/);
  assert.equal(getters, 0);
  const cycle: Record<string, unknown> = {};
  cycle.self = cycle;
  assert.throws(() => graph(cycle), /cycle.*self/);
  assert.throws(() => graph([, 1]), /sparse/);
  assert.throws(() => graph({ symbol: Symbol("x") }), /non-data/);
  assert.throws(() => graph({ hidden: undefined }), /non-data.*hidden/);
  const polluted = JSON.parse('{"__proto__":{"safe":1}}');
  const result = record(restore(graph(polluted)));
  assert.equal(Object.getPrototypeOf(result), Object.prototype);
  assert.equal(record(result.__proto__).safe, 1);
});

test("P03.14 all-name bind rejects increment writes before mutation or return validation", () => {
  const owner = new OwnedOwner();
  const count = owner.slot(7);
  let notifications = 0;
  let updaterCalls = 0;
  let capabilityCalls = 0;
  const capability = () => { capabilityCalls++; };
  const caps = { request: capability, emit: capability, timeout: capability, control: capability };
  const stop = effect(() => { count.value; notifications++; });
  const registry = {
    countText(ctx: Context) { return `Count:${ctx.values.count.value}`; },
    increment(ctx: Context) { ctx.values.count.set((previous: unknown) => { updaterCalls++; return Number(previous) + 1; }); },
    requester(ctx: Context) { ctx.request("name", {}); },
    emitter(ctx: Context) { ctx.emit("name", {}); },
    timer(ctx: Context) { ctx.timeout(() => {}, 1); },
    focus(ctx: Context) { ctx.control("name"); },
  };
  const read = context(owner, { count }, "binding", caps);
  assert.equal(registry.countText(read), "Count:7");
  assert.throws(() => registry.increment(read), /phase-write:binding/);
  assert.equal(count.peek(), 7);
  assert.equal(notifications, 1);
  assert.equal(updaterCalls, 0);
  for (const operation of [registry.requester, registry.emitter, registry.timer, registry.focus]) {
    assert.throws(() => operation(read), /phase-capability:binding/);
  }
  assert.equal(capabilityCalls, 0);
  const write = context(owner, { count }, "operation", caps);
  registry.increment(write);
  assert.equal(count.peek(), 8);
  assert.equal(updaterCalls, 1);
  assert.equal(notifications, 2);
  stop();
});

test("P03.15 arbitrary captured native side effect is outside binding capability enforcement", () => {
  const raw = signal(0);
  const owner = new OwnedOwner();
  const count = owner.slot(7);
  const capability = () => {};
  const read = context(owner, { count }, "binding", { request: capability, emit: capability, timeout: capability, control: capability });
  const rogue = (_ctx: Context) => { raw.set(99); };
  const result = rogue(read);
  assert.equal(result, undefined);
  assert.equal(raw.peek(), 99);
  assert.equal(count.peek(), 7);
  // Invalid return diagnostics after execution cannot undo this trusted JS effect.
});
