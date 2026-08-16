import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * French words for the volume units — the same five units `en`, `uk` and `es`
 * next door name, and the same per-unit answer about whether a unit has words
 * at all.
 *
 * **Two `forms` keys, and the boundary between them is not English's.**
 * `french.selectForm` returns `one` or `other`, but French puts the singular on
 * everything below two: 0 is `one` ("zéro litre"), 1 is `one`, and every
 * fraction under two is `one` as well — "1,5 litre", where English writes "1.5
 * litres". `other` starts at 2 and also covers the count-free conversion target
 * (ruling R5), which is what French grammar wants anyway: "1 gallon en litres"
 * names the target in the plural. Gender (masculine `litre`, feminine `pinte`)
 * is a property of the noun and selects nothing, so it is not a key (rule 6),
 * and neither is CLDR's third French category, which `fr.ts` folds into `other`
 * because it governs a compact scale word and never the noun beside it.
 *
 * **`m3` carries no `forms`, exactly as `en`, `uk` and `es` carry none**, and
 * in French the reason is the sharp one rather than the stylistic one: the name
 * is "mètre cube", *two* words. `lex` builds a word token out of a run of
 * letters, so a space ends it and no single analyzer is ever handed the phrase —
 * a two-word alias could never be reached by the index that would have to hold
 * it, and a two-word `form` would be text the printer emits and the parser
 * refuses. French has no one-word colloquial name to fall back on either, the
 * way Ukrainian has "кубометр"; the everyday word for a cubic metre of anything
 * sold by volume is "un mètre cube" or, in the trade, "un stère" — which is a
 * different unit (a cubic metre *of stacked firewood*) and has no business in a
 * ratio table it is only sometimes equal to. So `m3` reads and prints through
 * `m³` alone.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a French engine and
 * the micro path (`parseVolume`) cannot drift from it. That reuse covers three
 * of the five outright — `litre`, `millilitre` and `gallon` are French words
 * English borrowed without changing a letter, and all three take the plain `-s`
 * in both languages, so both numbers of each are already in the index. Only
 * `pinte` is genuinely new, and it is appended in both numbers because every
 * string this file *prints* has to be a string it reads and a printed plural
 * recovered only by the language's penalised suffix stripper is a reading this
 * vocabulary should not be leaving to a guess.
 *
 * `symbol` is the international abbreviation where French itself abbreviates
 * (`l`, `ml`, `m³`) and the spelled singular noun where it does not. `gal` is
 * the English clipping riding in from `units.ts` — it stays an alias, so it
 * reads — but printing "3 gal" at a reader who typed "gallons" would be
 * answering in another language, and `pinte` has no abbreviation in any French
 * register. `uk` and `es` reach the same two symbols by the same reasoning (R8
 * wants an explicit symbol on every unit, never an invented one).
 *
 * Like `en`, `uk` and `es`, this file names `volume` by **id string** and never
 * imports the kind, which is what lets `@smartput/volume/locale/fr` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "fr",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l")],
      symbol: "l",
      forms: { one: "litre", other: "litres" },
    },
    // "millilitre" with one `l` in the prefix and two in the stem, which is the
    // French spelling English kept; only the American "milliliter" differs, and
    // `units.ts` already carries that too.
    ml: {
      aliases: [...alias("ml")],
      symbol: "ml",
      forms: { one: "millilitre", other: "millilitres" },
    },
    m3: { aliases: [...alias("m3")], symbol: "m³" },
    gal: {
      aliases: [...alias("gal")],
      symbol: "gallon",
      forms: { one: "gallon", other: "gallons" },
    },
    // The one unit whose French name is not the English one: `pinte`, feminine,
    // and the only entry in this file that adds an alias at all.
    pint: {
      aliases: [...alias("pint"), "pinte", "pintes"],
      symbol: "pinte",
      forms: { one: "pinte", other: "pintes" },
    },
  },
});
