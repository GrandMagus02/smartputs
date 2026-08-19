import { readdirSync, statSync } from "node:fs";
import { fileURLToPath, URL } from "node:url";
import UnoCSS from "unocss/vite";
import { defineConfig } from "vitepress";
import llmstxt from "vitepress-plugin-llms";
import en from "./locales/en";

const repoRoot = fileURLToPath(new URL("../..", import.meta.url));

/**
 * The newest mtime across every package's `dist`, folded into the dep
 * optimizer's config below so that rebuilding the workspace invalidates the
 * prebundle.
 *
 * Vite serves `/.vitepress/cache/deps/*.js?v=<hash>` as `immutable`, and it
 * computes that hash from the lockfile and this config — never from the
 * contents of a linked dependency. `@smartput/*` are workspace symlinks whose
 * `dist` `docs:dev` rebuilds on every start, so the files behind that URL
 * change while the URL does not: the server has the new bundle and every
 * browser that ever loaded the page keeps the old one, forever, with no reload
 * short of clearing the cache by hand. `vitepress dev --force` does not help —
 * it rewrites the files and leaves the URL alone.
 *
 * Stamping the mtime in gives the hash something to move with. A rebuild that
 * changed nothing leaves it alone, so the cache still survives an ordinary
 * restart.
 */
function distStamp(): string {
  let newest = 0;
  for (const dir of readdirSync(`${repoRoot}/packages`)) {
    try {
      newest = Math.max(
        newest,
        statSync(`${repoRoot}/packages/${dir}/dist/index.js`).mtimeMs,
      );
    } catch {
      // A package with no build yet, or none at this entry. Nothing to stamp.
    }
  }
  return String(Math.round(newest));
}

export default defineConfig({
  title: "Smartputs",
  // `srcDir` is the docs folder itself; the planning documents that live
  // alongside it are not part of the site.
  // `_prose/**` is the hand-written half of the package pages: those files are
  // inlined by scripts/gen-package-pages.ts and must not also be routes.
  srcExclude: ["superpowers/**", "_prose/**", "**/README.md"],
  ignoreDeadLinks: true, // TEMP-PREVIEW
  cleanUrls: true,
  lastUpdated: true,
  metaChunk: true,

  // The palette is neon on near-black; the light theme is the alternate, so the
  // toggle starts on dark rather than following the OS.
  appearance: "dark",

  // English is the root locale (`/`), not `/en/`. A second language is added
  // as `locales.uk = { link: "/uk/", ... }` with its pages under `docs/uk/`;
  // no English URL changes when that happens.
  locales: {
    root: en,
  },

  head: [
    ["link", { rel: "icon", href: "/favicon.svg", type: "image/svg+xml" }],
    ["meta", { name: "theme-color", content: "#090714" }],
  ],

  themeConfig: {
    logo: "/favicon.svg",
    siteTitle: "Smartputs",
    socialLinks: [{ icon: "github", link: "https://github.com/GrandMagus02/smartputs" }],
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
    // Every `@smartput/*` package is bundled into the SSR pass rather than
    // handed to Node. Locally they are workspace symlinks, which Vite would
    // inline anyway; in the production build they are the published tarballs
    // (see `scripts/docs-published.ts`), and left external the barrels that
    // `export *` from a sibling subpath — `@smartput/kinds/validate` over the
    // per-kind `/validate` entries — come back out of Rollup with every name
    // imported from whichever sibling came first. The whole scope, so a demo
    // reaching for a kind the list forgot does not fail only in production.
    ssr: {
      noExternal: [
        /^@smartput\//,
        "smartputs",
        // Reka UI ships single-file components compiled to ESM. Vite must
        // bundle them for the SSR pass rather than hand them to Node, or the
        // `.vue`-derived modules arrive as bare ESM in a CJS require chain.
        "reka-ui",
      ],
    },
    // Prebundled, every entry the theme imports, and named one by one.
    //
    // Vite leaves linked dependencies out of the dep optimizer by default, and
    // a workspace symlink is a linked dependency: unlisted, `@smartput/*` is
    // served as loose ESM, every internal import is another request, and the
    // scanner has to crawl the whole engine — the holiday tables, the geo
    // providers, `decimal.js` — on the way to finding what to optimize. That
    // crawl is what made `docs:dev` sit at 100% CPU for minutes with the page
    // still blank. Esbuild bundles this list once into `.vitepress/cache`
    // instead, and the second start reuses it.
    //
    // Subpaths need naming separately — `@smartput/core` does not stand for
    // `@smartput/core/locale/en`. A demo importing an entry that is missing
    // here still works; it just costs the one reload that adds it.
    optimizeDeps: {
      // ...and nothing is discovered by crawling. Vite's scanner treats a
      // symlinked package as source rather than as a dependency, so it walks
      // the entire engine — every kind, the holiday tables, the geo providers
      // — through the JS resolver before the optimizer has bundled anything.
      // That scan is minutes; esbuild bundling the same graph is one second.
      // With the list below complete there is nothing left for it to find.
      noDiscovery: true,
      // Not read by anything. It is here because Vite hashes `esbuildOptions`
      // into the dep-cache key, and `distStamp` above is the only thing in this
      // config that moves when a workspace package is rebuilt.
      esbuildOptions: { define: { __SMARTPUT_DIST_STAMP__: `"${distStamp()}"` } },
      include: [
        "reka-ui",
        "katex",
        "@smartput/core",
        "@smartput/core/locale/en",
        "@smartput/kinds",
        "@smartput/kinds/locale/en",
        "@smartput/kinds/validate",
        "@smartput/shared",
        "@smartput/math",
        "@smartput/rate",
        "@smartput/rate/locale/en",
        "@smartput/range",
        "@smartput/range/class",
        "@smartput/query",
        "@smartput/query/sql",
        "@smartput/query/mongo",
        "@smartput/geo",
        "@smartput/date",
        "@smartput/date-range",
        "@smartput/datetime",
        "@smartput/datetime/locale/en",
        "@smartput/datetime-range",
        "@smartput/time",
        "@smartput/time-range",
        "@smartput/timezone",
      ],
    },
    server: { fs: { allow: [repoRoot] } },
  },
});
