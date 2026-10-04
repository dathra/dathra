import { clientModule as association } from "@dathra/core/server";
import type * as Browser from "./one/widget.client.js";
const ref = association<typeof Browser.default>("./one/widget.client.js", import.meta.url);
export { ref };
