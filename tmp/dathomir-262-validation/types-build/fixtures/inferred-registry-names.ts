import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { CounterValues } from "./counter.server.js";
type Context = ClientContext<CounterValues, unknown, unknown, unknown, keyof typeof functions>;
function countText(ctx: Context): string {
  ctx.ui.bind("increment");
  ctx.ui.on("click", "countText");
  // @ts-expect-error A finite typeof registry name union rejects a typo.
  ctx.ui.on("click", "missing");
  return String(ctx.values.count.value);
}
function increment(ctx: Context): void {
  ctx.values.count.set((previous) => previous + 1);
}
const functions = { countText, increment };
export default defineClient(functions);
