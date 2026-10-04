/** Minimal runtime invocation projection; the registry's names are never filtered. */
import { OwnedOwner } from "./owned.ts";
import type { Facade } from "./owned.ts";

type Capability = (...arguments_: unknown[]) => unknown;
interface Context {
  values: Readonly<Record<string, Facade>>;
  request: Capability;
  emit: Capability;
  timeout: Capability;
  control: Capability;
}

/** Deny operation capability acquisition itself during binding evaluation. */
function context(owner: OwnedOwner, values: Record<string, Facade>, phase: "binding" | "operation", capabilities: Omit<Context, "values">): Context {
  const projected: Record<string, Facade> = {};
  for (const [name, slot] of Object.entries(values)) projected[name] = owner.project(slot, phase);
  function capability(name: keyof Omit<Context, "values">): Capability {
    if (phase !== "operation") throw new Error(`phase-capability:binding:${name}`);
    return capabilities[name];
  }
  return Object.freeze({
    values: Object.freeze(projected),
    get request() { return capability("request"); },
    get emit() { return capability("emit"); },
    get timeout() { return capability("timeout"); },
    get control() { return capability("control"); },
  });
}

export { context };
export type { Context };
