import { createHash } from "node:crypto";
const serverSecret = "SERVER_ONLY_SECRET_262_P02";
function audit() {
  return createHash("sha256").update(serverSecret).digest("hex");
}
export { audit };
