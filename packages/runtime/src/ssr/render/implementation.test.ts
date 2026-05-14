/**
 * Tests for SSR rendering functionality.
 */

import {
  atom,
  createAtomStore,
  defineAtomStoreSnapshot,
  withStore,
} from "@dathra/store";
import { describe, expect, it } from "vitest";

import {
  MarkerType,
  createMarker,
  renderDynamicAttr,
  renderDynamicEach,
  renderDynamicInsert,
  renderDynamicSpread,
  renderDynamicText,
  renderToString,
  renderTree,
  setComponentRenderer,
} from "@/ssr";
import type { Tree } from "@/types/tree";

describe("SSR Markers", () => {
  it("creates text marker", () => {
    const marker = createMarker(MarkerType.Text, 1);
    expect(marker).toBe("<!--dh:t:1-->");
  });

  it("creates insert marker", () => {
    const marker = createMarker(MarkerType.Insert, 2);
    expect(marker).toBe("<!--dh:i:2-->");
  });

  it("creates block marker", () => {
    const marker = createMarker(MarkerType.Block, 3);
    expect(marker).toBe("<!--dh:b:3-->");
  });
});

describe("SSR Render", () => {
  it("renders simple element", () => {
    const tree: Tree[] = [["div", { class: "container" }, "Hello"]];
    const html = renderTree(tree);
    expect(html).toBe('<div class="container">Hello</div>');
  });

  it("renders nested elements", () => {
    const tree: Tree[] = [["div", null, ["span", null, "Nested"]]];
    const html = renderTree(tree);
    expect(html).toBe("<div><span>Nested</span></div>");
  });

  it("renders void elements correctly", () => {
    const tree: Tree[] = [["input", { type: "text" }]];
    const html = renderTree(tree);
    expect(html).toBe('<input type="text" />');
  });

  it("renders boolean attributes", () => {
    const tree: Tree[] = [["input", { disabled: true, type: "text" }]];
    const html = renderTree(tree);
    expect(html).toContain("disabled");
    expect(html).toContain('type="text"');
  });

  it("skips event handlers in attributes", () => {
    const tree: Tree[] = [["button", { onClick: () => {} }, "Click"]];
    const html = renderTree(tree);
    expect(html).toBe("<button>Click</button>");
    expect(html).not.toContain("onClick");
  });

  it("escapes HTML in text content", () => {
    const tree: Tree[] = [["div", null, "<script>alert('xss')</script>"]];
    const html = renderTree(tree);
    expect(html).toBe("<div>&lt;script&gt;alert('xss')&lt;/script&gt;</div>");
  });

  it("escapes HTML in attribute values", () => {
    const tree: Tree[] = [["div", { title: 'Say "Hello"' }]];
    const html = renderTree(tree);
    expect(html).toBe('<div title="Say &quot;Hello&quot;"></div>');
  });

  it("renders text placeholder with marker", () => {
    const tree: Tree[] = [["div", null, ["{text}", null]]];
    const dynamicValues = new Map<number, unknown>([[1, "Dynamic"]]);
    const html = renderTree(tree, { dynamicValues });
    expect(html).toBe("<div><!--dh:t:1-->Dynamic</div>");
  });

  it("renders insert placeholder with explicit end marker", () => {
    const tree: Tree[] = [["div", null, ["{insert}", null], "tail"]];
    const dynamicValues = new Map<number, unknown>([[1, "Dynamic"]]);
    const html = renderTree(tree, { dynamicValues });

    expect(html).toBe("<div><!--dh:i:1-->Dynamic<!--/dh:i-->tail</div>");
  });

  it("renders each placeholder with block markers", () => {
    const tree: Tree[] = [["ul", null, ["{each}", null]]];
    const items = ["<li>Item 1</li>", "<li>Item 2</li>"];
    const dynamicValues = new Map<number, unknown>([[1, items]]);
    const html = renderTree(tree, { dynamicValues });
    expect(html).toContain("<!--dh:b:1-->");
    expect(html).toContain("<!--/dh:b-->");
  });

  it("renders multiple dynamic values", () => {
    const tree: Tree[] = [
      ["div", null, "Count: ", ["{text}", null], " Items: ", ["{text}", null]],
    ];
    const dynamicValues = new Map<number, unknown>([
      [1, 5],
      [2, 10],
    ]);
    const html = renderTree(tree, { dynamicValues });
    expect(html).toBe(
      "<div>Count: <!--dh:t:1-->5 Items: <!--dh:t:2-->10</div>",
    );
  });

  it("passes request-scoped store to ComponentRenderer through render options", () => {
    const store = createAtomStore({ appId: "runtime-ssr-store" });
    const countAtom = atom("count", 7);
    const tree: Tree[] = [["my-counter", null]];

    const html = renderTree(tree, {
      store,
      componentRenderer: (_tagName, _attrs, options) => {
        return `<div>${options?.store?.ref(countAtom).value}</div>`;
      },
    });

    expect(html).toContain("<div>7</div>");
  });

  it("prefers the active store boundary over the render option store for nested renders", () => {
    const countAtom = atom("count", 0);
    const rootStore = createAtomStore({ appId: "runtime-root-store" });
    const nestedStore = createAtomStore({ appId: "runtime-nested-store" });
    const tree: Tree[] = [["outer-shell", null]];

    rootStore.set(countAtom, 1);
    nestedStore.set(countAtom, 2);

    const html = renderTree(tree, {
      store: rootStore,
      componentRenderer: (tagName) => {
        if (tagName === "outer-shell") {
          return withStore(nestedStore, () =>
            renderTree([["inner-counter", null]], {
              componentRenderer: (_innerTag, _attrs, options) => {
                return `<span>${options?.store?.ref(countAtom).value}</span>`;
              },
            }),
          );
        }

        return null;
      },
    });

    expect(html).toContain("<span>2</span>");
  });

  it("emits a store snapshot script when storeSnapshotSchema is provided", () => {
    const themeAtom = atom("theme", "light");
    const store = createAtomStore({ appId: "runtime-store-script" });
    const schema = defineAtomStoreSnapshot({ uiTheme: themeAtom });
    const tree: Tree[] = [["div", null, "Hello"]];

    store.set(themeAtom, "dark");

    const html = renderTree(tree, {
      store,
      storeSnapshotSchema: schema,
    } as never);

    expect(html).toContain("data-dh-store");
    expect(html).toContain("uiTheme");
    expect(html).toContain("dark");
    expect(html).toContain("<div>Hello</div>");
  });

  it("serializes style objects to CSS strings in SSR output", () => {
    const tree: Tree[] = [
      [
        "div",
        {
          style: {
            paddingTop: "10px",
            borderRadius: "8px",
            display: null,
            opacity: "",
          },
        },
        "Styled",
      ],
    ];
    const html = renderTree(tree);
    expect(html).toContain('style="padding-top: 10px; border-radius: 8px"');
    expect(html).toContain("Styled");
  });

  it("uses global componentRenderer set via setComponentRenderer", () => {
    setComponentRenderer((tagName) => {
      return `<div>rendered by global: ${tagName}</div>`;
    });

    const tree: Tree[] = [["my-widget", null]];
    const html = renderTree(tree);

    expect(html).toContain("rendered by global: my-widget");
    expect(html).toContain("shadowrootmode");

    // Clean up global renderer
    setComponentRenderer(undefined);
  });

  it("throws when storeSnapshotSchema is provided without a store", () => {
    const schema = defineAtomStoreSnapshot({ count: atom("count", 0) });
    const tree: Tree[] = [["div", null, "Hello"]];

    expect(() => {
      renderTree(tree, { storeSnapshotSchema: schema } as never);
    }).toThrow("storeSnapshotSchema requires a store");
  });
});

