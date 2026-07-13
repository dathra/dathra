import { describe, expect, it, vi } from "vitest";

import * as publicApi from "./index";
import {
  buildCanonicalJson,
  createCanonicalBuilderInstrumentation,
  type CanonicalBuilderInstrumentation,
} from "./canonicalBuilder";
import {
  CanonicalIdentityError,
  canonicalizeJson,
  type CanonicalIdentityErrorCode,
  type CanonicalIdentityPathSegment,
} from "./implementation";

/* eslint-disable @typescript-eslint/consistent-type-imports, import/no-duplicates -- Each negative import must fail independently for mutation sensitivity. */
// @ts-expect-error Canonical builder runtime declarations remain package-internal in the type namespace.
import type { buildCanonicalJson as _BuildCanonicalJsonExport } from "./index";
// @ts-expect-error Canonical builder runtime declarations remain package-internal in the type namespace.
import type { createCanonicalBuilderInstrumentation as _CreateCanonicalBuilderInstrumentationExport } from "./index";
// @ts-expect-error Canonical builder types remain package-internal.
type _T01 = import("./index").CanonicalBuilderFailure;
// @ts-expect-error Canonical builder types remain package-internal.
type _T02 = import("./index").CanonicalBuilderInstrumentation;
// @ts-expect-error Canonical builder types remain package-internal.
type _T03 = import("./index").CanonicalSortInstrumentation;
type _T04 = typeof _BuildCanonicalJsonExport;
type _T05 = typeof _CreateCanonicalBuilderInstrumentationExport;
/* eslint-enable @typescript-eslint/consistent-type-imports, import/no-duplicates */

function failBuilder(
  code: string,
  path: readonly (string | number)[],
  detail: string,
): never {
  throw new Error(`${code}:${JSON.stringify(path)}:${detail}`);
}

function buildInstrumented(value: unknown): {
  readonly text: string;
  readonly instrumentation: CanonicalBuilderInstrumentation;
} {
  const instrumentation = createCanonicalBuilderInstrumentation();
  const text = buildCanonicalJson(value, failBuilder, instrumentation);
  return { text, instrumentation };
}

function expectCanonicalError(
  operation: () => unknown,
  code: CanonicalIdentityErrorCode,
  path: readonly CanonicalIdentityPathSegment[],
): void {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof CanonicalIdentityError)) throw error;
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
    return;
  }

  throw new Error("Expected a CanonicalIdentityError");
}

function calculateLevels(propertyCount: number): number {
  let levels = 0;
  let runLength = 1;
  while (runLength < Math.max(1, propertyCount)) {
    levels += 1;
    runLength *= 2;
  }
  return levels;
}

function expectBoundedWork(
  instrumentation: CanonicalBuilderInstrumentation,
): void {
  expect(instrumentation.linearSteps).toBe(
    instrumentation.dataNodeOccurrences +
      instrumentation.propertyOccurrences +
      instrumentation.arraySlotOccurrences +
      instrumentation.stringCodeUnits,
  );
  expect(instrumentation.maximumActivePathSegments).toBeLessThanOrEqual(
    instrumentation.propertyOccurrences,
  );
  expect(instrumentation.maximumActivePropertyEntries).toBeLessThanOrEqual(
    2 * instrumentation.propertyOccurrences,
  );

  for (const sort of instrumentation.sorts) {
    const levels = calculateLevels(sort.propertyCount);
    const comparisonBound = sort.propertyCount * levels;
    const scanBound = 2 * sort.maximumKeyLength + 1;
    const moveBound = 2 * sort.propertyCount * levels;

    expect(sort.levels).toBe(levels);
    expect(sort.comparisons).toBeLessThanOrEqual(comparisonBound);
    expect(sort.maximumComparisonCodeUnitScans).toBeLessThanOrEqual(scanBound);
    expect(sort.comparisonCodeUnitScans).toBeLessThanOrEqual(
      sort.comparisons * scanBound,
    );
    expect(sort.moves).toBeLessThanOrEqual(moveBound);
  }
}

function createReverseRecord(propertyCount: number): Record<string, number> {
  const record: Record<string, number> = {};
  for (let index = propertyCount - 1; index >= 0; index -= 1) {
    record[`key-${String(index).padStart(4, "0")}`] = index;
  }
  return record;
}

