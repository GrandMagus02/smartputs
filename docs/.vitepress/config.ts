import { fileURLToPath, URL } from "node:url";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import en from "./locales/en";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

export default defineConfig({
  title: "Smartputs",
  // `srcDir` is the docs folder itself; the planning documents that live
  // alongside it are not part of the site.
  srcExclude: ["superpowers/**", "**/README.md"],
  cleanUrls: true,
  lastUpdated: true,
  metaChunk: true,

  // English is the root locale (`/`), not `/en/`. A second language is added
  // as `locales.uk = { link: "/uk/", ... }` with its pages under `docs/uk/`;
  // no English URL changes when that happens.
  locales: {
    root: en,
  },

  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
    ["meta", { name: "theme-color", content: "#3c9c6d" }],
  ],

  themeConfig: {
    logo: "/favicon.svg",
    siteTitle: "Smartputs",
    socialLinks: [{ icon: "github", link: "https://github.com/GrandMagus/smartputs" }],
    search: { provider: "local" },
  },

  vite: {
    plugins: [
      UnoCSS(),
      llmstxt({
        // Planning documents are not part of the published corpus either.
        ignoreFiles: ["superpowers/**"],
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        // Emits `<route>.md` next to every `<route>.html`. The page actions
        // in the header fetch exactly those files.
        generateLLMFriendlyDocsForEachPage: true,
      }),
    ],
    // `@smartput/core`, `@smartput/kinds`, `@smartput/rates` and
    // `@smartput/math` are workspace symlinks whose exports point at TypeScript
    // source, so the demos run the same code the tests do — no build step in
    // between. Vite must transform them for the SSR pass too, and the dev
    // server has to be allowed to read outside `docs/`.
    ssr: {
      noExternal: [
        "@smartput/core",
        "@smartput/kinds",
        "@smartput/rates",
        "@smartput/math",
      ],
    },
    optimizeDeps: {
      exclude: ["@smartput/core", "@smartput/kinds", "@smartput/rates", "@smartput/math"],
    },
    server: { fs: { allow: [repoRoot] } },
  },
});
