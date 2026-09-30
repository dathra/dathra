import { defineRoute, occurrence, el, txt, clientExports } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { themeText, countText } from "./snapshot.display";

const { bind, on } = clientExports<typeof import("./snapshot.client")>();

/** Initialize one server-owned counter for one occurrence. */
function createModel(initialCount = 7) {
  return {
    count: signal(initialCount),
    theme: signal("snapshot-midnight"),
  };
}
type Model = ReturnType<typeof createModel>;

/** Declare a reusable counter occurrence; this function is never run on client. */
function renderCounter(initialCount = 7, client = "counter") {
  const state = createModel(initialCount);
  return occurrence({
    client,
    state,
    values: { locale: "ja-JP" },
    view: el("article", {},
      el("p", {}, txt(themeText({ state }), bind("themeText"))),
      el("p", {}, txt(countText({ state }), bind("countText"))),
      el("button", { type: "button", on: on("click", "increment") },
        txt("Increment snapshot count")),
    ),
  });
}

export default defineRoute({
  render(_request) { return renderCounter(); },
});
export { createModel, renderCounter };
export type { Model };
