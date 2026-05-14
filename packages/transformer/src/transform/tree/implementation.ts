import { walk } from "zimmerframe";
import {
  COLOCATED_CLIENT_STRATEGIES,
  CLIENT_ACTIONS_METADATA_ATTRIBUTE,
  CLIENT_EVENT_METADATA_ATTRIBUTE,
  CLIENT_STRATEGY_METADATA_ATTRIBUTE,
  CLIENT_TARGET_METADATA_ATTRIBUTE,
  DEFAULT_INTERACTION_EVENT_TYPE,
  ISLAND_METADATA_ATTRIBUTE,
  ISLAND_VALUE_METADATA_ATTRIBUTE,
  type ColocatedClientStrategyName,
} from "@dathra/shared";

import {
  isCallExpression,
  isIdentifier,
  isMemberExpression,
  isStringLiteral,
  nArr,
  nArrowBlock,
  nBlock,
  nCall,
  nConst,
  nId,
  nLit,
  nMember,
  nObj,
  nProp,
  nReturn,
  nSpread,
  type CallExpression,
  type ESTNode,
} from "@/transform/ast/implementation";
import {
  getColocatedClientDirective,
  getIslandsDirectiveName,
  getTagName,
  isClientDirectiveNamespace,
  isComponentTag,
  isValidIdentifier,
  jsxNameToExpression,
  normalizeIslandsDirectiveValue,
  type IslandsDirectiveName,
  type JSXAttribute,
  type JSXChild,
  type JSXElement,
  type JSXEmptyExpression,
  type JSXExpressionContainer,
  type JSXFragment,
  type JSXSpreadAttribute,
  type JSXSpreadChild,
} from "@/transform/jsx/implementation";
import {
  createClientActionId,
  createClientTargetId,
  type TransformState,
} from "@/transform/state/implementation";

type DynamicPart =
  | {
      type: "text" | "spread";
      path: number[];
      expression: ESTNode;
    }
  | {
      type: "attr" | "event";
      path: number[];
      expression: ESTNode;
      key: string;
    }
  | {
      type: "insert";
      path: number[];
      expression: ESTNode;
      isComponent?: boolean;
    };

interface TreeResult {
  tree: ESTNode;
  dynamicParts: DynamicPart[];
}

interface ProcessedAttributes {
  attrs: ESTNode;
  events: { type: string; handler: ESTNode }[];
}

interface ColocatedClientState {
  strategy: ColocatedClientStrategyName | null;
  interactionEventType: string | null;
}

interface IslandsDirectiveMetadata {
  strategy: IslandsDirectiveName;
  value: ESTNode | null;
}

const RESERVED_ISLAND_METADATA_KEYS = new Set([
  ISLAND_METADATA_ATTRIBUTE,
  ISLAND_VALUE_METADATA_ATTRIBUTE,
]);

const RESERVED_CLIENT_METADATA_KEYS = new Set([
  CLIENT_ACTIONS_METADATA_ATTRIBUTE,
  CLIENT_TARGET_METADATA_ATTRIBUTE,
  CLIENT_STRATEGY_METADATA_ATTRIBUTE,
  CLIENT_EVENT_METADATA_ATTRIBUTE,
]);

const colocatedDirectivePrefixes = new Set(
  COLOCATED_CLIENT_STRATEGIES.map((strategy) => `${strategy}:`),
);

function collectBindingNames(pattern: ESTNode, names: Set<string>): void {
  if (isIdentifier(pattern)) {
    names.add(pattern.name);
    return;
  }

  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties as ESTNode[]) {
      if (property.type === "Property") {
        collectBindingNames(property.value as ESTNode, names);
      } else if (property.type === "RestElement") {
        collectBindingNames(property.argument as ESTNode, names);
      }
    }
    return;
  }

  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements as Array<ESTNode | null>) {
      if (element !== null) {
        collectBindingNames(element, names);
      }
    }
    return;
  }

  if (pattern.type === "AssignmentPattern") {
    collectBindingNames(pattern.left as ESTNode, names);
    return;
  }

  if (pattern.type === "RestElement") {
    collectBindingNames(pattern.argument as ESTNode, names);
  }
}

function throwUnknownClientDirective(name: JSXAttribute["name"]): never {
  if (name.type !== "JSXNamespacedName") {
    throw new Error("[dathra] Unknown client:* directive");
  }

  throw new Error(
    `[dathra] Unknown client:* directive: client:${name.name.name}`,
  );
}

function getRawAttributeNameForDiagnostics(name: JSXAttribute["name"]): string {
  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  return `${name.namespace.name}:${name.name.name}`;
}

function getUnsupportedColocatedDirectiveError(
  name: JSXAttribute["name"],
): string | null {
  const rawName = getRawAttributeNameForDiagnostics(name);

  if (
    Array.from(colocatedDirectivePrefixes).some((prefix) =>
      rawName.startsWith(prefix),
    )
  ) {
    return `Unsupported colocated client directive: ${rawName}`;
  }

  return null;
}

const KNOWN_COMPONENT_ACTION_GLOBALS = new Set([
  "console",
  "Math",
  "JSON",
  "Number",
  "String",
  "Boolean",
  "Object",
  "Array",
]);

