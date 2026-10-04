import { signal, effect } from '../../../packages/reactivity/src/index.ts';

const counters = new WeakMap();

/** Restore one explicit SSR counter and attach named operations to the existing nodes. */
function counterBaseline(association, registry, options = {}) {
  const prior = counters.get(association);
  if (prior) return prior;
  if (association.text.nodeType !== Node.TEXT_NODE || association.text.data !== association.initialText ||
      !association.text.isConnected || !association.button.isConnected || !Number.isFinite(association.count)) {
    throw new Error('COUNTER_PREFLIGHT_MISMATCH');
  }
  const count = signal(association.count);
  let state = 'staging';
  let candidate;
  const trace = [];
  const stop = effect(() => {
    candidate = registry.countText({ values: { count } });
    trace.push({ phase: state, candidate });
    if (state === 'active' && association.text.data !== candidate) association.text.data = candidate;
  });
  const increment = () => {
    if (state === 'active') registry.increment({ values: { count } });
  };
  association.button.addEventListener('click', increment);
  try {
    options.beforeCommit?.();
    state = 'active';
    trace.push({ phase: state, commit: true });
    // One automatic post-commit refresh uses the initial getter candidate.
    if (association.text.data !== candidate) association.text.data = candidate;
  } catch (error) {
    state = 'failed-terminal'; stop(); association.button.removeEventListener('click', increment); throw error;
  }
  const owner = {
    count, trace,
    dispose() {
      if (state === 'disposed') return;
      state = 'disposed'; stop(); association.button.removeEventListener('click', increment);
    },
  };
  counters.set(association, owner);
  return owner;
}

export { counterBaseline };
