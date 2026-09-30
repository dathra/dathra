interface CartDisplay {
  readonly state: { readonly quantity: { readonly value: number } };
  readonly values: { readonly unitPrice: number };
}

/** Read quantity for each explicitly declared display target. */
function quantityText(ctx: CartDisplay): string {
  return `Quantity: ${ctx.state.quantity.value}`;
}

/** Share the calculation between initial display and live getter. */
function totalText(ctx: CartDisplay): string {
  return `Total: ${ctx.state.quantity.value * ctx.values.unitPrice} JPY`;
}

export { quantityText, totalText };
export type { CartDisplay };
