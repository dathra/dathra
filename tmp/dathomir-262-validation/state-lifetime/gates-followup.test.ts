/* oxlint-disable unicorn/no-thenable -- These tests intentionally construct PromiseLike edge cases. */
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import { test } from "../../../packages/reactivity/node_modules/vitest/dist/index.js";
import { effect } from "../../../packages/reactivity/src/index.ts";
import { OwnedOwner } from "./owned.ts";
import { context } from "./phases.ts";
import { BindingEvaluator } from "./evaluator.ts";
import { PublicationGate, ReceiveQueue } from "./publication.ts";
import { Lease, LeaseChannels } from "./leases.ts";

function deferred() {
  let resolve: () => void = () => {
    throw new Error("uninitialized");
  };
  const promise = new Promise<void>((yes) => {
    resolve = yes;
  });
  return { promise, resolve };
}
function foreign(invoke: () => void, hold?: Promise<void>): unknown {
  const result: unknown = runInNewContext(
    hold === undefined
      ? "(async () => { invoke(); })()"
      : "(async () => { await hold; invoke(); })()",
    { invoke, hold },
  );
  assert.equal(result instanceof Promise, false);
  return result;
}
async function drain(): Promise<void> {
  for (let i = 0; i < 16; i++) await Promise.resolve();
}
function binding() {
  const owner = new OwnedOwner();
  const slot = owner.slot(0);
  const readonly = owner.project(slot, "binding");
  let calls = 0;
  const operation = () => {
    calls++;
  };
  const ctx = context(owner, { slot }, "binding", {
    request: operation,
    emit: operation,
    timeout: operation,
    control: operation,
  });
  return { owner, slot, readonly, ctx, calls: () => calls };
}

test("G01 foreign async binding rejects write/capability before mutation and observes rejection", async () => {
  const fixture = binding();
  const evaluator = new BindingEvaluator();
  assert.throws(
    () => evaluator.evaluate(() => foreign(() => fixture.readonly.set(1)), fixture.ctx),
    /binding-promise-content/,
  );
  assert.throws(
    () => evaluator.evaluate(() => foreign(() => fixture.ctx.request()), fixture.ctx),
    /binding-promise-content/,
  );
  await drain();
  assert.equal(evaluator.rejections.length, 2);
  assert.equal(fixture.slot.peek(), 0);
  assert.equal(fixture.calls(), 0);
});

test("G02 foreign async binding remains immutable after await both live and disposed", async () => {
  for (const disposed of [false, true]) {
    const fixture = binding();
    const reply = deferred();
    const evaluator = new BindingEvaluator();
    assert.throws(
      () =>
        evaluator.evaluate(
          () => foreign(() => fixture.readonly.set(1), reply.promise),
          fixture.ctx,
        ),
      /binding-promise-content/,
    );
    if (disposed) fixture.owner.dispose();
    reply.resolve();
    await drain();
    assert.equal(evaluator.rejections.length, 1);
    assert.equal(fixture.slot.peek(), 0);
  }
});

test("G03 trusted binding thenables are observed after content rejection without granting operation authority", async () => {
  const fixture = binding();
  const evaluator = new BindingEvaluator();
  let reads = 0;
  const content = {
    get then() {
      reads++;
      return (_resolve: (value: unknown) => void, reject: (cause: unknown) => void) => {
        try {
          fixture.readonly.set(1);
        } catch (cause) {
          reject(cause);
        }
      };
    },
  };
  assert.throws(() => evaluator.evaluate(() => content, fixture.ctx), /binding-promise-content/);
  assert.throws(
    () =>
      evaluator.evaluate(
        () => ({
          then() {
            fixture.ctx.request();
          },
        }),
        fixture.ctx,
      ),
    /binding-promise-content/,
  );
  fixture.owner.dispose();
  await drain();
  assert.equal(reads, 1);
  assert.equal(evaluator.rejections.length, 2);
  assert.equal(fixture.slot.peek(), 0);
  assert.equal(fixture.calls(), 0);
});

test("G04 foreign receive stays synchronous and cached setters/capabilities expire before continuation", async () => {
  const owner = new OwnedOwner();
  const slot = owner.slot(0);
  const reply = deferred();
  const gate = new PublicationGate();
  let operationCalls = 0;
  const operation = () => {
    operationCalls++;
  };
  let cached = () => {};
  let cachedRequest = () => {};
  const queue = new ReceiveQueue({ label: "Seed", version: 0 }, gate, (_input, valid) => {
    const write = owner.project(slot, "operation", valid);
    const ctx = context(
      owner,
      {},
      "operation",
      { request: operation, emit: operation, timeout: operation, control: operation },
      valid,
    );
    cached = () => write.set(1);
    cachedRequest = () => {
      ctx.request();
    };
    return foreign(cached, reply.promise);
  });
  queue.offer({ label: "Next", version: 1 });
  assert.equal(queue.flush(), "failed");
  assert.equal(queue.applied.label, "Seed");
  assert.throws(cached, /stale-write/);
  assert.throws(cachedRequest, /stale-capability/);
  reply.resolve();
  await drain();
  assert.equal(queue.errors.length, 1);
  assert.equal(queue.rejections.length, 1);
  assert.equal(slot.peek(), 0);
  assert.equal(operationCalls, 0);
  assert.equal(queue.live, true);
});

