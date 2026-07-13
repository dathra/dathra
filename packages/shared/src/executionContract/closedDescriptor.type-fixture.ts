import type {
  ClosedContainerHeader,
  ClosedContainerView,
  ClosedDescriptorCapture,
  ClosedDescriptorValue,
} from "./closedDescriptor";

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

type ExpectedClosedDescriptorValue = null | boolean | number | string | object;
type ExpectedClosedContainerHeader =
  | {
      readonly kind: "record";
      readonly ownKeys: readonly PropertyKey[];
    }
  | {
      readonly kind: "array";
      readonly ownKeys: readonly PropertyKey[];
      readonly length: number;
    };
type ExpectedClosedContainerView =
  | {
      readonly kind: "record";
      readonly entries: readonly (readonly [
        string,
        ExpectedClosedDescriptorValue,
      ])[];
    }
  | {
      readonly kind: "array";
      readonly items: readonly ExpectedClosedDescriptorValue[];
    };
interface ExpectedClosedDescriptorCapture {
  captureHeader(
    value: unknown,
    path: readonly (string | number)[],
  ): ExpectedClosedContainerHeader;
  completeView(
    value: object,
    path: readonly (string | number)[],
  ): ExpectedClosedContainerView;
}

type DescriptorValueIsExact = ExpectTrue<
  Equal<ClosedDescriptorValue, ExpectedClosedDescriptorValue>
>;
type HeaderIsExact = ExpectTrue<
  Equal<ClosedContainerHeader, ExpectedClosedContainerHeader>
>;
type RecordHeaderIsExact = ExpectTrue<
  Equal<
    Extract<ClosedContainerHeader, { readonly kind: "record" }>,
    {
      readonly kind: "record";
      readonly ownKeys: readonly PropertyKey[];
    }
  >
>;
type ArrayHeaderIsExact = ExpectTrue<
  Equal<
    Extract<ClosedContainerHeader, { readonly kind: "array" }>,
    {
      readonly kind: "array";
      readonly ownKeys: readonly PropertyKey[];
      readonly length: number;
    }
  >
>;
type ViewIsExact = ExpectTrue<
  Equal<ClosedContainerView, ExpectedClosedContainerView>
>;
type RecordViewIsExact = ExpectTrue<
  Equal<
    Extract<ClosedContainerView, { readonly kind: "record" }>,
    {
      readonly kind: "record";
      readonly entries: readonly (readonly [string, ClosedDescriptorValue])[];
    }
  >
>;
type ArrayViewIsExact = ExpectTrue<
  Equal<
    Extract<ClosedContainerView, { readonly kind: "array" }>,
    {
      readonly kind: "array";
      readonly items: readonly ClosedDescriptorValue[];
    }
  >
>;
type CaptureIsExact = ExpectTrue<
  Equal<ClosedDescriptorCapture, ExpectedClosedDescriptorCapture>
>;
type HeaderParametersAreExact = ExpectTrue<
  Equal<
    Parameters<ClosedDescriptorCapture["captureHeader"]>,
    [value: unknown, path: readonly (string | number)[]]
  >
>;
type ViewParametersAreExact = ExpectTrue<
  Equal<
    Parameters<ClosedDescriptorCapture["completeView"]>,
    [value: object, path: readonly (string | number)[]]
  >
>;

type ClosedDescriptorTypeFixture = readonly [
  DescriptorValueIsExact,
  HeaderIsExact,
  RecordHeaderIsExact,
  ArrayHeaderIsExact,
  ViewIsExact,
  RecordViewIsExact,
  ArrayViewIsExact,
  CaptureIsExact,
  HeaderParametersAreExact,
  ViewParametersAreExact,
];

export type { ClosedDescriptorTypeFixture };
