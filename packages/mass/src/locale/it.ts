import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Italian words for the mass units — the same six units `en`, `uk` and `es` next
 * door name, and the same per-unit answer: all six are nouns an Italian speaker
 * writes out, so all six carry `forms`.
 *
 * **Two `forms` keys, not eight and not three.** `italian.selectForm` returns
 * `one` for an integer count of exactly 1 and `other` for everything else — 0, a
 * fraction, and a missing count (ruling R5). `Intl.PluralRules("it")` declares a
 * third category, `many`, which CLDR gives to exact millions because Italian
 * says "un milione **di** chilogrammi"; the language folds it into `other` once,
 * centrally, because this engine never prints a compact million and a third row
 * here would hold the same string as the second in every vocabulary in the repo.
 * So the table below is English's two-row shape. Gender is real and splits this
 * kind — `milligrammo`, `grammo` and `chilogrammo` are masculine, `tonnellata`,
 * `oncia` and `libbra` feminine — but it belongs to the *noun* and not to the
 * slot, so nothing ever selects on it and it must not be a key (rule 6). What
 * gender would change is the numeral in front ("una tonnellata", "un
 * chilogrammo"), and `NumeralSpeller` is handed a magnitude with no unit
 * attached, so `it-cardinals.ts` already names that as out of reach rather than
 * half-solving it here.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in an Italian engine and
 * the micro path (`parseMass`) cannot drift from it.
 *
 * The Italian spellings are appended, singular and plural both, because every
 * string this file *prints* has to be a string it reads. That obligation is
 * sharper in Italian than in Spanish: Spanish adds `-s` and the language's own
 * stripper can take it off again, while Italian **substitutes** the final vowel,
 * so `it.ts` has to fold plurals backwards through a substitution table at
 * `weight: -2` — a guess, and one this file should not be leaning on for words
 * it chose to print. Three of the six rows are the ones that table names
 * explicitly:
 *
 *   `chilogrammo` → `chilogrammi`   the ordinary masculine, the `i → o` row
 *   `tonnellata`  → `tonnellate`    the ordinary feminine, the `e → a` row
 *   `oncia`       → `once`          the palatal feminine: `-cia` drops its `i`
 *                                   before `-e`, because the `i` was only there
 *                                   to keep the `c` soft and `e` does that job
 *                                   itself. This is the `ce → cia` row, and it
 *                                   is the reason `it.ts`'s `minStem` is 2.
 *
 * `chilo`/`chili` is the everyday clipping ("due chili di farina"), listed
 * because people type it, exactly as `units.ts` lists English "kilo" and `uk`
 * lists "кіло". `kilogrammo` is the `k` spelling that survives in technical
 * prose beside the official `ch`; both are read and the `ch` one is printed.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what Italian itself prints on a scale ("500 g", "1,2 t"), and the spelled
 * nominative singular on the two imperial ones. `oz` and `lb` do appear in
 * Italian text, but as the English abbreviations they are — `units.ts` already
 * registers both as aliases, so reading them costs this file nothing, while
 * *printing* "8oz" at a reader who typed "once" would be answering in another
 * language. `es` and `uk` reach the same two symbols by the same reasoning: R8
 * wants an explicit symbol on every unit, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `mass` by **id string** and never
 * imports the kind, which is what lets `@smartput/mass/locale/it` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "it",
  kind: "mass",
  units: {
    // Two `l` and two `m`, unlike Spanish's `miligramo`: Italian keeps the
    // double consonant of the Greek prefix and of `grammo` alike.
    mg: {
      aliases: [...alias("mg"), "milligrammo", "milligrammi"],
      symbol: "mg",
      forms: { one: "milligrammo", other: "milligrammi" },
    },
    g: {
      aliases: [...alias("g"), "grammo", "grammi"],
      symbol: "g",
      forms: { one: "grammo", other: "grammi" },
    },
    kg: {
      aliases: [
        ...alias("kg"),
        "chilogrammo",
        "chilogrammi",
        "chilo",
        "chili",
        "kilogrammo",
        "kilogrammi",
      ],
      symbol: "kg",
      forms: { one: "chilogrammo", other: "chilogrammi" },
    },
    t: {
      aliases: [...alias("t"), "tonnellata", "tonnellate"],
      symbol: "t",
      forms: { one: "tonnellata", other: "tonnellate" },
    },
    oz: {
      aliases: [...alias("oz"), "oncia", "once"],
      symbol: "oncia",
      forms: { one: "oncia", other: "once" },
    },
    lb: {
      aliases: [...alias("lb"), "libbra", "libbre"],
      symbol: "libbra",
      forms: { one: "libbra", other: "libbre" },
    },
  },
});
