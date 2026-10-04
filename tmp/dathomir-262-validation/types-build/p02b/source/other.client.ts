import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Values } from "./counter.server.js";
function countText(ctx: ClientContext<Values>) {
  return `OTHER: ${ctx.values.count.value}`;
}
function increment(ctx: ClientContext<Values>) {
  ctx.values.count.set((n) => n + 1);
}
export default defineClient({ countText, increment });
