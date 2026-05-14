/**
 * Benchmarks for reactivity primitives (signal, computed, effect, batch, templateEffect).
 */
import {
  batch,
  computed,
  createRoot,
  effect,
  signal,
  templateEffect,
} from "@dathra/reactivity";
import { bench, describe } from "vitest";

describe("signal - read/write", () => {
  bench("read signal 1000 times", () => {
    const s = signal(0);
    for (let i = 0; i < 1000; i++) {
      void s.value;
    }
  });

  bench("write signal 1000 times", () => {
    const s = signal(0);
    for (let i = 0; i < 1000; i++) {
      s.set(i);
    }
  });
});

describe("computed - derivation", () => {
  bench("computed recalculation on dependency change", () => {
    const s = signal(0);
    const derived = computed(() => s.value * 2);
    for (let i = 0; i < 1000; i++) {
      s.set(i);
      void derived.value;
    }
  });

  bench("computed chain (3 levels)", () => {
    const s = signal(0);
    const a = computed(() => s.value + 1);
    const b = computed(() => a.value * 2);
    const c = computed(() => b.value + 10);
    for (let i = 0; i < 1000; i++) {
      s.set(i);
      void c.value;
    }
  });

  bench("computed with multiple dependencies", () => {
    const sA = signal(0);
    const sB = signal(0);
    const sC = signal(0);
    const derived = computed(() => sA.value + sB.value + sC.value);
    for (let i = 0; i < 1000; i++) {
      sA.set(i);
      sB.set(i);
      sC.set(i);
      void derived.value;
    }
  });
});

describe("effect - execution", () => {
  bench("effect triggered by signal change", () => {
    createRoot(() => {
      const s = signal(0);
      let count = 0;
      effect(() => {
        count += s.value;
      });
      for (let i = 1; i <= 1000; i++) {
        s.set(i);
      }
      // Prevent dead code elimination
      return count;
    });
  });

  bench("effect with multiple dependencies", () => {
    createRoot(() => {
      const sA = signal(0);
      const sB = signal(0);
      let count = 0;
      effect(() => {
        count += sA.value + sB.value;
      });
      for (let i = 1; i <= 500; i++) {
        sA.set(i);
        sB.set(i);
      }
      return count;
    });
  });
});

describe("batch - grouped updates", () => {
  bench("batch 10 signal updates", () => {
    const signals = Array.from({ length: 10 }, () => signal(0));
    const derived = computed(() =>
      signals.reduce((sum, s) => sum + s.value, 0),
    );
    for (let i = 0; i < 100; i++) {
      batch(() => {
        for (const s of signals) {
          s.set(i);
        }
      });
      void derived.value;
    }
  });

  bench("batch 100 signal updates", () => {
    const signals = Array.from({ length: 100 }, () => signal(0));
    const derived = computed(() =>
      signals.reduce((sum, s) => sum + s.value, 0),
    );
    for (let i = 0; i < 10; i++) {
      batch(() => {
        for (const s of signals) {
          s.set(i);
        }
      });
      void derived.value;
    }
  });
});

describe("templateEffect vs effect", () => {
  bench("templateEffect execution", () => {
    createRoot(() => {
      const s = signal(0);
      let count = 0;
      templateEffect(() => {
        count += s.value;
      });
      for (let i = 1; i <= 1000; i++) {
        s.set(i);
      }
      return count;
    });
  });

  bench("effect execution (baseline)", () => {
    createRoot(() => {
      const s = signal(0);
      let count = 0;
      effect(() => {
        count += s.value;
      });
      for (let i = 1; i <= 1000; i++) {
        s.set(i);
      }
      return count;
    });
  });
});
