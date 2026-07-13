import { ExecutionContractError, fail, type ValidationPath } from "./identity";

/** A structural value that may be captured from a closed data descriptor. */
type ClosedDescriptorValue = null | boolean | number | string | object;

/** Metadata available before record property descriptors are inspected. */
interface ClosedRecordHeader {
  readonly kind: "record";
  readonly ownKeys: readonly PropertyKey[];
}

/** Metadata available before array item descriptors are inspected. */
interface ClosedArrayHeader {
  readonly kind: "array";
  readonly ownKeys: readonly PropertyKey[];
  readonly length: number;
}

/** Precharge metadata captured for one distinct container identity. */
type ClosedContainerHeader = ClosedRecordHeader | ClosedArrayHeader;

/** A getter-free record view captured from complete property descriptors. */
interface ClosedRecordView {
  readonly kind: "record";
  readonly entries: readonly (readonly [string, ClosedDescriptorValue])[];
}

/** A getter-free dense array view captured from complete item descriptors. */
interface ClosedArrayView {
  readonly kind: "array";
  readonly items: readonly ClosedDescriptorValue[];
}

/** A complete getter-free view of one distinct container identity. */
type ClosedContainerView = ClosedRecordView | ClosedArrayView;

/** Captures container metadata and descriptors for exactly one operation. */
interface ClosedDescriptorCapture {
  /** Captures only metadata that the caller must charge before completion. */
  captureHeader(value: unknown, path: ValidationPath): ClosedContainerHeader;

  /** Completes a view after the caller has charged all header-derived work. */
  completeView(value: object, path: ValidationPath): ClosedContainerView;
}

type CaptureStatus =
  | "capturing-header"
  | "header"
  | "completing"
  | "complete"
  | "failed";

interface CaptureState {
  status: CaptureStatus;
  header?: ClosedContainerHeader;
  view?: ClosedContainerView;
  failure?: ExecutionContractError;
  activePath?: ValidationPath;
  activeSegment?: string | number;
}

const MAXIMUM_ARRAY_LENGTH = 0xffff_ffff;

function isNonNullObject(value: unknown): value is object {
  return typeof value === "object" && value !== null;
}

function failCapture(
  state: CaptureState,
  path: ValidationPath,
  detail: string,
): never {
  try {
    fail("invalid-closed-record", path, detail);
  } catch (error) {
    state.status = "failed";
    if (error instanceof ExecutionContractError) state.failure = error;
    throw error;
  }
}

function failAtProperty(
  state: CaptureState,
  containerPath: ValidationPath,
  segment: string | number | undefined,
  detail: string,
): never {
  failCapture(
    state,
    segment === undefined ? containerPath : [...containerPath, segment],
    detail,
  );
}

function throwCachedFailure(state: CaptureState): never {
  if (state.failure !== undefined) throw state.failure;
  throw new TypeError("[dathra] Closed descriptor capture is incomplete");
}

function assertCapturePhase(
  state: CaptureState,
  expected: "capturing-header" | "completing",
  path: ValidationPath,
): void {
  if (state.status === expected) return;
  if (state.status === "failed") throwCachedFailure(state);
  failAtProperty(
    state,
    state.activePath ?? path,
    state.activeSegment,
    "Closed descriptor capture was reentered",
  );
}

function inspectArray(
  state: CaptureState,
  value: object,
  path: ValidationPath,
): boolean {
  let result: boolean;
  try {
    result = Array.isArray(value);
  } catch {
    if (state.status === "failed") throwCachedFailure(state);
    failCapture(state, path, "Could not inspect the container array kind");
  }
  assertCapturePhase(state, "capturing-header", path);
  return result;
}

function inspectPrototype(
  state: CaptureState,
  value: object,
  path: ValidationPath,
): object | null {
  let prototype: object | null;
  try {
    prototype = Reflect.getPrototypeOf(value);
  } catch {
    if (state.status === "failed") throwCachedFailure(state);
    failCapture(state, path, "Could not inspect the container prototype");
  }
  assertCapturePhase(state, "capturing-header", path);
  return prototype;
}

function inspectOwnKeys(
  state: CaptureState,
  value: object,
  path: ValidationPath,
): readonly PropertyKey[] {
  let ownKeys: PropertyKey[];
  try {
    ownKeys = Reflect.ownKeys(value);
  } catch {
    if (state.status === "failed") throwCachedFailure(state);
    failCapture(state, path, "Could not inspect container own keys");
  }
  assertCapturePhase(state, "capturing-header", path);

  try {
    return Object.freeze(ownKeys);
  } catch {
    failCapture(state, path, "Could not freeze container own keys");
  }
}

