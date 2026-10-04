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
  #callbackError(cause: unknown): void {
    if (this.current()) this.callbackErrors.push(cause);
    else this.lateRejections.push(cause);
  }
  #sync(result: unknown): void {
    if (result instanceof Promise) {
      result.catch(cause => this.#callbackError(cause));
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
  timeout(callback: () => void | Promise<void>, delay: number): () => void {
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
        if (result instanceof Promise) {
          async = true;
          result.then(() => {}, cause => this.#callbackError(cause)).finally(finish);
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
  subscribe<T>(start: (emit: (value: T) => void) => () => void, onValue: (value: T) => unknown): () => void {
    if (!this.current()) throw new Error("stale-subscription");
    this.pins++;
    const buffered: T[] = [];
    let ready = false;
    let release = () => {};
    const deliver = (value: T) => {
      if (!ready) { buffered.push(value); return; }
      if (!this.current()) return;
      this.pins++;
      try { this.#sync(onValue(value)); }
      catch (cause) { this.#callbackError(cause); release(); }
      finally { this.pins--; this.#idle(); }
    };
    try {
      const stop = start(deliver);
      release = this.onDispose(stop);
      ready = true;
      for (const value of buffered) deliver(value);
      buffered.length = 0;
      return release;
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
    let current = this.channels.get(channel);
    if (current === undefined) { current = new Set(); this.channels.set(channel, current); }
    if (policy === "replace") { for (const lease of current) lease.invalidate(); current.clear(); }
    const leases = current;
    const lease = new Lease(() => this.alive, () => {
      leases.delete(lease);
      if (leases.size === 0 && this.channels.get(channel) === leases) this.channels.delete(channel);
    });
    current.add(lease);
    this.channels.set(channel, current);
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
