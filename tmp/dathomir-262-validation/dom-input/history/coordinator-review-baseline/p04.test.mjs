import { beforeAll, afterAll, expect, it } from 'vitest';
import { harness, listHTML } from './browser-harness.mjs';
let h;
beforeAll(async () => { h = await harness('p04'); });
afterAll(async () => { await h.close(); });

it('adopts two SSR rows without initializer, server/browser template, factory, or DOM writes', async () => {
  const r = await h.observe('SSR attachment zero replay', listHTML, page => page.evaluate(async () => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts);
    const association = p.listFixture(def), original = [...association.root.childNodes];
    const observer = new MutationObserver(() => {}); observer.observe(association.root, { subtree: true, childList: true, attributes: true, characterData: true });
    const list = p.adoptList(association, new Map([[def.defaultId, def]]), counts, {
      initialRefresh: () => [p.intent(def, 'a', 'Alpha'), p.intent(def, 'b', 'Beta')],
    });
    const afterAdmission = { ...counts };
    const writes = observer.takeRecords().length;
    await list.firstRefresh;
    return { afterAdmission, afterRefresh: { ...counts }, writes,
      sameNodes: original.every((node, i) => node === association.root.childNodes[i]),
      restored: list.inspect().rows.map(row => row.draft.peek()), state: list.inspect().state };
  }));
  expect(r.afterAdmission).toEqual({ factory: 0, initialize: 0, template: 0, serverTemplate: 0, stop: 0 });
  expect(r.afterRefresh).toEqual(r.afterAdmission);
  expect(r.writes).toBe(0); expect(r.sameNodes).toBe(true);
  expect(r.restored).toEqual(['Alpha', 'Beta']); expect(r.state).toBe('active');
});

it('counts a genuinely new first-refresh key only after successful SSR admission', async () => {
  const r = await h.observe('first active refresh creates c', listHTML, page => page.evaluate(async () => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), association = p.listFixture(def);
    const list = p.adoptList(association, new Map([[def.defaultId, def]]), counts, {
      initialRefresh: () => ['a', 'b', 'c'].map(key => p.intent(def, key)),
    });
    const atCommit = { ...counts };
    await list.firstRefresh;
    return { atCommit, afterRefresh: { ...counts }, keys: list.inspect().rows.map(row => row._key) };
  }));
  expect(r.atCommit.initialize).toBe(0); expect(r.atCommit.template).toBe(0);
  expect(r.afterRefresh.factory).toBe(1); expect(r.afterRefresh.initialize).toBe(1); expect(r.afterRefresh.template).toBe(1);
  expect(r.keys).toEqual(['a', 'b', 'c']);
});

it('retains edited draft and both fragment nodes on reorder; remove/re-add creates fresh lifetime', async () => {
  const r = await h.observe('edit reorder remove readd', listHTML, async page => {
    await page.evaluate(() => {
      const p = Proof, counts = p.counts(), def = p.definition('row', counts), a = p.listFixture(def);
      window.case04 = { p, counts, def, a, list: p.adoptList(a, new Map([[def.defaultId, def]]), counts) };
    });
    await page.locator('#list input').first().fill('編集中');
    return page.evaluate(() => {
      const { p, counts, def, a, list } = case04;
      const old = list.inspect().rows[0], sibling = list.inspect().rows[1];
      list.publish([p.intent(def, 'b'), p.intent(def, 'a')]);
      const reorder = { sameControl: list.inspect().rows[1].control === old.control,
        sameLabel: list.inspect().rows[1].label === old.label, sameToken: list.inspect().rows[1].token === old.token,
        draft: old.draft.peek(), native: old.control.value, label: old.label.textContent,
        keys: list.inspect().rows.map(row => row._key) };
      list.publish([p.intent(def, 'b')]);
      const afterRemove = { ...counts };
      old.control.value = 'stale'; old.control.dispatchEvent(new InputEvent('input'));
      const oldDraftAfterLateEvent = old.draft.peek();
      list.publish([p.intent(def, 'b'), p.intent(def, 'a', 'Fresh')]);
      const fresh = list.inspect().rows[1];
      return { reorder, afterRemove, afterReadd: { ...counts }, oldDraftAfterLateEvent,
        freshToken: fresh.token !== old.token, freshControl: fresh.control !== old.control,
        freshDraft: fresh.draft.peek(), siblingAlive: sibling.token.active,
        nodes: [...a.root.children].map(node => node.localName) };
    });
  });
  expect(r.reorder).toEqual({ sameControl: true, sameLabel: true, sameToken: true, draft: '編集中', native: '編集中', label: '編集中', keys: ['b', 'a'] });
  expect(r.afterRemove.stop).toBe(1); expect(r.afterReadd.initialize).toBe(1); expect(r.afterReadd.template).toBe(1);
  expect(r.afterReadd.stop).toBe(1); expect(r.oldDraftAfterLateEvent).toBe('編集中');
  expect(r.freshToken && r.freshControl && r.siblingAlive).toBe(true); expect(r.freshDraft).toBe('Fresh');
  expect(r.nodes).toEqual(['input', 'span', 'input', 'span']);
});

