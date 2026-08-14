import { aliasesFor, defineVocabulary } from "@smartput/core";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk` and `es` next door make, kept here for `es`'s
 * reason rather than `en`'s.
 *
 * Italian's own conversion keywords are `in` and `a`
 * (`@smartput/core/locale/it`), so "in" is a keyword surface in *this* language
 * too — `lex` emits a keyword token for it and no alias index could claim it
 * anyway. It would stay out even if that were not so, because
 * `registry.aliasIndex` is one flat map that `MatchCtx.isUnitAlias` reads
 * without consulting a locale: an Italian vocabulary registering `in` would put
 * it back in front of `@smartput/datetime`'s accept-gate for any engine
 * speaking both languages, and "in 3 days" would read as an all-units phrase
 * again. An Italian reader types `pollice`, so the omission costs this
 * vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * Italian words for the length units — the same eight units `en`, `uk` and `es`
 * name, and the same answer to "does this unit have words at all?": all eight
 * do. Italian writes a length out as readily as English does.
 *
 * **Two `forms` keys, not eight and not three.** `italian.selectForm` returns
 * `one` for an integer count of exactly 1 and `other` for everything else — 0, a
 * fraction, and a missing count (ruling R5). `Intl.PluralRules("it")` declares a
 * third category, `many`, which CLDR gives to exact millions because Italian
 * says "un milione **di** metri"; the language folds it into `other` once,
 * centrally, because this engine prints "1.000.000 metri" and the word there is
 * the ordinary plural. Ukrainian needs eight keys because it composes a
 * grammatical case with a plural category; Italian composes nothing — its nouns
 * do not decline, so "in metri" is the same word as "5 metri" — and a third row
 * here would be a word no count could ever select (rule 6).
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in an Italian engine and
 * the micro path (`parseLength`) cannot drift from it.
 *
 * The Italian spellings are appended, singular and plural both, because every
 * string this file *prints* has to be a string it reads — and in Italian that
 * obligation bites harder than in Spanish. Spanish adds `-s` and its stripper
 * takes it off again; Italian **substitutes** the final vowel, so `it.ts` folds
 * plurals backwards through a substitution table at `weight: -2`. That table is
 * a guess, and a word this file chose to print should never depend on one.
 *
 * Two entries need more than the ordinary `-o → -i`:
 *
 *   `pollice` → `pollici` and `piede` → `piedi` are the third declension, the
 *   `-e → -i` class that takes the same plural vowel as the masculines without
 *   being masculine in the singular (`it.ts` calls it the `i → e` row, since it
 *   folds the other way).
 *
 *   `miglio` → `miglia` is the small irregular class — a masculine singular
 *   whose plural is feminine in `-a` (like `paio`/`paia`, `migliaio`/`migliaia`)
 *   and the one row in `it.ts`'s table that reads `a → o`. Nothing about the
 *   singular predicts it, which is exactly why both are declared here.
 *
 * `chilometro` is the official spelling and `kilometro` the technical variant
 * that survives beside it; both are read, and the `ch` one is printed. Neither
 * carries an accent — Italian marks stress in writing only on a final vowel, and
 * every noun here is stressed earlier — so, unlike `es`, no entry needs an
 * accent-free twin.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Italian itself writes ("5 km", never "5 chilom."), and the spelled
 * singular noun on the four imperial ones. Italian has no abbreviation of its
 * own for an inch, a foot, a yard or a mile: where a short form appears at all
 * it is the English one, which `units.ts` already registers as an alias, so
 * claiming it as the *Italian* symbol would buy nothing and would print `36in`
 * at a reader who wrote `pollici` — and "in" is this language's own conversion
 * keyword besides. `uk` and `es` make the same call for all four (R8 wants an
 * explicit symbol, never an invented one).
 *
 * Like `en`, `uk` and `es`, this file names `length` by **id string** and never
 * imports the kind, which is what lets `@smartput/length/locale/it` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "it",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "millimetro", "millimetri"],
      symbol: "mm",
      forms: { one: "millimetro", other: "millimetri" },
    },
    cm: {
      aliases: [...alias("cm"), "centimetro", "centimetri"],
      symbol: "cm",
      forms: { one: "centimetro", other: "centimetri" },
    },
    m: {
      aliases: [...alias("m"), "metro", "metri"],
      symbol: "m",
      forms: { one: "metro", other: "metri" },
    },
    km: {
      aliases: [...alias("km"), "chilometro", "chilometri", "kilometro", "kilometri"],
      symbol: "km",
      forms: { one: "chilometro", other: "chilometri" },
    },
    in: {
      aliases: [...alias("in"), "pollice", "pollici"],
      symbol: "pollice",
      forms: { one: "pollice", other: "pollici" },
    },
    ft: {
      aliases: [...alias("ft"), "piede", "piedi"],
      symbol: "piede",
      forms: { one: "piede", other: "piedi" },
    },
    // `iarda` with an `i`, which is how Italian spells a borrowed initial /j/
    // (`iarda`, `iota`, `iodio`). The English `yard`/`yards` arrive from
    // `units.ts` and are read unchanged, so the `y` spelling needs no entry.
    yd: {
      aliases: [...alias("yd"), "iarda", "iarde"],
      symbol: "iarda",
      forms: { one: "iarda", other: "iarde" },
    },
    mi: {
      aliases: [...alias("mi"), "miglio", "miglia"],
      symbol: "miglio",
      forms: { one: "miglio", other: "miglia" },
    },
  },
});
