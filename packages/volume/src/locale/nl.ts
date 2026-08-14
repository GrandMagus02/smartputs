import { aliasesFor, defineVocabulary } from "@smartput/core";
import { VOLUME_UNITS, type VolumeUnit } from "../units";

const alias = (unit: VolumeUnit) => aliasesFor(VOLUME_UNITS, unit);

/**
 * Dutch words for the volume units — the same five `en`, `uk` and `de` name, and
 * the same per-unit answer `en` and `uk` give about `m3`, **against** the one
 * `de` gives.
 *
 * **`m3` carries no `forms` here, exactly as `en` and `uk` carry none.** Their
 * reason was never that the unit is unspeakable; it was that the spoken name is
 * a *phrase* — "cubic metres", "кубічних метрів" — and `lex` ends a word token
 * at a space, so no analyzer is ever handed the whole thing, and
 * `assertLocaleContract` fails a printed phrase by name. `de.ts` escapes that
 * because German writes the concept as the single token `Kubikmeter`. Dutch does
 * not escape it: the Dutch name is `kubieke meter`, an **inflected adjective
 * plus a noun**, and Dutch orthography writes an adjective apart from its noun
 * as firmly as it writes a noun-plus-noun compound together. So this unit
 * renders through its symbol, `m³`, and a Dutch engine answers "1,5 m³" where a
 * German one answers "1,5 Kubikmeter".
 *
 * `kubiekemeter` is still listed as an alias. It is not the standard
 * orthography, but it is a single token, it is what a reader typing into a
 * search box produces, and reading a word and printing it are separate decisions
 * — only printing has to round-trip. It also outranks the split: `compoundSplitter`
 * finds `meter` inside it at `-3`, and without the exact entry at weight 0 an
 * engine that also speaks `@smartput/length/locale/nl` would answer a *length*
 * for it.
 *
 * **Two `forms` keys on the other four, not German's four.** `dutch.selectForm`
 * returns the bare CLDR plural category, so the key set is exactly `one` and
 * `other` (rule 6). Modern Dutch has no case marking left on common nouns, so
 * "in liter" is spelled like "twee liter" — where `de.ts` needs a second axis to
 * hold the dative "in Litern".
 *
 * **And none of the four moves on the number axis.** A Dutch measure noun stays
 * singular after a numeral: "twee liter", "vijf gallon", "drie pint". Both rows
 * of every table below therefore hold the same word, and the free-noun plurals
 * (`liters`, `gallons`, `pinten`) are listed for reading only. Note that this is
 * where Dutch and German diverge on one specific unit: German's `die Gallone` is
 * feminine and does take its plural, so `de.ts` prints "zwei Gallonen" where
 * this file prints "twee gallon".
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 l" keeps working in a Dutch engine and the
 * micro path (`parseVolume`) cannot drift from it. That map already carries the
 * US spellings `liter` and `milliliter`, which are the Dutch words unchanged,
 * and the superscript `m³` a Dutch reader writes as readily as anyone.
 *
 * **No capitals.** Dutch capitalises no noun, so the `forms` print `liter`
 * exactly as the aliases list it — where `de.ts` prints `Liter` and indexes
 * `liter`, and folds both sides to compare them.
 *
 * `symbol` is what Dutch itself writes: `l`, `ml` and `m³` are the SI
 * abbreviations, `gal` is the one this unit is abbreviated with in Dutch
 * technical prose, and `pint` is spelled out because Dutch has no short form for
 * it at all. R8 wants an explicit symbol on every unit, never an invented one.
 *
 * Like `en`, this file names `volume` by **id string** and never imports the
 * kind, which is what lets `@smartput/volume/locale/nl` be imported without
 * linking the ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "volume",
  units: {
    // `liters` is the free noun's plural and comes from `units.ts` already; the
    // measure reading is the bare "twee liter", which is what gets printed.
    l: {
      aliases: [...alias("l")],
      symbol: "l",
      forms: { one: "liter", other: "liter" },
    },
    ml: {
      aliases: [...alias("ml")],
      symbol: "ml",
      forms: { one: "milliliter", other: "milliliter" },
    },
    // The unit `de` could print and this one cannot; see the header. The
    // closed-up `kubiekemeter` is listed so the token resolves to this unit
    // rather than to the `meter` the splitter finds inside it.
    m3: {
      aliases: [...alias("m3"), "kubiekemeter", "kubiekemeters"],
      symbol: "m³",
    },
    // `de gallon`, plural `gallons`, invariant after a numeral. German's
    // `Gallone` is feminine and does inflect, which is the one unit in this kind
    // where the two languages answer differently.
    gal: {
      aliases: [...alias("gal")],
      symbol: "gal",
      forms: { one: "gallon", other: "gallon" },
    },
    // `de pint` takes the native `-en` plural in Dutch (`pinten`), not the loan
    // `-s` that `units.ts` declares; both are listed for reading and neither is
    // printed, because after a numeral Dutch writes the bare "drie pint".
    pint: {
      aliases: [...alias("pint"), "pinten"],
      symbol: "pint",
      forms: { one: "pint", other: "pint" },
    },
  },
});
