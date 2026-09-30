import { defineRoute, occurrence, el, txt, bind, on } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";

export function createModel(initialCount = 7) {
  return {
    count: signal(initialCount),
    theme: signal("snapshot-midnight"),
  };
}
export type Model = ReturnType<typeof createModel>;

export default defineRoute({
  render(_request) {
    const state = createModel();
    return occurrence({
      state,
      values: { locale: "ja-JP" },
      view: el("article", {},
        el("p", {}, txt(`Theme: ${state.theme.value}`, bind("themeText"))),
        el("p", {}, txt(`Count: ${state.count.value}`, bind("countText"))),
        el("button", { type: "button", on: on("click", "increment") },
          txt("Increment snapshot count")),
      ),
    });
  },
});
