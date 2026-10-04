import { signal } from "@dathra/reactivity";
import type { Signal } from "@dathra/reactivity";
type Equal<A, B> =
  (<T>() => T extends A ? 1 : 2) extends <T>() => T extends B ? 1 : 2 ? true : false;
type Assert<T extends true> = T;
type NotAny<T> = 0 extends 1 & T ? false : true;
const native = signal(7);
type ActualSignal = Assert<Equal<typeof native, Signal<number>>>;
type NativeNumber = Assert<NotAny<typeof native.value>>;
native.set((previous) => {
  const number: number = previous;
  return number + 1;
});
// @ts-expect-error Actual repository Signal rejects an incorrect setter argument.
native.set("not a number");
export type { ActualSignal, NativeNumber };
