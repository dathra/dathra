import path from "node:path";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const require = createRequire(path.join(repo, "package.json"));
const ts = require("typescript");
const json = ts.readConfigFile(path.join(here, "tsconfig.json"), ts.sys.readFile);
const options = ts.parseJsonConfigFileContent(json.config, ts.sys, here).options;
/** Collect explicit calls using a bounded TS symbol/inventory rule, never function extraction. */
function collect(entry) {
  // Literal metadata is not an import edge. Discover these explicit files before default-symbol lookup.
  const roots = new Set([entry]);
  let program;
  for (;;) {
    program = ts.createProgram([...roots], {
      ...options,
      noEmit: true,
      emitDeclarationOnly: false,
    });
    const checker = program.getTypeChecker();
    let added = false;
    for (const source of program.getSourceFiles()) {
      if (!source.fileName.startsWith(path.join(here, "graph"))) continue;
      function discover(node) {
        if (ts.isCallExpression(node)) {
          let symbol = checker.getSymbolAtLocation(node.expression);
          if (symbol?.flags & ts.SymbolFlags.Alias) symbol = checker.getAliasedSymbol(symbol);
          if (
            symbol?.name === "clientModule" &&
            symbol.declarations?.some(
              (d) => d.getSourceFile().fileName === path.join(here, "runtime/server.d.ts"),
            )
          ) {
            const arg = node.arguments[0];
            if (arg && ts.isStringLiteral(arg)) {
              const file = ts.resolveModuleName(arg.text, source.fileName, options, ts.sys)
                .resolvedModule?.resolvedFileName;
              if (file && !roots.has(file)) {
                roots.add(file);
                added = true;
              }
            }
          }
        }
        ts.forEachChild(node, discover);
      }
      discover(source);
    }
    if (!added) break;
  }
  const checker = program.getTypeChecker();
  const errors = [];
  const refs = [];
  const files = new Map();
  const visited = new Set();
  const resolve = (spec, parent) =>
    ts.resolveModuleName(spec, parent, options, ts.sys).resolvedModule?.resolvedFileName;
  function unwrap(symbol) {
    return symbol && symbol.flags & ts.SymbolFlags.Alias
      ? checker.getAliasedSymbol(symbol)
      : symbol;
  }
  function isAPI(symbol, name) {
    symbol = unwrap(symbol);
    return (
      symbol?.name === name &&
      symbol.declarations?.some(
        (d) => d.getSourceFile().fileName === path.join(here, "runtime/server.d.ts"),
      )
    );
  }
  function indirectAPI(expression) {
    const s = checker.getSymbolAtLocation(expression);
    return s?.declarations?.some(
      (d) =>
        ts.isVariableDeclaration(d) &&
        d.initializer &&
        isAPI(checker.getSymbolAtLocation(d.initializer), "clientModule"),
    );
  }
  function diagnostic(code, source, node, detail) {
    const loc = source.getLineAndCharacterOfPosition(node.getStart());
    errors.push({ code, file: path.relative(here, source.fileName), line: loc.line + 1, detail });
  }
  function catalog(clientFile, source, node) {
    const client = program.getSourceFile(clientFile);
    if (!client) {
      diagnostic("E_MODULE_MISSING", source, node, `Cannot load ${clientFile}`);
      return;
    }
    const module = checker.getSymbolAtLocation(client);
    const defaultSymbol =
      module && checker.getExportsOfModule(module).find((s) => s.name === "default");
    if (!defaultSymbol) {
      diagnostic(
        "E_DEFAULT_MISSING",
        source,
        node,
        "Export default defineClient({...}) from the client module.",
      );
      return;
    }
    const type = checker.getTypeOfSymbolAtLocation(defaultSymbol, client);
    const functions = type.getProperty("functions");
    if (!functions) {
      diagnostic(
        "E_DEFAULT_PROFILE",
        source,
        node,
        "Default export must be a flat defineClient registry.",
      );
      return;
    }
    const record = checker.getTypeOfSymbolAtLocation(functions, client);
    if (record.getStringIndexType()) {
      diagnostic(
        "E_DYNAMIC_REGISTRY",
        source,
        node,
        "Use finite explicit function names; an unbounded index signature requires an inventory contract.",
      );
      return;
    }
    const names = record.getProperties().map((s) => s.name);
    if (
      !names.length ||
      names.some(
        (name) =>
          !checker.getTypeOfSymbolAtLocation(record.getProperty(name), client).getCallSignatures()
            .length,
      )
    ) {
      diagnostic(
        "E_DEFAULT_PROFILE",
        source,
        node,
        "Client registry must contain finite callable exports.",
      );
      return;
    }
    let parserSymbol;
    // Explicit default/profile object forms only; compare shared parser symbols, never function bodies.
    for (const stmt of client.statements) {
      if (ts.isExportAssignment(stmt) && ts.isCallExpression(stmt.expression)) {
        const opts = stmt.expression.arguments[1];
        const creation =
          opts &&
          ts.isObjectLiteralExpression(opts) &&
          opts.properties.find(
            (p) => ts.isPropertyAssignment(p) && p.name.getText(client) === "create",
          );
        const profile = creation?.initializer;
        const input =
          profile &&
          ts.isObjectLiteralExpression(profile) &&
          profile.properties.find(
            (p) => ts.isPropertyAssignment(p) && p.name.getText(client) === "input",
          );
        if (input) parserSymbol = unwrap(checker.getSymbolAtLocation(input.initializer));
      }
    }
    return {
      names,
      hasCreation: Boolean(type.getProperty("create")),
      defaultSymbol: unwrap(defaultSymbol),
      parserSymbol,
    };
  }
  function visitFile(file) {
    if (visited.has(file) || file.endsWith(".d.ts")) return;
    visited.add(file);
    const source = program.getSourceFile(file);
    if (!source) return;
    const edits = [];
    function walk(node) {
      if (ts.isCallExpression(node)) {
        const symbol = checker.getSymbolAtLocation(node.expression);
        if (indirectAPI(node.expression)) {
          diagnostic(
            "E_CLIENT_LINK_INDIRECTION",
            source,
            node,
            "Use import {clientModule as link} or namespace.clientModule directly; local variable aliases are not in this adapter inventory.",
          );
        } else if (isAPI(symbol, "clientModule")) {
          const [specifier, base] = node.arguments;
          if (
            !specifier ||
            !ts.isStringLiteral(specifier) ||
            !base ||
            base.getText(source) !== "import.meta.url"
          ) {
            diagnostic(
              "E_CLIENT_LINK_LITERAL",
              source,
              node,
              "Use a literal relative specifier and import.meta.url at the declaration site.",
            );
          } else {
            const resolved = resolve(specifier.text, file);
            if (!resolved)
              diagnostic(
                "E_MODULE_MISSING",
                source,
                node,
                `Cannot resolve ${specifier.text}; use a real client module relative to ${file}.`,
              );
            else {
              const info = catalog(resolved, source, node);
              const witness = node.typeArguments?.[0];
              if (witness && !ts.isTypeQueryNode(witness)) {
                diagnostic(
                  "E_TYPE_WITNESS_FORM",
                  source,
                  node,
                  "Use typeof a type-only imported default; arbitrary structural aliases cannot prove source identity.",
                );
              } else if (info) {
                if (witness) {
                  const witnessSymbol = unwrap(checker.getSymbolAtLocation(witness.exprName));
                  if (witnessSymbol !== info.defaultSymbol) {
                    diagnostic(
                      "E_TYPE_RUNTIME_SOURCE_MISMATCH",
                      source,
                      node,
                      `Type witness and runtime specifier resolve to different default symbols. Align the imported type and ${specifier.text}. This is an explicit TS-source inventory rule, not erased-generic validation.`,
                    );
                  }
                }
                let parent = node.parent;
                while (parent && !ts.isCallExpression(parent)) parent = parent.parent;
                if (
                  info.hasCreation &&
                  parent &&
                  isAPI(checker.getSymbolAtLocation(parent.expression), "defineComponent")
                ) {
                  const spec = parent.arguments[0];
                  const input =
                    spec &&
                    ts.isObjectLiteralExpression(spec) &&
                    spec.properties.find(
                      (p) => ts.isPropertyAssignment(p) && p.name.getText(source) === "input",
                    );
                  const serverParser =
                    input && unwrap(checker.getSymbolAtLocation(input.initializer));
                  if (!info.parserSymbol || !serverParser || serverParser !== info.parserSymbol) {
                    diagnostic(
                      "E_CREATE_INPUT_SOURCE_MISMATCH",
                      source,
                      node,
                      "For SSR/created pairing, use the same explicit neutral input parser symbol in defineComponent.input and default create.input; indirect profile declarations require an explicit inventory rule.",
                    );
                  }
                }
                const key = new URL(specifier.text, pathToFileURL(file)).href;
                refs.push({
                  key,
                  clientFile: resolved,
                  specifier: specifier.text,
                  declaringFile: file,
                  names: info.names,
                  hasCreation: info.hasCreation,
                  typedWitness: Boolean(witness),
                  form: ts.isPropertyAccessExpression(node.expression)
                    ? "namespace"
                    : node.expression.getText(source),
                });
                edits.push({
                  start: base.getStart(source),
                  end: base.getEnd(),
                  replacement: JSON.stringify(pathToFileURL(file).href),
                });
              }
            }
          }
        }
      }
      ts.forEachChild(node, walk);
    }
    walk(source);
    if (edits.length) {
      let code = source.text;
      for (const e of edits.sort((a, b) => b.start - a.start))
        code = code.slice(0, e.start) + e.replacement + code.slice(e.end);
      files.set(file, code);
    }
    for (const node of source.statements) {
      if (
        ts.isImportDeclaration(node) &&
        !node.importClause?.isTypeOnly &&
        ts.isStringLiteral(node.moduleSpecifier)
      ) {
        const imported = resolve(node.moduleSpecifier.text, file);
        if (imported && !imported.includes("/node_modules/")) visitFile(imported);
      }
    }
  }
  visitFile(entry);
  return { program, refs, files, errors, visited: [...visited] };
}
export { collect, ts, here, repo, options };
