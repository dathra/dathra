import { fail, type ValidationPath } from "./identity";

/** Optional hard-limit overrides for one source execution contract operation. */
interface ExecutionContractBudget {
  readonly maximumInputDepth?: number;
  readonly maximumInputDataNodes?: number;
  readonly maximumInputProperties?: number;
  readonly maximumInputArrayLength?: number;
  readonly maximumInputStringCodeUnits?: number;
  readonly maximumFacts?: number;
  readonly maximumRelations?: number;
  readonly maximumExports?: number;
  readonly maximumRegistryEntries?: number;
  readonly maximumRegistryImplementations?: number;
  readonly maximumReferences?: number;
  readonly maximumSemanticPathSegments?: number;
  readonly maximumCanonicalBytes?: number;
  readonly maximumCanonicalWorkSteps?: number;
  readonly maximumValidationSteps?: number;
}

type BudgetCounter = keyof ExecutionContractBudget;
type CumulativeBudgetCounter = Exclude<BudgetCounter, "maximumInputDepth">;
type ResolvedExecutionContractBudget = {
  readonly [Counter in BudgetCounter]-?: number;
};
type MutableResolvedExecutionContractBudget = {
  -readonly [Counter in BudgetCounter]: number;
};

const DEFAULT_EXECUTION_CONTRACT_BUDGET: ResolvedExecutionContractBudget =
  Object.freeze({
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
  });

function isBudgetCounter(value: string): value is BudgetCounter {
  return Object.hasOwn(DEFAULT_EXECUTION_CONTRACT_BUDGET, value);
}

function failInvalidBudgetRecord(path: ValidationPath, detail: string): never {
  fail("invalid-closed-record", path, detail);
}

function readBudgetPrototype(value: object): object | null {
  try {
    return Reflect.getPrototypeOf(value);
  } catch {
    failInvalidBudgetRecord(
      ["budget"],
      "Could not inspect the budget record prototype",
    );
  }
}

function readBudgetKeys(value: object): readonly PropertyKey[] {
  try {
    return Reflect.ownKeys(value);
  } catch {
    failInvalidBudgetRecord(["budget"], "Could not inspect budget fields");
  }
}

function readBudgetDescriptor(
  value: object,
  key: PropertyKey,
  path: ValidationPath,
): PropertyDescriptor {
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(value, key);
  } catch {
    failInvalidBudgetRecord(path, "Could not inspect the budget field");
  }
  if (descriptor === undefined) {
    failInvalidBudgetRecord(path, "Budget field descriptor disappeared");
  }
  return descriptor;
}

function resolveBudget(
  budget: ExecutionContractBudget | undefined,
): ResolvedExecutionContractBudget {
  if (budget === undefined) return DEFAULT_EXECUTION_CONTRACT_BUDGET;
  if (typeof budget !== "object" || budget === null) {
    failInvalidBudgetRecord(
      ["budget"],
      "Expected an undefined, plain, or null-prototype budget record",
    );
  }

  const prototype = readBudgetPrototype(budget);
  if (prototype !== Object.prototype && prototype !== null) {
    failInvalidBudgetRecord(
      ["budget"],
      "Expected an undefined, plain, or null-prototype budget record",
    );
  }

  const resolved: MutableResolvedExecutionContractBudget = {
    ...DEFAULT_EXECUTION_CONTRACT_BUDGET,
  };
  for (const key of readBudgetKeys(budget)) {
    const fieldPath = ["budget", String(key)] as const;
    if (typeof key !== "string" || !isBudgetCounter(key)) {
      fail("invalid-field", fieldPath, "Unexpected budget field");
    }

    const descriptor = readBudgetDescriptor(budget, key, fieldPath);
    if (!("value" in descriptor) || descriptor.enumerable !== true) {
      failInvalidBudgetRecord(
        fieldPath,
        "Budget fields must be enumerable data properties",
      );
    }

    const value: unknown = descriptor.value;
    const hardCap = DEFAULT_EXECUTION_CONTRACT_BUDGET[key];
    if (
      typeof value !== "number" ||
      !Number.isSafeInteger(value) ||
      value < 0 ||
      value > hardCap
    ) {
      fail(
        "invalid-field",
        fieldPath,
        `Budget field ${key} must be a non-negative safe integer no greater than hard cap ${hardCap}`,
      );
    }
    resolved[key] = value;
  }
  return Object.freeze(resolved);
}

function assertChargeAmount(amount: number): void {
  if (!Number.isSafeInteger(amount) || amount < 0) {
    throw new TypeError(
      "[dathra] Internal budget charge must be a non-negative safe integer",
    );
  }
}

function assertObservedDepth(depth: number): void {
  if (!Number.isSafeInteger(depth) || depth < 1) {
    throw new TypeError(
      "[dathra] Internal observed depth must be a positive safe integer",
    );
  }
}

function failBudgetExceeded(
  counter: BudgetCounter,
  limit: number,
  attempted: bigint,
  path: ValidationPath,
): never {
  fail(
    "budget-exceeded",
    path,
    `Execution contract budget counter ${counter} exceeded: limit ${limit}, attempted ${attempted}`,
  );
}

/** Tracks hard-limit usage for exactly one source execution contract operation. */
class BudgetLedger {
  readonly #limits: ResolvedExecutionContractBudget;
  readonly #totals: Partial<Record<CumulativeBudgetCounter, number>> = {};
  #maximumInputDepth = 0;

  /** Creates an empty operation-local ledger for resolved hard limits. */
  constructor(limits: ResolvedExecutionContractBudget) {
    this.#limits = limits;
  }

  /** Adds cumulative work without applying an increment that exceeds its limit. */
  chargeTotal(
    counter: CumulativeBudgetCounter,
    amount: number,
    path: ValidationPath,
  ): void {
    assertChargeAmount(amount);
    const current = this.#totals[counter] ?? 0;
    const limit = this.#limits[counter];
    if (amount > limit - current) {
      const attempted = BigInt(current) + BigInt(amount);
      failBudgetExceeded(counter, limit, attempted, path);
    }
    this.#totals[counter] = current + amount;
  }

  /** Records the highest one-based active input depth observed by the operation. */
  observePeak(
    counter: "maximumInputDepth",
    depth: number,
    path: ValidationPath,
  ): void {
    assertObservedDepth(depth);
    if (depth <= this.#maximumInputDepth) return;

    const limit = this.#limits[counter];
    if (depth > limit) {
      failBudgetExceeded(counter, limit, BigInt(depth), path);
    }
    this.#maximumInputDepth = depth;
  }
}

/** Creates a fresh budget ledger for one source execution contract operation. */
function createBudgetLedger(budget?: ExecutionContractBudget): BudgetLedger {
  return new BudgetLedger(resolveBudget(budget));
}

export { BudgetLedger, DEFAULT_EXECUTION_CONTRACT_BUDGET, createBudgetLedger };
export type { BudgetCounter, ExecutionContractBudget };
