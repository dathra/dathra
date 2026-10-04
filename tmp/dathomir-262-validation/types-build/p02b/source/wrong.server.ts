import { clientModule, defineComponent } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type Client from "./counter.client.js";
const Wrong = defineComponent({
  client: clientModule<typeof Client>("./other.client.js", import.meta.url),
  server() {
    return { count: signal(3), title: "Count", visible: true };
  },
  template(values, { bind }) {
    return bind("countText", { server: `${values.title}: ${values.count.value}` });
  },
});
export { Wrong };
