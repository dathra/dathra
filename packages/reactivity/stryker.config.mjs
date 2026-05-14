/** @type {import('@dathra/config/types/stryker/api/core').PartialStrykerOptions} */
const config = {
  plugins: ["@stryker-mutator/vitest-runner"],
  testRunner: "vitest",
  vitest: {
    configFile: "vitest.config.ts",
  },
  // Target only public API implementations (exclude internal alien-signals wrappers and type-only files)
  mutate: [
    "src/batch/implementation.ts",
    "src/computed/implementation.ts",
    "src/createRoot/implementation.ts",
    "src/effect/implementation.ts",
    "src/onCleanup/implementation.ts",
    "src/signal/implementation.ts",
    "src/templateEffect/implementation.ts",
  ],
  // Use coverage data to skip uncovered mutants (faster runs)
  coverageAnalysis: "perTest",
  reporters: ["progress", "html", "clear-text"],
  htmlReporter: {
    fileName: "reports/mutation/index.html",
  },
  // Mutation score thresholds
  thresholds: {
    high: 80,
    low: 60,
    break: null,
  },
  // Increase timeout for reactive computations that involve microtask scheduling
  timeoutMS: 10000,
};

export default config;
