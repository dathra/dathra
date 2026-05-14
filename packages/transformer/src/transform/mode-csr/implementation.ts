import {
  nArrowBlock,
  nBlock,
  nCall,
  nConst,
  nExprStmt,
  nId,
  nLit,
  nMember,
  nObj,
  nProp,
  nReturn,
  type ESTNode,
} from "@/transform/ast/implementation";
import {
  getTagName,
  type JSXElement,
  type JSXFragment,
} from "@/transform/jsx/implementation";
import { generateNavigation } from "@/transform/navigation/implementation";
import {
  createTemplateId,
  type TransformState,
} from "@/transform/state/implementation";
import {
  readStaticTreeRoots,
  serializeMarkupNode,
} from "@/transform/staticTree/implementation";
import {
  containsReactiveAccess,
  jsxToTree,
  type NestedTransformers,
} from "@/transform/tree/implementation";

/**
 * Namespace enum values matching @dathra/runtime Namespace const enum.
 * Duplicated here to avoid a runtime dependency from transformer.
 */
type Namespace = 0 | 1 | 2;

function getTemplateNamespace(
  node: JSXElement | JSXFragment,
  inheritedNamespace: "html" | "svg" | "math",
): Namespace {
  if (node.type === "JSXFragment") {
    return inheritedNamespace === "svg"
      ? 1
      : inheritedNamespace === "math"
        ? 2
        : 0;
  }

  const tagName = getTagName(node.openingElement.name);
  if (tagName === "svg") {
    return 1;
  }

  if (tagName === "math") {
    return 2;
  }

  return inheritedNamespace === "svg"
    ? 1
    : inheritedNamespace === "math"
      ? 2
      : 0;
}

function buildCompiledTemplateDescriptor(
  tree: ESTNode,
  namespace: Namespace,
): ESTNode | null {
  const roots = readStaticTreeRoots(tree);
  if (roots === null) {
    return null;
  }

  const textPlaceholderId = { current: 0 };
  const markup = roots
    .map((root) =>
      serializeMarkupNode(
        root,
        namespace === 1 ? "svg" : namespace === 2 ? "math" : "html",
        textPlaceholderId,
      ),
    )
    .join("");

  return nObj([
    nProp(nId("kind"), nLit("compiled")),
    nProp(nId("markup"), nLit(markup)),
    nProp(nId("namespace"), nLit(namespace)),
  ]);
}

/**
 * Transform a JSX element/fragment node to CSR DOM code.
 */
function transformJSXNode(
  node: JSXElement | JSXFragment,
  state: TransformState,
  nested: NestedTransformers,
): ESTNode {
  const inheritedNamespace = state.currentElementNamespace ?? "html";
  const { tree, dynamicParts } = jsxToTree(node, state, nested);

  const templateId = createTemplateId(state);
  state.runtimeImports.add("fromTree");

  const compiledTemplateDescriptor = buildCompiledTemplateDescriptor(
    tree,
    getTemplateNamespace(node, inheritedNamespace),
  );

  state.templates.push(
    nConst(
      templateId,
      nCall(nId("fromTree"), [compiledTemplateDescriptor ?? tree, nLit(0)]),
    ),
  );

  const setupStatements: ESTNode[] = [];
  const fragmentId = nId("_f");
  setupStatements.push(nConst(fragmentId, nCall(templateId, [])));

  const nodeDeclarations: ESTNode[] = [];
  const updateStatements: ESTNode[] = [];
  const declaredNodeIds = new Set<string>();

  function ensureNodeDeclaration(path: number[]): ESTNode {
    const nodeName = `_n${path.join("_")}`;
    const nodeId = nId(nodeName);

    if (!declaredNodeIds.has(nodeName)) {
      declaredNodeIds.add(nodeName);
      nodeDeclarations.push(
        nConst(nodeId, generateNavigation(fragmentId, path, state)),
      );
    }

    return nodeId;
  }

  for (const part of dynamicParts) {
    const nodeId = ensureNodeDeclaration(part.path);

    switch (part.type) {
      case "text": {
        state.runtimeImports.add("setText");
        state.runtimeImports.add("templateEffect");

        updateStatements.push(
          nExprStmt(
            nCall(nId("templateEffect"), [
              nArrowBlock(
                [],
                nBlock([
                  nExprStmt(nCall(nId("setText"), [nodeId, part.expression])),
                ]),
              ),
            ]),
          ),
        );
        break;
      }

      case "attr": {
        state.runtimeImports.add("setAttr");

        const attrUpdate = nExprStmt(
          nCall(nId("setAttr"), [nodeId, nLit(part.key), part.expression]),
        );

        if (containsReactiveAccess(part.expression)) {
          state.runtimeImports.add("templateEffect");
          updateStatements.push(
            nExprStmt(
              nCall(nId("templateEffect"), [
                nArrowBlock([], nBlock([attrUpdate])),
              ]),
            ),
          );
        } else {
          updateStatements.push(attrUpdate);
        }
        break;
      }

      case "event": {
        state.runtimeImports.add("event");

        updateStatements.push(
          nExprStmt(
            nCall(nId("event"), [nLit(part.key), nodeId, part.expression]),
          ),
        );
        break;
      }

      case "insert": {
        state.runtimeImports.add("insert");

        if (part.isComponent === true) {
          updateStatements.push(
            nExprStmt(
              nCall(nId("insert"), [
                nMember(nodeId, nId("parentNode")),
                part.expression,
                nodeId,
              ]),
            ),
          );
        } else {
          state.runtimeImports.add("templateEffect");
          updateStatements.push(
            nExprStmt(
              nCall(nId("templateEffect"), [
                nArrowBlock(
                  [],
                  nBlock([
                    nExprStmt(
                      nCall(nId("insert"), [
                        nMember(nodeId, nId("parentNode")),
                        part.expression,
                        nodeId,
                      ]),
                    ),
                  ]),
                ),
              ]),
            ),
          );
        }
        break;
      }

      case "spread": {
        state.runtimeImports.add("spread");
        state.runtimeImports.add("templateEffect");

        updateStatements.push(
          nExprStmt(
            nCall(nId("templateEffect"), [
              nArrowBlock(
                [],
                nBlock([
                  nExprStmt(nCall(nId("spread"), [nodeId, part.expression])),
                ]),
              ),
            ]),
          ),
        );
        break;
      }
    }
  }

  setupStatements.push(...nodeDeclarations);
  setupStatements.push(...updateStatements);
  setupStatements.push(nReturn(fragmentId));
  return nCall(nArrowBlock([], nBlock(setupStatements)), []);
}

export { transformJSXNode };
