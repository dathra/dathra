import { dathraVitePlugin } from "@dathra/plugin";

// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
  compatibilityDate: "2024-11-01",
  devtools: { enabled: true },

  vite: {
    plugins: [
      dathraVitePlugin(),
    ],
    esbuild: {
      jsx: "preserve",
    },
  },

  vue: {
    compilerOptions: {
      isCustomElement: (tag) => tag.startsWith("my-"),
    },
  },

  future: {
    compatibilityVersion: 4,
  },
});
