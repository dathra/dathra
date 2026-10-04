import { fileURLToPath } from "node:url";
import { createRequire } from "node:module";
import path from "node:path";
const require = createRequire(
  new URL("../../../packages/reactivity/package.json", import.meta.url),
);
export default {
  root: fileURLToPath(new URL(".", import.meta.url)),
  resolve: {
    alias: {
      vitest: path.join(path.dirname(require.resolve("vitest/package.json")), "dist/index.js"),
    },
  },
  test: { include: ["verification.test.ts"], testTimeout: 60000, fileParallelism: false },
};
