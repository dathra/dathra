import { createRoot, signal, templateEffect } from "@/reactivity/index";
import { reconcile } from "@/runtime/index";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

function requireQuery<T extends Element>(
  root: ParentNode,
  selector: string,
): T {
  const element = root.querySelector<T>(selector);
  if (element === null) {
    throw new Error(`Expected element matching selector: ${selector}`);
  }
  return element;
}

// ---------------------------------------------------------------------------
// CSR Integration Tests (TSX)
//
// These tests verify that the CSR pipeline works end-to-end as a system,
// written the way a developer would author components — in TSX.
//
// In production, the Dathra transformer compiles TSX to optimized runtime
// calls (fromTree, setText, templateEffect, etc.). In this test environment,
// the jsx-runtime handles JSX transformation directly, which is functionally
// equivalent for integration testing purposes.
//
// Reactive binding conventions (without the transformer):
//   - Pass a signal as a child       {count}      → reactive text
//   - Pass a signal as a prop value  class={cls}  → reactive attribute
//   - onClick / onFocus etc.                       → event listeners
// ---------------------------------------------------------------------------

// ---------------------------------------------------------------------------
// Helper: reactive list renderer
//
// Simulates the role of a <For> / <List> primitive that the transformer would
// generate. Creates a <ul> whose children are kept in sync with a signal via
// reconcile + templateEffect.
// ---------------------------------------------------------------------------
function createReactiveList<T>(
  itemsSignal: { value: T[] },
  keyFn: (item: T) => unknown,
  renderItem: (item: T) => Node,
): HTMLUListElement {
  const ul = (<ul />) as HTMLUListElement;
  templateEffect(() => {
    reconcile(ul, itemsSignal.value, keyFn, renderItem);
  });
  return ul;
}

