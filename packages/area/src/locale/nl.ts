import { aliasesFor, defineVocabulary } from "@smartput/core";
import { AREA_UNITS, type AreaUnit } from "../units";

const alias = (unit: AreaUnit) => aliasesFor(AREA_UNITS, unit);

/**
 * Dutch words for the area units — the same five `en`, `uk` and `de` name, and
 * the same per-unit answer to "does this unit have words at all?" that `en` and
 * `uk` give, **against** the one `de` gives.
 *
 * **The squared units carry no `forms` here, exactly as `en` and `uk` carry
 * none — and this is where Dutch stops being German.** `de.ts` gives all three
 * a table, and its argument is precise: English and Ukrainian refuse one because
 * the spoken name is a *phrase* ("square metres", "квадратних метрів"), `lex`
 * ends a word token at a space, and a printed phrase is text the parser can
 * never read back; German writes the same concept as the single token
 * `Quadratmeter`, so that reason simply does not apply there. It applies in full
 * here. Dutch does not compound this one: a squared unit is an **adjective plus
 * a noun**, `vierkante meter`, and Dutch orthography writes an inflected
 * adjective apart from its noun as firmly as it writes a noun-plus-noun compound
 * together. `vierkante kilometer`, `kubieke meter` — two words, every time.
 *
 * So the three squared units render through their symbol, `m²`, `cm²` and `km²`,
 * and a Dutch engine answers "1,5 m²" where a German one answers "1,5
 * Quadratmeter". That is the sharpest place in these six packages where the
 * "Dutch is German with different words" assumption is wrong: the compound
 * splitter is as load-bearing here as it is in German (`kilometer` is one
 * token), and the *adjectival* compound German leans on is not available at all.
 *
 * The closed-up spellings are still listed as aliases. `vierkantemeter` is not
 * the standard orthography, but it is what a reader typing into a search box
 * produces, it is a single token so the alias index can hold it, and reading a
 * word and printing it are separate decisions — only printing has to round-trip.
 * That listing is load-bearing in the other direction too: `compoundSplitter`
 * reads a Germanic compound by its head, so it finds `meter` inside
 * `vierkantemeter` at `-3`, and without an exact entry at weight 0 an engine
 * that also speaks `@smartput/length/locale/nl` would quietly answer a *length*
 * for it.
 *
 * **Two `forms` keys on the two units that have a table, and no case axis.**
 * `dutch.selectForm` returns the bare CLDR plural category, so the key set is
 * exactly `one` and `other` (rule 6) — English's shape rather than German's
 * four, because modern Dutch has no case marking left on common nouns and "in
 * hectare" is spelled like "twee hectare".
 *
 * **And neither of those two moves on the number axis.** Dutch keeps a measure
 * noun in the singular after a numeral — "een boerderij van 40 hectare", "200
 * acre" — so `one` and `other` hold the same word in both tables. The free
 * nouns do have plurals (`hectaren`, `hectares`, `acres`), and they are listed
 * as aliases so a reader who types one is understood; none of them is ever
 * printed. Compare `@smartput/angle/locale/nl`, where `graad`/`graden` does
 * move: an angle is counted and a surface is measured, and Dutch marks the
 * difference.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one alias map in `units.ts`, so "2 ha" keeps working in a Dutch engine and the
 * micro path (`parseArea`) cannot drift from it. That map already carries the
 * superscript spellings `m²`, `cm²` and `km²`, which Dutch writes exactly as
 * English does, and their digit-2 twins for a keyboard that cannot produce one.
 *
 * **No capitals anywhere.** Dutch capitalises no noun, so the aliases below are
 * the spellings a Dutch reader actually types and there is no fold between what
 * this file prints and what it indexes — unlike `de.ts`, which prints
 * `Quadratmeter` and indexes `quadratmeter`.
 *
 * `symbol` is what Dutch itself writes: the SI superscripts on the three squared
 * units, `ha` on the hectare, and the spelled noun on the one unit Dutch has no
 * abbreviation for. R8 wants an explicit symbol on every unit, never an invented
 * one.
 *
 * Like `en`, this file names `area` by **id string** and never imports the kind,
 * which is what lets `@smartput/area/locale/nl` be imported without linking the
 * ratio table. `composeLocale` is where the two halves meet.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "area",
  units: {
    m2: {
      aliases: [...alias("m2"), "vierkantemeter", "vierkantemeters"],
      symbol: "m²",
    },
    // `vierkantecentimeter` ends in `centimeter` *and* in `meter`, so the
    // splitter offers two readings of it and neither is this unit. The exact
    // alias is what settles it, which is why the closed-up spelling is written
    // out rather than left to morphology.
    cm2: {
      aliases: [...alias("cm2"), "vierkantecentimeter", "vierkantecentimeters"],
      symbol: "cm²",
    },
    km2: {
      aliases: [...alias("km2"), "vierkantekilometer", "vierkantekilometers"],
      symbol: "km²",
    },
    // Invariant in both rows: "40 hectare", never "40 hectaren". Both free-noun
    // plurals are real — `hectaren` is the older Dutch one and `hectares` the
    // one the loan takes — and both are listed for reading only.
    hectare: {
      aliases: [...alias("hectare"), "hectaren"],
      symbol: "ha",
      forms: { one: "hectare", other: "hectare" },
    },
    // A loan Dutch keeps unchanged, and one the measure rule reaches all the
    // same: "een landgoed van 200 acre". `units.ts` already declares the `-s`
    // plural, so this unit adds no word of its own — only the decision about
    // which of the two gets printed.
    acre: {
      aliases: [...alias("acre")],
      symbol: "acre",
      forms: { one: "acre", other: "acre" },
    },
  },
});
