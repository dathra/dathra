import { clientModule as link, defineComponent, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import type Client from "./counter.client.js";
import { audit } from "./private.server.js";
type Values = { count: Signal<number>; title: string; enabled: boolean };
const Counter = defineComponent({
  client: link<typeof Client>("./counter.client.js", import.meta.url),
  server(input: { start: number; title: string; enabled?: boolean }): Values {
    audit();
    return { count: signal(input.start), title: input.title, enabled: input.enabled !== false };
  },
  template(values, { bind, on }) {
    if (!values.enabled) return el("span", {}, "declared association without client markers");
    return el(
      "section",
      {},
      bind("countText", { server: `${values.title}: ${values.count.value}` }),
      el("button", { on: [on("click", "increment")] }, "+1"),
    );
  },
});
export type { Values };
export { Counter };
