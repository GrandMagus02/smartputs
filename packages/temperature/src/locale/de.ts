import { aliasesFor } from "@smartput/kind/aliases";
import type { Vocabulary } from "@smartput/kind/types";
import { defineVocabulary } from "@smartput/kind/vocabulary";
import {
  TEMPDELTA_UNITS,
  TEMPERATURE_UNITS,
  type TempDeltaUnit,
  type TemperatureUnit,
} from "../units";

const alias = (unit: TemperatureUnit) => aliasesFor(TEMPERATURE_UNITS, unit);
const deltaAlias = (unit: TempDeltaUnit) => aliasesFor(TEMPDELTA_UNITS, unit);

/**
 * The German spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * There is exactly one thing German adds to the Latin table, and it is a
 * **compound**: *Celsiusgrad* and *Fahrenheitgrad* are single words in German
 * (Duden: der Celsiusgrad, Genitiv -[e]s, Plural -e) where English writes
 * "degree Celsius" as two. That is the shape of German this package has to
 * carry, and it is the shape `compoundSplitter` exists for — except that the
 * splitter cannot help here, deliberately: `@smartput/core/locale/de` leaves
 * `grad` out of `COMPOUND_HEADS` on purpose, because `-grad` also ends *Belgrad*
 * and *Leningrad* and because German writes the free noun ("Grad Celsius") far
 * more often than it compounds. So the two compounds that do exist are
 * enumerated here, which is exactly the division of labour the head list's own
 * doc comment describes: morphology in the language, words in the vocabulary.
 *
 * Only the nominative singular of each is listed, and the rest is measured
 * rather than assumed. `german.analyze`'s suffix stripper takes off `-e`, `-en`,
 * `-n` and `-s` above a three-letter stem, which is every ending these two
 * nouns take: *Celsiusgrade* (plural), *Celsiusgraden* (dative plural) and
 * *Celsiusgrads* (genitive singular) all reduce to the listed word. Repeating
 * them would buy four alias-index slots and nothing else; `de.test.ts` reads
 * each of them through the engine to prove the stripper really does reach them.
 *
 * **There is no *Kelvingrad*, and that is grammar rather than an omission.** The
 * kelvin is not a degree — SI dropped "degree Kelvin" in 1967 and German dropped
 * *Grad Kelvin* with it — so `k` adds nothing beyond what the Latin table
 * already carries, where "kelvin" and its plural "kelvins" are both listed.
 *
 * **"Grad" alone is deliberately not claimed**, though "20 Grad" is what a
 * German actually says when the scale is obvious. The word is
 * `@smartput/angle`'s in this language: *Grad* is the angular degree too, and
 * "45 Grad" is at least as often a slope as a temperature. Two kinds claiming
 * one word is ordinary and is resolved by weight and by which kinds an engine
 * installed — that is how "фунт" is both a pound and a Ukrainian pound sterling
 * — but here there is no context either kind could offer, so a bare "Grad"
 * would be a coin toss dressed as a reading. The German who means a temperature
 * writes "Grad Celsius", which is two tokens and therefore no alias at all, or
 * writes "°C", which is.
 */
const GERMAN: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["celsiusgrad"],
  f: ["fahrenheitgrad"],
  k: [],
};

/**
 * German words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts` and
 * `uk.ts` next door, because one package defines two kinds and a `Vocabulary`
 * names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en` and `uk` carry none —
 * and under German the decision is more clearly right than it was under either.**
 * The reasoning it inherits is that the written form of this unit is the symbol
 * and that the spelled phrase ("20 Grad Celsius") is two tokens, which no alias
 * can claim and no analyzer can reassemble. What German adds is the other half:
 * the symbol German writes is "20 °C" *with a space*, per DIN 1301-1 and the SI
 * convention, and that is exactly what comes out, because
 * `german.renderQuantity` overrides the default template — written for English's
 * tight "20°C" — to space a symbol off from its number. So the one thing a
 * `forms` table could have bought here, output that looks like German rather
 * than like English, the language has already bought, in the notation a German
 * reader expects. Inventing four keys per unit to say what English decided not
 * to say would be inventing grammar, not translating it.
 *
 * What that means concretely is that `german.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup — so the
 * case × number grammar this phase exists to prove is not exercised here, and
 * the test says so rather than manufacturing an assertion that looks like it is.
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a German
 * engine and the micro path (`parseTemperature`) cannot drift from it. It is
 * also why this file is short where the Ukrainian one is long — German shares
 * the Latin alphabet and spells "Celsius", "Fahrenheit" and "Kelvin" exactly as
 * that table already does, so a German reader can type every one of them
 * already, and only what German spells *differently* earns a line.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C + 5 F" read its right operand as a difference. Deriving
 * both lists from the same two sources keeps them equal by construction instead
 * of by proofreading.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which
 * is what lets `@smartput/temperature/locale/de` be imported without linking the
 * ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureDe: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "de",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...GERMAN.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...GERMAN.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...GERMAN.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "de",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...GERMAN.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...GERMAN.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...GERMAN.k], symbol: "K" },
    },
  }),
];

export default temperatureDe;
