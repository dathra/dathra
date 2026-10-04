import type { ServerTools } from "../runtime/contracts.js";
function illegal(tools: ServerTools<"countText" | "increment">) {
  tools.bind("countText", { server: "7", kind: "text" });
}
export { illegal };
