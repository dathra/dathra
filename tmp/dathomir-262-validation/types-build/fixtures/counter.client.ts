/* oxlint-disable no-self-assign -- The negative type assertion intentionally assigns a readonly slot. */
import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { CounterValues } from "./counter.server.js";
type CounterContext = ClientContext<CounterValues>;
function countText(ctx: CounterContext) {
  return `${ctx.values.title}: ${ctx.values.count.value}`;
}
function increment(ctx: CounterContext) {
  ctx.values.count.set((previous) => previous + 1);
}
function typeAssertions(ctx: CounterContext) {
  const n: number = ctx.values.count.peek();
  ctx.values.count.set((previous) => {
    const typed: number = previous;
    return typed + n;
  });
  ctx.values.payload.set((previous) => previous);
  ctx.values.payload.set((previous) => ({ ...previous, n: previous.n + 1 }));
  // @ts-expect-error Plain readonly value cannot be replaced.
  ctx.values.title = "changed";
  // @ts-expect-error Signal value uses set.
  ctx.values.count.value = 8;
  // @ts-expect-error Wrong scalar.
  ctx.values.count.set("8");
  // @ts-expect-error Slot cannot be replaced.
  ctx.values.count = ctx.values.count;
  // @ts-expect-error Owned payload mutation is not the proposed context contract.
  ctx.values.payload.value.n = 4;
  // @ts-expect-error Nested arrays/items are readonly.
  ctx.values.payload.value.entries[0].label = "b";
  ctx.values.payload.set((previous) => {
    // @ts-expect-error Updater previous is readonly.
    previous.n++;
    return previous;
  });
  // @ts-expect-error run is synchronous; async callbacks have their own pin.
  ctx.run(async () => 1);
  ctx.run(() => ctx.values.count.set(9));
}
export default defineClient({ countText, increment, typeAssertions });
