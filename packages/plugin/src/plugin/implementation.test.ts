import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { describe, expect, it, vi } from "vitest";

import { transform } from "@dathra/transformer";

vi.mock("@dathra/transformer", () => ({
  transform: vi.fn(() => ({
    code: "transformed",
    map: '{"version":3}',
  })),
}));

/**
 * Plugin internal helpers are not directly exported,
 * so we test via the exported plugin factories.
 */
import {
  dathra,
  dathraEsbuildPlugin,
  dathraRollupPlugin,
  dathraVitePlugin,
  dathraWebpackPlugin,
  type PluginOptions,
} from "./implementation";

const actualTransformer = await vi.importActual<TransformerModule>(
  "@dathra/transformer",
);

type RollupLikePlugin = {
  transformInclude: (id: string) => boolean;
  transform: (
    this: { environment?: { name: string } },
    code: string,
    id: string,
  ) => PluginTransformOutput | null;
};

type PluginTransformOutput = {
  code: string;
  map?: unknown;
};

type ViteTransformHook = (
  this: { environment?: { name: string } },
  code: string,
  id: string,
  transformOptions?: { ssr?: boolean },
) => PluginTransformOutput | null;

type ViteResolveIdHook = (
  this: unknown,
  source: string,
  importer?: string,
) => string | null | Promise<string | null>;

type ViteConfigHook = (config: {
  esbuild?: false | Record<string, unknown>;
}) => { esbuild?: false | Record<string, unknown> };

type Middleware = (
  req: {
    method?: string;
    url?: string;
    headers: { accept?: string | string[]; host?: string | string[] };
  },
  res: {
    writeHead: ReturnType<typeof vi.fn>;
    end: ReturnType<typeof vi.fn>;
  },
  next: (error?: unknown) => void,
) => void | Promise<void>;

type ViteConfigureServerHook = (server: {
  config: { root: string };
  middlewares: { use: (middleware: Middleware) => void };
  ssrFixStacktrace: ReturnType<typeof vi.fn>;
  ssrLoadModule: ReturnType<typeof vi.fn>;
  transformIndexHtml: ReturnType<typeof vi.fn>;
}) => void;

type SsrRenderMock = ReturnType<
  typeof vi.fn<
    (context: { request: Request; requestId: string; url: string }) =>
      | string
      | Response
      | { html: string; statusCode?: number; headers?: Record<string, string> }
      | Promise<
          | string
          | Response
          | {
              html: string;
              statusCode?: number;
              headers?: Record<string, string>;
            }
        >
  >
>;

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../../../..",
);

function requireTransformResult(
  result: PluginTransformOutput | null,
): PluginTransformOutput {
  if (result === null) {
    throw new Error("Expected plugin transform to return a result");
  }

  return result;
}

function invokeViteTransform(
  plugin: ReturnType<typeof dathraVitePlugin>,
  code: string,
  id: string,
  transformOptions: { ssr?: boolean } = {},
  context: { environment?: { name: string } } = {},
): PluginTransformOutput | null {
  const transformHook = plugin.transform as ViteTransformHook;
  return transformHook.call(context, code, id, transformOptions);
}

async function invokeResolveId(
  plugin: ReturnType<typeof dathraVitePlugin>,
  source: string,
  importer?: string,
): Promise<string | null> {
  const resolveId = plugin.resolveId as ViteResolveIdHook;
  return await resolveId.call({}, source, importer);
}

function invokeViteConfig(
  plugin: ReturnType<typeof dathraVitePlugin>,
  config = {},
) {
  const configHook = plugin.config as ViteConfigHook;
  return configHook(config);
}

