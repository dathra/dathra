import { defineClient, el } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import { signal } from "@dathra/reactivity";
import { parseRow } from "./row-input.js";
import type { RowInput } from "./row-input.js";
let initialized = 0;
function initialize(input: RowInput) {
  initialized++;
  return { draft: signal(input.label), id: input.id };
}
type Values = ReturnType<typeof initialize>;
function draftText(ctx: ClientContext<Values>) {
  return ctx.values.draft.value;
}
function receive(ctx: ClientContext<Values, unknown, unknown, RowInput>) {
  ctx.values.draft.set(ctx.received.label);
}
function countInitializations() {
  return initialized;
}
export default defineClient(
  { draftText, receive },
  {
    create: {
      input: parseRow,
      initialize,
      receive: "receive",
      template(values, { bind }) {
        return el("li", {}, bind("draftText", { server: values.draft.value }));
      },
    },
  },
);
export { countInitializations };
