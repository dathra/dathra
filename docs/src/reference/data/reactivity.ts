import type { ReferenceDocument } from "../types";

const reactivityReference: ReferenceDocument = {
  path: "/reference/reactivity",
  title: "Reactivity API Reference",
  packageName: "@dathra/reactivity",
  exportPath: "@dathra/reactivity",
  importPath: "@dathra/reactivity",
  preferredImport: "@dathra/core/reactivity",
  level: "recommended",
  audience: "Application authors, framework integrators, and Dathra contributors.",
  description:
    "Fine-grained reactive primitives for mutable signals, cached derivations, effects, batching, and cleanup scopes.",
  declarationFile: "packages/reactivity/dist/index.d.mts",
  exports: [
    {
      label: "Functions",
      items: ["batch", "computed", "createRoot", "effect", "onCleanup", "signal", "templateEffect"],
    },
    {
      label: "Types",
      items: ["Computed", "EffectCleanup", "Owner", "RootDispose", "Signal", "SignalUpdate"],
    },
  ],
  apis: [
    {
      name: "signal()",
      kind: "function",
      description:
        "Create a mutable reactive value. Reads through `.value` are tracked; `.peek()` reads without tracking.",
      signature: `declare function signal<T>(initialValue: T): Signal<T>;

type SignalUpdate<T> = T | ((prev: T) => T);

interface Signal<T> {
  readonly value: T;
  set(update: SignalUpdate<T>): void;
  peek(): T;
  readonly __type__: "signal";
}`,
      parameters: [
        { name: "initialValue", type: "T", description: "Initial value stored by the signal." },
      ],
      returns: "A Signal<T> instance.",
      example: `import { signal } from "@dathra/core/reactivity";

const count = signal(0);
count.set((previous) => previous + 1);

console.log(count.value);`,
    },
    {
      name: "computed()",
      kind: "function",
      description:
        "Create a cached derived value that recomputes when tracked dependencies change.",
      signature: `declare function computed<T>(getter: (previousValue?: T) => T): Computed<T>;

interface Computed<T> {
  readonly value: T;
  peek(): T;
  readonly __type__: "computed";
}`,
      parameters: [
        {
          name: "getter",
          type: "(previousValue?: T) => T",
          description:
            "Derivation function. Signal and computed reads inside the getter become dependencies.",
        },
      ],
      returns: "A lazily evaluated Computed<T> value.",
      example: `import { computed, signal } from "@dathra/core/reactivity";

const count = signal(2);
const doubled = computed(() => count.value * 2);

console.log(doubled.value);`,
    },
    {
      name: "effect()",
      kind: "function",
      description:
        "Run a side effect immediately and rerun it whenever tracked dependencies change.",
      signature: `declare function effect(fn: () => void): EffectCleanup;

type EffectCleanup = () => void;`,
      parameters: [
        { name: "fn", type: "() => void", description: "Effect body to execute and track." },
      ],
      returns: "A cleanup function that stops the effect.",
      example: `import { effect, signal } from "@dathra/core/reactivity";

const count = signal(0);

const stop = effect(() => {
  console.log(count.value);
});

stop();`,
    },
    {
      name: "batch()",
      kind: "function",
      description: "Execute a callback while batching signal notifications into a single flush.",
      signature: "declare function batch<T>(fn: () => T): T;",
      parameters: [
        { name: "fn", type: "() => T", description: "Callback to run within the batch." },
      ],
      returns: "The callback result.",
    },
    {
      name: "createRoot()",
      kind: "function",
      description: "Create a cleanup scope that tracks effects and cleanup functions.",
      signature: `declare function createRoot(fn: (dispose: RootDispose) => void): RootDispose;

type RootDispose = () => void;

interface Owner {
  effects: (() => void)[];
  cleanups: (() => void)[];
}`,
      parameters: [
        {
          name: "fn",
          type: "(dispose: RootDispose) => void",
          description: "Callback to run within the cleanup scope.",
        },
      ],
      returns: "A RootDispose function that cleans up all tracked effects and cleanups.",
    },
    {
      name: "onCleanup()",
      kind: "function",
      description: "Register a cleanup function in the current effect or root cleanup scope.",
      signature: "declare function onCleanup(fn: () => void): void;",
      parameters: [
        { name: "fn", type: "() => void", description: "Cleanup function to register." },
      ],
      returns: "void",
    },
    {
      name: "templateEffect()",
      kind: "function",
      description: "Register an effect designed for template updates and owner-scope tracking.",
      signature: "declare function templateEffect(fn: () => void): void;",
      parameters: [
        {
          name: "fn",
          type: "() => void",
          description: "Template update callback to execute and track.",
        },
      ],
      returns: "void",
      notes: ["This API is primarily used by Dathra's DOM runtime and component renderer."],
    },
  ],
};

export { reactivityReference };