function createSsrDevServerHarness(
  plugin: ReturnType<typeof dathraVitePlugin>,
  renderResult:
    | string
    | Response
    | {
        html: string;
        statusCode?: number;
        headers?: Record<string, string>;
      } = "<main>app</main>",
) {
  let middleware: Middleware = () => {
    throw new Error("Expected configureServer to install middleware");
  };
  const render: SsrRenderMock = vi.fn(
    async () => await Promise.resolve(renderResult),
  );
  const server = {
    config: { root: "/project" },
    middlewares: {
      use: vi.fn((handler: Middleware) => {
        middleware = handler;
      }),
    },
    ssrFixStacktrace: vi.fn(),
    ssrLoadModule: vi.fn(
      async () =>
        await Promise.resolve({
          render,
        }),
    ),
    transformIndexHtml: vi.fn(
      async (_path: string, html: string) => await Promise.resolve(html),
    ),
  };
  const configureServer =
    plugin.configureServer as unknown as ViteConfigureServerHook;

  configureServer(server);

  return { middleware, render, server };
}

describe("plugin", () => {
  describe("exports", () => {
    it("should export dathra unplugin factory", () => {
      expect(dathra).toBeDefined();
    });

    it("should export dathraVitePlugin", () => {
      expect(dathraVitePlugin).toBeDefined();
      expect(typeof dathraVitePlugin).toBe("function");
    });

    it("should export dathraWebpackPlugin", () => {
      expect(dathraWebpackPlugin).toBeDefined();
    });

    it("should export dathraRollupPlugin", () => {
      expect(dathraRollupPlugin).toBeDefined();
    });

    it("should export dathraEsbuildPlugin", () => {
      expect(dathraEsbuildPlugin).toBeDefined();
    });
  });

  describe("dathraVitePlugin", () => {
    it("should create a Vite plugin with correct name", () => {
      const plugin = dathraVitePlugin();
      expect(plugin).toBeDefined();
      expect(plugin.name).toBe("dathra");
    });

    it("should set enforce to pre", () => {
      const plugin = dathraVitePlugin();
      expect(plugin.enforce).toBe("pre");
    });

    it("should have a transform function", () => {
      const plugin = dathraVitePlugin();
      expect(typeof plugin.transform).toBe("function");
    });

    it("should preserve JSX before esbuild transforms it", () => {
      const plugin = dathraVitePlugin();

      expect(invokeViteConfig(plugin)).toEqual({
        esbuild: { jsx: "preserve" },
      });
    });

    it("should keep existing esbuild options when preserving JSX", () => {
      const plugin = dathraVitePlugin();

      expect(
        invokeViteConfig(plugin, {
          esbuild: { target: "es2022" },
        }),
      ).toEqual({
        esbuild: { target: "es2022", jsx: "preserve" },
      });
    });

    it("should preserve esbuild: false when explicitly set", () => {
      const plugin = dathraVitePlugin();

      expect(invokeViteConfig(plugin, { esbuild: false })).toEqual({
        esbuild: false,
      });
    });

    it("should only allow ssr options when mode is ssr", () => {
      const validOptions = {
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      } satisfies PluginOptions;

      const invalidOptions = {
        ssr: { entry: "/src/entry-server.tsx" },
        // @ts-expect-error ssr options require mode: "ssr"
      } satisfies PluginOptions;

      expect(validOptions.ssr.entry).toBe("/src/entry-server.tsx");
      expect(invalidOptions.ssr.entry).toBe("/src/entry-server.tsx");
    });

    it("should not install SSR dev middleware without ssr options", () => {
      const plugin = dathraVitePlugin();
      const server = {
        config: { root: "/project" },
        middlewares: { use: vi.fn() },
        ssrFixStacktrace: vi.fn(),
        ssrLoadModule: vi.fn(),
        transformIndexHtml: vi.fn(),
      };
      const configureServer =
        plugin.configureServer as unknown as ViteConfigureServerHook;

      configureServer(server);

      expect(server.middlewares.use).not.toHaveBeenCalled();
    });

    it("should render HTML through configured SSR dev middleware", async () => {
      const readFileSyncSpy = vi
        .spyOn(fs, "readFileSync")
        .mockReturnValueOnce("<html><!--ssr-outlet--></html>");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware, server } = createSsrDevServerHarness(plugin);
      const res = { writeHead: vi.fn(), end: vi.fn() };
      const next = vi.fn();

      await middleware(
        {
          method: "GET",
          url: "/docs?requestId=req-1",
          headers: { accept: "text/html" },
        },
        res,
        next,
      );

      expect(server.ssrLoadModule).toHaveBeenCalledWith(
        "/src/entry-server.tsx",
      );
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ "X-Dathra-Request-Id": "req-1" }),
      );
      expect(res.end).toHaveBeenCalledWith("<html><main>app</main></html>");
      expect(next).not.toHaveBeenCalled();

      readFileSyncSpy.mockRestore();
    });

    it("should not send a body for HEAD SSR responses", async () => {
      const readFileSyncSpy = vi.spyOn(fs, "readFileSync");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware, server } = createSsrDevServerHarness(plugin, {
        html: "<main>head</main>",
        statusCode: 204,
        headers: { "X-Route-Status": "head" },
      });
      const res = { writeHead: vi.fn(), end: vi.fn() };

      await middleware(
        {
          method: "HEAD",
          url: "/docs?requestId=req-head",
          headers: { accept: "text/html" },
        },
        res,
        vi.fn(),
      );

      expect(server.transformIndexHtml).not.toHaveBeenCalled();
      expect(readFileSyncSpy).not.toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(
        204,
        expect.objectContaining({
          "Content-Type": "text/html",
          "x-route-status": "head",
          "X-Dathra-Request-Id": "req-head",
        }),
      );
      expect(res.end).toHaveBeenCalledWith("");

      readFileSyncSpy.mockRestore();
    });

    it("should pass a Request and context to SSR render", async () => {
      const readFileSyncSpy = vi
        .spyOn(fs, "readFileSync")
        .mockReturnValueOnce("<html><!--ssr-outlet--></html>");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware, render } = createSsrDevServerHarness(plugin);
      const res = { writeHead: vi.fn(), end: vi.fn() };

      await middleware(
        {
          method: "GET",
          url: "/users/1?requestId=req-2",
          headers: { accept: "text/html", host: "example.test" },
        },
        res,
        vi.fn(),
      );

      expect(render).toHaveBeenCalledWith(
        expect.objectContaining({
          requestId: "req-2",
          url: "/users/1?requestId=req-2",
        }),
      );
      const firstCall = render.mock.calls[0];
      // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition -- defense against empty mock calls array
      if (firstCall === undefined) {
        throw new Error("Expected SSR render to be called");
      }
      const request = firstCall[0].request;
      expect(request).toBeInstanceOf(Request);
      expect(request.url).toBe("http://example.test/users/1?requestId=req-2");

      readFileSyncSpy.mockRestore();
    });

    it("should apply status code and headers from object SSR results", async () => {
      const readFileSyncSpy = vi
        .spyOn(fs, "readFileSync")
        .mockReturnValueOnce("<html><!--ssr-outlet--></html>");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware } = createSsrDevServerHarness(plugin, {
        html: "<main>missing</main>",
        statusCode: 404,
        headers: { "X-Route-Status": "not-found" },
      });
      const res = { writeHead: vi.fn(), end: vi.fn() };

      await middleware(
        {
          method: "GET",
          url: "/missing",
          headers: { accept: "text/html" },
        },
        res,
        vi.fn(),
      );

      expect(res.writeHead).toHaveBeenCalledWith(
        404,
        expect.objectContaining({ "x-route-status": "not-found" }),
      );
      expect(res.end).toHaveBeenCalledWith("<html><main>missing</main></html>");

      readFileSyncSpy.mockRestore();
    });

    it("should apply status code and headers from Response SSR results", async () => {
      const readFileSyncSpy = vi
        .spyOn(fs, "readFileSync")
        .mockReturnValueOnce("<html><!--ssr-outlet--></html>");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware } = createSsrDevServerHarness(
        plugin,
        new Response("<main>redirect</main>", {
          status: 302,
          headers: { "Content-Type": "text/html", Location: "/login" },
        }),
      );
      const res = { writeHead: vi.fn(), end: vi.fn() };

      await middleware(
        {
          method: "GET",
          url: "/private",
          headers: { accept: "text/html" },
        },
        res,
        vi.fn(),
      );

      expect(res.writeHead).toHaveBeenCalledWith(
        302,
        expect.objectContaining({ location: "/login" }),
      );
      expect(res.end).toHaveBeenCalledWith(
        "<html><main>redirect</main></html>",
      );

      readFileSyncSpy.mockRestore();
    });

    it("should return non-HTML Response SSR results without index template", async () => {
      const readFileSyncSpy = vi.spyOn(fs, "readFileSync");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware, server } = createSsrDevServerHarness(
        plugin,
        new Response(JSON.stringify({ isolated: true }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
      const res = { writeHead: vi.fn(), end: vi.fn() };

      await middleware(
        {
          method: "GET",
          url: "/api/als/parallel",
          headers: { accept: "text/html" },
        },
        res,
        vi.fn(),
      );

      expect(server.transformIndexHtml).not.toHaveBeenCalled();
      expect(readFileSyncSpy).not.toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ "content-type": "application/json" }),
      );
      expect(res.end).toHaveBeenCalledWith('{"isolated":true}');

      readFileSyncSpy.mockRestore();
    });

    it("should skip SSR dev middleware for non-HTML requests", async () => {
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware, server } = createSsrDevServerHarness(plugin);
      const next = vi.fn();

      await middleware(
        {
          method: "GET",
          url: "/src/main.ts",
          headers: { accept: "application/javascript" },
        },
        { writeHead: vi.fn(), end: vi.fn() },
        next,
      );

      expect(server.ssrLoadModule).not.toHaveBeenCalled();
      expect(next).toHaveBeenCalledWith();
    });

    it("should return non-HTML Response SSR results for Accept: */* requests", async () => {
      const readFileSyncSpy = vi.spyOn(fs, "readFileSync");
      const plugin = dathraVitePlugin({
        mode: "ssr",
        ssr: { entry: "/src/entry-server.tsx" },
      });
      const { middleware, server } = createSsrDevServerHarness(
        plugin,
        new Response(JSON.stringify({ ok: true }), {
          headers: { "Content-Type": "application/json" },
        }),
      );
      const next = vi.fn();
      const res = { writeHead: vi.fn(), end: vi.fn() };

      await middleware(
        {
          method: "GET",
          url: "/api/users",
          headers: { accept: "*/*" },
        },
        res,
        next,
      );

      expect(server.ssrLoadModule).toHaveBeenCalledWith(
        "/src/entry-server.tsx",
      );
      expect(server.transformIndexHtml).not.toHaveBeenCalled();
      expect(readFileSyncSpy).not.toHaveBeenCalled();
      expect(res.writeHead).toHaveBeenCalledWith(
        200,
        expect.objectContaining({ "content-type": "application/json" }),
      );
      expect(res.end).toHaveBeenCalledWith('{"ok":true}');
      expect(next).not.toHaveBeenCalled();

      readFileSyncSpy.mockRestore();
    });

    it("should transform TSX files", () => {
      const plugin = dathraVitePlugin();
      const result = requireTransformResult(
        invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {}),
      );

      expect(transform).toHaveBeenCalled();
      expect(result.code).toBe("transformed");
    });

    it("should transform JSX files", () => {
      const plugin = dathraVitePlugin();
      const result = invokeViteTransform(
        plugin,
        "const x = <div />;",
        "component.jsx",
        {},
      );

      expect(transform).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should skip non-JSX/TSX files", () => {
      const plugin = dathraVitePlugin();
      const result = invokeViteTransform(
        plugin,
        "const x = 1;",
        "module.ts",
        {},
      );

      expect(result).toBeNull();
    });

    it("should skip excluded files", () => {
      const plugin = dathraVitePlugin({
        exclude: ["node_modules"],
      });
      const result = invokeViteTransform(
        plugin,
        "const x = <div />;",
        "node_modules/lib/component.tsx",
        {},
      );

      expect(result).toBeNull();
    });

    it("should transform files that do not match the exclude pattern", () => {
      const plugin = dathraVitePlugin({
        exclude: ["node_modules"],
      });
      const result = requireTransformResult(
        invokeViteTransform(
          plugin,
          "const x = <div />;",
          "src/component.tsx",
          {},
        ),
      );

      expect(result.code).toBe("transformed");
    });

    it("should respect custom include extensions", () => {
      const plugin = dathraVitePlugin({
        include: [".tsx"],
      });

      const tsxResult = invokeViteTransform(
        plugin,
        "const x = <div />;",
        "component.tsx",
        {},
      );
      expect(tsxResult).toBeDefined();
      expect(tsxResult).not.toBeNull();

      const jsxResult = invokeViteTransform(
        plugin,
        "const x = <div />;",
        "component.jsx",
        {},
      );
      expect(jsxResult).toBeNull();
    });

    it("should pass SSR flag from Vite transform options", () => {
      const plugin = dathraVitePlugin();
      invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {
        ssr: true,
      });

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "ssr" }),
      );
    });

    it("should default to CSR mode", () => {
      const plugin = dathraVitePlugin();
      invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {});

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "csr" }),
      );
    });

    it("should use forced mode over SSR flag", () => {
      const plugin = dathraVitePlugin({ mode: "ssr" });
      invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {});

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "ssr" }),
      );
    });

    it("should pass custom runtimeModule to transformer", () => {
      const plugin = dathraVitePlugin({ runtimeModule: "custom-runtime" });
      invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {});

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ runtimeModule: "custom-runtime" }),
      );
    });

    it("should pass filename to transformer", () => {
      const plugin = dathraVitePlugin();
      invokeViteTransform(
        plugin,
        "const x = <div />;",
        "/path/to/component.tsx",
        {},
      );

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ filename: "/path/to/component.tsx" }),
      );
    });

    it("should wrap transform errors with filename", () => {
      vi.mocked(transform).mockImplementationOnce(() => {
        throw new Error("Parse error");
      });

      const plugin = dathraVitePlugin();

      expect(() => {
        invokeViteTransform(
          plugin,
          "const x = <div />;",
          "/path/to/component.tsx",
          {},
        );
      }).toThrow("[dathra] Error transforming /path/to/component.tsx");
    });

    it("should rethrow non-Error objects as-is", () => {
      const nonErrorThrow = "string error" as unknown as Error;
      vi.mocked(transform).mockImplementationOnce(() => {
        // eslint-disable-next-line no-throw-literal -- intentional coverage for passthrough behavior
        throw nonErrorThrow;
      });

      const plugin = dathraVitePlugin();

      expect(() => {
        invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {});
      }).toThrow(nonErrorThrow);
    });

    it("should return undefined map when transformer returns no source map", () => {
      vi.mocked(transform).mockImplementationOnce(() => ({
        code: "transformed",
        map: undefined,
      }));

      const plugin = dathraVitePlugin();
      const result = requireTransformResult(
        invokeViteTransform(plugin, "const x = <div />;", "component.tsx", {}),
      );

      expect(result.map).toBeUndefined();
    });

    it("should preserve the islands metadata contract through real transformer output", () => {
      vi.mocked(transform).mockImplementation(actualTransformer.transform);

      const plugin = dathraVitePlugin();
      const result = requireTransformResult(
        invokeViteTransform(
          plugin,
          'const island = <Counter client:interaction="mouseenter" />; const button = <button visible:onClick={() => doThing()}>Run</button>;',
          "component.tsx",
          {},
        ),
      );

      expect(result.code).toContain('"data-dh-island": "interaction"');
      expect(result.code).toContain('"data-dh-island-value": "mouseenter"');
      expect(result.code).toContain("data-dh-client-target");
      expect(result.code).toContain("data-dh-client-strategy");
      expect(result.code).toContain("visible");
    });

    it("should resolve package-local @/ imports using the nearest tsconfig paths", async () => {
      const plugin = dathraVitePlugin();
      const importer = path.join(repoRoot, "packages/components/src/index.ts");
      const expected = path.join(
        repoRoot,
        "packages/components/src/css/implementation.ts",
      );

      const resolved = await invokeResolveId(
        plugin,
        "@/css/implementation",
        importer,
      );

      expect(resolved).toBe(expected);
    });

    it("should resolve directory aliases to index.ts using tsconfig paths", async () => {
      const plugin = dathraVitePlugin();
      const importer = path.join(repoRoot, "packages/runtime/src/index.ts");
      const expected = path.join(repoRoot, "packages/runtime/src/ssr/index.ts");

      const resolved = await invokeResolveId(plugin, "@/ssr", importer);

      expect(resolved).toBe(expected);
    });

    it("should ignore aliases when no matching tsconfig path mapping exists", async () => {
      const plugin = dathraVitePlugin();
      const importer = path.join(repoRoot, "packages/runtime/src/index.ts");

      const resolved = await invokeResolveId(plugin, "#internal/foo", importer);

      expect(resolved).toBeNull();
    });
  });

  describe("edge mode detection", () => {
    it("should detect SSR mode from edge environment name", () => {
      const plugin = dathraVitePlugin();
      const context = {
        environment: { name: "edge" },
      };

      invokeViteTransform(
        plugin,
        "const x = <div />;",
        "component.tsx",
        {},
        context,
      );

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "ssr" }),
      );
    });

    it("should detect CSR mode from client environment name", () => {
      const plugin = dathraVitePlugin();
      const context = {
        environment: { name: "client" },
      };

      invokeViteTransform(
        plugin,
        "const x = <div />;",
        "component.tsx",
        {},
        context,
      );

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "csr" }),
      );
    });
  });

  describe("unplugin rollup factory (non-Vite bundlers)", () => {
    it("should include JSX/TSX files via transformInclude", () => {
      const plugin = dathraRollupPlugin({}) as unknown as RollupLikePlugin;

      expect(plugin.transformInclude("component.tsx")).toBe(true);
      expect(plugin.transformInclude("component.jsx")).toBe(true);
    });

    it("should exclude non-JSX/TSX files via transformInclude", () => {
      const plugin = dathraRollupPlugin({}) as unknown as RollupLikePlugin;

      expect(plugin.transformInclude("module.ts")).toBe(false);
      expect(plugin.transformInclude("styles.css")).toBe(false);
    });

    it("should transform JSX/TSX files via transform hook", () => {
      const plugin = dathraRollupPlugin({}) as unknown as RollupLikePlugin;
      const transformHook = plugin.transform;

      const result = transformHook.call(
        {},
        "const x = <div />;",
        "component.tsx",
      );

      expect(transform).toHaveBeenCalled();
      expect(result).toBeDefined();
    });

    it("should detect SSR mode from ssr environment name in unplugin transform", () => {
      const plugin = dathraRollupPlugin({}) as unknown as RollupLikePlugin;
      const transformHook = plugin.transform;

      transformHook.call(
        { environment: { name: "ssr" } },
        "const x = <div />;",
        "component.tsx",
      );

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "ssr" }),
      );
    });

    it("should detect SSR mode from edge environment name in unplugin transform", () => {
      const plugin = dathraRollupPlugin({}) as unknown as RollupLikePlugin;
      const transformHook = plugin.transform;

      transformHook.call(
        { environment: { name: "edge" } },
        "const x = <div />;",
        "component.tsx",
      );

      expect(transform).toHaveBeenCalledWith(
        "const x = <div />;",
        expect.objectContaining({ mode: "ssr" }),
      );
    });
  });
});
type TransformerModule = {
  transform: typeof transform;
};