const UNSUPPORTED_COMPONENT_TARGET_EVENTS = new Set([
  "focus",
  "blur",
  "mouseenter",
  "mouseleave",
  "scroll",
]);

function isESTNode(value: unknown): value is ESTNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function isComputedProperty(value: unknown): value is true {
  return value === true;
}

function collectBlockBindingNames(body: ESTNode[], names: Set<string>): void {
  for (const statement of body) {
    if (statement.type === "VariableDeclaration") {
      for (const declaration of statement.declarations as Array<{
        id: ESTNode;
      }>) {
        collectBindingNames(declaration.id, names);
      }
      continue;
    }

    if (statement.type === "FunctionDeclaration" && isESTNode(statement.id)) {
      collectBindingNames(statement.id, names);
    }
  }
}

function collectFreeIdentifiers(
  node: ESTNode | null | undefined,
  available: Set<string>,
  free: Set<string>,
): boolean {
  if (node === null || node === undefined) {
    return true;
  }

  if (isIdentifier(node)) {
    if (!available.has(node.name)) {
      free.add(node.name);
    }
    return true;
  }

  switch (node.type) {
    case "Literal":
    case "ThisExpression":
      return true;
    case "MemberExpression":
      return (
        collectFreeIdentifiers(node.object as ESTNode, available, free) &&
        (!isComputedProperty(node.computed) ||
          collectFreeIdentifiers(node.property as ESTNode, available, free))
      );
    case "CallExpression":
    case "NewExpression":
      return [node.callee as ESTNode, ...(node.arguments as ESTNode[])].every(
        (part) => collectFreeIdentifiers(part, available, free),
      );
    case "ArrowFunctionExpression":
    case "FunctionExpression": {
      const nextAvailable = new Set(available);
      if (node.type === "FunctionExpression" && isESTNode(node.id)) {
        collectBindingNames(node.id, nextAvailable);
      }
      for (const param of (node.params ?? []) as ESTNode[]) {
        collectBindingNames(param, nextAvailable);
      }
      const functionBody = node.body as ESTNode;
      if (functionBody.type === "BlockStatement") {
        collectBlockBindingNames(functionBody.body as ESTNode[], nextAvailable);
      }
      return collectFreeIdentifiers(functionBody, nextAvailable, free);
    }
    case "BlockStatement": {
      const nextAvailable = new Set(available);
      collectBlockBindingNames(node.body as ESTNode[], nextAvailable);
      return (node.body as ESTNode[]).every((statement) =>
        collectFreeIdentifiers(statement, nextAvailable, free),
      );
    }
    case "ExpressionStatement":
      return collectFreeIdentifiers(
        node.expression as ESTNode,
        available,
        free,
      );
    case "ReturnStatement":
    case "AwaitExpression":
    case "YieldExpression":
      return collectFreeIdentifiers(node.argument as ESTNode, available, free);
    case "UnaryExpression":
    case "UpdateExpression":
      return collectFreeIdentifiers(node.argument as ESTNode, available, free);
    case "BinaryExpression":
    case "LogicalExpression":
    case "AssignmentExpression":
      return (
        collectFreeIdentifiers(node.left as ESTNode, available, free) &&
        collectFreeIdentifiers(node.right as ESTNode, available, free)
      );
    case "ConditionalExpression":
      return (
        collectFreeIdentifiers(node.test as ESTNode, available, free) &&
        collectFreeIdentifiers(node.consequent as ESTNode, available, free) &&
        collectFreeIdentifiers(node.alternate as ESTNode, available, free)
      );
    case "SequenceExpression":
      return (node.expressions as ESTNode[]).every((expression) =>
        collectFreeIdentifiers(expression, available, free),
      );
    case "ArrayExpression":
      return (node.elements as Array<ESTNode | null>).every((element) =>
        collectFreeIdentifiers(element, available, free),
      );
    case "ObjectExpression":
      return (node.properties as ESTNode[]).every((property) => {
        if (property.type === "SpreadElement") {
          return collectFreeIdentifiers(
            property.argument as ESTNode,
            available,
            free,
          );
        }

        return (
          (!isComputedProperty(property.computed) ||
            collectFreeIdentifiers(property.key as ESTNode, available, free)) &&
          collectFreeIdentifiers(property.value as ESTNode, available, free)
        );
      });
    case "TemplateLiteral":
      return (node.expressions as ESTNode[]).every((expression) =>
        collectFreeIdentifiers(expression, available, free),
      );
    case "IfStatement":
      return (
        collectFreeIdentifiers(node.test as ESTNode, available, free) &&
        collectFreeIdentifiers(node.consequent as ESTNode, available, free) &&
        collectFreeIdentifiers(node.alternate as ESTNode, available, free)
      );
    case "VariableDeclaration":
      return (node.declarations as Array<{ init?: ESTNode | null }>).every(
        (declaration) =>
          collectFreeIdentifiers(declaration.init ?? null, available, free),
      );
    default:
      return false;
  }
}

