import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Values } from "./counter.server.js";
import { computed, signal } from "@dathra/reactivity";
if (typeof window === "undefined") throw new Error("E_BROWSER_TOP_LEVEL_ON_SERVER");
function countText(ctx: ClientContext<Values>) {
  return `${ctx.values.title}: ${ctx.values.count.value}`;
}
function increment(ctx: ClientContext<Values>) {
  ctx.values.count.set((previous) => previous + 1);
}
function derived(source: import("@dathra/reactivity").Signal<number>) {
  return computed(() => source.value * 2);
}
export default defineClient({ countText, increment });
export { signal, computed, derived };
