import type { Snapshot } from "../runtime/contracts.js";
import type { CounterValues } from "./counter.server.js";
function snapshotChecks(values: Snapshot<CounterValues>) {
  // @ts-expect-error Snapshot cannot write native state.
  values.count.set(3);
  // @ts-expect-error Snapshot plain fields are readonly.
  values.title = "changed";
}
export { snapshotChecks };
