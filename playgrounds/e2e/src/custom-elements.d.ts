export {};

declare global {
  namespace JSX {
    interface IntrinsicElements {
      "demo-counter-box": Record<string, unknown>;
    }
  }
}

declare module "@dathra/core/jsx-runtime" {
  namespace JSX {
    interface IntrinsicElements {
      "demo-counter-box": Record<string, unknown>;
    }
  }
}
