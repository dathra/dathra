import { defineConfig, presets } from "rlse.ts";

export default defineConfig(
  presets.npmRelease({
    resolvePackage: { name: "@dathomir/plugin" },
    calculateNextSemver: { level: "patch" },
    runCommand: "pnpm build",
    configureGitUser: {
      name: "github-actions[bot]",
      email: "41898282+github-actions[bot]@users.noreply.github.com",
    },
  }),
);
