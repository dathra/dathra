import { createHash } from "node:crypto";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
const root = fileURLToPath(new URL("../../../", import.meta.url));
const here = fileURLToPath(new URL(".", import.meta.url));
mkdirSync(`${here}/temp`, { recursive: true });
const relative = "tmp/dathomir-262-validation/state-lifetime";
const commands = [
  ["node", `${relative}/build-copy.mjs`],
  ["node_modules/.bin/tsc", "-p", `${relative}/tsconfig.json`],
  ["packages/reactivity/node_modules/.bin/vitest", "run", "--config", `${relative}/vitest.config.ts`, "p03.test.ts", "p06.test.ts", "p07.test.ts"],
];
const output = { node: process.version, sourceHashes: {}, results: [] };
const sources = ["signal", "computed", "effect", "batch", "createRoot", "onCleanup", "templateEffect"].flatMap(api => [
  `packages/reactivity/src/${api}/SPEC.typ`,
  `packages/reactivity/src/${api}/implementation.test.ts`,
  `packages/reactivity/src/${api}/implementation.ts`,
]);
sources.push("packages/reactivity/src/index.ts", "packages/reactivity/src/types/index.ts", "docs/src/components/DocCodeBlock/DocCodeBlock.tsx");
for (const file of sources) output.sourceHashes[file] = createHash("sha256").update(readFileSync(`${root}/${file}`)).digest("hex");
for (const command of commands) {
  const child = spawnSync(command[0], command.slice(1), {
    cwd: root, encoding: "utf8", env: { ...process.env, TMPDIR: `${here}/temp`, TSX_DISABLE_CACHE: "1" },
  });
  output.results.push({ command, status: child.status, stdout: child.stdout, stderr: child.stderr });
  writeFileSync(`${here}/results.json`, JSON.stringify(output, null, 2) + "\n");
  process.stdout.write(child.stdout ?? "");
  process.stderr.write(child.stderr ?? "");
  if (child.status !== 0) process.exit(child.status ?? 1);
}
