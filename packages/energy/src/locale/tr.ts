import { aliasesFor, defineVocabulary } from "@smartput/core";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Turkish words for the energy units.
 *
 * The bare `tr` tag, matching the language in `@smartput/core/locale/tr`. Same
 * shape as `en.ts`, `uk.ts` and `de.ts` next door, same kind named by **id
 * string** rather than imported, same explicit `symbol` on every unit (ruling
 * R8). `aliases` reuses the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them — a Turkish datasheet writes "2 kJ" and a Turkish
 * sentence writes "2 kilojul" — and the Turkish spellings are appended.
 *
 * **One key per unit.** `turkish.selectForm` returns the constant `"other"`,
 * because Turkish leaves a counted noun bare: "1 jul", "5 jul", "1,5 jul", and
 * "5 juller" is not a plural but a mistake. So every `forms` table below is one
 * row, and that row is a finished answer rather than half of an English one.
 *
 * **The watt-hour family carries `forms` here, exactly as it does in German and
 * for exactly the same reason.** English and Ukrainian both refuse them because
 * the written-out name is a compound the lexer cannot read back — "watt hour" is
 * two words, "кіловат-година" is hyphenated, and `parse/lex.ts` builds a unit
 * word out of letters plus trailing digits, so a space or a hyphen ends the
 * token. Turkish closes the compound up, and TDK spells it closed:
 * **kilovatsaat** is one word, one letter run, one token, so it can be printed
 * and read back at full weight. `vatsaat` and `megavatsaat` are built the same
 * way. What that gives up, stated rather than hidden: a Turkish electricity bill
 * prints "kWh", and this vocabulary prints "kilovatsaat" — the word, not the
 * symbol, because a declared `forms` row always wins over `symbol`. The symbol
 * is still there and still parses, and `Printer`'s `symbols: true` reaches it.
 *
 * The `v` in those spellings is not a slip. TDK transcribes the borrowed *watt*
 * as **vat**, which is the same transcription `@smartput/power/locale/tr.ts`
 * uses for the unit itself; the `w` spelling reaches the index anyway through
 * the derived Latin aliases ("wh", "kwh", "mwh") that every Turkish datasheet
 * also writes, so nothing is lost by keeping the Turkish half of the list
 * Turkish.
 *
 * **`btu` carries no `forms`, and the reason is the one `de.ts` records rather
 * than the one `uk.ts` does.** It is a borrowed initialism with no Turkish
 * expansion in use — "İngiliz ısı birimi" is a gloss, not a unit name, and an
 * air-conditioner is sold as "12.000 BTU" — so there is no word to put in a
 * table. Ukrainian fills its table anyway because absent forms put the renderer
 * on the symbol and the symbol branch sets number and label tight; that reason
 * does not transfer, because `turkish.renderQuantity` spaces a bare symbol the
 * way TSE and SI require. So "12000 BTU" comes out spaced with no `forms` at
 * all, and a row holding the same borrowed initialism would buy nothing.
 *
 * **Symbols.** `J`, `kJ`, `MJ`, `Wh`, `kWh`, `MWh` and `BTU` are international
 * and Turkish writes them unchanged; each folds onto a derived alias on the way
 * back in, which is the mechanism by which a `symbols: true` print parses. The
 * calorie is the one place Turkish abbreviates for itself: **kal** is the TDK
 * abbreviation and is listed as an alias so the symbol reads back. Its prefixed
 * partner keeps `kcal` rather than taking a matching "kkal" — that spelling
 * appears in Turkish physics texts but is not settled, and every Turkish
 * nutrition label prints "kcal", so R8's "never invent one" applies and the
 * international symbol stands.
 *
 * **Case endings are left to the language.** Turkish glues them on with vowel
 * harmony — "jule çevir" but "kilovatsaate çevir", "kaloriye" with the `-y-`
 * buffer after a vowel-final stem — and `turkish`'s suffix stripper enumerates
 * every harmonic variant precisely so a vocabulary does not have to. This kind
 * is where its `minStem: 3` earns its keep exactly: "jul" is three letters, so
 * "jule" strips back to it and a floor of 4 would have lost the canonical unit
 * of the kind.
 */
export default defineVocabulary({
  locale: "tr",
  kind: "energy",
  units: {
    // "jul" is TDK's transcription of *joule*, and the Latin spelling reaches
    // the index through `units.ts` beside it, so a reader who types either is
    // understood.
    j: {
      aliases: [...alias("j"), "jul"],
      symbol: "J",
      forms: { other: "jul" },
    },
    kj: {
      aliases: [...alias("kj"), "kilojul"],
      symbol: "kJ",
      forms: { other: "kilojul" },
    },
    mj: {
      aliases: [...alias("mj"), "megajul"],
      symbol: "MJ",
      forms: { other: "megajul" },
    },
    // The compound English and Ukrainian both had to give up on, closed up the
    // way Turkish closes compounds. "saat" is the hour, the same noun
    // `@smartput/duration/locale/tr.ts` names, and gluing it to the power word
    // produces one token rather than two.
    wh: {
      aliases: [...alias("wh"), "vatsaat"],
      symbol: "Wh",
      forms: { other: "vatsaat" },
    },
    kwh: {
      aliases: [...alias("kwh"), "kilovatsaat"],
      symbol: "kWh",
      forms: { other: "kilovatsaat" },
    },
    mwh: {
      aliases: [...alias("mwh"), "megavatsaat"],
      symbol: "MWh",
      forms: { other: "megavatsaat" },
    },
    cal: {
      aliases: [...alias("cal"), "kal", "kalori"],
      symbol: "kal",
      forms: { other: "kalori" },
    },
    kcal: {
      aliases: [...alias("kcal"), "kilokalori"],
      symbol: "kcal",
      forms: { other: "kilokalori" },
    },
    // No `forms`; the doc comment above says why at length. The symbol is the
    // borrowed initialism, spaced by `turkish.renderQuantity`.
    btu: { aliases: alias("btu"), symbol: "BTU" },
  },
});
