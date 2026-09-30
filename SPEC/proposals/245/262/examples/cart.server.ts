import { defineRoute, occurrence, el, txt, clientExports } from "@dathra/core/server";
import { signal } from "@dathra/reactivity";
import { renderCounter } from "./snapshot.server";
import { quantityText, totalText } from "./cart.display";
import type { CartDisplay } from "./cart.display";

const { bind, on } = clientExports<typeof import("./cart.client")>();

function createCartState() { return { quantity: signal(2) }; }
type CartState = ReturnType<typeof createCartState>;

/** A display fragment borrows its enclosing occurrence; it creates no owner. */
function quantityPanel(ctx: CartDisplay) {
  return el("section", {},
    el("p", {}, txt(quantityText(ctx), bind("quantityText"))),
    el("p", {}, txt(totalText(ctx), bind("totalText"))),
    el("button", { type: "button", on: on("click", "incrementQuantity") }, txt("Add one")),
  );
}

export default defineRoute({
  render(_request) {
    const state = createCartState();
    const values = { unitPrice: 100 };
    return occurrence({
      client: "cart",
      state,
      values,
      view: el("main", {},
        el("h1", {}, txt("Cart")),
        quantityPanel({ state, values }),
        el("aside", {}, txt("Order summary"), quantityPanel({ state, values })),
        el("aside", {}, txt("Independent product comparison counter"), renderCounter(0)),
      ),
    });
  },
});
export type { CartState };
