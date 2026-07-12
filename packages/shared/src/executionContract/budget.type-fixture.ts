import type { ExecutionContractBudget } from "./implementation";

type Copy<Value> = { [Key in keyof Value]: Value[Key] };
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
type ExpectFalse<Value extends false> = Value;
type OptionalKeys<Value> = {
  [Key in keyof Value]-?: Record<never, never> extends Pick<Value, Key>
    ? Key
    : never;
}[keyof Value];
type ReadonlyKeys<Value> = {
  [Key in keyof Value]-?: Equal<
    Pick<Value, Key>,
    Readonly<Pick<Value, Key>>
  > extends true
    ? Key
    : never;
}[keyof Value];

type ExpectedExecutionContractBudget = {
  readonly maximumInputDepth?: number;
  readonly maximumInputDataNodes?: number;
  readonly maximumInputProperties?: number;
  readonly maximumInputArrayLength?: number;
  readonly maximumInputStringCodeUnits?: number;
  readonly maximumFacts?: number;
  readonly maximumRelations?: number;
  readonly maximumExports?: number;
  readonly maximumRegistryEntries?: number;
  readonly maximumRegistryImplementations?: number;
  readonly maximumReferences?: number;
  readonly maximumSemanticPathSegments?: number;
  readonly maximumCanonicalBytes?: number;
  readonly maximumCanonicalWorkSteps?: number;
  readonly maximumValidationSteps?: number;
};

type RequiredMaximumFacts = Omit<
  ExpectedExecutionContractBudget,
  "maximumFacts"
> & {
  readonly maximumFacts: number;
};
type MutableMaximumFacts = Omit<
  ExpectedExecutionContractBudget,
  "maximumFacts"
> & {
  maximumFacts?: number;
};
type NullableMaximumFacts = Omit<
  ExpectedExecutionContractBudget,
  "maximumFacts"
> & {
  readonly maximumFacts?: number | null;
};
type StringMaximumFacts = Omit<
  ExpectedExecutionContractBudget,
  "maximumFacts"
> & {
  readonly maximumFacts?: string;
};
type ExtraCounter = ExpectedExecutionContractBudget & {
  readonly maximumClosures?: number;
};

type BudgetHasExactShape = ExpectTrue<
  Equal<Copy<ExecutionContractBudget>, Copy<ExpectedExecutionContractBudget>>
>;
type BudgetHasExactKeys = ExpectTrue<
  Equal<keyof ExecutionContractBudget, keyof ExpectedExecutionContractBudget>
>;
type EveryBudgetFieldIsOptional = ExpectTrue<
  Equal<OptionalKeys<ExecutionContractBudget>, keyof ExecutionContractBudget>
>;
type EveryBudgetFieldIsReadonly = ExpectTrue<
  Equal<ReadonlyKeys<ExecutionContractBudget>, keyof ExecutionContractBudget>
>;
type EveryPresentBudgetValueIsNumber = ExpectTrue<
  Equal<
    Required<ExecutionContractBudget>[keyof ExecutionContractBudget],
    number
  >
>;

type RequiredFieldIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractBudget>, Copy<RequiredMaximumFacts>>
>;
type RequiredFieldWitness = ExpectFalse<
  "maximumFacts" extends OptionalKeys<RequiredMaximumFacts> ? true : false
>;
type MutableFieldIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractBudget>, Copy<MutableMaximumFacts>>
>;
type MutableFieldWitness = ExpectFalse<
  "maximumFacts" extends ReadonlyKeys<MutableMaximumFacts> ? true : false
>;
type NullableFieldIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractBudget>, Copy<NullableMaximumFacts>>
>;
type NullableFieldWitness = ExpectTrue<
  null extends NullableMaximumFacts["maximumFacts"] ? true : false
>;
type StringFieldIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractBudget>, Copy<StringMaximumFacts>>
>;
type StringFieldWitness = ExpectTrue<
  Equal<Required<StringMaximumFacts>["maximumFacts"], string>
>;
type ExtraCounterIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractBudget>, Copy<ExtraCounter>>
>;
type ExtraCounterWitness = ExpectTrue<
  "maximumClosures" extends keyof ExtraCounter ? true : false
>;

type ExecutionContractBudgetTypeFixture = readonly [
  BudgetHasExactShape,
  BudgetHasExactKeys,
  EveryBudgetFieldIsOptional,
  EveryBudgetFieldIsReadonly,
  EveryPresentBudgetValueIsNumber,
  RequiredFieldIsRejected,
  RequiredFieldWitness,
  MutableFieldIsRejected,
  MutableFieldWitness,
  NullableFieldIsRejected,
  NullableFieldWitness,
  StringFieldIsRejected,
  StringFieldWitness,
  ExtraCounterIsRejected,
  ExtraCounterWitness,
];

export type { ExecutionContractBudgetTypeFixture };
