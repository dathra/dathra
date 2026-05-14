import { defineConfig } from "oxlint";

const packageStructurePlugin = new URL(
  "../plugins/package-structure.mts",
  import.meta.url,
).pathname;

export const config = defineConfig({
  ignorePatterns: ["**/dist/**", "**/node_modules/**", "**/coverage/**"],
  jsPlugins: [packageStructurePlugin],
  plugins: [
    "eslint",
    "typescript",
    "unicorn",
    "oxc",
    "import",
    "promise",
    "vitest",
  ],
  rules: {
    "import/no-cycle": "error",
    "import/no-duplicates": ["error", { preferInline: true }],
    "import/no-self-import": "error",
    "no-unused-vars": "error",
    "no-fallthrough": "error",
    "no-global-assign": "error",
    "no-unreachable": "error",
    "no-use-before-define": [
      "error",
      {
        functions: false,
      },
    ],
    "prefer-const": "error",
    "no-console": "error",
    "import/no-unresolved": "error",
    "no-explicit-any": "error",
    "promise/no-nesting": "error",
    "promise-function-async": "error",
    "require-await": "error",
    "typescript/no-floating-promises": "error",
    "typescript/no-misused-promises": "error",
    "typescript/consistent-type-imports": "warn",
    "typescript/no-unnecessary-condition": "warn",
    "typescript/no-unnecessary-type-assertion": "warn",
    "typescript/no-unsafe-argument": "error",
    "typescript/no-unsafe-assignment": "error",
    "typescript/no-unsafe-call": "error",
    "typescript/no-unsafe-member-access": "error",
    "typescript/no-unsafe-return": "error",
    "typescript/only-throw-error": "error",
    "typescript/switch-exhaustiveness-check": "error",
    "typescript/use-unknown-in-catch-callback-variable": "error",
    "vitest/no-focused-tests": "error",
    "vitest/no-disabled-tests": "error",
    "vitest/no-identical-title": "error",
    "dathra-structure/feature-directory-files": [
      "error",
      {
        excludePaths: ["src/internal", "src/types", "src/**/__screenshots__"],
      },
    ],
    "no-non-null-assertion": "warn",
    "no-throw-literal": "warn",
    "prefer-await-to-then": "warn",
    "prefer-promise-reject-errors": "error",
    "typescript/strict-boolean-expressions": [
      "warn",
      {
        allowNullableObject: false,
        allowNumber: false,
        allowString: false,
      },
    ],
  },
});
