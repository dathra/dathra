import { createRequire } from "node:module";
import { dirname, join } from "node:path";
const require = createRequire(import.meta.url);
const vitestRoot = dirname(
  require.resolve("vitest/package.json", { paths: [join(process.cwd(), "packages/reactivity")] }),
);
export default {
  resolve: { alias: { vitest: join(vitestRoot, "dist/index.js") } },
  test: {
    include: ["tmp/dathomir-262-validation/delivery-races/*.test.mjs"],
    environment: "node",
  },
};
