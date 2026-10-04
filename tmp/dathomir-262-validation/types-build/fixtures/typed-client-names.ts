import type { ClientContext } from "@dathra/core/client";
import type { CounterValues } from "./counter.server.js";
import { defineClient } from "@dathra/core/client";
// This type-only shape lists the finite names once, separate from runtime registration.
type Registry = {
  countText(ctx: Context): string;
  increment(ctx: Context): void;
};
type Context = ClientContext<CounterValues, unknown, unknown, unknown, keyof Registry>;
function countText(ctx: Context): string {
  ctx.ui.bind("increment");
  ctx.ui.on("click", "countText");
  // @ts-expect-error Type-only name union does not admit a typo.
  ctx.ui.bind("typo");
  return String(ctx.values.count.value);
}
function increment(ctx: Context): void {
  ctx.values.count.set((n) => n + 1);
}
const TypedClient = defineClient({ countText, increment } satisfies Registry);
// A typeof completed client cycle needs an explicit return type boundary; do not assume free inference.
type ActualKeys = keyof typeof TypedClient.functions;
type RegistryKeys = keyof Registry;
type Equal = ActualKeys extends RegistryKeys
  ? RegistryKeys extends ActualKeys
    ? true
    : false
  : false;
const exact: Equal = true;
export type { Registry, Context };
export { TypedClient, exact };
