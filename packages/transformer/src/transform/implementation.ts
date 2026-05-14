import { parseSync } from "oxc-parser";
import { print } from "esrap";
import ts from "esrap/languages/ts";
import { walk } from "zimmerframe";
import { ISLAND_METADATA_ATTRIBUTE } from "@dathra/shared";

import {
  isCallExpression,
  isIdentifier,
  isMemberExpression,
  isStringLiteral,
  nArr,
  nArrowBlock,
  nBlock,
  nCall,
  nExprStmt,
  nId,
  nLit,
  nMember,
  nObj,
  nProp,
  nReturn,
  type ESTNode,
  type Program,
} from "@/transform/ast/implementation";
import {
  getColocatedClientDirective,
  getTagName,
  isComponentTag,
  type JSXElement,
  type JSXFragment,
} from "@/transform/jsx/implementation";
import { transformJSXNode } from "@/transform/mode-csr/implementation";
import { transformJSXForSSRNode } from "@/transform/mode-ssr/implementation";
import { addRuntimeImports } from "@/transform/runtimeImports/implementation";
import { createInitialState } from "@/transform/state/implementation";
import {
  buildComponentCall,
  jsxToTree,
  type DynamicPart,
  type NestedTransformers,
} from "@/transform/tree/implementation";

import type { TransformOptions, TransformResult } from "../types";

const RESERVED_BINDING_NAMES = new Set(["__dh_host", "__dh_ctx"]);

interface FunctionLikeNode extends ESTNode {
  params?: ESTNode[];
  body: ESTNode;
}

interface CollectedComponentPlan {
  bodyIndex: number;
  declarationIndex: number;
  metadata: ESTNode;
}

interface ComponentRenderAnalysis {
  jsxRoot: JSXElement | JSXFragment;
  paramPattern: ESTNode | null;
  preludeStatements: ESTNode[];
}

interface FunctionRenderFrame {
  paramPatterns: ESTNode[];
  preludeStatements: ESTNode[];
  returnExpression: ESTNode | null;
}

interface ComponentHydrationBuildResult {
  metadata: ESTNode;
}

type HelperLookup = ReadonlyMap<string, ESTNode>;

interface ResolvedHelperCall {
  helperName: string;
  helperNode: ESTNode;
  helperFrame: FunctionRenderFrame;
  callArguments: ESTNode[];
}

interface TransparentThunkWrapperResolution {
  readonly thunkArgumentIndex: number;
  readonly thunkFunction: ESTNode;
}

interface HelperChainResolution {
  rootFrame: FunctionRenderFrame;
  helperFrames: Array<{
    helperName: string;
    helperFrame: FunctionRenderFrame;
    callArguments: ESTNode[];
  }>;
}

interface RenameState {
  usedNames: Set<string>;
}

interface ResolvedRenderAnalysis {
  analysis: ComponentRenderAnalysis;
  usedHelper: boolean;
}

interface WalkTransformState {
  inJSX: boolean;
  serializableBindings: Map<string, ESTNode>;
}

const KNOWN_IMPORTED_TRANSPARENT_THUNK_WRAPPERS = new Map<
  string,
  ReadonlySet<string>
>([
  ["@dathra/core", new Set(["withStore"])],
  ["@dathra/store", new Set(["withStore"])],
]);

/**
 * Adapt an oxc-parser Program to our internal ESTNode representation.
 *
 * oxc-parser outputs `@oxc-project/types.Program` which is structurally
 * compatible with `ESTNode` at runtime but lacks the index signature
 * `[key: string]: unknown`.  We validate the structural contract and
 * return the same object typed as `ESTNode`.
 */
function adaptParsedProgram(
  program: ReturnType<typeof parseSync>["program"],
): ESTNode {
  /* c8 ignore next @preserve -- defensive guard: oxc-parser always returns a valid Program node */
  if (!("type" in program)) {
    throw new TypeError("Expected an ESTree-compatible Program node");
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- boundary between oxc-parser types and internal ESTNode
  return program as unknown as ESTNode;
}

function toPrintableProgram(program: Program): Parameters<typeof print>[0] {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any -- internal ESTree-like program is structurally compatible with esrap's expected node type
  return program as unknown as Parameters<typeof print>[0];
}

function isJSXElement(node: ESTNode): node is JSXElement {
  return node.type === "JSXElement";
}

function isJSXFragment(node: ESTNode): node is JSXFragment {
  return node.type === "JSXFragment";
}

function isFunctionLikeNode(
  node: ESTNode | null | undefined,
): node is FunctionLikeNode {
  return (
    node?.type === "ArrowFunctionExpression" ||
    node?.type === "FunctionExpression"
  );
}

function isBlockStatement(
  node: ESTNode | null | undefined,
): node is ESTNode & { body: ESTNode[] } {
  return node?.type === "BlockStatement" && Array.isArray(node.body);
}

function isIfStatement(node: ESTNode | null | undefined): node is ESTNode & {
  test: ESTNode | null;
  consequent: ESTNode;
  alternate: ESTNode | null;
} {
  return node?.type === "IfStatement";
}

function isReturnStatement(
  node: ESTNode | null | undefined,
): node is ESTNode & { argument: ESTNode | null } {
  return node?.type === "ReturnStatement";
}

function isVariableDeclaration(
  node: ESTNode | null | undefined,
): node is ESTNode & {
  declarations: Array<{ id: ESTNode; init?: ESTNode | null }>;
} {
  return (
    node?.type === "VariableDeclaration" && Array.isArray(node.declarations)
  );
}

function isExportNamedDeclaration(
  node: ESTNode | null | undefined,
): node is ESTNode & {
  declaration?: ESTNode | null;
} {
  return node?.type === "ExportNamedDeclaration";
}

function isFunctionDeclaration(
  node: ESTNode | null | undefined,
): node is ESTNode & {
  id?: ESTNode | null;
  params?: ESTNode[];
  body: ESTNode;
} {
  return node?.type === "FunctionDeclaration";
}

function isDefineComponentCall(
  node: ESTNode | null | undefined,
): node is ESTNode & {
  arguments: ESTNode[];
} {
  if (node === null || node === undefined || !isCallExpression(node)) {
    return false;
  }

  return isIdentifier(node.callee) && node.callee.name === "defineComponent";
}

function cloneNode<T>(value: T): T {
  return JSON.parse(JSON.stringify(value)) as T;
}

function isVariableDeclarationStatement(node: ESTNode): node is ESTNode & {
  declarations: Array<{ id: ESTNode; init?: ESTNode | null }>;
} {
  return (
    node.type === "VariableDeclaration" && Array.isArray(node.declarations)
  );
}

function isFunctionDeclarationStatement(node: ESTNode): node is ESTNode & {
  id?: ESTNode | null;
  params?: ESTNode[];
  body: ESTNode;
} {
  return node.type === "FunctionDeclaration";
}

function isImportDeclaration(
  node: ESTNode | null | undefined,
): node is ESTNode & {
  specifiers?: ESTNode[];
  source: ESTNode;
} {
  return node?.type === "ImportDeclaration";
}

function isESTNode(value: unknown): value is ESTNode {
  return typeof value === "object" && value !== null && "type" in value;
}

function isComputedProperty(value: unknown): value is true {
  return value === true;
}

function isParenthesizedExpression(node: ESTNode): node is ESTNode & {
  expression: ESTNode;
} {
  return node.type === "ParenthesizedExpression" && isESTNode(node.expression);
}

function collectBindingNames(
  pattern: ESTNode,
  names: Set<string> = new Set(),
): Set<string> {
  if (isIdentifier(pattern)) {
    names.add(pattern.name);
    return names;
  }

  if (pattern.type === "ObjectPattern") {
    for (const property of pattern.properties as ESTNode[]) {
      if (property.type === "Property") {
        collectBindingNames(property.value as ESTNode, names);
      } else if (property.type === "RestElement") {
        collectBindingNames(property.argument as ESTNode, names);
      }
    }
    return names;
  }

  if (pattern.type === "ArrayPattern") {
    for (const element of pattern.elements as Array<ESTNode | null>) {
      if (element !== null) {
        collectBindingNames(element, names);
      }
    }
    return names;
  }

  if (pattern.type === "AssignmentPattern") {
    collectBindingNames(pattern.left as ESTNode, names);
    return names;
  }

  if (pattern.type === "RestElement") {
    collectBindingNames(pattern.argument as ESTNode, names);
  }

  return names;
}

function cloneWithRenames<T extends ESTNode>(
  node: T,
  renameMap: ReadonlyMap<string, string>,
): T {
  if (renameMap.size === 0) {
    return cloneNode(node);
  }

  const cloned = cloneNode(node) as ESTNode;
  for (const [from, to] of renameMap) {
    replaceIdentifierName(cloned, from, to);
  }

  return cloned as T;
}

function replaceIdentifierName(node: ESTNode, from: string, to: string): void {
  if (isIdentifier(node) && node.name === from) {
    node.name = to;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        if (isESTNode(item)) {
          replaceIdentifierName(item, from, to);
        }
      }
      continue;
    }

    if (isESTNode(value)) {
      replaceIdentifierName(value, from, to);
    }
  }
}

function createUniqueName(baseName: string, usedNames: Set<string>): string {
  let candidate = baseName;
  let index = 1;

  while (usedNames.has(candidate)) {
    candidate = `${baseName}_${index}`;
    index += 1;
  }

  usedNames.add(candidate);
  return candidate;
}

function renamePatternWithCollisions(
  pattern: ESTNode,
  state: RenameState,
): {
  pattern: ESTNode;
  renameMap: Map<string, string>;
} {
  const renameMap = new Map<string, string>();
  const usedLocalNames = new Set<string>();

  for (const name of collectBindingNames(pattern)) {
    /* c8 ignore next @preserve -- defensive guard: collectBindingNames produces unique names */
    if (usedLocalNames.has(name)) {
      continue;
    }

    usedLocalNames.add(name);
    const nextName =
      state.usedNames.has(name) || RESERVED_BINDING_NAMES.has(name)
        ? createUniqueName(name, state.usedNames)
        : (state.usedNames.add(name), name);

    if (nextName !== name) {
      renameMap.set(name, nextName);
    }
  }

  return {
    pattern: cloneWithRenames(pattern, renameMap),
    renameMap,
  };
}

