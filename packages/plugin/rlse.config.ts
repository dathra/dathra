import { defineConfig, presets, z } from "rlse.ts";

export default defineConfig({
  args: z.object({
    level: z.enum(["patch", "minor", "major", "preup"]).default("patch"),
    pre: z.boolean().default(false),
    releaseVersion: z.string().optional(),
    skipPublish: z.boolean().default(false),
  }),
  flow: ({ args }) =>
    presets.npmRelease({
      resolvePackage: { name: "@dathra/plugin" },
      calculateNextSemver: args.releaseVersion
        ? { version: args.releaseVersion }
        : { level: args.level, pre: args.pre },
      runCommand: "pnpm build && pnpm fmt",
      publishNpmPackage: args.skipPublish ? false : undefined,
      commit: false,
      push: false,
    }),
});
