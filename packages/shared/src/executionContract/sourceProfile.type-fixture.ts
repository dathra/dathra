import type { ClosedDataProfile } from "./closedDataWalker";
import type { createSourceProfile } from "./sourceProfile";

type Equal<Left, Right> =
  (<Value>() => Value extends Left ? 1 : 2) extends <
    Value,
  >() => Value extends Right ? 1 : 2
    ? (<Value>() => Value extends Right ? 1 : 2) extends <
        Value,
      >() => Value extends Left ? 1 : 2
      ? true
      : false
    : false;
type ExpectTrue<Value extends true> = Value;

type FactoryIsExact = ExpectTrue<
  Equal<typeof createSourceProfile, () => ClosedDataProfile>
>;
type ResultIsExact = ExpectTrue<
  Equal<ReturnType<typeof createSourceProfile>, ClosedDataProfile>
>;

type SourceProfileTypeFixture = readonly [FactoryIsExact, ResultIsExact];

export type { SourceProfileTypeFixture };