describe("compiled SSR helpers", () => {
  it("renders dynamic text with HTML escaping", () => {
    expect(renderDynamicText('<script>alert("x")</script>')).toBe(
      "&lt;script&gt;alert(&quot;x&quot;)&lt;/script&gt;",
    );
  });

  it("renders dynamic insert content only for strings", () => {
    expect(renderDynamicInsert("<span>ok</span>")).toBe("<span>ok</span>");
    expect(renderDynamicInsert(42)).toBe("<!--empty-->");
  });

  it("renders dynamic each content by joining string arrays", () => {
    expect(renderDynamicEach(["<li>a</li>", "<li>b</li>"])).toBe(
      "<li>a</li><li>b</li>",
    );
  });

  it("renders dynamic attrs with the same rules as generic attr rendering", () => {
    expect(renderDynamicAttr("disabled", true)).toBe(" disabled");
    expect(renderDynamicAttr("disabled", false)).toBe("");
    expect(
      renderDynamicAttr("style", {
        paddingTop: "10px",
        borderRadius: "8px",
        display: null,
        opacity: "",
      }),
    ).toBe(' style="padding-top: 10px; border-radius: 8px"');
  });

  it("renders dynamic spread while skipping event handlers", () => {
    expect(
      renderDynamicSpread({
        class: "card",
        disabled: true,
        onClick: () => {},
        style: { paddingTop: "10px" },
      }),
    ).toBe(' class="card" disabled style="padding-top: 10px"');
  });
});

describe("SSR renderToString", () => {
  it("renders with state", () => {
    const tree: Tree[] = [["div", null, ["{text}", null]]];
    const state = { count: 5 };
    const dynamicValues = new Map<number, unknown>([[1, 5]]);
    const html = renderToString(tree, state, dynamicValues);

    // Should include state script
    expect(html).toContain("data-dh-state");
    expect(html).toContain("<!--dh:t:1-->");
  });

  it("skips state script when state is empty", () => {
    const tree: Tree[] = [["div", null, "Static"]];
    const html = renderToString(tree);
    expect(html).not.toContain("data-dh-state");
    expect(html).toBe("<div>Static</div>");
  });

  it("accepts a request-scoped store as the fifth argument", () => {
    const store = createAtomStore({ appId: "runtime-render-to-string-store" });
    const countAtom = atom("count", 9);
    const tree: Tree[] = [["my-counter", null]];

    const html = renderToString(
      tree,
      {},
      new Map(),
      (_tagName, _attrs, options) => {
        return `<div>${options?.store?.ref(countAtom).value}</div>`;
      },
      store,
    );

    expect(html).toContain("<div>9</div>");
  });

  it("supports the object overload with storeSnapshotSchema", () => {
    const countAtom = atom("count", 1);
    const store = createAtomStore({
      appId: "runtime-render-to-string-options",
    });
    const schema = defineAtomStoreSnapshot({ count: countAtom });
    const tree: Tree[] = [["div", null, "Static"]];

    store.set(countAtom, 33);

    const html = renderToString(tree, {
      store,
      storeSnapshotSchema: schema,
    } as never);

    expect(html).toContain("data-dh-store");
    expect(html).toContain("count");
    expect(html).toContain("33");
    expect(html).toContain("<div>Static</div>");
  });
});
