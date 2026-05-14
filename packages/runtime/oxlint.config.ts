import { defineConfig } from "@dathra/config/oxlint";
import { config } from "@dathra/config/templates/oxlint.template.ts";

export default defineConfig({
  extends: [config],
  overrides: [
    {
      files: ["src/**/*.ts"],
      rules: {
        "no-console": "off",
      },
    },
  ],
});