it('retains bind markers through text -> two DOM nodes -> empty -> text', async () => {
  const r = await h.observe('dynamic marker', listHTML, page => page.evaluate(() => {
    const status = document.getElementById('status'); const [start, text, end] = status.childNodes;
    const bind = Proof.contentMarker(start, end);
    bind.publish('Count = 7'); const sameText = status.childNodes[1] === text;
    bind.publish([{ tag: 'strong', text: 'Rich' }, { tag: 'em', text: 'Second' }]);
    const dom = [...status.children].map(node => node.localName);
    bind.publish(null); const empty = status.childNodes.length;
    bind.publish('Back');
    return { sameText, dom, empty, sameMarkers: status.firstChild === start && status.lastChild === end, text: status.textContent };
  }));
  expect(r).toEqual({ sameText: true, dom: ['strong', 'em'], empty: 2, sameMarkers: true, text: 'Back' });
});

it('rejects duplicate keys before factory and keeps exact committed nodes', async () => {
  const r = await h.observe('duplicate prepublication error', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), a = p.listFixture(def);
    const list = p.adoptList(a, new Map([[def.defaultId, def]]), counts), original = [...a.root.childNodes];
    let error; try { list.publish([p.intent(def, 'c'), p.intent(def, 'c')]); } catch (e) { error = e.message; }
    return { error, counts, same: original.every((node, i) => a.root.childNodes[i] === node) };
  }));
  expect(r.error).toMatch(/^DUPLICATE_KEY/); expect(r.counts.factory).toBe(0); expect(r.same).toBe(true);
});

it('keeps numeric 1 and string 1 distinct within one sibling extent', async () => {
  const r = await h.observe('typed keys', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), a = p.listFixture(def);
    const list = p.adoptList(a, new Map([[def.defaultId, def]]), counts);
    list.publish([p.intent(def, 1, 'numeric'), p.intent(def, '1', 'string')]);
    return { keys: list.inspect().rows.map(row => p.keyId(row._key)), drafts: list.inspect().rows.map(row => row.draft.peek()), counts };
  }));
  expect(r.keys).toEqual(['n:1', 's:1']); expect(r.drafts).toEqual(['numeric', 'string']); expect(r.counts.initialize).toBe(2);
});

it.each(['profileId', 'defaultId', 'parserId'])('rejects SSR %s mismatch before acquisition or reconstruction', async field => {
  const r = await h.observe(`admission mismatch ${field}`, listHTML, page => page.evaluate(field => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), original = p.listFixture(def);
    const a = { ...original, rows: original.rows.map((row, i) => i === 0 ? { ...row, [field]: 'wrong' } : row) };
    const nodes = [...a.root.childNodes]; let error;
    try { p.adoptList(a, new Map([[def.defaultId, def]]), counts); } catch (e) { error = e.message; }
    return { error, counts, same: nodes.every((node, i) => a.root.childNodes[i] === node) };
  }, field));
  expect(r.error).toMatch(/^ADMISSION_PROFILE_MISMATCH/); expect(r.counts.initialize).toBe(0); expect(r.counts.stop).toBe(0); expect(r.same).toBe(true);
});

it.each(['tag', 'namespace', 'default'])('explicit active %s replacement ends the old lifetime', async variant => {
  const r = await h.observe(`active replacement ${variant}`, listHTML, page => page.evaluate(variant => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts);
    const options = variant === 'tag' ? { tag: 'textarea' } : variant === 'namespace' ? { tag: 'input', ns: 'http://www.w3.org/2000/svg' } : {};
    const next = p.definition('next', counts, options), a = p.listFixture(def);
    const list = p.adoptList(a, new Map([[def.defaultId, def], [next.defaultId, next]]), counts), old = list.inspect().rows[0];
    list.publish([p.intent(next, 'a', 'Replacement'), p.intent(def, 'b')]);
    const fresh = list.inspect().rows[0];
    return { oldActive: old.token.active, fresh: fresh.token !== old.token, counts, tag: fresh.control.localName, ns: fresh.control.namespaceURI };
  }, variant));
  expect(r.oldActive).toBe(false); expect(r.fresh).toBe(true); expect(r.counts.stop).toBe(1); expect(r.counts.initialize).toBe(1); expect(r.counts.template).toBe(1);
});

