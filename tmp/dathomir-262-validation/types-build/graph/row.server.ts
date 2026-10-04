import { clientModule, defineComponent, defineRoute, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { parseRow } from "./row-input.js";
import type Client from "./row.client.js";
const Row = defineComponent({
  client: clientModule<typeof Client>("./row.client.js", import.meta.url),
  input: parseRow,
  server(input) {
    return { draft: signal(input.label), id: input.id };
  },
  template(values, { bind }) {
    return el("li", {}, bind("draftText", { server: values.draft.value }));
  },
});
const route = defineRoute({
  render(request: Request) {
    return Row({ id: "a", label: "SSR Alpha" }, request, { _key: "a" });
  },
});
export { Row, route };
