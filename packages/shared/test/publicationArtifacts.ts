import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";

const ROOT_ARTIFACT_DIRECTORY_ENV =
  "DATHRA_SHARED_TEST_ROOT_ARTIFACT_DIRECTORY";
const BROWSER_ARTIFACT_DIRECTORY_ENV =
  "DATHRA_SHARED_TEST_BROWSER_ARTIFACT_DIRECTORY";

function requireArtifactDirectory(environmentVariable: string): string {
  const directory = process.env[environmentVariable];
  if (directory === undefined) {
    throw new Error(
      `Missing shared test artifact directory: ${environmentVariable}`,
    );
  }
  return directory;
}

function sharedRootArtifactPath(fileName: string): string {
  return join(requireArtifactDirectory(ROOT_ARTIFACT_DIRECTORY_ENV), fileName);
}

function readSharedBrowserArtifactBundle(): string {
  const directory = requireArtifactDirectory(BROWSER_ARTIFACT_DIRECTORY_ENV);
  return readdirSync(directory)
    .filter((fileName) => /\.(?:js|mjs)$/u.test(fileName))
    .map((fileName) => readFileSync(join(directory, fileName), "utf8"))
    .join("\n");
}

export {
  BROWSER_ARTIFACT_DIRECTORY_ENV,
  ROOT_ARTIFACT_DIRECTORY_ENV,
  readSharedBrowserArtifactBundle,
  sharedRootArtifactPath,
};