function isSerializableCaptureExpression(
  node: ESTNode | undefined,
  serializableBindings: ReadonlyMap<string, ESTNode>,
  visited: Set<string> = new Set(),
): boolean {
  if (node === undefined) {
    return false;
  }

  if (node.type === "Literal") {
    return (
      node.value === null ||
      typeof node.value === "string" ||
      typeof node.value === "number" ||
      typeof node.value === "boolean"
    );
  }

  if (isIdentifier(node)) {
    if (visited.has(node.name)) {
      return false;
    }
    const binding = serializableBindings.get(node.name);
    if (binding === undefined) {
      return false;
    }
    visited.add(node.name);
    const result = isSerializableCaptureExpression(
      binding,
      serializableBindings,
      visited,
    );
    visited.delete(node.name);
    return result;
  }

  if (node.type === "TemplateLiteral") {
    return (node.expressions as ESTNode[]).every((expression) =>
      isSerializableCaptureExpression(
        expression,
        serializableBindings,
        visited,
      ),
    );
  }

  if (node.type === "ArrayExpression") {
    return (node.elements as Array<ESTNode | null>).every(
      (element) =>
        element === null ||
        isSerializableCaptureExpression(element, serializableBindings, visited),
    );
  }

  if (node.type === "ObjectExpression") {
    return (node.properties as ESTNode[]).every((property) => {
      if (property.type === "SpreadElement") {
        return false;
      }

      return (
        (!isComputedProperty(property.computed) ||
          isSerializableCaptureExpression(
            property.key as ESTNode,
            serializableBindings,
            visited,
          )) &&
        isSerializableCaptureExpression(
          property.value as ESTNode,
          serializableBindings,
          visited,
        )
      );
    });
  }

  return false;
}

function analyzeComponentActionHandler(
  handler: ESTNode,
  moduleBindings: ReadonlySet<string>,
  serializableBindings: ReadonlyMap<string, ESTNode> | undefined,
): { captures: string[] } | { error: string } {
  if (
    handler.type !== "Identifier" &&
    handler.type !== "MemberExpression" &&
    handler.type !== "ArrowFunctionExpression" &&
    handler.type !== "FunctionExpression"
  ) {
    return {
      error:
        "component-target colocated handlers must be a function reference or inline function expression",
    };
  }

  const available = new Set<string>([
    ...moduleBindings,
    ...KNOWN_COMPONENT_ACTION_GLOBALS,
  ]);
  const free = new Set<string>();
  if (!collectFreeIdentifiers(handler, available, free)) {
    return {
      error:
        "component-target colocated handlers must be module-scoped and use only supported expression syntax",
    };
  }

  const captures = Array.from(free).sort();
  if (captures.length === 0) {
    return { captures: [] };
  }

  const currentSerializableBindings: ReadonlyMap<string, ESTNode> =
    serializableBindings ?? new Map<string, ESTNode>();
  for (const capture of captures) {
    if (
      !isSerializableCaptureExpression(
        currentSerializableBindings.get(capture),
        currentSerializableBindings,
      )
    ) {
      return {
        error: `component-target colocated handlers cannot capture local bindings: ${captures.join(", ")}`,
      };
    }
  }

  return { captures };
}

function buildComponentActionPayloadExpression(
  captureNames: readonly string[],
  serializableBindings: ReadonlyMap<string, ESTNode> | undefined,
): ESTNode {
  const properties = captureNames.map((name) =>
    nProp(
      isValidIdentifier(name) ? nId(name) : nLit(name),
      serializableBindings?.get(name) ?? nId(name),
      !isValidIdentifier(name),
    ),
  );
  return nObj(properties);
}

function buildComponentActionFactory(
  handler: ESTNode,
  captureNames: readonly string[],
): ESTNode {
  const statements: ESTNode[] = captureNames.map((name) =>
    nConst(nId(name), nMember(nId("__dh_payload"), nLit(name), true)),
  );
  statements.push(nReturn(handler));

  return nArrowBlock(
    [nId("__dh_payload"), nId("__dh_host")],
    nBlock(statements),
  );
}

function getElementNamespace(tagName: string): "html" | "svg" | "math" {
  if (tagName === "svg") {
    return "svg";
  }

  if (tagName === "math") {
    return "math";
  }

  return "html";
}

function shouldRejectColocatedDirectiveInNamespace(
  namespace: "html" | "svg" | "math" | undefined,
): boolean {
  return namespace === "svg" || namespace === "math";
}

function getReservedClientMetadataError(key: string): string | null {
  if (!RESERVED_CLIENT_METADATA_KEYS.has(key as never)) {
    return null;
  }

  return `[dathra] ${key} is compiler-reserved metadata and cannot be authored directly`;
}

function assertNoHostIslandsMixing(
  hasHostIslandMetadata: boolean | undefined,
  strategy: ColocatedClientState["strategy"],
): void {
  if (hasHostIslandMetadata !== true || strategy === null) {
    return;
  }

  throw new Error(
    "[dathra] host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
  );
}

interface NestedTransformers {
  transformJSXNode: (
    node: JSXElement | JSXFragment,
    state: TransformState,
    nested: NestedTransformers,
  ) => ESTNode;
  transformJSXForSSRNode: (
    node: JSXElement | JSXFragment,
    state: TransformState,
    nested: NestedTransformers,
  ) => ESTNode;
}

/**
 * Check if a node contains reactive access (.value).
 */
