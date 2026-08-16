import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { MEASURE_UNITS, type MeasureUnit } from "../units";

const alias = (unit: MeasureUnit) => aliasesFor(MEASURE_UNITS, unit);

/**
 * German words for the typographic units — the same six `en` and `uk` name,
 * with the same answer to "does this unit have words at all?". All six do:
 * German writes every one of them out.
 *
 * **Four `forms` keys, and the German rule that fills them.** `german.selectForm`
 * returns `` `${case}-${category}` ``: the case from the slot (dative for a
 * conversion target, which is what "in Pixeln" governs) and the category from
 * `Intl.PluralRules("de")`, which declares only `one` and `other`. So the key
 * set is exactly `nom-one`, `nom-other`, `dat-one`, `dat-other` (rule 6). What
 * fills them follows Duden's rule for Maßangaben, and this kind is a clean case
 * of it because **not one of these six units is feminine**:
 *
 *   A masculine or neuter measure noun stays uninflected after a numeral —
 *   "zwei Zoll", "zwölf Punkt", "1920 Pixel" — so `nom-one` and `nom-other` are
 *   the same string on every unit here. That is German rather than an unfinished
 *   table: compare `@smartput/length/locale/de`, where `die Meile` is feminine
 *   and does move.
 *
 *   The case axis is the live one, and only where the plural stem declines.
 *   German writes "eine Angabe in Millimetern", "in Zentimetern" and "in
 *   Pixeln", so those three take the dative plural `-n`. `Zoll`, `Punkt` and
 *   `Pica` do not — "in Zoll", "in Punkt", "in Pica" is what German writes for a
 *   measure — so on those three all four cells are one string.
 *
 * **`Cicero` is deliberately not listed.** It is the German typographic unit a
 * translator reaches for first, and it is a *different unit*: a Cicero is twelve
 * Didot points, about 4.512 mm, where a pica is 4.233 mm. Listing it would make
 * this vocabulary quietly answer the wrong number for the one word a German
 * typesetter is likeliest to type. The kind has no Didot unit for the right
 * reading to resolve to, so the word stays out entirely rather than being
 * approximated — a refusal (`NoCandidateError`) says "this engine does not know
 * Cicero", and a 6 % error says nothing at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "72 pt" keeps working in a German engine and
 * the micro path (`parseMeasure`) cannot drift from it. That map already carries
 * the US spellings `millimeter` and `centimeter`; German shares the first and
 * spells the second with a `z`, which is what this file adds along with the
 * dative plurals and the three nouns English does not share.
 *
 * Capitals: the `forms` print `Punkt` and the aliases list `punkt`, because
 * `buildRegistry` folds every alias key with `toLocaleLowerCase` and
 * `compoundSplitter` folds both sides of its own comparison. One lowercase alias
 * reads `Punkt`, `punkt` and `PUNKT` alike.
 *
 * `symbol` follows `uk`'s split for `uk`'s reason. The three typographic units
 * keep their Latin abbreviations — `pt`, `pc` and `px` are what a German
 * designer writes in a stylesheet, and inventing a German short form would be a
 * word this file made up rather than one anybody types. The two metric units get
 * the SI abbreviations German itself writes. The inch gets its noun: German
 * abbreviates it with a double prime (`5″`), which `lex` cannot read, so the
 * spelled `Zoll` is the only short form that round-trips — R8 wants an explicit
 * symbol on every unit, never an unreadable one.
 *
 * Like `en`, this file names `measure` by **id string** and never imports the
 * kind. `composeLocale` is where the two halves meet — and, as there, a caller
 * has to ask for this vocabulary by name: `measure` is outside `BUILTIN_KINDS`
 * because its `mm`/`cm` aliases collide with `length`, so it is absent from
 * `@smartput/kinds/locale/de` for exactly the reason the kind is absent from the
 * roster.
 */
export default defineVocabulary({
  locale: "de",
  kind: "measure",
  units: {
    // `der Zoll`. Its free-noun plural is `Zölle` (dative `Zöllen`), and neither
    // is ever printed: after a numeral German writes "zwei Zoll", and the
    // conversion target is "in Zoll". Both are listed as aliases anyway, because
    // reading and printing are separate decisions and only printing has to
    // round-trip.
    inch: {
      aliases: [...alias("inch"), "zoll", "zolls", "zölle", "zöllen"],
      symbol: "Zoll",
      forms: {
        "nom-one": "Zoll",
        "nom-other": "Zoll",
        "dat-one": "Zoll",
        "dat-other": "Zoll",
      },
    },
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
    // German writes `Zentimeter` with a `z`; `centimeter` reaches this unit only
    // because `units.ts` declares the US spelling. The dative plural is listed
    // rather than left to the language's `-n` stripper, because a word this
    // table prints should not come back through a penalised guess (rule 5).
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
    // `der Punkt` declines freely (`Punkte`, dative `Punkten`) and is invariant
    // as a measure: German sets type "in 12 Punkt", never "in 12 Punkten" —
    // which would be twelve items on a list. The declined forms are listed as
    // aliases so the other reading is still understood if someone types it.
    pt: {
      aliases: [...alias("pt"), "punkt", "punkte", "punkten"],
      symbol: "pt",
      forms: {
        "nom-one": "Punkt",
        "nom-other": "Punkt",
        "dat-one": "Punkt",
        "dat-other": "Punkt",
      },
    },
    // A loan German keeps unchanged, and the unit whose German near-synonym is
    // a trap — see the note on `Cicero` above. `units.ts` already declares
    // `pica` and `picas`, so this unit adds no word of its own; what it adds is
    // the decision that the bare `Pica` is what gets printed.
    pc: {
      aliases: [...alias("pc")],
      symbol: "pc",
      forms: {
        "nom-one": "Pica",
        "nom-other": "Pica",
        "dat-one": "Pica",
        "dat-other": "Pica",
      },
    },
    // `das Pixel` is invariant after a numeral ("1920 Pixel", never "Pixels" —
    // the English loan plural is not what German writes) and takes the dative
    // plural `-n`, which is the standard phrase for a screen measurement: "eine
    // Angabe in Pixeln".
    px: {
      aliases: [...alias("px"), "pixeln"],
      symbol: "px",
      forms: {
        "nom-one": "Pixel",
        "nom-other": "Pixel",
        "dat-one": "Pixel",
        "dat-other": "Pixeln",
      },
    },
  },
});
