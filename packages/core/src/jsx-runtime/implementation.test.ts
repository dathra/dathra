import { createRoot, signal } from "@dathra/reactivity";
import { describe, expect, it, vi } from "vitest";

import { atom, createAtomStore, defineComponent, withStore } from "../index";
import { Fragment } from "./Fragment";
import { jsx, jsxs } from "./index";

async function waitForMicrotask(): Promise<void> {
  await new Promise<void>((resolve) => queueMicrotask(resolve));
}

let tagCounter = 0;
function uniqueTag(): string {
  return `core-test-el-${++tagCounter}-${Date.now()}`;
}

describe("jsx / createElement", () => {
  describe("basic element creation", () => {
    it("should create a DOM element with the given tag", () => {
      const el = jsx("div", null) as HTMLElement;
      expect(el.tagName.toLowerCase()).toBe("div");
    });

    it("should create a span element", () => {
      const el = jsx("span", null) as HTMLElement;
      expect(el.tagName.toLowerCase()).toBe("span");
    });

    it("should create element with static attributes", () => {
      const el = jsx("div", { class: "container", id: "main" }) as HTMLElement;
      expect(el.getAttribute("class")).toBe("container");
      expect(el.getAttribute("id")).toBe("main");
    });

    it("should create element with static text child", () => {
      const el = jsx("p", { children: "Hello" }) as HTMLElement;
      expect(el.textContent).toContain("Hello");
    });

    it("should create element with multiple text children (jsxs)", () => {
      const el = jsxs("p", {
        children: ["Hello", " ", "World"],
      }) as HTMLElement;
      expect(el.textContent).toContain("Hello");
      expect(el.textContent).toContain("World");
    });

    it("should ignore null, undefined, boolean children", () => {
      const el = jsxs("div", {
        children: [null, undefined, false, true, "visible"],
      }) as HTMLElement;
      expect(el.textContent).toContain("visible");
      // Booleans and null/undefined should not appear as text
      expect(el.textContent).not.toContain("null");
      expect(el.textContent).not.toContain("undefined");
      expect(el.textContent).not.toContain("false");
      expect(el.textContent).not.toContain("true");
    });

    it("should handle numeric children", () => {
      const el = jsx("span", { children: 42 }) as HTMLElement;
      expect(el.textContent).toContain("42");
    });

    it("should append child Node elements", () => {
      const child = document.createElement("span");
      child.textContent = "child";
      const el = jsx("div", { children: child }) as HTMLElement;
      expect(el.querySelector("span")).not.toBeNull();
      expect(el.querySelector("span")?.textContent).toBe("child");
    });
  });

  describe("function components", () => {
    it("should call function components with props", () => {
      const MyComponent = (props: { message: string }) => {
        return jsx("div", { children: props.message });
      };
      const el = jsx(MyComponent as (props: Record<string, unknown>) => Node, {
        message: "hello",
      }) as HTMLElement;
      expect(el.textContent).toContain("hello");
    });

    it("should call function components with empty props when null", () => {
      const MyComponent = (props: Record<string, unknown>) => {
        return jsx("div", {
          children: String(Object.keys(props).length),
        });
      };
      const el = jsx(MyComponent, null) as HTMLElement;
      expect(el.textContent).toContain("0");
    });

    it("supports withStore around plain function components", () => {
      const countAtom = atom("count", 2);
      const store = createAtomStore({ appId: "core-function-store" });

      const MyComponent = () => {
        return jsx("div", { children: store.ref(countAtom).value });
      };

      const el = withStore(store, () => jsx(MyComponent, null)) as HTMLElement;

      expect(el.textContent).toBe("2");
    });

    it("supports withStore around JSX-created custom elements", async () => {
      const tag = uniqueTag();
      const countAtom = atom("count", 2);
      const store = createAtomStore({ appId: `core-${tag}` });

      defineComponent(tag, ({ store: ctxStore }) => {
        return document.createTextNode(String(ctxStore.ref(countAtom).value));
      });

      const el = withStore(store, () => jsx(tag, null)) as HTMLElement;
      document.body.appendChild(el);
      await waitForMicrotask();

      expect(el.shadowRoot?.textContent).toBe("2");

      el.remove();
    });

    it("propagates store to nested custom elements inside a JSX subtree", async () => {
      const tag = uniqueTag();
      const themeAtom = atom("theme", "dark");
      const store = createAtomStore({ appId: `core-nested-${tag}` });

      defineComponent(tag, ({ store: ctxStore }) => {
        return document.createTextNode(ctxStore.ref(themeAtom).value);
      });

      const root = withStore(store, () => {
        return jsxs("section", {
          children: [jsx("div", { children: "before" }), jsx(tag, null)],
        });
      }) as HTMLElement;

      document.body.appendChild(root);
      await waitForMicrotask();

      const nested = root.querySelector(tag);
      expect(nested?.shadowRoot?.textContent).toBe("dark");

      root.remove();
    });
  });

  describe("event handlers", () => {
    it("should attach event listeners", () => {
      const handler = vi.fn();
      const el = jsx("button", { onClick: handler }) as HTMLElement;
      el.click();
      expect(handler).toHaveBeenCalledOnce();
    });

    it("should NOT attach non-function event handler values", () => {
      // Non-function values for event-like keys should be silently ignored
      const el = jsx("button", { onClick: "not-a-function" }) as HTMLElement;
      // No TypeError should be thrown when clicking
      expect(() => el.click()).not.toThrow();
    });

    it("should handle multiple event handlers", () => {
      const clickHandler = vi.fn();
      const mouseoverHandler = vi.fn();
      const el = jsx("div", {
        onClick: clickHandler,
        onMouseover: mouseoverHandler,
      }) as HTMLElement;
      el.click();
      expect(clickHandler).toHaveBeenCalledOnce();
    });

    it("should convert camelCase event names to lowercase", () => {
      const handler = vi.fn();
      const el = jsx("button", { onClick: handler }) as HTMLElement;
      el.dispatchEvent(new MouseEvent("click"));
      expect(handler).toHaveBeenCalled();
    });
  });

  describe("reactive text children (getter functions)", () => {
    it("should support getter functions as reactive text children", () => {
      const count = 0;
      const getter = () => count;
      const el = jsx("span", { children: getter }) as HTMLElement;
      // Initial render
      expect(el.textContent).toContain("0");
    });
  });

  describe("reactive attributes", () => {
    it("should bind reactive values to attributes", () => {
      const cls = { value: "active" };
      const el = jsx("div", { class: cls }) as HTMLElement;
      expect(el.getAttribute("class")).toBe("active");
    });

    it("should update class attribute when reactive value changes", () => {
      createRoot(() => {
        const cls = signal("initial");
        const el = jsx("div", { class: cls }) as HTMLElement;
        expect(el.getAttribute("class")).toBe("initial");
        cls.set("updated");
        expect(el.getAttribute("class")).toBe("updated");
      });
    });
  });
});

