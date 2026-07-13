import { afterEach, describe, expect, it, vi } from "vitest";

import * as publicApi from "../index";
import {
  CanonicalIdentityError,
  canonicalizeJson,
  createQualifiedId,
  digestCanonicalJson,
  isSha256Digest,
  sha256Digest,
  type CanonicalIdentityErrorCode,
  type CanonicalIdentityPathSegment,
  type Sha256Digest,
} from "./implementation";

/* eslint-disable @typescript-eslint/consistent-type-imports -- Negative export probes must query missing types. */
// @ts-expect-error Canonical Identity types remain package-internal.
type _T01 = import("../index").CanonicalIdentityErrorCode;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T02 = import("../index").CanonicalIdentityPathSegment;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T03 = import("../index").CanonicalJsonEncoding;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T04 = import("../index").CanonicalJsonText;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T05 = import("../index").CanonicalJsonValue;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T06 = import("../index").QualifiedId<string>;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T07 = import("../index").QualifiedIdInput<string>;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T08 = import("../index").QualifiedIdPreimage<string>;
// @ts-expect-error Canonical Identity types remain package-internal.
type _T09 = import("../index").Sha256Digest;
/* eslint-enable @typescript-eslint/consistent-type-imports */

const EMPTY_SHA256 = "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU";
const ABC_SHA256 = "sha-256:ungWv48Bz-pBQUDeXa4iI7ADYaOWF3qctBD_YfIAFa0";

afterEach(() => {
  vi.unstubAllGlobals();
});

function requireSha256Digest(value: string): Sha256Digest {
  if (!isSha256Digest(value)) {
    throw new Error(`Invalid test digest: ${value}`);
  }

  return value;
}

