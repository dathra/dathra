import { describe, expect, it } from "vitest";

import type { ESTNode } from "@/transform/ast/implementation";

import {
  hasCustomElement,
  readStaticTreeRoots,
  serializeMarkupNode,
  serializeStaticAttrs,
} from "./implementation";

function literal(value: string | number | boolean | null): ESTNode {
  return { type: "Literal", value };
}

function identifier(name: string): ESTNode {
  return { type: "Identifier", name };
}

function property(key: string, value: ESTNode): ESTNode {
  return {
    type: "Property",
    key: identifier(key),
    value,
    kind: "init",
    method: false,
    shorthand: false,
    computed: false,
  };
}

function objectExpression(properties: ESTNode[]): ESTNode {
  return { type: "ObjectExpression", properties };
}

function arrayExpression(elements: ESTNode[]): ESTNode {
  return { type: "ArrayExpression", elements };
}

describe("transform/staticTree", () => {
  it("reads static tree roots from ESTree array descriptors", () => {
    const tree = arrayExpression([
      arrayExpression([
        literal("div"),
        objectExpression([property("class", literal("root"))]),
        literal("Hello"),
        arrayExpression([literal("span"), literal(null), literal("World")]),
      ]),
    ]);

    const roots = readStaticTreeRoots(tree);

    expect(roots).toEqual([
      {
        tag: "div",
        attrs: { class: "root" },
        children: [
          "Hello",
          {
            tag: "span",
            attrs: null,
            children: ["World"],
          },
        ],
      },
    ]);
  });

  it("reads dynamic marker nodes", () => {
    const tree = arrayExpression([
      arrayExpression([
        literal("div"),
        literal(null),
        arrayExpression([literal("{text}"), literal(null)]),
      ]),
    ]);

    const roots = readStaticTreeRoots(tree);

    expect(roots?.[0]).toEqual({
      tag: "div",
      attrs: null,
      children: [{ kind: "text" }],
    });
  });

  it("returns null for non-static descriptors", () => {
    const tree = arrayExpression([
      arrayExpression([identifier("tag"), literal(null)]),
    ]);

    expect(readStaticTreeRoots(tree)).toBeNull();
  });

  it("serializes static attributes", () => {
    expect(
      serializeStaticAttrs({
        class: "button & primary",
        disabled: true,
        hidden: false,
        title: null,
        style: { backgroundColor: "red", opacity: 0.5, empty: "" },
      }),
    ).toBe(
      ' class="button &amp; primary" disabled style="background-color: red; opacity: 0.5"',
    );
  });

  it("serializes static markup with escaped text and text placeholders", () => {
    const markup = serializeMarkupNode(
      {
        tag: "p",
        attrs: { title: 'A "quote"' },
        children: ["<Hello>", { kind: "text" }],
      },
      "html",
      { current: 0 },
    );

    expect(markup).toBe(
      '<p title="A &quot;quote&quot;">&lt;Hello&gt;<!--dh-csr:text:0--></p>',
    );
  });

  it("serializes HTML void elements without closing tags", () => {
    const markup = serializeMarkupNode(
      { tag: "input", attrs: { disabled: true }, children: ["ignored"] },
      "html",
      { current: 0 },
    );

    expect(markup).toBe("<input disabled />");
  });

  it("detects descendant custom elements", () => {
    expect(
      hasCustomElement({
        tag: "section",
        attrs: null,
        children: [{ tag: "my-widget", attrs: null, children: [] }],
      }),
    ).toBe(true);
    expect(
      hasCustomElement({ tag: "section", attrs: null, children: ["text"] }),
    ).toBe(false);
  });
});
