import type { Signal } from "@dathra/reactivity";
import type { OwnedSignal } from "@dathra/core/client";
// Intentional compile-acceptance counterexample; do not execute as a runtime guarantee.
function nativeConsumer(owned: OwnedSignal<{ n: number }>) {
  const native: Signal<{ n: number }> = owned;
  native.value.n++;
  return native;
}
export { nativeConsumer };
