import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import { clientModule, defineComponent, el } from "@dathra/core/server";
import type Client from "./counter.client.js";
import { privateText } from "./private-data.js";
type Values = { count: Signal<number>; title: string; visible: boolean };
const Counter = defineComponent({
  client: clientModule<typeof Client>("./counter.client.js", import.meta.url),
  server(input: { visible: boolean }): Values {
    if (!privateText) throw new Error("E_PRIVATE");
    return { count: signal(3), title: "Count", visible: input.visible };
  },
  template(values, { bind, on }) {
    if (!values.visible) return el("span", {}, "prepared without client markers");
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