function containsReactiveAccess(node: ESTNode): boolean {
  if (
    isMemberExpression(node) &&
    isIdentifier(node.property) &&
    node.property.name === "value"
  ) {
    return true;
  }

  let found = false;
  walk(node, null, {
    MemberExpression(n: ESTNode, { next }: { next: () => void }) {
      if (
        isMemberExpression(n) &&
        isIdentifier(n.property) &&
        n.property.name === "value"
      ) {
        found = true;
      }
      if (!found) next();
    },
  });
  return found;
}

/**
 * Build a component function call expression from a JSX element.
 */
function buildComponentCall(
  node: JSXElement,
  state: TransformState,
  nested: NestedTransformers,
): ESTNode {
  const opening = node.openingElement;
  const componentRef = jsxNameToExpression(opening.name);

  const propsProperties: ESTNode[] = [];
  let islandsDirective: IslandsDirectiveMetadata | null = null;
  let colocatedDirectiveStrategy: ColocatedClientStrategyName | null = null;
  let colocatedInteractionEventType: string | null = null;
  const componentActionBindings = new Map<
    string,
    { id: string; captureNames: string[] }
  >();
  let hasExplicitReservedIslandMetadata = false;
  let hasExplicitHostIslandMetadata = false;

  for (const attr of opening.attributes) {
    if (attr.type === "JSXSpreadAttribute") {
      propsProperties.push(nSpread(attr.argument));
      continue;
    }

    const directiveName = getIslandsDirectiveName(attr.name);
    if (directiveName !== null) {
      if (islandsDirective !== null) {
        throw new Error(
          `[dathra] Multiple client:* directives are not allowed on a single component: <${getTagName(opening.name)}>`,
        );
      }

      islandsDirective = {
        strategy: directiveName,
        value: normalizeIslandsDirectiveValue(directiveName, attr.value),
      };
      continue;
    }

    const colocatedDirective = getColocatedClientDirective(attr.name);
    if (colocatedDirective !== null) {
      const rawName = getRawAttributeNameForDiagnostics(attr.name);
      const value = attr.value;
      if (
        value === null ||
        !isJSXExpressionContainer(value) ||
        isJSXEmptyExpression(value.expression)
      ) {
        throw new Error(
          `[dathra] ${rawName} requires an inline handler expression`,
        );
      }

      if (UNSUPPORTED_COMPONENT_TARGET_EVENTS.has(colocatedDirective.event)) {
        throw new Error(
          `[dathra] ${rawName} is not supported on component targets because the child host cannot observe that event without an explicit host re-emit`,
        );
      }

      assertNoHostIslandsMixing(
        state.currentHostIslandMetadata,
        colocatedDirective.strategy,
      );

      const colocatedClientState = state.currentColocatedClientState ?? {
        strategy: null,
        interactionEventType: null,
      };
      if (
        colocatedClientState.strategy !== null &&
        colocatedClientState.strategy !== colocatedDirective.strategy
      ) {
        throw new Error(
          "[dathra] Mixed colocated client strategies are not supported in one JSX root",
        );
      }
      if (
        colocatedDirective.strategy === "interaction" &&
        colocatedClientState.interactionEventType !== null &&
        colocatedClientState.interactionEventType !== colocatedDirective.event
      ) {
        throw new Error(
          "[dathra] Mixed colocated interaction event types are not supported in one JSX root",
        );
      }
      colocatedClientState.strategy = colocatedDirective.strategy;
      if (colocatedDirective.strategy === "interaction") {
        colocatedClientState.interactionEventType = colocatedDirective.event;
      }
      state.currentColocatedClientState = colocatedClientState;

      if (
        colocatedDirectiveStrategy !== null &&
        colocatedDirectiveStrategy !== colocatedDirective.strategy
      ) {
        throw new Error(
          "[dathra] Mixed colocated client strategies are not supported in one JSX root",
        );
      }
      if (
        colocatedDirective.strategy === "interaction" &&
        colocatedInteractionEventType !== null &&
        colocatedInteractionEventType !== colocatedDirective.event
      ) {
        throw new Error(
          "[dathra] Mixed colocated interaction event types are not supported in one JSX root",
        );
      }

      const analysis = analyzeComponentActionHandler(
        value.expression,
        state.moduleBindings,
        state.currentSerializableBindings,
      );
      if ("error" in analysis) {
        throw new Error(`[dathra] ${rawName} ${analysis.error}`);
      }

      colocatedDirectiveStrategy = colocatedDirective.strategy;
      if (colocatedDirective.strategy === "interaction") {
        colocatedInteractionEventType = colocatedDirective.event;
      }

      const actionId = createClientActionId(state);
      componentActionBindings.set(colocatedDirective.event, {
        id: actionId,
        captureNames: analysis.captures,
      });
      state.componentClientActions.push({
        id: actionId,
        factory: buildComponentActionFactory(
          value.expression,
          analysis.captures,
        ),
      });
      state.runtimeImports.add("registerClientAction");
      continue;
    }

    const unsupportedColocatedDirectiveError =
      getUnsupportedColocatedDirectiveError(attr.name);
    if (unsupportedColocatedDirectiveError !== null) {
      throw new Error(`[dathra] ${unsupportedColocatedDirectiveError}`);
    }

    if (isClientDirectiveNamespace(attr.name)) {
      throwUnknownClientDirective(attr.name);
    }

    const key = getAttributeName(attr.name);

    if (RESERVED_ISLAND_METADATA_KEYS.has(key as never)) {
      hasExplicitReservedIslandMetadata = true;
      hasExplicitHostIslandMetadata = true;
    }

    const reservedClientMetadataError = getReservedClientMetadataError(key);
    if (reservedClientMetadataError !== null) {
      throw new Error(reservedClientMetadataError);
    }

    const keyNode = isValidIdentifier(key) ? nId(key) : nLit(key);
    const computed = !isValidIdentifier(key);
    let value: ESTNode;

    if (attr.value === null) {
      value = nLit(true);
    } else if (isStringLiteral(attr.value)) {
      value = attr.value;
    } else if (isJSXExpressionContainer(attr.value)) {
      if (isJSXEmptyExpression(attr.value.expression)) continue;
      value = containsJSXNode(attr.value.expression)
        ? transformNestedJSX(attr.value.expression, state, nested)
        : attr.value.expression;
    } else {
      continue;
    }

    propsProperties.push(nProp(keyNode, value, computed));
  }

  if (islandsDirective !== null) {
    if (colocatedDirectiveStrategy !== null) {
      throw new Error(
        "[dathra] host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
      );
    }

    if (hasExplicitReservedIslandMetadata) {
      throw new Error(
        `[dathra] client:* directives cannot be combined with explicit data-dh-island metadata on <${getTagName(opening.name)}>`,
      );
    }

    propsProperties.push(
      nProp(nLit(ISLAND_METADATA_ATTRIBUTE), nLit(islandsDirective.strategy)),
    );

    if (islandsDirective.value !== null) {
      propsProperties.push(
        nProp(nLit(ISLAND_VALUE_METADATA_ATTRIBUTE), islandsDirective.value),
      );
    }
  }

  if (colocatedDirectiveStrategy !== null) {
    if (hasExplicitHostIslandMetadata) {
      throw new Error(
        "[dathra] host-level client:* directives or data-dh-island metadata cannot be combined with colocated client directives in the same component render subtree",
      );
    }

    const clientActionMetadata = nObj(
      Array.from(componentActionBindings.entries()).map(
        ([eventType, binding]) =>
          nProp(
            nLit(eventType),
            nObj([
              nProp(nId("id"), nLit(binding.id)),
              nProp(
                nId("payload"),
                buildComponentActionPayloadExpression(
                  binding.captureNames,
                  state.currentSerializableBindings,
                ),
              ),
            ]),
          ),
      ),
    );

    propsProperties.push(
      nProp(nLit(ISLAND_METADATA_ATTRIBUTE), nLit(colocatedDirectiveStrategy)),
      nProp(
        nLit(CLIENT_ACTIONS_METADATA_ATTRIBUTE),
        nCall(nMember(nId("JSON"), nId("stringify")), [clientActionMetadata]),
      ),
    );

    if (
      colocatedDirectiveStrategy === "interaction" &&
      colocatedInteractionEventType !== null
    ) {
      propsProperties.push(
        nProp(
          nLit(ISLAND_VALUE_METADATA_ATTRIBUTE),
          nLit(colocatedInteractionEventType),
        ),
      );
    }
  }

  const previousHostIslandMetadata = state.currentHostIslandMetadata;
  const nextHostIslandMetadata =
    previousHostIslandMetadata === true ||
    islandsDirective !== null ||
    colocatedDirectiveStrategy !== null ||
    hasExplicitHostIslandMetadata;
  state.currentHostIslandMetadata = nextHostIslandMetadata;

  try {
    const significantChildren = node.children.filter((child) => {
      if (child.type === "JSXText") return child.value.trim() !== "";
      if (isJSXExpressionContainer(child)) {
        return !isJSXEmptyExpression(child.expression);
      }
      return true;
    });

    if (significantChildren.length > 0) {
      const childExprs: ESTNode[] = [];

      for (const child of significantChildren) {
        if (child.type === "JSXText") {
          const text = child.value.trim();
          if (text !== "") childExprs.push(nLit(text));
          continue;
        }

        if (isJSXExpressionContainer(child)) {
          if (!isJSXEmptyExpression(child.expression)) {
            childExprs.push(
              containsJSXNode(child.expression)
                ? transformNestedJSX(child.expression, state, nested)
                : child.expression,
            );
          }
          continue;
        }

        if (isJSXSpreadChild(child)) {
          childExprs.push(transformNestedJSX(child.expression, state, nested));
          continue;
        }

        if (isJSXElement(child)) {
          if (isComponentTag(child.openingElement.name)) {
            childExprs.push(buildComponentCall(child, state, nested));
          } else {
            childExprs.push(
              state.mode === "ssr"
                ? nested.transformJSXForSSRNode(child, state, nested)
                : nested.transformJSXNode(child, state, nested),
            );
          }
          continue;
        }

        if (isJSXFragment(child)) {
          for (const fragChild of child.children) {
            if (fragChild.type === "JSXText") {
              const text = fragChild.value.trim();
              if (text !== "") childExprs.push(nLit(text));
              continue;
            }

            if (isJSXExpressionContainer(fragChild)) {
              if (!isJSXEmptyExpression(fragChild.expression)) {
                childExprs.push(
                  containsJSXNode(fragChild.expression)
                    ? transformNestedJSX(fragChild.expression, state, nested)
                    : fragChild.expression,
                );
              }
              continue;
            }

            if (isJSXSpreadChild(fragChild)) {
              childExprs.push(
                transformNestedJSX(fragChild.expression, state, nested),
              );
              continue;
            }

            if (isJSXElement(fragChild)) {
              if (isComponentTag(fragChild.openingElement.name)) {
                childExprs.push(buildComponentCall(fragChild, state, nested));
              } else {
                childExprs.push(
                  state.mode === "ssr"
                    ? nested.transformJSXForSSRNode(fragChild, state, nested)
                    : nested.transformJSXNode(fragChild, state, nested),
                );
              }
            }
          }
        }
      }

      const onlyChild = childExprs[0];
      if (childExprs.length === 1) {
        propsProperties.push(nProp(nId("children"), onlyChild));
      } else if (childExprs.length > 1) {
        propsProperties.push(nProp(nId("children"), nArr(childExprs)));
      }
    }

    return {
      type: "CallExpression",
      callee: componentRef,
      arguments: [nObj(propsProperties)],
      optional: false,
    };
  } finally {
    state.currentHostIslandMetadata = previousHostIslandMetadata;
  }
}

