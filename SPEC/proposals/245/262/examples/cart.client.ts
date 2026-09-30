import type { ClientContext } from "@dathra/core/client";
import type { CartState } from "./cart.server";

type CartCtx = ClientContext<CartState, { unitPrice: number }>;

/** Both quantity panels operate on their enclosing cart owner. */
function incrementQuantity(ctx: CartCtx): void {
  ctx.state.quantity.set(ctx.state.quantity.value + 1);
}

export { quantityText, totalText } from "./cart.display";
export { incrementQuantity };
