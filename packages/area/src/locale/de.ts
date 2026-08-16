import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * German words for the area units — the same five `en`, `uk` and `es` name, and
 * **a different answer for three of them**.
 *
 * **The squared units carry `forms` here, where `en` and `uk` carry none.**
 * Their reason was never that the unit is unspeakable; it was that the spoken
 * name is a *phrase* — "square metres", "квадратних метрів" — and `lex` ends a
 * word token at a space, so no analyzer is ever handed the whole thing. A
 * printed phrase is text the parser cannot read back, and
 * `assertLocaleContract` fails it by name. German writes the same concept as a
 * single token, `Quadratmeter`, so the reason simply does not apply: the word is
 * one token, it is listed as an alias below, and it round-trips. This is the
 * compounding this language exists to exercise, showing up as a per-unit
 * decision rather than as a helper — a German engine answers "1,5 Quadratmeter"
 * where an English one answers "1.5m²".
 *
 * That listing is also load-bearing in the other direction. `compoundSplitter`
 * reads a Germanic compound by its head, so it finds `meter` inside
 * `Quadratmeter` at `-3`; the alias below is weight 0, and the square metre
 * wins. Without the exact entry, an engine that also speaks
 * `@smartput/length/locale/de` would quietly answer a *length* for every area a
 * German typed.
 *
 * **Four `forms` keys, and the German rule that fills them.** `german.selectForm`
 * returns `` `${case}-${category}` ``: the case from the slot (dative for a
 * conversion target, which is what "in Quadratmetern" governs) and the category
 * from `Intl.PluralRules("de")`, which declares only `one` and `other`. So the
 * key set is exactly `nom-one`, `nom-other`, `dat-one`, `dat-other` (rule 6).
 * Two grammar facts fill them, and in this kind they conspire to make **every
 * one of the five units invariant on the number axis**:
 *
 *   Duden's rule for Maßangaben — a masculine or neuter measure noun stays
 *   uninflected after a numeral — covers all five: "zwei Quadratmeter", "100
 *   Hektar", "zwei Acre". There is no feminine unit in this kind, so unlike
 *   `@smartput/length/locale/de` (`die Meile`) and `@smartput/volume/locale/de`
 *   (`die Gallone`) nothing here distinguishes `nom-one` from `nom-other`. A
 *   table that wrote a plural in would be inventing German, not completing it.
 *
 *   The case axis is what still moves, and only on the `-er` stems: German
 *   writes "eine Fläche in Quadratmetern", so the three compounds take the
 *   dative plural `-n`. `Hektar` and `Acre` do not — "eine Angabe in Hektar" is
 *   what German writes — so for those two the dative row equals the nominative
 *   one and all four cells are one string.
 *
 * `Hektar`'s free-noun plural (`Hektare`, dative `Hektaren`) is real and is
 * listed among the aliases, but it is never printed: after a numeral and in the
 * measure reading German writes the bare "100 Hektar". Reading and printing are
 * separate decisions, and only printing has to round-trip.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a German engine and
 * the micro path (`parseArea`) cannot drift from it. That map already carries
 * the superscript spellings `m²`, `cm²` and `km²`, which German writes exactly
 * as English does, and their digit-2 twins for a keyboard that cannot produce
 * one.
 *
 * Capitals: the `forms` print `Quadratmeter` and the aliases list
 * `quadratmeter`, because `buildRegistry` folds every alias key with
 * `toLocaleLowerCase` and `compoundSplitter` folds both sides of its own
 * comparison. One lowercase alias reads all three capitalisations.
 *
 * `symbol` is what German itself writes: the SI superscripts on the three
 * squared units, `ha` on the hectare, and the spelled `Acre` on the one unit
 * German has no abbreviation for. R8 wants an explicit symbol on every unit,
 * never an invented one.
 *
 * Like `en`, this file names `area` by **id string** and never imports the kind,
 * which is what lets `@smartput/area/locale/de` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "de",
  kind: "area",
  units: {
    // `qm` is the abbreviation German actually writes and the one thing this
    // file adds that is neither a compound nor a case form: every German estate
    // agent's listing says "120 qm", and `units.ts` carries only the English
    // `sqm` beside the superscript. `q` is for *Quadrat*, so `qcm` and `qkm`
    // below are the same abbreviation on the other two prefixes. None of the
    // three is a rival of anything — no unit of any kind in this repo spells
    // itself with a leading `q`.
    m2: {
      aliases: [...alias("m2"), "qm", "quadratmeter", "quadratmetern"],
      symbol: "m²",
      forms: {
        "nom-one": "Quadratmeter",
        "nom-other": "Quadratmeter",
        "dat-one": "Quadratmeter",
        "dat-other": "Quadratmetern",
      },
    },
    // `quadratzentimeter` ends in `zentimeter` *and* in `meter`, so the splitter
    // offers two readings of it and neither is this unit. The exact alias is
    // what settles it, which is why the compound is written out rather than left
    // to morphology.
    cm2: {
      aliases: [...alias("cm2"), "qcm", "quadratzentimeter", "quadratzentimetern"],
      symbol: "cm²",
      forms: {
        "nom-one": "Quadratzentimeter",
        "nom-other": "Quadratzentimeter",
        "dat-one": "Quadratzentimeter",
        "dat-other": "Quadratzentimetern",
      },
    },
    km2: {
      aliases: [...alias("km2"), "qkm", "quadratkilometer", "quadratkilometern"],
      symbol: "km²",
      forms: {
        "nom-one": "Quadratkilometer",
        "nom-other": "Quadratkilometer",
        "dat-one": "Quadratkilometer",
        "dat-other": "Quadratkilometern",
      },
    },
    // Invariant in all four cells. `Hektare`/`Hektaren` exist as the free noun's
    // plural and are listed above as aliases, but German writes "auf 100 Hektar"
    // and "eine Angabe in Hektar", so neither is ever printed.
    hectare: {
      aliases: [...alias("hectare"), "hektar", "hektare", "hektaren"],
      symbol: "ha",
      forms: {
        "nom-one": "Hektar",
        "nom-other": "Hektar",
        "dat-one": "Hektar",
        "dat-other": "Hektar",
      },
    },
    // A loan German keeps unchanged: `das Acre`, plural `Acres` for the free
    // noun and bare `Acre` after a numeral. `units.ts` already declares both
    // spellings, so this unit adds no word of its own — only the decision about
    // which of them gets printed.
    acre: {
      aliases: [...alias("acre")],
      symbol: "Acre",
      forms: {
        "nom-one": "Acre",
        "nom-other": "Acre",
        "dat-one": "Acre",
        "dat-other": "Acre",
      },
    },
  },
});
