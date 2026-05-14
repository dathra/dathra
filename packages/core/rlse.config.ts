import { defineConfig, presets, z } from "rlse.ts";

export default defineConfig({
  args: z.object({
    level: z.enum(["patch", "minor", "major", "preup"]).default("patch"),
    pre: z.boolean().default(false),
  }),
  flow: ({ args }) =>
    presets.npmRelease({
      resolvePackage: { name: "@dathra/core" },
      calculateNextSemver: { level: args.level, pre: args.pre },
      runCommand: "pnpm build",
      configureGitUser: {
        name: "github-actions[bot]",
        email: "41898282+github-actions[bot]@users.noreply.github.com",
      },
    }),
});