/**
 * Recursively transform any JSX nodes embedded within an arbitrary expression.
 */
function transformNestedJSX(
  expr: ESTNode,
  state: TransformState,
  nested: NestedTransformers,
): ESTNode {
  return walk(expr, null, {
    JSXElement(node: ESTNode) {
      const el = node as JSXElement;
      if (isComponentTag(el.openingElement.name)) {
        return buildComponentCall(el, state, nested);
      }
      if (state.mode === "ssr") {
        return nested.transformJSXForSSRNode(el, state, nested);
      }
      return nested.transformJSXNode(el, state, nested);
    },
    JSXFragment(node: ESTNode) {
      if (state.mode === "ssr") {
        return nested.transformJSXForSSRNode(
          node as JSXFragment,
          state,
          nested,
        );
      }
      return nested.transformJSXNode(node as JSXFragment, state, nested);
    },
  });
}

/**
 * Check if a key is an event handler.
 */
function isEventHandlerKey(key: string): boolean {
  return (
    key.startsWith("on") && key.length > 2 && key[2] === key[2].toUpperCase()
  );
}

/**
 * Convert event key to event type.
 */
function getEventType(key: string): string {
  return key.slice(2).toLowerCase();
}

/**
 * Process JSX attributes.
 */
function processAttributes(
  attributes: (JSXAttribute | JSXSpreadAttribute)[],
  dynamicParts: DynamicPart[],
  path: number[],
  state: TransformState,
  colocatedClientState: ColocatedClientState,
): ProcessedAttributes {
  const staticProps: ESTNode[] = [];
  const events: { type: string; handler: ESTNode }[] = [];

  for (const attr of attributes) {
    if (attr.type === "JSXSpreadAttribute") {
      dynamicParts.push({ type: "spread", path, expression: attr.argument });
      continue;
    }

    if (getIslandsDirectiveName(attr.name) !== null) {
      throw new Error(
        "[dathra] client:* directives are only supported on component elements",
      );
    }

    const colocatedClientDirective = getColocatedClientDirective(attr.name);
    if (colocatedClientDirective !== null) {
      const value = attr.value;
      const rawName = getRawAttributeNameForDiagnostics(attr.name);
      if (
        shouldRejectColocatedDirectiveInNamespace(state.currentElementNamespace)
      ) {
        throw new Error(
          `[dathra] ${getRawAttributeNameForDiagnostics(attr.name)} is only supported on HTML elements`,
        );
      }

      if (
        value === null ||
        !isJSXExpressionContainer(value) ||
        isJSXEmptyExpression(value.expression)
      ) {
        throw new Error(
          `[dathra] ${rawName} requires an inline handler expression`,
        );
      }

      assertNoHostIslandsMixing(
        state.currentHostIslandMetadata,
        colocatedClientDirective.strategy,
      );

      if (
        colocatedClientState.strategy !== null &&
        colocatedClientState.strategy !== colocatedClientDirective.strategy
      ) {
        throw new Error(
          "[dathra] Mixed colocated client strategies are not supported in one JSX root",
        );
      }

      if (
        colocatedClientDirective.strategy === "interaction" &&
        colocatedClientState.interactionEventType !== null &&
        colocatedClientState.interactionEventType !==
          colocatedClientDirective.event
      ) {
        throw new Error(
          "[dathra] Mixed colocated interaction event types are not supported in one JSX root",
        );
      }

      colocatedClientState.strategy = colocatedClientDirective.strategy;
      if (colocatedClientDirective.strategy === "interaction") {
        colocatedClientState.interactionEventType =
          colocatedClientDirective.event;
      }
      const targetId = createClientTargetId(state);
      staticProps.push(
        nProp(nLit(CLIENT_TARGET_METADATA_ATTRIBUTE), nLit(targetId)),
        nProp(
          nLit(CLIENT_STRATEGY_METADATA_ATTRIBUTE),
          nLit(colocatedClientDirective.strategy),
        ),
      );
      if (
        colocatedClientDirective.strategy === "interaction" &&
        colocatedClientDirective.event !== DEFAULT_INTERACTION_EVENT_TYPE
      ) {
        staticProps.push(
          nProp(
            nLit(CLIENT_EVENT_METADATA_ATTRIBUTE),
            nLit(colocatedClientDirective.event),
          ),
        );
      }
      events.push({
        type: colocatedClientDirective.event,
        handler: value.expression,
      });
      continue;
    }

    const unsupportedColocatedDirectiveError =
      getUnsupportedColocatedDirectiveError(attr.name);
    if (unsupportedColocatedDirectiveError !== null) {
      throw new Error(`[dathra] ${unsupportedColocatedDirectiveError}`);
    }

    if (isClientDirectiveNamespace(attr.name)) {
      throwUnknownClientDirective(attr.name);
    }

    const key = getAttributeName(attr.name);

    const reservedClientMetadataError = getReservedClientMetadataError(key);
    if (reservedClientMetadataError !== null) {
      throw new Error(reservedClientMetadataError);
    }

    const keyNode = isValidIdentifier(key) ? nId(key) : nLit(key);
    const computed = !isValidIdentifier(key);
    const value = attr.value;

    if (value === null) {
      staticProps.push(nProp(keyNode, nLit(true), computed));
      continue;
    }

    if (isStringLiteral(value)) {
      staticProps.push(nProp(keyNode, value, computed));
      continue;
    }

    if (isJSXExpressionContainer(value)) {
      const expr = value.expression;
      if (isJSXEmptyExpression(expr)) continue;

      if (isEventHandlerKey(key)) {
        events.push({ type: getEventType(key), handler: expr });
      } else if (containsReactiveAccess(expr)) {
        dynamicParts.push({ type: "attr", path, expression: expr, key });
      } else {
        dynamicParts.push({ type: "attr", path, expression: expr, key });
      }
    }
  }

  return {
    attrs: staticProps.length > 0 ? nObj(staticProps) : nLit(null),
    events,
  };
}

