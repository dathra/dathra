/** Text-only binding evaluator fixture; all-name registry invocation remains legal. */
import type { Context } from "./phases.ts";

class BindingEvaluator {
  readonly rejections: unknown[] = [];
  evaluate(operation: (context: Context) => unknown, context: Context): string | null {
    const result = operation(context);
    if (result instanceof Promise) {
      // Observation is attached synchronously, before rejecting the content result.
      result.catch(cause => this.rejections.push(cause));
      throw new Error("binding-promise-content");
    }
    if (typeof result !== "string" && result !== null) throw new Error("invalid-text-binding-content");
    return result;
  }
}

export { BindingEvaluator };
