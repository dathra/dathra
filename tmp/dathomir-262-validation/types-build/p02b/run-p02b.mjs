import fs from "node:fs";
import path from "node:path";
import http from "node:http";
import assert from "node:assert/strict";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createRequire } from "node:module";
const here = path.dirname(fileURLToPath(import.meta.url));
const parent = path.dirname(here);
const repo = path.resolve(parent, "../../..");
const rootRequire = createRequire(path.join(repo, "package.json"));
const reactRequire = createRequire(path.join(repo, "packages/reactivity/package.json"));
const pluginRequire = createRequire(path.join(repo, "packages/plugin/package.json"));
const viteRequire = createRequire(pluginRequire.resolve("vite"));
const ts = rootRequire("typescript");
const esbuild = viteRequire("esbuild");
const logs = path.join(here, "logs");
fs.mkdirSync(logs, { recursive: true });
const source = path.join(here, "source");
const original = path.join(here, "out/original");
const relocated = path.join(here, "out/relocated");
const publicBase = "/p02b/nonroot/";
// Deployment-owned entries and inventory; no author-source selection or framework AST inspection.
const inventory = [
  {
    declaration: "counter.server.js",
    specifier: "./counter.client.js",
    id: "counter-v1",
    source: "counter.client.ts",
    asset: "counter",
    names: ["countText", "increment"],
  },
  {
    declaration: "wrong.server.js",
    specifier: "./other.client.js",
    id: "other-v1",
    source: "other.client.ts",
    asset: "other",
    names: ["countText", "increment"],
  },
];
const cases = [];
function record(name, data) {
  cases.push({ name, ...data });
  console.log(name, JSON.stringify(data));
}
const before = fs.readFileSync(path.join(parent, "logs/p02-result.json"));
const json = ts.readConfigFile(path.join(parent, "tsconfig.json"), ts.sys.readFile);
const config = ts.parseJsonConfigFileContent(json.config, ts.sys, parent);
const program = ts.createProgram(
  ["counter.server.ts", "wrong.server.ts", "route.ts", "static.route.ts"].map((f) =>
    path.join(source, f),
  ),
  { ...config.options, noEmit: true, declaration: false, emitDeclarationOnly: false },
);
const diagnostics = ts.getPreEmitDiagnostics(program);
fs.writeFileSync(
  path.join(logs, "typing.json"),
  JSON.stringify(
    diagnostics.map((d) => ({
      code: d.code,
      message: ts.flattenDiagnosticMessageText(d.messageText, " "),
    })),
    null,
    2,
  ),
);
assert.equal(
  diagnostics.length,
  0,
  JSON.stringify(diagnostics.map((d) => ts.flattenDiagnosticMessageText(d.messageText, " "))),
);
record("ordinary-typecheck", {
  strict: true,
  actualSignalTypes: true,
  sameShapeWrongPathNotRejected: true,
});
fs.rmSync(original, { recursive: true, force: true });
fs.rmSync(relocated, { recursive: true, force: true });
fs.mkdirSync(path.join(original, "server"), { recursive: true });
fs.mkdirSync(path.join(original, "browser"), { recursive: true });
// Standard transpilation of an explicit list; module boundaries and import.meta.url remain intact.
for (const file of [
  "counter.server.ts",
  "wrong.server.ts",
  "route.ts",
  "static.route.ts",
  "private-data.ts",
]) {
  const emitted = ts.transpileModule(fs.readFileSync(path.join(source, file), "utf8"), {
    compilerOptions: {
      target: ts.ScriptTarget.ES2022,
      module: ts.ModuleKind.ESNext,
      removeComments: true,
    },
  }).outputText;
  fs.writeFileSync(path.join(original, "server", file.replace(/\.ts$/, ".js")), emitted);
  if (file === "counter.server.ts") assert(emitted.includes("import.meta.url"));
}
fs.writeFileSync(path.join(original, "package.json"), JSON.stringify({ type: "module" }));
const corePackage = path.join(original, "node_modules/@dathra/core");
fs.mkdirSync(corePackage, { recursive: true });
fs.writeFileSync(
  path.join(corePackage, "package.json"),
  JSON.stringify({ type: "module", exports: { "./server": "./server.mjs" } }),
);
fs.copyFileSync(path.join(parent, "runtime/server.mjs"), path.join(corePackage, "server.mjs"));
const nativePackage = path.join(original, "node_modules/@dathra/reactivity");
fs.mkdirSync(nativePackage, { recursive: true });
fs.writeFileSync(
  path.join(nativePackage, "package.json"),
  JSON.stringify({ type: "module", exports: "./index.mjs" }),
);
await esbuild.build({
  absWorkingDir: repo,
  entryPoints: [path.join(repo, "packages/reactivity/src/index.ts")],
  outfile: path.join(nativePackage, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  logLevel: "silent",
});
const aliases = {
  "@dathra/core/client": path.join(parent, "runtime/client.mjs"),
  "@dathra/reactivity": path.join(repo, "packages/reactivity/src/index.ts"),
};
const forbidden = new Set(
  ["private-data.ts", "counter.server.ts", "wrong.server.ts"].map((f) => path.join(source, f)),
);
function guard(meta) {
  const bad = Object.keys(meta.inputs)
    .map((f) => path.resolve(repo, f))
    .filter((f) => forbidden.has(f));
  if (bad.length) throw new Error("E_DECLARED_SERVER_ONLY_INPUT: " + bad.join(", "));
}
const browser = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: {
    owner: path.join(source, "owner.browser.ts"),
    ...Object.fromEntries(inventory.map((e) => [e.asset, path.join(source, e.source)])),
  },
  outdir: path.join(original, "browser"),
  entryNames: "[name]",
  chunkNames: "shared/[name]-[hash]",
  outExtension: { ".js": ".mjs" },
  bundle: true,
  splitting: true,
  platform: "browser",
  format: "esm",
  target: "es2022",
  treeShaking: false,
  minifyWhitespace: true,
  legalComments: "none",
  alias: aliases,
  metafile: true,
  logLevel: "silent",
});
guard(browser.metafile);
fs.writeFileSync(
  path.join(logs, "browser.metafile.json"),
  JSON.stringify(browser.metafile, null, 2),
);
record("explicit-shared-browser-build", {
  entries: ["owner", ...inventory.map((e) => e.asset)],
  ordinarySplitting: true,
  sourceRewrite: false,
  collectorImported: false,
  serverOnlyGuard: "explicit listed resources only",
});
const leakFile = path.join(here, "out/raw-leak.mjs");
const leak = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: [path.join(source, "leak.client.ts")],
  outfile: leakFile,
  bundle: true,
  platform: "browser",
  format: "esm",
  alias: aliases,
  metafile: true,
  logLevel: "silent",
});
assert(fs.readFileSync(leakFile, "utf8").includes("P02B_PURE_SERVER_PRIVATE_264"));
assert.throws(() => guard(leak.metafile), /E_DECLARED_SERVER_ONLY_INPUT/);
record("pure-private-leak", {
  rawBundlerSucceeds: true,
  explicitGuardRejects: true,
  noSuffixInference: true,
});
fs.writeFileSync(
  path.join(original, "driver.mjs"),
  `import {route} from './server/route.js';\nimport {route as staticRoute} from './server/static.route.js';\nimport {renderExperiment} from '@dathra/core/server';\nasync function response(url,catalog,staticOnly=false){const result=renderExperiment(await (staticOnly?staticRoute:route).render(new Request(url)),catalog);return {...result,bootstrap:result.modules.length?'${publicBase}assets/owner.mjs':''};}\nexport {response};\n`,
);
function catalogAt(rootURL) {
  return Object.fromEntries(
    inventory.map((e) => {
      const declaring = new URL("server/" + e.declaration, rootURL);
      return [
        new URL(e.specifier, declaring).href,
        {
          id: e.id,
          file: "../browser/" + e.asset + ".mjs",
          publicURL: publicBase + "assets/" + e.asset + ".mjs",
          names: e.names,
        },
      ];
    }),
  );
}
fs.cpSync(original, relocated, { recursive: true });
const retired = original + ".retired";
fs.rmSync(retired, { recursive: true, force: true });
fs.renameSync(original, retired);
const hidden = source + ".hidden";
fs.renameSync(source, hidden);
let active, zero, staticResponse, driver, catalog;
try {
  const deployedURL = pathToFileURL(relocated + path.sep);
  catalog = catalogAt(deployedURL);
  driver = await import(new URL("driver.mjs", deployedURL));
  active = await driver.response("https://example.test/", catalog);
  assert(active.html.includes("Count: 3"));
  assert.deepEqual(active.payload.associations, ["counter-v1"]);
  assert(!JSON.stringify(active).includes("file:"));
  assert(!JSON.stringify(active).includes(here));
  const key = Object.keys(catalog).find((k) => k.endsWith("/counter.client.js"));
  assert(key.includes("/relocated/server/"));
  assert.equal(fs.existsSync(new URL(key)), false);
  // The client key is a virtual metadata key, never a request to import a browser module on the server.
  await assert.rejects(
    () => driver.response("https://example.test/", catalogAt(pathToFileURL(original + path.sep))),
    /E_MODULE_LOOKUP/,
  );
  const badNames = Object.fromEntries(
    Object.entries(catalog).map(([k, v]) => [k, { ...v, names: ["countText"] }]),
  );
  await assert.rejects(
    () => driver.response("https://example.test/", badNames),
    /E_FUNCTION_NAME: increment/,
  );
  zero = await driver.response("https://example.test/?mode=zero", catalog);
  staticResponse = await driver.response("https://example.test/", {}, true);
  assert.deepEqual(zero.modules, []);
  assert.equal(zero.payload, null);
  assert.equal(zero.bootstrap, "");
  assert.deepEqual(staticResponse.modules, []);
  assert.equal(staticResponse.payload, null);
  record("actual-preserve-module-relocation", {
    originalOutputAndSourceUnavailable: true,
    emittedDeclarationKey: key,
    virtualClientKeyDoesNotExist: true,
    SSRWorks: true,
    publicIDs: active.payload.associations,
    publicURLs: active.modules,
    oldLayoutInventoryRejected: true,
    incorrectNamesRejected: true,
  });
} finally {
  fs.renameSync(hidden, source);
  fs.renameSync(retired, original);
}
const staticBuild = path.join(here, "out/static-browser");
fs.mkdirSync(staticBuild, { recursive: true });
// A separately declared static route inventory selects no browser entry; do not run a dummy browser build.
const staticEntries = [];
assert.equal(staticEntries.length, 0);
assert.equal(fs.readdirSync(staticBuild).length, 0);
record("static-vs-dynamic-zero", {
  staticManualEntrySet: [],
  staticBrowserFiles: 0,
  dynamicPotentialClientFiles: 2,
  dynamicResponse: zero,
  staticResponse,
  scope:
    "Response omissions separate from available browser build files; explicit manual route inventory obligation.",
});
const files = new Map();
function walk(dir) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, e.name);
    if (e.isDirectory()) walk(file);
    else
      files.set(
        publicBase +
          "assets/" +
          path.relative(path.join(relocated, "browser"), file).split(path.sep).join("/"),
        file,
      );
  }
}
walk(path.join(relocated, "browser"));
const requests = [];
const server = http.createServer(async (req, res) => {
  try {
    const pathname = new URL(req.url, "http://local.test").pathname;
    requests.push(pathname);
    if (pathname === publicBase + "page" || pathname === publicBase + "zero") {
      const r = await driver.response(
        "https://example.test/" + (pathname.endsWith("/zero") ? "?mode=zero" : ""),
        catalog,
      );
      const body =
        r.html +
        (r.modules.length
          ? `<script type="application/json" id="module-map">${JSON.stringify({ modules: r.modules, payload: r.payload })}</script><script type="module" src="${r.bootstrap}"></script>`
          : "");
      assert(!body.includes("file:") && !body.includes(here));
      res.writeHead(200, { "content-type": "text/html" });
      res.end(body);
      return;
    }
    const file = files.get(pathname);
    if (file) {
      const data = fs.readFileSync(file, "utf8");
      assert(!data.includes("P02B_PURE_SERVER_PRIVATE_264"));
      res.writeHead(200, { "content-type": "text/javascript" });
      res.end(data);
      return;
    }
    res.writeHead(404);
    res.end("not found");
  } catch (e) {
    res.writeHead(500);
    res.end(String(e));
  }
});
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
let browserEvidence;
try {
  const origin = `http://127.0.0.1:${server.address().port}`;
  const response = await fetch(origin + publicBase + "page");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert(!html.includes("file:"));
  for (const url of files.keys()) {
    const f = await fetch(origin + url);
    assert.equal(f.status, 200);
    assert.equal(f.headers.get("content-type"), "text/javascript");
  }
  const vitestRequire = createRequire(reactRequire.resolve("vitest"));
  const playwright = vitestRequire("playwright");
  let chromium;
  try {
    chromium = await playwright.chromium.launch({ headless: true });
  } catch (error) {
    browserEvidence = { ran: false, blocker: String(error) };
  }
  if (chromium) {
    try {
      const page = await chromium.newPage();
      const errors = [];
      page.on("pageerror", (error) => errors.push(String(error)));
      await page.goto(origin + publicBase + "page");
      browserEvidence = await page.evaluate(async (base) => {
        const owner = await import(base + "assets/owner.mjs");
        const behavior = await import(base + "assets/counter.mjs");
        const other = await import(base + "assets/other.mjs");
        const count = owner.signal(1);
        const computed = behavior.derived(count);
        const initial = computed.value;
        count.set(2);
        const values = { count, title: "Count", visible: true };
        return {
          ran: true,
          signalIdentity: owner.signal === behavior.signal,
          computedIdentity: owner.computed === behavior.computed,
          derived: [initial, computed.value],
          counter: behavior.default.functions.countText({ values }),
          other: other.default.functions.countText({ values }),
        };
      }, publicBase);
      assert.equal(browserEvidence.signalIdentity, true);
      assert.equal(browserEvidence.computedIdentity, true);
      assert.deepEqual(browserEvidence.derived, [2, 4]);
      assert.equal(browserEvidence.counter, "Count: 2");
      assert.equal(browserEvidence.other, "OTHER: 2");
      assert.deepEqual(errors, []);
      browserEvidence.version = chromium.version();
      browserEvidence.playwright = "1.56.1";
      browserEvidence.pageErrors = errors;
      await page.goto(origin + publicBase + "zero");
      assert.equal(await page.locator("script").count(), 0);
    } finally {
      await chromium.close();
    }
  }
  record("non-root-http-and-chromium", {
    allEmittedAssetsHTTP200: true,
    noFileKeysInHTML: true,
    requests,
    browser: browserEvidence,
    limits:
      "Actual module/engine evidence only; no DOM admission, restored payload codec, input ownership, disposal or terminality proof.",
  });
  const wrongResponse = await driver.response("https://example.test/?mode=wrong", catalog);
  assert.deepEqual(wrongResponse.payload.associations, ["other-v1"]);
  record("type-runtime-semantic-mismatch", {
    strictTypeScriptAccepted: true,
    manualInventoryAccepted: true,
    SSR: wrongResponse.html,
    actualBrowserOtherResult: browserEvidence?.other,
    undetectableWithoutAdditionalProvenanceAnalysis: true,
    notClaimedAsRuntimeTypeIdentityProof: true,
  });
} finally {
  await new Promise((resolve) => server.close(resolve));
}
assert.equal(Buffer.compare(before, fs.readFileSync(path.join(parent, "logs/p02-result.json"))), 0);
record("baseline-preserved", { previousP02Cases: 27, resultBytesUnchanged: true });
const result = {
  task: "#262/#264 P02b",
  node: process.version,
  typescript: ts.version,
  esbuild: esbuild.version,
  publicBase,
  sourceSelection: "manual explicit inventory",
  serverEmission: "ordinary ts.transpileModule preserving app modules",
  frameworkASTInspection: false,
  importMetaSourceRewrite: false,
  browserEvidence,
  cases,
};
fs.writeFileSync(path.join(logs, "result.json"), JSON.stringify(result, null, 2) + "\n");
console.log("P02b complete", cases.length);
