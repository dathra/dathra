import { execFileSync } from "node:child_process";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { describe, expect, it, vi } from "vitest";

import {
  isSha256Digest,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import {
  snapshotRenderDefinitionCreatorDescriptors,
  snapshotRenderDefinitionParserDescriptors,
  type RenderDefinitionDescriptorSnapshot,
} from "./descriptorSnapshot";
import { RenderDefinitionError } from "./error";
import type { RenderDefinitionPreimage } from "./model";
import {
  validateRenderDefinitionCreatorSnapshot,
  validateRenderDefinitionParserSnapshot,
  type UnbrandedRenderDefinitionSnapshot,
} from "./validatedSnapshot";

type Mode = "creator" | "parser";
type Path = readonly string[];

interface FieldCase {
  readonly mode: Mode;
  readonly path: Path;
  readonly semanticCode: "invalid-field" | "invalid-reference";
}

interface RecordCase {
  readonly mode: Mode;
  readonly path: Path;
}

const CREATOR_DIGEST_CASES = [
  {
    mode: "creator",
    path: ["observationContractId"],
    semanticCode: "invalid-reference",
  },
  {
    mode: "creator",
    path: ["responseContributionSetId"],
    semanticCode: "invalid-reference",
  },
  {
    mode: "creator",
    path: ["orderedBodyPlanId"],
    semanticCode: "invalid-reference",
  },
  {
    mode: "creator",
    path: ["exposureContractId"],
    semanticCode: "invalid-reference",
  },
] as const satisfies readonly FieldCase[];

const PARSER_DIGEST_CASES = [
  { mode: "parser", path: ["id"], semanticCode: "invalid-field" },
  {
    mode: "parser",
    path: ["preimage", "observationContract", "claimedId"],
    semanticCode: "invalid-reference",
  },
  {
    mode: "parser",
    path: ["preimage", "responseContributions", "claimedId"],
    semanticCode: "invalid-reference",
  },
  {
    mode: "parser",
    path: ["preimage", "orderedBodyPlan", "claimedId"],
    semanticCode: "invalid-reference",
  },
  {
    mode: "parser",
    path: ["preimage", "exposure", "claimedId"],
    semanticCode: "invalid-reference",
  },
] as const satisfies readonly FieldCase[];

const PARSER_LITERAL_PATHS = [
  ["preimage", "schema"],
  ["preimage", "observationContract", "schema"],
  ["preimage", "observationContract", "role"],
  ["preimage", "responseContributions", "schema"],
  ["preimage", "responseContributions", "role"],
  ["preimage", "orderedBodyPlan", "schema"],
  ["preimage", "orderedBodyPlan", "role"],
  ["preimage", "exposure", "schema"],
  ["preimage", "exposure", "role"],
] as const;

const EXPECTED_STRING_CASES = [
  ...CREATOR_DIGEST_CASES,
  ...PARSER_DIGEST_CASES,
  ...PARSER_LITERAL_PATHS.map((path) => ({
    mode: "parser" as const,
    path,
    semanticCode: "invalid-field" as const,
  })),
] satisfies readonly FieldCase[];

const PARSER_EXPECTED_PATHS = [
  ["id"],
  ["preimage"],
  ["preimage", "schema"],
  ["preimage", "observationContract"],
  ["preimage", "responseContributions"],
  ["preimage", "orderedBodyPlan"],
  ["preimage", "exposure"],
  ["preimage", "observationContract", "schema"],
  ["preimage", "observationContract", "role"],
  ["preimage", "observationContract", "claimedId"],
  ["preimage", "responseContributions", "schema"],
  ["preimage", "responseContributions", "role"],
  ["preimage", "responseContributions", "claimedId"],
  ["preimage", "orderedBodyPlan", "schema"],
  ["preimage", "orderedBodyPlan", "role"],
  ["preimage", "orderedBodyPlan", "claimedId"],
  ["preimage", "exposure", "schema"],
  ["preimage", "exposure", "role"],
  ["preimage", "exposure", "claimedId"],
] as const;

const NESTED_PATHS = [
  ["preimage"],
  ["preimage", "observationContract"],
  ["preimage", "responseContributions"],
  ["preimage", "orderedBodyPlan"],
  ["preimage", "exposure"],
] as const;
const NESTED_INVALID_VALUES: readonly unknown[] = ["not-a-record", null, 1];

const EXTRA_RECORD_CASES = [
  { mode: "creator", path: [] },
  { mode: "parser", path: [] },
  { mode: "parser", path: ["preimage"] },
  { mode: "parser", path: ["preimage", "observationContract"] },
  { mode: "parser", path: ["preimage", "responseContributions"] },
  { mode: "parser", path: ["preimage", "orderedBodyPlan"] },
  { mode: "parser", path: ["preimage", "exposure"] },
] as const satisfies readonly RecordCase[];

function digest(body: string): Sha256Digest {
  const value = `sha-256:${body}`;
  if (!isSha256Digest(value)) {
    throw new TypeError("Invalid digest fixture");
  }
  return value;
}

const DIGEST_A = digest("A".repeat(43));
const DIGEST_B = digest(`${"B".repeat(42)}E`);
const DIGEST_C = digest(`${"C".repeat(42)}I`);
const DIGEST_D = digest(`${"D".repeat(42)}M`);
const DEFINITION_ID = digest(`${"E".repeat(42)}Q`);
const NONCANONICAL_DIGEST = `sha-256:${"A".repeat(42)}B`;

function creatorValue(): Record<string, unknown> {
  return {
    observationContractId: DIGEST_A,
    responseContributionSetId: DIGEST_B,
    orderedBodyPlanId: DIGEST_C,
    exposureContractId: DIGEST_D,
  };
}

function parserValue(): Record<string, unknown> {
  return {
    id: DEFINITION_ID,
    preimage: {
      schema: "dathra.render-definition/1",
      observationContract: {
        schema: "dathra.render-definition-observation-reference/1",
        role: "observation-contract",
        claimedId: DIGEST_A,
      },
      responseContributions: {
        schema: "dathra.render-definition-response-reference/1",
        role: "response-contribution-set",
        claimedId: DIGEST_B,
      },
      orderedBodyPlan: {
        schema: "dathra.render-definition-body-reference/1",
        role: "ordered-body-plan",
        claimedId: DIGEST_C,
      },
      exposure: {
        schema: "dathra.render-definition-exposure-reference/1",
        role: "exposure-contract",
        claimedId: DIGEST_D,
      },
    },
  };
}

function requireObject(value: unknown): object {
  if (typeof value !== "object" || value === null) {
    throw new TypeError("Expected object fixture");
  }
  return value;
}

function ownDataValue(value: object, key: string): unknown {
  const descriptor = Reflect.getOwnPropertyDescriptor(value, key);
  if (descriptor === undefined || !("value" in descriptor)) {
    throw new TypeError(`Expected data property ${key}`);
  }
  const result: unknown = descriptor.value;
  return result;
}

function recordAt(root: object, path: Path): object {
  let current = root;
  for (const segment of path) {
    current = requireObject(ownDataValue(current, segment));
  }
  return current;
}

function setAt(root: object, path: Path, value: unknown): void {
  const owner = recordAt(root, path.slice(0, -1));
  const key = path.at(-1);
  if (key === undefined) {
    throw new TypeError("Cannot replace root fixture");
  }
  Reflect.defineProperty(owner, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
}

function deleteAt(root: object, path: Path): void {
  const owner = recordAt(root, path.slice(0, -1));
  const key = path.at(-1);
  if (key === undefined || !Reflect.deleteProperty(owner, key)) {
    throw new TypeError("Could not delete fixture field");
  }
}

function defineExtra(root: object, recordPath: Path, key: string): void {
  Reflect.defineProperty(recordAt(root, recordPath), key, {
    configurable: true,
    enumerable: true,
    value: "extra-value",
    writable: true,
  });
}

function descriptorSnapshot(
  mode: Mode,
  input: object,
): RenderDefinitionDescriptorSnapshot {
  return mode === "creator"
    ? snapshotRenderDefinitionCreatorDescriptors(input)
    : snapshotRenderDefinitionParserDescriptors(input);
}

function validateSnapshot(
  mode: Mode,
  snapshot: RenderDefinitionDescriptorSnapshot,
): RenderDefinitionPreimage | UnbrandedRenderDefinitionSnapshot {
  return mode === "creator"
    ? validateRenderDefinitionCreatorSnapshot(snapshot)
    : validateRenderDefinitionParserSnapshot(snapshot);
}

function caughtError(run: () => unknown): RenderDefinitionError {
  try {
    run();
  } catch (error: unknown) {
    if (error instanceof RenderDefinitionError) {
      return error;
    }
    throw error;
  }
  throw new TypeError("Expected RenderDefinitionError");
}

function expectFailure(
  run: () => unknown,
  code: RenderDefinitionError["code"],
  path: Path,
): void {
  const error = caughtError(run);
  expect(error.code).toBe(code);
  expect(error.path).toEqual(path);
}

function inputFor(mode: Mode): Record<string, unknown> {
  return mode === "creator" ? creatorValue() : parserValue();
}

function makeCallerUnreadable(
  records: readonly object[],
): readonly ReturnType<typeof vi.fn>[] {
  const getters: ReturnType<typeof vi.fn>[] = [];
  for (const record of records) {
    for (const key of Reflect.ownKeys(record)) {
      const descriptor = Reflect.getOwnPropertyDescriptor(record, key);
      if (descriptor === undefined || !("value" in descriptor)) {
        throw new TypeError("Expected configurable data fixture");
      }
      const getter = vi.fn(() => {
        throw new TypeError("Caller record was reread");
      });
      getters.push(getter);
      Reflect.defineProperty(record, key, {
        configurable: true,
        enumerable: descriptor.enumerable,
        get: getter,
      });
    }
  }
  return getters;
}

function parserRecords(value: object): readonly object[] {
  return EXTRA_RECORD_CASES.filter(({ mode }) => mode === "parser").map(
    ({ path }) => recordAt(value, path),
  );
}

function expectedPreimage(): RenderDefinitionPreimage {
  return {
    schema: "dathra.render-definition/1",
    observationContract: {
      schema: "dathra.render-definition-observation-reference/1",
      role: "observation-contract",
      claimedId: DIGEST_A,
    },
    responseContributions: {
      schema: "dathra.render-definition-response-reference/1",
      role: "response-contribution-set",
      claimedId: DIGEST_B,
    },
    orderedBodyPlan: {
      schema: "dathra.render-definition-body-reference/1",
      role: "ordered-body-plan",
      claimedId: DIGEST_C,
    },
    exposure: {
      schema: "dathra.render-definition-exposure-reference/1",
      role: "exposure-contract",
      claimedId: DIGEST_D,
    },
  };
}

describe("render definition validated snapshots", () => {
  it("uses only DI2A snapshots after caller records and reflection become unreadable", () => {
    const creator = creatorValue();
    const parser = parserValue();
    const creatorSnapshot = snapshotRenderDefinitionCreatorDescriptors(creator);
    const parserSnapshot = snapshotRenderDefinitionParserDescriptors(parser);
    const getters = makeCallerUnreadable([creator, ...parserRecords(parser)]);
    const ownKeysSpy = vi.spyOn(Reflect, "ownKeys").mockImplementation(() => {
      throw new TypeError("DI2B must not enumerate properties");
    });
    const descriptorSpy = vi
      .spyOn(Reflect, "getOwnPropertyDescriptor")
      .mockImplementation(() => {
        throw new TypeError("DI2B must not read descriptors");
      });
    let created: RenderDefinitionPreimage | undefined;
    let parsed: UnbrandedRenderDefinitionSnapshot | undefined;
    try {
      created = validateRenderDefinitionCreatorSnapshot(creatorSnapshot);
      parsed = validateRenderDefinitionParserSnapshot(parserSnapshot);
    } finally {
      descriptorSpy.mockRestore();
      ownKeysSpy.mockRestore();
    }

    expect(created).toEqual(expectedPreimage());
    expect(parsed).toEqual({ id: DEFINITION_ID, preimage: expectedPreimage() });
    expect(getters.every((getter) => getter.mock.calls.length === 0)).toBe(
      true,
    );
  });

  it.each(EXPECTED_STRING_CASES)(
    "applies the 256/257 boundary to $mode $path",
    ({ mode, path, semanticCode }) => {
      const boundary = inputFor(mode);
      setAt(boundary, path, "x".repeat(256));
      expectFailure(
        () => validateSnapshot(mode, descriptorSnapshot(mode, boundary)),
        semanticCode,
        path,
      );

      const exceeded = inputFor(mode);
      setAt(exceeded, path, "x".repeat(257));
      expectFailure(
        () => validateSnapshot(mode, descriptorSnapshot(mode, exceeded)),
        "budget-exceeded",
        path,
      );
    },
  );

  it.each([
    ...CREATOR_DIGEST_CASES.map(({ mode, path }) => ({ mode, path })),
    ...PARSER_EXPECTED_PATHS.map((path) => ({ mode: "parser" as const, path })),
  ])("reports missing $mode $path", ({ mode, path }) => {
    const input = inputFor(mode);
    deleteAt(input, path);
    expectFailure(
      () => validateSnapshot(mode, descriptorSnapshot(mode, input)),
      "invalid-field",
      path,
    );
  });

  it.each(
    NESTED_PATHS.flatMap((path) =>
      NESTED_INVALID_VALUES.map((value) => ({ path, value })),
    ),
  )("classifies nested primitive $path", ({ path, value }) => {
    const input = parserValue();
    setAt(input, path, value);
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(input),
        ),
      "invalid-closed-record",
      path,
    );
  });

  it.each(EXTRA_RECORD_CASES)(
    "reports raw-order extra key at $mode $path",
    ({ mode, path }) => {
      const input = inputFor(mode);
      defineExtra(input, path, "\u{E000}");
      defineExtra(input, path, "a");
      expectFailure(
        () => validateSnapshot(mode, descriptorSnapshot(mode, input)),
        "invalid-field",
        [...path, "a"],
      );
    },
  );

  it.each(
    PARSER_LITERAL_PATHS.flatMap((path) => [
      { path, value: "wrong-literal" },
      { path, value: 1 },
    ]),
  )("rejects literal $path", ({ path, value }) => {
    const input = parserValue();
    setAt(input, path, value);
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(input),
        ),
      "invalid-field",
      path,
    );
  });

  const invalidDigests: readonly unknown[] = [
    1,
    "malformed",
    NONCANONICAL_DIGEST,
  ];

  it.each(
    [...CREATOR_DIGEST_CASES, ...PARSER_DIGEST_CASES].flatMap((fieldCase) =>
      invalidDigests.map((value) => ({ ...fieldCase, value })),
    ),
  )("classifies digest $mode $path", ({ mode, path, semanticCode, value }) => {
    const input = inputFor(mode);
    setAt(input, path, value);
    expectFailure(
      () => validateSnapshot(mode, descriptorSnapshot(mode, input)),
      semanticCode,
      path,
    );
  });
});

