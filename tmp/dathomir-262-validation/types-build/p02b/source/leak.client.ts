import { defineClient } from "@dathra/core/client";
import { privateText } from "./private-data.js";
function countText() {
  return privateText;
}
export default defineClient({ countText });
