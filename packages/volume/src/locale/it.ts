import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Italian words for the volume units — the same five units `en`, `uk` and `es`
 * next door name, and the same per-unit decision about whether a unit has words
 * at all.
 *
 * **Two `forms` keys, not eight and not three.** `italian.selectForm` returns
 * `one` for an integer count of exactly 1 and `other` for everything else — 0, a
 * fraction, and a missing count (ruling R5). `Intl.PluralRules("it")` declares a
 * third category, `many`, which CLDR gives to exact millions because Italian
 * says "un milione **di** litri"; the language folds it into `other` once,
 * centrally, because this engine prints "1.000.000 litri" and the word there is
 * the ordinary plural. Italian nouns do not decline, so "in litri" is the same
 * word as "5 litri" and there is no second axis to key on the way Ukrainian
 * keys on case. Gender (masculine `litro`, feminine `pinta`) is a property of
 * the noun, selects nothing, and must not be a key (rule 6).
 *
 * **`m3` carries no `forms`, exactly as `en`, `uk` and `es` carry none**, and in
 * Italian the reason is the sharp one: the name is "metro cubo", *two* words.
 * `lex` builds a word token out of a run of letters, so a space ends it and no
 * single analyzer is ever handed the phrase — a two-word alias could never be
 * reached by the index that would have to hold it, and a two-word `form` would
 * be text the printer emits and the parser refuses. Italian has no one-word
 * colloquial name to fall back on either, the way Ukrainian has "кубометр", so
 * `m3` reads and prints through `m³` alone.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in an Italian engine and
 * the micro path (`parseVolume`) cannot drift from it. The Italian spellings are
 * appended, singular and plural both, because every string this file *prints*
 * has to be a string it reads, and Italian **substitutes** the final vowel to
 * make a plural rather than adding to it — so `it.ts` can only fold a plural
 * back through a substitution table at `weight: -2`, and a word this file chose
 * to print should not depend on a guess.
 *
 * `gallone` → `galloni` is the entry worth naming: it is the third declension,
 * the `-e → -i` class, which reaches the same plural vowel as `litro`/`litri`
 * from a different singular. Italian's spelling of it doubles the `l` and adds
 * the `-one` suffix that Spanish's `galón` carries the stress of — and unlike
 * `galón`/`galones`, no accent moves, because Italian writes a stress mark only
 * on a final vowel. So no entry here needs the accent-free twin `es` declares.
 *
 * `symbol` is the international abbreviation where Italian itself abbreviates
 * (`l`, `ml`, `m³`) and the spelled singular noun where it does not. `gal` is
 * the English clipping riding in from `units.ts` — it stays an alias, so it
 * reads — but printing "3gal" at a reader who typed "galloni" would be answering
 * in another language, and `pinta` has no abbreviation in any register. R8 wants
 * an explicit symbol on every unit, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `volume` by **id string** and never
 * imports the kind, which is what lets `@smartput/volume/locale/it` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "it",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "litro", "litri"],
      symbol: "l",
      forms: { one: "litro", other: "litri" },
    },
    // Two `l` in the prefix and one in `litro`, unlike Spanish's `mililitro`:
    // Italian keeps the double consonant of the Latin `milli-`.
    ml: {
      aliases: [...alias("ml"), "millilitro", "millilitri"],
      symbol: "ml",
      forms: { one: "millilitro", other: "millilitri" },
    },
    m3: { aliases: [...alias("m3")], symbol: "m³" },
    gal: {
      aliases: [...alias("gal"), "gallone", "galloni"],
      symbol: "gallone",
      forms: { one: "gallone", other: "galloni" },
    },
    // Feminine, so the plural is `-a → -e` and not the `-o → -i` of every
    // masculine above it — the one row in this kind that takes the other of
    // Italian's two ordinary endings.
    pint: {
      aliases: [...alias("pint"), "pinta", "pinte"],
      symbol: "pinta",
      forms: { one: "pinta", other: "pinte" },
    },
  },
});
