type CanonicalBuilderPathSegment = string | number;

interface CanonicalBuilderPathCursor {
  readonly parent: CanonicalBuilderPathCursor | undefined;
  readonly segment: CanonicalBuilderPathSegment;
  readonly depth: number;
}

type CanonicalBuilderErrorCode =
  | "unsupported-value"
  | "invalid-number"
  | "invalid-unicode"
  | "unsupported-object"
  | "unsupported-property"
  | "sparse-array"
  | "cyclic-value";

type CanonicalBuilderFailure = (
  code: CanonicalBuilderErrorCode,
  path: readonly CanonicalBuilderPathSegment[],
  detail: string,
) => never;

interface CanonicalSortInstrumentation {
  propertyCount: number;
  maximumKeyLength: number;
  levels: number;
  comparisons: number;
  comparisonCodeUnitScans: number;
  maximumComparisonCodeUnitScans: number;
  moves: number;
}

interface CanonicalBuilderInstrumentation {
  dataNodeOccurrences: number;
  propertyOccurrences: number;
  arraySlotOccurrences: number;
  stringCodeUnits: number;
  linearSteps: number;
  maximumActivePathSegments: number;
  maximumActivePropertyEntries: number;
  sorts: CanonicalSortInstrumentation[];
}

interface RecordEntry {
  readonly key: string;
  readonly descriptor: PropertyDescriptor;
}

interface ValueFrame {
  readonly kind: "value";
  readonly value: unknown;
  readonly path: CanonicalBuilderPathCursor | undefined;
}

interface ArrayFrame {
  readonly kind: "array";
  readonly value: unknown[];
  readonly path: CanonicalBuilderPathCursor | undefined;
  readonly descriptors: ReadonlyMap<number, PropertyDescriptor>;
  readonly index: number;
}

interface RecordFrame {
  readonly kind: "record";
  readonly value: object;
  readonly path: CanonicalBuilderPathCursor | undefined;
  readonly entries: readonly RecordEntry[];
  readonly index: number;
}

interface LeaveFrame {
  readonly kind: "leave";
  readonly value: object;
  readonly activePropertyEntries: number;
}

type BuilderFrame = ValueFrame | ArrayFrame | RecordFrame | LeaveFrame;

function createCanonicalBuilderInstrumentation(): CanonicalBuilderInstrumentation {
  return {
    dataNodeOccurrences: 0,
    propertyOccurrences: 0,
    arraySlotOccurrences: 0,
    stringCodeUnits: 0,
    linearSteps: 0,
    maximumActivePathSegments: 0,
    maximumActivePropertyEntries: 0,
    sorts: [],
  };
}

function appendPath(
  parent: CanonicalBuilderPathCursor | undefined,
  segment: CanonicalBuilderPathSegment,
  instrumentation: CanonicalBuilderInstrumentation | undefined,
): CanonicalBuilderPathCursor {
  const path = { parent, segment, depth: (parent?.depth ?? 0) + 1 };
  if (instrumentation !== undefined) {
    instrumentation.maximumActivePathSegments = Math.max(
      instrumentation.maximumActivePathSegments,
      path.depth,
    );
  }
  return path;
}

function materializePath(
  path: CanonicalBuilderPathCursor | undefined,
): CanonicalBuilderPathSegment[] {
  const segments: CanonicalBuilderPathSegment[] = [];
  segments.length = path?.depth ?? 0;
  let cursor = path;
  while (cursor !== undefined) {
    segments[cursor.depth - 1] = cursor.segment;
    cursor = cursor.parent;
  }
  return segments;
}

function failAt(
  fail: CanonicalBuilderFailure,
  code: CanonicalBuilderErrorCode,
  path: CanonicalBuilderPathCursor | undefined,
  detail: string,
): never {
  return fail(code, materializePath(path), detail);
}

function recordActivePropertyEntries(
  instrumentation: CanonicalBuilderInstrumentation | undefined,
  count: number,
): void {
  if (instrumentation !== undefined) {
    instrumentation.maximumActivePropertyEntries = Math.max(
      instrumentation.maximumActivePropertyEntries,
      count,
    );
  }
}

