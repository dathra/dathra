import { transform } from "@dathra/transformer";
import fs from "node:fs";
import type { IncomingHttpHeaders } from "node:http";
import { createRequire } from "node:module";
import path from "node:path";
import { createUnplugin, type UnpluginContext } from "unplugin";
import type {
  TransformResult,
  Plugin as VitePlugin,
  UserConfig,
  ViteDevServer,
} from "vite";

/**
 * Plugin options shared by every runtime mode.
 */
interface PluginCommonOptions {
  /**
   * File extensions to include (default: ['.tsx', '.jsx']).
   */
  include?: string[];

  /**
   * Patterns to exclude from transformation.
   */
  exclude?: string[];

  /**
   * Module to import runtime functions from (default: '@dathra/core').
   */
  runtimeModule?: string;
}

/**
 * Plugin options for the Dathra plugin.
 */
type PluginOptions = PluginCommonOptions &
  (
    | {
        /** Force SSR mode and allow Vite dev SSR rendering options. */
        mode: "ssr";

        /** Configure Vite dev SSR HTML rendering. */
        ssr?: false | PluginSsrOptions;
      }
    | {
        /** Force CSR mode, or omit it to use environment-based detection. */
        mode?: "csr";

        /** SSR rendering options are only valid with mode: "ssr". */
        ssr?: false;
      }
  );

interface PluginSsrContext {
  request: Request;
  requestId: string;
  url: string;
}

type PluginSsrRenderResult =
  | string
  | Response
  | {
      html: string;
      statusCode?: number;
      headers?: HeadersInit;
    };

interface PluginSsrOptions {
  /** SSR module entry passed to Vite's ssrLoadModule(). */
  entry: string;

  /** HTML placeholder replaced with the rendered app HTML. */
  outlet?: string;

  /** Export name to call from the SSR module. Defaults to `render`, then default. */
  renderExport?: string;
}

/**
 * Check if a file should be transformed based on options.
 */
function shouldTransform(id: string, options: PluginOptions): boolean {
  const include = options.include ?? [".tsx", ".jsx"];
  const exclude = options.exclude ?? [];

  // Check exclusions first
  for (const pattern of exclude) {
    if (id.includes(pattern)) {
      return false;
    }
  }

  // Check inclusions
  for (const ext of include) {
    if (id.endsWith(ext)) {
      return true;
    }
  }

  return false;
}

/**
 * Detect SSR mode from environment.
 * Per SPEC.typ (ADR: SSR モード伝播):
 * Priority: options.mode → environment.name → options.ssr → default CSR
 *
 * Environment names:
 * - 'client': CSR mode
 * - 'ssr': SSR mode
 * - 'edge': SSR mode (Edge runtime)
 */
function detectMode(
  forcedMode?: "csr" | "ssr",
  environmentName?: string,
  optionsSsr?: boolean,
): "csr" | "ssr" {
  // User-specified mode takes highest priority
  if (forcedMode !== undefined) {
    return forcedMode;
  }

  // Vite Environment API (Vite 6+)
  if (environmentName === "ssr" || environmentName === "edge") {
    return "ssr";
  }
  if (environmentName === "client") {
    return "csr";
  }

  // Legacy options.ssr
  if (optionsSsr === true) {
    return "ssr";
  }

  // Default to CSR
  return "csr";
}

/**
 * Vite transform context with Environment API.
 */
interface ViteTransformContext extends UnpluginContext {
  environment?: {
    name: string;
  };
}

type PluginTransformOutput = {
  code: string;
  map?: TransformResult["map"];
};

type TsconfigPaths = Record<string, string[]>;

type SsrRenderModule = Record<string, unknown> & {
  default?: unknown;
  render?: unknown;
};

const tsconfigPathCache = new Map<string, TsconfigPaths | null>();
const require = createRequire(import.meta.url);

function parseLooseJson(text: string): unknown {
  return JSON.parse(text.replace(/,\s*([}\]])/g, "$1"));
}

function parseSourceMap(
  sourceMap: string | undefined,
): PluginTransformOutput["map"] | undefined {
  if (sourceMap === undefined) {
    return undefined;
  }

  const parsedSourceMap: unknown = JSON.parse(sourceMap);
  return isObjectRecord(parsedSourceMap)
    ? (parsedSourceMap as TransformResult["map"])
    : undefined;
}

function stripQueryAndHash(value: string): string {
  return value.split("?")[0]?.split("#")[0] ?? value;
}

function isObjectRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function normalizePathMappingValue(
  value: string,
  configDirectory: string,
): string {
  return value.replaceAll("${configDir}", configDirectory);
}