test("G05 trusted receive thenables observe throwing/rejecting callbacks after invocation has ended", async () => {
  const owner = new OwnedOwner();
  const slot = owner.slot(0);
  let reads = 0;
  const queue = new ReceiveQueue(
    { label: "Seed", version: 0 },
    new PublicationGate(),
    (_input, valid) => {
      const write = owner.project(slot, "operation", valid);
      return {
        get then() {
          reads++;
          return () => {
            write.set(1);
          };
        },
      };
    },
  );
  queue.offer({ label: "Next", version: 1 });
  assert.equal(queue.flush(), "failed");
  queue.dispose();
  await drain();
  assert.equal(reads, 1);
  assert.equal(queue.rejections.length, 1);
  assert.equal(slot.peek(), 0);
  assert.equal(queue.applied.label, "Seed");
});

test("G06 rejected foreign receive is contained after disposal and cannot publish success", async () => {
  const queue = new ReceiveQueue({ label: "Seed", version: 0 }, new PublicationGate(), () =>
    foreign(() => {
      throw new Error("foreign-receiver-rejection");
    }),
  );
  queue.offer({ label: "Next", version: 1 });
  assert.equal(queue.flush(), "failed");
  queue.dispose();
  await drain();
  assert.equal(queue.errors.length, 1);
  assert.equal(queue.rejections.length, 1);
  assert.equal(queue.applied.label, "Seed");
});

test("G07 receive scope ends before native batch flush effects can reuse a captured writer", () => {
  const owner = new OwnedOwner();
  const slot = owner.slot(0);
  let saved = () => {};
  let failed = 0;
  const stop = effect(() => {
    if (slot.value === 1) {
      assert.throws(saved, /stale-write/);
      failed++;
    }
  });
  const queue = new ReceiveQueue(
    { label: "Seed", version: 0 },
    new PublicationGate(),
    (_input, valid) => {
      const write = owner.project(slot, "operation", valid);
      saved = () => write.set(2);
      write.set(1);
    },
  );
  queue.offer({ label: "Next", version: 1 });
  assert.equal(queue.flush(), "success");
  assert.equal(failed, 1);
  assert.equal(slot.peek(), 1);
  assert.throws(saved, /stale-write/);
  stop();
});

test("G08 replace revokes old sibling B before A cleanup invokes B cached writer", () => {
  const owner = new OwnedOwner();
  const slot = owner.slot(0);
  const channels = new LeaseChannels();
  const a = channels.begin("query", "parallel");
  const b = channels.begin("query", "parallel");
  const writeB = owner.project(slot, "operation", b.current).set;
  let denied = 0;
  a.onDispose(() => {
    assert.throws(() => writeB(1), /stale-write/);
    denied++;
  });
  const next = channels.begin("query", "replace");
  assert.deepEqual([slot.peek(), denied, a.cleanupErrors.length], [0, 1, 0]);
  assert.equal(denied, 1);
  assert.equal(a.cleanupErrors.length, 0);
  assert.equal(slot.peek(), 0);
  assert.equal(b.current(), false);
  assert.equal(next.current(), true);
  channels.dispose();
});

test("G09 sibling source and lease authority are revoked before any abort listener or provider stop", () => {
  const owner = new OwnedOwner();
  const slot = owner.slot(0);
  const channels = new LeaseChannels();
  const a = channels.begin("query", "parallel");
  const b = channels.begin("query", "parallel");
  const writeB = owner.project(slot, "operation", b.current).set;
  let oldEmit = (_value: number) => {};
  let attempts = 0;
  const emitIntoB = () => {
    oldEmit(1);
    attempts++;
  };
  a.abortController.signal.addEventListener("abort", emitIntoB);
  a.onDispose(emitIntoB);
  b.subscribe<number>(
    (emit) => {
      oldEmit = emit;
      return () => {
        emit(2);
        attempts++;
      };
    },
    (value) => writeB(value),
  );
  channels.begin("query", "replace");
  assert.equal(attempts, 3);
  assert.equal(slot.peek(), 0);
  assert.equal(b.callbackErrors.length, 0);
  channels.dispose();
});

test("G10 revoke-all cleanup still lets the last reentrant replace admission win", () => {
  const owner = new OwnedOwner();
  const channels = new LeaseChannels();
  const slot = owner.slot(0);
  const a = channels.begin("query", "parallel");
  const b = channels.begin("query", "parallel");
  const writeB = owner.project(slot, "operation", b.current).set;
  let nested: Lease | undefined;
  const trace: string[] = [];
  a.onDispose(() => {
    assert.throws(() => writeB(1), /stale-write/);
    trace.push("A-cleanup");
    nested = channels.begin("query", "replace");
  });
  b.onDispose(() => {
    trace.push("B-cleanup");
  });
  const outer = channels.begin("query", "replace");
  assert.ok(nested);
  assert.equal(nested.current(), true);
  assert.equal(outer.current(), false);
  assert.deepEqual(trace, ["A-cleanup", "B-cleanup"]);
  assert.equal(channels.channels.get("query")?.has(nested), true);
  assert.equal(slot.peek(), 0);
  channels.dispose();
});

test("G11 disposal reentrancy during replace closes reserved admission and all prior siblings", () => {
  const channels = new LeaseChannels();
  const a = channels.begin("query", "parallel");
  const b = channels.begin("query", "parallel");
  a.onDispose(() => {
    assert.equal(b.current(), false);
    channels.dispose();
  });
  const outer = channels.begin("query", "replace");
  assert.equal(outer.current(), false);
  assert.equal(a.cleanupErrors.length, 0);
  assert.equal(channels.channels.size, 0);
  assert.throws(() => channels.begin("query", "replace"), /disposed-owner/);
});
