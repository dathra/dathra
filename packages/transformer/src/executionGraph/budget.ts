import { fail, isDataRecord, type ValidationPath } from "./model";

/** Optional hard limits applied while validating and deriving a graph. */
interface ExecutionGraphBudget {
  readonly maximumInputDepth?: number;
  readonly maximumInputDataNodes?: number;
  readonly maximumInputProperties?: number;
  readonly maximumInputArrayLength?: number;
  readonly maximumInputStringCodeUnits?: number;
  readonly maximumDependencyContracts?: number;
  readonly maximumDependencyModuleRecords?: number;
  readonly maximumRecordsPerKind?: number;
  readonly maximumCanonicalBytes?: number;
  readonly maximumValidationSteps?: number;
  readonly maximumDerivationFacts?: number;
  readonly maximumTraversalSteps?: number;
  readonly maximumSupportChecks?: number;
  readonly maximumDerivedSupports?: number;
  readonly maximumPathSteps?: number;
  readonly maximumSccSteps?: number;
  readonly maximumIndexSteps?: number;
}

interface ResolvedExecutionGraphBudget {
  readonly maximumInputDepth: number;
  readonly maximumInputDataNodes: number;
  readonly maximumInputProperties: number;
  readonly maximumInputArrayLength: number;
  readonly maximumInputStringCodeUnits: number;
  readonly maximumDependencyContracts: number;
  readonly maximumDependencyModuleRecords: number;
  readonly maximumRecordsPerKind: number;
  readonly maximumCanonicalBytes: number;
  readonly maximumValidationSteps: number;
  readonly maximumDerivationFacts: number;
  readonly maximumTraversalSteps: number;
  readonly maximumSupportChecks: number;
  readonly maximumDerivedSupports: number;
  readonly maximumPathSteps: number;
  readonly maximumSccSteps: number;
  readonly maximumIndexSteps: number;
}

const DEFAULT_BUDGET: ResolvedExecutionGraphBudget = Object.freeze({
  maximumInputDepth: 64,
  maximumInputDataNodes: 200_000,
  maximumInputProperties: 1_000_000,
  maximumInputArrayLength: 200_000,
  maximumInputStringCodeUnits: 20_000_000,
  maximumDependencyContracts: 20_000,
  maximumDependencyModuleRecords: 2_000_000,
  maximumRecordsPerKind: 200_000,
  maximumCanonicalBytes: 200_000_000,
  maximumValidationSteps: 20_000_000,
  maximumDerivationFacts: 2_000_000,
  maximumTraversalSteps: 10_000_000,
  maximumSupportChecks: 10_000_000,
  maximumDerivedSupports: 2_000_000,
  maximumPathSteps: 10_000_000,
  maximumSccSteps: 10_000_000,
  maximumIndexSteps: 10_000_000,
});

const BUDGET_FIELDS = [
  "maximumInputDepth",
  "maximumInputDataNodes",
  "maximumInputProperties",
  "maximumInputArrayLength",
  "maximumInputStringCodeUnits",
  "maximumDependencyContracts",
  "maximumDependencyModuleRecords",
  "maximumRecordsPerKind",
  "maximumCanonicalBytes",
  "maximumValidationSteps",
  "maximumDerivationFacts",
  "maximumTraversalSteps",
  "maximumSupportChecks",
  "maximumDerivedSupports",
  "maximumPathSteps",
  "maximumSccSteps",
  "maximumIndexSteps",
] as const;

type BudgetField = (typeof BUDGET_FIELDS)[number];

function isBudgetField(value: string): value is BudgetField {
  return BUDGET_FIELDS.some((field) => field === value);
}

function resolveBudget(
  value: ExecutionGraphBudget | undefined,
): ResolvedExecutionGraphBudget {
  if (value === undefined) return DEFAULT_BUDGET;
  if (
    !isDataRecord(value) ||
    Object.getPrototypeOf(value) !== Object.prototype
  ) {
    fail("invalid-closed-record", ["budget"], "Expected a plain budget record");
  }
  const descriptors = Object.getOwnPropertyDescriptors(value);
  const overrides: Partial<Record<BudgetField, number>> = {};
  for (const key of Reflect.ownKeys(descriptors)) {
    if (typeof key !== "string" || !isBudgetField(key)) {
      fail("invalid-field", ["budget", String(key)], "Unexpected budget field");
    }
    const descriptor = descriptors[key];
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      fail(
        "invalid-closed-record",
        ["budget", key],
        "Budget fields must be enumerable data properties",
      );
    }
    if (
      typeof descriptor.value !== "number" ||
      !Number.isSafeInteger(descriptor.value) ||
      descriptor.value < 0
    ) {
      fail(
        "invalid-field",
        ["budget", key],
        "Budget values must be non-negative safe integers",
      );
    }
    if (descriptor.value > DEFAULT_BUDGET[key]) {
      fail(
        "invalid-field",
        ["budget", key],
        "Budget overrides may only narrow the framework hard cap",
      );
    }
    overrides[key] = descriptor.value;
  }
  const result: ResolvedExecutionGraphBudget = {
    ...DEFAULT_BUDGET,
    ...overrides,
  };
  Object.freeze(result);
  return result;
}

class BudgetLedger {
  readonly limits: ResolvedExecutionGraphBudget;
  private readonly usage: Partial<Record<BudgetField, number>> = {};

  constructor(limits: ResolvedExecutionGraphBudget) {
    this.limits = limits;
  }

  charge(
    field: BudgetField,
    amount: number,
    path: ValidationPath,
    detail: string,
  ): void {
    if (!Number.isSafeInteger(amount) || amount < 0) {
      throw new Error("Invalid internal budget charge");
    }
    const next = (this.usage[field] ?? 0) + amount;
    if (!Number.isSafeInteger(next) || next > this.limits[field]) {
      fail("budget-exceeded", path, detail);
    }
    this.usage[field] = next;
  }

  assertWithin(
    field: BudgetField,
    value: number,
    path: ValidationPath,
    detail: string,
  ): void {
    if (!Number.isSafeInteger(value) || value < 0) {
      throw new Error("Invalid internal budget value");
    }
    if (value > this.limits[field]) {
      fail("budget-exceeded", path, detail);
    }
  }
}

export { BudgetLedger, resolveBudget };
export type { BudgetField, ExecutionGraphBudget, ResolvedExecutionGraphBudget };
