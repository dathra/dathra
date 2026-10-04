/** Minimal runtime invocation projection; the registry's names are never filtered. */
import { OwnedOwner } from "./owned.ts";
import { objectValue, recordValue } from "./graph.ts";

type Capability = (...arguments_: unknown[]) => unknown;
interface Context {
  values: Readonly<Record<string, unknown>>;
  request: Capability;
  emit: Capability;
  timeout: Capability;
  control: Capability;
}

/** Deny operation capability acquisition itself during binding evaluation. */
function context(
  owner: OwnedOwner,
  values: Record<string, unknown>,
  phase: "binding" | "operation",
  capabilities: Omit<Context, "values">,
  isCurrent: () => boolean = () => owner.active,
): Context {
  const projectSlot = owner.projection(phase, isCurrent);
  const records = new Map<object, unknown>();
  const ancestors = new Set<object>();
  function walk(value: unknown): unknown {
    if (owner.ownsSlot(value)) return projectSlot(value);
    if (!objectValue(value)) return value;
    if (ancestors.has(value)) throw new Error("context-cycle");
    if (records.has(value)) return records.get(value);
    ancestors.add(value);
    let result: unknown;
    if (Array.isArray(value)) result = Object.freeze(value.map(walk));
    else if (recordValue(value)) {
      const record: Record<string, unknown> = {};
      for (const [key, d] of Object.entries(Object.getOwnPropertyDescriptors(value))) {
        if (!("value" in d)) throw new Error("context-accessor");
        const child: unknown = d.value;
        Object.defineProperty(record, key, { value: walk(child), enumerable: d.enumerable });
      }
      result = Object.freeze(record);
    }
    ancestors.delete(value);
    records.set(value, result);
    return result;
  }
  const projected = walk(values);
  if (!recordValue(projected)) throw new Error("context-root");
  function capability(name: keyof Omit<Context, "values">): Capability {
    if (phase !== "operation") throw new Error(`phase-capability:binding:${name}`);
    return (...arguments_) => {
      if (!owner.active || !isCurrent()) throw new Error("stale-capability");
      return capabilities[name](...arguments_);
    };
  }
  return Object.freeze({
    values: Object.freeze(projected),
    get request() {
      return capability("request");
    },
    get emit() {
      return capability("emit");
    },
    get timeout() {
      return capability("timeout");
    },
    get control() {
      return capability("control");
    },
  });
}

export { context };
export type { Context };
