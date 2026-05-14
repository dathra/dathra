import { describe, expect, it } from "vitest";
import {
  COLOCATED_CLIENT_STRATEGIES,
  DEFAULT_INTERACTION_EVENT_TYPE,
} from "@dathra/shared";

import { nId, nLit } from "@/transform/ast/implementation";

import {
  getColocatedClientDirective,
  getIslandsDirectiveName,
  getTagName,
  isClientDirectiveNamespace,
  isComponentTag,
  isValidIdentifier,
  jsxNameToExpression,
  normalizeIslandsDirectiveValue,
} from "./implementation";

describe("transform/jsx", () => {
  it("isComponentTag returns true for uppercase identifiers", () => {
    expect(isComponentTag({ type: "JSXIdentifier", name: "Counter" })).toBe(
      true,
    );
  });

  it("isComponentTag returns false for lowercase html tags", () => {
    expect(isComponentTag({ type: "JSXIdentifier", name: "div" })).toBe(false);
  });

  it("isComponentTag returns true for JSXMemberExpression", () => {
    expect(
      isComponentTag({
        type: "JSXMemberExpression",
        object: { type: "JSXIdentifier", name: "Foo" },
        property: { type: "JSXIdentifier", name: "Bar" },
      }),
    ).toBe(true);
  });

  it("jsxNameToExpression converts member names to MemberExpression", () => {
    const expr = jsxNameToExpression({
      type: "JSXMemberExpression",
      object: { type: "JSXIdentifier", name: "Foo" },
      property: { type: "JSXIdentifier", name: "Bar" },
    });

    expect(expr.type).toBe("MemberExpression");
  });

  it("jsxNameToExpression converts namespaced names to identifier", () => {
    const expr = jsxNameToExpression({
      type: "JSXNamespacedName",
      namespace: { type: "JSXIdentifier", name: "svg" },
      name: { type: "JSXIdentifier", name: "path" },
    });

    expect(expr).toEqual(nId("svg_path"));
  });

  it("getTagName returns dotted path for member names", () => {
    const name = getTagName({
      type: "JSXMemberExpression",
      object: {
        type: "JSXMemberExpression",
        object: { type: "JSXIdentifier", name: "A" },
        property: { type: "JSXIdentifier", name: "B" },
      },
      property: { type: "JSXIdentifier", name: "C" },
    });

    expect(name).toBe("A.B.C");
  });

  it("getIslandsDirectiveName detects client directives", () => {
    expect(
      getIslandsDirectiveName({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "client" },
        name: { type: "JSXIdentifier", name: "visible" },
      }),
    ).toBe("visible");
  });

  it("isClientDirectiveNamespace detects client namespace", () => {
    expect(
      isClientDirectiveNamespace({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "client" },
        name: { type: "JSXIdentifier", name: "idle" },
      }),
    ).toBe(true);
  });

  it("normalizeIslandsDirectiveValue defaults bare client:interaction to click", () => {
    expect(normalizeIslandsDirectiveValue("interaction", null)).toEqual(
      nLit(DEFAULT_INTERACTION_EVENT_TYPE),
    );
  });

  it("getColocatedClientDirective supports all canonical colocated strategies", () => {
    for (const strategy of COLOCATED_CLIENT_STRATEGIES) {
      expect(
        getColocatedClientDirective({
          type: "JSXNamespacedName",
          namespace: { type: "JSXIdentifier", name: strategy },
          name: { type: "JSXIdentifier", name: "onClick" },
        }),
      ).toEqual({ strategy, event: "click" });
    }
  });

  it("getColocatedClientDirective supports non-click events for non-interaction strategies", () => {
    expect(
      getColocatedClientDirective({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "load" },
        name: { type: "JSXIdentifier", name: "onMouseEnter" },
      }),
    ).toEqual({ strategy: "load", event: "mouseenter" });

    expect(
      getColocatedClientDirective({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "visible" },
        name: { type: "JSXIdentifier", name: "onFocus" },
      }),
    ).toEqual({ strategy: "visible", event: "focus" });

    expect(
      getColocatedClientDirective({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "interaction" },
        name: { type: "JSXIdentifier", name: "onKeyDown" },
      }),
    ).toEqual({ strategy: "interaction", event: "keydown" });
  });

  it("normalizeIslandsDirectiveValue throws for invalid directive values", () => {
    expect(() => normalizeIslandsDirectiveValue("media", null)).toThrow(
      "client:media requires a string literal media query",
    );
    expect(() =>
      normalizeIslandsDirectiveValue("visible", {
        type: "Literal",
        value: "soon",
        raw: '"soon"',
      }),
    ).toThrow("client:visible does not accept a value");
  });

  it("isValidIdentifier validates JS identifiers", () => {
    expect(isValidIdentifier("className")).toBe(true);
    expect(isValidIdentifier("data-foo")).toBe(false);
  });

  it("normalizeIslandsDirectiveValue extracts expression from JSXExpressionContainer for interaction", () => {
    const innerLiteral = {
      type: "Literal",
      value: "mouseover",
      raw: '"mouseover"',
    };
    const result = normalizeIslandsDirectiveValue("interaction", {
      type: "JSXExpressionContainer",
      expression: innerLiteral,
    });
    expect(result).toEqual(innerLiteral);
  });

  it("normalizeIslandsDirectiveValue extracts expression from JSXExpressionContainer for media", () => {
    const innerLiteral = {
      type: "Literal",
      value: "(max-width: 768px)",
      raw: '"(max-width: 768px)"',
    };
    const result = normalizeIslandsDirectiveValue("media", {
      type: "JSXExpressionContainer",
      expression: innerLiteral,
    });
    expect(result).toEqual(innerLiteral);
  });

  it("normalizeIslandsDirectiveValue throws for JSXEmptyExpression in interaction", () => {
    expect(() =>
      normalizeIslandsDirectiveValue("interaction", {
        type: "JSXExpressionContainer",
        expression: { type: "JSXEmptyExpression" },
      }),
    ).toThrow("client:interaction accepts only string literal event types");
  });

  it("normalizeIslandsDirectiveValue throws for non-string literal in interaction", () => {
    expect(() =>
      normalizeIslandsDirectiveValue("interaction", {
        type: "JSXExpressionContainer",
        expression: { type: "Literal", value: 42, raw: "42" },
      }),
    ).toThrow("client:interaction accepts only string literal event types");
  });

  it("normalizeIslandsDirectiveValue throws for non-string expression in media", () => {
    expect(() =>
      normalizeIslandsDirectiveValue("media", {
        type: "JSXExpressionContainer",
        expression: { type: "Identifier", name: "someVar" },
      }),
    ).toThrow("client:media requires a string literal media query");
  });

  it("isComponentTag returns false for JSXNamespacedName", () => {
    expect(
      isComponentTag({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "svg" },
        name: { type: "JSXIdentifier", name: "path" },
      }),
    ).toBe(false);
  });

  it("getTagName returns colon-separated name for namespaced names", () => {
    expect(
      getTagName({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "svg" },
        name: { type: "JSXIdentifier", name: "path" },
      }),
    ).toBe("svg:path");
  });

  it("getIslandsDirectiveName returns null for non-client directives", () => {
    expect(
      getIslandsDirectiveName({
        type: "JSXIdentifier",
        name: "onClick",
      }),
    ).toBe(null);
  });

  it("isClientDirectiveNamespace returns false for non-client namespace", () => {
    expect(
      isClientDirectiveNamespace({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "xlink" },
        name: { type: "JSXIdentifier", name: "href" },
      }),
    ).toBe(false);
  });

  it("isClientDirectiveNamespace detects JSXIdentifier starting with client:", () => {
    expect(
      isClientDirectiveNamespace({
        type: "JSXIdentifier",
        name: "client:load",
      }),
    ).toBe(true);
  });

  it("getColocatedClientDirective returns null for non-colocated directive", () => {
    expect(
      getColocatedClientDirective({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "xlink" },
        name: { type: "JSXIdentifier", name: "href" },
      }),
    ).toBe(null);
  });

  it("getColocatedClientDirective returns null for non-event handler names", () => {
    expect(
      getColocatedClientDirective({
        type: "JSXNamespacedName",
        namespace: { type: "JSXIdentifier", name: "interaction" },
        name: { type: "JSXIdentifier", name: "click" },
      }),
    ).toBe(null);
  });

  it("normalizeIslandsDirectiveValue returns null for bare load directive", () => {
    expect(normalizeIslandsDirectiveValue("load", null)).toBeNull();
  });

  it("normalizeIslandsDirectiveValue returns null for bare idle directive", () => {
    expect(normalizeIslandsDirectiveValue("idle", null)).toBeNull();
  });

  it("normalizeIslandsDirectiveValue returns null for bare visible directive", () => {
    expect(normalizeIslandsDirectiveValue("visible", null)).toBeNull();
  });

  it("jsxNameToExpression converts JSXIdentifier to Identifier", () => {
    const expr = jsxNameToExpression({
      type: "JSXIdentifier",
      name: "Counter",
    });
    expect(expr).toEqual(nId("Counter"));
  });
});
