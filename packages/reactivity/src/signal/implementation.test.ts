import { describe, expect, it, vi } from "vitest";

import { computed, effect, signal } from "../index";

describe("signal", () => {
  describe("Basic behavior", () => {
    it("sets initial value correctly", () => {
      const count = signal(42);
      expect(count.value).toBe(42);
    });

    it("reads via .value", () => {
      const name = signal("test");
      expect(name.value).toBe("test");
    });

    it("writes via set()", () => {
      const count = signal(0);
      count.set(10);
      expect(count.value).toBe(10);
    });

    it("updates via set() with direct value", () => {
      const count = signal(0);
      count.set(5);
      expect(count.value).toBe(5);
    });

    it("updates via set() with function", () => {
      const count = signal(10);
      count.set((prev) => prev + 5);
      expect(count.value).toBe(15);
    });

    it("sets function values without treating them as updater functions", () => {
      const initial = () => "initial";
      const next = () => "next";
      const fn = signal(initial);

      fn.set(next);

      expect(fn.value).toBe(next);
      expect(fn.value()).toBe("next");
    });
  });

  describe("Dependency tracking", () => {
    it("registers dependency when reading .value in effect", () => {
      const count = signal(0);
      const observed: number[] = [];

      effect(() => {
        observed.push(count.value);
      });

      expect(observed).toEqual([0]);

      count.set(1);
      expect(observed).toEqual([0, 1]);
    });

    it("registers dependency when reading .value in computed", () => {
      const count = signal(2);
      const doubled = computed(() => count.value * 2);

      expect(doubled.value).toBe(4);

      count.set(5);
      expect(doubled.value).toBe(10);
    });

    it("does not register dependency when using peek()", () => {
      const count = signal(0);
      const observed: number[] = [];

      effect(() => {
        observed.push(count.peek());
      });

      expect(observed).toEqual([0]);

      count.set(1);
      count.set(2);

      expect(observed).toEqual([0]);
    });
  });

  describe("Type identity", () => {
    it("has __type__ 'signal'", () => {
      const s = signal(0);
      expect(s.__type__).toBe("signal");
    });
  });

  describe("Notification", () => {
    it("re-runs effect only when value changes", () => {
      const count = signal(0);
      const spy = vi.fn();

      effect(() => {
        spy(count.value);
      });

      expect(spy).toHaveBeenCalledTimes(1);

      count.set(1);
      expect(spy).toHaveBeenCalledTimes(2);

      count.set(2);
      expect(spy).toHaveBeenCalledTimes(3);
    });

    it("does not re-run effect when same value is set", () => {
      const count = signal(5);
      const spy = vi.fn();

      effect(() => {
        spy(count.value);
      });

      expect(spy).toHaveBeenCalledTimes(1);

      count.set(5);
      expect(spy).toHaveBeenCalledTimes(1);

      count.set(5);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("handles NaN correctly using Object.is", () => {
      const num = signal(NaN);
      const spy = vi.fn();

      effect(() => {
        spy(num.value);
      });

      expect(spy).toHaveBeenCalledTimes(1);

      num.set(NaN);
      expect(spy).toHaveBeenCalledTimes(1);
    });

    it("does not trigger computed re-evaluation when setting same value", () => {
      const s = signal(1);
      const getter = vi.fn(() => s.value * 2);
      const c = computed(getter);

      expect(c.value).toBe(2);
      expect(getter).toHaveBeenCalledTimes(1);

      s.set(1); // Same value — should not propagate

      expect(c.value).toBe(2);
      expect(getter).toHaveBeenCalledTimes(1);
    });
  });
});
