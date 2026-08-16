import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * German words for the power units.
 *
 * The bare `de` tag, matching the language in `@smartput/core/locale/de`: CLDR's
 * default content for German, which is Germany's. The same five units `en.ts`
 * names, the same kind named by **id string** rather than imported, the same
 * explicit `symbol` on every unit (ruling R8). `aliases` reuses the Latin
 * spellings from `units.ts` through `aliasesFor` instead of retyping them — a
 * German datasheet writes "2 kW" and a German sentence writes "2 Kilowatt" — and
 * the German spellings are appended.
 *
 * **Four keys, and four rows that are frequently one word.**
 * `german.selectForm` answers `` `${case}-${category}` `` over {nom, dat} ×
 * {one, other}: case from the slot, because a conversion target is governed by
 * "in"/"nach"/"zu" and German's locative "in" takes the dative, category from
 * `Intl.PluralRules("de")`, which declares exactly two. `Watt` fills all four
 * with one string, and that is the German rule rather than a table left
 * half-written: it is a neuter loan measure noun, so a numeral holds it in the
 * singular ("zwei Watt", never "zwei Watts") and the dative plural is
 * uninflected too ("die Leistung in Watt"). `german`'s own `COMPOUND_HEADS`
 * comment says the same thing from the other side, listing `watt` as a single
 * entry because there is no second form of it to list.
 *
 * `hp` is what keeps that from being vacuous — `Pferdestärke` is feminine and
 * marks its plural, so the number axis is live on exactly one unit here. A file
 * where every row of every unit were the same word would satisfy rule 6 and
 * assert nothing.
 *
 * **`hp` is the entry worth reading, because Ukrainian had to give up here and
 * German does not have to.** Ukrainian says "кінська сила" — an adjective plus a
 * noun, two tokens — and `parse/lex.ts` builds a word token out of letters plus
 * trailing digits, so a space ends it and no alias can claim the phrase;
 * `uk.ts` writes that up at length and ships a bare abbreviation instead. German
 * says the same thing as **one word**, `Pferdestärke`, because that is what
 * German does to a phrase. One letter run, one token, so the spelled forms print
 * and read back at full weight, and this kind needs no abbreviation to stand in
 * for them.
 *
 * The abbreviation is still recorded, as the symbol: `PS` is what a German car
 * advertisement prints, and it is listed in `aliases` so that a `symbols: true`
 * print parses back. It is two letters and therefore below `suffixStripper`'s
 * `minStem: 3`, which is another reason it has to be listed rather than derived
 * from anything.
 *
 * **Symbols** for the SI four are `W`, `kW`, `MW`, `GW` — SI's own casing, which
 * German follows, and each folds onto a derived alias (`kW` → `kw`), which is
 * the mechanism by which the printed symbol parses back. Note that `mw` is the
 * megawatt and there is no milliwatt in the kind at all; `units.ts` argues that
 * ruling out, and nothing about German changes it, since the alias index folds
 * case in every language.
 */
export default defineVocabulary({
  locale: "de",
  kind: "power",
  units: {
    // Watt and its prefixes. German spells them exactly as `units.ts` already
    // does, so `aliases` needs no German addition — only the capital the printer
    // emits, which the alias index folds away on the way back in.
    w: {
      aliases: alias("w"),
      symbol: "W",
      forms: {
        "nom-one": "Watt",
        "nom-other": "Watt",
        "dat-one": "Watt",
        "dat-other": "Watt",
      },
    },
    kw: {
      aliases: alias("kw"),
      symbol: "kW",
      forms: {
        "nom-one": "Kilowatt",
        "nom-other": "Kilowatt",
        "dat-one": "Kilowatt",
        "dat-other": "Kilowatt",
      },
    },
    mw: {
      aliases: alias("mw"),
      symbol: "MW",
      forms: {
        "nom-one": "Megawatt",
        "nom-other": "Megawatt",
        "dat-one": "Megawatt",
        "dat-other": "Megawatt",
      },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "GW",
      forms: {
        "nom-one": "Gigawatt",
        "nom-other": "Gigawatt",
        "dat-one": "Gigawatt",
        "dat-other": "Gigawatt",
      },
    },
    // The feminine, and the only unit in the kind whose plural is marked:
    // `Stärke` is a first-declension feminine, so the compound takes its `-n`
    // plural and its dative plural is that same `-n` form.
    hp: {
      aliases: [...alias("hp"), "ps", "pferdestärke", "pferdestärken"],
      symbol: "PS",
      forms: {
        "nom-one": "Pferdestärke",
        "nom-other": "Pferdestärken",
        "dat-one": "Pferdestärke",
        "dat-other": "Pferdestärken",
      },
    },
  },
});