function resolveExtendsPath(
  configDirectory: string,
  extendsValue: string,
): string | null {
  if (extendsValue.startsWith(".") || extendsValue.startsWith("/")) {
    const directPath = path.resolve(configDirectory, extendsValue);
    if (fs.existsSync(directPath)) {
      return directPath;
    }

    const jsonPath = `${directPath}.json`;
    return fs.existsSync(jsonPath) ? jsonPath : null;
  }

  try {
    return require.resolve(extendsValue, { paths: [configDirectory] });
  } catch {
    return null;
  }
}

function findNearestTsconfigPath(importer: string): string | null {
  let currentDirectory = path.dirname(
    path.normalize(stripQueryAndHash(importer)),
  );

  for (;;) {
    const tsconfigPath = path.join(currentDirectory, "tsconfig.json");
    if (fs.existsSync(tsconfigPath)) {
      return tsconfigPath;
    }

    const parentDirectory = path.dirname(currentDirectory);
    if (parentDirectory === currentDirectory) {
      return null;
    }
    currentDirectory = parentDirectory;
  }
}

function readTsconfigPaths(
  tsconfigPath: string,
  sourceDirectory = path.dirname(tsconfigPath),
): TsconfigPaths | null {
  const cacheKey = `${tsconfigPath}::${sourceDirectory}`;
  const cachedPaths = tsconfigPathCache.get(cacheKey);
  if (cachedPaths !== undefined) {
    return cachedPaths;
  }

  try {
    const raw = fs.readFileSync(tsconfigPath, "utf8");
    const parsed = parseLooseJson(raw);
    if (!isObjectRecord(parsed)) {
      tsconfigPathCache.set(cacheKey, null);
      return null;
    }

    const configDirectory = path.dirname(tsconfigPath);
    const inheritedPaths: TsconfigPaths = {};
    const extendsValue = parsed.extends;

    if (typeof extendsValue === "string") {
      const extendedTsconfigPath = resolveExtendsPath(
        configDirectory,
        extendsValue,
      );
      if (extendedTsconfigPath !== null) {
        Object.assign(
          inheritedPaths,
          readTsconfigPaths(extendedTsconfigPath, sourceDirectory) ?? {},
        );
      }
    }

    const compilerOptions = parsed.compilerOptions;
    if (!isObjectRecord(compilerOptions)) {
      tsconfigPathCache.set(cacheKey, inheritedPaths);
      return inheritedPaths;
    }

    const paths = compilerOptions.paths;
    if (!isObjectRecord(paths)) {
      tsconfigPathCache.set(cacheKey, inheritedPaths);
      return inheritedPaths;
    }

    const normalizedPaths: TsconfigPaths = { ...inheritedPaths };
    for (const [key, value] of Object.entries(paths)) {
      if (
        Array.isArray(value) &&
        value.every((item) => typeof item === "string")
      ) {
        normalizedPaths[key] = value.map((item) =>
          normalizePathMappingValue(item, sourceDirectory),
        );
      }
    }

    tsconfigPathCache.set(cacheKey, normalizedPaths);
    return normalizedPaths;
  } catch {
    tsconfigPathCache.set(cacheKey, null);
    return null;
  }
}

function matchPathAlias(pattern: string, source: string): string | null {
  if (!pattern.includes("*")) {
    return source === pattern ? "" : null;
  }

  const [prefix, suffix = ""] = pattern.split("*");
  if (!source.startsWith(prefix) || !source.endsWith(suffix)) {
    return null;
  }

  return source.slice(prefix.length, source.length - suffix.length);
}

function resolveCandidateFilePath(basePath: string): string | null {
  const candidatePaths = [
    `${basePath}.ts`,
    `${basePath}.tsx`,
    `${basePath}.js`,
    `${basePath}.jsx`,
    path.join(basePath, "index.ts"),
    path.join(basePath, "index.tsx"),
    path.join(basePath, "index.js"),
    path.join(basePath, "index.jsx"),
    basePath,
  ];

  return (
    candidatePaths.find((candidatePath) => fs.existsSync(candidatePath)) ?? null
  );
}

function resolveLocalSourceAlias(
  importer: string,
  source: string,
): string | null {
  const tsconfigPath = findNearestTsconfigPath(importer);
  if (tsconfigPath === null) {
    return null;
  }

  const paths = readTsconfigPaths(tsconfigPath);
  if (paths === null) {
    return null;
  }

  const tsconfigDirectory = path.dirname(tsconfigPath);
  for (const [pattern, replacements] of Object.entries(paths)) {
    const wildcardValue = matchPathAlias(pattern, source);
    if (wildcardValue === null) {
      continue;
    }

    for (const replacement of replacements) {
      const replacementPath = replacement.replaceAll("*", wildcardValue);
      const basePath = path.resolve(tsconfigDirectory, replacementPath);
      const resolvedPath = resolveCandidateFilePath(basePath);
      if (resolvedPath !== null) {
        return resolvedPath;
      }
    }
  }

  return null;
}

