import { defineConfig, steps, z, type RlseContext } from "rlse.ts";

const packageName = "@dathra/reactivity";

export default defineConfig({
  args: z.object({
    level: z.enum(["patch", "minor", "major", "preup"]).default("patch"),
    pre: z.boolean().default(false),
    releaseVersion: z.string().optional(),
    skipPublish: z.boolean().default(false),
    publishOnly: z.boolean().default(false),
  }),
  flow: ({ args }) => {
    const version = ({ results }: RlseContext) =>
      results.findStep("calculateNextSemver").nextVersion;

    return [
      steps.resolvePackage({ name: packageName }),
      steps.resolvePublishedVersion({
        packageName: ({ results }) =>
          results.findStep("resolvePackage").packageName,
        fallbackVersion: ({ results }) =>
          String(
            results.findStep("resolvePackage").packageJson.version ?? "0.0.0",
          ),
      }),
      steps.calculateNextSemver({
        currentVersion: ({ results }) =>
          results.findStep("resolvePublishedVersion").currentVersion,
        packageJson: ({ results }) =>
          results.findStep("resolvePackage").packageJson,
        ...(args.releaseVersion
          ? { version: args.releaseVersion }
          : { level: args.level, pre: args.pre }),
      }),
      ...(args.publishOnly
        ? [steps.publishNpmPackage({ packageName, dryRunVersion: version })]
        : [
            steps.writePackageVersion({
              packageJsonPath: ({ results }) =>
                results.findStep("resolvePackage").packageJsonPath,
              version,
            }),
            steps.runCommand("pnpm build && pnpm fmt"),
            steps.checkNpmPackageVersionAvailable({
              packageName: ({ results }) =>
                results.findStep("resolvePackage").packageName,
              version,
            }),
          ]),
    ];
  },
});
