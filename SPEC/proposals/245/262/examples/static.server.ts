import { defineRoute, el, txt } from "@dathra/core/server";

export default defineRoute({
  render(_request) {
    return el("main", {}, txt("Static page"));
  },
});