function createRequestId(requestUrl: URL): string {
  return (
    requestUrl.searchParams.get("requestId") ??
    `dathra-${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`
  );
}

function shouldHandleSsrPath(pathname: string): boolean {
  if (pathname.startsWith("/@") || pathname.startsWith("/node_modules/")) {
    return false;
  }

  if (pathname === "/index.html") {
    return true;
  }

  return path.extname(pathname) === "";
}

function acceptsHtml(headers: IncomingHttpHeaders): boolean {
  const acceptHeader = headers.accept;
  const accept = Array.isArray(acceptHeader)
    ? acceptHeader.join(",")
    : (acceptHeader ?? "");

  return (
    accept === "" || accept.includes("text/html") || accept.includes("*/*")
  );
}

function isHtmlContentType(headers: Partial<Record<string, string>>): boolean {
  const contentType = headers["content-type"];
  return contentType === undefined || contentType.includes("text/html");
}

function getSsrRenderFunction(
  ssrModule: SsrRenderModule,
  exportName: string,
):
  | ((
      context: PluginSsrContext,
    ) => PluginSsrRenderResult | Promise<PluginSsrRenderResult>)
  | null {
  const candidate = ssrModule[exportName] ?? ssrModule.default;
  return typeof candidate === "function"
    ? (candidate as (
        context: PluginSsrContext,
      ) => PluginSsrRenderResult | Promise<PluginSsrRenderResult>)
    : null;
}

/* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-argument */
function createRequest(req: {
  method?: string;
  url?: string;
  headers: IncomingHttpHeaders;
}): Request {
  const rawHeaders = req.headers as Record<
    string,
    string | string[] | undefined
  >;
  const host = rawHeaders.host ?? "localhost";
  const normalizedHost = Array.isArray(host) ? host[0] : host;
  const requestUrl = new URL(req.url ?? "/", `http://${normalizedHost}`);
  const headers = new Headers();
  for (const [name, value] of Object.entries(rawHeaders)) {
    if (Array.isArray(value)) {
      for (const item of value) {
        headers.append(name, item);
      }
      continue;
    }
    if (value !== undefined) {
      headers.set(name, value);
    }
  }

  return new Request(requestUrl, {
    method: req.method ?? "GET",
    headers,
  });
}

function headersToRecord(
  headers: HeadersInit | undefined,
): Partial<Record<string, string>> {
  if (headers === undefined) {
    return {};
  }

  return Object.fromEntries(new Headers(headers).entries());
}

async function normalizeSsrRenderResult(
  result: PluginSsrRenderResult,
): Promise<{
  body: string;
  statusCode: number;
  headers: Partial<Record<string, string>>;
  template: boolean;
}> {
  if (typeof result === "string") {
    return { body: result, statusCode: 200, headers: {}, template: true };
  }

  if (result instanceof Response) {
    const headers = headersToRecord(result.headers);
    return {
      body: await result.text(),
      statusCode: result.status,
      headers,
      template: isHtmlContentType(headers),
    };
  }

  return {
    body: result.html,
    statusCode: result.statusCode ?? 200,
    headers: headersToRecord(result.headers),
    template: true,
  };
}

async function handleSsrDevRequest(
  vite: ViteDevServer,
  ssrOptions: PluginSsrOptions,
  outlet: string,
  renderExport: string,
  req: {
    method?: string;
    url?: string;
    headers: IncomingHttpHeaders;
  },
  res: {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    writeHead: any;
    end: (body?: string) => void;
  },
  next: (error?: unknown) => void,
): Promise<void> {
  if (req.method !== "GET" && req.method !== "HEAD") {
    next();
    return;
  }

  const requestUrl = new URL(req.url ?? "/", "http://localhost");
  if (!shouldHandleSsrPath(requestUrl.pathname)) {
    next();
    return;
  }

  const request = createRequest(req);
  const context: PluginSsrContext = {
    request,
    requestId: createRequestId(requestUrl),
    url: `${requestUrl.pathname}${requestUrl.search}`,
  };

  try {
    const ssrModule = (await vite.ssrLoadModule(
      ssrOptions.entry,
    )) as SsrRenderModule;
    const render = getSsrRenderFunction(ssrModule, renderExport);
    if (render === null) {
      throw new Error(
        `[dathra] SSR module does not export a ${renderExport}() or default render function`,
      );
    }

    const result = await normalizeSsrRenderResult(await render(context));
    if (!result.template) {
      res.writeHead(result.statusCode, {
        ...result.headers,
        "X-Dathra-Request-Id": context.requestId,
      });
      res.end(req.method === "HEAD" ? "" : result.body);
      return;
    }

    if (!acceptsHtml(req.headers)) {
      next();
      return;
    }

    if (req.method === "HEAD") {
      res.writeHead(result.statusCode, {
        "Content-Type": "text/html",
        ...result.headers,
        "X-Dathra-Request-Id": context.requestId,
      });
      res.end("");
      return;
    }

    let template = fs.readFileSync(
      path.resolve(vite.config.root, "index.html"),
      "utf-8",
    );
    template = await vite.transformIndexHtml(requestUrl.pathname, template);
    const html = template.replace(outlet, result.body);

    res.writeHead(result.statusCode, {
      "Content-Type": "text/html",
      ...result.headers,
      "X-Dathra-Request-Id": context.requestId,
    });
    res.end(html);
  } catch (error) {
    vite.ssrFixStacktrace(error as Error);
    next(error);
  }
}

