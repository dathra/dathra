import {
  atom,
  createAtomStore,
  defineAtomStoreSnapshot,
  withStore,
} from "@dathra/store";
import { beforeEach, describe, expect, it, vi } from "vitest";

import type {
  ComponentClass,
  ComponentContext,
} from "@/defineComponent/implementation";
import { adoptGlobalStyles, clearGlobalStyles } from "@/css/implementation";
import { defineComponent } from "@/defineComponent/implementation";
import { clearRegistry, registerComponent } from "@/registry/implementation";
import {
  _resetRendererState,
  createComponentRenderer,
  ensureComponentRenderer,
  renderDSD,
  renderDSDContent,
} from "./implementation";
import { renderToString } from "@dathra/runtime/ssr";

describe("ssr", () => {
  beforeEach(() => {
    clearRegistry();
    _resetRendererState();
    clearGlobalStyles();
  });

  describe("renderDSD", () => {
    it("should render complete custom element with DSD", () => {
      const setup = () => "<div>Hello World</div>";
      registerComponent("test-element", setup, []);

      const html = renderDSD("test-element", {});

      expect(html).toContain("<test-element");
      expect(html).toContain('<template shadowrootmode="open">');
      expect(html).toContain("<div>Hello World</div>");
      expect(html).toContain("</template>");
      expect(html).toContain("</test-element>");
    });

    it("should accept Component Class as first argument", () => {
      const setup = () => "<div>Component Class Test</div>";
      registerComponent("class-test", setup, []);

      const ComponentClass = {
        __tagName__: "class-test",
      } as ComponentClass;

      const html = renderDSD(ComponentClass, {});

      expect(html).toContain("<class-test");
      expect(html).toContain("<div>Component Class Test</div>");
    });

    it("should accept a defineComponent return value as first argument", () => {
      const Comp = defineComponent("defined-component-test", () => {
        return "<div>Defined Component Test</div>";
      });

      registerComponent(
        Comp.__tagName__,
        () => "<div>Defined Component Test</div>",
        [],
      );

      const html = renderDSD(Comp, {});

      expect(html).toContain("<defined-component-test");
      expect(html).toContain("<div>Defined Component Test</div>");
    });

    it("should accept tag name string as first argument (legacy)", () => {
      const setup = () => "<div>String Test</div>";
      registerComponent("string-test", setup, []);

      const html = renderDSD("string-test", {});

      expect(html).toContain("<string-test");
      expect(html).toContain("<div>String Test</div>");
    });

    it("should escape attribute values", () => {
      const setup = () => "<div>Escape Test</div>";
      registerComponent("escape-test", setup, []);

      const html = renderDSD("escape-test", {
        value: '<script>alert("xss")</script>',
        quote: 'test"value"here',
      });

      expect(html).toContain(
        'value="&lt;script&gt;alert(&quot;xss&quot;)&lt;/script&gt;"',
      );
      expect(html).toContain('quote="test&quot;value&quot;here"');
    });

    // Test case #8 (補完): & alone is also escaped
    it("should escape & alone in attribute values", () => {
      const setup = () => "<div>Ampersand Test</div>";
      registerComponent("amp-test", setup, []);

      const html = renderDSD("amp-test", { value: "a&b" });

      expect(html).toContain('value="a&amp;b"');
    });

    it("should include CSS as <style> tags", () => {
      const setup = () => "<div>Styled</div>";
      const cssTexts = [":host { display: block; }", "div { color: red; }"];
      registerComponent("styled-element", setup, cssTexts);

      const html = renderDSD("styled-element", {});

      expect(html).toContain("<style>:host { display: block; }</style>");
      expect(html).toContain("<style>div { color: red; }</style>");
    });

    it("should render adopted global styles before component local styles", () => {
      adoptGlobalStyles(":host { color: seagreen; }");
      registerComponent("global-style-order", () => "<div>Order</div>", [
        ":host { display: block; }",
      ]);

      const html = renderDSD("global-style-order", {});
      const globalIndex = html.indexOf(
        "<style>:host { color: seagreen; }</style>",
      );
      const localIndex = html.indexOf(
        "<style>:host { display: block; }</style>",
      );

      expect(globalIndex).toBeGreaterThanOrEqual(0);
      expect(localIndex).toBeGreaterThan(globalIndex);
    });

    it("should dedupe duplicate global and local css texts in SSR output", () => {
      adoptGlobalStyles(":host { color: seagreen; }");
      registerComponent("global-style-dedupe", () => "<div>Dedupe</div>", [
        ":host { color: seagreen; }",
        ":host { display: block; }",
      ]);

      const html = renderDSD("global-style-dedupe", {});

      expect(
        html.match(/<style>:host \{ color: seagreen; \}<\/style>/g),
      ).toHaveLength(1);
      expect(html).toContain("<style>:host { display: block; }</style>");
    });

    it("should render native CSSStyleSheet global styles in SSR output", () => {
      const globalSheet = new CSSStyleSheet();
      globalSheet.replaceSync(":host { color: olive; }");

      adoptGlobalStyles(globalSheet);
      registerComponent("native-global-style", () => "<div>Native</div>", []);

      const html = renderDSD("native-global-style", {});

      expect(html).toContain("<style>:host { color: olive; }</style>");
    });

    it("should throw error for unregistered component", () => {
      expect(() => {
        renderDSD("non-existent", {});
      }).toThrow('Component "non-existent" is not registered');
    });

    it("should handle empty attributes", () => {
      const setup = () => "<div>No Attrs</div>";
      registerComponent("no-attrs", setup, []);

      const html = renderDSD("no-attrs", {});

      expect(html).toBe(
        '<no-attrs><template shadowrootmode="open"><div>No Attrs</div></template></no-attrs>',
      );
    });

    it("should handle multiple attributes", () => {
      const setup = () => "<div>Multi Attrs</div>";
      registerComponent("multi-attrs", setup, [], {
        name: { type: String },
        value: { type: String },
        disabled: { type: String },
      });

      const html = renderDSD("multi-attrs", {
        name: "test",
        value: "123",
        disabled: "true",
      });

      expect(html).toContain('name="test"');
      expect(html).toContain('value="123"');
      expect(html).toContain('disabled="true"');
    });

    it("should include a data-dh-store script when storeSnapshotSchema is provided", () => {
      const themeAtom = atom("theme", "light");
      const store = createAtomStore({ appId: "ssr-dsd-store-script" });
      const schema = defineAtomStoreSnapshot({ uiTheme: themeAtom });

      store.set(themeAtom, "dark");
      registerComponent("snapshot-element", () => "<div>Snapshot</div>", []);

      const html = renderDSD("snapshot-element", {}, {
        store,
        storeSnapshotSchema: schema,
      } as never);

      expect(html).toContain("data-dh-store");
      expect(html).toContain("uiTheme");
      expect(html).toContain("dark");
    });

    it("should throw when storeSnapshotSchema is provided without a store", () => {
      const schema = defineAtomStoreSnapshot({ count: atom("count", 0) });
      registerComponent("snapshot-error-element", () => "<div>Error</div>", []);

      expect(() => {
        renderDSD("snapshot-error-element", {}, {
          storeSnapshotSchema: schema,
        } as never);
      }).toThrow("storeSnapshotSchema requires a store");
    });

    it("should preserve hydration metadata in registry registrations used by DSD rendering", () => {
      const planFactory = () => ({ bindings: [], nestedBoundaries: [] });

      registerComponent(
        "hydration-meta-template",
        () => "<div>Hydration Meta</div>",
        [],
        undefined,
        {
          kind: "generic-plan",
          planFactory,
        },
      );

      const html = renderDSDContent("hydration-meta-template", {});

      expect(html).toContain("Hydration Meta");
    });
  });

  describe("renderDSDContent", () => {
    it("should render DSD template only", () => {
      const setup = () => "<div>Template Only</div>";
      registerComponent("template-test", setup, []);

      const html = renderDSDContent("template-test", {});

      expect(html).toBe(
        '<template shadowrootmode="open"><div>Template Only</div></template>',
      );
      expect(html).not.toContain("<template-test");
    });

    it("should accept Component Class", () => {
      const setup = () => "<div>Class Template</div>";
      registerComponent("class-template", setup, []);

      const ComponentClass = {
        __tagName__: "class-template",
      } as ComponentClass;

      const html = renderDSDContent(ComponentClass, {});

      expect(html).toContain('<template shadowrootmode="open">');
      expect(html).toContain("<div>Class Template</div>");
    });

    it("should accept a defineComponent return value", () => {
      const Comp = defineComponent("defined-template-test", () => {
        return "<div>Defined Template</div>";
      });

      registerComponent(
        Comp.__tagName__,
        () => "<div>Defined Template</div>",
        [],
      );

      const html = renderDSDContent(Comp, {});

      expect(html).toContain('<template shadowrootmode="open">');
      expect(html).toContain("<div>Defined Template</div>");
    });

    it("should include CSS in template", () => {
      const setup = () => "<div>Styled Template</div>";
      const cssTexts = [":host { padding: 10px; }"];
      registerComponent("template-styled", setup, cssTexts);

      const html = renderDSDContent("template-styled", {});

      expect(html).toContain("<style>:host { padding: 10px; }</style>");
      expect(html).toContain("<div>Styled Template</div>");
    });

    it("should provide ctx.store when a store option is passed", () => {
      const countAtom = atom("count", 4);
      const store = createAtomStore({ appId: "ssr-dsd-content-store" });

      registerComponent(
        "template-store-test",
        (_host, ctx) => `<div>${ctx.store.ref(countAtom).value}</div>`,
        [],
      );

      const html = renderDSDContent("template-store-test", {}, { store });

      expect(html).toContain("<div>4</div>");
    });

    it("should provide ctx.store from an active withStore boundary when no store option is passed", () => {
      const countAtom = atom("count", 6);
      const store = createAtomStore({ appId: "ssr-active-store" });

      registerComponent(
        "active-store-test",
        (_host, ctx) => `<div>${ctx.store.ref(countAtom).value}</div>`,
        [],
      );

      const html = withStore(store, () =>
        renderDSDContent("active-store-test", {}),
      );

      expect(html).toContain("<div>6</div>");
    });

    it("should prefer an explicit store option over an active withStore boundary", () => {
      const countAtom = atom("count", 0);
      const explicitStore = createAtomStore({ appId: "ssr-explicit-store" });
      const activeStore = createAtomStore({ appId: "ssr-active-override" });

      explicitStore.set(countAtom, 11);
      activeStore.set(countAtom, 22);

      registerComponent(
        "explicit-store-test",
        (_host, ctx) => `<div>${ctx.store.ref(countAtom).value}</div>`,
        [],
      );

      const html = withStore(activeStore, () =>
        renderDSDContent("explicit-store-test", {}, { store: explicitStore }),
      );

      expect(html).toContain("<div>11</div>");
    });

    it("should include a data-dh-store script inside the template when schema is provided", () => {
      const countAtom = atom("count", 2);
      const store = createAtomStore({ appId: "ssr-template-store-script" });
      const schema = defineAtomStoreSnapshot({ count: countAtom });

      store.set(countAtom, 10);
      registerComponent(
        "template-snapshot-test",
        () => "<div>Template Snapshot</div>",
        [],
      );

      const html = renderDSDContent("template-snapshot-test", {}, {
        store,
        storeSnapshotSchema: schema,
      } as never);

      expect(html).toContain('<script type="application/json" data-dh-store>');
      expect(html).toContain("count");
      expect(html).toContain("10");
      expect(html).toContain("<div>Template Snapshot</div>");
    });

    it("should throw when renderDSDContent uses storeSnapshotSchema without store", () => {
      const schema = defineAtomStoreSnapshot({ count: atom("count", 0) });
      registerComponent(
        "template-snapshot-error",
        () => "<div>Error</div>",
        [],
      );

      expect(() => {
        renderDSDContent("template-snapshot-error", {}, {
          storeSnapshotSchema: schema,
        } as never);
      }).toThrow("storeSnapshotSchema requires a store");
    });

    it("should throw error for unregistered component", () => {
      expect(() => {
        renderDSDContent("non-existent", {});
      }).toThrow('Component "non-existent" is not registered');
    });

    it("should render adopted global styles before local styles in template output", () => {
      adoptGlobalStyles(":host { color: seagreen; }");
      registerComponent(
        "template-global-style-order",
        () => "<div>Order</div>",
        [":host { display: block; }"],
      );

      const html = renderDSDContent("template-global-style-order", {});
      const globalIndex = html.indexOf(
        "<style>:host { color: seagreen; }</style>",
      );
      const localIndex = html.indexOf(
        "<style>:host { display: block; }</style>",
      );

      expect(globalIndex).toBeGreaterThanOrEqual(0);
      expect(localIndex).toBeGreaterThan(globalIndex);
    });

    it("should dedupe duplicate global and local css texts in template output", () => {
      adoptGlobalStyles(":host { color: seagreen; }");
      registerComponent(
        "template-global-style-dedupe",
        () => "<div>Dedupe</div>",
        [":host { color: seagreen; }"],
      );

      const html = renderDSDContent("template-global-style-dedupe", {});

      expect(
        html.match(/<style>:host \{ color: seagreen; \}<\/style>/g),
      ).toHaveLength(1);
    });
  });

  describe("ensureComponentRenderer", () => {
    it("should be idempotent", () => {
      // Call multiple times
      ensureComponentRenderer();
      ensureComponentRenderer();
      ensureComponentRenderer();

      // Should not throw
      expect(true).toBe(true);
    });

    it("should set up ComponentRenderer", () => {
      const setup = () => "<div>Renderer Test</div>";
      registerComponent("renderer-test", setup, []);

      ensureComponentRenderer();

      // renderDSD should work after setup
      const html = renderDSD("renderer-test", {});
      expect(html).toContain("<div>Renderer Test</div>");
    });

    it("should clear the runtime component renderer on reset", () => {
      registerComponent("runtime-reset-test", () => "<div>Reset</div>", []);

      ensureComponentRenderer();
      expect(renderToString([["runtime-reset-test", null]])).toContain(
        "<div>Reset</div>",
      );

      _resetRendererState();

      expect(renderToString([["runtime-reset-test", null]])).toBe(
        "<runtime-reset-test></runtime-reset-test>",
      );
    });
  });

  describe("createComponentRenderer", () => {
    it("returns null for unregistered components", () => {
      const renderer = createComponentRenderer();

      expect(renderer("missing-element", {})).toBeNull();
    });
  });

  describe("props signal handling", () => {
    it("should pass props to setup function with type coercion", () => {
      const setupSpy = vi.fn(() => "<div>Props Test</div>");
      registerComponent("props-component", setupSpy, [], {
        name: { type: String },
        count: { type: Number },
      });

      renderDSD("props-component", { name: "test", count: "123" });

      expect(setupSpy).toHaveBeenCalled();
      const [, ctx] = setupSpy.mock.calls[0] as unknown as [
        HTMLElement,
        ComponentContext,
      ];
      expect(ctx.props.name.value).toBe("test");
      expect(ctx.props.count.value).toBe(123);
      expect(ctx.host).toBeDefined();
    });

    it("should handle missing attributes with defaults", () => {
      const setupSpy = vi.fn(() => "<div>Default Test</div>");
      registerComponent("default-props", setupSpy, [], {
        name: { type: String, default: "World" },
        count: { type: Number },
      });

      renderDSD("default-props", { name: "test" });

      const [, ctx] = setupSpy.mock.calls[0] as unknown as [
        HTMLElement,
        ComponentContext,
      ];
      expect(ctx.props.name.value).toBe("test");
      expect(ctx.props.count.value).toBe(0);
    });

    // Test case #13: Number type prop with null attr uses default value (not Number(null) = 0)
    it("should use default value for Number prop when attribute is absent", () => {
      const setupSpy = vi.fn(() => "<div>Number Default Test</div>");
      registerComponent("number-default-test", setupSpy, [], {
        count: { type: Number, default: 42 },
      });

      // Do not pass 'count' attribute
      renderDSD("number-default-test", {});

      const [, ctx] = setupSpy.mock.calls[0] as unknown as [
        HTMLElement,
        ComponentContext,
      ];
      // Should use default value 42, not Number(null) = 0
      expect(ctx.props.count.value).toBe(42);
    });

    // Test case #14: String type prop with null attr uses default value (not null)
    it("should use default value for String prop when attribute is absent", () => {
      const setupSpy = vi.fn(() => "<div>String Default Test</div>");
      registerComponent("string-default-test", setupSpy, [], {
        name: { type: String, default: "hello" },
      });

      // Do not pass 'name' attribute
      renderDSD("string-default-test", {});

      const [, ctx] = setupSpy.mock.calls[0] as unknown as [
        HTMLElement,
        ComponentContext,
      ];
      // Should use default value "hello", not null
      expect(ctx.props.name.value).toBe("hello");
    });

    it("should handle boolean type coercion", () => {
      const setupSpy = vi.fn(() => "<div>Boolean Test</div>");
      registerComponent("bool-test", setupSpy, [], {
        enabled: { type: Boolean },
        disabled: { type: Boolean },
      });

      renderDSD("bool-test", { enabled: "true" });

      const [, ctx] = setupSpy.mock.calls[0] as unknown as [
        HTMLElement,
        ComponentContext,
      ];
      expect(ctx.props.enabled.value).toBe(true);
      expect(ctx.props.disabled.value).toBe(false);
    });

    it("should provide ctx.store when SSR store option is passed", () => {
      const countAtom = atom("count", 3);
      const store = createAtomStore({ appId: "ssr-store" });

      registerComponent(
        "store-supported",
        (_host, ctx) => {
          return `<div>${ctx.store.ref(countAtom).value}</div>`;
        },
        [],
      );

      const html = renderDSD("store-supported", {}, { store });

      expect(html).toContain("<div>3</div>");
    });

    it("should throw when SSR setup accesses ctx.store without a store option", () => {
      registerComponent(
        "store-unsupported",
        (_host, ctx) => {
          void ctx.store;
          return "<div>Store</div>";
        },
        [],
      );

      expect(() => renderDSD("store-unsupported", {})).toThrow(
        "SSR component context does not provide a store yet",
      );
    });
  });

  describe("edge cases", () => {
    it("should handle component with no CSS", () => {
      const setup = () => "<div>No CSS</div>";
      registerComponent("no-css", setup, []);

      const html = renderDSD("no-css", {});

      expect(html).not.toContain("<style>");
      expect(html).toContain("<div>No CSS</div>");
    });

    it("should handle empty setup return value", () => {
      const setup = () => "";
      registerComponent("empty-setup", setup, []);

      const html = renderDSD("empty-setup", {});

      expect(html).toBe(
        '<empty-setup><template shadowrootmode="open"></template></empty-setup>',
      );
    });

    it("should handle special characters in CSS", () => {
      const setup = () => "<div>Special CSS</div>";
      const cssTexts = [":host::before { content: '<>'; }"];
      registerComponent("special-css", setup, cssTexts);

      const html = renderDSD("special-css", {});

      expect(html).toContain("<style>:host::before { content: '<>'; }</style>");
    });
  });
});
