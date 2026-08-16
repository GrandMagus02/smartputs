import { aliasesFor, defineVocabulary, type Vocabulary } from "@smartput/kind";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * The Japanese spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * 摂氏 and 華氏 are the standard names and they are *phono-semantic
 * abbreviations*: 摂爾修 and 華倫海 were the nineteenth-century kanji
 * transcriptions of Celsius and Fahrenheit, and 氏 is the honorific "Mr." — so
 * each name literally reads "Mr. Se(lsius)" and "Mr. Fa(hrenheit)". That is worth
 * knowing here for one practical reason: they are *prefixes* in ordinary
 * Japanese. A thermometer reading is 摂氏20度, name first and 度 ("degree") after
 * the number, which is the reverse of every Latin-script convention and is why
 * this file declares no `forms` (see below). As aliases they still earn their
 * place — 「20摂氏」 is what someone types into a converter even though it is not
 * what they would write in a sentence, and without the entry there is no Japanese
 * route to these units at all.
 *
 * セルシウス is the katakana transcription used in the formal SI name
 * セルシウス度, and it is listed beside 摂氏 because a scientific text writes it.
 * **Its Fahrenheit counterpart is not listed, and that is measured rather than
 * chosen**: ICU cuts ファーレンハイト into ファーレン | ハイ | ト, so an alias for it
 * could never be produced by `japanese.segment` and would be dead weight that
 * reads as coverage. 華氏 is whole, and is what a Japanese reader writes anyway.
 *
 * ケルビン is the katakana loan and the only name kelvin has in Japanese; unlike
 * the other two it is a countable unit noun rather than a scale name, and it is
 * written *after* the number the way the Latin symbol is. 絶対温度 ("absolute
 * temperature") is the concept and not the unit, so it is not here.
 *
 * **度 is deliberately unclaimed, and this is the one omission with teeth.** It
 * is the word for "degree" and it is what a Japanese speaker actually says —
 * 「20度」 is a temperature to anyone reading it. It is also, in exactly the same
 * spelling, `@smartput/angle`'s word for the angular degree, and the two are one
 * token with no context to separate them: a word claimed by two units of two
 * kinds is resolved by weight, but only after both kinds have been offered a
 * reading, and "20度" is genuinely ambiguous in Japanese too. Claiming it here
 * would make every angle in a composed Japanese engine a temperature candidate,
 * to buy a spelling that is ambiguous in the source language. This is the same
 * call `@smartput/temperature/locale/uk` makes about the bare Cyrillic "с",
 * which is already Ukrainian for the second.
 */
const JAPANESE: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["摂氏", "セルシウス"],
  f: ["華氏"],
  k: ["ケルビン"],
};

/**
 * Japanese words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts` and
 * `uk.ts` next door, because one package defines two kinds and a `Vocabulary`
 * names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en` and `uk` carry none —
 * and Japanese has a second, sharper reason of its own.** `en`'s reason survives
 * translation intact: what a person writes is the symbol, 「20℃」, and the spelled
 * phrase 摂氏20度 is three tokens that no alias can claim. Japanese adds this: a
 * `forms` entry is printed *after* the number by `renderQuantity`, and 摂氏 does
 * not go after the number. It goes in front of it. So a `forms` table here would
 * not merely be verbose the way a Ukrainian one would — it would print
 * 「20摂氏」, a word order no Japanese text uses, in a language whose whole unit
 * grammar this phase is trying to get right. The one word that legitimately
 * follows a number is 度, and 度 is the word this file cannot claim (see above).
 *
 * What that means concretely is that `japanese.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup. Under
 * Ukrainian that left an eight-key grammar unexercised; under Japanese it leaves
 * a one-key one unexercised, which is a much smaller loss and the test says so
 * rather than manufacturing an assertion that looks like a grammar check.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six. It matters more under `ja` than under either sibling:
 * `japanese.renderQuantity` closes the gap on *every* branch, so a unit that
 * forgot its symbol would degrade to the bare unit key — "20c" — rather than
 * move a space.
 *
 * The three symbols stay Latin, and that is what Japanese print uses: 「20℃」 is
 * written with U+2103, whose NFKC decomposition is `°C` — the very characters
 * this table holds. `normalize()` runs NFKC before the lexer sees a word, so
 * 「20℃」 and 「20°C」 are the same input by the time they reach the resolver, and
 * `parse/lex.ts` then skips `°` as an unrecognized character and offers the bare
 * "c" — which `units.ts` already lists. So the single most common Japanese
 * spelling of a temperature is readable without this file adding one word for it,
 * and the test pins that rather than trusting it.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Japanese
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * Japanese spellings are appended from the one `JAPANESE` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets 「20摂氏 + 5華氏」 read its right operand as a difference.
 * Deriving both lists from the same two sources keeps them equal by construction
 * instead of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/ja` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureJa: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "ja",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...JAPANESE.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...JAPANESE.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...JAPANESE.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "ja",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...JAPANESE.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...JAPANESE.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...JAPANESE.k], symbol: "K" },
    },
  }),
];

export default temperatureJa;
