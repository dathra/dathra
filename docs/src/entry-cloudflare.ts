/// <reference types="@cloudflare/workers-types" />

import render from "./entry-server";

type Env = {
  ASSETS: Fetcher;
};

function shouldServeAsAsset(pathname: string): boolean {
  return pathname.startsWith("/assets/") || /\.[a-z0-9]+$/i.test(pathname);
}

async function renderHtml(request: Request, env: Env): Promise<Response> {
  const templateResponse = await env.ASSETS.fetch(new URL("/index.html", request.url));
  if (!templateResponse.ok) {
    return new Response("Missing docs HTML template", { status: 500 });
  }

  const result = await render({
    request,
    requestId: crypto.randomUUID(),
    url: request.url,
  });
  const template = await templateResponse.text();
  const html = template.replace("<!--ssr-outlet-->", result.html);

  return new Response(request.method === "HEAD" ? null : html, {
    status: result.statusCode ?? 200,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
    },
  });
}

const worker: ExportedHandler<Env> = {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (shouldServeAsAsset(url.pathname)) {
      return env.ASSETS.fetch(request);
    }

    if (request.method !== "GET" && request.method !== "HEAD") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: { Allow: "GET, HEAD" },
      });
    }

    try {
      return await renderHtml(request, env);
    } catch (error) {
      console.error("[docs:cloudflare] Render error", error);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
};

export default worker;
