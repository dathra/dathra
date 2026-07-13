import { buildCanonicalJson } from "./canonicalBuilder";

declare const canonicalJsonTextBrand: unique symbol;
declare const sha256DigestBrand: unique symbol;
declare const qualifiedIdBrand: unique symbol;

/** A closed JSON value accepted by canonical identity encoding. */
type CanonicalJsonValue =
  | null
  | boolean
  | number
  | string
  | readonly CanonicalJsonValue[]
  | { readonly [key: string]: CanonicalJsonValue };

/** RFC 8785 canonical JSON text. */
type CanonicalJsonText = string & {
  readonly [canonicalJsonTextBrand]: true;
};

/** A SHA-256 digest in canonical unpadded base64url form. */
type Sha256Digest = string & {
  readonly [sha256DigestBrand]: true;
};

/** A domain-separated identity branded by its semantic kind. */
type QualifiedId<Kind extends string> = Sha256Digest & {
  readonly [qualifiedIdBrand]: Kind;
};

/** A property or array index in a canonical identity failure path. */
type CanonicalIdentityPathSegment = string | number;

/** Stable failure codes emitted by canonical identity primitives. */
type CanonicalIdentityErrorCode =
  | "unsupported-value"
  | "invalid-number"
  | "invalid-unicode"
  | "unsupported-object"
  | "unsupported-property"
  | "sparse-array"
  | "cyclic-value"
  | "invalid-digest"
  | "invalid-qualified-id"
  | "crypto-unavailable";

/** Canonical JSON text and its exact UTF-8 bytes. */
interface CanonicalJsonEncoding {
  readonly text: CanonicalJsonText;
  readonly bytes: Uint8Array;
}

/** Domain fields required to create a qualified identity. */
interface QualifiedIdInput<Kind extends string> {
  readonly namespaceId: Sha256Digest;
  readonly kind: Kind;
  readonly localId: string;
}

/** Versioned canonical preimage hashed by createQualifiedId. */
interface QualifiedIdPreimage<
  Kind extends string,
> extends QualifiedIdInput<Kind> {
  readonly schema: "dathra.qualified-id/1";
}

type QualifiedIdInputField = keyof QualifiedIdInput<string>;

/** Describes why a value cannot participate in canonical identity. */
class CanonicalIdentityError extends TypeError {
  readonly code: CanonicalIdentityErrorCode;
  readonly path: readonly CanonicalIdentityPathSegment[];

  /** Creates an immutable canonical identity failure. */
  constructor(
    code: CanonicalIdentityErrorCode,
    path: readonly CanonicalIdentityPathSegment[],
    message: string,
  ) {
    super(message);
    this.name = "CanonicalIdentityError";
    this.code = code;
    this.path = Object.freeze([...path]);
    Object.freeze(this);
  }
}

