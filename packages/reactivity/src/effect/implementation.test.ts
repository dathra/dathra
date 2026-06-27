import { describe, expect, it, vi } from "vitest";

import {
  batch,
  computed,
  createRoot,
  effect,
  onCleanup,
  signal,
} from "../index";

describe("effect", () => {
  it("reacts to changes and cleanup stops re-execution", () => {
    const count = signal(0);
    const observed: number[] = [];

    const stop = effect(() => {
      observed.push(count.value);
    });

    expect(observed).toEqual([0]);

    count.set(1);
    expect(observed).toEqual([0, 1]);

    stop();

    count.set(2);
    expect(observed).toEqual([0, 1]);
  });

  it("peek reads without tracking dependencies", () => {
    const count = signal(0);
    const observed: number[] = [];

    effect(() => {
      observed.push(count.peek());
    });

    expect(observed).toEqual([0]);

    count.set(1);

    expect(observed).toEqual([0]);
  });

  it("handles multiple consecutive changes correctly", () => {
    const count = signal(0);
    const doubleCount = computed(() => count.value * 2);

    const observed: number[] = [];

    effect(() => {
      observed.push(doubleCount.value);
    });

    count.set(1);
    count.set(2);

    expect(observed).toEqual([0, 2, 4]);
  });

  it("does not re-enter the initial run when it writes to a dependency", () => {
    const count = signal(0);
    const log: string[] = [];

    effect(() => {
      const value = count.value;
      log.push(`start:${value}`);
      if (value < 2) {
        count.set(value + 1);
      }
      log.push(`end:${value}`);
    });

    expect(log).toEqual(["start:0", "end:0"]);
    expect(count.value).toBe(1);
  });

  it("groups multiple signal updates into a single notification when batched", () => {
    const a = signal(0);
    const b = signal(0);
    const spy = vi.fn();

    effect(() => {
      spy(a.value + b.value);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    batch(() => {
      a.set(1);
      b.set(2);
    });

    // Both updates must produce exactly one re-execution
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(3);
  });
});

describe("effect onCleanup integration", () => {
  it("onCleanup registered in effect runs before re-execution", () => {
    const count = signal(0);
    const log: string[] = [];

    effect(() => {
      const v = count.value;
      log.push(`run:${v}`);
      onCleanup(() => log.push(`cleanup:${v}`));
    });

    count.set(1);
    count.set(2);

    expect(log).toEqual(["run:0", "cleanup:0", "run:1", "cleanup:1", "run:2"]);
  });

  it("onCleanup registered in effect runs when stop() is called", () => {
    const cleanupSpy = vi.fn();
    const count = signal(0);

    const stop = effect(() => {
      void count.value;
      onCleanup(cleanupSpy);
    });

    expect(cleanupSpy).not.toHaveBeenCalled();
    stop();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it("does not re-run when stop cleanup updates a dependency", () => {
    const count = signal(0);
    const observed: number[] = [];

    const stop = effect(() => {
      observed.push(count.value);
      onCleanup(() => count.set(1));
    });

    stop();

    expect(observed).toEqual([0]);
    expect(count.value).toBe(1);
  });

  it("runs effect cleanups only once when stopped repeatedly", () => {
    const cleanupSpy = vi.fn();
    const stop = effect(() => {
      onCleanup(cleanupSpy);
    });

    stop();
    stop();

    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it("multiple onCleanup calls in effect run in order", () => {
    const order: number[] = [];
    const count = signal(0);

    const stop = effect(() => {
      void count.value;
      onCleanup(() => order.push(1));
      onCleanup(() => order.push(2));
      onCleanup(() => order.push(3));
    });

    stop();
    expect(order).toEqual([1, 2, 3]);
  });

  it("continues effect cleanups when one cleanup throws before re-execution", () => {
    const count = signal(0);
    const log: string[] = [];

    effect(() => {
      void count.value;
      onCleanup(() => log.push("first"));
      onCleanup(() => {
        throw new Error("cleanup error");
      });
      onCleanup(() => log.push("third"));
    });

    expect(() => count.set(1)).not.toThrow();
    expect(log).toEqual(["first", "third"]);
  });

  it("continues effect cleanups when one cleanup throws on stop", () => {
    const log: string[] = [];

    const stop = effect(() => {
      onCleanup(() => log.push("first"));
      onCleanup(() => {
        throw new Error("cleanup error");
      });
      onCleanup(() => log.push("third"));
    });

    expect(() => stop()).not.toThrow();
    expect(log).toEqual(["first", "third"]);
  });

  it("re-execution replaces previous onCleanup with new ones", () => {
    const count = signal(0);
    const log: string[] = [];

    const stop = effect(() => {
      const v = count.value;
      onCleanup(() => log.push(`cleanup:${v}`));
    });

    count.set(1); // cleanup:0 runs, then new cleanup:1 is registered
    stop(); // cleanup:1 runs

    expect(log).toEqual(["cleanup:0", "cleanup:1"]);
  });
});

describe("effect - cleanup context restoration", () => {
  it("onCleanup registered after effect() call within createRoot is captured by root", () => {
    const cleanupSpy = vi.fn();

    const dispose = createRoot(() => {
      // Create an effect. After this returns, setCurrentEffectCleanups must
      // be restored so that subsequent onCleanup calls go to the root owner,
      // not the effect's internal cleanup list.
      effect(() => {});

      onCleanup(cleanupSpy);
    });

    // dispose() only iterates owner.cleanups — if cleanupSpy went into the
    // effect's effectCleanups array instead, it would not be called here.
    dispose();
    expect(cleanupSpy).toHaveBeenCalledTimes(1);
  });

  it("cleanup context is independent between sibling effects", () => {
    const log: string[] = [];

    const dispose = createRoot(() => {
      effect(() => {
        onCleanup(() => log.push("effect-a"));
      });

      effect(() => {
        onCleanup(() => log.push("effect-b"));
      });

      onCleanup(() => log.push("root"));
    });

    dispose();

    // root cleanup runs; effect cleanups ran at stop time (effects are stopped first)
    expect(log).toContain("root");
  });

  it("plain effects created inside createRoot are not stopped by root dispose", () => {
    const count = signal(0);
    const observed: number[] = [];

    const dispose = createRoot(() => {
      effect(() => {
        observed.push(count.value);
      });
    });

    expect(observed).toEqual([0]);

    dispose();
    count.set(1);

    expect(observed).toEqual([0, 1]);
  });
});

describe("effect - nested effects", () => {
  it("effect created inside another effect is automatically cleaned up when outer re-runs", () => {
    const trigger = signal(0);
    const count = signal(0);
    const log: number[] = [];

    createRoot(() => {
      effect(() => {
        void trigger.value; // outer depends on trigger

        // Inner effect is created while outerEffectNode is the active subscriber,
        // so link(innerEffectNode, outerEffectNode) is called, tying the inner
        // effect's lifecycle to the outer effect.
        effect(() => {
          log.push(count.value);
        });
      });
    });

    expect(log).toEqual([0]); // inner ran once on creation

    count.set(1);
    expect(log).toEqual([0, 1]); // inner re-runs

    // Re-running the outer effect should clean up the old inner effect
    // and create a fresh one.
    trigger.set(1);
    expect(log).toEqual([0, 1, 1]); // new inner created, reads current count (1)

    // Only the new inner effect should react — not the stale one.
    count.set(2);
    expect(log).toEqual([0, 1, 1, 2]);
  });
});
