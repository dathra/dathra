import { describe, expect, it } from "vitest";
import {
  CLIENT_ACTIONS_METADATA_ATTRIBUTE,
  CLIENT_EVENT_METADATA_ATTRIBUTE,
  CLIENT_STRATEGY_METADATA_ATTRIBUTE,
  CLIENT_TARGET_METADATA_ATTRIBUTE,
  DEFAULT_INTERACTION_EVENT_TYPE,
  ISLAND_METADATA_ATTRIBUTE,
  ISLAND_VALUE_METADATA_ATTRIBUTE,
} from "@dathra/shared";

import { nId, nLit, type ESTNode } from "@/transform/ast/implementation";
import { createInitialState } from "@/transform/state/implementation";
import type {
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  JSXSpreadChild,
  JSXText,
} from "@/transform/jsx/implementation";

import {
  buildComponentCall,
  containsReactiveAccess,
  jsxToTree,
  processAttributes,
  type NestedTransformers,
} from "./implementation";

interface ObjectExpressionLike {
  type: "ObjectExpression";
  properties: Array<{
    key: { type: string; name?: string; value?: unknown };
    value?: { type?: string; value?: unknown };
  }>;
}

interface CallExpressionLike {
  arguments: ObjectExpressionLike[];
}

function asCallExpressionLike(node: ESTNode): CallExpressionLike {
  return node as unknown as CallExpressionLike;
}

function asObjectExpressionLike(node: ESTNode): ObjectExpressionLike {
  return node as unknown as ObjectExpressionLike;
}

function hasIdentifierKey(
  property: ObjectExpressionLike["properties"][number],
  name: string,
): boolean {
  return property.key.type === "Identifier" && property.key.name === name;
}

function requireDefined<T>(value: T | undefined): T {
  expect(value).toBeDefined();
  if (value === undefined) {
    throw new Error("Expected value to be defined");
  }
  return value;
}

const nested: NestedTransformers = {
  transformJSXNode: () => nId("CSR_NODE"),
  transformJSXForSSRNode: () => nId("SSR_NODE"),
};

function text(value: string): JSXText {
  return { type: "JSXText", value };
}

function expr(expression: ESTNode): JSXExpressionContainer {
  return { type: "JSXExpressionContainer", expression };
}

function div(
  children: (
    | JSXElement
    | JSXFragment
    | JSXText
    | JSXExpressionContainer
    | JSXSpreadChild
  )[],
): JSXElement {
  return {
    type: "JSXElement",
    openingElement: {
      type: "JSXOpeningElement",
      name: { type: "JSXIdentifier", name: "div" },
      attributes: [],
      selfClosing: false,
    },
    children,
    closingElement: null,
  };
}

