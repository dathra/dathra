import type CounterClient from "./counter.client.js";
import type { ServerTools } from "../runtime/contracts.js";
type Keys = keyof typeof CounterClient.functions;
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type ExactKeys = Assert<Equal<Keys, "countText" | "increment" | "typeAssertions">>;
function names(tools: ServerTools<Keys>) {
  tools.bind("increment", { server: "Operation name is also offered" });
  tools.on("click", "countText");
  // @ts-expect-error All-name is not all-string.
  tools.bind("unknown", { server: "" });
  // @ts-expect-error All-name is not all-string.
  tools.on("click", "unknown");
  // @ts-expect-error SSR content is mandatory; it is not a fallback.
  tools.bind("countText");
}
export type { ExactKeys };
export { names };
