import { beforeAll, afterAll, expect, it } from "vitest";
import { harness } from "./browser-harness.mjs";
let h;
beforeAll(async () => {
  h = await harness("counter");
});
afterAll(async () => {
  await h.close();
});

it("restores SSR 7, refreshes automatically, increments through actual engine, and blocks writes after disposal", async () => {
  const r = await h.observe(
    "complete browser counter baseline",
    '<main><p id="counter">Count: 7</p><button id="increment">Increment</button></main>',
    async (page) => {
      const admitted = await page.evaluate(() => {
        const text = document.getElementById("counter").firstChild,
          button = document.getElementById("increment");
        const a = Object.freeze({
          id: "response:counter:1",
          count: 7,
          initialText: "Count: 7",
          text,
          button,
        });
        const forbidden = { initializer: 0, template: 0 };
        // Server callbacks are witnesses that would fail if invoked; the client uses only the snapshot.
        const registry = Object.freeze({
          countText(ctx) {
            return `Count = ${ctx.values.count.value}`;
          },
          increment(ctx) {
            ctx.values.count.set((previous) => previous + 1);
          },
          serverInitializer() {
            forbidden.initializer++;
            throw new Error("server initializer replay");
          },
          serverTemplate() {
            forbidden.template++;
            throw new Error("server template replay");
          },
        });
        const beforeCommit = [];
        const owner = Proof.counterBaseline(a, registry, {
          beforeCommit() {
            beforeCommit.push(text.data);
          },
        });
        window.counterCase = { owner, text, button, forbidden, a };
        return {
          atAdmissionCommit: beforeCommit[0],
          afterAutomaticRefresh: text.data,
          restored: owner.count.peek(),
          sameText: text === document.getElementById("counter").firstChild,
          forbidden,
          trace: owner.trace,
        };
      });
      await page.locator("#increment").click();
      const first = await page.evaluate(() => ({
        count: counterCase.owner.count.peek(),
        text: counterCase.text.data,
      }));
      for (let i = 0; i < 4; i++) await page.locator("#increment").click();
      const last = await page.evaluate(() => {
        const { owner, text, button, forbidden, a } = counterCase;
        const count = owner.count.peek(),
          display = text.data;
        const sameOwner = Proof.counterBaseline(a, {}) === owner;
        owner.dispose();
        owner.dispose();
        button.click();
        const afterLateClick = owner.count.peek();
        owner.count.set(99);
        return {
          count,
          display,
          afterLateClick,
          afterRawEngineWrite: text.data,
          sameText: text === document.getElementById("counter").firstChild,
          sameOwner,
          forbidden,
        };
      });
      return { admitted, first, last };
    },
  );
  expect(r.admitted.atAdmissionCommit).toBe("Count: 7");
  expect(r.admitted.afterAutomaticRefresh).toBe("Count = 7");
  expect(r.admitted.restored).toBe(7);
  expect(r.admitted.sameText).toBe(true);
  expect(r.admitted.forbidden).toEqual({ initializer: 0, template: 0 });
  expect(r.first).toEqual({ count: 8, text: "Count = 8" });
  expect(r.last).toEqual({
    count: 12,
    display: "Count = 12",
    afterLateClick: 12,
    afterRawEngineWrite: "Count = 12",
    sameText: true,
    sameOwner: true,
    forbidden: { initializer: 0, template: 0 },
  });
});

