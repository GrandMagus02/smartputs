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
 * The Spanish spellings, in one object for the same reason `units.ts` keeps one
 * `ALIAS` map: both kinds must answer to the identical words, and two hand-kept
 * lists are a place for them to drift apart.
 *
 * Three of the five words the table already carries need nothing from Spanish —
 * "celsius", "fahrenheit" and "kelvin" are spelled exactly as they are in
 * English, because all three are surnames and Spanish quotes a surname rather
 * than translating it. What Spanish adds is what it does to them afterwards:
 *
 *   `centígrado`  the everyday name of the Celsius scale, and much commoner in
 *                 speech than "celsius" is — "hace 30 grados centígrados". The
 *                 accent-free "centigrado" is declared beside it because NFKC
 *                 folding leaves a precomposed í as í rather than stripping it,
 *                 so a keyboard without accents produces a different string.
 *   `kelvines`    the Spanish plural. Kelvin is the one scale here that is a
 *                 countable noun in Spanish ("5 kelvines"), and the plural of a
 *                 word ending in -n takes -es. The suffix stripper does reach it
 *                 — dropping "es" leaves "kelvin" — but at `weight: -2`, and a
 *                 form this file knows about should not arrive penalised. The
 *                 table's own English "kelvins" stays, since recognition is
 *                 many-to-one.
 *
 * **"grado" and "grados" are deliberately not claimed**, and that is the one
 * decision in this file worth arguing. They are the words a Spanish speaker
 * says out loud for a temperature — but "grado" is also `@smartput/angle`'s
 * Spanish word for the angular degree, where it is the unit's *own* name rather
 * than a head noun waiting for a scale. Claiming it here would make "90 grados"
 * ambiguous between a right angle and a summer afternoon in every composed
 * engine, to buy back a reading that is incomplete anyway: "30 grados" alone
 * does not say which scale, and "30 grados centígrados" is three tokens, which
 * no alias can span. `centígrado` carries the reading on its own and costs
 * nothing.
 */
const SPANISH: Readonly<Record<TemperatureUnit, readonly string[]>> = {
  c: ["centígrado", "centígrados", "centigrado", "centigrados"],
  f: [],
  k: ["kelvines"],
};

/**
 * Spanish words for the two temperature kinds — the absolute reading and the
 * difference between readings. One file, two vocabularies, mirroring `en.ts`
 * next door, because one package defines two kinds and a `Vocabulary` names
 * exactly one of them.
 *
 * **No `forms` on any of the six entries, exactly as `en` and `uk` carry none.**
 * `en`'s reason is that the written form a person uses is the symbol — "20°C",
 * not "20 celsius" — and it holds here unchanged: Spanish print writes "20 °C"
 * too, down to the Latin letters. Spanish adds a second reason of its own,
 * which is why the decision was re-taken rather than inherited. The noun Spanish
 * counts in this domain is "grado"; "centígrado" is an adjective doing noun duty
 * and "celsius"/"fahrenheit" are surnames that never inflect at all. So the only
 * `forms` table that would read naturally is one printing "20 grados
 * centígrados" — three tokens, unreadable back, and the printer's spelled path
 * only ever emits a word the parser can read. Kelvin alone has a real countable
 * noun ("1 kelvin", "5 kelvines"), and giving `k` word forms while `c` and `f`
 * keep symbols would print two registers for one kind. Rule: where the `en` unit
 * decided against word forms, this file does not invent them.
 *
 * `symbol` therefore carries the entire output, which is precisely why R8 wants
 * it explicit on all six: the renderer's no-symbol branch joins number and unit
 * *with* a space, so a unit that forgot its symbol would silently move a byte.
 * The three symbols stay Latin, and Spanish writes them exactly as `en` does.
 *
 * The Latin aliases are **reused** rather than retyped: `aliasesFor` reads the
 * one shared `ALIAS` map in `units.ts`, so "212 F" keeps working in a Spanish
 * engine and the micro path (`parseTemperature`) cannot drift from it. The
 * Spanish spellings are appended from the one `SPANISH` object above.
 *
 * Both kinds are given the identical alias list, and — as in `en` — that is
 * load-bearing rather than tidy: every temperature alias resolving to two kinds
 * is the case `print/unit-word.ts`'s ambiguity fallback exists for, and it is
 * also what lets "20 C + 5 F" read its right operand as a difference. Deriving
 * both lists from the same two sources keeps them equal by construction instead
 * of by proofreading.
 *
 * Like `en`, this file names both kinds by **id string** and imports neither,
 * which is what lets `@smartput/temperature/locale/es` be imported without
 * linking the ratio tables. `composeLocale` is where the two halves meet.
 */
const temperatureEs: readonly Vocabulary[] = [
  defineVocabulary({
    locale: "es",
    kind: "temperature",
    units: {
      c: { aliases: [...alias("c"), ...SPANISH.c], symbol: "°C" },
      f: { aliases: [...alias("f"), ...SPANISH.f], symbol: "°F" },
      k: { aliases: [...alias("k"), ...SPANISH.k], symbol: "K" },
    },
  }),
  defineVocabulary({
    locale: "es",
    kind: "tempdelta",
    units: {
      c: { aliases: [...deltaAlias("c"), ...SPANISH.c], symbol: "°C" },
      f: { aliases: [...deltaAlias("f"), ...SPANISH.f], symbol: "°F" },
      k: { aliases: [...deltaAlias("k"), ...SPANISH.k], symbol: "K" },
    },
  }),
];

export default temperatureEs;