function readDescriptor(
  state: CaptureState,
  expected: "capturing-header" | "completing",
  value: object,
  key: PropertyKey,
  containerPath: ValidationPath,
  segment: string | number | undefined,
): PropertyDescriptor {
  state.activePath = containerPath;
  state.activeSegment = segment;
  let descriptor: PropertyDescriptor | undefined;
  try {
    descriptor = Reflect.getOwnPropertyDescriptor(value, key);
  } catch {
    if (state.status === "failed") throwCachedFailure(state);
    failAtProperty(
      state,
      containerPath,
      segment,
      "Could not inspect the container property descriptor",
    );
  }
  assertCapturePhase(state, expected, containerPath);
  if (descriptor === undefined) {
    failAtProperty(
      state,
      containerPath,
      segment,
      "Container property descriptor disappeared",
    );
  }
  return descriptor;
}

function includesIntrinsicLength(ownKeys: readonly PropertyKey[]): boolean {
  for (let index = 0; index < ownKeys.length; index += 1) {
    if (ownKeys[index] === "length") return true;
  }
  return false;
}

function readArrayLength(
  state: CaptureState,
  value: object,
  ownKeys: readonly PropertyKey[],
  path: ValidationPath,
): number {
  if (!includesIntrinsicLength(ownKeys)) {
    failCapture(state, path, "Array own keys must include intrinsic length");
  }

  const descriptor = readDescriptor(
    state,
    "capturing-header",
    value,
    "length",
    path,
    undefined,
  );
  const length: unknown = descriptor.value;
  if (
    !Object.hasOwn(descriptor, "value") ||
    descriptor.enumerable !== false ||
    descriptor.configurable !== false ||
    typeof length !== "number" ||
    !Number.isInteger(length) ||
    length < 0 ||
    length > MAXIMUM_ARRAY_LENGTH
  ) {
    failCapture(state, path, "Array length must be a standard data descriptor");
  }
  return length;
}

function readClosedDescriptorValue(
  state: CaptureState,
  descriptor: PropertyDescriptor,
  containerPath: ValidationPath,
  segment: string | number | undefined,
): ClosedDescriptorValue {
  if (!Object.hasOwn(descriptor, "value") || descriptor.enumerable !== true) {
    failAtProperty(
      state,
      containerPath,
      segment,
      "Closed properties must be enumerable data properties",
    );
  }

  const value: unknown = descriptor.value;
  if (
    value !== null &&
    typeof value !== "boolean" &&
    typeof value !== "number" &&
    typeof value !== "string" &&
    typeof value !== "object"
  ) {
    failAtProperty(
      state,
      containerPath,
      segment,
      "Closed property value has an unsupported structural type",
    );
  }
  return value;
}

function toArrayIndex(key: string): number | undefined {
  if (key.length === 0) return undefined;
  const index = Number(key);
  if (
    !Number.isInteger(index) ||
    index < 0 ||
    index >= MAXIMUM_ARRAY_LENGTH ||
    String(index) !== key
  ) {
    return undefined;
  }
  return index;
}

function defineArrayElement<Value>(
  target: Value[],
  index: number,
  value: Value,
): void {
  const defined = Reflect.defineProperty(target, index, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  });
  if (!defined) {
    throw new TypeError("[dathra] Could not define sanitized descriptor data");
  }
}

function captureRecordView(
  state: CaptureState,
  value: object,
  header: ClosedRecordHeader,
  path: ValidationPath,
): ClosedRecordView {
  const entries: (readonly [string, ClosedDescriptorValue])[] = [];
  for (let keyIndex = 0; keyIndex < header.ownKeys.length; keyIndex += 1) {
    const key = header.ownKeys[keyIndex];
    const segment = typeof key === "string" ? key : undefined;
    const descriptor = readDescriptor(
      state,
      "completing",
      value,
      key,
      path,
      segment,
    );
    const descriptorValue = readClosedDescriptorValue(
      state,
      descriptor,
      path,
      segment,
    );
    if (typeof key !== "string") {
      failCapture(state, path, "Closed records do not accept symbol keys");
    }

    const entry: [string, ClosedDescriptorValue] = [key, descriptorValue];
    defineArrayElement(entries, entries.length, Object.freeze(entry));
  }
  return Object.freeze({
    kind: "record",
    entries: Object.freeze(entries),
  });
}

