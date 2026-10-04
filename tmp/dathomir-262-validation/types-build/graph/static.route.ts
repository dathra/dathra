import { defineRoute, el } from "@dathra/core/server";
const route = defineRoute({
  render() {
    return el("article", {}, "static-only route");
  },
});
export { route };
