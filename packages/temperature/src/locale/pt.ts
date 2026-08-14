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
 * The Portuguese spellings, in one object for the same reason `units.ts` keeps
 * one `ALIAS` map: both kinds must answer to the identical words, and two
 * hand-kept lists are a place for them to drift apart.
 *
 * Portuguese adds less to this table than to any other in the phase, and the
 * reason is worth stating so the short list does not read as an unfinished one.
 * All three scales are named after people — Celsius, Fahrenheit, Kelvin — and
 * Portuguese quotes a surname rather than adapting it, exactly as Spanish does.
 * Two of the three therefore need nothing at all:
 *
 *   `fahrenheit`  spelled as the table spells it. There is no Portuguese form.
 *   `kelvin`      likewise, and its plural too: the Portuguese plural of a
 *                 loanword ending in -n is the plain "-s" ("kelvins"), which the
 *                 table already carries as the English plural. The same string
 *                 by two routes is still one alias, so adding it would only put a
 *                 duplicate in the index. This is where Portuguese and Spanish
 *                 part: Spanish declines it to "kelvines" and had to declare one.
 *
 * What Portuguese does add is the everyday name of the Celsius scale:
 *
 *   `centígrado`  "faz 30 graus centígrados" is how the temperature is spoken,
 *                 and "centígrado" is the word carrying the scale — the head noun
 *                 "grau" says only that it is a degree of something. The
 *                 accent-free "centigrado" is declared beside it because NFKC
 *                 folding leaves a precomposed í as í rather than stripping it,
 *                 so a keyboard without accents produces a different string to the
 *                 alias index.
 *
 * Both are listed with their plurals. The plural is the form a sentence actually
 * contains, and while `portuguese.analyze`'s suffix stripper would recover either
 * of them by dropping "s", it does so at `weight: -2` — a form this file knows
 * about should not arrive penalised.
 *
 * **"grau" and "graus" are deliberately not claimed**, and unlike the Spanish
 * file next door — which had to predict the collision — this one can point at it:
 * `@smartput/angle/locale/pt` claims exactly those two words for the angular
 * degree, where they are the unit's *own* name rather than a head noun waiting
 * for a scale, and prints them as its `forms`. Claiming them here would make
 * "90 graus" ambiguous between a right angle and a summer afternoon in every
 * composed engine, to buy back a reading that is incomplete anyway: "30 graus"
 * alone does not say which scale, and "30 graus centígrados" is three tokens,
 * which no alias can span. `centígrado` carries the reading on its own and costs
 * nothing.
 */
const PORTUGUESE: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["centígrado", "centígrados", "centigrado", "centigrados"],
  f: [],
  k: [],
};

/**
 * Portuguese words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts` next
 * door, because one package defines two kinds and a `Vocabulary` names exactly
 * one of them.
 *
 * Brazilian, under the bare `pt` tag, per this project's ruling. Nothing in this
 * file is a Brazil/Portugal split — both standards write "centígrado" and both
 * quote the three surnames — so the tag shows up only in the digits around the
 * words, where "," marks the decimal and "." groups the thousands.
 *
 * **No `forms` on any of the six entries, exactly as `en`, `uk` and `es` carry
 * none.** `en`'s reason is that the written form a person uses is the symbol —
 * "20°C", not "20 celsius" — and it holds here unchanged: Brazilian print writes
 * "20 °C" too, down to the Latin letters. Portuguese re-takes the decision rather
 * than inheriting it, because it has a reason of its own that Spanish only half
 * had. The noun Portuguese counts in this domain is "grau", and this vocabulary
 * cannot have it: `@smartput/angle/locale/pt` owns "grau"/"graus" and prints
 * them. So the only `forms` table that would read naturally here is one printing
 * "20 graus centígrados" — three tokens, unreadable back, and the printer's
 * spelled path only ever emits a word the parser can read. "centígrado" alone
 * would print "20 centígrados", which is a thing nobody writes; and giving `k` a
 * word form ("1 kelvin", "5 kelvins" is genuinely countable in Portuguese) while
 * `c` and `f` kept symbols would print two registers for one kind. Rule: where
 * the `en` unit decided against word forms, this file does not invent them.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six: the renderer's no-symbol branch joins number and unit
 * *with* a space, so a unit that forgot its symbol would silently move a byte.
 * The three symbols stay Latin, and Portuguese writes them exactly as `en` does —
 * tight against the number, since `pt.ts` declares no `renderQuantity` override
 * and the default sets a symbol tight.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Portuguese
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * Portuguese spellings are appended from the one `PORTUGUESE` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C + 5 F" read its right operand as a difference. Deriving
 * both lists from the same two sources keeps them equal by construction instead
 * of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/pt` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperaturePt: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "pt",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...PORTUGUESE.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...PORTUGUESE.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...PORTUGUESE.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "pt",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...PORTUGUESE.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...PORTUGUESE.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...PORTUGUESE.k], symbol: "K" },
    },
  }),
];

export default temperaturePt;
