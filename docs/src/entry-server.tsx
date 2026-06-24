import { clearGlobalStyles } from "@dathra/components";
import { defineSsrEntry, render as renderSSR } from "@dathra/core/ssr";

import { DocsAppRoot } from "./DocsAppRoot";
import { getDocRoute, normalizeDocPath } from "./routes";
import { prepareSyntaxHighlighting } from "./syntaxHighlight";

const render = defineSsrEntry(async ({ request }) => {
  const url = new URL(request.url);
  await prepareSyntaxHighlighting();
  clearGlobalStyles();

  const routePath = normalizeDocPath(url.pathname);
  const route = getDocRoute(routePath);

  try {
    if (route === undefined) {
      return {
        html: renderSSR(DocsAppRoot, { routePath: "/", requestStoreAppId: "dathra-docs-404" }),
        statusCode: 404,
      };
    }

    return {
      html: renderSSR(DocsAppRoot, {
        routePath,
        requestStoreAppId: `dathra-docs-${routePath === "/" ? "overview" : routePath.slice(1)}`,
      }),
    };
  } catch (error) {
    console.error("[docs:ssr] Render error", error);
    return {
      html: renderSSR(DocsAppRoot, { routePath: "/", requestStoreAppId: "dathra-docs-error" }),
      statusCode: 500,
    };
  } finally {
    clearGlobalStyles();
  }
});

export default render;
