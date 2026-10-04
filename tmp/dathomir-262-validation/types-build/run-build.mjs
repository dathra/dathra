import fs from "node:fs";
import path from "node:path";
import assert from "node:assert/strict";
import http from "node:http";
import { pathToFileURL, fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import { collect, ts, here, repo, options } from "./collector.mjs";
const pluginRequire = createRequire(path.join(repo, "packages/plugin/package.json"));
const viteRequire = createRequire(pluginRequire.resolve("vite"));
const esbuild = viteRequire("esbuild");
const out = path.join(here, "out/build");
const logs = path.join(here, "logs");
fs.mkdirSync(out, { recursive: true });
const aliases = {
  "@dathra/core/server": path.join(here, "runtime/server.mjs"),
  "@dathra/core/client": path.join(here, "runtime/client.mjs"),
  "@dathra/reactivity": path.join(repo, "packages/reactivity/src/index.ts"),
};
const result = {
  node: process.version,
  typescript: ts.version,
  esbuild: esbuild.version,
  adapter:
    "Explicit TS symbol inventory + metadata-only base URL rewrite + real esbuild bundles. No function extraction.",
  cases: [],
};
// Explicit test inventory; no general classification from suffixes or function extraction.
const serverOnlyInventory = new Set([
  path.join(here, "graph/private.server.ts"),
  path.join(here, "graph/private-data.ts"),
  path.join(here, "graph/counter.server.ts"),
  path.join(here, "runtime/server.mjs"),
]);
function enforceBrowserInventory(meta) {
  const found = Object.keys(meta.inputs)
    .map((file) => path.resolve(repo, file))
    .filter((file) => serverOnlyInventory.has(file));
  if (found.length)
    throw new Error(
      `E_BROWSER_POLICY_INPUT: ${found.join(", ")}; remove the runtime import or move public DTO/data to an explicitly browser-safe module.`,
    );
}
const record = (name, evidence) => {
  result.cases.push({ name, ...evidence });
  console.log(name, JSON.stringify(evidence));
};
const encodedURL = new URL("file:///tmp/日本語%20component/collector.mjs");
assert.equal(fileURLToPath(encodedURL), "/tmp/日本語 component/collector.mjs");
assert.equal(path.dirname(fileURLToPath(encodedURL)), "/tmp/日本語 component");
assert.equal(fileURLToPath(pathToFileURL(fileURLToPath(encodedURL))), fileURLToPath(encodedURL));
record("file-url-space-unicode", {
  decodedDirectory: "/tmp/日本語 component",
  roundTrip: true,
  scope: "URL unit only on Linux; no alternate checkout or Windows run.",
});
function typed(file) {
  const p = ts.createProgram([file], {
    ...options,
    noEmit: true,
    emitDeclarationOnly: false,
    declaration: false,
  });
  return ts
    .getPreEmitDiagnostics(p)
    .map((d) => ({ code: d.code, message: ts.flattenDiagnosticMessageText(d.messageText, " ") }));
}
for (const [file, code] of [
  ["missing.ts", "E_MODULE_MISSING"],
  ["no-default.ts", "E_DEFAULT_MISSING"],
  ["local-alias.ts", "E_CLIENT_LINK_INDIRECTION"],
  ["nonliteral.ts", "E_CLIENT_LINK_LITERAL"],
  ["same-shape.ts", "E_TYPE_RUNTIME_SOURCE_MISMATCH"],
  ["invalid-default.ts", "E_DEFAULT_PROFILE"],
  ["parser-identity.ts", "E_CREATE_INPUT_SOURCE_MISMATCH"],
]) {
  const c = collect(path.join(here, "graph/negative", file));
  fs.writeFileSync(
    path.join(logs, "p02-inventory-" + file + ".json"),
    JSON.stringify(c.errors, null, 2),
  );
  assert(
    c.errors.some((e) => e.code === code),
    JSON.stringify(c.errors),
  );
  if (file === "same-shape.ts") {
    const ds = typed(path.join(here, "graph/negative", file));
    assert.equal(ds.length, 0, JSON.stringify(ds));
  }
  record(file, {
    rejectedByInventory: code,
    ...(file === "same-shape.ts" ? { typeScriptAloneAccepts: true } : {}),
  });
}
const namespaceType = collect(path.join(here, "graph/type-namespace.server.ts"));
assert.equal(namespaceType.errors.length, 0, JSON.stringify(namespaceType.errors));
assert.equal(namespaceType.refs.length, 1);
record("type-only-namespace-default-alias", {
  finiteDefaultSymbolComparisonPasses: true,
  form: "typeof Browser.default",
});
const shadow = collect(path.join(here, "graph/negative/shadow.ts"));
assert.equal(shadow.errors.length, 0);
assert.equal(shadow.refs.length, 0);
assert.equal(shadow.files.size, 0);
record("shadowed-function", { unrelatedSameNameNotCollectedOrRewritten: true });
const profile = typed(path.join(here, "graph/negative/profile.ts"));
assert(
  profile.some((d) => d.code === 2345),
  JSON.stringify(profile),
);
record("creation-profile", { actualDeclaredTypeRejectsPlainClient: true, diagnostics: profile });
async function bundle(source, target, platform, files = new Map()) {
  const plugin = {
    name: "explicit-client-module-relocation-adapter",
    setup(build) {
      build.onLoad({ filter: /\.[tj]s$/ }, (args) => {
        const text = files.get(args.path);
        if (text !== undefined)
          return {
            contents: text,
            loader: args.path.endsWith(".ts") ? "ts" : "js",
            resolveDir: path.dirname(args.path),
          };
      });
    },
  };
  return esbuild.build({
    absWorkingDir: repo,
    entryPoints: [source],
    outfile: target,
    bundle: true,
    format: "esm",
    platform,
    target: "es2022",
    treeShaking: false,
    minifyWhitespace: platform === "browser",
    legalComments: "none",
    metafile: true,
    alias: aliases,
    plugins: [plugin],
    logLevel: "silent",
  });
}
async function buildRoute(entry, name, rewrite = true) {
  const dir = path.join(out, name);
  fs.mkdirSync(path.join(dir, "server"), { recursive: true });
  fs.mkdirSync(path.join(dir, "browser"), { recursive: true });
  const c = collect(entry);
  assert.equal(c.errors.length, 0, JSON.stringify(c.errors));
  const catalog = {};
  let i = 0;
  for (const r of c.refs) {
    if (catalog[r.key]) continue;
    const file = `../browser/client-${i++}.mjs`;
    const br = await bundle(r.clientFile, path.join(dir, "server", file), "browser");
    enforceBrowserInventory(br.metafile);
    catalog[r.key] = {
      file,
      id: `module-${i - 1}`,
      publicURL: `/proof/non-root/assets/client-${i - 1}.mjs`,
      names: r.names,
      hasCreation: r.hasCreation,
    };
    fs.writeFileSync(
      path.join(logs, `p02-${name}-browser-${i}.metafile.json`),
      JSON.stringify(br.metafile, null, 2),
    );
  }
  fs.writeFileSync(path.join(dir, "server/catalog.json"), JSON.stringify(catalog, null, 2));
  const wrapper = path.join(dir, "source-entry.mjs");
  fs.writeFileSync(
    wrapper,
    `import {route} from ${JSON.stringify(entry)};\nimport {renderExperiment} from ${JSON.stringify(path.join(here, "runtime/server.mjs"))};\nimport fs from 'node:fs';\nfunction response(url) { const catalog=JSON.parse(fs.readFileSync(new URL('./catalog.json',import.meta.url),'utf8')); return Promise.resolve(route.render(new Request(url))).then(content=>renderExperiment(content,catalog)); }\nexport {response};\n`,
  );
  const serverFile = path.join(dir, "server/entry.mjs");
  const ssr = await bundle(wrapper, serverFile, "node", rewrite ? c.files : new Map());
  const serverInputs = Object.keys(ssr.metafile.inputs);
  const declaredBrowserFiles = new Set(c.refs.map((r) => r.clientFile));
  assert(
    !serverInputs.map((f) => path.resolve(repo, f)).some((f) => declaredBrowserFiles.has(f)),
    `E_SSR_BROWSER_GRAPH: ${serverInputs.join(",")}`,
  );
  fs.writeFileSync(
    path.join(logs, `p02-${name}-server.metafile.json`),
    JSON.stringify(ssr.metafile, null, 2),
  );
  return { dir, serverFile, catalog, refs: c.refs, serverInputs };
}
const naive = await buildRoute(path.join(here, "graph/route.ts"), "naive", false);
const naiveRuntime = await import(pathToFileURL(naive.serverFile));
let naiveFailure;
try {
  await naiveRuntime.response("https://example.test/");
} catch (e) {
  naiveFailure = String(e);
}
assert(naiveFailure?.includes("E_MODULE_LOOKUP"), naiveFailure);
const naiveKey = naiveFailure.slice(naiveFailure.indexOf("file:"));
assert.equal(fs.existsSync(new URL(naiveKey)), false);
record("naive-source-vs-emitted-import-meta", {
  actualRenderFails: naiveFailure,
  referencedOutputFileExists: false,
});
const fixed = await buildRoute(path.join(here, "graph/route.ts"), "fixed");
assert.equal(fixed.refs.length, 3);
assert(fixed.refs.some((r) => r.form === "link"));
assert(fixed.refs.some((r) => r.form === "namespace"));
assert.equal(new Set(fixed.refs.map((r) => r.key)).size, 3);
const serverText = fs.readFileSync(fixed.serverFile, "utf8");
assert(serverText.includes("SERVER_ONLY_SECRET_262_P02"));
assert(!serverText.includes("BROWSER_TOP_LEVEL_EXECUTED_ON_SERVER"));
for (const item of Object.values(fixed.catalog)) {
  const text = fs.readFileSync(path.resolve(path.dirname(fixed.serverFile), item.file), "utf8");
  assert(!text.includes("SERVER_ONLY_SECRET_262_P02"));
}
assert.equal(globalThis.__p02BrowserLoads, undefined);
const fixedRuntime = await import(pathToFileURL(fixed.serverFile));
const active = await fixedRuntime.response("https://example.test/");
assert.equal(globalThis.__p02BrowserLoads, undefined);
assert(
  active.html.includes("Count: 3") &&
    active.html.includes("one SSR") &&
    active.html.includes("two SSR"),
);
assert.equal(active.modules.length, 3);
record("emitted-graphs-and-ssr", {
  realEsbuildBundles: true,
  treeShaking: false,
  serverContainsSecretAndNoBrowserTopLevel: true,
  browserHasNoServerInputsOrSecret: true,
  actualServerExecutionDidNotLoadBrowser: true,
  renamedImportAndNamespaceSupported: true,
  distinctSameBasenameReferences: 2,
  activatedModules: active.modules.length,
});
const dynamicZero = await fixedRuntime.response("https://example.test/?static=1");
assert.deepEqual(dynamicZero, {
  html: "<article>server-only response</article>",
  modules: [],
  bootstrap: "",
  payload: null,
});
assert.equal(Object.keys(fixed.catalog).length, 3);
record("dynamic-zero-response", {
  response: dynamicZero,
  potentialBrowserArtifactsStillExist: 3,
  boundary: "Response omissions; not removal of available build artifacts.",
});
const zeroOccurrence = await fixedRuntime.response("https://example.test/?static=2");
assert.deepEqual(zeroOccurrence, {
  html: "<span>declared association without client markers</span>",
  modules: [],
  bootstrap: "",
  payload: null,
});
record("declared-client-zero-marker-occurrence", {
  serverAndUnifiedSignalRecordWerePrepared: true,
  response: zeroOccurrence,
  potentialBrowserArtifactsStillExist: 3,
  limits:
    "Fixture activation collector only; not production state codec/transport or zero-root admission proof.",
});
const staticRoute = await buildRoute(path.join(here, "graph/static.route.ts"), "static");
assert.equal(Object.keys(staticRoute.catalog).length, 0);
assert.equal(fs.readdirSync(path.join(staticRoute.dir, "browser")).length, 0);
const staticRuntime = await import(pathToFileURL(staticRoute.serverFile));
const staticResponse = await staticRuntime.response("https://example.test/");
assert.equal(staticResponse.bootstrap, "");
assert.equal(staticResponse.payload, null);
record("static-route-build-omission", {
  selectedBrowserEntries: 0,
  generatedBrowserFiles: 0,
  response: staticResponse,
});
const relocated = path.join(out, "relocated/deployment");
fs.mkdirSync(path.dirname(relocated), { recursive: true });
fs.cpSync(fixed.dir, relocated, { recursive: true });
const retired = fixed.dir + ".retired";
fs.renameSync(fixed.dir, retired);
const sourceDir = path.join(here, "graph");
const hiddenSource = sourceDir + ".temporarily-hidden";
fs.renameSync(sourceDir, hiddenSource);
try {
  const relocatedEntry = path.join(relocated, "server/entry.mjs");
  const runtime = await import(pathToFileURL(relocatedEntry));
  const response = await runtime.response("https://example.test/");
  globalThis.window = {};
  const lookups = [];
  for (const relative of response.modules) {
    const originalEntry = Object.values(fixed.catalog).find((e) => e.publicURL === relative);
    const url = new URL(originalEntry.file, pathToFileURL(relocatedEntry));
    const module = await import(url);
    assert.equal(typeof module.default.functions, "object");
    assert.deepEqual(Object.keys(module.default.functions).sort(), [...originalEntry.names].sort());
    for (const name of originalEntry.names)
      assert.equal(typeof module.default.functions[name], "function");
    lookups.push({
      relative,
      actualURL: url.href,
      exists: fs.existsSync(url),
      names: Object.keys(module.default.functions),
    });
  }
  assert.equal(globalThis.__p02BrowserLoads, 1);
  record("actual-relocated-lookup", {
    originalOutputAndSourceUnavailable: true,
    serverSSRWorks: true,
    actualImports: lookups,
    browserTopLevelSentinelExecutedOnlyInBrowserSmoke: true,
    host: "Node with a minimal window sentinel; no DOM/admission browser proof.",
  });
} finally {
  delete globalThis.window;
  fs.renameSync(hiddenSource, sourceDir);
  fs.renameSync(retired, fixed.dir);
}
const nameRoute = await buildRoute(path.join(here, "graph/negative/name.route.js"), "bad-name");
const nameRuntime = await import(pathToFileURL(nameRoute.serverFile));
await assert.rejects(
  () => nameRuntime.response("https://example.test/"),
  /E_FUNCTION_NAME: misspelled; available label/,
);
record("js-runtime-invalid-name", {
  rejectBeforeResponseActivation: true,
  diagnostic: "E_FUNCTION_NAME: misspelled; available label",
});
const ordinaryFile = path.join(out, "ordinary-import.mjs");
await bundle(path.join(here, "graph/negative/ordinary-import.ts"), ordinaryFile, "node");
await assert.rejects(
  () => import(pathToFileURL(ordinaryFile)),
  /BROWSER_TOP_LEVEL_EXECUTED_ON_SERVER/,
);
record("ordinary-client-runtime-import", {
  actualServerEvaluationFailsSentinel: true,
  typeOnlyImportAvoidsThis: true,
});
let leakFailure;
try {
  await bundle(
    path.join(here, "graph/negative/secret-leak.client.ts"),
    path.join(out, "leak.mjs"),
    "browser",
  );
} catch (e) {
  leakFailure = e.errors.map((e) => e.text).join("; ");
}
assert(leakFailure?.includes("node:crypto"));
record("browser-import-server-dependency", { actualBundlerRejects: leakFailure });
const row = await buildRoute(path.join(here, "graph/row.server.ts"), "row-profile");
assert.equal(row.refs[0].hasCreation, true);
const rowSSR = await import(pathToFileURL(row.serverFile));
const rowResponse = await rowSSR.response("https://example.test/");
assert(rowResponse.html.includes("SSR Alpha"));
const rowEntry = Object.values(row.catalog).find((e) => e.publicURL === rowResponse.modules[0]);
const rowBrowser = await import(
  pathToFileURL(path.resolve(path.dirname(row.serverFile), rowEntry.file))
);
const creationRuntime = await import(pathToFileURL(path.join(here, "runtime/client.mjs")));
assert.equal(rowBrowser.countInitializations(), 0);
const lazy = creationRuntime.createComponent(rowBrowser.default, {
  _key: "a",
  input: { id: "a", label: "Later" },
});
assert.equal(lazy.kind, "created");
assert.equal(rowBrowser.countInitializations(), 0);
const parsed = rowBrowser.default.create.input({ id: "b", label: "Fresh" });
const fresh = rowBrowser.default.create.initialize(parsed);
assert.equal(fresh.draft.peek(), "Fresh");
fresh.draft.set("Changed");
assert.equal(fresh.draft.value, "Changed");
assert.equal(rowBrowser.countInitializations(), 1);
assert.throws(() => rowBrowser.default.create.input({ id: 1, label: "Bad" }), /E_ROW_INPUT/);
record("optional-creation-profile-real-engine", {
  sameNeutralParserSourceValidated: true,
  SSRNeverExecutedBrowserInitializer: true,
  lazyDescriptionDidNotInitialize: true,
  explicitFreshInitializationActualSignalWorks: true,
  invalidInputRejected: true,
  limits: "No SSR DOM adoption, receive scheduling, placement authority or reconciliation proof.",
});
const server = await import(pathToFileURL(path.join(here, "runtime/server.mjs")));
const booleanRef = server.clientModule("./boolean.client.js", import.meta.url);
const BooleanControls = server.defineComponent({
  client: booleanRef,
  server() {
    return {};
  },
  template(values, { bind }) {
    return server.el(
      "form",
      {},
      server.el("input", {
        props: { checked: bind("checked", { server: true }), defaultChecked: true },
      }),
      server.el("input", {
        props: { checked: bind("checked", { server: false }), defaultChecked: false },
      }),
      server.el("input", { props: { defaultChecked: bind("checked", { server: true }) } }),
      server.el("button", { disabled: bind("disabled", { server: true }) }, "disabled"),
      server.el(
        "button",
        { disabled: bind("disabled", { server: false }), "aria-busy": false },
        "enabled",
      ),
      true,
      false,
      bind("checked", { server: false }),
    );
  },
});
const booleanSSR = server.renderExperiment(
  await BooleanControls(undefined, new Request("https://example.test/")),
  { [booleanRef.key]: { file: "boolean.mjs", names: ["checked", "disabled"] } },
);
assert.equal(
  booleanSSR.html,
  '<form><input checked></input><input></input><input checked></input><button disabled>disabled</button><button aria-busy="false">enabled</button><!--bind:checked--><!--/bind--></form>',
);
record("boolean-placement", {
  positiveCheckedAndDefaultChecked: true,
  truePresenceFalseOmission: true,
  ariaFalseIsStringNotAbsence: true,
  booleanContent: "empty",
  emptyMarkerStillActivates: booleanSSR.modules.length === 1,
  html: booleanSSR.html,
  policyStatus:
    "New unadopted content-boolean policy; serializer is experimental, no DOM control/admission proof.",
});
// Raw bundling a browser-compatible private constant succeeds; the explicit policy must reject it.
const pureLeakFile = path.join(out, "pure-leak-unguarded.mjs");
const pureLeak = await bundle(
  path.join(here, "graph/negative/pure-leak.client.ts"),
  pureLeakFile,
  "browser",
);
assert(fs.readFileSync(pureLeakFile, "utf8").includes("PURE_BROWSER_COMPATIBLE_SERVER_SECRET_262"));
assert.throws(() => enforceBrowserInventory(pureLeak.metafile), /E_BROWSER_POLICY_INPUT/);
await assert.rejects(
  () => buildRoute(path.join(here, "graph/negative/pure-leak.ts"), "pure-leak-guarded"),
  /E_BROWSER_POLICY_INPUT/,
);
record("pure-compatible-server-dependency-leak", {
  rawEsbuildSuccessfullyLeaks: true,
  explicitInventoryGuardRejects: true,
  guardAlsoAppliedToNormalBuildPath: true,
  diagnostic:
    "E_BROWSER_POLICY_INPUT; remove runtime import or use an explicitly public DTO module",
  scope:
    "Only declared experimental server-only resources; no arbitrary suffix-based classification.",
});

// Test an actual HTTP mount. This validates URLs and bytes, not browser DOM/admission.
const publicPrefix = "/proof/non-root/";
const filesByPublicURL = new Map(
  Object.values(fixed.catalog).map((entry) => [
    entry.publicURL,
    path.resolve(path.join(relocated, "server"), entry.file),
  ]),
);
const served = [];
const serverHTTP = http.createServer(async (request, response) => {
  try {
    const pathname = new URL(request.url, "http://local.test").pathname;
    served.push(pathname);
    if (pathname === publicPrefix + "page" || pathname === publicPrefix + "page-static") {
      const emitted = await import(pathToFileURL(path.join(relocated, "server/entry.mjs")));
      const body = await emitted.response(
        "https://example.test/" + (pathname.endsWith("page-static") ? "?static=1" : ""),
      );
      const html =
        body.html +
        (body.modules.length
          ? `<script id="module-map" type="application/json">${JSON.stringify({ modules: body.modules, payload: body.payload })}</script>`
          : "") +
        body.bootstrap;
      assert(
        !html.includes("file:") && !html.includes(here) && !html.includes("counter.server.ts"),
      );
      response.writeHead(200, { "content-type": "text/html" });
      response.end(html);
      return;
    }
    if (pathname === publicPrefix + "assets/bootstrap.mjs") {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(
        'const p=JSON.parse(document.getElementById("module-map").textContent); await Promise.all(p.modules.map(url=>import(url)));',
      );
      return;
    }
    const file = filesByPublicURL.get(pathname);
    if (file) {
      response.writeHead(200, { "content-type": "text/javascript" });
      response.end(fs.readFileSync(file));
      return;
    }
    response.writeHead(404);
    response.end("not found");
  } catch (error) {
    response.writeHead(500);
    response.end(String(error));
  }
});
await new Promise((resolve) => serverHTTP.listen(0, "127.0.0.1", resolve));
try {
  const port = serverHTTP.address().port;
  const origin = `http://127.0.0.1:${port}`;
  const pageURL = origin + publicPrefix + "page";
  const response = await fetch(pageURL);
  assert.equal(response.status, 200);
  const html = await response.text();
  const data = JSON.parse(
    html.match(/<script id="module-map" type="application\/json">(.*?)<\/script>/s)[1],
  );
  assert.deepEqual(data.payload.associations, ["module-0", "module-1", "module-2"]);
  assert(!JSON.stringify(data).includes("file:") && !JSON.stringify(data).includes(here));
  const bootstrap = html.match(/<script type="module" src="([^"]+)"/)[1];
  const boot = await fetch(new URL(bootstrap, pageURL));
  assert.equal(boot.status, 200);
  assert.equal(boot.headers.get("content-type"), "text/javascript");
  const fetched = [];
  globalThis.window = {};
  for (const moduleURL of data.modules) {
    const url = new URL(moduleURL, pageURL);
    assert(url.pathname.startsWith(publicPrefix + "assets/"));
    const asset = await fetch(url);
    assert.equal(asset.status, 200);
    const source = await asset.text();
    assert(!source.includes("SERVER_ONLY_SECRET_262_P02"));
    assert(
      !source.includes("file:") &&
        !source.includes(here) &&
        !source.includes("tmp/dathomir-262-validation"),
    );
    const loaded = await import(
      "data:text/javascript;base64," + Buffer.from(source).toString("base64")
    );
    assert.equal(typeof loaded.default.functions, "object");
    fetched.push({
      publicPath: url.pathname,
      status: asset.status,
      bytes: Buffer.byteLength(source),
    });
  }
  const staticResponse = await fetch(origin + publicPrefix + "page-static");
  const staticHTML = await staticResponse.text();
  assert.equal(staticHTML, "<article>server-only response</article>");
  record("http-non-root-public-mount", {
    actualHTTPRequests: true,
    publicPrefix,
    opaqueIDs: data.payload.associations,
    noSourceFilesystemPathsInResponse: true,
    fetchedAssets: fetched,
    bootstrapFetched: true,
    zeroResponseHasNoModuleMapOrScript: true,
    requestPaths: served,
    limits:
      "Bootstrap source served but no real browser executes it; fetched self-contained ESM executed via Node data URL with window shim. No production transport/admission proof.",
  });
} finally {
  delete globalThis.window;
  await new Promise((resolve) => serverHTTP.close(resolve));
}
// Browser tracking ABI: the same source in two entry bundles need not be one runtime instance.
const independent = path.join(out, "engine-independent");
fs.mkdirSync(independent, { recursive: true });
const engineAFile = path.join(independent, "a.mjs");
const engineBFile = path.join(independent, "b.mjs");
const engineAMeta = await bundle(
  path.join(here, "graph/engine-a.client.ts"),
  engineAFile,
  "browser",
);
const engineBMeta = await bundle(
  path.join(here, "graph/engine-b.client.ts"),
  engineBFile,
  "browser",
);
const engineA = await import(pathToFileURL(engineAFile));
const engineB = await import(pathToFileURL(engineBFile));
const owned = engineA.signal(1);
const sameEngine = engineA.computed(() => owned.value * 2);
const foreignEngine = engineB.computed(() => owned.value * 2);
assert.equal(sameEngine.value, 2);
assert.equal(foreignEngine.value, 2);
owned.set(2);
assert.equal(sameEngine.value, 4);
assert.equal(foreignEngine.value, 2);
assert.notEqual(engineA.signal, engineB.signal);
const signalSource = path.join(repo, "packages/reactivity/src/signal/implementation.ts");
assert(
  Object.keys(engineAMeta.metafile.inputs)
    .map((f) => path.resolve(repo, f))
    .includes(signalSource),
);
assert(
  Object.keys(engineBMeta.metafile.inputs)
    .map((f) => path.resolve(repo, f))
    .includes(signalSource),
);
record("independent-emitted-browser-engine-negative", {
  sameActualSourceInBothGraphs: true,
  constructorsEqual: false,
  sameEngineComputed: [2, 4],
  crossEngineComputed: [2, 2],
  consequence:
    "Per-entry self-contained bundles do not establish browser tracking ABI; normal computed reads may remain stale.",
});
fs.writeFileSync(
  path.join(logs, "p02-engine-independent-a.metafile.json"),
  JSON.stringify(engineAMeta.metafile, null, 2),
);
fs.writeFileSync(
  path.join(logs, "p02-engine-independent-b.metafile.json"),
  JSON.stringify(engineBMeta.metafile, null, 2),
);
const sharedDir = path.join(out, "engine-shared");
const shared = await esbuild.build({
  absWorkingDir: repo,
  entryPoints: {
    a: path.join(here, "graph/engine-a.client.ts"),
    b: path.join(here, "graph/engine-b.client.ts"),
  },
  outdir: sharedDir,
  outExtension: { ".js": ".mjs" },
  chunkNames: "shared/[name]-[hash]",
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
const commonA = await import(pathToFileURL(path.join(sharedDir, "a.mjs")));
const commonB = await import(pathToFileURL(path.join(sharedDir, "b.mjs")));
assert.equal(commonA.signal, commonB.signal);
assert.equal(commonA.computed, commonB.computed);
const sharedSignal = commonA.signal(1);
const sharedComputed = commonB.computed(() => sharedSignal.value * 2);
assert.equal(sharedComputed.value, 2);
sharedSignal.set(2);
assert.equal(sharedComputed.value, 4);
fs.writeFileSync(
  path.join(logs, "p02-engine-shared.metafile.json"),
  JSON.stringify(shared.metafile, null, 2),
);
record("shared-emitted-browser-engine-positive", {
  oneOrdinaryMultiEntrySplitBuild: true,
  constructorsEqual: true,
  computedEqual: true,
  crossEntryComputed: [2, 4],
  emittedChunks: Object.keys(shared.metafile.outputs).filter((f) => f.includes("/shared/")),
  gate: "Production loader and every admitted client entry must resolve the same browser engine URL/runtime instance, including later delivered modules. This adapter still builds author entries separately and has not met that gate.",
  serverSnapshotCopies:
    "Distinct server snapshot producers are allowed; this is a browser tracking ABI requirement.",
});
const client = await import(pathToFileURL(path.join(here, "runtime/client.mjs")));
assert.throws(
  () => client.createComponent(client.defineClient({ label() {} }), { _key: "x", input: {} }),
  /E_NO_CREATE_PROFILE/,
);
assert.throws(() => client.defineClient({ label: 1 }), /E_CLIENT_FUNCTION/);
record("js-runtime-profile-validation", { noCreationProfileAndNonCallableRegistryRejected: true });
fs.writeFileSync(path.join(logs, "p02-result.json"), JSON.stringify(result, null, 2) + "\n");
console.log("P02 complete", result.cases.length, "cases");
