import type { ClientContext } from "@dathra/core/client";
import type { CounterValues } from "../fixtures/counter.server.js";
function registryIndependent(ctx: ClientContext<CounterValues>) {
  // This intentionally compiles: a function annotation cannot see later registry keys.
  return ctx.ui.bind("misspelled");
}
export { registryIndependent };