function chargeLinearStep(
  instrumentation: CanonicalBuilderInstrumentation | undefined,
  counter:
    | "dataNodeOccurrences"
    | "propertyOccurrences"
    | "arraySlotOccurrences",
  amount = 1,
): void {
  if (instrumentation === undefined) {
    return;
  }

  instrumentation[counter] += amount;
  instrumentation.linearSteps += amount;
}

function chargeStringCodeUnits(
  instrumentation: CanonicalBuilderInstrumentation | undefined,
  amount: number,
): void {
  if (instrumentation === undefined) {
    return;
  }

  instrumentation.stringCodeUnits += amount;
  instrumentation.linearSteps += amount;
}

function validateUnicode(
  value: string,
  path: CanonicalBuilderPathCursor | undefined,
  fail: CanonicalBuilderFailure,
): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) {
        failAt(fail, "invalid-unicode", path, "Lone UTF-16 high surrogate");
      }
      index += 1;
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      failAt(fail, "invalid-unicode", path, "Lone UTF-16 low surrogate");
    }
  }
}

function serializeString(
  value: string,
  path: CanonicalBuilderPathCursor | undefined,
  fail: CanonicalBuilderFailure,
  instrumentation: CanonicalBuilderInstrumentation | undefined,
): string {
  chargeStringCodeUnits(instrumentation, value.length);
  validateUnicode(value, path, fail);
  return JSON.stringify(value);
}

function getArrayIndex(key: string, length: number): number | null {
  if (key.length === 0) {
    return null;
  }

  const index = Number(key);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= length ||
    String(index) !== key
  ) {
    return null;
  }

  return index;
}

function inspectArray(
  value: unknown[],
  path: CanonicalBuilderPathCursor | undefined,
  fail: CanonicalBuilderFailure,
  instrumentation: CanonicalBuilderInstrumentation | undefined,
): ReadonlyMap<number, PropertyDescriptor> {
  if (Object.getPrototypeOf(value) !== Array.prototype) {
    failAt(
      fail,
      "unsupported-object",
      path,
      "Array must use the standard prototype",
    );
  }

  const descriptors = new Map<number, PropertyDescriptor>();
  for (const key of Reflect.ownKeys(value)) {
    if (key === "length") {
      continue;
    }

    chargeLinearStep(instrumentation, "propertyOccurrences");
    if (typeof key === "symbol") {
      failAt(
        fail,
        "unsupported-property",
        path,
        "Symbol property is not canonical JSON",
      );
    }

    const index = getArrayIndex(key, value.length);
    const propertyPath = appendPath(
      path,
      index === null ? key : index,
      instrumentation,
    );
    if (index === null) {
      failAt(
        fail,
        "unsupported-property",
        propertyPath,
        "Extra array property",
      );
    }

    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !("value" in descriptor)
    ) {
      failAt(
        fail,
        "unsupported-property",
        propertyPath,
        "Array index must be enumerable data",
      );
    }
    descriptors.set(index, descriptor);
  }

  return descriptors;
}

function inspectRecord(
  value: object,
  path: CanonicalBuilderPathCursor | undefined,
  fail: CanonicalBuilderFailure,
  instrumentation: CanonicalBuilderInstrumentation | undefined,
): RecordEntry[] {
  const prototype = Reflect.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) {
    failAt(
      fail,
      "unsupported-object",
      path,
      "Object must use the current realm Object prototype or null",
    );
  }

  const entries: RecordEntry[] = [];
  for (const key of Reflect.ownKeys(value)) {
    chargeLinearStep(instrumentation, "propertyOccurrences");
    if (typeof key === "symbol") {
      failAt(
        fail,
        "unsupported-property",
        path,
        "Symbol property is not canonical JSON",
      );
    }

    const propertyPath = appendPath(path, key, instrumentation);
    chargeStringCodeUnits(instrumentation, key.length);
    validateUnicode(key, propertyPath, fail);
    const descriptor = Object.getOwnPropertyDescriptor(value, key);
    if (
      descriptor === undefined ||
      descriptor.enumerable !== true ||
      !("value" in descriptor)
    ) {
      failAt(
        fail,
        "unsupported-property",
        propertyPath,
        "Object property must be enumerable data",
      );
    }
    entries.push({ key, descriptor });
  }

  return entries;
}

function calculateSortLevels(propertyCount: number): number {
  let levels = 0;
  let runLength = 1;
  while (runLength < Math.max(1, propertyCount)) {
    levels += 1;
    runLength *= 2;
  }
  return levels;
}

