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
 * The Chinese spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * 摄氏 and 华氏 are the standard names and they are *phono-semantic
 * abbreviations*, exactly as the Japanese 摂氏 and 華氏 this repo already carries
 * are — the Japanese pair was borrowed from these. 摄尔修斯 and 华伦海特 were the
 * nineteenth-century transcriptions of Celsius and Fahrenheit, and 氏 is the
 * surname marker, so each name reads "the Mr. Se— scale" and "the Mr. Fa— scale".
 * That matters here for one practical reason: they are *prefixes* in ordinary
 * Chinese. A thermometer reading is 摄氏20度 — name first, 度 ("degree") after the
 * number — which is the reverse of every Latin-script convention and is why this
 * file declares no `forms` (see below). As aliases they still earn their place:
 * 「20摄氏」 is what someone types into a converter even though it is not what
 * they would write in a sentence, and without the entry there is no Chinese route
 * to these units at all.
 *
 * 摄氏度 and 华氏度 — the full unit names, degree included — are **not** listed,
 * and that is measured rather than chosen: ICU cuts both after the scale name
 * (摄氏 | 度), so an alias for either could never be produced by `chinese.segment`
 * and would be dead weight that reads as coverage. The bare scale name is what
 * survives whole, and it is what the entry has to be.
 *
 * 开 is kelvin, and it is the one entry that is a *unit noun* rather than a scale
 * name: it stands after the number the way the Latin symbol does (「300开」), so it
 * is the only one of the three that could have carried a `forms` row. It is also
 * the only Chinese route this unit has. 开尔文 is the full transliteration and ICU
 * shreds it into 开 | 尔 | 文; 开氏度 goes the same way; and both are what a
 * dictionary would offer first. The bare 开 is not a shortening invented here —
 * GB 3102 writes the Chinese name of the kelvin as 开[尔文], the brackets meaning
 * exactly that the tail is optional — so this is the standard's own abbreviation
 * and not a guess. What it costs is that 开 is also an extremely common ordinary
 * verb ("to open"), which is survivable because an alias is only ever consulted
 * in unit position: a bare 开 with no number in front of it was never going to
 * reach the alias index.
 *
 * **度 is deliberately unclaimed, and this is the one omission with teeth.** It is
 * the word for "degree" and it is what a Chinese speaker actually says —
 * 「20度」 is a temperature to anyone reading it. It is also, in exactly the same
 * spelling, `@smartput/angle`'s word for the angular degree, and the two are one
 * token with no context to separate them: a word claimed by two units of two
 * kinds is resolved by weight, but only after both kinds have been offered a
 * reading, and 「20度」 is genuinely ambiguous in Chinese too. Claiming it here
 * would make every angle in a composed Chinese engine a temperature candidate, to
 * buy a spelling that is ambiguous in the source language. This is the same call
 * `@smartput/temperature/locale/ja` makes about 度 and
 * `@smartput/temperature/locale/uk` makes about the bare Cyrillic "с", which is
 * already Ukrainian for the second.
 */
const CHINESE: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["摄氏"],
  f: ["华氏"],
  k: ["开"],
};

/**
 * Chinese words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `ja.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * `zh` is the bare tag and means what CLDR means by it: Simplified Chinese,
 * mainland conventions. 攝氏 and 華氏 are the Traditional spellings of the same
 * two words and belong to a `zh-Hant` file, not to a fork of this one.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk` and `ja` carry
 * none — and the Chinese reason is Japanese's, arrived at independently.** `en`'s
 * reason survives translation intact: what a person writes is the symbol,
 * 「20℃」, and the spelled phrase 摄氏20度 is three tokens no alias can claim.
 * Chinese adds this: a `forms` entry is printed *after* the number by
 * `renderQuantity`, and 摄氏 does not go after the number — it goes in front of
 * it. So a `forms` table here would not merely be verbose the way a Ukrainian one
 * would; it would print 「20摄氏」, a word order no Chinese text uses.
 *
 * 开 is the one word that legitimately follows a number, and it is deliberately
 * left out of `forms` too. Giving kelvin alone a table would make one unit of
 * three answer with a word — 「300开」 — while its two siblings answered with
 * symbols, and the three are the same scale family printed side by side in every
 * conversion this kind performs. A vocabulary that prints inconsistently across
 * one kind's units is worse than one that prints the symbol everywhere, and the
 * symbol is what Chinese print uses anyway.
 *
 * What that means concretely is that `chinese.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup. Under
 * Ukrainian that left an eight-key grammar unexercised; under Chinese it leaves a
 * one-key one unexercised, which is a much smaller loss, and the test says so
 * rather than manufacturing an assertion that looks like a grammar check.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six. It matters more under `zh` than under `en`:
 * `chinese.renderQuantity` closes the gap on *every* branch, so a unit that forgot
 * its symbol would degrade to the bare unit key — "20c" — rather than move a
 * space.
 *
 * The three symbols stay Latin, and that is what Chinese print uses: 「20℃」 is
 * written with U+2103, whose NFKC decomposition is `°C` — the very characters
 * this table holds. `normalize()` runs NFKC before the lexer sees a word, so
 * 「20℃」 and 「20°C」 are the same input by the time they reach the resolver, and
 * `parse/lex.ts` then skips `°` as an unrecognized character and offers the bare
 * "c" — which `units.ts` already lists. So the single most common Chinese
 * spelling of a temperature is readable without this file adding one word for it,
 * and the test pins that rather than trusting it.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the one
 * shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Chinese engine
 * and the micro path (`parseTemperature`) cannot drift from it. The Chinese
 * spellings are appended from the one `CHINESE` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds is
 * the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is also
 * what lets 「20摄氏 + 5华氏」 read its right operand as a difference. Deriving both
 * lists from the same two sources keeps them equal by construction instead of by
 * proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/zh` be imported without linking
 * the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureZh: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "zh",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...CHINESE.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...CHINESE.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...CHINESE.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "zh",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...CHINESE.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...CHINESE.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...CHINESE.k], symbol: "K" },
    },
  }),
];

export default temperatureZh;
