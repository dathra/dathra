/**
 * Function Component type definition.
 * Similar to React.FC, for defining component functions that return DOM nodes.
 *
 * @example
 * ```tsx
 * import { type FC } from "@dathra/runtime";
 *
 * const Counter: FC<{ count: number }> = ({ count }) => {
 *   return <div>{count}</div>;
 * };
 * ```
 */
export type FC<P = Record<string, unknown>> = (props: P) => Node;

/**
 * Function Component with children support.
 * Automatically includes children prop in the props type.
 *
 * @example
 * ```tsx
 * const Container: FCWithChildren<{ title: string }> = ({ title, children }) => {
 *   return (
 *     <div>
 *       <h1>{title}</h1>
 *       {children}
 *     </div>
 *   );
 * };
 * ```
 */
export type FCWithChildren<P = Record<string, unknown>> = FC<
  P & { children?: unknown }
>;