function recordComparisonScans(
  instrumentation: CanonicalSortInstrumentation | undefined,
  codeUnitScans: number,
): void {
  if (instrumentation === undefined) {
    return;
  }

  instrumentation.comparisons += 1;
  instrumentation.comparisonCodeUnitScans += codeUnitScans;
  instrumentation.maximumComparisonCodeUnitScans = Math.max(
    instrumentation.maximumComparisonCodeUnitScans,
    codeUnitScans,
  );
}

function compareRawUtf16(
  left: string,
  right: string,
  instrumentation: CanonicalSortInstrumentation | undefined,
): number {
  const sharedLength = Math.min(left.length, right.length);
  let codeUnitScans = 0;
  for (let index = 0; index < sharedLength; index += 1) {
    const leftCodeUnit = left.charCodeAt(index);
    const rightCodeUnit = right.charCodeAt(index);
    codeUnitScans += 2;
    if (leftCodeUnit < rightCodeUnit) {
      recordComparisonScans(instrumentation, codeUnitScans);
      return -1;
    }
    if (leftCodeUnit > rightCodeUnit) {
      recordComparisonScans(instrumentation, codeUnitScans);
      return 1;
    }
  }

  codeUnitScans += 1;
  recordComparisonScans(instrumentation, codeUnitScans);
  if (left.length < right.length) {
    return -1;
  }
  if (left.length > right.length) {
    return 1;
  }
  return 0;
}

function sortRecordEntries(
  entries: RecordEntry[],
  instrumentation: CanonicalBuilderInstrumentation | undefined,
  activePropertyEntries: number,
): RecordEntry[] {
  let maximumKeyLength = 0;
  for (const entry of entries) {
    maximumKeyLength = Math.max(maximumKeyLength, entry.key.length);
  }

  const sortInstrumentation: CanonicalSortInstrumentation | undefined =
    instrumentation === undefined
      ? undefined
      : {
          propertyCount: entries.length,
          maximumKeyLength,
          levels: calculateSortLevels(entries.length),
          comparisons: 0,
          comparisonCodeUnitScans: 0,
          maximumComparisonCodeUnitScans: 0,
          moves: 0,
        };
  if (sortInstrumentation !== undefined && instrumentation !== undefined) {
    instrumentation.sorts.push(sortInstrumentation);
  }

  if (entries.length < 2) {
    recordActivePropertyEntries(
      instrumentation,
      activePropertyEntries + entries.length,
    );
    return entries;
  }

  recordActivePropertyEntries(
    instrumentation,
    activePropertyEntries + 2 * entries.length,
  );

  let source = entries;
  let target: RecordEntry[] = [];
  target.length = entries.length;
  for (let width = 1; width < entries.length; width *= 2) {
    for (let start = 0; start < entries.length; start += 2 * width) {
      const middle = Math.min(start + width, entries.length);
      const end = Math.min(start + 2 * width, entries.length);
      let leftIndex = start;
      let rightIndex = middle;

      for (let writeIndex = start; writeIndex < end; writeIndex += 1) {
        const takeLeft =
          rightIndex >= end ||
          (leftIndex < middle &&
            compareRawUtf16(
              source[leftIndex].key,
              source[rightIndex].key,
              sortInstrumentation,
            ) <= 0);
        target[writeIndex] = takeLeft
          ? source[leftIndex++]
          : source[rightIndex++];
        if (sortInstrumentation !== undefined) {
          sortInstrumentation.moves += 2;
        }
      }
    }

    const previousSource = source;
    source = target;
    target = previousSource;
  }

  return source;
}

function pushValueChunk(
  value: unknown,
  path: CanonicalBuilderPathCursor | undefined,
  fail: CanonicalBuilderFailure,
  instrumentation: CanonicalBuilderInstrumentation | undefined,
  chunks: string[],
): boolean {
  if (value === null) {
    chunks.push("null");
    return true;
  }

  switch (typeof value) {
    case "boolean":
      chunks.push(value ? "true" : "false");
      return true;
    case "number":
      if (!Number.isFinite(value) || Object.is(value, -0)) {
        failAt(
          fail,
          "invalid-number",
          path,
          "Number must be finite and not negative zero",
        );
      }
      chunks.push(JSON.stringify(value));
      return true;
    case "string":
      chunks.push(serializeString(value, path, fail, instrumentation));
      return true;
    case "object":
      return false;
    case "bigint":
    case "function":
    case "symbol":
    case "undefined":
      return failAt(
        fail,
        "unsupported-value",
        path,
        `Unsupported ${typeof value} value`,
      );
    default:
      return failAt(fail, "unsupported-value", path, "Unsupported value");
  }
}

