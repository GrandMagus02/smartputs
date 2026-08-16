import { aliasesFor, defineVocabulary } from "@smartput/kind";
import { ENERGY_UNITS, type EnergyUnit } from "../units";

const alias = (unit: EnergyUnit) => aliasesFor(ENERGY_UNITS, unit);

/**
 * Korean words for the energy units.
 *
 * `ko` is the bare tag, modern standard Korean in South Korean orthography. The
 * kind next door names no language at all: ratios, unit ids, magnitude bands and
 * the four power/duration/energy signatures. This file names `energy` by **id
 * string** rather than importing the kind, so `@smartput/energy/locale/ko` links
 * no ratio table, and `composeLocale` is where the two halves meet.
 *
 * **One form key.** `korean.selectForm` returns the constant `"other"` for every
 * count and every slot: Korean marks number nowhere on a noun, and CLDR agrees
 * (`Intl.PluralRules("ko")` declares the single category `other`). A table
 * translated from `en.ts` needs no key renamed — it needs its `"one"` row
 * deleted.
 *
 * **Nothing here is decided by a segmenter, which is the whole difference from
 * `ja.ts` next door.** That file's central measurement is ICU's Japanese
 * dictionary cutting キロジュール into キロ + ジュール and メガワット時 into
 * メガワット + 時, which is what forces it onto Latin symbols for two families.
 * Korean is spaced, `korean.segment` is undefined, and `lex` has already cut at
 * every space, so every compound below arrives as one token because a Korean
 * writer wrote it as one word. The three decisions in this file are therefore
 * about *register* — which spelling a Korean text actually uses — and each is
 * argued on its own family rather than inherited from a dictionary.
 *
 * **The watt-hour family spells itself out, and this is the row Ukrainian and
 * Japanese both had to give up.** 와트시, 킬로와트시 and 메가와트시 are single
 * unspaced words, so `lex` takes each as one word token and the alias index
 * resolves it by lookup with no arithmetic involved. English cannot do this —
 * "watt hour" is two words and `en.ts` says so — and `uk.ts` must write
 * "кВт·год" with an interpunct that the lexer reads as multiplication, so its
 * round trip only closes because `* | power | duration` happens to exist.
 * Japanese has the word and ICU breaks it. Korean has the word, writes it
 * constantly — an electricity bill is denominated in 킬로와트시 — and nothing
 * stands between the word and the index. So this is the family that prints
 * Hangul, and 「1.5킬로와트시」 reads straight back in.
 *
 * **The joule family prints its SI symbols, and the reason is a homograph rather
 * than a mechanism.** 줄 is the Korean for a joule and also one of the commonest
 * nouns in the language: a line, a cord, a row, a queue. 「5줄」 is read by any
 * Korean as five *lines*, and a symbol's job under R8 is to be the spelling that
 * is unambiguous with no context around it — which "J" is and 줄 is not. That
 * settles the base unit, and the family rule this repo's vocabularies follow
 * settles the other two: a family prints one register throughout, so 킬로줄 and
 * 메가줄 are not spelled either, and "J", "kJ" and "MJ" are what a Korean physics
 * text prints anyway. All three words stay in `aliases`, where the ambiguity
 * costs nothing — recognition is many-to-one (I6) and the solver ranks the
 * candidates — and where a reader who types 「5킬로줄」 is understood.
 *
 * **The calorie family spells itself out** for the plain reason that Korean food
 * labelling does: 「한 봉지 200킬로칼로리」. No homograph, every member of the
 * family is one word, so the family prints Hangul.
 *
 * **`btu` gets no Korean word at all.** The expansion 영국열량단위 is a technical
 * gloss that appears in standards prose and nowhere a person types, and Korea
 * writes "BTU" in Latin on an air conditioner's box. R8 forbids inventing an
 * abbreviation, and printing a gloss nobody writes is the same mistake facing
 * the other way, so the unit keeps the Latin symbol and no alias beyond what
 * `units.ts` already declares.
 *
 * **Aliases** reuse the Latin spellings from `units.ts` through `aliasesFor`
 * rather than retyping them — which keeps the micro path (`parseEnergy`) and the
 * engine path agreeing by construction — and append the Korean ones. Nobody
 * switches input mode to type a unit: 「200킬로칼로리」 and "200 kcal" are the
 * same sentence and a `ko` engine has to take both.
 */
export default defineVocabulary({
  locale: "ko",
  kind: "energy",
  units: {
    // 줄 is the word and is readable; it is not printable, because it is also
    // "line" and a printed 「5줄」 would be read as five lines by everyone.
    j: { aliases: [...alias("j"), "줄"], symbol: "J" },
    kj: { aliases: [...alias("kj"), "킬로줄"], symbol: "kJ" },
    mj: { aliases: [...alias("mj"), "메가줄"], symbol: "MJ" },
    wh: {
      aliases: [...alias("wh"), "와트시"],
      symbol: "Wh",
      forms: { other: "와트시" },
    },
    kwh: {
      aliases: [...alias("kwh"), "킬로와트시"],
      symbol: "kWh",
      forms: { other: "킬로와트시" },
    },
    mwh: {
      aliases: [...alias("mwh"), "메가와트시"],
      symbol: "MWh",
      forms: { other: "메가와트시" },
    },
    cal: {
      aliases: [...alias("cal"), "칼로리"],
      symbol: "cal",
      forms: { other: "칼로리" },
    },
    kcal: {
      aliases: [...alias("kcal"), "킬로칼로리"],
      symbol: "kcal",
      forms: { other: "킬로칼로리" },
    },
    btu: { aliases: alias("btu"), symbol: "BTU" },
  },
});
