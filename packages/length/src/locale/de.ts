import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { LENGTH_UNITS, type LengthUnit } from "../units";

/**
 * The same reservation `en`, `uk` and `es` next door make, and here it is
 * over-determined: both of their reasons apply at once.
 *
 * German's own conversion keywords are `in`, `nach` and `zu`
 * (`@smartput/core/locale/de`), and the first of them is spelled exactly like
 * the English one — `buildKeywords` folds the two into a single entry rather
 * than refusing them. So `lex` emits `in` as a keyword token in a German engine
 * exactly as it does in an English one, and a vocabulary entry for it is
 * unreachable on the engine path. On top of that, `registry.aliasIndex` is one
 * flat map that `MatchCtx.isUnitAlias` reads without consulting a locale, so a
 * German entry would put `in` back in front of `@smartput/datetime`'s
 * accept-gate for any engine speaking both languages and make "in 3 days" an
 * all-units phrase again.
 *
 * A German reader types `Zoll`, so the omission costs this vocabulary nothing.
 */
const RESERVED = new Set(["in"]);

const alias = (unit: LengthUnit) =>
  aliasesFor(LENGTH_UNITS, unit).filter((a) => !RESERVED.has(a));

/**
 * German words for the length units — the same eight `en`, `uk` and `es` name,
 * and the same answer to "does this unit have words at all?": all eight do.
 * German writes a length out as readily as English does.
 *
 * **Four `forms` keys, and the German rule that fills them.** `german.selectForm`
 * returns `` `${case}-${category}` `` over two values each: the case from the
 * slot (dative for a conversion target, which is what "in Metern" governs) and
 * the category from `Intl.PluralRules("de")`, which declares only `one` and
 * `other`. So the closed key set is `nom-one`, `nom-other`, `dat-one`,
 * `dat-other` — no more and no fewer (rule 6). Two grammar facts decide what
 * goes in them, and between them they explain every row below:
 *
 *   **The number axis is live only on the feminine nouns.** Duden's rule for
 *   Maßangaben: a masculine or neuter measure noun stays uninflected after a
 *   numeral — "zwei Meter", "zwei Fuß", "zwei Yard", "zwei Zoll" — while a
 *   feminine one takes its ordinary plural. `die Meile` is the only feminine
 *   unit here, so `Meile`/`Meilen` is the only row in this file where `nom-one`
 *   and `nom-other` differ. That is the language, not a table stopping halfway:
 *   the mirror image of English, where number is always marked.
 *
 *   **The case axis is live where the plural stem declines.** German writes "in
 *   100 Metern Tiefe" and "eine Angabe in Zentimetern", so the four `-meter`
 *   units take the dative plural `-n`. The imperial four do not: "in Zoll", "in
 *   Fuß", "in Yard" are what German writes, and `Meilen` already ends in `-n`,
 *   so for those four the dative row equals the nominative one.
 *
 * **Compounds are the reason this language has a splitter at all.**
 * `Zentimeter`, `Kilometer` and `Millimeter` are single tokens, and so is
 * `Bandmeter`, which no vocabulary would ever list. `compoundSplitter` reads the
 * last element of a Germanic compound — the head, since a Germanic compound is
 * right-headed — at a `-3` penalty, and every word this file lists exactly is an
 * alias at weight 0. That ordering is what makes `10 Zentimeter` a centimetre
 * rather than the `meter` hiding inside it, and it only holds because the
 * compound is written out here rather than left to the split.
 *
 * **Capitalisation.** Every German noun is capitalised, so the `forms` print
 * `Meter` and the aliases list `meter`. That is not an inconsistency: the alias
 * index folds its keys with `toLocaleLowerCase` and `compoundSplitter` folds
 * both sides of its comparison, so one lowercase alias reads `Meter`,
 * `meter` and `METER` alike. Writing the aliases capitalised would buy nothing
 * and would read as though case mattered somewhere.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 km" keeps working in a German engine and
 * the micro path (`parseLength`) cannot drift from it. That map already carries
 * the US spellings `meter`, `millimeter` and `kilometer`, which are the German
 * words too — so what this file adds is the dative plurals, `zentimeter` (German
 * does not spell it with a `c`), and the four imperial nouns.
 *
 * `symbol` is the international abbreviation on the four metric units, which is
 * what German itself writes ("5 km", never "5 Kilom."), and the spelled
 * nominative singular on the four imperial ones. German abbreviates none of
 * those: where a short form appears at all it is the English one, which
 * `units.ts` already registers as an alias, so claiming it as the *German*
 * symbol would print `36in` at a reader who wrote `Zoll` — and `in` is not
 * lexable here anyway, which is the very gap `assertLocaleContract`'s
 * `skipPrintable` exists for in English. R8 wants an explicit symbol on every
 * unit, never an invented one.
 *
 * Like `en`, `uk` and `es`, this file names `length` by **id string** and never
 * imports the kind, which is what lets `@smartput/length/locale/de` be imported
 * without linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "de",
  kind: "length",
  units: {
    mm: {
      aliases: [...alias("mm"), "millimetern"],
      symbol: "mm",
      forms: {
        "nom-one": "Millimeter",
        "nom-other": "Millimeter",
        "dat-one": "Millimeter",
        "dat-other": "Millimetern",
      },
    },
    // German writes `Zentimeter` with a `z`; `centimeter` reaches this unit
    // only because `units.ts` declares the US spelling, and a German reader
    // never types it. The dative plural is listed rather than left to the
    // language's `-n` stripper, because a word this table *prints* should not
    // come back through a penalised guess (rule 5).
    cm: {
      aliases: [...alias("cm"), "zentimeter", "zentimetern"],
      symbol: "cm",
      forms: {
        "nom-one": "Zentimeter",
        "nom-other": "Zentimeter",
        "dat-one": "Zentimeter",
        "dat-other": "Zentimetern",
      },
    },
    // `der Meter` (Austria and Switzerland say `das Meter`; the paradigm is the
    // same either way). Three of its four rows are the same string and only the
    // dative plural differs — the row `third-language.test.ts` was built around.
    m: {
      aliases: [...alias("m"), "metern"],
      symbol: "m",
      forms: {
        "nom-one": "Meter",
        "nom-other": "Meter",
        "dat-one": "Meter",
        "dat-other": "Metern",
      },
    },
    km: {
      aliases: [...alias("km"), "kilometern"],
      symbol: "km",
      forms: {
        "nom-one": "Kilometer",
        "nom-other": "Kilometer",
        "dat-one": "Kilometer",
        "dat-other": "Kilometern",
      },
    },
    // `der Zoll`. Its free-noun plural is `Zölle` (dative `Zöllen`), and neither
    // is ever printed: after a numeral German writes "zwei Zoll", and a
    // conversion target is "in Zoll". Both are listed as aliases anyway, because
    // reading and printing are separate decisions and a reader who types the
    // declined plural should be understood.
    in: {
      aliases: [...alias("in"), "zoll", "zolls", "zölle", "zöllen"],
      symbol: "Zoll",
      forms: {
        "nom-one": "Zoll",
        "nom-other": "Zoll",
        "dat-one": "Zoll",
        "dat-other": "Zoll",
      },
    },
    // `fuss` beside `fuß`: NFKC leaves `ß` alone rather than expanding it to
    // `ss`, so the Swiss spelling is a different string to the alias index and
    // no stripper can bridge it — the same reason `@smartput/length/locale/es`
    // lists `kilometro` beside `kilómetro`.
    ft: {
      aliases: [...alias("ft"), "fuß", "fuss", "füße", "füßen"],
      symbol: "Fuß",
      forms: {
        "nom-one": "Fuß",
        "nom-other": "Fuß",
        "dat-one": "Fuß",
        "dat-other": "Fuß",
      },
    },
    // `das Yard` is a loan that keeps its English spelling, so `units.ts` has
    // already declared every form this unit needs — including the `-s` plural,
    // which German writes for loanwords but not after a numeral.
    yd: {
      aliases: [...alias("yd")],
      symbol: "Yard",
      forms: {
        "nom-one": "Yard",
        "nom-other": "Yard",
        "dat-one": "Yard",
        "dat-other": "Yard",
      },
    },
    // The feminine one, and the only unit in this file whose number axis moves.
    // `die Meile` takes the weak plural `Meilen`, which already ends in `-n`, so
    // its dative plural adds nothing and the case axis is the inert one here —
    // the exact opposite arrangement from `Meter`.
    mi: {
      aliases: [...alias("mi"), "meile", "meilen"],
      symbol: "Meile",
      forms: {
        "nom-one": "Meile",
        "nom-other": "Meilen",
        "dat-one": "Meile",
        "dat-other": "Meilen",
      },
    },
  },
});