describe("canonical JSON builder", () => {
  it("does not delegate property ordering to native Array.prototype.sort", () => {
    const sort = vi.spyOn(Array.prototype, "sort").mockImplementation(() => {
      throw new Error("native sort invoked");
    });

    try {
      expect(canonicalizeJson({ z: 1, a: 2 }).text).toBe('{"a":2,"z":1}');
      expect(sort).not.toHaveBeenCalled();
    } finally {
      sort.mockRestore();
    }
  });

  it.each([7, 8, 9])(
    "bounds iterative sort work at the power-of-two boundary p=%i",
    (propertyCount) => {
      const value = createReverseRecord(propertyCount);
      const { text, instrumentation } = buildInstrumented(value);

      expect(text).toBe(canonicalizeJson(value).text);
      expect(instrumentation.sorts).toHaveLength(1);
      expect(instrumentation.sorts[0]?.propertyCount).toBe(propertyCount);
      expectBoundedWork(instrumentation);
    },
  );

  it("bounds every comparison for maximum-length common-prefix keys", () => {
    const prefix = "common-prefix-".padEnd(4096, "x");
    const value: Record<string, number> = {};
    for (const [index, suffix] of ["d", "c", "b", "a"].entries()) {
      value[`${prefix}${suffix}`] = index;
    }

    const { text, instrumentation } = buildInstrumented(value);
    const sort = instrumentation.sorts[0];

    expect(text).toBe(
      `{${["a", "b", "c", "d"]
        .map(
          (suffix, index) =>
            `${JSON.stringify(`${prefix}${suffix}`)}:${3 - index}`,
        )
        .join(",")}}`,
    );
    expect(sort.maximumKeyLength).toBe(4097);
    expect(sort.maximumComparisonCodeUnitScans).toBe(8194);
    expectBoundedWork(instrumentation);
  });

  it("serializes depth-64 records and arrays with iterative frames", () => {
    let value: unknown = "leaf";
    let expected = '"leaf"';
    for (let depth = 0; depth < 64; depth += 1) {
      if (depth % 2 === 0) {
        value = [value];
        expected = `[${expected}]`;
      } else {
        value = { child: value };
        expected = `{"child":${expected}}`;
      }
    }

    const { text, instrumentation } = buildInstrumented(value);

    expect(text).toBe(expected);
    expect(canonicalizeJson(value).text).toBe(expected);
    expect(instrumentation.maximumActivePathSegments).toBe(64);
    expect(instrumentation.maximumActivePropertyEntries).toBe(64);
    expectBoundedWork(instrumentation);
  });

  it("serializes beyond recursive call-stack depth with linear active scratch", () => {
    const depth = 12_000;
    let value: unknown = 0;
    for (let index = 0; index < depth; index += 1) {
      value = [value];
    }

    const { text, instrumentation } = buildInstrumented(value);

    expect(text).toBe(`${"[".repeat(depth)}0${"]".repeat(depth)}`);
    expect(instrumentation.maximumActivePathSegments).toBe(depth);
    expect(instrumentation.maximumActivePropertyEntries).toBe(depth);
    expectBoundedWork(instrumentation);
  });

  it("serializes shared record and array aliases at every occurrence", () => {
    const sharedRecord = { value: "xy" };
    const sharedArray = [sharedRecord, true];
    const value = {
      recordRight: sharedRecord,
      arrayRight: sharedArray,
      recordLeft: sharedRecord,
      arrayLeft: sharedArray,
    };

    const { text, instrumentation } = buildInstrumented(value);

    expect(text).toBe(
      '{"arrayLeft":[{"value":"xy"},true],"arrayRight":[{"value":"xy"},true],"recordLeft":{"value":"xy"},"recordRight":{"value":"xy"}}',
    );
    expect(instrumentation.dataNodeOccurrences).toBe(13);
    expect(instrumentation.propertyOccurrences).toBe(12);
    expect(instrumentation.arraySlotOccurrences).toBe(4);
    expect(instrumentation.stringCodeUnits).toBe(68);
    expect(instrumentation.linearSteps).toBe(97);
    expect(instrumentation.sorts).toHaveLength(5);
    expect(instrumentation.maximumActivePropertyEntries).toBe(8);
    expectBoundedWork(instrumentation);
  });

  it("rejects only active-ancestor aliases as cycles", () => {
    const direct: Record<string, unknown> = {};
    direct.self = direct;
    expectCanonicalError(() => canonicalizeJson(direct), "cyclic-value", [
      "self",
    ]);

    const first: Record<string, unknown> = {};
    const second: Record<string, unknown> = { first };
    first.second = second;
    expectCanonicalError(() => canonicalizeJson(first), "cyclic-value", [
      "second",
      "first",
    ]);
  });

  it("preserves child failure precedence over a later sparse slot", () => {
    const value: unknown[] = [];
    value.length = 2;
    value[0] = undefined;

    expectCanonicalError(
      () => canonicalizeJson(value),
      "unsupported-value",
      [0],
    );
  });

  it.each([
    [
      { z: [true, null, { b: 2, a: 1 }], a: "text" },
      '{"a":"text","z":[true,null,{"a":1,"b":2}]}',
    ],
    [
      { numbers: [Number("333333333.33333329"), 1e30, 4.5, 0.002, 1e-27] },
      '{"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}',
    ],
    ['\u000f\n"\\/', '"\\u000f\\n\\"\\\\/"'],
    [
      { "\ufb33": "Hebrew", "\u20ac": "Euro", "😀": "Emoji", ö: "Latin" },
      '{"ö":"Latin","€":"Euro","😀":"Emoji","דּ":"Hebrew"}',
    ],
  ])(
    "keeps the existing canonical vector %# byte-identical",
    (value, expected) => {
      const { text, instrumentation } = buildInstrumented(value);
      const encoding = canonicalizeJson(value);

      expect(text).toBe(expected);
      expect(encoding.text).toBe(expected);
      expect(new TextDecoder().decode(encoding.bytes)).toBe(expected);
      expectBoundedWork(instrumentation);
    },
  );

  it("keeps builder instrumentation internal to canonicalIdentity", () => {
    expect(publicApi).not.toHaveProperty("buildCanonicalJson");
    expect(publicApi).not.toHaveProperty(
      "createCanonicalBuilderInstrumentation",
    );
  });
});
