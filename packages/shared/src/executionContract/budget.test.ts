import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { ModuleKind, ScriptTarget, transpileModule } from "typescript";
import { describe, expect, it, vi } from "vitest";

import {
  BudgetLedger,
  DEFAULT_EXECUTION_CONTRACT_BUDGET,
  createBudgetLedger,
  type BudgetCounter,
  type ExecutionContractBudget,
} from "./budget";
import { ExecutionContractError } from "./implementation";

const EXPECTED_DEFAULT_BUDGET = {
  maximumInputDepth: 64,
  maximumInputDataNodes: 200_000,
  maximumInputProperties: 1_000_000,
  maximumInputArrayLength: 200_000,
  maximumInputStringCodeUnits: 20_000_000,
  maximumFacts: 200_000,
  maximumRelations: 200_000,
  maximumExports: 200_000,
  maximumRegistryEntries: 200_000,
  maximumRegistryImplementations: 400_000,
  maximumReferences: 10_000_000,
  maximumSemanticPathSegments: 2_000_000,
  maximumCanonicalBytes: 200_000_000,
  maximumCanonicalWorkSteps: 20_000_000,
  maximumValidationSteps: 20_000_000,
} as const satisfies Required<ExecutionContractBudget>;

const CUMULATIVE_COUNTERS = Object.keys(EXPECTED_DEFAULT_BUDGET).filter(
  (counter): counter is Exclude<BudgetCounter, "maximumInputDepth"> =>
    counter !== "maximumInputDepth",
);

function expectExecutionContractError(
  operation: () => unknown,
  code: ExecutionContractError["code"],
  path: readonly (string | number)[],
): ExecutionContractError {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof ExecutionContractError)) throw error;
    if (error.code !== code) {
      throw new Error(`Expected error code ${code}, received ${error.code}`);
    }
    if (
      error.path.length !== path.length ||
      error.path.some((segment, index) => segment !== path[index])
    ) {
      throw new Error(
        `Expected error path ${JSON.stringify(path)}, received ${JSON.stringify(error.path)}`,
      );
    }
    return error;
  }
  throw new Error("Expected an ExecutionContractError");
}

function dataProperty(value: unknown): PropertyDescriptor {
  return {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  };
}

