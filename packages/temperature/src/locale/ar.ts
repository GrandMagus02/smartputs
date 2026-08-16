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
 * The Arabic spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * The scale names are what a reader types when they clip the full phrase down to
 * one token, and the full phrase is always two tokens in Arabic — "٢٠ درجة
 * مئوية" is *degree* + *centigrade*, with درجة the counted noun and the scale
 * name an adjective agreeing with it. A word token ends at a space, so only the
 * scale name can ever be an alias; see the vocabulary's own comment below for
 * what that costs and why it is right.
 *
 * Hamza spellings are declared in pairs wherever one appears. `arabic`'s
 * orthographic analyzer folds أ، إ، آ and ى toward the plain alif, which means it
 * removes a hamza the user typed and can never invent one they did not — so an
 * alias written with a hamza needs its plain-alif twin beside it, or a typist who
 * does not reach for the hamza key reaches nothing.
 *
 * Two words an Arabic speaker genuinely writes are deliberately **not** here, and
 * each absence is asserted in `ar.test.ts` rather than left in a comment:
 *
 *   - **درجة** ("degree"), which is the counted noun of every temperature phrase
 *     in the language. It is also Arabic for the *angular* degree — the unit
 *     `@smartput/angle` registers — so claiming it here would make "٩٠ درجة" a
 *     temperature candidate in every composed engine, and it would be the wrong
 *     candidate for the commoner reading. The phrase it belongs to is two tokens
 *     in any case.
 *   - **the Cyrillic-style clipped symbol م**, as in "٢٠ °م", which is how an
 *     Arabic weather page sets Celsius. `parse/lex.ts` skips "°" as an
 *     unrecognized character, so that input reaches the resolver as a bare م —
 *     and م is already Arabic's abbreviation for the *metre*
 *     (`@smartput/length`), one of the one-letter symbols `@smartput/core/locale/ar`
 *     sets its suffix stripper's `minStem: 2` floor to protect. Claiming it would
 *     trade a spelling the lexer has already thrown the "°" away from for an
 *     ambiguity on the commonest unit in the library.
 */
const ARABIC: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  // مئوية is the adjective "centigrade" (feminine, agreeing with درجة); مئوي is
  // its masculine form, which is what appears when the phrase is built on a
  // masculine noun. مائوية is the same word with the unpronounced alif of مائة,
  // the orthography `ar-cardinals.ts` pairs for the numeral 100. سيلسيوس and its
  // variants transliterate the name instead, which is what a scientific text sets.
  //
  // مئوية is *also* the head of "نسبة مئوية", the noun phrase for a percentage —
  // and `@smartput/percent/locale/ar` deliberately leaves it alone for that
  // reason, claiming the one-token بالمئة instead. The word belongs here: on its
  // own, after a number, "٢٠ مئوية" is a temperature and nothing else.
  c: ["مئوية", "مئوي", "مائوية", "سيلسيوس", "سلسيوس", "سيليزيوس"],
  f: ["فهرنهايت", "فهرنهيت", "فهرنهايتية"],
  // The one countable noun of the three: a kelvin is a unit in its own right, not
  // a degree named after somebody, so Arabic forms its dual (كلفنان) and its
  // plural (كلفنات) the ordinary way and both get typed. The suffix stripper does
  // recover them, at `weight: -2`; listing them means they are read at full
  // weight rather than through a guess. كالفن and كلفين are the two other
  // transliterations of the name in current use.
  k: ["كلفن", "كالفن", "كلفين", "كلفنان", "كلفنات"],
};

/**
 * Arabic words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`,
 * `uk.ts` and `ru.ts` next door, because one package defines two kinds and a
 * `Vocabulary` names exactly one of them.
 *
 * Arabic is the hardest language shipped here, and the three reasons are worth
 * naming even in the file where two of them turn out not to bite.
 *
 * **1. Six `forms` keys, one of which is a dual — and this kind declares none of
 * them.** `arabic.selectForm` returns exactly the six CLDR categories on one axis
 * (`zero`, `one`, `two`, `few`, `many`, `other`) where English returns two, and
 * the `two` row is a real dual: a suffixed form of the noun meaning precisely two
 * of the thing, which no other language in this repo has. The `many` row is not a
 * plural either but an accusative singular with tanwīn. **No `forms` on any of the
 * six entries all the same, exactly as `en` carries none, and the decision was
 * re-taken rather than copied.** English's argument is that the written form
 * people use is the symbol; the question for Arabic is whether its six-way
 * grammar overturns that, since Arabic inflects these nouns far more than English
 * does. It does not, and for the reason `ru` gives about Russian, only more
 * strongly: **the Arabic spelled form is two tokens in every register** — درجة
 * مئوية, درجة فهرنهايت — with درجة the counted noun and the scale name an
 * adjective behind it. A word token ends at a space, so a printer emitting the
 * spelled form would be emitting a string the parser cannot read back; and the
 * six categories would inflect درجة (درجتان, درجات, درجةً), the very word this
 * vocabulary cannot claim. What Arabic writes is "٢٠ °C".
 *
 * Concretely: `arabic.selectForm` is never called for these units, because a unit
 * with no `forms` never reaches the table lookup. The six-category grammar this
 * phase exists to prove is not exercised here, and `ar.test.ts` says so rather
 * than manufacturing an assertion that looks like it is. `symbol` therefore
 * carries the entire output, which is precisely why R8 wants it explicit on all
 * six entries: the renderer's no-symbol branch joins number and unit *with* a
 * space, so a unit that forgot its symbol would silently move a byte.
 *
 * **2. The digits.** `@smartput/core/locale/ar` pins `numberFormat: { group:
 * ",", decimal: "." }` — the `latn` numbering system, transcribed rather than
 * read from `Intl`, because the engine can only *emit* Latin digits. So "٢٠"
 * does not parse, and every number in this file's tests is Latin. That is a
 * core-level gap named in `ar.ts`, not one a word list can close.
 *
 * **3. Right-to-left is not this file's problem.** A JavaScript string is in
 * *logical* order: "20 °C" holds the number first and the symbol second in memory
 * exactly as it does in English, and the Unicode Bidirectional Algorithm is what
 * arranges them on screen. **Nothing here is reversed and nothing here should
 * be.** A "fix" that swapped the order would emit the symbol before the number,
 * which `parse` reads as a unit followed by a number, and `parse(format(v)) === v`
 * breaks. `ar.test.ts` pins the order and the absence of bidi control characters.
 *
 * **The three symbols stay Latin**, and that is a decision rather than an
 * oversight. °C, °F and K are what Arabic scientific and press typography sets,
 * Latin letters included; the Arabic-lettered °م exists on weather pages, and it
 * is unreachable — `lex` throws the "°" away and leaves a bare م, which is
 * already Arabic for the metre. See `ARABIC` above.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the one
 * shared `ALIAS` map in `units.ts`, so "212 F" keeps working in an Arabic engine
 * and the micro path (`parseTemperature`) cannot drift from it. The Arabic
 * spellings are appended from the one `ARABIC` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds is
 * the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is also
 * what lets "20 C + 5 F" read its right operand as a difference. Deriving both
 * lists from the same two sources keeps them equal by construction instead of by
 * proofreading.
 *
 * Like `en`, this file names both kinds by id string and imports neither, which is
 * what lets `@smartput/temperature/locale/ar` be imported without linking the
 * ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureAr: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "ar",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...ARABIC.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...ARABIC.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...ARABIC.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "ar",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...ARABIC.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...ARABIC.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...ARABIC.k], symbol: "K" },
    },
  }),
];

export default temperatureAr;
