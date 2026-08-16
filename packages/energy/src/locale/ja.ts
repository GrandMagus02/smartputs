import { aliasesFor } from "@smartput/kind/aliases";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Japanese words for the energy units.
 *
 * `ja` is the bare tag, modern standard Japanese in its ordinary mixed
 * orthography. The kind next door names no language at all: ratios, unit ids,
 * magnitude bands and the four power/duration/energy signatures. This file names
 * `energy` by **id string** rather than importing the kind, so
 * `@smartput/energy/locale/ja` links no ratio table, and `composeLocale` is
 * where the two halves meet.
 *
 * **One form key.** `japanese.selectForm` returns the constant `"other"` for
 * every count and every slot: Japanese nouns do not inflect for number, and CLDR
 * agrees (`Intl.PluralRules("ja")` declares the single category `other`). A
 * table translated from `en.ts` needs no key renamed — it needs its `"one"` row
 * deleted.
 *
 * **Which units get that row is decided by ICU, and the measurement is the
 * interesting part of this file.** Japanese is unspaced, so `japanese.segment`
 * hands every letter run to `Intl.Segmenter`, and its Japanese dictionary breaks
 * some katakana compounds and not others:
 *
 * ```
 * ジュール       → ["ジュール"]              カロリー   → ["カロリー"]
 * キロジュール   → ["キロ", "ジュール"]      キロカロリー → ["キロカロリー"]
 * メガジュール   → ["メガ", "ジュール"]      ワット時   → ["ワット", "時"]
 * キロワット時   → ["キロワット時"]          メガワット時 → ["メガワット", "時"]
 * 英熱量        → ["英", "熱量"]
 * ```
 *
 * A `forms` entry the segmenter breaks is a string the printer emits and the
 * parser cannot take back — 「5キロジュール」 would reach the resolver as キロ
 * then ジュール and read as five *joules* if it read as anything — and that is
 * precisely the failure §9 exists to prevent. It is also the one
 * `assertLocaleContract` cannot catch on its own, since it consults the alias
 * index and the alias index never sees the segmenter.
 *
 * **The rule this file follows is therefore by family, not by unit: a family
 * spells itself out only when every member of it survives.** ジュール comes back
 * whole and キロジュール does not, so the joule family prints "J", "kJ" and "MJ"
 * throughout rather than 「5ジュール」 beside 「5kJ」 — one kind printing two
 * registers for one quantity is a worse reading experience than a kind printing
 * the symbol a Japanese datasheet uses anyway, and it would leave the register
 * hostage to an ICU dictionary update. カロリー and キロカロリー are the family
 * where every member does survive, so that is the family this vocabulary spells.
 *
 * The watt-hour family lands in the same place, and there `en.ts` had already
 * arrived at it for its own reason: "watt hour" is a compound English cannot
 * read back. Japanese has the same trouble with 「ワット時」 and
 * 「メガワット時」, which the table above shows ICU cutting at the 時.
 * 「キロワット時」 survives whole — Japanese uses it constantly, since
 * electricity is billed in it — so it is listed as an **alias**, where it works,
 * rather than as a form its two siblings could not match.
 *
 * What Japanese gets here that Ukrainian could not is a clean symbol for that
 * family. `uk.ts` must write "кВт·год" with the SI interpunct, which the lexer
 * reads as multiplication and which only re-reads because `* | power | duration`
 * exists; Japanese writes "kWh" as a single Latin run, so 「5kWh」 lexes as one
 * word token, is already an alias, and round-trips by lookup with no arithmetic
 * involved.
 *
 * **Symbols are the Latin SI ones**, which is Japanese and not a fallback: a
 * Japanese page writes 「1.5kJ」 and 「100kcal」 exactly as an English one does,
 * there is no kana abbreviation for any of these, and R8 forbids inventing one.
 * `btu` keeps "BTU" for the same reason and gets no Japanese alias at all — the
 * expansion 「英熱量」 is a technical gloss rather than something anyone types,
 * and ICU cuts it into 英 + 熱量 regardless.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them, then append the Japanese ones. Nobody switches
 * input mode to type a unit: 「200キロカロリー」 and "200 kcal" are the same
 * sentence and a `ja` engine has to take both.
 */
export default defineVocabulary({
  locale: "ja",
  kind: "energy",
  units: {
    // ジュール is readable and its prefixed siblings are not (ICU cuts
    // キロジュール into キロ + ジュール), so the word is an alias here and never
    // a printed form: spelling the base unit while abbreviating kilo- and mega-
    // would print two registers for one quantity.
    j: { aliases: [...alias("j"), "ジュール"], symbol: "J" },
    kj: { aliases: alias("kj"), symbol: "kJ" },
    mj: { aliases: alias("mj"), symbol: "MJ" },
    wh: { aliases: alias("wh"), symbol: "Wh" },
    // The one member of the family ICU returns whole, so it is readable — but
    // not printable, because its two siblings are not and a kind must print one
    // register throughout.
    kwh: { aliases: [...alias("kwh"), "キロワット時"], symbol: "kWh" },
    mwh: { aliases: alias("mwh"), symbol: "MWh" },
    cal: {
      aliases: [...alias("cal"), "カロリー"],
      symbol: "cal",
      forms: { other: "カロリー" },
    },
    kcal: {
      aliases: [...alias("kcal"), "キロカロリー"],
      symbol: "kcal",
      forms: { other: "キロカロリー" },
    },
    btu: { aliases: alias("btu"), symbol: "BTU" },
  },
});