describe("execution contract budget override", () => {
  it("fixes all fifteen framework hard caps", () => {
    expect(DEFAULT_EXECUTION_CONTRACT_BUDGET).toEqual(EXPECTED_DEFAULT_BUDGET);
    expect(Object.keys(DEFAULT_EXECUTION_CONTRACT_BUDGET)).toHaveLength(15);

    const depthLedger = createBudgetLedger();
    depthLedger.observePeak(
      "maximumInputDepth",
      EXPECTED_DEFAULT_BUDGET.maximumInputDepth,
      ["root"],
    );
    expectExecutionContractError(
      () =>
        depthLedger.observePeak(
          "maximumInputDepth",
          EXPECTED_DEFAULT_BUDGET.maximumInputDepth + 1,
          ["root"],
        ),
      "budget-exceeded",
      ["root"],
    );

    for (const counter of CUMULATIVE_COUNTERS) {
      const ledger = createBudgetLedger();
      ledger.chargeTotal(counter, EXPECTED_DEFAULT_BUDGET[counter], [counter]);
      expectExecutionContractError(
        () => ledger.chargeTotal(counter, 1, [counter]),
        "budget-exceeded",
        [counter],
      );
    }
  });

  it("accepts ordinary and null-prototype narrow-only overrides including zero", () => {
    const ordinaryLedger = createBudgetLedger({ maximumFacts: 1 });
    ordinaryLedger.chargeTotal("maximumFacts", 1, []);

    const nullPrototypeBudget: object = Object.create(null);
    Reflect.defineProperty(
      nullPrototypeBudget,
      "maximumRelations",
      dataProperty(0),
    );
    const nullPrototypeLedger = Reflect.apply(createBudgetLedger, undefined, [
      nullPrototypeBudget,
    ]);
    nullPrototypeLedger.chargeTotal("maximumRelations", 0, []);
    expectExecutionContractError(
      () => nullPrototypeLedger.chargeTotal("maximumRelations", 1, []),
      "budget-exceeded",
      [],
    );

    const zeroDepthLedger = createBudgetLedger({ maximumInputDepth: 0 });
    expectExecutionContractError(
      () => zeroDepthLedger.observePeak("maximumInputDepth", 1, []),
      "budget-exceeded",
      [],
    );
    for (const counter of CUMULATIVE_COUNTERS) {
      const zeroBudget = {};
      Reflect.defineProperty(zeroBudget, counter, dataProperty(0));
      const zeroLedger = Reflect.apply(createBudgetLedger, undefined, [
        zeroBudget,
      ]);
      zeroLedger.chargeTotal(counter, 0, []);
      expectExecutionContractError(
        () => zeroLedger.chargeTotal(counter, 1, []),
        "budget-exceeded",
        [],
      );
    }
  });

  it("rejects expansion of every framework hard cap", () => {
    for (const [counter, hardCap] of Object.entries(EXPECTED_DEFAULT_BUDGET)) {
      const budget = {};
      Reflect.defineProperty(budget, counter, dataProperty(hardCap + 1));
      expectExecutionContractError(
        () => Reflect.apply(createBudgetLedger, undefined, [budget]),
        "invalid-field",
        ["budget", counter],
      );
    }
  });

  it.each([null, 0, "budget", [], new Date(), Object.create({})])(
    "rejects a non-record or custom-prototype budget %# at the budget root",
    (budget) => {
      expectExecutionContractError(
        () => Reflect.apply(createBudgetLedger, undefined, [budget]),
        "invalid-closed-record",
        ["budget"],
      );
    },
  );

  it("rejects extra and symbol fields at their field paths", () => {
    expectExecutionContractError(
      () =>
        Reflect.apply(createBudgetLedger, undefined, [{ maximumClosures: 1 }]),
      "invalid-field",
      ["budget", "maximumClosures"],
    );

    const symbol = Symbol("extra");
    const budget = { maximumFacts: 1 };
    Reflect.defineProperty(budget, symbol, dataProperty(1));
    expectExecutionContractError(
      () => createBudgetLedger(budget),
      "invalid-field",
      ["budget", String(symbol)],
    );
  });

  it("rejects hidden and accessor fields without invoking a getter", () => {
    const hidden = {};
    Reflect.defineProperty(hidden, "maximumFacts", {
      ...dataProperty(1),
      enumerable: false,
    });
    expectExecutionContractError(
      () => createBudgetLedger(hidden),
      "invalid-closed-record",
      ["budget", "maximumFacts"],
    );

    const getter = vi.fn(() => 1);
    const accessor = {};
    Reflect.defineProperty(accessor, "maximumFacts", {
      configurable: true,
      enumerable: true,
      get: getter,
    });
    expectExecutionContractError(
      () => createBudgetLedger(accessor),
      "invalid-closed-record",
      ["budget", "maximumFacts"],
    );
    expect(getter).not.toHaveBeenCalled();
  });

  it.each([
    undefined,
    null,
    "1",
    -1,
    0.5,
    Number.NaN,
    Number.POSITIVE_INFINITY,
    Number.MAX_SAFE_INTEGER + 1,
    EXPECTED_DEFAULT_BUDGET.maximumFacts + 1,
  ])("rejects invalid present values %# at the field", (value) => {
    const budget = {};
    Reflect.defineProperty(budget, "maximumFacts", dataProperty(value));
    expectExecutionContractError(
      () => createBudgetLedger(budget),
      "invalid-field",
      ["budget", "maximumFacts"],
    );
  });

  it("converts throwing budget reflection to stable root and field failures", () => {
    const prototypeFailure = new Proxy(
      {},
      {
        getPrototypeOf() {
          throw new Error("prototype trap");
        },
      },
    );
    expectExecutionContractError(
      () => createBudgetLedger(prototypeFailure),
      "invalid-closed-record",
      ["budget"],
    );

    const ownKeysFailure = new Proxy(
      {},
      {
        ownKeys() {
          throw new Error("ownKeys trap");
        },
      },
    );
    expectExecutionContractError(
      () => createBudgetLedger(ownKeysFailure),
      "invalid-closed-record",
      ["budget"],
    );

    const descriptorFailure = new Proxy(
      { maximumFacts: 1 },
      {
        getOwnPropertyDescriptor() {
          throw new Error("descriptor trap");
        },
      },
    );
    expectExecutionContractError(
      () => createBudgetLedger(descriptorFailure),
      "invalid-closed-record",
      ["budget", "maximumFacts"],
    );

    const disappearingDescriptor = new Proxy(
      {},
      {
        ownKeys() {
          return ["maximumFacts"];
        },
        getOwnPropertyDescriptor() {
          return undefined;
        },
      },
    );
    expectExecutionContractError(
      () => createBudgetLedger(disappearingDescriptor),
      "invalid-closed-record",
      ["budget", "maximumFacts"],
    );
  });
});

