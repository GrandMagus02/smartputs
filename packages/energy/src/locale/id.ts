import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Indonesian words for the energy units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Same
 * shape as `en.ts`, `nl.ts` and `de.ts` next door, the same kind named by **id
 * string** rather than imported — which is what lets this file be imported
 * without linking the ratio table or the four power/duration/energy signatures —
 * and the same explicit `symbol` on every unit (ruling R8). `aliases` reuses the
 * Latin spellings from `units.ts` through `aliasesFor` rather than retyping
 * them: an Indonesian datasheet writes "2 kJ" and an Indonesian sentence writes
 * "2 kilojoule", and the second is already in that map.
 *
 * **One row per unit, for the units that have one.**
 * `indonesian.selectForm` returns the constant `"other"` for every count and
 * every slot, because nothing in Indonesian agrees with anything else in it —
 * no grammatical plural, no gender, no case for a preposition to govern. So
 * where `de.ts` writes four keys and `nl.ts` two, this writes one, and "satu
 * joule" and "dua ribu joule" hold the same noun.
 *
 * **The joule family needs no Indonesian addition at all, and the calorie family
 * needs the whole column.** *Joule*, *kilojoule* and *megajoule* are borrowed
 * unchanged — Indonesian keeps the eponym's French spelling exactly as English
 * does, so `units.ts` has already spelled every form this file prints. The
 * calorie did not survive the crossing intact: Indonesian respells it *kalori*
 * with a native `k`, and the derived *kilokalori* with it, so both nouns and
 * both symbols are new here. That respelling is what makes this the interesting
 * half of the file, and it is also where Indonesian has an abbreviation of its
 * own worth preferring: an Indonesian nutrition label prints **kkal**, not
 * "kcal" — "Energi total 250 kkal" — and R8 asks for the abbreviation the
 * language actually writes. `kal` is the same respelling one prefix down, and is
 * what an Indonesian physics text sets against the joule. Both are listed in
 * `aliases`, because `symbol` is a display field `buildRegistry` never indexes
 * and a symbol nobody indexed is a symbol nobody can type back.
 *
 * **The watt-hour family carries no `forms`, and Indonesian has no escape from
 * that.** English and Ukrainian decline for the same reason — the written-out
 * name is a compound the lexer cannot read back, "watt hour" being two words and
 * *кіловат-година* hyphenated — and `parse/lex.ts` builds a unit word out of
 * letters plus trailing digits, so a space or a hyphen ends the token. Dutch and
 * German escape by closing the compound up (*kilowattuur*, one letter run, one
 * token). Indonesian cannot follow them: it is not a Germanic language and does
 * not glue nouns, and its spelling for this unit is **kilowatt-jam**, hyphenated
 * by the standard orthography precisely because the second element is a free
 * noun. There is no closed variant anyone writes. So the symbol is what remains,
 * and it is the string Indonesians see anyway — a PLN electricity bill is
 * denominated in kWh and nothing else.
 *
 * That has a cost this file records rather than works around: absent `forms`
 * puts `formatValue` on the symbol branch, which `defaultRenderQuantity` sets
 * tight, so a watt-hour prints "2kWh" where Indonesian typography wants "2 kWh".
 * `@smartput/core/locale/id` declines `renderQuantity` on the reasoning that
 * every translated Indonesian unit carries a `forms` row and therefore takes the
 * spacing word branch; these three units, `@smartput/datarate`'s five and
 * `@smartput/speed`'s three are where that reasoning runs out. The repair
 * belongs in the language file, not in six vocabularies each guessing at a
 * space.
 *
 * **`btu` carries no `forms` either, and the reason is the one German gives.**
 * It is a borrowed initialism with no Indonesian expansion in use — "satuan
 * termal Britania" is a gloss rather than a unit name, three words long, and
 * nobody counts in it — so there is no word to put in a table and no way to lex
 * the gloss if there were. Indonesian air-conditioner advertising is where this
 * unit actually lives, and it writes "9.000 BTU".
 *
 * **Symbols** are the SI ones Indonesian writes: `J`, `kJ`, `MJ`, `Wh`, `kWh`,
 * `MWh`, and `BTU` for the initialism. Each folds onto a derived alias (`kWh` →
 * `kwh`), which is the mechanism by which a `symbols: true` print parses back.
 * The capitals in them are SI's — the prefix symbol for mega, the initials of
 * Joule and Watt the people — and not noun capitals, which Indonesian has none
 * of.
 */
export default defineVocabulary({
  locale: "id",
  kind: "energy",
  units: {
    // Borrowed whole. `aliases` needs no Indonesian addition, because the
    // Indonesian spelling of the eponym is the one `units.ts` already carries —
    // the same finding `@smartput/datasize`'s Indonesian file makes about the
    // byte, arrived at from the other direction (there a loanword nobody
    // translated, here a proper name nobody could).
    j: {
      aliases: alias("j"),
      symbol: "J",
      forms: { other: "joule" },
    },
    kj: {
      aliases: alias("kj"),
      symbol: "kJ",
      forms: { other: "kilojoule" },
    },
    mj: {
      aliases: alias("mj"),
      symbol: "MJ",
      forms: { other: "megajoule" },
    },
    // The compound no language in this package prints. Indonesian's spelling is
    // "kilowatt-jam", hyphenated, and the hyphen ends the unit token.
    wh: {
      aliases: alias("wh"),
      symbol: "Wh",
    },
    kwh: {
      aliases: alias("kwh"),
      symbol: "kWh",
    },
    mwh: {
      aliases: alias("mwh"),
      symbol: "MWh",
    },
    // The respelled family, and the reason this file is worth reading beside the
    // joule rows above. `kal` and `kkal` are Indonesian's own abbreviations, not
    // transliterations of the SI ones, and they are the strings a food label and
    // a physics textbook actually print.
    cal: {
      aliases: [...alias("cal"), "kalori", "kal"],
      symbol: "kal",
      forms: { other: "kalori" },
    },
    kcal: {
      aliases: [...alias("kcal"), "kilokalori", "kkal"],
      symbol: "kkal",
      forms: { other: "kilokalori" },
    },
    btu: {
      aliases: alias("btu"),
      symbol: "BTU",
    },
  },
});