it('failed new-child preparation stops only its provisional lifetime while independent sibling updates remain', async () => {
  const r = await h.observe('independent child outside failed parent plan', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), broken = p.definition('broken', counts, { throwTemplate: true });
    const a = p.listFixture(def), list = p.adoptList(a, new Map([[def.defaultId, def], [broken.defaultId, broken]]), counts);
    const old = list.inspect().rows[0], sibling = list.inspect().rows[1], nodes = [...a.root.childNodes];
    sibling.draft.set('Independent before'); let error;
    try { list.publish([p.intent(def, 'a'), p.intent(def, 'b'), p.intent(broken, 'c')]); } catch (e) { error = e.message; }
    sibling.draft.set('Independent after');
    return { error, counts, active: [old.token.active, sibling.token.active],
      sameNodes: nodes.every((node, i) => a.root.childNodes[i] === node), label: sibling.label.textContent, draft: sibling.draft.peek() };
  }));
  expect(r.error).toMatch(/^TEMPLATE_FAILURE/); expect(r.counts.stop).toBe(1);
  expect(r.active).toEqual([true, true]); expect(r.sameNodes).toBe(true); expect(r.label).toBe('Independent after');
});

it('failed parent publication does not undo an independent child write during its preparation', async () => {
  const r = await h.observe('no blanket model rollback', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), a = p.listFixture(def);
    const list = p.adoptList(a, new Map([[def.defaultId, def]]), counts), child = list.inspect().rows[1];
    let error; try { list.publish(['a', 'b', 'c'].map(key => p.intent(def, key)), { beforePublish() {
      child.draft.set('Independent during'); throw new Error('parent prepare failed');
    } }); } catch (e) { error = e.message; }
    return { error, counts, active: child.token.active, label: child.label.textContent, keys: list.inspect().rows.map(row => row._key) };
  }));
  expect(r.error).toBe('parent prepare failed'); expect(r.active).toBe(true); expect(r.label).toBe('Independent during'); expect(r.keys).toEqual(['a', 'b']); expect(r.counts.stop).toBe(1);
});

it('fences foreign nodes instead of inferring or adopting their ownership', async () => {
  const r = await h.observe('foreign node containment', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), a = p.listFixture(def);
    const list = p.adoptList(a, new Map([[def.defaultId, def]]), counts), foreign = document.getElementById('foreign');
    a.root.insertBefore(foreign, a.end); let error;
    try { list.publish([p.intent(def, 'b'), p.intent(def, 'a')]); } catch (e) { error = e.message; }
    return { error, text: foreign.textContent, counts, stillPresent: foreign.parentNode === a.root };
  }));
  expect(r.error).toMatch(/^FOREIGN_NODE/); expect(r.text).toBe('Foreign'); expect(r.stillPresent).toBe(true); expect(r.counts.stop).toBe(0);
});

it('failed enclosing parent admission cleans only parent acquisitions while its explicitly contained active child continues', async () => {
  const r = await h.observe('independent child during enclosing parent admission', `<section id="parent"><button id="parent-action">Parent</button>${listHTML}</section>`, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), association = p.listFixture(def);
    const childOwner = p.adoptList(association, new Map([[def.defaultId, def]]), counts);
    const child = childOwner.inspect().rows[0], parent = document.getElementById('parent');
    // This fixture-issued containment grant conveys an outer extent, not private child slots.
    const grant = Object.freeze({ outer: association.root, owner: childOwner });
    if (!parent.contains(grant.outer)) throw new Error('CONTAINMENT_INVALID');
    const button = document.getElementById('parent-action'); let parentCalls = 0, parentStops = 0, failure;
    try {
      p.createRoot(dispose => {
        const listener = () => parentCalls++;
        button.addEventListener('click', listener);
        p.onCleanup(() => { button.removeEventListener('click', listener); parentStops++; });
        try {
          child.draft.set('Independent during admission');
          throw new Error('parent required resource failed');
        } catch (error) { dispose(); throw error; }
      });
    } catch (error) { failure = error.message; }
    const atFailure = child.label.textContent;
    button.click();
    child.control.value = 'Independent after admission';
    child.control.dispatchEvent(new InputEvent('input'));
    const after = { childActive: child.token.active, label: child.label.textContent, draft: child.draft.peek(), childStops: counts.stop };
    // Explicit removal is a different operation from failed parent admission.
    grant.outer.remove(); grant.owner.dispose(); grant.owner.dispose();
    return { failure, atFailure, parentCalls, parentStops, after, afterExplicitRemoval: counts.stop };
  }));
  expect(r.failure).toBe('parent required resource failed'); expect(r.atFailure).toBe('Independent during admission');
  expect(r.parentCalls).toBe(0); expect(r.parentStops).toBe(1);
  expect(r.after).toEqual({ childActive: true, label: 'Independent after admission', draft: 'Independent after admission', childStops: 0 });
  expect(r.afterExplicitRemoval).toBe(2);
});

