import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import assert from "node:assert/strict";
const here = path.dirname(fileURLToPath(import.meta.url));
const repo = path.resolve(here, "../../..");
const require = createRequire(path.join(repo, "package.json"));
const ts = require("typescript");
const logs = path.join(here, "logs");
const json = ts.readConfigFile(path.join(here, "tsconfig.json"), ts.sys.readFile);
const cfg = ts.parseJsonConfigFileContent(json.config, ts.sys, here);
assert.equal(cfg.errors.length, 0);
function compile(files, options = cfg.options) {
  const p = ts.createProgram(files, options);
  const ds = ts.getPreEmitDiagnostics(p);
  const formatted = ts.formatDiagnosticsWithColorAndContext(ds, {
    getCanonicalFileName: (p) => p,
    getCurrentDirectory: () => repo,
    getNewLine: () => "\n",
  });
  return { p, ds, formatted };
}
const good = compile(cfg.fileNames);
fs.writeFileSync(path.join(logs, "p01-strict.txt"), good.formatted);
assert.equal(good.ds.length, 0, good.formatted);
const emit = good.p.emit();
assert.equal(emit.emitSkipped, false);
const negativeSources = [
  "state-mismatch.server.ts",
  "unannotated.client.ts",
  "kind.option.ts",
  "received-mismatch.ts",
  "received-other-function.ts",
];
const negatives = [];
for (const name of negativeSources) {
  const r = compile([...cfg.fileNames, path.join(here, "negative", name)], {
    ...cfg.options,
    noEmit: true,
    emitDeclarationOnly: false,
  });
  fs.writeFileSync(path.join(logs, "p01-negative-" + name + ".txt"), r.formatted);
  assert(
    r.ds.some((d) => d.file?.fileName === path.join(here, "negative", name)),
    name + " unexpectedly accepted",
  );
  negatives.push({ name, codes: r.ds.map((d) => d.code), rejected: true });
}
const loose = compile([...cfg.fileNames, path.join(here, "negative/role-leak.ts")], {
  ...cfg.options,
  noEmit: true,
  emitDeclarationOnly: false,
});
fs.writeFileSync(path.join(logs, "p01-context-names.txt"), loose.formatted);
assert.equal(loose.ds.length, 0, loose.formatted);
const checker = good.p.getTypeChecker();
const native = good.p.getSourceFile(path.join(here, "fixtures/actual-types.ts"));
let symbol;
ts.forEachChild(native, (n) => {
  if (
    ts.isImportDeclaration(n) &&
    n.importClause?.namedBindings &&
    ts.isNamedImports(n.importClause.namedBindings)
  ) {
    for (const e of n.importClause.namedBindings.elements)
      if (e.name.text === "Signal")
        symbol = checker.getAliasedSymbol(checker.getSymbolAtLocation(e.name));
  }
});
assert(symbol);
const origins = symbol.declarations.map((d) => path.relative(repo, d.getSourceFile().fileName));
assert(
  origins.includes("packages/reactivity/src/types/index.ts"),
  "Not the actual repository Signal type",
);
const suppressed = cfg.fileNames
  .filter((f) => f.endsWith(".ts") || f.endsWith(".js"))
  .reduce((n, f) => n + (fs.readFileSync(f, "utf8").match(/@ts-expect-error/g) || []).length, 0);
const stripped = path.join(here, "out/stripped");
fs.mkdirSync(stripped, { recursive: true });
// CompilerHost overrides the same source paths; relative resolution and actual types remain intact.
const host = ts.createCompilerHost({ ...cfg.options, noEmit: true, emitDeclarationOnly: false });
const original = host.readFile;
host.readFile = (f) => {
  const text = original(f);
  return text && f.startsWith(path.join(here, "fixtures"))
    ? text.replace(/\/\/ @ts-expect-error[^\n]*/g, "")
    : text;
};
const broken = ts.createProgram(
  cfg.fileNames,
  { ...cfg.options, noEmit: true, emitDeclarationOnly: false },
  host,
);
const bd = ts.getPreEmitDiagnostics(broken);
assert(bd.length >= suppressed, "Suppressions not independently rejected");
fs.writeFileSync(
  path.join(logs, "p01-unsuppressed.json"),
  JSON.stringify(
    bd.map((d) => ({
      code: d.code,
      file: d.file ? path.relative(here, d.file.fileName) : null,
      message: ts.flattenDiagnosticMessageText(d.messageText, " "),
    })),
    null,
    2,
  ),
);
const result = {
  typescript: ts.version,
  actualSignalOrigins: origins,
  strict: { pass: true, expectedErrorDirectives: suppressed },
  negative: negatives,
  unsuppressedErrors: bd.length,
  declarationEmit: true,
  compileAcceptanceCounterexamples: [
    "ClientContext default UI names permit a typo",
    "OwnedSignal<{n:number}> assigns to actual Signal<{n:number}> and native.value.n++ compiles",
  ],
  knownLimits: [
    "ClientContext<V> defaults ui names to string; later defineClient cannot retroactively contextual-type independent functions.",
    "Type-only clientModule witness cannot prove runtime specifier correspondence.",
    "Readonly projection does not prevent structurally compatible native Signal consumers from typing mutable access; runtime freeze/isolation remains necessary and those consumers may throw.",
    "Type-only keyof typeof functions names work with explicit function context/return annotations and one flat runtime registration.",
    "CompatibleReceived checks parser I against every registered function parameter received type, not only selected receive.",
    "input.value remains text-only; request/delivery generics R/D are unused. Checkbox sinks, DTO requests/delivery/leases are excluded from this bounded declaration proof.",
    "Content boolean=empty is a new unadopted policy; checked/defaultChecked/presence bind server booleans are positive typing evidence only.",
    "Proposed public declarations, not production API types or a runtime ownership proof.",
  ],
};
fs.writeFileSync(path.join(logs, "p01-result.json"), JSON.stringify(result, null, 2) + "\n");
console.log(JSON.stringify(result, null, 2));