describe("transform/tree", () => {
  it("containsReactiveAccess detects .value member usage", () => {
    const reactive = {
      type: "MemberExpression",
      object: nId("count"),
      property: nId("value"),
      computed: false,
      optional: false,
    };
    const plain = {
      type: "MemberExpression",
      object: nId("foo"),
      property: nId("bar"),
      computed: false,
      optional: false,
    };

    expect(containsReactiveAccess(reactive)).toBe(true);
    expect(containsReactiveAccess(plain)).toBe(false);
  });

  it("processAttributes emits dynamic attr part for reactive expression", () => {
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];
    const attributes: Parameters<typeof processAttributes>[0] = [
      {
        type: "JSXAttribute",
        name: { type: "JSXIdentifier", name: "class" },
        value: expr({
          type: "MemberExpression",
          object: nId("state"),
          property: nId("value"),
          computed: false,
          optional: false,
        }),
      },
    ];

    processAttributes(
      attributes,
      dynamicParts,
      [0],
      createInitialState("csr"),
      {
        strategy: null,
        interactionEventType: null,
      },
    );

    expect(dynamicParts).toHaveLength(1);
    const attrPart = requireDefined(dynamicParts[0]);
    expect(attrPart.type).toBe("attr");
    expect(attrPart.type === "attr" ? attrPart.key : null).toBe("class");
  });

  it("processAttributes keeps non-reactive expression attributes as attr dynamic parts", () => {
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];
    const attributes: Parameters<typeof processAttributes>[0] = [
      {
        type: "JSXAttribute",
        name: { type: "JSXIdentifier", name: "data-render-mode" },
        value: expr(nId("modeLabel")),
      },
    ];

    const result = processAttributes(
      attributes,
      dynamicParts,
      [0],
      createInitialState("csr"),
      {
        strategy: null,
        interactionEventType: null,
      },
    );

    expect(result.attrs).toEqual(nLit(null));
    expect(dynamicParts).toHaveLength(1);
    const attrPart = requireDefined(dynamicParts[0]);
    expect(attrPart.type).toBe("attr");
    expect(attrPart.type === "attr" ? attrPart.key : null).toBe(
      "data-render-mode",
    );
    expect(attrPart.expression).toEqual(nId("modeLabel"));
  });

  it("jsxToTree keeps fragment dynamic text parts", () => {
    const state = createInitialState("csr");
    const fragment: JSXFragment = {
      type: "JSXFragment",
      children: [div([expr(nId("count"))])],
    };

    const result = jsxToTree(fragment, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "text")).toBe(true);
  });

  it("jsxToTree records component child as insert component part", () => {
    const state = createInitialState("csr");
    const tree = div([
      {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: { type: "JSXIdentifier", name: "Counter" },
          attributes: [],
          selfClosing: true,
        },
        children: [],
        closingElement: null,
      },
      text("ok"),
    ]);

    const result = jsxToTree(tree, state, nested);
    const insertPart = result.dynamicParts.find(
      (part) => part.type === "insert",
    );

    expect(insertPart).toBeDefined();
    expect(insertPart?.isComponent).toBe(true);
  });

  it("processAttributes keeps namespaced attribute keys as string literals", () => {
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];
    const attributes: Parameters<typeof processAttributes>[0] = [
      {
        type: "JSXAttribute",
        name: {
          type: "JSXNamespacedName",
          namespace: { type: "JSXIdentifier", name: "xlink" },
          name: { type: "JSXIdentifier", name: "href" },
        },
        value: { type: "Literal", value: "#icon", raw: '"#icon"' },
      },
    ];

    const result = processAttributes(
      attributes,
      dynamicParts,
      [0],
      createInitialState("csr"),
      {
        strategy: null,
        interactionEventType: null,
      },
    );

    expect(result.attrs.type).toBe("ObjectExpression");
    const objectExpression = result.attrs as {
      type: "ObjectExpression";
      properties: Array<{ key: { type: string; value?: unknown } }>;
    };
    const keyNode = requireDefined(objectExpression.properties[0]).key;
    expect(keyNode.type).toBe("Literal");
    expect(keyNode.value).toBe("xlink:href");
  });

  it("jsxToTree treats logical expression children as insert dynamic parts", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "LogicalExpression",
        operator: "&&",
        left: nId("visible"),
        right: {
          type: "JSXElement",
          openingElement: {
            type: "JSXOpeningElement",
            name: { type: "JSXIdentifier", name: "span" },
            attributes: [],
            selfClosing: false,
          },
          children: [{ type: "JSXText", value: "ok" }],
          closingElement: null,
        },
      }),
    ]);

    const result = jsxToTree(tree, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree treats expressions that contain nested JSX as insert dynamic parts", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "ArrayExpression",
        elements: [
          {
            type: "JSXElement",
            openingElement: {
              type: "JSXOpeningElement",
              name: { type: "JSXIdentifier", name: "em" },
              attributes: [],
              selfClosing: false,
            },
            children: [{ type: "JSXText", value: "a" }],
            closingElement: null,
          },
        ],
      }),
    ]);

    const result = jsxToTree(tree, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree treats JSXSpreadChild as insert dynamic parts", () => {
    const state = createInitialState("csr");
    const tree = div([
      {
        type: "JSXSpreadChild",
        expression: nId("children"),
      },
    ]);

    const result = jsxToTree(tree, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("keeps local expression identifiers intact in dynamic text parts", () => {
    const state = createInitialState("csr");
    const tree = div([expr(nId("modeLabel"))]);

    const result = jsxToTree(tree, state, nested);
    const textPart = result.dynamicParts.find((part) => part.type === "text");

    expect(textPart).toBeDefined();
    expect(textPart?.expression).toEqual(nId("modeLabel"));
  });

  it("jsxToTree treats .map() call expression as insert dynamic part", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "CallExpression",
        callee: {
          type: "MemberExpression",
          object: nId("items"),
          property: nId("map"),
          computed: false,
          optional: false,
        },
        arguments: [nId("renderItem")],
        optional: false,
      }),
    ]);

    const result = jsxToTree(tree, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree treats ConditionalExpression as insert dynamic part", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "ConditionalExpression",
        test: nId("active"),
        consequent: nLit("yes"),
        alternate: nLit("no"),
      }),
    ]);

    const result = jsxToTree(tree, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree treats generic CallExpression as insert dynamic part", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "CallExpression",
        callee: nId("renderContent"),
        arguments: [],
        optional: false,
      }),
    ]);

    const result = jsxToTree(tree, state, nested);

    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("processAttributes classifies event handler as event dynamic part", () => {
    const state = createInitialState("csr");
    const element: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "button" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "onClick" },
            value: expr(nId("handleClick")),
          },
        ],
        selfClosing: false,
      },
      children: [],
      closingElement: null,
    };

    const result = jsxToTree(element, state, nested);

    const eventPart = result.dynamicParts.find((part) => part.type === "event");
    expect(eventPart).toBeDefined();
    expect(eventPart?.type === "event" ? eventPart.key : null).toBe("click");
  });

  it("buildComponentCall injects island metadata for client:visible", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visible" },
            },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );

    const props = result.arguments[0];
    expect(props.type).toBe("ObjectExpression");
    expect(
      props.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === ISLAND_METADATA_ATTRIBUTE,
      ),
    ).toBe(true);
  });

  it("buildComponentCall defaults bare client:interaction to click metadata", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "interaction" },
            },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );

    const props = result.arguments[0];
    const interactionValue = requireDefined(
      props.properties.find(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === ISLAND_VALUE_METADATA_ATTRIBUTE,
      ),
    );
    const interactionNodeValue = requireDefined(interactionValue.value);

    expect(interactionNodeValue.type).toBe("Literal");
    expect(interactionNodeValue.value).toBe(DEFAULT_INTERACTION_EVENT_TYPE);
  });

  it("buildComponentCall turns component load:onClick into host island metadata plus client action metadata", () => {
    const state = createInitialState("csr");
    state.moduleBindings.add("handleClick");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr(nId("handleClick")),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = asObjectExpressionLike(
      result.arguments[0] as unknown as ESTNode,
    );

    expect(
      props.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === ISLAND_METADATA_ATTRIBUTE &&
          property.value?.type === "Literal" &&
          property.value.value === "load",
      ),
    ).toBe(true);
    expect(
      props.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === CLIENT_ACTIONS_METADATA_ATTRIBUTE &&
          property.value?.type === "CallExpression",
      ),
    ).toBe(true);
    expect(state.componentClientActions).toHaveLength(1);
    expect(state.componentClientActions[0]?.id).toBe("dh-ca-1");
  });

  it("buildComponentCall turns component interaction:onKeyDown into host island value metadata", () => {
    const state = createInitialState("csr");
    state.moduleBindings.add("handleKeyDown");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "interaction" },
              name: { type: "JSXIdentifier", name: "onKeyDown" },
            },
            value: expr(nId("handleKeyDown")),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = asObjectExpressionLike(
      result.arguments[0] as unknown as ESTNode,
    );

    expect(
      props.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === ISLAND_METADATA_ATTRIBUTE &&
          property.value?.type === "Literal" &&
          property.value.value === "interaction",
      ),
    ).toBe(true);
    expect(
      props.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === ISLAND_VALUE_METADATA_ATTRIBUTE &&
          property.value?.type === "Literal" &&
          property.value.value === "keydown",
      ),
    ).toBe(true);
  });

  it("jsxToTree throws when client directive is used on html element", () => {
    const state = createInitialState("csr");
    const element: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "div" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visible" },
            },
            value: null,
          },
        ],
        selfClosing: false,
      },
      children: [],
      closingElement: null,
    };

    expect(() => jsxToTree(element, state, nested)).toThrow(
      "client:* directives are only supported on component elements",
    );
  });

  it("jsxToTree throws for unknown client directives on html elements", () => {
    const state = createInitialState("csr");
    const element: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "div" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visibile" },
            },
            value: null,
          },
        ],
        selfClosing: false,
      },
      children: [],
      closingElement: null,
    };

    expect(() => jsxToTree(element, state, nested)).toThrow(
      "Unknown client:* directive",
    );
  });

  it("processAttributes turns load:onClick into metadata attrs plus click event", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];
    const attributes: Parameters<typeof processAttributes>[0] = [
      {
        type: "JSXAttribute",
        name: {
          type: "JSXNamespacedName",
          namespace: { type: "JSXIdentifier", name: "load" },
          name: { type: "JSXIdentifier", name: "onClick" },
        },
        value: expr(nId("handleClick")),
      },
    ];

    const result = processAttributes(attributes, dynamicParts, [0], state, {
      strategy: null,
      interactionEventType: null,
    });

    expect(result.attrs.type).toBe("ObjectExpression");
    expect(result.events).toEqual([
      {
        type: "click",
        handler: nId("handleClick"),
      },
    ]);
    const objectExpression = asObjectExpressionLike(result.attrs);
    expect(
      objectExpression.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === CLIENT_TARGET_METADATA_ATTRIBUTE,
      ),
    ).toBe(true);
    expect(
      objectExpression.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === CLIENT_STRATEGY_METADATA_ATTRIBUTE &&
          property.value?.value === "load",
      ),
    ).toBe(true);
  });

  it("processAttributes throws when author supplies compiler-reserved client metadata", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "data-dh-client-target" },
            value: { type: "Literal", value: "author", raw: '"author"' },
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow(
      "data-dh-client-target is compiler-reserved metadata and cannot be authored directly",
    );
  });

  it("buildComponentCall throws for invalid media directive values", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "media" },
            },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "client:media requires a string literal media query",
    );
  });

  it("buildComponentCall throws when valueless directives receive a value", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visible" },
            },
            value: { type: "Literal", value: "later", raw: '"later"' },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "client:visible does not accept a value",
    );
  });

  it("buildComponentCall throws for unknown client directives", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visibile" },
            },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "Unknown client:* directive",
    );
  });

  it("buildComponentCall throws for explicit reserved metadata collisions", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visible" },
            },
            value: null,
          },
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "data-dh-island" },
            value: { type: "Literal", value: "manual", raw: '"manual"' },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "cannot be combined with explicit data-dh-island metadata",
    );
  });

  it("buildComponentCall passes single text child as children prop", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [text("Hello World")],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.type).toBe("Literal");
    expect(childrenValue.value).toBe("Hello World");
  });

  it("buildComponentCall passes multiple children as array", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [text("Hello"), text("World")],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.type).toBe("ArrayExpression");
  });

  it("buildComponentCall handles expression container children", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Wrapper" },
        attributes: [],
        selfClosing: false,
      },
      children: [expr(nId("content"))],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    expect(childrenProp).toBeDefined();
  });

  it("buildComponentCall skips JSXEmptyExpression children", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXExpressionContainer",
          expression: { type: "JSXEmptyExpression" },
        } as JSXExpressionContainer,
        text("content"),
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.type).toBe("Literal");
    expect(childrenValue.value).toBe("content");
  });

  it("buildComponentCall skips whitespace-only JSXText children", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [text("  \n  "), text("actual content")],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.value).toBe("actual content");
  });

  it("buildComponentCall handles JSXSpreadChild as child", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Wrapper" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXSpreadChild",
          expression: nId("items"),
        } as JSXSpreadChild,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    expect(childrenProp).toBeDefined();
  });

  it("buildComponentCall handles nested component element children", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Outer" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXElement",
          openingElement: {
            type: "JSXOpeningElement",
            name: { type: "JSXIdentifier", name: "Inner" },
            attributes: [],
            selfClosing: true,
          },
          children: [],
          closingElement: null,
        } as JSXElement,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    // Inner component should be a CallExpression (buildComponentCall result)
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.type).toBe("CallExpression");
  });

  it("buildComponentCall handles nested HTML element children", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXElement",
          openingElement: {
            type: "JSXOpeningElement",
            name: { type: "JSXIdentifier", name: "div" },
            attributes: [],
            selfClosing: false,
          },
          children: [text("hello")],
          closingElement: null,
        } as JSXElement,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    // HTML child should be transformed by transformJSXNode (returns nId("CSR_NODE"))
    const childrenValue = requireDefined(childrenProp.value) as {
      name?: string;
    };
    expect(childrenValue.name).toBe("CSR_NODE");
  });

  it("buildComponentCall handles SSR mode for HTML element children", () => {
    const state = createInitialState("ssr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXElement",
          openingElement: {
            type: "JSXOpeningElement",
            name: { type: "JSXIdentifier", name: "div" },
            attributes: [],
            selfClosing: false,
          },
          children: [text("hello")],
          closingElement: null,
        } as JSXElement,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    // SSR mode should use transformJSXForSSRNode (returns nId("SSR_NODE"))
    const childrenValue = requireDefined(childrenProp.value) as {
      name?: string;
    };
    expect(childrenValue.name).toBe("SSR_NODE");
  });

  it("buildComponentCall handles JSXFragment children", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [text("alpha"), text("beta")],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    // Fragment flattens its children, so we should get an array of two text nodes
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.type).toBe("ArrayExpression");
  });

  it("buildComponentCall handles fragment with expression container child", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [expr(nId("content"))],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = props.properties.find((p) =>
      hasIdentifierKey(p, "children"),
    );
    expect(childrenProp).toBeDefined();
  });

  it("buildComponentCall handles fragment with JSXSpreadChild", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [
            {
              type: "JSXSpreadChild",
              expression: nId("items"),
            } as JSXSpreadChild,
          ],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = props.properties.find((p) =>
      hasIdentifierKey(p, "children"),
    );
    expect(childrenProp).toBeDefined();
  });

  it("buildComponentCall handles fragment with nested component element", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [
            {
              type: "JSXElement",
              openingElement: {
                type: "JSXOpeningElement",
                name: { type: "JSXIdentifier", name: "Inner" },
                attributes: [],
                selfClosing: true,
              },
              children: [],
              closingElement: null,
            } as JSXElement,
          ],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.type).toBe("CallExpression");
  });

  it("buildComponentCall handles fragment with nested HTML element", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [
            {
              type: "JSXElement",
              openingElement: {
                type: "JSXOpeningElement",
                name: { type: "JSXIdentifier", name: "span" },
                attributes: [],
                selfClosing: false,
              },
              children: [text("hi")],
              closingElement: null,
            } as JSXElement,
          ],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value) as {
      name?: string;
    };
    expect(childrenValue.name).toBe("CSR_NODE");
  });

  it("buildComponentCall handles fragment with HTML element in SSR mode", () => {
    const state = createInitialState("ssr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [
            {
              type: "JSXElement",
              openingElement: {
                type: "JSXOpeningElement",
                name: { type: "JSXIdentifier", name: "span" },
                attributes: [],
                selfClosing: false,
              },
              children: [text("hi")],
              closingElement: null,
            } as JSXElement,
          ],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value) as {
      name?: string;
    };
    expect(childrenValue.name).toBe("SSR_NODE");
  });

  it("buildComponentCall handles expression container with nested JSX as child", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        expr({
          type: "ArrayExpression",
          elements: [
            {
              type: "JSXElement",
              openingElement: {
                type: "JSXOpeningElement",
                name: { type: "JSXIdentifier", name: "em" },
                attributes: [],
                selfClosing: false,
              },
              children: [{ type: "JSXText", value: "nested" }],
              closingElement: null,
            },
          ],
        }),
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = props.properties.find((p) =>
      hasIdentifierKey(p, "children"),
    );
    expect(childrenProp).toBeDefined();
  });

  it("buildComponentCall handles fragment with empty expression container child", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [
            {
              type: "JSXExpressionContainer",
              expression: { type: "JSXEmptyExpression" },
            } as JSXExpressionContainer,
            text("after"),
          ],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = requireDefined(
      props.properties.find((p) => hasIdentifierKey(p, "children")),
    );
    const childrenValue = requireDefined(childrenProp.value);
    expect(childrenValue.value).toBe("after");
  });

  it("buildComponentCall handles fragment with expression containing nested JSX", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Layout" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXFragment",
          children: [
            expr({
              type: "ArrayExpression",
              elements: [
                {
                  type: "JSXElement",
                  openingElement: {
                    type: "JSXOpeningElement",
                    name: { type: "JSXIdentifier", name: "em" },
                    attributes: [],
                    selfClosing: false,
                  },
                  children: [{ type: "JSXText", value: "nested" }],
                  closingElement: null,
                },
              ],
            }),
          ],
        } as JSXFragment,
      ],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    const childrenProp = props.properties.find((p) =>
      hasIdentifierKey(p, "children"),
    );
    expect(childrenProp).toBeDefined();
  });

  it("processAttributes throws for colocated directive in SVG namespace", () => {
    const state = createInitialState("csr");
    state.currentElementNamespace = "svg";
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr(nId("handler")),
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("is only supported on HTML elements");
  });

  it("processAttributes throws for colocated directive in math namespace", () => {
    const state = createInitialState("csr");
    state.currentElementNamespace = "math";
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr(nId("handler")),
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("is only supported on HTML elements");
  });

  it("jsxToTree skips JSXEmptyExpression children in processChildren", () => {
    const state = createInitialState("csr");
    const tree = div([
      {
        type: "JSXExpressionContainer",
        expression: { type: "JSXEmptyExpression" },
      } as JSXExpressionContainer,
      text("after"),
    ]);

    const result = jsxToTree(tree, state, nested);
    // Only the text child should produce a dynamic part
    expect(result.dynamicParts).toHaveLength(0);
  });

  it("jsxToTree treats expressions containing nested JSXFragment as insert dynamic parts", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "ArrayExpression",
        elements: [
          {
            type: "JSXFragment",
            children: [{ type: "JSXText", value: "hello" }],
          },
        ],
      }),
    ]);

    const result = jsxToTree(tree, state, nested);
    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("processAttributes throws for unsupported colocated directive format", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "click" },
            },
            value: expr(nId("handler")),
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("Unsupported colocated client directive");
  });

  it("processAttributes stores client event metadata for non-click interaction", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    const result = processAttributes(
      [
        {
          type: "JSXAttribute",
          name: {
            type: "JSXNamespacedName",
            namespace: { type: "JSXIdentifier", name: "interaction" },
            name: { type: "JSXIdentifier", name: "onKeyDown" },
          },
          value: expr(nId("handler")),
        },
      ],
      dynamicParts,
      [0],
      state,
      { strategy: null, interactionEventType: null },
    );

    const attrs = asObjectExpressionLike(result.attrs);
    expect(
      attrs.properties.some(
        (property) =>
          "type" in property &&
          property.type === "Property" &&
          property.key.type === "Literal" &&
          property.key.value === CLIENT_EVENT_METADATA_ATTRIBUTE &&
          property.value !== undefined &&
          property.value.type === "Literal" &&
          property.value.value === "keydown",
      ),
    ).toBe(true);
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.type).toBe("keydown");
    expect(result.events[0]?.handler.type).toBe("Identifier");
  });

  it("processAttributes throws for mixed interaction event types", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "interaction" },
              name: { type: "JSXIdentifier", name: "onMouseEnter" },
            },
            value: expr(nId("handler")),
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: "interaction", interactionEventType: "keydown" },
      ),
    ).toThrow(
      "Mixed colocated interaction event types are not supported in one JSX root",
    );
  });

  it("processAttributes throws for unknown client directive on html element", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "hover" },
            },
            value: null,
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("Unknown client:* directive");
  });

  it("processAttributes handles boolean attribute with null value", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    const result = processAttributes(
      [
        {
          type: "JSXAttribute",
          name: { type: "JSXIdentifier", name: "disabled" },
          value: null,
        },
      ],
      dynamicParts,
      [0],
      state,
      { strategy: null, interactionEventType: null },
    );

    const objExpression = asObjectExpressionLike(result.attrs);
    expect(objExpression.properties).toHaveLength(1);
    expect(objExpression.properties[0]?.key).toEqual(
      expect.objectContaining({ type: "Identifier" }),
    );
  });

  it("processAttributes handles spread attribute", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    const result = processAttributes(
      [
        {
          type: "JSXSpreadAttribute",
          argument: nId("props"),
        },
      ],
      dynamicParts,
      [0],
      state,
      { strategy: null, interactionEventType: null },
    );

    expect(result.attrs).toEqual(expect.objectContaining({ type: "Literal" }));
    expect(dynamicParts).toEqual([
      expect.objectContaining({ type: "spread", expression: nId("props") }),
    ]);
  });

  it("buildComponentCall handles spread attribute on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXSpreadAttribute",
            argument: nId("props"),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    // Should include spread element in properties
    expect(props.properties.length).toBeGreaterThan(0);
  });

  it("processAttributes throws for colocated directive with null value", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: null,
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("requires an inline handler expression");
  });

  it("processAttributes throws for colocated directive with JSXEmptyExpression value", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: {
              type: "JSXExpressionContainer",
              expression: { type: "JSXEmptyExpression" },
            },
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("requires an inline handler expression");
  });

  it("processAttributes throws for mixed colocated client strategies", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr(nId("handler1")),
          },
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "idle" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr(nId("handler2")),
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: "load", interactionEventType: null },
      ),
    ).toThrow("Mixed colocated client strategies");
  });

  it("processAttributes handles JSXEmptyExpression attribute value skip", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    const result = processAttributes(
      [
        {
          type: "JSXAttribute",
          name: { type: "JSXIdentifier", name: "title" },
          value: {
            type: "JSXExpressionContainer",
            expression: { type: "JSXEmptyExpression" },
          },
        },
      ],
      dynamicParts,
      [0],
      state,
      { strategy: null, interactionEventType: null },
    );

    // Empty expression should be skipped entirely
    expect(result.attrs).toEqual(nLit(null));
    expect(dynamicParts).toHaveLength(0);
  });

  it("buildComponentCall handles attribute with JSXExpressionContainer containing JSX", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Modal" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "header" },
            value: {
              type: "JSXExpressionContainer",
              expression: {
                type: "JSXElement",
                openingElement: {
                  type: "JSXOpeningElement",
                  name: { type: "JSXIdentifier", name: "h1" },
                  attributes: [],
                  selfClosing: false,
                },
                children: [{ type: "JSXText", value: "Title" }],
                closingElement: null,
              },
            },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    expect(props.properties.length).toBeGreaterThan(0);
  });

  it("buildComponentCall throws for multiple client directives on same component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visible" },
            },
            value: null,
          },
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "load" },
            },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "Multiple client:* directives are not allowed",
    );
  });

  it("buildComponentCall handles attribute with JSXEmptyExpression value", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "title" },
            value: {
              type: "JSXExpressionContainer",
              expression: { type: "JSXEmptyExpression" },
            },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    // JSXEmptyExpression attribute should be skipped
    expect(result.arguments[0]?.properties).toHaveLength(0);
  });

  it("buildComponentCall injects client:media with string literal value", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "media" },
            },
            value: {
              type: "Literal",
              value: "(max-width: 768px)",
              raw: '"(max-width: 768px)"',
            },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    expect(
      props.properties.some(
        (p) =>
          p.key.type === "Literal" && p.key.value === ISLAND_METADATA_ATTRIBUTE,
      ),
    ).toBe(true);
    expect(
      props.properties.some(
        (p) =>
          p.key.type === "Literal" &&
          p.key.value === ISLAND_VALUE_METADATA_ATTRIBUTE &&
          p.value?.value === "(max-width: 768px)",
      ),
    ).toBe(true);
  });

  it("jsxToTree handles element with SVG namespace propagation", () => {
    const state = createInitialState("csr");
    const tree: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "svg" },
        attributes: [],
        selfClosing: false,
      },
      children: [
        {
          type: "JSXElement",
          openingElement: {
            type: "JSXOpeningElement",
            name: { type: "JSXIdentifier", name: "path" },
            attributes: [],
            selfClosing: true,
          },
          children: [],
          closingElement: null,
        } as JSXElement,
      ],
      closingElement: null,
    };

    const result = jsxToTree(tree, state, nested);
    expect(result.tree).toBeDefined();
  });

  it("buildComponentCall handles unsupported colocated directive on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "click" },
            },
            value: expr(nId("handler")),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "Unsupported colocated client directive",
    );
  });

  it("buildComponentCall rejects component colocated handlers that capture local bindings", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr({
              type: "ArrowFunctionExpression",
              params: [],
              body: {
                type: "CallExpression",
                callee: nId("increment"),
                arguments: [nId("localCount")],
                optional: false,
              },
              expression: true,
            }),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    state.moduleBindings.add("increment");

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "component-target colocated handlers cannot capture local bindings: localCount",
    );
  });

  it("buildComponentCall serializes local const captures for component-target handlers", () => {
    const state = createInitialState("csr");
    state.moduleBindings.add("report");
    state.currentSerializableBindings = new Map([
      [
        "label",
        {
          type: "Literal",
          value: "captured-label",
          raw: '"captured-label"',
        },
      ],
    ]);
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr({
              type: "ArrowFunctionExpression",
              params: [],
              body: {
                type: "CallExpression",
                callee: nId("report"),
                arguments: [nId("label")],
                optional: false,
              },
              expression: true,
            }),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = asObjectExpressionLike(
      result.arguments[0] as unknown as ESTNode,
    );

    expect(
      props.properties.some(
        (property) =>
          property.key.type === "Literal" &&
          property.key.value === CLIENT_ACTIONS_METADATA_ATTRIBUTE,
      ),
    ).toBe(true);
    expect(state.componentClientActions).toHaveLength(1);
  });

  it("buildComponentCall rejects component-target focus events", () => {
    const state = createInitialState("csr");
    state.moduleBindings.add("handleFocus");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "interaction" },
              name: { type: "JSXIdentifier", name: "onFocus" },
            },
            value: expr(nId("handleFocus")),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "interaction:onFocus is not supported on component targets because the child host cannot observe that event without an explicit host re-emit",
    );
  });

  it("buildComponentCall rejects mixing component colocated directives with client:*", () => {
    const state = createInitialState("csr");
    state.moduleBindings.add("handleClick");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "load" },
            },
            value: null,
          },
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "load" },
              name: { type: "JSXIdentifier", name: "onClick" },
            },
            value: expr(nId("handleClick")),
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
    );
  });

  it("buildComponentCall handles unknown client directive on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "client" },
              name: { type: "JSXIdentifier", name: "visibile" },
            },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "Unknown client:* directive",
    );
  });

  it("jsxToTree transforms nested component in expression via transformNestedJSX", () => {
    const state = createInitialState("csr");
    const tree = div([
      expr({
        type: "ArrayExpression",
        elements: [
          {
            type: "JSXElement",
            openingElement: {
              type: "JSXOpeningElement",
              name: { type: "JSXIdentifier", name: "Counter" },
              attributes: [],
              selfClosing: true,
            },
            children: [],
            closingElement: null,
          },
        ],
      }),
    ]);

    const result = jsxToTree(tree, state, nested);
    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree transforms nested HTML element in SSR mode via transformJSXForSSRNode", () => {
    const state = createInitialState("ssr");
    const tree = div([
      expr({
        type: "ArrayExpression",
        elements: [
          {
            type: "JSXElement",
            openingElement: {
              type: "JSXOpeningElement",
              name: { type: "JSXIdentifier", name: "span" },
              attributes: [],
              selfClosing: false,
            },
            children: [{ type: "JSXText", value: "hello" }],
            closingElement: null,
          },
        ],
      }),
    ]);

    const result = jsxToTree(tree, state, nested);
    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree transforms nested JSXFragment in SSR mode via transformJSXForSSRNode", () => {
    const state = createInitialState("ssr");
    const tree = div([
      expr({
        type: "LogicalExpression",
        operator: "&&",
        left: nId("visible"),
        right: {
          type: "JSXFragment",
          children: [{ type: "JSXText", value: "fragment content" }],
        },
      }),
    ]);

    const result = jsxToTree(tree, state, nested);
    expect(result.dynamicParts.some((part) => part.type === "insert")).toBe(
      true,
    );
  });

  it("jsxToTree in SSR mode uses transformJSXForSSRNode for direct JSXElement children", () => {
    const state = createInitialState("ssr");
    const tree = div([
      {
        type: "JSXElement",
        openingElement: {
          type: "JSXOpeningElement",
          name: { type: "JSXIdentifier", name: "span" },
          attributes: [],
          selfClosing: false,
        },
        children: [text("hello")],
        closingElement: null,
      } as JSXElement,
    ]);

    const result = jsxToTree(tree, state, nested);
    expect(result.tree).toBeDefined();
  });

  it("processAttributes handles string literal attribute value", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    const result = processAttributes(
      [
        {
          type: "JSXAttribute",
          name: { type: "JSXIdentifier", name: "className" },
          value: { type: "Literal", value: "active", raw: '"active"' },
        },
      ],
      dynamicParts,
      [0],
      state,
      { strategy: null, interactionEventType: null },
    );

    const objExpression = asObjectExpressionLike(result.attrs);
    expect(objExpression.properties).toHaveLength(1);
    expect(dynamicParts).toHaveLength(0);
  });

  it("buildComponentCall handles string literal attribute value on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "label" },
            value: { type: "Literal", value: "clicks", raw: '"clicks"' },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    expect(props.properties).toHaveLength(1);
  });

  it("buildComponentCall handles boolean (null value) attribute on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "disabled" },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    expect(props.properties).toHaveLength(1);
    // Boolean attribute with null value gets converted to { disabled: true }
    expect(props.properties[0]?.value?.value).toBe(true);
  });

  it("buildComponentCall handles expression attribute on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "count" },
            value: {
              type: "JSXExpressionContainer",
              expression: nId("count"),
            },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    expect(props.properties).toHaveLength(1);
  });

  it("buildComponentCall handles namespaced attribute key on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Icon" },
        attributes: [
          {
            type: "JSXAttribute",
            name: {
              type: "JSXNamespacedName",
              namespace: { type: "JSXIdentifier", name: "xlink" },
              name: { type: "JSXIdentifier", name: "href" },
            },
            value: { type: "Literal", value: "#icon", raw: '"#icon"' },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    const props = result.arguments[0];
    expect(props.properties).toHaveLength(1);
  });

  it("buildComponentCall throws for reserved client metadata on component", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "data-dh-client-target" },
            value: { type: "Literal", value: "manual", raw: '"manual"' },
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "data-dh-client-target is compiler-reserved metadata",
    );
  });

  it("buildComponentCall skips attribute with unsupported value type", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "title" },
            // Unsupported value type (not null, not Literal, not JSXExpressionContainer)
            value: { type: "TemplateLiteral" } as unknown as ESTNode,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    const result = asCallExpressionLike(
      buildComponentCall(component, state, nested),
    );
    // Unsupported value type should be skipped (attribute ignored)
    expect(result.arguments[0]?.properties).toHaveLength(0);
  });

  it("processAttributes throws for unknown client directive via JSXIdentifier name", () => {
    const state = createInitialState("csr");
    const dynamicParts: Parameters<typeof processAttributes>[1] = [];

    expect(() =>
      processAttributes(
        [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "client:unknown" },
            value: null,
          },
        ],
        dynamicParts,
        [0],
        state,
        { strategy: null, interactionEventType: null },
      ),
    ).toThrow("Unknown client:* directive");
  });

  it("buildComponentCall throws for unknown client directive via JSXIdentifier name", () => {
    const state = createInitialState("csr");
    const component: JSXElement = {
      type: "JSXElement",
      openingElement: {
        type: "JSXOpeningElement",
        name: { type: "JSXIdentifier", name: "Counter" },
        attributes: [
          {
            type: "JSXAttribute",
            name: { type: "JSXIdentifier", name: "client:unknown" },
            value: null,
          },
        ],
        selfClosing: true,
      },
      children: [],
      closingElement: null,
    };

    expect(() => buildComponentCall(component, state, nested)).toThrow(
      "Unknown client:* directive",
    );
  });
});
