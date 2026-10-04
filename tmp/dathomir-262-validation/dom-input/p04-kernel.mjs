import { signal, effect, createRoot, onCleanup } from "../../../packages/reactivity/src/index.ts";

let nextLifetime = 0;
const admissions = new WeakMap();

function fail(code, target) {
  throw new Error(`${code}: ${target}`);
}

function keyId(key) {
  if (typeof key === "string") return `s:${key}`;
  if (typeof key === "number" && Number.isFinite(key)) return `n:${key}`;
  return fail("KEY_INVALID", String(key));
}

function unique(items) {
  const seen = new Set();
  for (const item of items) {
    const key = keyId(item._key);
    if (seen.has(key)) fail("DUPLICATE_KEY", key);
    seen.add(key);
  }
}

function extentNodes(start, end) {
  if (!start.parentNode || start.parentNode !== end.parentNode) fail("EXTENT_DAMAGED", "markers");
  const nodes = [];
  for (let node = start; node; node = node.nextSibling) {
    nodes.push(node);
    if (node === end) return nodes;
  }
  return fail("EXTENT_DAMAGED", "missing end");
}

function compatible(a, b) {
  return (
    a.defaultId === b.defaultId &&
    a.profileId === b.profileId &&
    a.parserId === b.parserId &&
    a.tag === b.tag &&
    a.ns === b.ns
  );
}

/** Create one fixture definition with an explicit default/profile/parser identity. */
function definition(id, counts, options = {}) {
  return Object.freeze({
    defaultId: `module:${id}:default`,
    profileId: `module:${id}:create`,
    parserId: "neutral:parseRow:v1",
    tag: options.tag ?? "input",
    ns: options.ns ?? "http://www.w3.org/1999/xhtml",
    initialize(input) {
      counts.factory++;
      counts.initialize++;
      if (typeof input !== "string") fail("INPUT_INVALID", id);
      return input;
    },
    template(input) {
      counts.template++;
      if (options.throwTemplate) fail("TEMPLATE_FAILURE", id);
      const control = document.createElementNS(this.ns, this.tag);
      if (control instanceof HTMLInputElement) control.defaultValue = input;
      else control.textContent = input;
      const label = document.createElement("span");
      label.textContent = input;
      return { nodes: [control, label], control, label };
    },
  });
}

function acquireChild(record, counts, created = false, construct) {
  const token = { id: ++nextLifetime, active: true };
  const draft = signal(record.snapshot);
  let committed = false;
  const cleanups = [];
  const disposeRoot = createRoot((dispose) => {
    onCleanup(() => {
      counts.stop++;
    });
    if (construct) {
      try {
        record = { ...record, ...construct() };
      } catch (error) {
        token.active = false;
        dispose();
        throw error;
      }
    }
    const stop = effect(() => {
      const value = draft.value;
      if (committed && token.active) {
        record.label.textContent = value;
        if (record.control instanceof HTMLInputElement && record.control.value !== value) {
          record.control.value = value;
        }
      }
    });
    onCleanup(stop);
    const edit = () => {
      if (token.active && committed) draft.set(record.control.value);
    };
    record.control.addEventListener("input", edit);
    onCleanup(() => record.control.removeEventListener("input", edit));
  });
  cleanups.push(disposeRoot);
  return {
    ...record,
    token,
    draft,
    created,
    activate() {
      committed = true;
    },
    dispose() {
      if (!token.active) return;
      token.active = false;
      for (const stop of cleanups.reverse()) stop();
    },
  };
}

