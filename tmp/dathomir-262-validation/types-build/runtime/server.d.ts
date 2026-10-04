import type {
  ClientDefinition,
  ClientModule,
  ComponentSpec,
  CompatibleValues,
  Component,
  ElementAttributes,
  Content,
  ElementDescription,
  Snapshot,
} from "./contracts.js";
declare function clientModule<C extends ClientDefinition = ClientDefinition>(
  specifier: string,
  baseURL: string,
): ClientModule<C>;
declare function defineComponent<C extends ClientDefinition, I, V>(
  spec: ComponentSpec<C, I, V> & CompatibleValues<NoInfer<C["functions"]>, NoInfer<V>>,
): Component<I>;
declare function defineComponent<I, V>(spec: {
  server(input: I, request: Request): V | Promise<V>;
  template(
    values: Snapshot<NoInfer<V>>,
    tools: never,
    request: Request,
  ): Content | Promise<Content>;
}): Component<I>;
declare function el(
  tag: string,
  attributes: ElementAttributes,
  ...children: Content[]
): ElementDescription;
declare function defineRoute(spec: { render(request: Request): Content | Promise<Content> }): {
  render(request: Request): Content | Promise<Content>;
};
export { clientModule, defineComponent, el, defineRoute };
