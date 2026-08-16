import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * German words for the energy units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. Same shape as `en.ts` and
 * `uk.ts` next door, same kind named by **id string** rather than imported, same
 * explicit `symbol` on every unit (ruling R8). `aliases` reuses the Latin
 * spellings from `units.ts` through `aliasesFor` rather than retyping them — a
 * German datasheet writes "2 kJ" and a German sentence writes "2 Kilojoule" —
 * and the German spellings are appended.
 *
 * **The watt-hour family carries `forms` here, where English and Ukrainian both
 * refuse them, and that is the one genuinely German thing in this file.** Both
 * of those languages decline for the same reason: the written-out name is a
 * compound the lexer cannot read back — "watt hour" is two words, "кіловат-
 * година" is hyphenated, and `parse/lex.ts` builds a unit word out of letters
 * plus trailing digits, so a space or a hyphen ends the token. German closes its
 * compounds up. `Kilowattstunde` is **one word**, one letter run, one token, and
 * therefore a form this vocabulary can print and read back at full weight. The
 * language's `compoundSplitter` offers `stunde` out of the same string at its
 * −3 penalty, which would be an hour rather than a kilowatt-hour; the exact
 * alias at 0 outranks it, which is precisely why the spelled forms are listed in
 * `aliases` and not left to the splitter.
 *
 * **Four keys, and which axis moves.** `german.selectForm` answers
 * `` `${case}-${category}` `` over {nom, dat} × {one, other} — case from the
 * slot, because a conversion target is governed by "in"/"nach"/"zu" and German's
 * locative "in" takes the dative, category from `Intl.PluralRules("de")`, which
 * declares exactly two. This kind splits cleanly in two along that table:
 *
 * ```
 * Joule    all four "Joule"        neuter loan measure noun, invariant
 * Kalorie  Kalorie / Kalorien      feminine, plural in -n, dative plural the same
 * ```
 *
 * `Joule` is the row a translator is likeliest to "finish". It is a neuter
 * loanword and a measure noun, so a numeral leaves it in the singular ("5
 * Joule", exactly as "5 Watt" and "5 Meter"), and German writes the dative
 * plural of it uninflected too — "die Angabe in Joule", never "in Joulen".
 * Writing all four rows with the same string is the answer and not a table that
 * stopped halfway; `Kalorie` beside it is what keeps that claim honest, since a
 * feminine does mark its plural. Contrast `@smartput/length`'s `Meter`, an `-er`
 * masculine, which *does* take the dative plural `Metern`: German's invariance
 * is a property of the noun class, not of units in general.
 *
 * **Symbols** are the SI ones German writes: `J`, `kJ`, `MJ`, `Wh`, `kWh`,
 * `MWh`, `cal`, `kcal`. Each folds onto a derived alias (`kWh` → `kwh`), which
 * is the mechanism by which a `symbols: true` print parses back.
 *
 * **`btu` carries no `forms`, and the reason is German-specific.** It is a
 * borrowed initialism with no German expansion in use — the descriptive
 * "britische Wärmeeinheit" is a gloss rather than a unit name, and nobody counts
 * in it — so there is no word to put in a `forms` table. Ukrainian's file gives
 * a second reason for filling the table anyway: absent forms put the renderer on
 * the symbol, and the symbol branch sets number and label tight. That reason
 * does not transfer, because `german.renderQuantity` spaces a symbol as DIN
 * 1301-1 requires. So "100 BTU" comes out spaced with no `forms` at all, and
 * four rows of the same borrowed initialism would buy nothing.
 */
export default defineVocabulary({
  locale: "de",
  kind: "energy",
  units: {
    // Joule and its prefixes. German spells them exactly as `units.ts` already
    // does, so `aliases` needs no German addition at all — only the capital the
    // printer emits, which the alias index folds away on the way back in.
    j: {
      aliases: alias("j"),
      symbol: "J",
      forms: {
        "nom-one": "Joule",
        "nom-other": "Joule",
        "dat-one": "Joule",
        "dat-other": "Joule",
      },
    },
    kj: {
      aliases: alias("kj"),
      symbol: "kJ",
      forms: {
        "nom-one": "Kilojoule",
        "nom-other": "Kilojoule",
        "dat-one": "Kilojoule",
        "dat-other": "Kilojoule",
      },
    },
    mj: {
      aliases: alias("mj"),
      symbol: "MJ",
      forms: {
        "nom-one": "Megajoule",
        "nom-other": "Megajoule",
        "dat-one": "Megajoule",
        "dat-other": "Megajoule",
      },
    },
    // The compound English and Ukrainian both had to give up on. `Stunde` is
    // feminine, and a compound takes the gender and the inflection of its head,
    // so the whole family declines as `Stunde` does: plural in -n, dative plural
    // identical to it.
    wh: {
      aliases: [...alias("wh"), "wattstunde", "wattstunden"],
      symbol: "Wh",
      forms: {
        "nom-one": "Wattstunde",
        "nom-other": "Wattstunden",
        "dat-one": "Wattstunde",
        "dat-other": "Wattstunden",
      },
    },
    kwh: {
      aliases: [...alias("kwh"), "kilowattstunde", "kilowattstunden"],
      symbol: "kWh",
      forms: {
        "nom-one": "Kilowattstunde",
        "nom-other": "Kilowattstunden",
        "dat-one": "Kilowattstunde",
        "dat-other": "Kilowattstunden",
      },
    },
    mwh: {
      aliases: [...alias("mwh"), "megawattstunde", "megawattstunden"],
      symbol: "MWh",
      forms: {
        "nom-one": "Megawattstunde",
        "nom-other": "Megawattstunden",
        "dat-one": "Megawattstunde",
        "dat-other": "Megawattstunden",
      },
    },
    // The feminine pair, and the reason this file is worth reading beside the
    // Joule rows above: gender changes every plural. `Kalorie` is spelled with a
    // `K` where the symbol keeps the Latin `c`, so the German noun has to be
    // listed rather than derived — "kalorie" is not "calorie".
    cal: {
      aliases: [...alias("cal"), "kalorie", "kalorien"],
      symbol: "cal",
      forms: {
        "nom-one": "Kalorie",
        "nom-other": "Kalorien",
        "dat-one": "Kalorie",
        "dat-other": "Kalorien",
      },
    },
    kcal: {
      aliases: [...alias("kcal"), "kilokalorie", "kilokalorien"],
      symbol: "kcal",
      forms: {
        "nom-one": "Kilokalorie",
        "nom-other": "Kilokalorien",
        "dat-one": "Kilokalorie",
        "dat-other": "Kilokalorien",
      },
    },
    btu: {
      aliases: alias("btu"),
      symbol: "BTU",
    },
  },
});
