import { beforeAll, afterAll, expect, it } from 'vitest';
import { harness, inputHTML } from './browser-harness.mjs';
let h;
beforeAll(async () => { h = await harness('counterexamples'); });
afterAll(async () => { await h.close(); });

it('current low-level reconcile is not an SSR-adoption kernel', async () => {
  const r = await h.observe('existing reconcile SSR duplication', '<ul id="list"><li>Alpha</li><li>Beta</li></ul>', page => page.evaluate(() => {
    const root = document.getElementById('list'), old = [...root.childNodes]; let factory = 0;
    Proof.reconcile(root, [{ _key: 'a', text: 'Alpha' }, { _key: 'b', text: 'Beta' }], item => item._key, item => {
      factory++; const node = document.createElement('li'); node.textContent = item.text; return node;
    });
    return { factory, children: root.childNodes.length, text: root.textContent, originalStillPresent: old.every(node => node.parentNode === root), firstIsOriginal: root.firstChild === old[0] };
  }));
  expect(r).toEqual({ factory: 2, children: 4, text: 'AlphaBetaAlphaBeta', originalStillPresent: true, firstIsOriginal: false });
});

it('a bare DocumentFragment empties on insertion and cannot represent a retained extent', async () => {
  const r = await h.observe('DocumentFragment counterexample', '<main id="root"></main>', page => page.evaluate(() => {
    const fragment = document.createDocumentFragment(); fragment.append(document.createElement('span'), document.createElement('em'));
    const root = document.getElementById('root'); root.append(fragment);
    return { fragmentChildren: fragment.childNodes.length, rootChildren: root.childNodes.length };
  }));
  expect(r).toEqual({ fragmentChildren: 0, rootChildren: 2 });
});

it('same Node identity via insertBefore still disconnects/reconnects a Web Component and loses focused input', async () => {
  const r = await h.observe('physical insertBefore lifecycle', '<main id="root"><x-proof-row id="a"><input value="Alpha"></x-proof-row><x-proof-row id="b"><input value="Beta"></x-proof-row></main>', page => page.evaluate(() => {
    const log = []; let constructors = 0;
    customElements.define('x-proof-row', class extends HTMLElement {
      constructor() { super(); constructors++; }
      connectedCallback() { log.push(`connect:${this.id}`); }
      disconnectedCallback() { log.push(`disconnect:${this.id}`); }
      connectedMoveCallback() { log.push(`move:${this.id}`); }
    });
    const root = document.getElementById('root'), a = document.getElementById('a'), b = document.getElementById('b'), input = b.firstChild;
    input.focus(); input.setSelectionRange(1, 2); log.length = 0;
    root.insertBefore(b, a);
    return { sameNode: root.firstChild === b, sameInput: b.firstChild === input,
      focusRetained: document.activeElement === input, selection: [input.selectionStart, input.selectionEnd], log, constructors };
  }));
  expect(r.sameNode && r.sameInput).toBe(true); expect(r.focusRetained).toBe(false);
  expect(r.log).toEqual(['disconnect:b', 'connect:b']); expect(r.constructors).toBe(2);
});

it('optional moveBefore retains focus but does not preserve this Chromium selection', async () => {
  const r = await h.observe('optional moveBefore host adapter', '<main id="root"><x-proof-row id="a"><input value="Alpha"></x-proof-row><x-proof-row id="b"><input value="Beta"></x-proof-row></main>', page => page.evaluate(() => {
    const root = document.getElementById('root');
    if (typeof root.moveBefore !== 'function') return { available: false };
    const log = [];
    customElements.define('x-proof-row', class extends HTMLElement {
      connectedCallback() { log.push(`connect:${this.id}`); }
      disconnectedCallback() { log.push(`disconnect:${this.id}`); }
      connectedMoveCallback() { log.push(`move:${this.id}`); }
    });
    const a = document.getElementById('a'), b = document.getElementById('b'), input = b.firstChild;
    input.focus(); input.setSelectionRange(1, 2); log.length = 0;
    const beforeSelection = [input.selectionStart, input.selectionEnd];
    root.moveBefore(b, a);
    return { available: true, sameNode: root.firstChild === b, focusRetained: document.activeElement === input,
      beforeSelection, selection: [input.selectionStart, input.selectionEnd], log };
  }));
  if (r.available) {
    expect(r.focusRetained).toBe(true); expect(r.sameNode).toBe(true); expect(r.beforeSelection).toEqual([1, 2]);
    expect(r.selection).toEqual([0, 0]); expect(r.log).toEqual(['move:b']);
  } else expect(r).toEqual({ available: false });
});

