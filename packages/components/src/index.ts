// Web Components high-level API
export {
  adoptGlobalStyles,
  clearGlobalStyles,
  css,
  getCssText,
} from "@/css/implementation";
export type { DathraStyleSheet } from "@/css/implementation";
export { defineComponent } from "@/defineComponent/implementation";
export type {
  ComponentClass,
  ComponentConstructor,
  ComponentContext,
  ComponentElement,
  ComponentMetadata,
  ComponentOptions,
  DefinedComponent,
  FunctionComponent,
  HydrateSetupFunction,
  InferProps,
  InferPropType,
  JSXComponent,
  JSXComponentProps,
  JSXPropValue,
  JSXReactiveValue,
  PropDefinition,
  PropsSchema,
  PropType,
} from "@/defineComponent/implementation";
export { bindStoreToHost } from "@/defineComponent/internal";
export {
  clearRegistry,
  getComponent,
  hasComponent,
  registerComponent,
} from "@/registry/implementation";
export type { ComponentRegistration } from "@/registry/implementation";