interface ObjectLiteralHelperResolution {
  helperName: string;
  helperNode: ESTNode;
}

function renameStatementWithCollisions(
  statement: ESTNode,
  state: RenameState,
): ESTNode {
  if (
    isFunctionDeclarationStatement(statement) &&
    statement.id !== null &&
    statement.id !== undefined &&
    isIdentifier(statement.id)
  ) {
    const renameMap = new Map<string, string>();
    const nextName =
      state.usedNames.has(statement.id.name) ||
      RESERVED_BINDING_NAMES.has(statement.id.name)
        ? createUniqueName(statement.id.name, state.usedNames)
        : (state.usedNames.add(statement.id.name), statement.id.name);

    if (nextName !== statement.id.name) {
      renameMap.set(statement.id.name, nextName);
    }

    return cloneWithRenames(statement, renameMap);
  }

  /* c8 ignore next @preserve -- defensive guard: only called with VariableDeclaration/FunctionDeclaration prelude statements */
  return cloneNode(statement);
}

function applyRenameMapToStatementReferences(
  statement: ESTNode,
  renameMap: ReadonlyMap<string, string>,
): ESTNode {
  if (isVariableDeclarationStatement(statement)) {
    const cloned = cloneNode(statement);
    for (const declarator of cloned.declarations) {
      if (declarator.init !== null && declarator.init !== undefined) {
        declarator.init = cloneWithRenames(declarator.init, renameMap);
      }
    }
    return cloned;
  }

  if (isFunctionDeclarationStatement(statement)) {
    const cloned = cloneNode(statement);
    cloned.body = cloneWithRenames(cloned.body, renameMap);
    if (Array.isArray(cloned.params)) {
      cloned.params = cloned.params.map((param) => cloneNode(param));
    }
    return cloned;
  }

  /* c8 ignore next @preserve -- defensive guard: only called with prelude statements already filtered */
  return cloneWithRenames(statement, renameMap);
}

function buildCollisionSafePlanAnalysis(
  setupParamPattern: ESTNode | null,
  analysisPreludeStatements: readonly ESTNode[],
  jsxRoot: JSXElement | JSXFragment,
): { preludeStatements: ESTNode[]; jsxRoot: JSXElement | JSXFragment } {
  const state: RenameState = {
    usedNames: new Set(RESERVED_BINDING_NAMES),
  };

  let activeRenameMap = new Map<string, string>();
  const statements: ESTNode[] = [];
  if (setupParamPattern !== null) {
    const { pattern, renameMap } = renamePatternWithCollisions(
      setupParamPattern,
      state,
    );
    activeRenameMap = new Map([...activeRenameMap, ...renameMap]);
    statements.push(createConstDeclaration(pattern, nId("__dh_ctx")));
  }

  for (const statement of analysisPreludeStatements) {
    const withPriorRefs = applyRenameMapToStatementReferences(
      statement,
      activeRenameMap,
    );

    if (isVariableDeclarationStatement(withPriorRefs)) {
      const localRenameMap = new Map<string, string>();
      for (const declarator of withPriorRefs.declarations) {
        if (declarator.init !== null && declarator.init !== undefined) {
          declarator.init = cloneWithRenames(declarator.init, localRenameMap);
        }

        const { pattern, renameMap } = renamePatternWithCollisions(
          declarator.id,
          state,
        );
        declarator.id = pattern;
        for (const [from, to] of renameMap) {
          localRenameMap.set(from, to);
        }
      }

      activeRenameMap = new Map([...activeRenameMap, ...localRenameMap]);
      statements.push(withPriorRefs);
      continue;
    }

    const renamedStatement = renameStatementWithCollisions(
      withPriorRefs,
      state,
    );
    if (
      isFunctionDeclarationStatement(renamedStatement) &&
      renamedStatement.id !== null &&
      renamedStatement.id !== undefined &&
      isIdentifier(renamedStatement.id)
    ) {
      const originalName =
        isFunctionDeclarationStatement(statement) &&
        statement.id !== null &&
        statement.id !== undefined &&
        isIdentifier(statement.id)
          ? statement.id.name
          : renamedStatement.id.name;
      activeRenameMap.set(originalName, renamedStatement.id.name);
    }
    statements.push(renamedStatement);
  }

  return {
    preludeStatements: statements,
    jsxRoot: cloneWithRenames(jsxRoot, activeRenameMap),
  };
}

function containsJSXNode(node: ESTNode): boolean {
  /* c8 ignore next @preserve -- defensive guard: only called with prelude statements, never JSX directly */
  if (node.type === "JSXElement" || node.type === "JSXFragment") {
    return true;
  }

  let found = false;
  walk(node, null, {
    JSXElement() {
      found = true;
    },
    JSXFragment() {
      found = true;
    },
  });
  return found;
}

/**
 * Detect whether the given AST node contains any colocated client
 * directive (e.g. `load:onClick`, `interaction:onClick`) on a
 * JSX attribute. This is a lightweight scan used to guard against
 * the combination of unsupported hydration patterns and colocated
 * directives — which would silently fall back to a full rerender
 * (Path B) and lose SSR state.
 */
function containsColocatedDirective(node: ESTNode): boolean {
  let found = false;
  walk(node, null, {
    JSXAttribute(attr: ESTNode) {
      if (
        attr.type === "JSXAttribute" &&
        getColocatedClientDirective(
          attr.name as Parameters<typeof getColocatedClientDirective>[0],
        ) !== null
      ) {
        found = true;
      }
    },
  });
  return found;
}

type ScopedBinding = {
  init: ESTNode | null;
  kind: "param" | "decl";
};

function resolveScopedBinding(
  scopes: readonly ReadonlyMap<string, ScopedBinding>[],
  name: string,
): ScopedBinding | undefined {
  for (let index = scopes.length - 1; index >= 0; index -= 1) {
    const binding = scopes[index]?.get(name);
    if (binding !== undefined) {
      return binding;
    }
  }

  return undefined;
}

function collectScopedBindingsFromStatements(
  statements: readonly ESTNode[],
): Map<string, ScopedBinding> {
  const bindings = new Map<string, ScopedBinding>();

  for (const statement of statements) {
    if (statement.type === "VariableDeclaration") {
      for (const declarator of statement.declarations as ESTNode[]) {
        const variableDeclarator = declarator as ESTNode & {
          id: ESTNode;
          init: ESTNode | null;
        };
        if (isIdentifier(variableDeclarator.id)) {
          bindings.set(variableDeclarator.id.name, {
            init: variableDeclarator.init,
            kind: "decl",
          });
          continue;
        }

        for (const name of collectBindingNames(variableDeclarator.id)) {
          bindings.set(name, { init: null, kind: "decl" });
        }
      }
      continue;
    }

    if (statement.type === "FunctionDeclaration" && statement.id) {
      for (const name of collectBindingNames(statement.id as ESTNode)) {
        bindings.set(name, { init: null, kind: "decl" });
      }
      continue;
    }

    if (statement.type === "ClassDeclaration" && statement.id) {
      for (const name of collectBindingNames(statement.id as ESTNode)) {
        bindings.set(name, { init: null, kind: "decl" });
      }
    }
  }

  return bindings;
}

function createFunctionScope(
  node: FunctionLikeNode | ESTNode,
): Map<string, ScopedBinding> {
  const scope = new Map<string, ScopedBinding>();

  if (
    node.type === "FunctionExpression" &&
    node.id &&
    isIdentifier(node.id as ESTNode)
  ) {
    scope.set((node.id as ESTNode & { name: string }).name, {
      init: null,
      kind: "decl",
    });
  }

  if (
    node.type === "FunctionDeclaration" &&
    node.id &&
    isIdentifier(node.id as ESTNode)
  ) {
    scope.set((node.id as ESTNode & { name: string }).name, {
      init: null,
      kind: "decl",
    });
  }

  for (const param of (node.params ?? []) as ESTNode[]) {
    if (isIdentifier(param)) {
      scope.set(param.name, { init: null, kind: "param" });
      continue;
    }

    for (const name of collectBindingNames(param)) {
      scope.set(name, { init: null, kind: "param" });
    }
  }

  const body = (node as FunctionLikeNode).body;
  if (isBlockStatement(body)) {
    for (const [name, binding] of collectScopedBindingsFromStatements(
      body.body,
    )) {
      scope.set(name, binding);
    }
  }

  return scope;
}

function isGlobalAliasExpression(
  node: ESTNode | null | undefined,
  target: "document" | "window" | "Text" | "Comment" | "DocumentFragment",
  scopes: readonly ReadonlyMap<string, ScopedBinding>[],
  visited: Set<string> = new Set(),
): boolean {
  if (node == null) {
    return false;
  }

  const current = unwrapParenthesizedExpression(node);
  if (isIdentifier(current)) {
    if (current.name === target) {
      const binding = resolveScopedBinding(scopes, current.name);
      return binding === undefined;
    }

    if (target === "window" && current.name === "globalThis") {
      return resolveScopedBinding(scopes, current.name) === undefined;
    }

    if (visited.has(current.name)) {
      return false;
    }

    const binding = resolveScopedBinding(scopes, current.name);
    if (binding === undefined) {
      return false;
    }

    visited.add(current.name);
    return isGlobalAliasExpression(binding.init, target, scopes, visited);
  }

  if (isMemberExpression(current)) {
    if (current.computed) {
      return false;
    }

    if (isIdentifier(current.object) && isIdentifier(current.property)) {
      const objectName = current.object.name;
      const propertyName = current.property.name;

      if (
        objectName === "globalThis" &&
        resolveScopedBinding(scopes, objectName) === undefined
      ) {
        if (target === "window" && propertyName === "window") {
          return true;
        }

        if (propertyName === target) {
          return true;
        }
      }

      if (target === "document" && propertyName === "document") {
        return isGlobalAliasExpression(
          current.object as ESTNode,
          "window",
          scopes,
          visited,
        );
      }

      if (
        ["Text", "Comment", "DocumentFragment"].includes(target) &&
        propertyName === target
      ) {
        return isGlobalAliasExpression(
          current.object as ESTNode,
          "window",
          scopes,
          visited,
        );
      }
    }
  }

  return false;
}