const SHA256_DIGEST_PATTERN = /^sha-256:[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const BASE64URL_ALPHABET =
  "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_";
/* eslint-disable @typescript-eslint/unbound-method -- The intrinsic getter is invoked with a runtime candidate as its this value. */
const ARRAY_BUFFER_BYTE_LENGTH_GETTER = Object.getOwnPropertyDescriptor(
  ArrayBuffer.prototype,
  "byteLength",
)?.get;
/* eslint-enable @typescript-eslint/unbound-method */
// eslint-disable-next-line @typescript-eslint/unbound-method -- The intrinsic is invoked with an internal snapshot as its this value.
const UINT8_ARRAY_SET = Uint8Array.prototype.set;

function formatPath(path: readonly CanonicalIdentityPathSegment[]): string {
  if (path.length === 0) {
    return "$";
  }

  return path.reduce<string>((formatted, segment) => {
    if (typeof segment === "number") {
      return `${formatted}[${segment}]`;
    }

    return `${formatted}[${JSON.stringify(segment)}]`;
  }, "$");
}

function fail(
  code: CanonicalIdentityErrorCode,
  path: readonly CanonicalIdentityPathSegment[],
  detail: string,
): never {
  throw new CanonicalIdentityError(
    code,
    path,
    `[dathra] ${detail} at ${formatPath(path)}`,
  );
}

function readTypedArrayIntrinsic(
  value: unknown,
  property: "length" | typeof Symbol.toStringTag,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(
    Object.getPrototypeOf(Uint8Array.prototype),
    property,
  );
  if (descriptor?.get === undefined) {
    return undefined;
  }

  // eslint-disable-next-line @typescript-eslint/unbound-method -- The intrinsic getter must receive the candidate as its this value.
  return Reflect.apply(descriptor.get, value, []);
}

function hasUint8ArrayBrand(value: unknown): value is Uint8Array {
  if (!ArrayBuffer.isView(value)) {
    return false;
  }

  return readTypedArrayIntrinsic(value, Symbol.toStringTag) === "Uint8Array";
}

function snapshotUint8Array(value: unknown): Uint8Array<ArrayBuffer> {
  if (!hasUint8ArrayBrand(value)) {
    fail("unsupported-value", [], "SHA-256 input must be a genuine Uint8Array");
  }

  const length = readTypedArrayIntrinsic(value, "length");
  if (typeof length !== "number") {
    fail(
      "unsupported-value",
      [],
      "SHA-256 input must expose an intrinsic byte length",
    );
  }

  try {
    const snapshot = new Uint8Array(length);
    Reflect.apply(UINT8_ARRAY_SET, snapshot, [value]);
    return snapshot;
  } catch {
    return fail(
      "unsupported-value",
      [],
      "SHA-256 input must use an attached backing buffer",
    );
  }
}

function hasArrayBufferBrand(value: unknown): value is ArrayBuffer {
  if (ARRAY_BUFFER_BYTE_LENGTH_GETTER === undefined) {
    return false;
  }

  try {
    return (
      typeof Reflect.apply(ARRAY_BUFFER_BYTE_LENGTH_GETTER, value, []) ===
      "number"
    );
  } catch {
    return false;
  }
}

function snapshotSha256Result(value: unknown): Uint8Array<ArrayBuffer> {
  if (!hasArrayBufferBrand(value)) {
    fail(
      "crypto-unavailable",
      [],
      "WebCrypto returned a non-ArrayBuffer SHA-256 result",
    );
  }

  let digest: Uint8Array<ArrayBuffer>;
  try {
    digest = new Uint8Array(value);
  } catch {
    return fail(
      "crypto-unavailable",
      [],
      "WebCrypto returned an unusable SHA-256 result",
    );
  }
  if (digest.byteLength !== 32) {
    fail(
      "crypto-unavailable",
      [],
      "WebCrypto returned a noncanonical SHA-256 result",
    );
  }
  return digest;
}

function validateUnicode(
  value: string,
  path: readonly CanonicalIdentityPathSegment[],
): void {
  for (let index = 0; index < value.length; index += 1) {
    const codeUnit = value.charCodeAt(index);

    if (codeUnit >= 0xd800 && codeUnit <= 0xdbff) {
      const nextCodeUnit = value.charCodeAt(index + 1);
      if (!(nextCodeUnit >= 0xdc00 && nextCodeUnit <= 0xdfff)) {
        fail("invalid-unicode", path, "Lone UTF-16 high surrogate");
      }
      index += 1;
      continue;
    }

    if (codeUnit >= 0xdc00 && codeUnit <= 0xdfff) {
      fail("invalid-unicode", path, "Lone UTF-16 low surrogate");
    }
  }
}

function encodeBase64Url(bytes: Uint8Array): string {
  let encoded = "";

  for (let index = 0; index < bytes.length; index += 3) {
    const first = bytes[index];
    const remaining = bytes.length - index;

    encoded += BASE64URL_ALPHABET[first >> 2];
    if (remaining === 1) {
      encoded += BASE64URL_ALPHABET[(first & 0x03) << 4];
      continue;
    }

    const second = bytes[index + 1];
    encoded += BASE64URL_ALPHABET[((first & 0x03) << 4) | (second >> 4)];
    if (remaining === 2) {
      encoded += BASE64URL_ALPHABET[(second & 0x0f) << 2];
      continue;
    }

    const third = bytes[index + 2];
    encoded += BASE64URL_ALPHABET[((second & 0x0f) << 2) | (third >> 6)];
    encoded += BASE64URL_ALPHABET[third & 0x3f];
  }

  return encoded;
}

function isQualifiedIdInputField(
  value: string,
): value is QualifiedIdInputField {
  return value === "namespaceId" || value === "kind" || value === "localId";
}

function readQualifiedIdInputField(
  input: object,
  field: QualifiedIdInputField,
): unknown {
  const descriptor = Object.getOwnPropertyDescriptor(input, field);
  if (
    descriptor === undefined ||
    descriptor.enumerable !== true ||
    !("value" in descriptor)
  ) {
    fail(
      "invalid-qualified-id",
      [field],
      `Qualified ID ${field} must be an own enumerable data property`,
    );
  }

  const value: unknown = descriptor.value;
  return value;
}

function snapshotQualifiedIdInput(input: unknown): QualifiedIdInput<string> {
  if (typeof input !== "object" || input === null) {
    fail(
      "invalid-qualified-id",
      [],
      "Qualified ID input must be a plain record",
    );
  }

  const prototype = Reflect.getPrototypeOf(input);
  if (prototype !== Object.prototype && prototype !== null) {
    fail(
      "invalid-qualified-id",
      [],
      "Qualified ID input must use the current realm Object prototype or null",
    );
  }

  for (const key of Reflect.ownKeys(input)) {
    if (typeof key === "symbol") {
      fail(
        "invalid-qualified-id",
        [],
        "Qualified ID input must not contain symbol properties",
      );
    }
    if (!isQualifiedIdInputField(key)) {
      fail(
        "invalid-qualified-id",
        [key],
        "Qualified ID input contains an extra field",
      );
    }
  }

  const namespaceId = readQualifiedIdInputField(input, "namespaceId");
  const kind = readQualifiedIdInputField(input, "kind");
  const localId = readQualifiedIdInputField(input, "localId");

  if (!isSha256Digest(namespaceId)) {
    fail("invalid-digest", ["namespaceId"], "Invalid namespace digest");
  }
  if (typeof kind !== "string" || kind.length === 0) {
    fail(
      "invalid-qualified-id",
      ["kind"],
      "Qualified ID kind must be non-empty",
    );
  }
  if (typeof localId !== "string") {
    fail(
      "invalid-qualified-id",
      ["localId"],
      "Qualified local ID must be a string",
    );
  }
  validateUnicode(kind, ["kind"]);
  validateUnicode(localId, ["localId"]);

  return { namespaceId, kind, localId };
}

/** Canonicalizes a closed JSON value using RFC 8785 JCS and UTF-8. */
function canonicalizeJson(value: unknown): CanonicalJsonEncoding {
  const text = buildCanonicalJson(value, fail) as CanonicalJsonText;
  return {
    text,
    bytes: new TextEncoder().encode(text),
  };
}

/** Returns whether a value uses the canonical SHA-256 base64url form. */
function isSha256Digest(value: unknown): value is Sha256Digest {
  return typeof value === "string" && SHA256_DIGEST_PATTERN.test(value);
}

/** Computes a canonical SHA-256 digest from an exact byte snapshot. */
async function sha256Digest(bytes: Uint8Array): Promise<Sha256Digest> {
  const snapshot = snapshotUint8Array(bytes);
  const cryptoHost: { readonly crypto?: Crypto } = globalThis;
  let subtle: SubtleCrypto | undefined;
  let digestOperation: SubtleCrypto["digest"] | undefined;
  try {
    subtle = cryptoHost.crypto?.subtle;
    // eslint-disable-next-line @typescript-eslint/unbound-method -- Reflect.apply preserves the SubtleCrypto receiver after capability lookup.
    digestOperation = subtle?.digest;
  } catch {
    return fail(
      "crypto-unavailable",
      [],
      "WebCrypto SubtleCrypto is unavailable",
    );
  }
  if (subtle === undefined || typeof digestOperation !== "function") {
    fail("crypto-unavailable", [], "WebCrypto SubtleCrypto is unavailable");
  }

  let result: unknown;
  try {
    result = await Reflect.apply(digestOperation, subtle, [
      "SHA-256",
      snapshot,
    ]);
  } catch {
    return fail("crypto-unavailable", [], "WebCrypto SHA-256 operation failed");
  }
  const digest = snapshotSha256Result(result);
  return `sha-256:${encodeBase64Url(digest)}` as Sha256Digest;
}

/** Computes SHA-256 over a synchronous canonical JSON snapshot. */
async function digestCanonicalJson(value: unknown): Promise<Sha256Digest> {
  const encoding = canonicalizeJson(value);
  return await sha256Digest(encoding.bytes);
}

/** Creates a domain-separated qualified identity. */
async function createQualifiedId<Kind extends string>(
  input: QualifiedIdInput<Kind>,
): Promise<QualifiedId<Kind>> {
  const snapshot = snapshotQualifiedIdInput(input);

  const preimage: QualifiedIdPreimage<string> = {
    schema: "dathra.qualified-id/1",
    namespaceId: snapshot.namespaceId,
    kind: snapshot.kind,
    localId: snapshot.localId,
  };
  return (await digestCanonicalJson(preimage)) as QualifiedId<Kind>;
}

export {
  CanonicalIdentityError,
  canonicalizeJson,
  createQualifiedId,
  digestCanonicalJson,
  isSha256Digest,
  sha256Digest,
};
export type {
  CanonicalIdentityErrorCode,
  CanonicalIdentityPathSegment,
  CanonicalJsonEncoding,
  CanonicalJsonText,
  CanonicalJsonValue,
  QualifiedId,
  QualifiedIdInput,
  QualifiedIdPreimage,
  Sha256Digest,
};
