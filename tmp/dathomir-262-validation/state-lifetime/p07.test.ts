/* oxlint-disable unicorn/no-thenable -- These tests intentionally construct PromiseLike edge cases. */
import assert from "node:assert/strict";
import { runInNewContext } from "node:vm";
import {
  afterEach,
  test,
  vi,
} from "../../../packages/reactivity/node_modules/vitest/dist/index.js";
import {
  createRoot,
  effect,
  signal,
  templateEffect,
} from "../../../packages/reactivity/src/index.ts";
import { Lease, LeaseChannels } from "./leases.ts";
import { OwnedOwner } from "./owned.ts";

afterEach(() => vi.useRealTimers());
function deferred<T>() {
  let resolve: (value: T) => void = () => {
    throw new Error("uninitialized");
  };
  let reject: (cause: unknown) => void = () => {
    throw new Error("uninitialized");
  };
  const promise = new Promise<T>((yes, no) => {
    resolve = yes;
    reject = no;
  });
  return { promise, resolve, reject };
}
async function microtasks(): Promise<void> {
  for (let i = 0; i < 12; i++) await Promise.resolve();
}

test("P07.01 fulfilled Copy-like operation retains final timer until callback writes", () => {
  vi.useFakeTimers();
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const source = owner.slot("Copied");
  const ctx = owner.project(source, "operation", lease.current);
  const observed: unknown[] = [];
  const stop = effect(() => observed.push(source.value));
  lease.timeout(() => {
    ctx.set("Ready");
    assert.equal(lease.pins, 1);
  }, 10);
  lease.settle();
  assert.equal(lease.current(), true);
  vi.advanceTimersByTime(10);
  assert.deepEqual(observed, ["Copied", "Ready"]);
  assert.equal(lease.resources.size, 0);
  assert.equal(lease.pins, 0);
  assert.equal(lease.current(), false);
  assert.throws(() => ctx.set("late"), /stale-write/);
  stop();
});

test("P07.02 async final callback pin remains until settle and accepts post-await guarded write", async () => {
  vi.useFakeTimers();
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const source = owner.slot("Waiting");
  const ctx = owner.project(source, "operation", lease.current);
  const reply = deferred<string>();
  lease.timeout(async () => {
    const text = await reply.promise;
    lease.run(() => ctx.set(text));
  }, 1);
  lease.settle();
  vi.advanceTimersByTime(1);
  assert.equal(lease.resources.size, 0);
  assert.equal(lease.pins, 1);
  assert.equal(lease.current(), true);
  reply.resolve("Ready");
  await microtasks();
  assert.equal(source.peek(), "Ready");
  assert.equal(lease.pins, 0);
  assert.equal(lease.current(), false);
});

test("P07.03 explicit replace/dispose immediately invalidates pending async pin", async () => {
  vi.useFakeTimers();
  const owner = new OwnedOwner();
  const channels = new LeaseChannels();
  const old = channels.begin("query", "replace");
  const source = owner.slot("Old");
  const ctx = owner.project(source, "operation", old.current);
  const reply = deferred<string>();
  old.timeout(async () => {
    const text = await reply.promise;
    old.run(() => ctx.set(text));
  }, 1);
  old.settle();
  vi.advanceTimersByTime(1);
  assert.equal(old.pins, 1);
  const next = channels.begin("query", "replace");
  assert.equal(old.current(), false);
  assert.equal(old.abortController.signal.aborted, true);
  assert.equal(old.pins, 1);
  assert.throws(() => ctx.set("escaped"), /stale-write/);
  reply.resolve("late response");
  await microtasks();
  assert.equal(source.peek(), "Old");
  assert.equal(old.pins, 0);
  next.timeout(() => {
    source.set("never");
  }, 1);
  channels.dispose();
  vi.advanceTimersByTime(1);
  assert.equal(source.peek(), "Old");
});

test("P07.04 parallel siblings and another channel survive query replacement", () => {
  const channels = new LeaseChannels();
  const first = channels.begin("query", "parallel");
  const second = channels.begin("query", "parallel");
  const save = channels.begin("save", "parallel");
  assert.equal(first.current(), true);
  assert.equal(second.current(), true);
  channels.begin("query", "replace");
  assert.equal(first.current(), false);
  assert.equal(second.current(), false);
  assert.equal(save.current(), true);
  channels.dispose();
});