function containsImperativeDomQuery(
  node: ESTNode | null | undefined,
  trackedParams: ReadonlySet<string>,
  scopes: readonly ReadonlyMap<string, ScopedBinding>[] = [],
): boolean {
  if (!isESTNode(node)) {
    return false;
  }

  if (isIdentifier(node)) {
    if (node.name === "document" || node.name === "window") {
      const binding = resolveScopedBinding(scopes, node.name);
      return (
        binding === undefined ||
        isGlobalAliasExpression(binding.init, node.name, scopes)
      );
    }

    if (
      (node.name === "host" || node.name === "shadowRoot") &&
      trackedParams.has(node.name)
    ) {
      const binding = resolveScopedBinding(scopes, node.name);
      return binding?.kind === "param";
    }

    return false;
  }

  if (node.type === "UnaryExpression" && node.operator === "typeof") {
    return false;
  }

  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    const nextScopes = [
      ...scopes,
      createFunctionScope(node as FunctionLikeNode | ESTNode),
    ];
    const body = (node as FunctionLikeNode).body;
    return containsImperativeDomQuery(body, trackedParams, nextScopes);
  }

  if (isBlockStatement(node)) {
    const nextScopes = [
      ...scopes,
      collectScopedBindingsFromStatements(node.body as ESTNode[]),
    ];
    return (node.body as ESTNode[]).some((statement) =>
      containsImperativeDomQuery(statement, trackedParams, nextScopes),
    );
  }

  if (node.type === "VariableDeclaration") {
    return (node.declarations as ESTNode[]).some((declarator) =>
      containsImperativeDomQuery(
        ((declarator as ESTNode & { init: ESTNode | null }).init ??
          null) as ESTNode,
        trackedParams,
        scopes,
      ),
    );
  }

  if (node.type === "Property" && !node.computed) {
    return containsImperativeDomQuery(
      node.value as ESTNode,
      trackedParams,
      scopes,
    );
  }

  if (node.type === "JSXAttribute") {
    if (node.value && isESTNode(node.value)) {
      return containsImperativeDomQuery(node.value, trackedParams, scopes);
    }
    return false;
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      if (
        value.some(
          (item) =>
            isESTNode(item) &&
            containsImperativeDomQuery(item, trackedParams, scopes),
        )
      ) {
        return true;
      }
      continue;
    }

    if (
      isESTNode(value) &&
      containsImperativeDomQuery(value, trackedParams, scopes)
    ) {
      return true;
    }
  }

  return false;
}

function isObjectExpression(
  node: ESTNode | null | undefined,
): node is ESTNode & { properties: ESTNode[] } {
  return node?.type === "ObjectExpression" && Array.isArray(node.properties);
}

function isNewExpression(node: ESTNode | null | undefined): node is ESTNode & {
  callee: ESTNode;
} {
  return node?.type === "NewExpression";
}

function unwrapParenthesizedExpression(node: ESTNode): ESTNode {
  let current = node;
  while (isParenthesizedExpression(current)) {
    current = current.expression;
  }
  return current;
}

function getReturnedExpression(componentArg: ESTNode): ESTNode | null {
  if (!isFunctionLikeNode(componentArg)) {
    return null;
  }

  if (!isBlockStatement(componentArg.body)) {
    return unwrapParenthesizedExpression(componentArg.body);
  }

  for (const statement of componentArg.body.body) {
    if (isReturnStatement(statement)) {
      return statement.argument ?? null;
    }
  }

  return null;
}

function isZeroArgThunkFunction(node: ESTNode | null | undefined): boolean {
  return (
    (isFunctionLikeNode(node) || isFunctionDeclaration(node)) &&
    (node.params?.length ?? 0) === 0
  );
}

function isTransparentThunkWrapperFunction(
  helperNode: ESTNode,
): TransparentThunkWrapperResolution | null {
  /* c8 ignore next @preserve -- defensive guard: only called with function-like nodes from helper lookup */
  if (!isFunctionLikeNode(helperNode) && !isFunctionDeclaration(helperNode)) {
    return null;
  }

  const params = helperNode.params ?? [];
  for (let index = 0; index < params.length; index += 1) {
    const param = params[index];
    if (!isIdentifier(param)) {
      continue;
    }

    const returnedExpression = getReturnedExpression(helperNode);
    if (
      returnedExpression !== null &&
      isCallExpression(returnedExpression) &&
      isIdentifier(returnedExpression.callee) &&
      returnedExpression.callee.name === param.name &&
      returnedExpression.arguments.length === 0
    ) {
      return {
        thunkArgumentIndex: index,
        thunkFunction: helperNode,
      };
    }
  }

  return null;
}

function collectImportedTransparentThunkWrappers(
  program: Program,
): ReadonlySet<string> {
  const imported = new Set<string>();

  for (const statement of program.body) {
    if (!isImportDeclaration(statement)) {
      continue;
    }

    const source = isStringLiteral(statement.source)
      ? String(statement.source.value)
      : null;
    /* c8 ignore next @preserve -- defensive guard: ImportDeclaration always has a valid string source */
    if (source === null) {
      continue;
    }

    const allowedNames = KNOWN_IMPORTED_TRANSPARENT_THUNK_WRAPPERS.get(source);
    if (allowedNames === undefined) {
      continue;
    }

    for (const specifier of statement.specifiers ?? []) {
      /* c8 ignore next @preserve -- defensive guard: import specifiers always have proper structure */
      if (!isESTNode(specifier)) {
        continue;
      }

      const importSpecifier = specifier as ESTNode & {
        local?: ESTNode;
        imported?: ESTNode;
      };
      const localSpecifier = importSpecifier.local;
      const importedSpecifier = importSpecifier.imported;
      if (
        importSpecifier.type === "ImportSpecifier" &&
        localSpecifier !== undefined &&
        isIdentifier(localSpecifier) &&
        importedSpecifier !== undefined &&
        isIdentifier(importedSpecifier) &&
        allowedNames.has(importedSpecifier.name)
      ) {
        imported.add(localSpecifier.name);
      }
    }
  }

  return imported;
}

function resolveTransparentThunkWrapperCall(
  callExpression: ESTNode,
  helperLookup: HelperLookup,
  importedTransparentThunkWrappers: ReadonlySet<string>,
): ESTNode | null {
  if (
    !isCallExpression(callExpression) ||
    !isIdentifier(callExpression.callee)
  ) {
    return null;
  }

  const helperNode = helperLookup.get(callExpression.callee.name);
  if (helperNode !== undefined) {
    const transparentWrapper = isTransparentThunkWrapperFunction(helperNode);
    if (transparentWrapper === null) {
      return null;
    }

    const thunkArgument =
      callExpression.arguments[transparentWrapper.thunkArgumentIndex];
    if (!isZeroArgThunkFunction(thunkArgument)) {
      return null;
    }

    return thunkArgument;
  }

  if (!importedTransparentThunkWrappers.has(callExpression.callee.name)) {
    return null;
  }

  const thunkArgument = callExpression.arguments.at(-1) ?? null;
  if (!isZeroArgThunkFunction(thunkArgument)) {
    return null;
  }

  return thunkArgument;
}

function resolveObjectLiteralHelperMethod(
  callee: ESTNode,
  helperLookup: HelperLookup,
): ObjectLiteralHelperResolution | null {
  if (
    !isMemberExpression(callee) ||
    !isIdentifier(callee.object) ||
    !isObjectExpression(helperLookup.get(callee.object.name))
  ) {
    return null;
  }

  const helperObject = helperLookup.get(callee.object.name);
  if (!isObjectExpression(helperObject)) {
    return null;
  }

  const propertyName =
    isIdentifier(callee.property) && !callee.computed
      ? callee.property.name
      : isStringLiteral(callee.property)
        ? String(callee.property.value)
        : null;
  if (propertyName === null) {
    return null;
  }

  for (const property of helperObject.properties) {
    if (property.type !== "Property") {
      continue;
    }

    const keyNode = property.key as ESTNode;
    const valueNode = property.value as ESTNode;
    const keyName = isIdentifier(keyNode)
      ? keyNode.name
      : isStringLiteral(keyNode)
        ? String(keyNode.value)
        : null;
    if (keyName !== propertyName) {
      continue;
    }

    if (!isFunctionLikeNode(valueNode) && !isFunctionDeclaration(valueNode)) {
      return null;
    }

    return {
      helperName: `${callee.object.name}.${propertyName}`,
      helperNode: valueNode,
    };
  }

  return null;
}

function resolveTopLevelHelperNode(
  callExpression: ESTNode,
  helperLookup: HelperLookup,
  visitedHelpers: ReadonlySet<string>,
  importedTransparentThunkWrappers: ReadonlySet<string>,
): ResolvedHelperCall | null {
  /* c8 ignore next @preserve -- defensive guard: only called from resolveHelperChain which pre-checks isCallExpression */
  if (!isCallExpression(callExpression)) {
    return null;
  }

  const transparentThunk = resolveTransparentThunkWrapperCall(
    callExpression,
    helperLookup,
    importedTransparentThunkWrappers,
  );
  if (transparentThunk !== null) {
    const helperFrame = extractFunctionRenderFrame(transparentThunk);
    if (helperFrame === null) {
      return null;
    }

    return {
      helperName: isIdentifier(callExpression.callee)
        ? callExpression.callee.name
        : "transparent-wrapper",
      helperNode: transparentThunk,
      helperFrame,
      callArguments: [],
    };
  }

  const objectLiteralHelper = resolveObjectLiteralHelperMethod(
    callExpression.callee,
    helperLookup,
  );
  if (objectLiteralHelper !== null) {
    const helperFrame = extractFunctionRenderFrame(
      objectLiteralHelper.helperNode,
    );
    if (helperFrame === null) {
      return null;
    }

    if (callExpression.arguments.length !== helperFrame.paramPatterns.length) {
      return null;
    }

    return {
      helperName: objectLiteralHelper.helperName,
      helperNode: objectLiteralHelper.helperNode,
      helperFrame,
      callArguments: callExpression.arguments,
    };
  }

  if (!isIdentifier(callExpression.callee)) {
    return null;
  }

  const helperName = callExpression.callee.name;
  if (visitedHelpers.has(helperName)) {
    return null;
  }

  const helperNode = helperLookup.get(helperName);
  if (!isFunctionLikeNode(helperNode) && !isFunctionDeclaration(helperNode)) {
    return null;
  }

  const helperFrame = extractFunctionRenderFrame(helperNode);
  if (helperFrame === null) {
    return null;
  }

  if (callExpression.arguments.length !== helperFrame.paramPatterns.length) {
    return null;
  }

  return {
    helperName,
    helperNode,
    helperFrame,
    callArguments: callExpression.arguments,
  };
}

