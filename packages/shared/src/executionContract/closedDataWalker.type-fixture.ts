import type { BudgetLedger } from "./budget";
import type {
  ClosedContainerHeader,
  ClosedContainerView,
} from "./closedDescriptor";
import type {
  ClosedDataProfile,
  createClosedDataPlan,
} from "./closedDataWalker";
import type { ClosedDataOccurrence, ClosedDataPlan } from "./occurrencePlan";

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

interface ExpectedClosedDataProfile {
  beforeDescriptors(
    occurrence: ClosedDataOccurrence,
    header: ClosedContainerHeader,
    ledger: BudgetLedger,
  ): void;
  beforeChildren(
    occurrence: ClosedDataOccurrence,
    view: ClosedContainerView,
    ledger: BudgetLedger,
  ): void;
}

type ProfileIsExact = ExpectTrue<
  Equal<ClosedDataProfile, ExpectedClosedDataProfile>
>;
type BeforeDescriptorsParametersAreExact = ExpectTrue<
  Equal<
    Parameters<ClosedDataProfile["beforeDescriptors"]>,
    [
      occurrence: ClosedDataOccurrence,
      header: ClosedContainerHeader,
      ledger: BudgetLedger,
    ]
  >
>;
type BeforeChildrenParametersAreExact = ExpectTrue<
  Equal<
    Parameters<ClosedDataProfile["beforeChildren"]>,
    [
      occurrence: ClosedDataOccurrence,
      view: ClosedContainerView,
      ledger: BudgetLedger,
    ]
  >
>;
type FactoryIsExact = ExpectTrue<
  Equal<
    typeof createClosedDataPlan,
    (
      value: unknown,
      ledger: BudgetLedger,
      profile?: ClosedDataProfile,
    ) => ClosedDataPlan
  >
>;

type ClosedDataWalkerTypeFixture = readonly [
  ProfileIsExact,
  BeforeDescriptorsParametersAreExact,
  BeforeChildrenParametersAreExact,
  FactoryIsExact,
];

export type { ClosedDataWalkerTypeFixture };