describe("Fragment", () => {
  it("should create a DocumentFragment", () => {
    const frag = Fragment({ children: "text" });
    expect(frag).toBeInstanceOf(DocumentFragment);
  });

  it("should render string children", () => {
    const div = document.createElement("div");
    const frag = Fragment({ children: "hello" });
    div.appendChild(frag);
    expect(div.textContent).toBe("hello");
  });

  it("should render multiple string children", () => {
    const div = document.createElement("div");
    const frag = Fragment({ children: ["hello", " ", "world"] });
    div.appendChild(frag);
    expect(div.textContent).toBe("hello world");
  });

  it("should render numeric children", () => {
    const div = document.createElement("div");
    const frag = Fragment({ children: 42 });
    div.appendChild(frag);
    expect(div.textContent).toBe("42");
  });

  it("should ignore null, undefined, boolean children", () => {
    const div = document.createElement("div");
    const frag = Fragment({ children: [null, undefined, false, "visible"] });
    div.appendChild(frag);
    expect(div.textContent).toBe("visible");
  });

  it("should render Node children directly", () => {
    const span = document.createElement("span");
    span.textContent = "child";
    const div = document.createElement("div");
    const frag = Fragment({ children: span });
    div.appendChild(frag);
    expect(div.querySelector("span")?.textContent).toBe("child");
  });

  it("should render empty fragment when no children", () => {
    const frag = Fragment({});
    expect(frag.childNodes.length).toBe(0);
  });

  it("should treat function children as reactive getters", () => {
    createRoot(() => {
      const count = signal(0);
      const div = document.createElement("div");
      const frag = Fragment({ children: () => count.value });
      div.appendChild(frag);
      // Initial value
      expect(div.textContent).toBe("0");
      // Update signal - text node should update
      count.set(5);
      expect(div.textContent).toBe("5");
    });
  });
});
