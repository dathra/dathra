import { defineClient } from "@dathra/core/client";
/** @param {import("@dathra/core/client").ClientContext<{count: import("@dathra/reactivity").Signal<number>, title: string}>} ctx */
function countText(ctx) {
  return ctx.values.title + ctx.values.count.value;
}
/** @param {import("@dathra/core/client").ClientContext<{count: import("@dathra/reactivity").Signal<number>, title: string}>} ctx */
function increment(ctx) {
  ctx.values.count.set((previous) => previous + 1);
}
export default defineClient({ countText, increment });
