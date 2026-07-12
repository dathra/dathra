import type { RegistryId } from "../executionRegistry/implementation";
import type {
  ExportExecutionContract,
  FactId,
  TransferBinding,
} from "./implementation";

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

type ExpectedExportCallable =
  | "none"
  | "call"
  | "construct"
  | "call-and-construct";

type ExpectedExportExecutionContract = {
  readonly factIds: readonly FactId[];
  readonly callable: ExpectedExportCallable;
  readonly receiverBrandId: RegistryId<"brand"> | null;
  readonly valueDomainId: RegistryId<"value-domain">;
  readonly transfer: TransferBinding;
};

type OptionalField<Key extends keyof ExpectedExportExecutionContract> = Omit<
  ExpectedExportExecutionContract,
  Key
> & {
  readonly [Property in Key]?: ExpectedExportExecutionContract[Property];
};

type MutableField<Key extends keyof ExpectedExportExecutionContract> = Omit<
  ExpectedExportExecutionContract,
  Key
> & {
  -readonly [Property in Key]: ExpectedExportExecutionContract[Property];
};

type ReplaceField<
  Key extends keyof ExpectedExportExecutionContract,
  Value,
> = Omit<ExpectedExportExecutionContract, Key> & {
  readonly [Property in Key]: Value;
};

type MissingFactIds = Omit<ExpectedExportExecutionContract, "factIds">;
type MissingCallable = Omit<ExpectedExportExecutionContract, "callable">;
type MissingReceiverBrandId = Omit<
  ExpectedExportExecutionContract,
  "receiverBrandId"
>;
type MissingValueDomainId = Omit<
  ExpectedExportExecutionContract,
  "valueDomainId"
>;
type MissingTransfer = Omit<ExpectedExportExecutionContract, "transfer">;
type ExtraField = ExpectedExportExecutionContract & {
  readonly exportName: string;
};
type WidenedFactIds = ReplaceField<"factIds", readonly (FactId | null)[]>;
type WidenedCallable = ReplaceField<
  "callable",
  ExpectedExportCallable | "invoke"
>;
type WidenedReceiverBrandId = ReplaceField<
  "receiverBrandId",
  RegistryId<"brand"> | null | undefined
>;
type WidenedValueDomainId = ReplaceField<
  "valueDomainId",
  RegistryId<"value-domain"> | null
>;
type WidenedTransfer = ReplaceField<"transfer", TransferBinding | null>;
type BrandUsedAsValueDomain = ReplaceField<
  "valueDomainId",
  RegistryId<"brand">
>;
type ValueDomainUsedAsBrand = ReplaceField<
  "receiverBrandId",
  RegistryId<"value-domain"> | null
>;

type CallableExtendsExpected = ExpectTrue<
  [ExportExecutionContract["callable"]] extends [ExpectedExportCallable]
    ? true
    : false
>;
type ExpectedExtendsCallable = ExpectTrue<
  [ExpectedExportCallable] extends [ExportExecutionContract["callable"]]
    ? true
    : false
>;
type ContractHasExactShape = ExpectTrue<
  Equal<Copy<ExportExecutionContract>, Copy<ExpectedExportExecutionContract>>
>;
type ContractHasExactKeys = ExpectTrue<
  Equal<keyof ExportExecutionContract, keyof ExpectedExportExecutionContract>
>;
type ContractHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ExportExecutionContract>, never>
>;
type ContractHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ExportExecutionContract>,
    keyof ExpectedExportExecutionContract
  >
>;

type MissingFactIdsIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MissingFactIds>>
>;
type MissingFactIdsWitness = ExpectFalse<
  "factIds" extends keyof MissingFactIds ? true : false
>;
type MissingCallableIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MissingCallable>>
>;
type MissingCallableWitness = ExpectFalse<
  "callable" extends keyof MissingCallable ? true : false
>;
type MissingReceiverBrandIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MissingReceiverBrandId>>
>;
type MissingReceiverBrandIdWitness = ExpectFalse<
  "receiverBrandId" extends keyof MissingReceiverBrandId ? true : false
>;
type MissingValueDomainIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MissingValueDomainId>>
>;
type MissingValueDomainIdWitness = ExpectFalse<
  "valueDomainId" extends keyof MissingValueDomainId ? true : false
>;
type MissingTransferIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MissingTransfer>>
>;
type MissingTransferWitness = ExpectFalse<
  "transfer" extends keyof MissingTransfer ? true : false
>;
type ExtraFieldIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<ExtraField>>
>;
type ExtraFieldWitness = ExpectTrue<
  "exportName" extends keyof ExtraField ? true : false
>;

type OptionalFactIdsIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<OptionalField<"factIds">>>
>;
type OptionalFactIdsWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalField<"factIds">>, "factIds">
>;
type OptionalCallableIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<OptionalField<"callable">>>
>;
type OptionalCallableWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalField<"callable">>, "callable">
>;
type OptionalReceiverBrandIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<OptionalField<"receiverBrandId">>>
>;
type OptionalReceiverBrandIdWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalField<"receiverBrandId">>, "receiverBrandId">
>;
type OptionalValueDomainIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<OptionalField<"valueDomainId">>>
>;
type OptionalValueDomainIdWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalField<"valueDomainId">>, "valueDomainId">
>;
type OptionalTransferIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<OptionalField<"transfer">>>
>;
type OptionalTransferWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalField<"transfer">>, "transfer">
>;

type MutableFactIdsIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MutableField<"factIds">>>
>;
type MutableFactIdsWitness = ExpectFalse<
  "factIds" extends ReadonlyKeys<MutableField<"factIds">> ? true : false
>;
type MutableCallableIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MutableField<"callable">>>
>;
type MutableCallableWitness = ExpectFalse<
  "callable" extends ReadonlyKeys<MutableField<"callable">> ? true : false
>;
type MutableReceiverBrandIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MutableField<"receiverBrandId">>>
>;
type MutableReceiverBrandIdWitness = ExpectFalse<
  "receiverBrandId" extends ReadonlyKeys<MutableField<"receiverBrandId">>
    ? true
    : false
>;
type MutableValueDomainIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MutableField<"valueDomainId">>>
>;
type MutableValueDomainIdWitness = ExpectFalse<
  "valueDomainId" extends ReadonlyKeys<MutableField<"valueDomainId">>
    ? true
    : false
>;
type MutableTransferIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<MutableField<"transfer">>>
>;
type MutableTransferWitness = ExpectFalse<
  "transfer" extends ReadonlyKeys<MutableField<"transfer">> ? true : false
>;

type WidenedFactIdsIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<WidenedFactIds>>
>;
type WidenedFactIdsWitness = ExpectTrue<
  null extends WidenedFactIds["factIds"][number] ? true : false
>;
type WidenedCallableIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<WidenedCallable>>
>;
type WidenedCallableWitness = ExpectTrue<
  "invoke" extends WidenedCallable["callable"] ? true : false
>;
type WidenedReceiverBrandIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<WidenedReceiverBrandId>>
>;
type WidenedReceiverBrandIdWitness = ExpectTrue<
  undefined extends WidenedReceiverBrandId["receiverBrandId"] ? true : false
>;
type WidenedValueDomainIdIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<WidenedValueDomainId>>
>;
type WidenedValueDomainIdWitness = ExpectTrue<
  null extends WidenedValueDomainId["valueDomainId"] ? true : false
>;
type WidenedTransferIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<WidenedTransfer>>
>;
type WidenedTransferWitness = ExpectTrue<
  null extends WidenedTransfer["transfer"] ? true : false
>;

type BrandUsedAsValueDomainIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<BrandUsedAsValueDomain>>
>;
type BrandUsedAsValueDomainWitness = ExpectFalse<
  RegistryId<"brand"> extends RegistryId<"value-domain"> ? true : false
>;
type ValueDomainUsedAsBrandIsRejected = ExpectFalse<
  Equal<Copy<ExportExecutionContract>, Copy<ValueDomainUsedAsBrand>>
>;
type ValueDomainUsedAsBrandWitness = ExpectFalse<
  RegistryId<"value-domain"> extends RegistryId<"brand"> ? true : false
>;

type ExportExecutionContractTypeFixture = readonly [
  CallableExtendsExpected,
  ExpectedExtendsCallable,
  ContractHasExactShape,
  ContractHasExactKeys,
  ContractHasNoOptionalKeys,
  ContractHasOnlyReadonlyKeys,
  MissingFactIdsIsRejected,
  MissingFactIdsWitness,
  MissingCallableIsRejected,
  MissingCallableWitness,
  MissingReceiverBrandIdIsRejected,
  MissingReceiverBrandIdWitness,
  MissingValueDomainIdIsRejected,
  MissingValueDomainIdWitness,
  MissingTransferIsRejected,
  MissingTransferWitness,
  ExtraFieldIsRejected,
  ExtraFieldWitness,
  OptionalFactIdsIsRejected,
  OptionalFactIdsWitness,
  OptionalCallableIsRejected,
  OptionalCallableWitness,
  OptionalReceiverBrandIdIsRejected,
  OptionalReceiverBrandIdWitness,
  OptionalValueDomainIdIsRejected,
  OptionalValueDomainIdWitness,
  OptionalTransferIsRejected,
  OptionalTransferWitness,
  MutableFactIdsIsRejected,
  MutableFactIdsWitness,
  MutableCallableIsRejected,
  MutableCallableWitness,
  MutableReceiverBrandIdIsRejected,
  MutableReceiverBrandIdWitness,
  MutableValueDomainIdIsRejected,
  MutableValueDomainIdWitness,
  MutableTransferIsRejected,
  MutableTransferWitness,
  WidenedFactIdsIsRejected,
  WidenedFactIdsWitness,
  WidenedCallableIsRejected,
  WidenedCallableWitness,
  WidenedReceiverBrandIdIsRejected,
  WidenedReceiverBrandIdWitness,
  WidenedValueDomainIdIsRejected,
  WidenedValueDomainIdWitness,
  WidenedTransferIsRejected,
  WidenedTransferWitness,
  BrandUsedAsValueDomainIsRejected,
  BrandUsedAsValueDomainWitness,
  ValueDomainUsedAsBrandIsRejected,
  ValueDomainUsedAsBrandWitness,
];

export type { ExportExecutionContractTypeFixture };
