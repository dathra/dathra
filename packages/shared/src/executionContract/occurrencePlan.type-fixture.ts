import type {
  ClosedDataOccurrence,
  ClosedDataPathSegment,
  ClosedDataPlan,
  ClosedDataPlanNode,
  ClosedDataPlanNodeValue,
  OccurrencePlanBuilder,
  createOccurrencePlanBuilder,
} from "./occurrencePlan";

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

type ExpectedClosedDataPathSegment = string | number;

type ExpectedClosedDataPlanNodeValue =
  | { readonly kind: "null"; readonly value: null }
  | { readonly kind: "boolean"; readonly value: boolean }
  | { readonly kind: "number"; readonly value: number }
  | { readonly kind: "string"; readonly value: string }
  | { readonly kind: "record" }
  | { readonly kind: "array" };

interface ExpectedClosedDataOccurrence {
  readonly occurrenceId: number;
  readonly parentOccurrenceId: number | null;
  readonly segment: ExpectedClosedDataPathSegment | null;
  readonly depth: number;
  readonly path: readonly ExpectedClosedDataPathSegment[];
  childPath(
    segment: ExpectedClosedDataPathSegment,
  ): readonly ExpectedClosedDataPathSegment[];
}

type ExpectedClosedDataPlanNode = {
  readonly occurrenceId: number;
  readonly parentOccurrenceId: number | null;
  readonly segment: ExpectedClosedDataPathSegment | null;
  readonly depth: number;
} & ExpectedClosedDataPlanNodeValue;

interface ExpectedClosedDataPlan {
  readonly nodes: readonly ExpectedClosedDataPlanNode[];
}

interface ExpectedOccurrencePlanBuilder {
  rootPath(): readonly ExpectedClosedDataPathSegment[];
  childPath(
    parentOccurrenceId: number,
    segment: ExpectedClosedDataPathSegment,
  ): readonly ExpectedClosedDataPathSegment[];
  appendRoot(
    value: ExpectedClosedDataPlanNodeValue,
  ): ExpectedClosedDataOccurrence;
  appendChild(
    parentOccurrenceId: number,
    segment: ExpectedClosedDataPathSegment,
    value: ExpectedClosedDataPlanNodeValue,
  ): ExpectedClosedDataOccurrence;
  finish(): ExpectedClosedDataPlan;
}

type PathSegmentIsExact = ExpectTrue<
  Equal<ClosedDataPathSegment, ExpectedClosedDataPathSegment>
>;
type NodeValueIsExact = ExpectTrue<
  Equal<ClosedDataPlanNodeValue, ExpectedClosedDataPlanNodeValue>
>;
type OccurrenceIsExact = ExpectTrue<
  Equal<ClosedDataOccurrence, ExpectedClosedDataOccurrence>
>;
type PlanNodeIsExact = ExpectTrue<
  Equal<ClosedDataPlanNode, ExpectedClosedDataPlanNode>
>;
type PlanIsExact = ExpectTrue<Equal<ClosedDataPlan, ExpectedClosedDataPlan>>;
type BuilderIsExact = ExpectTrue<
  Equal<OccurrencePlanBuilder, ExpectedOccurrencePlanBuilder>
>;
type RootPathIsExact = ExpectTrue<
  Equal<
    OccurrencePlanBuilder["rootPath"],
    () => readonly ClosedDataPathSegment[]
  >
>;
type ChildPathIsExact = ExpectTrue<
  Equal<
    OccurrencePlanBuilder["childPath"],
    (
      parentOccurrenceId: number,
      segment: ClosedDataPathSegment,
    ) => readonly ClosedDataPathSegment[]
  >
>;
type AppendRootIsExact = ExpectTrue<
  Equal<
    OccurrencePlanBuilder["appendRoot"],
    (value: ClosedDataPlanNodeValue) => ClosedDataOccurrence
  >
>;
type AppendChildIsExact = ExpectTrue<
  Equal<
    OccurrencePlanBuilder["appendChild"],
    (
      parentOccurrenceId: number,
      segment: ClosedDataPathSegment,
      value: ClosedDataPlanNodeValue,
    ) => ClosedDataOccurrence
  >
>;
type FinishIsExact = ExpectTrue<
  Equal<OccurrencePlanBuilder["finish"], () => ClosedDataPlan>
>;
type FactoryIsExact = ExpectTrue<
  Equal<typeof createOccurrencePlanBuilder, () => OccurrencePlanBuilder>
>;

type OccurrencePlanTypeFixture = readonly [
  PathSegmentIsExact,
  NodeValueIsExact,
  OccurrenceIsExact,
  PlanNodeIsExact,
  PlanIsExact,
  BuilderIsExact,
  RootPathIsExact,
  ChildPathIsExact,
  AppendRootIsExact,
  AppendChildIsExact,
  FinishIsExact,
  FactoryIsExact,
];

export type { OccurrencePlanTypeFixture };