function containsNodeIdentityCreationWithBindings(
  node: ESTNode | null | undefined,
  scopes: readonly ReadonlyMap<string, ScopedBinding>[],
): boolean {
  if (!isESTNode(node)) {
    return false;
  }

  const documentFactoryNames = [
    "createElement",
    "createTextNode",
    "createComment",
    "createDocumentFragment",
  ];
  const domConstructors = ["Text", "Comment", "DocumentFragment"];

  if (
    isCallExpression(node) &&
    isMemberExpression(node.callee) &&
    isIdentifier(node.callee.object) &&
    isIdentifier(node.callee.property) &&
    documentFactoryNames.includes(node.callee.property.name) &&
    ((node.callee.object.name === "document" &&
      (resolveScopedBinding(scopes, "document") === undefined ||
        isGlobalAliasExpression(
          resolveScopedBinding(scopes, "document")?.init,
          "document",
          scopes,
        ))) ||
      isGlobalAliasExpression(
        node.callee.object as ESTNode,
        "document",
        scopes,
      ))
  ) {
    return true;
  }

  if (
    isNewExpression(node) &&
    isIdentifier(node.callee) &&
    domConstructors.includes(node.callee.name) &&
    (resolveScopedBinding(scopes, node.callee.name) === undefined ||
      isGlobalAliasExpression(
        resolveScopedBinding(scopes, node.callee.name)?.init,
        node.callee.name as "Text" | "Comment" | "DocumentFragment",
        scopes,
      ))
  ) {
    return true;
  }

  if (
    node.type === "FunctionDeclaration" ||
    node.type === "FunctionExpression" ||
    node.type === "ArrowFunctionExpression"
  ) {
    return containsNodeIdentityCreationWithBindings(node.body as ESTNode, [
      ...scopes,
      createFunctionScope(node as FunctionLikeNode | ESTNode),
    ]);
  }

  if (isBlockStatement(node)) {
    const nextScopes = [
      ...scopes,
      collectScopedBindingsFromStatements(node.body as ESTNode[]),
    ];
    return (node.body as ESTNode[]).some((statement) =>
      containsNodeIdentityCreationWithBindings(statement, nextScopes),
    );
  }

  if (node.type === "VariableDeclaration") {
    return (node.declarations as ESTNode[]).some((declarator) =>
      containsNodeIdentityCreationWithBindings(
        (declarator as ESTNode & { init: ESTNode | null }).init,
        scopes,
      ),
    );
  }

  if (node.type === "Property" && !node.computed) {
    return containsNodeIdentityCreationWithBindings(
      node.value as ESTNode,
      scopes,
    );
  }

  for (const value of Object.values(node)) {
    if (Array.isArray(value)) {
      if (
        value.some(
          (item) =>
            isESTNode(item) &&
            containsNodeIdentityCreationWithBindings(item, scopes),
        )
      ) {
        return true;
      }
      continue;
    }

    if (
      isESTNode(value) &&
      containsNodeIdentityCreationWithBindings(value, scopes)
    ) {
      return true;
    }
  }

  return false;
}

function collectFunctionParameterBindings(componentArg: ESTNode): Set<string> {
  const names = new Set<string>();

  if (
    !isFunctionLikeNode(componentArg) &&
    !isFunctionDeclaration(componentArg)
  ) {
    return names;
  }

  for (const param of componentArg.params ?? []) {
    collectBindingNames(param, names);
  }

  return names;
}

function hasNonNormalizableSpread(
  componentArg: ESTNode,
  availableBindings: ReadonlyMap<string, ESTNode>,
): boolean {
  const returnedExpression = getReturnedExpression(componentArg);
  if (
    returnedExpression === null ||
    (!isJSXElement(returnedExpression) && !isJSXFragment(returnedExpression))
  ) {
    return false;
  }

  const hasSpreadInNode = (node: JSXElement | JSXFragment): boolean => {
    if (node.type === "JSXElement") {
      for (const attribute of node.openingElement.attributes as ESTNode[]) {
        if (attribute.type !== "JSXSpreadAttribute") {
          continue;
        }

        const argument = unwrapParenthesizedExpression(
          attribute.argument as ESTNode,
        );
        if (
          isObjectExpression(argument) &&
          argument.properties.some(
            (property) => property.type === "SpreadElement",
          )
        ) {
          return !isNormalizableSpreadArgument(argument, availableBindings);
        }
      }

      for (const child of node.children) {
        if (child.type === "JSXElement" || child.type === "JSXFragment") {
          if (hasSpreadInNode(child)) {
            return true;
          }
        }
      }

      return false;
    }

    for (const child of node.children) {
      if (child.type === "JSXElement" || child.type === "JSXFragment") {
        if (hasSpreadInNode(child)) {
          return true;
        }
      }
    }

    return false;
  };

  return hasSpreadInNode(returnedExpression);
}

function isNormalizableSpreadArgument(
  node: ESTNode | null | undefined,
  availableBindings: ReadonlyMap<string, ESTNode>,
  visitedBindings: Set<string> = new Set(),
): boolean {
  if (node === null || node === undefined) {
    return false;
  }

  const unwrapped = unwrapParenthesizedExpression(node);
  if (isIdentifier(unwrapped)) {
    const binding = availableBindings.get(unwrapped.name);
    if (binding === undefined || visitedBindings.has(unwrapped.name)) {
      return false;
    }

    visitedBindings.add(unwrapped.name);
    return isNormalizableSpreadArgument(
      binding,
      availableBindings,
      visitedBindings,
    );
  }

  if (!isObjectExpression(unwrapped)) {
    return false;
  }

  return unwrapped.properties.every((property) => {
    if (property.type === "SpreadElement") {
      return isNormalizableSpreadArgument(
        property.argument as ESTNode,
        availableBindings,
        new Set(visitedBindings),
      );
    }

    return (
      (!isComputedProperty(property.computed) ||
        isSerializableBindingExpression(
          property.key as ESTNode,
          availableBindings,
        )) &&
      isSerializableBindingExpression(
        property.value as ESTNode,
        availableBindings,
      )
    );
  });
}

function hasRuntimeBranching(componentArg: ESTNode): boolean {
  /* c8 ignore next @preserve -- defensive guard: callers always pass function-like nodes */
  if (!isFunctionLikeNode(componentArg)) {
    return false;
  }

  const unwrappedBody = unwrapParenthesizedExpression(componentArg.body);
  if (
    unwrappedBody.type === "ConditionalExpression" ||
    unwrappedBody.type === "LogicalExpression"
  ) {
    return true;
  }

  if (!isBlockStatement(componentArg.body)) {
    return false;
  }

  for (const statement of componentArg.body.body) {
    if (
      statement.type === "IfStatement" ||
      statement.type === "SwitchStatement"
    ) {
      return true;
    }

    if (
      isReturnStatement(statement) &&
      statement.argument !== null &&
      (() => {
        const returnedExpression = unwrapParenthesizedExpression(
          statement.argument,
        );
        return (
          returnedExpression.type === "ConditionalExpression" ||
          returnedExpression.type === "LogicalExpression"
        );
      })()
    ) {
      return true;
    }
  }

  return false;
}

function hasOpaqueHelperReturn(
  componentArg: ESTNode,
  helperLookup: HelperLookup,
  visitedHelpers: ReadonlySet<string>,
  importedTransparentThunkWrappers: ReadonlySet<string>,
): boolean {
  const finalExpression = resolveFinalHelperExpression(
    componentArg,
    helperLookup,
    visitedHelpers,
    importedTransparentThunkWrappers,
  );
  if (finalExpression === null) {
    return false;
  }

  return isCallExpression(finalExpression);
}

function isSupportedPlanPreludeStatement(node: ESTNode): boolean {
  return (
    node.type === "VariableDeclaration" || node.type === "FunctionDeclaration"
  );
}

function extractFunctionRenderFrame(
  componentArg: ESTNode,
): FunctionRenderFrame | null {
  if (
    !isFunctionLikeNode(componentArg) &&
    !isFunctionDeclaration(componentArg)
  ) {
    return null;
  }

  if (componentArg.async === true || componentArg.generator === true) {
    return null;
  }

  const paramPatterns = (componentArg.params ?? []).map((param) =>
    cloneNode(param),
  );
  const directBody = unwrapParenthesizedExpression(componentArg.body);
  if (
    isJSXElement(directBody) ||
    isJSXFragment(directBody) ||
    isCallExpression(directBody)
  ) {
    return {
      paramPatterns,
      preludeStatements: [],
      returnExpression: directBody,
    };
  }

  if (!isBlockStatement(componentArg.body)) {
    return null;
  }

  const statements = componentArg.body.body;
  const preludeStatements: ESTNode[] = [];
  let returnExpression: ESTNode | null = null;

  for (let index = 0; index < statements.length; index += 1) {
    const statement = statements[index];
    if (isReturnStatement(statement)) {
      if (statement.argument === null) {
        return null;
      }

      if (index !== statements.length - 1) {
        return null;
      }

      returnExpression = unwrapParenthesizedExpression(statement.argument);
      break;
    }

    if (
      !isSupportedPlanPreludeStatement(statement) ||
      containsJSXNode(statement)
    ) {
      return null;
    }

    preludeStatements.push(cloneNode(statement));
  }

  if (returnExpression === null) {
    return null;
  }

  return {
    paramPatterns,
    preludeStatements,
    returnExpression,
  };
}