test("P07.05 resource release inside synchronous run stays pinned until callback returns", () => {
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const source = owner.slot(0);
  const ctx = owner.project(source, "operation", lease.current);
  let stops = 0;
  const release = lease.onDispose(() => {
    stops++;
  });
  lease.settle();
  lease.run(() => {
    release();
    ctx.set(1);
  });
  assert.equal(source.peek(), 1);
  assert.equal(stops, 1);
  assert.equal(lease.current(), false);
  release();
  assert.equal(stops, 1);
});

test("P07.06 explicit invalidation within pinned run rejects remainder writes", () => {
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const source = owner.slot(0);
  const ctx = owner.project(source, "operation", lease.current);
  lease.run(() => {
    lease.invalidate();
    assert.throws(() => ctx.set(1), /stale-write/);
  });
  assert.equal(source.peek(), 0);
  assert.equal(lease.pins, 0);
});

test("P07.07 synchronous acquisition callback buffers until disposer registration, throw stops source once", () => {
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const source = owner.slot(0);
  const ctx = owner.project(source, "operation", lease.current);
  const trace: string[] = [];
  let late: ((value: number) => void) | undefined;
  let stops = 0;
  const release = lease.subscribe<number>(
    (emit) => {
      late = emit;
      trace.push("start");
      emit(1);
      trace.push("return-disposer");
      return () => {
        stops++;
        trace.push("stop");
      };
    },
    (value) => {
      trace.push("callback");
      ctx.set(value);
      throw new Error("source-callback");
    },
  );
  assert.deepEqual(trace, ["start", "return-disposer", "callback", "stop"]);
  assert.equal(stops, 1);
  assert.equal(source.peek(), 1);
  assert.equal(lease.callbackErrors.length, 1);
  lease.settle();
  late?.(2);
  assert.equal(source.peek(), 1);
  release();
  lease.invalidate();
  assert.equal(stops, 1);
});

test("P07.08 invalidation during synchronous acquisition stops returned disposer without applying buffered event", () => {
  const lease = new Lease(() => true);
  let stops = 0;
  let values = 0;
  assert.throws(
    () =>
      lease.subscribe<number>(
        (emit) => {
          emit(1);
          lease.invalidate();
          return () => {
            stops++;
          };
        },
        () => {
          values++;
        },
      ),
    /stale-resource/,
  );
  assert.equal(stops, 1);
  assert.equal(values, 0);
  assert.equal(lease.pins, 0);
});

test("P07.09 cleanup errors continue in reverse order after token invalidation", () => {
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const source = owner.slot(0);
  const ctx = owner.project(source, "operation", lease.current);
  const trace: string[] = [];
  lease.onDispose(() => {
    trace.push("first");
    assert.throws(() => ctx.set(1), /stale-write/);
  });
  lease.onDispose(() => {
    trace.push("throws");
    throw new Error("cleanup");
  });
  lease.onDispose(() => {
    trace.push("last");
  });
  lease.invalidate();
  lease.invalidate();
  assert.deepEqual(trace, ["last", "throws", "first"]);
  assert.equal(lease.cleanupErrors.length, 1);
  assert.equal(source.peek(), 0);
});

test("P07.10 callback rejection consumed, pin released, successful original operation stays settled", async () => {
  vi.useFakeTimers();
  const lease = new Lease(() => true);
  const reply = deferred<void>();
  lease.timeout(() => reply.promise, 1);
  lease.settle();
  vi.advanceTimersByTime(1);
  reply.reject(new Error("timer rejection"));
  await microtasks();
  assert.equal(lease.settled, true);
  assert.equal(lease.callbackErrors.length, 1);
  assert.equal(lease.pins, 0);
  assert.equal(lease.current(), false);
});

test("P07.11 cancelled callback late rejection is consumed without active error publication", async () => {
  vi.useFakeTimers();
  const lease = new Lease(() => true);
  const reply = deferred<void>();
  lease.timeout(() => reply.promise, 1);
  lease.settle();
  vi.advanceTimersByTime(1);
  lease.invalidate();
  reply.reject(new Error("old rejection"));
  await microtasks();
  assert.equal(lease.callbackErrors.length, 0);
  assert.equal(lease.lateRejections.length, 1);
  assert.equal(lease.pins, 0);
});

