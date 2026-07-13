import {
  CanonicalIdentityError,
  digestCanonicalJson,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import {
  snapshotRenderDefinitionCreatorDescriptors,
  snapshotRenderDefinitionParserDescriptors,
} from "./descriptorSnapshot";
import { RenderDefinitionError } from "./error";
import type {
  RenderDefinition,
  RenderDefinitionId,
  RenderDefinitionInput,
} from "./model";
import {
  validateRenderDefinitionCreatorSnapshot,
  validateRenderDefinitionParserSnapshot,
} from "./validatedSnapshot";

function throwRenderDefinitionIdentityError(
  error: unknown,
  pathPrefix: readonly (string | number)[],
): never {
  if (!(error instanceof CanonicalIdentityError)) {
    throw error;
  }

  if (error.code === "crypto-unavailable") {
    throw new RenderDefinitionError(
      "crypto-unavailable",
      [],
      "[dathra] WebCrypto is unavailable for render definition identity",
    );
  }

  throw new RenderDefinitionError(
    "invalid-field",
    [...pathPrefix, ...error.path],
    "[dathra] Render definition preimage is not canonical",
  );
}

function issueRenderDefinitionId(digest: Sha256Digest): RenderDefinitionId {
  return digest as RenderDefinitionId;
}

/** Creates an immutable render definition with its canonical content identity. */
async function createRenderDefinition(
  input: RenderDefinitionInput,
): Promise<RenderDefinition> {
  const snapshot = snapshotRenderDefinitionCreatorDescriptors(input);
  const preimage = validateRenderDefinitionCreatorSnapshot(snapshot);

  let digest: Sha256Digest;
  try {
    digest = await digestCanonicalJson(preimage);
  } catch (error: unknown) {
    throwRenderDefinitionIdentityError(error, []);
  }

  const id = issueRenderDefinitionId(digest);
  return Object.freeze({ id, preimage });
}

/** Parses an immutable render definition after verifying its content identity. */
async function parseRenderDefinition(
  value: unknown,
): Promise<RenderDefinition> {
  const snapshot = snapshotRenderDefinitionParserDescriptors(value);
  const unbranded = validateRenderDefinitionParserSnapshot(snapshot);

  let computedDigest: Sha256Digest;
  try {
    computedDigest = await digestCanonicalJson(unbranded.preimage);
  } catch (error: unknown) {
    throwRenderDefinitionIdentityError(error, ["preimage"]);
  }

  if (computedDigest !== unbranded.id) {
    throw new RenderDefinitionError(
      "digest-mismatch",
      ["id"],
      "[dathra] Render definition ID does not match its canonical preimage",
    );
  }

  const id = issueRenderDefinitionId(computedDigest);
  return Object.freeze({ id, preimage: unbranded.preimage });
}

export { createRenderDefinition, parseRenderDefinition };
