import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const root = dirname(
  require.resolve("vitest/package.json", { paths: [join(process.cwd(), "packages/reactivity")] }),
);
export default {
  resolve: { alias: { vitest: join(root, "dist/index.js") } },
  test: {
    include: ["tmp/dathomir-262-validation/native-controls/*.test.mjs"],
    environment: "node",
    testTimeout: 15000,
  },
};
