import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Indonesian words for the power units.
 *
 * The bare `id` tag, matching the language in `@smartput/core/locale/id`. Same
 * shape as `en.ts`, `nl.ts` and `de.ts` next door, the same kind named by **id
 * string** rather than imported — which is what lets this file be imported
 * without linking the ratio table — and the same explicit `symbol` on every unit
 * (ruling R8). `aliases` reuses the Latin spellings from `units.ts` through
 * `aliasesFor` rather than retyping them.
 *
 * **One row per unit, and four of the five need no Indonesian word to fill it.**
 * `indonesian.selectForm` returns the constant `"other"` for every count and
 * every slot — no grammatical plural, no gender, no case — so where `de.ts`
 * writes four keys and `nl.ts` two, this writes one, and "satu watt" and "dua
 * ribu watt" hold the same noun. That noun is *watt*, borrowed unchanged along
 * with *kilowatt*, *megawatt* and *gigawatt*, which `units.ts` already spells.
 * The Indonesian contribution to those four rows is the SI symbol casing and
 * nothing else, exactly as `@smartput/datasize`'s Indonesian file reports for
 * the byte family.
 *
 * **`hp` carries no `forms`, and the reason is word order rather than
 * borrowing.** Indonesian says *tenaga kuda* or *daya kuda* — "horse power",
 * head noun first, two words with a space — and `parse/lex.ts` builds a unit
 * word out of letters plus trailing digits, so the space ends the token. English
 * gets "horsepower" as one word and Dutch closes *paardenkracht* up; Indonesian
 * is not a compounding language and has no closed variant anyone writes. So the
 * symbol is what remains, and it is the string an Indonesian specification sheet
 * prints anyway.
 *
 * **`PK` is the Indonesian abbreviation for this quantity, and claiming it here
 * would be wrong by 1.4%.** It is worth stating at length, because it is the one
 * thing about this file a translator is likely to "fix". Indonesian inherited
 * *PK* from Dutch *paardenkracht* and still uses it daily — an air conditioner
 * is sold as "AC 1 PK", a compressor as "3 PK" — and *daya kuda* glosses the
 * same abbreviation. But *paardenkracht* is **metric** horsepower, 735.49875 W
 * by definition (75 kgf·m/s), while this kind's `hp` is **mechanical**
 * horsepower, 745.69987158227022 W (550 ft·lbf/s), and `units.ts` derives that
 * value from its definition rather than restating it. Binding "pk" to `hp` would
 * therefore hand back a number 1.4% high with no ambiguity for the solver to
 * notice and nothing in any test to catch it — a silent factor, which is the
 * failure mode `@smartput/energy`'s ruling against a `Calorie` alias and
 * `@smartput/datarate`'s against byte-per-second units are both written to
 * avoid. The unit Indonesian means when it writes "PK" is simply not in this
 * kind. Adding it is `units.ts`'s decision and not a vocabulary's (rule 2), so
 * the correct move here is to claim nothing and report it, which is what this
 * paragraph is.
 *
 * *Dk* is left out for the same reason and one more: it abbreviates *daya kuda*,
 * so it inherits the metric reading, and two letters is below anything a reader
 * would guess at unaided.
 *
 * **Symbols** are the SI ones Indonesian writes — `W`, `kW`, `MW`, `GW`, with
 * the lowercase `k` SI gives every sub-mega prefix and capitals from mega up —
 * plus the international `hp` for the horsepower. Each folds onto a derived
 * alias (`kW` → `kw`), which is the mechanism by which a `symbols: true` print
 * parses back. The capitals are SI's, the initial of Watt the person, and not
 * noun capitals, which Indonesian has none of.
 *
 * The four units with a `forms` row print through the word branch and are spaced
 * ("2 kilowatt"); `hp` prints through the symbol branch, which
 * `defaultRenderQuantity` sets tight ("2hp"). That asymmetry is the cost
 * `@smartput/core/locale/id` takes when it declines `renderQuantity`, and it is
 * recorded here rather than patched, because a space is the language's business
 * and not one unit's.
 */
export default defineVocabulary({
  locale: "id",
  kind: "power",
  units: {
    w: {
      aliases: alias("w"),
      symbol: "W",
      forms: { other: "watt" },
    },
    kw: {
      aliases: alias("kw"),
      symbol: "kW",
      forms: { other: "kilowatt" },
    },
    mw: {
      aliases: alias("mw"),
      symbol: "MW",
      forms: { other: "megawatt" },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "GW",
      forms: { other: "gigawatt" },
    },
    // Two words in Indonesian, so no printable form; and no "pk", because the
    // abbreviation Indonesian writes names the metric horsepower this kind does
    // not have. See the doc comment above — it is the one row here worth reading
    // before editing.
    hp: {
      aliases: alias("hp"),
      symbol: "hp",
    },
  },
});
