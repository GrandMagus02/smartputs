import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Ukrainian words for the area units — the same five units `en` next door
 * names, and the same per-unit decision about whether a unit has words at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so `2 ha` keeps working in a Ukrainian engine
 * and the micro path (`parseArea`) cannot drift from it. The Cyrillic
 * spellings are appended, in every inflected form a reader is likely to type —
 * a vocabulary is what the language's suffix stripper falls back *from*, not a
 * stem list, and the stripper is penalised precisely so that an exact entry
 * here outranks anything it guesses. Every string this file *prints* is
 * therefore also a string it reads: the locative singulars ("гектарі", "акрі")
 * are listed even though the `і` suffix rule would recover them, because a word
 * the printer emits should never come back through the penalised path.
 *
 * **`м²`, `см²`, `км²` carry no `forms`, exactly as `en` carries none.** The
 * reason is not laziness in either language: nobody writes "два квадратних
 * метри" into a calculator, and the printer's spelled path only ever emits a
 * word the parser can read back — a form here would hand completion text that
 * fails to evaluate. So the squared units render through their symbol, tight
 * against the number (`3м²`), while `гектар` and `акр` — the two area units
 * Ukrainian genuinely declines — carry all eight keys.
 *
 * Eight, because `ukrainian.selectForm` keys on `` `${case}-${category}` ``:
 * case from the slot (locative after `в`, which is what the preposition
 * governs), category from CLDR's four. The row worth naming is `nom-other`: it
 * is the *fractional* category, genitive **singular** — "1,5 гектара", never
 * "1,5 гектарів". `loc-other` is the count-free conversion target ("в
 * гектарах"), the row the old one-dimensional `display` model had no way to
 * express.
 *
 * Like `en`, this file names `area` by id string and never imports the kind,
 * which is what lets `@smartput/area/locale/uk` be imported without linking
 * the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "uk",
  kind: "area",
  units: {
    // Ukrainian writes the superscript units with Cyrillic stems and the same
    // `²`, and the digit-2 spellings are what a keyboard without a superscript
    // produces. Both scripts are listed because Ukrainians type both.
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
        "гектарі",
        "гектари",
        "гектарів",
        "гектарам",
        "гектарах",
        "гектаром",
        "гектарами",
      ],
      symbol: "га",
      forms: {
        "nom-one": "гектар",
        "nom-few": "гектари",
        "nom-many": "гектарів",
        "nom-other": "гектара",
        "loc-one": "гектарі",
        "loc-few": "гектарах",
        "loc-many": "гектарах",
        "loc-other": "гектарах",
      },
    },
    // "акр" has no accepted Ukrainian abbreviation — it is written out — so the
    // symbol is the nominative singular, the same choice `en` makes for
    // `acre`. R8 wants an explicit symbol on every unit, not an invented one.
    acre: {
      aliases: [
        ...alias("acre"),
        "акр",
        "акра",
        "акру",
        "акрі",
        "акри",
        "акрів",
        "акрам",
        "акрах",
        "акром",
        "акрами",
      ],
      symbol: "акр",
      forms: {
        "nom-one": "акр",
        "nom-few": "акри",
        "nom-many": "акрів",
        "nom-other": "акра",
        "loc-one": "акрі",
        "loc-few": "акрах",
        "loc-many": "акрах",
        "loc-other": "акрах",
      },
    },
  },
});
