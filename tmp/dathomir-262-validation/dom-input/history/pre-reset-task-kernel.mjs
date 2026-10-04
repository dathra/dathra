import { signal, effect, batch } from '../../../packages/reactivity/src/index.ts';

const admitted = new WeakMap();

function fail(code, target) { throw new Error(`${code}: ${target}`); }

/** Stage an explicit text-input group, adopt its native drafts, and refresh after commit. */
function controlledGroup(association, registry, options = {}) {
  const prior = admitted.get(association);
  if (prior?.state === 'active') return prior;
  if (prior) fail('ADMISSION_TERMINAL', association.id);
  if (typeof registry[association.sink] !== 'function') fail('SINK_MISSING', association.sink);
  if (typeof registry[association.getter] !== 'function') fail('GETTER_MISSING', association.getter);
  for (const item of association.controls) {
    if (!(item.node instanceof HTMLInputElement) || item.node.type !== 'text' || !item.node.isConnected) {
      fail('CONTROL_MISMATCH', item.ref);
    }
  }
  const trace = [];
  const resources = [];
  const cells = association.controls.map(item => ({
    ...item, revision: 0, composition: 'unknown', writes: 0,
  }));
  const model = signal(association.snapshot);
  const wake = signal(0);
  const owner = { state: 'staging', conflict: false, pending: null, trace, cells, model, refresh, dispose };
  admitted.set(association, owner);
  let stopEffect;
  let inSink = false;
  let resolving = false;

  function snapshot(cell, reason) {
    return Object.freeze({
      ref: cell.ref, value: cell.node.value, revision: cell.revision,
      selectionStart: cell.node.selectionStart, selectionEnd: cell.node.selectionEnd,
      composition: cell.composition, reason,
    });
  }

  function sink(cell, reason) {
    const input = snapshot(cell, reason);
    trace.push({ phase: owner.state, reason, ref: input.ref, value: input.value, revision: input.revision });
    const denied = () => fail('MODEL_ONLY_PHASE', association.sink);
    inSink = true;
    try {
      const result = registry[association.sink]({
        values: { draft: model }, input,
        request: denied, emit: denied, timeout: denied, onDispose: denied, control: denied,
      });
      if (result && typeof result.then === 'function') {
        result.catch(() => {});
        fail('ASYNC_SINK', association.sink);
      }
    } finally { inSink = false; }
  }

  function add(target, name, listener) {
    target.addEventListener(name, listener, true);
    resources.push(() => target.removeEventListener(name, listener, true));
  }

  function event(cell, reason, nativeEvent) {
    if (owner.state !== 'active' && owner.state !== 'staging') return;
    cell.revision++;
    if (reason === 'compositionstart' || nativeEvent.isComposing) cell.composition = 'composing';
    if (['compositionend', 'blur', 'change', 'reset'].includes(reason)) cell.composition = 'clear';
    if (reason === 'input' && nativeEvent instanceof InputEvent && !nativeEvent.isComposing && cell.composition !== 'composing') {
      cell.composition = 'clear';
    }
    if (owner.state === 'staging') return;
    if (reason !== 'compositionstart') {
      batch(() => {
        sink(cell, reason);
        if (owner.conflict && ['input', 'change', 'compositionend', 'reset'].includes(reason)) resolving = true;
        wake.set(previous => previous + 1);
      });
    } else wake.set(previous => previous + 1);
  }

  function readAll() { return cells.map(cell => ({ value: cell.node.value, revision: cell.revision })); }

  function applyNative() {
    const changed = cells.filter(cell => cell.node.value !== cell.server);
    const values = new Set(changed.map(cell => cell.node.value));
    if (values.size > 1) {
      owner.conflict = true;
      owner.pending = 'conflicting-native-drafts';
      return;
    }
    sink(changed[0] ?? cells[0], 'adopt');
  }

  function refresh(hook) {
    if (owner.state !== 'active' || inSink) return;
    const captures = readAll();
    const desired = registry[association.getter]({ values: { draft: model } });
    if (typeof desired !== 'string') fail('PROPERTY_RESULT_INVALID', association.getter);
    hook?.();
    const current = readAll();
    if (captures.some((old, index) => old.revision !== current[index].revision || old.value !== current[index].value)) {
      owner.pending = 'revision-gap';
      trace.push({ phase: 'active', reason: 'stale-publication-rejected' });
      return;
    }
    if (owner.conflict && !resolving) {
      if (cells.every(cell => cell.node.value === desired)) {
        owner.conflict = false; owner.pending = null;
      } else return;
    }
    let held = false;
    for (const cell of cells) {
      if (cell.node.value === desired) continue;
      if (cell.composition !== 'clear') { held = true; continue; }
      cell.node.value = desired; cell.writes++;
    }
    if (resolving && cells.every(cell => cell.node.value === desired)) {
      owner.conflict = false; resolving = false;
    }
    owner.pending = held ? 'composition-or-unknown' : owner.conflict ? 'conflicting-native-drafts' : null;
  }

  function dispose() {
    if (owner.state === 'disposed') return;
    owner.state = 'disposed';
    stopEffect?.();
    for (const stop of resources.reverse()) stop();
    resources.length = 0;
  }

  try {
    trace.push({ phase: 'preflight', reason: 'read', values: readAll() });
    options.afterPreflight?.();
    for (const cell of cells) {
      for (const name of ['input', 'change', 'compositionstart', 'compositionend', 'blur']) {
        add(cell.node, name, nativeEvent => event(cell, name, nativeEvent));
      }
    }
    const forms = new Set(cells.map(cell => cell.node.form).filter(Boolean));
    for (const form of forms) add(form, 'reset', nativeEvent => {
      // Native reset changes properties after dispatch; canceled reset must stay unchanged.
      queueMicrotask(() => {
        if (nativeEvent.defaultPrevented || owner.state !== 'active') return;
        for (const cell of cells.filter(item => item.node.form === form)) event(cell, 'reset', nativeEvent);
      });
    });
    options.afterListeners?.();
    let stable = false;
    for (let attempt = 0; attempt < 3; attempt++) {
      const before = readAll();
      applyNative();
      options.beforeCommit?.(attempt);
      const after = readAll();
      if (before.every((old, index) => old.value === after[index].value && old.revision === after[index].revision)) {
        stable = true; break;
      }
    }
    if (!stable) fail('UNSTABLE_NATIVE_REVISION', association.id);
    if (options.failCommit) fail('REQUIRED_COMMIT_FAILURE', association.id);
    owner.state = 'active';
    trace.push({ phase: 'active', reason: 'commit' });
    stopEffect = effect(() => { void wake.value; refresh(); });
    return owner;
  } catch (error) {
    stopEffect?.();
    for (const stop of resources.reverse()) stop();
    resources.length = 0;
    owner.state = 'failed-terminal';
    throw error;
  }
}

/** A native-owned text draft leaves keystrokes in the DOM until an explicit read. */
function nativeDraft(control) {
  return { read: () => control.value, baseline: () => control.defaultValue };
}

export { controlledGroup, nativeDraft };