it.each(['overlap', 'foreign'])('rejects initial %s containment before any child acquisition', async variant => {
  const r = await h.observe(`initial containment ${variant}`, listHTML, page => page.evaluate(variant => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), original = p.listFixture(def);
    const association = variant === 'overlap' ? { ...original, rows: [original.rows[0], { ...original.rows[0], _key: 'b' }] } : original;
    if (variant === 'foreign') original.root.insertBefore(document.getElementById('foreign'), original.end);
    const nodes = [...original.root.childNodes]; let error;
    try { p.adoptList(association, new Map([[def.defaultId, def]]), counts); } catch (e) { error = e.message; }
    return { error, counts, sameNodes: nodes.every((node, index) => original.root.childNodes[index] === node) };
  }, variant));
  expect(r.error).toMatch(variant === 'overlap' ? /^CONTAINMENT_OVERLAP/ : /^FOREIGN_NODE/);
  expect(r.counts).toEqual({ factory: 0, initialize: 0, template: 0, serverTemplate: 0, stop: 0 });
  expect(r.sameNodes).toBe(true);
});

it('profile preflight rejection permits a corrected catalog without consuming acquisition', async () => {
  const r = await h.observe('profile rejection nonterminal', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), association = p.listFixture(def);
    const catalog = new Map([[def.defaultId, { ...def, profileId: 'different-profile' }]]); let error;
    try { p.adoptList(association, catalog, counts); } catch (e) { error = e.message; }
    const afterReject = { ...counts }; catalog.set(def.defaultId, def);
    const owner = p.adoptList(association, catalog, counts);
    return { error, afterReject, counts, state: owner.inspect().state };
  }));
  expect(r.error).toMatch(/^ADMISSION_PROFILE_MISMATCH/);
  expect(r.afterReject).toEqual({ factory: 0, initialize: 0, template: 0, serverTemplate: 0, stop: 0 });
  expect(r.counts).toEqual(r.afterReject); expect(r.state).toBe('active');
});

it('required admission failure disposes restored acquisitions once and forbids replay of that association', async () => {
  const r = await h.observe('required acquisition terminal', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), association = p.listFixture(def);
    const catalog = new Map([[def.defaultId, def]]), nodes = [...association.root.childNodes]; let failure, retry, staged;
    try { p.adoptList(association, catalog, counts, { afterAcquire(rows) { staged = [...rows]; }, failCommit: true }); } catch (e) { failure = e.message; }
    const atFailure = { ...counts };
    staged[0].control.value = 'late'; staged[0].control.dispatchEvent(new InputEvent('input'));
    try { p.adoptList(association, catalog, counts); } catch (e) { retry = e.message; }
    return { failure, retry, atFailure, counts, oldDraft: staged[0].draft.peek(),
      active: staged.map(row => row.token.active), sameNodes: nodes.every((node, i) => association.root.childNodes[i] === node) };
  }));
  expect(r.failure).toMatch(/^REQUIRED_COMMIT_FAILURE/); expect(r.retry).toMatch(/^ADMISSION_TERMINAL/);
  expect(r.atFailure.stop).toBe(2); expect(r.counts).toEqual(r.atFailure); expect(r.active).toEqual([false, false]);
  expect(r.oldDraft).toBe('Alpha'); expect(r.sameNodes).toBe(true);
});

it('duplicate active association shares one owner and disposed association cannot acquire again', async () => {
  const r = await h.observe('one keyed owner per association object', listHTML, page => page.evaluate(() => {
    const p = Proof, counts = p.counts(), def = p.definition('row', counts), association = p.listFixture(def), catalog = new Map([[def.defaultId, def]]);
    const first = p.adoptList(association, catalog, counts), second = p.adoptList(association, catalog, counts);
    first.dispose(); second.dispose(); let retry;
    try { p.adoptList(association, catalog, counts); } catch (e) { retry = e.message; }
    return { same: first === second, counts, retry };
  }));
  expect(r.same).toBe(true); expect(r.counts.stop).toBe(2); expect(r.counts.initialize).toBe(0); expect(r.retry).toMatch(/^ADMISSION_TERMINAL/);
});