/** Adopt explicit existing SSR extents without invoking any creation callbacks. */
function adoptList(association, catalog, counts, options = {}) {
  const prior = admissions.get(association);
  if (prior?.state === "active") return prior.owner;
  if (prior) fail("ADMISSION_TERMINAL", association.id);
  unique(association.rows);
  if (
    association.root !== association.start.parentNode ||
    association.root !== association.end.parentNode
  ) {
    fail("ROOT_MISMATCH", association.id);
  }
  const outer = extentNodes(association.start, association.end);
  const declared = new Set([association.start, association.end]);
  for (const record of association.rows) {
    const actual = catalog.get(record.defaultId);
    if (!actual || !compatible(record, actual))
      fail("ADMISSION_PROFILE_MISMATCH", keyId(record._key));
    const nodes = extentNodes(record.start, record.end);
    if (
      nodes.some((node) => !outer.includes(node)) ||
      !nodes.includes(record.control) ||
      !nodes.includes(record.label)
    ) {
      fail("CONTAINMENT_INVALID", keyId(record._key));
    }
    for (const node of nodes) {
      if (declared.has(node)) fail("CONTAINMENT_OVERLAP", keyId(record._key));
      declared.add(node);
    }
    if (record.control.localName !== record.tag || record.control.namespaceURI !== record.ns) {
      fail("TARGET_MISMATCH", keyId(record._key));
    }
    if (typeof record.snapshot !== "string") fail("SNAPSHOT_INVALID", keyId(record._key));
  }
  if (outer.some((node) => !declared.has(node))) fail("FOREIGN_NODE", association.id);
  const writes = options.ownedWrites ?? [];
  for (const write of writes) {
    if (
      !(write.target instanceof Text) ||
      typeof write.value !== "string" ||
      !association.rows.some((record) => record.label.firstChild === write.target)
    ) {
      fail("OWNED_TEXT_TARGET_INVALID", association.id);
    }
  }
  let rows = [];
  let state = "staging";
  const inverses = [];
  const admission = { state, owner: null };
  admissions.set(association, admission);
  try {
    for (const record of association.rows) rows.push(acquireChild(record, counts));
    options.afterAcquire?.(rows);
    if (options.failCommit) fail("REQUIRED_COMMIT_FAILURE", association.id);
    for (const write of writes) {
      // Record before invoking a setter that may mutate and then throw.
      inverses.push({ target: write.target, value: write.target.data });
      write.target.data = write.value;
    }
    for (const child of rows) child.activate();
    state = "active";
    admission.state = state;
  } catch (error) {
    for (const child of rows.reverse()) child.dispose();
    state = "failed-terminal";
    admission.state = state;
    const restorationErrors = [];
    for (const inverse of inverses.reverse()) {
      try {
        inverse.target.data = inverse.value;
      } catch (restorationError) {
        restorationErrors.push(restorationError);
      }
    }
    if (restorationErrors.length)
      throw new AggregateError([error, ...restorationErrors], "OWNED_TEXT_RESTORATION_FAILED");
    throw error;
  }

  function publish(intents, hooks = {}) {
    if (state !== "active") fail("NOT_ACTIVE", association.id);
    unique(intents);
    const outerNow = extentNodes(association.start, association.end);
    const owned = new Set([association.start, association.end]);
    for (const child of rows) {
      for (const node of extentNodes(child.start, child.end)) owned.add(node);
    }
    if (outerNow.some((node) => !owned.has(node))) fail("FOREIGN_NODE", association.id);
    const staged = [];
    const next = [];
    try {
      for (const intent of intents) {
        const actual = catalog.get(intent.defaultId);
        if (!actual || !compatible(intent, actual))
          fail("CATALOG_PROFILE_MISMATCH", keyId(intent._key));
        const existing = rows.find((row) => keyId(row._key) === keyId(intent._key));
        if (existing && compatible(existing, intent)) {
          next.push(existing);
          continue;
        }
        const input = actual.initialize(intent.input);
        const start = document.createComment("row:start");
        const end = document.createComment("row:end");
        const holder = document.createElement("div");
        // The new child owns cleanup before template acquisition can throw.
        const ready = acquireChild({ ...intent, snapshot: input, start, end }, counts, true, () => {
          const view = actual.template(input);
          holder.append(start, ...view.nodes, end);
          return view;
        });
        staged.push(ready);
        next.push(ready);
      }
      hooks.beforePublish?.();
    } catch (error) {
      for (const child of staged.reverse()) child.dispose();
      throw error;
    }
    // Only explicitly recorded outer extents are moved or removed.
    for (const child of rows) {
      if (next.includes(child)) continue;
      child.dispose();
      for (const node of extentNodes(child.start, child.end)) node.remove();
    }
    let anchor = association.end;
    for (const child of [...next].reverse()) {
      const nodes = extentNodes(child.start, child.end);
      if (child.end.nextSibling !== anchor) {
        for (const node of nodes) association.root.insertBefore(node, anchor);
      }
      anchor = child.start;
      child.activate();
    }
    rows = next;
  }

  const owner = {
    publish,
    inspect: () => ({ state, rows: [...rows] }),
    // This is test instrumentation, not a proposed public child handle.
    dispose() {
      if (state !== "active") return;
      state = "disposed";
      admission.state = state;
      for (const child of rows) child.dispose();
    },
    automaticRefresh(producer) {
      return Promise.resolve().then(() => publish(producer()));
    },
  };
  admission.owner = owner;
  owner.firstRefresh = options.initialRefresh
    ? owner.automaticRefresh(options.initialRefresh)
    : Promise.resolve();
  return owner;
}

/** Adopt one persistent content marker and publish text, empty, or DOM descriptions. */
function contentMarker(start, end) {
  let nodes = extentNodes(start, end).slice(1, -1);
  return {
    publish(value) {
      let next;
      if (typeof value === "string") {
        if (nodes.length === 1 && nodes[0].nodeType === Node.TEXT_NODE) {
          if (nodes[0].data !== value) nodes[0].data = value;
          return;
        }
        next = [document.createTextNode(value)];
      } else if (value === null) next = [];
      else if (Array.isArray(value)) {
        next = value.map((item) => {
          if (!item || typeof item.tag !== "string" || typeof item.text !== "string")
            fail("CONTENT_INVALID", "bind");
          const node = document.createElement(item.tag);
          node.textContent = item.text;
          return node;
        });
      } else fail("CONTENT_INVALID", "bind");
      for (const node of nodes) node.remove();
      for (const node of next) end.parentNode.insertBefore(node, end);
      nodes = next;
    },
  };
}

export { adoptList, definition, contentMarker, keyId, extentNodes };
