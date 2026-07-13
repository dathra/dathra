import { describe, expect, it } from "vitest";

import * as coreApi from "../index";
import * as coreSharedApi from "./index";

/* eslint-disable @typescript-eslint/consistent-type-imports, import/no-duplicates -- Each negative import must fail independently for mutation sensitivity. */
// @ts-expect-error Canonical Identity is not part of the core root runtime API.
import type { CanonicalIdentityError as _CoreRootCanonicalIdentityErrorExport } from "../index";
// @ts-expect-error Canonical Identity is not part of the core root runtime API.
import type { canonicalizeJson as _CoreRootCanonicalizeJsonExport } from "../index";
// @ts-expect-error Canonical Identity is not part of the core root runtime API.
import type { createQualifiedId as _CoreRootCreateQualifiedIdExport } from "../index";
// @ts-expect-error Canonical Identity is not part of the core root runtime API.
import type { digestCanonicalJson as _CoreRootDigestCanonicalJsonExport } from "../index";
// @ts-expect-error Canonical Identity is not part of the core root runtime API.
import type { isSha256Digest as _CoreRootIsSha256DigestExport } from "../index";
// @ts-expect-error Canonical Identity is not part of the core root runtime API.
import type { sha256Digest as _CoreRootSha256DigestExport } from "../index";
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT01 = import("../index").CanonicalIdentityErrorCode;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT02 = import("../index").CanonicalIdentityPathSegment;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT03 = import("../index").CanonicalJsonEncoding;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT04 = import("../index").CanonicalJsonText;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT05 = import("../index").CanonicalJsonValue;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT06 = import("../index").QualifiedId<string>;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT07 = import("../index").QualifiedIdInput<string>;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT08 = import("../index").QualifiedIdPreimage<string>;
// @ts-expect-error Canonical Identity types are not part of the core root API.
type _CoreRootT09 = import("../index").Sha256Digest;
type _CoreRootT10 = typeof _CoreRootCanonicalIdentityErrorExport;
type _CoreRootT11 = typeof _CoreRootCanonicalizeJsonExport;
type _CoreRootT12 = typeof _CoreRootCreateQualifiedIdExport;
type _CoreRootT13 = typeof _CoreRootDigestCanonicalJsonExport;
type _CoreRootT14 = typeof _CoreRootIsSha256DigestExport;
type _CoreRootT15 = typeof _CoreRootSha256DigestExport;

// @ts-expect-error Canonical Identity is not part of the core shared runtime API.
import type { CanonicalIdentityError as _CoreSharedCanonicalIdentityErrorExport } from "./index";
// @ts-expect-error Canonical Identity is not part of the core shared runtime API.
import type { canonicalizeJson as _CoreSharedCanonicalizeJsonExport } from "./index";
// @ts-expect-error Canonical Identity is not part of the core shared runtime API.
import type { createQualifiedId as _CoreSharedCreateQualifiedIdExport } from "./index";
// @ts-expect-error Canonical Identity is not part of the core shared runtime API.
import type { digestCanonicalJson as _CoreSharedDigestCanonicalJsonExport } from "./index";
// @ts-expect-error Canonical Identity is not part of the core shared runtime API.
import type { isSha256Digest as _CoreSharedIsSha256DigestExport } from "./index";
// @ts-expect-error Canonical Identity is not part of the core shared runtime API.
import type { sha256Digest as _CoreSharedSha256DigestExport } from "./index";
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT01 = import("./index").CanonicalIdentityErrorCode;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT02 = import("./index").CanonicalIdentityPathSegment;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT03 = import("./index").CanonicalJsonEncoding;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT04 = import("./index").CanonicalJsonText;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT05 = import("./index").CanonicalJsonValue;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT06 = import("./index").QualifiedId<string>;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT07 = import("./index").QualifiedIdInput<string>;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT08 = import("./index").QualifiedIdPreimage<string>;
// @ts-expect-error Canonical Identity types are not part of the core shared API.
type _CoreSharedT09 = import("./index").Sha256Digest;
type _CoreSharedT10 = typeof _CoreSharedCanonicalIdentityErrorExport;
type _CoreSharedT11 = typeof _CoreSharedCanonicalizeJsonExport;
type _CoreSharedT12 = typeof _CoreSharedCreateQualifiedIdExport;
type _CoreSharedT13 = typeof _CoreSharedDigestCanonicalJsonExport;
type _CoreSharedT14 = typeof _CoreSharedIsSha256DigestExport;
type _CoreSharedT15 = typeof _CoreSharedSha256DigestExport;
/* eslint-enable @typescript-eslint/consistent-type-imports, import/no-duplicates */

const CANONICAL_IDENTITY_RUNTIME_NAMES = [
  "CanonicalIdentityError",
  "canonicalizeJson",
  "createQualifiedId",
  "digestCanonicalJson",
  "isSha256Digest",
  "sha256Digest",
] as const;

describe("core shared boundary", () => {
  it("does not widen either core public entry with Canonical Identity", () => {
    for (const name of CANONICAL_IDENTITY_RUNTIME_NAMES) {
      expect(coreApi).not.toHaveProperty(name);
      expect(coreSharedApi).not.toHaveProperty(name);
    }
  });
});
