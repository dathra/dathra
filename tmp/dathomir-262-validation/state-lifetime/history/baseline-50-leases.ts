/** Assimilate one trusted author result without nominal realm checks. */
function pendingResult(value: unknown): Promise<unknown> | undefined {
  if ((typeof value !== "object" || value === null) && typeof value !== "function") return undefined;
  const then: unknown = Reflect.get(value, "then");
  if (typeof then !== "function") return undefined;
  // Read once; defer invocation as Promise resolution does, and contain thrown calls.
  return new Promise((resolve, reject) => {
    Promise.resolve().then(() => Reflect.apply(then, value, [resolve, reject])).catch(reject);
  });
}

/** Experimental resource leases with native timers and explicit invocation pins. */
class Lease {
  active = true;
  settled = false;
  pins = 0;
  readonly abortController = new AbortController();
  readonly resources = new Map<object, () => void>();
  readonly callbackErrors: unknown[] = [];
  readonly cleanupErrors: unknown[] = [];
  readonly lateRejections: unknown[] = [];
  constructor(readonly ownerAlive: () => boolean, readonly closed: () => void = () => {}) {}
  current = (): boolean => this.active && this.ownerAlive();
  #idle(): void {
    if (this.current() && this.settled && this.resources.size === 0 && this.pins === 0) this.invalidate();
  }
  #stop(stop: () => void): void {
    try { stop(); } catch (cause) { this.cleanupErrors.push(cause); }
  }
  #callbackError(cause: unknown, valid: () => boolean = this.current): void {
    if (valid()) this.callbackErrors.push(cause);
    else this.lateRejections.push(cause);
  }
  #sync(result: unknown): void {
    const pending = pendingResult(result);
    if (pending !== undefined) {
      pending.catch(cause => this.#callbackError(cause));
      throw new Error("run-must-be-synchronous");
    }
  }
  settle(): void { this.settled = true; this.#idle(); }
  onDispose(stop: () => void): () => void {
    if (!this.current()) { this.#stop(stop); throw new Error("stale-resource-registration"); }
    const key = {};
    this.resources.set(key, stop);
    let released = false;
    return () => {
      if (released) return;
      released = true;
      if (this.resources.delete(key)) this.#stop(stop);
      this.#idle();
    };
  }
  run<T>(callback: () => T): T | undefined {
    if (!this.current()) return undefined;
    this.pins++;
    try {
      const result = callback();
      this.#sync(result);
      return result;
    } catch (cause) {
      this.#callbackError(cause);
      return undefined;
    } finally {
      this.pins--;
      this.#idle();
    }
  }
  timeout(callback: () => void | PromiseLike<void>, delay: number): () => void {
    if (!this.current()) throw new Error("stale-timer");
    let release = () => {};
    const handle = setTimeout(() => {
      if (!this.current()) return;
      this.pins++;
      // Pin precedes removal of the last resource.
      release();
      let async = false;
      const finish = () => { this.pins--; this.#idle(); };
      try {
        const result = callback();
        const pending = pendingResult(result);
        if (pending !== undefined) {
          async = true;
          pending.then(() => { finish(); }, cause => { this.#callbackError(cause); finish(); });
        }
      } catch (cause) {
        this.#callbackError(cause);
      } finally {
        if (!async) finish();
      }
    }, delay);
    release = this.onDispose(() => clearTimeout(handle));
    return release;
  }
  subscribe<T>(start: (emit: (value: T) => void) => () => void, onValue: (value: T, valid: () => boolean) => unknown): () => void {
    if (!this.current()) throw new Error("stale-subscription");
    this.pins++;
    const buffered: T[] = [];
    let ready = false;
    let sourceOpen = true;
    const sourceCurrent = () => sourceOpen && this.current();
    let release = () => {};
    const deliver = (value: T) => {
      if (!sourceOpen || !this.current()) return;
      if (!ready) { buffered.push(value); return; }
      this.pins++;
      let async = false;
      const finish = () => { this.pins--; this.#idle(); };
      const failed = (cause: unknown) => { this.#callbackError(cause, sourceCurrent); release(); };
      try {
        const result = onValue(value, sourceCurrent);
        const pending = pendingResult(result);
        if (pending !== undefined) {
          async = true;
          pending.then(() => { finish(); }, cause => { failed(cause); finish(); });
        }
      } catch (cause) { failed(cause); }
      finally { if (!async) finish(); }
    };
    try {
      const stop = start(deliver);
      release = this.onDispose(() => { sourceOpen = false; stop(); });
      ready = true;
      for (const value of buffered) deliver(value);
      buffered.length = 0;
      return release;
    } catch (cause) {
      // A provider that throws without returning a disposer must undo its own acquisition.
      sourceOpen = false;
      buffered.length = 0;
      throw cause;
    } finally {
      this.pins--;
      this.#idle();
    }
  }
  invalidate(): void {
    if (!this.active) return;
    // Explicit invalidation never waits for pending pins or async promises.
    this.active = false;
    this.abortController.abort();
    const stops = [...this.resources.values()].reverse();
    this.resources.clear();
    for (const stop of stops) this.#stop(stop);
    this.closed();
  }
}

class LeaseChannels {
  alive = true;
  readonly channels = new Map<string, Set<Lease>>();
  begin(channel: string, policy: "parallel" | "replace"): Lease {
    if (!this.alive) throw new Error("disposed-owner");
    const previous = this.channels.get(channel);
    const leases = policy === "replace" ? new Set<Lease>() : previous ?? new Set<Lease>();
    const lease = new Lease(() => this.alive, () => {
      leases.delete(lease);
      if (leases.size === 0 && this.channels.get(channel) === leases) this.channels.delete(channel);
    });
    // Reserve before user cleanup. A nested admission can supersede this lease.
    leases.add(lease);
    this.channels.set(channel, leases);
    if (policy === "replace" && previous !== undefined) {
      for (const old of [...previous]) old.invalidate();
    }
    return lease;
  }
  dispose(): void {
    if (!this.alive) return;
    this.alive = false;
    for (const leases of this.channels.values()) for (const lease of leases) lease.invalidate();
    this.channels.clear();
  }
}

export { Lease, LeaseChannels };
