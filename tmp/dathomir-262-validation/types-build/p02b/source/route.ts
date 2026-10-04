import { defineRoute } from "@dathra/core/server";
import { Counter } from "./counter.server.js";
import { Wrong } from "./wrong.server.js";
const route = defineRoute({
  render(request: Request) {
    const mode = new URL(request.url).searchParams.get("mode");
    if (mode === "wrong") return Wrong(undefined, request);
    return Counter({ visible: mode !== "zero" }, request);
  },
});
export { route };
