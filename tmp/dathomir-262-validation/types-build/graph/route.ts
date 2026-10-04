import { defineRoute, el } from "@dathra/core/server";
import { Counter } from "./counter.server.js";
import { Widget as One } from "./one/widget.server.js";
import { Widget as Two } from "./two/widget.server.js";
const route = defineRoute({
  async render(request: Request) {
    if (new URL(request.url).searchParams.get("static") === "1")
      return el("article", {}, "server-only response");
    if (new URL(request.url).searchParams.get("static") === "2")
      return Counter({ start: 3, title: "Hidden", enabled: false }, request);
    return el(
      "main",
      {},
      await Counter({ start: 3, title: "Count" }, request),
      await One(undefined, request),
      await Two(undefined, request),
    );
  },
});
export { route };