describe("CSR integration", () => {
  let container: HTMLDivElement;

  beforeEach(() => {
    container = document.createElement("div");
    document.body.appendChild(container);
  });

  afterEach(() => {
    document.body.removeChild(container);
  });

  // =========================================================================
  // Reactive text rendering
  // =========================================================================
  describe("reactive text rendering", () => {
    it("should render initial text and update when signal changes", () => {
      createRoot(() => {
        const count = signal(0);

        // Passing the signal object directly as a JSX child triggers reactive
        // binding in the jsx-runtime (no getter wrapper needed).
        const p = (<p>Count: {count}</p>) as HTMLParagraphElement;
        container.appendChild(p);

        expect(p.textContent).toBe("Count: 0");

        count.set(5);
        expect(p.textContent).toBe("Count: 5");

        count.set(100);
        expect(p.textContent).toBe("Count: 100");
      });
    });

    it("should update text node when signal changes to an empty string", () => {
      createRoot(() => {
        const value = signal("hello");

        const span = (<span>{value}</span>) as HTMLSpanElement;
        container.appendChild(span);

        expect(span.textContent).toBe("hello");

        value.set("");
        expect(span.textContent).toBe("");

        value.set("world");
        expect(span.textContent).toBe("world");
      });
    });

    it("should handle multiple independent reactive text nodes", () => {
      createRoot(() => {
        const first = signal("John");
        const last = signal("Doe");

        // Both signals are passed as separate JSX children; each gets its own
        // reactive text node binding.
        const p = (
          <p>
            {first} {last}
          </p>
        ) as HTMLParagraphElement;
        container.appendChild(p);

        expect(p.textContent).toBe("John Doe");

        first.set("Jane");
        expect(p.textContent).toBe("Jane Doe");

        last.set("Smith");
        expect(p.textContent).toBe("Jane Smith");
      });
    });
  });

  // =========================================================================
  // Event handling with reactive state
  // =========================================================================
  describe("event handling with reactive state", () => {
    it("should update text when button is clicked", () => {
      createRoot(() => {
        const count = signal(0);

        const el = (
          <div>
            <span>{count}</span>
            <button onClick={() => count.set((v) => v + 1)}>+</button>
          </div>
        ) as HTMLDivElement;
        container.appendChild(el);

        const span = requireQuery<HTMLSpanElement>(el, "span");
        const button = requireQuery<HTMLButtonElement>(el, "button");

        expect(span.textContent).toBe("0");

        button.click();
        expect(span.textContent).toBe("1");

        button.click();
        button.click();
        expect(span.textContent).toBe("3");
      });
    });

    it("should remove event listener when root is disposed", () => {
      const count = signal(0);
      let el!: HTMLDivElement;

      const dispose = createRoot(() => {
        el = (
          <div>
            <span>{count}</span>
            <button onClick={() => count.set((v) => v + 1)}>+</button>
          </div>
        ) as HTMLDivElement;
      });

      container.appendChild(el);
      const span = requireQuery<HTMLSpanElement>(el, "span");
      const button = requireQuery<HTMLButtonElement>(el, "button");

      button.click();
      expect(span.textContent).toBe("1");

      dispose();

      button.click();
      button.click();
      // Handler is removed — count stays at 1
      expect(span.textContent).toBe("1");
    });

    it("should support multiple event types on the same element", () => {
      createRoot(() => {
        const log = signal<string[]>([]);

        const input = (
          <input
            onFocus={() => log.set((prev) => [...prev, "focus"])}
            onBlur={() => log.set((prev) => [...prev, "blur"])}
          />
        ) as HTMLInputElement;
        container.appendChild(input);

        input.dispatchEvent(new FocusEvent("focus"));
        input.dispatchEvent(new FocusEvent("blur"));

        expect(log.peek()).toEqual(["focus", "blur"]);
      });
    });
  });

  // =========================================================================
  // Reactive attributes
  // =========================================================================
  describe("reactive attributes", () => {
    it("should update class attribute when signal changes", () => {
      createRoot(() => {
        const cls = signal("primary");

        // Passing a signal as a prop value → reactive attribute binding
        const div = (<div class={cls}>content</div>) as HTMLDivElement;
        container.appendChild(div);

        expect(div.getAttribute("class")).toBe("primary");

        cls.set("secondary");
        expect(div.getAttribute("class")).toBe("secondary");

        cls.set("active highlighted");
        expect(div.getAttribute("class")).toBe("active highlighted");
      });
    });

    it("should update data attribute when signal value changes", () => {
      createRoot(() => {
        const theme = signal("light");

        const div = (<div data-theme={theme}>content</div>) as HTMLDivElement;
        container.appendChild(div);

        expect(div.getAttribute("data-theme")).toBe("light");

        theme.set("dark");
        expect(div.getAttribute("data-theme")).toBe("dark");

        theme.set("light");
        expect(div.getAttribute("data-theme")).toBe("light");
      });
    });

    it("should update multiple reactive attributes independently", () => {
      createRoot(() => {
        const cls = signal("card");
        const role = signal("article");

        const div = (
          <div class={cls} role={role}>
            content
          </div>
        ) as HTMLDivElement;
        container.appendChild(div);

        expect(div.getAttribute("class")).toBe("card");
        expect(div.getAttribute("role")).toBe("article");

        cls.set("card highlighted");
        expect(div.getAttribute("class")).toBe("card highlighted");
        expect(div.getAttribute("role")).toBe("article");

        role.set("region");
        expect(div.getAttribute("class")).toBe("card highlighted");
        expect(div.getAttribute("role")).toBe("region");
      });
    });
  });

  // =========================================================================
  // Reactive list with reconcile
  // =========================================================================
  describe("reactive list with reconcile", () => {
    it("should render initial list", () => {
      createRoot(() => {
        type Item = { id: number; text: string };
        const items = signal<Item[]>([
          { id: 1, text: "Apple" },
          { id: 2, text: "Banana" },
          { id: 3, text: "Cherry" },
        ]);

        const ul = createReactiveList(
          items,
          (item) => item.id,
          (item) => {
            const li = document.createElement("li");
            li.textContent = item.text;
            return li;
          },
        );
        container.appendChild(ul);

        const lis = ul.querySelectorAll("li");
        expect(lis.length).toBe(3);
        expect(lis[0].textContent).toBe("Apple");
        expect(lis[1].textContent).toBe("Banana");
        expect(lis[2].textContent).toBe("Cherry");
      });
    });

    it("should add items to the list reactively", () => {
      createRoot(() => {
        type Item = { id: number; text: string };
        const items = signal<Item[]>([{ id: 1, text: "Apple" }]);

        const ul = createReactiveList(
          items,
          (item) => item.id,
          (item) => {
            const li = document.createElement("li");
            li.textContent = item.text;
            return li;
          },
        );
        container.appendChild(ul);

        expect(ul.children.length).toBe(1);

        items.set([
          { id: 1, text: "Apple" },
          { id: 2, text: "Banana" },
          { id: 3, text: "Cherry" },
        ]);

        expect(ul.children.length).toBe(3);
        expect(ul.children[2].textContent).toBe("Cherry");
      });
    });

    it("should remove items from the list reactively", () => {
      createRoot(() => {
        type Item = { id: number; text: string };
        const items = signal<Item[]>([
          { id: 1, text: "Apple" },
          { id: 2, text: "Banana" },
          { id: 3, text: "Cherry" },
        ]);

        const ul = createReactiveList(
          items,
          (item) => item.id,
          (item) => {
            const li = document.createElement("li");
            li.textContent = item.text;
            return li;
          },
        );
        container.appendChild(ul);

        expect(ul.children.length).toBe(3);

        items.set([{ id: 2, text: "Banana" }]);

        expect(ul.children.length).toBe(1);
        expect(ul.children[0].textContent).toBe("Banana");
      });
    });

    it("should reuse DOM nodes when reordering (keyed)", () => {
      createRoot(() => {
        type Item = { id: number; text: string };
        const items = signal<Item[]>([
          { id: 1, text: "Apple" },
          { id: 2, text: "Banana" },
          { id: 3, text: "Cherry" },
        ]);

        const ul = createReactiveList(
          items,
          (item) => item.id,
          (item) => {
            const li = document.createElement("li");
            li.textContent = item.text;
            return li;
          },
        );
        container.appendChild(ul);

        const originalNodes = Array.from(ul.children);

        items.set([
          { id: 3, text: "Cherry" },
          { id: 2, text: "Banana" },
          { id: 1, text: "Apple" },
        ]);

        expect(ul.children.length).toBe(3);
        expect(ul.children[0].textContent).toBe("Cherry");
        expect(ul.children[1].textContent).toBe("Banana");
        expect(ul.children[2].textContent).toBe("Apple");
        // DOM nodes should be reused, not recreated
        expect(ul.children[0]).toBe(originalNodes[2]);
        expect(ul.children[1]).toBe(originalNodes[1]);
        expect(ul.children[2]).toBe(originalNodes[0]);
      });
    });
  });

  // =========================================================================
  // Function components
  // =========================================================================
  describe("function components", () => {
    it("should compose a stateful counter component", () => {
      const Counter = () => {
        const count = signal(0);
        return (
          <div>
            <p>{count}</p>
            <button onClick={() => count.set((v) => v - 1)}>-</button>
            <button onClick={() => count.set((v) => v + 1)}>+</button>
          </div>
        ) as Node;
      };

      createRoot(() => {
        const el = (<Counter />) as HTMLElement;
        container.appendChild(el);

        const p = requireQuery<HTMLParagraphElement>(el, "p");
        const [decBtn, incBtn] = el.querySelectorAll("button");

        expect(p.textContent).toBe("0");

        incBtn.click();
        expect(p.textContent).toBe("1");

        incBtn.click();
        expect(p.textContent).toBe("2");

        decBtn.click();
        expect(p.textContent).toBe("1");
      });
    });

    it("should receive and render props", () => {
      const Greeting = ({ name }: { name: string }) =>
        (<p>Hello, {name}!</p>) as Node;

      createRoot(() => {
        const el = (<Greeting name="World" />) as HTMLElement;
        container.appendChild(el);

        expect(el.textContent).toBe("Hello, World!");
      });
    });

    it("should compose multiple components", () => {
      const Badge = ({ label }: { label: string }) =>
        (<span class="badge">{label}</span>) as Node;

      const Card = ({ title }: { title: string }) =>
        (
          <div class="card">
            <Badge label={title} />
          </div>
        ) as Node;

      createRoot(() => {
        const el = (<Card title="Featured" />) as HTMLElement;
        container.appendChild(el);

        expect(requireQuery<HTMLElement>(el, ".badge").textContent).toBe(
          "Featured",
        );
      });
    });
  });

  // =========================================================================
  // Full application
  // =========================================================================
  describe("full application", () => {
    it("should compose a counter with reactive display and dispose", () => {
      const count = signal(0);
      let el!: HTMLElement;

      const dispose = createRoot(() => {
        el = (
          <div>
            <p>{count}</p>
            <button onClick={() => count.set((v) => v - 1)}>-</button>
            <button onClick={() => count.set((v) => v + 1)}>+</button>
          </div>
        ) as HTMLElement;
      });

      container.appendChild(el);
      const p = requireQuery<HTMLParagraphElement>(el, "p");
      const [decBtn, incBtn] = el.querySelectorAll("button");

      expect(p.textContent).toBe("0");

      incBtn.click();
      expect(p.textContent).toBe("1");

      decBtn.click();
      expect(p.textContent).toBe("0");

      dispose();

      // After dispose: events unregistered, effects stopped
      incBtn.click();
      incBtn.click();
      expect(count.peek()).toBe(0);
      expect(p.textContent).toBe("0");
    });

    it("should compose a counter with a reactive action history list", () => {
      createRoot(() => {
        type Entry = { id: number; label: string };
        const count = signal(0);
        const history = signal<Entry[]>([]);
        let nextId = 0;

        const increment = () => {
          count.set((v) => v + 1);
          history.set((h) => [
            ...h,
            { id: nextId++, label: `increment → ${count.peek()}` },
          ]);
        };

        const ul = createReactiveList(
          history,
          (entry) => entry.id,
          (entry) => {
            const li = document.createElement("li");
            li.textContent = entry.label;
            return li;
          },
        );

        const el = (
          <div>
            <p>{count}</p>
            <button onClick={increment}>+</button>
          </div>
        ) as HTMLElement;

        el.appendChild(ul);
        container.appendChild(el);

        const p = requireQuery<HTMLParagraphElement>(el, "p");
        const button = requireQuery<HTMLButtonElement>(el, "button");

        expect(p.textContent).toBe("0");
        expect(ul.children.length).toBe(0);

        button.click();
        expect(p.textContent).toBe("1");
        expect(ul.children.length).toBe(1);
        expect(ul.children[0].textContent).toBe("increment → 1");

        button.click();
        expect(p.textContent).toBe("2");
        expect(ul.children.length).toBe(2);
        expect(ul.children[1].textContent).toBe("increment → 2");
      });
    });

    it("should render multiple independent component instances", () => {
      const Counter = ({ label }: { label: string }) => {
        const count = signal(0);
        return (
          <div>
            <span class="label">{label}</span>
            <span class="count">{count}</span>
            <button onClick={() => count.set((v) => v + 1)}>+</button>
          </div>
        ) as Node;
      };

      createRoot(() => {
        const a = (<Counter label="A" />) as HTMLElement;
        const b = (<Counter label="B" />) as HTMLElement;
        container.appendChild(a);
        container.appendChild(b);

        const btnA = requireQuery<HTMLButtonElement>(a, "button");
        const btnB = requireQuery<HTMLButtonElement>(b, "button");
        const countA = requireQuery<HTMLElement>(a, ".count");
        const countB = requireQuery<HTMLElement>(b, ".count");

        btnA.click();
        btnA.click();
        btnB.click();

        // Each instance maintains its own independent state
        expect(countA.textContent).toBe("2");
        expect(countB.textContent).toBe("1");
      });
    });
  });
});
