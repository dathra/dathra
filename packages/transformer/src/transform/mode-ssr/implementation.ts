import {
  nArr,
  nCall,
  nId,
  nLit,
  nMember,
  nNew,
  nObj,
  type ESTNode,
} from "@/transform/ast/implementation";
import type { JSXElement, JSXFragment } from "@/transform/jsx/implementation";
import type { TransformState } from "@/transform/state/implementation";
import {
  hasCustomElement,
  isHtmlVoidElement,
  readStaticTreeRoots,
  serializeStaticAttrs,
  type StaticTreeNode,
} from "@/transform/staticTree/implementation";
import {
  jsxToTree,
  type NestedTransformers,
} from "@/transform/tree/implementation";

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function mergeStaticPart(parts: ESTNode[], value: string): void {
  if (value === "") {
    return;
  }

  const previous = parts.at(-1);
  if (
    previous?.type === "Literal" &&
    typeof previous.value === "string" &&
    typeof previous.raw === "string"
  ) {
    previous.value += value;
    previous.raw = JSON.stringify(previous.value);
    return;
  }

  parts.push(nLit(value));
}

function buildJoinedExpression(parts: ESTNode[]): ESTNode {
  if (parts.length === 0) {
    return nLit("");
  }

  if (parts.length === 1) {
    return parts[0];
  }

  return nCall(nMember(nArr(parts), nId("join")), [nLit("")]);
}

function buildLegacyRenderCall(
  tree: ESTNode,
  dynamicParts: Array<{ type: string; expression: ESTNode }>,
  state: TransformState,
): ESTNode {
  state.runtimeImports.add("renderToString");

  const markerDynamicParts = dynamicParts.filter(
    (part) => part.type === "text" || part.type === "insert",
  );
  const nonMarkerDynamicParts = dynamicParts.filter(
    (part) => part.type === "attr" || part.type === "spread",
  );

  const dynamicValueEntries: ESTNode[] = [];
  let dynamicId = 1;

  for (const part of markerDynamicParts) {
    dynamicValueEntries.push(nArr([nLit(dynamicId), part.expression]));
    dynamicId += 1;
  }

  for (const part of nonMarkerDynamicParts) {
    dynamicValueEntries.push(nArr([nLit(dynamicId), part.expression]));
    dynamicId += 1;
  }

  const dynamicValuesMap = nNew(nId("Map"), [nArr(dynamicValueEntries)]);
  return nCall(nId("renderToString"), [tree, nObj([]), dynamicValuesMap]);
}

function transformJSXForSSRNode(
  node: JSXElement | JSXFragment,
  state: TransformState,
  nested: NestedTransformers,
): ESTNode {
  const inheritedNamespace = state.currentElementNamespace ?? "html";
  const { tree, dynamicParts } = jsxToTree(node, state, nested);
  const roots = readStaticTreeRoots(tree);
  if (roots === null || roots.some(hasCustomElement)) {
    return buildLegacyRenderCall(tree, dynamicParts, state);
  }

  const markerDynamicParts = dynamicParts.filter(
    (part) => part.type === "text" || part.type === "insert",
  );
  let markerIndex = 0;
  let markerId = 1;
  const parts: ESTNode[] = [];

  function serializeNode(
    currentNode: StaticTreeNode,
    path: number[],
    namespace: "html" | "svg" | "math",
  ): void {
    if (typeof currentNode === "string") {
      mergeStaticPart(parts, escapeHtml(currentNode));
      return;
    }

    if ("kind" in currentNode) {
      const currentMarkerId = markerId;
      markerId += 1;
      const binding = markerDynamicParts[markerIndex];
      markerIndex += 1;

      if (currentNode.kind === "text") {
        if (binding.type !== "text") {
          return;
        }

        state.runtimeImports.add("renderDynamicText");
        mergeStaticPart(parts, `<!--dh:t:${currentMarkerId}-->`);
        parts.push(nCall(nId("renderDynamicText"), [binding.expression]));
        mergeStaticPart(parts, "<!---->");
        return;
      }

      if (binding.type !== "insert") {
        return;
      }

      if (currentNode.kind === "each") {
        state.runtimeImports.add("renderDynamicEach");
        mergeStaticPart(parts, `<!--dh:b:${currentMarkerId}-->`);
        parts.push(nCall(nId("renderDynamicEach"), [binding.expression]));
        mergeStaticPart(parts, "<!--/dh:b-->");
        return;
      }

      state.runtimeImports.add("renderDynamicInsert");
      mergeStaticPart(parts, `<!--dh:i:${currentMarkerId}-->`);
      parts.push(nCall(nId("renderDynamicInsert"), [binding.expression]));
      mergeStaticPart(parts, "<!--/dh:i-->");
      return;
    }

    const nextNamespace =
      currentNode.tag === "svg"
        ? "svg"
        : currentNode.tag === "math"
          ? "math"
          : namespace;

    mergeStaticPart(
      parts,
      `<${currentNode.tag}${serializeStaticAttrs(currentNode.attrs)}`,
    );

    for (const dynamicPart of dynamicParts) {
      if (dynamicPart.path.join(".") !== path.join(".")) {
        continue;
      }

      if (dynamicPart.type === "attr") {
        state.runtimeImports.add("renderDynamicAttr");
        parts.push(
          nCall(nId("renderDynamicAttr"), [
            nLit(dynamicPart.key),
            dynamicPart.expression,
          ]),
        );
      }

      if (dynamicPart.type === "spread") {
        state.runtimeImports.add("renderDynamicSpread");
        parts.push(nCall(nId("renderDynamicSpread"), [dynamicPart.expression]));
      }
    }

    if (namespace === "html" && isHtmlVoidElement(currentNode.tag)) {
      mergeStaticPart(parts, " />");
      return;
    }

    mergeStaticPart(parts, ">");
    currentNode.children.forEach((child, index) => {
      serializeNode(child, [...path, index], nextNamespace);
    });
    mergeStaticPart(parts, `</${currentNode.tag}>`);
  }

  roots.forEach((root, index) => {
    serializeNode(root, [index], inheritedNamespace);
  });

  return buildJoinedExpression(parts);
}

export { transformJSXForSSRNode };
