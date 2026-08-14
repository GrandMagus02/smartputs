import { aliasesFor, defineVocabulary, type Vocabulary } from "@smartput/core";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * The Korean spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * 섭씨 and 화씨 are the standard names and they are the *same words* Japanese
 * writes as 摂氏 and 華氏, read with Sino-Korean pronunciations — 攝氏 and 華氏,
 * nineteenth-century Chinese phono-semantic abbreviations in which 攝 and 華
 * transcribe the first syllable of Celsius and Fahrenheit and 氏 is the
 * honorific "Mr.". Each name therefore reads, literally, "Mr. Se(lsius)" and
 * "Mr. Fa(hrenheit)". That shared history matters here for one practical reason:
 * they inherit the shared *syntax* too. A Korean thermometer reading is
 * 섭씨 20도 — the scale name first, 도 ("degree") after the number — which is the
 * reverse of every Latin-script convention and is why this file declares no
 * `forms` (see below). As aliases they still earn their place: 「20섭씨」 is what
 * someone types into a converter even though it is not what they would write in
 * a sentence, and without the entry there is no Korean route to these units at
 * all.
 *
 * 켈빈 is the transcription of Kelvin and the only name the unit has in Korean.
 * Unlike the other two it is a countable unit noun rather than a scale name, and
 * it is written *after* the number exactly as the Latin symbol is — 「300켈빈」 —
 * so it is the one entry here whose ordinary word order the renderer could
 * actually reproduce. It does not get `forms` of its own, because a table
 * covering one of three units would print a word for kelvin and a symbol for the
 * two scales anybody actually uses. 절대온도 ("absolute temperature") is the
 * concept and not the unit, so it is not here.
 *
 * **What this table did *not* have to check is the one thing `ja` had to check
 * for every entry.** Japanese had to run each candidate through
 * `Intl.Segmenter` before writing it down, and lost ファーレンハイト because ICU
 * cut it into three. Korean is spaced, so `lex` has already cut at every space
 * and `defaultSegment` hands a Hangul run straight back: any single Korean word
 * is listable, and the constraint on this table is the *space*, not a
 * dictionary. Nothing here is two words, so nothing here is at risk — but a
 * translator adding 화씨온도 or a two-word qualifier should know which of the two
 * limits applies to this language.
 *
 * **도 is deliberately unclaimed, and this is the one omission with teeth.** It
 * is the word for "degree", it is what a Korean speaker actually says, and
 * 「20도」 is a temperature to anyone reading it. It is also, in exactly the same
 * spelling, `@smartput/angle`'s word for the angular degree, and the two are one
 * token with no context to separate them: a word claimed by two units of two
 * kinds is resolved by weight, but only after both kinds have been offered a
 * reading, and 「20도」 is genuinely ambiguous in Korean too. Claiming it here
 * would make every angle in a composed Korean engine a temperature candidate, to
 * buy a spelling that is ambiguous in the source language. This is the same call
 * `ja` makes about 度 and `uk` makes about the bare Cyrillic "с", which is
 * already Ukrainian for the second.
 */
const KOREAN: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["섭씨"],
  f: ["화씨"],
  k: ["켈빈"],
};

/**
 * Korean words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `ja.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk` and `ja` carry
 * none — and Korean has the same second, sharper reason Japanese has.** `en`'s
 * reason survives translation intact: what a person writes is the symbol,
 * 「20℃」, and the spelled phrase 섭씨 20도 is two words with the number wedged
 * between them, which no alias can claim. Korean adds this: a `forms` entry is
 * printed *after* the number by `renderQuantity`, and 섭씨 does not go after the
 * number. It goes in front of it. So a `forms` table here would not merely be
 * verbose the way a Ukrainian one would — it would print 「20섭씨」, a word order
 * no Korean text uses, in a language whose whole unit grammar this phase is
 * trying to get right. The one word that legitimately follows a number is 도, and
 * 도 is the word this file cannot claim (see above).
 *
 * What that means concretely is that `korean.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup. Under
 * Ukrainian that left an eight-key grammar unexercised; under Korean it leaves a
 * one-key one unexercised, which is a much smaller loss, and the test says so
 * rather than manufacturing an assertion that looks like a grammar check.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six. It matters more under `ko` than under `en` or `uk`:
 * `korean.renderQuantity` closes the gap on *every* branch, so a unit that forgot
 * its symbol would degrade to the bare unit key — "20c" — rather than move a
 * space.
 *
 * The three symbols stay Latin, and that is what Korean print uses: 「20℃」 is
 * written with U+2103, whose NFKC decomposition is `°C` — the very characters
 * this table holds. `normalize()` runs NFKC before the lexer sees a word, so
 * 「20℃」 and 「20°C」 are the same input by the time they reach the resolver, and
 * `parse/lex.ts` then skips `°` as an unrecognized character and offers the bare
 * "c" — which `units.ts` already lists. So the single most common Korean spelling
 * of a temperature is readable without this file adding one word for it, and the
 * test pins that rather than trusting it.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Korean
 * engine and the micro path (`parseTemperature`) cannot drift from it. The Korean
 * spellings are appended from the one `KOREAN` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets 「20섭씨 더하기 5화씨」 read its right operand as a difference.
 * Deriving both lists from the same two sources keeps them equal by construction
 * instead of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/ko` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureKo: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "ko",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...KOREAN.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...KOREAN.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...KOREAN.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "ko",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...KOREAN.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...KOREAN.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...KOREAN.k], symbol: "K" },
    },
  }),
];

export default temperatureKo;
