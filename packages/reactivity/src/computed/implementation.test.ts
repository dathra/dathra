import { describe, expect, it, vi } from "vitest";

import { computed, effect, signal } from "../index";

describe("computed", () => {
  describe("Lazy evaluation", () => {
    it("does not call getter until .value is read", () => {
      const count = signal(1);
      const getter = vi.fn(() => count.value * 2);

      const doubled = computed(getter);

      expect(getter).not.toHaveBeenCalled();

      expect(doubled.value).toBe(2);
      expect(getter).toHaveBeenCalledTimes(1);
    });

    it("does not recompute until .value is read after dependency change", () => {
      const count = signal(1);
      const getter = vi.fn(() => count.value * 2);

      const doubled = computed(getter);

      void doubled.value;
      expect(getter).toHaveBeenCalledTimes(1);

      count.set(5);
      expect(getter).toHaveBeenCalledTimes(1);

      void doubled.value;
      expect(getter).toHaveBeenCalledTimes(2);
    });
  });

  describe("Caching", () => {
    it("does not recompute on second read if dependencies unchanged", () => {
      const count = signal(1);
      const getter = vi.fn(() => count.value * 2);

      const doubled = computed(getter);

      expect(doubled.value).toBe(2);
      expect(getter).toHaveBeenCalledTimes(1);

      expect(doubled.value).toBe(2);
      expect(getter).toHaveBeenCalledTimes(1);

      expect(doubled.value).toBe(2);
      expect(getter).toHaveBeenCalledTimes(1);
    });

    it("calls getter only once on first read after dependency change", () => {
      const count = signal(1);
      const getter = vi.fn(() => count.value * 2);

      const doubled = computed(getter);

      void doubled.value;
      expect(getter).toHaveBeenCalledTimes(1);

      count.set(3);

      expect(doubled.value).toBe(6);
      expect(getter).toHaveBeenCalledTimes(2);

      expect(doubled.value).toBe(6);
      expect(getter).toHaveBeenCalledTimes(2);
    });
  });

  describe("Dependency tracking", () => {
    it("effect reading computed becomes dependent on computed", () => {
      const count = signal(1);
      const doubled = computed(() => count.value * 2);
      const observed: number[] = [];

      effect(() => {
        observed.push(doubled.value);
      });

      expect(observed).toEqual([2]);

      count.set(5);
      expect(observed).toEqual([2, 10]);
    });

    it("signal read inside computed becomes dependency of computed", () => {
      const a = signal(1);
      const b = signal(2);
      const sum = computed(() => a.value + b.value);

      expect(sum.value).toBe(3);

      a.set(10);
      expect(sum.value).toBe(12);

      b.set(20);
      expect(sum.value).toBe(30);
    });
  });

  describe("previousValue", () => {
    it("passes undefined on first computation", () => {
      const count = signal(1);
      const receivedPrev: (number | undefined)[] = [];

      const doubled = computed((prev?: number) => {
        receivedPrev.push(prev);
        return count.value * 2;
      });

      void doubled.value;
      expect(receivedPrev).toEqual([undefined]);
    });

    it("passes previous value on subsequent computations", () => {
      const count = signal(1);
      const receivedPrev: (number | undefined)[] = [];

      const doubled = computed((prev?: number) => {
        receivedPrev.push(prev);
        return count.value * 2;
      });

      void doubled.value;
      expect(receivedPrev).toEqual([undefined]);

      count.set(5);
      void doubled.value;
      expect(receivedPrev).toEqual([undefined, 2]);

      count.set(10);
      void doubled.value;
      expect(receivedPrev).toEqual([undefined, 2, 10]);
    });
  });

  describe("Exception handling", () => {
    it("does not corrupt state when getter throws", () => {
      const count = signal(1);
      let shouldThrow = false;

      const comp = computed(() => {
        if (shouldThrow) {
          throw new Error("getter error");
        }
        return count.value * 2;
      });

      expect(comp.value).toBe(2);

      shouldThrow = true;
      count.set(5);

      expect(() => comp.value).toThrow("getter error");

      shouldThrow = false;
      count.set(10);
      expect(comp.value).toBe(20);
    });

    it("keeps existing dependencies when getter throws", () => {
      const count = signal(1);
      let shouldThrow = false;
      const observed: number[] = [];
      const failures: string[] = [];
      const comp = computed(() => {
        if (shouldThrow) {
          throw new Error("getter error");
        }
        return count.value * 2;
      });

      effect(() => {
        try {
          observed.push(comp.value);
        } catch (error) {
          failures.push((error as Error).message);
        }
      });

      expect(observed).toEqual([2]);

      shouldThrow = true;
      expect(() => count.set(2)).toThrow("getter error");
      expect(failures).toEqual([]);

      shouldThrow = false;
      count.set(3);
      expect(observed).toEqual([2, 6]);
    });
  });

  describe("peek", () => {
    it("returns the actual computed value without registering as subscriber", () => {
      const count = signal(1);
      const doubled = computed(() => count.value * 2);

      expect(doubled.peek()).toBe(2);

      count.set(5);
      expect(doubled.peek()).toBe(10);
    });

    it("does not track dependencies so effect reading via peek does not re-run", () => {
      const count = signal(0);
      const doubled = computed(() => count.value * 2);
      const spy = vi.fn();

      effect(() => {
        spy(doubled.peek());
      });

      expect(spy).toHaveBeenCalledTimes(1);

      count.set(1);
      // effect only read via peek — no dependency registered
      expect(spy).toHaveBeenCalledTimes(1);
    });
  });

  describe("initial computation failure", () => {
    it("retries computation on next read when getter throws on first access", () => {
      let shouldThrow = true;
      const count = signal(1);
      const comp = computed(() => {
        if (shouldThrow) throw new Error("initial failure");
        return count.value * 2;
      });

      // First read hits the uninitialised (flags=0) branch and throws
      expect(() => comp.value).toThrow("initial failure");

      // The failed computation must be marked dirty so next read retries
      shouldThrow = false;
      expect(comp.value).toBe(2);
    });
  });

  describe("Type identity", () => {
    it("has __type__ 'computed'", () => {
      const c = computed(() => 42);
      expect(c.__type__).toBe("computed");
    });
  });

  describe("chained computed propagation", () => {
    it("propagates updates through a chain of computed values", () => {
      const base = signal(1);
      const doubled = computed(() => base.value * 2);
      const quadrupled = computed(() => doubled.value * 2);

      expect(quadrupled.value).toBe(4);

      base.set(3);
      expect(quadrupled.value).toBe(12); // 3 * 2 * 2
    });

    it("effect observing chained computed receives updated value after signal change", () => {
      const base = signal(1);
      const doubled = computed(() => base.value * 2);
      const quadrupled = computed(() => doubled.value * 2);
      const observed: number[] = [];

      effect(() => {
        observed.push(quadrupled.value);
      });

      expect(observed).toEqual([4]);

      base.set(3);
      expect(observed).toEqual([4, 12]);
    });

    it("does not recompute downstream computed when intermediate value is unchanged", () => {
      const flag = signal(false);
      // This getter always returns 42 regardless of flag's actual value
      const alwaysFortyTwo = computed(() => {
        void flag.value; // tracked dependency, but result never changes
        return 42;
      });
      const downstream = vi.fn(() => alwaysFortyTwo.value * 2);
      const doubleFortyTwo = computed(downstream);

      expect(doubleFortyTwo.value).toBe(84);
      expect(downstream).toHaveBeenCalledTimes(1);

      // Changing flag causes alwaysFortyTwo to re-run, but its return value is still 42
      flag.set(true);

      // doubleFortyTwo must not recompute because its dependency value did not change
      expect(doubleFortyTwo.value).toBe(84);
      expect(downstream).toHaveBeenCalledTimes(1);
    });

    it("effect observing deeply chained computed does not re-run when intermediate value is unchanged", () => {
      const flag = signal(false);
      const alwaysFortyTwo = computed(() => {
        void flag.value;
        return 42;
      });
      const spy = vi.fn(() => alwaysFortyTwo.value * 2);
      const doubleFortyTwo = computed(spy);
      const observed: number[] = [];

      effect(() => {
        observed.push(doubleFortyTwo.value);
      });

      expect(observed).toEqual([84]);
      expect(spy).toHaveBeenCalledTimes(1);

      flag.set(true);

      // The effect must not re-run because doubleFortyTwo's value did not change
      expect(observed).toEqual([84]);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does not re-run downstream effects when computed remains NaN", () => {
      const flag = signal(false);
      const notANumber = computed(() => {
        void flag.value;
        return NaN;
      });
      const observed: number[] = [];

      effect(() => {
        observed.push(notANumber.value);
      });

      expect(observed).toEqual([NaN]);

      flag.set(true);

      expect(observed).toEqual([NaN]);
    });
  });
});
