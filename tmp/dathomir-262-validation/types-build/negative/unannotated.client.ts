import { defineClient } from "@dathra/core/client";
function countText(ctx) { return String(ctx.values.count.value); }
export default defineClient({ countText });