function configureSsrDevServer(
  vite: ViteDevServer,
  ssrOptions: PluginSsrOptions,
): void {
  const outlet = ssrOptions.outlet ?? "<!--ssr-outlet-->";
  const renderExport = ssrOptions.renderExport ?? "render";

  // eslint-disable-next-line @typescript-eslint/no-misused-promises -- connect middleware returns void but processes async
  vite.middlewares.use(async (req, res, next) => {
    await handleSsrDevRequest(
      vite,
      ssrOptions,
      outlet,
      renderExport,
      req,
      res,
      next,
    );
  });
}

/**
 * Core transform function shared by all plugins.
 */
function doTransform(
  code: string,
  id: string,
  isSsr: boolean,
  environmentName: string | undefined,
  options: PluginOptions,
): PluginTransformOutput | null {
  if (!shouldTransform(id, options)) {
    return null;
  }

  try {
    const mode = detectMode(options.mode, environmentName, isSsr);

    const result = transform(code, {
      mode,
      sourceMap: true,
      filename: id,
      runtimeModule: options.runtimeModule ?? "@dathra/core",
    });

    const map = parseSourceMap(result.map);

    return map === undefined
      ? {
          code: result.code,
        }
      : {
          code: result.code,
          map,
        };
  } catch (error) {
    if (error instanceof Error) {
      error.message = `[dathra] Error transforming ${id}: ${error.message}`;
    }
    throw error;
  }
}

/**
 * Create the Dathra Vite plugin with proper SSR detection.
 * Vite's transform hook receives ssr option directly.
 */
function createVitePlugin(options: PluginOptions = {}): VitePlugin {
  return {
    name: "dathra",
    enforce: "pre",

    config(config: UserConfig): UserConfig {
      if (config.esbuild === false) {
        return { esbuild: false };
      }

      return {
        esbuild: {
          ...(typeof config.esbuild === "object" ? config.esbuild : {}),
          jsx: "preserve",
        },
      };
    },

    configureServer(vite: ViteDevServer) {
      if (options.ssr === undefined || options.ssr === false) {
        return;
      }

      configureSsrDevServer(vite, options.ssr);
    },

    resolveId(source: string, importer?: string) {
      if (importer === undefined) {
        return null;
      }

      return resolveLocalSourceAlias(importer, source);
    },

    transform(
      this: ViteTransformContext,
      code: string,
      id: string,
      transformOptions?: { ssr?: boolean },
    ) {
      const isSsr = transformOptions?.ssr ?? false;
      const environmentName = this.environment?.name;
      return doTransform(code, id, isSsr, environmentName, options);
    },
  };
}

/**
 * Create the Dathra unplugin factory for non-Vite bundlers.
 */
const unpluginFactory = createUnplugin((options: PluginOptions = {}) => {
  return {
    name: "dathra",

    transformInclude(id: string) {
      return shouldTransform(id, options);
    },

    transform(this: ViteTransformContext, code: string, id: string) {
      const environmentName = this.environment?.name;
      const isSsr = environmentName === "ssr" || environmentName === "edge";
      return doTransform(code, id, isSsr, environmentName, options);
    },
  };
});

/**
 * Universal dathra plugin (unplugin factory).
 */
const dathra = unpluginFactory;

/**
 * Vite plugin for Dathra with proper SSR detection.
 */
const dathraVitePlugin = createVitePlugin;

/**
 * Webpack plugin for Dathra.
 */
const dathraWebpackPlugin = dathra.webpack;

/**
 * Rollup plugin for Dathra.
 */
const dathraRollupPlugin = dathra.rollup;

/**
 * esbuild plugin for Dathra.
 */
const dathraEsbuildPlugin = dathra.esbuild;

export {
  dathra,
  dathraEsbuildPlugin,
  dathraRollupPlugin,
  dathraVitePlugin,
  dathraWebpackPlugin,
};
export type { PluginOptions };
export default dathra;
