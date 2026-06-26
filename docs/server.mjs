import fs from "node:fs";
import { createServer } from "node:http";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const rootDir = path.dirname(fileURLToPath(import.meta.url));
const clientDir = path.join(rootDir, "dist/client");
const serverEntryPath = path.join(rootDir, "dist/server/entry-server.js");
const templatePath = path.join(clientDir, "index.html");
const port = Number(process.env.PORT ?? 4080);

const contentTypes = new Map([
  [".css", "text/css; charset=utf-8"],
  [".html", "text/html; charset=utf-8"],
  [".js", "text/javascript; charset=utf-8"],
  [".json", "application/json; charset=utf-8"],
  [".map", "application/json; charset=utf-8"],
  [".svg", "image/svg+xml"],
  [".woff", "font/woff"],
  [".woff2", "font/woff2"],
]);

function assertBuildOutput() {
  for (const filePath of [templatePath, serverEntryPath]) {
    if (!fs.existsSync(filePath)) {
      throw new Error(
        `[docs] Missing ${path.relative(rootDir, filePath)}. Run \`pnpm --filter @dathra/docs build\` first.`,
      );
    }
  }
}

function resolveStaticPath(pathname) {
  const normalized = path.normalize(decodeURIComponent(pathname)).replace(/^\/+/, "");
  const filePath = path.join(clientDir, normalized);

  if (!filePath.startsWith(clientDir + path.sep) || !fs.existsSync(filePath)) {
    return null;
  }

  const stat = fs.statSync(filePath);
  return stat.isFile() ? filePath : null;
}

function serveStatic(res, filePath) {
  res.writeHead(200, {
    "Content-Type": contentTypes.get(path.extname(filePath)) ?? "application/octet-stream",
  });
  res.end(fs.readFileSync(filePath));
}

async function loadRender() {
  const entryUrl = pathToFileURL(serverEntryPath);
  entryUrl.searchParams.set("t", String(fs.statSync(serverEntryPath).mtimeMs));
  const mod = await import(entryUrl.href);
  return mod.default;
}

async function renderDocument(requestUrl) {
  const template = fs.readFileSync(templatePath, "utf-8");
  const render = await loadRender();
  const result = await render({
    request: new Request(requestUrl),
  });

  return {
    html: template.replace("<!--ssr-outlet-->", result.html),
    statusCode: result.statusCode ?? 200,
  };
}

assertBuildOutput();

const server = createServer(async (req, res) => {
  const requestUrl = new URL(req.url ?? "/", `http://${req.headers.host ?? "localhost"}`);
  const staticPath = resolveStaticPath(requestUrl.pathname);

  try {
    if (staticPath !== null) {
      serveStatic(res, staticPath);
      return;
    }

    const result = await renderDocument(requestUrl.href);
    res.writeHead(result.statusCode, { "Content-Type": "text/html; charset=utf-8" });
    res.end(result.html);
  } catch (error) {
    console.error(error);
    res.writeHead(500, { "Content-Type": "text/plain; charset=utf-8" });
    res.end(error instanceof Error ? error.message : String(error));
  }
});

server.listen(port, "0.0.0.0", () => {
  console.log(`Docs SSR preview at http://0.0.0.0:${port}`);
});
