import { clearGlobalStyles } from "@dathra/components";
import { defineSsrEntry, render as renderSSR } from "@dathra/core/ssr";

import { SSRAppRoot } from "./SSRAppRoot";
import { runParallelIsolationProbe } from "./alsDiagnostics";
import { createDemoStore } from "./demoStore";
import { createPagePayload } from "./pageServerData";
import {
  getPlaygroundRoute,
  normalizePlaygroundPath,
  type PlaygroundRoutePath,
} from "./routes";

function renderClientFallback(routePath: PlaygroundRoutePath): string {
  return `<playground-ssr-app routePath="${routePath}"></playground-ssr-app>`;
}

/**
 * Render the application to HTML string for SSR.
 */
const render = defineSsrEntry(async ({ request, requestId }) => {
  const url = new URL(request.url);

  if (url.pathname === "/api/als/parallel") {
    return Response.json(await runParallelIsolationProbe(), {
      headers: { "Cache-Control": "no-store" },
    });
  }

  clearGlobalStyles();

  const route = getPlaygroundRoute(normalizePlaygroundPath(url.pathname));

  if (route === undefined) {
    return {
      html: renderClientFallback("/"),
      statusCode: 404,
    };
  }

  const routePath = route.path as PlaygroundRoutePath;

  try {
    const requestStore = createDemoStore({
      appId: `playground-ssr-${routePath === "/" ? "overview" : routePath.slice(1)}-${requestId}`,
      count: 3,
      theme: "light",
    });
    const pagePayloadJson = await createPagePayload({
      routePath,
      requestId,
      requestStore,
    });

    return {
      html: renderSSR(
        SSRAppRoot,
        {
          requestId,
          requestStoreAppId: requestStore.appId,
          routePath,
          pagePayloadJson,
        },
        { store: requestStore },
      ),
    };
  } catch (error) {
    console.error("[playground:ssr] Failed to render SSR route", error);
    return {
      html: renderClientFallback(routePath),
      statusCode: 500,
    };
  } finally {
    clearGlobalStyles();
  }
});

/**
 * Render the application to HTML string for direct SSR calls.
 */
export async function renderRoute(
  routePath: PlaygroundRoutePath,
  context: { requestId?: string } = {},
): Promise<string> {
  const result = await render({
    request: new Request(`http://localhost${routePath}`),
    requestId: context.requestId ?? "page-request",
    url: routePath,
  });
  return result.html;
}

export { render as default };
