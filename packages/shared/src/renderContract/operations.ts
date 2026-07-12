import {
  CanonicalIdentityError,
  digestCanonicalJson,
  type Sha256Digest,
} from "../canonicalIdentity/implementation";
import { snapshotRenderDefinitionCreatorDescriptors } from "./descriptorSnapshot";
import { RenderDefinitionError } from "./error";
import type {
  RenderDefinition,
  RenderDefinitionId,
  RenderDefinitionInput,
} from "./model";
import { validateRenderDefinitionCreatorSnapshot } from "./validatedSnapshot";

function throwRenderDefinitionIdentityError(error: unknown): never {
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
    error.path,
    "[dathra] Render definition preimage is not canonical",
  );
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
    throwRenderDefinitionIdentityError(error);
  }

  const id = digest as RenderDefinitionId;
  return Object.freeze({ id, preimage });
}

export { createRenderDefinition };