function getRootNamespace(
  node: JSXElement | JSXFragment,
): "html" | "svg" | "math" {
  if (node.type === "JSXFragment") {
    return "html";
  }

  const tagName = getTagName(node.openingElement.name);
  if (tagName === "svg") {
    return "svg";
  }
  if (tagName === "math") {
    return "math";
  }
  return "html";
}

function createArrowExpression(params: ESTNode[], body: ESTNode): ESTNode {
  return {
    type: "ArrowFunctionExpression",
    params,
    body,
    expression: true,
  };
}

function createConstDeclaration(id: ESTNode, init: ESTNode): ESTNode {
  return {
    type: "VariableDeclaration",
    kind: "const",
    declarations: [
      {
        type: "VariableDeclarator",
        id,
        init,
      },
    ],
  };
}

function getComponentDisplayName(node: ESTNode): string {
  if (isIdentifier(node)) {
    return node.name;
  }

  if (isMemberExpression(node) && isIdentifier(node.property)) {
    return `${getComponentDisplayName(node.object)}.${node.property.name}`;
  }

  /* c8 ignore next @preserve -- defensive guard: callee is always Identifier or MemberExpression */
  return "unknown-component";
}

function getExplicitNestedBoundary(part: DynamicPart): ESTNode | null {
  if (part.type !== "insert" || part.isComponent !== true) {
    return null;
  }

  /* c8 ignore next @preserve -- defensive guard: component insert always produces a CallExpression via buildComponentCall */
  if (!isCallExpression(part.expression)) {
    return null;
  }

  const props = part.expression.arguments[0];
  /* c8 ignore next @preserve -- defensive guard: buildComponentCall always produces ObjectExpression as first arg */
  if (props.type !== "ObjectExpression") {
    return null;
  }

  for (const property of props.properties as ESTNode[]) {
    if (property.type !== "Property") {
      continue;
    }

    const propertyKey = property.key as ESTNode;
    const propertyValue = property.value as ESTNode;
    const matchesKey =
      (isIdentifier(propertyKey) &&
        propertyKey.name === ISLAND_METADATA_ATTRIBUTE) ||
      (isStringLiteral(propertyKey) &&
        propertyKey.value === ISLAND_METADATA_ATTRIBUTE);

    if (!matchesKey || !isStringLiteral(propertyValue)) {
      continue;
    }

    return nObj([
      nProp(nId("path"), nArr(part.path.map((segment) => nLit(segment)))),
      nProp(
        nId("tagName"),
        nLit(getComponentDisplayName(part.expression.callee)),
      ),
      nProp(nId("islandStrategy"), nLit(propertyValue.value)),
    ]);
  }

  return null;
}

function createPlanBinding(
  part: DynamicPart,
  markerId: number | null,
): ESTNode {
  const sharedProperties = [
    nProp(nId("kind"), nLit(part.type)),
    nProp(nId("path"), nArr(part.path.map((segment) => nLit(segment)))),
  ];

  switch (part.type) {
    case "text":
      return nObj([
        nProp(nId("kind"), nLit("text")),
        nProp(nId("markerId"), nLit(markerId ?? 0)),
        nProp(
          nId("expression"),
          createArrowExpression([], cloneNode(part.expression)),
        ),
      ]);
    case "attr":
      return nObj([
        ...sharedProperties,
        nProp(nId("key"), nLit(part.key)),
        nProp(
          nId("expression"),
          createArrowExpression([], cloneNode(part.expression)),
        ),
      ]);
    case "event":
      return nObj([
        ...sharedProperties,
        nProp(nId("eventType"), nLit(part.key)),
        nProp(nId("expression"), cloneNode(part.expression)),
      ]);
    case "insert":
      return nObj([
        ...sharedProperties,
        nProp(nId("markerId"), nLit(markerId ?? 0)),
        nProp(
          nId("expression"),
          createArrowExpression([], cloneNode(part.expression)),
        ),
        nProp(nId("isComponent"), nLit(part.isComponent === true)),
      ]);
    case "spread":
      return nObj([
        ...sharedProperties,
        nProp(
          nId("expression"),
          createArrowExpression([], cloneNode(part.expression)),
        ),
      ]);
  }
}

interface DispatchBranch {
  condition: ESTNode | null;
  jsxRoot: JSXElement | JSXFragment;
  preludeStatements: ESTNode[];
}

interface DispatchPlanAnalysis {
  branches: DispatchBranch[];
  sharedPrelude: ESTNode[];
}

function isStaticJSXNode(node: ESTNode): node is JSXElement | JSXFragment {
  return isJSXElement(node) || isJSXFragment(node);
}

function extractJSXFromExpression(
  expr: ESTNode,
): JSXElement | JSXFragment | null {
  const unwrapped = unwrapParenthesizedExpression(expr);
  if (isStaticJSXNode(unwrapped)) {
    return unwrapped;
  }
  return null;
}

function andConditions(a: ESTNode, b: ESTNode): ESTNode {
  return {
    type: "LogicalExpression",
    operator: "&&",
    left: cloneNode(a),
    right: cloneNode(b),
  } as ESTNode;
}

interface BranchAccumulator {
  condition: ESTNode | null;
  jsxRoot: JSXElement | JSXFragment;
}

function createEmptyJSXFragment(): JSXFragment {
  return {
    type: "JSXFragment",
    children: [],
  };
}

/**
 * Flatten a branching construct (if/else chain, switch, ternary chain)
 * into a linear list of (condition, JSX) pairs.
 *
 * Returns null if any branch contains non-static JSX or unsupported nesting.
 */
function flattenBranches(
  node: ESTNode,
  accumulatedCondition: ESTNode | null,
): BranchAccumulator[] | null {
  // Case 1: Direct JSX
  if (isStaticJSXNode(node)) {
    return [
      {
        condition: accumulatedCondition,
        jsxRoot: node,
      },
    ];
  }

  // Case 2: Return statement
  if (isReturnStatement(node)) {
    if (node.argument === null) {
      return null;
    }
    const unwrapped = unwrapParenthesizedExpression(node.argument);
    // If the return contains ternary/logical, flatten it recursively
    if (
      unwrapped.type === "ConditionalExpression" ||
      unwrapped.type === "LogicalExpression"
    ) {
      return flattenBranches(unwrapped, accumulatedCondition);
    }
    const jsx = extractJSXFromExpression(node.argument);
    if (jsx === null) {
      return null;
    }
    return [
      {
        condition: accumulatedCondition,
        jsxRoot: jsx,
      },
    ];
  }

  // Case 3: BlockStatement — flatten each statement
  if (isBlockStatement(node)) {
    const results: BranchAccumulator[] = [];
    for (const stmt of node.body) {
      const flattened = flattenBranches(stmt, accumulatedCondition);
      if (flattened === null) {
        return null;
      }
      results.push(...flattened);
    }
    return results;
  }

  // Case 4: IfStatement
  if (isIfStatement(node)) {
    if (node.test === null) {
      return null;
    }

    const newCondition =
      accumulatedCondition !== null
        ? andConditions(accumulatedCondition, node.test)
        : cloneNode(node.test);

    // Flatten consequent
    const consequentBranches = flattenBranches(node.consequent, newCondition);
    if (consequentBranches === null) {
      return null;
    }

    // Flatten alternate
    if (node.alternate === null) {
      // No alternate — just return consequent branches
      return consequentBranches;
    }

    const alternateBranches = flattenBranches(
      node.alternate,
      accumulatedCondition,
    );
    if (alternateBranches === null) {
      return null;
    }

    return [...consequentBranches, ...alternateBranches];
  }

  // Case 5: ConditionalExpression (ternary)
  if (node.type === "ConditionalExpression") {
    const condNode = node as ESTNode & {
      test: ESTNode;
      consequent: ESTNode;
      alternate: ESTNode;
    };
    const newCondition =
      accumulatedCondition !== null
        ? andConditions(accumulatedCondition, condNode.test)
        : cloneNode(condNode.test);

    const trueBranches = flattenBranches(
      unwrapParenthesizedExpression(condNode.consequent),
      newCondition,
    );
    if (trueBranches === null) {
      return null;
    }

    const falseBranches = flattenBranches(
      unwrapParenthesizedExpression(condNode.alternate),
      accumulatedCondition,
    );
    if (falseBranches === null) {
      return null;
    }

    return [...trueBranches, ...falseBranches];
  }

  // Case 5.5: LogicalExpression guard pattern
  if (node.type === "LogicalExpression") {
    const logicalNode = node as ESTNode & {
      operator: string;
      left: ESTNode;
      right: ESTNode;
    };

    if (logicalNode.operator !== "&&") {
      return null;
    }

    const guardedJsx = extractJSXFromExpression(logicalNode.right);
    if (guardedJsx === null) {
      return null;
    }

    const truthyCondition =
      accumulatedCondition !== null
        ? andConditions(accumulatedCondition, logicalNode.left)
        : cloneNode(logicalNode.left);

    return [
      {
        condition: truthyCondition,
        jsxRoot: guardedJsx,
      },
      {
        condition: accumulatedCondition,
        jsxRoot: createEmptyJSXFragment(),
      },
    ];
  }

  // Case 6: SwitchStatement
  if (node.type === "SwitchStatement") {
    const switchNode = node as ESTNode & {
      discriminant: ESTNode;
      cases: Array<{
        type: string;
        test: ESTNode | null;
        consequent: ESTNode[];
      }>;
    };
    const discriminant = switchNode.discriminant;
    const cases = switchNode.cases;
    const results: BranchAccumulator[] = [];

    for (const caseNode of cases) {
      if (caseNode.type !== "SwitchCase") {
        return null;
      }

      let caseCondition: ESTNode | null;
      if (caseNode.test === null) {
        // default case
        caseCondition = accumulatedCondition;
      } else {
        const testExpr = {
          type: "BinaryExpression",
          operator: "===",
          left: cloneNode(discriminant),
          right: cloneNode(caseNode.test),
        } as ESTNode;
        caseCondition =
          accumulatedCondition !== null
            ? andConditions(accumulatedCondition, testExpr)
            : testExpr;
      }

      // Flatten all consequents of this case
      for (const stmt of caseNode.consequent) {
        const flattened = flattenBranches(stmt, caseCondition);
        if (flattened === null) {
          return null;
        }
        results.push(...flattened);
      }
    }

    return results;
  }

  // Unsupported node type
  return null;
}

