import http from "node:http";
import handler from "./dist/server/entry-server.js";

const server = http.createServer(async (_req, res) => {
  try {
    const result = await handler({
      request: new Request("http://localhost/"),
      requestId: "curl-001",
      url: "/",
    });
    const html = `<!doctype html><html><head><meta charset="utf-8"></head><body><div id="app">${result.html}</div></body></html>`;
    res.writeHead(200, { "Content-Type": "text/html; charset=utf-8" });
    res.end(html);
  } catch (err) {
    res.writeHead(500);
    res.end(String(err));
  }
});

server.listen(5174, "0.0.0.0", () => {
  console.log("SSR preview at http://0.0.0.0:5174");
});
