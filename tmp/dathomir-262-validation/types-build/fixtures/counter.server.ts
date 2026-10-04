import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
import { clientModule, defineComponent, el } from "@dathra/core/server";
import type CounterClient from "./counter.client.js";
type CounterValues = {
  count: Signal<number>;
  title: string;
  theme: Signal<string>;
  payload: Signal<{ n: number; entries: { label: string }[] }>;
};
const Counter = defineComponent({
  client: clientModule<typeof CounterClient>("./counter.client.js", import.meta.url),
  server(input: { start: number; title: string }): CounterValues {
    return {
      count: signal(input.start),
      title: input.title,
      theme: signal("snapshot-midnight"),
      payload: signal({ n: 1, entries: [{ label: "a" }] }),
    };
  },
  template(values, { bind, on }) {
    const count: number = values.count.value;
    return el(
      "section",
      {},
      bind("countText", { server: `${values.title}: ${count}` }),
      el("button", { on: [on("click", "increment"), on("click", "countText")] }, "+1"),
    );
  },
});
export type { CounterValues };
export { Counter };