function tryExtractDispatchBranches(
  componentArg: ESTNode,
): DispatchPlanAnalysis | null {
  if (
    !isFunctionLikeNode(componentArg) &&
    !isFunctionDeclaration(componentArg)
  ) {
    return null;
  }

  const directBody = unwrapParenthesizedExpression(componentArg.body);

  // Direct ternary/conditional at body level — handle as dispatch
  if (
    directBody.type === "ConditionalExpression" ||
    directBody.type === "LogicalExpression"
  ) {
    const branches = flattenBranches(directBody, null);
    if (branches === null || branches.length < 2) {
      return null;
    }
    return {
      branches: branches.map((b) => ({
        condition: b.condition,
        jsxRoot: b.jsxRoot,
        preludeStatements: [],
      })),
      sharedPrelude: [],
    };
  }

  if (!isBlockStatement(componentArg.body)) {
    return null;
  }

  const statements = componentArg.body.body;

  // Collect prelude statements
  const preludeStatements: ESTNode[] = [];
  let branchStartIndex = -1;

  for (let i = 0; i < statements.length; i++) {
    const stmt = statements[i];
    if (
      isIfStatement(stmt) ||
      stmt.type === "SwitchStatement" ||
      (isReturnStatement(stmt) && i === statements.length - 1)
    ) {
      branchStartIndex = i;
      break;
    }
    if (isSupportedPlanPreludeStatement(stmt) && !containsJSXNode(stmt)) {
      preludeStatements.push(cloneNode(stmt));
    } else {
      return null;
    }
  }

  if (branchStartIndex < 0) {
    return null;
  }

  const branchStatements = statements.slice(branchStartIndex);

  // Try to flatten all branch statements
  const results: BranchAccumulator[] = [];
  for (const stmt of branchStatements) {
    const flattened = flattenBranches(stmt, null);
    if (flattened === null) {
      return null;
    }
    results.push(...flattened);
  }

  if (results.length < 2) {
    return null;
  }

  return {
    branches: results.map((b) => ({
      condition: b.condition,
      jsxRoot: b.jsxRoot,
      preludeStatements: [],
    })),
    sharedPrelude: preludeStatements,
  };
}

function computeShapeHash(node: JSXElement | JSXFragment): string {
  if (node.type === "JSXFragment") {
    return `fragment:${node.children.length}`;
  }

  const nameNode = node.openingElement.name;
  let tagName: string;
  if (nameNode.type === "JSXIdentifier") {
    tagName = nameNode.name;
  } else if (nameNode.type === "JSXMemberExpression") {
    tagName = `${nameNode.property.name}`;
  } else {
    // JSXNamespacedName
    tagName = `${nameNode.namespace.name}_${nameNode.name.name}`;
  }
  const attrCount = node.openingElement.attributes.length;
  const childCount = node.children.length;
  return `${tagName}:${attrCount}:${childCount}`;
}

function buildDispatchPlanMetadata(
  dispatchAnalysis: DispatchPlanAnalysis,
  nested: NestedTransformers,
  preludeStatements: ESTNode[],
): ESTNode {
  const branchPlans: ESTNode[] = [];

  for (const branch of dispatchAnalysis.branches) {
    const analysisState = createInitialState("csr");
    const { dynamicParts } = jsxToTree(branch.jsxRoot, analysisState, nested);

    const planBindings: ESTNode[] = [];
    const nestedBoundaries: ESTNode[] = [];
    let markerId = 1;

    for (const part of dynamicParts) {
      const currentMarkerId =
        part.type === "text" || part.type === "insert" ? markerId++ : null;
      planBindings.push(createPlanBinding(part, currentMarkerId));

      const nestedBoundary = getExplicitNestedBoundary(part);
      if (nestedBoundary !== null) {
        nestedBoundaries.push(nestedBoundary);
      }
    }

    const planFactoryStatements: ESTNode[] = [
      ...preludeStatements,
      ...branch.preludeStatements,
    ];
    planFactoryStatements.push(
      nReturn(
        nObj([
          nProp(nId("namespace"), nLit(getRootNamespace(branch.jsxRoot))),
          nProp(nId("bindings"), nArr(planBindings)),
          nProp(nId("nestedBoundaries"), nArr(nestedBoundaries)),
        ]),
      ),
    );

    const branchProps = [
      nProp(
        nId("planFactory"),
        nArrowBlock(
          [nId("__dh_host"), nId("__dh_ctx")],
          nBlock(planFactoryStatements),
        ),
      ),
      nProp(nId("shapeHash"), nLit(computeShapeHash(branch.jsxRoot))),
    ];

    if (branch.condition !== null) {
      branchProps.unshift(
        nProp(
          nId("condition"),
          createArrowExpression([], cloneNode(branch.condition)),
        ),
      );
    } else {
      branchProps.unshift(
        nProp(nId("condition"), nArrowBlock([], nBlock([nReturn(nLit(true))]))),
      );
    }

    branchPlans.push(nObj(branchProps));
  }

  return nObj([
    nProp(nId("kind"), nLit("dispatch")),
    nProp(nId("plans"), nArr(branchPlans)),
    nProp(nId("nestedBoundaries"), nArr([])),
  ]);
}

function createUnsupportedHydrationMetadata(reason: string): ESTNode {
  return nObj([
    nProp(nId("kind"), nLit("generic-plan")),
    nProp(nId("unsupportedReason"), nLit(reason)),
  ]);
}

function getSpecificUnsupportedHydrationReason(
  componentArg: ESTNode,
  helperLookup: HelperLookup,
  visitedHelpers: ReadonlySet<string>,
  importedTransparentThunkWrappers: ReadonlySet<string>,
  availableBindings: ReadonlyMap<string, ESTNode>,
): string | null {
  if (
    !isFunctionLikeNode(componentArg) &&
    !isFunctionDeclaration(componentArg)
  ) {
    return null;
  }

  const bodyToInspect = componentArg.body;
  const parameterBindings = collectFunctionParameterBindings(componentArg);
  const rootScope = isBlockStatement(bodyToInspect)
    ? collectScopedBindingsFromStatements(bodyToInspect.body as ESTNode[])
    : new Map<string, ScopedBinding>();

  for (const param of (componentArg.params ?? []) as ESTNode[]) {
    if (isIdentifier(param)) {
      rootScope.set(param.name, { init: null, kind: "param" });
      continue;
    }

    for (const name of collectBindingNames(param)) {
      rootScope.set(name, { init: null, kind: "param" });
    }
  }

  const scopes = [rootScope];

  if (containsNodeIdentityCreationWithBindings(bodyToInspect, scopes)) {
    return "node-identity-reuse";
  }

  if (hasNonNormalizableSpread(componentArg, availableBindings)) {
    return "non-normalizable-spread";
  }

  if (containsImperativeDomQuery(bodyToInspect, parameterBindings, scopes)) {
    return "imperative-dom-query";
  }

  if (hasRuntimeBranching(componentArg)) {
    // Check if this is a supported dispatch pattern
    const dispatchAnalysis = tryExtractDispatchBranches(componentArg);
    if (dispatchAnalysis === null) {
      return "runtime-branching";
    }
    // Supported dispatch pattern — don't mark as unsupported
  }

  if (
    hasOpaqueHelperReturn(
      componentArg,
      helperLookup,
      visitedHelpers,
      importedTransparentThunkWrappers,
    )
  ) {
    return "opaque-helper-call";
  }

  return null;
}

function getUnsupportedHydrationReason(
  componentArg: ESTNode,
  helperLookup: HelperLookup,
  visitedHelpers: ReadonlySet<string>,
  importedTransparentThunkWrappers: ReadonlySet<string>,
  availableBindings: ReadonlyMap<string, ESTNode>,
): string | null {
  const specificReason = getSpecificUnsupportedHydrationReason(
    componentArg,
    helperLookup,
    visitedHelpers,
    importedTransparentThunkWrappers,
    availableBindings,
  );
  /* c8 ignore next @preserve -- structurally unreachable: buildComponentHydrationMetadata checks getSpecific first with same args */
  if (specificReason !== null) {
    return specificReason;
  }

  if (
    !isFunctionLikeNode(componentArg) &&
    !isFunctionDeclaration(componentArg)
  ) {
    return null;
  }

  return "unsupported-component-body";
}

function resolveHelperChain(
  componentArg: ESTNode,
  helperLookup: HelperLookup,
  visitedHelpers: ReadonlySet<string>,
  importedTransparentThunkWrappers: ReadonlySet<string>,
): HelperChainResolution | null {
  const rootFrame = extractFunctionRenderFrame(componentArg);
  if (rootFrame === null || rootFrame.returnExpression === null) {
    return null;
  }

  const helperFrames: HelperChainResolution["helperFrames"] = [];
  let currentExpression: ESTNode | null = rootFrame.returnExpression;
  let localVisited = new Set(visitedHelpers);

  while (currentExpression !== null && isCallExpression(currentExpression)) {
    const helperResolution = resolveTopLevelHelperNode(
      currentExpression,
      helperLookup,
      localVisited,
      importedTransparentThunkWrappers,
    );
    if (helperResolution === null) {
      break;
    }

    helperFrames.push({
      helperName: helperResolution.helperName,
      helperFrame: helperResolution.helperFrame,
      callArguments: helperResolution.callArguments,
    });
    localVisited = new Set([...localVisited, helperResolution.helperName]);
    currentExpression = helperResolution.helperFrame.returnExpression;
  }

  return {
    rootFrame,
    helperFrames,
  };
}