/**
 * Convert a single JSX element to a tree node result.
 */
function jsxElementToTree(
  node: JSXElement,
  state: TransformState,
  dynamicParts: DynamicPart[],
  path: number[],
  nested: NestedTransformers,
): TreeResult {
  const opening = node.openingElement;
  const tagName = getTagName(opening.name);
  const previousElementNamespace = state.currentElementNamespace;
  const nextElementNamespace =
    previousElementNamespace === "html"
      ? getElementNamespace(tagName)
      : previousElementNamespace;
  state.currentElementNamespace = nextElementNamespace;

  try {
    const { attrs, events } = processAttributes(
      opening.attributes,
      dynamicParts,
      path,
      state,
      state.currentColocatedClientState ?? {
        strategy: null,
        interactionEventType: null,
      },
    );

    const children = processChildren(
      node.children,
      state,
      dynamicParts,
      path,
      nested,
    );

    const treeElements: ESTNode[] = [
      nLit(tagName),
      attrs,
      ...children.map((c) => c.tree),
    ];

    for (const evt of events) {
      dynamicParts.push({
        type: "event",
        path,
        expression: evt.handler,
        key: evt.type,
      });
    }

    return {
      tree: nArr(treeElements),
      // Dynamic parts are collected via the `dynamicParts` parameter (by reference).
      // The returned array is unused by callers; kept empty for TreeResult conformance.
      dynamicParts: [],
    };
  } finally {
    state.currentElementNamespace = previousElementNamespace;
  }
}

