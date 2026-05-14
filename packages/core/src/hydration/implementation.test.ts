import { describe, expect, it, vi } from "vitest";

import { hydrateIslands } from "@dathra/runtime/hydration";
import { hydrate } from "./implementation";

const cleanup = vi.fn();

vi.mock("@dathra/runtime/hydration", () => ({
  hydrateIslands: vi.fn(() => cleanup),
}));

describe("core hydration", () => {
  it("uses document as the default root", () => {
    hydrate();

    expect(hydrateIslands).toHaveBeenCalledWith(document);
  });

  it("passes the provided root to hydrateIslands", () => {
    const root = document.createElement("main");

    hydrate(root);

    expect(hydrateIslands).toHaveBeenCalledWith(root);
  });

  it("returns the cleanup function", () => {
    expect(hydrate()).toBe(cleanup);
  });
});
