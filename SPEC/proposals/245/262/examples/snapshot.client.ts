import type { Model } from "./snapshot.server";
import type { ClientContext } from "@dathra/core/client";

type Ctx = ClientContext<Model, { locale: string }>;

export function themeText(ctx: Ctx): string {
  return `Theme: ${ctx.state.theme.value}`;
}
export function countText(ctx: Ctx): string {
  return `Count: ${ctx.state.count.value}`;
}
export function increment(ctx: Ctx): void {
  ctx.state.count.set(ctx.state.count.value + 1);
}
