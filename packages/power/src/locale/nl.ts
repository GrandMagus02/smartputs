import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { POWER_UNITS, type PowerUnit } from "../units";

const alias = (unit: PowerUnit) => aliasesFor(POWER_UNITS, unit);

/**
 * Dutch words for the power units.
 *
 * The bare `nl` tag, matching the language in `@smartput/core/locale/nl`: CLDR's
 * default content for Dutch, which is the Netherlands'. The same five units
 * `en.ts` names, the same kind named by **id string** rather than imported, the
 * same explicit `symbol` on every unit (ruling R8). `aliases` reuses the Latin
 * spellings from `units.ts` through `aliasesFor` instead of retyping them — a
 * Dutch datasheet writes "2 kW" and a Dutch sentence writes "2 kilowatt" — and
 * the Dutch spellings are appended.
 *
 * **Two keys, on one axis, and lowercase.** `dutch.selectForm` answers the bare
 * CLDR plural category: `slot` is read and discarded, because modern Dutch has
 * no case marking left on common nouns, so "in twee kilowatt" holds the same
 * word "twee kilowatt" does. That is the substantive difference from `de.ts`,
 * whose four keys carry a dative axis, and it is joined by the other one — Dutch
 * capitalises no noun, so every form below is lowercase where German's is not.
 *
 * `watt` fills both rows with one string, and that is the Dutch rule rather than
 * a table left half-written: it is a measure noun, and Dutch holds one in the
 * singular after a numeral — "twee watt", never "twee watts", the same rule that
 * gives "tien meter" and "vijf kilo". `dutch`'s own `COMPOUND_HEADS` comment
 * says the same thing from the other side, listing `watt` as a single entry
 * because there is no second form of it to list.
 *
 * **`hp` is what keeps that from being vacuous, and it is the entry worth
 * reading, because Ukrainian had to give up here and Dutch does not have to.**
 * Ukrainian says "кінська сила" — an adjective plus a noun, two tokens — and
 * `parse/lex.ts` builds a word token out of letters plus trailing digits, so a
 * space ends it and no alias can claim the phrase; `uk.ts` writes that up at
 * length and ships a bare abbreviation instead. Dutch says the same thing as
 * **one word**, `paardenkracht`, because that is what a Germanic language does
 * to a phrase. One letter run, one token, so the spelled forms print and read
 * back at full weight.
 *
 * And unlike `watt` it is marked for number. A paardenkracht is counted rather
 * than measured — an engine has a hundred of them the way a bag has a hundred
 * apples — so "een motor van 150 paardenkrachten" is the spelling, and the `-en`
 * plural is real. That makes the number axis live on exactly one unit here,
 * which is the whole reason this file asserts anything: a vocabulary where every
 * row of every unit held the same word would satisfy rule 6 and prove nothing.
 *
 * The pre-1995 spelling `paardekracht`, without the linking *-n-*, is listed as
 * an alias and never printed. The Groene Boekje's tussen-n rule made the *n*
 * obligatory in compounds whose first element has a plural in *-en*, so
 * *paardenkracht* is the current form; the older one is still what a great deal
 * of Dutch text on the subject contains, and recognition is many-to-one (I6)
 * while generation stays one.
 *
 * **The symbol is `pk`**, the abbreviation a Dutch car advertisement prints, and
 * it is listed in `aliases` so that a `symbols: true` print parses back. It is
 * two letters and therefore below `suffixStripper`'s `minStem: 3`, which is
 * another reason it has to be listed rather than derived from anything. English
 * "hp" stays readable beside it, from `units.ts`.
 *
 * **Symbols** for the SI four are `W`, `kW`, `MW`, `GW` — SI's own casing, which
 * Dutch follows, and each folds onto a derived alias (`kW` → `kw`), which is the
 * mechanism by which the printed symbol parses back. The capitals in them are
 * SI's, not the noun capitals German's file carries. Note that `mw` is the
 * megawatt and there is no milliwatt in the kind at all; `units.ts` argues that
 * ruling out, and nothing about Dutch changes it, since the alias index folds
 * case in every language.
 */
export default defineVocabulary({
  locale: "nl",
  kind: "power",
  units: {
    // Watt and its prefixes. Dutch spells them exactly as `units.ts` already
    // does, so `aliases` needs no Dutch addition — and unlike German not even a
    // capital, since the printed form is lowercase.
    w: {
      aliases: alias("w"),
      symbol: "W",
      forms: { one: "watt", other: "watt" },
    },
    kw: {
      aliases: alias("kw"),
      symbol: "kW",
      forms: { one: "kilowatt", other: "kilowatt" },
    },
    mw: {
      aliases: alias("mw"),
      symbol: "MW",
      forms: { one: "megawatt", other: "megawatt" },
    },
    gw: {
      aliases: alias("gw"),
      symbol: "GW",
      forms: { one: "gigawatt", other: "gigawatt" },
    },
    // The count noun, and the only unit in the kind whose plural is marked. The
    // `-en` is written out rather than left to the language's stripper, which
    // does not strip `en` at all — see `dutch`'s own comment on why.
    hp: {
      aliases: [
        ...alias("hp"),
        "pk",
        "paardenkracht",
        "paardenkrachten",
        "paardekracht",
        "paardekrachten",
      ],
      symbol: "pk",
      forms: { one: "paardenkracht", other: "paardenkrachten" },
    },
  },
});
