import type { Signal } from "@dathra/reactivity";

type FnMap = Record<string, (ctx: never) => unknown>;
type Names<F> = Extract<keyof F, string>;
type DeepReadonly<T> = T extends string | number | boolean | null | undefined
  ? T
  : T extends readonly (infer E)[]
    ? readonly DeepReadonly<E>[]
    : { readonly [K in keyof T]: DeepReadonly<T[K]> };
interface OwnedSignal<T> {
  readonly __type__: "signal";
  readonly value: DeepReadonly<T>;
  peek(): DeepReadonly<T>;
  set(input: T | DeepReadonly<T> | ((previous: DeepReadonly<T>) => T | DeepReadonly<T>)): void;
}
type OwnedValues<T> =
  T extends Signal<infer P>
    ? OwnedSignal<P>
    : T extends readonly (infer E)[]
      ? readonly OwnedValues<E>[]
      : T extends object
        ? { readonly [K in keyof T]: OwnedValues<T[K]> }
        : T;
type Snapshot<T> =
  T extends Signal<infer P>
    ? { readonly value: DeepReadonly<P>; peek(): DeepReadonly<P> }
    : T extends readonly (infer E)[]
      ? readonly Snapshot<E>[]
      : T extends object
        ? { readonly [K in keyof T]: Snapshot<T[K]> }
        : T;
type Key = string | number;
interface BindingMarker {
  readonly kind: "bind";
  readonly name: string;
  readonly server?: Content;
}
interface EventMarker {
  readonly kind: "on";
  readonly event: string;
  readonly name: string;
}
interface ElementDescription {
  readonly kind: "element";
  readonly tag: string;
}
interface ChildIntent {
  readonly kind: "created";
}
interface ServerView {
  readonly kind: "component";
}
type Content =
  | string
  | number
  | boolean
  | null
  | ElementDescription
  | BindingMarker
  | ChildIntent
  | ServerView
  | readonly Content[];
type Concurrency = "parallel" | "replace" | "join" | "queue";
interface EventOptions {
  capture?: boolean;
  passive?: boolean;
  once?: boolean;
  preventDefault?: boolean;
  channel?: string;
  concurrency?: Concurrency;
}
interface BindingOptions<N extends string> {
  server?: Content;
  input?: { sink: N; group?: string };
}
interface Tools<N extends string> {
  bind(name: N, options?: BindingOptions<N>): BindingMarker;
  on(event: string, name: N, options?: EventOptions): EventMarker;
  id(local: string): string;
}
interface ServerTools<N extends string> extends Omit<Tools<N>, "bind"> {
  bind(name: N, options: BindingOptions<N> & { server: Content }): BindingMarker;
}
interface ClientContext<V, _R = unknown, _D = unknown, I = unknown, N extends string = string> {
  readonly values: OwnedValues<V>;
  readonly received: DeepReadonly<I>;
  readonly ui: Tools<N>;
  readonly input: { readonly value: string; readonly reason: "input" | "reset" | "adopt" };
  readonly event: { readonly ref: string | undefined; readonly detail: unknown };
  run<F extends () => unknown>(
    fn: F & (Extract<ReturnType<F>, PromiseLike<unknown>> extends never ? unknown : never),
  ): ReturnType<F> | undefined;
}
interface ClientDefinition<F extends FnMap = FnMap> {
  readonly functions: F;
}
interface CreationProfile<F extends FnMap, I, V> {
  input(raw: unknown): I;
  initialize(input: I): V;
  receive?: Names<F>;
  template(values: Snapshot<NoInfer<V>>, tools: Tools<Names<NoInfer<F>>>): Content;
}
interface CreatedClientDefinition<F extends FnMap, I, V> extends ClientDefinition<F> {
  readonly create: CreationProfile<F, I, V>;
}
interface ClientModule<C extends ClientDefinition = ClientDefinition> {
  readonly specifier: string;
  readonly baseURL: string;
  readonly __clientType?: C;
}
type RequiredValues<F> = F extends (ctx: infer C) => unknown
  ? C extends { readonly values: infer V }
    ? V
    : never
  : never;
type RequiredReceived<F> = F extends (ctx: infer C) => unknown
  ? C extends { readonly received: infer I }
    ? I
    : unknown
  : unknown;
type AllRequiredReceived<F> = UnionToIntersection<
  {
    [K in keyof F]: RequiredReceived<F[K]>;
  }[keyof F]
>;
type CompatibleReceived<F, I> =
  DeepReadonly<I> extends AllRequiredReceived<F>
    ? unknown
    : { readonly INPUT_TYPE_MISMATCH: never };
type UnionToIntersection<U> = (U extends unknown ? (item: U) => void : never) extends (
  item: infer I,
) => void
  ? I
  : never;
type AllRequiredValues<F> = UnionToIntersection<
  {
    [K in keyof F]: RequiredValues<F[K]>;
  }[keyof F]
>;
type CompatibleValues<F, V> =
  OwnedValues<V> extends AllRequiredValues<F> ? unknown : { readonly STATE_TYPE_MISMATCH: never };
interface ComponentSpec<C extends ClientDefinition, I, V> {
  client: ClientModule<C>;
  input?: (raw: unknown) => I;
  server(input: I, request: Request): V | Promise<V>;
  template(
    values: Snapshot<NoInfer<V>>,
    tools: ServerTools<Names<C["functions"]>>,
    request: Request,
  ): Content | Promise<Content>;
}
interface Component<I> {
  (input: I, request: Request, options?: { _key?: Key }): Promise<ServerView>;
}
interface ElementAttributes {
  readonly [name: string]: unknown;
  _key?: Key;
  _ref?: string;
  _ns?: string;
  on?: readonly EventMarker[];
  props?: Readonly<Record<string, string | number | boolean | null | BindingMarker>>;
}
export type {
  FnMap,
  Names,
  DeepReadonly,
  OwnedSignal,
  OwnedValues,
  Snapshot,
  Key,
  Content,
  ClientContext,
  Tools,
  ServerTools,
  ClientDefinition,
  CreatedClientDefinition,
  CreationProfile,
  ClientModule,
  CompatibleValues,
  CompatibleReceived,
  ComponentSpec,
  Component,
  ElementAttributes,
  ElementDescription,
  ChildIntent,
  BindingMarker,
  EventMarker,
};