test("P07.12 timer chaining retains lease; cancellation and resource stop are idempotent", () => {
  vi.useFakeTimers();
  const lease = new Lease(() => true);
  let callbacks = 0;
  lease.timeout(() => {
    callbacks++;
    lease.timeout(() => {
      callbacks++;
    }, 2);
  }, 1);
  lease.settle();
  vi.advanceTimersByTime(1);
  assert.equal(lease.current(), true);
  assert.equal(lease.resources.size, 1);
  vi.advanceTimersByTime(2);
  assert.equal(callbacks, 2);
  assert.equal(lease.current(), false);
  const other = new Lease(() => true);
  const cancel = other.timeout(() => {
    callbacks++;
  }, 2);
  other.settle();
  cancel();
  cancel();
  vi.advanceTimersByTime(2);
  assert.equal(callbacks, 2);
});

test("P07.13 actual engine root does not own raw effects; explicit lease registration does", () => {
  const value = signal(0);
  const observed: string[] = [];
  let stopRaw = () => {};
  const stopRoot = createRoot(() => {
    templateEffect(() => observed.push(`template:${value.value}`));
    stopRaw = effect(() => observed.push(`raw:${value.value}`));
  });
  stopRoot();
  value.set(1);
  assert.deepEqual(observed, ["template:0", "raw:0", "raw:1"]);
  const lease = new Lease(() => true);
  lease.onDispose(stopRaw);
  lease.invalidate();
  value.set(2);
  assert.deepEqual(observed, ["template:0", "raw:0", "raw:1"]);
});

test("P07.14 settled leases leave the channel registry rather than accumulating history", () => {
  const channels = new LeaseChannels();
  for (let i = 0; i < 100; i++) channels.begin("query", "parallel").settle();
  assert.equal(channels.channels.size, 0);
  const old = channels.begin("query", "replace");
  const next = channels.begin("query", "replace");
  assert.equal(old.current(), false);
  assert.equal(channels.channels.get("query")?.has(next), true);
  next.settle();
  assert.equal(channels.channels.size, 0);
});

test("P07.15 released subscription late callback is fenced while another resource keeps lease alive", () => {
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const state = owner.slot(0);
  const ctx = owner.project(state, "operation", lease.current);
  const keepAlive = lease.onDispose(() => {});
  let oldCallback: ((value: number) => void) | undefined;
  const release = lease.subscribe<number>(
    (emit) => {
      oldCallback = emit;
      return () => {};
    },
    (value) => ctx.set(value),
  );
  lease.settle();
  release();
  assert.equal(lease.current(), true);
  oldCallback?.(1);
  assert.equal(state.peek(), 0);
  keepAlive();
});

test("P07.16 pending source continuation is resource-token guarded while sibling keeps lease alive", async () => {
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const state = owner.slot(0);
  const keepAlive = lease.onDispose(() => {});
  const reply = deferred<void>();
  const release = lease.subscribe<number>(
    (emit) => {
      emit(1);
      return () => {};
    },
    async (value, valid) => {
      const ctx = owner.project(state, "operation", valid);
      await reply.promise;
      ctx.set(value);
    },
  );
  lease.settle();
  release();
  assert.equal(lease.current(), true);
  reply.resolve();
  await microtasks();
  assert.equal(state.peek(), 0);
  assert.equal(lease.callbackErrors.length, 0);
  assert.equal(lease.lateRejections.length, 1);
  keepAlive();
});

function foreignDeferred() {
  let resolve: () => void = () => {
    throw new Error("uninitialized");
  };
  let reject: (cause: unknown) => void = () => {
    throw new Error("uninitialized");
  };
  const value: unknown = runInNewContext("new Promise((yes, no) => publish(yes, no))", {
    publish(yes: () => void, no: (cause: unknown) => void) {
      resolve = yes;
      reject = no;
    },
  });
  function hasPromiseMethods(candidate: unknown): candidate is Promise<void> {
    return (
      typeof candidate === "object" &&
      candidate !== null &&
      typeof Reflect.get(candidate, "then") === "function" &&
      typeof Reflect.get(candidate, "catch") === "function"
    );
  }
  if (!hasPromiseMethods(value)) throw new Error("foreign-native-fixture");
  assert.equal(value instanceof Promise, false);
  return { promise: value, resolve, reject };
}

