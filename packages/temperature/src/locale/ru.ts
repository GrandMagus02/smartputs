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
 * The Cyrillic spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * The three scale names are masculine nouns, listed in the cases a reader
 * actually types, because the language's suffix stripper cannot recover the
 * first of them: "цельсий" is a soft `-ий` stem, so dropping the genitive `-я`
 * from "цельсия" leaves "цельси", not "цельсий", and every other ending it takes
 * behaves the same way. A vocabulary is what the stripper falls back *from*.
 *
 * The dative is the row that matters and the row a translator porting `uk` gets
 * wrong. Russian names a scale with **по** plus the dative — "20 градусов по
 * Цельсию", "451 градус по Фаренгейту" — where Ukrainian says "за Цельсієм" with
 * the instrumental. Both languages' constructions are two tokens and therefore
 * unreadable as a unit word (see below), but the dative is also what a reader
 * types when they clip the phrase down to the scale name alone, so "цельсию" and
 * "фаренгейту" are listed rather than left to a stripper that would produce a
 * non-word from one of them.
 *
 * `кельвин` gets plural forms and the other two do not, and that asymmetry is
 * the grammar rather than an oversight: a kelvin is a countable unit, so "5
 * кельвинов" is ordinary Russian, while Celsius and Fahrenheit are read as
 * *degrees* named after a person, where it is "градус" that is counted and the
 * name stays in an oblique singular. There is no natural "20 цельсиев" to list.
 *
 * Three spellings a Russian genuinely types are deliberately absent, and the
 * test records each as a live assertion rather than leaving the gap to be
 * rediscovered:
 *
 *   - `°С`, `°Ф`, `°К` with **Cyrillic** letters — `parse/lex.ts` skips `°` as an
 *     unrecognized character, so these reach the resolver as a bare "с", "ф",
 *     "к", and the alias with the degree sign on it can never be produced.
 *     `units.ts` carries the Latin `°c`/`°f`/`°k` for the micro path, which reads
 *     that map directly; a Cyrillic copy would be live on neither path.
 *   - the bare Cyrillic `с` those spellings degrade to, which is already the
 *     Russian symbol for the **second** (`@smartput/duration` registers it).
 *     Claiming it here would make "20 с" — which any Russian reads as twenty
 *     seconds — a temperature candidate in every composed engine, to buy back a
 *     spelling the lexer has already thrown the `°` away from.
 *   - "градус Цельсия" and "по Фаренгейту" — two tokens, and a word token ends
 *     at a space, so no alias can claim them. That is P5's `compoundSplitter`.
 *
 * The three Latin symbols stay Latin: `°C`, `°F` and `K` are what Russian print
 * uses, down to the Latin letters, and the Cyrillic `°С` above is a homoglyph of
 * it rather than a different notation.
 */
const CYRILLIC: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["цельсий", "цельсия", "цельсию", "цельсием", "цельсии"],
  f: ["фаренгейт", "фаренгейта", "фаренгейту", "фаренгейтом", "фаренгейте"],
  k: [
    "кельвин",
    "кельвина",
    "кельвину",
    "кельвины",
    "кельвинов",
    "кельвине",
    "кельвином",
    "кельвинам",
    "кельвинах",
    "кельвинами",
  ],
};

/**
 * Russian words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts` and
 * `uk.ts` next door, because one package defines two kinds and a `Vocabulary`
 * names exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en` carries none, and the
 * decision was re-taken rather than copied.** English's argument is that the
 * written form people use is the symbol; the question for Russian is whether the
 * spelled form is different enough to overturn it, since Russian declines these
 * nouns and English does not. It is not, and for a reason stronger than
 * English's: the Russian spelled form is *two* tokens in every register — "20
 * градусов Цельсия", "20 градусов по Цельсию" — with the counted noun being
 * "градус" and the scale name sitting in an oblique case behind it. A word token
 * ends at a space, so the printer would be emitting a form the parser cannot read
 * back, and the one-token clipping ("20 цельсия") is not something a Russian
 * writes. What people write is "20 °C".
 *
 * What that means concretely is that `russian.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup — so the
 * two-axis grammar this phase exists to prove is not exercised here, and the test
 * says so rather than manufacturing an assertion that looks like it is. `symbol`
 * therefore carries the entire output, which is precisely why R8 wants it
 * explicit on all six: the renderer's no-symbol branch joins number and unit
 * *with* a space, so a unit that forgot its symbol would silently move a byte.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Russian
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * Cyrillic spellings are appended from the one `CYRILLIC` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C + 5 F" read its right operand as a difference. Deriving
 * both lists from the same two sources keeps them equal by construction instead
 * of by proofreading.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which
 * is what lets `@smartput/temperature/locale/ru` be imported without linking the
 * ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureRu: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "ru",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...CYRILLIC.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...CYRILLIC.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...CYRILLIC.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "ru",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...CYRILLIC.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...CYRILLIC.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...CYRILLIC.k], symbol: "K" },
    },
  }),
];

export default temperatureRu;
