import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Russian words for the area units — the same five units `en` next door names,
 * and the same per-unit decision about whether a unit has words at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so `2 ha` keeps working in a Russian engine and
 * the micro path (`parseArea`) cannot drift from it. The Cyrillic spellings are
 * appended, in every inflected form a reader is likely to type — a vocabulary is
 * what the language's suffix stripper falls back *from*, not a stem list, and
 * the stripper is penalised precisely so that an exact entry here outranks
 * anything it guesses. Every string this file *prints* is therefore also a
 * string it reads: the prepositional singulars ("гектаре", "акре") are listed
 * even though the `е` suffix rule would recover them, because a word the printer
 * emits should never come back through the penalised path.
 *
 * **`м²`, `см²`, `км²` carry no `forms`, exactly as `en` carries none.** The
 * reason is not laziness in either language: nobody writes "два квадратных
 * метра" into a calculator, and the printer's spelled path only ever emits a
 * word the parser can read back — a form here would be a two-word phrase, which
 * `lex` cannot hand to any single analyzer. So the squared units render through
 * their symbol, tight against the number (`3м²`), while `гектар` and `акр` — the
 * two area units Russian genuinely declines as one word — carry all eight keys.
 *
 * Eight, because `russian.selectForm` keys on `` `${case}-${category}` ``: the
 * case from the slot (prepositional after `в`, which is what the preposition
 * governs), the category from CLDR's four. The key names are `uk`'s, `loc` for
 * the case Russian calls the prepositional, and `@smartput/core/locale/ru`
 * records why. Two rows are worth naming:
 *
 *   `nom-few`   the 2/3/4 row, and a genitive **singular** in Russian —
 *               "2 гектара". Ukrainian puts a nominative plural here ("2
 *               гектари"), so the two languages group these cells differently
 *               and a stem-swap port of `uk.ts` gets both this row and the next
 *               one wrong at once.
 *   `nom-other` the *fractional* category, genitive singular again —
 *               "1,5 гектара", never "1,5 гектаров". No shape-based test in this
 *               repo catches a plural here: it is a real word in the wrong cell.
 *
 * `loc-other` is the count-free conversion target ("в гектарах"), the row the
 * old one-dimensional `display` model had no way to express at all.
 *
 * Both declined units are masculine hard stems, so they share one paradigm:
 * genitive singular -а, genitive plural -ов, prepositional singular -е. The
 * colloquial zero-ending "5 гектар" is heard and needs no entry of its own,
 * because it is spelled like the nominative singular that is already an alias;
 * the written norm "гектаров" is what prints.
 *
 * Like `en`, this file names `area` by id string and never imports the kind,
 * which is what lets `@smartput/area/locale/ru` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "ru",
  kind: "area",
  units: {
    // Russian writes the superscript units with Cyrillic stems and the same
    // `²`, and the digit-2 spellings are what a keyboard without a superscript
    // produces. Both scripts are listed because Russians type both.
    m2: { aliases: [...alias("m2"), "м2", "м²"], symbol: "м²" },
    cm2: { aliases: [...alias("cm2"), "см2", "см²"], symbol: "см²" },
    km2: { aliases: [...alias("km2"), "км2", "км²"], symbol: "км²" },
    hectare: {
      aliases: [
        ...alias("hectare"),
        "га",
        "гектар",
        "гектара",
        "гектару",
        "гектаре",
        "гектаром",
        "гектары",
        "гектаров",
        "гектарам",
        "гектарах",
        "гектарами",
      ],
      symbol: "га",
      forms: {
        "nom-one": "гектар",
        "nom-few": "гектара",
        "nom-many": "гектаров",
        "nom-other": "гектара",
        "loc-one": "гектаре",
        "loc-few": "гектарах",
        "loc-many": "гектарах",
        "loc-other": "гектарах",
      },
    },
    // "акр" has no accepted Russian abbreviation — it is written out — so the
    // symbol is the nominative singular, the same choice `en` makes for `acre`.
    // R8 wants an explicit symbol on every unit, not an invented one.
    acre: {
      aliases: [
        ...alias("acre"),
        "акр",
        "акра",
        "акру",
        "акре",
        "акром",
        "акры",
        "акров",
        "акрам",
        "акрах",
        "акрами",
      ],
      symbol: "акр",
      forms: {
        "nom-one": "акр",
        "nom-few": "акра",
        "nom-many": "акров",
        "nom-other": "акра",
        "loc-one": "акре",
        "loc-few": "акрах",
        "loc-many": "акрах",
        "loc-other": "акрах",
      },
    },
  },
});
