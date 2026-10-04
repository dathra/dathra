import { beforeAll, afterAll, expect, it } from 'vitest';
import { harness } from './browser-harness.mjs';
let h;
beforeAll(async () => { h = await harness('counter'); });
afterAll(async () => { await h.close(); });

it('restores SSR 7, refreshes automatically, increments through actual engine, and blocks writes after disposal', async () => {
  const r = await h.observe('complete browser counter baseline', '<main><p id="counter">Count: 7</p><button id="increment">Increment</button></main>', async page => {
    const admitted = await page.evaluate(() => {
      const text = document.getElementById('counter').firstChild, button = document.getElementById('increment');
      const a = Object.freeze({ id: 'response:counter:1', count: 7, initialText: 'Count: 7', text, button });
      const forbidden = { initializer: 0, template: 0 };
      // Server callbacks are witnesses that would fail if invoked; the client uses only the snapshot.
      const registry = Object.freeze({
        countText(ctx) { return `Count = ${ctx.values.count.value}`; },
        increment(ctx) { ctx.values.count.set(previous => previous + 1); },
        serverInitializer() { forbidden.initializer++; throw new Error('server initializer replay'); },
        serverTemplate() { forbidden.template++; throw new Error('server template replay'); },
      });
      const beforeCommit = [];
      const owner = Proof.counterBaseline(a, registry, { beforeCommit() { beforeCommit.push(text.data); } });
      window.counterCase = { owner, text, button, forbidden, a };
      return { atAdmissionCommit: beforeCommit[0], afterAutomaticRefresh: text.data,
        restored: owner.count.peek(), sameText: text === document.getElementById('counter').firstChild,
        forbidden, trace: owner.trace };
    });
    await page.locator('#increment').click();
    const first = await page.evaluate(() => ({ count: counterCase.owner.count.peek(), text: counterCase.text.data }));
    for (let i = 0; i < 4; i++) await page.locator('#increment').click();
    const last = await page.evaluate(() => {
      const { owner, text, button, forbidden, a } = counterCase;
      const count = owner.count.peek(), display = text.data;
      const sameOwner = Proof.counterBaseline(a, {}) === owner;
      owner.dispose(); owner.dispose(); button.click();
      const afterLateClick = owner.count.peek(); owner.count.set(99);
      return { count, display, afterLateClick, afterRawEngineWrite: text.data,
        sameText: text === document.getElementById('counter').firstChild, sameOwner, forbidden };
    });
    return { admitted, first, last };
  });
  expect(r.admitted.atAdmissionCommit).toBe('Count: 7'); expect(r.admitted.afterAutomaticRefresh).toBe('Count = 7'); expect(r.admitted.restored).toBe(7);
  expect(r.admitted.sameText).toBe(true); expect(r.admitted.forbidden).toEqual({ initializer: 0, template: 0 });
  expect(r.first).toEqual({ count: 8, text: 'Count = 8' });
  expect(r.last).toEqual({ count: 12, display: 'Count = 12', afterLateClick: 12, afterRawEngineWrite: 'Count = 12', sameText: true, sameOwner: true, forbidden: { initializer: 0, template: 0 } });
});