describe("render definition validation precedence", () => {
  it("finishes deferred nested structure before scalar budgets", () => {
    const input = parserValue();
    setAt(input, ["id"], "x".repeat(257));
    setAt(input, ["preimage"], 1);
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(input),
        ),
      "invalid-closed-record",
      ["preimage"],
    );
  });

  it("uses record and field order for multiple string budgets", () => {
    const input = parserValue();
    setAt(input, ["id"], "x".repeat(257));
    setAt(input, ["preimage", "schema"], "x".repeat(257));
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(input),
        ),
      "budget-exceeded",
      ["id"],
    );

    const beforeMissing = parserValue();
    setAt(beforeMissing, ["id"], "x".repeat(257));
    deleteAt(beforeMissing, ["preimage"]);
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(beforeMissing),
        ),
      "budget-exceeded",
      ["id"],
    );
  });

  it("orders missing, extra, literal, and digest stages globally", () => {
    const missing = parserValue();
    deleteAt(missing, ["id"]);
    defineExtra(missing, ["preimage", "exposure"], "extra");
    setAt(missing, ["preimage", "schema"], "wrong");
    setAt(missing, ["preimage", "observationContract", "claimedId"], "bad");
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(missing),
        ),
      "invalid-field",
      ["id"],
    );

    const extra = parserValue();
    defineExtra(extra, ["preimage", "exposure"], "extra");
    setAt(extra, ["preimage", "schema"], "wrong");
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(extra),
        ),
      "invalid-field",
      ["preimage", "exposure", "extra"],
    );

    const literal = parserValue();
    setAt(literal, ["id"], "bad");
    setAt(literal, ["preimage", "exposure", "role"], "wrong");
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(literal),
        ),
      "invalid-field",
      ["preimage", "exposure", "role"],
    );
  });

  it("uses wrapper and creator digest field order", () => {
    const parser = parserValue();
    setAt(parser, ["id"], "bad");
    setAt(parser, ["preimage", "observationContract", "claimedId"], "bad");
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(parser),
        ),
      "invalid-field",
      ["id"],
    );

    const creator = creatorValue();
    setAt(creator, ["observationContractId"], "bad");
    setAt(creator, ["responseContributionSetId"], "bad");
    expectFailure(
      () =>
        validateRenderDefinitionCreatorSnapshot(
          snapshotRenderDefinitionCreatorDescriptors(creator),
        ),
      "invalid-reference",
      ["observationContractId"],
    );
  });
});