test("P07.17 synchronous run rejects and observes foreign native Promise return", async () => {
  const lease = new Lease(() => true);
  const reply = foreignDeferred();
  assert.equal(
    lease.run(() => reply.promise),
    undefined,
  );
  assert.equal(lease.callbackErrors.length, 1);
  lease.settle();
  reply.reject(new Error("foreign-run-reject"));
  await microtasks();
  assert.equal(lease.lateRejections.length, 1);
});

test("P07.18 foreign native timer Promise retains final pin and observes rejection", async () => {
  vi.useFakeTimers();
  const lease = new Lease(() => true);
  const reply = foreignDeferred();
  lease.timeout(() => reply.promise, 1);
  lease.settle();
  vi.advanceTimersByTime(1);
  assert.equal(lease.pins, 1);
  assert.equal(lease.current(), true);
  reply.reject(new Error("foreign-timer-reject"));
  await microtasks();
  assert.equal(lease.callbackErrors.length, 1);
  assert.equal(lease.pins, 0);
  assert.equal(lease.current(), false);
});

test("P07.19 foreign native subscription Promise retains pin after source removal", async () => {
  const lease = new Lease(() => true);
  const reply = foreignDeferred();
  const release = lease.subscribe<number>(
    (emit) => {
      emit(1);
      return () => {};
    },
    () => reply.promise,
  );
  lease.settle();
  release();
  assert.equal(lease.pins, 1);
  assert.equal(lease.current(), true);
  reply.reject(new Error("foreign-source-reject"));
  await microtasks();
  assert.equal(lease.lateRejections.length, 1);
  assert.equal(lease.pins, 0);
  assert.equal(lease.current(), false);
});

test("P07.20 replace cleanup reentrancy uses latest admission and does not iterate newly added leases", () => {
  const channels = new LeaseChannels();
  const old = channels.begin("query", "parallel");
  let nested: Lease | undefined;
  let cleanupCalls = 0;
  old.onDispose(() => {
    cleanupCalls++;
    nested = channels.begin("query", "replace");
    nested.onDispose(() => {
      cleanupCalls++;
    });
  });
  const outer = channels.begin("query", "replace");
  assert.equal(nested?.current(), true);
  assert.equal(outer.current(), false);
  assert.equal(cleanupCalls, 1);
  assert.ok(nested);
  assert.equal(channels.channels.get("query")?.has(nested), true);
  channels.dispose();
  assert.equal(cleanupCalls, 2);
});

test("P07.21 trusted thenable inspection reads once and throwing access/call does not leak pins", async () => {
  const lease = new Lease(() => true);
  let reads = 0;
  const thenable = {
    get then() {
      reads++;
      return () => {
        throw new Error("trusted-then-call");
      };
    },
  };
  assert.equal(
    lease.run(() => thenable),
    undefined,
  );
  assert.equal(reads, 1);
  lease.settle();
  await microtasks();
  assert.equal(lease.callbackErrors.length, 1);
  assert.equal(lease.lateRejections.length, 1);
  assert.equal(lease.pins, 0);
  const other = new Lease(() => true);
  other.run(() => ({
    get then() {
      throw new Error("trusted-then-getter");
    },
  }));
  other.settle();
  assert.equal(other.callbackErrors.length, 1);
  assert.equal(other.pins, 0);
});

test("P07.22 foreign native fulfillment permits guarded callback write before final pin release", async () => {
  vi.useFakeTimers();
  const owner = new OwnedOwner();
  const lease = new Lease(() => owner.active);
  const state = owner.slot(0);
  const ctx = owner.project(state, "operation", lease.current);
  const reply = foreignDeferred();
  lease.timeout(
    () =>
      reply.promise.then(() => {
        ctx.set(1);
        assert.equal(lease.pins, 1);
      }),
    1,
  );
  lease.settle();
  vi.advanceTimersByTime(1);
  reply.resolve();
  await microtasks();
  assert.equal(state.peek(), 1);
  assert.equal(lease.pins, 0);
  assert.equal(lease.current(), false);
});
