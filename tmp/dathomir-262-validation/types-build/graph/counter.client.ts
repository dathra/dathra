import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Values } from "./counter.server.js";
if (typeof window === "undefined") throw new Error("BROWSER_TOP_LEVEL_EXECUTED_ON_SERVER");
globalThis.__p02BrowserLoads = (globalThis.__p02BrowserLoads || 0) + 1;
function countText(ctx: ClientContext<Values>) {
  return `${ctx.values.title}: ${ctx.values.count.value}`;
}
function increment(ctx: ClientContext<Values>) {
  ctx.values.count.set((previous) => previous + 1);
}
export default defineClient({ countText, increment });
