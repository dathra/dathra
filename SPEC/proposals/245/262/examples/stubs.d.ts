/** Review-only declarations for proposed APIs; there is no production implementation. */
declare module "@dathra/reactivity" {
  export interface Signal<T> {
    readonly value: T;
    set(update: T | ((previous: T) => T)): void;
  }
  export function signal<T>(initialValue: T): Signal<T>;
}

declare module "@dathra/plugin" {
  export function defineDelivery<const R extends Record<string, {
    server: string;
    client?: string;
  }>>(configuration: { routes: R }): { readonly routes: R };
}

declare module "@dathra/core/server" {
  import type { Signal } from "@dathra/reactivity";

  export type JsonValue =
    | null | boolean | number | string
    | readonly JsonValue[]
    | { readonly [name: string]: JsonValue };
  export interface ServerView { readonly environment: "server" }
  export interface TextBinding { readonly kind: "text"; readonly exportName: string }
  export interface EventBinding { readonly kind: "event"; readonly event: string; readonly exportName: string }
  export interface CreationBoundary { readonly kind: "creation"; readonly name: string }
  export interface RequestContext { readonly request: Request }
  export interface ServerRequestContext { readonly request: Request }
  export interface Validator<T extends JsonValue> { parse(value: unknown): T }
  export interface RequestSpec<I extends JsonValue, O extends JsonValue> {
    readonly input: Validator<I>;
    readonly output: Validator<O>;
    handle(input: I, context: ServerRequestContext): O | Promise<O>;
  }
  export interface Occurrence<S, V extends JsonValue, R extends object> extends ServerView {
    readonly state: S;
    readonly values?: V;
    readonly requests?: R;
  }
  export interface ServerRoute { render(request: RequestContext): ServerView }
  export function defineRoute(configuration: ServerRoute): ServerRoute;
  export function occurrence<S, V extends JsonValue, R extends object = {}>(data: {
    state: S;
    values?: V;
    view: ServerView;
    requests?: R;
  }): Occurrence<S, V, R>;
  export function el(
    tag: string,
    attributes: Record<string, string | boolean | EventBinding | CreationBoundary>,
    ...children: ServerView[]
  ): ServerView;
  export function txt(initial: string, binding?: TextBinding): ServerView;
  export function bind(exportName: string): TextBinding;
  export function on(event: string, exportName: string): EventBinding;
  export function creation(name: string): CreationBoundary;
  export function request<I extends JsonValue, O extends JsonValue>(
    specification: RequestSpec<I, O>
  ): RequestSpec<I, O>;
}

declare module "@dathra/core/client" {
  import type { Signal } from "@dathra/reactivity";
  export type DeepReadonlyJson<T> =
    T extends readonly (infer E)[] ? readonly DeepReadonlyJson<E>[] :
    T extends object ? { readonly [K in keyof T]: DeepReadonlyJson<T[K]> } : T;
  export type Restored<S> = {
    readonly [K in keyof S]: S[K] extends Signal<infer V> ? Signal<V> : never;
  };
  export type RequestInput<T> =
    T extends { readonly input: { parse(value: unknown): infer I } } ? I : never;
  export type RequestOutput<T> =
    T extends { readonly output: { parse(value: unknown): infer O } } ? O : never;
  export interface ClientView { readonly environment: "client" }
  export interface ClientContext<S, V, R extends object = {}, C extends string = never> {
    readonly state: Restored<S>;
    readonly values: DeepReadonlyJson<V>;
    request<K extends Extract<keyof R, string>>(
      name: K,
      input: RequestInput<R[K]>
    ): Promise<RequestOutput<R[K]>>;
    create<K extends C>(name: K, factory: () => ClientView): void;
  }
  export function el(tag: string, attributes: Record<string, string | boolean>, ...children: ClientView[]): ClientView;
  export function txt(initial: string): ClientView;
}
