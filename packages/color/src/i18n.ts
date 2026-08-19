/**
 * `@smartput/color/i18n` — the one module that names `@urcolor/i18n`.
 *
 * It is a subpath rather than part of the root for the reason
 * `@smartput/datetime/holiday` is: the datasets are the expensive half. A
 * consumer who wants CSS syntax and the 148 CSS keywords imports the root and
 * links a parser; a consumer who wants "небесно-блакитний" to resolve imports
 * this and pays for the chunks. Neither pays for the other's.
 *
 * ```ts
 * import { color } from "@smartput/color";
 * import { defineColor } from "@smartput/color";
 * import { loadColorNames } from "@smartput/color/i18n";
 *
 * const names = await loadColorNames(["en", "uk"]);
 * const kind = defineColor({ names });
 * ```
 *
 * Two functions and no wrapper class. `ColorNames` already satisfies
 * `ColorNameLookup` structurally — `of`, `colorOf`, `resolvedOptions` — so the
 * integration is an `await` and a `Promise.all`, and everything else a caller
 * might want (`resolve()`, `supportedLocalesOf`, the source registry, the
 * attribution) is upstream's own surface, imported from upstream.
 */
import {
  type ChannelKey,
  ChannelNames,
  ColorNames,
  type ColorNamesOptions,
} from "@urcolor/i18n";
import { CHANNELS } from "./channels";
import type { ColorNameLookup } from "./names";

export type {
  ChannelKey,
  ColorNameResolution,
  ColorNamesOptions,
  NameSource,
} from "@urcolor/i18n";
export {
  ChannelNames,
  ColorNames,
  getDefaultSources,
  getSource,
  listSources,
} from "@urcolor/i18n";

/**
 * Load one dataset per locale, in the order given.
 *
 * Order is preserved and is meaningful: `defineColor` hands the list straight
 * to the matcher, which asks every dataset and lets the solver rank what comes
 * back, and to the formatter, which picks by locale and falls back to the
 * first. So the locale a consumer cares about most goes first.
 *
 * A locale no source covers throws out of `ColorNames.load` — deliberately not
 * swallowed here. "This engine silently has no Georgian names" is exactly the
 * failure that should surface at boot rather than as an expression that quietly
 * stops resolving.
 */
export function loadColorNames(
  locales: readonly string[],
  options?: ColorNamesOptions,
): Promise<ColorNameLookup[]> {
  return Promise.all(locales.map((locale) => ColorNames.load(locale, options)));
}

/**
 * Channel words in every locale given — "Sättigung", "насиченість", "彩度".
 *
 * `ChannelNames` translates the same twelve labels this package's `CHANNELS`
 * table uses, in 77 languages, and it is synchronous: the tables are small
 * enough to ship rather than chunk. So the whole of channel-word
 * internationalisation is this function and the map it returns, and not one
 * translated word lives in this repository.
 *
 * ```ts
 * const kinds = defineColorKinds({ channelWords: channelWordsFor(["de", "uk"]) });
 * // "#eeff66 with 150 Farbton"
 * ```
 *
 * **First locale wins a collision, and there is one.** Japanese spells both
 * saturation and chroma 彩度, and Korean spells saturation and chroma
 * differently but brightness and lightness alike in several readings. A map is
 * one word to one channel, so the earlier `CHANNELS` entry keeps the word:
 * saturation over chroma, lightness over brightness. Stated rather than hidden,
 * because the alternative — dropping every colliding word — would lose the
 * commonest reading to save the rarer one.
 */
export function channelWordsFor(locales: readonly string[]): Record<string, string> {
  const words: Record<string, string> = {};
  for (const locale of locales) {
    const names = new ChannelNames(locale);
    for (const def of CHANNELS) {
      const label = names.of(def.label.toLowerCase() as ChannelKey);
      if (label === undefined) continue;
      const key = label.toLowerCase();
      if (words[key] === undefined) words[key] = def.id;
    }
  }
  return words;
}
