import { describe, expect, it } from "vitest";

type ServerRenderContext = {
  request: Request;
  requestId: string;
  url: string;
};

type HtmlRenderResult = {
  html: string;
  statusCode?: number;
};

function isServerEntryModule(value: unknown): value is {
  default: (context: ServerRenderContext) => unknown;
} {
  return (
    typeof value === "object" &&
    value !== null &&
    "default" in value &&
    typeof value.default === "function"
  );
}

function isHtmlRenderResult(value: unknown): value is HtmlRenderResult {
  return (
    typeof value === "object" &&
    value !== null &&
    "html" in value &&
    typeof value.html === "string" &&
    (!("statusCode" in value) ||
      value.statusCode === undefined ||
      typeof value.statusCode === "number")
  );
}

async function renderProductionRoute(pathname: string): Promise<{
  html: string;
  status: number;
}> {
  const serverBundleUrl = new URL("../dist/server/entry-server.js", import.meta.url);
  const serverEntryModule: unknown = await import(serverBundleUrl.href);

  if (!isServerEntryModule(serverEntryModule)) {
    throw new TypeError("The production server bundle has no default render entry.");
  }

  const result: unknown = await serverEntryModule.default({
    request: new Request(`http://localhost${pathname}`),
    requestId: "docs-vg01",
    url: pathname,
  });

  if (result instanceof Response) {
    return { html: await result.text(), status: result.status };
  }

  if (!isHtmlRenderResult(result)) {
    throw new TypeError("The production server entry returned an invalid result.");
  }

  return { html: result.html, status: result.statusCode ?? 200 };
}

describe("docs production server entry", () => {
  it("renders the overview route with declarative shadow DOM", async () => {
    const result = await renderProductionRoute("/");

    expect(result.status).toBe(200);
    expect(result.html).toContain('<dathra-docs routePath="/"');
    expect(result.html).toContain('<template shadowrootmode="open">');
    expect(result.html).toContain("<h1>Dathra</h1>");
  });
});
