import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * German words for the volume units — the same five `en`, `uk` and `es` name,
 * and **one different answer** to "does this unit have words at all?".
 *
 * **`m3` gets a `forms` table here, where `en` and `uk` both refuse one.** Their
 * reason was never that the unit is unspeakable; it was that the spoken name is
 * a phrase — "cubic metres", "кубічних метрів" — and `lex` ends a word token at
 * a space, so no analyzer is ever handed the whole thing. A printed phrase is
 * text the parser cannot read back, and `assertLocaleContract` fails it by name.
 * German writes the same concept as a single token, `Kubikmeter`, so the reason
 * simply does not apply: the word is one token, it is listed as an alias below,
 * and it round-trips. This is the compounding this language exists to exercise,
 * showing up as a per-unit decision rather than as a helper — and it is why a
 * German engine answers "1,5 Kubikmeter" where an English one answers "1.5m³".
 *
 * **Four `forms` keys, and the German rule that fills them.** `german.selectForm`
 * returns `` `${case}-${category}` ``: the case from the slot (dative for a
 * conversion target, which is what "in Litern" governs) and the category from
 * `Intl.PluralRules("de")`, which declares only `one` and `other`. So the key
 * set is exactly `nom-one`, `nom-other`, `dat-one`, `dat-other` (rule 6), and
 * two grammar facts decide what goes in them:
 *
 *   **The number axis is live only on the feminine noun.** Duden's rule for
 *   Maßangaben: a masculine or neuter measure noun stays uninflected after a
 *   numeral — "zwei Liter", "zwei Kubikmeter", "zwei Pint" — while a feminine
 *   one takes its ordinary plural. `die Gallone` is the only feminine unit here,
 *   so `Gallone`/`Gallonen` is the only place `nom-one` and `nom-other` differ.
 *
 *   **The case axis is live on the `-er` stems.** German writes "eine Angabe in
 *   Litern" and "in Kubikmetern", so `Liter`, `Milliliter` and `Kubikmeter` take
 *   the dative plural `-n`. `Pint` does not (German writes "in Pint"), and
 *   `Gallonen` already ends in `-n`, so on those two the dative row equals the
 *   nominative one. Three of `Liter`'s four rows being the same string is
 *   therefore German, not a table stopping halfway.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a German engine and the
 * micro path (`parseVolume`) cannot drift from it. That map already carries the
 * US spellings `liter` and `milliliter`, which are the German words too, and the
 * superscript `m³` a German writes as readily as anyone. What this file adds is
 * the dative plurals, the compound `Kubikmeter`, and `Gallone`.
 *
 * Capitals: the `forms` print `Liter` and the aliases list `liter`, because
 * `buildRegistry` folds every alias key with `toLocaleLowerCase` and
 * `compoundSplitter` folds both sides of its own comparison. One lowercase alias
 * reads `Liter`, `liter` and `LITER` alike.
 *
 * `symbol` is what German itself writes: `l`, `ml` and `m³` are the SI
 * abbreviations, `gal` is the one this unit is abbreviated with in German
 * technical prose, and `Pint` is spelled out because German has no short form
 * for it at all. R8 wants an explicit symbol on every unit, never an invented
 * one.
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/de` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "de",
  kind: "volume",
  units: {
    l: {
      aliases: [...alias("l"), "litern"],
      symbol: "l",
      forms: {
        "nom-one": "Liter",
        "nom-other": "Liter",
        "dat-one": "Liter",
        "dat-other": "Litern",
      },
    },
    ml: {
      aliases: [...alias("ml"), "millilitern"],
      symbol: "ml",
      forms: {
        "nom-one": "Milliliter",
        "nom-other": "Milliliter",
        "dat-one": "Milliliter",
        "dat-other": "Millilitern",
      },
    },
    // The compound `en` and `uk` could not print. `kubikmeter` is listed exactly
    // — at weight 0 — so it outranks the `meter` that `compoundSplitter` finds
    // inside the same word at -3, which is what keeps a cubic metre from
    // collapsing into a metre in an engine that also speaks `@smartput/length`.
    // `kubikmetern` is listed for the same reason `metern` is: the analyzer
    // chain does not iterate, so the stripper's `-n` never reaches the splitter.
    // `cbm` is listed for the same reason `@smartput/area/locale/de` lists `qm`:
    // it is the abbreviation German invoices and delivery notes actually carry
    // (`cb` for *Kubik*, spelled the old way with a c), and `units.ts` has only
    // the superscript and the ASCII `m3` beside it. It collides with nothing —
    // no unit of any kind here begins `cb`.
    m3: {
      aliases: [...alias("m3"), "cbm", "kubikmeter", "kubikmetern"],
      symbol: "m³",
      forms: {
        "nom-one": "Kubikmeter",
        "nom-other": "Kubikmeter",
        "dat-one": "Kubikmeter",
        "dat-other": "Kubikmetern",
      },
    },
    // The feminine one, and the only unit here whose number axis moves. The
    // weak plural `Gallonen` already ends in `-n`, so its dative adds nothing —
    // the exact opposite arrangement from `Liter`.
    gal: {
      aliases: [...alias("gal"), "gallone", "gallonen"],
      symbol: "gal",
      forms: {
        "nom-one": "Gallone",
        "nom-other": "Gallonen",
        "dat-one": "Gallone",
        "dat-other": "Gallonen",
      },
    },
    // `das Pint` is a loan with an `-s` plural (`Pints`), and German prints
    // neither that nor a dative `-n` after a numeral: "zwei Pint", "in Pint".
    // The loan plural is already an alias through `units.ts`, so a reader who
    // types it is still understood — reading and printing are separate
    // decisions, and only printing has to round-trip.
    pint: {
      aliases: [...alias("pint")],
      symbol: "Pint",
      forms: {
        "nom-one": "Pint",
        "nom-other": "Pint",
        "dat-one": "Pint",
        "dat-other": "Pint",
      },
    },
  },
});