describe("render definition validated construction", () => {
  it("validates aliased occurrences at their independent paths", () => {
    const input = parserValue();
    const alias = recordAt(input, ["preimage", "observationContract"]);
    setAt(input, ["preimage", "responseContributions"], alias);
    expectFailure(
      () =>
        validateRenderDefinitionParserSnapshot(
          snapshotRenderDefinitionParserDescriptors(input),
        ),
      "invalid-field",
      ["preimage", "responseContributions", "schema"],
    );
  });

  it("returns fresh deeply frozen records without checking wrapper equality", () => {
    const creatorSnapshot =
      snapshotRenderDefinitionCreatorDescriptors(creatorValue());
    const parserSnapshot =
      snapshotRenderDefinitionParserDescriptors(parserValue());
    const firstCreated =
      validateRenderDefinitionCreatorSnapshot(creatorSnapshot);
    const secondCreated =
      validateRenderDefinitionCreatorSnapshot(creatorSnapshot);
    const firstParsed = validateRenderDefinitionParserSnapshot(parserSnapshot);
    const secondParsed = validateRenderDefinitionParserSnapshot(parserSnapshot);

    expect(firstCreated).toEqual(expectedPreimage());
    expect(firstParsed).toEqual({
      id: DEFINITION_ID,
      preimage: expectedPreimage(),
    });
    expect(firstCreated).not.toBe(secondCreated);
    expect(firstCreated.observationContract).not.toBe(
      secondCreated.observationContract,
    );
    expect(firstParsed).not.toBe(secondParsed);
    expect(firstParsed.preimage).not.toBe(secondParsed.preimage);
    expect(
      [
        firstCreated,
        firstCreated.observationContract,
        firstCreated.responseContributions,
        firstCreated.orderedBodyPlan,
        firstCreated.exposure,
        firstParsed,
        firstParsed.preimage,
        firstParsed.preimage.observationContract,
        firstParsed.preimage.responseContributions,
        firstParsed.preimage.orderedBodyPlan,
        firstParsed.preimage.exposure,
      ].map(Object.isFrozen),
    ).not.toContain(false);
    expect(Reflect.set(firstParsed.preimage, "schema", "changed")).toBe(false);
  });

  it("does not access WebCrypto", () => {
    const creatorSnapshot =
      snapshotRenderDefinitionCreatorDescriptors(creatorValue());
    const parserSnapshot =
      snapshotRenderDefinitionParserDescriptors(parserValue());
    let cryptoReads = 0;
    vi.stubGlobal(
      "crypto",
      new Proxy(
        {},
        {
          get() {
            cryptoReads += 1;
            throw new TypeError("DI2B must not use WebCrypto");
          },
        },
      ),
    );
    try {
      validateRenderDefinitionCreatorSnapshot(creatorSnapshot);
      validateRenderDefinitionParserSnapshot(parserSnapshot);
    } finally {
      vi.unstubAllGlobals();
    }
    expect(cryptoReads).toBe(0);
  });

  it("keeps all DI2B internals out of built root artifacts", () => {
    const packageRoot = new URL("../../", import.meta.url);
    const outputDirectory = mkdtempSync(
      join(tmpdir(), "dathra-render-contract-di2b-"),
    );
    const forbiddenNames = [
      "UnbrandedRenderDefinitionSnapshot",
      "validateRenderDefinitionCreatorSnapshot",
      "validateRenderDefinitionParserSnapshot",
    ];

    try {
      execFileSync(
        "pnpm",
        ["exec", "tsdown", "--out-dir", outputDirectory, "--logLevel", "error"],
        {
          cwd: packageRoot,
          stdio: "pipe",
        },
      );

      for (const artifactFile of [
        "index.d.mts",
        "index.d.cts",
        "index.mjs",
        "index.cjs",
      ]) {
        const artifact = readFileSync(
          join(outputDirectory, artifactFile),
          "utf8",
        );
        for (const forbiddenName of forbiddenNames) {
          expect(artifact).not.toContain(forbiddenName);
        }
      }
    } finally {
      rmSync(outputDirectory, { force: true, recursive: true });
    }
  });
});
