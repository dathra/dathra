import { clientModule, defineComponent } from "@dathra/core/server";
import type Client from "./widget.client.js";
const Widget = defineComponent({
  client: clientModule<typeof Client>("./widget.client.js", import.meta.url),
  server() {
    return { label: "two SSR" };
  },
  template(values, { bind }) {
    return bind("label", { server: values.label });
  },
});
export { Widget };