it('naive initial property refresh destroys the preboot edit', async () => {
  const r = await h.observe('naive property overwrite', inputHTML, async page => {
    await page.locator('#a').fill('あ');
    return page.evaluate(() => {
      const input = document.getElementById('a'), before = input.value;
      const model = Proof.signal('a'); input.value = model.value;
      return { before, after: input.value };
    });
  });
  expect(r).toEqual({ before: 'あ', after: 'a' });
});

it('real reset click runs a listener microtask before default reset and before later cancellation', async () => {
  const r = await h.observe('trusted reset microtask counterexample', inputHTML, async page => {
    await page.locator('#a').fill('dirty');
    await page.evaluate(() => {
      window.resetMicrotasks = [];
      const form = document.getElementById('form'), input = document.getElementById('a');
      form.addEventListener('reset', event => queueMicrotask(() => {
        resetMicrotasks.push({ value: input.value, prevented: event.defaultPrevented, trusted: event.isTrusted });
      }), true);
    });
    await page.locator('button').click();
    const normal = await page.evaluate(() => ({ value: document.getElementById('a').value, observed: resetMicrotasks.at(-1) }));
    await page.locator('#a').fill('keep');
    await page.evaluate(() => document.getElementById('form').addEventListener('reset', event => event.preventDefault(), { once: true }));
    await page.locator('button').click();
    const canceled = await page.evaluate(() => ({ value: document.getElementById('a').value, observed: resetMicrotasks.at(-1) }));
    return { normal, canceled };
  });
  expect(r.normal).toEqual({ value: 'a', observed: { value: 'dirty', prevented: false, trusted: true } });
  expect(r.canceled).toEqual({ value: 'keep', observed: { value: 'keep', prevented: false, trusted: true } });
});

it('non-idempotent formatting at compositionend can reformat again on a following synthetic input', async () => {
  const r = await h.observe('composition final-event gap', inputHTML, page => page.evaluate(() => {
    const input = document.getElementById('a'); input.value = 'あ';
    const owner = Proof.controlledGroup(Proof.groupFixture(), Proof.groupRegistry(value => `[${value}]`));
    input.dispatchEvent(new CompositionEvent('compositionend', { data: 'あ' }));
    const atEnd = input.value;
    input.dispatchEvent(new InputEvent('input', { isComposing: false, data: 'あ', inputType: 'insertFromComposition' }));
    return { atEnd, afterFinal: input.value, model: owner.model.peek(), nativeIME: false };
  }));
  expect(r).toEqual({ atEnd: '[あ]', afterFinal: '[[あ]]', model: '[あ]', nativeIME: false });
});

it('two different native reset defaults need an explicit group conflict policy', async () => {
  const r = await h.observe('different defaults group reset counterexample', inputHTML, async page => {
    await page.evaluate(() => {
      const a = document.getElementById('a'), b = document.getElementById('b');
      b.defaultValue = 'b'; a.value = b.value = 'dirty';
      window.groupResetLog = []; window.groupResetOwner = Proof.controlledGroup(Proof.groupFixture(['a', 'b']), Proof.groupRegistry(value => value, groupResetLog));
      window.nativeResetValues = [];
      // The programmatic reset returns after its native default action, before our deferred sink.
      document.getElementById('form').reset(); nativeResetValues = [a.value, b.value];
    });
    await page.waitForFunction(() => groupResetOwner.trace.some(item => item.reason === 'reset-task'));
    return page.evaluate(() => ({ nativeDefaults: nativeResetValues,
      after: groupResetOwner.cells.map(cell => cell.node.value), model: groupResetOwner.model.peek(),
      reasons: groupResetLog.map(item => item.reason), conflict: groupResetOwner.conflict }));
  });
  expect(r.nativeDefaults).toEqual(['a', 'b']); expect(r.after).toEqual(['b', 'b']);
  expect(r.model).toBe('b'); expect(r.conflict).toBe(false); expect(r.reasons).toEqual(['adopt', 'reset', 'reset']);
});
