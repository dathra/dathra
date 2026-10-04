import { defineClient } from "@dathra/core/client";
import type { ClientContext } from "@dathra/core/client";
import type { Signal } from "@dathra/reactivity";
function text(ctx: ClientContext<{ count: Signal<string> }>) { return ctx.values.count.value; }
export default defineClient({ text });
