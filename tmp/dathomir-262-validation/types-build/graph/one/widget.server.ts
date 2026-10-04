import * as server from "@dathra/core/server";
import type Client from "./widget.client.js";
const Widget = server.defineComponent({
  client: server.clientModule<typeof Client>("./widget.client.js", import.meta.url),
  server() {
    return { label: "one SSR" };
  },
  template(values, { bind }) {
    return bind("label", { server: values.label });
  },
});
export { Widget };
