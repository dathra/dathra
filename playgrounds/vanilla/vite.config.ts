import { dathraVitePlugin } from "@dathra/plugin";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [dathraVitePlugin()],
  esbuild: {
    // Disable esbuild JSX transform - let our plugin handle it
    jsx: "preserve",
  },
});
