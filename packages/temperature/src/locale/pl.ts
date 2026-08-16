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
 * The Polish spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * The three scale names are masculine nouns and they are listed in the cases a
 * reader actually types, not in a paradigm for its own sake. Two of them carry a
 * consonant alternation the language's suffix stripper cannot undo, which is the
 * whole argument for writing the cells out:
 *
 *   - `Fahrenheit` takes t→c before the locative -e and comes out
 *     **"fahrenheicie"** ("w Fahrenheicie"). Stripping "ie" leaves "fahrenhe",
 *     which is in no index at all.
 *   - `Celsjusz` is a -sz stem, so its locative is "w Celsjuszu" with -u, and
 *     stripping the "u" happens to work — it is listed anyway, because a form a
 *     reader is expected to type should be an entry rather than a guess at
 *     `weight: -2`.
 *
 * `kelwin` gets plural forms and the other two do not, and that asymmetry is the
 * grammar rather than an oversight: a kelvin is a countable unit, so "5
 * kelwinów" is ordinary Polish, while Celsius and Fahrenheit are read as
 * *degrees* named after a person — "20 stopni Celsjusza" — where it is "stopień"
 * that is counted and the name stays in the genitive singular. There is no
 * natural "20 celsjuszów" to list.
 *
 * "stopień" itself is deliberately not claimed by either scale, and that is the
 * Polish-specific version of a decision every language in this phase has to
 * take. It is the counted noun of both constructions at once — "20 stopni
 * Celsjusza" and "20 stopni Fahrenheita" — so giving it to `c` would make a bare
 * "20 stopni" a Celsius reading, and giving it to neither is the only answer
 * that is not a guess. It is also `@smartput/angle`'s word in this language, so
 * the collision is across kinds as well as within this one.
 *
 * Two spellings a Pole genuinely writes are absent for reasons that are the
 * lexer's rather than this file's, and `pl.test.ts` records each as a live
 * assertion rather than leaving the gap to be rediscovered:
 *
 *   - "stopień Celsjusza", "stopnie Fahrenheita" — two tokens, and a word token
 *     ends at a space, so no alias can claim them. That is P5's
 *     `compoundSplitter`, not a missing word.
 *   - "°C" as typed with the degree sign is *not* absent, and that is worth
 *     saying beside them: `parse/lex.ts` skips "°" as an unrecognized character,
 *     so "20 °C" reaches the resolver as a bare "C" — which is an alias, in Latin
 *     script, in this language as in English. Polish sets the degree sign the
 *     same way English does, so unlike `ru` there is no homoglyph problem to
 *     work around here.
 */
const POLISH: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["celsjusz", "celsjusza", "celsjuszowi", "celsjuszem", "celsjuszu"],
  f: ["fahrenheit", "fahrenheita", "fahrenheitowi", "fahrenheitem", "fahrenheicie"],
  k: [
    "kelwin",
    "kelwina",
    "kelwinowi",
    "kelwinem",
    "kelwinie",
    "kelwiny",
    "kelwinów",
    "kelwinom",
    "kelwinach",
    "kelwinami",
  ],
};

/**
 * Polish words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `ru.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en` carries none, and the
 * decision was re-taken rather than copied.** English's argument is that the
 * written form people use is the symbol; the question for Polish is whether the
 * spelled form is different enough to overturn it, since Polish declines these
 * nouns across eight `selectForm` keys and English inflects nothing. It is not,
 * and for a reason stronger than English's: the Polish spelled form is *two*
 * tokens in every register — "20 stopni Celsjusza", "451 stopni Fahrenheita" —
 * with the counted noun being "stopień" and the scale name sitting in the
 * genitive behind it. A word token ends at a space, so the printer would be
 * emitting a form the parser cannot read back, and the one-token clipping ("20
 * celsjusza") is something a reader types but not something a result line
 * writes. What Polish writes is "20 °C".
 *
 * What that means concretely is that `polish.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup — so the
 * two-axis grammar this phase exists to prove is not exercised here, and the
 * test says so rather than manufacturing an assertion that looks like it is.
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six.
 *
 * The one place Polish does move the output is the separator, and it moves it
 * *towards* correctness: `polish.renderQuantity` sets a symbol off from its
 * number by a space, so this engine prints "20 °C" where an English one prints
 * "20°C". That is PN-EN ISO 80000, and for a degree symbol it is the notation
 * the standard is most often quoted about. It belongs to the language rather
 * than to this file, which has no say in the separator at all.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Polish
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * Polish spellings are appended from the one `POLISH` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C + 5 F" read its right operand as a difference. Deriving
 * both lists from the same two sources keeps them equal by construction instead
 * of by proofreading.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which
 * is what lets `@smartput/temperature/locale/pl` be imported without linking the
 * ratio tables. `composeLocale` is where the two halves meet.
 */
const temperaturePl: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "pl",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...POLISH.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...POLISH.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...POLISH.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "pl",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...POLISH.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...POLISH.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...POLISH.k], symbol: "K" },
    },
  }),
];

export default temperaturePl;
