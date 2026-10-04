import { defineComponent, clientModule, el } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import type StringClient from "./string-count.client.js";
const Wrong = defineComponent({
  client: clientModule<typeof StringClient>("./string-count.client.js", import.meta.url),
  server() { return { count: signal(7) }; },
  template(_values, { bind }) { return el("p", {}, bind("text", { server: "7" })); },
});
export { Wrong };
