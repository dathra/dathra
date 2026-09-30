import type { Model } from "./snapshot.server";
import type { ClientContext } from "@dathra/core/client";

type Ctx = ClientContext<Model, { locale: string }>;

/** Mutate only the state restored for the admitted counter occurrence. */
function increment(ctx: Ctx): void {
  ctx.state.count.set(ctx.state.count.value + 1);
}

export { themeText, countText } from "./snapshot.display";
export { increment };