it("counter acquisition failure is terminal for its association and removes staged operations", async () => {
  const r = await h.observe(
    "counter terminal acquisition failure",
    '<p id="counter">Count: 7</p><button id="increment">Increment</button>',
    (page) =>
      page.evaluate(() => {
        const text = document.getElementById("counter").firstChild,
          button = document.getElementById("increment");
        const association = Object.freeze({ count: 7, initialText: "Count: 7", text, button });
        let getterCalls = 0,
          operations = 0,
          failure,
          retry;
        let acquiredCount;
        const registry = {
          countText(ctx) {
            acquiredCount = ctx.values.count;
            getterCalls++;
            return `Count = ${ctx.values.count.value}`;
          },
          increment() {
            operations++;
          },
        };
        try {
          Proof.counterBaseline(association, registry, {
            beforeCommit() {
              button.click();
              throw new Error("required counter acquisition failed");
            },
          });
        } catch (error) {
          failure = error.message;
        }
        button.click();
        acquiredCount.set(99);
        try {
          Proof.counterBaseline(association, registry);
        } catch (error) {
          retry = error.message;
        }
        return {
          failure,
          retry,
          getterCalls,
          operations,
          text: text.data,
          sameText: text === document.getElementById("counter").firstChild,
        };
      }),
  );
  expect(r.failure).toBe("required counter acquisition failed");
  expect(r.retry).toMatch(/^COUNTER_ADMISSION_TERMINAL/);
  expect(r.getterCalls).toBe(1);
  expect(r.operations).toBe(0);
  expect(r.text).toBe("Count: 7");
  expect(r.sameText).toBe(true);
});

it("duplicate counter admission after disposal cannot reactivate that identity", async () => {
  const r = await h.observe(
    "counter duplicate after disposal",
    '<p id="counter">Count: 7</p><button id="increment">Increment</button>',
    (page) =>
      page.evaluate(() => {
        const text = document.getElementById("counter").firstChild,
          button = document.getElementById("increment");
        const association = Object.freeze({ count: 7, initialText: "Count: 7", text, button });
        let getters = 0,
          operations = 0,
          retry;
        const registry = {
          countText(ctx) {
            getters++;
            return `Count = ${ctx.values.count.value}`;
          },
          increment(ctx) {
            operations++;
            ctx.values.count.set((value) => value + 1);
          },
        };
        const owner = Proof.counterBaseline(association, registry);
        owner.dispose();
        owner.dispose();
        try {
          Proof.counterBaseline(association, registry);
        } catch (error) {
          retry = error.message;
        }
        button.click();
        owner.count.set(99);
        return { retry, getters, operations, text: text.data, count: owner.count.peek() };
      }),
  );
  expect(r.retry).toMatch(/^COUNTER_ADMISSION_TERMINAL/);
  expect(r.getters).toBe(1);
  expect(r.operations).toBe(0);
  expect(r.text).toBe("Count = 7");
  expect(r.count).toBe(99);
});

it("automatic postcommit refresh failure is an active operation failure, with explicit retry and no admission replay", async () => {
  const r = await h.observe(
    "counter first active refresh failure",
    '<p id="counter">Count: 7</p><button id="increment">Increment</button>',
    (page) =>
      page.evaluate(() => {
        const text = document.getElementById("counter").firstChild,
          button = document.getElementById("increment");
        const association = Object.freeze({ count: 7, initialText: "Count: 7", text, button });
        let getters = 0,
          fail = true;
        const descriptor = Object.getOwnPropertyDescriptor(CharacterData.prototype, "data");
        Object.defineProperty(text, "data", {
          get() {
            return descriptor.get.call(this);
          },
          set(value) {
            if (fail) throw new Error("active refresh setter failed");
            descriptor.set.call(this, value);
          },
        });
        const registry = {
          countText(ctx) {
            getters++;
            return `Count = ${ctx.values.count.value}`;
          },
          increment(ctx) {
            ctx.values.count.set((value) => value + 1);
          },
        };
        const owner = Proof.counterBaseline(association, registry);
        const failed = {
          state: owner.inspect().state,
          refreshOK: owner.initialRefresh.ok,
          error: owner.initialRefresh.error.message,
          display: text.data,
          committed: owner.trace.some((item) => item.commit === true),
        };
        const duplicate = Proof.counterBaseline(association, registry) === owner;
        fail = false;
        owner.refresh();
        button.click();
        return {
          failed,
          duplicate,
          getters,
          display: text.data,
          count: owner.count.peek(),
          state: owner.inspect().state,
        };
      }),
  );
  expect(r.failed).toEqual({
    state: "active",
    refreshOK: false,
    error: "active refresh setter failed",
    display: "Count: 7",
    committed: true,
  });
  expect(r.duplicate).toBe(true);
  expect(r.getters).toBe(2);
  expect(r.display).toBe("Count = 8");
  expect(r.count).toBe(8);
  expect(r.state).toBe("active");
});
