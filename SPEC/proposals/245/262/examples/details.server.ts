import { defineRoute, occurrence, el, txt, on, creation, request } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";

function createDetailsState() { return { count: signal(7) }; }
export type DetailsState = ReturnType<typeof createDetailsState>;

const detailsInput = {
  parse(value: unknown): { id: string } {
    if (typeof value !== "object" || value === null || !("id" in value) || typeof value.id !== "string") {
      throw new TypeError("details input requires a string id");
    }
    return { id: value.id };
  },
};
const detailsOutput = {
  parse(value: unknown): { label: string } {
    if (typeof value !== "object" || value === null || !("label" in value) || typeof value.label !== "string") {
      throw new TypeError("details output requires a string label");
    }
    return { label: value.label };
  },
};
export const detailsRequests = {
  details: request({
    input: detailsInput,
    output: detailsOutput,
    handle(input, context) { return { label: `${input.id} from ${context.request.url}` }; },
  }),
};
export type DetailsRequests = typeof detailsRequests;

export default defineRoute({
  render(_request) {
    const state = createDetailsState();
    return occurrence({
      state,
      values: { itemId: "item-1" },
      requests: detailsRequests,
      view: el("section", {},
        el("div", { create: creation("details") }),
        el("button", { on: on("click", "loadDetails") }, txt("Load")),
      ),
    });
  },
});