/**
 * Process JSX children into tree results.
 */
function processChildren(
  children: JSXChild[],
  state: TransformState,
  dynamicParts: DynamicPart[],
  parentPath: number[],
  nested: NestedTransformers,
): TreeResult[] {
  const results: TreeResult[] = [];
  let childIndex = 0;

  for (const child of children) {
    if (child.type === "JSXText") {
      const text = child.value.trim();
      if (text !== "") {
        results.push({ tree: nLit(text), dynamicParts: [] });
        childIndex++;
      }
      continue;
    }

    if (isJSXElement(child)) {
      if (isComponentTag(child.openingElement.name)) {
        dynamicParts.push({
          type: "insert",
          isComponent: true,
          path: [...parentPath, childIndex],
          expression: buildComponentCall(child, state, nested),
        });
        results.push({
          tree: nArr([nLit("{insert}"), nLit(null)]),
          dynamicParts: [],
        });
        childIndex++;
        continue;
      }

      const childPath = [...parentPath, childIndex];
      results.push(
        jsxElementToTree(child, state, dynamicParts, childPath, nested),
      );
      childIndex++;
      continue;
    }

    if (isJSXFragment(child)) {
      const processed = processChildren(
        child.children,
        state,
        dynamicParts,
        parentPath,
        nested,
      );
      results.push(...processed);
      childIndex += processed.length;
      continue;
    }

    if (isJSXSpreadChild(child)) {
      dynamicParts.push({
        type: "insert",
        path: [...parentPath, childIndex],
        expression: transformNestedJSX(child.expression, state, nested),
      });
      results.push({
        tree: nArr([nLit("{insert}"), nLit(null)]),
        dynamicParts: [],
      });
      childIndex++;
      continue;
    }

    if (isJSXExpressionContainer(child)) {
      const expr = child.expression;
      if (isJSXEmptyExpression(expr)) continue;

      if (isMapCallExpression(expr)) {
        dynamicParts.push({
          type: "insert",
          path: [...parentPath, childIndex],
          expression: transformNestedJSX(expr, state, nested),
        });
        results.push({
          tree: nArr([nLit("{each}"), nLit(null)]),
          dynamicParts: [],
        });
        childIndex++;
        continue;
      }

      if (isCallExpression(expr) || expr.type === "ConditionalExpression") {
        dynamicParts.push({
          type: "insert",
          path: [...parentPath, childIndex],
          expression: transformNestedJSX(expr, state, nested),
        });
        results.push({
          tree: nArr([nLit("{insert}"), nLit(null)]),
          dynamicParts: [],
        });
        childIndex++;
        continue;
      }

      if (expr.type === "LogicalExpression" || containsJSXNode(expr)) {
        dynamicParts.push({
          type: "insert",
          path: [...parentPath, childIndex],
          expression: transformNestedJSX(expr, state, nested),
        });
        results.push({
          tree: nArr([nLit("{insert}"), nLit(null)]),
          dynamicParts: [],
        });
        childIndex++;
        continue;
      }

      dynamicParts.push({
        type: "text",
        path: [...parentPath, childIndex],
        expression: expr,
      });
      results.push({
        tree: nArr([nLit("{text}"), nLit(null)]),
        dynamicParts: [],
      });
      childIndex++;
    }
  }

  return results;
}

