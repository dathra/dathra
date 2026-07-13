import { execFileSync } from "node:child_process";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  BROWSER_ARTIFACT_DIRECTORY_ENV,
  ROOT_ARTIFACT_DIRECTORY_ENV,
} from "./publicationArtifacts";

const packageRoot = new URL("../", import.meta.url);

function removeDirectory(directory: string): void {
  rmSync(directory, { force: true, recursive: true });
}

export default function setup(): () => void {
  const rootArtifactDirectory = mkdtempSync(
    join(tmpdir(), "dathra-shared-root-artifacts-"),
  );
  const browserArtifactDirectory = mkdtempSync(
    join(tmpdir(), "dathra-shared-browser-artifacts-"),
  );

  try {
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsdown",
        "--out-dir",
        rootArtifactDirectory,
        "--logLevel",
        "error",
      ],
      { cwd: packageRoot, stdio: "pipe" },
    );
    execFileSync(
      "pnpm",
      [
        "exec",
        "tsdown",
        "src/renderContract/implementation.ts",
        "--no-config",
        "--format",
        "esm",
        "--platform",
        "browser",
        "--target",
        "es2022",
        "--out-dir",
        browserArtifactDirectory,
        "--logLevel",
        "error",
      ],
      { cwd: packageRoot, stdio: "pipe" },
    );
  } catch (error) {
    removeDirectory(rootArtifactDirectory);
    removeDirectory(browserArtifactDirectory);
    throw error;
  }

  process.env[ROOT_ARTIFACT_DIRECTORY_ENV] = rootArtifactDirectory;
  process.env[BROWSER_ARTIFACT_DIRECTORY_ENV] = browserArtifactDirectory;

  return () => {
    delete process.env[ROOT_ARTIFACT_DIRECTORY_ENV];
    delete process.env[BROWSER_ARTIFACT_DIRECTORY_ENV];
    removeDirectory(rootArtifactDirectory);
    removeDirectory(browserArtifactDirectory);
  };
}
