import type { ExportExecutionContract } from "./exportModel";
import type { SemanticFact } from "./factModel";
import type { FactId } from "./identity";
import type { ExecutionContractRegistrySources } from "./registrySourceModel";
import type { SemanticRelation } from "./relationModel";
import type {
  ExecutionContractSource,
  ExecutionContractSourceInput,
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
type StrictReadonlyArrayKeys<Value> = {
  [Key in keyof Value]-?: Value[Key] extends readonly unknown[]
    ? Value[Key] extends unknown[]
      ? never
      : Key
    : never;
}[keyof Value];

type ExpectedExecutionContractSourceInput = {
  readonly schema: "dathra.execution/1";
  readonly id: string;
  readonly version: string;
  readonly facts: readonly SemanticFact[];
  readonly relations: readonly SemanticRelation[];
  readonly exports: Readonly<Record<string, ExportExecutionContract>>;
  readonly registries: ExecutionContractRegistrySources;
  readonly hostAssumptionFactIds: readonly FactId[];
};

type OptionalField<Key extends keyof ExpectedExecutionContractSourceInput> =
  Omit<ExpectedExecutionContractSourceInput, Key> & {
    readonly [Property in Key]?: ExpectedExecutionContractSourceInput[Property];
  };

type MutableField<Key extends keyof ExpectedExecutionContractSourceInput> =
  Omit<ExpectedExecutionContractSourceInput, Key> & {
    -readonly [Property in Key]: ExpectedExecutionContractSourceInput[Property];
  };

type ReplaceField<
  Key extends keyof ExpectedExecutionContractSourceInput,
  Value,
> = Omit<ExpectedExecutionContractSourceInput, Key> & {
  readonly [Property in Key]: Value;
};

type MissingRelations = Omit<ExpectedExecutionContractSourceInput, "relations">;
type ExtraBudgetField = ExpectedExecutionContractSourceInput & {
  readonly budget: number;
};
type OptionalVersion = OptionalField<"version">;
type MutableId = MutableField<"id">;
type WidenedVersion = ReplaceField<"version", string | null>;
type WrongSchema = ReplaceField<"schema", "dathra.execution/2">;
type RawStringHostIds = ReplaceField<
  "hostAssumptionFactIds",
  readonly string[]
>;
type MutableFactsArray = ReplaceField<"facts", SemanticFact[]>;
type MutableRelationsArray = ReplaceField<"relations", SemanticRelation[]>;
type MutableHostIdsArray = ReplaceField<"hostAssumptionFactIds", FactId[]>;

type InputHasExactShape = ExpectTrue<
  Equal<
    Copy<ExecutionContractSourceInput>,
    Copy<ExpectedExecutionContractSourceInput>
  >
>;
type InputHasExactKeys = ExpectTrue<
  Equal<
    keyof ExecutionContractSourceInput,
    keyof ExpectedExecutionContractSourceInput
  >
>;
type InputHasNoOptionalKeys = ExpectTrue<
  Equal<OptionalKeys<ExecutionContractSourceInput>, never>
>;
type InputHasOnlyReadonlyKeys = ExpectTrue<
  Equal<
    ReadonlyKeys<ExecutionContractSourceInput>,
    keyof ExpectedExecutionContractSourceInput
  >
>;
type InputHasOnlyExpectedReadonlyArrays = ExpectTrue<
  Equal<
    StrictReadonlyArrayKeys<ExecutionContractSourceInput>,
    "facts" | "relations" | "hostAssumptionFactIds"
  >
>;
type SourceEqualsInput = ExpectTrue<
  Equal<ExecutionContractSource, ExecutionContractSourceInput>
>;
type InputEqualsSource = ExpectTrue<
  Equal<ExecutionContractSourceInput, ExecutionContractSource>
>;

type SchemaTypeIsExact = ExpectTrue<
  Equal<ExecutionContractSourceInput["schema"], "dathra.execution/1">
>;
type IdTypeIsExact = ExpectTrue<
  Equal<ExecutionContractSourceInput["id"], string>
>;
type VersionTypeIsExact = ExpectTrue<
  Equal<ExecutionContractSourceInput["version"], string>
>;
type FactsTypeIsExact = ExpectTrue<
  Equal<ExecutionContractSourceInput["facts"], readonly SemanticFact[]>
>;
type RelationsTypeIsExact = ExpectTrue<
  Equal<ExecutionContractSourceInput["relations"], readonly SemanticRelation[]>
>;
type ExportsTypeIsExact = ExpectTrue<
  Equal<
    ExecutionContractSourceInput["exports"],
    Readonly<Record<string, ExportExecutionContract>>
  >
>;
type RegistriesTypeIsExact = ExpectTrue<
  Equal<
    ExecutionContractSourceInput["registries"],
    ExecutionContractRegistrySources
  >
>;
type HostAssumptionFactIdsTypeIsExact = ExpectTrue<
  Equal<
    ExecutionContractSourceInput["hostAssumptionFactIds"],
    readonly FactId[]
  >
>;

type MissingRelationsIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<MissingRelations>>
>;
type MissingRelationsWitness = ExpectFalse<
  "relations" extends keyof MissingRelations ? true : false
>;
type ExtraBudgetFieldIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<ExtraBudgetField>>
>;
type ExtraBudgetFieldWitness = ExpectTrue<
  "budget" extends keyof ExtraBudgetField ? true : false
>;
type OptionalVersionIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<OptionalVersion>>
>;
type OptionalVersionWitness = ExpectTrue<
  Equal<OptionalKeys<OptionalVersion>, "version">
>;
type MutableIdIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<MutableId>>
>;
type MutableIdWitness = ExpectFalse<
  "id" extends ReadonlyKeys<MutableId> ? true : false
>;
type WidenedVersionIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<WidenedVersion>>
>;
type WidenedVersionWitness = ExpectTrue<
  null extends WidenedVersion["version"] ? true : false
>;
type WrongSchemaIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<WrongSchema>>
>;
type WrongSchemaWitness = ExpectTrue<
  Equal<WrongSchema["schema"], "dathra.execution/2">
>;
type RawStringHostIdsAreRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<RawStringHostIds>>
>;
type RawStringHostIdsWitness = ExpectTrue<
  string extends RawStringHostIds["hostAssumptionFactIds"][number]
    ? true
    : false
>;
type RawStringIsNotFactId = ExpectFalse<string extends FactId ? true : false>;
type MutableFactsArrayIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<MutableFactsArray>>
>;
type MutableFactsArrayWitness = ExpectTrue<
  MutableFactsArray["facts"] extends unknown[] ? true : false
>;
type MutableRelationsArrayIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<MutableRelationsArray>>
>;
type MutableRelationsArrayWitness = ExpectTrue<
  MutableRelationsArray["relations"] extends unknown[] ? true : false
>;
type MutableHostIdsArrayIsRejected = ExpectFalse<
  Equal<Copy<ExecutionContractSourceInput>, Copy<MutableHostIdsArray>>
>;
type MutableHostIdsArrayWitness = ExpectTrue<
  MutableHostIdsArray["hostAssumptionFactIds"] extends unknown[] ? true : false
>;

type ExecutionContractSourceTypeFixture = readonly [
  InputHasExactShape,
  InputHasExactKeys,
  InputHasNoOptionalKeys,
  InputHasOnlyReadonlyKeys,
  InputHasOnlyExpectedReadonlyArrays,
  SourceEqualsInput,
  InputEqualsSource,
  SchemaTypeIsExact,
  IdTypeIsExact,
  VersionTypeIsExact,
  FactsTypeIsExact,
  RelationsTypeIsExact,
  ExportsTypeIsExact,
  RegistriesTypeIsExact,
  HostAssumptionFactIdsTypeIsExact,
  MissingRelationsIsRejected,
  MissingRelationsWitness,
  ExtraBudgetFieldIsRejected,
  ExtraBudgetFieldWitness,
  OptionalVersionIsRejected,
  OptionalVersionWitness,
  MutableIdIsRejected,
  MutableIdWitness,
  WidenedVersionIsRejected,
  WidenedVersionWitness,
  WrongSchemaIsRejected,
  WrongSchemaWitness,
  RawStringHostIdsAreRejected,
  RawStringHostIdsWitness,
  RawStringIsNotFactId,
  MutableFactsArrayIsRejected,
  MutableFactsArrayWitness,
  MutableRelationsArrayIsRejected,
  MutableRelationsArrayWitness,
  MutableHostIdsArrayIsRejected,
  MutableHostIdsArrayWitness,
];

export type { ExecutionContractSourceTypeFixture };
