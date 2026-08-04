import { defineConfig, presetIcons } from "unocss";

/**
 * Icons only. VitePress already ships a full theme, so utility classes would
 * fight it; `presetIcons` gives us `<span class="i-lucide-copy" />` and nothing
 * else. Collections are installed locally (`@iconify-json/lucide`), so no icon
 * is fetched at build time.
 */
export default defineConfig({
  presets: [
    presetIcons({
      scale: 1.1,
      extraProperties: {
        display: "inline-block",
        "vertical-align": "-0.125em",
        // Inherit the surrounding text colour rather than baking one in.
        color: "currentColor",
      },
    }),
  ],
  content: {
    // Markdown is compiled to a Vue SFC before UnoCSS sees it, so both
    // extensions have to be in the transform pipeline.
    pipeline: { include: [/\.(vue|md)($|\?)/] },
    filesystem: ["**/*.md", ".vitepress/**/*.{vue,ts}"],
  },
  // Icons composed at runtime (`:class="'i-lucide-' + name"`) are invisible to
  // the static extractor, so every dynamic name is listed here.
  safelist: [
    "i-lucide-ruler",
    "i-lucide-weight",
    "i-lucide-timer",
    "i-lucide-hash",
    "i-lucide-circle-check",
    "i-lucide-circle-x",
    "i-lucide-copy",
    "i-lucide-check",
    "i-lucide-download",
  ],
});