function captureArrayView(
  state: CaptureState,
  value: object,
  header: ClosedArrayHeader,
  path: ValidationPath,
): ClosedArrayView {
  const items: ClosedDescriptorValue[] = [];
  for (let keyIndex = 0; keyIndex < header.ownKeys.length; keyIndex += 1) {
    const key = header.ownKeys[keyIndex];
    if (key === "length") continue;

    const index = typeof key === "string" ? toArrayIndex(key) : undefined;
    const segment = typeof key === "symbol" ? undefined : (index ?? key);
    const descriptor = readDescriptor(
      state,
      "completing",
      value,
      key,
      path,
      segment,
    );
    const descriptorValue = readClosedDescriptorValue(
      state,
      descriptor,
      path,
      segment,
    );
    if (typeof key !== "string") {
      failCapture(state, path, "Closed arrays do not accept symbol keys");
    }
    if (index === undefined || index >= header.length) {
      failAtProperty(
        state,
        path,
        segment,
        "Closed arrays do not accept extra own keys",
      );
    }
    defineArrayElement(items, index, descriptorValue);
  }

  for (let index = 0; index < header.length; index += 1) {
    if (!Object.hasOwn(items, index)) {
      failAtProperty(state, path, index, "Closed arrays must not be sparse");
    }
  }
  return Object.freeze({
    kind: "array",
    items: Object.freeze(items),
  });
}

class OperationClosedDescriptorCapture implements ClosedDescriptorCapture {
  readonly #states = new WeakMap<object, CaptureState>();

  captureHeader(value: unknown, path: ValidationPath): ClosedContainerHeader {
    if (!isNonNullObject(value)) {
      fail(
        "invalid-closed-record",
        path,
        "Expected a non-null record or array container",
      );
    }

    const cached = this.#states.get(value);
    if (cached !== undefined) {
      if (cached.status === "failed") throwCachedFailure(cached);
      if (cached.status === "capturing-header") {
        failAtProperty(
          cached,
          cached.activePath ?? path,
          cached.activeSegment,
          "Closed descriptor header was reentered",
        );
      }
      if (cached.header === undefined) throwCachedFailure(cached);
      return cached.header;
    }

    const state: CaptureState = {
      status: "capturing-header",
      activePath: path,
    };
    this.#states.set(value, state);
    const array = inspectArray(state, value, path);
    const prototype = inspectPrototype(state, value, path);
    if (
      (array && prototype !== Array.prototype) ||
      (!array && prototype !== Object.prototype && prototype !== null)
    ) {
      failCapture(
        state,
        path,
        "Expected a current-prototype array or a plain/null-prototype record",
      );
    }

    const ownKeys = inspectOwnKeys(state, value, path);
    const header: ClosedContainerHeader = array
      ? Object.freeze({
          kind: "array",
          ownKeys,
          length: readArrayLength(state, value, ownKeys, path),
        })
      : Object.freeze({ kind: "record", ownKeys });
    assertCapturePhase(state, "capturing-header", path);
    state.header = header;
    state.status = "header";
    return header;
  }

  completeView(value: object, path: ValidationPath): ClosedContainerView {
    const state = this.#states.get(value);
    if (state === undefined) {
      throw new TypeError(
        "[dathra] Closed descriptor header must be captured before completion",
      );
    }
    if (state.status === "failed") throwCachedFailure(state);
    if (state.status === "complete") {
      if (state.view === undefined) throwCachedFailure(state);
      return state.view;
    }
    if (state.status !== "header" || state.header === undefined) {
      failAtProperty(
        state,
        state.activePath ?? path,
        state.activeSegment,
        "Closed descriptor view was reentered",
      );
    }

    state.status = "completing";
    state.activePath = path;
    state.activeSegment = undefined;
    const view =
      state.header.kind === "record"
        ? captureRecordView(state, value, state.header, path)
        : captureArrayView(state, value, state.header, path);
    assertCapturePhase(state, "completing", path);
    state.view = view;
    state.status = "complete";
    state.activePath = undefined;
    state.activeSegment = undefined;
    return view;
  }
}

/** Creates a fresh descriptor capture for one source contract operation. */
function createClosedDescriptorCapture(): ClosedDescriptorCapture {
  return new OperationClosedDescriptorCapture();
}

export { createClosedDescriptorCapture };
export type {
  ClosedContainerHeader,
  ClosedContainerView,
  ClosedDescriptorCapture,
  ClosedDescriptorValue,
};