/**
 * Convert JSX element/fragment to structured array tree.
 */
function jsxToTree(
  node: JSXElement | JSXFragment,
  state: TransformState,
  nested: NestedTransformers,
): { tree: ESTNode; dynamicParts: DynamicPart[] } {
  const dynamicParts: DynamicPart[] = [];
  const scopedState = state;
  const previousColocatedClientState = scopedState.currentColocatedClientState;
  const previousHostIslandMetadata = scopedState.currentHostIslandMetadata;
  const previousElementNamespace = scopedState.currentElementNamespace;
  const colocatedClientState = previousColocatedClientState ?? {
    strategy: null,
    interactionEventType: null,
  };
  scopedState.currentColocatedClientState = colocatedClientState;
  scopedState.currentHostIslandMetadata = previousHostIslandMetadata ?? false;
  scopedState.currentElementNamespace = previousElementNamespace ?? "html";

  if (node.type === "JSXFragment") {
    const children = processChildren(
      node.children,
      scopedState,
      dynamicParts,
      [],
      nested,
    );
    const result = {
      tree: nArr(children.map((c) => c.tree)),
      dynamicParts,
    };
    scopedState.currentColocatedClientState = previousColocatedClientState;
    scopedState.currentHostIslandMetadata = previousHostIslandMetadata;
    scopedState.currentElementNamespace = previousElementNamespace;
    return result;
  }

  const result = jsxElementToTree(node, scopedState, dynamicParts, [0], nested);
  scopedState.currentColocatedClientState = previousColocatedClientState;
  scopedState.currentHostIslandMetadata = previousHostIslandMetadata;
  scopedState.currentElementNamespace = previousElementNamespace;
  return { tree: nArr([result.tree]), dynamicParts };
}

function isMapCallExpression(expr: ESTNode): expr is CallExpression {
  if (!isCallExpression(expr)) return false;
  if (!isMemberExpression(expr.callee)) return false;
  const method = expr.callee.property;
  return isIdentifier(method) && method.name === "map";
}

function containsJSXNode(expr: ESTNode): boolean {
  if (expr.type === "JSXElement" || expr.type === "JSXFragment") {
    return true;
  }

  let found = false;
  walk(expr, null, {
    JSXElement() {
      found = true;
    },
    JSXFragment() {
      found = true;
    },
  });

  return found;
}

function getAttributeName(name: JSXAttribute["name"]): string {
  if (name.type === "JSXIdentifier") {
    return name.name;
  }

  return `${name.namespace.name}:${name.name.name}`;
}

function isJSXElement(node: ESTNode): node is JSXElement {
  return node.type === "JSXElement";
}

function isJSXFragment(node: ESTNode): node is JSXFragment {
  return node.type === "JSXFragment";
}

function isJSXExpressionContainer(
  node: ESTNode,
): node is JSXExpressionContainer {
  return node.type === "JSXExpressionContainer";
}

function isJSXEmptyExpression(node: ESTNode): node is JSXEmptyExpression {
  return node.type === "JSXEmptyExpression";
}

function isJSXSpreadChild(node: ESTNode): node is JSXSpreadChild {
  return node.type === "JSXSpreadChild";
}

export {
  buildComponentCall,
  containsReactiveAccess,
  jsxElementToTree,
  jsxToTree,
  processAttributes,
  processChildren,
};
export type {
  DynamicPart,
  NestedTransformers,
  ProcessedAttributes,
  TreeResult,
};
