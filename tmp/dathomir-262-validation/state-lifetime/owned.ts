/** Experimental owned payload projection; native engine is imported unchanged. */
import { signal } from "../../../packages/reactivity/src/index.ts";
import type { Signal } from "../../../packages/reactivity/src/types/index.ts";
import { graph, objectValue, restore } from "./graph.ts";
import type { Graph } from "./graph.ts";

interface Facade {
  readonly value: unknown;
  peek(): unknown;
  set(update: unknown): void;
  readonly __type__: "signal";
}

/** Keep one last isolated snapshot per external root and shared owned identities. */
class PayloadLedger {
  readonly #external = new WeakMap<object, { fingerprint: string; owned: unknown }>();
  readonly #owned = new WeakMap<object, number>();
  #nextOwnedId = 0;
  admit(value: unknown): unknown {
    if (objectValue(value) && this.#owned.has(value)) return value;
    const reused = new Map<number, object>();
    const ownedIdentities: [number, number][] = [];
    const snapshot = graph(value, undefined, (source, id) => {
      const identity = this.#owned.get(source);
      if (identity !== undefined) {
        reused.set(id, source);
        ownedIdentities.push([id, identity]);
      }
    });
    // Identical data with a different explicit owned child is not the same snapshot.
    const fingerprint = JSON.stringify({ snapshot, ownedIdentities });
    if (objectValue(value)) {
      const previous = this.#external.get(value);
      if (previous !== undefined && previous.fingerprint === fingerprint) return previous.owned;
    }
    const isolated = restore(snapshot, undefined, reused);
    function mark(input: unknown, seen: Set<object>): void {
      if (!objectValue(input) || seen.has(input)) return;
      seen.add(input);
      for (const d of Object.values(Object.getOwnPropertyDescriptors(input))) {
        if ("value" in d) {
          const child: unknown = d.value;
          mark(child, seen);
        }
      }
    }
    const made = new Set<object>();
    mark(isolated, made);
    for (const item of made) if (!this.#owned.has(item)) this.#owned.set(item, this.#nextOwnedId++);
    if (objectValue(value)) this.#external.set(value, { fingerprint, owned: isolated });
    return isolated;
  }
}

/** A diagnostic owner that privately keeps native cells and shares a payload ledger. */
class OwnedOwner {
  active = true;
  readonly payloads = new PayloadLedger();
  readonly #cells = new WeakMap<object, Signal<unknown>>();
  slot(initial: unknown, isCurrent: () => boolean = () => this.active): Facade {
    const cell = signal(this.payloads.admit(initial));
    return this.#facade(cell, isCurrent, "operation");
  }
  project(
    source: Facade,
    phase: "binding" | "operation",
    isCurrent: () => boolean = () => this.active,
  ): Facade {
    const cell = this.#cells.get(source);
    if (cell === undefined) throw new Error("foreign-slot-projection");
    return this.#facade(cell, isCurrent, phase);
  }
  ownsSlot(value: unknown): value is Facade {
    return objectValue(value) && this.#cells.has(value);
  }
  projection(phase: "binding" | "operation", isCurrent: () => boolean): (source: Facade) => Facade {
    const cache = new Map<Signal<unknown>, Facade>();
    return (source) => {
      const cell = this.#cells.get(source);
      if (cell === undefined) throw new Error("foreign-slot-projection");
      const prior = cache.get(cell);
      if (prior !== undefined) return prior;
      const result = this.#facade(cell, isCurrent, phase);
      cache.set(cell, result);
      return result;
    };
  }
  #facade(cell: Signal<unknown>, isCurrent: () => boolean, phase: "binding" | "operation"): Facade {
    const facade: Facade = Object.freeze({
      get value() {
        return cell.value;
      },
      peek() {
        return cell.peek();
      },
      set: (update: unknown) => {
        if (!this.active || !isCurrent()) throw new Error("stale-write");
        if (phase !== "operation") throw new Error("phase-write:binding");
        const result: unknown = typeof update === "function" ? update(cell.peek()) : update;
        const admitted = this.payloads.admit(result);
        // Author updater/getter execution can dispose or replace its invocation.
        if (!this.active || !isCurrent()) throw new Error("stale-write-after-updater");
        cell.set(admitted);
      },
      __type__: "signal",
    });
    this.#cells.set(facade, cell);
    return facade;
  }
  restore(snapshot: Graph): unknown {
    return restore(snapshot, (payload) => this.slot(restore(payload)));
  }
  dispose(): void {
    this.active = false;
  }
}

export { OwnedOwner, PayloadLedger };
export type { Facade };
