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
 * The Dutch spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * There is exactly one thing Dutch adds to the Latin table, and it is a
 * **compound**: *celsiusgraad* and *fahrenheitgraad* are single words in Dutch
 * where English writes "degree Celsius" as two. That is the shape of Dutch this
 * package has to carry, and it is the shape `compoundSplitter` exists for.
 *
 * **Here Dutch and German part company, and the reason is a vowel.**
 * `@smartput/core/locale/de` leaves `grad` out of `COMPOUND_HEADS` because
 * `-grad` also ends *Belgrad* and *Leningrad*; `@smartput/core/locale/nl` puts
 * `graad` and `graden` **in**, because Dutch writes the unit with a long vowel
 * and those place names without one, so the collision German is avoiding cannot
 * occur. The head list's doc comment says as much, and notes the one thing it does
 * cost — *breedtegraad* and *lengtegraad*, latitude and longitude, which are
 * degrees of arc, so reading them as degrees is very nearly right.
 *
 * So the splitter *does* reach inside these two compounds here where it could not
 * in German — and it lands on `graad`, which is `@smartput/angle`'s word in this
 * language and never this package's. That is precisely why both compounds are
 * enumerated below rather than left to morphology: an exact alias is offered at
 * weight 0 and the split at `compoundSplitter`'s -3, so the enumerated entry is
 * what makes "20 celsiusgraad" a temperature in an engine that also speaks
 * `@smartput/angle/locale/nl` instead of an angle of twenty degrees. The division
 * of labour is the head list's own: morphology in the language, words in the
 * vocabulary.
 *
 * **Both the singular and the plural are listed, which is where Dutch costs more
 * than German.** `de.ts` next door lists only the nominative singular and proves
 * through the engine that its stripper reaches every other ending. Dutch's
 * stripper deliberately does **not** strip `en` — `nl.ts` explains why at length:
 * the main Dutch plural shortens an open syllable (*graad* → *graden*, *jaar* →
 * *jaren*) or doubles a consonant, so stripping `en` yields *grad*, a stem that is
 * not the singular in exactly the cases the rule would be needed for. *Graden* is
 * that case exactly. So `celsiusgraden` is a word this file declares rather than a
 * word it hopes for.
 *
 * **There is no *kelvingraad*, and that is grammar rather than an omission.** The
 * kelvin is not a degree — SI dropped "degree Kelvin" in 1967 and Dutch dropped
 * *graad Kelvin* with it — so `k` adds nothing beyond what the Latin table already
 * carries, where "kelvin" and its plural "kelvins" are both listed.
 *
 * **"Graad" alone is deliberately not claimed**, though "20 graden" is what a
 * Dutch speaker actually says when the scale is obvious. The word is
 * `@smartput/angle`'s in this language: *graad* is the angular degree too, and "45
 * graden" is at least as often a slope as a temperature. Two kinds claiming one
 * word is ordinary and is resolved by weight and by which kinds an engine
 * installed — that is how "pond" is both a mass and a pound sterling — but here
 * there is no context either kind could offer, so a bare "graad" would be a coin
 * toss dressed as a reading. The Dutch speaker who means a temperature writes
 * "graden Celsius", which is two tokens and therefore no alias at all, or writes
 * "°C", which is.
 */
const DUTCH: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["celsiusgraad", "celsiusgraden"],
  f: ["fahrenheitgraad", "fahrenheitgraden"],
  k: [],
};

/**
 * Dutch words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `de.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk` and `de` carry
 * none — and `en`'s reasoning holds here without amendment.** That reasoning is
 * that the written form of this unit is the symbol, and that the spelled phrase is
 * a phrase: "20 graden Celsius" is two word tokens, `lex` ends a word token at a
 * space, and no alias can claim it and no analyzer can reassemble it. Dutch does
 * not rescue that the way it might have looked like it would — the compound
 * *celsiusgraad* exists and is listed above, but it is what a reader **types**,
 * not what a Dutch text **writes**: running Dutch prose says "het is 20 graden
 * Celsius", and printing the closed-up compound at a reader would be answering in
 * a spelling nobody uses. Rule 5 cuts the other way here too — a form that is
 * printed must be a form that is read, and the safe direction when the two
 * disagree is to print the symbol.
 *
 * What Dutch adds to `en`'s argument is the same thing German added: the symbol it
 * writes is "20 °C" *with a space*, following SI, and that is exactly what comes
 * out, because `dutch.renderQuantity` overrides the default template — written for
 * English's tight "20°C" — to space a symbol off from its number. So the one thing
 * a `forms` table could have bought here, output that looks like Dutch rather than
 * like English, the language has already bought.
 *
 * What that means concretely is that `dutch.selectForm` is never called for these
 * units — a unit with no `forms` never reaches the table lookup — so this package
 * exercises none of the grammar, and the test says so rather than manufacturing an
 * assertion that looks like it does. `symbol` therefore carries the entire output,
 * which is precisely why R8 wants it explicit on all six.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the one
 * shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Dutch engine and
 * the micro path (`parseTemperature`) cannot drift from it. It is also why this
 * file is short where the Ukrainian one is long — Dutch shares the Latin alphabet
 * and spells "celsius", "fahrenheit" and "kelvin" exactly as that table already
 * does, so a Dutch reader can type every one of them already, and only what Dutch
 * spells *differently* earns a line.
 *
 * **And unlike `de.ts`, nothing here is capitalised.** Dutch capitalises no noun,
 * so *celsiusgraad* is lowercase in running text, in a search box and in a printed
 * result alike; German's `Celsiusgrad` is the same word with a capital that the
 * alias index has to fold away. It is the one German stress this language does not
 * share, and the reason the aliases below need no case note at all.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds is
 * the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is also
 * what lets "20 C + 5 F" read its right operand as a difference. Deriving both
 * lists from the same two sources keeps them equal by construction instead of by
 * proofreading.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which is
 * what lets `@smartput/temperature/locale/nl` be imported without linking the ratio
 * tables. `composeLocale` is where the two halves meet.
 */
const temperatureNl: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "nl",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...DUTCH.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...DUTCH.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...DUTCH.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "nl",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...DUTCH.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...DUTCH.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...DUTCH.k], symbol: "K" },
    },
  }),
];

export default temperatureNl;
