import { defineConfig, presetIcons } from "unocss";

/**
 * Icons only. VitePress already ships a full theme, so utility classes would
 * fight it; `presetIcons` gives us `<span class="i-hugeicons-copy-01" />` and
 * nothing else. The collection is installed locally
 * (`@iconify-json/hugeicons`), so no icon is fetched at build time.
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
  // Icons composed at runtime (`:class="'i-hugeicons-' + name"`) are invisible
  // to the static extractor, so every dynamic name is listed here — the whole
  // of `KIND_ICONS` in `theme/engine.ts`, plus the fallback.
  safelist: [
    "i-hugeicons-ruler",
    "i-hugeicons-weight-scale",
    "i-hugeicons-timer-01",
    "i-hugeicons-hashtag",
    "i-hugeicons-percent",
    "i-hugeicons-thermometer",
    "i-hugeicons-thermometer-warm",
    "i-hugeicons-triangle",
    "i-hugeicons-hard-drive",
    "i-hugeicons-dashboard-speed-01",
    "i-hugeicons-square",
    "i-hugeicons-test-tube-01",
    "i-hugeicons-money-01",
    "i-hugeicons-date-time",
    "i-hugeicons-map-pin",
    // Fallback icon for a kind with no entry in KIND_ICONS — the custom-kind
    // demo registers kinds that cannot be known at build time.
    "i-hugeicons-shapes",
    "i-hugeicons-checkmark-circle-01",
    "i-hugeicons-cancel-circle",
    "i-hugeicons-copy-01",
    "i-hugeicons-tick-02",
    "i-hugeicons-download-01",
  ],
});
