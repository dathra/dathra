/** Experimental finite-data codec and trusted structural capture profile. */
type Atom = null | boolean | string | number;
type Ref = { atom: Atom } | { negativeZero: true } | { node: number };
type DataNode =
  | { kind: "record"; nullPrototype: boolean; fields: [string, Ref][] }
  | { kind: "array"; items: Ref[] };
type SlotNode = { kind: "slot"; payload: Graph };
interface Graph {
  root: Ref;
  nodes: (DataNode | SlotNode)[];
}

function objectValue(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function recordValue(value: unknown): value is Record<string, unknown> {
  return objectValue(value) && !Array.isArray(value);
}

function error(path: string, code: string): never {
  throw new Error(`${code} at ${path}`);
}

/** Resolve the first descriptor without evaluating property accessors. */
function descriptor(value: object, name: string, path: string): PropertyDescriptor | undefined {
  let current: object | null = value;
  const visited = new Set<object>();
  for (let budget = 0; current !== null; budget++) {
    if (budget >= 64 || visited.has(current)) error(path, "inspection-budget");
    visited.add(current);
    let found: PropertyDescriptor | undefined;
    try {
      found = Object.getOwnPropertyDescriptor(current, name);
      if (found !== undefined) return found;
      const parent: unknown = Object.getPrototypeOf(current);
      if (parent !== null && !objectValue(parent)) error(path, "invalid-prototype");
      current = parent;
    } catch (cause) {
      error(
        path,
        `descriptor-inspection:${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }
  return undefined;
}

/** Return a trusted peek callable only for the explicit structural profile. */
function structuralPeek(value: unknown, path = "$return"): ((this: object) => unknown) | undefined {
  if (!objectValue(value)) return undefined;
  const tag = descriptor(value, "__type__", path);
  const tagValue: unknown = tag?.value;
  if (tag === undefined || !("value" in tag) || tagValue !== "signal") return undefined;
  const set = descriptor(value, "set", path);
  const peek = descriptor(value, "peek", path);
  const setValue: unknown = set?.value;
  const peekValue: unknown = peek?.value;
  if (set === undefined || !("value" in set) || typeof setValue !== "function") return undefined;
  if (peek === undefined || !("value" in peek) || typeof peekValue !== "function") return undefined;
  if (descriptor(value, "value", path) === undefined) return undefined;
  return function () {
    return peekValue.call(this);
  };
}

/** Build an isolated graph with canonical field order and explicit alias edges. */
function graph(
  value: unknown,
  slot?: (source: object, peek: (this: object) => unknown, path: string) => SlotNode,
  visit?: (source: object, id: number) => void,
): Graph {
  const nodes: (DataNode | SlotNode)[] = [];
  const seen = new Map<object, number>();
  const ancestors = new Set<object>();
  let remaining = 10000;
  function walk(input: unknown, path: string): Ref {
    if (--remaining < 0) error(path, "data-budget");
    if (input === null || typeof input === "string" || typeof input === "boolean")
      return { atom: input };
    if (typeof input === "number") {
      if (!Number.isFinite(input)) error(path, "nonfinite-number");
      return Object.is(input, -0) ? { negativeZero: true } : { atom: input };
    }
    if (!objectValue(input)) error(path, "non-data-value");
    if (ancestors.has(input)) error(path, "cycle");
    const prior = seen.get(input);
    if (prior !== undefined) return { node: prior };
    const id = nodes.length;
    seen.set(input, id);
    visit?.(input, id);
    nodes.push({ kind: "array", items: [] });
    ancestors.add(input);
    const peek = slot === undefined ? undefined : structuralPeek(input, path);
    if (peek !== undefined && slot !== undefined) {
      nodes[id] = slot(input, peek, path);
    } else if (Array.isArray(input)) {
      const keys = Reflect.ownKeys(input);
      if (
        keys.some(
          (key) =>
            key !== "length" &&
            !(typeof key === "string" && /^(0|[1-9]\d*)$/.test(key) && Number(key) < input.length),
        )
      )
        error(path, "array-extra-property");
      const items: Ref[] = [];
      for (let i = 0; i < input.length; i++) {
        const d = Object.getOwnPropertyDescriptor(input, String(i));
        if (d === undefined) error(`${path}[${i}]`, "sparse-array");
        if (!("value" in d)) error(`${path}[${i}]`, "accessor");
        const item: unknown = d.value;
        items.push(walk(item, `${path}[${i}]`));
      }
      nodes[id] = { kind: "array", items };
    } else {
      const prototype: unknown = Object.getPrototypeOf(input);
      if (prototype !== null && prototype !== Object.prototype)
        error(path, "nonplain-data:use-DTO-or-adapter");
      const keys = Reflect.ownKeys(input);
      if (keys.some((key) => typeof key !== "string")) error(path, "symbol-key");
      const fields: [string, Ref][] = [];
      for (const key of keys.filter((key): key is string => typeof key === "string").sort()) {
        const d = Object.getOwnPropertyDescriptor(input, key);
        if (d === undefined || !("value" in d))
          error(`${path}.${key}`, "accessor:use-DTO-or-adapter");
        if (!d.enumerable) error(`${path}.${key}`, "nonenumerable-data");
        const item: unknown = d.value;
        fields.push([key, walk(item, `${path}.${key}`)]);
      }
      nodes[id] = { kind: "record", nullPrototype: prototype === null, fields };
    }
    ancestors.delete(input);
    return { node: id };
  }
  return { root: walk(value, "$return"), nodes };
}

/** Restore finite data only; this is not an untrusted wire decoder. */
function restore(
  snapshot: Graph,
  restoreSlot?: (payload: Graph, id: number) => unknown,
  reuse?: ReadonlyMap<number, object>,
): unknown {
  const made = new Map<number, unknown>();
  function read(ref: Ref): unknown {
    if ("atom" in ref) return ref.atom;
    if ("negativeZero" in ref) return -0;
    if (made.has(ref.node)) return made.get(ref.node);
    const alreadyOwned = reuse?.get(ref.node);
    if (alreadyOwned !== undefined) {
      made.set(ref.node, alreadyOwned);
      return alreadyOwned;
    }
    const node = snapshot.nodes[ref.node];
    if (node === undefined) error("$wire", "missing-node");
    if (node.kind === "slot") {
      if (restoreSlot === undefined) error("$wire", "slot-not-allowed");
      const slot = restoreSlot(node.payload, ref.node);
      made.set(ref.node, slot);
      return slot;
    }
    if (node.kind === "array") {
      const items: unknown[] = [];
      made.set(ref.node, items);
      for (const item of node.items) items.push(read(item));
      return Object.freeze(items);
    }
    const result: Record<string, unknown> = node.nullPrototype ? Object.create(null) : {};
    made.set(ref.node, result);
    for (const [name, ref] of node.fields) {
      Object.defineProperty(result, name, { enumerable: true, value: read(ref) });
    }
    return Object.freeze(result);
  }
  return read(snapshot.root);
}

/** Capture each source Signal once and reject incidental cross-owner sharing. */
class CaptureUniverse {
  readonly claims = new WeakMap<object, { owner: object; path: string }>();
  capture(owner: object, value: unknown): Graph {
    return graph(value, (source, peek, path) => {
      const previous = this.claims.get(source);
      if (previous !== undefined && previous.owner !== owner)
        error(path, `cross-owner-alias:first=${previous.path}`);
      this.claims.set(source, { owner, path });
      let payload: unknown;
      try {
        payload = peek.call(source);
      } catch (cause) {
        error(path, `peek-failed:${cause instanceof Error ? cause.message : String(cause)}`);
      }
      return { kind: "slot", payload: graph(payload) };
    });
  }
}

export { CaptureUniverse, descriptor, graph, objectValue, recordValue, restore, structuralPeek };
export type { Graph };
