import { defineRoute, el } from "@dathra/core/server";
import { renderCounter } from "./snapshot.server";

export default defineRoute({
  render(_request) {
    return el("main", {}, renderCounter(7), renderCounter(40));
  },
});
