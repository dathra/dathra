/**
 * Tests for Hydration functionality.
 */

import { signal } from "@dathra/reactivity";
import { atom, createAtomStore, defineAtomStoreSnapshot } from "@dathra/store";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import {
  type GenericHydrationPlan,
  HYDRATE_ISLANDS_HOOK,
  type HydrateIslandHook,
  HydrationMarkerType,
  HydrationMismatchError,
  type IslandHydrationTrigger,
  cancelScheduledIslandHydration,
  clearClientActions,
  createHydrationContext,
  getClientAction,
  handleMismatch,
  hydrate,
  hydrateIslands,
  hydrateRoot,
  hydrateTextMarker,
  hydrateWithPlan,
  isHydrated,
  markHydrated,
  registerClientAction,
} from "@/hydration/hydrate/implementation";

afterEach(() => {
  clearClientActions();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

type HydrateRootSetup = Parameters<typeof hydrateRoot>[1];
type HydrationContextArg = Parameters<HydrateRootSetup>[0];

describe("HydrationMismatchError", () => {
  it("is an instance of Error", () => {
    const error = new HydrationMismatchError("test mismatch");
    expect(error).toBeInstanceOf(Error);
  });

  it("has correct name", () => {
    const error = new HydrationMismatchError("test");
    expect(error.name).toBe("HydrationMismatchError");
  });

  it("has correct message prefix", () => {
    const error = new HydrationMismatchError("expected div, got span");
    expect(error.message).toContain("expected div, got span");
    expect(error.message).toContain("Hydration mismatch");
  });
});

describe("client action registry", () => {
  it("registers and resolves client actions by id", () => {
    const handler = vi.fn();
    const factory = vi.fn(() => handler);

    registerClientAction("action:test", factory);

    expect(getClientAction("action:test")).toBe(factory);
  });
});

describe("handleMismatch", () => {
  it("throws HydrationMismatchError in dev mode", () => {
    vi.stubGlobal("__DEV__", true);
    expect(() => handleMismatch("test error")).toThrow(HydrationMismatchError);
  });

  it("warns and returns false in production mode", () => {
    vi.stubGlobal("__DEV__", false);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    expect(handleMismatch("test error")).toBe(false);
    expect(warnSpy).toHaveBeenCalledWith(
      "[dathra] Hydration mismatch: test error. Falling back to CSR.",
    );
  });
});

describe("isHydrated and markHydrated", () => {
  let host: HTMLElement;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it("returns false for new ShadowRoot", () => {
    expect(isHydrated(shadowRoot)).toBe(false);
  });

  it("returns true after marking", () => {
    markHydrated(shadowRoot);
    expect(isHydrated(shadowRoot)).toBe(true);
  });
});

describe("hydrateRoot", () => {
  let host: HTMLElement;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it("hydrates a ShadowRoot", () => {
    shadowRoot.innerHTML = "<div>Hello</div>";
    const setup = vi.fn();

    const dispose = hydrateRoot(shadowRoot, setup);

    expect(dispose).not.toBeNull();
    expect(setup).toHaveBeenCalled();
  });

  it("returns null for already hydrated root (idempotency)", () => {
    shadowRoot.innerHTML = "<div>Hello</div>";
    const setup = vi.fn();

    hydrateRoot(shadowRoot, setup);
    const secondDispose = hydrateRoot(shadowRoot, setup);

    expect(secondDispose).toBeNull();
    expect(setup).toHaveBeenCalledTimes(1);
  });

  it("returns dispose function to cleanup", () => {
    shadowRoot.innerHTML = "<div>Hello</div>";

    const dispose = hydrateRoot(shadowRoot, () => {});

    expect(typeof dispose).toBe("function");
  });

  it("passes request-scoped store through hydration context", () => {
    shadowRoot.innerHTML = "<div>Hello</div>";
    const countAtom = atom("count", 5);
    const store = createAtomStore({ appId: "hydrate-root-store" });
    const setup = vi.fn((ctx: HydrationContextArg) => {
      expect(ctx.store).toBe(store);
      expect(ctx.store?.ref(countAtom).value).toBe(5);
    });

    hydrateRoot(shadowRoot, setup, { store });

    expect(setup).toHaveBeenCalled();
  });

  it("hydrates store snapshot before running setup when schema is provided", () => {
    const themeAtom = atom("theme", "light");
    const store = createAtomStore({ appId: "hydrate-root-snapshot" });
    const schema = defineAtomStoreSnapshot({ theme: themeAtom });

    shadowRoot.innerHTML =
      '<script type="application/json" data-dh-store>[{"theme":1},"dark"]</script><div>Hello</div>';

    const setup = vi.fn((ctx: HydrationContextArg) => {
      expect(ctx.store).toBe(store);
      expect(store.ref(themeAtom).value).toBe("dark");
      expect(shadowRoot.querySelector("script[data-dh-store]")).toBeNull();
    });

    hydrateRoot(shadowRoot, setup, {
      store,
      storeSnapshotSchema: schema,
    } as never);

    expect(setup).toHaveBeenCalled();
  });

  it("throws when storeSnapshotSchema is provided without a store", () => {
    shadowRoot.innerHTML = "<div>Hello</div>";
    const schema = defineAtomStoreSnapshot({ count: atom("count", 0) });

    expect(() => {
      hydrateRoot(shadowRoot, () => {}, {
        storeSnapshotSchema: schema,
      } as never);
    }).toThrow("storeSnapshotSchema requires a store");
  });

  it("indexes markers by id with first-match semantics", () => {
    shadowRoot.innerHTML = "<!--dh:t:1-->outer<!--dh:t:1-->later";

    const ctx = createHydrationContext(shadowRoot);

    expect(ctx.markerLookup.get(1)?.node).toBe(shadowRoot.firstChild);
  });
});

describe("hydrate", () => {
  let host: HTMLElement;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it("connects text bindings to markers", async () => {
    shadowRoot.innerHTML = "<!--dh:t:0-->initial";
    const count = signal(42);

    hydrate(shadowRoot, {
      texts: new Map([[0, () => count.value]]),
    });

    // Wait for effect to run
    await new Promise((resolve) => setTimeout(resolve, 10));

    const textNode = shadowRoot.childNodes[1] as Text;
    expect(textNode.textContent).toBe("42");
  });

  it("connects event bindings to elements", () => {
    const button = document.createElement("button");
    button.textContent = "Click";
    shadowRoot.appendChild(button);

    const handler = vi.fn();

    hydrate(shadowRoot, {
      events: new Map([[button, new Map([["click", handler]])]]),
    });

    button.click();

    expect(handler).toHaveBeenCalled();
  });

  it("returns null for already hydrated root", () => {
    shadowRoot.innerHTML = "<div>Hello</div>";

    hydrate(shadowRoot, {});
    const secondResult = hydrate(shadowRoot, {});

    expect(secondResult).toBeNull();
  });

  it("accepts a request-scoped store option", () => {
    shadowRoot.innerHTML = "<!--dh:t:0-->initial";
    const countAtom = atom("count", 8);
    const store = createAtomStore({ appId: "hydrate-store" });

    const dispose = hydrate(
      shadowRoot,
      {
        texts: new Map([[0, () => store.ref(countAtom).value]]),
      },
      { store },
    );

    expect(dispose).not.toBeNull();
  });

  it("hydrates store values from a data-dh-store script before binding text updates", async () => {
    const countAtom = atom("count", 0);
    const store = createAtomStore({ appId: "hydrate-binding-store" });
    const schema = defineAtomStoreSnapshot({ count: countAtom });

    shadowRoot.innerHTML =
      '<script type="application/json" data-dh-store>[{"count":1},42]</script><!--dh:t:0-->initial';

    hydrate(
      shadowRoot,
      {
        texts: new Map([[0, () => store.ref(countAtom).value]]),
      },
      { store, storeSnapshotSchema: schema } as never,
    );

    await new Promise((resolve) => setTimeout(resolve, 10));

    const textNode = shadowRoot.childNodes[1] as Text;
    expect(store.ref(countAtom).value).toBe(42);
    expect(textNode.textContent).toBe("42");
    expect(shadowRoot.querySelector("script[data-dh-store]")).toBeNull();
  });

  it("leaves store values untouched when no data-dh-store script exists", () => {
    const countAtom = atom("count", 1);
    const store = createAtomStore({ appId: "hydrate-no-script" });
    const schema = defineAtomStoreSnapshot({ count: countAtom });

    store.set(countAtom, 9);
    shadowRoot.innerHTML = "<div>Hello</div>";

    hydrateRoot(shadowRoot, () => {}, {
      store,
      storeSnapshotSchema: schema,
    } as never);

    expect(store.ref(countAtom).value).toBe(9);
  });
});

describe("hydrateWithPlan", () => {
  let host: HTMLElement;
  let shadowRoot: ShadowRoot;

  beforeEach(() => {
    host = document.createElement("div");
    shadowRoot = host.attachShadow({ mode: "open" });
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it("hydrates text, attr, and event bindings in place", async () => {
    const count = signal(1);
    const handler = vi.fn();
    shadowRoot.innerHTML =
      '<button data-role="counter"><!--dh:t:0-->1</button>';

    const plan: GenericHydrationPlan = {
      namespace: "html",
      bindings: [
        { kind: "text", markerId: 0, expression: () => count.value },
        {
          kind: "attr",
          path: [0],
          key: "data-count",
          expression: () => count.value,
        },
        { kind: "event", path: [0], eventType: "click", expression: handler },
      ],
      nestedBoundaries: [],
    };

    hydrateWithPlan(shadowRoot, plan);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const button = shadowRoot.querySelector("button");
    expect(button?.getAttribute("data-count")).toBe("1");
    button?.click();
    expect(handler).toHaveBeenCalledTimes(1);

    count.set(2);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(button?.textContent).toBe("2");
  });

  it("does not mutate nested boundary descendants from outer plan", async () => {
    const childText = signal("outer");
    shadowRoot.innerHTML =
      '<section><child-box data-dh-island="load"><span>keep me</span></child-box></section>';

    const plan: GenericHydrationPlan = {
      namespace: "html",
      bindings: [
        {
          kind: "attr",
          path: [0, 0],
          key: "data-should-not-change",
          expression: () => childText.value,
        },
      ],
      nestedBoundaries: [
        { path: [0, 0], tagName: "child-box", islandStrategy: "load" },
      ],
    };

    hydrateWithPlan(shadowRoot, plan);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const child = shadowRoot.querySelector("child-box");
    expect(child?.hasAttribute("data-should-not-change")).toBe(false);
  });

  it("resolves text markers outside nested boundaries when ids overlap", async () => {
    const value = signal("outer-ready");
    shadowRoot.innerHTML =
      "<section><child-box><!--dh:t:1-->inner</child-box><!--dh:t:1-->outer</section>";

    const plan: GenericHydrationPlan = {
      namespace: "html",
      bindings: [
        {
          kind: "text",
          markerId: 1,
          expression: () => value.value,
        },
      ],
      nestedBoundaries: [
        { path: [0, 0], tagName: "child-box", islandStrategy: "load" },
      ],
    };

    hydrateWithPlan(shadowRoot, plan);
    await new Promise((resolve) => setTimeout(resolve, 10));

    const child = shadowRoot.querySelector("child-box");
    expect(child?.textContent).toBe("inner");
    expect(shadowRoot.textContent).toContain("innerouter-ready");

    value.set("outer-updated");
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(child?.textContent).toBe("inner");
    expect(shadowRoot.textContent).toContain("innerouter-updated");
  });

  it("hydrates insert bindings at stable placeholder paths", async () => {
    const value = signal("A");
    shadowRoot.innerHTML =
      "<div><span>before</span><!--dh:i:1-->server<!--/dh:i--><span>after</span></div>";

    const plan: GenericHydrationPlan = {
      namespace: "html",
      bindings: [
        {
          kind: "insert",
          markerId: 1,
          path: [0, 1],
          expression: () => document.createTextNode(value.value),
          isComponent: false,
        },
      ],
      nestedBoundaries: [],
    };

    hydrateWithPlan(shadowRoot, plan);
    await new Promise((resolve) => setTimeout(resolve, 10));

    expect(shadowRoot.textContent).toContain("beforeAafter");

    value.set("B");
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(shadowRoot.textContent).toContain("beforeBafter");
  });
});

describe("hydrateIslands nested hosts", () => {
  it("collects nested island hosts independently", () => {
    const outer = document.createElement("outer-box");
    outer.setAttribute("data-dh-island", "visible");
    Reflect.set(
      outer,
      HYDRATE_ISLANDS_HOOK,
      vi.fn(() => true),
    );

    const outerShadow = outer.attachShadow({ mode: "open" });
    const inner = document.createElement("inner-box");
    inner.setAttribute("data-dh-island", "load");
    Reflect.set(
      inner,
      HYDRATE_ISLANDS_HOOK,
      vi.fn(() => true),
    );
    outerShadow.appendChild(inner);

    document.body.appendChild(outer);

    const cleanup = hydrateIslands(document);

    expect(Reflect.get(inner, HYDRATE_ISLANDS_HOOK)).toBeTypeOf("function");
    cleanup();
    outer.remove();
  });
});

describe("hydrateRoot with closed ShadowRoot", () => {
  it("returns null and warns for closed ShadowRoot", () => {
    vi.stubGlobal("__DEV__", true);
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    const host = document.createElement("div");
    const closedRoot = host.attachShadow({ mode: "closed" });
    document.body.appendChild(host);

    const setup = vi.fn();
    const result = hydrateRoot(closedRoot, setup);

    expect(result).toBeNull();
    expect(setup).not.toHaveBeenCalled();
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining("closed"));

    warnSpy.mockRestore();
    document.body.removeChild(host);
  });
});

describe("hydrateTextMarker", () => {
  it("updates text node after marker reactively", async () => {
    const count = signal(10);

    // Build a DOM with a comment marker and a text node after it
    const container = document.createElement("div");
    const marker = document.createComment("dh:t:0");
    const textNode = document.createTextNode("initial");
    container.append(marker, textNode);

    const markerInfo = {
      type: HydrationMarkerType.Text,
      id: 0,
      node: marker,
    };

    // hydrateTextMarker must run inside a createRoot for templateEffect
    const { createRoot } = await import("@dathra/reactivity");
    createRoot(() => {
      hydrateTextMarker(markerInfo, () => count.value);
    });

    // Wait for effect
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(textNode.textContent).toBe("10");

    // Update signal
    count.set(42);
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(textNode.textContent).toBe("42");
  });
});

describe("hydrateIslands", () => {
  let host: HTMLElement;

  function setHydrateHook(
    island: HTMLElement,
    hydrateHook: HydrateIslandHook,
  ): void {
    (island as unknown as Record<PropertyKey, unknown>)[HYDRATE_ISLANDS_HOOK] =
      hydrateHook;
  }

  beforeEach(() => {
    host = document.createElement("div");
    document.body.appendChild(host);
  });

  afterEach(() => {
    document.body.removeChild(host);
  });

  it("hydrates load islands after window load", () => {
    Object.defineProperty(document, "readyState", {
      configurable: true,
      value: "loading",
    });

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn((_: IslandHydrationTrigger | undefined) => true);
    island.setAttribute("data-dh-island", "load");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();

    window.dispatchEvent(new Event("load"));
    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("waits for intersection before hydrating visible islands", () => {
    let observerCallback:
      | ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void)
      | undefined;
    const disconnect = vi.fn();

    class MockIntersectionObserver {
      constructor(
        callback: (
          entries: Array<{ isIntersecting: boolean; target: Element }>,
        ) => void,
      ) {
        observerCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {
        disconnect();
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "visible");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();

    observerCallback?.([{ isIntersecting: false, target: island }]);
    expect(hydrateHook).not.toHaveBeenCalled();

    observerCallback?.([{ isIntersecting: true, target: island }]);
    expect(hydrateHook).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("hydrates idle islands through requestIdleCallback", () => {
    let idleCallback: (() => void) | undefined;
    const cancelIdle = vi.fn();

    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: () => void) => {
        idleCallback = callback;
        return 7;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", cancelIdle);

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "idle");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();

    idleCallback?.();
    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("hydrates idle islands through the timeout fallback when requestIdleCallback is unavailable", async () => {
    vi.stubGlobal("requestIdleCallback", undefined);

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "idle");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();

    await new Promise((resolve) => window.setTimeout(resolve, 0));

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("hydrates interaction islands when the configured event fires", () => {
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "interaction");
    island.setAttribute("data-dh-island-value", "mouseenter");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();

    island.dispatchEvent(new Event("click"));
    expect(hydrateHook).not.toHaveBeenCalled();

    island.dispatchEvent(new Event("mouseenter"));
    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("ignores hosts whose data-dh-island does not match the canonical strategy contract", () => {
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "legacy-visible");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();
  });

  it("defaults interaction islands to click when no value is present", () => {
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "interaction");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    island.dispatchEvent(new Event("click"));

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("passes the replay target id from the first interaction event into the island hook", () => {
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "interaction");
    setHydrateHook(island, hydrateHook);

    const button = document.createElement("button");
    button.setAttribute("data-dh-client-target", "cta");
    island.appendChild(button);
    host.appendChild(island);

    hydrateIslands(document);
    button.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );

    expect(hydrateHook).toHaveBeenCalledWith(
      expect.objectContaining({
        strategy: "interaction",
        eventType: "click",
        replayTargetId: "cta",
      }),
    );
  });

  it("hydrates interaction islands from colocated target markers for non-bubbling events", () => {
    const island = document.createElement("test-island");
    const shadowRoot = island.attachShadow({ mode: "open" });
    const hydrateHook = vi.fn<HydrateIslandHook>(() => true);
    island.setAttribute("data-dh-island", "interaction");
    island.setAttribute("data-dh-island-value", "focus");
    setHydrateHook(island, hydrateHook);

    const input = document.createElement("input");
    input.setAttribute("data-dh-client-target", "field");
    input.setAttribute("data-dh-client-strategy", "interaction");
    input.setAttribute("data-dh-client-event", "focus");
    shadowRoot.appendChild(input);
    host.appendChild(island);

    hydrateIslands(document);
    input.dispatchEvent(new FocusEvent("focus"));

    const trigger = hydrateHook.mock.calls[0]?.[0];

    expect(trigger).toMatchObject({
      strategy: "interaction",
      eventType: "focus",
      replayTargetId: "field",
    });
    expect(trigger?.replayEvent).toMatchObject({ kind: "focus" });
  });

  it("hydrates media islands after the media query matches", () => {
    let changeListener: ((event: { matches: boolean }) => void) | undefined;

    vi.stubGlobal(
      "matchMedia",
      vi.fn(() => ({
        matches: false,
        media: "(max-width: 720px)",
        addEventListener: (
          _type: string,
          listener: (event: { matches: boolean }) => void,
        ) => {
          changeListener = listener;
        },
        removeEventListener: vi.fn(),
      })),
    );

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "media");
    island.setAttribute("data-dh-island-value", "(max-width: 720px)");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    expect(hydrateHook).not.toHaveBeenCalled();

    changeListener?.({ matches: true });
    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("does not schedule or hydrate the same island twice", () => {
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "interaction");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    hydrateIslands(document);
    island.dispatchEvent(new Event("click"));
    island.dispatchEvent(new Event("click"));

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("finds islands inside open shadow roots", () => {
    const wrapper = document.createElement("section");
    const wrapperShadowRoot = wrapper.attachShadow({ mode: "open" });
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "interaction");
    setHydrateHook(island, hydrateHook);
    wrapperShadowRoot.appendChild(island);
    host.appendChild(wrapper);

    hydrateIslands(document);
    island.dispatchEvent(new Event("click"));

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("returns a cleanup function that cancels pending strategy work", () => {
    let observerCallback:
      | ((entries: Array<{ isIntersecting: boolean; target: Element }>) => void)
      | undefined;
    const disconnect = vi.fn();

    class MockIntersectionObserver {
      constructor(
        callback: (
          entries: Array<{ isIntersecting: boolean; target: Element }>,
        ) => void,
      ) {
        observerCallback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {
        disconnect();
      }
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "visible");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    const dispose = hydrateIslands(document);
    dispose();
    observerCallback?.([{ isIntersecting: true, target: island }]);

    expect(disconnect).toHaveBeenCalledTimes(1);
    expect(hydrateHook).not.toHaveBeenCalled();
  });

  it("cancels a pending island schedule per host and allows a later rescan to reschedule it", () => {
    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "interaction");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);
    cancelScheduledIslandHydration(island);
    island.dispatchEvent(new Event("click"));

    expect(hydrateHook).not.toHaveBeenCalled();

    hydrateIslands(document);
    island.dispatchEvent(new Event("click"));

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("hydrates visible islands immediately when IntersectionObserver is unavailable", () => {
    vi.stubGlobal("IntersectionObserver", undefined);

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "visible");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });

  it("hydrates media islands immediately when matchMedia is unavailable", () => {
    vi.stubGlobal("matchMedia", undefined);

    const island = document.createElement("test-island");
    const hydrateHook = vi.fn(() => true);
    island.setAttribute("data-dh-island", "media");
    island.setAttribute("data-dh-island-value", "(max-width: 720px)");
    setHydrateHook(island, hydrateHook);
    host.appendChild(island);

    hydrateIslands(document);

    expect(hydrateHook).toHaveBeenCalledTimes(1);
  });
});