function resolveFinalHelperExpression(
  componentArg: ESTNode,
  helperLookup: HelperLookup,
  visitedHelpers: ReadonlySet<string>,
  importedTransparentThunkWrappers: ReadonlySet<string>,
): ESTNode | null {
  const resolvedChain = resolveHelperChain(
    componentArg,
    helperLookup,
    visitedHelpers,
    importedTransparentThunkWrappers,
  );
  if (resolvedChain === null) {
    return null;
  }

  return (
    resolvedChain.helperFrames.at(-1)?.helperFrame.returnExpression ??
    resolvedChain.rootFrame.returnExpression
  );
}

function resolveComponentRenderAnalysis(
  componentArg: ESTNode,
  helperLookup: HelperLookup,
  importedTransparentThunkWrappers: ReadonlySet<string>,
  visitedHelpers: ReadonlySet<string> = new Set(),
): ResolvedRenderAnalysis | null {
  const resolvedChain = resolveHelperChain(
    componentArg,
    helperLookup,
    visitedHelpers,
    importedTransparentThunkWrappers,
  );
  if (resolvedChain === null) {
    return null;
  }

  const { rootFrame, helperFrames } = resolvedChain;
  const finalFrame = helperFrames.at(-1)?.helperFrame ?? rootFrame;

  /* c8 ignore next @preserve -- defensive guard: resolved helper frames always expose a non-null returnExpression */
  if (finalFrame.returnExpression === null) {
    return null;
  }

  if (
    !isJSXElement(finalFrame.returnExpression) &&
    !isJSXFragment(finalFrame.returnExpression)
  ) {
    return null;
  }

  const preludeStatements = [...rootFrame.preludeStatements];
  for (const helper of helperFrames) {
    const helperParamBindings = helper.helperFrame.paramPatterns.map(
      (paramPattern, index) =>
        createConstDeclaration(
          paramPattern,
          cloneNode(helper.callArguments[index] ?? nLit(null)),
        ),
    );

    preludeStatements.push(
      ...helperParamBindings,
      ...helper.helperFrame.preludeStatements,
    );
  }

  return {
    analysis: {
      jsxRoot: finalFrame.returnExpression,
      paramPattern: rootFrame.paramPatterns[0] ?? null,
      preludeStatements,
    },
    usedHelper: helperFrames.length > 0,
  };
}

function collectTopLevelHelpers(program: Program): HelperLookup {
  const helpers = new Map<string, ESTNode>();

  for (const statement of program.body) {
    const declaration =
      isExportNamedDeclaration(statement) &&
      statement.declaration !== null &&
      statement.declaration !== undefined
        ? statement.declaration
        : statement;

    if (
      isFunctionDeclaration(declaration) &&
      declaration.id !== null &&
      declaration.id !== undefined &&
      isIdentifier(declaration.id)
    ) {
      helpers.set(declaration.id.name, declaration);
      continue;
    }

    if (!isVariableDeclaration(declaration)) {
      continue;
    }

    for (const declarator of declaration.declarations) {
      if (
        isIdentifier(declarator.id) &&
        declarator.init !== null &&
        (isFunctionLikeNode(declarator.init) ||
          isFunctionDeclaration(declarator.init) ||
          isObjectExpression(declarator.init))
      ) {
        helpers.set(declarator.id.name, declarator.init);
      }
    }
  }

  return helpers;
}

function collectTopLevelBindings(program: Program): Set<string> {
  const bindings = new Set<string>();

  for (const statement of program.body) {
    if (isImportDeclaration(statement)) {
      for (const specifier of statement.specifiers ?? []) {
        const local = specifier.local;
        if (isESTNode(local) && isIdentifier(local)) {
          bindings.add(local.name);
        }
      }
      continue;
    }

    const declaration =
      isExportNamedDeclaration(statement) &&
      statement.declaration !== null &&
      statement.declaration !== undefined
        ? statement.declaration
        : statement;

    if (
      isFunctionDeclaration(declaration) &&
      declaration.id !== null &&
      declaration.id !== undefined &&
      isIdentifier(declaration.id)
    ) {
      bindings.add(declaration.id.name);
      continue;
    }

    if (!isVariableDeclaration(declaration)) {
      continue;
    }

    for (const declarator of declaration.declarations) {
      collectBindingNames(declarator.id, bindings);
    }
  }

  return bindings;
}

function isSerializableBindingExpression(
  node: ESTNode | null | undefined,
  availableBindings: ReadonlyMap<string, ESTNode>,
): boolean {
  if (node === null || node === undefined) {
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
    return availableBindings.has(node.name);
  }

  if (node.type === "TemplateLiteral") {
    return (node.expressions as ESTNode[]).every((expression) =>
      isSerializableBindingExpression(expression, availableBindings),
    );
  }

  if (node.type === "ArrayExpression") {
    return (node.elements as Array<ESTNode | null>).every(
      (element) =>
        element === null ||
        isSerializableBindingExpression(element, availableBindings),
    );
  }

  if (node.type === "ObjectExpression") {
    return (node.properties as ESTNode[]).every((property) => {
      if (property.type === "SpreadElement") {
        return false;
      }

      return (
        (!isComputedProperty(property.computed) ||
          isSerializableBindingExpression(
            property.key as ESTNode,
            availableBindings,
          )) &&
        isSerializableBindingExpression(
          property.value as ESTNode,
          availableBindings,
        )
      );
    });
  }

  return false;
}

function collectSerializableBindingsFromStatements(
  statements: readonly ESTNode[],
  inherited: ReadonlyMap<string, ESTNode>,
): Map<string, ESTNode> {
  const bindings = new Map(inherited);

  for (const statement of statements) {
    const declaration =
      isVariableDeclaration(statement) && statement.kind === "const"
        ? statement
        : isExportNamedDeclaration(statement) &&
            statement.declaration !== null &&
            statement.declaration !== undefined &&
            isVariableDeclaration(statement.declaration) &&
            statement.declaration.kind === "const"
          ? statement.declaration
          : null;
    if (declaration === null) {
      continue;
    }

    for (const declarator of declaration.declarations) {
      if (!isIdentifier(declarator.id) || declarator.init == null) {
        continue;
      }

      if (isSerializableBindingExpression(declarator.init, bindings)) {
        bindings.set(declarator.id.name, declarator.init);
      }
    }
  }

  return bindings;
}

function collectTopLevelSerializableBindings(
  program: Program,
): Map<string, ESTNode> {
  return collectSerializableBindingsFromStatements(program.body, new Map());
}

/**
 * Guard: throw if the component body contains colocated client
 * directives while its setup pattern is unsupported for hydration
 * plan generation.  This combination would silently fall back to a
 * full rerender (Path B), destroying SSR state and making the
 * colocated handler capture stale values.
 */
function assertNoUnsupportedColocatedCombination(
  componentArg: ESTNode,
  unsupportedReason: string,
): void {
  if (containsColocatedDirective(componentArg)) {
    throw new Error(
      `[dathra] Colocated client directives (e.g. load:onClick) cannot be used in a component whose setup is unsupported for hydration plan generation (reason: ${unsupportedReason}). The component would fall back to a full rerender, losing SSR state captured by the handler. Simplify the setup function or remove the colocated directive.`,
    );
  }
}

function buildComponentHydrationMetadata(
  componentArg: ESTNode,
  nested: NestedTransformers,
  helperLookup: HelperLookup,
  importedTransparentThunkWrappers: ReadonlySet<string>,
  moduleBindings: ReadonlySet<string>,
  topLevelSerializableBindings: ReadonlyMap<string, ESTNode>,
): ComponentHydrationBuildResult | null {
  const specificUnsupportedReason = getSpecificUnsupportedHydrationReason(
    componentArg,
    helperLookup,
    new Set(),
    importedTransparentThunkWrappers,
    topLevelSerializableBindings,
  );
  if (specificUnsupportedReason !== null) {
    assertNoUnsupportedColocatedCombination(
      componentArg,
      specificUnsupportedReason,
    );
    return {
      metadata: createUnsupportedHydrationMetadata(specificUnsupportedReason),
    };
  }

  // Check for supported dispatch pattern (guard-return or if/else)
  const dispatchAnalysis = tryExtractDispatchBranches(componentArg);
  if (dispatchAnalysis !== null) {
    // Extract shared prelude from component setup
    const frame = extractFunctionRenderFrame(componentArg);
    const sharedPrelude = frame !== null ? frame.preludeStatements : [];
    return {
      metadata: buildDispatchPlanMetadata(
        dispatchAnalysis,
        nested,
        sharedPrelude,
      ),
    };
  }

  const resolvedAnalysis = resolveComponentRenderAnalysis(
    componentArg,
    helperLookup,
    importedTransparentThunkWrappers,
  );
  if (resolvedAnalysis === null) {
    const unsupportedReason = getUnsupportedHydrationReason(
      componentArg,
      helperLookup,
      new Set(),
      importedTransparentThunkWrappers,
      topLevelSerializableBindings,
    );
    if (unsupportedReason === null) {
      return null;
    }

    assertNoUnsupportedColocatedCombination(componentArg, unsupportedReason);
    return {
      metadata: createUnsupportedHydrationMetadata(unsupportedReason),
    };
  }

  const analysis = resolvedAnalysis.analysis;
  const setupParamPattern =
    isFunctionLikeNode(componentArg) || isFunctionDeclaration(componentArg)
      ? (componentArg.params?.[0] ?? null)
      : null;

  const collisionSafeAnalysis = buildCollisionSafePlanAnalysis(
    setupParamPattern,
    analysis.preludeStatements,
    analysis.jsxRoot,
  );

  const analysisState = createInitialState("csr");
  analysisState.moduleBindings = new Set(moduleBindings);
  analysisState.currentSerializableBindings =
    collectSerializableBindingsFromStatements(
      collisionSafeAnalysis.preludeStatements,
      topLevelSerializableBindings,
    );
  const { dynamicParts } = jsxToTree(
    collisionSafeAnalysis.jsxRoot,
    analysisState,
    nested,
  );

  const planBindings: ESTNode[] = [];
  const nestedBoundaries: ESTNode[] = [];
  let markerId = 1;

  for (const part of dynamicParts) {
    const currentMarkerId =
      part.type === "text" || part.type === "insert" ? markerId++ : null;
    planBindings.push(createPlanBinding(part, currentMarkerId));

    const nestedBoundary = getExplicitNestedBoundary(part);
    if (nestedBoundary !== null) {
      nestedBoundaries.push(nestedBoundary);
    }
  }

  const planFactoryStatements: ESTNode[] = [
    ...collisionSafeAnalysis.preludeStatements,
  ];
  planFactoryStatements.push(
    nReturn(
      nObj([
        nProp(
          nId("namespace"),
          nLit(getRootNamespace(collisionSafeAnalysis.jsxRoot)),
        ),
        nProp(nId("bindings"), nArr(planBindings)),
        nProp(nId("nestedBoundaries"), nArr(nestedBoundaries)),
      ]),
    ),
  );

  return {
    metadata: nObj([
      nProp(nId("kind"), nLit("generic-plan")),
      nProp(
        nId("planFactory"),
        nArrowBlock(
          [nId("__dh_host"), nId("__dh_ctx")],
          nBlock(planFactoryStatements),
        ),
      ),
    ]),
  };
}

