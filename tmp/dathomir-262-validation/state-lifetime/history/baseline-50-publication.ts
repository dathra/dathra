/** Experimental publication gate; native batch remains non-transactional. */
import { batch, effect, signal } from "../../../packages/reactivity/src/index.ts";
import { graph, restore } from "./graph.ts";

interface Plan { valid: () => boolean; commit: () => void }
class PublicationGate {
  #attempt: Map<object, Plan> | undefined;
  readonly #refresh = signal(0);
  bind<T>(prepare: () => T, publish: (value: T) => void, valid: () => boolean = () => true): () => void {
    const identity = {};
    let published = false;
    let lastValue: T;
    return effect(() => {
      this.#refresh.value;
      const prepared = prepare();
      if (!valid()) return;
      const plan = { valid, commit: () => {
        if (published && Object.is(lastValue, prepared)) return;
        publish(prepared);
        published = true;
        lastValue = prepared;
      } };
      if (this.#attempt === undefined) plan.commit();
      else this.#attempt.set(identity, plan);
    });
  }
  refresh(): void { this.#refresh.set(this.#refresh.peek() + 1); }
  attempt(work: () => void): void {
    if (this.#attempt !== undefined) throw new Error("nested-publication-attempt");
    const pending = new Map<object, Plan>();
    this.#attempt = pending;
    try {
      // A thrown callback still flushes native effects while publication is gated.
      batch(work);
    } catch (cause) {
      pending.clear();
      throw cause;
    } finally {
      this.#attempt = undefined;
    }
    // Validation/host commit rollback is a separate production contract.
    for (const plan of pending.values()) if (plan.valid()) plan.commit();
  }
}

interface Input { readonly label: string; readonly version: number }
function parseInput(value: unknown): Input {
  if (typeof value !== "object" || value === null || !("label" in value) || !("version" in value)
    || typeof value.label !== "string" || typeof value.version !== "number" || !Number.isSafeInteger(value.version)) {
    throw new Error("invalid-row-input");
  }
  return Object.freeze({ label: value.label, version: value.version });
}

/** Explicit deferred delivery: callers flush only after parent publication/tracking. */
class ReceiveQueue {
  live = true;
  admitted = true;
  applied: Input;
  lastAttempt: Input | undefined;
  pending: { input: Input; force: boolean } | undefined;
  readonly errors: unknown[] = [];
  constructor(seed: Input, readonly gate: PublicationGate, readonly receive: (input: Input, valid: () => boolean) => unknown) {
    this.applied = parseInput(seed);
  }
  offer(input: unknown, force = false): void {
    if (!this.live) return;
    const isolated = restore(graph(input));
    const parsed = parseInput(isolated);
    this.pending = { input: parsed, force };
  }
  flush(): "none" | "success" | "failed" {
    if (!this.live || !this.admitted || this.pending === undefined) return "none";
    const { input, force } = this.pending;
    this.pending = undefined;
    function same(a: Input | undefined, b: Input): boolean {
      return a !== undefined && a.label === b.label && Object.is(a.version, b.version);
    }
    if (same(this.applied, input) || (!force && same(this.lastAttempt, input))) return "none";
    this.lastAttempt = input;
    let invocationActive = true;
    try {
      this.gate.attempt(() => {
        const result = this.receive(input, () => this.live && invocationActive);
        if (result instanceof Promise) {
          result.catch(cause => this.errors.push(cause));
          throw new Error("receive-must-be-synchronous");
        }
        // A successful retry may make no native write after an earlier partial failure.
        this.gate.refresh();
      });
      if (!this.live) return "none";
      this.applied = input;
      return "success";
    } catch (cause) {
      this.errors.push(cause);
      return "failed";
    } finally {
      invocationActive = false;
    }
  }
  dispose(): void { this.live = false; this.pending = undefined; }
}

export { PublicationGate, ReceiveQueue };
export type { Input };
