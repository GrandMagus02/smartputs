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
 * The three scale names are masculine nouns and are listed in the cases a reader
 * actually types, because the language's suffix stripper cannot recover any of
 * them. `цельсій` is a soft `-ій` stem: dropping the genitive `-я` from
 * "цельсія" leaves "цельсі", not "цельсій", and the same is true of every other
 * ending it takes. A vocabulary is what the stripper falls back *from*.
 *
 * `кельвін` gets plural forms and the other two do not, and that asymmetry is
 * the grammar rather than an oversight: a kelvin is a countable unit, so
 * "5 кельвінів" is ordinary Ukrainian, while Celsius and Fahrenheit are read as
 * *degrees* named after a person — "20 градусів за Цельсієм" — where it is
 * "градус" that is counted and "Цельсій" stays in an oblique singular. There is
 * no natural "20 цельсіїв" to list.
 *
 * Three spellings a Ukrainian genuinely types are deliberately absent, and the
 * test records each as a live assertion rather than leaving the gap to be
 * rediscovered:
 *
 *   - `°С`, `°Ф`, `°К` with **Cyrillic** letters — `parse/lex.ts` skips `°` as
 *     an unrecognized character, so these reach the resolver as a bare "с",
 *     "ф", "к", and the alias with the degree sign on it can never be produced.
 *     `units.ts` carries the Latin `°c`/`°f`/`°k` for the micro path, which
 *     reads that map directly; a Cyrillic copy would be live on neither path.
 *   - the bare Cyrillic `с` those spellings degrade to, which is already the
 *     Ukrainian symbol for the **second** (`@smartput/duration` registers it).
 *     Claiming it here would make "20 с" — which any Ukrainian reads as twenty
 *     seconds — a temperature candidate in every composed engine, to buy back a
 *     spelling the lexer has already thrown the `°` away from.
 *   - "градус Цельсія" and "за Фаренгейтом" — two tokens, and a word token ends
 *     at a space, so no alias can claim them. That is P5's `compoundSplitter`.
 *
 * The three Latin symbols stay Latin: `°C`, `°F` and `K` are what Ukrainian
 * print uses, down to the Latin letters, and the Cyrillic `°С` above is a
 * homoglyph of it rather than a different notation.
 */
const CYRILLIC: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["цельсій", "цельсія", "цельсію", "цельсієм", "цельсії"],
  f: ["фаренгейт", "фаренгейта", "фаренгейту", "фаренгейтом", "фаренгейті"],
  k: [
    "кельвін",
    "кельвіна",
    "кельвіну",
    "кельвіни",
    "кельвінів",
    "кельвіні",
    "кельвіном",
    "кельвінам",
    "кельвінах",
    "кельвінами",
  ],
};

/**
 * Ukrainian words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`
 * next door, because one package defines two kinds and a `Vocabulary` names
 * exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en` carries none.** This
 * is the one kind in the built-in set where the decision costs Ukrainian
 * nothing to make: what a person writes is the symbol — "20°C", not "20 градусів
 * за Цельсієм" — and the spelled phrase does not parse, because a word token
 * ends at a space and the analyzers have no route from a two-token unit back to
 * an alias. The printer's spelled path only ever emits a word the parser can
 * read back, so a `forms` table here would hand completion text that fails to
 * evaluate. Adding eight keys per unit to say what English decided not to say
 * would be inventing grammar, not translating it: the eight-key contract exists
 * for the units a language declines, and these three it abbreviates instead.
 *
 * What that means concretely is that `ukrainian.selectForm` is never called for
 * these units — a unit with no `forms` never reaches the table lookup — so the
 * two-axis grammar this phase exists to prove is not exercised here, and the
 * test says so rather than manufacturing an assertion that looks like it is.
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six: the renderer's no-symbol branch joins number and unit
 * *with* a space, so a unit that forgot its symbol would silently move a byte.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Ukrainian
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
 * is what lets `@smartput/temperature/locale/uk` be imported without linking the
 * ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureUk: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "uk",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...CYRILLIC.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...CYRILLIC.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...CYRILLIC.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "uk",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...CYRILLIC.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...CYRILLIC.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...CYRILLIC.k], symbol: "K" },
    },
  }),
];

export default temperatureUk;
