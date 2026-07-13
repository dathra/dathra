import type { ClosedDataPlan } from "./occurrencePlan";
import type { cloneClosedDataPlan, ClosedDataClone } from "./snapshot";

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

type ExpectedClosedDataClone =
  | null
  | boolean
  | number
  | string
  | { [key: string]: ExpectedClosedDataClone }
  | ExpectedClosedDataClone[];

type CloneIsExact = ExpectTrue<Equal<ClosedDataClone, ExpectedClosedDataClone>>;
type FactoryIsExact = ExpectTrue<
  Equal<typeof cloneClosedDataPlan, (plan: ClosedDataPlan) => ClosedDataClone>
>;

type SnapshotTypeFixture = readonly [CloneIsExact, FactoryIsExact];

export type { SnapshotTypeFixture };