describe("operation-local budget ledger", () => {
  it("charges cumulative counters and does not apply a failed increment", () => {
    const ledger = createBudgetLedger({ maximumFacts: 3 });
    ledger.chargeTotal("maximumFacts", 1, ["facts"]);

    const error = expectExecutionContractError(
      () => ledger.chargeTotal("maximumFacts", 3, ["facts", 1]),
      "budget-exceeded",
      ["facts", 1],
    );
    expect(error.message).toContain("maximumFacts");
    expect(error.message).toContain("limit 3");
    expect(error.message).toContain("attempted 4");

    ledger.chargeTotal("maximumFacts", 2, ["facts"]);
  });

  it("observes input depth as a one-based peak instead of a cumulative total", () => {
    const ledger = createBudgetLedger({ maximumInputDepth: 2 });
    ledger.observePeak("maximumInputDepth", 1, ["child"]);
    ledger.observePeak("maximumInputDepth", 2, ["child", "leaf"]);
    ledger.observePeak("maximumInputDepth", 1, ["sibling"]);
    ledger.observePeak("maximumInputDepth", 2, ["sibling", "leaf"]);

    const error = expectExecutionContractError(
      () => ledger.observePeak("maximumInputDepth", 3, ["child", "leaf", "x"]),
      "budget-exceeded",
      ["child", "leaf", "x"],
    );
    expect(error.message).toContain("maximumInputDepth");
    expect(error.message).toContain("limit 2");
    expect(error.message).toContain("attempted 3");

    ledger.observePeak("maximumInputDepth", 2, ["after-failure"]);
  });

  it("reports an exact attempted total without overflowing a safe integer", () => {
    const ledger = createBudgetLedger();
    ledger.chargeTotal("maximumFacts", 1, []);
    const error = expectExecutionContractError(
      () => ledger.chargeTotal("maximumFacts", Number.MAX_SAFE_INTEGER, []),
      "budget-exceeded",
      [],
    );

    expect(error.message).toContain("attempted 9007199254740992");
    ledger.chargeTotal(
      "maximumFacts",
      EXPECTED_DEFAULT_BUDGET.maximumFacts - 1,
      [],
    );
  });

  it.each([-1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid internal cumulative charge %# without applying it",
    (amount) => {
      const ledger = createBudgetLedger({ maximumFacts: 1 });
      expect(() => ledger.chargeTotal("maximumFacts", amount, [])).toThrow(
        TypeError,
      );
      ledger.chargeTotal("maximumFacts", 1, []);
    },
  );

  it.each([0, -1, 0.5, Number.MAX_SAFE_INTEGER + 1])(
    "rejects an invalid one-based internal depth %# without applying it",
    (depth) => {
      const ledger = createBudgetLedger({ maximumInputDepth: 1 });
      expect(() => ledger.observePeak("maximumInputDepth", depth, [])).toThrow(
        TypeError,
      );
      ledger.observePeak("maximumInputDepth", 1, []);
    },
  );

  it("isolates fresh operations and provides no nested reset", () => {
    const first = createBudgetLedger({ maximumExports: 1 });
    const second = createBudgetLedger({ maximumExports: 1 });
    first.chargeTotal("maximumExports", 1, []);
    second.chargeTotal("maximumExports", 1, []);

    expect(first).toBeInstanceOf(BudgetLedger);
    expect(second).toBeInstanceOf(BudgetLedger);
    expect(first).not.toBe(second);
    expect("reset" in first).toBe(false);
  });
});

describe("budget publication boundary", () => {
  it("keeps the type fixture free of runtime code", () => {
    const source = readFileSync(
      new URL("./budget.type-fixture.ts", import.meta.url),
      "utf8",
    );
    const output = transpileModule(source, {
      compilerOptions: {
        module: ModuleKind.ESNext,
        target: ScriptTarget.ES2024,
        verbatimModuleSyntax: true,
      },
      fileName: "budget.type-fixture.ts",
    }).outputText;

    expect(output.trim()).toBe("export {};");
  });

  it("keeps budget internals absent from shared-root generated declarations", () => {
    const rootSource = readFileSync(
      new URL("../index.ts", import.meta.url),
      "utf8",
    );
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-execution-contract-budget-"),
    );

    expect(rootSource).not.toContain("./executionContract/implementation");

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsdown", "--out-dir", outputDirectory, "--logLevel", "error"],
        { cwd: packageRoot, stdio: "pipe" },
      );

      for (const declarationFile of ["index.d.mts", "index.d.cts"]) {
        const declaration = readFileSync(
          join(outputDirectory, declarationFile),
          "utf8",
        );
        expect(declaration).not.toContain("ExecutionContractBudget");
        expect(declaration).not.toContain("BudgetLedger");
        expect(declaration).not.toContain("createBudgetLedger");
        expect(declaration).not.toContain("maximumCanonicalWorkSteps");
      }
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  }, 30_000);
});
