import type {
  ActiveAncestorTracker,
  createActiveAncestorTracker,
} from "./activeAncestor";

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

interface ExpectedActiveAncestorTracker {
  enter(value: object, path: readonly (string | number)[]): void;
  leave(value: object): void;
}

type ActiveAncestorFactory = typeof createActiveAncestorTracker;
type TrackerIsExact = ExpectTrue<
  Equal<ActiveAncestorTracker, ExpectedActiveAncestorTracker>
>;
type EnterParametersAreExact = ExpectTrue<
  Equal<
    Parameters<ActiveAncestorTracker["enter"]>,
    [value: object, path: readonly (string | number)[]]
  >
>;
type EnterReturnIsExact = ExpectTrue<
  Equal<ReturnType<ActiveAncestorTracker["enter"]>, void>
>;
type LeaveParametersAreExact = ExpectTrue<
  Equal<Parameters<ActiveAncestorTracker["leave"]>, [value: object]>
>;
type LeaveReturnIsExact = ExpectTrue<
  Equal<ReturnType<ActiveAncestorTracker["leave"]>, void>
>;
type FactoryIsExact = ExpectTrue<
  Equal<ActiveAncestorFactory, () => ActiveAncestorTracker>
>;

type ActiveAncestorTypeFixture = readonly [
  TrackerIsExact,
  EnterParametersAreExact,
  EnterReturnIsExact,
  LeaveParametersAreExact,
  LeaveReturnIsExact,
  FactoryIsExact,
];

export type { ActiveAncestorTypeFixture };
