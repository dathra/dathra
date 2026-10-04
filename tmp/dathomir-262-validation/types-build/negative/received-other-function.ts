import { signal } from '@dathra/reactivity';
import { defineClient } from '@dathra/core/client';
import type { ClientContext } from '@dathra/core/client';
function parse(raw: unknown) { return { label: Number(raw) }; }
function initialize(input: ReturnType<typeof parse>) { return { count: signal(input.label) }; }
type Values = ReturnType<typeof initialize>;
function receive(ctx: ClientContext<Values, unknown, unknown, { label: number }>) {
  ctx.values.count.set(ctx.received.label);
}
function labelText(ctx: ClientContext<Values, unknown, unknown, { label: string }>) {
  return ctx.received.label.toUpperCase();
}
const Broken = defineClient({ receive, labelText }, { create: {
  input: parse, initialize, receive: 'receive', template(values) { return String(values.count.value); },
} });
export { Broken };
