import type {
  FnMap,
  ClientDefinition,
  CreatedClientDefinition,
  CreationProfile,
  CompatibleValues,
  CompatibleReceived,
  ElementAttributes,
  Content,
  ElementDescription,
  ChildIntent,
  Key,
} from "./contracts.js";
declare function defineClient<const F extends FnMap>(functions: F): ClientDefinition<F>;
declare function defineClient<const F extends FnMap, I, V>(
  functions: F,
  options: { create: CreationProfile<NoInfer<F>, I, V> } & CompatibleValues<
    NoInfer<F>,
    NoInfer<V>
  > &
    CompatibleReceived<NoInfer<F>, NoInfer<I>>,
): CreatedClientDefinition<F, I, V>;
declare function el(
  tag: string,
  attributes: ElementAttributes,
  ...children: Content[]
): ElementDescription;
declare function createComponent<F extends FnMap, I, V>(
  client: CreatedClientDefinition<F, I, V>,
  options: { _key: Key; input: NoInfer<I> },
): ChildIntent;
export type {
  ClientContext,
  OwnedValues,
  OwnedSignal,
  DeepReadonly,
  BindingMarker,
  EventMarker,
} from "./contracts.js";
export { defineClient, el, createComponent };
