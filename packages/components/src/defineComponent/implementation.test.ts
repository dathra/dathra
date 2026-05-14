import { onCleanup, signal, templateEffect } from "@dathra/reactivity";
import { atom, createAtomStore, withStore } from "@dathra/store";

import {
  bindStoreToHost,
  canUseComponentDOMRuntime,
  peekStoreFromHost,
} from "./internal";
import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  registerClientAction,
  HYDRATE_ISLANDS_HOOK,
  hydrateIslands,
  HYDRATE_ISLANDS_STATUS,
} from "@dathra/runtime/hydration";

import { bindStoreToHost as publicBindStoreToHost } from "../index";
import {
  adoptGlobalStyles,
  clearGlobalStyles,
  css,
} from "../css/implementation";
import { defineComponent } from "./implementation";
import type { GenericHydrationPlan } from "@dathra/runtime/hydration";

/**
 * Helper to wait for custom element upgrade and connectedCallback.
 */
function waitForMicrotask(): Promise<void> {
  return new Promise((resolve) => queueMicrotask(resolve));
}

/** Counter for generating unique tag names in tests */
let tagCounter = 0;
function uniqueTag(): string {
  return `test-el-${++tagCounter}-${Date.now()}`;
}

describe("defineComponent", () => {
  beforeEach(() => {
    clearGlobalStyles();
  });

  it("should create Shadow DOM automatically", async () => {
    const tag = uniqueTag();
    defineComponent(tag, () => {
      return document.createTextNode("hello");
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot).not.toBeNull();
    expect(el.shadowRoot!.textContent).toBe("hello");

    el.remove();
  });

  it("should append setup return value to shadowRoot", async () => {
    const tag = uniqueTag();
    defineComponent(tag, () => {
      const div = document.createElement("div");
      div.textContent = "content";
      return div;
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    const div = el.shadowRoot!.querySelector("div");
    expect(div).not.toBeNull();
    expect(div!.textContent).toBe("content");

    el.remove();
  });

  it("should build DOM from string setup output through the runtime", async () => {
    const tag = uniqueTag();
    defineComponent(tag, () => {
      return '<section><p data-testid="status">ready</p></section>';
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    const section = el.shadowRoot!.querySelector("section");
    expect(section).not.toBeNull();
    expect(section!.querySelector("[data-testid='status']")?.textContent).toBe(
      "ready",
    );

    el.remove();
  });

  it("should cleanup effects on disconnectedCallback", async () => {
    const tag = uniqueTag();
    const cleanupFn = vi.fn();
    const s = signal(0);

    defineComponent(tag, () => {
      // templateEffect auto-registers with the owner (createRoot scope)
      templateEffect(() => {
        void s.value;
      });
      // onCleanup registers an explicit cleanup with the owner
      onCleanup(cleanupFn);
      return document.createTextNode("test");
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    // Remove element triggers disconnectedCallback -> dispose
    el.remove();

    expect(cleanupFn).toHaveBeenCalled();
  });

  it("should update prop signals via attributeChangedCallback", async () => {
    const tag = uniqueTag();

    defineComponent(
      tag,
      ({ props }) => document.createTextNode(props.title.value || "empty"),
      { props: { title: { type: String } } },
    );

    const el = document.createElement(tag) as any;
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.textContent).toBe("empty");

    // Test that property updates work
    el.setAttribute("title", "new-value");
    expect(el.title).toBe("new-value");

    el.remove();
  });

  it("should apply adoptedStyleSheets from options.styles", async () => {
    const tag = uniqueTag();
    const sheet = css`
      :host {
        display: block;
      }
    `;

    defineComponent(tag, () => document.createTextNode("styled"), {
      styles: [sheet],
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets).toContain(sheet);

    el.remove();
  });

  it("should apply styles from string values", async () => {
    const tag = uniqueTag();

    defineComponent(tag, () => document.createTextNode("styled"), {
      styles: [":host { color: red; }"],
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets.length).toBe(1);
    expect(el.shadowRoot!.adoptedStyleSheets[0]).toBeInstanceOf(CSSStyleSheet);

    el.remove();
  });

  it("should include adopted global styles before local styles", async () => {
    const tag = uniqueTag();
    const globalSheet = css`
      :host {
        color: rebeccapurple;
      }
    `;
    const localSheet = css`
      :host {
        display: block;
      }
    `;

    adoptGlobalStyles(globalSheet);

    defineComponent(tag, () => document.createTextNode("styled"), {
      styles: [localSheet],
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets[0]).toBe(globalSheet);
    expect(el.shadowRoot!.adoptedStyleSheets[1]).toBe(localSheet);

    el.remove();
  });

  it("should apply newly adopted global styles to already connected components", async () => {
    const tag = uniqueTag();

    defineComponent(tag, () => document.createTextNode("styled"));

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets).toHaveLength(0);

    const globalSheet = css`
      :host {
        color: steelblue;
      }
    `;
    adoptGlobalStyles(globalSheet);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets).toContain(globalSheet);

    el.remove();
  });

  it("should resync latest global styles after disconnect and reconnect", async () => {
    const tag = uniqueTag();
    const firstGlobalSheet = css`
      :host {
        color: salmon;
      }
    `;
    const secondGlobalSheet = css`
      :host {
        background: beige;
      }
    `;

    adoptGlobalStyles(firstGlobalSheet);

    defineComponent(tag, () => document.createTextNode("styled"));

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets).toContain(firstGlobalSheet);

    el.remove();
    adoptGlobalStyles(secondGlobalSheet);

    expect(el.shadowRoot!.adoptedStyleSheets).toContain(firstGlobalSheet);
    expect(el.shadowRoot!.adoptedStyleSheets).not.toContain(secondGlobalSheet);

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.adoptedStyleSheets).toContain(firstGlobalSheet);
    expect(el.shadowRoot!.adoptedStyleSheets).toContain(secondGlobalSheet);

    el.remove();
  });

  it("should call setup when DSD content does not exist", async () => {
    const tag = uniqueTag();
    const hydrateFn = vi.fn();
    const setupFn = vi.fn(() => document.createTextNode("setup"));

    defineComponent(tag, setupFn, { hydrate: hydrateFn });

    // This covers the non-DSD branch even when a hydrate option exists.
    const el = document.createElement(tag);

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(setupFn).toHaveBeenCalled();
    expect(hydrateFn).not.toHaveBeenCalled();

    el.remove();
  });

  it("should call setup when no DSD content exists even with hydrate option", async () => {
    const tag = uniqueTag();
    const hydrateFn = vi.fn();
    const setupFn = vi.fn(() => document.createTextNode("from-setup"));

    defineComponent(tag, setupFn, { hydrate: hydrateFn });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(setupFn).toHaveBeenCalled();
    expect(hydrateFn).not.toHaveBeenCalled();
    expect(el.shadowRoot!.textContent).toBe("from-setup");

    el.remove();
  });

  it("should call setup again on reconnect", async () => {
    const tag = uniqueTag();
    let callCount = 0;

    defineComponent(tag, () => {
      callCount++;
      return document.createTextNode(`call-${callCount}`);
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();
    expect(callCount).toBe(1);

    el.remove();
    await waitForMicrotask();

    // Re-attach - should call setup again
    document.body.appendChild(el);
    await waitForMicrotask();
    expect(callCount).toBe(2);

    el.remove();
  });

  it("should pass host element to setup function", async () => {
    const tag = uniqueTag();

    defineComponent(tag, () => {
      return document.createTextNode("test");
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.textContent).toBe("test");

    el.remove();
  });

  it("should initialize prop signals with current attribute values", async () => {
    const tag = uniqueTag();

    defineComponent(
      tag,
      ({ props }) => document.createTextNode(props.dataVal.value || "empty"),
      { props: { dataVal: { type: String, attribute: "data-val" } } },
    );

    const el = document.createElement(tag);
    el.setAttribute("data-val", "initial");
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.shadowRoot!.textContent).toBe("initial");

    el.remove();
  });

  it("should warn when tag name has no hyphen in __DEV__ mode", () => {
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

    // This will throw because customElements.define also
    // requires a hyphen, but the warning should fire first.
    try {
      defineComponent("nohyphen", () => document.createTextNode("test"));
    } catch {
      // Expected: customElements.define throws for invalid names
    }

    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining("must contain a hyphen"),
    );

    warnSpy.mockRestore();
  });

  it("should return the component class", () => {
    const tag = uniqueTag();
    const Comp = defineComponent(tag, () => document.createTextNode("test"));
    expect(typeof Comp).toBe("function");
    expect(typeof Comp.webComponent).toBe("function");
  });

  // Test case #5: observedAttributes is auto-generated from props schema
  it("should generate observedAttributes from props schema", () => {
    const tag = uniqueTag();
    const Comp = defineComponent(tag, () => document.createTextNode("test"), {
      props: {
        count: { type: Number },
        label: { type: String },
        active: { type: Boolean },
      },
    }) as any;
    const observed = Comp.webComponent.observedAttributes as string[];
    expect(observed).toContain("count");
    expect(observed).toContain("label");
    expect(observed).toContain("active");
  });

  // Test case #6: props signals are initialized with correct type conversion
  it("should initialize Number and Boolean prop signals with type coercion", async () => {
    const tag = uniqueTag();
    let capturedProps: any;

    defineComponent(
      tag,
      ({ props }) => {
        capturedProps = props;
        return document.createTextNode("test");
      },
      { props: { count: { type: Number }, active: { type: Boolean } } },
    );

    const el = document.createElement(tag);
    el.setAttribute("count", "42");
    el.setAttribute("active", "");
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(capturedProps.count.value).toBe(42);
    expect(capturedProps.active.value).toBe(true);

    el.remove();
  });

  // Test case #8: JS property setter sets value directly on signal
  it("should allow setting prop value via JS property setter", async () => {
    const tag = uniqueTag();
    let capturedProps: any;

    defineComponent(
      tag,
      ({ props }) => {
        capturedProps = props;
        return document.createTextNode("test");
      },
      { props: { count: { type: Number } } },
    );

    const el = document.createElement(tag) as any;
    document.body.appendChild(el);
    await waitForMicrotask();

    el.count = 99;
    expect(capturedProps.count.value).toBe(99);
    expect(el.count).toBe(99);

    el.remove();
  });

  // Test case #9: Boolean prop: attribute presence = true, absence = false
  it("should coerce Boolean prop from attribute presence/absence", async () => {
    const tag = uniqueTag();
    let capturedProps: any;

    defineComponent(
      tag,
      ({ props }) => {
        capturedProps = props;
        return document.createTextNode("test");
      },
      { props: { disabled: { type: Boolean } } },
    );

    // Without attribute
    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();
    expect(capturedProps.disabled.value).toBe(false);
    el.remove();

    // With attribute
    const el2 = document.createElement(tag);
    el2.setAttribute("disabled", "");
    document.body.appendChild(el2);
    await waitForMicrotask();
    expect(capturedProps.disabled.value).toBe(true);
    el2.remove();
  });

  // Test case #10: default value is applied when attribute is absent
  it("should apply default value when attribute is absent", async () => {
    const tag = uniqueTag();
    let capturedProps: any;

    defineComponent(
      tag,
      ({ props }) => {
        capturedProps = props;
        return document.createTextNode("test");
      },
      {
        props: {
          count: { type: Number, default: 5 },
          label: { type: String, default: "hello" },
        },
      },
    );

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(capturedProps.count.value).toBe(5);
    expect(capturedProps.label.value).toBe("hello");

    el.remove();
  });

  it("should initialize custom coercer props with null when attribute is absent", async () => {
    const tag = uniqueTag();
    const seenValues: Array<string> = [];

    defineComponent(
      tag,
      ({ props }) => {
        seenValues.push(props.mode.value);
        return document.createTextNode(props.mode.value);
      },
      {
        props: {
          mode: {
            type: (value: string | null) =>
              value === null ? "fallback" : value,
          },
        },
      },
    );

    const el = document.createElement(tag) as HTMLElement & { mode: string };
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.mode).toBe("fallback");
    expect(seenValues.at(-1)).toBe("fallback");

    el.setAttribute("mode", "active");
    await waitForMicrotask();
    expect(el.mode).toBe("active");

    el.removeAttribute("mode");
    await waitForMicrotask();
    expect(el.mode).toBe("fallback");

    el.remove();
  });

  // Test case #16: __tagName__ and __propsSchema__ are attached to the returned definition
  it("should attach __tagName__ and __propsSchema__ to the returned definition", () => {
    const tag = uniqueTag();
    const schema = { count: { type: Number } } as const;
    const Comp = defineComponent(tag, () => document.createTextNode("test"), {
      props: schema,
    }) as any;

    expect(Comp.__tagName__).toBe(tag);
    expect(Comp.__propsSchema__).toBe(schema);
    expect(Comp.webComponent.__tagName__).toBe(tag);
    expect(Comp.webComponent.__propsSchema__).toBe(schema);
  });

  it("should expose the JSX helper on the returned definition", () => {
    const tag = uniqueTag();
    const Comp = defineComponent(tag, () => document.createTextNode("test"));

    expect(Comp.jsx).toBe(Comp);
    const el = Comp({}) as HTMLElement;
    expect(el.tagName.toLowerCase()).toBe(tag);
  });

  it("should require custom element capabilities for the browser implementation path", () => {
    const originalCustomElements = globalThis.customElements;

    vi.stubGlobal("customElements", undefined);

    try {
      expect(canUseComponentDOMRuntime()).toBe(false);

      const tag = uniqueTag();
      const Comp = defineComponent(tag, () =>
        document.createTextNode("test"),
      ) as any;

      expect(Comp.webComponent.__tagName__).toBe(tag);
      expect(Comp.webComponent.__propsSchema__).toBeUndefined();
    } finally {
      vi.stubGlobal("customElements", originalCustomElements);
    }
  });

  it("should keep JSX helper on the define-time server path", () => {
    const originalCustomElements = globalThis.customElements;

    vi.stubGlobal("customElements", undefined);

    try {
      const tag = uniqueTag();
      const Comp = defineComponent(tag, () => "server-only", {
        props: { id: { type: String } },
      });

      vi.stubGlobal("customElements", originalCustomElements);

      const rendered = Comp({ id: "stable" }) as unknown;

      expect(typeof rendered).toBe("string");
      expect(rendered).toContain(`<${tag} id="stable">`);
      expect(rendered).toContain("server-only");
      expect(rendered).not.toBeInstanceOf(HTMLElement);
    } finally {
      vi.stubGlobal("customElements", originalCustomElements);
    }
  });

  it("should support JSX helper props and children", async () => {
    const tag = uniqueTag();
    const Comp = defineComponent(
      tag,
      ({ props }) => {
        const slot = document.createElement("slot");
        const wrapper = document.createElement("div");
        wrapper.setAttribute("data-title", props.title.value);
        wrapper.append(slot);
        return wrapper;
      },
      { props: { title: { type: String, default: "empty" } } },
    );

    const child = document.createElement("span");
    child.textContent = "child";
    const el = Comp({ title: "hello", children: child }) as HTMLElement & {
      title: string;
    };
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.title).toBe("hello");
    expect(el.querySelector("span")?.textContent).toBe("child");
    expect(
      el.shadowRoot?.querySelector("div")?.getAttribute("data-title"),
    ).toBe("hello");

    el.remove();
  });

  it("should support reactive JSX helper props", async () => {
    const tag = uniqueTag();
    const title = signal("before");
    const Comp = defineComponent(
      tag,
      ({ props }) => {
        const text = document.createTextNode(props.title.value);
        templateEffect(() => {
          text.data = props.title.value;
        });
        return text;
      },
      { props: { title: { type: String } } },
    );

    const el = Comp({ title }) as HTMLElement & { title: string };
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.title).toBe("before");

    title.set("after");
    await waitForMicrotask();

    expect(el.title).toBe("after");
    expect(el.shadowRoot?.textContent).toBe("after");

    el.remove();
  });

  it("should not write compiler-reserved client directive props to DOM when using the JSX helper", () => {
    const tag = uniqueTag();
    const Comp = defineComponent(tag, () => document.createTextNode("test"));

    const el = Comp({
      "client:load": true,
      "client:visible": "",
      "client:interaction": "mouseenter",
      "client:media": "(max-width: 720px)",
    }) as HTMLElement;

    expect(el.hasAttribute("client:load")).toBe(false);
    expect(el.hasAttribute("client:visible")).toBe(false);
    expect(el.hasAttribute("client:interaction")).toBe(false);
    expect(el.hasAttribute("client:media")).toBe(false);
  });

  it("should expose client context defaults for non-island components", async () => {
    const tag = uniqueTag();
    let capturedClient:
      | { strategy: string | null; value: string | null; hydrated: boolean }
      | undefined;

    defineComponent(tag, ({ client }) => {
      capturedClient = {
        strategy: client.strategy,
        value: client.value,
        hydrated: client.hydrated,
      };
      return document.createTextNode("test");
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(capturedClient).toEqual({
      strategy: null,
      value: null,
      hydrated: false,
    });

    el.remove();
  });

  it("should normalize unknown client metadata to null in client context", async () => {
    const tag = uniqueTag();
    let capturedClient:
      | { strategy: string | null; value: string | null; hydrated: boolean }
      | undefined;

    defineComponent(tag, ({ client }) => {
      capturedClient = {
        strategy: client.strategy,
        value: client.value,
        hydrated: client.hydrated,
      };
      return document.createTextNode("test");
    });

    const el = document.createElement(tag);
    el.setAttribute("data-dh-island", "typo");
    el.setAttribute("data-dh-island-value", "mouseenter");
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(capturedClient).toEqual({
      strategy: null,
      value: null,
      hydrated: false,
    });

    el.remove();
  });

  it("should default bare interaction host metadata to click in client context", async () => {
    const tag = uniqueTag();
    let capturedClient:
      | { strategy: string | null; value: string | null; hydrated: boolean }
      | undefined;

    defineComponent(tag, ({ client }) => {
      capturedClient = {
        strategy: client.strategy,
        value: client.value,
        hydrated: client.hydrated,
      };
      return document.createTextNode("test");
    });

    const el = document.createElement(tag);
    el.setAttribute("data-dh-island", "interaction");
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(capturedClient).toEqual({
      strategy: "interaction",
      value: "click",
      hydrated: false,
    });

    el.remove();
  });

  // Test case #18: Number prop: null attribute uses default value (not Number(null) = 0)
  it("should use default value for Number prop when attribute is absent, not Number(null)", async () => {
    const tag = uniqueTag();
    let capturedProps: any;

    defineComponent(
      tag,
      ({ props }) => {
        capturedProps = props;
        return document.createTextNode("test");
      },
      { props: { count: { type: Number, default: 42 } } },
    );

    const el = document.createElement(tag);
    // Do not set 'count' attribute
    document.body.appendChild(el);
    await waitForMicrotask();

    // Should be 42 (default), not 0 (Number(null))
    expect(capturedProps.count.value).toBe(42);

    el.remove();
  });

  it("should pass host element to the component context", async () => {
    const tag = uniqueTag();
    let capturedHost: HTMLElement | undefined;

    defineComponent(tag, ({ host }) => {
      capturedHost = host;
      return document.createTextNode(host.tagName.toLowerCase());
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    expect(capturedHost).toBe(el);
    expect(el.shadowRoot!.textContent).toBe(tag);

    el.remove();
  });

  it("should resolve ctx.store from withStore for the created custom element", async () => {
    const tag = uniqueTag();
    const countAtom = atom("count", 1);
    const appStore = createAtomStore({ appId: `app-${tag}` });
    let capturedStore: ReturnType<typeof createAtomStore> | undefined;

    defineComponent(tag, ({ store }) => {
      capturedStore = store;
      return document.createTextNode(String(store.ref(countAtom).value));
    });

    const host = withStore(appStore, () => document.createElement(tag));
    document.body.appendChild(host);
    await waitForMicrotask();

    expect(capturedStore).toBe(appStore);
    expect(host.shadowRoot!.textContent).toBe("1");

    host.remove();
  });

  it("should prefer the inner withStore boundary for nested custom element creation", async () => {
    const tag = uniqueTag();
    const themeAtom = atom("theme", "light");
    const rootStore = createAtomStore({ appId: `root-${tag}` });
    const childStore = rootStore.fork({ values: [[themeAtom, "dark"]] });

    defineComponent(tag, ({ store }) => {
      return document.createTextNode(store.ref(themeAtom).value);
    });

    const host = withStore(rootStore, () => {
      return withStore(childStore, () => document.createElement(tag));
    });

    document.body.appendChild(host);
    await waitForMicrotask();

    expect(host.shadowRoot!.textContent).toBe("dark");

    host.remove();
  });

  it("should retry hydrate when store binding arrives after connectedCallback", async () => {
    const tag = uniqueTag();
    const countAtom = atom("count", 12);
    const store = createAtomStore({ appId: `late-store-${tag}` });
    let capturedStore: ReturnType<typeof createAtomStore> | undefined;

    defineComponent(
      tag,
      ({ store: ctxStore }) => {
        capturedStore = ctxStore;
        return document.createTextNode(String(ctxStore.ref(countAtom).value));
      },
      {
        hydrate: ({ host, store: ctxStore }) => {
          capturedStore = ctxStore;
          host.setAttribute("data-hydrated", "true");
        },
      },
    );

    const host = document.createElement(tag);
    const template = document.createElement("template");
    template.setAttribute("shadowrootmode", "open");
    template.innerHTML = "<div>SSR</div>";
    host.appendChild(template);

    document.body.appendChild(host);
    bindStoreToHost(host, store);
    await waitForMicrotask();

    expect(capturedStore).toBe(store);

    host.remove();
  });

  it("should expose store binding through the public components API", () => {
    const host = document.createElement("public-store-host");
    const store = createAtomStore({ appId: "public-store-binding" });

    publicBindStoreToHost(host, store);

    expect(peekStoreFromHost(host)).toBe(store);
  });

  it("should defer island hydration until hydrateIslands triggers the strategy", async () => {
    const tag = uniqueTag();
    const hydrateFn = vi.fn(({ host }: { host: HTMLElement }) => {
      host.setAttribute("data-hydrated", "true");
    });

    defineComponent(tag, () => '<button type="button">SSR</button>', {
      hydrate: hydrateFn,
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="interaction"><template shadowrootmode="open"><button type="button">SSR</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(hydrateFn).not.toHaveBeenCalled();

    hydrateIslands(document);
    el.dispatchEvent(new Event("click"));
    await waitForMicrotask();

    expect(hydrateFn).toHaveBeenCalledTimes(1);
    expect(el.getAttribute("data-hydrated")).toBe("true");

    el.remove();
  });

  it("should hydrate immediately when data-dh-island uses an unknown strategy value", async () => {
    const tag = uniqueTag();
    const hydrateFn = vi.fn(({ host }: { host: HTMLElement }) => {
      host.setAttribute("data-hydrated", "true");
    });

    defineComponent(tag, () => '<button type="button">SSR</button>', {
      hydrate: hydrateFn,
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="typo"><template shadowrootmode="open"><button type="button">SSR</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(hydrateFn).toHaveBeenCalledTimes(1);
    expect(el.getAttribute("data-hydrated")).toBe("true");

    el.remove();
  });

  it("should keep deferred island hydration schedulable until store binding arrives", async () => {
    const tag = uniqueTag();
    const countAtom = atom("count", 12);
    const store = createAtomStore({ appId: `late-store-island-${tag}` });
    let capturedStore: ReturnType<typeof createAtomStore> | undefined;

    defineComponent(tag, () => '<button type="button">SSR</button>', {
      hydrate: ({ host, store: ctxStore }) => {
        capturedStore = ctxStore;
        host.setAttribute("data-hydrated", "true");
        host.setAttribute("data-count", String(ctxStore.ref(countAtom).value));
      },
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="interaction"><template shadowrootmode="open"><button type="button">SSR</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    hydrateIslands(document);
    el.dispatchEvent(new Event("click"));
    await waitForMicrotask();

    expect(capturedStore).toBeUndefined();
    expect(el.getAttribute("data-hydrated")).toBeNull();

    bindStoreToHost(el, store);
    hydrateIslands(document);
    el.dispatchEvent(new Event("click"));
    await waitForMicrotask();

    expect(capturedStore).toBe(store);
    expect(el.getAttribute("data-hydrated")).toBe("true");
    expect(el.getAttribute("data-count")).toBe("12");
    expect(Reflect.get(el, HYDRATE_ISLANDS_STATUS)).toBe("hydrated");

    el.remove();
  });

  it("should derive host interaction metadata from colocated target markers before scheduling hydration", async () => {
    const tag = uniqueTag();
    const clickSpy = vi.fn();

    defineComponent(tag, () => {
      const button = document.createElement("button");
      button.setAttribute("data-dh-client-target", "cta");
      button.setAttribute("data-dh-client-strategy", "interaction");
      button.textContent = "Click me";
      button.addEventListener("click", () => {
        clickSpy();
      });
      return button;
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><button data-dh-client-target="cta" data-dh-client-strategy="interaction">Click me</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("interaction");
    expect(el.getAttribute("data-dh-island-value")).toBe("click");

    hydrateIslands(document);
    const ssrButton = el.shadowRoot?.querySelector("button");
    ssrButton?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();

    expect(clickSpy).toHaveBeenCalledTimes(1);

    el.remove();
  });

  it("should derive non-click interaction metadata from colocated target markers", async () => {
    const tag = uniqueTag();
    const keySpy = vi.fn();

    defineComponent(tag, () => {
      const input = document.createElement("input");
      input.setAttribute("data-dh-client-target", "field");
      input.setAttribute("data-dh-client-strategy", "interaction");
      input.setAttribute("data-dh-client-event", "keydown");
      input.addEventListener("keydown", (event) => {
        keySpy((event as KeyboardEvent).key);
      });
      return input;
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><input data-dh-client-target="field" data-dh-client-strategy="interaction" data-dh-client-event="keydown"></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("interaction");
    expect(el.getAttribute("data-dh-island-value")).toBe("keydown");

    hydrateIslands(document);
    const ssrInput = el.shadowRoot?.querySelector("input");
    ssrInput?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "Enter",
      }),
    );
    await waitForMicrotask();

    expect(keySpy).toHaveBeenCalledWith("Enter");

    el.remove();
  });

  it("should derive host visible metadata from colocated target markers and defer setup until hydrateIslands runs visibility scheduling", async () => {
    const tag = uniqueTag();
    const clickSpy = vi.fn();

    class MockIntersectionObserver {
      static callback:
        | ((
            entries: Array<{ isIntersecting: boolean; target: Element }>,
          ) => void)
        | undefined;

      constructor(
        callback: (
          entries: Array<{ isIntersecting: boolean; target: Element }>,
        ) => void,
      ) {
        MockIntersectionObserver.callback = callback;
      }

      observe() {}
      unobserve() {}
      disconnect() {}
    }

    vi.stubGlobal("IntersectionObserver", MockIntersectionObserver);

    defineComponent(tag, () => {
      const button = document.createElement("button");
      button.setAttribute("data-dh-client-target", "cta");
      button.setAttribute("data-dh-client-strategy", "visible");
      button.textContent = "Visible click";
      button.addEventListener("click", () => {
        clickSpy();
      });
      return button;
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><button data-dh-client-target="cta" data-dh-client-strategy="visible">Visible click</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("visible");

    hydrateIslands(document);
    expect(clickSpy).not.toHaveBeenCalled();

    const ssrButton = el.shadowRoot?.querySelector("button");
    ssrButton?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();
    expect(clickSpy).not.toHaveBeenCalled();

    MockIntersectionObserver.callback?.([{ isIntersecting: true, target: el }]);
    await waitForMicrotask();

    const button = el.shadowRoot?.querySelector("button");
    button?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();

    expect(clickSpy).toHaveBeenCalledTimes(1);

    el.remove();
  });

  it("should derive host idle metadata from colocated target markers and enable click after idle scheduling", async () => {
    const tag = uniqueTag();
    const clickSpy = vi.fn();
    let idleCallback: (() => void) | undefined;

    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: () => void) => {
        idleCallback = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    defineComponent(tag, () => {
      const button = document.createElement("button");
      button.setAttribute("data-dh-client-target", "cta");
      button.setAttribute("data-dh-client-strategy", "idle");
      button.textContent = "Idle click";
      button.addEventListener("click", () => {
        clickSpy();
      });
      return button;
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><button data-dh-client-target="cta" data-dh-client-strategy="idle">Idle click</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("idle");

    hydrateIslands(document);
    expect(clickSpy).not.toHaveBeenCalled();

    const ssrButton = el.shadowRoot?.querySelector("button");
    ssrButton?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();
    expect(clickSpy).not.toHaveBeenCalled();

    idleCallback?.();
    await waitForMicrotask();

    const button = el.shadowRoot?.querySelector("button");
    button?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();

    expect(clickSpy).toHaveBeenCalledTimes(1);

    el.remove();
  });

  it("should reject colocated client markers when the component also defines hydrate", async () => {
    const tag = uniqueTag();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    defineComponent(tag, () => document.createElement("button"), {
      hydrate: () => {},
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><button data-dh-client-target="cta" data-dh-client-strategy="interaction">Click me</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(errorSpy).toHaveBeenCalledWith(
      "[dathra] colocated load:on* / interaction:on* / idle:on* / visible:on* cannot be combined with a hydrate option in the same component",
    );
    expect(el.getAttribute("data-dh-island")).toBeNull();

    el.remove();
    errorSpy.mockRestore();
  });

  it("should reject colocated client markers when host-level island metadata is already present", async () => {
    const tag = uniqueTag();
    const errorSpy = vi.spyOn(console, "error").mockImplementation(() => {});

    defineComponent(tag, () => document.createElement("button"));

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="load"><template shadowrootmode="open"><button data-dh-client-target="cta" data-dh-client-strategy="idle">Click me</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(errorSpy).toHaveBeenCalledWith(
      "[dathra] host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
    );
    expect(el.getAttribute("data-dh-island")).toBe("load");

    el.remove();
    errorSpy.mockRestore();
  });

  it("should defer host client action binding until idle strategy fires", async () => {
    const tag = uniqueTag();
    const actionId = `action:${tag}`;
    const clickSpy = vi.fn();
    let idleCallback: (() => void) | undefined;

    vi.stubGlobal(
      "requestIdleCallback",
      vi.fn((callback: () => void) => {
        idleCallback = callback;
        return 1;
      }),
    );
    vi.stubGlobal("cancelIdleCallback", vi.fn());

    registerClientAction(actionId, (payload: Record<string, unknown>) => {
      return () => {
        clickSpy(payload.label as string);
      };
    });
    defineComponent(tag, () => document.createElement("button"));

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="idle" data-dh-client-actions='{"click":{"id":"${actionId}","payload":{"label":"idle-ready"}}}'><template shadowrootmode="open"><button type="button">SSR</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    hydrateIslands(document);
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();
    expect(clickSpy).not.toHaveBeenCalled();

    idleCallback?.();
    await waitForMicrotask();

    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();
    expect(clickSpy).toHaveBeenCalledWith("idle-ready");

    el.remove();
  });

  it("should replay interaction events against host client actions", async () => {
    const tag = uniqueTag();
    const actionId = `action:${tag}`;
    const clickSpy = vi.fn();

    registerClientAction(actionId, (payload: Record<string, unknown>) => {
      return () => {
        clickSpy(payload.label as string);
      };
    });
    defineComponent(tag, () => document.createElement("button"));

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="interaction" data-dh-island-value="click" data-dh-client-actions='{"click":{"id":"${actionId}","payload":{"label":"interaction-ready"}}}'><template shadowrootmode="open"><button type="button">SSR</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    hydrateIslands(document);
    el.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();

    expect(clickSpy).toHaveBeenCalledWith("interaction-ready");
    expect(Reflect.get(el, HYDRATE_ISLANDS_STATUS)).toBe("hydrated");

    el.remove();
  });

  it("should replay the first click for interaction-deferred setup islands with client target markers", async () => {
    const tag = uniqueTag();
    const clickSpy = vi.fn();

    defineComponent(tag, () => {
      const button = document.createElement("button");
      button.setAttribute("data-dh-client-target", "cta");
      button.textContent = "Click me";
      button.addEventListener("click", () => {
        clickSpy();
      });
      return button;
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag} data-dh-island="interaction"><template shadowrootmode="open"><button data-dh-client-target="cta">Click me</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    hydrateIslands(document);
    const ssrButton = el.shadowRoot?.querySelector("button");
    ssrButton?.dispatchEvent(
      new MouseEvent("click", { bubbles: true, composed: true }),
    );
    await waitForMicrotask();

    expect(clickSpy).toHaveBeenCalledTimes(1);

    el.remove();
  });

  it("should replay the first keydown for interaction-deferred setup islands with client target markers", async () => {
    const tag = uniqueTag();
    const keySpy = vi.fn();

    defineComponent(tag, () => {
      const input = document.createElement("input");
      input.setAttribute("data-dh-client-target", "field");
      input.setAttribute("data-dh-client-event", "keydown");
      input.addEventListener("keydown", (event) => {
        keySpy((event as KeyboardEvent).key);
      });
      return input;
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><input data-dh-client-target="field" data-dh-client-strategy="interaction" data-dh-client-event="keydown"></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    hydrateIslands(document);
    const ssrInput = el.shadowRoot?.querySelector("input");
    ssrInput?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "Enter",
      }),
    );
    await waitForMicrotask();

    expect(keySpy).toHaveBeenCalledWith("Enter");

    el.remove();
  });

  it("should allow a deferred island to hydrate after reconnect", async () => {
    const tag = uniqueTag();
    const hydrateFn = vi.fn(({ host }: { host: HTMLElement }) => {
      host.setAttribute("data-hydrated", "true");
    });

    defineComponent(tag, () => '<button type="button">SSR</button>', {
      hydrate: hydrateFn,
    });

    const createIslandElement = () => {
      const container = document.createElement("div");
      container.innerHTML = `<${tag} data-dh-island="interaction"><template shadowrootmode="open"><button type="button">SSR</button></template></${tag}>`;
      return container.firstElementChild as HTMLElement;
    };

    const el = createIslandElement();
    document.body.appendChild(el);
    await waitForMicrotask();

    hydrateIslands(document);
    el.remove();
    await waitForMicrotask();

    const reconnected = createIslandElement();
    document.body.appendChild(reconnected);
    await waitForMicrotask();

    hydrateIslands(document);
    reconnected.dispatchEvent(new Event("click"));
    await waitForMicrotask();

    expect(hydrateFn).toHaveBeenCalledTimes(1);
    expect(reconnected.getAttribute("data-hydrated")).toBe("true");

    reconnected.remove();
  });

  // Test case #19: setup throwing an error leaves #dispose undefined; reconnect is safe
  it("should handle setup error gracefully so reconnect still works", async () => {
    const tag = uniqueTag();
    let shouldThrow = true;
    const consoleError = vi
      .spyOn(console, "error")
      .mockImplementation(() => {});

    defineComponent(tag, () => {
      if (shouldThrow) throw new Error("setup error");
      return document.createTextNode("recovered");
    });

    const el = document.createElement(tag);
    document.body.appendChild(el);
    await waitForMicrotask();

    // Error should be logged
    expect(consoleError).toHaveBeenCalled();

    // disconnectedCallback with undefined #dispose should not throw
    expect(() => el.remove()).not.toThrow();
    await waitForMicrotask();

    // Reconnect after fixing the error should work
    shouldThrow = false;
    document.body.appendChild(el);
    await waitForMicrotask();
    expect(el.shadowRoot!.textContent).toBe("recovered");

    el.remove();
    consoleError.mockRestore();
  });

  it("should call hydrate (not setup) when DSD content is present in shadowRoot", async () => {
    const tag = uniqueTag();
    const hydrateFn = vi.fn();
    const setupFn = vi.fn(() => document.createTextNode("from-setup"));

    defineComponent(tag, setupFn, { hydrate: hydrateFn });

    // Use innerHTML parsing so the browser natively creates a declarative shadow root
    // (document.createElement cannot produce a pre-existing shadowRoot)
    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><p>SSR content</p></template></${tag}>`;
    const el = container.firstElementChild!;

    document.body.appendChild(el);
    await waitForMicrotask();

    // hydrate should be called, not setup
    expect(hydrateFn).toHaveBeenCalled();
    expect(setupFn).not.toHaveBeenCalled();

    el.remove();
  });

  it("should use compiler-generated hydration metadata when DSD content is present", async () => {
    const tag = uniqueTag();
    const component = vi.fn(({ props }) => {
      return document.createTextNode(String(props.label.value));
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory: (host: HTMLElement, ctx: any) => GenericHydrationPlan;
      };
    };

    component.__hydrationMetadata__ = {
      kind: "generic-plan",
      planFactory: (_host, ctx) => ({
        namespace: "html",
        bindings: [
          {
            kind: "text",
            markerId: 0,
            expression: () => ctx.props.label.value,
          },
        ],
        nestedBoundaries: [],
      }),
    };

    expect("boundaryRefs" in component.__hydrationMetadata__).toBe(false);

    defineComponent(tag, component as never, {
      props: { label: { type: String } },
      hydrate: undefined,
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag} label="hydrated"><template shadowrootmode="open"><!--dh:t:0-->SSR</template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(component).not.toHaveBeenCalled();
    expect(el.shadowRoot?.textContent).toBe("hydrated");

    el.remove();
  });

  it("should replay interaction events after compiler-generated plan hydration", async () => {
    const tag = uniqueTag();
    const keySpy = vi.fn();
    const component = vi.fn(() => {
      return document.createElement("input");
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory: (host: HTMLElement, ctx: any) => GenericHydrationPlan;
      };
    };

    component.__hydrationMetadata__ = {
      kind: "generic-plan",
      planFactory: () => ({
        namespace: "html",
        bindings: [
          {
            kind: "event",
            path: [0],
            eventType: "keydown",
            expression: (event: Event) => {
              keySpy((event as KeyboardEvent).key);
            },
          },
        ],
        nestedBoundaries: [],
      }),
    };

    defineComponent(tag, component as never);

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><input data-dh-client-target="field" data-dh-client-strategy="interaction" data-dh-client-event="keydown"></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("interaction");
    expect(el.getAttribute("data-dh-island-value")).toBe("keydown");

    hydrateIslands(document);
    const ssrInput = el.shadowRoot?.querySelector("input");
    ssrInput?.dispatchEvent(
      new KeyboardEvent("keydown", {
        bubbles: true,
        composed: true,
        key: "Enter",
      }),
    );
    await waitForMicrotask();

    expect(keySpy).toHaveBeenCalledWith("Enter");
    expect(component).not.toHaveBeenCalled();

    el.remove();
  });

  it("should replay focus events after compiler-generated plan hydration", async () => {
    const tag = uniqueTag();
    const focusSpy = vi.fn();
    const component = vi.fn(() => {
      return document.createElement("input");
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory: (host: HTMLElement, ctx: any) => GenericHydrationPlan;
      };
    };

    component.__hydrationMetadata__ = {
      kind: "generic-plan",
      planFactory: () => ({
        namespace: "html",
        bindings: [
          {
            kind: "event",
            path: [0],
            eventType: "focus",
            expression: (event: Event) => {
              focusSpy(event.type);
            },
          },
        ],
        nestedBoundaries: [],
      }),
    };

    defineComponent(tag, component as never);

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><input data-dh-client-target="field" data-dh-client-strategy="interaction" data-dh-client-event="focus"></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("interaction");
    expect(el.getAttribute("data-dh-island-value")).toBe("focus");

    hydrateIslands(document);
    const ssrInput = el.shadowRoot?.querySelector("input");
    ssrInput?.dispatchEvent(
      new FocusEvent("focus", {
        bubbles: true,
        composed: true,
      }),
    );
    await waitForMicrotask();

    expect(focusSpy).toHaveBeenCalledWith("focus");
    expect(component).not.toHaveBeenCalled();

    el.remove();
  });

  it("should replay pointer events after compiler-generated plan hydration", async () => {
    const tag = uniqueTag();
    const pointerSpy = vi.fn();
    const component = vi.fn(() => {
      return document.createElement("button");
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory: (host: HTMLElement, ctx: any) => GenericHydrationPlan;
      };
    };

    component.__hydrationMetadata__ = {
      kind: "generic-plan",
      planFactory: () => ({
        namespace: "html",
        bindings: [
          {
            kind: "event",
            path: [0],
            eventType: "pointerdown",
            expression: (event: Event) => {
              pointerSpy((event as PointerEvent).pointerType);
            },
          },
        ],
        nestedBoundaries: [],
      }),
    };

    defineComponent(tag, component as never);

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><button data-dh-client-target="field" data-dh-client-strategy="interaction" data-dh-client-event="pointerdown">SSR</button></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(el.getAttribute("data-dh-island")).toBe("interaction");
    expect(el.getAttribute("data-dh-island-value")).toBe("pointerdown");

    hydrateIslands(document);
    const ssrButton = el.shadowRoot?.querySelector("button");
    ssrButton?.dispatchEvent(
      new PointerEvent("pointerdown", {
        bubbles: true,
        composed: true,
        pointerType: "mouse",
      }),
    );
    await waitForMicrotask();

    expect(pointerSpy).toHaveBeenCalledWith("mouse");
    expect(component).not.toHaveBeenCalled();

    el.remove();
  });

  it("should replace SSR style tags with adoptedStyleSheets during DSD hydrate", async () => {
    const tag = uniqueTag();
    const globalSheet = css`
      :host {
        color: navy;
      }
    `;
    const localSheet = css`
      :host {
        display: block;
      }
    `;

    adoptGlobalStyles(globalSheet);

    const hydrateFn = vi.fn();

    defineComponent(tag, () => document.createTextNode("from-setup"), {
      styles: [localSheet],
      hydrate: hydrateFn,
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><style>:host { color: navy; }</style><style>:host { display: block; }</style><p>SSR content</p></template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(hydrateFn).toHaveBeenCalled();
    expect(el.shadowRoot!.querySelectorAll("style")).toHaveLength(0);
    expect(el.shadowRoot!.adoptedStyleSheets).toContain(globalSheet);
    expect(el.shadowRoot!.adoptedStyleSheets).toContain(localSheet);

    el.remove();
  });

  it("should expand DSD <template shadowrootmode> into real shadowRoot on fallback", async () => {
    const tag = uniqueTag();
    const setupFn = vi.fn(() => document.createTextNode("re-rendered"));

    defineComponent(tag, setupFn);

    // Use innerHTML parsing so the browser natively creates a declarative shadow root
    const container = document.createElement("div");
    container.innerHTML = `<${tag}><template shadowrootmode="open"><div>SSR fallback content</div></template></${tag}>`;
    const el = container.firstElementChild!;

    document.body.appendChild(el);
    await waitForMicrotask();

    // The template element should be removed by native DSD parsing
    expect(el.querySelector("template")).toBeNull();
    // ShadowRoot should exist
    expect(el.shadowRoot).not.toBeNull();
    // Without hydrate option, setup runs and clears DSD content, then re-renders
    expect(setupFn).toHaveBeenCalled();
    expect(el.shadowRoot!.textContent).toBe("re-rendered");

    el.remove();
  });

  it("should log unsupportedReason and fallback to setup rerender when compiler-generated hydration is unsupported", async () => {
    const tag = uniqueTag();
    const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});
    const setupFn = vi.fn(({ props }) => {
      return document.createTextNode(String(props.label.value));
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory?: null;
        unsupportedReason: string;
      };
    };

    setupFn.__hydrationMetadata__ = {
      kind: "generic-plan",
      unsupportedReason: "imperative-dom-query",
    };

    defineComponent(tag, setupFn as never, {
      props: { label: { type: String } },
    });

    const container = document.createElement("div");
    container.innerHTML = `<${tag} label="fallback"><template shadowrootmode="open"><!--dh:t:0-->SSR</template></${tag}>`;
    const el = container.firstElementChild as HTMLElement;

    document.body.appendChild(el);
    await waitForMicrotask();

    expect(setupFn).toHaveBeenCalledTimes(1);
    expect(el.shadowRoot?.textContent).toBe("fallback");
    expect(warnSpy).toHaveBeenCalledWith(
      expect.stringContaining(
        "compiler-generated hydration is unsupported: imperative-dom-query",
      ),
    );

    el.remove();
    warnSpy.mockRestore();
  });

  it("should exclude attribute: false prop from observedAttributes and only allow JS property setter", async () => {
    const tag = uniqueTag();
    let capturedProps: any;

    const Comp = defineComponent(
      tag,
      ({ props }) => {
        capturedProps = props;
        return document.createTextNode("test");
      },
      {
        props: {
          internal: { type: Number, default: 42, attribute: false },
          visible: { type: String },
        },
      },
    ) as any;

    // observedAttributes should NOT contain "internal" but should contain "visible"
    const observed = Comp.webComponent.observedAttributes as string[];
    expect(observed).not.toContain("internal");
    expect(observed).toContain("visible");

    const el = document.createElement(tag) as any;
    document.body.appendChild(el);
    await waitForMicrotask();

    // Default value should be applied (not from attribute)
    expect(capturedProps.internal.value).toBe(42);

    // setAttribute should NOT update the signal (attribute is not observed)
    el.setAttribute("internal", "99");
    expect(capturedProps.internal.value).toBe(42);

    // JS property setter should update the signal
    el.internal = 99;
    expect(capturedProps.internal.value).toBe(99);
    expect(el.internal).toBe(99);

    el.remove();
  });

  it("should propagate store to nested custom elements in JSX subtree", async () => {
    const childTag = uniqueTag();
    const parentTag = uniqueTag();

    defineComponent(childTag, () => {
      return document.createTextNode("child");
    });

    const Parent = defineComponent(parentTag, () => {
      const slot = document.createElement("slot");
      return slot;
    });

    const appStore = createAtomStore({ appId: `store-prop-${parentTag}` });

    // Create parent via JSX helper within a store boundary, with a child custom element
    const childEl = document.createElement(childTag);
    const parentEl = withStore(appStore, () =>
      Parent({ children: childEl }),
    ) as HTMLElement;

    document.body.appendChild(parentEl);
    await waitForMicrotask();

    // The child should have the store bound via bindCurrentStoreToSubtree
    expect(peekStoreFromHost(childEl)).toBe(appStore);

    parentEl.remove();
  });

  it("should preserve a nested load island when an outer visible host hydrates with a compiler plan", async () => {
    const outerTag = uniqueTag();
    const innerTag = uniqueTag();

    const innerClick = vi.fn();

    const InnerComponent = vi.fn(() => {
      return document.createElement("button");
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory: (host: HTMLElement, ctx: any) => GenericHydrationPlan;
      };
    };

    InnerComponent.__hydrationMetadata__ = {
      kind: "generic-plan",
      planFactory: () => ({
        namespace: "html",
        bindings: [
          {
            kind: "text",
            markerId: 0,
            expression: () => "inner:load:ready",
          },
          {
            kind: "event",
            path: [0],
            eventType: "click",
            expression: innerClick,
          },
        ],
        nestedBoundaries: [],
      }),
    };

    const OuterComponent = vi.fn(() => {
      return document.createElement("section");
    }) as ((ctx: any) => Node) & {
      __hydrationMetadata__?: {
        kind: "generic-plan";
        planFactory: (host: HTMLElement, ctx: any) => GenericHydrationPlan;
      };
    };

    OuterComponent.__hydrationMetadata__ = {
      kind: "generic-plan",
      planFactory: (_host, ctx) => ({
        namespace: "html",
        bindings: [
          {
            kind: "text",
            markerId: 0,
            expression: () => ctx.props.label.value,
          },
        ],
        nestedBoundaries: [
          { path: [0, 1], tagName: innerTag, islandStrategy: "load" },
        ],
      }),
    };

    defineComponent(innerTag, InnerComponent as never);
    defineComponent(outerTag, OuterComponent as never, {
      props: { label: { type: String } },
    });

    const container = document.createElement("div");
    container.innerHTML = `<${outerTag} data-dh-island="visible" label="outer:visible"><template shadowrootmode="open"><section><p><!--dh:t:0-->outer:ssr</p><${innerTag} data-dh-island="load"><template shadowrootmode="open"><button type="button"><!--dh:t:0-->inner:ssr</button></template></${innerTag}></section></template></${outerTag}>`;
    const outer = container.firstElementChild as HTMLElement;

    document.body.appendChild(outer);
    await waitForMicrotask();

    hydrateIslands(document);
    window.dispatchEvent(new Event("load"));
    await waitForMicrotask();

    const innerBeforeOuterHydration = outer.shadowRoot?.querySelector(innerTag);
    expect(innerBeforeOuterHydration).not.toBeNull();
    expect(innerBeforeOuterHydration?.shadowRoot?.textContent).toContain(
      "inner:load:ready",
    );

    const innerButtonBeforeOuterHydration =
      innerBeforeOuterHydration?.shadowRoot?.querySelector("button");
    innerButtonBeforeOuterHydration?.dispatchEvent(new MouseEvent("click"));
    expect(innerClick).toHaveBeenCalledTimes(1);

    const outerHook = Reflect.get(outer, HYDRATE_ISLANDS_HOOK) as
      | ((trigger?: unknown) => boolean)
      | undefined;
    expect(typeof outerHook).toBe("function");
    outerHook?.({ strategy: "visible" });
    await waitForMicrotask();

    const innerAfterOuterHydration = outer.shadowRoot?.querySelector(innerTag);
    expect(innerAfterOuterHydration).toBe(innerBeforeOuterHydration);
    expect(innerAfterOuterHydration?.shadowRoot?.textContent).toContain(
      "inner:load:ready",
    );
    expect(outer.shadowRoot?.textContent).toContain("outer:visible");

    const innerButtonAfterOuterHydration =
      innerAfterOuterHydration?.shadowRoot?.querySelector("button");
    innerButtonAfterOuterHydration?.dispatchEvent(new MouseEvent("click"));
    expect(innerClick).toHaveBeenCalledTimes(2);

    outer.remove();
  });
});
