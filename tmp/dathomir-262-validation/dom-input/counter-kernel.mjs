import { signal, effect } from "../../../packages/reactivity/src/index.ts";

const counters = new WeakMap();

/** Restore one explicit SSR counter and attach named operations to the existing nodes. */
function counterBaseline(association, registry, options = {}) {
  const prior = counters.get(association);
  if (prior?.state === "active") return prior.owner;
  if (prior) throw new Error("COUNTER_ADMISSION_TERMINAL");
  if (
    association.text.nodeType !== Node.TEXT_NODE ||
    association.text.data !== association.initialText ||
    !association.text.isConnected ||
    !association.button.isConnected ||
    !Number.isFinite(association.count)
  ) {
    throw new Error("COUNTER_PREFLIGHT_MISMATCH");
  }
  let count;
  let state = "staging";
  let candidate;
  let initialGetterError;
  let stop;
  const trace = [];
  const record = { state, owner: null };
  counters.set(association, record);
  const increment = () => {
    if (state === "active") registry.increment({ values: { count } });
  };
  function refresh() {
    if (state === "active" && association.text.data !== candidate)
      association.text.data = candidate;
  }
  try {
    count = signal(association.count);
    stop = effect(() => {
      try {
        candidate = registry.countText({ values: { count } });
      } catch (error) {
        if (state !== "staging") throw error;
        initialGetterError = error;
        return;
      }
      trace.push({ phase: state, candidate });
      refresh();
    });
    if (initialGetterError) throw initialGetterError;
    association.button.addEventListener("click", increment);
    options.beforeCommit?.();
    state = "active";
    record.state = state;
    trace.push({ phase: state, commit: true });
  } catch (error) {
    state = "failed-terminal";
    record.state = state;
    stop?.();
    association.button.removeEventListener("click", increment);
    throw error;
  }
  const owner = {
    count,
    trace,
    refresh,
    inspect: () => ({ state }),
    dispose() {
      if (state === "disposed") return;
      state = "disposed";
      record.state = state;
      stop();
      association.button.removeEventListener("click", increment);
    },
  };
  record.owner = owner;
  // Initial admission has committed; this is a separately observable active refresh.
  try {
    refresh();
    owner.initialRefresh = { ok: true };
  } catch (error) {
    owner.initialRefresh = { ok: false, error };
    trace.push({ phase: state, reason: "postcommit-refresh-failed", error: error.message });
  }
  return owner;
}

export { counterBaseline };
