import { signal } from "@dathra/reactivity";
import { clientModule, defineComponent, el } from "@dathra/core/server";
const Plain = defineComponent({
  client: clientModule("./plain.client.js", import.meta.url),
  server() {
    return { count: signal(7), title: "JS counter" };
  },
  template(values, { bind, on }) {
    return el(
      "p",
      { on: [on("click", "increment")] },
      bind("countText", { server: values.title + values.count.value }),
    );
  },
});
export { Plain };