function expectCanonicalError(
  operation: () => unknown,
  code: CanonicalIdentityErrorCode,
  path: readonly CanonicalIdentityPathSegment[] = [],
): CanonicalIdentityError {
  try {
    operation();
  } catch (error) {
    if (!(error instanceof CanonicalIdentityError)) {
      throw error;
    }
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

  throw new Error("Expected a CanonicalIdentityError");
}

describe("canonicalizeJson", () => {
  it("canonicalizes nested values independently of object insertion order", () => {
    const first = canonicalizeJson({
      z: [true, null, { b: 2, a: 1 }],
      a: "text",
    });
    const second = canonicalizeJson({
      a: "text",
      z: [true, null, { a: 1, b: 2 }],
    });

    expect(first.text).toBe('{"a":"text","z":[true,null,{"a":1,"b":2}]}');
    expect(second.text).toBe(first.text);
    expect(second.bytes).toEqual(first.bytes);
    expect(new TextDecoder().decode(first.bytes)).toBe(first.text);
  });

  it("uses RFC 8785 number serialization", () => {
    const encoding = canonicalizeJson({
      numbers: [Number("333333333.33333329"), 1e30, 4.5, 0.002, 1e-27],
    });

    expect(encoding.text).toBe(
      '{"numbers":[333333333.3333333,1e+30,4.5,0.002,1e-27]}',
    );
  });

  it("sorts property names by UTF-16 code units without Unicode normalization", async () => {
    const value: Record<string, unknown> = {};
    value["\ufb33"] = "Hebrew";
    value["\u20ac"] = "Euro";
    value["\ud83d\ude00"] = "Emoji";
    value["\u00f6"] = "Latin";
    value["\u0080"] = "Control";
    value["1"] = "One";
    value["\r"] = "Carriage Return";

    expect(canonicalizeJson(value).text).toBe(
      '{"\\r":"Carriage Return","1":"One","\u0080":"Control","ö":"Latin","€":"Euro","😀":"Emoji","דּ":"Hebrew"}',
    );

    const composed = canonicalizeJson("é");
    const decomposed = canonicalizeJson("e\u0301");
    expect(composed.text).not.toBe(decomposed.text);
    await expect(digestCanonicalJson("é")).resolves.not.toBe(
      await digestCanonicalJson("e\u0301"),
    );
  });

  it("escapes JSON control characters without escaping slash", () => {
    expect(canonicalizeJson('\u000f\n"\\/').text).toBe('"\\u000f\\n\\"\\\\/"');
  });

  it("accepts null-prototype records and repeated shared values", () => {
    const record: Record<string, unknown> = {};
    Object.setPrototypeOf(record, null);
    record.b = 2;
    record.a = 1;
    const shared = { value: record };

    expect(canonicalizeJson({ left: shared, right: shared }).text).toBe(
      '{"left":{"value":{"a":1,"b":2}},"right":{"value":{"a":1,"b":2}}}',
    );
  });

  it.each([
    [undefined, "unsupported-value"],
    [1n, "unsupported-value"],
    [Symbol("value"), "unsupported-value"],
    [() => 1, "unsupported-value"],
    [Number.NaN, "invalid-number"],
    [Number.POSITIVE_INFINITY, "invalid-number"],
    [Number.NEGATIVE_INFINITY, "invalid-number"],
    [-0, "invalid-number"],
    ["\ud800", "invalid-unicode"],
    ["\udc00", "invalid-unicode"],
    [new Date(0), "unsupported-object"],
    [new Map(), "unsupported-object"],
    [new Set(), "unsupported-object"],
    [Object.create({ inherited: true }), "unsupported-object"],
  ] as const)("rejects unsupported root value %#", (value, code) => {
    expectCanonicalError(() => canonicalizeJson(value), code);
  });

  it("reports a stable path for nested invalid values", () => {
    const error = expectCanonicalError(
      () => canonicalizeJson({ outer: [1, { value: undefined }] }),
      "unsupported-value",
      ["outer", 1, "value"],
    );

    expect(Reflect.set(error.path, 0, "changed")).toBe(false);
    expect(Reflect.set(error, "code", "unsupported-object")).toBe(false);
    expect(error.path).toEqual(["outer", 1, "value"]);
    expect(error.code).toBe("unsupported-value");
  });

  it("rejects invalid property names and never invokes accessors", () => {
    let getterCalls = 0;
    const accessorValue = {};
    Object.defineProperty(accessorValue, "secret", {
      enumerable: true,
      get() {
        getterCalls += 1;
        return "secret";
      },
    });

    expectCanonicalError(
      () => canonicalizeJson(accessorValue),
      "unsupported-property",
      ["secret"],
    );
    expect(getterCalls).toBe(0);

    const invalidKey: Record<string, unknown> = {};
    invalidKey["\ud800"] = true;
    expectCanonicalError(
      () => canonicalizeJson(invalidKey),
      "invalid-unicode",
      ["\ud800"],
    );
  });

  it("rejects hidden and symbol properties", () => {
    const hidden = { visible: true };
    Object.defineProperty(hidden, "hidden", { value: true });
    expectCanonicalError(
      () => canonicalizeJson(hidden),
      "unsupported-property",
      ["hidden"],
    );

    const symbolProperty = { visible: true };
    Object.defineProperty(symbolProperty, Symbol("hidden"), {
      enumerable: true,
      value: true,
    });
    expectCanonicalError(
      () => canonicalizeJson(symbolProperty),
      "unsupported-property",
    );
  });

  it("rejects sparse, accessor, extra-property, and subclass arrays", () => {
    const sparse: number[] = [];
    sparse.length = 3;
    sparse[0] = 1;
    sparse[2] = 3;
    expectCanonicalError(() => canonicalizeJson(sparse), "sparse-array", [1]);

    const accessorArray = [1];
    Object.defineProperty(accessorArray, "0", {
      enumerable: true,
      get() {
        return 1;
      },
    });
    expectCanonicalError(
      () => canonicalizeJson(accessorArray),
      "unsupported-property",
      [0],
    );

    const extraProperty = [1];
    Object.defineProperty(extraProperty, "extra", {
      enumerable: true,
      value: true,
    });
    expectCanonicalError(
      () => canonicalizeJson(extraProperty),
      "unsupported-property",
      ["extra"],
    );

    const emptyProperty = [1];
    Object.defineProperty(emptyProperty, "", {
      enumerable: true,
      value: true,
    });
    expectCanonicalError(
      () => canonicalizeJson(emptyProperty),
      "unsupported-property",
      [""],
    );

    const symbolProperty = [1];
    Object.defineProperty(symbolProperty, Symbol("extra"), {
      enumerable: true,
      value: true,
    });
    expectCanonicalError(
      () => canonicalizeJson(symbolProperty),
      "unsupported-property",
    );

    class NumberList extends Array<number> {}
    expectCanonicalError(
      () => canonicalizeJson(new NumberList(1, 2)),
      "unsupported-object",
    );
  });

  it("rejects direct and indirect cycles", () => {
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
});

describe("SHA-256 digest", () => {
  it("matches known empty and abc vectors", async () => {
    await expect(sha256Digest(new Uint8Array())).resolves.toBe(EMPTY_SHA256);
    await expect(sha256Digest(new TextEncoder().encode("abc"))).resolves.toBe(
      ABC_SHA256,
    );
  });

  it("snapshots exact bytes before returning the promise", async () => {
    const bytes = new TextEncoder().encode("abc");
    const digestPromise = sha256Digest(bytes);
    bytes.fill(0);

    await expect(digestPromise).resolves.toBe(ABC_SHA256);
  });

  it("copies typed array bytes without invoking overridden input hooks", async () => {
    const bytes = new TextEncoder().encode("abc");
    let iteratorCalls = 0;
    let methodCalls = 0;
    Object.defineProperty(bytes, Symbol.iterator, {
      value: () => {
        iteratorCalls += 1;
        return new Uint8Array([0])[Symbol.iterator]();
      },
    });
    Object.defineProperty(bytes, "set", {
      value: () => {
        methodCalls += 1;
      },
    });

    await expect(sha256Digest(bytes)).resolves.toBe(ABC_SHA256);
    expect(iteratorCalls).toBe(0);
    expect(methodCalls).toBe(0);
  });

  it("rejects Uint8Array proxies without invoking their traps", async () => {
    const bytes = new TextEncoder().encode("abc");
    let trapCalls = 0;
    const proxy = new Proxy(bytes, {
      get(_target, property) {
        trapCalls += 1;
        if (property === Symbol.iterator) {
          return function* iterator(): Generator<number> {
            yield 0;
          };
        }
        return undefined;
      },
    });

    await expect(sha256Digest(proxy)).rejects.toMatchObject({
      code: "unsupported-value",
      path: [],
    });
    expect(trapCalls).toBe(0);
  });

  it("rejects non-Uint8 views and detached Uint8Array buffers", async () => {
    await expect(
      Reflect.apply(sha256Digest, undefined, [new Uint16Array([0x6162])]),
    ).rejects.toMatchObject({ code: "unsupported-value", path: [] });

    const detached = new Uint8Array([1, 2, 3]);
    structuredClone(detached.buffer, { transfer: [detached.buffer] });
    await expect(sha256Digest(detached)).rejects.toMatchObject({
      code: "unsupported-value",
      path: [],
    });
  });

  it("snapshots canonical values before returning the promise", async () => {
    const value = { state: "before" };
    const digestPromise = digestCanonicalJson(value);
    value.state = "after";

    await expect(digestPromise).resolves.toBe(
      await digestCanonicalJson({ state: "before" }),
    );
  });

  it("rejects hosts without WebCrypto instead of changing algorithms", async () => {
    vi.stubGlobal("crypto", undefined);

    await expect(sha256Digest(new Uint8Array())).rejects.toMatchObject({
      code: "crypto-unavailable",
      path: [],
    });
  });

  it("rejects noncanonical WebCrypto SHA-256 output", async () => {
    const digest = vi.fn().mockResolvedValue(new Uint8Array([0]).buffer);
    vi.stubGlobal("crypto", { subtle: { digest } });

    await expect(sha256Digest(new Uint8Array())).rejects.toMatchObject({
      code: "crypto-unavailable",
      path: [],
    });
    expect(digest).toHaveBeenCalledOnce();
  });

  it("normalizes WebCrypto SHA-256 operation failures", async () => {
    const digest = vi.fn().mockRejectedValue(new Error("host failure"));
    vi.stubGlobal("crypto", { subtle: { digest } });

    await expect(sha256Digest(new Uint8Array())).rejects.toMatchObject({
      code: "crypto-unavailable",
      path: [],
    });
    expect(digest).toHaveBeenCalledOnce();
  });

  it.each([
    EMPTY_SHA256,
    ABC_SHA256,
    "sha-256:AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA",
    "sha-256:__________________________________________8",
  ])("accepts canonical digest %s", (value) => {
    expect(isSha256Digest(value)).toBe(true);
  });

  it.each([
    null,
    1,
    "SHA-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
    "sha-256:47DEQpj8HBSa+_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
    "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuF=",
    "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFUB",
    "sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFV",
    " sha-256:47DEQpj8HBSa-_TImW-5JCeuQeRkm5NMpJWZG3hSuFU",
    "sha-256:short",
  ])("rejects noncanonical digest %#", (value) => {
    expect(isSha256Digest(value)).toBe(false);
  });
});

describe("createQualifiedId", () => {
  const namespaceId = requireSha256Digest(EMPTY_SHA256);

  it("digests the public domain-separated preimage", async () => {
    const qualifiedId = await createQualifiedId({
      namespaceId,
      kind: "codec",
      localId: "json",
    });

    await expect(
      digestCanonicalJson({
        schema: "dathra.qualified-id/1",
        namespaceId,
        kind: "codec",
        localId: "json",
      }),
    ).resolves.toBe(qualifiedId);
    expect(isSha256Digest(qualifiedId)).toBe(true);
  });

  it("separates namespace, kind, and local ID domains", async () => {
    const base = await createQualifiedId({
      namespaceId,
      kind: "codec",
      localId: "json",
    });
    const otherNamespace = await createQualifiedId({
      namespaceId: requireSha256Digest(ABC_SHA256),
      kind: "codec",
      localId: "json",
    });
    const otherKind = await createQualifiedId({
      namespaceId,
      kind: "resolver",
      localId: "json",
    });
    const otherLocalId = await createQualifiedId({
      namespaceId,
      kind: "codec",
      localId: "json:value",
    });

    expect(new Set([base, otherNamespace, otherKind, otherLocalId]).size).toBe(
      4,
    );
  });

  it("allows an empty local ID and preserves Unicode code points", async () => {
    const empty = await createQualifiedId({
      namespaceId,
      kind: "fact",
      localId: "",
    });
    const unicode = await createQualifiedId({
      namespaceId,
      kind: "fact",
      localId: "日本語",
    });

    expect(isSha256Digest(empty)).toBe(true);
    expect(unicode).not.toBe(empty);
  });

  it("accepts a null-prototype input record", async () => {
    const input: unknown = Object.create(null, {
      namespaceId: { enumerable: true, value: namespaceId },
      kind: { enumerable: true, value: "codec" },
      localId: { enumerable: true, value: "json" },
    });

    await expect(
      Reflect.apply(createQualifiedId, undefined, [input]),
    ).resolves.toBe(
      await createQualifiedId({ namespaceId, kind: "codec", localId: "json" }),
    );
  });

  it("snapshots qualified input fields before returning the promise", async () => {
    const input = { namespaceId, kind: "codec", localId: "before" };
    const qualifiedIdPromise = createQualifiedId(input);
    input.localId = "after";

    await expect(qualifiedIdPromise).resolves.toBe(
      await createQualifiedId({
        namespaceId,
        kind: "codec",
        localId: "before",
      }),
    );
  });

  it("rejects accessors without invoking them", async () => {
    let getterCalls = 0;
    const input = {
      namespaceId,
      kind: "codec",
      get localId(): string {
        getterCalls += 1;
        return "json";
      },
    };

    await expect(createQualifiedId(input)).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: ["localId"],
    });
    expect(getterCalls).toBe(0);
  });

  it("rejects malformed roots and non-closed input records", async () => {
    await expect(
      Reflect.apply(createQualifiedId, undefined, [null]),
    ).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: [],
    });
    await expect(
      Reflect.apply(createQualifiedId, undefined, [
        { namespaceId, kind: "codec", localId: "json", extra: true },
      ]),
    ).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: ["extra"],
    });

    const symbolInput = { namespaceId, kind: "codec", localId: "json" };
    Object.defineProperty(symbolInput, Symbol("hidden"), {
      enumerable: true,
      value: true,
    });
    await expect(createQualifiedId(symbolInput)).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: [],
    });

    const customPrototypeInput: unknown = Object.create(
      { inherited: true },
      {
        namespaceId: { enumerable: true, value: namespaceId },
        kind: { enumerable: true, value: "codec" },
        localId: { enumerable: true, value: "json" },
      },
    );
    await expect(
      Reflect.apply(createQualifiedId, undefined, [customPrototypeInput]),
    ).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: [],
    });

    await expect(
      Reflect.apply(createQualifiedId, undefined, [
        { namespaceId, kind: "codec" },
      ]),
    ).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: ["localId"],
    });

    const hiddenFieldInput = {
      namespaceId,
      kind: "codec",
      localId: "json",
    };
    Object.defineProperty(hiddenFieldInput, "localId", { enumerable: false });
    await expect(createQualifiedId(hiddenFieldInput)).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: ["localId"],
    });
  });

  it("rejects malformed namespace, kind, and local ID", async () => {
    await expect(
      createQualifiedId({
        namespaceId: "sha-256:invalid" as Sha256Digest,
        kind: "codec",
        localId: "json",
      }),
    ).rejects.toMatchObject({ code: "invalid-digest", path: ["namespaceId"] });
    await expect(
      createQualifiedId({ namespaceId, kind: "", localId: "json" }),
    ).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: ["kind"],
    });
    await expect(
      createQualifiedId({ namespaceId, kind: "codec", localId: "\ud800" }),
    ).rejects.toMatchObject({
      code: "invalid-unicode",
      path: ["localId"],
    });
    await expect(
      Reflect.apply(createQualifiedId, undefined, [
        { namespaceId, kind: "codec", localId: 1 },
      ]),
    ).rejects.toMatchObject({
      code: "invalid-qualified-id",
      path: ["localId"],
    });
  });
});

describe("package boundary", () => {
  it("keeps canonical identity internal until a production consumer exists", () => {
    expect(publicApi).not.toHaveProperty("CanonicalIdentityError");
    expect(publicApi).not.toHaveProperty("canonicalizeJson");
    expect(publicApi).not.toHaveProperty("sha256Digest");
    expect(publicApi).not.toHaveProperty("digestCanonicalJson");
    expect(publicApi).not.toHaveProperty("createQualifiedId");
    expect(publicApi).not.toHaveProperty("isSha256Digest");
  });
});
