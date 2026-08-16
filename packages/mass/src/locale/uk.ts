import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MASS_UNITS, type MassUnit } from "../units";

const alias = (unit: MassUnit) => aliasesFor(MASS_UNITS, unit);

/**
 * Ukrainian words for the mass units — the same six units `en` next door names,
 * and the same per-unit decision: all six are nouns a Ukrainian speaker writes
 * out, so all six carry `forms`.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 kg" keeps working in a Ukrainian engine and
 * the micro path (`parseMass`) cannot drift from it. The Cyrillic spellings are
 * appended, in every inflected form a reader is likely to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper is penalised (weight -2) precisely so an exact entry here
 * outranks anything it guesses. Every string this file *prints* is therefore
 * also a string it reads: the locative singulars ("кілограмі", "грамі") are
 * listed even though the `і` suffix rule would recover them, because a word the
 * printer emits should never come back through the penalised path.
 *
 * Eight `forms` keys per unit, not two, because `ukrainian.selectForm` keys on
 * `` `${case}-${category}` ``: the case from the slot, the category from CLDR's
 * four. Three rows deserve naming, because two of them are the rows a
 * one-dimensional `singular`/`plural` model could not express and the third is
 * the one that is easiest to get plausibly wrong:
 *
 *   `nom-few`   the 2/3/4 row      "2 кілограми"
 *   `nom-many`  the 5+/0/teens row "5 кілограмів"  — genitive plural
 *   `nom-other` the *fractional*   "1,5 кілограма" — genitive **singular**, not
 *                                  a plural at all. Writing a plural here
 *                                  prints "1,5 кілограмів", which no test in
 *                                  this repo would catch on shape alone.
 *   `loc-other` the count-free conversion target, "в грамах" — locative, which
 *                                  is what `в` governs ("в 5 кілограмах",
 *                                  never "в 5 кілограмів").
 *
 * Gender drives the endings, and this kind happens to carry both: `мг`/`г`/`кг`
 * and `фунт` are masculine hard stems (genitive singular in -а, genitive plural
 * in -ів), while `тонна` and `унція` are feminine (genitive singular in -и/-і,
 * genitive plural with a bare stem — "5 тонн" — or -ій — "5 унцій"). That is why
 * the six tables below are not one table with the stem swapped.
 *
 * `symbol` is Ukrainian where Ukrainian actually abbreviates (`мг`, `г`, `кг`,
 * `т`) and the spelled nominative singular where it does not: `унція` and
 * `фунт` have no accepted Ukrainian abbreviation, which is the same choice `en`
 * makes for units it writes out. R8 wants an explicit symbol on every unit, not
 * an invented one.
 *
 * Like `en`, this file names `mass` by id string and never imports the kind,
 * which is what lets `@smartput/mass/locale/uk` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "mass",
  units: {
    mg: {
      aliases: [
        ...alias("mg"),
        "мг",
        "міліграм",
        "міліграма",
        "міліграму",
        "міліграмі",
        "міліграми",
        "міліграмів",
        "міліграмам",
        "міліграмах",
        "міліграмом",
        "міліграмами",
      ],
      symbol: "мг",
      forms: {
        "nom-one": "міліграм",
        "nom-few": "міліграми",
        "nom-many": "міліграмів",
        "nom-other": "міліграма",
        "loc-one": "міліграмі",
        "loc-few": "міліграмах",
        "loc-many": "міліграмах",
        "loc-other": "міліграмах",
      },
    },
    g: {
      aliases: [
        ...alias("g"),
        "г",
        "грам",
        "грама",
        "граму",
        "грамі",
        "грами",
        "грамів",
        "грамам",
        "грамах",
        "грамом",
        "грамами",
      ],
      symbol: "г",
      forms: {
        "nom-one": "грам",
        "nom-few": "грами",
        "nom-many": "грамів",
        "nom-other": "грама",
        "loc-one": "грамі",
        "loc-few": "грамах",
        "loc-many": "грамах",
        "loc-other": "грамах",
      },
    },
    kg: {
      // "кіло" is the colloquial clipping, indeclinable in Ukrainian, and it is
      // listed for the same reason `units.ts` lists "kilo": people type it.
      aliases: [
        ...alias("kg"),
        "кг",
        "кіло",
        "кілограм",
        "кілограма",
        "кілограму",
        "кілограмі",
        "кілограми",
        "кілограмів",
        "кілограмам",
        "кілограмах",
        "кілограмом",
        "кілограмами",
      ],
      symbol: "кг",
      forms: {
        "nom-one": "кілограм",
        "nom-few": "кілограми",
        "nom-many": "кілограмів",
        "nom-other": "кілограма",
        "loc-one": "кілограмі",
        "loc-few": "кілограмах",
        "loc-many": "кілограмах",
        "loc-other": "кілограмах",
      },
    },
    // Feminine, so every ending differs from the three grams above. The genitive
    // plural is the bare stem — "5 тонн", no suffix — and the fractional row is
    // "1,5 тонни", the genitive singular, which is spelled identically to the
    // 2/3/4 row and identical for a different reason.
    t: {
      aliases: [
        ...alias("t"),
        "т",
        "тонна",
        "тонни",
        "тонні",
        "тонну",
        "тонною",
        "тонн",
        "тоннам",
        "тоннах",
        "тоннами",
      ],
      symbol: "т",
      forms: {
        "nom-one": "тонна",
        "nom-few": "тонни",
        "nom-many": "тонн",
        "nom-other": "тонни",
        "loc-one": "тонні",
        "loc-few": "тоннах",
        "loc-many": "тоннах",
        "loc-other": "тоннах",
      },
    },
    // Feminine in -ія, so the genitive singular, the 2/3/4 row and the locative
    // singular all land on "унції" — three grammatically distinct cells that
    // happen to share a spelling. The genitive plural is "унцій".
    oz: {
      aliases: [
        ...alias("oz"),
        "унція",
        "унції",
        "унцію",
        "унцією",
        "унцій",
        "унціям",
        "унціях",
        "унціями",
      ],
      symbol: "унція",
      forms: {
        "nom-one": "унція",
        "nom-few": "унції",
        "nom-many": "унцій",
        "nom-other": "унції",
        "loc-one": "унції",
        "loc-few": "унціях",
        "loc-many": "унціях",
        "loc-other": "унціях",
      },
    },
    lb: {
      aliases: [
        ...alias("lb"),
        "фунт",
        "фунта",
        "фунту",
        "фунті",
        "фунти",
        "фунтів",
        "фунтам",
        "фунтах",
        "фунтом",
        "фунтами",
      ],
      symbol: "фунт",
      forms: {
        "nom-one": "фунт",
        "nom-few": "фунти",
        "nom-many": "фунтів",
        "nom-other": "фунта",
        "loc-one": "фунті",
        "loc-few": "фунтах",
        "loc-many": "фунтах",
        "loc-other": "фунтах",
      },
    },
  },
});
