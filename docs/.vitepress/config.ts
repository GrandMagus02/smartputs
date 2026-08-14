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
  // `_prose/**` is the hand-written half of the package pages: those files are
  // inlined by scripts/gen-package-pages.ts and must not also be routes.
  srcExclude: ["superpowers/**", "_prose/**", "**/README.md"],
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
        ignoreFiles: ["superpowers/**", "_prose/**"],
        generateLLMsTxt: true,
        generateLLMsFullTxt: true,
        // Emits `<route>.md` next to every `<route>.html`. The page actions
        // in the header fetch exactly those files.
        generateLLMFriendlyDocsForEachPage: true,
      }),
    ],
    // `@smartput/core`, `@smartput/kinds`, `@smartput/rate` and
    // `@smartput/math` are workspace symlinks whose exports point at TypeScript
    // source, so the demos run the same code the tests do — no build step in
    // between. Vite must transform them for the SSR pass too, and the dev
    // server has to be allowed to read outside `docs/`.
    ssr: {
      noExternal: [
        "@smartput/core",
        "@smartput/kinds",
        "@smartput/rate",
        "@smartput/math",
        "@smartput/shared",
        "@smartput/range",
        "@smartput/query",
        "@smartput/geo",
        "@smartput/date",
        "@smartput/time",
        "@smartput/date-range",
        "@smartput/time-range",
        "@smartput/datetime-range",
        // Reka UI ships single-file components compiled to ESM. Vite must
        // bundle them for the SSR pass rather than hand them to Node, or the
        // `.vue`-derived modules arrive as bare ESM in a CJS require chain.
        "reka-ui",
      ],
    },
    optimizeDeps: {
      exclude: [
        "@smartput/core",
        "@smartput/kinds",
        "@smartput/rate",
        "@smartput/math",
        "@smartput/shared",
      ],
    },
    server: { fs: { allow: [repoRoot] } },
  },
});
