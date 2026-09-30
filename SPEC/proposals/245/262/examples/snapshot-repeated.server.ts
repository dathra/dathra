import { defineRoute, occurrence, el, txt, bind, on } from "@dathra/core/server";
import { createModel } from "./snapshot.server";

function renderCounter(initialCount: number) {
  const state = createModel(initialCount);
  return occurrence({
    state,
    values: { locale: "ja-JP" },
    view: el("article", {},
      el("p", {}, txt(`Count: ${state.count.value}`, bind("countText"))),
      el("button", { on: on("click", "increment") }, txt("Increment")),
    ),
  });
}

export default defineRoute({
  render(_request) {
    return el("main", {}, renderCounter(7), renderCounter(40));
  },
});
