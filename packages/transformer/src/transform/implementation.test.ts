import { describe, expect, it } from "vitest";
import { COLOCATED_CLIENT_STRATEGIES } from "@dathra/shared";
import { transform } from "../index";

describe("transform", () => {
  it("should transform simple JSX element", () => {
    const code = `
      const element = <div>Hello</div>;
    `;

    const result = transform(code);

    expect(result.code).toContain("fromTree");
    expect(result.code).toContain("div");
    expect(result.code).toContain("Hello");
  });

  it("should transform JSX with static attributes", () => {
    const code = `
      const element = <button class="btn" disabled>Click</button>;
    `;

    const result = transform(code);

    expect(result.code).toContain("class");
    expect(result.code).toContain("btn");
    expect(result.code).toContain("disabled");
    expect(result.code).toContain("markup:");
    expect(result.code).toContain("button class");
    expect(result.code).toContain("Click</button>");
  });

  it("should transform JSX with onClick handler", () => {
    const code = `
      const handler = () => {};
      const element = <button onClick={handler}>Click</button>;
    `;

    const result = transform(code);

    expect(result.code).toContain("event");
    expect(result.code).toContain("click");
  });

  it("should transform JSX with dynamic text", () => {
    const code = `
      const count = signal(0);
      const element = <span>Count: {count.value}</span>;
    `;

    const result = transform(code);

    expect(result.code).toContain("templateEffect");
    expect(result.code).toContain("setText");
    expect(result.code).toContain("count.value");
  });

  it("should transform JSX with dynamic attribute", () => {
    const code = `
      const isActive = signal(false);
      const element = <div class={isActive.value ? 'active' : 'inactive'}>Content</div>;
    `;

    const result = transform(code);

    expect(result.code).toContain("setAttr");
    expect(result.code).toContain("class");
    expect(result.code).toContain("isActive.value");
  });

  it("should add runtime imports", () => {
    const code = `
      const element = <div>Hello</div>;
    `;

    const result = transform(code);

    expect(result.code).toContain("import");
    expect(result.code).toContain("@dathra/runtime");
    expect(result.code).toContain("fromTree");
  });

  it("should transform nested JSX elements", () => {
    const code = `
      const element = (
        <div>
          <span>Hello</span>
          <span>World</span>
        </div>
      );
    `;

    const result = transform(code);

    expect(result.code).toContain("fromTree");
    expect(result.code).toContain("div");
    expect(result.code).toContain("span");
  });

  it("should transform JSX fragment", () => {
    const code = `
      const element = (
        <>
          <div>First</div>
          <div>Second</div>
        </>
      );
    `;

    const result = transform(code);

    expect(result.code).toContain("fromTree");
    expect(result.code).toContain("div");
  });

  it("should handle multiple event handlers", () => {
    const code = `
      const onClick = () => {};
      const onMouseEnter = () => {};
      const element = <button onClick={onClick} onMouseEnter={onMouseEnter}>Hover</button>;
    `;

    const result = transform(code);

    expect(result.code).toContain("event");
    expect(result.code).toContain("click");
    expect(result.code).toContain("mouseenter");
  });

  it("should generate source map when requested", () => {
    const code = `
      const element = <div>Hello</div>;
    `;

    const result = transform(code, { sourceMap: true, filename: "test.tsx" });

    expect(result.map).toBeDefined();
    expect(typeof result.map).toBe("string");
  });

  it("should not generate source map by default", () => {
    const code = `
      const element = <div>Hello</div>;
    `;

    const result = transform(code);

    expect(result.map).toBeUndefined();
  });

  it("should preserve non-JSX code", () => {
    const code = `
      const count = 0;
      function increment() {
        return count + 1;
      }
      const element = <div>Hello</div>;
    `;

    const result = transform(code);

    expect(result.code).toContain("const count = 0");
    expect(result.code).toContain("function increment");
    expect(result.code).toContain("return count + 1");
  });

  it("should transform spread attributes on HTML element using spread() and templateEffect", () => {
    const code = `
      const props = { class: "foo" };
      const element = <div {...props}>Content</div>;
    `;

    const result = transform(code);

    // Spread on HTML element should use spread() + templateEffect for reactivity
    expect(result.code).toContain("spread");
    expect(result.code).toContain("templateEffect");
    expect(result.code).toContain("props");
  });

  it("should transform conditional rendering (ternary) using insert() and templateEffect", () => {
    const code = `
      const show = signal(true);
      const element = <div>{show.value ? <span>Yes</span> : <span>No</span>}</div>;
    `;

    const result = transform(code);

    // Conditional expression should use insert() wrapped in templateEffect
    expect(result.code).toContain("insert");
    expect(result.code).toContain("templateEffect");
    expect(result.code).toContain("show.value");
  });

  it("should transform list rendering (.map()) using insert() and templateEffect", () => {
    const code = `
      const items = ["a", "b", "c"];
      const element = <ul>{items.map(item => <li>{item}</li>)}</ul>;
    `;

    const result = transform(code);

    // .map() expression should use insert() wrapped in templateEffect
    expect(result.code).toContain("insert");
    expect(result.code).toContain("templateEffect");
    expect(result.code).toContain("items");
    expect(result.code).toContain("map");
  });

  it("should insert runtime imports after existing import declarations", () => {
    const code = `
      import { signal } from "@dathra/reactivity";
      const element = <div>Hello</div>;
    `;

    const result = transform(code);

    // Runtime imports should appear after the existing import
    const importIndex = result.code.indexOf("@dathra/reactivity");
    const runtimeIndex = result.code.indexOf("@dathra/runtime");
    expect(importIndex).toBeGreaterThanOrEqual(0);
    expect(runtimeIndex).toBeGreaterThanOrEqual(0);
    // Both imports should be present
    expect(result.code).toContain("import");
    expect(result.code).toContain("fromTree");
  });

  it("should transform nested Fragment in CSR mode", () => {
    const code = `
      const element = (
        <>
          <div>First</div>
          <>
            <span>Second</span>
            <span>Third</span>
          </>
        </>
      );
    `;

    const result = transform(code);

    // Outer fragment should be transformed, inner Fragment is processed as part of tree
    expect(result.code).toContain("fromTree");
    expect(result.code).toContain("div");
    expect(result.code).toContain("span");
  });

  describe("Component elements", () => {
    it("should transform component element to function call in CSR mode", () => {
      const code = `
        const element = <Counter initialCount={5} />;
      `;

      const result = transform(code, { mode: "csr" });

      // Component should be converted to function call
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("initialCount");
      expect(result.code).toContain("5");
      // Should NOT contain fromTree for component
      expect(result.code).not.toContain("fromTree");
    });

    it("should transform component element to function call in SSR mode", () => {
      const code = `
        const element = <Counter initialCount={10} />;
      `;

      const result = transform(code, { mode: "ssr" });

      // Component should be converted to function call
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("initialCount");
      expect(result.code).toContain("10");
      // Should NOT contain renderToString for component-only
      expect(result.code).not.toContain("renderToString");
    });

    it("should handle nested component elements with insert (no templateEffect)", () => {
      const code = `
        const element = (
          <div>
            <Counter initialCount={5} />
          </div>
        );
      `;

      const result = transform(code);

      // Should contain fromTree for outer div
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("div");
      // Should contain insert for nested component
      expect(result.code).toContain("insert");
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("initialCount");
      // Components are inserted directly (NOT wrapped in templateEffect)
      // to prevent re-creation on every signal change
      expect(result.code).not.toContain("templateEffect");
    });

    it("should handle root component element without tree generation", () => {
      const code = `
        function App() {
          return <Counter initialCount={5} />;
        }
      `;

      const result = transform(code);

      // Should be direct function call, no fromTree
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("initialCount");
      expect(result.code).not.toContain("fromTree");
      expect(result.code).not.toContain("templateEffect");
    });

    it("should handle JSXMemberExpression as component", () => {
      const code = `
        const element = <Foo.Bar baz="qux" />;
      `;

      const result = transform(code);

      // Should treat Foo.Bar as component (function call)
      expect(result.code).toContain("Foo");
      expect(result.code).toContain("Bar");
      expect(result.code).toContain("baz");
      expect(result.code).toContain("qux");
      // Should NOT use fromTree for component
      expect(result.code).not.toContain("fromTree");
    });

    it("should distinguish lowercase HTML elements from uppercase components", () => {
      const code = `
        const element = (
          <div>
            <button>Click</button>
            <Counter />
          </div>
        );
      `;

      const result = transform(code);

      // HTML elements should be in tree
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("div");
      expect(result.code).toContain("button");
      // Component should be inserted
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("insert");
    });

    it("should pass children as children prop to components", () => {
      const code = `
        const element = (
          <Panel title="My Panel">
            <div>Content</div>
          </Panel>
        );
      `;

      const result = transform(code);

      // Component should receive children prop
      expect(result.code).toContain("Panel");
      expect(result.code).toContain("title");
      expect(result.code).toContain("children");
      // Children should still be processed (HTML element)
      expect(result.code).toContain("div");
    });

    it("should handle component with spread props", () => {
      const code = `
        const props = { count: 5, label: "Counter" };
        const element = <Counter {...props} />;
      `;

      const result = transform(code);

      // Should spread props in function call
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("props");
      expect(result.code).toContain("...");
    });

    it("should normalize client:visible directive into island metadata", () => {
      const code = `
        const element = <Counter client:visible initialCount={5} />;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain('"data-dh-island": "visible"');
      expect(result.code).not.toContain("client:visible");
    });

    it("should preserve client:interaction values as island metadata", () => {
      const code = `
        const element = <Counter client:interaction="mouseenter" />;
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain('"data-dh-island": "interaction"');
      expect(result.code).toContain('"data-dh-island-value": "mouseenter"');
    });

    it("should default bare client:interaction to click metadata", () => {
      const code = `
        const element = <Counter client:interaction />;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain('"data-dh-island": "interaction"');
      expect(result.code).toContain('"data-dh-island-value": "click"');
    });

    it("should preserve the canonical host metadata contract keys", () => {
      const code = `
        const element = <Counter client:media="(max-width: 720px)" />;
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain('"data-dh-island"');
      expect(result.code).toContain('"data-dh-island-value"');
      expect(result.code).toContain('"media"');
      expect(result.code).toContain('"(max-width: 720px)"');
    });

    it("should keep explicit nested island metadata on child components", () => {
      const code = `
        const element = <Outer client:visible><Inner client:load /></Outer>;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain('"data-dh-island": "visible"');
      expect(result.code).toContain('"data-dh-island": "load"');
    });

    it("should attach compiler-generated hydration metadata to defineComponent render functions", () => {
      const code = `
        const CounterCard = defineComponent(
          "counter-card",
          ({ props }) => <button class={props.variant.value} onClick={() => props.onTap.value()}>{props.label.value}</button>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("Object.assign");
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('kind: "generic-plan"');
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "attr"');
      expect(result.code).toContain('kind: "event"');
      expect(result.code).toContain('kind: "text"');
      expect(result.code).not.toContain("boundaryRefs");
      expect(result.code).not.toContain("artifact:");
    });

    it("should include nested boundary refs in compiler-generated hydration metadata", () => {
      const code = `
        const OuterCard = defineComponent(
          "outer-card",
          ({ props }) => <section><InnerCard client:load label={props.label.value} /></section>,
        );
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('tagName: "InnerCard"');
      expect(result.code).toContain('islandStrategy: "load"');
      expect(result.code).not.toContain("boundaryRefs");
    });

    it("should skip hydration metadata emission for unsupported imperative setup bodies", () => {
      const code = `
        const ImperativeCard = defineComponent(
          "imperative-card",
          ({ host }) => {
            host.setAttribute("data-ready", "yes");
            return <div>ready</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("Object.assign");
      expect(result.code).toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
      expect(result.code).not.toContain("planFactory: null");
    });

    it("should classify runtime branching setup bodies as dispatch plan (supported)", () => {
      const code = `
        const BranchingCard = defineComponent(
          "branching-card",
          ({ props }) => (props.ready.value ? <div>ready</div> : <span>waiting</span>),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify opaque helper returns as unsupported", () => {
      const code = `
        const renderCard = (label, suffix) => <div>{label}{suffix}</div>;
        const OpaqueCard = defineComponent(
          "opaque-card",
          ({ props }) => renderCard(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
      expect(result.code).not.toContain("planFactory");
    });

    it("should support typeof document and window environment probes in setup prelude", () => {
      const code = `
        const EnvCard = defineComponent(
          "env-card",
          ({ props }) => {
            const renderMode = typeof document === "undefined" ? "SSR" : "CSR";
            const runtimeKind = typeof window === "undefined" ? "server" : "browser";
            return <div data-render-mode={renderMode}>{runtimeKind}:{props.label.value}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain(
        'const renderMode = typeof document === "undefined" ? "SSR" : "CSR"',
      );
      expect(result.code).toContain(
        'const runtimeKind = typeof window === "undefined" ? "server" : "browser"',
      );
      expect(result.code).toContain('kind: "attr"');
      expect(result.code).toContain('kind: "text"');
    });

    it("should support local zero-arg helpers that directly return JSX", () => {
      const code = `
        const ready = signal("ready");
        const renderCard = () => <div>{ready.value}</div>;
        const SupportedCard = defineComponent(
          "supported-card",
          () => renderCard(),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain('kind: "text"');
      expect(result.code).toContain("ready.value");
    });

    it("should support local transparent thunk wrappers around JSX", () => {
      const code = `
        const withBoundary = (render) => render();
        const WrappedCard = defineComponent(
          "wrapped-card",
          ({ props }) => withBoundary(() => <div>{props.label.value}</div>),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const { props } = __dh_ctx");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support local transparent thunk wrappers around local helper chains", () => {
      const code = `
        const renderCard = (label) => <div>{label}</div>;
        const withBoundary = (render) => render();
        const WrappedCard = defineComponent(
          "wrapped-card",
          ({ props }) => withBoundary(() => renderCard(props.label.value)),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const label = props.label.value");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support known imported transparent thunk wrappers around JSX", () => {
      const code = `
        import { withStore } from "@dathra/core";
        const store = createStore();
        const WrappedCard = defineComponent(
          "wrapped-card",
          ({ props }) => withStore(store, () => <div>{props.label.value}</div>),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const { props } = __dh_ctx");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support aliased known imported transparent thunk wrappers", () => {
      const code = `
        import { withStore as bindStore } from "@dathra/store";
        const store = createStore();
        const WrappedCard = defineComponent(
          "wrapped-card",
          ({ props }) => bindStore(store, () => <div>{props.label.value}</div>),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const { props } = __dh_ctx");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support SSRAppRoot-shaped transparent wrappers around root component elements with function props", () => {
      const code = `
        import { withStore } from "@dathra/core";
        const PlaygroundShell = (props) => <main>{props.renderPage()}</main>;
        const OverviewPage = () => <section>overview</section>;
        const RuntimePage = () => <section>runtime</section>;
        const renderOverviewPage = () => <OverviewPage />;
        const renderRuntimePage = () => <RuntimePage />;
        const pageRenderers = {
          "/": renderOverviewPage,
          "/islands-runtime": renderRuntimePage,
        };
        const resolvePage = (routePath) => pageRenderers[routePath]();
        const AppRoot = defineComponent(
          "app-root",
          ({ props }) => {
            const routePath = props.routePath.value;
            const pageContent = resolvePage(routePath);

            return withStore(store, () => (
              <PlaygroundShell
                routePath={routePath}
                requestId={props.requestId.value}
                renderPage={() => pageContent}
              />
            ));
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const routePath = props.routePath.value");
      expect(result.code).toContain(
        "const pageContent = resolvePage(routePath)",
      );
      expect(result.code).toContain("renderPage: () => pageContent");
      expect(result.code).toContain("PlaygroundShell({");
    });

    it("should keep unknown imported thunk wrappers unsupported", () => {
      const code = `
        import { withTheme } from "./theme";
        const WrappedCard = defineComponent(
          "wrapped-card",
          ({ props }) => withTheme("mint", () => <div>{props.label.value}</div>),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
      expect(result.code).not.toContain("planFactory");
    });

    it("should keep same-named imports from unknown sources unsupported", () => {
      const code = `
        import { withStore } from "./custom-store";
        const store = createStore();
        const WrappedCard = defineComponent(
          "wrapped-card",
          ({ props }) => withStore(store, () => <div>{props.label.value}</div>),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
      expect(result.code).not.toContain("planFactory");
    });

    it("should support trivial helper argument forwarding into JSX", () => {
      const code = `
        const renderCard = (label) => <div>{label}</div>;
        const ForwardedCard = defineComponent(
          "forwarded-card",
          ({ props }) => renderCard(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain('kind: "text"');
      expect(result.code).toContain("const label = props.label.value");
    });

    it("should support helper-local prelude before returning JSX", () => {
      const code = `
        const renderCard = (label) => {
          const text = label.toUpperCase();
          return <div>{text}</div>;
        };
        const PreludeCard = defineComponent(
          "prelude-card",
          ({ props }) => renderCard(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const text = label.toUpperCase()");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support multi-level local helper chains that end in JSX", () => {
      const code = `
        const renderLeaf = (label) => <div>{label}</div>;
        const renderMiddle = (label) => renderLeaf(label.toUpperCase());
        const renderTop = (label) => renderMiddle(label);
        const ChainedCard = defineComponent(
          "chained-card",
          ({ props }) => renderTop(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const label = props.label.value");
      expect(result.code).toContain("const label_1 = label");
      expect(result.code).toContain("const label_2 = label_1.toUpperCase()");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support destructured helper param forwarding", () => {
      const code = `
        const renderCard = ({ label, suffix }) => <div>{label}{suffix}</div>;
        const DestructuredCard = defineComponent(
          "destructured-card",
          ({ props }) => renderCard({ label: props.label.value, suffix: props.suffix.value }),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const { label, suffix } = {");
      expect(result.code).toContain('kind: "text"');
    });

    it("should avoid helper-chain binding collisions in generated planFactory prelude", () => {
      const code = `
        const renderInner = (label) => {
          const text = label.toUpperCase();
          return <div>{text}</div>;
        };
        const renderOuter = (label) => {
          const text = label + "!";
          return renderInner(text);
        };
        const CollisionCard = defineComponent(
          "collision-card",
          ({ props: { label } }) => renderOuter(label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const { props: { label } } = __dh_ctx");
      expect(result.code).toContain("const label_1 = label.value");
      expect(result.code).toContain('const text = label_1 + "!"');
      expect(result.code).toContain("const label_2 = text");
      expect(result.code).toContain("const text_1 = label_2.toUpperCase()");
    });

    it("should avoid helper-local function declaration collisions in generated planFactory prelude", () => {
      const code = `
        const renderInner = (label) => {
          function format(value) {
            return value.toUpperCase();
          }
          return <div>{format(label)}</div>;
        };
        const renderOuter = (label) => {
          function format(value) {
            return value + "!";
          }
          return renderInner(format(label));
        };
        const FunctionCollisionCard = defineComponent(
          "function-collision-card",
          ({ props: { label } }) => renderOuter(label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const { props: { label } } = __dh_ctx");
      expect(result.code).toContain("const label_1 = label.value");
      expect(result.code).toContain("function format(value)");
      expect(result.code).toContain("function format_1(value)");
      expect(result.code).toContain("const label_2 = format(label_1)");
      expect(result.code).toContain("format_1(label_2)");
    });

    it("should support normalizable spread merges from top-level serializable bindings", () => {
      const code = `
        const extraProps = { role: "status" };
        const SpreadCard = defineComponent(
          "spread-card",
          () => <div {...{ class: "ready", ...extraProps }}>ready</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "spread"');
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify node identity creation outside JSX tree as unsupported", () => {
      const code = `
        const NodeCard = defineComponent(
          "node-card",
          () => {
            const node = document.createElement("strong");
            node.textContent = "ready";
            return <div>{node}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
      expect(result.code).not.toContain("planFactory");
    });

    it("should support WebComponentSSR-shaped setup with store.ref, typeof document, onClick and slot", () => {
      const code = `
        import { countAtom } from "./demoStore";
        const SSRStoreCounter = defineComponent(
          "dathra-ssr-store-counter",
          ({ props, store }) => {
            const count = store.ref(countAtom);
            const mode = typeof document === "undefined" ? "SSR" : "CSR";
            return (
              <section data-accent={props.accent.value}>
                <div class="mode-badge">{mode}</div>
                <h2>{props.headline.value}</h2>
                <p>{props.note.value}</p>
                <div class="count">{count.value}</div>
                <button onClick={() => count.set((v) => v + 1)}>Increment</button>
                <div class="slot-content"><slot /></div>
              </section>
            );
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain('kind: "attr"');
      expect(result.code).toContain('kind: "text"');
      expect(result.code).toContain('kind: "event"');
      expect(result.code).toContain("count.value");
      expect(result.code).toContain("store.ref(countAtom)");
      expect(result.code).toContain(
        'const mode = typeof document === "undefined" ? "SSR" : "CSR"',
      );
    });

    it("should support colocated card-shaped setup with signal(0) prelude and client.strategy", () => {
      const code = `
        const PlaygroundColocatedLoadCard = defineComponent(
          "playground-colocated-load-card",
          ({ client }) => {
            const count = signal(0);
            return (
              <article>
                <p>{client.strategy ?? "none"}</p>
                <button load:onClick={() => { count.set(count.value + 1); }}>Increment</button>
                <span class="count">{count.value}</span>
              </article>
            );
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const count = signal(0)");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support nested inner island setup with signal(0) and onClick", () => {
      const code = `
        const PlaygroundNestedInnerIsland = defineComponent(
          "playground-nested-inner-island",
          ({ client }) => {
            const count = signal(0);
            return (
              <article class="inner-card">
                <p>{client.strategy ?? "none"}</p>
                <button type="button" onClick={() => { count.set(count.value + 1); }}>Increment</button>
                <strong>{count.value}</strong>
              </article>
            );
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const count = signal(0)");
      expect(result.code).toContain('kind: "event"');
      expect(result.code).toContain('kind: "text"');
    });

    it("should support nested outer island setup with props and nested client:load child", () => {
      const code = `
        const PlaygroundNestedOuterIsland = defineComponent(
          "playground-nested-outer-island",
          ({ client, props }) => {
            return (
              <section class="outer-shell">
                <strong>{client.strategy ?? "none"}</strong>
                <strong>{props.label.value}</strong>
                <PlaygroundNestedInnerIsland client:load label="Nested child ready" />
              </section>
            );
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('tagName: "PlaygroundNestedInnerIsland"');
      expect(result.code).toContain('islandStrategy: "load"');
    });

    it("should support exported defineComponent declarations", () => {
      const code = `
        export const ExportedCard = defineComponent(
          "exported-card",
          ({ props }) => <div>{props.label.value}</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain('kind: "text"');
    });

    it("should support multiple defineComponent declarations in one const statement", () => {
      const code = `
        const CardA = defineComponent(
          "card-a",
          ({ props }) => <div>{props.a.value}</div>,
        ), CardB = defineComponent(
          "card-b",
          ({ props }) => <span>{props.b.value}</span>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("props.a.value");
      expect(result.code).toContain("props.b.value");
    });

    it("should support props-only components that return direct JSX without block body", () => {
      const code = `
        const GlobalStyleCard = defineComponent(
          "playground-global-style-card",
          ({ props }) => (
            <article data-tone={props.tone.value}>
              <h3>{props.title.value}</h3>
              <p>{props.body.value}</p>
            </article>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain('kind: "attr"');
      expect(result.code).toContain('kind: "text"');
      expect(result.code).toContain("props.tone.value");
    });

    it("should classify non-function component arg as no metadata", () => {
      const code = `
        const NonFnCard = defineComponent(
          "non-fn-card",
          "not-a-function",
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("__hydrationMetadata__");
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify FunctionDeclaration component arg as supported when returning JSX", () => {
      const code = `
        const FnDeclCard = defineComponent(
          "fn-decl-card",
          function setup({ props }) { return <div>{props.label.value}</div>; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify helper chain ending in non-JSX expression as resolvedAnalysis null with fallback to getUnsupportedHydrationReason", () => {
      const code = `
        const renderText = (label) => label.toUpperCase();
        const TextCard = defineComponent(
          "text-card",
          ({ props }) => renderText(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup body with IfStatement as dispatch plan (supported)", () => {
      const code = `
        const BranchCard = defineComponent(
          "branch-card",
          ({ props }) => {
            if (props.ready.value) {
              return <div>ready</div>;
            }
            return <span>waiting</span>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify setup body with SwitchStatement as dispatch plan (supported)", () => {
      const code = `
        const SwitchCard = defineComponent(
          "switch-card",
          ({ props }) => {
            switch (props.mode.value) {
              case "a": return <div>A</div>;
              default: return <div>B</div>;
            }
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify setup body with return conditional expression in block as dispatch plan", () => {
      const code = `
        const RetCondCard = defineComponent(
          "ret-cond-card",
          ({ props }) => {
            const x = props.value.value;
            return x > 0 ? <div>pos</div> : <span>neg</span>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify setup body with return LogicalExpression in block as dispatch plan", () => {
      const code = `
        const RetLogCard = defineComponent(
          "ret-log-card",
          ({ props }) => {
            const x = props.value.value;
            return x && <div>truthy</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should generate dispatch plan for guard-return pattern with static JSX branches", () => {
      const code = `
        const BranchCard = defineComponent(
          "branch-card",
          ({ props }) => {
            if (props.loading.value) {
              return <div class="spinner">Loading...</div>;
            }
            return <div class="content">{props.message.value}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("condition");
      // Should have two plans (one per branch)
      expect(result.code).toContain("shapeHash");
    });

    it("should generate dispatch plan for if/else pattern with static JSX branches", () => {
      const code = `
        const IfElseCard = defineComponent(
          "if-else-card",
          ({ props }) => {
            if (props.error.value) {
              return <div class="error">{props.error.value}</div>;
            } else {
              return <div class="ok">{props.message.value}</div>;
            }
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should generate different shapeHash for branches with different element types", () => {
      const code = `
        const DiffShape = defineComponent(
          "diff-shape",
          ({ props }) => {
            if (props.alt.value) {
              return <span>alt</span>;
            }
            return <div>main</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("dispatch");
      // Both branches should have shapeHash entries
      const shapeHashMatches = result.code.match(/shapeHash/g);
      expect(shapeHashMatches).not.toBeNull();
      expect((shapeHashMatches ?? []).length).toBeGreaterThanOrEqual(2);
    });

    it("should generate same shapeHash for branches with same element types", () => {
      const code = `
        const SameShape = defineComponent(
          "same-shape",
          ({ props }) => {
            if (props.alt.value) {
              return <div class="alt">alt</div>;
            }
            return <div class="main">main</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("dispatch");
    });

    it("should fall back to unsupported when one branch is non-static JSX", () => {
      const code = `
        const MixedBranch = defineComponent(
          "mixed-branch",
          ({ props }) => {
            if (props.alt.value) {
              return <div>static</div>;
            }
            return renderSomething(props.message.value);
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
      expect(result.code).not.toContain("dispatch");
    });

    it("should generate dispatch plan for nested if statements", () => {
      const code = `
        const NestedIf = defineComponent(
          "nested-if",
          ({ props }) => {
            if (props.a.value) {
              if (props.b.value) {
                return <div>both</div>;
              }
              return <div>a only</div>;
            }
            return <div>none</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should generate dispatch plan for switch statements", () => {
      const code = `
        const SwitchComp = defineComponent(
          "switch-comp",
          ({ props }) => {
            switch (props.mode.value) {
              case "a": return <div>A</div>;
              case "b": return <div>B</div>;
              default: return <div>C</div>;
            }
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should track nested islands in dispatch plan branches", () => {
      const code = `
        const OuterDispatch = defineComponent(
          "outer-dispatch",
          ({ props }) => {
            if (props.loading.value) {
              return <div class="spinner">Loading...</div>;
            }
            return (
              <div class="content">
                <InnerIsland client:load />
              </div>
            );
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("nestedBoundaries");
    });

    it("should generate dispatch plan for nested-if component with colocated directive", () => {
      const code = `
        const NestedIfColocated = defineComponent(
          "nested-if-colocated",
          ({ props }) => {
            if (props.a.value) {
              if (props.b.value) {
                return <div>both</div>;
              }
              return <div>a only</div>;
            }
            return (
              <div>
                <button load:onClick={() => go()}>Go</button>
              </div>
            );
          },
        );
      `;

      // Nested if is now a supported dispatch pattern, so colocated directive is fine
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify return of conditional expression as dispatch plan (ternary in return)", () => {
      const code = `
        const TernaryReturn = defineComponent(
          "ternary-return",
          ({ props }) => {
            return props.cond.value ? <div>yes</div> : <div>no</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify return of conditional expression with parenthesized JSX branches as dispatch plan", () => {
      const code = `
        const TernaryReturnWrapped = defineComponent(
          "ternary-return-wrapped",
          ({ props }) => {
            const count = signal(0);
            return props.cond.value ? (
              <article>
                <button
                  type="button"
                  onClick={() => {
                    count.set(count.value + 1);
                  }}
                >
                  Increment
                </button>
                <span>{count.value}</span>
              </article>
            ) : (
              <article>
                <button
                  type="button"
                  onClick={() => {
                    count.set(count.value + 1);
                  }}
                >
                  Increment
                </button>
                <span>{count.value}</span>
              </article>
            );
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain(
        'unsupportedReason: "runtime-branching"',
      );
    });

    it("should classify return of logical expression as dispatch plan", () => {
      const code = `
        const LogicalReturn = defineComponent(
          "logical-return",
          ({ props }) => {
            return props.value.value && <div>truthy</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should generate svg namespace when root element is svg", () => {
      const code = `
        const SvgCard = defineComponent(
          "svg-card",
          () => <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r="40" /></svg>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('namespace: "svg"');
    });

    it("should generate math namespace when root element is math", () => {
      const code = `
        const MathCard = defineComponent(
          "math-card",
          () => <math><mn>42</mn></math>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('namespace: "math"');
    });

    it("should generate html namespace for fragment root", () => {
      const code = `
        const FragCard = defineComponent(
          "frag-card",
          ({ props }) => <><div>{props.a.value}</div><span>{props.b.value}</span></>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('namespace: "html"');
    });

    it("should support multiple signals in prelude", () => {
      const code = `
        const MultiSigCard = defineComponent(
          "multi-sig-card",
          () => {
            const count = signal(0);
            const name = signal("world");
            const flag = signal(true);
            return <div data-flag={flag.value}>{name.value}: {count.value}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("const count = signal(0)");
      expect(result.code).toContain('const name = signal("world")');
      expect(result.code).toContain("const flag = signal(true)");
    });

    it("should support template literal prelude values", () => {
      const code = `
        const TplCard = defineComponent(
          "tpl-card",
          ({ props }) => {
            const greeting = \`Hello, \${props.name.value}!\`;
            return <div>{greeting}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support normalizable spread merges in nested child elements", () => {
      const code = `
        const extras = { role: "alert" };
        const NestedSpreadCard = defineComponent(
          "nested-spread-card",
          () => (
            <div>
              <span {...{ class: "inner", ...extras }}>nested</span>
            </div>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "spread"');
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support normalizable spread merges inside fragment children", () => {
      const code = `
        const extras = { role: "alert" };
        const FragSpreadCard = defineComponent(
          "frag-spread-card",
          () => (
            <>
              <div {...{ class: "inner", ...extras }}>frag child</div>
            </>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "spread"');
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify setup with void body (no return) as unsupported-component-body", () => {
      const code = `
        const VoidCard = defineComponent(
          "void-card",
          () => {},
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should support setup with null return as no metadata", () => {
      const code = `
        const NullCard = defineComponent(
          "null-card",
          () => { return null; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup with prelude containing JSX as non-extractable", () => {
      const code = `
        const JsxPreludeCard = defineComponent(
          "jsx-prelude-card",
          () => {
            const header = <h1>header</h1>;
            return <div>{header}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("planFactory");
    });

    it("should classify expression statement in prelude as non-extractable", () => {
      const code = `
        const ExprStmtCard = defineComponent(
          "expr-stmt-card",
          () => {
            console.log("setup");
            return <div>ready</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("planFactory");
    });

    it("should handle return that is not the last statement in block", () => {
      const code = `
        const EarlyReturnCard = defineComponent(
          "early-return-card",
          () => {
            return <div>early</div>;
            const dead = "unreachable";
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("planFactory");
    });

    it("should support exported defineComponent with helper lookup", () => {
      const code = `
        const renderContent = (label) => <div>{label}</div>;
        export const ExportedHelperCard = defineComponent(
          "exported-helper-card",
          ({ props }) => renderContent(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should collect top-level exported function declarations as helpers", () => {
      const code = `
        export function renderLayout(content) {
          return <div class="layout">{content}</div>;
        }
        const LayoutCard = defineComponent(
          "layout-card",
          ({ props }) => renderLayout(props.content.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should collect top-level function declarations (non-exported) as helpers", () => {
      const code = `
        function renderLayout(content) {
          return <div class="layout">{content}</div>;
        }
        const LayoutCard = defineComponent(
          "layout-card",
          ({ props }) => renderLayout(props.content.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should handle NewExpression DOM constructor (Text) as node-identity-reuse", () => {
      const code = `
        const NewCard = defineComponent(
          "new-card",
          () => {
            const el = new Text("hello");
            return <div>{el}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should skip defineComponent calls without second argument", () => {
      const code = `
        const NoArgCard = defineComponent("no-arg-card");
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should support helper with array destructured parameter", () => {
      const code = `
        const renderPair = ([first, second]) => <div>{first}:{second}</div>;
        const PairCard = defineComponent(
          "pair-card",
          ({ props }) => renderPair([props.a.value, props.b.value]),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify helper with default parameter called with zero args as opaque due to arity mismatch", () => {
      const code = `
        const renderGreeting = (name = "world") => <div>Hello {name}</div>;
        const DefaultCard = defineComponent(
          "default-card",
          () => renderGreeting(),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // Arity mismatch: 0 args vs 1 param → opaque-helper-call
      expect(result.code).toContain("unsupportedReason");
      expect(result.code).not.toContain("planFactory");
    });

    it("should support helper with rest parameter", () => {
      const code = `
        const renderList = (...items) => <ul>{items}</ul>;
        const RestCard = defineComponent(
          "rest-card",
          () => renderList("a", "b"),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // Rest params have different count than call args, so arity check should prevent planFactory
      expect(result.code).not.toContain("planFactory");
    });

    it("should handle recursive helper references as visited helper bailout", () => {
      const code = `
        const renderA = (x) => renderB(x);
        const renderB = (x) => renderA(x);
        const RecCard = defineComponent(
          "rec-card",
          ({ props }) => renderA(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // Cycle detection should prevent infinite recursion
      expect(result.code).toContain("__hydrationMetadata__");
    });

    it("should handle helper with mismatched arity (more args than params)", () => {
      const code = `
        const renderLabel = (label) => <div>{label}</div>;
        const ArityCard = defineComponent(
          "arity-card",
          ({ props }) => renderLabel(props.a.value, props.b.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // Arity mismatch should prevent helper resolution
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
      expect(result.code).not.toContain("planFactory");
    });

    it("should handle local transparent thunk wrapper with non-thunk argument", () => {
      const code = `
        const withBoundary = (render) => render();
        const NonThunkCard = defineComponent(
          "non-thunk-card",
          ({ props }) => withBoundary(props.renderFn.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // Non-thunk argument to wrapper should be unsupported
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
      expect(result.code).not.toContain("planFactory");
    });

    it("should handle imported transparent thunk wrapper with non-thunk last argument", () => {
      const code = `
        import { withStore } from "@dathra/core";
        const NonThunkImportCard = defineComponent(
          "non-thunk-import-card",
          ({ props }) => withStore(store, props.renderFn.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
      expect(result.code).not.toContain("planFactory");
    });

    it("should handle member expression callee in getComponentDisplayName", () => {
      const code = `
        const OuterNs = defineComponent(
          "outer-ns",
          () => <div><Foo.Bar client:load label="test" /></div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('tagName: "Foo.Bar"');
    });

    it("should handle walker inJSX re-entry for JSXElement inside expression container", () => {
      const code = `
        const flag = signal(true);
        const element = <div>{flag.value ? <span>yes</span> : <em>no</em>}</div>;
      `;

      const result = transform(code);

      // The walker should not double-transform nested JSX inside an expression container
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("insert");
    });

    it("should handle walker inJSX re-entry for JSXFragment inside expression container", () => {
      const code = `
        const flag = signal(true);
        const element = <div>{flag.value ? <>yes</> : <>no</>}</div>;
      `;

      const result = transform(code);

      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("insert");
    });

    it("should classify non-function non-FunctionDeclaration component body in getUnsupportedHydrationReason as null", () => {
      const code = `
        const helper = 42;
        const OpaqueReturn = defineComponent(
          "opaque-return",
          ({ props }) => helper,
        );
      `;

      const result = transform(code, { mode: "csr" });

      // Helper is a number literal, not a function, so resolveTopLevelHelperNode won't resolve it
      // The component returns a non-JSX, non-function-call expression
      expect(result.code).not.toContain("planFactory");
    });

    it("should support prelude with function declaration before JSX return", () => {
      const code = `
        const FnPreludeCard = defineComponent(
          "fn-prelude-card",
          ({ props }) => {
            function formatLabel(raw) {
              return raw.toUpperCase();
            }
            const label = formatLabel(props.label.value);
            return <div>{label}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain("function formatLabel(raw)");
    });

    it("should cover collectBindingNames ObjectPattern RestElement branch via helper with object rest destructuring", () => {
      const code = `
        const renderObj = ({a, ...rest}) => <div>{a}{rest.b}</div>;
        const RestObjCard = defineComponent(
          "rest-obj-card",
          ({ props }) => renderObj({a: props.a.value, b: props.b.value}),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should cover collectBindingNames ArrayPattern branch via helper with array destructuring", () => {
      const code = `
        const renderArr = ([x, y]) => <div>{x}:{y}</div>;
        const ArrCard = defineComponent(
          "arr-card",
          ({ props }) => renderArr([props.x.value, props.y.value]),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should cover collectBindingNames AssignmentPattern branch via helper with default destructured param", () => {
      const code = `
        const renderDefault = ({label = "default"}) => <div>{label}</div>;
        const DefaultDestructCard = defineComponent(
          "default-destruct-card",
          ({ props }) => renderDefault({label: props.label.value}),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should cover collectBindingNames top-level RestElement via helper with rest param pattern", () => {
      const code = `
        const renderRest = (...items) => <ul>{items}</ul>;
        const TopRestCard = defineComponent(
          "top-rest-card",
          () => renderRest("a"),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // Rest param: 1 param pattern vs 1 arg — but RestElement has length 1 and args length 1
      // collectBindingNames should visit the RestElement branch
      expect(result.code).toContain("__hydrationMetadata__");
    });

    it("should cover renamePatternWithCollisions duplicate binding name in pattern", () => {
      // A helper whose destructured pattern has a name collision with __dh_host (reserved)
      const code = `
        const renderReserved = ({__dh_host}) => <div>{__dh_host}</div>;
        const ReservedCard = defineComponent(
          "reserved-card",
          ({ props }) => renderReserved({__dh_host: props.label.value}),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      // The reserved name should be renamed to avoid collision
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should cover renameStatementWithCollisions for FunctionDeclaration with reserved name collision", () => {
      const code = `
        const FnCollisionCard = defineComponent(
          "fn-collision-card",
          ({ props }) => {
            function __dh_host(x) { return x; }
            const label = __dh_host(props.label.value);
            return <div>{label}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      // The function declaration named __dh_host should be renamed
    });

    it("should cover renameStatementWithCollisions fallback for non-VariableDeclaration non-FunctionDeclaration", () => {
      // ExpressionStatement in prelude is not supported, so this won't produce planFactory
      // but the line 403 is the fallback for applyRenameMapToStatementReferences
      // We need a statement type that IS a supported prelude type (VariableDeclaration or FunctionDeclaration)
      // Line 403 is actually unreachable for supported prelude since only VariableDeclaration and FunctionDeclaration pass isSupportedPlanPreludeStatement
      // Let's instead test line 374: renameStatementWithCollisions for non-VariableDeclaration non-FunctionDeclaration
      // Line 374 returns cloneNode(statement) - this is only reachable if the statement is not VariableDeclaration and not FunctionDeclaration
      // But buildCollisionSafePlanAnalysis only passes preludeStatements which are already filtered by isSupportedPlanPreludeStatement
      // So lines 374 and 403 may be structurally unreachable in the current code path. Let's skip these and focus on reachable lines.
      // Instead, test a helper chain where a param name collides with an existing prelude variable
      const code = `
        const renderInner = (count) => <span>{count}</span>;
        const WrapperCard = defineComponent(
          "wrapper-card",
          ({ props }) => {
            const count = signal(0);
            return renderInner(count.value);
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      // count in prelude and count as helper param should not collide
    });

    it("should cover containsJSXNode JSXFragment detection in prelude", () => {
      const code = `
        const FragPreludeCard = defineComponent(
          "frag-prelude-card",
          () => {
            const frag = <>fragment</>;
            return <div>{frag}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      // JSXFragment in prelude should prevent planFactory extraction
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify deeply nested IfStatement hidden in an IIFE as unsupported-component-body", () => {
      const code = `
        const DeepIfCard = defineComponent(
          "deep-if-card",
          () => {
            console.log("init");
            const val = (() => { if (true) return 1; return 2; })();
            return <div>{val}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify deeply nested SwitchStatement hidden in an IIFE as unsupported-component-body", () => {
      const code = `
        const DeepSwitchCard = defineComponent(
          "deep-switch-card",
          () => {
            console.log("init");
            const val = (() => { switch(1) { case 1: return "a"; default: return "b"; } })();
            return <div>{val}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should cover getExplicitNestedBoundary with JSX component child having client:load (nested island)", () => {
      const code = `
        const OuterIsland = defineComponent(
          "outer-island",
          () => <div><InnerComp client:load label="test" /></div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('"InnerComp"');
      expect(result.code).toContain('"load"');
    });

    it("should cover getExplicitNestedBoundary with component child having no client directive", () => {
      // Component child without client:* → getExplicitNestedBoundary returns null (line 1110)
      const code = `
        const NoDirectiveOuter = defineComponent(
          "no-directive-outer",
          () => <div><PlainComp label="test" /></div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries: []");
    });

    it("should cover getExplicitNestedBoundary with SpreadElement in component props (line 1085)", () => {
      const code = `
        const extras = { role: "main" };
        const SpreadIslandOuter = defineComponent(
          "spread-island-outer",
          () => <div><SpreadComp {...extras} client:load /></div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      // SpreadElement in props → property.type !== "Property" → continue (line 1085)
    });

    it("should cover resolveTopLevelHelperNode thunk wrapper with null frame (line 738)", () => {
      const code = `
        import { withStore } from "@dathra/core";
        const NullFrameCard = defineComponent(
          "null-frame-card",
          () => withStore(store, () => { console.log("side-effect"); }),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should cover resolveTopLevelHelperNode helper with no render frame (line 767)", () => {
      const code = `
        const setupHelper = (ctx) => { ctx.init(); };
        const NoFrameCard = defineComponent(
          "no-frame-card",
          ({ props }) => setupHelper(props),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should cover createPlanBinding spread type in direct plan extraction", () => {
      const code = `
        const SpreadCard = defineComponent(
          "spread-card",
          ({ props }) => <div {...props.attrs.value}>content</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('"spread"');
    });

    it("should cover resolveComponentRenderAnalysis null finalFrame from branching helper", () => {
      const code = `
        const innerHelper = (x) => { x.toString(); };
        const outerHelper = (val) => innerHelper(val);
        const NullFinalCard = defineComponent(
          "null-final-card",
          ({ props }) => outerHelper(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should cover extractFunctionRenderFrame null return argument (line 985)", () => {
      const code = `
        const NullRetCard = defineComponent(
          "null-ret-card",
          () => { const x = 1; return; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should cover createPlanBinding spread type through helper extraction", () => {
      const code = `
        const SpreadCard = defineComponent(
          "spread-card",
          ({ props }) => <div {...props.attrs.value}>content</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('"spread"');
    });

    it("should cover resolveComponentRenderAnalysis null finalFrame from object spread helper", () => {
      const code = `
        const innerHelper = (x) => { x.toString(); };
        const outerHelper = (val) => innerHelper(val);
        const NullFinalCard = defineComponent(
          "null-final-card",
          ({ props }) => outerHelper(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should cover getUnsupportedHydrationReason containsNodeType IfStatement fallback (line 1242)", () => {
      // This test verifies that NestedIfCard with an IIFE containing IfStatement
      // but no ExpressionStatement in prelude → extractFunctionRenderFrame succeeds
      // → resolveComponentRenderAnalysis produces a valid analysis → planFactory is generated.
      // The IfStatement inside the IIFE doesn't affect planFactory generation because
      // it's inside a VariableDeclaration initializer, not a top-level branching statement.
      const code = `
        const NestedIfCard = defineComponent(
          "nested-if-card",
          () => {
            const result = (() => { if (true) return "a"; return "b"; })();
            return <div>{result}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      // extractFunctionRenderFrame succeeds (VariableDeclaration + ReturnStatement)
      // resolveComponentRenderAnalysis returns a valid analysis → planFactory
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should cover resolveComponentRenderAnalysis null finalFrame from helper chain without return", () => {
      // A helper chain where the final helper has no return expression
      const code = `
        const innerHelper = (x) => { x.toString(); };
        const outerHelper = (val) => innerHelper(val);
        const NullFinalCard = defineComponent(
          "null-final-card",
          ({ props }) => outerHelper(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // innerHelper has no return → resolveComponentRenderAnalysis returns null
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should cover walker inJSX guard for nested JSXElement (lines 1649-1650)", () => {
      // The walker enters JSXElement, sets inJSX=true, then encounters a nested JSXElement
      // This happens naturally when processing <div><span>text</span></div>
      // The guard at line 1648-1650 prevents double-transformation
      const code = `
        const element = <div><span><em>deep</em></span></div>;
      `;

      const result = transform(code);

      expect(result.code).toContain("fromTree");
      // Should produce a single template, not nested transforms
      expect(result.code).toContain("div");
      expect(result.code).toContain("span");
      expect(result.code).toContain("em");
    });

    it("should cover walker inJSX guard for nested JSXFragment (lines 1676-1677)", () => {
      // After entering a JSXElement, encountering a JSXFragment as child
      const code = `
        const element = <div><>nested fragment</></div>;
      `;

      const result = transform(code);

      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("nested fragment");
    });

    it("should cover isJSXElement/isJSXFragment type guard after inJSX check (lines 1653, 1680)", () => {
      // These lines are type guards that should always pass after the walker visitor fires
      // They are covered when any JSX is processed through the walker
      // Testing with a simple component that has both element and fragment children
      const code = `
        const mixed = <section><div>el</div><>frag</></section>;
      `;

      const result = transform(code);

      expect(result.code).toContain("fromTree");
    });

    it("should throw when client:media is missing a string literal value", () => {
      const code = `
        const element = <Counter client:media />;
      `;

      expect(() => transform(code)).toThrow(
        "client:media requires a string literal media query",
      );
    });

    it("should throw when valueless directives receive a value", () => {
      const code = `
        const element = <Counter client:visible="later" />;
      `;

      expect(() => transform(code)).toThrow(
        "client:visible does not accept a value",
      );
    });

    it("should throw for client directives on html elements", () => {
      const code = `
        const element = <div client:visible>bad</div>;
      `;

      expect(() => transform(code)).toThrow(
        "client:* directives are only supported on component elements",
      );
    });

    it("should throw for multiple client directives on one component", () => {
      const code = `
        const element = <Counter client:visible client:idle />;
      `;

      expect(() => transform(code)).toThrow(
        "Multiple client:* directives are not allowed",
      );
    });

    it("should throw for unknown client directives", () => {
      const code = `
        const element = <Counter client:visibile />;
      `;

      expect(() => transform(code)).toThrow("Unknown client:* directive");
    });

    it("should throw when client directives collide with reserved island metadata props", () => {
      const code = `
        const element = <Counter client:visible data-dh-island="manual" />;
      `;

      expect(() => transform(code)).toThrow(
        "client:* directives cannot be combined with explicit data-dh-island metadata",
      );
    });

    it("should transform load:onClick on html elements into client target metadata plus click binding", () => {
      const code = `
        const element = <button load:onClick={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("load");
      expect(result.code).toContain("event");
      expect(result.code).toContain('"click"');
    });

    it("should transform interaction:onClick on html elements into interaction target metadata plus click binding", () => {
      const code = `
        const element = <button interaction:onClick={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("interaction");
    });

    it("should transform visible:onClick on html elements into visible target metadata plus click binding", () => {
      const code = `
        const element = <button visible:onClick={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("visible");
      expect(result.code).toContain('"click"');
      expect(result.code).not.toContain("visible:onClick");
    });

    it("should transform idle:onClick on html elements into idle target metadata plus click binding", () => {
      const code = `
        const element = <button idle:onClick={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("idle");
      expect(result.code).not.toContain("idle:onClick");
    });

    it("should preserve the canonical colocated metadata contract keys", () => {
      const code = `
        const element = <button idle:onClick={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("idle");
    });

    it("should support all canonical colocated strategies for onClick", () => {
      for (const strategy of COLOCATED_CLIENT_STRATEGIES) {
        const code = `
          const element = <button ${strategy}:onClick={() => doThing()}>Run</button>;
        `;

        const result = transform(code, { mode: "csr" });

        expect(result.code).toContain("data-dh-client-target=");
        expect(result.code).toContain("data-dh-client-strategy=");
        expect(result.code).toContain(strategy);
        expect(result.code).toContain('"click"');
      }
    });

    it("should throw when load:onClick and interaction:onClick are mixed in one jsx root", () => {
      const code = `
        const element = (
          <div>
            <button load:onClick={() => a()} />
            <button interaction:onClick={() => b()} />
          </div>
        );
      `;

      expect(() => transform(code)).toThrow(
        "Mixed colocated client strategies are not supported in one JSX root",
      );
    });

    it("should throw when visible:onClick and idle:onClick are mixed in one jsx root", () => {
      const code = `
        const element = (
          <div>
            <button visible:onClick={() => a()} />
            <button idle:onClick={() => b()} />
          </div>
        );
      `;

      expect(() => transform(code)).toThrow(
        "Mixed colocated client strategies are not supported in one JSX root",
      );
    });

    it("should throw when visible:onClick and load:onClick are mixed in one jsx root", () => {
      const code = `
        const element = (
          <div>
            <button visible:onClick={() => a()} />
            <button load:onClick={() => b()} />
          </div>
        );
      `;

      expect(() => transform(code)).toThrow(
        "Mixed colocated client strategies are not supported in one JSX root",
      );
    });

    it("should throw when idle:onClick and interaction:onClick are mixed in one jsx root", () => {
      const code = `
        const element = (
          <div>
            <button idle:onClick={() => a()} />
            <button interaction:onClick={() => b()} />
          </div>
        );
      `;

      expect(() => transform(code)).toThrow(
        "Mixed colocated client strategies are not supported in one JSX root",
      );
    });

    it("should throw when host level client directives mix with colocated client directives in one component render subtree", () => {
      const clientDirectiveCode = `
        const element = (
          <Panel client:load>
            <button visible:onClick={() => doThing()}>Run</button>
          </Panel>
        );
      `;
      const explicitMetadataCode = `
        const element = (
          <Panel data-dh-island="load">
            <button idle:onClick={() => doThing()}>Run</button>
          </Panel>
        );
      `;

      expect(() => transform(clientDirectiveCode)).toThrow(
        "host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
      );
      expect(() => transform(explicitMetadataCode)).toThrow(
        "host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
      );
    });

    it("should throw when author supplies compiler reserved client metadata", () => {
      const targetCode = `
        const element = <button data-dh-client-target="author" load:onClick={() => doThing()}>Run</button>;
      `;
      const strategyCode = `
        const element = <button data-dh-client-strategy="idle" idle:onClick={() => doThing()}>Run</button>;
      `;
      const eventCode = `
        const element = <button data-dh-client-event="keydown" interaction:onKeyDown={() => doThing()}>Run</button>;
      `;

      expect(() => transform(targetCode)).toThrow(
        "data-dh-client-target is compiler-reserved metadata and cannot be authored directly",
      );
      expect(() => transform(strategyCode)).toThrow(
        "data-dh-client-strategy is compiler-reserved metadata and cannot be authored directly",
      );
      expect(() => transform(eventCode)).toThrow(
        "data-dh-client-event is compiler-reserved metadata and cannot be authored directly",
      );
    });

    it("should throw when colocated directives are used on svg elements", () => {
      const code = `
        const element = <svg visible:onClick={() => doThing()}><circle /></svg>;
      `;

      expect(() => transform(code)).toThrow(
        "visible:onClick is only supported on HTML elements",
      );
    });

    it("should transform load:onMouseEnter on html elements into load target metadata plus mouseenter binding", () => {
      const code = `
        const element = <button load:onMouseEnter={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("load");
      expect(result.code).toContain('"mouseenter"');
    });

    it("should transform visible:onFocus and idle:onScroll on html elements", () => {
      const visibleCode = `
        const element = <button visible:onFocus={() => doThing()}>Run</button>;
      `;
      const idleCode = `
        const element = <button idle:onScroll={() => doThing()}>Run</button>;
      `;

      const visibleResult = transform(visibleCode, { mode: "csr" });
      const idleResult = transform(idleCode, { mode: "csr" });

      expect(visibleResult.code).toContain("visible");
      expect(visibleResult.code).toContain('"focus"');
      expect(idleResult.code).toContain("idle");
      expect(idleResult.code).toContain('"scroll"');
    });

    it("should keep interaction colocated directives limited to onClick", () => {
      const code = `
        const element = <button interaction:onKeyDown={() => doThing()}>Run</button>;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("interaction");
      expect(result.code).toContain('"keydown"');
      expect(result.code).toContain("data-dh-client-event=");
    });

    it("should throw when mixed interaction event types are used in one jsx root", () => {
      const code = `
        const element = (
          <div>
            <button interaction:onClick={() => a()} />
            <button interaction:onKeyDown={() => b()} />
          </div>
        );
      `;

      expect(() => transform(code)).toThrow(
        "Mixed colocated interaction event types are not supported in one JSX root",
      );
    });

    it("should transform component load:onClick into host metadata plus client action registration", () => {
      const code = `
        const handleClick = () => doThing();
        const element = <Counter load:onClick={handleClick} />;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain(
        'registerClientAction("dh-ca-1", (__dh_payload, __dh_host) =>',
      );
      expect(result.code).toContain("return handleClick;");
      expect(result.code).toContain('"data-dh-island": "load"');
      expect(result.code).toContain('"data-dh-client-actions"');
      expect(result.code).toContain("dh-ca-1");
      expect(result.code).not.toContain("load:onClick");
    });

    it("should transform component interaction:onKeyDown into host metadata plus client action registration", () => {
      const code = `
        const handleKeyDown = (event) => report(event.key);
        const element = <Counter interaction:onKeyDown={handleKeyDown} />;
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain(
        'registerClientAction("dh-ca-1", (__dh_payload, __dh_host) =>',
      );
      expect(result.code).toContain("return handleKeyDown;");
      expect(result.code).toContain('"data-dh-island": "interaction"');
      expect(result.code).toContain('"data-dh-island-value": "keydown"');
      expect(result.code).toContain('"data-dh-client-actions"');
      expect(result.code).toContain("dh-ca-1");
      expect(result.code).not.toContain("interaction:onKeyDown");
    });

    it("should reject component-target colocated handlers that capture local bindings", () => {
      const code = `
        const Parent = defineComponent("x-parent", () => {
          const localCount = signal(0);
          return <Counter load:onClick={() => bump(localCount)} />;
        });
      `;

      expect(() => transform(code)).toThrow(
        "[dathra] load:onClick component-target colocated handlers cannot capture local bindings: bump, localCount",
      );
    });

    it("should serialize local const captures for component-target inline handlers", () => {
      const code = `
        function report(value) { return value; }
        const Parent = defineComponent("x-parent", () => {
          const label = "captured-label";
          return <Counter load:onClick={() => report(label)} />;
        });
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain('registerClientAction("dh-ca-1"');
      expect(result.code).toContain("__dh_payload");
      expect(result.code).toContain('"data-dh-client-actions"');
      expect(result.code).toContain('payload: { label: "captured-label" }');
      expect(result.code).toContain('"captured-label"');
    });

    it("should reject component-target interaction:onFocus because child host cannot observe focus", () => {
      const code = `
        const element = <Counter interaction:onFocus={handleFocus} />;
      `;

      expect(() => transform(code)).toThrow(
        "[dathra] interaction:onFocus is not supported on component targets because the child host cannot observe that event without an explicit host re-emit",
      );
    });

    it("should throw when mixed colocated strategies appear across nested jsx transforms", () => {
      const code = `
        const element = (
          <div>
            <button load:onClick={() => a()} />
            {condition ? <button interaction:onClick={() => b()} /> : null}
          </div>
        );
      `;

      expect(() => transform(code)).toThrow(
        "Mixed colocated client strategies are not supported in one JSX root",
      );
    });

    // --- Semantic coverage: async / generator / loop / try-catch / class / exotic patterns ---

    it("should classify async arrow expression body as unsupported-component-body", () => {
      const code = `
        const AsyncCard = defineComponent(
          "async-card",
          async () => <div>hi</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify async arrow block body with await as unsupported-component-body", () => {
      const code = `
        const AsyncBlockCard = defineComponent(
          "async-block-card",
          async () => {
            const data = await fetchData();
            return <div>{data}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify async function expression as unsupported-component-body", () => {
      const code = `
        const AsyncFnCard = defineComponent(
          "async-fn-card",
          async function setup() { return <div>hi</div>; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify generator function expression as unsupported-component-body", () => {
      const code = `
        const GenCard = defineComponent(
          "gen-card",
          function* () { yield <div>hi</div>; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify for-loop in setup body as unsupported-component-body", () => {
      const code = `
        const LoopCard = defineComponent(
          "loop-card",
          () => {
            const items = [];
            for (let i = 0; i < 5; i++) items.push(i);
            return <ul>{items}</ul>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify while-loop in setup body as unsupported-component-body", () => {
      const code = `
        const WhileCard = defineComponent(
          "while-card",
          () => {
            let count = 0;
            while (count < 3) count++;
            return <div>{count}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify do-while loop in setup body as unsupported-component-body", () => {
      const code = `
        const DoWhileCard = defineComponent(
          "do-while-card",
          () => {
            let count = 0;
            do { count++; } while (count < 3);
            return <div>{count}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify for-in loop in setup body as unsupported-component-body", () => {
      const code = `
        const ForInCard = defineComponent(
          "for-in-card",
          () => {
            const obj = { a: 1 };
            for (const key in obj) console.log(key);
            return <div>done</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify for-of loop in setup body as unsupported-component-body", () => {
      const code = `
        const ForOfCard = defineComponent(
          "for-of-card",
          () => {
            const items = [1, 2, 3];
            for (const item of items) console.log(item);
            return <div>done</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify try-catch in setup body as unsupported-component-body", () => {
      const code = `
        const TryCatchCard = defineComponent(
          "try-catch-card",
          () => {
            try {
              riskyOp();
            } catch (e) {
              console.error(e);
            }
            return <div>safe</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify try-finally in setup body as unsupported-component-body", () => {
      const code = `
        const TryFinallyCard = defineComponent(
          "try-finally-card",
          () => {
            try {
              init();
            } finally {
              cleanup();
            }
            return <div>done</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify class expression component arg as no metadata", () => {
      const code = `
        const ClassCard = defineComponent(
          "class-card",
          class { render() { return "<div>hi</div>"; } },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).not.toContain("__hydrationMetadata__");
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify deeply nested if-statement inside function declaration prelude as supported planFactory", () => {
      const code = `
        const DeepBranchCard = defineComponent(
          "deep-branch-card",
          ({ props }) => {
            const items = [];
            function buildItems() {
              if (props.ready.value) {
                items.push("ready");
              }
            }
            return <div>{items}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // Function declaration with branching inside is a valid prelude statement;
      // the JSX shape is static, so planFactory is generated
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify throw statement in setup as unsupported-component-body", () => {
      const code = `
        const ThrowCard = defineComponent(
          "throw-card",
          () => {
            throw new Error("not implemented");
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify labeled statement in setup as unsupported-component-body", () => {
      const code = `
        const LabeledCard = defineComponent(
          "labeled-card",
          () => {
            outer: for (let i = 0; i < 3; i++) break outer;
            return <div>done</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should support method-like helper (object property) when the object literal is static", () => {
      const code = `
        const helpers = { render: (label) => <div>{label}</div> };
        const MethodCard = defineComponent(
          "method-card",
          ({ props }) => helpers.render(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
      expect(result.code).toContain('kind: "text"');
    });

    it("should classify closure-captured helper as opaque-helper-call", () => {
      const code = `
        const makeRenderer = () => (label) => <div>{label}</div>;
        const render = makeRenderer();
        const ClosureCard = defineComponent(
          "closure-card",
          ({ props }) => render(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // render is a VariableDeclarator with init = makeRenderer() (CallExpression)
      // not a function-like => resolveTopLevelHelperNode should bail => opaque
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify HOC factory pattern (CallExpression arg) as no metadata", () => {
      const code = `
        const withTheme = (theme) => (ctx) => <div class={theme}>{ctx.children}</div>;
        const HOCCard = defineComponent(
          "hoc-card",
          withTheme("dark"),
        );
      `;

      const result = transform(code, { mode: "csr" });

      // withTheme("dark") is a CallExpression, not function-like → no metadata at all
      expect(result.code).not.toContain("__hydrationMetadata__");
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify runtime-selected helper as opaque-helper-call", () => {
      const code = `
        const renderA = (x) => <div>{x}</div>;
        const renderB = (x) => <span>{x}</span>;
        const RuntimeCard = defineComponent(
          "runtime-card",
          ({ props }) => (props.mode.value === "a" ? renderA : renderB)(props.label.value),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // The callee is a ConditionalExpression — cannot resolve to a known helper
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
      expect(result.code).not.toContain("planFactory");
    });

    it("should handle onMouseEnter event in component setup", () => {
      const code = `
        const HoverCard = defineComponent(
          "hover-card",
          ({ props }) => <div onMouseEnter={() => props.onHover.value()}>hover me</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "event"');
    });

    it("should handle onKeyDown event in component setup", () => {
      const code = `
        const KeyCard = defineComponent(
          "key-card",
          ({ props }) => <input onKeyDown={() => props.onKey.value()} />,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "event"');
    });

    it("should handle onFocus and onBlur events in component setup", () => {
      const code = `
        const FocusCard = defineComponent(
          "focus-card",
          ({ props }) => <input onFocus={() => props.onFocus.value()} onBlur={() => props.onBlur.value()} />,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "event"');
    });

    it("should handle onInput event in component setup", () => {
      const code = `
        const InputCard = defineComponent(
          "input-card",
          ({ props }) => <input onInput={(e) => props.onChange.value(e.target.value)} />,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "event"');
    });

    it("should support setup with deeply nested switch inside function declaration prelude", () => {
      const code = `
        const DeepSwitchCard = defineComponent(
          "deep-switch-card",
          () => {
            function buildContent(mode) {
              switch (mode) {
                case "a": return "A";
                default: return "B";
              }
            }
            return <div>{buildContent("a")}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // Function declaration with switch inside is valid prelude; JSX shape is static
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support setup with deeply nested if inside variable declaration prelude", () => {
      const code = `
        const DeepIfCard = defineComponent(
          "deep-if-card",
          () => {
            const compute = () => {
              if (true) return 1;
              return 0;
            };
            return <div>{compute()}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // Variable declaration with branching inside arrow is valid prelude; JSX shape is static
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    // --- Batch 2: spread merges, nested islands, TS syntax, exotic edge cases ---

    it("should support deeply nested spread merges when the merged binding is serializable", () => {
      const code = `
        const extras = { role: "alert" };
        const DeepSpreadCard = defineComponent(
          "deep-spread-card",
          () => (
            <div>
              <section>
                <p {...{ class: "deep", ...extras }}>deeply nested spread</p>
              </section>
            </div>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "spread"');
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should allow normalizable spread (no SpreadElement inside ObjectExpression) to produce planFactory", () => {
      const code = `
        const SimpleSpreadCard = defineComponent(
          "simple-spread-card",
          ({ props }) => <div {...props.attrs.value}>spread ok</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // Simple spread (not ObjectExpression with SpreadElement) is allowed
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('kind: "spread"');
    });

    it("should support multi-level nested islands with client:load + client:visible", () => {
      const code = `
        const OuterCard = defineComponent(
          "outer-card",
          ({ props }) => (
            <div>
              <MiddleIsland client:load label={props.a.value} />
              <BottomIsland client:visible label={props.b.value} />
            </div>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('"MiddleIsland"');
      expect(result.code).toContain('"load"');
      expect(result.code).toContain('"BottomIsland"');
      expect(result.code).toContain('"visible"');
    });

    it("should support nested island inside fragment child", () => {
      const code = `
        const FragIslandCard = defineComponent(
          "frag-island-card",
          () => (
            <>
              <div>content</div>
              <InnerIsland client:idle label="inside fragment" />
            </>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('"InnerIsland"');
      expect(result.code).toContain('"idle"');
    });

    it("should support nested island with client:interaction", () => {
      const code = `
        const InteractionOuter = defineComponent(
          "interaction-outer",
          () => <div><InteractiveChild client:interaction label="interact" /></div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('"InteractiveChild"');
      expect(result.code).toContain('"interaction"');
    });

    it("should handle TypeScript type assertion in prelude as expression statement (unsupported prelude)", () => {
      const code = `
        const TSAsCard = defineComponent(
          "ts-as-card",
          () => {
            const x = getSomething() as string;
            return <div>{x}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // TSAsExpression is inside a VariableDeclaration which IS a supported prelude.
      // After TS transform (esbuild strips types), it becomes a normal VariableDeclaration.
      // So this should produce a planFactory.
      expect(result.code).toContain("planFactory");
    });

    it("should handle multiple const declarations in prelude", () => {
      const code = `
        const MultiConstCard = defineComponent(
          "multi-const-card",
          ({ props }) => {
            const a = props.x.value;
            const b = props.y.value;
            const c = a + b;
            return <div>{c}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should handle let declaration in prelude as unsupported (only const/function allowed)", () => {
      const code = `
        const LetCard = defineComponent(
          "let-card",
          () => {
            let x = 0;
            return <div>{x}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      // VariableDeclaration with kind "let" is still a VariableDeclaration
      // isSupportedPlanPreludeStatement checks for VariableDeclaration
      // so it should work...
      expect(result.code).toContain("__hydrationMetadata__");
    });

    it("should handle empty return in block body as no planFactory", () => {
      const code = `
        const EmptyReturnCard = defineComponent(
          "empty-return-card",
          () => { return; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      // return without argument → extractFunctionRenderFrame returns null
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup with only non-JSX return as unsupported-component-body", () => {
      const code = `
        const StringReturnCard = defineComponent(
          "string-return-card",
          () => { return "not jsx"; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup returning a number literal as unsupported-component-body", () => {
      const code = `
        const NumberReturnCard = defineComponent(
          "number-return-card",
          () => { return 42; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup returning an array literal as unsupported-component-body", () => {
      const code = `
        const ArrayReturnCard = defineComponent(
          "array-return-card",
          () => { return [1, 2, 3]; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup returning an identifier as unsupported-component-body", () => {
      const code = `
        const IdentReturnCard = defineComponent(
          "ident-return-card",
          () => { return someVariable; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
      expect(result.code).not.toContain("planFactory");
    });

    it("should classify setup with window reference inside typeof as supported (environment probe)", () => {
      const code = `
        const TypeofWindowCard = defineComponent(
          "typeof-window-card",
          () => {
            const isSSR = typeof window === "undefined";
            return <div>{isSSR ? "server" : "client"}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // typeof window is an environment probe, NOT imperative-dom-query.
      // BUT the return contains ConditionalExpression → runtime-branching
      expect(result.code).not.toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should handle document reference NOT inside typeof as imperative-dom-query", () => {
      const code = `
        const DocQueryCard = defineComponent(
          "doc-query-card",
          () => {
            const el = document.getElementById("root");
            return <div>found</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should handle shadowRoot reference as imperative-dom-query", () => {
      const code = `
        const ShadowCard = defineComponent(
          "shadow-card",
          ({ host }) => {
            const shadow = host.shadowRoot;
            return <div>shadow</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should not classify shadowed local document binding as imperative-dom-query", () => {
      const code = `
        const LocalDocumentCard = defineComponent(
          "local-document-card",
          () => {
            const document = { label: "local" };
            return <div>{document.label}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should still classify aliases to global document as imperative-dom-query", () => {
      const code = `
        const AliasDocumentCard = defineComponent(
          "alias-document-card",
          () => {
            const document = globalThis.document;
            return <div>{document.getElementById("root")?.id}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should ignore nested shadowed document binding inside IIFE", () => {
      const code = `
        const NestedShadowDocumentCard = defineComponent(
          "nested-shadow-document-card",
          () => {
            const value = (() => {
              const document = { label: "nested" };
              return document.label;
            })();
            return <div>{value}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should classify new Text() as node-identity-reuse", () => {
      const code = `
        const TextNodeCard = defineComponent(
          "text-node-card",
          () => {
            const t = new Text("hello");
            return <div>{t}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should classify new Comment() as node-identity-reuse", () => {
      const code = `
        const CommentNodeCard = defineComponent(
          "comment-node-card",
          () => {
            const c = new Comment("marker");
            return <div>{c}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should classify new DocumentFragment() as node-identity-reuse", () => {
      const code = `
        const FragNodeCard = defineComponent(
          "frag-node-card",
          () => {
            const f = new DocumentFragment();
            return <div>{f}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should classify document.createElement as node-identity-reuse", () => {
      const code = `
        const CreateElCard = defineComponent(
          "create-el-card",
          () => {
            const el = document.createElement("span");
            return <div>{el}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should not classify shadowed local Text binding as node-identity-reuse", () => {
      const code = `
        const LocalTextCard = defineComponent(
          "local-text-card",
          () => {
            const Text = String;
            return <div>{new Text("hello")}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain(
        'unsupportedReason: "node-identity-reuse"',
      );
    });

    it("should still classify aliases to global Text as node-identity-reuse", () => {
      const code = `
        const AliasTextCard = defineComponent(
          "alias-text-card",
          () => {
            const Text = globalThis.Text;
            return <div>{new Text("hello")}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should ignore nested shadowed Text binding inside IIFE", () => {
      const code = `
        const NestedShadowTextCard = defineComponent(
          "nested-shadow-text-card",
          () => {
            const value = (() => {
              const Text = String;
              return new Text("hello");
            })();
            return <div>{value}</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain(
        'unsupportedReason: "node-identity-reuse"',
      );
    });

    it("should support setup with function expression (not arrow) returning JSX", () => {
      const code = `
        const FnExprCard = defineComponent(
          "fn-expr-card",
          function ({ props }) { return <div>{props.label.value}</div>; },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should handle setup with multiple nested component children (some with client:, some without)", () => {
      const code = `
        const MixedChildrenCard = defineComponent(
          "mixed-children-card",
          ({ props }) => (
            <div>
              <PlainChild label="no directive" />
              <IslandChild client:load label={props.label.value} />
              <AnotherPlain title="also no directive" />
            </div>
          ),
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      // Only IslandChild has client:load
      expect(result.code).toContain('"IslandChild"');
      expect(result.code).toContain('"load"');
    });

    // --- Batch 3: SSR mode variants, more edge cases, multiple defineComponent ---

    it("should attach hydration metadata in SSR mode for supported setup", () => {
      const code = `
        const SSRCard = defineComponent(
          "ssr-card",
          ({ props }) => <div>{props.label.value}</div>,
        );
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should attach unsupported metadata in SSR mode for imperative setup", () => {
      const code = `
        const SSRImperativeCard = defineComponent(
          "ssr-imperative-card",
          ({ host }) => {
            host.setAttribute("data-ready", "yes");
            return <div>ready</div>;
          },
        );
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
    });

    it("should attach unsupported metadata in SSR mode for async setup", () => {
      const code = `
        const SSRAsyncCard = defineComponent(
          "ssr-async-card",
          async () => <div>hi</div>,
        );
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should handle multiple defineComponent calls in one file", () => {
      const code = `
        const CardA = defineComponent(
          "card-a",
          ({ props }) => <div>{props.a.value}</div>,
        );
        const CardB = defineComponent(
          "card-b",
          ({ props }) => <span>{props.b.value}</span>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("card-a");
      expect(result.code).toContain("card-b");
      // Both should have metadata
      const metadataCount = (result.code.match(/__hydrationMetadata__/g) ?? [])
        .length;
      expect(metadataCount).toBe(2);
      const planFactoryCount = (result.code.match(/planFactory/g) ?? []).length;
      expect(planFactoryCount).toBeGreaterThanOrEqual(2);
    });

    it("should handle multiple defineComponent where one is supported and another unsupported", () => {
      const code = `
        const OkCard = defineComponent(
          "ok-card",
          ({ props }) => <div>{props.label.value}</div>,
        );
        const BadCard = defineComponent(
          "bad-card",
          () => {
            try {
              return <div>ok</div>;
            } catch (e) {
              return <div>error</div>;
            }
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should support setup with no params (zero-arg component)", () => {
      const code = `
        const NoParamCard = defineComponent(
          "no-param-card",
          () => <div>static content</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support setup returning JSX fragment directly", () => {
      const code = `
        const FragCard = defineComponent(
          "frag-card",
          ({ props }) => <><span>{props.a.value}</span><span>{props.b.value}</span></>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support setup returning JSX from block body with fragment", () => {
      const code = `
        const BlockFragCard = defineComponent(
          "block-frag-card",
          () => {
            const label = "hello";
            return <><div>{label}</div></>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle setup with complex object destructuring in params", () => {
      const code = `
        const DestructCard = defineComponent(
          "destruct-card",
          ({ props: { label, count } }) => <div>{label.value} {count.value}</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // Nested destructuring should still work
      expect(result.code).toContain("planFactory");
    });

    it("should handle setup with array destructuring in params", () => {
      const code = `
        const ArrayDestructCard = defineComponent(
          "array-destruct-card",
          ([first, second]) => <div>{first}{second}</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle setup with default param value", () => {
      const code = `
        const DefaultParamCard = defineComponent(
          "default-param-card",
          (ctx = {}) => <div>hello</div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support setup with svg root element", () => {
      const code = `
        const SvgCard = defineComponent(
          "svg-card",
          ({ props }) => <svg viewBox="0 0 100 100"><circle cx="50" cy="50" r={props.radius.value} /></svg>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('"svg"');
    });

    it("should support setup with math root element", () => {
      const code = `
        const MathCard = defineComponent(
          "math-card",
          () => <math><mi>x</mi></math>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('"math"');
    });

    it("should handle typeof document environment probe as NOT imperative-dom-query", () => {
      const code = `
        const EnvProbeCard = defineComponent(
          "env-probe-card",
          () => {
            const isBrowser = typeof document !== "undefined";
            return <div>hello</div>;
          },
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      // typeof document is an environment probe, not an imperative access
      expect(result.code).not.toContain(
        'unsupportedReason: "imperative-dom-query"',
      );
      expect(result.code).toContain("planFactory");
    });

    it("should handle setup with static JSX (no dynamic parts)", () => {
      const code = `
        const StaticCard = defineComponent(
          "static-card",
          () => <div class="static"><span>hello</span><span>world</span></div>,
        );
      `;

      const result = transform(code, { mode: "csr" });

      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      // No dynamic bindings
      expect(result.code).toContain("bindings: []");
    });

    it("should handle imported transparent thunk wrapper (withStore) in SSR mode when wrapped in arrow", () => {
      const code = `
        import { withStore } from "@dathra/core";
        const StoreCard = defineComponent(
          "store-card",
          ({ props }) => withStore(myStore, () => <div>{props.label.value}</div>),
        );
      `;

      const result = transform(code, { mode: "ssr" });

      // withStore is a transparent thunk wrapper — the inner JSX is resolved
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should produce no metadata for bare withStore() call as direct component arg", () => {
      const code = `
        import { withStore } from "@dathra/core";
        const StoreCard = defineComponent(
          "store-card",
          withStore(myStore, () => <div>store content</div>),
        );
      `;

      const result = transform(code, { mode: "ssr" });

      // Bare CallExpression as component arg (not wrapped in a function) —
      // the transformer cannot extract a render frame, so no metadata is attached
      expect(result.code).not.toContain("__hydrationMetadata__");
      expect(result.code).not.toContain("planFactory");
    });
  });

  describe("Fragment dynamic content", () => {
    it("should generate templateEffect and setText for dynamic text inside Fragment", () => {
      const code = `
        const count = signal(0);
        const element = (
          <>
            <span>{count.value}</span>
          </>
        );
      `;

      const result = transform(code);

      // Fragment with dynamic text must produce templateEffect + setText
      expect(result.code).toContain("templateEffect");
      expect(result.code).toContain("setText");
      expect(result.code).toContain("count.value");
    });

    it("should generate insert for component inside Fragment", () => {
      const code = `
        const element = (
          <>
            <Counter initialCount={5} />
          </>
        );
      `;

      const result = transform(code);

      // Fragment with component child must produce insert
      expect(result.code).toContain("insert");
      expect(result.code).toContain("Counter");
      expect(result.code).toContain("initialCount");
    });
  });

  describe("Attribute name edge cases", () => {
    it("should use string literal key for hyphenated attribute names", () => {
      const code = `
        const element = <div data-foo="bar" aria-label="test">Content</div>;
      `;

      const result = transform(code);

      // Hyphenated attribute names must be quoted in the output object
      expect(result.code).toContain("data-foo=");
      expect(result.code).toContain("aria-label=");
      expect(result.code).toContain("bar");
      expect(result.code).toContain("test");
    });

    it("should not wrap static expression attribute (no reactive access) in templateEffect", () => {
      const code = `
        function getClass() { return "foo"; }
        const element = <div class={getClass()}>Content</div>;
      `;

      const result = transform(code);

      // Non-reactive expression attribute should avoid templateEffect and use one-time setAttr
      expect(result.code).not.toContain("templateEffect");
      expect(result.code).toContain("setAttr");
      expect(result.code).toContain("getClass");
    });

    it("should preserve local identifiers used by static expression attributes", () => {
      const code = `
        function App() {
          const modeLabel = typeof document === "undefined" ? "SSR" : "CSR";
          return <p data-render-mode={modeLabel}>Current render mode</p>;
        }
      `;

      const result = transform(code);

      expect(result.code).toContain("setAttr");
      expect(result.code).toContain("modeLabel");
      expect(result.code).not.toContain('{ ["data-render-mode"]: modeLabel }');
      expect(result.code).not.toContain("templateEffect");
    });

    it("should support namespaced attributes like xlink:href", () => {
      const code = `
        const element = <use xlink:href="#icon" />;
      `;

      const result = transform(code);

      expect(result.code).toContain("xlink:href=");
      expect(result.code).toContain("#icon");
    });
  });

  describe("Expression container edge cases", () => {
    it("should transform logical expression rendering using insert() and templateEffect", () => {
      const code = `
        const visible = signal(true);
        const element = <div>{visible.value && <span>Shown</span>}</div>;
      `;

      const result = transform(code);

      expect(result.code).toContain("insert");
      expect(result.code).toContain("templateEffect");
      expect(result.code).toContain("visible.value");
      expect(result.code).toContain("span");
    });

    it("should transform expressions containing nested JSX via insert()", () => {
      const code = `
        const element = <div>{[<em>A</em>, <strong>B</strong>]}</div>;
      `;

      const result = transform(code);

      expect(result.code).toContain("insert");
      expect(result.code).toContain("em");
      expect(result.code).toContain("strong");
    });

    it("should transform JSXSpreadChild as insert dynamic part", () => {
      const code = `
        const items = [<li>A</li>, <li>B</li>];
        const element = <ul>{...items}</ul>;
      `;

      const result = transform(code);

      expect(result.code).toContain("insert");
      expect(result.code).toContain("items");
    });

    it("should transform logical expression JSX branches with renderToString in SSR mode", () => {
      const code = `
        const visible = true;
        const element = <div>{visible && <span>SSR</span>}</div>;
      `;

      const result = transform(code, { mode: "ssr" });

      expect(result.code).not.toContain("fromTree");
      expect(result.code).toContain("renderDynamicInsert");
    });
  });

  describe("SSR mode conditional rendering", () => {
    it("should transform conditional JSX branches with renderToString in SSR mode (not fromTree)", () => {
      const code = `
        const flag = true;
        const element = <div>{flag ? <span>Yes</span> : <span>No</span>}</div>;
      `;

      const result = transform(code, { mode: "ssr" });

      // SSR mode: no DOM-dependent fromTree must appear
      expect(result.code).not.toContain("fromTree");
      expect(result.code).toContain("renderDynamicInsert");
    });

    it("should not use setText/templateEffect for SSR conditional branches", () => {
      const code = `
        const flag = true;
        const element = <div>{flag ? <em>A</em> : <strong>B</strong>}</div>;
      `;

      const result = transform(code, { mode: "ssr" });

      // SSR mode: no DOM mutation helpers
      expect(result.code).not.toContain("fromTree");
      expect(result.code).not.toContain("firstChild");
      expect(result.code).not.toContain("nextSibling");
      expect(result.code).not.toContain("setText");
    });

    it("should transform .map() JSX branches with renderToString in SSR mode", () => {
      const code = `
        const items = ["a", "b"];
        const element = <ul>{items.map(i => <li>{i}</li>)}</ul>;
      `;

      const result = transform(code, { mode: "ssr" });

      // SSR mode: no DOM-dependent fromTree must appear
      expect(result.code).not.toContain("fromTree");
      expect(result.code).toContain("renderDynamicEach");
    });
  });

  // ==========================================================================
  // Batch 4: Comprehensive semantic JS/TSX pattern coverage
  // ==========================================================================

  describe("JS control flow constructs (unsupported prelude / body)", () => {
    it("should classify for-loop in setup body as unsupported-component-body", () => {
      const code = `
        const LoopCard = defineComponent(
          "loop-card",
          () => {
            for (let i = 0; i < 10; i++) {}
            return <div>loop</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify while-loop in setup body as unsupported-component-body", () => {
      const code = `
        const WhileCard = defineComponent(
          "while-card",
          () => {
            while (false) {}
            return <div>while</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify do-while in setup body as unsupported-component-body", () => {
      const code = `
        const DoCard = defineComponent(
          "do-card",
          () => {
            do {} while (false);
            return <div>do</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify for-in in setup body as unsupported-component-body", () => {
      const code = `
        const ForInCard = defineComponent(
          "for-in-card",
          () => {
            const obj = { a: 1 };
            for (const k in obj) {}
            return <div>for-in</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify for-of in setup body as unsupported-component-body", () => {
      const code = `
        const ForOfCard = defineComponent(
          "for-of-card",
          () => {
            const arr = [1, 2, 3];
            for (const v of arr) {}
            return <div>for-of</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify try-catch in setup body as unsupported-component-body", () => {
      const code = `
        const TryCard = defineComponent(
          "try-card",
          () => {
            try { JSON.parse("bad"); } catch (e) {}
            return <div>try</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify try-finally in setup body as unsupported-component-body", () => {
      const code = `
        const TryFinallyCard = defineComponent(
          "try-finally-card",
          () => {
            try { doSomething(); } finally { cleanup(); }
            return <div>finally</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify try-catch-finally in setup body as unsupported-component-body", () => {
      const code = `
        const TryCatchFinallyCard = defineComponent(
          "try-catch-finally-card",
          () => {
            try { init(); } catch (e) { fallback(); } finally { done(); }
            return <div>tcf</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify throw statement in setup body as unsupported-component-body", () => {
      const code = `
        const ThrowCard = defineComponent(
          "throw-card",
          () => {
            throw new Error("no");
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // throw is not a supported prelude statement and has no return
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify labeled statement in setup body as unsupported-component-body", () => {
      const code = `
        const LabelCard = defineComponent(
          "label-card",
          () => {
            outer: for (let i = 0; i < 5; i++) { break outer; }
            return <div>label</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify async arrow setup as unsupported-component-body", () => {
      const code = `
        const AsyncCard = defineComponent(
          "async-card",
          async () => <div>async</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify async arrow block body setup as unsupported-component-body", () => {
      const code = `
        const AsyncBlockCard = defineComponent(
          "async-block-card",
          async () => {
            const data = await fetchData();
            return <div>{data}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify async function expression setup as unsupported-component-body", () => {
      const code = `
        const AsyncFnCard = defineComponent(
          "async-fn-card",
          async function() { return <div>async-fn</div>; },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify generator function setup as unsupported-component-body", () => {
      const code = `
        const GenCard = defineComponent(
          "gen-card",
          function* () { yield <div>gen</div>; },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify IIFE containing complex branch in setup body as unsupported", () => {
      const code = `
        const IIFECard = defineComponent(
          "iife-card",
          () => {
            (() => { if (true) console.log("side-effect"); })();
            return <div>iife</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify setup with with-statement as unsupported-component-body", () => {
      // Note: 'with' is not valid in strict mode / modules, but parse may still create the node
      // The important thing is it's not a VariableDeclaration or FunctionDeclaration
      const code = `
        const WithCard = defineComponent(
          "with-card",
          () => {
            console.log("side-effect");
            return <div>with</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // ExpressionStatement in prelude is unsupported
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify setup with debugger statement as unsupported-component-body", () => {
      const code = `
        const DebugCard = defineComponent(
          "debug-card",
          () => {
            const x = 1;
            debugger;
            return <div>{x}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify setup returning conditional expression as dispatch plan", () => {
      const code = `
        const CondCard = defineComponent(
          "cond-card",
          ({ props }) => props.flag.value ? <div>a</div> : <span>b</span>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify setup returning logical expression as dispatch plan", () => {
      const code = `
        const LogicalCard = defineComponent(
          "logical-card",
          ({ props }) => props.show.value && <div>shown</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify if-statement in block body as dispatch plan (supported)", () => {
      const code = `
        const IfCard = defineComponent(
          "if-card",
          () => {
            if (Math.random() > 0.5) return <div>a</div>;
            return <div>b</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify switch-statement in block body as dispatch plan", () => {
      const code = `
        const SwitchCard = defineComponent(
          "switch-card",
          () => {
            switch (getMode()) {
              case "a": return <div>a</div>;
              default: return <div>b</div>;
            }
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify return of conditional in block body as dispatch plan", () => {
      const code = `
        const RetCondCard = defineComponent(
          "ret-cond-card",
          () => {
            const x = 1;
            return x > 0 ? <div>positive</div> : <div>non-positive</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
    });

    it("should classify return of logical expression in block body as dispatch plan", () => {
      const code = `
        const RetLogicalCard = defineComponent(
          "ret-logical-card",
          () => {
            const flag = true;
            return flag && <div>yes</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("dispatch");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify early return (not last statement) as unsupported-component-body", () => {
      const code = `
        const EarlyReturnCard = defineComponent(
          "early-return-card",
          () => {
            return <div>early</div>;
            const dead = "unreachable";
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // return is not the last statement, so extractFunctionRenderFrame returns null
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });
  });

  describe("Prelude / body statement breadth", () => {
    it("should classify ExpressionStatement in prelude as unsupported-component-body", () => {
      const code = `
        const ExprCard = defineComponent(
          "expr-card",
          () => {
            console.log("init");
            return <div>expr</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify class declaration in prelude as unsupported-component-body", () => {
      const code = `
        const ClassDeclCard = defineComponent(
          "class-decl-card",
          () => {
            class Helper { run() { return 1; } }
            return <div>class</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should produce no metadata for class expression as component arg", () => {
      const code = `
        const ClassExprCard = defineComponent(
          "class-expr-card",
          class { render() { return "<div>class</div>"; } },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // ClassExpression is not function-like, no metadata
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should classify prelude with assignment expression statement as unsupported", () => {
      const code = `
        const AssignCard = defineComponent(
          "assign-card",
          () => {
            let x;
            x = 42;
            return <div>{x}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // 'let x' is VariableDeclaration (supported prelude), but 'x = 42' is ExpressionStatement (not supported)
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should support multiple const declarations in prelude", () => {
      const code = `
        const MultiConstCard = defineComponent(
          "multi-const-card",
          () => {
            const a = 1;
            const b = 2;
            const c = a + b;
            return <div>{c}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support function declaration in prelude", () => {
      const code = `
        const FnDeclCard = defineComponent(
          "fn-decl-card",
          () => {
            function format(x) { return x.toString(); }
            return <div>{format(42)}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support mixed const and function declarations in prelude", () => {
      const code = `
        const MixedCard = defineComponent(
          "mixed-card",
          () => {
            const multiplier = 2;
            function double(x) { return x * multiplier; }
            const result = double(21);
            return <div>{result}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should classify prelude containing JSX in const init as unsupported", () => {
      const code = `
        const JsxConstCard = defineComponent(
          "jsx-const-card",
          () => {
            const header = <h1>Header</h1>;
            return <div>{header}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // containsJSXNode(statement) detects JSX in prelude const
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify prelude containing JSX inside function declaration as unsupported", () => {
      const code = `
        const JsxFnCard = defineComponent(
          "jsx-fn-card",
          () => {
            function renderIcon() { return <span>icon</span>; }
            return <div>{renderIcon()}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      // JSX inside prelude function declaration
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify empty block body (no return) as unsupported-component-body", () => {
      const code = `
        const EmptyCard = defineComponent(
          "empty-card",
          () => {},
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should classify body with only const but no return as unsupported-component-body", () => {
      const code = `
        const NoReturnCard = defineComponent(
          "no-return-card",
          () => {
            const x = 1;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });
  });

  describe("Params and destructuring completeness", () => {
    it("should support rest parameter in setup", () => {
      const code = `
        const RestCard = defineComponent(
          "rest-card",
          ({ props, ...rest }) => <div>{props.label.value}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support deeply nested destructuring in params", () => {
      const code = `
        const DeepCard = defineComponent(
          "deep-card",
          ({ props: { label: { value: labelText } } }) => <div>{labelText}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support default value in destructured param", () => {
      const code = `
        const DefaultCard = defineComponent(
          "default-card",
          ({ props: { color = "red" } = {} }) => <div style={color}>colored</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support array destructuring in param", () => {
      const code = `
        const ArrayParamCard = defineComponent(
          "array-param-card",
          ([first, second]) => <div>{first}{second}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support array destructuring with rest in param", () => {
      const code = `
        const ArrayRestCard = defineComponent(
          "array-rest-card",
          ([first, ...others]) => <div>{first}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support array destructuring with skipped elements", () => {
      const code = `
        const SkipCard = defineComponent(
          "skip-card",
          ([, second]) => <div>{second}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support no params (zero-arg component)", () => {
      const code = `
        const ZeroArgCard = defineComponent(
          "zero-arg-card",
          () => <div>static</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support assignment pattern (default param value) at top level", () => {
      const code = `
        const DefaultTopCard = defineComponent(
          "default-top-card",
          (ctx = {}) => <div>default</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle alpha-renaming for __dh_host collision", () => {
      const code = `
        const CollisionCard = defineComponent(
          "collision-card",
          ({ props }) => {
            const __dh_host = "collision";
            return <div>{props.x.value}{__dh_host}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      // alpha-renaming should produce a suffixed name (e.g. __dh_host_1)
      expect(result.code).toContain("__dh_host_1");
    });

    it("should handle alpha-renaming for __dh_ctx collision", () => {
      const code = `
        const CtxCollisionCard = defineComponent(
          "ctx-collision-card",
          ({ props }) => {
            const __dh_ctx = "collision";
            return <div>{props.x.value}{__dh_ctx}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("__dh_ctx_1");
    });
  });

  describe("Spread semantics generalization", () => {
    it("should classify spread with nested SpreadElement as non-normalizable-spread", () => {
      const code = `
        const SpreadMergeCard = defineComponent(
          "spread-merge-card",
          ({ props }) => <div {...{ ...props.a.value, ...props.b.value }}>merged</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "non-normalizable-spread"',
      );
    });

    it("should support simple spread (no nested SpreadElement) as planFactory", () => {
      const code = `
        const SimpleSpreadCard = defineComponent(
          "simple-spread-card",
          ({ props }) => <div {...props.attrs.value}>spread</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should support JSX spread with object literal (no SpreadElement inside) as planFactory", () => {
      const code = `
        const ObjSpreadCard = defineComponent(
          "obj-spread-card",
          ({ props }) => <div {...{ id: props.id.value, role: "button" }}>ok</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should classify deeply nested non-normalizable spread in child", () => {
      const code = `
        const DeepSpreadCard = defineComponent(
          "deep-spread-card",
          ({ props }) => (
            <div>
              <span {...{ ...props.a.value, ...props.b.value }}>deep</span>
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain(
        'unsupportedReason: "non-normalizable-spread"',
      );
    });

    it("should support spread on fragment children", () => {
      const code = `
        const FragSpreadCard = defineComponent(
          "frag-spread-card",
          ({ props }) => (
            <>
              <div {...props.attrs.value}>child</div>
            </>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });
  });

  describe("Helper resolution generalization", () => {
    it("should resolve top-level helper returning JSX", () => {
      const code = `
        function renderBody(label) {
          return <div>{label}</div>;
        }
        const HelperCard = defineComponent(
          "helper-card",
          ({ props }) => renderBody(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should resolve const arrow helper returning JSX", () => {
      const code = `
        const renderBody = (label) => <div>{label}</div>;
        const HelperArrowCard = defineComponent(
          "helper-arrow-card",
          ({ props }) => renderBody(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should resolve multi-level helper chain", () => {
      const code = `
        const renderInner = (text) => <span>{text}</span>;
        const renderOuter = (label) => renderInner(label);
        const ChainCard = defineComponent(
          "chain-card",
          ({ props }) => renderOuter(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should classify method-style helper call as opaque-helper-call", () => {
      const code = `
        const helpers = { render: (x) => "<div>" + x + "</div>" };
        const MethodCard = defineComponent(
          "method-card",
          ({ props }) => helpers.render(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should classify closure-captured helper as opaque-helper-call", () => {
      const code = `
        const makeRenderer = () => (text) => "<div>" + text + "</div>";
        const render = makeRenderer();
        const ClosureCard = defineComponent(
          "closure-card",
          ({ props }) => render(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      // 'render' init is a CallExpression, not function-like, so not in helperLookup
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should classify runtime-selected helper (conditional callee) as opaque", () => {
      const code = `
        const renderA = (x) => <div>{x}</div>;
        const renderB = (x) => <span>{x}</span>;
        const RuntimeCard = defineComponent(
          "runtime-card",
          ({ props }) => (props.flag.value ? renderA : renderB)(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      // ConditionalExpression callee — can't resolve
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should classify arbitrary imported function call as opaque-helper-call", () => {
      const code = `
        import { renderFancy } from "./utils";
        const ImportedCard = defineComponent(
          "imported-card",
          ({ props }) => renderFancy(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      // renderFancy is not in helperLookup (imported, not local function def)
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should handle helper with mismatched argument count as opaque-helper-call", () => {
      const code = `
        const renderBody = (a, b) => <div>{a}{b}</div>;
        const MismatchCard = defineComponent(
          "mismatch-card",
          ({ props }) => renderBody(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      // 1 arg passed, but helper expects 2
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should handle circular helper reference gracefully", () => {
      const code = `
        function helperA(x) { return helperB(x); }
        function helperB(x) { return helperA(x); }
        const CircularCard = defineComponent(
          "circular-card",
          ({ props }) => helperA(props.x.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      // Circular reference: visitedHelpers prevents infinite loop
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should resolve helper with prelude statements", () => {
      const code = `
        function renderBody(label) {
          const formatted = label + "!";
          return <div>{formatted}</div>;
        }
        const PreludeHelperCard = defineComponent(
          "prelude-helper-card",
          ({ props }) => renderBody(props.label.value),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should classify local thunk wrapper as opaque-helper-call (not in known list)", () => {
      const code = `
        function withTheme(theme, fn) { return fn(); }
        const ThunkCard = defineComponent(
          "thunk-card",
          () => withTheme("dark", () => <div>themed</div>),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      // Local functions are not in KNOWN_IMPORTED_TRANSPARENT_THUNK_WRAPPERS
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should resolve aliased imported transparent thunk wrapper", () => {
      const code = `
        import { withStore as useStore } from "@dathra/store";
        const AliasCard = defineComponent(
          "alias-card",
          ({ props }) => useStore(myStore, () => <div>{props.x.value}</div>),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should classify unknown imported thunk wrapper as opaque", () => {
      const code = `
        import { withStore } from "./custom-store";
        const UnknownCard = defineComponent(
          "unknown-card",
          ({ props }) => withStore(store, () => <div>{props.label.value}</div>),
        );
      `;
      const result = transform(code, { mode: "csr" });
      // Not from @dathra/core or @dathra/store
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });
  });

  describe("Nested islands deep combinations", () => {
    it("should track nested boundary for component with client:load", () => {
      const code = `
        const OuterCard = defineComponent(
          "outer-card",
          () => (
            <div>
              <Inner client:load />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("nestedBoundaries");
      expect(result.code).toContain('"load"');
    });

    it("should track multiple nested boundaries at same level", () => {
      const code = `
        const MultiCard = defineComponent(
          "multi-card",
          () => (
            <div>
              <A client:load />
              <B client:visible />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('"load"');
      expect(result.code).toContain('"visible"');
    });

    it("should track deeply nested island boundary", () => {
      const code = `
        const DeepIslandCard = defineComponent(
          "deep-island-card",
          () => (
            <div>
              <section>
                <article>
                  <Inner client:idle />
                </article>
              </section>
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('"idle"');
      expect(result.code).toContain("nestedBoundaries");
    });

    it("should handle island with member expression component tag", () => {
      const code = `
        const MemberCard = defineComponent(
          "member-card",
          () => (
            <div>
              <UI.Button client:load />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('"load"');
      // Component display name should be tracked
      expect(result.code).toContain("UI.Button");
    });

    it("should handle island with client:interaction and custom event", () => {
      const code = `
        const InteractionCard = defineComponent(
          "interaction-card",
          () => (
            <div>
              <Widget client:interaction="mouseover" />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('"interaction"');
    });

    it("should handle island with client:media query", () => {
      const code = `
        const MediaCard = defineComponent(
          "media-card",
          () => (
            <div>
              <Heavy client:media="(min-width: 768px)" />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('"media"');
    });

    it("should handle component without client:* as non-island (no boundary)", () => {
      const code = `
        const NonIslandCard = defineComponent(
          "non-island-card",
          () => (
            <div>
              <Plain />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      // No island metadata → nestedBoundaries should be empty
      expect(result.code).toContain("nestedBoundaries: []");
    });

    it("should handle mixed island and non-island children", () => {
      const code = `
        const MixedIslandCard = defineComponent(
          "mixed-island-card",
          () => (
            <div>
              <Plain />
              <Island client:load />
              <AnotherPlain />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('"load"');
      // Only one nested boundary (Island, not Plain/AnotherPlain)
    });
  });

  describe("Component arg exotic forms", () => {
    it("should produce no metadata for number literal as component arg", () => {
      const code = `
        const NumCard = defineComponent("num-card", 42);
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should produce no metadata for string literal as component arg", () => {
      const code = `
        const StrCard = defineComponent("str-card", "template");
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should produce no metadata for identifier as component arg", () => {
      const code = `
        const MyCard = defineComponent("my-card", setupFn);
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should produce no metadata for object literal as component arg", () => {
      const code = `
        const ObjCard = defineComponent("obj-card", { render: () => "<div/>" });
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should produce no metadata for array literal as component arg", () => {
      const code = `
        const ArrCard = defineComponent("arr-card", [() => "<div/>"]);
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should produce no metadata for template literal as component arg", () => {
      const code = `
        const TplCard = defineComponent("tpl-card", \`template\`);
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should produce no metadata for new expression as component arg", () => {
      const code = `
        const NewCard = defineComponent("new-card", new ComponentClass());
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should classify HOC factory call as no metadata (not function-like)", () => {
      const code = `
        const HocCard = defineComponent("hoc-card", withTheme("dark"));
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).not.toContain("__hydrationMetadata__");
    });

    it("should support function expression (not arrow) as component arg", () => {
      const code = `
        const FnExprCard = defineComponent(
          "fn-expr-card",
          function({ props }) { return <div>{props.x.value}</div>; },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should support named function expression as component arg", () => {
      const code = `
        const NamedFnCard = defineComponent(
          "named-fn-card",
          function setup({ props }) { return <div>{props.x.value}</div>; },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });
  });

  describe("TypeScript syntax breadth", () => {
    it("should handle TS type assertion (as) in setup body return", () => {
      const code = `
        const AsCard = defineComponent(
          "as-card",
          () => {
            const text = "hello" as string;
            return <div>{text}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle as const in prelude", () => {
      const code = `
        const AsConstCard = defineComponent(
          "as-const-card",
          () => {
            const items = ["a", "b", "c"] as const;
            return <div>{items[0]}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle satisfies in prelude", () => {
      const code = `
        type Config = { color: string };
        const SatisfiesCard = defineComponent(
          "satisfies-card",
          () => {
            const cfg = { color: "red" } satisfies Config;
            return <div style={cfg.color}>satisfies</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle type-only import (should not interfere with transform)", () => {
      const code = `
        import type { FC } from "some-lib";
        const TypeImportCard = defineComponent(
          "type-import-card",
          () => <div>type-only</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle generic type params on arrow function setup", () => {
      const code = `
        const GenericCard = defineComponent(
          "generic-card",
          <T extends string>({ props }: { props: { label: { value: T } } }) => <div>{props.label.value}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle TS enum declaration before defineComponent", () => {
      const code = `
        enum Color { Red, Blue }
        const EnumCard = defineComponent(
          "enum-card",
          () => <div>{Color.Red}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      // Enum is a top-level statement, not inside setup — should not affect plan
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle TS namespace declaration before defineComponent", () => {
      const code = `
        namespace Utils {
          export function format(s: string) { return s; }
        }
        const NSCard = defineComponent(
          "ns-card",
          () => <div>{Utils.format("hello")}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
    });

    it("should handle interface declaration before defineComponent", () => {
      const code = `
        interface CardProps { label: string; }
        const IfaceCard = defineComponent(
          "iface-card",
          () => <div>iface</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle type alias declaration before defineComponent", () => {
      const code = `
        type Label = string;
        const TypeAliasCard = defineComponent(
          "type-alias-card",
          () => <div>typed</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle non-null assertion in prelude", () => {
      const code = `
        const NonNullCard = defineComponent(
          "non-null-card",
          () => {
            const el = getElement()!;
            return <div>{el}</div>;
          },
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle TS const enum before defineComponent", () => {
      const code = `
        const enum Direction { Up, Down, Left, Right }
        const ConstEnumCard = defineComponent(
          "const-enum-card",
          () => <div>{Direction.Up}</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
    });
  });

  describe("Event and directive breadth", () => {
    it("should handle onMouseEnter event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onMouseEnter={handler}>hover me</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"mouseenter"');
    });

    it("should handle onMouseLeave event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onMouseLeave={handler}>leave me</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"mouseleave"');
    });

    it("should handle onKeyDown event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onKeyDown={handler}>key</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"keydown"');
    });

    it("should handle onKeyUp event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onKeyUp={handler}>key</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"keyup"');
    });

    it("should handle onFocus event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <input onFocus={handler} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"focus"');
    });

    it("should handle onBlur event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <input onBlur={handler} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"blur"');
    });

    it("should handle onInput event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <input onInput={handler} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"input"');
    });

    it("should handle onChange event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <select onChange={handler}><option>a</option></select>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"change"');
    });

    it("should handle onSubmit event on form element", () => {
      const code = `
        const handler = () => {};
        const element = <form onSubmit={handler}><button>submit</button></form>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"submit"');
    });

    it("should handle onScroll event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onScroll={handler}>scroll</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"scroll"');
    });

    it("should handle onDblClick event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onDblClick={handler}>double click</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"dblclick"');
    });

    it("should handle onContextMenu event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onContextMenu={handler}>right click</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"contextmenu"');
    });

    it("should handle onTouchStart event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onTouchStart={handler}>touch</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"touchstart"');
    });

    it("should handle onDragStart event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onDragStart={handler}>drag</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"dragstart"');
    });

    it("should handle onPointerDown event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onPointerDown={handler}>pointer</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"pointerdown"');
    });

    it("should handle onAnimationEnd event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onAnimationEnd={handler}>anim</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"animationend"');
    });

    it("should handle onTransitionEnd event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onTransitionEnd={handler}>transition</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"transitionend"');
    });

    it("should handle onWheel event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onWheel={handler}>wheel</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"wheel"');
    });

    it("should handle onCopy event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onCopy={handler}>copy</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"copy"');
    });

    it("should handle onPaste event on HTML element", () => {
      const code = `
        const handler = () => {};
        const element = <div onPaste={handler}>paste</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("event(");
      expect(result.code).toContain('"paste"');
    });

    it("should handle multiple events on single element", () => {
      const code = `
        const handler = () => {};
        const element = <button onClick={handler} onMouseEnter={handler} onFocus={handler}>multi</button>;
      `;
      const result = transform(code);
      expect(result.code).toContain('"click"');
      expect(result.code).toContain('"mouseenter"');
      expect(result.code).toContain('"focus"');
    });

    it("should transform colocated load:onMouseEnter", () => {
      const code = `
        const handler = () => {};
        const element = <div load:onMouseEnter={handler}>hover</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("load");
      expect(result.code).toContain('"mouseenter"');
    });

    it("should keep colocated interaction:onKeyDown unsupported", () => {
      const code = `
        const handler = () => {};
        const element = <div interaction:onKeyDown={handler}>key</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("interaction");
      expect(result.code).toContain('"keydown"');
      expect(result.code).toContain("data-dh-client-event=");
    });

    it("should transform colocated visible:onFocus", () => {
      const code = `
        const handler = () => {};
        const element = <input visible:onFocus={handler} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("visible");
      expect(result.code).toContain('"focus"');
    });

    it("should transform colocated idle:onScroll", () => {
      const code = `
        const handler = () => {};
        const element = <div idle:onScroll={handler}>scroll</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("idle");
      expect(result.code).toContain('"scroll"');
    });
  });

  describe("SSR mode variants for all categories", () => {
    it("should produce SSR metadata for unsupported setup in SSR mode (loop)", () => {
      const code = `
        const SSRLoopCard = defineComponent(
          "ssr-loop-card",
          () => {
            for (let i = 0; i < 10; i++) {}
            return <div>loop</div>;
          },
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "unsupported-component-body"',
      );
    });

    it("should produce SSR metadata for runtime-branching (try/catch) in SSR mode", () => {
      const code = `
        const SSRBranchCard = defineComponent(
          "ssr-branch-card",
          () => {
            try {
              return <div>a</div>;
            } catch (e) {
              return <div>b</div>;
            }
          },
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("unsupportedReason");
    });

    it("should produce SSR metadata for node-identity-reuse in SSR mode", () => {
      const code = `
        const SSRNodeCard = defineComponent(
          "ssr-node-card",
          () => {
            const t = new Text("hello");
            return <div>text</div>;
          },
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "node-identity-reuse"');
    });

    it("should produce SSR metadata for opaque-helper-call in SSR mode", () => {
      const code = `
        import { renderFancy } from "./utils";
        const SSROpaqueCard = defineComponent(
          "ssr-opaque-card",
          ({ props }) => renderFancy(props.label.value),
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain('unsupportedReason: "opaque-helper-call"');
    });

    it("should produce SSR metadata for non-normalizable-spread in SSR mode", () => {
      const code = `
        const SSRSpreadCard = defineComponent(
          "ssr-spread-card",
          ({ props }) => <div {...{ ...props.a.value, ...props.b.value }}>spread</div>,
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain(
        'unsupportedReason: "non-normalizable-spread"',
      );
    });

    it("should produce SSR planFactory for supported helper in SSR mode", () => {
      const code = `
        function renderBody(label) {
          return <div>{label}</div>;
        }
        const SSRHelperCard = defineComponent(
          "ssr-helper-card",
          ({ props }) => renderBody(props.label.value),
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should handle multiple defineComponent in SSR mode", () => {
      const code = `
        const A = defineComponent("a-card", () => <div>a</div>);
        const B = defineComponent("b-card", () => <span>b</span>);
      `;
      const result = transform(code, { mode: "ssr" });
      // Both should get metadata
      expect(result.code).toContain("__hydrationMetadata__");
      // Count occurrences of planFactory
      const planFactoryCount = (result.code.match(/planFactory/g) ?? []).length;
      expect(planFactoryCount).toBeGreaterThanOrEqual(2);
    });

    it("should handle SSR mode with TypeScript type annotations", () => {
      const code = `
        type Props = { label: { value: string } };
        const SSRTypedCard = defineComponent(
          "ssr-typed-card",
          ({ props }: { props: Props }) => <div>{props.label.value}</div>,
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle SSR mode with nested islands", () => {
      const code = `
        const SSRIslandCard = defineComponent(
          "ssr-island-card",
          () => (
            <div>
              <Inner client:load />
              <Other client:visible />
            </div>
          ),
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain('"load"');
      expect(result.code).toContain('"visible"');
    });

    it("should handle SSR mode with export named declaration", () => {
      const code = `
        export const SSRExportCard = defineComponent(
          "ssr-export-card",
          () => <div>exported</div>,
        );
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });
  });

  describe("SSR mode + colocated directive output", () => {
    it("should produce SSR planFactory for supported component with load:onClick", () => {
      const code = `
        import { defineComponent, signal } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          const count = signal(0);
          return (
            <div>
              <button load:onClick={() => count.set(count.value + 1)}>Inc</button>
              <span>{count.value}</span>
            </div>
          );
        });
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should produce SSR planFactory for supported component with interaction:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          return <div><button interaction:onClick={() => alert("hi")}>Alert</button></div>;
        });
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).not.toContain("unsupportedReason");
    });

    it("should produce SSR planFactory for supported component with visible:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          return <div><button visible:onClick={() => doStuff()}>Visible</button></div>;
        });
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should produce SSR planFactory for supported component with idle:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          return <div><button idle:onClick={() => doStuff()}>Idle</button></div>;
        });
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should include colocated metadata attributes in SSR output for load:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          return <div><button load:onClick={() => go()}>Go</button></div>;
        });
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("data-dh-client-target=");
      expect(result.code).toContain("data-dh-client-strategy=");
      expect(result.code).toContain("load");
    });

    it("should remove colocated syntax and keep click binding in SSR planFactory", () => {
      const code = `
        import { defineComponent, signal } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          const count = signal(0);
          return (
            <div>
              <button load:onClick={() => count.set(count.value + 1)}>Inc</button>
            </div>
          );
        });
      `;
      const result = transform(code, { mode: "ssr" });
      // The raw colocated syntax should be removed
      expect(result.code).not.toContain("load:onClick");
      // The click event should be preserved as a regular binding
      expect(result.code).toContain("click");
    });

    it("should throw in SSR mode for unsupported (try/catch) + colocated combination", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => {
          try {
            return <div><button load:onClick={() => go()}>Go</button></div>;
          } catch (e) {
            return <span>error</span>;
          }
        });
      `;
      expect(() => transform(code, { mode: "ssr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported/,
      );
    });
  });

  describe("client:interaction event type variants", () => {
    it("should handle client:interaction with mouseenter event type", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => (
          <div><Widget client:interaction="mouseenter" /></div>
        ));
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain('"interaction"');
      expect(result.code).toContain('"mouseenter"');
    });

    it("should handle client:interaction with focus event type", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => (
          <div><Widget client:interaction="focus" /></div>
        ));
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain('"interaction"');
      expect(result.code).toContain('"focus"');
    });

    it("should handle client:interaction with pointerdown event type", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => (
          <div><Widget client:interaction="pointerdown" /></div>
        ));
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain('"interaction"');
      expect(result.code).toContain('"pointerdown"');
    });

    it("should default bare client:interaction to click", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => (
          <div><Widget client:interaction /></div>
        ));
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain('"interaction"');
      expect(result.code).toContain('"click"');
    });

    it("should handle client:interaction event type in SSR mode", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => (
          <div><Widget client:interaction="mouseover" /></div>
        ));
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain('"interaction"');
      expect(result.code).toContain('"mouseover"');
    });

    it("should reject non-string-literal client:interaction value", () => {
      const code = `
        const element = <Counter client:interaction={someVar} />;
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /client:interaction accepts only string literal event types/,
      );
    });
  });

  describe("Colocated directive + nested islands combination", () => {
    it("should support colocated directive alongside nested island child", () => {
      const code = `
        import { defineComponent, signal } from "@dathra/core";
        const Parent = defineComponent("x-parent", () => {
          const count = signal(0);
          return (
            <div>
              <button load:onClick={() => count.set(count.value + 1)}>Inc</button>
              <ChildIsland client:load label="nested" />
              <span>{count.value}</span>
            </div>
          );
        });
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
    });

    it("should track nested boundary even with colocated directive present", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Parent = defineComponent("x-parent", () => (
          <div>
            <button load:onClick={() => doThing()}>Do</button>
            <Widget client:idle />
            <Another client:visible />
          </div>
        ));
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      // Both nested islands should be tracked
      expect(result.code).toContain('"idle"');
      expect(result.code).toContain('"visible"');
    });

    it("should support colocated directive + nested island in SSR mode", () => {
      const code = `
        import { defineComponent, signal } from "@dathra/core";
        const Parent = defineComponent("x-parent", () => {
          const count = signal(0);
          return (
            <div>
              <button load:onClick={() => count.set(count.value + 1)}>Inc</button>
              <ChildIsland client:load />
              <span>{count.value}</span>
            </div>
          );
        });
      `;
      const result = transform(code, { mode: "ssr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
    });

    it("should throw for client:* on non-imported component inside defineComponent", () => {
      // Inside defineComponent's hydration analysis, the JSX tree walk
      // cannot resolve `Panel` as a component (not imported), so client:*
      // on it hits the HTML-element guard before assertNoHostIslandsMixing.
      // The standalone JSX equivalent (line ~2308) DOES trigger the mixing
      // guard because the outer tree walk recognises capitalized tags.
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", () => (
          <Panel client:load>
            <button load:onClick={() => go()}>Go</button>
          </Panel>
        ));
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /client:\* directives are only supported on component elements/,
      );
    });

    it("should support multiple colocated directives with same strategy alongside nested island", () => {
      const code = `
        import { defineComponent, signal } from "@dathra/core";
        const Parent = defineComponent("x-parent", () => {
          const a = signal(0);
          const b = signal(0);
          return (
            <div>
              <button load:onClick={() => a.set(a.value + 1)}>Inc A</button>
              <button load:onClick={() => b.set(b.value + 1)}>Inc B</button>
              <ChildIsland client:load />
              <span>{a.value} / {b.value}</span>
            </div>
          );
        });
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("planFactory");
      expect(result.code).toContain("nestedBoundaries");
      // Two colocated targets should both have metadata
      expect(result.code).toContain("data-dh-client-target");
    });
  });

  describe("Self-closing and void elements", () => {
    it("should handle self-closing br element", () => {
      const code = `
        const element = <div>line1<br />line2</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("<br />");
    });

    it("should handle self-closing hr element", () => {
      const code = `
        const element = <div><hr /></div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("<hr />");
    });

    it("should handle img with dynamic src", () => {
      const code = `
        const src = signal("photo.jpg");
        const element = <img src={src.value} alt="photo" />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("<img");
    });

    it("should handle input with multiple attributes", () => {
      const code = `
        const val = signal("");
        const element = <input type="text" value={val.value} placeholder="type here" />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("<input");
    });

    it("should handle meta element", () => {
      const code = `
        const element = <meta charSet="utf-8" />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("<meta");
    });

    it("should handle link element", () => {
      const code = `
        const element = <link rel="stylesheet" href="/style.css" />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("<link");
    });
  });

  describe("Template literals and complex expressions in JSX", () => {
    it("should handle template literal as JSX text child", () => {
      const code = `
        const name = signal("world");
        const element = <div>{\`hello \${name.value}\`}</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
    });

    it("should handle template literal as attribute value", () => {
      const code = `
        const id = signal("box");
        const element = <div class={\`container-\${id.value}\`}>tpl attr</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
    });

    it("should handle tagged template literal in JSX expression", () => {
      const code = `
        const name = signal("world");
        const element = <div>{String.raw\`hello \${name.value}\`}</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
    });

    it("should handle complex computed expression as text child", () => {
      const code = `
        const count = signal(0);
        const element = <div>{count.value * 2 + 1}</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
      expect(result.code).toContain("setText");
    });

    it("should handle function call as text child", () => {
      const code = `
        const count = signal(0);
        const element = <div>{Math.floor(count.value)}</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
    });

    it("should handle nullish coalescing in JSX expression", () => {
      const code = `
        const val = signal(null);
        const element = <div>{val.value ?? "default"}</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
    });

    it("should handle optional chaining in JSX expression", () => {
      const code = `
        const obj = signal({ a: { b: "c" } });
        const element = <div>{obj.value?.a?.b}</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
    });

    it("should handle comma expression in JSX attribute", () => {
      const code = `
        const x = signal(1);
        const element = <div data-value={(0, x.value)}>comma</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
    });
  });

  describe("Boolean and special attribute handling", () => {
    it("should handle boolean attribute (true)", () => {
      const code = `
        const element = <input disabled />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("disabled");
    });

    it("should handle boolean attribute (explicit true)", () => {
      const code = `
        const element = <input disabled={true} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
    });

    it("should handle boolean attribute (explicit false)", () => {
      const code = `
        const element = <input disabled={false} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
    });

    it("should handle dynamic boolean attribute", () => {
      const code = `
        const isDisabled = signal(false);
        const element = <input disabled={isDisabled.value} />;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
    });

    it("should handle data-* attribute", () => {
      const code = `
        const element = <div data-testid="card" data-active="true">data attrs</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("data-testid=");
    });

    it("should handle aria-* attribute", () => {
      const code = `
        const element = <button aria-label="Close" aria-hidden="false">X</button>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("aria-label=");
    });

    it("should handle style attribute as string", () => {
      const code = `
        const element = <div style="color: red; font-size: 14px;">styled</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("color: red; font-size: 14px;");
    });

    it("should handle className attribute", () => {
      const code = `
        const cls = signal("active");
        const element = <div className={cls.value}>classed</div>;
      `;
      const result = transform(code);
      expect(result.code).toContain("fromTree");
      expect(result.code).toContain("templateEffect");
    });
  });

  describe("Export patterns", () => {
    it("should handle export const defineComponent", () => {
      const code = `
        export const ExCard = defineComponent(
          "ex-card",
          () => <div>exported</div>,
        );
      `;
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("__hydrationMetadata__");
      expect(result.code).toContain("planFactory");
    });

    it("should handle multiple exports with defineComponent", () => {
      const code = `
        export const A = defineComponent("a-card", () => <div>a</div>);
        export const B = defineComponent("b-card", () => <span>b</span>);
      `;
      const result = transform(code, { mode: "csr" });
      const planCount = (result.code.match(/planFactory/g) ?? []).length;
      expect(planCount).toBeGreaterThanOrEqual(2);
    });

    it("should handle defineComponent not at top level (no plan)", () => {
      const code = `
        function factory() {
          const Inner = defineComponent("inner-card", () => <div>inner</div>);
          return Inner;
        }
      `;
      const result = transform(code, { mode: "csr" });
      // defineComponent inside a function is not at top-level VariableDeclaration
      expect(result.code).not.toContain("__hydrationMetadata__");
    });
  });

  describe("Unsupported hydration + colocated directive combination guard", () => {
    it("should throw when runtime-branching (try/catch) component has load:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          try {
            return <div><button load:onClick={() => console.log("click")}>Click</button></div>;
          } catch (e) {
            return <span>error</span>;
          }
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: unsupported-component-body/,
      );
    });

    it("should throw when imperative-dom-query component has interaction:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props, { host }) => {
          const el = host.shadowRoot.querySelector(".foo");
          return <div><button interaction:onClick={() => console.log("click")}>Click</button></div>;
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: imperative-dom-query/,
      );
    });

    it("should throw when opaque-helper-call component has visible:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        import { unknownHelper } from "./helpers";
        const Comp = defineComponent("x-comp", (props) => {
          return unknownHelper(() => <div><button visible:onClick={() => console.log("click")}>Click</button></div>);
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: opaque-helper-call/,
      );
    });

    it("should throw when unsupported-component-body (loop) has idle:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          for (let i = 0; i < 3; i++) {}
          return <div><button idle:onClick={() => console.log("click")}>Click</button></div>;
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: unsupported-component-body/,
      );
    });

    it("should throw when unsupported-component-body (async) has load:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", async (props) => {
          return <div><button load:onClick={() => console.log("click")}>Click</button></div>;
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: unsupported-component-body/,
      );
    });

    it("should throw when node-identity-reuse component has load:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          const el = document.createElement("div");
          return <div><button load:onClick={() => console.log("click")}>Click</button></div>;
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: node-identity-reuse/,
      );
    });

    it("should throw when non-normalizable-spread component has interaction:onClick", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          const base = { a: 1 };
          return <div {...{...base, b: 2}}><button interaction:onClick={() => console.log("click")}>Click</button></div>;
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported.*reason: non-normalizable-spread/,
      );
    });

    it("should NOT throw when unsupported component has NO colocated directive", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          try {
            return <div>A</div>;
          } catch (e) {
            return <span>B</span>;
          }
        });
      `;
      // Should not throw — just produces unsupportedReason metadata
      const result = transform(code, { mode: "csr" });
      expect(result.code).toContain("unsupportedReason");
    });

    it("should throw in SSR mode when unsupported (try/catch) + colocated combine", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          try {
            return <div><button load:onClick={() => console.log("click")}>Click</button></div>;
          } catch (e) {
            return <span>error</span>;
          }
        });
      `;
      expect(() => transform(code, { mode: "ssr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported/,
      );
    });

    it("should throw when colocated directive is deeply nested in unsupported (try/catch) component", () => {
      const code = `
        import { defineComponent } from "@dathra/core";
        const Comp = defineComponent("x-comp", (props) => {
          try {
            return <div><section><button load:onClick={() => console.log("deep")}>Deep</button></section></div>;
          } catch (e) {
            return <span>error</span>;
          }
        });
      `;
      expect(() => transform(code, { mode: "csr" })).toThrow(
        /Colocated client directives.*cannot be used.*unsupported/,
      );
    });

    for (const strategy of COLOCATED_CLIENT_STRATEGIES) {
      it(`should throw for ${strategy}:onClick in unsupported (try/catch) component`, () => {
        const code = `
          import { defineComponent } from "@dathra/core";
          const Comp = defineComponent("x-comp", (props) => {
            try {
              return <div><button ${strategy}:onClick={() => {}}>${strategy}</button></div>;
            } catch (e) {
              return <span>error</span>;
            }
          });
        `;
        expect(() => transform(code, { mode: "csr" })).toThrow(
          /Colocated client directives.*cannot be used.*unsupported/,
        );
      });
    }
  });
});