function buildCanonicalJson(
  value: unknown,
  fail: CanonicalBuilderFailure,
  instrumentation?: CanonicalBuilderInstrumentation,
): string {
  const ancestors = new WeakSet<object>();
  const chunks: string[] = [];
  const frames: BuilderFrame[] = [{ kind: "value", value, path: undefined }];
  let activePropertyEntries = 0;

  while (frames.length > 0) {
    const frame = frames.pop();
    if (frame === undefined) {
      break;
    }

    if (frame.kind === "leave") {
      ancestors.delete(frame.value);
      activePropertyEntries -= frame.activePropertyEntries;
      continue;
    }

    if (frame.kind === "array") {
      if (frame.index >= frame.value.length) {
        chunks.push("]");
        continue;
      }

      if (frame.index > 0) {
        chunks.push(",");
      }
      chargeLinearStep(instrumentation, "arraySlotOccurrences");
      const itemPath = appendPath(frame.path, frame.index, instrumentation);
      const descriptor = frame.descriptors.get(frame.index);
      if (descriptor === undefined) {
        failAt(fail, "sparse-array", itemPath, "Sparse array index");
      }
      frames.push({ ...frame, index: frame.index + 1 });
      frames.push({
        kind: "value",
        value: descriptor.value,
        path: itemPath,
      });
      continue;
    }

    if (frame.kind === "record") {
      if (frame.index >= frame.entries.length) {
        chunks.push("}");
        continue;
      }

      const entry = frame.entries[frame.index];
      if (frame.index > 0) {
        chunks.push(",");
      }
      chunks.push(JSON.stringify(entry.key), ":");
      const propertyPath = appendPath(frame.path, entry.key, instrumentation);
      frames.push({ ...frame, index: frame.index + 1 });
      frames.push({
        kind: "value",
        value: entry.descriptor.value,
        path: propertyPath,
      });
      continue;
    }

    chargeLinearStep(instrumentation, "dataNodeOccurrences");
    if (
      pushValueChunk(frame.value, frame.path, fail, instrumentation, chunks)
    ) {
      continue;
    }

    if (typeof frame.value !== "object" || frame.value === null) {
      failAt(fail, "unsupported-value", frame.path, "Unsupported value");
    }
    const objectValue = frame.value;
    if (ancestors.has(objectValue)) {
      failAt(fail, "cyclic-value", frame.path, "Cyclic value");
    }
    ancestors.add(objectValue);

    if (Array.isArray(objectValue)) {
      const descriptors = inspectArray(
        objectValue,
        frame.path,
        fail,
        instrumentation,
      );
      activePropertyEntries += descriptors.size;
      recordActivePropertyEntries(instrumentation, activePropertyEntries);
      chunks.push("[");
      frames.push({
        kind: "leave",
        value: objectValue,
        activePropertyEntries: descriptors.size,
      });
      frames.push({
        kind: "array",
        value: objectValue,
        path: frame.path,
        descriptors,
        index: 0,
      });
      continue;
    }

    const entries = inspectRecord(
      objectValue,
      frame.path,
      fail,
      instrumentation,
    );
    const sortedEntries = sortRecordEntries(
      entries,
      instrumentation,
      activePropertyEntries,
    );
    activePropertyEntries += entries.length;
    recordActivePropertyEntries(instrumentation, activePropertyEntries);
    chunks.push("{");
    frames.push({
      kind: "leave",
      value: objectValue,
      activePropertyEntries: entries.length,
    });
    frames.push({
      kind: "record",
      value: objectValue,
      path: frame.path,
      entries: sortedEntries,
      index: 0,
    });
  }

  return chunks.join("");
}

export { buildCanonicalJson, createCanonicalBuilderInstrumentation };
export type {
  CanonicalBuilderFailure,
  CanonicalBuilderInstrumentation,
  CanonicalSortInstrumentation,
};
