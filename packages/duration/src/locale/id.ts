import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { DURATION_UNITS, type DurationUnit } from "../units";

const alias = (unit: DurationUnit) => aliasesFor(DURATION_UNITS, unit);

/**
 * Indonesian words for the duration units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Same
 * shape as `en.ts`, `nl.ts` and `uk.ts` beside it, down to naming `duration` by
 * **id string** rather than importing the kind — that is what lets this file be
 * imported without linking the ratio table, and `composeLocale` is the seam
 * where the two halves meet. `aliases` reuses the Latin set from `units.ts`
 * rather than retyping it (an Indonesian developer types "2 h" as readily as "2
 * jam"), which keeps the micro path `parseDuration` and the engine path agreeing
 * by construction.
 *
 * **One row per unit, and this is the kind where that is least obvious and most
 * true.** `indonesian.selectForm` returns the constant `"other"` for every count
 * and every slot. Time words are where a Germanic or Slavic language's number
 * axis comes alive — Dutch's *uur* is invariant while *dag* and *week* are
 * marked, Ukrainian needs four rows here and a case axis on top — and Indonesian
 * has none of it. "Satu jam", "dua jam", "seribu jam": the noun never moves,
 * because there is nothing in the language for it to agree with. Plurality is
 * reduplication (*jam-jam*, "the various hours") and reduplication does not
 * survive a numeral; there is no gender, no case, and so no way for "dalam
 * menit" to govern a different word than "dua menit" does. Six units, six rows,
 * and the same word in each of them for every reader who will ever ask.
 *
 * **The six nouns are native, and none is borrowed.** *Detik*, *menit*, *jam*,
 * *hari*, *minggu* are ordinary Indonesian words with no English in them, which
 * makes this package the one where the Indonesian vocabulary carries real weight
 * rather than the symbol casing `@smartput/datasize`'s does. *Milidetik* is the
 * SI prefix on the native noun — Indonesian takes SI prefixes as bound morphemes
 * and writes them closed (*mili-*, *kilo-*, *mega-*), so unlike a rate or a
 * watt-hour this compound is a single letter run and a form the lexer can read
 * back at full weight.
 *
 * The two clipped spellings are listed because Indonesian genuinely writes them:
 * *dtk* and *mnt* are what a cramped interface prints — a navigation app's "3 j
 * 20 mnt" — and they are consonant skeletons rather than truncations, so no
 * suffix stripper would ever have recovered them and `indonesian.analyze` is
 * `[identity()]` anyway. They are read and never printed, because a full word is
 * what an Indonesian sentence uses.
 *
 * **Three symbols are SI's and three could not be Indonesian's, which is the one
 * genuinely constrained column in this file.**
 *
 * - `ms`, `s` and `min` are SI's own and are what Indonesian technical writing
 *   prints. `min` is free here in a way it is not in Dutch, where `@smartput/
 *   duration/locale/nl` has to give it up because *min* is that language's
 *   `minus` keyword: Indonesian spells subtraction "kurang", so the lexer never
 *   claims this string and "5 min" parses.
 * - `jam` is the hour, and the abbreviation Indonesian actually writes for it is
 *   `j` — the same navigation-app register as *mnt* above. It is rejected, and
 *   not for taste: `j` is the joule, which `@smartput/energy/locale/id` prints,
 *   and a one-letter symbol colliding across two kinds is a genuinely different
 *   quantity under one word rather than a ranked ambiguity between two spellings
 *   of one. R8 wants the abbreviation the language writes and never an invented
 *   one, and *jam* is itself a three-letter word that a timetable prints whole —
 *   so the symbol and the printed form coincide here, which is honest for a
 *   language whose "abbreviation" for this unit is the word.
 * - `d` and `wk` stay international for a sharper reason: Indonesian abbreviates
 *   *hari* as `h` and *minggu* as `mg`, and both are already taken. `h` is bound
 *   to the **hour** by this kind's own `units.ts`, so claiming it for the day
 *   would put two units of one kind under one alias — precisely the collision
 *   `assertLocaleContract` calls "does not resolve back", and the one case it
 *   cannot rank its way out of. `mg` is the milligram in `@smartput/mass`. So
 *   the abbreviation the language writes is unavailable rather than unwanted,
 *   and the international one is what remains.
 *
 * *Minggu* is homographic with *Minggu*, "Sunday", and that costs nothing here:
 * the alias index is consulted only where a unit label may stand, and a weekday
 * is never written after a numeral in a measurement. The same goes for *jam*,
 * which is also the noun for a clock.
 *
 * Every unit carries its `forms` row, so `formatValue` takes the word branch and
 * spaces the number from the noun — "1,5 jam", not "1,5jam". That is the case
 * `@smartput/core/locale/id` reasons from when it declines `renderQuantity`; the
 * kinds where the reasoning runs out are the compound ones, `@smartput/datarate`
 * and `@smartput/speed`.
 */
export default defineVocabulary({
  locale: "id",
  kind: "duration",
  units: {
    // The SI prefix on the native noun, closed up into one letter run — which is
    // why this compound can be printed where "kilowatt-jam" one package over
    // cannot.
    ms: {
      aliases: [...alias("ms"), "milidetik"],
      symbol: "ms",
      forms: { other: "milidetik" },
    },
    s: {
      aliases: [...alias("s"), "detik", "dtk"],
      symbol: "s",
      forms: { other: "detik" },
    },
    min: {
      aliases: [...alias("min"), "menit", "mnt"],
      symbol: "min",
      forms: { other: "menit" },
    },
    h: {
      aliases: [...alias("h"), "jam"],
      symbol: "jam",
      forms: { other: "jam" },
    },
    d: {
      aliases: [...alias("d"), "hari"],
      symbol: "d",
      forms: { other: "hari" },
    },
    wk: {
      aliases: [...alias("wk"), "minggu"],
      symbol: "wk",
      forms: { other: "minggu" },
    },
  },
});