function collectComponentPlans(
  program: Program,
  nested: NestedTransformers,
  moduleBindings: ReadonlySet<string>,
): CollectedComponentPlan[] {
  const plans: CollectedComponentPlan[] = [];
  const helperLookup = collectTopLevelHelpers(program);
  const topLevelSerializableBindings =
    collectTopLevelSerializableBindings(program);
  const importedTransparentThunkWrappers =
    collectImportedTransparentThunkWrappers(program);

  for (let bodyIndex = 0; bodyIndex < program.body.length; bodyIndex += 1) {
    const statement = program.body[bodyIndex];
    const declaration = isVariableDeclaration(statement)
      ? statement
      : isExportNamedDeclaration(statement) &&
          statement.declaration !== null &&
          statement.declaration !== undefined &&
          isVariableDeclaration(statement.declaration)
        ? statement.declaration
        : null;

    if (declaration === null) {
      continue;
    }

    for (
      let declarationIndex = 0;
      declarationIndex < declaration.declarations.length;
      declarationIndex += 1
    ) {
      const declarator = declaration.declarations[declarationIndex];
      const init = declarator.init;
      if (!isDefineComponentCall(init)) {
        continue;
      }

      const componentArg = init.arguments[1];
      const buildResult = buildComponentHydrationMetadata(
        componentArg,
        nested,
        helperLookup,
        importedTransparentThunkWrappers,
        moduleBindings,
        topLevelSerializableBindings,
      );
      if (buildResult === null) {
        continue;
      }

      plans.push({
        bodyIndex,
        declarationIndex,
        metadata: buildResult.metadata,
      });
    }
  }

  return plans;
}

function applyComponentPlans(
  program: Program,
  plans: readonly CollectedComponentPlan[],
): void {
  for (const plan of plans) {
    const statement = program.body[plan.bodyIndex];
    const declaration = isVariableDeclaration(statement)
      ? statement
      : isExportNamedDeclaration(statement) &&
          statement.declaration !== null &&
          statement.declaration !== undefined &&
          isVariableDeclaration(statement.declaration)
        ? statement.declaration
        : null;

    const declarator = declaration?.declarations[plan.declarationIndex];
    const init = declarator?.init;
    /* c8 ignore next @preserve -- defensive guard: plans are collected only from defineComponent initializers */
    if (!isDefineComponentCall(init)) {
      continue;
    }

    const componentArg = init.arguments[1];

    init.arguments[1] = nCall(nMember(nId("Object"), nId("assign")), [
      componentArg,
      nObj([nProp(nId("__hydrationMetadata__"), cloneNode(plan.metadata))]),
    ]);
  }
}

/**
 * Transform source code containing JSX.
 */
function transform(
  code: string,
  options: TransformOptions = {},
): TransformResult {
  const {
    mode = "csr",
    sourceMap = false,
    filename = "unknown.tsx",
    runtimeModule = "@dathra/runtime",
  } = options;

  const parsed = parseSync(filename, code, { sourceType: "module" });
  const state = createInitialState(mode);
  state.moduleBindings = collectTopLevelBindings(
    adaptParsedProgram(parsed.program) as Program,
  );

  const nested = {
    transformJSXNode,
    transformJSXForSSRNode,
  };

  const componentPlans = collectComponentPlans(
    adaptParsedProgram(parsed.program) as Program,
    nested,
    state.moduleBindings,
  );

  const topLevelSerializableBindings = collectTopLevelSerializableBindings(
    adaptParsedProgram(parsed.program) as Program,
  );

  const transformedProgram = walk(
    adaptParsedProgram(parsed.program),
    { inJSX: false, serializableBindings: topLevelSerializableBindings },
    {
      ArrowFunctionExpression(
        node: ESTNode,
        {
          state: walkState,
          next,
        }: {
          state: WalkTransformState;
          next: (s?: WalkTransformState) => void;
        },
      ) {
        const body = (node as FunctionLikeNode).body;
        const serializableBindings = isBlockStatement(body)
          ? collectSerializableBindingsFromStatements(
              body.body,
              walkState.serializableBindings,
            )
          : new Map(walkState.serializableBindings);
        next({ inJSX: false, serializableBindings });
      },
      FunctionExpression(
        node: ESTNode,
        {
          state: walkState,
          next,
        }: {
          state: WalkTransformState;
          next: (s?: WalkTransformState) => void;
        },
      ) {
        const body = (node as FunctionLikeNode).body;
        const serializableBindings = isBlockStatement(body)
          ? collectSerializableBindingsFromStatements(
              body.body,
              walkState.serializableBindings,
            )
          : new Map(walkState.serializableBindings);
        next({ inJSX: false, serializableBindings });
      },
      FunctionDeclaration(
        node: ESTNode,
        {
          state: walkState,
          next,
        }: {
          state: WalkTransformState;
          next: (s?: WalkTransformState) => void;
        },
      ) {
        const body = (node as unknown as { body: ESTNode }).body;
        const serializableBindings = isBlockStatement(body)
          ? collectSerializableBindingsFromStatements(
              body.body,
              walkState.serializableBindings,
            )
          : new Map(walkState.serializableBindings);
        next({ inJSX: false, serializableBindings });
      },
      JSXElement(
        node: ESTNode,
        {
          state: walkState,
          next,
        }: {
          state: WalkTransformState;
          next: (s?: WalkTransformState) => void;
        },
      ) {
        /* c8 ignore next @preserve -- structurally unreachable: replacing a JSXElement prevents visiting nested original JSX nodes */
        if (walkState.inJSX) {
          next({
            inJSX: true,
            serializableBindings: walkState.serializableBindings,
          });
          return;
        }

        /* c8 ignore next @preserve -- defensive guard: typed JSXElement visitor only receives JSXElement nodes */
        if (!isJSXElement(node)) return;

        const previousSerializableBindings = state.currentSerializableBindings;
        state.currentSerializableBindings = walkState.serializableBindings;
        try {
          if (isComponentTag(node.openingElement.name)) {
            return buildComponentCall(node, state, nested);
          }

          if (mode === "ssr") {
            return transformJSXForSSRNode(node, state, nested);
          }

          return transformJSXNode(node, state, nested);
        } finally {
          state.currentSerializableBindings = previousSerializableBindings;
        }
      },
      JSXFragment(
        node: ESTNode,
        {
          state: walkState,
          next,
        }: {
          state: WalkTransformState;
          next: (s?: WalkTransformState) => void;
        },
      ) {
        /* c8 ignore next @preserve -- structurally unreachable: replacing a JSXFragment prevents visiting nested original JSX nodes */
        if (walkState.inJSX) {
          next({
            inJSX: true,
            serializableBindings: walkState.serializableBindings,
          });
          return;
        }

        /* c8 ignore next @preserve -- defensive guard: typed JSXFragment visitor only receives JSXFragment nodes */
        if (!isJSXFragment(node)) return;

        const previousSerializableBindings = state.currentSerializableBindings;
        state.currentSerializableBindings = walkState.serializableBindings;
        try {
          if (mode === "ssr") {
            return transformJSXForSSRNode(node, state, nested);
          }

          return transformJSXNode(node, state, nested);
        } finally {
          state.currentSerializableBindings = previousSerializableBindings;
        }
      },
    },
  ) as Program;

  applyComponentPlans(transformedProgram, componentPlans);

  if (state.componentClientActions.length > 0) {
    let insertIndex = 0;
    for (let i = 0; i < transformedProgram.body.length; i++) {
      const statement = transformedProgram.body[i];
      if (statement.type === "ImportDeclaration") {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

    const registrations = state.componentClientActions.map((action) =>
      nExprStmt(
        nCall(nId("registerClientAction"), [
          nLit(action.id),
          cloneNode(action.factory),
        ]),
      ),
    );
    transformedProgram.body.splice(insertIndex, 0, ...registrations);
  }

  if (state.templates.length > 0) {
    let insertIndex = 0;
    for (let i = 0; i < transformedProgram.body.length; i++) {
      const statement = transformedProgram.body[i];
      if (statement.type === "ImportDeclaration") {
        insertIndex = i + 1;
      } else {
        break;
      }
    }

    transformedProgram.body.splice(insertIndex, 0, ...state.templates);
  }

  addRuntimeImports(transformedProgram, state.runtimeImports, runtimeModule);

  const printableProgram = toPrintableProgram(transformedProgram);

  const printed = print(
    printableProgram as never,
    ts(),
    sourceMap
      ? { sourceMapSource: filename, sourceMapContent: code }
      : undefined,
  ) as unknown as {
    code: string;
    map?: unknown;
  };

  return {
    code: printed.code,
    map:
      sourceMap === true && printed.map !== undefined
        ? JSON.stringify(printed.map)
        : undefined,
  };
}

export { transform };
export type { TransformOptions, TransformResult };
