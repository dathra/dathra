import { describe, expect, it, vi } from "vitest";

import { batch, effect, signal } from "../index";

describe("batch", () => {
  it("groups multiple updates into a single notification", () => {
    const count = signal(0);
    const observed: number[] = [];

    effect(() => {
      observed.push(count.value);
    });

    expect(observed).toEqual([0]);

    batch(() => {
      count.set(1);
      count.set(2);
    });

    expect(observed).toEqual([0, 2]);
  });

  it("uses only final value when updated multiple times in batch", () => {
    const count = signal(0);
    const observed: number[] = [];

    effect(() => {
      observed.push(count.value);
    });

    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    expect(observed).toEqual([0, 3]);
  });

  it("notifies only once at the end of batch", () => {
    const count = signal(0);
    const spy = vi.fn();

    effect(() => {
      spy(count.value);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    batch(() => {
      count.set(1);
      count.set(2);
      count.set(3);
    });

    expect(spy).toHaveBeenCalledTimes(2);
  });

  it("nested batch extends outer batch - flush only at outermost end", () => {
    const count = signal(0);
    const spy = vi.fn();

    effect(() => {
      spy(count.value);
    });

    expect(spy).toHaveBeenCalledTimes(1);

    batch(() => {
      count.set(1);
      batch(() => {
        count.set(2);
        // At this point, the inner batch ends but the outer batch is still active,
        // so no flush should occur yet.
        expect(spy).toHaveBeenCalledTimes(1);
      });
      // Still inside outer batch, no flush yet
      expect(spy).toHaveBeenCalledTimes(1);
      count.set(3);
    });

    // Flush happens only at the outermost batch boundary
    expect(spy).toHaveBeenCalledTimes(2);
    expect(spy).toHaveBeenLastCalledWith(3);
  });

  it("returns callback result", () => {
    const result = batch(() => 42);
    expect(result).toBe(42);
  });

  it("ends batch and flushes partial updates when callback throws", () => {
    const count = signal(0);
    const observed: number[] = [];

    effect(() => {
      observed.push(count.value);
    });

    expect(() =>
      batch(() => {
        count.set(1);
        throw new Error("batch error");
      }),
    ).toThrow("batch error");

    expect(observed).toEqual([0, 1]);

    batch(() => {
      count.set(2);
    });

    expect(observed).toEqual([0, 1, 2]);
  });
});
