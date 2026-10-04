import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const root = dirname(
  require.resolve("vitest/package.json", { paths: [join(process.cwd(), "packages/reactivity")] }),
);
export default {
  cacheDir: "tmp/dathomir-262-validation/dom-input/.cache",
  resolve: { alias: { vitest: join(root, "dist/index.js") } },
  test: {
    include: ["tmp/dathomir-262-validation/dom-input/*.test.mjs"],
    environment: "node",
    testTimeout: 15000,
    hookTimeout: 30000,
    fileParallelism: false,
  },
};
