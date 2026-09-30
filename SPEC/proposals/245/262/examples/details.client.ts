import { el, txt } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { DetailsState, DetailsRequests } from "./details.server";

type DetailCtx = ClientContext<DetailsState, { itemId: string }, DetailsRequests, "details">;

export async function loadDetails(ctx: DetailCtx): Promise<void> {
  const result = await ctx.request("details", { id: ctx.values.itemId });
  ctx.create("details", () => el("p", {}, txt(result.label)));
}
