import assert from "node:assert/strict";
import { test } from "../../../packages/reactivity/node_modules/vitest/dist/index.js";
import { createRequire } from "node:module";
import { batch, effect, signal } from "../../../packages/reactivity/src/index.ts";
import { OwnedOwner } from "./owned.ts";
import { PublicationGate, ReceiveQueue } from "./publication.ts";

const require = createRequire(new URL("../../../packages/runtime/package.json", import.meta.url));
const happyDomPath: string = require.resolve("happy-dom");
const { Window } = await import(happyDomPath);
function target(text = "Alpha") {
  const window = new Window();
  const node = window.document.createElement("p");
  node.textContent = text;
  window.document.body.append(node);
  return node;
}

test("P06.01 Accepted260 known batch-throw constraint: actual partial model and DOM writes", () => {
  const value = signal("Alpha");
  const node = target();
  const stop = effect(() => { node.textContent = value.value; });
  assert.throws(() => batch(() => { value.set("Beta"); throw new Error("receiver"); }));
  assert.equal(value.peek(), "Beta");
  assert.equal(node.textContent, "Beta");
  stop();
});

test("P06.02 failed causal publication discarded; model and external native effects are not rolled back", () => {
  const incoming = signal("Alpha");
  const draft = signal("Alpha");
  const gate = new PublicationGate();
  const node = target();
  const peer = target();
  const commits: string[] = [];
  const stop = gate.bind(() => `${incoming.value}/${draft.value}`, value => { node.textContent = value; commits.push(value); });
  const stopPeer = gate.bind(() => incoming.value, value => { peer.textContent = value; });
  const external: string[] = [];
  const stopExternal = effect(() => { external.push(incoming.value); });
  assert.throws(() => gate.attempt(() => { incoming.set("Beta"); draft.set("Beta"); throw new Error("receiver"); }));
  assert.equal(node.textContent, "Alpha/Alpha");
  assert.equal(peer.textContent, "Alpha");
  assert.equal(incoming.peek(), "Beta");
  assert.equal(draft.peek(), "Beta");
  assert.deepEqual(commits, ["Alpha/Alpha"]);
  assert.deepEqual(external, ["Alpha", "Beta"]);
  gate.attempt(() => { incoming.set("Gamma"); draft.set("Gamma"); });
  assert.equal(node.textContent, "Gamma/Gamma");
  assert.deepEqual(commits, ["Alpha/Alpha", "Gamma/Gamma"]);
  stop(); stopPeer(); stopExternal();
});

test("P06.03 later healthy event may publish failed attempt's partial model", () => {
  const value = signal("Alpha");
  const revision = signal(0);
  const gate = new PublicationGate();
  const node = target();
  const stop = gate.bind(() => { revision.value; return value.value; }, next => { node.textContent = next; });
  assert.throws(() => gate.attempt(() => { value.set("Beta"); throw new Error("receiver"); }));
  assert.equal(node.textContent, "Alpha");
  revision.set(1);
  assert.equal(node.textContent, "Beta");
  stop();
});

test("P06.04 seed no-op, latest coalesce, failed input suppress and explicit retry", () => {
  const owner = new OwnedOwner();
  const incoming = owner.slot("Alpha");
  const gate = new PublicationGate();
  const node = target();
  let receiverCalls = 0;
  let shouldThrow = false;
  const stop = gate.bind(() => String(incoming.value), value => { node.textContent = value; });
  const queue = new ReceiveQueue({ label: "Alpha", version: 1 }, gate, (input, valid) => {
    receiverCalls++;
    owner.project(incoming, "operation", valid).set(input.label);
    if (shouldThrow) throw new Error("receiver");
  });
  queue.offer({ version: 1, label: "Alpha" });
  assert.equal(queue.flush(), "none");
  assert.equal(receiverCalls, 0);
  queue.admitted = false;
  queue.offer({ label: "Beta", version: 2 });
  queue.offer({ label: "Gamma", version: 3 });
  assert.equal(queue.flush(), "none");
  queue.admitted = true;
  assert.equal(queue.flush(), "success");
  assert.equal(receiverCalls, 1);
  assert.equal(node.textContent, "Gamma");
  shouldThrow = true;
  queue.offer({ label: "Delta", version: 4 });
  assert.equal(queue.flush(), "failed");
  assert.equal(incoming.peek(), "Delta");
  assert.equal(node.textContent, "Gamma");
  assert.equal(queue.applied.label, "Gamma");
  queue.offer({ label: "Delta", version: 4 });
  assert.equal(queue.flush(), "none");
  assert.equal(receiverCalls, 2);
  shouldThrow = false;
  queue.offer({ label: "Delta", version: 4 }, true);
  assert.equal(queue.flush(), "success");
  // Equal native state need not invalidate a binding; explicit refresh must reprepare it.
  assert.equal(node.textContent, "Gamma");
  assert.equal(incoming.peek(), "Delta");
  stop();
});

test("P06.05 pending changed input then latest baseline must cancel outdated receive", () => {
  let calls = 0;
  const queue = new ReceiveQueue({ label: "Alpha", version: 1 }, new PublicationGate(), () => { calls++; });
  queue.offer({ label: "Beta", version: 2 });
  queue.offer({ label: "Alpha", version: 1 });
  assert.equal(queue.flush(), "none");
  assert.equal(calls, 0);
});

test("P06.06 receive outside parent effect avoids leaking child read dependencies", () => {
  const parent = signal({ label: "Alpha", version: 1 });
  const child = signal("local draft");
  let parentRuns = 0;
  const queue = new ReceiveQueue(parent.peek(), new PublicationGate(), input => { child.value; child.set(input.label); });
  const stopParent = effect(() => { parentRuns++; queue.offer(parent.value); });
  queue.flush();
  parent.set({ label: "Beta", version: 2 });
  assert.equal(parentRuns, 2);
  queue.flush();
  assert.equal(child.peek(), "Beta");
  child.set("edited");
  assert.equal(parentRuns, 2);
  stopParent();
});

test("P06.07 disposed child cannot receive, publish queued plan, or use captured invocation setter", () => {
  const owner = new OwnedOwner();
  const value = owner.slot("Alpha");
  const gate = new PublicationGate();
  const node = target();
  let active = true;
  const stop = gate.bind(() => String(value.value), text => { node.textContent = text; }, () => active);
  gate.attempt(() => { value.set("Beta"); active = false; });
  assert.equal(node.textContent, "Alpha");
  active = true;
  let saved: ((value: unknown) => void) | undefined;
  const queue = new ReceiveQueue({ label: "Alpha", version: 1 }, gate, (input, valid) => {
    saved = owner.project(value, "operation", valid).set;
    saved(input.label);
  });
  queue.offer({ label: "Gamma", version: 3 });
  assert.equal(queue.flush(), "success");
  assert.ok(saved !== undefined);
  assert.throws(() => saved?.("late"), /stale-write/);
  queue.dispose();
  queue.offer({ label: "Delta", version: 4 });
  assert.equal(queue.flush(), "none");
  assert.equal(value.peek(), "Gamma");
  stop();
});
